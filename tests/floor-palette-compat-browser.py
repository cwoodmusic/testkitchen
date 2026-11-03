"""Old local floor pigments render cleanly without changing saved project data."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec=importlib.util.spec_from_file_location('palette_world_fixture',Path(__file__).with_name('published-world-browser.py'))
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
ROOT=Path(__file__).resolve().parents[1]


def paint_pixel(texture,x,y,color):
    key=f'{x//64},{y//64}'
    pixels={index:value for start,length,value in texture['tiles'].get(key,[]) for index in range(start,start+length)}
    pixels[y%64*64+x%64]=color
    runs=[]
    for index,value in sorted(pixels.items()):
        if runs and runs[-1][0]+runs[-1][1]==index and runs[-1][2]==value:
            runs[-1][1]+=1
        else:
            runs.append([index,1,value])
    texture['tiles'][key]=runs


class FloorPaletteCompatibilityTests(unittest.TestCase):
    setUpClass=classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown=fixture.PublishedWorldTests.tearDown
    load=fixture.PublishedWorldTests.load
    project=fixture.PublishedWorldTests.project

    def setUp(self):
        fixture.PublishedWorldTests.setUp(self)
        self.current=json.loads((ROOT/'published-world-project.json').read_text())
        self.manifest=json.loads((ROOT/'assets/environment/floor-palette-compat.json').read_text())
        self.shape=json.loads((ROOT/'assets/environment/boutique-pathway-shape.json').read_text())
        self.rectangle=json.loads((ROOT/'scripts/boutique-rectangle-regions.json').read_text())
        self.join=json.loads((ROOT/'scripts/boutique-join-regions.json').read_text())
        self.superseded_polygons=self.rectangle['polygons']+self.join['polygons']
        self.context.route('**/published-world-project.json*',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(self.current)))
        source=(ROOT/'developer-console.js').read_text()+'''\n(()=>{const original=window.createCodaDeveloperConsole;
window.createCodaDeveloperConsole=api=>{const instance=original(api);window.__paletteConsole=instance;return instance;};})();'''
        self.context.route('**/developer-console.js*',lambda route:route.fulfill(status=200,content_type='text/javascript',body=source))
        self.manifest_responses=[]
        self.page.on('response',lambda response:self.manifest_responses.append(response.status) if '/floor-palette-compat.json' in response.url else None)

    def storage_record(self):
        return self.page.evaluate('''()=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);
open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readonly'),get=tx.objectStore('layouts').get('codaWorldProjectV1');get.onsuccess=()=>resolve(JSON.stringify(get.result));tx.oncomplete=()=>db.close();};})''')

    def test_older_local_pigments_are_compatible_without_reset_or_saved_data_changes(self):
        # Synthesize a compact older journal from the manifest's real historical
        # colors. No private upload path or duplicate 7MB fixture is required.
        candidates={}
        for key,rules in self.manifest['tiles'].items():
            tx,ty=map(int,key.split(','))
            for start,length,old,new in rules:
                if old.lower()!='#3601f1ff':
                    continue
                for index in range(start,start+length):
                    x,y=tx*64+index%64,ty*64+index//64
                    if 275<=x<=879 and 430<=y<=557:
                        candidates[(x,y)]=new
        witnesses=[]
        for (x,y),new in sorted(candidates.items()):
            if all((x-other['x'])**2+(y-other['y'])**2>100 for other in witnesses):
                witnesses.append({'x':x,'y':y,'target':new})
            if len(witnesses)==12:
                break
        self.assertEqual(len(witnesses),12)
        local=copy.deepcopy(self.current)
        local['assets'][0]['x']+=7
        local['assets'][0]['name']='My saved sofa placement'
        patch=local.setdefault('artwork',{}).setdefault('background.world',{'width':1672,'height':941,'tiles':{}})
        for point in witnesses:
            paint_pixel(patch,point['x'],point['y'],'#3601f1ff')
        paint_pixel(patch,1100,650,'#17c379ff')
        self.load()
        stored=self.page.evaluate('''project=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);
open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};tx.objectStore('layouts').put(record,'codaWorldProjectV1');tx.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};tx.onerror=()=>reject(tx.error);};})''',local)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')
        self.assertEqual(self.project(),local)
        self.assertEqual(self.storage_record(),stored)
        status=self.page.evaluate('CodaDeveloperConsole.getState().paletteCompatibility')
        self.assertTrue(status['ready'])
        self.assertIsNone(status['error'])
        self.assertGreater(status['ruleCount'],0)
        self.assertTrue(self.manifest_responses)
        self.assertTrue(all(status==200 for status in self.manifest_responses))
        observed=self.page.evaluate('''async({points,manifest,patch,shape})=>{
 const image=new Image();image.src='assets/environment/v1/empty-arcade.png';await image.decode();
 const make=()=>{const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;return canvas;};
 const base=make(),g=base.getContext('2d');window.__paletteConsole.renderBase(g);
 const raw=make(),rawG=raw.getContext('2d');rawG.drawImage(image,0,0);
 const compat=CodaFloorPaletteCompat.create({manifest});await compat.ready;
 const data={'background.world':patch},tools=createCodaWorldArtworkTools({getRootData:()=>data,getAssets:()=>[],resolveTexture:compat.resolveTexture});
 const composed=tools.compose('background.world',image);
 const pixel=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
 const samples=points.map(point=>{
  const fragment=document.createElement('canvas');fragment.width=1;fragment.height=1;
  fragment.getContext('2d').drawImage(image,point.x,point.y,1,1,0,0,1,1);
  const rendered=tools.fragment(fragment,point.x,point.y);
  const expected=point.target===null?pixel(raw,point.x,point.y):[1,3,5,7].map(offset=>parseInt(point.target.slice(offset,offset+2),16));
  const underlay=shape.transparentRuns.some(([y,start,end])=>point.y===y&&point.x>=start&&point.x<end);
  const expectedBase=expected[3]===0&&underlay?pixel(raw,point.x+shape.sampleOffset[0],point.y+shape.sampleOffset[1]):expected;
  return {base:pixel(base,point.x,point.y),composed:pixel(composed,point.x,point.y),fragment:pixel(rendered,0,0),expected,expectedBase};
 });
 return {samples,custom:pixel(base,1100,650),data:tools.getData()};
}''',{'points':witnesses,'manifest':self.manifest,'patch':patch,'shape':self.shape})
        for point,sample in zip(witnesses,observed['samples']):
            self.assertEqual(sample['base'],sample['expectedBase'],point)
            self.assertEqual(sample['composed'],sample['expected'],point)
            self.assertEqual(sample['fragment'],sample['expected'],point)
        self.assertEqual(observed['custom'],[23,195,121,255])
        self.assertEqual(observed['data'],{'background.world':patch})
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.assertEqual(self.project(),local)
        self.assertEqual(self.storage_record(),stored)


    def test_reviewed_walkway_cleanup_reaches_base_and_structural_rendering_for_local_saves(self):
        points=[{'x':x,'y':y} for x,y in [(465,480),(540,487),(615,492),(672,493),
            (775,490),(740,515),(775,525),(805,520),(807,548),(832,540)]]
        local=copy.deepcopy(self.current)
        local['assets'][0]['x']+=9
        local['assets'][0]['name']='My saved walkway layout'
        patch=local.setdefault('artwork',{}).setdefault('background.world',{'width':1672,'height':941,'tiles':{}})
        seeded=0
        for point in points:
            x,y=point['x'],point['y']
            index=y%64*64+x%64
            rules=[rule for rule in self.manifest['tiles'].get(f'{x//64},{y//64}',[])
                   if rule[0]<=index<rule[0]+rule[1]]
            if rules:
                # Restore an actual earlier pigment at this position, preferring
                # its strongest old-blue repair rather than synthetic new paint.
                old=max((rule[2] for rule in rules),key=lambda color:int(color[5:7],16)-int(color[3:5],16))
                paint_pixel(patch,x,y,old)
                seeded+=1
        self.assertGreaterEqual(seeded,4,'Exercise real historical repair pixels around the marked walkway')
        paint_pixel(patch,1100,650,'#17c379ff')
        self.load()
        stored=self.page.evaluate('''project=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);
open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};tx.objectStore('layouts').put(record,'codaWorldProjectV1');tx.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};tx.onerror=()=>reject(tx.error);};})''',local)
        for _ in range(2):
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()')
            self.page.evaluate('publishFrames(3)')
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')
            self.assertEqual(self.project(),local)
            self.assertEqual(self.storage_record(),stored)
        observed=self.page.evaluate('''async points=>{
 const image=new Image();image.src='assets/environment/v1/empty-arcade.png';await image.decode();
 const native=document.createElement('canvas');native.width=1672;native.height=941;
 native.getContext('2d').drawImage(image,0,0);
 const base=document.createElement('canvas');base.width=1672;base.height=941;
 __paletteConsole.renderBase(base.getContext('2d'));
 const g=view.getContext('2d'),camera=CodaArcadeQA.camera(),characters=CodaArcadeQA.characters();
 const actors=[characters.player,...characters.npcs.filter(person=>!person.hidden)];
 const pixel=(canvas,x,y)=>[...canvas.getContext('2d').getImageData(x,y,1,1).data];
 return {samples:points.map(({x,y})=>({x,y,expected:pixel(native,x,y),base:pixel(base,x,y),
   world:[...g.getImageData(Math.floor((x-camera.x)*camera.zoom),Math.floor((y-camera.y)*camera.zoom),1,1).data],
   clear:!actors.some(actor=>Math.abs(actor.x-x)<60&&y>actor.y-85&&y<actor.y+18)})),custom:pixel(base,1100,650)};
}''',points)
        self.assertGreaterEqual(sum(point['clear'] for point in observed['samples']),6)
        for sample in observed['samples']:
            self.assertEqual(sample['base'],sample['expected'],sample)
            if sample['clear']:
                self.assertEqual(sample['world'],sample['expected'],sample)
        stub=next(point for point in observed['samples'] if (point['x'],point['y'])==(672,493))
        self.assertLess(max(stub['expected'][:3]),150,'The old bright-blue wall stub must become quiet glass')
        ledge=next(point for point in observed['samples'] if (point['x'],point['y'])==(775,490))
        self.assertLess(max(ledge['expected'][:3]),150,'The hidden old wall ledge must also reveal quiet glass')
        self.assertEqual(observed['custom'],[23,195,121,255])


if __name__=='__main__':
    unittest.main(verbosity=2)
