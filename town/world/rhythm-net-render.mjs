import {netVisualPose,netSweepPose,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS,NET_WINDUP_FRACTION} from './rhythm-hunt-motion.mjs?v=town-store-halls-1';

const TAU=Math.PI*2;
function rimPoint(pose,angle,scale=1,center=pose){
 const a=Math.cos(angle)*scale,b=Math.sin(angle)*scale;
 return {x:center.x+pose.rim.u.x*a+pose.rim.v.x*b,y:center.y+pose.rim.u.y*a+pose.rim.v.y*b};
}
function hoopPath(c,pose,scale=1,center=pose){
 c.beginPath();for(let i=0;i<=40;i++){const p=rimPoint(pose,i/40*TAU,scale,center);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.closePath();
}
function pocketPoint(pose,angle,depth){
 const center={x:pose.x+(pose.meshTip.x-pose.x)*depth,y:pose.y+(pose.meshTip.y-pose.y)*depth};
 return rimPoint(pose,angle,Math.pow(1-depth,.65),center);
}
// The silhouette includes the mouth, rounded sides and trailing end. It is
// small (49 points) and uses no offscreen surface or per-frame image work.
function pocketOutline(pose){
 const points=[pose.meshTip];for(const depth of [0,.5])for(let i=0;i<24;i++)points.push(pocketPoint(pose,i/24*TAU,depth));
 points.sort((a,b)=>a.x-b.x||a.y-b.y);const cross=(a,b,p)=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x),lower=[],upper=[];
 for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function drawPocket(c,pose){
 const outline=pocketOutline(pose);c.beginPath();for(const [i,p]of outline.entries()){if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.closePath();c.fillStyle='#eaf4de24';c.fill();
 c.strokeStyle='#e1edcf91';c.lineWidth=1;
 for(let i=0;i<12;i++){
  c.beginPath();for(let j=0;j<=6;j++){const p=pocketPoint(pose,i/12*TAU,j/6);if(j)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
 }
 for(const depth of [.2,.42,.64,.82]){
  const center={x:pose.x+(pose.meshTip.x-pose.x)*depth,y:pose.y+(pose.meshTip.y-pose.y)*depth};hoopPath(c,pose,Math.pow(1-depth,.65),center);c.stroke();
 }
}

/** The shaft and vertical hoop arc as one tool; the flexible bag trails it. */
export function drawRhythmNet(c,player,{angle,age=Infinity,z=0,reducedMotion=false,swinging=false}={}){
 const active=Number.isFinite(age)&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS,pose=netVisualPose(player,angle,active?age:Infinity,z),sweeping=active&&age<NET_SWEEP_SECONDS;
 c.save();c.lineCap='round';c.lineJoin='round';
 if(sweeping&&pose.stage==='sweep'&&pose.layer==='front'&&!reducedMotion){
  const u=age/NET_SWEEP_SECONDS,from=Math.max(NET_WINDUP_FRACTION,u-.16);c.strokeStyle='#fce9af66';c.lineWidth=3;c.beginPath();
  for(let i=0;i<=10;i++){const p=netSweepPose(player,angle,from+(u-from)*i/10,z);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.stroke();
 }
 drawPocket(c,pose);
 // The shaft meets the near hoop edge in the same rotated pose used to catch.
 const joint=pose.joint;
 c.strokeStyle='#5d412b';c.lineWidth=6;c.beginPath();c.moveTo(pose.grip.x,pose.grip.y);c.lineTo(joint.x,joint.y);c.stroke();c.strokeStyle='#d1ab72';c.lineWidth=2;c.beginPath();c.moveTo(pose.grip.x-1,pose.grip.y-1);c.lineTo(joint.x-1,joint.y-1);c.stroke();
 hoopPath(c,pose);c.fillStyle='#d9efda18';c.fill();c.strokeStyle=sweeping&&pose.catchable?'#ffe5a1':'#c7ab7a';c.lineWidth=3;c.stroke();c.restore();
 return pose;
}
