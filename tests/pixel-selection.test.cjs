'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const selection=require('../pixel-selection.js');
const pixels=new Uint8ClampedArray([
 1,2,3,255, 4,5,6,128, 7,8,9,0,
 10,11,12,255, 13,14,15,64, 16,17,18,0
]);

test('selection rectangles include both endpoints and clamp reversed or outside drags',()=>{
 assert.deepEqual(selection.rectangle([2,1],[0,0],3,2),{x:0,y:0,width:3,height:2});
 assert.deepEqual(selection.rectangle([-20,-3],[20,8],3,2),{x:0,y:0,width:3,height:2});
 assert.deepEqual(selection.rectangle([2,1],[2,1],3,2),{x:2,y:1,width:1,height:1});
 assert.deepEqual(selection.rectangle([-8,-8],[-2,-2],3,2),{x:0,y:0,width:1,height:1});
 for(const args of [[[0,0],[1,1],0,2],[[0,0],[1,1],8193,1],[[0,0],[1,1],8192,8192],[[0.5,0],[1,1],3,2],[[0,0],[Infinity,1],3,2],[[0,0,0],[1,1],3,2],[[0,0],[Number.MAX_SAFE_INTEGER+1,1],3,2]])assert.equal(selection.rectangle(...args),null);
});

test('copy clips a rectangle at the image edge and retains every RGBA byte independently',()=>{
 const source=new Uint8ClampedArray(pixels),before=Array.from(source);
 const clip=selection.copyPixels(source,3,2,{x:1,y:0,width:4,height:3});
 assert.deepEqual({width:clip.width,height:clip.height},{width:2,height:2});
 assert.deepEqual(Array.from(clip.pixels),[4,5,6,128,7,8,9,0,13,14,15,64,16,17,18,0]);
 source.fill(0);assert.equal(clip.pixels[0],4,'Later source edits cannot alter copied pixels');
 clip.pixels[0]=99;assert.deepEqual(before,Array.from(pixels),'Copy never changes the original source');
 const negative=selection.copyPixels(pixels,3,2,{x:-1,y:-1,width:3,height:2});
 assert.deepEqual(Array.from(negative.pixels),[1,2,3,255,4,5,6,128]);
 assert.equal(selection.copyPixels(pixels,3,2,{x:9,y:0,width:1,height:1}),null);
});

test('pasting clips each destination edge and preserves transparent coloured pixels',()=>{
 const clip=selection.copyPixels(pixels,3,2,{x:0,y:0,width:3,height:2});
 const before=Array.from(clip.pixels);
 assert.deepEqual(selection.stampPixels(clip,2,2,-1,0),[
  [0,0,'#04050680'],[1,0,'#07080900'],[0,1,'#0d0e0f40'],[1,1,'#10111200']
 ]);
 assert.deepEqual(selection.stampPixels(clip,2,2,1,1),[[1,1,'#010203ff']]);
 assert.deepEqual(selection.stampPixels(clip,2,2,0,-1),[[0,0,'#0a0b0cff'],[1,0,'#0d0e0f40']]);
 assert.deepEqual(selection.stampPixels(clip,2,2,-3,0),[]);
 assert.deepEqual(selection.stampPixels(clip,2,2,2,0),[]);
 assert.deepEqual(Array.from(clip.pixels),before);
});

test('stamp resizing repeats exact nearest pixels, including their transparent RGBA values',()=>{
 const clip={width:2,height:2,pixels:new Uint8ClampedArray([
  10,20,30,255, 40,50,60,0,
  70,80,90,128, 100,110,120,64
 ])},original=Array.from(clip.pixels),large=selection.resizeClip(clip,4,4);
 assert.deepEqual({width:large.width,height:large.height},{width:4,height:4});
 const sample=(value,x,y)=>Array.from(value.pixels.slice((y*value.width+x)*4,(y*value.width+x+1)*4));
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)assert.deepEqual(sample(large,x,y),sample(clip,Math.floor(x/2),Math.floor(y/2)));
 assert.deepEqual(Array.from(selection.resizeClip(large,2,2).pixels),original);
 assert.deepEqual(Array.from(selection.resizeClip(clip,1,1).pixels),[10,20,30,255]);
 assert.deepEqual(Array.from(clip.pixels),original,'Repeated sizing keeps the captured source unchanged');
 large.pixels.fill(0);assert.deepEqual(Array.from(clip.pixels),original,'Resized pixels cannot mutate the capture');
 const same=selection.resizeClip(clip,2,2);assert.notStrictEqual(same.pixels,clip.pixels);assert.deepEqual(Array.from(same.pixels),original);
});

test('stamp resizing supports uneven output dimensions and rejects malformed or excessive sizes',()=>{
 const clip={width:3,height:1,pixels:new Uint8ClampedArray([1,2,3,4, 5,6,7,8, 9,10,11,12])};
 assert.deepEqual(Array.from(selection.resizeClip(clip,2,1).pixels),[1,2,3,4,5,6,7,8]);
 assert.deepEqual(Array.from(selection.resizeClip(clip,5,1).pixels),[1,2,3,4,1,2,3,4,5,6,7,8,5,6,7,8,9,10,11,12]);
 for(const [width,height]of [[0,1],[-1,1],[1,0],[1.5,2],[NaN,1],[Infinity,1],[8193,1],[8192,8192],[Number.MAX_SAFE_INTEGER,1]])assert.equal(selection.resizeClip(clip,width,height),null);
 for(const bad of [null,{},[],{...clip,pixels:[]},{...clip,pixels:new Int8Array(12)}])assert.equal(selection.resizeClip(bad,2,2),null);
});

test('malformed or oversized clips are rejected before allocating copies or paste output',()=>{
 const good={width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,4])};
 for(const clip of [null,{},[],{...good,width:8193},{...good,width:8192,height:8192},{...good,pixels:new Uint8ClampedArray(3)},{...good,pixels:new Int8Array([1,2,3,4])},{...good,pixels:[1,2,3,256]},{...good,pixels:[1,2,-1,4]},{...good,pixels:new Array(4)},{...good,pixels:[1,2,3,NaN]}]){
  assert.deepEqual(selection.stampPixels(clip,2,2,0,0),[]);
  assert.equal(selection.clipboard.set(clip),false);
 }
 for(const rect of [null,{x:0,y:0,width:0,height:1},{x:0.5,y:0,width:1,height:1},{x:0,y:0,width:8193,height:1},{x:Number.MAX_SAFE_INTEGER,y:0,width:2,height:1}])assert.equal(selection.copyPixels(pixels,3,2,rect),null);
 assert.equal(selection.copyPixels(pixels,3,3,{x:0,y:0,width:1,height:1}),null);
 assert.deepEqual(selection.stampPixels(good,2,2,Number.MAX_SAFE_INTEGER,0),[]);
 assert.deepEqual(selection.stampPixels(good,2,2,0.5,0),[]);
});

test('the shared clipboard isolates caller mutations and retains its prior copy on invalid input',()=>{
 const {clipboard}=selection;clipboard.clear();assert.equal(clipboard.has(),false);assert.equal(clipboard.get(),null);
 const source={width:1,height:1,pixels:new Uint8ClampedArray([11,22,33,44])};
 assert.equal(clipboard.set(source),true);source.pixels.fill(99);
 const first=clipboard.get();assert.deepEqual(Array.from(first.pixels),[11,22,33,44]);first.pixels.fill(88);first.width=9;
 assert.deepEqual(clipboard.get(),{width:1,height:1,pixels:new Uint8ClampedArray([11,22,33,44])});
 assert.equal(clipboard.set({width:1,height:1,pixels:[]}),false);assert.equal(clipboard.has(),true);assert.equal(clipboard.get().pixels[0],11);
 clipboard.clear();assert.equal(clipboard.has(),false);assert.equal(clipboard.get(),null);
});

test('browser and CommonJS exports share the API and accept cross-realm RGBA bytes',()=>{
 const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../pixel-selection.js'),'utf8'),context);
 assert.equal(typeof context.window.CodaPixelSelection.rectangle,'function');
 assert.equal(typeof context.window.CodaPixelSelection.resizeClip,'function');
 assert.equal(context.window.CodaPixelSelection.clipboard.set({width:1,height:1,pixels:new Uint8ClampedArray([5,6,7,8])}),true);
 const clip=context.window.CodaPixelSelection.clipboard.get();
 assert.deepEqual(selection.stampPixels(clip,1,1,0,0),[[0,0,'#05060708']]);
});
