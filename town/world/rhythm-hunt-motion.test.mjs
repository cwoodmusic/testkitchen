import test from 'node:test';import assert from 'node:assert/strict';
import {launchFlyingNotes,advanceFlyingNote,netSweepPose,netSweepHits,facingAngle,NET_HALF_ARC} from './rhythm-hunt-motion.mjs';
test('notes fly with changing headings, evade a nearby player, and keep their card identities',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'eighth-pair',x:500,y:500,phase:0}]),positions=[];let away=false;
 for(let i=0;i<600;i++){advanceFlyingNote(a,{x:a.x-80,y:a.y},1/60,i/60,()=>true);positions.push({x:a.x,y:a.y});if(a.vx>140)away=true;}
 assert(positions.some(p=>Math.hypot(p.x-500,p.y-500)>50));assert(away);assert.equal(a.value,'eighth-pair');assert.equal(a.id,'one');assert(Math.hypot(a.x-a.homeX,a.y-a.homeY)<400);
});
test('flight checks its complete path against walls and cliffs and respects paused time',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'quarter',x:100,y:100,phase:0}]);for(let i=0;i<300;i++)advanceFlyingNote(a,{x:0,y:100},1/60,i/60,(_,b)=>b.x<120&&b.y>70&&b.y<140);assert(a.x<120);assert(a.y>70&&a.y<140);
 const before={...a};advanceFlyingNote(a,{x:0,y:0},0,20,()=>true);assert.deepEqual(a,before);
});
test('the net sweeps one continuous forward arc in all four facings and catches along that arc',()=>{
 const p={x:500,y:500};for(const direction of ['up','down','left','right']){const angle=facingAngle(direction),samples=Array.from({length:25},(_,i)=>netSweepPose(p,angle,i/24));
  for(const s of samples)assert((s.x-s.grip.x)*Math.cos(angle)+(s.y-s.grip.y)*Math.sin(angle)>40,'Sweep must stay in front');
  assert(samples.every((s,i)=>i===0||s.angle>samples[i-1].angle));assert(Math.abs(samples.at(-1).angle-samples[0].angle-NET_HALF_ARC*2)<1e-10);
  const middle=samples[12];assert(netSweepHits({x:middle.x,y:middle.y+10},p,angle,0,1));assert(!netSweepHits({x:p.x-Math.cos(angle)*170,y:p.y-53-Math.sin(angle)*170},p,angle,0,1));
 }
});
