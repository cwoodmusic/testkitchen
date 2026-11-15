"""Real page-one gifts, chest, physical door and inventory-carry checks.

Only browser storage is seeded. Gameplay state is observed, never edited.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/page-one-doors'
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
     'recipe': ['half-rest', 'half'], 'person': 'pip'},
    {'id': 'workshop', 'name': 'Two grouped tiles reach the workshop',
     'recipe': ['half', 'eighth-pair', 'sixteenth-group'], 'person': 'iris'},
    {'id': 'canal', 'name': 'An ordinary sounding phrase reaches the canal',
     'recipe': ['half', 'quarter', 'eighth-pair'], 'person': 'nell'},
]

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
    return {key: value.get(key) for key in ['phase', 'inventory', 'availableInventory', 'phrase',
            'beats', 'canAttempt', 'canCommit', 'routeId', 'nextScene', 'receipt', 'creditedStages',
            'discoveredRoutes', 'selectedDoor', 'claimedSources', 'claimedGifts', 'openedChests']}
def press(page, selector, touch=False):
    getattr(page.locator(selector), 'tap' if touch else 'click')()
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

def sources_claimed(page, touch=False):
    press(page, 'button[data-person="nell"]', touch)
    press(page, 'button[data-topic="story"]', touch)
    for selector in ['#take-parcel', 'button[data-chest="depot-chest"]']:
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
      return{width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,
        people:[...document.querySelectorAll('button[data-person]')].map(rect),
        topics:[...document.querySelectorAll('button[data-topic]')].map(rect),
        doors:[...document.querySelectorAll('button[data-door]')].map(rect),
        chests:[...document.querySelectorAll('button[data-chest]')].map(rect),
        images:[...document.images].map(i=>({complete:i.complete,width:i.naturalWidth}))};
    }''')
    assert value['doc'] <= value['width'] + 1 and value['body'] <= value['width'] + 1, value
    assert len(value['people']) == 3 and len(value['topics']) == 3 and len(value['doors']) == 3 and len(value['chests']) == 1, value
    assert all(image['complete'] and image['width'] > 0 for image in value['images']), value
    for group in [value['people'] + value['doors'] + value['chests'], value['topics']]:
        for index, first in enumerate(group):
            assert first['left'] >= -1 and first['right'] <= value['width'] + 1, first
            if touch: assert first['width'] >= 43.5 and first['height'] >= 43.5, first
            for second in group[index + 1:]:
                overlap = max(0, min(first['right'], second['right']) - max(first['left'], second['left'])) * max(0, min(first['bottom'], second['bottom']) - max(first['top'], second['top']))
                assert overlap < 1, (first, second, overlap)
    return value

def open_page(browser, url, width, theme):
    touch = width < 500
    context = browser.new_context(viewport={'width': width, 'height': 900}, has_touch=touch,
                                  is_mobile=touch, color_scheme=theme, reduced_motion='reduce')
    context.add_init_script('''for(const[key,value]of Object.entries(''' + json.dumps(PROTECTED) + '''))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);''')
    page = context.new_page(); page.set_default_timeout(15000)
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
    return context, page, errors, writes, external

def conversations(page, touch=False):
    baseline = resources(state(page)); dialogue = []
    assert state(page)['inventory'] == EMPTY
    for person in ['nell', 'iris', 'pip']:
        press(page, 'button[data-person="' + person + '"]', touch); messages = set()
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
    assert page.locator('button[data-person="pip"]').get_attribute('aria-pressed') == 'true'
    assert page.locator('button[data-topic="route"]').get_attribute('aria-pressed') == 'true'
    assert resources(state(page)) == baseline
    return dialogue

def draft_controls(page, touch=False):
    assert state(page)['inventory'] == INITIAL
    visible_stock(page, INITIAL)
    assert page.locator('button[data-kind]:not([data-remove])').count() == 9
    assert page.locator('button[data-kind]:not([data-remove]) svg').count() == 9
    press(page, 'button[data-door="garden"]', touch)
    assert state(page)['selectedDoor'] == 'garden'
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
    clear_phrase(page, touch)
    assert state(page)['inventory'] == INITIAL and state(page)['availableInventory'] == INITIAL
    assert state(page)['phrase'] == [] and state(page).get('creditedStages', []) == []
    page.locator('button[data-person="iris"]').focus(); page.keyboard.press('Enter')
    assert page.locator('button[data-person="iris"]').get_attribute('aria-pressed') == 'true'
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
    build(page, ['half', 'half-rest'], touch)
    assert state(page)['canAttempt'] and not state(page)['canCommit']
    before = resources(state(page))
    press(page, '#commit', touch)
    assert resources(state(page)) == before, 'A wrong ordered answer must leave stock and draft unchanged.'
    assert state(page)['phase'] == 'room' and page.locator('#status').inner_text().strip()
    assert page.locator('#outcome').is_hidden()
    clear_phrase(page, touch)
    assert state(page)['inventory'] == INITIAL

def route_choices(page, width, theme, touch=False):
    checked = []
    for fixture in ROUTES:
        assert state(page)['phase'] == 'room'
        press(page, 'button[data-door="' + fixture['id'] + '"]', touch)
        assert state(page)['selectedDoor'] == fixture['id']
        press(page, 'button[data-person="' + fixture['person'] + '"]', touch)
        press(page, 'button[data-topic="route"]', touch)
        assert state(page)['selectedDoor'] == fixture['id'], 'NPC hints must not replace the selected physical door.'
        build(page, fixture['recipe'], touch); press(page, '#commit', touch)
        page.wait_for_function('window.quietBell.state.phase==="continued"'); actual = state(page)
        assert actual['routeId'] == fixture['id'], (fixture, actual)
        assert actual.get('creditedStages', []) == []
        expected = INITIAL.copy()
        for kind in fixture['recipe']: expected[kind] -= 1
        assert actual['inventory'] == expected and actual['availableInventory'] == expected
        visible_stock(page, expected)
        assert fixture['id'] in actual['discoveredRoutes']
        assert page.locator('#outcome').is_visible() and page.locator('#commit').is_disabled()
        committed = resources(actual); page.reload(); page.wait_for_function('!!window.quietBell?.state')
        assert resources(state(page)) == committed, 'Reload must not issue a gift or replace carried stock.'
        protected_storage(page); assert page.locator('#outcome').is_visible()
        page.screenshot(path=str(OUT / f'{width}-{theme}-{fixture["id"]}.png'), full_page=True)
        press(page, '#undo', touch); undone = state(page)
        assert undone['phase'] == 'room' and undone['inventory'] == INITIAL and undone['availableInventory'] == INITIAL
        assert undone.get('creditedStages', []) == [] and undone['phrase'] == []
        assert fixture['id'] in undone['discoveredRoutes']
        sources_claimed(page, touch)
        press(page, 'button[data-door="' + fixture['id'] + '"]', touch)
        build(page, fixture['recipe'], touch); press(page, '#commit', touch)
        assert state(page)['inventory'] == expected and state(page).get('creditedStages', []) == []
        press(page, '#restart' if fixture['id'] == 'canal' else '#undo', touch)
        assert state(page)['phase'] == 'room'
        assert state(page)['inventory'] == (EMPTY if fixture['id'] == 'canal' else INITIAL)
        assert fixture['id'] in state(page)['discoveredRoutes']
        checked.append({'id': fixture['id'], 'stockAfterDoorCost': expected,
                        'noAutomaticArrivalGrant': True, 'reloadAndUndoExact': True})
    assert set(state(page)['discoveredRoutes']) == {'garden', 'workshop', 'canal'}
    return checked

def keyboard_commit(page):
    """A fully composed phrase keeps its primary action reachable without a mouse."""
    assert state(page)['phase'] == 'room' and state(page)['phrase'] == []
    collect_sources(page)
    page.locator('button[data-door="canal"]').focus(); page.keyboard.press('Enter')
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
    assert state(page)['phase'] == 'continued' and state(page)['routeId'] == 'canal'
    assert page.evaluate('document.activeElement?.id') == 'revisit'

def help_and_sound(page, touch=False):
    press(page, '#help', touch)
    assert page.locator('#help-dialog').is_visible()
    assert 'four' in page.locator('#help-dialog').inner_text().lower() or '4' in page.locator('#help-dialog').inner_text()
    page.keyboard.press('Escape'); assert page.locator('#help-dialog').is_hidden()
    before = page.locator('#sound').get_attribute('aria-pressed'); press(page, '#sound', touch)
    assert page.locator('#sound').get_attribute('aria-pressed') != before
    after = page.locator('#sound').get_attribute('aria-pressed')
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    assert page.locator('#sound').get_attribute('aria-pressed') == after

def corrupt_save(page):
    if state(page)['phase'] == 'continued': press(page, '#restart')
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

def audit(browser, url, width, theme):
    touch = width < 500
    context, page, errors, writes, external = open_page(browser, url, width, theme)
    assert 'quiet bell' in page.title().lower()
    dialogue = conversations(page, touch); collect_sources(page, touch); draft_controls(page, touch)
    rejected_order(page, touch)
    dimensions = layout(page, touch)
    page.screenshot(path=str(OUT / f'{width}-{theme}-room.png'), full_page=True)
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
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps({'passed': True, 'contexts': len(results), 'conversations': 54,
                          'routeCommitsAndRecommits': 36, 'errors': []}), flush=True)
    finally: server.shutdown()

if __name__ == '__main__': main()
