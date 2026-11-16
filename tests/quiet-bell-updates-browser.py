"""Cache-safe release loading through a real HTTP cache and the actual game.

The fixture keeps serving an old launcher while its release manifest changes.
Transport-only release markers distinguish two otherwise identical game builds.
No Playwright routing is used: it would disable Chromium's HTTP cache.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlparse, parse_qs
import json
import mimetypes
import re
import time

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / 'games/rhythm-blocks'
OUT = ROOT / 'work/updates'
PREFIX = '/testkitchen/'
GAME_PATH = PREFIX + 'games/rhythm-blocks/'
OLD = 'r-1111111111111111'
NEW = 'r-2222222222222222'
RUN_KEY = 'codaQuietBellPageOneV1'
JOURNEY_KEY = 'codaQuietBellJourneyV1'
SEEDS = {
    RUN_KEY: json.dumps({
        'version': 2,
        'actions': [{'type': 'claim', 'sourceId': 'nell-parcel'},
                    {'type': 'claim', 'sourceId': 'depot-chest'}],
        'phrase': ['half'], 'selectedDoor': 'canal', 'discoveredRoutes': ['garden'],
        'roomPosition': {'x': 1286, 'y': 330, 'facing': 'up'},
        'conversation': {'person': 'nell', 'topic': 'route'},
    }),
    JOURNEY_KEY: json.dumps({
        'version': 1, 'nodes': ['depot', 'garden-porch'], 'edges': ['depot-garden'],
        'hints': ['nell-route'], 'outcomes': [],
    }),
    'codaNotesWalletV1': '{"fixture":"preserve-wallet","notes":23}',
    'musicArcadeV1': '{"fixture":"preserve-player"}',
}


class Fixture(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self):
        super().__init__(('127.0.0.1', 0), Handler)
        manifest = json.loads((GAME / 'release.json').read_text())
        self.version = manifest['version']
        self.bundle = GAME / 'releases' / self.version
        assert self.bundle.is_dir(), self.bundle
        self.launcher = (GAME / 'index.html').read_text().replace(self.version, OLD)
        self.reset()

    def reset(self, mode='valid', version=OLD, latest='valid', fallback='valid'):
        self.mode, self.latest_version = mode, version
        self.latest, self.fallback = latest, fallback
        self.requests = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def respond(self, body, mime='text/html; charset=utf-8', status=200, immutable=False):
        raw = body.encode() if isinstance(body, str) else body
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'public, max-age=31536000, immutable' if immutable else 'no-store')
        self.end_headers()
        try:
            self.wfile.write(raw)
        except (BrokenPipeError, ConnectionResetError):
            pass  # Expected when the launcher aborts a timed-out request.

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        server = self.server
        server.requests.append({'path': path, 'query': parsed.query,
                                'cacheControl': self.headers.get('Cache-Control', '')})
        if path == '/favicon.ico':
            return self.respond('', status=204)
        if path in [GAME_PATH, GAME_PATH + 'index.html']:
            # Intentionally stale HTML, even after publication of NEW.
            return self.respond(server.launcher, immutable=True)
        if path == GAME_PATH + 'release.json':
            if server.mode == 'timeout':
                time.sleep(3)
            if server.mode in ['missing', 'network']:
                return self.respond('Unavailable', status=404 if server.mode == 'missing' else 503)
            if server.mode == 'malformed':
                return self.respond('{ not json', 'application/json')
            payload = {'schemaVersion': 1, 'version': server.latest_version}
            if server.mode == 'schema':
                payload['schemaVersion'] = 99
            if server.mode == 'entry':
                # Unknown URL fields must not become a navigation target.
                payload.update({'entry': 'https://untrusted.invalid/game.html',
                                'url': 'https://untrusted.invalid/'})
            return self.respond(json.dumps(payload), 'application/json')
        match = re.fullmatch(re.escape(GAME_PATH) + r'releases/(r-[a-f0-9]{16})/(.+)', path)
        if match:
            version, relative = match.groups()
            if version not in [OLD, NEW]:
                return self.respond('Unknown fixture release', status=404)
            disposition = server.fallback if version == OLD else server.latest
            if disposition == 'missing':
                return self.respond('Release unavailable', status=404)
            file = (server.bundle / relative).resolve()
            if not file.is_relative_to(server.bundle.resolve()) or not file.is_file():
                return self.respond('Missing release resource', status=404)
            raw = file.read_bytes()
            if relative == 'index.html':
                raw = raw.replace(server.version.encode(), version.encode())
                if disposition == 'marker':
                    raw = raw.replace(version.encode(), b'r-3333333333333333')
            elif relative == 'app.mjs':
                raw = ("globalThis.__quietBellReleaseStarts=(globalThis.__quietBellReleaseStarts||0)+1;"
                       "globalThis.__quietBellFixtureRelease=" + json.dumps(version) + ';\n').encode() + raw
            return self.respond(raw, mimetypes.guess_type(str(file))[0] or 'application/octet-stream', immutable=True)
        return self.respond('Outside fixture package', status=404)


def new_page(browser, server):
    context = browser.new_context(viewport={'width': 1024, 'height': 768})
    context.add_init_script('''for(const[key,value]of Object.entries(''' + json.dumps(SEEDS) + '''))
        if(localStorage.getItem(key)===null)localStorage.setItem(key,value);''')
    page = context.new_page()
    page.set_default_timeout(12000)
    errors, urls = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: urls.append(request.url))
    origin = f'http://127.0.0.1:{server.server_port}'
    return context, page, origin, errors, urls


def ready(page, origin, expected):
    page.wait_for_function('!!window.quietBell?.state')
    page.wait_for_function('[...document.images].every(image=>image.complete&&image.naturalWidth>0)')
    assert page.url == origin + GAME_PATH + '?v=quiet-bell-journey-1', page.url
    assert page.evaluate('window.__quietBellFixtureRelease') == expected
    assert page.evaluate('window.__quietBellReleaseStarts') == 1
    assert page.evaluate('document.baseURI') == origin + GAME_PATH + 'releases/' + expected + '/'
    state = page.evaluate('quietBell.state')
    assert state['phase'] == 'room' and state['phrase'] == ['half']
    assert state['selectedDoor'] == 'canal' and sum(state['inventory'].values()) == 9
    assert set(state['claimedSources']) == {'nell-parcel', 'depot-chest'}
    journal = page.evaluate('quietBell.journey')
    assert [node['id'] for node in journal['nodes']] == ['depot', 'garden-porch']
    assert [edge['id'] for edge in journal['edges']] == ['depot-garden']
    assert [hint['id'] for hint in journal['hints']] == ['nell-route']
    assert page.evaluate('keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(SEEDS)) == SEEDS
    page.locator('#menu').click()
    assert page.locator('#exit').evaluate('a=>new URL(a.href).pathname') == PREFIX + 'world-preview.html'
    page.locator('#menu-close').click()


def assert_requests_local(urls, origin):
    assert all(url.startswith(origin + '/') or url.startswith('data:') for url in urls), urls


def update_cached_game(browser, server):
    server.reset()
    context, page, origin, errors, urls = new_page(browser, server)
    page.goto(origin + GAME_PATH + '?v=quiet-bell-journey-1')
    ready(page, origin, OLD)
    before = page.evaluate('quietBell.state')
    first_checks = [r['query'] for r in server.requests if r['path'].endswith('/release.json')]
    assert len(first_checks) == 1 and parse_qs(first_checks[0]).get('check'), first_checks
    server.latest_version = NEW
    page.wait_for_timeout(180)
    assert page.evaluate('window.__quietBellFixtureRelease') == OLD
    assert page.evaluate('quietBell.state') == before, 'Publishing must not replace an active puzzle.'
    assert len([r for r in server.requests if r['path'].endswith('/release.json')]) == 1
    server.requests.clear()
    urls.clear()
    page.reload()
    ready(page, origin, NEW)
    runtime = [urlparse(url).path for url in urls if urlparse(url).path.endswith(('.mjs', '.css', '.jpg', '.webp'))]
    assert runtime and all(path.startswith(GAME_PATH + 'releases/' + NEW + '/') for path in runtime), runtime
    checks = [r for r in server.requests if r['path'].endswith('/release.json')]
    assert len(checks) == 1 and checks[0]['query'] != first_checks[0], checks
    assert not errors, errors
    assert_requests_local(urls, origin)
    page.screenshot(path=str(OUT / 'updated-game-preserves-save.png'))
    context.close()
    return {'passed': True, 'staleLauncherAndOldQueryUpgrade': True, 'immutableRuntimeRequests': len(runtime),
            'sameAddressAndSaves': True, 'activePuzzleNotInterrupted': True, 'startsOnce': True}


def fallback_case(browser, server, mode, version=NEW, latest='valid', expected=OLD):
    server.reset(mode=mode, version=version, latest=latest)
    context, page, origin, errors, urls = new_page(browser, server)
    start = time.monotonic()
    page.goto(origin + GAME_PATH + '?v=quiet-bell-journey-1')
    ready(page, origin, expected)
    elapsed = time.monotonic() - start
    attempts = [r['path'] for r in server.requests if r['path'].endswith('/index.html') and '/releases/' in r['path']]
    assert 1 <= len(attempts) <= 2, attempts
    assert len([r for r in server.requests if r['path'].endswith('/release.json')]) == 1
    assert elapsed < 9, elapsed
    assert not errors, errors
    assert_requests_local(urls, origin)
    context.close()
    return {'mode': mode, 'latest': latest, 'version': version, 'expected': expected,
            'passed': True, 'htmlAttempts': len(attempts), 'seconds': round(elapsed, 2)}


def total_failure_recovers(browser, server):
    server.reset(version=NEW, latest='missing', fallback='missing')
    context, page, origin, errors, urls = new_page(browser, server)
    page.goto(origin + GAME_PATH + '?v=quiet-bell-journey-1')
    retry = page.locator('#quiet-bell-launch-retry')
    retry.wait_for(state='visible')
    assert not page.evaluate('!!window.quietBell')
    attempts = [r for r in server.requests if r['path'].endswith('/index.html') and '/releases/' in r['path']]
    assert len(attempts) == 2, attempts
    assert page.evaluate('key=>localStorage.getItem(key)', RUN_KEY) == SEEDS[RUN_KEY]
    server.latest = 'valid'
    retry.click()
    ready(page, origin, NEW)
    assert not errors, errors
    assert_requests_local(urls, origin)
    context.close()
    return {'passed': True, 'boundedAttempts': True, 'visibleRetry': True, 'retryRecoversWithoutLostSave': True}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = Fixture()
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            results = {'cachedUpdate': update_cached_game(browser, server), 'fallbacks': []}
            for mode in ['malformed', 'schema', 'missing', 'network', 'timeout']:
                results['fallbacks'].append(fallback_case(browser, server, mode))
            for version in ['https://untrusted.invalid/', '../outside', 'r-' + 'a' * 15, 'r-' + 'A' * 16]:
                results['fallbacks'].append(fallback_case(browser, server, 'valid', version=version))
            results['fallbacks'].append(fallback_case(browser, server, 'entry', expected=NEW))
            for disposition in ['missing', 'marker']:
                results['fallbacks'].append(fallback_case(browser, server, 'valid', latest=disposition))
            results['unavailableRelease'] = total_failure_recovers(browser, server)
            browser.close()
        (OUT / 'browser-results.json').write_text(json.dumps(results, indent=2) + '\n')
        print(json.dumps({'passed': True, 'cachedUpdate': True, 'sameAddressAndSaves': True,
                          'fallbackCases': len(results['fallbacks']), 'retryRecovery': True}), flush=True)
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
