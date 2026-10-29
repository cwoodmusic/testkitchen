const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const lessons=require('../classroom-curriculum-staff.js');
const bank=require('../final-exam-bank.js');
const cards=Object.values(lessons).flat();
const find=id=>cards.find(card=>card.id===id);
const answer=card=>card.answers[card.correct];
const letters=['A','B','C','D','E','F','G'];
function staffLetter(visual,moves=0){
 const base=letters.indexOf(visual.clef==='bass'?'G':'E');
 return letters[((base+visual.position+moves)%7+7)%7];
}

test('staff teaching links cover all 300 canonical questions in their actual categories',()=>{
 assert.deepEqual(Object.keys(lessons),['note-naming','bass-clef','grand-staff']);
 assert.equal(new Set(cards.map(card=>card.id)).size,cards.length);
 for(const [category,items]of Object.entries(lessons)){
  const expected=new Set(bank.pool(category).map(question=>question.id)),covered=new Set();
  for(const card of items){
   assert.ok(card.covers.length>0,card.id);
   assert.equal(new Set(card.covers).size,card.covers.length,card.id);
   for(const id of card.covers){assert.ok(expected.has(id),card.id+' links an unrelated question '+id);covered.add(id);}
  }
  assert.deepEqual([...covered].sort(),[...expected].sort(),category);
 }
});

test('each card gives a short teaching instruction, worked example and answerable check',()=>{
 for(const card of cards){
  for(const key of ['title','teach','example','prompt','hint'])assert.ok(typeof card[key]==='string'&&card[key].trim(),card.id+' '+key);
  assert.ok(card.teach.split(/\s+/).length<=22,card.id+' teach');
  assert.ok(card.example.split(/\s+/).length<=45,card.id+' example');
  assert.ok(card.answers.length>=2&&card.answers.length<=6,card.id);
  assert.equal(new Set(card.answers).size,card.answers.length,card.id);
  assert.ok(Number.isInteger(card.correct)&&card.correct>=0&&card.correct<card.answers.length,card.id);
 }
});

test('pictured note-name and staff-movement checks agree with both real clef maps',()=>{
 for(const id of ['treble-all-lines','treble-all-spaces','bass-f-clef','bass-all-lines','bass-all-spaces','grand-treble-lines','grand-treble-spaces','grand-bass-lines','grand-bass-spaces']){
  const card=find(id);assert.equal(answer(card),staffLetter(card.visual),id);
 }
 for(const [id,moves]of [['treble-one-move',-1],['treble-two-moves',2],['bass-one-move',-1],['bass-two-moves',2],['bass-three-moves',3],['grand-one-move',-1],['grand-middle-c-neighbors',-2]]){
  const card=find(id);assert.equal(answer(card),staffLetter(card.visual,moves),id);
 }
 assert.equal(answer(find('treble-natural-sign')),'F');
 assert.equal(answer(find('grand-two-staffs')),'10');
 assert.equal(answer(find('grand-brace-hands')),'A brace');
 assert.equal(answer(find('grand-play-together')),'Yes');
});

test('staff reminders explicitly use the requested words and bottom-to-top order',()=>{
 for(const category of ['note-naming','grand-staff']){
  const text=lessons[category].map(card=>card.teach).join(' ');
  assert.match(text,/Every Good Boy Does Fine/);assert.match(text,/FACE/);assert.match(text,/bottom to top/);
 }
 for(const category of ['bass-clef','grand-staff']){
  const text=lessons[category].map(card=>card.teach).join(' ');
  assert.match(text,/Great Big Dreams For America/);assert.match(text,/All Cows Eat Grass/);assert.match(text,/bottom to top/);
 }
});

test('pitch lessons show piano keys when teaching keyboard landmarks and neighboring pitches',()=>{
 for(const id of ['treble-musical-alphabet','treble-keyboard-landmarks','treble-half-step','treble-sharp-sign','treble-flat-sign','treble-natural-sign'])assert.equal(find(id).visual.kind,'keyboard',id);
 assert.deepEqual(find('treble-musical-alphabet').visual.notes,[]);
 assert.deepEqual(find('treble-keyboard-landmarks').visual.notes,[],'The landmark diagram must not single out the correct answer');
 assert.deepEqual(find('treble-sharp-sign').visual.notes,['F','F-sharp']);
 assert.deepEqual(find('treble-flat-sign').visual.notes,['E','E-flat']);
 assert.deepEqual(find('treble-natural-sign').visual.notes,['F-sharp','F']);
});

test('the browser exposes the same immutable teaching data without storage or network',()=>{
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../classroom-curriculum-staff.js'),'utf8'),{window});
 assert.deepEqual(JSON.parse(JSON.stringify(window.CodaClassroomCurriculumStaff)),JSON.parse(JSON.stringify(lessons)));
 assert.ok(Object.isFrozen(lessons));assert.ok(Object.isFrozen(lessons['note-naming'][0].covers));
});
