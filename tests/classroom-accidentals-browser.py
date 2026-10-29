"""Supplemental lesson, notation, quiz, and save/reward recovery in Chromium."""
import json
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
BASE='https://cwoodmusic.github.io/coda-arcade/'
HARNESS='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="music-notation.css"><link rel="stylesheet" href="education-notation.css"><link rel="stylesheet" href="classroom-exam-study.css"><link rel="stylesheet" href="classroom-quiz.css">
<style>body{margin:0;padding:20px;background:#18213b}#lesson{max-width:800px;margin:auto;min-width:0}</style>
<main id="lesson"></main><script src="music-notation.js"></script><script src="education-notation.js"></script><script src="classroom-quiz-pool.js"></script><script src="classroom-quiz.js"></script><script src="classroom-exam-study.js"></script><script src="classroom-accidentals-lesson.js"></script><script>
window.allowRecord=true;window.rewardFail=false;window.rewardCalls=[];
localStorage.setItem('codaClassroomLessonsV1','original core lessons');localStorage.setItem('codaClassroomQuizzesV1','original core quizzes');localStorage.setItem('codaHaydnFinalExamV1','original exam');
window.makeLesson=()=>CodaAccidentalsLesson.create({host:document.querySelector('#lesson'),storage:localStorage,canRecord:()=>allowRecord,onComplete:(id,details)=>{rewardCalls.push({id,details});return rewardFail?{ok:false,error:'Please retry your reward.'}:{ok:true,amount:50}},onExit:()=>window.exited=true});
window.lesson=makeLesson();lesson.open();
</script>'''

class AccidentalsBrowserTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.p.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1100,'height':1000});self.context.route('https://**/*',lambda route:route.abort());self.context.route(BASE+'**',self.route)
  self.page=self.context.new_page();self.errors=[];self.missing=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.on('response',lambda response:self.missing.append(response.url) if response.status>=400 and response.url.startswith(BASE) else None)
  self.page.goto(BASE+'accidentals-test.html',wait_until='domcontentloaded');self.page.wait_for_function('window.lesson?.getState().study.total===16')
 def route(self,route):
  path=urlparse(route.request.url).path.removeprefix('/coda-arcade/')
  if path=='accidentals-test.html':return route.fulfill(status=200,content_type='text/html',body=HARNESS)
  file=(ROOT/path).resolve()
  if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing local test resource')
  route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
 def tearDown(self):
  self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.missing,[])
 def state(self):return self.page.evaluate('lesson.getState()')
 def finish_study(self):
  for i in range(16):
   self.assertEqual(self.state()['study']['index'],i);self.page.locator('[data-study-try]').click()
   correct=self.page.evaluate('CodaAccidentalsLesson.CARDS[lesson.getState().study.index].correct');self.page.locator('[data-study-answer="'+str(correct)+'"]').click();self.page.locator('[data-study-next]').click()
  self.assertEqual(self.state()['phase'],'quiz')
 def finish_quiz(self,miss_one=False):
  for i in range(5):
   correct=self.page.evaluate('lesson.getState().quiz.question.correct')
   if miss_one and i==0:correct=(correct+1)%3
   self.page.locator('[data-quiz-answer="'+str(correct)+'"]').click();self.page.locator('[data-quiz-next]').click()
  self.assertTrue(self.state()['quiz']['passed']);self.page.locator('[data-quiz-finish]').click()
 def test_all_cards_then_four_of_five_save_reward_once_without_overwriting_core_progress(self):
  self.finish_study();self.finish_quiz(miss_one=True);self.page.wait_for_function('lesson.getState().completedAt>0')
  self.assertEqual(self.state()['quiz']['score'],4);self.assertEqual(self.page.evaluate('rewardCalls.length'),1)
  self.assertEqual(self.page.evaluate('localStorage.getItem("codaClassroomLessonsV1")'),'original core lessons');self.assertEqual(self.page.evaluate('localStorage.getItem("codaClassroomQuizzesV1")'),'original core quizzes');self.assertEqual(self.page.evaluate('localStorage.getItem("codaHaydnFinalExamV1")'),'original exam')
  self.page.evaluate('lesson.destroy();lesson=makeLesson();lesson.open()');self.assertEqual(self.state()['phase'],'complete');self.assertEqual(self.page.evaluate('rewardCalls.length'),1)
  self.page.locator('[data-accidentals-exit]').click();self.assertTrue(self.page.evaluate('exited'))
 def test_reward_failure_and_local_save_failure_keep_retry_available(self):
  self.finish_study();self.page.evaluate('rewardFail=true');self.finish_quiz();self.page.wait_for_function('!lesson.getState().claiming')
  self.assertEqual(self.state()['completedAt'],0);self.assertIn('Please retry',self.page.locator('#lesson').inner_text())
  self.page.evaluate('''()=>{rewardFail=false;window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===CodaClassroomQuiz.CUSTOM_KEY&&value.includes('rewardedAt'))throw Error('quota');return originalSet.call(this,key,value)}}''')
  self.page.locator('[data-accidentals-save]').click();self.page.wait_for_function('!lesson.getState().claiming');self.assertEqual(self.state()['completedAt'],0)
  self.assertTrue(self.page.locator('[data-accidentals-save]').is_enabled());self.page.evaluate('()=>{Storage.prototype.setItem=originalSet;}');self.page.locator('[data-accidentals-save]').click();self.page.wait_for_function('lesson.getState().completedAt>0')
  self.assertEqual(self.state()['phase'],'complete');self.assertEqual(self.page.evaluate('rewardCalls.length'),3)
 def test_signature_font_order_phone_scroll_and_paused_profile_are_safe(self):
  # Reopen a saved study at the first key-signature picture.
  self.page.evaluate('''()=>{lesson.destroy();const cards=CodaAccidentalsLesson.CARDS;const revision=CodaClassroomExamStudy.revisionOf([cards,CodaAccidentalsLesson.QUIZ]);localStorage.setItem(CodaClassroomExamStudy.KEY,JSON.stringify({version:1,lessons:{'accidentals-key-signatures':{revision,index:7,passed:cards.slice(0,7).map(x=>x.id)}}}));lesson=makeLesson();lesson.open()}''')
  self.assertTrue(self.page.locator('[data-key-signature="G"]').is_visible());self.assertTrue(self.page.evaluate("async()=>{await CodaMusicNotation.load(document);return document.fonts.check('64px CodaBravura')}"))
  self.page.set_viewport_size({'width':390,'height':844});self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  svg=self.page.locator('.accidentals-signature-score');self.assertGreaterEqual(svg.bounding_box()['width'],480)
  self.page.screenshot(path='/tmp/accidentals-lesson-phone.png',full_page=True)
  before=self.page.evaluate('localStorage.getItem(CodaClassroomExamStudy.KEY)');self.page.evaluate('allowRecord=false');self.page.locator('[data-study-try]').click();self.assertEqual(self.state()['study']['stage'],'look');self.assertEqual(self.page.evaluate('localStorage.getItem(CodaClassroomExamStudy.KEY)'),before)

if __name__=='__main__':unittest.main(verbosity=2)
