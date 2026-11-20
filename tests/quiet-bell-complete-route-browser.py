"""All eleven recorded outcomes unlock a real, twelve-beat final journey.

Only durable journal fixtures are seeded. Notes, failed runs, restarts, locks,
conversations and the final ending use ordinary published controls; quietBell
snapshots and imported geometry are read-only diagnostics.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/complete-route-browser'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('complete_route_risk', ROOT / 'tests/quiet-bell-replay-risk-browser.py')
risk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(risk)
ui, cs, npc, paths = risk.ui, risk.cs, risk.npc, risk.paths
JOURNEY = 'codaQuietBellJourneyV1'
DEV_JOURNEY = 'codaQuietBellDeveloperJourneyV1'
UNLOCK_HINT = 'final-route-open'
OUTCOMES = [
    'ending-home', 'ending-school', 'ending-public', 'ending-secret-quiet',
    'ending-secret-birds', 'dead-ferry', 'failure-dead-brambles',
    'failure-dead-aviary', 'failure-garden-secret-final',
    'failure-workshop-secret-final', 'failure-canal-final',
]
FAILURE_ROOMS = ['dead-brambles', 'dead-aviary', 'garden-secret-final',
                 'workshop-secret-final', 'canal-final']
FINAL_ROOMS = ['final-concourse', 'final-heart', 'ending-complete']
FINAL_GATES = [
    ('final-route', 'depot-final-route', 'final-concourse', ['half', 'quarter', 'eighth-pair']),
    ('concourse-heart', 'concourse-heart', 'final-heart', ['dotted-half', 'sixteenth-group']),
    ('heart-complete', 'heart-complete', 'ending-complete', ['eighth', 'sixteenth-pair', 'half-rest', 'quarter-rest']),
]


def fixture(outcomes=(), hints=(), nodes=('depot',)):
    return {'version': 1, 'nodes': list(nodes), 'edges': [],
            'hints': list(hints), 'outcomes': list(outcomes)}


class JournalBrowser:
    """Seed accepted saved discovery IDs once, without changing a running game."""
    def __init__(self, browser, normal=None, developer=None):
        self.browser = browser
        self.seeds = {key: json.dumps(value) for key, value in
                      [(JOURNEY, normal), (DEV_JOURNEY, developer)] if value is not None}

    def new_context(self, **options):
        context = self.browser.new_context(**options)
        if self.seeds:
            context.add_init_script('''for(const[key,value]of Object.entries(''' + json.dumps(self.seeds) + '''))
              if(localStorage.getItem(key)===null)localStorage.setItem(key,value);''')
        return context


def open_run(browser, url, expected, normal=None, developer=None, width=1024, reduced=False):
    context, page, errors, writes, external = ui.open_page(
        JournalBrowser(browser, normal, developer), url, width, 'dark',
        reduced_motion='reduce' if reduced else 'no-preference')
    base = paths.validate_release(page, expected)
    assert ui.state(page)['replayRisk'] is True
    assert not ui.state(page)['developerMode']
    return context, page, risk.RiskUI(page), base, errors, writes, external


def ready(page):
    # HTTP decode can lag behind naturalWidth becoming nonzero.
    page.wait_for_function('[...document.images].every(image=>image.complete&&image.naturalWidth>0)')


def progress(page):
    return page.evaluate('quietBell.finalRoute')


def portal(page, unlocked):
    value = progress(page)
    assert value and value['total'] == 11 and value['unlocked'] is unlocked, value
    assert value['found'] == 11 - len(value['missingOutcomeIds']), value
    entry = page.evaluate('quietBell.project.doors["final-route"]')
    assert entry and entry['canonicalId'] == 'depot-final-route'
    assert set(entry['requiresProgress']['outcomes']) == set(OUTCOMES)
    button = page.locator('[data-door="final-route"]')
    assert bool(button.count()) is unlocked, (unlocked, value)
    assert bool(page.locator('.mg-final-route-mark').count()) is unlocked, (unlocked, value)
    hidden = ui.state(page).get('hiddenDoorIds', [])
    assert ('final-route' in hidden) is not unlocked, hidden
    return value


def chart_has_no_final_rooms(page, game):
    game.close(); game.press('#menu')
    nodes = set(page.locator('[data-journey-node]').evaluate_all('es=>es.map(e=>e.dataset.journeyNode)'))
    edges = set(page.locator('[data-journey-edge]').evaluate_all('es=>es.map(e=>e.dataset.journeyEdge)'))
    assert not nodes.intersection(FINAL_ROOMS), nodes
    assert not edges.intersection(gate[1] for gate in FINAL_GATES), edges
    assert not risk.ids(risk.journal(page)['achievements']), 'Unlocking the route is not completing the full chart.'
    game.close()


def finish(context, page, errors, writes, external):
    npc.safe(page, errors, writes, external)
    context.close()


def locked_matrix(browser, url, expected):
    cases = []
    # A fresh save and every possible 10/11 set remain locked, including secrets
    # and failed runs. Outcome receipts alone never reveal unvisited chart nodes.
    for missing in [None, *OUTCOMES]:
        earned = [] if missing is None else [id for id in OUTCOMES if id != missing]
        context, page, game, base, errors, writes, external = open_run(
            browser, url, expected, normal=fixture(earned))
        value = portal(page, False)
        assert value['found'] == len(earned), (missing, value)
        assert set(value['missingOutcomeIds']) == set(OUTCOMES) - set(earned)
        assert UNLOCK_HINT not in risk.ids(risk.journal(page)['hints'])
        assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['actions'] == []
        chart_has_no_final_rooms(page, game)
        cases.append({'missing': missing or 'all', 'found': value['found']})
        finish(context, page, errors, writes, external)
    return {'releaseBase': base, 'everyMissingOutcomeBlocksEntry': cases,
            'unseenChartAndInventoryUntouched': True}


def legacy_and_visits(browser, url, expected):
    results = {}
    static = [id for id in OUTCOMES if not id.startswith('failure-')]
    for label, saved, unlocked in [
        ('legacyFailures', fixture(static, ['lesson-' + room for room in FAILURE_ROOMS]), True),
        ('visitedFailures', fixture(static, nodes=['depot', *FAILURE_ROOMS]), False),
        ('visitedEndings', fixture(nodes=['depot', *static, *FAILURE_ROOMS]), False),
    ]:
        context, page, game, base, errors, writes, external = open_run(browser, url, expected, normal=saved)
        value = portal(page, unlocked)
        if unlocked:
            assert set(OUTCOMES) <= risk.ids(risk.journal(page)['outcomes'])
            assert UNLOCK_HINT in risk.ids(risk.journal(page)['hints'])
            stored = page.evaluate('key=>JSON.parse(localStorage.getItem(key))', JOURNEY)
            assert set(OUTCOMES) <= set(stored['outcomes'])
            page.reload(); page.wait_for_function('!!window.quietBell?.state')
            ui.skip_intro(page); ui.skip_cutscene(page); ready(page)
            assert portal(page, True)['found'] == 11
        else:
            assert not risk.ids(risk.journal(page)['outcomes']) - set(static)
            assert UNLOCK_HINT not in risk.ids(risk.journal(page)['hints'])
        assert ui.state(page)['inventory'] == ui.EMPTY and ui.state(page)['actions'] == []
        results[label] = value
        finish(context, page, errors, writes, external)
    return {'releaseBase': base, 'cases': results,
            'legacyEvidenceMigratesAndSaves': True, 'visitsNeverPretendToBeOutcomes': True}


def scene_after_payment(page, game, identifier, destination, recipe, play_story=False):
    door = game.select(identifier)
    assert door['to'] == destination and door['recipe'] == recipe, door
    before = risk.durable(page)
    game.draft(recipe)
    assert page.locator('#commit').is_enabled()
    game.press('#commit')
    value = ui.state(page)
    assert value['roomId'] == destination and not value['canRevisit'], value
    expected = dict(before['inventory'])
    for kind in recipe: expected[kind] -= 1
    assert value['inventory'] == expected and len(value['actions']) == len(before['actions']) + 1
    assert len(value['claimedSources']) == 2 and set(value['claimedSources']) == {'nell-parcel', 'depot-chest'}
    ready(page)
    scene = page.evaluate('quietBell.cutscene')
    assert scene and scene['phase'] == 'narration', scene
    narration = scene['narration']['text']
    assert narration == game.project['content'][destination]['narration'] and len(narration.split()) >= 8
    assert {'mira', 'nell', 'iris', 'pip'} <= {actor['id'] for actor in scene['actors']}
    if play_story:
        cs.wait_for_story(page)
        speakers, lines = set(), set()
        for _ in range(900):
            scene = page.evaluate('quietBell.cutscene')
            if not scene or scene.get('finished'): break
            if scene.get('beat'):
                speakers.add(scene['beat'].get('speaker'))
                if scene['beat'].get('text'): lines.add(scene['beat']['text'])
                if page.locator('#cutscene-next').is_enabled():
                    page.locator('#cutscene-next').click()
            game.advance(100)
        assert not page.evaluate('quietBell.cutscene')
        assert {'mira', 'nell', 'iris', 'pip'} <= speakers, speakers
        assert len(lines) >= 6, lines
    else:
        ui.skip_cutscene(page); game.advance()
    ready(page)
    assert {'nell', 'iris', 'pip'} <= set(page.locator('[data-person]').evaluate_all('es=>es.map(e=>e.dataset.person)'))
    assert page.locator('#player-sprite').is_visible()
    art = page.locator('.mg-art').evaluate('e=>({src:e.src,width:e.naturalWidth,height:e.naturalHeight})')
    assert art['width'] == 1536 and art['height'] == 1024, art
    assert destination + '.webp' in art['src'], art
    ui.layout(page, game.touch)
    return {'room': destination, 'art': art['src'], 'narration': narration,
            'allFourPartyCharacters': True, 'exactFourBeatDebit': True}


def complete_journey(page, game, width, reduced=False, play_story=False):
    assert portal(page, True)['found'] == 11
    assert ui.state(page)['inventory'] == ui.EMPTY, 'Meta progress never supplies notes.'
    game.start_notes()
    records, images = [], set()
    for identifier, canonical, destination, recipe in FINAL_GATES:
        record = scene_after_payment(page, game, identifier, destination, recipe, play_story)
        images.add(record['art']); records.append(record)
        assert canonical in risk.ids(risk.journal(page)['edges'])
        if destination != 'ending-complete':
            game.press('[data-person="nell"]')
            assert ui.conversation_text(page).strip()
            npc.frame_style(page, 'nell')
            npc.reveal(page)
            page.screenshot(path=str(OUT / f'{destination}-dialogue-{width}-{reduced}.png'))
            game.close()
        page.screenshot(path=str(OUT / f'{destination}-{width}-{reduced}.png'))
    value = ui.state(page)
    assert value['phase'] == 'terminal' and value['runStatus'] == 'completed' and value['failure'] is None
    assert value['inventory'] == ui.EMPTY and len(value['actions']) == 5
    assert 'ending-complete' in risk.ids(risk.journal(page)['outcomes'])
    assert len(images) == 3, 'The final rooms have three distinct backgrounds.'
    game.press('#ending')
    assert page.locator('#outcome').is_visible()
    copy = page.locator('#outcome-copy').inner_text().lower()
    assert all(word in copy for word in ['bell', 'bird', 'water', 'deliver']), copy
    assert 'music room' in copy or 'classroom' in copy, copy
    assert 'iris' in copy and ('friend' in copy or 'tavi' in copy), copy
    ui.layout(page, game.touch)
    page.screenshot(path=str(OUT / f'complete-ending-{width}-{reduced}.png'))
    return {'rooms': records, 'allStartingNotesUsed': True, 'noRefundsOrMetaGrants': True,
            'combinedEnding': copy, 'uniqueBackgrounds': len(images)}


def earned_last_failure(browser, url, expected):
    missing = 'failure-canal-final'
    context, page, game, base, errors, writes, external = open_run(
        browser, url, expected, normal=fixture([id for id in OUTCOMES if id != missing]))
    portal(page, False); game.start_notes()
    game.pay('canal'); game.press('[data-chest="canal-chest"]')
    game.pay('canal-porch-forward'); game.pay('canal-dead'); game.pay('echo-return-gate')
    game.failure('out-of-notes')
    learned = risk.journal(page)
    assert missing in risk.ids(learned['outcomes']) and UNLOCK_HINT in risk.ids(learned['hints'])
    assert sum(hint['id'] == UNLOCK_HINT for hint in learned['hints']) == 1
    assert progress(page)['unlocked'] and risk.total(page) == 0
    game.close(); game.press('#menu')
    if not page.locator('#journey-hints-section').evaluate('e=>e.open'):
        game.press('#journey-hints-section > summary')
    assert page.locator('#journey-hints').inner_text().strip()
    assert 'depot' in page.locator('#journey-hints').inner_text().lower()
    assert not page.locator('[data-journey-node="final-concourse"]').count()
    ready(page); ui.layout(page)
    page.screenshot(path=str(OUT / 'last-failed-outcome-unlocks-journal.png'))
    game.close(); game.restart(); portal(page, True)
    assert page.locator('#world-status').is_hidden() or page.locator('#world-status').text_content() != game.project['content']['canal-final']['arrival'], 'Restart must remove the previous room’s arrival toast.'
    assert risk.ids(risk.journal(page)['outcomes']) >= set(OUTCOMES)
    assert sum(hint['id'] == UNLOCK_HINT for hint in risk.journal(page)['hints']) == 1
    ready(page); page.screenshot(path=str(OUT / 'depot-final-portal.png'))
    journey = complete_journey(page, game, 1024, play_story=True)
    learned = risk.journal(page); game.close()
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    ui.skip_intro(page); ui.skip_cutscene(page); ready(page)
    assert ui.state(page)['roomId'] == 'ending-complete' and ui.state(page)['inventory'] == ui.EMPTY
    assert risk.ids(risk.journal(page)['outcomes']) >= risk.ids(learned['outcomes'])
    game.restart(); assert portal(page, True)['found'] == 11
    assert ui.state(page)['inventory'] == ui.EMPTY
    assert 'ending-complete' in risk.ids(risk.journal(page)['outcomes'])
    finish(context, page, errors, writes, external)
    return {'releaseBase': base, 'lastFailedRunUnlocksOnce': True,
            'restartAndReloadKeepLearnedOutcomes': True, 'playthrough': journey}


def phone_flow(browser, url, expected, width=390, reduced=False):
    context, page, game, base, errors, writes, external = open_run(
        browser, url, expected, normal=fixture(OUTCOMES), width=width, reduced=reduced)
    chart_has_no_final_rooms(page, game)
    result = complete_journey(page, game, width, reduced)
    finish(context, page, errors, writes, external)
    return {'releaseBase': base, 'width': width, 'reducedMotion': reduced, **result}


def developer_isolation(browser, url, expected):
    context, page, game, base, errors, writes, external = open_run(
        browser, url, expected, normal=fixture(OUTCOMES[:-1]), developer=fixture(OUTCOMES))
    portal(page, False)
    original = cs.normal_storage(page)
    # Resume the separate saved playtest; starting a new developer playtest
    # intentionally starts a fresh journal, so it cannot test this receipt.
    page.evaluate('localStorage.setItem("codaQuietBellDeveloperActiveV1","on")')
    page.reload(); page.wait_for_function('!!window.quietBell?.state')
    ui.skip_intro(page); ui.skip_cutscene(page); game.advance(); ready(page)
    assert ui.state(page)['developerMode'] and portal(page, True)['found'] == 11
    assert cs.normal_storage(page) == original, 'Developer discoveries cannot modify the ordinary journal.'
    page.locator('#developer-end').click(); game.advance(); ui.skip_cutscene(page)
    assert not ui.state(page)['developerMode'] and portal(page, False)['found'] == 10
    assert cs.normal_storage(page) == original
    # Conversely, a fresh developer test must not borrow ordinary achievements.
    page.keyboard.press('F2'); page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-room="depot"]').click()
    page.locator('[data-dev-tab="playtest"]').click()
    page.locator('#developer-start-playtest').click()
    page.locator('#developer-console').wait_for(state='hidden')
    ui.skip_cutscene(page); game.advance()
    assert ui.state(page)['developerMode'] and portal(page, False)['found'] == 0
    assert cs.normal_storage(page) == original
    page.locator('#developer-end').click(); game.advance(); ui.skip_cutscene(page)
    assert not ui.state(page)['developerMode'] and portal(page, False)['found'] == 10
    finish(context, page, errors, writes, external)
    return {'releaseBase': base, 'developerJournalUnlocksOnlyItsOwnPlaytest': True,
            'normalRunAndJournalBytesPreserved': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true')
    parser.add_argument('--url'); parser.add_argument('--expect-release')
    parser.add_argument('--case', choices=['all', 'locks', 'legacy', 'earned', 'phone', 'small', 'developer'], default='all')
    args = parser.parse_args(); server = None; started = time.monotonic()
    if args.url: url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            runner = cs.PublicBrowser(browser) if args.url else browser
            result = {'passed': True, 'entry': url}
            flows = [('locks', locked_matrix), ('legacy', legacy_and_visits),
                     ('earned', earned_last_failure), ('phone', phone_flow),
                     ('small', lambda b, u, e: phone_flow(b, u, e, 320, True)),
                     ('developer', developer_isolation)]
            for label, flow in flows:
                if args.case in ['all', label]: result[label] = flow(runner, url, args.expect_release)
            browser.close()
        result['seconds'] = round(time.monotonic() - started, 1)
        name = 'public' if args.url else 'source' if args.source else 'launcher'
        suffix = '' if args.case == 'all' else '-' + args.case
        (OUT / (name + suffix + '-results.json')).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result, indent=2), flush=True)
    finally:
        if server: server.shutdown()


if __name__ == '__main__': main()
