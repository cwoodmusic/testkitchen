import test from 'node:test';
import assert from 'node:assert/strict';
import {cardinalFacing,facingRotation,furnitureFootprintBounds,furnitureFootCenter,furnitureAtGroundCenter,furnitureFacingPlacement,furnitureFacingBounds,furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs';
import {spriteBounds,intersectsViewport} from './render-visibility.mjs';
import {blank,blocked} from './model.mjs';
import {createPlayerCollisionIndex} from './player-collision-index.mjs';
import {LEGACY_FURNITURE_ASSETS} from './legacy-furniture-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';

const directions=['south','west','north','east'];

test('new cardinal arrangements keep the intended floor centre at every facing and scale',()=>{
 const asset={w:152,h:190,boxes:[{x:10,y:166,w:42,h:22}]},center={x:700,y:900};
 for(const rotation of [0,90,180,270])for(const scale of [.6,1,1.8]){
  const item=furnitureAtGroundCenter(asset,{w:asset.w*scale,h:asset.h*scale,rotation},center),box=furnitureFacingBoxes(asset,item)[0];
  assert(Math.abs(box.x+box.w/2-center.x)<1e-9);assert(Math.abs(box.y+box.h/2-center.y)<1e-9);
  assert.equal(item.rotation,rotation);
 }
});
function furniture(){
 const views={south:{w:200,h:300,footCenter:{x:100,y:245}},west:{w:120,h:340,footCenter:{x:60,y:245}},north:{w:210,h:310,footCenter:{x:105,y:255}},east:{w:122,h:342,footCenter:{x:61,y:247}}};
 let reads=0,metadata=0;
 const a={id:'collection-test-sofa',w:200,h:300,boxes:[{x:30,y:210,w:140,h:70}],canvas:{name:'old-south'},getFacingView(d,options){metadata++;assert.equal(typeof options.image,'boolean');return views[d];},getFacingImage(d){reads++;return {name:d};}};
 return {a,views,get reads(){return reads;},get metadata(){return metadata;}};
}
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} should equal ${b}`);

test('saved map turns retain their existing south/west/north/east meaning',()=>{
 assert.deepEqual([0,90,180,270].map(cardinalFacing),directions);
 assert.equal(cardinalFacing(450),'west');assert.equal(cardinalFacing(-90),'east');
 for(const d of directions)assert.equal(cardinalFacing(facingRotation(d)),d);
});

test('upright directional frames align with the centre of the unchanged rotated physical base',()=>{
 const {a}=furniture(),expected=[{x:1000,y:945},{x:1055,y:1000},{x:1000,y:1055},{x:945,y:1000}];
 for(const [i,rotation]of [0,90,180,270].entries()){
  const o={x:1000,y:1000,rotation,scale:1},p=furnitureFacingPlacement(a,o);
  assert.equal(p.direction,directions[i]);assert.equal(p.image.name,directions[i]);assert.equal(p.rotation,0);
  assert.deepEqual(p.groundCenter,expected[i]);assert.deepEqual(p.screenFootCenter,expected[i]);
  near(p.x+p.view.footCenter.x,p.groundCenter.x);near(p.y+p.view.footCenter.y,p.groundCenter.y);
  assert.deepEqual(p.bounds,{x:p.x,y:p.y,w:p.w,h:p.h});
  if(rotation===0)assert.deepEqual(p.bounds,{x:900,y:700,w:200,h:300},'An authored south view keeps the exact original anchor');
 }
});

test('height projection affects pictured art but not its ground anchor or layer depth',()=>{
 const {a}=furniture(),o={x:1800,y:1600,rotation:90,scale:1.5};
 const ground=furnitureFacingPlacement(a,o),raised=furnitureFacingPlacement(a,o,{x:o.x,y:o.y-144,offset:1});
 assert.deepEqual(raised.groundCenter,ground.groundCenter);near(raised.x,ground.x);near(raised.y,ground.y-144);
 assert.equal(furnitureFacingDepth(a,o),1705);assert.equal(raised.w,180);assert.equal(raised.h,510);
});

test('legacy physical bases quarter-turn exactly and zero-degree room arithmetic remains byte-compatible',()=>{
 const {a}=furniture(),o={x:1000,y:1000,scale:1};
 const expected=[{x:930,y:910,w:140,h:70},{x:1020,y:930,w:70,h:140},{x:930,y:1020,w:140,h:70},{x:910,y:930,w:70,h:140}];
 [0,90,180,270].forEach((rotation,i)=>assert.deepEqual(furnitureFacingBoxes(a,{...o,rotation}),[expected[i]]));
 const old={w:53,h:87,boxes:[{x:7,y:49,w:31,h:29}]},item={x:164.3,y:288.9,scale:.8};
 assert.deepEqual(furnitureFacingBoxes(old,item),old.boxes.map(b=>({x:item.x+(b.x-old.w/2)*item.scale,y:item.y+(b.y-old.h)*item.scale,w:b.w*item.scale,h:b.h*item.scale})));
 assert.deepEqual(furnitureFacingBounds(old,item),{x:item.x-old.w*item.scale/2,y:item.y-old.h*item.scale,w:old.w*item.scale,h:old.h*item.scale});
});

test('off-centre multi-part furniture uses all native boxes and polygons for its anchor',()=>{
 const a={w:300,h:400,boxes:[{x:10,y:340,w:30,h:40}],polygons:[[[120,300],[200,300],[190,390]]]};
 assert.deepEqual(furnitureFootprintBounds(a),{x:10,y:300,w:190,h:90,cx:105,cy:345});assert.deepEqual(furnitureFootCenter(a),{x:105,y:345});
 assert.deepEqual(furnitureFootCenter({w:150,h:160,boxes:[]}),{x:75,y:160});
});

test('metadata culling follows upright art and never reads or warms offscreen directional imagery',()=>{
 const f=furniture(),o={x:1000,y:1000,rotation:90,scale:1},pose={x:1000,y:1000,offset:1};
 const b=spriteBounds(f.a,o,pose);assert.deepEqual(b,{x:995,y:755,w:120,h:340});assert.equal(f.reads,0);
 assert.equal(intersectsViewport(b,{x:1000,y:760,w:60,h:80}),true,'The upright back remains visible');
 assert.equal(intersectsViewport(b,{x:1150,y:950,w:100,h:80}),false,'A stale sideways PNG quad must not determine visibility');
 assert.deepEqual(furnitureFacingBounds(f.a,o,pose),b);assert.equal(f.reads,0);
 furnitureFacingPlacement(f.a,o,pose);assert.equal(f.reads,1);
});

test('explicit legacy dimensions preserve exact rotated physical centres without changing south bounds',()=>{
 const {a}=furniture(),o={x:1000,y:1000,w:100,h:150,rotation:0};
 assert.deepEqual(furnitureFacingPlacement(a,o).bounds,{x:950,y:850,w:100,h:150});
 const side=furnitureFacingPlacement(a,{...o,rotation:90});assert.deepEqual(side.groundCenter,{x:1027.5,y:1000});near(side.w,60);near(side.h,170);
});

test('canonical South bounds exactly equal old arithmetic for every legacy frame and fractional scale',()=>{
 for(const def of [...LEGACY_FURNITURE_ASSETS,...APARTMENT_COLLECTION_ASSETS]){
  if(def.wallMounted||def.layer==='ground')continue;
  const footCenter=furnitureFootCenter(def),a={...def,getFacingView(){return {w:def.w,h:def.h,footCenter};}};
  for(const scale of [1,.4,1.7])for(const offset of [1,.5]){
   const o={x:1234.25,y:2356.75,rotation:0,scale},pose={x:o.x,y:o.y-96,offset},p=furnitureFacingPlacement(a,o,pose,{includeImage:false});
   assert(p,def.id);assert.deepEqual(p.bounds,{x:pose.x-def.w*scale/2,y:pose.y-def.h*scale*offset,w:def.w*scale,h:def.h*scale},def.id+' must preserve exact South phase');
  }
 }
});

test('flat artwork, mounted props, trees and full building scenes retain their existing rendering geometry',()=>{
 const {a}=furniture(),o={x:1000,y:1000,rotation:90,scale:1};
 for(const extra of [{wallMounted:true},{layer:'ground'},{scene:true},{urban:'opera'},{group:'trees'},{id:'music-square'},{furnitureFacing:false}])assert.equal(furnitureFacingPlacement({...a,...extra},o),null);
 assert.equal(furnitureFacingPlacement(a,{...o,mount:{x:1,y:2}}),null);assert.equal(furnitureFacingPlacement(a,{...o,rotation:45}),null);
});

test('facing imagery cannot change saved-map collision or the player broad phase at any cardinal rotation',()=>{
 const {a,views}=furniture(),catalog=new Map([[a.id,a]]),legacyCatalog=new Map([[a.id,{w:a.w,h:a.h,boxes:a.boxes}]]),doc=blank(),object={id:'saved-sofa',asset:a.id,x:2800,y:2600,rotation:0,scale:1,collision:true,layer:'objects'};doc.objects.push(object);
 const index=createPlayerCollisionIndex({getProject:()=>doc,catalog});
 for(const scale of [.5,1,2])for(const rotation of [0,90,180,270]){
  object.scale=scale;object.rotation=rotation;
  const boxes=furnitureFacingBoxes(a,object),before=JSON.stringify(doc),view=index.view({x:object.x,y:object.y});
  furnitureFacingPlacement(a,object);assert.equal(JSON.stringify(doc),before);
  for(let y=object.y-500;y<=object.y+500;y+=29)for(let x=object.x-500;x<=object.x+500;x+=31){
   const expected=boxes.some(b=>x>b.x-10*scale&&x<b.x+b.w+10*scale&&y>b.y-10*scale&&y<b.y+b.h+10*scale);
   const physical=blocked(doc,x,y,legacyCatalog);
   assert.equal(blocked(doc,x,y,catalog),physical,'Directional imagery must preserve even the legacy trigonometric edge decisions');assert.equal(blocked(view,x,y,catalog),physical,'The player index must agree with the untouched model');
   // Exact quarter-turn geometry deliberately has no cos(270°) rounding.
   // Compare its mathematical box away from that legacy subpixel boundary.
   const onEdge=boxes.some(b=>[x-b.x+10*scale,x-b.x-b.w-10*scale,y-b.y+10*scale,y-b.y-b.h-10*scale].some(n=>Math.abs(n)<1e-7));
   if(!onEdge)assert.equal(physical,expected,`${rotation}° physical base at ${x},${y}`);
  }
 }
 const before=JSON.stringify(doc);views.west.w+=30;views.west.footCenter.x+=8;furnitureFacingPlacement(a,object);assert.equal(JSON.stringify(doc),before,'Even a different view frame cannot migrate saved placements');
});
