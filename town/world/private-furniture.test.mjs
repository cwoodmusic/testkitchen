import test from 'node:test';
import assert from 'node:assert/strict';
import {calibratePrivateFurniture,presentedRoomItem} from './private-furniture.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {createRoomStorage,roomItemBoxes,ROOM_KEY} from './urban-room.mjs';

const catalog=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a]));
configureUrbanInteriors(catalog);
const privateScenes=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))];
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
const overlaps=(a,b,tolerance=0)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>tolerance&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>tolerance;
function parentOf(item,items){return items.find(p=>p!==item&&(p.asset===item.supportedBy||p.furnitureRole===item.supportedBy||p.slot===item.supportedBy||p.collectionSlot===item.supportedBy)&&(!item.roomId||!p.roomId||p.roomId===item.roomId));}

test('all31 large private rooms use native game furniture proportions without changing their floor plates',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request),before=JSON.stringify({width:scene.width,height:scene.height,rooms:scene.rooms,spawn:scene.spawn,zones:scene.zones});
  calibratePrivateFurniture(scene,catalog);assert.equal(JSON.stringify({width:scene.width,height:scene.height,rooms:scene.rooms,spawn:scene.spawn,zones:scene.zones}),before);
  for(const item of scene.items.filter(i=>!i.supportedBy||i.supportedBy==='north-wall')){
   const a=catalog.get(item.asset);assert(a,item.asset);near(item.w,a.w*.375,scene.id+' '+item.asset+' width');near(item.h,a.h*.375,scene.id+' '+item.asset+' height');
   near(item.w/(66*.375),a.w/66,'The furniture-to-avatar width ratio matches the existing town asset');
  }
  const snapshot=JSON.stringify(scene);calibratePrivateFurniture(scene,catalog);assert.equal(JSON.stringify(scene),snapshot,'Model calibration is idempotent');
 }
});

test('resized furniture has exact new collision bases, without structural overlaps or stale display-size obstacles',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request);calibratePrivateFurniture(scene,catalog);
  const allBases=new Set(scene.items.flatMap(i=>i.collisionBoxes)),walls=scene.solids.filter(b=>!allBases.has(b)),bases=[];
  for(const item of scene.items){
   const expected=item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[];assert.deepEqual(item.collisionBoxes,expected,item.asset);for(const b of item.collisionBoxes){assert(scene.solids.includes(b));bases.push({...b,asset:item.asset});for(const wall of walls)assert(!overlaps(b,wall,.01),scene.id+' '+item.asset+' crosses a wall');}
  }
  for(let i=0;i<bases.length;i++)for(let j=i+1;j<bases.length;j++)assert(!overlaps(bases[i],bases[j],2),scene.id+' '+bases[i].asset+' overlaps '+bases[j].asset);
 }
});

test('tabletop lamps, toys and mini cabinets stay attached to their resized real support',()=>{
 let supported=0;
 for(const request of privateScenes){
  const scene=getInterior(request);calibratePrivateFurniture(scene,catalog);
  for(const item of scene.items.filter(i=>i.supportedBy&&i.supportedBy!=='north-wall')){
   const parent=parentOf(item,scene.items);assert(parent,scene.id+' support '+item.supportedBy);assert.equal(item.solid,false);assert.equal(item.collisionBoxes.length,0);
   assert(item.y<=parent.y+1e-8&&item.y>=parent.y-parent.h-1e-8,'Supported item remains on its pictured furniture: '+scene.id+' '+item.asset);
   near(item.depth,furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25,'Child depth follows support feet');supported++;
  }
 }
 assert(supported>=60);
});

test('all31 bedside tables remain close to the bedhead with a clear physical gap',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request);calibratePrivateFurniture(scene,catalog);
  const bed=scene.items.find(i=>catalog.get(i.asset)?.slot==='bed'),table=scene.items.find(i=>catalog.get(i.asset)?.slot==='nightstand');assert(bed&&table,scene.id);
  const b=bed.collisionBoxes[0],n=table.collisionBoxes[0],left=n.x+n.w<=b.x;
  near(left?b.x-n.x-n.w:n.x-b.x-b.w,5,scene.id+' bedside gap');
  near(n.y+n.h/2,b.y+b.h/2-b.h*.3,scene.id+' bedside table at the head of the bed');
  assert(!overlaps(b,n));
 }
});

test('public furniture remains untouched, and saved room presentation never edits the original product record',()=>{
 const source={id:'room-chair',item:'old-chair',asset:'collection-player-dining-chair',x:1800,y:900,scale:.75,rotation:90},raw=JSON.stringify(source);
 const projected=presentedRoomItem(source,{kind:'apartment',resident:'player'});assert.equal(JSON.stringify(source),raw);assert.equal(projected.scale,.75*.375);assert.equal(projected.x,1800);assert.equal(projected.rotation,90);
 assert.equal(presentedRoomItem(source,{kind:'shop'}),source);
 const scene={kind:'shop',items:[{asset:source.asset,x:50,y:100,w:80,h:100}],solids:[]},before=JSON.stringify(scene);assert.equal(calibratePrivateFurniture(scene,catalog),scene);assert.equal(JSON.stringify(scene),before);
});

test('private saved furniture uses its presented bounds and collision while keeping saved bytes and fixed product scale',()=>{
 const a=catalog.get('collection-player-dining-chair'),furniture=[{id:'old-chair',asset:a.id,scale:.75}],record={id:'room-chair',item:'old-chair',asset:a.id,x:80,y:100,scale:.75,rotation:90};
 const raw=JSON.stringify({version:1,owner:'guest',items:[record]}),data=new Map([[ROOM_KEY,raw]]);let writes=0;
 const room=createRoomStorage({catalog,furniture,owner:'guest',presentationScale:.375,owned:()=>['old-chair'],storage:{getItem:k=>data.get(k),setItem(k,v){writes++;data.set(k,v);}},getBounds:()=>[{x:0,y:0,w:200,h:200}]});
 assert.equal(room.load().ok,true);assert.equal(writes,0);assert.equal(data.get(ROOM_KEY),raw);assert.deepEqual(room.snapshot(),[record]);
 assert.deepEqual(roomItemBoxes(record,catalog,.375),furnitureFacingBoxes(a,presentedRoomItem(record,{kind:'apartment'})));
 const placed=room.place('old-chair',12,100,0);assert.equal(placed.ok,true,'A native-size private chair fits near the wall where the old full-size display would not');assert.equal(placed.item.scale,.75);assert.equal(room.snapshot()[0].x,12);
 const altered=JSON.parse(data.get(ROOM_KEY));altered.items[0].scale=.1;data.set(ROOM_KEY,JSON.stringify(altered));assert.equal(room.load().ok,false,'Presentation scaling never permits a forged smaller product size');
});
