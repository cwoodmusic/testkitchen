"""Reviewed path/rectangle rendering preserves saves and does not occlude actors.

CODA_PATHWAY_EXPORT optionally checks the complete uploaded export; the portable
fixture defaults to the published project carrying the same reviewed cutout.
"""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('pathway_compat_fixture',Path(__file__).with_name('floor-palette-compat-browser.py'))
compat=importlib.util.module_from_spec(spec)
spec.loader.exec_module(compat)


class PathwayFloorFillTests(unittest.TestCase):
    setUpClass=classmethod(compat.FloorPaletteCompatibilityTests.setUpClass.__func__)
    tearDownClass=classmethod(compat.FloorPaletteCompatibilityTests.tearDownClass.__func__)
    setUp=compat.FloorPaletteCompatibilityTests.setUp
    tearDown=compat.FloorPaletteCompatibilityTests.tearDown
    load=compat.FloorPaletteCompatibilityTests.load
    project=compat.FloorPaletteCompatibilityTests.project
    storage_record=compat.FloorPaletteCompatibilityTests.storage_record

    def seed(self,project):
        stored=self.page.evaluate('''project=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);
open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};tx.objectStore('layouts').put(record,'codaWorldProjectV1');tx.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};tx.onerror=()=>reject(tx.error);};})''',project)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.page.evaluate('publishFrames(3)')
        return stored

    def test_cutout_glass_and_foreground_transparency_preserve_the_exact_local_project(self):
        path=os.environ.get('CODA_PATHWAY_EXPORT')
        local=json.loads(Path(path).read_text()) if path else copy.deepcopy(self.current)
        self.load()
        stored=self.seed(local)
        for _ in range(2):
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')
            self.assertEqual(self.project(),local)
            self.assertEqual(self.storage_record(),stored)
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()')
        status=self.page.evaluate('CodaDeveloperConsole.getState().pathwayFloorFill')
        self.assertTrue(status['ready'])
        self.assertIsNone(status['error'])
        self.assertEqual(status['pixels'],10543)
        self.assertEqual(status['runCount'],84)
        self.assertEqual(status['builds'],1)
        samples=self.page.evaluate('''async({shape,project,supersededPolygons})=>{
 const image=new Image();image.src='assets/environment/v1/empty-arcade.png';await image.decode();
 const native=document.createElement('canvas');native.width=1672;native.height=941;native.getContext('2d').drawImage(image,0,0);
 const base=document.createElement('canvas');base.width=1672;base.height=941;__paletteConsole.renderBase(base.getContext('2d'));
 const resolver=CodaFloorPaletteCompat.create({manifest:await (await fetch('assets/environment/floor-palette-compat.json')).json()});await resolver.ready;
 const tools=createCodaWorldArtworkTools({getRootData:()=>project.artwork,getAssets:()=>[],resolveTexture:resolver.resolveTexture});
 const points=[0,15,35,45,60,83].map(index=>{const [y,start,end]=shape.transparentRuns[index];return {x:Math.floor((start+end-1)/2),y};});
 const pixel=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
 return points.map(({x,y})=>{
  const fragment=document.createElement('canvas');fragment.width=1;fragment.height=1;fragment.getContext('2d').drawImage(image,x,y,1,1,0,0,1,1);
  const inPolygon=polygon=>{let hit=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const [ax,ay]=polygon[i],[bx,by]=polygon[j];if((ay>y+.5)!==(by>y+.5)&&x+.5<(bx-ax)*(y+.5-ay)/(by-ay)+ax)hit=!hit;
  }return hit;};
  const superseded=supersededPolygons.some(inPolygon);
  return {x,y,superseded,base:pixel(base,x,y),expected:superseded?pixel(native,x,y):pixel(native,x+shape.sampleOffset[0],y+shape.sampleOffset[1]),fragment:pixel(tools.fragment(fragment,x,y),0,0)};
 });
}''',{'shape':self.shape,'project':local,'supersededPolygons':self.superseded_polygons})
        for sample in samples:
            self.assertEqual(sample['base'],sample['expected'],sample)
            self.assertEqual(sample['base'][3],255)
            if sample['superseded']:
                self.assertEqual(sample['fragment'],sample['expected'],'Approved rectangle/join artwork replaces old diagonal cutout paint')
            else:
                self.assertEqual(sample['fragment'][3],0,'Outside the reviewed masks, raw cutout erasures stay transparent')
        # Walk inside the newly opened path using the normal keyboard handler.
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(300,470)'))
        self.page.locator('#view').focus()
        before=self.page.evaluate('CodaArcadeQA.position()')
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(120)
        self.page.keyboard.up('d')
        after=self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(after['x']-before['x'],.5,'The reshaped path must allow actual movement')
        self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(p.x,p.y)',after))
        visible=self.page.evaluate('''shape=>{
 const base=document.createElement('canvas');base.width=1672;base.height=941;__paletteConsole.renderBase(base.getContext('2d'));
 const bg=base.getContext('2d'),g=view.getContext('2d'),p=CodaArcadeQA.position(),cam=CodaArcadeQA.camera();
 let count=0;
 for(let y=Math.floor(p.y)-43;y<Math.floor(p.y)-3;y++)for(let x=Math.floor(p.x)-12;x<Math.floor(p.x)+12;x++){
  if(!shape.transparentRuns.some(([row,start,end])=>row===y&&x>=start&&x<end))continue;
  const a=g.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data,b=bg.getImageData(x,y,1,1).data;
  if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])>40)count++;
 }
 return count;
}''',self.shape)
        self.assertGreater(visible,60,'An opaque old-wall floor mask must not paint over the walking avatar')
        edited=copy.deepcopy(local)
        patch=edited['artwork']['background.world']
        compat.paint_pixel(patch,300,470,'#17c379ff')
        compat.paint_pixel(patch,1100,650,'#00000000')
        custom_stored=self.seed(edited)
        custom=self.page.evaluate('''()=>{const c=document.createElement('canvas');c.width=1672;c.height=941;const g=c.getContext('2d');__paletteConsole.renderBase(g);return {inside:[...g.getImageData(300,470,1,1).data],outside:[...g.getImageData(1100,650,1,1).data]};}''')
        self.assertEqual(custom['inside'],[23,195,121,255],'Opaque custom paint remains above the underlay')
        self.assertEqual(custom['outside'][3],0,'Unreviewed transparent artwork must not be filled')
        self.assertEqual(self.project(),edited)
        self.assertEqual(self.storage_record(),custom_stored)


    def test_full_fx_keep_the_open_walkway_clear_but_still_light_the_club_interior(self):
        html=(compat.ROOT/'world-preview.html').read_text()
        probe='''window.__clubAmbientProbe=()=>{const previous=g,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 try{g=canvas.getContext('2d');nightclubColorwash({on:false});clubRoomHeartbeat({on:false});
  const pixel=(x,y)=>[...g.getImageData(x,y,1,1).data];
  return {walkway:[[300,490],[400,495],[500,495],[600,495]].map(([x,y])=>pixel(x,y)),
    interior:[[300,600],[400,620],[500,650]].map(([x,y])=>pixel(x,y))};
 }finally{g=previous;}};
'''
        self.assertEqual(html.count('function nightclubColorwash(beat){'),1)
        html=html.replace('function nightclubColorwash(beat){',probe+'function nightclubColorwash(beat){',1)
        self.context.route('**/world-preview.html',lambda route:route.fulfill(status=200,content_type='text/html',body=html))
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','full')")
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'),'full')
        ambient=self.page.evaluate('__clubAmbientProbe()')
        self.assertTrue(all(pixel[3]==0 for pixel in ambient['walkway']),ambient)
        self.assertTrue(all(pixel[3]>0 for pixel in ambient['interior']),ambient)
        observed=self.page.evaluate('''()=>{
 const base=document.createElement('canvas');base.width=1672;base.height=941;
 const bg=base.getContext('2d');__paletteConsole.renderBase(bg);
 const ctx=view.getContext('2d'),cam=CodaArcadeQA.camera();
 return [[300,490],[400,495],[500,495],[600,495]].map(([x,y])=>({x,y,
  base:[...bg.getImageData(x,y,1,1).data],
  world:[...ctx.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data]}));
}''')
        for sample in observed:
            self.assertEqual(sample['world'],sample['base'],sample)


    def test_rectangle_blocks_its_masonry_and_leaves_the_former_diagonal_floor_open(self):
        self.load()
        floors=[(285,385),(315,415),(335,440),(400,455),(420,485)]
        masonry=[(365,335),(395,365),(415,415)]
        shoulders=[(375,285),(425,305),(615,285),(665,325)]
        for x,y in floors:
            self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(...p)',[x,y]),(x,y))
        for x,y in masonry+shoulders:
            self.assertFalse(self.page.evaluate('p=>CodaArcadeQA.walkable(...p)',[x,y]),(x,y))
        for point in [(535,285),(535,315),(535,335),(345,295)]:
            self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(...p)',point),point)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(200,305)'),
                        'The lounge carpet stays open above the new straight wall')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(200,325)'),
                         'The new straight lounge roof/wall blocks the player')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(335,385)'))
        self.page.locator('#view').focus()
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(400)
        self.page.keyboard.up('d')
        stopped=self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(stopped['x'],335.5,'Keyboard movement must reach the new wall')
        self.assertLess(stopped['x'],355,'The actor must stop before crossing the new rectangular masonry')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(325,435)'))
        self.page.keyboard.down('d')
        self.page.wait_for_timeout(300)
        self.page.keyboard.up('d')
        crossed=self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(crossed['x'],345,'The former diagonal wall must no longer block the floor below the rectangle')
        # This floor was inside the old lamp-wall foreground silhouette. A
        # floor-colored copy of that obsolete mask must not hide the avatar.
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(335,415)'))
        self.page.evaluate('publishFrames(3)')
        self.assertGreater(self.avatar_pixels(),60,'The old diagonal foreground must not hide a player standing on the new floor')


    def avatar_pixels(self):
        return self.page.evaluate('''()=>{
 const base=document.createElement('canvas');base.width=1672;base.height=941;__paletteConsole.renderBase(base.getContext('2d'));
 const bg=base.getContext('2d'),g=view.getContext('2d'),p=CodaArcadeQA.position(),cam=CodaArcadeQA.camera();let count=0;
 for(let y=Math.floor(p.y)-43;y<Math.floor(p.y)-3;y++)for(let x=Math.floor(p.x)-12;x<Math.floor(p.x)+12;x++){
  const a=g.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data,b=bg.getImageData(x,y,1,1).data;
  if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])>40)count++;
 }return count;
}''')

    def test_straight_stage_face_blocks_masonry_and_releases_its_old_diagonal_corner(self):
        self.load()
        for point in [(755,675),(755,715),(785,665)]:
            self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(...p)',point),point)
        for point in [(675,585),(705,625)]:
            self.assertFalse(self.page.evaluate('p=>CodaArcadeQA.walkable(...p)',point),point)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(755,665)'))
        self.page.locator('#view').focus()
        self.page.keyboard.down('s')
        self.page.wait_for_timeout(300)
        self.page.keyboard.up('s')
        after=self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(after['y'],685,'Keyboard movement must cross the former diagonal stage wall')
        self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(p.x,p.y)',after))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(755,685)'))
        self.page.evaluate('publishFrames(3)')
        self.assertGreater(self.avatar_pixels(),60,'Retired diagonal foreground must not cover the player on exposed stage-side glass')


if __name__=='__main__':
    unittest.main(verbosity=2)
