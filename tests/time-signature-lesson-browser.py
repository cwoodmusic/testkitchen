"""The actual classroom lesson teaches grouping, notation, and three matching bars."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
import sys
sys.dont_write_bytecode=True
from classroom_quiz_helpers import answer_quiz
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/time-fixture':return super().do_GET()
        html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-classroom.css"><link rel="stylesheet" href="/classroom-tutorials.css"><link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/time-signature-lesson.css">
<button id="enter">Classroom</button><section id="room" hidden></section>
<script src="/character-renderer.js"></script><script src="/music-notation.js"></script><script src="/time-signature-lesson.js"></script><link rel="stylesheet" href="/classroom-quiz.css"><script src="/classroom-quiz.js"></script><script src="/classroom-tutorials.js"></script><script src="/music-classroom.js"></script>
<script>window.writeFail=false;window.writeFailLesson=false;window.writeFailQuiz=false;window.rewards=[];const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(writeFail||(writeFailLesson&&key==='codaClassroomLessonsV1')||(writeFailQuiz&&key==='codaClassroomQuizzesV1'))throw Error('quota');localStorage.setItem(key,value);}};
window.roomUI=createCodaMusicClassroom({host:room,renderer:createCodaCharacterRenderer(),storage,onTutorialComplete:(id)=>{const key='claimed:'+id;if(localStorage.getItem(key))return {ok:true,alreadyAwarded:true,amount:0};localStorage.setItem(key,'yes');rewards.push(id);return {ok:true,amount:50};}});enter.onclick=()=>roomUI.open();</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())
class TimeSignatureLessonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1250,'height':1000});self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.url=f'http://127.0.0.1:{self.server.server_port}/time-fixture';self.load()
    def tearDown(self):self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])
    def load(self):
        self.page.goto(self.url);self.page.locator('#enter').click();self.open_lesson()
        self.page.wait_for_function('CodaMusicNotation.isReady()')
    def open_lesson(self):
        back=self.page.locator('#classroomAllLessons')
        if back.is_visible():back.click()
        if not self.page.locator('#classroomStart').is_visible():self.page.evaluate("roomUI.selectTopic('welcome',true)")
        self.page.locator('[data-start-lesson="time-signatures"]').click()
    def state(self):return self.page.evaluate('roomUI.getState().tutorials')
    def try_step(self):
        button=self.page.locator('[data-signature-try]')
        if button.is_visible():button.click()
    def answer(self,index):
        self.try_step();self.page.locator('[data-signature-answer="'+str(index)+'"]').click()
    def next(self):self.page.locator('[data-tutorial-next]').click()
    def build(self,value,count,check=True):
        self.try_step()
        for _ in range(count):self.page.locator('[data-signature-add="'+str(value)+'"]').click()
        if check:self.page.locator('[data-signature-check]').click()
    def through_six(self):
        self.answer(0);self.next();self.answer(1);self.next();self.build(1,4);self.next();self.answer(2);self.next();self.answer(0);self.next();self.build(.5,6);self.next()
    def finish(self):
        self.through_six();self.answer(1);self.next();self.build(2,2);self.next();answer_quiz(self.page,'time-signatures')
    def test_correct_answers_and_all_three_note_recipes_are_required_before_saved_completion(self):
        self.assertEqual(self.state()['active']['learningStage'],'look')
        self.assertEqual(self.page.locator('[data-signature-answer]').count(),0)
        self.answer(1);self.assertFalse(self.state()['active']['answered']);self.assertEqual(self.page.evaluate('rewards'),[])
        self.answer(0);self.next();self.answer(1);self.next()
        self.build(1,3,check=False);self.assertEqual(self.page.locator('[data-signature-check]').count(),0)
        self.assertFalse(self.state()['active']['answered'])
        self.page.locator('[data-signature-undo]').click();self.assertEqual(len(self.state()['active']['timeSignatures']['bar']),2)
        self.build(1,2);self.next();self.answer(2);self.next()
        self.page.locator('[data-signature-listen="6/8"]').click();self.assertTrue(self.state()['active']['audioPlaying'])
        schedule=self.state()['active']['timeSignatures']['schedule'];self.assertEqual(len(schedule),12);self.assertEqual(sum(item['primary'] for item in schedule),4)
        self.try_step();self.assertFalse(self.state()['active']['audioPlaying'])
        self.answer(2);self.assertFalse(self.state()['active']['answered']);self.answer(0);self.next()
        self.build(.5,6);self.next();self.answer(1);self.next();self.build(2,2);self.next()
        self.assertEqual(self.state()['active']['phase'],'quiz');self.assertEqual(self.page.evaluate('rewards'),[])
        answer_quiz(self.page,'time-signatures')
        self.assertIn('time-signatures',self.state()['completed']);self.assertEqual(self.page.evaluate('rewards'),['time-signatures'])
        self.load();self.assertTrue(self.state()['active']['complete']);self.assertIn('already earned',self.page.locator('.tutorial-feedback').inner_text())
        self.page.locator('[data-tutorial-replay]').click();self.finish();self.assertEqual(self.page.evaluate('rewards'),[])
    def test_partial_lesson_resumes_and_failed_final_save_can_be_retried(self):
        self.answer(0);self.next();self.answer(1);self.next();self.assertEqual(self.state()['active']['step'],2)
        self.load();self.assertEqual(self.state()['active']['step'],2)
        self.build(1,4);self.next();self.answer(2);self.next();self.answer(0);self.next();self.build(.5,6);self.next();self.answer(1);self.next();self.build(2,2);self.next()
        self.page.evaluate('writeFailLesson=true');answer_quiz(self.page,'time-signatures')
        self.assertEqual(self.page.evaluate('rewards'),[]);self.assertNotIn('time-signatures',self.state()['completed'])
        self.page.evaluate('writeFailLesson=false');self.page.get_by_role('button',name='Save again',exact=True).click()
        self.assertIn('time-signatures',self.state()['completed']);self.assertEqual(self.page.evaluate('rewards'),['time-signatures'])
    def test_examples_and_guided_recipe_make_the_next_action_clear(self):
        self.assertEqual(self.state()['active']['learningStage'],'look')
        self.assertLessEqual(len(self.page.locator('.time-signature-activity').inner_text().split()),35)
        self.assertEqual(self.page.locator('[data-signature-answer]').count(),0)
        self.try_step();self.page.locator('[data-signature-hint]').click()
        self.assertTrue(self.page.locator('.signature-hint').is_visible());self.assertFalse(self.state()['active']['answered'])
        self.answer(0);self.next();self.answer(1);self.next();self.try_step()
        self.assertEqual(self.page.locator('.signature-target-slot.is-empty').count(),4)
        self.assertEqual(self.page.locator('[data-signature-add]:visible').count(),1)
        self.assertGreaterEqual(self.page.locator('.signature-primary-note button').bounding_box()['height'],48)
        self.build(1,3,check=False);self.assertFalse(self.state()['active']['answered'])
        self.assertEqual(self.page.locator('[data-signature-check]').count(),0)
        self.page.locator('[data-signature-add="1"]').click()
        self.assertEqual(self.page.locator('.signature-target-slot.is-filled').count(),4)
        self.assertTrue(self.page.locator('[data-signature-check]').is_visible())
        self.page.locator('[data-signature-check]').click()
        self.assertTrue(self.state()['active']['answered']);self.assertEqual(self.page.locator('[data-signature-add]').count(),0)
        self.assertFalse(self.page.locator('[data-tutorial-next]').is_disabled())
    def test_mobile_controls_notation_and_audio_stop_fit_both_orientations(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.evaluate("localStorage.removeItem('codaClassroomLessonsV1')");self.open_lesson()
            self.assertEqual(self.page.locator('.signature-symbol').get_attribute('aria-label'),'4/4 time signature')
            self.page.locator('[data-signature-listen="4/4"]').click();self.assertTrue(self.state()['active']['audioPlaying'])
            self.try_step();self.assertFalse(self.state()['active']['audioPlaying'])
            self.answer(0);self.next();self.answer(1);self.next();self.build(1,4);self.next();self.answer(2);self.next();self.answer(0);self.next();self.build(.5,6)
            geometry=self.page.locator('.classroom-tutorial').evaluate('(host)=>({width:host.clientWidth,scroll:host.scrollWidth,buttons:[...host.querySelectorAll("button")].filter(button=>button.getClientRects().length).map(button=>button.getBoundingClientRect().height)})')
            self.assertLessEqual(geometry['scroll'],geometry['width']+2);self.assertTrue(all(height>=48 for height in geometry['buttons']),geometry)
            self.assertFalse(self.page.locator('#room').evaluate('(host)=>host.scrollWidth>innerWidth'))
        self.page.locator('.classroom-tutorial').screenshot(path='/tmp/music48-meter-legacy.png')
if __name__=='__main__':unittest.main(verbosity=2)
