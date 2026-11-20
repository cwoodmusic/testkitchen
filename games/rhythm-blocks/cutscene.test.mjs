import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRoomCutscene,createRoomCutscene,separateCutsceneTracks} from './cutscene.mjs';
import {isWalkable} from './room.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {ROOM_CUTSCENES} from './cutscene-content.mjs';

const near=(actual,expected,tolerance=.000001)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const at=(timeline,id)=>timeline.state.actors.find(actor=>actor.id===id);
const scene=()=>({id:'test',actors:[{id:'nell',feet:{x:80,y:90}},{id:'iris',feet:{x:500,y:350}}],geometry:{width:600,height:420,gridSize:20,radius:18,speed:160,maxDeltaMs:50,bounds:{x:20,y:20,width:560,height:380},start:{x:80,y:360,facing:'up'},obstacles:[{id:'nell',x:52,y:70,width:56,height:25},{id:'iris',x:472,y:330,width:56,height:25},{id:'wall',x:260,y:40,width:60,height:260}],targets:[{id:'instrument',type:'inspect',x:520,y:80,approach:{x:480,y:100},range:100},{id:'shelf',type:'inspect',x:110,y:220,approach:{x:140,y:220},range:80}]}});
const cue=(extra={})=>({id:'opening',speaker:'nell',text:'Someone has repaired this old receiver recently.',target:'instrument',action:'examine',emote:'thinking',...extra});
function physicalRoom(value){const ids=new Set(value.actors.map(actor=>actor.id));return{...value.geometry,obstacles:value.geometry.obstacles.filter(obstacle=>!ids.has(obstacle.id))};}

test('walk-tile timing uses room speed and quantizes movement without speeding it up',()=>{
 const room=scene(),compiled=compileRoomCutscene({scene:room,beats:[cue({startTile:3,durationTiles:1})]});
 near(compiled.quantumMs,125);assert.equal(compiled.clips.length,1);
 const clip=compiled.clips[0];assert.equal(clip.startTile,3);assert(clip.pathLength>600,'The wall forces an actual detour.');
 assert.equal(clip.minDurationTiles,Math.ceil(clip.pathLength/room.geometry.gridSize));
 assert.equal(clip.minimumDurationTiles,clip.minDurationTiles);assert.equal(clip.durationTiles,clip.minDurationTiles);
 assert.equal(compiled.totalTiles,clip.endTile);assert.equal(compiled.adjustments.length,1);assert.equal(compiled.adjustments[0].field,'durationTiles');
 const timeline=createRoomCutscene({scene:room,beats:[cue({startTile:3,durationTiles:1})]});
 let previous=at(timeline,'nell'),detour=false;
 while(!timeline.state.finished){
  timeline.update(50);const current=at(timeline,'nell');
  assert(Math.hypot(current.x-previous.x,current.y-previous.y)<=8.000001,'A 50ms frame cannot exceed 160 pixels/sec.');
  assert(isWalkable(physicalRoom(room),current));if(current.y>=318)detour=true;previous=current;
 }
 assert(detour,'The actor walks under the solid wall instead of crossing it.');near(previous.x,480);near(previous.y,100);assert.equal(previous.facing,'right');
});

test('authored waypoints retain bent routes, collision-safe legs and their complete walking time',()=>{
 const room=scene(),waypoints=[{x:80,y:330},{x:370,y:330}],beat=cue({waypoints,startTile:0,durationTiles:1});
 const timeline=createRoomCutscene({scene:room,beats:[beat]}),clip=timeline.timeline.clips[0];
 assert.deepEqual(clip.waypoints,waypoints);assert(Object.isFrozen(clip.waypoints));assert(Object.isFrozen(clip.waypoints[0]));
 assert(clip.path.some(p=>distance(p,waypoints[0])<.000001));assert(clip.path.some(p=>distance(p,waypoints[1])<.000001));
 const first=clip.path.findIndex(p=>distance(p,waypoints[0])<.000001),second=clip.path.findIndex(p=>distance(p,waypoints[1])<.000001);
 assert(first>0&&second>first,'The route visits each authored bend before the existing destination.');
 near(clip.to.x,480);near(clip.to.y,100);assert.equal(clip.durationTiles,Math.ceil(clip.pathLength/room.geometry.gridSize));
 assert.equal(clip.minimumDurationTiles,clip.durationTiles);assert(clip.pathLength>600);
 waypoints[0].x=200;assert.equal(clip.waypoints[0].x,80,'Later draft edits cannot rewrite an active route.');
 let previous=at(timeline,'nell'),frames=0;
 while(!timeline.state.finished&&frames++<1000){timeline.update(16);const current=at(timeline,'nell');assert(distance(previous,current)<=160*.016+.000001);assert(isWalkable(physicalRoom(room),current));previous=current;}
 assert(frames<1000);near(previous.x,480);near(previous.y,100);
});

test('waypoint-only and repeated-point routes end safely without teleporting through blocked bends',()=>{
 const room=scene(),requested=[{x:140,y:220},{x:140,y:220},{x:280,y:120},{x:370,y:330}];
 const timeline=createRoomCutscene({scene:room,beats:[cue({target:undefined,text:'',waypoints:requested,startTile:0,durationTiles:1})]}),clip=timeline.timeline.clips[0];
 assert.deepEqual(clip.waypoints,requested);near(clip.to.x,370);near(clip.to.y,330);
 assert(clip.path.every((vertex,index)=>!index||distance(vertex,clip.path[index-1])>.000001),'Repeated authored points do not duplicate physical vertices.');
 assert(clip.path.every(vertex=>isWalkable(physicalRoom(room),vertex)),'A blocked bend projects onto real floor.');
 let previous=at(timeline,'nell'),frames=0;
 while(!timeline.state.finished&&frames++<1000){timeline.next();assert(distance(previous,at(timeline,'nell'))<.000001);timeline.update(16);const current=at(timeline,'nell');assert(distance(previous,current)<=160*.016+.000001);assert(isWalkable(physicalRoom(room),current));previous=current;}
 assert(frames<1000);near(previous.x,370);near(previous.y,330);
});

test('an occupied prop approach preserves authored bends when the final leg needs another reachable endpoint',()=>{
 const original=scene(),room={...original,actors:original.actors.map(actor=>actor.id==='iris'?{...actor,feet:{x:480,y:100}}:actor),geometry:{...original.geometry,obstacles:original.geometry.obstacles.map(item=>item.id==='iris'?{...item,x:452,y:80}:item),targets:original.geometry.targets.map(target=>target.id==='instrument'?{...target,range:60}:target)}};
 const waypoints=[{x:140,y:220},{x:370,y:330}],compiled=compileRoomCutscene({scene:room,beats:[cue({waypoints})]}),clip=compiled.clips[0],target=room.geometry.targets[0];
 for(const waypoint of waypoints)assert(clip.path.some(point=>distance(point,waypoint)<.000001),'Finding another final approach cannot erase an earlier authored bend.');
 assert(distance(clip.to,target)<=target.range+.000001);assert(distance(clip.to,target.approach)>1,'The actor cannot occupy the other companion’s standing position.');
 const liveFloor={...room.geometry,obstacles:room.geometry.obstacles.filter(item=>item.id!=='nell')};assert(isWalkable(liveFloor,clip.to));
});

test('legacy discussions stay sequential and default durations include readable holds',()=>{
 const compiled=compileRoomCutscene({scene:scene(),beats:[cue(),cue({id:'reply',speaker:'mira',target:undefined,text:'Let us listen carefully before choosing a way through.'})]});
 const [first,second]=compiled.clips;assert.equal(first.startTile,0);assert.equal(second.startTile,first.endTile);
 assert.equal(first.durationTiles,first.movementTiles+first.holdTiles);assert(first.holdTiles*compiled.quantumMs>=3000);
 assert.equal(second.movementTiles,0);assert(second.durationTiles*compiled.quantumMs>=3000);
 const short=compileRoomCutscene({scene:scene(),beats:[cue({speaker:'mira',target:undefined,startTile:0,durationTiles:1})]});
 assert.equal(short.clips[0].durationTiles,1,'An explicitly trimmed text line can be one time tile.');
});

test('different actors overlap while same-actor collisions move later clips after the first',()=>{
 const beats=[cue({id:'nell-early',startTile:0,durationTiles:2}),cue({id:'iris',speaker:'iris',target:'shelf',startTile:1,durationTiles:1}),cue({id:'nell-late',target:'shelf',startTile:1,durationTiles:1})];
 const compiled=compileRoomCutscene({scene:scene(),beats});
 const first=compiled.clips.find(clip=>clip.id==='nell-early'),other=compiled.clips.find(clip=>clip.id==='iris'),later=compiled.clips.find(clip=>clip.id==='nell-late');
 assert.equal(other.startTile,1);assert(other.startTile<first.endTile);
 assert.equal(later.startTile,first.endTile);assert(compiled.adjustments.some(entry=>entry.id==='nell-late'&&entry.field==='startTile'));
 near(later.from.x,first.to.x);near(later.from.y,first.to.y);
 const timeline=createRoomCutscene({scene:scene(),beats});timeline.seek(2);
 assert.deepEqual(timeline.state.activeClipIds,['nell-early','iris']);assert.equal(timeline.state.beat.id,'iris');
 assert(at(timeline,'nell').moving&&at(timeline,'iris').moving);assert.equal(at(timeline,'iris').emote,'thinking');
});

test('explicit clips sort chronologically and a stationary final speaker controls camera focus',()=>{
 const beats=[cue({id:'later',startTile:100,durationTiles:2}),cue({id:'earlier',startTile:0,durationTiles:1,target:'shelf'}),cue({id:'mira',speaker:'mira',target:undefined,startTile:150,durationTiles:2})];
 const timeline=createRoomCutscene({scene:scene(),beats});
 assert.equal(timeline.timeline.clips[0].id,'earlier');assert.equal(timeline.timeline.clips[0].index,1);
 timeline.seek(150);assert.equal(timeline.state.beat.speaker,'mira');near(timeline.state.focus.x,at(timeline,'mira').x);near(timeline.state.focus.y,at(timeline,'mira').y);
});

test('seeking, pausing, replay and fractional playheads are deterministic',()=>{
 const beats=[cue(),cue({id:'iris',speaker:'iris',target:'shelf'})],timeline=createRoomCutscene({scene:scene(),beats});
 timeline.seek(8.25);const expected=timeline.state;
 timeline.seek(0);for(let i=0;i<11;i++)timeline.update(100);timeline.seek(8.25);assert.deepEqual(timeline.state,expected);
 assert.equal(timeline.pause(),true);const paused=timeline.state;assert.equal(timeline.update(999),false);assert.deepEqual(timeline.state,paused);assert.equal(timeline.pause(),false);
 timeline.seek(2.5);assert.equal(timeline.state.currentTile,2.5);assert.equal(timeline.state.playing,false);assert.equal(timeline.play(),true);
 timeline.seek(timeline.state.totalTiles);assert.equal(timeline.state.finished,true);assert.equal(timeline.state.playing,false);assert.equal(timeline.play(),true);assert.equal(timeline.state.currentTile,0);assert.equal(timeline.state.finished,false);
});

test('render reads reuse one immutable snapshot until the transport actually changes',()=>{
 const timeline=createRoomCutscene({scene:scene(),beats:[cue()]}),initial=timeline.state;
 assert.equal(timeline.state,initial);assert.equal(timeline.seek(0),false);assert.equal(timeline.play(),false);
 assert.equal(timeline.update(0),false);assert.equal(timeline.seek(NaN),false);assert.equal(timeline.state,initial);
 assert(Object.isFrozen(initial));assert(Object.isFrozen(initial.actors));assert(Object.isFrozen(initial.actors[0]));
 assert(Object.isFrozen(initial.beat.path));assert(Object.isFrozen(initial.beat.path[0]));
 assert.throws(()=>{initial.actors[0].x=999;},TypeError);
 assert.throws(()=>{initial.beat.path[0].x=999;},TypeError);
 timeline.update(16);const moved=timeline.state;assert.notEqual(moved,initial);assert.equal(timeline.state,moved);
 assert.equal(initial.currentTile,0);near(initial.actors[0].x,80);assert(moved.actors[0].moving);
 timeline.pause();const paused=timeline.state;assert.notEqual(paused,moved);assert.equal(paused.playing,false);
 assert.equal(timeline.pause(),false);assert.equal(timeline.update(16),false);assert.equal(timeline.state,paused);
 timeline.seek(5.5);const sought=timeline.state;assert.notEqual(sought,paused);assert.equal(sought.currentTile,5.5);assert.equal(sought.playing,false);
 assert.equal(timeline.seek(5.5),false);assert.equal(timeline.state,sought);
 timeline.play();const resumed=timeline.state;assert.notEqual(resumed,sought);assert.equal(resumed.playing,true);
 timeline.next();const pending=timeline.state;assert.notEqual(pending,resumed);assert(pending.nextPending);assert.equal(timeline.next(),false);assert.equal(timeline.state,pending);
 let frames=0;while(timeline.state.nextPending&&frames++<1000)timeline.update(16);
 const next=timeline.state;assert(frames<1000);assert(next.finished);
 assert.equal(timeline.next(),false);assert.equal(timeline.skip(),false);assert.equal(timeline.state,next);
 timeline.play();const replayed=timeline.state;assert.notEqual(replayed,next);assert.equal(replayed.currentTile,0);
 timeline.update(16);const beforeSkip=timeline.state;timeline.skip();const skipped=timeline.state;
 assert.notEqual(skipped,beforeSkip);assert(skipped.finished);assert.equal(skipped.playing,false);
 assert.equal(beforeSkip.finished,false);assert(beforeSkip.actors[0].moving);assert(!skipped.actors[0].moving);
 assert.equal(timeline.state,skipped);assert.equal(timeline.skip(),false);assert.equal(timeline.state,skipped);
});

test('Next finishes walking continuously before skipping the reading hold; Skip retains current valid positions',()=>{
 const beats=[cue(),cue({id:'reply',speaker:'mira',target:undefined})],timeline=createRoomCutscene({scene:scene(),beats});
 timeline.update(100);const during=at(timeline,'nell');assert(during.moving);
 const before=timeline.state;assert.equal(timeline.next(),true);assert.equal(timeline.state.beat.id,'opening');assert(timeline.state.nextPending);
 assert.deepEqual(timeline.state.actors,before.actors);near(timeline.state.currentTile,before.currentTile);
 let frames=0,previous=during;
 while(timeline.state.nextPending&&frames++<1000){
  for(let repeat=0;repeat<5;repeat++)assert.equal(timeline.next(),false,'Repeated Next cannot stack more advances.');
  timeline.update(16);const current=at(timeline,'nell');assert(distance(previous,current)<=160*.016+.000001);previous=current;
 }
 assert(frames<1000);assert.equal(timeline.state.beat.id,'reply');near(at(timeline,'nell').x,480);near(at(timeline,'nell').y,100);
 assert.equal(timeline.next(),true);assert.equal(timeline.state.finished,true);assert.equal(timeline.next(),false);assert.equal(timeline.skip(),false);
 const skipped=createRoomCutscene({scene:scene(),beats});skipped.update(100);const feet=skipped.state.actors.map(({id,x,y})=>({id,x,y}));
 assert.equal(skipped.skip(),true);assert.equal(skipped.state.finished,true);assert.equal(skipped.state.playing,false);assert.deepEqual(skipped.state.actors.map(({id,x,y})=>({id,x,y})),feet);
 assert(skipped.state.actors.every(actor=>!actor.moving&&actor.action===null&&actor.emote===null));assert.equal(skipped.update(100),false);assert.equal(skipped.skip(),false);
});

test('Next preserves other actors’ current and future walks inside a caption',()=>{
 const room=scene();
 for(const startTile of [0,5]){
  const beats=[cue({id:'caption',speaker:'mira',target:undefined,startTile:0,durationTiles:100}),cue({id:'background',actor:'nell',speaker:'nell',text:'',target:'shelf',startTile,durationTiles:1})];
  const timeline=createRoomCutscene({scene:room,beats});
  assert.equal(timeline.next(),true);assert(timeline.state.nextPending);near(timeline.state.currentTile,startTile);
  near(at(timeline,'nell').x,80);near(at(timeline,'nell').y,90);
  let previous=at(timeline,'nell'),frames=0;
  while(timeline.state.nextPending&&frames++<1000){
   timeline.update(16);const current=at(timeline,'nell');assert(distance(previous,current)<=160*.016+.000001);previous=current;
  }
  assert(frames<1000);assert(timeline.state.finished);near(previous.x,140);near(previous.y,220);
 }
 // A shorter caption may naturally end while another actor is still walking.
 const short=createRoomCutscene({scene:room,beats:[cue({id:'caption',speaker:'mira',target:undefined,startTile:0,durationTiles:1}),cue({id:'background',text:'',startTile:0,durationTiles:1})]});
 short.next();short.update(100);short.update(100);
 assert.equal(short.state.nextPending,false);assert(at(short,'nell').moving);assert(!short.state.finished);
});

test('paused Next waits for Play and explicit transport changes clear queued advances',()=>{
 const timeline=createRoomCutscene({scene:scene(),beats:[cue()]});timeline.pause();const before=timeline.state;
 assert.equal(timeline.next(),true);assert(timeline.state.nextPending);assert.equal(timeline.state.playing,false);
 assert.deepEqual(timeline.state.actors,before.actors);assert.equal(timeline.update(100),false);
 assert.equal(timeline.seek(timeline.state.currentTile),true,'Even a same-time explicit seek cancels an advance request.');
 assert.equal(timeline.state.nextPending,false);assert.equal(timeline.state.playing,false);
 timeline.next();assert(timeline.state.nextPending);timeline.play();timeline.update(16);assert(timeline.state.nextPending);assert(at(timeline,'nell').moving);
 timeline.pause();const paused=timeline.state;assert.equal(timeline.update(100),false);assert.equal(timeline.state,paused);
 timeline.skip();assert(timeline.state.finished);assert.equal(timeline.state.nextPending,false);
 timeline.play();assert.equal(timeline.state.currentTile,0);assert.equal(timeline.state.nextPending,false);assert.equal(timeline.state.finished,false);
});

test('bounded deltas and reduced-motion playback cannot skip text or create another movement loop',()=>{
 const beats=[cue()],timeline=createRoomCutscene({scene:scene(),beats});
 for(const invalid of [null,undefined,NaN,Infinity,-1,0,'100']){const before=timeline.state;assert.equal(timeline.update(invalid),false);assert.deepEqual(timeline.state,before);}
 timeline.update(10000000);near(timeline.state.elapsed,100);assert.equal(timeline.state.index,0);
 const room=scene(),reduced=createRoomCutscene({scene:room,beats,reducedMotion:true}),normal=createRoomCutscene({scene:room,beats});
 near(at(reduced,'nell').x,80);near(at(reduced,'nell').y,90);assert.equal(at(reduced,'nell').moving,true);assert.equal(reduced.state.beat.text,beats[0].text);
 let frames=0,previous=at(reduced,'nell');
 while(!reduced.state.finished&&frames++<1000){
  reduced.update(16);normal.update(16);const current=at(reduced,'nell');
  assert(distance(current,previous)<=room.geometry.speed*.016+.000001,'Reduced motion cannot teleport across an essential walking path.');
  assert(isWalkable(physicalRoom(room),current));assert.deepEqual(reduced.state.actors,normal.state.actors);near(reduced.state.elapsed,normal.state.elapsed);previous=current;
 }
 assert(frames<1000);near(previous.x,480);near(previous.y,100);assert.equal(reduced.state.activeClips.length,0);assert.equal(reduced.update(100),false);
});

test('empty scripts and missing custom actors or props fail softly without touching input data',()=>{
 const empty=createRoomCutscene({scene:scene(),beats:[]});assert.equal(empty.state.finished,true);assert.equal(empty.next(),false);assert.equal(empty.play(),false);assert.equal(empty.state.totalTiles,0);
 const beats=[cue({target:'missing',extra:{author:'Keep this metadata'}}),cue({id:'ghost',speaker:'missing',text:'A custom narrator can still speak.',target:'instrument'})],room=scene(),before=JSON.stringify({room,beats});
 const timeline=createRoomCutscene({scene:room,beats});assert.equal(at(timeline,'nell').moving,false);assert.equal(timeline.state.beat.extra.author,'Keep this metadata');
 beats[0].text='Changed outside';assert.notEqual(timeline.state.beat.text,beats[0].text);
 assert.throws(()=>{timeline.state.actors[0].x=999;},TypeError);assert.throws(()=>{timeline.state.beat.extra.author='Changed';},TypeError);
 beats[0].text=JSON.parse(before).beats[0].text;assert.equal(JSON.stringify({room,beats}),before);
 timeline.next();assert.equal(timeline.state.beat.speaker,'missing');assert.equal(timeline.state.actors.some(actor=>actor.id==='missing'),false);
});

test('an edited Mira destination cannot end inside a companion’s actual live foot rectangle',()=>{
 for(const radius of [18,32]){
  const original=CAMPAIGN_SCENES.depot,scene={...original,geometry:{...original.geometry,radius}};
  const timeline=createRoomCutscene({scene,beats:[{speaker:'mira',actor:'mira',text:'',destination:{x:520,y:650},startTile:0,durationTiles:1}]});
  timeline.seek(timeline.state.totalTiles);const mira=at(timeline,'mira');
  assert(isWalkable(scene.geometry,mira),`Mira keeps the same ${radius}px clearance that normal exploration requires.`);
  assert(Math.hypot(mira.x-520,mira.y-650)>1,'An unsafe requested endpoint is projected onto actual walkable floor.');
 }
});

test('an edited NPC destination cannot place its retained collision rectangle over Mira',()=>{
 for(const radius of [18,32]){
  const original=CAMPAIGN_SCENES.depot,scene={...original,geometry:{...original.geometry,radius}},timeline=createRoomCutscene({scene,beats:[{speaker:'nell',actor:'nell',text:'',destination:{x:818,y:920},startTile:0,durationTiles:1}]});
  timeline.seek(timeline.state.totalTiles);const nell=at(timeline,'nell'),mira=at(timeline,'mira'),initial=scene.actors.find(actor=>actor.id==='nell');
  const liveRoom={...scene.geometry,obstacles:scene.geometry.obstacles.map(obstacle=>obstacle.id==='nell'?{...obstacle,x:obstacle.x+nell.x-initial.feet.x,y:obstacle.y+nell.y-initial.feet.y}:obstacle)};
  assert(isWalkable(liveRoom,mira),`Nell’s full retained rectangle leaves Mira’s ${radius}px foot circle clear.`);
  near(mira.x,768);near(mira.y,920);
 }
});

test('concurrent player and companion clips reserve different playable end positions in either clip order',()=>{
 const scene=CAMPAIGN_SCENES.depot;
 for(const order of [['nell','mira'],['mira','nell']]){
  const timeline=createRoomCutscene({scene,beats:order.map(actor=>({speaker:actor,actor,text:'',destination:{x:500,y:700},startTile:0,durationTiles:1}))});
  timeline.seek(timeline.state.totalTiles);const nell=at(timeline,'nell'),mira=at(timeline,'mira'),initial=scene.actors.find(actor=>actor.id==='nell');
  const room={...scene.geometry,obstacles:scene.geometry.obstacles.map(obstacle=>obstacle.id==='nell'?{...obstacle,x:obstacle.x+nell.x-initial.feet.x,y:obstacle.y+nell.y-initial.feet.y}:obstacle)};
  assert(isWalkable(room,mira),`Concurrent ${order.join(' then ')} destinations remain playable.`);
  assert(Math.hypot(nell.x-mira.x,nell.y-mira.y)>35,'The two clips cannot retain the same occupied endpoint.');
 }
});

test('all authored arrivals walk three companions to real props without crossing physical furniture',()=>{
 const before=JSON.stringify({scenes:CAMPAIGN_SCENES,beats:ROOM_CUTSCENES});let moved=0;
 for(const [id,room]of Object.entries(CAMPAIGN_SCENES)){
  const beats=ROOM_CUTSCENES[id],timeline=createRoomCutscene({scene:room,beats}),compiled=timeline.timeline,physical=physicalRoom(room);
  assert(compiled.clips.length>=4,id);assert.equal(compiled.adjustments.length,0,id);near(compiled.quantumMs,room.geometry.gridSize/room.geometry.speed*1000);
  const inspections=new Set();
  for(const clip of compiled.clips){
   if(clip.target){assert(clip.pathLength>0,`${id}/${clip.id} visibly moves`);inspections.add(clip.actor);const target=room.geometry.targets.find(item=>item.id===clip.target);assert(distance(clip.to,target)<=target.range+.000001,`${id}/${clip.id} reaches the visible prop`);}
   for(const vertex of clip.path)assert(isWalkable(physical,vertex),`${id}/${clip.id} has a solid-floor waypoint`);
  }
  assert.deepEqual([...inspections].sort(),['iris','nell','pip'],`${id} sends each companion to a real inspection`);moved+=inspections.size;
  let frames=0,prior=new Map(timeline.state.actors.map(actor=>[actor.id,actor]));
  while(!timeline.state.finished&&frames++<2000){
   timeline.update(100);
   for(const actor of timeline.state.actors){
    const previous=prior.get(actor.id),speedMultiplier=actor.gait==='run'||previous.gait==='run'?2:1;assert(distance(actor,previous)<=room.geometry.speed*speedMultiplier*.1+.00001,`${id}/${actor.id} exceeds its selected movement speed`);
    assert(isWalkable(physical,actor),`${id}/${actor.id} crosses furniture`);prior.set(actor.id,actor);
   }
  }
  assert(frames<2000,id);assert.equal(timeline.state.activeClipIds.length,0);assert(timeline.state.actors.every(actor=>!actor.moving&&!actor.action&&!actor.emote));
 }
 assert.equal(moved,Object.keys(CAMPAIGN_SCENES).length*3);assert.equal(JSON.stringify({scenes:CAMPAIGN_SCENES,beats:ROOM_CUTSCENES}),before);
});

const walk=(extra={})=>({id:'walk',kind:'walk',actor:'nell',target:'instrument',action:'examine',startTile:0,durationTiles:60,...extra});
const dialogue=(extra={})=>({id:'text',kind:'dialogue',actor:'nell',speaker:'nell',text:'The receiver is answering again.',startTile:5,durationTiles:10,...extra});
const emote=(extra={})=>({id:'reaction',kind:'emote',actor:'nell',emote:'question',startTile:7,durationTiles:3,...extra});
const physicalPose=({x,y,facing,moving,action,target})=>({x,y,facing,moving,action,target});

test('independent text and emote timing cannot change a walk, its facing, action or duration',()=>{
 const room=scene(),baseline=createRoomCutscene({scene:room,beats:[walk()]});
 for(const extras of [[dialogue(),emote()],[dialogue({startTile:0,durationTiles:80}),emote({startTile:1,durationTiles:90})],[dialogue({startTile:65,durationTiles:3}),emote({startTile:70,durationTiles:4})]]){
  const timeline=createRoomCutscene({scene:room,beats:[...extras,walk()]});
  const actual=timeline.timeline.clips.find(clip=>clip.kind==='walk'),expected=baseline.timeline.clips[0];
  for(const key of ['startTile','durationTiles','pathLength','path','from','to','minimumDurationTiles'])assert.deepEqual(actual[key],expected[key],`${key} depends only on the walk.`);
  assert(timeline.timeline.clips.filter(clip=>clip.kind!=='walk').every(clip=>clip.pathLength===0&&clip.minimumDurationTiles===1));
  for(const tile of [0,.25,4.5,5,7,8.25,10,15,35,59.9,60,65,71,80,90]){
   baseline.seek(tile);timeline.seek(tile);
   assert.deepEqual(physicalPose(at(timeline,'nell')),physicalPose(at(baseline,'nell')),`Other tracks cannot change the walk at tile ${tile}.`);
  }
 }
});

test('an emote follows the moving actor and ends on its own boundary across text and walk changes',()=>{
 const beats=[walk({target:undefined,destination:{x:120,y:90},durationTiles:4}),emote({startTile:3,durationTiles:32}),dialogue({startTile:5,durationTiles:2}),walk({id:'second-walk',target:undefined,destination:{x:120,y:200},startTile:10,durationTiles:8}),dialogue({id:'later-text',startTile:30,durationTiles:10})];
 const timeline=createRoomCutscene({scene:scene(),beats});
 for(const tile of [3,4,5,7,10,12,18,30,34.99]){
  timeline.seek(tile);assert.equal(at(timeline,'nell').emote,'question',`The emote survives other track boundaries at ${tile}.`);
  if(tile===12){assert(at(timeline,'nell').moving);near(at(timeline,'nell').x,120);near(at(timeline,'nell').y,130);}
 }
 timeline.seek(35);assert.equal(at(timeline,'nell').emote,null);assert.equal(timeline.state.beat.id,'later-text');
 near(at(timeline,'nell').x,120);near(at(timeline,'nell').y,200);assert(!at(timeline,'nell').moving);
 const expected=timeline.state;timeline.seek(0);timeline.seek(35);assert.deepEqual(timeline.state,expected,'Seeking reconstructs independent layers without accumulated state.');
});

test('same-kind overlaps schedule in their own lane without moving the other two kinds',()=>{
 const beats=[walk(),dialogue({startTile:1,durationTiles:3}),emote({startTile:1,durationTiles:2}),walk({id:'walk-again',target:'shelf',startTile:1,durationTiles:1}),dialogue({id:'text-again',startTile:2,durationTiles:2}),emote({id:'reaction-again',startTile:2,durationTiles:2})];
 const compiled=compileRoomCutscene({scene:scene(),beats}),byId=id=>compiled.clips.find(clip=>clip.id===id);
 assert.equal(byId('text').startTile,1);assert.equal(byId('reaction').startTile,1);
 assert.equal(byId('walk-again').startTile,60);assert.equal(byId('text-again').startTile,4);assert.equal(byId('reaction-again').startTile,3);
 assert.deepEqual(compiled.adjustments.filter(item=>item.field==='startTile').map(item=>item.id).sort(),['reaction-again','text-again','walk-again']);
 const timeline=createRoomCutscene({scene:scene(),beats});timeline.seek(2);
 assert(at(timeline,'nell').moving);assert.equal(timeline.state.beat.id,'text');assert.equal(at(timeline,'nell').emote,'question');
 assert.deepEqual(timeline.state.activeClipIds,['walk','text','reaction']);
});

test('typed channels cannot accidentally execute payloads belonging to another channel',()=>{
 const room=scene(),timeline=createRoomCutscene({scene:room,beats:[walk({text:'This is not a caption.',emote:'happy'}),dialogue({startTile:1,durationTiles:2,target:'shelf',destination:{x:140,y:220},emote:'surprise',action:'search'}),emote({startTile:4,target:'instrument',destination:{x:480,y:100},text:'Not a caption either.',action:'search'})]});
 assert.equal(timeline.state.beat,null);assert.equal(at(timeline,'nell').emote,null);
 timeline.seek(1);assert.equal(timeline.state.beat.id,'text');assert.equal(at(timeline,'nell').action,'examine');assert.equal(at(timeline,'nell').emote,null);
 timeline.seek(4);assert.equal(timeline.state.beat,null);assert.equal(at(timeline,'nell').emote,'question');assert(at(timeline,'nell').moving);
 const nonwalking=timeline.timeline.clips.filter(clip=>clip.kind!=='walk');assert(nonwalking.every(clip=>clip.pathLength===0&&clip.action===null));
});

test('Next through a silent track gap reaches the next dialogue without skipping its line or teleporting',()=>{
 const room=scene(),timeline=createRoomCutscene({scene:room,beats:[walk(),emote({startTile:1,durationTiles:2}),dialogue({startTile:5,durationTiles:2})]});
 assert.equal(timeline.state.beat,null);assert(timeline.next());assert(timeline.state.nextPending);near(timeline.state.currentTile,0);
 let previous=at(timeline,'nell'),frames=0;
 while(timeline.state.nextPending&&frames++<1000){timeline.update(16);const current=at(timeline,'nell');assert(distance(current,previous)<=room.geometry.speed*.016+.000001);previous=current;}
 assert(frames<1000);assert.equal(timeline.state.beat.id,'text');assert(timeline.state.currentTile>=5&&timeline.state.currentTile<7);assert(at(timeline,'nell').moving);
});

test('track normalization preserves every shipped performance including typed gestures and running',()=>{
 for(const [id,room]of Object.entries(CAMPAIGN_SCENES)){
  const source=ROOM_CUTSCENES[id],before=JSON.stringify(source),split=separateCutsceneTracks({scene:room,beats:source});
  if(source.every(clip=>clip.kind!==undefined))assert.deepEqual(split,source,'Already typed performances are not restaged or rewritten.');
  else assert.equal(split.length,source.length*3,id);
  const legacy=createRoomCutscene({scene:room,beats:source}),typed=createRoomCutscene({scene:room,beats:split});
  assert.equal(typed.state.totalTiles,legacy.state.totalTiles,id);assert.equal(typed.timeline.adjustments.length,0,id);
  const samples=new Set([0,legacy.state.totalTiles]);
  for(let tile=0;tile<=legacy.state.totalTiles;tile+=.75)samples.add(tile);
  for(const clip of legacy.timeline.clips)for(const boundary of [clip.startTile,clip.startTile+clip.pathLength/(room.geometry.gridSize*clip.speedMultiplier),clip.endTile])for(const offset of [-.01,0,.01])samples.add(Math.max(0,Math.min(legacy.state.totalTiles,boundary+offset)));
  for(const tile of samples){
   legacy.seek(tile);typed.seek(tile);assert.deepEqual(typed.state.actors,legacy.state.actors,`${id} pose differs at ${tile}.`);
   assert.equal(typed.state.beat?.text,legacy.state.beat?.text,`${id} line differs at ${tile}.`);
   assert.equal(typed.state.beat?.speaker,legacy.state.beat?.speaker,`${id} speaker differs at ${tile}.`);
   assert.deepEqual(typed.state.focus,legacy.state.focus,`${id} focus differs at ${tile}.`);
  }
  assert.equal(JSON.stringify(source),before);assert.deepEqual(separateCutsceneTracks({scene:room,beats:split}),split,'A second migration is a no-op.');
 }
});

test('track migration retains extra author data and creates bounded collision-free IDs',()=>{
 const room=scene(),id='a'.repeat(80),collision=id.slice(0,71)+'-dialogue',metadata={author:'Keep this',nested:{value:7}};
 const source=[cue({id,startTile:3,durationTiles:1,extra:metadata,waypoints:[{x:140,y:220}]}),emote({id:collision,actor:'iris',startTile:80,durationTiles:2})],before=JSON.stringify(source);
 const split=separateCutsceneTracks({scene:room,beats:source});
 assert.equal(split.length,4);assert.equal(new Set(split.map(clip=>clip.id)).size,4);assert(split.every(clip=>clip.id.length<=80));
 assert.equal(split[0].id,id);assert.equal(split[3].id,collision);assert.deepEqual(split[3],source[1]);
 for(const clip of split.slice(0,3)){assert.deepEqual(clip.extra,metadata);assert.equal(clip.startTile,3);assert(clip.durationTiles>1);}
 assert.deepEqual(split[0].waypoints,source[0].waypoints);assert(!Object.hasOwn(split[0],'text'));assert(!Object.hasOwn(split[0],'emote'));
 assert(!Object.hasOwn(split[1],'target'));assert(!Object.hasOwn(split[1],'waypoints'));assert.equal(split[1].text,source[0].text);
 assert(!Object.hasOwn(split[2],'text'));assert(!Object.hasOwn(split[2],'destination'));assert.equal(split[2].emote,'thinking');
 split[0].extra.nested.value=99;assert.equal(split[1].extra.nested.value,7);assert.equal(JSON.stringify(source),before);
});

test('legacy dialogue keeps its original lane when overlapping actors share a different speaker',()=>{
 const room=scene(),source=[
  {id:'first',actor:'nell',speaker:'mira',text:'First line.',target:'shelf',action:'examine',emote:'question',startTile:0,durationTiles:10},
  {id:'second',actor:'iris',speaker:'mira',text:'Second line.',destination:{x:500,y:310},action:'listen',emote:'idea',startTile:0,durationTiles:5},
 ],before=JSON.stringify(source),split=separateCutsceneTracks({scene:room,beats:source});
 const spoken=split.filter(clip=>clip.kind==='dialogue');
 assert.deepEqual(spoken.map(clip=>clip.actor),['nell','iris']);assert(spoken.every(clip=>clip.speaker==='mira'&&clip.startTile===0));
 const legacy=createRoomCutscene({scene:room,beats:source}),typed=createRoomCutscene({scene:room,beats:split});
 assert.equal(legacy.state.totalTiles,10);assert.equal(typed.state.totalTiles,10);assert.equal(typed.state.beat.text,'Second line.');
 assert.equal(typed.timeline.adjustments.length,0,'Independent actor-owned dialogue lanes must not be serialized onto the shared speaker.');
 for(const tile of [0,.125,1,2,2.75,4.99,5,5.01,7.5,9.99,10]){
  legacy.seek(tile);typed.seek(tile);assert.deepEqual(typed.state.actors,legacy.state.actors,`Actor state changed at ${tile}.`);
  assert.equal(typed.state.beat?.text,legacy.state.beat?.text);assert.equal(typed.state.beat?.speaker,legacy.state.beat?.speaker);
  assert.deepEqual(typed.state.focus,legacy.state.focus);
 }
 assert.equal(JSON.stringify(source),before);assert.deepEqual(separateCutsceneTracks({scene:room,beats:split}),split);
});

test('typed capacity is 384 and splitting never silently truncates expanded author data',()=>{
 const room=scene(),typed=Array.from({length:384},(_,index)=>emote({id:`emote-${index}`,startTile:index,durationTiles:1}));
 assert.equal(compileRoomCutscene({scene:room,beats:typed}).clips.length,384);
 const legacy=Array.from({length:129},(_,index)=>cue({id:`legacy-${index}`,speaker:'mira',target:undefined}));
 const split=separateCutsceneTracks({scene:room,beats:legacy});assert.equal(split.length,387,'The project validator can report capacity without losing any clips.');
 assert.deepEqual(separateCutsceneTracks({scene:room,beats:split}),split);
});

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}

test('running follows the same cardinal obstacle route at exactly twice walking speed',()=>{
 const room=scene(),run=createRoomCutscene({scene:room,beats:[walk({gait:'run',durationTiles:1})]}),walking=createRoomCutscene({scene:room,beats:[walk({durationTiles:1})]});
 const fast=run.timeline.clips[0],slow=walking.timeline.clips[0];
 assert.deepEqual(fast.path,slow.path,'Choosing a run cannot take a shortcut through the wall.');
 assert.equal(fast.gait,'run');assert.equal(fast.speedMultiplier,2);
 assert.equal(fast.minimumDurationTiles,Math.ceil(fast.pathLength/(room.geometry.gridSize*2)));
 assert.equal(fast.durationTiles,fast.minimumDurationTiles);assert(fast.durationTiles<slow.durationTiles);
 const straightRun=createRoomCutscene({scene:room,beats:[walk({target:undefined,destination:{x:240,y:90},gait:'run',durationTiles:1})]}),straightWalk=createRoomCutscene({scene:room,beats:[walk({target:undefined,destination:{x:240,y:90},durationTiles:1})]});
 straightRun.update(50);straightWalk.update(50);
 near(distance(at(straightRun,'nell'),fast.from),16);near(distance(at(straightWalk,'nell'),slow.from),8);
 assert.equal(at(straightRun,'nell').gait,'run');assert.equal(at(straightWalk,'nell').gait,'walk');
 let previous=at(run,'nell'),frames=0;
 while(!run.state.finished&&frames++<1000){
  run.update(16);const current=at(run,'nell');
  assert(distance(previous,current)<=room.geometry.speed*2*.016+.000001,'Even a trimmed run respects its selected speed.');
  assert(isWalkable(physicalRoom(room),current));previous=current;
 }
 assert(frames<1000);near(previous.x,480);near(previous.y,100);assert.equal(previous.gait,'walk');assert(!previous.moving);
 for(const [index,vertex]of fast.path.entries())if(index)assert(vertex.x===fast.path[index-1].x||vertex.y===fast.path[index-1].y,'Running still turns on cardinal path segments.');
});

const gesture=(extra={})=>({id:'inspect-with-lens',kind:'gesture',actor:'nell',gesture:'magnify',startTile:4,durationTiles:8,...extra});

test('physical gestures scrub and pause independently without changing walking, text or emotes',()=>{
 const room=scene(),baseBeats=[walk(),dialogue({startTile:3,durationTiles:20}),emote({startTile:2,durationTiles:15})];
 const baseline=createRoomCutscene({scene:room,beats:baseBeats});
 const timeline=createRoomCutscene({scene:room,beats:[...baseBeats,gesture({target:'shelf',destination:{x:140,y:220},text:'A prop gesture cannot speak.',action:'search',emote:'happy',gait:'run'})]});
 const compiled=timeline.timeline.clips.find(clip=>clip.kind==='gesture');assert.equal(compiled.pathLength,0);assert.equal(compiled.minimumDurationTiles,1);assert.equal(compiled.action,null);assert.equal(compiled.gait,'walk');
 for(const tile of [0,3.99,4,6,8,11.99,12,20,60]){
  baseline.seek(tile);timeline.seek(tile);
  assert.deepEqual(physicalPose(at(timeline,'nell')),physicalPose(at(baseline,'nell')),'Inspecting cannot stop or redirect an independently authored walk.');
  assert.equal(timeline.state.beat?.text,baseline.state.beat?.text);assert.equal(at(timeline,'nell').emote,at(baseline,'nell').emote);
  assert.equal(at(timeline,'nell').gesture,tile>=4&&tile<12?'magnify':null);
  near(at(timeline,'nell').gestureProgress,tile>=4&&tile<12?(tile-4)/8:0);
 }
 timeline.seek(8);const expected=timeline.state;timeline.seek(0);timeline.seek(8);assert.deepEqual(timeline.state,expected);
 timeline.pause();const paused=timeline.state;assert(!timeline.update(100));assert.equal(timeline.state,paused);
 assert(Object.isFrozen(paused.actors[0]));assert.throws(()=>{paused.actors[0].gestureProgress=1;},TypeError);
 timeline.skip();assert(timeline.state.actors.every(actor=>actor.gesture===null&&actor.gestureProgress===0));
});

test('gesture overlaps reserve only the gesture lane and leave the other tracks in place',()=>{
 const beats=[walk(),dialogue({startTile:4,durationTiles:15}),emote({startTile:4,durationTiles:15}),gesture(),gesture({id:'second-gesture',gesture:'trip',startTile:7,durationTiles:3})];
 const timeline=createRoomCutscene({scene:scene(),beats}),byId=id=>timeline.timeline.clips.find(clip=>clip.id===id);
 assert.equal(byId('walk').startTile,0);assert.equal(byId('text').startTile,4);assert.equal(byId('reaction').startTile,4);
 assert.equal(byId('inspect-with-lens').startTile,4);assert.equal(byId('second-gesture').startTile,12);
 assert.deepEqual(timeline.timeline.adjustments.filter(change=>change.field==='startTile').map(change=>change.id),['second-gesture']);
 timeline.seek(12.75);assert.equal(at(timeline,'nell').gesture,'trip');near(at(timeline,'nell').gestureProgress,.25);
 assert(at(timeline,'nell').moving);assert.equal(at(timeline,'nell').emote,'question');assert.equal(timeline.state.beat.id,'text');
});

test('Next keeps a run, trip, fall and recovery continuous before skipping a reading hold',()=>{
 const room=scene(),beats=[
  dialogue({actor:'mira',speaker:'mira',startTile:0,durationTiles:70}),
  walk({target:undefined,destination:{x:140,y:90},gait:'run',startTile:2,durationTiles:2}),
  gesture({id:'stumble',gesture:'trip',startTile:4,durationTiles:3}),
  gesture({id:'on-floor',gesture:'fallen',startTile:7,durationTiles:4}),
  gesture({id:'stand-up',gesture:'recover',startTile:11,durationTiles:4}),
 ];
 const timeline=createRoomCutscene({scene:room,beats});assert(timeline.next());assert(timeline.state.nextPending);near(timeline.state.currentTile,2);
 let previous=at(timeline,'nell'),frames=0;const seen=new Map();
 while(timeline.state.nextPending&&frames++<1000){
  assert(!timeline.next(),'Repeated Next cannot skip the physical performance.');
  timeline.update(16);const current=at(timeline,'nell');
  assert(distance(previous,current)<=room.geometry.speed*2*.016+.000001,'Next cannot teleport a runner.');
  if(current.gesture){const record=seen.get(current.gesture)??[];record.push(current.gestureProgress);seen.set(current.gesture,record);}
  previous=current;
 }
 assert(frames<1000);assert(timeline.state.finished);near(timeline.state.currentTile,70);near(previous.x,140);near(previous.y,90);
 assert.deepEqual([...seen.keys()],['trip','fallen','recover']);
 for(const samples of seen.values()){
  assert(samples.length>15,'Every physical beat gets real animation time.');
  assert(samples[0]<.06&&samples.at(-1)>.94,'Next traverses the complete gesture, not just its first pose.');
  assert(samples.every((value,index)=>!index||value>samples[index-1]));
 }
 assert.equal(previous.gesture,null);assert.equal(previous.gestureProgress,0);
});

test('legacy run migration keeps gait only on its walk and preserves existing gesture author data',()=>{
 const room=scene(),source=[cue({gait:'run',startTile:0,durationTiles:1,extra:{author:'Keep me'}}),gesture({actor:'iris',extra:{camera:'unchanged'}})],before=JSON.stringify(source);
 const split=separateCutsceneTracks({scene:room,beats:source}),motion=split.find(clip=>clip.kind==='walk');
 assert.equal(motion.gait,'run');assert(split.filter(clip=>['dialogue','emote'].includes(clip.kind)).every(clip=>!Object.hasOwn(clip,'gait')));
 assert.deepEqual(split.find(clip=>clip.kind==='gesture'),source[1]);
 const legacy=createRoomCutscene({scene:room,beats:source}),typed=createRoomCutscene({scene:room,beats:split});
 assert.equal(legacy.state.totalTiles,typed.state.totalTiles);
 for(let tile=0;tile<=legacy.state.totalTiles;tile+=.25){legacy.seek(tile);typed.seek(tile);assert.deepEqual(typed.state.actors,legacy.state.actors);assert.equal(typed.state.beat?.text,legacy.state.beat?.text);}
 assert.equal(JSON.stringify(source),before);
});

test('manual dialogue keeps every unread line beyond the authored duration and completed physical clock',()=>{
 const room=scene(),beats=[
  walk({target:undefined,destination:{x:140,y:90},durationTiles:1}),
  dialogue({id:'first',text:'A long observation. '.repeat(30),startTile:0,durationTiles:1}),
  dialogue({id:'second',text:'The next thought.',startTile:40,durationTiles:1}),
  dialogue({id:'third',text:'And the final reply.',startTile:80,durationTiles:1}),
 ],timeline=createRoomCutscene({scene:room,beats,manualDialogue:true});
 for(let count=0;count<1000;count++)timeline.update(100);
 assert.equal(timeline.state.currentTile,timeline.state.totalTiles);
 assert.equal(timeline.state.beat.id,'first','Reading time cannot silently consume a later line.');
 assert.equal(timeline.state.dialogueElapsed,100000);assert(timeline.state.awaitingAdvance);assert(!timeline.state.finished);
 assert.equal(timeline.state.manualDialogue,true);assert.equal(timeline.state.dialogueFinished,false);
 assert.equal(timeline.state.activeClips.find(clip=>clip.kind==='dialogue').id,'first');
 const feet=timeline.state.actors.map(({id,x,y})=>({id,x,y}));
 assert(timeline.next());assert.equal(timeline.state.beat.id,'second');assert.equal(timeline.state.dialogueElapsed,0);
 assert.deepEqual(timeline.state.actors.map(({id,x,y})=>({id,x,y})),feet,'Next only advances speaking.');
 timeline.update(100);timeline.update(100);assert.equal(timeline.state.dialogueElapsed,200,'Bloops and typewriter can continue after all movement has completed.');
 assert(timeline.next());assert.equal(timeline.state.beat.id,'third');assert.equal(timeline.state.dialogueElapsed,0);
 assert(timeline.next());assert(timeline.state.finished);assert(timeline.state.dialogueFinished);assert.equal(timeline.state.playing,false);
 assert(!timeline.next());assert.equal(timeline.state.beat,null);assert(!timeline.state.awaitingAdvance);
});

test('fast manual acknowledgements preserve every run and tumble frame without waiting for text or held-lens tails',()=>{
 const room=scene(),beats=[
  walk({target:undefined,destination:{x:140,y:90},gait:'run',startTile:0,durationTiles:2}),
  gesture({id:'trip',gesture:'trip',startTile:2,durationTiles:3}),
  gesture({id:'fallen',gesture:'fallen',startTile:5,durationTiles:4}),
  gesture({id:'recover',gesture:'recover',startTile:9,durationTiles:4}),
  gesture({id:'lens',actor:'iris',gesture:'magnify',startTile:0,durationTiles:1000}),
  emote({startTile:0,durationTiles:1000}),
  ...['a','b','c'].map((id,index)=>dialogue({id,text:`Thought ${id}.`,startTile:index*100,durationTiles:100})),
 ],timeline=createRoomCutscene({scene:room,beats,manualDialogue:true});
 const before=timeline.state.actors;
 for(const id of ['a','b','c']){assert.equal(timeline.state.beat.id,id);assert(timeline.next());assert.equal(timeline.state.currentTile,0);assert.deepEqual(timeline.state.actors,before);}
 assert(!timeline.state.finished);assert(timeline.state.dialogueFinished);assert.equal(timeline.state.beat,null);assert(!timeline.next());
 const seen=new Map();let frames=0,previous=at(timeline,'nell');
 while(!timeline.state.finished&&frames++<500){
  timeline.update(16);const current=at(timeline,'nell');assert(distance(previous,current)<=room.geometry.speed*2*.016+.000001);
  if(current.gesture){const samples=seen.get(current.gesture)??[];samples.push(current.gestureProgress);seen.set(current.gesture,samples);}
  previous=current;
 }
 assert(frames<500);assert.deepEqual([...seen.keys()],['trip','fallen','recover']);
 for(const samples of seen.values())assert(samples.length>15&&samples[0]<.06&&samples.at(-1)>.94,'Each tumble phase completes continuously.');
 assert(timeline.state.currentTile>=13&&timeline.state.currentTile<14,'Physical completion ignores long authored reading and magnifier holds.');
 assert.equal(timeline.state.totalTiles,1000);assert(timeline.state.actors.every(actor=>!actor.moving&&!actor.gesture&&!actor.emote));
});

test('manual dialogue has immediate successive lines but respects the initial staged entrance delay',()=>{
 const beats=[dialogue({id:'a',startTile:8,durationTiles:1}),dialogue({id:'b',startTile:200,durationTiles:1})];
 const timeline=createRoomCutscene({scene:scene(),beats,manualDialogue:true});
 assert.equal(timeline.state.beat,null);assert(!timeline.next());assert.equal(timeline.state.dialogueElapsed,0);
 for(let i=0;i<10;i++)timeline.update(100);
 assert.equal(timeline.state.beat.id,'a');near(timeline.state.dialogueElapsed,0);
 assert(timeline.next());assert.equal(timeline.state.beat.id,'b');assert.equal(timeline.state.dialogueElapsed,0);
 assert(timeline.next());assert(timeline.state.finished,'There is no empty wait for an authored dialogue-only interval.');
});

test('manual pause, deterministic seek, Skip and replay control both clocks safely',()=>{
 const beats=[dialogue({id:'a',startTile:0,durationTiles:10}),dialogue({id:'b',startTile:10,durationTiles:10})];
 const timeline=createRoomCutscene({scene:scene(),beats,manualDialogue:true});
 timeline.update(100);timeline.next();timeline.update(50);timeline.pause();const paused=timeline.state;
 assert.equal(paused.beat.id,'b');assert.equal(paused.dialogueElapsed,50);assert(!timeline.update(100));assert.equal(timeline.state,paused);
 assert(timeline.play());timeline.update(100);assert.equal(timeline.state.dialogueElapsed,150);
 timeline.seek(12);const expected=timeline.state;assert.equal(expected.beat.id,'b');near(expected.dialogueElapsed,250);
 timeline.seek(0);assert.equal(timeline.state.beat.id,'a');assert.equal(timeline.state.dialogueElapsed,0);timeline.seek(12);assert.deepEqual(timeline.state,expected);
 assert(timeline.skip());assert(timeline.state.finished);assert.equal(timeline.state.beat,null);assert(timeline.state.dialogueFinished);
 assert(timeline.play());assert.equal(timeline.state.beat.id,'a');assert.equal(timeline.state.currentTile,0);assert.equal(timeline.state.dialogueElapsed,0);
 timeline.seek(timeline.state.totalTiles);assert(timeline.state.finished);assert(!timeline.state.playing);
 assert(timeline.play());assert.equal(timeline.state.beat.id,'a');assert(Object.isFrozen(timeline.state));assert(Object.isFrozen(timeline.state.activeClips));
});

test('manual caption mode leaves silent performances and automatic director timing intact',()=>{
 const room=scene(),beats=[dialogue({id:'a',startTile:0,durationTiles:2}),dialogue({id:'b',startTile:2,durationTiles:2})];
 const automatic=createRoomCutscene({scene:room,beats}),manual=createRoomCutscene({scene:room,beats,manualDialogue:true});
 for(let i=0;i<3;i++){automatic.update(100);manual.update(100);}
 assert.equal(automatic.state.beat.id,'b');assert.equal(automatic.state.manualDialogue,false);assert.equal(manual.state.beat.id,'a');
 automatic.update(100);automatic.update(100);assert(automatic.state.finished);assert(!manual.state.finished);
 const silent=createRoomCutscene({scene:room,beats:[gesture({startTile:0,durationTiles:4})],manualDialogue:true});
 assert.equal(silent.state.manualDialogue,false);for(let i=0;i<5;i++)silent.update(100);assert(silent.state.finished,'A silent authored scene still uses its full timeline.');
});

test('every shipped manual scene delivers every line and retains the same final feet as its authored performance',()=>{
 for(const [id,beats]of Object.entries(ROOM_CUTSCENES)){
  const room=CAMPAIGN_SCENES[id],timeline=createRoomCutscene({scene:room,beats,manualDialogue:true});
  const lines=timeline.timeline.clips.filter(clip=>clip.kind==='dialogue'&&clip.text.trim()),seen=[];
  for(const line of lines){seen.push(timeline.state.beat.id);assert.equal(timeline.state.beat.id,line.id);assert(timeline.next());}
  assert.equal(new Set(seen).size,lines.length,`${id} does not replace or repeat a line.`);
  let frames=0;while(!timeline.state.finished&&frames++<1000)timeline.update(50);
  assert(frames<1000,`${id} completes after its actual acting, without waiting for authored reading gaps.`);
  const automatic=createRoomCutscene({scene:room,beats});automatic.seek(automatic.state.totalTiles);
  assert.deepEqual(timeline.state.actors,automatic.state.actors,`${id} keeps identical safe final cast positions and facings.`);
 }
});
