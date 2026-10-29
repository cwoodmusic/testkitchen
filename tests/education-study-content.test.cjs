const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../education-content.js'),'utf8');
const bank=require('../final-exam-bank.js'),quiz=require('../classroom-quiz.js'),tutorials=require('../classroom-tutorials.js'),time=require('../time-signature-lesson.js'),notation=require('../education-notation.js');
const plain=value=>JSON.parse(JSON.stringify(value));
const card={id:'tempo-seconds',title:'Seconds and beats',teach:'At 60 BPM, each beat lasts one second.',example:'Four beats at 60 BPM take four seconds.',prompt:'How long do four beats last at 60 BPM?',answers:['Four seconds','Two seconds','Eight seconds'],correct:0,hint:'Count one second for each beat.',visual:{kind:'tempo',text:'Metronome',bpm:60},covers:['tempo-083','tempo-086']};
function library(extra=null){
 const window={CodaFinalExamBank:bank,CodaClassroomQuiz:quiz,CodaClassroomTutorials:tutorials,CodaTimeSignatureLesson:time,CodaEducationNotation:{validate:value=>notation.validate(plain(value))},CodaExamCurriculum:{forLesson:id=>id==='tempo'?[plain(card)]:[]}};
 if(extra)window.CodaAccidentalsLesson=extra;vm.runInNewContext(source,{window});return window.CodaEducationContent;
}
const disk=()=>({values:new Map(),writes:[],getItem(key){return this.values.get(key)??null;},setItem(key,value){this.writes.push(key);this.values.set(key,value);},removeItem(key){this.values.delete(key);}});

test('legacy author exports gain the current teaching cards while preserving all existing edits',()=>{
 const content=library(),defaults=content.getDefaults(),legacy=plain(defaults);
 assert.deepEqual(plain(defaults.lessons.tempo.study),[card]);
 for(const lesson of Object.values(legacy.lessons))delete lesson.study;
 legacy.exam.questions[0].prompt='An existing teacher question';legacy.lessons.tempo.steps[0].guide='An existing teaching edit';
 const checked=content.validate(legacy);assert.equal(checked.ok,true,checked.error);
 assert.equal(checked.data.exam.questions[0].prompt,'An existing teacher question');
 assert.equal(checked.data.lessons.tempo.steps[0].guide,'An existing teaching edit');
 assert.deepEqual(plain(checked.data.lessons.tempo.study),[card]);
 legacy.lessons.tempo.study=[];assert.deepEqual(plain(content.validate(legacy).data.lessons.tempo.study),[],'An explicit deletion is distinct from an old missing field');
});

test('teaching-card changes get their own revisions without moving canonical lesson or quiz saves',()=>{
 const content=library(),storage=disk(),store=content.createStore({storage,canEdit:()=>true});
 const oldStudy=store.getStudyRevision('tempo'),oldLesson=store.getLessonRevision('tempo'),other=store.getLessonRevision('bass-clef'),document=store.getDocument();
 document.lessons.tempo.study[0].teach='At 120 BPM, two beats fit in one second.';
 assert.equal(store.saveDocument(document).ok,true);
 assert.notEqual(store.getStudyRevision('tempo'),oldStudy);assert.notEqual(store.getLessonRevision('tempo'),oldLesson);assert.equal(store.getLessonRevision('bass-clef'),other);
 assert.equal(store.isStudyEdited('tempo'),true);assert.equal(store.isLessonEdited('tempo'),false);assert.strictEqual(store.getQuiz('tempo'),quiz.QUIZZES.tempo);assert.strictEqual(store.getExamBank(),bank);
 assert.deepEqual(storage.writes,[content.KEY]);
 const cards=store.getStudyCards('tempo');cards[0].teach='Mutated copy';assert.notEqual(store.getStudyCards('tempo')[0].teach,'Mutated copy');
 assert.deepEqual(plain(store.getStudyCards('unknown')),[]);assert.equal(store.getStudyRevision('unknown'),'');
});

test('teaching cards support add, edit, delete, correct answers, and safe notation exports',()=>{
 const content=library(),store=content.createStore({storage:disk(),canEdit:()=>true}),document=store.getDocument();
 const score={version:1,clef:'bass',meter:'4/4',items:[{type:'note',position:6,duration:2,dots:0,accidental:'none',staff:'bass'},{type:'repeat-end'}]};
 document.lessons.tempo.study[0].answers.push('Six seconds');document.lessons.tempo.study[0].correct=3;document.lessons.tempo.study[0].visual={kind:'notation',score};
 document.lessons.tempo.study.push({...plain(card),id:'new-tempo-card',title:'A second idea',covers:[]});
 assert.equal(store.saveDocument(document).ok,true);assert.equal(store.getStudyCards('tempo').length,2);assert.equal(store.getStudyCards('tempo')[0].correct,3);
 const other=content.createStore({storage:disk(),canEdit:()=>true});assert.equal(other.importDocument(store.exportDocument()).ok,true);assert.deepEqual(plain(other.getStudyCards('tempo')),plain(store.getStudyCards('tempo')));
 const deleted=other.getDocument();deleted.lessons.tempo.study.splice(0,1);assert.equal(other.saveDocument(deleted).ok,true);assert.equal(other.getStudyCards('tempo')[0].id,'new-tempo-card');
});

test('invalid teaching cards cannot overwrite the last saved author document',()=>{
 const content=library(),storage=disk(),store=content.createStore({storage,canEdit:()=>true});assert.equal(store.saveDocument(store.getDocument()).ok,true);const saved=storage.getItem(content.KEY);
 for(const mutate of [
  item=>item.id='<script>',item=>item.correct=9,item=>item.answers=['Only one'],item=>item.answers[1]=item.answers[0],
  item=>item.teach='',item=>item.privateEmail='teacher@example.com',item=>item.visual={kind:'html',html:'<script>'},
  item=>item.covers=['tempo-083','tempo-083'],item=>item.covers=['<script>'],item=>item.title='X'.repeat(121)
 ]){const document=store.getDocument();mutate(document.lessons.tempo.study[0]);assert.equal(store.saveDocument(document).ok,false);assert.equal(storage.getItem(content.KEY),saved);}
 const repeated=store.getDocument();repeated.lessons.tempo.study.push(plain(repeated.lessons.tempo.study[0]));assert.equal(store.saveDocument(repeated).ok,false);
 const tooMany=store.getDocument();tooMany.lessons.tempo.study=Array.from({length:101},(_,index)=>({...plain(card),id:'card-'+index}));assert.equal(store.saveDocument(tooMany).ok,false);
});

test('student content uses published cards and cannot apply a device author draft',async()=>{
 const content=library(),storage=disk();let editable=true;const published=content.getDefaults();published.lessons.tempo.study[0].teach='Shared teaching';
 const store=content.createStore({storage,canEdit:()=>editable,fetch:async()=>({ok:true,json:async()=>published})}),draft=store.getDocument();draft.lessons.tempo.study[0].teach='Private author teaching';assert.equal(store.saveDocument(draft).ok,true);
 await store.loadPublished();assert.equal(store.getStudyCards('tempo')[0].teach,'Private author teaching');editable=false;
 assert.equal(store.getStudyCards('tempo')[0].teach,'Shared teaching');assert.equal(store.saveDocument(draft).ok,false);assert.equal(storage.writes.length,1);
});

test('rest and tie teaching pictures keep written silence and tied durations in the safe model',()=>{
 const content=library(),document=content.getDefaults();document.lessons.tempo.study[0].visual={kind:'note',beats:.5,rest:true};
 assert.deepEqual(plain(content.validate(document).data.lessons.tempo.study[0].visual),{kind:'note',beats:.5,rest:true});
 document.lessons.tempo.study[0].visual={kind:'tie',notes:[{beats:2},{beats:1}],meter:'4/4'};
 assert.deepEqual(plain(content.validate(document).data.lessons.tempo.study[0].visual),{kind:'tie',notes:[{beats:2},{beats:1}],meter:'4/4'});
 document.lessons.tempo.study[0].visual.notes[0].onclick='alert(1)';assert.equal(content.validate(document).ok,false);
});

test('the actual curriculum survives an untouched save without becoming a private authored course',()=>{
 const content=require('../education-content.js'),curriculum=require('../classroom-exam-curriculum.js'),paths=require('../classroom-learning-paths-data.js'),store=content.createStore({storage:disk(),canEdit:()=>true});
 const before=Object.fromEntries(content.CATEGORIES.map(({id})=>[id,store.getStudyRevision(id)]));
 assert.equal(store.saveDocument(store.getDocument()).ok,true);
 for(const {id}of content.CATEGORIES){assert.ok(curriculum.forLesson(id).length>0);assert.deepEqual(store.getStudyCards(id).map(card=>card.id),paths.getCards(id).map(card=>card.id));assert.equal(store.isStudyEdited(id),false);assert.equal(store.isLessonEdited(id),false);assert.equal(store.getStudyRevision(id),before[id]);}
});

test('a supplemental lesson has editable cards and a custom quiz without adding an exam category',()=>{
 const id='accidentals-key-signatures',extra={ID:id,TITLE:'Accidentals & key signatures',CARDS:[{...plain(card),id:'accidentals-half-step',covers:[]}],QUIZ:{version:1,title:'Accidentals check',questions:Array.from({length:5},(_,index)=>({id:'accidentals-q-'+index,prompt:'Choose the accidental.',answers:['Sharp','Flat','Natural'],correct:index%3,explanation:'Read the written sign.',visual:null}))}};
 const content=library(extra),storage=disk(),store=content.createStore({storage,canEdit:()=>true}),document=store.getDocument();
 assert.equal(content.EXAM_IDS.length,8);assert.equal(content.LESSON_IDS.length,9);assert.equal(content.EXAM_IDS.includes(id),false);assert.equal(content.LESSON_IDS.includes(id),true);
 assert.equal(document.lessons[id].title,extra.TITLE);assert.deepEqual(plain(store.getLessonSteps(id)),[]);assert.equal(store.getStudyCards(id)[0].id,'accidentals-half-step');
 const model=store.getQuiz(id);assert.equal(model.custom,true);assert.equal(model.questions.length,5);assert.equal(model.passScore,4);assert.ok(model.revision);
 const revision=store.getLessonRevision(id);document.lessons[id].study[0].teach='A sharp raises the note by a half step.';document.quizzes[id].questions[0].answers.push('Rest');document.quizzes[id].questions[0].correct=3;
 assert.equal(store.saveDocument(document).ok,true);assert.equal(store.getQuiz(id).questions[0].correct,3);assert.notEqual(store.getLessonRevision(id),revision);assert.strictEqual(store.getExamBank(),bank);
 const legacy=store.getDocument();delete legacy.lessons[id];delete legacy.quizzes[id];assert.equal(store.importDocument(legacy).ok,true);assert.equal(store.getStudyCards(id).length,1);assert.equal(store.getQuiz(id).questions.length,5);
 const invalid=store.getDocument();invalid.exam.questions[0].category=id;assert.equal(store.saveDocument(invalid).ok,false,'The extra lesson cannot silently become a ninth exam category');
 assert.deepEqual([...storage.values.keys()],[content.KEY]);
});
