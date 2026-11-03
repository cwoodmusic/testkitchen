"""Lounge glass and independent library copies preserve saved edits and depth."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location('lounge_reflection_fixture',
                                              Path(__file__).with_name('reflection-sources-browser.py'))
_fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fixture)
POLYGON = [[82,203],[143,185],[181,172],[208,149],[359,149],[438,180],
           [438,271],[360,271],[360,362],[269,362],[269,314],[82,314]]
NEW_IDS = [
    'rug-lounge-constellation', 'rug-lounge-sunset', 'rug-lounge-jade',
    'clothes-rack-south', 'wardrobe-south', 'table-rectangle-south',
    'notes-register', 'notes-receipt-printer', 'notes-pen-cup', 'notes-ledger',
    'notes-price-display', 'notes-display-tray', 'wall-art-orbit',
    'wall-art-equalizer', 'wall-art-keyboard', 'wall-art-sunset',
]
PALETTE_SHA256 = '8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44'


def fingerprint(project):
    return hashlib.sha256(json.dumps(project, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class LoungeUpdateTests(unittest.TestCase):
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
        hook = '''window.__loungeDepthProbe=id=>{
 const previous=g,oldCamera={...cam},oldActive=assetStudio.active,oldGuides=assetStudio.showGuides;
 const make=()=>{const c=document.createElement('canvas');c.width=W;c.height=H;return c;};
 const actor=make(),prop=make(),scene=make(),background=make(),actorOver=make(),propOver=make();
 const paintActor=()=>characterRenderer.drawPlayer(g,avatar,{x:player.x,y:player.y,facing,walking,phase:playerPhase,jumpHeight,
  emote:emote>clock?(avatar.emote||'wave'):null,emoteTime:clock-emoteStarted},clock);
 try{
  assetStudio.active=false;assetStudio.showGuides=false;cam.x=0;cam.y=0;cam.zoom=1;
  g=scene.getContext('2d');draw();
  g=actor.getContext('2d');g.imageSmoothingEnabled=false;
  paintActor();
  const asset=assetStudio.assets.find(a=>a.id===id);g=prop.getContext('2d');g.imageSmoothingEnabled=false;drawPlacedAsset(asset);
  g=background.getContext('2d');developerConsole.renderBase(g);
  for(const other of assetStudio.assets)if(other.id!==id&&other.layer==='back')drawPlacedAsset(other);
  g=actorOver.getContext('2d');g.drawImage(background,0,0);drawPlacedAsset(asset);paintActor();
  g=propOver.getContext('2d');g.drawImage(background,0,0);paintActor();drawPlacedAsset(asset);
  const a=actor.getContext('2d').getImageData(0,0,W,H).data,p=prop.getContext('2d').getImageData(0,0,W,H).data,
   s=scene.getContext('2d').getImageData(0,0,W,H).data,
   actorControl=actorOver.getContext('2d').getImageData(0,0,W,H).data,propControl=propOver.getContext('2d').getImageData(0,0,W,H).data;
  let overlap=0,actorWins=0,propWins=0;
  for(let y=Math.floor(player.y)-43;y<Math.floor(player.y)-3;y++)for(let x=Math.floor(player.x)-12;x<Math.floor(player.x)+12;x++){
   const at=(y*W+x)*4;if(a[at+3]<245||p[at+3]<245)continue;overlap++;
   if([0,1,2,3].every(c=>Math.abs(s[at+c]-actorControl[at+c])<=2))actorWins++;
   if([0,1,2,3].every(c=>Math.abs(s[at+c]-propControl[at+c])<=2))propWins++;
  }
  return {overlap,actorWins,propWins,layer:asset.layer,bottom:asset.y+asset.h/2,player:{...player}};
 }finally{g=previous;Object.assign(cam,oldCamera);assetStudio.active=oldActive;assetStudio.showGuides=oldGuides;}
};
'''
        marker = 'window.CodaArcadeQA=Object.freeze({'
        self.assertEqual(html.count(marker), 1)
        html = html.replace(marker, hook + marker, 1)
        self.context.route('**/world-preview.html*', lambda route: route.fulfill(
            status=200, content_type='text/html', body=html))

    def open_library(self):
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        panel = self.page.locator('[data-decor-library]')
        if not panel.evaluate('(node)=>node.open'):
            panel.locator('summary').click()
        return panel

    def add(self, item_id):
        self.open_library()
        self.page.locator('[data-decor-category]').select_option('all')
        self.page.locator('[data-decor-search]').fill('')
        self.page.locator('[data-decor-item="' + item_id + '"]').click()
        count = len(self.project()['assets'])
        self.page.locator('[data-decor-add]').click()
        self.page.wait_for_function('(count)=>CodaDeveloperConsole.getProject().assets.length===count', arg=count + 1)
        self.page.wait_for_function('!document.querySelector("[data-decor-library]").matches("[aria-busy=true]")')
        return self.project()['assets'][-1]

    def field(self, name, value):
        target = self.page.locator('#' + name)
        target.fill(str(value))
        target.press('Tab')

    def test_lounge_native_is_navy_glass_only_inside_the_reviewed_floor_and_custom_paint_survives(self):
        meta = json.loads((ROOT / 'scripts/lounge-floor-regions.json').read_text())
        self.assertEqual(meta['polygons'], [POLYGON])
        self.load()
        self.quality('off')
        result = self.page.evaluate('''async ({polygon,finishingMasks})=>{
 const pixels=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');
  c.width=1672;c.height=941;c.getContext('2d').drawImage(image,0,0);return c.getContext('2d').getImageData(0,0,1672,941).data;};
 const before=await pixels('assets/environment/source/lounge-floor-before-glass.png'),after=await pixels('assets/environment/v1/empty-arcade.png');
 const inside=(points,x,y)=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
  const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 const inFinishing=(x,y)=>finishingMasks.some(mask=>mask.polygons.some(points=>inside(points,x,y))
  &&!mask.protectedPolygons.some(points=>inside(points,x,y)));
 let changed=0,outside=0;for(let y=0;y<941;y++)for(let x=0;x<1672;x++){
  const at=(y*1672+x)*4;if(![0,1,2,3].some(c=>before[at+c]!==after[at+c]))continue;changed++;
  if(!inside(polygon,x+.5,y+.5)&&!inFinishing(x+.5,y+.5))outside++;
 }
 const c=document.createElement('canvas');c.width=1672;c.height=941;__danceBlendConsole.renderBase(c.getContext('2d'));
 const samples=[[100,220],[200,260],[300,300],[400,240],[300,345]].map(([x,y])=>({x,y,
  native:Array.from(after.slice((y*1672+x)*4,(y*1672+x)*4+4)),rendered:[...c.getContext('2d').getImageData(x,y,1,1).data]}));
 return {changed,outside,samples};
}''', {'polygon': POLYGON, 'finishingMasks': _fixture.FINISHING_MASKS})
        self.assertGreater(result['changed'], 50000)
        self.assertEqual(result['outside'], 0, 'Pixels outside the lounge floor and exact later finishing contours stay unchanged')
        for point in result['samples']:
            self.assertLess(point['native'][0], 55, 'Remove the floral carpet pigment: ' + json.dumps(point))
            self.assertLess(point['native'][1], 40, point)
            self.assertGreater(point['native'][2], point['native'][0] + 40, point)
            self.assertEqual(point['native'], point['rendered'], point)
        self.assertEqual(fingerprint(self.project()), fingerprint(self.published))
        local = copy.deepcopy(self.published)
        local['assets'][0]['name'] = 'My lounge sofa placement'
        local['assets'][0]['x'] += 9
        _fixture._fixture.paint_pixel(local['artwork']['background.world'], 200, 260, '#17c379ff')
        stored = self.seed(local)
        for _ in range(2):
            self.quality('off')
            self.assertEqual(fingerprint(self.project()), fingerprint(local))
            self.assertEqual(self.storage_record(), stored)
            pixel = self.page.evaluate('''()=>{const c=document.createElement('canvas');c.width=1672;c.height=941;
 __danceBlendConsole.renderBase(c.getContext('2d'));return [...c.getContext('2d').getImageData(200,260,1,1).data];}''')
            self.assertEqual(pixel, [23,195,121,255], 'Intentional saved floor paint stays above the new native glass')
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
            self.frames()
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(),
                         _fixture.PUBLISHED_SHA256)
        self.assertEqual(hashlib.sha256((ROOT / 'assets/environment/floor-palette-compat.json').read_bytes()).hexdigest(),
                         PALETTE_SHA256)

    def test_all_sixteen_new_cutouts_are_library_choices_and_independent_copies_persist(self):
        self.load()
        original = self.project()
        self.open_library()
        catalog = self.page.evaluate('CodaDecorLibrary.items')
        self.assertEqual(len(catalog), 91)
        self.assertEqual([item['id'] for item in catalog[55:71]], NEW_IDS)
        for category, count in [('floor',16), ('tabletop',22), ('wall',19), ('rug',11), ('furniture',23)]:
            self.page.locator('[data-decor-category]').select_option(category)
            self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), count)
        self.page.locator('[data-decor-category]').select_option('all')
        self.page.locator('[data-decor-item="clothes-rack-south"]').click()
        self.assertEqual(fingerprint(self.project()), fingerprint(original), 'Previewing a rack must not place it')
        cutouts = self.page.evaluate('''async ids=>Promise.all(ids.map(async id=>{
 const image=new Image();image.src=CodaDecorLibrary.imageURL(id);await image.decode();
 const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
 const g=c.getContext('2d');g.drawImage(image,0,0);const p=g.getImageData(0,0,c.width,c.height).data;
 let clear=0,opaque=0;for(let at=3;at<p.length;at+=4){if(p[at]===0)clear++;if(p[at]>=245)opaque++;}
 return {id,width:c.width,height:c.height,clear,opaque};
}))''', NEW_IDS)
        self.assertTrue(all(item['clear'] > 10 and item['opaque'] > 100 for item in cutouts), cutouts)
        categories = {item['id']: item['category'] for item in catalog}
        for item_id in NEW_IDS:
            added = self.add(item_id)
            self.assertTrue(added['data'].startswith('data:image/png;base64,'))
            self.assertEqual(added['layer'], 'back' if categories[item_id] == 'rug' else 'world', item_id)
            self.assertFalse(bool(added.get('collider')), item_id)
            self.assertTrue(added.get('ignoreBackgroundMasks'), item_id)
        expected = self.project()
        self.assertEqual(fingerprint(expected['assets'][:-16]), fingerprint(original['assets']))
        self.assertEqual(fingerprint({k:v for k,v in expected.items() if k!='assets'}),
                         fingerprint({k:v for k,v in original.items() if k!='assets'}))
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
        self.frames()
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'), 'local')
        self.assertEqual(fingerprint(self.project()), fingerprint(expected))
        sizes = self.page.evaluate('''async()=>Promise.all(CodaDeveloperConsole.getProject().assets.slice(-16).map(async asset=>{
 const image=new Image();image.src=asset.data;await image.decode();return [image.naturalWidth,image.naturalHeight];
}))''')
        self.assertTrue(all(width > 1 and height > 1 for width,height in sizes))
        self.assertEqual(hashlib.sha256((ROOT / 'published-world-project.json').read_bytes()).hexdigest(),
                         _fixture.PUBLISHED_SHA256)

    def test_real_rug_draws_below_the_avatar_and_new_furniture_uses_normal_depth(self):
        self.load()
        self.quality('off')
        rug = self.add('rug-lounge-constellation')
        for name,value in [('assetX',1000), ('assetY',650), ('assetW',260), ('assetH',150)]:
            self.field(name,value)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(1000,650)'))
        self.frames()
        below = self.page.evaluate('id=>__loungeDepthProbe(id)', rug['id'])
        self.assertGreater(below['overlap'], 100, below)
        self.assertGreater(below['actorWins'], below['overlap'] * .9, below)
        self.assertEqual(below['layer'], 'back')
        wardrobe = self.add('wardrobe-south')
        for name,value in [('assetX',1000), ('assetY',650), ('assetW',100), ('assetH',150)]:
            self.field(name,value)
        actual = next(asset for asset in self.project()['assets'] if asset['id'] == wardrobe['id'])
        bottom = actual['y'] + actual['h'] / 2
        self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.place(...p)', [1000,bottom-25]))
        self.frames()
        behind = self.page.evaluate('id=>__loungeDepthProbe(id)', wardrobe['id'])
        self.assertGreater(behind['overlap'], 100, behind)
        self.assertGreater(behind['propWins'], behind['overlap'] * .9, behind)
        self.assertEqual(behind['layer'], 'world')
        self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.place(...p)', [1000,bottom+10]))
        self.frames()
        front = self.page.evaluate('id=>__loungeDepthProbe(id)', wardrobe['id'])
        self.assertGreater(front['overlap'], 50, front)
        self.assertGreater(front['actorWins'], front['overlap'] * .9, front)


if __name__ == '__main__':
    unittest.main(verbosity=2)
