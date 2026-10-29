const test=require('node:test'),assert=require('node:assert/strict');
const {LESSONS,lessonFor}=require('../piano-melodies.js');
const {fitMelodyRegister}=require('../piano-lab.js');
const wall=require('../piano-wall-notation.js');
const score=(lesson,step=0,extra={})=>wall.createScore({events:lesson.events,step,meter:lesson.meter,label:lesson.name,...extra});

test('automatic melody registers reach every actual pitch without wrapping the lower Frère bell',()=>{
 for(const lesson of LESSONS){
  const register=fitMelodyRegister(lesson);assert.ok(register,lesson.id);
  assert.ok(register.notes.every(offset=>offset>=0&&offset<=21));
  assert.deepEqual(register.notes.map(offset=>register.baseMidi+offset),lesson.events.filter(event=>!event.rest).map(event=>event.midi));
 }
 const bell=fitMelodyRegister(lessonFor('frere-jacques'));
 assert.equal(bell.baseMidi,48);assert.equal(bell.octave,3);assert.equal(bell.first,60);
 assert.deepEqual(bell.pitches.slice(-6),[60,55,60,60,55,60]);
 assert.deepEqual(bell.notes.slice(-6),[12,7,12,12,7,12]);
 assert.equal(fitMelodyRegister({notes:[-20,30]}),null,'An impossible range is rejected instead of clipped');
});

test('written note values, dots and rests belong to exact measures while pitch progress skips rests',()=>{
 for(const lesson of LESSONS)for(let step=0;step<lesson.notes.length;step++){
  const page=score(lesson,step);
  assert.equal(page.total,lesson.notes.length);assert.ok(page.events.length);
  assert.ok(page.events.every(event=>event.onset>=page.startBeat&&event.onset<page.endBeat));
  assert.ok(Math.abs(page.events.reduce((sum,event)=>sum+event.beats,0)-page.barBeats)<1e-8,lesson.id+' bar '+page.bar);
  assert.deepEqual(page.barLines,[page.startBeat,page.endBeat]);
  assert.equal(page.notes.find(note=>note.status==='current').midi,60+lesson.notes[step]);
  assert.ok(page.events.filter(event=>event.rest).every(event=>event.noteIndex===null&&event.status!=='current'));
 }
 const frere=score(lessonFor('frere-jacques'),8);assert.equal(frere.notes.at(-1).beats,2);assert.match(frere.notes.at(-1).glyph,/noteHalf/);
 const london=score(lessonFor('london-bridge'));assert.equal(london.notes[0].beats,1.5);assert.equal(london.notes[0].dots,1);
 const jingle=score(lessonFor('jingle-bells'));assert.equal(jingle.events.at(-1).rest,true);assert.equal(jingle.events.at(-1).glyph,'restQuarter');
 const oldMac=score(lessonFor('old-macdonald'),11);assert.equal(oldMac.events.at(-1).glyph,'restHalf');
});

test('eighths beam by meter beats and remain separated by rests',()=>{
 const frere=score(lessonFor('frere-jacques'),14);
 assert.deepEqual(frere.notes.map(note=>note.beats),[.5,.5,.5,.5,1,1]);
 assert.ok(frere.notes.slice(0,4).every(note=>note.beamed));
 assert.equal(frere.notes[0].beamGroup,frere.notes[1].beamGroup);
 assert.equal(frere.notes[2].beamGroup,frere.notes[3].beamGroup);
 assert.notEqual(frere.notes[0].beamGroup,frere.notes[2].beamGroup);
 const row=score(lessonFor('row-your-boat'),10);assert.equal(row.meter,'6/8');assert.equal(row.events.length,6);
 assert.equal(row.notes[0].beamGroup,row.notes[2].beamGroup);assert.notEqual(row.notes[2].beamGroup,row.notes[3].beamGroup);
 const interrupted=wall.createScore({events:[{midi:60,beats:.5},{midi:null,rest:true,beats:.5},{midi:62,beats:.5},{midi:64,beats:.5},{midi:65,beats:2}],step:0});
 assert.equal(interrupted.notes[0].beamed,undefined);assert.equal(interrupted.notes[1].beamGroup,interrupted.notes[2].beamGroup);
});

test('memory notation reveals only completed pitches and past rests, never the next target',()=>{
 const jingle=lessonFor('jingle-bells');
 const empty=score(jingle,0,{mode:'memory'});assert.deepEqual(empty.events,[]);
 const early=score(jingle,2,{mode:'memory'});assert.deepEqual(early.notes.map(note=>note.midi),[64,64]);assert.ok(early.events.every(event=>!event.rest));
 const later=score(jingle,4,{mode:'memory'});assert.equal(later.notes.length,1,'Only the played pitch in this completed measure window is shown');
 assert.equal(later.notes[0].noteIndex,3);assert.ok(later.events.every(event=>event.rest||event.noteIndex<4));
});

test('the canvas paints genuine rests, dotted notes, beamed noteheads, and meter digits',()=>{
 const ink=[],rects=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(...args){rects.push(args);},strokeRect(){},translate(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(text){ink.push(String(text).codePointAt(0));}};
 for(const [id,step]of [['frere-jacques',14],['london-bridge',0],['jingle-bells',0],['old-macdonald',11],['row-your-boat',10]])wall.draw(ctx,{score:score(lessonFor(id),step),reducedMotion:true});
 for(const cp of [0xe0a4,0xe1e7,0xe4e5,0xe4e4,0xe086,0xe088])assert.ok(ink.includes(cp),'Expected Bravura glyph '+cp.toString(16));
 assert.ok(rects.some(rect=>rect[2]>10&&rect[3]<5),'Connected beams are painted across adjacent note stems');
});
