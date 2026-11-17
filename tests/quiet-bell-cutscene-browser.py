"""Real entrance performances and an editable, tile-quantized director timeline.

The game is observed through read-only snapshots. Movement advances actual RAF
callbacks; edits, previews, scrubbing, skipping, imports and exports use the UI.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import math
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/room-cutscenes'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)


def cutscene(page):
    return page.evaluate('window.quietBell.cutscene')


def live_cutscene(page):
    value = cutscene(page)
    return value and not value.get('finished', False)


def assert_release(page, expected=None):
    base = page.evaluate('document.baseURI')
    if expected:
        assert '/releases/' + expected + '/' in base, (expected, base)
    return base


def tick(page, duration=100):
    if page in ui.VIRTUAL_WALK_PAGES:
        page.clock.run_for(duration)
    else:
        page.wait_for_timeout(duration)


def wait_for_story(page):
    """Let the doorway performance finish before checking authored story clips.

    Entry movement/fading has its own browser suite. These checks still exercise
    the original dialogue, walking and director timeline at their authored times.
    Advancing actual RAF callbacks also works when Playwright owns the clock.
    """
    ui.skip_intro(page)
    waited = 0
    value = cutscene(page)
    while value and value.get('phase') == 'entry' and waited < 30000:
        tick(page, 100)
        waited += 100
        value = cutscene(page)
    assert not value or value.get('phase') != 'entry', value
    return value


def conserved(page):
    return {'resources': ui.resources(ui.state(page)), 'journal': page.evaluate('quietBell.journey')}


def normal_storage(page):
    return page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',
                         [ui.SAVE_KEY, 'codaQuietBellJourneyV1', *ui.PROTECTED])


def actor(value, identifier):
    return next(item for item in value['actors'] if item['id'] == identifier)


def point_distance(first, second):
    return math.hypot(first['x'] - second['x'], first['y'] - second['y'])


def assert_floor(page, value):
    result = page.evaluate('''async poses=>{
      const {isWalkable}=await import(new URL('room.mjs',document.baseURI));
      const scene=quietBell.scene,ids=new Set(scene.actors.map(a=>a.id));
      const room={...scene.geometry,obstacles:scene.geometry.obstacles.filter(o=>!ids.has(o.id))};
      return poses.map(p=>({id:p.id,walkable:isWalkable(room,p)}));
    }''', value['actors'])
    assert all(item['walkable'] for item in result), result


def assert_panel_layout(page):
    bounds = page.locator('#cutscene-panel').bounding_box()
    assert bounds and bounds['x'] >= -1 and bounds['y'] >= -1, bounds
    viewport = page.viewport_size
    assert bounds['x'] + bounds['width'] <= viewport['width'] + 1, (bounds, viewport)
    assert bounds['y'] + bounds['height'] <= viewport['height'] + 1, (bounds, viewport)
    assert page.locator('#cutscene-line').inner_text().strip()
    assert page.locator('#cutscene-speaker').inner_text().strip()
    for selector in ['#cutscene-next', '#cutscene-skip']:
        rect = page.locator(selector).bounding_box()
        assert rect and rect['width'] >= 43.5 and rect['height'] >= 43.5, (selector, rect)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')


def advance_to_finish(page):
    value = cutscene(page)
    assert value and value['totalTiles'] > 0 and value['quantumMs'] > 0, value
    if value.get('manualDialogue'):
        for _ in range(1800):
            value = cutscene(page)
            if not value or value.get('finished'):break
            if value.get('beat') and value.get('textComplete') and page.locator('#cutscene-next').is_enabled():
                page.locator('#cutscene-next').click()
            tick(page, 100)
    else:
        tick(page, math.ceil(value['totalTiles'] * value['quantumMs']) + 1500)
    assert not live_cutscene(page), cutscene(page)
    assert page.locator('#cutscene-panel').is_hidden()


def replay(page):
    ui.close_panels(page)
    page.locator('#menu').click()
    page.locator('#replay-cutscene').click()
    wait_for_story(page)
    page.locator('#cutscene-panel').wait_for(state='visible')
    assert live_cutscene(page)


def entrance_flow(browser, url, expected=None):
    context, page, errors, writes, external = ui.open_page(
        browser, url, 1024, 'light', height=768, skip_cutscenes=False, reduced_motion='no-preference')
    release_base = assert_release(page, expected)
    wait_for_story(page)
    page.locator('#cutscene-panel').wait_for(state='visible')
    original = conserved(page)
    original_player = ui.walker(page)
    initial = cutscene(page)
    assert initial and not initial.get('preview') and initial['playing'], initial
    assert abs(initial['quantumMs'] - 1000 * page.evaluate('quietBell.scene.geometry.gridSize/quietBell.scene.geometry.speed')) < .001
    assert_panel_layout(page)
    assert_floor(page, initial)
    page.keyboard.down('ArrowRight');tick(page, 600);page.keyboard.up('ArrowRight')
    progressed = cutscene(page)
    assert progressed['currentTile'] > initial['currentTile']
    first_mover = initial['beat'].get('actor', initial['beat']['speaker'])
    assert point_distance(actor(initial, first_mover), actor(progressed, first_mover)) > 15, (initial, progressed)
    assert point_distance(original_player, ui.walker(page)) < .1, 'Player input stays paused during the entrance.'
    assert conserved(page) == original, 'Searching in a cutscene must not claim notes or journal clues.'
    assert_floor(page, progressed)
    assert page.locator('.cutscene-emote[data-cutscene-emote]').count() > 0
    page.screenshot(path=str(OUT / 'entrance-moving-desktop.png'))
    before_blur = page.evaluate('(()=>{window.dispatchEvent(new Event("blur"));return quietBell.cutscene.currentTile;})()')
    tick(page, 350)
    assert abs(cutscene(page)['currentTile'] - before_blur) < .001
    page.evaluate('window.dispatchEvent(new Event("focus"))');tick(page, 150)
    assert cutscene(page)['currentTile'] > before_blur
    replay(page)
    if not cutscene(page).get('textComplete', True):
        revealing = cutscene(page)
        page.locator('#cutscene-next').click()
        revealed = cutscene(page)
        assert revealed['textComplete'] and revealed['index'] == revealing['index'], revealed
    page.evaluate('''()=>{
      const button=document.getElementById('cutscene-next');
      button.addEventListener('click',()=>{window.__queuedNext={before:quietBell.cutscene};},{capture:true,once:true});
      button.addEventListener('click',()=>{window.__queuedNext.after=quietBell.cutscene;},{once:true});
    }''')
    page.locator('#cutscene-next').click()
    observed_next = page.evaluate('window.__queuedNext')
    before_next, queued = observed_next['before'], observed_next['after']
    if before_next.get('manualDialogue'):
        assert queued['index'] > before_next['index'] and not queued['nextPending'], queued
        assert queued['beat']['id'] != before_next['beat']['id']
        assert queued['visibleCharacters'] <= 1, queued
        assert page.locator('#cutscene-next').is_enabled()
    else:
        assert queued['index'] == before_next['index'] and queued['nextPending'], queued
        assert page.locator('#cutscene-next').is_disabled()
    assert all(point_distance(actor(before_next, item['id']), item) < .001 for item in queued['actors'])
    speed = page.evaluate('quietBell.scene.geometry.speed')
    previous_timed = page.evaluate('({state:quietBell.cutscene,now:performance.now()})')
    waited = 0
    while cutscene(page)['index'] == before_next['index'] and waited < 10000:
        tick(page, 50);waited += 50
        current_timed = page.evaluate('({state:quietBell.cutscene,now:performance.now()})')
        current, previous = current_timed['state'], previous_timed['state']
        # Playwright's synthetic RAF timestamp can lead performance.now by
        # one frame. Native-frame velocity is checked without this allowance
        # in quiet-bell-cutscene-performance-browser.py.
        elapsed_seconds = (current_timed['now'] - previous_timed['now']) / 1000 + .02
        for item in current['actors']:
            old_actor = actor(previous, item['id'])
            gait_rate = 2 if 'run' in [old_actor.get('gait'), item.get('gait')] else 1
            assert point_distance(old_actor, item) <= speed * gait_rate * current.get('playbackRate', 1) * elapsed_seconds + 2, (previous_timed, current_timed)
        assert conserved(page) == original
        previous_timed = current_timed
    advanced = cutscene(page)
    assert advanced['index'] > before_next['index'] and not advanced['nextPending'], advanced
    assert page.locator('#cutscene-next').is_enabled()
    assert conserved(page) == original
    advance_to_finish(page)
    assert conserved(page) == original
    ui.protected_storage(page)
    # The finished performance leaves interaction areas with the actual actors.
    scene = page.evaluate('quietBell.scene')
    for character in scene['actors']:
        target = next(item for item in scene['geometry']['targets'] if item['id'] == character['id'])
        assert point_distance(character['feet'], target) < .1, (character, target)
    ui.press(page, '[data-person="nell"]')
    assert page.locator('#conversation-dialog').is_visible()
    assert ui.state(page)['inventory'] == ui.EMPTY
    ui.close_panels(page)
    # Completed entrances are remembered across a reload without changing stock.
    before_reload = conserved(page)
    page.reload();page.wait_for_function('!!window.quietBell?.walker')
    page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
    assert_release(page, expected)
    tick(page, 100)
    assert not live_cutscene(page) and page.locator('#cutscene-panel').is_hidden()
    assert conserved(page) == before_reload
    replay(page)
    tick(page, 250)
    page.keyboard.press('Escape')
    assert not live_cutscene(page) and page.locator('#cutscene-panel').is_hidden()
    assert conserved(page) == before_reload
    # A held key before Skip must not continue walking after control returns.
    replay(page)
    page.keyboard.down('ArrowLeft');tick(page, 150)
    page.locator('#cutscene-skip').click();page.keyboard.up('ArrowLeft')
    after_skip = ui.walker(page);tick(page, 300)
    assert point_distance(after_skip, ui.walker(page)) < .1
    assert conserved(page) == before_reload
    # Starting over re-arms the opening while permanent discoveries stay intact.
    page.locator('#menu').click();page.locator('#restart').click()
    ui.skip_intro(page)
    assert live_cutscene(page) and ui.state(page)['inventory'] == ui.EMPTY
    page.keyboard.press('F2')
    page.locator('#developer-console').wait_for(state='visible')
    assert not live_cutscene(page), 'Opening the director cancels the player entrance cleanly.'
    page.keyboard.press('F2');tick(page, 100)
    assert not live_cutscene(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'releaseBase': release_base, 'movingActors': True, 'emotes': True, 'noPickupsOrDiscoveries': True,
            'clickToFinish': True, 'nextAndSkip': True, 'nextKeepsWalkContinuous': True, 'reloadOnceOnly': True,
            'replayAndRestart': True, 'frozenInput': True, 'postSceneInteraction': True}


def change(page, selector, value):
    field = page.locator(selector)
    field.fill(str(value));field.dispatch_event('change');tick(page, 30)


def choose(page, group, value):
    page.locator(group + ' [data-cutscene-choice="' + value + '"]').click();tick(page, 30)


def selected_clip(page):
    return page.locator('.cse-clip[aria-selected="true"]')


def select_track_clip(page, identifier, kind):
    clip = page.locator('[data-cutscene-actor="' + identifier + '"] .cse-clip[data-cutscene-kind="' + kind + '"]').first
    clip.scroll_into_view_if_needed();clip.click();tick(page, 50)
    assert selected_clip(page).get_attribute('data-cutscene-kind') == kind
    return int(selected_clip(page).get_attribute('data-cutscene-clip'))


def clip_numbers(clip):
    return {key: float(clip.get_attribute('data-' + key)) for key in ['start-tile', 'duration-tiles', 'min-duration']}


def export_project(page, name):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    with page.expect_download() as event:
        page.locator('#developer-export').click()
    download = event.value
    path = OUT / (name + '.json');download.save_as(path)
    if tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    return json.loads(path.read_text())


def timeline_flow(browser, url, expected=None):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light', height=768)
    assert_release(page, expected)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="rooms"]').click();tick(page, 50)
    assert page.locator('#developer-cutscene-timeline').is_visible(), 'The existing Room shortcut remains available.'
    page.locator('[data-dev-tab="cutscene"]').click();tick(page, 100)
    timeline = page.locator('#developer-cutscene-timeline')
    assert timeline.is_visible() and page.locator('.cse-clip').count() >= 12
    quantum = float(timeline.get_attribute('data-quantum-ms'))
    expected = page.evaluate('1000*quietBell.scene.geometry.gridSize/quietBell.scene.geometry.speed')
    assert abs(quantum - expected) < .001, (quantum, expected)
    assert page.locator('#developer-cutscene-scrub').get_attribute('step') == '1'
    baseline = normal_storage(page);frozen = ui.walker(page)
    walk_index = select_track_clip(page, 'nell', 'walk')
    assert page.locator('#developer-cutscene-start').get_attribute('step') == '1'
    assert page.locator('#developer-cutscene-duration').get_attribute('step') == '1'
    initial = clip_numbers(selected_clip(page))
    selected_clip(page).focus();page.keyboard.press('ArrowRight');tick(page, 50)
    shifted = clip_numbers(selected_clip(page))
    assert shifted['start-tile'] == initial['start-tile'] + 1, (initial, shifted)
    # A real pointer drag snaps to whole tile increments.
    selected_clip(page).scroll_into_view_if_needed()
    point = selected_clip(page).evaluate('''e=>{
      const r=e.getBoundingClientRect(),s=document.getElementById('developer-cutscene-scroll').getBoundingClientRect(),b=document.getElementById('developer-body').getBoundingClientRect();
      const label=parseFloat(getComputedStyle(e).getPropertyValue('--cse-label-width'))||92;
      const left=Math.max(r.left,s.left+label+2,b.left),right=Math.min(r.right-18,s.right-8,b.right),top=Math.max(r.top,s.top,b.top),bottom=Math.min(r.bottom,s.bottom,b.bottom);
      for(const fy of [.5,.25,.75])for(const fx of [.2,.5,.8]){
        const x=left+(right-left)*fx,y=top+(bottom-top)*fy,node=document.elementFromPoint(x,y);
        if(node?.closest('[data-cutscene-clip]')===e&&!node.closest('[data-cutscene-resize]'))return{x,y};
      }return null;
    }''')
    assert point, 'The selected clip needs a visible drag surface.'
    page.mouse.move(point['x'], point['y'])
    page.mouse.down();page.mouse.move(point['x'] + 36, point['y'], steps=7);page.mouse.up();tick(page, 100)
    moved = clip_numbers(selected_clip(page))
    assert moved['start-tile'].is_integer() and moved['start-tile'] != shifted['start-tile'], (shifted, moved)
    # Trimming below the travel time stays at the real walk minimum.
    handle = selected_clip(page).locator('[data-cutscene-resize]')
    handle.scroll_into_view_if_needed();rect = handle.bounding_box()
    page.mouse.move(rect['x']+rect['width']/2, rect['y']+rect['height']/2)
    page.mouse.down();page.mouse.move(rect['x']-2500, rect['y']+rect['height']/2, steps=12);page.mouse.up();tick(page, 100)
    trimmed = clip_numbers(selected_clip(page))
    assert trimmed['duration-tiles'].is_integer() and trimmed['duration-tiles'] >= trimmed['min-duration'] >= 1, trimmed
    # Movement, speech and emotes have independent, type-specific properties.
    edited_line = 'Wait—does this little lamp remember the last delivery?'
    choose(page, '#developer-cutscene-action', 'listen')
    dialogue_index = select_track_clip(page, 'nell', 'dialogue')
    change(page, '#developer-cutscene-text', edited_line)
    emote_index = select_track_clip(page, 'nell', 'emote')
    choose(page, '#developer-cutscene-emote', 'idea')
    before_count = page.locator('.cse-clip').count()
    page.locator('#developer-cutscene-duplicate').click();tick(page, 100)
    assert page.locator('.cse-clip').count() == before_count + 1
    page.locator('#developer-cutscene-delete').click();tick(page, 100)
    assert page.locator('.cse-clip').count() == before_count
    exported = export_project(page, 'editable-timeline')
    beats = exported['content']['depot']['cutscene']
    assert beats[walk_index]['kind'] == 'walk' and beats[walk_index]['action'] == 'listen'
    assert beats[dialogue_index]['kind'] == 'dialogue' and beats[dialogue_index]['text'] == edited_line
    assert beats[emote_index]['kind'] == 'emote' and beats[emote_index]['emote'] == 'idea'
    assert 'text' not in beats[walk_index] and 'emote' not in beats[walk_index]
    assert 'target' not in beats[dialogue_index] and 'emote' not in beats[dialogue_index]
    assert 'text' not in beats[emote_index] and 'target' not in beats[emote_index]
    assert all(isinstance(beat['startTile'], int) and isinstance(beat['durationTiles'], int) and beat['durationTiles'] >= 1 for beat in beats), beats
    assert normal_storage(page) == baseline
    # Playback, pause and scrubbing are a read-only preview of this exact draft.
    page.locator('#developer-cutscene-play').click();tick(page, 350)
    value = cutscene(page)
    assert value and value['preview'] and value['playing'], value
    assert normal_storage(page) == baseline
    page.locator('#developer-cutscene-pause').click();tick(page, 100)
    paused = cutscene(page)
    assert not paused['playing']
    tick(page, 500)
    assert abs(cutscene(page)['currentTile'] - paused['currentTile']) < .001
    scrub = page.locator('#developer-cutscene-scrub')
    scrub.focus();page.keyboard.press('End');tick(page, 100)
    end = cutscene(page)
    assert end and end['currentTile'] >= end['totalTiles']-1, end
    page.locator('#developer-cutscene-stop').click();tick(page, 100)
    assert not live_cutscene(page)
    assert point_distance(frozen, ui.walker(page)) < .1
    assert normal_storage(page) == baseline
    # Every shipped room's authored search can preview without changing the run.
    locations = page.evaluate('Object.keys(quietBell.project.scenes)')
    checked = []
    for room in locations:
        page.locator('[data-dev-room="' + room + '"]').click();tick(page, 80)
        page.locator('#developer-cutscene-play').click();tick(page, 250)
        value = cutscene(page)
        assert value and value['preview'], (room, value)
        assert page.evaluate('quietBell.scene.id') == room
        assert_floor(page, value)
        assert normal_storage(page) == baseline
        page.locator('#developer-cutscene-stop').click();tick(page, 30)
        checked.append(room)
    page.screenshot(path=str(OUT / 'timeline-desktop.png'))
    # Saved/exported scripts round trip through the existing project importer.
    page.locator('#developer-save').click();tick(page, 50)
    page.locator('#developer-file').set_input_files({'name':'timeline.json','mimeType':'application/json','buffer':json.dumps(exported).encode()})
    tick(page, 100)
    assert page.locator('#developer-errors').is_hidden()
    imported = export_project(page, 'timeline-round-trip')
    assert imported['content']['depot']['cutscene'] == beats
    assert normal_storage(page) == baseline
    # Leaving the timeline stops its preview instead of leaking an animation
    # into another inspector or retaining its temporary actor positions.
    page.locator('#developer-cutscene-play').click();tick(page, 150)
    assert live_cutscene(page) and cutscene(page)['preview']
    page.locator('[data-dev-tab="dialogue"]').click();tick(page, 100)
    assert not live_cutscene(page) and normal_storage(page) == baseline
    # Apply closes the inspector asynchronously. That close event must not
    # cancel the new, ordinary entrance in the separate developer playtest.
    page.locator('#developer-apply').click()
    page.locator('#developer-console').wait_for(state='hidden');tick(page, 200)
    ui.skip_intro(page)
    applied = cutscene(page)
    assert ui.state(page)['developerMode'] and applied and not applied['preview'], applied
    assert live_cutscene(page) and normal_storage(page) == baseline
    page.locator('#cutscene-skip').click();tick(page, 100)
    page.locator('#developer-end').click();tick(page, 100)
    assert not ui.state(page)['developerMode']
    assert not live_cutscene(page) and normal_storage(page) == baseline
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    release_base = page.evaluate('document.baseURI')
    context.close()
    return {'releaseBase': release_base, 'roomsPreviewed': checked, 'tileQuantum': quantum, 'integerDragAndResize': True,
            'walkTimeMinimum': True, 'independentDialogueActionsEmotesEditable': True,
            'playPauseScrubStop': True, 'tabChangeStopsPreview': True,
            'applyPreservesNewEntrance': True, 'exportRoundTrip': True,
            'ordinaryStorageUntouched': True}


def phone_flow(browser, url, width, height, reduced=False, expected=None):
    context, page, errors, writes, external = ui.open_page(
        browser, url, width, 'dark', height=height, skip_cutscenes=False,
        reduced_motion='reduce' if reduced else 'no-preference')
    release_base = assert_release(page, expected)
    wait_for_story(page)
    page.locator('#cutscene-panel').wait_for(state='visible')
    assert_panel_layout(page)
    original = conserved(page)
    tick(page, 250)
    page.screenshot(path=str(OUT / (f'entrance-{width}-' + ('reduced' if reduced else 'touch') + '.png')))
    page.locator('#cutscene-next').tap();tick(page, 100)
    assert_panel_layout(page)
    page.locator('#cutscene-skip').tap();tick(page, 100)
    assert not live_cutscene(page) and conserved(page) == original
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').tap();tick(page, 100)
    assert page.locator('#developer-cutscene-timeline').is_visible()
    assert page.locator('#developer-cutscene-scrub').get_attribute('step') == '1'
    page.locator('#developer-expand').tap()
    page.locator('#developer-cutscene-play').scroll_into_view_if_needed()
    assert page.locator('#developer-expand').get_attribute('aria-expanded') == 'true'
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    page.screenshot(path=str(OUT / f'timeline-{width}.png'))
    page.keyboard.press('F2')
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'releaseBase': release_base, 'width': width, 'height': height, 'reducedMotion': reduced, 'touchNextSkip': True, 'timelineFits': True}


class PublicBrowser:
    def __init__(self, browser):
        self.browser = browser

    def new_context(self, **options):
        context = self.browser.new_context(ignore_https_errors=True, **options)
        original = context.route
        def route(pattern, handler):
            def handle(request):
                if request.request.url.split('?')[0].endswith('/favicon.ico'):
                    request.fulfill(status=204)
                else:
                    handler(request)
            original(pattern, handle)
        context.route = route
        return context


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
    args = parser.parse_args()
    server = None
    if args.url:
        url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if args.source else '')
    started = time.monotonic()
    try:
        with ui.sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            runner = PublicBrowser(browser) if args.url else browser
            try:
                result = {'entry': url, 'entrance': entrance_flow(runner, url, args.expect_release), 'timeline': timeline_flow(runner, url, args.expect_release),
                          'phone': [phone_flow(runner, url, 390, 844, expected=args.expect_release), phone_flow(runner, url, 320, 568, reduced=True, expected=args.expect_release)]}
            except Exception:
                for index, context in enumerate(browser.contexts):
                    for number, failed in enumerate(context.pages):
                        try:
                            failed.screenshot(path=str(OUT / f'failure-{index}-{number}.png'))
                            proof=failed.evaluate('({url:location.href,cutscene:window.quietBell?.cutscene,scene:window.quietBell?.scene,game:window.quietBell?.state})')
                            (OUT / f'failure-{index}-{number}.json').write_text(json.dumps(proof,indent=2)+'\n')
                        except Exception:
                            pass
                raise
            finally:
                browser.close()
        result['seconds'] = round(time.monotonic() - started, 1)
        name = 'public' if args.url else 'source' if args.source else 'launcher'
        (OUT / (name + '-results.json')).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2), flush=True)
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
