"""The developer can edit and preview foundations in the actual category paths."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('learning_paths_editor_fixture', Path(__file__).with_name('education-editor-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

SCRIPTS = ['classroom-curriculum-staff.js', 'classroom-curriculum-rhythm.js',
           'classroom-curriculum-expression.js', 'classroom-exam-curriculum.js',
           'classroom-exam-study.js', 'classroom-accidentals-lesson.js',
           'classroom-learning-paths-data.js', 'classroom-learning-paths.js']
HTML = fixture.HTML.replace('<script src="education-content.js">',
    ''.join('<script src="' + name + '"></script>' for name in SCRIPTS) + '<script src="education-content.js">')


class EducationLearningPathsTests(unittest.TestCase):
    setUpClass = classmethod(fixture.EducationEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.EducationEditorTests.tearDownClass.__func__)
    tearDown = fixture.EducationEditorTests.tearDown
    field = fixture.EducationEditorTests.field
    action = fixture.EducationEditorTests.action
    data = fixture.EducationEditorTests.data

    def route(self, route):
        if route.request.url == fixture.URL:
            return route.fulfill(content_type='text/html; charset=utf-8', body=HTML)
        return fixture.EducationEditorTests.route(self, route)

    def setUp(self):
        fixture.EducationEditorTests.setUp(self)
        self.page.wait_for_function('window.CodaClassroomLearningPaths&&window.CodaClassroomLearningPathsData')
        self.field('mode').select_option('study')

    def choose_diagram(self, category, kind):
        self.field('category').select_option(category)
        card = next(item for item in self.data()['lessons'][category]['study'] if (item.get('visual') or {}).get('kind') == kind)
        self.field('list').select_option(card['id'])
        return card

    def visual_field(self, name):
        return self.page.locator('[data-visual-editor="main"] [data-visual-field="' + name + '"]')

    def test_note_parts_have_safe_editable_controls_and_actual_diagram_preview(self):
        before = self.data()
        card = self.choose_diagram('rhythm-tree', 'note-parts')
        self.assertIn('Basics', self.page.locator('[data-education-lesson-section]').inner_text())
        self.field('teach').fill('Find the round notehead before looking at the stem.')
        self.visual_field('note-part-focus').select_option('head')
        self.visual_field('note-part-length').select_option('1')
        self.action('save').click()
        saved = self.data()
        changed = next(item for item in saved['lessons']['rhythm-tree']['study'] if item['id'] == card['id'])
        self.assertEqual(changed['visual'], {'kind': 'note-parts', 'focus': 'head', 'beats': 1})
        self.assertTrue(self.page.locator('[data-education-preview] svg').first.is_visible())
        self.assertEqual(saved['exam'], before['exam'])
        self.assertEqual(saved['quizzes'], before['quizzes'])
        self.assertFalse(self.page.evaluate('__store.isLessonEdited("rhythm-tree")'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor')
        self.field('mode').select_option('study')
        self.field('category').select_option('rhythm-tree')
        self.field('list').select_option(card['id'])
        self.assertEqual(self.visual_field('note-part-focus').input_value(), 'head')

    def test_clef_foundations_and_tree_diagrams_are_previewed_without_replacing_their_model(self):
        card = self.choose_diagram('bass-clef', 'clef-intro')
        self.visual_field('clef-page').select_option('clef')
        self.visual_field('clef').select_option('bass')
        self.action('save').click()
        saved = next(item for item in self.data()['lessons']['bass-clef']['study'] if item['id'] == card['id'])
        self.assertEqual(saved['visual'], {'kind': 'clef-intro', 'clef': 'bass', 'page': 'clef'})
        self.assertTrue(self.page.locator('[data-education-preview] svg').first.is_visible())
        tree = self.choose_diagram('rhythm-tree', 'rhythm-tree')
        self.visual_field('tree-level').select_option('2')
        self.action('save').click()
        saved_tree = next(item for item in self.data()['lessons']['rhythm-tree']['study'] if item['id'] == tree['id'])
        self.assertEqual(saved_tree['visual'], {'kind': 'rhythm-tree', 'level': 2})
        self.assertTrue(self.page.locator('[data-education-preview] svg').first.is_visible())

    def test_new_cards_can_get_piano_visuals_and_readonly_blocks_changes(self):
        self.field('category').select_option('rhythm-tree')
        self.action('add').click()
        self.field('title').fill('My piano-key lesson')
        self.visual_field('type').select_option('keyboard')
        self.page.locator('[data-visual-editor="main"] [data-visual-key="C-sharp"]').click()
        self.action('save').click()
        self.assertIn('Advanced', self.page.locator('[data-education-lesson-section]').inner_text())
        card_id = self.field('list').input_value()
        card = next(item for item in self.data()['lessons']['rhythm-tree']['study'] if item['id'] == card_id)
        self.assertEqual(card['visual'], {'kind': 'keyboard', 'notes': ['C-sharp']})
        self.assertTrue(self.page.locator('[data-education-preview] .lesson-piano-keyboard').is_visible())
        self.choose_diagram('note-naming', 'keyboard')
        saved = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        self.page.evaluate('__canEdit=false;__editor.refresh()')
        self.assertTrue(self.visual_field('type').is_disabled())
        self.assertTrue(self.page.locator('[data-visual-editor="main"] [data-visual-key="C-sharp"]').is_disabled())
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), saved)

    def test_keyboard_images_and_added_visuals_keep_drafts_and_obey_editing_permission(self):
        self.field('category').select_option('note-naming')
        self.field('list').select_option('treble-keyboard-landmarks')
        keyboard = self.page.locator('[data-visual-editor="main"]')
        keyboard.locator('[data-visual-key="F-sharp"]').click()
        keyboard.locator('[data-visual-field="keyboard-spelling"]').select_option('flat')
        keyboard.locator('[data-visual-field="keyboard-label"]').fill('A keyboard I can edit')
        self.action('add-visual').click()
        extra = self.page.locator('[data-visual-editor="extra-0"]')
        extra.locator('[data-visual-field="type"]').select_option('clef')
        extra.locator('[data-visual-field="clef"]').select_option('bass')
        self.field('list').select_option('treble-musical-alphabet')
        self.field('list').select_option('treble-keyboard-landmarks')
        self.assertEqual(keyboard.locator('[data-visual-field="keyboard-label"]').input_value(), 'A keyboard I can edit')
        self.assertEqual(extra.locator('[data-visual-field="type"]').input_value(), 'clef')
        self.action('save').click()
        card = next(item for item in self.data()['lessons']['note-naming']['study'] if item['id'] == 'treble-keyboard-landmarks')
        self.assertEqual(card['visual']['notes'], ['G-flat'])
        self.assertEqual(card['visuals'][0]['clef'], 'bass')
        saved = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        self.page.evaluate('''()=>{
          window.__oldKeyboardType=document.querySelector('[data-visual-editor="main"] [data-visual-field="type"]');
          window.__oldKeyboardHighlight=document.querySelector('[data-visual-editor="main"] [data-visual-key="C"]');
          window.__canEdit=false;__editor.refresh();
        }''')
        self.assertTrue(keyboard.locator('[data-visual-field="type"]').is_disabled())
        self.assertTrue(keyboard.locator('[data-visual-key="C"]').is_disabled())
        self.assertTrue(self.action('add-visual').is_disabled())
        self.page.evaluate('''()=>{
          __oldKeyboardType.value='notation';__oldKeyboardType.dispatchEvent(new Event('change'));
          __oldKeyboardHighlight.click();
        }''')
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), saved)
        self.assertEqual(self.page.evaluate('__editor.getState().draft.visual.kind'), 'keyboard')


if __name__ == '__main__':
    unittest.main(verbosity=2)
