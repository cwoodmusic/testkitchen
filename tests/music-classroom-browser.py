"""Exercise the real classroom DOM, canvas movement, books, and listening audio."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass
    def do_GET(self):
        if self.path!='/classroom-harness':
            return super().do_GET()
        html='''<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/music-classroom.css"><link rel="stylesheet" href="/classroom-tutorials.css"><button id="entrance">Enter classroom</button><section id="room" hidden></section><script src="/character-renderer.js"></script><link rel="stylesheet" href="/music-notation.css"><script src="/music-notation.js"></script><link rel="stylesheet" href="/time-signature-lesson.css"><script src="/time-signature-lesson.js"></script><script src="/classroom-tutorials.js"></script><script src="/room-fullscreen.js"></script><script src="/music-classroom.js"></script><script>window.roomUI=createCodaMusicClassroom({host:document.querySelector('#room'),backgroundSrc:'/assets/world/music-classroom-room.png',renderer:createCodaCharacterRenderer(),getAvatar:()=>({}),getVibe:()=>window.fixtureVibe||null});entrance.onclick=()=>roomUI.open();</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())

class ClassroomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1200,'height':950})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        base=f'http://127.0.0.1:{self.server.server_port}'
        self.page.goto(base+'/classroom-harness')
        self.page.wait_for_function('window.roomUI')
        self.page.locator('#entrance').click()

    def open_lessons(self):
        if self.page.evaluate("roomUI.getState().mobileView==='room'"):
            self.page.locator('#classroomCanvas').focus()
            self.page.keyboard.down('w');self.page.wait_for_timeout(900);self.page.keyboard.up('w')
            self.page.keyboard.press('e')
        elif self.page.locator('#classroomAllLessons').is_visible():
            self.page.locator('#classroomAllLessons').click()
        self.assertTrue(self.page.locator('#classroomStart').is_visible())

    def tearDown(self):
        self.assertEqual(self.errors,[])
        self.context.close()

    def test_optional_vibe_keeps_native_classroom_dimensions_and_professor_desk_depth(self):
        self.page.evaluate('''()=>{window.vibeCalls=[];window.fixtureVibe={
          drawAtmosphere:(g,frame)=>{vibeCalls.push({kind:'atmosphere',...frame});return false;},
          drawCharacterGlow:(g,actor)=>{vibeCalls.push({kind:'glow',...actor});return false;}
        };}''')
        self.page.wait_for_function('vibeCalls.filter(call=>call.kind==="glow").length>=2')
        calls=self.page.evaluate('vibeCalls');state=self.page.evaluate('roomUI.getState()')
        self.assertEqual((calls[0]['width'],calls[0]['height'],calls[0]['lights']),(1000,600,[]))
        glows=[call for call in calls if call['kind']=='glow']
        self.assertTrue(any(call['x']==state['professor']['x'] and call['y']==state['professor']['y'] for call in glows))
        self.assertTrue(any(call['x']==state['player']['x'] and call['y']==state['player']['y'] for call in glows))
        self.assertTrue(all(call['scale']==1 for call in glows))
        self.assertEqual([call['kind'] for call in calls[:4]],['atmosphere','glow','atmosphere','glow'])
        self.page.evaluate("()=>{window.fixtureVibe=null;const host=document.createElement('section');document.body.append(host);const bare=createCodaMusicClassroom({host,getAvatar:()=>({})});bare.open();bare.destroy();host.remove();}")

    def test_room_moves_and_professor_interaction_opens_a_real_book(self):
        self.assertTrue(self.page.evaluate('roomUI.getState().open'))
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.down('w')
        self.page.wait_for_timeout(900);self.page.keyboard.up('w')
        state=self.page.evaluate('roomUI.getState()')
        self.assertLess(state['player']['y'],400)
        self.assertGreaterEqual(state['player']['y'],373,'The professor’s desk must block walking onto its surface')
        self.assertEqual(state['near']['type'],'professor')
        self.page.keyboard.press('e')
        self.assertTrue(self.page.locator('#classroomStart').is_visible())
        self.assertFalse(self.page.locator('.classroom-room').is_visible())
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'classroomStart')

    def test_tapping_the_room_reaches_a_bookshelf_and_e_reads_it(self):
        box=self.page.locator('#classroomCanvas').bounding_box()
        self.page.mouse.click(box['x']+175/1000*box['width'],box['y']+315/600*box['height'])
        self.page.wait_for_function("roomUI.getState().near?.id==='pitch'",timeout=5000)
        self.page.wait_for_function("Math.abs(roomUI.getState().player.x-175)<5",timeout=5000)
        self.page.keyboard.press('e')
        self.assertIn(self.page.evaluate('roomUI.getState().topic'),['pitch','note-naming'])

    def test_books_search_quiz_audio_and_close_work(self):
        self.open_lessons();self.page.locator('#classroomBrowseBooks').click()
        self.page.locator('#classroomSearch').fill('interval')
        self.page.locator('[data-topic="intervals"]').click()
        self.assertIn('Intervals higher',self.page.locator('#classroomBookTitle').inner_text())
        self.page.get_by_role('button',name='F',exact=True).click()
        self.assertEqual(self.page.locator('.classroom-feedback').get_attribute('data-correct'),'false')
        self.page.get_by_role('button',name='G',exact=True).click()
        self.assertEqual(self.page.locator('.classroom-feedback').get_attribute('data-correct'),'true')
        self.page.get_by_role('button',name='♫ Hear a major third up',exact=True).click()
        self.assertTrue(self.page.evaluate('roomUI.getState().audioPlaying'))
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('roomUI.getState().mobileView'),'room')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('roomUI.getState().open'))
        self.assertFalse(self.page.evaluate('roomUI.getState().audioPlaying'))
        self.assertTrue(self.page.locator('#room').is_hidden())
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'entrance')

    def test_beginner_path_has_a_clear_start_and_returns_from_each_lesson(self):
        self.assertTrue(self.page.locator('#classroomStart').is_hidden())
        self.assertEqual(self.page.locator('.classroom-mobile-nav').count(),0)
        self.open_lessons()
        start=self.page.locator('#classroomStart')
        self.assertTrue(start.is_visible())
        self.assertEqual(start.locator('button strong').all_inner_texts(),
            ['1. Note names','2. Note lengths','3. Time signatures','4. Bass clef','5. Grand staff & Middle C'])
        self.assertEqual(self.page.locator('#classroomBook .classroom-check').count(),0,
            'The welcome page should offer a starting point, not a game quiz')
        for lesson in ['note-naming','rhythm-tree','time-signatures','bass-clef','grand-staff']:
            self.page.locator('[data-start-lesson="'+lesson+'"]').click()
            self.assertTrue(start.is_hidden())
            self.assertEqual(self.page.evaluate('roomUI.getState().tutorials.active.id'),lesson)
            self.page.locator('#classroomAllLessons').click()
            self.assertTrue(start.is_visible())
            self.assertIsNone(self.page.evaluate('roomUI.getState().tutorials.active||null'))
            self.assertEqual(self.page.evaluate('document.activeElement.id'),'classroomStart')
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('#classroomStart').focus()
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'classroomStart')
        self.page.keyboard.press('Tab')
        self.assertEqual(self.page.evaluate('document.activeElement.dataset.startLesson'),'note-naming')
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('roomUI.getState().tutorials.active.id'),'note-naming')
        book=self.page.locator('#classroomBook').bounding_box()
        heading=self.page.locator('.classroom-heading').bounding_box()
        self.assertGreaterEqual(book['y'],heading['y']+heading['height']-1,
            'The lesson must start below the sticky heading')
        self.assertLess(book['y'],160,'Do not leave a second navigation gap above the lesson')
        self.assertLessEqual(self.page.locator('#room').evaluate('e=>e.scrollWidth'),390)

    def test_books_remain_accessible_at_phone_width(self):
        self.page.set_viewport_size({'width':375,'height':812})
        self.open_lessons();self.page.locator('#classroomBrowseBooks').click()
        self.page.locator('#classroomSearch').fill('Music Triad')
        self.page.locator('[data-topic="music-triad"]').click()
        book=self.page.locator('#classroomBook').inner_text()
        self.assertIn('Notes battle notes',book)
        self.assertIn('Rests battle rests',book)
        overflow=self.page.evaluate('document.querySelector("#room").scrollWidth>innerWidth')
        self.assertFalse(overflow,'Study books should fit a phone viewport')

if __name__=='__main__':
    unittest.main(verbosity=2)
