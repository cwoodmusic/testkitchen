import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NOTE_KIND_BY_ID,NOTE_KINDS} from './engine.mjs';
import {createStoryGame,classifyPageOne,PAGE_ONE_INITIAL_INVENTORY,PAGE_ONE_SOURCES,PAGE_ONE_DOOR_COSTS,PAGE_TWO_GRANT,PAGE_ONE_ROUTES} from './story.mjs';

const totalUnits=stock=>Object.entries(stock).reduce((n,[kind,count])=>n+NOTE_KIND_BY_ID[kind].units*count,0);
const empty=()=>Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,0]));
const parcel=()=>Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,1]));
const fill=(game,recipe)=>{for(const kind of recipe)assert.equal(game.add(kind),true,kind);};
const collect=game=>{assert.equal(game.claim('nell-parcel'),true);assert.equal(game.claim('depot-chest'),true);return game;};
const prepare=(door='canal')=>{const game=collect(createStoryGame());assert.equal(game.selectDoor(door),true);fill(game,PAGE_ONE_DOOR_COSTS[door]);return game;};

test('the playable room uses the exact sources and locks from the balanced dungeon plan',()=>{
 const dungeon=JSON.parse(readFileSync(new URL('../../design/music-puzzler/dungeon.json',import.meta.url),'utf8'));
 const entry=dungeon.rooms.find(room=>room.id===dungeon.entry);
 assert.deepEqual(dungeon.initialInventory,{});
 assert.equal(entry.sources.length,Object.keys(PAGE_ONE_SOURCES).length);
 for(const source of entry.sources){assert.equal(source.type,PAGE_ONE_SOURCES[source.id].type);assert.deepEqual(source.recipe,PAGE_ONE_SOURCES[source.id].recipe);}
 assert.equal(entry.doors.length,Object.keys(PAGE_ONE_DOOR_COSTS).length);
 for(const [id,recipe]of Object.entries(PAGE_ONE_DOOR_COSTS)){
  const door=entry.doors.find(item=>item.id==='depot-'+id);
  assert.deepEqual(door.recipe,recipe);assert.equal(door.to,PAGE_ONE_ROUTES[id].id);
 }
});

test('the room starts empty and sources supply exactly one of each kind through two explicit interactions',()=>{
 const game=createStoryGame(),state=game.state;
 assert.deepEqual(state.inventory,empty());assert.deepEqual(state.inventory,PAGE_ONE_INITIAL_INVENTORY);
 assert.deepEqual(state.availableInventory,state.inventory);assert.equal(state.phase,'room');assert.equal(state.units,0);
 assert.equal(state.canCommit,false);assert.equal(state.canAttempt,false);assert.equal(state.selectedDoor,null);assert.deepEqual(state.claimedSources,[]);
 assert.equal(game.add('quarter'),false);assert.equal(game.commit(),false);
 assert.equal(game.claim('nell-parcel'),true);assert.equal(totalUnits(game.state.inventory),20);assert.equal(game.state.inventory.half,0);
 assert.equal(game.claim('depot-chest'),true);assert.equal(totalUnits(game.state.inventory),24);assert.deepEqual(game.state.inventory,parcel());
 assert.deepEqual(game.state.claimedSources,['nell-parcel','depot-chest']);assert.deepEqual(game.state.creditedStages,[]);assert.deepEqual(PAGE_TWO_GRANT,[]);
 assert.equal(PAGE_ONE_SOURCES['nell-parcel'].recipe.length,8);assert.deepEqual(PAGE_ONE_SOURCES['depot-chest'].recipe,['half']);
 assert(Object.isFrozen(PAGE_ONE_INITIAL_INVENTORY)&&Object.isFrozen(PAGE_ONE_SOURCES['nell-parcel'].recipe)&&Object.isFrozen(PAGE_ONE_DOOR_COSTS.garden));
});

test('either source order works and repeat, unknown or post-exit collections never supply notes',()=>{
 for(const order of [['nell-parcel','depot-chest'],['depot-chest','nell-parcel']]){
  const game=createStoryGame();for(const id of order){assert.equal(game.claim(id),true);const before=game.state;assert.equal(game.claim(id),false);assert.deepEqual(game.state,before);}
  assert.deepEqual(game.state.inventory,parcel());
  for(const id of ['unknown','constructor','__proto__',null,{},2])assert.equal(game.claim(id),false);
  game.selectDoor('garden');fill(game,PAGE_ONE_DOOR_COSTS.garden);assert.equal(game.commit(),true);
  const after=game.state;for(const id of Object.keys(PAGE_ONE_SOURCES))assert.equal(game.claim(id),false);assert.deepEqual(game.state,after);
 }
});

test('no opening door can be paid before both parcel and chest have been collected',()=>{
 for(const [door,cost] of Object.entries(PAGE_ONE_DOOR_COSTS)){
  for(const source of Object.keys(PAGE_ONE_SOURCES)){
   const game=createStoryGame();game.claim(source);game.selectDoor(door);
   for(const kind of cost)game.add(kind);
   assert.equal(game.commit(),false);assert.equal(game.state.routeId,null);
  }
 }
});

test('a physical door must be selected and accepts its exact order rather than an equal beat total',()=>{
 const game=collect(createStoryGame());fill(game,PAGE_ONE_DOOR_COSTS.canal);
 assert.equal(game.state.units,8);assert.equal(game.state.canAttempt,false);assert.equal(game.commit(),false);
 assert.equal(game.selectDoor('garden'),true);assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);
 const before=game.state;assert.equal(game.commit(),false);assert.deepEqual(game.state,before);
 assert.equal(game.selectDoor('canal'),true);assert.equal(game.state.canCommit,true);assert.equal(game.commit(),true);assert.equal(game.state.routeId,'canal');
 assert.equal(classifyPageOne(PAGE_ONE_DOOR_COSTS.garden),'garden');assert.equal(classifyPageOne(PAGE_ONE_DOOR_COSTS.workshop),'workshop');
 for(const recipe of [['half','half-rest'],['quarter-rest','eighth-pair','sixteenth-group','quarter'],['dotted-half','quarter'],new Array(3),null])assert.throws(()=>classifyPageOne(recipe),/opening door/);
});

test('editing preserves typed inventory and fractional beats without substituting one rhythm symbol for another',()=>{
 const game=collect(createStoryGame());game.selectDoor('canal');fill(game,['dotted-half','eighth']);
 assert.equal(game.state.beats,3.5);assert.equal(game.state.canAttempt,false);assert.equal(game.commit(),false);
 assert.equal(game.add('sixteenth-pair'),true);assert.equal(game.state.beats,4);assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);
 assert.equal(game.state.availableInventory.eighth,0);assert.equal(game.state.availableInventory['sixteenth-pair'],0);
 const before=game.state;assert.equal(game.commit(),false);assert.deepEqual(game.state,before);
 assert.equal(game.add('quarter'),false);assert.equal(game.add('dotted-half'),false);
 for(const kind of ['whole','whole-rest','unknown','constructor','__proto__',null,{},2])assert.equal(game.add(kind),false);
 for(const index of [-1,3,.5,NaN,Infinity,'0'])assert.equal(game.remove(index),false);
 assert.equal(game.remove(1),true);assert.equal(game.state.availableInventory.eighth,1);assert.equal(game.state.beats,3.5);
 assert.equal(game.undo(),true);assert.equal(game.undo(),true);assert.equal(game.undo(),false);assert.deepEqual(game.state.inventory,parcel());
});

test('reordering is free, but a reversed sounding/rest phrase does not open the garden door',()=>{
 const game=prepare('garden'),available=game.state.availableInventory;
 assert.equal(game.move(0,1),true);assert.deepEqual(game.state.phrase,['half','half-rest']);assert.deepEqual(game.state.availableInventory,available);
 assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);assert.equal(game.commit(),false);
 assert.equal(game.move(1,-1),true);assert.equal(game.state.canCommit,true);assert.equal(game.commit(),true);
 assert.equal(game.state.routeId,'garden');
 const other=prepare('canal');for(const args of [[-1,1],[0,-1],[2,1],[0,0],[0,99],[.5,1],[0,.5]])assert.equal(other.move(...args),false);
 for(const id of ['unknown','constructor','__proto__',null,{},2])assert.equal(other.selectDoor(id),false);
});

test('each opened door consumes only its authored costs and never grants arrival notes',()=>{
 for(const [door,recipe] of Object.entries(PAGE_ONE_DOOR_COSTS)){
  const game=prepare(door);assert.equal(game.commit(),true);
  const state=game.state,after=parcel();for(const kind of recipe)after[kind]--;
  assert.equal(state.phase,'continued');assert.equal(state.routeId,door);assert.equal(state.selectedDoor,door);assert.deepEqual(state.phrase,[]);
  assert.equal(state.canCommit,false);assert.equal(state.canAttempt,false);assert.deepEqual(state.inventory,after);assert.deepEqual(state.availableInventory,after);
  assert.equal(totalUnits(state.inventory),16);assert.deepEqual(state.creditedStages,[]);assert.deepEqual(state.nextScene,PAGE_ONE_ROUTES[door]);
  assert.deepEqual(state.receipt,{doorId:door,recipe:[...recipe],inventoryBefore:parcel(),inventoryAfterConsumption:after,received:[],inventoryAfterEntry:after});
  const before=game.state;assert.equal(game.commit(),false);assert.equal(game.add('quarter'),false);assert.equal(game.remove(0),false);assert.equal(game.move(0,1),false);assert.equal(game.selectDoor('garden'),false);assert.deepEqual(game.state,before);
 }
});

test('undoing an exit retains source receipts and cannot farm notes through repeated reload or recommit',()=>{
 let game=prepare('canal');let committed;
 for(let pass=0;pass<5;pass++){
  assert.equal(game.commit(),true);committed??=game.state;assert.deepEqual(game.state,committed);
  game=createStoryGame({saved:JSON.parse(JSON.stringify(game.serialize()))});assert.deepEqual(game.state,committed);
  assert.equal(game.undo(),true);assert.equal(game.state.phase,'room');assert.equal(game.state.selectedDoor,'canal');assert.deepEqual(game.state.phrase,[]);
  assert.deepEqual(game.state.inventory,parcel());assert.deepEqual(game.state.claimedSources,['nell-parcel','depot-chest']);assert.equal(game.state.receipt,null);
  assert.equal(game.claim('nell-parcel'),false);assert.equal(game.claim('depot-chest'),false);assert.deepEqual(game.state.creditedStages,[]);
  fill(game,PAGE_ONE_DOOR_COSTS.canal);
 }
});

test('restart creates a new empty run while discoveries never create current-run notes',()=>{
 const game=prepare('canal');game.commit();game.restart();
 assert.deepEqual(game.state.inventory,empty());assert.deepEqual(game.state.claimedSources,[]);assert.equal(game.state.selectedDoor,null);assert.deepEqual(game.state.discoveredRoutes,['canal']);
 collect(game);game.selectDoor('garden');fill(game,PAGE_ONE_DOOR_COSTS.garden);game.commit();game.restart();
 assert.deepEqual(game.state.discoveredRoutes,['garden','canal']);assert.deepEqual(game.state.inventory,empty());assert.deepEqual(game.state.sourceReceipts,[]);
});

test('draft, partial pickups and committed exits reload by replaying actions rather than trusting balances',()=>{
 const game=createStoryGame();game.claim('depot-chest');game.selectDoor('garden');game.add('half');
 let saved=JSON.parse(JSON.stringify(game.serialize()));assert.deepEqual(createStoryGame({saved}).state,game.state);
 game.claim('nell-parcel');game.remove(0);fill(game,PAGE_ONE_DOOR_COSTS.garden);game.commit();
 saved=JSON.parse(JSON.stringify(game.serialize()));saved.inventory={quarter:999};saved.receipt={received:Array(100).fill('half')};saved.routeId='canal';saved.creditedStages=[2,2,2];
 const restored=createStoryGame({saved});assert.deepEqual(restored.state,game.state);assert.equal(restored.claim('depot-chest'),false);
 const copy=restored.serialize();copy.actions[0].sourceId='bad';copy.discoveredRoutes.push('canal');assert.deepEqual(restored.state,game.state);
});

test('malformed action histories, unsupported legacy saves and wrong-door recipes reset safely to an empty room',()=>{
 const claims=[{type:'claim',sourceId:'nell-parcel'},{type:'claim',sourceId:'depot-chest'}];
 const base={version:2,actions:claims,phrase:[],selectedDoor:'garden',discoveredRoutes:[]};
 const invalid=[null,{},'bad',{version:1,answer:PAGE_ONE_DOOR_COSTS.canal,phrase:[],discoveredRoutes:['canal']},
  {...base,actions:[claims[0],claims[0]]},{...base,actions:[{type:'claim',sourceId:'constructor'}]},
  {...base,actions:[{type:'door',doorId:'garden',recipe:PAGE_ONE_DOOR_COSTS.garden}]},
  {...base,actions:[...claims,{type:'door',doorId:'garden',recipe:['half','half-rest']}]},
  {...base,actions:[...claims,{type:'door',doorId:'canal',recipe:PAGE_ONE_DOOR_COSTS.canal}]},
  {...base,actions:[...claims,{type:'door',doorId:'garden',recipe:PAGE_ONE_DOOR_COSTS.garden}],phrase:['quarter']},
  {...base,actions:[...claims,{type:'door',doorId:'garden',recipe:PAGE_ONE_DOOR_COSTS.garden},claims[0]]},
  {...base,actions:[...claims,{type:'mystery'}]}, {...base,phrase:['quarter','quarter']},{...base,phrase:['dotted-half','half']},
  {...base,phrase:['constructor']},{...base,phrase:null},{...base,selectedDoor:'__proto__'},{...base,actions:null}];
 for(const saved of invalid){const game=createStoryGame({saved});assert.equal(game.state.phase,'room');assert.deepEqual(game.state.inventory,empty());assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.claimedSources,[]);assert.equal(game.state.selectedDoor,null);}
 const known=createStoryGame({saved:{...base,actions:[claims[0],claims[0]],discoveredRoutes:['garden','garden','unknown','constructor',{},'canal']}});
 assert.deepEqual(known.state.discoveredRoutes,['garden','canal']);assert.deepEqual(known.state.inventory,empty());
});

test('returned state and save objects cannot mutate source receipts, costs, inventory or next-room identity',()=>{
 const game=prepare('workshop');game.commit();const before=game.state,state=game.state;
 state.inventory.quarter=999;state.availableInventory.half=99;state.claimedSources.length=0;state.sourceReceipts[0].recipe.push('half');state.receipt.received.push('half');state.receipt.inventoryAfterEntry.half=999;state.nextScene.id='fake';state.discoveredRoutes.push('garden');
 assert.deepEqual(game.state,before);
 const save=game.serialize();save.actions[0].sourceId='fake';save.actions.at(-1).recipe.length=0;assert.deepEqual(game.state,before);
});

test('all 784 affordable four-beat orders are accepted only at their exact authored door',()=>{
 let recipes=0,successes=0;
 function visit(recipe,remaining,duration){
  if(duration===8){recipes++;
   for(const door of Object.keys(PAGE_ONE_DOOR_COSTS)){
    const game=collect(createStoryGame());game.selectDoor(door);fill(game,recipe);const before=game.state;
    const expected=JSON.stringify(recipe)===JSON.stringify(PAGE_ONE_DOOR_COSTS[door]);
    assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,expected);assert.equal(game.commit(),expected);
    if(expected){successes++;assert.equal(game.state.routeId,door);assert.equal(totalUnits(game.state.inventory),16);}
    else assert.deepEqual(game.state,before);
   }
   return;
  }
  for(const kind of remaining){const value=NOTE_KIND_BY_ID[kind].units;if(duration+value<=8)visit([...recipe,kind],remaining.filter(other=>other!==kind),duration+value);}
 }
 visit([],NOTE_KINDS.map(kind=>kind.id),0);assert.equal(recipes,784);assert.equal(successes,3);
});
