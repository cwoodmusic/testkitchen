import {height,surfaceAt} from './model.mjs?v=music-walls-1';
import {mountPose} from './cliff-mount.mjs?v=music-walls-1';

const buffers=new WeakMap(),TAU=Math.PI*2;
const hash=(x,y=0)=>{let n=Math.imul(Math.round(x)^Math.imul(Math.round(y),374761393),668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;

// Light positions use the same image anchor, rotation and terrain elevation as
// the visible sprite. A mounted lantern therefore glows on its actual cliff.
function imagePoint(doc,o,a,u,v){
 const pose=mountPose(doc,o);if(!pose)return null;
 const angle=o.rotation*Math.PI/180,x=(u*a.w-a.w/2)*o.scale,y=(v*a.h-a.h*pose.offset)*o.scale;
 return {x:pose.x+x*Math.cos(angle)-y*Math.sin(angle),y:pose.y+x*Math.sin(angle)+y*Math.cos(angle)};
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
  if(o.asset==='props-2-65')lamp(.5,.22,310);
  else if(o.asset==='decor-14-01')lamp(.5,.22,310);
  else if(o.asset==='decor-14-02'){lamp(.27,.22,265,.88);lamp(.73,.22,265,.88);}
  else if(o.asset==='decor-14-03')lamp(.5,.2,300,.94);
  else if(o.asset==='decor-14-04')lamp(.5,.32,190,.8);
  else if(['decor-14-05','decor-14-06','decor-14-07','decor-15-12','cliff-lantern'].includes(o.asset))lamp(.5,.27,205,.88);
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
  }else if(o.asset==='coda-arcade'&&a.door){
   const point=imagePoint(doc,o,a,a.door.x/a.w,a.door.y/a.h);if(point)lights.push({...point,gx:point.x,gy:point.y+40*scale,radius:300*scale,power:.9,kind:'door'});
  }
 }
 return lights;
}

function radial(c,x,y,rx,ry,stops){
 if(rx<.1||ry<.1)return;c.save();c.translate(x,y);c.scale(rx,ry);const g=c.createRadialGradient(0,0,0,0,0,1);
 for(const[at,color]of stops)g.addColorStop(at,color);c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
}
function canvasFor(c,w,h){
 if(!buffers.has(c)){const canvas=document.createElement('canvas'),bloom=document.createElement('canvas');buffers.set(c,{canvas,ctx:canvas.getContext('2d'),bloom,bloomCtx:bloom.getContext('2d'),key:null});}
 const value=buffers.get(c),width=Math.max(1,Math.ceil(w/2)),height=Math.max(1,Math.ceil(h/2));
 if(value.canvas.width!==width||value.canvas.height!==height){value.canvas.width=value.bloom.width=width;value.canvas.height=value.bloom.height=height;value.key=null;}return value;
}
function projected(p,cam,w,h){return {x:(p.x-cam.x)*cam.zoom+w/2,y:(p.y-cam.y)*cam.zoom+h/2};}
function visibleLight(l,cam,w,h){const p=projected(l,cam,w,h),r=l.radius*cam.zoom+80;return p.x+r>=0&&p.x-r<=w&&p.y+r>=0&&p.y-r<=h;}

// Sparse world-anchored clusters do not scroll with the camera. Gardens get
// extra fireflies; ordinary grassy verges still have a little night life.
export function cityFireflies(doc,catalog,cam,w,h,time=0){
 const particles=[],spacing=320,left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom,still=reduced(),t=still?0:time;
 const add=(x,y,seed)=>{
  if(particles.length>=56)return;const phase=seed*TAU,pulse=still ? .62 : .2+.8*Math.pow((Math.sin(time*(.5+seed*.25)+phase)+1)/2,2);
  const X=x+Math.sin(t*.36+phase)*19,Y=y+Math.cos(t*.27+phase*1.6)*14;
  particles.push({x:X,y:Y-height(doc,X,Y)-28-seed*24,alpha:pulse,size:3.1+seed*1.6});
 };
 for(let gy=Math.floor(top/spacing)-1;gy<=Math.ceil((top+h/cam.zoom)/spacing)&&particles.length<40;gy++)for(let gx=Math.floor(left/spacing)-1;gx<=Math.ceil((left+w/cam.zoom)/spacing)&&particles.length<40;gx++){
  const seed=hash(gx,gy);if(seed>.69)continue;const x=(gx+.14+seed*.7)*spacing,y=(gy+.12+hash(gy,gx+31)*.76)*spacing;
  if(x<0||y<0||x>16384||y>12288)continue;const material=surfaceAt(doc,x,y);if(!['grass','sand','water','dirt'].includes(material))continue;add(x,y,seed);
 }
 for(const o of doc.objects||[]){
  const a=catalog?.get(o.asset);if(!a||!['trees','foliage and rocks','garden pots','overgrowth','home estates'].includes(a.group))continue;
  if(Math.abs(o.x-cam.x)>w/2/cam.zoom+400||Math.abs(o.y-cam.y)>h/2/cam.zoom+400)continue;
  for(let i=0;i<3&&particles.length<56;i++){const seed=hash(o.x+i*71,o.y+17),spread=Math.min(a.w*.35,240)*(o.scale||1);add(o.x+(seed-.5)*spread*2,o.y-70+(hash(o.y,i+13)-.5)*spread,seed);}
 }
 return particles;
}

// The renderer calls this with its original screen transform. The half-size
// lighting buffer gives broad, smooth bloom without blurring the pixel art.
export function renderCityNight(c,doc,cam,w,h,time=0,{catalog,objects}={}){
 const buffer=canvasFor(c,w,h),{canvas,ctx:m,bloom,bloomCtx:b}=buffer,sx=canvas.width/w,sy=canvas.height/h,lights=cityLights(doc,catalog,objects).filter(l=>visibleLight(l,cam,w,h));
 const key=[w,h,cam.x,cam.y,cam.zoom,...lights.flatMap(l=>[l.x,l.y,l.gx,l.gy,l.radius,l.power,l.kind])].join(':');
 // Street lights are steady. Reuse their expensive soft fields while editing
 // a stationary view; only fireflies need to animate each frame.
 if(buffer.key!==key){
 m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='source-over';m.clearRect(0,0,canvas.width,canvas.height);m.fillStyle='rgba(9,19,43,.64)';m.fillRect(0,0,canvas.width,canvas.height);
 m.globalCompositeOperation='destination-out';
 for(const l of lights){
  const p=projected(l,cam,w,h),power=l.power,r=l.radius*cam.zoom;
  if(l.kind==='window')radial(m,p.x*sx,p.y*sy,r*sx,r*.8*sy,[[0,`rgba(0,0,0,${power})`],[.36,`rgba(0,0,0,${power*.72})`],[1,'rgba(0,0,0,0)']]);
  else{
   const floor=projected({x:l.gx,y:l.gy},cam,w,h);
   radial(m,floor.x*sx,floor.y*sy,r*sx,r*.7*sy,[[0,`rgba(0,0,0,${power*.94})`],[.28,`rgba(0,0,0,${power*.85})`],[.63,`rgba(0,0,0,${power*.35})`],[1,'rgba(0,0,0,0)']]);
   radial(m,p.x*sx,p.y*sy,r*.36*sx,r*.38*sy,[[0,'rgba(0,0,0,.96)'],[.35,'rgba(0,0,0,.8)'],[1,'rgba(0,0,0,0)']]);
  }
 }
 // Bloom is added separately from illumination, preserving the detailed stone,
 // leaves and character pixels beneath the pools of warm light.
 b.setTransform(1,0,0,1,0,0);b.clearRect(0,0,bloom.width,bloom.height);b.setTransform(sx,0,0,sy,0,0);b.globalCompositeOperation='screen';
 for(const l of lights){
  const p=projected(l,cam,w,h),r=l.radius*cam.zoom;
  if(l.kind==='window')radial(b,p.x,p.y,r*.85,r*.64,[[0,`rgba(255,181,89,${.09*l.power})`],[.45,'rgba(238,146,62,.035)'],[1,'rgba(238,146,62,0)']]);
  else{
   const floor=projected({x:l.gx,y:l.gy},cam,w,h);
   radial(b,floor.x,floor.y,r,r*.62,[[0,`rgba(255,191,105,${.16*l.power})`],[.4,'rgba(245,174,88,.075)'],[1,'rgba(245,174,88,0)']]);
   radial(b,p.x,p.y,r*.34,r*.37,[[0,'rgba(255,222,162,.55)'],[.1,'rgba(255,204,124,.23)'],[.4,'rgba(255,181,83,.075)'],[1,'rgba(255,181,83,0)']]);
   if(l.kind==='lamp')radial(b,p.x,p.y,Math.max(2,4*cam.zoom),Math.max(2,5*cam.zoom),[[0,'rgba(255,245,211,.9)'],[.45,'rgba(255,226,158,.6)'],[1,'rgba(255,226,158,0)']]);
  }
 }
 buffer.key=key;
 }
 c.save();c.imageSmoothingEnabled=true;c.globalCompositeOperation='source-over';c.drawImage(canvas,0,0,w,h);c.globalCompositeOperation='screen';c.drawImage(bloom,0,0,w,h);
 for(const f of cityFireflies(doc,catalog,cam,w,h,time)){
  const p=projected(f,cam,w,h),r=Math.max(3,22*cam.zoom);
  if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
  radial(c,p.x,p.y,r,r,[[0,`rgba(204,244,123,${f.alpha*.24})`],[.3,`rgba(179,225,103,${f.alpha*.1})`],[1,'rgba(179,225,103,0)']]);
  c.fillStyle=`rgba(234,255,173,${f.alpha*.92})`;const size=Math.max(1.5,f.size*cam.zoom);c.fillRect(Math.round(p.x-size/2),Math.round(p.y-size/2),size,size);
 }
 c.restore();
}
