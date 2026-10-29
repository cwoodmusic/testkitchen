"""Production service, DTO and Storage facade with real Firebase SDK/emulators.

Run through tools/test-classroom-service.cjs. The unsigned Google identity and
owner REST bypass below are accepted only by the explicit loopback demo
emulators; this suite refuses all deployed endpoints.
"""
import base64
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PROJECT='demo-coda-classroom-e2e'
DB_HOST=os.environ.get('FIREBASE_DATABASE_EMULATOR_HOST','')
AUTH_HOST=os.environ.get('FIREBASE_AUTH_EMULATOR_HOST','')
if not all(re.fullmatch(r'127\.0\.0\.1:[1-9][0-9]{1,4}',value) for value in (DB_HOST,AUTH_HOST)):
    raise RuntimeError('Explicit loopback Auth and Database emulators are required.')
if os.environ.get('GCLOUD_PROJECT')!=PROJECT:
    raise RuntimeError('Only the disposable demo-coda-classroom-e2e project is allowed.')
NS=PROJECT+'-default-rtdb'
HTTP=urllib.request.build_opener(urllib.request.ProxyHandler({}))


def request_json(url,value=None,method='GET',owner=False):
    if urllib.parse.urlsplit(url).hostname!='127.0.0.1':
        raise RuntimeError('Emulator request must stay on loopback.')
    headers={'Content-Type':'application/json'}
    if owner:
        headers['Authorization']='Bearer owner'
    request=urllib.request.Request(url,data=None if value is None else json.dumps(value).encode(),method=method,headers=headers)
    with HTTP.open(request,timeout=15) as response:
        return json.load(response)


def database(path='',value=None,method='GET'):
    return request_json(f'http://{DB_HOST}/{path}.json?ns={NS}',value,method,owner=True)


def teacher_token():
    encode=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
    now=int(time.time())
    return encode({'alg':'none','typ':'JWT'})+'.'+encode({'iss':'https://accounts.google.com','aud':'classroom-local-test','sub':'teacher-local-e2e','email':'teacher@example.invalid','email_verified':True,'iat':now,'exp':now+3600})+'.'


class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*_args):
        pass

    def do_GET(self):
        if self.path.split('?')[0]=='/fixture-sdk.js':
            body=self.server.sdk_bundle
            self.send_response(200)
            self.send_header('Content-Type','text/javascript')
            self.send_header('Content-Length',str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.split('?')[0]!='/classroom-service-fixture':
            return super().do_GET()
        body=b'''<!doctype html><meta charset="utf-8"><title>Private classroom integration fixture</title>
<script src="/classroom-profile-data.js"></script><script src="/classroom-storage.js"></script>
<script src="/classroom-service.js"></script><script src="/fixture-sdk.js"></script>
<script>
window.fixtureNative=localStorage;window.fixtureEvents=[];window.fixtureTimers=[];
window.fixtureScope=CodaClassroomStorage.create({window,keys:CodaClassroomProfileData.SCOPED_KEYS});fixtureScope.install();
window.fixtureStart=opts=>{
 const nativeInterval=window.setInterval;
 window.setInterval=(fn,delay)=>{fixtureTimers.push({fn,delay});return nativeInterval.call(window,fn,delay);};
 try{window.fixtureService=CodaClassroom.create({window,clock:()=>window.fixtureNow??Date.now(),config:{firebase:{apiKey:'fake-api-key',projectId:'demo-coda-classroom-e2e',databaseURL:'https://demo-coda-classroom-e2e-default-rtdb.firebaseio.com',authDomain:'demo-coda-classroom-e2e.firebaseapp.com'},classroom:{enabled:opts.enabled!==false,namespace:'classroomV1',emulators:opts.emulators}},storageScope:fixtureScope,sdkLoader:async()=>fixtureSDK,storage:fixtureNative,sessionStorage,onIdentityChange:event=>fixtureEvents.push({type:'identity',...event}),onLock:event=>fixtureEvents.push({type:'lock',...event})});}finally{window.setInterval=nativeInterval;}
 return true;
};
window.fixtureProgress=(xp,notes)=>{const result=CodaClassroomProfileData.capture(localStorage);if(!result.ok)throw Error(result.error);const data=result.data;data.progression.events=[{id:'game:fixture:'+xp,xp}];data.progression.xp=xp;data.wallet.balance=150+notes;data.wallet.earned=150+notes;data.wallet.rewards=['game:fixture:'+notes];const applied=CodaClassroomProfileData.apply(localStorage,data);if(!applied.ok)throw Error(applied.error);return CodaClassroomProfileData.capture(localStorage).data;};
window.fixtureReady=true;
</script>'''
        self.send_response(200)
        self.send_header('Content-Type','text/html')
        self.send_header('Content-Length',str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ClassroomServiceBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        tools=Path(os.environ.get('CODA_FIREBASE_TEST_TOOLS','/tmp/coda-classroom-emulator'))
        cls.build=tempfile.TemporaryDirectory(prefix='coda-classroom-sdk-')
        build_path=Path(cls.build.name)
        source=build_path/'entry.js'
        source.write_text("import * as app from 'firebase/app';import * as auth from 'firebase/auth';import * as database from 'firebase/database';window.fixtureSDK={...app,...auth,...database,signInWithPopup:async instance=>auth.signInWithCredential(instance,auth.GoogleAuthProvider.credential(window.fixtureTeacherToken))};")
        output=build_path/'bundle.js'
        builder="const e=require(process.argv[1]);e.buildSync({entryPoints:[process.argv[2]],outfile:process.argv[3],bundle:true,platform:'browser',format:'iife',nodePaths:[process.argv[4]],logLevel:'error'});"
        subprocess.run(['node','-e',builder,str(tools/'node_modules/esbuild'),str(source),str(output),str(tools/'node_modules')],check=True)
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        cls.server.sdk_bundle=output.read_bytes()
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/classroom-service-fixture'
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop();cls.server.shutdown();cls.server.server_close();cls.build.cleanup()

    def setUp(self):
        request_json(f'http://{AUTH_HOST}/emulator/v1/projects/{PROJECT}/accounts',method='DELETE')
        database(value={},method='PUT')
        self.token=teacher_token()
        teacher=request_json(f'http://{AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key',{'postBody':urllib.parse.urlencode({'id_token':self.token,'providerId':'google.com'}),'requestUri':'http://localhost','returnSecureToken':True,'returnIdpCredential':True},'POST')
        self.teacher_uid=teacher['localId']
        database('classroomV1/admins/'+self.teacher_uid,True,'PUT')
        self.contexts=[];self.page_errors=[];self.external=[]
        self.admin=self.device()
        self.assert_ok(self.call(self.admin,'adminSignIn'))
        self.class_id=self.call(self.admin,'createClass','Blue group')['classId']
        self.card=self.call(self.admin,'createProfile',self.class_id)
        self.assert_ok(self.card)

    def tearDown(self):
        for context in self.contexts:
            context.close()
        self.assertEqual(self.page_errors,[],'Production service/facade should not throw browser errors')
        self.assertEqual(self.external,[],'No live/public Firebase or QR service traffic')

    def device(self,context=None):
        if context is None:
            context=self.browser.new_context()
            self.contexts.append(context)
            def route(request_route):
                host=urllib.parse.urlsplit(request_route.request.url).hostname
                if host!='127.0.0.1':
                    self.external.append(request_route.request.url);request_route.abort()
                else:
                    request_route.continue_()
            context.route('**/*',route)
        page=context.new_page();page.on('pageerror',lambda error:self.page_errors.append(str(error)))
        page.on('websocket',lambda socket:self.external.append(socket.url) if urllib.parse.urlsplit(socket.url).hostname!='127.0.0.1' else None)
        page.goto(self.url);page.wait_for_function('window.fixtureReady')
        self.start(page)
        return page

    def start(self,page,enabled=True):
        page.evaluate('token=>window.fixtureTeacherToken=token',self.token)
        page.evaluate('opts=>fixtureStart(opts)',{'enabled':enabled,'emulators':{'auth':'http://'+AUTH_HOST,'database':{'host':'127.0.0.1','port':int(DB_HOST.split(':')[1])}}})

    def call(self,page,method,*args):
        return page.evaluate('async({method,args})=>await fixtureService[method](...args)',{'method':method,'args':args})

    def assert_ok(self,result):
        self.assertTrue(result.get('ok'),result)

    def join(self,page,card=None):
        result=self.call(page,'join',(card or self.card)['link'])
        self.assert_ok(result)
        self.assertTrue(self.call(page,'isWritable'))

    def cloud(self,card=None):
        return database('classroomV1/classes/'+self.class_id+'/profiles/'+(card or self.card)['profileId'])

    def test_legacy_six_lessons_migrate_and_exam_checkpoints_stay_private_across_profiles(self):
        profile_path='classroomV1/classes/'+self.class_id+'/profiles/'+self.card['profileId']
        legacy=self.cloud()['state']
        legacy['data'].pop('finalExam',None)
        for slot in ['lessons','quizzes']:
            legacy['data'][slot][slot].pop('dynamics',None)
            legacy['data'][slot][slot].pop('tempo',None)
        self.assertEqual(len(legacy['data']['lessons']['lessons']),6)
        database(profile_path+'/state',legacy,'PUT')
        student=self.device()
        student.evaluate("""()=>{
          const exam=CodaClassroomProfileData.blank().finalExam;exam.size=80;
          localStorage.codaHaydnFinalExamV1=JSON.stringify(exam);
          localStorage.codaSongMachineDraftV1='PRIVATE GUEST SONG DRAFT';
        }""")
        self.join(student)
        restored=student.evaluate('CodaClassroomProfileData.capture(localStorage)')
        self.assertTrue(restored['ok'],restored)
        self.assertEqual(len(restored['data']['lessons']['lessons']),8)
        self.assertEqual(restored['data']['finalExam']['size'],40)
        self.assertEqual(restored['data']['finalExam']['questionIds'],[])
        self.assertIsNone(student.evaluate('localStorage.getItem("codaSongMachineDraftV1")'))
        saved=student.evaluate("""()=>{
          const data=CodaClassroomProfileData.capture(localStorage).data,exam=data.finalExam;
          exam.size=24;exam.questionIds=Object.keys(exam.bestByCategory).flatMap(category=>Array.from({length:3},(_,index)=>category+'-'+String(index+1).padStart(3,'0')));
          exam.orders=exam.questionIds.map((_,index)=>index%6);exam.answers=exam.questionIds.map((_,index)=>index<7?index%3:-1);exam.index=7;
          data.lessons.lessons.dynamics={step:8,completed:true,completedAt:400};
          data.quizzes.quizzes.dynamics={bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:400};
          data.lessons.lessons.tempo={step:3,completed:false,completedAt:0};
          data.progression.events.push({id:'achievement:classroom-dynamics',xp:50});data.progression.xp+=50;
          const applied=CodaClassroomProfileData.apply(localStorage,data);if(!applied.ok)throw Error(applied.error);
          localStorage.codaSongMachineDraftV1='PRIVATE STUDENT A SONG DRAFT';return data;
        }""")
        self.assert_ok(self.call(student,'flush'))
        cloud=self.cloud()['state']['data']
        self.assertEqual(cloud['finalExam'],saved['finalExam'])
        self.assertEqual(len(cloud['lessons']['lessons']),8)
        self.assertEqual(cloud['progression']['xp'],50)
        self.assertNotIn('PRIVATE',json.dumps(cloud))
        self.assertNotIn('codaSongMachineDraftV1',json.dumps(cloud))
        student.reload();student.wait_for_function('window.fixtureReady');self.start(student)
        self.assert_ok(self.call(student,'resume'))
        self.assertTrue(self.call(student,'isWritable'))
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data'),saved)
        self.assertEqual(student.evaluate('localStorage.codaSongMachineDraftV1'),'PRIVATE STUDENT A SONG DRAFT','This player keeps its local draft on reload')
        self.assert_ok(self.call(student,'leave'))
        self.assertEqual(student.evaluate('JSON.parse(localStorage.codaHaydnFinalExamV1).size'),80)
        self.assertEqual(student.evaluate('localStorage.codaSongMachineDraftV1'),'PRIVATE GUEST SONG DRAFT')
        next_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(next_card)
        self.join(student,next_card)
        fresh=student.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        self.assertEqual(fresh['finalExam']['questionIds'],[])
        self.assertFalse(fresh['lessons']['lessons']['dynamics']['completed'])
        self.assertEqual(fresh['progression']['xp'],0)
        self.assertIsNone(student.evaluate('localStorage.getItem("codaSongMachineDraftV1")'))
        self.assert_ok(self.call(student,'leave'))
        other=self.device();self.join(other)
        reopened=other.evaluate('CodaClassroomProfileData.capture(localStorage)')
        self.assertTrue(reopened['ok'],reopened)
        self.assertEqual(reopened['data'],saved,'Another device resumes every saved exam answer, shuffle and lesson checkpoint')
        self.assertIsNone(other.evaluate('localStorage.getItem("codaSongMachineDraftV1")'))

    def test_card_is_private_and_guest_work_restores_without_uploading_names_or_takes(self):
        student=self.device()
        guest={'version':1,'name':'PRIVATE GUEST NAME','email':'private-student@example.invalid','shirt':'#abcdef'}
        student.evaluate('guest=>{localStorage.musicArcadeV1=JSON.stringify(guest);localStorage.codaPianoTakeV1="PRIVATE RECORDING";localStorage.developerLayout="PRIVATE EDITOR"}',guest)
        self.join(student)
        self.assertIsNone(student.evaluate('localStorage.getItem("codaPianoTakeV1")'))
        student.evaluate('fixtureProgress(20,12)')
        self.assert_ok(self.call(student,'flush'))
        cloud=database('classroomV1')
        serialized=json.dumps(cloud)
        for value in [self.card['pass'],'PRIVATE GUEST NAME','private-student@example.invalid','PRIVATE RECORDING','PRIVATE EDITOR','teacher@example.invalid']:
            self.assertNotIn(value,serialized)
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],20)
        self.assertEqual(self.cloud()['state']['data']['wallet']['balance'],162)
        self.assert_ok(self.call(student,'leave'))
        self.assertEqual(student.evaluate('JSON.parse(localStorage.musicArcadeV1)'),guest)
        self.assertEqual(student.evaluate('localStorage.codaPianoTakeV1'),'PRIVATE RECORDING')
        self.assertIsNone(student.evaluate('fixtureNative.getItem("codaClassroomWorkspaceV1")'))

    def test_two_devices_restore_progress_and_explicit_takeover_revokes_old_writes(self):
        first=self.device();self.join(first);first.evaluate('fixtureProgress(25,16)');self.assert_ok(self.call(first,'flush'))
        second=self.device()
        result=self.call(second,'join',self.card['pass'])
        self.assertEqual(result.get('code'),'profile-in-use')
        self.assertTrue(self.call(second,'getState')['waitingTakeover'])
        self.assert_ok(self.call(second,'takeOver'))
        first.wait_for_function('fixtureService.getState().locked')
        saved=second.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        self.assertEqual(saved['progression']['xp'],25);self.assertEqual(saved['wallet']['balance'],166)
        second.evaluate('fixtureProgress(40,22)');self.assert_ok(self.call(second,'flush'))
        self.assertFalse(self.call(first,'flush')['ok'])
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],40)

    def test_blank_profile_still_clears_all_other_students_local_only_work(self):
        student=self.device()
        local_keys=student.evaluate('CodaClassroomProfileData.LOCAL_ONLY_KEYS')
        student.evaluate('keys=>{for(const key of keys)localStorage.setItem(key,"PRIVATE LOCAL WORK");}',local_keys)
        self.join(student)
        self.assertEqual(student.evaluate('CodaClassroomProfileData.LOCAL_ONLY_KEYS.map(key=>localStorage.getItem(key))'),[None]*len(local_keys))
        self.assert_ok(self.call(student,'leave'))
        self.assertEqual(student.evaluate('CodaClassroomProfileData.LOCAL_ONLY_KEYS.map(key=>localStorage.getItem(key))'),['PRIVATE LOCAL WORK']*len(local_keys))

    def test_reload_resumes_same_tab_without_erasing_saved_progress(self):
        student=self.device();self.join(student);student.evaluate('fixtureProgress(30,15)');self.assert_ok(self.call(student,'flush'))
        student.evaluate('for(const key of CodaClassroomProfileData.LOCAL_ONLY_KEYS)localStorage.setItem(key,"MY LOCAL WORK")')
        before=student.evaluate('fixtureScope.getState().marker')
        student.reload();student.wait_for_function('window.fixtureReady');self.start(student)
        self.assert_ok(self.call(student,'resume'))
        self.assertTrue(self.call(student,'isWritable'))
        self.assertEqual(student.evaluate('fixtureScope.getState().tabId'),before['tabId'])
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),30)
        self.assertEqual(student.evaluate('CodaClassroomProfileData.LOCAL_ONLY_KEYS.map(key=>localStorage.getItem(key))'),['MY LOCAL WORK']*len(student.evaluate('CodaClassroomProfileData.LOCAL_ONLY_KEYS')))

    def test_enrollment_disabled_never_opens_a_student_session(self):
        student=self.device();student.evaluate('fixtureService.destroy()');self.start(student,enabled=False)
        self.assertEqual(self.call(student,'join',self.card['pass']),{'ok':False,'code':'classroom-not-enabled'})
        self.assertFalse(self.call(student,'getState')['ready'])
        self.assertIsNone(database('classroomV1/sessions'))

    def test_revoked_teacher_allowlist_immediately_removes_admin_authority(self):
        self.assertTrue(self.call(self.admin,'getState')['admin']['authorized'])
        database('classroomV1/admins/'+self.teacher_uid,method='DELETE')
        self.admin.wait_for_function('!fixtureService.getState().admin.authorized',timeout=5000)
        self.assertEqual(self.call(self.admin,'listClasses').get('code'),'admin-not-approved')
        self.assertFalse(self.call(self.admin,'createProfile',self.class_id)['ok'])
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],0)

    def test_admin_inactivity_keeps_sign_in_without_changing_student_progress(self):
        self.assertTrue(self.call(self.admin,'getState')['admin']['authorized'])
        self.admin.evaluate('async()=>{window.fixtureNow=Date.now()+601000;for(const timer of fixtureTimers.filter(timer=>timer.delay===10000))await timer.fn();}')
        self.assertTrue(self.call(self.admin,'getState')['admin']['signedIn'])
        self.assertTrue(self.call(self.admin,'getState')['admin']['authorized'])
        self.assertEqual(self.admin.evaluate('fixtureTimers.filter(timer=>timer.delay===10000).length'),0)
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],0)

    def test_status_inspection_verifies_student_without_activating_or_writing_progress(self):
        student=self.device();self.join(student);student.evaluate('fixtureProgress(30,15)');self.assert_ok(self.call(student,'flush'))
        before=student.evaluate('fixtureScope.getState().marker')
        cloud_before=self.cloud()['state']
        student.reload();student.wait_for_function('window.fixtureReady');self.start(student)
        local_before=student.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        inspected=self.call(student,'inspectSession')
        self.assertTrue(inspected.get('ok'),inspected)
        self.assertTrue(inspected['signedIn']);self.assertEqual(inspected['kind'],'student')
        self.assertEqual(inspected['alias'],self.card['alias'])
        self.assertIsNone(self.call(student,'getState')['profile'],'The title check must not open or claim a player')
        self.assertEqual(student.evaluate('fixtureScope.getState().marker'),before)
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data'),local_before)
        self.assertEqual(self.cloud()['state'],cloud_before)
        self.assert_ok(self.call(student,'resume'))
        self.assertTrue(self.call(student,'isWritable'))

    def test_students_keep_their_own_profiles_after_inactivity_and_refresh(self):
        other=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(other)
        for index,card in enumerate([self.card,other]):
            with self.subTest(alias=card['alias']):
                student=self.device();self.join(student,card);student.evaluate('xp=>fixtureProgress(xp,15)',30+index)
                student.evaluate('''()=>{
                  window.fixtureNow=Date.now()+601000;
                  for(const timer of fixtureTimers.filter(timer=>timer.delay===10000))timer.fn();
                }''')
                self.assertEqual(student.evaluate('fixtureTimers.filter(timer=>timer.delay===10000).length'),0)
                self.assertTrue(self.call(student,'isWritable'))
                self.assertEqual(self.call(student,'getState')['profile']['alias'],card['alias'])
                self.assert_ok(self.call(student,'flush'))
                student.reload();student.wait_for_function('window.fixtureReady');self.start(student)
                self.assert_ok(self.call(student,'resume'))
                self.assertTrue(self.call(student,'isWritable'))
                self.assertEqual(self.call(student,'getState')['profile']['alias'],card['alias'])
                self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),30+index)

    def test_teacher_reissues_without_reading_old_pass_and_deletion_revokes_new_card(self):
        student=self.device();self.join(student);student.evaluate('fixtureProgress(35,20)');self.assert_ok(self.call(student,'flush'))
        old_hash=self.cloud()['meta']['passHash']
        replacement=self.call(self.admin,'reissuePass',self.class_id,self.card['profileId']);self.assert_ok(replacement)
        self.assertNotEqual(replacement['pass'],self.card['pass'])
        student.wait_for_function('fixtureService.getState().locked')
        self.assertIsNone(database('classroomV1/passes/'+old_hash))
        other=self.device();self.assertFalse(self.call(other,'join',self.card['pass'])['ok'])
        self.join(other,replacement)
        self.assertEqual(other.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),35)
        self.assert_ok(self.call(self.admin,'deleteProfile',self.class_id,self.card['profileId']))
        other.wait_for_function('fixtureService.getState().locked')
        self.assertIsNone(self.cloud())
        self.assertFalse(self.call(self.device(),'join',replacement['pass'])['ok'])

    def test_failed_card_switch_keeps_existing_revocation_watchers_active(self):
        student=self.device();self.join(student)
        unavailable=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(unavailable)
        self.assert_ok(self.call(self.admin,'deleteProfile',self.class_id,unavailable['profileId']))
        self.assertFalse(self.call(student,'join',unavailable['pass'])['ok'])
        replacement=self.call(self.admin,'reissuePass',self.class_id,self.card['profileId']);self.assert_ok(replacement)
        student.wait_for_function('fixtureService.getState().locked',timeout=5000)
        self.assertFalse(self.call(student,'isWritable'))

    def test_reopening_the_same_card_keeps_revocation_watchers_active(self):
        student=self.device();self.join(student);self.join(student)
        self.assert_ok(self.call(self.admin,'reissuePass',self.class_id,self.card['profileId']))
        student.wait_for_function('fixtureService.getState().locked',timeout=5000)
        self.assertFalse(self.call(student,'isWritable'))

    def test_same_browser_tabs_never_read_or_overwrite_another_students_native_workspace(self):
        first=self.device();self.join(first);first.evaluate('fixtureProgress(45,25)');self.assert_ok(self.call(first,'flush'))
        second_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(second_card)
        second=self.device(first.context)
        self.assertIsNone(second.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.join(second,second_card)
        first.wait_for_function('fixtureService.getState().locked')
        second.evaluate('fixtureProgress(55,30)');self.assert_ok(self.call(second,'flush'))
        first.evaluate('localStorage.codaNotesWalletV1="late old tab"')
        self.assertEqual(second.evaluate('JSON.parse(localStorage.codaNotesWalletV1).balance'),180)
        self.assertEqual(self.cloud(second_card)['state']['data']['progression']['xp'],55)
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],45)

    def test_opened_tab_cannot_restore_the_openers_cloned_private_guest_backup(self):
        first=self.device()
        first.evaluate('localStorage.musicArcadeV1=JSON.stringify({version:1,name:"PRIVATE OPENER GUEST"});localStorage.codaPianoTakeV1="PRIVATE OPENER RECORDING"')
        self.join(first)
        second_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(second_card)
        with first.expect_popup() as event:
            first.evaluate('url=>window.open(url,"_blank")',self.url)
        second=event.value;second.on('pageerror',lambda error:self.page_errors.append(str(error)))
        second.wait_for_function('window.fixtureReady');self.start(second)
        self.assertIsNone(second.evaluate('localStorage.getItem("musicArcadeV1")'))
        # Closing the original tab leaves its already-copied session backup in
        # the popup, as on a classroom device where the old tab was discarded.
        first.close()
        self.join(second,second_card)
        self.assert_ok(self.call(second,'leave'))
        self.assertNotIn('PRIVATE OPENER',second.evaluate('JSON.stringify([localStorage.getItem("musicArcadeV1"),localStorage.getItem("codaPianoTakeV1")])'))

    def test_opened_tab_does_not_inherit_teachers_copied_google_admin_session(self):
        self.assertTrue(self.call(self.admin,'getState')['admin']['authorized'])
        with self.admin.expect_popup() as event:
            self.admin.evaluate('url=>window.open(url,"_blank")',self.url)
        child=event.value;child.on('pageerror',lambda error:self.page_errors.append(str(error)))
        child.wait_for_function('window.fixtureReady');self.start(child)
        self.assert_ok(self.call(child,'connect'))
        self.assertFalse(self.call(child,'getState')['admin']['signedIn'])
        self.assertFalse(self.call(child,'getState')['admin']['authorized'])
        self.assertEqual(self.call(child,'listClasses').get('code'),'admin-not-approved')
        self.assertTrue(self.call(self.admin,'getState')['admin']['authorized'])
        self.assert_ok(self.call(self.admin,'listClasses'))

    def test_offline_save_keeps_local_progress_until_reconnection(self):
        student=self.device();self.join(student)
        student.context.set_offline(True)
        student.evaluate('fixtureSDK.goOffline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==="coda-classroom")));fixtureProgress(65,40);window.fixtureSave=fixtureService.flush().then(result=>window.fixtureSaveResult=result);true')
        student.wait_for_function('fixtureService.getState().pending')
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),65)
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],0)
        student.context.set_offline(False)
        student.evaluate('fixtureSDK.goOnline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==="coda-classroom")))')
        student.wait_for_function('window.fixtureSaveResult',timeout=20000)
        self.assert_ok(student.evaluate('fixtureSaveResult'))
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],65)

    def test_reload_after_offline_save_preserves_unsent_progress_for_the_same_profile(self):
        student=self.device();self.join(student)
        student.evaluate('fixtureSDK.goOffline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==="coda-classroom")));fixtureProgress(75,45);window.fixtureSave=fixtureService.flush();true')
        student.wait_for_function('fixtureService.getState().pending')
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],0)
        student.reload();student.wait_for_function('window.fixtureReady');self.start(student)
        self.assert_ok(self.call(student,'resume'))
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),75)
        self.assert_ok(self.call(student,'flush'))
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],75)

    def test_stale_unsent_progress_never_overwrites_newer_device_until_saved_choice(self):
        first=self.device();self.join(first)
        first.evaluate('fixtureSDK.goOffline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==="coda-classroom")));fixtureProgress(85,50);window.fixtureSave=fixtureService.flush();true')
        first.wait_for_function('fixtureService.getState().pending')
        second=self.device()
        self.assertEqual(self.call(second,'join',self.card['pass']).get('code'),'profile-in-use')
        self.assert_ok(self.call(second,'takeOver'))
        second.evaluate('fixtureProgress(95,60)');self.assert_ok(self.call(second,'flush'))
        first.reload();first.wait_for_function('window.fixtureReady');self.start(first)
        self.assertEqual(self.call(first,'resume').get('code'),'profile-in-use')
        self.assertEqual(self.call(first,'takeOver').get('code'),'unsaved-conflict')
        self.assertFalse(self.call(first,'isWritable'))
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],95)
        self.assertEqual(first.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),85)
        self.assert_ok(self.call(first,'useSavedProgress'))
        self.assertTrue(self.call(first,'isWritable'))
        self.assertEqual(first.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),95)
        self.assertEqual(self.cloud()['state']['data']['progression']['xp'],95)


if __name__=='__main__':
    unittest.main(verbosity=2)
