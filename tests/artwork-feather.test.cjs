'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const art=require('../artwork-editor.js');

function sourcePixels(width,height,pixel){
 const result=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)result.set(pixel(x,y),(y*width+x)*4);
 return result;
}
function pixel(rgba,width,x,y){return Array.from(rgba.slice((y*width+x)*4,(y*width+x)*4+4));}
function render(source,width,height,path,options={}){
 const stroke=art.createFeatheringStroke(source,width,height,options),output=source.slice();assert.ok(stroke);
 let changes=0;
 for(let index=0;index<path.length;index++){
  const result=stroke.applySegment(path[index?index-1:0],path[index]);changes+=result.changes.length;
  for(const [at,value]of result.changes){
   assert.ok(Number.isInteger(at)&&at>=0&&at<width*height,'Changes stay inside the source image');
   output.set([value&255,value>>>8&255,value>>>16&255,value>>>24&255],at*4);
  }
 }
 return {stroke,output,changes};
}
const blue=[60,140,220,255];

test('feathering softens both sides of a cut edge without fading opaque interiors',()=>{
 const width=48,height=32,source=sourcePixels(width,height,x=>x<24?blue:[0,0,0,0]);
 const {output,changes}=render(source,width,height,[[24,16]],{radius:10,strength:1});assert.ok(changes>0);
 for(const x of [23,24])assert.ok(pixel(output,width,x,16)[3]>0&&pixel(output,width,x,16)[3]<255,'Both sides acquire partial alpha');
 assert.deepEqual(pixel(output,width,12,16),blue,'The solid interior is not an opacity eraser');
 assert.deepEqual(pixel(output,width,37,16),[0,0,0,0],'Distant transparent space remains clear');
 assert.ok(Array.from({length:12},(_,i)=>pixel(output,width,18+i,16)[3]).filter(alpha=>alpha>0&&alpha<255).length>=4,'The edge has a gradual alpha transition');
 const opaque=sourcePixels(width,height,()=>blue);
 assert.equal(render(opaque,width,height,[[24,16]],{radius:10,strength:1}).changes,0,'A local stroke on uniform opaque artwork is a no-op');
});

test('new translucent edge colours ignore RGB hidden under zero alpha',()=>{
 const width=40,height=24;
 const clean=sourcePixels(width,height,x=>x<20?blue:[0,0,0,0]);
 const hidden=sourcePixels(width,height,x=>x<20?blue:[255,0,255,0]);
 const a=render(clean,width,height,[[20,12]],{radius:8,strength:1});
 const b=render(hidden,width,height,[[20,12]],{radius:8,strength:1});
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const value=pixel(b.output,width,x,y);
  if(value[3]){
   assert.deepEqual(value,pixel(a.output,width,x,y),'Hidden magenta cannot create coloured or dark fringes');
   for(let channel=0;channel<3;channel++)assert.ok(Math.abs(value[channel]-blue[channel])<=1,'Partial pixels retain the visible source colour');
  }
 }
 assert.ok(pixel(b.output,width,20,12)[3]>0);
});

test('feathering leaves the input immutable and repeated coordinates do not accumulate opacity changes',()=>{
 const width=40,height=24,source=sourcePixels(width,height,x=>x<20?blue:[0,0,0,0]),before=source.slice();
 const result=render(source,width,height,[[20,12]],{radius:8,strength:.7});
 assert.deepEqual(source,before,'A cancelled preview can discard changes without repairing source data');
 assert.equal(result.stroke.applySegment([20,12],[20,12]).changes.length,0,'Pointerup at the same position cannot feather twice');
 const expected=render(before,width,height,[[20,12],[20,16]],{radius:8,strength:.7}).output;
 source.fill(0);
 for(const [at,value]of result.stroke.applySegment([20,12],[20,16]).changes)result.output.set([value&255,value>>>8&255,value>>>16&255,value>>>24&255],at*4);
 assert.deepEqual(result.output,expected,'Later stroke segments keep using the frozen starting composite');
});

test('feathering is independent of straight-line event spacing and direction',()=>{
 const width=48,height=32,source=sourcePixels(width,height,x=>x<24?blue:[0,0,0,0]),options={radius:7,strength:.65};
 const direct=render(source,width,height,[[24,8],[24,24]],options).output;
 const segmented=render(source,width,height,[[24,8],[24,11],[24,11],[24,17],[24,24],[24,24]],options).output;
 const reversed=render(source,width,height,[[24,24],[24,8]],options).output;
 assert.deepEqual(direct,segmented);assert.deepEqual(direct,reversed);
});

test('rectangle and manual selections restrict feathering to their exact pixels',()=>{
 const width=40,height=32,source=sourcePixels(width,height,x=>x<20?blue:[0,0,0,0]);
 for(const selection of [{x:14,y:8,width:13,height:17},{x:14,y:8,width:13,height:17,points:[[14,8],[26,8],[14,24]]}]){
  const {output,changes}=render(source,width,height,[[20,12]],{radius:12,strength:1,selection});assert.ok(changes>0);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const inside=x>=14&&x<=26&&y>=8&&y<=24&&(!selection.points||(x-14)*16+(y-8)*12<=12*16);
   if(!inside)assert.deepEqual(pixel(output,width,x,y),pixel(source,width,x,y),'Unselected pixels must not be edited');
  }
 }
 const isolated={x:5,y:5,width:8,height:12};
 const opaqueSelection=sourcePixels(width,height,(x,y)=>x>=5&&x<13&&y>=5&&y<17?blue:[255,0,255,255]);
 assert.equal(render(opaqueSelection,width,height,[[9,10]],{radius:10,strength:1,selection:isolated}).changes,0,'Selection borders must not introduce foreign colour or false transparent edges');
});

test('painted protection excludes both edits and protected colours from feathering',()=>{
 const width=40,height=24,source=sourcePixels(width,height,x=>x<20?blue:[255,0,255,255]),protectedMask=new Uint8Array(width*height);
 for(let y=0;y<height;y++)for(let x=20;x<width;x++)protectedMask[y*width+x]=1;
 const {output,changes}=render(source,width,height,[[19,12]],{radius:8,strength:1,protectedMask});
 assert.equal(changes,0,'Protected magenta cannot contaminate the unprotected solid edge');assert.deepEqual(output,source);
 const edge=sourcePixels(width,height,x=>x<20?blue:[0,0,0,0]);
 protectedMask.fill(0);for(let y=10;y<=14;y++)for(let x=18;x<=21;x++)protectedMask[y*width+x]=1;
 const feathered=render(edge,width,height,[[20,12]],{radius:8,strength:1,protectedMask});assert.ok(feathered.changes>0);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(protectedMask[y*width+x])assert.deepEqual(pixel(feathered.output,width,x,y),pixel(edge,width,x,y));
});

test('feathering validates limits and keeps a local dab bounded on a full arcade background',()=>{
 const width=1672,height=941,source=sourcePixels(width,height,x=>x<836?blue:[0,0,0,0]);
 for(const radius of [0,65,-1,NaN,1.5])assert.equal(art.createFeatheringStroke(source,width,height,{radius}),null);
 for(const strength of [-.1,1.1,NaN,Infinity])assert.equal(art.createFeatheringStroke(source,width,height,{strength}),null);
 for(const args of [[new Uint8ClampedArray(3),1,1,{}],[source,0,height,{}],[source,width,height,{protectedMask:new Uint8Array(2)}],[source,width,height,{selection:{x:-1,y:0,width:2,height:2}}]])assert.equal(art.createFeatheringStroke(...args),null);
 assert.equal(render(source,width,height,[[836,470]],{radius:8,strength:0}).changes,0);
 const result=render(source,width,height,[[836,470]],{radius:8,strength:.5});assert.ok(result.changes>0);
 const stats=result.stroke.getStats();assert.ok(stats.sampled<10000&&stats.visited<4096,'A local brush must not convolve the whole world');
 assert.ok(render(source,width,height,[[836,470]],{radius:64,strength:1}).changes>0);
});

test('cropped opaque asset borders feather inward against transparent space beyond the canvas',()=>{
 const width=40,height=32,source=sourcePixels(width,height,()=>blue);
 const {output,changes}=render(source,width,height,[[0,16]],{radius:8,strength:1});assert.ok(changes>0);
 const edge=pixel(output,width,0,16);assert.ok(edge[3]>0&&edge[3]<255,'A hard canvas crop must soften even without an existing transparent pixel inside it');
 for(let channel=0;channel<3;channel++)assert.ok(Math.abs(edge[channel]-blue[channel])<=1,'Canvas-edge transparency cannot darken the asset colour');
 assert.deepEqual(pixel(output,width,12,16),blue);
});
