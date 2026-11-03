/* Quest-earned history, carried discoveries, and the scholar's reward ledger. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./music-history-data.js'):root.CodaMusicHistoryData,typeof module==='object'&&module.exports?require('./music-history-quiz-data.js'):root.CodaMusicHistoryQuizData,typeof module==='object'&&module.exports?require('./music-history-content.js'):root.CodaMusicHistoryContent);
 if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaMusicHistoryProgress=api;
})(typeof window==='undefined'?null:window,function(PEOPLE,QUIZ_DATA,CONTENT){
 'use strict';
 const KEY='codaMusicHistoryV1',PERSON_IDS=Object.keys(PEOPLE),FACTS=Object.values(PEOPLE).flatMap(person=>person.facts),BY_ID=new Map(FACTS.map(fact=>[fact.id,fact])),IDS=new Set(BY_ID.keys()),MAX_SEEN=4096;
 const OLD_FACTS=Object.fromEntries(PERSON_IDS.map(person=>[person,Array.from({length:30},(_,index)=>person+'-'+String(index+1).padStart(2,'0'))])),OLD_IDS=new Set(Object.values(OLD_FACTS).flat()),OLD_MAX_AWARDS=OLD_IDS.size+PERSON_IDS.length*6,MAX_AWARDS=OLD_MAX_AWARDS+IDS.size+PERSON_IDS.length*4;
 const GAMES=['pitch','rhythm','triad','piano','fishing','dance'],GAME_NAMES={pitch:'Pitch Race',rhythm:'Rhythm Room',triad:'Music Triad',piano:'Piano Lab',fishing:'Rhythm Fishing',dance:'DJ Line Dance'};
 const COLLECTION_BONUSES=Object.freeze({10:2000}),QUIZ_PRIZE=2000,PASS_SCORE=80,QUESTION_COUNT=10;
 const REWARDS=Object.freeze({factBase:50,factStep:15,factsPerTier:2,milestones:COLLECTION_BONUSES,quiz:QUIZ_PRIZE});
 const QUESTIONS=Array.isArray(QUIZ_DATA)?QUIZ_DATA:QUIZ_DATA?.QUESTIONS||[];
 const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key),integer=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
 const factReward=id=>50+15*Math.floor(PEOPLE[personFor(id)].facts.findIndex(fact=>fact.id===id)/REWARDS.factsPerTier),personFor=id=>PERSON_IDS.find(person=>PEOPLE[person].facts.some(fact=>fact.id===id));
 // Migrated recorded facts/sets are already credited. Historical awards retain
 // their original IDs and amounts so an interrupted old payment can retry.
 const blank=()=>({version:3,earned:[],learned:[],recorded:[],legacy:[],credited:[],completed:[],historicalAwards:[],active:null,quizzes:{},seen:[],pending:[],paid:[]});
 function questFor(person,index,progress=0,ruleVersion=2){
  const tier=Math.floor(index/REWARDS.factsPerTier);let game=GAMES[(index+PERSON_IDS.indexOf(person))%5],activityKind=null;let goal,target;
  if(ruleVersion>=2&&person==='chopin'){game='piano';activityKind=['melody','scale','reading'][index%3];}
  if(ruleVersion>=2&&index>=5&&game==='rhythm')game='dance';
  if(game==='pitch'){target=10+tier*5;goal='Identify '+target+' notes correctly in one completed solo Pitch Race run.';}
  if(game==='rhythm'){target=75+tier*3;goal='Finish a Tap Practice round of at least 8 notes with '+target+'% accuracy or better.';}
  if(game==='triad'){target=1+Math.floor(tier/2);goal=(tier>=3?'Win':'Finish')+' a Music Triad computer match with at least '+target+' capture'+(target===1?'':'s')+'.';}
  if(game==='piano'){target=activityKind==='reading'?10+tier*5:1;goal=activityKind==='reading'?'Play '+target+' correct pitches in one completed Note Rush run.':activityKind==='scale'?'Complete a major or natural minor scale in Piano Lab.':activityKind==='melody'?'Complete a melody challenge in Piano Lab.':ruleVersion>=2?'Complete a melody or scale, or play ten correct pitches in Note Rush.':'Complete a melody, scale, or interval challenge in Piano Lab. Free play does not count.';}
  if(game==='dance'){target=80;goal='Pass a sixteen-bar DJ Line Dance stage with at least 80% of the points. Watching does not count.';}
  if(game==='fishing'){target=1+Math.floor(tier/2);goal='Catch '+target+' fish after accepting this quest. Practice catches do not count.';}
  return {activityKind,ruleVersion,id:'history-quest:'+person+':'+index,person,index,tier,game,title:PEOPLE[person].name+' · Friendship quest '+(index+1),goal,target,progress,reward:factReward(PEOPLE[person].facts[index].id),gameName:GAME_NAMES[game]};
 }
 function relationship(count,total){return {count,total,name:count>=total?'Lifelong friend':count>=Math.ceil(total*5/6)?'Close friend':count>=Math.ceil(total/2)?'Trusted friend':count>=Math.ceil(total/6)?'Friend':count>0?'Acquaintance':'New acquaintance'};}
 function validIds(value,ids=IDS){return Array.isArray(value)&&value.length<=ids.size&&new Set(value).size===value.length&&value.every(id=>ids.has(id));}
 const installments=plans=>plans.flatMap(item=>item.amount>1000?[{id:item.id,amount:1000},{id:item.id+':part-2',amount:item.amount-1000}]:[item]);
 function rewardPlans(state){
  const plans=[];
  for(const id of state.recorded)if(state.earned.includes(id)&&!state.legacy.includes(id)&&!state.credited.includes(id))plans.push({id:'scholar-fact:'+id,amount:factReward(id)});
  for(const person of PERSON_IDS){const count=PEOPLE[person].facts.filter(fact=>state.recorded.includes(fact.id)).length;
   for(const [milestone,amount]of Object.entries(COLLECTION_BONUSES))if(count>=Number(milestone)&&!state.completed.includes(person))plans.push({id:'scholar-complete:'+person,amount});
   if(state.quizzes[person]?.passed)plans.push({id:'scholar-quiz:'+person,amount:QUIZ_PRIZE});
  }return [...new Map([...installments(plans),...state.historicalAwards].map(item=>[item.id,item])).values()];
 }
 function oldRewardPlans(state){
  const plans=[];for(const id of state.recorded)if(state.earned.includes(id)&&!state.legacy.includes(id))plans.push({id:'scholar-fact:'+id,amount:50+15*Math.floor((Number(id.slice(-2))-1)/5)});
  for(const person of PERSON_IDS){const count=OLD_FACTS[person].filter(id=>state.recorded.includes(id)&&state.earned.includes(id)&&!state.legacy.includes(id)).length;
   for(const [milestone,amount]of Object.entries({10:500,20:1000,30:2000}))if(count>=Number(milestone))plans.push({id:'scholar-set:'+person+':'+milestone,amount});
   if(state.quizzes[person]?.passed)plans.push({id:'scholar-quiz:'+person,amount:QUIZ_PRIZE});
  }return installments(plans);
 }
 const OLD_AWARDS=new Map(oldRewardPlans({recorded:[...OLD_IDS],earned:[...OLD_IDS],legacy:[],quizzes:Object.fromEntries(PERSON_IDS.map(person=>[person,{passed:true}]))}).map(item=>[item.id,item.amount]));
 function validateOrder(state){
  if(state.legacy.some(id=>state.earned.includes(id)||!state.learned.includes(id)||!state.recorded.includes(id))||state.learned.some(id=>!state.earned.includes(id)&&!state.legacy.includes(id))||state.recorded.some(id=>!state.learned.includes(id)))throw Error('Invalid discovery order');
 }
 function validateLedger(value,plans,max){
  if(!Array.isArray(value.pending)||value.pending.length>max||value.pending.some(item=>!item||!plans.has(item.id)||plans.get(item.id)!==item.amount)||new Set(value.pending.map(item=>item.id)).size!==value.pending.length||!Array.isArray(value.paid)||value.paid.length>max||new Set(value.paid).size!==value.paid.length||value.paid.some(id=>!plans.has(id))||value.pending.some(item=>value.paid.includes(item.id)))throw Error('Invalid scholar awards');
 }
 function validateShared(value,state,old=false){
  if(!Array.isArray(value.seen)||value.seen.length>MAX_SEEN||new Set(value.seen).size!==value.seen.length||value.seen.some(id=>typeof id!=='string'||id.length>160))throw Error('Invalid event records');state.seen=value.seen.slice();
  if(!value.quizzes||typeof value.quizzes!=='object'||Array.isArray(value.quizzes)||Object.keys(value.quizzes).some(person=>!own(PEOPLE,person)))throw Error('Invalid quizzes');
  const idsFor=person=>old?OLD_FACTS[person]:PEOPLE[person].facts.map(fact=>fact.id);
  for(const [person,quiz]of Object.entries(value.quizzes)){if(!quiz||!integer(quiz.best,100)||typeof quiz.passed!=='boolean'||quiz.passed!==(quiz.best>=PASS_SCORE)||!integer(quiz.attempts)||idsFor(person).some(id=>!state.recorded.includes(id)))throw Error('Invalid quiz result');state.quizzes[person]={best:quiz.best,passed:quiz.passed,attempts:quiz.attempts};}
  for(const person of PERSON_IDS)if(idsFor(person).filter(id=>state.earned.includes(id)&&!state.learned.includes(id)).length>1)throw Error('Too many ready facts');
  if(value.active!==null){const active=value.active;if(!active||!own(PEOPLE,active.person)||!integer(active.index,idsFor(active.person).length-1)||typeof active.nonce!=='string'||active.nonce.length>100||!active.nonce||!integer(active.progress,3)||!Array.isArray(active.seen)||active.seen.length>3||active.seen.some(id=>typeof id!=='string'||id.length>160))throw Error('Invalid active quest');
   const id=idsFor(active.person)[active.index];if(state.earned.includes(id)||state.legacy.includes(id)||idsFor(active.person).some(id=>state.earned.includes(id)&&!state.learned.includes(id)))throw Error('Invalid active fact');
   state.active={ruleVersion:active.ruleVersion===2?2:1,person:active.person,index:active.index,nonce:active.nonce,progress:active.progress,seen:active.seen.slice()};
  }
 }
 function migrate(old){
  // Keep the amount of work earned at each stage when retired IDs disappear.
  // Active quests restart because their old index can now refer to a new fact.
  const state=blank();state.seen=old.seen.slice();state.quizzes={...old.quizzes};
  for(const person of PERSON_IDS){const oldIds=OLD_FACTS[person],current=PEOPLE[person].facts.map(fact=>fact.id),count=key=>Math.min(current.length,oldIds.filter(id=>old[key].includes(id)).length),known=Math.min(current.length,count('earned')+count('legacy')),legacyCount=count('legacy');
   state.legacy.push(...current.slice(0,legacyCount));state.earned.push(...current.slice(legacyCount,known));state.learned.push(...current.slice(0,count('learned')));state.recorded.push(...current.slice(0,count('recorded')));state.credited.push(...current.slice(0,count('recorded')));
   if(count('recorded')===current.length)state.completed.push(person);
  }
  const originalPlans=new Map(oldRewardPlans(old).map(item=>[item.id,item.amount]));state.pending=old.pending.map(item=>({...item}));state.paid=old.paid.slice();
  state.historicalAwards=[...new Set([...state.paid,...state.pending.map(item=>item.id)])].map(id=>({id,amount:originalPlans.get(id)}));
  for(const person of PERSON_IDS)if(state.quizzes[person]?.passed)for(const item of installments([{id:'scholar-quiz:'+person,amount:QUIZ_PRIZE}]))if(!state.paid.includes(item.id)&&!state.pending.some(pending=>pending.id===item.id))state.paid.push(item.id);
  return state;
 }
 function decode(raw){
  if(raw===null)return blank();const value=JSON.parse(raw);
  if(value?.version===1){if(!validIds(value.discovered,OLD_IDS))throw Error('Invalid old history');const old=blank();old.legacy=value.discovered.slice();old.learned=value.discovered.slice();old.recorded=value.discovered.slice();return migrate(old);}
  const old=value?.version===2;if((!old&&value?.version!==3)||!['earned','learned','recorded','legacy'].every(key=>validIds(value[key],old?OLD_IDS:IDS)))throw Error('Invalid history');
  const state=blank();for(const key of ['earned','learned','recorded','legacy'])state[key]=value[key].slice();validateOrder(state);validateShared(value,state,old);
  if(old){validateLedger(value,new Map(oldRewardPlans(state).map(item=>[item.id,item.amount])),OLD_MAX_AWARDS);state.pending=value.pending.map(item=>({...item}));state.paid=value.paid.slice();return migrate(state);}
  if(!validIds(value.credited)||value.credited.some(id=>!state.recorded.includes(id))||!Array.isArray(value.completed)||new Set(value.completed).size!==value.completed.length||value.completed.some(person=>!own(PEOPLE,person)||PEOPLE[person].facts.some(fact=>!state.recorded.includes(fact.id)))||!Array.isArray(value.historicalAwards)||value.historicalAwards.length>OLD_MAX_AWARDS||value.historicalAwards.some(item=>!item||!OLD_AWARDS.has(item.id)||OLD_AWARDS.get(item.id)!==item.amount)||new Set(value.historicalAwards.map(item=>item.id)).size!==value.historicalAwards.length)throw Error('Invalid migrated history');
  state.credited=value.credited.slice();state.completed=value.completed.slice();state.historicalAwards=value.historicalAwards.map(item=>({...item}));
  validateLedger(value,new Map(rewardPlans(state).map(item=>[item.id,item.amount])),MAX_AWARDS);state.pending=value.pending.map(item=>({...item}));state.paid=value.paid.slice();return state;
 }
 function create(api={}){
  let attempt=null,serial=0;const tokens=new Map();
  function authored(){try{return api.getContent?.()||CONTENT?.EMPTY;}catch{return CONTENT?.EMPTY;}}
  const authoredPeople=()=>CONTENT?.resolvePeople(authored())||PEOPLE;
  const allowed=()=>{try{return api.canUse?.()!==false;}catch{return false;}};
  const identity=()=>api.getIdentity?.()??'local';
  const near=person=>{try{return api.canTalk?.(person)===true;}catch{return false;}};
  const atScholar=()=>{try{return api.canVisitScholar?.()===true;}catch{return false;}};
  const developer=()=>{try{return api.isDeveloperTest?.()===true;}catch{return false;}};
  const fail=error=>({ok:false,error});
  function read(){try{if(!allowed())return fail('Your player is unavailable. Reopen your profile to continue.');const owner=identity(),proof=api.storage.getItem(KEY),state=decode(proof);if(owner!==identity())throw Error('Player changed');return {ok:true,state,proof,owner};}catch{return fail('History progress could not be read. Your saved discoveries were not changed.');}}
  function save(reading,state){try{if(!allowed()||reading.owner!==identity()||api.storage.getItem(KEY)!==reading.proof)return fail('Your player or saved history changed. Reopen this conversation to continue.');api.storage.setItem(KEY,JSON.stringify(state));try{api.onChange?.();}catch{}return {ok:true};}catch{return fail('History progress could not be saved. Try again when browser storage is available.');}}
  function personView(state,person,people=PEOPLE){
   const list=people[person].facts,ready=list.filter(fact=>state.earned.includes(fact.id)&&!state.learned.includes(fact.id)),learnedCount=list.filter(fact=>state.learned.includes(fact.id)).length,recordedCount=list.filter(fact=>state.recorded.includes(fact.id)).length,earnedCount=list.filter(fact=>state.earned.includes(fact.id)).length;
   const index=list.findIndex(fact=>!state.earned.includes(fact.id)&&!state.legacy.includes(fact.id)),sameActive=state.active?.person===person;
   const quest=index<0?null:{...questFor(person,index,sameActive?state.active.progress:0,sameActive?state.active.ruleVersion:2),status:ready.length?'ready':sameActive?'active':state.active?'blocked':'available'};
   return {id:person,name:PEOPLE[person].name,count:learnedCount,learnedCount,recordedCount,earnedCount,readyCount:ready.length,hasNewFact:ready.length>0,relationship:relationship(earnedCount+list.filter(fact=>state.legacy.includes(fact.id)).length,list.length),quest,quiz:{eligible:recordedCount===list.length,best:state.quizzes[person]?.best??0,passed:state.quizzes[person]?.passed??false,prize:QUIZ_PRIZE},facts:list.map((fact,index)=>({id:fact.id,number:index+1,locked:!state.learned.includes(fact.id),recorded:state.recorded.includes(fact.id),carried:state.learned.includes(fact.id)&&!state.recorded.includes(fact.id),...(state.learned.includes(fact.id)?{text:fact.text}:{})}))};
  }
  function snapshot(){const reading=read();if(!reading.ok)return {...reading,total:IDS.size,count:0,recordedCount:0,carriedIDs:[],active:null,people:[],pending:[],pendingRewards:[],pendingAmount:0};const state=reading.state,people=authoredPeople();return {ok:true,error:'',total:IDS.size,count:state.learned.length,recordedCount:state.recorded.length,carriedIDs:state.learned.filter(id=>!state.recorded.includes(id)),active:state.active?{...questFor(state.active.person,state.active.index,state.active.progress,state.active.ruleVersion),status:'active'}:null,people:PERSON_IDS.map(person=>personView(state,person,people)),pending:state.pending.map(item=>({...item})),pendingRewards:state.pending.map(item=>({...item})),pendingAmount:state.pending.reduce((sum,item)=>sum+item.amount,0),paid:state.paid.slice()};}
  function conversation(person){if(!own(PEOPLE,person))return fail('This character has no music history collection.');const reading=read();if(!reading.ok)return reading;const view=personView(reading.state,person,authoredPeople());return {ok:true,...view,message:view.hasNewFact?'A new fact is ready to learn!':view.learnedCount===view.facts.length?'You have learned all '+view.facts.length+' facts. Bring any carried facts to the scholar.':view.quest?.status==='active'?'No new facts yet. Finish our friendship quest first.':'No new facts are unlocked yet. Complete a friendship quest to earn one.'};}
  function acceptQuest(person){
   if(!own(PEOPLE,person)||!near(person))return fail('Talk to this musician nearby to accept a friendship quest.');const reading=read();if(!reading.ok)return reading;const state=reading.state,view=personView(state,person);
   if(state.active)return fail('Finish your current friendship quest for '+PEOPLE[state.active.person].name+' first.');if(view.hasNewFact)return fail('Learn the new fact you already earned before accepting another quest.');if(!view.quest)return fail('You have completed this musician’s fact collection.');
   state.active={ruleVersion:2,person,index:view.quest.index,progress:0,seen:[],nonce:'quest-'+(++serial)+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)};const saved=save(reading,state);return saved.ok?{ok:true,quest:{...view.quest,status:'active'}}:saved;
  }
  function learnFact(person){
   if(!own(PEOPLE,person)||!near(person))return fail('Walk over to '+(PEOPLE[person]?.name||'this musician')+' to learn a new fact.');const reading=read();if(!reading.ok)return reading;const state=reading.state,fact=PEOPLE[person].facts.find(item=>state.earned.includes(item.id)&&!state.learned.includes(item.id));
   if(!fact)return {ok:false,noNewFact:true,error:'No new facts are unlocked yet. Complete a friendship quest to earn one.'};state.learned.push(fact.id);const saved=save(reading,state);return saved.ok?{ok:true,fact:CONTENT?.resolvedFact(authored(),fact.id)||{...fact},person,count:personView(state,person).learnedCount,reward:factReward(fact.id)}:saved;
  }
  function beginRun(game){const reading=read();if(!reading.ok||!reading.state.active||!GAMES.includes(game)||questFor(reading.state.active.person,reading.state.active.index,reading.state.active.progress,reading.state.active.ruleVersion).game!==game)return null;const token='history-run-'+(++serial)+'-'+Date.now().toString(36);tokens.set(game,{token,owner:reading.owner,nonce:reading.state.active.nonce});return token;}
  function validResult(game,value){
   if(!value||typeof value!=='object'||value.practice===true||value.watching===true||value.developer===true)return false;
   if(game==='pitch')return ['classic','endless','levels','level'].includes(value.mode)&&integer(value.correct)&&integer(value.misses)&&integer(value.streak)&&value.streak<=value.correct&&integer(value.score)&&typeof value.won==='boolean'&&typeof value.perfect==='boolean';
   if(game==='triad')return ['computer','advanced'].includes(value.mode)&&integer(value.captures,1000)&&integer(value.score,16)&&typeof value.won==='boolean'&&typeof value.comeback==='boolean';
   return game==='rhythm'&&value.mode==='tap'&&integer(value.total,128)&&value.total>=8&&integer(value.hits,128)&&value.hits<=value.total&&integer(value.extra,1000)&&integer(value.early,128)&&integer(value.late,128)&&value.early+value.late<=value.hits;
  }
  function validActivity(game,value){
   if(!value||typeof value!=='object'||value.practice===true||value.watching===true||value.developer===true)return false;
   if(game==='dance')return value.version===2&&value.complete===true&&value.bars===16&&value.passed===true&&Number.isFinite(value.scorePercent)&&value.scorePercent>=80&&value.scorePercent<=100;
   if(game==='piano'&&value.kind==='reading')return value.complete===true&&['treble','bass'].includes(value.clef)&&integer(value.correct)&&value.correct>=1&&integer(value.mistakes,10000);
   if(game==='piano')return typeof value.runId==='string'&&['melody','scale','interval'].includes(value.kind)&&['guided','memory'].includes(value.mode)&&integer(value.mistakes,10000)&&(value.kind!=='scale'||['major','minor'].includes(value.scaleType));
   return game==='fishing'&&typeof value.id==='string'&&typeof value.fishId==='string'&&['common','uncommon','rare','epic','legendary'].includes(value.rarity)&&['4/4','6/8','2/2'].includes(value.meter)&&value.caught===true&&value.outcome==='caught'&&(value.reason===undefined||value.reason===null)&&integer(value.hits)&&value.hits>0&&integer(value.misses)&&integer(value.extras)&&typeof value.perfect==='boolean'&&value.perfect===(value.misses===0&&value.extras===0);
  }
  function record(game,runId,value,token,activity){
   if(typeof runId!=='string'||!/^[a-z0-9:_-]{1,128}$/i.test(runId)||(activity?!validActivity(game,value):!validResult(game,value)))return false;
   const reading=read(),context=tokens.get(game);if(!reading.ok||!context||context.token!==token||context.owner!==reading.owner||!reading.state.active||context.nonce!==reading.state.active.nonce)return false;
   const state=reading.state,active=state.active,quest=questFor(active.person,active.index,active.progress,active.ruleVersion);if(quest.game!==game)return false;const key=game+':'+runId;if(state.seen.includes(key))return false;
   state.seen.push(key);state.seen=state.seen.slice(-MAX_SEEN);let success=false;
   if(game==='pitch')success=value.correct>=quest.target;
   else if(game==='rhythm')success=100*value.hits/(value.total+value.extra)>=quest.target;
   else if(game==='triad')success=value.captures>=quest.target&&(quest.tier<3||value.won);
   else if(game==='dance')success=value.passed===true&&value.scorePercent>=quest.target;
   else if(game==='piano')success=quest.activityKind==='reading'?value.kind==='reading'&&value.correct>=quest.target:quest.activityKind?value.kind===quest.activityKind:quest.ruleVersion>=2?['melody','scale'].includes(value.kind)||value.kind==='reading'&&value.correct>=10:true;
   else if(game==='fishing'){active.progress++;active.seen.push(key);success=active.progress>=quest.target;}
   let fact=null;if(success){fact=PEOPLE[active.person].facts[active.index];state.earned.push(fact.id);state.active=null;}
   const saved=save(reading,state);if(!saved.ok)return false;if(success)try{api.onFactReady?.({person:quest.person,factId:fact.id});}catch{}return true;
  }
  const recordResult=(game,runId,result,token)=>record(game,runId,result,token,false);
  const recordActivity=(game,event,token)=>record(game,game==='fishing'?event?.id:event?.runId,event,token,true);
  function planAwards(state){const reserved=new Set([...state.paid,...state.pending.map(item=>item.id)]);for(const item of rewardPlans(state))if(!reserved.has(item.id)){state.pending.push(item);reserved.add(item.id);}}
  function payPending(){
   let notes=0;for(let step=0;step<MAX_AWARDS;step++){
    const reading=read();if(!reading.ok)return {...reading,notes};if(!reading.state.pending.length)return {ok:true,notes};if(!atScholar())return {...fail('Return to the scholar to collect your Notes.'),notes};const item=reading.state.pending[0];
    if(!allowed()||identity()!==reading.owner)return {...fail('Your player changed before the reward was saved.'),notes};
    let result;try{result=api.wallet?.grantReward(item.id,item.amount);}catch{}if(!result?.ok)return {...fail(result?.error||'Your discoveries are recorded. Your Notes could not be saved yet; return to the scholar and try again.'),notes};
    const next={...reading.state,pending:reading.state.pending.slice(1),paid:[...reading.state.paid,item.id]},saved=save(reading,next);if(!saved.ok)return {...saved,notes};if(!result.alreadyRewarded&&!result.alreadyClaimed)notes+=integer(result.amount)?result.amount:item.amount;
   }return {...fail('Some rewards are still pending. Speak to the scholar again.'),notes};
  }
  function deposit(){
   if(!atScholar())return fail('Visit the scholar on the lounge couch to hand in your facts.');const reading=read();if(!reading.ok)return reading;const state=reading.state,ids=state.learned.filter(id=>!state.recorded.includes(id));state.recorded.push(...ids);planAwards(state);const saved=save(reading,state);if(!saved.ok)return saved;const paid=payPending();return {...paid,amount:paid.notes||0,deposited:ids.length,recordedCount:state.recorded.length};
  }
  function shuffled(items){const output=items.slice();for(let i=output.length-1;i>0;i--){let raw;try{raw=api.random?.()??Math.random();}catch{raw=0;}const index=Math.min(i,Math.max(0,Math.floor((Number.isFinite(raw)?raw:0)*(i+1))));[output[i],output[index]]=[output[index],output[i]];}return output;}
  function attemptAllowed(){return attempt&&allowed()&&attempt.owner===identity()&&atScholar();}
  function quizState(){if(!attemptAllowed())return null;return {person:attempt.person,name:PEOPLE[attempt.person].name,total:attempt.questions.length,answered:attempt.questions.filter(question=>question.selected!==null).length,finished:attempt.finished,score:attempt.score??null,passed:attempt.passed??false,reward:QUIZ_PRIZE,questions:attempt.questions.map(question=>({id:question.id,prompt:question.prompt,choices:question.choices.slice(),selected:question.selected,...(attempt.finished?{answer:question.answer,correct:question.selected===question.answer,factId:question.factId,explanation:question.explanation}:{} )}))};}
  function startQuiz(person){
   if(!own(PEOPLE,person)||!atScholar())return fail('Visit the scholar to take a history quiz.');const reading=read();if(!reading.ok)return reading;if(PEOPLE[person].facts.some(fact=>!reading.state.recorded.includes(fact.id)))return fail('Record all '+PEOPLE[person].facts.length+' facts from '+PEOPLE[person].name+' with the scholar before taking this quiz.');
   const content=authored(),pool=(CONTENT?.resolveQuestions(content)||QUESTIONS).filter(question=>question.person===person),facts=new Map((CONTENT?.resolvePeople(content)?.[person]?.facts||PEOPLE[person].facts).map(fact=>[fact.id,fact]));if(pool.length<QUESTION_COUNT)return fail('This quiz could not load. Reopen the scholar after refreshing the game.');
   attempt={owner:reading.owner,person,finished:false,questions:shuffled(pool).slice(0,QUESTION_COUNT).map(question=>{const choices=shuffled(question.choices.map((text,index)=>({text,index})));return {id:question.id,prompt:question.prompt,factId:question.factId,explanation:facts.get(question.factId)?.text,choices:choices.map(choice=>choice.text),answer:choices.findIndex(choice=>choice.index===question.answer),selected:null};})};return {ok:true,...quizState()};
  }
  function answerQuiz(questionId,index){if(!attemptAllowed()||attempt.finished)return fail('Open an active quiz at the scholar first.');const question=attempt.questions.find(item=>item.id===questionId);if(!question||!integer(index,question.choices.length-1))return fail('Choose one of this question’s answers.');question.selected=index;return {ok:true,...quizState()};}
  function finishQuiz(){
   if(!attemptAllowed())return fail('Return to the scholar to finish your quiz.');if(attempt.questions.some(question=>question.selected===null))return fail('Answer all 10 questions before finishing.');
   if(!attempt.finished){const reading=read();if(!reading.ok)return reading;if(PEOPLE[attempt.person].facts.some(fact=>!reading.state.recorded.includes(fact.id)))return fail('Your recorded collection changed. Reopen the scholar before taking this quiz.');const score=Math.round(100*attempt.questions.filter(question=>question.selected===question.answer).length/attempt.questions.length),previous=reading.state.quizzes[attempt.person]||{best:0,passed:false,attempts:0},best=Math.max(previous.best,score);
    reading.state.quizzes[attempt.person]={best,passed:best>=PASS_SCORE,attempts:Math.min(1000000,previous.attempts+1)};planAwards(reading.state);const saved=save(reading,reading.state);if(!saved.ok)return saved;attempt.finished=true;attempt.score=score;attempt.passed=score>=PASS_SCORE;
   }
   const paid=payPending();return {...paid,amount:paid.notes||0,...quizState()};
  }
  function developerSet(person,stage){
   if(!developer()||!own(PEOPLE,person)||!['ready','carried','recorded','reset'].includes(stage))return fail('Progression editing is available only in an isolated developer test player.');const reading=read();if(!reading.ok)return reading;const state=reading.state,list=PEOPLE[person].facts,personIds=new Set(list.map(fact=>fact.id));
   if(stage==='reset'){
    for(const key of ['earned','learned','recorded','legacy','credited'])state[key]=state[key].filter(id=>!personIds.has(id));state.completed=state.completed.filter(id=>id!==person);delete state.quizzes[person];const matches=id=>id.startsWith('scholar-fact:'+person+'-')||id.startsWith('scholar-set:'+person+':')||id==='scholar-complete:'+person||id.startsWith('scholar-complete:'+person+':')||id==='scholar-quiz:'+person||id.startsWith('scholar-quiz:'+person+':');state.pending=state.pending.filter(item=>!matches(item.id));state.paid=state.paid.filter(id=>!matches(id));state.historicalAwards=state.historicalAwards.filter(item=>!matches(item.id));
   }else if(stage==='recorded'){
    for(const fact of list){if(!state.legacy.includes(fact.id)&&!state.earned.includes(fact.id))state.earned.push(fact.id);if(!state.learned.includes(fact.id))state.learned.push(fact.id);if(!state.recorded.includes(fact.id))state.recorded.push(fact.id);}
   }else{
    let fact=list.find(item=>state.earned.includes(item.id)&&!state.learned.includes(item.id));if(!fact){fact=list.find(item=>!state.earned.includes(item.id)&&!state.legacy.includes(item.id));if(fact)state.earned.push(fact.id);}
    if(stage==='carried'&&fact&&!state.learned.includes(fact.id))state.learned.push(fact.id);
   }
   if(state.active?.person===person)state.active=null;attempt=null;return save(reading,state);
  }
  return {snapshot,conversation,acceptQuest,learnFact,beginRun,recordResult,recordActivity,deposit,startQuiz,answerQuiz,finishQuiz,quizState,developerSet};
 }
 return {KEY,PEOPLE,REWARDS,QUIZ_PRIZE,PASS_SCORE,QUESTION_COUNT,COLLECTION_BONUSES,factReward,questFor,create};
});
