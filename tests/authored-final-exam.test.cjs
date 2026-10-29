const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const exam=require('../final-exam.js'),canonical=require('../final-exam-bank.js');
const clone=value=>JSON.parse(JSON.stringify(value));
function authored(revision='edited-v1',count=5){
 const QUESTIONS=exam.CATEGORY_IDS.flatMap((category,topic)=>Array.from({length:count},(_,index)=>{
  const choices=Array.from({length:2+(index+topic)%5},(_,i)=>({id:'choice-'+i,text:'Answer '+i}));
  return {id:category+'-teacher-'+index,category,prompt:'Teacher question '+index,choices,answer:choices.at(-1).id,explanation:'The teacher’s explanation.'};
 }));
 const lookup=new Map(QUESTIONS.map(question=>[question.id,question]));
 return {custom:true,revision,VERSION:1,CATEGORIES:exam.CATEGORY_IDS.map(id=>({id,title:id})),QUESTIONS,pool:id=>QUESTIONS.filter(question=>question.category===id),getQuestion:id=>lookup.get(id)};
}
function disk(){const values=new Map();return {values,fail:false,getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key),setItem(key,value){if(this.fail)throw Error('quota');values.set(key,value);}};}
function random(seed=1337){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function session(options={}){return exam.createSession({bank:authored(),storage:disk(),random:random(),...options});}
function correct(game){const question=game.question(),choice=question.displayChoices.find(item=>item.id===question.answer);assert.equal(game.answer(choice.displayIndex),true);}
function finish(game){for(let i=0;i<game.getState().size;i++){assert.equal(game.goTo(i),true);correct(game);}assert.equal(game.submit(),true);}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('edited exams sample the actual pool size and shuffle every supported answer count',()=>{
 const bank=authored();
 for(const size of [24,40]){
  const sample=exam.sampleExam(bank,size,random(size));assert.equal(sample.length,size);assert.equal(new Set(sample.map(item=>item.id)).size,size);
  for(const category of exam.CATEGORY_IDS)assert.equal(sample.filter(item=>bank.getQuestion(item.id).category===category).length,size/8);
  for(const item of sample){const question=bank.getQuestion(item.id);assert.deepEqual([...item.order].sort((a,b)=>a-b),question.choices.map((_,index)=>index));}
 }
 assert.throws(()=>exam.sampleExam(bank,80),/needs at least 10/);
 assert.throws(()=>exam.sampleExam(authored('small',2),24),/needs at least 3/);
 const game=session();assert.equal(game.start(80),false);assert.match(game.getState().error,/needs at least 10/);assert.equal(game.getState().phase,'intro');
 assert.equal(game.start(40),true);assert.equal(game.getState().categories.every(item=>item.poolSize===5),true);
});

test('two through six answers can be chosen, reviewed, and resumed without touching canonical progress',()=>{
 const storage=disk(),canonicalBytes=JSON.stringify(exam.getDefaults());storage.setItem(exam.KEY,canonicalBytes);
 const game=session({storage});assert.equal(game.start(40),true);const seen=new Set();
 for(let index=0;index<40;index++){
  game.goTo(index);const question=game.question();seen.add(question.choices.length);correct(game);
  assert.equal(game.question().displayChoices.find(choice=>choice.selected).id,question.answer);
  assert.equal(game.answer(question.choices.length),false);
 }
 assert.deepEqual([...seen].sort(),[2,3,4,5,6]);
 const resumed=session({storage});assert.deepEqual(resumed.snapshot(),game.snapshot());assert.deepEqual(resumed.question(),game.question());
 const envelope=JSON.parse(storage.getItem(exam.CUSTOM_KEY));assert.deepEqual(Object.keys(envelope).sort(),['revision','state','version']);assert.equal(envelope.revision,'edited-v1');assert.deepEqual(envelope.state,game.snapshot());
 assert.equal(storage.getItem(exam.KEY),canonicalBytes);assert.doesNotMatch(storage.getItem(exam.CUSTOM_KEY),/Teacher question|teacher’s explanation|prompt|choices|email/);
});

test('an edited passing exam awards normal completion once without replacing the canonical exam journal',async()=>{
 const storage=disk(),calls=[],game=session({storage,onComplete:(...args)=>{calls.push(args);return {ok:true};},now:()=>12345});
 game.start(40);finish(game);await settle();const state=game.getState();
 assert.equal(state.passed,true);assert.equal(state.score,40);assert.equal(state.percent,100);assert.equal(state.custom,true);assert.equal(state.completedAt,12345);assert.equal(state.rewardPending,false);
 assert.equal(calls.length,1);assert.equal(calls[0][0],'haydn-final-exam');assert.equal(calls[0][1].score,40);assert.equal(calls[0][1].passed,true);
 assert.equal(await game.claimCompletion(),false);assert.equal(game.save(),true);await settle();assert.equal(calls.length,1);assert.equal(storage.getItem(exam.KEY),null);
 const resumed=session({storage,onComplete:(...args)=>calls.push(args)});assert.equal(resumed.getState().passed,true);assert.equal(await resumed.claimCompletion(),false);assert.equal(calls.length,1);
});

test('edited completion retries a failed reward and shares the canonical idempotent XP event',async()=>{
 const storage=disk(),progression=require('../player-progression.js').create({storage});let failed=true;
 const complete=id=>failed?{ok:false,error:'Try saving your reward again.'}:progression.awardXP('achievement:'+id,200,'Passed Haydn’s Final Exam');
 const custom=session({storage,onComplete:complete});custom.start(40);finish(custom);await settle();assert.equal(custom.getState().rewardPending,true);assert.equal(custom.getState().completedAt,0);assert.equal(progression.getState().xp,0);
 failed=false;assert.equal(await custom.claimCompletion(),true);assert.equal(custom.getState().rewardPending,false);assert.equal(progression.getState().xp,200);
 const customDTO=require('../classroom-profile-data.js').capture(storage);assert.equal(customDTO.ok,true,customDTO.error);assert.equal(customDTO.data.finalExam.completedAt,0,'The edited pass leaves canonical exam answers untouched');assert.equal(customDTO.data.progression.xp,200);
 const standard=exam.createSession({bank:canonical,storage,random:random(),onComplete:complete});standard.start(24);finish(standard);await settle();assert.ok(standard.getState().completedAt);assert.equal(progression.getState().xp,200,'The normal XP ledger deduplicates canonical and edited passes');
 const dto=require('../classroom-profile-data.js').capture(storage);assert.equal(dto.ok,true,dto.error);assert.equal(dto.data.progression.events.filter(event=>event.id==='achievement:haydn-final-exam').length,1);
 assert.equal(Object.hasOwn(dto.data,'authoredExam'),false,'Custom question IDs and answer orders remain local');
});

test('changing edited content starts fresh practice and cannot reinterpret old answer indices',()=>{
 const storage=disk(),first=session({storage});first.start(40);correct(first);const oldBytes=storage.getItem(exam.CUSTOM_KEY);
 const next=session({storage,bank:authored('edited-v2')});assert.equal(next.getState().phase,'intro');assert.equal(next.getState().answered,0);assert.match(next.getState().error,/questions changed/);assert.equal(storage.getItem(exam.CUSTOM_KEY),oldBytes,'Opening a new revision is read only');
 assert.equal(next.start(40),true);assert.equal(JSON.parse(storage.getItem(exam.CUSTOM_KEY)).revision,'edited-v2');
 assert.equal(first.answer(0),false);assert.match(first.getState().error,/changed/);assert.equal(JSON.parse(storage.getItem(exam.CUSTOM_KEY)).revision,'edited-v2');
});

test('custom validators reject broken permutations, unavailable answers, injected fields, and fabricated completion',()=>{
 const bank=authored(),game=session({bank});game.start(40);const valid=game.snapshot();assert.equal(exam.validateState(valid,bank).ok,true);
 for(const mutate of [
  value=>value.orders[0].push(value.orders[0][0]),value=>value.orders[0][0]=-1,value=>value.orders[0]=0,
  value=>value.answers[0]=bank.getQuestion(value.questionIds[0]).choices.length,value=>value.questionIds[0]='<script>',
  value=>value.questionIds[0]=value.questionIds[1],value=>value.studentName='Someone',value=>value.completedAt=100
 ]){const item=clone(valid);mutate(item);assert.equal(exam.validateState(item,bank).ok,false,mutate.toString());}
 assert.equal(exam.validateState(valid,canonical).ok,false,'Custom IDs/permutations never enter the canonical exam DTO');
});

test('edited exams respect profile pauses, quota failures, and another tab’s newer work',()=>{
 const storage=disk();let writable=true;const first=session({storage,canRecord:()=>writable});first.start(40);const original=storage.getItem(exam.CUSTOM_KEY);
 writable=false;assert.equal(first.answer(0),false);assert.equal(first.start(24),false);assert.equal(storage.getItem(exam.CUSTOM_KEY),original);
 writable=true;storage.fail=true;assert.equal(first.answer(0),false);assert.equal(first.getState().saved,false);assert.equal(storage.getItem(exam.CUSTOM_KEY),original);storage.fail=false;assert.equal(first.save(),true);
 const stale=session({storage});correct(first);const latest=storage.getItem(exam.CUSTOM_KEY);assert.equal(stale.answer(0),false);assert.match(stale.getState().error,/changed/);assert.equal(storage.getItem(exam.CUSTOM_KEY),latest);
});

test('browser sessions resolve the authored bank dynamically and explicit banks retain priority',()=>{
 let selected=authored();const window={CodaFinalExamBank:canonical,CodaEducationContent:{getExamBank:()=>selected},CodaClassroomQuiz:{},CodaMusicNotation:{}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../final-exam.js'),'utf8'),{window,console});
 const storage=disk(),custom=window.CodaFinalExam.createSession({storage,random:random()});assert.equal(custom.start(40),true);assert.equal(custom.getState().custom,true);
 selected=null;const standard=window.CodaFinalExam.createSession({storage,random:random()});assert.equal(standard.start(40),true);assert.equal(standard.getState().custom,false);assert.equal(JSON.parse(storage.getItem(exam.KEY)).questionIds.length,40);
 selected=authored();const explicit=window.CodaFinalExam.createSession({bank:canonical,storage:disk(),random:random()});assert.equal(explicit.start(40),true);assert.equal(explicit.getState().custom,false);
});

test('runtime-resolved exams freeze answers and completion when the active content changes or reverts',async()=>{
 for(const [initial,replacement] of [[authored('first'),authored('changed')],[canonical,authored('edited')],[authored('edited'),canonical]]){
  let current=initial;const storage=disk(),calls=[],game=exam.createSession({getBank:()=>current,storage,random:random(),onComplete:(...args)=>{calls.push(args);return {ok:false,error:'Retry reward.'};}});
  game.start(24);finish(game);await settle();assert.equal(calls.length,1);assert.equal(game.getState().rewardPending,true);
  const before=[...storage.values],snapshot=game.snapshot();current=replacement;
  assert.equal(await game.claimCompletion(),false);assert.equal(calls.length,1,'A stale exam must never request another reward');
  assert.equal(game.start(40),false);assert.equal(game.answer(0),false);assert.equal(game.goTo(0),false);assert.equal(game.submit(),false);assert.equal(game.save(),false);
  assert.equal(game.getState().contentChanged,true);assert.match(game.getState().error,/questions changed.*reopen/);assert.deepEqual(game.snapshot(),snapshot);assert.deepEqual([...storage.values],before);
  current=initial;assert.equal(game.start(24),false,'A frozen assessment stays frozen until reopened in a fresh session');
  const reopened=exam.createSession({getBank:()=>current,storage,random:random()});assert.equal(reopened.getState().contentChanged,false);assert.equal(reopened.start(24),true);
 }
});

test('runtime content changes are detected before an unfinished exam can answer or submit',()=>{
 let current=authored('before');const storage=disk(),game=exam.createSession({getBank:()=>current,storage,random:random()});game.start(40);correct(game);const before=storage.getItem(exam.CUSTOM_KEY);
 current=authored('after');assert.equal(game.answer(0),false);assert.equal(game.getState().answered,1);assert.equal(game.getState().contentChanged,true);assert.equal(storage.getItem(exam.CUSTOM_KEY),before);
 assert.equal(game.submit(),false);assert.equal(game.goTo(1),false);assert.match(game.getState().error,/questions changed/);
});

test('an unavailable content source freezes safely while a profile pause remains recoverable',()=>{
 let unavailable=false,writable=true;const bank=authored(),storage=disk(),game=exam.createSession({storage,getBank:()=>{if(unavailable)throw Error('Content unavailable');return bank;},canRecord:()=>writable});
 game.start(40);writable=false;assert.equal(game.answer(0),false);assert.equal(game.getState().contentChanged,false);
 writable=true;correct(game);const before=storage.getItem(exam.CUSTOM_KEY);unavailable=true;assert.equal(game.answer(0),false);assert.equal(game.getState().contentChanged,true);assert.match(game.getState().error,/could not be checked/);assert.equal(storage.getItem(exam.CUSTOM_KEY),before);
});
