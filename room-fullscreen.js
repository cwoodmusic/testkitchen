/* Room-owned fullscreen, with a full-window fallback for mobile browsers. */
(function(root,factory){
 'use strict';const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={createCodaRoomFullscreen:create};
 if(root)root.createCodaRoomFullscreen=create;
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 return function createCodaRoomFullscreen(api={}){
  const host=api.host,button=api.button;if(!host||!button)throw Error('Fullscreen needs a room and button.');
  const doc=host.ownerDocument,win=doc.defaultView||globalThis;
  let mode='off',pending=false,wanted=false,destroyed=false,generation=0,escapeUntil=0,resizeFrame=null,portal=null,lastState='';
  const current=()=>doc.fullscreenElement||doc.webkitFullscreenElement||null;
  const ownNative=()=>current()===host;
  const clock=()=>win.performance?.now?.()??Date.now();
  const getState=()=>({active:mode!=='off',mode,pending});
  function mountControls(){
   if(portal)return;
   const node=doc.querySelector?.('.coda-touch-controls');
   if(!node||node.parentNode===host)return;
   portal={node,parent:node.parentNode,next:node.nextSibling};host.appendChild(node);
  }
  function restoreControls(){
   if(!portal)return;const {node,parent,next}=portal;portal=null;
   if(!parent||node.parentNode!==host)return;
   if(next?.parentNode===parent)parent.insertBefore(node,next);else parent.appendChild(node);
  }
  function resized(){
   if(resizeFrame!==null)win.cancelAnimationFrame?.(resizeFrame);
   const notify=()=>{resizeFrame=null;if(!destroyed&&win.dispatchEvent&&win.Event)win.dispatchEvent(new win.Event('resize'));};
   if(win.requestAnimationFrame)resizeFrame=win.requestAnimationFrame(notify);else notify();
  }
  function sync(){
   const active=mode!=='off';
   host.classList.toggle('coda-room-native-fullscreen',mode==='native');
   host.classList.toggle('coda-room-viewport-fullscreen',mode==='viewport');
   host.dataset.roomFullscreen=mode;
   button.textContent=active?'Exit fullscreen':'Fullscreen';
   button.setAttribute('aria-label',active?'Exit '+(api.label||'room')+' fullscreen':'Make '+(api.label||'room')+' fullscreen');
   button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-busy',String(pending));button.disabled=pending;
   button.title=mode==='viewport'?'This browser uses a full-window room view.':active?'Return to the normal room view':'Fill the screen with this room';
   const state=JSON.stringify(getState());if(state!==lastState){lastState=state;try{api.onChange?.(getState());}catch{}resized();}
  }
  function leaveNative(){
   if(!ownNative())return Promise.resolve();
   const exit=doc.exitFullscreen||doc.webkitExitFullscreen||doc.webkitCancelFullScreen;
   if(!exit)return Promise.resolve();
   try{return Promise.resolve(exit.call(doc)).catch(()=>{});}catch{return Promise.resolve();}
  }
  function nativeChange(){
   if(ownNative()){
    if(destroyed||!wanted){leaveNative();return;}
    mode='native';pending=false;mountControls();
   }else if(mode==='native'){
    mode='off';pending=false;wanted=false;generation++;escapeUntil=clock()+450;restoreControls();
   }
   sync();
  }
  function exit(){
   if(destroyed)return Promise.resolve(false);
   generation++;wanted=false;pending=false;const wasActive=mode!=='off'||ownNative();
   try{api.onBeforeChange?.();}catch{}
   mode='off';if(wasActive)escapeUntil=clock()+450;restoreControls();sync();
   return leaveNative();
  }
  function enter(){
   if(destroyed)return Promise.resolve(false);
   wanted=true;const owner=++generation;try{api.onBeforeChange?.();}catch{}mountControls();
   const request=host.requestFullscreen||host.webkitRequestFullscreen;
   const supported=typeof request==='function'&&(doc.fullscreenEnabled!==false||doc.webkitFullscreenEnabled===true);
   if(!supported){mode='viewport';pending=false;sync();return Promise.resolve(true);}
   pending=true;sync();
   let operation;try{operation=request.call(host);}catch{operation=Promise.reject(Error('Fullscreen unavailable'));}
   return Promise.resolve(operation).then(()=>{
    if(destroyed||owner!==generation||!wanted){if(!wanted)return leaveNative().then(()=>false);return false;}
    mode=ownNative()?'native':'viewport';pending=false;sync();return true;
   },()=>{
    if(destroyed||owner!==generation||!wanted)return false;
    mode='viewport';pending=false;sync();return true;
   });
  }
  function toggle(){return wanted||mode!=='off'||pending?exit():enter();}
  function handleEscape(event){
   if(event?.key!=='Escape'||mode==='off'&&!pending&&host.hidden===true)return false;
   if(mode!=='off'||pending||escapeUntil>clock()){
    event.preventDefault?.();event.stopPropagation?.();if(mode!=='off'||pending)exit();return true;
   }
   return false;
  }
  const click=event=>{event.preventDefault?.();event.stopPropagation?.();toggle();};
  // Own this Escape before the outer arcade or room handles it as an exit.
  const escape=event=>handleEscape(event);
  button.addEventListener('click',click);doc.addEventListener('keydown',escape,true);doc.addEventListener('fullscreenchange',nativeChange);doc.addEventListener('webkitfullscreenchange',nativeChange);sync();
  return {toggle,exit,handleEscape,getState,destroy(){
   if(destroyed)return;exit();destroyed=true;button.removeEventListener('click',click);doc.removeEventListener('keydown',escape,true);doc.removeEventListener('fullscreenchange',nativeChange);doc.removeEventListener('webkitfullscreenchange',nativeChange);
   if(resizeFrame!==null)win.cancelAnimationFrame?.(resizeFrame);resizeFrame=null;
  }};
 };
});
