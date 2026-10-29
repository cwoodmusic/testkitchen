"""Real answer clicks through pooled lesson quizzes, reloads and deliberate retries."""
import json
import mimetypes
from pathlib import Path
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
BASE='https://cwoodmusic.github.io/coda-arcade/'
HARNESS='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="classroom-quiz.css"><link rel="stylesheet" href="music-notation.css">
<style>body{background:#211b35;color:#fff;padding:15px;font:18px system-ui}main{max-width:650px;margin:auto}button{min-height:44px}</style>
<main id="host"></main><script src="music-notation.js"></script><script src="classroom-quiz-pool.js"></script><script src="classroom-quiz.js"></script><script>
window.passes=0;window.game=CodaClassroomQuiz.create({host,lessonId:'note-naming',seed:7,onPassed:()=>passes++});game.render();
</script>'''

class RandomQuizBrowserTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':900,'height':850});self.context.route('https://**/*',lambda route:route.abort());self.context.route(BASE+'**',self.route)
  self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.goto(BASE+'pooled-quiz-test.html',wait_until='domcontentloaded')
 def route(self,route):
  path=urlparse(route.request.url).path.removeprefix('/coda-arcade/')
  if path=='pooled-quiz-test.html':return route.fulfill(status=200,content_type='text/html',body=HARNESS)
  file=(ROOT/path).resolve()
  if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing fixture asset')
  route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
 def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
 def state(self):return self.page.evaluate('game.getState()')
 def answer(self,wrong=False):
  state=self.state();correct=state['question']['correct'];choice=(correct+1)%len(state['question']['answers']) if wrong else correct
  self.page.locator('[data-quiz-answer="'+str(choice)+'"]').click();return choice
 def complete(self,wrong=()):
  selected={}
  for index in range(5):
   slot=self.state()['slotIndex'];selected[slot]=self.answer(index in wrong);self.page.locator('[data-quiz-next]').click()
  return selected
 def test_real_question_and_choice_order_grades_actual_choices_and_keeps_first_answer(self):
  first=self.state();self.assertNotEqual(first['questionOrder'],[0,1,2,3,4])
  self.assertEqual(self.page.locator('[data-quiz-answer]').evaluate_all('items=>items.map(item=>Number(item.dataset.quizAnswer))'),first['answerOrder'])
  selected=self.complete(wrong=(1,));self.assertEqual(self.state()['score'],4);self.assertTrue(self.state()['passed'])
  official=self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomQuiz.KEY)).quizzes["note-naming"]')
  self.assertEqual(official['answers'],[selected[i] for i in range(5)])
  self.page.locator('[data-quiz-finish]').click();self.assertEqual(self.page.evaluate('passes'),1)
 def test_reload_resumes_same_random_questions_choices_and_wrong_answer_feedback(self):
  self.answer();self.page.locator('[data-quiz-next]').click();self.answer(wrong=True)
  before=self.state();feedback=self.page.locator('.classroom-quiz-feedback').inner_text();self.page.reload(wait_until='domcontentloaded');after=self.state()
  for key in ['questionIds','questionOrder','answerOrder','answers','index','score','question']:self.assertEqual(after[key],before[key])
  self.assertEqual(self.page.locator('.classroom-quiz-feedback').inner_text(),feedback)
  self.assertEqual(self.page.locator('[data-quiz-answer]').count(),0)
 def test_retry_draws_new_questions_without_inventing_lesson_rewards(self):
  self.complete();before=self.state();official=self.page.evaluate('localStorage.getItem(CodaClassroomQuiz.KEY)')
  self.page.locator('[data-quiz-retry]').click();after=self.state()
  self.assertNotEqual(sorted(after['questionIds']),sorted(before['questionIds']),'A retry must change actual pooled questions, not just their order.')
  self.assertNotEqual([after['questionIds'],after['questionOrder'],after['answerOrder']],[before['questionIds'],before['questionOrder'],before['answerOrder']])
  self.assertEqual(after['bestScore'],5);self.assertFalse(after['passed']);self.assertEqual(self.page.evaluate('localStorage.getItem(CodaClassroomQuiz.KEY)'),official)
  self.assertIsNone(self.page.evaluate('localStorage.getItem("codaPlayerProgressV1")'))
  self.page.set_viewport_size({'width':390,'height':844});self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)

if __name__=='__main__':unittest.main(verbosity=2)
