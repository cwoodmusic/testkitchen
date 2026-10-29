const test=require('node:test'),assert=require('node:assert/strict');
const fishing=require('../rhythm-fishing-engine.js');
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);
const create=(fish='silver-minnow',meter)=>fishing.createSession({fish,meter:meter||(fish==='silver-minnow'?'2/2':undefined),id:'hold-test',startTime:1234.5});
const next=game=>game.getState().notes.find(note=>note.judgement==='pending');

test('half notes and longer have exact hold tails; quarter and shorter notes remain discrete hits',()=>{
 const game=create(),first=next(game),initial=game.getState();
 assert.equal(first.requiresHold,true);close(first.holdEndTime,game.timeAtBeat(first.onset+first.duration));
 assert.equal(first.holdProgress,0);assert.equal(game.press(first.time,'pointer:1').kind,'hold-start');
 assert.equal(game.getState().hits,0);assert.equal(game.getState().progress,initial.progress);
 game.update(first.time+first.durationSeconds/2);
 close(game.getState().activeHolds[0].holdProgress,.5);
 assert.equal(game.getState().activeHolds[0].heldBy,'pointer:1');
 game.update(first.holdEndTime);
 assert.equal(game.getState().hits,1);close(game.getState().progress,48.4375);assert.equal(game.getState().activeHolds.length,0);
 assert.equal(game.getState().notes.find(note=>note.id===first.id).holdProgress,1);
 game.release(first.holdEndTime,'pointer:1');assert.equal(game.getState().extras,0);
 const shorter=create('cave-guppy'),short=shorter.getState().notes.find(note=>!note.rest&&note.duration===.5);
 for(const note of shorter.getState().notes.filter(note=>!note.rest&&note.time<short.time))shorter.tap(note.time);
 const before=shorter.getState();assert.equal(short.requiresHold,false);
 assert.equal(shorter.press(short.time,'pointer:2').kind,'hit');
 assert.equal(shorter.getState().hits,before.hits+1);shorter.release(short.time,'pointer:2');
 assert.equal(shorter.getState().activeHolds.length,0);assert.equal(shorter.getState().extras,0);
});

test('early release breaks a hold once and never awards it later',()=>{
 const game=create(),note=next(game);game.press(note.time,'key:Space');
 const released=game.release(note.time+note.durationSeconds*.3,'key:Space');
 assert.equal(released.kind,'hold-break');assert.equal(released.state.lastJudgement.kind,'hold-break');
 assert.equal(released.state.lastJudgement.resultKind,'miss');assert.equal(released.state.hits,0);
 assert.equal(released.state.misses,1);assert.equal(released.state.progress,38);
 assert.deepEqual(released.state.activeHolds,[]);assert.deepEqual(released.state.pressedSources,[]);
 game.update(note.holdEndTime);assert.equal(game.getState().misses,1);assert.equal(game.getState().hits,0);
 assert.equal(game.release(note.holdEndTime,'key:Space').accepted,false);
 assert.equal(game.getState().notes.find(item=>item.id===note.id).holdBroken,true);
});

test('a forgiving tail release is accepted but cannot pay before the actual tail',()=>{
 const game=create(),note=next(game);game.press(note.time,'pointer:3');
 const releasedAt=note.holdEndTime-note.holdReleaseWindow/2;
 const release=game.release(releasedAt,'pointer:3');assert.equal(release.kind,'hold-release');
 assert.equal(release.state.hits,0);assert.equal(release.state.misses,0);assert.equal(release.state.progress,45);
 assert.equal(release.state.activeHolds[0].holdReleased,true);
 game.update(note.holdEndTime-.0001);assert.equal(game.getState().hits,0);
 game.update(note.holdEndTime);assert.equal(game.getState().hits,1);close(game.getState().progress,48.4375);
});

test('one held source cannot repeat into another note while alternating fingers can',()=>{
 const game=create(),first=next(game);game.press(first.time,'pointer:1');game.update(first.holdEndTime);
 const second=next(game),before=game.getState();assert.equal(second.time,first.holdEndTime);
 const repeated=game.press(second.time,'pointer:1');assert.equal(repeated.kind,'held-source');assert.equal(repeated.accepted,false);
 assert.equal(repeated.state.hits,before.hits);assert.equal(repeated.state.extras,0);
 assert.equal(game.press(second.time,'pointer:2').kind,'hold-start');
 assert.equal(game.release(second.time,'pointer:1').kind,'released');
 assert.equal(game.getState().activeHolds[0].heldBy,'pointer:2');
 game.update(second.holdEndTime);assert.equal(game.getState().hits,2);assert.equal(game.getState().misses,0);
 game.release(second.holdEndTime,'pointer:2');assert.deepEqual(game.getState().pressedSources,[]);
});

test('rapid short notes require distinct presses without a tap-rate debounce',()=>{
 const game=create('luminous-dragonfish'),state=game.getState(),notes=state.notes;
 const at=notes.findIndex((note,index)=>!note.rest&&note.duration===.25&&notes[index+1]&&!notes[index+1].rest&&notes[index+1].duration<1);
 assert.ok(at>=0);for(const note of notes.slice(0,at))if(!note.rest)game.tap(note.time);
 const a=notes[at],b=notes[at+1],before=game.getState().hits;
 assert.equal(game.press(a.time,'pointer:10').kind,'hit');
 assert.equal(game.press(b.time,'pointer:11').kind,'hit');
 assert.equal(game.getState().hits,before+2);assert.equal(game.getState().extras,0);
 game.release(b.time,'pointer:10');game.release(b.time,'pointer:11');assert.deepEqual(game.getState().pressedSources,[]);
});

test('holds use integrated musical tails during authored tempo ramps',()=>{
 for(const change of ['accelerando','ritardando']){
  let choice=null;
  for(const fish of fishing.FISH.filter(fish=>fish.rarityRank>=2&&fish.tempo.change===change))for(const meter of fish.meters){
   const game=create(fish,meter),state=game.getState(),note=state.notes.find(note=>note.requiresHold&&note.onset>=state.tempo.startBeat&&note.onset<state.tempo.endBeat);
   if(note&&!choice)choice={game,note,state};
  }
  if(!choice){
   // Current ritardando phrases contain quarter/dotted-quarter notes only.
   // Their written lengths remain taps rather than inventing half-note holds.
   const fish=fishing.FISH.find(fish=>fish.tempo.change===change),game=create(fish);
   assert.ok(game.getState().notes.filter(note=>!note.rest).every(note=>!note.requiresHold));continue;
  }
  const {game,note,state}=choice;
  for(const prior of game.getState().notes.filter(prior=>!prior.rest&&prior.time<note.time))game.tap(prior.time);
  assert.equal(game.press(note.time,'key:Enter').kind,'hold-start');
  close(note.holdEndTime,game.timeAtBeat(note.onset+note.duration));
  assert.notEqual(note.durationSeconds,note.duration*60/state.tempo.startQuarterBpm);
  const hits=game.getState().hits;game.update(note.holdEndTime-.0001);assert.equal(game.getState().hits,hits);
  game.update(note.holdEndTime);assert.equal(game.getState().hits,hits+1);game.release(note.holdEndTime,'key:Enter');
 }
});

test('paused clocks and detached physical sources preserve a hold without a penalty',()=>{
 const game=create(),note=next(game);game.press(note.time,'pointer:1');game.update(note.time+note.durationSeconds*.4);
 const detached=game.releaseAllSources({preserveHolds:true});assert.deepEqual(detached.pressedSources,[]);
 assert.equal(detached.activeHolds[0].heldBy,null);assert.equal(detached.activeHolds[0].holdLatched,true);
 for(let frame=0;frame<120;frame++)game.update(detached.now);
 assert.deepEqual(game.getState(),detached);
 assert.equal(game.press(detached.now,'pointer:2').kind,'hold-resume');
 game.update(note.holdEndTime);assert.equal(game.getState().hits,1);assert.equal(game.getState().misses,0);
 game.release(note.holdEndTime,'pointer:2');
 const latched=create(),other=next(latched);latched.press(other.time,'key:Space');latched.releaseAllSources({preserveHolds:true});latched.update(other.holdEndTime);
 assert.equal(latched.getState().hits,1,'A paused hold may continue without an OS-held finger');
 assert.equal(latched.getState().misses,0);
});

test('rest presses and cancellation do not create held targets or repeated penalties',()=>{
 const game=create('rainbow-trout','2/2'),first=next(game);game.press(first.time,'pointer:1');game.update(first.holdEndTime);game.release(first.holdEndTime,'pointer:1');
 const rest=game.getState().notes.find(note=>note.rest&&note.time>=game.getState().now),middle=rest.time+rest.durationSeconds/2;
 const before=game.update(middle);assert.equal(before.hits,1);assert.equal(before.misses,0);
 const press=game.press(middle,'pointer:2');assert.equal(press.kind,'extra');assert.equal(press.state.activeHolds.length,0);
 const extras=press.state.extras;game.press(middle,'pointer:2');game.release(middle,'pointer:2');assert.equal(game.getState().extras,extras);
 const canceled=create(),note=next(canceled);canceled.press(note.time,'pointer:7');
 const final=canceled.abort();assert.equal(final.result.caught,false);assert.equal(final.result.notes,0);assert.equal(final.result.xp,0);
 assert.deepEqual(final.activeHolds,[]);assert.deepEqual(final.pressedSources,[]);assert.equal(final.hits,0);
});

test('all authored species and eligible meters can be caught with actual press/hold/release gestures',()=>{
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  const game=create(fish,meter);
  for(let index=0;index<100&&!game.getState().result;index++){
   const note=next(game);assert.ok(note);const source='pointer:'+index%2;
   game.update(note.time);if(game.getState().result)break;
   const pressed=game.press(note.time,source);assert.equal(pressed.kind,note.requiresHold?'hold-start':'hit',fish.id+' '+meter);
   if(note.requiresHold)game.update(note.holdEndTime);
   game.release(note.requiresHold?note.holdEndTime:note.time,source);
  }
  const result=game.getState().result;assert.equal(result?.caught,true,fish.id+' '+meter);assert.equal(result.perfect,true);
  assert.equal(result.notes,fish.notes);assert.equal(result.xp,fish.xp);assert.deepEqual(game.getState().activeHolds,[]);
 }
});

test('invalid source or time cannot change scoring, and discrete assistive activation remains supported',()=>{
 const game=create(),before=game.getState();
 for(const [time,source]of [[NaN,'x'],[Infinity,'x'],[before.now-1,'x'],[before.now,{}],[before.now,''],[before.now,'x'.repeat(101)]])assert.equal(game.press(time,source).accepted,false);
 assert.deepEqual(game.getState(),before);
 const note=next(game);assert.equal(game.tap(note.time).kind,'hit');assert.equal(game.getState().hits,1);assert.deepEqual(game.getState().activeHolds,[]);
});

test('quarter and dotted-quarter notes are immediate taps in every meter',()=>{
 for(const meter of ['4/4','6/8','2/2']){
  const game=create('silver-minnow',meter),quarter=game.getState().notes.find(note=>!note.rest&&note.duration===1);
  if(quarter){
   for(const prior of game.getState().notes.filter(note=>!note.rest&&note.time<quarter.time))game.tap(prior.time);
   const before=game.getState().hits;
   assert.equal(quarter.requiresHold,false);assert.equal(quarter.holdEndTime,null);
   assert.equal(game.press(quarter.time,'key:Space').kind,'hit');game.release(quarter.time,'key:Space');
   assert.equal(game.getState().hits,before+1);assert.deepEqual(game.getState().activeHolds,[]);
  }
 }
 const compound=create('silver-minnow','6/8'),dotted=next(compound);
 assert.equal(dotted.duration,1.5);assert.equal(dotted.requiresHold,false);
 assert.equal(compound.press(dotted.time,'pointer:1').kind,'hit');compound.release(dotted.time,'pointer:1');
 assert.equal(compound.getState().hits,1);assert.deepEqual(compound.getState().activeHolds,[]);
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  for(const note of create(fish,meter).getState().notes)assert.equal(note.requiresHold,!note.rest&&note.duration>=2,fish.id+' '+meter+' '+note.token);
 }
});

function primeBefore(game,target){
 for(const prior of game.getState().notes.filter(note=>!note.rest&&note.time<target.time)){
  game.tap(prior.time);
  // Keep long ramp fixtures in play rather than winning before their hold.
  if(game.getState().progress>70)game.tap(prior.time);
 }
 assert.equal(game.getState().result,null);
}

test('one finger gets a real release gap before the next half or short note',()=>{
 for(const [fish,meter]of [['silver-minnow','2/2'],['copper-catfish','4/4'],['amethyst-koi','2/2']]){
  const game=create(fish,meter),notes=game.getState().notes,at=notes.findIndex((note,index)=>note.requiresHold&&!notes[index+1]?.rest&&notes[index+1]?.holdTransitionFrom===note.id),held=notes[at],following=notes[at+1];
  assert.ok(held);primeBefore(game,held);const before=game.getState();
  assert.equal(game.press(held.time,'pointer:1').kind,'hold-start');
  assert.equal(game.release(held.holdEndTime-.16,'pointer:1').kind,'hold-release');
  assert.equal(game.getState().hits,before.hits,'Early release must not pay before the written tail');
  assert.deepEqual(game.getState().pressedSources,[]);
  const extendsHead=following.transitionLateWindow>following.window+1e-8,late=following.time+(extendsHead?(following.window+following.transitionLateWindow)/2:following.window*.75);
  assert.equal(game.press(late,'pointer:1').kind,following.requiresHold?'hold-start':'hit');
  assert.equal(game.getState().misses,before.misses);assert.equal(game.getState().extras,before.extras);
  assert.equal(game.getState().hits,before.hits+(following.requiresHold?1:2));
  const target=game.getState().notes.find(note=>note.id===following.id);
  assert.equal(target.holdTransitionFrom,held.id);assert.ok(target.lateWindow>=following.window);
  if(extendsHead)assert.ok(late-following.time>following.window,'This must exercise a late press outside the ordinary head window');
  if(following.requiresHold){game.update(following.holdEndTime);assert.equal(game.getState().hits,before.hits+2);}
  game.release(following.requiresHold?following.holdEndTime:late,'pointer:1');
 }
});

test('release grace has an exact boundary and missed or assistive holds grant no late extension',()=>{
 for(const delta of [0,-.00001]){
  const game=create(),held=next(game);game.press(held.time,'key:Space');
  const release=game.release(held.holdEndTime-held.holdReleaseWindow+delta,'key:Space');
  assert.equal(release.kind,delta===0?'hold-release':'hold-break');
  assert.equal(release.state.hits,0);game.update(held.holdEndTime);
  assert.equal(game.getState().hits,delta===0?1:0);assert.equal(game.getState().misses,delta===0?0:1);
 }
 for(const physical of [false,true]){
  const game=create('amethyst-koi','2/2'),notes=game.getState().notes,at=notes.findIndex((note,index)=>note.requiresHold&&notes[index+1]?.holdTransitionFrom===note.id),held=notes[at],following=notes[at+1];
  primeBefore(game,held);
  if(physical){game.press(held.time,'pointer:1');game.release(held.holdEndTime-held.holdReleaseWindow-.001,'pointer:1');}
  else game.tap(held.time);
  const before=game.getState();
  assert.equal(game.getState().notes.find(note=>note.id===following.id).lateWindow,following.window);
  const outcome=game.press(following.time+(following.window+following.transitionLateWindow)/2,'pointer:1');assert.equal(outcome.kind,'extra');
  assert.equal(outcome.state.hits,before.hits);assert.equal(outcome.state.misses,before.misses+1);
  assert.equal(outcome.state.extras,before.extras+1);
 }
});

test('transition grace stays separated from following notes and never crosses a rest',()=>{
 let transitions=0;
 for(const fish of fishing.FISH)for(const meter of fish.meters){
  const notes=create(fish,meter).getState().notes;
  for(let index=0;index<notes.length-1;index++){
   const note=notes[index],following=notes[index+1];
   if(note.holdTransitionFrom){
    transitions++;assert.equal(note.rest,false);
    assert.ok(note.transitionLateWindow+following.window<following.time-note.time,'Grace windows must not steal the following note or rest');
   }
   if(note.rest)assert.equal(note.holdTransitionFrom,null);
  }
 }
 assert.ok(transitions>10);
 const game=create('rainbow-trout','2/2'),held=next(game);game.press(held.time,'pointer:1');game.release(held.holdEndTime-.16,'pointer:1');game.update(held.holdEndTime);
 const rest=game.getState().notes.find(note=>note.rest&&note.time>=held.holdEndTime),before=game.getState();
 assert.equal(game.press(rest.time+rest.durationSeconds/2,'pointer:1').kind,'extra');
 assert.equal(game.getState().hits,before.hits);assert.equal(game.getState().extras,before.extras+1);
});

test('early release and late re-press remain aligned through an accelerating tempo map',()=>{
 const game=create('ruby-lionfish','2/2'),initial=game.getState(),notes=initial.notes,at=notes.findIndex((note,index)=>note.requiresHold&&note.onset>=initial.tempo.startBeat&&note.onset<initial.tempo.endBeat&&notes[index+1]?.holdTransitionFrom===note.id),held=notes[at],following=notes[at+1];
 assert.ok(held);primeBefore(game,held);const before=game.getState();
 game.press(held.time,'key:Space');assert.equal(game.release(held.holdEndTime-.16,'key:Space').kind,'hold-release');
 assert.equal(held.holdEndTime,game.timeAtBeat(held.onset+held.duration));
 assert.equal(following.time,held.holdEndTime);assert.notEqual(held.durationSeconds,held.duration*60/initial.tempo.startQuarterBpm);
 assert.equal(game.press(following.time+.12,'key:Space').kind,'hit');game.release(following.time+.12,'key:Space');
 assert.equal(game.getState().hits,before.hits+2);assert.equal(game.getState().misses,before.misses);assert.equal(game.getState().extras,before.extras);
});
