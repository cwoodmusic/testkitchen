import test from 'node:test';
import assert from 'node:assert/strict';
import {LEGACY_FURNITURE_ASSETS,LEGACY_FURNITURE_BOARDS} from './legacy-furniture-definitions.mjs';
import {registerLegacyFurnitureFacings,registerAuthoredSeatFacings,getLegacyFurnitureFacingRuntimeStats,clearLegacyFurnitureFacingCache} from './legacy-furniture-facings.mjs';
import {furnitureFacingPlacement,furnitureFacingBoxes,furnitureFootCenter} from './furniture-facing.mjs';

const directions=['south','west','north','east'];
function image(name,width=1024,height=2048){return {name,width,height,closed:0,close(){this.closed++;}};}
function canvasFactory(){const canvases=[];return {canvases,createCanvas(){const canvas={width:0,height:0,draws:[],scales:[]};canvas.getContext=()=>({drawImage(...args){canvas.draws.push(args);},scale(...args){canvas.scales.push(args);}});canvases.push(canvas);return canvas;}};}
function sourceMetadata(definitions=LEGACY_FURNITURE_ASSETS){
 const ownerById=new Map(LEGACY_FURNITURE_BOARDS.flatMap(board=>board.ids.map(id=>[id,board.id])));
 ownerById.set('showroom-midcentury-studio-bed',ownerById.get('apartment-teak-bed'));ownerById.set('showroom-midcentury-studio-sofa',ownerById.get('apartment-box-sofa'));
 const boards=new Map();for(const def of definitions){const owner=ownerById.get(def.id)||'test-board';if(!boards.has(owner))boards.set(owner,[]);boards.get(owner).push(def);}
 const aliases={'showroom-midcentury-studio-bed':'apartment-teak-bed','showroom-midcentury-studio-sofa':'apartment-box-sofa'};
 const frameIndex=(defs,def)=>defs.filter(d=>!aliases[d.id]).findIndex(d=>d.id===(aliases[def.id]||def.id));
 const collections=[...boards].map(([owner,defs])=>({owner,views:Object.fromEntries(directions.slice(1).map(facing=>[facing,{file:owner+'-'+facing+'.webp',width:1024,height:2048,cells:defs.map((def,index)=>({id:def.id,x:frameIndex(defs,def)%4*256+12,y:Math.floor(frameIndex(defs,def)/4)*256+8,w:160,h:220,viewWidth:facing==='north'?def.w:Math.max(20,Math.ceil(def.w*.6)),viewHeight:def.h,worldFootCenter:{x:23,y:def.h-17}}))}]))}));
 const cells=definitions.flatMap((def,index)=>directions.map((facing,dir)=>({id:def.id,facing,x:(index*4+dir)%32*32,y:Math.floor((index*4+dir)/32)*32,w:32,h:32})));
 return {version:1,collections,overview:{file:'overview.webp',width:1024,height:Math.ceil(cells.length/32)*32,cells}};
}
function fixture({definitions=LEGACY_FURNITURE_ASSETS,loadImage,...options}={}){
 const f=canvasFactory(),catalog=new Map(),records=new Map(),loads=[],images=[];
 for(const def of definitions){
  const canvas=image('original-'+def.id,def.w,def.h),promise=Promise.resolve(canvas),record={canvas,promise,getters:0,ensures:[],draws:0};
  const asset={id:def.id,name:def.name,pack:'unchanged-pack',facing:def.baseFacing||'south',w:def.w,h:def.h,boxes:def.boxes,layer:'objects',draw(context){record.draws++;context.drawImage(canvas,0,0,asset.w,asset.h);},ensureFull(...args){record.ensures.push({thisValue:this,args});return promise;}};
  Object.defineProperty(asset,'canvas',{enumerable:true,get(){record.getters++;return canvas;}});catalog.set(def.id,asset);records.set(def.id,record);
 }
 const directionManifest=sourceMetadata(definitions);
 const imageLoader=loadImage??(async url=>{const file=new URL(url).pathname.split('/').at(-1);loads.push(file);const dimensions=file==='overview.webp'?directionManifest.overview:{width:1024,height:2048};const source=image(file,dimensions.width,dimensions.height);images.push(source);return source;});
 return {...f,catalog,records,definitions,directionManifest,loads,images,register:()=>registerLegacyFurnitureFacings(catalog,{definitions,directionManifest,loadImage:imageLoader,createCanvas:f.createCanvas,...options})};
}

test('all 293 original assets receive exact-ID cardinal providers after only one compact overview load',async()=>{
 const f=fixture(),before=new Map([...f.catalog].map(([id,a])=>[id,{draw:a.draw,boxes:a.boxes,w:a.w,h:a.h,pack:a.pack,facing:a.facing,canvasDescriptor:Object.getOwnPropertyDescriptor(a,'canvas')}]));
 const assets=await f.register();assert.equal(assets.length,293);assert.equal(f.catalog.size,293);assert.deepEqual(f.loads,['overview.webp']);assert.equal(f.canvases.length,0);
 for(const a of assets){
  const old=before.get(a.id),r=f.records.get(a.id);assert.strictEqual(a.draw,old.draw);assert.strictEqual(a.boxes,old.boxes);assert.equal(a.w,old.w);assert.equal(a.h,old.h);assert.equal(a.pack,old.pack);assert.equal(a.facing,old.facing);
  assert.deepEqual(Object.getOwnPropertyDescriptor(a,'canvas'),old.canvasDescriptor);assert.equal(r.getters,0);assert.equal(r.ensures.length,0);
  assert.equal(a.legacyFurnitureFacingProvider,'legacy-board');assert.match(a.legacyFurnitureFacingOwner,/^legacy-\d\d$/);
  for(const direction of directions){const view=a.getFacingView(direction,{image:false});assert.strictEqual(view,a.getFacingView(direction));assert.equal(view.id,a.id+(direction==='south'?'':'|'+direction));assert(view.w>0&&view.h>0);}
  assert.deepEqual(a.getFacingView().footCenter,furnitureFootCenter(a));
 }
 assert.equal(getLegacyFurnitureFacingRuntimeStats().sourceLoads,0);assert.equal(getLegacyFurnitureFacingRuntimeStats().canvasEntries,0);clearLegacyFurnitureFacingCache();
});

test('South draw/getter/ensureFull and rotation-zero bounds retain the original artwork and arithmetic',async()=>{
 const f=fixture({definitions:LEGACY_FURNITURE_ASSETS.slice(0,9)}),a=f.catalog.get('furniture-0-180'),draw=a.draw,originalGetter=Object.getOwnPropertyDescriptor(a,'canvas').get,r=f.records.get(a.id);
 await f.register();assert.strictEqual(a.draw,draw);assert.strictEqual(Object.getOwnPropertyDescriptor(a,'canvas').get,originalGetter);
 assert.strictEqual(a.ensureFull(),r.promise);assert.strictEqual(a.ensureFull('south'),r.promise);assert(r.ensures.every(call=>call.thisValue===a&&call.args.length===0));
 assert.strictEqual(a.getFacingView().canvas,r.canvas);assert.strictEqual(a.getFacingImage('south'),r.canvas);
 const source=a.getFacingDrawSource('south',{native:true});assert.strictEqual(source,a.getFacingDrawSource('south',{native:true}));assert.strictEqual(source.image,r.canvas);assert.deepEqual([source.sx,source.sy,source.sw,source.sh,source.dx,source.dy,source.dw,source.dh],[0,0,a.w,a.h,0,0,a.w,a.h]);
 const p=furnitureFacingPlacement(a,{x:900,y:700,rotation:0});assert.strictEqual(p.image,r.canvas);assert.deepEqual(p.bounds,{x:900-a.w/2,y:700-a.h,w:a.w,h:a.h});
 const c={calls:[],drawImage(...args){this.calls.push(args);}};a.draw(c);assert.deepEqual(c.calls,[[r.canvas,0,0,a.w,a.h]]);assert.equal(f.loads.length,1);clearLegacyFurnitureFacingCache();
});

test('every overview direction is nonblank without canvas/native loads, including both historical aliases',async()=>{
 const f=fixture();await f.register();
 for(const a of f.catalog.values())for(const direction of directions){const source=a.getFacingDrawSource(direction,{native:false});assert.equal(source.quality,'overview');assert.equal(source.native,false);assert.equal(source.image.name,'overview.webp');assert.equal(source.dw,a.getFacingView(direction).w);assert.equal(source.dh,a.getFacingView(direction).h);}
 for(const id of ['showroom-midcentury-studio-bed','showroom-midcentury-studio-sofa'])assert.equal(f.catalog.get(id).getFacingView('east').id,id+'|east');
 assert.equal(f.canvases.length,0);assert.deepEqual(f.loads,['overview.webp']);assert([...f.records.values()].every(record=>record.getters===0));clearLegacyFurnitureFacingCache();
});

test('authored native directions load only requested boards and metadata reads never warm images',async()=>{
 const f=fixture();await f.register();const a=f.catalog.get('furniture-0-180'),b=f.catalog.get('furniture-1-180');
 for(let i=0;i<100;i++)for(const direction of directions)a.getFacingView(direction,{image:false});assert.deepEqual(f.loads,['overview.webp']);
 const east=a.getFacingView('east');assert.deepEqual(east.footCenter,{x:23,y:a.h-17});
 assert.deepEqual(await Promise.all([a.ensureFull('east'),b.ensureFull('east')]),[undefined,undefined]);assert.deepEqual(f.loads,['overview.webp','legacy-01-east.webp']);
 const native=a.getFacingImage('east');assert.equal(native.draws[0][0].name,'legacy-01-east.webp');assert.equal(native.width,east.w);assert.equal(native.height,east.h);assert.equal(a.getFacingDrawSource('east',{native:true}).native,true);
 assert.equal(f.records.get(a.id).getters,0);assert.equal(f.records.get(a.id).ensures.length,0);assert.equal(a.getFacingView('invalid'),null);assert.equal(a.getFacingImage('invalid'),null);assert.equal(a.getFacingDrawSource('invalid'),null);await assert.rejects(a.ensureFull('invalid'),/Unknown legacy/);clearLegacyFurnitureFacingCache();
});

test('all legacy native directions respect bounded source, canvas-count and pixel LRU limits',async()=>{
 const f=fixture({maxSources:2,maxCanvases:3,maxCanvasPixels:900000});await f.register();let first;
 for(const a of f.catalog.values())for(const direction of directions.slice(1)){
  await a.ensureFull(direction);const canvas=a.getFacingImage(direction);first??=canvas;assert.equal(canvas.width,Math.ceil(a.getFacingView(direction).w));
  const stats=getLegacyFurnitureFacingRuntimeStats();assert(stats.sourceEntries<=2);assert(stats.canvasEntries<=3);assert(stats.canvasPixels<=900000);
 }
 assert.equal(first.width,1);assert(f.images.filter(source=>source.closed).length>20);const a=f.catalog.values().next().value;await a.ensureFull('west');assert.equal(a.getFacingImage('west').draws[0][0].closed,0);
 clearLegacyFurnitureFacingCache();assert.equal(getLegacyFurnitureFacingRuntimeStats().canvasPixels,0);assert(f.images.every(source=>source.closed===1));
});

test('explicit cache clearing reloads only the overview and never exposes the synthetic South sentinel',async()=>{
 const f=fixture();await f.register();const a=f.catalog.values().next().value,source=a.getFacingDrawSource('south',{native:false});assert(source.image);clearLegacyFurnitureFacingCache();
 assert.equal(source.image,null);assert.equal(a.getFacingDrawSource('south',{native:false}),null);assert.deepEqual(f.loads,['overview.webp','overview.webp']);
 await new Promise(resolve=>setImmediate(resolve));const restored=a.getFacingDrawSource('south',{native:false});assert.equal(restored.quality,'overview');assert.equal(restored.image.name,'overview.webp');assert.equal(f.canvases.length,0);assert.equal(f.records.get(a.id).getters,0);clearLegacyFurnitureFacingCache();
});

test('invalid/missing namespaces and failed overview leave old assets untouched',async()=>{
 for(const mutate of [m=>m.collections[0].views.north.cells.pop(),m=>m.collections[0].views.east.cells.push({...m.collections[0].views.east.cells[0]}),m=>{m.collections[0].views.west.cells[0].id='collection-bach-bed';},m=>{m.overview.width=999999;}]){
  const f=fixture({definitions:LEGACY_FURNITURE_ASSETS.slice(0,2)}),original=f.catalog.get(f.definitions[0].id).ensureFull;mutate(f.directionManifest);await assert.rejects(f.register());assert.strictEqual(f.catalog.get(f.definitions[0].id).ensureFull,original);assert.equal(f.canvases.length,0);assert.equal(f.loads.length,0);
 }
 const f=fixture({loadImage:async()=>{throw Error('offline');}}),a=f.catalog.values().next().value,original=a.ensureFull;await assert.rejects(f.register(),/overview could not load/);assert.strictEqual(a.ensureFull,original);assert.equal(a.getFacingView,undefined);
});

function seatingFixture(){
 const f=canvasFactory(),catalog=new Map(),records=new Map();
 for(const family of ['beach-deck-chair','beach-lounger'])for(const [index,facing]of directions.entries()){
  const id=family+'-'+facing,w=index%2?240:150,h=index%2?170:210,canvas=image(id,w,h),r={getters:0,draws:0,ensures:0,promise:Promise.resolve(canvas)};
  const a={id,w,h,facing,authoredFacing:true,pack:'town-leisure-38',boxes:[{x:20,y:h-55,w:w-40,h:40}],draw(c){r.draws++;c.drawImage(canvas,0,0,w,h);},ensureFull(){r.ensures++;return r.promise;}};
  Object.defineProperty(a,'canvas',{get(){r.getters++;return canvas;}});catalog.set(id,a);records.set(id,r);
 }
 return {...f,catalog,records};
}

test('eight preauthored beach chairs preserve relative-zero originals and use correct absolute cardinal sources',async()=>{
 const f=seatingFixture(),old=new Map([...f.catalog].map(([id,a])=>[id,{draw:a.draw,descriptor:Object.getOwnPropertyDescriptor(a,'canvas'),boxes:a.boxes}])),controller=registerAuthoredSeatFacings(f.catalog,{createCanvas:f.createCanvas});
 assert.equal(controller.assets.length,8);assert.equal(f.canvases.length,0);
 for(const a of f.catalog.values()){
  assert.strictEqual(a.draw,old.get(a.id).draw);assert.strictEqual(a.boxes,old.get(a.id).boxes);assert.deepEqual(Object.getOwnPropertyDescriptor(a,'canvas'),old.get(a.id).descriptor);
  const baseline=directions.indexOf(a.facing),family=a.id.replace(/-(south|west|north|east)$/,'');
  for(let n=0;n<4;n++){
   const relative=directions[n],absolute=directions[(baseline+n)%4],target=f.catalog.get(family+'-'+absolute),view=a.getFacingView(relative);
   assert.equal(view.id,a.id+(relative==='south'?'':'|'+relative));assert.equal(view.facing,absolute);assert.equal(view.relativeFacing,relative);assert.equal(view.w,target.w);assert.equal(view.h,target.h);assert.deepEqual(view.footCenter,furnitureFootCenter(target));
   assert.equal(a.getFacingImage(relative).name,target.id);assert.strictEqual(a.ensureFull(relative),f.records.get(target.id).promise);
  }
 }
 const north=f.catalog.get('beach-deck-chair-north');assert.equal(north.getFacingView('south').facing,'north');assert.equal(north.getFacingImage('west').name,'beach-deck-chair-east');
});

test('authored chair overflow uses only eight compact original-draw previews and no native getter or load',()=>{
 const f=seatingFixture(),controller=registerAuthoredSeatFacings(f.catalog,{createCanvas:f.createCanvas});
 for(let pass=0;pass<4;pass++)for(const a of f.catalog.values())for(const direction of directions){const source=a.getFacingDrawSource(direction,{native:false});assert(source.image);assert.equal(source.native,false);assert.equal(source.quality,'thumbnail');assert(Math.max(source.image.width,source.image.height)<=160);}
 assert.equal(f.canvases.length,8);assert.equal(controller.stats.previewEntries,8);assert(controller.stats.previewPixels<=8*160*160);assert([...f.records.values()].every(r=>r.getters===0&&r.ensures===0&&r.draws===1));
 controller.clear();assert.equal(controller.stats.previewEntries,0);assert.equal(controller.stats.previewPixels,0);assert(f.canvases.every(c=>c.width===1&&c.height===1));
});

function addSouthOverrides(f,ids){
 for(const id of ids){const board=f.directionManifest.collections.find(c=>c.views.north.cells.some(cell=>cell.id===id));
  board.views.south??={file:board.owner+'-south-corrected.webp',width:1024,height:2048,cells:[]};
  board.views.south.cells.push({id,x:44,y:92,w:160,h:220});
 }
}
test('partial South corrections reach native game/export APIs and library draws without replacing original getters or physics',async()=>{
 const ids=['apartment-corner-kitchen-counter','beach-lifeguard-chair'],definitions=LEGACY_FURNITURE_ASSETS.filter(d=>[...ids,'apartment-teak-bed'].includes(d.id)),f=fixture({definitions}),before=new Map([...f.catalog].map(([id,a])=>[id,{draw:a.draw,descriptor:Object.getOwnPropertyDescriptor(a,'canvas'),boxes:a.boxes,w:a.w,h:a.h,physical:[0,90,180,270].map(rotation=>furnitureFacingBoxes(a,{x:713,y:905,scale:.37,rotation}))}]));
 addSouthOverrides(f,ids);await f.register();assert.deepEqual(f.loads,['overview.webp']);
 for(const id of ids){const a=f.catalog.get(id),old=before.get(id),view=a.getFacingView();assert.notStrictEqual(a.draw,old.draw);assert.deepEqual(Object.getOwnPropertyDescriptor(a,'canvas'),old.descriptor);assert.strictEqual(a.boxes,old.boxes);assert.deepEqual([a.w,a.h],[old.w,old.h]);assert.deepEqual(view.footCenter,furnitureFootCenter(a));assert.deepEqual([0,90,180,270].map(rotation=>furnitureFacingBoxes(a,{x:713,y:905,scale:.37,rotation})),old.physical);
  const preview={draws:[],drawImage(...args){this.draws.push(args);}};a.draw(preview);assert.equal(preview.draws[0][0].name,'overview.webp');assert.equal(f.records.get(id).getters,0);assert.equal(f.records.get(id).ensures.length,0);
  const pose=furnitureFacingPlacement(a,{x:713,y:905,scale:.37,rotation:0},undefined,{includeImage:false});assert.deepEqual(pose.bounds,{x:713-a.w*.37/2,y:905-a.h*.37,w:a.w*.37,h:a.h*.37});
  await a.ensureFull();assert(view.ready);const canvas=a.getFacingImage();assert.match(canvas.draws[0][0].name,/-south-corrected.webp$/);assert.deepEqual(canvas.draws[0].slice(1,5),[44,92,160,220]);assert.strictEqual(a.getFacingView().canvas,canvas);assert.strictEqual(a.getFacingDrawSource('south',{native:true}).image,canvas);
  const native={draws:[],drawImage(...args){this.draws.push(args);}};a.draw(native);assert.strictEqual(native.draws[0][0],canvas);
 }
 const untouched=f.catalog.get('apartment-teak-bed');assert.strictEqual(untouched.draw,before.get(untouched.id).draw);assert.strictEqual(untouched.getFacingImage(),f.records.get(untouched.id).canvas);assert.strictEqual(untouched.ensureFull(),f.records.get(untouched.id).promise);clearLegacyFurnitureFacingCache();
});

test('a South correction is per exact ID and never propagates into a historical alias',async()=>{
 const ids=['apartment-teak-bed','showroom-midcentury-studio-bed'],f=fixture({definitions:LEGACY_FURNITURE_ASSETS.filter(d=>ids.includes(d.id))}),alias=f.catalog.get(ids[1]),old=alias.draw;
 addSouthOverrides(f,[ids[0]]);await f.register();await f.catalog.get(ids[0]).ensureFull();assert.strictEqual(alias.draw,old);assert.strictEqual(alias.getFacingView().canvas,f.records.get(alias.id).canvas);assert.strictEqual(alias.ensureFull(),f.records.get(alias.id).promise);clearLegacyFurnitureFacingCache();
});

test('corrected library draws after clear never use the synthetic stub or a released native image',async()=>{
 const id='beach-lifeguard-chair',f=fixture({definitions:LEGACY_FURNITURE_ASSETS.filter(d=>d.id===id)});addSouthOverrides(f,[id]);await f.register();const a=f.catalog.get(id);await a.ensureFull();const source=a.getFacingDrawSource('south',{native:true}),oldCanvas=source.image;
 clearLegacyFurnitureFacingCache();assert.equal(source.image,null);assert.equal(oldCanvas.width,1);
 const c={draws:[],drawImage(...args){assert(args[0].name||args[0].draws,'A plain synthetic stub is not drawable');assert(!args[0].closed,'A released image is not drawable');this.draws.push(args);}};
 a.draw(c);assert.equal(c.draws.length,0);await new Promise(resolve=>setImmediate(resolve));a.draw(c);assert.equal(c.draws[0][0].name,'overview.webp');assert.notStrictEqual(c.draws[0][0],oldCanvas);await a.ensureFull();a.draw(c);assert.match(c.draws.at(-1)[0].draws[0][0].name,/-south-corrected.webp$/);clearLegacyFurnitureFacingCache();
});

test('invalid partial South namespaces/crops fail before any original asset or loader is touched',async()=>{
 const ids=['apartment-corner-kitchen-counter','beach-lifeguard-chair'];
 for(const mutate of [
  (f,v)=>{v.cells[0].id='unknown-south';},(f,v)=>v.cells.push({...v.cells[0]}),(f,v)=>{v.cells[0].x=1020;},(f,v)=>{v.cells[0].w=NaN;},(f,v)=>{v.cells[0].viewWidth=999;},(f,v)=>{v.cells[0].footCenter=[.5,1];},
  (f,v)=>{const owner=f.directionManifest.collections.find(c=>c.views.south);delete owner.views.south;f.directionManifest.collections.find(c=>c!==owner).views.south=v;},(f,v)=>{v.cells=null;}
 ]){
  const f=fixture({definitions:LEGACY_FURNITURE_ASSETS.filter(d=>ids.includes(d.id))});addSouthOverrides(f,[ids[0]]);const a=f.catalog.get(ids[0]),draw=a.draw,ensure=a.ensureFull,v=f.directionManifest.collections.find(c=>c.views.south).views.south;mutate(f,v);await assert.rejects(f.register(),/South override/);assert.strictEqual(a.draw,draw);assert.strictEqual(a.ensureFull,ensure);assert.equal(a.getFacingView,undefined);assert.equal(f.loads.length,0);assert.equal(f.records.get(a.id).getters,0);
 }
});
