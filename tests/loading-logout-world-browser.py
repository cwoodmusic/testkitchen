"""The real world keeps loading separate from profile options and saves on logout.

Uses production UI/Boot/service and disposable loopback Firebase Auth/Database
emulators. Only SDK configuration and a deliberate network pause are fixtures.
"""
import importlib.util
from pathlib import Path
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import expect
from world_navigation_helpers import open_settings

_spec=importlib.util.spec_from_file_location('loading_logout_world',Path(__file__).with_name('classroom-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class LoadingLogoutWorldTests(_world.ClassroomWorldBrowserTests):
    def close_panel(self,page):
        if page.locator('#panel').is_visible():page.locator('#panelClose').click()

    def settings(self,page):
        self.close_panel(page);open_settings(page)
        expect(page.locator('#accountBtn')).to_be_visible()
        expect(page.locator('#worldLogOut')).to_be_visible()

    def play_pitch_round(self,page,run_id='logout-world-round'):
        self.enter_pitch(page)
        page.frames[-1].evaluate('''runId=>parent.postMessage({...fixtureBridge,type:'result',runId,
          result:{mode:'classic',score:10,correct:10,misses:0,streak:10,won:true,perfect:true}},'*')''',run_id)
        page.wait_for_function('CodaArcadeQA.progression().xp>0&&CodaArcadeQA.notes().balance>150')
        result=page.evaluate('({xp:CodaArcadeQA.progression().xp,balance:CodaArcadeQA.notes().balance})')
        page.locator('#returnworld').click();return result

    def expect_title(self,page):
        page.wait_for_url('**/index.html')
        expect(page.locator('#titleGuest')).to_be_visible()
        expect(page.locator('#titleProfile strong')).to_have_text('Open my profile')
        expect(page.locator('#titleGuest strong')).to_have_text('Play as guest')
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        self.assertIsNone(page.evaluate('localStorage.getItem("codaClassroomWorkspaceV1")'))

    def test_resume_is_loading_only_and_profile_options_remain_in_the_game(self):
        page=self.world();self.join_world(page)
        # Pause only the actual SDK read which restores an already-bound student.
        # The profile, auth session, saved game and application remain production.
        wrapper=b'''
;(()=>{const api=window.CodaClassroom;window.CodaClassroom={...api,create:options=>api.create({...options,sdkLoader:async()=>window.fixtureSDK})};
const get=fixtureSDK.get;fixtureSDK.get=async reference=>{if(String(reference).includes('/sessions/')){window.fixtureResumeHeld=true;await new Promise(resolve=>window.fixtureReleaseResume=resolve);}return get(reference);};})();
'''
        page.context.route('**/classroom-service.js*',lambda route:route.fulfill(
            status=200,content_type='text/javascript',body=self.server.sdk_bundle+
            (_world.fixture.ROOT/'classroom-service.js').read_bytes()+wrapper))
        page.reload(wait_until='load');page.wait_for_function('window.fixtureResumeHeld')
        gate=page.locator('#classroom-session-notice');expect(gate).to_be_visible()
        self.assertEqual(gate.locator('button,a,input').count(),0,'Loading does not offer profile or guest actions')
        self.assertTrue(page.evaluate('CodaClassroomBoot.getState().preparing'))
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        expect(gate).to_contain_text('Loading')
        self.assertEqual(page.locator('.classroom-profile-ui').count(),0)
        page.evaluate('fixtureReleaseResume()');self.ready(page,self.card)
        expect(gate).to_be_hidden()
        self.settings(page);page.locator('#accountBtn').click()
        expect(page.locator('.classroom-profile-ui')).to_be_visible()
        expect(page.locator('#panelBody')).to_contain_text(self.card['alias'])
        expect(page.locator('#classpassLogOut')).to_be_visible()
        self.close_panel(page);page.locator('#levelBtn').click()
        page.get_by_role('button',name='Classroom profile',exact=True).click()
        expect(page.locator('#classpassLogOut')).to_be_visible()
        self.assertEqual(self.failed_assets,[])

    def test_settings_logout_saves_student_returns_to_title_and_next_player_is_private(self):
        page=self.world()
        page.evaluate('localStorage.codaSongMachineDraftV1="PRIVATE GUEST DRAFT"')
        self.join_world(page)
        result=self.play_pitch_round(page)
        before_uid=page.evaluate('fixtureSDK.getAuth(fixtureSDK.getApps().find(app=>app.name==="coda-classroom")).currentUser.uid')
        self.settings(page)
        page.set_viewport_size({'width':390,'height':844})
        for selector in ['#accountBtn','#worldLogOut']:
            bounds=page.locator(selector).bounding_box();self.assertGreaterEqual(bounds['height'],44);self.assertGreaterEqual(bounds['width'],44)
        with page.expect_navigation(wait_until='load'):
            page.locator('#worldLogOut').click()
        self.expect_title(page)
        self.assertEqual(page.evaluate('localStorage.codaSongMachineDraftV1'),'PRIVATE GUEST DRAFT')
        saved=self.cloud()['state']['data']
        self.assertEqual(saved['progression']['xp'],result['xp'])
        self.assertEqual(saved['wallet']['balance'],result['balance'])
        self.assertIsNone(_world.fixture.database('classroomV1/sessions/'+before_uid))
        self.assertIsNone(self.cloud().get('lease'))
        page.reload(wait_until='load');self.expect_title(page)
        page.locator('#titleGuest').click();self.ready(page)
        self.assertIsNone(page.evaluate('CodaClassroomSession.getState().profile'))
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        next_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(next_card)
        self.join_world(page,next_card)
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertIsNone(page.evaluate('localStorage.getItem("codaSongMachineDraftV1")'))
        self.assertEqual(self.failed_assets,[])

    def test_profile_logout_saves_teacher_and_requires_a_new_google_sign_in(self):
        self.admin.evaluate('fixtureProgress(420,230)')
        self.admin.evaluate('localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:"Music Teacher",shirt:"#146f85"})')
        self.assert_ok(self.call(self.admin,'savePersonalPlayer'))
        page=self.teacher_entry(self.world())
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignIn').click()
        self.ready(page,{'profileId':self.teacher_uid})
        self.close_panel(page)
        # Use the existing real Piano Lab reward boundary to produce unsent work.
        award=page.evaluate('fixturePianoReward("piano-lesson:twinkle",24)');self.assertTrue(award['ok'])
        expected=page.evaluate('({xp:CodaArcadeQA.progression().xp,balance:CodaArcadeQA.notes().balance})')
        page.locator('#levelBtn').click();page.get_by_role('button',name='Classroom profile',exact=True).click()
        expect(page.locator('#classpassLogOut')).to_be_visible()
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassLogOut').click()
        self.expect_title(page)
        saved=_world.fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid+'/state/data')
        self.assertEqual(saved['progression']['xp'],expected['xp'])
        self.assertEqual(saved['wallet']['balance'],expected['balance'])
        page.locator('#titleTeacher').click();self.ready(page)
        expect(page.locator('#classpassAdminSignIn')).to_be_visible()
        self.assertFalse(page.evaluate('CodaClassroomSession.getState().admin.signedIn'))
        self.assertIsNone(page.evaluate('CodaClassroomSession.getState().profile'))
        self.assertEqual(self.failed_assets,[])

    def test_failed_logout_keeps_the_profile_and_offers_a_safe_retry(self):
        page=self.world();self.join_world(page)
        expected=self.play_pitch_round(page,'logout-retry-world-round')
        page.evaluate('''()=>{
          window.fixtureOriginalTransaction=fixtureSDK.runTransaction;
          fixtureSDK.runTransaction=(reference,...args)=>String(reference).includes('/state')
            ?Promise.reject(Error('Saving unavailable in the fixture'))
            :fixtureOriginalTransaction(reference,...args);
        }''')
        self.settings(page);page.locator('#worldLogOut').click()
        expect(page.locator('#classpassStatus')).to_have_attribute('role','alert')
        expect(page.locator('#classpassStatus')).to_contain_text('saved')
        self.assertTrue(page.url.endswith('/world-preview.html'))
        self.assertEqual(page.evaluate('CodaClassroomSession.getState().profile.profileId'),self.card['profileId'])
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),expected['xp'])
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),expected['balance'])
        expect(page.locator('#classpassLogOut')).to_be_enabled()
        page.evaluate('()=>{fixtureSDK.runTransaction=fixtureOriginalTransaction;}')
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassLogOut').click()
        self.expect_title(page)
        saved=self.cloud()['state']['data']
        self.assertEqual(saved['progression']['xp'],expected['xp'])
        self.assertEqual(saved['wallet']['balance'],expected['balance'])
        self.assertEqual(self.failed_assets,[])

    def test_auth_cleanup_failure_keeps_gameplay_protected_until_logout_retry(self):
        page=self.world()
        page.evaluate('localStorage.codaSongMachineDraftV1="GUEST AUTH RETRY DRAFT"')
        self.join_world(page)
        page.evaluate('''()=>{
          window.fixtureOriginalSignOut=fixtureSDK.signOut;
          fixtureSDK.signOut=instance=>instance.app.name==='coda-classroom'
            ?Promise.reject(Error('Auth cleanup unavailable in the fixture'))
            :fixtureOriginalSignOut(instance);
        }''')
        self.settings(page);page.locator('#worldLogOut').click()
        expect(page.locator('#classpassStatus')).to_contain_text('Log out')
        self.assertTrue(page.url.endswith('/world-preview.html'))
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertTrue(page.evaluate('CodaClassroomBoot.getState().recovering'))
        self.assertTrue(page.evaluate('document.documentElement.classList.contains("classroom-protected")'))
        expect(page.locator('.classroom-profile-ui')).to_be_visible()
        expect(page.locator('#classpassLogOut')).to_be_visible()
        expect(page.locator('#classpassLogOut')).to_be_enabled()
        self.assertEqual(page.evaluate('localStorage.codaSongMachineDraftV1'),'GUEST AUTH RETRY DRAFT')
        self.assertFalse(page.evaluate('fixturePianoReward("piano-lesson:twinkle",24).ok'))
        page.evaluate('()=>{fixtureSDK.signOut=fixtureOriginalSignOut;}')
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassLogOut').click()
        self.expect_title(page)
        self.assertEqual(page.evaluate('localStorage.codaSongMachineDraftV1'),'GUEST AUTH RETRY DRAFT')
        self.assertEqual(self.failed_assets,[])


if __name__=='__main__':
    unittest.main(defaultTest=[
      'LoadingLogoutWorldTests.test_resume_is_loading_only_and_profile_options_remain_in_the_game',
      'LoadingLogoutWorldTests.test_settings_logout_saves_student_returns_to_title_and_next_player_is_private',
      'LoadingLogoutWorldTests.test_profile_logout_saves_teacher_and_requires_a_new_google_sign_in',
      'LoadingLogoutWorldTests.test_failed_logout_keeps_the_profile_and_offers_a_safe_retry',
      'LoadingLogoutWorldTests.test_auth_cleanup_failure_keeps_gameplay_protected_until_logout_retry',
    ],verbosity=2)
