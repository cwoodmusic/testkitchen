"""Developer access in the real world with local, synthetic service identities.

Only the routed classroom service adds a verified-owner result. Production
code has no URL, storage flag, or test hook that grants developer access.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SERVICE_FIXTURE = r'''
;(()=>{
 const original=CodaClassroom, listeners=new Set();
 window.__ownerFixtureRole='guest';window.__ownerFixtureClasses=[];
 window.__setOwnerFixtureRole=role=>{window.__ownerFixtureRole=role;for(const notify of listeners)notify();};
 window.CodaClassroom={...original,create(options){
  const service=original.create(options);
  const state=()=>{
   const base=service.getState(),role=window.__ownerFixtureRole;
   const teacher=['owner','teacher','unverified'].includes(role),student=role==='student'||role==='student-owner';
   return {...base,enabled:true,configured:true,loading:false,locked:false,readOnly:false,waitingTakeover:false,
    profile:student?{kind:'student',classId:'fixture-class',profileId:'fixture-student',alias:'Blue Owl 12'}:null,
    admin:{...base.admin,signedIn:teacher,authorized:teacher,uid:teacher?'fixture-teacher':null,
     developer:role==='owner'||role==='student-owner'?true:role==='unverified'?'true':false}};
  };
  return {...service,getState:state,resume:async()=>({ok:true}),isWritable:()=>true,
   subscribe(callback){const notify=()=>callback(state());listeners.add(notify);const stop=service.subscribe(notify);return()=>{listeners.delete(notify);stop();};},
   listClasses:async()=>({ok:true,classes:window.__ownerFixtureClasses}),
   createClass:async label=>{const item={classId:'fixture-class',label};__ownerFixtureClasses.push(item);return {ok:true,...item};},
   listProfiles:async()=>({ok:true,profiles:[]})};
 }};
})();
'''


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class DeveloperOwnerWorldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000})
        self.errors, self.external, self.failed = [], [], []
        self.context.route('**/*', self.route)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
            if message.text.startswith('Arcade frame error:') else None)
        self.page.on('response', lambda response: self.failed.append(response.url)
            if response.status >= 400 and urlparse(response.url).hostname == '127.0.0.1'
            and not response.url.endswith('favicon.ico') else None)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed, [])
        self.assertEqual(self.external, [], 'Owner checks must not contact a live account')

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname != '127.0.0.1':
            self.external.append(route.request.url)
            return route.abort()
        if parsed.path == '/favicon.ico':
            return route.fulfill(status=204)
        if parsed.path == '/account-config.js':
            return route.fulfill(content_type='text/javascript', body='''
                window.ARCADE_ACCOUNTS_CONFIG={enabled:false,mode:'classroom',
                  classroom:{enabled:false,privacy:true,namespace:'classroomV1'}};''')
        if parsed.path == '/classroom-service.js':
            return route.fulfill(content_type='text/javascript',
                body=(ROOT / 'classroom-service.js').read_text() + SERVICE_FIXTURE)
        return route.continue_()

    def load(self, role='guest', query=''):
        self.page.goto(self.base + '/world-preview.html' + query, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')
        self.role(role)

    def role(self, role):
        self.page.evaluate('role=>__setOwnerFixtureRole(role)', role)
        self.page.wait_for_function('expected=>CodaArcadeQA.classroomSession().canDevelop===expected',
            arg=role == 'owner')

    def assert_denied(self):
        self.assertFalse(self.page.evaluate('CodaDeveloperOwnerAccess.canDevelop()'))
        for identifier in ['worldDeveloperBtn', 'assetToggle', 'editorToggle']:
            self.assertFalse(self.page.locator('#' + identifier).is_visible(), identifier)
            self.assertEqual(self.page.locator('#' + identifier).evaluate('node=>node.getBoundingClientRect().width'), 0,
                'Hidden controls must leave no empty header space')
        before = self.page.evaluate('JSON.stringify(CodaDeveloperConsole.getProject())')
        for key in ['F2', 'c', 'l', 'f', 'x', 'Shift+A', 'Shift+L', 'Shift+R']:
            self.page.locator('#view').focus(); self.page.keyboard.press(key)
        checks = self.page.evaluate('''()=>({
          open:CodaDeveloperConsole.open('objects'),save:CodaDeveloperConsole.save(),
          artwork:CodaDeveloperConsole.getArtworkEditor(),studio:CodaAssetStudioQA.open(),
          preset:CodaAssetStudioQA.preset(),studioSave:CodaAssetStudioQA.save(),
          foreground:CodaArcadeQA.editForegroundAt(810,600),
          room:CodaArcadeQA.roomEditor('piano'),
          roomMutation:CodaArcadeQA.applyRoomProject('piano',{version:1,assets:[],collision:[],strokes:[],entities:{}})
        })''')
        self.assertEqual(checks, {'open':False, 'save':False, 'artwork':None,
            'studio':False, 'preset':False, 'studioSave':False, 'foreground':False,
            'room':None, 'roomMutation':False})
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.getState().open'))
        debug = self.page.evaluate('CodaArcadeQA.debugState()')
        self.assertFalse(debug['collisionDebug']); self.assertFalse(debug['depthDebug'])
        self.assertTrue(debug['foregroundEnabled'])
        self.assertEqual(self.page.evaluate('JSON.stringify(CodaDeveloperConsole.getProject())'), before)

    def test_guest_student_and_other_teachers_have_no_controls_or_mutation_entry(self):
        self.load()
        for role in ['guest', 'teacher', 'student', 'student-owner', 'unverified']:
            with self.subTest(role=role):
                self.role(role); self.assert_denied()

    def test_owner_can_edit_and_revocation_closes_without_clearing_saved_project_or_player(self):
        self.load('owner')
        self.assertTrue(self.page.locator('#worldDeveloperBtn').is_visible())
        self.page.keyboard.press('F2')
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().open'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.editForegroundAt(810,600)'))
        self.page.locator('#assetPreset').click()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        before = self.page.evaluate('''()=>({project:JSON.stringify(CodaDeveloperConsole.getProject()),
          player:localStorage.getItem('musicArcadeV1'),collision:localStorage.getItem('codaCollisionEditsV891')})''')
        selected = self.page.evaluate('''()=>{const state=CodaAssetStudioQA.get();
          return state.assets.find(asset=>asset.id===state.selected);}''')
        points = self.page.evaluate('''asset=>{const bounds=document.querySelector('#view').getBoundingClientRect(),camera=CodaArcadeQA.camera();
          const point=(x,y)=>({x:bounds.left+(x-camera.x)*camera.zoom*bounds.width/1672,
            y:bounds.top+(y-camera.y)*camera.zoom*bounds.height/941});
          return [point(asset.x,asset.y),point(asset.x+40,asset.y+20)];}''', selected)
        self.page.mouse.move(**points[0]); self.page.mouse.down(); self.page.mouse.move(**points[1], steps=4)
        self.assertNotEqual(self.page.evaluate('''id=>CodaDeveloperConsole.getProject().assets.find(asset=>asset.id===id).x''', selected['id']), selected['x'])
        self.role('teacher')
        self.page.mouse.up()
        self.page.wait_for_function('!CodaDeveloperConsole.getState().open')
        self.assertFalse(self.page.locator('#assetStudio').is_visible())
        self.assertEqual(self.page.evaluate('''()=>({project:JSON.stringify(CodaDeveloperConsole.getProject()),
          player:localStorage.getItem('musicArcadeV1'),collision:localStorage.getItem('codaCollisionEditsV891')})'''), before)
        self.assert_denied()

    def test_room_developer_controls_follow_owner_permission_while_rooms_still_play(self):
        self.load('owner')
        for room, button in [('piano', 'pianoLabBtn'), ('fishing', 'fishingBtn')]:
            with self.subTest(room=room):
                self.role('owner')
                self.page.locator('#' + button).evaluate('button=>button.click()')
                self.page.wait_for_function('room=>CodaArcadeQA[room]().open', arg=room)
                self.assertTrue(self.page.evaluate('room=>CodaArcadeQA.roomEditor(room)!==null', room))
                self.page.evaluate("CodaDeveloperConsole.open('objects')")
                self.assertTrue(self.page.evaluate('room=>CodaArcadeQA.roomEditor(room).isOpen()', room))
                project = self.page.evaluate('room=>JSON.stringify(CodaArcadeQA.roomProject(room))', room)
                self.role('guest')
                self.assertIsNone(self.page.evaluate('room=>CodaArcadeQA.roomEditor(room)', room))
                self.assertEqual(self.page.evaluate('room=>JSON.stringify(CodaArcadeQA.roomProject(room))', room), project)
                self.assertFalse(self.page.locator('[data-room-dev-open]:visible').count())
                self.page.keyboard.press('F2')
                self.assertFalse(self.page.locator('.room-dev-panel:visible').count())
                self.assertTrue(self.page.evaluate('room=>CodaArcadeQA[room]().open', room))
                if room == 'piano':
                    self.page.locator('#pianoKeyboardMode').evaluate('''select=>{
                      select.value='piano';select.dispatchEvent(new Event('change',{bubbles:true}));}''')
                    self.page.locator('[data-piano-view="keyboard"]').first.evaluate('button=>button.click()')
                    self.page.locator('.piano-key[data-midi="60"]').focus()
                    self.page.keyboard.down('f')
                    try:
                        self.assertIn(65, self.page.evaluate('CodaArcadeQA.piano().held'),
                            'Blocking the world foreground shortcut must keep the piano F shortcut playable')
                    finally:
                        self.page.keyboard.up('f')
                    self.page.keyboard.press('Escape')
                self.page.keyboard.press('Escape')
                self.page.wait_for_function('room=>!CodaArcadeQA[room]().open', arg=room)

    def test_other_teacher_keeps_class_management_and_guest_keeps_avatar_and_movement(self):
        self.load('teacher')
        self.page.evaluate("CodaClassroomUIInstance.open('admin')")
        self.page.wait_for_selector('#classpassCreateClass')
        self.page.locator('#classpassClassLabel').fill('Blue music class')
        self.page.locator('#classpassCreateClass').click()
        self.page.wait_for_function('__ownerFixtureClasses.length===1')
        self.assertEqual(self.page.evaluate('__ownerFixtureClasses[0].label'), 'Blue music class')
        self.page.locator('#panelClose').click(); self.role('guest')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(1180,388)'))
        before = self.page.evaluate('CodaArcadeQA.position().x')
        self.page.locator('#view').focus(); self.page.keyboard.down('d')
        try:
            self.page.wait_for_function('before=>CodaArcadeQA.position().x>before+10', arg=before)
        finally:
            self.page.keyboard.up('d')
        self.page.locator('#avatarBtn').evaluate('button=>button.click()')
        self.assertTrue(self.page.locator('.boutique-panel').is_visible())
        self.assertFalse(self.page.locator('.boutique-panel label:has(select[data-boutique="target"]):visible').count())

    def test_url_and_browser_flags_do_not_grant_owner_access_or_unlock_test_mode(self):
        self.context.add_init_script("localStorage.setItem('developerOwner','true');localStorage.setItem('ownerVerified','true')")
        self.load(query='?dev-test=1&developer=1&ownerVerified=true')
        self.assert_denied()
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.isEnabled()'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.testMode().ownerVerified===true'))
        self.assertFalse(self.page.locator('#developerTestBanner').count())


if __name__ == '__main__':
    unittest.main(verbosity=2)
