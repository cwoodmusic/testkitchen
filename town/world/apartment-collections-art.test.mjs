import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {APARTMENT_COLLECTIONS,APARTMENT_COLLECTION_ASSETS,APARTMENT_COLLECTION_SLOTS,getApartmentAsset} from './apartment-collection-definitions.mjs';
import {collectionImageRect,collectionMotion} from './apartment-collection-art.mjs';
import {furnitureFootCenter} from './furniture-facing.mjs';

const root=new URL('../assets/apartment-collections/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));

test('all31 apartment owners have32 individually authored furnishings with globally unique slots and IDs',()=>{
 assert.equal(APARTMENT_COLLECTIONS.length,31);assert.equal(APARTMENT_COLLECTION_SLOTS.length,32);assert.equal(APARTMENT_COLLECTION_ASSETS.length,992);
 assert.equal(new Set(APARTMENT_COLLECTION_ASSETS.map(a=>a.id)).size,992);
 for(const c of APARTMENT_COLLECTIONS){
  assert.equal(c.assets.length,32);assert.equal(new Set(c.assets.map(a=>a.slot)).size,32);
  for(const a of c.assets){
   assert.strictEqual(getApartmentAsset(c.owner,a.slot),a);assert.equal(a.collectionOwner,c.owner);assert.equal(a.apartmentCollection,c.owner);
   for(const b of a.boxes)assert(b.x>=0&&b.y>=0&&b.w>0&&b.h>0&&b.x+b.w<=a.w&&b.y+b.h<=a.h,a.id+' footprint');
   if(a.wallMounted||a.layer==='ground'){assert.equal(a.solid,false);assert.equal(a.boxes.length,0);}
  }
 }
 assert.throws(()=>getApartmentAsset('bach','missing'));
});

test('native runtime art contains992 distinct RGBA crops in31 lossless atlases without individual sprite files',()=>{
 assert.equal(manifest.collections.length,31);assert.equal(manifest.assetCount,992);
 const digests=new Set(),frames=new Set();
 for(const c of manifest.collections){
  assert(APARTMENT_COLLECTIONS.some(owner=>owner.owner===c.owner));assert.equal(c.cells.length,32);assert.match(c.sourceDigest,/^[a-f0-9]{64}$/);
  assert(c.width*c.height<=7*1024*1024,c.owner+' native sheet exceeds its decoded pixel budget');
  for(const file of [c.file,c.thumbnail]){
   const bytes=readFileSync(new URL(file,root));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert(bytes.includes(Buffer.from('VP8L')),'Runtime art must use lossless WebP');
  }
  for(const frame of c.cells){
   const a=getApartmentAsset(c.owner,frame.slot);assert(frame.w>=24&&frame.h>=24);assert(frame.x>=0&&frame.y>=0&&frame.x+frame.w<=c.width&&frame.y+frame.h<=c.height);
   assert(frame.x>=frame.cell.x&&frame.y>=frame.cell.y&&frame.x+frame.w<=frame.cell.x+frame.cell.w&&frame.y+frame.h<=frame.cell.y+frame.cell.h,'Crops cannot borrow another object cell');
   assert.match(frame.digest,/^[a-f0-9]{64}$/);digests.add(frame.digest);frames.add(c.file+':'+frame.x+':'+frame.y+':'+frame.w+':'+frame.h);
   const visual={w:frame.viewWidth??a.w,h:frame.viewHeight??a.h},r=collectionImageRect(visual,frame);assert(Math.abs(r.w/r.h-frame.w/frame.h)<1e-9);assert(r.x>=0&&r.y>=0&&r.x+r.w<=visual.w+1e-9&&Math.abs(r.y+r.h-visual.h)<1e-9);
   if(visual.w!==a.w||visual.h!==a.h)assert(Array.isArray(frame.footCenter)&&frame.footCenter.length===2&&frame.footCenter.every(Number.isFinite),'Expanded artwork needs its own floor anchor');
  }
 }
 assert.equal(digests.size,992,'Distinct names must also have different actual native RGBA artwork');assert.equal(frames.size,992,'No two assets may point at a shared source crop');
 const bytes=manifest.collections.reduce((sum,c)=>sum+statSync(new URL(c.file,root)).size+statSync(new URL(c.thumbnail,root)).size,0);// The corrected native artwork is retained losslessly (84.5 MiB across all31
 // South sheets/thumbnails), loaded by viewed owner rather than at startup.
 assert(bytes<90*1024*1024,'Lossless South art and thumbnails exceed the encoded release budget');
});

test('every collection has reviewed lava glass and arcade screen masks inside its contained native artwork',()=>{
 let count=0;
 for(const c of manifest.collections)for(const frame of c.cells){
  if(!frame.motion)continue;count++;
  assert(['lava','arcade'].includes(frame.motion.kind));assert(frame.motion.review);
  const a=getApartmentAsset(c.owner,frame.slot),motion=collectionMotion(a,frame),r=collectionImageRect(a,frame);assert.equal(motion.seed,APARTMENT_COLLECTIONS.find(owner=>owner.owner===c.owner).index+1);
  for(const[u,v]of motion.mask){assert(u>=0&&u<=1&&v>=0&&v<=1);assert(u*a.w>=r.x&&u*a.w<=r.x+r.w&&v*a.h>=r.y&&v*a.h<=r.y+r.h);}
  for(const color of motion.palette)assert.match(color,/^#[a-f0-9]{6}$/i);
  assert(motion.bounds[2]>0&&motion.bounds[3]>0);
 }
 assert.equal(count,62);
});

test('all31 South arc lamps carry authored base anchors while retaining their physical vertical centre',()=>{
 for(const collection of manifest.collections){
  const frame=collection.cells.find(cell=>cell.slot==='floor-lamp'),asset=getApartmentAsset(collection.owner,'floor-lamp'),rect=collectionImageRect(asset,frame);
  assert(frame.footCenterReview,collection.owner+' lamp anchor review');
  assert(frame.footCenter?.length===2&&frame.footCenter.every(value=>Number.isFinite(value)&&value>=0&&value<=1),collection.owner+' source base point');
  assert(Math.abs(rect.y+frame.footCenter[1]*rect.h-furnitureFootCenter(asset).y)<.00001,collection.owner+' vertical footprint must remain unchanged');
 }
});
