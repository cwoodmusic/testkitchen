/* Glass beneath the reviewed transparent boutique-path cutout, background only.
 * Raw artwork/foreground erasures and saved project data remain authoritative. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPathwayFloorFill=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function compile(manifest){
  if(!manifest||manifest.version!==1||!Number.isInteger(manifest.width)||!Number.isInteger(manifest.height)||manifest.width<1||manifest.height<1||manifest.width>8192||manifest.height>8192||manifest.width*manifest.height>16777216||!Array.isArray(manifest.sampleOffset)||manifest.sampleOffset.length!==2||!manifest.sampleOffset.every(Number.isInteger)||!Array.isArray(manifest.transparentRuns)||manifest.transparentRuns.length>262144)throw Error('Unsupported pathway floor shape.');
  const [dx,dy]=manifest.sampleOffset,rows=new Map();let pixels=0;
  const runs=manifest.transparentRuns.map(run=>{
   if(!Array.isArray(run)||run.length!==3||!run.every(Number.isInteger))throw Error('Invalid pathway floor run.');
   const [y,start,end]=run;
   if(y<0||y>=manifest.height||start<0||end>manifest.width||end<=start||start+dx<0||end+dx>manifest.width||y+dy<0||y+dy>=manifest.height)throw Error('Pathway floor run or sample is outside its image.');
   let row=rows.get(y);if(!row){row=[];rows.set(y,row);}row.push([start,end]);pixels+=end-start;return run.slice();
  });
  for(const row of rows.values()){
   row.sort((a,b)=>a[0]-b[0]);for(let index=1;index<row.length;index++)if(row[index][0]<row[index-1][1])throw Error('Pathway floor runs overlap.');
  }
  if(manifest.transparentPixels!==undefined&&manifest.transparentPixels!==pixels)throw Error('Pathway floor coverage does not match its shape.');
  return {width:manifest.width,height:manifest.height,offset:[dx,dy],runs,pixels};
 }
 function create(options={}){
  const doc=options.document||(typeof document==='undefined'?null:document),cache=new WeakMap();let shape=null,loaded=false,error=null,builds=0;
  const install=manifest=>{shape=compile(manifest);loaded=true;};
  const fail=reason=>{loaded=true;error=reason?.message||String(reason);};
  let ready;
  if(Object.prototype.hasOwnProperty.call(options,'manifest')){
   try{install(options.manifest);}catch(reason){fail(reason);}ready=Promise.resolve();
  }else{
   ready=(async()=>{
    const request=options.fetch||(typeof fetch==='function'?fetch.bind(globalThis):null);
    if(!request){fail(Error('Pathway floor loading is unavailable.'));return;}
    const controller=typeof AbortController==='function'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),10000):null;
    try{
     const response=await request(options.url||'assets/environment/boutique-pathway-shape.json',{cache:'no-cache',...(controller?{signal:controller.signal}:{})});
     if(!response.ok)throw Error('Pathway floor could not load: HTTP '+response.status+'.');install(await response.json());
    }catch(reason){fail(reason);}finally{if(timer!==null)clearTimeout(timer);}
   })();
  }
  function draw(ctx,source){
   if(!ctx||!source||!shape||!doc||source.complete!==undefined&&(!source.complete||!source.naturalWidth))return false;
   if((source.naturalWidth||source.width)!==shape.width||(source.naturalHeight||source.height)!==shape.height)return false;
   let canvas=cache.get(source);
   if(!canvas){
    canvas=doc.createElement('canvas');canvas.width=shape.width;canvas.height=shape.height;const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
    const [dx,dy]=shape.offset;
    for(const [y,start,end]of shape.runs)g.drawImage(source,start+dx,y+dy,end-start,1,start,y,end-start,1);
    cache.set(source,canvas);builds++;
   }
   ctx.drawImage(canvas,0,0);return true;
  }
  return {ready,draw,getState:()=>({ready:loaded,error,runCount:shape?.runs.length||0,pixels:shape?.pixels||0,builds})};
 }
 return Object.freeze({create});
});
