"""Exercise Rhythm Blocks through its real desktop/mobile UI.

Only this browser context receives a deterministic RNG module response. Game
state is observed, never edited; all play uses keyboard, buttons or touch.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import re

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/rhythm-blocks/browser'
OUT.mkdir(parents=True, exist_ok=True)
PROTECTED = {'musicArcadeV1': '{"test":"preserve arcade"}', 'codaNotesWalletV1': '{"notes":23}'}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


def state(page):
    return page.evaluate('window.rhythmBlocks.state')


def wait_state(page, expression):
    page.wait_for_function('window.rhythmBlocks && (' + expression + ')')


def capture_errors(page, errors):
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)


def deterministic_engine(route, counters, rng='()=>0'):
    response = route.fetch()
    source = response.text()
    needle = 'rng=Math.random'
    assert source.count(needle) == 1, 'The RNG injection point changed; do not silently run a nondeterministic UI test.'
    source = source.replace(needle, 'rng=' + rng, 1)
    counters['deterministicEngineResponses'] += 1
    headers = {key: value for key, value in response.headers.items() if key.lower() not in ['content-length', 'content-encoding']}
    route.fulfill(response=response, body=source, headers={**headers, 'cache-control': 'no-store'})


def no_horizontal_overflow(page):
    return page.evaluate('''() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      board: (() => {const r=document.getElementById('board').getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})()
    })''')


def assert_layout(page):
    layout = no_horizontal_overflow(page)
    assert layout['document'] <= layout['viewport'] + 1, layout
    assert layout['body'] <= layout['viewport'] + 1, layout
    assert layout['board']['left'] >= -1 and layout['board']['right'] <= layout['viewport'] + 1, layout
    assert layout['board']['width'] > 120 and layout['board']['height'] > 250, layout
    return layout


def touch_bounds(page, scroll_into_view=False):
    if scroll_into_view:
        page.locator('.touch-controls').scroll_into_view_if_needed()
    result = page.locator('.touch-controls button').evaluate_all('''items => items.map(button => {
      const r=button.getBoundingClientRect(); return {label:button.getAttribute('aria-label'),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,viewportHeight:innerHeight};
    })''')
    assert len(result) == 4
    for bounds in result:
        assert bounds['top'] >= -1 and bounds['bottom'] <= bounds['viewportHeight'] + 1, bounds
    return result


def move_to_column(page, target):
    wait_state(page, "rhythmBlocks.state.phase==='falling' && !rhythmBlocks.state.paused")
    active = state(page)['active']
    assert active['kind'] == 'quarter', active
    direction = 'ArrowRight' if target > active['col'] else 'ArrowLeft'
    for _ in range(abs(target - active['col'])):
        page.keyboard.press(direction)
    assert state(page)['active']['col'] == target


def open_help(page):
    page.get_by_role('button', name=re.compile(r'how to play|help', re.I)).first.click()
    dialog = page.get_by_role('dialog')
    dialog.wait_for(state='visible')
    assert dialog.locator('svg').count() >= 10, 'Help should show every rhythm symbol.'
    return dialog


def close_help(dialog):
    dialog.get_by_role('button', name=re.compile(r'close|got it|done', re.I)).first.click()
    dialog.wait_for(state='hidden')


def desktop(browser, url, counters):
    errors = []
    context = browser.new_context(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce')
    context.route('**/games/rhythm-blocks/engine.mjs*', lambda route: deterministic_engine(route, counters))
    context.add_init_script('for (const [key,value] of Object.entries(' + json.dumps(PROTECTED) + ')) { if(localStorage.getItem(key)===null) localStorage.setItem(key,value); }')
    page = context.new_page()
    page.set_default_timeout(15000)
    capture_errors(page, errors)
    page.goto(url)
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    layout = assert_layout(page)
    controls = touch_bounds(page)
    close_help(open_help(page))
    assert state(page)['phase'] == 'idle'
    page.locator('#primary-action').click()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert page.locator('#board .tile.active').count() == 1

    origin = state(page)['active']['col']
    page.keyboard.press('ArrowLeft')
    assert state(page)['active']['col'] == origin - 1
    page.keyboard.press('ArrowRight')
    assert state(page)['active']['col'] == origin
    row = state(page)['active']['row']
    page.keyboard.press('ArrowDown')
    assert state(page)['active']['row'] >= row + 1

    page.keyboard.press('p')
    wait_state(page, 'rhythmBlocks.state.paused')
    frozen = state(page)
    page.locator('#board').focus()
    page.keyboard.press('ArrowLeft')
    page.keyboard.press('Space')
    page.wait_for_timeout(1200)
    assert state(page)['active'] == frozen['active']
    assert state(page)['board'] == frozen['board']
    page.screenshot(path=str(OUT / 'desktop-paused.png'))
    page.locator('#primary-action').click()
    wait_state(page, '!rhythmBlocks.state.paused')

    sound = page.locator('#sound')
    before_sound = sound.get_attribute('aria-pressed')
    sound.click()
    assert sound.get_attribute('aria-pressed') != before_sound
    sound.click()
    assert sound.get_attribute('aria-pressed') == before_sound

    page.locator('#restart').click()
    wait_state(page, "rhythmBlocks.state.phase==='falling' && rhythmBlocks.state.score===0")
    assert all(cell is None for row in state(page)['board'] for cell in row)
    for column in range(4):
        move_to_column(page, column)
        page.keyboard.press('Space')
        if column < 3:
            page.wait_for_function('(count)=>document.querySelectorAll("#board .tile.settled").length===count', arg=column + 1)
    wait_state(page, "rhythmBlocks.state.phase==='clearing'")
    page.screenshot(path=str(OUT / 'desktop-four-beat-clear.png'))
    wait_state(page, 'rhythmBlocks.state.score===200 && rhythmBlocks.state.lastClear!==null')
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    cleared = state(page)
    assert cleared['lastClear']['points'] == 200
    assert len(cleared['lastClear']['patterns']) == 1
    pattern = cleared['lastClear']['patterns'][0]
    assert pattern['units'] == 8 and pattern['axis'] == 'horizontal'
    assert [cell['col'] for cell in pattern['cells']] == [0, 1, 2, 3]
    assert pattern['kinds'] == ['quarter'] * 4
    assert page.locator('#board .tile.settled').count() == 0
    assert page.locator('#board .tile.active').count() == 1
    page.screenshot(path=str(OUT / 'desktop-after-clear.png'))

    best = page.locator('#best').inner_text()
    assert '200' in best, best
    saved = page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    assert any('200' in value for key, value in saved.items() if key not in PROTECTED), saved
    assert {key: saved[key] for key in PROTECTED} == PROTECTED
    page.reload()
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    assert page.locator('#best').inner_text() == best
    assert state(page)['score'] == 0
    assert page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(PROTECTED)) == PROTECTED
    assert not errors, errors
    context.close()
    return {'passed': True, 'layout': layout, 'touchControlBounds': controls, 'keyboardMoveAndSoftDrop': True, 'pauseFreezesGravityAndInput': True,
            'soundToggle': True, 'actualHorizontalFourBeatClear': True, 'clearPoints': 200,
            'restart': True, 'localBestPersists': True, 'helpDialog': True, 'protectedProgressUnchanged': True, 'consoleErrors': errors}


def mobile(browser, url, counters):
    errors = []
    context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce')
    context.route('**/games/rhythm-blocks/engine.mjs*', lambda route: deterministic_engine(route, counters))
    page = context.new_page()
    page.set_default_timeout(15000)
    capture_errors(page, errors)
    page.goto(url)
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    idle_layout = assert_layout(page)
    page.locator('#primary-action').tap()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    before = state(page)['active']
    page.get_by_role('button', name=re.compile(r'move left|^left$', re.I)).tap()
    assert state(page)['active']['col'] == before['col'] - 1
    page.get_by_role('button', name=re.compile(r'move right|^right$', re.I)).tap()
    assert state(page)['active']['col'] == before['col']
    row = state(page)['active']['row']
    page.get_by_role('button', name=re.compile(r'soft drop|move down|lower block', re.I)).tap()
    assert state(page)['active']['row'] >= row + 1
    page.get_by_role('button', name=re.compile(r'hard drop|drop block', re.I)).tap()
    page.wait_for_function('document.querySelectorAll("#board .tile.settled").length===1')
    assert sum(cell is not None for row in state(page)['board'] for cell in row) == 1
    playing_layout = assert_layout(page)
    controls = touch_bounds(page)
    page.screenshot(path=str(OUT / 'mobile-playing.png'))
    page.locator('#pause').tap()
    wait_state(page, 'rhythmBlocks.state.paused')
    page.locator('#primary-action').tap()
    wait_state(page, '!rhythmBlocks.state.paused')
    page.locator('#pause').tap()
    wait_state(page, 'rhythmBlocks.state.paused')
    page.locator('#overlay-restart').tap()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert all(cell is None for row in state(page)['board'] for cell in row)
    close_help(open_help(page))
    assert not errors, errors
    context.close()
    return {'passed': True, 'viewport': {'width': 390, 'height': 844}, 'idleLayout': idle_layout,
            'playingLayout': playing_layout, 'touchControlBounds': controls, 'touchLeftRightSoftHardDrop': True, 'pauseResumeRestart': True,
            'helpDialog': True, 'consoleErrors': errors}


def game_over(browser, url, counters):
    """Three-beat dotted halves cannot form four/eight by repeating vertically."""
    errors = []
    context = browser.new_context(viewport={'width': 1366, 'height': 768}, reduced_motion='reduce')
    context.route('**/games/rhythm-blocks/engine.mjs*', lambda route: deterministic_engine(route, counters, '()=>.995'))
    page = context.new_page()
    capture_errors(page, errors)
    page.goto(url)
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    page.locator('#primary-action').click()
    for count in range(24):
        assert state(page)['active']['kind'] == 'dotted-half'
        page.keyboard.press('Space')
        if count < 23:
            wait_state(page, "rhythmBlocks.state.phase==='falling'")
    wait_state(page, "rhythmBlocks.state.phase==='over'")
    over = state(page)
    assert over['score'] == 0 and over['active'] is None
    assert page.locator('#board .tile.settled').count() == 24
    assert page.locator('#overlay').is_visible()
    assert 'wrap' in page.locator('#overlay-title').inner_text().lower()
    assert page.locator('#primary-action').inner_text() == 'Play again'
    page.screenshot(path=str(OUT / 'desktop-game-over.png'))
    page.locator('#primary-action').click()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert state(page)['score'] == 0
    assert page.locator('#board .tile.settled').count() == 0
    assert page.locator('#board .tile.active').count() == 1
    assert not errors, errors
    context.close()
    return {'passed': True, 'actualDroppedBlocks': 24, 'topOut': True, 'playAgainFreshBoard': True, 'consoleErrors': errors}


def varied_notation_and_compact_layout(browser, url, counters):
    # Queue useful distinct values without injecting state or changing game code.
    rng = '(()=>{const values=[.74,.3,.6,.85,.795,.995,.95,.78,.98,0];let n=0;return()=>values[n++%values.length];})()'
    results = []
    for width, height, name in [(1366, 768, 'desktop'), (390, 844, 'mobile'), (320, 568, 'compact')]:
        errors = []
        context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, reduced_motion='reduce')
        context.route('**/games/rhythm-blocks/engine.mjs*', lambda route: deterministic_engine(route, counters, rng))
        page = context.new_page()
        capture_errors(page, errors)
        page.goto(url)
        wait_state(page, "rhythmBlocks.state.phase==='idle'")
        page.screenshot(path=str(OUT / (name + '-idle.png')))
        page.locator('#primary-action').click()
        for column in [0, 2, 4, 6, 8, 9, 7]:
            wait_state(page, "rhythmBlocks.state.phase==='falling'")
            current = state(page)['active']['col']
            key = 'ArrowRight' if column > current else 'ArrowLeft'
            for _ in range(abs(column - current)):
                page.keyboard.press(key)
            page.keyboard.press('Space')
        wait_state(page, "rhythmBlocks.state.phase==='falling'")
        assert page.locator('#board .tile.settled').count() == 7
        assert len(set(page.locator('#board .tile.settled').evaluate_all('items=>items.map(item=>item.dataset.kind)'))) == 7
        layout = assert_layout(page)
        controls = touch_bounds(page, scroll_into_view=name == 'compact')
        page.screenshot(path=str(OUT / (name + '-varied-notation.png')))
        if name == 'compact':
            page.locator('[data-action="left"]').tap()
            assert state(page)['active']['col'] == 3
            page.locator('#pause').tap()
            wait_state(page, 'rhythmBlocks.state.paused')
            page.locator('#primary-action').tap()
            wait_state(page, '!rhythmBlocks.state.paused')
            close_help(open_help(page))
            page.screenshot(path=str(OUT / 'compact-help-closed.png'))
        assert not errors, errors
        results.append({'viewport': {'width': width, 'height': height}, 'layout': layout, 'cellPixels': layout['board']['width'] / 10,
                        'touchControlBounds': controls, 'verticalScrollToControlsAllowed': name == 'compact',
                        'distinctSettledNotation': 7, 'consoleErrors': errors})
        context.close()
    return results


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    counters = {'deterministicEngineResponses': 0}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            results = {'desktop': desktop(browser, url, counters), 'mobile': mobile(browser, url, counters),
                       'gameOver': game_over(browser, url, counters),
                       'variedNotationLayouts': varied_notation_and_compact_layout(browser, url, counters), **counters}
            browser.close()
        assert counters['deterministicEngineResponses'] >= 2
        (OUT / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps(results), flush=True)
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
