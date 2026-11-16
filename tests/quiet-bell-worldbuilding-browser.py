"""Actual depot observations: proximity, learned-only journal and no note awards.

The tests drive real room controls and inspect the public, read-only state.
Repeated approaches advance genuine animation-frame callbacks rather than
teleporting the player or writing game state.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import importlib.util
import json
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/worldbuilding'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
OBSERVATIONS = ['returned-letter', 'clockwork-roost', 'dispatch-map', 'route-orrery', 'star-post']


def ids(records):
    return [record if isinstance(record, str) else record['id'] for record in records]


def journal(page):
    return page.evaluate('quietBell.journey')


def expected_journal(page, observations, npc_hints=(), nodes=('depot',), edges=()):
    state = journal(page)
    expected = {'lore-' + id for id in observations} | set(npc_hints)
    assert set(ids(state['hints'])) == expected and len(state['hints']) == len(expected), state
    assert set(ids(state['nodes'])) == set(nodes), state
    assert set(ids(state['edges'])) == set(edges), state
    assert state['outcomes'] == [] and state['achievements'] == [], state
    return state


def close_lore(page, method='close'):
    if page.locator('#lore-dialog').is_visible():
        if method == 'escape': page.keyboard.press('Escape')
        else: ui.press(page, '#lore-done' if method == 'done' else '#lore-close')
        assert page.locator('#lore-dialog').is_hidden()


def run_ledger(page):
    saved = page.evaluate('(key)=>localStorage.getItem(key)', ui.SAVE_KEY)
    if not saved: return None
    record = json.loads(saved)
    return {key: record.get(key) for key in ['version', 'actions', 'phrase', 'selectedDoor', 'discoveredRoutes']}


def room_contract(page):
    return page.evaluate('''async()=>{
      const {DEPOT_LORE}=await import(new URL('lore.mjs',document.baseURI).href);
      const {DEPOT_ROOM}=await import(new URL('room.mjs',document.baseURI).href);
      return{lore:DEPOT_LORE,targets:DEPOT_ROOM.targets};
    }''')


def inspect(page, record, target, touch=False):
    close_lore(page)
    ui.close_panels(page)
    before = ui.resources(ui.state(page))
    button = page.locator('button[data-inspect="' + record['id'] + '"]')
    # Read the real room contract when a cropped object needs camera steering.
    if not ui.target_on_screen(button):
        ui.clear_aisle(page)
        ui.key_walk(page, 'x', target['approach']['x'])
    ui.prepare_target(page, button)
    point = button.evaluate('e=>{const r=e.getBoundingClientRect();return{x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}')
    if touch: page.touchscreen.tap(point['x'], point['y'])
    else: page.mouse.click(point['x'], point['y'])
    ui.settle_walk(page)
    page.locator('#lore-dialog').wait_for(state='visible')
    assert page.locator('#lore-dialog').get_attribute('data-observation') == record['id']
    assert page.locator('#lore-title').text_content().strip() == record['title']
    assert page.locator('#lore-copy').text_content().strip() == record['text']
    walker = ui.walker(page)
    assert not walker['moving'] and not walker.get('pendingTarget')
    assert math.hypot(walker['x'] - target['x'], walker['y'] - target['y']) <= target['range'] + .01, (target, walker)
    assert ui.resources(ui.state(page)) == before, 'An observation must not award items or alter the current puzzle.'
    ledger = run_ledger(page)
    assert ledger and ledger['actions'] == [], ledger
    ui.layout(page, touch)
    return {'id': record['id'], 'title': record['title'], 'position': {'x': walker['x'], 'y': walker['y']},
            'inReach': True, 'resourcesUnchanged': True}


def check_visible_journal(page, known, catalog, touch=False):
    close_lore(page)
    ui.close_panels(page)
    ui.press(page, '#menu', touch)
    assert page.locator('#journey-chart [data-journey-node]').count() == 1
    assert page.locator('#journey-chart [data-journey-node="depot"]').count() == 1
    assert page.locator('#journey-chart [data-journey-edge]').count() == 0
    assert page.locator('#journey-hints li').count() == len(known)
    assert page.locator('#journey-outcomes').is_hidden() and page.locator('#journey-achievements').is_hidden()
    if known:
        if not page.locator('#journey-hints-section').evaluate('e=>e.open'):
            ui.press(page, '#journey-hints-section > summary', touch)
        visible = page.locator('#journey-hints').inner_text()
        for id, record in catalog.items():
            if id in known:
                assert record['title'] in visible and record['text'] in visible
            else:
                assert record['title'] not in visible and record['text'] not in visible
    else:
        assert page.locator('#journey-hints-section').is_hidden()
    ui.layout(page, touch)


def observation_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light')
    page.wait_for_function('!!window.quietBell?.journey')
    contract = room_contract(page)
    catalog = {record['id']: record for record in contract['lore']}
    targets = {target['id']: target for target in contract['targets']}
    assert set(catalog) == set(OBSERVATIONS)
    assert all(id in targets for id in OBSERVATIONS)
    assert page.locator('button[data-inspect]').count() == 5
    expected_journal(page, [])
    check_visible_journal(page, [], catalog)
    ui.close_panels(page)
    baseline = ui.resources(ui.state(page))
    assert ui.state(page)['inventory'] == ui.EMPTY
    known, inspected = [], []
    for index, id in enumerate(OBSERVATIONS):
        expected_journal(page, known)
        inspected.append(inspect(page, catalog[id], targets[id]))
        known.append(id)
        actual = expected_journal(page, known)
        entry = next(hint for hint in actual['hints'] if hint['id'] == 'lore-' + id)
        assert entry['title'] == catalog[id]['title'] and entry['text'] == catalog[id]['text']
        assert ui.resources(ui.state(page)) == baseline
        if index == 0:
            at_rest = ui.walker(page)
            page.keyboard.down('ArrowRight'); page.clock.run_for(180); page.keyboard.up('ArrowRight')
            after = ui.walker(page)
            assert not after['moving'] and math.hypot(after['x'] - at_rest['x'], after['y'] - at_rest['y']) < 1
            page.screenshot(path=str(OUT / 'first-observation.png'))
        close_lore(page, ['close', 'done', 'escape'][index % 3])
        if index == 0:
            check_visible_journal(page, known, catalog)
            page.screenshot(path=str(OUT / 'one-known-observation.png'))
            ui.close_panels(page)
    # Repeat an observation without adding another journal record or a reward.
    before = journal(page)
    inspect(page, catalog[OBSERVATIONS[0]], targets[OBSERVATIONS[0]])
    assert journal(page) == before
    close_lore(page)
    check_visible_journal(page, known, catalog)
    page.screenshot(path=str(OUT / 'all-five-known-observations.png'))
    ui.restart_run(page)
    assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['claimedSources'] == []
    expected_journal(page, known)
    page.reload(); page.wait_for_function('!!window.quietBell?.journey')
    expected_journal(page, known)
    assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['claimedSources'] == []
    check_visible_journal(page, known, catalog)
    # Familiar pickups and exact door rhythms still work after reading the room.
    ui.close_panels(page)
    ui.collect_sources(page)
    assert ui.state(page)['inventory'] == ui.INITIAL
    expected_journal(page, known)
    ui.press(page, 'button[data-person="nell"]'); ui.press(page, 'button[data-topic="route"]')
    expected_journal(page, known, ['nell-route'])
    ui.press(page, 'button[data-door="canal"]')
    ui.build(page, ['half', 'half-rest']); ui.press(page, '#commit')
    assert ui.state(page)['phase'] == 'room' and ui.state(page)['inventory'] == ui.INITIAL
    expected_journal(page, known, ['nell-route'])
    ui.clear_phrase(page)
    ui.build(page, ['half', 'quarter', 'eighth-pair']); ui.press(page, '#commit')
    assert ui.state(page)['phase'] == 'continued' and sum(ui.state(page)['inventory'].values()) == 6
    expected_journal(page, known, ['nell-route'], ['depot', 'canal-porch'], ['depot-canal'])
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'inspections': inspected, 'observedHintsOnly': True,
            'noNoteOrRouteAwards': True, 'allModalCloseMethods': True, 'modalPausesWalking': True,
            'repeatDoesNotDuplicate': True, 'restartReloadRetainObservations': True,
            'ordinaryPickupsAndStrictDoorCostsPreserved': True, 'sharedProgressPreserved': True, 'errors': []}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with ui.sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            result = observation_flow(browser, url)
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'passed': True, 'realApproachInspections': 5, 'observedOnlyJournal': True,
                          'notesUnchangedByLore': True, 'restartReloadPersist': True,
                          'existingPickupsAndDoorsPreserved': True, 'errors': []}), flush=True)
    finally:
        server.shutdown()


if __name__ == '__main__': main()
