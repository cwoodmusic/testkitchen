// One venue programme owns one media element for the whole town session.
// Entering the hall changes its gain, never its source or playback position.
export const CONCERT_AUDIO_PREFERENCE_KEY='codaTownConcertAudioV1';
const clamp=(value,min=0,max=1)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

export function createConcertShuffleBag(items,{random=Math.random}={}){
 const all=Array.isArray(items)?items.slice():[];
 let bag=[],last=null;
 const key=item=>item?.id??item;
 function refill(excluded){
  bag=all.filter(item=>!excluded.has(key(item)));
  for(let i=bag.length-1;i>0;i--){const n=clamp(finite(Number(random()),0),0,.999999999),j=Math.floor(n*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
  // pop() is the next selection; the previous bag's final song must not
  // immediately become the new bag's opening song when another is available.
  if(bag.length>1&&key(bag.at(-1))===last){const index=bag.findIndex(item=>key(item)!==last);[bag[index],bag[bag.length-1]]=[bag.at(-1),bag[index]];}
 }
 return {
  next(excluded=new Set()){
   if(!(excluded instanceof Set))excluded=new Set(excluded||[]);
   bag=bag.filter(item=>!excluded.has(key(item)));
   if(!bag.length)refill(excluded);
   const item=bag.pop();if(item===undefined)return null;last=key(item);return item;
  },
  reset(){bag=[];},
  get remaining(){return bag.length;}
 };
}

function availableProgramme(value){
 const seen=new Set();
 return (Array.isArray(value)?value:[]).filter(track=>{
  if(!track||typeof track.id!=='string'||!track.id||seen.has(track.id)||typeof track.src!=='string'||!track.src.trim())return false;
  seen.add(track.id);return true;
 }).slice();
}
function defaultStorage(){try{return globalThis.localStorage;}catch{return null;}}
function readPreferences(storage){
 try{
  const value=JSON.parse(storage?.getItem(CONCERT_AUDIO_PREFERENCE_KEY)||'null');
  return value&&typeof value==='object'?{...(typeof value.muted==='boolean'?{muted:value.muted}:{}),...(Number.isFinite(value.volume)&&value.volume>=0&&value.volume<=1?{volume:value.volume}:{})}:{};
 }catch{return {};}
}

export function createConcertAudio({
 programme=[],getProject,getScene,AudioConstructor=globalThis.Audio,random=Math.random,
 storage=defaultStorage(),targetWindow=globalThis.window,targetDocument=globalThis.document,
 AudioContextConstructor=targetWindow?.AudioContext??targetWindow?.webkitAudioContext??globalThis.AudioContext??globalThis.webkitAudioContext,
 requestFrame=targetWindow?.requestAnimationFrame?.bind(targetWindow),
 cancelFrame=targetWindow?.cancelAnimationFrame?.bind(targetWindow),
 now=()=>globalThis.performance?.now?.()??Date.now(),
 autoplay=true,volume=.75,muted=false,fadeMs=280,
 outdoorGain=.025,indoorGain=1,interiorGain=.003,outdoorCutoff=1500,interiorCutoff=600,
 venueAsset='sydney-opera-house',onChange
}={}){
 const tracks=availableProgramme(programme),shuffle=createConcertShuffleBag(tracks,{random});
 const preferences=readPreferences(storage),listeners=new Set(),removers=[],failed=new Set();
 let media=null,destroyed=false,currentTrack=shuffle.next(),preparedId=null;
 let master=preferences.volume??clamp(finite(volume,.75)),isMuted=preferences.muted??Boolean(muted);
 let wantsPlay=Boolean(autoplay),unlocked=false,needsGesture=false,pending=null,playSequence=0;
 let contextScene=null,contextEnabled=true,eligible=false,mode='absent',hasVenue=false,contextGain=0;
 let pageHidden=false,lastError='',frame=null,desiredOutput=0,rampSequence=0;
 let graph=null,graphAttempted=false,graphResumePending=null,filterTarget=null;
 const fadeDuration=Math.max(0,finite(fadeMs,280));
 if(typeof onChange==='function')listeners.add(onChange);
 try{
  if(typeof AudioConstructor==='function'){
   media=new AudioConstructor();media.preload='metadata';media.loop=false;media.volume=0;media.muted=isMuted;
  }
 }catch{media=null;}
 const hidden=()=>Boolean(pageHidden||targetDocument?.hidden);
 const canPlay=()=>!destroyed&&!!media&&!!currentTrack&&tracks.length>failed.size&&eligible&&!hidden()&&wantsPlay&&unlocked;
 function state(){
  const noRecordings=!tracks.length,unavailable=!media||tracks.length>0&&failed.size>=tracks.length;
  let status=destroyed?'destroyed':noRecordings?'empty':unavailable?'unavailable':!eligible?'inactive':hidden()?'suspended':!wantsPlay?'paused':!unlocked||needsGesture?'locked':pending?'loading':media?.paused===false?'playing':'ready';
  return Object.freeze({
   track:currentTrack,trackId:currentTrack?.id??null,category:currentTrack?.category??null,pianist:currentTrack?.pianist??null,
   playing:!destroyed&&media?.paused===false,status,muted:isMuted,volume:master,
   context:mode,contextGain,effectiveVolume:desiredOutput,outputVolume:finite(media?.volume,0),
   usingWebAudio:Boolean(graph),filterEnabled:Boolean(graph?.filter&&eligible&&mode!=='concert'&&!destroyed),
   filterCutoffHz:graph?.filter?filterTarget:null,audioContextState:graph?.context.state??null,
   currentTime:preparedId===currentTrack?.id?Math.max(0,finite(media?.currentTime,0)):0,
   duration:preparedId===currentTrack?.id&&Number.isFinite(media?.duration)?Math.max(0,media.duration):null,
   needsGesture:eligible&&wantsPlay&&(!unlocked||needsGesture)&&!noRecordings&&!unavailable,
   wanted:wantsPlay,enabled:contextEnabled,hasVenue,hidden:hidden(),destroyed,
   failedTrackIds:Object.freeze([...failed]),
   error:lastError||(!media?'Audio playback is unavailable in this browser.':noRecordings?'No concert recordings are available.':'')
  });
 }
 function emit(reason){const value=state();for(const fn of [...listeners])try{fn(value,reason);}catch{/* A UI listener cannot interrupt playback. */}}
 function listen(target,event,handler,options){
  if(!target?.addEventListener)return;
  target.addEventListener(event,handler,options);removers.push(()=>target.removeEventListener(event,handler,options));
 }
 function persist(){try{storage?.setItem(CONCERT_AUDIO_PREFERENCE_KEY,JSON.stringify({version:1,muted:isMuted,volume:master}));}catch{/* Music remains usable when preference storage is full or private. */}}
 function closeGraph(value){
  if(!value)return;
  try{value.source?.disconnect();}catch{}
  try{value.filter?.disconnect();}catch{}
  try{value.context.close?.()?.catch?.(()=>{});}catch{}
 }
 function cutoff(){
  const fullRange=(graph?.context.sampleRate??48000)/2;
  return !eligible||mode==='concert'?fullRange:clamp(finite(mode==='interior'?interiorCutoff:outdoorCutoff,1500),80,fullRange);
 }
 function updateFilter(immediate=false){
  if(!graph?.filter)return;
  const value=cutoff();if(value===filterTarget)return;filterTarget=value;
  const parameter=graph.filter.frequency,time=finite(graph.context.currentTime,0);
  // Native AudioParam automation runs on the audio thread. Repeated town
  // render updates never reschedule these ramps or create additional nodes.
  try{
   if(immediate||!fadeDuration){parameter.cancelScheduledValues(time);parameter.setValueAtTime(value,time);return;}
   if(typeof parameter.cancelAndHoldAtTime==='function')parameter.cancelAndHoldAtTime(time);
   else{const held=parameter.value;parameter.cancelScheduledValues(time);parameter.setValueAtTime(held,time);}
   parameter.linearRampToValueAtTime(value,time+fadeDuration/1000);
  }catch{parameter.value=value;}
 }
 function ensureAudioGraph(){
  if(graphAttempted||destroyed||!media||!tracks.length||!eligible)return;
  graphAttempted=true;
  if(typeof AudioContextConstructor!=='function')return;
  let candidate=null;
  try{
   const context=new AudioContextConstructor();candidate={context,source:null,filter:null};
   // Create and connect the filter before taking ownership of the media
   // element. Browsers without this API retain ordinary media playback.
   const filter=context.createBiquadFilter();candidate.filter=filter;
   filter.type='lowpass';filter.Q.value=.7;filter.connect(context.destination);
   const source=context.createMediaElementSource(media);candidate.source=source;
   try{source.connect(filter);}catch{
    // A partially supported filter must not leave the captured media silent.
    filter.disconnect();source.connect(context.destination);candidate.filter=null;
   }
   graph=candidate;filterTarget=null;updateFilter(true);
   listen(context,'statechange',()=>{
    if(destroyed)return;
    if(context.state==='suspended'&&!graphResumePending&&eligible&&!hidden()&&wantsPlay){
     unlocked=false;needsGesture=true;pauseMedia();
    }
    emit('filter');
   });
  }catch{closeGraph(candidate);}
 }
 function activateAudioGraph(){
  // Only unlock()/play(), called by an actual player gesture, create or
  // resume a context. Scene changes and animation frames never do either.
  ensureAudioGraph();
  if(!graph||graph.context.state==='running')return Promise.resolve(true);
  if(graphResumePending)return graphResumePending;
  const activeGraph=graph;let resumed;
  try{resumed=activeGraph.context.resume();}catch(error){resumed=Promise.reject(error);}
  graphResumePending=Promise.resolve(resumed).then(()=>{
   graphResumePending=null;if(destroyed||graph!==activeGraph)return false;
   emit('filter');return true;
  }).catch(()=>{
   graphResumePending=null;if(destroyed||graph!==activeGraph)return false;
   unlocked=false;needsGesture=true;lastError='Select Play to start the concert music.';pauseMedia();emit('blocked');return false;
  });
  return graphResumePending;
 }
 function cancelRamp(){rampSequence++;if(frame!==null&&typeof cancelFrame==='function')cancelFrame(frame);frame=null;}
 function output(value,immediate=false){
  value=clamp(finite(value,0));
  if(!media){desiredOutput=value;return;}
  if(!immediate&&Math.abs(value-desiredOutput)<1e-8)return;
  desiredOutput=value;cancelRamp();
  const start=clamp(finite(media.volume,0));
  if(immediate||!fadeDuration||typeof requestFrame!=='function'||Math.abs(start-value)<1e-8){media.volume=value;return;}
  const started=now(),sequence=rampSequence;
  function tick(){
   if(destroyed||sequence!==rampSequence)return;
   const t=clamp((now()-started)/fadeDuration),ease=t*t*(3-2*t);
   media.volume=t===1?value:clamp(start+(value-start)*ease);frame=null;
   if(t<1)frame=requestFrame(tick);
  }
  frame=requestFrame(tick);
 }
 function updateOutput(immediate=false){output(!destroyed&&eligible&&!hidden()&&!isMuted?master*contextGain:0,immediate);}
 function invalidatePlay(){playSequence++;pending=null;}
 function pauseMedia(){invalidatePlay();if(media?.paused===false)media.pause();}
 function readScene(){if(typeof getScene!=='function')return contextScene;try{return getScene()??null;}catch{return contextScene;}}
 function projectHasVenue(){
  try{return !!getProject?.()?.objects?.some(object=>object?.asset===venueAsset);}catch{return false;}
 }
 function isPreparedSource(){
  if(!currentTrack||preparedId!==currentTrack.id)return false;
  const actual=media?.currentSrc;
  // During a new load, currentSrc can still identify the old recording.
  return !actual||actual===currentTrack.src;
 }
 function prepare(){
  if(!media||!currentTrack||preparedId===currentTrack.id)return Boolean(media&&currentTrack);
  try{
   pauseMedia();media.src=currentTrack.src;preparedId=currentTrack.id;
   media.load?.();return true;
  }catch{preparedId=null;failCurrent('This recording could not be loaded.');return false;}
 }
 function attemptPlay(){
  if(!canPlay())return Promise.resolve(false);
  if(pending)return pending.promise;
  if(!prepare())return Promise.resolve(false);
  if(media.paused===false){updateOutput();return Promise.resolve(true);}
  const request={token:++playSequence,promise:null};pending=request;
  let played;
  try{played=media.play();}catch(error){played=Promise.reject(error);}
  request.promise=Promise.resolve(played).then(()=>{
   if(destroyed||request.token!==playSequence)return false;
   pending=null;
   if(!canPlay()){pauseMedia();return false;}
   needsGesture=false;lastError='';updateOutput();emit('play');return media.paused===false;
  }).catch(error=>{
   if(destroyed||request.token!==playSequence)return false;
   pending=null;
   if(error?.name==='NotAllowedError'){
    unlocked=false;needsGesture=true;lastError='Select Play to start the concert music.';pauseMedia();emit('blocked');
   }else if(error?.name!=='AbortError')failCurrent('This recording could not be played.');
   return false;
  });
  emit('loading');return request.promise;
 }
 function nextTrack(reason='next'){
  if(destroyed)return null;
  pauseMedia();
  const next=shuffle.next(failed);
  if(!next){
   lastError='The concert recordings could not be played. Retry the programme to try again.';
   needsGesture=false;output(0,true);emit('unavailable');return null;
  }
  currentTrack=next;preparedId=null;lastError='';needsGesture=false;
  emit('track');
  if(canPlay())void attemptPlay();
  return currentTrack;
 }
 function failCurrent(message){
  if(destroyed||!currentTrack||failed.has(currentTrack.id))return;
  failed.add(currentTrack.id);lastError=message;pauseMedia();emit('error');nextTrack('error');
 }
 function updateContext(scene=readScene(),enabled=contextEnabled){
  if(destroyed)return state();
  const previous=[mode,contextGain,eligible,contextEnabled,hasVenue].join('|');
  contextScene=scene;contextEnabled=enabled!==false;hasVenue=projectHasVenue();
  const concert=scene?.kind==='concert';
  mode=!contextEnabled?'inactive':concert?'concert':hasVenue?scene?'interior':'town':'absent';
  eligible=contextEnabled&&(concert||hasVenue);
  contextGain=eligible?clamp(finite(concert?indoorGain:scene?interiorGain:outdoorGain,0)):0;
  updateFilter();
  if(graph?.context.state==='suspended'&&!graphResumePending&&eligible&&!hidden()&&wantsPlay){unlocked=false;needsGesture=true;}
  updateOutput(hidden());
  if(!eligible||hidden()||!wantsPlay)pauseMedia();else if(unlocked)void attemptPlay();
  if(previous!==[mode,contextGain,eligible,contextEnabled,hasVenue].join('|'))emit('context');
  return state();
 }
 function unlock(){
  if(destroyed)return Promise.resolve(false);
  unlocked=true;needsGesture=false;
  void activateAudioGraph();
  updateContext();return wantsPlay?attemptPlay():Promise.resolve(false);
 }
 function play(){
  if(destroyed)return Promise.resolve(false);
  wantsPlay=true;unlocked=true;needsGesture=false;if(failed.size<tracks.length)lastError='';
  void activateAudioGraph();updateContext();emit('resume');return attemptPlay();
 }
 function pause(){if(destroyed)return;wantsPlay=false;pauseMedia();emit('pause');}
 function setMuted(value){if(destroyed)return;isMuted=Boolean(value);if(media)media.muted=isMuted;persist();updateOutput();emit('mute');}
 function setVolume(value){
  if(destroyed||!Number.isFinite(Number(value)))return;
  master=clamp(Number(value));persist();updateOutput();emit('volume');
 }
 function retry(){
  if(destroyed)return Promise.resolve(false);
  failed.clear();shuffle.reset();lastError='';nextTrack('retry');return play();
 }
 function onVisibility(){updateContext();emit('visibility');}
 listen(media,'ended',()=>{if(isPreparedSource())nextTrack('ended');});
 listen(media,'error',()=>{if(isPreparedSource())failCurrent('This recording could not be loaded.');});
 listen(media,'play',()=>emit('play'));
 listen(media,'pause',()=>emit('pause'));
 listen(media,'timeupdate',()=>emit('time'));
 listen(media,'loadedmetadata',()=>emit('metadata'));
 // The explicit player controls handle their own gesture. Starting playback
 // during the Play button's pointerdown would turn its following click into
 // Pause before the player had a chance to hear anything.
 const isPlayerControl=event=>Boolean(event?.target?.closest?.('[data-concert-controls]'));
 const needsUnlock=()=>!unlocked||eligible&&!graphAttempted||graph?.context.state==='suspended';
 function onGesture(event){
  if(event?.repeat||isPlayerControl(event))return;
  // A town can gain its opera house long after the initial browser unlock.
  // Read the current project before deciding whether this gesture is needed;
  // it may have changed since the last rendered frame.
  if(!graphAttempted)updateContext();
  if(needsUnlock())void unlock();
 }
 // Bubble after the canvas handler so the click that places a new venue can
 // also create its graph, while the browser's user activation is still live.
 listen(targetWindow,'pointerdown',onGesture,{passive:true});
 listen(targetWindow,'keydown',onGesture,{capture:true});
 listen(targetDocument,'visibilitychange',onVisibility);
 listen(targetWindow,'pagehide',()=>{pageHidden=true;updateContext();emit('visibility');});
 listen(targetWindow,'pageshow',()=>{pageHidden=false;updateContext();emit('visibility');});
 updateContext();
 return {
  updateContext,unlock,play,pause,setMuted,setVolume,retry,
  toggleMute(){setMuted(!isMuted);return isMuted;},
  skip(){return nextTrack('skip');},
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);try{fn(state(),'subscribe');}catch{}return()=>listeners.delete(fn);},
  destroy(){
   if(destroyed)return;destroyed=true;pauseMedia();cancelRamp();desiredOutput=0;
   for(const remove of removers.splice(0))remove();
   if(media){media.volume=0;try{media.removeAttribute?.('src');media.load?.();}catch{}}
   closeGraph(graph);graph=null;graphResumePending=null;filterTarget=null;
   emit('destroy');listeners.clear();
  },
  get state(){return state();},get currentTrack(){return currentTrack;},
  get currentTime(){return state().currentTime;},get audioElement(){return media;},get audioContext(){return graph?.context??null;}
 };
}
