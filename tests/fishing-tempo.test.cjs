const test=require('node:test'),assert=require('node:assert/strict');
const fishing=require('../rhythm-fishing-engine.js');
const close=(actual,expected,epsilon=1e-8)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} differs from ${expected}`);
const fishWith=(change,rarity='legendary')=>fishing.FISH.find(fish=>fish.rarity===rarity&&fish.tempo.change===change);
const create=(fish,meter=fish.meter)=>fishing.createSession({fish,meter,id:'tempo-'+fish.id,startTime:1234.567});
function advanceAlive(game,target){
 for(let count=0;count<2000&&game.getState().now<target;count++){
  const state=game.getState(),note=state.notes.find(note=>note.judgement==='pending');
  assert.equal(state.result,null,'The tempo demonstration must remain a live encounter');assert.ok(note);
  if(note.time>target){game.update(target);break;}
  if(state.progress>64)game.update(Math.min(target,note.time+note.window+.00001));else game.tap(Math.max(state.now,note.time));
 }
 close(game.getState().now,target);assert.equal(game.getState().result,null);
}

test('species keep sixteenth-note phrases at or below 100 quarter-note BPM',()=>{
 for(const fish of fishing.FISH){
  assert.ok(Object.isFrozen(fish.tempo));assert.equal(fish.tempo.unit,'quarter');
  const tempo=fish.tempo;assert.ok(tempo.startQuarterBpm>=76&&tempo.startQuarterBpm<=100);assert.ok(tempo.endQuarterBpm>=76&&tempo.endQuarterBpm<=100);
  if(fish.rarityRank<2){assert.equal(tempo.change,'steady');assert.equal(tempo.startQuarterBpm,fish.rarity==='common'?76:82);assert.equal(tempo.startQuarterBpm,tempo.endQuarterBpm);}
  if(fish.rarityRank>=2){
   close(Math.max(tempo.startQuarterBpm,tempo.endQuarterBpm),100);
   assert.equal(tempo.initialMarking,fishing.tempoMarking(tempo.startQuarterBpm).marking);
   assert.equal(tempo.endMarking,fishing.tempoMarking(tempo.endQuarterBpm).marking);
   if(tempo.change==='accelerando')assert.ok(tempo.startQuarterBpm<tempo.endQuarterBpm,'The cap preserves an actual acceleration');
   if(tempo.change==='ritardando')assert.ok(tempo.startQuarterBpm>tempo.endQuarterBpm,'The cap preserves an actual slowdown');
  }
 }
 for(const rarity of ['rare','epic','legendary'])for(const change of ['steady','accelerando','ritardando'])assert.ok(fishWith(change,rarity),rarity+' '+change);
 for(const meter of Object.keys(fishing.METERS))assert.ok(fishing.availableFish(meter).some(fish=>fish.rarityRank>=2&&fish.tempo.change!=='steady'),meter+' has changing-tempo fish');
 assert.equal(fishing.fishFor('luminous-dragonfish').tempo.change,'accelerando');
 close(fishing.fishFor('luminous-dragonfish').tempo.startQuarterBpm,100*120/144);
 close(fishing.fishFor('luminous-dragonfish').tempo.endQuarterBpm,100);
 assert.equal(fishing.tempoMarking(108).marking,'Moderato');assert.equal(fishing.tempoMarking(120).marking,'Allegro');assert.equal(fishing.tempoMarking(156).marking,'Vivace');assert.equal(fishing.tempoMarking(168).marking,'Presto');
});

test('the sixteenth cap covers normal catches, rests, syncopations, and endless practice in every eligible meter',()=>{
 const observed=new Set();
 function check(game,notes,label){
  for(const note of notes){
   const subdivision=note.duration===.25||note.duration===.75||Math.abs(note.onset*2-Math.round(note.onset*2))>1e-8;
   if(!subdivision)continue;
   observed.add(note.token);
   assert.ok(game.tempoAtBeat(note.onset)<=100+1e-8,label+' onset must not exceed 100 quarter BPM');
   assert.ok(game.tempoAtBeat(note.onset+note.duration)<=100+1e-8,label+' tail must not accelerate beyond 100 quarter BPM');
   assert.ok(note.durationSeconds>=note.duration*.6-1e-8,label+' real subdivision duration respects the quarter-note limit');
   if(note.duration===.25)assert.ok(note.durationSeconds>=.15-1e-8,label+' sixteenth notes and rests last at least 150 ms');
  }
 }
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  const normal=create(fish,meter),initial=normal.getState(),label=fish.id+' '+meter;
  check(normal,initial.notes,label+' catch');
  for(const beat of [0,initial.tempo.startBeat,(initial.tempo.startBeat+initial.tempo.endBeat)/2,initial.tempo.endBeat,100000]){
   assert.ok(normal.tempoAtBeat(beat)<=100+1e-8,label+' the immutable timeline never exceeds the cap');
  }
  const practice=fishing.createSession({fish,meter,practice:true,startTime:10});
  for(const bar of [0,2,4,12,64,256]){
   practice.update(practice.timeAtBeat(bar*initial.barBeats));
   const state=practice.getState();assert.equal(state.result,null,label+' practice remains endless');
   assert.ok(state.quarterBpm<=100+1e-8,label+' practice tempo remains capped after the ramp');
   assert.ok(state.displayBpm<=100+1e-8,label+' conducted pulse cannot hide a faster quarter-note rate');
   check(practice,state.notes,label+' practice bar '+bar);
  }
 }
 for(const token of ['s','rs','de'])assert.ok(observed.has(token),'The tempo policy exercised '+token+' notation');
});

test('exact beat/time maps are monotonic inverses before, during and after every fish ramp',()=>{
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  const game=create(fish,meter),initial=game.getState(),{startBeat,endBeat}=initial.tempo;
  const beats=[-100,-initial.barBeats,-.5,0,.25,startBeat,startBeat+.25,(startBeat+endBeat)/2,endBeat-.25,endBeat,endBeat+8,10000];
  let previous=-Infinity;
  for(const beat of beats){const time=game.timeAtBeat(beat);assert.ok(time>previous,fish.id+' '+meter+' beat '+beat);previous=time;close(game.beatAtTime(time),beat,1e-7);close(game.timeAtBeat(game.beatAtTime(time)),time);}
  close(game.timeAtBeat(-initial.barBeats),initial.startTime);close(game.timeAtBeat(0),initial.musicStart);
  assert.ok(Number.isNaN(game.timeAtBeat(NaN)));assert.ok(Number.isNaN(game.beatAtTime(Infinity)));assert.ok(Number.isNaN(game.tempoAtBeat(NaN)));
  assert.deepEqual(game.getState(),initial,'Reading future tempo never advances scoring or the game clock');
 }
});

test('accelerando shortens real beat durations and ritardando lengthens them without jumps or unbounded speed',()=>{
 for(const change of ['accelerando','ritardando']){
  const fish=fishWith(change),game=create(fish),state=game.getState(),{startBeat,endBeat}=state.tempo;
  const intervals=[];for(let beat=startBeat;beat<endBeat;beat+=.25)intervals.push(game.timeAtBeat(beat+.25)-game.timeAtBeat(beat));
  for(let index=1;index<intervals.length;index++)assert.ok(change==='accelerando'?intervals[index]<intervals[index-1]:intervals[index]>intervals[index-1]);
  close(game.tempoAtBeat(startBeat-100),fish.tempo.startQuarterBpm);close(game.tempoAtBeat(endBeat+10000),fish.tempo.endQuarterBpm);
  close(game.timeAtBeat(endBeat+2)-game.timeAtBeat(endBeat+1),60/fish.tempo.endQuarterBpm);
  close(game.timeAtBeat(startBeat)-game.timeAtBeat(startBeat-1),60/fish.tempo.startQuarterBpm);
  const crossing=game.timeAtBeat(startBeat+.25)-game.timeAtBeat(startBeat-.25);assert.ok(crossing>0&&crossing<.5);
 }
});

test('count-in is steady and every note, pulse and bar line uses the same integrated timeline',()=>{
 for(const fish of [fishWith('accelerando'),fishWith('ritardando'),fishWith('steady')])for(const meter of fish.meters){
  const game=create(fish,meter),initial=game.getState();
  close(initial.beat,-initial.barBeats);close(initial.countInSeconds,initial.barBeats*60/fish.tempo.startQuarterBpm);
  const count=initial.pulses.filter(pulse=>pulse.countIn);assert.equal(count.length,initial.pulsesPerBar);
  count.forEach((pulse,index)=>{close(pulse.time,initial.startTime+index*initial.secondsPerPulse);assert.equal(pulse.strong,index===0);});
  advanceAlive(game,game.timeAtBeat(initial.tempo.startBeat+1));const state=game.getState();
  assert.equal(new Set(state.pulses.map(pulse=>pulse.id)).size,state.pulses.length);
  for(const pulse of state.pulses){close(pulse.time,game.timeAtBeat(pulse.beat));close(pulse.beat/state.pulseBeats,Math.round(pulse.beat/state.pulseBeats));}
  for(const line of state.barLines){close(line.beat,line.bar*state.barBeats);close(line.time,game.timeAtBeat(line.beat));}
  for(const note of state.notes){close(note.time,game.timeAtBeat(note.onset));close(note.durationSeconds,game.timeAtBeat(note.onset+note.duration)-note.time);}
  close(state.secondsPerPulse,60/state.tempo.currentPulseBpm);close(state.secondsPerBeat,60/state.tempo.currentQuarterBpm);
 }
});

test('HUD tempo follows the live marking and exposes pending, active and settled changes',()=>{
 for(const change of ['accelerando','ritardando']){
  const game=create(fishWith(change,'epic')),initial=game.getState();assert.equal(initial.tempo.active,false);assert.equal(initial.tempo.settled,false);assert.equal(initial.tempo.progress,0);
  advanceAlive(game,game.timeAtBeat(initial.tempo.startBeat+1));const active=game.getState();assert.equal(active.tempo.active,true);assert.ok(active.tempo.progress>0&&active.tempo.progress<1);assert.equal(active.tempo.marking,fishing.tempoMarking(active.quarterBpm).marking);
  advanceAlive(game,game.timeAtBeat(initial.tempo.endBeat+1));const settled=game.getState();assert.equal(settled.tempo.active,false);assert.equal(settled.tempo.settled,true);assert.equal(settled.tempo.progress,1);close(settled.quarterBpm,initial.tempo.endQuarterBpm);
 }
});

test('fast targets have disjoint timing windows and a gap tap cannot claim the next note',()=>{
 for(const fish of fishing.FISH.filter(fish=>fish.rarityRank>=2)){
  const game=create(fish),notes=game.getState().notes.filter(note=>!note.rest);
  for(let index=0;index<notes.length;index++){
   const note=notes[index];assert.ok(note.window>0&&note.window<=game.getState().window);assert.equal(note.window,note.judgementWindow);
   if(index)assert.ok(notes[index-1].time+notes[index-1].window<note.time-note.window,fish.id+' cannot overlap adjacent hit zones');
  }
 }
 const game=create(fishWith('accelerando')),notes=game.getState().notes,at=notes.findIndex((note,index)=>!note.rest&&note.duration===.25&&notes[index+1]&&!notes[index+1].rest&&notes[index+1].duration===.25),first=notes[at],second=notes[at+1];assert.ok(first&&second);
 for(const note of notes.slice(0,at))if(!note.rest)assert.equal(game.tap(note.time).kind,'hit');
 const before=game.getState(),gap=(first.time+first.window+second.time-second.window)/2;
 assert.equal(game.tap(gap).kind,'extra');assert.equal(game.getState().hits,before.hits);assert.equal(game.getState().misses,before.misses+1);assert.equal(game.tap(second.time).kind,'hit');
});

test('pausing the supplied game clock freezes tempo, scoring and scheduled target times',()=>{
 const game=create(fishWith('ritardando')),initial=game.getState();advanceAlive(game,game.timeAtBeat(initial.tempo.startBeat+.5));const before=game.getState();
 for(let frame=0;frame<120;frame++)game.update(before.now);
 assert.deepEqual(game.getState(),before);
 const old=new Map(before.notes.map(note=>[note.id,note.time]));advanceAlive(game,game.timeAtBeat(initial.tempo.startBeat+1));
 for(const note of game.getState().notes)if(old.has(note.id))assert.equal(note.time,old.get(note.id),'Generated target times never shift as the tempo changes');
});

test('a preannounced advanced score remains playable at its original times for every eligible fish and meter',()=>{
 for(const fish of fishing.FISH.filter(fish=>fish.rarityRank>=2))for(const meter of fish.meters){
  const game=create(fish,meter),state=game.update(game.timeAtBeat(0)),endBeat=4*state.barBeats,planned=state.notes.filter(note=>!note.rest&&note.onset<endBeat);
  for(const note of planned)assert.equal(game.tap(note.time).kind,'hit',fish.id+' '+meter+' '+note.id);
  game.update(game.timeAtBeat(endBeat));
  const result=game.getState().result;assert.equal(result?.caught,true,fish.id+' '+meter);assert.equal(result.perfect,true);assert.equal(result.notes,fish.notes);assert.equal(result.xp,fish.xp);assert.equal(result.tempo.change,fish.tempo.change);
 }
});
