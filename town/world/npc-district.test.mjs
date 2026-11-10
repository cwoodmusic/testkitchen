import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,height,COLS,ROWS} from './model.mjs';
import {buildNPCDistrict,npcDistrictPoint,npcDistrictFacing} from './npc-district.mjs';
import {npcCollisionProject} from './npc-collision.mjs';
import {propCollisionBoxes} from './scene-collision.mjs';
import {furnitureFacingPlacement,furnitureFootCenter,furnitureFacingDepth} from './furniture-facing.mjs';

const tower={id:'coda-residences',name:'Coda Residences',w:1000,h:2500,urban:'tower',footprint:{x:100,y:1700,w:800,h:700},door:{x:500,y:2440},boxes:[{x:100,y:1700,w:800,h:700}]};
const shop={id:'coda-furnishings',name:'Coda Furnishings',w:1200,h:1000,urban:'shop',footprint:{x:40,y:100,w:1120,h:800},door:{x:600,y:930},boxes:[{x:40,y:100,w:1120,h:800}]};
const square={id:'music-square',w:2400,h:1600,boxes:[{x:950,y:580,w:500,h:400}]};
const bench={id:'decor-06-01',name:'Carved oak park bench',w:160,h:118,boxes:[{x:25.6,y:89.68,w:108.8,h:25.96}]};
const cart={id:'decor-07-06',name:'Coffee cart',w:172,h:160,boxes:[{x:27.5,y:121.6,w:116.9,h:35.2}]};
const catalog=new Map([tower,shop,square,bench,cart].map(a=>[a.id,a]));
const gazebo={id:'props-4-960',name:'Grand gazebo',w:960,h:960,boxes:propCollisionBoxes(4,960,960)};
const placed=(asset,id,x,y,rotation=0,scale=1)=>({asset,id,x,y,rotation,scale,collision:true,layer:asset==='music-square'?'ground':'objects'});

test('district follows placed city buildings and is independent of camera or saved spawn',()=>{
 const doc=blank();doc.objects.push(placed('coda-residences','tower',5000,5000),placed('coda-furnishings','shop',6800,6200),placed('music-square','square',4500,7000));
 const before=JSON.stringify(doc),a=buildNPCDistrict(doc,catalog);assert(a.tower);assert.equal(a.tower.objectId,'tower');assert.equal(a.anchors.filter(a=>a.kind==='tower').length,1);assert.equal(a.benches.length,4);
 for(const point of a.anchors)assert.equal(blocked(doc,point.x,point.y,catalog),false);
 assert.equal(JSON.stringify(doc),before);
 doc.spawn={x:15000,y:11000};assert.deepEqual(buildNPCDistrict(doc,catalog),a,'Camera/player spawn must not relocate a built city');
 doc.objects[0].x+=1000;const moved=buildNPCDistrict(doc,catalog);assert.equal(moved.tower.door.x-a.tower.door.x,1000);assert.notDeepEqual(moved.center,a.center);
});

test('seats and approaches use authored object rotation and scale, with walkable approaches',()=>{
 const doc=blank();doc.objects.push(placed('decor-06-01','bench',8192,6144,90,2));
 const {benches}=buildNPCDistrict(doc,catalog);assert.equal(benches.length,1);const b=benches[0];assert.equal(b.facing,'left');
 assert.deepEqual(b.seat,npcDistrictPoint(doc.objects[0],bench,{x:80,y:118*.72}));assert.equal(blocked(doc,b.approach.x,b.approach.y,catalog),false);assert(b.approach.x<b.seat.x);assert.equal(b.x,b.approach.x);assert.equal(b.y,b.approach.y);
 assert.equal(npcDistrictFacing({rotation:180}),'up');assert.equal(npcDistrictFacing({rotation:270}),'right');
});

test('Music Square seats stay attached to both native benches with separate front approaches',()=>{
 const doc=blank();doc.objects.push(placed('music-square','square',8192,6144));const d=buildNPCDistrict(doc,catalog);assert.equal(d.benches.length,4);
 for(const b of d.benches){assert.equal(b.facing,'down');assert(b.approach.y>b.seat.y);assert.equal(blocked(doc,b.approach.x,b.approach.y,catalog),false);}
 assert(d.benches[0].seat.x<d.benches[1].seat.x);assert(d.benches[1].seat.x<d.benches[2].seat.x);assert.equal(new Set(d.benches.map(b=>b.id)).size,4);
});

test('unbuilt maps use a stable authored spawn fallback and water-only maps have no destinations',()=>{
 const doc=blank();doc.spawn={x:6400,y:6400};const d=buildNPCDistrict(doc,catalog);assert.deepEqual(d.center,doc.spawn);assert(d.anchors.length>0);assert.equal(d.tower,null);assert.equal(d.benches.length,0);
 for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)doc.cells[`${x},${y}`]={surface:'water',level:0};const flooded=buildNPCDistrict(doc,catalog);assert.equal(flooded.anchors.length,0);assert.equal(flooded.benches.length,0);
});

test('cart hosts remain attached to movable rotated counters, with safe visible standing and greeting points',()=>{
 const doc=blank();const o=placed('decor-07-06','coffee',8192,6144,90,2.1);doc.objects.push(o);const before=JSON.stringify(doc),d=buildNPCDistrict(doc,catalog);assert.equal(d.vendors.length,1);const v=d.vendors[0];
 assert.equal(v.id,'vendor:coffee');assert.equal(v.objectId,'coffee');assert.equal(v.name,'Coffee cart host');assert.equal(v.facing,'left');assert.equal(blocked(doc,v.x,v.y,catalog),false);assert.equal(blocked(doc,v.interaction.x,v.interaction.y,catalog),false);assert.equal(JSON.stringify(doc),before);
 o.x+=256;const moved=buildNPCDistrict(doc,catalog).vendors[0];assert.equal(moved.x-v.x,256);assert.equal(moved.interaction.x-v.interaction.x,256);
});

test('detached distant benches and squares do not pull the district across the map',()=>{
 const doc=blank();doc.objects.push(placed('coda-residences','tower',3500,3500),placed('decor-06-01','far-bench',15000,11000),placed('music-square','far-square',14500,10500));const d=buildNPCDistrict(doc,catalog);
 assert.equal(d.benches.length,0);assert(d.bounds.x1<6000);assert(d.anchors.every(a=>a.objectId!=='far-square'));
});

test('scaled and rotated squares keep their cushion anchors inside the district',()=>{
 const doc=blank();doc.objects.push(placed('music-square','square',8192,6144,90,2));const d=buildNPCDistrict(doc,catalog);assert.equal(d.benches.length,4);
 for(const b of d.benches){assert.equal(b.facing,'left');assert(b.seat.x>=d.bounds.x0&&b.seat.x<=d.bounds.x1);assert(b.seat.y>=d.bounds.y0&&b.seat.y<=d.bounds.y1);assert.equal(blocked(doc,b.approach.x,b.approach.y,catalog),false);}
});

test('bench and vendor approach points avoid legacy non-solid plantings without changing saved flags',()=>{
 const doc=blank(),localCatalog=new Map(catalog),flowers={id:'flowers',w:192,h:160,boxes:[{x:0,y:48,w:192,h:112}],npcAvoid:true};localCatalog.set(flowers.id,flowers);
 doc.objects.push(placed('decor-06-01','bench',8192,6144),placed('decor-07-06','coffee',8500,6144));
 // Cover each original front approach. The district must find a clear way
 // to stand beside the planting rather than target its old walk-through base.
 doc.objects.push({...placed('flowers','bed-by-bench',8192,6240),collision:false},{...placed('flowers','bed-by-coffee',8550,6320),collision:false});
 const before=JSON.stringify(doc),district=buildNPCDistrict(doc,localCatalog),view=npcCollisionProject(doc,localCatalog);
 assert.equal(district.benches.length,1);assert.equal(district.vendors.length,1);
 for(const p of [district.benches[0].approach,district.vendors[0],district.vendors[0].interaction])assert.equal(blocked(view,p.x,p.y,localCatalog),false,'Destination overlaps a planted obstacle');
 assert.equal(JSON.stringify(doc),before);assert(doc.objects.slice(2).every(o=>o.collision===false));
});

test('all three building thresholds stay close to their doors and connected to the gathering approach',()=>{
 for(const rotation of [0,90,180,270]){
  const doc=blank(),localCatalog=new Map(catalog),arcade={...shop,id:'coda-arcade',urban:undefined};localCatalog.set(arcade.id,arcade);
  doc.objects.push(placed('coda-residences','tower',7000,6000,rotation),placed('coda-furnishings','shop',9500,8000,rotation),placed('coda-arcade','arcade',11000,5000,rotation));
  const district=buildNPCDistrict(doc,localCatalog),view=npcCollisionProject(doc,localCatalog);
  for(const building of district.anchors.filter(a=>['tower','shop','arcade'].includes(a.kind))){
   assert(building.threshold);assert(Math.hypot(building.threshold.x-building.door.x,building.threshold.y-building.door.y)<60,'Threshold was left at the distant gathering approach');
   assert(Math.hypot(building.threshold.x-building.approach.x,building.threshold.y-building.approach.y)>30);
   assert.equal(blocked(view,building.threshold.x,building.threshold.y,localCatalog),false);
  }
 }
});

test('gazebo stages use the authored front steps in every placement direction',()=>{
 const localCatalog=new Map(catalog);localCatalog.set(gazebo.id,gazebo);
 for(const rotation of [0,90,180,270]){
  const doc=blank(),o=placed(gazebo.id,'gazebo',8192,6144,rotation,1.35);doc.objects.push(o);
  const before=JSON.stringify(doc),district=buildNPCDistrict(doc,localCatalog),stage=district.stages[0];assert.equal(district.stages.length,1);
  assert.strictEqual(district.anchors.find(a=>a.kind==='stage'),stage);assert.equal(stage.id,'stage:gazebo');assert.equal(stage.objectId,'gazebo');assert.equal(stage.capacity,1);
  assert.deepEqual(stage.approach,npcDistrictPoint(o,gazebo,{x:480,y:1024}));
  assert.deepEqual(stage.via,[npcDistrictPoint(o,gazebo,{x:480,y:864}),npcDistrictPoint(o,gazebo,{x:480,y:710.4})]);
  assert.deepEqual(stage.deck,stage.via[1]);assert.deepEqual(stage.exit,[stage.via[0],stage.approach]);assert.deepEqual(stage.ground,{x:8192,y:6144});
  const view=npcCollisionProject(doc,localCatalog);for(const p of [stage.approach,...stage.via])assert.equal(blocked(view,p.x,p.y,localCatalog),false);
  assert.equal(JSON.stringify(doc),before);
 }
});

test('blocked, flooded or differently elevated gazebo stairs are not stage destinations',()=>{
 const localCatalog=new Map(catalog);localCatalog.set(gazebo.id,gazebo);localCatalog.set('obstruction',{w:128,h:128,boxes:[{x:0,y:0,w:128,h:128}]});
 const make=()=>{const doc=blank();doc.objects.push(placed(gazebo.id,'gazebo',8192,6144));return doc;};
 const blockedDoc=make();blockedDoc.objects.push(placed('obstruction','block',8192,6100));assert.equal(buildNPCDistrict(blockedDoc,localCatalog).stages.length,0);
 const flooded=make();flooded.cells['128,96']={surface:'water',level:0};assert.equal(buildNPCDistrict(flooded,localCatalog).stages.length,0);
 const raised=make();raised.cells['128,92']={surface:'grass',level:1};assert.equal(buildNPCDistrict(raised,localCatalog).stages.length,0);
 const pergola=blank();localCatalog.set('decor-09-02',{w:576,h:540,boxes:[]});pergola.objects.push(placed('decor-09-02','pergola',8192,6144));assert.equal(buildNPCDistrict(pergola,localCatalog).stages.length,0);
});

test('bench seats retain their asset ground anchor and reject approaches across a cliff level',()=>{
 const doc=blank();doc.objects.push(placed('decor-06-01','bench',8192,6200));
 const level=3;
 // The prop anchor sits on the plateau, but its entire forward approach is
 // below the cliff. No seated resident should float at the lower elevation.
 for(let y=90;y<=96;y++)for(let x=124;x<=132;x++)doc.cells[`${x},${y}`]={surface:'grass',level};
 const different=buildNPCDistrict(doc,catalog);assert.equal(different.benches.length,0);
 for(let y=97;y<=100;y++)for(let x=124;x<=132;x++)doc.cells[`${x},${y}`]={surface:'grass',level};
 const same=buildNPCDistrict(doc,catalog);assert.equal(same.benches.length,1);
 const b=same.benches[0];assert.deepEqual(b.ground,{x:8192,y:6200});assert.equal(height(doc,b.approach.x,b.approach.y),height(doc,b.ground.x,b.ground.y));
});

test('upright cardinal benches rotate ground support while the seated hip lift stays vertical',()=>{
 let imageReads=0;const foot=furnitureFootCenter(bench),views=Object.fromEntries(['south','north','east','west'].map(facing=>[facing,{id:bench.id+'|'+facing,w:80,h:210,footCenter:{x:40,y:170},get canvas(){imageReads++;throw Error('Metadata must not warm artwork');}}]));
 const authored={...bench,getFacingView:(direction,options)=>{assert.equal(options.image,false);return views[direction];}},localCatalog=new Map([[bench.id,authored]]);
 for(const rotation of [90,180,270])for(const scale of [.65,1,1.8]){
  const doc=blank(),o=placed(bench.id,'bench',8192,6144,rotation,scale);doc.objects.push(o);const before=JSON.stringify(doc),b=buildNPCDistrict(doc,localCatalog).benches[0];assert(b);
  const ground=furnitureFacingPlacement(authored,o,undefined,{includeImage:false}).groundCenter,lift=(foot.y-bench.h*.72)*scale;
  assert(Math.abs(b.seat.x-ground.x)<1e-9,'Pictured hip height was rotated sideways into world X');assert(Math.abs(b.seat.y-(ground.y-lift))<1e-9);assert(b.seat.y<ground.y);
  assert.deepEqual(b.approach,npcDistrictPoint(o,bench,{x:bench.w/2,y:bench.h+56/scale}));
  if(rotation%180)assert(b.seatedDepth>furnitureFacingDepth(authored,o),'An upright side bench would cover its seated occupant');else assert.equal(b.seatedDepth,undefined);
  assert.equal(JSON.stringify(doc),before);assert.deepEqual(authored.boxes,bench.boxes);
 }
 assert.equal(imageReads,0);
});

test('South cardinal seating remains identical to the original bench metadata',()=>{
 const doc=blank();doc.objects.push(placed(bench.id,'bench',8192,6144,0,1.35));const legacy=buildNPCDistrict(doc,new Map([[bench.id,bench]])).benches;
 const authored={...bench,getFacingView(){throw Error('South seating should retain its exact legacy path');}};
 assert.deepEqual(buildNPCDistrict(doc,new Map([[bench.id,authored]])).benches,legacy);
});
