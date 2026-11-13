import test from 'node:test';import assert from 'node:assert/strict';
import {launchFlyingNotes,advanceFlyingNote,netSweepPose,netSweepHits,netVisualPose,netToolPose,facingAngle,NET_STRIKE_FRACTION,NET_WINDUP_FRACTION,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs';
test('notes fly with changing headings, evade a nearby player, and keep their card identities',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'eighth-pair',x:500,y:500,phase:0}]),positions=[];let away=false;
 for(let i=0;i<600;i++){advanceFlyingNote(a,{x:a.x-80,y:a.y},1/60,i/60,()=>true);positions.push({x:a.x,y:a.y});if(a.vx>140)away=true;}
 assert(positions.some(p=>Math.hypot(p.x-500,p.y-500)>50));assert(away);assert.equal(a.value,'eighth-pair');assert.equal(a.id,'one');assert(Math.hypot(a.x-a.homeX,a.y-a.homeY)<400);
});
test('flight checks its complete path against walls and cliffs and respects paused time',()=>{
 const [a]=launchFlyingNotes([{id:'one',value:'quarter',x:100,y:100,phase:0}]);for(let i=0;i<300;i++)advanceFlyingNote(a,{x:0,y:100},1/60,i/60,(_,b)=>b.x<120&&b.y>70&&b.y<140);assert(a.x<120);assert(a.y>70&&a.y<140);
 const before={...a};advanceFlyingNote(a,{x:0,y:0},0,20,()=>true);assert.deepEqual(a,before);
});
test('the net lifts completely above the head then chops into the facing direction',()=>{
 const p={x:500,y:500},z=48;
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),held=netVisualPose(p,angle,Infinity,z),lift=netSweepPose(p,angle,NET_WINDUP_FRACTION,z),finish=netSweepPose(p,angle,1,z);
  assert(lift.y+lift.ry<p.y-z-120,'The entire raised rim must clear the avatar head');
  assert(held.groundForward<0&&held.layer==='behind','Walking carries the net behind the shoulder');
  assert(Math.abs(lift.x-lift.grip.x)<1e-9,'The raised handle points vertically over the hand');
  const forward=(finish.x-finish.grip.x)*Math.cos(angle)+(finish.y-finish.grip.y)*Math.sin(angle);
  assert(forward>80,'The chop must finish well in front of the facing hand');
  const start=netSweepPose(p,angle,0,z);assert.equal(start.x,held.x);assert.equal(start.y,held.y);
 }
});
test('only the forward downstroke catches notes and it uses the actual visible oval',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),strike=netSweepPose(p,angle,NET_STRIKE_FRACTION),lift=netSweepPose(p,angle,NET_WINDUP_FRACTION/2);
  assert.equal(strike.stage,'sweep');assert.equal(strike.catchable,true);
  assert(netSweepHits({x:strike.x,y:strike.y},p,angle,NET_STRIKE_FRACTION,NET_STRIKE_FRACTION));
  assert(netSweepHits({x:strike.x+strike.rx*.9,y:strike.y},p,angle,NET_STRIKE_FRACTION,NET_STRIKE_FRACTION));
  assert(!netSweepHits({x:strike.x+strike.rx+1,y:strike.y},p,angle,NET_STRIKE_FRACTION,NET_STRIKE_FRACTION),'A stationary mouth must not catch outside its drawn oval');
  assert(!netSweepHits({x:lift.x,y:lift.y},p,angle,NET_WINDUP_FRACTION/2,NET_WINDUP_FRACTION/2),'Raising the net cannot collect notes');
  assert(!netSweepHits({x:p.x-Math.cos(angle)*170,y:p.y-30-Math.sin(angle)*170},p,angle,0,1),'A note behind the avatar must not be caught');
 }
});
test('the swing is one monotonic forward arc from the back shoulder without a reverse windup',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),samples=Array.from({length:51},(_,i)=>netSweepPose(p,angle,i/50));
  if(direction==='up'||direction==='down')assert(samples.every(s=>Math.abs(s.x-s.grip.x)<1e-9),'North/south swings move vertically over the same hand');
  assert(samples.every((s,i)=>i===0||s.pitch<=samples[i-1].pitch),'The shaft angle must travel forward for the entire stroke');
  assert(samples.every(s=>s.reach===samples[0].reach),'The shaft must not telescope while swinging');
  assert(samples[0].groundForward<0&&samples.at(-1).groundForward>0);
  assert(samples.every(s=>s.behind===(s.layer==='behind')));
  assert(samples.every(s=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&Number.isFinite(s.angle)));
 }
});
test('the hand and elbow actually rise with the net and return to the near-hand rest',()=>{
 const p={x:500,y:500},z=48;
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),rest=netVisualPose(p,angle,Infinity,z),raised=netSweepPose(p,angle,NET_WINDUP_FRACTION,z),strike=netSweepPose(p,angle,NET_STRIKE_FRACTION,z),finish=netSweepPose(p,angle,1,z);
  assert.equal(rest.grip.y,p.y-z-60);assert.equal(raised.grip.y,p.y-z-92);assert(raised.elbow.y<rest.elbow.y);
  assert(strike.grip.y>rest.grip.y,'The striking hand lowers forward from the shoulder');assert.equal(finish.grip.y,p.y-z-30);
  assert(Math.abs(raised.grip.x-p.x)>=42-1e-9,'Raised hands stay outside the face');
 }
 const grip=direction=>netVisualPose(p,facingAngle(direction),Infinity,z).grip;
 assert(grip('right').x>p.x);assert(grip('left').x<p.x);assert(grip('down').x<p.x);assert(grip('up').x>p.x);
 assert.equal(grip('left').x-p.x,p.x-grip('right').x);assert.equal(grip('up').x-p.x,p.x-grip('down').x);
});
test('native tool arm endpoints register with the world-space grip at every scale and terrain level',()=>{
 const p={x:513.25,y:604.75};
 for(const direction of ['up','down','left','right'])for(const z of [0,48,144])for(const scale of [1.25,2.5,4])for(const age of [Infinity,0,.1,.16,.285,.41,.59,.7]){
  const angle=facingAngle(direction),pose=netVisualPose(p,angle,age,z),tool=netToolPose(p,angle,age,z,scale);
  assert.equal(tool.kind,'net');assert.equal(tool.facing,direction);
  for(const [endpoint,world]of [[tool.hand,pose.grip],[tool.elbow,pose.elbow]]){assert(Math.abs(p.x+endpoint.x*scale-world.x)<1e-9);assert(Math.abs(p.y-z+endpoint.y*scale-world.y)<1e-9);}
 }
});
test('cooldown returns to the rear shoulder carry without animating a second stroke',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),end=netSweepPose(p,angle,1),rest=netVisualPose(p,angle),samples=Array.from({length:21},(_,i)=>netVisualPose(p,angle,NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS*i/20));
  let remaining=Infinity;
  for(const pose of samples){
   assert(pose.x>=Math.min(end.x,rest.x)-1e-9&&pose.x<=Math.max(end.x,rest.x)+1e-9);assert(pose.y>=Math.min(end.y,rest.y)-1e-9&&pose.y<=Math.max(end.y,rest.y)+1e-9);
   const distance=Math.hypot(pose.x-rest.x,pose.y-rest.y);assert(distance<=remaining+1e-9);remaining=distance;assert.equal(pose.catchable,false);assert.equal(pose.layer,'behind');
  }
  assert.deepEqual(samples.at(-1),rest);assert.equal(rest.stage,'ready');
 }
});

test('walking carries the net above the back shoulder in the rear plane and cannot catch there',()=>{
 const p={x:500,y:500};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),rest=netVisualPose(p,angle),screenForward=(rest.x-p.x)*Math.cos(angle)+(rest.y-p.y)*Math.sin(angle);
  assert.equal(rest.layer,'behind');assert.equal(rest.behind,true);assert.equal(rest.catchable,false);assert(rest.groundForward<-90);
  assert(rest.y<p.y-45,'The carry rim must stay up by the shoulder, never drag below the feet');
  if(direction==='right'||direction==='left')assert(screenForward<-rest.rx,'Side views clearly carry the whole rim behind the body');
  assert(!netSweepHits(rest,p,angle,0,0));
  const strike=netSweepPose(p,angle,NET_STRIKE_FRACTION);assert.equal(strike.layer,'front');assert(strike.groundForward>100);
  const end=netVisualPose(p,angle,NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS);assert.deepEqual(end,rest);
 }
});
