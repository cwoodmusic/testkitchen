const test=require('node:test'),assert=require('node:assert/strict');
const fishing=require('../rhythm-fishing-engine.js');

test('practice remains playable at both progress bounds and keeps generating new bars',()=>{
 let finishes=0;
 const game=fishing.createSession({practice:true,fish:'silver-minnow',meter:'4/4',startTime:10,onFinish:()=>finishes++});
 for(let bar=1;bar<=80;bar++)game.update(game.timeAtBeat(bar*4));
 let state=game.getState();assert.equal(state.practice,true);assert.equal(state.progress,0);
 assert.equal(state.phase,'playing');assert.equal(state.result,null);assert.ok(state.misses>100);
 assert.ok(state.notes.some(note=>note.bar>=80),'Practice should generate patterns long after a normal escape');
 assert.ok(state.notes.length<192,'Long practice sessions should discard old notation');
 for(let count=0;count<80;count++){
  const note=game.getState().notes.find(note=>note.judgement==='pending');assert.ok(note);
  game.press(note.time,'key:Space');
  if(note.requiresHold)game.update(note.holdEndTime);
  game.release(note.requiresHold?note.holdEndTime:note.time,'key:Space');
 }
 state=game.getState();assert.equal(state.progress,100);assert.ok(state.hits>=80);
 assert.equal(state.phase,'playing');assert.equal(state.result,null);assert.equal(finishes,0);
 const end=game.abort();assert.equal(finishes,1);assert.equal(end.result.practice,true);
 assert.equal(end.result.notes,0);assert.equal(end.result.xp,0);assert.equal(end.result.perfect,false);
 assert.deepEqual(end.pressedSources,[]);assert.deepEqual(end.activeHolds,[]);
});

test('every meter and difficulty tier supports endless practice without catch rewards',()=>{
 for(const meter of Object.keys(fishing.METERS))for(const rarity of fishing.RARITIES){
  const game=fishing.createSession({practice:true,meter,rarity:rarity.id,random:()=>0,startTime:0});
  let state=game.getState();assert.equal(state.meter,meter);assert.equal(state.fish.rarity,rarity.id);
  assert.equal(state.practice,true);assert.equal(state.perfectEligible,false);assert.equal(state.targetBars,8);
  for(let count=0;count<100;count++){
   const note=game.getState().notes.find(note=>note.judgement==='pending');assert.ok(note,meter+' '+rarity.id);
   game.press(note.time,'pointer:1');
   if(note.requiresHold)game.update(note.holdEndTime);
   game.release(note.requiresHold?note.holdEndTime:note.time,'pointer:1');
  }
  state=game.getState();assert.equal(state.progress,100);assert.equal(state.result,null);
  const result=game.abort().result;
  assert.equal(result.practice,true);assert.equal(result.caught,false);
  assert.equal(result.notes,0);assert.equal(result.xp,0);assert.equal(result.perfect,false);
 }
});

test('ordinary sessions still finish and pay their unchanged catch rewards',()=>{
 const game=fishing.createSession({fish:'silver-minnow',meter:'4/4',startTime:0});
 for(let count=0;count<200&&!game.getState().result;count++){
  const note=game.getState().notes.find(note=>note.judgement==='pending');game.update(note.time);if(game.getState().result)break;game.press(note.time,'key:Space');
  if(note.requiresHold)game.update(note.holdEndTime);
  game.release(note.requiresHold?note.holdEndTime:note.time,'key:Space');
 }
 const state=game.getState();assert.equal(state.practice,false);assert.equal(state.phase,'caught');
 assert.equal(state.result.practice,false);assert.equal(state.result.notes,4);assert.equal(state.result.xp,8);assert.equal(state.result.perfect,true);
});
