const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('../rhythm-meter.js');

// Exercise every actual selectable building block, including mixed-note blocks.
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const blockDeclaration=html.match(/const blocks=(\[[\s\S]*?\n\]);/);
assert.ok(blockDeclaration,'The selectable rhythm catalog is present');
const context={};vm.runInNewContext('this.blocks='+blockDeclaration[1],context);
const blocks=JSON.parse(JSON.stringify(context.blocks));
const select=(...ids)=>blocks.filter(block=>ids.includes(block.id));
function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function events(phrase){let beat=0;return phrase.flatMap(block=>block.notes.map(value=>{const note={beat,duration:Math.abs(value),rest:value<0,value};beat+=note.duration;return note;}));}
function assertPhrase(phrase,meter){
 const m=M.getMeter(meter),notes=events(phrase);
 assert.equal(notes.reduce((sum,note)=>sum+note.duration,0),m.phraseBeats);
 for(const note of notes){
  assert.equal(Math.floor((note.beat+.000001)/m.measureBeats),Math.floor((note.beat+note.duration-.000001)/m.measureBeats),'An individual written note/rest cannot cross a bar');
 }
 const combined=M.consolidateRests(notes,meter);
 assert.equal(combined.reduce((sum,note)=>sum+note.duration,0),m.phraseBeats);
 assert.deepEqual(combined.filter(note=>!note.rest),notes.filter(note=>!note.rest),'Rest consolidation preserves every sounded onset and duration');
 for(const note of combined)assert.equal(Math.floor((note.beat+.000001)/m.measureBeats),Math.floor((note.beat+note.duration-.000001)/m.measureBeats),'Combined rests cannot cross a bar');
 for(const group of M.notationBeams(combined,meter)){
  assert.ok(group.length>1);
  const first=combined[group[0]],pulse=Math.floor((first.beat+.000001)/m.pulseBeats);
  for(const index of group){const note=combined[index];assert.equal(note.rest,false);assert.ok(note.duration<1);assert.equal(Math.floor((note.beat+.000001)/m.pulseBeats),pulse,'A beam never obscures a primary beat');}
 }
}

test('meters define actual note values and primary pulses, with a safe default',()=>{
 assert.deepEqual(Object.values(M.METERS).map(m=>[m.id,m.numerator,m.denominator,m.measureBeats,m.pulseBeats,m.pulsesPerMeasure,m.phraseBeats]),[
  ['4/4',4,4,4,1,4,8],['2/2',2,2,4,2,2,8],['6/8',6,8,3,1.5,2,6]
 ]);
 assert.equal(M.getMeter('unknown'),M.METERS['4/4']);assert.equal(M.getMeter({id:'6/8'}),M.METERS['6/8']);
 assert.ok(Object.isFrozen(M.METERS));assert.ok(Object.isFrozen(M.METERS['6/8']));
});

test('every fillable selected building block and mixed catalog produces two exact measures in each meter',()=>{
 let attempts=0;
 for(const meter of ['4/4','2/2','6/8']){
  const m=M.getMeter(meter),random=rng(475);
  const selections=[...blocks.map(block=>[block]),blocks,select('quarter','eighths'),select('dotted-half','quarter'),select('dotted-quarter','eighth'),select('dotted-eighth','sixteenth')];
  for(let i=0;i<100;i++)selections.push(blocks.filter(()=>random()<.35));
  for(const selection of selections){
   const can=M.fillTable(M.expandedPool(selection,meter),meter);
   assert.equal(can.length,m.measureUnits+1);
   if(!can[m.measureUnits]){
    assert.throws(()=>M.generatePhrase(selection,random,meter),new RegExp(meter));continue;
   }
   for(let trial=0;trial<5;trial++){assertPhrase(M.generatePhrase(selection,random,meter),meter);attempts++;}
  }
 }
 assert.ok(attempts>1000,'Sample many selections and random choices, including rests and syncopations');
});

test('the new meters retain rhythmic variety without requiring incompatible long notes',()=>{
 assert.equal(M.generatePhrase(select('quarter'),()=>0,'6/8').length,6,'Three quarter-note durations fit each 6/8 measure');
 assert.equal(M.generatePhrase(select('eighths'),()=>0,'6/8').flatMap(b=>b.notes).length,12,'Paired eighth blocks still produce six eighth notes per measure');
 assert.equal(M.generatePhrase(select('sixteenths'),()=>0,'6/8').flatMap(b=>b.notes).length,24);
 assert.deepEqual(M.generatePhrase(select('half'),()=>0,'2/2').flatMap(b=>b.notes),[2,2,2,2]);
 assert.equal(M.expandedPool(select('whole','whole-rest'),'6/8').length,0);
 assert.throws(()=>M.generatePhrase(select('whole'),Math.random,'6/8'),/6\/8/);
 const compound=M.generatePhrase(select('dotted-quarter'),()=>0,'6/8').flatMap(b=>b.notes);
 assert.deepEqual(compound,[1.5,1.5,1.5,1.5]);
 assert.ok(M.expandedPool(select('quarter','eighth'),'4/4').some(b=>b.syncopation));
 assert.ok(!M.expandedPool(select('quarter','eighth'),'6/8').some(b=>b.syncopation),'Do not import the simple-duple syncopation spelling into compound time');
});

test('the 6/8 catalog uses complete compound groups and pairs of sixteenths, with exactly four rest choices',()=>{
 const catalog=M.COMPOUND_BLOCKS,basic=catalog.filter(block=>block.group==='basic'),advanced=catalog.filter(block=>block.group==='advanced'),rests=catalog.filter(block=>block.group==='rests');
 assert.deepEqual(basic.map(block=>block.notes),[[3],[1.5],[.5,1],[1,.5],[.5,.5,.5]]);
 assert.equal(advanced.length,9);
 assert.deepEqual(rests.map(block=>block.name),['Dotted half rest','Dotted quarter rest','Quarter rest','Eighth rest']);
 for(const block of catalog){
  for(const notes of block.variants||[block.notes]){
   const duration=notes.reduce((sum,value)=>sum+Math.abs(value),0);assert.ok(duration===1.5||duration===3,block.id);
   let run=0;for(const value of [...notes,0]){if(value===.25)run++;else if(run){assert.ok([2,4,6].includes(run),block.id);run=0;}}
   assert.ok(notes.filter(value=>value<0).every(value=>[-3,-1.5,-1,-.5].includes(value)),'No sixteenth or dotted-eighth rests');
  }
 }
 const random=rng(92);
 for(const selection of [...catalog.map(block=>[block]),catalog])for(let trial=0;trial<10;trial++){
  const generated=M.generatePhrase(selection,random,'6/8');let beat=0;
  for(const block of generated){assert.ok(Math.abs(beat/1.5-Math.round(beat/1.5))<1e-8);const duration=block.notes.reduce((sum,value)=>sum+Math.abs(value),0);assert.ok(duration===1.5||duration===3);if(duration===3)assert.equal(beat%3,0);beat+=duration;}
  assert.equal(beat,6);assertPhrase(generated,'6/8');
 }
 const rest=M.consolidateRests([{beat:0,duration:3,value:-3,rest:true,keepRestValue:true}],'6/8');
 assert.equal(rest[0].value,-3,'A selected dotted half rest keeps its dotted-half picture');
});

test('beams show quarter, half-note, and dotted-quarter beats correctly and break at rests',()=>{
 const eighths=Array.from({length:12},(_,i)=>({beat:i*.5,duration:.5,rest:false}));
 assert.deepEqual(M.notationBeams(eighths.slice(0,8),'4/4'),[[0,1],[2,3],[4,5],[6,7]]);
 assert.deepEqual(M.notationBeams(eighths.slice(0,8),'2/2'),[[0,1,2,3],[4,5,6,7]]);
 assert.deepEqual(M.notationBeams(eighths,'6/8'),[[0,1,2],[3,4,5],[6,7,8],[9,10,11]]);
 eighths[1].rest=true;
 assert.deepEqual(M.notationBeams(eighths.slice(0,6),'6/8'),[[3,4,5]]);
 const separated=[{beat:0,duration:.25},{beat:.5,duration:.25}];
 assert.deepEqual(M.notationBeams(separated,'4/4'),[],'Never bridge a missing time span');
});

test('compound rests retain their performed duration and readable dotted-quarter groups',()=>{
 const full=Array.from({length:12},(_,i)=>({beat:i*.5,duration:.5,rest:true,value:-.5}));
 assert.deepEqual(M.consolidateRests(full,'6/8').map(n=>[n.beat,n.duration,n.value,n.fullMeasure]),[[0,3,-4,true],[3,3,-4,true]],'A whole-measure rest is not a four-quarter duration in6/8');
 const half=full.slice(0,3);
 assert.deepEqual(M.consolidateRests(half,'6/8').map(n=>[n.beat,n.duration,n.value]),[[0,1.5,-1.5]]);
 const acrossPulse=full.slice(1,5);
 assert.deepEqual(M.consolidateRests(acrossPulse,'6/8').map(n=>[n.beat,n.duration]),[[.5,1],[1.5,1]],'Partial-measure rests keep the two dotted-quarter beats visible');
});

test('counting offers 1& and1e&a, chooses the actual subdivision automatically, and can be hidden',()=>{
 assert.equal(M.countPattern([1,1,1,1],'4/4','auto').label,'1 2 3 4');
 assert.equal(M.countPattern([.5,.5,1,1,1],'4/4','auto').label,'1 & 2 & 3 & 4 &');
 assert.equal(M.countPattern([.25,.25,.25,.25,1,1,1],'4/4','auto').label,'1 e & a 2 e & a 3 e & a 4 e & a');
 assert.equal(M.countPattern([1.5,.5,1,1],'4/4','auto').subdivisions,2,'A dotted quarter requires the eighth-note grid even without a short sounded note');
 assert.equal(M.countPattern([.75,.25,1,1,1],'4/4','auto').subdivisions,4);
 assert.equal(M.countPattern([], '4/4','basic').label,'1 & 2 & 3 & 4 &');
 assert.equal(M.countPattern([], '4/4','fine').tokens.length,16);
 assert.deepEqual(M.countPattern([], '4/4','off'),{subdivisions:0,tokens:[],label:''});
 assert.equal(M.countAt(0,[],'4/4','off'),null);
});

test('cut time counts half-note pulses and compound time counts two groups of three',()=>{
 assert.equal(M.countPattern([2,2],'2/2').label,'1 2');
 assert.equal(M.countPattern([1,1,1,1],'2/2').label,'1 & 2 &');
 assert.equal(M.countPattern([.5,.5,1,2],'2/2').label,'1 e & a 2 e & a');
 assert.equal(M.countPattern([.25,.25,.5,1,2],'2/2').label,'1 ta e ta & ta a ta 2 ta e ta & ta a ta');
 assert.equal(M.countPattern([1.5,1.5],'6/8').label,'1 la li 2 la li');
 assert.equal(M.countPattern([.25,.25,.5,.5,1.5],'6/8').label,'1 & la & li & 2 & la & li &');
 assert.equal(M.countPattern([], '6/8','beats').label,'1 2');
 assert.equal(M.countPattern([], '6/8','basic').subdivisions,3);
 assert.equal(M.countPattern([], '6/8','fine').subdivisions,6);
 for(const meter of ['4/4','2/2','6/8']){
  const pattern=M.countPattern([],meter,'sixteenths'),m=M.getMeter(meter);
  for(const token of pattern.tokens){
   const current=M.countAt(token.beat+.001,[],meter,'sixteenths');
   assert.equal(current.text,token.text);assert.equal(current.index,token.index);
   assert.equal(current.measure,1);
   const repeated=M.countAt(token.beat+m.measureBeats+.001,[],meter,'sixteenths');
   assert.equal(repeated.text,token.text);assert.equal(repeated.measure,2);
  }
 }
});

test('timing tips describe the actual meter rather than hardcoded four quarter-note beats',()=>{
 assert.equal(M.beatLabel(2.5,'4/4'),'measure 1, beat 3 &');
 assert.equal(M.beatLabel(4.75,'4/4'),'measure 2, beat 1 a');
 assert.equal(M.beatLabel(2,'2/2'),'measure 1, beat 2');
 assert.equal(M.beatLabel(3,'2/2'),'measure 1, beat 2 &');
 assert.equal(M.beatLabel(.5,'6/8'),'measure 1, beat 1 la');
 assert.equal(M.beatLabel(2.5,'6/8'),'measure 1, beat 2 li');
 assert.equal(M.beatLabel(3,'6/8'),'measure 2, beat 1');
});

test('written rhythm counts use only actual short-note onsets, including the requested mixed bar',()=>{
 const values=[.5,.25,.25,.5,.5,.25,.25,.25,.25,.5,.5];
 const counted=M.rhythmCounts(values,'4/4');
 assert.deepEqual(counted.map(token=>token.text),['1','&','a','2','&','3','e','&','a','4','&']);
 assert.equal(counted.length,values.length,'Do not fill unused subdivisions with extra syllables');
 assert.deepEqual(counted.map(token=>token.beat),[0,.5,.75,1,1.5,2,2.25,2.5,2.75,3,3.5]);
 assert.ok(counted.every((token,index)=>token.index===index&&token.noteIndex===index&&!token.held&&!token.rest));
 assert.deepEqual(M.rhythmCounts([.75,.25,1,1,1],'4/4').map(token=>token.text),['1','a','2','3','4']);
});

test('long holds retain main-beat numbers without inventing unused subdivisions',()=>{
 const whole=M.rhythmCounts([4],'4/4');
 assert.deepEqual(whole.map(token=>[token.text,token.beat,token.held]),[['1',0,false],['2',1,true],['3',2,true],['4',3,true]]);
 assert.deepEqual(M.rhythmCounts([2,1,1],'4/4').map(token=>token.text),['1','2','3','4']);
 assert.deepEqual(M.rhythmCounts([3,1],'4/4').map(token=>token.text),['1','2','3','4']);
 assert.deepEqual(M.rhythmCounts([1.5,.5,2],'4/4').map(token=>token.text),['1','2','&','3','4']);
 assert.deepEqual(M.rhythmCounts([-4],'4/4').map(token=>[token.text,token.rest]),[['1',true],['2',true],['3',true],['4',true]]);
});

test('actual compound and cut-time counts keep their correct big-beat units',()=>{
 assert.deepEqual(M.rhythmCounts([.5,.5,.5,.5,.5,.5],'6/8').map(token=>token.text),['1','la','li','2','la','li']);
 assert.deepEqual(M.rhythmCounts([1,.5,1,.5],'6/8').map(token=>token.text),['1','li','2','li']);
 assert.deepEqual(M.rhythmCounts([3],'6/8').map(token=>[token.text,token.held]),[['1',false],['2',true]]);
 assert.deepEqual(M.rhythmCounts([2,2],'2/2').map(token=>[token.text,token.held]),[['1',false],['2',false]]);
 assert.deepEqual(M.rhythmCounts([4],'2/2').map(token=>[token.text,token.held]),[['1',false],['2',true]]);
 assert.deepEqual(M.rhythmCounts([1,1,1,1],'2/2').map(token=>token.text),['1','&','2','&']);
 assert.deepEqual(M.rhythmCounts([.5,.5,.5,.5,.5,.5,.5,.5],'2/2').map(token=>token.text),['1','e','&','a','2','e','&','a']);
});

test('rest onsets stay silent and repeated measures restart the appropriate count',()=>{
 const notes=[{beat:0,duration:1,rest:false},{beat:1,duration:.5,rest:true},{beat:1.5,duration:.5,rest:false},{beat:2,duration:2,rest:true},{beat:4,duration:4,rest:false}];
 const count=M.rhythmCounts(notes,'4/4');
 assert.deepEqual(count.map(token=>[token.text,token.rest]),[['1',false],['2',true],['&',false],['3',true],['4',true],['1',false],['2',false],['3',false],['4',false]]);
 assert.equal(count[4].held,true);assert.equal(count[4].noteIndex,3);
 assert.deepEqual(M.rhythmCounts([{notes:[1,.5]},{notes:[-.5,2]}],'4/4').map(token=>token.text),['1','2','&','3','4']);
});

test('browser and Node expose the same pure module without storage or network use',()=>{
 const window={};
 vm.runInNewContext(fs.readFileSync(require.resolve('../rhythm-meter.js'),'utf8'),{window});
 assert.equal(window.RhythmRoomMeter.getMeter('6/8').pulseBeats,1.5);
 assert.equal(window.RhythmRoomMeter.countPattern([.5],'4/4').label,M.countPattern([.5],'4/4').label);
});
