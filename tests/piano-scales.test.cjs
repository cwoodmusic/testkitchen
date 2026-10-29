const test=require('node:test'),assert=require('node:assert/strict');
const {SCALES,LESSONS,paintedFloorKeys}=require('../piano-lab.js');
const notation=require('../piano-wall-notation.js');

test('major and natural minor scales use their real interval patterns and fit every painted key',()=>{
 const painted=new Set(paintedFloorKeys().map(key=>key.offset));
 const patterns={major:[2,2,1,2,2,2,1],minor:[2,1,2,2,1,2,2]};
 assert.equal(SCALES.length,24);assert.equal(new Set(SCALES.map(scale=>scale.id)).size,24);assert.equal(SCALES.filter(scale=>scale.type==='major').length,12);assert.equal(SCALES.filter(scale=>scale.type==='minor').length,12);
 for(const scale of SCALES){
  assert.ok(Object.isFrozen(scale));assert.ok(Object.isFrozen(scale.notes));
  assert.equal(scale.notes.length,15);assert.equal(scale.spellings.length,15);
  assert.deepEqual(scale.notes.slice(1,8).map((note,index)=>note-scale.notes[index]),patterns[scale.type],scale.id);
  assert.equal(scale.notes[7]-scale.notes[0],12,scale.id+' reaches the same letter one octave higher');assert.equal(scale.notes.at(-1),scale.notes[0]);assert.deepEqual(scale.notes.slice(8),scale.notes.slice(0,7).reverse(),scale.id+' descends to the starting tonic');
  assert.equal(scale.events.reduce((sum,event)=>sum+event.beats,0),16);assert.equal(scale.events.at(-1).beats,2);assert.ok(scale.notes.every(note=>painted.has(note)),scale.id+' stays on the painted 24-key floor');
  assert.equal(scale.spellings[0][0],scale.spellings.at(-1)[0]);
  for(let index=0;index<15;index++)assert.equal(notation.pitch(60+scale.notes[index],scale.spellings[index]).label,scale.spellings[index]);
 }
 assert.ok(SCALES.some(scale=>scale.type==='major'&&scale.spellings.includes('F♯')));
 assert.ok(SCALES.some(scale=>scale.spellings.includes('B♭')));
 assert.equal(LESSONS.length,9,'The original nine memory-mastery melodies stay separate');
});

test('wall notation uses real diatonic placement and proper accidental spelling',()=>{
 const c=notation.createScore({notes:[60,62,64,65,67,69,71,72],step:0,mode:'scale',label:'C major'});
 assert.equal(c.clef,'treble');assert.deepEqual(c.notes.map(note=>note.position),[-2,-1,0,1]);
 assert.deepEqual(c.notes[0].ledgerLines,[-2]);assert.equal(c.notes[0].status,'current');
 const minor=SCALES.find(scale=>scale.id==='c-minor');
 const score=notation.createScore({notes:minor.notes.map(offset=>60+offset),spellings:minor.spellings,step:0,mode:'scale'});
 assert.equal(score.notes[2].label,'E♭');assert.equal(score.notes[2].position,0);assert.equal(score.notes[2].accidental,'flat');
 const second=notation.createScore({notes:minor.notes.map(offset=>60+offset),spellings:minor.spellings,step:6,mode:'scale'});
 assert.equal(second.notes.find(note=>note.label==='B♭').label,'B♭');assert.equal(second.notes.find(note=>note.label==='B♭').accidental,'flat');
 const low=notation.createScore({notes:[48,50,52,53,55,57,59,60],step:0,mode:'scale'});
 assert.equal(low.clef,'bass');assert.equal(low.notes[0].position,3,'C below middle C belongs in a bass space');
 assert.equal(notation.pitch(66,'F♯').letter,'F');assert.equal(notation.pitch(70,'B♭').letter,'B');
});

test('the score advances through a written measure and memory never reveals future targets',()=>{
 const notes=[60,62,64,65,67,69,71,72];
 const guided=notation.createScore({notes,step:6,mode:'melody'});
 assert.deepEqual(guided.notes.map(note=>note.midi),[67,69,71,72]);assert.equal(guided.notes[2].status,'current');
 const blank=notation.createScore({notes,step:0,mode:'memory'});assert.equal(blank.answerHidden,true);assert.deepEqual(blank.notes,[]);
 const played=notation.createScore({notes,step:2,mode:'memory'});
 assert.deepEqual(played.notes.map(note=>note.midi),[60,62]);assert.ok(played.notes.every(note=>note.status==='done'));
 const finished=notation.createScore({notes,step:8,mode:'melody'});assert.equal(finished.complete,true);
 assert.ok(finished.notes.every(note=>note.status==='done'));
});

test('Canvas scores paint bundled music glyphs and keep noteheads inside their wall frame',()=>{
 const events=[],ctx={save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},strokeRect(){},translate(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillText(text,x,y){events.push({text,x,y,font:this.font});}};
 for(const [label,notes,spellings] of [['D major',[62,64,66,67,69,71,73,74],['D','E','F♯','G','A','B','C♯','D']],['C minor',[60,62,63,65,67,68,70,72],['C','D','E♭','F','G','A♭','B♭','C']]]){
  const score=notation.createScore({notes,spellings,step:0,mode:'scale',label});
  const drawing=notation.draw(ctx,{score,x:286,y:72,width:428,height:120,time:1,reducedMotion:true});
  assert.ok(drawing.notes.every(note=>note.x>=286&&note.x<=714&&note.y>=72&&note.y<=192));
 }
 assert.ok(events.some(event=>event.text.codePointAt(0)===0xe050&&event.font.includes('CodaBravura')),'Treble clef is a music-font glyph');
 assert.ok(events.some(event=>event.text.codePointAt(0)===0xe1d5||event.text.codePointAt(0)===0xe1d6),'Notes use the music font');
 assert.ok(events.some(event=>event.text.codePointAt(0)===0xe262),'D major has a real sharp glyph');
 assert.ok(events.some(event=>event.text.codePointAt(0)===0xe260),'C minor has a real flat glyph');
 assert.ok(events.every(event=>!/[A-G][0-9]/.test(event.text)),'Learner-facing notation omits octave numbers');
});
