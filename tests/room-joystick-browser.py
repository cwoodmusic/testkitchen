"""Continuous joystick input reaches the real room movement and collision code."""
import functools
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def fixture(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'tests' / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


rooms = fixture('mobile-rooms-browser')
cave = fixture('rhythm-fishing-browser')


class Handler(rooms.Handler):
    def do_GET(self):
        if self.path == '/fishing-fixture':
            return cave.Handler.do_GET(self)
        return super().do_GET()


class RoomJoystickTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        self.page = None
        self.errors = []

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def open_room(self, kind):
        if self.page:
            self.page.close()
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        path = '/fishing-fixture' if kind == 'cave' else '/mobile-rooms'
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}{path}')
        self.page.clock.install()
        self.page.clock.pause_at(datetime.now(timezone.utc) + timedelta(seconds=1))
        button = {'piano': '#enterPiano', 'classroom': '#enterClassroom', 'cave': '#enter'}[kind]
        self.page.locator(button).tap()
        self.page.evaluate('window.actor=' + ('classroomUI' if kind == 'classroom' else 'lab'))
        self.page.clock.run_for(64)

    def state(self):
        return self.page.evaluate('actor.getState()')

    def move(self, x, y):
        return self.page.evaluate('p=>actor.controlMove(p.x,p.y)', {'x': x, 'y': y})

    def test_angle_strength_and_neutral_use_real_room_motion(self):
        for kind in ['piano', 'classroom', 'cave']:
            with self.subTest(room=kind):
                self.open_room(kind)
                before = self.state()['player']
                self.assertTrue(self.move(.6, -.2))
                self.page.clock.run_for(192)
                after = self.state()['player']
                self.assertGreater(after['x'], before['x'] + 10)
                self.assertAlmostEqual(
                    (after['y'] - before['y']) / (after['x'] - before['x']), -1 / 3, delta=.001)
                self.assertAlmostEqual(self.state()['joystick']['strength'], .4 ** .5)
                self.move(0, 0)
                self.page.clock.run_for(192)
                self.assertAlmostEqual(self.state()['player']['x'], after['x'], delta=.001)
                self.assertAlmostEqual(self.state()['player']['y'], after['y'], delta=.001)
                self.assertFalse(self.state()['joystick']['active'])

                before = self.state()['player']['x']
                self.move(.5, 0)
                self.page.clock.run_for(192)
                half = self.state()['player']['x'] - before
                before = self.state()['player']['x']
                self.move(-1, 0)
                self.page.clock.run_for(192)
                full = before - self.state()['player']['x']
                self.assertAlmostEqual(full / half, 2, delta=.02)
                self.move(3, -1)
                vector = self.state()['joystick']
                self.assertAlmostEqual(vector['strength'], 1)
                self.assertAlmostEqual(vector['y'] / vector['x'], -1 / 3)
                self.move(0, 0)

    def test_view_blur_close_and_release_cancel_without_resuming(self):
        for kind, view in [('piano', 'keyboard'), ('classroom', 'books'), ('cave', 'collection')]:
            with self.subTest(room=kind):
                self.open_room(kind)
                self.move(.6, -.2)
                self.page.evaluate('view=>actor.setMobileView(view)', view)
                self.assertFalse(self.state()['joystick']['active'])
                self.assertFalse(self.move(1, 0))
                self.page.evaluate("actor.setMobileView('room')")
                before = self.state()['player']
                self.page.clock.run_for(192)
                self.assertEqual(self.state()['player'], before)
                self.move(1, 0)
                self.page.evaluate('actor.releaseControls()')
                self.assertFalse(self.state()['joystick']['active'])
                self.move(1, 0)
                self.page.evaluate("dispatchEvent(new Event('blur'))")
                self.assertFalse(self.state()['joystick']['active'])
                self.move(1, 0)
                self.page.evaluate('actor.close()')
                self.assertFalse(self.state()['joystick']['active'])
                self.assertFalse(self.move(1, 0))

    def test_neutral_stick_preserves_independent_piano_jump(self):
        self.open_room('piano')
        self.move(.5, 0)
        self.page.evaluate("actor.control(' ',true)")
        self.page.clock.run_for(48)
        before = self.state()['player']
        self.assertGreater(before['jump'], 0)
        self.move(0, 0)
        self.page.clock.run_for(48)
        after = self.state()['player']
        self.assertAlmostEqual(after['x'], before['x'], delta=.001)
        self.assertGreater(after['jump'], before['jump'])
        self.page.evaluate("actor.control(' ',false)")

    def test_cave_boat_uses_analog_angle_and_water_collision(self):
        self.open_room('cave')
        for x, y in [(178, 342), (218, 380)]:
            for _ in range(100):
                state = self.state()['player']
                dx, dy = x - state['x'], y - state['y']
                distance = (dx * dx + dy * dy) ** .5
                if distance < 3:
                    break
                scale = max(15, distance)
                self.move(dx / scale, dy / scale)
                self.page.clock.run_for(48)
            self.move(0, 0)
            self.assertLess(distance, 3)
        self.page.locator('#fishingBoatBoard').tap()
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')
        before = self.state()['boat']
        self.move(.6, -.2)
        self.page.clock.run_for(192)
        after = self.state()['boat']
        self.assertGreater(after['x'], before['x'] + 10)
        self.assertAlmostEqual(
            (after['y'] - before['y']) / (after['x'] - before['x']), -1 / 3, delta=.001)
        self.move(0, -1)
        self.page.clock.run_for(4800)
        self.assertTrue(self.page.evaluate(
            'CodaFishingCaveLayout.isBoatWater(actor.getState().boat.x,actor.getState().boat.y)'))
        self.move(0, 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
