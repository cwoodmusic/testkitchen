import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {LEGACY_FURNITURE_ASSETS} from './legacy-furniture-definitions.mjs';
import {collectionImageRect,collectionMotion} from './apartment-collection-art.mjs';

const directions=['south','north','east','west'];
const digest=/^[a-f0-9]{64}$/;
const json=url=>JSON.parse(readFileSync(url,'utf8'));
function lossless(file,root){
 const bytes=readFileSync(new URL(file,root));
 assert.equal(bytes.toString('ascii',0,4),'RIFF',file);
 assert.equal(bytes.toString('ascii',8,12),'WEBP',file);
 assert(bytes.includes(Buffer.from('VP8L')),file+' must preserve native sprite pixels');
}
function crop(frame,sheet,label){
 assert([frame.x,frame.y,frame.w,frame.h].every(Number.isFinite),label);
 assert(frame.x>=0&&frame.y>=0&&frame.w>0&&frame.h>0&&frame.x+frame.w<=sheet.width&&frame.y+frame.h<=sheet.height,label+' crop outside its sheet');
 if(frame.cell){const cell=frame.cell;assert(frame.x>=cell.x&&frame.y>=cell.y&&frame.x+frame.w<=cell.x+cell.w&&frame.y+frame.h<=cell.y+cell.h,label+' borrows a neighboring sprite');}
}
function overview(manifest,definitions,root){
 const sheet=manifest.overview;assert(sheet?.file,'All four views need a compact overview');
 assert(sheet.width>0&&sheet.height>0&&sheet.width*sheet.height<=4*1024*1024,'Overview exceeds its decoded pixel budget');
 lossless(sheet.file,root);
 const expected=new Set(definitions.flatMap(def=>directions.map(direction=>def.id+'|'+direction))),seen=new Set();
 for(const frame of sheet.cells){const key=frame.id+'|'+(frame.facing??frame.direction??'south');assert(expected.has(key),'Unknown overview sprite '+key);assert(!seen.has(key),'Duplicate overview sprite '+key);seen.add(key);crop(frame,sheet,key);}
 assert.deepEqual(seen,expected,'Overview must show every asset facing without requesting native atlases');
}
function nativeDirections(manifest,definitions,root){
 const byId=new Map(definitions.map(def=>[def.id,def])),expected=new Set(definitions.flatMap(def=>directions.slice(1).map(direction=>def.id+'|'+direction))),seen=new Set();
 for(const collection of manifest.collections)for(const direction of directions.slice(1)){
  const sheet=collection.views?.[direction];assert(sheet?.file,'Missing '+collection.owner+'/'+direction);assert.match(sheet.sourceDigest,digest);lossless(sheet.file,root);
  for(const frame of sheet.cells){
   const id=frame.id??'collection-'+collection.owner+'-'+frame.slot,key=id+'|'+direction,def=byId.get(id);
   assert(def,'Unknown direction asset '+key);assert(expected.has(key));assert(!seen.has(key),'Duplicate direction asset '+key);seen.add(key);crop(frame,sheet,key);assert.match(frame.digest,digest,key+' RGBA digest');
   assert(Number.isFinite(frame.viewWidth)&&frame.viewWidth>0&&Number.isFinite(frame.viewHeight)&&frame.viewHeight>0,key+' native dimensions');
   assert(Array.isArray(frame.footCenter)&&frame.footCenter.length===2&&frame.footCenter.every(Number.isFinite),key+' physical anchor');
   const view={w:frame.viewWidth,h:frame.viewHeight},rect=collectionImageRect(view,frame);
   assert(Math.abs(rect.w/rect.h-frame.w/frame.h)<1e-9,key+' must not stretch upright art');
   const motion=collectionMotion(view,frame);
   if(motion){
    assert(motion.review,key+' motion mask needs visual review');
    assert(motion.mask.length>=3&&motion.mask.every(point=>point.length===2&&point.every(value=>Number.isFinite(value)&&value>=0&&value<=1)),key+' invalid animation mask');
   }
  }
 }
 assert.deepEqual(seen,expected,'Every old and new furniture ID needs three separately authored upright views');
}

test('all992 unique collection assets have complete native N/E/W art and four-view overview coverage',()=>{
 const root=new URL('../assets/apartment-collections/',import.meta.url),manifest=json(new URL('directions-manifest.json',root));
 assert.equal(manifest.collections.length,31);nativeDirections(manifest,APARTMENT_COLLECTION_ASSETS,root);overview(manifest,APARTMENT_COLLECTION_ASSETS,root);
});

test('all293 existing furniture IDs retain matching authored cardinal art, including the two declared aliases',()=>{
 const root=new URL('../assets/furniture-facings/',import.meta.url),manifest=json(new URL('manifest.json',root));
 assert.equal(LEGACY_FURNITURE_ASSETS.length,293);assert.equal(LEGACY_FURNITURE_ASSETS.filter(def=>def.aliasOf).length,2);
 nativeDirections(manifest,LEGACY_FURNITURE_ASSETS,root);overview(manifest,LEGACY_FURNITURE_ASSETS,root);
});
