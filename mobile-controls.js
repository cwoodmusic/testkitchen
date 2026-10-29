/* Shared touch controls. Each finger releases only the view it pressed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaMobileControls=api;root.createCodaMobileControls=api.createCodaMobileControls;}})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function createHoldRouter(getContext){
  const pointers=new Map(),counts=new Map();
  function release(id){const entry=pointers.get(id);if(!entry)return;pointers.delete(id);for(const key of entry.keys){const token=entry.context.id+'\0'+key,n=(counts.get(token)||1)-1;if(n>0)counts.set(token,n);else{counts.delete(token);entry.context.key(key,false);}}}
  function hold(id,keys){
   const context=getContext(),next=Array.from(new Set(keys)),old=pointers.get(id);
   if(!context?.enabled||typeof context.key!=='function'){release(id);return false;}
   if(old?.context.id===context.id&&JSON.stringify(old.keys)===JSON.stringify(next))return true;
   release(id);pointers.set(id,{context,keys:next});
   for(const key of next){const token=context.id+'\0'+key,n=counts.get(token)||0;counts.set(token,n+1);if(!n)context.key(key,true);}return true;
  }
  function releaseAll(){const contexts=new Map();for(const entry of pointers.values())contexts.set(entry.context.id,entry.context);for(const id of Array.from(pointers.keys()))release(id);for(const context of contexts.values())context.release?.();}
  return {hold,release,releaseAll,snapshot:()=>Array.from(pointers.entries(),([id,value])=>({id,context:value.context.id,keys:[...value.keys]}))};
 }
 function joystickVector(dx,dy,radius,deadzone=.16){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(radius)||radius<=0)return{x:0,y:0,strength:0,thumbX:0,thumbY:0};
  const distance=Math.hypot(dx,dy),raw=Math.min(1,distance/radius),zone=clamp(Number.isFinite(deadzone)?deadzone:.16,0,.8),strength=raw<=zone?0:(raw-zone)/(1-zone),unitX=distance?dx/distance:0,unitY=distance?dy/distance:0;
  return{x:unitX*strength,y:unitY*strength,strength,thumbX:unitX*raw*radius,thumbY:unitY*raw*radius};
 }
 function vectorKeys(x,y){
  if(!x&&!y)return[];const angle=Math.atan2(y,x),sector=((Math.round(angle/(Math.PI/4))%8)+8)%8;
  return [['d'],['s','d'],['s'],['s','a'],['a'],['w','a'],['w'],['w','d']][sector];
 }
 function createJoystickRouter(getContext,keys=createHoldRouter(getContext)){
  let context=null,x=0,y=0;const source='movement-joystick';
  function release(){const original=context;context=null;x=y=0;if(typeof original?.move==='function')original.move(0,0);else keys.release(source);return original;}
  function move(nextX,nextY){
   const next=getContext();
   if(!next?.enabled||typeof next.move!=='function'&&typeof next.key!=='function'){release();return false;}
   if(!Number.isFinite(nextX)||!Number.isFinite(nextY)){release();return false;}
   const length=Math.hypot(nextX,nextY),scale=length>1?1/length:1;nextX*=scale;nextY*=scale;
   if(!nextX&&!nextY){release();return true;}
   if(context?.id!==next.id||(typeof context?.move==='function')!==(typeof next.move==='function'))release();
   if(context&&x===nextX&&y===nextY)return true;
   context=next;x=nextX;y=nextY;
   if(typeof context.move==='function')context.move(x,y);else keys.hold(source,vectorKeys(x,y));
   return true;
  }
  return{move,release,getState:()=>({context:context?.id||null,x,y,strength:Math.hypot(x,y),analog:typeof context?.move==='function'})};
 }
 function createCodaMobileControls(api={}){
  const host=api.host||document.body.appendChild(document.createElement('div')),doc=host.ownerDocument,win=doc.defaultView;
  host.classList.add('coda-touch-controls');host.setAttribute('role','group');host.setAttribute('aria-label','Touch game controls');
  const router=createHoldRouter(api.getContext),stickRoute=createJoystickRouter(api.getContext,router),listeners=[],timers=new Set(),captures=new Map(),keyboard=new Set();let mobile=null,contextId=null,destroyed=false,stickPointer=null,travel=40,clearing=false,activationId=0;
  const element=(tag,cls,text)=>{const node=doc.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const joystick=element('div','coda-joystick coda-dpad');joystick.tabIndex=0;joystick.setAttribute('role','group');joystick.setAttribute('aria-roledescription','joystick');joystick.setAttribute('aria-label','Movement joystick. Drag in any direction to move; release to stop. When focused, use arrow keys or WASD.');
  const ring=element('span','coda-joystick-ring'),thumb=element('span','coda-joystick-thumb'),stickLabel=element('span','coda-joystick-label','Move');for(const node of [ring,thumb,stickLabel])node.setAttribute('aria-hidden','true');joystick.append(ring,thumb,stickLabel);
  const actions=element('div','coda-touch-actions'),buttons=new Map();
  function button(label,symbol,keys,action){
   const node=element('button','coda-touch-button coda-touch-'+action);node.type='button';node.setAttribute('aria-label',action==='emote'?'Perform emote':label);node.dataset.touchKeys=JSON.stringify(keys);node.dataset.key=keys[0];node.dataset.action=action;
   const icon=element('span','coda-touch-symbol',symbol);icon.setAttribute('aria-hidden','true');
   if(action==='jump')icon.innerHTML='<svg viewBox="0 0 32 32" width="25" height="25" focusable="false"><path d="M6 27H26M16 22V5M8 13L16 5L24 13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
   if(action==='emote')icon.innerHTML='<svg viewBox="0 0 32 32" width="23" height="23" focusable="false"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M10 20Q16 27 22 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="21" cy="12" r="1.5" fill="currentColor"/></svg>';
   node.append(icon,element('span','coda-touch-label',label));buttons.set(action,node);return node;
  }
  const interact=button('Interact','E',['e'],'interact'),jump=button('Jump','↟',[' '],'jump'),emote=button('Emote','♫',['q'],'emote');actions.append(jump,interact,emote);host.append(joystick,actions);
  const listen=(target,name,callback,options)=>{target.addEventListener(name,callback,options);listeners.push(()=>target.removeEventListener(name,callback,options));};
  const find=target=>{const node=target?.closest?.('[data-touch-keys]');return node&&host.contains(node)&&!node.disabled&&!node.hidden?node:null;};
  function capture(node,id){try{node.setPointerCapture(id);captures.set(id,node);}catch{}}
  function releaseCapture(id){const node=captures.get(id);captures.delete(id);try{if(node?.hasPointerCapture?.(id))node.releasePointerCapture(id);}catch{}}
  function paintStick(dx=0,dy=0){joystick.style.setProperty('--coda-stick-x',dx+'px');joystick.style.setProperty('--coda-stick-y',dy+'px');joystick.classList.toggle('is-held',stickPointer!==null||keyboard.size>0);}
  function releaseStick(){const id=stickPointer;stickPointer=null;keyboard.clear();const original=stickRoute.release();paintStick();if(id!==null)releaseCapture(id);return original;}
  function releaseAll(){
   if(clearing)return;clearing=true;
   try{const original=releaseStick(),routed=new Set(router.snapshot().map(entry=>entry.context));router.releaseAll();if(original&&!routed.has(original.id))original.release?.();for(const id of [...captures.keys()])releaseCapture(id);for(const node of buttons.values())node.classList.remove('is-held');}
   finally{clearing=false;}
  }
  function refresh(){
   if(destroyed)return;const next=!!(win.matchMedia?.('(pointer: coarse)').matches||win.innerWidth<=760),context=api.getContext?.()||{};
   if(next!==mobile){releaseAll();mobile=next;api.onMobileChange?.(mobile);}
   if(contextId!==context.id||!context.enabled||!mobile)releaseAll();contextId=context.id;
   host.hidden=!mobile||!context.enabled;jump.hidden=context.canJump===false;emote.hidden=context.canEmote===false;
   const label=context.interactLabel||'Interact';if(interact.querySelector('.coda-touch-label').textContent!==label)interact.querySelector('.coda-touch-label').textContent=label;
   interact.title=label+' (E)';interact.setAttribute('aria-label',label);
   const held=new Set(router.snapshot().flatMap(entry=>entry.keys));for(const node of buttons.values())node.classList.toggle('is-held',JSON.parse(node.dataset.touchKeys).every(key=>held.has(key)));
  }
  function movePointer(event){
   const bounds=joystick.getBoundingClientRect(),thumbBounds=thumb.getBoundingClientRect();travel=Math.max(20,(bounds.width-thumbBounds.width)/2-8);
   const vector=joystickVector(event.clientX-bounds.left-bounds.width/2,event.clientY-bounds.top-bounds.height/2,travel);
   stickRoute.move(vector.x,vector.y);paintStick(vector.thumbX,vector.thumbY);
  }
  listen(host,'pointerdown',event=>{
   if(event.button!==0)return;const onStick=event.target?.closest?.('.coda-joystick')===joystick,node=find(event.target);if(!onStick&&!node)return;
   event.preventDefault();refresh();if(host.hidden)return;
   if(onStick){if(stickPointer!==null)return;keyboard.clear();stickPointer=event.pointerId;capture(joystick,event.pointerId);if(event.pointerType!=='touch')joystick.focus({preventScroll:true});movePointer(event);}
   else{router.hold(event.pointerId,JSON.parse(node.dataset.touchKeys));capture(node,event.pointerId);}refresh();
  },{passive:false});
  listen(host,'pointermove',event=>{if(stickPointer!==event.pointerId)return;event.preventDefault();refresh();if(stickPointer===event.pointerId&&!host.hidden)movePointer(event);},{passive:false});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(host,name,event=>{if(stickPointer===event.pointerId)releaseStick();router.release(event.pointerId);releaseCapture(event.pointerId);refresh();},{passive:false});
  const directions=new Map([['w',[0,-1]],['arrowup',[0,-1]],['s',[0,1]],['arrowdown',[0,1]],['a',[-1,0]],['arrowleft',[-1,0]],['d',[1,0]],['arrowright',[1,0]]]);
  function moveKeyboard(){const held=[...keyboard].map(key=>directions.get(key));let x=Number(held.some(([dx])=>dx===1))-Number(held.some(([dx])=>dx===-1)),y=Number(held.some(([,dy])=>dy===1))-Number(held.some(([,dy])=>dy===-1));const length=Math.hypot(x,y);if(length){x/=length;y/=length;}stickRoute.move(x,y);const bounds=joystick.getBoundingClientRect();travel=Math.max(20,(bounds.width-thumb.getBoundingClientRect().width)/2-8);paintStick(x*travel,y*travel);}
  listen(joystick,'keydown',event=>{const key=event.key.toLowerCase();if(!directions.has(key)||event.ctrlKey||event.metaKey||event.altKey)return;event.preventDefault();event.stopPropagation();refresh();if(host.hidden||stickPointer!==null||keyboard.has(key))return;keyboard.add(key);moveKeyboard();});
  listen(win,'keyup',event=>{const key=event.key.toLowerCase();if(!keyboard.has(key))return;event.preventDefault();event.stopPropagation();keyboard.delete(key);moveKeyboard();},{capture:true});
  // A Jump/Interact finger may focus the game canvas. Keep a captured touch
  // joystick moving; ordinary focus changes release only keyboard steering.
  listen(joystick,'blur',()=>{if(!keyboard.size)return;keyboard.clear();if(stickPointer===null){stickRoute.release();paintStick();}});
  // Native keyboard/screen-reader activation still operates the action buttons.
  listen(host,'click',event=>{if(event.detail!==0||event.sourceCapabilities?.firesTouchEvents)return;const node=find(event.target);if(!node)return;refresh();if(host.hidden)return;const id='keyboard-'+(++activationId);router.hold(id,JSON.parse(node.dataset.touchKeys));const timer=win.setTimeout(()=>{timers.delete(timer);router.release(id);refresh();},120);timers.add(timer);});
  const preventNative=event=>{if(event.cancelable)event.preventDefault();};
  for(const name of ['touchstart','touchmove','touchend','touchcancel'])listen(host,name,preventNative,{passive:false});
  for(const name of ['contextmenu','selectstart','dragstart'])listen(host,name,preventNative,{capture:true});
  listen(win,'blur',releaseAll);listen(win,'resize',()=>{releaseAll();refresh();});listen(win,'orientationchange',releaseAll);listen(doc,'visibilitychange',()=>{if(doc.hidden)releaseAll();});
  const interval=win.setInterval(refresh,120);refresh();
  return {refresh,releaseAll,isMobile:()=>mobile,snapshot:()=>({mobile,visible:!host.hidden,context:contextId,held:router.snapshot(),joystick:{active:stickPointer!==null||keyboard.size>0,pointerId:stickPointer,keyboard:[...keyboard],travel,...stickRoute.getState()}}),destroy(){if(destroyed)return;destroyed=true;win.clearInterval(interval);for(const timer of timers)win.clearTimeout(timer);releaseAll();listeners.forEach(stop=>stop());host.remove();}};
 }
 return {createHoldRouter,joystickVector,vectorKeys,createJoystickRouter,createCodaMobileControls};
});
