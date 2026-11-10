import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {OPERA_BUILDING,OPERA_FOOTPRINT} from './opera-building.mjs';

function fixture(rotation){
 const a=OPERA_BUILDING,doc=blank(),o={id:'opera-fixture',asset:a.id,x:8192,y:6144,scale:1,rotation,collision:true,layer:'objects'};
 doc.objects=[o];doc[Symbol.for('coda.town.collisionRadius')]=18;
 const catalog=new Map([[a.id,a]]),r=rotation*Math.PI/180;
 return {hit(x,y){
  const dx=x-a.w/2,dy=y-a.h,px=o.x+dx*Math.cos(r)-dy*Math.sin(r),py=o.y+dx*Math.sin(r)+dy*Math.cos(r);
  return blocked(doc,px,py,catalog);
 }};
}

test('opera floor plate keeps concert-hall scale independently of tall sail artwork',()=>{
 const a=OPERA_BUILDING;
 assert.deepEqual(OPERA_FOOTPRINT,{x:256,y:80,w:4096,h:2560});
 assert.equal(a.fixedScale,true);
 assert.equal(a.artwork.w/a.artwork.h,a.native.w/a.native.h,'The native sails must keep their aspect ratio');
 assert(a.artwork.x>=0&&a.artwork.y>=0&&a.artwork.x+a.artwork.w<=a.w&&a.artwork.y+a.artwork.h<=a.h);
 assert.equal(a.front,OPERA_FOOTPRINT.y+OPERA_FOOTPRINT.h);
 assert(a.door.y>a.front+18,'An NPC must fit outside the glass threshold');
});

test('opera foyer and side parapets block pedestrians while transparent rear corners stay clear in all rotations',()=>{
 const solids=[[2304,2580],[780,2540],[3890,2520],[440,3050],[4150,3050]],clear=[[128,128],[4480,128],[2304,3136]];
 for(const rotation of [0,90,180,270]){
  const f=fixture(rotation);
  for(const[x,y]of solids)assert(f.hit(x,y),`Expected solid masonry at ${x},${y} with rotation ${rotation}`);
  for(const[x,y]of clear)assert(!f.hit(x,y),`Expected clear ground at ${x},${y} with rotation ${rotation}`);
 }
});

test('an NPC can walk the central exterior steps to the door and return in all rotations',()=>{
 const {door,approach}=OPERA_BUILDING;
 for(const rotation of [0,90,180,270]){
  const f=fixture(rotation);
  for(let i=0;i<=24;i++){
   const t=i/24,x=approach.x+(door.x-approach.x)*t,y=approach.y+(door.y-approach.y)*t;
   assert(!f.hit(x,y),`Stair approach must remain clear at ${x},${y} with rotation ${rotation}`);
  }
 }
 assert(OPERA_BUILDING.frontAtX(door.x)<door.y-18,'Door depth must put returning pedestrians in front of the foyer');
});
