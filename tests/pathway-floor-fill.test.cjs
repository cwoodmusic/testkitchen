'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../pathway-floor-fill.js');
const shape=()=>({version:1,width:8,height:4,sampleOffset:[3,1],transparentPixels:4,transparentRuns:[[0,0,2],[1,1,3]]});
function drawing(){const canvases=[];return {canvases,document:{createElement(){const calls=[],canvas={width:0,height:0,calls,getContext(){return {drawImage(...args){calls.push(args);}};}};canvases.push(canvas);return canvas;}}};}

test('only reviewed erase strips receive sampled glass and the native source stays unchanged',()=>{
 const manifest=shape(),before=JSON.stringify(manifest),source={width:8,height:4},fake=drawing(),underlay=create({manifest,document:fake.document}),calls=[];
 const ctx={drawImage(...args){calls.push(args);}};
 assert.equal(underlay.draw(ctx,source),true);assert.equal(underlay.draw(ctx,source),true);
 assert.equal(fake.canvases.length,1,'One source image gets one cached transparent underlay');
 assert.deepEqual(fake.canvases[0].calls,[[source,3,1,2,1,0,0,2,1],[source,4,2,2,1,1,1,2,1]]);
 assert.equal(calls.length,2);assert.equal(calls[0][0],calls[1][0]);assert.deepEqual(calls[0].slice(1),[0,0]);
 assert.deepEqual(underlay.getState(),{ready:true,error:null,runCount:2,pixels:4,builds:1});
 assert.equal(JSON.stringify(manifest),before);assert.deepEqual(source,{width:8,height:4});
});

test('overlapping, malformed or out-of-bounds shapes never draw over user artwork',()=>{
 for(const manifest of [{...shape(),version:2},{...shape(),sampleOffset:[7,1]},
  {...shape(),transparentRuns:[[0,0,2],[0,1,3]]},{...shape(),transparentPixels:99},
  {...shape(),transparentRuns:[[4,0,1]]},{...shape(),transparentRuns:[[0,0,0]]}]){
  const fake=drawing(),underlay=create({manifest,document:fake.document});assert.ok(underlay.getState().error);
  assert.equal(underlay.draw({drawImage(){throw Error('An invalid shape must not draw');}},{width:8,height:4}),false);
  assert.equal(fake.canvases.length,0);
 }
});

test('readiness loads one shape and failed loading safely leaves rendering unchanged',async()=>{
 let finish,calls=0;const fake=drawing(),underlay=create({url:'/path.json?v=test',document:fake.document,fetch:(url,options)=>{
  calls++;assert.equal(url,'/path.json?v=test');assert.equal(options.cache,'no-cache');return new Promise(resolve=>finish=resolve);
 }}),source={width:8,height:4},ctx={drawImage(){}};
 assert.equal(underlay.draw(ctx,source),false);finish({ok:true,json:async()=>shape()});await underlay.ready;
 assert.equal(calls,1);assert.equal(underlay.draw(ctx,source),true);
 assert.equal(underlay.draw(ctx,{width:9,height:4}),false);
 assert.equal(underlay.draw(ctx,{complete:false,naturalWidth:0,naturalHeight:0}),false);
 const failed=create({document:fake.document,fetch:async()=>({ok:false,status:404})});await failed.ready;
 assert.match(failed.getState().error,/HTTP 404/);assert.equal(failed.draw(ctx,source),false);
});
