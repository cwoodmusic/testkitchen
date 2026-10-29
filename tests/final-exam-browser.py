"""Final Exam UI: readable questions, saved reviews, proper notation, reward recovery."""
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
        if self.path != '/exam-fixture': return super().do_GET()
        html = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:10px;background:#101a2d;font-family:Arial,sans-serif}*{box-sizing:border-box}</style>
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/final-exam.css">
<button id="enter">Take the final exam</button><section id="exam" hidden></section>
<script src="/music-notation.js"></script><script src="/classroom-quiz.js"></script><script src="/final-exam.js"></script>
<script>
const ids=CodaFinalExam.CATEGORY_IDS;
const diagrams=[{kind:'staff',clef:'treble',position:0,label:'Treble staff with one highlighted note.'},{kind:'staff',clef:'bass',position:2,label:'Bass staff with one highlighted note.'},{kind:'staff',clef:'treble',position:-2,grand:true,label:'Grand staff with one highlighted note.'},{kind:'rhythm',notes:[{beats:4,rest:true},{beats:2,rest:true},{beats:1,rest:false},{beats:.5,rest:false},{beats:.25,rest:false}]},{kind:'meter',meter:'6/8'},{kind:'scale',notes:['C','D','E-flat','F','G','A-flat','B-flat']},{kind:'dynamic',mark:'pp'},{kind:'tempo',text:'Allegro',bpm:120}];
const questions=ids.flatMap((category,group)=>Array.from({length:100},(_,index)=>({id:category+'-'+String(index+1).padStart(3,'0'),category,prompt:'Choose the answer for music question '+(index+1)+'.',choices:[{id:'a',text:'Choice A'},{id:'b',text:'Choice B'},{id:'c',text:'Choice C'}],answer:['a','b','c'][index%3],explanation:'Explanation appears only after finishing.',stimulus:diagrams[group]})));
const lookup=new Map(questions.map(question=>[question.id,question]));
window.bank={VERSION:1,CATEGORIES:ids.map(id=>({id,title:id})),pool:id=>questions.filter(question=>question.category===id),getQuestion:id=>lookup.get(id)};
window.rewardFailure=false;window.writeFailure=false;window.writable=true;window.rewards=[];window.studied=[];window.exits=0;
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(writeFailure)throw Error('quota');localStorage.setItem(key,value);}};
window.examUI=CodaFinalExam.create({host:exam,bank,storage,canRecord:()=>writable,onComplete:(id,result)=>{if(rewardFailure)return {ok:false,error:'Please retry your completion.'};rewards.push({id,result});return {ok:true};},onStudy:id=>studied.push(id),onExit:()=>exits++});enter.onclick=()=>examUI.open();
window.correctChoice=(wrong=false)=>{const state=examUI.getState(),question=bank.getQuestion(state.questionIds[state.index]),order=CodaFinalExam.ORDERS[state.orders[state.index]];return order.findIndex(index=>(question.choices[index].id===question.answer)!==wrong);};
</script>'''
        self.send_response(200);self.send_header('Content-Type', 'text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())


class FinalExamBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1250, 'height':950})
        self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.url=f'http://127.0.0.1:{self.server.server_port}/exam-fixture'
        self.page.goto(self.url);self.page.locator('#enter').click()

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors, []);self.assertEqual(self.failures, [])

    def state(self): return self.page.evaluate('examUI.getState()')

    def start(self):
        self.page.locator('[aria-label="Final exam length"]').select_option('24')
        self.page.locator('[data-exam-start]').click()

    def choose(self, wrong=False):
        index=self.page.evaluate('wrong=>correctChoice(wrong)',wrong)
        self.page.locator('[data-exam-answer="'+str(index)+'"]').click()

    def answer_all(self):
        while True:
            self.choose()
            last=self.state()['index']==self.state()['total']-1
            self.page.locator('[data-exam-next]').click()
            if last: break

    def test_one_question_review_and_resume_keep_choices_private_until_finish(self):
        self.assertIn('No timer', self.page.locator('#exam').inner_text())
        self.assertEqual(self.page.locator('.final-exam-categories li').count(), 8)
        self.start();self.assertEqual(self.page.locator('.final-exam-question').count(),1)
        self.assertTrue(self.page.locator('[data-exam-next]').is_disabled())
        wrong=self.page.evaluate('correctChoice(true)');self.page.locator('[data-exam-answer="'+str(wrong)+'"]').focus();self.page.keyboard.press('Space')
        self.assertEqual(self.page.evaluate('document.activeElement.dataset.examAnswer'),str(wrong),'Choosing an answer should preserve keyboard focus')
        self.assertNotIn('Explanation appears',self.page.locator('#exam').inner_text())
        self.assertEqual(self.page.locator('[aria-pressed="true"]').count(),1)
        before=self.state();self.page.locator('[data-exam-next]').click();self.choose()
        self.page.locator('[data-exam-back]').click();self.assertEqual(self.state()['answers'][0],before['answers'][0])
        self.choose();self.page.locator('[data-exam-exit]').click();self.assertFalse(self.state()['open']);self.assertEqual(self.page.evaluate('exits'),1)
        self.page.reload();self.page.locator('#enter').click();self.assertEqual(self.state()['answered'],2);self.assertEqual(self.state()['index'],0)
        self.page.locator('[data-exam-review]').click();self.assertTrue(self.page.locator('[data-exam-submit]').is_disabled())
        self.page.locator('[aria-label="Review question 3, unanswered"]').click();self.answer_all()
        self.assertEqual(self.state()['answered'],24);self.assertEqual(self.page.locator('.final-exam-question').count(),0)
        self.assertNotIn('Explanation appears',self.page.locator('#exam').inner_text())
        self.page.locator('[data-exam-submit]').click();self.page.wait_for_function('examUI.getState().completedAt>0')
        self.assertEqual(self.state()['percent'],100);self.assertEqual(self.state()['attempts'],1)
        self.assertEqual(self.page.locator('.final-exam-breakdown article').count(),8)
        self.page.locator('.final-exam-breakdown button').first.click();self.assertEqual(len(self.page.evaluate('studied')),1)
        self.page.locator('.final-exam-result-review summary').click();self.assertIn('Explanation appears',self.page.locator('.final-exam-result-review').inner_text())
        self.assertEqual(len(self.page.evaluate('rewards')),1)

    def test_mobile_notation_and_touch_targets_and_failed_reward_retry(self):
        self.page.set_viewport_size({'width':390,'height':844});self.start();seen=set()
        self.page.evaluate('rewardFailure=true')
        while True:
            state=self.state();category=state['questionIds'][state['index']].rsplit('-',1)[0]
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
            for bounds in self.page.locator('.final-exam-choices button').evaluate_all('nodes=>nodes.map(node=>({w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height}))'):
                self.assertGreaterEqual(bounds['w'],44);self.assertGreaterEqual(bounds['h'],44)
            if category not in seen:
                seen.add(category)
                figure=self.page.locator('.final-exam-visual');self.assertTrue(figure.is_visible())
                if category in ['note-naming','bass-clef','grand-staff']:
                    self.assertEqual(figure.locator('svg').count(),1)
                if category=='rhythm-tree': self.assertEqual(figure.locator('.coda-note-symbol').count(),5)
                if category=='major-minor-keys': self.assertEqual(figure.get_attribute('aria-label'),'Shown notes: C, D, E flat, F, G, A flat, B flat.')
                if category=='dynamics':
                    self.page.evaluate('document.fonts.ready')
                    self.assertEqual(figure.locator('.coda-music-glyph').evaluate('node=>getComputedStyle(node).fontFamily'),'CodaBravura')
            self.choose();last=state['index']==state['total']-1;self.page.locator('[data-exam-next]').click()
            if last:break
        self.assertEqual(len(seen),8);self.page.locator('[data-exam-submit]').click()
        self.page.wait_for_function('!examUI.getState().claiming');self.assertTrue(self.state()['rewardPending']);self.assertEqual(self.state()['completedAt'],0)
        self.assertEqual(self.page.evaluate('rewards'),[]);self.assertIn('retry',self.page.locator('#exam').inner_text())
        self.page.evaluate('rewardFailure=false');self.page.locator('[data-exam-claim]').click();self.page.wait_for_function('examUI.getState().completedAt>0')
        self.assertEqual(len(self.page.evaluate('rewards')),1);self.page.locator('[data-exam-exit]').click();self.page.locator('#enter').click()
        self.assertEqual(len(self.page.evaluate('rewards')),1);self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)

    def test_save_and_return_keeps_an_unsaved_answer_open_until_storage_recovers(self):
        self.start();self.page.evaluate('writeFailure=true');self.choose()
        self.assertEqual(self.state()['answered'],1);self.assertFalse(self.state()['saved'])
        self.page.locator('[data-exam-exit]').click();self.assertTrue(self.state()['open']);self.assertEqual(self.page.evaluate('exits'),0)
        self.assertIn('could not save',self.page.locator('#exam').inner_text())
        self.page.evaluate('writeFailure=false');self.page.locator('[data-exam-exit]').click()
        self.assertFalse(self.state()['open']);self.assertEqual(self.page.evaluate('exits'),1)
        self.page.reload();self.page.locator('#enter').click();self.assertEqual(self.state()['answered'],1)


if __name__=='__main__': unittest.main()
