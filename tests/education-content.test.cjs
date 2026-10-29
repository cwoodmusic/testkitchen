const test=require('node:test'),assert=require('node:assert/strict');
const content=require('../education-content.js'),bank=require('../final-exam-bank.js'),quiz=require('../classroom-quiz.js'),tutorials=require('../classroom-tutorials.js');
const disk=()=>({values:new Map(),writes:[],getItem(key){return this.values.get(key)??null;},setItem(key,value){this.writes.push(key);if(this.fail)throw Error('quota');this.values.set(key,value);},removeItem(key){if(this.fail)throw Error('quota');this.values.delete(key);}});
const score={version:1,clef:'grand',meter:'6/8',items:[{type:'repeat-start'},{type:'note',position:10,duration:.5,dots:0,accidental:'none',staff:'bass'},{type:'rest',duration:1,dots:0,staff:'treble'},{type:'bar'},{type:'repeat-end'}]};

test('the default editor includes all canonical questions and the actual child-friendly lesson copy',()=>{
 const defaults=content.getDefaults(),storage=disk(),store=content.createStore({storage,canEdit:()=>true});
 assert.equal(defaults.exam.questions.length,800);assert.equal(content.CATEGORIES.length,8);assert.equal(content.EXAM_IDS.length,8);assert.equal(content.LESSON_IDS.length,9);assert.equal(Object.keys(defaults.quizzes).length,9);assert.equal(Object.keys(defaults.lessons).length,9);
 assert.deepEqual(defaults.lessons['note-naming'].steps[0].teach,tutorials.SIMPLE_NOTE_COPY['note-naming'][0][0]);
 assert.equal(store.saveDocument(defaults).ok,true);assert.strictEqual(store.getExamBank(),bank);
 for(const id of content.CATEGORIES.map(item=>item.id)){assert.strictEqual(store.getQuiz(id),quiz.QUIZZES[id]);assert.equal(store.isLessonEdited(id),false);}
 assert.deepEqual(storage.writes,[content.KEY]);
 defaults.exam.questions[0].prompt='Mutated outside';assert.notEqual(content.getDefaults().exam.questions[0].prompt,'Mutated outside');
});

test('exam and quiz questions support independent add, edit, delete, answer counts, and score pictures',()=>{
 const store=content.createStore({storage:disk(),canEdit:()=>true}),document=store.getDocument();
 document.exam.questions.splice(0,1);document.exam.questions[0].answers.push('Another answer');document.exam.questions[0].correct=3;
 document.exam.questions.push({id:'custom-exam',category:'tempo',prompt:'Which tempo?',answers:['Slow','Fast'],correct:1,explanation:'Choose a fast tempo.',visual:{kind:'notation',score}});
 document.quizzes.tempo.questions.splice(0,1);document.quizzes.tempo.questions[0].answers=['One','Two','Three','Four','Five','Six'];document.quizzes.tempo.questions[0].correct=5;document.quizzes.tempo.questions[0].visual={kind:'notation',score};
 assert.equal(store.saveDocument(document).ok,true);
 const exam=store.getExamBank();assert.equal(exam.custom,true);assert.equal(exam.getQuestion('note-naming-001'),null);assert.equal(exam.getQuestion('custom-exam').choices.length,2);assert.equal(exam.getQuestion('custom-exam').answer,'choice-1');
 assert.strictEqual(store.getExamBank(),exam,'Repeated input guards reuse the same immutable bank');assert.equal(Object.isFrozen(exam.getQuestion('custom-exam')),true);
 assert.equal(exam.getQuestion('note-naming-002').choices.length,4);assert.deepEqual(exam.getQuestion('custom-exam').stimulus,{kind:'notation',score});
 const modified=store.getQuiz('tempo');assert.equal(modified.custom,true);assert.equal(modified.questions.length,4);assert.equal(modified.passScore,4);assert.equal(modified.questions[0].answers.length,6);assert.equal(modified.questions[0].correct,5);
 assert.strictEqual(store.getQuiz('note-naming'),quiz.QUIZZES['note-naming']);
});

test('lesson text, choice answers, staff notes, and notation save without mutating activity structure',()=>{
 const store=content.createStore({storage:disk(),canEdit:()=>true}),document=store.getDocument();
 document.lessons['note-naming'].steps[0].teach='Find the home note.';document.lessons['note-naming'].steps[0].visual={kind:'notation',score};
 document.lessons['rhythm-tree'].steps[1].answers=['One','Two','Three','Four'];document.lessons['rhythm-tree'].steps[1].answer=1;
 document.lessons.tempo.steps[0].answers=['Speed','Volume'];document.lessons.tempo.steps[0].answer=0;
 assert.equal(store.saveDocument(document).ok,true);assert.equal(store.isLessonEdited('note-naming'),true);assert.equal(store.isLessonEdited('rhythm-tree'),true);assert.equal(store.isLessonEdited('tempo'),true);assert.equal(store.isLessonEdited('bass-clef'),false);
 assert.equal(store.getLessonSteps('rhythm-tree')[1].answers[1],'Two');
 const changed=store.getDocument();changed.lessons.tempo.steps[0].sounds[0].bpms[0]=999;assert.equal(store.saveDocument(changed).ok,false);
 const missing=store.getDocument();missing.lessons.tempo.steps.pop();assert.equal(store.saveDocument(missing).ok,false);
});

test('invalid answers, duplicate IDs, unsupported drawings and oversized files cannot overwrite saved content',()=>{
 const storage=disk(),store=content.createStore({storage,canEdit:()=>true});assert.equal(store.saveDocument(store.getDocument()).ok,true);const before=storage.getItem(content.KEY);
 for(const mutate of [
  document=>document.exam.questions[0].answers.splice(1),
  document=>document.exam.questions[0].correct=7,
  document=>document.exam.questions[0].answers[1]=document.exam.questions[0].answers[0],
  document=>document.exam.questions[1].id=document.exam.questions[0].id,
  document=>document.exam.questions[0].id='<script>',
  document=>document.exam.questions[0].visual={kind:'svg',html:'<script>alert(1)</script>'},
  document=>document.exam.questions[0].visual={kind:'notation',score:{...score,items:[{type:'note',position:4,duration:1,dots:0,accidental:'none',staff:'treble',onclick:'alert(1)'}]}},
  document=>document.lessons.tempo.steps[0].answer=99,
  document=>document.exam.questions[0].prompt='X'.repeat(content.MAX_BYTES)
 ]){const document=store.getDocument();mutate(document);assert.equal(store.saveDocument(document).ok,false);assert.equal(storage.getItem(content.KEY),before);}
 assert.equal(store.importDocument('broken JSON').ok,false);assert.equal(storage.getItem(content.KEY),before);
});

test('local author drafts are ignored without edit access; published content remains visible to students',async()=>{
 const storage=disk();let editable=true;const draft=content.getDefaults();draft.quizzes.tempo.questions[0].prompt='Author-only question';
 const published={version:1,quizzes:{tempo:{title:'Our tempo quiz',questions:[{id:'published-tempo',prompt:'A published question',answers:['Yes','No'],correct:0,explanation:'A shared explanation.',visual:null}]}}};
 let requests=0;const store=content.createStore({storage,canEdit:()=>editable,fetch:async()=>{requests++;return {ok:true,json:async()=>published};}});
 assert.equal(store.saveDocument(draft).ok,true);const loaded=await store.loadPublished();assert.equal(loaded.ok,true);assert.equal(store.getQuiz('tempo').questions[0].prompt,'Author-only question');
 editable=false;assert.equal(store.getQuiz('tempo').questions[0].prompt,'A published question');assert.equal(store.saveDocument(draft).ok,false);assert.equal(store.reset().ok,false);
 await store.loadPublished();assert.equal(requests,1);assert.equal(storage.writes.length,1,'Fetching shared content never writes a browser or cloud profile');
 editable=true;assert.equal(store.reset().ok,true);assert.equal(store.getQuiz('tempo').questions[0].prompt,'A published question');
});

test('draft saves protect another tab and leave an existing draft intact after quota failures',()=>{
 const storage=disk(),first=content.createStore({storage,canEdit:()=>true}),other=content.createStore({storage,canEdit:()=>true});
 const document=first.getDocument();document.exam.questions[0].prompt='First tab';assert.equal(first.saveDocument(document).ok,true);
 assert.equal(other.saveDocument(other.getDocument()).ok,false);assert.equal(other.reset().ok,false);assert.match(other.getState().error,/another tab/);
 storage.fail=true;const changed=first.getDocument();changed.exam.questions[0].prompt='Unsaved';assert.equal(first.saveDocument(changed).ok,false);assert.equal(first.getDocument().exam.questions[0].prompt,'First tab');
 storage.fail=false;assert.equal(first.saveDocument(changed).ok,true);assert.equal(first.getDocument().exam.questions[0].prompt,'Unsaved');
});

test('author drafts round trip separately from all student progress and unchanged copies keep canonical revisions',()=>{
 const storage=disk(),store=content.createStore({storage,canEdit:()=>true}),document=store.getDocument();document.lessons.tempo.steps[0].guide='Listen for the speed.';
 assert.equal(store.saveDocument(document).ok,true);const exported=store.exportDocument(),other=content.createStore({storage:disk(),canEdit:()=>true});assert.equal(other.importDocument(exported).ok,true);assert.deepEqual(other.getDocument(),store.getDocument());
 assert.equal(other.getLessonRevision('tempo'),store.getLessonRevision('tempo'));assert.strictEqual(other.getExamBank(),bank);
 const profile=require('../classroom-profile-data.js');assert.equal(profile.SCOPED_KEYS.includes(content.KEY),false);assert.equal(profile.LOCAL_ONLY_KEYS.includes(content.KEY),false);assert.deepEqual([...storage.values.keys()],[content.KEY]);
 const result=profile.capture(storage);assert.equal(result.ok,true,result.error);assert.equal(result.data.progression.xp,0);assert.equal(result.data.finalExam.completedAt,0);
});

test('an authored quiz grades changed answer text and 2–6 choices without rewriting canonical proof',()=>{
 const storage=disk(),model={custom:true,revision:'custom-quiz',version:1,title:'A new quiz',questions:[{id:'q1',prompt:'First',answers:['A','B'],correct:1},{id:'q2',prompt:'Second',answers:['A','B','C','D','E','F'],correct:5},{id:'q3',prompt:'Third',answers:['C','D'],correct:0}]};
 const canonical='{"version":1,"quizzes":{}}';storage.setItem(quiz.KEY,canonical);
 const session=quiz.createSession({lessonId:'tempo',storage,model});for(let i=0;i<3;i++){assert.equal(session.answer(session.getState().question.correct),true);assert.equal(session.next(),true);}
 assert.equal(session.getState().passed,true);assert.equal(session.getState().score,3);assert.equal(session.getState().passScore,3);assert.equal(session.getState().custom,true);assert.equal(storage.getItem(quiz.KEY),canonical);
 const reopened=quiz.createSession({lessonId:'tempo',storage,model});assert.equal(reopened.getState().passed,true);assert.equal(reopened.getState().phase,'result');
 const revised=quiz.createSession({lessonId:'tempo',storage,model:{...model,revision:'new-quiz'}});assert.deepEqual(revised.getState().answers,[]);assert.equal(revised.getState().passed,false);
});

test('authored quiz attempts freeze for paused profiles and stale student or content sessions',()=>{
 const storage=disk(),model={custom:true,revision:'one',version:1,questions:[{id:'one',answers:['One','Two'],correct:1}]};let writable=true;
 const session=quiz.createSession({lessonId:'tempo',storage,model,canRecord:()=>writable});writable=false;assert.equal(session.answer(1),false);assert.equal(session.next(),false);assert.equal(session.save(),false);assert.equal(storage.getItem(quiz.CUSTOM_KEY),null);
 writable=true;assert.equal(session.answer(1),true);assert.equal(session.next(),true);const before=storage.getItem(quiz.CUSTOM_KEY);storage.values.delete(quiz.CUSTOM_KEY);assert.equal(session.save(),false);assert.equal(storage.getItem(quiz.CUSTOM_KEY),null);assert.ok(before);
 const empty=quiz.createSession({lessonId:'tempo',storage,model:{...model,revision:'empty',questions:[]}});assert.equal(empty.getState().passed,false);assert.equal(empty.getState().finished,false);
});

test('an open canonical quiz freezes on its first authored edit but accepts unrelated topic changes',()=>{
 const storage=disk(),store=content.createStore({storage,canEdit:()=>true}),session=quiz.createSession({lessonId:'tempo',storage,content:store,model:store.getQuiz('tempo'),randomize:false});
 const examEdit=store.getDocument();examEdit.exam.questions[0].prompt='An unrelated exam change';assert.equal(store.saveDocument(examEdit).ok,true);assert.equal(session.answer(1),true);
 const before=storage.getItem(quiz.KEY),quizEdit=store.getDocument();quizEdit.quizzes.tempo.questions[0].prompt='A newly edited tempo question';assert.equal(store.saveDocument(quizEdit).ok,true);
 assert.equal(session.next(),false);assert.equal(session.save(),false);assert.equal(storage.getItem(quiz.KEY),before);assert.match(session.getState().error,/content changed/);
 assert.equal(store.saveDocument(examEdit).ok,true);assert.equal(session.next(),false,'An observed stale session stays frozen even if its old content returns');
 const reopened=quiz.createSession({lessonId:'tempo',storage,content:store,model:store.getQuiz('tempo'),randomize:false});assert.equal(reopened.next(),true,'Reopening resolves the current content revision');
});
