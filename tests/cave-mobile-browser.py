"""Check the cave's close mobile viewport through actual navigation and touches."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest
sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('cave_mobile_world',Path(__file__).with_name('fishing-world-browser.py'))
_fish=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fish)

class CaveMobileTests(_fish._world.WorldBrowserCase):
    setUp=_fish.FishingWorldTests.setUp
    fishing_option=_fish.FishingWorldTests.fishing_option
    state=_fish.FishingWorldTests.state
    portal=_fish.FishingWorldTests.portal
    place=_fish.FishingWorldTests.place
    enter=_fish.FishingWorldTests.enter

    def point(self,x,y):
        box=self.page.locator('#fishingLakeCanvas').bounding_box();camera=self.state()['camera']
        return {'x':box['x']+(x-camera['x'])*camera['zoom']/1000*box['width'],
                'y':box['y']+(y-camera['y'])*camera['zoom']/620*box['height']}

    def walk(self,x,y):
        _fish.FishingWorldTests.walk_to(self,x,y)
        player=self.state()['player']
        self.assertLess(math.hypot(player['x']-x,player['y']-y),8,
                        'The avatar should reach the pier through the enlarged viewport')

    def assert_visible_actor(self,key):
        state=self.state();point=self.point(state[key]['x'],state[key]['y'])
        scene=self.page.locator('.fishing-cave-scene').bounding_box()
        self.assertGreaterEqual(point['x'],scene['x']+1);self.assertLessEqual(point['x'],scene['x']+scene['width']-1)
        self.assertGreaterEqual(point['y'],scene['y']+20);self.assertLessEqual(point['y'],scene['y']+scene['height']-1)
        self.assertTrue(self.page.evaluate('p=>document.elementFromPoint(p.x,p.y)?.id==="fishingLakeCanvas"',point),
            'The actor should stay visible without a control covering its feet')

    def test_mobile_connected_world_fills_height_and_keeps_actor_visible_after_rotation_phone(self):
        self.enter();saved=self.page.evaluate("localStorage.getItem('codaRhythmFishingV1')")
        self.assertEqual(self.state()['screen']['id'],'lantern-lake',
                         'Exercise the connected world that previously forced the cave to a short strip')
        for size in [{'width':390,'height':844},{'width':360,'height':800},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(120)
            scene=self.page.locator('.fishing-cave-scene').bounding_box();canvas=self.page.locator('#fishingLakeCanvas').bounding_box()
            heading=self.page.locator('.fishing-heading').bounding_box()
            self.assertGreater(scene['height'],size['height']*.75,
                'The cave must fill the room below its header instead of leaving most of the phone blank')
            self.assertGreaterEqual(scene['y'],heading['y']+heading['height']-1)
            self.assertLessEqual(scene['y']+scene['height'],size['height']+1)
            # Four border pixels plus at most one CSS pixel of clientWidth/
            # clientHeight rounding are outside the drawable scene interior.
            self.assertGreaterEqual(canvas['height'],scene['height']-5,
                'The camera must cover the taller mobile scene with actual cave art')
            self.assertGreaterEqual(canvas['width'],scene['width']-5)
            self.assertEqual(self.state()['camera']['zoom'],1,
                'The connected world retains its base zoom while the viewport scales the canvas to cover')
            self.assertAlmostEqual(canvas['width']/canvas['height'],1000/620,delta=.002)
            self.assertLessEqual(self.page.locator('#rhythmFishing').evaluate('node=>node.scrollWidth'),size['width'])
            self.assertFalse(self.page.locator('#fishingMeter').is_visible())
            self.assertTrue(self.page.locator('#fishingMenuButton').is_visible())
            direction=self.page.locator('.coda-joystick').bounding_box()
            self.assertGreaterEqual(direction['width'],120)
            self.assertAlmostEqual(direction['height'],direction['width'],delta=1)
            self.assertGreaterEqual(self.page.locator('.coda-joystick-thumb').bounding_box()['width'],44)
            action=self.page.locator('.coda-touch-interact').bounding_box()
            self.assertGreaterEqual(action['height'],44)
            for control in [direction,action]:
                self.assertGreaterEqual(control['x'],0);self.assertGreaterEqual(control['y'],0)
                self.assertLessEqual(control['x']+control['width'],size['width'])
                self.assertLessEqual(control['y']+control['height'],size['height'])
            self.assert_visible_actor('player')
            self.assertEqual(self.page.evaluate("localStorage.getItem('codaRhythmFishingV1')"),saved)
            self.page.screenshot(path='/tmp/coda-cave-mobile-fill-'+str(size['width'])+'.png')

    def test_close_view_boat_steering_and_pinch_are_correct_and_editor_stays_independent_phone(self):
        self.enter();pier=self.state()['boardingPoint'];self.walk(pier['x'],pier['y'])
        _fish.FishingWorldTests.fishing_action(self,'#fishingBoatBoard');self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'],'explore')
        # Row south past the pier piles before testing sideways touch steering.
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.down('s')
        self.page.clock.run_for(160);self.page.keyboard.up('s');self.page.clock.run_for(32)
        self.assert_visible_actor('boat')
        before=self.state()['boat'];point={'id':1,**self.point(before['x']+28,before['y'])}
        client=self.context.new_cdp_session(self.page)
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});self.page.clock.run_for(180)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.page.clock.run_for(32)
        self.assertGreater(self.state()['boat']['x'],before['x']+15)
        scene=self.page.locator('.fishing-cave-scene').bounding_box();x,y=scene['x'],scene['y'];w,h=scene['width'],scene['height']
        points=[{'id':1,'x':x+w*.45,'y':y+h*.4},{'id':2,'x':x+w*.55,'y':y+h*.4}]
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        stopped=self.state()['boat']
        points=[{'id':1,'x':x+w*.25,'y':y+h*.4},{'id':2,'x':x+w*.75,'y':y+h*.4}]
        client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points});self.page.clock.run_for(180)
        self.assertEqual(self.state()['camera']['zoom'],3);self.assertEqual(self.state()['boat'],stopped)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach();self.page.clock.run_for(32)
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.press('F2');self.page.clock.run_for(32)
        canvas=self.page.locator('#fishingLakeCanvas').bounding_box();scene=self.page.locator('.fishing-cave-scene').bounding_box()
        self.assertAlmostEqual(canvas['width'],scene['width']-4,delta=2)
        self.assertEqual(self.state()['editor']['camera']['zoom'],1)
        self.page.keyboard.press('F2');self.page.clock.run_for(32);self.assertEqual(self.state()['camera']['zoom'],3)

    def test_menu_hides_extra_tools_stops_movement_and_saves_music_volume_phone(self):
        self.enter();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.assertFalse(self.page.locator('.fishing-lake-toolbar').is_visible())
        self.assertFalse(self.page.locator('#fishingCollection').is_visible())
        self.page.locator('#fishingLakeCanvas').focus();self.page.keyboard.down('d');self.page.clock.run_for(80)
        self.page.locator('#fishingMenuButton').click();self.page.clock.run_for(32)
        self.assertTrue(self.state()['menuOpen']);self.assertFalse(self.page.evaluate('CodaArcadeQA.touch().visible'))
        stopped=self.state()['player'];self.page.clock.run_for(250);self.assertEqual(self.state()['player'],stopped)
        self.assertFalse(self.page.locator('#fishingMeter').is_visible())
        self.assertEqual(self.state()['meter'],'4/4','The current biome owns the encounter meter')
        for selector in ['#fishingMenuClose','#fishingCollection','#fishingLakeAudio','#fishingPractice']:
            self.assertGreaterEqual(self.page.locator(selector).bounding_box()['height'],44)
        self.page.screenshot(path='/tmp/coda-fishing-menu42-390.png')
        self.page.keyboard.press('Escape');self.page.clock.run_for(64)
        self.assertFalse(self.state()['menuOpen']);self.assertTrue(self.page.evaluate('CodaArcadeQA.touch().visible'))
        self.page.clock.run_for(160);self.assertEqual(self.state()['player'],stopped)
        self.page.keyboard.up('d')
        self.fishing_option('#fishingLakeAudio').click();self.assertTrue(self.state()['audio']['settingsOpen'])
        volume=self.page.locator('#fishingMusicVolume');volume.focus();self.page.keyboard.press('End');self.page.keyboard.press('ArrowLeft')
        self.assertEqual(self.state()['audio']['prefs']['musicVolume'],99)
        self.assertEqual(self.page.locator('#fishingMusicVolumeValue').inner_text(),'99%')
        self.assertTrue(self.page.evaluate("JSON.parse(localStorage.getItem('codaFishingAudioV1')).musicVolume===99"))
        self.page.locator('#fishingAudioClose').click();self.page.set_viewport_size({'width':844,'height':390});self.page.clock.run_for(96)
        self.assertFalse(self.page.locator('.fishing-lake-toolbar').is_visible());self.assert_visible_actor('player')
        self.page.screenshot(path='/tmp/coda-fishing-room42-844.png')
        self.page.locator('#fishingMenuButton').click();self.page.screenshot(path='/tmp/coda-fishing-menu42-844.png')
        self.assertLessEqual(self.page.locator('#fishingMenuPanel').evaluate('node=>node.scrollWidth'),self.page.locator('#fishingMenuPanel').bounding_box()['width'])

    def test_desktop_retains_the_complete_uncropped_cave(self):
        self.enter();state=self.state();canvas=self.page.locator('#fishingLakeCanvas').bounding_box()
        self.assertEqual(state['camera']['zoom'],1)
        self.assertAlmostEqual(state['camera']['visibleWidth'],1000,delta=.1)
        self.assertAlmostEqual(canvas['width']/canvas['height'],1000/620,delta=.001)
        self.assertLess(canvas['height'],800)

if __name__=='__main__':unittest.main(verbosity=2)
