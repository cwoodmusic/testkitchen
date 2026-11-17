"""Real walking, gifts, chest, rhythm-lock and inventory-carry UI checks.

Only browser storage is seeded. Gameplay state is observed, never edited.
Repeated approaches advance real RAF callbacks; movement controls also run in native time.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import math
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/page-one-viewport'
OUT.mkdir(parents=True, exist_ok=True)
SAVE_KEY = 'codaQuietBellPageOneV1'
PROTECTED = {'musicArcadeV1': '{"test":"preserve arcade"}', 'codaNotesWalletV1': '{"notes":23}',
             'codaRhythmBlocksBestV1': '3210', 'codaRhythmBlocksShapesBestV1': '4400',
             'codaRhythmBlocksFourBestV1': '6500'}
KINDS = ['quarter', 'eighth-pair', 'sixteenth-group', 'half', 'eighth', 'quarter-rest',
         'half-rest', 'dotted-half', 'sixteenth-pair']
INITIAL = {kind: 1 for kind in KINDS}
EMPTY = {kind: 0 for kind in KINDS}
PARCEL = {kind: int(kind != 'half') for kind in KINDS}
ROUTES = [
    {'id': 'garden', 'name': 'Garden door accepts its exact quiet answer',
     'recipe': ['half', 'half-rest'], 'person': 'pip'},
    {'id': 'workshop', 'name': 'Two grouped tiles reach the workshop',
     'recipe': ['half', 'eighth-pair', 'sixteenth-group'], 'person': 'iris'},
    {'id': 'canal', 'name': 'An ordinary sounding phrase reaches the canal',
     'recipe': ['half', 'quarter', 'eighth-pair'], 'person': 'nell'},
]
VIRTUAL_WALK_PAGES = set()

def _skip_story_intro(page):
    """Use the opening's own Skip control; leave its following doorway intact."""
    skip = page.locator('#story-intro-skip')
    if skip.count() and skip.is_visible():
        skip.click()

def skip_intro(page):
    _skip_story_intro(page)

def skip_cutscene(page):
    """Use the visible Skip control when a regression is testing exploration."""
    _skip_story_intro(page)
    skip = page.locator('#cutscene-skip')
    if skip.count() and skip.is_visible():
        skip.click()

def finish_inspection_discussion(page):
    """Exploration regressions can continue to the ordinary observation panel."""
    if page.evaluate('window.quietBell?.cutscene?.context==="inspection"'):
        skip_cutscene(page)

def acknowledge_room_narration(page):
    """Physical-performance regressions explicitly finish the reading preface."""
    for _ in range(2):
        if not page.evaluate('window.quietBell?.cutscene?.phase==="narration"'):break
        page.locator('#cutscene-next').click()
    assert not page.evaluate('window.quietBell?.cutscene?.phase==="narration"')

def close_panels(page, revisit=False):
    skip_cutscene(page)
    if page.locator('#outcome').is_visible():
        assert revisit, 'The ending must be revisited before walking again.'
        page.locator('#revisit').click()
        skip_cutscene(page)
    for dialog, close in [('#conversation-dialog', '#conversation-close'),
                          ('#notes-dialog', '#notes-close'), ('#help-dialog', '#help-close'),
                          ('#menu-dialog', '#menu-close'), ('#lore-dialog', '#lore-close')]:
        if page.locator(dialog).is_visible(): page.locator(close).click()

def key_walk(page, axis, goal):
    """Steer through open floor with input events rather than teleporting the walker."""
    current = walker(page)[axis]
    if abs(goal - current) < 5: return
    key = ('ArrowRight' if goal > current else 'ArrowLeft') if axis == 'x' else ('ArrowDown' if goal > current else 'ArrowUp')
    duration = math.ceil(abs(goal - current) / 260 * 1000)
    page.locator('#walk-floor').focus()
    page.keyboard.down(key)
    if page in VIRTUAL_WALK_PAGES: page.clock.run_for(duration)
    else: page.wait_for_timeout(duration)
    page.keyboard.up(key)
    if page in VIRTUAL_WALK_PAGES: page.clock.run_for(80)
    settle_walk(page)

def clear_aisle(page):
    position = walker(page)
    if position['y'] < 600:
        if position['x'] < 380 and position['y'] >= 482:
            key_walk(page, 'y', 750)
        else:
            key_walk(page, 'y', 450)
            key_walk(page, 'x', 900)
            key_walk(page, 'y', 750)
    else: key_walk(page, 'y', 750)

def target_on_screen(button):
    return button.evaluate('''e=>{const r=e.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2;
      return x>=12&&x<=innerWidth-12&&y>=12&&y<=innerHeight-12&&document.elementFromPoint(x,y)?.closest('button')===e;}''')

def prepare_target(page, button):
    close_panels(page)
    if target_on_screen(button): return
    world_x = button.evaluate('''e=>{const r=e.getBoundingClientRect(),map=document.getElementById('room-map').getBoundingClientRect();return((r.left+r.right)/2-map.left)/map.width*1536;}''')
    clear_aisle(page)
    key_walk(page, 'x', max(100, min(1430, world_x)))
    if not target_on_screen(button):
        key_walk(page, 'x', 900)
        key_walk(page, 'y', 450)
    assert target_on_screen(button), button.evaluate('e=>({name:e.ariaLabel,rect:e.getBoundingClientRect().toJSON()})')

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def do_GET(self):
        if self.path == '/favicon.ico':
            self.send_response(204); self.end_headers(); return
        super().do_GET()
    def copyfile(self, source, target):
        try: super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError): pass

def state(page): return page.evaluate('window.quietBell.state')
def resources(value):
    return {key: value.get(key) for key in ['roomId', 'phase', 'inventory', 'availableInventory', 'phrase',
            'beats', 'canAttempt', 'canCommit', 'routeId', 'nextScene', 'receipt', 'creditedStages',
            'discoveredRoutes', 'selectedDoor', 'claimedSources', 'currentRoomClaimedSources',
            'sourceReceipts', 'actions', 'traversedDoors', 'claimedGifts', 'openedChests']}
def settle_walk(page):
    """Advance real animation-frame callbacks, never the game's state."""
    if page in VIRTUAL_WALK_PAGES:
        for _ in range(2):
            if page.evaluate('!quietBell.walker?.moving&&!quietBell.walker?.pendingTarget&&!quietBell.walker?.destination'): break
            page.clock.run_for(8000)
    page.wait_for_function('!quietBell.walker?.moving&&!quietBell.walker?.pendingTarget&&!quietBell.walker?.destination')

def press(page, selector, touch=False):
    button = page.locator(selector)
    target = button.evaluate('e=>({person:e.dataset.person,door:e.dataset.door,chest:e.dataset.chest,inspect:e.dataset.inspect,returnTo:e.dataset.return})')
    if any(target.values()):
        prepare_target(page, button)
        position = button.evaluate('e=>{const r=e.getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}')
        if touch: page.touchscreen.tap(position['x'], position['y'])
        else: page.mouse.click(position['x'], position['y'])
    else: getattr(button, 'tap' if touch else 'click')()
    if any(target.values()):
        settle_walk(page)
        if target.get('inspect'): finish_inspection_discussion(page)
        if target.get('person'): assert state(page)['selectedPerson'] == target['person']
        if target.get('door'): assert state(page)['selectedDoor'] == target['door']
        if target.get('chest'): assert target['chest'] in state(page)['claimedSources']
        if target.get('inspect'): assert page.locator('#lore-dialog').get_attribute('data-observation') == target['inspect']
        if target.get('returnTo'): assert state(page)['roomId'] == 'depot'
def tile(kind): return 'button[data-kind="' + kind + '"]:not([data-remove])'
def clear_phrase(page, touch=False):
    while state(page)['phrase']: press(page, 'button[data-remove="0"]', touch)
def build(page, recipe, touch=False):
    for kind in recipe:
        assert page.locator(tile(kind)).is_enabled(), (kind, state(page))
        press(page, tile(kind), touch)
    assert state(page)['beats'] == 4 and page.locator('#commit').is_enabled()
def visible_stock(page, expected):
    for kind, count in expected.items():
        button = page.locator(tile(kind))
        assert f'{count} available' in button.get_attribute('aria-label'), (kind, count, button.get_attribute('aria-label'))
        assert button.locator('.mg-count').inner_text() == f'×{count}'
def protected_storage(page):
    actual = page.evaluate('(keys)=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(PROTECTED))
    assert actual == PROTECTED, actual

def unavailable(page, selector):
    return not page.locator(selector).count() or page.locator(selector).is_hidden() or page.locator(selector).is_disabled()

def sources_claimed(page, touch=False, inspect_nell=True):
    assert set(state(page)['claimedSources']) == {'nell-parcel', 'depot-chest'}
    if inspect_nell:
        press(page, 'button[data-person="nell"]', touch)
        press(page, 'button[data-topic="story"]', touch)
    selectors = ['#take-parcel', 'button[data-chest="depot-chest"]'] if inspect_nell else ['button[data-chest="depot-chest"]']
    for selector in selectors:
        before = resources(state(page))
        if not unavailable(page, selector): press(page, selector, touch)
        assert resources(state(page)) == before, 'Claimed gifts and chests cannot award more notes.'

def collect_sources(page, touch=False):
    assert state(page)['phase'] == 'room' and state(page)['inventory'] == EMPTY
    visible_stock(page, EMPTY)
    assert page.locator('#commit').is_disabled()
    press(page, 'button[data-person="nell"]', touch)
    press(page, 'button[data-topic="story"]', touch)
    assert state(page)['inventory'] == EMPTY, 'Talking alone does not claim a gift.'
    press(page, '#take-parcel', touch)
    assert state(page)['inventory'] == PARCEL and state(page)['availableInventory'] == PARCEL
    visible_stock(page, PARCEL)
    assert page.locator(tile('half')).is_disabled(), 'The missing half note belongs to the chest.'
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert state(page)['inventory'] == PARCEL
    if not unavailable(page, '#take-parcel'):
        press(page, '#take-parcel', touch)
        assert state(page)['inventory'] == PARCEL
    press(page, 'button[data-chest="depot-chest"]', touch)
    assert state(page)['inventory'] == INITIAL and state(page)['availableInventory'] == INITIAL
    visible_stock(page, INITIAL)
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert state(page)['inventory'] == INITIAL
    sources_claimed(page, touch)
    assert state(page).get('creditedStages', []) == []

def layout(page, touch=False):
    value = page.evaluate('''()=>{
      const rect=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
      return{width:innerWidth,height:innerHeight,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,
        docHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,scene:rect(document.getElementById('room-scene')),
        hud:[...document.querySelectorAll('#bag,#menu,#room-controls button')].filter(e=>e.getClientRects().length).map(rect),
        icons:[...document.querySelectorAll('#bag,#menu')].map(rect),
        dialogs:[...document.querySelectorAll('dialog[open]')].map(rect),
        images:[...document.images].map(i=>({complete:i.complete,width:i.naturalWidth}))};
    }''')
    assert value['doc'] <= value['width'] + 1 and value['body'] <= value['width'] + 1, value
    assert value['docHeight'] <= value['height'] + 1 and value['bodyHeight'] <= value['height'] + 1, value
    scene = value['scene']
    assert abs(scene['left']) < 1 and abs(scene['top']) < 1 and abs(scene['width'] - value['width']) < 1 and abs(scene['height'] - value['height']) < 1, scene
    assert all(image['complete'] and image['width'] > 0 for image in value['images']), value
    assert len(value['icons']) == 2
    for icon in value['icons']: assert abs(icon['width'] - icon['height']) < 1, icon
    for dialog in value['dialogs']:
        assert dialog['left'] >= -1 and dialog['right'] <= value['width'] + 1 and dialog['top'] >= -1 and dialog['bottom'] <= value['height'] + 1, dialog
    for group in [value['hud']]:
        for index, first in enumerate(group):
            assert first['left'] >= -1 and first['right'] <= value['width'] + 1, first
            if touch: assert first['width'] >= 43.5 and first['height'] >= 43.5, first
            for second in group[index + 1:]:
                overlap = max(0, min(first['right'], second['right']) - max(first['left'], second['left'])) * max(0, min(first['bottom'], second['bottom']) - max(first['top'], second['top']))
                assert overlap < 1, (first, second, overlap)
    return value

def open_page(browser, url, width, theme, virtual_walk=True, height=None,
              skip_cutscenes=True, reduced_motion='no-preference', skip_intro=True):
    touch = width < 500
    context = browser.new_context(viewport={'width': width, 'height': height or {1024:768,390:844,320:568}[width]}, has_touch=touch,
                                  is_mobile=touch, color_scheme=theme, reduced_motion=reduced_motion)
    context.add_init_script('''for(const[key,value]of Object.entries(''' + json.dumps(PROTECTED) + '''))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);''')
    context.add_init_script('''window.__pageOneSaveWrites=[];const pageOneSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===''' + json.dumps(SAVE_KEY) + ''')window.__pageOneSaveWrites.push({time:performance.now(),bytes:String(value).length});return pageOneSetItem.call(this,key,value);};''')
    page = context.new_page(); page.set_default_timeout(15000)
    if virtual_walk:
        page.clock.install()
        VIRTUAL_WALK_PAGES.add(page)
    errors, writes, external = [], [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda message: errors.append(message.text) if message.type == 'error' else None)
    page.on('request', lambda request: writes.append(request.url) if request.method not in ['GET', 'HEAD'] else None)
    def route_request(route):
        if route.request.url.startswith(url.split('/games/')[0]) or route.request.url.startswith('data:'):
            return route.continue_()
        external.append(route.request.url); route.abort()
    context.route('**/*', route_request)
    page.goto(url); page.wait_for_function('!!window.quietBell?.state')
    page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
    if skip_intro:
        _skip_story_intro(page)
    if skip_cutscenes:
        skip_cutscene(page)
    return context, page, errors, writes, external

def conversations(page, touch=False):
    baseline = resources(state(page)); dialogue = []
    assert state(page)['inventory'] == EMPTY
    for person in ['nell', 'iris', 'pip']:
        press(page, 'button[data-person="' + person + '"]', touch); messages = set()
        assert page.locator('#conversation-dialog').is_visible()
        for topic in ['story', 'route', 'inventory']:
            press(page, 'button[data-topic="' + topic + '"]', touch)
            text = page.locator('#dialogue').inner_text(); speaker = page.locator('#speaker').inner_text()
            assert text.strip() and person in speaker.lower(), (person, topic, speaker, text)
            messages.add(text)
            assert resources(state(page)) == baseline, 'Talking must not spend notes, award promises or choose a route.'
            dialogue.append({'person': person, 'topic': topic, 'text': text})
        assert len(messages) == 3, (person, messages)
        press(page, 'button[data-topic="route"]', touch)
        assert page.locator('#demo').is_visible(); press(page, '#demo', touch)
        assert resources(state(page)) == baseline, 'Hearing an example must not commit an answer.'
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert page.locator('#conversation-dialog').is_hidden(), 'Conversation is only shown when interacting.'
    assert page.locator('button[data-person="pip"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('button[data-topic="route"]').get_attribute('aria-pressed') == 'true'
    assert resources(state(page)) == baseline
    return dialogue

def draft_controls(page, touch=False):
    assert state(page)['inventory'] == INITIAL
    assert page.locator('button[data-kind]:not([data-remove])').count() == 9
    assert page.locator('button[data-kind]:not([data-remove]) svg').count() == 9
    press(page, 'button[data-door="garden"]', touch)
    assert state(page)['selectedDoor'] == 'garden'
    assert page.locator('#notes-dialog').is_visible() and page.locator('#notes-dialog').get_attribute('data-mode') == 'lock'
    visible_stock(page, INITIAL)
    assert page.locator('#commit').is_disabled()
    press(page, tile('dotted-half'), touch)
    assert state(page)['beats'] == 3 and page.locator('#commit').is_disabled()
    assert page.locator(tile('half')).is_disabled(), 'Two beats cannot overfill the last beat.'
    assert page.locator(tile('dotted-half')).is_disabled(), 'One original tile cannot be used twice.'
    press(page, tile('eighth'), touch)
    assert state(page)['beats'] == 3.5 and page.locator('#commit').is_disabled()
    press(page, tile('sixteenth-pair'), touch)
    assert state(page)['beats'] == 4 and page.locator('#commit').is_enabled()
    before = resources(state(page)); page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert resources(state(page)) == before, 'Reload must preserve the draft without spending it.'
    assert page.locator('#notes-dialog').is_hidden()
    press(page, 'button[data-door="garden"]', touch)
    clear_phrase(page, touch)
    assert state(page)['inventory'] == INITIAL and state(page)['availableInventory'] == INITIAL
    assert state(page)['phrase'] == [] and state(page).get('creditedStages', []) == []
    page.locator(tile('half')).focus(); page.keyboard.press('Space')
    assert state(page)['phrase'] == ['half']
    press(page, '#undo', touch)
    assert state(page)['phrase'] == [] and state(page)['inventory'] == INITIAL
    # After re-rendering a used tile, keyboard focus advances within the satchel.
    page.locator(tile('quarter')).focus(); page.keyboard.press('Enter')
    assert state(page)['phrase'] == ['quarter']
    assert page.evaluate('document.activeElement?.dataset.kind') == 'eighth-pair'
    page.keyboard.press('Space')
    assert state(page)['phrase'] == ['quarter', 'eighth-pair']
    assert page.evaluate('!!document.activeElement?.matches("button[data-kind]")')
    clear_phrase(page, touch)
    assert state(page)['availableInventory'] == INITIAL

def rejected_order(page, touch=False):
    press(page, 'button[data-door="garden"]', touch)
    build(page, ['half-rest', 'half'], touch)
    assert state(page)['canAttempt'] and not state(page)['canCommit']
    before = resources(state(page))
    press(page, '#commit', touch)
    assert resources(state(page)) == before, 'A wrong ordered answer must leave stock and draft unchanged.'
    assert state(page)['phase'] == 'room' and page.locator('#status').inner_text().strip()
    assert page.locator('#outcome').is_hidden()
    clear_phrase(page, touch)
    assert state(page)['inventory'] == INITIAL

def revisit_room(page, touch=False):
    """Return across a paid room entry through the public pause control."""
    close_panels(page, revisit=True)
    assert state(page)['phase'] == 'room' and state(page)['roomId'] != 'depot'
    press(page, '#menu', touch)
    press(page, '#revisit-room', touch)
    close_panels(page)
    assert state(page)['phase'] == 'room' and state(page)['roomId'] == 'depot'


def route_choices(page, width, theme, touch=False):
    checked = []
    for fixture in ROUTES:
        assert state(page)['phase'] == 'room' and state(page)['roomId'] == 'depot'
        press(page, 'button[data-door="' + fixture['id'] + '"]', touch)
        assert state(page)['selectedDoor'] == fixture['id']
        press(page, 'button[data-person="' + fixture['person'] + '"]', touch)
        press(page, 'button[data-topic="route"]', touch)
        assert state(page)['selectedDoor'] == fixture['id'], 'NPC hints must not replace the selected physical door.'
        press(page, 'button[data-door="' + fixture['id'] + '"]', touch)
        build(page, fixture['recipe'], touch); press(page, '#commit', touch)
        page.wait_for_function('(room)=>window.quietBell.state.roomId===room', arg=fixture['id'] + '-porch')
        actual = state(page)
        assert actual['phase'] == 'room' and actual['routeId'] == fixture['id'], (fixture, actual)
        assert actual.get('creditedStages', []) == [] and actual['selectedDoor'] is None
        expected = INITIAL.copy()
        for kind in fixture['recipe']: expected[kind] -= 1
        assert actual['inventory'] == expected and actual['availableInventory'] == expected
        visible_stock(page, expected)
        assert fixture['id'] in actual['discoveredRoutes']
        assert page.locator('#outcome').is_hidden() and page.locator('#commit').is_disabled()
        assert page.locator('button[data-door="' + fixture['id'] + '"]').count() == 0, 'Prior-room targets must be removed.'
        committed = resources(actual); page.reload(); page.wait_for_function('!!window.quietBell?.state')
        assert resources(state(page)) == committed, 'Reload must preserve the actual room without issuing notes.'
        protected_storage(page); assert page.locator('#outcome').is_hidden()
        page.screenshot(path=str(OUT / f'{width}-{theme}-{fixture["id"]}.png'), full_page=True)
        revisit_room(page, touch); undone = state(page)
        assert undone['inventory'] == INITIAL and undone['availableInventory'] == INITIAL
        assert undone.get('creditedStages', []) == [] and undone['phrase'] == []
        assert fixture['id'] in undone['discoveredRoutes']
        sources_claimed(page, touch, inspect_nell=False)
        press(page, 'button[data-door="' + fixture['id'] + '"]', touch)
        build(page, fixture['recipe'], touch); press(page, '#commit', touch)
        assert state(page)['roomId'] == fixture['id'] + '-porch'
        assert state(page)['inventory'] == expected and state(page).get('creditedStages', []) == []
        revisit_room(page, touch)
        if fixture['id'] == 'canal': restart_run(page, touch)
        assert state(page)['phase'] == 'room' and state(page)['roomId'] == 'depot'
        assert state(page)['inventory'] == (EMPTY if fixture['id'] == 'canal' else INITIAL)
        assert fixture['id'] in state(page)['discoveredRoutes']
        checked.append({'id': fixture['id'], 'stockAfterDoorCost': expected,
                        'playablePorch': True, 'noAutomaticArrivalGrant': True, 'reloadAndRevisitExact': True})
    assert set(state(page)['discoveredRoutes']) == {'garden', 'workshop', 'canal'}
    return checked

def keyboard_commit(page):
    """A fully composed phrase keeps its primary action reachable without a mouse."""
    assert state(page)['phase'] == 'room' and state(page)['phrase'] == []
    collect_sources(page)
    prepare_target(page, page.locator('button[data-door="canal"]'))
    page.locator('button[data-door="canal"]').focus(); page.keyboard.press('Enter')
    settle_walk(page)
    assert state(page)['selectedDoor'] == 'canal'
    page.locator(tile('half')).focus(); page.keyboard.press('Enter')
    assert state(page)['phrase'] == ['half']
    page.locator(tile('quarter')).focus(); page.keyboard.press('Enter')
    assert state(page)['phrase'] == ['half', 'quarter']
    assert page.evaluate('document.activeElement?.dataset.kind') == 'eighth-pair'
    page.keyboard.press('Space')
    assert state(page)['phrase'] == ['half', 'quarter', 'eighth-pair']
    assert state(page)['beats'] == 4
    assert page.evaluate('document.activeElement?.id') == 'commit'
    page.keyboard.press('Space')
    assert state(page)['phase'] == 'room' and state(page)['roomId'] == 'canal-porch'
    assert state(page)['routeId'] == 'canal' and page.locator('#outcome').is_hidden()
    assert page.evaluate('document.activeElement?.id') == 'walk-floor'

def help_and_sound(page, touch=False):
    close_panels(page, revisit=True)
    press(page, '#menu', touch)
    press(page, '#help', touch)
    assert page.locator('#help-dialog').is_visible()
    assert 'four' in page.locator('#help-dialog').inner_text().lower() or '4' in page.locator('#help-dialog').inner_text()
    page.keyboard.press('Escape'); assert page.locator('#help-dialog').is_hidden()
    if page.locator('#menu-dialog').is_hidden(): press(page, '#menu', touch)
    before = page.locator('#sound').get_attribute('aria-pressed'); press(page, '#sound', touch)
    assert page.locator('#sound').get_attribute('aria-pressed') != before
    after = page.locator('#sound').get_attribute('aria-pressed')
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert page.locator('#sound').get_attribute('aria-pressed') == after

def restart_run(page, touch=False):
    close_panels(page, revisit=True)
    press(page, '#menu', touch)
    press(page, '#restart', touch)
    close_panels(page)

def bag_checks(page, touch=False):
    close_panels(page)
    before = resources(state(page))
    press(page, '#bag', touch)
    assert page.locator('#notes-dialog').is_visible() and page.locator('#notes-dialog').get_attribute('data-mode') == 'bag'
    assert page.locator('#phrase').is_hidden(), 'The satchel is a read-only inventory view.'
    for kind in KINDS: assert page.locator(tile(kind)).is_disabled()
    visible_stock(page, state(page)['availableInventory'])
    layout(page, touch)
    page.keyboard.press('Escape')
    assert page.locator('#notes-dialog').is_hidden() and resources(state(page)) == before

def corrupt_save(page):
    restart_run(page)
    collect_sources(page)
    saved = json.loads(page.evaluate('(key)=>localStorage.getItem(key)', SAVE_KEY))
    saved['inventory'] = {kind: 999999 for kind in KINDS}
    page.evaluate('([key,value])=>localStorage.setItem(key,value)', [SAVE_KEY, json.dumps(saved)])
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert state(page)['inventory'] == INITIAL, 'Claimed actions, not forged balances, determine the inventory.'
    sources_claimed(page)
    for payload in ['{', json.dumps({'version': 999, 'inventory': {'half': 999999}}),
                    json.dumps({'version': 1, 'answer': ['half', 'quarter', 'eighth-pair'], 'inventory': INITIAL})]:
        page.evaluate('([key,value])=>localStorage.setItem(key,value)', [SAVE_KEY, payload])
        page.reload(); page.wait_for_function('!!window.quietBell?.state')
        assert state(page)['phase'] == 'room' and state(page)['inventory'] == EMPTY
        assert state(page).get('creditedStages', []) == []
    protected_storage(page)

def walker(page): return page.evaluate('window.quietBell.walker')

def floor_walk(page, x, y, touch=False):
    close_panels(page)
    def screen_position():
        return page.locator('#room-map').evaluate('''(e,point)=>{const r=e.getBoundingClientRect();return{x:r.left+point.x/1536*r.width,y:r.top+point.y/1024*r.height};}''', {'x': x, 'y': y})
    position = screen_position()
    viewport = page.viewport_size
    if not (12 <= position['x'] <= viewport['width'] - 12 and 12 <= position['y'] <= viewport['height'] - 12):
        clear_aisle(page); key_walk(page, 'x', max(100, min(1430, x)))
        position = screen_position()
    assert 0 <= position['x'] <= viewport['width'] and 0 <= position['y'] <= viewport['height'], position
    assert page.evaluate('p=>document.elementFromPoint(p.x,p.y)?.id==="walk-floor"', position), position
    if touch: page.touchscreen.tap(position['x'], position['y'])
    else: page.mouse.click(position['x'], position['y'])
    settle_walk(page)

def assert_stopped(page, before, duration=250):
    page.wait_for_timeout(duration)
    after = walker(page)
    assert not after['moving'] and not after.get('pendingTarget'), after
    assert math.hypot(after['x'] - before['x'], after['y'] - before['y']) < 1, (before, after)

def movement_checks(browser, url):
    """Native-time walking, collision, range, persistence and lifecycle checks."""
    context, page, errors, writes, external = open_page(browser, url, 1024, 'light', virtual_walk=False)
    assert page.locator('#player-sprite').is_visible()
    initial = walker(page); baseline = resources(state(page))
    assert state(page)['inventory'] == EMPTY and unavailable(page, '#take-parcel')
    save_count = page.evaluate('window.__pageOneSaveWrites.length')
    sprite_before = page.locator('#player-sprite').bounding_box()
    map_before = page.locator('#room-map').bounding_box()
    page.locator('#walk-floor').focus()
    page.keyboard.down('ArrowRight'); page.wait_for_timeout(350)
    walking = walker(page)
    assert walking['moving'] and walking['facing'] == 'right' and walking['x'] > initial['x'] + 30, (initial, walking)
    sprite_after = page.locator('#player-sprite').bounding_box()
    map_after = page.locator('#room-map').bounding_box()
    assert abs(sprite_after['x'] - sprite_before['x']) > 3 or abs(map_after['x'] - map_before['x']) > 3, (sprite_before, sprite_after, map_before, map_after)
    page.keyboard.up('ArrowRight'); settle_walk(page)
    assert resources(state(page)) == baseline, 'Walking cannot award or spend notes.'
    assert page.evaluate('window.__pageOneSaveWrites.length') - save_count <= 3, 'Position must not be written every animation frame.'
    # Walk north into the post counter. The feet must remain in front of it.
    clear_aisle(page); key_walk(page, 'x', 200)
    page.keyboard.down('w'); page.wait_for_timeout(2200); page.keyboard.up('w'); settle_walk(page)
    at_counter = walker(page)
    counter_front = page.evaluate('''async()=>{
      const {DEPOT_ROOM}=await import(new URL('room.mjs',document.baseURI).href);
      const counter=DEPOT_ROOM.obstacles.find(item=>item.id==='counter');
      return counter.y+counter.height+DEPOT_ROOM.radius;
    }''')
    assert counter_front <= at_counter['y'] < counter_front + 8, at_counter
    persisted = json.loads(page.evaluate('(key)=>localStorage.getItem(key)', SAVE_KEY))['roomPosition']
    assert math.hypot(persisted['x'] - at_counter['x'], persisted['y'] - at_counter['y']) < 1, (persisted, at_counter)
    page.reload(); page.wait_for_function('!!window.quietBell?.walker')
    assert math.hypot(walker(page)['x'] - at_counter['x'], walker(page)['y'] - at_counter['y']) < 1
    assert state(page)['inventory'] == EMPTY
    # Nell now travels on the floor rather than standing behind the counter.
    press(page, 'button[data-person="nell"]')
    assert state(page)['inventory'] == EMPTY
    press(page, '#conversation-close')
    page.locator('#walk-floor').focus(); page.keyboard.press('e')
    assert page.locator('#conversation-dialog').is_visible()
    assert page.locator('#take-parcel').is_enabled()
    assert state(page)['selectedPerson'] == 'nell' and state(page)['selectedTopic'] == 'story'
    assert state(page)['inventory'] == EMPTY, 'A nearby interaction still requires accepting the gift.'
    paused_conversation = walker(page)
    page.keyboard.down('ArrowRight'); page.wait_for_timeout(120); page.keyboard.up('ArrowRight')
    assert_stopped(page, paused_conversation)
    press(page, '#conversation-close')
    # An instruction dialog cancels an in-flight approach, including its callback.
    previous_person = state(page)['selectedPerson']
    prepare_target(page, page.locator('button[data-person="pip"]'))
    page.locator('button[data-person="pip"]').click(); page.wait_for_timeout(120)
    assert walker(page)['moving']
    press(page, '#menu'); paused = walker(page)
    assert_stopped(page, paused)
    press(page, '#help'); layout(page)
    page.keyboard.press('Escape'); close_panels(page)
    assert state(page)['selectedPerson'] == previous_person
    # A blur must release held movement keys and discard a pending destination.
    page.locator('#walk-floor').focus(); page.keyboard.down('ArrowRight'); page.wait_for_timeout(100)
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    blurred = walker(page); page.keyboard.up('ArrowRight'); assert_stopped(page, blurred)
    assert resources(state(page)) == baseline
    # Tapping open floor navigates around the room's collision shapes.
    save_count = page.evaluate('window.__pageOneSaveWrites.length')
    floor_walk(page, 1000, 850)
    stopped = walker(page)
    assert math.hypot(stopped['x'] - 1000, stopped['y'] - 850) < 20, stopped
    assert page.evaluate('window.__pageOneSaveWrites.length') - save_count <= 3
    page.reload(); page.wait_for_function('!!window.quietBell?.walker')
    restored = walker(page)
    assert math.hypot(restored['x'] - stopped['x'], restored['y'] - stopped['y']) < 1, (stopped, restored)
    assert resources(state(page)) == baseline
    # A click beyond the inner wall is projected onto the valid foot boundary.
    floor_walk(page, 35, 600)
    projected = walker(page)
    assert 65.9 <= projected['x'] <= 68 and abs(projected['y'] - 600) < 2, projected
    assert state(page)['inventory'] == EMPTY
    page.screenshot(path=str(OUT / 'walking-counter.png'), full_page=True)
    # Invalid saved coordinates cannot put the sprite outside the room or in furniture.
    saved = json.loads(page.evaluate('(key)=>localStorage.getItem(key)', SAVE_KEY))
    position_keys = [key for key, value in saved.items() if isinstance(value, dict) and 'x' in value and 'y' in value]
    assert len(position_keys) == 1, saved
    saved[position_keys[0]] = {'x': 999999, 'y': -999999, 'facing': 'diagonal'}
    page.evaluate('([key,value])=>localStorage.setItem(key,value)', [SAVE_KEY, json.dumps(saved)])
    page.reload(); page.wait_for_function('!!window.quietBell?.walker')
    recovered = walker(page)
    assert math.isfinite(recovered['x']) and math.isfinite(recovered['y'])
    assert page.evaluate('''async(point)=>{const {DEPOT_ROOM,isWalkable}=await import(new URL('room.mjs',document.baseURI));return isWalkable(DEPOT_ROOM,point);}''', recovered), recovered
    assert recovered['facing'] in ['up', 'down', 'left', 'right']
    assert state(page)['inventory'] == EMPTY
    page.locator('#walk-floor').focus(); page.keyboard.down('ArrowRight'); page.wait_for_timeout(100)
    page.evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide"))')
    hidden = walker(page); page.keyboard.up('ArrowRight'); assert_stopped(page, hidden)
    protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'nativeKeyboard': True, 'spriteActuallyMoves': True,
            'counterCollision': True, 'giftRequiresApproach': True, 'nearbyKeyboardInteraction': True,
            'helpBlurPagehideStop': True, 'tapNavigation': True, 'savedPositionRestores': True,
            'invalidPositionRecovers': True, 'noFrameRateStorageWrites': True, 'errors': []}

def viewport_checks(browser, url):
    checks = []
    for theme in ['light', 'dark']:
        context, page, errors, writes, external = open_page(browser, url, 320, theme, virtual_walk=False)
        for width, height in [(320,568),(320,900),(390,568),(390,844),(1024,480),(1024,768),(1366,768)]:
            page.set_viewport_size({'width': width, 'height': height}); page.wait_for_timeout(60)
            close_panels(page); dimensions = layout(page, touch=True)
            if width == 320 and height == 568 and theme == 'light':
                before = page.locator('#room-map').bounding_box()
                camera_before = page.evaluate('quietBell.camera')
                page.locator('button[data-person="pip"]').focus()
                after = page.locator('#room-map').bounding_box()
                assert abs(after['x'] - before['x']) < 1 and abs(after['y'] - before['y']) < 1
                assert page.evaluate('quietBell.camera') == camera_before
                assert page.locator('#room-scene').evaluate('e=>e.scrollLeft===0&&e.scrollTop===0')
                page.locator('#walk-floor').focus()
            assert all(page.locator(dialog).is_hidden() for dialog in ['#conversation-dialog','#notes-dialog','#menu-dialog'])
            page.screenshot(path=str(OUT / f'viewport-{width}-{height}-{theme}.png'))
            bag_checks(page, touch=True)
            press(page, '#menu', True); layout(page, touch=True)
            press(page, '#help', True); layout(page, touch=True)
            press(page, '#help-close', True); close_panels(page)
            assert state(page)['inventory'] == EMPTY
            checks.append({'width': width, 'height': height, 'theme': theme,
                           'fullscreenRoom': True, 'noDocumentScroll': True,
                           'bagMenuHelpFit': True, 'layout': dimensions})
        assert not errors and not writes and not external, (errors, writes, external)
        context.close()
    return checks

def audit(browser, url, width, theme):
    touch = width < 500
    context, page, errors, writes, external = open_page(browser, url, width, theme)
    assert 'quiet bell' in page.title().lower()
    assert all(page.locator(dialog).is_hidden() for dialog in ['#conversation-dialog', '#notes-dialog', '#menu-dialog'])
    dimensions = layout(page, touch)
    page.screenshot(path=str(OUT / f'{width}-{theme}-room.png'))
    dialogue = conversations(page, touch); collect_sources(page, touch); bag_checks(page, touch); draft_controls(page, touch)
    rejected_order(page, touch)
    layout(page, touch)
    page.screenshot(path=str(OUT / f'{width}-{theme}-lock.png'))
    choices = route_choices(page, width, theme, touch)
    if width == 1024 and theme == 'light': keyboard_commit(page)
    help_and_sound(page, touch)
    if width == 1024 and theme == 'light': corrupt_save(page)
    protected_storage(page)
    assert not errors, errors
    assert not writes and not external, (writes, external)
    context.close()
    return {'passed': True, 'width': width, 'theme': theme, 'layout': dimensions,
            'conversations': len(dialogue), 'threeDistinctStoryCharacters': True,
            'hintsAndAudioNeverConsume': True, 'draftAndConversationRestore': True,
            'npcGiftAndChestOnce': True, 'wrongOrderedCostNeverConsumes': True,
            'exactDoorCostsAndNativeKeyboardControls': True, 'routes': choices,
            'sharedProgressPreserved': True, 'errors': [], 'networkWrites': []}

def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            results = [audit(browser, url, width, theme) for width in [1024, 390, 320] for theme in ['light', 'dark']]
            (OUT / 'browser-results.json').write_text(json.dumps(results, indent=2) + '\n')
            movement = movement_checks(browser, url)
            viewports = viewport_checks(browser, url)
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(results, indent=2) + '\n')
        (OUT / 'movement-results.json').write_text(json.dumps(movement, indent=2) + '\n')
        (OUT / 'viewport-results.json').write_text(json.dumps(viewports, indent=2) + '\n')
        print(json.dumps({'passed': True, 'contexts': len(results), 'conversations': 54,
                          'routeCommitsAndRecommits': 36, 'nativeWalking': movement['passed'], 'errors': []}), flush=True)
    finally: server.shutdown()

if __name__ == '__main__': main()
