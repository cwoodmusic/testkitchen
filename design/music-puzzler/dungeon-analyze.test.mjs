import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeDungeon,analyzeDungeonProgress,compileDungeon,replayDungeon} from './dungeon-analyze.mjs';
import {CAMPAIGN_PLAN} from '../../games/rhythm-blocks/campaign-data.mjs';

const copy=value=>structuredClone(value);
const gift=(id,recipe,type='npc')=>({id,type,...(type==='npc'?{character:'Nell'}:{}),recipe});
const door=(id,to,recipe=['half','half'],extra={})=>({id,to,recipe,...extra});
const ending=(id='done',kind='ending')=>({id,title:id,kind});
const fixture=()=>({version:1,entry:'depot',initialInventory:{},rooms:[{id:'depot',title:'The Depot',sources:[gift('parcel',['half','half'])],doors:[door('leave','done')]}],terminals:[ending()]});
const claim=sourceId=>({type:'claim',sourceId}),open=doorId=>({type:'door',doorId});
const inventoryEmpty=stock=>Object.values(stock).every(count=>count===0);

test('one-shot sources are explicit actions, doors spend exact typed notes, and success has an empty inventory',()=>{
 const data=fixture(),report=analyzeDungeon(data);
 assert.equal(report.passed,true);assert.deepEqual(report.graph,{rooms:1,sources:1,doors:1,terminals:1,reachableStates:3,liveStates:2,terminalStates:1,transitions:2,orderedTerminalHistories:'1',orderedRunFailureHistories:'0',orderedRunHistories:'1'});
 assert.deepEqual(report.coverage,{unreachableRooms:[],unreachableSources:[],unreachableDoors:[],unreachableTerminals:[]});
 assert.equal(report.balances.violationCount,0);assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,0);
 assert.deepEqual(report.terminals[0].witness.actions,[claim('parcel'),open('leave')]);
 const before=replayDungeon(data,[]);assert(inventoryEmpty(before.inventory));assert.deepEqual(before.claimedSources,[]);
 const claimed=replayDungeon(data,[claim('parcel')]);assert.equal(claimed.inventory.half,2);assert.equal(claimed.terminal,null);
 const after=replayDungeon(data,[claim('parcel'),open('leave')]);assert.equal(after.terminal,'done');assert(inventoryEmpty(after.inventory));
 for(const step of after.trace){assert.equal(step.conservation.valid,true);for(const kind of Object.keys(step.inventoryAfter))assert.equal(step.conservation.initial[kind]+step.conservation.claimed[kind]-step.conservation.spent[kind],step.inventoryAfter[kind]);}
 assert.equal(report.invariants.noAutomaticEntryGrants,true);assert.equal(report.invariants.typedConservation,true);
});

test('all pickup orders are enumerated and merged states retain exact complete-history counts',()=>{
 const data=fixture();data.rooms[0].sources=[gift('first-half',['half']),gift('second-half',['half'],'chest')];
 const report=analyzeDungeon(data);assert.equal(report.passed,true);assert.equal(report.graph.reachableStates,5);assert.equal(report.graph.transitions,5);
 assert.equal(report.graph.orderedTerminalHistories,'2');assert.equal(report.terminals[0].distinctFinalStates,1);assert.equal(report.terminals[0].orderedHistories,'2');
 assert(report.sources.every(source=>source.reachable&&source.orderedHistories==='2'));
 for(const actions of [[claim('first-half'),claim('second-half'),open('leave')],[claim('second-half'),claim('first-half'),open('leave')]]){
  const replay=replayDungeon(data,actions);assert.equal(replay.terminal,'done');assert(inventoryEmpty(replay.inventory));assert.equal(replay.conservation.claimed.half,2);assert.equal(replay.conservation.spent.half,2);
 }
});

test('an optional bonus pickup that can reach an ending with leftovers is a concrete violation',()=>{
 const data=fixture();data.rooms[0].sources.push(gift('bonus',['quarter-rest'],'chest'));
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.graph.orderedTerminalHistories,'3');assert.equal(report.balances.violationCount,1);
 assert.equal(report.terminals[0].distinctFinalStates,2);assert.deepEqual(report.terminals[0].remainingTiles,{min:0,max:1});assert.equal(report.terminals[0].remainingByKind['quarter-rest'].max,1);
 const bad=report.balances.violations[0];assert.equal(bad.inventory['quarter-rest'],1);assert.equal(bad.inventory.quarter,0);assert.equal(bad.witness.conservation.valid,true);
 assert.equal(replayDungeon(data,bad.witness.actions).inventory['quarter-rest'],1);
 assert.equal(report.softlocks.count,0);assert(report.forcedDeadEndStates.count>0,'Holding the bonus leaves no zero-balance ending');
 assert(!report.forcedDeadEndStates.states.some(state=>state.stateId===0),'The initial state can decline the bonus and finish cleanly');
});

test('sources cannot be claimed twice, remotely or after a terminal, and doors cannot farm entry rewards',()=>{
 const data=fixture();assert.throws(()=>replayDungeon(data,[claim('parcel'),claim('parcel')]),/already claimed/);
 assert.throws(()=>replayDungeon(data,[claim('missing')]),/not in current room/);
 assert.throws(()=>replayDungeon(data,[open('leave')]),/unavailable notes/);
 assert.throws(()=>replayDungeon(data,[claim('parcel'),open('leave'),claim('parcel')]),/after terminal/);
 assert.throws(()=>replayDungeon(data,[claim('parcel'),open('leave'),open('leave')]),/after terminal/);
 assert.throws(()=>replayDungeon(data,[{type:'grant',sourceId:'parcel'}]),/Unknown dungeon action/);
 assert.throws(()=>replayDungeon(data,[{...claim('parcel'),roomId:'elsewhere'}]),/room mismatch/);
 const alternate=fixture();alternate.rooms.push({id:'other',title:'Other',sources:[gift('remote',['half'])],doors:[]});
 assert.throws(()=>replayDungeon(alternate,[claim('remote')]),/not in current room/);
});

test('equal beat totals never substitute for a door’s authored note identities',()=>{
 const data=fixture();data.initialInventory={quarter:4};data.rooms[0].sources=[];
 assert.throws(()=>replayDungeon(data,[open('leave')]),/unavailable notes/);
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.softlocks.count,1);assert.equal(report.forcedDeadEndStates.count,1);assert.deepEqual(report.coverage.unreachableDoors,['leave']);
 data.rooms[0].doors[0].recipe=Array(4).fill('quarter');assert.equal(analyzeDungeon(data).passed,true);
});

function optionalDead(){return{version:1,entry:'fork',initialInventory:{half:4},rooms:[
 {id:'fork',title:'Fork',sources:[],doors:[door('safe','home'),door('mistake','dead')]},
 {id:'home',title:'Home',sources:[],doors:[door('finish','done')]}
 ],terminals:[ending(),ending('dead','dead-end')]};}

test('declared dead ends may retain notes and optional dead-end choices do not force otherwise-live states',()=>{
 const data=optionalDead(),report=analyzeDungeon(data);assert.equal(report.passed,true);assert.equal(report.graph.orderedTerminalHistories,'2');
 const dead=report.terminals.find(terminal=>terminal.id==='dead');assert.equal(dead.remainingHalfBeatUnits.min,8);assert.equal(dead.remainingTiles.max,2);
 assert.equal(report.balances.violationCount,0);assert.equal(report.forcedDeadEndStates.count,0);assert.equal(report.softlocks.count,0);
 assert.equal(replayDungeon(data,dead.witness.actions).inventory.half,2);
});

test('a nonterminal room with only dead-end continuations is rejected even when it has an affordable door',()=>{
 const data=optionalDead();data.rooms[0].doors[1].to='trap';data.rooms.push({id:'trap',title:'Trap',sources:[],doors:[door('doom','dead')]});
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,1);
 assert.equal(report.forcedDeadEndStates.states[0].nodeId,'trap');assert.equal(report.forcedDeadEndStates.states[0].witness.nodeId,'trap');
});

function secret(){return{version:1,entry:'room',initialInventory:{},rooms:[{id:'room',title:'Room',sources:[gift('hidden-key',['half','half'],'hidden')],doors:[door('secret-door','secret',['half','half'],{revealAfter:'hidden-key'})]}],terminals:[ending('secret','secret-ending')]};}

test('a secret needs a claimed hidden source and traversal through its revealed physical door',()=>{
 const data=secret(),report=analyzeDungeon(data);assert.equal(report.passed,true);assert.equal(report.secretProofs.length,1);assert.equal(report.secretProofs[0].allPathsRequireHiddenClaimAndGate,true);
 assert.equal(report.secretProofs[0].orderedHistories,'1');assert.equal(report.secretProofs[0].hiddenGatedHistories,'1');assert.equal(report.secretProofs[0].ungatedWitness,null);
 assert.deepEqual(report.secretProofs[0].witness.claimedSources,['hidden-key']);assert.deepEqual(report.secretProofs[0].witness.hiddenGateSources,['hidden-key']);
 assert.throws(()=>replayDungeon(data,[open('secret-door')]),/not revealed/);
 const replay=replayDungeon(data,[claim('hidden-key'),open('secret-door')]);assert.equal(replay.terminal,'secret');assert(inventoryEmpty(replay.inventory));
});

test('secret provenance checks every history even when gated and ungated paths merge to the same inventory and claimed set',()=>{
 const data=secret();data.rooms[0].doors.push(door('unguarded-shortcut','secret'));
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.terminals[0].distinctFinalStates,1);assert.equal(report.balances.violationCount,0);assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,0);
 const proof=report.secretProofs[0];assert.equal(proof.orderedHistories,'2');assert.equal(proof.hiddenGatedHistories,'1');assert.equal(proof.allPathsRequireHiddenClaimAndGate,false);
 assert.deepEqual(proof.witness.hiddenGateSources,['hidden-key'],'The first representative happens to be the gated path');
 assert.deepEqual(proof.ungatedWitness.actions,[claim('hidden-key'),open('unguarded-shortcut')]);assert.deepEqual(proof.ungatedWitness.hiddenGateSources,[]);
 assert.deepEqual(replayDungeon(data,proof.ungatedWitness.actions).claimedSources,['hidden-key'],'A hidden pickup alone is not a revealed-door proof');
});

test('a reveal gate on an ordinary NPC source does not establish a hidden-note secret',()=>{
 const data=secret();data.rooms[0].sources[0].type='npc';data.rooms[0].sources[0].character='Nell';
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.secretProofs[0].hiddenGatedHistories,'0');
 assert.equal(report.secretProofs[0].allPathsRequireHiddenClaimAndGate,false);assert.equal(report.balances.violationCount,0);
});

test('source, door, room and terminal coverage report authored content that has no reachable witness',()=>{
 const data=fixture();data.rooms.push({id:'orphan',title:'Orphan',sources:[gift('orphan-gift',['half','half'])],doors:[door('orphan-door','unused')]});data.terminals.push(ending('unused'));
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.deepEqual(report.coverage,{unreachableRooms:['orphan'],unreachableSources:['orphan-gift'],unreachableDoors:['orphan-door'],unreachableTerminals:['unused']});
 assert.equal(report.sources.find(source=>source.id==='orphan-gift').witness,null);assert.equal(report.terminals.find(terminal=>terminal.id==='unused').witness,null);
});

test('structural validation rejects malformed notes, counts, IDs, destinations and nonlocal reveal sources',()=>{
 const mutations=[
  [data=>data.version=2,/version/],
  [data=>data.entry='missing',/Entry/],
  [data=>data.initialInventory={unknown:1},/Unknown initial/],
  [data=>data.initialInventory={half:-1},/Invalid initial/],
  [data=>data.initialInventory={half:1.5},/Invalid initial/],
  [data=>data.initialInventory={half:Number.MAX_SAFE_INTEGER},/safe integer/],
  [data=>{data.initialInventory={half:Number.MAX_SAFE_INTEGER};data.rooms[0].sources=[];},/safe integer/],
  [data=>data.rooms[0].sources.push(copy(data.rooms[0].sources[0])),/source ID/],
  [data=>data.rooms.push(copy(data.rooms[0])),/room ID/],
  [data=>data.terminals[0].id='depot',/terminal ID/],
  [data=>data.rooms[0].doors.push(copy(data.rooms[0].doors[0])),/door ID/],
  [data=>data.rooms[0].sources[0].type='automatic',/source type/],
  [data=>data.rooms[0].sources[0].recipe=[],/nonempty recipe/],
  [data=>data.rooms[0].sources[0].recipe=['unknown'],/Unknown note/],
  [data=>data.rooms[0].doors[0].recipe=['half'],/four beats/],
  [data=>data.rooms[0].doors[0].recipe=['unknown'],/Unknown note/],
  [data=>data.rooms[0].doors[0].to='missing',/destination/],
  [data=>data.rooms[0].doors[0].revealAfter='missing',/local source/],
  [data=>data.terminals[0].kind='victory',/terminal kind/],
  [data=>data.rooms[0].sources={},/arrays/]
 ];
 for(const [change,pattern]of mutations){const data=fixture();change(data);assert.throws(()=>compileDungeon(data),pattern);}
 const remote=fixture();remote.rooms.push({id:'elsewhere',title:'Elsewhere',sources:[gift('remote-key',['half'],'hidden')],doors:[]});remote.rooms[0].doors[0].revealAfter='remote-key';assert.throws(()=>compileDungeon(remote),/local source/);
 const duplicate=fixture();duplicate.rooms.push({id:'elsewhere',title:'Elsewhere',sources:[gift('parcel',['quarter'])],doors:[]});assert.throws(()=>compileDungeon(duplicate),/source ID/);
});

test('cycles, including disconnected cycles, are rejected before action exploration',()=>{
 const self=fixture();self.rooms[0].doors.push(door('loop','depot'));assert.throws(()=>analyzeDungeon(self),/Cycle/);
 const disconnected=fixture();disconnected.rooms.push({id:'a',title:'A',sources:[],doors:[door('a-b','b')]},{id:'b',title:'B',sources:[],doors:[door('b-a','a')]});assert.throws(()=>analyzeDungeon(disconnected),/Cycle/);
});

test('witnesses for every reachable source, door and terminal replay with typed conservation and no input mutation',()=>{
 const data=optionalDead(),original=copy(data),report=analyzeDungeon(data);
 for(const item of [...report.sources,...report.doors,...report.terminals])if(item.reachable){const replay=replayDungeon(data,item.witness.actions);assert.equal(replay.nodeId,item.witness.nodeId);assert.deepEqual(replay.inventory,item.witness.inventory);assert.equal(replay.conservation.valid,true);}
 assert.deepEqual(data,original);assert.throws(()=>analyzeDungeon(fixture(),{maxStates:2}),/state limit exceeded/);
 assert.throws(()=>analyzeDungeon(fixture(),{maxStates:0}),/Invalid state limit/);
});

function replayRisk(){return{version:1,entry:'fork',initialInventory:{half:4},replayRisk:{irreversibleDoors:true,lossEntryDoorIds:['mistake']},rooms:[
 {id:'fork',title:'Fork',sources:[],doors:[door('safe','home'),door('mistake','detour')]},
 {id:'detour',title:'Detour',sources:[],doors:[door('extra-gate','home')]},
 {id:'home',title:'Final controls',sources:[],doors:[door('finish','done')]}
 ],terminals:[ending()]};}

test('explicit risk doors permit witnessed note exhaustion without disabling ordinary safety checks',()=>{
 const data=replayRisk(),report=analyzeDungeon(data);
 assert.equal(report.passed,true);assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,0);
 assert.equal(report.runFailures.count,1);assert.equal(report.runFailures.zeroNoteCount,1);assert.equal(report.runFailures.missingTypeCount,0);
 assert.equal(report.runFailures.orderedHistories,'1');assert.equal(report.graph.orderedTerminalHistories,'1');assert.equal(report.graph.orderedRunHistories,'2');
 assert.equal(report.intentionalLossStates.count,2,'The paid detour and its empty final room are doomed, but declared.');
 const failure=report.runFailures.states[0];assert.equal(failure.nodeId,'home');assert.equal(failure.reason,'out-of-notes');assert(inventoryEmpty(failure.inventory));
 assert.deepEqual(failure.witness.actions,[open('mistake'),open('extra-gate')]);assert.deepEqual(failure.witness.riskEntryDoors,['mistake']);
 assert.equal(failure.witness.conservation.valid,true);assert.equal(report.replayRiskProofs[0].hasWitnessedRunFailure,true);
 assert.deepEqual(report.replayRiskProofs[0].witness.actions,failure.witness.actions);
 assert.equal(report.terminals[0].zeroBalanceStates,1);assert(inventoryEmpty(report.terminals[0].witness.inventory));
 const strict=copy(data);delete strict.replayRisk;
 const rejected=analyzeDungeon(strict);assert.equal(rejected.passed,false);assert.equal(rejected.runFailures.count,0);assert.equal(rejected.softlocks.count,1);assert.equal(rejected.forcedDeadEndStates.count,2);
});

test('a risk policy cannot excuse an unmarked stranded branch or a merely safe declared entry',()=>{
 const data=replayRisk();data.rooms[0].doors.push(door('unmarked','stranded'));data.rooms.push({id:'stranded',title:'Stranded',sources:[],doors:[]});
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.runFailures.count,1);assert.equal(report.softlocks.count,1);
 assert.equal(report.softlocks.states[0].nodeId,'stranded');assert.deepEqual(report.softlocks.states[0].unriskedWitness.riskEntryDoors,[]);
 const broad=replayRisk();broad.replayRisk.lossEntryDoorIds.push('safe');
 const invalid=analyzeDungeon(broad);assert.equal(invalid.passed,false);assert.equal(invalid.replayRiskProofs.find(proof=>proof.doorId==='safe').hasWitnessedRunFailure,false);
 const surplus=replayRisk();surplus.initialInventory.half=5;
 const unbalanced=analyzeDungeon(surplus);assert.equal(unbalanced.passed,false);assert(unbalanced.balances.violationCount>0,'Risk never excuses a successful ending with leftover notes.');
});

test('loss provenance checks every merged history and reports a concrete unmarked bypass',()=>{
 const data=replayRisk();data.rooms[0].doors.push(door('unmarked-bypass','detour'));
 const report=analyzeDungeon(data);assert.equal(report.passed,false);assert.equal(report.runFailures.count,0);assert.equal(report.softlocks.count,1);
 assert.equal(report.softlocks.states[0].nodeId,'home');assert(inventoryEmpty(report.softlocks.states[0].inventory));
 assert.deepEqual(report.softlocks.states[0].unriskedWitness.actions,[open('unmarked-bypass'),open('extra-gate')]);
 assert.deepEqual(report.softlocks.states[0].unriskedWitness.riskEntryDoors,[]);
 assert.equal(report.replayRiskProofs[0].hasWitnessedRunFailure,false,'A marked representative cannot hide an unmarked merged path.');
});

test('risk annotations must name unique real room-entry doors and irreversible costs',()=>{
 const changes=[
  [data=>data.replayRisk=false,/risk policy/],
  [data=>data.replayRisk.irreversibleDoors=false,/irreversible/],
  [data=>data.replayRisk.lossEntryDoorIds=[],/explicit loss-entry/],
  [data=>data.replayRisk.lossEntryDoorIds=['unknown'],/loss-entry door/],
  [data=>data.replayRisk.lossEntryDoorIds=['mistake','mistake'],/loss-entry door/],
  [data=>data.replayRisk.lossEntryDoorIds=['finish'],/playable room/],
  [data=>data.replayRisk.allowEverySoftlock=true,/risk policy/],
 ];
 for(const [change,pattern]of changes){const data=replayRisk();change(data);assert.throws(()=>compileDungeon(data),pattern);}
});

test('fresh journals preserve all old successes and deliberate losses while keeping the ultimate route locked',()=>{
 const data=JSON.parse(readFileSync(new URL('./dungeon.json',import.meta.url),'utf8'));assert.deepEqual(CAMPAIGN_PLAN,data,'Runtime and design data must remain identical.');
 const report=analyzeDungeon(data);assert.equal(report.passed,true);
 assert.equal(report.graph.rooms,19);assert.equal(report.graph.doors,28);assert.equal(report.graph.sources,7);assert.equal(report.graph.terminals,7);
 assert.equal(report.graph.reachableStates,43);assert.equal(report.graph.transitions,43);
 assert.equal(report.graph.orderedTerminalHistories,'14');assert.equal(report.graph.orderedRunFailureHistories,'10');assert.equal(report.graph.orderedRunHistories,'24');
 assert.equal(report.runFailures.count,5);assert.equal(report.runFailures.zeroNoteCount,3);assert.equal(report.runFailures.missingTypeCount,2);
 assert.deepEqual(report.runFailures.states.filter(state=>state.reason==='out-of-notes').map(state=>state.nodeId).sort(),['canal-final','garden-secret-final','workshop-secret-final']);
 assert.deepEqual(report.runFailures.states.filter(state=>state.reason==='missing-note-types').map(state=>state.nodeId).sort(),['dead-aviary','dead-brambles']);
 assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,0);assert.equal(report.intentionalLossStates.count,14);
 assert(Object.values(report.coverage).every(ids=>ids.length===0));assert.equal(report.balances.violationCount,0);
 const successes=report.terminals.filter(terminal=>terminal.kind!=='dead-end'&&terminal.reachable);assert.equal(successes.length,5);
 assert.deepEqual(report.progress.lockedUntilProgress,{rooms:['final-concourse','final-heart'],sources:[],doors:['depot-final-route','concourse-heart','heart-complete'],terminals:['ending-complete']});
 assert.equal(report.progress.lockedGates.length,1);assert.equal(report.progress.lockedGates[0].missingOutcomes.length,11);
 for(const terminal of successes){assert.equal(terminal.zeroBalanceStates,1);assert(inventoryEmpty(terminal.witness.inventory));assert.deepEqual(terminal.witness.riskEntryDoors,[]);}
 assert(report.secretProofs.every(proof=>proof.allPathsRequireHiddenClaimAndGate));
 assert.equal(report.replayRiskProofs.length,3);assert(report.replayRiskProofs.every(proof=>proof.hasWitnessedRunFailure&&proof.witness.riskEntryDoors.includes(proof.doorId)));
 for(const failure of report.runFailures.states){const replay=replayDungeon(data,failure.witness.actions);assert.equal(replay.terminal,null);assert.equal(replay.conservation.valid,true);assert.deepEqual(replay.inventory,failure.inventory);}
});


test('all eleven earlier outcomes unlock a conserved three-key route, without requiring its own ending',()=>{
 const data=JSON.parse(readFileSync(new URL('./dungeon.json',import.meta.url),'utf8')),report=analyzeDungeonProgress(data);
 assert.equal(report.passed,true);assert.equal(report.graph.reachableStates,46);assert.equal(report.graph.transitions,46);
 assert.equal(report.graph.orderedTerminalHistories,'16');assert.equal(report.graph.orderedRunFailureHistories,'10');assert.equal(report.graph.orderedRunHistories,'26');
 assert.equal(report.runFailures.count,5);assert.equal(report.balances.violationCount,0);assert.equal(report.softlocks.count,0);assert.equal(report.forcedDeadEndStates.count,0);
 assert.deepEqual(report.progress.knownOutcomes,data.progressOutcomes);assert(!report.progress.knownOutcomes.includes('ending-complete'));
 assert.deepEqual(report.progress.lockedUntilProgress,{rooms:[],sources:[],doors:[],terminals:[]});
 assert(Object.values(report.coverage).every(ids=>ids.length===0));
 const final=report.terminals.find(terminal=>terminal.id==='ending-complete');
 assert.equal(final.reachable,true);assert.equal(final.orderedHistories,'2');assert.equal(final.zeroBalanceStates,1);assert(inventoryEmpty(final.witness.inventory));
 assert.deepEqual(final.witness.actions,[claim('nell-parcel'),claim('depot-chest'),open('depot-final-route'),open('concourse-heart'),open('heart-complete')]);
 assert.deepEqual(final.witness.claimedSources,['nell-parcel','depot-chest']);assert.deepEqual(final.witness.riskEntryDoors,[]);
 assert.equal(report.progressProof.requiredOutcomes.length,11);assert.equal(report.progressProof.allPrerequisitesNecessary,true);
 assert.equal(report.progressProof.profiles.freshJournal.graph.orderedRunHistories,'24');assert.equal(report.progressProof.profiles.completeJournal.graph.orderedRunHistories,'26');
 for(const partial of report.progressProof.missingOne){
  assert.equal(partial.passed,true);assert.equal(partial.allAffectedGatesLocked,true);assert.equal(partial.graph.orderedRunHistories,'24');
  assert.deepEqual(partial.lockedGates,[{doorId:'depot-final-route',missingOutcomes:[partial.missingOutcome]}]);
  assert(!partial.knownOutcomes.includes('ending-complete'));
 }
 for(const item of [...report.sources,...report.doors,...report.terminals])if(item.reachable){
  const replay=replayDungeon(data,item.witness.actions,{progressOutcomes:item.witness.progressOutcomes});
  assert.equal(replay.nodeId,item.witness.nodeId);assert.deepEqual(replay.inventory,item.witness.inventory);assert.equal(replay.conservation.valid,true);
 }
 assert.throws(()=>replayDungeon(data,final.witness.actions),/recorded outcomes/);
 for(const missing of data.progressOutcomes)assert.throws(()=>replayDungeon(data,final.witness.actions,{progressOutcomes:data.progressOutcomes.filter(id=>id!==missing)}),/recorded outcomes/);
});

function progressFixture(){
 const data=fixture();data.progressOutcomes=['earlier-loss'];
 data.rooms[0].doors.push(door('learned-route','learned-room',['half','half'],{requiresProgress:{outcomes:['earlier-loss']}}));
 data.rooms.push({id:'learned-room',title:'Learned room',sources:[gift('learned-gift',['half','half'])],doors:[door('learned-finish','learned-ending')]});
 data.terminals.push(ending('learned-ending'));return data;
}

test('progress locks are explicit and cannot conceal broken full-progress budgets or unreachable content',()=>{
 const data=progressFixture(),fresh=analyzeDungeon(data),complete=analyzeDungeon(data,{progressOutcomes:['earlier-loss']});
 assert.equal(fresh.passed,true);assert.deepEqual(fresh.progress.lockedUntilProgress.rooms,['learned-room']);
 assert.equal(complete.passed,true);assert.deepEqual(complete.progress.lockedUntilProgress.rooms,[]);assert.equal(analyzeDungeonProgress(data).passed,true);
 const broken=copy(data);broken.rooms[1].sources[0].recipe.push('quarter');
 assert.equal(analyzeDungeon(broken).passed,true,'Fresh journal reports the branch as locked, not budget-verified.');
 const failed=analyzeDungeonProgress(broken);assert.equal(failed.passed,false);assert(failed.balances.violationCount>0);
 const orphan=copy(data);orphan.rooms.push({id:'orphan',title:'Orphan',sources:[],doors:[]});
 const unreachable=analyzeDungeonProgress(orphan);assert.equal(unreachable.passed,false);assert.deepEqual(unreachable.coverage.unreachableRooms,['orphan']);
});

test('progress requirements use unique registered outcome IDs and reject malformed or unknown grants',()=>{
 const changes=[
  [data=>data.progressOutcomes={},/Progress outcomes/],
  [data=>data.progressOutcomes=['earlier-loss','earlier-loss'],/Progress outcomes/],
  [data=>data.progressOutcomes=[''],/Progress outcomes/],
  [data=>data.rooms[0].doors[1].requiresProgress=null,/progress requirement/],
  [data=>data.rooms[0].doors[1].requiresProgress={outcomes:[]},/progress requirement/],
  [data=>data.rooms[0].doors[1].requiresProgress={outcomes:['earlier-loss'],complete:true},/progress requirement/],
  [data=>data.rooms[0].doors[1].requiresProgress={outcomes:['unknown']},/progress outcome/],
  [data=>data.rooms[0].doors[1].requiresProgress={outcomes:['earlier-loss','earlier-loss']},/progress outcome/]
 ];
 for(const [change,pattern]of changes){const data=progressFixture();change(data);assert.throws(()=>compileDungeon(data),pattern);}
 assert.throws(()=>analyzeDungeon(progressFixture(),{progressOutcomes:['unknown']}),/progress outcome/);
 assert.throws(()=>analyzeDungeon(progressFixture(),{progressOutcomes:{'earlier-loss':true}}),/progress outcome/);
});
