"""The reviewed arcade finishes preserve the rest of the room and saved data."""
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('arcade_finishing_fixture',
                                              Path(__file__).with_name('reflection-sources-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
BASELINE_SHA256 = '0cfab3fc6941b1e09c94e47555649091a4c44652d9a3dd3ad2c7c5360c795305'
PALETTE_SHA256 = '8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44'


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class ArcadeFinishingTests(unittest.TestCase):
    setUpClass = classmethod(_fixture.ReflectionSourceTests.setUpClass.__func__)
    tearDownClass = classmethod(_fixture.ReflectionSourceTests.tearDownClass.__func__)
    tearDown = _fixture.ReflectionSourceTests.tearDown
    load = _fixture.ReflectionSourceTests.load
    project = _fixture.ReflectionSourceTests.project
    frames = _fixture.ReflectionSourceTests.frames
    quality = _fixture.ReflectionSourceTests.quality
    seed = _fixture.ReflectionSourceTests.seed

    def setUp(self):
        _fixture.ReflectionSourceTests.setUp(self)
        self.registry = json.loads((ROOT / 'scripts/arcade-finish-passes.json').read_text())
        self.regions = [json.loads((ROOT / name).read_text()) for name in self.registry['metadata']]
        self.followup_masks = _fixture.FINISHING_MASKS[len(self.regions):]
        html = (ROOT / 'world-preview.html').read_text()
        hook = '''window.__arcadeFinishProbe=()=>{
 const previous=g,oldCamera={...cam};const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
 try{
  const lamps=make();worldLighting.drawLanterns(lamps.getContext('2d'));const pixels=lamps.getContext('2d').getImageData(0,0,W,H).data;
  const ink=([left,top,width,height])=>{let count=0;for(let y=top;y<top+height;y++)for(let x=left;x<left+width;x++)if(pixels[(y*W+x)*4+3])count++;return count;};
  const counter=assetStudio.assets.find(a=>a.origin?.name==='main_counter'),source=assetPicture(counter),canvas=make();g=canvas.getContext('2d');drawPlacedAsset(counter);
  const positions=[[43,21],[129,21],[222,21],[263,21]],sourceCanvas=document.createElement('canvas');sourceCanvas.width=361;sourceCanvas.height=142;sourceCanvas.getContext('2d').drawImage(source,0,0);
  const sample=(context,x,y)=>[...context.getImageData(x,y,1,1).data];
  const counterPixels=positions.map(([x,y])=>({x,y,source:sample(sourceCanvas.getContext('2d'),x,y),
   drawn:sample(g,Math.floor(counter.x-counter.w/2+x),Math.floor(counter.y-counter.h/2+y))}));
  const scene=make();g=scene.getContext('2d');cam.x=0;cam.y=0;cam.zoom=1;draw();
  return {lowerLampInk:ink([810,612,66,76]),westLampInk:ink([50,513,66,76]),counterPixels,
   caps:[[843,650],[843,672],[843,684],[843,696]].map(([x,y])=>({x,y,rgba:sample(g,x,y)}))};
 }finally{g=previous;Object.assign(cam,oldCamera);}
};
'''
        marker = 'window.CodaArcadeQA=Object.freeze({'
        self.assertEqual(html.count(marker), 1)
        html = html.replace(marker, hook + marker, 1)
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=html))

    def test_native_finishes_change_only_the_four_reviewed_regions_and_leave_a_blue_unlit_cap(self):
        self.assertEqual(len(self.regions), 4)
        self.assertEqual(len(self.followup_masks), 1, 'The only later exception is the narrow west-neon contour')
        self.assertEqual(hashlib.sha256((ROOT / self.registry['before']).read_bytes()).hexdigest(), BASELINE_SHA256)
        self.load()
        self.quality('off')
        result = self.page.evaluate('''async ({registry,regions,followupMasks})=>{
 const pixels=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1672;c.height=941;
  c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,1672,941).data;};
 const before=await pixels(registry.before),after=await pixels(registry.output);
 const inside=(polygon,x,y)=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const allowed=(x,y)=>[...regions,...followupMasks].some(meta=>meta.polygons.some(p=>inside(p,x,y))&&!(meta.protectedPolygons||[]).some(p=>inside(p,x,y)));
 let changed=0,outside=0,protectedChanged=0;
 for(let y=0;y<941;y++)for(let x=0;x<1672;x++){
  const at=(y*1672+x)*4;if(![0,1,2,3].some(c=>before[at+c]!==after[at+c]))continue;changed++;
  if(!allowed(x+.5,y+.5))outside++;
  if((x>=44&&x<233&&y>=40&&y<145)||(x>=361&&x<495&&y>=33&&y<185)
   ||(x>=235&&x<355&&y>=36&&y<95)||(x>=805&&x<860&&y>=435&&y<580)
   ||(x>=770&&x<835&&y>=780&&y<835))protectedChanged++;
 }
 const sample=(array,x,y)=>Array.from(array.slice((y*1672+x)*4,(y*1672+x)*4+4));
 const cap=[[843,650],[843,672],[843,684],[843,696]].map(([x,y])=>({x,y,before:sample(before,x,y),after:sample(after,x,y)}));
 const floor=[[822,650],[862,650],[293,366],[293,400]].map(([x,y])=>({x,y,before:sample(before,x,y),after:sample(after,x,y)}));
 const topNeon=[[76,508],[160,508],[245,508],[251,508]].map(([x,y])=>({x,y,before:sample(before,x,y),after:sample(after,x,y)}));
 const oldNeon=[[150,650],[225,650]].map(([x,y])=>({x,y,before:sample(before,x,y),after:sample(after,x,y)}));
 return {changed,outside,protectedChanged,cap,floor,topNeon,oldNeon,westLamp:{before:sample(before,83,551),after:sample(after,83,551)}};
}''', {'registry': self.registry, 'regions': self.regions, 'followupMasks': self.followup_masks})
        self.assertGreater(result['changed'], 10000)
        self.assertEqual(result['outside'], 0, 'Pixels outside the four historical masks and the narrow west-neon contour remain unchanged')
        self.assertEqual(result['protectedChanged'], 0, 'Both angled lounge walls, its sign, upper passage lamp and lower corner stay intact')
        for point in result['cap']:
            self.assertLess(point['after'][0], 70, 'The cap must be unlit blue rather than pink, gold or white: ' + json.dumps(point))
            self.assertGreater(point['after'][2], point['after'][0] + 60, point)
        for point in result['floor']:
            self.assertLess(point['after'][0], 30, 'Remove only the old warm/pink floor spill: ' + json.dumps(point))
            self.assertGreater(point['after'][2], point['after'][0] + 25, point)
        self.assertLess(result['westLamp']['after'][1], 100, result['westLamp'])
        self.assertGreater(result['westLamp']['after'][2], result['westLamp']['after'][1] + 35,
                           'The deleted amber bulb should reveal the existing purple/blue wall')
        for point in result['topNeon']:
            self.assertGreater(point['after'][0], 180, 'The new upper neon must connect across its cap junction: ' + json.dumps(point))
        for point in result['oldNeon']:
            self.assertLess(point['after'][0], 80, point)
            self.assertGreater(point['after'][2], point['after'][0] + 80,
                               'The obsolete lower horizontal neon must reveal blue masonry')
        self.assertEqual(fingerprint(self.project()), fingerprint(self.published))
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(), _fixture.PUBLISHED_SHA256)
        self.assertEqual(hashlib.sha256((ROOT / 'assets/environment/floor-palette-compat.json').read_bytes()).hexdigest(), PALETTE_SHA256)

    def test_removed_modern_lamps_have_no_live_glow_and_original_legacy_lamps_remain(self):
        self.load()
        original = fingerprint(self.project())
        for quality in ['full', 'lite', 'off']:
            self.quality(quality)
            lamps = {lamp['id']: lamp for lamp in self.page.evaluate('CodaArcadeQA.lighting().lanterns')}
            self.assertNotIn('dance-west', lamps)
            self.assertNotIn('dance-passage-lantern', lamps)
            self.assertEqual((lamps['dance-upper-passage']['x'], lamps['dance-upper-passage']['y']), (819,502))
            self.assertEqual((lamps['dance-stage-east']['x'], lamps['dance-stage-east']['y']), (613,549))
            probe = self.page.evaluate('__arcadeFinishProbe()')
            self.assertEqual(probe['lowerLampInk'], 0, probe)
            self.assertEqual(probe['westLampInk'], 0, probe)
            for point in probe['caps']:
                self.assertLess(point['rgba'][0], 70, 'The actual scene must not pulse or glow at the deleted lamp: ' + json.dumps(point))
            self.assertEqual(fingerprint(self.project()), original)
        legacy = json.loads((ROOT / 'assets/environment/legacy-world-project.json').read_text())
        self.seed(legacy)
        self.quality('full')
        lamps = {lamp['id']: lamp for lamp in self.page.evaluate('CodaArcadeQA.lighting().lanterns')}
        self.assertEqual(len(lamps), 17)
        self.assertIn('dance-west', lamps)
        self.assertIn('dance-passage-lantern', lamps)
        self.assertEqual(fingerprint(self.project()), fingerprint(legacy))

    def test_actual_counter_and_added_library_copy_use_the_matte_top_with_preserved_front(self):
        self.load()
        self.quality('off')
        original = self.project()
        probe = self.page.evaluate('__arcadeFinishProbe()')
        for point in probe['counterPixels']:
            for name in ['source', 'drawn']:
                self.assertLess(point[name][0], 35, point)
                self.assertLess(point[name][1], 130, 'The former bright streak must become matte jade: ' + json.dumps(point))
                self.assertGreater(point[name][1], point[name][0] + 20, point)
                self.assertGreater(point[name][3], 240, point)
        source_check = self.page.evaluate('''async()=>{
 const load=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
  c.getContext('2d').drawImage(image,0,0);return {width:c.width,height:c.height,pixels:c.getContext('2d').getImageData(0,0,c.width,c.height).data};};
 const pairs=[['assets/environment/source/main-counter-before-matte.png','assets/environment/v1/main-counter.png',66],
  ['assets/decor/source/counter-jade-before-matte.png','assets/decor/v1/counter-jade-south.png',40]];
 const results=[];for(const [oldUrl,newUrl,frontTop]of pairs){const before=await load(oldUrl),after=await load(newUrl);let alphaChanged=0,frontChanged=0;
  for(let y=0;y<before.height;y++)for(let x=0;x<before.width;x++){const at=(y*before.width+x)*4;
   if(before.pixels[at+3]!==after.pixels[at+3])alphaChanged++;
   if(y>=frontTop&&[0,1,2,3].some(c=>before.pixels[at+c]!==after.pixels[at+c]))frontChanged++;
  }results.push({oldSize:[before.width,before.height],newSize:[after.width,after.height],alphaChanged,frontChanged});}
 return results;
}''')
        for result in source_check:
            self.assertEqual(result['oldSize'], result['newSize'])
            self.assertEqual(result['alphaChanged'], 0)
            self.assertEqual(result['frontChanged'], 0, 'Preserve the gold trim and counter front')
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        panel = self.page.locator('[data-decor-library]')
        if not panel.evaluate('(node)=>node.open'):
            panel.locator('summary').click()
        self.page.locator('[data-decor-category]').select_option('all')
        card = self.page.locator('[data-decor-item="counter-jade-south"]')
        self.assertIn('v=matte-counter-20261101-1', card.locator('img').get_attribute('src'))
        card.click()
        self.assertIn('v=matte-counter-20261101-1', self.page.locator('[data-decor-preview] img').get_attribute('src'))
        self.page.locator('[data-decor-add]').click()
        self.page.wait_for_function('(n)=>CodaDeveloperConsole.getProject().assets.length===n', arg=len(original['assets'])+1)
        self.page.wait_for_function('!document.querySelector("[data-decor-library]").matches("[aria-busy=true]")')
        expected = self.project()
        self.assertEqual(fingerprint(expected['assets'][:-1]), fingerprint(original['assets']))
        pixels = self.page.evaluate('''async()=>{const asset=CodaDeveloperConsole.getProject().assets.at(-1),image=new Image();image.src=asset.data;await image.decode();
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;const g=c.getContext('2d');g.drawImage(image,0,0);
 return [[33,22],[126,22],[226,22],[271,22]].map(([x,y])=>[...g.getImageData(x,y,1,1).data]);}''')
        for color in pixels:
            self.assertLess(color[1], 130, 'The Add flow must embed the fresh matte image')
            self.assertGreater(color[1], color[0] + 20)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
        self.frames()
        self.assertEqual(fingerprint(self.project()), fingerprint(expected))


if __name__ == '__main__':
    unittest.main(verbosity=2)
