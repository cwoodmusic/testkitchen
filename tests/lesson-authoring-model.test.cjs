const test=require('node:test'),assert=require('node:assert/strict');
const content=require('../education-content.js'),paths=require('../classroom-learning-paths-data.js'),study=require('../classroom-exam-study.js'),quiz=require('../classroom-quiz.js'),bank=require('../final-exam-bank.js'),tutorials=require('../classroom-tutorials.js');
const runtime=require('../classroom-learning-paths.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const disk=()=>({values:new Map(),getItem(key){return this.values.get(key)??null;},setItem(key,value){this.values.set(key,value);},removeItem(key){this.values.delete(key);}});
const store=()=>content.createStore({storage:disk(),canEdit:()=>true});

test('the author document exposes all built-in practice checks without changing canonical assessments',()=>{
 const current=store(),document=current.getDocument();
 for(const id of content.LESSON_IDS){
  for(const card of document.lessons[id].study){assert.equal(card.checks.length,2,card.id);assert.equal(paths.getChecks(id,card).length,3,card.id);}
  assert.equal(current.isStudyEdited(id),false,id);
 }
 assert.equal(current.saveDocument(document).ok,true);
 for(const id of content.LESSON_IDS)assert.equal(current.isStudyEdited(id),false,id);
 for(const id of content.EXAM_IDS)assert.strictEqual(current.getQuiz(id),quiz.QUIZZES[id]);
 assert.strictEqual(current.getExamBank(),bank);
});

test('edited lesson text, ordered sections, follow-up questions and multiple pictures reach the runtime',()=>{
 const current=store(),document=current.getDocument(),lesson=document.lessons['note-naming'],card=lesson.study[0];
 lesson.title='My pitch lesson';lesson.intro='Find the notes on this keyboard.';lesson.sections[0].title='My keyboard chapter';lesson.sections[0].cardIds.reverse();
 card.prompt='Which letter starts your pattern?';card.checks[0].prompt='My follow-up question';card.checks[0].answers=['First answer','Second answer'];card.checks[0].correct=1;card.checks[0].hint='Read my own pattern.';
 card.visuals=[{kind:'clef-intro',clef:'bass',page:'clef'},{kind:'note',beats:1}];card.checks[0].visual={kind:'keyboard',notes:['D']};card.checks[0].visuals=[{kind:'note',beats:2}];
 const saved=current.saveDocument(document);assert.equal(saved.ok,true,saved.error);
 const category=paths.getCategory('note-naming',{content:current});
 assert.equal(category.title,lesson.title);assert.equal(category.intro,lesson.intro);assert.equal(category.sections[0].title,lesson.sections[0].title);assert.deepEqual(category.sections[0].cards.map(card=>card.id),lesson.sections[0].cardIds);
 const edited=current.getStudyCards('note-naming')[0],checks=paths.getChecks('note-naming',edited);assert.equal(checks.length,3);assert.equal(checks[0].prompt,card.prompt);assert.equal(checks[1].prompt,'My follow-up question');assert.deepEqual(checks[1].visuals,[{kind:'note',beats:2}]);
 const session=study.createSession({lessonId:'note-naming',cards:[edited],storage:disk()});session.tryIt();assert.equal(session.answer(edited.correct),true);assert.equal(session.next(),true);assert.equal(session.question().prompt,'My follow-up question');assert.equal(session.answer(1),true);assert.equal(session.getState().passed.length,0,'A later practice check still remains.');
 const imported=store();assert.equal(imported.importDocument(current.exportDocument()).ok,true);assert.deepEqual(imported.getStudyCards('note-naming'),current.getStudyCards('note-naming'));
});

test('explicit follow-up and image deletions stay deleted after saving and reopening',()=>{
 const current=store(),document=current.getDocument(),card=document.lessons['note-naming'].study[0];card.checks=[];card.visual=null;card.visuals=[];
 assert.equal(current.saveDocument(document).ok,true);const imported=store();assert.equal(imported.importDocument(current.exportDocument()).ok,true);
 const edited=imported.getStudyCards('note-naming')[0];assert.equal(paths.getChecks('note-naming',edited).length,1);assert.equal(edited.visual,null);assert.deepEqual(edited.visuals,[]);
});

test('old untouched cards gain editable default checks while existing teacher edits remain intentional',()=>{
 const document=content.getDefaults();
 for(const [id,lesson]of Object.entries(document.lessons)){delete lesson.intro;delete lesson.sections;lesson.title=tutorials.LESSONS.find(item=>item.id===id)?.title||lesson.title;for(const card of lesson.study)delete card.checks;}
 document.lessons['note-naming'].study[0].teach='Keep this previously edited teaching idea.';
 const result=content.validate(document);assert.equal(result.ok,true,result.error);
 assert.equal(result.data.lessons['note-naming'].study[0].teach,'Keep this previously edited teaching idea.');assert.equal(result.data.lessons['note-naming'].study[0].checks,undefined);
 assert.equal(result.data.lessons['note-naming'].study[1].checks.length,2);assert.equal(result.data.lessons['note-naming'].title,content.getDefaults().lessons['note-naming'].title);
});

test('invalid extra questions, images, and section assignments cannot overwrite the saved author document',()=>{
 const current=store();assert.equal(current.saveDocument(current.getDocument()).ok,true);const original=current.exportDocument();
 for(const mutate of [
  lesson=>lesson.study[0].checks[0].onclick='run()',
  lesson=>lesson.study[0].checks[0].answers=['Same','Same'],
  lesson=>lesson.study[0].checks=Array.from({length:10},()=>copy(lesson.study[0].checks[0])),
  lesson=>lesson.study[0].visuals=[{kind:'html',html:'<script>'}],
  lesson=>lesson.study[0].checks[0].visuals=[{kind:'keyboard',notes:['H']}],
  lesson=>lesson.sections[1].cardIds.push(lesson.sections[0].cardIds[0]),
  lesson=>lesson.sections[0].tier='anything',
 ]){const document=current.getDocument();mutate(document.lessons['note-naming']);assert.equal(current.saveDocument(document).ok,false);assert.equal(current.exportDocument(),original);}
});

test('legacy activity pictures can be explicitly suppressed and extra pictures remain separately editable',()=>{
 const current=store(),document=current.getDocument(),step=document.lessons['note-naming'].steps[0];step.hideVisual=true;step.visual=null;step.visuals=[{kind:'keyboard',notes:['C']}];
 assert.equal(current.saveDocument(document).ok,true);assert.equal(current.getLessonSteps('note-naming')[0].hideVisual,true);assert.deepEqual(current.getLessonSteps('note-naming')[0].visuals,[{kind:'keyboard',notes:['C']}]);
});

test('a course can contain only advanced sections without a nonexistent basics gate',()=>{
 const current=store(),document=current.getDocument(),lesson=document.lessons['note-naming'];for(const section of lesson.sections)section.tier='advanced';
 assert.equal(current.saveDocument(document).ok,true);const category=paths.getCategory('note-naming',{content:current}),session=runtime.createSession({category,storage:disk()});
 assert.equal(runtime.validateCategory(category),true);assert.equal(session.getState().hasBasics,false);assert.equal(session.canOpenSection(category.sections[0].id),true);assert.equal(session.basicsReady(),true);assert.equal(session.allReady(),false);assert.equal(session.markCompleted(),false);
});

test('deleting every teaching card leaves an empty authorable course with no completion or reward path',()=>{
 const current=store(),document=current.getDocument();document.lessons['note-naming'].study=[];assert.equal(current.saveDocument(document).ok,true);
 const category=paths.getCategory('note-naming',{content:current}),storage=disk(),session=runtime.createSession({category,storage});
 assert.equal(runtime.validateCategory(category),true);assert.deepEqual(category.sections,[]);assert.equal(session.getState().hasCards,false);assert.equal(session.basicsReady(),false);assert.equal(session.allReady(),false);assert.equal(session.markBasicsPassed(),false);assert.equal(session.markCompleted(),false);assert.equal(storage.values.size,0);
});
