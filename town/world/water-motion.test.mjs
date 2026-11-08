import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WATER_CYCLE,WATER_FPS,waterFrameIndex,waterDisplacements,mirroredWaterIndex} from './water-motion.mjs';

test('native water repeats through mirrored source edges without changing its pixel scale',()=>{
 assert.deepEqual(Array.from({length:16},(_,i)=>mirroredWaterIndex(i,4)),[0,1,2,3,3,2,1,0,0,1,2,3,3,2,1,0]);
 for(const size of [4,64,512]){
  assert.equal(mirroredWaterIndex(-1,size),mirroredWaterIndex(0,size));
  assert.equal(mirroredWaterIndex(size-1,size),mirroredWaterIndex(size,size));
  assert.equal(mirroredWaterIndex(size*2-1,size),mirroredWaterIndex(size*2,size));
  for(let i=-10;i<size*2+10;i++)assert(Math.abs(mirroredWaterIndex(i+1,size)-mirroredWaterIndex(i,size))<=1);
 }
});

test('water frame timing loops continuously and freezes for reduced motion',()=>{
 assert.equal(waterFrameIndex(0),0);assert.equal(waterFrameIndex(WATER_CYCLE),0);
 assert.equal(waterFrameIndex(3),waterFrameIndex(3+WATER_CYCLE));
 assert.equal(waterFrameIndex(-1),waterFrameIndex(WATER_CYCLE-1));
 for(const t of [0,1,5,100,NaN,Infinity])assert.equal(waterFrameIndex(t,true),0);
 assert.equal(waterFrameIndex(NaN),0);assert.equal(waterFrameIndex(Infinity),0);
});

test('native wave displacement is deterministic, bounded, and restores the exact source at the loop',()=>{
 const start=waterDisplacements(512,512,0),middle=waterDisplacements(512,512,WATER_FPS*4),loop=waterDisplacements(512,512,WATER_CYCLE*WATER_FPS);
 assert(start.x.every(v=>v===0));assert(start.y.every(v=>v===0));assert.deepEqual(loop,start);
 assert(middle.x.some(v=>v!==0));assert(middle.y.some(v=>v!==0));
 assert(Math.max(...middle.x.map(Math.abs))<=7);assert(Math.max(...middle.y.map(Math.abs))<=4);
 assert.deepEqual(waterDisplacements(512,512,WATER_FPS*4),middle);
});
