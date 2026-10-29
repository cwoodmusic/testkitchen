"""Teacher navigation keeps a same-tab sign-in without opening another popup.

The actual title, world, boot, service, storage facade and teacher UI run in
Chromium. Only the Firebase SDK and account configuration are local doubles;
no public authentication or database service is contacted.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SERVICE = Path(os.environ.get('CODA_TEACHER_SERVICE_SOURCE', ROOT/'classroom-service.js'))

SDK = r'''
;(()=>{
 const saved=key=>sessionStorage.getItem('teacherFixture:'+key);
 const increment=key=>sessionStorage.setItem('teacherFixture:'+key,String(Number(saved(key)||0)+1));
 const user=uid=>({uid,getIdTokenResult:async()=>({signInProvider:'google.com'})});
 const snapshot=value=>({val:()=>value,child:path=>snapshot(path.split('/').reduce((v,k)=>v?.[k],value)),
   forEach:fn=>Object.entries(value||{}).forEach(([key,item])=>fn({...snapshot(item),key}))});
 const apps=[],auths=new Map();
 const data=path=>{
   if(path==='.info/serverTimeOffset')return 0;
   if(path.startsWith('classroomV1/admins/')){increment('allowlistReads');return saved('approved')!=='false';}
   if(path==='classroomV1/directory')return {class_teacher_fixture:{meta:{label:'Blue group',createdAt:1}}};
   return null;
 };
 const sdk={getApps:()=>apps,initializeApp:(_config,name)=>{const app={name};apps.push(app);return app;},
   browserSessionPersistence:'session',setPersistence:async()=>{},getDatabase:app=>({app}),
   getAuth:app=>{
     if(!auths.has(app.name)){
       const staff=app.name==='coda-classroom-admin',uid=staff?saved('authUid'):null;
       const held=staff&&uid&&saved('holdRestore')==='true';
       const auth={app,currentUser:held?null:uid?user(uid):null,authStateReady:async()=>{
         if(held){window.__teacherAuthPending=true;await new Promise(resolve=>window.__releaseTeacherAuth=()=>{
           auth.currentUser=user(uid);sessionStorage.removeItem('teacherFixture:holdRestore');resolve();
         });}
       }};auths.set(app.name,auth);
     }
     return auths.get(app.name);
   },
   GoogleAuthProvider:class{setCustomParameters(){}},
   signInWithPopup:async auth=>{increment('popups');auth.currentUser=user('teacher_fixture_uid');sessionStorage.setItem('teacherFixture:authUid',auth.currentUser.uid);return {user:auth.currentUser};},
   signOut:async auth=>{auth.currentUser=null;if(auth.app.name==='coda-classroom-admin')sessionStorage.removeItem('teacherFixture:authUid');},
   ref:(_db,path)=>({path}),get:async ref=>snapshot(data(ref.path)),
   onValue:(ref,callback)=>{queueMicrotask(()=>callback(snapshot(data(ref.path))));return ()=>{};}
 };
 const original=window.CodaClassroom;
 window.CodaClassroom=Object.freeze({...original,create:options=>original.create({...options,
   sdkLoader:async()=>{increment('sdkLoads');return sdk;},
   clock:()=>Date.now()+Number(saved('clockOffset')||0)
 })});
})();
'''


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class TeacherTitleSessionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.errors, self.failed, self.external = [], [], []
        self.context = self.browser.new_context(viewport={'width':1440,'height':1000})
        self.context.route('**/*', self.route)
        self.context.on('page', self.watch)
        self.context.add_init_script("if(location.protocol==='http:')localStorage.setItem('codaArcadeFXV1','off')")
        self.page = self.context.new_page(); self.page.set_default_timeout(10000)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed, [])
        self.assertEqual(self.external, [])

    def watch(self, page):
        page.on('pageerror', lambda e:self.errors.append(str(e)))
        page.on('console', lambda m:self.errors.append(m.text) if 'Arcade frame error:' in m.text else None)
        page.on('response', lambda r:self.failed.append(r.url) if r.status>=400 and urlparse(r.url).hostname=='127.0.0.1' else None)

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.hostname != '127.0.0.1':
            self.external.append(route.request.url); return route.abort()
        if parsed.path == '/favicon.ico':return route.fulfill(status=204)
        if parsed.path == '/account-config.js':
            config={'enabled':True,'mode':'classroom','classroom':{'enabled':True,'privacy':True,'namespace':'classroomV1'},
                'firebase':{'apiKey':'fixture-key','projectId':'demo-teacher-title','databaseURL':'https://demo-teacher-title.firebaseio.com'}}
            return route.fulfill(content_type='text/javascript',body='window.ARCADE_ACCOUNTS_CONFIG='+json.dumps(config))
        if parsed.path == '/classroom-service.js':
            return route.fulfill(content_type='text/javascript',body=SERVICE.read_text()+SDK)
        return route.continue_()

    def teacher_entry(self, page=None):
        page = page or self.page
        page.goto(self.base+'/index.html', wait_until='load')
        page.locator('#titleTeacher').click()
        page.wait_for_function('window.CodaClassroomUIInstance?.getState().open')

    def sign_in(self):
        self.teacher_entry()
        self.page.locator('#classpassAdminSignIn').click()
        self.page.locator('#classpassCreateClass').wait_for(state='visible')
        self.page.wait_for_function('!CodaClassroomUIInstance.getState().busy')
        self.assertEqual(self.popups(),1)

    def popups(self, page=None):
        return (page or self.page).evaluate('Number(sessionStorage.getItem("teacherFixture:popups")||0)')

    def test_same_tab_teacher_return_restores_tools_without_another_popup(self):
        self.sign_in()
        reads=self.page.evaluate('Number(sessionStorage.getItem("teacherFixture:allowlistReads"))')
        self.teacher_entry()
        self.page.locator('#classpassCreateClass').wait_for(state='visible')
        self.assertEqual(self.page.locator('#classpassAdminSignIn').count(),0)
        self.assertEqual(self.popups(),1)
        self.assertGreater(self.page.evaluate('Number(sessionStorage.getItem("teacherFixture:allowlistReads"))'),reads)
        self.assertTrue(self.page.evaluate('CodaClassroomSession.getState().admin.authorized'))

    def test_delayed_auth_restore_does_not_flash_a_login_or_open_a_popup(self):
        self.sign_in()
        self.page.evaluate("sessionStorage.setItem('teacherFixture:holdRestore','true')")
        self.page.goto(self.base+'/index.html',wait_until='load')
        loads=self.page.evaluate('Number(sessionStorage.getItem("teacherFixture:sdkLoads"))')
        self.assertEqual(loads,2,'A remembered sign-in receives one read-only title verification')
        self.assertEqual(self.page.locator('#titleSessionStatus').get_attribute('data-session-state'),'checking')
        self.assertFalse(self.page.evaluate('Boolean(window.CodaClassroomSession||window.CodaArcadeQA)'))
        self.page.locator('#titleTeacher').click()
        self.page.wait_for_function('window.__teacherAuthPending')
        self.assertEqual(self.page.locator('#classpassAdminSignIn:visible').count(),0)
        self.assertEqual(self.popups(),1)
        self.page.evaluate('__releaseTeacherAuth()')
        self.page.locator('#classpassCreateClass').wait_for(state='visible')
        self.assertEqual(self.popups(),1)

    def test_title_verifies_the_teacher_and_continue_and_refresh_keep_the_session(self):
        self.sign_in()
        self.page.goto(self.base+'/index.html',wait_until='load')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.page.locator('#titleSessionStatus').inner_text(),'Signed in · Teacher account')
        self.assertEqual(self.page.locator('#titleProfile strong').inner_text(),'Continue to arcade')
        self.assertEqual(self.page.locator('#titleGuest strong').inner_text(),'Play as guest')
        self.assertIn('guest=1',self.page.locator('#titleGuest').get_attribute('href'))
        self.assertEqual(self.popups(),1)
        self.page.locator('#titleProfile').click()
        self.page.wait_for_function('window.CodaClassroomSession?.getState().admin.authorized')
        self.assertFalse(self.page.evaluate('CodaClassroomUIInstance.getState().open'))
        self.page.reload(wait_until='load')
        self.page.wait_for_function('window.CodaClassroomSession?.getState().admin.authorized')
        self.assertEqual(self.page.locator('#classpassAdminSignIn:visible').count(),0)
        self.assertEqual(self.popups(),1)
        self.page.goto(self.base+'/index.html',wait_until='load')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.page.reload(wait_until='load')
        self.page.wait_for_function('document.querySelector("#titleSessionStatus").dataset.sessionState==="signed-in"')
        self.assertEqual(self.popups(),1)

    def test_opened_tab_does_not_adopt_its_openers_teacher_binding(self):
        self.sign_in()
        original=self.page.evaluate('sessionStorage.getItem("codaClassroomTabV1")')
        with self.page.expect_popup() as pending:
            self.page.evaluate('url=>window.open(url,"_blank")',self.base+'/index.html')
        other=pending.value;other.set_default_timeout(10000)
        other.wait_for_function('document.querySelector("#titleMotion")?.hidden===false')
        self.assertNotEqual(other.evaluate('sessionStorage.getItem("codaClassroomTabV1")'),original)
        other.locator('#titleTeacher').click()
        other.wait_for_function('window.CodaClassroomUIInstance?.getState().open')
        self.assertTrue(other.locator('#classpassAdminSignIn').is_visible())
        self.assertEqual(other.locator('#classpassCreateClass').count(),0)
        self.assertFalse(other.evaluate('CodaClassroomSession.getState().admin.authorized'))
        self.assertEqual(self.popups(other),1,'The inherited count must not grow without an explicit sign-in')

    def test_revoked_admin_is_rechecked_and_cannot_resume_tools(self):
        self.sign_in()
        self.page.evaluate("sessionStorage.setItem('teacherFixture:approved','false')")
        self.teacher_entry()
        self.page.wait_for_function('window.CodaClassroomSession?.getState().ready')
        self.assertEqual(self.page.locator('#classpassCreateClass').count(),0)
        self.assertFalse(self.page.evaluate('CodaClassroomSession.getState().admin.authorized'))
        self.assertIn('not a school administrator',self.page.locator('#panelBody').inner_text())
        self.assertEqual(self.popups(),1)

    def test_expired_firebase_auth_cannot_be_restored_from_the_binding_alone(self):
        self.sign_in()
        self.page.evaluate("sessionStorage.removeItem('teacherFixture:authUid')")
        self.teacher_entry()
        self.page.locator('#classpassAdminSignIn').wait_for(state='visible')
        self.assertEqual(self.page.locator('#classpassCreateClass').count(),0)
        self.assertFalse(self.page.evaluate('CodaClassroomSession.getState().admin.authorized'))
        self.assertEqual(self.popups(),1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
