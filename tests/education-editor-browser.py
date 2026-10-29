"""Developer authoring controls edit real bounded content without student data."""
import json
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://cwoodmusic.github.io'
PREFIX = '/coda-arcade/'
URL = ORIGIN + PREFIX + 'education-editor-fixture'
HTML = '''<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="music-notation.css"><link rel="stylesheet" href="education-notation.css"><link rel="stylesheet" href="education-editor.css"><link rel="stylesheet" href="education-visual-editor.css"></head><body><main id="host"></main>
<script src="music-notation.js"></script><script src="time-signature-lesson.js"></script><script src="classroom-quiz.js"></script><script src="classroom-tutorials.js"></script><script src="final-exam-bank.js"></script><script src="education-notation.js"></script><script src="classroom-keyboard.js"></script><script src="education-visual-editor.js"></script><script src="education-content.js"></script><script src="education-editor.js"></script><script>
window.__canEdit=true;window.__exit=0;window.__store=CodaEducationContent.createStore({storage:localStorage,canEdit:()=>__canEdit});CodaEducationContent.setStore(__store);window.__editor=CodaEducationEditor.mount({host:document.querySelector('#host'),store:__store,canEdit:()=>__canEdit,onExit:()=>__exit++});
</script></body></html>'''


class EducationEditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 960}, accept_downloads=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.route(ORIGIN + PREFIX + '**', self.route)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(URL, wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor&&window.__store')

    def route(self, route):
        parsed = urlparse(route.request.url)
        if parsed.path.endswith('/education-editor-fixture'):
            return route.fulfill(content_type='text/html', body=HTML)
        file = (ROOT / unquote(parsed.path).removeprefix(PREFIX)).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():
            return route.fulfill(status=404, body='Missing local resource')
        route.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def field(self, name):
        return self.page.locator('[data-education-field="' + name + '"]')

    def action(self, name):
        return self.page.locator('[data-education-action="' + name + '"]')

    def data(self):
        return self.page.evaluate('__store.getDocument()')

    def test_question_answers_and_plain_text_preview_save_undo_duplicate_delete(self):
        before = self.data()
        selected = self.field('list').input_value()
        literal = '<img src=x onerror="window.attack=true"> Which note is this?'
        self.field('prompt').fill(literal)
        self.page.get_by_label('Answer 1', exact=True).fill('The edited first answer')
        self.page.get_by_label('Answer 2 is correct', exact=True).check()
        self.action('add-answer').click()
        self.page.get_by_label('Answer 4', exact=True).fill('A fourth answer')
        self.action('save').click()
        edited = self.data()
        question = next(item for item in edited['exam']['questions'] if item['id'] == selected)
        self.assertEqual(question['prompt'], literal)
        self.assertEqual(question['correct'], 1)
        self.assertEqual(len(question['answers']), 4)
        self.assertEqual(edited['quizzes'], before['quizzes'])
        self.assertEqual(edited['lessons'], before['lessons'])
        preview = self.page.locator('[data-education-preview]')
        self.assertEqual(preview.locator('img').count(), 0)
        preview.locator('[data-preview-answer="1"]').click()
        self.assertIn('Correct.', preview.inner_text())
        self.assertIsNone(self.page.evaluate('window.attack'))
        self.field('prompt').fill('Keep this unsaved draft when Undo is pressed')
        self.action('undo').click()
        self.assertEqual(self.data(), edited)
        self.assertEqual(self.field('prompt').input_value(), 'Keep this unsaved draft when Undo is pressed')
        self.action('discard').click()
        self.action('undo').click()
        self.assertEqual(self.data(), before)
        self.action('redo').click()
        self.assertEqual(self.data(), edited)
        self.action('duplicate').click()
        self.assertEqual(len(self.data()['exam']['questions']), 801)
        duplicate = self.field('list').input_value()
        self.assertTrue(duplicate.startswith('custom-'))
        self.action('delete').click()
        self.action('cancel').click()
        self.assertEqual(len(self.data()['exam']['questions']), 801)
        self.action('delete').click()
        self.action('confirm').click()
        self.assertEqual(len(self.data()['exam']['questions']), 800)
        self.action('undo').click()
        self.assertTrue(any(item['id'] == duplicate for item in self.data()['exam']['questions']))

    def test_question_drafts_survive_navigation_and_save_reload_export_import(self):
        first = self.field('list').input_value()
        self.field('prompt').fill('An unsaved draft about rhythm')
        second = self.field('list').locator('option').nth(1).get_attribute('value')
        self.field('list').select_option(second)
        self.field('list').select_option(first)
        self.assertEqual(self.field('prompt').input_value(), 'An unsaved draft about rhythm')
        self.assertNotEqual(self.data()['exam']['questions'][0]['prompt'], 'An unsaved draft about rhythm')
        self.action('save').click()
        edited = self.data()
        with self.page.expect_download() as waiting:
            self.action('export').click()
        export = json.loads(Path(waiting.value.path()).read_text())
        self.assertEqual(export, edited)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor')
        self.assertEqual(self.field('prompt').input_value(), 'An unsaved draft about rhythm')
        self.action('reset').click()
        self.action('save').click()
        self.assertNotEqual(self.data(), edited)
        self.field('import-file').set_input_files({'name': 'education.json', 'mimeType': 'application/json', 'buffer': json.dumps(export).encode()})
        self.page.wait_for_function('document.querySelector("[data-education-status]").textContent.includes("Imported")')
        self.assertEqual(self.data(), edited)
        self.field('import-file').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': b'{"version":98}'})
        self.page.wait_for_timeout(50)
        self.assertEqual(self.data(), edited)

    def test_quiz_question_crud_answers_and_lesson_copy(self):
        before = self.data()
        self.field('mode').select_option('quiz')
        self.field('category').select_option('bass-clef')
        self.action('add').click()
        self.field('prompt').fill('What does this clef tell us?')
        self.page.get_by_label('Answer 1', exact=True).fill('Read the bass notes')
        self.page.get_by_label('Answer 2', exact=True).fill('Make it louder')
        self.page.get_by_label('Remove answer 3', exact=True).click()
        self.action('save').click()
        self.assertEqual(len(self.data()['quizzes']['bass-clef']['questions']), 6)
        self.assertEqual(len(self.data()['quizzes']['bass-clef']['questions'][-1]['answers']), 2)
        self.field('mode').select_option('lesson')
        self.field('category').select_option('note-naming')
        self.assertTrue(self.action('add').is_hidden())
        self.field('teach').fill('Start with two black keys. C is just to their left.')
        self.action('save').click()
        self.assertEqual(self.data()['lessons']['note-naming']['steps'][0]['teach'], 'Start with two black keys. C is just to their left.')
        self.assertEqual(self.data()['exam'], before['exam'])
        self.field('category').select_option('dynamics')
        self.action('add-answer').click()
        self.page.get_by_label('Answer 4', exact=True).fill('A new dynamics answer')
        self.page.get_by_label('Answer 4 is correct', exact=True).check()
        self.action('save').click()
        self.assertEqual(self.data()['lessons']['dynamics']['steps'][0]['answer'], 3)
        self.assertEqual(len(self.data()['lessons']['dynamics']['steps'][0]['answers']), 4)

    def test_two_editors_merge_different_questions_and_reject_same_question_conflicts(self):
        root_a = self.page.locator('[data-education-editor]').first
        first = root_a.locator('[data-education-field="list"]').input_value()
        second = root_a.locator('[data-education-field="list"] option').nth(1).get_attribute('value')
        root_a.locator('[data-education-field="prompt"]').fill('Editor A changes the first question')
        self.page.evaluate('''()=>{const host=document.createElement('div');document.body.append(host);window.__editorB=CodaEducationEditor.mount({host,store:__store,canEdit:()=>true});}''')
        root_b = self.page.locator('[data-education-editor]').nth(1)
        root_b.locator('[data-education-field="list"]').select_option(second)
        root_b.locator('[data-education-field="prompt"]').fill('Editor B changes the second question')
        root_b.locator('[data-education-action="save"]').click()
        root_a.locator('[data-education-action="save"]').click()
        questions = {item['id']: item for item in self.data()['exam']['questions']}
        self.assertEqual(questions[first]['prompt'], 'Editor A changes the first question')
        self.assertEqual(questions[second]['prompt'], 'Editor B changes the second question')
        root_a.locator('[data-education-field="prompt"]').fill('An unsaved old edit in editor A')
        self.page.evaluate('__editorB.refresh()')
        root_b.locator('[data-education-field="list"]').select_option(first)
        root_b.locator('[data-education-field="prompt"]').fill('The newer saved version in editor B')
        root_b.locator('[data-education-action="save"]').click()
        root_a.locator('[data-education-action="save"]').click()
        self.assertIn('changed in another editor', root_a.locator('[data-education-status]').inner_text())
        self.assertEqual(root_a.locator('[data-education-field="prompt"]').input_value(), 'An unsaved old edit in editor A')
        root_a.locator('[data-education-action="undo"]').click()
        self.assertIn('paused', root_a.locator('[data-education-status]').inner_text())
        questions = {item['id']: item for item in self.data()['exam']['questions']}
        self.assertEqual(questions[first]['prompt'], 'The newer saved version in editor B')
        self.assertEqual(questions[second]['prompt'], 'Editor B changes the second question')
        root_a.locator('[data-education-action="discard"]').click()
        self.assertEqual(root_a.locator('[data-education-field="prompt"]').input_value(), 'The newer saved version in editor B')

    def test_text_answer_edit_replaces_old_answer_note_picture(self):
        self.field('mode').select_option('quiz')
        self.field('category').select_option('rhythm-tree')
        self.field('list').select_option('four-beat-bar')
        self.assertIn('answerNotes', self.data()['quizzes']['rhythm-tree']['questions'][-1])
        self.page.get_by_label('Answer 1', exact=True).fill('Four quarter notes')
        self.action('save').click()
        question = self.data()['quizzes']['rhythm-tree']['questions'][-1]
        self.assertEqual(question['answers'][0], 'Four quarter notes')
        self.assertNotIn('answerNotes', question, 'Old picture answers must not hide edited answer text')

    def test_notation_mount_fullscreen_escape_mobile_and_edit_permission(self):
        self.page.locator('[data-visual-editor="main"] [data-visual-field="type"]').select_option('notation')
        self.page.locator('[data-visual-editor="main"] [data-notation-action="add"]').click()
        self.assertTrue(self.page.locator('[data-education-preview] svg').is_visible())
        self.action('save').click()
        self.assertEqual(self.data()['exam']['questions'][0]['visual']['kind'], 'notation')
        self.action('expand').click()
        self.assertTrue(self.page.locator('[data-education-editor]').evaluate('node=>node.classList.contains("is-expanded")'))
        self.action('exit').focus()
        self.page.keyboard.press('Tab')
        self.assertTrue(self.page.evaluate('document.querySelector("[data-education-editor]").contains(document.activeElement)'))
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_timeout(50)
        self.assertTrue(self.page.locator('[data-education-editor]').evaluate('node=>node.scrollWidth<=node.clientWidth+1'))
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('[data-education-editor]').evaluate('node=>node.classList.contains("is-expanded")'))
        self.assertEqual(self.page.evaluate('__exit'), 1)
        saved = self.data()
        raw = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        self.page.evaluate('__canEdit=false;__editor.setActive(true)')
        self.assertTrue(self.field('prompt').is_disabled())
        self.page.evaluate('''()=>{const input=document.querySelector('[data-education-field="prompt"]');input.value='forbidden';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-education-action="save"]').click()}''')
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), raw)
        self.page.evaluate('__canEdit=true')
        self.assertEqual(self.data(), saved)


if __name__ == '__main__':
    unittest.main(verbosity=2)
