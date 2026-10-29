"""Edited question pools, notation, and rewards on the real exam UI."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

    def do_GET(self):
        if self.path != '/authored-exam-fixture': return super().do_GET()
        html = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:10px;background:#101a2d;font-family:Arial,sans-serif}*{box-sizing:border-box}</style>
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/final-exam.css">
<section id="exam"></section>
<script src="/music-notation.js"></script><script src="/education-notation.js"></script>
<script src="/classroom-quiz.js"></script><script src="/time-signature-lesson.js"></script>
<script src="/classroom-tutorials.js"></script><script src="/final-exam-bank.js"></script>
<script src="/education-content.js"></script><script src="/final-exam.js"></script><script src="/player-progression.js"></script>
<script>
window.content=CodaEducationContent.setStore(CodaEducationContent.createStore({storage:localStorage,canEdit:()=>true}));
if(!content.getState().hasDraft){
 const document=content.getDocument();document.exam.questions=document.exam.questions.filter((question,index)=>index%100<5).map((question,index)=>({...question,prompt:'Edited music question '+index,answers:Array.from({length:2+index%5},(_,i)=>'Answer '+i),correct:1,visual:{kind:'notation',score:{version:1,clef:'grand',meter:'6/8',items:[{type:'repeat-start'},{type:'note',position:0,duration:.5,dots:0,accidental:'sharp',staff:'treble'},{type:'rest',duration:1,dots:0,staff:'bass'},{type:'bar'},{type:'note',position:2,duration:2,dots:1,accidental:'none',staff:'bass'},{type:'repeat-end'}]}}}));
 const result=content.saveDocument(document);if(!result.ok)throw Error(result.error);
}
window.rewards=[];window.rewardFailure=false;window.progression=CodaPlayerProgression.create({storage:localStorage});
window.examUI=CodaFinalExam.create({host:exam,storage:localStorage,onComplete:(id,result)=>{
 if(rewardFailure)return {ok:false,error:'Please retry your completion.'};rewards.push({id,result});return progression.awardXP('achievement:'+id,200,'Passed Haydn’s Final Exam');
}});examUI.open();
window.correctChoice=()=>{const state=examUI.getState(),question=content.getExamBank().getQuestion(state.questionIds[state.index]);return state.orders[state.index].findIndex(index=>question.choices[index].id===question.answer);};
</script>'''
        self.send_response(200);self.send_header('Content-Type', 'text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())


class AuthoredFinalExamBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844});self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/authored-exam-fixture')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def state(self): return self.page.evaluate('examUI.getState()')

    def start(self): self.page.locator('[data-exam-start]').click()

    def choose(self):
        index=self.page.evaluate('correctChoice()');self.page.locator('[data-exam-answer="'+str(index)+'"]').click()

    def answer_all(self):
        counts=set()
        while True:
            counts.add(self.page.locator('[data-exam-answer]').count())
            self.assertTrue(self.page.locator('.final-exam-visual svg').is_visible())
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
            self.choose();last=self.state()['index']==self.state()['total']-1;self.page.locator('[data-exam-next]').click()
            if last: break
        return counts

    def test_saved_edited_questions_render_all_answer_counts_and_notation_and_award_once(self):
        self.assertTrue(self.state()['custom']);self.assertEqual(self.state()['size'],40)
        self.assertTrue(all('5 questions in the pool' in text for text in self.page.locator('.final-exam-categories li').all_inner_texts()))
        self.start();self.choose();saved=self.state()['answers'];self.page.reload();self.assertEqual(self.state()['answers'],saved)
        self.assertEqual(self.answer_all(),{2,3,4,5,6});self.page.locator('[data-exam-submit]').click();self.page.wait_for_function('examUI.getState().completedAt>0')
        self.assertEqual(self.state()['score'],40);self.assertEqual(self.page.evaluate('progression.getState().xp'),200)
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaFinalExam.KEY)'),None,'Canonical question IDs and answers are untouched')
        self.assertEqual(len(self.page.evaluate('rewards')),1);self.page.reload();self.assertEqual(self.state()['score'],40);self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertEqual(self.page.evaluate('progression.getState().xp'),200)

    def test_insufficient_pools_show_actionable_help_and_custom_reward_retry_is_functional(self):
        self.page.locator('[aria-label="Final exam length"]').select_option('80');self.start()
        self.assertEqual(self.state()['phase'],'intro');self.assertIn('needs at least 10',self.page.locator('.final-exam-save-help').inner_text())
        self.page.locator('[aria-label="Final exam length"]').select_option('40');self.start();self.page.evaluate('rewardFailure=true')
        self.answer_all();self.page.locator('[data-exam-submit]').click();self.page.wait_for_function('!examUI.getState().claiming')
        self.assertTrue(self.state()['rewardPending']);self.assertEqual(self.page.evaluate('progression.getState().xp'),0)
        self.page.evaluate('rewardFailure=false');self.page.locator('[data-exam-claim]').click();self.page.wait_for_function('examUI.getState().completedAt>0')
        self.assertEqual(self.page.evaluate('progression.getState().xp'),200);self.assertEqual(len(self.page.evaluate('rewards')),1)

    def test_open_exam_freezes_after_editing_content_and_can_return_without_stale_writes(self):
        self.start();self.choose();before=self.page.evaluate('localStorage.getItem(CodaFinalExam.CUSTOM_KEY)')
        result=self.page.evaluate('''()=>{const document=content.getDocument();document.exam.questions[0].prompt+=' — changed';return content.saveDocument(document)}''')
        self.assertTrue(result['ok']);self.page.locator('[data-exam-answer]').first.click()
        self.assertTrue(self.state()['contentChanged']);self.assertEqual(self.state()['answered'],1)
        self.assertIn('questions changed',self.page.locator('.final-exam-save-help').inner_text())
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaFinalExam.CUSTOM_KEY)'),before)
        self.assertEqual(self.page.evaluate('rewards'),[]);self.assertEqual(self.page.evaluate('progression.getState().xp'),0)
        self.assertEqual(self.page.locator('[data-exam-exit]').inner_text(),'Return to classroom');self.page.locator('[data-exam-exit]').click();self.assertFalse(self.state()['open'])
        self.page.reload();self.assertEqual(self.state()['phase'],'intro');self.assertFalse(self.state()['contentChanged']);self.start();self.assertEqual(self.state()['answered'],0)


if __name__=='__main__': unittest.main(verbosity=2)
