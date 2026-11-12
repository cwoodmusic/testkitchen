import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewSpriteSize,createOverviewSpriteCache,overviewObjectImage} from './overview-sprites.mjs';

function factory(){
 const calls=[];
 return {calls,createCanvas(width,height){
  const context={drawImage(source,...dimensions){calls.push({source,dimensions});}};
  return {width,height,getContext(){return context;}};
 }};
}

test('overview levels retain oversampling and leave close or small artwork native',()=>{
 assert.equal(overviewSpriteSize(3014,4521,.126),null);
 assert.equal(overviewSpriteSize(512,400,.04),null);
 assert.equal(overviewSpriteSize(1200,800,0),null);
 assert.equal(overviewSpriteSize(1200,800,NaN),null);
 for(const scale of [.0175,.04,.06,.125]){
  const size=overviewSpriteSize(3014,4521,scale);
  assert.ok(size.width>=3014*scale&&size.height>=4521*scale);
  assert.ok(Math.max(size.width,size.height)<=1024);
  assert.ok(Math.abs(size.width/size.height-3014/4521)<.005);
 }
});

test('unchanged sprite images reuse their level while a replacement source rebuilds it',()=>{
 const f=factory(),cache=createOverviewSpriteCache(f),source={width:1800,height:1200};
 const first=cache.image(source,.04);
 assert.equal(cache.image(source,.04),first);
 assert.equal(f.calls.length,1);
 assert.notEqual(cache.image({...source},.04),first);
 assert.equal(f.calls.length,2);
 assert.equal(cache.image(source,.8),source);
 assert.equal(f.calls.length,2);
 source.width=1700;
 assert.notEqual(cache.image(source,.04),first);
 assert.equal(f.calls.length,3);
});

test('the global pixel and entry budgets evict old overview images',()=>{
 const f=factory(),cache=createOverviewSpriteCache({...f,maxPixels:50000,maxEntries:2});
 const images=Array.from({length:3},()=>({width:1800,height:1200}));
 const first=cache.image(images[0],.04);
 cache.image(images[1],.04);cache.image(images[2],.04);
 assert.ok(cache.size<=2&&cache.pixels<=50000);
 assert.notEqual(cache.image(images[0],.04),first);
 assert.ok(cache.size<=2&&cache.pixels<=50000);
 const entryCache=createOverviewSpriteCache({...f,maxPixels:4*1024*1024,maxEntries:2});
 for(const source of images)entryCache.image(source,.04);
 assert.equal(entryCache.size,2);
});

test('resizing the same canvas invalidates its previous levels and cached aspect',()=>{
 const f=factory(),cache=createOverviewSpriteCache(f),source={width:1800,height:1200};
 const first=cache.image(source,.04);
 cache.image(source,.1);assert.equal(cache.size,2);
 source.width=1700;
 const resized=cache.image(source,.04);
 assert.notEqual(resized,first);
 assert.notEqual(resized.height,first.height);
 assert.equal(cache.size,1);
 assert.equal(cache.image(source,.04),resized);
});

test('one source retains only its recent zoom levels',()=>{
 const f=factory(),cache=createOverviewSpriteCache({...f,maxLevels:2}),source={width:4096,height:4096};
 const first=cache.image(source,.01);
 cache.image(source,.03);cache.image(source,.06);
 assert.equal(cache.size,2);
 assert.notEqual(cache.image(source,.01),first);
 assert.equal(cache.size,2);
});

test('close views of terrain-dependent lawn scenes and ordinary artwork retain original pixels',()=>{
 const source={width:2400,height:1600};
 const c={getTransform(){return {a:.4,b:0,c:0,d:.4};}};
 assert.equal(overviewObjectImage(c,{id:'music-square'},source),source);
 assert.equal(overviewObjectImage(c,{id:'estate-bach'},source),source);
 const close={getTransform(){return {a:.5,b:0,c:0,d:.5};}};
 assert.equal(overviewObjectImage(close,{id:'coda-arcade'},source),source);
});
