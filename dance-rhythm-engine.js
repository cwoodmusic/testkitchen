/* A small, clock-driven dance chart. Times are seconds; no audio or DOM needed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDanceRhythmEngine=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const VERSION=1,BARS=8,BEATS_PER_BAR=4,COUNT_IN_BEATS=4;
 const DIRECTIONS=Object.freeze(['left','up','down','right']);
 const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({id:'easy',label:'Easy',bpm:80,window:.19,perfectWindow:.08}),
  normal:Object.freeze({id:'normal',label:'Normal',bpm:92,window:.16,perfectWindow:.08}),
  hard:Object.freeze({id:'hard',label:'Hard',bpm:88,window:.14,perfectWindow:.07})
 });
 // Positive values are sounding quarter-note units; negative values are rests.
 // Every pattern is exactly one 4/4 bar. Sixteenths arrive in pairs or fours.
 const PATTERNS=Object.freeze({
  easy:Object.freeze([[1,-1,-1,-1],[1,-1,1,-1],[1,-1,-1,1],[-1,1,-1,-1]].map(Object.freeze)),
  normal:Object.freeze([[1,1,1,1],[.5,.5,1,-1,1],[1,.5,.5,1,-1],[1,-.5,.5,1,1],[.5,.5,.5,.5,1,1],[-1,1,.5,.5,1]].map(Object.freeze)),
  hard:Object.freeze([[.5,.25,.25,.5,.5,1,1],[.25,.25,.25,.25,1,.5,.5,1],[1.5,.5,.5,.5,1],[.5,1,.5,1,-1],[.5,-.5,.25,.25,.5,1,1],[1,.5,.25,.25,.5,.5,1]].map(Object.freeze))
 });
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function difficultyFor(value){return DIFFICULTIES[value]||DIFFICULTIES.easy;}
 function seedOf(value){if(typeof value==='number'&&Number.isFinite(value))return value>>>0;let seed=2166136261;for(const char of String(value??'coda-dance'))seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}
 function randomFor(seed){let state=seed||0x6d2b79f5;return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};}
 function noteShape(duration){return duration===1.5?{baseDuration:1,dots:1,beamLevel:0}:{baseDuration:duration,dots:0,beamLevel:duration===.25?2:duration===.5?1:0};}
 function generateChart(options={}){
  const difficulty=difficultyFor(options.difficulty),seed=seedOf(options.seed),random=randomFor(seed),events=[];let lastDirection=null,lastPattern=null,bag=[];
  function nextPattern(){
   if(!bag.length){
    // Shuffle the whole vocabulary before reusing a bar, including the opening.
    bag=PATTERNS[difficulty.id].slice();
    for(let index=bag.length-1;index>0;index--){const other=Math.floor(random()*(index+1));[bag[index],bag[other]]=[bag[other],bag[index]];}
    if(bag[bag.length-1]===lastPattern){const other=Math.floor(random()*(bag.length-1));[bag[bag.length-1],bag[other]]=[bag[other],bag[bag.length-1]];}
   }
   lastPattern=bag.pop();return lastPattern;
  }
  for(let bar=0;bar<BARS;bar++){
   const pattern=nextPattern();
   let beatInBar=0;
   for(const value of pattern){
    const duration=Math.abs(value),rest=value<0;let direction=null;
    if(!rest){
     const previous=events[events.length-1];
     // Keep consecutive sixteenths on one arrow so quick taps never need a turn.
     const sameSixteenthGroup=difficulty.id==='hard'&&duration===.25&&previous&&!previous.rest&&previous.duration===.25;
     if(sameSixteenthGroup)direction=previous.direction;
     else{const choices=DIRECTIONS.filter(value=>value!==lastDirection);direction=choices[Math.floor(random()*choices.length)];}
     lastDirection=direction;
    }
    events.push({id:'dance-'+bar+'-'+events.length,bar,beat:bar*BEATS_PER_BAR+beatInBar,onset:bar*BEATS_PER_BAR+beatInBar,beatInBar,duration,rest,direction,...noteShape(duration),beamGroup:null});beatInBar+=duration;
   }
  }
  // Beams join adjacent short notes within one notated quarter-note beat.
  // Rests, quarter notes, and barlines always end a group. Lone short notes
  // retain their real flag instead of acquiring a misleading one-note beam.
  let group=[];
  function flush(){if(group.length>1){const key='beam-'+group[0].id;for(const event of group)event.beamGroup=key;}group=[];}
  for(const event of events){
   if(event.rest||!event.beamLevel){flush();continue;}
   const previous=group[group.length-1];if(previous&&(previous.bar!==event.bar||Math.floor(previous.beatInBar)!==Math.floor(event.beatInBar)||Math.abs(previous.beat+previous.duration-event.beat)>.00001))flush();
   group.push(event);
  }flush();
  const chart={version:VERSION,difficulty:difficulty.id,seed,meter:'4/4',bars:BARS,beatsPerBar:BEATS_PER_BAR,countInBeats:COUNT_IN_BEATS,totalBeats:BARS*BEATS_PER_BAR,bpm:difficulty.bpm,beatSeconds:60/difficulty.bpm,barLines:Object.freeze(Array.from({length:BARS+1},(_,bar)=>bar*BEATS_PER_BAR)),notesTotal:events.filter(event=>!event.rest).length,events:Object.freeze(events.map(Object.freeze))};
  return Object.freeze(chart);
 }
 function create(options={}){
  const chart=generateChart(options),difficulty=difficultyFor(chart.difficulty),beatSeconds=chart.beatSeconds,records=chart.events.filter(event=>!event.rest).map(event=>({...event,status:'pending',judgement:'pending',judgedAt:null,offset:null}));
  const byId=new Map(records.map(event=>[event.id,event]));let phase='idle',startedAt=null,lastNow=null,elapsed=0,beat=-COUNT_IN_BEATS,score=0,hits=0,misses=0,streak=0,bestStreak=0,perfectHits=0,goodHits=0,wrongInputs=0,lateMisses=0,extras=0,finished=false;
  const clock=typeof options.now==='function'?options.now:()=>typeof performance!=='undefined'?performance.now()/1000:Date.now()/1000;
  function atTime(value){let next=Number.isFinite(value)?value:clock();if(!Number.isFinite(next))next=lastNow??0;if(lastNow!==null)next=Math.max(lastNow,next);lastNow=next;return next;}
  function snapshot(event){return {...event};}
  function getState(){
   const countInActive=phase==='countin',index=countInActive?clamp(Math.floor(elapsed/beatSeconds),0,3):-1,accuracy=hits+misses?hits/(hits+misses):1;
   const stats={score,hits,misses,streak,bestStreak,accuracy,perfectHits,goodHits,wrongInputs,lateMisses,extras,notesTotal:chart.notesTotal,notesRemaining:records.filter(event=>event.status==='pending').length};
   return {phase,difficulty:difficulty.id,bpm:difficulty.bpm,window:difficulty.window,perfectWindow:difficulty.perfectWindow,beatSeconds,beat,elapsed,songElapsed:beat*beatSeconds,startedAt,countIn:{active:countInActive,index,label:countInActive?['1','2','3','GO'][index]:'',beats:COUNT_IN_BEATS},bar:clamp(Math.floor(beat/BEATS_PER_BAR),0,BARS-1),progress:clamp(beat/chart.totalBeats,0,1),chart,notes:records.map(snapshot),events:chart.events.map(event=>event.rest?{...event,status:'rest',judgement:'rest'}:snapshot(byId.get(event.id))),...stats,stats,complete:finished,perfect:finished&&misses===0&&hits===chart.notesTotal,allPerfect:finished&&perfectHits===chart.notesTotal};
  }
  function publish(event,output){
   const item=Object.freeze(event);output.push(item);
   for(const callback of [options.onEvent,event.type==='hit'?options.onHit:event.type==='miss'||event.type==='extra'?options.onMiss:event.type==='complete'?options.onComplete:null])if(typeof callback==='function')try{callback(item);}catch{}
  }
  function result(events=[],extra={}){return {state:getState(),events,...extra};}
  function start(value){
   if(phase==='destroyed')return result();if(startedAt!==null)return update(value);
   startedAt=atTime(value);elapsed=0;beat=-COUNT_IN_BEATS;phase='countin';const events=[];publish({type:'start',beat,bpm:difficulty.bpm},events);return result(events);
  }
  function miss(event,reason,offset,output){
   if(event.status!=='pending')return;event.status=reason==='wrong-direction'?'wrong':'miss';event.judgement=event.status;event.judgedAt=beat*beatSeconds;event.offset=offset;misses++;streak=0;if(reason==='wrong-direction')wrongInputs++;else lateMisses++;
   publish({type:'miss',reason,noteId:event.id,direction:event.direction,beat:event.beat,offset,judgment:'miss',note:snapshot(event)},output);
  }
  function advance(value,output){
   if(phase==='idle'||phase==='destroyed'||finished)return;
   elapsed=Math.max(0,atTime(value)-startedAt);beat=elapsed/beatSeconds-COUNT_IN_BEATS;phase=beat<0?'countin':'playing';
   const songElapsed=beat*beatSeconds;
   for(const event of records)if(event.status==='pending'&&songElapsed-event.beat*beatSeconds>difficulty.window+.000001)miss(event,'late',songElapsed-event.beat*beatSeconds,output);
   if(beat>=chart.totalBeats){beat=chart.totalBeats;phase='complete';finished=true;publish({type:'complete',score,hits,misses,accuracy:hits+misses?hits/(hits+misses):1,perfect:misses===0&&hits===chart.notesTotal},output);}
  }
  function update(value){const events=[];advance(value,events);return result(events);}
  function input(direction,value,flags={}){
   if(flags.repeat===true)return result([],{ignored:true,reason:'repeat'});
   if(!DIRECTIONS.includes(direction))return result([],{ignored:true,reason:'direction'});
   const events=[];advance(value,events);if(phase==='idle'||phase==='destroyed'||finished)return result(events,{ignored:true,reason:phase});
   const songElapsed=beat*beatSeconds;let target=null,distance=Infinity;
   for(const event of records){if(event.status!=='pending')continue;const gap=Math.abs(songElapsed-event.beat*beatSeconds);if(gap<=difficulty.window+.000001&&gap<distance){target=event;distance=gap;}}
   if(!target){
    if(phase==='countin')return result(events,{ignored:true,reason:'countin'});
    // A just-late tap or a quick correction must not charge a second mistake
    // for the same already-judged arrow. It can still hit a new nearby arrow.
    if(records.some(event=>event.status!=='pending'&&Math.abs(songElapsed-event.beat*beatSeconds)<=difficulty.window+.10))return result(events,{ignored:true,reason:'already-judged'});
    misses++;extras++;wrongInputs++;streak=0;publish({type:'extra',reason:'no-note',direction,beat,judgment:'miss'},events);return result(events,{accepted:false});
   }
   const offset=songElapsed-target.beat*beatSeconds;
   if(target.direction!==direction){miss(target,'wrong-direction',offset,events);return result(events,{accepted:false,noteId:target.id});}
   target.status='hit';target.judgement=Math.abs(offset)<=difficulty.perfectWindow+.000001?'perfect':'good';target.judgedAt=songElapsed;target.offset=offset;hits++;streak++;bestStreak=Math.max(bestStreak,streak);if(target.judgement==='perfect'){perfectHits++;score+=100;}else{goodHits++;score+=70;}
   publish({type:'hit',noteId:target.id,direction,beat:target.beat,offset,judgment:target.judgement,note:snapshot(target)},events);return result(events,{accepted:true,noteId:target.id});
  }
  function destroy(){phase='destroyed';return result();}
  return Object.freeze({start,update,tick:update,input,getState,destroy});
 }
 return Object.freeze({VERSION,BARS,BEATS_PER_BAR,COUNT_IN_BEATS,DIRECTIONS,DIFFICULTIES,PATTERNS,generateChart,create});
});
