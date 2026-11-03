"""Observe real stage beams illuminating the painted dancefloor, without services."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('stage_light_world', Path(__file__).with_name('learning-world-browser.py'))
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)

PROBE = '''
(()=>{
 const original=CodaDJFloodlights;
 window.CodaDJFloodlights={...original,create(api){
  const instance=original.create(api),draw=instance.drawBeams;
  instance.drawBeams=function(ctx){
   let points=null,before=null,enabled=false;
   if(ctx?.canvas?.id==='view'){
    const rig=instance.snapshot().rigs.find(rig=>rig.id==='asset-19');
    if(rig){
     enabled=rig.enabled;
     const transform=ctx.getTransform();
     points=rig.heads.map(head=>({x:head.x+(head.endX-head.x)*.7,y:head.y+(head.endY-head.y)*.7}))
      .map(point=>({x:Math.floor(transform.a*point.x+transform.c*point.y+transform.e),
                    y:Math.floor(transform.b*point.x+transform.d*point.y+transform.f)}));
     before=points.map(point=>[...ctx.getImageData(point.x,point.y,1,1).data]);
    }
   }
   draw.call(instance,ctx);
   if(points)window.__stageBeamPixels={enabled,before,after:points.map(point=>[...ctx.getImageData(point.x,point.y,1,1).data])};
  };
  return instance;
 }};
})();
'''


class DJStageLightingTests(world.WorldBrowserCase):
    def rig(self):
        return self.page.evaluate("CodaArcadeQA.floodLights().rigs.find(rig=>rig.id==='asset-19')")

    def test_four_beams_reach_and_brighten_the_actual_dancefloor(self):
        source = (world.ROOT/'dj-floodlights.js').read_text()+PROBE
        self.context.route('**/dj-floodlights.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body=source))
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','full');localStorage.setItem('arcadeAnimations','on')")
        self.load()
        self.page.wait_for_function('window.__stageBeamPixels')
        rig = self.rig()
        self.assertTrue(rig['enabled'])
        self.assertEqual(rig['settings']['beamLength'],280)
        self.assertEqual(rig['settings']['intensity'],75)
        for head in rig['heads']:
            self.assertAlmostEqual(head['y'],539.84)
            self.assertAlmostEqual(head['endY'],819.84)
            self.assertGreater(head['endX'],120)
            self.assertLess(head['endX'],680)
        samples = self.page.evaluate('window.__stageBeamPixels')
        deltas = [sum(after[:3])-sum(before[:3]) for before,after in zip(samples['before'],samples['after'])]
        self.assertGreaterEqual(sum(delta>25 for delta in deltas),3,
            'At least three physical cans must clearly illuminate the real colored panels: '+str(deltas))
        self.page.evaluate("localStorage.setItem('arcadeAnimations','off')")
        still = self.rig()['heads']
        self.page.wait_for_timeout(220)
        self.assertEqual(self.rig()['heads'],still)
        self.page.evaluate("localStorage.setItem('arcadeAnimations','on')")
        self.page.emulate_media(reduced_motion='reduce')
        reduced = self.rig()['heads']
        self.page.wait_for_timeout(220)
        self.assertEqual(self.rig()['heads'],reduced)
        self.page.emulate_media(reduced_motion='no-preference')
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.page.locator('#assetList').select_option('asset-19')
        self.page.locator('#devFloodEnabled').uncheck()
        self.page.wait_for_function('window.__stageBeamPixels?.enabled===false')
        disabled = self.page.evaluate('window.__stageBeamPixels')
        self.assertFalse(self.rig()['enabled'])
        self.assertEqual(disabled['before'],disabled['after'],
            'Disabling the real fixture must remove its projected light, leaving other neon intact')
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.load()
        self.assertFalse(self.rig()['enabled'])


if __name__=='__main__':
    unittest.main(verbosity=2)
