const test=require('node:test'),assert=require('node:assert/strict');
const history=require('../music-history-progress.js'),quizData=require('../music-history-quiz-data.js'),{createWallet}=require('../notes-shop.js');
function fixture(options={}){
 const values=options.values||new Map();let near=true,scholar=true,allowed=true,owner='guest',dev=false,writeHook=null;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(writeHook)writeHook(key,value);values.set(key,value);},removeItem:key=>values.delete(key)};
 const wallet=options.wallet||createWallet({storage});const events=[];
 const api={storage,wallet,canUse:()=>allowed,getIdentity:()=>owner,canTalk:()=>near,canVisitScholar:()=>scholar,isDeveloperTest:()=>dev,random:()=>0,onFactReady:event=>events.push(event),...options.api};
 const store=history.create(api);
 return {store,wallet,values,storage,api,events,setNear:value=>near=value,setScholar:value=>scholar=value,setAllowed:value=>allowed=value,setOwner:value=>owner=value,setDev:value=>dev=value,setWriteHook:value=>writeHook=value};
}
const pitch=correct=>({mode:'classic',score:100,correct,misses:0,streak:correct,won:true,perfect:true});
const triad={mode:'computer',captures:8,score:9,won:true,comeback:false};
const rhythm={mode:'tap',total:8,hits:8,extra:0,early:0,late:0};
let nextRun=0;
function complete(f,person){const accepted=f.store.acceptQuest(person);assert.equal(accepted.ok,true,accepted.error);const quest=accepted.quest;
 for(let at=0;at<(quest.game==='fishing'?quest.target:1);at++){
  const token=f.store.beginRun(quest.game),id='fixture-'+(++nextRun);let result;
  if(quest.game==='pitch')result=f.store.recordResult('pitch',id,pitch(quest.target),token);
  if(quest.game==='triad')result=f.store.recordResult('triad',id,triad,token);
  if(quest.game==='rhythm')result=f.store.recordResult('rhythm',id,rhythm,token);
  if(quest.game==='piano')result=f.store.recordActivity('piano',{runId:id,kind:quest.activityKind||'melody',mode:'guided',mistakes:0,correct:quest.target,clef:'treble',complete:true,scaleType:'major'},token);
  if(quest.game==='dance')result=f.store.recordActivity('dance',{runId:id,version:2,complete:true,bars:16,passed:true,scorePercent:100},token);
  if(quest.game==='fishing')result=f.store.recordActivity('fishing',{id,fishId:'test-minnow',rarity:'common',meter:'4/4',caught:true,outcome:'caught',hits:8,misses:0,extras:0,perfect:true},token);
  assert.equal(result,true);
 }assert.equal(f.store.conversation(person).hasNewFact,true);return quest;}
function answerAll(f,wrong=0){const state=f.store.quizState();for(const [index,question]of state.questions.entries()){
 const source=quizData.find(item=>item.id===question.id),correct=question.choices.indexOf(source.choices[source.answer]);
 assert.equal(f.store.answerQuiz(question.id,index<wrong?(correct+1)%question.choices.length:correct).ok,true);
}}
const oldIds=person=>Array.from({length:30},(_,index)=>person+'-'+String(index+1).padStart(2,'0'));
const oldFactAmount=id=>50+15*Math.floor((Number(id.slice(-2))-1)/5);
const oldState=edits=>({version:2,earned:[],learned:[],recorded:[],legacy:[],active:null,quizzes:{},seen:[],pending:[],paid:[],...edits});
function oldCollectionAwards(person){return [...oldIds(person).map(id=>({id:'scholar-fact:'+id,amount:oldFactAmount(id)})),{id:'scholar-set:'+person+':10',amount:500},{id:'scholar-set:'+person+':20',amount:1000},{id:'scholar-set:'+person+':30',amount:1000},{id:'scholar-set:'+person+':30:part-2',amount:1000},{id:'scholar-quiz:'+person,amount:1000},{id:'scholar-quiz:'+person+':part-2',amount:1000}];}

test('every collection has ten progressively priced friendship quests and no click-only facts',()=>{
 const f=fixture();assert.equal(Object.keys(history.PEOPLE).length,18);assert.equal(f.store.snapshot().total,180);
 for(const person of Object.keys(history.PEOPLE)){assert.equal(f.store.learnFact(person).ok,false);assert.equal(history.PEOPLE[person].facts.length,10);const quests=history.PEOPLE[person].facts.map((_,i)=>history.questFor(person,i));assert.equal(new Set(quests.map(q=>q.game)).size,person==='chopin'?1:6);assert.equal(quests[0].reward,50);assert.equal(quests[9].reward,110);assert.deepEqual(quests.map(q=>q.tier),[0,0,1,1,2,2,3,3,4,4]);}
 assert.equal(f.store.snapshot().count,0);assert.equal(f.wallet.snapshot().balance,150);
});
test('Bach starts with ten notes, one completed quest unlocks exactly one fact, and a global active quest cannot stack',()=>{
 const f=fixture();assert.equal(f.store.acceptQuest('bach').quest.target,10);assert.equal(f.store.acceptQuest('mozart').ok,false);
 const token=f.store.beginRun('pitch');assert.equal(f.store.recordResult('pitch','short',pitch(9),token),true);assert.equal(f.store.conversation('bach').hasNewFact,false);
 assert.equal(f.store.recordResult('pitch','ten',pitch(10),token),true);assert.equal(f.events.length,1);assert.equal(f.store.conversation('bach').hasNewFact,true);assert.equal(f.store.acceptQuest('bach').ok,false);
 const learned=f.store.learnFact('bach');assert.equal(learned.fact.id,history.PEOPLE.bach.facts[0].id);assert.equal(f.store.learnFact('bach').ok,false);assert.deepEqual(f.store.snapshot().carriedIDs,[history.PEOPLE.bach.facts[0].id]);assert.equal(f.wallet.snapshot().balance,150);
 assert.equal(f.store.acceptQuest('bach').ok,true);assert.equal(f.store.recordResult('pitch','ten',pitch(20),token),false);
});
test('fresh run eligibility, valid payloads, origin-verified callback IDs, and replay protection prevent stale quest credit',()=>{
 const f=fixture();assert.equal(f.store.beginRun('pitch'),null);f.store.acceptQuest('bach');const token=f.store.beginRun('pitch');
 for(const [run,value,runToken]of [['wrong-token',pitch(10),'no'],['invalid',{...pitch(10),streak:999},token],['practice',{...pitch(10),practice:true},token],['multi',{...pitch(10),mode:'multi'},token]])assert.equal(f.store.recordResult('pitch',run,value,runToken),false);
 assert.equal(f.store.recordResult('pitch','one-completion',pitch(10),token),true);assert.equal(f.store.recordResult('pitch','one-completion',pitch(10),token),false);
 const restored=history.create(f.api);assert.equal(restored.recordResult('pitch','fresh-actor',pitch(10),token),false,'in-memory run eligibility is not restored');
});
test('nearby conversations, scholar proximity, permission and owner changes are all required at mutation time',()=>{
 const f=fixture();f.setNear(false);assert.equal(f.store.acceptQuest('bach').ok,false);f.setNear(true);complete(f,'bach');f.setNear(false);assert.equal(f.store.learnFact('bach').ok,false);f.setNear(true);f.store.learnFact('bach');
 f.setScholar(false);assert.equal(f.store.deposit().ok,false);assert.equal(f.store.startQuiz('bach').ok,false);assert.equal(f.store.snapshot().recordedCount,0);
 f.setScholar(true);f.setAllowed(false);assert.equal(f.store.deposit().ok,false);assert.equal(f.store.snapshot().ok,false);
});
test('carried facts become scholar records and pay only after a real deposit; reload and repeated deposits cannot pay twice',()=>{
 const f=fixture();complete(f,'bach');f.store.learnFact('bach');const before=f.wallet.snapshot().balance;
 const paid=f.store.deposit();assert.equal(paid.ok,true);assert.equal(paid.deposited,1);assert.equal(paid.amount,50);assert.equal(f.wallet.snapshot().balance,before+50);assert.equal(f.store.snapshot().carriedIDs.length,0);assert.equal(f.store.snapshot().recordedCount,1);
 const restored=history.create(f.api);assert.equal(restored.deposit().amount,0);assert.equal(f.wallet.snapshot().balance,before+50);assert.equal(f.wallet.snapshot().rewards.filter(id=>id==='scholar-fact:'+history.PEOPLE.bach.facts[0].id).length,1);
});
test('all ten quests use native activities and pay 2800 Notes including the completed collection',()=>{
 const f=fixture();for(const fact of history.PEOPLE.bach.facts){complete(f,'bach');assert.equal(f.store.learnFact('bach').fact.id,fact.id);}
 assert.equal(f.store.snapshot().carriedIDs.length,10);assert.equal(f.store.startQuiz('bach').ok,false);const result=f.store.deposit();assert.equal(result.ok,true,result.error);assert.equal(result.amount,2800);assert.equal(f.wallet.snapshot().balance,2950);const view=f.store.conversation('bach');assert.equal(view.quiz.eligible,true);assert.equal(view.relationship.count,10);assert.equal(view.relationship.total,10);assert.equal(view.relationship.name,'Lifelong friend');assert.match(view.message,/all 10 facts/);assert.equal(f.store.learnFact('bach').ok,false);
});
test('v1 discoveries migrate into recorded legacy knowledge with no retroactive fact or milestone prizes',()=>{
 const f=fixture({values:new Map([[history.KEY,JSON.stringify({version:1,discovered:oldIds('bach')})]])});
 assert.equal(f.store.snapshot().recordedCount,10);assert.equal(f.store.snapshot().carriedIDs.length,0);assert.equal(f.store.deposit().amount,0);assert.equal(f.wallet.snapshot().balance,150);assert.deepEqual(JSON.parse(f.values.get(history.KEY)).legacy,history.PEOPLE.bach.facts.map(fact=>fact.id));
});
test('v2 retired discoveries retain earned, carried, recorded and ready counts without replaying their recorded prizes',()=>{
 const selected=new Set(history.PEOPLE.bach.facts.map(fact=>fact.id)),retired=oldIds('bach').filter(id=>!selected.has(id)).slice(-6),original=oldState({earned:retired,learned:retired.slice(0,5),recorded:retired.slice(0,3),pending:[{id:'scholar-fact:'+retired[0],amount:oldFactAmount(retired[0])}],paid:['scholar-fact:'+retired[1]]});
 const f=fixture({values:new Map([[history.KEY,JSON.stringify(original)]])}),before=f.values.get(history.KEY),view=f.store.conversation('bach');
 assert.equal(view.ok,true,view.error);assert.deepEqual([view.earnedCount,view.learnedCount,view.recordedCount,view.readyCount],[6,5,3,1]);assert.equal(view.relationship.count,6);assert.equal(f.values.get(history.KEY),before,'reading migration does not overwrite the old save');
 assert.equal(f.store.learnFact('bach').fact.id,history.PEOPLE.bach.facts[5].id);const migrated=JSON.parse(f.values.get(history.KEY));assert.equal(migrated.version,3);assert.deepEqual(migrated.credited,history.PEOPLE.bach.facts.slice(0,3).map(fact=>fact.id));
 const owed=original.pending[0].amount+history.PEOPLE.bach.facts.slice(3,6).reduce((sum,fact)=>sum+history.factReward(fact.id),0),deposit=f.store.deposit();assert.equal(deposit.ok,true,deposit.error);assert.equal(deposit.deposited,3);assert.equal(deposit.amount,owed);assert.equal(f.store.deposit().amount,0);assert.equal(history.create(f.api).snapshot().ok,true);
});
test('v2 completed collections and passed quizzes stay complete while genuine pending awards retry with their original amounts',()=>{
 const awards=oldCollectionAwards('bach'),pending=awards.filter(item=>item.id==='scholar-fact:bach-30'||item.id==='scholar-set:bach:10'||item.id==='scholar-quiz:bach:part-2'),paid=awards.filter(item=>!pending.some(p=>p.id===item.id)),original=oldState({earned:oldIds('bach'),learned:oldIds('bach'),recorded:oldIds('bach'),quizzes:{bach:{best:90,passed:true,attempts:2}},pending,paid:paid.map(item=>item.id)});
 const f=fixture();for(const item of paid)assert.equal(f.wallet.grantReward(item.id,item.amount).ok,true);assert.equal(f.wallet.grantReward(pending[0].id,pending[0].amount).ok,true,'simulate wallet saved before old acknowledgement failed');f.values.set(history.KEY,JSON.stringify(original));const before=f.wallet.snapshot().balance,view=f.store.conversation('bach');
 assert.equal(view.ok,true,view.error);assert.equal(view.recordedCount,10);assert.equal(view.quiz.eligible,true);assert.equal(view.quiz.passed,true);assert.equal(view.quiz.best,90);assert.equal(view.relationship.name,'Lifelong friend');
 assert.equal(f.store.deposit().amount,1500);assert.equal(f.wallet.snapshot().balance,before+1500);assert.equal(f.store.snapshot().pendingAmount,0);assert.equal(f.store.deposit().amount,0);assert.equal(f.wallet.snapshot().rewards.some(id=>id.startsWith('scholar-complete:bach')),false);
 assert.equal(f.store.startQuiz('bach').ok,true);answerAll(f);assert.equal(f.store.finishQuiz().amount,0);assert.equal(f.wallet.snapshot().balance,before+1500);assert.equal(history.create(f.api).snapshot().ok,true);
});
test('old active quests are restarted after migration and their stale activity cannot unlock a newly indexed fact',()=>{
 const original=oldState({earned:oldIds('bach').slice(0,3),learned:oldIds('bach').slice(0,3),active:{person:'bach',index:24,nonce:'old-active-quest',progress:0,seen:[]},seen:['pitch:previous-run']}),f=fixture({values:new Map([[history.KEY,JSON.stringify(original)]])});
 assert.equal(f.store.snapshot().active,null);assert.equal(f.store.beginRun('pitch'),null);assert.equal(f.store.recordResult('pitch','old-result',pitch(99),'old-token'),false);assert.equal(f.store.conversation('bach').relationship.count,3);const accepted=f.store.acceptQuest('bach');assert.equal(accepted.ok,true,accepted.error);assert.equal(accepted.quest.index,3);assert.notEqual(JSON.parse(f.values.get(history.KEY)).active.nonce,'old-active-quest');
});
test('old paid fact IDs still deduplicate after count mapping, and fresh work can finish a partially credited collection',()=>{
 const facts=history.PEOPLE.bach.facts,previous=facts.at(-1).id,award={id:'scholar-fact:'+previous,amount:oldFactAmount(previous)},original=oldState({earned:[previous],learned:[previous],recorded:[previous],paid:[award.id]}),f=fixture();f.wallet.grantReward(award.id,award.amount);f.values.set(history.KEY,JSON.stringify(original));const before=f.wallet.snapshot().balance;
 assert.equal(f.store.conversation('bach').recordedCount,1);for(let index=1;index<facts.length;index++){complete(f,'bach');assert.equal(f.store.learnFact('bach').fact.id,facts[index].id);}
 const owed=facts.slice(1,-1).reduce((sum,fact)=>sum+history.factReward(fact.id),0)+2000,result=f.store.deposit();assert.equal(result.ok,true,result.error);assert.equal(result.amount,owed);assert.equal(f.wallet.snapshot().balance,before+owed);assert.equal(f.wallet.snapshot().rewards.filter(id=>id===award.id).length,1);assert.equal(f.store.conversation('bach').quiz.eligible,true);assert.equal(f.store.deposit().amount,0);
});
test('migration rejects damaged retired IDs and fabricated old rewards without changing saved progress',()=>{
 for(const original of [oldState({earned:['bach-31']}),oldState({earned:['missing-01']}),oldState({earned:['bach-30'],learned:['bach-30'],recorded:['bach-30'],pending:[{id:'scholar-fact:bach-30',amount:999}]}),oldState({pending:[{id:'unknown'}]})]){const raw=JSON.stringify(original),f=fixture({values:new Map([[history.KEY,raw]])});assert.equal(f.store.snapshot().ok,false);assert.equal(f.store.deposit().ok,false);assert.equal(f.values.get(history.KEY),raw);assert.equal(f.wallet.snapshot().balance,150);}
 const f=fixture();complete(f,'bach');f.store.learnFact('bach');const corrupted=JSON.parse(f.values.get(history.KEY));corrupted.historicalAwards=[{id:'unknown'}];const raw=JSON.stringify(corrupted);f.values.set(history.KEY,raw);assert.equal(f.store.snapshot().ok,false);assert.equal(f.store.deposit().ok,false);assert.equal(f.values.get(history.KEY),raw);
});
test('damaged history is never silently reset or overwritten and a failed save leaves new facts unclaimed',()=>{
 const f=fixture();complete(f,'bach');const original=f.values.get(history.KEY);f.setWriteHook(key=>{if(key===history.KEY)throw Error('quota');});assert.equal(f.store.learnFact('bach').ok,false);assert.equal(f.values.get(history.KEY),original);f.setWriteHook(null);assert.equal(f.store.conversation('bach').hasNewFact,true);
 for(const raw of ['bad JSON',JSON.stringify({version:9}),JSON.stringify({...JSON.parse(original),earned:['missing-id']})]){f.values.set(history.KEY,raw);assert.equal(f.store.snapshot().ok,false);assert.equal(f.store.acceptQuest('bach').ok,false);assert.equal(f.values.get(history.KEY),raw);}
});
test('a saved wallet payment followed by failed history acknowledgement retries without double-paying',()=>{
 const f=fixture();complete(f,'bach');f.store.learnFact('bach');let historyWrites=0;f.setWriteHook(key=>{if(key===history.KEY&&++historyWrites===2)throw Error('history acknowledgement failed');});
 const first=f.store.deposit();assert.equal(first.ok,false);assert.equal(f.wallet.snapshot().balance,200);f.setWriteHook(null);assert.equal(f.store.snapshot().pendingAmount,50);assert.equal(f.store.snapshot().carriedIDs.length,0);
 const retry=f.store.deposit();assert.equal(retry.ok,true);assert.equal(retry.amount,0);assert.equal(f.wallet.snapshot().balance,200);assert.equal(f.store.snapshot().pendingAmount,0);
});
test('unavailable wallets leave retryable reward intents without claiming Notes',()=>{
 const real=fixture(),missing=history.create({...real.api,wallet:{grantReward:()=>({ok:false,error:'wallet blocked'})}});complete({...real,store:missing},'bach');missing.learnFact('bach');assert.equal(missing.deposit().ok,false);assert.equal(missing.snapshot().pendingAmount,50);assert.equal(real.wallet.snapshot().balance,150);
 assert.equal(real.store.deposit().amount,50);assert.equal(real.wallet.snapshot().balance,200);
});
test('quiz locks require ten deposited facts; attempts hide correct choices until grading, preserve best scores, and pay once',()=>{
 const f=fixture();assert.equal(f.store.startQuiz('bach').ok,false);f.setDev(true);assert.equal(f.store.developerSet('bach','recorded').ok,true);f.store.deposit();const before=f.wallet.snapshot().balance;
 assert.equal(f.store.startQuiz('bach').ok,true);assert.equal(f.store.quizState().total,10);assert.ok(f.store.quizState().questions.every(q=>!Object.hasOwn(q,'answer')));assert.equal(f.store.finishQuiz().ok,false);
 answerAll(f,3);const failed=f.store.finishQuiz();assert.equal(failed.score,70);assert.equal(failed.passed,false);assert.equal(f.wallet.snapshot().balance,before);assert.ok(failed.questions.every(q=>Object.hasOwn(q,'answer')&&typeof q.correct==='boolean'));
 f.store.startQuiz('bach');answerAll(f,2);const passed=f.store.finishQuiz();assert.equal(passed.score,80);assert.equal(passed.passed,true);assert.equal(passed.amount,2000);assert.equal(f.wallet.snapshot().balance,before+2000);assert.equal(f.store.finishQuiz().amount,0);
 f.store.startQuiz('bach');answerAll(f,0);assert.equal(f.store.finishQuiz().amount,0);assert.equal(f.store.conversation('bach').quiz.best,100);assert.equal(f.wallet.snapshot().balance,before+2000);
});
test('quiz owner changes invalidate answers and completion, and developer progression fails closed outside isolated tests',()=>{
 const f=fixture();assert.equal(f.store.developerSet('bach','recorded').ok,false);assert.equal(f.store.snapshot().count,0);f.setDev(true);f.store.developerSet('bach','recorded');f.store.startQuiz('bach');const question=f.store.quizState().questions[0];f.setOwner('different-player');assert.equal(f.store.quizState(),null);assert.equal(f.store.answerQuiz(question.id,0).ok,false);assert.equal(f.store.finishQuiz().ok,false);
});
test('developer stages apply only to selected collection and leave other people unchanged',()=>{
 const f=fixture();f.setDev(true);f.store.developerSet('bach','carried');f.store.developerSet('mozart','recorded');assert.equal(f.store.snapshot().count,11);f.store.developerSet('bach','reset');assert.equal(f.store.snapshot().count,10);assert.equal(f.store.conversation('mozart').recordedCount,10);assert.equal(f.wallet.snapshot().balance,150);
});


test('quiz completion rechecks recorded collection and all installment reward IDs clear on developer reset',()=>{
 const f=fixture();f.setDev(true);f.store.developerSet('bach','recorded');f.store.deposit();f.store.startQuiz('bach');answerAll(f);
 const changed=JSON.parse(f.values.get(history.KEY));changed.recorded.pop();changed.paid=[];changed.pending=[];f.values.set(history.KEY,JSON.stringify(changed));assert.equal(f.store.finishQuiz().ok,false);
 f.store.developerSet('bach','recorded');f.store.startQuiz('bach');answerAll(f);assert.equal(f.store.finishQuiz().ok,true);assert.equal(f.store.snapshot().paid.includes('scholar-quiz:bach:part-2'),true);assert.equal(f.store.developerSet('bach','reset').ok,true);assert.equal(f.store.snapshot().ok,true);assert.equal(f.store.snapshot().paid.some(id=>id.startsWith('scholar-quiz:bach')),false);
});
test('the complete eighteen-person reward ledger stays valid through all 252 idempotent payouts',()=>{
 const f=fixture();f.setDev(true);for(const person of Object.keys(history.PEOPLE))assert.equal(f.store.developerSet(person,'recorded').ok,true);
 const deposit=f.store.deposit();assert.equal(deposit.ok,true,deposit.error);assert.equal(f.store.snapshot().recordedCount,180);
 for(const person of Object.keys(history.PEOPLE)){assert.equal(f.store.startQuiz(person).ok,true);answerAll(f);assert.equal(f.store.finishQuiz().ok,true);}
 const snapshot=f.store.snapshot();assert.equal(snapshot.ok,true,snapshot.error);assert.equal(snapshot.paid.length,252);assert.equal(snapshot.pendingAmount,0);assert.equal(f.wallet.snapshot().balance,86550);assert.equal(f.store.deposit().amount,0);
});

test('Chopin friendship includes Note Rush and new later rhythm quests include dancing',()=>{
 const f=fixture();complete(f,'chopin');f.store.learnFact('chopin');complete(f,'chopin');f.store.learnFact('chopin');const accepted=f.store.acceptQuest('chopin');assert.equal(accepted.quest.activityKind,'reading');const token=f.store.beginRun('piano');assert.equal(f.store.recordActivity('piano',{runId:'read-friend',kind:'reading',complete:true,correct:20,mistakes:1,clef:'bass'},token),true);assert.equal(f.store.conversation('chopin').hasNewFact,true);
 const g=fixture();for(let i=0;i<6;i++){complete(g,'bach');g.store.learnFact('bach');}const dance=g.store.acceptQuest('bach');assert.equal(dance.quest.game,'dance');const t=g.store.beginRun('dance'),event={runId:'dance-friend',version:2,complete:true,bars:16,passed:true,scorePercent:80};assert.equal(g.store.recordActivity('dance',{...event,watching:true},t),false);assert.equal(g.store.recordActivity('dance',event,t),true);assert.equal(g.store.conversation('bach').hasNewFact,true);
});

test('accepted v3 friendship quests without the new rule marker keep their original activity',()=>{
 const f=fixture();f.store.acceptQuest('chopin');const raw=JSON.parse(f.values.get(history.KEY));delete raw.active.ruleVersion;f.values.set(history.KEY,JSON.stringify(raw));const expected=history.questFor('chopin',0,0,1);assert.equal(f.store.snapshot().active.game,expected.game);assert.equal(f.store.snapshot().active.ruleVersion,1);assert.ok(f.store.beginRun(expected.game));
});
