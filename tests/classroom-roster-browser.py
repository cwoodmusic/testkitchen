"""Teacher profile browsing with hundreds of synthetic metadata-only profiles.

Uses the existing isolated UI fixture and production UI/CSS. All network
requests remain blocked; no Firebase, real students, or real credentials.
"""
from pathlib import Path
import runpy
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
UI_FIXTURE = runpy.run_path(str(ROOT / 'tests/classroom-profile-ui-browser.py'),
                           run_name='classroom_ui_fixture')
BaseUI = UI_FIXTURE['ClassroomProfileUITests']


class ClassroomRosterTests(unittest.TestCase):
    # Reuse the harness, not the old test methods.
    setUpClass = BaseUI.__dict__['setUpClass']
    tearDownClass = BaseUI.__dict__['tearDownClass']
    setUp = BaseUI.setUp
    tearDown = BaseUI.tearDown
    idle = BaseUI.idle
    admin = BaseUI.admin
    calls = BaseUI.calls

    def roster(self, count=237):
        self.page.evaluate('''count => {
          __classes = [
            {classId:'class-blue',label:'Blue class'},
            {classId:'class-green',label:'Green class'},
            {classId:'class-empty',label:'Empty class'}
          ];
          __profiles = {
            'class-blue':Array.from({length:count},(_,index)=>{
              const number=count-index;
              return {profileId:'profile-'+String(number).padStart(4,'0'),
                alias:'Amber Fox '+number,picture:'fox',
                data:{name:'DO NOT SHOW REAL CHILD NAME',notes:64},
                pass:'DO NOT SHOW PRIVATE PASS'};
            }),
            'class-green':[
              {profileId:'profile-green-11',alias:'Silver Owl 11',picture:'owl'},
              {profileId:'profile-green-3',alias:'Silver Owl 3',picture:'owl'}
            ],
            'class-empty':[]
          };
          __receipt=(profileId='profile-new')=>{
            const profile=Object.values(__profiles).flat().find(row=>row.profileId===profileId)
              || {profileId,alias:'Silver Owl 27',picture:'owl'};
            const pass='PRIVATE-PASS-'+(++__sequence)+'-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            return {ok:true,profileId,alias:profile.alias,picture:profile.picture,pass,
              link:'https://school.example/coda-arcade/world-preview.html#classroom-pass='+pass};
          };
        }''', count)
        self.admin()

    def aliases(self):
        return self.page.locator('.classpass-profile-identity strong').all_text_contents()

    def assert_page(self, page, pages):
        self.assertRegex(self.page.locator('#classpassRosterPage').inner_text(),
                         rf'\b{page}\b.*\b{pages}\b')

    def test_hundreds_are_naturally_sorted_and_render_only_one_page(self):
        self.roster()
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(1, 21)])
        self.assertRegex(self.page.locator('#classpassProfileCount').inner_text(), r'\b237\b')
        self.assertEqual(self.page.locator('#classpassProfileCount').get_attribute('aria-live'), 'polite')
        self.assert_page(1, 12)
        self.assertTrue(self.page.locator('#classpassRosterPrev').is_disabled())
        self.assertTrue(self.page.locator('#classpassRosterNext').is_enabled())
        self.page.locator('#classpassRosterNext').click()
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(21, 41)])
        self.assert_page(2, 12)
        self.page.locator('#classpassRosterPrev').click()
        self.assertEqual(self.aliases()[0], 'Amber Fox 1')
        self.page.locator('#classpassRosterNextBottom').click()
        self.assertEqual(self.aliases()[0], 'Amber Fox 21')
        self.page.locator('#classpassRosterPrev').click()
        for _ in range(11):
            self.page.locator('#classpassRosterNext').click()
            self.assertLessEqual(self.page.locator('.classpass-profile-row').count(), 20)
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(221, 238)])
        self.assert_page(12, 12)
        self.assertTrue(self.page.locator('#classpassRosterNext').is_disabled())
        self.assertEqual(len(self.calls('listProfiles')), 1,
                         'Paging only uses the already-loaded metadata directory')
        self.assertNotIn('DO NOT SHOW', self.page.locator('body').inner_text())

    def test_search_is_case_and_space_tolerant_and_clear_restores_the_first_page(self):
        self.roster()
        self.page.locator('#classpassRosterNext').click()
        query = '  aMbEr   FoX  23  '
        self.page.locator('#classpassProfileSearch').fill(query)
        self.assertEqual(self.aliases(), ['Amber Fox 23'] +
                         [f'Amber Fox {n}' for n in range(230, 238)])
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), query)
        self.assertTrue(self.page.locator('#classpassProfileSearch').evaluate(
            'node=>node===document.activeElement'), 'Typing must retain keyboard focus')
        self.assertRegex(self.page.locator('#classpassProfileCount').inner_text(), r'\b9\b')
        self.page.locator('#classpassClearSearch').click()
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), '')
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(1, 21)])
        self.assert_page(1, 12)
        self.page.locator('#classpassProfileSearch').fill('Amber Fox 2')
        expected = [2] + list(range(20, 30)) + list(range(200, 238))
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in expected[:20]])
        self.assert_page(1, 3)
        self.page.locator('#classpassProfileSearch').fill('no such generated alias')
        self.assertEqual(self.aliases(), [])
        self.assertRegex(self.page.locator('body').inner_text(), r'(?i)no[^\n]*match')
        self.assertEqual(len(self.calls('listProfiles')), 1,
                         'Searching must not download profile progress or passes')
        self.assertNotIn('no such generated alias',
                         self.page.evaluate('JSON.stringify(localStorage)'))

    def test_changing_classes_resets_search_and_page_and_empty_class_is_clear(self):
        self.roster()
        self.page.locator('#classpassProfileSearch').fill('Amber Fox 2')
        self.page.locator('#classpassRosterNext').click()
        self.assert_page(2, 3)
        self.page.locator('#classpassClass').select_option('class-green')
        self.idle()
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), '')
        self.assertEqual(self.aliases(), ['Silver Owl 3', 'Silver Owl 11'])
        self.page.locator('#classpassClass').select_option('class-empty')
        self.idle()
        self.assertEqual(self.aliases(), [])
        self.assertRegex(self.page.locator('.classpass-empty').inner_text(),
                         r'(?i)(no profiles|no[^\n]*yet|first[^\n]*profile)')
        self.page.locator('#classpassClass').select_option('class-blue')
        self.idle()
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), '')
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(1, 21)])
        self.assert_page(1, 12)

    def test_confirmation_reissue_and_refresh_keep_browsing_context_and_correct_target(self):
        self.roster()
        self.page.locator('#classpassProfileSearch').fill('Amber Fox')
        self.page.locator('#classpassRosterNext').click()
        self.page.locator('#classpassRosterNext').click()
        target = self.page.locator('.classpass-profile-row[data-profile-id="profile-0047"]')
        target.get_by_role('button', name='Delete profile', exact=True).click()
        self.page.locator('#classpassCancel').click()
        self.assertEqual(self.calls('deleteProfile'), [])
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), 'Amber Fox')
        self.assert_page(3, 12)
        target.get_by_role('button', name='Replace pass', exact=True).click()
        self.page.locator('#classpassConfirm').click()
        self.idle()
        self.assertEqual(self.calls('reissuePass')[-1]['args'], ['class-blue', 'profile-0047'])
        self.assertEqual(self.page.locator('.classpass-card-alias').inner_text(), 'Amber Fox 47')
        secret = self.page.locator('.classpass-pass').inner_text()
        self.page.locator('#classpassHide').click()
        self.assertNotIn(secret, self.page.locator('body').inner_text())
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), 'Amber Fox')
        self.assert_page(3, 12)
        self.page.evaluate('''() => {
          const original=__service.listProfiles;
          __service.listProfiles=async classId=>{
            const result=await original(classId);
            return new Promise(resolve=>{
              window.__releaseRefresh=()=>{__service.listProfiles=original;resolve(result);};
            });
          };
        }''')
        self.page.locator('#classpassRefresh').click()
        self.page.wait_for_function('typeof __releaseRefresh==="function"')
        self.assertTrue(self.page.evaluate('__ui.getState().busy'))
        self.page.evaluate('__emit({pending:true})')
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), 'Amber Fox')
        self.assert_page(3, 12)
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(41, 61)])
        self.page.evaluate('__releaseRefresh()')
        self.idle()
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), 'Amber Fox')
        self.assert_page(3, 12)
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(41, 61)])
        self.page.evaluate('__emit({admin:{signedIn:true,authorized:false,uid:"teacherSetupUID_123456"}})')
        self.assertEqual(self.page.locator('.classpass-profile-row,#classpassProfileSearch').count(), 0)
        self.assertNotIn('Amber Fox 47', self.page.locator('body').inner_text())

    def test_deleting_the_last_row_of_last_page_clamps_to_an_existing_page(self):
        self.roster(41)
        self.page.locator('#classpassRosterNext').click()
        self.page.locator('#classpassRosterNext').click()
        self.assertEqual(self.aliases(), ['Amber Fox 41'])
        self.assert_page(3, 3)
        self.page.locator('.classpass-profile-row').get_by_role(
            'button', name='Delete profile', exact=True).click()
        self.page.locator('#classpassConfirm').click()
        self.idle()
        self.assertEqual(self.calls('deleteProfile')[-1]['args'], ['class-blue', 'profile-0041'])
        self.assert_page(2, 2)
        self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(21, 41)])
        self.assertTrue(self.page.locator('#classpassRosterNext').is_disabled())
        self.assertRegex(self.page.locator('#classpassProfileCount').inner_text(), r'\b40\b')

    def test_bottom_pager_and_keyboard_keep_focus_at_first_and_last_page(self):
        self.roster(41)
        for suffix in ('', 'Bottom'):
            self.assertTrue(self.page.locator('#classpassRosterPrev' + suffix).is_disabled())
        self.page.locator('#classpassRosterNextBottom').focus()
        self.page.keyboard.press('Enter')
        self.assert_page(2, 3)
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classpassRosterNext')
        self.page.keyboard.press('Enter')
        self.assert_page(3, 3)
        self.assertEqual(self.aliases(), ['Amber Fox 41'])
        for suffix in ('', 'Bottom'):
            self.assertTrue(self.page.locator('#classpassRosterNext' + suffix).is_disabled())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classpassRosterPage',
                         'Reaching the final page must retain focus on its page label')
        self.page.keyboard.press('Tab')
        self.assertTrue(self.page.locator('.classpass-profile-row button').first.evaluate(
            'node=>node===document.activeElement'), 'Tab skips the disabled Next button')
        self.page.locator('#classpassRosterPrevBottom').focus()
        self.page.keyboard.press('Enter')
        self.assert_page(2, 3)
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classpassRosterPrev')
        self.page.keyboard.press('Enter')
        self.assert_page(1, 3)
        for suffix in ('', 'Bottom'):
            self.assertTrue(self.page.locator('#classpassRosterPrev' + suffix).is_disabled())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classpassRosterPage')
        self.page.keyboard.press('Tab')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classpassRosterNext')

    def test_revoked_role_drops_confirmations_and_late_metadata_before_another_admin(self):
        self.roster()
        self.page.locator('.classpass-profile-row').first.get_by_role(
            'button', name='Replace pass', exact=True).click()
        self.assertEqual(self.page.get_by_role('alertdialog').count(), 1)
        self.page.evaluate('__emit({admin:{signedIn:true,authorized:false,uid:"teacherSetupUID_123456"}})')
        self.assertEqual(self.page.get_by_role('alertdialog').count(), 0)
        self.assertIsNone(self.page.evaluate('__ui.getState().confirmation'))
        self.page.evaluate('__emit({admin:{signedIn:true,authorized:true,uid:"teacherSetupUID_123456"}})')
        self.idle()
        self.page.locator('#classpassProfileSearch').fill('Amber Fox 2')
        self.page.locator('#classpassRosterNext').click()
        self.page.evaluate('''() => {
          const original=__service.listProfiles;
          window.__holdMetadata=true;
          __service.listProfiles=async classId=>{
            if(!__holdMetadata)return original(classId);
            __record('listProfiles',classId);
            return new Promise(resolve=>{
              window.__releaseMetadata=()=>resolve({ok:true,profiles:[
                {profileId:'profile-old-late',alias:'Old Admin Late Alias',picture:'fox'}
              ]});
            });
          };
        }''')
        self.page.locator('#classpassRefresh').click()
        self.page.wait_for_function('typeof __releaseMetadata==="function"')
        self.assertTrue(self.page.evaluate('__ui.getState().busy'))
        self.page.evaluate('''() => {
          __emit({admin:{signedIn:true,authorized:false,uid:'teacherSetupUID_123456'}});
        }''')
        self.assertEqual(self.page.locator('.classpass-profile-row,#classpassProfileSearch').count(), 0)
        self.page.evaluate('''() => {
          __holdMetadata=false;
          __classes=[{classId:'class-new-admin',label:'New admin class'}];
          __profiles={'class-new-admin':[
            {profileId:'profile-new-admin',alias:'Blue Otter 7',picture:'owl'}
          ]};
          __emit({admin:{signedIn:true,authorized:true,uid:'anotherTeacherUID_123456'}});
        }''')
        self.idle()
        self.assertEqual(self.aliases(), ['Blue Otter 7'])
        self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), '')
        self.page.evaluate('''async () => {
          __releaseMetadata();
          await Promise.resolve();await Promise.resolve();
        }''')
        self.idle()
        self.assertEqual(self.aliases(), ['Blue Otter 7'])
        self.assertEqual(self.page.locator('#classpassClass').input_value(), 'class-new-admin')
        self.assertNotIn('Old Admin Late Alias', self.page.locator('body').inner_text())
        self.assertNotIn('Amber Fox', self.page.locator('body').inner_text())
        self.assertEqual(self.page.get_by_role('alertdialog').count(), 0)
        self.assertIsNone(self.page.evaluate('__ui.getState().confirmation'))
        self.assertEqual(self.calls('reissuePass'), [])
        self.assertEqual(self.calls('deleteProfile'), [])

    def test_explicit_and_external_close_reopen_reset_search_and_page(self):
        self.roster()
        for external in (False, True):
            self.page.locator('#classpassProfileSearch').fill('Amber Fox 2')
            self.page.locator('#classpassRosterNext').click()
            self.assert_page(2, 3)
            if external:
                self.page.evaluate('document.querySelector("#panel").hidden=true')
                self.page.wait_for_function('!__ui.getState().open')
            else:
                self.page.evaluate('__ui.close()')
                self.assertFalse(self.page.evaluate('__ui.getState().open'))
            self.page.evaluate('__ui.open("admin")')
            self.idle()
            self.assertEqual(self.page.locator('#classpassProfileSearch').input_value(), '')
            self.assert_page(1, 12)
            self.assertEqual(self.aliases(), [f'Amber Fox {n}' for n in range(1, 21)])

    def test_roster_controls_fit_narrow_screens_without_loading_extra_rows(self):
        self.roster()
        for size in ({'width':320,'height':740}, {'width':390,'height':844},
                     {'width':844,'height':390}):
            self.page.set_viewport_size(size)
            for selector in ('#panel','.classroom-profile-ui','.classpass-roster',
                             '.classpass-profile-row'):
                for node in self.page.locator(selector).all():
                    self.assertLessEqual(node.evaluate('node=>node.scrollWidth'),
                                         node.evaluate('node=>node.clientWidth') + 2,
                                         f'{selector} at {size}')
            self.assertEqual(self.page.locator('.classpass-profile-row').count(), 20)
            for button in self.page.locator('.classroom-profile-ui button:visible').all():
                self.assertGreaterEqual(button.bounding_box()['height'], 48)
            self.assertGreaterEqual(self.page.locator('#classpassProfileSearch').bounding_box()['height'], 48)
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#classpassProfileSearch').scroll_into_view_if_needed()
        self.page.screenshot(path='/tmp/classroom-roster-mobile.png')


# unittest must not discover the imported fixture's test class a second time.
del BaseUI

if __name__ == '__main__':
    unittest.main(verbosity=2)
