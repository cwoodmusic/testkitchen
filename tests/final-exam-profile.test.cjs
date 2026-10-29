const test=require('node:test'),assert=require('node:assert/strict');
const Exam=require('../final-exam.js'),Bank=require('../final-exam-bank.js'),Profile=require('../classroom-profile-data.js');
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function answer(game,correct){const question=game.question();return game.answer(question.displayChoices.find(choice=>(choice.id===question.answer)===correct).displayIndex);}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('the 800 authored question IDs exactly match the closed classroom profile enum',()=>{
 const ids=Bank.QUESTIONS.map(question=>question.id),enumIds=Profile.SCHEMA.properties.finalExam.properties.questionIds.items.enum;
 assert.equal(ids.length,800);assert.deepEqual([...ids].sort(),[...enumIds].sort());
 assert.deepEqual(Exam.getDefaults(),Profile.blank().finalExam);
 assert.equal(Exam.KEY,Profile.KEYS.finalExam);
 for(const question of Bank.QUESTIONS){
  assert.ok(question.choices.some(choice=>choice.id===question.answer));
  if(question.stimulus)assert.ok(['staff','rhythm','meter','scale','dynamic','tempo'].includes(question.stimulus.kind),question.id);
 }
});

for(const size of Exam.SIZES)test('real-bank '+size+'-question draft, submission and reward survive classroom profile capture/apply',async()=>{
 const disk=storage();let rewardCalls=0;
 const game=Exam.createSession({storage:disk,onComplete:()=>{
  rewardCalls++;
  const captured=Profile.capture(disk);assert.equal(captured.ok,true,captured.error);assert.equal(captured.data.finalExam.submitted,true);
  assert.equal(captured.data.finalExam.completedAt,0,'The exam saves its passing score before asking for the reward');
  disk.setItem(Profile.KEYS.progression,JSON.stringify({version:1,xp:200,events:[{id:'achievement:haydn-final-exam',xp:200}],bestPitchLevel:0}));
  return {ok:true};
 },now:()=>123456789});
 assert.equal(game.start(size),true);let captured=Profile.capture(disk);assert.equal(captured.ok,true,captured.error);
 assert.deepEqual(captured.data.finalExam,game.snapshot());
 const correctCount=Math.ceil(size*.8);
 for(let index=0;index<size;index++){assert.equal(game.goTo(index),true);assert.equal(answer(game,index<correctCount),true);}
 assert.equal(Exam.validateState(game.snapshot()).ok,true);assert.equal(Profile.capture(disk).ok,true);
 assert.equal(game.submit(),true);await settle();assert.equal(rewardCalls,1);
 captured=Profile.capture(disk);assert.equal(captured.ok,true,captured.error);assert.deepEqual(captured.data.finalExam,game.snapshot());
 assert.equal(captured.data.finalExam.completedAt,123456789);assert.equal(captured.data.progression.xp,200);
 const second=storage();assert.equal(Profile.apply(second,captured.data).ok,true);
 const reopened=Exam.createSession({storage:second,onComplete:()=>{rewardCalls++;return {ok:true};}});
 assert.deepEqual(reopened.snapshot(),game.snapshot());assert.equal(reopened.getState().passed,true);
 assert.equal(await reopened.claimCompletion(),false);assert.equal(rewardCalls,1);
 for(const mutate of [
  value=>{value.size=32;},value=>{value.orders[0]=6;},value=>{value.answers[0]=3;},
  value=>{value.questionIds[0]='tempo-101';},value=>{value.bestByCategory.tempo.total++;},
  value=>{value.completedAt=253402300800000;}
 ]){
  const changed=structuredClone(game.snapshot());mutate(changed);const profile=Profile.blank();profile.finalExam=changed;
  profile.progression={version:1,xp:200,events:[{id:'achievement:haydn-final-exam',xp:200}],bestPitchLevel:0};
  assert.equal(Exam.validateState(changed).ok,false);assert.equal(Profile.validate(profile).ok,false);
 }
});
