const test=require('node:test'),assert=require('node:assert/strict'),engine=require('../dance-rhythm-engine.js');
const timeFor=(game,beat)=>{const state=game.getState();return (state.chart.countInBeats+beat)*state.beatSeconds;};

test('seeded charts are repeatable, fill eight real 4/4 bars and keep rests separate from arrows',()=>{
 for(const difficulty of Object.keys(engine.DIFFICULTIES))for(let seed=0;seed<40;seed++){
  const chart=engine.generateChart({difficulty,seed});assert.deepEqual(chart,engine.generateChart({difficulty,seed}));
  assert.equal(chart.meter,'4/4');assert.equal(chart.bars,8);assert.equal(chart.totalBeats,32);assert.deepEqual(chart.barLines,[0,4,8,12,16,20,24,28,32]);
  assert.equal(new Set(chart.events.map(event=>event.id)).size,chart.events.length);
  for(let bar=0;bar<8;bar++){
   const events=chart.events.filter(event=>event.bar===bar);assert.equal(events[0].beat,bar*4);assert.equal(events.reduce((sum,event)=>sum+event.duration,0),4);
   for(const [index,event]of events.entries()){
    assert.equal(event.beat,event.onset);assert.equal(event.beatInBar,event.beat-bar*4);assert.ok(event.beatInBar+event.duration<=4);
    if(index)assert.equal(events[index-1].beat+events[index-1].duration,event.beat);
    if(event.rest)assert.equal(event.direction,null);else assert.ok(engine.DIRECTIONS.includes(event.direction));
   }
  }
  assert.equal(chart.notesTotal,chart.events.filter(event=>!event.rest).length);assert.ok(Object.isFrozen(chart)&&chart.events.every(Object.isFrozen));
 }
 assert.notDeepEqual(engine.generateChart({seed:'one'}),engine.generateChart({seed:'two'}));
});

test('each difficulty shuffles its whole rhythm vocabulary, with varied openings and no repeated neighboring bars',()=>{
 for(const difficulty of Object.keys(engine.DIFFICULTIES)){
  const openings=new Set(),sequences=new Set(),patterns=engine.PATTERNS[difficulty].map(pattern=>JSON.stringify(pattern));
  for(let index=0;index<80;index++){
   const seed='rhythm-variety-'+index;
   const chart=engine.generateChart({difficulty,seed});
   const bars=Array.from({length:chart.bars},(_,bar)=>JSON.stringify(chart.events.filter(event=>event.bar===bar).map(event=>event.rest?-event.duration:event.duration)));
   assert.ok(bars.every(pattern=>patterns.includes(pattern)),'Every randomized bar stays within its difficulty');
   for(let at=1;at<bars.length;at++)assert.notEqual(bars[at],bars[at-1],'A refilled bag must not repeat the preceding bar');
   for(let start=0;start+patterns.length<=bars.length;start+=patterns.length)assert.deepEqual([...new Set(bars.slice(start,start+patterns.length))].sort(),[...patterns].sort());
   openings.add(bars[0]);sequences.add(JSON.stringify(bars));
  }
  assert.equal(openings.size,patterns.length,'Every rhythm can open a dance; there is no fixed introduction');
  assert.ok(sequences.size>20,'Random seeds must change the rhythm order, not only the arrows');
 }
});

test('easy leaves space to learn; normal adds eighths; hard keeps its richer rhythms at a gentler 88 BPM',()=>{
 for(let seed=0;seed<40;seed++){
  const easy=engine.generateChart({difficulty:'easy',seed}),normal=engine.generateChart({difficulty:'normal',seed}),hard=engine.generateChart({difficulty:'hard',seed});
  assert.ok(easy.events.every(event=>event.duration===1));assert.ok(easy.events.filter(event=>event.rest).length>easy.notesTotal);
  assert.ok(normal.events.every(event=>[1,.5].includes(event.duration)));assert.ok(normal.events.some(event=>event.duration===.5&&!event.rest));
  assert.equal(hard.bpm,88);assert.equal(hard.beatSeconds,60/88);assert.ok(hard.events.some(event=>event.duration===.25));assert.ok(hard.events.some(event=>event.dots===1&&event.duration===1.5));
  assert.ok(hard.events.some(event=>event.beatInBar%1!==0&&event.duration>=1&&!event.rest),'A held note begins off the main beat');
  let run=0;for(const event of hard.events){if(event.duration===.25&&!event.rest)run++;else if(run){assert.ok([2,4,6].includes(run));run=0;}}if(run)assert.ok([2,4,6].includes(run));
 }
});

test('beam metadata joins real consecutive short notes within a beat, never rests or barlines',()=>{
 const chart=engine.generateChart({difficulty:'hard',seed:4}),groups=new Map();
 for(const event of chart.events){if(!event.beamGroup)continue;const group=groups.get(event.beamGroup)||[];group.push(event);groups.set(event.beamGroup,group);}
 assert.ok(groups.size>0);
 for(const events of groups.values()){
  assert.ok(events.length>=2);assert.ok(events.every(event=>!event.rest&&event.duration<1&&event.bar===events[0].bar&&Math.floor(event.beatInBar)===Math.floor(events[0].beatInBar)));
  for(let index=1;index<events.length;index++)assert.equal(events[index-1].beat+events[index-1].duration,events[index].beat);
  for(const event of events)assert.equal(event.beamLevel,event.duration===.25?2:1);
 }
 const loneEighth=chart.events.find(event=>event.duration===.5&&event.beatInBar===1.5&&event.beamGroup===null);assert.ok(loneEighth);assert.equal(loneEighth.beamLevel,1);
});

test('hard sixteenth runs share one arrow while other steps and new runs change direction',()=>{
 const sizes=new Set(),pairPositions=new Set();let mixedBeamGroups=0,beatBoundaries=0,barBoundaries=0;
 for(let seed=0;seed<128;seed++){
  const chart=engine.generateChart({difficulty:'hard',seed});let previous=null;
  const groups=[];let group=[];
  function finishGroup(){if(group.length){groups.push(group);group=[];}}
  for(const event of chart.events){
   if(event.rest){finishGroup();continue;}
   // A written beat or barline does not interrupt consecutive sixteenths.
   const sameSixteenthGroup=event.duration===.25&&previous?.duration===.25&&previous.beat+previous.duration===event.beat;
   if(previous){
    if(sameSixteenthGroup)assert.equal(event.direction,previous.direction,`Seed ${seed}: one sixteenth group must keep its arrow`);
    else assert.notEqual(event.direction,previous.direction,`Seed ${seed}: a new step or sixteenth run must still change direction`);
    if(previous.bar!==event.bar)barBoundaries++;
    else if(Math.floor(previous.beatInBar)!==Math.floor(event.beatInBar))beatBoundaries++;
   }
   if(event.duration===.25){if(!sameSixteenthGroup)finishGroup();group.push(event);}else finishGroup();
   previous=event;
  }
  finishGroup();
  for(const events of groups){
   sizes.add(events.length);assert.ok([2,4].includes(events.length));
   if(events.length===2)pairPositions.add(events[0].beatInBar%1);
   assert.equal(new Set(events.map(event=>event.direction)).size,1);
   const beam=chart.events.filter(event=>event.beamGroup===events[0].beamGroup);
   if(beam.some(event=>event.duration===.5)){
    mixedBeamGroups++;
    assert.ok(beam.some(event=>event.duration===.5&&event.direction!==events[0].direction),'A beamed eighth stays a separate step');
   }
  }
 }
 assert.deepEqual([...sizes].sort(),[2,4]);assert.deepEqual([...pairPositions].sort(),[0,.5]);
 assert.ok(mixedBeamGroups>0);assert.ok(beatBoundaries>0);assert.ok(barBoundaries>0);
});

test('four-count preparation says 1, 2, 3, GO and accepts an early first note without a premature penalty',()=>{
 const game=engine.create({difficulty:'easy',seed:3});assert.equal(game.getState().phase,'idle');assert.equal(game.input('left',0).ignored,true);
 game.start(0);const beat=game.getState().beatSeconds;
 for(const [index,label]of ['1','2','3','GO'].entries()){const state=game.update(index*beat).state;assert.equal(state.phase,'countin');assert.equal(state.countIn.label,label);assert.equal(state.countIn.index,index);}
 const untouched=game.input('left',3*beat+.1);assert.equal(untouched.ignored,true);assert.equal(untouched.state.misses,0);
 const first=game.getState().notes[0],hit=game.input(first.direction,timeFor(game,first.beat)-.12);assert.equal(hit.accepted,true);assert.equal(hit.events.at(-1).type,'hit');assert.equal(hit.state.hits,1);assert.equal(hit.state.misses,0);
 assert.equal(game.update(4*beat).state.phase,'playing');assert.equal(game.getState().countIn.active,false);
});

test('wrong direction and late notes each cost one mistake; corrections and repeated frames do not double-charge',()=>{
 const game=engine.create({difficulty:'normal',seed:7}),first=game.getState().notes[0];game.start(0);
 const wrong=engine.DIRECTIONS.find(direction=>direction!==first.direction);const miss=game.input(wrong,timeFor(game,first.beat));assert.equal(miss.state.misses,1);assert.equal(miss.state.notes[0].status,'wrong');
 assert.equal(game.input(first.direction,timeFor(game,first.beat+.02)).state.misses,1);assert.equal(game.update(timeFor(game,first.beat+.4)).state.misses,1);
 const next=game.getState().notes[1],late=timeFor(game,next.beat)+game.getState().window+.01;game.update(late);assert.equal(game.getState().misses,2);assert.equal(game.getState().lateMisses,1);
 const lateTap=game.input(next.direction,late+.005);assert.equal(lateTap.state.misses,2);assert.equal(lateTap.reason,'already-judged');
 for(let index=0;index<10;index++)game.update(late);assert.equal(game.getState().misses,2);
});

test('timing uses forgiving difficulty windows and nearest arrow, with accurate perfect/good counts',()=>{
 for(const difficulty of ['easy','normal','hard']){
  const game=engine.create({difficulty,seed:1});game.start(0);const {window,perfectWindow}=game.getState();assert.ok(window>=.14);
  const first=game.getState().notes[0];const good=game.input(first.direction,timeFor(game,first.beat)+window-.001);assert.equal(good.accepted,true);assert.equal(good.state.goodHits,1);assert.equal(good.state.score,70);
  const second=game.getState().notes[1];const perfect=game.input(second.direction,timeFor(game,second.beat)+perfectWindow/2);assert.equal(perfect.accepted,true);assert.equal(perfect.state.perfectHits,1);assert.equal(perfect.state.score,170);assert.equal(perfect.state.streak,2);
 }
 const game=engine.create({difficulty:'hard',seed:1});game.start(0);
 const notes=game.getState().notes,pair=notes.find((event,index)=>event.duration===.25&&notes[index+1]?.duration===.25),second=notes[notes.indexOf(pair)+1];
 const result=game.input(second.direction,timeFor(game,second.beat)-.02);assert.equal(result.accepted,true);assert.equal(result.noteId,second.id,'An overlapping timing window judges the nearest arrow');
});

test('perfect eight-bar performance completes once and produces a bounded result with no storage or audio',()=>{
 const events=[],game=engine.create({difficulty:'hard',seed:9,onEvent:event=>events.push(event)});game.start(0);
 for(const note of game.getState().notes)assert.equal(game.input(note.direction,timeFor(game,note.beat)).accepted,true);
 const result=game.update(timeFor(game,32));assert.equal(result.state.phase,'complete');assert.equal(result.state.complete,true);assert.equal(result.state.hits,result.state.chart.notesTotal);assert.equal(result.state.misses,0);assert.equal(result.state.accuracy,1);assert.equal(result.state.perfect,true);assert.equal(result.state.allPerfect,true);assert.equal(result.state.bestStreak,result.state.chart.notesTotal);
 assert.equal(result.state.score,result.state.chart.notesTotal*100);assert.equal(events.filter(event=>event.type==='complete').length,1);game.update(timeFor(game,40));game.input('left',timeFor(game,40));assert.equal(events.filter(event=>event.type==='complete').length,1);
});

test('untouched arrows miss once, rests never miss, and early finish/future clock jumps cannot leave pending arrows',()=>{
 const game=engine.create({difficulty:'easy',seed:2});game.start(20);const end=20+timeFor(game,32)+10;const result=game.update(end);
 assert.equal(result.state.misses,result.state.chart.notesTotal);assert.equal(result.state.hits,0);assert.equal(result.state.notesRemaining,0);assert.equal(result.state.accuracy,0);assert.equal(result.state.progress,1);
 assert.equal(result.events.filter(event=>event.type==='miss').length,result.state.chart.notesTotal);assert.equal(result.events.filter(event=>event.type==='complete').length,1);assert.equal(result.state.events.filter(event=>event.status==='rest').length,result.state.chart.events.filter(event=>event.rest).length);
});

test('repeat keys, invalid directions, callback failures, backwards clocks and destroy are safe',()=>{
 let now=5,hits=0,misses=0;const game=engine.create({difficulty:'normal',seed:2,now:()=>now,onEvent(){throw Error('UI failed');},onHit(){hits++;},onMiss(){misses++;}});game.start();
 const first=game.getState().notes[0];now=5+timeFor(game,first.beat);assert.equal(game.input(first.direction,now,{repeat:true}).reason,'repeat');assert.equal(game.getState().hits,0);assert.equal(game.input('bogus',now).reason,'direction');
 game.input(first.direction,now);assert.equal(hits,1);game.update(now-1);assert.equal(game.getState().hits,1);assert.equal(game.getState().misses,0);
 const second=game.getState().notes[1];now=5+timeFor(game,second.beat);game.input(engine.DIRECTIONS.find(value=>value!==second.direction),now);assert.equal(misses,1);
 const state=game.getState();state.notes[0].status='pending';state.events[0].status='pending';assert.equal(game.getState().notes[0].status,'hit','Snapshots cannot alter the active chart');
 game.destroy();const before=game.getState();game.input('left',now+100);game.update(now+100);game.start(now+100);assert.equal(game.getState().phase,'destroyed');assert.equal(game.getState().hits,before.hits);assert.equal(game.getState().misses,before.misses);
});
