"""Floor reflections retain visible light sources and saved-paint priority."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    'reflection_sources_fixture', Path(__file__).with_name('dance-floor-blend-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
PUBLISHED_SHA256 = '90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b'
FINISH_BOUNDS = [[94, 659, 57, 147], [685, 649, 122, 157]]
BLUE_GHOST_BOUNDS = [[725, 628, 82, 178]]
REPAIR_BOUNDS = [[435, 426, 246, 80], [750, 649, 57, 157]] + FINISH_BOUNDS + BLUE_GHOST_BOUNDS
LOUNGE_POLYGONS = [
    [[82,203],[143,185],[181,172],[208,149],[359,149],[438,180],
     [438,271],[360,271],[360,362],[269,362],[269,314],[82,314]]
]
FINISHING_MASKS = _fixture.finishing_masks()


def reviewed_scope(bounds):
    return {'bounds': bounds, 'loungePolygons': LOUNGE_POLYGONS,
            'finishingMasks': FINISHING_MASKS}


# The lounge used carpet in the old glass geometry. Its separately reviewed
# polygon and the later exact finishing contours are separate exceptions;
# surrounding bar art, cap faces, signs and picture cutouts stay exact.
REVIEWED_SCOPE_JS = '''
 const {bounds,loungePolygons,finishingMasks}=scope;
 const inside=(polygon,x,y)=>{
  let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const [ax,ay]=polygon[i],[bx,by]=polygon[j];
   if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
  }return hit;
 };
 const inLounge=(x,y)=>loungePolygons.some(polygon=>inside(polygon,x,y));
 const inFinishing=(x,y)=>finishingMasks.some(mask=>mask.polygons.some(polygon=>inside(polygon,x,y))
  &&!mask.protectedPolygons.some(polygon=>inside(polygon,x,y)));
 const allowed=(x,y)=>inLounge(x+.5,y+.5)||inFinishing(x+.5,y+.5)||(bounds.some(([l,t,w,h])=>x>=l&&x<l+w&&y>=t&&y<t+h)
  &&CodaWallReflections.isGlassFloor(x+.5,y+.5));
'''
# Captured with the pre-update native backdrop and its prior-good palette
# manifest, with only reviewed bounds and exact lounge/finishing masks blanked. This witness
# includes earlier wall removals and floor repairs; rebuilding compatibility must not
# resurrect their purple/red pigments elsewhere in the room.
PRIOR_GOOD_BASE_OUTSIDE_REPAIRS_SHA256 = 'eec4a2d3f1d43ad690859f6f82cbd9f178831f61bee4dcb286cd97201abf25cc'


class ReflectionSourceTests(unittest.TestCase):
    setUpClass = classmethod(_fixture.DanceFloorBlendTests.setUpClass.__func__)
    tearDownClass = classmethod(_fixture.DanceFloorBlendTests.tearDownClass.__func__)
    setUp = _fixture.DanceFloorBlendTests.setUp
    tearDown = _fixture.DanceFloorBlendTests.tearDown
    load = _fixture.DanceFloorBlendTests.load
    project = _fixture.DanceFloorBlendTests.project
    frames = _fixture.DanceFloorBlendTests.frames
    seed = _fixture.DanceFloorBlendTests.seed
    storage_record = _fixture.DanceFloorBlendTests.storage_record

    def quality(self, name):
        for _ in range(3):
            if self.page.evaluate('CodaArcadeQA.lighting().quality') == name:
                return
            self.page.locator('#fxBtn').evaluate('button=>button.click()')
            self.frames()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.lighting().quality'), name)

    def test_live_lanterns_match_current_sources_and_disco_spots_keep_their_ball(self):
        self.load()
        states = {}
        missing = {'piano-east', 'dance-entry', 'dance-sofa-west', 'dance-corner-west',
                   'dance-west', 'dance-passage-lantern'}
        for quality in ['full', 'lite', 'off']:
            self.quality(quality)
            state = self.page.evaluate('CodaArcadeQA.lighting()')
            states[quality] = state
            lamps = {lamp['id']: lamp for lamp in state['lanterns']}
            self.assertEqual(len(lamps), 11, 'Keep all remaining visible lantern sources')
            self.assertEqual(set(lamps).intersection(missing), set(),
                             'Removed architectural lamps must not leave floating glows')
            for name, point in {'boutique-west': (397, 359), 'dance-stage-east': (613, 549),
                                'dance-upper-passage': (819, 502)}.items():
                self.assertEqual((lamps[name]['x'], lamps[name]['y']), point,
                                 name + ' must pulse at its visible bulb')
            active = {ball['id'] for ball in state['balls']
                      if ball['visible'] and ball['rays'] and ball['opacity'] > 0}
            for spot in state['spots']:
                self.assertIn(spot['ballId'], active,
                              'A colored moving floor pin must retain its visible disco-ball source')
            for beam in state['beams']:
                self.assertIn(beam['ballId'], active)
            if quality != 'off':
                self.assertGreater(state['spotCount'], 0, 'Keep the requested live disco lighting')
                self.assertGreater(state['rayCount'], 0)
            else:
                self.assertEqual(state['spotCount'], 0)
                self.assertEqual(state['rayCount'], 0)
        self.assertGreater(states['full']['spotCount'], states['lite']['spotCount'])
        self.assertEqual(self.project(), self.published)
        # The original artwork still owns its original lamps in legacy rooms.
        legacy = json.loads((ROOT / 'assets/environment/legacy-world-project.json').read_text())
        self.seed(legacy)
        self.quality('full')
        original = {lamp['id']: lamp for lamp in self.page.evaluate('CodaArcadeQA.lighting().lanterns')}
        self.assertEqual(len(original), 17, 'Legacy artwork retains all of its original lanterns')
        self.assertTrue(missing.issubset(original))
        self.assertEqual((original['dance-upper-passage']['x'], original['dance-upper-passage']['y']), (821, 514))
        self.assertEqual(self.project(), legacy)

    def test_native_cleanup_preserves_every_pixel_outside_reviewed_glass(self):
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(), PUBLISHED_SHA256)
        self.load()
        result = self.page.evaluate('''async scope => {''' + REVIEWED_SCOPE_JS + '''
 const load = async url => { const image = new Image(); image.src = url; await image.decode(); return image; };
 const before = await load('assets/environment/source/reflections-before-alignment.png');
 const after = await load('assets/environment/v1/empty-arcade.png');
 const pixels = image => {const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
  c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;};
 const a=pixels(before),b=pixels(after);let changed=0,outside=0,protectedChanges=0;
 for(let y=0;y<941;y++)for(let x=0;x<1672;x++){
  const at=(y*1672+x)*4;if(![0,1,2,3].some(c=>a[at+c]!==b[at+c]))continue;changed++;
  if(!allowed(x,y))outside++;
  // x359 is the final reviewed lounge-floor column beside the boutique.
  if(!inFinishing(x+.5,y+.5)&&((x>=360&&x<=681&&y>=274&&y<425)||(x>=236&&x<=724&&y>=507&&y<649)
   ||(x>=808&&x<859&&y>=435&&y<819)||(y>=837&&y<884)))protectedChanges++;
 }
 return{beforeSize:[before.naturalWidth,before.naturalHeight],afterSize:[after.naturalWidth,after.naturalHeight],changed,outside,protectedChanges};
}''', reviewed_scope(REPAIR_BOUNDS))
        self.assertEqual(result['beforeSize'], [1672, 941])
        self.assertEqual(result['afterSize'], [1672, 941])
        self.assertGreater(result['changed'], 1000, 'Remove the old streaks rather than only changing runtime labels')
        self.assertEqual(result['outside'], 0)
        self.assertEqual(result['protectedChanges'], 0, 'Walls, dance tiles and neon borders stay intact')
        self.assertEqual(self.project(), self.published)
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))

    def test_every_rendered_base_pixel_outside_the_repairs_keeps_prior_floor_cleanup(self):
        self.load()
        self.quality('off')
        result = self.page.evaluate('''async scope => {''' + REVIEWED_SCOPE_JS + '''
 const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
 const g=canvas.getContext('2d');__danceBlendConsole.renderBase(g);
 const pixels=g.getImageData(0,0,1672,941).data;
 const witnesses=[[300,450],[360,445],[700,480],[750,480],[800,500],[805,520],[805,548],[840,460]]
  .map(([x,y])=>({x,y,rgba:Array.from(pixels.slice((y*1672+x)*4,(y*1672+x)*4+4))}));
 for(const [left,top,width,height] of bounds)for(let y=top;y<top+height;y++)for(let x=left;x<left+width;x++)
  pixels.fill(0,(y*1672+x)*4,(y*1672+x)*4+4);
 for(let y=149;y<362;y++)for(let x=82;x<438;x++)if(inLounge(x+.5,y+.5))
  pixels.fill(0,(y*1672+x)*4,(y*1672+x)*4+4);
 for(const mask of finishingMasks){
  const points=mask.polygons.flat(),left=Math.floor(Math.min(...points.map(p=>p[0]))),right=Math.ceil(Math.max(...points.map(p=>p[0]))),
   top=Math.floor(Math.min(...points.map(p=>p[1]))),bottom=Math.ceil(Math.max(...points.map(p=>p[1])));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(inFinishing(x+.5,y+.5))
   pixels.fill(0,(y*1672+x)*4,(y*1672+x)*4+4);
 }
 const hash=await crypto.subtle.digest('SHA-256',pixels);
 return {sha256:[...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,'0')).join(''),witnesses};
}''', reviewed_scope(REPAIR_BOUNDS))
        self.assertEqual(result['sha256'], PRIOR_GOOD_BASE_OUTSIDE_REPAIRS_SHA256,
                         'Keep every prior floor repair outside the approved masks; witnesses: '
                         + json.dumps(result['witnesses']))
        self.assertEqual(self.project(), self.published)

    def test_finishing_pass_changes_only_its_two_reviewed_glass_masks(self):
        self.load()
        result = self.page.evaluate('''async scope=>{''' + REVIEWED_SCOPE_JS + '''
 const pixels=async url=>{const image=new Image();image.src=url;await image.decode();
  const c=document.createElement('canvas');c.width=1672;c.height=941;c.getContext('2d').drawImage(image,0,0);
  return c.getContext('2d').getImageData(0,0,1672,941).data;};
 const before=await pixels('assets/environment/source/dance-reflections-before-cleanup.png');
 const after=await pixels('assets/environment/v1/empty-arcade.png');let changed=0,outside=0;
 for(let y=0;y<941;y++)for(let x=0;x<1672;x++){
  const at=(y*1672+x)*4;if(![0,1,2,3].some(c=>before[at+c]!==after[at+c]))continue;changed++;
  if(!allowed(x,y))outside++;
 }
 return {changed,outside};
}''', reviewed_scope(FINISH_BOUNDS + BLUE_GHOST_BOUNDS))
        self.assertGreater(result['changed'], 1000)
        self.assertEqual(result['outside'], 0, 'Only the approved glass history and exact later finishing contours may change')

    def test_blue_wall_ghost_cleanup_preserves_every_pixel_outside_its_glass_mask(self):
        self.load()
        result = self.page.evaluate('''async scope=>{''' + REVIEWED_SCOPE_JS + '''
 const pixels=async url=>{const image=new Image();image.src=url;await image.decode();
  const c=document.createElement('canvas');c.width=1672;c.height=941;c.getContext('2d').drawImage(image,0,0);
  return c.getContext('2d').getImageData(0,0,1672,941).data;};
 const before=await pixels('assets/environment/source/east-floor-before-cleanup.png');
 const after=await pixels('assets/environment/v1/empty-arcade.png');let changed=0,outside=0;
 for(let y=0;y<941;y++)for(let x=0;x<1672;x++){
  const at=(y*1672+x)*4;if(![0,1,2,3].some(c=>before[at+c]!==after[at+c]))continue;changed++;
  if(!allowed(x,y))outside++;
 }
 return {changed,outside};
}''', reviewed_scope(BLUE_GHOST_BOUNDS))
        self.assertGreater(result['changed'], 1000)
        self.assertEqual(result['outside'], 0, 'Blue-ghost cleanup and later finishing must keep all pixels outside their exact masks')

    def test_blue_wall_fragments_above_the_old_mask_are_gone_without_hiding_real_reflections(self):
        self.load()
        self.quality('off')
        result = self.page.evaluate('''async()=>{
 const load=async url=>{const image=new Image();image.src=url;await image.decode();
  const c=document.createElement('canvas');c.width=1672;c.height=941;c.getContext('2d').drawImage(image,0,0);return c;};
 const before=await load('assets/environment/source/east-floor-before-cleanup.png');
 const native=await load('assets/environment/v1/empty-arcade.png');
 const base=document.createElement('canvas');base.width=1672;base.height=941;__danceBlendConsole.renderBase(base.getContext('2d'));
 const sample=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
 const points=[[728,647],[776,641],[768,651],[765,653]].map(([x,y])=>({x,y,before:sample(before,x,y),native:sample(native,x,y),off:sample(base,x,y)}));
 const projected=document.createElement('canvas');projected.width=1672;projected.height=941;
 CodaWallReflections.create({document,getQuality:()=> 'full'}).draw(projected.getContext('2d'),native);
 const pixels=projected.getContext('2d').getImageData(0,0,1672,941).data;
 let bareEastInk=0,totalInk=0;for(let y=0;y<941;y++)for(let x=0;x<1672;x++)if(pixels[(y*1672+x)*4+3]){
  totalInk++;if(x>=736&&x<807&&y>=628&&y<806)bareEastInk++;
 }
 return {points,bareEastInk,totalInk};
}''')
        for point in result['points']:
            self.assertLess(point['native'][2], 100, 'Remove the blue cap/tile silhouette: ' + json.dumps(point))
            self.assertLess(point['native'][2], point['before'][2] - 15, point)
            self.assertEqual(point['off'], point['native'], point)
        self.assertEqual(result['bareEastInk'], 0, 'A wall ending at x725 cannot project a detached floor wall on the bare eastern walkway')
        self.assertGreater(result['totalInk'], 1000, 'Preserve actual wall reflections throughout the room')
        self.quality('full')
        full = self.page.evaluate('''()=>{
 const c=document.createElement('canvas');c.width=1672;c.height=941;const g=c.getContext('2d');__danceBlendConsole.renderBase(g);
 return [[728,647],[776,641],[768,651],[765,653]].map(([x,y])=>[...g.getImageData(x,y,1,1).data]);
}''')
        self.assertEqual(full, [point['off'] for point in result['points']],
                         'Full effects must not reintroduce the removed detached wall fragments')

    def test_reported_streaks_are_gone_with_effects_off_and_browser_fetches_fresh_art(self):
        self.load()
        self.quality('off')
        result = self.page.evaluate('''async()=>{
 const before=new Image();before.src='assets/environment/source/reflections-before-alignment.png';await before.decode();
 const old=document.createElement('canvas');old.width=1672;old.height=941;old.getContext('2d').drawImage(before,0,0);
 const current=document.createElement('canvas');current.width=1672;current.height=941;__danceBlendConsole.renderBase(current.getContext('2d'));
 const points=[[113,680],[113,700],[123,750],[703,680],[703,720],[775,680]];
 const sample=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
 return {points:points.map(([x,y])=>({x,y,before:sample(old,x,y),after:sample(current,x,y)})),
  resources:performance.getEntriesByType('resource').map(entry=>entry.name)};
}''')
        for point in result['points']:
            self.assertLess(point['after'][0], 55, 'Remove the bright baked pigment: ' + json.dumps(point))
            self.assertLess(point['after'][1], 70, point)
            self.assertLess(point['after'][2], 190, point)
        for resource in ['environment-art.js', 'assets/environment/v1/empty-arcade.png',
                         'assets/environment/floor-palette-compat.json']:
            requests = [url for url in result['resources'] if resource + '?' in url]
            self.assertEqual(len(requests), 1, requests)
            self.assertIn('v=west-neon-20261101-1', requests[0],
                          'Return visits must fetch the new art rather than the former orange-streak cache key')
        self.quality('full')
        full = self.page.evaluate('''()=>{
 const c=document.createElement('canvas');c.width=1672;c.height=941;const g=c.getContext('2d');__danceBlendConsole.renderBase(g);
 return [[113,700],[123,750],[703,680],[775,680]].map(([x,y])=>({x,y,rgba:[...g.getImageData(x,y,1,1).data]}));
}''')
        for point in full:
            self.assertLess(point['rgba'][0], 70, 'Keep the wall reflection soft rather than restoring a saturated stripe: ' + json.dumps(point))
        self.assertEqual(self.project(), self.published)

    def test_known_old_floor_pigments_are_render_only_and_custom_paint_keeps_priority(self):
        manifest = json.loads((ROOT / 'assets/environment/floor-palette-compat.json').read_text())
        patch = self.published['artwork']['background.world']
        candidates = []
        for key, runs in patch['tiles'].items():
            tx, ty = map(int, key.split(','))
            rules = manifest['tiles'].get(key, [])
            for start, length, color in runs:
                if not color.lower().endswith('ff'):
                    continue
                for index in range(start, start + length):
                    x, y = tx * 64 + index % 64, ty * 64 + index // 64
                    if not any(l <= x < l + w and t <= y < t + h for l, t, w, h in REPAIR_BOUNDS):
                        continue
                    if any(a <= index < a + n and old.lower() == color.lower() and target is None
                           for a, n, old, target in rules):
                        candidates.append([x, y])
            if len(candidates) >= 6:
                break
        self.assertGreaterEqual(len(candidates), 3, 'Exercise actual exact-color compatibility for authored old floor')
        points = candidates[:6]
        self.load()
        self.quality('off')
        matched = self.page.evaluate('''async points=>{
 const image=new Image();image.src='assets/environment/v1/empty-arcade.png';await image.decode();
 const base=document.createElement('canvas');base.width=1672;base.height=941;__danceBlendConsole.renderBase(base.getContext('2d'));
 const raw=document.createElement('canvas');raw.width=1672;raw.height=941;raw.getContext('2d').drawImage(image,0,0);
 const sample=(c,x,y)=>[...c.getContext('2d').getImageData(x,y,1,1).data];
 return points.map(([x,y])=>({x,y,base:sample(base,x,y),raw:sample(raw,x,y)}));
}''', points)
        for point in matched:
            self.assertEqual(point['base'], point['raw'], point)
        local = copy.deepcopy(self.published)
        local['assets'][0]['name'] = 'My saved reflection layout'
        local['assets'][0]['x'] += 7
        painted = local['artwork']['background.world']
        _fixture.paint_pixel(painted, 540, 475, '#17c379ff')
        _fixture.paint_pixel(painted, 775, 740, '#a342c6ff')
        _fixture.paint_pixel(painted, 113, 700, '#38a964ff')
        _fixture.paint_pixel(painted, 703, 680, '#c57a28ff')
        _fixture.paint_pixel(painted, 776, 641, '#49a3efff')
        _fixture.paint_pixel(painted, 1100, 650, '#cf7a22ff')
        stored = self.seed(local)
        for _ in range(2):
            self.quality('off')
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'), 'local')
            self.assertEqual(self.project(), local)
            self.assertEqual(self.storage_record(), stored)
            colors = self.page.evaluate('''()=>{
 const c=document.createElement('canvas');c.width=1672;c.height=941;const g=c.getContext('2d');__danceBlendConsole.renderBase(g);
 return [[540,475],[775,740],[113,700],[703,680],[776,641],[1100,650]].map(([x,y])=>[...g.getImageData(x,y,1,1).data]);
}''')
            self.assertEqual(colors, [[23, 195, 121, 255], [163, 66, 198, 255], [56, 169, 100, 255],
                                      [197, 122, 40, 255], [73, 163, 239, 255], [207, 122, 34, 255]],
                             'Intentional saved colors remain above the cleaned native floor')
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
            self.frames()
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(), PUBLISHED_SHA256)


if __name__ == '__main__':
    unittest.main(verbosity=2)
