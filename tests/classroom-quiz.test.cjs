const test=require('node:test'),assert=require('node:assert/strict');
const quiz=require('../classroom-quiz.js');

const ANSWERS=Object.freeze({
 'note-naming':[0,1,2,0,1],
 'rhythm-tree':[1,0,2,1,0],
 'time-signatures':[2,1,0,2,1],
 'bass-clef':[0,1,2,0,1],
 'grand-staff':[0,1,2,0,2],
 'major-minor-keys':[0,1,2,0,1],
 'dynamics':[0,1,2,0,1],
 'tempo':[1,0,2,1,0]
});
function disk(){
 const values=new Map();
 return {values,fail:false,getItem:key=>values.get(key)||null,setItem(key,value){if(this.fail)throw Error('quota');values.set(key,value);}};
}
function session(lessonId='note-naming',storage=disk()){return quiz.createSession({lessonId,storage,randomize:false});}
function finish(game,answers){for(const answer of answers){game.answer(answer);game.next();}return game.getState();}
function stored(lessonId,record){return {version:1,quizzes:{[lessonId]:{bankVersion:1,answers:[],index:0,bestAnswers:[],...record}}};}

test('each taught subject has five age-appropriate quiz questions and a four-answer pass mark',()=>{
 assert.equal(quiz.KEY,'codaClassroomQuizzesV1');
 assert.deepEqual(Object.keys(quiz.QUIZZES).sort(),Object.keys(ANSWERS).sort());
 for(const [id,answers]of Object.entries(ANSWERS)){
  const bank=quiz.QUIZZES[id];assert.equal(bank.version,1);assert.equal(bank.passScore,4);
  assert.equal(bank.questions.length,5);assert.deepEqual(bank.questions.map(question=>question.correct),answers);
  for(const question of bank.questions){
   assert.ok(question.prompt||question.question,id+' needs a clear question');
   assert.ok(question.explanation,id+' needs feedback that teaches');
   assert.equal(question.answers.length,3);
   assert.ok(question.answers.every(answer=>typeof answer==='string'&&answer.trim()));
   assert.doesNotMatch(JSON.stringify(question),/\b[A-G][♯♭]?[0-8]\b/,'Quiz note names should not introduce octave numbers');
  }
 }
});

test('four first-choice answers pass, three do not, and incomplete work can never pass',()=>{
 for(const [id,answers]of Object.entries(ANSWERS)){
  const game=session(id);const firstFour=answers.slice(0,4);
  for(const answer of firstFour){game.answer(answer);game.next();}
  let state=game.getState();assert.equal(state.finished,false);assert.equal(state.passed,false);
  assert.equal(state.score,4);assert.equal(state.index,4);
  game.answer((answers[4]+1)%3);game.next();state=game.getState();
  assert.equal(state.finished,true);assert.equal(state.passed,true);assert.equal(state.score,4);
  assert.equal(state.total,5);assert.equal(state.index,5);assert.equal(state.saved,true);
  const failed=finish(session(id),answers.map((answer,index)=>index<3?answer:(answer+1)%3));
  assert.equal(failed.finished,true);assert.equal(failed.score,3);assert.equal(failed.passed,false);
 }
});

test('a question records one answer, rejects invalid choices, and cannot be skipped',()=>{
 const game=session(),initial=game.getState();game.next();
 assert.deepEqual(game.getState(),initial);
 for(const invalid of [-1,3,NaN,Infinity,'0',null,{},undefined])game.answer(invalid);
 assert.deepEqual(game.getState(),initial);
 game.answer(1);const wrong=game.getState();assert.deepEqual(wrong.answers,[1]);assert.equal(wrong.score,0);
 game.answer(0);assert.deepEqual(game.getState(),wrong,'Changing a choice must not turn a first-attempt error into a scored hit');
 game.next();assert.equal(game.getState().index,1);assert.deepEqual(game.getState().answers,[1]);
 game.next();assert.equal(game.getState().index,1,'The next question also needs an answer');
});

test('saved quiz progress resumes the selected answer and score without touching lesson rewards',()=>{
 const storage=disk(),legacy='{"version":1,"lessons":{"note-naming":{"step":10,"completed":true,"completedAt":123}}}';
 storage.setItem('codaClassroomLessonsV1',legacy);
 const game=session('note-naming',storage);game.answer(0);game.next();game.answer(0);
 const before=game.getState(),resumed=session('note-naming',storage).getState();
 assert.equal(resumed.index,1);assert.deepEqual(resumed.answers,[0,0]);assert.equal(resumed.score,1);
 assert.equal(resumed.passed,false);assert.equal(resumed.saved,true);
 assert.equal(storage.getItem('codaClassroomLessonsV1'),legacy,'The separate quiz journal must not rewrite old lesson achievements');
 assert.equal(before.score,resumed.score);
});

test('concurrent lesson sessions merge their quiz records rather than overwriting one another',()=>{
 const storage=disk(),names=session('note-naming',storage),rhythm=session('rhythm-tree',storage);
 names.answer(0);rhythm.answer(1);names.next();
 assert.deepEqual(session('rhythm-tree',storage).getState().answers,[1]);
 assert.deepEqual(session('note-naming',storage).getState().answers,[0]);
 assert.equal(session('note-naming',storage).getState().index,1);
});

test('blocked saving keeps a passing attempt unsaved until an explicit successful retry',()=>{
 const storage=disk(),game=session('note-naming',storage);storage.fail=true;
 const unsaved=finish(game,ANSWERS['note-naming']);
 assert.equal(unsaved.passed,true);assert.equal(unsaved.saved,false);assert.ok(unsaved.error);
 assert.equal(session('note-naming',storage).getState().passed,false,'A new session must not load an unsaved pass');
 game.save();assert.equal(game.getState().saved,false);
 storage.fail=false;game.save();const saved=game.getState();
 assert.equal(saved.saved,true);assert.equal(saved.error,'');
 const resumed=session('note-naming',storage).getState();
 assert.equal(resumed.passed,true);assert.equal(resumed.score,5);assert.equal(resumed.index,5);
});

test('retrying starts a fresh attempt but preserves a validated best result',()=>{
 const storage=disk(),game=session('note-naming',storage);finish(game,ANSWERS['note-naming']);
 assert.equal(game.getState().bestScore,5);game.restart();
 let state=game.getState();assert.equal(state.index,0);assert.deepEqual(state.answers,[]);
 assert.equal(state.score,0);assert.equal(state.finished,false);assert.equal(state.passed,false);assert.equal(state.bestScore,5);
 finish(game,ANSWERS['note-naming'].map((answer,index)=>index<3?answer:(answer+1)%3));
 state=session('note-naming',storage).getState();
 assert.equal(state.score,3);assert.equal(state.passed,false);assert.equal(state.bestScore,5,'A previous pass must not make a new failed attempt pass');
});

test('saved flags, scores, malformed answers, and outdated question versions cannot invent a pass',()=>{
 const cases=[
  {passed:true,score:5,index:5},
  {answers:[0,1,2,0,99],index:5,passed:true,score:5},
  {answers:[0,1,2,1,2],index:5,passed:true,score:999},
  {bankVersion:99,answers:ANSWERS['note-naming'],index:5,passed:true,score:5}
 ];
 for(const raw of cases){
  const storage=disk();storage.setItem(quiz.KEY,JSON.stringify(stored('note-naming',raw)));
  const state=session('note-naming',storage).getState();assert.equal(state.passed,false,JSON.stringify(raw));
 }
 const storage=disk();storage.setItem(quiz.KEY,'not json');
 assert.equal(session('note-naming',storage).getState().passed,false);
 assert.throws(()=>session('unknown-subject'));
});

test('quiz prompts and reminders stay brief and musical choices have correct note values',()=>{
 for(const bank of Object.values(quiz.QUIZZES))for(const question of bank.questions){
  assert.ok(question.prompt.split(/\s+/).length<=12,question.id+' is one short question');
  assert.ok(question.explanation.split(/\s+/).length<=16,question.id+' has one small reminder');
 }
 const four=quiz.QUIZZES['rhythm-tree'].questions.find(q=>q.id==='four-beat-bar');
 assert.equal(four.answerNotes[four.correct].reduce((sum,n)=>sum+n,0),4);
 for(const [index,group]of four.answerNotes.entries())if(index!==four.correct)assert.notEqual(group.reduce((sum,n)=>sum+n,0),4);
 const cut=quiz.QUIZZES['time-signatures'].questions.find(q=>q.id==='cut-time-bar');
 assert.deepEqual(cut.answerNotes[cut.correct],[2,2]);
 assert.equal(quiz.QUIZZES['grand-staff'].questions.at(-1).visual.kind,'middle-c-pair');
});
