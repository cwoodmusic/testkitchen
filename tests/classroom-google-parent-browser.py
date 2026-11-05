"""Real teacher tools retain Google import cards through parent rerenders.

The existing profile UI fixture uses a disposable in-memory service. This
suite never opens Google OAuth, Firebase, a real roster, or a real printer.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('google_parent_profile_fixture',
    Path(__file__).with_name('classroom-profile-ui-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
base = fixture.ClassroomProfileUITests
component_spec = importlib.util.spec_from_file_location('google_parent_component_fixture',
    Path(__file__).with_name('classroom-google-import-browser.py'))
component_fixture = importlib.util.module_from_spec(component_spec)
component_spec.loader.exec_module(component_fixture)


class GoogleClassroomParentUITests(unittest.TestCase):
    setUpClass = classmethod(base.setUpClass.__func__)
    tearDownClass = classmethod(base.tearDownClass.__func__)
    tearDown = base.tearDown
    admin = base.admin
    calls = base.calls

    def setUp(self):
        fixture.ClassroomProfileUITests.setUp(self)
        self.page.add_style_tag(path=str(fixture.ROOT/'classroom-google-import.css'))
        self.page.add_script_tag(path=str(fixture.ROOT/'classroom-google-import.js'))
        self.page.evaluate('''()=>{
          const module=CodaClassroomGoogleImport;
          window.CodaClassroomGoogleImport={...module,create:options=>{
            window.__import=module.create(options);return window.__import;
          }};
          window.__googleStudents=[{userId:'student-1',name:'Alice Example'},{userId:'student-2',name:'Ben Example'}];
          window.__holdImport=false;window.__googleLinks={};
          Object.assign(__service,{
            async connectGoogleClassroom(){__record('connectGoogleClassroom');return {ok:true};},
            async listGoogleClassroomCourses(){__record('listGoogleClassroomCourses');return {ok:true,courses:[{id:'course-1',name:'Music 3',section:'Room 14'}]};},
            async loadGoogleClassroomRoster(courseId){__record('loadGoogleClassroomRoster',courseId);return {ok:true,courseId,students:__googleStudents};},
            async previewRosterImport(value){
              __record('previewRosterImport',value);return {ok:true,courseId:value.courseId,classId:value.classId||'class-imported',label:__classes.find(item=>item.classId===value.classId)?.label||'',newClass:!value.classId,
                profiles:__profiles[value.classId]||[],students:__googleStudents.map(student=>({userId:student.userId,status:__googleLinks[student.userId]?'existing':'unlinked',...(__googleLinks[student.userId]||{})}))};
            },
            async importRoster(value){
              __record('importRoster',value);
              if(__holdImport)await new Promise(resolve=>window.__releaseImport=resolve);
              const classId=value.classId||'class-imported',label=value.label||'Blue class';
              if(!__classes.some(item=>item.classId===classId)){__classes.push({classId,label});__profiles[classId]=[];}
              const cards=value.choices.filter(choice=>choice.action==='create').map(choice=>{
                const receipt=__receipt('profile-imported-'+choice.userId);
                __profiles[classId].push({profileId:receipt.profileId,alias:receipt.alias,picture:receipt.picture});
                __googleLinks[choice.userId]={profileId:receipt.profileId,alias:receipt.alias,picture:receipt.picture};
                return {...receipt,userId:choice.userId,name:__googleStudents.find(student=>student.userId===choice.userId).name};
              });
              return {ok:true,classId,label,cards,created:cards.length,linked:0,existing:__googleStudents.filter(student=>__googleLinks[student.userId]&&!cards.some(card=>card.userId===student.userId)).length,skipped:value.choices.filter(choice=>choice.action==='skip').length};
            },
            async logOut(){__record('logOut');__emit({profile:null,admin:{signedIn:false,authorized:false,uid:null}});return {ok:true};},
            disconnectGoogleClassroom(){__record('disconnectGoogleClassroom');}
          });
        }''')

    def idle(self):
        self.page.wait_for_function('!__ui.getState().busy&&(!window.__import||!__import.getState().busy)')

    def preview(self):
        self.admin()
        self.page.locator('#googleRosterOpen').click()
        self.page.locator('#googleRosterConnect').click(); self.idle()
        self.page.locator('#googleRosterCourse').select_option('course-1')
        self.page.locator('#googleRosterPreview').click(); self.idle()

    def import_cards(self):
        self.preview()
        self.page.locator('#googleRosterImport').click(); self.idle()

    def test_import_launcher_is_available_for_teachers_even_without_an_arcade_class(self):
        self.page.evaluate('__classes=[];__profiles={}')
        self.assertEqual(self.page.locator('#googleRosterOpen').count(), 0)
        self.admin()
        self.assertTrue(self.page.locator('#googleRosterOpen').is_visible())
        self.assertEqual(self.calls('connectGoogleClassroom'), [])
        self.page.locator('#googleRosterOpen').click()
        self.assertTrue(self.page.locator('#googleRosterConnect').is_visible())
        self.assertEqual(self.page.locator('#classpassCreateClass').count(), 0,
                         'The focused importer hides unrelated teacher actions')
        self.page.locator('#googleRosterClose').click()
        self.assertTrue(self.page.locator('#classpassCreateClass').is_visible())

    def test_import_result_and_cards_survive_parent_refresh_with_the_new_class_selected(self):
        self.import_cards()
        self.assertEqual(self.page.evaluate('__ui.getState().classId'), 'class-imported')
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertTrue(self.page.locator('#googleRosterPrintCards').is_visible())
        self.assertEqual(self.page.locator('#classpassCreateClass,#classpassCreateProfile,#classpassDeleteClass').count(), 0)
        self.page.evaluate("window.__retainedImport=__import;__emit({status:'ready again'})")
        self.idle()
        self.assertTrue(self.page.evaluate('__retainedImport===__import'))
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.assertTrue(self.page.locator('#googleRosterPrintCards').is_visible())
        self.page.locator('#googleRosterCardsSaved').check()
        self.page.locator('#googleRosterDone').click(); self.idle()
        self.assertEqual(self.page.locator('#classpassClass').input_value(), 'class-imported')
        self.assertEqual(self.page.locator('.classpass-profile-row').count(), 2)

    def test_parent_close_and_escape_keep_pending_import_and_unsaved_cards(self):
        self.preview(); self.page.evaluate('__holdImport=true')
        self.page.locator('#googleRosterImport').click()
        self.page.wait_for_function('typeof __releaseImport==="function"')
        self.assertFalse(self.page.evaluate('__ui.requestClose()'))
        self.assertFalse(self.page.evaluate('__ui.close()'))
        self.page.locator('#classpassLogOut').click()
        self.assertEqual(self.calls('logOut'), [])
        self.assertTrue(self.page.evaluate('__ui.handleEscape()'))
        self.assertTrue(self.page.evaluate('__ui.getState().open&&__import.getState().open'))
        self.page.evaluate('__releaseImport()'); self.idle()
        self.assertFalse(self.page.evaluate('__ui.requestClose()'))
        self.assertTrue(self.page.get_by_role('alertdialog').is_visible())
        self.assertTrue(self.page.evaluate('__ui.getState().open'))
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 2)
        self.page.locator('#googleRosterKeepCards').click()
        self.page.locator('#classpassLogOut').click()
        self.assertEqual(self.calls('logOut'), [])
        self.assertTrue(self.page.evaluate('__state.admin.signedIn'))
        self.assertTrue(self.page.get_by_role('alertdialog').is_visible())
        self.page.locator('#googleRosterKeepCards').click()
        self.assertTrue(self.page.evaluate('__ui.handleEscape()'))
        self.assertTrue(self.page.get_by_role('alertdialog').is_visible())
        self.page.locator('#googleRosterKeepCards').click()
        self.page.locator('#googleRosterCardsSaved').check()
        self.assertTrue(self.page.evaluate('__ui.requestClose()'))
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.page.locator('#classpassLogOut').click(); self.idle()
        self.assertEqual(len(self.calls('logOut')), 1)
        self.assertFalse(self.page.evaluate('__state.admin.signedIn'))
        self.assertTrue(self.page.evaluate('__ui.close()'))
        self.assertFalse(self.page.evaluate('__ui.getState().open'))

    def test_owner_revocation_clears_print_sheet_names_and_card_passes(self):
        self.import_cards()
        self.page.evaluate('window.print=()=>{}')
        self.page.locator('#googleRosterPrintCards').click()
        self.assertEqual(self.page.locator('.classroom-google-print-sheet .google-import-card').count(), 2)
        self.assertIn('PRIVATE-PASS', self.page.locator('.classroom-google-print-sheet').inner_text())
        self.page.evaluate('__emit({admin:{signedIn:false,authorized:false,uid:null}})')
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 0)
        self.assertEqual(self.page.locator('.classroom-google-print-sheet').count(), 0)
        self.assertNotIn('PRIVATE-PASS', self.page.locator('body').inner_text())
        self.assertNotIn('Alice Example', self.page.locator('body').inner_text())
        self.assertEqual(self.page.locator('#googleRosterOpen,#googleRosterConnect').count(), 0)

    def test_private_posts_and_append_keep_parent_cards_and_current_class(self):
        self.page.evaluate(component_fixture.PUBLISHING_FIXTURE)
        self.import_cards()
        self.assertEqual(self.page.evaluate('__publishCalls.length'), 0, 'Importing profiles must not request posting permission')
        self.page.locator('#googleRosterPreparePosts').click(); self.idle()
        self.assertEqual(self.page.evaluate('__posts.length'), 0, 'Preparing a delivery plan must not publish')
        self.page.locator('#googleRosterPublishPosts').click(); self.idle()
        self.assertEqual(self.page.evaluate('__posts.length'), 2)
        self.assertTrue(self.page.locator('#googleRosterCardsSaved').is_checked())
        self.page.evaluate("__googleStudents.push({userId:'student-3',name:'Claire Example'})")
        self.page.locator('#googleRosterRefresh').click(); self.idle()
        self.assertEqual(self.page.locator('#googleRosterTarget').input_value(), 'class-imported')
        self.assertEqual(self.page.locator('#googleRosterChoice-0,#googleRosterChoice-1').count(), 0)
        self.assertEqual(self.page.locator('#googleRosterChoice-2').input_value(), 'create')
        self.page.locator('#googleRosterImport').click(); self.idle()
        self.assertEqual(self.page.evaluate('__ui.getState().classId'), 'class-imported')
        self.assertEqual(self.page.evaluate('__import.getState().cardCount'), 1)
        self.page.locator('#googleRosterPreparePosts').click(); self.idle()
        self.assertEqual(self.page.evaluate("__publishCalls.filter(item=>item.method==='preview').at(-1).value.cards.map(card=>card.userId)"), ['student-3'])
        self.page.locator('#googleRosterPublishPosts').click(); self.idle()
        self.assertEqual(self.page.evaluate('__posts.map(post=>post.userId)'), ['student-1','student-2','student-3'])
        self.assertEqual(self.page.evaluate("__profiles['class-imported'].length"), 3)

    def test_parent_close_and_logout_are_blocked_during_pending_publish(self):
        self.page.evaluate(component_fixture.PUBLISHING_FIXTURE)
        self.import_cards(); self.page.locator('#googleRosterCardsSaved').check()
        self.page.locator('#googleRosterPreparePosts').click(); self.idle()
        self.page.evaluate("__publishHold='publish'")
        self.page.locator('#googleRosterPublishPosts').click()
        self.page.wait_for_function('typeof __releasePublishing==="function"')
        self.assertFalse(self.page.evaluate('__ui.requestClose()'))
        self.assertFalse(self.page.evaluate('__ui.close()'))
        self.page.locator('#classpassLogOut').click()
        self.assertEqual(self.calls('logOut'), [])
        self.assertTrue(self.page.evaluate('__ui.handleEscape()'))
        self.assertTrue(self.page.evaluate('__ui.getState().open&&__import.getState().open'))
        self.page.evaluate('__releasePublishing()'); self.idle()
        self.assertTrue(self.page.evaluate('__ui.requestClose()'))


del base

if __name__ == '__main__':
    unittest.main(verbosity=2)
