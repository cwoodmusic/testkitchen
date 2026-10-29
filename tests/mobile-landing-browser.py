"""Phone and tablet checks for the original landing arcade's real touch UI."""
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

class MobileLandingTests(unittest.TestCase):
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
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        self.context.route('https://**/*',lambda route:route.abort())
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url)
          if response.status>=400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/classic-arcade.html',wait_until='domcontentloaded')
        self.page.wait_for_function('CodaLandingQA?.state().touch')
        self.cdp=self.context.new_cdp_session(self.page)

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def state(self):
        return self.page.evaluate('CodaLandingQA.state()')

    def point(self,selector,touch_id):
        box=self.page.locator(selector).bounding_box();self.assertIsNotNone(box,selector)
        return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':touch_id,'radiusX':3,'radiusY':3,'force':1}

    def joystick(self,x=1,y=0,touch_id=1):
        base=self.page.locator('#landingTouchControls .coda-joystick').bounding_box()
        thumb=self.page.locator('#landingTouchControls .coda-joystick-thumb').bounding_box()
        self.assertIsNotNone(base);self.assertIsNotNone(thumb)
        radius=max(20,(base['width']-thumb['width'])/2-8)
        return {'x':base['x']+base['width']/2+x*radius,
                'y':base['y']+base['height']/2+y*radius,
                'id':touch_id,'radiusX':3,'radiusY':3,'force':1}

    def touches(self,kind,*points):
        self.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':list(points)})

    def assert_fits(self):
        metrics=self.page.evaluate('''()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,
          canvas:room.getBoundingClientRect().toJSON()})''')
        self.assertLessEqual(metrics['width'],metrics['viewport']+1)
        self.assertGreaterEqual(metrics['canvas']['left'],0)
        self.assertLessEqual(metrics['canvas']['right'],metrics['viewport']+1)

    def test_portrait_menu_avatar_and_connected_world_launch_are_touch_accessible(self):
        self.assert_fits();self.assertTrue(self.page.locator('#connectedWorldLink').is_visible())
        self.assertIn('world-preview.html',self.page.locator('#connectedWorldLink').get_attribute('href'))
        self.page.locator('#landingMenuToggle').tap()
        self.assertEqual(self.page.locator('#landingMenuToggle').get_attribute('aria-expanded'),'true')
        self.page.locator('#wardrobe').tap();self.assertTrue(self.page.locator('#modal').is_visible())
        bounds=self.page.locator('#modal').bounding_box()
        self.assertGreaterEqual(bounds['x'],0);self.assertLessEqual(bounds['x']+bounds['width'],391)
        self.assertGreaterEqual(self.page.locator('#modal .close').bounding_box()['height'],44)
        self.page.locator('#nickname').fill('Mobile Musician')
        self.page.get_by_role('button',name='Save avatar →',exact=True).tap()
        self.assertFalse(self.page.locator('#modal').is_visible())
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).name'),'Mobile Musician')

    def test_multi_touch_walk_jump_release_and_emote_use_real_gameplay(self):
        right=self.joystick()
        jump=self.point('#landingTouchControls [data-key=" "]',2)
        start=self.state()['position']['x']
        self.touches('touchStart',right);self.page.wait_for_timeout(180)
        self.assertGreater(self.state()['position']['x'],start+15)
        self.touches('touchStart',right,jump);self.page.wait_for_function('CodaLandingQA.state().jumpHeight>5')
        self.assertEqual(self.state()['jumps'],1)
        self.touches('touchEnd',jump);self.page.wait_for_timeout(120)
        self.assertTrue(self.state()['touch']['joystick']['active'],
            'Lifting the action finger must keep the joystick finger steering')
        self.assertGreater(self.state()['position']['x'],start+25)
        self.touches('touchEnd');self.page.wait_for_timeout(100)
        stopped=self.state()['position']['x'];self.page.wait_for_timeout(140)
        self.assertAlmostEqual(self.state()['position']['x'],stopped,delta=.1)
        self.assertEqual(self.state()['heldKeys'],[])
        self.page.locator('#landingTouchControls [data-key="q"]').tap()
        self.assertEqual(self.state()['emotesUsed'],1)

    def test_cancel_rotation_and_animation_preference_do_not_leave_held_controls(self):
        right=self.joystick()
        self.touches('touchStart',right);self.page.wait_for_timeout(80);self.touches('touchCancel')
        self.page.wait_for_timeout(100);self.assertEqual(self.state()['heldKeys'],[])
        self.assertFalse(self.state()['touch']['joystick']['active'])
        stopped=self.state()['position'];self.page.wait_for_timeout(100)
        self.assertEqual(self.state()['position'],stopped)
        self.touches('touchStart',self.joystick());self.page.wait_for_timeout(80)
        self.page.set_viewport_size({'width':844,'height':390});self.page.wait_for_timeout(200)
        self.touches('touchEnd')
        self.assert_fits();self.assertEqual(self.state()['heldKeys'],[])
        self.assertFalse(self.state()['touch']['joystick']['active'])
        stopped=self.state()['position'];self.page.wait_for_timeout(100)
        self.assertEqual(self.state()['position'],stopped)
        self.page.locator('#landingRoomOptions').evaluate('(details)=>details.open=true')
        self.page.locator('#motiontoggle').tap()
        self.assertEqual(self.page.evaluate('localStorage.arcadeAnimations'),'off')
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('CodaLandingQA?.state().touch')
        self.assertFalse(self.state()['animations'])

    def test_touch_interact_opens_song_machine_and_return_keeps_controls_usable(self):
        self.page.evaluate('pos.x=795;pos.y=225;target=null')
        self.page.wait_for_function('near===3')
        self.page.locator('#landingTouchControls [data-key="e"]').tap()
        self.page.wait_for_function('CodaLandingQA.state().gameOpen')
        self.assertTrue(self.page.locator('#gameframe').is_visible())
        self.assertEqual(self.page.evaluate('new URL(document.querySelector("#gameframe").src).searchParams.get("classroom")'),'1')
        frame=self.page.locator('#gameframe').element_handle().content_frame()
        frame.locator('#simpleInstrument').wait_for(state='visible')
        self.assertEqual(frame.evaluate('songMachineBridge.getEditorMode()'),'simple')
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),2)
        frame.locator('#simpleInstrument').select_option('add')
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),3)
        frame.locator('#simpleUndo').tap()
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),2)
        self.assertGreaterEqual(self.page.locator('#back').bounding_box()['height'],44)
        self.page.locator('#back').tap();self.page.wait_for_function('!CodaLandingQA.state().gameOpen')
        self.page.wait_for_timeout(200)
        self.assertTrue(self.page.locator('#landingTouchControls .coda-joystick').is_visible())
        self.assertEqual(self.state()['heldKeys'],[])

    def test_joystick_deadzone_analog_angle_and_outside_drag_keep_real_movement(self):
        self.page.evaluate('pos.x=500;pos.y=460;target=null')
        start=self.state()['position']
        self.touches('touchStart',self.joystick(0,0));self.page.wait_for_timeout(130)
        self.assertAlmostEqual(self.state()['position']['x'],start['x'],delta=.1)
        self.assertAlmostEqual(self.state()['position']['y'],start['y'],delta=.1)
        self.assertTrue(self.state()['touch']['joystick']['active'])
        self.assertEqual(self.state()['touch']['joystick']['strength'],0)
        self.touches('touchMove',self.joystick(.6,.3));self.page.wait_for_timeout(220)
        diagonal=self.state();dx=diagonal['position']['x']-start['x'];dy=diagonal['position']['y']-start['y']
        self.assertGreater(dx,12);self.assertGreater(dy,5)
        self.assertAlmostEqual(dx/dy,2,delta=.18,
            msg='The landing arcade must follow a 2:1 analog angle rather than snap to a diagonal')
        self.assertLess(diagonal['touch']['joystick']['strength'],.8)
        self.touches('touchMove',self.joystick(2.4,1.2));self.page.wait_for_timeout(140)
        outside=self.state()
        self.assertTrue(outside['touch']['joystick']['active'])
        self.assertAlmostEqual(outside['touch']['joystick']['strength'],1,delta=.01)
        self.assertGreater(outside['position']['x'],diagonal['position']['x']+12,
            'A captured joystick keeps steering when the thumb leaves its base')
        self.touches('touchEnd');self.page.wait_for_timeout(70)
        stopped=self.state()['position'];self.page.wait_for_timeout(140)
        self.assertEqual(self.state()['position'],stopped)
        self.assertFalse(self.state()['touch']['joystick']['active'])
        self.assertEqual(self.state()['touch']['joystick']['strength'],0)

if __name__=='__main__':unittest.main(verbosity=2)
