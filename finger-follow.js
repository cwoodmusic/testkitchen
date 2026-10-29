/* Direct finger steering. World movement and collision remain with the game. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaFingerWalk=api;root.createCodaFingerWalk=api.createCodaFingerWalk;}})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function createFingerState(api={}){
  const pointers=new Map();let following=false,pointerId=null,target=null,pinching=false,suppressed=false;
  const enabled=()=>typeof api.enabled!=='function'||api.enabled()===true;
  const valid=point=>point&&Number.isFinite(point.clientX)&&Number.isFinite(point.clientY)&&point.pointerId!==undefined;
  const point=event=>({pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY});
  function pinch(phase,reason){const values=Array.from(pointers.values()).slice(0,2);api.onPinch?.({phase,reason,pointers:values.map(value=>({...value})),distance:values.length===2?Math.hypot(values[1].clientX-values[0].clientX,values[1].clientY-values[0].clientY):0,center:values.length?{clientX:values.reduce((sum,value)=>sum+value.clientX,0)/values.length,clientY:values.reduce((sum,value)=>sum+value.clientY,0)/values.length}:null});}
  function endFollowing(reason){if(!following)return;following=false;pointerId=null;target=null;api.onStop?.(reason);}
  function stop(reason='manual'){const hadPointers=pointers.size>0;endFollowing(reason);if(pinching)pinch('end',reason);pointers.clear();pinching=false;suppressed=false;pointerId=null;target=null;return hadPointers;}
  function refresh(){if(!enabled()&&pointers.size)stop('disabled');}
  function down(event){
   refresh();if(!enabled()||!valid(event))return false;
   pointers.set(event.pointerId,point(event));
   if(pointers.size===1&&!suppressed){following=true;pointerId=event.pointerId;target={clientX:event.clientX,clientY:event.clientY};api.onStart?.({...target,pointerId});api.onTarget?.(target.clientX,target.clientY);}
   else if(pointers.size>=2){endFollowing('pinch');suppressed=true;const phase=pinching?'move':'start';pinching=true;pinch(phase);}
   return true;
  }
  function move(event){
   refresh();if(!pointers.has(event.pointerId)||!valid(event))return false;pointers.set(event.pointerId,point(event));
   if(following&&pointerId===event.pointerId){target={clientX:event.clientX,clientY:event.clientY};api.onTarget?.(target.clientX,target.clientY);}
   else if(pinching&&pointers.size>=2)pinch('move');return true;
  }
  function up(event,reason='lift'){
   if(!pointers.has(event.pointerId))return false;
   if(following&&pointerId===event.pointerId)endFollowing(reason);
   pointers.delete(event.pointerId);
   if(pinching&&pointers.size<2){pinch('end',reason);pinching=false;}
   else if(pinching)pinch('move');
   if(!pointers.size){suppressed=false;target=null;pointerId=null;}return true;
  }
  function getState(){refresh();return {following,pointerId,target:target?{...target}:null,pointerCount:pointers.size,pinching,suppressed,pointers:Array.from(pointers.values(),value=>({...value}))};}
  return {down,move,up,stop,refresh,getState,snapshot:getState};
 }
 function createCodaFingerWalk(api={}){
  const canvas=api.canvas;if(!canvas)throw Error('Finger walking needs a canvas.');
  const doc=canvas.ownerDocument,win=doc.defaultView||window,listeners=[],captured=new Set();let disposed=false;
  const state=createFingerState(api);
  const listen=(target,type,callback,options)=>{target.addEventListener(type,callback,options);listeners.push(()=>target.removeEventListener(type,callback,options));};
  const options={capture:true,passive:false};
  function releaseCapture(id){captured.delete(id);try{if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);}catch{}}
  function snapshot(){const value=state.getState();if(!value.pointerCount)Array.from(captured).forEach(releaseCapture);return value;}
  function stop(reason='manual'){const result=state.stop(reason);Array.from(captured).forEach(releaseCapture);return result;}
  function down(event){if(event.pointerType!=='touch'||event.button!==0||!(event.target===canvas||canvas.contains?.(event.target)))return;
   if(state.down(event)){event.preventDefault();try{canvas.setPointerCapture(event.pointerId);captured.add(event.pointerId);}catch{}}
  }
  function move(event){if(state.move(event))event.preventDefault();else snapshot();}
  function end(event){state.up(event,event.type==='pointercancel'?'cancel':'lift');releaseCapture(event.pointerId);}
  // Window capture runs before legacy canvas click-to-walk and pinch handlers.
  // Propagation stays intact so the caller can keep its existing pinch camera.
  listen(win,'pointerdown',down,options);listen(win,'pointermove',move,options);listen(win,'pointerup',end,true);listen(win,'pointercancel',end,true);
  listen(canvas,'lostpointercapture',event=>{captured.delete(event.pointerId);state.up(event,'capture-lost');});
  listen(canvas,'contextmenu',event=>{if(snapshot().pointerCount)event.preventDefault();});
  for(const type of ['blur','pagehide','popstate','hashchange','resize','orientationchange'])listen(win,type,()=>stop(type));
  listen(doc,'visibilitychange',()=>{if(doc.hidden)stop('hidden');});
  const timer=win.setInterval(()=>{if(canvas.isConnected===false)stop('removed');else snapshot();},80);
  return {getState:snapshot,snapshot,stop,dispose(){if(disposed)return;disposed=true;stop('dispose');win.clearInterval(timer);listeners.forEach(remove=>remove());}};
 }
 return {createFingerState,createCodaFingerWalk};
});
