const test=require('node:test'),assert=require('node:assert/strict'),music=require('../fishing-music.js'),fishing=require('../rhythm-fishing-engine.js');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const score=(meter='4/4')=>({meter,phase:'playing',beat:0,musicStart:10,secondsPerBeat:60/76,quarterBpm:76,tempo:{change:'steady',startQuarterBpm:76,endQuarterBpm:76}});

test('each meter has its own musical pulse grouping and a softer answering accent',()=>{
 for(const [meter,barBeats,answer]of [['4/4',4,2],['6/8',3,1.5],['2/2',4,2]]){
  const events=music.plan(score(meter),{fromBeat:0,toBeat:barBeats}),bass=events.filter(e=>e.part==='bass');
  assert.ok(events.length>=20);assert.deepEqual(bass.map(e=>e.beat),[0,answer]);
  assert.ok(bass[0].volume>bass[1].volume);assert.equal(bass[0].accent,1);assert.equal(bass[1].accent,.72);
  assert.ok(events.every(event=>event.beat>=0&&event.beat<barBeats));
  assert.ok(events.some(event=>event.part==='chord')&&events.some(event=>event.part==='melody'));
  if(meter==='6/8')assert.deepEqual(events.filter(e=>e.part==='melody').map(e=>e.beat),[0,.5,1,1.5,2,2.5]);
 }
});

test('overlapping lookahead windows keep event identities, pitches and times unchanged',()=>{
 const state=score('6/8'),first=music.plan(state,{fromBeat:0,toBeat:8}),second=music.plan({...state,beat:4},{fromBeat:3,toBeat:10}),byId=new Map(first.map(event=>[event.id,event]));
 assert.equal(new Set(first.map(e=>e.id)).size,first.length);
 for(const event of second)if(byId.has(event.id))assert.deepEqual(event,byId.get(event.id));
 assert.ok(Object.isFrozen(first)&&first.every(Object.isFrozen));
 assert.ok(first.every(e=>e.frequency>0&&e.frequency<1400&&e.volume>0&&e.volume<=.378000001));
 assert.ok(first.every(e=>['sine','triangle'].includes(e.type)));
});

test('backing starts after the count-in, remains separate from guide notes, and respects lifecycle silence',()=>{
 const state={...score(),phase:'count-in',beat:-.2,startTime:10-4*60/76,countInSeconds:4*60/76};
 const events=music.plan(state,{fromBeat:-4,toBeat:2});assert.ok(events.length>0);assert.ok(events.every(event=>event.beat>=0&&event.time>=10));
 assert.deepEqual(music.plan({...state,beat:-3},{fromBeat:-4,toBeat:-1}),[]);
 assert.deepEqual(music.plan({...state,paused:true}),[]);assert.deepEqual(music.plan({...state,hiddenPause:true}),[]);
 for(const phase of ['caught','escaped','aborted'])assert.deepEqual(music.plan({...score(),phase}),[]);
 const original=score(),before=JSON.stringify(original),plain=music.plan(original,{fromBeat:0,toBeat:4});
 assert.deepEqual(music.plan({...original,notes:[{rest:true,onset:0,duration:4}]},{fromBeat:0,toBeat:4}),plain,'Accompaniment is independent of scored notes and still plays under written rests');
 assert.equal(JSON.stringify(original),before);
});

test('every changing-tempo music onset and held duration uses the exact integrated engine clock',()=>{
 for(const change of ['accelerando','ritardando'])for(const meter of ['4/4','6/8','2/2']){
  const fish=fishing.availableFish(meter).find(f=>f.rarityRank>=2&&f.tempo.change===change);
  if(!fish)continue;
  const game=fishing.createSession({fish,meter,startTime:1234}),state=game.getState(),from=state.tempo.startBeat-1,to=state.tempo.endBeat+2;
  const events=music.plan({...state,phase:'playing'},{fromBeat:from,toBeat:to,timeAtBeat:game.timeAtBeat});
  assert.ok(events.length>0);
  for(const event of events){close(event.time,game.timeAtBeat(event.beat));close(event.durationSeconds,game.timeAtBeat(event.beat+event.durationBeats)-game.timeAtBeat(event.beat));}
  const crossing=events.find(event=>event.beat<state.tempo.startBeat&&event.beat+event.durationBeats>state.tempo.startBeat);
  if(crossing)assert.ok(crossing.durationSeconds>0);
  assert.deepEqual(music.plan({...state,phase:'playing'},{fromBeat:0,toBeat:4}),[],'A changing tempo must never fall back to a linear guessed clock');
 }
});

test('legendary fish retain a clear melody and stable arrangement and planning cannot expand without bounds',()=>{
 for(const meter of ['4/4','6/8','2/2']){
  const fish=fishing.availableFish(meter).find(f=>f.rarity==='legendary'),game=fishing.createSession({fish,meter}),state=game.getState(),bar=state.barBeats;
  const events=music.plan(state,{fromBeat:0,toBeat:bar,timeAtBeat:game.timeAtBeat});assert.ok(events.filter(e=>e.part==='melody').length>=3);
  const later=music.plan({...state,tempo:{...state.tempo,currentQuarterBpm:192}},{fromBeat:0,toBeat:bar,timeAtBeat:game.timeAtBeat});assert.deepEqual(later,events);
  assert.ok(music.plan(state,{fromBeat:0,toBeat:1e9,timeAtBeat:game.timeAtBeat}).length<=8*24);
 }
 const info=music.getThemeInfo();assert.equal(info.bars,16);assert.ok(Object.isFrozen(info)&&Object.isFrozen(info.progression));
 assert.equal(info.progression.length,4);assert.equal(music.frequency(69),440);
});

test('exploration stays gentle and invalid inputs cannot schedule broken oscillators',()=>{
 const state=score(),battle=music.plan(state,{fromBeat:0,toBeat:4}),explore=music.plan({...state,phase:'explore'},{mode:'explore',fromBeat:0,toBeat:4});
 assert.equal(explore.length,battle.length);for(let i=0;i<battle.length;i++)assert.ok(explore[i].volume<battle[i].volume);
 for(const options of [{timeAtBeat:()=>NaN},{timeAtBeat:()=>0},{fromBeat:10,toBeat:0},{mode:'unknown'}])assert.deepEqual(music.plan(state,options),[]);
 assert.deepEqual(music.plan({...state,meter:'__proto__'}),[]);
 assert.deepEqual(music.plan(null),[]);assert.deepEqual(music.plan(state,null),[]);
});


test('fish families have distinct original arrangements fixed for each encounter',()=>{
 const themes=new Set(),scores=new Set();
 for(const fish of fishing.FISH){
  const meter=fish.meters[0],game=fishing.createSession({fish,meter}),state=game.getState();
  const info=music.getThemeInfo(fish),events=music.plan(state,{fromBeat:0,toBeat:state.barBeats*2,timeAtBeat:game.timeAtBeat});
  themes.add(info.id);scores.add(events.map(e=>e.midi+':'+e.type).join(','));
  assert.ok(events.length>0);assert.equal(info.bars,16);assert.ok(info.title&&info.credit.includes('Original'));
  assert.ok(events.every(e=>e.theme===info.id&&e.frequency>50&&e.frequency<2400));
  assert.deepEqual(music.plan({...state,fish:{...fish}},{fromBeat:0,toBeat:state.barBeats*2,timeAtBeat:game.timeAtBeat}),events);
 }
 assert.ok(themes.size>=6,'Fish families should offer clearly different musical themes');
 assert.ok(scores.size>=18,'Species should vary pitches or motifs within their family');
});

test('music gain is audible with headroom and never changes the metronome clock',()=>{
 const state=score(),events=music.plan(state,{fromBeat:0,toBeat:4});
 const downbeat=events.filter(e=>e.beat===0);
 assert.ok(downbeat.find(e=>e.part==='bass').volume>=.3,'Bass needs substantially more than the old .12 peak');
 assert.ok(downbeat.reduce((sum,e)=>sum+e.volume,0)*.13<.2,'The mixed downbeat retains output headroom');
 assert.ok(events.filter(e=>e.part==='melody').every(e=>e.volume>.13),'The melody should be audible above its old .05 peak');
 assert.equal(events[0].time,state.musicStart);
});

test('six-eight accompaniment divides each dotted-quarter pulse into three eighths',()=>{
 const events=music.plan(score('6/8'),{fromBeat:0,toBeat:3});
 assert.deepEqual([...new Set(events.map(e=>e.beat))],[0,.5,1,1.5,2,2.5]);
 assert.deepEqual(events.filter(e=>e.part==='bass').map(e=>e.beat),[0,1.5]);
 assert.ok(events.filter(e=>e.part==='arpeggio').every(e=>e.durationBeats<.5));
});

test('counting syllables follow simple, compound and cut-time beat units',()=>{
 assert.deepEqual([0,.25,.5,.75,1].map(beat=>fishing.countingAt('4/4',beat)),['1','e','&','a','2']);
 assert.deepEqual([0,.5,1,1.5,2,2.5,3].map(beat=>fishing.countingAt('6/8',beat)),['1','la','li','2','la','li','1']);
 assert.deepEqual([0,1,2,3,4].map(beat=>fishing.countingAt('2/2',beat)),['1','&','2','&','1']);
 assert.equal(fishing.countingAt('unknown',0),'');assert.equal(fishing.countingAt('6/8',-1),'');
});

 test('sixteen-bar phrases develop and resolve with strong downbeats in every meter',()=>{
 for(const meter of ['4/4','6/8','2/2']){
  const bar=meter==='6/8'?3:4;
  const events=[...music.plan(score(meter),{fromBeat:0,toBeat:bar*8}),...music.plan(score(meter),{fromBeat:bar*8,toBeat:bar*16})];
  for(let n=0;n<16;n++){
   const notes=events.filter(e=>e.bar===n),lead=notes.filter(e=>e.part==='melody');
   assert.ok(lead.length>=4);assert.ok(new Set(lead.map(e=>e.midi)).size>=2);
   const drums=notes.filter(e=>e.part==='drum');assert.equal(drums[0].beat,n*bar);assert.ok(drums[0].volume>drums[1].volume);
  }
  assert.notDeepEqual(events.filter(e=>e.bar===0&&e.part==='melody').map(e=>e.midi),events.filter(e=>e.bar===8&&e.part==='melody').map(e=>e.midi));
 }
});

test('Reedwater names and running eighths follow duple reel or compound jig meter',()=>{
 const fish={id:'reel-fixture',shape:'ordinary',rarity:'common'};
 assert.equal(music.getThemeInfo(fish,'4/4').title,'Reedwater Reel');
 assert.equal(music.getThemeInfo(fish,'6/8').title,'Reedwater Jig');
 for(const [meter,count]of [['4/4',8],['2/2',8],['6/8',6]]){
  const events=music.plan({...score(meter),fish},{fromBeat:0,toBeat:meter==='6/8'?3:4});
  assert.deepEqual(events.filter(e=>e.part==='melody').map(e=>e.beat),Array.from({length:count},(_,i)=>i*.5));
 }
 assert.equal(music.getThemeInfo({id:'prism',shape:'round'},'4/4').title,'Prism Ripples');
});
