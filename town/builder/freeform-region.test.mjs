import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank} from '../world/model.mjs';
import {regionFromPolygon,regionHeightEdits,selectionContains,selectionCount} from './region.mjs';
const points=[[10,10],[14,10],[14,11],[11,11],[11,14],[10,14]].map(([x,y])=>({x:x*64,y:y*64}));

test('a concave lasso selects its tile-center mask in either winding, including a repeated closing point',()=>{
 const r=regionFromPolygon([...points,points[0]]),reverse=regionFromPolygon([...points].reverse());
 assert.equal(selectionCount(r),7);assert.deepEqual(r.cells,reverse.cells);assert(selectionContains(r,10,13));assert(selectionContains(r,13,10));assert(!selectionContains(r,13,13));
 assert.deepEqual([r.x0,r.y0,r.x1,r.y1],[10,10,13,13]);
});

test('a click selects one tile and a whole-world polygon clips to the map',()=>{
 const one=regionFromPolygon([{x:12.3*64,y:13.4*64}]);assert.deepEqual(one.cells,['12,13']);
 const all=regionFromPolygon([{x:-100,y:-100},{x:20000,y:-100},{x:20000,y:15000},{x:-100,y:15000}]);assert.equal(selectionCount(all),256*192);
 const preview=regionFromPolygon(points,{preview:true});assert.equal(selectionCount(preview),0);assert.equal(regionHeightEdits(blank(),preview,1).length,0);
});

test('freeform raises only selected tiles and preserves materials, masks and curved donor heights',()=>{
 const d=blank(),r=regionFromPolygon(points),paint={materials:[{surface:'dirt'}],weights:btoa('\xff'.repeat(256))};
 const outsideDonor={corner:'sw',cx:700,cy:700,r:64,kind:'height',underX:12,underY:12};
 const fixedDonor={...outsideDonor,underX:10,underY:10,under:{surface:'grass',level:0}};
 d.cells['10,10']={surface:'sand',level:2,paint,curves:[outsideDonor,fixedDonor]};d.cells['12,12']={surface:'wood',level:4};
 for(const[k,a]of regionHeightEdits(d,r,1))d.cells[k]=a;
 assert.equal(d.cells['10,10'].level,3);assert.equal(d.cells['10,10'].surface,'sand');assert.equal(d.cells['10,10'].paint,paint);assert.equal(d.cells['12,12'].level,4);
 assert.equal(d.cells['10,10'].curves[0].lift,1);assert.equal(d.cells['10,10'].curves[1].lift,1);
 assert.equal(Object.keys(d.cells).length,8);
});
