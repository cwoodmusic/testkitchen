import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,COLS,ROWS} from './model.mjs';
import {buildNPCDistrict,npcDistrictPoint,npcDistrictFacing} from './npc-district.mjs';

const tower={id:'coda-residences',name:'Coda Residences',w:1000,h:2500,urban:'tower',footprint:{x:100,y:1700,w:800,h:700},door:{x:500,y:2440},boxes:[{x:100,y:1700,w:800,h:700}]};
const shop={id:'coda-furnishings',name:'Coda Furnishings',w:1200,h:1000,urban:'shop',footprint:{x:40,y:100,w:1120,h:800},door:{x:600,y:930},boxes:[{x:40,y:100,w:1120,h:800}]};
const square={id:'music-square',w:2400,h:1600,boxes:[{x:950,y:580,w:500,h:400}]};
const bench={id:'decor-06-01',name:'Carved oak park bench',w:160,h:118,boxes:[{x:25.6,y:89.68,w:108.8,h:25.96}]};
const cart={id:'decor-07-06',name:'Coffee cart',w:172,h:160,boxes:[{x:27.5,y:121.6,w:116.9,h:35.2}]};
const catalog=new Map([tower,shop,square,bench,cart].map(a=>[a.id,a]));
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
