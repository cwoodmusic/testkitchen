import test from 'node:test';
import assert from 'node:assert/strict';
import {createNoteInventory,normalizeYellowNotes,normalizeNPCRhythmWins} from './note-inventory.mjs';
import {createTownJournal} from './town-game-audio.mjs';

function fixture(){const data={version:1,stars:7,netWins:3,fish:{'copper-sprat':{count:2,best:21}},yellowNotes:normalizeYellowNotes(),npcRhythmWins:{}};let saves=0,allowed=true;const journal={data,save(){saves++;return allowed;},warning:'Blocked storage'};return {data,inventory:createNoteInventory(journal),get saves(){return saves;},fail(){allowed=false;}};}
test('yellow cards accumulate as the four allowed groups independently of blue wins and fishing',()=>{
 const f=fixture();for(const value of ['quarter','quarter','eighth-pair','sixteenth-group','quarter-rest'])assert(f.inventory.add(value));
 assert.deepEqual(f.inventory.counts,{quarter:2,'eighth-pair':1,'sixteenth-group':1,'quarter-rest':1});assert.equal(f.inventory.total,5);assert.equal(f.saves,5);assert.equal(f.data.netWins,3);assert.equal(f.data.stars,7);assert.deepEqual(f.data.fish,{'copper-sprat':{count:2,best:21}});
 assert.equal(f.inventory.add('half'),false);assert.equal(f.inventory.add('eighth'),false);assert.equal(f.inventory.total,5);
});
test('a successful NPC request spends repeated cards, records one completion and saves rewards atomically',()=>{
 const f=fixture(),values=['quarter','quarter','eighth-pair','quarter-rest'];for(const value of values)f.inventory.add(value);f.inventory.add('sixteenth-group');const saves=f.saves;
 assert(f.inventory.canSpend(values));assert(f.inventory.spend(values,{npcId:'bach',stars:2}));assert.equal(f.saves,saves+1);assert.equal(f.inventory.total,1);assert.equal(f.inventory.counts['sixteenth-group'],1);assert.equal(f.data.stars,9);assert.equal(f.data.npcRhythmWins.bach,1);assert.equal(f.inventory.canSpend(values),false);assert.equal(f.inventory.spend(values,{npcId:'bach'}),false);assert.equal(f.saves,saves+1);assert.equal(f.data.stars,9);
});
test('failed storage leaves both caught cards and spent-card rewards unchanged',()=>{
 const f=fixture(),values=['quarter','eighth-pair','sixteenth-group','quarter-rest'];for(const value of values)f.inventory.add(value);const before=JSON.stringify(f.data);f.fail();
 assert.equal(f.inventory.add('quarter'),false);assert.equal(JSON.stringify(f.data),before);assert.equal(f.inventory.spend(values,{npcId:'nina'}),false);assert.equal(JSON.stringify(f.data),before);assert.match(f.inventory.error,/Blocked storage/);
});
test('invalid counts and NPC fields are discarded without accepting invented notes or prototype keys',()=>{
 assert.deepEqual(normalizeYellowNotes({quarter:1.5,'eighth-pair':-1,'sixteenth-group':Infinity,'quarter-rest':1000001,half:7}),{quarter:0,'eighth-pair':0,'sixteenth-group':0,'quarter-rest':1000000});
 assert.deepEqual(normalizeNPCRhythmWins(JSON.parse('{"bach":2,"__proto__":3,"constructor":1,"bad.name":5,"mozart":-1}')),{bach:2});const f=fixture();assert.equal(f.inventory.spend([], {npcId:'bach'}),false);assert.equal(f.inventory.canSpend(['half']),false);
});
test('journal migration preserves old stars, blue wins and fish while yellow inventories stay owner scoped on reload',()=>{
 const previous=globalThis.localStorage,store=new Map();globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 try{store.set('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:3,fish:{'copper-sprat':{count:2,best:21}}}));let owner='guest';const journal=createTownJournal(()=>owner),inventory=createNoteInventory(journal);assert.equal(inventory.total,0);assert(inventory.add('quarter'));assert.equal(journal.data.stars,7);assert.equal(journal.data.netWins,3);
  owner='classroom-player';assert.equal(inventory.total,0);assert(inventory.add('quarter-rest'));owner='guest';assert.equal(inventory.counts.quarter,1);assert.equal(inventory.counts['quarter-rest'],0);const fresh=createNoteInventory(createTownJournal(()=>'guest'));assert.equal(fresh.counts.quarter,1);assert.equal(fresh.total,1);
 }finally{globalThis.localStorage=previous;}
});
