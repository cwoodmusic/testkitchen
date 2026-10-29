/* Short classroom checks. The lesson controller owns completion and XP. */
(function(root,factory){
 const notation=typeof module==='object'&&module.exports?require('./music-notation.js'):root?.CodaMusicNotation;
 const pools=typeof module==='object'&&module.exports?require('./classroom-quiz-pool.js'):root?.CodaClassroomQuizPool;
 const api=factory(notation,pools);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomQuiz=api;
})(typeof window==='undefined'?null:window,function(notation,poolModule){
 'use strict';
 const KEY='codaClassroomQuizzesV1',CUSTOM_KEY='codaAuthoredQuizzesV1',VERSION=1,PASS_SCORE=4;
 const ATTEMPT_KEY='codaClassroomQuizAttemptsV1';
 const quiz=(title,questions)=>Object.freeze({version:VERSION,title,passScore:PASS_SCORE,questions:Object.freeze(questions.map(item=>Object.freeze({...item,answers:Object.freeze(item.answers),visual:item.visual?Object.freeze(item.visual):null,answerNotes:item.answerNotes?Object.freeze(item.answerNotes.map(notes=>Object.freeze(notes))):null})))});
 const QUIZZES=Object.freeze({
  'note-naming':quiz('Note names',[
   {id:'find-c',prompt:'What is the gold key called?',answers:['C','F','A'],correct:0,explanation:'C is left of two black keys.',visual:{kind:'piano',target:0}},
   {id:'find-f',prompt:'What is the gold key called?',answers:['G','F','C'],correct:1,explanation:'F is left of three black keys.',visual:{kind:'piano',target:3}},
   {id:'after-g',prompt:'Which letter comes after G?',answers:['F','H','A'],correct:2,explanation:'After G, start again at A.'},
   {id:'bottom-line',prompt:'Name this note.',answers:['E','G','F'],correct:0,explanation:'The bottom treble line is E.',visual:{kind:'staff',position:0}},
   {id:'second-space',prompt:'Name this space note.',answers:['B','A','C'],correct:1,explanation:'Treble spaces spell FACE from bottom to top. The second space is A.',visual:{kind:'staff',position:3}}
  ]),
  'rhythm-tree':quiz('Note lengths',[
   {id:'half-length',prompt:'How many beats for this half note?',answers:['1 beat','2 beats','4 beats'],correct:1,explanation:'A half note lasts two beats: ONE, TWO.',visual:{kind:'note',beats:2}},
   {id:'split-quarter',prompt:'How many eighth notes share one beat?',answers:['2 eighth notes','4 eighth notes','1 eighth note'],correct:0,explanation:'Two eighth notes share one beat.',visual:{kind:'note',beats:1}},
   {id:'whole-length',prompt:'How many beats for this whole note?',answers:['2 beats','1 beat','4 beats'],correct:2,explanation:'A whole note lasts four beats.',visual:{kind:'note',beats:4}},
   {id:'split-sixteenths',prompt:'How many sixteenths share one beat?',answers:['2 sixteenth notes','4 sixteenth notes','8 sixteenth notes'],correct:1,explanation:'Four sixteenth notes share one beat.',visual:{kind:'note',beats:1}},
   {id:'four-beat-bar',prompt:'Which group fills four beats?',answers:['1 quarter + 2 eighths + 1 half','1 half + 1 quarter','1 quarter + 1 eighth'],answerNotes:[[1,.5,.5,2],[2,1],[1,.5]],correct:0,explanation:'One beat, one beat, two beats: four altogether.'}
  ]),
  'time-signatures':quiz('Time signatures',[
   {id:'four-four',prompt:'How many beats fit in 4/4?',answers:['2 beats','6 beats','4 beats'],correct:2,explanation:'Count four beats. Then start again at ONE.',visual:{kind:'meter',meter:'4/4'}},
   {id:'six-eight-pulse',prompt:'How many BIG beats in 6/8?',answers:['6 big beats','2 big beats','3 big beats'],correct:1,explanation:'Feel TWO big beats: ONE-la-li, TWO-la-li.',visual:{kind:'meter',meter:'6/8'}},
   {id:'cut-time-unit',prompt:'Which note gets one BIG beat here?',answers:['Half note','Quarter note','Eighth note'],correct:0,explanation:'In cut time, a half note gets one big beat.',visual:{kind:'meter',meter:'2/2'}},
   {id:'six-eight-count',prompt:'Which count sounds like 6/8?',answers:['ONE, two, three, four','ONE-and, TWO-and','ONE-la-li, TWO-la-li'],correct:2,explanation:'Say ONE-la-li, TWO-la-li.',visual:{kind:'meter',meter:'6/8'}},
   {id:'cut-time-bar',prompt:'Which notes fill this cut-time bar?',answers:['2 quarter notes','2 half notes','6 eighth notes'],answerNotes:[[1,1],[2,2],[.5,.5,.5,.5,.5,.5]],correct:1,explanation:'Two half notes fill this bar.',visual:{kind:'meter',meter:'2/2'}}
  ]),
  'bass-clef':quiz('Bass clef',[
   {id:'bass-bottom',prompt:'Name this bass note.',answers:['G','E','A'],correct:0,explanation:'The bottom bass line is G.',visual:{kind:'staff',clef:'bass',position:0}},
   {id:'bass-middle',prompt:'Name this middle-line note.',answers:['B','D','F'],correct:1,explanation:'Bass lines go G B D F A. The middle is D.',visual:{kind:'staff',clef:'bass',position:4}},
   {id:'bass-dots',prompt:'Which note is between the two dots?',answers:['A','C','F'],correct:2,explanation:'The two dots point to the F line.',visual:{kind:'staff',clef:'bass',position:6}},
   {id:'bass-space',prompt:'Name this bass space note.',answers:['C','A','E'],correct:0,explanation:'Bass spaces go A C E G. The second is C.',visual:{kind:'staff',clef:'bass',position:3}},
   {id:'bass-top-space',prompt:'Name this top-space note.',answers:['E','G','F'],correct:1,explanation:'Bass spaces go A C E G. The top is G.',visual:{kind:'staff',clef:'bass',position:7}}
  ]),
  'major-minor-keys':quiz('Major & minor keys',[
   {id:'key-home',prompt:'What is a key’s home note?',answers:['Where the music feels settled','Always the loudest note','Always the fastest note'],correct:0,explanation:'The home note is where the music feels settled.'},
   {id:'d-major-home',prompt:'What is D major’s home note?',answers:['A','D','C'],correct:1,explanation:'The first part of the key name tells its home: D.'},
   {id:'c-minor-colour',prompt:'Which note changes C E G into C minor?',answers:['F instead of G','D instead of C','E-flat instead of E'],correct:2,explanation:'C E-flat G is the C minor sound. C is still home.'},
   {id:'major-minor-moods',prompt:'Can major and minor music have many moods?',answers:['Yes, both can','No, minor is always sad','No, major is always happy'],correct:0,explanation:'Major often sounds bright. Minor can sound mellow or dramatic. Neither has only one mood.'},
   {id:'shared-notes',prompt:'C major and A minor share notes. What changes?',answers:['Their note letters disappear','Their home notes','They must be played louder'],correct:1,explanation:'C major comes home to C. A minor comes home to A.'}
  ]),
  'dynamics':quiz('Dynamics: loud & soft',[
   {id:'dynamics-meaning',prompt:'What do dynamics tell you?',answers:['How loud or soft','How fast the beat goes','Which note letter to play'],correct:0,explanation:'Dynamics changes loudness. Tempo changes speed.'},
   {id:'piano-soft',prompt:'The music says p (piano). How do you play?',answers:['Very fast','Softly','Loudly'],correct:1,explanation:'Piano means soft. Its sign is p.'},
   {id:'dynamic-middle',prompt:'Which sign means moderately loud?',answers:['pp','mp','mf'],correct:2,explanation:'Mezzo forte, mf, means moderately loud. Mezzo means moderately.'},
   {id:'crescendo-grow',prompt:'What happens during a crescendo?',answers:['Grow louder little by little','Grow slower little by little','Suddenly stop'],correct:0,explanation:'Crescendo means gradually louder. Keep the same tempo unless told to change it.'},
   {id:'diminuendo-shrink',prompt:'What happens during a diminuendo?',answers:['Grow faster','Grow softer little by little','Change the note letters'],correct:1,explanation:'Diminuendo, also called decrescendo, means gradually softer.'}
  ]),
  'tempo':quiz('Tempo: fast & slow',[
   {id:'tempo-meaning',prompt:'What does tempo tell you?',answers:['How loud to play','How fast the beat goes','Which instrument to use'],correct:1,explanation:'Tempo is beat speed. It can change while loudness stays the same.'},
   {id:'bpm-meaning',prompt:'What does BPM mean?',answers:['Beats per minute','Bars per melody','Big piano music'],correct:0,explanation:'BPM counts how many beats happen in one minute.'},
   {id:'presto-speed',prompt:'Which word suggests very fast music?',answers:['Adagio','Largo','Presto'],correct:2,explanation:'Presto means very fast. Tempo words describe a feel; exact speeds can vary.'},
   {id:'accelerando-speed',prompt:'What happens during accelerando?',answers:['Get louder','Get faster little by little','Get softer'],correct:1,explanation:'Accelerando speeds up the beat. It does not mean louder.'},
   {id:'ritardando-speed',prompt:'What happens during ritardando?',answers:['Get slower little by little','Get louder little by little','Play a higher note'],correct:0,explanation:'Ritardando slows down the beat. Loudness can stay the same.'}
  ]),
  'grand-staff':quiz('Grand staff & Middle C',[
   {id:'grand-treble',prompt:'Name this note on the upper staff.',answers:['E','G','C'],correct:0,explanation:'The upper staff is treble. Its bottom line is E.',visual:{kind:'staff',clef:'treble',grand:true,position:0}},
   {id:'grand-bass',prompt:'Name this note on the lower staff.',answers:['B','D','F'],correct:1,explanation:'The lower staff is bass. Its middle line is D.',visual:{kind:'staff',clef:'bass',grand:true,position:4}},
   {id:'middle-c-treble',prompt:'Name this note on the little line.',answers:['A','E','C'],correct:2,explanation:'Middle C sits on this little line.',visual:{kind:'staff',clef:'treble',grand:true,position:-2}},
   {id:'middle-c-bass',prompt:'Name this note on the little line.',answers:['C','G','B'],correct:0,explanation:'This little line shows Middle C too.',visual:{kind:'staff',clef:'bass',grand:true,position:10}},
   {id:'middle-c-same',prompt:'Do these notes play the same key?',answers:['A quiet rest','Two different keys','The same key'],correct:2,explanation:'Both pictures play the same piano key.',visual:{kind:'middle-c-pair'}}
  ])
 });
 const xml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
 function staffSVG(position,options={}){
  const clef=options.clef==='bass'?'bass':'treble';
  function single(at,name){
   let svg=notation.staffSVG(at,{label:options.label||(name==='bass'?'Bass':'Treble')+' staff. Read the purple notehead’s line or space.'});
   if(name==='bass')svg=svg.replace('class="coda-music-glyph staff-clef" x="36" y="105"','class="coda-music-glyph staff-clef" x="36" y="65"').replace(notation.glyph('gClef'),notation.glyph('fClef'));
   return svg.replace('class="lesson-staff coda-notated-staff"','class="lesson-staff coda-notated-staff" data-staff-clef="'+name+'"');
  }
  if(!options.grand)return single(position,clef);
  function inner(name){
   let svg=single(name===clef?position:0,name);svg=svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>')).replace(/<rect[^>]*\/>/,'');
   if(name!==clef)svg=svg.replace(/<text class="coda-music-glyph staff-note"[^>]*>[\s\S]*?<\/text>/,'').replace(/<path[^>]*class="staff-ledger"[^>]*\/>/g,'');
   return '<g data-staff-clef="'+name+'"'+(name==='bass'?' transform="translate(0 120)"':'')+'>'+svg+'</g>';
  }
  return '<svg class="lesson-staff coda-notated-staff lesson-grand-staff" viewBox="0 0 340 290" role="img" aria-label="'+xml(options.label||'Grand staff: treble above bass. Read the purple notehead.')+'"><rect x="1" y="1" width="338" height="288" rx="12" fill="#f9f2df"/><path d="M17 45C4 45 16 115 7 133C3 141 3 149 7 157C16 175 4 245 17 245M22 45V245M320 45V245" fill="none" stroke="#5f526d" stroke-width="2"/>'+inner('treble')+inner('bass')+'</svg>';
 }
 const copy=value=>JSON.parse(JSON.stringify(value));
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const scoreFor=(id,answers)=>!QUIZZES[id]||!Array.isArray(answers)?0:QUIZZES[id].questions.reduce((score,item,index)=>score+(answers[index]===item.correct?1:0),0);
 function cleanAnswers(id,answers){
  const questions=QUIZZES[id].questions,result=[];if(!Array.isArray(answers))return result;
  for(let index=0;index<Math.min(answers.length,questions.length);index++){
   const answer=answers[index];if(!Number.isInteger(answer)||answer<0||answer>=questions[index].answers.length)break;result.push(answer);
  }return result;
 }
 const blank=()=>({bankVersion:VERSION,index:0,answers:[],bestAnswers:[],completedAt:0});
 function normalize(raw){
  const result={version:VERSION,quizzes:{}};
  for(const id of Object.keys(QUIZZES)){
   const saved=raw?.version===VERSION?raw.quizzes?.[id]:null,record=blank();
   if(saved?.bankVersion===QUIZZES[id].version){
    record.answers=cleanAnswers(id,saved.answers);
    record.index=Math.max(0,Math.min(record.answers.length,Number.isInteger(saved.index)?saved.index:record.answers.length));
    const best=cleanAnswers(id,saved.bestAnswers);
    if(best.length===QUIZZES[id].questions.length)record.bestAnswers=best;
    if(record.answers.length===QUIZZES[id].questions.length&&scoreFor(id,record.answers)>=scoreFor(id,record.bestAnswers))record.bestAnswers=[...record.answers];
    if(record.answers.length===QUIZZES[id].questions.length&&Number.isFinite(saved.completedAt)&&saved.completedAt>0)record.completedAt=saved.completedAt;
   }
   result.quizzes[id]=record;
  }return result;
 }
 function resolveStorage(storage,win){if(storage!==undefined)return storage;try{return win?.localStorage??(typeof localStorage==='undefined'?null:localStorage);}catch{return null;}}
 function readJournal(storage){let raw=null;try{raw=JSON.parse(storage?.getItem(KEY)||'null');}catch{}return normalize(raw);}
 function authoredModel(api={}){return api.model||(typeof window!=='undefined'?window.CodaEducationContent?.getQuiz?.(api.lessonId):null)||QUIZZES[api.lessonId];}
 function contentGuard(api){
  const content=api.content||(typeof window!=='undefined'?window.CodaEducationContent:null),revision=content?.getLessonRevision?.(api.lessonId);let changed=false;
  return ()=>{try{if(changed)return false;if(revision&&content.getLessonRevision(api.lessonId)!==revision){changed=true;return false;}return api.canRecord?.()!==false;}catch{return false;}};
 }
 function createAuthoredSession(api,model){
  const lessonId=api.lessonId,storage=resolveStorage(api.storage),revision=api.contentRevision||model.revision||'edited-lesson';
  let record=blank(),expected=null,saved=!!storage,error='';
  const clean=answers=>{const values=[];if(!Array.isArray(answers))return values;for(let index=0;index<Math.min(answers.length,model.questions.length);index++){const answer=answers[index];if(!Number.isInteger(answer)||answer<0||answer>=model.questions[index].answers.length)break;values.push(answer);}return values;};
  const score=answers=>model.questions.reduce((total,question,index)=>total+(answers[index]===question.correct?1:0),0);
  const load=()=>{let value=null;try{value=JSON.parse(storage?.getItem(CUSTOM_KEY)||'null');}catch{}return value?.version===1&&value.quizzes&&typeof value.quizzes==='object'&&!Array.isArray(value.quizzes)?value:{version:1,quizzes:{}};};
  const entry=load().quizzes[lessonId];expected=JSON.stringify(entry??null);
  if(entry?.revision===revision&&entry.record?.bankVersion===1){const value=entry.record;record.answers=clean(value.answers);record.bestAnswers=clean(value.bestAnswers);if(record.bestAnswers.length!==model.questions.length)record.bestAnswers=[];record.index=Math.max(0,Math.min(record.answers.length,Number.isInteger(value.index)?value.index:record.answers.length));if(record.answers.length===model.questions.length&&score(record.answers)>=score(record.bestAnswers))record.bestAnswers=[...record.answers];if(Number.isSafeInteger(value.completedAt)&&value.completedAt>0&&record.answers.length===model.questions.length)record.completedAt=value.completedAt;}
  function canRecord(){try{return api.canRecord?.()!==false;}catch{return false;}}
  function getState(){const total=model.questions.length,finished=total>0&&record.answers.length===total,passScore=Math.ceil(total*.8);return {lessonId,index:record.index,total,passScore,answers:[...record.answers],score:score(record.answers),finished,phase:record.index>=total?'result':'question',passed:finished&&score(record.answers)>=passScore,saved,error,bestScore:score(record.bestAnswers),bankVersion:model.version,custom:true,contentRevision:revision};}
  function save(){
   if(!canRecord()){saved=false;error='Your profile or classroom content changed. Reopen the lesson before continuing.';return false;}
   try{if(!storage?.getItem||!storage?.setItem)throw Error('storage');const journal=load();if(JSON.stringify(journal.quizzes[lessonId]??null)!==expected)throw Error('changed');const next={revision,record:copy(record)};journal.quizzes[lessonId]=next;storage.setItem(CUSTOM_KEY,JSON.stringify(journal));expected=JSON.stringify(next);saved=true;error='';return true;}
   catch(failure){saved=false;error=failure.message==='changed'?'Your player or edited quiz changed. Reopen the lesson before continuing.':'Your quiz result could not be saved. Keep it open and try saving again.';return false;}
  }
  function answer(index){if(!canRecord()||record.index>=model.questions.length||record.answers.length>record.index||!Number.isInteger(index)||index<0||index>=model.questions[record.index].answers.length)return false;record.answers.push(index);if(record.answers.length===model.questions.length){record.completedAt=Date.now();if(score(record.answers)>=score(record.bestAnswers))record.bestAnswers=[...record.answers];}save();return true;}
  function next(){if(!canRecord()||record.index>=model.questions.length||record.answers.length<=record.index)return false;record.index++;save();return true;}
  function restart(){if(!canRecord())return getState();record.index=0;record.answers=[];record.completedAt=0;save();return getState();}
  return {getState,answer,next,restart,save};
 }
 function createLegacySession(api={}){
  const lessonId=api.lessonId,model=authoredModel(api),supplemental=lessonId==='accidentals-key-signatures'&&model?.custom===true;if((!QUIZZES[lessonId]&&!supplemental)||!model)throw Error('Choose a known classroom quiz.');
  const canRecord=contentGuard(api);
  if(model.custom===true||api.custom===true)return createAuthoredSession({...api,canRecord},model);
  const storage=resolveStorage(api.storage),record=copy(readJournal(storage).quizzes[lessonId]);let saved=!!storage,error='';
  function getState(){const total=model.questions.length,finished=record.answers.length===total,score=scoreFor(lessonId,record.answers);return{lessonId,index:record.index,total,passScore:model.passScore,answers:[...record.answers],score,finished,phase:record.index>=total?'result':'question',passed:finished&&score>=model.passScore,saved,error,bestScore:scoreFor(lessonId,record.bestAnswers),bankVersion:model.version};}
  function save(){
   if(!canRecord()){saved=false;error='Your profile or classroom content changed. Reopen the lesson before continuing.';return false;}
   try{if(!storage||typeof storage.setItem!=='function')throw Error('storage');const journal=readJournal(storage);journal.quizzes[lessonId]=copy(record);storage.setItem(KEY,JSON.stringify(journal));saved=true;error='';return true;}
   catch{saved=false;error='Your quiz result could not be saved. You can keep going, then try saving again.';return false;}
  }
  function answer(index){
   if(!canRecord()||record.index>=model.questions.length||record.answers.length>record.index||!Number.isInteger(index)||index<0||index>=model.questions[record.index].answers.length)return false;
   record.answers.push(index);
   if(record.answers.length===model.questions.length){record.completedAt=Date.now();if(scoreFor(lessonId,record.answers)>=scoreFor(lessonId,record.bestAnswers))record.bestAnswers=[...record.answers];}
   save();return true;
  }
  function next(){if(!canRecord()||record.index>=model.questions.length||record.answers.length<=record.index)return false;record.index++;save();return true;}
  function restart(){if(!canRecord())return getState();record.index=0;record.answers=[];record.completedAt=0;save();return getState();}
  return{getState,answer,next,restart,save};
 }
 function createSession(api={}){
  const model=authoredModel(api);
  if(api.randomize===false||!model?.questions?.length)return createLegacySession(api);
  const legacy=createLegacySession(api),lessonId=api.lessonId,custom=model.custom===true||api.custom===true;
  const storage=resolveStorage(api.storage),attemptStorage=resolveStorage(api.attemptStorage===undefined?storage:api.attemptStorage);
  const canRecord=contentGuard(api),total=model.questions.length,passScore=Math.ceil(total*.8),officialKey=custom?CUSTOM_KEY:KEY;
  const revision=api.contentRevision||model.revision||'built-in-v1';
  const pools=poolModule?.poolsFor(lessonId,model)||model.questions.map(question=>[copy(question)]);
  const hash=value=>{let n=2166136261;for(const char of value)n=Math.imul(n^char.charCodeAt(0),16777619);return(n>>>0).toString(16);};
  const poolRevision=hash(JSON.stringify([revision,pools])),attemptId=lessonId+':'+poolRevision;
  let random=api.random||Math.random;
  if(api.seed!==undefined){let seed=2166136261;for(const char of String(api.seed))seed=Math.imul(seed^char.charCodeAt(0),16777619);random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
  const roll=()=>{const n=random();return Number.isFinite(n)?Math.max(0,Math.min(.999999999,n)):0;};
  const shuffled=values=>{const result=values.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;};
  let attempt,expectedAttempt='null',expectedOfficial='null',saved=true,error='',bestScore=legacy.getState().bestScore;
  function officialJournal(){const raw=storage?.getItem?.(officialKey);if(raw===null||raw===undefined)return{version:1,quizzes:{}};const value=JSON.parse(raw);if(!object(value)||value.version!==1||!object(value.quizzes))throw Error('Your saved quiz could not reopen.');return value;}
  function localJournal(){const raw=attemptStorage?.getItem?.(ATTEMPT_KEY);if(raw===null||raw===undefined)return{version:1,attempts:{}};const value=JSON.parse(raw);if(!object(value)||value.version!==1||!object(value.attempts))throw Error('Your saved quiz attempt could not reopen.');return value;}
  const permutation=(values,length)=>Array.isArray(values)&&values.length===length&&new Set(values).size===length&&values.every(value=>Number.isInteger(value)&&value>=0&&value<length);
  function validAttempt(value){
   if(!object(value)||value.revision!==poolRevision||!permutation(value.order,total)||!Array.isArray(value.ids)||value.ids.length!==total||!Array.isArray(value.choices)||value.choices.length!==total||!Array.isArray(value.answers)||value.answers.length!==total||!Number.isInteger(value.index)||value.index<0||value.index>total)return false;
   for(let slot=0;slot<total;slot++){
    const question=pools[slot].find(item=>item.id===value.ids[slot]);if(!question||!permutation(value.choices[slot],question.answers.length))return false;
    const answer=value.answers[slot];if(answer!==null&&(!Number.isInteger(answer)||answer<0||answer>=question.answers.length))return false;
   }
   for(let i=0;i<total;i++){const answered=value.answers[value.order[i]]!==null;if(i<value.index&&!answered||i>value.index&&answered)return false;}
   return Number.isSafeInteger(value.completedAt)&&value.completedAt>=0;
  }
  function fresh(){return{revision:poolRevision,index:0,order:shuffled(Array.from({length:total},(_,i)=>i)),ids:pools.map(pool=>pool[Math.floor(roll()*pool.length)].id),choices:pools.map(pool=>shuffled(Array.from({length:pool[0].answers.length},(_,i)=>i))),answers:Array(total).fill(null),completedAt:0};}
  function question(){if(attempt.index>=total)return null;const slot=attempt.order[attempt.index];return copy(pools[slot].find(item=>item.id===attempt.ids[slot]));}
  function score(){return attempt.answers.reduce((sum,answer,slot)=>sum+(answer!==null&&answer===pools[slot][0].correct?1:0),0);}
  function getState(){
   const finished=attempt.answers.every(answer=>answer!==null),slot=attempt.order[attempt.index],answers=[];
   for(const index of attempt.order){if(attempt.answers[index]===null)break;answers.push(attempt.answers[index]);}
   return{lessonId,index:attempt.index,total,passScore,answers,score:score(),finished,phase:attempt.index>=total?'result':'question',passed:finished&&score()>=passScore,saved,error,bestScore,bankVersion:model.version,...(custom?{custom:true,contentRevision:revision}:{}),randomized:true,slotIndex:slot??null,question:question(),questionIds:attempt.order.map(index=>attempt.ids[index]),questionOrder:[...attempt.order],answerOrder:slot===undefined?[]:[...attempt.choices[slot]]};
  }
  try{
   expectedOfficial=JSON.stringify(officialJournal().quizzes[lessonId]??null);
   const entry=localJournal().attempts[attemptId];expectedAttempt=JSON.stringify(entry??null);
   if(validAttempt(entry))attempt=copy(entry);
   else{
    attempt=fresh();const old=legacy.getState();
    // Historical records have no question IDs. Their original questions are
    // known, so reopen that exact legacy assessment instead of inventing text.
    if(old.answers.length){attempt.order=Array.from({length:total},(_,i)=>i);attempt.ids=model.questions.map(item=>item.id);attempt.choices=model.questions.map(item=>item.answers.map((_,i)=>i));attempt.answers=model.questions.map((_,i)=>old.answers[i]??null);attempt.index=old.index;attempt.completedAt=old.finished?Math.max(1,Date.now()):0;}
   }
  }catch(failure){attempt=fresh();saved=false;error=failure.message||'Your quiz could not reopen.';}
  function save(){
   if(!canRecord()){saved=false;error='Your profile or classroom content changed. Reopen the lesson before continuing.';return false;}
   try{
    if(!attemptStorage?.setItem||!storage?.getItem)throw Error('This device cannot save the quiz.');
    const local=localJournal();if(JSON.stringify(local.attempts[attemptId]??null)!==expectedAttempt)throw Error('Your saved attempt changed. Reopen the lesson.');
    const official=officialJournal();if(JSON.stringify(official.quizzes[lessonId]??null)!==expectedOfficial)throw Error('Your saved quiz changed. Reopen the lesson.');
    local.attempts[attemptId]=copy(attempt);const proof=JSON.stringify(local.attempts[attemptId]);attemptStorage.setItem(ATTEMPT_KEY,JSON.stringify(local));expectedAttempt=proof;
    if(attempt.answers.every(answer=>answer!==null)){
     if(!canRecord()||JSON.stringify(localJournal().attempts[attemptId]??null)!==expectedAttempt||JSON.stringify(officialJournal().quizzes[lessonId]??null)!==expectedOfficial)throw Error('Your player changed before the quiz saved.');
     const previous=custom?official.quizzes[lessonId]?.record:official.quizzes[lessonId],previousBest=Array.isArray(previous?.bestAnswers)?previous.bestAnswers:[];
     const grade=answers=>model.questions.reduce((sum,item,i)=>sum+(answers[i]===item.correct?1:0),0);
     const best=previousBest.length===total&&grade(previousBest)>score()?previousBest:attempt.answers;
     const record={bankVersion:model.version,index:total,answers:[...attempt.answers],bestAnswers:[...best],completedAt:attempt.completedAt};
     official.quizzes[lessonId]=custom?{...official.quizzes[lessonId],revision,record}:record;
     storage.setItem(officialKey,JSON.stringify(official));expectedOfficial=JSON.stringify(official.quizzes[lessonId]);bestScore=grade(best);
    }
    saved=true;error='';return true;
   }catch(failure){saved=false;error=failure.message||'Your quiz result could not save. Keep it open and try again.';return false;}
  }
  function answer(index){
   const item=question(),slot=attempt.order[attempt.index];if(!canRecord()||!item||attempt.answers[slot]!==null||!Number.isInteger(index)||index<0||index>=item.answers.length)return false;
   attempt.answers[slot]=index;if(attempt.answers.every(value=>value!==null))attempt.completedAt=Math.max(1,Date.now());save();return true;
  }
  function next(){const slot=attempt.order[attempt.index];if(!canRecord()||attempt.index>=total||attempt.answers[slot]===null)return false;attempt.index++;save();return true;}
  function restart(){
   if(!canRecord())return getState();const previous=JSON.stringify([attempt.order,attempt.ids,attempt.choices]),previousIds=[...attempt.ids];
   attempt=fresh();
   if(attempt.ids.every((id,index)=>id===previousIds[index])){
    const slot=pools.findIndex(items=>items.length>1);
    if(slot>=0){const index=pools[slot].findIndex(item=>item.id===attempt.ids[slot]);attempt.ids[slot]=pools[slot][(index+1)%pools[slot].length].id;}
   }
   if(JSON.stringify([attempt.order,attempt.ids,attempt.choices])===previous&&total>1)attempt.order.reverse();save();return getState();
  }
  if(saved)save();
  return{getState,question,answer,next,restart,save};
 }
 function create(api={}){
  const host=api.host;if(!host)throw Error('A classroom quiz needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView,lessonId=api.lessonId,model=api.model||win?.CodaEducationContent?.getQuiz?.(lessonId)||QUIZZES[lessonId];if(!model)throw Error('Choose a known classroom quiz.');
  const session=createSession({...api,model,lessonId,storage:resolveStorage(api.storage,win)});let target=host,destroyed=false,reported=false;
  const element=(tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,fn,attr)=>{const node=element('button','',text);node.type='button';if(attr)node.setAttribute(attr,'');node.onclick=fn;return node;};
  function focusQuestion(){const heading=target.querySelector('.classroom-quiz-question,.classroom-quiz-result-title');heading?.focus({preventScroll:true});target.querySelector('.classroom-quiz')?.scrollIntoView({block:'start',behavior:'auto'});}
  function visual(parent,value){
   if(!value||!notation)return;
   const figure=element('div','classroom-quiz-visual');
   const shared=api.renderVisual||(['keyboard','clef-intro','note-parts','rhythm-tree'].includes(value.kind)?win?.CodaClassroomLearningPaths?.renderVisual:null);
   if(typeof shared==='function'&&shared(figure,value)===true){parent.append(figure);notation.load?.(doc);return;}
   if(value.kind==='keyboard'&&win?.CodaClassroomKeyboard){const checked=win.CodaClassroomKeyboard.validateVisual(value);if(checked.ok)figure.innerHTML=win.CodaClassroomKeyboard.toSVG(checked.data);}
   else if(value.kind==='clef-intro'&&win?.CodaClassroomTutorials?.clefReminderSVG&&['treble','bass'].includes(value.clef)&&['clef','staff','lines','spaces'].includes(value.page))figure.innerHTML=win.CodaClassroomTutorials.clefReminderSVG(value.clef,value.page);
   else if(value.kind==='notation'&&win?.CodaEducationNotation){const checked=win.CodaEducationNotation.validate(value.score);if(checked.ok)figure.innerHTML=win.CodaEducationNotation.toSVG(checked.data);}
   else if(value.kind==='middle-c-pair'){figure.classList.add('classroom-quiz-middle-pair');figure.innerHTML=staffSVG(-2,{clef:'treble',label:'Middle C below treble'})+staffSVG(10,{clef:'bass',label:'Middle C above bass'});}
   else if(value.kind==='staff')figure.innerHTML=staffSVG(value.position,value);
   else if(value.kind==='note'){figure.setAttribute('role','img');figure.setAttribute('aria-label','The note shown in the question');figure.innerHTML=notation.glyphSVG(value.beats,{colour:'#fff0cf'});}
   else if(value.kind==='piano'){
    let keys='';for(let index=0;index<8;index++)keys+='<rect x="'+(index*50+1)+'" y="15" width="48" height="88" rx="3" fill="'+(index===value.target?'#f5d98d':'#faf6e8')+'" stroke="#59445d"/>';
    for(const at of [1,2,4,5,6])keys+='<rect x="'+(at*50-14)+'" y="15" width="28" height="50" rx="2" fill="#29233b"/>';
    figure.innerHTML='<svg viewBox="0 0 400 110" role="img" aria-label="Piano keyboard. The key in the question is gold.">'+keys+'</svg>';
   }else if(value.kind==='meter'){
    const canvas=element('canvas');canvas.width=120;canvas.height=110;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',value.meter==='2/2'?'Cut time sign':value.meter+' time signature');
    const draw=()=>{if(destroyed)return;const g=canvas.getContext('2d');g.clearRect(0,0,120,110);notation.drawTimeSignature(g,{x:60,y:58,meter:value.meter,fontSize:76,color:'#fff0cf'});};figure.append(canvas);draw();notation.load?.(doc)?.then?.(draw);
   }parent.append(figure);notation.load?.(doc);
  }
  function saveHelp(parent,state){if(state.saved)return;const box=element('div','classroom-quiz-save-help');box.setAttribute('role','status');box.append(element('p','',state.error||'Your quiz progress is not saved yet.'));box.append(button('Try saving quiz again',()=>{session.save();render();},'data-quiz-save'));parent.append(box);}
  function finish(){
   const state=session.getState();if(reported||!state.passed||state.phase!=='result')return;
   if(!session.save()){render();return;}
   reported=true;api.onPassed?.({...session.getState(),passed:true});
  }
  function renderResult(parent,state){
   const title=element('h3','classroom-quiz-result-title',state.passed?'You did it!':'Let’s try again.');title.tabIndex=-1;
   const stars=element('p','classroom-quiz-score',state.total<=12?'★'.repeat(state.score)+'☆'.repeat(state.total-state.score):state.score+' / '+state.total);stars.setAttribute('aria-label',state.score+' of '+state.total+' correct');parent.append(title,stars);
   parent.append(element('p','classroom-quiz-result-copy',state.passed?'Your lesson is ready to finish.':state.custom?(state.total?'Get '+state.passScore+' of '+state.total+' answers right to finish.':'This quiz has no questions yet. Ask your teacher to add some.'):'Four right answers finish the lesson.'));
   saveHelp(parent,state);
   if(state.passed)parent.append(button('Finish lesson',finish,'data-quiz-finish'));
   parent.append(button('Try again',()=>{session.restart();reported=false;render();focusQuestion();},'data-quiz-retry'));
  }
  function render(nextTarget){
   if(destroyed)return;if(nextTarget)target=nextTarget;const state=session.getState();target.replaceChildren();
   const panel=element('section','classroom-quiz');panel.dataset.quizLesson=lessonId;panel.setAttribute('aria-label',model.title+' end-of-lesson quiz');target.append(panel);
   const topline=element('div','classroom-quiz-topline');topline.append(element('span','','Little quiz'),element('span','',state.phase==='result'?'Finished':(state.index+1)+' / '+state.total));panel.append(topline);
   const progress=element('progress');progress.max=state.total;progress.value=state.answers.length;progress.setAttribute('aria-label','Quiz questions answered');panel.append(progress);
   if(state.phase==='result'){renderResult(panel,state);return;}
   const question=state.question||model.questions[state.index],answered=state.answers.length>state.index;
   const correct=answered&&state.answers[state.index]===question.correct;
   const heading=element('h3','classroom-quiz-question',answered?(correct?'Yes!':'Let’s learn this one.'):question.prompt);heading.tabIndex=-1;panel.append(heading);visual(panel,question.visual);for(const item of question.visuals||[])visual(panel,item);
   if(!answered){
    const answers=element('div','classroom-quiz-answers');answers.setAttribute('role','group');answers.setAttribute('aria-label','Choose one answer');
    (state.answerOrder||question.answers.map((_,i)=>i)).forEach(index=>{const text=question.answers[index],choose=button(text,()=>{if(!session.answer(index))return;render();target.querySelector('[data-quiz-next]')?.focus({preventScroll:true});});choose.dataset.quizAnswer=index;if(question.answerNotes?.[index]){choose.setAttribute('aria-label',text);choose.textContent='';const group=element('span','classroom-quiz-choice-notes');group.setAttribute('aria-hidden','true');group.innerHTML=question.answerNotes[index].map(beats=>notation.glyphSVG(beats)).join('');choose.append(group);}answers.append(choose);});panel.append(answers);saveHelp(panel,state);return;
   }
   const feedback=element('p','classroom-quiz-feedback',correct?question.explanation:question.answers[question.correct]+'. '+question.explanation);feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.dataset.correct=String(correct);panel.append(feedback);saveHelp(panel,state);
   panel.append(button(state.index===state.total-1?'See my stars':'Next',()=>{if(!session.next())return;render();focusQuestion();},'data-quiz-next'));

  }
  return{render,restart(){reported=false;return session.restart();},getState:session.getState,destroy(){destroyed=true;}};
 }
 return{KEY,CUSTOM_KEY,ATTEMPT_KEY,VERSION,PASS_SCORE,QUIZZES,scoreFor,normalize,staffSVG,createSession,create};
});
