const test=require('node:test'),assert=require('node:assert/strict');
const history=require('../music-history.js'),progress=require('../music-history-progress.js'),questions=require('../music-history-quiz-data.js'),profiles=require('../classroom-profile-data.js'),visitors=require('../npc-visitors.js');
function fixture(){const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};const engine=progress.create({storage,canTalk:()=>true,canUse:()=>true,canVisitScholar:()=>true});return {engine,storage,values};}
test('18 characters have ten digestible facts each; service attendants are excluded',()=>{
 assert.equal(Object.keys(history.PEOPLE).length,18);const ids=[];
 for(const [id,person]of Object.entries(history.PEOPLE)){assert.equal(person.facts.length,10,id);for(const fact of person.facts){ids.push(fact.id);assert.ok(fact.text.length>=15&&fact.text.length<240,fact.id);assert.ok(fact.id.startsWith(id+'-'));}}
 assert.equal(new Set(ids).size,180);for(const id of ['scholar','shop','boutique','captain-cadence','__proto__'])assert.equal(Object.hasOwn(history.PEOPLE,id),false);for(const visitor of visitors.profiles)assert.ok(Object.hasOwn(history.PEOPLE,visitor.id));
});
test('each character has ten distinct fact-linked quiz questions with valid answer choices',()=>{
 assert.equal(questions.length,180);assert.equal(new Set(questions.map(q=>q.id)).size,180);
 for(const [id,person]of Object.entries(history.PEOPLE)){const pool=questions.filter(q=>q.person===id);assert.equal(pool.length,10);assert.equal(new Set(pool.map(q=>q.factId)).size,10,'each fact has one quiz question');
  for(const q of pool){assert.ok(person.facts.some(f=>f.id===q.factId));assert.ok(q.prompt.length>15);assert.ok(q.choices.length>=3);assert.equal(new Set(q.choices).size,q.choices.length);assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length);}
 }
});
test('facts cannot be clicked free; only a fresh accepted quest can unlock one fact',()=>{
 const {engine}=fixture();assert.equal(engine.learnFact('bach').ok,false);assert.equal(engine.snapshot().count,0);engine.acceptQuest('bach');const token=engine.beginRun('pitch');assert.ok(token);
 engine.recordResult('pitch','real-completed-run',{mode:'classic',correct:12,score:12,misses:0,streak:12,won:true,perfect:true},token);assert.equal(engine.conversation('bach').hasNewFact,true);assert.equal(engine.learnFact('bach').fact.id,history.PEOPLE.bach.facts[0].id);assert.equal(engine.learnFact('bach').ok,false);assert.equal(engine.snapshot().carriedIDs.length,1);assert.equal(engine.snapshot().recordedCount,0);
});
test('relationship inventory follows local player isolation and stays out of cloud profiles',()=>{
 const {engine,storage}=fixture();engine.acceptQuest('bach');const token=engine.beginRun('pitch');engine.recordResult('pitch','profile-safe-run',{mode:'classic',correct:12,score:12,misses:0,streak:12,won:true,perfect:true},token);engine.learnFact('bach');
 const backup=profiles.backup(storage);assert.ok(profiles.LOCAL_ONLY_KEYS.includes(history.KEY));assert.equal(profiles.clear(storage).ok,true);assert.equal(engine.snapshot().count,0);assert.equal(profiles.restore(storage,backup).ok,true);assert.equal(engine.snapshot().carriedIDs.length,1);
 const captured=profiles.capture(storage);assert.equal(captured.ok,true);assert.ok(!JSON.stringify(captured).includes(history.KEY));delete backup.values[history.KEY];assert.equal(profiles.restore(storage,backup).ok,true);assert.equal(engine.snapshot().count,0);
});
