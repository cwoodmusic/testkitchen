import test from 'node:test';import assert from 'node:assert/strict';
import {launchFlyingNotes,advanceFlyingNote,netSweepPose,netSweepHits,netVisualPose,facingAngle,NET_HALF_ARC,NET_WINDUP_FRACTION,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs';
test('notes fly with changing headings, evade a nearby player, and keep their card identities',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'eighth-pair',x:500,y:500,phase:0}]),positions=[];let away=false;
 for(let i=0;i<600;i++){advanceFlyingNote(a,{x:a.x-80,y:a.y},1/60,i/60,()=>true);positions.push({x:a.x,y:a.y});if(a.vx>140)away=true;}
 assert(positions.some(p=>Math.hypot(p.x-500,p.y-500)>50));assert(away);assert.equal(a.value,'eighth-pair');assert.equal(a.id,'one');assert(Math.hypot(a.x-a.homeX,a.y-a.homeY)<400);
});
test('flight checks its complete path against walls and cliffs and respects paused time',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'quarter',x:100,y:100,phase:0}]);for(let i=0;i<300;i++)advanceFlyingNote(a,{x:0,y:100},1/60,i/60,(_,b)=>b.x<120&&b.y>70&&b.y<140);assert(a.x<120);assert(a.y>70&&a.y<140);
 const before={...a};advanceFlyingNote(a,{x:0,y:0},0,20,()=>true);assert.deepEqual(a,before);
});
test('each facing has its own forward arc and the rim catches only inside its visible mouth',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),samples=Array.from({length:25},(_,i)=>netSweepPose(p,angle,NET_WINDUP_FRACTION+(1-NET_WINDUP_FRACTION)*i/24));
  for(const s of samples)assert((s.x-s.grip.x)*Math.cos(angle)+(s.y-s.grip.y)*Math.sin(angle)>65,'The full stroke stays in front of its hand');
  assert(samples.every((s,i)=>i===0||s.angle>samples[i-1].angle));assert(Math.abs(samples.at(-1).angle-samples[0].angle-NET_HALF_ARC*2)<1e-10);
  const middle=samples[12],u=NET_WINDUP_FRACTION+(1-NET_WINDUP_FRACTION)/2;
  assert(netSweepHits({x:middle.x,y:middle.y},p,angle,u,u));
  assert(netSweepHits({x:middle.x+middle.rx*.9,y:middle.y},p,angle,u,u));
  assert(!netSweepHits({x:middle.x+middle.rx+1,y:middle.y},p,angle,u,u),'A stationary mouth must not catch outside its drawn oval');
  assert(!netSweepHits({x:p.x-Math.cos(angle)*170,y:p.y-30-Math.sin(angle)*170},p,angle,0,1),'A note behind the avatar must not be caught');
 }
});
test('wrist anchors mirror back/front and follow the side the sprite faces',()=>{
 const p={x:500,y:500},grip=direction=>netSweepPose(p,facingAngle(direction),.5,48).grip;
 assert(grip('right').x>p.x);assert(grip('left').x<p.x);assert(grip('down').x<p.x);assert(grip('up').x>p.x);
 for(const direction of ['up','down','left','right'])assert.equal(grip(direction).y,p.y-48-30);
 assert.equal(grip('left').x-p.x,p.x-grip('right').x);assert.equal(grip('up').x-p.x,p.x-grip('down').x);
});
test('recovery retracts at the ending angle instead of replaying a reverse sweep',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),end=netSweepPose(p,angle,1),samples=Array.from({length:20},(_,i)=>netVisualPose(p,angle,NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS*i/19));
  let reach=Infinity;
  for(const pose of samples){assert(Math.abs(pose.angle-end.angle)<1e-12);const distance=Math.hypot(pose.x-pose.grip.x,pose.y-pose.grip.y);assert(distance<=reach+1e-10);reach=distance;}
  const idle=netVisualPose(p,angle),rest=samples.at(-1);assert.deepEqual(idle,rest);assert.equal(idle.stage,'ready');
  const begin=netSweepPose(p,angle,0);assert.equal(begin.x,idle.x);assert.equal(begin.y,idle.y,'Windup begins at the held pose without a snap');
 }
});
