"""Reload and title-page identity checks with the real SDK and demo emulators.

Production classroom service, boot, title page and UI remain unchanged. Only
the Firebase configuration and Google popup credential use the disposable
loopback emulator fixture; no deployed account or student data is accessed.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

from playwright.sync_api import expect

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'remembered_world_fixture', Path(__file__).with_name('classroom-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)
fixture = _world.fixture


class RememberedSessionWorldTests(unittest.TestCase):
    setUpClass = classmethod(_world.ClassroomWorldBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(_world.ClassroomWorldBrowserTests.tearDownClass.__func__)
    setUp = _world.ClassroomWorldBrowserTests.setUp
    tearDown = _world.ClassroomWorldBrowserTests.tearDown
    device = _world.ClassroomWorldBrowserTests.device
    start = _world.ClassroomWorldBrowserTests.start
    call = _world.ClassroomWorldBrowserTests.call
    assert_ok = _world.ClassroomWorldBrowserTests.assert_ok
    cloud = _world.ClassroomWorldBrowserTests.cloud
    ready = _world.ClassroomWorldBrowserTests.ready
    open_card_ui = _world.ClassroomWorldBrowserTests.open_card_ui
    join_world = _world.ClassroomWorldBrowserTests.join_world
    teacher_entry = _world.ClassroomWorldBrowserTests.teacher_entry

    def world(self):
        page = _world.ClassroomWorldBrowserTests.world(self)
        # Count only user-requested popup sign-ins in this browsing context.
        # The underlying popup stand-in still uses the real SDK credential API.
        page.add_init_script('''(()=>{
          let held;
          Object.defineProperty(window,'fixtureSDK',{configurable:true,
            get:()=>held,set:value=>{
              held=value;const original=value.signInWithPopup;
              value.signInWithPopup=(...args)=>{
                const key='remembered-fixture-popups';
                sessionStorage.setItem(key,String(Number(sessionStorage.getItem(key)||0)+1));
                return original(...args);
              };
            }});
        })()''')
        page.on('console', lambda message: self.page_errors.append(message.text)
                if message.type == 'error' and message.text.startswith('Arcade frame error:') else None)
        return page

    def popup_count(self, page):
        return page.evaluate('Number(sessionStorage.getItem("remembered-fixture-popups")||0)')

    def seed_teacher(self):
        self.admin.evaluate('fixtureProgress(830,420)')
        self.admin.evaluate('''()=>{
          const avatar=JSON.parse(localStorage.musicArcadeV1);
          Object.assign(avatar,{name:'Mr Wood remembered',shirt:'#146f85',headwear:'beanie'});
          localStorage.musicArcadeV1=JSON.stringify(avatar);
        }''')
        self.assert_ok(self.call(self.admin, 'savePersonalPlayer'))

    def sign_in_teacher_world(self):
        self.seed_teacher()
        page = self.teacher_entry(self.world())
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignIn').click()
        self.ready(page, {'profileId': self.teacher_uid})
        self.assertEqual(self.popup_count(page), 1)
        return page

    def title(self, page, state='signed-in'):
        page.goto(self.url.rsplit('/', 1)[0]+'/index.html', wait_until='load')
        page.wait_for_function('expected=>document.querySelector("#titleSessionStatus")?.dataset.sessionState===expected', arg=state)
        self.assertEqual(page.locator('canvas,audio,video').count(), 0)
        return page.locator('#titleSessionStatus')

    def player(self, page):
        return page.evaluate('''()=>({
          profile:CodaClassroomSession.getState().profile,
          xp:CodaArcadeQA.progression().xp,balance:CodaArcadeQA.notes().balance,
          shirt:CodaArcadeQA.characters().player.appearance.shirt,
          headwear:CodaArcadeQA.characters().player.appearance.headwear,
          canPlay:CodaArcadeQA.classroomSession().canPlay
        })''')

    def local_snapshot(self, page):
        return page.evaluate('''()=>({
          workspace:localStorage.getItem('codaClassroomWorkspaceV1'),
          active:sessionStorage.getItem('codaClassroomActiveV1'),
          values:Object.fromEntries(CodaClassroomProfileData.SCOPED_KEYS.map(key=>[key,localStorage.getItem(key)]))
        })''')

    def test_three_refreshes_then_verified_title_continue_keep_the_cloud_player_without_signing_in_again(self):
        page = self.sign_in_teacher_world()
        expected = self.player(page)
        self.assertEqual(expected['profile']['alias'], 'Mr Wood remembered')
        self.assertEqual(expected['xp'], 830)
        self.assertEqual(expected['balance'], 570)
        self.assertEqual(expected['shirt'], '#146f85')
        self.assertEqual(expected['headwear'], 'beanie')
        for _ in range(3):
            before = len(self.world_navigations)
            page.reload(wait_until='load')
            self.ready(page, {'profileId': self.teacher_uid})
            page.wait_for_timeout(150)
            self.assertEqual(len(self.world_navigations), before+1,
                             'A plain reload must not trigger an identity-reload loop.')
            self.assertEqual(self.player(page), expected)
            self.assertEqual(self.popup_count(page), 1)

        original_local = self.local_snapshot(page)
        original_cloud = fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid)
        status = self.title(page)
        self.assertIn('Signed in', status.inner_text())
        self.assertIn('Mr Wood remembered', status.inner_text())
        self.assertIn('Mr Wood remembered', page.locator('#titleProfile strong').inner_text())
        self.assertEqual(self.local_snapshot(page), original_local,
                         'Checking title status must not claim a workspace or write player progress.')
        self.assertEqual(fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid), original_cloud)
        self.assertIsNone(fixture.database('classroomV1/sessions'))
        page.reload(wait_until='load')
        page.wait_for_function('document.querySelector("#titleSessionStatus")?.dataset.sessionState==="signed-in"')
        self.assertEqual(self.local_snapshot(page), original_local)
        self.assertEqual(self.popup_count(page), 1)
        page.locator('#titleProfile').click()
        self.ready(page, {'profileId': self.teacher_uid})
        self.assertEqual(self.player(page), expected)
        self.assertEqual(self.popup_count(page), 1)
        self.assertEqual(self.failed_assets, [])

    def test_explicit_log_out_stays_logged_out_on_title_and_world_refresh(self):
        page = self.sign_in_teacher_world()
        if page.locator('#panel').is_visible():
            page.locator('#panelClose').click()
        page.locator('#worldMenuBtn').click()
        with page.expect_navigation(wait_until='load'):
            page.locator('#worldLogOut').click()
        page.wait_for_url('**/index.html')
        page.wait_for_function('document.querySelector("#titleSessionStatus")?.dataset.sessionState==="guest"')
        self.assertNotIn('Mr Wood remembered', page.locator('body').inner_text())
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomActiveV1")'))
        page.reload(wait_until='load')
        expect(page.locator('#titleSessionStatus')).to_contain_text('guest')
        self.assertEqual(self.popup_count(page), 1)
        page.locator('#titleGuest').click()
        self.ready(page)
        self.assertIsNone(page.evaluate('CodaClassroomSession.getState().profile'))
        self.assertFalse(page.evaluate('CodaClassroomSession.getState().admin.signedIn'))
        page.reload(wait_until='load')
        self.ready(page)
        self.assertIsNone(page.evaluate('CodaClassroomSession.getState().profile'))
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(self.popup_count(page), 1)
        self.assertEqual(self.failed_assets, [])

    def test_student_title_inspection_does_not_renew_lease_or_expose_a_profile_to_a_cloned_tab(self):
        page = self.world()
        self.join_world(page)
        before_local = self.local_snapshot(page)
        before_cloud = self.cloud()
        status = self.title(page)
        self.assertIn(self.card['alias'], status.inner_text())
        self.assertEqual(self.local_snapshot(page), before_local)
        self.assertEqual(self.cloud(), before_cloud,
                         'Read-only title inspection must not renew a student lease or change progress.')
        with page.expect_popup() as pending:
            page.evaluate('url=>window.open(url,"_blank")', self.url.rsplit('/', 1)[0]+'/index.html')
        other = pending.value
        other.wait_for_function('document.querySelector("#titleSessionStatus")?.dataset.sessionState==="blocked"')
        self.assertNotIn(self.card['alias'], other.locator('body').inner_text())
        self.assertIsNone(other.evaluate('localStorage.getItem("musicArcadeV1")'))
        self.assertEqual(other.evaluate('fixtureSDK.getApps().length'), 0,
                         'A cloned tab must not connect Firebase to inspect the first child.')
        self.assertEqual(self.local_snapshot(page), before_local)
        self.assertEqual(self.cloud(), before_cloud)
        self.assertEqual(self.popup_count(page), 0)
        self.assertEqual(self.failed_assets, [])

    def test_twenty_minutes_without_input_does_not_sign_out_student_or_teacher(self):
        student = self.device()
        self.assert_ok(self.call(student, 'join', self.card['pass']))
        self.seed_teacher()
        for page in [student, self.admin]:
            before = self.call(page, 'getState')
            local = page.evaluate('CodaClassroomProfileData.capture(localStorage).data')
            page.evaluate('''()=>{
              window.fixtureNow=Date.now()+20*60*1000;
              for(const timer of fixtureTimers.filter(timer=>timer.delay===10000))timer.fn();
            }''')
            page.wait_for_timeout(150)
            after = self.call(page, 'getState')
            self.assertEqual(after['profile'], before['profile'])
            self.assertEqual(after['admin']['signedIn'], before['admin']['signedIn'])
            self.assertFalse(after['locked'])
            self.assertTrue(self.call(page, 'isWritable'))
            self.assert_ok(self.call(page, 'flush'))
            self.assertEqual(page.evaluate('CodaClassroomProfileData.capture(localStorage).data'), local)
            self.assertEqual(page.evaluate('fixtureEvents.filter(event=>event.exitToTitle===true).length'), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
