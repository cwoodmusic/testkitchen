import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calibratePrivateFurniture,presentedRoomItem,furniturePresentationScale} from './private-furniture.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {furnitureFacingBoxes,furnitureFacingBounds,furnitureFacingDepth} from './furniture-facing.mjs';
import {createRoomStorage,roomItemBoxes,ROOM_KEY} from './urban-room.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a]));
configureUrbanInteriors(catalog);
const privateScenes=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))];
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
const overlaps=(a,b,tolerance=0)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>tolerance&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>tolerance;
function parentOf(item,items){return items.find(p=>p!==item&&(p.id===item.supportedBy||p.asset===item.supportedBy||p.furnitureRole===item.supportedBy||p.slot===item.supportedBy||p.collectionSlot===item.supportedBy)&&(!item.roomId||!p.roomId||p.roomId===item.roomId));}

test('all31 large private rooms use Arcade-referenced role proportions without changing their floor plates',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request),before=JSON.stringify({width:scene.width,height:scene.height,rooms:scene.rooms,spawn:scene.spawn,zones:scene.zones});
  calibratePrivateFurniture(scene,catalog);assert.equal(JSON.stringify({width:scene.width,height:scene.height,rooms:scene.rooms,spawn:scene.spawn,zones:scene.zones}),before);
  for(const item of scene.items.filter(i=>!i.supportedBy||i.supportedBy==='north-wall')){
   const a=catalog.get(item.asset);assert(a,item.asset);const size=furniturePresentationScale(item,scene,a);near(item.w,a.w*size,scene.id+' '+item.asset+' width');near(item.h,a.h*size,scene.id+' '+item.asset+' height');
   near(item.w/item.h,a.w/a.h,'Role sizing preserves native art proportions');
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
   // The approved Victorian export uses a turned table as a plant support.
   const pictured=scene.roomLayoutBaseItems?furnitureFacingBounds(catalog.get(parent.asset),parent):{y:parent.y-parent.h,h:parent.h};
   assert(item.y<=pictured.y+pictured.h+1e-8&&item.y>=pictured.y-1e-8,'Supported item remains on its pictured furniture: '+scene.id+' '+item.asset);
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
 const projected=presentedRoomItem(source,{kind:'apartment',resident:'player'});assert.equal(JSON.stringify(source),raw);assert.equal(projected.scale,.75*.50);assert.equal(projected.x,1800);assert.equal(projected.rotation,90);
 assert.equal(presentedRoomItem(source,{kind:'shop'}),source);
 const scene={kind:'shop',items:[{asset:source.asset,x:50,y:100,w:80,h:100}],solids:[]},before=JSON.stringify(scene);assert.equal(calibratePrivateFurniture(scene,catalog),scene);assert.equal(JSON.stringify(scene),before);
});

test('private saved furniture uses its presented bounds and collision while keeping saved bytes and fixed product scale',()=>{
 const a=catalog.get('collection-player-dining-chair'),furniture=[{id:'old-chair',asset:a.id,scale:.75}],record={id:'room-chair',item:'old-chair',asset:a.id,x:80,y:100,scale:.75,rotation:90};
 const raw=JSON.stringify({version:1,owner:'guest',items:[record]}),data=new Map([[ROOM_KEY,raw]]);let writes=0;
 const room=createRoomStorage({catalog,furniture,owner:'guest',presentationScale:(item,asset)=>furniturePresentationScale(item,{kind:'apartment'},asset),owned:()=>['old-chair'],storage:{getItem:k=>data.get(k),setItem(k,v){writes++;data.set(k,v);}},getBounds:()=>[{x:0,y:0,w:200,h:200}]});
 assert.equal(room.load().ok,true);assert.equal(writes,0);assert.equal(data.get(ROOM_KEY),raw);assert.deepEqual(room.snapshot(),[record]);
 assert.deepEqual(roomItemBoxes(record,catalog,(item,asset)=>furniturePresentationScale(item,{kind:'apartment'},asset)),furnitureFacingBoxes(a,presentedRoomItem(record,{kind:'apartment'})));
 const placed=room.place('old-chair',12,100,0);assert.equal(placed.ok,true,'A native-size private chair fits near the wall where the old full-size display would not');assert.equal(placed.item.scale,.75);assert.equal(room.snapshot()[0].x,12);
 const altered=JSON.parse(data.get(ROOM_KEY));altered.items[0].scale=.1;data.set(ROOM_KEY,JSON.stringify(altered));assert.equal(room.load().ok,false,'Presentation scaling never permits a forged smaller product size');
});

function body(item){
 const boxes=furnitureFacingBoxes(catalog.get(item.asset),item),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
test('all31 homes retain inward-facing native dining chairs, including the approved three-chair Victorian arrangement',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request),family=scene.familyFurniture,table=scene.items.find(i=>i.id===family?.diningTable);assert(table,scene.id+' family dining table');
  const approvedVictorian=scene.id==='showroom-victorian-parlor';
  assert.equal(table.asset,'family-'+(scene.resident||'showroom-'+scene.showroomId)+'-dining-table');assert.equal(family.diningSeats.length,approvedVictorian?3:6,scene.id+' approved dining places');
  const t=body(table),facings=[];
  for(const id of family.diningSeats){
   const seat=scene.items.find(i=>i.id===id),s=body(seat),a=catalog.get(seat.asset),turn=(seat.rotation||0)/90,angle=turn*Math.PI/2,dx=t.cx-s.cx,dy=t.cy-s.cy;
   assert.equal(seat.seatingTarget,table.id);assert.equal(seat.roomExpansion,'family-room-1');near(seat.w,a.w*.50,'Dining chair retains approved person scale');
   const front={x:-Math.sin(angle),y:Math.cos(angle)};assert(front.x*dx+front.y*dy>0,scene.id+' chair faces its table');
   const horizontal=turn%2!==0,gap=horizontal?Math.abs(dx)-(s.w+t.w)/2:Math.abs(dy)-(s.h+t.h)/2;
   if(scene.id==='showroom-midcentury-studio'||approvedVictorian)assert(gap>=0,'The approved tucked-in dining chairs stay outside their table');
   else near(gap,22,scene.id+' table-to-chair clearance');
   assert(horizontal?Math.abs(dy)<=t.h/2:Math.abs(dx)<=t.w/2,'Every chair serves a real section of tabletop');facings.push(seat.rotation||0);
  }
  assert.deepEqual(facings.sort((a,b)=>a-b),approvedVictorian?[90,180,270]:[0,0,90,180,180,270]);
  assert(family.livingSeats.length>=3,scene.id+' conversation seating');assert(scene.items.some(i=>i.id===family.livingTable&&i.asset.startsWith('family-')));
  assert(family.bedroomNook,scene.id+' bedroom reading nook');const nook=scene.items.find(i=>i.id===family.bedroomNook.seat);assert.equal(nook.seatingTarget,family.bedroomNook.table);
  assert(scene.items.some(i=>i.designRole==='family-statement-plant'),scene.id+' large indoor greenery');assert(scene.items.some(i=>i.designRole==='bedroom-plant'),scene.id+' bedroom greenery');
 }
});

test('large living rugs preserve aspect and share the same room-fit scale with palette and owned furniture',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request),rug=scene.items.find(i=>i.designRole==='family-living-rug'),a=catalog.get(rug?.asset),zone=scene.familyFurnitureZones.living;assert(a,scene.id+' grand living rug');
  near(rug.w/rug.h,1.5,'Grand rug aspect');assert(rug.w<=zone.w-24+1e-8&&rug.h<=zone.h-24+1e-8,scene.id+' rug fits the actual conversation area');
  const saved={asset:a.id,x:rug.x,y:rug.y,scale:1,rotation:0},projected=presentedRoomItem(saved,scene,catalog);near(a.w*projected.scale,rug.w,'Saved/palette/default rug width');near(a.h*projected.scale,rug.h,'Saved/palette/default rug height');
 }
 const bach=getInterior({kind:'apartment',resident:'bach'}),rug=bach.items.find(i=>i.designRole==='family-living-rug'),old=bach.items.find(i=>!i.roomExpansion&&catalog.get(i.asset)?.slot==='rug');assert(rug.w>old.w*1.8&&rug.h>old.h*1.8,'The main living rug expands the seating area without enlarging its furniture');
});

function walkable(scene,step=6){
 const offset=step/2,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),seen=new Uint8Array(cols*rows),state=new Uint8Array(cols*rows),queue=[];
 const blocked=p=>p.x<34||p.y<112||p.x>scene.width-34||p.y>scene.height-34||scene.solids.some(b=>p.x>=b.x-6&&p.x<=b.x+b.w+6&&p.y>=b.y-6&&p.y<=b.y+b.h+6);
 const clear=(x,y)=>{const k=y*cols+x;if(!state[k])state[k]=blocked({x:x*step+offset,y:y*step+offset})?2:1;return state[k]===1;};
 const sx=Math.floor(scene.spawn.x/step),sy=Math.floor(scene.spawn.y/step);for(let y=sy-1;y<=sy+1;y++)for(let x=sx-1;x<=sx+1;x++)if(clear(x,y)){const k=y*cols+x;if(!seen[k]){seen[k]=1;queue.push(k);}}
 for(let n=0;n<queue.length;n++){const k=queue[n],x=k%cols,y=Math.floor(k/cols);for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=Y*cols+X;if(X<0||Y<0||X>=cols||Y>=rows||seen[next]||!clear(X,Y))continue;seen[next]=1;queue.push(next);}}
 return p=>{if(blocked(p))return false;const x=Math.floor(p.x/step),y=Math.floor(p.y/step);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&Y>=0&&X<cols&&Y<rows&&seen[Y*cols+X]&&Math.hypot(X*step+offset-p.x,Y*step+offset-p.y)<9)return true;}return false;};
}
test('a real player can approach every family dining, conversation and bedroom seat from the doorway',()=>{
 for(const request of privateScenes){
  const scene=getInterior(request),reaches=walkable(scene);
  for(const item of scene.items.filter(i=>i.seatingTarget)){
   const s=body(item),turn=(item.rotation||0)/90,angle=turn*Math.PI/2,front={x:-Math.sin(angle),y:Math.cos(angle)},depth=turn%2?s.w:s.h,at={x:s.cx+front.x*(depth/2+8),y:s.cy+front.y*(depth/2+8)};
   if(scene.id==='showroom-midcentury-studio'||scene.id==='showroom-victorian-parlor'){
    // The owner's dining edit tucks chairs close to the table. A person
    // approaches these seats from the aisle beside or behind the chair.
    const aisle=[at,{x:s.cx,y:s.y-8},{x:s.cx,y:s.y+s.h+8},{x:s.x-8,y:s.cy},{x:s.x+s.w+8,y:s.cy}];
    assert(aisle.some(reaches),scene.id+' cannot approach the approved seat '+item.id);
   }else assert(reaches(at),scene.id+' cannot approach '+item.id+' at '+JSON.stringify(at));
  }
 }
});

test('real cardinal seating silhouettes leave the broad low coffee table visible in every U-shaped lounge',()=>{
 const json=name=>JSON.parse(readFileSync(new URL('../assets/apartment-collections/'+name,import.meta.url),'utf8')),manifest=json('manifest.json');
 const runtime=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest:json('directions-manifest.json'),thumbnails:new Map(manifest.collections.map(c=>[c.owner,{width:1,height:1}])),loadImage(){throw Error('Metadata checks must not load art');},createCanvas(){throw Error('Metadata checks must not rasterize art');}});
 let groups=0;
 for(const request of privateScenes){
  const scene=getInterior(request),family=scene.familyFurniture,side=scene.items.find(i=>i.designRole==='family-lounge-sofa');if(!side)continue;groups++;
  const table=scene.items.find(i=>i.id===family.livingTable),top=furnitureFacingBounds(catalog.get(table.asset),table);
  for(const item of scene.items.filter(i=>family.livingSeats.includes(i.id))){
   const a=catalog.get(item.asset),native={...a,getFacingView:direction=>runtime.view(a.id,direction)},image=furnitureFacingBounds(native,item);
   if(item===side){assert([90,270].includes(item.rotation),'High sofa backs stay on the side of the group');assert(!overlaps(image,top),scene.id+' side sofa covers its low table');}
   else if(item.rotation===180)assert(image.y>=top.y+top.h+4,scene.id+' foreground chair back hides the coffee-table front');
  }
 }
 assert(groups>=20,'The roomy floor plates retain generous U-shaped seating');
});

test('Bach and Handel reading tables use a reachable side approach without moving their furniture',()=>{
 for(const resident of ['bach','handel']){
  const scene=getInterior({kind:'apartment',resident}),table=scene.items.find(i=>i.id===scene.familyFurniture.bedroomNook.table),seat=scene.items.find(i=>i.id===scene.familyFurniture.bedroomNook.seat),t=body(table),s=body(seat),approach=scene.homePlan.fixtureApproaches.find(p=>p.asset===table.asset),reaches=walkable(scene,8);
  near(table.x,280.28,'Reading table anchor stays approved');near(table.y,422,'Reading table depth stays approved');near(s.y-t.y-t.h,20,'The approved nook furniture gap stays unchanged');
  assert(!reaches({x:t.cx,y:t.y+t.h+12}),'The old target lies between the8px navigation rows');
  near(approach.x,t.x-12,'The interaction approaches the accessible table side');near(approach.y,t.cy,'Side approach aligns with the tabletop');assert(reaches(approach),resident+' can reach the side target on the production8px grid');assert.deepEqual(table.approach,{x:approach.x,y:approach.y});
 }
});
