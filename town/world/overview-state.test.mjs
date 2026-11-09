import test from 'node:test';
import assert from 'node:assert/strict';
import {OverviewTerrainState,higherWaterRects,livePatchRects,projectedDirtyRect,terrainBoundsForRect,OVERVIEW_SCALE,WORLD_WIDTH,WORLD_HEIGHT} from './overview-state.mjs';
import {encodePaint} from './ground-paint.mjs';
const blank=()=>({cells:{},objects:[],edges:{}});
const paint=()=>encodePaint([{surface:'grass'},{surface:'sand'}],new Float64Array(512).fill(127.5));
function warm(d){const state=new OverviewTerrainState();assert.equal(state.scan(d).first,true);assert.equal(state.scan(d).changed.length,0);return state;}

test('overview snapshots reuse equal-data documents without changing project data',()=>{
 const d=blank();d.cells['10,10']={surface:'grass',level:8,paint:paint()};
 const before=JSON.stringify(d),s=warm(d),copy=JSON.parse(before);
 assert.equal(s.scan(copy).changed.length,0);assert.equal(JSON.stringify(d),before);assert.equal(JSON.stringify(copy),before);
 copy.cells['10,10'].paint.materials[0].surface='dirt';
 const changed=s.scan(copy);assert.deepEqual(changed.changed,[2570]);assert.deepEqual(changed.paints,[copy.cells['10,10'].paint]);
});
test('direct material, elevation, stair and pier field changes invalidate the affected cells',()=>{
 const d=blank();d.cells['20,20']={surface:'grass',level:4};const s=warm(d);
 for(const change of [a=>a.surface='sand',a=>a.level=5,a=>a.stairs='north',a=>a.stairBase=3,a=>a.stairRise=2,a=>a.bridge='ns',a=>a.pier={level:6,axis:'ns'},a=>a.pier.level=7,a=>a.sidewalkCurb=true]){
  change(d.cells['20,20']);assert.deepEqual(s.scan(d).changed,[5140]);assert.equal(s.scan(d).changed.length,0);
 }
 delete d.cells['20,20'];assert.deepEqual(s.scan(d).changed,[5140]);
});
test('nested contour and distant under-layer donor edits invalidate their owners',()=>{
 const d=blank(),q={kind:'height',corner:'nw',cx:704,cy:704,r:64,underX:30,underY:30};
 d.cells['10,10']={surface:'grass',level:8,curves:[q]};d.cells['30,30']={surface:'water',level:0};const s=warm(d);
 q.style='rocky';assert.deepEqual(s.scan(d).changed,[2570]);
 q.mask='changed-mask';assert.deepEqual(s.scan(d).changed,[2570]);
 d.cells['30,30'].level=2;assert.deepEqual(s.scan(d).changed,[2570,7710]);assert.ok(s.livePatches().length);
 q.under={surface:'dirt',level:3,paint:paint()};s.scan(d);
 q.under.paint.materials[0].surface='wood';const c=s.scan(d);assert.deepEqual(c.changed,[2570]);assert.deepEqual(c.paints,[q.under.paint]);
});
test('raised water includes surface-curve projection and height-curve lift',()=>{
 const d=blank();assert.deepEqual(higherWaterRects(d,{surface:'water',level:2},10,10),[{x:640,y:544,w:64,h:64}]);
 const a={surface:'grass',level:8,curves:[{kind:'surface',under:{surface:'water',level:0}}]};
 assert.deepEqual(higherWaterRects(d,a,10,10),[{x:640,y:256,w:64,h:64}]);
 a.curves[0]={kind:'height',lift:1,under:{surface:'water',level:3}};
 assert.deepEqual(higherWaterRects(d,a,10,10),[{x:640,y:448,w:64,h:64}]);
 assert.deepEqual(higherWaterRects(d,{surface:'water',level:0},10,10),[]);
});
test('live water patches do not overlap and source bounds cover projected overhangs',()=>{
 const patches=livePatchRects([{x:511,y:511,w:64,h:64},{x:512,y:512,w:64,h:64}]);
 assert.equal(new Set(patches.map(p=>`${p.x},${p.y}`)).size,patches.length);
 for(const p of patches){assert.equal(p.w,512);assert.equal(p.h,512);const b=terrainBoundsForRect(p);assert.ok(b.x0*64<=p.x);assert.ok(b.y1*64>=p.y+p.h+384);}
});
test('dirty footprints cover old high ground and neighboring shadows with bounded allocation',()=>{
 const r=projectedDirtyRect([2570]);assert.ok(r.y<=640-384);assert.ok(r.x<=640-64);assert.ok(r.x+r.w>=704+64);
 assert.equal(OVERVIEW_SCALE,.125);assert.equal(Math.ceil((WORLD_WIDTH+1024)*OVERVIEW_SCALE)*Math.ceil((WORLD_HEIGHT+1024)*OVERVIEW_SCALE),3620864);
});
