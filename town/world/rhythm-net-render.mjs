import {netVisualPose,netSweepPose,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS,NET_WINDUP_FRACTION} from './rhythm-hunt-motion.mjs?v=town-shoulder-1';

/** Carry the net behind the shoulder, then draw its one forward chop arc. */
export function drawRhythmNet(c,player,{angle,age=Infinity,z=0,reducedMotion=false,swinging=false}={}){
 const active=Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS,pose=netVisualPose(player,angle,active?age:Infinity,z),sweeping=active&&age<NET_SWEEP_SECONDS;
 c.save();c.lineCap='round';c.lineJoin='round';
 if(sweeping&&pose.stage==='sweep'&&pose.layer==='front'&&!reducedMotion){
  const u=age/NET_SWEEP_SECONDS,from=Math.max(NET_WINDUP_FRACTION,u-.16);c.strokeStyle='#fce9af66';c.lineWidth=3;c.beginPath();
  for(let i=0;i<=10;i++){const p=netSweepPose(player,angle,from+(u-from)*i/10,z);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
 }
 // The handle meets the near edge of the oval, rather than crossing its opening.
 const dx=pose.x-pose.grip.x,dy=pose.y-pose.grip.y,distance=Math.hypot(dx,dy),ux=dx/distance,uy=dy/distance,edge=1/Math.hypot(ux/pose.rx,uy/pose.ry),joint={x:pose.x-ux*edge,y:pose.y-uy*edge};
 c.strokeStyle='#5d412b';c.lineWidth=6;c.beginPath();c.moveTo(pose.grip.x,pose.grip.y);c.lineTo(joint.x,joint.y);c.stroke();c.strokeStyle='#d1ab72';c.lineWidth=2;c.beginPath();c.moveTo(pose.grip.x-1,pose.grip.y-1);c.lineTo(joint.x-1,joint.y-1);c.stroke();
 c.translate(pose.x,pose.y);
 // A shallow, transparent mesh pocket hangs below the rim. Its mouth remains
 // unrotated so the visible oval is precisely the ellipse used by netSweepHits.
 c.beginPath();c.moveTo(-pose.rx,0);c.bezierCurveTo(-26,27,-13,38,0,38);c.bezierCurveTo(15,38,27,26,pose.rx,0);c.quadraticCurveTo(0,15,-pose.rx,0);c.closePath();c.fillStyle='#eaf4de24';c.fill();c.save();c.clip();c.strokeStyle='#e1edcf91';c.lineWidth=1;
 for(let x=-36;x<=36;x+=9){c.beginPath();c.moveTo(x,-8);c.lineTo(x+18,42);c.stroke();c.beginPath();c.moveTo(x,-8);c.lineTo(x-18,42);c.stroke();}c.restore();
 c.strokeStyle='#c3cfb6b0';c.lineWidth=2;c.beginPath();c.moveTo(-pose.rx,0);c.bezierCurveTo(-26,27,-13,38,0,38);c.bezierCurveTo(15,38,27,26,pose.rx,0);c.stroke();
 c.fillStyle='#d9efda18';c.beginPath();c.ellipse(0,0,pose.rx,pose.ry,0,0,Math.PI*2);c.fill();c.strokeStyle=sweeping&&pose.catchable?'#ffe5a1':'#c7ab7a';c.lineWidth=3;c.stroke();c.restore();
 return pose;
}
