"""Legacy account and song modules cannot bypass classroom privacy.

All files run at the deployed origin using local routes. External requests are
recorded and blocked; these checks never contact live accounts or databases.
"""
import json
import mimetypes
import os
from pathlib import Path
import unittest
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://cwoodmusic.github.io'
BASE = ORIGIN + '/coda-arcade/'


class LegacyClassroomPrivacyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()

    def setUp(self):
        self.config = {'enabled': True, 'mode': 'classroom',
                       'classroom': {'privacy': True, 'enabled': False}}
        self.requests, self.errors, self.missing, self.dialogs = [], [], [], []
        self.world_destination = False
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 1000})
        self.context.route('**/*', self.route)
        self.page = self.context.new_page(); self.page.set_default_timeout(10000)
        self.page.on('request', lambda request: self.requests.append(request.url))
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('dialog', lambda dialog: (self.dialogs.append(dialog.message), dialog.dismiss()))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')
        self.assertEqual(self.missing, [], 'Missing checkout assets')
        self.assertEqual(self.dialogs, [], 'No student login or cloud-title prompts')
        external = [url for url in self.requests
                    if not url.startswith(BASE) and not url.startswith(('blob:', 'data:'))]
        self.assertEqual(external, [], 'Classroom mode must not request external services')

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.path == '/favicon.ico': return route.fulfill(status=204)
        if not route.request.url.startswith(BASE): return route.abort()
        relative = unquote(parsed.path.removeprefix('/coda-arcade/')) or 'index.html'
        if relative == 'world-preview.html' and self.world_destination:
            return route.fulfill(body='<!doctype html><title>Classroom profile destination</title><p>Classroom profile destination</p>', content_type='text/html')
        if relative == 'account-config.js':
            return route.fulfill(body='window.ARCADE_ACCOUNTS_CONFIG=' + json.dumps(self.config),
                                 content_type='text/javascript')
        if relative == 'legacy-classroom-fixture.html':
            body = '''<!doctype html><title>Legacy account privacy fixture</title>
<button id="account">Player</button><dialog id="accountModal"></dialog>
<script>window.ARCADE_ACCOUNTS_CONFIG=__POLICY_VALUE__;
window.__intervals=0;const originalInterval=setInterval;
window.setInterval=(...args)=>{__intervals++;return originalInterval(...args)};
const $=id=>document.getElementById(id),modal=$('accountModal');let data={};
function save(){}function show(html){modal.innerHTML=html;modal.showModal()}
</script><script src="accounts.js"></script>'''.replace('__POLICY_VALUE__', json.dumps(self.config))
            return route.fulfill(body=body, content_type='text/html')
        if relative == 'private-hall-fixture.html':
            body = '''<!doctype html><title>Private records fixture</title>
<script src="account-config.js"></script><div id="records"></div><script src="hall-of-fame.js"></script>
<script>window.__publicFetches=0;window.__fame=CodaHallOfFame.create({
 panelBody:document.querySelector('#records'),openPanel(){},getAvatar:()=>({name:'Blue Owl'}),
 fetch(){window.__publicFetches++;throw Error('Public services must stay off');}
});</script>'''
            return route.fulfill(body=body, content_type='text/html')
        if relative == 'private-song-frame-fixture.html':
            body = '''<!doctype html><title>Private Song Machine fixture</title>
<script>window.__nativeStore=localStorage;__nativeStore.setItem('codaDJLibraryV1','another student');
window.__values=new Map([['profile-marker','student-a']]);
window.__privateStore={__codaClassroomScoped:true,get length(){return __values.size},
 key:i=>[...__values.keys()][i]??null,getItem:key=>__values.get(String(key))??null,
 setItem:(key,value)=>__values.set(String(key),String(value)),removeItem:key=>__values.delete(String(key))};
Object.defineProperty(window,'localStorage',{configurable:true,get:()=>__privateStore});</script>
<iframe id="song" src="song-machine/index.html?classroom=1" style="width:1200px;height:900px"></iframe>'''
            return route.fulfill(body=body, content_type='text/html')
        file = (ROOT / relative).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            self.missing.append(relative); return route.fulfill(status=404, body='Missing fixture resource')
        return route.fulfill(path=str(file), content_type=mimetypes.guess_type(file.name)[0] or 'application/octet-stream')

    def test_each_classroom_policy_blocks_legacy_google_accounts_and_polling(self):
        self.world_destination = True
        for policy in ({'mode': 'classroom'}, {'classroom': {'privacy': True, 'enabled': False}},
                       {'classroom': {'enabled': True}}):
            with self.subTest(policy=policy):
                self.config = {'enabled': True, **policy}
                self.page.goto(BASE + 'legacy-classroom-fixture.html', wait_until='load')
                self.assertEqual(self.page.evaluate('__intervals'), 0)
                self.page.evaluate('''()=>{window.__opened=0;
                  window.CodaClassroomUIInstance={open(){window.__opened++}};}''')
                self.page.locator('#account').click()
                self.assertEqual(self.page.evaluate('__opened'), 1)
                self.page.evaluate('''()=>{delete window.CodaClassroomUIInstance;
                  localStorage.setItem('guest-progress-fixture','kept');}''')
                self.page.locator('#account').click()
                self.page.wait_for_url(BASE + 'world-preview.html')
                self.assertEqual(self.page.title(), 'Classroom profile destination')
                self.assertEqual(self.page.evaluate('localStorage.getItem("guest-progress-fixture")'), 'kept')

    def test_private_song_editor_keeps_edit_play_import_and_export_without_cloud_prompts(self):
        self.page.goto(BASE + 'song-machine/index.html?classroom=1&song=untrusted-song-id', wait_until='load')
        self.page.wait_for_function('window.songMachineBridge?.getEditorMode && document.querySelector("#save").textContent==="Export song file"')
        self.assertEqual(self.page.locator('#cloud-account').count(), 0)
        before = self.page.evaluate('songMachineBridge.get()')
        self.assertEqual(len(before['tracks']), 2)
        self.page.locator('#simpleInstrument').select_option('add')
        self.assertEqual(self.page.evaluate('songMachineBridge.get().tracks.length'), 3)
        self.page.locator('#simpleUndo').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.get()'), before)
        self.page.locator('#simplePlay').click()
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Playing")')
        self.page.locator('#simpleStop').click()
        self.assertIn('Stopped', self.page.locator('#simpleStatus').inner_text())
        self.page.locator('#simpleMenu').click()
        self.assertTrue(self.page.locator('#save').is_enabled())
        with self.page.expect_download() as download:
            self.page.locator('#save').click()
        saved = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(saved, before)
        imported = {**saved, 'bpm': 92}
        self.page.locator('#file').set_input_files({
            'name': 'classroom-song.json', 'mimeType': 'application/json',
            'buffer': json.dumps(imported).encode()})
        self.page.wait_for_function('songMachineBridge.get().bpm===92')
        self.assertEqual(self.page.evaluate('songMachineBridge.get()'), imported)

    def test_classroom_hall_uses_private_local_records_without_public_leaderboard_reads(self):
        self.page.goto(BASE + 'private-hall-fixture.html', wait_until='load')
        self.page.evaluate('__fame.refreshPublic()')
        self.page.evaluate('__fame.open()')
        self.assertEqual(self.page.evaluate('__publicFetches'), 0)
        self.assertEqual(self.page.locator('.fame-public').count(), 0)
        self.assertTrue(self.page.evaluate('''__fame.record('triad','private-run',{
          mode:'computer',score:7,captures:3})'''))
        self.assertIn('Blue Owl', self.page.locator('#records').inner_text())
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("codaHallOfFameV1")).records["triad:computer"].score'), 7)

    def test_song_frame_inherits_scoped_storage_before_composition_scripts(self):
        self.page.goto(BASE + 'private-song-frame-fixture.html', wait_until='load')
        frame = self.page.locator('#song').element_handle().content_frame()
        frame.wait_for_function('window.songMachineBridge?.getEditorMode')
        self.assertTrue(frame.evaluate('localStorage.__codaClassroomScoped===true'))
        self.assertEqual(frame.evaluate('localStorage.getItem("profile-marker")'), 'student-a')
        self.assertIsNone(frame.evaluate('localStorage.getItem("codaDJLibraryV1")'))
        self.assertIn('classroom-storage-inherit.js', frame.evaluate('document.scripts[0].src'))
        frame.evaluate('localStorage.setItem("codaDJLibraryV1","private-song")')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaDJLibraryV1")'), 'private-song')
        self.assertEqual(self.page.evaluate('__nativeStore.getItem("codaDJLibraryV1")'), 'another student')


if __name__ == '__main__': unittest.main(verbosity=2)
