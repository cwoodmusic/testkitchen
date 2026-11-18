"""Visited-only pause history through actual rooms, clues and rhythm locks.

Browser storage is seeded only to test restore filtering. The game is driven by
real input; repeated approaches advance its real animation-frame callbacks.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/journey'
OUT.mkdir(parents=True, exist_ok=True)
JOURNEY_KEY = 'codaQuietBellJourneyV1'
spec = importlib.util.spec_from_file_location('quiet_bell_ui', ROOT / 'tests/rhythm-blocks-browser.py')
ui = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ui)
NODE_BY_ROUTE = {'canal': 'canal-porch', 'garden': 'garden-porch', 'workshop': 'workshop-porch'}
COSTS = {'canal': ['half', 'quarter', 'eighth-pair'], 'garden': ['half', 'half-rest'],
         'workshop': ['half', 'eighth-pair', 'sixteenth-group']}


def ids(values):
    return [value if isinstance(value, str) else value['id'] for value in values]


def book(page):
    return page.evaluate('window.quietBell.journey')


def expected_book(page, nodes, edges, hints):
    actual = book(page)
    assert set(ids(actual['nodes'])) == set(nodes), actual
    assert set(ids(actual['edges'])) == set(edges), actual
    assert set(ids(actual['hints'])) == set(hints), actual
    assert ids(actual['outcomes']) == [], 'Opening door arrivals are not dungeon endings.'
    assert ids(actual['achievements']) == [], 'The incomplete opening must not award the full-dungeon achievement.'
    for field in ['nodes', 'edges', 'hints']:
        assert len(ids(actual[field])) == len(set(ids(actual[field]))), (field, actual)
    return actual


def pause(page, touch=False):
    ui.close_panels(page)
    before = ui.resources(ui.state(page))
    ui.press(page, '#menu', touch)
    assert page.locator('#menu-dialog').is_visible()
    assert page.locator('#menu-title').inner_text().strip().lower() == 'paused'
    assert ui.resources(ui.state(page)) == before, 'Viewing history must not change the current run.'


def rendered_chart(page, nodes, edges, hints):
    expected_book(page, nodes, edges, hints)
    chart = page.locator('#journey-chart')
    assert chart.is_visible()
    actual_nodes = chart.locator('[data-journey-node]').evaluate_all('items=>items.map(e=>e.getAttribute("data-journey-node"))')
    actual_edges = chart.locator('[data-journey-edge]').evaluate_all('items=>items.map(e=>e.getAttribute("data-journey-edge"))')
    assert set(actual_nodes) == set(nodes) and len(actual_nodes) == len(nodes), actual_nodes
    assert set(actual_edges) == set(edges) and len(actual_edges) == len(edges), actual_edges
    text = chart.inner_text() if chart.evaluate('e=>e instanceof HTMLElement') else chart.text_content()
    assert not re.search(r'\?{2,}|\bunknown\b|\bundiscovered\b|\blocked\b|\d+\s*/\s*\d+', text, re.I), text
    assert page.locator('#journey-hints li').count() == len(hints)
    assert page.locator('#journey-outcomes').is_hidden()
    assert page.locator('#journey-achievements').is_hidden()
    ui.layout(page)
    return {'nodes': actual_nodes, 'edges': actual_edges, 'hints': list(hints)}


def visit_route(page, route, touch=False):
    ui.press(page, 'button[data-door="' + route + '"]', touch)
    assert page.locator('#notes-dialog').is_visible()
    ui.build(page, COSTS[route], touch)
    ui.press(page, '#commit', touch)
    assert ui.state(page)['phase'] == 'room' and ui.state(page)['roomId'] == NODE_BY_ROUTE[route]
    assert ui.state(page)['routeId'] == route and page.locator('#outcome').is_hidden()
    expected = ui.INITIAL.copy()
    for kind in COSTS[route]: expected[kind] -= 1
    assert ui.state(page)['inventory'] == expected
    return expected


def discovery_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light')
    page.wait_for_function('!!window.quietBell?.journey')
    expected_book(page, ['depot'], [], [])
    assert ui.state(page)['inventory'] == ui.EMPTY
    pause(page)
    initial = rendered_chart(page, ['depot'], [], [])
    page.screenshot(path=str(OUT / 'initial-pause.png'))
    ui.close_panels(page)
    ui.collect_sources(page)
    expected_book(page, ['depot'], [], [])
    assert ui.state(page)['inventory'] == ui.INITIAL
    # An NPC's personal story and gifts do not reveal a route or a destination.
    ui.press(page, 'button[data-person="nell"]')
    ui.press(page, 'button[data-topic="route"]')
    heard_nell = ui.conversation_text(page).strip()
    expected_book(page, ['depot'], [], ['nell-route'])
    ui.press(page, '#demo')
    expected_book(page, ['depot'], [], ['nell-route'])
    pause(page)
    clue_only = rendered_chart(page, ['depot'], [], ['nell-route'])
    if not page.locator('#journey-hints-section').evaluate('e=>e.open'):
        ui.press(page, '#journey-hints-section > summary')
    assert 'nell' in page.locator('#journey-hints').inner_text().lower()
    assert heard_nell in page.locator('#journey-hints').inner_text()
    page.screenshot(path=str(OUT / 'clue-without-traversal.png'))
    # Selecting a physical lock is not the same as walking through it.
    ui.press(page, 'button[data-door="canal"]')
    expected_book(page, ['depot'], [], ['nell-route'])
    ui.build(page, ['half', 'half-rest']); ui.press(page, '#commit')
    assert ui.state(page)['phase'] == 'room' and ui.state(page)['inventory'] == ui.INITIAL
    expected_book(page, ['depot'], [], ['nell-route'])
    ui.clear_phrase(page)
    ui.build(page, COSTS['canal']); ui.press(page, '#commit')
    expected_book(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route'])
    assert sum(ui.state(page)['inventory'].values()) == 6
    pause(page)
    rendered_chart(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route'])
    assert page.locator('#journey-chart .journey-chart__node--current').get_attribute('data-journey-node') == 'canal-porch'
    ui.press(page, '#help')
    assert page.locator('#help-dialog').is_visible() and ui.state(page)['roomId'] == 'canal-porch'
    ui.press(page, '#help-close'); ui.close_panels(page)
    assert ui.state(page)['phase'] == 'room' and ui.state(page)['roomId'] == 'canal-porch'
    pause(page); page.keyboard.press('Escape')
    assert page.locator('#menu-dialog').is_hidden() and ui.state(page)['roomId'] == 'canal-porch'
    # Undo changes the note ledger while discoveries remain cumulative.
    ui.revisit_room(page)
    assert ui.state(page)['inventory'] == ui.INITIAL
    pause(page)
    canal = rendered_chart(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route'])
    page.screenshot(path=str(OUT / 'canal-discovered.png'))
    ui.press(page, '#restart')
    assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['claimedSources'] == []
    expected_book(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route'])
    page.reload(); page.wait_for_function('!!window.quietBell?.journey')
    assert ui.state(page)['inventory'] == ui.EMPTY
    expected_book(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route'])
    ui.collect_sources(page)
    ui.press(page, 'button[data-person="iris"]'); ui.press(page, 'button[data-topic="route"]')
    expected_book(page, ['depot', 'canal-porch'], ['depot-canal'], ['nell-route', 'iris-route'])
    visit_route(page, 'garden')
    nodes = ['depot', 'canal-porch', 'garden-porch']
    edges = ['depot-canal', 'depot-garden']
    hints = ['nell-route', 'iris-route']
    expected_book(page, nodes, edges, hints)
    ui.revisit_room(page); assert ui.state(page)['inventory'] == ui.INITIAL
    pause(page)
    garden = rendered_chart(page, nodes, edges, hints)
    assert page.locator('#journey-chart [data-journey-node="workshop-porch"]').count() == 0
    assert page.locator('#journey-chart [data-journey-edge="depot-workshop"]').count() == 0
    page.screenshot(path=str(OUT / 'two-actual-branches.png'))
    # Even all opening routes cannot complete an unreleased dungeon.
    visit_route(page, 'workshop')
    nodes.append('workshop-porch'); edges.append('depot-workshop')
    expected_book(page, nodes, edges, hints)
    ui.revisit_room(page)
    assert ui.state(page)['inventory'] == ui.INITIAL
    pause(page)
    all_opening = rendered_chart(page, nodes, edges, hints)
    page.screenshot(path=str(OUT / 'all-opening-routes-no-award.png'))
    responsive = []
    for width, height in [(320,568),(390,844),(1024,768)]:
        page.set_viewport_size({'width': width, 'height': height}); page.wait_for_timeout(60)
        rendered_chart(page, nodes, edges, hints)
        labels = page.locator('#journey-chart .journey-chart__title').evaluate_all('''items=>items.filter(e=>e.textContent.trim()).map(e=>{const m=e.getScreenCTM();return{text:e.textContent,screenFont:parseFloat(getComputedStyle(e).fontSize)*Math.hypot(m.a,m.b)};})''')
        assert labels and all(label['screenFont'] >= 10.5 for label in labels), labels
        page.screenshot(path=str(OUT / f'{width}-all-known-branches.png'))
        responsive.append({'width': width, 'height': height, 'labels': labels, 'fits': True})
    # Persisted IDs are filtered against the catalog; stored prose is never trusted.
    stored = json.loads(page.evaluate('(key)=>localStorage.getItem(key)', JOURNEY_KEY))
    for field in ['nodes', 'edges', 'hints', 'outcomes']:
        stored[field].append('unknown-' + field)
    stored['outcomes'].append('ending_secret_fast')
    stored['achievements'] = ['master', 'full-dungeon-complete']
    stored['titles'] = {'depot': 'UNTRUSTED_TITLE'}
    page.evaluate('([key,value])=>localStorage.setItem(key,value)', [JOURNEY_KEY, json.dumps(stored)])
    page.reload(); page.wait_for_function('!!window.quietBell?.journey')
    expected_book(page, nodes, edges, hints)
    assert ui.state(page)['inventory'] == ui.INITIAL
    pause(page); rendered_chart(page, nodes, edges, hints)
    assert 'UNTRUSTED_TITLE' not in page.locator('#menu-dialog').inner_text()
    # Preserve old legitimate door discoveries when a player first gains the journal.
    ui.close_panels(page)
    page.evaluate('(key)=>localStorage.removeItem(key)', JOURNEY_KEY)
    page.reload(); page.wait_for_function('!!window.quietBell?.journey')
    expected_book(page, nodes, edges, [])
    assert ui.state(page)['inventory'] == ui.INITIAL
    # Clearing a run never consumes or replaces the separate discovery history.
    page.evaluate('(key)=>localStorage.removeItem(key)', ui.SAVE_KEY)
    page.reload(); page.wait_for_function('!!window.quietBell?.journey')
    expected_book(page, nodes, edges, [])
    assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['claimedSources'] == []
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'initial': initial, 'clueWithoutTraversal': clue_only,
            'canal': canal, 'canalAndGardenOnly': garden, 'allOpeningRoutes': all_opening,
            'actualEdgesOnly': True, 'undoRestartReloadRetainHistoryWithoutNotes': True,
            'unknownStoredIdsFiltered': True, 'legacyDoorHistoryMigrates': True,
            'runAndJourneyLedgersSeparate': True, 'noEarlyUltimateAward': True,
            'roomPauseReturnsWithoutUndo': True, 'responsiveKnownChart': responsive, 'errors': []}


def pause_stops_walking(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'dark', virtual_walk=False)
    page.wait_for_function('!!window.quietBell?.journey')
    page.locator('#walk-floor').focus(); page.keyboard.down('ArrowRight'); page.wait_for_timeout(180)
    assert ui.walker(page)['moving']
    page.keyboard.press('Escape'); page.keyboard.up('ArrowRight')
    assert page.locator('#menu-dialog').is_visible()
    stopped = ui.walker(page)
    page.keyboard.down('ArrowUp'); page.wait_for_timeout(160); page.keyboard.up('ArrowUp')
    ui.assert_stopped(page, stopped)
    page.keyboard.press('Tab')
    assert page.evaluate('document.activeElement?.closest("#menu-dialog")!==null')
    rendered_chart(page, ['depot'], [], [])
    page.keyboard.press('Escape')
    assert page.locator('#menu-dialog').is_hidden()
    assert ui.state(page)['inventory'] == ui.EMPTY
    ui.protected_storage(page)
    assert not errors and not writes and not external, (errors, writes, external)
    context.close()
    return {'passed': True, 'escapePausesHeldMovement': True,
            'pauseKeysDoNotMovePlayer': True, 'tabStaysInsidePause': True, 'errors': []}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with ui.sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'
            result = {'discovery': discovery_flow(browser, url),
                      'pauseMovement': pause_stops_walking(browser, url)}
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'passed': True, 'visitedOnlyGraph': True, 'actualTraversedEdges': True,
                          'knownHintsOnly': True, 'historySeparateFromRunNotes': True,
                          'noPrematureUltimateAchievement': True, 'errors': []}), flush=True)
    finally:
        server.shutdown()


if __name__ == '__main__': main()
