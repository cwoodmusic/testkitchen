export const NET_SWEEP_SECONDS=.50,NET_RECOVERY_SECONDS=.20,NET_HALF_ARC=Math.PI/2;
export const NET_WINDUP_FRACTION=.32,NET_STRIKE_FRACTION=.82,NET_CONTACT_FRACTION=.94,NET_RIM_RX=30,NET_RIM_RY=20;
const NET_REST_PITCH=2.45,NET_REACH=128,NET_SHOULDER_LIFT=30/62,NET_MESH_DEPTH=38;
// The far edge of the hoop, rather than the mesh pocket, reaches the ground.
const NET_FINISH_PITCH=-Math.asin(30/(NET_REACH+NET_RIM_RX));
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
// carry over the back shoulder, make one forward arc, then return behind it.
function netArm(player,angle,z,lift=0){
 const side=Math.cos(angle)*18-Math.sin(angle)*28,sign=side<0?-1:1;
 const grip={x:player.x+side+(sign*42-side)*lift,y:player.y-z-30-62*lift};
 const raised=Math.max(0,(lift-NET_SHOULDER_LIFT)/(1-NET_SHOULDER_LIFT));
 const elbow={x:player.x+sign*(Math.abs(side)+7+10*raised),y:player.y-z-43-24*raised};
 return {grip,elbow};
}
function posed(player,angle,pitch,reach,z,stage,progress,armLift=0,depthScale=1){
 const {grip,elbow}=netArm(player,angle,z,armLift),fx=Math.cos(angle),fy=Math.sin(angle),cos=Math.cos(pitch),sin=Math.sin(pitch),forward=cos*reach,lift=sin*reach;
 const dx=fx*cos,dy=fy*cos*depthScale-sin,projectedLength=Math.hypot(dx,dy),x=grip.x+dx*reach,y=grip.y+dy*reach;
 // A gently billboarded cross-axis keeps the standing hoop readable in side
 // views. The long axis follows the shaft; it never remains a horizontal bowl.
 let ux=projectedLength>1e-9?dx/projectedLength:0,uy=projectedLength>1e-9?dy/projectedLength:-1;
 if(uy>1e-9||(Math.abs(uy)<=1e-9&&ux<0)){ux=-ux;uy=-uy;}
 const major=NET_RIM_RX*Math.max(.45,projectedLength),u={x:ux*major,y:uy*major},v={x:-uy*NET_RIM_RY,y:ux*NET_RIM_RY};
 const gripHeight=30+62*armLift,centerHeight=gripHeight+lift,verticalRadius=NET_RIM_RX*Math.abs(sin),lowest=centerHeight-verticalRadius;
 const rim={u,v,minHeight:Math.abs(lowest)<1e-8?0:lowest,maxHeight:centerHeight+verticalRadius};
 const distance=projectedLength*reach,joint=distance>major?{x:x-dx/projectedLength*major,y:y-dy/projectedLength*major}:{...grip};
 // This is the opposite of angular travel during the forward stroke. The
 // flexible pocket trails backward overhead, then upward above the landing rim.
 const meshAxis={x:-fx*sin,y:-fy*sin*depthScale-cos,height:cos};
 const meshTip={x:x+meshAxis.x*NET_MESH_DEPTH,y:y+meshAxis.y*NET_MESH_DEPTH,height:centerHeight+meshAxis.height*NET_MESH_DEPTH};
 const screenForward=(x-grip.x)*fx+(y-grip.y)*fy,frontRim=Math.hypot(u.x*fx+u.y*fy,v.x*fx+v.y*fy);
 const layer=forward>1e-8?'front':'behind';
 return {grip,elbow,x,y,joint,rim,meshTip,meshAxis,gripHeight,centerHeight,angle:Math.atan2(y-grip.y,x-grip.x),forward:angle,groundForward:forward,pitch,reach,depthScale,rx:Math.hypot(u.x,v.x),ry:Math.hypot(u.y,v.y),stage,progress,layer,behind:layer==='behind',catchable:stage==='sweep'&&layer==='front'&&screenForward>=frontRim+8};
}
function heldPose(player,angle,z){return posed(player,angle,NET_REST_PITCH,NET_REACH,z,'ready',1,NET_SHOULDER_LIFT,.45);}
export function netSweepPose(player,angle,progress,z=0){
 const u=clamp(progress);
 if(u<NET_WINDUP_FRACTION){
  const t=ease(u/NET_WINDUP_FRACTION);
  return posed(player,angle,NET_REST_PITCH+(Math.PI/2-NET_REST_PITCH)*t,NET_REACH,z,'raise',u,NET_SHOULDER_LIFT+(1-NET_SHOULDER_LIFT)*t,.45+.55*t);
 }
 const t=ease(clamp((u-NET_WINDUP_FRACTION)/(NET_CONTACT_FRACTION-NET_WINDUP_FRACTION)));
 return posed(player,angle,Math.PI/2+(NET_FINISH_PITCH-Math.PI/2)*t,NET_REACH,z,'sweep',u,1-t);
}
export function netVisualPose(player,angle,age=Infinity,z=0){
 if(Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS)return netSweepPose(player,angle,age/NET_SWEEP_SECONDS,z);
 const rest=heldPose(player,angle,z);
 if(!Number.isFinite(age)||age<NET_SWEEP_SECONDS||age>=NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return rest;
 // The single stroke finishes here. Return to the rear carry frame during
 // cooldown, rather than replaying a reverse chop or shrinking through the body.
 return {...rest,stage:'recover'};
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
  if(!pose.catchable)continue;
  const {u,v}=pose.rim,dx=point.x-pose.x,dy=point.y-pose.y,det=u.x*v.y-u.y*v.x;
  const a=(dx*v.y-dy*v.x)/det,b=(u.x*dy-u.y*dx)/det;
  if(a*a+b*b<=1+1e-12)return true;
 }
 return false;
}
