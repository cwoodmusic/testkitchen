import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {createRoomCutscene} from './cutscene.mjs';
import {stageCutsceneScene} from './cutscene-view.mjs';
import {createRoomWalker,isWalkable} from './room.mjs';

const near=(actual,expected)=>assert(Math.abs(actual-expected)<.000001,`${actual} differs from ${expected}`);
function finalScene(scene){const timeline=createRoomCutscene({scene,beats:ROOM_CUTSCENES[scene.id]});timeline.seek(timeline.state.totalTiles);return{timeline,staged:stageCutsceneScene(scene,timeline.state.actors)};}
function walkToEveryTarget(scene,savedPosition=null){
 const room=scene.geometry,walker=createRoomWalker({room,savedPosition});assert(isWalkable(room,walker.state),`${scene.id} keeps a usable spawn`);
 if(savedPosition){near(walker.state.x,savedPosition.x);near(walker.state.y,savedPosition.y);}
 for(const target of room.targets){
  assert(isWalkable(room,target.approach),`${scene.id}/${target.id} has a real open-floor approach after the cast moves`);
  assert(walker.approach(target.id),`${scene.id}/${target.id} remains connected`);
  let frames=0;while(walker.state.moving&&frames++<1000){walker.update(50);assert(isWalkable(room,walker.state),`${scene.id}/${target.id} crossed solid feet`);}
  assert(frames<1000,`${scene.id}/${target.id} finishes walking`);
  assert(walker.withinReach(target.id),`${scene.id}/${target.id} must still be interactive after the arrival; distance ${Math.hypot(walker.state.x-target.x,walker.state.y-target.y)} exceeds range ${target.range}`);
 }
 return room.targets.length;
}

test('retained cutscene poses keep sprites, talk targets, collision feet and hotspots together in all 23 locations',()=>{
 const before=JSON.stringify(CAMPAIGN_SCENES);let actors=0;
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const {timeline,staged}=finalScene(scene);assert.notEqual(staged,scene);assert(Object.isFrozen(staged));
  assert.equal(staged.id,scene.id);assert.equal(staged.image,scene.image);assert.deepEqual(staged.geometry.start,scene.geometry.start);
  for(const actor of staged.actors){
   const pose=timeline.state.actors.find(item=>item.id===actor.id),original=scene.actors.find(item=>item.id===actor.id),dx=pose.x-original.feet.x,dy=pose.y-original.feet.y;
   near(actor.feet.x,pose.x);near(actor.feet.y,pose.y);
   const target=staged.geometry.targets.find(item=>item.id===actor.id);near(target.x,pose.x);near(target.y,pose.y);
   const base=scene.geometry.obstacles.find(item=>item.id===actor.id),foot=staged.geometry.obstacles.find(item=>item.id===actor.id);near(foot.x,base.x+dx);near(foot.y,base.y+dy);assert.equal(foot.width,base.width);assert.equal(foot.height,base.height);
   const originalHit=scene.objects.find(item=>item.id===actor.id),hit=staged.objects.find(item=>item.id===actor.id);near(hit.rect.x,originalHit.rect.x+dx);near(hit.rect.y,originalHit.rect.y+dy);assert.equal(hit.personId,originalHit.personId);
   actors++;
  }
  for(const target of scene.geometry.targets.filter(target=>target.type!=='person')){const actual=staged.geometry.targets.find(item=>item.id===target.id);near(actual.x,target.x);near(actual.y,target.y);assert.equal(actual.sourceId,target.sourceId);assert.equal(actual.revealAfter,target.revealAfter);}
 }
 assert.equal(actors,70);assert.equal(JSON.stringify(CAMPAIGN_SCENES),before,'Staging never rewrites shipped geometry.');
});

test('after every complete room opening every prop, person, door, chest and return is still reachable',()=>{
 let targets=0;
 for(const scene of Object.values(CAMPAIGN_SCENES))targets+=walkToEveryTarget(finalScene(scene).staged);
 assert.equal(targets,187);
});

test('early Skip also leaves every normal interaction reachable rather than trapping a moving companion',()=>{
 let targets=0;
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const timeline=createRoomCutscene({scene,beats:ROOM_CUTSCENES[scene.id]});for(let i=0;i<10;i++)timeline.update(100);timeline.skip();
  targets+=walkToEveryTarget(stageCutsceneScene(scene,timeline.state.actors));
 }
 assert.equal(targets,187);
});

test('missing, invalid, out-of-bounds and furniture-overlapping saved poses are ignored',()=>{
 const scene=CAMPAIGN_SCENES.depot,before=JSON.stringify(scene);
 for(const poses of [[],[{id:'missing',x:500,y:500}],[{id:'nell',x:NaN,y:650}],[{id:'nell',x:500,y:Infinity}],[{id:'nell',x:-9999,y:650}],[{id:'nell',x:99999,y:650}],[{id:'nell',x:160,y:350}], [null,{id:'iris',x:'790',y:550}]]){
  assert.equal(stageCutsceneScene(scene,poses),scene);
 }
 assert.equal(JSON.stringify(scene),before);
 const safe=stageCutsceneScene(scene,[{id:'nell',x:480,y:700},{id:'iris',x:NaN,y:550}]);assert.notEqual(safe,scene);assert.deepEqual(safe.actors.find(actor=>actor.id==='nell').feet,{x:480,y:700});assert.deepEqual(safe.actors.find(actor=>actor.id==='iris').feet,scene.actors.find(actor=>actor.id==='iris').feet);
 walkToEveryTarget(safe);
});

test('edited player and companion destinations retain playable end positions instead of respawning Mira',()=>{
 const scene=CAMPAIGN_SCENES.depot;
 for(const beat of [{speaker:'mira',actor:'mira',destination:{x:520,y:650}},{speaker:'nell',actor:'nell',destination:{x:818,y:920}}]){
  const timeline=createRoomCutscene({scene,beats:[{...beat,text:'',startTile:0,durationTiles:1}]});timeline.seek(timeline.state.totalTiles);
  const staged=stageCutsceneScene(scene,timeline.state.actors),mira=timeline.state.actors.find(actor=>actor.id==='mira');
  assert(isWalkable(staged.geometry,mira));walkToEveryTarget(staged,mira);
 }
 for(const order of [['nell','mira'],['mira','nell']]){
  const timeline=createRoomCutscene({scene,beats:order.map(actor=>({speaker:actor,actor,text:'',destination:{x:500,y:700},startTile:0,durationTiles:1}))});timeline.seek(timeline.state.totalTiles);
  const staged=stageCutsceneScene(scene,timeline.state.actors),mira=timeline.state.actors.find(actor=>actor.id==='mira');
  assert(isWalkable(staged.geometry,mira));walkToEveryTarget(staged,mira);
 }
});
