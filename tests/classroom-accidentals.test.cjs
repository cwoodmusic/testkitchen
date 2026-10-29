const test=require('node:test'),assert=require('node:assert/strict');
const lesson=require('../classroom-accidentals-lesson.js'),study=require('../classroom-exam-study.js'),quiz=require('../classroom-quiz.js');
const memory=()=>{const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}};
test('the supplemental lesson teaches short, incremental concepts and keeps the exam at eight categories',()=>{
 assert.equal(lesson.ID,'accidentals-key-signatures');assert.equal(lesson.CARDS.length,16);assert.equal(new Set(lesson.CARDS.map(card=>card.id)).size,16);
 for(const card of lesson.CARDS){assert.equal(study.validCard(card),true,card.id);assert.ok(card.teach.split(/\s+/).length<=22,card.id);assert.ok(card.example.split(/\s+/).length<=45,card.id);assert.equal(Object.isFrozen(card),true);}
 const bank=require('../final-exam-bank.js');assert.equal(bank.CATEGORIES.length,8);assert.equal(bank.QUESTIONS.length,800);assert.ok(!bank.CATEGORIES.some(category=>category.id===lesson.ID));
 assert.equal(lesson.QUIZ.questions.length,5);assert.equal(lesson.QUIZ.passScore,4);assert.equal(lesson.QUIZ.custom,true);
});
test('staff diagrams put the signature between the clef and meter and show valid accidental placement',()=>{
 for(const signature of ['none','G','F','D']){
  const visual={kind:'key-signature',signature,meter:'4/4',items:[{type:'note',position:8,accidental:'natural'},{type:'bar'},{type:'note',position:8,accidental:'none'}]};
  const checked=lesson.validateVisual(visual);assert.equal(checked.ok,true);const svg=lesson.signatureSVG(checked.data);
  assert.ok(svg.indexOf('data-signature-clef')<svg.indexOf('data-key-signature'));assert.ok(svg.indexOf('data-key-signature')<svg.indexOf('data-signature-meter'));
  assert.match(svg,/data-local-accidental="natural"/);assert.match(svg,/data-signature-bar/);assert.equal((svg.match(/data-signature-note=/g)||[]).length,2);
  if(signature==='D'){assert.match(svg,/data-signature-letter="F"/);assert.match(svg,/data-signature-letter="C"/);}
  if(signature==='F')assert.match(svg,/data-signature-accidental="flat"/);
 }
});
test('imported diagrams reject unknown data and never accept executable SVG or unsafe text',()=>{
 const base={kind:'key-signature',signature:'G',meter:'4/4',items:[{type:'note',position:1,accidental:'none'}]};
 for(const patch of [{signature:'<script>'},{signature:'__proto__'},{meter:'4/4" onload="x'},{items:[{type:'image',data:'javascript:x'}]},{items:[{type:'note',position:Infinity,accidental:'sharp'}]},{items:[{type:'note',position:1,accidental:'natural',html:'<script>'}]},{items:Array(17).fill({type:'bar'})},{html:'<svg onload=x>'}]){assert.equal(lesson.validateVisual({...base,...patch}).ok,false);assert.equal(lesson.signatureSVG({...base,...patch}),'');}
});
test('study and custom quiz save only under the supplemental ID without changing canonical proof',()=>{
 const storage=memory();storage.setItem('codaClassroomLessonsV1','canonical lessons');storage.setItem(quiz.KEY,'canonical quizzes');storage.setItem('codaHaydnFinalExamV1','canonical exam');
 const game=study.createSession({lessonId:lesson.ID,cards:lesson.CARDS,storage});
 for(const card of lesson.CARDS){assert.equal(game.tryIt(),true);assert.equal(game.answer(card.correct),true);assert.equal(game.next(),true);}
 assert.equal(game.getState().completed,true);assert.equal(game.getState().saved,true);
 const q=quiz.createSession({lessonId:lesson.ID,model:lesson.QUIZ,custom:true,storage});
 lesson.QUIZ.questions.forEach((_,index)=>{const question=q.getState().question;q.answer(index===0?(question.correct+1)%question.answers.length:question.correct);q.next()});
 assert.equal(q.getState().score,4);assert.equal(q.getState().passed,true);assert.equal(q.getState().saved,true);
 assert.equal(storage.getItem(quiz.KEY),'canonical quizzes');assert.equal(storage.getItem('codaClassroomLessonsV1'),'canonical lessons');assert.equal(storage.getItem('codaHaydnFinalExamV1'),'canonical exam');
 assert.ok(JSON.parse(storage.getItem(study.KEY)).lessons[lesson.ID]);assert.ok(JSON.parse(storage.getItem(quiz.CUSTOM_KEY)).quizzes[lesson.ID]);
});
test('paused profiles and stale same-topic study sessions cannot alter another attempt',()=>{
 const storage=memory();let active=true;const first=study.createSession({lessonId:lesson.ID,cards:lesson.CARDS,storage,canRecord:()=>active});const stale=study.createSession({lessonId:lesson.ID,cards:lesson.CARDS,storage});
 first.tryIt();first.answer(lesson.CARDS[0].correct);const bytes=storage.getItem(study.KEY);
 stale.tryIt();stale.answer(lesson.CARDS[0].correct);assert.equal(stale.getState().saved,false);assert.equal(storage.getItem(study.KEY),bytes);
 active=false;assert.equal(first.next(),false);assert.equal(storage.getItem(study.KEY),bytes);
});
