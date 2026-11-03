/* One audio-clock timeline for listening, preparation, and the player's turn. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.RhythmRoomTiming=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const LISTEN_BEATS=8,COUNT_BEATS=4,PLAY_BEATS=8,ROUND_BEATS=20,FOLLOW_BEATS=16,OPENING_GRACE=.22;
 // Positions always use quarter-note units. Tempo is measured in the meter's
 // main pulse: a quarter, a half, or a dotted quarter respectively.
 const TIMELINES=Object.freeze(Object.fromEntries([
  ['4/4',4,1],['2/2',4,2],['6/8',3,1.5]
 ].map(([id,measureBeats,pulseBeats])=>[id,Object.freeze({
  measureBeats,pulseBeats,listenBeats:measureBeats*2,countBeats:pulseBeats*4,
  playBeats:measureBeats*2,roundBeats:measureBeats*4+pulseBeats*4,
  followBeats:measureBeats*4
 })])));
 const getTimeline=(meter='4/4')=>typeof meter==='string'&&Object.hasOwn(TIMELINES,meter)?TIMELINES[meter]:TIMELINES['4/4'];
 function phaseAt(beat,tapMode=true,meter='4/4'){
  const timeline=getTimeline(meter),{listenBeats,countBeats,roundBeats,followBeats,pulseBeats}=timeline;
  if(beat<0)return {kind:'initial-count',index:0,beat:beat+countBeats,count:Math.max(1,Math.min(4,Math.floor((beat+countBeats)/pulseBeats)+1))};
  if(!tapMode){const index=Math.floor(beat/followBeats),local=beat-index*followBeats;return local<listenBeats?{kind:'listen',index,beat:local}:{kind:'play',index,beat:local-listenBeats};}
  const index=Math.floor(beat/roundBeats),local=beat-index*roundBeats;
  if(local<listenBeats)return {kind:'listen',index,beat:local};
  if(local<listenBeats+countBeats)return {kind:'count-in',index,beat:local-listenBeats,count:Math.floor((local-listenBeats)/pulseBeats)+1};
  return {kind:'play',index,beat:local-listenBeats-countBeats};
 }
 function playerStartBeat(index,tapMode=true,meter='4/4'){
  const {roundBeats,followBeats,listenBeats,countBeats}=getTimeline(meter);
  return index*(tapMode?roundBeats:followBeats)+listenBeats+(tapMode?countBeats:0);
 }
 function inputTime(audioNow,eventStamp,performanceNow){
  const age=(performanceNow-eventStamp)/1000;
  return Number.isFinite(age)&&age>=0&&age<=.25?Math.max(0,audioNow-age):audioNow;
 }
 function grade(round,elapsed){
  const opening=round.targets[0]===0,first=round.taps.find(t=>t.hit&&t.target===0);
  // Preparation taps are free. Only a tap close to the first downbeat can
  // match it early; an opening rest remains silent and is never a target.
  if(elapsed<0&&(!opening||elapsed< -OPENING_GRACE||round.matched.has(0)))return {hit:false,warmup:true,error:null};
  // A warm-up tap can already have matched beat one. Its immediate repeat
  // at the handoff must not become an accidental extra tap or claim note two.
  const repeatWindow=Math.min(.06,(round.targets[1]??1)*.45);
  if(first&&first.elapsed<0&&elapsed>=0&&elapsed<=repeatWindow)return {hit:false,warmup:true,error:null};
  let nearest=-1,error=Infinity;
  round.targets.forEach((target,i)=>{const diff=elapsed-target;if(!round.matched.has(i)&&Math.abs(diff)<Math.abs(error)){nearest=i;error=diff;}});
  const tolerance=nearest===0&&opening?Math.max(round.tolerance,OPENING_GRACE):round.tolerance;
  const hit=nearest>=0&&Math.abs(error)<=tolerance,openingGrace=hit&&nearest===0&&opening&&Math.abs(error)>.07;
  const value={elapsed,error:Number.isFinite(error)?error:null,hit,target:nearest,openingGrace};
  (round.taps??=[]).push(value);if(hit)round.matched.add(nearest);else round.extras++;
  return {hit,error,openingGrace};
 }
 return Object.freeze({LISTEN_BEATS,COUNT_BEATS,PLAY_BEATS,ROUND_BEATS,FOLLOW_BEATS,OPENING_GRACE,getTimeline,phaseAt,playerStartBeat,inputTime,grade});
});
