"""Child-friendly classroom menus against the assembled game and real saves.

The public origin is routed to this checkout in disposable Chromium profiles.
All outside requests are blocked; the tests never use live student records.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import enter_room

_spec = importlib.util.spec_from_file_location(
    'classroom_menu_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class ClassroomMenuTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('''window.CodaClassroomMenus
          &&window.CodaClassroomLearningPathsData
          &&window.CodaEducationContent?.getStore().getState().loaded''')

    def room_state(self):
        return self.page.evaluate('CodaArcadeQA.classroom()')

    def menu(self):
        return self.page.locator('.classroom-kids-menu')

    def action(self, name):
        return self.menu().locator('[data-classroom-menu="' + name + '"]')

    def talk_to_haydn(self):
        if not self.room_state()['open']:
            enter_room(self.page, 'classroom')
        if self.menu().is_visible():
            return
        back = self.page.locator('#classroomBackRoom')
        if back.is_visible():
            back.click()
        self.page.locator('#classroomCanvas').focus()
        self.page.keyboard.down('w')
        self.page.wait_for_timeout(850)
        self.page.keyboard.up('w')
        self.assertEqual(self.room_state()['near']['type'], 'professor')
        self.page.keyboard.press('e')
        self.menu().wait_for(state='visible')

    def category(self, lesson):
        return self.page.evaluate('''id=>CodaClassroomLearningPathsData.getCategory(
          id,{content:CodaEducationContent})''', lesson)

    def path_save(self):
        return self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)')

    def seed_progress(self, lesson, finished=False):
        """Use production sessions to save a current, validated path revision."""
        return self.page.evaluate('''({id,finished})=>{
          const data=CodaClassroomLearningPathsData, paths=CodaClassroomLearningPaths;
          const category=data.getCategory(id,{content:CodaEducationContent});
          const full=CodaEducationContent.getQuiz(id)||CodaClassroomQuiz.QUIZZES[id];
          const revision=paths.revisionOf(category,full,CodaEducationContent.getLessonRevision(id)||'');
          const getChecks=card=>data.getChecks(id,card);
          const session=paths.createSession({category,revision,storage:localStorage,getChecks});
          const sections=finished?category.sections.filter(section=>section.cards.length):[category.sections.find(section=>section.cards.length)];
          for(const section of sections){
            if(section.tier==='advanced'&&!session.getState().basicsPassedAt){
              if(!session.markBasicsPassed())throw Error('Could not save basics progress');
            }
            const study=CodaClassroomExamStudy.createSession({lessonId:id,cards:section.cards,
              storage:session.sectionStorage(section.id),revision:session.sectionRevision(section.id),getChecks});
            const cards=finished?section.cards:section.cards.slice(0,1);
            for(const card of cards){
              study.tryIt();
              for(const check of getChecks(card)){
                if(!study.answer(check.correct)||!study.getState().saved||!study.next())
                  throw Error('Could not save valid study progress');
              }
            }
            study.destroy();
          }
          if(finished){
            if(!session.getState().basicsPassedAt&&!session.markBasicsPassed())throw Error('Could not mark basics');
            if(!session.markCompleted())throw Error('Could not mark category complete');
          }
          const state=session.getState();session.destroy();return state;
        }''', {'id': lesson, 'finished': finished})

    def test_haydn_offers_four_choices_without_writing_progress_or_leaking_movement(self):
        before = self.path_save()
        self.talk_to_haydn()
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'home')
        for name in ['continue', 'lessons', 'reference', 'progress']:
            self.assertTrue(self.action(name).is_visible())
        self.assertEqual(self.path_save(), before)
        world_before = self.page.evaluate('CodaArcadeQA.position()')
        classroom_before = self.room_state()['player']
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(130)
        self.page.keyboard.up('d')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'), world_before)
        self.assertEqual(self.room_state()['player'], classroom_before)
        self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)

    def test_picker_keeps_starters_all_nine_categories_and_the_exam_available(self):
        self.talk_to_haydn()
        self.action('lessons').click()
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'lessons')
        self.assertEqual(self.menu().locator('[data-classroom-lesson]').evaluate_all(
            'nodes=>nodes.map(node=>node.dataset.classroomLesson)'),
            ['note-naming', 'rhythm-tree', 'time-signatures'])
        self.assertEqual(self.menu().locator('[data-status="new"]').count(), 3)
        self.action('all').click()
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'all')
        ids = self.menu().locator('[data-classroom-lesson]').evaluate_all(
            'nodes=>nodes.map(node=>node.dataset.classroomLesson)')
        expected = self.page.evaluate('CodaClassroomLearningPathsData.CATEGORIES.map(item=>item.id)')
        self.assertCountEqual(ids, expected)
        self.assertEqual(len(ids), 9)
        self.menu().locator('[data-classroom-lesson="bass-clef"]').click()
        state = self.room_state()['learningPath']
        self.assertEqual(state['id'], 'bass-clef')
        self.assertEqual(state['phase'], 'menu')
        self.assertTrue(state['sections'][0]['available'])
        self.assertFalse(any(section['available'] for section in state['sections'][1:]))
        self.assertTrue(self.page.locator('[data-path-quiz="basic"]').is_disabled())
        self.assertTrue(self.page.locator('[data-path-quiz="full"]').is_disabled())
        self.page.locator('#classroomAllLessons').click()
        self.action('lessons').click()
        self.action('all').click()
        self.action('exam').click()
        self.assertIsNotNone(self.room_state()['finalExam'])

    def test_continue_reopens_the_actual_saved_card_without_starting_a_quiz(self):
        seeded = self.seed_progress('note-naming')
        first = seeded['sections'][0]
        self.assertEqual(first['passed'], 1)
        before = self.path_save()
        self.talk_to_haydn()
        self.assertIn('Note names', self.action('continue').inner_text())
        self.action('continue').click()
        state = self.room_state()['learningPath']
        self.assertEqual(state['id'], 'note-naming')
        self.assertEqual(state['phase'], 'section')
        self.assertEqual(state['sectionId'], first['id'])
        self.assertEqual(state['study']['index'], 1)
        self.assertEqual(state['study']['stage'], 'look')
        self.assertIsNone(state['quiz'])
        self.assertEqual(self.path_save(), before)

    def test_finished_labels_use_saved_completion_and_review_keeps_the_result(self):
        seeded = self.seed_progress('note-naming', finished=True)
        self.assertGreater(seeded['completedAt'], 0)
        before = self.path_save()
        self.talk_to_haydn()
        self.action('lessons').click()
        card = self.menu().locator('[data-classroom-lesson="note-naming"]')
        self.assertEqual(card.get_attribute('data-status'), 'finished')
        self.assertIn('Finished', card.inner_text())
        self.assertIn('Review', card.inner_text())
        card.click()
        self.assertGreater(self.room_state()['learningPath']['completedAt'], 0)
        self.assertEqual(self.path_save(), before)

    def test_reference_and_back_controls_preserve_the_room_and_clear_audio(self):
        self.talk_to_haydn()
        self.action('reference').click()
        self.page.locator('#classroomSearch').fill('interval')
        self.page.locator('[data-topic="intervals"]').click()
        self.assertEqual(self.room_state()['topic'], 'intervals')
        self.page.get_by_role('button', name='♫ Hear a major third up', exact=True).click()
        self.assertTrue(self.room_state()['audioPlaying'])
        self.page.keyboard.press('Escape')
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'home')
        self.assertFalse(self.room_state()['audioPlaying'])
        self.assertTrue(self.room_state()['open'])
        self.action('lessons').click()
        self.page.keyboard.press('Escape')
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'home')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.room_state()['mobileView'], 'room')
        self.assertTrue(self.room_state()['open'])
        self.talk_to_haydn()
        self.action('room').click()
        self.assertEqual(self.room_state()['mobileView'], 'room')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'classroomCanvas')

    def test_progress_reloads_current_saved_status_and_menu_back_is_keyboard_accessible(self):
        self.seed_progress('rhythm-tree')
        before = self.path_save()
        self.talk_to_haydn()
        self.action('progress').click()
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'progress')
        self.assertIn('In progress', self.menu().inner_text())
        self.assertIn('Note lengths', self.menu().inner_text())
        self.assertEqual(self.path_save(), before)
        self.action('home').focus()
        self.page.keyboard.press('Enter')
        self.assertEqual(self.menu().get_attribute('data-menu-page'), 'home')
        self.assertTrue(self.page.locator('[data-classroom-menu-heading]').evaluate(
            'node=>node===document.activeElement'))
        # The room's focus trap must include the native disclosure control,
        # otherwise Tab from the last menu button skips Haydn entirely.
        self.action('room').focus()
        self.page.keyboard.press('Tab')
        summary = self.page.locator('#classroomHaydnExtras summary')
        self.assertTrue(summary.evaluate('node=>node===document.activeElement'))
        details = self.page.locator('#classroomHaydnExtras')
        self.assertFalse(details.evaluate('node=>node.open'))
        self.page.keyboard.press('Enter')
        self.assertTrue(details.evaluate('node=>node.open'))
        self.page.keyboard.press('Enter')
        self.assertFalse(details.evaluate('node=>node.open'))

    def test_phone_and_short_desktop_menus_fit_and_keep_large_click_targets(self):
        for width, height in [(390, 844), (1366, 768)]:
            with self.subTest(viewport=(width, height)):
                self.page.set_viewport_size({'width': width, 'height': height})
                self.talk_to_haydn()
                for page in ['home', 'lessons', 'all', 'progress']:
                    if page != 'home':
                        if page == 'all':
                            self.action('lessons').click()
                        self.action(page).click()
                    self.assertEqual(self.menu().get_attribute('data-menu-page'), page)
                    self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                    for button in self.menu().locator('button:visible').all():
                        button.scroll_into_view_if_needed()
                        box = button.bounding_box()
                        self.assertGreaterEqual(box['height'], 43.5, button.inner_text())
                        self.assertGreaterEqual(box['x'], -1)
                        self.assertLessEqual(box['x'] + box['width'], width + 1)
                    if page != 'home':
                        self.action('home').click()
                self.page.screenshot(path=f'/tmp/classroom-menu-{width}.png')
                self.action('room').click()


if __name__ == '__main__':
    unittest.main(verbosity=2)
