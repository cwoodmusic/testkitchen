import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST,CAST_IMAGE,NPC_WALKS} from './cast.mjs';
import {getNpcSpriteFrame} from './npc-sprites.mjs';
import {stageCutsceneScene} from './cutscene-view.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';

const project=()=>({settings:{castImage:CAST_IMAGE},cast:structuredClone(CAST)});
const actor={id:'nell',character:'nell',feet:{x:400,y:700}};
const frame=(p,pose,elapsed)=>getNpcSpriteFrame({project:p,actor,pose,elapsed});

test('all four stock NPCs have twelve directional frames and frozen boot anchors',()=>{
 for(const [id,sprite]of Object.entries(CAST)){
  assert.equal(sprite.walk,NPC_WALKS[id]);assert.equal(sprite.walk.image,`assets/${id}-walk.webp`);
  assert.deepEqual(sprite.walk.directions,['down','left','right','up']);
  assert.equal(sprite.walk.anchors.length,4);assert(sprite.walk.anchors.every(row=>row.length===3&&row.every(anchor=>anchor.length===2&&anchor.every(n=>n>=0&&n<=1))));
  assert(Object.isFrozen(sprite.walk));assert(Object.isFrozen(sprite.walk.anchors[0][0]));
 }
});

test('walking frames alternate exactly like Mira and direction changes choose true sprite rows',()=>{
 const p=project();
 for(const [row,facing]of ['down','left','right','up'].entries()){
  for(const [elapsed,expected]of [[0,1],[124,1],[125,0],[250,2],[375,0],[500,1]]){
   const selected=frame(p,{facing,moving:true},elapsed);
   assert.equal(selected.frame,expected);assert.equal(selected.row,row);assert.equal(selected.facing,facing);
   assert.deepEqual(selected.anchor,p.cast.nell.walk.anchors[row][expected]);assert.equal(selected.backgroundSize,'300% 400%');
   assert.equal(selected.backgroundPosition,`${expected*50}% ${row*100/3}%`);assert(selected.animated);
  }
  for(const elapsed of [0,250,999999]){const idle=frame(p,{facing,moving:false},elapsed);assert.equal(idle.frame,0);assert.equal(idle.row,row);}
 }
});

test('old saved stock projects without walk metadata gain the same directional frames',()=>{
 const current=project(),old=project();for(const sprite of Object.values(old.cast))delete sprite.walk;
 for(const facing of ['up','down','left','right'])for(const elapsed of [0,125,250,375])assert.deepEqual(frame(old,{facing,moving:true},elapsed),frame(current,{facing,moving:true},elapsed));
});

test('custom global artwork and edited portraits retain their own static sprite',()=>{
 const p=project();p.settings.castImage='assets/my-new-cast.webp';
 let selected=frame(p,{facing:'left',moving:true},250);
 assert.equal(selected.image,p.settings.castImage);assert.equal(selected.backgroundSize,'200% 200%');assert.equal(selected.frame,0);assert(!selected.animated);
 delete p.cast.nell.walk;selected=frame(p,{facing:'up',moving:true},250);assert.equal(selected.image,p.settings.castImage);assert(!selected.animated);
 const edited=project();edited.cast.nell.column=1;assert(!frame(edited,{moving:true},250).animated);
 const anchored=project();anchored.cast.nell.anchor=[.45,.9];assert(!frame(anchored,{moving:true},250).animated);
 const optedOut=project();optedOut.cast.nell.walk=false;assert(!frame(optedOut,{moving:true},250).animated);
});

test('an explicit custom walk sheet remains usable with custom global artwork',()=>{
 const p=project();p.settings.castImage='assets/custom-portraits.webp';p.cast.nell.walk.image='assets/custom-nell-walk.webp';p.cast.nell.walk.cellWidth=64;p.cast.nell.walk.cellHeight=96;
 const selected=frame(p,{facing:'up',moving:true},250);
 assert.equal(selected.image,'assets/custom-nell-walk.webp');assert(selected.animated);assert.equal(selected.frame,2);assert.equal(selected.row,3);assert.equal(selected.aspectRatio,2/3);
 const before=JSON.stringify(p);frame(p,{facing:'right',moving:true},375);assert.equal(JSON.stringify(p),before);
});

test('staging final and skipped poses retains each actor’s final facing',()=>{
 const scene=CAMPAIGN_SCENES.depot;
 for(const facing of ['down','left','right','up']){
  const staged=stageCutsceneScene(scene,scene.actors.map(item=>({id:item.id,...item.feet,facing})));
  for(const item of staged.actors)assert.equal(item.facing,facing);
  assert.deepEqual(staged.actors.map(item=>item.feet),scene.actors.map(item=>item.feet));
 }
 const original=scene.actors.find(item=>item.id==='nell');const staged=stageCutsceneScene(scene,[{id:'nell',...original.feet,facing:'sideways'}]);
 assert.equal(staged.actors.find(item=>item.id==='nell').facing,original.facing);
});
