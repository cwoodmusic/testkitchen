import test from 'node:test';
import assert from 'node:assert/strict';
import {createParallelArtRuntime,registerParallelArt} from './parallel-art-runtime.mjs';
import {createFamilySourceView,createFamilySourceCanvasCache} from './family-furniture-source.mjs';
import {furnitureFacingPlacement,furnitureFacingBoxes,supportsFurnitureFacing} from './furniture-facing.mjs';
import {registerLegacyFurnitureFacings} from './legacy-furniture-facings.mjs';
import {createFurnitureFacingSourceRoster} from './furniture-facing-source.mjs';

function image(name,width=100,height=100){return {name,width,height,closed:0,close(){this.closed++;}};}
function canvasFactory(){
 const canvases=[];
 return {canvases,createCanvas(){
  const canvas={width:0,height:0,draws:[],clears:0},ctx={drawImage(...args){canvas.draws.push(args);},clearRect(){canvas.draws.length=0;canvas.clears++;}};
  canvas.getContext=()=>ctx;canvases.push(canvas);return canvas;
 }};
}
function fixture({id='table',w=80,h=60,cardinal=true,layer='objects'}={}){
 const calls={draw:0,canvas:0,metadata:0,viewCanvas:0,sources:0,images:0,ensures:[]},original=image('original-'+id,w,h),views=new Map(),sources=new Map();
 const asset={id,name:'Detailed table',owner:'test-owner',slot:'dining-table',w,h,boxes:[{x:5,y:30,w:w-10,h:25}],layer,
  draw(ctx){calls.draw++;ctx.drawImage(original,0,0,w,h);}};
 Object.defineProperty(asset,'canvas',{configurable:true,enumerable:true,get(){calls.canvas++;return original;}});
 if(cardinal){
  for(const facing of ['south','west','north','east']){
   const view={id:id+'|'+facing,w:80,h:60,footCenter:Object.freeze({x:40,y:42.5}),facing};
   Object.defineProperties(view,{canvas:{enumerable:true,get(){calls.viewCanvas++;return original;}},ready:{get:()=>false}});Object.freeze(view);views.set(facing,view);
   sources.set(facing,{image:original,sx:3,sy:4,sw:30,sh:40,dx:13,dy:0,dw:45,dh:60,native:false,quality:'original-preview',revision:1});
  }
  asset.getFacingView=(facing='south',options)=>{calls.metadata++;assert.equal(options?.image,false);return views.get(facing)??null;};
  asset.getFacingDrawSource=(facing='south')=>{calls.sources++;return sources.get(facing)??null;};
  asset.getFacingImage=(facing='south')=>{calls.images++;return views.has(facing)?original:null;};
 }
 asset.ensureFull=(...args)=>{calls.ensures.push(args);return Promise.resolve();};
 const catalog=new Map([[id,asset]]),factory=canvasFactory(),loads=[];
 const loadImage=async file=>{loads.push(file);return image(file,100,100);};
 const patch={id,facing:'south',file:'native.webp',width:100,height:100,x:10,y:20,w:30,h:40,draw:{x:12,y:0,w:45,h:60}};
 return {asset,catalog,calls,original,views,sources,patch,loads,loadImage,...factory};
}
const context=()=>({draws:[],drawImage(...args){this.draws.push(args);}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('an empty accepted dataset is a complete no-op',async()=>{
 const f=fixture(),descriptors=Object.getOwnPropertyDescriptors(f.asset),runtime=await registerParallelArt(f.catalog,{patches:[],loadImage:f.loadImage,createCanvas:f.createCanvas});
 assert.deepEqual(Object.getOwnPropertyDescriptors(f.asset),descriptors);assert.deepEqual(f.loads,[]);assert.equal(f.canvases.length,0);assert.equal(runtime.stats.patches,0);
});

test('discovery preserves frozen cardinal metadata, all physics and placement without loading images',()=>{
 const f=fixture(),boxes=f.asset.boxes,foot=f.views.get('south').footCenter,placement={x:200,y:300,scale:1.3,rotation:0};
 const before=furnitureFacingPlacement(f.asset,placement,undefined,{includeImage:false}),physical=furnitureFacingBoxes(f.asset,placement);
 const runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas});
 for(let i=0;i<100;i++)for(const facing of ['south','north','west','east']){
  const view=f.asset.getFacingView(facing,{image:false});assert.equal(view.w,80);assert.equal(view.h,60);assert.strictEqual(view.footCenter,foot===f.views.get(facing).footCenter?foot:f.views.get(facing).footCenter);
  if(facing==='south'){assert.equal(view.ready,false);assert.strictEqual(view,f.asset.getFacingView(facing,{image:false}));}
  else assert.strictEqual(view,f.views.get(facing));
 }
 assert.equal(f.asset.owner,'test-owner');assert.equal(f.asset.slot,'dining-table');assert.strictEqual(f.asset.boxes,boxes);assert.deepEqual([f.asset.w,f.asset.h],[80,60]);
 assert.deepEqual(furnitureFacingBoxes(f.asset,placement),physical);
 const after=furnitureFacingPlacement(f.asset,placement,undefined,{includeImage:false});for(const key of ['bounds','groundCenter','screenFootCenter','scaleX','scaleY'])assert.deepEqual(after[key],before[key]);
 assert.deepEqual(f.loads,[]);assert.equal(f.canvases.length,0);assert.equal(f.calls.sources,0);assert.equal(f.calls.images,0);assert.equal(f.calls.canvas,0);assert.equal(f.calls.viewCanvas,0);assert.equal(runtime.stats.sourceLoads,0);
});

test('ensureFull prepares exact native pixels and every patched draw API retains the original letterboxing',async()=>{
 const f=fixture(),runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas});
 assert.equal(await f.asset.ensureFull('south'),undefined);assert.deepEqual(f.loads,['native.webp']);assert.deepEqual(f.calls.ensures,[]);
 const source=f.asset.getFacingDrawSource('south',{native:true}),crop=source.image;
 assert.deepEqual([crop.width,crop.height],[30,40]);assert.equal(crop.draws[0][0].name,'native.webp');assert.deepEqual(crop.draws[0].slice(1),[10,20,30,40,0,0,30,40]);
 assert.deepEqual([source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh],[0,0,30,40,12,0,45,60]);assert(source.native);assert.equal(source.quality,'parallel-native');
 const ctx=context();f.asset.draw(ctx);assert.deepEqual(ctx.draws[0],[crop,0,0,30,40,12,0,45,60]);assert.equal(f.calls.draw,0);
 const canvas=f.asset.canvas;assert.deepEqual([canvas.width,canvas.height],[80,60]);assert.deepEqual(canvas.draws[0],[crop,0,0,30,40,12,0,45,60]);
 assert.strictEqual(f.asset.getFacingImage('south'),canvas);assert.strictEqual(f.asset.getFacingView('south',{image:false}).canvas,canvas);assert(f.asset.getFacingView('south',{image:false}).ready);
 const builds=runtime.stats.canvasBuilds;for(let i=0;i<1000;i++){f.asset.draw(ctx);assert.strictEqual(f.asset.getFacingDrawSource('south',{native:true}),source);assert.strictEqual(f.asset.canvas,canvas);}
 assert.equal(runtime.stats.canvasBuilds,builds);assert.equal(f.loads.length,1);assert.equal(f.calls.canvas,0);assert.equal(f.calls.viewCanvas,0);runtime.clear();assert.equal(crop.width,1);assert.equal(canvas.width,1);
});

test('unpatched facings and preparation parameters continue to use the original provider',async()=>{
 const f=fixture();createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas});
 assert.strictEqual(f.asset.getFacingDrawSource('east',{native:true}),f.sources.get('east'));assert.strictEqual(f.asset.getFacingImage('north'),f.original);
 await f.asset.ensureFull('east',{retry:true});assert.deepEqual(f.calls.ensures,[['east',{retry:true}]]);assert.deepEqual(f.loads,[]);
});

test('original single and flat ground assets keep their facing and saved rotation semantics',async()=>{
 for(const layer of ['objects','ground']){
  const f=fixture({cardinal:false,layer}),before=supportsFurnitureFacing(f.asset),runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas});
  assert.equal(supportsFurnitureFacing(f.asset),before);assert.equal(f.asset.getFacingView,undefined);assert.equal(f.asset.getFacingImage,undefined);
  const pending=context();f.asset.draw(pending);assert.equal(pending.draws[0][0],f.original);assert.deepEqual(f.loads,[]);
  assert.equal(f.asset.canvas,f.original);await f.asset.ensureFull();
  const native=f.asset.getFacingDrawSource('south',{native:true});assert(native.native);assert.equal(native.image.draws[0][0].name,'native.webp');
  const ready=context();f.asset.draw(ready);assert.equal(ready.draws[0][0],native.image);assert.notEqual(f.asset.canvas,f.original);assert.equal(supportsFurnitureFacing(f.asset),before);runtime.clear();
 }
});

test('registration prepares only one compact shared preview; preview rendering never warms full atlases',async()=>{
 const f=fixture(),other=fixture({id:'lamp'}),patch={...f.patch,preview:{file:'overview.webp',width:100,height:100,x:2,y:3,w:30,h:40}},second={...other.patch,file:'other.webp',preview:{...patch.preview,x:40}};
 f.catalog.set('lamp',other.asset);
 const runtime=await registerParallelArt(f.catalog,{patches:[patch,second],loadImage:f.loadImage,createCanvas:f.createCanvas});
 assert.deepEqual(f.loads,['overview.webp']);assert.equal(f.canvases.length,0);
 const a=f.asset.getFacingDrawSource('south',{native:false}),b=other.asset.getFacingDrawSource('south',{native:false});assert.strictEqual(a.image,b.image);assert.equal(a.image.name,'overview.webp');assert.equal(a.native,false);
 assert.deepEqual([a.sx,a.sy,a.sw,a.sh,a.dx,a.dy,a.dw,a.dh],[2,3,30,40,12,0,45,60]);
 const ctx=context();f.asset.draw(ctx);assert.equal(ctx.draws[0][0],a.image);assert.equal(f.calls.draw,0);assert.equal(runtime.stats.sourceLoads,0);
 assert.deepEqual([f.asset.canvas.width,f.asset.canvas.height],[80,60]);assert.deepEqual(f.loads,['overview.webp']);runtime.clear();
});

test('family products created before final registration inherit corrected donor art and readiness',async()=>{
 const f=fixture({id:'donor'}),factory=canvasFactory(),def={id:'large-plant',sourceAssetId:'donor',slot:'plant',w:160,h:120,boxes:[{x:10,y:60,w:140,h:50}]};
 const helper=createFamilySourceView(def,f.asset,{createCanvas:factory.createCanvas,canvasCache:createFamilySourceCanvasCache()});
 const runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas});
 const view=helper.view();assert.deepEqual([view.w,view.h],[160,120]);assert.equal(view.ready,false);await helper.ensureFull('south');assert.equal(view.ready,true);
 const donor=f.asset.getFacingDrawSource('south',{native:true}),derived=helper.drawSource('south',{native:true});assert.strictEqual(derived.image,donor.image);assert(derived.native);assert.equal(derived.sw,30);assert.equal(derived.sh,40);
 const ctx=context();helper.draw(ctx);assert.strictEqual(ctx.draws[0][0],donor.image);assert.equal(f.calls.draw,0);assert.equal(f.calls.sources,0);runtime.clear();
});

test('native atlas and crop canvas eviction are bounded and invalidate stable descriptors safely',async()=>{
 const f=fixture(),other=fixture({id:'other'}),loaded=[];f.catalog.set('other',other.asset);
 const runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch,{...other.patch,file:'other.webp'}],maxSources:1,maxCanvases:1,maxCanvasPixels:5000,maxSourcePixels:10000,createCanvas:f.createCanvas,
  loadImage:async file=>{const value=image(file);loaded.push(value);return value;}});
 await f.asset.ensureFull();const first=f.asset.getFacingDrawSource('south',{native:true}),old=first.image;
 await other.asset.ensureFull();assert.equal(loaded[0].closed,1);assert.equal(old.width,1);assert.equal(first.image,null);assert.equal(first.native,false);
 assert.equal(runtime.stats.sourceEntries,1);assert.equal(runtime.stats.sourcePixels,10000);assert.equal(runtime.stats.canvasEntries,1);assert.equal(runtime.stats.canvasPixels,1200);
 const second=other.asset.getFacingDrawSource('south',{native:true});assert(second.native);assert.equal(second.image.draws[0][0].name,'other.webp');
 await f.asset.ensureFull();assert.strictEqual(f.asset.getFacingDrawSource('south',{native:true}),first);assert(first.native);assert.equal(first.image.draws[0][0].name,'native.webp');assert.equal(loaded[1].closed,1);runtime.clear();
});

test('a small canvas budget composites before evicting the native input and remains within budget',async()=>{
 const f=fixture(),runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],loadImage:f.loadImage,createCanvas:f.createCanvas,maxCanvases:1,maxCanvasPixels:4800});
 await f.asset.ensureFull();const crop=f.asset.getFacingDrawSource('south',{native:true}).image,canvas=f.asset.canvas;
 assert.equal(canvas.draws[0][0],crop);assert.equal(crop.width,1);assert.equal(canvas.width,80);assert.equal(runtime.stats.canvasEntries,1);assert.equal(runtime.stats.canvasPixels,4800);
 const ctx=context();f.asset.draw(ctx);assert.equal(ctx.draws[0][0].name,'native.webp');assert.deepEqual(ctx.draws[0].slice(1),[10,20,30,40,12,0,45,60]);runtime.clear();
});

test('a large visible roster uses shared exact native atlas crops without per-item canvas churn',async()=>{
 const catalog=new Map(),patches=[],factory=canvasFactory(),loads=[];
 for(let index=0;index<200;index++){const f=fixture({id:'item-'+index});catalog.set(f.asset.id,f.asset);patches.push(f.patch);}
 const runtime=createParallelArtRuntime(catalog,{patches,createCanvas:factory.createCanvas,maxCanvases:1,maxSources:1,
  loadImage:async file=>{loads.push(file);return image(file);}});
 for(const asset of catalog.values())asset.getFacingDrawSource('south',{native:true});await tick();
 assert.deepEqual(loads,['native.webp']);assert.equal(factory.canvases.length,0);
 const stable=new Map();for(const asset of catalog.values()){const source=asset.getFacingDrawSource('south',{native:true});assert(source.native);assert.equal(source.image.name,'native.webp');assert.equal(source.quality,'parallel-native-atlas');stable.set(asset.id,source);assert(asset.getFacingView('south',{image:false}).ready);}
 for(let frame=0;frame<20;frame++)for(const asset of catalog.values())assert.strictEqual(asset.getFacingDrawSource('south',{native:true}),stable.get(asset.id));
 assert.equal(factory.canvases.length,0);assert.equal(runtime.stats.canvasBuilds,0);assert.equal(runtime.stats.sourceLoads,1);runtime.clear();for(const source of stable.values())assert.equal(source.image,null);
});

test('a realistic room with 32 placements spread over ten native boards settles without reload or raster churn',async()=>{
 const catalog=new Map(),patches=[],factory=canvasFactory(),loads=[];
 for(let index=0;index<32;index++){
  const f=fixture({id:'mixed-'+index});catalog.set(f.asset.id,f.asset);
  patches.push({...f.patch,file:'board-'+index%10+'.webp',width:1536,height:1024});
 }
 const runtime=createParallelArtRuntime(catalog,{patches,createCanvas:factory.createCanvas,loadImage:async file=>{loads.push(file);return image(file,1536,1024);}});
 const assets=[...catalog.values()];for(const asset of assets)asset.getFacingDrawSource('south',{native:true});
 for(let count=0;count<10&&runtime.stats.activeLoads+runtime.stats.queuedLoads;count++)await tick();
 assert.equal(loads.length,10);assert.equal(runtime.stats.sourceEntries,10);assert.equal(runtime.stats.sourcePixels,10*1536*1024);assert.equal(factory.canvases.length,0);
 const stable=assets.map(asset=>asset.getFacingDrawSource('south',{native:true})),before=runtime.stats;
 for(let frame=0;frame<100;frame++)for(let index=0;index<assets.length;index++){const source=assets[index].getFacingDrawSource('south',{native:true});assert.strictEqual(source,stable[index]);assert(source.native);}
 assert.equal(runtime.stats.sourceLoads,before.sourceLoads);assert.equal(runtime.stats.canvasBuilds,before.canvasBuilds);assert.equal(factory.canvases.length,0);runtime.clear();
});

test('failed native loads retain corrected previews, suppress frame retries and allow explicit recovery',async()=>{
 const f=fixture(),patch={...f.patch,preview:{file:'overview.webp',width:100,height:100,x:0,y:0,w:30,h:40}},loads=[];let fail=true;
 const runtime=await registerParallelArt(f.catalog,{patches:[patch],createCanvas:f.createCanvas,loadImage:async file=>{loads.push(file);if(file==='native.webp'&&fail)throw Error('offline');return image(file);}});
 const preview=f.asset.getFacingDrawSource('south',{native:false});await assert.rejects(f.asset.ensureFull(),/offline/);assert.equal(runtime.stats.failedSources,1);
 for(let i=0;i<50;i++)assert.strictEqual(f.asset.getFacingDrawSource('south',{native:true}),preview);
 await tick();assert.deepEqual(loads,['overview.webp','native.webp']);const ctx=context();f.asset.draw(ctx);assert.equal(ctx.draws[0][0].name,'overview.webp');
 fail=false;await f.asset.ensureFull();assert.equal(runtime.stats.failedSources,0);assert(f.asset.getFacingDrawSource('south',{native:true}).native);assert.deepEqual(loads,['overview.webp','native.webp','native.webp']);runtime.clear();
});

test('a missing compact preview leaves original rendering usable and can be explicitly retried',async()=>{
 const f=fixture();let fail=true;const runtime=await registerParallelArt(f.catalog,{patches:[{...f.patch,preview:{file:'overview.webp',width:100,height:100}}],createCanvas:f.createCanvas,
  loadImage:async file=>{if(fail)throw Error('overview offline');return image(file);}});
 assert.equal(runtime.stats.failedSources,1);const ctx=context();f.asset.draw(ctx);assert.equal(ctx.draws[0][0],f.original);
 fail=false;await runtime.warmPreviews();const corrected=context();f.asset.draw(corrected);assert.equal(corrected.draws[0][0].name,'overview.webp');runtime.clear();
});

test('dimension failures reject the load without discarding existing art or blocking explicit retries',async()=>{
 const f=fixture(),bad=image('wrong-size',99,100);let wrong=true;
 const runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],createCanvas:f.createCanvas,loadImage:async()=>wrong?bad:image('correct-size')});
 await assert.rejects(f.asset.ensureFull(),/dimensions changed/);assert.equal(bad.closed,1);const ctx=context();f.asset.draw(ctx);assert.equal(ctx.draws[0][0],f.original);
 assert.equal(runtime.stats.sourceEntries,0);assert.equal(runtime.stats.canvasEntries,0);wrong=false;await f.asset.ensureFull();assert(f.asset.getFacingDrawSource('south',{native:true}).native);runtime.clear();
});

test('clear drops old generations while preserving the shared concurrent-load limit',async()=>{
 const f=fixture(),loads=[],runtime=createParallelArtRuntime(f.catalog,{patches:[f.patch],createCanvas:f.createCanvas,maxConcurrentLoads:1,
  loadImage:file=>new Promise(resolve=>loads.push({file,resolve}))});
 const first=f.asset.ensureFull();assert.equal(loads.length,1);runtime.clear();const second=f.asset.ensureFull();assert.equal(loads.length,1);assert.equal(runtime.stats.queuedLoads,1);
 const stale=image('stale');loads[0].resolve(stale);await first;await tick();assert.equal(stale.closed,1);assert.equal(loads.length,2);assert.equal(runtime.stats.canvasEntries,0);
 loads[1].resolve(image('current'));await second;assert.equal(f.asset.getFacingDrawSource('south',{native:true}).image.draws[0][0].name,'current');assert.equal(runtime.stats.canvasEntries,1);runtime.clear();
});

test('validation rejects namespace, crops, draw rectangles and budgets before wrapping any asset',()=>{
 const mutations=[p=>{p.id='missing';},p=>{p.facing='diagonal';},p=>{p.x=99;},p=>{p.width=NaN;},p=>{delete p.draw;},p=>{p.draw.x=70;},p=>{p.draw.h=Infinity;}];
 for(const mutate of mutations){
  const f=fixture(),draw=f.asset.draw,descriptor=Object.getOwnPropertyDescriptor(f.asset,'canvas'),patch=structuredClone(f.patch);mutate(patch);
  assert.throws(()=>createParallelArtRuntime(f.catalog,{patches:[patch],loadImage:f.loadImage,createCanvas:f.createCanvas}),/parallel artwork/i);
  assert.equal(f.asset.draw,draw);assert.deepEqual(Object.getOwnPropertyDescriptor(f.asset,'canvas'),descriptor);assert.deepEqual(f.loads,[]);assert.equal(f.canvases.length,0);
 }
 const f=fixture();assert.throws(()=>createParallelArtRuntime(f.catalog,{patches:[f.patch,f.patch]}),/duplicate/);
 assert.throws(()=>createParallelArtRuntime(f.catalog,{patches:[f.patch],maxCanvasPixels:100}),/pixel budget/);
 assert.throws(()=>createParallelArtRuntime(f.catalog,{patches:[f.patch],maxSourcePixels:100}),/pixel budget/);
});

test('authored contain rectangles retain harmless floating-point edge roundoff',async()=>{
 const f=fixture(),draw={x:-1.4210854715202004e-14,y:0,w:80.00000000000003,h:60};
 const runtime=createParallelArtRuntime(f.catalog,{patches:[{...f.patch,draw}],loadImage:f.loadImage,createCanvas:f.createCanvas});
 await f.asset.ensureFull();const source=f.asset.getFacingDrawSource('south',{native:true});assert.equal(source.dx,draw.x);assert.equal(source.dw,draw.w);runtime.clear();
});

test('real preserved and corrected legacy South providers survive edited preview/native failure and clear without canvas recursion',async()=>{
 for(const corrected of [false,true]){
  const f=fixture({cardinal:false}),directions=['south','west','north','east'],views={};
  for(const facing of directions)if(facing!=='south'||corrected)views[facing]={file:'old-'+facing+'.webp',width:100,height:100,cells:[{id:f.asset.id,x:10,y:20,w:30,h:40}]};
  const directionManifest={collections:[{owner:'legacy-owner',views}],overview:{file:'old-overview.webp',width:100,height:100,cells:directions.map((facing,index)=>({id:f.asset.id,facing,x:index*20,y:0,w:20,h:20}))}};
  await registerLegacyFurnitureFacings(f.catalog,{definitions:[{id:f.asset.id}],directionManifest,reuseAuthoredSeats:false,createCanvas:f.createCanvas,loadImage:async url=>image(new URL(url).pathname.split('/').at(-1))});
  await f.asset.ensureFull('south');const expected=context();f.asset.draw(expected);const oldWest=f.asset.getFacingDrawSource('west',{native:false});
  const runtime=await registerParallelArt(f.catalog,{patches:[{...f.patch,preview:{file:'missing-preview.webp',width:100,height:100}}],createCanvas:f.createCanvas,loadImage:async()=>{throw Error('edited art offline');}});
  await assert.rejects(f.asset.ensureFull('south'),/edited art offline/);
  for(let pass=0;pass<2;pass++){
   const canvas=f.asset.canvas;assert.deepEqual(canvas.draws[0],expected.draws[0],'Captured approved South draw must remain the fallback, including old opt-in South corrections');
   assert.strictEqual(f.asset.getFacingImage('south'),canvas);
   const source=f.asset.getFacingDrawSource('south',{native:true});assert(source?.image);assert.strictEqual(f.asset.getFacingDrawSource('west',{native:false}),oldWest);
   const ctx=context();f.asset.draw(ctx);assert(ctx.draws.length>0);runtime.clear();
  }
 }
});

test('legacy-style dynamic canvas/image/source closures do not recurse when all replacement sources fail',async()=>{
 const f=fixture({cardinal:false}),asset=f.asset;
 asset.getFacingView=(facing='south')=>facing==='south'?{id:asset.id,w:asset.w,h:asset.h,footCenter:{x:40,y:60},facing}:null;
 asset.getFacingImage=(facing='south')=>facing==='south'?asset.canvas:null;
 asset.getFacingDrawSource=(facing='south')=>facing==='south'?{image:asset.canvas,sx:0,sy:0,sw:80,sh:60,dx:0,dy:0,dw:80,dh:60,native:true}:null;
 const runtime=await registerParallelArt(f.catalog,{patches:[{...f.patch,preview:{file:'offline-preview.webp',width:100,height:100}}],createCanvas:f.createCanvas,loadImage:async()=>{throw Error('offline');}});
 await assert.rejects(asset.ensureFull(),/offline/);
 for(let pass=0;pass<3;pass++){
  const canvas=asset.canvas;assert.equal(canvas.draws[0][0],f.original);assert.strictEqual(asset.getFacingImage(),canvas);assert(asset.getFacingDrawSource('south',{native:true})?.image);
  const ctx=context();asset.draw(ctx);assert.equal(ctx.draws[0][0],f.original);runtime.clear();
 }
});

test('an over-budget real source roster stops decoding unchanged frames and automatically recovers after camera focus',async()=>{
 for(const maxSourcePixels of [32*1024*1024,2*1024*1024]){
  const catalog=new Map(),patches=[],factory=canvasFactory(),loads=[];let clock=0;
  for(let index=0;index<17;index++){
   const f=fixture({id:'crowded-'+index});catalog.set(f.asset.id,f.asset);
   patches.push({...f.patch,file:'crowded-'+index+'.webp',width:1024,height:1024,preview:{file:'overview.webp',width:100,height:100,x:0,y:0,w:30,h:40}});
  }
  const runtime=await registerParallelArt(catalog,{patches,createCanvas:factory.createCanvas,maxSourcePixels,now:()=>clock,
   loadImage:async file=>{loads.push(file);return file==='overview.webp'?image(file):image(file,1024,1024);}});
  const roster=createFurnitureFacingSourceRoster(),entries=[...catalog.values()].map((asset,index)=>({asset,placement:furnitureFacingPlacement(asset,{x:index*90,y:100,scale:1,rotation:0},undefined,{includeImage:false})}));
  roster.update(entries);assert.equal(roster.stats.nativeViews,17);
  for(const {asset,placement}of entries)roster.source(asset,placement);
  for(let index=0;index<20&&runtime.stats.activeLoads+runtime.stats.queuedLoads;index++)await tick();
  assert.equal(runtime.stats.sourceLoads,17);assert.equal(runtime.stats.sourceEntries,maxSourcePixels===2*1024*1024?2:16);
  for(let frame=0;frame<30;frame++){clock+=16;for(const {asset,placement}of entries)roster.source(asset,placement);await tick();}
  assert.equal(runtime.stats.sourceLoads,17,'An unchanged admitted roster must not continually decode evicted atlas sources');assert.equal(runtime.stats.canvasBuilds,0);
  const focus=entries.find(({asset})=>asset.getFacingDrawSource('south',{native:false}).quality==='parallel-preview');assert(focus);
  roster.update([focus]);for(let frame=0;frame<30;frame++){clock+=16;roster.source(focus.asset,focus.placement);await tick();}
  const recovered=roster.source(focus.asset,focus.placement);assert(recovered.native,'Camera focus must restore native quality without clear() or ensureFull()');
  assert.equal(runtime.stats.sourceLoads,18);assert.equal(runtime.stats.canvasBuilds,0);assert.equal(loads.filter(file=>file!=='overview.webp').length,18);
  assert(runtime.stats.sourcePixels<=maxSourcePixels);runtime.clear();
 }
});
