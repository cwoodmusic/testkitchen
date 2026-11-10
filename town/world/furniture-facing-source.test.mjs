import test from 'node:test';
import assert from 'node:assert/strict';
import {createFurnitureFacingSourceRoster,drawFurnitureFacingSource,furnitureFacingDrawSource,FURNITURE_NATIVE_PIXELS,flatFurnitureFacingPlacement,flatFurnitureFacingLocalPlacement} from './furniture-facing-source.mjs';
import {spriteBounds} from './render-visibility.mjs';

function fixture(count,{w=100,h=120}={}){
 const atlas={name:'all-facing-overview'},native=new Map(),entries=[];
 let pixels=0,compiles=0,requests=0,reads=0,overviewDraws=0;
 for(let i=0;i<count;i++){
  const direction=['south','west','north','east'][i%4],id=`furniture-${i}|${direction}`,view={id,w,h,footCenter:{x:w/2,y:h-10}};
  Object.defineProperty(view,'canvas',{get(){reads++;throw Error('The roster must not read native view getters');}});
  const asset={id:`furniture-${i}`,getFacingDrawSource(dir,{native:wantNative}){
   assert.equal(dir,direction);
   if(!wantNative){overviewDraws++;return {image:atlas,sx:i%32*32,sy:Math.floor(i/32)*32,sw:32,sh:32,dx:0,dy:0,dw:w,dh:h,native:false};}
   let image=native.get(id);if(!image){compiles++;requests++;image={name:id};native.set(id,image);pixels+=w*h;
    while(native.size>192||pixels>FURNITURE_NATIVE_PIXELS){native.delete(native.keys().next().value);pixels-=w*h;}
   }else{native.delete(id);native.set(id,image);}
   return {image,sx:0,sy:0,sw:w,sh:h,dx:0,dy:0,dw:w,dh:h,native:true};
  }};
  Object.defineProperty(asset,'canvas',{get(){reads++;throw Error('No South canvas fallback is allowed');}});
  entries.push(Object.freeze({asset,placement:Object.freeze({x:(i%25)*120,y:Math.floor(i/25)*140,w,h,scaleX:1,scaleY:1,direction,view:Object.freeze(view)})}));
 }
 return {entries,get stats(){return {compiles,requests,reads,overviewDraws,views:native.size,pixels};}};
}
const frame=(roster,entries,options)=>{roster.update(entries,options);for(const e of entries)roster.source(e.asset,e.placement);};

test('500 distinct overview views settle without any native image reads, compiles or full requests',()=>{
 const f=fixture(500),roster=createFurnitureFacingSourceRoster(),before=JSON.stringify(f.entries);
 for(let n=0;n<20;n++)frame(roster,f.entries,{pixelScale:.1,focus:{x:1200,y:900}});
 assert.deepEqual(f.stats,{compiles:0,requests:0,reads:0,overviewDraws:10000,views:0,pixels:0});
 assert.equal(roster.stats.nativeViews,0);assert.equal(roster.stats.reused,20);assert.equal(JSON.stringify(f.entries),before);
});

test('500 close views admit a fixed 192-view working set and never evict/recompile it on settled frames',()=>{
 const f=fixture(500),roster=createFurnitureFacingSourceRoster();
 frame(roster,f.entries,{pixelScale:.6,focus:{x:1200,y:900}});const warm={...f.stats},initial=roster.update(f.entries,{pixelScale:.6,focus:{x:1200,y:900}});
 assert.equal(warm.compiles,192);assert.equal(roster.stats.nativeViews,192);assert(roster.stats.nativePixels<=FURNITURE_NATIVE_PIXELS);
 const reordered=f.entries.slice().reverse();
 for(let n=0;n<25;n++)frame(roster,n%2?f.entries:reordered,{pixelScale:.6,focus:{x:1200,y:900}});
 assert.equal(f.stats.compiles,warm.compiles);assert.equal(f.stats.requests,warm.requests);assert.equal(f.stats.reads,0);assert.equal(roster.stats.changes,1);
 assert.deepEqual([...roster.update(reordered,{pixelScale:.6,focus:{x:1200,y:900}})].sort(),[...initial].sort());
});

test('the pixel budget also limits admission when 192 large sprites would exceed four million pixels',()=>{
 const f=fixture(500,{w:256,h:256}),roster=createFurnitureFacingSourceRoster();
 for(let n=0;n<5;n++)frame(roster,f.entries,{pixelScale:1,focus:{x:1200,y:900}});
 assert.equal(roster.stats.nativeViews,64);assert.equal(roster.stats.nativePixels,FURNITURE_NATIVE_PIXELS);assert.equal(f.stats.compiles,64);assert.equal(f.stats.requests,64);
});

test('selection and focused placement win admission, while tiny unselected views always use the overview',()=>{
 const f=fixture(4),roster=createFurnitureFacingSourceRoster({maxViews:2});
 const entries=f.entries.map((e,i)=>({...e,placement:{...e.placement,w:i<2?8:200,h:i<2?8:240},selected:i===0,focused:i===1}));
 roster.update(entries,{pixelScale:1});
 assert(roster.isNative(entries[0].asset,entries[0].placement));assert(roster.isNative(entries[1].asset,entries[1].placement));assert(!roster.isNative(entries[2].asset,entries[2].placement));
 const tiny=fixture(3,{w:32,h:32}),r=createFurnitureFacingSourceRoster();frame(r,tiny.entries,{pixelScale:1});assert.equal(r.stats.nativeViews,0);
});

test('repeated placements share one native view key, with largest projected size and nearest occurrence determining priority',()=>{
 const f=fixture(3),a=f.entries[0],roster=createFurnitureFacingSourceRoster({maxViews:1});
 const repeated=[{...a,placement:{...a.placement,w:200,h:240}},{...a,placement:{...a.placement,x:10000,w:400,h:480}},...f.entries.slice(1)];
 roster.update(repeated,{pixelScale:1,focus:{x:0,y:0}});assert.equal(roster.stats.candidates,3);assert.equal(roster.stats.nativeViews,1);assert(roster.isNative(a.asset,a.placement));
 const impossible=fixture(1,{w:3000,h:3000}),empty=createFurnitureFacingSourceRoster();frame(empty,[{...impossible.entries[0],selected:true}],{pixelScale:1});assert.equal(empty.stats.nativeViews,0);assert.equal(impossible.stats.compiles,0);
});

test('direct overview crops preserve view contain offsets, physical anchor and scale without an intermediate canvas',()=>{
 const calls=[],ctx={drawImage(...args){calls.push(args);}},atlas={name:'overview-atlas'},placement={x:100,y:200,w:200,h:300,view:{w:100,h:150},scaleX:2,scaleY:2};
 const source={image:atlas,sx:128,sy:64,sw:16,sh:24,dx:10,dy:20,dw:80,dh:100,native:false};
 assert.equal(drawFurnitureFacingSource(ctx,placement,source),true);assert.deepEqual(calls,[[atlas,128,64,16,24,120,240,160,200]]);
 assert.equal(drawFurnitureFacingSource(ctx,placement,{...source,image:null}),false);assert.equal(calls.length,1);
 assert.equal(drawFurnitureFacingSource(ctx,placement,{...source,sw:0}),false);assert.equal(calls.length,1);
});

test('a missing or pending overview never falls back to the native view or South canvas',()=>{
 const f=fixture(1),e=f.entries[0];assert.equal(furnitureFacingDrawSource(e.asset,e.placement,{native:false}).native,false);assert.equal(f.stats.reads,0);
 const a={getFacingDrawSource(){return null;},get canvas(){throw Error('Must not touch the native canvas');}};
 assert.equal(furnitureFacingDrawSource(a,e.placement,{native:false}),null);assert.equal(furnitureFacingDrawSource({},e.placement),null);
 const roster=createFurnitureFacingSourceRoster({maxViews:0});frame(roster,f.entries,{pixelScale:10});assert.equal(f.stats.compiles,0);
});

test('metadata can mark an overview-only legacy view without touching an unavailable native source',()=>{
 const f=fixture(3),entries=f.entries.map((e,i)=>({...e,selected:true,asset:{...e.asset,canRenderNative:i===0?false:i===1?()=>false:true},placement:{...e.placement,view:{...e.placement.view,canRenderNative:i===2?false:true}}})),roster=createFurnitureFacingSourceRoster();
 frame(roster,entries,{pixelScale:10});assert.equal(roster.stats.nativeViews,0);assert.equal(f.stats.compiles,0);
});

test('flat wall art and rugs share the same native roster without reading South canvas getters',()=>{
 const f=fixture(500),entries=f.entries.map((e,i)=>{
  const asset={...e.asset,w:100,h:120,wallMounted:i%2===0,layer:i%2?'ground':'objects',getFacingView(direction,{image}){assert.equal(direction,'south');assert.equal(image,false);return {...e.placement.view,id:e.placement.view.id,direction:'south'};},getFacingDrawSource(direction,options){assert.equal(direction,'south');return e.asset.getFacingDrawSource(e.placement.direction,options);}};
  Object.defineProperty(asset,'canvas',{get(){throw Error('A flat overview may not compile a South canvas');}});
  const o={x:e.placement.x,y:e.placement.y,rotation:i%4*90,scale:1},pose={x:o.x,y:o.y,offset:1},placement=flatFurnitureFacingPlacement(asset,spriteBounds(asset,o,pose));
  assert(placement);return {asset,placement};
 }),roster=createFurnitureFacingSourceRoster();
 for(let n=0;n<12;n++)frame(roster,entries,{pixelScale:.1});assert.equal(f.stats.compiles,0);assert.equal(f.stats.requests,0);
 for(let n=0;n<12;n++)frame(roster,entries,{pixelScale:1});assert.equal(f.stats.compiles,192);assert.equal(f.stats.requests,192);assert.equal(roster.stats.nativeViews,192);
});

test('flat South atlas crops occupy the exact old local quad before its existing scale and rotation',()=>{
 const asset={id:'flat-rug',w:180,h:112,layer:'ground',getFacingView(){return {id:'flat-rug',w:180,h:112};},getFacingDrawSource(){}};
 for(const offset of [1,.5]){
  const pose={x:300,y:400,offset},placement=flatFurnitureFacingPlacement(asset,{x:0,y:0,w:180,h:112}),local=flatFurnitureFacingLocalPlacement(asset,pose,placement),image={};
  const calls=[];drawFurnitureFacingSource({drawImage(...args){calls.push(args);}},local,{image,sx:32,sy:64,sw:32,sh:20,dx:0,dy:0,dw:180,dh:112});
  assert.deepEqual(calls,[[image,32,64,32,20,-asset.w/2,-asset.h*offset,asset.w,asset.h]]);
 }
});
