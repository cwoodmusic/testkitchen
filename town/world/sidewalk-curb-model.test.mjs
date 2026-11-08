import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,parseProject,History} from './model.mjs';
import {paintGround} from '../builder/ground-brush.mjs';
import {planLandFill} from '../builder/land-fill.mjs';
import {planWaterFill} from '../builder/water-fill.mjs';

const fixture=()=>{const d=blank();d.cells['10,10']={surface:'sidewalk',level:1,sidewalkCurb:true};return d;};
const apply=(d,plan)=>Object.assign(d.cells,Object.fromEntries(plan.edits));

test('square sidewalk intent survives portable saves and undo while malformed flags are rejected',()=>{
 const d=fixture(),history=new History();assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 history.record(d);delete d.cells['10,10'].sidewalkCurb;
 const before=history.back(d);assert.equal(before.cells['10,10'].sidewalkCurb,true);assert.equal(history.forward(before).cells['10,10'].sidewalkCurb,undefined);
 for(const invalid of [1,'true',null,{},[]]){d.cells['10,10'].sidewalkCurb=invalid;assert.throws(()=>parseProject(JSON.stringify(d),new Set()),/Invalid sidewalk curb/);}
});

test('round painting removes curb intent only where the brush actually paints, including same-material repaint',()=>{
 const d=fixture();d.cells['12,10']={surface:'sidewalk',level:1,sidewalkCurb:true};
 assert.equal(paintGround(d,{x:672,y:672},{surface:'sidewalk',size:24,opacity:0}).edits.length,0);
 apply(d,paintGround(d,{x:672,y:672},{surface:'sidewalk',size:24,hardness:1,opacity:1}));
 assert.equal(d.cells['10,10'].surface,'sidewalk');assert.equal(d.cells['10,10'].sidewalkCurb,undefined);assert.equal(d.cells['10,10'].paint,undefined);
 assert.equal(d.cells['12,10'].sidewalkCurb,true);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('material fills remove square curb intent and never add it to newly filled sidewalks',()=>{
 for(const plan of [d=>planLandFill(d,{x:672,y:672},{surface:'sand'}),d=>planWaterFill(d,{x:672,y:672})]){
  const d=fixture();apply(d,plan(d));assert.equal(d.cells['10,10'].sidewalkCurb,undefined);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 }
 const unchanged=fixture();assert.equal(planLandFill(unchanged,{x:672,y:672},{surface:'sidewalk'}).edits.length,0);assert.equal(unchanged.cells['10,10'].sidewalkCurb,true);
 const d=blank();d.cells['10,10']={surface:'sand',level:1};apply(d,planLandFill(d,{x:672,y:672},{surface:'sidewalk'}));assert.deepEqual(d.cells['10,10'],{surface:'sidewalk',level:1});
});
