const test=require('node:test'),assert=require('node:assert/strict');
const {LESSONS,lessonFor,parsePitch}=require('../piano-melodies.js');

test('all nine familiar melody IDs retain complete written measures and immutable pitch-only targets',()=>{
 assert.deepEqual(LESSONS.map(lesson=>lesson.id),['twinkle','mary','london-bridge','hot-cross-buns','row-your-boat','frere-jacques','ode-to-joy','jingle-bells','old-macdonald']);
 for(const lesson of LESSONS){
  assert.ok(Object.isFrozen(lesson));assert.ok(Object.isFrozen(lesson.events));assert.ok(Object.isFrozen(lesson.notes));
  assert.ok(lesson.events.every(Object.isFrozen));assert.ok(lesson.bars>=4);assert.equal(lesson.totalBeats,lesson.bars*lesson.barBeats);
  for(let bar=0;bar<lesson.bars;bar++)assert.equal(lesson.events.filter(event=>event.bar===bar).reduce((sum,event)=>sum+event.beats,0),lesson.barBeats,lesson.id+' bar '+bar);
  assert.deepEqual(lesson.notes,lesson.events.filter(event=>!event.rest).map(event=>event.midi-60));
  assert.deepEqual(lesson.events.filter(event=>!event.rest).map(event=>event.pitchIndex),lesson.notes.map((_,index)=>index));
  assert.ok(lesson.events.filter(event=>event.rest).every(event=>event.midi===null&&event.pitchIndex===null),'Rests never become pitch targets');
  assert.ok(lesson.range.max-lesson.range.min<=21,lesson.id+' fits a 22-semitone floor register');
  assert.ok(lesson.floorOffsets.every(offset=>Number.isInteger(offset)&&offset>=0&&offset<=21));
  assert.deepEqual(lesson.floorOffsets.map(offset=>offset+lesson.floorBaseMidi),lesson.events.filter(event=>!event.rest).map(event=>event.midi));
  assert.ok(lesson.notes.length>=8);assert.doesNotMatch(lesson.description,/\b[A-G][0-9]\b/);
 }
});

test('Frère Jacques has both low closing bell pitches and its real quarter/eighth/half rhythm',()=>{
 const lesson=lessonFor('frere-jacques');
 assert.deepEqual(lesson.notes.slice(-6),[0,-5,0,0,-5,0]);
 assert.deepEqual(lesson.events.filter(event=>event.bar>=6).map(event=>event.midi),[60,55,60,60,55,60]);
 assert.deepEqual(lesson.events.filter(event=>event.bar===4).map(event=>event.beats),[.5,.5,.5,.5,1,1]);
 assert.deepEqual(lesson.events.filter(event=>event.bar===6).map(event=>event.beats),[1,1,2]);
 assert.equal(lesson.range.min,55);assert.equal(lesson.range.max,69);assert.equal(lesson.floorBaseMidi,48);assert.equal(lesson.floorOctave,3);assert.deepEqual(lesson.floorOffsets.slice(-6),[12,7,12,12,7,12]);
});

test('compound Row Your Boat and the other familiar openings have their distinctive written rhythms',()=>{
 const row=lessonFor('row-your-boat');assert.equal(row.meter,'6/8');assert.equal(row.barBeats,3);assert.equal(row.bars,8);
 assert.deepEqual(row.events.filter(event=>event.bar===0).map(event=>event.beats),[1.5,1.5]);
 assert.deepEqual(row.events.filter(event=>event.bar===4).map(event=>event.midi),[72,72,72,67,67,67]);
 assert.deepEqual(row.events.filter(event=>event.bar===4).map(event=>event.beats),Array(6).fill(.5));
 assert.deepEqual(row.events.filter(event=>event.bar===4).map(event=>event.beamingGroup),Array(3).fill('melody-beam-4-0').concat(Array(3).fill('melody-beam-4-1')));
 assert.deepEqual(lessonFor('london-bridge').events.filter(event=>event.bar===0).map(event=>event.beats),[1.5,.5,1,1]);
 assert.deepEqual(lessonFor('hot-cross-buns').events.filter(event=>event.bar===2).map(event=>event.beats),Array(8).fill(.5));
 assert.deepEqual(lessonFor('ode-to-joy').events.filter(event=>event.bar===3).map(event=>event.beats),[1.5,.5,2]);
 assert.ok(LESSONS.flatMap(lesson=>lesson.events).some(event=>event.rest&&event.beats===1));
 assert.ok(LESSONS.flatMap(lesson=>lesson.events).some(event=>event.rest&&event.beats===1.5));
 assert.ok(LESSONS.flatMap(lesson=>lesson.events).some(event=>event.rest&&event.beats===2));
});

test('pitch parsing preserves register and names without changing a tune’s octave',()=>{
 assert.deepEqual(parsePitch('G3'),{midi:55,spelling:'G'});assert.deepEqual(parsePitch('C5'),{midi:72,spelling:'C'});
 assert.deepEqual(parsePitch('F#4'),{midi:66,spelling:'F♯'});assert.deepEqual(parsePitch('Bb4'),{midi:70,spelling:'B♭'});
 assert.throws(()=>parsePitch('C'),'register');assert.equal(lessonFor('unknown'),null);
});
