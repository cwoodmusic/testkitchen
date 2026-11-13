import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyWideRoomLayout} from './wide-room-layout.mjs';
import {getInteriorBase,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';
import {furnitureFacingBoxes,furnitureFacingBounds,furnitureFacingDepth} from './furniture-facing.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';
import {getShowroomNavigation} from './showroom-navigation.mjs';
import {apartmentDecorBounds,apartmentWallDecorBounds} from './personal-room-areas.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));
configureUrbanInteriors(catalog);
const descriptors=[...residents.map(resident=>({kind:'apartment',resident:resident.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(showroom=>({kind:'showroom',showroomId:showroom.id}))];
const reference=getInteriorBase({kind:'showroom',showroomId:'victorian-parlor'});
const fingerprint=scene=>JSON.stringify({scene,bases:scene.items.map(item=>[item.id,item.collisionBoxes]),symbols:Object.getOwnPropertySymbols(scene).map(symbol=>[String(symbol),scene[symbol]])});
const themeId=scene=>scene.kind==='showroom'?'showroom-'+scene.showroomId:scene.resident;
const slot=item=>item.slot||item.collectionSlot||catalog.get(item.asset)?.slot;
const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-6&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-6;
const contains=(outer,inner)=>inner.x>=outer.x-1e-6&&inner.y>=outer.y-1e-6&&inner.x+inner.w<=outer.x+outer.w+1e-6&&inner.y+inner.h<=outer.y+outer.h+1e-6;
function footprint(item){
 const boxes=furnitureFacingBoxes(catalog.get(item.asset),item);assert(boxes.length,`No physical base for ${item.id}`);
 const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y)),right=Math.max(...boxes.map(box=>box.x+box.w)),bottom=Math.max(...boxes.map(box=>box.y+box.h));
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
const cases=descriptors.map(descriptor=>{
 const current=getInteriorBase(descriptor),source=current.roomLayoutLegacySources?.[0]||current,before=fingerprint(source),sourceItems=[...source.items],sourceBases=source.items.map(item=>item.collisionBoxes);
 try{return {descriptor,source,before,sourceItems,sourceBases,scene:applyWideRoomLayout(source,catalog,{reference})};}
 catch(error){return {descriptor,source,before,sourceItems,sourceBases,error};}
});
const changed=()=>cases.filter(entry=>entry.scene?.wideRoomLayout);
function clear(scene,point){
 return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=40&&point.y>=112&&point.x<=scene.width-40&&point.y<=scene.height-40&&!scene.solids.some(box=>point.x>=box.x-6&&point.x<=box.x+box.w+6&&point.y>=box.y-6&&point.y<=box.y+box.h+6);
}
function flood(scene){
 const step=6,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),total=cols*rows,blocked=new Uint8Array(total),seen=new Uint8Array(total),queue=new Int32Array(total),at=index=>({x:(index%cols)*step+step/2,y:Math.floor(index/cols)*step+step/2});
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x*step+3<40||x*step+3>scene.width-40||y*step+3<112||y*step+3>scene.height-40)blocked[y*cols+x]=1;
 for(const box of scene.solids){const x0=Math.max(0,Math.ceil((box.x-6-3)/step)),x1=Math.min(cols-1,Math.floor((box.x+box.w+6-3)/step)),y0=Math.max(0,Math.ceil((box.y-6-3)/step)),y1=Math.min(rows-1,Math.floor((box.y+box.h+6-3)/step));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;}
 let tail=0;const sx=Math.floor(scene.spawn.x/step),sy=Math.floor(scene.spawn.y/step);
 for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const x=sx+dx,y=sy+dy,index=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&!blocked[index]&&!seen[index]&&Math.hypot(at(index).x-scene.spawn.x,at(index).y-scene.spawn.y)<=12){seen[index]=1;queue[tail++]=index;}}
 for(let head=0;head<tail;head++){const index=queue[head],x=index%cols,y=Math.floor(index/cols);for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&!blocked[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}}}
 return point=>{
  if(!clear(scene,point))return false;const x=Math.floor(point.x/step),y=Math.floor(point.y/step);
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const X=x+dx,Y=y+dy,index=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&seen[index]&&Math.hypot(at(index).x-point.x,at(index).y-point.y)<=10)return true;}return false;
 };
}

test('all thirty other private defaults adopt the wide plan while every original scene remains intact',()=>{
 const errors=cases.filter(entry=>entry.error).map(entry=>`${entry.source.id}: ${entry.error.stack||entry.error.message}`);assert.deepEqual(errors,[]);
 assert.equal(cases.length,31);assert.equal(changed().length,30);
 let unchanged=0,converted=0;
 for(const entry of cases){
  const {source,scene,before,sourceItems,sourceBases}=entry;assert.equal(fingerprint(source),before,`${source.id}: source geometry/poses/colliders changed`);assert.deepEqual(source.items,sourceItems);source.items.forEach((item,index)=>assert.equal(item.collisionBoxes,sourceBases[index]));
  if(source.id==='showroom-victorian-parlor'){unchanged++;assert.equal(scene,source);assert.equal(scene.wideRoomLayout,undefined);continue;}
  assert.notEqual(scene,source);assert.equal(scene.id,source.id);assert.equal(scene.wideRoomLayout.version,1);
  if(source.width===1088){
   converted++;assert.equal(source.height,1120);assert.equal(scene.width,2304);assert.equal(scene.height,1184);assert.equal(scene.wideRoomExpansion.previousWidth,1088);assert.equal(scene.wideRoomExpansion.previousHeight,1120);assert.equal(scene.wideRoomExpansion.depth,64);assert.deepEqual(scene.spawn,{x:1152,y:1039});assert.deepEqual(scene.portalExit.threshold,{x:1152,y:1156});assert.deepEqual(scene.homePlan.home,{x:1152,y:750});
  }else{assert.equal(scene.width,source.width);assert.equal(scene.height,source.height);}
  const legacy=Object.getOwnPropertyDescriptor(scene,'roomLayoutLegacySources');assert(legacy);assert.equal(legacy.enumerable,false);assert.equal(legacy.value[0],source);assert(!Object.keys(scene).includes('roomLayoutLegacySources'));
 }
 assert.equal(unchanged,1);assert.equal(converted,10);
});

test('native art, furniture dimensions, IDs and complete canonical stock survive each themed arrangement',()=>{
 for(const {source,scene}of changed()){
  const originals=new Map((source.roomLayoutBaseItems||source.items).map(item=>[item.id,item])),stock=scene.roomLayoutBaseItems||scene.items;
  assert.equal(new Set(stock.map(item=>item.id)).size,stock.length,scene.id);assert.deepEqual([...stock.map(item=>item.id)].sort(),[...originals.keys()].sort(),`${scene.id}: canonical stock changed`);
  for(const item of [...stock,...scene.items]){
   const original=originals.get(item.id);assert(original,`${scene.id}: invented item ${item.id}`);assert.equal(item.asset,original.asset,`${item.id}: native art changed`);assert.equal(catalog.get(item.asset).owner,catalog.get(original.asset).owner);
   if(item.designRole==='family-living-rug'){assert(item.w<=original.w+1e-6&&item.h<=original.h+1e-6);assert(Math.abs(item.w/item.h-original.w/original.h)<1e-8,'A refitted rug keeps its native aspect');}
   else{assert.equal(item.w,original.w,`${item.id}: furniture width changed`);assert.equal(item.h,original.h,`${item.id}: furniture height changed`);}
  }
  assert.deepEqual(scene.privacyDoors.map(door=>door.id).sort(),source.privacyDoors.map(door=>door.id).sort(),`${scene.id}: door identities changed`);
  for(const door of scene.privacyDoors){assert.equal(door.axis,'horizontal');assert.equal(door.length,36);assert.equal(door.clearOpening,true);}
 }
});

test('the Victorian flow preserves each original mirrored side instead of flipping the room',()=>{
 for(const {source,scene}of changed()){
  const previous=source.rooms.find(room=>room.functionalRole==='bedroom'),mirrored=source.kind==='showroom'?source.showroom.column===1:previous.x+previous.w/2>source.width/2;
  assert.equal(scene.wideRoomLayout.mirrored,mirrored,scene.id);
  const bed=scene.rooms.find(room=>room.functionalRole==='bedroom'),bath=scene.rooms.find(room=>room.functionalRole==='bathroom'),kitchen=scene.rooms.find(room=>room.functionalRole==='kitchen'),x=room=>mirrored?scene.width-room.x-room.w/2:room.x+room.w/2;
  assert(x(bed)<x(bath),`${scene.id}: bath is next to its bedroom`);assert(x(bath)<x(kitchen),`${scene.id}: kitchen is in the shared wing`);
  const dining=scene.items.find(item=>item.designRole==='family-dining-table'),sofa=scene.items.find(item=>slot(item)==='sofa'&&!item.roomExpansion),canonical=item=>mirrored?scene.width-footprint(item).cx:footprint(item).cx;
  assert(dining&&sofa);assert(canonical(dining)<canonical(sofa),`${scene.id}: lounge stays toward the outer front of the day wing`);
 }
});

test('all rebuilt native furniture bases are distinct, inside the floor, and shared by physical collision',()=>{
 for(const {scene}of changed()){
  const itemBases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[])),structural=scene.solids.filter(box=>!itemBases.has(box)),floor={x:28,y:106,w:scene.width-56,h:scene.height-134},bases=[];
  for(const item of scene.items){
   const expected=item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[];assert.deepEqual(item.collisionBoxes,expected,`${item.id}: stale bases`);
   for(const box of item.collisionBoxes){assert(scene.solids.includes(box),`${item.id}: collider identity lost`);assert(contains(floor,box),`${item.id}: base outside room`);assert(!structural.some(wall=>overlaps(wall,box)),`${item.id}: base intersects wall`);bases.push({item,box});}
  }
  for(let a=0;a<bases.length;a++)for(let b=a+1;b<bases.length;b++)if(bases[a].item!==bases[b].item)assert(!overlaps(bases[a].box,bases[b].box),`${scene.id}: ${bases[a].item.id} overlaps ${bases[b].item.id}`);
 }
});

test('seats face their own real tables and supported decorations use final parent IDs and depths',()=>{
 for(const {scene}of changed()){
  const items=new Map(scene.items.map(item=>[item.id,item]));
  for(const item of scene.items){
   if(item.supportedBy&&item.supportedBy!=='north-wall'){
    const parent=items.get(item.supportedBy);assert(parent,`${item.id}: unresolved support ${item.supportedBy}`);assert.equal(item.solid,false);assert.deepEqual(item.collisionBoxes,[]);assert.equal(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25);
   }
   if(!['dining-chair','desk-chair','reading-chair'].includes(slot(item))&&!(slot(item)==='sofa'&&item.roomExpansion))continue;
   assert(item.seatingTarget,`${item.id}: no actual table target`);const target=items.get(item.seatingTarget);assert(target,`${item.id}: missing table ${item.seatingTarget}`);
   const s=footprint(item),t=footprint(target),r=(item.rotation||0)*Math.PI/180,front={x:-Math.sin(r),y:Math.cos(r)},dx=t.cx-s.cx,dy=t.cy-s.cy,dot=front.x*dx+front.y*dy,cross=Math.abs(front.x*dy-front.y*dx),limit=(Math.abs(front.x)>.5?t.h:t.w)/2+2;
   assert(dot>0&&cross<=limit,`${item.id}: facing ${item.rotation||0} misses ${target.id}`);
  }
 }
 const miniatures=[];
 for(const {source,scene}of changed()){
  const originalArcade=source.items.find(item=>!item.roomExpansion&&slot(item)==='arcade'),arcade=scene.items.find(item=>item.id===originalArcade.id),miniature=originalArcade.supportedBy&&originalArcade.supportedBy!=='north-wall'&&(originalArcade.miniature||originalArcade.w<catalog.get(originalArcade.asset).w*.65*.8);
  assert(arcade);assert.equal(arcade.id,originalArcade.id);assert.equal(arcade.asset,originalArcade.asset);assert.equal(arcade.w,originalArcade.w);assert.equal(arcade.h,originalArcade.h);
  if(!miniature){assert.equal(arcade.supportedBy,undefined,`${arcade.id}: a full-size arcade stays on the floor`);assert.equal(arcade.solid,true);assert(arcade.collisionBoxes.length);continue;}
  const console=scene.items.find(item=>!item.roomExpansion&&slot(item)==='record-console'),canonical=scene.roomLayoutBaseItems.find(item=>item.id===originalArcade.id);assert(console&&canonical);
  assert.equal(arcade.supportedBy,console.id,`${arcade.id}: the miniature stays on its actual relocated record console`);assert.equal(arcade.solid,false);assert.deepEqual(arcade.collisionBoxes,[]);assert.equal(arcade.depth,furnitureFacingDepth(catalog.get(console.asset),console,console.y)+.25);
  for(const field of ['asset','w','h','supportedBy','solid','depth'])assert.equal(canonical[field],arcade[field],`${arcade.id}: canonical ${field} must reload consistently`);assert.deepEqual(canonical.collisionBoxes,[]);miniatures.push({source,originalArcade,console});
 }
 assert.equal(miniatures.length,11,'The ten converted compact homes and the player retain their original miniature arcade intent');
 // The console's upright cardinal artwork has its own native bounds. Check
 // the supported foot against those real anchors, not a rotated PNG box.
 const json=name=>JSON.parse(readFileSync(new URL('../assets/apartment-collections/'+name,import.meta.url))),manifest=json('manifest.json'),runtime=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest:json('directions-manifest.json'),thumbnails:new Map(manifest.collections.map(collection=>[collection.owner,{width:1,height:1}])),loadImage(){throw Error('Support geometry must not load artwork');},createCanvas(){throw Error('Support geometry must not rasterize artwork');}}),picturedCatalog=new Map(catalog);
 for(const asset of APARTMENT_COLLECTION_ASSETS)picturedCatalog.set(asset.id,{...asset,getFacingView:direction=>runtime.view(asset.id,direction)});
 for(const {source,originalArcade,console}of miniatures){
  const pictured=applyWideRoomLayout(source,picturedCatalog,{reference}),picturedArcade=pictured.items.find(item=>item.id===originalArcade.id),picturedConsole=pictured.items.find(item=>item.id===console.id),surface=furnitureFacingBounds(picturedCatalog.get(picturedConsole.asset),picturedConsole);
  for(const base of furnitureFacingBoxes(picturedCatalog.get(picturedArcade.asset),picturedArcade))assert(contains(surface,base),`${picturedArcade.id}: miniature foot must sit on the actual upright console artwork`);
 }
});

test('a six-radius walker reaches every room, privacy doorway, fixture and visitor destination',()=>{
 for(const {source,scene}of changed()){
  const reaches=flood(scene),targets=[['spawn',scene.spawn]],portal=scene.portalExit;
  assert(clear(scene,scene.spawn),`${scene.id}: arrival is blocked`);
  if(portal?.threshold)targets.push(['exit approach',{x:portal.threshold.x+portal.enterNormal.x*24,y:portal.threshold.y+portal.enterNormal.y*24}]);
  for(const door of scene.privacyDoors){const center={x:door.x+door.length/2,y:door.y};targets.push([door.id+' north',{x:center.x,y:center.y-24}],[door.id+' south',{x:center.x,y:center.y+24}]);}
  for(const room of scene.rooms)if(room.point)targets.push([room.functionalRole||room.id||room.name,room.point]);
  for(const point of scene.homePlan?.fixtureApproaches||[])targets.push([point.role+' approach',point]);
  for(const item of scene.items)if(item.approach)targets.push([item.id+' approach',item.approach]);
  if(scene.showroom?.apartment?.browse){targets.push(['browse',scene.showroom.apartment.browse]);const route=getShowroomNavigation(scene);assert(route,`${scene.id}: visitor route missing`);assert.deepEqual(route.visitRoute[0],scene.spawn);for(let i=1;i<route.visitRoute.length;i++){const a=route.visitRoute[i-1],b=route.visitRoute[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));for(let n=0;n<=steps;n++)assert(clear(scene,{x:a.x+(b.x-a.x)*n/steps,y:a.y+(b.y-a.y)*n/steps}),`${scene.id}: visitor route crosses a base`);}}
  for(const [name,point]of targets)assert(reaches(point),`${scene.id}: cannot reach ${name} at ${point.x},${point.y}`);
  for(const core of ['bed','sink','stove','fridge','counter','vanity','bath-fixture','toilet','pantry']){if(!source.items.some(item=>slot(item)===core))continue;const item=scene.items.find(item=>slot(item)===core);assert(item,`${scene.id}: original ${core} disappeared`);assert(item.approach||(scene.homePlan?.fixtureApproaches||[]).some(point=>point.asset===item.asset),`${scene.id}: ${core} lost its usable fixture approach`);}
  if(scene.kind==='apartment'&&scene.resident!=='player'){
   assert.deepEqual(scene.actors.map(actor=>({id:actor.id,x:actor.x,y:actor.y})),[{id:scene.resident,x:1152,y:750}]);
   for(let y=750;y<=scene.spawn.y;y+=3)assert(clear(scene,{x:1152,y}),`${scene.id}: resident's existing home journey crosses furniture at y=${y}`);
  }
 }
});

test('the mirrored player template leaves every fixed purchased floor and wall region untouched',()=>{
 const {scene}=changed().find(entry=>entry.scene.resident==='player');assert(scene);
 const floors=[{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}],walls=[{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}];assert.deepEqual(apartmentDecorBounds(scene),floors);assert.deepEqual(apartmentWallDecorBounds(scene),walls);
 const bases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[])),structural=scene.solids.filter(box=>!bases.has(box));
 for(const box of structural)assert(!floors.some(region=>overlaps(region,box)),'The new shell crosses an owned floor reservation');
 for(const item of scene.items){for(const box of item.collisionBoxes||[])assert(!floors.some(region=>overlaps(region,box)),`${item.id}: occupies purchased floor`);if(item.wallMounted){const bounds=furnitureFacingBounds(catalog.get(item.asset),item);assert(!walls.some(region=>overlaps(region,bounds)),`${item.id}: covers purchased wall art`);}}
});

test('every fresh default exports and reloads its genuine new structure, native sizes, supports and removals',()=>{
 const metadata=items=>items.map(item=>({...item,collisionBoxes:(item.collisionBoxes||[]).map(box=>({...box}))}));
 for(const {source,scene}of changed()){
  const id=themeId(scene),fresh=createRoomLayoutModel({themeId:id,scene,catalog}),record=fresh.record(),again=createRoomLayoutModel({themeId:id,scene,catalog,record}),legacy=createRoomLayoutModel({themeId:id,scene:source,catalog}).record();
  assert.equal(fresh.hasEdits,false);assert.deepEqual(again.record(),record,`${scene.id}: fresh export does not reload`);assert.notEqual(record.baseSignature,legacy.baseSignature,`${scene.id}: new walls reused a legacy signature`);
  assert.deepEqual(again.scene.walls,scene.walls);assert.deepEqual(again.scene.privacyDoors,scene.privacyDoors);assert.equal(again.scene.width,scene.width);assert.equal(again.scene.height,scene.height);
  const original=new Map(scene.items.map(item=>[item.id,item]));for(const item of again.scene.items.filter(item=>!item.roomRugId)){const expected=original.get(item.id);assert(expected);for(const field of ['asset','x','y','w','h','solid'])assert.equal(item[field],expected[field],`${item.id}: ${field} changed after reload`);assert.equal(item.rotation||0,expected.rotation||0);assert.equal(item.supportedBy,expected.supportedBy);}
  const committed=metadata(fresh.scene.items);assert.deepEqual(metadata(again.scene.items),committed,`${scene.id}: reload must preserve every default item field, including fixture approaches`);
  assert.equal(fresh.reset().ok,true);assert.deepEqual(fresh.record(),record);assert.deepEqual(metadata(fresh.scene.items),committed,`${scene.id}: Reset must restore the complete committed default item metadata`);
  const resetReloaded=createRoomLayoutModel({themeId:id,scene,catalog,record:fresh.record()});assert.deepEqual(metadata(resetReloaded.scene.items),metadata(fresh.scene.items),`${scene.id}: Reset and reload must produce identical complete item data and physical bases`);
 }
});

test('runtime catalog collisionDefault flags produce the same solid furniture, poses and reloadable records',()=>{
 // Registered browser assets expose collisionDefault rather than the source
 // definition's solid field. Keep their real bases and all role metadata.
 const runtimeCatalog=new Map([...catalog].map(([id,asset])=>{const runtime={...asset,collisionDefault:asset.solid};delete runtime.solid;return [id,runtime];}));
 assert([...runtimeCatalog.values()].every(asset=>!Object.hasOwn(asset,'solid')));
 const itemState=item=>({id:item.id,asset:item.asset,x:item.x,y:item.y,w:item.w,h:item.h,rotation:item.rotation||0,solid:item.solid,support:item.supportedBy,depth:item.depth,bases:item.collisionBoxes});
 for(const {source,scene:defined}of changed()){
  const before=fingerprint(source),runtime=applyWideRoomLayout(source,runtimeCatalog,{reference}),id=themeId(runtime);
  assert(runtime.items.some(item=>item.solid),`${runtime.id}: runtime catalog lost every solid base`);
  assert.deepEqual(runtime.items.map(itemState),defined.items.map(itemState),`${runtime.id}: runtime catalog changed active furniture`);
  assert.deepEqual(runtime.roomLayoutBaseItems.map(itemState),defined.roomLayoutBaseItems.map(itemState),`${runtime.id}: runtime catalog changed canonical stock`);
  assert.deepEqual(runtime.solids,defined.solids,`${runtime.id}: runtime physical collision differs from definitions`);
  const record=createRoomLayoutModel({themeId:id,scene:runtime,catalog:runtimeCatalog}).record(),expected=createRoomLayoutModel({themeId:id,scene:defined,catalog}).record();assert.deepEqual(record,expected);
  const reloaded=createRoomLayoutModel({themeId:id,scene:runtime,catalog:runtimeCatalog,record});assert.deepEqual(reloaded.record(),record);assert(reloaded.scene.items.some(item=>item.solid&&item.collisionBoxes.length>0),`${runtime.id}: reload lost runtime collision`);
  assert.deepEqual(reloaded.scene.items.filter(item=>!item.roomRugId).map(itemState),runtime.items.map(itemState));assert.equal(fingerprint(source),before);
 }
});
