"""Real rendered disco rays remain visible above cabinet floor cleanup.

The fixture only switches the production disco draw calls on/off while taking
same-time snapshots. Endpoint glows are excluded, so animated pin geometry
alone cannot make a hidden beam pass. No live services or existing saves.
"""
import importlib.util
import os
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('disco_visibility_fixture', ROOT / 'tests/published-world-browser.py')
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


SDK_WRAPPER = ''';(()=>{
 const create=window.createCodaWorldLighting;
 window.createCodaWorldLighting=options=>{
  const lighting=create(options);
  for(const name of ['drawBeams','drawDisco','drawFloorPins']){
   const draw=lighting[name];lighting[name]=(...args)=>{if(!window.fixtureHideDisco)draw(...args);};
  }
  return lighting;
 };
})();'''

PIXEL_ACCESSOR = '''window.fixtureDiscoRayPixels=sampleTime=>{
 const previousClock=clock,previousLightingClock=lightingClock;clock=sampleTime;lightingClock=sampleTime;
 try{
  const lights=worldLighting.snapshot(),left=682,top=310,width=453,height=65;
  const sample=enabled=>{
   window.fixtureHideDisco=!enabled;ambientLightStamp=-1;draw();
   return g.getImageData(Math.round(left-cam.x),Math.round(top-cam.y),width,height).data;
  };
  if(cam.zoom!==1)throw Error('Disco pixel witness requires native camera scale');
  const dark=sample(false),lit=sample(true);let samples=0,visible=0,energy=0,maxDelta=0,hash=2166136261;
  for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
   const x=left+xx,y=top+yy;
   if(![[682,777],[791,895],[912,1016],[1028,1135]].some(([a,b])=>x>=a&&x<b))continue;
   if(lights.spots.some(spot=>Math.hypot(spot.x-x,spot.y-y)<20))continue;
   samples++;let delta=0;const at=(yy*width+xx)*4;
   for(let c=0;c<3;c++)delta+=Math.max(0,lit[at+c]-dark[at+c]);
   if(delta>=6)visible++;energy+=delta;maxDelta=Math.max(maxDelta,delta);
   hash=Math.imul(hash^delta,16777619);
  }
  return {quality:lights.quality,reduced:lights.reducedMotion,samples,visible,energy,maxDelta,
   hash:hash>>>0,mainRays:lights.beams.filter(beam=>beam.ballId==='disco_ball_arcade').length};
 }finally{window.fixtureHideDisco=false;clock=previousClock;lightingClock=previousLightingClock;ambientLightStamp=-1;}
};\n'''


class DiscoVisibilityTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    setUp = fixture.PublishedWorldTests.setUp
    tearDown = fixture.PublishedWorldTests.tearDown

    def load(self, reduced=False):
        self.page.emulate_media(reduced_motion='reduce' if reduced else 'no-preference')
        source = Path(os.environ.get('CODA_DISCO_WORLD_SOURCE', ROOT / 'world-preview.html')).read_text()
        hook = 'window.CodaArcadeQA=Object.freeze({'
        self.assertEqual(source.count(hook), 1)
        source = source.replace(hook, PIXEL_ACCESSOR + hook, 1)
        self.context.route('**/world-lighting.js*', lambda route: route.fulfill(
            status=200, content_type='text/javascript', body=(ROOT / 'world-lighting.js').read_text() + SDK_WRAPPER))
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=source))
        fixture.PublishedWorldTests.load(self)

    def quality(self, value):
        self.page.locator('#worldMenuBtn').click()
        for _ in range(3):
            if self.page.evaluate('CodaArcadeQA.atmosphere().quality') == value:
                break
            self.page.locator('#fxBtn').click()
        self.page.locator('#worldMenuBtn').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'), value)

    def pixels(self, time):
        return self.page.evaluate('time=>fixtureDiscoRayPixels(time)', time)

    def test_full_and_lite_rays_are_visible_and_rotate_above_the_repaired_floor(self):
        self.load()
        for quality in ['full', 'lite']:
            with self.subTest(quality=quality):
                self.quality(quality)
                before, after = self.page.evaluate('()=>[fixtureDiscoRayPixels(1.25),fixtureDiscoRayPixels(4.25)]')
                self.assertGreater(before['samples'], 10000)
                self.assertGreater(before['mainRays'], 0)
                self.assertGreater(before['visible'], 50, before)
                self.assertGreater(after['visible'], 50, after)
                self.assertGreater(before['maxDelta'], 10, before)
                self.assertNotEqual(before['hash'], after['hash'], 'Rendered rays must circle, not just cached geometry')

    def test_effects_off_keeps_disco_projection_disabled(self):
        self.load()
        self.quality('off')
        result = self.pixels(1.25)
        self.assertEqual((result['mainRays'], result['visible'], result['energy']), (0, 0, 0))

    def test_live_reflections_keep_circling_when_rendering_frames_are_slow(self):
        self.load()
        self.quality('full')
        session=self.context.new_cdp_session(self.page)
        session.send('Emulation.setCPUThrottlingRate',{'rate':4})
        sample='''()=>({wall:performance.now()/1000,lights:CodaArcadeQA.lighting(),
          pixels:Array.from(document.querySelector('#view').getContext('2d').getImageData(300,680,100,60).data)
            .reduce((hash,value)=>Math.imul(hash^value,16777619),2166136261)})'''
        try:
            before=self.page.evaluate(sample)
            self.page.wait_for_timeout(1500)
            after=self.page.evaluate(sample)
        finally:
            session.send('Emulation.setCPUThrottlingRate',{'rate':1})
        elapsed=after['wall']-before['wall']
        self.assertGreater(after['lights']['time']-before['lights']['time'],elapsed*.7,
                           'Decorative orbits must use elapsed time rather than capped walking steps.')
        self.assertNotEqual(before['lights']['spots'],after['lights']['spots'])
        self.assertNotEqual(before['pixels'],after['pixels'],'The live canvas must keep repainting.')
        self.assertTrue(any(spot['trace'] for spot in after['lights']['spots']))

    def test_reduced_motion_keeps_visible_rays_steady(self):
        self.load(reduced=True)
        self.quality('full')
        before, after = self.page.evaluate('()=>[fixtureDiscoRayPixels(1.25),fixtureDiscoRayPixels(4.25)]')
        self.assertTrue(before['reduced'])
        self.assertGreater(before['visible'], 50, before)
        self.assertEqual(before['hash'], after['hash'])

    def test_disabling_the_ball_rays_keeps_the_main_projection_off(self):
        self.load()
        self.quality('full')
        self.page.evaluate('CodaDeveloperConsole.open("objects")')
        self.page.locator('#devCatalog').select_option('disco_ball_arcade')
        self.page.locator('#devLift').click()
        self.page.locator('#devDiscoRays').uncheck()
        self.page.locator('#view').focus()
        self.page.keyboard.press('F2')
        result = self.pixels(1.25)
        self.assertEqual((result['mainRays'], result['visible'], result['energy']), (0, 0, 0))


if __name__ == '__main__':
    unittest.main(verbosity=2)
