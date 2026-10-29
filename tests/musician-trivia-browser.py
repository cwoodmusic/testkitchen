"""Real musician conversation and Notes trivia in desktop and phone panels."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HARNESS='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/musician-trivia.css">
<style>*{box-sizing:border-box}body{margin:0;background:#11162a;color:#eee;font:15px system-ui}button{min-height:44px;min-width:44px;color:#fff;background:#40334e;border:1px solid #aaa;padding:9px;border-radius:6px}#panel{width:min(600px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;margin:8px auto;padding:14px;border:1px solid #b49acc;border-radius:8px;background:#211b36}#panel[hidden],#dialog[hidden]{display:none}#dialog{padding:15px}.musician-choices{display:grid;gap:8px}canvas{width:20px;height:20px}</style>
<button id="talk">Talk to Miles</button><span id="balance"></span><button id="accountBtn">Guest</button><canvas id="room" tabindex="0"></canvas>
<div id="dialog" style="display:none"><strong id="who"></strong><p id="words"></p><button id="close">Close</button></div>
<section id="panel" hidden aria-label="Arcade panel"><h1 id="panelTitle"></h1><button id="closePanel">Close panel</button><div id="panelBody"></div></section>
<script src="/notes-shop.js"></script><script src="/musician-trivia.js"></script><script src="/musician-ui.js"></script><script>
window.near=true;window.rewardLog=[];window.wallet=CodaNotesShop.createWallet();window.person={id:'miles',name:'Miles Davis',conversation:true,hidden:false};
window.quiz=CodaMusicianTrivia.create({wallet,panelBody,getMusicians:()=>[person],canTalkTo:()=>near,onReward:event=>rewardLog.push(event),openPanel:title=>{ui.closeConversation();panel.hidden=false;panelTitle.textContent=title;panelBody.replaceChildren();}});
window.ui=createCodaMusicianUI({npcs:[person],canvas:room,getBrain:()=>({beginConversation:()=>({id:'miles',name:'Miles Davis',description:'Trumpeter',line:'Ready for a music question?',choices:[]}),endConversation(){}}),clearInput(){},openTrivia:id=>quiz.open(id)});
talk.onclick=()=>ui.talk(person);closePanel.onclick=()=>panel.hidden=true;
wallet.subscribe(value=>balance.textContent=value.balance+' Notes');balance.textContent=wallet.snapshot().balance+' Notes';
</script>'''
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/trivia-fixture':return super().do_GET()
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(HARNESS.encode())

class TriviaBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':900});self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.url=f'http://127.0.0.1:{self.server.server_port}/trivia-fixture';self.page.goto(self.url);self.page.set_default_timeout(5000)
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def open(self):
        self.page.locator('#talk').click();self.page.get_by_role('button',name='Ask me a music question · Earn Notes',exact=True).click();self.page.locator('.musician-trivia').wait_for()
    def state(self):return self.page.evaluate('quiz.getState()')
    def answer(self,index):self.page.locator(f'[data-trivia-answer="{index}"]').click()
    def test_actual_conversation_launch_wrong_feedback_correct_reward_and_next_question(self):
        self.open();self.assertEqual(self.page.locator('#dialog').evaluate('(element)=>getComputedStyle(element).display'),'none')
        initial=self.state();self.assertEqual(initial['person']['name'],'Miles Davis');self.assertEqual(initial['total'],5)
        self.answer((initial['question']['answer']+1)%3);self.assertIn('Not quite',self.page.locator('.trivia-feedback').inner_text());self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),150)
        self.answer(initial['question']['answer']);self.assertIn('+4 Notes collected',self.page.locator('.trivia-reward').inner_text());self.assertEqual(self.page.locator('#balance').inner_text(),'154 Notes')
        self.assertEqual(self.page.locator('[data-trivia-answer]:disabled').count(),3);self.assertEqual(self.page.evaluate('rewardLog.length'),1)
        self.assertEqual(self.page.locator('.trivia-feedback').get_attribute('role'),'status');self.assertEqual(self.page.locator('.trivia-feedback').evaluate('(element)=>element===document.activeElement'),True)
        self.page.locator('[data-trivia-next]').click();self.assertNotEqual(self.state()['question']['id'],initial['question']['id']);self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),154)
    def test_all_rewards_saved_once_and_review_after_reload_does_not_farm_notes(self):
        self.open()
        for at in range(5):
            self.answer(self.state()['question']['answer'])
            if at<4:self.page.locator('[data-trivia-next]').click()
        self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),170);self.assertIn('Visit another musician',self.page.locator('.trivia-complete').inner_text())
        self.page.reload();self.open();self.assertEqual(self.state()['earned'],5);self.assertIn('Practice question',self.page.locator('.trivia-practice').inner_text())
        self.answer(self.state()['question']['answer']);self.assertIn('already earned',self.page.locator('.trivia-reward').inner_text());self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),170)
        self.assertEqual(self.page.evaluate('rewardLog.length'),0)
    def test_failed_saving_can_retry_the_same_correct_answer_without_duplicate_notes(self):
        self.open();self.page.evaluate("()=>{window.originalSave=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('quota');};}")
        self.answer(self.state()['question']['answer']);self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),150);self.assertIn('could not be saved',self.page.locator('.trivia-feedback').inner_text());self.assertEqual(self.page.locator('[data-trivia-next]').count(),0)
        self.page.evaluate('()=>{Storage.prototype.setItem=originalSave;}');self.page.locator('[data-trivia-retry]').click();self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),154);self.assertEqual(self.page.evaluate('rewardLog.length'),1)
        self.page.evaluate('quiz.answer(quiz.getState().question.answer)');self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),154)
    def test_phone_and_short_landscape_answers_are_readable_without_page_overflow(self):
        self.open()
        for viewport in [{'width':390,'height':844},{'width':568,'height':320}]:
            self.page.set_viewport_size(viewport)
            geometry=self.page.locator('.musician-trivia').evaluate('(element)=>({width:element.scrollWidth,viewport:innerWidth,buttons:[...element.querySelectorAll("button")].map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height}))})')
            self.assertLessEqual(geometry['width'],viewport['width']);self.assertTrue(all(button['width']>=44 and button['height']>=44 for button in geometry['buttons']))
        self.answer(self.state()['question']['answer']);self.page.locator('[data-trivia-next]').click();self.assertEqual(self.state()['status'],'question')
        self.page.screenshot(path='/tmp/coda-trivia-phone30.png')
    def test_moving_away_blocks_answer_and_invalid_actors_cannot_open_quizzes(self):
        self.open();self.page.evaluate('near=false');self.answer(self.state()['question']['answer']);self.assertIn('Return to Miles Davis',self.page.locator('.trivia-feedback').inner_text());self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),150)
        self.assertFalse(self.page.evaluate("quiz.open('__proto__')"));self.assertFalse(self.page.evaluate("quiz.open('unknown')"));self.assertEqual(self.page.evaluate('wallet.snapshot().balance'),150)

if __name__=='__main__':unittest.main(verbosity=2)
