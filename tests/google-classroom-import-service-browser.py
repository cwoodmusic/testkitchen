"""Google Classroom imports with the real service, Firebase SDK, and local rules.

Run: node tools/test-classroom-service.cjs --google-classroom
Google OAuth and roster responses are explicit in-memory doubles. The shared
fixture refuses deployed Firebase endpoints and all other external traffic.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('google_import_service_fixture',
    Path(__file__).with_name('classroom-service-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
]
COURSE = 'course_101'
STUDENTS = [
    {'userId': 'student_101', 'name': 'Avery Private Student'},
    {'userId': 'student_102', 'name': 'Jordan Private Student'},
    {'userId': 'student_103', 'name': 'Morgan Private Student'},
]

GOOGLE_FIXTURE = r'''()=>{
 window.googlePopupCalls=[];window.googleRequests=[];
 window.googleTestStudents=[
  {userId:'student_101',name:'Avery Private Student'},
  {userId:'student_102',name:'Jordan Private Student'},
  {userId:'student_103',name:'Morgan Private Student'}
 ];
 window.googleHoldRoster=false;
 window.googleImportErrors=[];
 const importer=CodaClassroomRosterImport;
 window.CodaClassroomRosterImport={create:options=>{
  const wrapped={...options};
  for(const name of ['read','update','online','random','hashPass','blank','receipt','serverTimestamp']){
   wrapped[name]=(...args)=>{
    const capture=error=>{googleImportErrors.push({operation:name,code:error?.code||'',message:String(error?.message||error)});throw error;};
    try{const result=options[name](...args);return result?.then?result.catch(capture):result;}catch(error){return capture(error);}
   };
  }
  return importer.create(wrapped);
 }};
 const token='test-only-classroom-access-token';
 const originalCredential=fixtureSDK.GoogleAuthProvider.credentialFromResult;
 fixtureSDK.GoogleAuthProvider.credentialFromResult=result=>result?.googleTestCredential||originalCredential(result);
 fixtureSDK.reauthenticateWithPopup=async(user,provider)=>{
  const scopes=provider.scopes||provider._scopes||provider.getScopes?.()||[];
  googlePopupCalls.push({uid:user.uid,scopes:[...scopes]});
  if(window.googlePopupError)throw {code:window.googlePopupError};
  return {user,googleTestCredential:{accessToken:token},_tokenResponse:{oauthAccessToken:token,expiresIn:'3600'}};
 };
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(value,options={})=>{
  const url=new URL(String(value),location.href);
  if(url.hostname!=='classroom.googleapis.com')return nativeFetch(value,options);
  const headers=new Headers(options.headers||{});
  googleRequests.push({url:url.href,method:options.method||'GET',authorization:headers.get('Authorization'),credentials:options.credentials});
  const students=url.pathname.endsWith('/students');
  if(students&&googleHoldRoster){
   await new Promise((resolve,reject)=>{
    window.googleReleaseRoster=resolve;
    if(options.signal?.aborted)return reject(new DOMException('Aborted','AbortError'));
    options.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
   });
  }
  if(window.googleResponseError)return new Response(JSON.stringify({error:googleResponseError}),{status:googleResponseStatus||403,headers:{'Content-Type':'application/json'}});
  let body;
  if(students){
   const start=url.searchParams.has('pageToken')?2:0;
   const rows=googleTestStudents.slice(start,start===0?2:undefined);
   body={students:rows.map(row=>({userId:row.userId,profile:{name:{fullName:row.name}}}))};
   if(start===0&&googleTestStudents.length>2)body.nextPageToken='students-page-2';
  }else{
   body=url.searchParams.has('pageToken')
    ?{courses:[{id:'course_102',name:'Second class',section:'Grade 5'}]}
    :{courses:[{id:'course_101',name:'Music Crew',section:'Grade 4'}],nextPageToken:'courses-page-2'};
  }
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
}'''


class GoogleClassroomImportServiceTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ClassroomServiceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ClassroomServiceBrowserTests.tearDownClass.__func__)
    setUp = fixture.ClassroomServiceBrowserTests.setUp
    tearDown = fixture.ClassroomServiceBrowserTests.tearDown
    device = fixture.ClassroomServiceBrowserTests.device
    call = fixture.ClassroomServiceBrowserTests.call
    assert_ok = fixture.ClassroomServiceBrowserTests.assert_ok
    join = fixture.ClassroomServiceBrowserTests.join
    cloud = fixture.ClassroomServiceBrowserTests.cloud

    def start(self, page, enabled=True):
        for name in ['google-classroom.js', 'classroom-roster-import.js']:
            page.add_script_tag(path=str(fixture.ROOT/name))
        page.evaluate(GOOGLE_FIXTURE)
        fixture.ClassroomServiceBrowserTests.start(self, page, enabled)

    def connect(self, page=None):
        page = page or self.admin
        self.assert_ok(self.call(page, 'connectGoogleClassroom'))
        courses = self.call(page, 'listGoogleClassroomCourses')
        self.assert_ok(courses)
        self.assertEqual([course['id'] for course in courses['courses']], [COURSE, 'course_102'])
        return courses

    def roster(self, page=None):
        page = page or self.admin
        result = self.call(page, 'loadGoogleClassroomRoster', COURSE)
        self.assert_ok(result)
        self.assertEqual(result['students'], STUDENTS)
        return result['students']

    def request(self, class_id=None, students=None, choices=None):
        request = {'courseId': COURSE, 'students': students or STUDENTS, 'label': 'Music Crew'}
        if class_id:
            request['classId'] = class_id
        if choices is not None:
            request['choices'] = choices
        return request

    def create_choices(self):
        return [{'userId': row['userId'], 'action': 'create'} for row in STUDENTS]

    def assert_private_storage(self, page):
        stored = page.evaluate('JSON.stringify({local:localStorage,session:sessionStorage,state:fixtureService.getState()})')
        self.assertNotIn('test-only-classroom-access-token', stored)
        for row in STUDENTS:
            self.assertNotIn(row['name'], stored)

    def test_readonly_connection_preserves_teacher_player_and_uses_paginated_bearer_gets(self):
        self.admin.evaluate('fixtureProgress(830,420)')
        self.assert_ok(self.call(self.admin, 'savePersonalPlayer'))
        before = self.call(self.admin, 'getState')
        cloud_before = fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid)
        self.connect()
        self.roster()
        after = self.call(self.admin, 'getState')
        self.assertEqual(after['profile'], before['profile'])
        self.assertEqual(after['admin']['uid'], before['admin']['uid'])
        self.assertTrue(self.call(self.admin, 'isWritable'))
        self.assertEqual(fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid), cloud_before)
        popups = self.admin.evaluate('googlePopupCalls')
        self.assertEqual(len(popups), 1)
        self.assertEqual(popups[0]['uid'], self.teacher_uid)
        self.assertEqual(sorted(scope for scope in popups[0]['scopes'] if 'classroom.' in scope), sorted(SCOPES))
        self.assertTrue(set(popups[0]['scopes']).issubset(set(SCOPES)|{'profile', 'email', 'openid'}))
        requests = self.admin.evaluate('googleRequests')
        self.assertEqual(len(requests), 4)
        self.assertTrue(all(row['method'] == 'GET' for row in requests))
        self.assertTrue(all(row['authorization'] == 'Bearer test-only-classroom-access-token' for row in requests))
        self.assertTrue(all(row['credentials'] == 'omit' for row in requests))
        self.assertTrue(all('access_token' not in row['url'] and 'test-only' not in row['url'] for row in requests))
        self.assertTrue(all('email' not in row['url'].lower() and 'photo' not in row['url'].lower() for row in requests))
        self.assert_private_storage(self.admin)

    def test_bulk_new_profiles_are_atomic_private_and_idempotent_with_working_cards(self):
        self.connect()
        self.roster()
        before = fixture.database('classroomV1')
        preview = self.call(self.admin, 'previewRosterImport', self.request())
        self.assert_ok(preview)
        self.assertTrue(preview['newClass'])
        self.assertEqual(fixture.database('classroomV1'), before, 'Preview is read-only')
        imported = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assertTrue(imported.get('ok'), {'result': imported, 'errors': self.admin.evaluate('googleImportErrors')})
        self.assertEqual(imported['created'], 3)
        self.assertEqual(len(imported['cards']), 3)
        self.assertEqual(len({card['profileId'] for card in imported['cards']}), 3)
        class_id = imported['classId']
        data = fixture.database('classroomV1')
        self.assertEqual(len(data['classes'][class_id]['profiles']), 3)
        self.assertEqual(len(data['directory'][class_id]['profiles']), 3)
        links = data['classroomImports'][self.teacher_uid][COURSE]
        self.assertEqual(links['classId'], class_id)
        self.assertEqual(len(links['students']), 3)
        stored = json.dumps(data)
        self.assertNotIn('test-only-classroom-access-token', stored)
        for row in STUDENTS:
            self.assertNotIn(row['name'], stored)
        for card in imported['cards']:
            self.assertNotIn(card['pass'], stored)
            self.assertEqual(links['students'][card['userId']]['profileId'], card['profileId'])
        profile_ids = set(data['classes'][class_id]['profiles'])
        passes = copy.deepcopy(data['passes'])
        repeated = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assert_ok(repeated)
        self.assertEqual(repeated['created'], 0)
        self.assertEqual(repeated['cards'], [])
        self.assertEqual(set(fixture.database('classroomV1/classes/'+class_id+'/profiles')), profile_ids)
        self.assertEqual(fixture.database('classroomV1/passes'), passes)
        student = self.device()
        self.join(student, imported['cards'][0])
        self.assertEqual(self.call(student, 'getState')['profile']['profileId'], imported['cards'][0]['profileId'])
        self.assert_private_storage(self.admin)

    def test_existing_profile_link_preserves_original_card_and_progress(self):
        student = self.device()
        self.join(student)
        student.evaluate('fixtureProgress(510,300)')
        self.assert_ok(self.call(student, 'flush'))
        before = copy.deepcopy(self.cloud())
        passes = copy.deepcopy(fixture.database('classroomV1/passes'))
        self.connect()
        self.roster()
        preview = self.call(self.admin, 'previewRosterImport', self.request(class_id=self.class_id))
        self.assert_ok(preview)
        self.assertFalse(preview['newClass'])
        self.assertIn(self.card['profileId'], [profile['profileId'] for profile in preview['profiles']])
        choices = [
            {'userId': STUDENTS[0]['userId'], 'action': 'link', 'profileId': self.card['profileId']},
            {'userId': STUDENTS[1]['userId'], 'action': 'create'},
            {'userId': STUDENTS[2]['userId'], 'action': 'skip'},
        ]
        imported = self.call(self.admin, 'importRoster', self.request(class_id=self.class_id, choices=choices))
        self.assertTrue(imported.get('ok'), {'result': imported, 'errors': self.admin.evaluate('googleImportErrors')})
        self.assertEqual(imported['classId'], self.class_id)
        self.assertEqual(imported['linked'], 1)
        self.assertEqual(imported['created'], 1)
        self.assertEqual(len(imported['cards']), 1)
        self.assertEqual(self.cloud(), before)
        self.assertTrue(self.call(student, 'isWritable'))
        self.assertEqual(self.call(student, 'getState')['profile']['profileId'], self.card['profileId'])
        for digest, value in passes.items():
            self.assertEqual(fixture.database('classroomV1/passes/'+digest), value)
        self.assert_ok(self.call(student, 'leave'))
        reopened = self.device()
        self.join(reopened)
        data = reopened.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        self.assertEqual(data['progression']['xp'], 510)
        self.assertEqual(data['wallet']['balance'], 450)

    def test_revocation_during_roster_request_discards_response_and_blocks_import(self):
        self.connect()
        self.admin.evaluate('()=>{googleHoldRoster=true;window.googlePendingRoster=fixtureService.loadGoogleClassroomRoster("course_101");}')
        self.admin.wait_for_function('typeof googleReleaseRoster==="function"')
        before = fixture.database('classroomV1')
        fixture.database('classroomV1/admins/'+self.teacher_uid, False, 'PUT')
        self.admin.wait_for_function('!fixtureService.getState().admin.authorized')
        self.admin.evaluate('googleReleaseRoster()')
        result = self.admin.evaluate('googlePendingRoster')
        self.assertFalse(result['ok'], result)
        self.assertNotIn('students', result)
        imported = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assertFalse(imported['ok'], imported)
        after = fixture.database('classroomV1')
        expected = copy.deepcopy(before)
        expected['admins'][self.teacher_uid] = False
        self.assertEqual(after, expected)
        self.assert_private_storage(self.admin)

    def test_reconnect_requires_a_fresh_roster_before_preview_or_import(self):
        self.connect()
        self.roster()
        self.assert_ok(self.call(self.admin, 'previewRosterImport', self.request()))
        before = fixture.database('classroomV1')
        self.assert_ok(self.call(self.admin, 'disconnectGoogleClassroom'))
        self.connect()
        for method in ['previewRosterImport', 'importRoster']:
            result = self.call(self.admin, method, self.request(choices=self.create_choices()))
            self.assertEqual(result, {'ok': False, 'code': 'roster-required'})
        self.assertEqual(fixture.database('classroomV1'), before)
        self.roster()
        self.assert_ok(self.call(self.admin, 'previewRosterImport', self.request()))
        self.assert_private_storage(self.admin)

    def test_missing_import_write_permissions_do_not_create_partial_profiles(self):
        self.connect()
        self.roster()
        self.assert_ok(self.call(self.admin, 'previewRosterImport', self.request()))
        before = fixture.database('classroomV1')
        rules = json.loads((fixture.ROOT/'classroom-database.rules.json').read_text())
        original = copy.deepcopy(rules)
        rules['rules']['classroomV1']['classroomImports'] = {
            '$teacherUid': {'.read': 'auth !== null && auth.uid === $teacherUid', '.write': False}
        }
        endpoint = f'http://{fixture.DB_HOST}/.settings/rules.json?ns={fixture.NS}'
        try:
            fixture.request_json(endpoint, rules, 'PUT', owner=True)
            result = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
            self.assertFalse(result['ok'], result)
            self.assertEqual(fixture.database('classroomV1'), before)
        finally:
            fixture.request_json(endpoint, original, 'PUT', owner=True)


if __name__ == '__main__':
    unittest.main(verbosity=2)
