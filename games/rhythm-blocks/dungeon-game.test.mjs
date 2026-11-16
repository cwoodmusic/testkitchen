import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NOTE_KINDS,NOTE_KIND_BY_ID} from './engine.mjs';
import {createStoryGame} from './story.mjs';
import {createDungeonGame,CHAPTER_ROOMS,CHAPTER_SOURCES,CHAPTER_DOORS,CHAPTER_PREVIEWS,CHAPTER_TERMINALS,getChapterDoor,MAX_DUNGEON_ACTIONS,DUNGEON_INITIAL_INVENTORY} from './dungeon-game.mjs';

const branchIds=['garden','workshop','canal'];
const empty=()=>Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,0]));
const full=()=>Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,1]));
const total=stock=>Object.entries(stock).reduce((sum,[kind,count])=>sum+NOTE_KIND_BY_ID[kind].units*count,0);
const collect=game=>{assert.equal(game.claim('nell-parcel'),true);assert.equal(game.claim('depot-chest'),true);return game;};
const fill=(game,recipe)=>{for(const kind of recipe)assert.equal(game.add(kind),true,kind);return game;};
const pay=(game,id)=>{assert.equal(game.selectDoor(id),true);fill(game,getChapterDoor(id).recipe);assert.equal(game.commit(),true);return game;};
const enter=id=>pay(collect(createDungeonGame()),id);
const sourceFor=id=>CHAPTER_ROOMS[id+'-porch'].sources[0];
const copy=value=>structuredClone(value);
function assertConserved(game){
 const expected=empty();
 for(const action of game.state.actions){
  const recipe=action.type==='claim'?CHAPTER_SOURCES[action.sourceId].recipe:action.recipe;
  for(const kind of recipe)expected[kind]+=action.type==='claim'?1:-1;
 }
 assert.deepEqual(game.state.inventory,expected);
 for(const [kind,count]of Object.entries(expected))assert(Number.isSafeInteger(count)&&count>=0,kind);
 const available={...expected};for(const kind of game.state.phrase)available[kind]--;
 assert.deepEqual(game.state.availableInventory,available);
}

test('the shipped catalog is exactly four planned rooms, nine keys and six nonplayable boundaries',()=>{
 const plan=JSON.parse(readFileSync(new URL('../../design/music-puzzler/dungeon.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(CHAPTER_ROOMS),['depot','garden-porch','workshop-porch','canal-porch']);
 assert.equal(Object.keys(CHAPTER_SOURCES).length,5);assert.equal(Object.keys(CHAPTER_DOORS).length,9);
 assert.equal(Object.keys(CHAPTER_PREVIEWS).length,3);assert.equal(Object.keys(CHAPTER_TERMINALS).length,3);
 for(const room of Object.values(CHAPTER_ROOMS)){
  const designed=plan.rooms.find(item=>item.id===room.id);assert.equal(room.title,designed.title);
  assert.deepEqual(room.sources,designed.sources.map(source=>source.id));
  for(const source of designed.sources){const actual=CHAPTER_SOURCES[source.id];assert.equal(actual.roomId,room.id);assert.equal(actual.type,source.type);assert.deepEqual(actual.recipe,source.recipe);}
  for(const door of designed.doors){const actual=getChapterDoor(door.id);assert.equal(actual.from,room.id);assert.equal(actual.to,door.to);assert.deepEqual(actual.recipe,door.recipe);assert.equal(total(Object.fromEntries(NOTE_KINDS.map(kind=>[kind.id,actual.recipe.filter(id=>id===kind.id).length]))),8);}
 }
 for(const boundary of Object.values(CHAPTER_PREVIEWS)){assert.equal(boundary.title,plan.rooms.find(room=>room.id===boundary.id).title);assert.equal(boundary.kind,'preview');assert(!Object.hasOwn(CHAPTER_ROOMS,boundary.id));}
 for(const terminal of Object.values(CHAPTER_TERMINALS)){const designed=plan.terminals.find(item=>item.id===terminal.id);assert.equal(terminal.title,designed.title);assert.equal(terminal.kind,designed.kind);assert.equal(terminal.repair,designed.repair);}
 assert.equal(MAX_DUNGEON_ACTIONS,5);assert(Object.isFrozen(CHAPTER_ROOMS.depot.doors));assert(Object.isFrozen(CHAPTER_DOORS.garden.recipe));assert(Object.isFrozen(CHAPTER_SOURCES['pip-gift'].recipe));assert(Object.isFrozen(DUNGEON_INITIAL_INVENTORY));
});

test('the empty depot supplies one typed copy through explicit sources, in either order',()=>{
 for(const order of [['nell-parcel','depot-chest'],['depot-chest','nell-parcel']]){
  const game=createDungeonGame();assert.equal(game.state.roomId,'depot');assert.equal(game.state.phase,'room');assert.deepEqual(game.state.inventory,empty());assert.equal(game.add('half'),false);
  for(const source of order){assert.equal(game.claim(source),true);const before=game.state;assert.equal(game.claim(source),false);assert.deepEqual(game.state,before);assertConserved(game);}
  assert.deepEqual(game.state.inventory,full());assert.equal(total(game.state.inventory),24);assert.deepEqual(game.state.claimedSources,order);assert.deepEqual(game.state.currentRoomClaimedSources,order);
 }
});

test('all three depot keys enter actual rooms with no automatic arrival gift',()=>{
 for(const id of branchIds)for(const requested of [id,'depot-'+id]){
  const game=enter(requested),state=game.state,after=full();for(const kind of getChapterDoor(id).recipe)after[kind]--;
  assert.equal(state.phase,'room');assert.equal(state.roomId,id+'-porch');assert.equal(state.routeId,id);assert.equal(state.selectedDoor,null);assert.equal(state.nextScene,null);assert.equal(state.previewKind,null);
  assert.deepEqual(state.inventory,after);assert.equal(total(state.inventory),16);assert.deepEqual(state.claimedSources,['nell-parcel','depot-chest']);assert.deepEqual(state.currentRoomClaimedSources,[]);
  assert.equal(state.lastTransition.id,'depot-'+id);assert.deepEqual(state.receipt.received,[]);assert.deepEqual(state.receipt.inventoryAfterConsumption,after);assert.deepEqual(state.receipt.inventoryAfterEntry,after);assertConserved(game);
 }
});

test('only the current room may grant a source or offer a door, and unknown IDs are inert',()=>{
 const game=createDungeonGame();
 for(const id of ['iris-gift','pip-gift','canal-chest','unknown','constructor','__proto__',null,{},2])assert.equal(game.claim(id),false);
 for(const id of ['garden-porch-forward','canal-porch-dead','unknown','constructor','__proto__',null,{},2])assert.equal(game.selectDoor(id),false);
 collect(game);pay(game,'garden');const before=game.state;
 for(const id of ['nell-parcel','depot-chest','pip-gift','canal-chest'])assert.equal(game.claim(id),false);
 for(const id of ['canal','depot-garden','workshop-porch-forward'])assert.equal(game.selectDoor(id),false);
 assert.deepEqual(game.state,before);
});

test('each porch requires its explicit gift for its exact forward key, then stops at an honest preview',()=>{
 for(const id of branchIds){
  const game=enter(id),doorId=id+'-porch-forward',sourceId=sourceFor(id);
  game.selectDoor(doorId);for(const kind of getChapterDoor(doorId).recipe)game.add(kind);assert.equal(game.commit(),false);assert.equal(game.state.phase,'room');
  while(game.state.phrase.length)game.undo();assert.equal(game.claim(sourceId),true);assert.equal(total(game.state.inventory),24);assert.deepEqual(game.state.inventory,full());
  const claimed=game.state;assert.equal(game.claim(sourceId),false);assert.deepEqual(game.state,claimed);
  pay(game,doorId);assert.equal(game.state.phase,'continued');assert.equal(game.state.roomId,id+'-porch');assert.equal(game.state.nextScene.id,id+'-fork');assert.equal(game.state.previewKind,'preview');assert.equal(total(game.state.inventory),16);
  assert.equal(game.state.actions.at(-1).doorId,doorId);assert.deepEqual(game.state.receipt.received,[]);assert.deepEqual(game.state.creditedStages,[]);assertConserved(game);
  const before=game.state;assert.equal(game.claim(sourceId),false);assert.equal(game.claim('nell-parcel'),false);assert.equal(game.add('quarter'),false);assert.equal(game.selectDoor(doorId),false);assert.equal(game.remove(0),false);assert.equal(game.move(0,1),false);assert.equal(game.commit(),false);assert.deepEqual(game.state,before);
 }
});

test('each porch dead end is real, conserves its exact cost and grants no completion notes',()=>{
 for(const id of branchIds)for(const claim of [false,true]){
  const game=enter(id);if(claim)game.claim(sourceFor(id));const stock=game.state.inventory;
  pay(game,id+'-porch-dead');const state=game.state,after={...stock};for(const kind of getChapterDoor(id+'-porch-dead').recipe)after[kind]--;
  assert.equal(state.previewKind,'dead-end');assert.equal(state.nextScene.kind,'dead-end');assert.match(state.nextScene.repair,/Revisit/);assert.deepEqual(state.inventory,after);assert.equal(total(state.inventory),claim?16:8);assert.deepEqual(state.creditedStages,[]);assertConserved(game);
 }
});

test('equal totals and reversed order never spend; fractional draft editing conserves typed stock',()=>{
 const game=collect(createDungeonGame());game.selectDoor('garden');fill(game,['half','half-rest']);
 assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);const before=game.state;assert.equal(game.commit(),false);assert.deepEqual(game.state,before);
 assert.equal(game.move(1,-1),true);assert.equal(game.state.canCommit,true);assert.equal(game.commit(),true);
 game.claim('iris-gift');game.selectDoor('garden-porch-forward');fill(game,['dotted-half','eighth','sixteenth-pair']);assert.equal(game.state.beats,4);assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);
 assert.equal(game.add('quarter'),false);assert.equal(game.remove(1),true);assert.equal(game.state.beats,3.5);assert.equal(game.state.availableInventory.eighth,1);assert.equal(game.undo(),true);assert.equal(game.state.beats,3);assertConserved(game);
 for(const kind of ['whole','whole-rest','unknown','constructor','__proto__',null,{},2])assert.equal(game.add(kind),false);
 for(const index of [-1,3,.5,NaN,Infinity,'0'])assert.equal(game.remove(index),false);
 for(const args of [[-1,1],[0,-1],[2,1],[0,0],[0,99],[.5,1],[0,.5]])assert.equal(game.move(...args),false);
});

test('undoing a boundary returns its paid notes and retains the earlier once-only porch gift',()=>{
 for(const id of branchIds)for(const suffix of ['forward','dead']){
  const game=enter(id);game.claim(sourceFor(id));const before=game.state.inventory;pay(game,id+'-porch-'+suffix);
  assert.equal(game.undo(),true);assert.equal(game.state.phase,'room');assert.equal(game.state.roomId,id+'-porch');assert.deepEqual(game.state.inventory,before);assert.equal(game.state.selectedDoor,id+'-porch-'+suffix);assert(game.state.claimedSources.includes(sourceFor(id)));assert.equal(game.claim(sourceFor(id)),false);assert.equal(game.undo(),false);
  for(let cycle=0;cycle<3;cycle++){pay(game,id+'-porch-'+suffix);assert.equal(game.revisit(),true);assert.deepEqual(game.state.inventory,before);assertConserved(game);}
 }
});

test('rewinding an entered room atomically refunds entry and removes its gift and draft',()=>{
 for(const id of branchIds){
  const game=enter(id);game.claim(sourceFor(id));fill(game,['eighth','sixteenth-pair']);
  assert.equal(game.rewindRoom(),true);assert.equal(game.state.roomId,'depot');assert.equal(game.state.phase,'room');assert.deepEqual(game.state.inventory,full());assert.deepEqual(game.state.phrase,[]);assert.deepEqual(game.state.claimedSources,['nell-parcel','depot-chest']);assert.equal(game.state.selectedDoor,id);assert.equal(game.state.receipt,null);assert.deepEqual(game.state.discoveredRoutes,[id]);assertConserved(game);
  const next=branchIds.find(other=>other!==id);pay(game,next);assert.equal(game.claim(sourceFor(id)),false);assert.equal(total(game.state.inventory),16);assert.equal(game.claim(sourceFor(next)),true);assert.deepEqual(game.state.inventory,full());assertConserved(game);
 }
});

test('repeated cross-branch rewinds cannot farm notes; a restart preserves only route discovery',()=>{
 const game=collect(createDungeonGame());for(let cycle=0;cycle<4;cycle++)for(const id of branchIds){pay(game,id);game.claim(sourceFor(id));assert.deepEqual(game.state.inventory,full());assert.equal(game.revisit(),true);assert.deepEqual(game.state.inventory,full());}
 assert.deepEqual(game.state.discoveredRoutes,branchIds);assert.equal(game.revisit(),false);assert.equal(game.restart(),true);assert.deepEqual(game.state.inventory,empty());assert.deepEqual(game.state.discoveredRoutes,branchIds);assert.deepEqual(game.state.claimedSources,[]);assert.equal(game.state.canRevisit,false);
});

test('valid v2 depot drafts and paid openings migrate without losing or granting notes',()=>{
 const legacy=createStoryGame();legacy.claim('nell-parcel');legacy.selectDoor('canal');legacy.add('eighth');
 const draft=createDungeonGame({saved:{...legacy.serialize(),roomPosition:{x:999,y:999},inventory:{half:100}}});assert.equal(draft.state.roomId,'depot');assert.deepEqual(draft.state.inventory,legacy.state.inventory);assert.deepEqual(draft.state.phrase,['eighth']);assert.equal(draft.state.selectedDoor,'canal');assert.equal(draft.serialize().version,3);
 for(const id of branchIds){
  const old=collect(createStoryGame());old.selectDoor(id);fill(old,CHAPTER_DOORS[id].recipe);assert.equal(old.commit(),true);
  const migrated=createDungeonGame({saved:{...old.serialize(),roomPosition:{x:25,y:2}}});assert.equal(migrated.state.phase,'room');assert.equal(migrated.state.roomId,id+'-porch');assert.equal(migrated.state.selectedDoor,null);assert.deepEqual(migrated.state.inventory,old.state.inventory);assert.equal(migrated.state.routeId,id);assert.equal(migrated.claim(sourceFor(id)),true);pay(migrated,id+'-porch-forward');assert.equal(migrated.state.previewKind,'preview');assertConserved(migrated);
 }
});

test('invalid v2 records reset the run and cannot disguise wrong committed selections',()=>{
 const old=collect(createStoryGame());old.selectDoor('garden');fill(old,CHAPTER_DOORS.garden.recipe);old.commit();
 for(const corrupt of [saved=>{saved.selectedDoor='canal';},saved=>{saved.phrase=['quarter'];},saved=>{saved.actions[2].recipe.reverse();},saved=>{saved.actions.unshift({type:'claim',sourceId:'iris-gift'});}]){
  const saved=old.serialize();corrupt(saved);saved.discoveredRoutes=['garden','__proto__','canal',{}];const game=createDungeonGame({saved});assert.equal(game.state.roomId,'depot');assert.deepEqual(game.state.inventory,empty());assert.deepEqual(game.state.actions,[]);assert.deepEqual(game.state.discoveredRoutes,['garden','canal']);
 }
 for(const version of [1,0,4,null])assert.deepEqual(createDungeonGame({saved:{version,inventory:full()}}).state.inventory,empty());
});

test('v3 replay reproduces every shipped branch stage, draft and continued receipt exactly',()=>{
 for(const id of branchIds)for(const suffix of ['forward','dead'])for(const order of [['nell-parcel','depot-chest'],['depot-chest','nell-parcel']]){
  let game=createDungeonGame();const roundtrip=()=>{const saved=JSON.parse(JSON.stringify(game.serialize()));const restored=createDungeonGame({saved});assert.deepEqual(restored.state,game.state);game=restored;assertConserved(game);};
  roundtrip();for(const source of order){game.claim(source);roundtrip();}game.selectDoor(id);fill(game,CHAPTER_DOORS[id].recipe);roundtrip();game.commit();roundtrip();game.claim(sourceFor(id));roundtrip();game.selectDoor(id+'-porch-'+suffix);game.add('eighth');roundtrip();game.undo();pay(game,id+'-porch-'+suffix);roundtrip();game.undo();roundtrip();game.rewindRoom();roundtrip();
 }
});

test('v3 malformed histories reset atomically rather than keeping a profitable prefix',()=>{
 const game=enter('garden');game.claim('iris-gift');pay(game,'garden-porch-forward');const valid=game.serialize();
 const mutations=[
  save=>{save.actions[3].sourceId='pip-gift';},
  save=>{save.actions[3]={type:'claim',sourceId:'nell-parcel'};},
  save=>{save.actions[2].doorId='depot-canal';},
  save=>{save.actions[4].recipe=['half','half-rest'];},
  save=>{save.actions[4].doorId='canal-porch-forward';},
  save=>{save.actions[0].inventory=full();},
  save=>{save.actions[2].from='garden-porch';},
  save=>{save.actions.push({type:'claim',sourceId:'canal-chest'});},
  save=>{save.actions.push(...Array(100).fill({type:'claim',sourceId:'nell-parcel'}));},
  save=>{save.actions[0]={type:'grant',sourceId:'nell-parcel'};},
  save=>{save.phrase=['quarter'];},
  save=>{save.selectedDoor='garden';},
  save=>{save.selectedDoor=null;},
  save=>{delete save.selectedDoor;},
  save=>{save.actions=null;}
 ];
 for(const mutate of mutations){const saved=copy(valid);mutate(saved);const restored=createDungeonGame({saved});assert.deepEqual(restored.state.inventory,empty());assert.deepEqual(restored.state.actions,[]);assert.equal(restored.state.phase,'room');assert.equal(restored.state.roomId,'depot');}
 // Declared balances and locations are never authority: only the valid log is.
 const forged={...copy(valid),roomId:'canal-fork',phase:'room',inventory:{quarter:10000},receipt:{received:['half']},previewKind:'ending'};assert.deepEqual(createDungeonGame({saved:forged}).state,game.state);
});

test('v3 rejects invalid local draft selections, oversize phrases and unavailable symbols',()=>{
 const base=enter('workshop').serialize();
 for(const mutate of [save=>{save.selectedDoor='garden';},save=>{save.phrase=['half'];},save=>{save.phrase=Array(10).fill('eighth');},save=>{save.phrase=['constructor'];},save=>{save.phrase=['dotted-half','quarter','eighth'];}]){
  const saved=copy(base);mutate(saved);assert.deepEqual(createDungeonGame({saved}).state.inventory,empty());
 }
});

test('state, receipts and catalogs are frozen snapshots while serialized drafts are detached copies',()=>{
 const game=enter('canal');game.claim('canal-chest');const state=game.state;
 assert(Object.isFrozen(game));assert(Object.isFrozen(state));assert(Object.isFrozen(state.inventory));assert(Object.isFrozen(state.receipt.recipe));assert(Object.isFrozen(state.sourceReceipts[0].inventoryAfter));
 assert.throws(()=>{state.inventory.half=99;},TypeError);assert.throws(()=>{state.receipt.recipe.push('quarter');},TypeError);
 const saved=game.serialize();saved.actions[0].sourceId='canal-chest';saved.phrase.push('half');saved.discoveredRoutes.push('garden');assert.deepEqual(game.state,state);
});

const definition=()=>({
 settings:{startRoomId:'depot',initialInventory:empty()},noteKinds:copy(NOTE_KINDS),
 rooms:copy(CHAPTER_ROOMS),doors:copy(CHAPTER_DOORS),sources:copy(CHAPTER_SOURCES),previews:copy(CHAPTER_PREVIEWS),terminals:copy(CHAPTER_TERMINALS)
});
const payDefined=(game,project,id)=>{assert.equal(game.selectDoor(id),true);fill(game,project.doors[id].recipe);assert.equal(game.commit(),true);return game;};

test('an authored key uses its own ordered duration rather than the shipped four-beat target',()=>{
 const project=definition();project.settings.initialInventory={quarter:3,half:1};project.doors.garden.recipe=['quarter','half'];
 const game=createDungeonGame({definition:project});assert.equal(game.selectDoor('depot-garden'),true);
 assert.equal(game.state.targetUnits,6);assert.equal(game.state.targetBeats,3);
 fill(game,['half','quarter']);assert.equal(game.state.canAttempt,true);assert.equal(game.state.canCommit,false);
 const wrong=game.state;assert.equal(game.commit(),false);assert.deepEqual(game.state,wrong);
 game.move(1,-1);assert.equal(game.commit(),true);assert.equal(game.state.roomId,'garden-porch');assert.equal(game.state.inventory.quarter,2);assert.equal(game.state.inventory.half,0);
 assert.deepEqual(game.state.receipt.recipe,['quarter','half']);assert.deepEqual(game.state.receipt.received,[]);
});

test('edited note duration and repeated source tiles drive the same lock and inventory calculations',()=>{
 const project=definition();project.noteKinds.find(kind=>kind.id==='quarter').units=3;
 project.sources['nell-parcel'].recipe=['quarter','quarter','eighth'];project.doors.garden.recipe=['quarter','eighth'];
 const game=createDungeonGame({definition:project});assert.equal(game.claim('nell-parcel'),true);
 assert.equal(game.state.inventory.quarter,2);assert.equal(game.state.inventory.eighth,1);
 assert.equal(game.state.noteKinds.find(kind=>kind.id==='quarter').beats,1.5);
 game.selectDoor('garden');assert.equal(game.state.targetBeats,2);game.add('quarter');assert.equal(game.state.beats,1.5);assert.equal(game.state.canAttempt,false);
 game.add('eighth');assert.equal(game.state.beats,2);assert.equal(game.state.canCommit,true);assert.equal(game.commit(),true);
 assert.equal(game.state.inventory.quarter,1);assert.equal(game.state.inventory.eighth,0);
});

test('authored answers can exceed nine tiles and four beats while additions respect the selected target',()=>{
 const project=definition();project.settings.initialInventory={quarter:20};project.custom=false;project.doors.garden.recipe=Array(12).fill('quarter');
 const game=createDungeonGame({definition:project});game.selectDoor('garden');assert.equal(game.state.targetBeats,12);
 fill(game,project.doors.garden.recipe);assert.equal(game.state.phrase.length,12);assert.equal(game.add('quarter'),false);assert.equal(game.state.canCommit,true);
 const saved=game.serialize();assert.deepEqual(createDungeonGame({definition:project,saved}).state,game.state);
 assert.equal(game.commit(),true);assert.equal(game.state.inventory.quarter,8);
});

test('an authored start room and initial supplies do not manufacture entry receipts or collect sources',()=>{
 const project=definition();project.settings.startRoomId='garden-porch';project.settings.initialInventory={half:2};
 const game=createDungeonGame({definition:project});assert.equal(game.state.roomId,'garden-porch');assert.equal(game.state.inventory.half,2);
 assert.deepEqual(game.state.claimedSources,[]);assert.deepEqual(game.state.actions,[]);assert.equal(game.state.receipt,null);assert.equal(game.state.canRevisit,false);
 assert.equal(game.claim('nell-parcel'),false);assert.equal(game.claim('iris-gift'),true);assert.equal(game.state.inventory.half,3);
 assert.equal(game.restart(),true);assert.equal(game.state.roomId,'garden-porch');assert.equal(game.state.inventory.half,2);assert.deepEqual(game.state.claimedSources,[]);
});

test('authored cycles can return to the start and rewind the actual last entry without carrying its later gifts',()=>{
 const project=definition();project.settings.initialInventory={quarter:1,eighth:1};project.doors.garden.recipe=['quarter'];project.doors['garden-porch-forward'].recipe=['eighth'];project.doors['garden-porch-forward'].to='depot';
 const game=createDungeonGame({definition:project});payDefined(game,project,'garden');game.claim('iris-gift');const porchStock=game.state.inventory;
 payDefined(game,project,'garden-porch-forward');assert.equal(game.state.roomId,'depot');assert.equal(game.state.canRevisit,true);assert.equal(game.claim('nell-parcel'),true);
 assert.equal(game.revisit(),true);assert.equal(game.state.roomId,'garden-porch');assert.deepEqual(game.state.inventory,porchStock);assert.deepEqual(game.state.claimedSources,['iris-gift']);assert.equal(game.state.selectedDoor,'garden-porch-forward');
 assert.equal(game.revisit(),true);assert.equal(game.state.roomId,'depot');assert.equal(game.state.inventory.quarter,1);assert.equal(game.state.inventory.eighth,1);assert.deepEqual(game.state.claimedSources,[]);assert.equal(game.state.canRevisit,false);
});

test('long authored walks replay past the shipped five-action limit without relying on claimed balances',()=>{
 const project=definition();project.settings.initialInventory={quarter:50,eighth:50};project.doors.garden.recipe=['quarter'];project.doors['garden-porch-forward'].recipe=['eighth'];project.doors['garden-porch-forward'].to='depot';
 const game=createDungeonGame({definition:project});for(let cycle=0;cycle<20;cycle++){payDefined(game,project,'garden');payDefined(game,project,'garden-porch-forward');}
 assert.equal(game.state.actions.length,40);assert.equal(game.state.inventory.quarter,30);assert.equal(game.state.inventory.eighth,30);
 const saved={...game.serialize(),inventory:{quarter:999},roomId:'canal-porch'};assert.deepEqual(createDungeonGame({definition:project,saved}).state,game.state);
 assert.deepEqual(createDungeonGame({saved}).state.inventory,empty(),'The stock game does not accept an authored long history.');
});

test('developer controls are explicit opt-in actions and cannot affect normal games',()=>{
 for(const project of [null,definition()]){
  const game=createDungeonGame({definition:project}),before=game.state;
  assert.equal(game.developerSetInventory({quarter:99}),false);assert.equal(game.developerTeleport('canal-porch'),false);assert.equal(game.developerResetSources(),false);assert.deepEqual(game.state,before);
 }
 const project=definition(),game=createDungeonGame({definition:project,developer:true});
 assert.equal(game.developerSetInventory({quarter:7,half:3}),true);assert.equal(game.state.inventory.quarter,7);assert.equal(game.state.inventory.half,3);assert.equal(game.state.inventory.eighth,0);
 game.add('quarter');assert.equal(game.state.phrase.length,1);assert.equal(game.developerSetInventory({eighth:2}),true);assert.deepEqual(game.state.phrase,[]);assert.equal(game.state.inventory.quarter,0);assert.equal(game.state.inventory.eighth,2);
 assert.equal(game.developerTeleport('canal-porch'),true);assert.equal(game.state.roomId,'canal-porch');assert.equal(game.state.inventory.eighth,2);assert.equal(game.state.selectedDoor,null);assert.equal(game.state.receipt,null);assert.deepEqual(game.state.claimedSources,[]);
 const saved=game.serialize();assert.deepEqual(createDungeonGame({definition:project,developer:true,saved}).state,game.state);
 assert.deepEqual(createDungeonGame({definition:project,saved}).state.inventory,empty());assert.deepEqual(createDungeonGame({saved}).state.inventory,empty());
});

test('developer source reset clears only receipts and flags so test inventory remains under explicit control',()=>{
 const project=definition(),game=createDungeonGame({definition:project,developer:true});assert.equal(game.claim('nell-parcel'),true);const first=game.state.inventory;
 assert.equal(game.developerResetSources('nell-parcel'),true);assert.deepEqual(game.state.inventory,first);assert.deepEqual(game.state.claimedSources,[]);assert.deepEqual(game.state.sourceReceipts,[]);
 assert.equal(game.claim('nell-parcel'),true);assert.equal(game.state.inventory.quarter,2);assert.equal(game.claim('nell-parcel'),false);assert.equal(game.claim('depot-chest'),true);
 assert.equal(game.developerResetSources(),true);assert.deepEqual(game.state.claimedSources,[]);assert.deepEqual(game.state.sourceReceipts,[]);assert.equal(game.state.inventory.quarter,2);assert.equal(game.state.inventory.half,1);
 assert.equal(game.developerResetSources(),false);assert.equal(game.developerResetSources('unknown'),false);
 const restored=createDungeonGame({definition:project,developer:true,saved:game.serialize()});assert.deepEqual(restored.state,game.state);
});

test('developer teleports can leave boundaries and rewind without awarding traversal or arrival supplies',()=>{
 const project=definition(),game=createDungeonGame({definition:project,developer:true});game.developerSetInventory(full());payDefined(game,project,'garden');game.claim('iris-gift');payDefined(game,project,'garden-porch-forward');
 const before=game.state.inventory;assert.equal(game.state.phase,'continued');assert.equal(game.developerTeleport('workshop-porch'),true);assert.equal(game.state.phase,'room');assert.equal(game.state.roomId,'workshop-porch');assert.deepEqual(game.state.inventory,before);assert.equal(game.state.lastTransition,null);assert.equal(game.state.nextScene,null);assert.equal(game.state.receipt,null);
 assert.deepEqual(game.state.traversedDoors,['depot-garden','garden-porch-forward']);assert.equal(game.revisit(),true);assert.equal(game.state.phase,'continued');assert.equal(game.state.roomId,'garden-porch');assert.deepEqual(game.state.inventory,before);assert.equal(game.state.selectedDoor,'garden-porch-forward');
 assert.deepEqual(createDungeonGame({definition:project,developer:true,saved:game.serialize()}).state,game.state);
 assert.equal(game.undo(),true);assert.equal(game.state.phase,'room');
});

test('undo of a boundary discards later developer edits while retaining the prior paid-room source',()=>{
 const project=definition(),game=createDungeonGame({definition:project,developer:true});collect(game);payDefined(game,project,'garden');game.claim('iris-gift');const stock=game.state.inventory;payDefined(game,project,'garden-porch-forward');
 game.developerSetInventory({quarter:99});game.developerResetSources('iris-gift');assert.equal(game.state.phase,'continued');assert.equal(game.state.inventory.quarter,99);assert(!game.state.claimedSources.includes('iris-gift'));
 assert.deepEqual(createDungeonGame({definition:project,developer:true,saved:game.serialize()}).state,game.state);
 assert.equal(game.undo(),true);assert.equal(game.state.phase,'room');assert.deepEqual(game.state.inventory,stock);assert(game.state.claimedSources.includes('iris-gift'));assert.equal(game.claim('iris-gift'),false);
});

test('malformed developer changes are inert and malformed histories are rejected atomically',()=>{
 const project=definition(),game=createDungeonGame({definition:project,developer:true});game.claim('nell-parcel');const before=game.state;
 for(const inventory of [null,[],{quarter:-1},{quarter:.5},{quarter:1000},{quarter:NaN},{quarter:Infinity},{whole:2},JSON.parse('{"constructor":3}')])assert.equal(game.developerSetInventory(inventory),false);
 for(const room of [null,{},'unknown','__proto__','constructor'])assert.equal(game.developerTeleport(room),false);
 assert.deepEqual(game.state,before);
 for(const action of [{type:'developer-teleport',roomId:'missing'},{type:'developer-teleport',roomId:['depot']},{type:'developer-teleport',roomId:{toString:'depot'}},{type:'developer-inventory',inventory:{quarter:-1}},{type:'developer-reset-sources',sourceIds:['nell-parcel','nell-parcel']},{type:'developer-reset-sources',sourceIds:['missing']},{type:'developer-teleport',roomId:'canal-porch',notes:999}]){
  const saved={...game.serialize(),actions:[...game.serialize().actions,action]};const restored=createDungeonGame({definition:project,developer:true,saved});assert.deepEqual(restored.state.actions,[]);assert.deepEqual(restored.state.inventory,empty());
 }
});

test('definition inputs and exposed note metadata cannot mutate a running project',()=>{
 const project=definition();project.settings.initialInventory={quarter:2};project.doors.garden.recipe=['quarter'];const game=createDungeonGame({definition:project});
 project.doors.garden.recipe=['half'];project.settings.initialInventory.quarter=999;project.noteKinds[0].units=64;
 assert.equal(game.state.inventory.quarter,2);assert.equal(game.state.noteKinds[0].units,2);assert(Object.isFrozen(game.state.noteKinds[0]));
 payDefined(game,{doors:{garden:{recipe:['quarter']}}},'garden');assert.equal(game.state.inventory.quarter,1);
 for(const bad of [null,{},[]])if(bad!==null)assert.throws(()=>createDungeonGame({definition:bad}),TypeError);
 const invalid=definition();invalid.noteKinds[0].units=0;assert.throws(()=>createDungeonGame({definition:invalid}),TypeError);
 const ambiguous=definition();ambiguous.doors.workshop.canonicalId='garden';assert.throws(()=>createDungeonGame({definition:ambiguous}),/Ambiguous/);
 const duplicate=definition();duplicate.terminals['garden-fork']={id:'garden-fork',title:'Conflicting destination',kind:'dead-end'};assert.throws(()=>createDungeonGame({definition:duplicate}),/duplicated boundary/);
});

test('custom transaction histories stop at 512 without partially applying the next edit',()=>{
 const project=definition(),game=createDungeonGame({definition:project,developer:true});
 for(let index=0;index<512;index++)assert.equal(game.developerTeleport(index%2?'depot':'garden-porch'),true);
 assert.equal(game.state.actions.length,512);const before=game.state;
 assert.deepEqual(createDungeonGame({definition:project,developer:true,saved:game.serialize()}).state,before);
 assert.equal(game.developerTeleport('canal-porch'),false);assert.equal(game.developerSetInventory({quarter:10}),false);assert.deepEqual(game.state,before);
 assert.equal(game.restart(),true);assert.deepEqual(game.state.actions,[]);assert.equal(game.developerTeleport('canal-porch'),true);
});
