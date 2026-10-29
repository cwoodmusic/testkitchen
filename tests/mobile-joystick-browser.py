"""Actual multi-touch joystick vectors, movement speed and room lifecycles."""
import importlib.util
import math
from pathlib import Path
from world_navigation_helpers import enter_room
import sys
import unittest

sys.dont_write_bytecode=True
from mobile_joystick_helpers import joystick_geometry,joystick_point
_spec=importlib.util.spec_from_file_location('joystick_mobile_world',Path(__file__).with_name('mobile-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)
_base=_world.MobileWorldTests


class MobileJoystickTests(unittest.TestCase):
    setUpClass=classmethod(_base.setUpClass.__func__)
    tearDownClass=classmethod(_base.tearDownClass.__func__)
    tearDown=_base.tearDown
    load=_base.load
    touch=_base.touch
    position=_base.position
    place=_base.place
    button_point=_base.button_point

    def setUp(self):
        _world.MobileWorldTests.setUp(self)
        self.page.clock.install()
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.clock.run_for(64)
        self.points={}

    def down(self,point):
        self.points[point['id']]=point
        self.cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':list(self.points.values())})

    def drag(self,point):
        self.points[point['id']]=point
        self.cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':list(self.points.values())})

    def up(self,identifier):
        ended=self.points.pop(identifier)
        self.cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[ended] if self.points else []})

    def cancel(self):
        self.points.clear()
        self.cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})

    def element_point(self,selector,identifier):
        self.page.locator(selector).scroll_into_view_if_needed()
        box=self.page.locator(selector).bounding_box();self.assertIsNotNone(box)
        return {'id':identifier,'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}

    def activate_panel(self,selector):
        # Native menus need a click; secondary touch contacts do not synthesize
        # one while the primary steering finger remains down in Chromium.
        self.page.locator(selector).click();self.page.clock.run_for(160)

    def assert_neutral(self):
        stick=self.touch()['joystick']
        self.assertFalse(stick['active']);self.assertEqual(stick['strength'],0)
        self.assertEqual(stick['x'],0);self.assertEqual(stick['y'],0)

    def open_room(self,selector):
        enter_room(self.page,selector)
        self.page.clock.run_for(550)

    def walk_room(self,expression,x,y,speed):
        # Follow the pier's diagonal; moving each axis all the way first can
        # ask the avatar to walk through water beside the slanted dock.
        for _ in range(120):
            current=self.page.evaluate(expression)
            dx,dy=x-current['x'],y-current['y']
            if math.hypot(dx,dy)<4:break
            directions=[]
            if abs(dx)>2:directions.append('d' if dx>0 else 'a')
            if abs(dy)>2:directions.append('s' if dy>0 else 'w')
            for key in directions:self.page.keyboard.down(key)
            self.page.clock.run_for(max(16,min(50,round(math.hypot(dx,dy)/speed*1000))))
            for key in directions:self.page.keyboard.up(key)
        current=self.page.evaluate(expression)
        self.assertLess(math.hypot(x-current['x'],y-current['y']),7,
            'A real keyboard route should reach the dock without bypassing collision')

    def test_world_joystick_has_real_angle_strength_deadzone_and_outside_capture(self):
        self.place(1225,675)
        start=self.position();self.down(joystick_point(self.page,.1,0))
        self.page.clock.run_for(240)
        self.assertTrue(self.touch()['joystick']['active']);self.assertEqual(self.touch()['joystick']['strength'],0)
        self.assertEqual(self.position(),start,'A resting thumb in the center deadzone must not walk')
        self.up(1);self.assert_neutral()
        self.down(joystick_point(self.page,1,.35));self.page.clock.run_for(160)
        diagonal=self.position();dx=diagonal['x']-start['x'];dy=diagonal['y']-start['y']
        self.assertGreater(dx,15);self.assertGreater(dy,3)
        self.assertAlmostEqual(dy/dx,.35,delta=.05,msg='Steering must preserve non-45-degree angles')
        self.assertGreater(self.touch()['joystick']['strength'],.98)
        self.up(1);self.page.clock.run_for(32);self.assert_neutral()
        stopped=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),stopped)
        distances=[]
        for raw in [.4,1]:
            self.place(1225,675);before=self.position()
            self.down(joystick_point(self.page,raw,0));self.page.clock.run_for(200)
            distances.append(self.position()['x']-before['x']);self.up(1);self.page.clock.run_for(16)
        self.assertGreater(distances[0],distances[1]*.1)
        self.assertLess(distances[0],distances[1]*.65,'A light push should walk more slowly than a full push')
        self.place(1225,675);self.down(joystick_point(self.page,1,0));self.page.clock.run_for(64)
        before=self.position();self.drag(joystick_point(self.page,3,0));self.page.clock.run_for(160)
        self.assertGreater(self.position()['x'],before['x']+15,'Captured movement continues beyond the base')
        geometry=joystick_geometry(self.page);thumb=geometry['thumb'];base=geometry['base']
        self.assertLessEqual(thumb['x']+thumb['width'],base['x']+base['width']-2)
        self.assertGreaterEqual(thumb['x'],base['x']+2)
        self.drag(joystick_point(self.page,0,0));self.page.clock.run_for(32)
        center=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),center)
        self.up(1);self.assert_neutral()

    def test_second_finger_jump_menu_cancel_and_rotation_do_not_leave_movement(self):
        self.place(1225,675);self.down(joystick_point(self.page,1,0));self.page.clock.run_for(64)
        self.down(self.element_point('.coda-touch-jump',2));self.page.clock.run_for(80)
        self.assertGreater(self.page.evaluate('CodaArcadeQA.characters().player.jumpHeight'),5)
        self.assertTrue(self.touch()['joystick']['active'])
        self.up(2);before=self.position();self.page.clock.run_for(100)
        self.assertGreater(self.position()['x'],before['x']+8,'Lifting Jump must keep the steering finger active')
        self.activate_panel('#worldMenuBtn')
        self.assertFalse(self.touch()['visible']);self.assert_neutral()
        stopped=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),stopped)
        self.page.keyboard.press('Escape');self.page.clock.run_for(32)
        self.drag(joystick_point(self.page,1,0));self.page.clock.run_for(160)
        self.assertEqual(self.position(),stopped,'Closing a menu must require a fresh steering contact')
        self.up(1);self.down(joystick_point(self.page,1,0));self.page.clock.run_for(64)
        self.cancel();self.assert_neutral();stopped=self.position();self.page.clock.run_for(160)
        self.assertEqual(self.position(),stopped)
        self.down(joystick_point(self.page,1,0));self.page.clock.run_for(64)
        self.page.set_viewport_size({'width':844,'height':390});self.page.clock.run_for(64)
        self.assert_neutral();stopped=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),stopped)
        self.up(1)
        self.down(joystick_point(self.page,1,0));self.page.clock.run_for(64)
        self.page.evaluate('dispatchEvent(new Event("blur"))');self.page.clock.run_for(32)
        self.assert_neutral();stopped=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),stopped)
        self.up(1)

    def test_room_vectors_route_to_piano_classroom_and_boat_then_clear_on_panels(self):
        self.open_room('piano');self.assertEqual(self.touch()['context'],'piano')
        world=self.position()
        for getter in ['CodaArcadeQA.piano()']:
            before=self.page.evaluate(getter+'.player')
            self.down(joystick_point(self.page,.9,-.3));self.page.clock.run_for(140)
            after=self.page.evaluate(getter+'.player')
            self.assertGreater(after['x'],before['x']+10);self.assertLess(after['y'],before['y']-2)
            self.assertAlmostEqual((after['y']-before['y'])/(after['x']-before['x']),-1/3,delta=.06)
            self.up(1);self.page.clock.run_for(32);stopped=self.page.evaluate(getter+'.player')
            self.page.clock.run_for(160);self.assertEqual(self.page.evaluate(getter+'.player'),stopped)
        self.assertEqual(self.position(),world,'Room input must not move the main arcade character')
        self.page.locator('#closepiano').click();self.page.clock.run_for(32);self.assert_neutral()
        self.open_room('classroom');self.assertEqual(self.touch()['context'],'classroom')
        before=self.page.evaluate('CodaArcadeQA.classroom().player')
        self.down(joystick_point(self.page,.9,-.3));self.page.clock.run_for(140)
        after=self.page.evaluate('CodaArcadeQA.classroom().player')
        self.assertGreater(after['x'],before['x']+10);self.assertLess(after['y'],before['y']-2)
        # The classroom library opens through Haydn rather than a room-tab shortcut.
        self.drag(joystick_point(self.page,0,-1));self.page.clock.run_for(900)
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.press('e');self.page.clock.run_for(160)
        self.assertFalse(self.touch()['visible']);self.assert_neutral()
        stopped=self.page.evaluate('CodaArcadeQA.classroom().player');self.page.clock.run_for(160)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.classroom().player'),stopped)
        self.up(1);self.page.locator('#classroomClose').click();self.page.clock.run_for(32)
        self.open_room('fishing');self.assertEqual(self.touch()['context'],'fishing')
        before=self.page.evaluate('CodaArcadeQA.fishing().player')
        self.down(joystick_point(self.page,.9,-.3));self.page.clock.run_for(100)
        after=self.page.evaluate('CodaArcadeQA.fishing().player')
        self.assertGreater(after['x'],before['x']+8);self.assertLess(after['y'],before['y']-1)
        self.up(1);self.page.locator('#fishingLakeCanvas').focus()
        self.walk_room('CodaArcadeQA.fishing().player',135,315,160)
        self.walk_room('CodaArcadeQA.fishing().player',178,342,160)
        self.walk_room('CodaArcadeQA.fishing().player',218,380,160)
        self.page.keyboard.press('e');self.page.clock.run_for(64)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.fishing().phase'),'explore')
        before=self.page.evaluate('CodaArcadeQA.fishing().boat')
        self.down(joystick_point(self.page,.9,-.3));self.page.clock.run_for(140)
        after=self.page.evaluate('CodaArcadeQA.fishing().boat')
        self.assertGreater(after['x'],before['x']+10);self.assertLess(after['y'],before['y']-2)
        self.activate_panel('#fishingMenuButton')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fishing().menuOpen'))
        self.assertFalse(self.touch()['visible']);self.assert_neutral()
        stopped=self.page.evaluate('CodaArcadeQA.fishing().boat');self.page.clock.run_for(160)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.fishing().boat'),stopped)
        self.up(1);self.page.locator('#fishingMenuClose').click();self.page.clock.run_for(32)
        self.assertEqual(self.touch()['context'],'fishing');self.assert_neutral()

    def test_focused_joystick_keyboard_directions_stop_on_blur(self):
        self.place(1225,675);base=self.position()
        self.page.locator('.coda-joystick').focus();self.page.keyboard.down('ArrowRight');self.page.clock.run_for(120)
        first=self.position();self.assertGreater(first['x'],base['x']+12)
        self.page.keyboard.down('ArrowUp');self.page.clock.run_for(100)
        diagonal=self.position();self.assertGreater(diagonal['x'],first['x']+7);self.assertLess(diagonal['y'],first['y']-7)
        self.page.keyboard.up('ArrowUp');self.page.clock.run_for(32)
        self.page.locator('.coda-touch-jump').focus();self.page.clock.run_for(32)
        self.assert_neutral();stopped=self.position();self.page.clock.run_for(160);self.assertEqual(self.position(),stopped)
        self.page.keyboard.up('ArrowRight');self.assert_neutral()


del _base

if __name__=='__main__':unittest.main(verbosity=2)
