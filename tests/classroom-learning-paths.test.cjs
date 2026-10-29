const test=require('node:test'),assert=require('node:assert/strict');
const paths=require('../classroom-learning-paths.js'),study=require('../classroom-exam-study.js'),quiz=require('../classroom-quiz.js');
const card=(id,correct=0)=>({id,title:'One new idea',teach:'Read the example first.',example:'The answer is shown here.',prompt:'Which answer?',answers:['Yes','No','Maybe'],correct,hint:'Look at the example.'});
const category=(id='rhythm-tree')=>({id,title:'Rhythm',sections:[{id:'parts',title:'Note parts',tier:'basic',cards:[card('head'),card('stem',1)]},{id:'symbols',title:'Note symbols',tier:'basic',cards:[card('quarter',2)]},{id:'shorter',title:'Sixteenths',tier:'advanced',cards:[card('sixteenth')]}]});
function memory(seed={}){const values=new Map(Object.entries(seed));return {values,fail:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.fail)throw Error('quota');values.set(key,String(value));},removeItem:key=>values.delete(key)};}
function create(options={}){return paths.createSession({category:category(),storage:memory(),...options});}
function finishSection(session,model,id){const section=model.sections.find(section=>section.id===id),part=study.createSession({lessonId:model.id,cards:section.cards,storage:session.sectionStorage(id),revision:session.sectionRevision(id),canRecord:session.canRecord});for(const card of section.cards){part.tryIt();assert.equal(part.answer(card.correct),true);assert.equal(part.getState().saved,true);part.next();}return part;}

test('constructing a path is read-only and basics cannot skip the earlier explanations',()=>{
 const storage=memory({codaClassroomLessonsV1:'canonical lesson',codaClassroomQuizzesV1:'canonical quiz'}),before=[...storage.values],session=create({storage});
 assert.deepEqual([...storage.values],before);assert.equal(session.canOpenSection('parts'),true);assert.equal(session.canOpenSection('symbols'),false);assert.equal(session.canOpenSection('shorter'),false);assert.equal(session.markBasicsPassed(),false);assert.equal(session.markCompleted(),false);
 finishSection(session,category(),'parts');assert.equal(session.canOpenSection('symbols'),true);assert.equal(session.basicsReady(),false);assert.equal(session.canOpenSection('shorter'),false);
 finishSection(session,category(),'symbols');assert.equal(session.basicsReady(),true);assert.equal(session.canOpenSection('shorter'),false);assert.equal(session.markBasicsPassed(),true);assert.equal(session.canOpenSection('shorter'),true);assert.equal(session.allReady(),false);
 finishSection(session,category(),'shorter');assert.equal(session.allReady(),true);assert.equal(session.markCompleted(),true);assert.ok(session.getState().completedAt>0);
 assert.equal(storage.getItem('codaClassroomLessonsV1'),'canonical lesson');assert.equal(storage.getItem('codaClassroomQuizzesV1'),'canonical quiz');
});

test('independent section sessions resume their own card and store no teaching or answers',()=>{
 const storage=memory(),session=create({storage}),model=category();finishSection(session,model,'parts');finishSection(session,model,'symbols');
 const resumed=create({storage});assert.equal(resumed.sectionComplete('parts'),true);assert.equal(resumed.sectionComplete('symbols'),true);
 const first=study.createSession({lessonId:model.id,cards:model.sections[0].cards,storage:resumed.sectionStorage('parts'),revision:resumed.sectionRevision('parts')});assert.equal(first.getState().index,1);assert.equal(first.getState().completed,true);assert.deepEqual(first.getState().passed,['head','stem']);
 const raw=storage.getItem(paths.KEY);for(const text of ['Read the example','Which answer','Look at the example','Maybe'])assert.ok(!raw.includes(text));
 assert.equal(storage.getItem(study.KEY),null);assert.equal(storage.getItem(quiz.CUSTOM_KEY),null);
});

test('quota errors retain a correct practice answer and retry without unlocking the next section',()=>{
 const storage=memory(),session=create({storage}),model=category(),section=model.sections[0],part=study.createSession({lessonId:model.id,cards:section.cards,storage:session.sectionStorage(section.id),revision:session.sectionRevision(section.id),canRecord:session.canRecord});
 storage.fail=true;part.tryIt();part.answer(0);assert.equal(part.getState().answered,true);assert.equal(part.getState().saved,false);assert.equal(part.next(),false);assert.equal(session.canOpenSection('symbols'),false);assert.equal(storage.getItem(paths.KEY),null);
 storage.fail=false;assert.equal(part.save(),true);assert.equal(part.next(),true);part.tryIt();part.answer(1);assert.equal(session.canOpenSection('symbols'),true);
});

test('different categories merge, while two stale copies of the same category cannot overwrite each other',()=>{
 const storage=memory(),a=create({storage}),stale=create({storage}),bassModel=category('bass-clef'),bass=create({storage,category:bassModel});
 finishSection(a,category(),'parts');finishSection(bass,bassModel,'parts');finishSection(a,category(),'symbols');
 const bytes=storage.getItem(paths.KEY),section=category().sections[0],old=study.createSession({lessonId:'rhythm-tree',cards:section.cards,storage:stale.sectionStorage('parts'),revision:stale.sectionRevision('parts'),canRecord:stale.canRecord});
 old.tryIt();old.answer(0);assert.equal(old.getState().saved,false);assert.equal(stale.getState().stale,true);assert.equal(storage.getItem(paths.KEY),bytes);
 const raw=JSON.parse(bytes);assert.deepEqual(Object.keys(raw.lessons).sort(),['bass-clef','rhythm-tree']);
});

test('profile changes and edited content stop old practice from writing or awarding completion',()=>{
 const storage=memory();let allowed=true,revision='one';const session=create({storage,revision,getRevision:()=>revision,canRecord:()=>allowed});finishSection(session,category(),'parts');const bytes=storage.getItem(paths.KEY);
 allowed=false;assert.equal(session.canRecord(),false);assert.equal(session.markBasicsPassed(),false);assert.equal(session.markCompleted(),false);assert.equal(storage.getItem(paths.KEY),bytes);
 allowed=true;revision='two';assert.equal(session.canRecord(),false);assert.equal(session.getState().stale,true);revision='one';assert.equal(session.canRecord(),false);assert.equal(storage.getItem(paths.KEY),bytes);
});

test('basics quizzes use their own local slot and never replace a canonical end-of-category result',()=>{
 const storage=memory({[quiz.KEY]:'existing canonical proof',[quiz.CUSTOM_KEY]:'existing authored proof'}),session=create({storage}),model=category();finishSection(session,model,'parts');finishSection(session,model,'symbols');
 const q=quiz.createSession({lessonId:model.id,model:{version:1,title:'Basics',custom:true,questions:Array.from({length:5},(_,at)=>({id:'basics-'+at,prompt:'Choose yes.',answers:['Yes','No','Maybe'],correct:0,explanation:'Yes is correct.'}))},custom:true,contentRevision:'basic-v1',storage:session.basicsStorage,attemptStorage:storage,canRecord:session.canRecord});
 for(let at=0;at<5;at++){q.answer(0);q.next();}assert.equal(q.getState().passed,true);assert.equal(q.getState().saved,true);assert.equal(session.markBasicsPassed(),true);
 assert.equal(storage.getItem(quiz.KEY),'existing canonical proof');assert.equal(storage.getItem(quiz.CUSTOM_KEY),'existing authored proof');assert.ok(JSON.parse(storage.getItem(paths.KEY)).lessons['rhythm-tree'].basicsQuiz);
});

test('changed lessons start fresh without deleting prior progress until a successful new write',()=>{
 const storage=memory(),old=create({storage,revision:'old'});finishSection(old,category(),'parts');const bytes=storage.getItem(paths.KEY),fresh=create({storage,revision:'new'});assert.equal(fresh.sectionComplete('parts'),false);assert.equal(storage.getItem(paths.KEY),bytes);finishSection(fresh,category(),'parts');assert.equal(JSON.parse(storage.getItem(paths.KEY)).lessons['rhythm-tree'].revision,'new');assert.equal(old.markBasicsPassed(),false);
});

test('path validation rejects unknown categories, duplicate sections, and advanced-before-basic ordering',()=>{
 assert.equal(paths.validateCategory(category()),true);assert.throws(()=>create({category:category('unknown')}),/classroom category/);const wrong=category();wrong.sections[0].tier='advanced';assert.equal(paths.validateCategory(wrong),false);const duplicate=category();duplicate.sections[1].id='parts';assert.equal(paths.validateCategory(duplicate),false);
});
