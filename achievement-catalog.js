/* A read-only view of achievements already recorded by the arcade's reward engines. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaAchievements=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const CATEGORIES=[
  {id:'arcade',label:'Around the arcade'},
  {id:'pitch',label:'Pitch Race'},
  {id:'triad',label:'Music Triad'},
  {id:'rhythm',label:'Rhythm Room'},
  {id:'dance',label:'DJ Line Dance'},
  {id:'fishing',label:'Rhythm Fishing'},
  {id:'piano',label:'Piano Lab'},
  {id:'classroom',label:'Classroom'}
 ];
 const MEMORIES=['twinkle','mary','london-bridge','hot-cross-buns','row-your-boat','frere-jacques','ode-to-joy','jingle-bells','old-macdonald'];
 const LESSONS=[
  ['note-naming','Note Names','Complete Note names and pass its five-question quiz.',10,[0,1,2,0,1]],
  ['rhythm-tree','The Rhythm Tree','Complete Note lengths and pass its five-question quiz.',4,[1,0,2,1,0]],
  ['time-signatures','Time to Count','Complete Time signatures and pass its five-question quiz.',8,[2,1,0,2,1]],
  ['bass-clef','Bass Clef Reader','Complete Bass clef and pass its five-question quiz.',9,[0,1,2,0,1]],
  ['grand-staff','Both Staffs Together','Complete Grand staff & Middle C and pass its five-question quiz.',8,[0,1,2,0,2]],
  ['major-minor-keys','Find Your Musical Home','Complete Major & minor keys and pass its five-question quiz.',8,[0,1,2,0,1]],
  ['dynamics','Loud and Soft','Complete Dynamics and pass its five-question quiz.',8,[0,1,2,0,1]],
  ['tempo','Fast and Slow','Complete Tempo and pass its five-question quiz.',8,[1,0,2,1,0]]
 ];
 const FISHING=[
  ['fishing-first-catch','First Catch','Catch your first fish.',1],
  ['fishing-five-catches','Lake Regular','Catch five fish.',5],
  ['fishing-twenty-catches','Seasoned Angler','Catch twenty fish.',20],
  ['fishing-perfect-catch','In Perfect Time','Catch a fish without a missed note or extra tap.',1],
  ['fishing-rare-catch','Something Special','Catch a rare, epic, or legendary fish.',1],
  ['fishing-legendary-catch','Legend of the Lake','Catch a legendary fish.',1],
  ['fishing-three-meters','Master of Three Meters','Catch fish in 4/4, 6/8, and cut time.',3],
  ['fishing-ten-species','Fish Finder','Discover ten different kinds of fish.',10],
  ['fishing-all-species','The Complete Catch','Discover all thirty kinds of fish.',30,'Lake otter companion']
 ];
 const row=(id,category,title,description,xp=50,reward)=>({id,category,title,description,xp,rewards:[xp+' XP',...(reward?['Unlock: '+reward]:[])]});
 const CATALOG=[
  row('bowtie','arcade','Your Own Style','Save a new look at the boutique.',50,'Bow tie'),
  row('starclip','arcade','Jump Start','Jump ten times in the arcade.',50,'Neon star clip'),
  row('partyglasses','arcade','Party Starter','Perform five emotes.',50,'Party glasses'),
  row('halo','arcade','Arcade Explorer','Walk 450 steps around the arcade.',50,'Neon halo'),
  row('first-pitch-result','pitch','Your First Pitch Race','Finish one Pitch Race run.'),
  row('pitch-ten-correct','pitch','Ten Right','Read ten notes correctly in one Pitch Race run.'),
  row('pitch-ten-streak','pitch','Pitch Streak','Read ten notes in a row without a mistake in one Pitch Race run.'),
  row('pitch-perfect-run','pitch','Pitch Perfect','Finish a Pitch Race run with no wrong notes. Play at least one note.'),
  row('pitch-bass-reader','pitch','Bass Clef Reader','Read ten bass-clef notes correctly in one Pitch Race run.',100,'Bass clef pin'),
  row('pitch-bass-streak','pitch','Bass Clef Streak','Read twenty bass-clef notes in a row without a mistake in one Pitch Race run.',150,'Bass reader laurel'),
  row('pitch-grand-reader','pitch','Grand Staff Reader','Read ten treble notes and ten bass notes correctly in one Grand Staff run.',150,'Grand staff badge'),
  row('pitch-grand-perfect','pitch','Grand Staff Mastery','Read at least twenty notes, including both clefs, without a mistake in one Grand Staff run.',250,'Grand staff crown'),
  ...[10,20,30,40,50].map(level=>row('pitch-level-'+level,'pitch','Pitch Race Level '+level,'Complete level '+level+' in Pitch Race Level mode.',level===50?250:50,level===50?'Starlight transformation':level===40?'Radiant pitch crown':({10:'Bronze',20:'Silver',30:'Gold'}[level]+' pitch laurel'))),
  row('first-triad-result','triad','Your First Music Triad Match','Finish one Music Triad match.'),
  row('triad-first-win','triad','Your First Triad Win','Win a Music Triad match.'),
  row('triad-hard-advanced-win','triad','Advanced Triad Champion','Win an Advanced Music Triad game against the computer on Hard.',250,'Triad champion crown'),
  row('first-rhythm-result','rhythm','Your First Rhythm Round','Finish a Tap Practice round in Rhythm Room.'),
  row('rhythm-perfect-round','rhythm','Perfect Rhythm','Match every note in a Tap Practice round with no extra taps.'),
  row('rhythm-hundred-streak','rhythm','One Hundred in Time','Match one hundred notes in a row in Rhythm Room Tap Practice.',250,'Rhythm fox companion'),
  row('dance-first-finish','dance','First Steps','Finish an eight-bar DJ line dance with at least one correct step.',50,'First Steps DJ track'),
  row('dance-twenty-streak','dance','Find the Groove','Match twenty steps in a row in one completed DJ line dance.',100,'Shutter shades'),
  row('dance-normal-groove','dance','Dance Floor Regular','Finish a Normal DJ line dance with at least 80% accuracy.',100),
  row('dance-hard-groove','dance','DJ Coda’s Headliner','Finish a Hard DJ line dance with at least 80% accuracy.',150,'Midnight Headliner DJ track'),
  row('dance-perfect-set','dance','Mirrorball Master','Match every step in a completed DJ line dance with no wrong or extra arrows.',150,'Roller skates'),
  row('dance-hard-perfect','dance','Disco Legend','Match every step in a completed Hard DJ line dance with no wrong or extra arrows.',250,'Boombox'),
  ...FISHING.map(([id,title,description,target,reward])=>({...row(id,'fishing',title,description,50,reward),target})),
  row('piano-memory-master','piano','Melody Memory Master','Complete all nine Piano Lab melodies from memory.',250,'Piano phoenix companion'),
  ...LESSONS.map(([id,title,description])=>row('classroom-'+id,'classroom',title,description)),
  row('classroom-accidentals-key-signatures','classroom','Signs and Signatures','Complete Accidentals & key signatures and pass its five-question quiz.'),
  row('haydn-final-exam','classroom','Haydn’s Final Exam','Pass Haydn’s Final Exam with at least 80% correct.',200)
 ];
 const integer=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
 const finite=(value,max=10000000)=>Number.isFinite(value)&&value>=0&&value<=max;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 function journal(raw){
  if(!object(raw)||raw.version!==1||!Array.isArray(raw.events)||raw.events.length>20000)return new Set();
  const ids=new Set();
  for(const event of raw.events)if(object(event)&&typeof event.id==='string'&&/^[A-Za-z0-9:_-]{1,512}$/.test(event.id)&&integer(event.xp,1000)&&event.xp>0)ids.add(event.id);
  return ids;
 }
 function quizPassed(raw,correct){
  if(!object(raw)||raw.bankVersion!==1)return false;
  return [raw.answers,raw.bestAnswers].some(answers=>Array.isArray(answers)&&answers.length===5&&answers.every(answer=>integer(answer,2))&&answers.reduce((score,answer,index)=>score+(answer===correct[index]?1:0),0)>=4);
 }
 function progressFor(def,input,events){
  const avatar=object(input.avatar)?input.avatar:{};
  if(def.id==='bowtie')return {progress:avatar.customized===true?1:0,target:1,progressLabel:avatar.customized===true?'Look saved':'Save a look at the boutique'};
  if(def.id==='starclip'||def.id==='partyglasses'||def.id==='halo'){
   const key=def.id==='starclip'?'jumps':def.id==='partyglasses'?'emotesUsed':'walked',target=def.id==='starclip'?10:def.id==='partyglasses'?5:450,unit=def.id==='starclip'?'jumps':def.id==='partyglasses'?'emotes':'steps';
   const progress=Math.min(target,finite(avatar[key])?Math.floor(avatar[key]):0);
   return {progress,target,progressLabel:progress+' / '+target+' '+unit};
  }
  if(def.id.startsWith('first-')){
   const game=def.id==='first-pitch-result'?'pitch':def.id==='first-triad-result'?'triad':'rhythm';
   const progress=[...events].some(id=>id.startsWith('game:'+game+':'))?1:0;
   return {progress,target:1,progressLabel:progress+' / 1 completed '+(game==='triad'?'matches':'runs')};
  }
  if(def.id.startsWith('pitch-level-')){
   const target=Number(def.id.slice('pitch-level-'.length));
   const saved=input.progression?.version===1&&integer(input.progression.bestPitchLevel,1000)?input.progression.bestPitchLevel:0;
   const cabinet=input.pitchProgress?.version===1&&integer(input.pitchProgress.bestCompleted,999)?input.pitchProgress.bestCompleted:0;
   const progress=Math.min(target,Math.max(saved,cabinet));
   return {progress,target,progressLabel:'Level '+progress+' / '+target+' completed'};
  }
  if(def.category==='fishing'){
   const rows=Array.isArray(input.fishingAchievements)?input.fishingAchievements.slice(0,100):[];
   const saved=rows.find(item=>object(item)&&item.id===def.id&&item.target===def.target&&integer(item.progress,def.target));
   const progress=saved?.progress||0;
   return {progress,target:def.target,progressLabel:progress+' / '+def.target+(def.id==='fishing-three-meters'?' time signatures':def.id.endsWith('species')?' kinds of fish':' catches')};
  }
  if(def.id==='piano-memory-master'){
   const progress=MEMORIES.filter(id=>events.has('quest:piano-memory:'+id)).length;
   return {progress,target:MEMORIES.length,progressLabel:progress+' / '+MEMORIES.length+' melodies played from memory'};
  }
  if(def.id.startsWith('classroom-')){
   if(def.id==='classroom-accidentals-key-signatures')return {};
   const id=def.id.slice('classroom-'.length),lesson=LESSONS.find(item=>item[0]===id),total=lesson[3];
   const raw=input.lessons?.version===1?input.lessons.lessons?.[id]:null;
   const step=object(raw)&&integer(raw.step,total)?raw.step:0;
   const quiz=input.quizzes?.version===1?input.quizzes.quizzes?.[id]:null,passed=quizPassed(quiz,lesson[4]);
   return {progress:step+(passed?1:0),target:total+1,progressLabel:step+' / '+total+' lesson steps · Quiz '+(passed?'passed':'not yet passed')};
  }
  if(def.id==='haydn-final-exam'){
   const exam=input.finalExam;
   if(!object(exam)||exam.version!==1||![24,40,80].includes(exam.bestTotal)||!integer(exam.bestScore,exam.bestTotal))return {progress:0,target:80,progressLabel:'Best score: not attempted · 80% passes'};
   const percent=Math.round(exam.bestScore*100/exam.bestTotal);
   return {progress:Math.min(80,percent),target:80,progressLabel:'Best score: '+percent+'% · 80% passes'};
  }
  return {};
 }
 function buildSnapshot(input={}){
  if(!object(input))input={};const events=journal(input.progression);
  const items=CATALOG.map(def=>{
   const earned=events.has('achievement:'+def.id),progress=progressFor(def,input,events);
   if(earned&&progress.target!==undefined){progress.progress=progress.target;progress.progressLabel='Completed';}
   return {id:def.id,category:def.category,title:def.title,description:def.description,xp:def.xp,rewards:[...def.rewards],earned,...progress};
  });
  return {items,earned:items.filter(item=>item.earned).length,total:items.length,categories:CATEGORIES.map(category=>({...category}))};
 }
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 freeze(CATEGORIES);freeze(CATALOG);
 return Object.freeze({CATEGORIES,CATALOG,buildSnapshot});
});
