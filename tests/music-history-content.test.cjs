const test=require('node:test'),assert=require('node:assert/strict');
const content=require('../music-history-content.js'),history=require('../music-history-progress.js'),legacy=require('../music-history-legacy.js');
const copy=value=>JSON.parse(JSON.stringify(value));
const blank=()=>copy(content.EMPTY);
const firstFact=content.PEOPLE.bach.facts[0],secondFact=content.PEOPLE.bach.facts[1];
const firstQuestion=content.QUESTIONS.find(question=>question.person==='bach'&&question.factId===firstFact.id);

test('authored facts and quiz overrides resolve without changing stable IDs, links, defaults, or sibling collections',()=>{
 const edits=blank();edits.facts[firstFact.id]='A revised Bach fact.';
 edits.quizzes[firstQuestion.id]={prompt:'Where does this revised question point?',choices:['First place','Second place','Third place'],answer:1};
 assert.equal(content.validate(edits),true);
 assert.deepEqual(content.resolvedFact(edits,firstFact.id),{id:firstFact.id,text:'A revised Bach fact.'});
 const quiz=content.resolvedQuiz(edits,firstQuestion.id);
 assert.deepEqual([quiz.id,quiz.person,quiz.factId],[firstQuestion.id,firstQuestion.person,firstQuestion.factId]);
 assert.equal(quiz.answer,1);assert.equal(quiz.choices[1],'Second place');
 const people=content.resolvePeople(edits),questions=content.resolveQuestions(edits);
 assert.equal(Object.keys(people).length,18);assert.equal(Object.values(people).flatMap(person=>person.facts).length,180);assert.equal(questions.length,180);
 assert.equal(people.mozart.facts[0].text,content.PEOPLE.mozart.facts[0].text);
 people.bach.facts[0].text='Mutated output';quiz.choices[0]='Mutated choice';
 assert.notEqual(content.PEOPLE.bach.facts[0].text,'A revised Bach fact.');assert.notEqual(content.QUESTIONS[0].choices[0],'Mutated choice');
 assert.equal(edits.facts[firstFact.id],'A revised Bach fact.');assert.equal(edits.quizzes[firstQuestion.id].choices[0],'First place');
});

test('content validation rejects malformed or identity-changing imports before they can replace an authored project',()=>{
 const good=blank();good.facts[firstFact.id]='Edited fact.';
 const question={prompt:'A question?',choices:['One','Two','Three'],answer:0};
 const bad=[null,[],{}, {...good,version:3}, {...good,earned:['bach-01']}, {...good,facts:[]}, {...good,quizzes:null},
  {...good,facts:{missing:'Unknown fact'}},{...good,facts:{'bach-01':'  '}},{...good,facts:{'bach-01':'x'.repeat(content.LIMITS.fact+1)}},
  {...good,quizzes:{unknown:question}}, {...good,quizzes:{[firstQuestion.id]:{...question,person:'mozart'}}},
  {...good,quizzes:{[firstQuestion.id]:{...question,choices:['One','one ','Three']}}},
  {...good,quizzes:{[firstQuestion.id]:{...question,choices:['One','Two']}}},
  {...good,quizzes:{[firstQuestion.id]:{...question,answer:3}}},
  {...good,quizzes:{[firstQuestion.id]:{...question,prompt:''}}},
  JSON.parse('{"version":1,"facts":{"__proto__":"bad"},"quizzes":{}}')];
 for(const value of bad){assert.equal(content.validate(value),false);assert.equal(content.normalize(value),null);}
 assert.deepEqual(good,{version:2,facts:{[firstFact.id]:'Edited fact.'},quizzes:{}});
});

test('normalization trims edited text and stores only overrides; literal markup stays plain content',()=>{
 const edits=blank();edits.facts[firstFact.id]='  '+content.PEOPLE.bach.facts[0].text+'  ';
 edits.facts[secondFact.id]='  <strong>Literal historical text</strong>  ';
 edits.quizzes[firstQuestion.id]={prompt:' '+firstQuestion.prompt+' ',choices:firstQuestion.choices.map(choice=>' '+choice+' '),answer:firstQuestion.answer};
 const normalized=content.normalize(edits);
 assert.deepEqual(normalized,{version:2,facts:{[secondFact.id]:'<strong>Literal historical text</strong>'},quizzes:{}});
 assert.equal(content.resolvedFact(normalized,secondFact.id).text,'<strong>Literal historical text</strong>');
 assert.equal(content.resolvedFact(normalized,'missing'),null);assert.equal(content.resolvedQuiz(normalized,'missing'),null);
});

test('version 1 authoring keeps retired facts and archives quiz edits that belong to different lessons',()=>{
 const retired=legacy.FACT_IDS.find(id=>!content.FACTS.some(fact=>fact.id===id));
 const remapped=content.QUESTIONS.find(question=>legacy.QUIZ_FACTS[question.id]!==question.factId);
 const unchanged=content.QUESTIONS.find(question=>legacy.QUIZ_FACTS[question.id]===question.factId);
 assert.ok(retired,'The shorter catalog retires original facts.');
 assert.ok(remapped,'Some stable quiz IDs are reassigned to selected lessons.');
 assert.ok(unchanged,'Some quiz IDs still refer to their original lessons.');
 const oldQuestion={prompt:'  A question about the original lesson?  ',choices:[' Old first ','Old second','Old third'],answer:1};
 const legacyEdits={version:1,facts:{[retired]:'  Preserve this retired author text.  ',[firstFact.id]:'Current edited lesson.'},quizzes:{[remapped.id]:oldQuestion,[unchanged.id]:{...oldQuestion,prompt:'A question that still belongs here?'}}};
 assert.equal(content.validate(legacyEdits),true);
 const migrated=content.normalize(legacyEdits);
 assert.equal(migrated.version,2);assert.equal(migrated.facts[retired],'Preserve this retired author text.');
 assert.equal(migrated.facts[firstFact.id],'Current edited lesson.');
 assert.equal(Object.hasOwn(migrated.quizzes,remapped.id),false);
 assert.deepEqual(migrated.archivedQuizzes[remapped.id],{prompt:'A question about the original lesson?',choices:['Old first','Old second','Old third'],answer:1});
 assert.equal(migrated.quizzes[unchanged.id].prompt,'A question that still belongs here?');
 assert.equal(content.resolvedFact(migrated,retired),null);
 assert.equal(content.resolvePeople(migrated).bach.facts.length,10);
 assert.deepEqual(content.resolvedQuiz(legacyEdits,remapped.id),remapped);
 assert.equal(content.resolveQuestions(migrated).find(question=>question.id===remapped.id).prompt,remapped.prompt);
 assert.deepEqual(content.normalize(migrated),migrated,'Repeated loading and exporting preserves the backup.');
});

test('version 2 permits an intentional current quiz edit alongside its inactive legacy backup',()=>{
 const remapped=content.QUESTIONS.find(question=>legacy.QUIZ_FACTS[question.id]!==question.factId);
 assert.ok(remapped);
 const backup={prompt:'Retired question?',choices:['Old A','Old B','Old C'],answer:2};
 const edits=blank();edits.archivedQuizzes={[remapped.id]:backup};
 edits.quizzes[remapped.id]={prompt:'An edited question for the current lesson?',choices:['New A','New B','New C'],answer:0};
 const normalized=content.normalize(edits);
 assert.ok(normalized);assert.deepEqual(normalized.archivedQuizzes,edits.archivedQuizzes);
 assert.equal(content.resolvedQuiz(normalized,remapped.id).prompt,'An edited question for the current lesson?');
 delete normalized.quizzes[remapped.id];
 assert.equal(content.resolvedQuiz(normalized,remapped.id).prompt,remapped.prompt,'Removing a current edit never activates the archived question.');
 for(const archivedQuizzes of [[],{unknown:backup},{[remapped.id]:{...backup,choices:['Same','same','Other']}},{[remapped.id]:{...backup,prompt:'x'.repeat(content.LIMITS.prompt+1)}}]){
  const invalid={...edits,archivedQuizzes};assert.equal(content.validate(invalid),false);assert.equal(content.normalize(invalid),null);
 }
 assert.equal(content.validate({...edits,version:1}),false,'Version 1 cannot already contain a version 2 archive.');
});

test('all original authored fact identities remain importable after reducing each musician to ten lessons',()=>{
 const edits={version:1,facts:Object.fromEntries(legacy.FACT_IDS.map(id=>[id,'Authored text for '+id])),quizzes:Object.fromEntries(Object.keys(legacy.QUIZ_FACTS).map(id=>[id,{prompt:'Original authored quiz '+id+'?',choices:['First','Second','Third'],answer:0}]))};
 const migrated=content.normalize(edits);
 assert.ok(migrated);assert.equal(Object.keys(migrated.facts).length,540);
 assert.equal(Object.keys(migrated.quizzes).length+Object.keys(migrated.archivedQuizzes).length,180,'Every original quiz edit stays active or is backed up.');
 assert.equal(Object.values(content.resolvePeople(migrated)).reduce((sum,person)=>sum+person.facts.length,0),180);
 assert.equal(content.validate({...migrated,facts:{...migrated.facts,'bach-31':'Not an original identity.'}}),false);
});

function progressFixture(){
 const values=new Map();let edits=blank();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const engine=history.create({storage,getContent:()=>copy(edits),canUse:()=>true,canTalk:()=>true,canVisitScholar:()=>true,isDeveloperTest:()=>true,random:()=>0,wallet:{grantReward:()=>({ok:true,amount:0})}});
 return {engine,values,setContent:next=>edits=next};
}

test('edited text reaches learned facts and carried/recorded views without adding discoveries or rewriting player state',()=>{
 const fixture=progressFixture(),edits=blank();edits.facts[firstFact.id]='Bach’s edited first fact.';fixture.setContent(edits);
 fixture.engine.developerSet('bach','ready');const learned=fixture.engine.learnFact('bach');
 assert.equal(learned.fact.id,firstFact.id);assert.equal(learned.fact.text,'Bach’s edited first fact.');
 const before=fixture.values.get(history.KEY);let person=fixture.engine.snapshot().people.find(person=>person.id==='bach');
 assert.equal(person.facts[0].text,'Bach’s edited first fact.');assert.equal(person.facts[1].locked,true);assert.equal(Object.hasOwn(person.facts[1],'text'),false);
 edits.facts[firstFact.id]='A later correction to the same fact.';fixture.setContent(edits);
 person=fixture.engine.conversation('bach');assert.equal(person.facts[0].text,'A later correction to the same fact.');
 assert.equal(fixture.values.get(history.KEY),before);assert.deepEqual(fixture.engine.snapshot().carriedIDs,[firstFact.id]);
});

test('a quiz snapshots authored questions, answers, and fact explanations and keeps that attempt stable through later edits',()=>{
 const fixture=progressFixture(),edits=blank();edits.facts[firstFact.id]='The explanation at quiz start.';
 edits.quizzes[firstQuestion.id]={prompt:'A new authored question?',choices:['Choice alpha','Choice beta','Choice gamma'],answer:2};fixture.setContent(edits);
 fixture.engine.developerSet('bach','recorded');assert.equal(fixture.engine.startQuiz('bach').ok,true);
 const initial=fixture.engine.quizState(),question=initial.questions.find(question=>question.id===firstQuestion.id);
 assert.equal(question.prompt,'A new authored question?');assert.ok(question.choices.includes('Choice gamma'));assert.equal(Object.hasOwn(question,'answer'),false);
 edits.facts[firstFact.id]='This later explanation must wait for the next attempt.';
 edits.quizzes[firstQuestion.id]={prompt:'A later question?',choices:['New alpha','New beta','New gamma'],answer:0};fixture.setContent(edits);
 assert.deepEqual(fixture.engine.quizState(),initial);
 for(const question of initial.questions){const source=question.id===firstQuestion.id?{choices:['Choice alpha','Choice beta','Choice gamma'],answer:2}:content.QUESTIONS.find(item=>item.id===question.id);fixture.engine.answerQuiz(question.id,question.choices.indexOf(source.choices[source.answer]));}
 const finished=fixture.engine.finishQuiz();assert.equal(finished.score,100);
 assert.equal(finished.questions.find(question=>question.id===firstQuestion.id).explanation,'The explanation at quiz start.');
 fixture.engine.startQuiz('bach');const next=fixture.engine.quizState().questions.find(question=>question.id===firstQuestion.id);assert.equal(next.prompt,'A later question?');
});
