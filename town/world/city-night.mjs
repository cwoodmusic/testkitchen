import {height,surfaceAt} from './model.mjs?v=opera-parallax-1';
import {mountPose} from './cliff-mount.mjs?v=opera-parallax-1';
import {furnitureFacingPlacement} from './furniture-facing.mjs?v=opera-parallax-1';

const buffers=new WeakMap(),nativeEmitters=new WeakMap(),radialBrushes=new Map(),TAU=Math.PI*2;
const hash=(x,y=0)=>{let n=Math.imul(Math.round(x)^Math.imul(Math.round(y),374761393),668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

// Light positions use the same image anchor, rotation and terrain elevation as
// the visible sprite. A mounted lantern therefore glows on its actual cliff.
function imagePoint(doc,o,a,u,v){
 const pose=mountPose(doc,o);if(!pose)return null;
 const facing=furnitureFacingPlacement(a,o,pose,{includeImage:false});
 if(facing)return {x:facing.x+u*facing.w,y:facing.y+v*facing.h};
 const angle=o.rotation*Math.PI/180,x=(u*a.w-a.w/2)*o.scale,y=(v*a.h-a.h*pose.offset)*o.scale;
 return {x:pose.x+x*Math.cos(angle)-y*Math.sin(angle),y:pose.y+x*Math.sin(angle)+y*Math.cos(angle)};
}

// Native window and neon pixels determine their own light anchors. This keeps
// every differently shaped home, and the arcade's irregular facade, aligned.
function artworkLights(a,mode){
 if(typeof document==='undefined'||!a.canvas)return [];
 const source=a.canvas;if(!nativeEmitters.has(source))nativeEmitters.set(source,{});
 const saved=nativeEmitters.get(source);if(saved[mode])return saved[mode];
 const width=mode==='neon'?512:256,height=Math.max(1,Math.round(source.height/source.width*width)),cv=document.createElement('canvas');cv.width=width;cv.height=height;
 const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(source,0,0,width,height);const pixels=c.getImageData(0,0,width,height).data,bins=new Map(),step=mode==='neon'?20:14,plainHouse=a.id.startsWith('house-');
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],u=x/width,v=y/height;if(pixels[i+3]<150)continue;
  let tone;
  if(mode==='neon'){
   if(r>175&&b>95&&g<r*.73)tone='pink';
   else if(g>140&&b>145&&r<Math.max(g,b)*.7)tone='cyan';
   else if(b>165&&r>95&&g<Math.max(r,b)*.7)tone='violet';
   else continue;
  }else{
   // Hot amber panes are distinct from tan stone, brass trim and green lawns.
   if(u<.13||u>.9||v<(plainHouse?.55:.21)||v>(plainHouse?1:.64)||r<215||g<112||g>r*.84||b>115||r-g<43)continue;
   tone='warm';
  }
  const key=[tone,Math.floor(x/step),Math.floor(y/step)].join(':');if(!bins.has(key))bins.set(key,{x:0,y:0,n:0,tone});const bin=bins.get(key);bin.x+=x+.5;bin.y+=y+.5;bin.n++;
 }
 const colors={warm:[255,197,111],pink:[255,72,175],cyan:[68,228,255],violet:[183,112,255]};
 saved[mode]=[...bins.values()].filter(b=>b.n>=(mode==='neon'?2:3)).sort((a,b)=>b.n-a.n).slice(0,mode==='neon'?92:24).map(bin=>({u:bin.x/bin.n/width,v:bin.y/bin.n/height,color:colors[bin.tone],radius:mode==='neon'?280:115,power:mode==='neon'?1.18:.86,kind:mode==='neon'?'neon':'window'}));
 return saved[mode];
}
export function cityLights(doc,catalog,objects=doc.objects){
 const lights=[];
 for(const o of objects||[]){
  const a=catalog?.get(o.asset);if(!a)continue;
  const scale=o.scale||1;
  const lamp=(u,v,radius=290,power=1)=>{
   const head=imagePoint(doc,o,a,u,v),foot=imagePoint(doc,o,a,u,1);if(!head||!foot)return;
   lights.push({...head,gx:foot.x,gy:o.mount?head.y+54*scale:foot.y+12*scale,radius:radius*scale,power,kind:'lamp'});
  };
  const windowLight=(u,v,radius=100,power=.8)=>{
   const point=imagePoint(doc,o,a,u,v);if(point)lights.push({...point,radius:radius*scale,power,kind:'window'});
  };
  const authored=emitter=>{
   const p=imagePoint(doc,o,a,emitter.u,emitter.v);if(!p)return;
   const foot=imagePoint(doc,o,a,emitter.groundU??emitter.u,emitter.groundV??1);
   lights.push({...p,...(emitter.kind==='lamp'||emitter.kind==='uplight'||emitter.kind==='door'?{gx:foot?.x??p.x,gy:foot?.y??p.y}:{}),radius:emitter.radius*scale,power:emitter.power??1,kind:emitter.kind,color:emitter.color,beamHeight:(emitter.beamHeight||0)*scale,beamWidth:(emitter.beamWidth||0)*scale});
  };
  if(a.lightEmitters?.length){a.lightEmitters.forEach(authored);continue;}
  if(o.asset==='props-2-65')lamp(.785,.345,310);
  else if(o.asset==='decor-14-01')lamp(.5,.22,310);
  else if(o.asset==='decor-14-02'){lamp(.27,.22,265,.88);lamp(.73,.22,265,.88);}
  else if(o.asset==='decor-14-03')lamp(.5,.2,300,.94);
  else if(o.asset==='decor-14-04')lamp(.5,.32,190,.8);
  else if(['decor-14-05','decor-14-06','decor-14-07','decor-15-12','cliff-lantern'].includes(o.asset))lamp(.5,.27,205,.88);
  else if(o.asset==='decor-14-08')for(const emitter of artworkLights(a,'neon'))authored({...emitter,radius:150});
  else if(['decor-16-07','decor-16-08','decor-16-09','decor-16-10','decor-16-13','decor-16-14'].includes(o.asset))windowLight(.5,.47,145,.92);
  else if(o.asset==='music-square'){
   // Baked lamp flames, rather than the pillar feet, are the light emitters.
   for(const[u,v,base]of [[139/1536,90/1024,260/1024],[1393/1536,90/1024,260/1024],[126/1536,728/1024,935/1024],[1403/1536,728/1024,935/1024]]){
    const head=imagePoint(doc,o,a,u,v),foot=imagePoint(doc,o,a,u,base);
    if(head&&foot)lights.push({...head,gx:foot.x,gy:foot.y,radius:320*scale,power:1,kind:'lamp'});
   }
  }else if(o.asset==='coda-residences'){
   for(let row=0;row<13;row++)for(const[col,u]of [.207,.348,.501,.657,.808].entries())if(hash(row+17,col+9)>.22)windowLight(u,.158+row*.0564,77,.76+hash(row,col)*.17);
   for(const u of [.202,.348,.5,.656,.808])windowLight(u,.922,115,.95);
   const door=imagePoint(doc,o,a,.5,.989);if(door)lights.push({...door,gx:door.x,gy:door.y+55*scale,radius:330*scale,power:.9,kind:'door'});
  }else if(o.asset==='coda-furnishings'){
   for(const u of [.317,.501,.687])windowLight(u,.474,178,.88);
   for(const u of [.175,.315,.501,.674,.824])windowLight(u,.851,145,.94);
   for(const u of [.082,.393,.609,.918])lamp(u,.794,265,.85);
   const door=imagePoint(doc,o,a,.501,.967);if(door)lights.push({...door,gx:door.x,gy:door.y+45*scale,radius:340*scale,power:.95,kind:'door'});
  }else if(o.asset==='props-4-960'){
   // The native gazebo has four hanging lamps, a lit cupola and a string of
   // small bulbs under its eaves. Use their actual visible glass positions.
   for(const[u,v]of [[.09,.455],[.31,.486],[.69,.486],[.91,.455]])lamp(u,v,285,.87);
   for(const[u,v]of [[.40,.15],[.50,.154],[.60,.15],[.22,.468],[.40,.477],[.50,.482],[.60,.477],[.78,.468]])windowLight(u,v,120,.9);
  }else if(o.asset.startsWith('estate-')){
   for(const emitter of artworkLights(a,'warm'))authored(emitter);
   // Yard lamps remain part of the native estate art, rather than extra props.
   for(const u of [.12,.88])lamp(u,.73,220,.72);
  }else if(o.asset.startsWith('house-')){
   for(const emitter of artworkLights(a,'warm'))authored(emitter);
  }else if(o.asset==='coda-arcade'&&a.door){
   for(const emitter of artworkLights(a,'neon'))authored(emitter);
   const point=imagePoint(doc,o,a,a.door.x/a.w,a.door.y/a.h);if(point)lights.push({...point,gx:point.x,gy:point.y+40*scale,radius:300*scale,power:.9,kind:'door'});
  }
 }
 return lights;
}

function radial(c,x,y,rx,ry,stops){
 if(rx<.1||ry<.1)return;
 const key=stops.map(([at,color])=>at+':'+color).join('|');let brush=radialBrushes.get(key);
 if(!brush){
  // Canonical soft fields are independent of camera position and ellipse
  // size. Reusing their pixels avoids re-rasterizing every neon gradient on
  // each pan, while the source artwork itself keeps its native pixel grid.
  brush=document.createElement('canvas');brush.width=brush.height=128;const g=brush.getContext('2d'),gradient=g.createRadialGradient(64,64,0,64,64,64);
  for(const[at,color]of stops)gradient.addColorStop(at,color);g.fillStyle=gradient;g.fillRect(0,0,128,128);
  if(radialBrushes.size>=256)radialBrushes.delete(radialBrushes.keys().next().value);radialBrushes.set(key,brush);
 }
 c.drawImage(brush,x-rx,y-ry,rx*2,ry*2);
}
const tint=(l,alpha,fallback=[255,191,105])=>`rgba(${(l.color||fallback).join(',')},${alpha})`;
function upwardBeam(c,p,l,zoom,mask=false){
 const H=l.beamHeight*zoom*(mask?1:1.25),W=l.beamWidth*zoom*(mask?1:1.65),P=l.power;
 const color=alpha=>mask?`rgba(0,0,0,${alpha})`:tint(l,alpha);
 // Overlapping soft ellipses widen upward from the small fixture. No hard
 // triangle edge crosses the building or a tree illuminated behind it.
 for(const [up,width,depth,power]of [[.1,.15,.2,.44],[.3,.3,.34,.27],[.6,.48,.39,.13]]){
  radial(c,p.x,p.y-H*up,W*width,H*depth,[[0,color(P*power)],[.35,color(P*power*.7)],[1,color(0)]]);
 }
}
function canvasFor(c,w,h){
 if(!buffers.has(c)){const canvas=document.createElement('canvas'),bloom=document.createElement('canvas');buffers.set(c,{canvas,ctx:canvas.getContext('2d'),bloom,bloomCtx:bloom.getContext('2d'),key:null});}
 const value=buffers.get(c),width=Math.max(1,Math.ceil(w)),height=Math.max(1,Math.ceil(h));
 if(value.canvas.width!==width||value.canvas.height!==height){value.canvas.width=value.bloom.width=width;value.canvas.height=value.bloom.height=height;value.key=null;}return value;
}
function projected(p,cam,w,h){return {x:(p.x-cam.x)*cam.zoom+w/2,y:(p.y-cam.y)*cam.zoom+h/2};}
// Bloom extends beyond the illuminated ground. Include both positions and an
// uplight's full beam so lights do not blink out when their fixture leaves view.
export function cityLightBounds(l){
 const r=l.radius*1.55,xs=[l.x-r,l.x+r],ys=[l.y-r,l.y+r];
 if(Number.isFinite(l.gx)&&Number.isFinite(l.gy)){xs.push(l.gx-r,l.gx+r);ys.push(l.gy-r,l.gy+r);}
 if(l.kind==='uplight'){
  const halfWidth=(l.beamWidth||0)*1.65/2;
  xs.push(l.x-halfWidth,l.x+halfWidth);ys.push(l.y-(l.beamHeight||0)*1.25);
 }
 const x=Math.min(...xs),y=Math.min(...ys);return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
export function cityLightVisible(l,cam,w,h){
 const b=cityLightBounds(l),left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom;
 return b.x+b.w>=left&&b.x<=left+w/cam.zoom&&b.y+b.h>=top&&b.y<=top+h/cam.zoom;
}

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
const spline=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
const offset=(seed,index,axis)=>(hash(seed*65536+axis*977,index*31337)-.5)*2;
// Each insect follows its own small curved flights, pauses to hover, then
// chooses another heading. Smooth joins avoid teleports and mechanical orbits.
export function fireflyPose(x,y,seed,time=0,still=false){
 const t=still?0:time,phase=seed*TAU,period=5.2+seed*3.1,clock=t/period+seed*13,index=Math.floor(clock),part=clock-index;
 const hover=.16+hash(seed*8192,index)*.24,u=smooth((part-hover)/(1-hover)),reach=55+seed*60;
 const path=axis=>spline(offset(seed,index-1,axis),offset(seed,index,axis),offset(seed,index+1,axis),offset(seed,index+2,axis),u)*reach;
 const X=x+path(0)+Math.sin(t*2.2+phase)*1.7+Math.sin(t*.6+phase)*2.5;
 const Y=y+path(1)+Math.sin(t*1.9+phase)*2+Math.sin(t*.73+phase)*5;
 const cycle=3.7+seed*3,flash=(t/cycle+seed*4.81)%1;
 const envelope=(at,strength=1)=>smooth((flash-at)/.045)*(1-smooth((flash-at-.045)/.23))*strength;
 const alpha=still?.62:.025+.975*Math.min(1,envelope(.12)+(seed>.55?envelope(.55,.55):0));
 return {x:X,y:Y,alpha,size:2.8+seed*1.5,glowRadius:48+seed*18,lift:28+seed*24};
}

// Sparse world-anchored clusters do not scroll with the camera. Gardens get
// extra fireflies; ordinary grassy verges still have a little night life.
export function cityFireflies(doc,catalog,cam,w,h,time=0){
 const particles=[],spacing=320,left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom,still=reduced();
 const add=(x,y,seed,id)=>{
  if(particles.length>=56)return;const pose=fireflyPose(x,y,seed,time,still);
  // A flight keeps its altitude over its home patch instead of jumping when
  // its smooth path crosses a discrete terrain-level boundary.
  particles.push({...pose,id,y:pose.y-height(doc,x,y)-pose.lift});
 };
 for(let gy=Math.floor(top/spacing)-1;gy<=Math.ceil((top+h/cam.zoom)/spacing)&&particles.length<40;gy++)for(let gx=Math.floor(left/spacing)-1;gx<=Math.ceil((left+w/cam.zoom)/spacing)&&particles.length<40;gx++){
  const seed=hash(gx,gy);if(seed>.69)continue;const x=(gx+.14+seed*.7)*spacing,y=(gy+.12+hash(gy,gx+31)*.76)*spacing;
  if(x<0||y<0||x>16384||y>12288)continue;const material=surfaceAt(doc,x,y);if(!['grass','sand','water','dirt'].includes(material))continue;add(x,y,seed,`verge-${gx}-${gy}`);
 }
 for(const o of doc.objects||[]){
  const a=catalog?.get(o.asset);if(!a||!['trees','foliage and rocks','garden pots','overgrowth','home estates'].includes(a.group))continue;
  if(Math.abs(o.x-cam.x)>w/2/cam.zoom+400||Math.abs(o.y-cam.y)>h/2/cam.zoom+400)continue;
  for(let i=0;i<3&&particles.length<56;i++){const seed=hash(o.x+i*71,o.y+17),spread=Math.min(a.w*.35,240)*(o.scale||1);add(o.x+(seed-.5)*spread*2,o.y-70+(hash(o.y,i+13)-.5)*spread,seed,`garden-${o.id??o.x+'-'+o.y}-${i}`);}
 }
 return particles;
}

// The renderer calls this with its original screen transform. Cached native
// screen fields preserve soft bloom without resampling the pixel artwork.
export function renderCityNight(c,doc,cam,w,h,time=0,{catalog,objects}={}){
 const pad=128,fieldW=w+pad*2,fieldH=h+pad*2,buffer=canvasFor(c,fieldW,fieldH),{canvas,ctx:m,bloom,bloomCtx:b}=buffer,sx=canvas.width/fieldW,sy=canvas.height/fieldH,lights=cityLights(doc,catalog,objects);
 const key=[w,h,cam.zoom,...lights.flatMap(l=>[l.x,l.y,l.gx,l.gy,l.radius,l.power,l.kind,l.color?.join(','),l.beamHeight,l.beamWidth])].join(':');
 // The extra border lets walking and small editor pans reuse the same soft
 // field. Only its crop moves; gradients rebuild after a larger pan, zoom,
 // or a real light edit. Fireflies are still drawn at their live world points.
 if(buffer.key!==key||!buffer.cam||Math.abs((cam.x-buffer.cam.x)*cam.zoom)>pad||Math.abs((cam.y-buffer.cam.y)*cam.zoom)>pad){
 buffer.cam={...cam};const fieldCam=buffer.cam,visible=lights.filter(l=>cityLightVisible(l,fieldCam,fieldW,fieldH));
 m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='source-over';m.clearRect(0,0,canvas.width,canvas.height);m.fillStyle='rgba(9,19,43,.64)';m.fillRect(0,0,canvas.width,canvas.height);
 m.globalCompositeOperation='destination-out';
 for(const l of visible){
  const p=projected(l,fieldCam,fieldW,fieldH),power=l.power,r=l.radius*cam.zoom;
  if(l.kind==='uplight'){
   m.save();m.scale(sx,sy);upwardBeam(m,p,l,cam.zoom,true);m.restore();
   radial(m,p.x*sx,p.y*sy,r*.18*sx,r*.12*sy,[[0,'rgba(0,0,0,.9)'],[1,'rgba(0,0,0,0)']]);
  }else if(l.kind==='window'||l.kind==='neon')radial(m,p.x*sx,p.y*sy,r*sx,r*.8*sy,[[0,`rgba(0,0,0,${Math.min(1,power)})`],[.36,`rgba(0,0,0,${power*.72})`],[1,'rgba(0,0,0,0)']]);
  else{
   const floor=projected({x:l.gx,y:l.gy},fieldCam,fieldW,fieldH);
   radial(m,floor.x*sx,floor.y*sy,r*sx,r*.7*sy,[[0,`rgba(0,0,0,${power*.94})`],[.28,`rgba(0,0,0,${power*.85})`],[.63,`rgba(0,0,0,${power*.35})`],[1,'rgba(0,0,0,0)']]);
   radial(m,p.x*sx,p.y*sy,r*.36*sx,r*.38*sy,[[0,'rgba(0,0,0,.96)'],[.35,'rgba(0,0,0,.8)'],[1,'rgba(0,0,0,0)']]);
  }
 }
 // Bloom is added separately from illumination, preserving the detailed stone,
 // leaves and character pixels beneath the pools of warm light.
 b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,bloom.width,bloom.height);b.setTransform(sx,0,0,sy,0,0);b.globalCompositeOperation='screen';
 for(const l of visible){
  const p=projected(l,fieldCam,fieldW,fieldH),r=l.radius*cam.zoom;
  if(l.kind==='uplight'){
   upwardBeam(b,p,l,cam.zoom);
   radial(b,p.x,p.y,r*.26,r*.14,[[0,tint(l,.58)],[.2,tint(l,.26)],[1,tint(l,0)]]);
  }else if(l.kind==='neon'){
   radial(b,p.x,p.y,r*1.55,r*1.12,[[0,tint(l,.48*l.power)],[.18,tint(l,.24*l.power)],[.5,tint(l,.07*l.power)],[1,tint(l,0)]]);
   radial(b,p.x,p.y,r*.12,r*.09,[[0,tint(l,.78)],[.3,tint(l,.35)],[1,tint(l,0)]]);
  }else if(l.kind==='window')radial(b,p.x,p.y,r*1.35,r*1.02,[[0,tint(l,.16*l.power,[255,181,89])],[.45,tint(l,.045,[238,146,62])],[1,tint(l,0)]]);
  else{
   const floor=projected({x:l.gx,y:l.gy},fieldCam,fieldW,fieldH);
   radial(b,floor.x,floor.y,r*1.25,r*.78,[[0,tint(l,.16*l.power)],[.4,tint(l,.06,[245,174,88])],[1,tint(l,0)]]);
   radial(b,p.x,p.y,r*1.55,r*1.4,[[0,tint(l,.075,[255,222,162])],[.3,tint(l,.035,[255,204,124])],[1,tint(l,0)]]);
   radial(b,p.x,p.y,r*.68,r*.74,[[0,tint(l,.55,[255,222,162])],[.1,tint(l,.23,[255,204,124])],[.4,tint(l,.065,[255,181,83])],[1,tint(l,0)]]);
   if(l.kind==='lamp')radial(b,p.x,p.y,Math.max(2,4*cam.zoom),Math.max(2,5*cam.zoom),[[0,tint(l,.9,[255,245,211])],[.45,tint(l,.6,[255,226,158])],[1,tint(l,0)]]);
  }
 }
 buffer.key=key;
 }
 const cropX=Math.round((pad+(cam.x-buffer.cam.x)*cam.zoom)*sx),cropY=Math.round((pad+(cam.y-buffer.cam.y)*cam.zoom)*sy);
 c.save();c.imageSmoothingEnabled=true;c.globalCompositeOperation='source-over';c.drawImage(canvas,cropX,cropY,w*sx,h*sy,0,0,w,h);c.globalCompositeOperation='screen';c.drawImage(bloom,cropX,cropY,w*sx,h*sy,0,0,w,h);
 const baseAlpha=c.globalAlpha;
 for(const f of cityFireflies(doc,catalog,cam,w,h,time)){
  const p=projected(f,cam,w,h),r=Math.max(6,f.glowRadius*cam.zoom);
  if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
  // Only opacity and fill colour change per particle. The outer state save
  // already protects the caller; repeated native saves add no visual effect.
  c.globalAlpha=baseAlpha*f.alpha;radial(c,p.x,p.y,r,r,[[0,'rgba(222,248,149,.34)'],[.2,'rgba(199,237,112,.17)'],[.55,'rgba(179,225,103,.045)'],[1,'rgba(179,225,103,0)']]);
  c.fillStyle='rgba(234,255,173,.92)';const size=Math.max(1.5,f.size*cam.zoom);c.fillRect(Math.round(p.x-size/2),Math.round(p.y-size/2),size,size);
 }
 c.restore();
}
