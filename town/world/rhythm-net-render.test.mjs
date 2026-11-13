import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {drawRhythmNet} from './rhythm-net-render.mjs';
import {facingAngle,netSweepHits,NET_WINDUP_FRACTION,NET_STRIKE_FRACTION,NET_CONTACT_FRACTION,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');

function context(){
 const strokes=[];let depth=0,path=[];
 const c=new Proxy({strokes,get depth(){return depth;},save(){depth++;},restore(){depth--;},beginPath(){path=[];},moveTo(x,y){path.push({x,y});},lineTo(x,y){path.push({x,y});},stroke(){strokes.push({color:c.strokeStyle,points:[...path]});}},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true;}});
 return c;
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} versus ${b}`);
test('every rendered hoop point follows the rotated catch opening in all four directions',()=>{
 const player={x:400,y:400},progress=NET_STRIKE_FRACTION;
 for(const direction of ['up','down','left','right']){
  const c=context(),angle=facingAngle(direction),pose=drawRhythmNet(c,player,{angle,age:progress*NET_SWEEP_SECONDS,z:24,reducedMotion:true}),hoop=c.strokes.at(-1),{u,v}=pose.rim,det=u.x*v.y-u.y*v.x;
  assert.equal(c.depth,0);assert.equal(hoop.color,'#ffe5a1');assert.equal(hoop.points.length,41);
  for(const p of hoop.points){
   const dx=p.x-pose.x,dy=p.y-pose.y,a=(dx*v.y-dy*v.x)/det,b=(u.x*dy-u.y*dx)/det;
   near(a*a+b*b,1);
   assert(netSweepHits({x:pose.x+dx*.99,y:pose.y+dy*.99},player,angle,progress,progress,24),'A note just inside the drawn rim is catchable');
   assert(!netSweepHits({x:pose.x+dx*1.01,y:pose.y+dy*1.01},player,angle,progress,progress,24),'A note outside the visible rim must miss');
  }
  const shaft=c.strokes.find(s=>s.color==='#5d412b');assert.deepEqual(shaft.points,[pose.grip,pose.joint]);
 }
});

test('the drawn pocket strands converge behind the hoop instead of hanging in one fixed direction',()=>{
 const player={x:400,y:400};
 for(const direction of ['up','down','left','right']){
  const angle=facingAngle(direction),c=context(),pose=drawRhythmNet(c,player,{angle,age:NET_WINDUP_FRACTION*NET_SWEEP_SECONDS,reducedMotion:true}),strands=c.strokes.filter(s=>s.color==='#e1edcf91'&&s.points.length===7);
  assert.equal(strands.length,12);for(const strand of strands){near(strand.points.at(-1).x,pose.meshTip.x);near(strand.points.at(-1).y,pose.meshTip.y);}
  const fx=Math.cos(angle),fy=Math.sin(angle);assert((pose.meshTip.x-pose.x)*fx+(pose.meshTip.y-pose.y)*fy<0,'The overhead bag must trail the forward motion');
  const impact=context(),landed=drawRhythmNet(impact,player,{angle,age:NET_CONTACT_FRACTION*NET_SWEEP_SECONDS,reducedMotion:true});
  assert.equal(landed.rim.minHeight,0);assert(landed.meshTip.height>landed.rim.maxHeight,'The mesh is still airborne when the leading hoop contacts the ground');
 }
});

test('actual overhead hoop pixels form a vertical opening and restore the canvas state',()=>{
 for(const direction of ['up','down','left','right']){
  const canvas=createCanvas(700,700),c=canvas.getContext('2d');c.lineWidth=7;c.strokeStyle='#123456';c.fillStyle='#654321';c.translate(9,12);
  const before=c.getTransform(),pose=drawRhythmNet(c,{x:350,y:470},{angle:facingAngle(direction),age:NET_WINDUP_FRACTION*NET_SWEEP_SECONDS,reducedMotion:true}),image=c.getImageData(0,0,700,700),xs=[],ys=[];
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const i=(y*image.width+x)*4;if(image.data[i]===199&&image.data[i+1]===171&&image.data[i+2]===122&&image.data[i+3]===255){xs.push(x);ys.push(y);}}
  assert(xs.length>50,'The real canvas must draw the hoop');
  const width=Math.max(...xs)-Math.min(...xs)+1,height=Math.max(...ys)-Math.min(...ys)+1;
  assert(height>width*1.3,'The overhead hoop must stand vertically, not remain a flat bowl');
  near((Math.max(...xs)+Math.min(...xs))/2,Math.round(pose.x+9)-.5);near((Math.max(...ys)+Math.min(...ys))/2,Math.round(pose.y+12)-.5);
  assert.equal(c.lineWidth,7);assert.deepEqual(c.getTransform(),before);
  // Native style getters retain their last assignment across restore(), so
  // verify the restored ink itself rather than that library's cached getters.
  c.fillRect(-9,-12,4,4);assert.deepEqual([...c.getImageData(1,1,1,1).data],[101,67,33,255]);
  c.beginPath();c.moveTo(10,20);c.lineTo(35,20);c.stroke();assert.deepEqual([...c.getImageData(29,32,1,1).data],[18,52,86,255]);
 }
});

test('carry, raise, swing, impact and cooldown draw safely without leaking canvas state',()=>{
 for(const direction of ['up','down','left','right'])for(const age of [Infinity,0,.02,.16,.25,NET_CONTACT_FRACTION*NET_SWEEP_SECONDS,NET_SWEEP_SECONDS,NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS/2,NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS]){
  const c=context(),pose=drawRhythmNet(c,{x:400,y:400},{angle:facingAngle(direction),age});assert.equal(c.depth,0);assert(c.strokes.length>10);assert(c.strokes.every(s=>s.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))));assert(Number.isFinite(pose.x)&&Number.isFinite(pose.y));
 }
});
