"""Use the classroom's short category lessons through the assembled game.

The classroom, curriculum, grading, local profile scope and developer editor
remain production code. Requests outside the checkout are blocked; no live
student accounts or records are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

from world_navigation_helpers import enter_room

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'learning_paths_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class ClassroomLearningPathsWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('''window.CodaClassroomLearningPaths
          &&window.CodaClassroomLearningPathsData
          &&window.CodaEducationContent?.getStore().getState().loaded''')

    def path_state(self):
        return self.page.evaluate('CodaArcadeQA.classroom().learningPath')

    def category(self, lesson):
        return self.page.evaluate('''id=>CodaClassroomLearningPathsData.getCategory(
          id,{content:CodaEducationContent})''', lesson)

    def xp(self):
        return self.page.evaluate('CodaArcadeQA.progression().xp')

    def talk_to_haydn(self):
        if not self.page.evaluate('CodaArcadeQA.classroom().open'):
            enter_room(self.page, 'classroom')
        if self.page.locator('#classroomAllLessons').is_visible():
            self.page.locator('#classroomAllLessons').click()
            return
        if self.page.locator('#classroomStart').is_visible():
            return
        self.page.locator('#classroomCanvas').focus()
        self.page.keyboard.down('w')
        self.page.wait_for_timeout(850)
        self.page.keyboard.up('w')
        self.page.keyboard.press('e')
        self.page.wait_for_function('!document.querySelector("#classroomStart").hidden')

    def open_category(self, lesson):
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="' + lesson + '"]').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().learningPath!==null')
        self.assertEqual(self.path_state()['id'], lesson)

    def finish_section(self, lesson, section_id, wrong=False):
        category = self.category(lesson)
        section = next(item for item in category['sections'] if item['id'] == section_id)
        self.page.locator('[data-path-section="' + section_id + '"]').click()
        for card in section['cards']:
            panel = self.page.locator('.classroom-exam-study')
            self.assertEqual(panel.get_attribute('data-study-stage'), 'look')
            self.assertEqual(panel.locator('[data-study-answer]').count(), 0,
                             'A child sees the explanation before answering')
            self.assertEqual(panel.locator('.exam-study-title').inner_text(), card['title'])
            self.assertIn(card['teach'], panel.inner_text())
            self.assertIn(card['example'], panel.inner_text())
            self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)
            panel.locator('[data-study-try]').click()
            checks=self.page.evaluate('({lesson,card})=>CodaClassroomLearningPathsData.getChecks(lesson,card)',{'lesson':lesson,'card':card})
            for index,check in enumerate(checks):
                if len(checks)>1:
                    self.assertEqual(panel.locator('[data-study-check]').inner_text(),'Check '+str(index+1)+' of '+str(len(checks)))
                if wrong:
                    panel.locator('[data-study-answer="' + str((check['correct'] + 1) % len(check['answers'])) + '"]').click()
                    self.assertEqual(panel.locator('[data-study-next]').count(), 0)
                    self.assertIn(check['hint'], panel.inner_text())
                panel.locator('[data-study-answer="' + str(check['correct']) + '"]').click()
                panel.locator('[data-study-next]').click()
        self.assertEqual(self.path_state()['phase'], 'menu')
        self.assertTrue(next(item for item in self.path_state()['sections']
                             if item['id'] == section_id)['completed'])

    def finish_basics_quiz(self, lesson):
        self.page.locator('[data-path-quiz="basic"]').click()
        questions = self.category(lesson)['basicsQuiz']['questions']
        while self.path_state()['quiz']['phase']=='question':
            state=self.path_state()['quiz']
            question=state.get('question') or questions[state['index']]
            self.assertEqual(self.page.locator('.classroom-quiz-question').inner_text(), question['prompt'])
            self.page.locator('[data-quiz-answer="' + str(question['correct']) + '"]').click()
            self.page.locator('[data-quiz-next]').click()
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.path_state()['phase'], 'menu')
        self.assertGreater(self.path_state()['basicsPassedAt'], 0)

    def test_all_nine_categories_open_short_ordered_lessons_without_awarding_or_starting_a_quiz(self):
        original = self.page.evaluate('''()=>Object.fromEntries(Object.values(
          CodaClassroomProfileData.KEYS).map(key=>[key,localStorage.getItem(key)]))''')
        categories = self.page.evaluate('CodaClassroomLearningPathsData.CATEGORIES')
        self.assertEqual(len(categories), 9)
        for category in categories:
            with self.subTest(category=category['id']):
                self.open_category(category['id'])
                state = self.path_state()
                self.assertEqual(state['phase'], 'menu')
                self.assertTrue(state['sections'][0]['available'])
                self.assertFalse(any(section['available'] for section in state['sections'][1:]))
                self.assertTrue(self.page.locator('[data-path-tier="basic"]').is_visible())
                self.assertTrue(self.page.locator('[data-path-tier="advanced"]').is_visible())
                self.assertTrue(self.page.locator('[data-path-quiz="basic"]').is_disabled())
                self.assertTrue(self.page.locator('[data-path-quiz="full"]').is_disabled())
                self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)
                self.assertEqual(self.xp(), 0)
        after = self.page.evaluate('''()=>Object.fromEntries(Object.values(
          CodaClassroomProfileData.KEYS).map(key=>[key,localStorage.getItem(key)]))''')
        self.assertEqual(after, original, 'Opening categories never writes completion or quiz proofs')

    def test_bass_staff_and_clef_are_explained_before_mnemonics_and_note_naming(self):
        self.open_category('bass-clef')
        category = self.category('bass-clef')
        first = category['sections'][0]
        self.assertEqual(first['id'], 'staff-and-clef')
        self.page.locator('[data-path-section="staff-and-clef"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertIn('five lines', panel.inner_text())
        self.assertEqual(panel.locator('[data-study-answer]').count(), 0)
        self.assertIn('staff', panel.locator('svg').get_attribute('aria-label').lower())
        self.page.locator('[data-path-menu]').click()
        self.finish_section('bass-clef', 'staff-and-clef', wrong=True)
        self.page.locator('[data-path-section="bass-reminders"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertIn('Great Big Dreams For America', panel.inner_text())
        self.assertIn('bottom to top', panel.locator('svg').get_attribute('aria-label').lower())
        self.assertEqual(panel.locator('svg ellipse').count(), 5)
        self.assertEqual(panel.locator('[data-study-answer]').count(), 0)
        self.assertEqual(self.xp(), 0)

    def test_pitch_keyboard_teaching_and_key_location_checks_show_a_real_keyboard_on_phones(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open_category('note-naming')
        section = self.category('note-naming')['sections'][0]
        self.assertEqual(section['id'], 'alphabet-and-keys')
        self.page.locator('[data-path-section="alphabet-and-keys"]').click()
        panel = self.page.locator('.classroom-exam-study')

        def assert_keyboard():
            keyboard = panel.locator('svg.lesson-piano-keyboard')
            self.assertEqual(keyboard.count(), 1, 'Piano-key teaching needs a keyboard picture')
            self.assertTrue(keyboard.is_visible())
            self.assertEqual(keyboard.get_attribute('role'), 'img')
            self.assertIn('keyboard', keyboard.get_attribute('aria-label').lower())
            self.assertEqual(keyboard.locator('[data-keyboard-white-label]').all_text_contents(),
                             ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'])
            self.assertEqual(keyboard.locator('[data-keyboard-black-key]').count(), 5)
            self.assertEqual(keyboard.locator('[data-keyboard-group="2"]').count(), 1)
            self.assertEqual(keyboard.locator('[data-keyboard-group="3"]').count(), 1)
            bounds = keyboard.bounding_box()
            self.assertGreater(bounds['width'], 180)
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], self.page.viewport_size['width'] + 1)
            self.assertFalse(self.page.locator('#musicClassroom').evaluate('node=>node.scrollWidth>innerWidth'))
            return keyboard

        for card in section['cards']:
            self.assertEqual(panel.locator('.exam-study-title').inner_text(), card['title'])
            assert_keyboard()
            if card['id'] == 'treble-keyboard-landmarks':
                panel.screenshot(path='/tmp/classroom-pitch-keyboard-world-phone.png')
            checks = self.page.evaluate('''card=>CodaClassroomLearningPathsData.getChecks(
              'note-naming',card)''', card)
            panel.locator('[data-study-try]').click()
            for index, check in enumerate(checks):
                if card['id'] == 'treble-keyboard-landmarks':
                    self.page.set_viewport_size({'width': 320 if index == 1 else 390, 'height': 844})
                    keyboard = assert_keyboard()
                    self.assertEqual(keyboard.locator('[data-piano-highlight="true"]').count(), 0,
                                     'A key-location check must not highlight only its correct answer')
                    if index == 1:
                        panel.screenshot(path='/tmp/classroom-pitch-keyboard-world-320.png')
                panel.locator('[data-study-answer="' + str(check['correct']) + '"]').click()
                panel.locator('[data-study-next]').click()
        self.assertEqual(self.path_state()['phase'], 'menu')
        self.assertTrue(self.path_state()['sections'][0]['completed'])
        self.assertEqual(self.xp(), 0)

    def test_treble_clef_and_both_reminders_precede_the_first_staff_naming_question(self):
        self.open_category('note-naming')
        self.finish_section('note-naming', 'alphabet-and-keys')
        self.page.locator('[data-path-section="staff-and-clef"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertIn('five lines', panel.inner_text())
        self.assertEqual(panel.locator('[data-study-answer]').count(), 0)
        self.page.locator('[data-path-menu]').click()
        self.finish_section('note-naming', 'staff-and-clef')
        self.page.locator('[data-path-section="treble-reminders"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertIn('Every Good Boy Does Fine', panel.inner_text())
        self.assertIn('bottom to top', panel.locator('svg').get_attribute('aria-label').lower())
        self.assertEqual(panel.locator('svg ellipse').count(), 5)
        self.page.locator('[data-path-menu]').click()
        self.finish_section('note-naming', 'treble-reminders')
        self.page.locator('[data-path-section="treble-lines"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertEqual(panel.locator('[data-study-answer]').count(), 0)
        self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)
        reminders = next(section for section in self.path_state()['sections']
                         if section['id'] == 'treble-reminders')
        self.assertEqual(reminders['passed'], 2)
        self.assertTrue(reminders['completed'])
        self.assertEqual(self.xp(), 0)

    def test_rhythm_basics_are_ordered_and_advanced_patterns_wait_until_after_the_basics_quiz(self):
        self.open_category('rhythm-tree')
        category = self.category('rhythm-tree')
        basics = [section for section in category['sections'] if section['tier'] == 'basic']
        self.assertEqual([section['id'] for section in basics],
                         ['note-parts', 'note-symbols', 'rhythm-tree', 'counting'])
        basic_text = str([section['cards'] for section in basics]).lower()
        self.assertNotIn('sixteenth', basic_text)
        self.assertNotIn('dotted', basic_text)
        self.assertTrue(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())
        for section in basics:
            self.finish_section('rhythm-tree', section['id'])
            self.assertEqual(self.xp(), 0)
        self.assertFalse(self.page.locator('[data-path-quiz="basic"]').is_disabled())
        self.assertTrue(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())
        self.finish_basics_quiz('rhythm-tree')
        self.assertFalse(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())
        self.assertTrue(self.page.locator('[data-path-quiz="full"]').is_disabled())
        self.assertEqual(self.xp(), 0, 'A basics check does not manufacture a full-category reward')
        self.assertFalse(self.page.evaluate('CodaClassroomTutorials.readProgress().completed.includes("rhythm-tree")'))
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomQuiz.KEY)||"null")?.quizzes?.["rhythm-tree"]?.answers?.length||0'), 0)
        self.load()
        self.open_category('rhythm-tree')
        self.assertTrue(all(section['completed'] for section in self.path_state()['sections']
                            if section['tier'] == 'basic'))
        self.assertGreater(self.path_state()['basicsPassedAt'], 0)
        self.assertFalse(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())

    def test_note_part_diagrams_and_short_instructions_fit_a_phone_screen(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.open_category('rhythm-tree')
        self.page.locator('[data-path-section="note-parts"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertIn('notehead', panel.locator('svg').get_attribute('aria-label').lower())
        self.assertIn('Notehead', panel.locator('svg').text_content())
        self.assertGreaterEqual(panel.locator('.exam-study-teach').evaluate('node=>parseFloat(getComputedStyle(node).fontSize)'), 20)
        self.assertGreaterEqual(panel.locator('[data-study-try]').evaluate('node=>node.getBoundingClientRect().height'), 48)
        self.assertFalse(self.page.locator('#musicClassroom').evaluate('node=>node.scrollWidth>innerWidth'))
        self.assertGreater(panel.locator('svg').evaluate('node=>node.getBoundingClientRect().width'), 250)
        panel.screenshot(path='/tmp/classroom-note-parts-world-phone.png')
        self.page.locator('[data-study-try]').click()
        self.assertTrue(self.page.locator('[data-study-answer]').first.is_visible())
        self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)
        self.assertEqual(self.xp(), 0)

    def test_developer_can_edit_a_new_note_parts_card_and_the_classroom_uses_it_after_reload(self):
        self.page.locator('#view').focus()
        self.page.keyboard.press('F2')
        self.page.locator('#devTab-education').click()
        editor = self.page.locator('[data-education-editor].is-expanded')
        field = lambda name: editor.locator('[data-education-field="' + name + '"]')
        field('mode').select_option('study')
        field('category').select_option('rhythm-tree')
        field('list').select_option('path-note-head')
        teaching = 'Find the round notehead. It can be hollow or filled in. Trace its shape with your finger.'
        field('teach').fill(teaching)
        editor.locator('[data-education-action="save"]').click()
        self.assertIn(teaching, editor.locator('[data-education-preview]').inner_text())
        editor.locator('[data-education-action="exit"]').click()
        self.page.keyboard.press('F2')
        self.assertEqual(self.xp(), 0)
        self.load()
        self.open_category('rhythm-tree')
        self.page.locator('[data-path-section="note-parts"]').click()
        self.assertEqual(self.page.locator('.exam-study-teach').inner_text(), teaching)
        self.assertIn('Notehead', self.page.locator('.exam-study-visual svg').text_content())
        self.assertEqual(self.page.locator('[data-study-answer]').count(), 0)
        self.assertEqual(self.xp(), 0)

    def test_full_category_quiz_earns_the_existing_reward_once_and_a_valid_shared_completion(self):
        lesson = 'dynamics'
        self.open_category(lesson)
        category = self.category(lesson)
        for section in category['sections']:
            if section['tier'] == 'basic':
                self.finish_section(lesson, section['id'])
        self.finish_basics_quiz(lesson)
        self.assertEqual(self.xp(), 0)
        for section in category['sections']:
            if section['tier'] == 'advanced':
                self.finish_section(lesson, section['id'])
        self.assertEqual(self.xp(), 0)
        self.page.locator('[data-path-quiz="full"]').click()
        model = self.page.evaluate('CodaEducationContent.getQuiz("dynamics")')
        while self.path_state()['quiz']['phase']=='question':
            state=self.path_state()['quiz']
            question=state.get('question') or model['questions'][state['index']]
            self.page.locator('[data-quiz-answer="' + str(question['correct']) + '"]').click()
            self.page.locator('[data-quiz-next]').click()
        self.assertEqual(self.xp(), 0, 'A quiz result waits for the child to finish the lesson')
        self.page.locator('[data-quiz-finish]').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().learningPath.phase==="complete"')
        self.assertEqual(self.xp(), 50)
        self.assertIn(lesson, self.page.evaluate('CodaClassroomTutorials.readProgress().completed'))
        capture = self.page.evaluate('CodaClassroomProfileData.capture(localStorage)')
        self.assertTrue(capture['ok'], capture.get('error'))
        self.assertTrue(capture['data']['lessons']['lessons'][lesson]['completed'])
        self.assertEqual(capture['data']['quizzes']['quizzes'][lesson]['answers'],
                         [question['correct'] for question in model['questions']])
        self.load()
        self.open_category(lesson)
        self.assertTrue(self.path_state()['completed'])
        self.page.locator('[data-path-quiz="full"]').click()
        self.page.locator('[data-quiz-finish]').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().learningPath.phase==="complete"')
        self.assertEqual(self.xp(), 50, 'Reviewing a completed quiz never pays the reward twice')


if __name__ == '__main__':
    unittest.main(verbosity=2)
