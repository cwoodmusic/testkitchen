import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainChunkCache,terrainChunkScale,visibleTerrainChunks} from './terrain-chunks.mjs';

const blank=()=>({cells:{},objects:[],edges:{}});
function canvas(width=320,height=240){
 const value={width,height},calls=[],stack=[];
 const c={canvas:value,calls,globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:false,
  transform:{a:.5,b:0,c:0,d:.5,e:0,f:0},
  getTransform(){return {...this.transform};},setTransform(a,b,c,d,e,f){this.transform=typeof a==='object'?{...a}:{a,b,c,d,e,f};calls.push(['transform',this.transform]);},
  save(){stack.push({transform:{...this.transform},globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation});},restore(){Object.assign(this,stack.pop());},
  beginPath(){},rect(...r){calls.push(['rect',...r]);},clip(){calls.push(['clip']);},clearRect(...r){calls.push(['clear',...r]);},fillRect(...r){calls.push(['fill',...r,this.fillStyle]);},
  createPattern(source){calls.push(['pattern',source]);return {source};},drawImage(...r){calls.push(['image',...r]);}
 };
 value.getContext=()=>c;return value;
}
function fixture(options={}){
 const c=canvas().getContext('2d'),doc=blank(),paints=[],invalidations=[],water={index:0,image:{width:64,height:64}},counters={cutouts:0,water:0},frame={key:'source-1'};
 const cache=createTerrainChunkCache({createCanvas:canvas,...options});
 const raw=(ctx,d,bounds,opts)=>{paints.push({ctx,d,bounds,opts});ctx.fillStyle='#aabbcc';ctx.fillRect(0,0,16384,12288);};
 const hooks={frameKey:()=>frame.key,invalidateGround:(d,p)=>invalidations.push({d,p}),waterImage:()=>{counters.water++;return water.image;},waterKey:()=>water.index,withWaterCutout:(_c,fn)=>{counters.cutouts++;fn();}};
 const draw=(opts={})=>cache.draw(c,doc,null,opts,raw,hooks);
 return {c,doc,cache,draw,raw,hooks,paints,invalidations,water,counters,frame};
}

test('terrain chunks choose native close detail and generous medium samples while debug/overview transforms stay raw',()=>{
 const t={a:.4,b:0,c:0,d:.4,e:0,f:0};
 assert.equal(terrainChunkScale(t),.5);
 assert.equal(terrainChunkScale({...t,a:.2,d:.2}),.25);
 for(const opts of [{terrainChunks:false},{overviewBake:true},{grid:true},{heightView:'colors'},{heightView:'plan'}])assert.equal(terrainChunkScale(t,opts),null);
 for(const transform of [{...t,a:.125,d:.125},{...t,a:1.1,d:1.1},{...t,b:.2},{...t,d:.5}])assert.equal(terrainChunkScale(transform),null);
 assert.equal(terrainChunkScale(t,{heightView:'art'}),.5);
});

test('projected chunks cover the visible world once, including terrain above its unprojected row',()=>{
 const list=visibleTerrainChunks({x:480,y:-100,w:700,h:700},1);
 assert.equal(list.length,9);
 assert.equal(new Set(list.map(p=>p.key)).size,list.length);
 assert.ok(list.some(p=>p.x===0&&p.y===-512));
 assert.ok(list.some(p=>p.x===1024&&p.y===512));
 assert.deepEqual(visibleTerrainChunks({x:-2000,y:-2000,w:100,h:100},1),[]);
});

test('unchanged terrain turns hundreds of tile operations into cached draws without another authoritative scan',()=>{
 const f=fixture();assert.equal(f.draw({terrainRevision:0}),true);
 const first=f.cache.stats(f.c),builds=f.paints.length;
 assert.ok(first.chunks>0);assert.equal(first.builds,builds);assert.equal(first.scans,1);
 for(let i=0;i<60;i++)f.draw({terrainRevision:0});
 const after=f.cache.stats(f.c);assert.equal(f.paints.length,builds);assert.equal(after.scans,1);assert.equal(after.hits,first.chunks*60);
 assert.equal(f.counters.water,0,'dry terrain never synthesizes an invisible sea');
 assert.ok(f.paints.every(p=>p.opts.overviewBake&&p.opts.terrainChunks===false));
});

test('local edits invalidate projected affected chunks while a distant cached camera remains warm',()=>{
 const f=fixture();f.draw({terrainRevision:0});
 f.c.transform.e=-4000;f.draw({terrainRevision:0});
 const far=f.cache.stats(f.c),before=f.paints.length;
 f.doc.cells['1,1']={surface:'grass',level:4};f.draw({terrainRevision:1});
 assert.equal(f.paints.length,before,'an offscreen edit did not rebake the far camera');
 assert.equal(f.cache.stats(f.c).scans,far.scans+1);
 f.c.transform.e=0;f.draw({terrainRevision:1});
 assert.ok(f.paints.length>before,'returning to the edited cliff rebuilt its projected chunks');
});

test('generic callers detect direct cell edits and equal-data Undo reuses static pixels',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'sand',level:1};f.draw();
 const first=f.paints.length;
 f.doc.cells['1,1'].level=3;f.draw();assert.ok(f.paints.length>first);
 const edited=f.paints.length;
 f.doc.cells=JSON.parse(JSON.stringify(f.doc.cells));f.draw();assert.equal(f.paints.length,edited,'equal-value undo/open preserved cached pixels');
 f.doc.cells['1,1'].level=1;f.draw();assert.ok(f.paints.length>edited);
});

test('terrain surface and paving/source changes invalidate caches without changing document data',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'grass',level:0};const original=JSON.stringify(f.doc);f.draw({terrainRevision:0});
 const first=f.paints.length;f.frame.key='source-2';f.draw({terrainRevision:0});assert.ok(f.paints.length>first);
 assert.equal(JSON.stringify(f.doc),original);assert.equal(f.cache.stats(f.c).scans,2);
});

test('organic water underlays retain a live sea pattern without rebuilding static shore art',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'sand',level:0,curves:[{kind:'surface',corner:'nw',cx:128,cy:128,r:64,underX:4,underY:4}]};f.doc.cells['4,4']={surface:'water',level:0};
 f.draw({terrainRevision:0});const builds=f.paints.length,patterns=f.c.calls.filter(c=>c[0]==='pattern').length;
 assert.ok(f.counters.water>0);f.water.index++;f.draw({terrainRevision:0});
 assert.equal(f.paints.length,builds);assert.equal(f.c.calls.filter(c=>c[0]==='pattern').length,patterns+1);
 assert.ok(f.c.calls.some(c=>c[0]==='fill'&&c[1]===0&&c[3]===16384),'sea remains world anchored');
});

test('lowering a rounded water donor to sea level still supplies animated water behind its cutout',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'grass',level:2,curves:[{kind:'height',corner:'nw',cx:128,cy:128,r:64,lift:-1,under:{surface:'water',level:1},underX:8,underY:8}]};
 f.draw({terrainRevision:0});assert.ok(f.counters.water>0);
 const first=f.paints.length;f.water.index++;f.draw({terrainRevision:0});assert.equal(f.paints.length,first);
});

test('raised water patches redraw live with complete contributor bounds and cull when offscreen',()=>{
 const f=fixture();f.doc.cells['3,3']={surface:'water',level:2};f.draw({terrainRevision:0});
 assert.ok(f.cache.stats(f.c).livePatches>0);
 const first=f.paints.length;f.water.index++;f.draw({terrainRevision:0});
 const live=f.paints.slice(first);assert.ok(live.length>0);assert.ok(live.every(p=>p.opts.liveTerrainPatch&&p.opts.overviewBake));
 assert.ok(live.every(p=>p.bounds.y1>p.bounds.y0+8),'all north/south contributing terrain rows are included');
 f.c.transform.e=-4000;f.draw({terrainRevision:0});const moved=f.paints.length;f.draw({terrainRevision:0});assert.equal(f.paints.length,moved,'offscreen raised water does not redraw');
});

test('a visible working set larger than the cache bypasses before allocating and cannot churn itself',()=>{
 let allocations=0;const f=fixture({maxPixels:1000,createCanvas:(w,h)=>{allocations++;return canvas(w,h);}});
 for(let i=0;i<3;i++)assert.equal(f.draw({terrainRevision:0}),false);
 assert.equal(allocations,0);assert.equal(f.paints.length,0);assert.equal(f.cache.stats(f.c).bypasses,3);
});

test('LRU memory remains bounded while travelling and source invalidation rebuilds on demand',()=>{
 const f=fixture({maxPixels:2*520*520,maxEntries:2});
 f.c.canvas.width=200;f.c.canvas.height=200;
 for(let x=0;x<5;x++){f.c.transform.e=-x*512*.5;f.draw({terrainRevision:0});assert.ok(f.cache.stats(f.c).pixels<=2*520*520);assert.ok(f.cache.stats(f.c).chunks<=2);}
 const first=f.paints.length;f.cache.invalidate(f.c);f.draw({terrainRevision:0});assert.ok(f.paints.length>first);
});

function idleFixture(options={}){
 let time=0,sequence=0;const callbacks=new Map(),allocations=[],steps=[];
 const f=fixture({now:()=>time,requestWork:callback=>{const id=++sequence;callbacks.set(id,callback);return id;},cancelWork:id=>callbacks.delete(id),createCanvas:(w,h)=>{const c=canvas(w,h);allocations.push(c);return c;},...options});
 f.hooks.bakeSteps=function*(c,d,bounds,opts){
  for(let row=0;row<20;row++){steps.push({d,bounds,row,opts});c.fillRect(bounds.x0*64,(bounds.y0+row)*64,64,64);time+=.5;yield;}
 };
 function tick(){const first=callbacks.entries().next().value;if(!first)return false;callbacks.delete(first[0]);first[1]({timeRemaining:()=>50,didTimeout:false});return true;}
 function drain(){let count=0;while(tick()){assert.ok(++count<1000,'idle work never settled');}return count;}
 return {...f,tick,drain,callbacks,allocations,steps,get time(){return time;}};
}

test('idle prefetch bakes cooperatively and never publishes a partially drawn chunk',()=>{
 const f=idleFixture();f.draw({terrainRevision:0});const initial=f.cache.stats(f.c),before=f.time;
 assert.ok(initial.pending>0);assert.equal(f.callbacks.size,1);
 f.tick();const partial=f.cache.stats(f.c);
 assert.equal(partial.chunks,initial.chunks);assert.ok(partial.prefetchSteps>0);assert.ok(f.time-before<=2.5,'one idle turn exceeded its cooperative budget');
 f.drain();const warm=f.cache.stats(f.c);assert.equal(warm.pending,0);assert.ok(warm.prefetchBuilds>0);assert.ok(warm.pixels<=16*1024*1024);
 f.c.transform.e=-512*.5;f.draw({terrainRevision:0});assert.equal(f.cache.stats(f.c).syncBuilds,initial.syncBuilds,'walking into the prepared ring did not synchronously rebuild');
});

test('editor prefetch prepares filtered walking chunks before the camera switches scale',()=>{
 const f=idleFixture();f.c.transform={a:.225,b:0,c:0,d:.225,e:-1000,f:-1000};f.draw({terrainRevision:0});f.drain();
 const before=f.cache.stats(f.c),cx=(f.c.canvas.width/2-f.c.transform.e)/.225,cy=(f.c.canvas.height/2-f.c.transform.f)/.225;
 f.c.transform={a:.4,b:0,c:0,d:.4,e:f.c.canvas.width/2-cx*.4,f:f.c.canvas.height/2-cy*.4};
 f.draw({terrainRevision:0});assert.equal(f.cache.stats(f.c).syncBuilds,before.syncBuilds,'the walking viewport was not warmed at walking resolution');
});

test('terrain revisions and art changes cancel pending jobs and release their canvas memory before publication',()=>{
 const f=idleFixture();f.draw({terrainRevision:0});f.tick();const initial=f.cache.stats(f.c),pendingCanvases=f.allocations.slice(initial.chunks);
 f.doc.cells['1,1']={surface:'grass',level:3};f.draw({terrainRevision:1});
 assert.ok(f.cache.stats(f.c).cancelled>=initial.pending);assert.ok(pendingCanvases.every(c=>c.width===0&&c.height===0));
 const before=f.cache.stats(f.c).cancelled;f.frame.key='edited-art';f.drain();assert.ok(f.cache.stats(f.c).cancelled>before,'a source change before the next frame published stale idle artwork');
});

test('pending prefetch shares the hard memory budget and eviction explicitly releases old backing stores',()=>{
 const f=idleFixture({maxPixels:4*520*520,maxEntries:4});f.c.canvas.width=160;f.c.canvas.height=160;
 f.draw({terrainRevision:0});const initial=f.cache.stats(f.c);assert.ok(initial.pending>0);assert.ok(initial.pixels<=4*520*520);f.drain();
 f.c.transform.e=-4000;f.draw({terrainRevision:0});const moved=f.cache.stats(f.c);assert.ok(moved.pixels<=4*520*520);assert.ok(moved.size<=4);assert.ok(f.allocations.some(c=>c.width===0));
 f.cache.invalidate(f.c);assert.equal(f.cache.stats(f.c).pixels,0);assert.equal(f.cache.stats(f.c).pending,0);assert.equal(f.callbacks.size,0);assert.ok(f.allocations.every(c=>c.width===0&&c.height===0));
});

test('animated chunks reuse their existing rasters within the hard memory budget',()=>{
 const allocated=[],limit=2*260*260,f=fixture({prefetch:false,maxPixels:limit,maxEntries:2,createCanvas:(w,h)=>{const value=canvas(w,h);allocated.push(value);return value;}});
 f.c.canvas.width=f.c.canvas.height=160;
 for(let i=0;i<5;i++)f.doc.cells[`${65+i*8},90`]={surface:'water',level:2};
 for(let i=0;i<5;i++){
  f.c.transform={a:.5,b:0,c:0,d:.5,e:-(4192+i*512)*.5,f:-5680*.5};
  assert.equal(f.draw({terrainRevision:0}),true);
  const stats=f.cache.stats(f.c);assert(stats.pixels<=limit);
  assert.equal(allocated.length,i+1,'Animating a cached chunk must not allocate another canvas');
  assert(allocated.reduce((sum,value)=>sum+value.width*value.height,0)<=limit);
  f.water.index++;f.draw({terrainRevision:0});assert.equal(allocated.length,i+1);assert.equal(f.cache.stats(f.c).builds,stats.builds);
 }
 f.cache.invalidate(f.c);assert.equal(f.cache.stats(f.c).pixels,0);assert(allocated.every(value=>value.width===0&&value.height===0));
});

test('only changed water frames refresh chunks that contain actual projected lake pixels',()=>{
 const f=fixture();f.doc.cells['3,3']={surface:'water',level:2};f.draw({terrainRevision:0});
 const first=f.paints.length,builds=f.cache.stats(f.c).builds;
 for(let i=0;i<60;i++)f.draw({terrainRevision:0});
 assert.equal(f.paints.length,first,'Unchanged water must reuse the complete cached raster');
 f.water.index++;f.draw({terrainRevision:0});const updated=f.paints.length;
 assert.equal(updated-first,1,'The padded chunk containing the lake refreshes, without repainting empty neighboring patch rectangles');
 assert.equal(f.cache.stats(f.c).builds,builds);assert.equal(f.cache.stats(f.c).liveBuilds,1);
 f.water.image={width:64,height:64};f.draw({terrainRevision:0});assert.equal(f.paints.length,updated+1,'A completed worker bitmap can arrive while its requested frame key stays unchanged');
});

test('a requested worker frame does not rebake until its new immutable bitmap arrives',()=>{
 const previous=globalThis.ImageBitmap;class Bitmap{}globalThis.ImageBitmap=Bitmap;
 try{
  const f=fixture();f.water.image=new Bitmap();f.doc.cells['3,3']={surface:'water',level:2};f.draw({terrainRevision:0});const first=f.paints.length;
  f.water.index++;f.draw({terrainRevision:0});assert.equal(f.paints.length,first,'A pending worker request reused the existing completed water frame');
  f.water.image=new Bitmap();f.draw({terrainRevision:0});assert.equal(f.paints.length,first+1);assert.equal(f.cache.stats(f.c).liveBuilds,1);
 }finally{if(previous===undefined)delete globalThis.ImageBitmap;else globalThis.ImageBitmap=previous;}
});

test('a prefetched lake baked across a water change is refreshed before its first visible draw',()=>{
 const f=idleFixture();f.doc.cells['19,3']={surface:'water',level:2};f.draw({terrainRevision:0});
 let turns=0;
 while(!f.steps.some(step=>step.bounds.x0===14&&step.bounds.y1===17)){assert(f.tick());assert(++turns<1000);}
 f.water.index++;f.drain();
 const before=f.cache.stats(f.c);f.c.transform.e=-1024*.5;f.draw({terrainRevision:0});
 assert.equal(f.cache.stats(f.c).liveBuilds,before.liveBuilds+1);
 const refreshed=f.paints.filter(paint=>paint.opts.liveTerrainPatch);assert.equal(refreshed.length,1);assert.equal(refreshed[0].bounds.x0,14);assert.equal(refreshed[0].bounds.y1,17);
 assert.notEqual(refreshed[0].ctx,f.c,'Water refreshes its cached raster rather than drawing a rectangle on the screen');
});
