import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoteInventory,normalizeYellowNotes,normalizeNPCRhythmWins,INVENTORY_NOTE_VALUES,NOTE_INVENTORY_LIMIT} from './note-inventory.mjs';
import {createTownJournal} from './town-game-audio.mjs';
import {NOTE_VALUES} from './town-game-rules.mjs';

function fixture(){const data={version:1,stars:7,netWins:3,fish:{'copper-sprat':{count:2,best:21}},yellowNotes:normalizeYellowNotes(),npcRhythmWins:{}};let saves=0,allowed=true;const journal={data,save(){saves++;return allowed;},warning:'Blocked storage'};return {data,inventory:createNoteInventory(journal),get saves(){return saves;},fail(){allowed=false;},allow(){allowed=true;}};}
test('yellow cards accumulate as three note-only groups independently of blue wins and fishing',()=>{
 assert.deepEqual(INVENTORY_NOTE_VALUES,NOTE_VALUES);const f=fixture();for(const value of ['quarter','quarter','eighth-pair','sixteenth-group'])assert(f.inventory.add(value));
 assert.deepEqual(f.inventory.counts,{quarter:2,'eighth-pair':1,'sixteenth-group':1});assert.equal(f.inventory.total,4);assert.equal(f.saves,4);assert.equal(f.data.netWins,3);assert.equal(f.data.stars,7);assert.deepEqual(f.data.fish,{'copper-sprat':{count:2,best:21}});
 for(const value of ['half','eighth','quarter-rest'])assert.equal(f.inventory.add(value),false);assert.equal(f.inventory.total,4);assert.equal(f.saves,4);
});
test('a successful NPC request spends repeated cards, records one completion and saves rewards atomically',()=>{
 const f=fixture(),values=['quarter','quarter','eighth-pair','sixteenth-group'];for(const value of values)f.inventory.add(value);f.inventory.add('sixteenth-group');const saves=f.saves;
 assert(f.inventory.canSpend(values));assert(f.inventory.spend(values,{npcId:'bach',stars:2}));assert.equal(f.saves,saves+1);assert.equal(f.inventory.total,1);assert.equal(f.inventory.counts['sixteenth-group'],1);assert.equal(f.data.stars,9);assert.equal(f.data.npcRhythmWins.bach,1);assert.equal(f.inventory.canSpend(values),false);assert.equal(f.inventory.spend(values,{npcId:'bach'}),false);assert.equal(f.saves,saves+1);assert.equal(f.data.stars,9);
});
test('failed storage leaves both caught cards and spent-card rewards unchanged',()=>{
 const f=fixture(),values=['quarter','eighth-pair','sixteenth-group','quarter'];for(const value of values)f.inventory.add(value);const before=JSON.stringify(f.data);f.fail();
 assert.equal(f.inventory.add('quarter'),false);assert.equal(JSON.stringify(f.data),before);assert.equal(f.inventory.spend(values,{npcId:'nina'}),false);assert.equal(JSON.stringify(f.data),before);assert.match(f.inventory.error,/Blocked storage/);
});
test('invalid counts and NPC fields are discarded without accepting invented notes or prototype keys',()=>{
 assert.deepEqual(normalizeYellowNotes({quarter:1.5,'eighth-pair':-1,'sixteenth-group':Infinity,'quarter-rest':1000001,half:7}),{quarter:1000000,'eighth-pair':0,'sixteenth-group':0});
 assert.deepEqual(normalizeNPCRhythmWins(JSON.parse('{"bach":2,"__proto__":3,"constructor":1,"bad.name":5,"mozart":-1}')),{bach:2});const f=fixture();assert.equal(f.inventory.spend([], {npcId:'bach'}),false);assert.equal(f.inventory.canSpend(['half']),false);
});
test('journal migration preserves old stars, blue wins and fish while yellow inventories stay owner scoped on reload',()=>{
 const previous=globalThis.localStorage,store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 try{store.set('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:3,fish:{'copper-sprat':{count:2,best:21}}}));let owner='guest';const journal=createTownJournal(()=>owner),inventory=createNoteInventory(journal);assert.equal(inventory.total,0);assert(inventory.add('quarter'));assert.equal(journal.data.stars,7);assert.equal(journal.data.netWins,3);
  owner='classroom-player';assert.equal(inventory.total,0);assert(inventory.add('sixteenth-group'));owner='guest';assert.equal(inventory.counts.quarter,1);assert.equal(Object.hasOwn(inventory.counts,'quarter-rest'),false);const fresh=createNoteInventory(createTownJournal(()=>'guest'));assert.equal(fresh.counts.quarter,1);assert.equal(fresh.total,1);
 }finally{globalThis.localStorage=previous;}
});

test('legacy rest catches convert one-for-one into quarter cards once without changing their source record',()=>{
 const raw={quarter:2,'eighth-pair':4,'sixteenth-group':1,'quarter-rest':3},before=JSON.stringify(raw),counts=normalizeYellowNotes(raw);
 assert.deepEqual(counts,{quarter:5,'eighth-pair':4,'sixteenth-group':1});assert.deepEqual(normalizeYellowNotes(counts),counts);assert.deepEqual(normalizeYellowNotes(normalizeYellowNotes(counts)),counts);assert.equal(JSON.stringify(raw),before);
 assert.equal(normalizeYellowNotes({quarter:NOTE_INVENTORY_LIMIT-2,'quarter-rest':5}).quarter,NOTE_INVENTORY_LIMIT);
 for(const invalid of [-1,1.5,'3',Infinity,Number.MAX_SAFE_INTEGER+1])assert.deepEqual(normalizeYellowNotes({'quarter-rest':invalid}),{quarter:0,'eighth-pair':0,'sixteenth-group':0});
});

test('migration and spending survive failed saves without duplicating cards or paying an extra reward',()=>{
 const f=fixture();f.data.yellowNotes={quarter:2,'eighth-pair':1,'sixteenth-group':1,'quarter-rest':3};const before=JSON.stringify(f.data),values=['quarter','eighth-pair','sixteenth-group','quarter'];
 assert.equal(f.inventory.total,7);assert.equal(f.inventory.canSpend(['quarter-rest']),false);assert.equal(f.inventory.spend(['quarter-rest'],{npcId:'nina'}),false);assert.equal(f.saves,0);
 f.fail();assert.equal(f.inventory.add('quarter'),false);assert.equal(JSON.stringify(f.data),before);assert.equal(f.inventory.total,7);
 assert.equal(f.inventory.spend(values,{npcId:'nina'}),false);assert.equal(JSON.stringify(f.data),before);assert.deepEqual(f.inventory.counts,{quarter:5,'eighth-pair':1,'sixteenth-group':1});
 f.allow();assert(f.inventory.spend(values,{npcId:'nina'}));assert.deepEqual(f.data.yellowNotes,{quarter:3,'eighth-pair':0,'sixteenth-group':0});assert.equal(f.inventory.total,3);assert.equal(f.data.stars,8);assert.equal(f.data.npcRhythmWins.nina,1);
 assert.equal(f.inventory.spend(values,{npcId:'nina'}),false);assert.equal(f.data.stars,8);assert.equal(f.data.npcRhythmWins.nina,1);assert.equal(f.data.netWins,3);assert.deepEqual(f.data.fish,{'copper-sprat':{count:2,best:21}});
});

test('legacy inventory reloads and owner changes keep the conversion isolated and idempotent',()=>{
 const previous=globalThis.localStorage,store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 try{
  const old={version:1,stars:7,netWins:3,fish:{'copper-sprat':{count:2,best:21}},yellowNotes:{quarter:2,'eighth-pair':1,'quarter-rest':3},npcRhythmWins:{bach:2}};
  store.set('codaTownAdventuresV1:guest',JSON.stringify(old));store.set('codaTownAdventuresV1:classroom-player',JSON.stringify({...old,yellowNotes:{quarter:1,'quarter-rest':2},stars:19,npcRhythmWins:{mozart:4}}));
  let owner='guest';const journal=createTownJournal(()=>owner),inventory=createNoteInventory(journal);
  assert.equal(inventory.counts.quarter,5);assert.equal(inventory.counts.quarter,5);assert.equal(createNoteInventory(createTownJournal(()=>'guest')).counts.quarter,5);
  assert.equal(JSON.parse(store.get('codaTownAdventuresV1:guest')).yellowNotes['quarter-rest'],3,'Loading migration does not write progress or duplicate converted cards');
  owner='classroom-player';assert.equal(inventory.counts.quarter,3);assert.equal(journal.data.stars,19);assert(inventory.add('eighth-pair'));assert.deepEqual(journal.data.npcRhythmWins,{mozart:4});
  owner='guest';assert.equal(inventory.counts.quarter,5);assert(inventory.add('quarter'));assert.equal(journal.data.stars,7);assert.equal(journal.data.netWins,3);assert.deepEqual(journal.data.npcRhythmWins,{bach:2});assert.deepEqual(journal.data.fish,old.fish);
  assert.deepEqual(createNoteInventory(createTownJournal(()=>'guest')).counts,{quarter:6,'eighth-pair':1,'sixteenth-group':0});assert.deepEqual(createNoteInventory(createTownJournal(()=>'classroom-player')).counts,{quarter:3,'eighth-pair':1,'sixteenth-group':0});
  for(const value of store.values())assert.equal(Object.hasOwn(JSON.parse(value).yellowNotes,'quarter-rest'),false,'Successful saves persist the three-note shape');
 }finally{globalThis.localStorage=previous;}
});
