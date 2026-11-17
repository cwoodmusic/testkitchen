import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';
import {createRoomCutscene} from './cutscene.mjs';
import {compileRoomEntry,createRoomEntry} from './room-entry.mjs';
import {isWalkable} from './room.mjs';

const clone=value=>structuredClone(value),EPS=.000001;
const near=(actual,expected)=>assert(Math.abs(actual-expected)<EPS,`${actual} differs from ${expected}`);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const actor=(state,id)=>state.actors.find(item=>item.id===id);
const point=value=>({x:value.x,y:value.y});
const heading=(from,to)=>Math.abs(to.x-from.x)>=Math.abs(to.y-from.y)?to.x>from.x?'right':'left':to.y>from.y?'down':'up';
function physicalRoom(scene){return{...scene.geometry,obstacles:scene.geometry.obstacles.filter(item=>!['mira','nell','iris','pip'].includes(item.id))};}

test('all 23 arrivals rush through the south doorway before reaching their existing room positions',()=>{
 const before=JSON.stringify(CAMPAIGN_SCENES);let clips=0;
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const entry=compileRoomEntry({scene}),floor=physicalRoom(scene);
  assert(!entry.blocked,scene.id);assert.equal(entry.clips.length,4,scene.id);assert.equal(entry.fadeTiles,6);assert.equal(entry.staggerTiles,1);assert.equal(entry.gait,'run');assert.equal(entry.speedMultiplier,2);
  if(!scene.layoutRevision)assert.equal(entry.totalTiles,16,'Unchanged rooms keep their original entrance timing.');
  assert(entry.totalTiles*entry.quantumMs<3000,'Even a divided room brings the whole party inside within three seconds at the authored running speed.');assert(entry.clips.at(-1).startTile*entry.quantumMs<400,'Everyone starts the rush within one short burst.');near(entry.quantumMs,scene.geometry.gridSize/scene.geometry.speed*1000);
  assert.deepEqual(entry.clips.map(clip=>clip.actor),['mira','nell','iris','pip']);
  for(const [index,clip]of entry.clips.entries()){
   assert.equal(clip.startTile,index);assert.equal(clip.gait,'run');assert.equal(clip.speedMultiplier,2);assert.equal(clip.from.x,entry.door.x);assert(clip.from.y>=scene.geometry.height+160);
   assert.deepEqual(clip.path[1],entry.mouth);assert(clip.path[0].y>clip.path[1].y);assert.equal(clip.path[0].x,clip.path[1].x);
   const desired=clip.actor==='mira'?scene.geometry.start:scene.actors.find(item=>item.id===clip.actor).feet;
   assert.deepEqual(clip.to,point(desired));assert(clip.endTile<=entry.totalTiles);
   near(clip.durationTiles,Math.ceil(clip.pathLength/(scene.geometry.gridSize*clip.speedMultiplier)));
   for(let vertex=1;vertex<clip.path.length;vertex++){
    const from=clip.path[vertex-1],to=clip.path[vertex];assert(Math.abs(from.x-to.x)<EPS||Math.abs(from.y-to.y)<EPS,`${scene.id}/${clip.actor} has a diagonal`);
    if(vertex===1)continue;
    const steps=Math.max(1,Math.ceil(distance(from,to)/4));
    for(let step=0;step<=steps;step++)assert(isWalkable(floor,{x:from.x+(to.x-from.x)*step/steps,y:from.y+(to.y-from.y)*step/steps}),`${scene.id}/${clip.actor} crosses furniture`);
   }
   clips++;
  }
  const iris=entry.clips.find(clip=>clip.actor==='iris'),mira=entry.endActors.find(item=>item.id==='mira');
  for(let index=2;index<iris.path.length;index++){
   const from=iris.path[index-1],to=iris.path[index],steps=Math.max(1,Math.ceil(distance(from,to)/2));
   for(let step=0;step<=steps;step++){
    const at={x:from.x+(to.x-from.x)*step/steps,y:from.y+(to.y-from.y)*step/steps};
    assert(distance(at,mira)>=scene.geometry.radius*2-EPS,'Iris goes around Mira instead of walking through the settled player.');
   }
  }
 }
 assert.equal(clips,92);assert.equal(JSON.stringify(CAMPAIGN_SCENES),before,'Planning does not rewrite authored geometry.');
});

test('the fast fade and tight stagger are deterministic while everyone runs at twice room speed',()=>{
 const scene=CAMPAIGN_SCENES.depot,entry=createRoomEntry({scene}),speed=scene.geometry.speed*2;
 assert.equal(entry.state.phase,'entry');assert.equal(entry.state.fadeOpacity,1);assert.equal(entry.state.beat,null);
 assert.equal(entry.state.actors.filter(actor=>actor.moving).length,1,'Only Mira starts the file at tile zero.');
 const seen=new Map(entry.state.actors.map(actor=>[actor.id,actor])),started=new Map();let frames=0,opacity=1;
 while(!entry.state.finished&&frames++<1000){
  entry.update(16);const current=entry.state;
  assert(current.fadeOpacity<=opacity+EPS);opacity=current.fadeOpacity;
  for(const pose of current.actors){
   assert(distance(pose,seen.get(pose.id))<=speed*.016+EPS,`${pose.id} cannot jump across the room.`);
   assert.equal(pose.action,null);assert.equal(pose.emote,null);assert.equal(pose.gait,pose.moving?'run':'walk');
   if(pose.moving&&!started.has(pose.id))started.set(pose.id,current.currentTile);
   seen.set(pose.id,pose);
  }
 }
 assert(frames<1000);assert.equal(opacity,0);assert.equal(entry.state.playing,false);
 assert.deepEqual([...started.keys()],['mira','nell','iris','pip']);
 assert.deepEqual(entry.state.actors,entry.timeline.endActors);
 const firstStory=createRoomCutscene({scene,actors:entry.timeline.endActors,beats:[{kind:'dialogue',id:'first-line',actor:'nell',speaker:'nell',text:'We are all inside.',startTile:0,durationTiles:10}]});
 for(const pose of firstStory.state.actors){const end=actor(entry.state,pose.id);near(pose.x,end.x);near(pose.y,end.y);assert.equal(pose.facing,end.facing);}
});

test('the running burst uses the same safe routes and destinations as a walking override in all rooms',()=>{
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const running=compileRoomEntry({scene}),slowScene=clone(scene);slowScene.entry={gait:'walk'};
  const walking=compileRoomEntry({scene:slowScene});
  near(running.quantumMs,walking.quantumMs);
  assert.equal(walking.gait,'walk');assert.equal(walking.speedMultiplier,1);
  assert(running.totalTiles<walking.totalTiles,`${scene.id} has a genuinely quicker entrance`);
  assert.deepEqual(running.endActors,walking.endActors);
  for(const fast of running.clips){
   const slow=walking.clips.find(clip=>clip.actor===fast.actor);
   assert.deepEqual(fast.path,slow.path);assert.deepEqual(fast.to,slow.to);
   near(fast.pathLength,slow.pathLength);near(slow.durationTiles,Math.ceil(slow.pathLength/scene.geometry.gridSize));
  }
  const burst=createRoomEntry({scene});burst.seek(3.25);
  const movers=burst.state.actors.filter(actor=>actor.moving);
  assert.equal(movers.length,4,`${scene.id} has the entire party running together`);
  assert(movers.every(actor=>actor.gait==='run'));
 }
 const scene=CAMPAIGN_SCENES.depot,fast=createRoomEntry({scene}),slowScene=clone(scene);slowScene.entry={gait:'walk'};
 const slow=createRoomEntry({scene:slowScene}),start=actor(fast.state,'mira');
 fast.update(50);slow.update(50);
 near(distance(actor(fast.state,'mira'),start),scene.geometry.speed*.05*2);
 near(distance(actor(slow.state,'mira'),start),scene.geometry.speed*.05);
 assert.equal(actor(fast.state,'mira').gait,'run');assert.equal(actor(slow.state,'mira').gait,'walk');
});

test('an explicit walking entrance preserves the older authored fade and party spacing',()=>{
 const scene=clone(CAMPAIGN_SCENES.depot);scene.entry={gait:'walk',fadeTiles:12,staggerTiles:2};
 const entry=createRoomEntry({scene});assert.equal(entry.timeline.totalTiles,32);
 assert.equal(entry.timeline.fadeTiles,12);assert.equal(entry.timeline.staggerTiles,2);
 assert.deepEqual(entry.timeline.clips.map(clip=>clip.startTile),[0,2,4,6]);
 entry.seek(3.25);assert(entry.state.actors.filter(actor=>actor.moving).every(actor=>actor.gait==='walk'));
 entry.seek(6);near(entry.state.fadeOpacity,.5);
 entry.skip();assert(entry.state.actors.every(actor=>!actor.moving&&actor.gait==='walk'));
});

test('resident Oren stays inside while the travelling party enters',()=>{
 const scene=CAMPAIGN_SCENES['canal-porch'],entry=createRoomEntry({scene}),original=scene.actors.find(actor=>actor.id==='oren');
 const expected=point(original.feet);
 assert(!entry.timeline.clips.some(clip=>clip.actor==='oren'));
 for(const tile of [0,1,4,12,20,entry.timeline.totalTiles]){
  entry.seek(tile);const oren=actor(entry.state,'oren');assert.deepEqual(point(oren),expected);assert.equal(oren.moving,false);assert.equal(oren.gait,'walk');assert.equal(oren.emote,null);assert.equal(oren.facing,original.facing??'down');
 }
});

test('all 23 entrances keep the last walking heading through landing and the story handoff',()=>{
 let landings=0;
 for(const scene of Object.values(CAMPAIGN_SCENES)){
  const entry=createRoomEntry({scene}),quantum=entry.timeline.quantumMs;
  for(const clip of entry.timeline.clips){
   const finishTile=clip.startTile+clip.pathLength/(scene.geometry.gridSize*clip.speedMultiplier);
   entry.seek(finishTile-.001);const walking=actor(entry.state,clip.actor);
   assert(walking.moving,`${scene.id}/${clip.actor} is still approaching its station`);
   entry.seek(finishTile+.001);const landed=actor(entry.state,clip.actor);
   assert(!landed.moving);near(landed.x,clip.to.x);near(landed.y,clip.to.y);
   assert.equal(landed.facing,walking.facing,`${scene.id}/${clip.actor} must not turn to a portrait pose on landing`);
   assert.equal(actor({actors:entry.timeline.endActors},clip.actor).facing,walking.facing);
   landings++;
  }
  // Sample the final 20 real-size frames, including the last companion's
  // landing. Waiting companions keep their heading instead of turning south.
  entry.seek(entry.timeline.totalTiles-20*16/quantum);entry.play();
  let previous=entry.state;
  for(let frame=0;frame<21;frame++){
   entry.update(16);const current=entry.state;
   for(const pose of current.actors){
    const prior=actor(previous,pose.id),step=distance(prior,pose);
    assert(step<=scene.geometry.speed*2*.016+EPS,`${scene.id}/${pose.id} cannot jump during the handoff`);
    if(step>EPS&&(Math.abs(prior.x-pose.x)<EPS||Math.abs(prior.y-pose.y)<EPS))assert.equal(pose.facing,heading(prior,pose));
    else if(step<=EPS)assert.equal(pose.facing,prior.facing);
   }
   previous=current;
  }
  assert(entry.state.finished);
  assert(entry.state.actors.filter(pose=>['nell','iris','pip'].includes(pose.id)).some(pose=>pose.facing!=='down'),`${scene.id} has no artificial all-south formation`);
  const story=createRoomCutscene({scene,actors:entry.timeline.endActors,beats:ROOM_CUTSCENES[scene.id]});
  for(const pose of story.timeline.actors){
   const arrived=actor(entry.state,pose.id);near(pose.x,arrived.x);near(pose.y,arrived.y);assert.equal(pose.facing,arrived.facing);
  }
  for(const pose of story.state.actors){
   const arrived=actor(entry.state,pose.id);near(pose.x,arrived.x);near(pose.y,arrived.y);
   if(!pose.moving)assert.equal(pose.facing,arrived.facing,`${scene.id}/${pose.id} retains its arrival direction until the next walk`);
  }
 }
 assert.equal(landings,92);
});

test('pause, seek, replay and Skip are stable and never expose an unsafe ending',()=>{
 const scene=CAMPAIGN_SCENES.depot,entry=createRoomEntry({scene}),initial=entry.state;
 assert.equal(entry.state,initial);assert(Object.isFrozen(initial));assert(Object.isFrozen(initial.actors[0]));
 assert.equal(entry.update(0),false);assert.equal(entry.seek(NaN),false);assert.equal(entry.state,initial);
 entry.update(100);assert(entry.pause());const stopped=entry.state;assert(!entry.update(100));assert.equal(entry.state,stopped);
 assert(!entry.pause());entry.seek(7.25);assert.equal(entry.state.currentTile,7.25);assert.equal(entry.state.playing,false);
 const expected=entry.state;entry.seek(0);entry.seek(7.25);assert.deepEqual(entry.state,expected);
 assert(entry.play());entry.update(16);assert.notEqual(entry.state.currentTile,7.25);
 assert(entry.skip());assert(entry.state.finished);assert.equal(entry.state.fadeOpacity,0);assert(!entry.state.playing);
 assert.deepEqual(entry.state.actors,entry.timeline.endActors);assert(entry.state.actors.every(pose=>isWalkable(physicalRoom(scene),pose)));
 assert(!entry.skip());assert(!entry.update(16));assert(entry.play());assert.equal(entry.state.currentTile,0);assert.equal(entry.state.fadeOpacity,1);
 const before=entry.state;entry.update(100000);near(entry.state.elapsed,100);assert(distance(actor(before,'mira'),actor(entry.state,'mira'))<=scene.geometry.speed*2*.1+EPS);
 for(const value of [null,undefined,NaN,Infinity,-1,0,'100']){const old=entry.state;assert.equal(entry.update(value),false);assert.equal(entry.state,old);}
});

test('entry settings use whole walking tiles and large custom player art starts fully below the canvas',()=>{
 const scene=clone(CAMPAIGN_SCENES.depot);scene.entry={fadeTiles:4,staggerTiles:5,doorX:900};
 const plan=compileRoomEntry({scene,playerSize:400});assert.equal(plan.fadeTiles,4);assert.deepEqual(plan.clips.map(clip=>clip.startTile),[0,5,10,15]);
 assert(plan.clips.every(clip=>clip.from.y>=scene.geometry.height+400));near(plan.door.x,900);
 const entry=createRoomEntry({scene,playerSize:400});entry.seek(2);near(entry.state.fadeOpacity,.5);entry.seek(4);assert.equal(entry.state.fadeOpacity,0);
 const noFade=clone(scene);noFade.entry.fadeTiles=0;assert.equal(createRoomEntry({scene:noFade}).state.fadeOpacity,0);
 const disabled=clone(scene);disabled.entry.enabled=false;const stopped=createRoomEntry({scene:disabled});
 assert.equal(stopped.timeline.totalTiles,0);assert(stopped.state.finished);assert(!stopped.state.playing);assert.deepEqual(stopped.state.actors,stopped.timeline.endActors);assert(!stopped.play());
});

test('custom furniture and disconnected floor project landings into reachable space without ghost walks',()=>{
 const scene=clone(CAMPAIGN_SCENES.depot);scene.geometry.obstacles.push({id:'edited-divider',x:690,y:250,width:60,height:728});
 const plan=compileRoomEntry({scene});assert(!plan.blocked);assert(plan.endActors.find(actor=>actor.id==='nell').x>=768-EPS,'A disconnected left station projects to the doorway component.');
 for(const clip of plan.clips){
  assert(isWalkable(physicalRoom(scene),clip.to));
  for(let index=2;index<clip.path.length;index++){
   const from=clip.path[index-1],to=clip.path[index],steps=Math.max(1,Math.ceil(distance(from,to)/3));
   for(let step=0;step<=steps;step++)assert(isWalkable(physicalRoom(scene),{x:from.x+(to.x-from.x)*step/steps,y:from.y+(to.y-from.y)*step/steps}));
  }
 }
 const blocked=clone(CAMPAIGN_SCENES.depot);blocked.geometry.obstacles.push({id:'closed-south-door',x:670,y:900,width:196,height:100});
 const fallback=createRoomEntry({scene:blocked});assert(fallback.timeline.blocked);assert.equal(fallback.timeline.clips.length,0);assert.equal(fallback.timeline.totalTiles,6);
 assert(fallback.timeline.endActors.every(actor=>isWalkable(physicalRoom(blocked),actor)));assert(fallback.state.actors.every(actor=>!actor.moving));fallback.skip();assert(fallback.state.finished);
});

test('valid off-grid player positions and altered actor feet survive the entry handoff',()=>{
 const scene=clone(CAMPAIGN_SCENES.depot);scene.actors.find(actor=>actor.id==='pip').feet={x:1107.5,y:706.75};
 const playerPosition={id:'not-the-player',x:810.25,y:897.5,facing:'left'},entry=createRoomEntry({scene,playerPosition});
 assert.deepEqual(point(actor({actors:entry.timeline.endActors},'mira')),point(playerPosition));
 const miraClip=entry.timeline.clips.find(clip=>clip.actor==='mira');
 assert.equal(actor({actors:entry.timeline.endActors},'mira').facing,heading(miraClip.path.at(-2),miraClip.path.at(-1)));assert.equal(entry.timeline.endActors.filter(actor=>actor.id==='mira').length,1);
 assert.deepEqual(point(actor({actors:entry.timeline.endActors},'pip')),scene.actors.find(actor=>actor.id==='pip').feet);
 for(const clip of entry.timeline.clips)assert(clip.path.every((vertex,index)=>!index||Math.abs(vertex.x-clip.path[index-1].x)<EPS||Math.abs(vertex.y-clip.path[index-1].y)<EPS));
 scene.entry={enabled:false};const disabled=createRoomEntry({scene,playerPosition});
 assert.equal(actor({actors:disabled.timeline.endActors},'mira').facing,'left','A disabled arrival still keeps the saved facing.');
});

test('a tiny custom floor that cannot fit a new party formation retains its existing arrangement instead of throwing',()=>{
 const scene={id:'tiny',actors:['nell','iris','pip'].map((id,index)=>({id,feet:{x:40+index*20,y:40},worldSize:160})),objects:[],geometry:{width:400,height:400,gridSize:32,radius:18,speed:260,maxDeltaMs:50,bounds:{x:100,y:100,width:100,height:100},start:{x:150,y:150,facing:'up'},obstacles:[],targets:[]}};
 const before=JSON.stringify(scene),entry=createRoomEntry({scene});
 assert(entry.timeline.blocked);assert.equal(entry.timeline.clips.length,0);assert.equal(entry.timeline.totalTiles,6);
 assert(isWalkable(scene.geometry,actor(entry.state,'mira')));
 for(const definition of scene.actors)assert.deepEqual(point(actor(entry.state,definition.id)),definition.feet);
 assert.equal(JSON.stringify(scene),before);entry.skip();assert(entry.state.finished);
});
