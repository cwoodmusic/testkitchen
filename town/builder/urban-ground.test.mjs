import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,surfaces,parseProject,blocked,height,surfaceAt} from '../world/model.mjs';
import {readPaint,validPaint,PAINT_GRID} from '../world/ground-paint.mjs';
import {paintGround} from './ground-brush.mjs';
import {roundTerrain} from './round-terrain.mjs';

const urban=['asphalt','sidewalk','brick'];
const apply=(d,p,options)=>{const result=paintGround(d,p,options);Object.assign(d.cells,Object.fromEntries(result.edits));return result;};
function sample(d,x,y,surface){
 const paint=readPaint(cell(d,Math.floor(x/64),Math.floor(y/64))),offset=(Math.floor(y%64/4)*PAINT_GRID+Math.floor(x%64/4))*paint.materials.length;
 return paint.materials.reduce((sum,m,i)=>sum+(m.surface===surface?paint.weights[offset+i]:0),0);
}

test('urban tile materials and rounded sidewalk donors survive a portable project round trip',()=>{
 const d=blank();
 for(const [i,surface]of urban.entries()){assert(surfaces.includes(surface));d.cells[`${i+1},1`]={surface,level:0};}
 for(let y=9;y<=11;y++)for(let x=9;x<=11;x++)d.cells[`${x},${y}`]={surface:'asphalt',level:0};
 d.cells['10,10']={surface:'sidewalk',level:0};
 const rounded=roundTerrain(d,{x:672,y:672},3);assert(rounded.edits.length>0);Object.assign(d.cells,Object.fromEntries(rounded.edits));
 assert.equal(surfaceAt(d,641,641),'asphalt');assert.equal(surfaceAt(d,672,672),'sidewalk');
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 const invalid=structuredClone(d);invalid.cells['1,1'].surface='unknown-road';assert.throws(()=>parseProject(JSON.stringify(invalid),new Set()),/Invalid terrain cell/);
});

test('each urban material works with a feathered brush and retains normalized portable paint',()=>{
 for(const surface of urban){
  const d=blank();const result=apply(d,{x:128,y:128},{surface,size:96,hardness:0,opacity:.6});assert(result.changed,surface);
  const center=sample(d,130,130,surface),edge=sample(d,166,130,surface);assert(center>edge&&edge>0,surface);assert.equal(sample(d,178,130,surface),0);
  for(const a of Object.values(d.cells))if(a.paint)assert(validPaint(a.paint,new Set()));
  assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 }
});

test('urban material blending softens a street seam while preserving its physical elevation',()=>{
 const d=blank();for(let y=0;y<4;y++){d.cells[`1,${y}`]={surface:'asphalt',level:2};d.cells[`2,${y}`]={surface:'sidewalk',level:2};}
 const result=apply(d,{x:128,y:96},{mode:'blend',size:96,hardness:1,opacity:1});assert(result.changed);
 assert(sample(d,126,98,'sidewalk')>0);assert(sample(d,130,98,'asphalt')>0);
 assert.equal(d.cells['1,1'].surface,'asphalt');assert.equal(d.cells['2,1'].surface,'sidewalk');assert.equal(height(d,126,98),96);assert.equal(height(d,130,98),96);
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('urban ground stays walkable but painting cannot bypass water, stairs, or cliffs',()=>{
 for(const surface of urban){
  const d=blank(),catalog=new Map();d.cells['2,2']={surface,level:0};assert.equal(blocked(d,160,160,catalog),false);
  d.cells['2,2'].level=2;assert.equal(blocked(d,150,129,catalog,{x:150,y:127}),true);
  for(const special of [{surface:'water',level:0},{surface:'asphalt',level:0,stairs:'north'},{surface:'water',level:0,bridge:'ns'}]){
   d.cells['2,2']={...special};const before=JSON.stringify(d.cells);
   assert.equal(paintGround(d,{x:160,y:160},{surface,size:32,hardness:1,opacity:1}).changed,false);
   assert.equal(JSON.stringify(d.cells),before);
  }
 }
});
