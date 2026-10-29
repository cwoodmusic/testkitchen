const test=require('node:test'),assert=require('node:assert/strict');
const exam=require('../final-exam.js');
const CATEGORIES=exam.CATEGORY_IDS.map(id=>({id,title:id}));
const QUESTIONS=CATEGORIES.flatMap(({id:category})=>Array.from({length:100},(_,index)=>({
 id:category+'-'+String(index+1).padStart(3,'0'),category,prompt:'Question '+(index+1),
 choices:[{id:'a',text:'First'},{id:'b',text:'Second'},{id:'c',text:'Third'}],answer:['a','b','c'][index%3],explanation:'A useful explanation.'
})));
const lookup=new Map(QUESTIONS.map(question=>[question.id,question]));
const bank={VERSION:1,CATEGORIES,pool:id=>QUESTIONS.filter(question=>question.category===id),getQuestion:id=>lookup.get(id)};
function disk(){const values=new Map();return {values,fail:false,getItem:key=>values.get(key)??null,setItem(key,value){if(this.fail)throw Error('quota');values.set(key,value);}};}
function random(seed=2166136261){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function session(options={}){return exam.createSession({bank,storage:disk(),random:random(),...options});}
function choose(game,correct=true){const question=game.question(),choice=question.displayChoices.find(item=>(item.id===question.answer)===correct);assert.ok(choice);game.answer(choice.displayIndex);}
function fill(game,score=game.getState().size){const size=game.getState().size;for(let index=0;index<size;index++){game.goTo(index);choose(game,index<score);}}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('every supported exam samples all eight 100-question pools evenly without repeats',()=>{
 for(const size of exam.SIZES){
  const sampled=exam.sampleExam(bank,size,random(size));assert.equal(sampled.length,size);assert.equal(new Set(sampled.map(item=>item.id)).size,size);
  for(const category of exam.CATEGORY_IDS)assert.equal(sampled.filter(item=>lookup.get(item.id).category===category).length,size/8);
  assert.ok(sampled.every(item=>Number.isInteger(item.order)&&item.order>=0&&item.order<6));
 }
 assert.notDeepEqual(exam.sampleExam(bank,40,random(3)),exam.sampleExam(bank,40,random(4)));
 assert.notDeepEqual(exam.sampleExam(bank,40,()=>.5,0),exam.sampleExam(bank,40,()=>.5,1),'Retakes choose a fresh sample even with a repeatable random source');
 assert.throws(()=>exam.sampleExam(bank,32),/24, 40, or 80/);
 assert.throws(()=>exam.sampleExam({...bank,pool:id=>bank.pool(id).slice(1)},40),/100-question/);
});

test('choices shuffle independently and preserve their meaning after navigation and a reload',()=>{
 const storage=disk(),game=session({storage});assert.equal(game.start(40),true);
 const first=game.question();assert.equal(first.displayChoices.length,3);choose(game);
 const originalIndex=first.choices.findIndex(choice=>choice.id===first.answer);assert.equal(game.getState().answers[0],originalIndex);
 game.goTo(1);choose(game,false);game.goTo(0);
 assert.equal(game.question().displayChoices.find(choice=>choice.selected).id,first.answer);
 const reloaded=session({storage});assert.deepEqual(reloaded.snapshot(),game.snapshot());assert.deepEqual(reloaded.question(),game.question());
 assert.equal(game.getState().score,null,'Do not reveal a running score during the exam');assert.equal(game.getState().percent,null);assert.equal(game.getState().byCategory,null);
 assert.deepEqual(JSON.parse(storage.getItem(exam.KEY)),game.snapshot());
 assert.doesNotMatch(storage.getItem(exam.KEY),/Question |useful explanation|prompt|choices|seed|name|email/,'Only bounded IDs and answer indices belong in player storage');
});

test('answers can be reconsidered, incomplete submissions are blocked, and 80 percent passes',async()=>{
 const calls=[],game=session({onComplete:(id,result)=>{calls.push({id,result});return {ok:true};},now:()=>12345});game.start(40);
 assert.equal(game.submit(),false);assert.equal(game.getState().attempts,0);
 choose(game,false);choose(game,true);assert.equal(game.question().displayChoices.find(choice=>choice.selected).id,game.question().answer);
 fill(game,32);assert.equal(game.submit(),true);assert.equal(game.getState().percent,80);assert.equal(game.getState().passed,true);
 await settle();assert.equal(game.getState().completedAt,12345);assert.equal(calls.length,1);assert.equal(calls[0].id,'haydn-final-exam');assert.equal(calls[0].result.score,32);
 assert.equal(Object.values(calls[0].result.byCategory).reduce((sum,item)=>sum+item.correct,0),32);
 assert.equal(game.submit(),false);assert.equal(game.answer(0),false);assert.equal(game.goTo(0),false);await game.claimCompletion();assert.equal(calls.length,1);
 const below=session();below.start(40);fill(below,31);below.submit();await settle();assert.equal(below.getState().passed,false);assert.equal(below.getState().percent,78);assert.equal(below.getState().completedAt,0);
});

test('best summaries survive fresh attempts and the first pass is rewarded once across reloads',async()=>{
 const storage=disk(),calls=[],onComplete=(...args)=>{calls.push(args);return {ok:true};};
 const first=session({storage,onComplete});first.start(24);fill(first,24);first.submit();await settle();
 const original=first.snapshot();first.start(80);assert.equal(first.getState().bestTotal,24);assert.equal(first.getState().bestScore,24);assert.ok(first.getState().completedAt);
 assert.equal(first.getState().answers.length,80);assert.ok(first.getState().answers.every(answer=>answer===-1));fill(first,60);first.submit();await settle();
 assert.equal(first.getState().attempts,2);assert.equal(first.getState().bestPercent,100);assert.deepEqual(first.getState().bestByCategory,original.bestByCategory);
 const resumed=session({storage,onComplete});resumed.start(40);fill(resumed,40);resumed.submit();await settle();assert.equal(calls.length,1);assert.equal(resumed.getState().attempts,3);
});

test('passing work saves before rewarding and failed reward delivery can recover after reload',async()=>{
 const storage=disk(),calls=[];
 const game=session({storage,onComplete:()=>{const saved=JSON.parse(storage.getItem(exam.KEY));assert.equal(saved.submitted,true);assert.equal(saved.bestPercent,100);assert.equal(saved.completedAt,0);calls.push('failed');return {ok:false,error:'Try again when online.'};}});
 game.start(24);fill(game,24);game.submit();await settle();assert.equal(game.getState().completedAt,0);assert.equal(game.getState().rewardPending,true);assert.match(game.getState().error,/online/);
 const reloaded=session({storage,onComplete:(id,result)=>{calls.push(id);assert.equal(result.passed,true);return {ok:true};},now:()=>1000});
 assert.equal(await reloaded.claimCompletion(),true);assert.equal(reloaded.getState().completedAt,1000);assert.equal(reloaded.getState().rewardPending,false);
 assert.equal(await reloaded.claimCompletion(),false);assert.deepEqual(calls,['failed','haydn-final-exam']);
});

test('a quota error keeps the unsaved draft, never grants its reward, and retries explicitly',async()=>{
 const storage=disk(),calls=[],game=session({storage,onComplete:()=>{calls.push('reward');return {ok:true};}});game.start(24);
 storage.fail=true;fill(game,24);assert.equal(game.getState().answered,24);assert.equal(game.getState().saved,false);assert.equal(game.submit(),false);await settle();
 assert.equal(game.getState().passed,true);assert.equal(game.getState().saved,false);assert.equal(calls.length,0);assert.equal(session({storage}).getState().answered,0);
 assert.equal(game.save(),false);storage.fail=false;assert.equal(game.save(),true);await settle();assert.equal(calls.length,1);assert.ok(game.getState().completedAt);
 assert.equal(session({storage}).getState().passed,true);
});

test('a paused or changed profile cannot receive answers or a delayed completion',async()=>{
 const storage=disk();let writable=true,finishReward;const game=session({storage,canRecord:()=>writable,onComplete:()=>new Promise(resolve=>{finishReward=resolve;})});game.start(24);const before=storage.getItem(exam.KEY);
 writable=false;assert.equal(game.answer(0),false);assert.equal(game.goTo(1),false);assert.equal(game.start(40),false);assert.equal(game.submit(),false);assert.equal(storage.getItem(exam.KEY),before);
 writable=true;fill(game,24);game.submit();assert.equal(game.getState().claiming,true);writable=false;finishReward({ok:true});await settle();assert.equal(game.getState().completedAt,0);assert.match(game.getState().error,/resting/);
 const other=session({storage});other.start(40);writable=true;assert.equal(game.save(),false);assert.match(game.getState().error,/changed/);assert.equal(JSON.parse(storage.getItem(exam.KEY)).size,40);
});

test('a concurrent attempt cannot overwrite another tab’s saved work',()=>{
 const storage=disk(),first=session({storage});first.start(24);const stale=session({storage});choose(first);const saved=storage.getItem(exam.KEY);
 assert.equal(stale.answer(0),false);assert.equal(storage.getItem(exam.KEY),saved);assert.match(stale.getState().error,/changed/);
});

test('validation rejects expanded, malformed, unbalanced, or fabricated passing journals',async()=>{
 const game=session();game.start(40);fill(game,32);game.submit();await settle();const valid=game.snapshot();assert.equal(exam.validateState(valid,bank).ok,true);
 const mutations=[
  item=>{item.version=2;},item=>{item.bankVersion=2;},item=>{item.studentName='Ada';},item=>{item.orders[0]=6;},item=>{item.answers[0]=3;},
  item=>{item.questionIds[0]=item.questionIds[1];},item=>{item.questionIds[0]='tempo-101';},item=>{item.questionIds[0]='tempo-000';},
  item=>{item.orders.pop();},item=>{item.answers[0]=-1;},item=>{item.index=0;},item=>{item.bestPercent=100;},item=>{item.bestByCategory.tempo.total++;},
  item=>{item.bestByCategory.noteNames={correct:0,total:0};},item=>{item.completedAt=253402300800000;},item=>{item.attempts=100001;},
  item=>{const index=item.questionIds.findIndex(id=>id.startsWith('note-naming-'));item.questionIds[index]=bank.pool('tempo').find(question=>!item.questionIds.includes(question.id)).id;}
 ];
 for(const mutate of mutations){const record=structuredClone(valid);mutate(record);assert.equal(exam.validateState(record,bank).ok,false,mutate.toString());assert.deepEqual(exam.normalize(record,bank),exam.getDefaults());}
 const failed=session();failed.start(40);fill(failed,30);failed.submit();const fabricated=failed.snapshot();fabricated.completedAt=50;assert.equal(exam.validateState(fabricated,bank).ok,false);
 const empty=exam.getDefaults();assert.equal(exam.validateState(empty,bank).ok,true);empty.index=1;assert.equal(exam.validateState(empty,bank).ok,false);
});
