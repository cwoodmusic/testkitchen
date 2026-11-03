"""Exercise the unchanged cabinet below Test Kitchen's real GitHub Pages prefix.

Run: python3 games/pitch-race/tests/bundled-prefix-browser.py
Existing control and multiplayer cases retain their in-memory SDK doubles. All
network traffic is routed locally; no live Firebase account or room is touched.
"""
import importlib.util
import mimetypes
import os
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True
APP_ROOT = Path(__file__).resolve().parents[3]
os.environ.setdefault('CODA_ARCADE_ROOT', str(APP_ROOT))
from pitch_browser_support import PitchBrowserCase, FIXTURE, ORIGIN, ROOT

APP_PATH = '/testkitchen/'
GAME_PATH = APP_PATH + 'games/pitch-race/'
GAME_URL = ORIGIN + GAME_PATH
HOST_PATH = APP_PATH + 'pitch-multiplayer-fixture.html'


def source_cases(name):
    spec = importlib.util.spec_from_file_location('bundled_' + name.replace('-', '_'),
        Path(__file__).with_name(name + '-browser.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_multiplayer = source_cases('classroom-multiplayer')
_multiplayer.HOST = ORIGIN + HOST_PATH
_lifecycle = source_cases('multiplayer-lifecycle')
_notation = source_cases('notation-tutorial')


class NestedPitchCase:
    """Route actual bundled files without changing their runtime URL handling."""
    extra_fixture = ''

    def setUp(self):
        super().setUp()
        self.local_requests = []
        self.context.on('request', lambda request: self.local_requests.append(request.url)
            if request.url.startswith(ORIGIN + '/') else None)

    def tearDown(self):
        self.assertFalse(any('/Pitch-Race/' in url or '/coda-arcade/' in url
            for url in self.local_requests), 'No request may escape to a source deployment')
        super().tearDown()

    def route_checkout(self, route):
        path = unquote(urlparse(route.request.url).path)
        if path == '/favicon.ico':
            return route.fulfill(status=204)
        if path == HOST_PATH:
            return route.fulfill(content_type='text/html', body='''<!doctype html>
<meta charset="utf-8"><script>
window.ARCADE_ACCOUNTS_CONFIG={mode:'classroom',classroom:{privacy:true,enabled:true}};
</script><iframe id="host" style="width:1400px;height:1000px" src="GAME?classroom=1"></iframe>
<iframe id="guest" style="width:1400px;height:1000px" src="GAME?classroom=1"></iframe>
'''.replace('GAME', GAME_PATH))
        if path.startswith(GAME_PATH):
            base, relative = ROOT, path.removeprefix(GAME_PATH)
        elif path.startswith(APP_PATH):
            base, relative = APP_ROOT, path.removeprefix(APP_PATH)
        else:
            self.missing.append(path)
            return route.abort()
        file = (base / (relative or 'index.html')).resolve()
        if not file.is_relative_to(base.resolve()) or not file.is_file():
            self.missing.append(path)
            return route.fulfill(status=404, body='Missing bundled resource')
        if base == ROOT and file.name == 'index.html':
            html = file.read_text()
            marker = 'initializeOnlineScores();})();'
            self.assertEqual(html.count(marker), 1)
            html = html.replace(marker, 'initializeOnlineScores();' + FIXTURE
                + self.extra_fixture + '})();')
            return route.fulfill(body=html, content_type='text/html')
        return route.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0]
            or 'application/octet-stream')

    def load_pitch(self):
        self.page.goto(GAME_URL, wait_until='domcontentloaded')
        self.page.wait_for_function('window.__pitchFixture')
        return self.page

    def load_world(self):
        self.page.goto(ORIGIN + APP_PATH + 'world-preview.html', wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')

    def seed_checkpoint(self, level):
        self.context.add_init_script('''(()=>{if(location.pathname.startsWith(PREFIX))
          localStorage.setItem('pitchRaceLevelProgressV1',
            JSON.stringify({version:1,bestCompleted:LEVEL}));})();'''
            .replace('PREFIX', repr(GAME_PATH)).replace('LEVEL', str(level)))


class BundledControlsTests(NestedPitchCase, _notation.NotationTutorialTests):
    pass


class BundledMultiplayerTests(NestedPitchCase, _multiplayer.ClassroomMultiplayerTests):
    pass


class BundledLifecycleTests(NestedPitchCase, _lifecycle.MultiplayerLifecycleTests):
    extra_fixture = _lifecycle.MULTIPLAYER_FIXTURE


class BundledParentTests(NestedPitchCase, PitchBrowserCase):
    def test_real_cabinet_reports_classic_results_once_to_nested_parent(self):
        self.load_world()
        frame = self.cabinet()
        self.assertTrue(frame.url.startswith(GAME_URL))
        self.assertTrue(frame.evaluate('CodaGamePrivacy.enabled'))
        self.start(frame, mode='classic', staff='bass')
        self.answer(frame, {'clef':'bass'}, key=True)
        self.expire(frame)
        self.page.wait_for_function('window.__messages.some(m=>m.data.type==="result")')
        report = self.reports()[-1]
        self.assertEqual(report['result']['score'], 1)
        self.assertEqual(report['result']['correct'], 1)
        self.assertEqual(report['result']['staff'], 'bass')
        self.assertEqual(frame.locator('#resultsScore').inner_text(), '1')
        self.page.wait_for_function('id=>CodaArcadeQA.progression().recent.some(e=>e.id===id)',
            arg='game:pitch:' + report['runId'])
        before = self.totals()
        frame.evaluate('report=>{CodaBridge.report(report.runId,report.result);parent.postMessage(report,location.origin);}', report)
        self.page.wait_for_timeout(100)
        self.assertEqual(self.totals(), before)
        self.assertEqual(len(self.reports()), 2, 'The raw duplicate reaches the parent but grants no second reward')
        self.assertTrue(frame.locator('#initialsOverlay').is_hidden())
        self.assertFalse(frame.evaluate('Boolean(window.firebase)'))

    def test_level_checkpoint_and_continue_survive_nested_frame_reload(self):
        self.load_world()
        frame = self.cabinet()
        self.start(frame)
        target = int(frame.locator('#challengeTarget').inner_text())
        for _ in range(target):
            self.answer(frame)
        self.expire(frame)
        self.page.wait_for_function('window.__messages.some(m=>m.data.type==="result")')
        report = self.reports()[-1]['result']
        self.assertTrue(report['won'])
        self.assertEqual(report['completedLevel'], 1)
        self.assertEqual(report['score'], target)
        self.assertEqual(frame.evaluate('__pitchFixture.snapshot().checkpoint.bestCompleted'), 1)
        frame.goto(frame.url, wait_until='domcontentloaded')
        frame.locator('#levelsCard').click()
        self.assertIn('LEVEL 2', frame.locator('#menuPlay').inner_text())
        self.assertEqual(frame.evaluate('JSON.parse(localStorage.getItem("pitchRaceLevelProgressV1")).bestCompleted'), 1)
        self.assertFalse(frame.evaluate('Boolean(window.firebase)'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
