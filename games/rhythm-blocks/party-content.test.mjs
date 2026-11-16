import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTY_MEMBER_IDS,PARTY_PEOPLE_BY_ROOM,PARTY_ROUTE_HINTS,getRoomPeople} from './party-content.mjs';
import {ROOM_CONTENT} from './chapter-content.mjs';
import {CHAPTER_DOORS,CHAPTER_SOURCES} from './chapter.mjs';
import {NOTE_KIND_BY_ID} from './engine.mjs';

// These are narrative party members established in replay-and-party.md, not
// additional local residents or automatic note supplies.
test('all four rooms host the established travelling ensemble and retain the canal keeper',()=>{
  assert.deepEqual(PARTY_MEMBER_IDS,['nell','iris','pip']);
  for(const roomId of Object.keys(ROOM_CONTENT)){
    const people=getRoomPeople(roomId),ids=people.map(person=>person.id);
    assert.deepEqual(ids.filter(id=>PARTY_MEMBER_IDS.includes(id)),PARTY_MEMBER_IDS);
    assert.equal(new Set(ids).size,ids.length);
    assert.equal(people.length,roomId==='canal-porch'?4:3);
    assert.deepEqual(PARTY_PEOPLE_BY_ROOM[roomId].map(person=>person.id),PARTY_MEMBER_IDS);
  }
  const keeper=getRoomPeople('canal-porch').find(person=>person.id==='oren');
  assert.equal(keeper,ROOM_CONTENT['canal-porch'].people[0]);
  assert.equal(keeper.sourceId,undefined,'The canal supply stays in its chest.');
});

test('existing conversations, note gifts and exact demo rhythms are preserved without replacement',()=>{
  for(const [roomId,room]of Object.entries(ROOM_CONTENT)){
    for(const person of room.people){
      assert.equal(getRoomPeople(roomId).find(entry=>entry.id===person.id),person);
    }
  }
  const gifts=Object.entries(ROOM_CONTENT).flatMap(([roomId])=>getRoomPeople(roomId)
    .filter(person=>person.sourceId).map(person=>({roomId,person:person.id,sourceId:person.sourceId})));
  assert.deepEqual(gifts,[
    {roomId:'depot',person:'nell',sourceId:'nell-parcel'},
    {roomId:'garden-porch',person:'iris',sourceId:'iris-gift'},
    {roomId:'workshop-porch',person:'pip',sourceId:'pip-gift'},
  ]);
  for(const gift of gifts){
    const source=CHAPTER_SOURCES[gift.sourceId];
    assert.equal(source.roomId,gift.roomId);assert.equal(source.character,gift.person);
    assert.equal(source.type,'npc');
  }
});

test('new companions teach the current room key and keep scarce notes with the authored supply',()=>{
  const expectedSource={
    'garden-porch':'Iris',
    'workshop-porch':'Pip',
    'canal-porch':'chest',
  };
  for(const [roomId,room]of Object.entries(ROOM_CONTENT)){
    for(const person of getRoomPeople(roomId)){
      for(const field of ['name','role','story','route','inventory'])assert.equal(typeof person[field],'string');
      if(room.people.some(resident=>resident.id===person.id))continue;
      assert.equal(person.sourceId,undefined);
      assert.equal(person.sourceLabel,undefined);
      assert.deepEqual(person.demo,CHAPTER_DOORS[`${roomId}-forward`].recipe);
      assert.equal(person.demo.reduce((sum,kind)=>sum+NOTE_KIND_BY_ID[kind].units,0),8);
      assert(person.inventory.includes(expectedSource[roomId]),`${roomId}/${person.id} should identify the actual supply.`);
    }
  }
});

test('the added route clue catalog contains just the seven additional room conversations',()=>{
  assert.deepEqual(PARTY_ROUTE_HINTS.map(hint=>hint.id),[
    'garden-porch-nell-route','garden-porch-pip-route',
    'workshop-porch-nell-route','workshop-porch-iris-route',
    'canal-porch-nell-route','canal-porch-iris-route','canal-porch-pip-route',
  ]);
  assert.equal(new Set(PARTY_ROUTE_HINTS.map(hint=>hint.id)).size,7);
  for(const hint of PARTY_ROUTE_HINTS){
    const [roomId]=Object.keys(ROOM_CONTENT).filter(id=>hint.id.startsWith(id+'-'));
    const person=getRoomPeople(roomId).find(entry=>hint.id===`${roomId}-${entry.id}-route`);
    assert.equal(hint.text,person.route);
    assert(hint.title.includes(person.name));
  }
});

test('party dialogue is immutable and unknown room lookups do not invent people or supplies',()=>{
  assert(Object.isFrozen(PARTY_MEMBER_IDS));
  assert(Object.isFrozen(PARTY_PEOPLE_BY_ROOM));
  assert(Object.isFrozen(PARTY_ROUTE_HINTS));
  for(const roomId of Object.keys(ROOM_CONTENT)){
    assert(Object.isFrozen(getRoomPeople(roomId)));
    for(const person of getRoomPeople(roomId)){
      assert(Object.isFrozen(person));assert(Object.isFrozen(person.demo));
    }
  }
  for(const id of [null,undefined,42,'unknown','__proto__','constructor']){
    assert.deepEqual(getRoomPeople(id),[]);assert(Object.isFrozen(getRoomPeople(id)));
  }
  const person=getRoomPeople('garden-porch')[0];
  assert.throws(()=>{person.sourceId='nell-parcel';},TypeError);
  assert.throws(()=>{person.demo.push('quarter');},TypeError);
  assert.throws(()=>{getRoomPeople('canal-porch').pop();},TypeError);
});
