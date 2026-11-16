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

test('new rooms have no isolated floor pockets around their solid prop bases',()=>{
 for(const scene of Object.values(SCENES).filter(scene=>scene.id!=='depot')){
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

test('depot geometry and its fitted silhouettes remain intact',()=>{
 const depot=SCENES.depot;
 assert.equal(depot.geometry,DEPOT_ROOM);
 assert.equal(depot.image,'assets/parcel-depot.webp');
 assert.equal(depot.occluders.length,13);
 const rings=depot.occluders.filter(mask=>mask.id.endsWith('-ring'));
 assert.equal(rings.length,2);
 assert(rings.every(mask=>mask.clipPath.startsWith('path(evenodd,')),'Ring holes must not conceal floor or Mira.');
 for(const mask of depot.occluders){assert(mask.clipPath);assert(Number.isInteger(mask.depth));}
});

test('new NPC and foreground masks use art-foot depth and preserve open frames',()=>{
 for(const scene of Object.values(SCENES).filter(scene=>scene.id!=='depot')){
  assert.equal(new Set(scene.occluders.map(mask=>mask.id)).size,scene.occluders.length);
  for(const person of scene.objects.filter(object=>object.type==='person')){
   const target=scene.geometry.targets.find(target=>target.id===person.id);
   const mask=scene.occluders.find(mask=>mask.id===person.id);
   assert(mask,`${scene.id}/${person.id} needs a foreground silhouette`);
   assert.equal(mask.depth,target.y+1);
  }
  for(const mask of scene.occluders){assert(mask.clipPath.startsWith('path(evenodd,'));assert(Number.isInteger(mask.depth));}
 }
 for(const [room,id]of [['workshop-porch','flight-jig'],['canal-porch','mooring-bell']]){
  assert(SCENES[room].occluders.find(mask=>mask.id===id).clipPath.split('M').length>2,`${id} must retain visible floor inside its open frame`);
 }
});
