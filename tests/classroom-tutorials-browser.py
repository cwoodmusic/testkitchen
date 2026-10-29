"""Teach and answer the real classroom lessons, including saved/mobile flows."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
import sys
sys.dont_write_bytecode=True
from classroom_quiz_helpers import answer_quiz
from exam_study_helpers import finish_note_reminders
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/lesson-fixture':return super().do_GET()
        html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-classroom.css"><link rel="stylesheet" href="/classroom-tutorials.css">
<button id="enter">Classroom</button><section id="room" hidden></section>
<script src="/character-renderer.js"></script><link rel="stylesheet" href="/music-notation.css"><script src="/music-notation.js"></script><link rel="stylesheet" href="/time-signature-lesson.css"><script src="/time-signature-lesson.js"></script><link rel="stylesheet" href="/classroom-quiz.css"><script src="/classroom-quiz-pool.js"></script><script src="/classroom-quiz.js"></script><script src="/classroom-tutorials.js"></script><script src="/finger-follow.js"></script><script src="/cave-camera.js"></script><script src="/music-classroom.js"></script>
<script>window.writeFail=false;window.writeFailLesson=false;window.writeFailQuiz=false;window.rewards=[];window.calls=[];
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(writeFail||(writeFailLesson&&key==='codaClassroomLessonsV1')||(writeFailQuiz&&key==='codaClassroomQuizzesV1'))throw Error('quota');localStorage.setItem(key,value);}};
window.roomUI=createCodaMusicClassroom({host:room,renderer:createCodaCharacterRenderer(),storage,onTutorialComplete:(id,details)=>{calls.push({id,details});const claimed=JSON.parse(localStorage.getItem('fixtureLessonClaims')||'[]');if(claimed.includes(id))return {ok:true,alreadyAwarded:true,amount:0};claimed.push(id);localStorage.setItem('fixtureLessonClaims',JSON.stringify(claimed));rewards.push({id,amount:50});return {ok:true,amount:50};}});enter.onclick=()=>roomUI.open();</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())

class ClassroomTutorialTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1250,'height':1000});self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.url=f'http://127.0.0.1:{self.server.server_port}/lesson-fixture';self.load()
    def load(self):
        self.page.goto(self.url);self.page.locator('#enter').click();self.page.wait_for_function('roomUI.getState().open')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])
    def open_lesson(self,id):
        if self.page.locator('#classroomAllLessons').is_visible():self.page.locator('#classroomAllLessons').click()
        if not self.page.locator('#classroomStart').is_visible():self.page.evaluate("roomUI.selectTopic('welcome',true)")
        self.page.locator('[data-start-lesson="'+id+'"]').click()
    def state(self):return self.page.evaluate('roomUI.getState().tutorials')
    def try_step(self):
        finish_note_reminders(self.page)
        button=self.page.locator('[data-lesson-try]')
        if button.is_visible():button.click()
    def answer(self,letter):
        self.try_step();self.page.locator('.classroom-tutorial [data-note-answer="'+letter+'"]').first.click()
    def next(self):self.page.locator('[data-tutorial-next]').click()
    def finish_naming(self,quiz=True):
        for letter in ['C','F','D','A','E','F','G','A','B','C']:
            self.answer(letter);self.next()
        if quiz:answer_quiz(self.page,'note-naming')
    def test_note_naming_teaches_keys_then_staff_and_rewards_only_correct_completion(self):
        self.open_lesson('note-naming');self.assertEqual(self.state()['active']['learningStage'],'look')
        self.assertTrue(self.page.locator('[data-note-example="keys"] svg').is_visible())
        self.assertEqual(self.page.locator('[data-note-answer]').count(),0)
        self.try_step();self.page.locator('[data-note-hint]').click()
        self.assertEqual(self.page.locator('.lesson-white-key.is-hint').count(),1)
        self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
        self.assertEqual(self.state()['active']['step'],0,'A hint does not answer or advance saved progress')
        self.answer('F');self.assertEqual(self.page.locator('.tutorial-feedback').get_attribute('data-correct'),'false')
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertEqual(self.page.locator('.lesson-white-key').count(),4,'Start with a small, readable group of keys')
        self.finish_naming();self.assertIn('note-naming',self.state()['completed'])
        self.assertEqual(self.page.evaluate('rewards'),[{'id':'note-naming','amount':50}])
        self.page.locator('[data-tutorial-replay]').click();self.finish_naming();self.assertEqual(len(self.page.evaluate('rewards')),1)
        self.load();self.open_lesson('note-naming');self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertNotRegex(self.page.locator('#classroomBook').inner_text(),r'\b[A-G][0-8]\b')

    def test_rhythm_tree_requires_exploration_equivalence_and_any_four_beat_bar(self):
        self.open_lesson('rhythm-tree');self.assertEqual(self.state()['active']['learningStage'],'explore')
        self.assertEqual(self.page.locator('.lesson-split-picture svg').count(),1)
        for _ in range(4):self.page.locator('[data-tree-split]').click()
        self.assertEqual(self.state()['active']['treeLevel'],4)
        self.assertEqual(self.page.locator('.lesson-split-picture svg').count(),3)
        self.assertIn('2 sixteenth notes',self.page.locator('.lesson-tree-caption').inner_text())
        self.assertIn('half a count',self.page.locator('.lesson-tree-caption').inner_text())
        self.page.get_by_role('button',name='Listen',exact=True).click()
        self.page.wait_for_function("!!document.querySelector('[data-tree-level=\"4\"].is-playing')")
        self.assertTrue(self.state()['active']['audioPlaying'])
        self.page.get_by_text('Go back',exact=True).click();self.page.locator('[data-tree-join]').click()
        self.assertEqual(self.state()['active']['treeLevel'],3);self.assertFalse(self.state()['active']['audioPlaying'])
        self.page.locator('[data-tree-split]').click();self.next();self.try_step()
        self.page.locator('[data-rhythm-answer="3"]').click();self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
        self.page.locator('[data-rhythm-answer="2"]').click();self.next();self.try_step()
        self.page.locator('[data-rhythm-answer="2"]').click();self.next();self.try_step()
        self.assertEqual(self.page.locator('[data-add-value]:visible').count(),5)
        self.assertTrue(self.page.locator('[data-check-rhythm]').is_disabled())
        self.page.locator('[data-add-value="16"]').click()
        self.assertFalse(self.page.locator('[data-check-rhythm]').is_disabled())
        self.assertFalse(self.state()['active']['complete'])
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.page.locator('[data-rhythm-clear]').click()
        for units in [4,2,2,8]:
            button=self.page.locator('[data-add-value="'+str(units)+'"]:visible').first
            self.assertFalse(button.is_disabled());button.click()
        self.page.get_by_role('button',name='Listen',exact=True).click();self.assertTrue(self.state()['active']['audioPlaying'])
        self.page.locator('[data-check-rhythm]').click();self.next()
        self.assertFalse(self.state()['active']['audioPlaying']);self.assertEqual(self.state()['active']['phase'],'quiz')
        answer_quiz(self.page,'rhythm-tree')
        self.assertIn('rhythm-tree',self.state()['completed']);self.assertEqual(self.page.evaluate('rewards'),[{'id':'rhythm-tree','amount':50}])

    def test_note_staff_bridge_shows_a_landmark_before_the_first_staff_question(self):
        self.open_lesson('note-naming')
        for letter in ['C','F','D','A']:self.answer(letter);self.next()
        self.assertEqual(self.state()['active']['step'],4)
        self.assertEqual(self.state()['active']['noteReminder'],'staff')
        self.assertEqual(self.page.locator('[data-note-answer]').count(),0)
        finish_note_reminders(self.page)
        self.assertTrue(self.page.locator('[data-note-example="staff"] .staff-note').is_visible())
        self.assertEqual(self.page.locator('[data-note-answer]').count(),0)
        self.try_step();self.assertEqual(self.page.locator('.lesson-letter-answers [data-note-answer]').count(),7)
        self.page.locator('[data-note-hint]').click();self.assertEqual(self.page.locator('.lesson-staff-wrap.is-hint').count(),1)
        self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
        self.answer('E');self.assertFalse(self.page.locator('[data-tutorial-next]').is_disabled())

    def test_bass_clef_teaches_lines_spaces_and_requires_a_saved_end_quiz(self):
        self.open_lesson('bass-clef')
        self.assertEqual(self.state()['active']['noteReminder'],'staff')
        finish_note_reminders(self.page)
        self.assertEqual(self.page.locator('[data-note-example="staff"] [data-staff-clef="bass"]').count(),1)
        self.try_step();self.answer('E');self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
        self.page.locator('[data-note-hint]').click();self.assertTrue(self.page.locator('.tutorial-feedback').inner_text())
        for letter in ['G','B','D','F','A','A','C','E','G']:self.answer(letter);self.next()
        self.assertEqual(self.state()['active']['phase'],'quiz');self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertEqual(self.page.locator('.classroom-quiz-visual [data-staff-clef="bass"]').count(),1)
        answer_quiz(self.page,'bass-clef')
        self.assertIn('bass-clef',self.state()['completed']);self.assertEqual(self.page.evaluate('rewards'),[{'id':'bass-clef','amount':50}])
        self.load();self.open_lesson('bass-clef');self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.page.evaluate('rewards'),[])

    def test_grand_staff_middle_c_uses_both_clefs_and_failed_quiz_never_completes(self):
        self.page.set_viewport_size({'width':390,'height':844});self.open_lesson('grand-staff')
        for index,letter in enumerate(['E','G','A','C','C','C','D','B']):
            self.try_step()
            self.assertEqual(self.page.locator('.lesson-staff-wrap .staff-line').count(),10)
            self.assertEqual(self.page.locator('.lesson-staff-wrap .staff-note').count(),1)
            if index in [4,5]:
                self.assertEqual(self.page.locator('.lesson-staff-wrap .staff-note').get_attribute('data-staff-position'),'-2' if index==4 else '10')
            self.assertFalse(self.page.locator('#room').evaluate('host=>host.scrollWidth>innerWidth'))
            self.answer(letter);self.next()
        answer_quiz(self.page,'grand-staff',wrong=(0,1),finish=False)
        self.assertEqual(self.page.locator('[data-quiz-finish]').count(),0);self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertFalse(self.state()['active']['complete'])
        self.page.locator('[data-quiz-retry]').click();answer_quiz(self.page,'grand-staff')
        self.assertIn('grand-staff',self.state()['completed']);self.assertEqual(self.page.evaluate('rewards'),[{'id':'grand-staff','amount':50}])

    def test_partial_work_resumes_and_leaving_a_lesson_stops_its_audio(self):
        self.open_lesson('note-naming')
        for letter in ['C','F','D','A']:self.answer(letter);self.next()
        self.assertEqual(self.state()['active']['step'],4);self.try_step()
        self.page.get_by_role('button',name='Hear it',exact=True).click();self.assertTrue(self.state()['active']['audioPlaying'])
        self.page.locator('#classroomAllLessons').click();self.assertIsNone(self.state().get('active'))
        self.open_lesson('note-naming');self.assertEqual(self.state()['active']['step'],4);self.assertFalse(self.state()['active']['audioPlaying'])
        self.load();self.open_lesson('note-naming');self.assertEqual(self.state()['active']['step'],4)

    def test_phone_and_landscape_tutorial_controls_fit_and_are_large_enough(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.open_lesson('rhythm-tree')
            for _ in range(4):self.page.locator('[data-tree-split]').click()
            dimensions=self.page.locator('.classroom-tutorial').evaluate('(host)=>({width:host.clientWidth,scroll:host.scrollWidth,buttons:[...host.querySelectorAll("button")].filter(button=>button.getClientRects().length).map(button=>button.getBoundingClientRect().height)})')
            self.assertLessEqual(dimensions['scroll'],dimensions['width']+2);self.assertTrue(all(height>=48 for height in dimensions['buttons']))
            self.assertFalse(self.page.locator('#room').evaluate('(host)=>host.scrollWidth>innerWidth'))

    def test_failed_saving_never_consumes_the_completion_reward(self):
        self.open_lesson('note-naming');self.finish_naming(quiz=False)
        self.assertEqual(self.state()['active']['phase'],'quiz')
        self.page.evaluate('writeFailLesson=true');answer_quiz(self.page,'note-naming')
        self.assertEqual(self.page.evaluate('rewards'),[]);self.assertFalse(self.state()['lessons'][0]['completed'])
        self.page.evaluate('writeFailLesson=false');self.page.get_by_role('button',name='Save again',exact=True).click()
        self.assertIn('note-naming',self.state()['completed']);self.assertEqual(len(self.page.evaluate('rewards')),1)

    def test_mobile_finger_steers_until_release_and_keeps_room_collisions(self):
        self.context.close();self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.page=self.context.new_page();self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.load()
        client=self.context.new_cdp_session(self.page)
        def point(x,y):
            box=self.page.locator('#classroomCanvas').bounding_box()
            camera=self.page.evaluate('roomUI.getState().camera')
            return {'x':box['x']+(x-camera['x'])*camera['zoom']/1000*box['width'],'y':box['y']+(y-camera['y'])*camera['zoom']/600*box['height']}
        def touch(kind,*points):
            client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[dict(value,id=i+1) for i,value in enumerate(points)]})
        touch('touchStart',point(570,510));self.page.wait_for_timeout(350)
        moved=self.page.evaluate('roomUI.getState().player.x');self.assertGreater(moved,535)
        self.assertTrue(self.page.evaluate('roomUI.getState().fingerWalk.following'))
        touch('touchMove',point(self.page.evaluate('roomUI.getState().player.x')-60,510));self.page.wait_for_timeout(200)
        self.assertLess(self.page.evaluate('roomUI.getState().player.x'),moved-20)
        touch('touchEnd');stopped=self.page.evaluate('roomUI.getState().player.x');self.page.wait_for_timeout(200)
        self.assertAlmostEqual(self.page.evaluate('roomUI.getState().player.x'),stopped,delta=.01)
        self.assertFalse(self.page.evaluate('roomUI.getState().fingerWalk.following'))
        # The desk still stops direct finger movement at its lower edge.
        touch('touchStart',point(500,285));self.page.wait_for_timeout(1100)
        self.assertGreaterEqual(self.page.evaluate('roomUI.getState().player.y'),373)
        self.assertLess(self.page.evaluate('roomUI.getState().player.y'),385)
        touch('touchCancel');self.assertFalse(self.page.evaluate('roomUI.getState().fingerWalk.following'))
        # Adding a second map finger stops steering until the entire gesture ends.
        touch('touchStart',point(545,450));self.page.wait_for_timeout(120)
        touch('touchStart',point(545,450),point(455,450));self.assertTrue(self.page.evaluate('roomUI.getState().fingerWalk.suppressed'))
        stopped=self.page.evaluate('roomUI.getState().player.x');self.page.wait_for_timeout(150)
        self.assertAlmostEqual(self.page.evaluate('roomUI.getState().player.x'),stopped,delta=.01)
        touch('touchEnd');client.detach()

if __name__=='__main__':unittest.main(verbosity=2)
