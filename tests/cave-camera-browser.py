"""Pinch the live cave with real captured touch pointers, then steer and cast."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('cave_camera_fishing_world',Path(__file__).with_name('fishing-world-browser.py'))
_fish=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fish)

class CaveCameraTests(_fish._world.WorldBrowserCase):
    setUp=_fish.FishingWorldTests.setUp
    state=_fish.FishingWorldTests.state
    portal=_fish.FishingWorldTests.portal
    place=_fish.FishingWorldTests.place
    enter=_fish.FishingWorldTests.enter
    walk_to=_fish.FishingWorldTests.walk_to
    board=_fish.FishingWorldTests.board
    approach_shadow=_fish.FishingWorldTests.approach_shadow

    def load(self):
        # The camera remains optional in older isolated room fixtures.
        self.page.add_init_script(path=str(_fish._world.ROOT/'cave-camera.js'))
        _fish._world.WorldBrowserCase.load(self)

    def point(self,x,y):
        canvas=self.page.locator('#fishingLakeCanvas');canvas.scroll_into_view_if_needed()
        box=canvas.bounding_box();camera=self.state()['camera']
        return {'x':box['x']+(x-camera['x'])*camera['zoom']/1000*box['width'],
                'y':box['y']+(y-camera['y'])*camera['zoom']/620*box['height']}

    def begin_pinch(self):
        canvas=self.page.locator('#fishingLakeCanvas');canvas.scroll_into_view_if_needed();box=self.page.locator('.fishing-cave-scene').bounding_box()
        x,y=box['x'],box['y'];w,h=box['width'],box['height']
        client=self.context.new_cdp_session(self.page)
        points=[{'id':1,'x':x+w*.4,'y':y+h*.5},{'id':2,'x':x+w*.6,'y':y+h*.5}]
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        points=[{'id':1,'x':x+w*.2,'y':y+h*.5},{'id':2,'x':x+w*.8,'y':y+h*.5}]
        client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points})
        self.page.clock.run_for(96)
        return client,points

    def test_pinch_freezes_walking_until_every_finger_lifts_and_rotation_clears_capture_phone(self):
        self.enter();before=self.state()['player'];client,points=self.begin_pinch()
        state=self.state();self.assertAlmostEqual(state['camera']['zoom'],3,delta=.03)
        self.assertTrue(state['fingerWalk']['suppressed']);self.assertFalse(state['fingerWalk']['following'])
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.down('d');self.page.clock.run_for(400);self.page.keyboard.up('d')
        self.assertAlmostEqual(self.state()['player']['x'],before['x'],delta=.01)
        self.assertAlmostEqual(self.state()['player']['y'],before['y'],delta=.01)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[points[1]]})
        self.page.clock.run_for(160);self.assertTrue(self.state()['camera']['pinching'])
        self.page.keyboard.down('d');self.page.clock.run_for(250);self.page.keyboard.up('d')
        self.assertAlmostEqual(self.state()['player']['x'],before['x'],delta=.01)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach()
        self.page.clock.run_for(64);self.assertFalse(self.state()['camera']['pinching'])
        self.page.keyboard.down('d');self.page.clock.run_for(120);self.page.keyboard.up('d')
        self.assertGreater(self.state()['player']['x'],before['x']+10)
        client,_=self.begin_pinch();self.page.set_viewport_size({'width':844,'height':390});self.page.clock.run_for(160)
        self.assertFalse(self.state()['camera']['pinching']);self.assertEqual(self.state()['fingerWalk']['pointerCount'],0)
        client.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]});client.detach()
        position=self.state()['player'];self.page.clock.run_for(500);self.assertEqual(self.state()['player'],position)

    def test_zoomed_boat_steering_and_casting_use_world_coordinates_and_pinch_cannot_cast_phone(self):
        self.enter();self.board();self.approach_shadow();before=self.state()['boat'];client,_=self.begin_pinch()
        self.page.locator('#fishingCast').evaluate('(button)=>button.click()');self.page.clock.run_for(400)
        self.assertEqual(self.state()['phase'],'explore');self.assertEqual(self.state()['boat'],before)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach();self.page.clock.run_for(64)
        boat=self.state()['boat'];target={'x':boat['x']+36,'y':boat['y']}
        self.assertTrue(self.page.evaluate('p=>CodaFishingCaveLayout.isBoatWater(p.x,p.y)',target))
        point={'id':1,**self.point(target['x'],target['y'])};client=self.context.new_cdp_session(self.page)
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});self.page.clock.run_for(220)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach();self.page.clock.run_for(32)
        self.assertGreater(self.state()['boat']['x'],boat['x']+20)
        # A close phone viewport shows less than the full casting radius. Move
        # close enough to see the shadow before testing its mouse coordinates.
        for _ in range(15):
            state=self.state();fish=min((fish for fish in state['shadows'] if fish['visible']),key=lambda fish:math.hypot(fish['x']-state['boat']['x'],fish['y']-state['boat']['y']))
            dx,dy=fish['x']-state['boat']['x'],fish['y']-state['boat']['y']
            if math.hypot(dx,dy)<25:break
            keys=(['d' if dx>0 else 'a'] if abs(dx)>5 else [])+(['s' if dy>0 else 'w'] if abs(dy)>5 else [])
            for key in keys:self.page.keyboard.down(key)
            self.page.clock.run_for(80)
            for key in keys:self.page.keyboard.up(key)
        state=self.state();fish=min((fish for fish in state['shadows'] if fish['visible']),key=lambda fish:math.hypot(fish['x']-state['boat']['x'],fish['y']-state['boat']['y']))
        self.assertLess(math.hypot(fish['x']-state['boat']['x'],fish['y']-state['boat']['y']),135)
        point=self.point(fish['x'],fish['y']);self.page.mouse.click(point['x'],point['y']);self.page.clock.run_for(64)
        self.assertEqual(self.state()['phase'],'bite')
        self.assertEqual(next(item for item in self.state()['shadows'] if item['id']==fish['id'])['visible'],False)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)

    def test_normal_camera_controls_and_developer_camera_stay_independent_phone(self):
        self.enter();self.page.locator('[aria-label="Zoom cave in"]').click();self.page.clock.run_for(64)
        self.assertEqual(self.state()['camera']['zoom'],2.25)
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('F2');self.page.clock.run_for(64)
        panel=self.page.locator('[data-room-editor="fishing"]');self.assertTrue(panel.is_visible())
        self.assertEqual(self.page.locator('.cave-camera-controls:visible').count(),0)
        self.assertEqual(self.state()['editor']['camera']['zoom'],1)
        panel.locator('[data-room-action="zoom-in"]').click();panel.locator('[data-room-action="zoom-in"]').click()
        self.assertEqual(self.state()['editor']['camera']['zoom'],1.5);self.assertEqual(self.state()['camera']['zoom'],2.25)
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('F2');self.page.clock.run_for(64)
        self.assertFalse(self.state()['editor']['open']);self.assertEqual(self.state()['camera']['zoom'],2.25)
        self.page.locator('[aria-label="Reset cave zoom"]').click();self.page.clock.run_for(64);self.assertEqual(self.state()['camera']['zoom'],1)

if __name__=='__main__':unittest.main(verbosity=2)
