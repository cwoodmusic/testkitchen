"""Authored pictures reach lesson, quiz, and exam runtime without the editor."""
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
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/classroom-tutorials.css"><link rel="stylesheet" href="/classroom-quiz.css"><link rel="stylesheet" href="/education-notation.css"><link rel="stylesheet" href="/final-exam.css">
<style>*{box-sizing:border-box}body{margin:0;padding:12px;background:#17243c}#mount{max-width:700px;margin:auto}</style><div id="mount"></div>
<script src="/music-notation.js"></script><script src="/education-notation.js"></script><script src="/classroom-keyboard.js"></script><script src="/classroom-quiz-pool.js"></script><script src="/classroom-quiz.js"></script><script src="/time-signature-lesson.js"></script><script src="/classroom-tutorials.js"></script><script src="/final-exam-bank.js"></script><script src="/education-content.js"></script><script src="/final-exam.js"></script>
<script>
window.content=CodaEducationContent.setStore(CodaEducationContent.createStore({storage:localStorage,canEdit:()=>true}));
window.keyboard={kind:'keyboard',notes:['C','C-sharp']};window.clef={kind:'clef-intro',clef:'bass',page:'clef'};
window.notes={kind:'notation',score:{version:1,clef:'treble',meter:null,items:[{type:'note',position:2,duration:1,dots:0,accidental:'none',staff:'treble'}]}};
const data=content.getDocument();
data.lessons['note-naming'].steps[0].visual=keyboard;data.lessons['note-naming'].steps[0].visuals=[clef,notes];data.lessons['note-naming'].steps[0].example='My keyboard example stays visible.';
data.quizzes['note-naming'].questions.forEach(question=>{question.visual=keyboard;question.visuals=[clef,notes];});
data.exam.questions=data.exam.questions.filter((question,index)=>index%100<5).map(question=>({...question,visual:keyboard,visuals:[clef,notes]}));
const saved=content.saveDocument(data);if(!saved.ok)throw Error(saved.error);
window.showTutorial=()=>{window.ui?.destroy();window.ui=CodaClassroomTutorials.create({host:mount,storage:localStorage});ui.open('note-naming');};
window.showQuiz=()=>{window.ui?.destroy();window.ui=CodaClassroomQuiz.create({host:mount,lessonId:'note-naming',storage:localStorage,randomize:false});ui.render();};
window.showExam=()=>{window.ui?.destroy();window.ui=CodaFinalExam.create({host:mount,storage:localStorage});ui.open();};
window.ready=true;
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path == '/visual-runtime-fixture':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif self.path == '/favicon.ico':
            self.send_response(204); self.end_headers()
        else:
            super().do_GET()


class EducationVisualRuntimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop(); cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':390, 'height':844})
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page(); self.errors = []; self.failed = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failed.append(response.url) if response.status >= 400 else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/visual-runtime-fixture')
        self.page.wait_for_function('window.ready')

    def tearDown(self):
        self.context.close(); self.assertEqual(self.errors, []); self.assertEqual(self.failed, [])

    def assert_pictures(self, selector):
        host = self.page.locator(selector)
        self.assertEqual(host.locator('svg.lesson-piano-keyboard').count(), 1)
        self.assertEqual(host.locator('svg[data-clef="bass"]').count(), 1)
        self.assertEqual(host.locator('svg.education-score').count(), 1)

    def test_legacy_step_replaces_static_keyboard_but_keeps_example_and_answer_controls(self):
        self.page.evaluate('showTutorial()')
        self.assert_pictures('.lesson-authored-visuals')
        self.assertEqual(self.page.locator('.lesson-naming-example').count(), 0)
        self.assertIn('My keyboard example stays visible.', self.page.locator('.lesson-content').inner_text())
        self.page.locator('[data-lesson-try]').click()
        self.assert_pictures('.lesson-authored-visuals')
        self.assertGreater(self.page.locator('.lesson-white-key').count(), 0)
        self.page.locator('[data-note-answer="C"]').click()
        self.assertTrue(self.page.evaluate('ui.getState().active.answered'))

    def test_explicit_none_hides_static_image_without_hiding_worked_example(self):
        self.page.evaluate('''()=>{const data=content.getDocument(),step=data.lessons['note-naming'].steps[0];step.visual=null;step.visuals=[];step.hideVisual=true;const saved=content.saveDocument(data);if(!saved.ok)throw Error(saved.error);showTutorial();}''')
        self.assertEqual(self.page.locator('.lesson-naming-example, .lesson-authored-visuals svg').count(), 0)
        self.assertIn('My keyboard example stays visible.', self.page.locator('.lesson-content').inner_text())
        self.page.locator('[data-lesson-try]').click()
        self.assertGreater(self.page.locator('.lesson-white-key').count(), 0)

    def test_lesson_quiz_and_final_exam_show_every_authored_picture(self):
        self.page.evaluate('showQuiz()')
        self.assert_pictures('.classroom-quiz')
        self.page.evaluate('showExam()')
        self.page.locator('[data-exam-start]').click()
        self.assert_pictures('.final-exam-panel')


if __name__ == '__main__':
    unittest.main(verbosity=2)
