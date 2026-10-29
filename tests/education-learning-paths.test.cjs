const test=require('node:test'),assert=require('node:assert/strict');
const content=require('../education-content.js'),paths=require('../classroom-learning-paths-data.js'),quiz=require('../classroom-quiz.js'),bank=require('../final-exam-bank.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const disk=()=>({values:new Map(),writes:[],getItem(key){return this.values.get(key)??null;},setItem(key,value){this.writes.push(key);this.values.set(key,value);},removeItem(key){this.values.delete(key);}});

test('every new category foundation is editable while canonical assessments stay unchanged',()=>{
 const storage=disk(),store=content.createStore({storage,canEdit:()=>true}),document=store.getDocument();
 assert.equal(storage.writes.length,0);
 for(const id of content.LESSON_IDS){assert.deepEqual(store.getStudyCards(id).map(card=>card.id),paths.getCards(id).map(card=>card.id));assert.ok(store.getStudyCards(id).length);}
 const parts=document.lessons['rhythm-tree'].study.find(card=>card.visual?.kind==='note-parts');assert.ok(parts,'Rhythm note parts must be present in the teacher editor.');
 const clef=document.lessons['bass-clef'].study.find(card=>card.visual?.kind==='clef-intro');assert.ok(clef,'Bass clef explanation must be present in the teacher editor.');
 parts.teach='Find the round notehead first.';parts.visual={kind:'note-parts',focus:'head',beats:1};clef.visual.page='clef';
 assert.equal(store.saveDocument(document).ok,true);assert.equal(store.isStudyEdited('rhythm-tree'),true);assert.equal(store.isLessonEdited('rhythm-tree'),false);
 assert.deepEqual(store.getStudyCards('rhythm-tree').find(card=>card.id===parts.id).visual,parts.visual);
 assert.strictEqual(store.getQuiz('rhythm-tree'),quiz.QUIZZES['rhythm-tree']);assert.strictEqual(store.getExamBank(),bank);
 const reopened=content.createStore({storage,canEdit:()=>true});assert.deepEqual(reopened.getDocument(),store.getDocument());
 assert.deepEqual([...storage.values.keys()],[content.KEY],'Teaching configuration never writes player progress.');
});

test('safe teaching diagrams round trip and reject unknown executable fields or unsupported choices',()=>{
 const store=content.createStore({storage:disk(),canEdit:()=>true}),document=store.getDocument(),card=document.lessons['rhythm-tree'].study[0];
 for(const visual of [{kind:'note-parts',focus:'head',beats:4},{kind:'note-parts',focus:'flag',beats:.5},{kind:'clef-intro',clef:'bass',page:'spaces'},{kind:'rhythm-tree',level:3},{kind:'keyboard',notes:['E-flat','E'],label:'Compare neighboring keys'}]){
  card.visual=visual;const result=store.saveDocument(document);assert.equal(result.ok,true,result.error);assert.deepEqual(store.getStudyCards('rhythm-tree')[0].visual,visual);
 }
 const saved=store.exportDocument();
 for(const visual of [{kind:'note-parts',focus:'html',beats:.5},{kind:'note-parts',focus:'head',beats:.25},{kind:'note-parts',focus:'all',beats:1,onclick:'alert(1)'},{kind:'clef-intro',clef:'alto',page:'staff'},{kind:'clef-intro',clef:'treble',page:'<script>'},{kind:'clef-intro',clef:'bass',page:'clef',svg:'<script>'},{kind:'rhythm-tree',level:4},{kind:'rhythm-tree',level:2,html:'<script>'},{kind:'keyboard',notes:['H']},{kind:'keyboard',notes:[],onclick:'alert(1)'}]){
  card.visual=visual;assert.equal(store.saveDocument(document).ok,false);assert.equal(store.exportDocument(),saved);
 }
});

test('old missing study fields gain foundations but explicit teacher deletions and card order survive',()=>{
 const store=content.createStore({storage:disk(),canEdit:()=>true}),legacy=store.getDocument();
 for(const lesson of Object.values(legacy.lessons))delete lesson.study;
 assert.equal(store.importDocument(legacy).ok,true);assert.deepEqual(store.getStudyCards('rhythm-tree').map(card=>card.id),paths.getCards('rhythm-tree').map(card=>card.id));
 const document=store.getDocument(),rhythm=document.lessons['rhythm-tree'];
 const removed=rhythm.study.find(card=>card.visual?.kind==='note-parts');rhythm.study=rhythm.study.filter(card=>card.id!==removed.id);
 const original=paths.getCategory('rhythm-tree').sections.find(section=>section.cards.length>1),originalIds=original.cards.map(card=>card.id).filter(id=>id!==removed.id);
 const ordered=rhythm.study.filter(card=>originalIds.includes(card.id)).reverse(),rest=rhythm.study.filter(card=>!originalIds.includes(card.id));rhythm.study=[...ordered,...rest];
 rhythm.study.push({...copy(rhythm.study[0]),id:'teacher-extra-rhythm',title:'My extra rhythm practice',covers:[]});
 assert.equal(store.saveDocument(document).ok,true);
 const category=paths.getCategory('rhythm-tree',{content:store}),cards=category.sections.flatMap(section=>section.cards);
 assert.equal(cards.some(card=>card.id===removed.id),false,'Reopening a pathway must not resurrect a deleted foundation.');
 assert.deepEqual(category.sections.find(section=>section.id===original.id).cards.map(card=>card.id),ordered.map(card=>card.id));
 assert.equal(category.sections.find(section=>section.cards.some(card=>card.id==='teacher-extra-rhythm')).tier,'advanced');
 const empty=store.getDocument();empty.lessons['rhythm-tree'].study=[];assert.equal(store.saveDocument(empty).ok,true);assert.equal(paths.getCategory('rhythm-tree',{content:store}).sections.flatMap(section=>section.cards).length,0);
});

test('an old explicit teacher draft gains only new foundations once and keeps original edits and deletions',()=>{
 const store=content.createStore({storage:disk(),canEdit:()=>true}),legacy=store.getDocument();delete legacy.learningPathsVersion;
 for(const [id,lesson]of Object.entries(legacy.lessons)){const extras=new Set((paths.EXTRA[id]||[]).map(card=>card.id));lesson.study=lesson.study.filter(card=>!extras.has(card.id));}
 const original=legacy.lessons['note-naming'].study,edited=original[0],removed=original.at(-1);edited.teach='This is my carefully edited original introduction.';
 legacy.lessons['note-naming'].study=original.filter(card=>card.id!==removed.id);
 assert.equal(store.importDocument(legacy).ok,true);const migrated=store.getDocument();assert.equal(migrated.learningPathsVersion,1);
 const treble=migrated.lessons['note-naming'].study;assert.equal(treble.find(card=>card.id===edited.id).teach,edited.teach);assert.equal(treble.some(card=>card.id===removed.id),false);
 assert.ok(treble.findIndex(card=>card.id==='path-treble-clef')<treble.findIndex(card=>card.id==='treble-check-clef'),'Teach the newly introduced clef before the old clef practice.');
 for(const [id,extras]of Object.entries(paths.EXTRA))for(const card of extras)assert.equal(migrated.lessons[id].study.filter(item=>item.id===card.id).length,1);
 migrated.lessons['note-naming'].study=treble.filter(card=>card.id!=='path-treble-clef');assert.equal(store.saveDocument(migrated).ok,true);
 const roundtrip=content.createStore({storage:disk(),canEdit:()=>true});assert.equal(roundtrip.importDocument(store.exportDocument()).ok,true);
 assert.equal(roundtrip.getStudyCards('note-naming').some(card=>card.id==='path-treble-clef'),false,'The version marker preserves a later intentional foundation deletion.');
 for(const marker of [0,2,'1',null]){const invalid=store.getDocument();invalid.learningPathsVersion=marker;assert.equal(store.saveDocument(invalid).ok,false);}
});
