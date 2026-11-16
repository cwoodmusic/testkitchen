import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENES,getScene} from './scenes.mjs';
import {DEPOT_ROOM,createRoomWalker,findPath,isWalkable} from './room.mjs';

test('scene hit areas and walking targets describe the same objects',()=>{
 assert.deepEqual(Object.keys(SCENES),['depot','garden-porch','workshop-porch','canal-porch']);
 for(const scene of Object.values(SCENES)){
  assert.equal(getScene(scene.id),scene);
  assert.equal(new Set(scene.objects.map(object=>object.id)).size,scene.objects.length);
  assert.deepEqual(new Set(scene.objects.map(object=>object.id)),new Set(scene.geometry.targets.map(target=>target.id)),scene.id);
  for(const object of scene.objects){
   const target=scene.geometry.targets.find(target=>target.id===object.id);
   assert.equal(object.type,target.type,`${scene.id}/${object.id}`);
   const {x,y,width,height}=object.rect;
   assert([x,y,width,height].every(Number.isFinite));
   assert(x>=0&&y>=0&&width>0&&height>0&&x+width<=scene.geometry.width&&y+height<=scene.geometry.height,`${object.id} lies inside the artwork`);
  }
 }
 assert.equal(getScene('unbuilt-room'),null);
 assert.equal(getScene(undefined),null);
 for(const id of ['__proto__','constructor','toString'])assert.equal(getScene(id),null);
 assert(Object.isFrozen(SCENES));
 assert(Object.isFrozen(SCENES['garden-porch'].geometry.targets));
 assert(Object.isFrozen(SCENES['garden-porch'].objects[0].rect));
});

test('each scene can navigate between every person, source, prop and door',()=>{
 for(const scene of Object.values(SCENES)){
  const room=scene.geometry,walker=createRoomWalker({room});
  assert(isWalkable(room,room.start),scene.id);
  for(const target of room.targets){
   assert(isWalkable(room,target.approach),`${scene.id}/${target.id} has clear interaction floor`);
   assert(walker.approach(target.id),`${scene.id}/${target.id} has a route`);
   let frames=0;
   while(walker.state.moving&&frames++<1000){
    walker.update(50);
    assert(isWalkable(room,walker.state),`${scene.id}/${target.id} crossed an obstacle`);
   }
   assert(frames<1000,`${scene.id}/${target.id} must finish walking`);
   assert(walker.withinReach(target.id),`${scene.id}/${target.id} can be used after arrival`);
  }
 }
});

test('rooms have no isolated floor pockets around solid prop and actor bases',()=>{
 for(const scene of Object.values(SCENES)){
  const room=scene.geometry,{bounds,radius}=room;
  for(let y=bounds.y+radius;y<=bounds.y+bounds.height-radius;y+=64){
   for(let x=bounds.x+radius;x<=bounds.x+bounds.width-radius;x+=64){
    const point={x,y};
    if(isWalkable(room,point))assert(findPath(room,room.start,point),`${scene.id} traps floor at ${x},${y}`);
   }
  }
  for(const obstacle of room.obstacles){
   assert.equal(isWalkable(room,{x:obstacle.x+obstacle.width/2,y:obstacle.y+obstacle.height/2}),false,`${scene.id}/${obstacle.id} remains solid`);
  }
 }
});

test('source render data offers each branch reward at its intended interaction',()=>{
 const expected={depot:[['depot-chest','depot-chest'],['nell','nell-parcel']],'garden-porch':[['iris','iris-gift']],'workshop-porch':[['pip','pip-gift']],'canal-porch':[['canal-chest','canal-chest']]};
 for(const [id,sources]of Object.entries(expected)){
  assert.deepEqual(SCENES[id].objects.filter(object=>object.sourceId).map(object=>[object.id,object.sourceId]),sources);
 }
 for(const scene of Object.values(SCENES).filter(scene=>scene.id!=='depot')){
  assert.equal(scene.objects.filter(object=>object.type==='return').length,1);
  assert.equal(scene.objects.find(object=>object.type==='return').id,'return-depot');
  assert.equal(scene.objects.filter(object=>object.type==='door').length,2);
 }
});

test('each room stages the travelling party as separate, solid foreground actors',()=>{
 for(const scene of Object.values(SCENES)){
  assert.deepEqual(scene.actors.map(actor=>actor.id),scene.id==='canal-porch'?['nell','iris','pip','oren']:['nell','iris','pip']);
  assert.equal(new Set(scene.actors.map(actor=>actor.id)).size,scene.actors.length);
  for(const actor of scene.actors){
   const target=scene.geometry.targets.find(target=>target.id===actor.id);
   const button=scene.objects.find(object=>object.id===actor.id);
   const obstacle=scene.geometry.obstacles.find(obstacle=>obstacle.id===actor.id);
   assert.equal(button.type,'person');assert.equal(target.type,'person');
   assert.deepEqual({x:target.x,y:target.y},actor.feet,'Visible feet and interaction depth share an anchor.');
   assert.equal(actor.worldSize,160,'Companions use the same compact world scale in every room.');
   assert.equal(actor.character,actor.id);
   assert(obstacle,'Every actor has its own solid footbed.');
   assert.equal(isWalkable(scene.geometry,{x:obstacle.x+obstacle.width/2,y:obstacle.y+obstacle.height/2}),false);
   assert(isWalkable(scene.geometry,target.approach),'The front of a companion stays approachable.');
   assert(!scene.occluders.some(mask=>mask.id===actor.id),'A sprite supplies NPC alpha depth rather than an old baked-art mask.');
   assert(Object.isFrozen(actor.feet));
  }
 }
 assert.equal(SCENES.depot.geometry,DEPOT_ROOM);
 assert.equal(SCENES.depot.image,'assets/parcel-depot.webp');
});

test('spacious layouts provide at least twenty percent more accessible floor and two clear walking aisles',()=>{
 // Accessible 16px lattice samples from the prior shipped art-foot geometry.
 // This guards a user-visible space increase, not just a smaller painted sprite.
 const previous={depot:2702,'garden-porch':2707,'workshop-porch':2544,'canal-porch':2612};
 for(const scene of Object.values(SCENES)){
  let count=0;
  for(let y=8;y<1024;y+=16)for(let x=8;x<1536;x+=16)if(isWalkable(scene.geometry,{x,y}))count++;
  assert(count>=Math.ceil(previous[scene.id]*1.2),`${scene.id}: ${count} accessible samples versus ${previous[scene.id]} before`);
  for(const x of [600,930])for(let y=Math.max(310,scene.geometry.bounds.y+scene.geometry.radius);y<=920;y+=10)assert(isWalkable(scene.geometry,{x,y}),`${scene.id} closes its ${x}px walking aisle at ${y}`);
 }
});

test('foreground masks belong to furniture and retain explicit foot depth',()=>{
 for(const scene of Object.values(SCENES)){
  assert(scene.occluders.length>=3,'Floor furniture must retain foreground depth.');
  assert.equal(new Set(scene.occluders.map(mask=>mask.id)).size,scene.occluders.length);
  for(const mask of scene.occluders){
   assert(mask.clipPath.startsWith('path(evenodd,')||mask.clipPath.startsWith('polygon('));
   assert(Number.isInteger(mask.depth)&&mask.depth>250&&mask.depth<1024);
  }
 }
});

test('open instrument frames preserve floor holes in their foreground masks',()=>{
 for(const [room,id]of [['depot','route-orrery'],['workshop-porch','flight-jig'],['canal-porch','mooring-bell']]){
  const mask=SCENES[room].occluders.find(mask=>mask.id===id);
  assert(mask.clipPath.startsWith('path(evenodd,'));
  assert(mask.clipPath.split('M').length>2,`${id} keeps its floor openings transparent`);
 }
});
