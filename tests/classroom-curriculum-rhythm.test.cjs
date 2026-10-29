const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const curriculum=require('../classroom-curriculum-rhythm.js'),bank=require('../final-exam-bank.js');
const card=id=>Object.values(curriculum).flat().find(item=>item.id===id);

test('all two hundred rhythm and meter questions have short, worked, interactive teaching cards',()=>{
 const seen=new Set();
 for(const [category,cards]of Object.entries(curriculum)){
  assert.ok(cards.length>=10);const covered=new Set();
  for(const item of cards){
   assert.ok(item.id.startsWith(category+'-'));assert.ok(!seen.has(item.id));seen.add(item.id);
   assert.ok(item.title.trim());assert.ok(item.teach.trim());assert.ok(item.teach.split(/\s+/).length<=22,item.id);
   assert.ok(item.example.trim());assert.ok(item.example.split(/\s+/).length<=45,item.id);
   assert.ok(item.prompt.trim());assert.ok(item.hint.trim());
   assert.ok(item.answers.length>=2&&item.answers.length<=6);assert.equal(new Set(item.answers).size,item.answers.length);
   assert.ok(Number.isInteger(item.correct)&&item.correct>=0&&item.correct<item.answers.length);
   assert.ok(item.covers.length>0);assert.equal(new Set(item.covers).size,item.covers.length,item.id);
   for(const id of item.covers){assert.equal(bank.getQuestion(id)?.category,category,id);covered.add(id);}
  }
  assert.deepEqual([...covered].sort(),bank.pool(category).map(question=>question.id).sort());
 }
});

test('silence, dots, ties, and beaming receive separate visual instruction and checks',()=>{
 const dots=card('rhythm-tree-dots'),rests=card('rhythm-tree-dotted-rests'),ties=card('rhythm-tree-ties'),beams=card('rhythm-tree-beams-and-flags');
 assert.match(dots.example,/2 \+ 1 = 3/);assert.match(dots.example,/½ \+ ¼ = ¾/);
 assert.equal(dots.answers[dots.correct],'¼ beat');assert.equal(rests.answers[rests.correct],'1½ beats');
 assert.ok(rests.visual.notes.every(note=>note.rest));assert.ok(rests.covers.includes('rhythm-tree-009'));
 assert.equal(ties.visual.kind,'tie');assert.deepEqual(ties.visual.notes,[{beats:2},{beats:1}]);
 assert.match(ties.teach,/same pitch/);assert.match(ties.teach,/do not play/);
 assert.ok(ties.covers.includes('rhythm-tree-086'));assert.ok(ties.covers.includes('rhythm-tree-088'));
 assert.match(beams.teach,/do not change the lengths/);assert.equal(beams.visual.notes.filter(note=>note.beats===.25).length,4);
});

test('meter lessons separate written length, main pulses, fractional completion, and speed',()=>{
 const bottom=card('time-signatures-read-bottom'),cut=card('time-signatures-cut-time'),compound=card('time-signatures-six-eight'),grouping=card('time-signatures-three-four-versus-six-eight'),fractions=card('time-signatures-quarter-lengths');
 assert.match(bottom.teach,/2 means half note, 4 means quarter note, and 8 means eighth note/);
 assert.match(cut.example,/two quarters/);assert.match(compound.example,/dotted quarter/);
 assert.equal(compound.answers[compound.correct],'2');assert.ok(compound.covers.includes('time-signatures-099'));
 assert.match(grouping.example,/three beats, each split in 2/);assert.match(grouping.example,/two big beats, each split in 3/);
 assert.ok(grouping.covers.includes('time-signatures-077'));assert.ok(grouping.covers.includes('time-signatures-093'));
 assert.match(fractions.example,/1¼ → 1½ → 1¾ → 2/);assert.equal(fractions.answers[fractions.correct],'¾ quarter-note length');
 const speed=card('time-signatures-meter-versus-tempo');assert.match(speed.teach,/does not automatically double/);
 assert.equal(speed.answers[speed.correct],'No, tempo decides the speed');
});

test('browser and Node share an immutable data-only curriculum without changing the exam bank',()=>{
 const previous=JSON.stringify(bank.QUESTIONS),context={window:{}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(require.resolve('../classroom-curriculum-rhythm.js'),'utf8'),context);
 assert.equal(JSON.stringify(context.window.CodaClassroomCurriculumRhythm),JSON.stringify(curriculum));
 assert.ok(Object.isFrozen(curriculum));assert.ok(Object.isFrozen(curriculum['rhythm-tree'][0].covers));
 assert.equal(JSON.stringify(bank.QUESTIONS),previous);
});
