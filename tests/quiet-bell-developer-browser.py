"""Author a project through the in-game console, then play its actual rules.

No mutable game hooks are used. UI edits/imports create a project; walking,
conversation, gifts, locks and developer tools all use real browser inputs.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from copy import deepcopy
import importlib.util
import json
import math
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/developer-console'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
JOURNEY_KEY = 'codaQuietBellJourneyV1'
STORY = '<img src=x onerror="window.__developerPayload=1"> The warm parcel hums three and a half beats.'
REPLY_LABEL = 'Ask about the lost bell'
REPLY_TEXT = '<b>The bell remembers us.</b>'
KEY = ['quarter', 'quarter', 'eighth']
WRONG_KEY = ['half', 'quarter']


def tick(page, duration=80):
    page.wait_for_timeout(20)
    if page in ui.VIRTUAL_WALK_PAGES:
        page.clock.run_for(duration)


def console_open(page, tab=None):
    if not page.locator('#developer-console').is_visible():
        page.keyboard.press('F2')
        page.locator('#developer-console').wait_for(state='visible')
    if tab:
        page.locator('[data-dev-tab="' + tab + '"]').click()
    tick(page)


def select_room(page, room):
    page.locator('#developer-room-cards [data-dev-room="' + room + '"]').click()
    tick(page)


def select_entity(page, room, kind, identifier):
    select_room(page, room)
    before = ui.walker(page)
    attr = {'person':'person','door':'door','chest':'chest','inspect':'inspect','return':'return'}[kind]
    page.locator('#room-map [data-' + attr + '="' + identifier + '"]').click()
    tick(page)
    after = ui.walker(page)
    assert math.hypot(after['x'] - before['x'], after['y'] - before['y']) < 1, 'Selecting an object edits it without walking.'


def project_tools(page):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'): tools.locator('summary').click()


def close_tools(page):
    tools = page.locator('#developer-console details.dc-tools')
    if tools.evaluate('e=>e.open'): tools.locator('summary').click()


def export_project(page, label):
    project_tools(page)
    with page.expect_download() as pending:
        page.locator('#developer-export').click()
    download = pending.value
    assert download.suggested_filename == 'coda-quiet-bell-project.json', download.suggested_filename
    path = OUT / (label + '.json')
    download.save_as(path)
    close_tools(page)
    return json.loads(path.read_text())


def import_project(page, value, name='project.json'):
    raw = value if isinstance(value, str) else json.dumps(value)
    page.locator('#developer-file').set_input_files({'name': name, 'mimeType': 'application/json', 'buffer': raw.encode()})
    tick(page)


def json_project(page, value):
    console_open(page, 'json')
    page.locator('#developer-project-json').fill(json.dumps(value, indent=2))
    page.locator('#developer-json-apply').click()
    tick(page)


def normal_storage(page):
    return page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))',
                         [ui.SAVE_KEY, JOURNEY_KEY, *ui.PROTECTED])


def body_fits(page):
    value = page.evaluate('''()=>{
      const d=document.getElementById('developer-console'),r=d.getBoundingClientRect();
      return{width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,
        bodyWidth:document.body.scrollWidth,docHeight:document.documentElement.scrollHeight,
        bodyHeight:document.body.scrollHeight,dialog:{x:r.x,y:r.y,width:r.width,height:r.height},
        controls:[...d.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{
          const b=e.getBoundingClientRect();return{label:e.textContent,disabled:e.disabled,width:b.width,height:b.height};})};
    }''')
    assert value['docWidth'] <= value['width'] + 1 and value['bodyWidth'] <= value['width'] + 1, value
    assert value['docHeight'] <= value['height'] + 1 and value['bodyHeight'] <= value['height'] + 1, value
    rect = value['dialog']
    assert rect['x'] >= -1 and rect['y'] >= -1
    assert rect['x'] + rect['width'] <= value['width'] + 1 and rect['y'] + rect['height'] <= value['height'] + 1, value
    for control in value['controls']:
        assert control['width'] >= 43.5 and control['height'] >= 43.5, control
    return value


def changed_project(original):
    project = deepcopy(original)
    project['settings']['title'] = 'The Developer Bell'
    project['settings']['bpm'] = 144
    project['settings']['initialInventory'] = {kind: 0 for kind in ui.KINDS}
    project['settings']['initialInventory'].update(quarter=4, eighth=2, half=1)
    quarter = next(kind for kind in project['noteKinds'] if kind['id'] == 'quarter')
    quarter.update(label='Practice tap', shortName='<b>Tap</b>', units=3, color='#aaccee')
    project['doors']['garden']['recipe'] = KEY.copy()
    project['sources']['nell-parcel']['recipe'] = ['quarter', 'quarter', 'eighth']
    nell = next(person for person in project['content']['depot']['people'] if person['id'] == 'nell')
    nell.update(intro=STORY, story=STORY, route='Two practice taps, then one eighth note.', demo=KEY.copy())
    for reply in nell.get('replies', []):
        if reply['id'] == 'story': reply['text'] = STORY
        if reply['id'] == 'route': reply.update(text=nell['route'], demo=KEY.copy())
    project['rooms']['depot']['title'] = 'The Developer Depot'
    project['content']['depot']['title'] = 'The Developer Depot'
    scene = project['scenes']['depot']
    scene['title'] = 'The Developer Depot'
    scene['image'] = 'assets/workshop-porch.webp'
    scene['geometry']['speed'] = 310
    actor = next(actor for actor in scene['actors'] if actor['id'] == 'nell')
    delta = 560 - actor['feet']['x']
    actor['feet']['x'] = 560
    target = next(target for target in scene['geometry']['targets'] if target['id'] == 'nell')
    target['x'] += delta
    target['approach']['x'] += delta
    obstacle = next(obstacle for obstacle in scene['geometry']['obstacles'] if obstacle['id'] == 'nell')
    obstacle['x'] += delta
    obj = next(obj for obj in scene['objects'] if obj['id'] == 'nell')
    obj['rect']['x'] += delta
    project['player']['worldSize'] = 144
    return project


def build(page, kinds):
    for kind in kinds:
        assert page.locator(ui.tile(kind)).is_enabled(), (kind, ui.state(page))
        page.locator(ui.tile(kind)).click()
    assert ui.state(page)['units'] == 7 and ui.state(page)['beats'] == 3.5
    assert page.locator('#commit').is_enabled()
    assert '3.5' in page.locator('#total').inner_text()


def set_stock(page, stock):
    console_open(page, 'playtest')
    for kind in ui.KINDS:
        page.locator('[data-dev-inventory="' + kind + '"]').fill(str(stock[kind]))
    page.locator('#developer-set-inventory').click()
    tick(page)
    assert ui.state(page)['inventory'] == stock


def teleport(page, room):
    console_open(page, 'playtest')
    page.locator('#developer-live-room [data-dev-choice="' + room + '"]').click()
    page.locator('#developer-teleport').click()
    tick(page)
    assert ui.state(page)['roomId'] == room and ui.state(page)['phase'] == 'room'
    assert page.locator('#room-scene').get_attribute('data-room') == room


def close_editor(page):
    if page.locator('#developer-console').is_visible():
        page.locator('#developer-close').click()
        tick(page)


def desktop_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light')
    release = page.evaluate('document.baseURI')
    assert not ui.state(page).get('developerMode', False)
    # Preserve a genuine partially completed published run, not a fabricated save.
    ui.press(page, '[data-person="nell"]')
    page.locator('#take-parcel').click()
    ui.close_panels(page)
    assert ui.state(page)['inventory'] == ui.PARCEL
    # Opening while a movement key is held must drain that input, including on close.
    page.locator('#walk-floor').focus()
    page.keyboard.down('ArrowRight'); tick(page, 80)
    page.keyboard.press('F2'); page.locator('#developer-console').wait_for(state='visible')
    stopped = ui.walker(page)
    tick(page, 250); page.keyboard.up('ArrowRight')
    assert math.hypot(ui.walker(page)['x'] - stopped['x'], ui.walker(page)['y'] - stopped['y']) < 1
    page.locator('#developer-close').click(); tick(page, 250)
    assert math.hypot(ui.walker(page)['x'] - stopped['x'], ui.walker(page)['y'] - stopped['y']) < 1
    page.locator('#menu').click()
    page.locator('#developer-open').click()
    page.locator('#developer-console').wait_for(state='visible')
    published = normal_storage(page)
    published_resources = ui.resources(ui.state(page))
    frozen = ui.walker(page)
    page.keyboard.down('ArrowRight'); tick(page, 250); page.keyboard.up('ArrowRight')
    assert math.hypot(ui.walker(page)['x'] - frozen['x'], ui.walker(page)['y'] - frozen['y']) < 1
    body_fits(page)
    # Structured dialogue editing preserves literal text; undo and redo are real draft operations.
    select_entity(page, 'depot', 'person', 'nell')
    old_story = page.locator('#developer-intro').input_value()
    page.locator('#developer-intro').fill(STORY)
    page.locator('#developer-intro').press('Tab')
    project_tools(page)
    page.locator('#developer-undo').click()
    assert page.locator('#developer-intro').input_value() == old_story
    page.locator('#developer-redo').click()
    assert page.locator('#developer-intro').input_value() == STORY
    close_tools(page)
    page.locator('#developer-add-reply').click()
    assert page.locator('[data-dev-reply="reply-1"]').count() == 1
    page.locator('#developer-reply-label').fill(REPLY_LABEL)
    page.locator('#developer-reply-label').press('Tab')
    page.locator('#developer-reply-text').fill(REPLY_TEXT)
    page.locator('#developer-reply-text').press('Tab')
    page.locator('#developer-add-reply').click()
    page.locator('#developer-reply-label').fill('Discard this reply')
    page.locator('#developer-reply-label').press('Tab')
    page.locator('#developer-remove-reply').click()
    assert page.locator('[data-dev-reply="reply-2"]').count() == 0
    assert page.locator('[data-dev-reply="reply-1"]').count() == 1
    page.locator('#developer-save').click()
    select_entity(page, 'depot', 'door', 'garden')
    recipe = page.locator('#developer-door-recipe')
    recipe.get_by_role('button', name='Clear phrase', exact=True).click()
    for kind in KEY: page.locator('#developer-door-recipe [data-dev-add-note="' + kind + '"]').click()
    assert '2.5 beats' in page.locator('#developer-door-recipe').inner_text()
    page.locator('[data-dev-tab="notes"]').click()
    page.locator('#developer-source [data-dev-choice="nell-parcel"]').click()
    for kind in ui.KINDS:
        while page.locator('#developer-gift-recipe [data-dev-subtract-note="' + kind + '"]').is_enabled():
            page.locator('#developer-gift-recipe [data-dev-subtract-note="' + kind + '"]').click()
    for kind in KEY: page.locator('#developer-gift-recipe [data-dev-add-note="' + kind + '"]').click()
    page.locator('#developer-save').click()
    assert normal_storage(page) == published
    first = export_project(page, 'structured-dialogue-export')
    assert next(person for person in first['content']['depot']['people'] if person['id'] == 'nell')['intro'] == STORY
    assert len(next(person for person in first['content']['depot']['people'] if person['id'] == 'nell')['replies']) == 4
    assert first['doors']['garden']['recipe'] == KEY
    assert first['sources']['nell-parcel']['recipe'] == KEY
    # Roundtrip complete authored data, including non-four-beat keys and editable note values.
    project = changed_project(first)
    import_project(page, project, 'authored-project.json')
    saved = export_project(page, 'import-roundtrip')
    assert saved['doors']['garden']['recipe'] == KEY
    assert next(kind for kind in saved['noteKinds'] if kind['id'] == 'quarter')['units'] == 3
    page.locator('#developer-save').click()
    before_invalid = page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    invalid = deepcopy(saved)
    invalid['doors']['garden']['to'] = 'not-a-room'
    import_project(page, invalid, 'invalid-project.json')
    # Invalid authoring must never alter applied data or either gameplay save.
    assert normal_storage(page) == published
    assert ui.resources(ui.state(page)) == published_resources
    for key, value in before_invalid.items():
        if key not in [ui.SAVE_KEY, JOURNEY_KEY]:
            assert page.evaluate('(key)=>localStorage.getItem(key)', key) == value, key
    import_project(page, saved, 'restored-project.json')
    console_open(page, 'json')
    page.locator('#developer-project-json').fill('{')
    page.locator('#developer-json-apply').click()
    assert normal_storage(page) == published
    import_project(page, saved, 'restored-project.json')
    page.locator('#developer-apply').click()
    page.locator('#developer-console').wait_for(state='hidden')
    assert ui.state(page)['developerMode']
    initial = {kind: 0 for kind in ui.KINDS}
    initial.update(quarter=4, eighth=2, half=1)
    assert ui.state(page)['inventory'] == initial
    assert 'Developer Depot' in page.locator('.location').inner_text()
    assert page.locator('.mg-art').evaluate('e=>e.currentSrc').endswith('/assets/workshop-porch.webp')
    actor = page.locator('.mg-npc[data-actor="nell"]')
    assert abs(actor.evaluate('e=>parseFloat(e.style.left)') / 100 * 1536 - 560) < 1
    assert abs(page.locator('#player-sprite').bounding_box()['width'] / page.locator('#room-map').bounding_box()['width'] * 1536 - 144) < 1
    # Real NPC interaction uses edited text and source quantities.
    ui.press(page, '[data-person="nell"]')
    assert page.locator('#dialogue').inner_text() == STORY
    assert page.locator('#dialogue img').count() == 0
    assert not page.evaluate('window.__developerPayload')
    assert page.get_by_role('button', name='Discard this reply', exact=True).count() == 0
    page.get_by_role('button', name=REPLY_LABEL, exact=True).click()
    assert page.locator('#dialogue').inner_text() == REPLY_TEXT
    assert page.locator('#dialogue b').count() == 0
    chosen_reply = ui.state(page)['selectedTopic']
    page.locator('#conversation-close').click()
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert ui.state(page)['developerMode'] and ui.state(page)['selectedTopic'] == chosen_reply
    assert ui.state(page)['inventory'] == initial
    ui.press(page, '[data-person="nell"]')
    assert page.get_by_role('button', name=REPLY_LABEL, exact=True).is_visible()
    page.locator('#take-parcel').click()
    supplied = initial.copy(); supplied['quarter'] += 2; supplied['eighth'] += 1
    assert ui.state(page)['inventory'] == supplied
    assert normal_storage(page) == published
    ui.press(page, '[data-door="garden"]')
    assert ui.state(page)['targetUnits'] == 7 and ui.state(page)['targetBeats'] == 3.5
    assert page.locator(ui.tile('quarter')).locator('.mg-kind-name').inner_text() == '<b>Tap</b>'
    assert page.locator(ui.tile('quarter')).locator('b').count() == 0
    build(page, WRONG_KEY)
    before_wrong = ui.resources(ui.state(page))
    page.locator('#commit').click()
    assert ui.resources(ui.state(page)) == before_wrong
    assert page.locator('#status').inner_text().strip()
    ui.clear_phrase(page)
    build(page, KEY)
    page.locator('#door-demo').click()
    page.locator('#commit').click()
    assert ui.state(page)['roomId'] == 'garden-porch'
    expected = supplied.copy(); expected['quarter'] -= 2; expected['eighth'] -= 1
    assert ui.state(page)['inventory'] == expected
    # The console also opens from a paid continuation, and can still select its NPCs.
    ui.press(page, '[data-person="iris"]'); page.locator('#take-parcel').click()
    ui.press(page, '[data-door="garden-porch-forward"]')
    for kind in ['half-rest', 'half']: page.locator(ui.tile(kind)).click()
    assert ui.state(page)['units'] == 8 and page.locator('#commit').is_enabled()
    page.locator('#commit').click()
    assert ui.state(page)['phase'] == 'continued' and page.locator('#outcome').is_visible()
    console_open(page, 'dialogue')
    select_entity(page, 'garden-porch', 'person', 'nell')
    assert page.locator('#developer-person-name').input_value() == 'Nell'
    # A close/reopen keeps the project draft; live controls remain sandbox-only.
    console_open(page, 'playtest')
    teleport(page, 'canal-porch')
    assert ui.state(page)['inventory'] == expected
    live = {kind: 0 for kind in ui.KINDS}
    live.update(quarter=2, half=1)
    set_stock(page, live)
    page.locator('#developer-reset-sources').click(); tick(page)
    assert ui.state(page)['inventory'] == live and 'nell-parcel' not in ui.state(page)['claimedSources']
    teleport(page, 'depot'); close_editor(page)
    ui.press(page, '[data-person="nell"]')
    assert page.locator('#take-parcel').is_enabled()
    page.locator('#take-parcel').click()
    live['quarter'] += 2; live['eighth'] += 1
    assert ui.state(page)['inventory'] == live
    assert normal_storage(page) == published
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert ui.state(page)['developerMode'] and ui.state(page)['inventory'] == live
    assert ui.state(page)['roomId'] == 'depot'
    assert normal_storage(page) == published
    console_open(page, 'playtest')
    page.screenshot(path=str(OUT / 'developer-desktop.png'))
    page.locator('#developer-return').click(); tick(page)
    assert not ui.state(page)['developerMode']
    assert ui.resources(ui.state(page)) == published_resources
    assert normal_storage(page) == published
    assert page.locator('.mg-art').evaluate('e=>e.currentSrc').endswith('/assets/parcel-depot.webp')
    ui.press(page, '[data-person="nell"]')
    assert page.get_by_role('button', name=REPLY_LABEL, exact=True).count() == 0
    ui.close_panels(page)
    console_open(page, 'dialogue')
    select_entity(page, 'depot', 'person', 'nell')
    assert page.locator('#developer-intro').input_value() == STORY
    close_editor(page)
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'releaseBase': release, 'structuredDialogueUndoRedo': True, 'visualKeyAndGiftComposers': True,
            'literalAuthorText': True, 'replyAddRemoveAndReload': True, 'actualMapSelectionFrozen': True, 'wholeProjectImportExport': True, 'invalidProjectAtomic': True,
            'customThreeAndHalfBeatKey': True, 'equalBeatWrongKeyRejected': True,
            'noteValuesAndGiftQuantities': True, 'roomArtActorAndPlayerConfig': True,
            'sandboxInventoryTeleportReset': True, 'sandboxReload': True, 'consoleFromPaidBoundary': True,
            'publishedRunBytePreserved': True, 'sharedStoragePreserved': True, 'errors': []}


def mobile_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 320, 'dark', height=568)
    page.locator('#menu').tap(); page.locator('#developer-open').tap()
    page.locator('#developer-console').wait_for(state='visible')
    frames = []
    for tab in ['dialogue', 'puzzles', 'notes', 'rooms', 'playtest', 'json']:
        page.locator('[data-dev-tab="' + tab + '"]').click()
        tick(page); body_fits(page)
        page.screenshot(path=str(OUT / ('developer-mobile-' + tab + '.png')))
        frames.append(tab)
    page.locator('[data-dev-tab="dialogue"]').click()
    select_entity(page, 'depot', 'person', 'nell')
    text = page.locator('#developer-intro').input_value()
    compact_height = page.locator('#developer-body').bounding_box()['height']
    page.locator('#developer-expand').click(); tick(page)
    body_fits(page)
    expanded = page.locator('#developer-console').bounding_box()
    assert expanded['height'] >= 568 * .9
    assert page.locator('#developer-body').bounding_box()['height'] > compact_height + 100
    assert 'Show map' in page.locator('#developer-expand').inner_text()
    page.screenshot(path=str(OUT / 'developer-mobile-expanded.png'))
    frozen = ui.walker(page)
    page.locator('#developer-intro').fill(text + ' WASD and E stay in this editor.')
    page.locator('#developer-intro').press('ArrowLeft'); tick(page, 250)
    assert math.hypot(ui.walker(page)['x'] - frozen['x'], ui.walker(page)['y'] - frozen['y']) < 1
    page.locator('#developer-expand').click(); tick(page)
    assert page.locator('#developer-console').bounding_box()['height'] < 568 * .65
    close_editor(page); tick(page, 250)
    assert math.hypot(ui.walker(page)['x'] - frozen['x'], ui.walker(page)['y'] - frozen['y']) < 1
    page.keyboard.press('F2'); page.locator('#developer-console').wait_for(state='visible')
    assert page.locator('#developer-intro').input_value().endswith(' WASD and E stay in this editor.')
    close_editor(page)
    assert not ui.state(page)['developerMode'] and ui.state(page)['inventory'] == ui.EMPTY
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'width': 320, 'height': 568, 'tabs': frames,
            'noDocumentOverflow': True, 'touchControls': True, 'mobileExpandAndShowMap': True, 'editorKeysDoNotWalk': True,
            'draftSurvivesClose': True, 'errors': []}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with ui.sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if '--source' in sys.argv else '')
            result = {'desktop': desktop_flow(browser, url), 'mobile': mobile_flow(browser, url)}
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2))
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
