/* Consecutive matched notes, using the same grading windows as Tap Practice.
 * A late browser event can be backdated by inputTime() by up to 250 ms, so a
 * live miss waits through that allowance before breaking a streak. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RhythmRoomStreak=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const OPENING_GRACE=.22,INPUT_LATENCY=.25;
 function create(onChange=()=>{}){
  let active=null,targets=[],next=0,current=0,best=0,finished=false,seen=new WeakSet();
  const retired=new WeakSet();
  const snapshot=()=>({current,best});
  function emit(){try{onChange(snapshot());}catch{/* Feedback must not interrupt grading. */}}
  function setCurrent(value){if(current===value)return;current=value;best=Math.max(best,current);emit();}
  function valid(round){return !!round&&typeof round==='object'&&Array.isArray(round.targets)&&round.targets.length<=128&&round.targets.every((value,index,list)=>Number.isFinite(value)&&value>=0&&(index===0||value>list[index-1]))&&Number.isFinite(round.tolerance)&&round.tolerance>=0&&typeof round.matched?.has==='function';}
  function finish(round=active){
   if(!active||round!==active||finished)return snapshot();
   finished=true;retired.add(active);
   // An earlier miss may already have started a new streak. Only an
   // unfinished tail can break the streak at the end of this round.
   for(let index=next;index<targets.length;index++)if(!active.matched.has(index)){setCurrent(0);break;}
   return snapshot();
  }
  function start(round){
   if(round&&typeof round==='object'&&retired.has(round))return false;
   if(active&&round===active)return !finished;
   finish();
   if(!valid(round)){active=null;targets=[];next=0;finished=false;setCurrent(0);return false;}
   active=round;targets=round.targets.slice();next=0;finished=false;seen=new WeakSet();return true;
  }
  function begin(round){start(round);return snapshot();}
  function tap(round,result){
   if(!start(round)||result?.warmup)return snapshot();
   const last=round.taps?.[round.taps.length-1];
   if(last&&typeof last==='object'){
    if(seen.has(last))return snapshot();
    seen.add(last);
   }
   if(!result?.hit||!last?.hit||!Number.isInteger(last.target)||last.target<0||last.target>=targets.length||!round.matched.has(last.target)){setCurrent(0);return snapshot();}
   if(last.target!==next)setCurrent(0);
   next=last.target+1;setCurrent(current+1);return snapshot();
  }
  function advance(round,elapsed){
   if(round!==active||finished||!Number.isFinite(elapsed)||elapsed<0)return snapshot();
   while(next<targets.length){
    if(round.matched.has(next)){next++;continue;}
    const tolerance=next===0&&targets[0]===0?Math.max(round.tolerance,OPENING_GRACE):round.tolerance;
    if(elapsed<=targets[next]+tolerance+INPUT_LATENCY)break;
    next++;setCurrent(0);
   }
   return snapshot();
  }
  function reset(){if(active)retired.add(active);active=null;targets=[];next=0;finished=false;seen=new WeakSet();setCurrent(0);return snapshot();}
  emit();
  return Object.freeze({begin,tap,advance,finish,reset,snapshot});
 }
 return Object.freeze({create});
});
