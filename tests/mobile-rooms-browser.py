"""Phone-sized room navigation and touch controls use the production room APIs."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

    def do_GET(self):
        if self.path!='/mobile-rooms':return super().do_GET()
        html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="/piano-lab.css"><link rel="stylesheet" href="/music-classroom.css"><link rel="stylesheet" href="/classroom-tutorials.css">
<style>body{margin:0;background:#101628}#fixturePad{position:fixed;bottom:0;left:0;right:0;z-index:110;display:flex;justify-content:space-between;padding:16px;background:#122136b0}#fixturePad[hidden]{display:none}#fixturePad button{min-width:60px;min-height:50px;font-size:16px;touch-action:none} :root{--coda-touch-controls-height:100px}</style>
<button id="enterPiano">Piano</button><button id="enterClassroom">Classroom</button><section id="pianoroom" hidden></section><section id="classroom" hidden></section>
<div id="fixturePad" hidden><button data-key="d">Move right</button><button data-key=" ">Jump</button><button data-key="e">Interact</button></div>
<script src="/character-renderer.js"></script><script src="/finger-follow.js"></script><link rel="stylesheet" href="/music-notation.css"><script src="/music-notation.js"></script><link rel="stylesheet" href="/time-signature-lesson.css"><script src="/time-signature-lesson.js"></script><script src="/classroom-tutorials.js"></script><script src="/piano-melodies.js"></script><script src="/piano-wall-notation.js"></script><script src="/piano-lab.js"></script><script src="/music-classroom.js"></script><script>
const renderer=createCodaCharacterRenderer();window.rewards=[];
window.lab=createCodaPianoLab({host:pianoroom,renderer,backgroundUrl:'/assets/world/piano-lab-room.png',onReward:(id,amount)=>{rewards.push({id,amount});return {ok:true,amount};}});
window.classroomUI=createCodaMusicClassroom({host:classroom,renderer,backgroundSrc:'/assets/world/music-classroom-room.png'});
let active=null;enterPiano.onclick=()=>{active=lab;lab.open();};enterClassroom.onclick=()=>{active=classroomUI;classroomUI.open();};
const held=new Set();for(const button of fixturePad.querySelectorAll('button')){
 button.onpointerdown=event=>{event.preventDefault();held.add(button.dataset.key);active?.control(button.dataset.key,true);};
}
const release=()=>{for(const key of held)active?.control(key,false);held.clear();};addEventListener('pointerup',release);addEventListener('pointercancel',release);
setInterval(()=>{const state=active?.getState();fixturePad.hidden=!state?.open||state.mobileView!=='room';if(fixturePad.hidden)release();},25);
</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())


class MobileRoomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/mobile-rooms')
        self.page.wait_for_function('window.lab&&window.classroomUI')

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def open_piano(self):
        self.page.locator('#enterPiano').tap();self.page.wait_for_function('lab.getState().background.ready')

    def floor_point(self,midi):
        return self.page.evaluate('''midi=>{
          const key=lab.getState().floorKeys.find(key=>key.midi===midi);
          const y=key.black?key.polygon.reduce((sum,p)=>sum+p[1],0)/4:key.polygon[2][1]-10;
          return {x:key.polygon.reduce((sum,p)=>sum+p[0],0)/4,y};
        }''',midi)

    def walk(self,x,y):
        box=self.page.locator('#pianoRoomCanvas').bounding_box()
        client=self.context.new_cdp_session(self.page)
        try:
            client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':box['x']+x/1000*box['width'],'y':box['y']+y/620*box['height']}]})
            self.page.wait_for_function('p=>Math.hypot(lab.getState().player.x-p.x,lab.getState().player.y-p.y)<4',arg={'x':x,'y':y})
        finally:
            client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach()

    def hold_touch(self,selector,milliseconds=180):
        box=self.page.locator(selector).bounding_box();client=self.context.new_cdp_session(self.page)
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]})
        self.page.wait_for_timeout(milliseconds)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach()

    def assert_fits(self,selector):
        self.assertFalse(self.page.locator(selector).evaluate('(host)=>host.scrollWidth>innerWidth+1'))
        dimensions=self.page.locator(selector+' button:visible').evaluate_all('(buttons)=>buttons.map(button=>({label:button.textContent,height:button.getBoundingClientRect().height}))')
        self.assertTrue(all(item['height']>=43.5 for item in dimensions),dimensions)

    def test_piano_phone_views_touch_walking_jump_and_optional_names(self):
        self.open_piano();self.assert_fits('#pianoroom')
        self.assertFalse(self.page.locator('#pianoKeyboardPanel').is_visible())
        before=self.page.evaluate('lab.getState().player.x');self.hold_touch('[data-key="d"]')
        self.assertGreater(self.page.evaluate('lab.getState().player.x'),before+20)
        after=self.page.evaluate('lab.getState().player.x');self.page.wait_for_timeout(150)
        self.assertAlmostEqual(self.page.evaluate('lab.getState().player.x'),after,delta=.01)
        self.hold_touch('[data-key=" "]',70)
        self.assertGreater(self.page.evaluate('lab.getState().player.jump'),0)
        self.page.wait_for_function('lab.getState().player.jump===0')
        point=self.floor_point(60);self.walk(**point)
        self.assertEqual(self.page.evaluate('lab.getState().lastWallNote'),60)
        self.assertEqual(self.page.evaluate('lab.getState().audioState'),'running')
        self.page.locator('#pianoKeyNames').check();self.assertTrue(self.page.evaluate('lab.getState().showNames'))
        self.page.get_by_role('button',name='Keyboard',exact=True).tap()
        self.page.locator('#fixturePad').wait_for(state='hidden');self.assert_fits('#pianoroom')
        self.assertTrue(self.page.locator('#pianoKeyboardPanel').is_visible())
        self.assertGreaterEqual(self.page.locator('.piano-black').first.bounding_box()['width'],44)
        self.page.get_by_role('button',name='Room',exact=True).tap()
        self.assertEqual(self.page.evaluate('lab.getState().mobileView'),'room')
        self.page.screenshot(path='/tmp/coda-mobile-piano-portrait.png')

    def test_chopin_game_returns_to_floor_and_only_explicit_touch_action_counts(self):
        self.open_piano();self.page.get_by_role('button',name='Chopin games',exact=True).tap()
        self.assertTrue(self.page.locator('#pianoLesson').is_visible())
        self.page.locator('#pianoLesson').select_option('mary')
        self.assertEqual(self.page.evaluate('lab.getState().mobileView'),'room')
        point=self.floor_point(64);self.walk(**point)
        self.assertEqual(self.page.evaluate('lab.getState().lessonStep'),0)
        self.assertIsNone(self.page.evaluate('lab.getState().lastWallNote'))
        self.page.get_by_role('button',name='Interact',exact=True).tap()
        self.assertEqual(self.page.evaluate('lab.getState().lessonStep'),1)
        self.assertEqual(self.page.evaluate('lab.getState().lastWallNote'),64)
        self.assertIn('Next:',self.page.locator('#pianoRoomMessage').inner_text())
        self.page.get_by_role('button',name='Chopin games',exact=True).tap()
        self.page.locator('#pianoInterval').select_option('down-4');self.page.locator('#pianoStartInterval').tap()
        self.assertEqual(self.page.evaluate('lab.getState().mobileView'),'room')
        self.assertEqual(self.page.evaluate('lab.getState().interval.id'),'down-4')

    def test_classroom_phone_books_search_quiz_and_room_input_release(self):
        self.page.locator('#enterClassroom').tap();self.assert_fits('#classroom')
        before=self.page.evaluate('classroomUI.getState().player.x');self.hold_touch('[data-key="d"]')
        self.assertGreater(self.page.evaluate('classroomUI.getState().player.x'),before+20)
        self.page.evaluate("classroomUI.control('d',true)");self.page.wait_for_timeout(60)
        self.page.get_by_role('button',name='Lessons & books',exact=True).tap()
        x=self.page.evaluate('classroomUI.getState().player.x');self.page.wait_for_timeout(120)
        self.assertAlmostEqual(self.page.evaluate('classroomUI.getState().player.x'),x,delta=.01)
        self.page.locator('#classroomSearch').fill('interval')
        self.page.locator('[data-topic="intervals"]').tap()
        self.page.get_by_role('button',name='G',exact=True).tap()
        self.assertEqual(self.page.locator('.classroom-feedback').get_attribute('data-correct'),'true')
        self.assert_fits('#classroom')
        self.page.get_by_role('button',name='Room',exact=True).tap()
        self.assertEqual(self.page.evaluate('classroomUI.getState().mobileView'),'room')
        self.page.locator('#classroomTalk').tap()
        self.assertEqual(self.page.evaluate('classroomUI.getState().mobileView'),'books')
        self.assertIn('Professor Haydn',self.page.locator('#classroomBookTitle').inner_text())
        self.page.screenshot(path='/tmp/coda-mobile-classroom-books.png')

    def test_landscape_room_and_keyboard_fit_without_smaller_touch_targets(self):
        self.page.set_viewport_size({'width':844,'height':390});self.open_piano()
        self.assert_fits('#pianoroom')
        canvas=self.page.locator('#pianoRoomCanvas').bounding_box()
        self.assertLessEqual(canvas['y']+canvas['height'],390)
        self.page.get_by_role('button',name='Chopin games',exact=True).tap();self.assert_fits('#pianoroom')
        self.page.get_by_role('button',name='Keyboard',exact=True).tap();self.assert_fits('#pianoroom')
        self.page.locator('#closepiano').tap();self.page.locator('#enterClassroom').tap();self.assert_fits('#classroom')
        self.page.screenshot(path='/tmp/coda-mobile-classroom-landscape.png')


if __name__=='__main__':unittest.main(verbosity=2)
