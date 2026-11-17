"""Walk every authored Quiet Bell route through real browser input.

Gameplay hooks are read-only: gifts, chests, searches, rhythm answers and revisits
all use the visible UI. One browser profile keeps the discovered chart across all
nine runs; unrelated arcade/music saves remain byte-for-byte unchanged.
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
OUT = ROOT / 'work/quiet-bell-campaign'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
PLAN = json.loads((ROOT / 'design/music-puzzler/dungeon.json').read_text())
ROOMS = {room['id']: room for room in PLAN['rooms']}
TERMINALS = {room['id']: room for room in PLAN['terminals']}
DOORS = {door['id']: dict(door, source=room['id']) for room in PLAN['rooms'] for door in room['doors']}
SOURCES = {source['id']: dict(source, room=room['id']) for room in PLAN['rooms'] for source in room['sources']}
KINDS = ui.KINDS
UNITS = {'quarter': 2, 'eighth-pair': 2, 'sixteenth-group': 2, 'half': 4,
         'eighth': 1, 'quarter-rest': 2, 'half-rest': 4, 'dotted-half': 6, 'sixteenth-pair': 1}


def ids(records):
    return {record if isinstance(record, str) else record['id'] for record in records}


def route_to(destination):
    def visit(room_id, trail):
        if room_id == destination:
            return trail
        for door in ROOMS.get(room_id, {}).get('doors', []):
            found = visit(door['to'], trail + [door['id']])
            if found is not None:
                return found
        return None
    result = visit(PLAN['entry'], [])
    assert result, destination
    return result


class Campaign:
    def __init__(self, page, touch=False):
        self.page, self.touch = page, touch
        self.project = page.evaluate('quietBell.project')
        self.nodes, self.edges, self.hints, self.outcomes = {'depot'}, set(), set(), set()
        self.visited, self.images, self.people, self.inspections = set(), {}, set(), set()
        self.sources = set()
        self.stock = ui.EMPTY.copy()
        self.results = []
        assert len(self.project['rooms']) == 14 and len(self.project['terminals']) == 9
        assert len(self.project['scenes']) == 23 and len(self.project['doors']) == 22
        assert len(self.project['sources']) == 7

    def close(self):
        ui.skip_cutscene(self.page)
        for dialog, button in [('#outcome', '#outcome-close'),
                               ('#conversation-dialog', '#conversation-close'),
                               ('#notes-dialog', '#notes-close'), ('#help-dialog', '#help-close'),
                               ('#menu-dialog', '#menu-close'), ('#lore-dialog', '#lore-close')]:
            if self.page.locator(dialog).is_visible():
                self.page.locator(button).click()

    def press(self, selector):
        button = self.page.locator(selector)
        target = button.evaluate('e=>({person:e.dataset.person,door:e.dataset.door,chest:e.dataset.chest,inspect:e.dataset.inspect,returnTo:e.dataset.return})')
        if not any(target.values()):
            getattr(button, 'tap' if self.touch else 'click')()
            return
        self.close()
        point = self.point(button)
        if not point:
            ui.prepare_target(self.page, button)
            point = self.point(button)
        assert point, (selector, button.bounding_box())
        if self.touch:
            self.page.touchscreen.tap(point['x'], point['y'])
        else:
            self.page.mouse.click(point['x'], point['y'])
        ui.settle_walk(self.page)
        if target.get('inspect'): ui.finish_inspection_discussion(self.page)
        value = ui.state(self.page)
        if target.get('person'):
            assert value['selectedPerson'] == target['person'] and self.page.locator('#conversation-dialog').is_visible(), (selector, value)
        if target.get('door'):
            assert value['selectedDoor'] == target['door'] and self.page.locator('#notes-dialog').is_visible(), (selector, value)
        if target.get('chest'):
            assert target['chest'] in value['claimedSources'], (selector, value)
        if target.get('inspect'):
            assert self.page.locator('#lore-dialog').get_attribute('data-observation') == target['inspect'], (selector, value)
        if not target.get('returnTo'):
            # An entrance performance can leave a companion at an inspected
            # object. Read the actual staged interaction geometry after it.
            scene = self.page.evaluate('quietBell.scene') or self.project['scenes'][value['roomId']]
            target_id = next(value for value in target.values() if value)
            geometry = next(item for item in scene['geometry']['targets'] if item['id'] == target_id)
            position = ui.walker(self.page)
            distance = math.hypot(position['x'] - geometry['x'], position['y'] - geometry['y'])
            assert distance <= geometry['range'] + .1, (selector, distance, geometry, position)

    def point(self, button):
        return button.evaluate('''e=>{
          const r=e.getBoundingClientRect();
          for(const fy of [.78,.6,.9,.4,.2])for(const fx of [.5,.25,.75,.1,.9]){
            const x=r.left+r.width*fx,y=r.top+r.height*fy;
            if(x>=12&&x<=innerWidth-12&&y>=12&&y<=innerHeight-12&&document.elementFromPoint(x,y)?.closest('button')===e)return{x,y};
          }return null;
        }''')

    def journal(self, visible=False):
        value = self.page.evaluate('quietBell.journey')
        for name, expected in [('nodes', self.nodes), ('edges', self.edges),
                               ('hints', self.hints), ('outcomes', self.outcomes)]:
            assert ids(value[name]) == expected and len(value[name]) == len(expected), (name, expected, value)
        complete = len(self.nodes) == 23 and len(self.edges) == 22 and len(self.outcomes) == 9
        assert ids(value['achievements']) == ({'complete-score'} if complete else set()), value
        if visible:
            self.close()
            self.press('#menu')
            chart = self.page.locator('#journey-chart')
            assert set(chart.locator('[data-journey-node]').evaluate_all('es=>es.map(e=>e.dataset.journeyNode)')) == self.nodes
            assert set(chart.locator('[data-journey-edge]').evaluate_all('es=>es.map(e=>e.dataset.journeyEdge)')) == self.edges
            assert self.page.locator('#journey-outcomes li').count() == len(self.outcomes)
            assert self.page.locator('#journey-achievements li').count() == int(complete)
            ui.layout(self.page, self.touch)
            self.close()
        return value

    def room(self, room_id):
        ui.skip_cutscene(self.page)
        value = ui.state(self.page)
        assert value['roomId'] == room_id and value['phase'] == ('terminal' if room_id in TERMINALS else 'room'), value
        assert value['inventory'] == self.stock and value['availableInventory'] == self.stock, (room_id, self.stock, value)
        assert not value['phrase'] and value['creditedStages'] == []
        assert self.page.locator('#room-scene').get_attribute('data-room') == room_id
        assert self.page.locator('#outcome').is_hidden(), 'Entering an endpoint must keep its room walkable.'
        assert self.page.locator('#player-sprite').is_visible()
        self.page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
        art = self.page.locator('.mg-art').evaluate('e=>({src:e.src,width:e.naturalWidth,height:e.naturalHeight})')
        assert art['width'] == 1536 and art['height'] == 1024, art
        self.images[room_id] = art['src']
        scene = self.project['scenes'][room_id]
        expected = {item['id'] for item in scene['objects'] if not item.get('revealAfter') or item['revealAfter'] in value['claimedSources']}
        actual = self.page.locator('#room-map button').evaluate_all('es=>es.flatMap(e=>{const id=e.dataset.person??e.dataset.door??e.dataset.chest??e.dataset.inspect??e.dataset.return;return id?[id]:[];})')
        assert set(actual) == expected and len(actual) == len(expected), (room_id, expected, actual)
        assert set(self.page.locator('[data-person]').evaluate_all('es=>es.map(e=>e.dataset.person)')) >= {'nell', 'iris', 'pip'}
        assert self.page.locator('[data-door]').count() == (len(ROOMS[room_id]['doors']) - len(value.get('hiddenDoorIds', [])) if room_id in ROOMS else 0)
        assert self.page.locator('#ending').is_visible() == (room_id in TERMINALS)
        ui.layout(self.page, self.touch)
        self.journal()
        return value

    def reload(self):
        self.close()
        before, position = ui.resources(ui.state(self.page)), ui.walker(self.page)
        self.page.reload()
        self.page.wait_for_function('!!window.quietBell?.walker')
        self.page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
        assert ui.resources(ui.state(self.page)) == before, 'The current paid run must replay exactly on reload.'
        restored = ui.walker(self.page)
        assert math.hypot(position['x'] - restored['x'], position['y'] - restored['y']) < 1, (position, restored)
        self.journal()
        self.room(before['roomId'])

    def observe(self, room_id):
        self.room(room_id)
        if room_id in self.visited:
            return
        self.visited.add(room_id)
        content = self.project['content'][room_id]
        for person in content['people']:
            before = ui.resources(ui.state(self.page))
            self.press(f'button[data-person="{person["id"]}"]')
            for topic in ['story', 'route', 'inventory']:
                choice = self.page.locator(f'button[data-topic="{topic}"]')
                if not choice.count():
                    continue
                self.press(f'button[data-topic="{topic}"]')
                assert self.page.locator('#dialogue').inner_text().strip(), (room_id, person['id'], topic)
                if topic == 'route':
                    self.hints.add(('' if room_id == 'depot' else room_id + '-') + person['id'] + '-route')
                assert ui.resources(ui.state(self.page)) == before, 'Talking must not award notes or spend them.'
            self.people.add((room_id, person['id']))
            self.close()
            self.journal()
        for record in content['inspections']:
            before = ui.resources(ui.state(self.page))
            self.press(f'button[data-inspect="{record["id"]}"]')
            assert self.page.locator('#lore-title').inner_text().strip() == record['title']
            assert self.page.locator('#lore-copy').inner_text().strip() == record['text']
            assert ui.resources(ui.state(self.page)) == before, 'Inspection is informational until Search is explicitly chosen.'
            if record.get('sourceId'):
                assert self.page.locator('#lore-search').is_visible() and self.page.locator('#lore-search').is_enabled()
                assert record['sourceId'] not in ui.state(self.page)['claimedSources']
            else:
                assert self.page.locator('#lore-search').is_hidden()
            self.hints.add('lore-' + record['id'])
            self.inspections.add(record['id'])
            self.close()
            self.journal()
        self.room(room_id)
        self.page.screenshot(path=str(OUT / f'{room_id}-{"phone" if self.touch else "desktop"}.png'))

    def claim(self, source):
        source_id = source['id']
        before = ui.state(self.page)
        assert source_id not in before['claimedSources']
        if source['type'] == 'npc':
            self.press(f'button[data-person="{source["character"]}"]')
            assert ui.state(self.page)['inventory'] == self.stock
            self.press('#take-parcel')
        elif source['type'] == 'chest':
            self.press(f'button[data-chest="{source_id}"]')
        else:
            record = next(item for item in self.project['content'][source['room']]['inspections'] if item.get('sourceId') == source_id)
            gates = [door for door in ROOMS[source['room']]['doors'] if door.get('revealAfter') == source_id]
            assert gates and all(self.page.locator(f'[data-door="{door["id"]}"]').count() == 0 for door in gates)
            self.press(f'button[data-inspect="{record["id"]}"]')
            self.hints.add('lore-' + record['id'])
            assert ui.state(self.page)['inventory'] == self.stock
            self.close()
            self.reload()
            assert all(self.page.locator(f'[data-door="{door["id"]}"]').count() == 0 for door in gates), 'An inspection or reload must not reveal a hidden gate.'
            self.press(f'button[data-inspect="{record["id"]}"]')
            self.press('#lore-search')
            assert all(self.page.locator(f'[data-door="{door["id"]}"]').is_visible() for door in gates)
        for kind in source['recipe']:
            self.stock[kind] += 1
        self.sources.add(source_id)
        after = self.room(source['room'])
        assert after['claimedSources'] == before['claimedSources'] + [source_id]
        assert after['actions'] == before['actions'] + [{'type': 'claim', 'sourceId': source_id}]
        receipt = after['sourceReceipts'][-1]
        assert receipt['inventoryBefore'] == before['inventory'] and receipt['inventoryAfter'] == self.stock
        assert receipt['recipe'] == source['recipe']
        self.reload()
        if source['type'] == 'npc':
            self.press(f'button[data-person="{source["character"]}"]')
            assert self.page.locator('#take-parcel').is_disabled()
        elif source['type'] == 'chest':
            assert self.page.locator(f'button[data-chest="{source_id}"]').is_disabled()
        else:
            self.press(f'button[data-inspect="{record["id"]}"]')
            assert self.page.locator('#lore-search').is_disabled()
        assert ui.state(self.page)['inventory'] == self.stock, 'Claimed sources cannot be farmed.'
        self.close()

    def pay(self, door_id):
        door = DOORS[door_id]
        assert ui.state(self.page)['roomId'] == door['source']
        alias = door_id.removeprefix('depot-') if door['source'] == 'depot' else door_id
        self.press(f'button[data-door="{alias}"]')
        assert not ui.state(self.page)['phrase']
        ui.build(self.page, door['recipe'], self.touch)
        expected = self.stock.copy()
        for kind in door['recipe']:
            expected[kind] -= 1
            assert expected[kind] >= 0
        before = ui.state(self.page)
        self.press('#commit')
        self.stock = expected
        self.nodes.add(door['to'])
        self.edges.add(door_id)
        if door['to'] in TERMINALS:
            self.outcomes.add(door['to'])
        value = self.room(door['to'])
        assert value['receipt']['recipe'] == door['recipe'] and value['receipt']['received'] == []
        assert value['claimedSources'] == before['claimedSources']
        assert len(value['actions']) == len(before['actions']) + 1
        assert value['traversedDoors'][-1] == door_id
        self.reload()
        return before

    def revisit(self, door_id, before):
        door = DOORS[door_id]
        assert self.page.locator('#outcome').is_hidden()
        self.press('#ending')
        assert self.page.locator('#outcome').is_visible()
        assert self.page.locator('#outcome-title').inner_text().strip() == TERMINALS[door['to']]['title']
        assert self.page.locator('#outcome-copy').inner_text().strip()
        ui.layout(self.page, self.touch)
        self.press('#outcome-close')
        assert self.page.locator('#outcome').is_hidden()
        self.press('#ending')
        self.press('#revisit')
        self.stock = before['inventory'].copy()
        value = self.room(door['source'])
        for key in ['inventory', 'claimedSources', 'actions', 'sourceReceipts', 'traversedDoors']:
            assert value[key] == before[key], (key, before, value)
        self.reload()
        self.pay(door_id)
        # The physical south threshold has the same atomic recovery behavior.
        self.press('button[data-return="return-previous"]')
        self.stock = before['inventory'].copy()
        value = self.room(door['source'])
        assert value['inventory'] == before['inventory'] and value['actions'] == before['actions']
        self.pay(door_id)

    def restart(self):
        self.close()
        self.press('#menu')
        self.press('#restart')
        self.stock = ui.EMPTY.copy()
        value = self.room('depot')
        assert value['claimedSources'] == [] and value['actions'] == []
        self.journal(visible=True)

    def run_route(self, terminal_id, revisit=True):
        route = route_to(terminal_id)
        for door_id in route:
            room_id = ui.state(self.page)['roomId']
            self.observe(room_id)
            for source in ROOMS[room_id]['sources']:
                if source['id'] not in ui.state(self.page)['claimedSources']:
                    self.claim(dict(source, room=room_id))
            before = self.pay(door_id)
        self.observe(terminal_id)
        total_units = sum(UNITS[kind] * number for kind, number in self.stock.items())
        if TERMINALS[terminal_id]['kind'] != 'dead-end':
            assert self.stock == ui.EMPTY, (terminal_id, self.stock)
        else:
            assert total_units > 0, (terminal_id, self.stock)
        self.journal(visible=True)
        if revisit:
            self.revisit(route[-1], before)
        self.results.append({'outcome': terminal_id, 'doors': route, 'remainingBeats': total_units / 2,
                             'walkable': True, 'reloaded': True, 'revisited': revisit})
        print(json.dumps(self.results[-1]), flush=True)


def campaign_flow(browser, url, terminal_ids=None):
    context, page, errors, writes, external = ui.open_page(browser, url, 1366, 'light', height=768)
    test = Campaign(page)
    test.room('depot')
    test.journal(visible=True)
    assert page.locator('#journey-chart [data-journey-node]').count() == 1
    terminal_ids = terminal_ids or list(TERMINALS)
    for index, terminal_id in enumerate(terminal_ids):
        if index:
            test.restart()
        test.run_route(terminal_id)
    expected_edges = {door_id for terminal_id in terminal_ids for door_id in route_to(terminal_id)}
    expected_places = {'depot'} | {DOORS[door_id]['to'] for door_id in expected_edges}
    assert test.visited == expected_places
    assert len(test.images) == len(expected_places) and len(set(test.images.values())) == len(expected_places)
    assert test.sources == {source['id'] for room_id in expected_places for source in ROOMS.get(room_id, {}).get('sources', [])}
    assert test.edges == expected_edges
    expected_people = {(room_id, person['id']) for room_id in expected_places for person in test.project['content'][room_id]['people']}
    assert test.people == expected_people, (expected_people - test.people, test.people - expected_people)
    assert test.inspections == {item['id'] for room_id in expected_places for item in test.project['content'][room_id]['inspections']}
    test.reload()
    test.journal(visible=True)
    test.press('#menu')
    page.screenshot(path=str(OUT / ('complete-score-desktop.png' if len(terminal_ids) == 9 else 'smoke-journey-desktop.png')))
    test.close()
    test.restart()
    complete = len(terminal_ids) == 9
    assert ids(page.evaluate('quietBell.journey.achievements')) == ({'complete-score'} if complete else set())
    test.reload()
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    summary = {'routes': test.results, 'rooms': len(test.visited & set(ROOMS)), 'outcomes': len(test.outcomes),
               'doors': len(test.edges), 'sources': len(test.sources), 'images': len(test.images),
               'npcInteractions': len(test.people), 'inspections': len(test.inspections),
               'completeScore': complete, 'errors': errors, 'externalWrites': writes}
    context.close()
    return summary


def phone_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 390, 'dark')
    test = Campaign(page, touch=True)
    test.room('depot')
    start = ui.walker(page)
    pad = page.locator('[data-walk="right"]').bounding_box()
    page.mouse.move(pad['x'] + pad['width'] / 2, pad['y'] + pad['height'] / 2)
    page.mouse.down(); page.clock.run_for(260); page.mouse.up(); ui.settle_walk(page)
    moved = ui.walker(page)
    assert moved['x'] > start['x'] + 35 and not moved['moving'], (start, moved)
    test.run_route('ending-secret-quiet', revisit=True)
    for width, height in [(320, 568), (390, 844), (1024, 480)]:
        page.set_viewport_size({'width': width, 'height': height})
        page.clock.run_for(100)
        ui.layout(page, width < 500)
        test.press('#ending')
        ui.layout(page, width < 500)
        test.close()
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'touch': True, 'dpad': True, 'secretRoute': True, 'endingRevisit': True, 'sizes': 3}


class PublicBrowser:
    """Keep the shared UI harness while tolerating the managed public TLS proxy."""
    def __init__(self, browser):
        self.browser = browser

    def new_context(self, **options):
        context = self.browser.new_context(ignore_https_errors=True, **options)
        original_route = context.route
        def route(pattern, handler):
            def handle(request_route):
                if request_route.request.url.split('?')[0].endswith('/favicon.ico'):
                    request_route.fulfill(status=204)
                else:
                    handler(request_route)
            original_route(pattern, handle)
        context.route = route
        return context


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true', help='Test game.html instead of the immutable launcher.')
    parser.add_argument('--url', help='Test a canonical/public URL with the same real-input harness.')
    parser.add_argument('--smoke', action='store_true', help='Exercise both secret routes and the canal ending (15 places, all 7 sources).')
    parser.add_argument('--desktop-only', action='store_true', help='Skip the separate phone/D-pad representative run.')
    args = parser.parse_args()
    started = time.monotonic()
    server = None
    if args.url:
        url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            runner = PublicBrowser(browser) if url.startswith('https:') else browser
            terminal_ids = ['ending-secret-quiet', 'ending-secret-birds', 'ending-public'] if args.smoke else None
            result = {'entry': args.url or ('source' if args.source else 'immutable launcher'),
                      'desktop': campaign_flow(runner, url, terminal_ids)}
            if not args.desktop_only:
                result['phone'] = phone_flow(runner, url)
            browser.close()
        result['seconds'] = round(time.monotonic() - started, 1)
        name = ('public' if args.url else 'source' if args.source else 'launcher') + ('-smoke' if args.smoke else '')
        (OUT / f'{name}-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2), flush=True)
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
