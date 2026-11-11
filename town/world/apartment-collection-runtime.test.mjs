import test from 'node:test';
import assert from 'node:assert/strict';
import {APARTMENT_COLLECTIONS,APARTMENT_COLLECTION_ASSETS,APARTMENT_COLLECTION_OWNERS,registerApartmentCollections,clearApartmentCollectionCache} from './apartment-collections.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';
import {createFurnitureFacingSourceRoster,drawFurnitureFacingSource} from './furniture-facing-source.mjs';
import {furnitureFacingPlacement,furnitureFacingBoxes,furnitureFootCenter} from './furniture-facing.mjs';
import {collectionImageRect} from './apartment-collection-art.mjs';

function manifestFor(collections){return {version:1,columns:4,rows:8,collections:collections.map(collection=>({
 owner:collection.owner,file:collection.owner+'.webp',thumbnail:collection.owner+'-thumb.webp',width:400,height:800,
 cells:collection.assets.map(def=>({slot:def.slot,x:def.atlasIndex%4*100+5,y:Math.floor(def.atlasIndex/4)*100+5,w:90,h:90,
  ...(def.motionKind?{motion:{kind:def.motionKind,mask:[[.3,.1],[.7,.1],[.8,.85],[.2,.85]],palette:['#142739','#73c8b0','#ffdc98'],seed:def.owner}}:{})}))
 }))};}
function directionsFor(collections,{separate=true}={}){return {version:1,collections:collections.map(collection=>({
 owner:collection.owner,...(!separate?{file:collection.owner+'-directions.webp',width:1200,height:800}:{}),
 views:Object.fromEntries(['north','east','west'].map((facing,index)=>[facing,{
  ...(separate?{file:collection.owner+'-'+facing+'.webp',width:400,height:800}:{}),
  cells:collection.assets.map(def=>({slot:def.slot,x:def.atlasIndex%4*100+5+(separate?0:index*400),y:Math.floor(def.atlasIndex/4)*100+5,w:facing==='north'?90:50,h:90,
   viewWidth:facing==='north'?def.w:103,viewHeight:facing==='north'?def.h:197,footCenter:[.5,.85],
   ...(def.motionKind?{motion:{kind:def.motionKind,mask:[[.3,.1],[.7,.1],[.8,.8],[.2,.8]],palette:['#142739','#73c8b0','#ffdc98'],seed:def.owner+'-'+facing}}:{})}))
 }]))
 }))};}
function overviewFor(collections){
 const cells=[];for(const collection of collections)for(const def of collection.assets)for(const facing of ['south','north','east','west']){
  const width=['east','west'].includes(facing)?103:def.w,height=['east','west'].includes(facing)?197:def.h,fit=32/Math.max(width,height),index=cells.length;
  cells.push({id:def.id,facing,x:index%64*32,y:Math.floor(index/64)*32,w:Math.max(1,Math.round(width*fit)),h:Math.max(1,Math.round(height*fit))});
 }
 return {file:'overview.webp',width:2048,height:Math.ceil(cells.length/64)*32,cells};
}
function largeFixture(){
 const collections=APARTMENT_COLLECTIONS,manifest=manifestFor(collections),directionManifest=directionsFor(collections),overview=overviewFor(collections),f=canvasFactory(),loads=[],images=[];
 directionManifest.overview=overview;
 const runtime=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest,thumbnails:new Map(collections.map(c=>[c.owner,image(c.owner+'-thumb',100,200)])),createCanvas:f.createCanvas,loadImage:async(file,owner)=>{
  loads.push({file,owner});const result=image(file,file==='overview.webp'?overview.width:400,file==='overview.webp'?overview.height:800);images.push(result);return result;
 }});
 const entries=APARTMENT_COLLECTION_ASSETS.slice(0,500).map((def,index)=>{
  const direction=['south','west','north','east'][index%4],view=runtime.view(def.id,direction),asset={id:def.id,getFacingDrawSource:(dir,options)=>runtime.drawSource(def.id,dir,options)};
  return {asset,placement:{x:index%25*120,y:Math.floor(index/25)*140,w:view.w,h:view.h,view,direction,scaleX:1,scaleY:1}};
 });
 return {...f,runtime,entries,loads,images};
}
function image(name,width=400,height=800){return {name,width,height,closed:0,close(){this.closed++;}};}
function canvasFactory(){
 const canvases=[];return {canvases,createCanvas(){const canvas={width:0,height:0,draws:[]},c={drawImage(...args){canvas.draws.push(args);}};canvas.getContext=()=>c;canvases.push(canvas);return canvas;}};
}
function fixture(options={}){
 const collections=APARTMENT_COLLECTIONS.slice(0,6),definitions=collections.flatMap(c=>c.assets.filter(a=>['bed','sofa','lava-lamp'].includes(a.slot))),manifest=manifestFor(collections),thumbnails=new Map(collections.map(c=>[c.owner,image(c.owner+'-thumb',100,200)]));
 const f=canvasFactory(),loads=[],images=[];
 const runtime=createApartmentCollectionRuntime({definitions,manifest,thumbnails,loadImage(file,owner){loads.push({file,owner});const full=image(file);images.push(full);return Promise.resolve(full);},createCanvas:f.createCanvas,...options});
 return {...f,runtime,definitions,manifest,thumbnails,loads,images,def:(owner=0,slot='bed')=>definitions.find(d=>d.owner===collections[owner].owner&&d.slot===slot)};
}

test('taller South artwork keeps its natural aspect and the exact saved physical floor centre',async()=>{
 const owner=APARTMENT_COLLECTIONS[0],bed=owner.assets.find(d=>d.slot==='bed'),definition=structuredClone(bed),manifest=manifestFor([owner]),original=fixture({definitions:[bed],manifest:structuredClone(manifest)});
 const frame=manifest.collections[0].cells.find(cell=>cell.slot==='bed');Object.assign(frame,{w:80,h:140,viewWidth:200,viewHeight:280,footCenter:[.5,.82]});
 const expanded=fixture({definitions:[bed],manifest}),view=expanded.runtime.view(bed.id),placement={x:510,y:630,rotation:0,scale:1.25};
 const before={...bed,getFacingView:direction=>original.runtime.view(bed.id,direction)},after={...bed,getFacingView:direction=>expanded.runtime.view(bed.id,direction)};
 const oldPose=furnitureFacingPlacement(before,placement,undefined,{includeImage:false}),newPose=furnitureFacingPlacement(after,placement,undefined,{includeImage:false});
 assert.deepEqual([view.w,view.h],[200,280]);assert.notDeepEqual(newPose.bounds,oldPose.bounds);
 assert.deepEqual(newPose.groundCenter,oldPose.groundCenter);assert.deepEqual(newPose.screenFootCenter,oldPose.screenFootCenter);
 assert.deepEqual(furnitureFacingBoxes(after,placement),furnitureFacingBoxes(before,placement));assert.deepEqual(bed,definition);
 assert.equal(newPose.x+view.footCenter.x*newPose.scaleX,newPose.screenFootCenter.x);assert.equal(newPose.y+view.footCenter.y*newPose.scaleY,newPose.screenFootCenter.y);
 await expanded.runtime.ensureAsset(bed.id);const native=expanded.runtime.canvas(bed.id),draw=native.draws[0];assert.deepEqual([native.width,native.height],[200,280]);
 assert.equal(draw[7]/draw[8],frame.w/frame.h,'The taller source must be uniformly contained, never stretched into the old preview');
 assert.equal(expanded.runtime.view(bed.id).ready,true);original.runtime.clear();expanded.runtime.clear();
});

test('an expanded South envelope requires an explicit finite ground anchor before loading artwork',()=>{
 const owner=APARTMENT_COLLECTIONS[0],bed=owner.assets.find(d=>d.slot==='bed');
 for(const anchor of [{},{footCenter:[.5]},{footCenter:[NaN,.8]},{worldFootCenter:{x:90,y:Infinity}}]){
  const manifest=manifestFor([owner]);Object.assign(manifest.collections[0].cells.find(cell=>cell.slot==='bed'),{viewHeight:280,...anchor});
  assert.throws(()=>fixture({definitions:[bed],manifest}),/South view needs an authored ground anchor/);
 }
});

test('partial South overrides replace only their exact crop and group mixed owner requests by their real source',async()=>{
 const owner=APARTMENT_COLLECTIONS[0],definitions=owner.assets.filter(d=>['bed','sofa'].includes(d.slot)),bed=definitions.find(d=>d.slot==='bed'),sofa=definitions.find(d=>d.slot==='sofa'),manifest=manifestFor([owner]),frame={id:bed.id,x:23,y:41,w:72,h:90},directionManifest={collections:[{owner:owner.owner,views:{south:{file:'corrected-south.webp',width:400,height:800,cells:[frame]}}}]};
 const f=fixture({definitions,manifest,directionManifest,maxSources:1}),before=f.runtime.view(bed.id);assert.deepEqual(before.footCenter,furnitureFootCenter(bed));assert.deepEqual([before.w,before.h],[bed.w,bed.h]);assert.equal(f.loads.length,0);
 await f.runtime.ensureFull(owner.owner,'south',[bed.id,sofa.id]);assert.deepEqual(new Set(f.loads.map(r=>r.file)),new Set(['corrected-south.webp',owner.owner+'.webp']));const B=f.runtime.canvas(bed.id),S=f.runtime.canvas(sofa.id);assert.equal(B.draws[0][0].name,'corrected-south.webp');assert.deepEqual(B.draws[0].slice(1,5),[23,41,72,90]);assert.equal(S.draws[0][0].name,owner.owner+'.webp');assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.stats.canvasEntries,2);assert(f.runtime.view(bed.id).ready&&f.runtime.view(sofa.id).ready);f.runtime.clear();assert.equal(B.width,1);assert.equal(S.width,1);
});

test('clearing a pending South override disposes the old generation and reloads the corrected source',async()=>{
 const owner=APARTMENT_COLLECTIONS[0],bed=owner.assets.find(d=>d.slot==='bed'),loads=[],directionManifest={collections:[{owner:owner.owner,views:{south:{file:'corrected-south.webp',width:400,height:800,cells:[{id:bed.id,x:7,y:9,w:80,h:90}]}}}]},f=fixture({definitions:[bed],directionManifest,loadImage(file){return new Promise(resolve=>loads.push({file,resolve}));}});
 const first=f.runtime.ensureAsset(bed.id);f.runtime.clear();const second=f.runtime.ensureAsset(bed.id);assert.equal(loads.length,2);const stale=image('stale-corrected');loads[0].resolve(stale);await first;assert.equal(stale.closed,1);assert.equal(f.runtime.view(bed.id).ready,false);assert.equal(f.runtime.stats.canvasEntries,0);loads[1].resolve(image('current-corrected'));await second;assert.equal(f.runtime.canvas(bed.id).draws[0][0].name,'current-corrected');assert(f.runtime.view(bed.id).ready);f.runtime.clear();
});

test('South override IDs, owners, duplicate entries and crop extents are validated independently of native loads',()=>{
 const owner=APARTMENT_COLLECTIONS[0],bed=owner.assets.find(d=>d.slot==='bed');
 for(const mutate of [v=>{v.cells[0].id='missing';},v=>v.cells.push({...v.cells[0]}),v=>{v.cells[0].x=399;},v=>{v.cells[0].h=Infinity;},v=>{v.cells=null;}]){
  const v={file:'corrected.webp',width:400,height:800,cells:[{id:bed.id,x:4,y:8,w:80,h:90}]};mutate(v);assert.throws(()=>fixture({definitions:[bed],directionManifest:{collections:[{owner:owner.owner,views:{south:v}}]}}),/South override/);
 }
 assert.throws(()=>fixture({definitions:[bed],directionManifest:{collections:[{owner:'wrong-owner',views:{south:{file:'corrected.webp',width:400,height:800,cells:[{id:bed.id,x:4,y:8,w:80,h:90}]}}}]}}),/changes owner/);
});

test('registration loads only 31 thumbnails, preserves all metadata and installs recoverable lazy canvases',async()=>{
 const calls=[],f=canvasFactory(),manifest=manifestFor(APARTMENT_COLLECTIONS);let oldGetterCalls=0;
 const assets=await registerApartmentCollections((id,name,group,w,h,draw,boxes,layer)=>{
  const asset={id,name,group,w,h,draw,boxes,layer};Object.defineProperty(asset,'canvas',{configurable:true,get(){oldGetterCalls++;return null;}});return asset;
 },{manifest,loadImage:async url=>{const file=new URL(url).pathname.split('/').at(-1);calls.push(file);return image(file,file.endsWith('-thumb.webp')?100:400,file.endsWith('-thumb.webp')?200:800);},createCanvas:f.createCanvas});
 assert.equal(APARTMENT_COLLECTION_OWNERS.length,31);assert.equal(assets.length,992);assert.equal(calls.length,31);assert(calls.every(file=>file.endsWith('-thumb.webp')));assert.equal(f.canvases.length,0);assert.equal(oldGetterCalls,0);
 const bed=assets.find(a=>a.id==='collection-bach-bed'),def=APARTMENT_COLLECTION_ASSETS.find(a=>a.id===bed.id),preview=bed.canvas;
 assert.equal(calls.length,31);assert.equal(preview.draws[0][0].name,'bach-thumb.webp');assert.deepEqual(bed.boxes,def.boxes);assert.equal(bed.owner,'bach');assert.equal(bed.pack,'apartment-collections-864');
 assert.equal(await bed.ensureFull(),undefined);assert.equal(calls.filter(file=>file==='bach.webp').length,1);
 const native=bed.canvas;assert.notStrictEqual(native,preview);assert.equal(preview.width,1);assert.equal(native.draws[0][0].name,'bach.webp');
 const lamp=assets.find(a=>a.id==='collection-bach-lava-lamp');assert.equal(lamp.motion.kind,'lava');assert(lamp.motion.mask.every(p=>p[1]>.5),'Motion follows the bottom-contained native crop, rather than the whole world canvas');
 clearApartmentCollectionCache();assert.equal(native.width,1);
});

test('a new release requests matching metadata, thumbnails and native direction artwork',async t=>{
 const collections=APARTMENT_COLLECTIONS.slice(0,1),manifest=manifestFor(collections),directionManifest=directionsFor(collections),requests=[],loads=[],f=canvasFactory();
 const originalFetch=globalThis.fetch;t.after(()=>{globalThis.fetch=originalFetch;});
 globalThis.fetch=async input=>{
  const url=new URL(input);requests.push(url);return {ok:true,status:200,json:async()=>url.pathname.endsWith('/directions-manifest.json')?directionManifest:manifest};
 };
 const versioned=await import('./apartment-collections.mjs?v=collection-cache-regression');
 const assets=await versioned.registerApartmentCollections((id,name,group,w,h,draw,boxes,layer)=>({id,name,group,w,h,draw,boxes,layer}),{
  definitions:collections[0].assets,createCanvas:f.createCanvas,loadImage:async input=>{const url=new URL(input);loads.push(url);return image(url.pathname,400,800);}
 });
 await assets[0].ensureFull('east');
 assert.deepEqual(requests.map(url=>url.pathname.split('/').at(-1)),['manifest.json','directions-manifest.json']);
 assert.deepEqual(loads.map(url=>url.pathname.split('/').at(-1)),['bach-thumb.webp','bach-east.webp']);
 assert([...requests,...loads].every(url=>url.search==='?v=collection-cache-regression'),'A cached manifest must not mix old crops with new direction sheets');
 versioned.clearApartmentCollectionCache();
});

test('thumbnail and full atlas crops preserve the same contain geometry without stretching',async()=>{
 const f=fixture(),def=f.def(),preview=f.runtime.canvas(def.id),thumb=f.thumbnails.get(def.owner),frame=f.manifest.collections[0].cells.find(cell=>cell.slot==='bed');
 assert.deepEqual(preview.draws[0],[thumb,frame.x/4,frame.y/4,frame.w/4,frame.h/4,0,0,150,150]);
 await f.runtime.ensureAsset(def.id);const native=f.runtime.canvas(def.id);
 assert.deepEqual(native.draws[0],[f.images[0],frame.x,frame.y,frame.w,frame.h,0,0,150,150]);
 const lamp=f.def(0,'lava-lamp');await f.runtime.ensureAsset(lamp.id);const draw=f.runtime.canvas(lamp.id).draws[0];assert(Math.abs(draw[5])<1e-10);assert(Math.abs(draw[6]-58)<1e-10);assert(Math.abs(draw[7]-52)<1e-10);assert(Math.abs(draw[8]-52)<1e-10);
 assert.equal(f.loads.length,1);assert.equal(f.runtime.stats.canvasEntries,2);f.runtime.clear();
});

test('an authored South lamp base aligns the picture without altering its raster or physical footprint',()=>{
 const owner=APARTMENT_COLLECTIONS[0],def=owner.assets.find(asset=>asset.slot==='floor-lamp'),manifest=manifestFor([owner]);
 const frame=manifest.collections[0].cells.find(cell=>cell.slot==='floor-lamp'),rect=collectionImageRect(def,frame),physical=furnitureFootCenter(def);
 const original=fixture({definitions:[def],manifest}),before=original.runtime.canvas(def.id),draw=before.draws[0].slice(1);
 frame.footCenter=[.8,(physical.y-rect.y)/rect.h];
 const authored=fixture({definitions:[def],manifest}),after=authored.runtime.canvas(def.id),asset={...def,getFacingView:direction=>authored.runtime.view(def.id,direction)},object={x:500,y:600,rotation:0,scale:1};
 assert.deepEqual(after.draws[0].slice(1),draw,'Anchor metadata must not move or resample pixels inside the native canvas');
 const placement=furnitureFacingPlacement(asset,object,undefined,{includeImage:false}),box=furnitureFacingBoxes(asset,object)[0],picturedBaseX=placement.x+rect.x+.8*rect.w;
 assert(Math.abs(picturedBaseX-(box.x+box.w/2))<1e-9,'The actual pictured base must sit at the unchanged physical centre');
 assert.equal(placement.groundCenter.x,box.x+box.w/2);assert.equal(placement.view.footCenter.y,physical.y);
 assert.equal(original.runtime.stats.sourceLoads,0);assert.equal(authored.runtime.stats.sourceLoads,0);
 original.runtime.clear();authored.runtime.clear();
});

test('simultaneous item warmups share one owner load and fulfilled promises retain no source image',async()=>{
 const f=fixture(),defs=['bed','sofa','lava-lamp'].map(slot=>f.def(0,slot));
 const pending=defs.map(def=>f.runtime.ensureAsset(def.id));assert.equal(f.runtime.stats.pendingLoads,1);assert.equal(f.loads.length,1);
 assert.deepEqual(await Promise.all(pending),[undefined,undefined,undefined]);assert.equal(f.runtime.stats.pendingLoads,0);assert.equal(f.runtime.stats.canvasEntries,3);
 for(const def of defs)assert.equal(f.runtime.canvas(def.id).draws[0][0].name,'bach.webp');
 f.runtime.clear();assert.equal(f.images[0].closed,1);
});

test('evicted full sources and native canvases reload correctly on re-entry without once-resolved image promises',async()=>{
 const f=fixture({maxSources:1,maxCanvases:1}),a=f.def(0),b=f.def(1);
 const firstPromise=f.runtime.ensureAsset(a.id);assert.equal(await firstPromise,undefined);const first=f.runtime.canvas(a.id);
 await f.runtime.ensureAsset(b.id);assert.equal(first.width,1);assert.equal(f.images[0].closed,1);
 const secondPromise=f.runtime.ensureAsset(a.id);assert.notStrictEqual(secondPromise,firstPromise);assert.equal(await secondPromise,undefined);
 const restored=f.runtime.canvas(a.id);assert.notStrictEqual(restored,first);assert.equal(restored.width,a.w);assert.equal(restored.draws[0][0].name,'bach.webp');assert.equal(restored.draws[0][0].closed,0);
 assert.equal(f.loads.filter(load=>load.owner===a.owner).length,2);assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.stats.canvasEntries,1);f.runtime.clear();
});

test('native crops complete before simultaneous owners are trimmed to the four-source budget',async()=>{
 const f=fixture(),defs=Array.from({length:6},(_,index)=>f.def(index));
 await Promise.all(defs.map(def=>f.runtime.ensureAsset(def.id)));
 assert.equal(f.runtime.stats.sourceEntries,4);assert.equal(f.runtime.stats.pendingLoads,0);assert.equal(f.runtime.stats.canvasEntries,6);
 assert.equal(f.images.filter(source=>source.closed).length,2);
 for(const def of defs)assert.equal(f.runtime.canvas(def.id).draws[0][0].name,def.owner+'.webp');
 const loads=f.loads.length;await f.runtime.ensureAsset(defs[0].id);assert.equal(f.loads.length,loads,'A retained complete native crop does not need its evicted source sheet');f.runtime.clear();
});

test('distinct atlas warmups queue behind four active decodes while queued crops share one request',async()=>{
 const loads=[],images=[];let active=0,peak=0;
 const f=fixture({loadImage(file){
  active++;peak=Math.max(peak,active);
  return new Promise(resolve=>loads.push({file,resolve(){active--;const full=image(file);images.push(full);resolve(full);}}));
 }}),defs=Array.from({length:6},(_,index)=>f.def(index)),pending=defs.map(def=>f.runtime.ensureAsset(def.id));
 assert.equal(loads.length,4);assert.equal(f.runtime.stats.activeLoads,4);assert.equal(f.runtime.stats.queuedLoads,2);assert.equal(f.runtime.stats.pendingLoads,6);assert.equal(f.runtime.stats.sourceLoads,4);assert.equal(f.runtime.stats.maxConcurrentLoads,4);
 const sofa=f.def(4,'sofa'),sameOwner=f.runtime.ensureAsset(sofa.id);
 assert.strictEqual(sameOwner,pending[4]);assert.equal(f.runtime.stats.queuedLoads,2);
 for(let i=0;i<6;i++){loads[i].resolve();await new Promise(resolve=>setImmediate(resolve));}
 assert.deepEqual(await Promise.all([...pending,sameOwner]),Array(7).fill(undefined));
 assert.equal(peak,4);assert.equal(loads.length,6);assert.equal(f.runtime.stats.sourceLoads,6);assert.equal(f.runtime.stats.activeLoads,0);assert.equal(f.runtime.stats.queuedLoads,0);assert.equal(f.runtime.stats.pendingLoads,0);
 assert.equal(f.runtime.stats.sourceEntries,4);assert.equal(images.filter(full=>full.closed).length,2);assert.equal(f.runtime.stats.canvasEntries,7);assert.equal(f.runtime.canvas(sofa.id).draws[0][0].name,sofa.owner+'.webp');f.runtime.clear();
});

test('a rejected or synchronously thrown queued load frees its slot and permits an explicit retry',async()=>{
 const loads=[];let throwNext=false;
 const f=fixture({maxConcurrentLoads:1,loadImage(file){
  if(throwNext){throwNext=false;throw Error('Synchronous decode failure');}
  return new Promise((resolve,reject)=>loads.push({file,resolve:()=>resolve(image(file)),reject}));
 }}),a=f.def(0),b=f.def(1),c=f.def(2);
 const failed=f.runtime.ensureAsset(a.id),next=f.runtime.ensureAsset(b.id);
 assert.equal(loads.length,1);assert.equal(f.runtime.stats.queuedLoads,1);
 loads[0].reject(Error('Asynchronous decode failure'));await assert.rejects(failed,/Asynchronous/);
 assert.equal(loads.length,2);assert.equal(f.runtime.stats.activeLoads,1);assert.equal(f.runtime.stats.queuedLoads,0);
 throwNext=true;const thrown=f.runtime.ensureAsset(c.id),retry=f.runtime.ensureAsset(a.id),thrownCheck=assert.rejects(thrown,/Synchronous/);
 loads[1].resolve();await next;await thrownCheck;
 assert.equal(loads.length,3);assert.equal(f.runtime.stats.activeLoads,1);assert.equal(f.runtime.stats.queuedLoads,0);
 loads[2].resolve();assert.equal(await retry,undefined);assert.equal(f.runtime.stats.activeLoads,0);assert.equal(f.runtime.stats.pendingLoads,0);assert.equal(f.runtime.stats.sourceLoads,4);
 assert.equal(f.runtime.canvas(a.id).draws[0][0].name,a.owner+'.webp');f.runtime.clear();
});

test('clear cancels unstarted loads but retains an old decode slot until its late image is released',async()=>{
 const loads=[],f=fixture({maxConcurrentLoads:1,loadImage(file){return new Promise(resolve=>loads.push({file,resolve}));}}),a=f.def(0),b=f.def(1),c=f.def(2);
 const old=f.runtime.ensureAsset(a.id),cancelledB=f.runtime.ensureAsset(b.id),cancelledC=f.runtime.ensureAsset(c.id);
 assert.equal(loads.length,1);assert.equal(f.runtime.stats.queuedLoads,2);
 f.runtime.clear();assert.deepEqual(await Promise.all([cancelledB,cancelledC]),[undefined,undefined]);assert.equal(f.runtime.stats.queuedLoads,0);assert.equal(f.runtime.stats.pendingLoads,0);assert.equal(f.runtime.stats.activeLoads,1);
 const fresh=f.runtime.ensureAsset(a.id);assert.equal(loads.length,1);assert.equal(f.runtime.stats.queuedLoads,1);
 const late=image('late-generation.webp');loads[0].resolve(late);assert.equal(await old,undefined);
 assert.equal(late.closed,1);assert.equal(loads.length,2);assert.equal(f.runtime.stats.sourceEntries,0);assert.equal(f.runtime.stats.canvasEntries,0);assert.equal(f.runtime.stats.activeLoads,1);assert.equal(f.runtime.stats.queuedLoads,0);
 const full=image('fresh-generation.webp');loads[1].resolve(full);assert.equal(await fresh,undefined);
 assert.equal(f.runtime.canvas(a.id).draws[0][0].name,'fresh-generation.webp');assert.equal(f.runtime.stats.nativeCompilations,1);assert.equal(f.runtime.stats.activeLoads,0);assert.equal(f.runtime.stats.pendingLoads,0);f.runtime.clear();
});

test('the compact overview shares the decode queue and keeps its deduplicated warmup promise',async()=>{
 const collections=APARTMENT_COLLECTIONS.slice(0,6),directionManifest=directionsFor(collections),overview=overviewFor(collections),loads=[];
 directionManifest.overview=overview;
 const f=fixture({directionManifest,maxConcurrentLoads:1,loadImage(file){return new Promise(resolve=>loads.push({file,resolve:()=>resolve(image(file,file===overview.file?overview.width:400,file===overview.file?overview.height:800))}));}});
 const native=f.runtime.ensureAsset(f.def(0).id),preview=f.runtime.warmOverview(),next=f.runtime.ensureAsset(f.def(1).id);
 assert.strictEqual(f.runtime.warmOverview(),preview);assert.equal(loads.length,1);assert.equal(f.runtime.stats.activeLoads,1);assert.equal(f.runtime.stats.queuedLoads,2);assert.equal(f.runtime.stats.overviewLoads,0);
 loads[0].resolve();await native;assert.equal(loads[1].file,overview.file);assert.equal(f.runtime.stats.overviewLoads,1);assert.equal(f.runtime.stats.queuedLoads,1);
 loads[1].resolve();assert.equal(await preview,undefined);assert.equal(f.runtime.stats.overviewReady,true);assert.equal(loads.length,3);
 loads[2].resolve();await next;assert.equal(f.runtime.stats.activeLoads,0);assert.equal(f.runtime.stats.queuedLoads,0);assert.equal(f.runtime.stats.sourceLoads,2);f.runtime.clear();
});

test('native canvas count and pixel budgets stay bounded while visiting every home',async()=>{
 const f=fixture({maxSources:2,maxCanvases:3,maxCanvasPixels:50000});
 for(let visit=0;visit<5;visit++)for(let owner=0;owner<6;owner++)for(const slot of ['bed','sofa','lava-lamp']){
  await f.runtime.ensureAsset(f.def(owner,slot).id);
  const stats=f.runtime.stats;assert(stats.sourceEntries<=2);assert(stats.canvasEntries<=3);assert(stats.canvasPixels<=50000);
 }
 f.runtime.clear();assert.equal(f.runtime.stats.canvasPixels,0);assert.equal(f.runtime.stats.canvasEntries,0);assert.equal(f.runtime.stats.sourceEntries,0);assert(f.canvases.every(canvas=>canvas.width===1&&canvas.height===1));assert(f.images.every(source=>source.closed===1));
});

test('failed loads are retryable while preview artwork remains available',async()=>{
 let attempts=0;const full=image('recovered.webp'),f=fixture({loadImage:()=>++attempts===1?Promise.reject(Error('Temporary network failure')):Promise.resolve(full)}),def=f.def(),preview=f.runtime.canvas(def.id);
 await assert.rejects(f.runtime.ensureAsset(def.id),/Temporary/);assert.equal(f.runtime.stats.pendingLoads,0);assert.strictEqual(f.runtime.canvas(def.id),preview);
 await f.runtime.ensureAsset(def.id);assert.equal(attempts,2);assert.equal(f.runtime.canvas(def.id).draws[0][0].name,'recovered.webp');f.runtime.clear();
});

test('clearing while a source loads disposes its late image and permits a fresh warmup',async()=>{
 const resolvers=[],f=fixture({loadImage:()=>new Promise(resolve=>resolvers.push(resolve))}),def=f.def(),late=image('late.webp');
 const pending=f.runtime.ensureAsset(def.id);f.runtime.clear();resolvers[0](late);assert.equal(await pending,undefined);assert.equal(late.closed,1);assert.equal(f.runtime.stats.sourceEntries,0);assert.equal(f.runtime.stats.canvasEntries,0);
 const fresh=image('fresh.webp'),next=f.runtime.ensureAsset(def.id);resolvers[1](fresh);await next;assert.equal(f.runtime.canvas(def.id).draws[0][0].name,'fresh.webp');assert.equal(f.runtime.stats.pendingLoads,0);f.runtime.clear();
});

test('facing metadata is stable, uses world-unit foot anchors and does not create images or start loads',()=>{
 const f=fixture({directionManifest:directionsFor(APARTMENT_COLLECTIONS.slice(0,6))}),def=f.def(),south=f.runtime.view(def.id),east=f.runtime.view(def.id,'east');
 assert.strictEqual(east,f.runtime.view(def.id,'east'));assert.equal(east.w,103);assert.equal(east.h,197);assert.equal(east.facing,'east');
 assert.deepEqual(south.footCenter,{x:75,y:103.5});
 const scale=103/50,renderedHeight=90*scale;
 assert(Math.abs(east.footCenter.x-51.5)<1e-10);assert(Math.abs(east.footCenter.y-(197-renderedHeight+.85*renderedHeight))<1e-10);
 assert.equal(f.loads.length,0);assert.equal(f.canvases.length,0);assert.equal(east.ready,false);
 const lamp=f.runtime.view(f.def(0,'lava-lamp').id,'west');assert.equal(lamp.motion.kind,'lava');assert(lamp.motion.mask.every(p=>p[0]>0&&p[0]<1&&p[1]>0&&p[1]<1));assert.equal(f.canvases.length,0);f.runtime.clear();
});

test('each authored facing uses its own source crop and contain size while preserving exact south output',async()=>{
 const f=fixture({directionManifest:directionsFor(APARTMENT_COLLECTIONS.slice(0,6))}),def=f.def(),south=f.runtime.canvas(def.id),southDraw=south.draws[0].slice();
 for(const facing of ['north','east','west']){
  await f.runtime.ensureAsset(def.id,facing);const view=f.runtime.view(def.id,facing),native=f.runtime.canvas(def.id,facing),draw=native.draws[0];
  assert.equal(draw[0].name,def.owner+'-'+facing+'.webp');assert.equal(native.width,view.w);assert.equal(native.height,view.h);assert.equal(view.ready,true);
  assert(Math.abs(draw[7]/draw[8]-draw[3]/draw[4])<1e-10,'The authored side image is contained without stretching');
 }
 assert.strictEqual(f.runtime.canvas(def.id),south);assert.deepEqual(south.draws[0],southDraw);assert.equal(f.loads.some(call=>call.file==='bach.webp'),false);f.runtime.clear();
});

test('N/E/W can share one direction sheet and simultaneous warmups fetch it exactly once',async()=>{
 const calls=[],directionManifest=directionsFor(APARTMENT_COLLECTIONS.slice(0,6),{separate:false}),f=fixture({directionManifest,loadImage:async file=>{calls.push(file);return image(file,1200,800);}}),def=f.def();
 assert.deepEqual(await Promise.all(['north','east','west'].map(facing=>f.runtime.ensureAsset(def.id,facing))),[undefined,undefined,undefined]);
 assert.deepEqual(calls,['bach-directions.webp']);assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.stats.canvasEntries,3);
 const sourceXs=['north','east','west'].map(facing=>f.runtime.canvas(def.id,facing).draws[0][1]);assert.deepEqual(sourceXs,[5,405,805]);f.runtime.clear();
});

test('rotated native views and their source sheets recover after eviction within the shared budgets',async()=>{
 const f=fixture({directionManifest:directionsFor(APARTMENT_COLLECTIONS.slice(0,6)),maxSources:1,maxCanvases:1}),def=f.def();
 const promises=[],canvases=[];
 for(const facing of ['east','north','west','east']){promises.push(f.runtime.ensureAsset(def.id,facing));await promises.at(-1);canvases.push(f.runtime.canvas(def.id,facing));assert.equal(f.runtime.stats.sourceEntries,1);assert.equal(f.runtime.stats.canvasEntries,1);}
 assert.notStrictEqual(promises[0],promises[3]);assert.notStrictEqual(canvases[0],canvases[3]);assert.equal(canvases[0].width,1);assert.equal(canvases[3].draws[0][0].closed,0);
 assert.equal(f.loads.filter(call=>call.file==='bach-east.webp').length,2);assert(f.images.slice(0,-1).every(source=>source.closed===1));f.runtime.clear();
});

test('drawing may warm a selected view but repeated metadata reads and failed draws do not create request loops',async()=>{
 let attempts=0;const f=fixture({directionManifest:directionsFor(APARTMENT_COLLECTIONS.slice(0,6)),loadImage:file=>++attempts===1?Promise.reject(Error('Temporarily unavailable')):Promise.resolve(image(file))}),def=f.def(),view=f.runtime.view(def.id,'east');
 for(let i=0;i<100;i++)assert.strictEqual(f.runtime.view(def.id,'east'),view);
 assert.equal(attempts,0);assert.equal(f.canvases.length,0);
 const preview=view.canvas;assert.equal(preview.draws.length,0,'No incorrect south-facing substitution is drawn');
 await new Promise(resolve=>setImmediate(resolve));
 for(let i=0;i<100;i++)assert.strictEqual(view.canvas,preview);
 assert.equal(attempts,1);await f.runtime.ensureAsset(def.id,'east');assert.equal(attempts,2);assert.notStrictEqual(view.canvas,preview);assert.equal(view.ready,true);f.runtime.clear();
});

test('public cardinal APIs return stable metadata and lazily load only a visible selected facing',async()=>{
 const collections=APARTMENT_COLLECTIONS.slice(0,1),calls=[],f=canvasFactory(),assets=await registerApartmentCollections((id,name,group,w,h,draw,boxes,layer)=>({id,name,group,w,h,draw,boxes,layer}),{
  definitions:collections[0].assets,manifest:manifestFor(collections),directionManifest:directionsFor(collections),createCanvas:f.createCanvas,
  loadImage:async url=>{const file=new URL(url).pathname.split('/').at(-1);calls.push(file);return image(file,file.endsWith('-thumb.webp')?100:400,file.endsWith('-thumb.webp')?200:800);}
 });
 const bed=assets.find(a=>a.slot==='bed'),view=bed.getFacingView('east',{image:false});
 assert.strictEqual(view,bed.getFacingView('east'));assert.deepEqual(calls,['bach-thumb.webp']);assert.equal(f.canvases.length,0);
 const preview=bed.getFacingImage('east');assert.equal(preview.draws.length,0);assert.equal(await bed.ensureFull('east'),undefined);
 assert.deepEqual(calls,['bach-thumb.webp','bach-east.webp']);assert.strictEqual(bed.getFacingView('east'),view);assert.equal(bed.getFacingImage('east').draws[0][0].name,'bach-east.webp');
 assert.equal(bed.canvas.draws[0][0].name,'bach-thumb.webp');clearApartmentCollectionCache();
});

test('500 real far views use one preview atlas and never compile native canvases or request full sheets',async()=>{
 const f=largeFixture(),roster=createFurnitureFacingSourceRoster();
 for(let frame=0;frame<60;frame++){
  roster.update(f.entries,{pixelScale:.08});
  for(const entry of f.entries)roster.source(entry.asset,entry.placement);
  if(frame===0)await new Promise(resolve=>setImmediate(resolve));
 }
 assert.equal(roster.stats.nativeViews,0);assert.equal(f.runtime.stats.canvasBuilds,0);assert.equal(f.runtime.stats.nativeCompilations,0);assert.equal(f.runtime.stats.sourceLoads,0);assert.equal(f.canvases.length,0);
 assert.deepEqual(f.loads,[{file:'overview.webp',owner:'__overview__'}]);assert.equal(f.runtime.stats.overviewLoads,1);assert(f.runtime.stats.overviewPixels<=4*1024*1024);
 for(const entry of f.entries){const source=roster.source(entry.asset,entry.placement);assert.equal(source.native,false);assert.equal(source.image.name,'overview.webp');assert(source.sw<=32&&source.sh<=32);assert.strictEqual(source,roster.source(entry.asset,entry.placement));}
 f.runtime.clear();assert(f.images.every(source=>source.closed===1));
});

test('the real 500-view close roster settles without repeated requests or compilations beyond cache capacity',async()=>{
 const f=largeFixture(),roster=createFurnitureFacingSourceRoster(),options={pixelScale:.8,focus:{x:1200,y:900}};
 roster.update(f.entries,options);for(const entry of f.entries)roster.source(entry.asset,entry.placement);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(roster.stats.nativeViews,192);assert(f.runtime.stats.sourceEntries<=4);assert(f.runtime.stats.canvasPixels<=4*1024*1024);assert.equal(f.runtime.stats.canvasEntries,192);
 const requests=f.runtime.stats.sourceLoads,compiles=f.runtime.stats.nativeCompilations,builds=f.runtime.stats.canvasBuilds;
 assert.equal(compiles,192);
 for(let frame=0;frame<60;frame++){
  const entries=frame%2?f.entries:f.entries.slice().reverse();roster.update(entries,options);
  for(const entry of entries)roster.source(entry.asset,entry.placement);
 }
 assert.equal(f.runtime.stats.sourceLoads,requests);assert.equal(f.runtime.stats.nativeCompilations,compiles);assert.equal(f.runtime.stats.canvasBuilds,builds);assert.equal(f.runtime.stats.canvasEntries,192);assert.equal(f.runtime.stats.overviewLoads,1);f.runtime.clear();
});

test('a selected evicted South view recovers once, while generic library drawing stays allocation-free',async()=>{
 const f=fixture({maxSources:1,maxCanvases:1}),a=f.def(0),b=f.def(1),draws=[],c={drawImage(...args){draws.push(args);}};
 for(const def of f.definitions)for(let count=0;count<3;count++)f.runtime.draw(def.id,c);
 assert.equal(f.canvases.length,0);assert.equal(f.loads.length,0);assert(draws.every(args=>args.length===9));
 await f.runtime.ensureAsset(a.id);const first=f.runtime.canvas(a.id);await f.runtime.ensureAsset(b.id);assert.equal(first.width,1);
 const before=f.loads.length;f.runtime.drawSource(a.id,'south',{native:true});await new Promise(resolve=>setImmediate(resolve));
 const native=f.runtime.drawSource(a.id,'south',{native:true});assert.equal(native.native,true);assert.equal(native.image.draws[0][0].name,'bach.webp');assert.equal(f.loads.length,before+1);
 for(let frame=0;frame<60;frame++)assert.strictEqual(f.runtime.drawSource(a.id,'south',{native:true}),native);
 assert.equal(f.loads.length,before+1);assert.equal(f.runtime.stats.canvasEntries,1);f.runtime.clear();
});

test('direct thumbnail crops and native canvases retain the identical contain rectangle and physical anchor',async()=>{
 const f=fixture(),def=f.def(0,'lava-lamp'),view=f.runtime.view(def.id),anchor={...view.footCenter},preview=f.runtime.drawSource(def.id,'south',{native:false});
 const previewRect=[preview.dx,preview.dy,preview.dw,preview.dh];assert.equal(f.loads.length,0);assert.equal(f.canvases.length,0);
 await f.runtime.ensureAsset(def.id);const native=f.runtime.drawSource(def.id,'south',{native:true}),nativeDraw=native.image.draws[0];
 assert.deepEqual(previewRect,nativeDraw.slice(5));assert.deepEqual(view.footCenter,anchor);assert.deepEqual([native.dx,native.dy,native.dw,native.dh],[0,0,view.w,view.h]);
 const commands=[],placement={view,x:100,y:200,scaleX:2,scaleY:2};drawFurnitureFacingSource({drawImage(...args){commands.push(args);}},placement,preview);
 assert.deepEqual(commands[0].slice(5),[100+preview.dx*2,200+preview.dy*2,preview.dw*2,preview.dh*2]);f.runtime.clear();
});

test('the interior South view getter can warm imagery without changing the generic South canvas policy',async()=>{
 const f=fixture(),def=f.def(),plain=f.runtime.canvas(def.id);assert.equal(f.loads.length,0);
 const view=f.runtime.view(def.id);assert.strictEqual(view.canvas,plain);assert.equal(f.loads.length,1);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(view.canvas.draws[0][0].name,'bach.webp');assert.equal(f.loads.length,1);f.runtime.clear();
});

test('exact legacy frame IDs are supported in both South and direction manifests',async()=>{
 const def={id:'props-real-legacy-bench',owner:'legacy-group',w:150,h:100,boxes:[{x:10,y:70,w:130,h:25}]},frame={id:def.id,slot:'unused',x:5,y:8,w:90,h:70},f=canvasFactory(),loads=[];
 const runtime=createApartmentCollectionRuntime({definitions:[def],manifest:{collections:[{owner:def.owner,file:'legacy-south.webp',width:400,height:800,cells:[frame]}]},directionManifest:{collections:[{owner:def.owner,views:{east:{file:'legacy-east.webp',width:400,height:800,cells:[{...frame,viewWidth:90,viewHeight:180,footCenter:[.5,.85]}]}}}]},thumbnails:new Map([[def.owner,image('legacy-preview',100,200)]]),createCanvas:f.createCanvas,loadImage:async file=>{loads.push(file);return image(file);}});
 assert.equal(runtime.view(def.id).id,def.id);assert.equal(runtime.view(def.id,'east').id,def.id+'|east');await runtime.ensureAsset(def.id,'east');assert.equal(runtime.canvas(def.id,'east').draws[0][0].name,'legacy-east.webp');assert.deepEqual(loads,['legacy-east.webp']);runtime.clear();
});

test('the compact overview warmup is deduplicated, resolves without an image and releases its backing on clear',async()=>{
 const f=largeFixture(),first=f.runtime.warmOverview();assert.strictEqual(f.runtime.warmOverview(),first);assert.equal(await first,undefined);
 assert.equal(f.runtime.stats.overviewReady,true);assert.equal(f.runtime.stats.overviewLoads,1);assert.equal(f.runtime.stats.sourceLoads,0);
 f.runtime.clear();assert.equal(f.images[0].closed,1);assert.equal(f.runtime.stats.overviewPixels,0);assert.equal(f.runtime.stats.overviewReady,false);
 const next=f.runtime.warmOverview();assert.notStrictEqual(next,first);await next;assert.equal(f.runtime.stats.overviewLoads,2);f.runtime.clear();
});

test('an oversized preview image is released and cannot cause an automatic request loop',async()=>{
 const collections=APARTMENT_COLLECTIONS.slice(0,1),directionManifest=directionsFor(collections),overview=overviewFor(collections),tooBig=image('oversized-overview',4096,4096);let requests=0;
 directionManifest.overview=overview;
 const f=fixture({definitions:collections[0].assets,manifest:manifestFor(collections),directionManifest,loadImage:async()=>{requests++;return tooBig;}}),def=collections[0].assets[0];
 await f.runtime.warmOverview();assert.equal(tooBig.closed,1);assert.equal(f.runtime.stats.overviewReady,false);
 for(let frame=0;frame<60;frame++)assert.equal(f.runtime.drawSource(def.id,'east',{native:false}).image,null);
 assert.equal(requests,1);assert.equal(f.runtime.stats.sourceLoads,0);assert.equal(f.canvases.length,0);f.runtime.clear();
});
