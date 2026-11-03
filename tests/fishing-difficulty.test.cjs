'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fishing=require('../rhythm-fishing-engine.js');
const create=(fish,meter)=>fishing.createSession({fish,meter,id:'gentler-fishing-'+fish});
const pending=game=>game.getState().notes.find(note=>note.judgement==='pending');

test('the gentler game accepts mobile-sized timing errors while Legendary retains faster, denser rhythms',()=>{
 const common=create('silver-minnow'),quarter=pending(common);
 assert.equal(common.press(quarter.time+.205,'touch').kind,'hit','A 205 ms quarter-note tap now fits the beginner window');
 const legendary=create('crescendo-coelacanth');let disabledPerfect=false,target=null;
 for(let turn=0;turn<200&&!target;turn++){
  const note=pending(legendary),state=legendary.getState();assert.ok(note);
  if(note.onset>=state.tempo.endBeat&&note.duration===.25){target=note;break;}
  assert.equal(legendary.tap(note.time).kind,'hit');
  if(!disabledPerfect){legendary.tap(note.time);disabledPerfect=true;}
 }
 assert.ok(target,'Exercise an actual sixteenth at the settled Legendary tempo');
 assert.ok(target.window>=.0817,'Legendary sixteenths get more than the old 72 ms window at 100 BPM');
 const press=legendary.press(target.time+.079,'touch');
 assert.equal(press.kind,'hit');assert.equal(press.noteId,target.id,'A 79 ms late press claims its own target');
 assert.ok(legendary.getState().window<common.getState().window,'Legendary still demands more precise playing than Common');
 assert.ok(legendary.getState().quarterBpm>common.getState().quarterBpm);
 const patterns=rarity=>fishing.PATTERNS.filter(pattern=>pattern.rarity===rarity);
 assert.ok(patterns('legendary').some(pattern=>pattern.events.some(note=>note.duration===.25)));
 assert.ok(patterns('common').every(pattern=>pattern.events.every(note=>note.duration>=.5)));
 for(const meter of Object.keys(fishing.METERS)){
  const averageNotes=rarity=>patterns(rarity).filter(pattern=>pattern.meter===meter).reduce((total,pattern)=>total+pattern.events.filter(note=>!note.rest).length,0)/6;
  assert.ok(averageNotes('legendary')>averageNotes('common'),meter+' Legendary phrases remain busier');
 }
});

test('one missed note per bar is recoverable for every Legendary species without a prolonged battle',()=>{
 for(const fish of fishing.FISH.filter(fish=>fish.rarity==='legendary')){
  const game=create(fish.id),missedBars=new Set();
  for(let turn=0;turn<600&&!game.getState().result;turn++){
   const note=pending(game);assert.ok(note);
   if(!missedBars.has(note.bar)){
    missedBars.add(note.bar);game.update(note.time+note.window+.00001);
   }else{
    const answer=game.tap(note.time);
    if(answer.kind==='finished')assert.equal(answer.state.result?.caught,true,'A clean rest may finish recovery before the next note');
    else assert.equal(answer.kind,'hit');
   }
  }
  const state=game.getState();
  assert.equal(state.result?.caught,true,fish.id+' should recover despite an occasional missed note');
  assert.equal(state.result.perfect,false);assert.ok(state.misses>=8);
  assert.ok(state.beat>=8*state.barBeats,'Recovery never bypasses the eight-bar minimum');
  assert.ok(state.beat<20*state.barBeats,fish.id+' should recover within twenty written bars, rather than fifty or more');
  assert.equal(state.result.notes,fish.notes);assert.equal(state.result.xp,fish.xp);
 }
});

test('large idle clock jumps judge bounded score batches and match ordinary missed-note updates',()=>{
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  const jumped=create(fish.id,meter),stepped=create(fish.id,meter);
  jumped.update(10000);
  for(let turn=0;turn<300&&!stepped.getState().result;turn++){
   const note=pending(stepped);assert.ok(note);stepped.update(note.time+note.window+.00001);
  }
  const a=jumped.getState(),b=stepped.getState();
  assert.equal(a.result?.outcome,'escaped',fish.id+' cannot survive by leaving a long gap between frames');
  assert.equal(b.result?.outcome,'escaped');
  assert.equal(a.misses,b.misses);assert.equal(a.hits,b.hits);assert.equal(a.progress,b.progress);
  assert.equal(a.result.notes,0);assert.equal(a.result.xp,0);assert.equal(a.result.caught,false);
 }
});

test('mashing still loses progress and cannot turn the easier penalties into a free catch',()=>{
 for(const rarity of fishing.RARITIES){
  const fish=fishing.FISH.find(fish=>fish.rarity===rarity.id),game=create(fish.id),note=pending(game);
  assert.equal(game.tap(note.time).kind,'hit');
  for(let press=0;press<64&&!game.getState().result;press++)game.tap(note.time);
  const state=game.getState();
  assert.equal(state.result?.outcome,'escaped',rarity.id+' repeated taps must still cost progress');
  assert.equal(state.hits,1);assert.ok(state.extras>5);assert.equal(state.result.notes,0);assert.equal(state.result.xp,0);
 }
});
