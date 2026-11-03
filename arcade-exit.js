/* The front exit returns to this arcade's title without resetting its session. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaArcadeExit=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const TARGET=Object.freeze({id:'arcade-exit',name:'Title screen',type:'exit',x:1477,y:778,radius:72});
 function near(point){return Number.isFinite(point?.x)&&Number.isFinite(point?.y)&&Math.hypot(point.x-TARGET.x,point.y-TARGET.y)<=TARGET.radius;}
 function titleURL(location){
  const base=new URL(typeof location==='string'?location:location?.href);
  if(!['https:','http:'].includes(base.protocol))throw Error('The arcade exit needs a web address.');
  // Do not forward a profile action, cabinet URL or classroom-pass fragment:
  // the title reads the existing same-tab session rather than opening it again.
  return new URL('index.html',base).href;
 }
 function create(options={}){
  const win=options.window||(typeof window==='undefined'?null:window);
  const location=options.location||(typeof window==='undefined'?null:window.location);
  const doc=options.document||(typeof document==='undefined'?null:document);
  let exiting=false;
  win?.addEventListener?.('pageshow',event=>{if(event.persisted)exiting=false;});
  const modalOpen=()=>Array.from(doc?.querySelectorAll?.('[aria-modal="true"],dialog[open]')||[]).some(node=>node.getClientRects().length>0);
  const enabled=()=>!exiting&&(typeof options.enabled==='function'?options.enabled()===true:options.enabled!==false)&&!modalOpen();
  const state=()=>({...TARGET,near:near(options.getPlayer?.()),enabled:enabled(),exiting});
  function interact(){
   if(!near(options.getPlayer?.())||!enabled())return false;
   const url=titleURL(location);exiting=true;
   try{
    if(options.beforeLeave?.()===false){exiting=false;return false;}
    if(typeof options.navigate==='function')options.navigate(url);else location.assign(url);
    return true;
   }catch(error){exiting=false;throw error;}
  }
  return {state,target:()=>near(options.getPlayer?.())&&enabled()?{...TARGET}:null,interact};
 }
 return Object.freeze({TARGET,near,titleURL,create});
});
