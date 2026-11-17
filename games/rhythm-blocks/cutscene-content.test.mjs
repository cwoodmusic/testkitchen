import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_CUTSCENES,getRoomCutscene} from './cutscene-content.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';
import {compileRoomCutscene,createRoomCutscene,separateCutsceneTracks} from './cutscene.mjs';
import {isWalkable} from './room.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const actor=(performance,id)=>performance.state.actors.find(item=>item.id===id);
const compiled=(roomId,beats=ROOM_CUTSCENES[roomId])=>compileRoomCutscene({scene:CAMPAIGN_SCENES[roomId],beats});

test('every room has an individually editable, local discussion led by Nell with Mira carrying the strongest voice',()=>{
 assert.deepEqual(Object.keys(ROOM_CUTSCENES),Object.keys(CAMPAIGN_CONTENT));
 assert.equal(Object.keys(ROOM_CUTSCENES).length,23);
 const lines=new Set(),ids=new Set();
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const dialogue=beats.filter(beat=>beat.kind==='dialogue');
  assert.deepEqual(dialogue.map(beat=>beat.speaker),['nell','pip','mira','iris','nell','mira'],roomId);
  assert.equal(dialogue[0].startTile,0,`${roomId}: Nell leads while the party explores`);
  const totalBySpeaker={};
  for(const [index,beat]of dialogue.entries()){
   assert.equal(beat.id,`${roomId}-arrival-${index+1}`);
   assert(beat.text.length>=45&&beat.text.length<=155,`${beat.id}: readable, short line (${beat.text.length})`);
   assert(!lines.has(beat.text),`${beat.id}: local dialogue, not a repeated placeholder`);lines.add(beat.text);
   assert.equal(beat.text,beat.text.trim());
   if(index)assert.equal(beat.startTile,dialogue[index-1].startTile+dialogue[index-1].durationTiles,'Spoken lines do not interrupt one another.');
   totalBySpeaker[beat.speaker]=(totalBySpeaker[beat.speaker]??0)+beat.text.length;
  }
  assert(totalBySpeaker.mira>totalBySpeaker.iris&&totalBySpeaker.mira>totalBySpeaker.pip,roomId);
  for(const beat of beats){
   assert(!ids.has(beat.id),`${beat.id}: stable unique item`);ids.add(beat.id);
   assert(['walk','dialogue','emote','gesture'].includes(beat.kind));
   assert(Number.isSafeInteger(beat.startTile)&&beat.startTile>=0);
   assert(Number.isSafeInteger(beat.durationTiles)&&beat.durationTiles>=1);
   if(beat.kind!=='dialogue')assert(!Object.hasOwn(beat,'text'));
  }
  assert.deepEqual(separateCutsceneTracks({scene:CAMPAIGN_SCENES[roomId],beats}),beats,'No legacy combined records need splitting.');
 }
 assert.equal(lines.size,138);
});

test('all four characters move and emote together instead of waiting for their speaking turn',()=>{
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const performance=createRoomCutscene({scene:CAMPAIGN_SCENES[roomId],beats});
  performance.seek(1.5);
  for(const id of ['nell','iris','pip','mira']){
   assert(actor(performance,id).moving,`${roomId}: ${id} joins the exploration`);
   assert(actor(performance,id).emote,`${roomId}: ${id} reacts while moving`);
  }
  assert.equal(performance.state.beat.speaker,'nell');
  const c=performance.timeline;
  assert.deepEqual(c.adjustments,[],`${roomId}: shipped timing fits the actual paths without silent repairs`);
  const physical={...CAMPAIGN_SCENES[roomId].geometry,obstacles:CAMPAIGN_SCENES[roomId].geometry.obstacles.filter(obstacle=>!['nell','iris','pip'].includes(obstacle.id))};
  for(const clip of c.clips.filter(clip=>clip.kind==='walk')){
   assert(clip.pathLength>0,`${clip.id}: real movement`);
   for(const [index,point]of clip.path.entries()){
    assert(isWalkable(physical,point),`${clip.id}: on actual room floor`);
    if(index)assert(Math.abs(point.x-clip.path[index-1].x)<.000001||Math.abs(point.y-clip.path[index-1].y)<.000001,'No diagonal legs.');
   }
  }
 }
});

test('the three companions reach different real inspection props while Mira takes an open observation spot',()=>{
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const scene=CAMPAIGN_SCENES[roomId],content=CAMPAIGN_CONTENT[roomId],c=compiled(roomId);
  const inspections=c.clips.filter(clip=>clip.kind==='walk'&&clip.target);
  assert.equal(inspections.length,3,roomId);
  assert.equal(new Set(inspections.map(clip=>clip.target)).size,3,roomId);
  assert.deepEqual(new Set(inspections.map(clip=>clip.actor)),new Set(['nell','iris','pip']));
  for(const clip of inspections){
   const target=scene.geometry.targets.find(target=>target.id===clip.target),object=scene.objects.find(object=>object.id===clip.target);
   assert.equal(target?.type,'inspect');assert.equal(object?.type,'inspect');
   assert(content.inspections.some(entry=>entry.id===clip.target));
   assert(distance(clip.to,target)<=target.range+.000001,`${clip.id}: close enough to inspect, not merely pointed in its direction`);
  }
  assert(c.clips.some(clip=>clip.kind==='walk'&&clip.actor==='mira'&&clip.destination&&!clip.target));
 }
});

test('Pip rushes, startles, visibly falls and recovers, then actually reaches his discovery',()=>{
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const performance=createRoomCutscene({scene:CAMPAIGN_SCENES[roomId],beats}),c=performance.timeline;
  const walks=c.clips.filter(clip=>clip.actor==='pip'&&clip.kind==='walk'),gestures=c.clips.filter(clip=>clip.actor==='pip'&&clip.kind==='gesture');
  assert.deepEqual(gestures.map(clip=>clip.gesture),['trip','fallen','recover'],roomId);
  assert.equal(walks.length,2);assert(walks.every(clip=>clip.gait==='run'&&clip.speedMultiplier===2));
  assert.equal(gestures[0].startTile,walks[0].endTile);
  assert.equal(gestures[1].startTile,gestures[0].endTile);
  assert.equal(gestures[2].startTile,gestures[1].endTile);
  assert.equal(walks[1].startTile,gestures[2].endTile);
  const feet=walks[0].to;
  for(const clip of gestures){
   assert(clip.durationTiles>=4,'A full pose is visible, rather than a single flash.');
   performance.seek(clip.startTile+clip.durationTiles/2);
   const pose=actor(performance,'pip');
   assert.equal(pose.gesture,clip.gesture);assert(Math.abs(pose.gestureProgress-.5)<.000001);
   assert(!pose.moving,'Falling/recovery is not a sliding walk.');
   assert(distance(pose,feet)<.000001,'Performance transforms do not change navigation feet.');
  }
  performance.seek(walks[1].startTile+.25);assert(actor(performance,'pip').moving);assert.equal(actor(performance,'pip').gesture,null);
 }
});

test('Iris deliberately raises her glass at the evidence; Nell remains composed and the whole party reacts',()=>{
 const allEmotes=new Set();
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const performance=createRoomCutscene({scene:CAMPAIGN_SCENES[roomId],beats}),c=performance.timeline;
  const glass=c.clips.find(clip=>clip.actor==='iris'&&clip.gesture==='magnify');
  const irisWalk=c.clips.find(clip=>clip.actor==='iris'&&clip.kind==='walk');
  assert(glass);assert.equal(glass.startTile,irisWalk.endTile,'Glass is raised on arriving at the evidence.');
  performance.seek(glass.startTile+.5);
  assert.equal(actor(performance,'iris').gesture,'magnify');assert(!actor(performance,'iris').moving);
  assert(distance(actor(performance,'iris'),irisWalk.to)<.000001);
  for(const beat of beats.filter(beat=>beat.kind==='emote')){
   allEmotes.add(beat.emote);
   if(beat.actor==='nell'||beat.actor==='iris')assert(['thinking','idea'].includes(beat.emote),`${roomId}: composed leader and unflappable investigator`);
  }
 }
 assert.deepEqual(allEmotes,new Set(['thinking','happy','idea','surprise','question']));
 const mira=Object.values(ROOM_CUTSCENES).flat().filter(clip=>clip.speaker==='mira').map(clip=>clip.text).join(' ');
 assert.match(mira,/breakfast/);assert.match(mira,/supper/);assert.match(mira,/stomach/);assert.match(mira,/biscuit/);
});

test('hidden caches remain passive observations, and arrivals never supply puzzle keys or transactions',()=>{
 const hidden=Object.entries(CAMPAIGN_CONTENT).flatMap(([roomId,room])=>room.inspections.filter(entry=>entry.sourceId).map(entry=>({roomId,entry})));
 assert.equal(hidden.length,2);
 for(const {roomId,entry}of hidden){
  const beats=ROOM_CUTSCENES[roomId],cacheBeat=beats.find(beat=>beat.kind==='walk'&&beat.target===entry.id);
  assert.equal(cacheBeat.action,'look','A visible detail is noticed without searching its hidden contents.');
  assert(beats.some(beat=>beat.action==='search'&&beat.target!==entry.id));
  assert.doesNotMatch(beats.filter(beat=>beat.text).map(beat=>beat.text).join(' '),/\bnotes?\b|\btiles?\b|\bcache\b|\bstorage\b|\bseam\b|\blift\b|\blid\b|\bhidden door\b/i);
 }
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const copy=beats.filter(beat=>beat.text).map(beat=>beat.text).join(' ');
  assert.doesNotMatch(copy,/quarter note|half note|half rest|quarter rest|dotted half|paired eighth|paired sixteenth|four sixteenth|\d+ beats?|receive.*notes|collect.*notes/i,roomId);
  assert.doesNotMatch(copy,/secret ending|hidden ending|hidden cache|continuation preview|not playable|coming soon|TODO/i,roomId);
  for(const beat of beats){assert(!Object.hasOwn(beat,'sourceId'));assert(!Object.hasOwn(beat,'recipe'));assert(!Object.hasOwn(beat,'doorId'));}
 }
});

test('default scripts and all their nested authoring data are frozen with no fallback for unknown rooms',()=>{
 assert(Object.isFrozen(ROOM_CUTSCENES));
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  assert.equal(getRoomCutscene(roomId),beats);assert(Object.isFrozen(beats));
  for(const beat of beats){assert(Object.isFrozen(beat));assert.throws(()=>{beat.startTile=999;},TypeError);if(beat.destination)assert(Object.isFrozen(beat.destination));}
  assert.throws(()=>beats.push({speaker:'mira',text:'Changed'}),TypeError);
 }
 for(const id of [null,undefined,3,{},'unknown','__proto__','constructor'])assert.equal(getRoomCutscene(id),null);
});
