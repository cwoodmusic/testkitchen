const test=require('node:test'),assert=require('node:assert/strict');
const quiz=require('../classroom-quiz.js'),pool=require('../classroom-quiz-pool.js'),profiles=require('../classroom-profile-data.js');
const accidental=require('../classroom-accidentals-lesson.js');
function disk(){const values=new Map();return{values,fail:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.fail)throw Error('quota');values.set(key,value);},removeItem:key=>values.delete(key)};}
const make=(storage=disk(),extra={})=>quiz.createSession({lessonId:'note-naming',storage,seed:7,...extra});
function finish(session,wrong=[]){const selected=[];for(let i=0;i<session.getState().total;i++){const state=session.getState(),question=state.question,choice=wrong.includes(i)?(question.correct+1)%question.answers.length:question.correct;selected[state.slotIndex]=choice;assert.equal(session.answer(choice),true);assert.equal(session.next(),true);}return selected;}

test('nine built-in lesson pools provide three real, correctly aligned questions per goal',()=>{
 for(const [id,model]of [...Object.entries(quiz.QUIZZES),[accidental.ID,accidental.QUIZ]]){
  const groups=pool.poolsFor(id,model);assert.equal(groups.length,5);
  for(const [slot,questions]of groups.entries()){
   assert.equal(questions.length,3);assert.equal(new Set(questions.map(item=>item.id)).size,3);
   assert.equal(new Set(questions.map(item=>JSON.stringify([item.prompt,item.visual]))).size,3,id+' goal '+slot+' must have real alternatives');
   for(const item of questions){assert.equal(item.correct,model.questions[slot].correct);assert.equal(item.answers.length,3);assert.equal(new Set(item.answers).size,3);assert.ok(item.explanation);assert.doesNotMatch(item.prompt,/second from the bottom|third from the bottom/i);}
  }
 }
});

test('seeded attempts sample every goal and vary question selection, question order and answer positions',()=>{
 const openings=new Set(),selections=new Set(),positions=new Set(),seen=new Set();
 for(let seed=0;seed<80;seed++){
  const first=make(disk(),{seed}).getState(),again=make(disk(),{seed}).getState();
  assert.deepEqual(first.questionIds,again.questionIds);assert.deepEqual(first.questionOrder,again.questionOrder);assert.deepEqual(first.answerOrder,again.answerOrder);
  assert.deepEqual([...first.questionOrder].sort(),[0,1,2,3,4]);
  openings.add(first.questionOrder[0]);selections.add(JSON.stringify(first.questionIds));positions.add(first.answerOrder.indexOf(first.question.correct));
  first.questionIds.forEach(id=>seen.add(id));
 }
 assert.equal(openings.size,5);assert.ok(selections.size>50);assert.equal(seen.size,15);assert.deepEqual([...positions].sort(),[0,1,2]);
});

test('partial attempts resume exact selected questions, choices, answer feedback and score',()=>{
 const storage=disk(),first=make(storage);first.answer(first.getState().question.correct);first.next();first.answer((first.getState().question.correct+1)%3);
 const before=first.getState(),reopened=make(storage,{seed:99}).getState();
 for(const key of ['questionIds','questionOrder','answerOrder','answers','index','score','question'])assert.deepEqual(reopened[key],before[key],key);
 assert.equal(reopened.saved,true);assert.equal(storage.getItem(quiz.KEY),null,'Partial shuffled answers stay local, not invented canonical proof.');
 assert.equal(profiles.LOCAL_ONLY_KEYS.includes(quiz.ATTEMPT_KEY),true);
});

test('official grade saves the actual selected choice indices in canonical goal order',()=>{
 const storage=disk(),session=make(storage),actual=finish(session,[1]);
 const entry=JSON.parse(storage.getItem(quiz.KEY)).quizzes['note-naming'];
 assert.deepEqual(entry.answers,actual);assert.equal(quiz.scoreFor('note-naming',entry.answers),4);
 assert.equal(session.getState().score,4);assert.equal(session.getState().passed,true);
 const state=profiles.blank();state.quizzes.quizzes['note-naming']=entry;state.lessons.lessons['note-naming']={step:10,completed:true,completedAt:1};state.progression.events=[{id:'achievement:classroom-note-naming',xp:50}];state.progression.xp=50;
 assert.equal(profiles.validate(state).ok,true,'Random question grades remain valid private-profile evidence.');
});

test('deliberate retry changes the selection and keeps past passing proof without passing a failed retry',()=>{
 const storage=disk(),session=make(storage);finish(session);const before=session.getState(),proof=storage.getItem(quiz.KEY);
 session.restart();const next=session.getState();assert.notDeepEqual([...next.questionIds].sort(),[...before.questionIds].sort());assert.notDeepEqual([next.questionIds,next.questionOrder,next.answerOrder],[before.questionIds,before.questionOrder,before.answerOrder]);assert.equal(next.bestScore,5);assert.equal(next.passed,false);assert.equal(storage.getItem(quiz.KEY),proof);
 finish(session,[0,1]);assert.equal(session.getState().score,3);assert.equal(session.getState().passed,false);assert.equal(session.getState().bestScore,5);
});

test('legacy partial questions reopen as their original questions instead of unrelated pooled text',()=>{
 const storage=disk();storage.setItem(quiz.KEY,JSON.stringify({version:1,quizzes:{'note-naming':{bankVersion:1,index:1,answers:[0,0],bestAnswers:[],completedAt:0}}}));
 const session=make(storage).getState();assert.equal(session.question.id,quiz.QUIZZES['note-naming'].questions[1].id);assert.deepEqual(session.questionOrder,[0,1,2,3,4]);assert.deepEqual(session.answers,[0,0]);assert.equal(session.score,1);
});

test('legacy passed proof survives missing local attempt details and unlocks a fresh randomized retry',()=>{
 const storage=disk();storage.setItem(quiz.KEY,JSON.stringify({version:1,quizzes:{'note-naming':{bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:1}}}));
 const session=make(storage);assert.equal(session.getState().phase,'result');assert.equal(session.getState().passed,true);session.restart();assert.equal(session.getState().phase,'question');assert.equal(session.getState().bestScore,5);assert.equal(session.getState().passed,false);
});

test('quota failure retains the completed attempt but cannot claim saved proof until explicit retry',()=>{
 const storage=disk(),session=make(storage);storage.fail=true;finish(session);assert.equal(session.getState().passed,true);assert.equal(session.getState().saved,false);assert.equal(storage.getItem(quiz.KEY),null);
 storage.fail=false;assert.equal(session.save(),true);assert.equal(make(storage).getState().passed,true);assert.equal(quiz.scoreFor('note-naming',JSON.parse(storage.getItem(quiz.KEY)).quizzes['note-naming'].answers),5);
});

test('changed player journals and frozen profiles reject stale attempt writes',()=>{
 const storage=disk();let allowed=true;const session=make(storage,{canRecord:()=>allowed}),question=session.getState().question;
 allowed=false;const before=[...storage.values];assert.equal(session.answer(question.correct),false);assert.equal(session.save(),false);assert.deepEqual([...storage.values],before);
 allowed=true;storage.removeItem(quiz.ATTEMPT_KEY);assert.equal(session.save(),false);assert.equal(storage.getItem(quiz.KEY),null);
});

test('two subjects merge local attempts while a stale copy of the same attempt cannot replace newer answers',()=>{
 const storage=disk(),names=make(storage),stale=make(storage),rhythm=make(storage,{lessonId:'rhythm-tree'});
 names.answer(names.getState().question.correct);rhythm.answer(rhythm.getState().question.correct);
 assert.equal(make(storage).getState().score,1);assert.equal(make(storage,{lessonId:'rhythm-tree'}).getState().score,1);
 assert.equal(stale.save(),false);assert.equal(make(storage).getState().score,1);
});

test('the default education model and real basics model draw distinct targeted questions across retries',()=>{
 const content=require('../education-content.js'),paths=require('../classroom-learning-paths-data.js');
 const model=content.createStore({storage:disk()}).getQuiz('note-naming');assert.strictEqual(model,quiz.QUIZZES['note-naming']);
 assert.ok(pool.poolsFor('note-naming',model).every(items=>items.length===3));
 const basic=paths.basicsQuiz('rhythm-tree'),seen=Array.from({length:5},()=>new Set());
 for(let seed=0;seed<30;seed++){
  const session=make(disk(),{lessonId:'rhythm-tree',model:basic,custom:true,seed});
  const state=session.getState();state.questionOrder.forEach((slot,index)=>seen[slot].add(state.questionIds[index]));
  finish(session);assert.equal(session.getState().passed,true);assert.equal(session.save(),true);
 }
 assert.ok(seen.every(ids=>ids.size===3));
});
