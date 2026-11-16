"""Resolved developer integration edges, exercised through the actual editor.

Only read-only game snapshots are inspected. Projects enter through the file
picker, testing commands use their buttons, and characters move by real drag.
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
OUT = ROOT / 'work/developer-edges'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('quiet_bell_developer_ui', ROOT / 'tests/quiet-bell-developer-browser.py')
dev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dev)
ui = dev.ui
DEV_RUN = 'codaQuietBellDeveloperRunV1'


def snapshot_project(page):
    return page.evaluate('quietBell.project')


def apply_project(page, project):
    dev.console_open(page)
    dev.import_project(page, project, 'edge-project.json')
    assert page.locator('#developer-errors').is_hidden(), page.locator('#developer-errors').inner_text()
    page.locator('#developer-apply').click()
    page.locator('#developer-console').wait_for(state='hidden')
    dev.tick(page)
    assert ui.state(page)['developerMode']


def reload_game(page):
    page.reload()
    page.wait_for_function('!!window.quietBell?.state')
    dev.tick(page)


def same_point(before, after):
    assert math.hypot(before['x'] - after['x'], before['y'] - after['y']) < 1, (before, after)


def actor_parts(project, actor_id='nell'):
    scene = project['scenes']['depot']
    return {
        'actor': next(item for item in scene['actors'] if item['id'] == actor_id),
        'target': next(item for item in scene['geometry']['targets'] if item['id'] == actor_id),
        'object': next(item for item in scene['objects'] if item['id'] == actor_id),
        'obstacle': next(item for item in scene['geometry']['obstacles'] if item['id'] == actor_id),
    }


def edge_flow(browser, url):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light')
    release = page.evaluate('document.baseURI')
    base = snapshot_project(page)
    ui.press(page, '[data-person="nell"]')
    page.locator('#take-parcel').click()
    ui.close_panels(page)
    published = dev.normal_storage(page)

    # A previous sandbox must be replaced immediately by Apply, before a walk or
    # interaction supplies another save opportunity.
    project_a = deepcopy(base)
    project_a['settings']['title'] = 'Applied Project A'
    project_a['settings']['initialInventory'] = {kind: 0 for kind in ui.KINDS}
    project_a['settings']['initialInventory'].update(quarter=2, half=1)
    apply_project(page, project_a)
    stock_a = project_a['settings']['initialInventory']
    assert ui.state(page)['inventory'] == stock_a
    old_stock = {kind: 0 for kind in ui.KINDS}
    old_stock['quarter'] = 19
    dev.set_stock(page, old_stock)
    dev.teleport(page, 'garden-porch')
    assert ui.state(page)['inventory'] == old_stock
    apply_project(page, project_a)
    immediate = page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', DEV_RUN)
    assert immediate['actions'] == [] and immediate['roomId'] == 'depot', immediate
    reload_game(page)
    assert ui.state(page)['roomId'] == 'depot' and ui.state(page)['inventory'] == stock_a
    assert snapshot_project(page)['settings']['title'] == 'Applied Project A'
    assert dev.normal_storage(page) == published

    # Saving a different draft does not replace the applied definition or cause
    # its action log to be replayed using unapplied supplies after reload.
    project_b = deepcopy(project_a)
    project_b['settings']['title'] = 'Saved Draft B'
    project_b['settings']['initialInventory']['quarter'] = 7
    nell = next(person for person in project_b['content']['depot']['people'] if person['id'] == 'nell')
    nell['intro'] = 'This belongs to draft B, not the running project.'
    dev.console_open(page)
    dev.import_project(page, project_b, 'saved-draft-b.json')
    page.locator('#developer-save').click()
    dev.tick(page)
    assert snapshot_project(page)['settings']['title'] == 'Applied Project A'
    reload_game(page)
    assert ui.state(page)['inventory'] == stock_a
    assert snapshot_project(page)['settings']['title'] == 'Applied Project A'
    dev.console_open(page)
    dev.select_entity(page, 'depot', 'person', 'nell')
    assert page.locator('#developer-intro').input_value() == nell['intro']
    draft = dev.export_project(page, 'edge-saved-draft-b')
    assert draft['settings']['title'] == 'Saved Draft B'
    assert draft['settings']['initialInventory']['quarter'] == 7
    assert dev.normal_storage(page) == published

    # The actual frozen map, not a miniature or a mutable hook, moves the NPC.
    # Dragging synchronizes feet, approach, hit rectangle and collision. Undo
    # restores them together while Mira stays still.
    before = actor_parts(draft)
    frozen = ui.walker(page)
    button = page.locator('#room-map [data-person="nell"]')
    box = button.bounding_box()
    map_box = page.locator('#room-map').bounding_box()
    scale = map_box['width'] / draft['scenes']['depot']['geometry']['width']
    dx, dy = 60, 40
    start_x, start_y = box['x'] + box['width']/2, box['y'] + box['height']/2
    page.mouse.move(start_x, start_y)
    page.mouse.down()
    page.mouse.move(start_x + dx*scale, start_y + dy*scale, steps=8)
    page.mouse.up()
    dev.tick(page)
    same_point(frozen, ui.walker(page))
    moved_project = dev.export_project(page, 'edge-actor-drag')
    after = actor_parts(moved_project)
    for key in ['x', 'y']:
        delta = dx if key == 'x' else dy
        assert after['actor']['feet'][key] == before['actor']['feet'][key] + delta, (before, after)
        assert after['target'][key] == before['target'][key] + delta
        assert after['target']['approach'][key] == before['target']['approach'][key] + delta
        assert after['object']['rect'][key] == before['object']['rect'][key] + delta
        assert after['obstacle'][key] == before['obstacle'][key] + delta
    dev.project_tools(page)
    page.locator('#developer-undo').click()
    dev.close_tools(page)
    undone = dev.export_project(page, 'edge-actor-drag-undo')
    assert actor_parts(undone) == before
    same_point(frozen, ui.walker(page))
    assert dev.normal_storage(page) == published

    # Canonical-only copy and a canonical world target remain a playable alias.
    # A real authored ending must not be mislabeled as a continuation preview.
    project_c = deepcopy(base)
    project_c['settings']['title'] = 'Canonical Ending Project'
    project_c['settings']['initialInventory'] = {kind: int(kind == 'quarter') for kind in ui.KINDS}
    project_c['doors']['garden'].update(recipe=['quarter'], to='dead-brambles')
    project_c['terminals']['dead-brambles'].update(kind='ending', title='The Authored Bell Ending')
    del project_c['content']['depot']['doorCopy']['garden']
    project_c['content']['depot']['doorCopy']['depot-garden'].update(
        name='The canary door', hint='One quarter note.',
        deadCopy='The bell answers with the authored ending.',
        previewCopy='THIS PREVIEW TEXT MUST NOT APPEAR', repair='')
    scene = project_c['scenes']['depot']
    obj = next(item for item in scene['objects'] if item['id'] == 'garden')
    obj.update(id='depot-garden', doorId='depot-garden')
    target = next(item for item in scene['geometry']['targets'] if item['id'] == 'garden')
    target['id'] = 'depot-garden'
    apply_project(page, project_c)
    page.locator('#room-map [data-door="depot-garden"]').focus()
    page.keyboard.press('Enter')
    ui.settle_walk(page)
    page.locator('#notes-dialog').wait_for(state='visible')
    assert ui.state(page)['selectedDoor'] == 'garden'
    assert page.locator('#door-title').inner_text() == 'The canary door'
    assert 'One quarter note.' in page.locator('#door-hint').inner_text()
    page.locator(ui.tile('quarter')).click()
    assert ui.state(page)['canCommit'] and ui.state(page)['targetBeats'] == 1
    page.locator('#commit').click()
    page.locator('#outcome').wait_for(state='visible')
    assert page.locator('#outcome-kicker').inner_text() == 'An ending'
    assert page.locator('#outcome-title').inner_text() == 'The Authored Bell Ending'
    assert page.locator('#outcome-copy').inner_text() == 'The bell answers with the authored ending.'
    assert 'THIS PREVIEW TEXT' not in page.locator('#outcome').inner_text()
    assert [item['id'] for item in page.evaluate('quietBell.journey.outcomes')] == ['dead-brambles']
    reload_game(page)
    assert page.locator('#outcome-kicker').inner_text() == 'An ending'
    assert [item['id'] for item in page.evaluate('quietBell.journey.outcomes')] == ['dead-brambles']
    assert dev.normal_storage(page) == published
    assert not errors and not writes and not external, (errors, writes, external)
    page.screenshot(path=str(OUT / 'canonical-authored-ending.png'))
    context.close()
    return {'passed': True, 'releaseBase': release, 'freshApplyImmediatelySaved': True,
            'savedDraftSeparateFromAppliedProject': True, 'canonicalCopyAndWorldTargetPlayable': True,
            'authoredEndingLabeledAndRecorded': True, 'actualMapDragAndUndo': True,
            'actorTargetHitboxCollisionMoveTogether': True, 'mapFrozenWhileDragging': True,
            'publishedRunBytePreserved': True, 'errors': []}


def main():
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with ui.sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if '--source' in sys.argv else '')
            result = edge_flow(browser, url)
            browser.close()
        suffix = 'source' if '--source' in sys.argv else 'release'
        (OUT / ('browser-results-' + suffix + '.json')).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2))
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
