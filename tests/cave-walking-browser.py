"""Actual cave movement supplies walking poses, including mouse destinations.

The existing fishing fixture runs real controls, collisions, and renderer.
Observe only its draw inputs and normalized rendered pixels; add no game API.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('cave_walk_fixture',Path(__file__).with_name('rhythm-fishing-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class CaveWalkingTests(unittest.TestCase):
    setUpClass=classmethod(fixture.RhythmFishingTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.RhythmFishingTests.tearDownClass.__func__)
    setUp=fixture.RhythmFishingTests.setUp
    tearDown=fixture.RhythmFishingTests.tearDown
    state=fixture.RhythmFishingTests.state

    def load(self):
        self.context.add_init_script('''(()=>{
          let factory;
          window.__caveWalkFrames=[];
          Object.defineProperty(window,'createCodaCharacterRenderer',{
            configurable:true,get:()=>factory,set:original=>{factory=(...args)=>{
              const renderer=original(...args),draw=renderer.drawPlayer;
              renderer.drawPlayer=function(context,profile,motion,time){
                if(context.canvas.id==='fishingLakeCanvas'&&!motion.pixelTarget){
                  const frame=renderer.renderPixelFrame('player',profile,motion,time);
                  __caveWalkFrames.push({walking:motion.walking===true,phase:motion.phase,
                    pixels:frame.toDataURL()});
                  if(__caveWalkFrames.length>200)__caveWalkFrames.shift();
                }
                return draw.call(this,context,profile,motion,time);
              };return renderer;
            };}
          });
        })()''')
        fixture.RhythmFishingTests.load(self)

    def frames(self):
        return self.page.evaluate('__caveWalkFrames')

    def clear_frames(self):
        self.page.evaluate('__caveWalkFrames=[]')

    def click_floor(self,x,y):
        point=self.page.evaluate('''([x,y])=>{
          const box=fishingLakeCanvas.getBoundingClientRect(),camera=lab.getState().camera;
          return {x:box.x+(x-camera.x)*camera.zoom/1000*box.width,
            y:box.y+(y-camera.y)*camera.zoom/620*box.height};
        }''',[x,y])
        self.page.mouse.click(**point)

    def assert_walking_frames(self):
        frames=[frame for frame in self.frames() if frame['walking']]
        self.assertGreater(len(frames),2,'Actual movement must request the walk pose')
        self.assertGreater(len({frame['pixels'] for frame in frames}),1,
                           'Walking must animate actual character pixels, not just set a flag')

    def test_mouse_destination_animates_until_arrival_then_returns_to_idle(self):
        before=self.state()['player'];self.clear_frames();self.click_floor(200,285)
        self.page.clock.run_for(192)
        after=self.state()['player']
        self.assertGreater(after['x'],before['x']+20)
        self.assertGreater(after['phase'],before['phase'])
        self.assert_walking_frames()
        self.page.clock.run_for(800);arrived=self.state()['player'];self.clear_frames()
        self.page.clock.run_for(160)
        self.assertAlmostEqual(self.state()['player']['x'],arrived['x'],delta=.001)
        self.assertFalse(any(frame['walking'] for frame in self.frames()))

    def test_collision_blocks_idle_while_keys_and_joystick_animate_real_movement(self):
        self.clear_frames();self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down('w');self.page.clock.run_for(160)
        self.assert_walking_frames()
        self.page.clock.run_for(1200);blocked=self.state()['player'];self.clear_frames()
        self.page.clock.run_for(160)
        self.assertAlmostEqual(self.state()['player']['y'],blocked['y'],delta=.001)
        self.assertFalse(any(frame['walking'] for frame in self.frames()),
                         'A held key against the cave boundary must not leave a walk pose')
        self.page.keyboard.up('w');self.clear_frames()
        self.assertTrue(self.page.evaluate('lab.controlMove(0,1)'))
        self.page.clock.run_for(192)
        self.assertGreater(self.state()['player']['y'],blocked['y']+20)
        self.assert_walking_frames()
        self.page.evaluate('lab.releaseControls()');self.clear_frames();self.page.clock.run_for(64)
        self.assertFalse(any(frame['walking'] for frame in self.frames()))

    def test_opening_menu_clears_a_mouse_walk_without_resuming_it(self):
        self.click_floor(200,285);self.page.clock.run_for(96)
        self.assertTrue(any(frame['walking'] for frame in self.frames()))
        self.page.locator('#fishingMenuButton').click();stopped=self.state()['player']
        self.clear_frames();self.page.clock.run_for(160)
        self.assertEqual(self.state()['player'],stopped)
        self.assertFalse(any(frame['walking'] for frame in self.frames()))
        self.page.locator('#fishingMenuClose').click();self.clear_frames();self.page.clock.run_for(160)
        self.assertEqual(self.state()['player'],stopped)
        self.assertFalse(any(frame['walking'] for frame in self.frames()))


if __name__=='__main__':unittest.main(verbosity=2)
