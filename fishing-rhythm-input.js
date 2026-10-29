/* Rhythm input timestamps are independent of the last painted frame. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingRhythmInput=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
 function captureTime(options={}){
  const clock=finite(options.clock,0),sourceNow=finite(options.sourceNow,NaN),lastNow=finite(options.lastNow,sourceNow);
  if(!Number.isFinite(sourceNow))return {clock,lastNow:Number.isFinite(lastNow)?lastNow:null};
  if(sourceNow<lastNow)return {clock,lastNow};
  const base=lastNow;let eventSourceTime=sourceNow;
  if(options.useEventTimeStamp!==false&&Number.isFinite(options.performanceNow)&&Number.isFinite(options.eventTimeStamp)){
   const eventTime=options.eventTimeStamp/1000,age=options.performanceNow-eventTime;
   if(age>=-.002&&age<=finite(options.maxEventAgeSeconds,.25))eventSourceTime=sourceNow-Math.max(0,age);
  }
  eventSourceTime=Math.max(base,Math.min(sourceNow,eventSourceTime));
  return {clock:clock+Math.max(0,eventSourceTime-base),lastNow:eventSourceTime};
 }
 function createPressTracker(api={}){
  const sources=new Map();
  function down(source,event){if(sources.has(source))return false;sources.set(source,event);api.onPress?.(event,source);return true;}
  function up(source,event){if(!sources.has(source))return false;sources.delete(source);api.onRelease?.(event,source);return true;}
  function reset(reason='reset',notify=true){const held=[...sources.keys()];sources.clear();if(notify)api.onReset?.(reason,held);return held;}
  return {down,up,reset,has:source=>sources.has(source),getState:()=>({held:[...sources.keys()]})};
 }
 function bind(api={}){
  const targets=(api.targets||[]).filter(Boolean),doc=targets[0]?.ownerDocument,win=api.window||doc?.defaultView;
  if(!win||!targets.length)throw Error('Rhythm input needs a window and tap surface.');
  const listeners=[],captures=new Map(),consumedKeys=new Set(),tracker=createPressTracker(api);let disposed=false;
  const listen=(node,type,callback,options)=>{node.addEventListener(type,callback,options);listeners.push(()=>node.removeEventListener(type,callback,options));};
  const enabled=target=>!disposed&&api.enabled?.()!==false&&!target?.disabled;
  const pointerSource=event=>'pointer:'+event.pointerId;
  const keySource=event=>(event.code==='Space'||event.key===' ')?'key:Space':event.code==='NumpadEnter'?'key:NumpadEnter':'key:Enter';
  function releaseCapture(id){const target=captures.get(id);captures.delete(id);try{if(target?.hasPointerCapture?.(id))target.releasePointerCapture(id);}catch{}}
  function reset(reason='reset',options={}){
   tracker.reset(reason,options.notify!==false);for(const id of [...captures.keys()])releaseCapture(id);
   if(['blur','hidden','dispose'].includes(reason))consumedKeys.clear();
  }
  function down(event){
   if(event.button!==0||!enabled(event.currentTarget))return;event.preventDefault();
   if(!tracker.down(pointerSource(event),event))return;
   if(!enabled(event.currentTarget))return;
   try{event.currentTarget.setPointerCapture(event.pointerId);captures.set(event.pointerId,event.currentTarget);}catch{}
  }
  function up(event){
   if(tracker.has(pointerSource(event))){event.preventDefault();tracker.up(pointerSource(event),event);}
   releaseCapture(event.pointerId);
  }
  for(const target of targets){
   listen(target,'pointerdown',down,{passive:false});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(target,type,up,{passive:false});
   // Safari's long-press callout can start from Touch Events even when a
   // Pointer Event was canceled. These dedicated rhythm surfaces never need
   // native scrolling, selection, dragging, or compatibility mouse clicks.
   const preventNative=event=>{if(event.cancelable)event.preventDefault();};
   for(const type of ['touchstart','touchmove','touchend','touchcancel'])listen(target,type,preventNative,{passive:false});
   for(const type of ['contextmenu','selectstart','dragstart'])listen(target,type,preventNative,{capture:true});
   target.setAttribute?.('draggable','false');
   // Native mouse/touch compatibility clicks have a positive detail. Only an
   // explicit keyboard/screen-reader activation uses the assistive fallback.
   if(target.tagName==='BUTTON')listen(target,'click',event=>{if(event.detail===0&&!event.sourceCapabilities?.firesTouchEvents&&enabled(target)){event.preventDefault();api.onActivate?.(event);}});
  }
  function keyDown(event){
   if(!enabled(event.target))return false;event.preventDefault();const source=keySource(event);consumedKeys.add(source);
   if(event.repeat)return true;tracker.down(source,event);return true;
  }
  function keyUp(event){
   const source=keySource(event),used=consumedKeys.has(source)||tracker.has(source);if(!used)return false;
   event.preventDefault();consumedKeys.delete(source);tracker.up(source,event);return true;
  }
  for(const type of ['blur','pagehide','resize','orientationchange'])listen(win,type,()=>reset(type));
  if(doc)listen(doc,'visibilitychange',()=>{if(doc.hidden)reset('hidden');});
  function dispose(){if(disposed)return;reset('dispose');disposed=true;listeners.forEach(remove=>remove());}
  return {keyDown,keyUp,reset,dispose,getState:()=>({...tracker.getState(),capturedPointers:[...captures.keys()],disposed})};
 }
 return {captureTime,createPressTracker,bind};
});
