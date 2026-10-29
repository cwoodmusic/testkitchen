"""Learn major/minor keys through real classroom controls and Web Audio."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('keys_classroom_fixture',Path(__file__).with_name('classroom-tutorials-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)
from classroom_quiz_helpers import answer_quiz

ANSWERS=[0,0,0,0,0,1,2,0]


class MajorMinorClassroomTests(unittest.TestCase):
    setUpClass=classmethod(fixture.ClassroomTutorialTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.ClassroomTutorialTests.tearDownClass.__func__)
    setUp=fixture.ClassroomTutorialTests.setUp
    tearDown=fixture.ClassroomTutorialTests.tearDown
    load=fixture.ClassroomTutorialTests.load
    open_lesson=fixture.ClassroomTutorialTests.open_lesson
    state=fixture.ClassroomTutorialTests.state

    def answer_step(self,index):
        self.assertEqual(self.state()['active']['learningStage'],'look')
        self.assertEqual(self.page.locator('[data-key-answer]').count(),0)
        self.page.locator('[data-lesson-try]').click()
        self.page.locator('[data-key-answer="'+str(ANSWERS[index])+'"]').click()
        self.page.locator('[data-tutorial-next]').click()

    def finish_steps(self,start=0):
        for index in range(start,8):self.answer_step(index)

    def test_scaffolded_key_lesson_plays_major_minor_and_preserves_partial_progress(self):
        self.open_lesson('major-minor-keys')
        self.assertIn('home note',self.page.locator('.lesson-instruction').inner_text())
        self.assertEqual(self.page.locator('[data-key-home="C"]').count(),2)
        self.page.locator('[data-key-listen="0"]').click()
        self.assertTrue(self.state()['active']['audioPlaying'])
        self.assertEqual(self.state()['active']['step'],0,'Listening cannot answer a lesson')
        self.page.locator('[data-lesson-try]').click()
        self.page.locator('[data-key-answer="1"]').click()
        self.assertFalse(self.state()['active']['answered'])
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertIn('starts and ends on C',self.page.locator('.tutorial-feedback').inner_text())
        self.page.locator('[data-key-answer="0"]').click();self.page.locator('[data-tutorial-next]').click()
        self.assertFalse(self.state()['active']['audioPlaying'])
        self.answer_step(1)
        self.assertEqual(self.state()['active']['step'],2)
        self.page.evaluate('''()=>{
          window.keyPitches=[];const start=OscillatorNode.prototype.start;
          OscillatorNode.prototype.start=function(...args){keyPitches.push(Math.round(69+12*Math.log2(this.frequency.value/440)));return start.apply(this,args);};
        }''')
        self.page.locator('[data-key-listen="0"]').click()
        self.assertEqual(self.page.evaluate('keyPitches'),[60,64,67,72,67,64,60])
        self.page.evaluate('keyPitches=[]');self.page.locator('[data-key-listen="1"]').click()
        self.assertEqual(self.page.evaluate('keyPitches'),[60,63,67,72,67,63,60])
        self.page.locator('#classroomAllLessons').click();self.open_lesson('major-minor-keys')
        self.assertEqual(self.state()['active']['step'],2)
        self.assertFalse(self.state()['active']['audioPlaying'])
        self.load();self.open_lesson('major-minor-keys')
        self.assertEqual(self.state()['active']['step'],2)

    def test_quiz_gates_completion_and_rewards_once_after_a_saved_pass(self):
        self.open_lesson('major-minor-keys');self.finish_steps()
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.assertEqual(self.page.evaluate('rewards'),[])
        answer_quiz(self.page,'major-minor-keys',wrong=(0,1),finish=False)
        self.assertEqual(self.page.locator('[data-quiz-finish]').count(),0)
        self.assertNotIn('major-minor-keys',self.state()['completed'])
        self.page.locator('[data-quiz-retry]').click();answer_quiz(self.page,'major-minor-keys')
        self.assertIn('major-minor-keys',self.state()['completed'])
        self.assertEqual(self.page.evaluate('rewards'),[{'id':'major-minor-keys','amount':50}])
        self.page.locator('[data-tutorial-replay]').click();self.finish_steps();answer_quiz(self.page,'major-minor-keys')
        self.assertEqual(len(self.page.evaluate('rewards')),1)
        self.load();self.open_lesson('major-minor-keys')
        self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.page.evaluate('rewards'),[])

    def test_major_minor_examples_and_answers_fit_phone_and_short_landscape(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            self.page.evaluate("localStorage.removeItem('codaClassroomLessonsV1');localStorage.removeItem('codaClassroomQuizzesV1')")
            self.open_lesson('major-minor-keys')
            for index in range(8):
                self.assertNotRegex(self.page.locator('.classroom-tutorial').inner_text(),r'\b[A-G][♯♭]?[0-8]\b')
                self.page.locator('[data-lesson-try]').click()
                metrics=self.page.locator('.classroom-tutorial').evaluate('''host=>({
                  width:host.clientWidth,scroll:host.scrollWidth,
                  buttons:[...host.querySelectorAll('button')].filter(button=>button.getClientRects().length).map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))})''')
                self.assertLessEqual(metrics['scroll'],metrics['width']+2,metrics)
                self.assertTrue(all(button['width']>=44 and button['height']>=48 for button in metrics['buttons']),metrics)
                self.assertFalse(self.page.locator('#room').evaluate('host=>host.scrollWidth>innerWidth'))
                self.page.locator('[data-key-answer="'+str(ANSWERS[index])+'"]').click();self.page.locator('[data-tutorial-next]').click()
            answer_quiz(self.page,'major-minor-keys')


if __name__=='__main__':unittest.main(verbosity=2)
