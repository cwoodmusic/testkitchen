"""Dynamics and tempo lessons use real audio, saved progress, and touch controls."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('expression_classroom_fixture',Path(__file__).with_name('classroom-tutorials-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)
from classroom_quiz_helpers import answer_quiz

ANSWERS={'dynamics':[0,1,2,0,1,2,0,1], 'tempo':[1,0,2,1,0,2,1,0]}


class DynamicsTempoClassroomTests(unittest.TestCase):
    setUpClass=classmethod(fixture.ClassroomTutorialTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.ClassroomTutorialTests.tearDownClass.__func__)
    setUp=fixture.ClassroomTutorialTests.setUp
    tearDown=fixture.ClassroomTutorialTests.tearDown
    load=fixture.ClassroomTutorialTests.load
    open_lesson=fixture.ClassroomTutorialTests.open_lesson
    state=fixture.ClassroomTutorialTests.state

    def answer_step(self,lesson,index):
        self.assertEqual(self.state()['active']['learningStage'],'look')
        self.assertEqual(self.page.locator('[data-expression-answer]').count(),0)
        self.page.locator('[data-lesson-try]').click()
        self.page.locator('[data-expression-answer="'+str(ANSWERS[lesson][index])+'"]').click()
        self.page.locator('[data-tutorial-next]').click()

    def finish_steps(self,lesson,start=0):
        for index in range(start,8):self.answer_step(lesson,index)

    def record_audio(self):
        self.page.evaluate('''()=>{
          window.soundCapture={starts:[],peaks:[],pitches:[]};
          const start=OscillatorNode.prototype.start,ramp=AudioParam.prototype.exponentialRampToValueAtTime;
          OscillatorNode.prototype.start=function(at){soundCapture.starts.push(at);soundCapture.pitches.push(this.frequency.value);return start.call(this,at);};
          AudioParam.prototype.exponentialRampToValueAtTime=function(value,at){if(value>.0001)soundCapture.peaks.push(value);return ramp.call(this,value,at);};
        }''')

    def hear(self,index=0):
        self.page.evaluate('soundCapture={starts:[],peaks:[],pitches:[]}')
        self.page.locator('[data-expression-listen="'+str(index)+'"]').click()
        self.assertTrue(self.state()['active']['audioPlaying'])
        data=self.page.evaluate('soundCapture')
        self.assertEqual(len(data['starts']),6)
        data['gaps']=[round(data['starts'][i+1]-data['starts'][i],6) for i in range(5)]
        return data

    def test_dynamics_changes_loudness_without_changing_pitch_or_tempo_and_resumes(self):
        self.open_lesson('dynamics');self.record_audio()
        self.assertIn('loud or soft',self.page.locator('.lesson-instruction').inner_text())
        self.assertEqual(self.page.locator('[data-dynamic]').count(),2)
        self.page.evaluate('document.fonts.ready');self.assertTrue(self.page.evaluate('CodaMusicNotation.isReady()'))
        self.assertEqual(self.page.locator('[data-dynamic="p"]').evaluate('node=>getComputedStyle(node).fontFamily'),'CodaBravura')
        soft=self.hear(0);loud=self.hear(1)
        self.assertEqual(soft['pitches'],loud['pitches']);self.assertEqual(soft['gaps'],loud['gaps'])
        self.assertTrue(all(gap==.6 for gap in soft['gaps']))
        self.assertTrue(all(a<b for a,b in zip(soft['peaks'],loud['peaks'])))
        self.page.locator('[data-lesson-try]').click();self.page.locator('[data-expression-answer="1"]').click()
        self.assertFalse(self.state()['active']['answered']);self.assertEqual(self.state()['active']['step'],0)
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.page.locator('[data-expression-answer="0"]').click();self.page.locator('[data-tutorial-next]').click()
        for index in range(1,5):self.answer_step('dynamics',index)
        crescendo=self.hear()
        self.assertTrue(all(a<b for a,b in zip(crescendo['peaks'],crescendo['peaks'][1:])))
        self.assertTrue(all(gap==.6 for gap in crescendo['gaps']))
        self.answer_step('dynamics',5);diminuendo=self.hear()
        self.assertEqual(diminuendo['peaks'],list(reversed(crescendo['peaks'])))
        self.page.locator('#classroomAllLessons').click();self.assertFalse(self.page.evaluate('roomUI.getState().audioPlaying'))
        self.open_lesson('dynamics');self.assertEqual(self.state()['active']['step'],6)
        self.load();self.open_lesson('dynamics');self.assertEqual(self.state()['active']['step'],6)

    def test_tempo_changes_pulse_without_changing_pitch_or_loudness(self):
        self.open_lesson('tempo');self.record_audio()
        slow=self.hear(0);fast=self.hear(1)
        self.assertEqual(slow['pitches'],fast['pitches']);self.assertEqual(slow['peaks'],fast['peaks'])
        self.assertTrue(all(a>b for a,b in zip(slow['gaps'],fast['gaps'])))
        self.answer_step('tempo',0)
        sixty=self.hear(0);one_twenty=self.hear(1)
        self.assertEqual(sixty['gaps'],[1]*5);self.assertEqual(one_twenty['gaps'],[.5]*5)
        for index in range(1,5):self.answer_step('tempo',index)
        faster=self.hear()
        self.assertTrue(all(a>b for a,b in zip(faster['gaps'],faster['gaps'][1:])))
        self.assertTrue(all(peak==.075 for peak in faster['peaks']))
        self.answer_step('tempo',5);slower=self.hear()
        self.assertTrue(all(a<b for a,b in zip(slower['gaps'],slower['gaps'][1:])))
        self.assertEqual(faster['peaks'],slower['peaks'])
        self.page.locator('#classroomClose').click();self.assertFalse(self.page.evaluate('roomUI.getState().audioPlaying'))

    def test_each_lesson_requires_a_saved_quiz_pass_and_replays_without_extra_rewards(self):
        for lesson in ANSWERS:
            self.open_lesson(lesson);self.finish_steps(lesson)
            self.assertEqual(self.state()['active']['phase'],'quiz')
            self.assertNotIn(lesson,self.state()['completed'])
            answer_quiz(self.page,lesson,wrong=(0,1),finish=False)
            self.assertEqual(self.page.locator('[data-quiz-finish]').count(),0)
            self.page.locator('[data-quiz-retry]').click()
            for _ in range(2):
                choice=self.state()['active']['quiz']['question']['correct']
                self.page.locator('[data-quiz-answer="'+str(choice)+'"]').click();self.page.locator('[data-quiz-next]').click()
            self.load();self.open_lesson(lesson)
            self.assertEqual(self.state()['active']['quiz']['index'],2)
            for _ in range(3):
                choice=self.state()['active']['quiz']['question']['correct']
                self.page.locator('[data-quiz-answer="'+str(choice)+'"]').click();self.page.locator('[data-quiz-next]').click()
            self.page.locator('[data-quiz-finish]').click()
            self.assertIn(lesson,self.state()['completed'])
            self.assertEqual(self.page.evaluate('rewards'),[{'id':lesson,'amount':50}])
            self.page.locator('[data-tutorial-replay]').click();self.finish_steps(lesson);answer_quiz(self.page,lesson)
            self.assertEqual(self.page.evaluate('rewards'),[{'id':lesson,'amount':50}])
            self.load();self.open_lesson(lesson)
            self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.page.evaluate('rewards'),[])

    def test_every_expression_page_fits_phone_and_short_landscape_with_touch_targets(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            for lesson in ANSWERS:
                self.page.evaluate("localStorage.removeItem('codaClassroomLessonsV1');localStorage.removeItem('codaClassroomQuizzesV1')")
                self.open_lesson(lesson)
                for index in range(8):
                    self.assertNotRegex(self.page.locator('.classroom-tutorial').inner_text(),r'\b[A-G][♯♭]?[0-8]\b')
                    self.page.locator('[data-lesson-try]').click()
                    metrics=self.page.locator('.classroom-tutorial').evaluate('''host=>({
                      width:host.clientWidth,scroll:host.scrollWidth,
                      buttons:[...host.querySelectorAll('button')].filter(button=>button.getClientRects().length).map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))})''')
                    self.assertLessEqual(metrics['scroll'],metrics['width']+2,metrics)
                    self.assertTrue(all(button['width']>=44 and button['height']>=48 for button in metrics['buttons']),metrics)
                    self.assertFalse(self.page.locator('#room').evaluate('host=>host.scrollWidth>innerWidth'))
                    self.page.locator('[data-expression-answer="'+str(ANSWERS[lesson][index])+'"]').click();self.page.locator('[data-tutorial-next]').click()
                answer_quiz(self.page,lesson)


if __name__=='__main__':unittest.main(verbosity=2)
