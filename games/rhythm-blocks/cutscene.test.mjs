import test from 'node:test';
import assert from 'node:assert/strict';
import {compileRoomCutscene,createRoomCutscene} from './cutscene.mjs';
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

test('Next advances to the current clip end; Skip retains current valid positions',()=>{
 const beats=[cue(),cue({id:'reply',speaker:'mira',target:undefined})],timeline=createRoomCutscene({scene:scene(),beats});
 timeline.update(100);const during=at(timeline,'nell');assert(during.moving);
 assert.equal(timeline.next(),true);assert.equal(timeline.state.beat.id,'reply');near(at(timeline,'nell').x,480);near(at(timeline,'nell').y,100);
 assert.equal(timeline.next(),true);assert.equal(timeline.state.finished,true);assert.equal(timeline.next(),false);assert.equal(timeline.skip(),false);
 const skipped=createRoomCutscene({scene:scene(),beats});skipped.update(100);const feet=skipped.state.actors.map(({id,x,y})=>({id,x,y}));
 assert.equal(skipped.skip(),true);assert.equal(skipped.state.finished,true);assert.equal(skipped.state.playing,false);assert.deepEqual(skipped.state.actors.map(({id,x,y})=>({id,x,y})),feet);
 assert(skipped.state.actors.every(actor=>!actor.moving&&actor.action===null&&actor.emote===null));assert.equal(skipped.update(100),false);assert.equal(skipped.skip(),false);
});

test('bounded deltas and reduced-motion playback cannot skip text or create another movement loop',()=>{
 const beats=[cue()],timeline=createRoomCutscene({scene:scene(),beats});
 for(const invalid of [null,undefined,NaN,Infinity,-1,0,'100']){const before=timeline.state;assert.equal(timeline.update(invalid),false);assert.deepEqual(timeline.state,before);}
 timeline.update(10000000);near(timeline.state.elapsed,100);assert.equal(timeline.state.index,0);
 const reduced=createRoomCutscene({scene:scene(),beats,reducedMotion:true});near(at(reduced,'nell').x,480);near(at(reduced,'nell').y,100);assert.equal(at(reduced,'nell').moving,false);assert.equal(reduced.state.beat.text,beats[0].text);
 let frames=0;while(!reduced.state.finished&&frames++<1000)reduced.update(100);assert(frames<1000);assert.equal(reduced.state.activeClips.length,0);assert.equal(reduced.update(100),false);
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

test('all 23 authored arrivals walk three companions to real props without crossing physical furniture',()=>{
 const before=JSON.stringify({scenes:CAMPAIGN_SCENES,beats:ROOM_CUTSCENES});let moved=0;
 for(const [id,room]of Object.entries(CAMPAIGN_SCENES)){
  const beats=ROOM_CUTSCENES[id],timeline=createRoomCutscene({scene:room,beats}),compiled=timeline.timeline,physical=physicalRoom(room);
  assert.equal(compiled.clips.length,4,id);assert.equal(compiled.adjustments.length,0,id);near(compiled.quantumMs,room.geometry.gridSize/room.geometry.speed*1000);
  for(const clip of compiled.clips){
   if(clip.target){assert(clip.pathLength>100,`${id}/${clip.id} visibly moves`);moved++;const target=room.geometry.targets.find(item=>item.id===clip.target);assert(distance(clip.to,target)<=target.range+.000001,`${id}/${clip.id} reaches the visible prop`);}
   for(const vertex of clip.path)assert(isWalkable(physical,vertex),`${id}/${clip.id} has a solid-floor waypoint`);
  }
  let frames=0,prior=new Map(timeline.state.actors.map(actor=>[actor.id,actor]));
  while(!timeline.state.finished&&frames++<2000){
   timeline.update(100);
   for(const actor of timeline.state.actors){
    const previous=prior.get(actor.id);assert(distance(actor,previous)<=room.geometry.speed*.1+.00001,`${id}/${actor.id} exceeds authored walk speed`);
    assert(isWalkable(physical,actor),`${id}/${actor.id} crosses furniture`);prior.set(actor.id,actor);
   }
  }
  assert(frames<2000,id);assert.equal(timeline.state.activeClipIds.length,0);assert(timeline.state.actors.every(actor=>!actor.moving&&!actor.action&&!actor.emote));
 }
 assert.equal(moved,69);assert.equal(JSON.stringify({scenes:CAMPAIGN_SCENES,beats:ROOM_CUTSCENES}),before);
});

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
