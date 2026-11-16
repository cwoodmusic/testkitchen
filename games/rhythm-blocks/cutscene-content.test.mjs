import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_CUTSCENES,getRoomCutscene} from './cutscene-content.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_SCENES} from './campaign-scenes.mjs';

const actions=new Set(['examine','search','listen','look']);
const emotes=new Set(['idea','question','thinking','surprise','happy']);
const fields=new Set(['id','speaker','actor','target','action','text','emote']);

test('each dungeon room and outcome has a short, unique four-person arrival discussion',()=>{
 assert.deepEqual(Object.keys(ROOM_CUTSCENES),Object.keys(CAMPAIGN_CONTENT));
 assert.equal(Object.keys(ROOM_CUTSCENES).length,23);
 const lines=new Set(),ids=new Set();
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  assert.equal(beats.length,4,roomId);
  assert.deepEqual(beats.map(beat=>beat.speaker),['nell','iris','pip','mira']);
  for(const [index,beat]of beats.entries()){
   assert.equal(beat.id,`${roomId}-arrival-${index+1}`);
   assert(!ids.has(beat.id));ids.add(beat.id);
   assert(beat.text.length>=60&&beat.text.length<=150,`${beat.id} remains a brief readable line`);
   assert(!lines.has(beat.text),`${beat.id} is not a shared placeholder`);lines.add(beat.text);
   assert.equal(beat.text,beat.text.trim());
   assert(Object.keys(beat).every(key=>fields.has(key)),`${beat.id} contains only staged narrative data`);
  }
 }
 assert.equal(lines.size,92);assert.equal(ids.size,92);
});

test('the travelling companions actually approach three distinct local inspection props',()=>{
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const scene=CAMPAIGN_SCENES[roomId],content=CAMPAIGN_CONTENT[roomId],moving=beats.filter(beat=>beat.target);
  assert.equal(moving.length,3,roomId);
  assert.equal(new Set(moving.map(beat=>beat.target)).size,3,`${roomId} searches different parts of the room`);
  for(const beat of moving){
   assert(scene.actors.some(actor=>actor.id===(beat.actor??beat.speaker)),beat.id);
   assert(content.people.some(person=>person.id===beat.speaker),beat.id);
   const target=scene.geometry.targets.find(target=>target.id===beat.target);
   const object=scene.objects.find(object=>object.id===beat.target);
   assert.equal(target?.type,'inspect',`${beat.id} names a physical prop, not a hidden gate`);
   assert.equal(object?.type,'inspect');
   assert(content.inspections.some(entry=>entry.id===beat.target),beat.id);
   assert(actions.has(beat.action));
  }
  assert(beats.some(beat=>['examine','search','listen'].includes(beat.action)),roomId);
 }
});

test('visible question and idea emotes fit the discussions in every location',()=>{
 const all=new Set();
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  assert(beats.some(beat=>beat.emote==='question'),roomId);
  assert(beats.some(beat=>beat.emote==='idea'),roomId);
  for(const beat of beats){
   assert(emotes.has(beat.emote),beat.id);all.add(beat.emote);
   if(beat.emote==='question')assert.match(beat.text,/\?/,`${beat.id} expresses actual curiosity`);
  }
 }
 assert.deepEqual(all,new Set(['question','thinking','surprise','idea','happy']));
});

test('hidden caches stay passive observations instead of being searched or disclosed automatically',()=>{
 const hidden=Object.entries(CAMPAIGN_CONTENT).flatMap(([roomId,room])=>room.inspections.filter(entry=>entry.sourceId).map(entry=>({roomId,entry})));
 assert.equal(hidden.length,2);
 for(const {roomId,entry}of hidden){
  const beats=ROOM_CUTSCENES[roomId],cacheBeat=beats.find(beat=>beat.target===entry.id);
  assert.equal(cacheBeat.action,'look','A visible detail can be noticed without searching its hidden contents.');
  assert(beats.some(beat=>beat.action==='search'&&beat.target!==entry.id));
  assert.doesNotMatch(beats.map(beat=>beat.text).join(' '),/\bnotes?\b|\btiles?\b|\bcache\b|\bstorage\b|\bseam\b|\blift\b|\blid\b|\bhidden door\b/i);
 }
});

test('arrival conversations do not supply puzzle answers, transactions or future-route spoilers',()=>{
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  const copy=beats.map(beat=>beat.text).join(' ');
  assert.doesNotMatch(copy,/quarter note|half note|half rest|quarter rest|dotted half|paired eighth|paired sixteenth|four sixteenth|\d+ beats?|receive.*notes|collect.*notes/i,roomId);
  assert.doesNotMatch(copy,/secret ending|hidden ending|hidden cache|continuation preview|not playable|coming soon|TODO/i,roomId);
  for(const beat of beats){
   assert(!Object.hasOwn(beat,'sourceId'));assert(!Object.hasOwn(beat,'recipe'));assert(!Object.hasOwn(beat,'doorId'));
  }
 }
});

test('default scripts and every nested beat are frozen, with no fallback for unknown rooms',()=>{
 assert(Object.isFrozen(ROOM_CUTSCENES));
 for(const [roomId,beats]of Object.entries(ROOM_CUTSCENES)){
  assert.equal(getRoomCutscene(roomId),beats);assert(Object.isFrozen(beats));
  for(const beat of beats){assert(Object.isFrozen(beat));assert.throws(()=>{beat.text='Changed';},TypeError);}
  assert.throws(()=>beats.push({speaker:'mira',text:'Changed'}),TypeError);
 }
 for(const id of [null,undefined,3,{},'unknown','__proto__','constructor'])assert.equal(getRoomCutscene(id),null);
});
