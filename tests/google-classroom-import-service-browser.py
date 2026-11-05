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
import urllib.parse

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('google_import_service_fixture',
    Path(__file__).with_name('classroom-service-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

SCOPES = [
    'https://www.googleapis.com/auth/classroom.courses.readonly',
    'https://www.googleapis.com/auth/classroom.rosters.readonly',
]
PUBLISH_SCOPE = 'https://www.googleapis.com/auth/classroom.courseworkmaterials'
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
 window.googleHoldMaterialBeforeSend=false;window.googleHoldMaterialResponse=false;
 window.googleImportErrors=[];
 const classroom=CodaClassroom;
 window.CodaClassroom={...classroom,create:options=>classroom.create({...options,
  location:new URL('https://www.coda-arcade.com/world-preview.html')})};
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
 const originalCredential=fixtureSDK.GoogleAuthProvider.credentialFromResult;
 fixtureSDK.GoogleAuthProvider.credentialFromResult=result=>result?.googleTestCredential||originalCredential(result);
 fixtureSDK.reauthenticateWithPopup=async(user,provider)=>{
  const scopes=provider.scopes||provider._scopes||provider.getScopes?.()||[];
  googlePopupCalls.push({uid:user.uid,scopes:[...scopes]});
  if(window.googlePopupError)throw {code:window.googlePopupError};
  const token=scopes.includes('https://www.googleapis.com/auth/classroom.courseworkmaterials')
   ?'test-only-classroom-publishing-token':'test-only-classroom-access-token';
  return {user,googleTestCredential:{accessToken:token},_tokenResponse:{oauthAccessToken:token,expiresIn:'3600'}};
 };
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(value,options={})=>{
  const url=new URL(String(value),location.href);
  if(url.hostname!=='classroom.googleapis.com')return nativeFetch(value,options);
  const headers=new Headers(options.headers||{});
  googleRequests.push({url:url.href,method:options.method||'GET',authorization:headers.get('Authorization'),credentials:options.credentials});
  if(url.pathname.includes('/courseWorkMaterials')){
   const hold=key=>new Promise((resolve,reject)=>{
    window[key]=resolve;
    if(options.signal?.aborted)return reject(new DOMException('Aborted','AbortError'));
    options.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
   });
   const posting=(options.method||'GET')==='POST';
   if(posting&&googleHoldMaterialBeforeSend)await hold('googleReleaseMaterialSend');
   const result=await googleMaterialServer({url:url.href,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});
   if(posting&&googleHoldMaterialResponse)await hold('googleReleaseMaterialResponse');
   if(result.loseResponse)throw new TypeError('Simulated response loss after successful Google create');
   return new Response(JSON.stringify(result.body),{status:result.status,headers:{'Content-Type':'application/json'}});
  }
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
    tearDown = fixture.ClassroomServiceBrowserTests.tearDown
    call = fixture.ClassroomServiceBrowserTests.call
    assert_ok = fixture.ClassroomServiceBrowserTests.assert_ok
    join = fixture.ClassroomServiceBrowserTests.join
    cloud = fixture.ClassroomServiceBrowserTests.cloud

    def setUp(self):
        self.google_materials = []
        self.google_posts = []
        self.google_material_contexts = set()
        self.google_lose_post_responses = 0
        fixture.ClassroomServiceBrowserTests.setUp(self)

    def device(self, context=None):
        page = fixture.ClassroomServiceBrowserTests.device(self, context)
        key = id(page.context)
        if key not in self.google_material_contexts:
            page.context.expose_binding('googleMaterialServer', lambda _source, request: self.material_request(request))
            self.google_material_contexts.add(key)
        return page

    def material_request(self, request):
        """A shared fake Google server, including across real browser contexts."""
        parsed = urllib.parse.urlsplit(request['url'])
        self.assertEqual(parsed.hostname, 'classroom.googleapis.com')
        self.assertNotIn('access_token', parsed.query)
        query = urllib.parse.parse_qs(parsed.query)
        if request['method'] == 'POST':
            body = copy.deepcopy(request['body'])
            self.google_posts.append(body)
            item = {**body, 'id': 'material_'+str(len(self.google_materials)+1), 'courseId': COURSE}
            self.google_materials.append(item)
            lost = self.google_lose_post_responses > 0
            if lost:
                self.google_lose_post_responses -= 1
            return {'status': 200, 'body': item, 'loseResponse': lost}
        self.assertEqual(request['method'], 'GET')
        if '/courseWorkMaterials/' in parsed.path:
            material_id = parsed.path.rsplit('/', 1)[1]
            item = next((row for row in self.google_materials if row['id'] == material_id), None)
            return {'status': 200 if item else 404, 'body': item or {'error': {'code': 404}}}
        start = int(query.get('pageToken', ['0'])[0])
        body = {'courseWorkMaterial': copy.deepcopy(self.google_materials[start:start+2])}
        if start+2 < len(self.google_materials):
            body['nextPageToken'] = str(start+2)
        return {'status': 200, 'body': body}

    def start(self, page, enabled=True):
        for name in ['google-classroom.js', 'classroom-roster-import.js', 'classroom-material-publisher.js']:
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
        self.assertNotIn('test-only-classroom-publishing-token', stored)
        for row in STUDENTS:
            self.assertNotIn(row['name'], stored)

    def import_initial_roster(self):
        self.connect()
        self.roster()
        result = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assertTrue(result.get('ok'), {'result': result, 'errors': self.admin.evaluate('googleImportErrors')})
        self.assertEqual(self.google_posts, [], 'Importing profiles never publishes to Google')
        return result

    def posting_plan(self, cards, page=None):
        page = page or self.admin
        self.assert_ok(self.call(page, 'connectGoogleClassroomPublishing'))
        result = self.call(page, 'previewClassroomPosts', {'courseId': COURSE, 'cards': cards})
        self.assert_ok(result)
        return result

    def publish_plan(self, plan, page=None):
        result = self.call(page or self.admin, 'publishClassroomPosts', {'planId': plan['planId'], 'confirmed': True})
        self.assert_ok(result)
        return result

    def material(self, card, **changes):
        value = {'id': 'manual_'+card['userId'], 'courseId': COURSE, 'title': 'Your Coda Arcade profile',
                 'state': 'PUBLISHED', 'assigneeMode': 'INDIVIDUAL_STUDENTS',
                 'individualStudentsOptions': {'studentIds': [card['userId']]},
                 'materials': [{'link': {'url': card['link']}}]}
        value.update(changes)
        return value

    def assert_personal_posts(self, cards):
        targets = {card['userId']: card['link'] for card in cards}
        for body in self.google_posts:
            self.assertEqual(body['state'], 'PUBLISHED')
            self.assertEqual(body['assigneeMode'], 'INDIVIDUAL_STUDENTS')
            ids = body['individualStudentsOptions']['studentIds']
            self.assertEqual(len(ids), 1)
            self.assertIn(ids[0], targets)
            self.assertEqual(len(body['materials']), 1)
            self.assertEqual(body['materials'][0]['link']['url'], targets[ids[0]])
            self.assertTrue(body['materials'][0]['link']['url'].startswith('https://www.coda-arcade.com/world-preview.html#classroom-pass='))

    def test_explicit_personal_posting_and_reload_reconcile_without_duplicates(self):
        imported = self.import_initial_roster()
        before = fixture.database('classroomV1')
        plan = self.posting_plan(imported['cards'])
        self.assertEqual(plan['ready'], 3)
        self.assertEqual(self.google_posts, [])
        self.assertEqual(fixture.database('classroomV1'), before, 'Posting preview cannot write a delivery ledger')
        result = self.publish_plan(plan)
        self.assertEqual(result['posted'], 3, result)
        self.assertEqual(len(self.google_posts), 3)
        self.assert_personal_posts(imported['cards'])
        recipients = [body['individualStudentsOptions']['studentIds'][0] for body in self.google_posts]
        self.assertEqual(set(recipients), {row['userId'] for row in STUDENTS})
        ledger = fixture.database(f'classroomV1/classroomImports/{self.teacher_uid}/{COURSE}/deliveries')
        for card in imported['cards']:
            entries = ledger[card['userId']]
            self.assertEqual(len(entries), 1)
            digest, entry = next(iter(entries.items()))
            self.assertEqual(len(digest), 64)
            self.assertEqual(entry['state'], 'posted')
            self.assertEqual(entry['profileId'], card['profileId'])
            self.assertTrue(entry['materialId'])
        persisted = json.dumps(fixture.database('classroomV1'))
        for card in imported['cards']:
            self.assertNotIn(card['link'], persisted)
            self.assertNotIn(card['pass'], persisted)
        again = self.posting_plan([])
        self.assertEqual(again['ready'], 0)
        self.assertEqual(again['alreadyPosted'], 3)
        self.assertEqual(self.publish_plan(again)['posted'], 0)
        self.assertEqual(len(self.google_posts), 3)
        self.admin.reload()
        self.admin.wait_for_function('window.fixtureReady')
        self.start(self.admin)
        self.assert_ok(self.call(self.admin, 'adminSignIn'))
        self.connect()
        self.roster()
        after_reload = self.posting_plan([])
        self.assertEqual(after_reload['ready'], 0)
        self.assertEqual(after_reload['alreadyPosted'], 3)
        self.assertEqual(self.publish_plan(after_reload)['posted'], 0)
        self.assertEqual(len(self.google_posts), 3)
        self.assert_private_storage(self.admin)

    def test_append_new_students_keeps_old_profiles_cards_progress_and_posts_unchanged(self):
        imported = self.import_initial_roster()
        self.assertEqual(self.publish_plan(self.posting_plan(imported['cards']))['posted'], 3)
        student = self.device()
        self.join(student, imported['cards'][0])
        student.evaluate('fixtureProgress(640,350)')
        self.assert_ok(self.call(student, 'flush'))
        class_id = imported['classId']
        profiles_before = copy.deepcopy(fixture.database('classroomV1/classes/'+class_id+'/profiles'))
        passes_before = copy.deepcopy(fixture.database('classroomV1/passes'))
        materials_before = copy.deepcopy(self.google_materials)
        added = [{'userId': 'student_104', 'name': 'Riley Private Student'},
                 {'userId': 'student_105', 'name': 'Skyler Private Student'}]
        roster = STUDENTS+added
        self.admin.evaluate('value=>{googleTestStudents=value;}', roster)
        loaded = self.call(self.admin, 'loadGoogleClassroomRoster', COURSE)
        self.assert_ok(loaded)
        self.assertEqual(loaded['students'], roster)
        request = self.request(students=roster, choices=[{'userId': row['userId'], 'action': 'create'} for row in roster])
        preview = self.call(self.admin, 'previewRosterImport', request)
        self.assert_ok(preview)
        self.assertEqual(sum(row['status'] == 'existing' for row in preview['students']), 3)
        appended = self.call(self.admin, 'importRoster', request)
        self.assert_ok(appended)
        self.assertEqual(appended['classId'], class_id)
        self.assertEqual(appended['created'], 2)
        self.assertEqual(appended['existing'], 3)
        self.assertEqual({card['userId'] for card in appended['cards']}, {row['userId'] for row in added})
        profiles_after = fixture.database('classroomV1/classes/'+class_id+'/profiles')
        self.assertEqual(len(profiles_after), 5)
        for profile_id, profile in profiles_before.items():
            self.assertEqual(profiles_after[profile_id], profile)
        for digest, binding in passes_before.items():
            self.assertEqual(fixture.database('classroomV1/passes/'+digest), binding)
        self.assertEqual(self.google_materials, materials_before)
        self.assertTrue(self.call(student, 'isWritable'))
        plan = self.posting_plan(appended['cards'])
        self.assertEqual(plan['ready'], 2)
        self.assertEqual(plan['alreadyPosted'], 3)
        self.assertEqual(self.publish_plan(plan)['posted'], 2)
        self.assertEqual(self.google_materials[:3], materials_before)
        self.assertEqual(len(self.google_posts), 5)
        self.assert_personal_posts(imported['cards']+appended['cards'])
        recipients = [body['individualStudentsOptions']['studentIds'][0] for body in self.google_posts]
        self.assertEqual(len(recipients), len(set(recipients)))

    def test_successful_post_with_lost_response_is_reconciled_before_retry(self):
        imported = self.import_initial_roster()
        plan = self.posting_plan(imported['cards'])
        self.google_lose_post_responses = 1
        first = self.call(self.admin, 'publishClassroomPosts', {'planId': plan['planId'], 'confirmed': True})
        self.assertTrue(first.get('ok'), first)
        self.assertEqual(len(self.google_posts), 1)
        self.assertEqual(first['uncertain'], 1)
        self.assertEqual(first['failed'], 2)
        paused = [row for row in first['rows'] if row['status'] == 'failed']
        self.assertTrue(all(row.get('code') == 'posting-paused' for row in paused))
        retry_plan = self.posting_plan(imported['cards'])
        self.assertEqual(retry_plan['alreadyPosted'], 1)
        self.assertEqual(retry_plan['ready'], 2)
        retried = self.publish_plan(retry_plan)
        self.assertEqual(retried['posted'], 2)
        self.assertEqual(retried['alreadyPosted'], 1)
        self.assertEqual(len(self.google_posts), 3)
        self.assertEqual(len(self.google_materials), 3)
        recipients = [body['individualStudentsOptions']['studentIds'][0] for body in self.google_posts]
        self.assertEqual(len(recipients), len(set(recipients)))
        self.assert_personal_posts(imported['cards'])
        final = self.posting_plan([])
        self.assertEqual(final['alreadyPosted'], 3)
        self.assertEqual(final['ready'], 0)

    def test_manual_material_matching_requires_one_recipient_and_current_private_pass(self):
        imported = self.import_initial_roster()
        first, second, third = imported['cards']
        self.google_materials = [
            self.material(first),
            self.material(second, id='manual_broad', assigneeMode='ALL_STUDENTS', individualStudentsOptions={}),
            self.material(second, id='manual_multiple', individualStudentsOptions={'studentIds': [second['userId'], third['userId']]}),
            self.material(third, id='manual_stale', materials=[{'link': {'url': first['link']}}]),
        ]
        before = fixture.database('classroomV1')
        plan = self.posting_plan(imported['cards'])
        self.assertEqual(plan['alreadyPosted'], 1)
        rows = {row['userId']: row for row in plan['rows']}
        self.assertEqual(rows[first['userId']]['status'], 'already-posted')
        self.assertNotEqual(rows[second['userId']]['status'], 'already-posted')
        self.assertNotEqual(rows[third['userId']]['status'], 'already-posted')
        self.assertEqual(self.google_posts, [])
        self.assertEqual(fixture.database('classroomV1'), before)

    def test_revocation_after_one_post_stops_remaining_posts_and_ledger_updates(self):
        imported = self.import_initial_roster()
        plan = self.posting_plan(imported['cards'])
        self.admin.evaluate('''planId=>{
          googleHoldMaterialResponse=true;
          window.googlePendingPublish=fixtureService.publishClassroomPosts({planId,confirmed:true});
        }''', plan['planId'])
        self.admin.wait_for_function('typeof googleReleaseMaterialResponse==="function"')
        self.assertEqual(len(self.google_posts), 1)
        fixture.database('classroomV1/admins/'+self.teacher_uid, False, 'PUT')
        self.admin.wait_for_function('!fixtureService.getState().admin.authorized')
        before_release = fixture.database('classroomV1')
        self.admin.evaluate('googleReleaseMaterialResponse()')
        result = self.admin.evaluate('googlePendingPublish')
        self.assertFalse(result['ok'], result)
        self.assertEqual(len(self.google_posts), 1)
        self.assertEqual(fixture.database('classroomV1'), before_release)
        self.assert_private_storage(self.admin)

    def test_two_teacher_tabs_share_a_claim_before_any_google_post(self):
        imported = self.import_initial_roster()
        first_plan = self.posting_plan(imported['cards'][:1])
        second = self.device()
        self.assert_ok(self.call(second, 'adminSignIn'))
        self.connect(second)
        self.roster(second)
        self.admin.evaluate('''planId=>{
          googleHoldMaterialBeforeSend=true;
          window.googlePendingPublish=fixtureService.publishClassroomPosts({planId,confirmed:true});
        }''', first_plan['planId'])
        self.admin.wait_for_function('typeof googleReleaseMaterialSend==="function"')
        second_plan = self.posting_plan(imported['cards'][:1], second)
        self.assertEqual(second_plan['ready'], 0)
        self.publish_plan(second_plan, second)
        self.assertEqual(self.google_posts, [])
        self.admin.evaluate('googleReleaseMaterialSend()')
        first_result = self.admin.evaluate('googlePendingPublish')
        self.assertTrue(first_result.get('ok'), first_result)
        self.assertEqual(len(self.google_posts), 1)
        self.assertEqual(self.google_posts[0]['individualStudentsOptions']['studentIds'], [imported['cards'][0]['userId']])
        self.assert_personal_posts(imported['cards'])

    def test_additional_publishing_consent_preserves_teacher_player_and_only_adds_material_scope(self):
        self.admin.evaluate('fixtureProgress(830,420)')
        self.assert_ok(self.call(self.admin, 'savePersonalPlayer'))
        self.connect()
        self.roster()
        before = self.call(self.admin, 'getState')
        cloud_before = fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid)
        self.assert_ok(self.call(self.admin, 'connectGoogleClassroomPublishing'))
        after = self.call(self.admin, 'getState')
        self.assertEqual(after['profile'], before['profile'])
        self.assertEqual(after['admin']['uid'], before['admin']['uid'])
        self.assertTrue(self.call(self.admin, 'isWritable'))
        self.assertEqual(fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid), cloud_before)
        popups = self.admin.evaluate('googlePopupCalls')
        self.assertEqual(len(popups), 2)
        self.assertEqual(set(scope for scope in popups[0]['scopes'] if 'classroom.' in scope), set(SCOPES))
        self.assertEqual(set(scope for scope in popups[1]['scopes'] if 'classroom.' in scope), set(SCOPES)|{PUBLISH_SCOPE})
        self.assertEqual(self.google_posts, [])
        self.assert_private_storage(self.admin)

    def test_deleted_import_class_requires_explicit_metadata_rebuild_and_fresh_cards(self):
        imported = self.import_initial_roster()
        class_id = imported['classId']
        self.assertEqual(self.publish_plan(self.posting_plan(imported['cards']))['posted'], 3)
        old_materials = copy.deepcopy(self.google_materials)
        old_mapping = copy.deepcopy(fixture.database(f'classroomV1/classroomImports/{self.teacher_uid}/{COURSE}'))
        student = self.device()
        self.join(student, imported['cards'][0])
        student.evaluate('fixtureProgress(640,350)')
        self.assert_ok(self.call(student, 'flush'))
        self.assertEqual(fixture.database(f'classroomV1/classes/{class_id}/profiles/{imported["cards"][0]["profileId"]}/state/data/progression/xp'), 640)
        self.assert_ok(self.call(self.admin, 'deleteClass', class_id))
        student.wait_for_function('!fixtureService.isWritable()')
        self.assertIsNone(fixture.database('classroomV1/classes/'+class_id))
        self.assertIsNone(fixture.database('classroomV1/directory/'+class_id))
        self.assertEqual(fixture.database(f'classroomV1/classroomImports/{self.teacher_uid}/{COURSE}'), old_mapping)
        before = fixture.database('classroomV1')
        preview = self.call(self.admin, 'previewRosterImport', self.request())
        self.assertFalse(preview['ok'], preview)
        self.assertEqual(preview['code'], 'class-not-found')
        self.assertTrue(preview.get('canRebuild'), preview)
        self.assertEqual(preview['classId'], class_id)
        automatic = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assertFalse(automatic['ok'], automatic)
        self.assertEqual(fixture.database('classroomV1'), before, 'A preview or ordinary import cannot recreate a deleted class')
        unconfirmed = self.call(self.admin, 'rebuildDeletedClassroomClass', {'courseId': COURSE, 'label': 'Fifth Grade Rebuilt'})
        self.assertFalse(unconfirmed['ok'], unconfirmed)
        self.assertEqual(fixture.database('classroomV1'), before)
        rebuilt = self.call(self.admin, 'rebuildDeletedClassroomClass', {
            'courseId': COURSE, 'label': 'Fifth Grade Rebuilt', 'confirmed': True,
        })
        self.assertEqual(rebuilt, {'ok': True, 'classId': class_id, 'label': 'Fifth Grade Rebuilt', 'rebuilt': True})
        after = fixture.database('classroomV1')
        meta = after['classes'][class_id]['meta']
        self.assertEqual(set(meta), {'ownerUid', 'label', 'createdAt'})
        self.assertEqual(meta['ownerUid'], self.teacher_uid)
        self.assertEqual(meta['label'], 'Fifth Grade Rebuilt')
        self.assertIsInstance(meta['createdAt'], int)
        expected = copy.deepcopy(before)
        expected.setdefault('classes', {})[class_id] = {'meta': meta}
        expected.setdefault('directory', {})[class_id] = {'meta': meta}
        self.assertEqual(after, expected, 'Rebuild must write only the two metadata leaves')
        self.assertEqual(self.google_materials, old_materials)
        missing = self.call(self.admin, 'previewRosterImport', self.request())
        self.assert_ok(missing)
        self.assertFalse(missing['newClass'])
        self.assertEqual(missing['label'], 'Fifth Grade Rebuilt')
        self.assertEqual({row['status'] for row in missing['students']}, {'missing'})
        self.assertEqual(missing['profiles'], [])
        repaired = self.call(self.admin, 'importRoster', self.request(choices=self.create_choices()))
        self.assert_ok(repaired)
        self.assertEqual(repaired['classId'], class_id)
        self.assertEqual(repaired['created'], 3)
        self.assertEqual({card['profileId'] for card in repaired['cards']}, {card['profileId'] for card in imported['cards']})
        old_cards = {card['userId']: card for card in imported['cards']}
        for card in repaired['cards']:
            self.assertNotEqual(card['pass'], old_cards[card['userId']]['pass'])
            old_device = self.device()
            result = self.call(old_device, 'join', old_cards[card['userId']]['link'])
            self.assertFalse(result['ok'], result)
        reopened = self.device()
        self.join(reopened, repaired['cards'][0])
        progress = reopened.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        self.assertEqual(progress['progression']['xp'], 0)
        self.assertEqual(progress['wallet']['balance'], 150)
        self.assertEqual(self.google_materials, old_materials)
        posting = self.posting_plan(repaired['cards'])
        self.assertEqual(posting['ready'], 3)
        self.assertEqual(posting['alreadyPosted'], 0)
        self.assertEqual(self.publish_plan(posting)['posted'], 3)
        self.assertEqual(self.google_materials[:3], old_materials, 'Existing Classroom materials are never deleted or rewritten')
        new_cards = {card['userId']: card for card in repaired['cards']}
        for body in self.google_posts[3:]:
            ids = body['individualStudentsOptions']['studentIds']
            self.assertEqual(len(ids), 1)
            card = new_cards[ids[0]]
            self.assertEqual(body['state'], 'PUBLISHED')
            self.assertEqual(body['assigneeMode'], 'INDIVIDUAL_STUDENTS')
            self.assertEqual(body['materials'], [{'link': {'url': card['link']}}])
            self.assertEqual(body['title'], 'Your Coda Arcade Profile: '+card['alias'])

    def test_rebuild_denies_live_partial_unconnected_and_unapproved_requests(self):
        imported = self.import_initial_roster()
        class_id = imported['classId']
        request = {'courseId': COURSE, 'label': 'Fifth Grade Rebuilt', 'confirmed': True}
        before = fixture.database('classroomV1')
        live = self.call(self.admin, 'rebuildDeletedClassroomClass', request)
        self.assertFalse(live['ok'], live)
        self.assertEqual(fixture.database('classroomV1'), before)
        self.assert_ok(self.call(self.admin, 'deleteClass', class_id))
        for node in ['classes', 'directory']:
            fixture.database(f'classroomV1/{node}/{class_id}', {'meta': {'label': 'Partial metadata'}}, 'PUT')
            partial = fixture.database('classroomV1')
            preview = self.call(self.admin, 'previewRosterImport', self.request())
            self.assertFalse(preview['ok'], preview)
            self.assertFalse(preview.get('canRebuild', False), preview)
            denied = self.call(self.admin, 'rebuildDeletedClassroomClass', request)
            self.assertFalse(denied['ok'], denied)
            self.assertEqual(fixture.database('classroomV1'), partial)
            fixture.database(f'classroomV1/{node}/{class_id}', method='DELETE')
        self.assert_ok(self.call(self.admin, 'disconnectGoogleClassroom'))
        disconnected = fixture.database('classroomV1')
        denied = self.call(self.admin, 'rebuildDeletedClassroomClass', request)
        self.assertFalse(denied['ok'], denied)
        self.assertEqual(fixture.database('classroomV1'), disconnected)
        self.connect()
        denied = self.call(self.admin, 'rebuildDeletedClassroomClass', request)
        self.assertFalse(denied['ok'], denied)
        self.assertEqual(fixture.database('classroomV1'), disconnected, 'Reconnecting alone does not supply a fresh roster')
        self.roster()
        guest = self.device()
        student = self.device()
        self.join(student)
        before_roles = fixture.database('classroomV1')
        for page in [guest, student]:
            denied = self.call(page, 'rebuildDeletedClassroomClass', request)
            self.assertFalse(denied['ok'], denied)
        self.assertEqual(fixture.database('classroomV1'), before_roles)
        fixture.database('classroomV1/admins/'+self.teacher_uid, False, 'PUT')
        self.admin.wait_for_function('!fixtureService.getState().admin.authorized')
        revoked = fixture.database('classroomV1')
        denied = self.call(self.admin, 'rebuildDeletedClassroomClass', request)
        self.assertFalse(denied['ok'], denied)
        self.assertEqual(fixture.database('classroomV1'), revoked)

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
