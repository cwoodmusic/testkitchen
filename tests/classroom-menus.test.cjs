const test=require('node:test'),assert=require('node:assert/strict');
const menus=require('../classroom-menus.js'),paths=require('../classroom-learning-paths.js'),data=require('../classroom-learning-paths-data.js'),quiz=require('../classroom-quiz.js'),study=require('../classroom-exam-study.js'),tutorials=require('../classroom-tutorials.js');
function memory(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};}
function session(storage,id='rhythm-tree'){
 const category=data.getCategory(id),model=quiz.QUIZZES[id];
 return {category,session:paths.createSession({category,storage,revision:paths.revisionOf(category,model,''),getChecks:card=>data.getChecks(id,card)})};
}
function finishSection(current,category,id){
 const section=category.sections.find(section=>section.id===id);
 current.sectionStorage(id).setItem(study.KEY,JSON.stringify({version:1,lessons:{[category.id]:{revision:current.sectionRevision(id),index:section.cards.length-1,passed:section.cards.map(card=>card.id)}}}));
}
test('the menu reads all nine topics without modifying saves or creating fake progress',()=>{
 const storage=memory(),before=[...storage.values],lessons=menus.readProgress({storage});
 assert.equal(lessons.length,9);assert.deepEqual(lessons.slice(0,3).map(lesson=>lesson.title),['Note names','Note lengths','Time signatures']);
 assert.ok(lessons.every(lesson=>lesson.status==='new'&&!lesson.unavailable));
 assert.equal(menus.recommendedLesson(lessons).id,'note-naming');assert.deepEqual([...storage.values],before);
});
test('Continue finds the first available unfinished section and preserves the saved card index',()=>{
 const storage=memory(),{category,session:current}=session(storage);
 const first=category.sections[0],second=category.sections[1];finishSection(current,category,first.id);
 current.sectionStorage(second.id).setItem(study.KEY,JSON.stringify({version:1,lessons:{[category.id]:{revision:current.sectionRevision(second.id),index:1,passed:[second.cards[0].id]}}}));
 const before=[...storage.values],lessons=menus.readProgress({storage}),rhythm=lessons.find(lesson=>lesson.id===category.id);
 assert.equal(rhythm.status,'progress');assert.equal(rhythm.sectionId,second.id);assert.match(rhythm.detail,new RegExp(second.cards[1].title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.equal(menus.recommendedLesson(lessons).id,'rhythm-tree');assert.deepEqual([...storage.values],before);
});
test('practice steps alone do not count as Finished, and advanced gates stay intact',()=>{
 const storage=memory(),{category,session:current}=session(storage);
 for(const section of category.sections.filter(section=>section.tier==='basic'))finishSection(current,category,section.id);
 let rhythm=menus.readProgress({storage}).find(lesson=>lesson.id===category.id);
 assert.equal(rhythm.status,'progress');assert.equal(rhythm.sectionId,undefined);assert.equal(rhythm.basicsPassed,false);assert.match(rhythm.detail,/basics quiz/);
 assert.ok(rhythm.sections.filter(section=>section.tier==='advanced').every(section=>!section.available));
 assert.equal(current.markBasicsPassed(),true);
 for(const section of category.sections.filter(section=>section.tier==='advanced'))finishSection(current,category,section.id);
 rhythm=menus.readProgress({storage}).find(lesson=>lesson.id===category.id);assert.equal(rhythm.status,'progress');assert.match(rhythm.detail,/full category quiz/);
 assert.equal(current.markCompleted(),true);rhythm=menus.readProgress({storage}).find(lesson=>lesson.id===category.id);assert.equal(rhythm.status,'finished');assert.equal(rhythm.sectionId,null);
});
test('a stale content revision cannot display Finished or resume an unlocked section',()=>{
 const storage=memory(),{category,session:current}=session(storage);finishSection(current,category,category.sections[0].id);
 const content={getLessonRevision:()=> 'new-content-revision',getQuiz:id=>quiz.QUIZZES[id]};
 const rhythm=menus.readProgress({storage,content}).find(lesson=>lesson.id===category.id);
 assert.equal(rhythm.status,'new');assert.equal(rhythm.passed,0);assert.equal(rhythm.sectionId,null);
});
test('legacy completion requires both the saved finished lesson and a saved passing quiz',()=>{
 const storage=memory(),id='note-naming',total=tutorials.LESSONS.find(lesson=>lesson.id===id).total;
 storage.setItem(tutorials.KEY,JSON.stringify({version:1,lessons:{[id]:{step:total,completed:true,completedAt:1234}}}));
 assert.equal(menus.readProgress({storage}).find(lesson=>lesson.id===id).status,'new');
 const current=quiz.createSession({lessonId:id,storage,randomize:false});for(const question of quiz.QUIZZES[id].questions){assert.equal(current.answer(question.correct),true);current.next();}
 const before=[...storage.values],lesson=menus.readProgress({storage}).find(lesson=>lesson.id===id);
 assert.equal(lesson.status,'finished');assert.equal(lesson.started,true);assert.deepEqual([...storage.values],before);
});
test('an unreadable journal reports no invented progress and leaves the save untouched',()=>{
 const storage=memory();storage.setItem(paths.KEY,'broken');const before=[...storage.values],lessons=menus.readProgress({storage});
 assert.ok(lessons.every(lesson=>lesson.status==='new'&&lesson.unavailable));assert.deepEqual([...storage.values],before);
});
