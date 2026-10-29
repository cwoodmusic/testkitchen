"""The real title page and its guest, card, and teacher entry routes.

Only the account configuration is replaced in the browser. All application
files come from the checkout; external requests are recorded and blocked.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCOPED = ['musicArcadeV1', 'codaPlayerProgressV1', 'codaNotesWalletV1',
          'codaMusicianMissionsV1', 'codaRhythmFishingV1', 'codaPianoProgressV1',
          'codaClassroomLessonsV1', 'codaClassroomQuizzesV1',
          'pitchRaceLevelProgressV1', 'pitchRaceTutorialsV1', 'codaPianoTakeV1',
          'codaDJLibraryV1', 'codaHallOfFameV1', 'rhythm-room-practice-v1']


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class TitleScreenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.enabled = False
        self.qr_fixture = False
        self.defer_title_script = False
        self.held_title_route = None
        self.errors, self.failed_assets, self.external, self.requests = [], [], [], []
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000}, has_touch=True)
        self.context.route('**/*', self.route)
        self.context.on('page', self.watch_page)
        self.context.on('request', lambda request:self.requests.append(request.url))
        self.context.add_init_script('''(()=>{
          window.__titleAudioCreated=0;
          for(const name of ['Audio','AudioContext','webkitAudioContext']){
            const original=window[name];
            if(typeof original==='function')window[name]=new Proxy(original,{
              construct(target,args,newTarget){window.__titleAudioCreated++;
                return Reflect.construct(target,args,newTarget);}
            });
          }
        })()''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'No page or frame errors')
        self.assertEqual(self.failed_assets, [], 'No failed local assets')
        self.assertEqual(self.external, [], 'Entry must not contact public services')

    def watch_page(self, page):
        page.on('pageerror', lambda error:self.errors.append(str(error)))
        page.on('console', lambda message:self.errors.append(message.text)
            if message.text.startswith('Arcade frame error:') else None)
        page.on('response', lambda response:self.failed_assets.append(response.url)
            if response.status >= 400 and urlparse(response.url).hostname == '127.0.0.1' else None)
        page.on('websocket', lambda socket:self.external.append(socket.url)
            if urlparse(socket.url).hostname != '127.0.0.1' else None)

    def route(self, route):
        url = urlparse(route.request.url)
        if url.hostname != '127.0.0.1':
            self.external.append(route.request.url)
            return route.abort()
        if url.path == '/favicon.ico':
            return route.fulfill(status=204)
        if url.path == '/account-config.js':
            config = {'enabled':True, 'mode':'classroom',
                'classroom':{'enabled':self.enabled, 'privacy':True, 'namespace':'classroomV1'},
                'firebase':{'apiKey':'fixture-not-a-live-key', 'projectId':'demo-title-screen',
                    'databaseURL':'https://demo-title-screen-default-rtdb.firebaseio.com',
                    'authDomain':'demo-title-screen.firebaseapp.com'}}
            return route.fulfill(body='window.ARCADE_ACCOUNTS_CONFIG='+json.dumps(config),
                content_type='text/javascript')
        if url.path == '/title-screen.js' and self.defer_title_script:
            self.held_title_route = route
            return
        if url.path == '/classroom-service.js':
            source = (ROOT/'classroom-service.js').read_text()
            stub = r"""
;(()=>{
  if(!window.__titleInspectionFixture||!/\/(?:index\.html)?$/.test(location.pathname))return;
  const original=CodaClassroom;
  window.CodaClassroom=Object.freeze({...original,create:options=>{
    window.__titleInspectionCalls=(window.__titleInspectionCalls||0)+1;
    const snapshot={admin:{signedIn:true,authorized:true},code:''};
    return {getState:()=>snapshot,subscribe:()=>()=>{},destroy(){},inspectSession:async()=>{
      if(window.__titleHoldInspection)await new Promise(resolve=>window.__releaseTitleInspection=resolve);
      return JSON.parse(JSON.stringify(window.__titleInspectionFixture));
    }};
  }});
})();
"""
            return route.fulfill(content_type='text/javascript', body=source+stub)
        if url.path == '/world-preview.html' and self.qr_fixture:
            return route.fulfill(content_type='text/html', body='''<!doctype html>
              <title>Card forwarding boundary</title><script src="classroom-service.js"></script>
              <script>window.__receivedCard=CodaClassroom.consumeFragment(location,history);
              window.__cardConsumed=true;</script>''')
        return route.continue_()

    def title(self, suffix=''):
        self.page.goto(self.base+'/'+suffix, wait_until='load')
        self.page.wait_for_function('document.querySelector("#titleMotion")?.hidden===false')

    def assert_quiet_title(self, page=None):
        page = page or self.page
        self.assertEqual(page.locator('canvas,audio,video').count(), 0)
        self.assertFalse(page.evaluate('Boolean(window.CodaArcadeQA||window.CodaLandingQA||window.CodaClassroomSession||window.firebase)'))
        self.assertEqual(page.evaluate('__titleAudioCreated'), 0)
        self.assertFalse(any('firebasejs/' in url or '/arcade-bridge' in url for url in self.requests))

    def seed_owner(self):
        self.context.add_init_script('''(()=>{
          const keys=__KEYS__;
          window.__titleNative=localStorage;window.__titleScopedWrites=[];
          window.__titleInspectionFixture={ok:true,signedIn:true,kind:"student",alias:"Blue Fox 14"};
          if(!sessionStorage.getItem('titleOwnerSeeded')){
            const tabId='title-owner-fixture',marker={version:1,tabId,
              epoch:'title-owner-epoch',classId:'class-title-fixture',profileId:'profile-title-fixture'};
            window.name='__codaClassroomTabV1:'+tabId;
            sessionStorage.setItem('codaClassroomTabV1',tabId);
            sessionStorage.setItem('codaClassroomActiveV1',JSON.stringify(marker));
            localStorage.setItem('codaClassroomWorkspaceV1',JSON.stringify(marker));
            for(const key of keys)localStorage.setItem(key,'PRIVATE CHILD VALUE '+key);
            localStorage.setItem('musicArcadeV1',JSON.stringify({name:'PRIVATE CHILD NAME'}));
            sessionStorage.setItem('titleOwnerSeeded','yes');
          }
          const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
          Storage.prototype.setItem=function(key,value){if(keys.includes(String(key)))__titleScopedWrites.push(String(key));return set.call(this,key,value);};
          Storage.prototype.removeItem=function(key){if(keys.includes(String(key)))__titleScopedWrites.push(String(key));return remove.call(this,key);};
          window.__titleBefore=keys.map(key=>__titleNative.getItem(key));
        })()'''.replace('__KEYS__', json.dumps(SCOPED)))

    def test_phone_tablet_landscape_and_desktop_fit_with_large_entry_targets(self):
        self.title()
        for width,height in [(320,568),(360,640),(390,844),(768,1024),
                             (1024,768),(844,390),(1440,1000)]:
            with self.subTest(viewport=(width,height)):
                self.page.set_viewport_size({'width':width,'height':height})
                self.page.evaluate('scrollTo(0,0)')
                metric = self.page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
                  targets:['titleProfile','titleGuest','titleTeacher','titleMotion'].map(id=>{
                    const r=document.getElementById(id).getBoundingClientRect();
                    return {id,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};})})''')
                self.assertLessEqual(metric['scroll'], width+1)
                for target in metric['targets']:
                    self.assertGreaterEqual(target['width'], 44, target)
                    self.assertGreaterEqual(target['height'], 44, target)
                    self.assertGreaterEqual(target['left'], 0, target)
                    self.assertLessEqual(target['right'], width+1, target)
                    self.assertGreaterEqual(target['top'], 0, target)
                    self.assertLessEqual(target['bottom'], height+1, target)
        self.assert_quiet_title()

    def test_title_starts_no_game_audio_or_cloud_and_unfinished_profiles_are_clear(self):
        self.title();self.assert_quiet_title()
        self.assertEqual(self.page.locator('#titleProfile').get_attribute('aria-disabled'), 'true')
        self.assertIn('Profiles are being set up', self.page.locator('#titleProfileHint').inner_text())
        self.assertIn('is-primary', self.page.locator('#titleGuest').get_attribute('class'))
        before = self.page.url
        # ARIA disables semantics but does not prevent native anchor navigation.
        # Force a real pointer click to check the production event guard too.
        self.page.locator('#titleProfile').click(force=True)
        self.assertEqual(self.page.url, before)
        self.page.locator('#titleProfile').focus()
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.url, before)

    def test_guest_button_enters_the_real_world_with_working_keyboard_movement(self):
        self.enabled=True
        self.title()
        self.assertEqual(parse_qs(urlparse(self.page.locator('#titleGuest').get_attribute('href')).query).get('guest'), ['1'])
        self.page.locator('#titleGuest').tap()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.characters().spriteState.ready')
        self.assertTrue(self.page.locator('#view').is_visible())
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(950,420)'))
        self.page.locator('#view').focus()
        before = self.page.evaluate('CodaArcadeQA.characters().player.x')
        self.page.keyboard.down('d')
        try:self.page.wait_for_function('before=>CodaArcadeQA.characters().player.x>before+10', arg=before)
        finally:self.page.keyboard.up('d')

    def test_guest_with_no_profile_ignores_an_old_recovery_notice(self):
        self.enabled=True;self.title()
        self.page.evaluate('sessionStorage.setItem("codaClassroomNoticeV1","session-ended")')
        self.page.locator('#titleGuest').tap()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertIsNone(self.page.evaluate('sessionStorage.getItem("codaClassroomNoticeV1")'))

    def test_teacher_entry_opens_teacher_ui_without_signing_in_and_is_consumed_once(self):
        self.title()
        version = parse_qs(urlparse(self.page.locator('#titleTeacher').get_attribute('href')).query)['v']
        self.page.locator('#titleTeacher').tap()
        self.page.wait_for_function('window.CodaClassroomUIInstance?.getState().open')
        self.assertEqual(self.page.evaluate('CodaClassroomUIInstance.getState().view'), 'admin')
        self.assertTrue(self.page.locator('#classpassAdminSignIn').is_visible())
        self.assertEqual(self.page.locator('#classpassTab-admin').get_attribute('aria-pressed'), 'true')
        self.assertNotIn('profile=', self.page.url)
        self.assertEqual(parse_qs(urlparse(self.page.url).query).get('v'), version)
        self.assertFalse(any('firebasejs/' in url for url in self.requests))
        self.page.reload(wait_until='load')
        self.page.wait_for_function('window.CodaClassroomUIInstance')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))

    def test_enabled_student_entry_opens_the_actual_card_form(self):
        self.enabled=True;self.title()
        self.assertIsNone(self.page.locator('#titleProfile').get_attribute('aria-disabled'))
        self.assertIn('is-primary', self.page.locator('#titleProfile').get_attribute('class'))
        self.page.locator('#titleProfile').tap()
        self.page.wait_for_function('window.CodaClassroomUIInstance?.getState().open')
        self.assertEqual(self.page.evaluate('CodaClassroomUIInstance.getState().view'), 'student')
        self.assertTrue(self.page.locator('#classpassJoinInput').is_visible())
        self.assertEqual(self.page.locator('#classpassTab-student').get_attribute('aria-pressed'), 'true')
        self.assertNotIn('profile=', self.page.url)
        self.assertFalse(any('firebasejs/' in url for url in self.requests))

    def test_returning_owner_shows_only_the_verified_alias_without_mutating_saves(self):
        self.seed_owner();self.enabled=True;self.title()
        self.assertEqual(self.page.locator('#startTitle').inner_text(), 'Welcome back.')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.locator('#titleProfile strong').inner_text(), 'Continue as Blue Fox 14')
        self.assertEqual(self.page.locator('#titleSessionStatus').inner_text(), 'Signed in as Blue Fox 14')
        self.assertEqual(self.page.locator('#titleGuest strong').inner_text(), 'Play as guest')
        self.assertNotIn('profile=', self.page.locator('#titleProfile').get_attribute('href'))
        self.assertEqual(parse_qs(urlparse(self.page.locator('#titleGuest').get_attribute('href')).query).get('guest'), ['1'])
        self.assertNotIn('PRIVATE CHILD', self.page.locator('body').inner_text())
        self.assertEqual(urlparse(self.page.url).path, '/')
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED),
                         self.page.evaluate('__titleBefore'))
        self.assertEqual(self.page.evaluate('__titleScopedWrites'), [])
        self.assert_quiet_title()

    def test_same_tab_returning_owner_can_click_guest_without_loading_or_changing_profile(self):
        self.seed_owner();self.enabled=True;self.title()
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.locator('#titleGuest strong').inner_text(), 'Play as guest')
        self.page.locator('#titleGuest').tap()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.characters().spriteState.ready')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(self.page.evaluate('CodaClassroomStorageInstance.getState().owned'))
        self.assertIsNone(self.page.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED),
                         self.page.evaluate('__titleBefore'))
        self.assertFalse(any('firebasejs/' in url for url in self.requests))
        self.page.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Own-tab guest"}))')
        self.page.reload(wait_until='load')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem("musicArcadeV1")).name'),'Own-tab guest')
        self.assertIn('PRIVATE CHILD',self.page.evaluate('__titleNative.getItem("musicArcadeV1")'))

    def test_teacher_only_remembered_session_keeps_a_real_guest_route(self):
        self.enabled=True
        self.context.add_init_script('''(()=>{
          window.__titleInspectionFixture={ok:true,signedIn:true,kind:'teacher'};
          if(!sessionStorage.getItem('teacherTitleSeeded')){
            const tabId='title-teacher-fixture';window.name='__codaClassroomTabV1:'+tabId;
            sessionStorage.setItem('codaClassroomTabV1',tabId);
            sessionStorage.setItem('codaClassroomAdminTabV1',JSON.stringify({version:1,tabId,uid:'teacher-title-0001'}));
            sessionStorage.setItem('teacherTitleSeeded','yes');
          }
        })()''')
        self.title()
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.locator('#titleGuest strong').inner_text(),'Play as guest')
        self.page.locator('#titleGuest').tap()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(self.page.evaluate('CodaClassroomSession.getState().admin.signedIn'))
        self.assertFalse(any('firebasejs/' in url for url in self.requests))

    def assert_delayed_guest_button_does_not_move(self, expected_session):
        self.enabled=True;self.defer_title_script=True
        self.page.goto(self.base+'/',wait_until='commit')
        self.page.locator('#titleGuest').wait_for(state='visible')
        self.page.wait_for_function('document.styleSheets.length>0&&getComputedStyle(document.querySelector("#titleGuest")).display==="flex"')
        before=self.page.locator('#titleGuest').bounding_box()
        self.assertIsNotNone(self.held_title_route)
        self.held_title_route.continue_()
        self.page.wait_for_function('document.querySelector("#titleMotion")?.hidden===false')
        self.page.wait_for_function('state=>document.querySelector("#titleSessionStatus").dataset.sessionState===state',
                                    arg=expected_session)
        after=self.page.locator('#titleGuest').bounding_box()
        self.assertAlmostEqual(after['y'],before['y'],delta=1,
                               msg='The visible guest button must not swap places while a click is underway')
        self.page.mouse.click(before['x']+before['width']/2,before['y']+before['height']/2)
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertEqual(parse_qs(urlparse(self.page.url).query).get('guest'),['1'])
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))

    def test_guest_click_position_stays_guest_when_delayed_title_script_enables_profiles(self):
        self.assert_delayed_guest_button_does_not_move('guest')

    def test_saved_profile_guest_click_position_stays_guest_after_delayed_title_script(self):
        self.seed_owner()
        self.assert_delayed_guest_button_does_not_move('signed-in')

    def test_cloned_tab_does_not_greet_or_read_another_childs_profile(self):
        self.seed_owner();self.enabled=True;self.title()
        with self.page.expect_popup() as popup:
            self.page.evaluate('url=>window.open(url,"_blank")', self.base+'/')
        other=popup.value
        other.wait_for_function('document.querySelector("#titleMotion")?.hidden===false')
        self.assertEqual(other.locator('#startTitle').inner_text(), 'Let’s play.')
        self.assertEqual(other.locator('#titleProfile strong').inner_text(), 'Open my profile')
        self.assertEqual(other.locator('#titleGuest strong').inner_text(), 'Play as guest')
        self.assertIn('other arcade tab', other.locator('#titleProfileHint').inner_text())
        self.assertEqual(other.locator('#titleSessionStatus').get_attribute('data-session-state'), 'blocked')
        self.assertEqual(other.evaluate('window.__titleInspectionCalls||0'), 0)
        self.assertNotIn('PRIVATE CHILD', other.locator('body').inner_text())
        self.assertIsNone(other.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.assertEqual(other.evaluate('__titleScopedWrites'), [])
        self.assertEqual(self.page.locator('#startTitle').inner_text(), 'Welcome back.')
        self.assert_quiet_title(other)

    def test_guest_in_another_tab_enters_world_without_login_or_touching_profile_saves(self):
        self.seed_owner();self.enabled=True;self.title()
        owner_values=self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED)
        owner_marker=self.page.evaluate('__titleNative.getItem("codaClassroomWorkspaceV1")')
        with self.page.expect_popup() as event:
            self.page.evaluate('url=>window.open(url,"_blank")', self.base+'/')
        guest=event.value
        guest.wait_for_function('document.querySelector("#titleMotion")?.hidden===false')
        self.assertEqual(guest.locator('#titleGuest strong').inner_text(), 'Play as guest')
        guest.locator('#titleGuest').tap()
        guest.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.characters().spriteState.ready')
        self.assertFalse(guest.evaluate('CodaClassroomUIInstance.getState().open'),
                         'Explicit guest play must not open the profile login')
        self.assertTrue(guest.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(guest.evaluate('CodaClassroomStorageInstance.getState().owned'))
        self.assertIsNone(guest.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.assertTrue(guest.evaluate('CodaArcadeQA.place(950,420)'))
        guest.locator('#view').focus()
        before=guest.evaluate('CodaArcadeQA.characters().player.x')
        guest.keyboard.down('d')
        try:guest.wait_for_function('before=>CodaArcadeQA.characters().player.x>before+10', arg=before)
        finally:guest.keyboard.up('d')
        guest.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Local guest"}))')
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED), owner_values)
        self.assertEqual(self.page.evaluate('__titleNative.getItem("codaClassroomWorkspaceV1")'), owner_marker)
        guest.reload(wait_until='load')
        guest.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(guest.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(guest.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED), owner_values)
        self.assertEqual(self.page.evaluate('__titleNative.getItem("codaClassroomWorkspaceV1")'), owner_marker)
        # The other tab can end its session while this guest is still playing.
        # That must not expose its old native values or make guest writes native.
        self.page.evaluate('__titleNative.removeItem("codaClassroomWorkspaceV1")')
        guest.wait_for_function('localStorage.getItem("codaClassroomWorkspaceV1")===null')
        self.assertNotIn('PRIVATE CHILD', guest.evaluate('localStorage.getItem("musicArcadeV1")||""'))
        guest.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Still a guest"}))')
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED), owner_values)
        self.assertFalse(guest.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(guest.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        guest.reload(wait_until='load')
        guest.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(guest.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(guest.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertNotIn('PRIVATE CHILD', guest.evaluate('localStorage.getItem("musicArcadeV1")||""'))
        self.assertEqual(self.page.evaluate('keys=>keys.map(key=>__titleNative.getItem(key))', SCOPED), owner_values)

    def test_guest_ignores_a_closed_tabs_workspace_and_old_login_recovery_intent(self):
        self.enabled=True
        self.context.add_init_script('''(()=>{
          if(sessionStorage.getItem('orphanGuestSeeded'))return;
          sessionStorage.setItem('orphanGuestSeeded','yes');
          localStorage.setItem('codaClassroomWorkspaceV1',JSON.stringify({version:1,
            tabId:'closed-profile-tab',epoch:'closed-profile-epoch',
            classId:'closed-profile-class',profileId:'closed-profile-player'}));
          localStorage.setItem('musicArcadeV1',JSON.stringify({name:'PRIVATE CLOSED PROFILE'}));
        })()''')
        self.title()
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'), 'blocked')
        self.assertEqual(self.page.locator('#titleGuest strong').inner_text(), 'Play as guest')
        self.page.evaluate('''()=>{
          sessionStorage.setItem('codaClassroomNoticeV1','session-ended');
          sessionStorage.setItem('codaClassroomEntryV1',JSON.stringify({version:1,
            tabId:sessionStorage.getItem('codaClassroomTabV1'),view:'student'}));
        }''')
        self.page.locator('#titleGuest').tap()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertNotIn('PRIVATE CLOSED PROFILE',self.page.locator('body').inner_text())
        self.assertIsNone(self.page.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.assertEqual(self.page.evaluate('CodaClassroomStorageInstance.nativeStorage.getItem("musicArcadeV1")'),
                         '{"name":"PRIVATE CLOSED PROFILE"}')

    def test_a_saved_profile_waits_for_verification_before_showing_any_alias(self):
        self.seed_owner()
        self.context.add_init_script('window.__titleHoldInspection=true')
        self.enabled=True;self.title()
        self.page.wait_for_function('Boolean(window.__releaseTitleInspection)')
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'), 'checking')
        self.assertEqual(self.page.locator('#titleProfile strong').inner_text(), 'Continue profile')
        self.assertNotIn('Blue Fox 14',self.page.locator('body').inner_text())
        self.assertNotIn('PRIVATE CHILD',self.page.locator('body').inner_text())
        self.page.evaluate('__releaseTitleInspection()')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.locator('#titleProfile strong').inner_text(), 'Continue as Blue Fox 14')
        self.page.reload(wait_until='load')
        self.page.wait_for_function('Boolean(window.__releaseTitleInspection)')
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'), 'checking')
        self.page.evaluate('__releaseTitleInspection()')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.evaluate('__titleScopedWrites'), [])

    def test_a_delayed_verification_cannot_reveal_the_previous_profile_after_ownership_changes(self):
        self.seed_owner();self.enabled=True
        self.context.add_init_script('window.__titleHoldInspection=true')
        self.title();self.page.wait_for_function('Boolean(window.__releaseTitleInspection)')
        self.page.evaluate('''()=>{const marker=JSON.parse(localStorage.getItem("codaClassroomWorkspaceV1"));
          localStorage.setItem("codaClassroomWorkspaceV1",JSON.stringify({...marker,tabId:"another-title-tab"}));}''')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="blocked"')
        self.page.evaluate('__releaseTitleInspection()')
        self.page.wait_for_timeout(30)
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'),'blocked')
        self.assertNotIn('Blue Fox 14',self.page.locator('body').inner_text())
        self.assertNotIn('PRIVATE CHILD',self.page.locator('body').inner_text())
        self.assertEqual(self.page.locator('#titleProfile strong').inner_text(),'Open my profile')
        self.assertEqual(self.page.evaluate('__titleScopedWrites'), [])

    def test_unavailable_and_expired_signins_never_claim_to_be_signed_in(self):
        self.seed_owner();self.enabled=True
        self.context.add_init_script('window.__titleInspectionFixture={ok:false,signedIn:false,code:"connection-unavailable"}')
        self.title()
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="unavailable"')
        self.assertIn('Sign-in check unavailable',self.page.locator('#titleSessionStatus').inner_text())
        self.assertNotIn('profile=',self.page.locator('#titleProfile').get_attribute('href'))
        self.page.evaluate('window.__titleInspectionFixture={ok:true,signedIn:false,code:"session-ended"}')
        self.page.dispatch_event('body','click')
        self.page.evaluate('dispatchEvent(new PageTransitionEvent("pageshow",{persisted:true}))')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-out"')
        self.assertEqual(self.page.locator('#titleSessionStatus').inner_text(),'Sign-in needed')
        self.assertIn('profile=student',self.page.locator('#titleProfile').get_attribute('href'))
        self.assertNotIn('PRIVATE CHILD',self.page.locator('body').inner_text())
        self.assertEqual(self.page.evaluate('__titleScopedWrites'), [])

    def test_guest_avatar_names_do_not_become_signed_in_status_and_long_verified_alias_fits_phone(self):
        self.enabled=True;self.title()
        self.page.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"OLD GUEST NAME"}))')
        self.page.reload(wait_until='load')
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'),'guest')
        self.assertNotIn('OLD GUEST NAME',self.page.locator('body').inner_text())
        self.seed_owner()
        self.context.add_init_script('window.__titleInspectionFixture={ok:true,signedIn:true,kind:"student",alias:"A".repeat(40)}')
        self.title()
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.page.set_viewport_size({'width':320,'height':568})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertIn('A'*40,self.page.locator('#titleSessionStatus').inner_text())
        self.assertEqual(self.page.evaluate('__titleScopedWrites'), [])

    def test_motion_preference_persists_and_device_reduced_motion_is_respected(self):
        self.title();self.page.locator('#titleMotion').click()
        self.assertEqual(self.page.evaluate('localStorage.getItem("arcadeAnimations")'), 'off')
        self.assertEqual(self.page.locator('#titleMotion').get_attribute('aria-pressed'), 'false')
        self.assertEqual(self.page.locator('.panel-note').evaluate('el=>getComputedStyle(el).animationName'), 'none')
        self.page.reload(wait_until='load')
        self.assertEqual(self.page.locator('#titleMotion').inner_text(), '✧ Motion: Off')
        self.page.locator('#titleMotion').click()
        self.assertEqual(self.page.evaluate('localStorage.getItem("arcadeAnimations")'), 'on')
        self.page.emulate_media(reduced_motion='reduce')
        self.page.wait_for_function('document.querySelector("#titleMotion").disabled')
        self.assertEqual(self.page.locator('#titleMotion').inner_text(), 'Motion: Reduced')
        self.assertEqual(self.page.locator('.panel-note').evaluate('el=>getComputedStyle(el).animationName'), 'none')
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.wait_for_function('!document.querySelector("#titleMotion").disabled')
        self.assertEqual(self.page.locator('#titleMotion').get_attribute('aria-pressed'), 'true')
        self.assert_quiet_title()

    def test_card_fragment_forwards_once_without_entering_queries_or_storage(self):
        self.qr_fixture=True
        private_pass='CODA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA'
        self.page.goto(self.base+'/#classroom-pass='+private_pass, wait_until='load')
        self.page.wait_for_function('window.__cardConsumed')
        self.assertEqual(self.page.evaluate('__receivedCard'), private_pass)
        self.assertEqual(urlparse(self.page.url).path, '/world-preview.html')
        self.assertEqual(urlparse(self.page.url).fragment, '')
        self.assertNotIn(private_pass, urlparse(self.page.url).query)
        self.assertFalse(any(private_pass in url for url in self.requests))
        self.assertNotIn(private_pass, self.page.evaluate('JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)])'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
