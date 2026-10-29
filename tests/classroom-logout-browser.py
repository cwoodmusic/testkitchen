"""Explicit logout uses the production service and disposable Auth/RTDB SDKs.

Run with node tools/test-classroom-service.cjs --logout. No deployed account,
profile, or database is contacted; the shared fixture enforces loopback hosts.
"""
import importlib.util
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location(
    'logout_service_fixture',Path(__file__).with_name('classroom-service-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class ClassroomLogoutBrowserTests(unittest.TestCase):
    setUpClass=classmethod(fixture.ClassroomServiceBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.ClassroomServiceBrowserTests.tearDownClass.__func__)
    setUp=fixture.ClassroomServiceBrowserTests.setUp
    tearDown=fixture.ClassroomServiceBrowserTests.tearDown
    device=fixture.ClassroomServiceBrowserTests.device
    start=fixture.ClassroomServiceBrowserTests.start
    call=fixture.ClassroomServiceBrowserTests.call
    assert_ok=fixture.ClassroomServiceBrowserTests.assert_ok
    join=fixture.ClassroomServiceBrowserTests.join
    cloud=fixture.ClassroomServiceBrowserTests.cloud

    def auth_users(self,page):
        return page.evaluate('''()=>Object.fromEntries(fixtureSDK.getApps().map(app=>[
          app.name,fixtureSDK.getAuth(app).currentUser?.uid||null]))''')

    def title_events(self,page):
        return page.evaluate('fixtureEvents.filter(event=>event.exitToTitle===true)')

    def checked(self,page,data):
        value=page.evaluate('value=>CodaClassroomProfileData.validate(value)',data)
        self.assertTrue(value['ok'],value)
        return value['data']

    def assert_logged_out(self,page):
        state=self.call(page,'getState')
        self.assertIsNone(state['profile'])
        self.assertFalse(state['admin']['signedIn'])
        self.assertFalse(state['admin']['authorized'])
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        self.assertIsNone(page.evaluate('fixtureNative.getItem("codaClassroomWorkspaceV1")'))
        self.assertTrue(all(uid is None for uid in self.auth_users(page).values()))
        self.assertEqual(len(self.title_events(page)),1,'Logout should request the title exactly once')
        self.assert_ok(self.call(page,'resume'))
        self.assertIsNone(self.call(page,'getState')['profile'],'Resume cannot reopen the player just logged out')

    def test_guest_logout_returns_to_title_without_loading_authentication(self):
        guest=self.device()
        self.assertFalse(self.call(guest,'getState')['ready'])
        self.assertEqual(self.auth_users(guest),{})
        self.assert_ok(self.call(guest,'logOut'))
        self.assertFalse(self.call(guest,'getState')['ready'])
        self.assertEqual(self.auth_users(guest),{})
        self.assert_logged_out(guest)

    def test_student_logout_saves_progress_ends_auth_and_restores_private_guest_work(self):
        student=self.device()
        guest='{"name":"Local guest","shirt":"#abcdef"}'
        student.evaluate('value=>{localStorage.musicArcadeV1=value;localStorage.codaSongMachineDraftV1="GUEST SONG DRAFT";}',guest)
        self.join(student)
        latest=student.evaluate('fixtureProgress(45,26)')
        self.assertIsNotNone(self.auth_users(student)['coda-classroom'])
        student.evaluate('fixtureEvents=[]')
        self.assert_ok(self.call(student,'logOut'))
        self.assertEqual(self.checked(student,self.cloud()['state']['data']),latest)
        self.assertEqual(student.evaluate('localStorage.musicArcadeV1'),guest)
        self.assertEqual(student.evaluate('localStorage.codaSongMachineDraftV1'),'GUEST SONG DRAFT')
        self.assert_logged_out(student)

    def test_logging_out_a_teacher_with_a_student_selected_ends_both_identities(self):
        self.join(self.admin)
        latest=self.admin.evaluate('fixtureProgress(60,33)')
        users=self.auth_users(self.admin)
        self.assertIsNotNone(users['coda-classroom'])
        self.assertIsNotNone(users['coda-classroom-admin'])
        self.admin.evaluate('fixtureEvents=[]')
        self.assert_ok(self.call(self.admin,'logOut'))
        self.assertEqual(self.checked(self.admin,self.cloud()['state']['data']),latest)
        self.assert_logged_out(self.admin)

    def test_teacher_player_logout_saves_latest_progress_and_ends_google_signin(self):
        self.admin.evaluate('fixtureProgress(180,75)')
        self.assert_ok(self.call(self.admin,'savePersonalPlayer'))
        latest=self.admin.evaluate('fixtureProgress(240,90)')
        self.admin.evaluate('fixtureEvents=[]')
        self.assert_ok(self.call(self.admin,'logOut'))
        personal=fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid)
        self.assertEqual(self.checked(self.admin,personal['state']['data']),latest)
        self.assert_logged_out(self.admin)

    def test_staff_without_an_active_player_can_log_out_after_approval_is_revoked(self):
        fixture.database('classroomV1/admins/'+self.teacher_uid,False,'PUT')
        self.admin.wait_for_function('!fixtureService.getState().admin.authorized')
        self.assertTrue(self.call(self.admin,'getState')['admin']['signedIn'])
        self.assertIsNone(self.call(self.admin,'getState')['profile'])
        self.admin.evaluate('fixtureEvents=[]')
        self.assert_ok(self.call(self.admin,'logOut'))
        self.assert_logged_out(self.admin)

    def test_an_unsaved_profile_cannot_be_discarded_by_logout_and_can_retry(self):
        student=self.device();self.join(student)
        original=student.evaluate('localStorage.codaPlayerProgressV1')
        student.evaluate('''()=>{
          const progress=JSON.parse(localStorage.codaPlayerProgressV1);
          progress.xp++;localStorage.codaPlayerProgressV1=JSON.stringify(progress);fixtureEvents=[];
        }''')
        damaged=student.evaluate('localStorage.codaPlayerProgressV1')
        result=self.call(student,'logOut')
        self.assertFalse(result['ok'])
        self.assertEqual(student.evaluate('localStorage.codaPlayerProgressV1'),damaged)
        self.assertEqual(self.call(student,'getState')['profile']['profileId'],self.card['profileId'])
        self.assertIsNotNone(self.auth_users(student)['coda-classroom'])
        self.assertEqual(self.title_events(student),[])
        student.evaluate('value=>localStorage.codaPlayerProgressV1=value',original)
        self.assert_ok(self.call(student,'logOut'))
        self.assert_logged_out(student)

    def test_offline_save_leaves_logout_retryable_instead_of_losing_progress(self):
        student=self.device();self.join(student)
        student.evaluate('''()=>{
          fixtureSDK.goOffline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==='coda-classroom')));
          fixtureProgress(85,44);fixtureEvents=[];
        }''')
        expected=student.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        result=self.call(student,'logOut')
        self.assertFalse(result['ok'],result)
        self.assertEqual(self.call(student,'getState')['profile']['profileId'],self.card['profileId'])
        self.assertEqual(student.evaluate('CodaClassroomProfileData.capture(localStorage).data'),expected)
        self.assertIsNotNone(self.auth_users(student)['coda-classroom'])
        self.assertEqual(self.title_events(student),[])
        student.evaluate("fixtureSDK.goOnline(fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==='coda-classroom')))")
        self.assert_ok(self.call(student,'logOut'))
        self.assertEqual(self.checked(student,self.cloud()['state']['data']),expected)
        self.assert_logged_out(student)

    def test_a_replaced_tab_can_log_out_without_erasing_the_other_players_workspace(self):
        student=self.device();self.join(student)
        next_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(next_card)
        other=self.device(student.context);self.join(other,next_card)
        student.wait_for_function('fixtureService.getState().locked')
        before=other.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
          .concat('codaClassroomWorkspaceV1').map(key=>[key,fixtureNative.getItem(key)]))''')
        student.evaluate('fixtureEvents=[]')
        self.assert_ok(self.call(student,'logOut'))
        self.assertIsNone(self.call(student,'getState')['profile'])
        self.assertIsNone(student.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))
        self.assertEqual(len(self.title_events(student)),1)
        self.assertEqual(other.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
          .concat('codaClassroomWorkspaceV1').map(key=>[key,fixtureNative.getItem(key)]))'''),before)
        self.assertTrue(self.call(other,'isWritable'))
        self.assertEqual(self.call(other,'getState')['profile']['profileId'],next_card['profileId'])

    def test_partial_auth_cleanup_stays_locked_until_logout_can_finish(self):
        student=self.device()
        guest='{"name":"Local guest","shirt":"#aabbcc"}'
        student.evaluate('value=>{localStorage.musicArcadeV1=value;localStorage.codaSongMachineDraftV1="GUEST DRAFT";}',guest)
        before=student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
          .map(key=>[key,fixtureNative.getItem(key)]))''')
        self.join(student)
        latest=student.evaluate('fixtureProgress(35,17)')
        student.evaluate('''()=>{
          fixtureEvents=[];window.fixtureSignOutCalls=0;
          window.fixtureNativeSignOut=fixtureSDK.signOut;
          fixtureSDK.signOut=async instance=>{
            if(instance.app.name==='coda-classroom'){
              fixtureSignOutCalls++;throw Error('Temporary authentication cleanup failure');
            }
            return fixtureNativeSignOut(instance);
          };
        }''')
        result=self.call(student,'logOut')
        self.assertFalse(result['ok'],result)
        self.assertEqual(result['code'],'logout-unavailable')
        state=self.call(student,'getState')
        self.assertIsNone(state['profile'])
        self.assertTrue(state['locked'],'The old player realm cannot play over restored guest data')
        self.assertFalse(state['loading'])
        self.assertGreaterEqual(student.evaluate('fixtureSignOutCalls'),2,'Both leave and final cleanup should retry authentication sign-out')
        self.assertEqual(self.checked(student,self.cloud()['state']['data']),latest)
        self.assertEqual(student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
          .map(key=>[key,fixtureNative.getItem(key)]))'''),before)
        self.assertIsNotNone(self.auth_users(student)['coda-classroom'])
        self.assertEqual(self.title_events(student),[])
        locks=student.evaluate('fixtureEvents.filter(event=>event.type==="lock"&&event.reason==="logout-unavailable")')
        self.assertTrue(locks,'The in-game recovery UI must be notified after partial cleanup')
        self.assertFalse(locks[-1]['reloadNeeded'])
        student.evaluate('()=>{fixtureSDK.signOut=fixtureNativeSignOut;}')
        self.assert_ok(self.call(student,'logOut'))
        self.assertEqual(student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
          .map(key=>[key,fixtureNative.getItem(key)]))'''),before)
        self.assert_logged_out(student)

    def test_failed_workspace_or_backup_cleanup_preserves_guest_data_until_retry(self):
        for failure in ['backup','workspace']:
            with self.subTest(metadata=failure):
                student=self.device()
                student.evaluate('''()=>{
                  localStorage.musicArcadeV1='{"name":"Original guest","shirt":"#acbdef"}';
                  localStorage.codaSongMachineDraftV1='ORIGINAL GUEST SONG';
                }''')
                before=student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
                  .map(key=>[key,fixtureNative.getItem(key)]))''')
                self.join(student)
                latest=student.evaluate('fixtureProgress(65,29)')
                backup=student.evaluate('sessionStorage.getItem("codaClassroomGuestBackupV1")')
                self.assertIsNotNone(backup)
                student.evaluate('''failure=>{
                  fixtureEvents=[];window.fixtureNativeRemoveItem=Storage.prototype.removeItem;
                  Storage.prototype.removeItem=function(key){
                    if((failure==='backup'&&this===sessionStorage&&key==='codaClassroomGuestBackupV1')||
                       (failure==='workspace'&&this===fixtureNative&&key==='codaClassroomWorkspaceV1'))
                      throw Error('Temporary workspace metadata failure');
                    return fixtureNativeRemoveItem.call(this,key);
                  };
                }''',failure)
                result=self.call(student,'logOut')
                self.assertFalse(result['ok'],result)
                self.assertEqual(result['code'],'logout-unavailable')
                self.assertTrue(self.call(student,'getState')['locked'])
                self.assertFalse(self.call(student,'isWritable'))
                flush=self.call(student,'flush')
                self.assertTrue(not flush['ok'] or flush.get('guest') is True,
                    'Restored guest bytes cannot be saved as the former student')
                self.assertEqual(student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
                  .map(key=>[key,fixtureNative.getItem(key)]))'''),before)
                self.assertEqual(student.evaluate('sessionStorage.getItem("codaClassroomGuestBackupV1")'),backup)
                self.assertEqual(self.checked(student,self.cloud()['state']['data']),latest)
                self.assertEqual(self.title_events(student),[])
                student.evaluate('()=>{Storage.prototype.removeItem=fixtureNativeRemoveItem;}')
                self.assert_ok(self.call(student,'logOut'))
                self.assertEqual(student.evaluate('''()=>Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS
                  .map(key=>[key,fixtureNative.getItem(key)]))'''),before)
                self.assertIsNone(student.evaluate('sessionStorage.getItem("codaClassroomGuestBackupV1")'))
                self.assertEqual(self.checked(student,self.cloud()['state']['data']),latest)
                self.assert_logged_out(student)


if __name__=='__main__':unittest.main(verbosity=2)
