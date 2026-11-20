import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECT_DIALOGUES,getObjectDialogue} from './object-dialogue-content.mjs';
import {CAMPAIGN_CONTENT} from './campaign-content.mjs';
import {CAMPAIGN_PLAN} from './campaign-data.mjs';

const clone=value=>structuredClone(value);
const observations=new Map(Object.entries(CAMPAIGN_CONTENT).flatMap(([roomId,room])=>room.inspections.map(entry=>[entry.id,{roomId,room,entry}])));

test('every released room and outcome has an authored landmark exchange',()=>{
 const covered=new Set();
 assert.equal(Object.keys(CAMPAIGN_CONTENT).length,26);
 assert.equal(Object.keys(OBJECT_DIALOGUES).length,27);
 for(const [objectId,lines]of Object.entries(OBJECT_DIALOGUES)){
  const observation=observations.get(objectId);assert(observation,`${objectId} needs a real inspectable object`);
  covered.add(observation.roomId);
  assert(lines.length>=3&&lines.length<=4,`${objectId} remains a short exchange`);
  assert(new Set(lines.map(line=>line.speaker)).size>=3,`${objectId} gives the party a conversation`);
 }
 assert.deepEqual(covered,new Set(Object.keys(CAMPAIGN_CONTENT)));
 assert.equal(Object.keys(OBJECT_DIALOGUES).filter(id=>observations.get(id).roomId==='depot').length,2);
});

test('each voice belongs to the local cast and each line is bounded display data',()=>{
 const texts=new Set();let count=0;
 for(const [objectId,lines]of Object.entries(OBJECT_DIALOGUES)){
  const {room}=observations.get(objectId),cast=new Set(['mira',...room.people.map(person=>person.id)]);
  assert.equal(getObjectDialogue(objectId),lines);
  for(const line of lines){
   assert(cast.has(line.speaker),`${objectId}/${line.speaker} must be present`);
   assert.equal(typeof line.text,'string');assert(line.text.trim());assert(line.text.length<=600);
   assert(!texts.has(line.text),`${objectId} needs its own words`);texts.add(line.text);count++;
   assert.deepEqual(Object.keys(line).sort(),['speaker','text'],'Content cannot grant pickups, open gates or execute actions.');
   assert.doesNotMatch(line.text,/TODO|coming soon|not playable|click here|press (?:a|the) button|\bfunction\b/i);
  }
 }
 assert.equal(count,108);
 assert(OBJECT_DIALOGUES['canal-porch-mooring-bell'].some(line=>line.speaker==='oren'));
});

test('secret observations invite a separate search without granting or spending notes',()=>{
 for(const [objectId,sourceId]of [['garden-alcove-flower-stone','garden-hidden-notes'],['workshop-alcove-hollow-perch','workshop-hidden-notes']]){
  assert.equal(observations.get(objectId).entry.sourceId,sourceId);
  const lines=OBJECT_DIALOGUES[objectId],words=lines.map(line=>line.text).join(' ');
  assert.match(words,/search/i);
  assert.doesNotMatch(words,/you (?:receive|get|gain)|added to|notes found|open(?:ed)? the hidden gate|collect(?:ed)? (?:a|the|your|one|two|four)/i);
  assert(lines.every(line=>!Object.hasOwn(line,'sourceId')&&!Object.hasOwn(line,'recipe')));
 }
});

test('reading or copying exchanges cannot mutate authored lore, routes or the note economy',()=>{
 const content=clone(CAMPAIGN_CONTENT),plan=clone(CAMPAIGN_PLAN),before=clone(OBJECT_DIALOGUES);
 const copy=clone(OBJECT_DIALOGUES);copy['returned-letter'][0].text='Private draft';copy['returned-letter'].push({speaker:'mira',text:'Extra'});
 for(const [id,lines]of Object.entries(OBJECT_DIALOGUES)){
  assert(Object.isFrozen(lines));assert(lines.every(Object.isFrozen));assert.equal(getObjectDialogue(id),lines);
 }
 assert(Object.isFrozen(OBJECT_DIALOGUES));
 assert.throws(()=>{OBJECT_DIALOGUES['returned-letter'][0].text='Mutation';},TypeError);
 assert.throws(()=>OBJECT_DIALOGUES['returned-letter'].push({speaker:'mira',text:'Mutation'}),TypeError);
 assert.deepEqual(OBJECT_DIALOGUES,before);assert.deepEqual(CAMPAIGN_CONTENT,content);assert.deepEqual(CAMPAIGN_PLAN,plan);
 for(const unknown of [undefined,null,'missing','__proto__','constructor',4,{}])assert.equal(getObjectDialogue(unknown),null);
});

test('the new shared repair gives Pip useful evidence and Iris a confirmed reunion without granting rewards',()=>{
 const map=OBJECT_DIALOGUES['final-concourse-service-map'].map(line=>line.text).join(' '),screen=OBJECT_DIALOGUES['final-heart-reply-screen'].map(line=>line.text).join(' '),reply=OBJECT_DIALOGUES['ending-complete-reply'].map(line=>line.text).join(' ');
 assert.match(map,/repairs reset.*journal kept the results/i);
 assert.match(map,/all five lines on this trip/i);
 assert.match(screen,/watching carefully is useful/i,'Pip’s emotional concern contributes to the group’s test.');
 assert.match(reply,/arrived safely.*tea ready/i,'The personal ending includes an actual safe arrival.');
 assert.match(reply,/all four of us finished the repair/i);
 for(const id of ['final-concourse-service-map','final-heart-reply-screen','ending-complete-reply']){
  const lines=OBJECT_DIALOGUES[id];
  assert.deepEqual(new Set(lines.map(line=>line.speaker)),new Set(['mira','nell','pip','iris']));
  assert(lines.every(line=>Object.keys(line).length===2));
 }
});
