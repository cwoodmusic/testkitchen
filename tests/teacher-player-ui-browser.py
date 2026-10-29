"""Teacher personal-player UI: explicit first save and student isolation.

Production UI/CSS run with an in-memory service. No Firebase, real login,
clipboard, or live profiles are accessed.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'teacher_player_ui_fixture', Path(__file__).with_name('classroom-profile-ui-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

PERSONAL_FIXTURE = r'''()=>{
 localStorage.musicArcadeV1=JSON.stringify({name:'Mr Wood <arcade>',shirt:'#778899'});
 const open=()=>{
  __emit({personal:{available:true,active:true},profile:{kind:'teacher',
   classId:'teacher_personal',profileId:'teacherSetupUID_123456',alias:'Mr Wood <arcade>',picture:'owl'}});
  return {ok:true};
 };
 __service.savePersonalPlayer=async()=>{__record('savePersonalPlayer');return open();};
 __service.openPersonalPlayer=async()=>{__record('openPersonalPlayer');return open();};
 __service.renamePersonalPlayer=async alias=>{
  __record('renamePersonalPlayer',alias);const owner=__state.profile?.profileId;
  __emit({loading:true,readOnly:true});
  const result=window.__holdRename?await new Promise(resolve=>window.__releaseRename=resolve):(window.__renameFailure||{ok:true,alias});
  if(result.ok&&__state.profile?.profileId===owner)__emit({profile:{...__state.profile,alias:result.alias||alias}});
  __emit({loading:false,readOnly:false});return result;
 };
 const leave=__service.leave;
 __service.leave=async options=>{const result=await leave(options);if(result.ok)__emit({personal:{available:true,active:false}});return result;};
 __emit({personal:{available:false,active:false}});
}'''


class TeacherPlayerUITests(unittest.TestCase):
    setUpClass = classmethod(fixture.ClassroomProfileUITests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ClassroomProfileUITests.tearDownClass.__func__)
    tearDown = fixture.ClassroomProfileUITests.tearDown
    idle = fixture.ClassroomProfileUITests.idle
    admin = fixture.ClassroomProfileUITests.admin
    calls = fixture.ClassroomProfileUITests.calls

    def setUp(self):
        fixture.ClassroomProfileUITests.setUp(self)
        self.page.evaluate(PERSONAL_FIXTURE)

    def teacher(self, view='admin'):
        self.admin()
        self.page.evaluate('''__emit({personal:{available:true,active:true},
         profile:{kind:'teacher',classId:'teacher_personal',profileId:'teacherSetupUID_123456',alias:'Guest',picture:'owl'},
         readOnly:false,locked:false,waitingTakeover:false})''')
        if view == 'student':
            self.page.locator('#classpassTab-student').click()

    def test_teacher_can_replace_guest_nickname_from_both_player_pages(self):
        self.teacher()
        self.assertIn('Nickname: Guest', self.page.locator('.classpass-personal-player').inner_text())
        self.page.get_by_role('button', name='Change nickname', exact=True).click()
        nickname=self.page.get_by_label('Arcade nickname', exact=True)
        self.assertEqual(nickname.input_value(), 'Guest')
        self.assertEqual(nickname.get_attribute('maxlength'), '40')
        nickname.fill('  Mr Wooooood  ')
        self.page.get_by_role('button', name='Save nickname', exact=True).click(); self.idle()
        self.assertEqual(self.calls('renamePersonalPlayer')[0]['args'], ['Mr Wooooood'])
        self.assertEqual(self.page.evaluate('__state.profile.alias'), 'Mr Wooooood')
        self.assertIn('Nickname: Mr Wooooood', self.page.locator('.classpass-personal-player').inner_text())
        self.assertEqual(self.page.locator('#classpassNicknameForm').count(), 0)
        self.page.locator('#classpassTab-student').click()
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Mr Wooooood')
        self.page.get_by_role('button', name='Change nickname', exact=True).click()
        self.page.get_by_label('Arcade nickname', exact=True).fill('Mr <arcade>')
        self.page.get_by_role('button', name='Save nickname', exact=True).click(); self.idle()
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Mr <arcade>')
        self.assertEqual(self.page.locator('arcade').count(), 0)

    def test_pending_rename_keeps_draft_and_prevents_a_second_submission(self):
        self.teacher('student')
        self.page.locator('#classpassPersonalRename').click()
        self.page.locator('#classpassNicknameInput').fill('Captain Coda')
        self.page.evaluate('__holdRename=true')
        self.page.locator('#classpassNicknameSave').click()
        self.assertTrue(self.page.locator('#classpassNicknameSave').is_disabled())
        self.assertTrue(self.page.locator('#classpassNicknameCancel').is_disabled())
        self.assertEqual(self.page.locator('#classpassNicknameInput').input_value(), 'Captain Coda')
        self.assertEqual(self.page.evaluate('__state.profile.alias'), 'Guest')
        self.page.evaluate('__emit({status:"Still saving"});document.querySelector("#classpassNicknameForm").requestSubmit()')
        self.assertEqual(len(self.calls('renamePersonalPlayer')), 1)
        self.page.evaluate('__releaseRename({ok:true,alias:"Captain Coda"})'); self.idle()
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Captain Coda')

    def test_failed_rename_keeps_the_previous_nickname_and_editable_draft(self):
        self.teacher('student')
        self.page.locator('#classpassPersonalRename').click()
        self.page.locator('#classpassNicknameInput').fill('Maestro Wood')
        self.page.evaluate('__renameFailure={ok:false,code:"personal-rename-failed"}')
        self.page.locator('#classpassNicknameSave').click(); self.idle()
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Guest')
        self.assertEqual(self.page.locator('#classpassNicknameInput').input_value(), 'Maestro Wood')
        self.assertTrue(self.page.locator('#classpassNicknameInput').is_enabled())
        self.assertIn('previous nickname is still in use', self.page.locator('#classpassStatus').inner_text())
        self.page.evaluate('__renameFailure=null')
        self.page.locator('#classpassNicknameSave').click(); self.idle()
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Maestro Wood')

    def test_empty_long_or_control_character_nicknames_do_not_call_the_service(self):
        self.teacher('student')
        self.page.locator('#classpassPersonalRename').click()
        for value in ['', '   ', 'x'*41, 'Captain\x01Coda', '\x85Captain', 'Captain\x85']:
            with self.subTest(value=repr(value)):
                self.page.locator('#classpassNicknameInput').evaluate('''(node,value)=>{
                 node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));
                }''', value)
                self.page.locator('#classpassNicknameSave').click(); self.idle()
                self.assertEqual(self.calls('renamePersonalPlayer'), [])
                self.assertEqual(self.page.evaluate('__state.profile.alias'), 'Guest')
                self.assertIn('1–40 characters', self.page.locator('#classpassStatus').inner_text())

    def test_only_the_writable_owned_teacher_profile_exposes_nickname_controls(self):
        self.teacher('student')
        self.assertTrue(self.page.locator('#classpassPersonalRename').is_visible())
        cases=[{'readOnly':True}, {'locked':True}, {'waitingTakeover':True}, {'enabled':False},
               {'admin':{'signedIn':True,'authorized':False,'uid':'teacherSetupUID_123456'}},
               {'profile':{'kind':'teacher','classId':'teacher_personal','profileId':'other_teacher','alias':'Other teacher'}},
               {'profile':{'classId':'class-blue','profileId':'profile-one','alias':'Amber Fox 14','picture':'fox'}}]
        baseline=self.page.evaluate('JSON.parse(JSON.stringify(__state))')
        for patch in cases:
            with self.subTest(patch=patch):
                self.page.evaluate('([baseline,patch])=>__emit({...baseline,...patch})', [baseline,patch])
                self.assertEqual(self.page.locator('#classpassPersonalRename,#classpassNicknameForm').count(), 0)
        self.assertEqual(self.calls('renamePersonalPlayer'), [])

    def test_cancel_close_and_identity_changes_clear_the_draft_and_late_status(self):
        self.teacher('student')
        self.page.locator('#classpassPersonalRename').click()
        self.page.locator('#classpassNicknameInput').fill('Discard me')
        self.page.locator('#classpassNicknameCancel').click()
        self.page.locator('#classpassPersonalRename').click()
        self.assertEqual(self.page.locator('#classpassNicknameInput').input_value(), 'Guest')
        self.page.locator('#classpassNicknameInput').fill('Discard on close')
        self.page.evaluate('__ui.close();__ui.open("student")')
        self.assertEqual(self.page.locator('#classpassNicknameForm').count(), 0)
        self.page.locator('#classpassPersonalRename').click()
        self.assertEqual(self.page.locator('#classpassNicknameInput').input_value(), 'Guest')
        self.page.locator('#classpassNicknameInput').fill('Old teacher draft')
        self.page.evaluate('__holdRename=true')
        self.page.locator('#classpassNicknameSave').click()
        self.page.evaluate('''__emit({personal:{available:false,active:false},
         profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14',picture:'fox'}});
         __releaseRename({ok:true,alias:'Old teacher draft'});''')
        self.idle()
        self.assertEqual(self.page.locator('#classpassNicknameForm,#classpassPersonalRename').count(), 0)
        self.assertEqual(self.page.locator('.classpass-identity h3').inner_text(), 'Amber Fox 14')
        self.assertNotIn('Old teacher draft', self.page.locator('body').inner_text())
        self.assertNotIn('Nickname saved', self.page.locator('#classpassStatus').inner_text())

    def test_logout_drops_nickname_draft_before_the_next_teacher_signin(self):
        self.teacher()
        self.page.locator('#classpassPersonalRename').click()
        self.page.locator('#classpassNicknameInput').fill('Private draft')
        self.page.locator('#classpassAdminSignOut').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassNicknameForm').count(), 0)
        self.assertNotIn('Private draft', self.page.locator('body').inner_text())
        self.page.locator('#classpassAdminSignIn').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassNicknameForm').count(), 0)

    def test_first_save_is_explicit_names_current_player_and_defaults_to_cancel(self):
        self.admin()
        self.assertEqual(self.calls('savePersonalPlayer'), [])
        self.assertIn('device with your latest progress', self.page.locator('.classpass-personal-player').inner_text())
        self.page.locator('#classpassPersonalSave').click()
        self.assertIn('Mr Wood <arcade>', self.page.get_by_role('alertdialog').inner_text())
        self.assertIn('first save', self.page.get_by_role('alertdialog').inner_text())
        self.assertTrue(self.page.locator('#classpassCancel').evaluate('node=>node===document.activeElement'))
        self.assertEqual(self.page.locator('arcade').count(), 0, 'Nickname is rendered as text')
        self.page.locator('#classpassCancel').click()
        self.assertEqual(self.calls('savePersonalPlayer'), [])
        self.page.locator('#classpassPersonalSave').click()
        self.page.locator('#classpassConfirm').click()
        self.idle()
        self.assertEqual(len(self.calls('savePersonalPlayer')), 1)
        self.assertEqual(self.page.evaluate('__openedProfiles[0].kind'), 'teacher')
        self.assertTrue(self.page.locator('#classpassPersonalOpen').is_disabled())

    def test_student_cannot_be_saved_as_teacher_but_existing_player_can_be_opened(self):
        self.page.locator('#classpassJoinInput').fill('student-card')
        self.page.locator('#classpassJoin').click(); self.idle()
        self.admin()
        self.assertTrue(self.page.locator('#classpassPersonalSave').is_disabled())
        self.assertIn('Leave the student profile', self.page.locator('.classpass-personal-player').inner_text())
        self.assertEqual(self.calls('savePersonalPlayer'), [])
        self.page.evaluate('__emit({personal:{available:true,active:false}})')
        self.assertEqual(self.page.locator('#classpassPersonalSave').count(), 0)
        self.page.locator('#classpassPersonalOpen').click(); self.idle()
        self.assertEqual(len(self.calls('openPersonalPlayer')), 1)
        self.assertEqual(self.calls('savePersonalPlayer'), [])

    def test_confirmation_cannot_save_a_changed_player_or_after_revocation(self):
        self.admin()
        self.page.locator('#classpassPersonalSave').click()
        self.page.evaluate('localStorage.musicArcadeV1=JSON.stringify({name:"Other player"})')
        self.page.locator('#classpassConfirm').click()
        self.assertEqual(self.calls('savePersonalPlayer'), [])
        self.assertIn('Your player changed', self.page.locator('#classpassStatus').inner_text())
        self.page.locator('#classpassPersonalSave').click()
        self.page.evaluate('__emit({admin:{signedIn:true,authorized:false,uid:"teacherSetupUID_123456"}})')
        self.assertEqual(self.page.get_by_role('alertdialog').count(), 0)
        self.assertEqual(self.page.locator('#classpassPersonalSave').count(), 0)
        self.assertEqual(self.calls('savePersonalPlayer'), [])

    def test_personal_page_uses_google_instructions_and_closes_without_card_language(self):
        self.admin()
        self.page.evaluate('__emit({personal:{available:true,active:false}})')
        self.page.locator('#classpassPersonalOpen').click(); self.idle()
        self.page.locator('#classpassTab-student').click()
        self.assertEqual(self.page.locator('#classpassTab-student').inner_text(), 'My player')
        self.assertIn('Sign in on another device', self.page.locator('body').inner_text())
        self.assertNotIn('Use your card', self.page.locator('body').inner_text())
        self.page.locator('#classpassLeave').click()
        self.assertIn('Google account', self.page.get_by_role('alertdialog').inner_text())
        self.assertNotIn('card', self.page.get_by_role('alertdialog').inner_text())
        self.page.locator('#classpassConfirm').click(); self.idle()
        self.assertEqual(len(self.calls('leave')), 1)
        self.assertIn('It stays saved with your Google account', self.page.locator('#classpassStatus').inner_text())

    def test_conflicted_personal_player_exposes_recovery_from_teacher_page(self):
        self.admin()
        self.page.evaluate('''__emit({personal:{available:true,active:true},
         profile:{kind:'teacher',profileId:'teacherSetupUID_123456',alias:'Mr Wood'},
         locked:true,pending:true,code:'unsaved-conflict'})''')
        self.assertEqual(self.page.locator('#classpassPersonalOpen').count(), 0)
        self.assertIn('needs a check', self.page.locator('.classpass-personal-player').inner_text())
        self.page.locator('#classpassPersonalCheck').click()
        self.assertTrue(self.page.locator('#classpassUseSaved').is_visible())
        self.assertEqual(self.calls('useSavedProgress'), [], 'Checking does not discard unsaved progress')


if __name__ == '__main__':
    unittest.main(verbosity=2)
