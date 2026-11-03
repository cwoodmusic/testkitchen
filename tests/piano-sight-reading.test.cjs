const test=require('node:test'),assert=require('node:assert/strict'),reading=require('../piano-sight-reading.js');
function rng(){let seed=19;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};}
function correct(game){const state=game.snapshot();return game.answer(state.turn.notes[state.turn.index].midi);}
test('clock starts at ten, every correct pitch adds three, and each mistake costs one',()=>{
 const game=reading.create({random:rng()});assert.equal(game.snapshot().remaining,10);
 game.tick(2);const note=game.snapshot().turn.notes[0];assert.deepEqual(game.answer(note.midi+1),{ok:false,penalty:1,ended:false});assert.equal(game.snapshot().remaining,7);
 assert.equal(correct(game).bonus,3);assert.equal(game.snapshot().remaining,10);assert.equal(game.snapshot().score,1);
 game.tick(9.5);assert.equal(game.answer(game.snapshot().turn.notes[0].midi+1).ended,true);
 assert.equal(game.snapshot().remaining,0);assert.equal(game.snapshot().mistakes,2);assert.equal(correct(game).ok,false);assert.equal(game.snapshot().score,1);
});
test('progression changes precisely at answers 11, 21, 31, 41, and 51 for both clefs',()=>{
 for(const clef of ['bass','treble']){
  const game=reading.create({clef,random:rng()});
  for(let score=0;score<80;score++){
   const s=game.snapshot(),phase=Math.min(5,Math.floor(score/10));
   assert.equal(s.score,score);assert.equal(s.stage,phase+1);assert.equal(s.difficulty,reading.LEVELS[phase].id);
   assert.equal(s.turn.notes.length,phase===5?3:phase===4?2:1);
   if(score<20)assert.equal(s.turn.key,0);else assert.notEqual(s.turn.key,0);
   if(score<10)assert.ok(s.turn.notes.every(n=>!n.accidental&&n.alter===0));
   if(score===10)assert.ok(['sharp','flat'].includes(s.turn.notes[0].accidental));
   if(score<30)assert.ok(s.turn.notes.every(n=>n.accidental!=='natural'));
   if(score===30)assert.equal(s.turn.notes[0].accidental,'natural');
   const before=s.remaining;assert.equal(correct(game).bonus,3);assert.equal(game.snapshot().remaining,before+3);
  }
 }
});
test('all generated written pitches match reachable floor keys and accidental carry',()=>{
 const {paintedFloorKeys}=require('../piano-lab.js'),full=paintedFloorKeys().map(key=>60+key.offset);
 assert.equal(Math.min(...full),60);assert.equal(Math.max(...full),83);
 for(const playableMidis of [full,full.filter(midi=>[0,2,4,5,7,9,11].includes(midi%12))])for(const clef of ['treble','bass']){
  const game=reading.create({clef,playableMidis,random:rng()}),allowed=new Set(playableMidis);
  for(let turn=0;turn<500;turn++){
   const s=game.snapshot(),changes=new Map();
   for(const note of s.turn.notes){
    assert.ok(allowed.has(note.midi));assert.ok(note.midi>=60&&note.midi<=83);
    const natural=[0,2,4,5,7,9,11]['CDEFGAB'.indexOf(note.letter)],octave=Math.floor(note.diatonic/7);assert.equal(note.midi,12*(octave+1)+natural+note.alter);
    const prior=changes.has(note.diatonic)?changes.get(note.diatonic):s.turn.keyLetters.includes(note.letter)?Math.sign(s.turn.key):0;
    const heard=note.accidental?({sharp:1,flat:-1,natural:0})[note.accidental]:prior;assert.equal(heard,note.alter);changes.set(note.diatonic,heard);
    assert.equal(correct(game).ok,true);
   }
  }
 }
});
test('pairs and triples are ordered, bonuses apply per pitch, and mistakes preserve progress',()=>{
 const game=reading.create({random:rng()});for(let i=0;i<40;i++)correct(game);
 let s=game.snapshot();assert.equal(s.turn.notes.length,2);correct(game);assert.equal(game.snapshot().turn.index,1);
 s=game.snapshot();game.answer(s.turn.notes[1].midi+1);assert.equal(game.snapshot().turn.index,1);assert.equal(game.snapshot().score,41);
 while(game.snapshot().score<50)correct(game);assert.equal(game.snapshot().turn.notes.length,3);
 const notes=game.snapshot().turn.notes;for(let i=0;i<3;i++){const result=game.answer(notes[i].midi);assert.equal(result.complete,i===2);}
 assert.equal(game.snapshot().score,53);
 const copy=game.snapshot();copy.turn.notes[0].midi=-1;assert.notEqual(game.snapshot().turn.notes[0].midi,-1);
});
