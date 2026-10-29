"""Real Firebase session survives an isolated unlock preview and its reloads.

The SDK and anonymous/Google credentials belong only to loopback demo emulators.
Production account, storage, test-mode, boot and world code run unchanged.
"""
import importlib.util
from pathlib import Path
import unittest

from playwright.sync_api import expect

_spec=importlib.util.spec_from_file_location('test_mode_auth_world',Path(__file__).with_name('classroom-world-browser.py'))
world_fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(world_fixture)
fixture=world_fixture.fixture
World=world_fixture.ClassroomWorldBrowserTests


class DeveloperTestModeAuthTests(unittest.TestCase):
    setUpClass=classmethod(World.setUpClass.__func__)
    tearDownClass=classmethod(World.tearDownClass.__func__)
    setUp=World.setUp
    tearDown=World.tearDown
    device=World.device
    start=World.start
    call=World.call
    assert_ok=World.assert_ok
    world=World.world
    ready=World.ready
    teacher_entry=World.teacher_entry
    open_card_ui=World.open_card_ui
    join_world=World.join_world

    def teacher_player(self):
        self.admin.evaluate('fixtureProgress(480,220)')
        self.admin.evaluate('localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:"Teacher player",shirt:"#7252b5",headwear:"beanie"})')
        self.assert_ok(self.call(self.admin,'savePersonalPlayer'))
        page=self.teacher_entry(self.world())
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignIn').click()
        self.ready(page,{'profileId':self.teacher_uid})
        if page.locator('#panel').is_visible():page.locator('#panelClose').click()
        return page

    def round_trip(self,reload_preview=False):
        page=self.teacher_player()
        before=page.evaluate('''()=>({
          admin:CodaClassroomSession.getState().admin,
          profile:CodaClassroomSession.getState().profile,
          tab:CodaClassroomStorageInstance.tabId,name:window.name,
          progress:CodaClassroomProfileData.capture(localStorage).data,
          adminBinding:sessionStorage.getItem('codaClassroomAdminTabV1')
        })''')
        saved=fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid)
        page.locator('#worldDeveloperBtn').click();page.locator('#devTestUnlocks').click()
        page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().level'),50)
        self.assertFalse(page.evaluate('CodaClassroomSession.getState().admin.signedIn'))
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        if reload_preview:
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        with page.expect_navigation(wait_until='load'):
            page.locator('[data-developer-test-exit]').click()
        self.ready(page,{'profileId':self.teacher_uid})
        after=page.evaluate('''()=>({
          admin:CodaClassroomSession.getState().admin,
          profile:CodaClassroomSession.getState().profile,
          tab:CodaClassroomStorageInstance.tabId,name:window.name,
          progress:CodaClassroomProfileData.capture(localStorage).data,
          adminBinding:sessionStorage.getItem('codaClassroomAdminTabV1')
        })''')
        self.assertEqual(after,before)
        self.assertEqual(fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid),saved)
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(page.evaluate('CodaDeveloperTestMode.isEnabled()'))
        self.assertEqual(self.failed_assets,[])

    def test_teacher_session_and_player_resume_after_unlock_preview(self):
        self.round_trip()

    def test_teacher_session_and_player_resume_after_reloading_unlock_preview(self):
        self.round_trip(reload_preview=True)

    def test_successful_google_signout_returns_to_title_then_guest_play_is_intentional(self):
        page=self.teacher_player();page.evaluate('CodaClassroomUIInstance.open("admin")')
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignOut').click()
        page.wait_for_url('**/index.html');expect(page.locator('#titleGuest')).to_be_visible()
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        page.locator('#titleGuest').click();self.ready(page)
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(page.evaluate('CodaClassroomSession.getState().admin.signedIn'))
        page.reload(wait_until='load');self.ready(page)
        self.assertTrue(page.url.endswith('world-preview.html') or 'world-preview.html?' in page.url)

    def test_student_leave_returns_to_title_and_saves_progress_before_leaving(self):
        page=self.world();self.join_world(page)
        page.evaluate('CodaPlayerProgression.create().awardXP("game:before-leaving",35,"Music practice")')
        page.locator('#levelBtn').click();page.get_by_role('button',name='Classroom profile',exact=True).click()
        page.locator('#classpassLeave').click()
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassConfirm').click()
        page.wait_for_url('**/index.html');expect(page.locator('#titleGuest')).to_be_visible()
        saved=fixture.database('classroomV1/classes/'+self.class_id+'/profiles/'+self.card['profileId']+'/state')
        self.assertEqual(saved['data']['progression']['xp'],35)

    def test_expired_google_session_returns_to_title_without_reopening_the_old_player(self):
        page=self.teacher_player()
        # Real SDK sign-out simulates an expired Firebase identity while the
        # app's existing tab marker remains. No account tokens are inspected.
        with page.expect_navigation(wait_until='load'):
            page.evaluate('''async()=>{
              const app=fixtureSDK.getApps().find(app=>app.name==='coda-classroom-admin');
              await fixtureSDK.signOut(fixtureSDK.getAuth(app));
            }''')
        page.wait_for_url('**/index.html')
        expect(page.locator('#titleGuest')).to_be_visible()
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))

    def test_fresh_guest_stays_in_the_world_without_a_redirect_loop(self):
        page=self.world();self.ready(page)
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        page.reload(wait_until='load');self.ready(page)
        self.assertIn('world-preview.html',page.url)

    def test_teacher_without_a_personal_player_keeps_login_and_signout_still_returns_title(self):
        page=self.world();page.evaluate('CodaClassroomUIInstance.open("admin")')
        page.locator('#classpassAdminSignIn').click()
        page.wait_for_function('CodaClassroomSession.getState().admin.authorized&&!CodaClassroomSession.getState().loading')
        before=page.evaluate('({admin:CodaClassroomSession.getState().admin,tab:CodaClassroomStorageInstance.tabId})')
        page.locator('#panelClose').click();page.locator('#worldDeveloperBtn').click();page.locator('#devTestUnlocks').click()
        page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        page.locator('[data-developer-test-exit]').click();self.ready(page)
        page.wait_for_function('CodaClassroomSession.getState().admin.authorized')
        self.assertEqual(page.evaluate('({admin:CodaClassroomSession.getState().admin,tab:CodaClassroomStorageInstance.tabId})'),before)
        self.assertIsNone(page.evaluate('CodaClassroomSession.getState().profile'))
        page.evaluate('CodaClassroomUIInstance.open("admin")')
        expect(page.locator('#classpassPersonalSave')).to_be_enabled()
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignOut').click()
        page.wait_for_url('**/index.html');expect(page.locator('#titleGuest')).to_be_visible()

    def test_preview_round_trip_does_not_grant_a_new_tab_the_original_teacher_session(self):
        page=self.teacher_player();page.locator('#worldDeveloperBtn').click();page.locator('#devTestUnlocks').click()
        page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        page.reload(wait_until='domcontentloaded')
        page.wait_for_function('window.CodaArcadeQA?.testMode().seeded&&CodaDeveloperConsole?.ready()')
        page.locator('[data-developer-test-exit]').click();self.ready(page,{'profileId':self.teacher_uid})
        with page.expect_popup() as opened:
            page.evaluate('window.open(location.href,"_blank")')
        other=opened.value;other.on('pageerror',lambda error:self.page_errors.append(str(error)))
        self.ready(other)
        self.assertTrue(other.evaluate('CodaClassroomStorageInstance.getState().blocked'))
        self.assertFalse(other.evaluate('CodaClassroomSession.getState().admin.authorized'))
        self.assertIsNone(other.evaluate('CodaClassroomSession.getState().profile'))
        self.assertFalse(other.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertTrue(page.evaluate('CodaClassroomSession.getState().admin.authorized&&CodaArcadeQA.classroomSession().canPlay'))
        other.close()

    def test_teacher_only_auth_loss_returns_to_title_without_waiting_for_reload(self):
        page=self.world();page.evaluate('CodaClassroomUIInstance.open("admin")')
        page.locator('#classpassAdminSignIn').click()
        page.wait_for_function('CodaClassroomSession.getState().admin.authorized&&!CodaClassroomSession.getState().loading')
        with page.expect_navigation(wait_until='load'):
            page.evaluate('''async()=>{
              const app=fixtureSDK.getApps().find(app=>app.name==='coda-classroom-admin');
              await fixtureSDK.signOut(fixtureSDK.getAuth(app));
            }''')
        page.wait_for_url('**/index.html');expect(page.locator('#titleGuest')).to_be_visible()
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))

    def test_student_auth_loss_returns_to_title_without_exposing_the_profile_as_guest(self):
        page=self.world();self.join_world(page)
        with page.expect_navigation(wait_until='load'):
            page.evaluate('''async()=>{
              const app=fixtureSDK.getApps().find(app=>app.name==='coda-classroom');
              await fixtureSDK.signOut(fixtureSDK.getAuth(app));
            }''')
        page.wait_for_url('**/index.html');expect(page.locator('#titleGuest')).to_be_visible()
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))


del World
if __name__=='__main__':unittest.main(verbosity=2)
