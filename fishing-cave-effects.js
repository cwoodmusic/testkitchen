/* Cached cave light and water layers. Animation follows the room's paused clock. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.createCodaFishingCaveEffects=api.createCodaFishingCaveEffects;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const TAU=Math.PI*2;
 const CRYSTALS=Object.freeze([
  [211,88,76,'#3ddae9'],[240,91,66,'#bb5bf7'],[466,66,62,'#37e3d9'],
  [870,109,65,'#bd65f2'],[903,147,58,'#47dedf'],[961,278,62,'#9672ef'],
  [861,493,78,'#e06bf2'],[830,554,64,'#53e5da'],[367,574,72,'#c76be5'],
  [300,578,59,'#4edddf'],[195,497,65,'#48dedb'],[33,267,62,'#c16ee8'],[17,334,58,'#4ad8e6']
 ].map(([x,y,radius,color],seed)=>Object.freeze({x,y,radius,color,seed})));
 const LANTERNS=Object.freeze([
  [47,105,35],[76,48,29],[173,90,30],[251,326,43],
  [527,44,32],[770,34,29],[918,139,35],[971,133,30]
 ].map(([x,y,radius],seed)=>Object.freeze({x,y,radius,seed,color:'#ffbd64'})));
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 function buildWaterCells(width,height,cell,isWater){
  const columns=Math.ceil(width/cell),rows=Math.ceil(height/cell),cells=new Uint8Array(columns*rows);let count=0;
  // Every raster pixel must fit completely on water, so upscaling cannot cast
  // caustics across the newly enlarged shore or over its dock.
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   const left=x*cell,top=y*cell,right=Math.min(width-.001,left+cell-.001),bottom=Math.min(height-.001,top+cell-.001);
   if(isWater(left,top)&&isWater(right,top)&&isWater(left,bottom)&&isWater(right,bottom)&&isWater((left+right)/2,(top+bottom)/2)){cells[y*columns+x]=1;count++;}
  }
  return {columns,rows,cells,count,cell};
 }
 function createCodaFishingCaveEffects(api={}){
  const width=clamp(finite(api.width,1000),32,4096),height=clamp(finite(api.height,620),32,4096),cell=4;
  const isWater=typeof api.isWater==='function'?api.isWater:(x,y)=>((x-550)/360)**2+((y-350)/185)**2<.97;
  const quality=()=>['full','lite','off'].includes(api.getQuality?.())?api.getQuality():'full';
  const quiet=()=>typeof api.reducedMotion==='function'?!!api.reducedMotion():api.reducedMotion===true;
  let waterMask=null,waterLayer=null,maskData=null,waterStamp='',waterRefreshes=0,maskBuilds=0,disposed=false;
  let ripples=[],lastBoat=null,lastWake=-Infinity,now=0,lastQuality='full',lastReduced=false;
  const textures=new Map();
  function makeCanvas(ctx,w,h){const doc=api.document||ctx?.canvas?.ownerDocument||root?.document;const canvas=typeof api.createCanvas==='function'?api.createCanvas(w,h):doc?.createElement?.('canvas');if(!canvas)return null;canvas.width=w;canvas.height=h;return canvas;}
  function config(state={}){now=Math.max(0,finite(state.time,now));lastQuality=quality();lastReduced=quiet();return {time:lastReduced?0:now,quality:lastQuality,quiet:lastReduced};}
  function ensureWater(ctx){
   if(maskData&&waterLayer&&waterMask)return true;
   const data=buildWaterCells(width,height,cell,isWater),mask=makeCanvas(ctx,data.columns,data.rows),layer=makeCanvas(ctx,data.columns,data.rows);if(!mask||!layer)return false;
   const g=mask.getContext('2d');g.fillStyle='#fff';
   for(let y=0;y<data.rows;y++)for(let x=0;x<data.columns;){if(!data.cells[y*data.columns+x]){x++;continue;}const start=x;while(x<data.columns&&data.cells[y*data.columns+x])x++;g.fillRect(start,y,x-start,1);}
   maskData=data;waterMask=mask;waterLayer=layer;maskBuilds++;return true;
  }
  function glow(ctx,color){
   if(textures.has(color))return textures.get(color);const canvas=makeCanvas(ctx,128,128);if(!canvas)return null;
   const g=canvas.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);gradient.addColorStop(0,color+'a8');gradient.addColorStop(.2,color+'60');gradient.addColorStop(.6,color+'1d');gradient.addColorStop(1,color+'00');g.fillStyle=gradient;g.fillRect(0,0,128,128);textures.set(color,canvas);return canvas;
  }
  function addRipple(x,y,options={}){
   if(disposed||quality()==='off'||quiet()||!Number.isFinite(x)||!Number.isFinite(y)||!isWater(x,y))return false;
   const time=Math.max(0,finite(options.time,now)),limit=quality()==='lite'?12:28;
   ripples.push({x,y,time,duration:clamp(finite(options.duration,1.8),.3,4),radius:clamp(finite(options.radius,29),4,70),strength:clamp(finite(options.strength,.34),.03,.7),wake:options.wake===true});
   if(ripples.length>limit)ripples.splice(0,ripples.length-limit);waterStamp='';return true;
  }
  function boatWake(boat,cfg,moving){
   if(!boat||!Number.isFinite(boat.x)||!Number.isFinite(boat.y)){lastBoat=null;return;}
   const distance=lastBoat?Math.hypot(boat.x-lastBoat.x,boat.y-lastBoat.y):0;
   if(!cfg.quiet&&(moving===true||distance>.1)&&distance<90&&now-lastWake>=(cfg.quality==='lite'?.2:.12)){
    addRipple(boat.x,boat.y+9,{time:now,duration:2.1,radius:cfg.quality==='lite'?21:28,strength:.28,wake:true});lastWake=now;
   }
   lastBoat={x:boat.x,y:boat.y};
  }
  function drawWater(ctx,state={}){
   if(disposed||!ctx)return;const cfg=config(state);if(cfg.quality==='off'){lastBoat=null;return;}if(!ensureWater(ctx))return;
   boatWake(state.boat,cfg,state.moving);ripples=ripples.filter(value=>now-value.time<value.duration);
   const hz=cfg.quality==='lite'?12:24,stamp=cfg.quality+':'+(cfg.quiet?'still':Math.floor(cfg.time*hz));
   if(stamp!==waterStamp){
    const g=waterLayer.getContext('2d'),w=maskData.columns,h=maskData.rows,t=cfg.time;g.clearRect(0,0,w,h);g.globalCompositeOperation='source-over';g.lineWidth=.45;
    // Slowly sliding broken ribbons make the painted reflections feel alive.
    const bands=cfg.quality==='lite'?38:76;
    for(let i=0;i<bands;i++){
     const y=46+((i*37)%88)+Math.sin(t*.7+i*.81)*2.5,x=52+((i*61)%178)+Math.sin(t*.35+i)*4;
     g.fillStyle=i%3?'#68eee927':'#a2abff25';g.fillRect(Math.round(x),Math.round(y),3+i%7,1);
     if(i%4===0){g.fillStyle='#aaf7ec17';g.fillRect(Math.round(x+4),Math.round(y+2),5+i%5,1);}
    }
    // Thin, bent caustic strokes drift together beneath the surface, rather
    // than a bright rectangle or a scrolling texture over the whole cave.
    g.strokeStyle='#82f8e91b';
    const lines=cfg.quality==='lite'?7:13;
    for(let line=0;line<lines;line++){g.beginPath();for(let x=48;x<w-12;x+=4){const y=54+line*5.3+Math.sin(x*.115+t*.35+line)*2+Math.sin(x*.05-t*.24)*2;if(x===48)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();}
    const reflections=[[212,170,'#5ef4ee'],[246,198,'#c77df5'],[469,172,'#4ee3d8'],[870,255,'#ba7de9'],[915,307,'#7debdc'],[253,395,'#ffd891']];
    for(const [rx,ry,color]of reflections)for(let i=0;i<(cfg.quality==='lite'?8:17);i++){
     const yy=ry+i*7,xx=rx+Math.sin(t*.8+i*.73+rx)*9,span=(3+i*.43)*(1+.3*Math.sin(t+i));g.fillStyle=color+(i%2?'28':'1a');g.fillRect((xx-span/2)/cell,yy/cell,span/cell,.4);
    }
    if(!cfg.quiet){
     // A handful of recurring cave drips creates expanding rings in open water.
     const drops=cfg.quality==='lite'?2:5;
     for(let i=0;i<drops;i++){const cycle=(t+i*1.37)%4.8,phase=(cycle-.75)/4.05,rx=375+i*91,ry=205+(i%3)*78;if(cycle<.75||!isWater(rx,ry))continue;g.strokeStyle='rgba(171,247,239,'+(.24*(1-phase))+')';g.beginPath();g.ellipse(rx/cell,ry/cell,(4+phase*27)/cell,(1.4+phase*9)/cell,0,0,TAU);g.stroke();}
     for(const ripple of ripples){const age=(now-ripple.time)/ripple.duration;if(age<0)continue;const radius=3+age*ripple.radius;g.strokeStyle='rgba(158,240,232,'+ripple.strength*(1-age)+')';g.lineWidth=ripple.wake?.5:.35;g.beginPath();g.ellipse(ripple.x/cell,ripple.y/cell,radius/cell,radius*.32/cell,0,0,TAU);g.stroke();}
    }
    g.globalCompositeOperation='destination-in';g.drawImage(waterMask,0,0);g.globalCompositeOperation='source-over';waterStamp=stamp;waterRefreshes++;
   }
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='screen';ctx.globalAlpha=cfg.quiet?.55:1;ctx.drawImage(waterLayer,0,0,width,height);ctx.restore();
  }
  function drawLights(ctx,state={}){
   if(disposed||!ctx)return;const cfg=config(state);if(cfg.quality==='off')return;ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalCompositeOperation='screen';
   for(const light of CRYSTALS){const image=glow(ctx,light.color);if(!image)continue;const breath=cfg.quiet?1:.85+.15*Math.sin(cfg.time*.7+light.seed*1.1);ctx.globalAlpha=(cfg.quality==='lite'?.17:.23)*breath;ctx.drawImage(image,light.x-light.radius,light.y-light.radius,light.radius*2,light.radius*2);}
   const warm=glow(ctx,'#ffbd64');if(warm)for(const light of LANTERNS){const breath=cfg.quiet?1:.92+.08*Math.sin(cfg.time*1.1+light.seed);ctx.globalAlpha=(cfg.quality==='lite'?.19:.27)*breath;ctx.drawImage(warm,light.x-light.radius,light.y-light.radius,light.radius*2,light.radius*2);}
   if(!cfg.quiet){
    const count=cfg.quality==='lite'?9:26;
    for(let i=0;i<count;i++){const anchor=CRYSTALS[i%CRYSTALS.length],x=anchor.x+Math.sin(cfg.time*.19+i*2.43)*27,y=anchor.y-((cfg.time*3+i*17)%63)+12;ctx.globalAlpha=.18+.16*(.5+.5*Math.sin(cfg.time*.8+i));ctx.fillStyle=i%3?'#a3fff0':'#ebbcff';ctx.fillRect(Math.round(x),Math.round(y),i%4===0?2:1,2);}
    for(let i=0;i<(cfg.quality==='lite'?2:5);i++){const cycle=(cfg.time+i*1.37)%4.8,rx=375+i*91,ry=205+(i%3)*78;if(cycle>=.75||!isWater(rx,ry))continue;const fall=cycle/.75,y=80+(ry-80)*fall*fall;ctx.globalAlpha=.34;ctx.fillStyle='#b8f7f4';ctx.fillRect(rx,Math.round(y),1,3);}
   }
   ctx.restore();
  }
  function snapshot(){const q=quality(),reduced=quiet();return {quality:q,reducedMotion:reduced,disposed,time:now,maskBuilds,waterRefreshes,waterCells:maskData?.count||0,waterRaster:maskData?[maskData.columns,maskData.rows]:null,textureCount:textures.size,crystalCount:q==='off'?0:CRYSTALS.length,lanternCount:q==='off'?0:LANTERNS.length,moteCount:q==='off'||reduced?0:q==='lite'?9:26,rippleLimit:q==='lite'?12:28,ripples:ripples.map(value=>({...value})),lastBoat:lastBoat?{...lastBoat}:null};}
  return {drawWater,drawLights,ripple:addRipple,snapshot,getState:snapshot,invalidateGeometry(){maskData=waterMask=waterLayer=null;waterStamp='';},dispose(){disposed=true;waterMask=waterLayer=maskData=null;ripples=[];textures.clear();lastBoat=null;}};
 }
 return {createCodaFishingCaveEffects,buildWaterCells,CRYSTALS,LANTERNS};
});
