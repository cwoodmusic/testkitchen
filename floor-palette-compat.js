/* Render-only repair of known earlier floor pigments. Saved artwork stays raw. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFloorPaletteCompat=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const TILE=64,MAX_RUNS=262144,MAX_AREA=16777216;
 const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
 const color=value=>typeof value==='string'&&/^#[0-9a-f]{8}$/i.test(value);
 function compile(manifest){
  if(!object(manifest)||manifest.version!==1||!Number.isInteger(manifest.width)||!Number.isInteger(manifest.height)||manifest.width<1||manifest.height<1||manifest.width>8192||manifest.height>8192||manifest.width*manifest.height>MAX_AREA||!object(manifest.tiles))throw Error('Unsupported floor palette manifest.');
  const tiles=new Map();let ruleCount=0,coverage=0;
  for(const [key,rules]of Object.entries(manifest.tiles)){
   if(!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(key)||!Array.isArray(rules))throw Error('Invalid floor palette tile.');
   const [tx,ty]=key.split(',').map(Number),width=Math.min(TILE,manifest.width-tx*TILE),height=Math.min(TILE,manifest.height-ty*TILE),byColor=new Map();
   if(width<=0||height<=0)throw Error('Floor palette tile is outside its image.');
   for(const rule of rules){
    if(!Array.isArray(rule)||rule.length!==4||!Number.isInteger(rule[0])||!Number.isInteger(rule[1])||rule[0]<0||rule[1]<1||rule[0]+rule[1]>height*TILE||!color(rule[2])||!(rule[3]===null||color(rule[3]))||++ruleCount>MAX_RUNS||(coverage+=rule[1])>MAX_AREA*4)throw Error('Invalid floor palette rule.');
    const [start,length,oldColor,target]=rule,last=start+length-1;
    if(width<TILE&&(Math.floor(start/TILE)!==Math.floor(last/TILE)||start%TILE+length>width))throw Error('Floor palette rule crosses image padding.');
    const keyColor=oldColor.toLowerCase();let pixels=byColor.get(keyColor);if(!pixels){pixels=new Map();byColor.set(keyColor,pixels);}
    for(let index=start;index<start+length;index++)pixels.set(index,target===null?null:target.toLowerCase());
   }
   tiles.set(key,byColor);
  }
  return {width:manifest.width,height:manifest.height,tiles,ruleCount};
 }
 function create(options={}){
  let compiled=null,loaded=false,error=null;
  const cache=new WeakMap(),outputs=new WeakSet();
  function install(manifest){compiled=compile(manifest);loaded=true;}
  function fail(reason){loaded=true;error=reason?.message||String(reason);}
  let ready;
  if(Object.prototype.hasOwnProperty.call(options,'manifest')){
   try{install(options.manifest);}catch(reason){fail(reason);}ready=Promise.resolve();
  }else{
   const request=options.fetch||(typeof fetch==='function'?fetch.bind(globalThis):null);
   ready=(async()=>{
    if(!request){fail(Error('Floor palette loading is unavailable.'));return;}
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),10000):null;
    try{
     const response=await request(options.url||'assets/environment/floor-palette-compat.json',{cache:'no-cache',...(controller?{signal:controller.signal}:{})});
     if(!response.ok)throw Error('Floor palette could not load: HTTP '+response.status+'.');
     install(await response.json());
    }catch(reason){fail(reason);}finally{if(timer!==null)clearTimeout(timer);}
   })();
  }
  function resolveTexture(id,patch){
   if(id!=='background.world'||!compiled||!object(patch)||patch.width!==compiled.width||patch.height!==compiled.height||!object(patch.tiles)||outputs.has(patch))return patch;
   if(cache.has(patch))return cache.get(patch);
   let changed=false;const tiles={};
   for(const [key,runs]of Object.entries(patch.tiles)){
    const rules=compiled.tiles.get(key);
    if(!rules){tiles[key]=runs;continue;}
    const result=[];
    for(const [start,length,rawColor]of runs){
     const matches=rules.get(rawColor.toLowerCase());
     for(let index=start;index<start+length;index++){
      const target=matches?.has(index)?matches.get(index):rawColor;
      if(target===null){changed=true;continue;}
      if(target!==rawColor)changed=true;
      const previous=result[result.length-1];
      if(previous&&previous[0]+previous[1]===index&&previous[2]===target)previous[1]++;else result.push([index,1,target]);
     }
    }
    if(result.length)tiles[key]=result;
   }
   const result=changed?{width:patch.width,height:patch.height,tiles}:patch;
   cache.set(patch,result);if(changed)outputs.add(result);return result;
  }
  return {ready,resolveTexture,getState:()=>({ready:loaded,error,ruleCount:compiled?.ruleCount||0})};
 }
 return Object.freeze({create});
});
