"""Real popup preview isolation; the owner-verification callback is a fixture.

The production test-mode module and storage boundary remain unchanged. No real
Firebase users or saved players are used, and all external requests are blocked.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><meta charset="utf-8"><title>Owner preview fixture</title>
<script src="/classroom-profile-data.js"></script><script src="/classroom-storage.js"></script>
<script src="/dance-campaign.js"></script><script src="/player-progression.js"></script>
<script>
const requested=new URL(location.href).searchParams.get('dev-test')==='1';
window.fixtureNative={local:localStorage,session:sessionStorage,indexedDB,name:window.name};
window.ARCADE_ACCOUNTS_CONFIG={enabled:true,mode:'classroom',classroom:{enabled:true,privacy:true},firebase:{projectId:'fixture-project'}};
window.fixtureOwnerAllowed=new URL(location.href).searchParams.get('owner')!=='no';
if(!requested){
 window.CodaClassroomStorageInstance=CodaClassroomStorage.create({window,keys:CodaClassroomProfileData.SCOPED_KEYS});
 CodaClassroomStorageInstance.install();CodaClassroomStorageInstance.claim({classId:'teacher_personal',profileId:'owner-fixture'});
 CodaClassroomProfileData.apply(localStorage,CodaClassroomProfileData.blank());
 localStorage.setItem('musicArcadeV1',JSON.stringify({...JSON.parse(localStorage.getItem('musicArcadeV1')),name:'Owner preview source'}));
 localStorage.setItem('firebase:owner-fixture','AUTH SENTINEL');sessionStorage.setItem('firebase:staff-fixture','SESSION SENTINEL');
 Object.defineProperty(window,'CodaDeveloperOwnerAccess',{value:Object.freeze({canDevelop:()=>fixtureOwnerAllowed}),writable:false,configurable:false});
}
window.fixtureSnapshot=()=>{
 const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
 return {local:snapshot(fixtureNative.local),session:snapshot(fixtureNative.session),name:fixtureNative.name};
};
</script><script src="/developer-test-mode.js"></script>
<button id="enter">Test all unlocks</button><p id="state"></p>
<script>
enter.onclick=()=>CodaDeveloperTestMode.enter();
if(CodaDeveloperTestMode.isEnabled()){
 const result=CodaDeveloperTestMode.seedUnlocks({progression:CodaPlayerProgression,profileData:CodaClassroomProfileData});
 if(!result.ok)throw Error(result.error||'Preview failed');CodaDeveloperTestMode.mountBanner();
}
state.textContent=JSON.stringify(CodaDeveloperTestMode.getState());window.fixtureReady=true;
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if urlsplit(self.path).path == '/owner-preview-fixture':
            body = HTML.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif urlsplit(self.path).path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()


class OwnerPreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context()
        self.external, self.errors = [], []
        def route(request_route):
            if urlsplit(request_route.request.url).hostname != '127.0.0.1':
                self.external.append(request_route.request.url)
                request_route.abort()
            else:
                request_route.continue_()
        self.context.route('**/*', route)
        self.context.on('page', lambda page: page.on('pageerror', lambda error: self.errors.append(str(error))))
        self.page = self.context.new_page()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.external, [])
        self.assertEqual(self.errors, [])

    def owner(self, allowed=True):
        self.page.goto(self.base + '/owner-preview-fixture' + ('' if allowed else '?owner=no'))
        self.page.wait_for_function('window.fixtureReady')

    def preview(self):
        with self.page.expect_popup() as popup:
            self.page.locator('#enter').click()
        child = popup.value
        child.wait_for_function('window.fixtureReady')
        return child

    def test_direct_url_and_unverified_owner_cannot_start_preview(self):
        self.page.goto(self.base + '/owner-preview-fixture?dev-test=1&profile=student#classroom-pass=fixture')
        self.page.wait_for_function('window.fixtureReady')
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.isEnabled()'))
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.getState().ownerVerified'))
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.seedUnlocks().ok'))
        self.assertTrue(self.page.evaluate('localStorage===fixtureNative.local'))
        self.assertTrue(self.page.evaluate('ARCADE_ACCOUNTS_CONFIG.enabled'))
        self.assertNotIn('dev-test', self.page.url)
        self.assertIn('profile=student', self.page.url)
        self.assertIn('#classroom-pass=fixture', self.page.url)
        self.owner(False)
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.enter()'))
        self.assertEqual(len(self.context.pages), 1)

    def test_verified_popup_reload_and_exit_keep_real_owner_stores_and_authentication(self):
        self.owner()
        before = self.page.evaluate('fixtureSnapshot()')
        child = self.preview()
        for reload in [False, True]:
            if reload:
                child.reload()
                child.wait_for_function('window.fixtureReady')
            self.assertTrue(child.evaluate('CodaDeveloperTestMode.getState().ownerVerified'))
            self.assertTrue(child.evaluate('CodaDeveloperTestMode.getState().seeded'))
            self.assertEqual(child.evaluate('JSON.parse(localStorage.musicArcadeV1).name'), 'Owner preview source')
            self.assertEqual(child.evaluate('localStorage.getItem("firebase:owner-fixture")'), None)
            self.assertEqual(child.evaluate('sessionStorage.getItem("firebase:staff-fixture")'), None)
            self.assertFalse(child.evaluate('!!ARCADE_ACCOUNTS_CONFIG.firebase'))
            self.assertEqual(self.page.evaluate('fixtureSnapshot()'), before)
        child.evaluate('localStorage.musicArcadeV1="preview only"')
        with child.expect_event('close'):
            child.locator('[data-developer-test-exit]').click()
        self.assertEqual(self.page.evaluate('fixtureSnapshot()'), before)
        self.assertTrue(self.page.evaluate('ARCADE_ACCOUNTS_CONFIG.enabled'))

    def test_owner_revocation_closes_preview_without_touching_owner_progress(self):
        self.owner()
        before = self.page.evaluate('fixtureSnapshot()')
        child = self.preview()
        with child.expect_event('close'):
            self.page.evaluate("fixtureOwnerAllowed=false;dispatchEvent(new Event('coda-developer-access-change'))")
        self.assertEqual(self.page.evaluate('fixtureSnapshot()'), before)
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.enter()'))

    def test_owner_window_closure_revokes_its_preview(self):
        self.owner()
        child = self.preview()
        with child.expect_event('close'):
            self.page.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
