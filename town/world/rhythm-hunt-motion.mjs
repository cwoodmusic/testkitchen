export const NET_SWEEP_SECONDS=.38,NET_RECOVERY_SECONDS=.16,NET_HALF_ARC=.86;
export const NET_WINDUP_FRACTION=.18,NET_RIM_RX=30,NET_RIM_RY=20;
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
// Keep the wrist on the near hand: the back view mirrors the front view,
// and side views use the hand on the side the avatar is actually facing.
function netGrip(player,angle,z){return {x:player.x+Math.cos(angle)*18-Math.sin(angle)*28,y:player.y-z-30};}
function poseAt(player,angle,theta,reach,z,stage,progress){
 const grip=netGrip(player,angle,z);
 return {grip,x:grip.x+Math.cos(theta)*reach,y:grip.y+Math.sin(theta)*reach,angle:theta,forward:angle,rx:NET_RIM_RX,ry:NET_RIM_RY,stage,progress};
}
export function netSweepPose(player,angle,progress,z=0){
 const u=clamp(progress);
 // A small windup happens beside the hand. The visible long stroke then
 // crosses only the forward sector; its return retracts instead of swinging back.
 if(u<NET_WINDUP_FRACTION){const t=ease(u/NET_WINDUP_FRACTION);return poseAt(player,angle,angle+NET_HALF_ARC-NET_HALF_ARC*2*t,60+48*t,z,'windup',u);}
 const t=(u-NET_WINDUP_FRACTION)/(1-NET_WINDUP_FRACTION),theta=angle-NET_HALF_ARC+NET_HALF_ARC*2*ease(t),reach=108+Math.sin(Math.PI*t)*6;
 return poseAt(player,angle,theta,reach,z,'sweep',u);
}
export function netVisualPose(player,angle,age=Infinity,z=0){
 if(Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS)return netSweepPose(player,angle,age/NET_SWEEP_SECONDS,z);
 const recovering=Number.isFinite(age)&&age>=NET_SWEEP_SECONDS&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS;
 const u=recovering?ease((age-NET_SWEEP_SECONDS)/NET_RECOVERY_SECONDS):1;
 return poseAt(player,angle,angle+NET_HALF_ARC,108-48*u,z,recovering?'recover':'ready',1);
}
export function netSweepHits(point,player,angle,from,to,z=0){
 const n=Math.max(1,Math.ceil(Math.abs(to-from)*32));
 for(let i=0;i<=n;i++){const pose=netSweepPose(player,angle,from+(to-from)*i/n,z);if(Math.hypot((point.x-pose.x)/pose.rx,(point.y-pose.y)/pose.ry)<=1)return true;}
 return false;
}
