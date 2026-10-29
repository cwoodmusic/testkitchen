"""Build real four-count rhythm bars, including every duration and mobile layout."""
import functools
import importlib.util
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest

sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright
from classroom_quiz_helpers import answer_quiz

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    'rhythm_classroom_fixture', ROOT / 'tests/classroom-tutorials-browser.py')
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class RhythmBarTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(fixture.Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.errors = []
        self.failures = []
        self.url = f'http://127.0.0.1:{self.server.server_port}/lesson-fixture'
        self.create_context()
        self.load()

    def create_context(self, viewport=None, touch=False):
        self.context = self.browser.new_context(
            viewport=viewport or {'width': 1250, 'height': 1000},
            is_mobile=touch, has_touch=touch)
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and not response.url.endswith('favicon.ico') else None)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])

    def load(self):
        self.page.goto(self.url)
        self.page.locator('#enter').click()
        self.page.wait_for_function('roomUI.getState().open')

    def state(self):
        return self.page.evaluate('roomUI.getState().tutorials')

    def open_rhythm(self):
        if self.page.locator('#classroomAllLessons').is_visible():
            self.page.locator('#classroomAllLessons').click()
        if not self.page.locator('#classroomStart').is_visible():
            self.page.evaluate("roomUI.selectTopic('welcome',true)")
        self.page.locator('[data-start-lesson="rhythm-tree"]').click()

    def try_step(self):
        self.page.locator('[data-lesson-try]').click()

    def reach_builder(self):
        """Walk through the teaching activities rather than bypassing answers."""
        for _ in range(4):
            self.page.locator('[data-tree-split]').click()
        self.page.locator('[data-tutorial-next]').click()
        for _ in range(2):
            self.try_step()
            self.page.locator('[data-rhythm-answer="2"]').click()
            self.page.locator('[data-tutorial-next]').click()
        self.assertEqual(self.state()['active']['step'], 3)
        self.try_step()

    def saved_builder(self):
        """A version-one save at Step4 must reopen as the same flexible task."""
        self.page.evaluate("""localStorage.setItem('codaClassroomLessonsV1',JSON.stringify({
            version:1,lessons:{'rhythm-tree':{step:3,completed:false,completedAt:0}}}));""")
        self.load()
        self.open_rhythm()
        self.assertEqual(self.state()['active']['step'], 3)
        self.try_step()

    def add(self, units, touch=False):
        button = self.page.locator(f'[data-add-value="{units}"]')
        button.tap() if touch else button.click()

    def bar(self):
        return self.state()['active']['bar']

    def test_all_five_note_choices_are_immediately_available(self):
        self.open_rhythm()
        self.reach_builder()
        self.assertEqual(self.page.locator('[data-add-value]').count(), 5)
        for units in [16, 8, 4, 2, 1]:
            button = self.page.locator(f'[data-add-value="{units}"]')
            self.assertTrue(button.is_visible())
            self.assertFalse(button.is_disabled())
            self.assertFalse(button.evaluate('node=>!!node.closest("details")'))
        self.assertEqual(self.page.get_by_text('More choices', exact=True).count(), 0)
        self.assertRegex(self.page.locator('.lesson-instruction').inner_text().lower(),
                         r'(four|4).*(count|beat)|(count|beat).*(four|4)')
        self.assertEqual(self.page.evaluate('rewards'), [])

    def test_any_available_note_lengths_that_make_four_counts_pass(self):
        rhythms = [[16], [8, 8], [4] * 4, [2] * 8, [1] * 16,
                   [8, 4, 2, 1, 1], [4, 2, 2, 8]]
        for notes in rhythms:
            with self.subTest(notes=notes):
                self.saved_builder()
                for units in notes:
                    self.add(units)
                self.assertEqual(self.bar(), notes)
                self.page.locator('[data-check-rhythm]').click()
                active = self.state()['active']
                self.assertTrue(active['answered'])
                self.assertFalse(active['complete'])
                self.assertFalse(self.page.locator('[data-tutorial-next]').is_disabled())
                self.assertEqual(self.page.locator('.tutorial-feedback').get_attribute('data-correct'), 'true')
                self.assertEqual(self.page.evaluate('rewards'), [])

    def test_overfill_is_rejected_and_undo_and_clear_allow_a_new_answer(self):
        self.saved_builder()
        self.add(8)
        too_long = self.page.locator('[data-add-value="16"]')
        if too_long.is_disabled():
            # A disabled overfill choice must also ignore a native DOM click.
            too_long.evaluate('button=>button.click()')
        else:
            too_long.click()
        self.assertEqual(self.bar(), [8])
        self.assertFalse(self.state()['active']['answered'])
        if self.page.locator('[data-check-rhythm]').count():
            check = self.page.locator('[data-check-rhythm]')
            if not check.is_disabled():
                check.click()
            self.assertFalse(self.state()['active']['answered'])
        self.add(4)
        self.page.locator('[data-rhythm-undo]').click()
        self.assertEqual(self.bar(), [8])
        self.page.locator('[data-rhythm-clear]').click()
        self.assertEqual(self.bar(), [])
        for _ in range(4):
            self.add(4)
        self.page.locator('[data-check-rhythm]').click()
        self.assertTrue(self.state()['active']['answered'])

    def test_real_lesson_quiz_grants_fifty_xp_once_and_survives_reload(self):
        self.open_rhythm()
        self.reach_builder()
        for _ in range(4):
            self.add(4)
        self.page.locator('[data-check-rhythm]').click()
        self.assertEqual(self.page.evaluate('rewards'), [])
        self.page.locator('[data-tutorial-next]').click()
        self.assertEqual(self.state()['active']['phase'], 'quiz')
        answer_quiz(self.page, 'rhythm-tree')
        self.assertIn('rhythm-tree', self.state()['completed'])
        self.assertEqual(self.page.evaluate('rewards'), [{'id': 'rhythm-tree', 'amount': 50}])
        self.page.locator('[data-tutorial-replay]').click()
        self.reach_builder()
        self.add(16)
        self.page.locator('[data-check-rhythm]').click()
        self.page.locator('[data-tutorial-next]').click()
        answer_quiz(self.page, 'rhythm-tree')
        self.assertEqual(len(self.page.evaluate('rewards')), 1)
        self.load()
        self.open_rhythm()
        self.assertTrue(self.state()['active']['complete'])
        self.assertEqual(self.page.evaluate('rewards'), [])

    def test_phone_and_landscape_show_all_choices_and_sixteen_notes_without_overflow(self):
        for width, height in [(390, 844), (844, 390)]:
            with self.subTest(viewport=f'{width}x{height}'):
                self.context.close()
                self.create_context({'width': width, 'height': height}, touch=True)
                self.load()
                self.saved_builder()
                self.assertEqual(self.page.locator('[data-add-value]:visible').count(), 5)
                for units in [16, 8, 4, 2, 1]:
                    size = self.page.locator(f'[data-add-value="{units}"]').bounding_box()
                    self.assertGreaterEqual(size['height'], 48)
                    self.assertGreaterEqual(size['width'], 44)
                palette_top = self.page.locator('.lesson-all-values').evaluate('node=>node.offsetTop')
                for _ in range(16):
                    self.add(1, touch=True)
                    self.assertEqual(self.page.locator('.lesson-all-values').evaluate('node=>node.offsetTop'), palette_top,
                                     'Adding wrapped notation must not shift the note choices')
                scroll = self.page.evaluate("""()=>{
                    const books=document.querySelector('.classroom-books');books.scrollTop=120;
                    const before=books.scrollTop;document.querySelector('[data-rhythm-undo]').click();
                    return {before,after:books.scrollTop};
                }""")
                self.assertGreater(scroll['before'], 0)
                self.assertEqual(scroll['after'], scroll['before'], 'Editing a long bar must not jump back to the lesson heading')
                self.add(1, touch=True)
                geometry = self.page.locator('.lesson-pattern').evaluate("""bar=>{
                    const bounds=bar.getBoundingClientRect();
                    return {width:bar.clientWidth,scroll:bar.scrollWidth,left:bounds.left,right:bounds.right,
                      notes:[...bar.querySelectorAll('[data-pattern-index]')].map(note=>{
                        const r=note.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width};})};
                }""")
                self.assertEqual(len(geometry['notes']), 16)
                self.assertLessEqual(geometry['scroll'], geometry['width'] + 2)
                for note in geometry['notes']:
                    self.assertGreaterEqual(note['left'], geometry['left'] - 1)
                    self.assertLessEqual(note['right'], geometry['right'] + 1)
                    self.assertGreaterEqual(note['width'], 44)
                self.assertFalse(self.page.locator('#room').evaluate('room=>room.scrollWidth>innerWidth'))
                self.page.screenshot(path=f'/tmp/rhythm-bar-{width}.png', full_page=True)
                self.page.locator('[data-check-rhythm]').tap()
                self.assertTrue(self.state()['active']['answered'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
