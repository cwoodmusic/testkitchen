"""End quizzes gate new lesson rewards while preserving old classroom progress."""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode=True
from classroom_quiz_helpers import QUIZ_ANSWERS,answer_quiz,quiz_answer
from exam_study_helpers import finish_exam_study
_spec=importlib.util.spec_from_file_location('quiz_learning_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class ClassroomQuizWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        phone=self._testMethodName.endswith('_phone')
        self.context=self.browser.new_context(viewport={'width':390,'height':844} if phone else {'width':1550,'height':1050},is_mobile=phone,has_touch=phone)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url)
            if response.status>=400 and 'cwoodmusic.github.io/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load();self.page.wait_for_function('!!window.CodaClassroomQuiz')

    def state(self):return self.page.evaluate('CodaArcadeQA.tutorials()')
    def xp(self):return self.page.evaluate('CodaArcadeQA.progression().xp')

    def open_lesson(self,lesson):
        if not self.page.evaluate('CodaArcadeQA.classroom().open'):enter_room(self.page,'classroom')
        back=self.page.locator('#classroomAllLessons')
        if back.is_visible():back.click()
        if not self.page.locator('#classroomStart').is_visible():
            room=self.page.locator('#classroomBackRoom')
            if room.is_visible():room.click()
            self.page.locator('#classroomCanvas').focus();self.page.keyboard.down('w')
            self.page.wait_for_timeout(850);self.page.keyboard.up('w');self.page.keyboard.press('e')
        self.page.locator('[data-start-lesson="'+lesson+'"]').click()

    def ready_quiz(self,lesson,legacy=False):
        # Earlier guided-step tests play every teaching activity. Here a real
        # saved teaching checkpoint isolates the quiz and reward boundaries.
        self.page.evaluate('''({lesson,legacy})=>{
          const total=CodaClassroomTutorials.LESSONS.find(item=>item.id===lesson).total;
          const progress={version:1,lessons:{[lesson]:{step:total,completed:legacy,completedAt:legacy?1:0}}};
          localStorage.setItem('codaClassroomLessonsV1',JSON.stringify(progress));
        }''',{'lesson':lesson,'legacy':legacy})
        self.load();self.open_lesson(lesson)
        if not legacy:
            finish_exam_study(self.page,lesson)
            self.assertEqual(self.state()['active']['phase'],'quiz')

    def assert_score(self,score):
        self.assertRegex(self.page.locator('.classroom-quiz-score').get_attribute('aria-label'),str(score)+r'\s*(?:/|of)\s*5')

    def test_bass_and_grand_quizzes_award_real_classroom_xp_once(self):
        for lesson in ['bass-clef','grand-staff']:
            before=self.xp();self.ready_quiz(lesson)
            answer_quiz(self.page,lesson,wrong=(3,4),finish=False)
            self.assert_score(3);self.assertEqual(self.xp(),before)
            self.assertNotIn(lesson,self.state()['completed'])
            self.page.locator('[data-quiz-retry]').click();answer_quiz(self.page,lesson,finish=False)
            self.assertEqual(self.xp(),before,'A passing score still needs Finish lesson')
            self.page.locator('[data-quiz-finish]').click()
            self.assertEqual(self.xp(),before+50);self.assertIn(lesson,self.state()['completed'])
            self.page.locator('[data-tutorial-quiz]').click();answer_quiz(self.page,lesson)
            self.assertEqual(self.xp(),before+50,'Replaying a lesson cannot award its XP again')
            self.load();self.open_lesson(lesson)
            self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.xp(),before+50)

    def test_failed_quiz_has_no_reward_and_four_of_five_passes_only_after_finish(self):
        self.ready_quiz('note-naming');self.assertEqual(self.xp(),0)
        self.assertNotIn('note-naming',self.state()['completed'])
        self.page.locator('#classroomClose').click();self.page.locator('#levelBtn').click()
        profile=self.page.locator('.profile-lessons').inner_text()
        self.assertIn('Note naming · Quiz ready',profile)
        self.assertNotIn('Note naming · Finished',profile)
        self.assertEqual(self.xp(),0)
        self.page.locator('#panelClose').click();self.open_lesson('note-naming')
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.assertTrue(self.page.locator('[data-quiz-next]').count()==0 or self.page.locator('[data-quiz-next]').is_disabled())
        answer_quiz(self.page,'note-naming',wrong=(0,1),finish=False)
        self.assert_score(3)
        finish=self.page.locator('[data-quiz-finish]')
        self.assertTrue(finish.count()==0 or finish.is_disabled())
        self.assertEqual(self.xp(),0);self.assertNotIn('note-naming',self.state()['completed'])
        self.page.locator('[data-quiz-retry]').click()
        answer_quiz(self.page,'note-naming',wrong=(2,),finish=False)
        self.assert_score(4)
        self.assertEqual(self.xp(),0,'Seeing a passing score does not silently claim the lesson reward')
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.xp(),50);self.assertIn('note-naming',self.state()['completed'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.page.locator('[data-tutorial-quiz]').click();answer_quiz(self.page,'note-naming')
        self.assertEqual(self.xp(),50,'Passing the end quiz again cannot farm the same achievement')

    def test_refresh_resumes_answered_question_and_preserves_first_choice_score(self):
        self.ready_quiz('time-signatures')
        first=quiz_answer(self.page,'time-signatures',0)
        self.page.locator('[data-quiz-answer="'+str(first)+'"]').click();self.page.locator('[data-quiz-next]').click()
        wrong=(quiz_answer(self.page,'time-signatures',1)+1)%3
        self.page.locator('[data-quiz-answer="'+str(wrong)+'"]').click()
        labels=self.page.locator('[data-quiz-answer]').all_inner_texts()
        feedback=self.page.locator('.classroom-quiz-feedback').inner_text()
        self.assertTrue(feedback)
        self.assertTrue(all(button.is_disabled() for button in self.page.locator('[data-quiz-answer]').all()))
        self.load();self.open_lesson('time-signatures')
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.assertEqual(self.page.locator('[data-quiz-answer]').all_inner_texts(),labels)
        self.assertEqual(self.page.locator('.classroom-quiz-feedback').inner_text(),feedback)
        self.assertTrue(all(button.is_disabled() for button in self.page.locator('[data-quiz-answer]').all()))
        self.page.locator('[data-quiz-next]').click()
        for index in range(2,5):
            correct=quiz_answer(self.page,'time-signatures',index)
            self.page.locator('[data-quiz-answer="'+str(correct)+'"]').click();self.page.locator('[data-quiz-next]').click()
        self.assert_score(4);self.assertEqual(self.xp(),0)
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.xp(),50);self.assertIn('time-signatures',self.state()['completed'])

    def test_failed_quiz_write_blocks_completion_until_saved_and_explicitly_finished(self):
        self.ready_quiz('rhythm-tree')
        self.page.evaluate("""()=>{
          const set=Storage.prototype.setItem;
          window.failQuizWrite=true;
          Storage.prototype.setItem=function(key,value){
            if(window.failQuizWrite&&key==='codaClassroomQuizzesV1')throw Error('fixture quota');
            return set.call(this,key,value);
          };
        }""")
        answer_quiz(self.page,'rhythm-tree',finish=False)
        self.assert_score(5);self.assertFalse(self.state()['active']['quiz']['saved'])
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.assertEqual(self.xp(),0);self.assertNotIn('rhythm-tree',self.state()['completed'])
        self.assertTrue(self.state()['active']['quiz']['error'])
        self.page.evaluate('failQuizWrite=false');self.page.locator('[data-quiz-save]').click()
        self.assertTrue(self.state()['active']['quiz']['saved'])
        self.assertEqual(self.xp(),0,'Retrying a quiz save alone must not award the lesson')
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.xp(),50);self.assertIn('rhythm-tree',self.state()['completed'])
        self.load();self.assertEqual(self.xp(),50)

    def test_legacy_completion_remains_earned_and_can_take_the_new_quiz_directly(self):
        self.ready_quiz('note-naming',legacy=True)
        self.assertIn('note-naming',self.state()['completed'])
        self.assertTrue(self.state()['active']['complete'])
        before=self.xp();self.assertEqual(before,50)
        self.page.locator('[data-tutorial-quiz]').click()
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.assertTrue(self.page.locator('.classroom-quiz-question').evaluate('e=>e===document.activeElement'),
            'Starting a quiz should move keyboard focus to its question')
        self.assertEqual(self.xp(),before)
        answer_quiz(self.page,'note-naming')
        self.assertEqual(self.xp(),before);self.assertIn('note-naming',self.state()['completed'])
        self.load();self.assertEqual(self.xp(),before)
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.rewardNotifications().current'))

    def test_quiz_choices_fit_phone_orientations_and_keyboard_can_answer_phone(self):
        self.ready_quiz('rhythm-tree')
        before=self.page.evaluate('CodaArcadeQA.position()')
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            quiz=self.page.locator('.classroom-quiz')
            self.assertLessEqual(quiz.evaluate('e=>e.scrollWidth'),quiz.evaluate('e=>e.clientWidth')+2)
            for button in self.page.locator('[data-quiz-answer]').all():
                self.assertGreaterEqual(button.bounding_box()['height'],48)
            self.assertLessEqual(self.page.locator('#musicClassroom').evaluate('e=>e.scrollWidth'),size['width'])
        correct=quiz_answer(self.page,'rhythm-tree',0)
        self.page.locator('[data-quiz-answer="'+str(correct)+'"]').focus();self.page.keyboard.press('Enter')
        self.assertFalse(self.page.locator('[data-quiz-next]').is_disabled())
        self.page.locator('[data-quiz-next]').focus();self.page.keyboard.press('Enter')
        self.assertTrue(all(not button.is_disabled() for button in self.page.locator('[data-quiz-answer]').all()))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),before)
        self.assertEqual(self.xp(),0)
        self.page.screenshot(path='/tmp/coda-classroom40-quiz-phone.png')


if __name__=='__main__':unittest.main(verbosity=2)
