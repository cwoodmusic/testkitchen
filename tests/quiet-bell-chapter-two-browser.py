"""Real input through the three playable rooms beyond the depot.

No mutable gameplay hooks or forged action records are used. Every inventory
starts with explicit pickups, and both lock outcomes are paid for in the UI.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import importlib.util
import json
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/chapter-two'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
SIZES = [(320, 568), (390, 844), (1024, 768), (1366, 768), (1024, 480)]
BRANCHES = [
    {'route': 'garden', 'room': 'garden-porch', 'person': 'iris', 'source': 'iris-gift',
     'cost': ['half-rest', 'half'], 'dead': ['dotted-half', 'quarter'],
     'wrongDead': ['quarter', 'eighth-pair', 'sixteenth-group', 'quarter-rest'],
     'destination': 'garden-fork', 'terminal': 'dead-brambles'},
    {'route': 'workshop', 'room': 'workshop-porch', 'person': 'pip', 'source': 'pip-gift',
     'cost': ['half', 'eighth-pair', 'sixteenth-group'], 'dead': ['dotted-half', 'quarter'],
     'wrongDead': ['half-rest', 'quarter', 'quarter-rest'],
     'destination': 'workshop-fork', 'terminal': 'dead-aviary'},
    {'route': 'canal', 'room': 'canal-porch', 'person': 'oren', 'source': 'canal-chest',
     'cost': ['half', 'quarter', 'eighth-pair'], 'dead': ['dotted-half', 'sixteenth-group'],
     'wrongDead': ['half-rest', 'sixteenth-group', 'quarter-rest'],
     'destination': 'canal-fork', 'terminal': 'dead-ferry'},
]


def ids(records):
    return {record if isinstance(record, str) else record['id'] for record in records}


def journal(page):
    return page.evaluate('quietBell.journey')


def contract(page):
    # Resolve modules through the immutable release base used by the actual app.
    return page.evaluate('''async()=>{
      const {SCENES}=await import(new URL('scenes.mjs',document.baseURI));
      const {ROOM_CONTENT}=await import(new URL('chapter-content.mjs',document.baseURI));
      return{scenes:SCENES,content:ROOM_CONTENT};
    }''')


def after_cost(stock, cost):
    expected = stock.copy()
    for kind in cost: expected[kind] -= 1
    return expected


def assert_journey(page, nodes, edges, hints, outcomes):
    value = journal(page)
    for key, expected in [('nodes', nodes), ('edges', edges), ('hints', hints), ('outcomes', outcomes)]:
        assert ids(value[key]) == set(expected), (key, expected, value)
        assert len(value[key]) == len(expected), (key, value)
    assert value['achievements'] == [], 'This chapter cannot award full-dungeon completion.'


def assert_room(page, room, inventory):
    value = ui.state(page)
    assert value['roomId'] == room and value['phase'] == 'room', value
    assert value['inventory'] == inventory and value['availableInventory'] == inventory
    assert value['phrase'] == [] and value['creditedStages'] == []
    assert page.locator('#room-scene').get_attribute('data-room') == room
    assert page.locator('#outcome').is_hidden()
    assert page.locator('#player-sprite').is_visible()
    return value


def assert_scene_targets(page, scene):
    expected = {obj['id'] for obj in scene['objects']}
    actual = page.locator('#room-map button').evaluate_all('''items=>items.flatMap(e=>{
      const id=e.dataset.person??e.dataset.door??e.dataset.chest??e.dataset.inspect??e.dataset.return;
      return id?[id]:[];
    })''')
    assert set(actual) == expected and len(actual) == len(expected), (expected, actual)
    assert page.locator('[data-person="nell"],[data-chest="depot-chest"],[data-door="garden"],[data-door="workshop"],[data-door="canal"]').count() == 0


def visible_history(page, nodes, edges):
    ui.close_panels(page)
    ui.press(page, '#menu')
    chart = page.locator('#journey-chart')
    assert set(chart.locator('[data-journey-node]').evaluate_all('es=>es.map(e=>e.dataset.journeyNode)')) == set(nodes)
    assert set(chart.locator('[data-journey-edge]').evaluate_all('es=>es.map(e=>e.dataset.journeyEdge)')) == set(edges)
    ui.layout(page)
    ui.close_panels(page)


def reachable(page, target):
    walker = ui.walker(page)
    assert not walker['moving'] and not walker.get('pendingTarget'), walker
    assert math.hypot(walker['x'] - target['x'], walker['y'] - target['y']) <= target['range'] + .05, (target, walker)


def reload_exact(page):
    before = ui.resources(ui.state(page))
    position = ui.walker(page)
    page.reload(); page.wait_for_function('!!window.quietBell?.walker')
    page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
    assert ui.resources(ui.state(page)) == before, 'Reload must replay exactly the current room and paid actions.'
    restored = ui.walker(page)
    assert math.hypot(restored['x'] - position['x'], restored['y'] - position['y']) < 1
    return before


def claim_room_source(page, branch, targets, carry):
    ui.press(page, 'button[data-person="' + branch['person'] + '"]')
    reachable(page, targets[branch['person']])
    assert ui.state(page)['inventory'] == carry, 'Arrival and talking do not grant notes.'
    if branch['source'] == 'canal-chest':
        assert ui.unavailable(page, '#take-parcel'), 'Oren points to the chest and has no NPC gift.'
        ui.press(page, 'button[data-chest="canal-chest"]')
        reachable(page, targets['canal-chest'])
    else:
        assert page.locator('#take-parcel').is_enabled()
        ui.press(page, '#take-parcel')
    assert_room(page, branch['room'], ui.INITIAL)
    assert set(ui.state(page)['currentRoomClaimedSources']) == {branch['source']}
    assert len(ui.state(page)['actions']) == 4
    assert ui.state(page)['actions'][-1] == {'type': 'claim', 'sourceId': branch['source']}
    receipt = ui.state(page)['sourceReceipts'][-1]
    assert receipt['inventoryBefore'] == carry and receipt['inventoryAfter'] == ui.INITIAL
    assert receipt['recipe'] == branch['cost']
    reload_exact(page)
    ui.press(page, 'button[data-person="' + branch['person'] + '"]')
    if branch['source'] == 'canal-chest':
        assert ui.unavailable(page, 'button[data-chest="canal-chest"]')
    else:
        assert ui.unavailable(page, '#take-parcel')
    assert ui.state(page)['inventory'] == ui.INITIAL, 'A claimed room source cannot be farmed.'
    ui.close_panels(page)


def boundary(page, branch, kind, expected_stock, expected_recipe):
    value = ui.state(page)
    assert value['phase'] == 'continued' and value['roomId'] == branch['room']
    assert value['previewKind'] == kind and value['nextScene']['kind'] == kind
    assert value['nextScene']['id'] == (branch['terminal'] if kind == 'dead-end' else branch['destination'])
    assert value['inventory'] == expected_stock and value['availableInventory'] == expected_stock
    assert value['receipt']['recipe'] == expected_recipe and value['receipt']['received'] == []
    assert value['creditedStages'] == [] and page.locator('#outcome').is_visible()
    assert page.locator('#outcome-copy').inner_text().strip()
    if kind == 'dead-end':
        assert 'revisit' in page.locator('#outcome').inner_text().lower(), 'A dead end must explain recovery.'
    else:
        assert 'not playable' in page.locator('#outcome').inner_text().lower(), 'A release boundary must be explicit.'
    page.keyboard.press('Escape')
    assert page.locator('#outcome').is_visible()
    frozen = ui.walker(page)
    page.keyboard.down('ArrowRight'); page.clock.run_for(180); page.keyboard.up('ArrowRight')
    assert math.hypot(ui.walker(page)['x']-frozen['x'], ui.walker(page)['y']-frozen['y']) < 1
    reload_exact(page)
    assert page.locator('#outcome').is_visible()
    ui.press(page, '#outcome-map')
    assert page.locator('#menu-dialog').is_visible()
    ui.press(page, '#help'); ui.press(page, '#help-close'); page.clock.run_for(80)
    page.locator('#outcome').wait_for(state='visible')
    assert page.locator('#outcome').is_visible() and ui.state(page)['phase'] == 'continued'
    ui.press(page, '#outcome-map'); page.keyboard.press('Escape'); page.clock.run_for(80)
    page.locator('#outcome').wait_for(state='visible')
    assert page.locator('#outcome').is_visible()


def chapter_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light')
    data = contract(page)
    release_base = page.evaluate('document.baseURI')
    nodes, edges, hints, outcomes = {'depot'}, set(), set(), set()
    assert_journey(page, nodes, edges, hints, outcomes)
    ui.collect_sources(page)
    results, viewports = [], []
    for branch in BRANCHES:
        assert_room(page, 'depot', ui.INITIAL)
        ui.press(page, 'button[data-door="' + branch['route'] + '"]')
        ui.build(page, branch['cost']); ui.press(page, '#commit')
        carry = after_cost(ui.INITIAL, branch['cost'])
        arrived = assert_room(page, branch['room'], carry)
        assert set(arrived['claimedSources']) == {'nell-parcel', 'depot-chest'}
        assert arrived['currentRoomClaimedSources'] == [] and arrived['receipt']['received'] == []
        assert len(arrived['actions']) == 3 and arrived['selectedDoor'] is None
        nodes.add(branch['room']); edges.add('depot-' + branch['route'])
        assert_journey(page, nodes, edges, hints, outcomes)
        scene = data['scenes'][branch['room']]
        targets = {target['id']: target for target in scene['geometry']['targets']}
        assert_scene_targets(page, scene)
        reload_exact(page); assert_room(page, branch['room'], carry)
        for width, height in SIZES:
            page.set_viewport_size({'width': width, 'height': height}); page.wait_for_timeout(80); page.clock.run_for(80)
            ui.layout(page)
            frame = page.locator('#room-map').bounding_box()
            assert frame['y'] >= -1 and frame['y'] + frame['height'] <= height + 1, frame
            if frame['width'] <= width + 1:
                assert abs(frame['x'] - (width - frame['width'])/2) < 1, frame
            assert_room(page, branch['room'], carry)
            page.screenshot(path=str(OUT / f'{branch["room"]}-{width}-{height}.png'))
            viewports.append({'room': branch['room'], 'width': width, 'height': height, 'noScroll': True, 'wholeHeight': True})
        page.set_viewport_size({'width': 1024, 'height': 768}); page.wait_for_timeout(80); page.clock.run_for(80)
        visible_history(page, nodes, edges)
        # Every observation and NPC belongs to this scene, grants nothing, and is learned only on use.
        for record in data['content'][branch['room']]['inspections']:
            before = ui.resources(ui.state(page))
            ui.press(page, 'button[data-inspect="' + record['id'] + '"]')
            reachable(page, targets[record['id']])
            assert page.locator('#lore-title').text_content().strip() == record['title']
            assert page.locator('#lore-copy').text_content().strip() == record['text']
            assert ui.resources(ui.state(page)) == before
            hints.add('lore-' + record['id'])
            assert_journey(page, nodes, edges, hints, outcomes)
            ui.close_panels(page)
        ui.press(page, 'button[data-person="' + branch['person'] + '"]')
        ui.press(page, 'button[data-topic="story"]')
        assert_journey(page, nodes, edges, hints, outcomes)
        ui.press(page, 'button[data-topic="route"]')
        hints.add(branch['room'] + '-' + branch['person'] + '-route')
        ui.press(page, '#demo')
        assert_journey(page, nodes, edges, hints, outcomes)
        assert ui.state(page)['inventory'] == carry
        # A complete but incorrect phrase cannot spend notes or record a path.
        forward, dead = branch['room'] + '-forward', branch['room'] + '-dead'
        ui.press(page, 'button[data-door="' + forward + '"]')
        reachable(page, targets[forward])
        ui.build(page, branch['dead']); before = ui.resources(ui.state(page))
        assert ui.state(page)['canAttempt'] and not ui.state(page)['canCommit']
        ui.press(page, '#commit')
        assert ui.resources(ui.state(page)) == before and page.locator('#status').inner_text().strip()
        assert_journey(page, nodes, edges, hints, outcomes)
        ui.clear_phrase(page)
        # The optional dead end is a real paid route, with an atomic recovery.
        ui.press(page, 'button[data-door="' + dead + '"]')
        reachable(page, targets[dead])
        assert 'warn' in page.locator('#notes-dialog').inner_text().lower() or 'no ' in page.locator('#notes-dialog').inner_text().lower()
        ui.build(page, branch['wrongDead']); before = ui.resources(ui.state(page))
        assert ui.state(page)['canAttempt'] and not ui.state(page)['canCommit']
        ui.press(page, '#commit')
        assert ui.resources(ui.state(page)) == before
        assert_journey(page, nodes, edges, hints, outcomes)
        ui.clear_phrase(page)
        ui.build(page, branch['dead']); ui.press(page, '#commit')
        nodes.add(branch['terminal']); edges.add(dead); outcomes.add(branch['terminal'])
        assert_journey(page, nodes, edges, hints, outcomes)
        boundary(page, branch, 'dead-end', after_cost(carry, branch['dead']), branch['dead'])
        ui.press(page, '#revisit')
        assert_room(page, branch['room'], carry)
        assert len(ui.state(page)['actions']) == 3 and ui.state(page)['currentRoomClaimedSources'] == []
        # A source is explicitly collected once, then pays only the actual next lock.
        claim_room_source(page, branch, targets, carry)
        assert_journey(page, nodes, edges, hints, outcomes)
        ui.press(page, 'button[data-door="' + forward + '"]')
        ui.build(page, branch['cost']); ui.press(page, '#commit')
        nodes.add(branch['destination']); edges.add(forward)
        assert_journey(page, nodes, edges, hints, outcomes)
        boundary(page, branch, 'preview', carry, branch['cost'])
        page.screenshot(path=str(OUT / f'{branch["room"]}-continuation-boundary.png'))
        ui.press(page, '#revisit')
        assert_room(page, branch['room'], ui.INITIAL)
        assert branch['source'] in ui.state(page)['claimedSources'] and len(ui.state(page)['actions']) == 4
        reload_exact(page)
        # South exit rewinds the entry and all branch-local pickups together.
        ui.press(page, 'button[data-return="return-depot"]')
        assert_room(page, 'depot', ui.INITIAL)
        page.clock.run_for(100)
        painted = page.locator('#player-sprite').evaluate('''e=>({
          x:parseFloat(e.style.left)/100*1536,y:parseFloat(e.style.top)/100*1024,
          depth:Number(e.style.zIndex),facing:e.dataset.facing
        })''')
        active_walker = ui.walker(page)
        assert math.hypot(painted['x']-active_walker['x'], painted['y']-active_walker['y']) < .01, (painted, active_walker)
        assert painted['depth'] == round(active_walker['y']) and painted['facing'] == active_walker['facing']
        assert page.locator('[data-walk]:disabled').count() == 0, 'The disposed porch view must not repaint depot controls.'
        assert set(ui.state(page)['claimedSources']) == {'nell-parcel', 'depot-chest'}
        assert len(ui.state(page)['actions']) == 2 and len(ui.state(page)['sourceReceipts']) == 2
        assert all(receipt['sourceId'] != branch['source'] for receipt in ui.state(page)['sourceReceipts'])
        assert_journey(page, nodes, edges, hints, outcomes)
        reload_exact(page)
        results.append({'room': branch['room'], 'explicitSourceOnce': True, 'actualPropsAndNpc': True,
                        'wrongFourBeatsUnspent': True, 'paidDeadEndAndForward': True,
                        'boundaryUndoExact': True, 'southReturnAtomic': True, 'savedActualRoom': True})
    visible_history(page, nodes, edges)
    ui.press(page, '#menu')
    page.screenshot(path=str(OUT / 'all-visited-map.png'))
    for width, height in SIZES:
        page.set_viewport_size({'width': width, 'height': height}); page.wait_for_timeout(80); page.clock.run_for(80)
        ui.layout(page)
        assert page.locator('#journey-chart [data-journey-node]').count() == 10
        assert page.locator('#journey-chart [data-journey-edge]').count() == 9
        labels = page.locator('#journey-chart .journey-chart__title').evaluate_all('''es=>es.map(e=>{
          const m=e.getScreenCTM();return parseFloat(getComputedStyle(e).fontSize)*Math.hypot(m.a,m.b);
        })''')
        assert labels and min(labels) >= 10.5, labels
        if width == 320 and height == 568:
            page.screenshot(path=str(OUT / 'all-visited-map-320.png'))
    assert page.locator('#journey-outcomes li').count() == 3
    assert page.locator('#journey-achievements').is_hidden()
    ui.press(page, '#restart'); ui.close_panels(page)
    assert_room(page, 'depot', ui.EMPTY)
    assert ui.state(page)['claimedSources'] == []
    assert_journey(page, nodes, edges, hints, outcomes)
    reload_exact(page)
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'releaseBase': release_base, 'rooms': results, 'viewports': viewports, 'actualVisitedEdgesOnly': True,
            'restartKeepsHistoryWithoutNotes': True, 'noEarlyCompleteScore': True,
            'sharedStoragePreserved': True, 'errors': []}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with ui.sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            result = chapter_flow(browser, url)
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'passed': True, 'playablePorches': 3, 'paidBoundaryDoors': 6,
                          'actualRoomViewports': 15, 'atomicRewinds': True, 'errors': []}), flush=True)
    finally: server.shutdown()


if __name__ == '__main__': main()
