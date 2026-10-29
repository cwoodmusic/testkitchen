/* Private classroom progress only. Local backups can contain guest work and
 * must never be uploaded. No names, prose, recordings, songs, or editor data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomProfileData=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const MAX_BYTES=8*1024*1024,MAX_TIME=253402300799999;
 const KEYS=Object.freeze({avatar:'musicArcadeV1',progression:'codaPlayerProgressV1',wallet:'codaNotesWalletV1',missions:'codaMusicianMissionsV1',fishing:'codaRhythmFishingV1',piano:'codaPianoProgressV1',lessons:'codaClassroomLessonsV1',quizzes:'codaClassroomQuizzesV1',pitch:'pitchRaceLevelProgressV1',pitchTutorials:'pitchRaceTutorialsV1',finalExam:'codaHaydnFinalExamV1'});
 // Compositions and named/local educational records stay local. They must be
 // cleared between students and restored exactly with the guest's local work.
 const LOCAL_ONLY_KEYS=Object.freeze(['codaPianoTakeV1','codaDJLibraryV1','codaHallOfFameV1','rhythm-room-practice-v1','codaSongMachineDraftV1','codaAuthoredExamSessionV1','codaAuthoredQuizzesV1','codaAuthoredLessonsV1','codaClassroomExamStudyV1','codaClassroomLearningPathsV1','codaPlayNotebookV1','codaClassroomQuizAttemptsV1','codaMusicHistoryV1']);
 const SCOPED_KEYS=Object.freeze([...Object.values(KEYS),...LOCAL_ONLY_KEYS]);
 // Older guest backups remain restorable as local-only activity slots are added.
 const OPTIONAL_BACKUP_KEYS=new Set([KEYS.finalExam,'codaSongMachineDraftV1','codaAuthoredExamSessionV1','codaAuthoredQuizzesV1','codaAuthoredLessonsV1','codaClassroomExamStudyV1','codaClassroomLearningPathsV1','codaPlayNotebookV1','codaClassroomQuizAttemptsV1','codaMusicHistoryV1']);
 const split=value=>value.split(' ');
 const CATALOG={
  hairstyle:split('short bob long curly ponytail spiky bald buns pixie undercut braids locs afro slick pompadour mohawk powderwig'),
  outfit:split('pants shorts dress overalls suit coat hoodie tuxedo waistcoat gown robe leather tracksuit tutu kimono'),
  headwear:split('none cap beanie bucket crown headwrap witch wizard cowboy fedora tophat beret pirate astronaut flowercrown tiara viking cat bunny chef santa party straw sunvisor boater bowler celestialcrown triadchampion pitchlaurel10 pitchlaurel20 pitchlaurel30 pitchcrown40 basslaurel grandstaffcrown'),
  eyewear:split('none glasses sunglasses partyglasses round cateye aviator heartglasses starglasses steampunk cybervisor monocle 3d shutter sport rimless'),
  accessory:split('none bow headphones bowtie starclip halo earrings pixelheadphones trumpet microphone scarf cape wings necklace pearls flower satchel backpack guitar violin saxophone wand fan watchchain score boombox coffee teddy umbrella shield sword lantern vinyl camera book bouquet balloon skateboard paintpalette compass telescope handbag magicorb gamepad keytar flute accordion trophy nebulaaura bassclefpin grandstaffbadge'),
  shoes:split('sneakers boots hightops neon gold loafers heels platforms rollerskates iceskates clown slippers barefoot sandals ballet chelsea oxfords combat'),
  emote:split('wave dance spin robot disco bow cheer clap shrug heart peace airguitar moonwalk breakdance curtsy salute facepalm think'),
  form:split('human alien starlight'),pet:split('none cosmiccat neondragon lakeotter rhythmfox pianophoenix')
 };
 const VISITORS=split('visitor-vee-jay visitor-zizi visitor-metronome');
 const OWNED=[...new Set([...Object.values(CATALOG).flat(),...VISITORS])];
 const COLORS=['skin','hair','shirt','lowerColor','headwearColor','eyewearColor'];
 const DEFAULT_AVATAR={version:1,skin:'#e5ad75',hair:'#171424',shirt:'#999ca6',lowerColor:'#626875',headwearColor:'#db687f',eyewearColor:'#30374b',hairstyle:'bald',outfit:'pants',headwear:'none',eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave',form:'human',pet:'none',customized:false,walked:0,jumps:0,emotesUsed:0};
 const STAT_NAMES=split('totalRounds pitchRounds pitchCorrect pitchStreak pitchWins pitchImproved pitchPerfect pitchBestClassic pitchBestEndless pitchBestLevels pitchBestMulti triadRounds triadCaptures triadWins triadComebacks rhythmRounds rhythmBest rhythm90 rhythmPerfect');
 const LEGACY_LESSONS=['note-naming','rhythm-tree','time-signatures','bass-clef','grand-staff'];
 const LESSON_TOTALS={'note-naming':10,'rhythm-tree':4,'time-signatures':8,'bass-clef':9,'grand-staff':8,'major-minor-keys':8,dynamics:8,tempo:8};
 const QUIZ_CORRECT={'note-naming':[0,1,2,0,1],'rhythm-tree':[1,0,2,1,0],'time-signatures':[2,1,0,2,1],'bass-clef':[0,1,2,0,1],'grand-staff':[0,1,2,0,2],'major-minor-keys':[0,1,2,0,1],dynamics:[0,1,2,0,1],tempo:[1,0,2,1,0]};
 const EXAM_CATEGORIES=Object.freeze(['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo']);
 const EXAM_IDS=EXAM_CATEGORIES.flatMap(category=>Array.from({length:100},(_,index)=>category+'-'+String(index+1).padStart(3,'0')));
 const EXAM_SIZES=[24,40,80];
 const MELODIES=split('twinkle mary london-bridge hot-cross-buns row-your-boat frere-jacques ode-to-joy jingle-bells old-macdonald');
 const SCALES=split('c-major d-flat-major d-major e-flat-major e-major f-major f-sharp-major g-major a-flat-major a-major b-flat-major b-major c-minor c-sharp-minor d-minor e-flat-minor e-minor f-minor f-sharp-minor g-minor g-sharp-minor a-minor b-flat-minor b-minor');
 const INTERVALS=[1,2,3,4,5,7,12].flatMap(n=>['up-'+n,'down-'+n]);
 const PIANO_REWARDS=[...MELODIES.flatMap(id=>['piano-lesson:'+id,'piano-memory:'+id]),...SCALES.flatMap(id=>['piano-scale:'+id,'piano-scale-memory:'+id]),...INTERVALS.map(id=>'piano-interval:'+id)];
 const MISSION_TARGETS={
  'bach-triad-win':1,'mozart-triad-capture':3,'beethoven-pitch-win':1,'clara-pitch-streak':20,'joplin-rhythm-streak':20,'ellington-rhythm-streak':50,'ella-rhythm-perfect':1,'nina-pitch-notes':15,'miles-triad-comeback':1,
  'ella-fish-five':5,'nina-piano-melody':1,'mozart-pitch-thirty':30,'joplin-rhythm-perfect-three':3,'clara-fish-compound':1,
  'bach-piano-major':1,'ellington-triad-three':3,'miles-pitch-bass-ten':10,'beethoven-fish-epic':1,'nina-piano-minor':1,
  'mozart-triad-advanced':1,'ella-rhythm-seventy-five':75,'joplin-fish-perfect-rare':1,'clara-piano-memory':1,'bach-pitch-grand-twenty':20,
  'ellington-triad-hard':1,'miles-fish-legendary':1,'beethoven-pitch-level-thirty':30,'joplin-rhythm-hundred':100,'bach-triad-hard-advanced':1
 };
 // These tiny reward bounds also run before the progression module loads.
 // A contract test keeps them aligned without adding a login dependency.
 const LEVEL_PRIZE_XP=[0,80,180,320,500,720,980,1280,1630,2030,2480,2980,3600];
 for(let level=14;level<=50;level++)LEVEL_PRIZE_XP.push(LEVEL_PRIZE_XP.at(-1)+650+(level-14)*50);
 const LEVEL_PRIZES=new Map([[10,1000],...Array.from({length:38},(_,index)=>{
  const level=index+13,amount=({20:1500,30:2500,40:4000,50:6000})[level]||Math.min(500,150+(level-13)*10);return [level,amount];
 })].map(([level,amount])=>['level-prize:'+level,{xp:LEVEL_PRIZE_XP[level-1],amount}]));
 const FISH_ROWS=[
  ['silver-minnow','common',4,8],['cave-guppy','common',4,8],['bluegill','common',6,8],['yellow-perch','common',6,9],['brook-trout','common',8,10],['stone-loach','common',5,8],
  ['rainbow-trout','uncommon',12,12],['crystal-carp','uncommon',14,13],['copper-catfish','uncommon',14,13],['moon-bream','uncommon',12,12],['emerald-bass','uncommon',16,14],['ribbon-eel','uncommon',16,14],
  ['glass-cavefish','rare',24,18],['sapphire-pike','rare',28,20],['amethyst-koi','rare',28,20],['lantern-tench','rare',24,18],['spotted-sturgeon','rare',32,22],['velvet-char','rare',26,19],
  ['opal-angelfish','epic',40,24],['echo-salmon','epic',44,25],['golden-cave-carp','epic',48,26],['aurora-eel','epic',48,26],['midnight-catfish','epic',44,25],['ruby-lionfish','epic',40,24],
  ['crescendo-coelacanth','legendary',64,30],['starlight-sturgeon','legendary',72,32],['prism-koi','legendary',64,30],['thunderfin-pike','legendary',72,32],['royal-moonfish','legendary',80,35],['luminous-dragonfish','legendary',80,35]
 ];
 const FISH=Object.fromEntries(FISH_ROWS.map(([id,rarity,notes,xp])=>[id,{rarity,notes,xp}]));
 const enumOf=values=>({type:typeof values[0]==='number'?'integer':typeof values[0]==='boolean'?'boolean':'string',enum:values});
 const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
 const number=(minimum,maximum)=>({type:'number',minimum,maximum});
 const boolean={type:'boolean'},version=enumOf([1]),timestamp=integer(0,MAX_TIME);
 const string=(maxLength,pattern)=>({type:'string',minLength:1,maxLength,...(pattern?{pattern}:{})});
 const id=(length=512)=>string(length,'^[A-Za-z0-9:_-]+$');
 const array=(items,maxItems,uniqueItems=false)=>({type:'array',items,maxItems,...(uniqueItems?{uniqueItems:true}:{})});
 const object=(properties,required)=>({type:'object',properties,required:required||Object.keys(properties).filter(key=>properties[key].type!=='array'),additionalProperties:false});
 const statistics=object({...Object.fromEntries(STAT_NAMES.map(key=>[key,number(0,key==='rhythmBest'?100:10000000)])),seen:array(id(159),300,true)});
 const avatarSchema=object({version,...Object.fromEntries(COLORS.map(key=>[key,string(7,'^#[0-9a-f]{6}$')])),...Object.fromEntries(Object.entries(CATALOG).map(([key,values])=>[key,enumOf(values)])),customized:boolean,walked:number(0,1000000000),jumps:integer(0,10000000),emotesUsed:integer(0,10000000),visited:array(integer(0,3),4,true),gameStats:statistics});
 const missionSchema=object(Object.fromEntries(Object.entries(MISSION_TARGETS).map(([key,target])=>[key,object({acceptedAt:integer(1,MAX_TIME),progress:integer(0,target),completedAt:timestamp,rewardedAt:timestamp})])),[]);
 const resultSchema=object({id:id(92),fishId:enumOf(Object.keys(FISH)),rarity:enumOf(split('common uncommon rare epic legendary')),meter:enumOf(['4/4','6/8','2/2']),timeSignature:enumOf(['4/4','6/8','2/2']),hits:integer(1,1000000),misses:integer(0,1000000),extras:integer(0,1000000),perfect:boolean,notes:integer(1,1000),xp:integer(1,1000),caught:enumOf([true]),outcome:enumOf(['caught'])});
 const catchSchema=object({id:id(92),fishId:enumOf(Object.keys(FISH)),size:number(.1,10000),at:timestamp,meter:enumOf(['4/4','6/8','2/2']),perfect:boolean,caught:enumOf([true]),rewarded:boolean,result:resultSchema});
 const lessonSchema=object(Object.fromEntries(Object.entries(LESSON_TOTALS).map(([key,total])=>[key,object({step:integer(0,total),completed:boolean,completedAt:timestamp})])),LEGACY_LESSONS);
 const quizSchema=object(Object.fromEntries(Object.keys(LESSON_TOTALS).map(key=>[key,object({bankVersion:version,index:integer(0,5),answers:array(integer(0,2),5),bestAnswers:array(integer(0,2),5),completedAt:timestamp})])),LEGACY_LESSONS);
 const finalExamSchema=object({version,bankVersion:version,size:enumOf(EXAM_SIZES),questionIds:array(enumOf(EXAM_IDS),80,true),orders:array(integer(0,5),80),answers:array(integer(-1,2),80),index:integer(0,80),submitted:boolean,attempts:integer(0,100000),bestPercent:integer(0,100),bestScore:integer(0,80),bestTotal:enumOf([0,...EXAM_SIZES]),bestByCategory:object(Object.fromEntries(EXAM_CATEGORIES.map(key=>[key,object({correct:integer(0,10),total:integer(0,10)})]))),completedAt:timestamp});
 const SCHEMA=object({
  avatar:avatarSchema,
  progression:object({version,xp:integer(0,20000000),events:array(object({id:id(),xp:integer(1,1000)}),20000),bestPitchLevel:integer(0,1000)}),
  wallet:object({version,balance:integer(0,1000000),earned:integer(0,1000000),spent:integer(0,1000000),owned:array(enumOf(OWNED),256,true),rewards:array(id(100),4096,true)}),
  missions:object({version,missions:missionSchema,seen:array(id(140),512,true)},['version']),
  fishing:object({version,catches:array(catchSchema,5000)}),
  piano:object({version,learned:array(enumOf(MELODIES),9,true),completed:array(enumOf(PIANO_REWARDS),PIANO_REWARDS.length,true)}),
  lessons:object({version,lessons:lessonSchema}),quizzes:object({version,quizzes:quizSchema}),
  pitch:object({version,bestCompleted:integer(0,999)}),pitchTutorials:object({version,completed:array(enumOf(['treble','bass','grand']),3,true)}),finalExam:finalExamSchema
 },Object.keys(KEYS).filter(key=>key!=='finalExam'));
 function freeze(value){if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}return value;}
 freeze(SCHEMA);freeze(CATALOG);
 const own=(value,key)=>!!value&&Object.prototype.hasOwnProperty.call(value,key);
 const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const finite=(value,min,max,fallback=0)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:fallback;
 const int=(value,min,max,fallback=0)=>Number.isSafeInteger(value)?finite(value,min,max,fallback):fallback;
 const time=value=>int(value,0,MAX_TIME);
 const safeId=(value,max=512)=>typeof value==='string'&&value.length>0&&value.length<=max&&/^[A-Za-z0-9:_-]+$/.test(value);
 const clone=value=>JSON.parse(JSON.stringify(value));
 function fail(message){throw Error('Classroom progress is invalid: '+message);}
 function bounded(value,max,label){if(value===undefined||value===null)return [];if(!Array.isArray(value))fail(label+' must be a list.');if(value.length>max)fail(label+' exceeds its safe limit; no entries were discarded.');return value;}
 function ids(value,max,length=512,allowed=null,label='Saved IDs'){const result=[],seen=new Set();for(const item of bounded(value,max,label)){if(!safeId(item,length)||allowed&&!allowed.includes(item)||seen.has(item))continue;seen.add(item);result.push(item);}return result;}
 function blankExam(){return {version:1,bankVersion:1,size:40,questionIds:[],orders:[],answers:[],index:0,submitted:false,attempts:0,bestPercent:0,bestScore:0,bestTotal:0,bestByCategory:Object.fromEntries(EXAM_CATEGORIES.map(key=>[key,{correct:0,total:0}])),completedAt:0};}
 function blank(){return {avatar:{...DEFAULT_AVATAR,visited:[],gameStats:{...Object.fromEntries(STAT_NAMES.map(key=>[key,0])),seen:[]}},progression:{version:1,xp:0,events:[],bestPitchLevel:0},wallet:{version:1,balance:150,earned:150,spent:0,owned:[],rewards:[]},missions:{version:1,missions:{},seen:[]},fishing:{version:1,catches:[]},piano:{version:1,learned:[],completed:[]},lessons:{version:1,lessons:Object.fromEntries(Object.keys(LESSON_TOTALS).map(key=>[key,{step:0,completed:false,completedAt:0}]))},quizzes:{version:1,quizzes:Object.fromEntries(Object.keys(LESSON_TOTALS).map(key=>[key,{bankVersion:1,index:0,answers:[],bestAnswers:[],completedAt:0}]))},pitch:{version:1,bestCompleted:0},pitchTutorials:{version:1,completed:[]},finalExam:blankExam()};}
 function size(value){const json=JSON.stringify(value);if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(json).length;return unescape(encodeURIComponent(json)).length;}
 function checkedSize(value){if(size(value)>MAX_BYTES)fail('this save is larger than 8 MiB; nothing was changed.');return value;}
 function cleanAnswers(value){const output=[];for(const item of bounded(value,5,'Quiz answers')){if(!Number.isInteger(item)||item<0||item>2)break;output.push(item);}return output;}
 function cleanFinalExam(input){
  if(!record(input))fail('the final exam must be a progress object.');
  // Firebase omits empty lists; every scalar and category field stays required.
  const exam={...input};for(const key of ['questionIds','orders','answers'])if(!own(exam,key))exam[key]=[];
  const error=schemaError(finalExamSchema,exam,'data.finalExam');if(error)fail(error);
  if(exam.bestScore>exam.bestTotal||exam.bestPercent!==(exam.bestTotal?Math.round(exam.bestScore/exam.bestTotal*100):0))fail('the final exam best score and percentage must agree.');
  let correct=0,total=0;for(const category of EXAM_CATEGORIES){const result=exam.bestByCategory[category];if(result.correct>result.total||result.total!==(exam.bestTotal?exam.bestTotal/8:0))fail('the final exam category totals must match its balanced best result.');correct+=result.correct;total+=result.total;}
  if(correct!==exam.bestScore||total!==exam.bestTotal)fail('the final exam category scores must equal its saved best score.');
  if(exam.completedAt&&(!exam.bestTotal||exam.bestScore*100<exam.bestTotal*80))fail('a finished final exam requires a passing best result.');
  if(exam.orders.length!==exam.questionIds.length||exam.answers.length!==exam.questionIds.length)fail('the saved final exam questions, choices and answers must line up.');
  if(!exam.questionIds.length){if(exam.index!==0||exam.submitted)fail('an empty final exam cannot have an active question or submission.');}
  else{
   if(exam.questionIds.length!==exam.size||exam.index>exam.size)fail('the final exam needs a complete set of questions.');
   const counts=Object.fromEntries(EXAM_CATEGORIES.map(key=>[key,0]));for(const id of exam.questionIds)counts[id.slice(0,-4)]++;
   if(Object.values(counts).some(count=>count!==exam.size/8))fail('the final exam must include every category equally.');
   if(exam.submitted?(exam.index!==exam.size||exam.answers.some(answer=>answer<0)):exam.index===exam.size)fail('the final exam position and submission must match its answers.');
  }
  return clone(exam);
 }
 function cleanData(input){
  if(!record(input))fail('a progress object is required.');const out=blank(),raw=key=>record(input[key])?input[key]:{};
  for(const key of Object.keys(KEYS))if(record(input[key])&&own(input[key],'version')&&input[key].version!==1)fail(key+' uses an unsupported save version.');
  const avatar=raw('avatar');for(const key of COLORS)if(typeof avatar[key]==='string'&&/^#[0-9a-f]{6}$/i.test(avatar[key]))out.avatar[key]=avatar[key].toLowerCase();
  for(const [key,allowed]of Object.entries(CATALOG))if(allowed.includes(avatar[key]))out.avatar[key]=avatar[key];
  // Migrate intentional equipment from the old combined accessory slot.
  if(!own(avatar,'headwear')&&avatar.accessory==='cap')out.avatar.headwear='cap';if(!own(avatar,'eyewear')&&CATALOG.eyewear.includes(avatar.accessory))out.avatar.eyewear=avatar.accessory;
  out.avatar.customized=avatar.customized===true;out.avatar.walked=finite(avatar.walked,0,1e9);for(const key of ['jumps','emotesUsed'])out.avatar[key]=int(avatar[key],0,1e7);
  out.avatar.visited=[...new Set(bounded(avatar.visited,4,'Visited cabinets').filter(value=>Number.isInteger(value)&&value>=0&&value<=3))];
  for(const key of STAT_NAMES)out.avatar.gameStats[key]=finite(avatar.gameStats?.[key],0,key==='rhythmBest'?100:1e7);out.avatar.gameStats.seen=ids(avatar.gameStats?.seen,300,159,null,'Game result IDs');
  const progress=raw('progression'),seenEvents=new Set();for(const event of bounded(progress.events,20000,'Experience journal')){if(!record(event)||!safeId(event.id)||!int(event.xp,1,1000)||seenEvents.has(event.id))continue;seenEvents.add(event.id);out.progression.events.push({id:event.id,xp:event.xp});out.progression.xp+=event.xp;}out.progression.bestPitchLevel=int(progress.bestPitchLevel,0,1000);
  const wallet=raw('wallet');if(own(input,'wallet')){out.wallet.balance=int(wallet.balance,0,1e6);out.wallet.earned=int(wallet.earned,0,1e6);out.wallet.spent=int(wallet.spent,0,1e6);}out.wallet.owned=ids(wallet.owned,256,80,OWNED,'Owned cosmetics');out.wallet.rewards=ids(wallet.rewards,4096,100,null,'Notes reward journal');
  const missions=raw('missions');for(const [key,target]of Object.entries(MISSION_TARGETS)){const entry=missions.missions?.[key];if(!record(entry)||!time(entry.acceptedAt))continue;const progress=int(entry.progress,0,target),completedAt=progress>=target?time(entry.completedAt):0;out.missions.missions[key]={acceptedAt:time(entry.acceptedAt),progress,completedAt,rewardedAt:completedAt?time(entry.rewardedAt):0};}out.missions.seen=ids(missions.seen,512,140,null,'Mission result IDs');
  const fishSeen=new Set();for(const entry of bounded(raw('fishing').catches,5000,'Catch journal')){
   const result=entry?.result,fish=FISH[entry?.fishId];if(!record(entry)||!fish||!safeId(entry.id,92)||fishSeen.has(entry.id)||!record(result)||result.id!==entry.id||result.fishId!==entry.fishId||result.caught!==true||result.outcome!=='caught'||result.practice===true||result.reason!=null||result.rarity!==fish.rarity||!['4/4','6/8','2/2'].includes(result.meter)||result.timeSignature!==undefined&&result.timeSignature!==result.meter||!int(result.hits,1,1e6)||!Number.isSafeInteger(result.misses)||result.misses<0||result.misses>1e6||!Number.isSafeInteger(result.extras)||result.extras<0||result.extras>1e6||result.perfect!==(result.misses===0&&result.extras===0)||result.notes!==fish.notes||result.xp!==fish.xp||!finite(entry.size,.1,10000)||typeof entry.rewarded!=='boolean')continue;
   fishSeen.add(entry.id);out.fishing.catches.push({id:entry.id,fishId:entry.fishId,size:entry.size,at:time(entry.at),meter:result.meter,perfect:result.perfect,caught:true,rewarded:entry.rewarded,result:{id:entry.id,fishId:entry.fishId,rarity:fish.rarity,meter:result.meter,timeSignature:result.meter,hits:result.hits,misses:result.misses,extras:result.extras,perfect:result.perfect,notes:fish.notes,xp:fish.xp,caught:true,outcome:'caught'}});
  }
  const piano=raw('piano');out.piano.learned=ids(piano.learned,9,80,MELODIES,'Learned melodies');out.piano.completed=ids(piano.completed,PIANO_REWARDS.length,100,PIANO_REWARDS,'Piano challenge completions');
  for(const [key,total]of Object.entries(LESSON_TOTALS)){
   const lesson=raw('lessons').lessons?.[key],quiz=raw('quizzes').quizzes?.[key],target=out.lessons.lessons[key],question=out.quizzes.quizzes[key];
   if(record(lesson)){target.step=int(lesson.step,0,total);target.completed=lesson.completed===true&&target.step===total;target.completedAt=target.completed?time(lesson.completedAt):0;}
   if(record(quiz)&&quiz.bankVersion===1){question.answers=cleanAnswers(quiz.answers);question.bestAnswers=cleanAnswers(quiz.bestAnswers);if(question.bestAnswers.length!==5)question.bestAnswers=[];question.index=Math.min(question.answers.length,int(quiz.index,0,5,question.answers.length));question.completedAt=question.answers.length===5?time(quiz.completedAt):0;}
  }
  out.pitch.bestCompleted=int(raw('pitch').bestCompleted,0,999);out.pitchTutorials.completed=ids(raw('pitchTutorials').completed,3,20,['treble','bass','grand'],'Pitch tutorials');
  if(own(input,'finalExam'))out.finalExam=cleanFinalExam(input.finalExam);
  consistency(out);safeEquipment(out);return checkedSize(out);
 }
 function safeEquipment(data){
  // The shop deliberately preserves previously equipped items on startup.
  // Do not let a supplied avatar alone mint ownership during a profile swap.
  const available=new Set(['none','human','cap','beanie','glasses','sunglasses','bow','headphones','sneakers','boots','wave','dance',...data.wallet.owned]);
  const level=[0,80,180,320,500,720,980,1280,1630,2030,2480,2980].reduce((value,xp,index)=>data.progression.xp>=xp?index+1:value,1);
  for(const [id,required]of [['watchchain',2],['beret',3],['gold',4],['steampunk',5],['cape',6],['crown',7],['wings',8],['breakdance',9],['astronaut',10],['trophy',11],['halo',12],['magicorb',12]])if(level>=required)available.add(id);
  const earned=new Set(data.progression.events.map(event=>event.id));
  for(const [id,achievement]of [['rhythmfox','rhythm-hundred-streak'],['lakeotter','fishing-all-species'],['pianophoenix','piano-memory-master'],['triadchampion','triad-hard-advanced-win'],['bassclefpin','pitch-bass-reader'],['basslaurel','pitch-bass-streak'],['grandstaffbadge','pitch-grand-reader'],['grandstaffcrown','pitch-grand-perfect'],['shutter','dance-twenty-streak'],['rollerskates','dance-perfect-set'],['boombox','dance-hard-perfect'],...[[10,'pitchlaurel10'],[20,'pitchlaurel20'],[30,'pitchlaurel30'],[40,'pitchcrown40'],[50,'starlight']].map(([n,id])=>[id,'pitch-level-'+n])])if(earned.has('achievement:'+achievement))available.add(id);
  if(data.avatar.customized)available.add('bowtie');if(data.avatar.jumps>=10)available.add('starclip');if(data.avatar.emotesUsed>=5)available.add('partyglasses');if(data.avatar.walked>=450)available.add('halo');
  for(const key of ['headwear','eyewear','accessory','shoes','emote','form','pet'])if(!available.has(data.avatar[key]))data.avatar[key]=DEFAULT_AVATAR[key];
 }
 function consistency(data){
  const xp=new Set(data.progression.events.map(event=>event.id)),paid=new Set(data.wallet.rewards);
  if(data.finalExam.completedAt&&!data.progression.events.some(event=>event.id==='achievement:haydn-final-exam'&&event.xp===200))fail('a finished final exam is missing its saved 200 experience achievement. Retry saving its reward before syncing.');
  // Startup repairs these prefix families, including older/unknown IDs. Keep
  // the complete paid IDs, but never let importing one create a new XP award.
  let paidLevelNotes=0;
  for(const token of paid){
   let expected=null;if(token.startsWith('npc-mission:'))expected='quest:'+token.slice(12);else if(['piano-lesson:','piano-interval:','piano-scale:','piano-scale-memory:'].some(prefix=>token.startsWith(prefix))||PIANO_REWARDS.includes(token))expected='quest:'+token;if(expected&&!xp.has(expected))fail('a Notes reward is missing its saved experience record. Retry saving that reward before syncing.');
   if(token.startsWith('level-prize:')){const prize=LEVEL_PRIZES.get(token);if(!prize||data.progression.xp<prize.xp)fail('a level prize needs its earned player level.');paidLevelNotes+=prize.amount;}
  }
  if(data.wallet.earned<paidLevelNotes)fail('the saved level prizes exceed the complete earned Notes total.');
  if(MELODIES.every(id=>xp.has('quest:piano-memory:'+id))&&!xp.has('achievement:piano-memory-master'))fail('the completed memory-melody set is missing its saved mastery experience record. Retry saving that reward before syncing.');
  for(const token of data.piano.completed)if(!paid.has(token)||!xp.has('quest:'+token))fail('a piano completion is missing its reward records. Retry saving that challenge before syncing.');
  for(const [key,entry]of Object.entries(data.missions.missions))if(entry.rewardedAt&&(!paid.has('npc-mission:'+key)||!xp.has('quest:'+key)))fail('a mission reward is missing its saved reward records.');
  for(const entry of data.fishing.catches)if(entry.rewarded&&(!paid.has('fishing:'+entry.id)||!xp.has('fishing:'+entry.id)))fail('a rewarded catch is missing its saved Notes or experience record.');
  for(const [key,entry]of Object.entries(data.lessons.lessons))if(entry.completed){const quiz=data.quizzes.quizzes[key],passing=[quiz.answers,quiz.bestAnswers].some(answers=>answers.length===5&&answers.reduce((sum,answer,index)=>sum+(answer===QUIZ_CORRECT[key][index]?1:0),0)>=4);if(!passing||!xp.has('achievement:classroom-'+key))fail('a finished lesson is missing its passing quiz or saved experience record. Retry saving the lesson before syncing.');}
 }
 function result(action){try{return {ok:true,data:action()};}catch(error){return {ok:false,error:error?.message||'Classroom progress could not be read safely.'};}}
 function sanitize(raw){return result(()=>{if(raw?.localOnly===true||!record(raw)||!Object.keys(KEYS).some(key=>own(raw,key)))fail('a classroom DTO is required; local backups must never be uploaded.');return cleanData(raw);});}
 function schemaError(schema,value,path='data'){
  if(schema.enum)return schema.enum.includes(value)?'':path+' has an unknown value.';
  if(schema.type==='object'){
   if(!record(value))return path+' must be an object.';for(const key of Object.keys(value))if(!own(schema.properties,key))return path+'.'+key+' is not a permitted field.';
   for(const key of schema.required||[])if(!own(value,key))return path+'.'+key+' is required.';
   for(const key of Object.keys(value)){const error=schemaError(schema.properties[key],value[key],path+'.'+key);if(error)return error;}return '';
  }
  if(schema.type==='array'){
   if(!Array.isArray(value))return path+' must be a list.';if(value.length>schema.maxItems)return path+' is too long.';if(schema.uniqueItems&&new Set(value.map(item=>JSON.stringify(item))).size!==value.length)return path+' contains duplicate entries.';
   for(let index=0;index<value.length;index++){const error=schemaError(schema.items,value[index],path+'['+index+']');if(error)return error;}return '';
  }
  if(schema.type==='boolean')return typeof value==='boolean'?'':path+' must be true or false.';
  if(schema.type==='string')return typeof value==='string'&&value.length>=(schema.minLength||0)&&value.length<=(schema.maxLength??Infinity)&&(!schema.pattern||new RegExp(schema.pattern).test(value))?'':path+' is not a permitted text value.';
  if(schema.type==='number'||schema.type==='integer')return typeof value==='number'&&Number.isFinite(value)&&(schema.type!=='integer'||Number.isSafeInteger(value))&&value>=schema.minimum&&value<=schema.maximum?'':path+' is outside its permitted range.';
  return path+' has no schema.';
 }
 function validate(raw){return result(()=>{const error=schemaError(SCHEMA,raw);if(error)fail(error);const clean=cleanData(raw);if(raw.progression.xp!==clean.progression.xp)fail('experience must equal its saved event journal.');return clean;});}
 function storageReady(storage){if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')throw Error('This device cannot safely save classroom progress.');}
 function backup(storage){storageReady(storage);const values={};for(const key of SCOPED_KEYS){const value=storage.getItem(key);if(value!==null&&typeof value!=='string')throw Error('A local progress value could not be read safely.');values[key]=value;}return {localOnly:true,version:1,values};}
 function writeAtomically(storage,values){
  let previous;try{previous=backup(storage);}catch(error){return {ok:false,error:error.message,rolledBack:true};}
  const changed=[];try{for(const key of SCOPED_KEYS){changed.push(key);const value=values[key];if(value===null)storage.removeItem(key);else storage.setItem(key,value);}return {ok:true};}
  catch(error){let rolledBack=true;for(const key of changed.reverse())try{const value=previous.values[key];if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{rolledBack=false;}return {ok:false,error:rolledBack?'This device could not save the profile. Its previous progress has been restored.':'This device stopped saving during profile recovery. Keep the local backup and retry before playing.',rolledBack};}
 }
 function restore(storage,saved){
  if(!record(saved)||saved.localOnly!==true||saved.version!==1||!record(saved.values)||SCOPED_KEYS.some(key=>!own(saved.values,key)?!OPTIONAL_BACKUP_KEYS.has(key):saved.values[key]!==null&&typeof saved.values[key]!=='string')||Object.keys(saved.values).some(key=>!SCOPED_KEYS.includes(key)))return {ok:false,error:'That is not a valid local progress backup.',rolledBack:true};
  return writeAtomically(storage,Object.fromEntries(SCOPED_KEYS.map(key=>[key,saved.values[key]??null])));
 }
 function clear(storage){return writeAtomically(storage,Object.fromEntries(SCOPED_KEYS.map(key=>[key,null])));}
 function capture(storage){return result(()=>{
  storageReady(storage);const input={};for(const [slot,key]of Object.entries(KEYS)){const raw=storage.getItem(key);if(raw===null)continue;try{input[slot]=JSON.parse(raw);}catch{fail(slot+' could not be read. Its local data was left unchanged.');}
   const value=input[slot];if(!record(value))fail(slot+' is not a readable progress object.');
   if(!['avatar','piano'].includes(slot)&&value.version!==1)fail(slot+' uses an unsupported save version.');
   if(slot==='wallet'&&(!Number.isSafeInteger(value.balance)||value.balance<0||value.balance>1e6||!Array.isArray(value.owned)||!Array.isArray(value.rewards)||!Number.isSafeInteger(value.earned)||value.earned<0||value.earned>1e6||!Number.isSafeInteger(value.spent)||value.spent<0||value.spent>1e6))fail('the saved Notes wallet is damaged; it was left unchanged.');
   if(slot==='progression'&&(!Array.isArray(value.events)||!Number.isSafeInteger(value.xp)||value.xp<0||value.xp>2e7))fail('the saved experience journal is damaged; it was left unchanged.');
   if(slot==='missions'&&(!record(value.missions)||!Array.isArray(value.seen)))fail('the saved mission journal is damaged; it was left unchanged.');
   if(slot==='fishing'&&!Array.isArray(value.catches))fail('the saved catch journal is damaged; it was left unchanged.');
   if(slot==='piano'&&(!Array.isArray(value.learned)||!Array.isArray(value.completed)))fail('the saved piano progress is damaged; it was left unchanged.');
   if(slot==='lessons'&&!record(value.lessons)||slot==='quizzes'&&!record(value.quizzes))fail('the saved lesson progress is damaged; it was left unchanged.');
   if(slot==='pitch'&&(!Number.isSafeInteger(value.bestCompleted)||value.bestCompleted<0||value.bestCompleted>999)||slot==='pitchTutorials'&&!Array.isArray(value.completed))fail('the saved Pitch Race progress is damaged; it was left unchanged.');
  }
  const clean=cleanData(input);
  if(input.progression&&(input.progression.xp!==clean.progression.xp||input.progression.events.length!==clean.progression.events.length))fail('the experience total does not match its complete saved event journal.');
  if(input.fishing&&input.fishing.catches.length!==clean.fishing.catches.length)fail('a saved catch could not be read safely; the complete journal was left unchanged.');
  if(input.piano&&(input.piano.learned.length!==clean.piano.learned.length||input.piano.completed.length!==clean.piano.completed.length))fail('a saved piano challenge could not be read safely; it was left unchanged.');
  return clean;
 });}
 function apply(storage,raw){
  const checked=validate(raw);if(!checked.ok)return {ok:false,error:checked.error,rolledBack:true};const data=checked.data,values=Object.fromEntries(SCOPED_KEYS.map(key=>[key,null]));
  for(const [slot,key]of Object.entries(KEYS)){let value=data[slot];if(slot==='avatar'){value={...value};delete value.version;}if(slot==='progression')value={...value,events:value.events.map(event=>({...event,reason:'Arcade activity'}))};if(slot==='piano'){value={learned:value.learned,completed:value.completed};}values[key]=JSON.stringify(value);}
  return writeAtomically(storage,values);
 }
 return Object.freeze({KEYS,LOCAL_ONLY_KEYS,SCOPED_KEYS,SCHEMA,MAX_BYTES,CATALOG,blank,sanitize,validate,capture,apply,backup,restore,clear});
});
