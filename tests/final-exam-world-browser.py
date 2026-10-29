"""Take Haydn's exam through the physical classroom and ordinary answer controls."""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('exam_learning_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class FinalExamWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('!!window.CodaFinalExam&&!!window.CodaFinalExamBank')

    def state(self):return self.page.evaluate('CodaArcadeQA.classroom().finalExam')
    def xp(self):return self.page.evaluate('CodaArcadeQA.progression().xp')

    def talk_to_haydn(self):
        if not self.page.evaluate('CodaArcadeQA.classroom().open'):enter_room(self.page,'classroom')
        if self.page.locator('#classroomAllLessons').is_visible():
            self.page.locator('#classroomAllLessons').click();return
        if self.page.locator('#classroomStart').is_visible():return
        if self.page.locator('#classroomBackRoom').is_visible():self.page.locator('#classroomBackRoom').click()
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.down('w')
        self.page.wait_for_timeout(850);self.page.keyboard.up('w');self.page.keyboard.press('e')
        self.page.wait_for_function('!document.querySelector("#classroomStart").hidden')

    def open_exam(self):
        self.talk_to_haydn();self.page.locator('#classroomFinalExam').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.classroom().topic'),'final-exam')
        self.assertTrue(self.state()['open'])
        self.assertEqual(self.page.locator('.classroom-check').count(),0,'The full exam must not render a reference-book quick check')

    def start_exam(self,size=None):
        if size is not None:self.page.get_by_label('Final exam length',exact=True).select_option(str(size))
        self.page.locator('[data-exam-start]').click()
        self.assertEqual(self.state()['phase'],'question')

    def correct_choice(self):
        # Test-only inspection of the authored question bank, followed by real UI
        # clicks. No production shortcut can mark questions or awards complete.
        return self.page.evaluate('''()=>{
          const exam=CodaArcadeQA.classroom().finalExam;
          const question=CodaFinalExamBank.getQuestion(exam.questionIds[exam.index]);
          const correct=question.choices.findIndex(choice=>choice.id===question.answer);
          return CodaFinalExam.ORDERS[exam.orders[exam.index]].indexOf(correct);
        }''')

    def answer_current(self):
        self.page.locator('[data-exam-answer="'+str(self.correct_choice())+'"]').click()
        self.page.locator('[data-exam-next]').click()

    def finish_exam(self):
        while not self.state()['review']:self.answer_current()
        self.assertFalse(self.page.locator('[data-exam-submit]').is_disabled())
        self.page.locator('[data-exam-submit]').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().finalExam.phase==="result"&&!CodaArcadeQA.classroom().finalExam.claiming')

    def assert_balanced(self,count):
        categories=self.page.evaluate('''()=>{
          const counts={};for(const id of CodaArcadeQA.classroom().finalExam.questionIds){
            const category=CodaFinalExamBank.getQuestion(id).category;counts[category]=(counts[category]||0)+1;
          }return counts;
        }''')
        self.assertEqual(len(categories),8);self.assertTrue(all(total==count for total in categories.values()),categories)

    def test_default_forty_questions_balance_and_reload_resume_through_haydn(self):
        self.open_exam();self.assertEqual(self.page.get_by_label('Final exam length',exact=True).input_value(),'40')
        self.assertEqual(self.page.locator('[data-start-lesson]').count(),9)
        self.start_exam();self.assertEqual(self.state()['total'],40);self.assert_balanced(5)
        first_ids=self.state()['questionIds'];self.answer_current();self.answer_current()
        self.assertEqual(self.state()['answered'],2);self.assertEqual(self.xp(),0)
        self.load();self.open_exam();self.assertEqual(self.state()['index'],2)
        self.assertEqual(self.state()['questionIds'],first_ids);self.assertEqual(self.state()['answered'],2)
        self.page.locator('[data-exam-review]').click();self.assertTrue(self.page.locator('[data-exam-submit]').is_disabled())
        self.page.locator('[data-exam-exit]').click()
        self.assertTrue(self.page.locator('#classroomStart').is_visible())
        self.assertIsNone(self.state())
        self.page.locator('#classroomBrowseBooks').click();self.page.locator('#classroomSearch').fill('final exam')
        self.page.locator('[data-topic="final-exam"]').click()
        self.assertEqual(self.state()['answered'],2);self.assertEqual(self.state()['questionIds'],first_ids)
        self.page.locator('#classroomBackRoom').click();self.assertFalse(self.state()['open'])
        self.page.keyboard.press('Escape');self.assertFalse(self.page.evaluate('CodaArcadeQA.classroom().open'))

    def test_full_submission_category_summary_reward_once_and_fresh_retake(self):
        self.open_exam();self.start_exam(24);self.assert_balanced(3)
        ids=self.state()['questionIds'];self.finish_exam()
        result=self.state();self.assertEqual(result['score'],24);self.assertEqual(result['percent'],100)
        self.assertTrue(result['passed']);self.assertTrue(result['saved']);self.assertGreater(result['completedAt'],0)
        self.assertEqual(len(result['byCategory']),8)
        self.assertTrue(all(value=={'correct':3,'total':3} for value in result['byCategory'].values()))
        self.assertEqual(self.page.locator('.final-exam-breakdown article').count(),8)
        self.assertEqual(self.xp(),200)
        self.page.locator('[data-exam-retake]').click();self.start_exam(24)
        self.assertNotEqual(self.state()['questionIds'],ids);self.assert_balanced(3)
        self.finish_exam();self.assertEqual(self.xp(),200,'Retakes cannot farm the Final Exam achievement')
        self.page.locator('.final-exam-breakdown button').first.click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.classroom().topic'),'note-naming')
        self.assertEqual(self.page.locator('.classroom-tutorial').get_attribute('data-tutorial'),'note-naming')
        self.assertIsNone(self.state())
        self.load();self.open_exam();self.assertEqual(self.state()['phase'],'result');self.assertEqual(self.xp(),200)

    def test_exam_choices_phone_landscape_and_save_return_fit_without_world_controls(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.open_exam();self.start_exam(24)
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            panel=self.page.locator('.haydn-final-exam')
            self.assertLessEqual(panel.evaluate('node=>node.scrollWidth'),panel.evaluate('node=>node.clientWidth')+2)
            self.assertLessEqual(self.page.locator('#musicClassroom').evaluate('node=>node.scrollWidth'),size['width'])
            for button in self.page.locator('[data-exam-answer]').all():
                self.assertGreaterEqual(button.bounding_box()['height'],48)
            self.assertTrue(self.page.locator('#classroomSettingsButton').is_hidden())
        self.answer_current();self.assertEqual(self.state()['answered'],1)
        self.page.locator('[data-exam-exit]').click();self.assertTrue(self.page.locator('#classroomStart').is_visible())
        self.page.locator('#classroomFinalExam').click();self.assertEqual(self.state()['answered'],1)
        self.assertEqual(self.xp(),0)


if __name__=='__main__':unittest.main(verbosity=2)
