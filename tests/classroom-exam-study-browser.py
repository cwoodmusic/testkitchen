"""Real taught-card UI, notation, audio, and save/ownership boundaries."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/education-notation.css"><link rel="stylesheet" href="/classroom-exam-study.css">
<style>body{margin:0;padding:20px;background:#1c2840}#mount{max-width:760px;margin:auto}</style>
<div id="mount"></div><p id="done"></p>
<script src="/music-notation.js"></script><script src="/education-notation.js"></script><script src="/classroom-quiz.js"></script><script src="/classroom-exam-study.js"></script>
<script>
window.allow=true;window.quota=false;window.revision='one';window.finished=0;
window.cards=[
 {id:'meter',title:'Two beats',teach:'Read the two numbers.',example:'Two quarters fill one 2/4 bar.',prompt:'How many beats?',answers:['Two','Three','Four'],correct:0,hint:'The top number tells you two.',visual:{kind:'meter',meter:'2/4'}},
 {id:'tie',title:'Join lengths',teach:'A tie holds one sound.',example:'Hold 2 + 1 beats without playing again.',prompt:'What does a tie do?',answers:['Play two attacks','Hold one sound','Make silence'],correct:1,hint:'Keep holding.',visual:{kind:'tie',meter:'4/4',notes:[{beats:2},{beats:1}]}},
 {id:'compare',title:'Compare notes',teach:'A whole note lasts longer.',example:'Whole: 4. Half: 2.',prompt:'Which is longer?',answers:['They match','A half note','A whole note'],correct:2,hint:'Four is longer than two.',visual:{kind:'rhythm',meter:'4/4',notes:[{beats:4},{beats:2}]}}
];
const store={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(quota)throw Error('quota');localStorage.setItem(key,value);}};
window.studyUI=CodaClassroomExamStudy.create({host:mount,lessonId:'rhythm-tree',cards,storage:store,revision,getRevision:()=>revision,canRecord:()=>allow,onComplete:()=>{finished++;done.textContent='Finished';}});studyUI.open();
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] != '/study-fixture':
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HTML.encode())


class ExamStudyBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1100, 'height':950})
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.missing = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.missing.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/study-fixture')
        self.page.wait_for_function('window.studyUI&&document.fonts.check("64px CodaBravura")')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.missing, [])

    def state(self):
        return self.page.evaluate('studyUI.getState()')

    def answer(self, index=None):
        self.page.locator('[data-study-try]').click()
        if index is None:
            index=self.page.evaluate('cards[studyUI.getState().index].correct')
        self.page.locator('[data-study-answer="'+str(index)+'"]').click()

    def test_teaches_before_testing_and_shows_real_meter_tie_and_readable_comparison(self):
        meter=self.page.locator('.exam-study-meter')
        self.assertIn(chr(0xe082),meter.text_content())
        self.assertIn(chr(0xe084),meter.text_content())
        self.assertEqual(self.page.locator('[data-study-answer]').count(),0)
        self.answer(1)
        self.assertFalse(self.state()['answered'])
        self.assertIn('Try again',self.page.locator('.exam-study-feedback').inner_text())
        self.page.locator('[data-study-answer="0"]').click()
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['index'],1)
        self.assertTrue(self.page.locator('.exam-study-tie').is_visible())
        self.assertEqual(self.page.locator('.exam-study-tie svg').count(),2)
        self.page.locator('[data-study-listen]').click()
        self.assertIn('One held sound',self.page.locator('.exam-study-audio-status').inner_text())
        self.page.locator('[data-study-try]').click()
        self.assertEqual(self.page.locator('[data-study-answer]').first.get_attribute('data-study-answer'),'1')
        self.page.locator('[data-study-answer="1"]').click()
        self.page.locator('[data-study-next]').click()
        self.assertTrue(self.page.locator('.exam-study-note-examples').is_visible())
        self.assertIn('Compare their lengths',self.page.locator('figcaption').inner_text())
        self.assertEqual(self.page.locator('.education-score').count(),0,'Six beats must not be pictured as one 4/4 bar')
        self.answer()
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.page.evaluate('finished'),1)
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.page.evaluate('finished'),1)

    def test_failed_save_retries_without_advancing_or_losing_the_correct_answer(self):
        self.page.evaluate('quota=true')
        self.answer()
        self.assertTrue(self.state()['answered'])
        self.assertFalse(self.state()['saved'])
        self.assertTrue(self.page.locator('[data-study-next]').is_disabled())
        self.assertTrue(self.page.locator('[data-study-save]').is_visible())
        self.page.evaluate('quota=false')
        self.page.locator('[data-study-save]').click()
        self.assertFalse(self.page.locator('[data-study-next]').is_disabled())
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['index'],1)
        self.page.reload()
        self.assertEqual(self.state()['index'],1)
        self.assertEqual(self.state()['passed'],['meter'])

    def test_changed_profile_or_content_keeps_the_old_attempt_readonly(self):
        for guard in ['allow=false', 'revision="two"']:
            self.page.reload()
            self.page.locator('[data-study-try]').click()
            before=self.page.evaluate('localStorage.getItem(CodaClassroomExamStudy.KEY)')
            self.page.evaluate(guard)
            self.page.locator('[data-study-answer="0"]').click()
            self.assertEqual(self.page.evaluate('localStorage.getItem(CodaClassroomExamStudy.KEY)'),before)
            self.assertFalse(self.state()['answered'])
            self.assertEqual(self.page.evaluate('finished'),0)

    def test_phone_cards_keep_large_text_and_touch_controls_inside_the_viewport(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertGreaterEqual(self.page.locator('.exam-study-teach').evaluate('node=>parseFloat(getComputedStyle(node).fontSize)'),20)
        self.page.locator('[data-study-try]').click()
        for button in self.page.locator('[data-study-answer]').all():
            box=button.bounding_box()
            self.assertGreaterEqual(box['height'],48)
            self.assertGreaterEqual(box['x'],0)
            self.assertLessEqual(box['x']+box['width'],391)
        self.page.screenshot(path='/tmp/classroom-exam-study-phone.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
