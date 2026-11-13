import test from 'node:test';
import assert from 'node:assert/strict';
import {drawRhythmNet} from './rhythm-net-render.mjs';
import {facingAngle,netSweepHits,NET_WINDUP_FRACTION,NET_SWEEP_SECONDS} from './rhythm-hunt-motion.mjs';

function context(){const ellipses=[],lines=[];let depth=0;const c=new Proxy({ellipses,lines,get depth(){return depth;},save(){depth++;},restore(){depth--;},ellipse(...args){ellipses.push(args);},lineTo(...args){lines.push(args);}},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});return c;}
test('the renderer and catch test share the exact oval in every direction',()=>{
 const player={x:400,y:400},u=NET_WINDUP_FRACTION+(1-NET_WINDUP_FRACTION)/2;
 for(const direction of ['up','down','left','right']){
  const c=context(),angle=facingAngle(direction),pose=drawRhythmNet(c,player,{angle,age:u*NET_SWEEP_SECONDS,z:24,swinging:true,reducedMotion:true});
  assert.equal(c.depth,0);assert.deepEqual(c.ellipses.at(-1),[0,0,pose.rx,pose.ry,0,0,Math.PI*2]);assert(netSweepHits({x:pose.x,y:pose.y},player,angle,u,u,24));assert(c.lines.flat().every(Number.isFinite));
 }
});
test('idle, windup, sweep and recovery draw safely while restoring canvas state',()=>{
 for(const age of [Infinity,0,.02,.2,.38,.45,.54]){
  const c=context(),pose=drawRhythmNet(c,{x:400,y:400},{angle:facingAngle('down'),age});assert.equal(c.depth,0);assert(Number.isFinite(pose.x)&&Number.isFinite(pose.y));assert(c.ellipses.length);
 }
});
