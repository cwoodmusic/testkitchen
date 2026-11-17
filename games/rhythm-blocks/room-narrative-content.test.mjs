import test from 'node:test';
import assert from 'node:assert/strict';
import {ROOM_NARRATIONS,upgradeRoomNarration} from './room-narrative-content.mjs';
import {CAMPAIGN_PLAN} from './campaign-data.mjs';

test('every released room and outcome has a brief readable scene introduction',()=>{
 const ids=[...CAMPAIGN_PLAN.rooms,...CAMPAIGN_PLAN.terminals].map(room=>room.id).sort();
 assert.equal(ids.length,23);assert.deepEqual(Object.keys(ROOM_NARRATIONS).sort(),ids);assert(Object.isFrozen(ROOM_NARRATIONS));
 for(const [id,narration]of Object.entries(ROOM_NARRATIONS)){
  assert(narration.length>=180&&narration.length<=400,`${id}: keep a short room introduction (${narration.length} characters).`);
  assert.equal(narration.trim(),narration);
  const sentences=narration.match(/[.!?](?:\s|$)/gu)??[];
  assert(sentences.length>=2&&sentences.length<=3,`${id}: use two or three sentences.`);
 }
});

test('upgrading an older project adds only missing narration to its known room content',()=>{
 const custom={depot:{arrival:'Custom arrival.'},'garden-porch':{narration:'My own garden introduction.'},'workshop-porch':{narration:null},'canal-porch':{narration:''},'garden-fork':{narration:undefined},'my-custom-room':{arrival:'An additional room.'}},project={content:custom,settings:{title:'My game'},extra:{keep:['this']}},before=structuredClone(project);
 const upgraded=upgradeRoomNarration(project);
 assert.notEqual(upgraded,project);assert.notEqual(upgraded.content,project.content);
 assert.equal(upgraded.content.depot.narration,ROOM_NARRATIONS.depot);
 assert.equal(upgraded.content.depot.arrival,'Custom arrival.');
 assert.equal(upgraded.content['garden-porch'].narration,'My own garden introduction.');
 assert.equal(upgraded.content['workshop-porch'].narration,null);
 assert.equal(upgraded.content['canal-porch'].narration,'');
 assert(Object.hasOwn(upgraded.content['garden-fork'],'narration'));assert.equal(upgraded.content['garden-fork'].narration,undefined);
 assert.deepEqual(upgraded.content['my-custom-room'],before.content['my-custom-room']);
 assert(!Object.hasOwn(upgraded.content,'garden-final'),'Absent rooms are never created.');
 assert.deepEqual(upgraded.settings,before.settings);assert.deepEqual(upgraded.extra,before.extra);
 assert.deepEqual(project,before,'Migration does not mutate imported or frozen source data.');
 assert.deepEqual(upgradeRoomNarration(upgraded),upgraded,'A second normalization leaves custom and default prose intact.');
});

test('a partial project and explicit invalid content remain the validator’s responsibility',()=>{
 for(const project of [{},{content:null},{content:{depot:null,'garden-porch':[],'workshop-porch':'bad'}}])assert.deepEqual(upgradeRoomNarration(project),project);
});
