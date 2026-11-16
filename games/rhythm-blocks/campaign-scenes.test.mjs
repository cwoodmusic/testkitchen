import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {CAMPAIGN_PLAN} from './campaign-data.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {SCENES} from './scenes.mjs';
import {CAMPAIGN_SCENES,getCampaignScene} from './campaign-scenes.mjs';
import {createRoomWalker,findPath,isWalkable} from './room.mjs';

const allLocations=[...CAMPAIGN_PLAN.rooms,...CAMPAIGN_PLAN.terminals];
const canonical=id=>['garden','workshop','canal'].includes(id)?`depot-${id}`:id;

test('every authored room and ending is a distinct walking scene',()=>{
 assert.equal(allLocations.length,23);
 assert.deepEqual(new Set(Object.keys(CAMPAIGN_SCENES)),new Set(allLocations.map(room=>room.id)));
 assert.equal(new Set(Object.values(CAMPAIGN_SCENES).map(scene=>scene.image)).size,23,'Each destination has its own artwork.');
 for(const location of allLocations){
  const scene=getCampaignScene(location.id);
  assert.equal(scene.title,location.title);
  assert.equal(scene.geometry.width,1536);assert.equal(scene.geometry.height,1024);
  assert.equal(new Set(scene.objects.map(item=>item.id)).size,scene.objects.length);
  assert.deepEqual(new Set(scene.objects.map(item=>item.id)),new Set(scene.geometry.targets.map(item=>item.id)));
  assert(Object.isFrozen(scene));assert(Object.isFrozen(scene.geometry.targets));
  if(location.kind){assert.equal(scene.kind,location.kind);assert.equal(scene.objects.filter(item=>item.type==='door').length,0);}
 }
 for(const [id,scene]of Object.entries(SCENES))assert.equal(CAMPAIGN_SCENES[id],scene,'Shipped room art, canary and fitted objects stay intact.');
 for(const invalid of [undefined,null,'missing-room','__proto__','constructor'])assert.equal(getCampaignScene(invalid),null);
});

test('all twenty-two paid door hit regions match their authored locations and reveal gates',()=>{
 const actual=Object.values(CAMPAIGN_SCENES).flatMap(scene=>scene.objects.filter(item=>item.type==='door').map(item=>({room:scene.id,door:item,target:scene.geometry.targets.find(target=>target.id===item.id)})));
 assert.equal(actual.length,22);
 for(const room of CAMPAIGN_PLAN.rooms)for(const expected of room.doors){
  const entry=actual.find(item=>canonical(item.door.doorId??item.door.id)===expected.id);
  assert(entry,expected.id);assert.equal(entry.room,room.id);
  assert.equal(entry.door.revealAfter,expected.revealAfter);
  assert.equal(entry.target.revealAfter,expected.revealAfter);
 }
});

test('all seven note supplies are bound to exactly one physical interaction',()=>{
 const sources=CAMPAIGN_PLAN.rooms.flatMap(room=>room.sources.map(source=>({...source,roomId:room.id})));
 const bindings=Object.values(CAMPAIGN_SCENES).flatMap(scene=>scene.objects.filter(item=>item.sourceId).map(item=>({scene,item})));
 assert.equal(sources.length,7);assert.equal(bindings.length,7);
 for(const source of sources){
  const matches=bindings.filter(binding=>binding.item.sourceId===source.id);assert.equal(matches.length,1,source.id);
  const {scene,item}=matches[0];assert.equal(scene.id,source.roomId);
  if(source.type==='hidden'){
   assert.equal(item.type,'inspect');
   const target=scene.geometry.targets.find(target=>target.id===item.id);assert.equal(target.sourceId,source.id);
   const lore=CAMPAIGN_CONTENT[scene.id].inspections.find(entry=>entry.id===item.id);assert.equal(lore.sourceId,source.id);
   assert.equal(lore.placement,'left','The discoverable physical cache is a lower-left story prop.');
  }
 }
});

test('every person, prop, cache, gate and south return can be approached on valid floor',()=>{
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const room=scene.geometry,walker=createRoomWalker({room});assert(isWalkable(room,walker.state),scene.id);
  for(const target of room.targets){
   assert(isWalkable(room,target.approach),`${scene.id}/${target.id} leaves room to interact`);
   assert(walker.approach(target.id),`${scene.id}/${target.id} is reachable`);
   let frames=0;
   while(walker.state.moving&&frames++<1000){walker.update(50);assert(isWalkable(room,walker.state),`${scene.id}/${target.id} crossed solid feet`);}
   assert(frames<1000);assert(walker.withinReach(target.id),`${scene.id}/${target.id} finishes within reach`);
  }
 }
});

test('new rooms have connected open floor rather than isolated pockets behind furniture',()=>{
 for(const scene of Object.values(CAMPAIGN_SCENES).filter(scene=>!Object.hasOwn(SCENES,scene.id))){
  const room=scene.geometry,{bounds,radius}=room;
  for(let y=bounds.y+radius;y<=bounds.y+bounds.height-radius;y+=80)for(let x=bounds.x+radius;x<=bounds.x+bounds.width-radius;x+=80){
   if(isWalkable(room,{x,y}))assert(findPath(room,room.start,{x,y}),`${scene.id} traps floor at ${x},${y}`);
  }
  for(const x of [600,930])for(let y=Math.max(330,bounds.y+radius);y<=920;y+=20)assert(isWalkable(room,{x,y}),`${scene.id} obstructs its clear aisle`);
 }
});

test('each scene pairs its visible companion feet and three distinct story props with content',()=>{
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const content=CAMPAIGN_CONTENT[scene.id];assert(content);
  assert.deepEqual(new Set(scene.actors.map(actor=>actor.id)),new Set(content.people.map(person=>person.id)));
  for(const actor of scene.actors){
   const target=scene.geometry.targets.find(target=>target.id===actor.id),obstacle=scene.geometry.obstacles.find(obstacle=>obstacle.id===actor.id);
   assert.deepEqual({x:target.x,y:target.y},actor.feet);assert.equal(actor.worldSize,160);assert(obstacle);
  }
  const inspections=scene.objects.filter(item=>item.type==='inspect');
  assert.deepEqual(new Set(inspections.map(item=>item.id)),new Set(content.inspections.map(item=>item.id)));
  if(!Object.hasOwn(SCENES,scene.id)){
   assert.equal(inspections.length,3);
   assert.equal(new Set(content.inspections.map(item=>item.placement)).size,3);
   assert.equal(scene.objects.filter(item=>item.type==='return').length,1);
   assert.equal(scene.objects.find(item=>item.type==='return').id,'return-previous');
  }
 }
});

test('all scene artwork exists and foreground contours stay on physical furniture',()=>{
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  assert(existsSync(new URL(scene.image,import.meta.url)),`${scene.id} has downloadable artwork`);
  if(Object.hasOwn(SCENES,scene.id))continue;
  assert(scene.occluders.length>=1,`${scene.id} fits its foreground furniture`);
  assert.equal(new Set(scene.occluders.map(item=>item.id)).size,scene.occluders.length);
  for(const item of scene.occluders){
   assert(!scene.actors.some(actor=>actor.id===item.id),'Foreground art never includes a duplicate companion.');
   assert.match(item.clipPath,/^path\(evenodd,'M[^']+Z'\)$/);
   const points=[...item.clipPath.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}));
   assert(points.length>=6,`${scene.id}/${item.id} has a fitted contour`);
   for(const point of points)assert(point.x>=0&&point.x<=1536&&point.y>=0&&point.y<=1024);
   const xs=points.map(point=>point.x),ys=points.map(point=>point.y);
   assert(Math.max(...xs)-Math.min(...xs)<=400,'Contours cover one furnishing, not a room-size floor slab.');
   assert(Math.max(...ys)-Math.min(...ys)<=400);
   assert(item.depth>=Math.max(...ys)&&item.depth-Math.max(...ys)<=8,'Draw order changes at the visible furniture feet.');
   assert(points.every(point=>point.x<400)||points.every(point=>point.x>1100),'The central walking floor is never copied over an actor.');
  }
 }
});

test('generated art anchors keep the real doors, wall props and flat practice patch aligned',()=>{
 const fork=getCampaignScene('canal-fork');
 assert.deepEqual(fork.objects.filter(item=>item.type==='door').map(item=>item.rect.x+item.rect.width/2),[430,1110]);
 for(const [id,prop]of [
  ['garden-fork','garden-fork-buried-ring'],
  ['garden-alcove','garden-alcove-root-cradle'],
  ['canal-final','canal-final-keeper-flask'],
  ['canal-final','canal-final-reply-dish']
 ]){
  const scene=getCampaignScene(id),object=scene.objects.find(item=>item.id===prop);
  assert(object.rect.y+object.rect.height<=scene.geometry.bounds.y+5,`${prop} remains on its pictured north wall`);
  assert(!scene.geometry.obstacles.some(item=>item.id===`${prop}-base`),'Wall-mounted props do not block open floor.');
 }
 assert(!getCampaignScene('workshop-final').geometry.obstacles.some(item=>item.id==='workshop-final-practice-patches-base'),'The flat practice mat is walkable.');
});
