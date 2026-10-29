/* Authored musician missions. Live cabinet gameplay completes a mission;
 * its musician gives the reward when the player returns to them. */
(function(root,factory){
  const library=factory();
  if(typeof module==='object'&&module.exports)module.exports=library;
  if(root)root.CodaMusicianMissions=library;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const KEY='codaMusicianMissionsV1';
  const GAMES=Object.freeze({pitch:'Pitch Race',triad:'Music Triad',rhythm:'Rhythm Room',fishing:'Rhythm Fishing',piano:'Piano Lab'});
  const DEFINITIONS=Object.freeze([
    {id:'bach-triad-win',person:'bach',title:'Counterpoint Champion',game:'triad',goal:'Win a Music Triad match against the computer.',kind:'triad-win',target:1,reward:90},
    {id:'mozart-triad-capture',person:'mozart',title:'A Clever Turn',game:'triad',goal:'Capture at least 3 opposing cards in one completed Music Triad computer match.',kind:'triad-captures',target:3,reward:80},
    {id:'beethoven-pitch-win',person:'beethoven',title:'Race with Resolve',game:'pitch',goal:'Win a Classic Pitch Race against the computer with at least one correct note.',kind:'pitch-win',target:1,reward:100},
    {id:'clara-pitch-streak',person:'clara',title:'A Clear Musical Line',game:'pitch',goal:'Identify 20 notes in a row in Pitch Race, then finish the run. Classic, Endless, and Level Challenge count.',kind:'pitch-streak',target:20,reward:100},
    {id:'joplin-rhythm-streak',person:'joplin',title:'Ragtime Steady',game:'rhythm',goal:'Match 20 notes in a row in Rhythm Room Tap Practice. Missed notes and extra taps reset the streak; keep the loop running between rounds.',kind:'rhythm-streak',target:20,reward:90},
    {id:'ellington-rhythm-streak',person:'ellington',title:'In the Pocket',game:'rhythm',goal:'Match 50 notes in a row in Rhythm Room Tap Practice. Missed notes and extra taps reset the streak; keep the loop running between rounds.',kind:'rhythm-streak',target:50,reward:160},
    {id:'ella-rhythm-perfect',person:'ella',title:'Every Entrance Counts',game:'rhythm',goal:'Finish a Rhythm Room tap round with at least 8 notes, matching every note with no missed notes or extra taps.',kind:'rhythm-perfect',target:1,reward:100},
    {id:'nina-pitch-notes',person:'nina',title:'Make Every Note Speak',game:'pitch',goal:'Correctly identify at least 15 notes in one completed Pitch Race run. Classic, Endless, and Level Challenge count.',kind:'pitch-correct',target:15,reward:80},
    {id:'miles-triad-comeback',person:'miles',title:'Find Another Way',game:'triad',goal:'Win a Music Triad computer match after trailing your opponent during the match.',kind:'triad-comeback',target:1,reward:140}
    ,{id:'ella-fish-five',person:'ella',title:'A Little Fishing Chorus',game:'fishing',goal:'Catch five fish after accepting this mission. Practice catches do not count.',kind:'fish-catches',target:5,reward:150,minLevel:3},
    {id:'nina-piano-melody',person:'nina',title:'Your First Encore',game:'piano',goal:'Finish a guided melody in the Piano Lab after accepting this mission.',kind:'piano-guided',target:1,reward:150,minLevel:3},
    {id:'mozart-pitch-thirty',person:'mozart',title:'Thirty Bright Notes',game:'pitch',goal:'Identify 30 notes correctly in one completed Pitch Race run.',kind:'pitch-correct',target:30,reward:160,minLevel:3},
    {id:'joplin-rhythm-perfect-three',person:'joplin',title:'Three Steady Rounds',game:'rhythm',goal:'Finish three perfect Tap Practice rounds with at least eight notes each.',kind:'rhythm-perfect-count',target:3,reward:180,minLevel:3},
    {id:'clara-fish-compound',person:'clara',title:'Six-Eight Sailor',game:'fishing',goal:'Catch a fish while fishing in 6/8 time.',kind:'fish-compound',target:1,reward:220,minLevel:5},
    {id:'bach-piano-major',person:'bach',title:'A Sunny Scale',game:'piano',goal:'Finish any major scale challenge in the Piano Lab.',kind:'piano-major',target:1,reward:220,minLevel:5},
    {id:'ellington-triad-three',person:'ellington',title:'Three Winning Sets',game:'triad',goal:'Win three completed Music Triad matches against the computer.',kind:'triad-wins',target:3,reward:240,minLevel:5},
    {id:'miles-pitch-bass-ten',person:'miles',title:'Down in the Bass',game:'pitch',goal:'Read at least 10 bass-clef notes correctly in one completed Pitch Race run.',kind:'pitch-bass',target:10,reward:240,minLevel:5},
    {id:'beethoven-fish-epic',person:'beethoven',title:'An Epic Catch',game:'fishing',goal:'Catch an epic or legendary fish.',kind:'fish-epic',target:1,reward:340,minLevel:10},
    {id:'nina-piano-minor',person:'nina',title:'A Different Colour',game:'piano',goal:'Finish any minor scale challenge in the Piano Lab.',kind:'piano-minor',target:1,reward:300,minLevel:10},
    {id:'mozart-triad-advanced',person:'mozart',title:'Think Ahead',game:'triad',goal:'Win a Music Triad computer match using Advanced rules.',kind:'triad-advanced',target:1,reward:350,minLevel:10},
    {id:'ella-rhythm-seventy-five',person:'ella',title:'Keep the Music Going',game:'rhythm',goal:'Match 75 notes in a row in Tap Practice. Missed notes and extra taps reset the streak.',kind:'rhythm-streak',target:75,reward:360,minLevel:10},
    {id:'joplin-fish-perfect-rare',person:'joplin',title:'A Perfect Treasure',game:'fishing',goal:'Catch a rare, epic or legendary fish without missing a note or adding an extra tap.',kind:'fish-perfect-rare',target:1,reward:500,minLevel:15},
    {id:'clara-piano-memory',person:'clara',title:'A Melody to Remember',game:'piano',goal:'Finish a melody from memory without playing a wrong note.',kind:'piano-memory',target:1,reward:400,minLevel:15},
    {id:'bach-pitch-grand-twenty',person:'bach',title:'Both Hands of the Staff',game:'pitch',goal:'In one grand-staff Pitch Race run, read at least 10 treble and 10 bass notes correctly.',kind:'pitch-grand',target:20,reward:450,minLevel:15},
    {id:'ellington-triad-hard',person:'ellington',title:'Play with the Experts',game:'triad',goal:'Win a Music Triad computer match on Hard difficulty.',kind:'triad-hard',target:1,reward:450,minLevel:15},
    {id:'miles-fish-legendary',person:'miles',title:'Legend of the Deep',game:'fishing',goal:'Catch a legendary fish, then return to Miles Davis for your reward.',kind:'fish-legendary',target:1,reward:850,minLevel:20},
    {id:'beethoven-pitch-level-thirty',person:'beethoven',title:'Climb to Thirty',game:'pitch',goal:'Pass Level 30 or higher in Pitch Race Level Challenge.',kind:'pitch-level',target:30,reward:650,minLevel:20},
    {id:'joplin-rhythm-hundred',person:'joplin',title:'One Hundred in the Pocket',game:'rhythm',goal:'Match 100 notes in a row in Tap Practice. Keep the loop running; misses and extra taps reset the streak.',kind:'rhythm-streak',target:100,reward:700,minLevel:20},
    {id:'bach-triad-hard-advanced',person:'bach',title:'The Counterpoint Master',game:'triad',goal:'Win a Hard Music Triad computer match using Advanced rules.',kind:'triad-hard-advanced',target:1,reward:800,minLevel:20}
  ].map(item=>Object.freeze({minLevel:1,...item})));
  const byId=new Map(DEFINITIONS.map(item=>[item.id,item]));
  const byPerson=new Map();for(const item of DEFINITIONS){if(!byPerson.has(item.person))byPerson.set(item.person,[]);byPerson.get(item.person).push(item);}
  const PERSON_NAMES=Object.freeze({bach:'Bach',mozart:'Mozart',beethoven:'Beethoven',clara:'Clara Schumann',joplin:'Scott Joplin',ellington:'Duke Ellington',ella:'Ella Fitzgerald',nina:'Nina Simone',miles:'Miles Davis'});
  const integer=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
  function validResult(game,result){
    if(!result||typeof result!=='object'||Array.isArray(result))return false;
    if(game==='triad')return ['computer','multiplayer','advanced'].includes(result.mode)&&integer(result.captures,1000)&&integer(result.score,16)&&typeof result.won==='boolean'&&typeof result.comeback==='boolean';
    if(game==='pitch')return ['classic','endless','levels','level','multi'].includes(result.mode)&&integer(result.score)&&integer(result.correct)&&integer(result.misses)&&integer(result.streak)&&result.streak<=result.correct&&typeof result.won==='boolean'&&typeof result.perfect==='boolean';
    return game==='rhythm'&&result.mode==='tap'&&integer(result.total,128)&&result.total>0&&integer(result.hits,128)&&result.hits<=result.total&&integer(result.extra,1000)&&integer(result.early,128)&&integer(result.late,128)&&result.early+result.late<=result.hits;
  }
  function resultProgress(mission,result){
    switch(mission.kind){
      case 'triad-wins':
      case 'triad-win':return ['computer','advanced'].includes(result.mode)&&result.won?1:0;
      case 'triad-advanced':return ['computer','advanced'].includes(result.mode)&&result.won&&(result.mode==='advanced'||result.rules==='advanced')?1:0;
      case 'triad-hard':return ['computer','advanced'].includes(result.mode)&&result.won&&result.difficulty==='hard'?1:0;
      case 'triad-hard-advanced':return ['computer','advanced'].includes(result.mode)&&result.won&&result.difficulty==='hard'&&(result.mode==='advanced'||result.rules==='advanced')?1:0;
      case 'triad-captures':return ['computer','advanced'].includes(result.mode)?result.captures:0;
      case 'triad-comeback':return ['computer','advanced'].includes(result.mode)&&result.won&&result.comeback?1:0;
      case 'pitch-win':return result.mode==='classic'&&result.won&&result.correct>0?1:0;
      case 'pitch-streak':return result.mode!=='multi'?result.streak:0;
      case 'pitch-correct':return result.mode!=='multi'?result.correct:0;
      case 'pitch-bass':return result.mode!=='multi'&&validClefs(result)?result.clefStats.bass.correct:0;
      case 'pitch-grand':return result.mode!=='multi'&&result.staff==='grand'&&validClefs(result)&&result.clefStats.treble.correct>=10&&result.clefStats.bass.correct>=10?result.clefStats.treble.correct+result.clefStats.bass.correct:0;
      case 'pitch-level':return ['level','levels'].includes(result.mode)&&integer(result.completedLevel,1000)?result.completedLevel:0;
      case 'rhythm-perfect-count':
      case 'rhythm-perfect':return result.total>=8&&result.hits===result.total&&result.extra===0?1:0;
      default:return 0;
    }
  }
  function validClefs(result){
    if(!['treble','bass','grand'].includes(result.staff)||!result.clefStats||typeof result.clefStats!=='object')return false;
    const values=['treble','bass'].map(clef=>result.clefStats[clef]);
    if(result.staff!=='grand'){const other=result.clefStats[result.staff==='treble'?'bass':'treble'];if(other&&(other.correct||other.misses||other.bestStreak))return false;}
    return values.every(value=>value&&integer(value.correct)&&integer(value.misses)&&integer(value.bestStreak)&&value.bestStreak<=value.correct)&&values.reduce((sum,value)=>sum+value.correct,0)===result.correct&&values.reduce((sum,value)=>sum+value.misses,0)===result.misses;
  }
  const additive=new Set(['triad-wins','rhythm-perfect-count','fish-catches']);
  function validActivity(game,event){
    if(!event||typeof event!=='object'||Array.isArray(event)||event.practice===true)return false;
    const id=game==='fishing'?event.id:event.runId;
    if(typeof id!=='string'||!/^[a-z0-9:_-]{1,128}$/i.test(id))return false;
    if(game==='piano')return ['melody','scale','interval'].includes(event.kind)&&['guided','memory'].includes(event.mode)&&integer(event.mistakes,10000)&&(event.kind!=='scale'||['major','minor'].includes(event.scaleType));
    return game==='fishing'&&typeof event.fishId==='string'&&/^[a-z0-9-]{1,80}$/i.test(event.fishId)&&['common','uncommon','rare','epic','legendary'].includes(event.rarity)&&['4/4','6/8','2/2'].includes(event.meter)&&event.caught===true&&event.outcome==='caught'&&(event.reason===undefined||event.reason===null)&&integer(event.hits)&&event.hits>0&&integer(event.misses)&&integer(event.extras)&&typeof event.perfect==='boolean'&&event.perfect===(event.misses===0&&event.extras===0);
  }
  function activityProgress(mission,event){
    switch(mission.kind){
      case 'fish-catches':return 1;
      case 'fish-compound':return event.meter==='6/8'?1:0;
      case 'fish-epic':return ['epic','legendary'].includes(event.rarity)?1:0;
      case 'fish-perfect-rare':return event.perfect&&['rare','epic','legendary'].includes(event.rarity)?1:0;
      case 'fish-legendary':return event.rarity==='legendary'?1:0;
      case 'piano-guided':return event.kind==='melody'&&event.mode==='guided'?1:0;
      case 'piano-major':return event.kind==='scale'&&event.scaleType==='major'?1:0;
      case 'piano-minor':return event.kind==='scale'&&event.scaleType==='minor'?1:0;
      case 'piano-memory':return event.kind==='melody'&&event.mode==='memory'&&event.mistakes===0?1:0;
      default:return 0;
    }
  }
  // Rhythm Room exposes its actual grading function. Track ordered targets,
  // including missed notes before a hit and unfinished tails at round end.
  // Saved practice-history totals cannot establish a consecutive-note streak.
  function createStreakTracker(onChange=()=>{}){
    let current=null,next=0,streak=0,best=0,finished=false;
    function emit(){best=Math.max(best,streak);onChange({streak,best});}
    function reset(){streak=0;emit();}
    function finish(){
      if(!current||finished)return;
      finished=true;
      if(next<current.targets.length)reset();
    }
    function begin(round){
      if(round===current)return;
      finish();current=round;next=0;finished=false;
      if(!round||!Array.isArray(round.targets)||round.targets.length>128||!round.targets.every(Number.isFinite)){current=null;reset();}
    }
    function tap(round,result){
      begin(round);if(!current||result?.warmup)return;
      const last=round.taps?.[round.taps.length-1];
      if(!result?.hit||!integer(last?.target,127)||last.target>=round.targets.length){reset();return;}
      if(last.target!==next)reset();
      next=last.target+1;streak++;emit();
    }
    function stop(){current=null;next=0;finished=false;reset();}
    return {begin,tap,finish,stop,snapshot:()=>({streak,best})};
  }
  function gameKey(game){
    if(typeof game==='string'&&GAMES[game])return game;
    const label=typeof game==='string'?game:game?.name;
    return Object.keys(GAMES).find(key=>GAMES[key]===label)||null;
  }
  function create(api={}){
    const host=api.window||(typeof window!=='undefined'?window:null),doc=api.document||host?.document;
    let storage=api.storage;if(storage===undefined)try{storage=host?.localStorage;}catch{}
    const now=()=>Math.max(1,Math.floor(api.now?.()||Date.now()));
    const empty=()=>({version:1,missions:{},seen:[]});
    let state=empty(),persistent=true,lastError='',session=null,displayed=null,disposed=false,activitySerial=0;
    const activities=new Map();
    const level=()=>{try{const value=api.getLevel?.();return integer(value,1000)&&value>0?value:1;}catch{return 1;}};
    const unlocked=mission=>level()>=mission.minLevel;
    function clean(raw){
      if(!raw||raw.version!==1||!raw.missions||typeof raw.missions!=='object'||Array.isArray(raw.missions)||!Array.isArray(raw.seen))return empty();
      const output=empty();
      for(const mission of DEFINITIONS){
        const value=raw.missions[mission.id];
        if(!value||!integer(value.acceptedAt,Number.MAX_SAFE_INTEGER)||!value.acceptedAt)continue;
        const progress=integer(value.progress)?Math.min(value.progress,mission.target):0;
        const completedAt=progress>=mission.target&&integer(value.completedAt,Number.MAX_SAFE_INTEGER)?value.completedAt:0;
        output.missions[mission.id]={acceptedAt:value.acceptedAt,progress,completedAt,rewardedAt:completedAt&&integer(value.rewardedAt,Number.MAX_SAFE_INTEGER)?value.rewardedAt:0};
      }
      output.seen=raw.seen.filter(id=>typeof id==='string'&&id.length<=140).slice(-512);return output;
    }
    try{const raw=storage?.getItem(KEY);if(raw)state=clean(JSON.parse(raw));}catch{persistent=false;lastError='Browser saving is unavailable. Mission progress cannot be saved yet.';}
    const clone=value=>JSON.parse(JSON.stringify(value));
    function canRecord(){try{return typeof api.canRecord==='function'?api.canRecord()===true:true;}catch{return false;}}
    function persist(){
      try{if(!storage?.setItem)throw Error('storage');storage.setItem(KEY,JSON.stringify(state));persistent=true;lastError='';return true;}
      catch{persistent=false;lastError='Browser saving is unavailable. Keep this page open and retry saving your mission reward.';return false;}
    }
    function missionFor(person){
      const id=typeof person==='string'?person:person?.id;if(byId.has(id))return byId.get(id);
      const missions=byPerson.get(id)||[];
      for(const status of ['complete','active','available','rewarded','locked']){const found=missions.find(mission=>entry(mission).status===status);if(found)return found;}return null;
    }
    function listFor(person){const id=typeof person==='string'?person:person?.id;return (byPerson.get(byId.get(id)?.person||id)||[]).map(entry);}
    function entry(mission){
      const value=state.missions[mission.id];
      return {...mission,unlocked:unlocked(mission),status:!value?(unlocked(mission)?'available':'locked'):value.rewardedAt?'rewarded':value.completedAt?'complete':'active',progress:value?.progress||0,
        acceptedAt:value?.acceptedAt||0,completedAt:value?.completedAt||0,rewardedAt:value?.rewardedAt||0};
    }
    function snapshot(){return {persistent,error:lastError,missions:DEFINITIONS.map(entry),connection:session?{game:session.game,connected:session.connected,streak:session.tracker?.snapshot().streak??session.fallbackStreak}:null};}
    function changed(){render();try{api.onChange?.(snapshot());}catch{/* Feedback cannot interrupt gameplay. */}}
    function canTurnIn(mission){
      if(!canRecord()||!unlocked(mission))return false;
      try{return api.canTurnIn?.(mission.person,entry(mission))===true;}catch{return false;}
    }
    function turnIn(person){
      if(!canRecord())return {ok:false,error:'Open your classroom profile before collecting rewards.'};
      const mission=missionFor(person),value=mission&&state.missions[mission.id];
      if(!mission||!value)return {ok:false,error:'Accept this musician\'s mission first.'};
      if(value.rewardedAt)return {ok:true,alreadyRewarded:true};
      if(!unlocked(mission))return {ok:false,error:'Reach Level '+mission.minLevel+' before collecting this mission.'};
      if(!value.completedAt)return {ok:false,error:'Finish this mission before collecting its reward.'};
      if(!canTurnIn(mission))return {ok:false,error:'Return to '+PERSON_NAMES[mission.person]+' to collect your reward.'};
      // Save the completed mission before touching the wallet. Its stable reward
      // ID also protects a retry if the wallet saves but the final mission save fails.
      if(!persist()){changed();return {ok:false,error:lastError};}
      const rewardId='npc-mission:'+mission.id;
      let result;try{result=api.wallet?.grantReward(rewardId,mission.reward);}catch{result={ok:false};}
      if(!result?.ok){
        lastError=result?.error||'Your mission is complete. Your Notes could not be saved. Talk to '+PERSON_NAMES[mission.person]+' to try again.';
        changed();return {ok:false,error:lastError};
      }
      value.rewardedAt=now();
      if(!persist()){value.rewardedAt=0;changed();return {ok:false,error:lastError};}
      try{api.onMissionRewarded?.({...mission,rewardId});}catch{/* Progress feedback cannot undo an awarded mission. */}
      changed();return {ok:true,alreadyRewarded:false,rewardId};
    }
    function accept(person){
      if(!canRecord())return {ok:false,error:'Open your classroom profile before accepting missions.'};
      const mission=missionFor(person);if(!mission)return {ok:false,error:'This musician has no mission yet.'};
      if(!unlocked(mission))return {ok:false,error:'This mission unlocks at Level '+mission.minLevel+'.'};
      if(state.missions[mission.id])return {ok:true,alreadyAccepted:true};
      state.missions[mission.id]={acceptedAt:now(),progress:0,completedAt:0,rewardedAt:0};
      const saved=persist();changed();return {ok:saved,error:saved?'':lastError};
    }
    function advance(mission,amount,eligible=session?.eligible){
      if(!canRecord())return;
      const value=state.missions[mission.id];
      if(!value||value.completedAt||!unlocked(mission)||!eligible?.has(mission.id))return;
      const progress=Math.min(mission.target,additive.has(mission.kind)?value.progress+amount:Math.max(value.progress,amount));
      if(progress===value.progress)return;
      value.progress=progress;const completed=progress>=mission.target;if(completed)value.completedAt=now();
      persist();
      if(completed)try{api.onMissionCompleted?.(entry(mission));}catch{/* Completion feedback cannot interrupt gameplay. */}
      changed();
    }
    function rhythmProgress(best){if(!canRecord())return;try{api.onVerifiedRhythmStreak?.(best);}catch{}for(const mission of DEFINITIONS)if(mission.kind==='rhythm-streak')advance(mission,best);}
    function recordResult(game,runId,result){
      if(!canRecord())return false;
      if(!session||session.game!==game||typeof runId!=='string'||!runId.length||runId.length>128||!validResult(game,result))return false;
      const key=game+':'+runId;if(state.seen.includes(key))return false;
      state.seen.push(key);state.seen=state.seen.slice(-512);persist();
      try{api.onVerifiedResult?.(game,runId,clone(result));}catch{/* Other progress systems cannot interrupt game verification. */}
      for(const mission of DEFINITIONS)if(mission.game===game)advance(mission,resultProgress(mission,result));
      // Cross-origin fallback is deliberately conservative: only whole rounds
      // without any missed note or extra tap can extend a verified streak.
      if(game==='rhythm'&&!session.rhythmHook){session.fallbackStreak=result.hits===result.total&&result.extra===0?session.fallbackStreak+result.hits:0;rhythmProgress(session.fallbackStreak);}
      changed();return true;
    }
    function initBridge(){
      if(!session)return;
      try{session.frame.contentWindow.postMessage({coda:1,type:'init',game:session.game,token:session.token},session.origin);}catch{/* Frame navigation may be in progress. */}
    }
    function onMessage(event){
      const value=event.data;
      if(!session||event.source!==session.frame.contentWindow||event.origin!==session.origin||!value||value.coda!==1||value.game!==session.game)return;
      if(value.type==='ready'){initBridge();return;}
      if(value.type==='result'&&value.token===session.token&&canRecord()){session.connected=true;recordResult(session.game,value.runId,value.result);}
    }
    function wrap(object,key,after){
      const original=object?.[key];if(typeof original!=='function')return false;
      const owner=session;
      const wrapped=function(...args){const result=original.apply(this,args);if(session===owner&&canRecord())after(args,result);return result;};
      try{object[key]=wrapped;if(object[key]!==wrapped)return false;}catch{return false;}
      owner.cleanup.push(()=>{try{if(object[key]===wrapped)object[key]=original;}catch{}});return true;
    }
    function connectFrame(){
      if(!session)return;
      initBridge();
      try{
        const win=session.frame.contentWindow,document=win.document;
        if(document.documentElement?.dataset?.codaGame!==session.game)return;
        if(wrap(win.CodaBridge,'report',(args)=>recordResult(session.game,args[0],args[1])))session.connected=true;
        if(session.game==='rhythm'){
          const tracker=createStreakTracker(({best})=>rhythmProgress(best));session.tracker=tracker;
          const a=wrap(win,'createTapRound',(_,round)=>tracker.begin(round));
          const b=wrap(win,'gradeTap',([round],result)=>tracker.tap(round,result));
          const d=wrap(win,'finishTapRound',()=>tracker.finish());
          session.rhythmHook=a&&b&&d;
          if(session.rhythmHook){
            session.connected=true;
            const reset=event=>{
              if(!canRecord())return;
              const target=event.target?.closest?.('button,input,select');if(!target)return;
              if(event.type==='change'||['stop','home-button','generate','none','all'].includes(target.id)||target.id==='play'&&target.textContent.includes('Stop'))tracker.stop();
            };
            document.addEventListener('click',reset,true);document.addEventListener('change',reset,true);
            session.cleanup.push(()=>{document.removeEventListener('click',reset,true);document.removeEventListener('change',reset,true);});
          }
        }
      }catch{/* Deployed same-origin cabinets offer live hooks; the bridge handles other approved hosts. */}
      changed();
    }
    function detachGame(){
      if(!session)return;const previous=session;session=null;
      previous.frame.removeEventListener?.('load',previous.loaded);
      for(const cleanup of previous.cleanup)try{cleanup();}catch{}
      changed();
    }
    function attachGame(game,frame=api.frame){
      detachGame();const key=gameKey(game);if(!key||!frame)return false;
      let url;try{url=new URL(game?.url||game?.file||frame.src,host?.location?.href||'https://cwoodmusic.github.io/coda-arcade/');}catch{return false;}
      const token=host?.crypto?.randomUUID?.()||'mission-'+now().toString(36)+'-'+Math.random().toString(36).slice(2);
      const eligible=new Set(DEFINITIONS.filter(mission=>mission.game===key&&unlocked(mission)&&state.missions[mission.id]&&!state.missions[mission.id].completedAt).map(mission=>mission.id));
      session={game:key,frame,origin:url.origin,token,eligible,connected:false,cleanup:[],rhythmHook:false,fallbackStreak:0,loaded:null};
      session.loaded=()=>{
        if(!session||session.frame!==frame)return;
        for(const cleanup of session.cleanup.splice(0))try{cleanup();}catch{}
        session.tracker=null;session.rhythmHook=false;session.fallbackStreak=0;
        connectFrame();
      };
      frame.addEventListener?.('load',session.loaded);connectFrame();return true;
    }
    function beginActivity(game){
      if(!canRecord()||!['fishing','piano'].includes(game)||disposed)return null;
      const token='activity-'+(++activitySerial)+'-'+now().toString(36);
      activities.set(game,{token,eligible:new Set(DEFINITIONS.filter(mission=>mission.game===game&&unlocked(mission)&&state.missions[mission.id]&&!state.missions[mission.id].completedAt).map(mission=>mission.id))});return token;
    }
    function recordActivity(game,event,token){
      const activity=activities.get(game);if(!canRecord()||disposed||!activity||activity.token!==token||!validActivity(game,event))return false;
      try{if(typeof api.validateActivity==='function'&&api.validateActivity(game,event)!==true)return false;}catch{return false;}
      const key=game+':'+(game==='fishing'?event.id:event.runId);if(state.seen.includes(key))return false;
      activities.delete(game);state.seen.push(key);state.seen=state.seen.slice(-512);persist();
      for(const mission of DEFINITIONS)if(mission.game===game)advance(mission,activityProgress(mission,event),activity.eligible);
      changed();return true;
    }
    function node(tag,text){const element=doc.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
    function action(label,click){const button=node('button',label);button.type='button';button.onclick=click;return button;}
    function render(){
      if(!displayed?.section?.isConnected)return;
      const section=displayed.section;section.replaceChildren();
      for(const mission of byPerson.get(displayed.person)||[]){
        const value=entry(mission),card=node('article');card.className='musician-mission-card';card.setAttribute('data-mission-id',mission.id);
        if(displayed.selected===mission.id)card.setAttribute('data-selected','true');
        card.append(node('h3',mission.title),node('p',(mission.minLevel>1?'Level '+mission.minLevel+' challenge':'Starter mission')+' · '+GAMES[mission.game]),node('p',mission.goal),node('p','Reward: '+mission.reward+' Notes'));
        const progress=node('p',value.status==='locked'?'Unlocks at Level '+mission.minLevel+'. Keep playing to earn XP!':value.status==='available'?'Accept this mission, then start a fresh game or challenge.':value.status==='rewarded'?'Mission complete · '+mission.reward+' Notes collected!':value.status==='complete'?'Mission complete! Return to '+PERSON_NAMES[mission.person]+' to collect your reward.':'Mission active · Progress '+value.progress+' / '+mission.target);
        progress.setAttribute('role','status');card.append(progress);
        if(value.status==='available'||value.status==='locked'){const acceptButton=action(value.status==='locked'?'Unlocks at Level '+mission.minLevel:'Accept mission',()=>accept(mission.id));acceptButton.disabled=!value.unlocked;card.append(acceptButton);}
        if(value.status==='active'){const play=action('Play '+GAMES[mission.game],()=>api.openGame?.(mission.game));play.disabled=!value.unlocked;card.append(play);}
        if(value.status==='complete'){const collect=action('Collect reward',()=>turnIn(mission.id));collect.disabled=!canTurnIn(mission);card.append(collect);if(typeof api.findQuestGiver==='function')card.append(action('Find quest giver',()=>api.findQuestGiver(mission.person,value)));}
        section.append(card);
      }
      const note=node('p','Results are checked while you play. Return to the musician to collect your completed mission’s reward.');note.className='muted';section.append(note);
      if(lastError){const error=node('p',lastError);error.setAttribute('role','alert');section.append(error);}
    }
    function open(person){
      const mission=missionFor(person);if(!mission)return false;
      api.openPanel?.((typeof person==='object'?person.name:PERSON_NAMES[mission.person])+' · Missions');
      const section=node('section');section.className='musician-mission';section.setAttribute('aria-label',PERSON_NAMES[mission.person]+' missions');
      api.panelBody.append(section);displayed={person:mission.person,selected:byId.has(typeof person==='string'?person:person?.id)?mission.id:null,section};render();return true;
    }
    host?.addEventListener?.('message',onMessage);
    return {open,accept,attachGame,detachGame,turnIn,snapshot,listFor,beginActivity,recordActivity,refresh:changed,get:person=>{const mission=missionFor(person);return mission?entry(mission):null;},
      retryRewards(person){return turnIn(person||displayed?.selected||displayed?.person);},dispose(){if(disposed)return;disposed=true;activities.clear();detachGame();host?.removeEventListener?.('message',onMessage);displayed=null;}};
  }
  return {KEY,DEFINITIONS,GAMES,validResult,validActivity,createStreakTracker,create};
});
