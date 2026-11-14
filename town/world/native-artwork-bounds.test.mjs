import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artworkBounds,nativeArtworkBounds,containedArtworkRect,drawContainedArtwork} from './native-artwork-bounds.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {decorCollisionBoxes} from './scene-collision.mjs';

const sheets=JSON.parse(readFileSync(new URL('../assets/decor/atlas.json',import.meta.url),'utf8'));

test('recovered decor silhouettes stay inside their native source sheets and fixed saved-map canvases',()=>{
 const repaired=decorDefinitions.filter(def=>nativeArtworkBounds[def.id]);
 assert.equal(repaired.length,64);
 for(const def of repaired){
  const sheet=sheets.find(s=>s.family===def.family),original=sheet.cells[def.index],source=artworkBounds(def.id,original);
  assert(source.x>=0&&source.y>=0&&source.x+source.w<=sheet.width&&source.y+source.h<=sheet.height,def.id);
  assert(source.x<=original.x&&source.y<=original.y&&source.x+source.w>=original.x+original.w&&source.y+source.h>=original.y+original.h,def.id+' recovers rather than discards native pixels');
  const scale=Math.min(def.maxW/original.w,def.maxH/original.h),width=Math.ceil(original.w*scale),height=Math.ceil(original.h*scale),target=containedArtworkRect(source,width,height);
  assert(target.x>=0&&target.y>=0&&target.x+target.w<=width+1e-9&&target.y+target.h<=height+1e-9,def.id);
  assert(Math.abs(target.w/source.w-target.h/source.h)<1e-10,def.id+' keeps native proportions');
  assert.equal(target.x+target.w/2,width/2,def.id+' keeps the horizontal ground anchor');
  assert.equal(target.y+target.h,height,def.id+' keeps the vertical ground anchor');
 }
});

test('decor registration preserves every original dimension, collision and ID while drawing complete source bounds',async()=>{
 const previous={Image:globalThis.Image,fetch:globalThis.fetch};
 class FakeImage{
  width=1536;height=1024;
  set src(url){const sheet=sheets.find(s=>String(url).endsWith(s.file)||String(url).endsWith(s.thumb));this.width=sheet.width;this.height=sheet.height;queueMicrotask(()=>this.onload());}
 }
 globalThis.Image=FakeImage;globalThis.fetch=async()=>({ok:true,json:async()=>sheets});
 try{
  const {registerDecor}=await import('./decor-pack.mjs'),catalog=new Map();await registerDecor(catalog);
  assert.equal(catalog.size,256);
  for(const def of decorDefinitions){
   const original=sheets.find(s=>s.family===def.family).cells[def.index],scale=Math.min(def.maxW/original.w,def.maxH/original.h),width=Math.ceil(original.w*scale),height=Math.ceil(original.h*scale),asset=catalog.get(def.id);
   assert.equal(asset.w,width,def.id);assert.equal(asset.h,height,def.id);assert.deepEqual(asset.boxes,decorCollisionBoxes(def,width,height),def.id);
   if(!nativeArtworkBounds[def.id]){const calls=[];asset.draw({drawImage:(...args)=>calls.push(args)});assert.deepEqual(calls[0].slice(1),[original.x,original.y,original.w,original.h,0,0,width,height],def.id+' keeps its original source-to-world mapping');}
  }
  for(const id of ['decor-10-06','decor-11-07','decor-15-01','decor-15-08']){
   const asset=catalog.get(id),calls=[];asset.draw({drawImage:(...args)=>calls.push(args)});
   const [call]=calls,source=nativeArtworkBounds[id];assert.deepEqual(call.slice(1,5),[source.x,source.y,source.w,source.h],id);
  }
 }finally{Object.assign(globalThis,previous);}
});

test('isolated bench and lyre-window art retains a bottom-center anchor in their existing canvas',()=>{
 const calls=[],image={};
 for(const id of ['props-1-150','music-2-120']){
  const source=nativeArtworkBounds[id];drawContainedArtwork({drawImage:(...args)=>calls.push(args)},image,source,150,154,10,20);
  const call=calls.at(-1);assert.equal(call[0],image);assert.equal(call[5]+call[7]/2,85);assert.equal(call[6]+call[8],174);
 }
 assert.equal(nativeArtworkBounds['props-1-150'].y+nativeArtworkBounds['props-1-150'].h,419,'Gazebo fragment at y477 is excluded');
 assert(nativeArtworkBounds['music-2-120'].x>1054,'The adjacent gate foliage is excluded');
});
