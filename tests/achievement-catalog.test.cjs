const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const A=require('../achievement-catalog.js');
const P=require('../player-progression.js');
const F=require('../fishing-progress.js');
const Fish=require('../rhythm-fishing-engine.js');
const Q=require('../classroom-quiz.js');
const Lessons=require('../classroom-tutorials.js');

const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};};
const snapshot=(data={})=>A.buildSnapshot(data);
const item=(state,id)=>state.items.find(value=>value.id===id);
const journal=events=>({version:1,xp:events.reduce((sum,event)=>sum+event.xp,0),events,bestPitchLevel:0});
const event=(id,xp=50)=>({id:'achievement:'+id,xp});

test('catalog lists every issued achievement and matches the real cosmetic, fishing and lesson catalogs',()=>{
 const emitted=[
  'bowtie','starclip','partyglasses','halo',
  'first-pitch-result','first-triad-result','first-rhythm-result','triad-first-win',
  'pitch-ten-correct','pitch-ten-streak','pitch-perfect-run','rhythm-perfect-round',
  ...P.ACHIEVEMENT_REWARDS.map(reward=>reward.achievement),
  ...P.DANCE_ACHIEVEMENTS.map(achievement=>achievement.id),
  ...F.ACHIEVEMENTS.map(achievement=>achievement.id),
  ...Lessons.LESSONS.map(lesson=>'classroom-'+lesson.id),'classroom-accidentals-key-signatures','haydn-final-exam'
 ];
 assert.deepEqual(new Set(A.CATALOG.map(row=>row.id)),new Set(emitted));
 assert.equal(A.CATALOG.length,49);assert.equal(new Set(A.CATALOG.map(row=>row.id)).size,49);
 assert.equal(A.CATEGORIES.length,8);
 for(const reward of P.ACHIEVEMENT_REWARDS)assert.ok(A.CATALOG.find(row=>row.id===reward.achievement).rewards.includes('Unlock: '+reward.label));
 for(const source of F.ACHIEVEMENTS){const row=A.CATALOG.find(row=>row.id===source.id);assert.equal(row.xp,source.xp);assert.equal(row.target,source.target);assert.equal(row.description,source.description);}
 for(const source of P.DANCE_ACHIEVEMENTS){const row=A.CATALOG.find(row=>row.id===source.id);assert.equal(row.xp,source.xp);assert.equal(row.title,source.title);assert.equal(row.description,source.description);}
 assert.ok(Object.isFrozen(A.CATALOG));assert.ok(Object.isFrozen(A.CATALOG[0].rewards));
});

test('earned state uses the entire valid XP journal, never cosmetic ownership, totals or recent prose',()=>{
 const events=[event('starclip'),...Array.from({length:16},(_,index)=>({id:'game:pitch:later-'+index,xp:10}))];
 const source={progression:journal(events),avatar:{customized:true,jumps:10,emotesUsed:5,walked:450},wallet:{owned:['bowtie','starclip','partyglasses','halo']}};
 const state=snapshot(source);assert.equal(state.earned,1);assert.equal(item(state,'starclip').earned,true);
 assert.equal(item(state,'bowtie').earned,false,'A met goal cannot fabricate its saved XP reward');
 assert.equal(snapshot({progression:{version:1,recent:[event('starclip')],xp:100000}}).earned,0);
 const malformed={version:1,events:[{id:'achievement:starclip',xp:0},{id:'achievement:halo',xp:NaN},{id:'achievement:bowtie',xp:1001},{id:'achievement:partyglasses',xp:'50'},null]};
 assert.equal(snapshot({progression:malformed}).earned,0);
 assert.equal(snapshot({progression:{version:2,events:[event('starclip')]}}).earned,0);
 assert.equal(snapshot({progression:{version:1,events:Array(20001).fill(event('starclip'))}}).earned,0);
});

test('actual cabinet reward engines produce every listed cabinet achievement with accurate XP labels',()=>{
 const saved=store(),player=P.create({storage:saved});
 const perfect={mode:'levels',completedLevel:50,score:100,correct:40,misses:0,streak:40,won:true,staff:'grand',clefStats:{treble:{correct:20,misses:0,bestStreak:20},bass:{correct:20,misses:0,bestStreak:20}}};
 assert.equal(player.recordGameEvent('pitch','actual-pitch',perfect).ok,true);
 assert.equal(player.recordGameEvent('triad','actual-triad',{mode:'computer',rules:'advanced',difficulty:'hard',score:10,captures:7,won:true}).ok,true);
 assert.equal(player.recordGameEvent('rhythm','actual-rhythm',{mode:'tap',total:100,hits:100,extra:0,early:1,late:1,streak:100}).ok,true);
 const raw=JSON.parse(saved.getItem(P.KEY)),state=snapshot({progression:raw});
 const cabinetRows=state.items.filter(row=>['pitch','triad','rhythm'].includes(row.category));
 assert.equal(cabinetRows.length,19);assert.equal(cabinetRows.filter(row=>row.earned).length,19);
 for(const row of cabinetRows){const award=raw.events.find(value=>value.id==='achievement:'+row.id);assert.equal(award.xp,row.xp,row.id);assert.ok(row.rewards.includes(award.xp+' XP'));}
 assert.match(item(state,'rhythm-perfect-round').description,/no extra taps/,'Early/late judgements are not an extra requirement');
});

test('saved full DJ dance results earn the six listed Dance achievements with matching XP and unlock labels',()=>{
 const saved=store(),player=P.create({storage:saved}),result={complete:true,difficulty:'hard',bars:8,notesTotal:32,hits:32,misses:0,bestStreak:32,score:3200,perfectHits:32,goodHits:0,wrongInputs:0,lateMisses:0,extras:0,accuracy:1,perfect:true};
 assert.equal(snapshot({progression:{version:1,xp:99999,events:[]},dance:{perfect:true,bestStreak:100}}).items.filter(row=>row.category==='dance'&&row.earned).length,0);
 assert.equal(player.recordDanceResult('hard-set',result).ok,true);
 assert.equal(player.recordDanceResult('normal-set',{...result,difficulty:'normal'}).ok,true);
 const raw=JSON.parse(saved.getItem(P.KEY)),state=snapshot({progression:raw}),rows=state.items.filter(row=>row.category==='dance');
 assert.equal(rows.length,6);assert.equal(rows.filter(row=>row.earned).length,6);
 assert.equal(state.categories.find(category=>category.id==='dance').label,'DJ Line Dance');
 for(const row of rows){assert.equal(raw.events.find(event=>event.id==='achievement:'+row.id).xp,row.xp);assert.ok(row.rewards.includes(row.xp+' XP'));}
 for(const [id,label]of [['dance-first-finish','First Steps DJ track'],['dance-twenty-streak','Shutter shades'],['dance-hard-groove','Midnight Headliner DJ track'],['dance-perfect-set','Roller skates'],['dance-hard-perfect','Boombox']])assert.ok(item(state,id).rewards.includes('Unlock: '+label));
 assert.equal(item(state,'dance-normal-groove').rewards.length,1);
});

test('per-run achievements do not invent progress from aggregate game counts, while saved milestones and avatar steps do',()=>{
 const source={avatar:{jumps:3,emotesUsed:2,walked:125.7,gameStats:{pitchCorrect:500,pitchStreak:500,rhythmBest:100,triadWins:100}},progression:{version:1,events:[],bestPitchLevel:12}};
 const state=snapshot(source);
 assert.equal(item(state,'starclip').progress,3);assert.equal(item(state,'partyglasses').progress,2);assert.equal(item(state,'halo').progress,125);assert.equal(item(state,'halo').progressLabel,'125 / 450 steps');
 assert.equal(item(state,'pitch-level-20').progress,12);assert.equal(item(state,'pitch-level-10').progress,10);
 for(const id of ['pitch-ten-correct','pitch-ten-streak','pitch-bass-streak','pitch-grand-perfect','triad-first-win','triad-hard-advanced-win','rhythm-perfect-round','rhythm-hundred-streak'])assert.equal('progress' in item(state,id),false,id);
 assert.equal(state.earned,0);
 assert.equal(item(snapshot({pitchProgress:{version:1,bestCompleted:30}}),'pitch-level-40').progress,30);
});

test('fishing progress comes from the existing validated catch model and does not award XP or trust earned flags',()=>{
 const fish=Fish.FISH[0],entries=['4/4','6/8','2/2'].map((meter,index)=>({id:'real-catch-'+index,fishId:fish.id,rarity:fish.rarity,meter,timeSignature:meter,hits:8,misses:0,extras:0,perfect:true,notes:fish.notes,xp:fish.xp,caught:true,outcome:'caught'}));
 entries.push({...entries[0]},{...entries[0],id:'invalid',xp:999});
 const fishing=F.create({catalog:Fish.FISH,getCatches:()=>entries}),achievements=fishing.getAchievements();
 const state=snapshot({fishingAchievements:achievements});
 assert.equal(item(state,'fishing-five-catches').progress,3);
 assert.equal(item(state,'fishing-three-meters').progress,3);
 assert.equal(item(state,'fishing-ten-species').progress,1);
 assert.equal(item(state,'fishing-perfect-catch').progress,1);
 assert.equal(state.earned,0,'Catch-derived earned flags cannot mint an achievement record');
 const changed=snapshot({progression:journal([event('fishing-first-catch')]),fishingAchievements:achievements});
 assert.equal(changed.earned,1);
 assert.equal(item(changed,'fishing-first-catch').earned,true);
});

test('piano mastery counts the nine saved memory quests rather than guided lessons or unsaved completion flags',()=>{
 const saved=store(),player=P.create({storage:saved});
 for(const id of P.PIANO_MEMORIES.slice(0,8))assert.equal(player.recordPianoMemory(id).ok,true);
 const partial=JSON.parse(saved.getItem(P.KEY)),state=snapshot({progression:partial,piano:{learned:P.PIANO_MEMORIES,completed:P.PIANO_MEMORIES.map(id=>'piano-memory:'+id)}});
 assert.equal(item(state,'piano-memory-master').progress,8);assert.equal(item(state,'piano-memory-master').earned,false);
 assert.equal(player.recordPianoMemory(P.PIANO_MEMORIES[8]).ok,true);
 const complete=snapshot({progression:JSON.parse(saved.getItem(P.KEY))});
 assert.equal(item(complete,'piano-memory-master').earned,true);assert.equal(item(complete,'piano-memory-master').xp,250);
});

test('classroom progress uses actual teaching totals and saved quiz answers; the exam uses its scored best result',()=>{
 for(const lesson of Lessons.LESSONS){
  const quiz=Q.QUIZZES[lesson.id],correct=quiz.questions.map(question=>question.correct);
  const data={lessons:{version:1,lessons:{[lesson.id]:{step:lesson.total,completed:false}}},quizzes:{version:1,quizzes:{[lesson.id]:{bankVersion:1,answers:correct,bestAnswers:[]}}}};
  const row=item(snapshot(data),'classroom-'+lesson.id);
  assert.equal(row.target,lesson.total+1);assert.equal(row.progress,row.target);assert.equal(row.earned,false);
  assert.match(row.progressLabel,/Quiz passed/);
  data.quizzes.quizzes[lesson.id].answers=[...correct];for(let index=0;index<2;index++)data.quizzes.quizzes[lesson.id].answers[index]=(correct[index]+1)%3;
  assert.equal(item(snapshot(data),'classroom-'+lesson.id).progress,lesson.total);
 }
 const partial=snapshot({finalExam:{version:1,bankVersion:1,bestScore:19,bestTotal:24,bestPercent:99,completedAt:1}});
 assert.equal(item(partial,'haydn-final-exam').earned,false);assert.match(item(partial,'haydn-final-exam').progressLabel,/79%/);
 const passed=snapshot({progression:journal([event('haydn-final-exam',200)]),finalExam:{version:1,bestScore:20,bestTotal:24}});
 assert.equal(item(passed,'haydn-final-exam').earned,true);assert.equal(item(passed,'haydn-final-exam').xp,200);
});

test('snapshots are independent, do not mutate player data, and run in a browser without storage or network',()=>{
 const input={progression:journal([event('starclip')]),avatar:{jumps:10}},before=JSON.stringify(input),first=snapshot(input);
 first.items[0].rewards.push('not a real reward');first.items[0].title='Changed';first.categories[0].label='Changed';
 assert.equal(JSON.stringify(input),before);assert.equal(snapshot().earned,0);assert.equal(snapshot(input).items[0].title,'Your Own Style');
 assert.equal(snapshot(null).total,49);
 const win={};Object.defineProperty(win,'localStorage',{get(){throw Error('No storage reads are permitted');}});win.fetch=()=>{throw Error('No network');};
 const context=vm.createContext({window:win});vm.runInContext(fs.readFileSync(require.resolve('../achievement-catalog.js'),'utf8'),context);
 assert.equal(JSON.stringify(win.CodaAchievements.buildSnapshot(input)),JSON.stringify(snapshot(input)));
});
