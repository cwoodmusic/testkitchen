import test from 'node:test';
import assert from 'node:assert/strict';
import {easeCinematicCamera} from './room-view.mjs';

test('a speaker handoff pans over successive frames instead of jumping across the room',()=>{
 const target={offsetX:-750,offsetY:-100};let current={offsetX:-350,offsetY:40};
 let frames=0;
 while(Math.hypot(target.offsetX-current.offsetX,target.offsetY-current.offsetY)>.05&&frames++<200){
  const next=easeCinematicCamera(current,target,16);
  assert(Math.hypot(next.offsetX-current.offsetX,next.offsetY-current.offsetY)<=480*.016+.000001);
  assert(next.offsetX<=current.offsetX&&next.offsetX>=target.offsetX);
  assert(next.offsetY<=current.offsetY&&next.offsetY>=target.offsetY);
  current=next;
 }
 assert(frames>40&&frames<200,'The transition moves through intermediate frames and settles.');
 assert.deepEqual(easeCinematicCamera(current,target,16),target);
});

test('camera travel is stable across frame rates and a stalled frame cannot cause a warp',()=>{
 const target={offsetX:1000,offsetY:0};
 const run=delta=>{let point={offsetX:0,offsetY:0};for(let ms=0;ms<1000;ms+=delta)point=easeCinematicCamera(point,target,delta);return point.offsetX;};
 assert(Math.abs(run(10)-run(20))<.000001);
 const stalled=easeCinematicCamera({offsetX:0,offsetY:0},target,10000);
 assert(stalled.offsetX<=48,'A resumed frame uses a bounded transition step.');
 for(const delta of [0,-1,NaN,Infinity])assert.deepEqual(easeCinematicCamera({offsetX:0,offsetY:0},target,delta),{offsetX:0,offsetY:0});
});
