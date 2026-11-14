"""Actual shaped-game UI tests; only routed app constructor options are seeded.

Game state is observed, never edited. Production sources are untouched.
"""
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import re
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/rhythm-blocks-shapes'
OUT.mkdir(parents=True, exist_ok=True)
PROTECTED = {'musicArcadeV1': '{"test":"preserve arcade"}', 'codaNotesWalletV1': '{"notes":23}', 'codaRhythmBlocksBestV1': '3210'}
UNITS = {'quarter': 2, 'eighth-pair': 2, 'sixteenth-group': 2, 'half': 4, 'whole': 8, 'eighth': 1, 'quarter-rest': 2, 'half-rest': 4, 'whole-rest': 8, 'dotted-half': 6, 'sixteenth-pair': 1}

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

def route_fixture(route, counters, rng='()=>0', board=None):
    response = route.fetch()
    source = response.text()
    assert source.count('createGame()') == 1, 'The app constructor fixture point changed.'
    options = '{rng:' + rng + (',initialBoard:' + json.dumps(board) if board is not None else '') + '}'
    source = source.replace('createGame()', 'createGame(' + options + ')', 1)
    headers = {key: value for key, value in response.headers.items() if key.lower() not in ['content-length', 'content-encoding']}
    counters['fixtureAppResponses'] += 1
    route.fulfill(response=response, body=source, headers={**headers, 'cache-control': 'no-store'})

def open_page(browser, url, counters, viewport=(1366, 768), touch=False, rng='()=>0', board=None, protected=False):
    context = browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]}, has_touch=touch, is_mobile=touch, reduced_motion='reduce')
    context.route('**/games/rhythm-blocks/app.mjs*', lambda route: route_fixture(route, counters, rng, board))
    if protected:
        context.add_init_script('for(const[key,value]of Object.entries(' + json.dumps(PROTECTED) + ')){if(localStorage.getItem(key)===null)localStorage.setItem(key,value);}')
    page = context.new_page()
    errors = []
    page.set_default_timeout(15000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.goto(url)
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    assert 'rhythm-blocks-shapes-1' in page.locator('script[type="module"]').get_attribute('src')
    return context, page, errors

def cells(piece, row=None):
    return [{'row': (piece['row'] if row is None else row) + cell['row'], 'col': piece['col'] + cell['col'], 'kind': cell['kind'], 'owner': str(piece['id'])} for cell in piece['cells']]

def sorted_cells(items):
    return sorted(items, key=lambda item: (item['row'], item['col'], item['kind'], item.get('owner', '')))

def local_signature(piece):
    return sorted((cell['row'], cell['col'], cell['kind']) for cell in piece['cells'])

def rendered_cells(page, selector):
    return page.locator(selector).evaluate_all('''items=>items.map(e=>({row:Number(e.style.getPropertyValue('--row')),col:Number(e.style.getPropertyValue('--col')),kind:e.dataset.kind,owner:e.dataset.piece}))''')

def landing_cells(snapshot):
    piece = snapshot['active']
    row = piece['row']
    while True:
        candidate = cells(piece, row + 1)
        if not all(0 <= cell['row'] < 24 and 0 <= cell['col'] < 10 and snapshot['board'][cell['row']][cell['col']] is None for cell in candidate):
            return cells(piece, row)
        row += 1

def assert_piece_ui(page):
    probe = page.evaluate('''()=>{
      const read=selector=>[...document.querySelectorAll(selector)].map(e=>({row:Number(e.style.getPropertyValue('--row')),col:Number(e.style.getPropertyValue('--col')),kind:e.dataset.kind,owner:e.dataset.piece}));
      return {snapshot:rhythmBlocks.state,active:read('#active .tile.active'),ghost:read('#ghost .tile.ghost')};
    }''')
    snapshot = probe['snapshot']
    active = snapshot['active']
    assert active and len(active['cells']) == 4
    assert len({(cell['row'], cell['col']) for cell in active['cells']}) == 4
    assert len({UNITS[cell['kind']] for cell in active['cells']}) >= 2
    assert sorted_cells(probe['active']) == sorted_cells(cells(active))
    landing = landing_cells(snapshot)
    expected = landing if min(cell['row'] for cell in landing) > min(cell['row'] for cell in cells(active)) else []
    assert sorted_cells(probe['ghost']) == sorted_cells(expected)
    assert page.locator('#next-symbol .preview-cell').count() == 4
    assert page.locator('#next-symbol .preview-cell svg').count() == 4
    assert snapshot['next']['shape'] in page.locator('#next-label').inner_text()
    assert page.evaluate('''async()=>{
      const source=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname.endsWith('/rhythm-blocks/notation.mjs')).name;
      const {symbolMarkup}=await import(source),piece=rhythmBlocks.state.next;
      return [...document.querySelectorAll('#next-symbol .preview-cell')].every((e,index)=>{
        const cell=piece.cells[index],expected=document.createElement('div');expected.innerHTML=symbolMarkup(cell.kind);
        return Number(e.style.gridColumn)===cell.col+1&&Number(e.style.gridRow)===cell.row+1&&e.firstElementChild.isEqualNode(expected.firstElementChild);
      });
    }''')
    return snapshot

def assert_layout(page, scroll_controls=False):
    layout = page.evaluate('''()=>{const r=document.getElementById('board').getBoundingClientRect();return{viewportWidth:innerWidth,viewportHeight:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,board:{left:r.left,right:r.right,width:r.width,height:r.height}}}''')
    assert layout['documentWidth'] <= layout['viewportWidth'] + 1 and layout['bodyWidth'] <= layout['viewportWidth'] + 1, layout
    assert layout['board']['left'] >= -1 and layout['board']['right'] <= layout['viewportWidth'] + 1, layout
    assert layout['board']['width'] >= 180 and abs(layout['board']['height'] / layout['board']['width'] - 2.4) < .02
    if scroll_controls:
        page.locator('.touch-controls').scroll_into_view_if_needed()
    buttons = page.locator('.touch-controls button').evaluate_all('''items=>items.map(e=>{const r=e.getBoundingClientRect();return{action:e.dataset.action,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}})''')
    assert {button['action'] for button in buttons} == {'left', 'right', 'rotate', 'down', 'drop'}
    for button in buttons:
        assert 0 <= button['left'] < button['right'] <= layout['viewportWidth'] + 1, button
        assert button['top'] >= -1 and button['bottom'] <= layout['viewportHeight'] + 1, button
    return {**layout, 'controls': buttons, 'verticalScrollToControls': scroll_controls}

def start(page, touch=False):
    getattr(page.locator('#primary-action'), 'tap' if touch else 'click')()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    return assert_piece_ui(page)

def help_dialog(page):
    page.locator('#help').click()
    dialog = page.get_by_role('dialog')
    dialog.wait_for(state='visible')
    assert dialog.locator('.legend-row').count() == 11
    assert dialog.locator('svg').count() == 11
    assert re.search(r'different pieces', dialog.inner_text(), re.I)
    dialog.get_by_role('button', name=re.compile(r'close|got it|done', re.I)).first.click()
    dialog.wait_for(state='hidden')

def desktop(browser, url, counters):
    context, page, errors = open_page(browser, url, counters, protected=True)
    layout = assert_layout(page)
    assert page.locator('#best').inner_text() == '0', 'Old single-note best must not become shaped best.'
    help_dialog(page)
    initial = start(page)
    identity = initial['active']['id']
    kinds = Counter(cell['kind'] for cell in initial['active']['cells'])
    original = local_signature(initial['active'])
    page.keyboard.press('ArrowLeft')
    assert state(page)['active']['col'] == initial['active']['col'] - 1
    page.keyboard.press('ArrowRight')
    page.keyboard.press('ArrowUp')
    assert state(page)['active']['rotation'] == 1
    assert_piece_ui(page)
    page.keyboard.press('z')
    assert state(page)['active']['rotation'] == 0 and local_signature(state(page)['active']) == original
    for _ in range(4):
        page.keyboard.press('x')
    rotated = assert_piece_ui(page)['active']
    assert rotated['id'] == identity and Counter(cell['kind'] for cell in rotated['cells']) == kinds
    assert local_signature(rotated) == original
    row = rotated['row']
    page.keyboard.press('ArrowDown')
    assert state(page)['active']['row'] >= row + 1
    for _ in range(12):
        page.keyboard.press('ArrowLeft')
    at_wall = state(page)['active']
    assert min(cell['col'] for cell in cells(at_wall)) == 0
    page.keyboard.press('ArrowLeft')
    assert state(page)['active']['col'] == at_wall['col']
    page.keyboard.press('ArrowUp')
    assert all(0 <= cell['col'] < 10 for cell in cells(state(page)['active']))
    before_drop = assert_piece_ui(page)
    landing = landing_cells(before_drop)
    previous_next = before_drop['next']
    page.keyboard.press('Space')
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    dropped = assert_piece_ui(page)
    assert page.locator('#board .tile.settled').count() == 4
    assert dropped['score'] == 0 and dropped['lastClear'] is None, 'A new shape must not clear itself.'
    for cell in landing:
        assert dropped['board'][cell['row']][cell['col']] == cell['kind']
        assert str(dropped['boardOwners'][cell['row']][cell['col']]) == cell['owner']
    assert dropped['active']['id'] != identity and dropped['active']['shape'] == previous_next['shape']
    assert local_signature(dropped['active']) == local_signature(previous_next)
    page.keyboard.press('p')
    wait_state(page, 'rhythmBlocks.state.paused')
    page.locator('#board').focus()
    frozen = state(page)
    for key in ['ArrowLeft', 'ArrowUp', 'z', 'Space']:
        page.keyboard.press(key)
    page.wait_for_timeout(1150)
    assert state(page)['active'] == frozen['active'] and state(page)['board'] == frozen['board']
    page.screenshot(path=str(OUT / 'desktop-paused.png'))
    page.locator('#primary-action').click()
    wait_state(page, '!rhythmBlocks.state.paused')
    sound = page.locator('#sound')
    old_sound = sound.get_attribute('aria-pressed')
    sound.click()
    assert sound.get_attribute('aria-pressed') != old_sound
    sound.click()
    assert sound.get_attribute('aria-pressed') == old_sound
    page.locator('#restart').click()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert not any(kind for row in state(page)['board'] for kind in row)
    assert_piece_ui(page)
    assert page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(PROTECTED)) == PROTECTED
    assert not errors, errors
    context.close()
    return {'passed': True, 'layout': layout, 'fourCellMovementRotationAndIdentity': True, 'wallCollision': True,
            'ghostAndNextGeometry': True, 'hardDropPreservesOwnership': True, 'samePieceCannotSelfClear': True,
            'pauseBlocksMovementRotationDropAndGravity': True, 'restartSoundHelp': True, 'protectedProgress': True, 'errors': errors}

def mobile(browser, url, counters):
    context, page, errors = open_page(browser, url, counters, viewport=(390, 844), touch=True)
    before = start(page, touch=True)
    original = before['active']
    page.locator('[data-action="left"]').tap()
    assert state(page)['active']['col'] == original['col'] - 1
    page.locator('[data-action="right"]').tap()
    page.locator('[data-action="rotate"]').tap()
    after_rotate = assert_piece_ui(page)['active']
    assert after_rotate['rotation'] == 1 and after_rotate['id'] == original['id']
    assert Counter(cell['kind'] for cell in after_rotate['cells']) == Counter(cell['kind'] for cell in original['cells'])
    row = after_rotate['row']
    page.locator('[data-action="down"]').tap()
    assert state(page)['active']['row'] >= row + 1
    page.locator('[data-action="drop"]').tap()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert page.locator('#board .tile.settled').count() == 4 and state(page)['score'] == 0
    assert_piece_ui(page)
    layout = assert_layout(page)
    page.screenshot(path=str(OUT / 'mobile-playing.png'))
    page.locator('#pause').tap()
    wait_state(page, 'rhythmBlocks.state.paused')
    page.locator('#primary-action').tap()
    wait_state(page, '!rhythmBlocks.state.paused')
    page.locator('#pause').tap()
    page.locator('#overlay-restart').tap()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert page.locator('#board .tile.settled').count() == 0
    help_dialog(page)
    assert not errors, errors
    context.close()
    return {'passed': True, 'layout': layout, 'touchFourCellMovementRotationAndDrop': True, 'pauseResumeRestart': True, 'errors': errors}

def seeded_clear(browser, url, counters, beats):
    board = [[None] * 10 for _ in range(24)]
    if beats == 4:
        board[23][6] = 'quarter'
    else:
        board[23][6], board[23][7] = 'half', 'dotted-half'
    context, page, errors = open_page(browser, url, counters, board=board, protected=True)
    initial = start(page)
    assert initial['active']['shape'] == 'O' and initial['active']['col'] == 4
    page.keyboard.press('Space')
    wait_state(page, "rhythmBlocks.state.phase==='clearing'")
    clearing = state(page)
    pattern = next(pattern for pattern in clearing['clearingMatches'] if pattern['axis'] == 'horizontal' and pattern['units'] == beats * 2)
    owners = {clearing['boardOwners'][cell['row']][cell['col']] for cell in pattern['cells']}
    assert len(pattern['cells']) >= 2 and len(owners) >= 2
    assert initial['active']['id'] in owners and any(owner < 0 for owner in owners)
    page.screenshot(path=str(OUT / f'actual-{beats}-beat-clear.png'))
    expected = 200 if beats == 4 else 500
    wait_state(page, f'rhythmBlocks.state.score==={expected}')
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    final = assert_piece_ui(page)
    assert final['lastClear']['points'] == expected and page.locator('#score').inner_text() == str(expected)
    assert page.locator('#board .tile.settled').count() == 2
    assert page.locator('#best').inner_text() == str(expected)
    assert page.evaluate('localStorage.getItem("codaRhythmBlocksShapesBestV1")') == str(expected)
    page.reload()
    wait_state(page, "rhythmBlocks.state.phase==='idle'")
    assert page.locator('#best').inner_text() == str(expected)
    assert page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(PROTECTED)) == PROTECTED
    assert not errors, errors
    context.close()
    return {'passed': True, 'beats': beats, 'points': expected, 'patternKinds': pattern['kinds'], 'distinctPieceOwners': len(owners),
            'realDropAndClear': True, 'bestPersistsUnderNewKey': True, 'oldSingleBestAndOtherProgressPreserved': True, 'errors': errors}

def game_over(browser, url, counters):
    rng = '(()=>{let x=1;return()=>((x=(x*1664525+1013904223)>>>0)/4294967296);})()'
    context, page, errors = open_page(browser, url, counters, rng=rng)
    start(page)
    drops = 0
    while drops < 80 and state(page)['phase'] != 'over':
        wait_state(page, "['falling','over'].includes(rhythmBlocks.state.phase)")
        if state(page)['phase'] == 'over':
            break
        page.keyboard.press('Space')
        drops += 1
    wait_state(page, "rhythmBlocks.state.phase==='over'")
    assert state(page)['active'] is None and page.locator('#overlay').is_visible()
    assert page.locator('#primary-action').inner_text() == 'Play again'
    page.screenshot(path=str(OUT / 'game-over.png'))
    page.locator('#primary-action').click()
    wait_state(page, "rhythmBlocks.state.phase==='falling'")
    assert not any(kind for row in state(page)['board'] for kind in row)
    assert state(page)['score'] == 0 and page.locator('#active .tile').count() == 4
    assert not errors, errors
    context.close()
    return {'passed': True, 'realDroppedPieces': drops, 'topOutAndFreshPlayAgain': True, 'errors': errors}

def layout_gallery(browser, url, counters):
    results = []
    rng = '(()=>{let x=314159;return()=>((x=(x*1664525+1013904223)>>>0)/4294967296);})()'
    for width, height, name in [(1366, 768, 'desktop'), (390, 844, 'phone'), (320, 568, 'compact')]:
        context, page, errors = open_page(browser, url, counters, viewport=(width, height), touch=True, rng=rng)
        page.screenshot(path=str(OUT / (name + '-idle.png')))
        start(page, touch=True)
        for target, rotations in [(0, 0), (6, 1), (2, 0), (5, 2)]:
            wait_state(page, "rhythmBlocks.state.phase==='falling'")
            for _ in range(rotations):
                page.keyboard.press('ArrowUp')
            active = state(page)['active']
            maximum = 9 - max(cell['col'] for cell in active['cells'])
            target = min(target, maximum)
            direction = 'ArrowRight' if target > active['col'] else 'ArrowLeft'
            for _ in range(abs(target - active['col'])):
                page.keyboard.press(direction)
            page.keyboard.press('Space')
            wait_state(page, "rhythmBlocks.state.phase==='falling'")
        assert_piece_ui(page)
        layout = assert_layout(page, scroll_controls=name == 'compact')
        page.screenshot(path=str(OUT / (name + '-shaped-playing.png')))
        if name == 'compact':
            previous = state(page)['active']['rotation']
            page.locator('[data-action="rotate"]').tap()
            assert state(page)['active']['rotation'] == (previous + 1) % 4
            page.locator('#pause').tap()
            wait_state(page, 'rhythmBlocks.state.paused')
            page.locator('#primary-action').tap()
            wait_state(page, '!rhythmBlocks.state.paused')
        assert not errors, errors
        results.append({'viewport': {'width': width, 'height': height}, 'layout': layout, 'fourCellActiveGhostAndPreview': True, 'errors': errors})
        context.close()
    return results

def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    counters = {'fixtureAppResponses': 0}
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            results = {'desktop': desktop(browser, url, counters), 'mobile': mobile(browser, url, counters),
                       'fourBeatClear': seeded_clear(browser, url, counters, 4), 'eightBeatClear': seeded_clear(browser, url, counters, 8),
                       'gameOver': game_over(browser, url, counters), 'layouts': layout_gallery(browser, url, counters), **counters}
            browser.close()
        (OUT / 'results.json').write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps(results), flush=True)
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
