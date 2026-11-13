export const NET_SWEEP_SECONDS=.50,NET_RECOVERY_SECONDS=.20,NET_HALF_ARC=Math.PI/2;
export const NET_WINDUP_FRACTION=.32,NET_STRIKE_FRACTION=.82,NET_RIM_RX=30,NET_RIM_RY=20;
const ease=u=>u*u*(3-2*u),clamp=u=>Math.max(0,Math.min(1,u));
export const facingAngle=facing=>({right:0,down:Math.PI/2,left:Math.PI,up:-Math.PI/2})[facing]??Math.PI/2;
export const angleFacing=angle=>Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?(Math.cos(angle)>0?'right':'left'):(Math.sin(angle)>0?'down':'up');
export function launchFlyingNotes(tokens){return tokens.map(t=>({...t,homeX:t.x,homeY:t.y,vx:Math.cos(t.phase)*100,vy:Math.sin(t.phase)*100}));}
export function advanceFlyingNote(t,player,dt,time,canMove){
 dt=Math.max(0,Math.min(.05,dt));if(!dt)return;
 const dx=t.x-player.x,dy=t.y-player.y,d=Math.hypot(dx,dy),home=Math.hypot(t.x-t.homeX,t.y-t.homeY),flee=Math.max(0,1-d/310),returning=Math.max(0,(home-105)/80);
 const wander=t.phase+Math.sin(time*1.7+t.phase)*1.8+Math.sin(time*.63+t.phase*3)*1.1;
 let vx=Math.cos(wander)*115+dx/Math.max(1,d)*flee*260+(t.homeX-t.x)*returning*2.3,vy=Math.sin(wander)*115+dy/Math.max(1,d)*flee*260+(t.homeY-t.y)*returning*2.3;
 const speed=Math.hypot(vx,vy),limit=170+flee*85;if(speed>limit){vx*=limit/speed;vy*=limit/speed;}
 const blend=1-Math.exp(-dt*7);t.vx+=(vx-t.vx)*blend;t.vy+=(vy-t.vy)*blend;
 const steps=Math.max(1,Math.ceil(Math.hypot(t.vx,t.vy)*dt/2));
 for(let i=0;i<steps;i++){
  const next={x:t.x+t.vx*dt/steps,y:t.y+t.vy*dt/steps};
  if(canMove(t,next)){t.x=next.x;t.y=next.y;}else{t.vx=-t.vx*.6;t.vy=-t.vy*.6;break;}
 }
}
export function flyingNotePose(t,time,z=0,reduced=false){return {x:t.x,y:t.y-z-80+(reduced?0:Math.sin(time*4+t.phase)*7+Math.sin(time*8+t.phase)*2)};}
// The net swings in the vertical plane of the avatar's facing, like an axe:
// lift over the head, chop forward, then lower the handle back to the near hand.
function netArm(player,angle,z,lift=0){
 const side=Math.cos(angle)*18-Math.sin(angle)*28,sign=side<0?-1:1;
 const grip={x:player.x+side+(sign*42-side)*lift,y:player.y-z-30-62*lift};
 const elbow={x:player.x+sign*(Math.abs(side)+7+10*lift),y:player.y-z-43-24*lift};
 return {grip,elbow};
}
function posed(player,angle,pitch,reach,z,stage,progress,armLift=0){
 const {grip,elbow}=netArm(player,angle,z,armLift),forward=Math.cos(pitch)*reach,lift=Math.sin(pitch)*reach;
 const x=grip.x+Math.cos(angle)*forward,y=grip.y+Math.sin(angle)*forward-lift;
 const screenForward=(x-grip.x)*Math.cos(angle)+(y-grip.y)*Math.sin(angle),frontRim=Math.abs(Math.cos(angle))*NET_RIM_RX+Math.abs(Math.sin(angle))*NET_RIM_RY;
 return {grip,elbow,x,y,angle:Math.atan2(y-grip.y,x-grip.x),forward:angle,pitch,reach,rx:NET_RIM_RX,ry:NET_RIM_RY,stage,progress,catchable:stage==='sweep'&&screenForward>=frontRim+8};
}
function heldPose(player,angle,z){return posed(player,angle,.10,66,z,'ready',1);}
export function netSweepPose(player,angle,progress,z=0){
 const u=clamp(progress);
 if(u<NET_WINDUP_FRACTION){
  const t=ease(u/NET_WINDUP_FRACTION);
  return posed(player,angle,.10+(Math.PI/2-.10)*t,66+70*t,z,'windup',u,t);
 }
 const t=ease((u-NET_WINDUP_FRACTION)/(1-NET_WINDUP_FRACTION));
 return posed(player,angle,Math.PI/2-(Math.PI/2+.12)*t,136-10*t,z,'sweep',u,1-t);
}
export function netVisualPose(player,angle,age=Infinity,z=0){
 if(Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS)return netSweepPose(player,angle,age/NET_SWEEP_SECONDS,z);
 const rest=heldPose(player,angle,z);
 if(!Number.isFinite(age)||age<NET_SWEEP_SECONDS||age>=NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return rest;
 const finish=netSweepPose(player,angle,1,z),u=ease((age-NET_SWEEP_SECONDS)/NET_RECOVERY_SECONDS),x=finish.x+(rest.x-finish.x)*u,y=finish.y+(rest.y-finish.y)*u;
 const grip={x:finish.grip.x+(rest.grip.x-finish.grip.x)*u,y:finish.grip.y+(rest.grip.y-finish.grip.y)*u},elbow={x:finish.elbow.x+(rest.elbow.x-finish.elbow.x)*u,y:finish.elbow.y+(rest.elbow.y-finish.elbow.y)*u};
 return {...rest,grip,elbow,x,y,angle:Math.atan2(y-grip.y,x-grip.x),stage:'recover'};
}
// Native screen-oriented pixels relative to the projected feet. The character
// renderer handles its own left mirror and outfit build, while this contract
// makes the visible hand land on the exact world-space net grip.
export function netToolPose(player,angle,age=Infinity,z=0,worldScale=2.5){
 const pose=netVisualPose(player,angle,age,z),scale=Number.isFinite(worldScale)&&worldScale>0?worldScale:2.5;
 const point=p=>({x:(p.x-player.x)/scale,y:(p.y-player.y+z)/scale});
 return {kind:'net',hand:point(pose.grip),elbow:point(pose.elbow),facing:angleFacing(angle),active:Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS};
}
export function netSweepHits(point,player,angle,from,to,z=0){
 const n=Math.max(1,Math.ceil(Math.abs(to-from)*48));
 for(let i=0;i<=n;i++){
  const pose=netSweepPose(player,angle,from+(to-from)*i/n,z);
  if(pose.catchable&&Math.hypot((point.x-pose.x)/pose.rx,(point.y-pose.y)/pose.ry)<=1)return true;
 }
 return false;
}
