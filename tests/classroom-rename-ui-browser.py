"""Teacher class renaming with production UI and disposable service fixtures.

No Firebase account, roster, profile, or saved progress is accessed.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('rename_profile_ui',
    Path(__file__).with_name('classroom-profile-ui-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
_base = _fixture.ClassroomProfileUITests


class ClassroomRenameUITests(unittest.TestCase):
    setUpClass = classmethod(_base.setUpClass.__func__)
    tearDownClass = classmethod(_base.tearDownClass.__func__)
    tearDown = _base.tearDown
    idle = _base.idle
    admin = _base.admin
    calls = _base.calls

    def setUp(self):
        _fixture.ClassroomProfileUITests.setUp(self)
        self.page.evaluate('''()=>{
          window.__holdRename=false;
          __service.renameClass=async(classId,label)=>{
            __record('renameClass',classId,label);
            if(__holdRename)await new Promise(resolve=>window.__releaseRename=resolve);
            const item=__classes.find(item=>item.classId===classId);
            if(!item)return {ok:false,code:'class-not-found'};
            item.label=label;return {ok:true,classId,label};
          };
        }''')

    def edit(self):
        self.page.locator('#classpassRenameClass').click()
        return self.page.locator('#classpassClassNameInput')

    def save(self, label):
        self.page.locator('#classpassClassNameInput').fill(label)
        self.page.locator('#classpassClassNameSave').click()
        self.idle()

    def test_save_keeps_class_id_profile_data_search_and_passes(self):
        self.page.evaluate('''()=>{
          __classes.push({classId:'class-red',label:'Red class'});
          __profiles['class-red']=[];
        }''')
        self.admin()
        self.page.locator('#classpassProfileSearch').fill('Amber')
        before = self.page.evaluate('JSON.stringify(__profiles)')
        field = self.edit()
        self.assertEqual(field.input_value(), 'Blue class')
        self.assertTrue(field.evaluate('node=>node===document.activeElement'))
        self.save('  Zebra class  ')
        self.assertEqual(self.calls('renameClass')[0]['args'], ['class-blue', 'Zebra class'])
        self.assertEqual(self.page.locator('#classpassClass').input_value(), 'class-blue')
        self.assertEqual(self.page.locator('#classpassClass option').all_text_contents(),
                         ['Red class', 'Zebra class'])
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), 'Amber')
        self.assertEqual(self.page.locator('.classpass-profile-row').count(), 1)
        self.assertEqual(self.page.evaluate('JSON.stringify(__profiles)'), before)
        for operation in ['createClass', 'createProfile', 'deleteClass', 'deleteProfile', 'reissuePass']:
            self.assertEqual(self.calls(operation), [])
        self.assertEqual(self.page.locator('#classpassClassNameForm').count(), 0)
        self.assertIn('Class name saved.', self.page.locator('#classpassStatus').inner_text())
        self.page.locator('#classpassRefresh').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Zebra class')

    def test_cancel_preserves_name_and_returns_focus_to_rename(self):
        self.admin(); self.edit().fill('Discard this')
        self.page.locator('#classpassClassNameCancel').click()
        self.assertEqual(self.calls('renameClass'), [])
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Blue class')
        self.assertTrue(self.page.locator('#classpassRenameClass').evaluate('node=>node===document.activeElement'))
        self.assertEqual(self.edit().input_value(), 'Blue class')

    def test_invalid_name_and_failed_save_keep_draft_with_friendly_retry(self):
        self.admin(); self.edit()
        for label in ['', '   ', '<Blue>', '-Blue']:
            self.save(label)
            self.assertEqual(self.calls('renameClass'), [])
            self.assertEqual(self.page.locator('#classpassClassNameInput').input_value(), label)
            self.assertIn('1–40 letters', self.page.locator('#classpassStatus').inner_text())
        self.page.evaluate("__nextError={code:'class-rename-failed',message:'PRIVATE STUDENT NAME AND BACKEND TRACE'}")
        self.save('Green class')
        self.assertEqual(self.page.locator('#classpassClassNameInput').input_value(), 'Green class')
        self.assertIn('Check your connection', self.page.locator('#classpassStatus').inner_text())
        self.assertNotIn('PRIVATE STUDENT', self.page.locator('body').inner_text())
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Blue class')
        self.save('Green class')
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Green class')

    def test_guest_student_and_unapproved_accounts_have_no_rename_controls(self):
        self.assertEqual(self.page.locator('#classpassRenameClass').count(), 0)
        self.page.locator('#classpassTab-admin').click()
        self.assertEqual(self.page.locator('#classpassRenameClass').count(), 0)
        self.page.evaluate('__approveAdmin=false')
        self.page.locator('#classpassAdminSignIn').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassRenameClass').count(), 0)
        self.page.locator('#classpassTab-student').click()
        self.page.evaluate("__emit({profile:{classId:'class-blue',profileId:'profile-one',alias:'Amber Fox 14'}})")
        self.assertEqual(self.page.locator('#classpassRenameClass,#classpassClassNameForm').count(), 0)
        self.assertEqual(self.calls('renameClass'), [])

    def test_class_selection_and_tab_changes_discard_the_previous_draft(self):
        self.page.evaluate("__classes.push({classId:'class-red',label:'Red class'});__profiles['class-red']=[]")
        self.admin(); self.edit().fill('Old draft')
        self.page.locator('#classpassClass').select_option('class-red'); self.idle()
        self.assertEqual(self.page.locator('#classpassClassNameForm').count(), 0)
        self.assertEqual(self.edit().input_value(), 'Red class')
        self.page.locator('#classpassTab-student').click()
        self.page.locator('#classpassTab-admin').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassClassNameForm').count(), 0)
        self.assertEqual(self.calls('renameClass'), [])

    def test_close_while_saving_ignores_late_completion(self):
        self.admin(); self.edit().fill('Late class')
        self.page.evaluate('__holdRename=true')
        self.page.locator('#classpassClassNameSave').click()
        self.assertTrue(self.page.locator('#classpassClassNameSave').is_disabled())
        self.assertTrue(self.page.locator('#classpassClassNameCancel').is_disabled())
        self.page.evaluate('__ui.close();__releaseRename()')
        self.page.wait_for_timeout(20)
        self.assertEqual(len(self.calls('renameClass')), 1)
        self.assertFalse(self.page.evaluate('__ui.getState().open'))
        self.assertEqual(self.page.locator('#classpassClassNameForm').count(), 0)
        self.assertNotIn('Class name saved.', self.page.locator('body').inner_text())

    def test_owner_switch_or_revocation_clears_edit_and_ignores_late_completion(self):
        self.admin(); self.edit().fill('Late class')
        self.page.evaluate('__holdRename=true')
        self.page.locator('#classpassClassNameSave').click()
        self.page.evaluate("__emit({admin:{signedIn:true,authorized:true,uid:'different_teacher'}});__releaseRename()")
        self.idle()
        self.assertEqual(self.page.locator('#classpassClassNameForm').count(), 0)
        self.assertNotIn('Class name saved.', self.page.locator('#classpassStatus').inner_text())
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Blue class')
        self.edit().fill('Revoked draft')
        self.page.evaluate('__emit({admin:{signedIn:true,authorized:false,uid:"different_teacher"}})')
        self.assertEqual(self.page.locator('#classpassClassNameForm,#classpassRenameClass').count(), 0)

    def test_inline_rename_fits_a_phone(self):
        self.admin(); self.edit()
        self.page.screenshot(path='/tmp/classroom-rename-desktop.png', full_page=True)
        self.page.set_viewport_size({'width':320, 'height':740})
        for selector in ['#panel', '.classroom-profile-ui', '#classpassClassNameForm']:
            node = self.page.locator(selector)
            self.assertLessEqual(node.evaluate('node=>node.scrollWidth'),
                                 node.evaluate('node=>node.clientWidth')+2, selector)
        for selector in ['#classpassClassNameSave', '#classpassClassNameCancel']:
            self.assertGreaterEqual(self.page.locator(selector).bounding_box()['height'], 48)
        self.page.screenshot(path='/tmp/classroom-rename-phone.png', full_page=True)
        self.save('Room 3 - Music')
        self.assertEqual(self.page.locator('#classpassClass option:checked').inner_text(), 'Room 3 - Music')


del _base  # Keep unittest discovery focused on the new cases in this module.

if __name__ == '__main__':
    unittest.main(verbosity=2)
