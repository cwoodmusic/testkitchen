"""Lesson authoring changes ordered sections, checks, and visual collections."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'lesson_structure_fixture', Path(__file__).with_name('education-learning-paths-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class LessonStructureEditorTests(unittest.TestCase):
    setUpClass = classmethod(fixture.EducationLearningPathsTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.EducationLearningPathsTests.tearDownClass.__func__)
    setUp = fixture.EducationLearningPathsTests.setUp
    tearDown = fixture.EducationLearningPathsTests.tearDown
    route = fixture.EducationLearningPathsTests.route
    field = fixture.EducationLearningPathsTests.field
    action = fixture.EducationLearningPathsTests.action
    data = fixture.EducationLearningPathsTests.data

    def lesson(self):
        return self.data()['lessons']['note-naming']

    def section(self, index):
        return self.page.locator('[data-education-section-index="' + str(index) + '"]')

    def check(self, index):
        return self.page.locator('[data-education-check-index="' + str(index) + '"]')

    def visual(self, prefix):
        return self.page.locator('[data-visual-editor="' + prefix + '"]')

    def extra(self, index):
        return self.page.locator('.education-editor-form > .education-editor-pictures > '
                                 '[data-education-visual-index="' + str(index) + '"]')

    def selected_card(self):
        selected = self.field('list').input_value()
        return next(card for card in self.lesson()['study'] if card['id'] == selected)

    def export_and_reopen(self):
        saved = self.data()
        with self.page.expect_download() as pending:
            self.action('export').click()
        self.assertEqual(json.loads(Path(pending.value.path()).read_text()), saved)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.__editor&&window.__store')
        self.field('mode').select_option('study')
        self.assertEqual(self.data(), saved)
        return saved

    def test_section_order_names_and_card_assignment_survive_export_and_reload(self):
        original = self.lesson()
        count = len(original['sections'])
        first_id, second_id = original['sections'][0]['cardIds'][:2]
        self.page.locator('[data-education-lesson-settings] > summary').click()
        self.field('lesson-title').fill('My pitch lessons')
        self.field('lesson-intro').fill('Find each note using the keyboard and the staff.')
        self.field('section-title-0').fill('Pitch foundations')
        self.action('add-section').click()
        self.field('section-title-' + str(count)).fill('My extra practice')
        self.action('add-section').click()
        self.field('section-title-' + str(count + 1)).fill('Temporary section')
        self.section(count + 1).get_by_role('button', name='Move section up', exact=True).click()
        self.assertEqual(self.field('section-title-' + str(count)).input_value(), 'Temporary section')
        self.section(count).locator('[data-education-action="remove-section"]').click()
        self.action('save-lesson-settings').click()
        changed = self.lesson()
        self.assertEqual(changed['title'], 'My pitch lessons')
        self.assertEqual(changed['intro'], 'Find each note using the keyboard and the staff.')
        self.assertEqual(changed['sections'][0]['title'], 'Pitch foundations')
        self.assertEqual(len(changed['sections']), count + 1)
        added = changed['sections'][-1]
        self.assertEqual(added['title'], 'My extra practice')
        self.field('list').select_option(first_id)
        self.action('move-card-down').click()
        self.assertEqual(self.lesson()['sections'][0]['cardIds'][:2], [second_id, first_id])
        self.action('move-card-up').click()
        self.assertEqual(self.lesson()['sections'][0]['cardIds'][:2], [first_id, second_id])
        self.field('card-section').select_option(added['id'])
        self.action('save').click()
        changed = self.lesson()
        self.assertNotIn(first_id, changed['sections'][0]['cardIds'])
        self.assertEqual(changed['sections'][-1]['cardIds'], [first_id])
        runtime = self.page.evaluate('''CodaClassroomLearningPathsData.getCategory(
          'note-naming',{content:__store})''')
        self.assertEqual(runtime['title'], changed['title'])
        self.assertEqual(runtime['sections'][-1]['title'], 'My extra practice')
        self.assertEqual([card['id'] for card in runtime['sections'][-1]['cards']], [first_id])
        self.export_and_reopen()
        self.field('list').select_option(first_id)
        self.assertEqual(self.field('card-section').input_value(), added['id'])

    def test_followup_checks_and_extra_visuals_keep_the_authored_order(self):
        card = self.selected_card()
        self.assertEqual(len(card['checks']), 2)
        self.field('check-0-prompt').fill('Check alpha: which letter follows C?')
        self.field('check-1-prompt').fill('Check beta: which letter follows D?')
        self.action('add-check').click()
        self.field('check-2-prompt').fill('Check gamma: which letter follows E?')
        self.check(2).get_by_role('button', name='Move check up', exact=True).click()
        self.assertEqual(self.field('check-1-prompt').input_value(), 'Check gamma: which letter follows E?')
        self.check(2).locator('[data-education-action="remove-check"]').click()
        self.check(0).get_by_role('button', name='Move check down', exact=True).click()
        self.action('add-visual').click()
        self.visual('extra-0').locator('[data-visual-field="type"]').select_option('clef')
        self.visual('extra-0').locator('[data-visual-field="clef"]').select_option('bass')
        self.action('add-visual').click()
        self.visual('extra-1').locator('[data-visual-key="C-sharp"]').click()
        self.extra(1).get_by_role('button', name='Move visual up', exact=True).click()
        self.action('add-visual').click()
        self.extra(2).locator('[data-education-action="remove-additional-visual"]').click()
        self.action('save').click()
        changed = self.selected_card()
        self.assertEqual([check['prompt'] for check in changed['checks']], [
            'Check gamma: which letter follows E?', 'Check alpha: which letter follows C?'])
        self.assertEqual(changed['visuals'], [
            {'kind': 'keyboard', 'notes': ['C-sharp']},
            {'kind': 'clef-intro', 'clef': 'bass', 'page': 'clef'}])
        runtime_checks = self.page.evaluate('''card=>CodaClassroomLearningPathsData.getChecks(
          'note-naming',card)''', changed)
        self.assertEqual([check['prompt'] for check in runtime_checks[1:]],
                         [check['prompt'] for check in changed['checks']])
        self.export_and_reopen()
        self.field('list').select_option(card['id'])
        self.assertEqual(self.selected_card(), changed)
        self.assertEqual(self.visual('extra-0').locator('[data-visual-field="type"]').input_value(), 'keyboard')
        self.assertEqual(self.visual('extra-1').locator('[data-visual-field="clef"]').input_value(), 'bass')


if __name__ == '__main__':
    unittest.main(verbosity=2)
