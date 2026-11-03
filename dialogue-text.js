/* A shared, local preference for letter-by-letter conversations. Hidden letters
 * retain their layout and accessible text; animation never rewrites the line. */
(function(root,factory){
 'use strict';
 const exported=factory();
 if(typeof module==='object'&&module.exports)module.exports=exported;
 if(root)root.CodaDialogueText=exported.create({window:root});
})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const KEY='codaDialogueTextSpeedV1';
 const SPEEDS=Object.freeze({slow:20,normal:40,fast:80,instant:0});
 const valid=value=>typeof value==='string'&&Object.hasOwn(SPEEDS,value);
 function graphemes(text,intl=typeof Intl==='object'?Intl:null){
  if(intl?.Segmenter)return Array.from(new intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),part=>part.segment);
  // Older browsers still keep common combining marks, flags and ZWJ emoji intact.
  const result=[];let regional=0;
  for(const point of Array.from(text)){
   const mark=/[\p{Mark}\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/u.test(point),flag=/[\u{1F1E6}-\u{1F1FF}]/u.test(point),prior=result[result.length-1];
   if(prior&&(mark||point==='\u200d'||prior.endsWith('\u200d')||flag&&regional%2===1))result[result.length-1]+=point;
   else result.push(point);
   regional=flag?regional+1:0;
  }
  return result;
 }
 function create(api={}){
  const win=api.window||(typeof window==='undefined'?null:window);
  const now=api.now||(()=>win?.performance?.now?.()??Date.now());
  const request=api.requestAnimationFrame||win?.requestAnimationFrame?.bind(win);
  const cancelFrame=api.cancelAnimationFrame||win?.cancelAnimationFrame?.bind(win)||(()=>{});
  let storage=api.storage;if(storage===undefined)try{storage=win?.localStorage;}catch{}
  let media;try{media=win?.matchMedia?.('(prefers-reduced-motion: reduce)');}catch{}
  let saved;try{saved=storage?.getItem?.(KEY);}catch{}
  let explicit=valid(saved),speed=explicit?saved:media?.matches?'instant':'normal',frame=null;
  const states=new WeakMap(),active=new Set(),controls=new Set(),settingsCleanups=new Set();
  function clean(state){
   state.element.removeEventListener?.('click',state.click);
   if(state.priorTitle===null)state.element.removeAttribute?.('title');else state.element.setAttribute?.('title',state.priorTitle);
   state.element.style.cursor=state.priorCursor;
   active.delete(state);
   if(!active.size&&frame!==null){cancelFrame(frame);frame=null;}
  }
  function complete(state){
   for(let i=state.shown;i<state.spans.length;i++)state.spans[i].style.opacity='';
   state.shown=state.spans.length;clean(state);
  }
  function tick(timestamp){
   frame=null;const time=Number.isFinite(timestamp)?timestamp:now();
   for(const state of Array.from(active)){
    if(state.element.isConnected===false){complete(state);continue;}
    state.progress+=Math.max(0,time-state.last)*SPEEDS[speed]/1000;state.last=time;
    const count=Math.min(state.spans.length,1+Math.floor(state.progress));
    for(let i=state.shown;i<count;i++)state.spans[i].style.opacity='';
    state.shown=count;
    if(count===state.spans.length)clean(state);
   }
   if(active.size)frame=request(tick);
  }
  function queue(){if(frame===null&&active.size)frame=request(tick);}
  function finish(element){const state=states.get(element);if(!state||!active.has(state))return false;complete(state);return true;}
  function cancel(element){const result=finish(element);states.delete(element);return result;}
  function show(element,value){
   if(!element)return false;
   cancel(element);const text=String(value??''),doc=element.ownerDocument||api.document||win?.document;
   if(speed==='instant'||!request||!doc?.createElement||!text){element.textContent=text;return false;}
   const letters=graphemes(text,api.Intl||win?.Intl||(typeof Intl==='object'?Intl:null));
   if(letters.length<2){element.textContent=text;return false;}
   const fragment=doc.createDocumentFragment(),spans=letters.map((letter,index)=>{const span=doc.createElement('span');span.textContent=letter;if(index)span.style.opacity='0';fragment.append(span);return span;});
   const state={element,spans,shown:1,progress:0,last:now(),priorTitle:element.getAttribute?.('title')??null,priorCursor:element.style.cursor||'',click:null};
   state.click=()=>finish(element);
   // Insert the complete accessible sentence once. Only paint opacity changes.
   element.replaceChildren(fragment);element.setAttribute?.('title','Click to show the full message.');element.style.cursor='pointer';element.addEventListener?.('click',state.click);
   states.set(element,state);active.add(state);queue();return true;
  }
  function updateControls(){for(const select of controls)select.value=speed;}
  function changeSpeed(value,persist){
   if(!valid(value))return false;
   speed=value;if(persist){explicit=true;try{storage?.setItem?.(KEY,value);}catch{}}
   const time=now();
   for(const state of Array.from(active)){if(value==='instant')complete(state);else state.last=time;}
   updateControls();return true;
  }
  function mountSettings(host){
   const doc=host?.ownerDocument||api.document||win?.document;if(!host||!doc)return ()=>{};
   const label=doc.createElement('label'),select=doc.createElement('select');label.className='dialogue-text-settings';label.append(doc.createTextNode('Text speed '));select.className='dialogue-text-speed';select.setAttribute('aria-label','Dialogue text speed');
   for(const value of Object.keys(SPEEDS)){const option=doc.createElement('option');option.value=value;option.textContent=value[0].toUpperCase()+value.slice(1);select.append(option);}
   select.value=speed;const change=()=>changeSpeed(select.value,true);select.addEventListener('change',change);label.append(select);host.append(label);controls.add(select);
   const cleanup=()=>{controls.delete(select);settingsCleanups.delete(cleanup);select.removeEventListener('change',change);label.remove();};settingsCleanups.add(cleanup);return cleanup;
  }
  const onMotion=()=>{if(!explicit)changeSpeed(media?.matches?'instant':'normal',false);};
  const onStorage=event=>{if(event.key===KEY&&valid(event.newValue)){explicit=true;changeSpeed(event.newValue,false);}};
  media?.addEventListener?.('change',onMotion);win?.addEventListener?.('storage',onStorage);
  function cancelAll(){for(const state of Array.from(active))complete(state);}
  function destroy(){cancelAll();for(const cleanup of Array.from(settingsCleanups))cleanup();media?.removeEventListener?.('change',onMotion);win?.removeEventListener?.('storage',onStorage);}
  return Object.freeze({show,finish,cancel,isRevealing:element=>{const state=states.get(element);return !!state&&active.has(state);},getSpeed:()=>speed,setSpeed:value=>changeSpeed(value,true),mountSettings,cancelAll,destroy});
 }
 return Object.freeze({KEY,SPEEDS,graphemes,create});
});
