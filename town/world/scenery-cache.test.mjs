import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneryCache,sceneryScale} from './scenery-cache.mjs';
const fixture=options=>{const draws=[];return {draws,cache:createSceneryCache({...options,createCanvas:(width,height)=>({width,height,getContext:()=>({drawImage:(...args)=>draws.push(args)})})})};};
test('scenery levels use backing-pixel scale and retain the native close view',()=>{
 const {cache,draws}=fixture(),source={width:4096,height:2560};
 assert.equal(sceneryScale({a:.2,b:0,c:0,d:.2}),.2);
 assert.equal(cache.image(source,.6),source);
 const small=cache.image(source,.2);assert.equal(small.width,1024);assert.equal(small.height,640);
 assert.equal(cache.image(source,.24),small);assert.equal(draws.length,1);
 assert.equal(cache.image(source,.1).width,512);assert.equal(cache.stats.entries,2);
});
test('paint revisions and resized sources invalidate every cached level',async()=>{
 const {cache}=fixture(),source={width:4096,height:2560},first=cache.image(source,.2,1);cache.image(source,.1,1);
 const edited=cache.image(source,.2,2);assert.notEqual(edited,first);await Promise.resolve();assert.equal(first.width,0);assert.equal(cache.stats.entries,1);
 source.height=2048;const resized=cache.image(source,.2,2);assert.notEqual(resized,edited);await Promise.resolve();assert.equal(edited.width,0);
 cache.forget(source);await Promise.resolve();assert.equal(resized.width,0);assert.equal(cache.stats.pixels,0);
});
test('zoom and scene changes release old backing stores within a fixed memory budget',async()=>{
 const {cache}=fixture({maxPixels:1000000,maxEntries:2}),source={width:4096,height:2560};
 const a=cache.image(source,.2),b=cache.image(source,.1);cache.image({width:4096,height:2560},.2);
 assert(a.width>0,'An evicted image remains valid through the current depth-sorted frame');await Promise.resolve();assert.equal(a.width,0);assert.equal(b.width,512);assert(cache.stats.entries<=2);assert(cache.stats.pixels<=1000000);
 assert.equal(cache.image(source,1),source);assert.equal(cache.image(source,NaN),source);
});
