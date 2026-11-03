"""Historical wall masks keep exposed floor behind actors without rewriting saves.

CODA_FOREGROUND_EXPORT optionally checks an actual older local export as well.
The default local fixture is portable and retains the same historical gestures.
"""
import copy
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('foreground_compat_fixture',Path(__file__).with_name('floor-palette-compat-browser.py'))
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class ForegroundFloorCompatibilityTests(unittest.TestCase):
    setUpClass=classmethod(fixture.FloorPaletteCompatibilityTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.FloorPaletteCompatibilityTests.tearDownClass.__func__)
    setUp=fixture.FloorPaletteCompatibilityTests.setUp
    tearDown=fixture.FloorPaletteCompatibilityTests.tearDown
    load=fixture.FloorPaletteCompatibilityTests.load
    project=fixture.FloorPaletteCompatibilityTests.project
    storage_record=fixture.FloorPaletteCompatibilityTests.storage_record

    def frames(self):
        self.page.evaluate('publishFrames(3)')

    def pixel(self,x,y):
        return self.page.evaluate('''([x,y])=>{const c=CodaArcadeQA.camera();return [...view.getContext('2d').getImageData(Math.floor((x-c.x)*c.zoom),Math.floor((y-c.y)*c.zoom),1,1).data];}''',[x,y])

    def test_current_wall_floor_is_behind_the_actor_and_new_floor_paint_still_works(self):
        self.load()
        self.assertEqual(self.project(),self.current)
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(750,570)'),-1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(700,570)'),12,'Keep the historical stage wall outside the new selection in the foreground')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(600,570)'),26,'Keep the newly authored stage wall selection in the foreground')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().strokes.slice(26).filter(stroke=>!CodaForegroundFloorCompat.isHistoricalWallStroke(stroke)).length'),10)
        expected=self.pixel(750,570)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(750,610)'))
        self.frames()
        actor=self.pixel(750,570)
        self.assertNotEqual(actor,expected,'The exposed glass must no longer cover the avatar face')
        visible=self.page.evaluate('''()=>{
 const b=document.createElement('canvas');b.width=1672;b.height=941;__paletteConsole.renderBase(b.getContext('2d'));
 const base=b.getContext('2d'),g=view.getContext('2d'),cam=CodaArcadeQA.camera();let count=0;
 for(let y=567;y<607;y++)for(let x=738;x<762;x++){
  const a=g.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data,c=base.getImageData(x,y,1,1).data;
  if(Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1])+Math.abs(a[2]-c[2])>40)count++;
 }return count;
}''')
        self.assertGreater(visible,700,'Most of the actual avatar must remain visible on the former diagonal')
        self.assertEqual(self.project(),self.current,'Playback compatibility must not change any saved project field')
        self.assertTrue(self.page.evaluate("CodaArcadeQA.editForegroundAt(750,570,'paint',8,500)"))
        self.frames()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(750,570)'),len(self.current['strokes']))
        self.assertEqual(self.pixel(750,570),expected,'New intentional foreground painting of floor still covers the avatar')
        self.assertEqual(self.project()['strokes'][:-1],self.current['strokes'])

    def test_structural_source_removes_floor_and_retains_the_southwest_rail_exactly(self):
        self.load()
        result=self.page.evaluate('''async()=>{
 const art=CodaEnvironmentArt.create({document});await art.ready;
 const part={name:'dance_lower_wall_left',type:'wall',bounds:[44,790,225,93],poly:[[48,793],[252,818],[266,865],[256,882],[60,849]]};
 const before=document.createElement('canvas');before.width=225;before.height=93;const g=before.getContext('2d');g.translate(-44,-790);g.beginPath();g.moveTo(...part.poly[0]);for(const p of part.poly.slice(1))g.lineTo(...p);g.closePath();g.clip();g.drawImage(art.background(),0,0);
 const after=art.structural(part),unrelated=art.structural({...part,name:'unrelated_wall'}),a=g.getImageData(0,0,225,93).data,b=after.getContext('2d').getImageData(0,0,225,93).data,u=unrelated.getContext('2d').getImageData(0,0,225,93).data;let removed=0,outside=0,unrelatedMismatch=0;
 for(let y=0;y<93;y++)for(let x=0;x<225;x++){const at=(y*225+x)*4;if([0,1,2,3].some(k=>a[at+k]!==b[at+k])){removed++;if(!CodaForegroundFloorCompat.structuralFloorPixel(part,x+44.5,y+790.5))outside++;}}
 const pixel=(data,x,y)=>[...data.slice(((y-790)*225+x-44)*4,((y-790)*225+x-44)*4+4)];
 for(let i=0;i<a.length;i++)if(a[i]!==u[i])unrelatedMismatch++;
 return {removed,outside,unrelatedMismatch,floorBefore:pixel(a,200,820),floorAfter:pixel(b,200,820),railBefore:pixel(a,104,823),railAfter:pixel(b,104,823),faceBefore:pixel(a,240,860),faceAfter:pixel(b,240,860)};
}''')
        self.assertGreater(result['removed'],1000)
        self.assertEqual(result['outside'],0)
        self.assertEqual(result['unrelatedMismatch'],0,'A different wall identity must not inherit the southwest compatibility cache')
        self.assertEqual(result['floorBefore'][3],255)
        self.assertEqual(result['floorAfter'][3],0)
        self.assertEqual(result['railBefore'],result['railAfter'])
        self.assertEqual(result['faceBefore'],result['faceAfter'])
        self.assertEqual(self.project(),self.current)

    def test_local_saved_wall_selections_and_custom_floor_paint_keep_storage_priority(self):
        path=os.environ.get('CODA_FOREGROUND_EXPORT')
        local=json.loads(Path(path).read_text()) if path else copy.deepcopy(self.current)
        wall_owner=26 if len(local['strokes'])>=33 else 12
        custom_owner=len(local['strokes'])
        custom={'tool':'paint','size':8,'points':[[1100,600]],'depth':1000,'foreground':True}
        local['strokes'].append(custom)
        local['assets'][0]['name']='My foreground audit saved sofa'
        self.load()
        stored=self.page.evaluate('''project=>new Promise((resolve,reject)=>{const r=indexedDB.open('codaArcadeAssetStudioDB',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};t.objectStore('layouts').put(record,'codaWorldProjectV1');t.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};t.onerror=()=>reject(t.error);};})''',local)
        for _ in range(2):
            self.page.reload(wait_until='domcontentloaded')
            self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
            self.frames()
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')
            self.assertEqual(self.project(),local)
            self.assertEqual(self.storage_record(),stored,'Rendering must never migrate or rewrite raw saved gestures')
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(750,570)'),-1)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(700,570)'),12)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(600,570)'),wall_owner)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerPixelOwner(1100,600)'),custom_owner,'Custom foreground floor painting must survive reload')


if __name__=='__main__':
    unittest.main(verbosity=2)
