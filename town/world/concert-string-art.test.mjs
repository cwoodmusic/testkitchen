import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {drawViolinPlayingPose,violinPlayingGeometry} from './concert-string-art.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const actor={id:'concert-strings-example',instrument:'violin',phase:.3,seated:true,appearance:{skin:'#d6a37c',hair:'#49312b',shirt:'#292c38',lowerColor:'#292b36',hairstyle:'short',outfit:'tuxedo',accessory:'none',shoes:'oxfords'}};

test('violin rests below the chin on the player’s left and the left hand supports its neck',()=>{
 for(const seated of [false,true]){
  const g=violinPlayingGeometry({...actor,seated},0);
  assert(g.chinRest.x>g.chin.x,'The rest belongs on anatomical left, screen right');
  assert(distance(g.chin,g.chinRest)<2,'The chin must contact the instrument instead of leaving it at waist level');
  assert(g.scroll.x>g.leftShoulder.x+15,'The neck extends outward from the left shoulder');
  assert(g.scroll.y<g.chinRest.y,'The violin is held horizontally with a gently raised scroll');
  assert(g.leftElbow.y>g.leftHand.y,'A bent supporting forearm rises to the neck');
  const dx=g.scroll.x-g.neckStart.x,dy=g.scroll.y-g.neckStart.y;
  assert(Math.abs((g.leftHand.x-g.neckStart.x)*dy-(g.leftHand.y-g.neckStart.y)*dx)/Math.hypot(dx,dy)<2,'Fingers remain on the actual neck');
 }
});

test('bow hair stays across the bridge while a connected right hand slides the bow along its own axis',()=>{
 let first;
 for(let beat=0;beat<Math.PI*2;beat+=.1){
  const g=violinPlayingGeometry(actor,beat),dx=g.bowGrip.x-g.bowTip.x,dy=g.bowGrip.y-g.bowTip.y,len=Math.hypot(dx,dy);
  const cross=(g.bridge.x-g.bowTip.x)*dy-(g.bridge.y-g.bowTip.y)*dx;
  assert(Math.abs(cross)<1e-8,'The bow must touch the bridge at every stroke phase');
  const along=((g.bridge.x-g.bowTip.x)*dx+(g.bridge.y-g.bowTip.y)*dy)/(len*len);
  assert(along>.15&&along<.85,'The bridge stays between the bow tip and the right-hand grip');
  const neck={x:g.scroll.x-g.neckStart.x,y:g.scroll.y-g.neckStart.y};
  assert(Math.abs((neck.x*dx+neck.y*dy)/(Math.hypot(neck.x,neck.y)*len))<.02,'Bowing is transverse to the strings');
  assert(distance(g.rightElbow,g.bowGrip)<32,'The hand stays within a connected bent forearm’s reach');
  if(first){assert(Math.abs(len-first.len)<1e-8);assert.deepEqual(g.bridge,first.bridge);}else first={len,bridge:g.bridge};
 }
 assert.notDeepEqual(violinPlayingGeometry(actor,0).bowGrip,violinPlayingGeometry(actor,1).bowGrip);
});

test('native bodies omit lap hands only for string and piano overlays; unrelated pixels stay identical',()=>{
 const sandbox={window:{}};runInNewContext(readFileSync(new URL('../../character-renderer.js',import.meta.url),'utf8'),sandbox);
 const renderer=sandbox.window.createCodaCharacterRenderer({worldScale:1,reducedMotion:()=>true});
 const frame=(instrumentPose,facing)=>{const cv=createCanvas(128,144),c=cv.getContext('2d');renderer.drawNPC(c,{...actor,x:64,y:100,facing,instrumentPose},.6);return c.getImageData(0,0,128,144).data;};
 for(const facing of ['down','right']){
 const normal=frame(undefined,facing),unknown=frame('clarinet',facing),violin=frame('violin',facing),viola=frame('viola',facing),piano=frame('piano',facing);
 assert.deepEqual(unknown,normal,'Unknown instrument flags must not alter ordinary characters');
 assert.deepEqual(viola,violin,'Both bowed shoulder strings use the same body-only boundary');
 assert.deepEqual(piano,violin,'The right-facing keyboard pose supplies its own arms through the same boundary');
 assert.notDeepEqual(violin,normal,'The native lap hands must disappear before posed arms are drawn');
 let changed=0;
 for(let y=0;y<144;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;if(normal.subarray(i,i+4).some((v,j)=>v!==violin[i+j])){
   changed++;assert(x>=49&&x<=80&&y>=84&&y<=101,`Unrelated native pixel changed at${x},${y}`);
  }
 }
 assert(changed>20);
 }
});

test('pixel playing artwork remains finite, animated and independent of the actor data',()=>{
 const cv=createCanvas(200,200),c=cv.getContext('2d'),before=JSON.stringify(actor);c.translate(70,100);c.scale(3,3);
 drawViolinPlayingPose(c,actor,0);const first=c.getImageData(0,0,200,200).data;
 c.clearRect(-70,-100,200,200);drawViolinPlayingPose(c,actor,1);const next=c.getImageData(0,0,200,200).data;
 assert.notDeepEqual(first,next);assert.equal(JSON.stringify(actor),before);
 const invalid=violinPlayingGeometry({phase:Infinity},NaN);assert(Object.values(invalid).every(value=>typeof value==='number'?Number.isFinite(value):Number.isFinite(value.x)&&Number.isFinite(value.y)));
});
