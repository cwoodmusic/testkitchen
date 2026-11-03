"""The west neon matches the north tube without changing prior room edits."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('west_neon_fixture', Path(__file__).with_name('reflection-sources-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
BEFORE_SHA256 = '9281fd551b53d7dd8575e7d5b9d2860ac57c2009a9998b96fe89b4a19c2cd385'
PALETTE_SHA256 = '8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44'
MEASURE_JS = '''
 const median=values=>{const s=[...values].sort((a,b)=>a-b);return (s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2;};
 const profile=points=>{
  const colors=points.map(([x,y])=>{const at=(y*1672+x)*4;return [...pixels.slice(at,at+3)];});
  const white=colors.map((c,i)=>Math.min(...c)>=190?i:-1).filter(i=>i>=0);
  const signal=colors.map(([r,g,b])=>Math.max(0,r-.5*b));let peak=signal.indexOf(Math.max(...signal)),left=peak,right=peak,half=signal[peak]/2;
  while(left>0&&signal[left-1]>=half)left--;while(right+1<signal.length&&signal[right+1]>=half)right++;
  return {core:white.length,width:right-left+1,axis:white.length?white.reduce((sum,i)=>sum+points[i][0],0)/white.length:null};
 };
 const north=[100,120,150,180,210].map(x=>profile(Array.from({length:13},(_,i)=>[x,503+i])));
 const upper=[550,580,610,630,650].map(y=>profile(Array.from({length:20},(_,i)=>[69+i,y])));
 const lower=[665,680,700,720,750,780,800,810].map(y=>profile(Array.from({length:20},(_,i)=>[69+i,y])));
 const summary=rows=>({core:median(rows.map(row=>row.core)),width:median(rows.map(row=>row.width)),rows});
 let lit=0,gap=0,maxGap=0;for(let y=520;y<815;y++){
  let peak=0;for(let x=69;x<89;x++){const at=(y*1672+x)*4;peak=Math.max(peak,pixels[at]-.5*pixels[at+2]);}
  if(peak>=100){lit++;gap=0;}else{gap++;maxGap=Math.max(maxGap,gap);}
 }
 return {north:summary(north),upper:summary(upper),lower:summary(lower),coverage:lit/295,maxGap};
'''


def fingerprint(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class WestNeonTests(unittest.TestCase):
    setUpClass = classmethod(_fixture.ReflectionSourceTests.setUpClass.__func__)
    tearDownClass = classmethod(_fixture.ReflectionSourceTests.tearDownClass.__func__)
    tearDown = _fixture.ReflectionSourceTests.tearDown
    load = _fixture.ReflectionSourceTests.load
    project = _fixture.ReflectionSourceTests.project
    frames = _fixture.ReflectionSourceTests.frames
    quality = _fixture.ReflectionSourceTests.quality
    seed = _fixture.ReflectionSourceTests.seed
    storage_record = _fixture.ReflectionSourceTests.storage_record

    def setUp(self):
        _fixture.ReflectionSourceTests.setUp(self)
        html = (ROOT / 'world-preview.html').read_text()
        hook = '''window.__westNeonScene=()=>{
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const previous=g,oldCamera={...cam};
 try{g=canvas.getContext('2d');cam.x=0;cam.y=0;cam.zoom=1;draw();return g.getImageData(0,0,W,H).data;}
 finally{g=previous;Object.assign(cam,oldCamera);}
};
'''
        marker = 'window.CodaArcadeQA=Object.freeze({'
        self.assertEqual(html.count(marker), 1)
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=html.replace(marker, hook + marker, 1)))

    def assert_style_matches(self, measured):
        reference = measured['north']
        self.assertEqual(reference['core'], 2)
        self.assertEqual(reference['width'], 5)
        for section in ['upper', 'lower']:
            value = measured[section]
            self.assertLessEqual(abs(value['width'] - reference['width']), 1, measured)
            self.assertGreaterEqual(value['core'], 1, measured)
            self.assertLessEqual(value['core'], reference['core'], measured)
            for row in value['rows']:
                self.assertLessEqual(row['width'], reference['width'] + 2, measured)
                if row['axis'] is not None:
                    self.assertLessEqual(abs(row['axis'] - 76.5), 1,
                                         'Keep the vertical axis aligned to the preserved90-degree corner')
        self.assertGreaterEqual(measured['coverage'], .98, measured)
        self.assertLessEqual(measured['maxGap'], 2, measured)

    def test_native_width_and_glow_match_the_unchanged_north_tube_only_inside_the_narrow_strip(self):
        meta = json.loads((ROOT / 'scripts/west-neon-uniform-regions.json').read_text())
        self.assertEqual(meta['polygons'], [[[69,511],[89,511],[89,815],[69,815]]])
        self.assertEqual(hashlib.sha256((ROOT / meta['before']).read_bytes()).hexdigest(), BEFORE_SHA256)
        self.load()
        result = self.page.evaluate('''async meta=>{
 const load=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=1672;c.height=941;
  c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,1672,941).data;};
 const before=await load(meta.before),pixels=await load(meta.output);let changed=0,outside=0,northChanged=0;
 for(let y=0;y<941;y++)for(let x=0;x<1672;x++){const at=(y*1672+x)*4;
  if(![0,1,2,3].some(c=>before[at+c]!==pixels[at+c]))continue;changed++;
  if(!(x>=69&&x<89&&y>=511&&y<815))outside++;
  if(x>=69&&x<281&&y>=503&&y<511)northChanged++;
 }
 const metrics=(()=>{''' + MEASURE_JS + '''})();return {changed,outside,northChanged,metrics};
}''', meta)
        self.assertGreater(result['changed'], 5000)
        self.assertEqual(result['outside'], 0, 'Preserve all five earlier finishing changes and every pixel beyond the dedicated strip')
        self.assertEqual(result['northChanged'], 0, 'Preserve the north tube and90-degree corner as the style reference')
        self.assert_style_matches(result['metrics'])
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(), _fixture.PUBLISHED_SHA256)
        self.assertEqual(hashlib.sha256((ROOT / 'assets/environment/floor-palette-compat.json').read_bytes()).hexdigest(), PALETTE_SHA256)

    def test_actual_full_lite_and_off_render_the_slim_tube_and_saved_paint_keeps_priority(self):
        self.load()
        original = fingerprint(self.project())
        for quality in ['full', 'lite', 'off']:
            self.quality(quality)
            measured = self.page.evaluate('''()=>{const pixels=__westNeonScene();''' + MEASURE_JS + '''}''')
            self.assert_style_matches(measured)
            self.assertEqual(fingerprint(self.project()), original)
        urls = self.page.evaluate('performance.getEntriesByType("resource").map(entry=>entry.name)')
        for name in ['environment-art.js', 'assets/environment/v1/empty-arcade.png',
                     'assets/environment/floor-palette-compat.json']:
            matching = [url for url in urls if name + '?' in url]
            self.assertEqual(len(matching), 1, matching)
            self.assertIn('v=west-neon-20261101-1', matching[0])
        local = copy.deepcopy(self.published)
        _fixture._fixture.paint_pixel(local['artwork']['background.world'], 76, 720, '#17c379ff')
        stored = self.seed(local)
        for _ in range(2):
            self.quality('off')
            self.assertEqual(fingerprint(self.project()), fingerprint(local))
            self.assertEqual(self.storage_record(), stored)
            color = self.page.evaluate('''()=>{const c=document.createElement('canvas');c.width=1672;c.height=941;
 __danceBlendConsole.renderBase(c.getContext('2d'));return [...c.getContext('2d').getImageData(76,720,1,1).data];}''')
            self.assertEqual(color, [23,195,121,255], 'Graphics cleanup must preserve intentional local cap painting')
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
            self.frames()


if __name__ == '__main__':
    unittest.main(verbosity=2)
