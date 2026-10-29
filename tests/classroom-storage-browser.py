"""Exercise real tab/session cloning and the classroom Storage proxy.

Run with Python Playwright and Chromium. Only disposable local browser data is
used; no Firebase services or user account are contacted.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] != '/classroom-storage-fixture':
            return super().do_GET()
        body = b'''<!doctype html><meta charset="utf-8"><title>Classroom tab fixture</title>
<script src="/classroom-profile-data.js"></script><script src="/classroom-storage.js"></script>
<script>
window.fixtureNative=localStorage;
window.fixtureWorkspace=CodaClassroomStorage.create({window,keys:CodaClassroomProfileData.SCOPED_KEYS});
fixtureWorkspace.install();
window.fixtureClaim=profile=>{const marker=fixtureWorkspace.claim(profile);window.fixtureGuard=fixtureWorkspace.guardedStorage(marker);return marker;};
window.fixtureReady=true;
</script>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ClassroomStorageBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/classroom-storage-fixture'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context()
        self.context.route('https://**/*', lambda route: route.abort())
        self.errors = []
        self.page = self.new_page()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'No page errors in classroom Storage wrapper')

    def new_page(self):
        page = self.context.new_page()
        page.on('pageerror', lambda error: self.errors.append(str(error)))
        page.goto(self.url)
        page.wait_for_function('window.fixtureReady')
        return page

    def claim(self, page, who):
        return page.evaluate('who=>fixtureClaim({classId:"classAAAA",profileId:"profile"+who})', who)

    def test_real_opened_tab_cannot_adopt_cloned_session_or_expose_another_student(self):
        marker_a = self.claim(self.page, 'AAAA')
        self.page.evaluate('localStorage.musicArcadeV1="student A";localStorage.codaNotesWalletV1="250";')
        with self.page.expect_popup() as event:
            self.page.evaluate('url=>window.open(url,"_blank")', self.url)
        other = event.value
        other.on('pageerror', lambda error: self.errors.append(str(error)))
        other.wait_for_function('window.fixtureReady')
        first = other.evaluate('({state:fixtureWorkspace.getState(),avatar:localStorage.musicArcadeV1,keys:Object.keys(localStorage)})')
        self.assertNotEqual(first['state']['tabId'], marker_a['tabId'])
        self.assertTrue(first['state']['blocked'])
        self.assertIsNone(first['avatar'])
        self.assertNotIn('codaNotesWalletV1', first['keys'])
        other.evaluate('localStorage.musicArcadeV1="scratch";localStorage.removeItem("codaNotesWalletV1")')
        self.assertEqual(self.page.evaluate('fixtureNative.getItem("musicArcadeV1")'), 'student A')
        self.assertEqual(self.page.evaluate('fixtureNative.getItem("codaNotesWalletV1")'), '250')

    def test_late_old_tab_writes_and_dto_rollback_do_not_touch_the_new_profile(self):
        self.claim(self.page, 'AAAA')
        self.page.evaluate('localStorage.musicArcadeV1="student A"')
        other = self.new_page()
        self.claim(other, 'BBBB')
        other.evaluate('fixtureGuard.setItem("musicArcadeV1","student B")')
        result = self.page.evaluate('''()=>{
          localStorage.musicArcadeV1='late callback';
          const applied=CodaClassroomProfileData.apply(fixtureGuard,CodaClassroomProfileData.blank());
          return {applied,native:fixtureNative.getItem('musicArcadeV1'),shadow:localStorage.musicArcadeV1,released:fixtureWorkspace.release()};
        }''')
        self.assertFalse(result['applied']['ok'])
        self.assertEqual(result['native'], 'student B')
        self.assertEqual(result['shadow'], 'late callback')
        self.assertFalse(result['released'])
        self.assertTrue(other.evaluate('fixtureWorkspace.getState().owned'))
        other.evaluate('localStorage.musicArcadeV1="restored guest";fixtureWorkspace.release()')
        self.assertTrue(self.page.evaluate('fixtureWorkspace.getState().blocked'))
        self.assertEqual(self.page.evaluate('localStorage.musicArcadeV1'), 'late callback')
        fresh = self.new_page()
        self.assertEqual(fresh.evaluate('localStorage.musicArcadeV1'), 'restored guest')

    def test_reload_preserves_owner_and_unknown_settings_and_enumeration_stay_usable(self):
        marker = self.claim(self.page, 'AAAA')
        self.page.evaluate('localStorage.musicArcadeV1="student A";localStorage.cameraSetting="2"')
        self.page.reload()
        self.page.wait_for_function('window.fixtureReady')
        result = self.page.evaluate('''()=>({state:fixtureWorkspace.getState(),avatar:localStorage.musicArcadeV1,
          setting:localStorage.getItem('cameraSetting'),keys:Array.from({length:localStorage.length},(_,n)=>localStorage.key(n))})''')
        self.assertEqual(result['state']['tabId'], marker['tabId'])
        self.assertTrue(result['state']['owned'])
        self.assertEqual(result['avatar'], 'student A')
        self.assertEqual(result['setting'], '2')
        self.assertIn('musicArcadeV1', result['keys'])

    def test_real_navigator_lock_serializes_claim_and_apply_without_cross_tab_data(self):
        other = self.new_page()
        self.page.evaluate('''()=>{window.fixturePending=fixtureWorkspace.withLock(async()=>{
          const marker=fixtureClaim({classId:'classAAAA',profileId:'profileAAAA'});
          fixtureGuard.setItem('musicArcadeV1','A before');
          await new Promise(resolve=>setTimeout(resolve,80));
          fixtureGuard.setItem('musicArcadeV1','A complete');
        });return true;}''')
        other.evaluate('''()=>{window.fixturePending=fixtureWorkspace.withLock(()=>{
          fixtureClaim({classId:'classAAAA',profileId:'profileBBBB'});
          fixtureGuard.setItem('musicArcadeV1','B complete');
        });return true;}''')
        self.page.evaluate('fixturePending')
        other.evaluate('fixturePending')
        self.assertEqual(other.evaluate('fixtureNative.getItem("musicArcadeV1")'), 'B complete')
        self.assertTrue(other.evaluate('fixtureWorkspace.getState().owned'))
        self.assertTrue(self.page.evaluate('fixtureWorkspace.getState().blocked'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
