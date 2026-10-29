"""Real touch steering and legacy mouse checks for the original arcade."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class ArcadeFingerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors, self.failures = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/classic-arcade.html', wait_until='domcontentloaded')
        self.page.wait_for_function('CodaLandingQA?.state().finger && CodaLandingQA.state().touch.mobile')
        self.cdp = self.context.new_cdp_session(self.page)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])

    def state(self):
        return self.page.evaluate('CodaLandingQA.state()')

    def floor(self, x, y=460, touch_id=1):
        box = self.page.locator('#room').bounding_box()
        return {'x': box['x'] + box['width'] * x / 1000, 'y': box['y'] + box['height'] * y / 800, 'id': touch_id}

    def button(self, key, touch_id=2):
        if key in ['w','a','s','d']:
            base=self.page.locator('#landingTouchControls .coda-joystick').bounding_box()
            thumb=self.page.locator('#landingTouchControls .coda-joystick-thumb').bounding_box()
            radius=max(20,(base['width']-thumb['width'])/2-8)
            x,y={'w':(0,-1),'a':(-1,0),'s':(0,1),'d':(1,0)}[key]
            return {'x':base['x']+base['width']/2+x*radius,
                    'y':base['y']+base['height']/2+y*radius,'id':touch_id}
        box = self.page.locator(f'#landingTouchControls [data-key="{key}"]').bounding_box()
        return {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2, 'id': touch_id}

    def touches(self, kind, *points):
        self.cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': list(points)})

    def assert_stopped(self):
        self.page.wait_for_function('!CodaLandingQA.state().finger.following && !CodaLandingQA.state().target')
        stopped = self.state()['position']
        self.page.wait_for_timeout(130)
        self.assertAlmostEqual(self.state()['position']['x'], stopped['x'], delta=.1)
        self.assertAlmostEqual(self.state()['position']['y'], stopped['y'], delta=.1)

    def test_held_finger_steers_toward_live_position_and_lifting_stops(self):
        self.assertIn('Lift to stop', self.page.locator('.floor-tap-hint').inner_text())
        right, left = self.floor(750), self.floor(250)
        self.touches('touchStart', right)
        self.page.wait_for_timeout(220)
        self.assertTrue(self.state()['finger']['following'])
        self.assertGreater(self.state()['position']['x'], 520)
        at_turn = self.state()['position']['x']
        self.touches('touchMove', left)
        self.page.wait_for_timeout(180)
        self.assertLess(self.state()['position']['x'], at_turn - 15)
        self.assertAlmostEqual(self.state()['target']['x'], 250, delta=1)
        self.touches('touchEnd')
        self.assert_stopped()

    def test_jump_and_interact_work_while_another_finger_steers(self):
        # The piano room has no wandering NPCs that could open a chat on E.
        self.page.evaluate("enterRoom('piano');pos={x:500,y:350};target=null")
        self.page.wait_for_function("CodaLandingQA.state().touch.context==='landing-piano'")
        floor = self.floor(780, 350)
        self.touches('touchStart', floor)
        self.page.wait_for_timeout(100)
        jump = self.button(' ')
        self.touches('touchStart', floor, jump)
        self.page.wait_for_function('CodaLandingQA.state().jumpHeight>5')
        self.assertTrue(self.state()['finger']['following'])
        self.assertEqual(self.state()['jumps'], 1)
        self.touches('touchEnd', jump)
        interact = self.button('e')
        self.touches('touchStart', floor, interact)
        self.page.wait_for_timeout(80)
        self.assertTrue(self.state()['finger']['following'])
        self.assertFalse(self.state()['modal'])
        self.touches('touchEnd', interact)
        before = self.state()['position']['x']
        self.page.wait_for_timeout(100)
        self.assertGreater(self.state()['position']['x'], before + 8)
        self.touches('touchEnd')
        self.assert_stopped()

    def test_joystick_takes_over_and_does_not_resume_old_finger_target(self):
        floor, right = self.floor(250), self.button('d')
        self.touches('touchStart', floor)
        self.page.wait_for_timeout(100)
        before = self.state()['position']['x']
        self.touches('touchStart', floor, right)
        self.page.wait_for_timeout(160)
        self.assertFalse(self.state()['finger']['following'])
        self.assertGreater(self.state()['position']['x'], before + 15)
        self.touches('touchEnd', right)
        self.assert_stopped()
        self.assertEqual(self.state()['heldKeys'], [])
        self.touches('touchEnd')

    def test_cancel_blur_room_change_and_modal_clear_held_finger(self):
        for stop in ('cancel', 'blur', 'room', 'modal'):
            with self.subTest(stop=stop):
                self.page.evaluate("if(modal.open)modal.close();enterRoom('arcade');pos={x:500,y:460}")
                self.touches('touchStart', self.floor(750))
                self.page.wait_for_function('CodaLandingQA.state().finger.following')
                if stop == 'cancel':
                    self.touches('touchCancel')
                elif stop == 'blur':
                    self.page.evaluate("dispatchEvent(new Event('blur'))")
                elif stop == 'room':
                    self.page.evaluate("enterRoom('piano')")
                else:
                    self.page.evaluate('wardrobe()')
                self.assert_stopped()
                if stop != 'cancel':
                    self.touches('touchEnd')

    def test_second_canvas_finger_suspends_movement_until_both_lift(self):
        first, second = self.floor(750), self.floor(350, 500, 2)
        self.touches('touchStart', first)
        self.page.wait_for_timeout(70)
        self.touches('touchStart', first, second)
        self.assert_stopped()
        self.assertTrue(self.state()['finger']['pinching'])
        self.touches('touchEnd', second)
        self.touches('touchMove', self.floor(700))
        self.assert_stopped()
        self.touches('touchEnd')
        self.touches('touchStart', first)
        self.page.wait_for_function('CodaLandingQA.state().finger.following')
        self.touches('touchEnd')

    def test_desktop_mouse_release_keeps_click_to_walk(self):
        desktop = self.browser.new_context(viewport={'width': 1280, 'height': 900})
        try:
            desktop.route('https://**/*', lambda route: route.abort())
            page = desktop.new_page()
            page.goto(f'http://127.0.0.1:{self.server.server_port}/classic-arcade.html', wait_until='domcontentloaded')
            page.wait_for_function('CodaLandingQA?.state().touch')
            page.locator('#room').scroll_into_view_if_needed()
            box = page.locator('#room').bounding_box()
            page.mouse.click(box['x'] + box['width'] * .75, box['y'] + box['height'] * .575)
            page.wait_for_timeout(160)
            before = page.evaluate('CodaLandingQA.state().position.x')
            self.assertGreater(before, 510)
            self.assertFalse(page.evaluate('CodaLandingQA.state().finger.following'))
            page.wait_for_timeout(140)
            self.assertGreater(page.evaluate('CodaLandingQA.state().position.x'), before + 15)
        finally:
            desktop.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
