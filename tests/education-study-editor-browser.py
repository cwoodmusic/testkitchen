"""Teaching-card authoring preserves actual lesson/exam models and safe notation."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('education_study_fixture', Path(__file__).with_name('education-editor-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
CARD = {
    'id': 'tempo-seconds', 'title': 'Seconds and beats',
    'teach': 'At 60 BPM, each beat lasts one second.',
    'example': 'Four beats at 60 BPM take four seconds.',
    'prompt': 'How long do four beats last at 60 BPM?',
    'answers': ['Four seconds', 'Two seconds', 'Eight seconds'], 'correct': 0,
    'hint': 'Count one second for each beat.',
    'visual': {'kind': 'tempo', 'text': 'Metronome', 'bpm': 60},
    'covers': ['tempo-083', 'tempo-086']}


class EducationStudyEditorTests(unittest.TestCase):
    setUpClass = classmethod(fixture.EducationEditorTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.EducationEditorTests.tearDownClass.__func__)
    tearDown = fixture.EducationEditorTests.tearDown
    route = fixture.EducationEditorTests.route
    field = fixture.EducationEditorTests.field
    action = fixture.EducationEditorTests.action
    data = fixture.EducationEditorTests.data

    def setUp(self):
        fixture.EducationEditorTests.setUp(self)
        self.context.add_init_script('''(()=>{const card=''' + json.dumps(CARD) + ''';
          window.CodaExamCurriculum={forLesson:id=>id==='tempo'?[JSON.parse(JSON.stringify(card))]:[]};
        })()''')
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor&&window.__store')

    def study(self):
        self.field('mode').select_option('study')
        self.field('category').select_option('tempo')

    def visual_field(self, name):
        return self.page.locator('[data-visual-editor="main"] [data-visual-field="' + name + '"]')

    def test_edit_teaching_answers_coverage_and_notation_roundtrip_without_changing_core(self):
        before = self.data()
        self.study()
        self.assertEqual(self.field('title').input_value(), CARD['title'])
        self.field('teach').fill('Two beats fit in one second at 120 BPM.')
        self.field('example').fill('Four beats take two seconds at 120 BPM.')
        self.field('prompt').fill('How long do four beats last at 120 BPM?')
        self.field('covers').fill('tempo-084, tempo-087\ntempo-089')
        self.page.get_by_label('Answer 2 is correct', exact=True).check()
        self.visual_field('type').select_option('notation')
        self.page.locator('[data-visual-editor="main"] [data-notation-control="staff"]').select_option('bass')
        self.page.locator('[data-visual-editor="main"] [data-notation-action="add"]').click()
        self.action('save').click()
        saved = self.data()
        card = saved['lessons']['tempo']['study'][0]
        self.assertEqual(card['covers'], ['tempo-084', 'tempo-087', 'tempo-089'])
        self.assertEqual(card['correct'], 1)
        self.assertEqual(card['visual']['score']['clef'], 'bass')
        self.assertEqual(card['visual']['score']['items'][0]['type'], 'note')
        self.assertEqual(saved['exam'], before['exam'])
        self.assertEqual(saved['quizzes'], before['quizzes'])
        self.assertEqual(saved['lessons']['tempo']['steps'], before['lessons']['tempo']['steps'])
        self.assertFalse(self.page.evaluate('__store.isLessonEdited("tempo")'))
        self.assertTrue(self.page.evaluate('__store.isStudyEdited("tempo")'))
        self.assertTrue(self.page.locator('[data-education-preview] .education-score').is_visible())
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor')
        self.study()
        self.assertEqual(self.field('teach').input_value(), card['teach'])
        with self.page.expect_download() as waiting:
            self.action('export').click()
        self.assertEqual(json.loads(Path(waiting.value.path()).read_text()), saved)

    def test_card_crud_and_question_links_remain_visible(self):
        self.field('category').select_option('tempo')
        self.field('list').select_option('tempo-083')
        self.assertIn('Seconds and beats', self.page.locator('[data-education-links]').inner_text())
        self.action('add').click()
        question_id = self.field('list').input_value()
        self.assertIn('needs teaching coverage', self.page.locator('[data-education-links]').inner_text())
        self.study()
        self.action('add').click()
        self.field('title').fill('Teach the new question')
        self.field('covers').fill(question_id)
        self.action('save').click()
        self.assertEqual(len(self.data()['lessons']['tempo']['study']), 2)
        card_id = self.field('list').input_value()
        self.field('mode').select_option('exam')
        self.field('list').select_option(question_id)
        self.assertIn('Teach the new question', self.page.locator('[data-education-links]').inner_text())
        self.study()
        self.field('list').select_option(card_id)
        self.action('duplicate').click()
        self.assertEqual(len(self.data()['lessons']['tempo']['study']), 3)
        self.action('delete').click()
        self.assertIn('material on the exam', self.page.locator('.education-editor-confirm').inner_text())
        self.action('confirm').click()
        self.assertEqual(len(self.data()['lessons']['tempo']['study']), 2)
        self.action('undo').click()
        self.assertEqual(len(self.data()['lessons']['tempo']['study']), 3)

    def test_legacy_import_adds_current_cards_and_readonly_cannot_save_study_edits(self):
        before = self.data()
        legacy = json.loads(json.dumps(before))
        for lesson in legacy['lessons'].values():
            del lesson['study']
        legacy['exam']['questions'][0]['prompt'] = 'An older teacher edit'
        self.field('import-file').set_input_files({'name': 'legacy.json', 'mimeType': 'application/json', 'buffer': json.dumps(legacy).encode()})
        self.page.wait_for_function('document.querySelector("[data-education-status]").textContent.includes("Imported")')
        self.assertEqual(self.data()['lessons']['tempo']['study'], [CARD])
        self.assertEqual(self.data()['exam']['questions'][0]['prompt'], 'An older teacher edit')
        self.study()
        self.field('teach').fill('An unsaved teaching draft')
        saved = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        self.page.evaluate('__canEdit=false;__editor.refresh()')
        self.assertTrue(self.action('save').is_disabled())
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), saved)
        self.assertEqual(self.page.evaluate('__store.saveDocument(__store.getDocument()).ok'), False)

    def test_current_coverage_report_updates_when_teaching_links_are_removed(self):
        for name in ['classroom-curriculum-staff.js', 'classroom-curriculum-rhythm.js',
                     'classroom-curriculum-expression.js', 'classroom-exam-curriculum.js']:
            self.page.add_script_tag(url=fixture.ORIGIN + fixture.PREFIX + name)
        self.study()
        coverage = self.page.locator('[data-education-coverage]')
        self.assertIn('2 / 100', coverage.inner_text())
        self.assertIn('98 questions need a teaching card', coverage.inner_text())
        self.field('covers').fill('')
        self.action('save').click()
        self.assertIn('0 / 100', coverage.inner_text())
        self.assertIn('100 questions need a teaching card', coverage.inner_text())
        self.field('mode').select_option('exam')
        self.field('list').select_option('tempo-083')
        self.assertIn('needs teaching coverage', self.page.locator('[data-education-links]').inner_text())

    def test_accidentals_lesson_is_editable_without_becoming_an_exam_category(self):
        html = fixture.HTML.replace('<script src="education-content.js">',
            '<script src="classroom-accidentals-lesson.js"></script><script src="education-content.js">')
        self.context.route(fixture.URL, lambda route: route.fulfill(content_type='text/html; charset=utf-8', body=html))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaAccidentalsLesson&&window.__editor')
        extra = 'accidentals-key-signatures'
        self.assertEqual(self.field('category').locator('option[value="' + extra + '"]').count(), 0)
        self.field('mode').select_option('lesson')
        self.assertEqual(self.field('category').locator('option[value="' + extra + '"]').count(), 0)
        self.field('mode').select_option('study')
        self.field('category').select_option(extra)
        cards = self.data()['lessons'][extra]['study']
        self.assertGreater(len(cards), 0)
        diagram = next(card for card in cards if card['visual'] and card['visual']['kind'] == 'key-signature')
        self.field('list').select_option(diagram['id'])
        self.field('signature').select_option('G')
        self.action('signature-add-note').click()
        items = self.page.evaluate('__editor.getState().draft.visual.items')
        last = len(items) - 1
        self.field('signature-note-' + str(last) + '-position').fill('1')
        self.field('signature-note-' + str(last) + '-accidental').select_option('natural')
        self.action('signature-add-bar').click()
        self.action('save').click()
        saved = next(card for card in self.data()['lessons'][extra]['study'] if card['id'] == diagram['id'])
        self.assertEqual(saved['visual']['signature'], 'G')
        self.assertEqual(saved['visual']['items'][last], {'type': 'note', 'position': 1, 'accidental': 'natural'})
        self.assertEqual(saved['visual']['items'][-1], {'type': 'bar'})
        self.assertTrue(self.page.locator('[data-education-preview] svg').is_visible())
        self.field('mode').select_option('quiz')
        self.field('category').select_option(extra)
        self.assertEqual(len(self.data()['quizzes'][extra]['questions']), 5)
        self.action('add').click()
        self.page.get_by_label('Remove answer 3', exact=True).click()
        self.action('save').click()
        self.assertEqual(len(self.data()['quizzes'][extra]['questions']), 6)
        self.assertTrue(self.page.evaluate('__store.getQuiz("' + extra + '").custom'))
        self.assertEqual(len(self.data()['exam']['questions']), 800)
        self.field('mode').select_option('exam')
        self.assertEqual(self.field('category').locator('option[value="' + extra + '"]').count(), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
