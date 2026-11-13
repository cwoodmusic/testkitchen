import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {netToolPose,netVisualPose,facingAngle,NET_WINDUP_FRACTION,NET_SWEEP_SECONDS} from './rhythm-hunt-motion.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
function renderer(){const sandbox={window:{}};runInNewContext(readFileSync(new URL('../../character-renderer.js',import.meta.url),'utf8'),sandbox);return sandbox.window.createCodaCharacterRenderer({worldScale:2.5,createCanvas});}
function render(r,profile,motion,time=0){const canvas=createCanvas(420,420),c=canvas.getContext('2d');r.drawPlayer(c,profile,motion,time);return {canvas,pixels:c.getImageData(0,0,420,420)};}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
function countColor(pixels,point,color,radius=5){
 const wanted=rgb(color);let count=0;for(let y=Math.floor(point.y-radius);y<=Math.ceil(point.y+radius);y++)for(let x=Math.floor(point.x-radius);x<=Math.ceil(point.x+radius);x++){if(x<0||y<0||x>=pixels.width||y>=pixels.height)continue;const i=(y*pixels.width+x)*4;if(pixels.data[i+3]&&wanted.every((v,k)=>v===pixels.data[i+k]))count++;}return count;
}
const profiles=[{hairstyle:'bald',skin:'#bb7e5f',shirt:'#217b61'}, {hairstyle:'short',skin:'#7f503a',shirt:'#a94274',outfit:'overalls'}, {characterId:'bach',hairstyle:'bald',skin:'#d29b73',shirt:'#294f7d',outfit:'coat'}];

test('raised player hands touch the net grip in all four views and costume builds',()=>{
 const r=renderer(),player={x:210,y:300},age=NET_WINDUP_FRACTION*NET_SWEEP_SECONDS;
 for(const profile of profiles)for(const facing of ['up','down','left','right']){
  const angle=facingAngle(facing),toolPose=netToolPose(player,angle,age),pose=netVisualPose(player,angle,age),posed=render(r,profile,{...player,facing,toolPose}),normal=render(r,profile,{...player,facing});
  assert(countColor(posed.pixels,pose.grip,profile.skin)>0,`${facing}: actual skin pixels must reach the raised world-space handle`);
  assert.equal(countColor(normal.pixels,pose.grip,profile.skin),0,`${facing}: this is a raised arm, not the old wrist position`);
  const rest={x:player.x+(facing==='down'?-27.5:facing==='up'?27.5:facing==='left'?-17.5:17.5),y:player.y-27.5};
  assert.equal(countColor(posed.pixels,rest,profile.skin,2),0,`${facing}: the replaced arm cannot leave an extra resting hand`);
 }
});

test('tool hand registration survives walking gait and the custom-pixel surface path',()=>{
 const r=renderer(),player={x:210,y:300},profile=profiles[0];r.setPixelEdits({player:Object.fromEntries(['up','down','left','right'].map(facing=>[facing,[[0,0,'#ff00ff']]]))});
 for(const facing of ['up','down','left','right'])for(const phase of [0,1.5,3])for(const age of [.08,.16,.41,.59]){
  const angle=facingAngle(facing),toolPose=netToolPose(player,angle,age),pose=netVisualPose(player,angle,age),image=render(r,profile,{...player,facing,walking:true,phase,toolPose},phase);
  assert(countColor(image.pixels,pose.grip,profile.skin)>0,`${facing}/${phase}/${age}: walking or pixel edits must not detach the hand`);
 }
 const tool=netToolPose(player,0,.16),motion=r.sampleMotion({walking:true,phase:1.5,toolPose:tool},.7);assert.equal(motion.bob,0);assert.notEqual(motion.stride,0,'Only upper-body bob is suppressed; walking feet retain their gait');
});

test('missing, malformed and unrelated tool poses preserve ordinary and concert artwork',()=>{
 const r=renderer(),player={x:210,y:300};
 for(const facing of ['up','down','left','right']){
  const profile=profiles[0],normal=render(r,profile,{...player,facing,walking:true,phase:1.3},.7).pixels.data;
  for(const toolPose of [{kind:'rod',hand:{x:10,y:-30},elbow:{x:12,y:-20}},{kind:'net',hand:{x:NaN,y:-30},elbow:{x:12,y:-20}},{kind:'net',hand:{x:10,y:-1300},elbow:{x:12,y:-20}}])assert.deepEqual(render(r,profile,{...player,facing,walking:true,phase:1.3,toolPose},.7).pixels.data,normal);
  const actor={id:'bach',...player,facing,instrumentPose:'concert'},a=createCanvas(420,420),b=createCanvas(420,420);r.drawNPC(a.getContext('2d'),actor,.7);r.drawNPC(b.getContext('2d'),{...actor,toolPose:netToolPose(player,facingAngle(facing),.16)},.7);assert.deepEqual(a.getContext('2d').getImageData(0,0,420,420).data,b.getContext('2d').getImageData(0,0,420,420).data,'Optional player tools do not enter the concert NPC pipeline');
 }
});

test('equipping the net temporarily stows carried props without changing saved appearance',()=>{
 const r=renderer(),player={x:210,y:300},toolPose=netToolPose(player,0,.16),motion={...player,facing:'right',toolPose},plain={...profiles[0],accessory:'none'};
 for(const accessory of ['score','trumpet','guitar','umbrella']){
  const profile={...plain,accessory},before=JSON.stringify(profile);
  assert.deepEqual(render(r,profile,motion).pixels.data,render(r,plain,motion).pixels.data,'A carried prop cannot add a second hand while the net is held');
  assert.notDeepEqual(render(r,profile,{...player,facing:'right'}).pixels.data,render(r,plain,{...player,facing:'right'}).pixels.data,'Stowing the net restores the original carried artwork');
  assert.equal(JSON.stringify(profile),before);
 }
 assert.notDeepEqual(render(r,{...plain,accessory:'headphones'},motion).pixels.data,render(r,plain,motion).pixels.data,'Wearable accessories stay on while holding a net');
});
