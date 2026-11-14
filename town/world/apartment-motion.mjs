// Tiny foreground animations sit inside the authored glass/screen masks. The
// native furniture PNG remains untouched, including its frame and highlights.
export const APARTMENT_MOTION_FPS=8;
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),wrap=(n,m)=>((n%m)+m)%m;
let motionQuery;
const prefersReducedMotion=()=>globalThis.matchMedia?(motionQuery??=globalThis.matchMedia('(prefers-reduced-motion: reduce)')).matches===true:false;
const hash=(x,seed=1)=>{let n=Math.imul(x+17,374761393)^seed;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;};
const stringSeed=value=>{let n=2166136261;for(const char of String(value))n=Math.imul(n^char.charCodeAt(0),16777619);return n>>>0;};
const pointInside=(x,y,polygon)=>{let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function color(value,fallback){const match=/^#([0-9a-f]{6})$/i.exec(value??'');return match?[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16)):fallback;}

export function apartmentMotionGeometry(asset){
 const motion=asset?.motion;if(!motion||!['lava','arcade'].includes(motion.kind)||!Number.isFinite(asset.w)||!Number.isFinite(asset.h)||!(asset.w>0&&asset.h>0))return null;
 let polygon=motion.mask??motion.polygon,bounds=motion.bounds;
 if(polygon!==undefined&&(!Array.isArray(polygon)||polygon.length<3||polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1))))return null;
 if(!bounds&&polygon){const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]),x=Math.min(...xs),y=Math.min(...ys);bounds=[x,y,Math.max(...xs)-x,Math.max(...ys)-y];}
 if(!Array.isArray(bounds)||bounds.length!==4||bounds.some(n=>!Number.isFinite(n))||bounds[0]<0||bounds[1]<0||bounds[2]<=0||bounds[3]<=0||bounds[0]+bounds[2]>1.000001||bounds[1]+bounds[3]>1.000001)return null;
 const [u,v,uw,vh]=bounds;
 polygon??=[[u,v],[u+uw,v],[u+uw,v+vh],[u,v+vh]];
 const x=u*asset.w,y=v*asset.h,w=uw*asset.w,h=vh*asset.h,scale=Math.min(1,128/Math.max(w,h));
 const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale)),mask=new Uint8Array(width*height);
 for(let row=0;row<height;row++)for(let col=0;col<width;col++){
  const X=u+(col+.5)/width*uw,Y=v+(row+.5)/height*vh;
  if(pointInside(X,Y,polygon))mask[row*width+col]=1;
 }
 return {x,y,w,h,width,height,mask};
}
function paint(entry,x,y,rgb,alpha=255){
 x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=entry.width||y>=entry.height||!entry.mask[y*entry.width+x])return;
 const i=(y*entry.width+x)*4,data=entry.pixels.data;data[i]=rgb[0];data[i+1]=rgb[1];data[i+2]=rgb[2];data[i+3]=alpha;
}
function rectangle(entry,x,y,w,h,rgb,alpha=255){for(let row=Math.floor(y);row<Math.ceil(y+h);row++)for(let col=Math.floor(x);col<Math.ceil(x+w);col++)paint(entry,col,row,rgb,alpha);}
function ellipse(entry,cx,cy,rx,ry,rgb,alpha){
 for(let y=Math.floor(cy-ry);y<=Math.ceil(cy+ry);y++)for(let x=Math.floor(cx-rx);x<=Math.ceil(cx+rx);x++){
  const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<=1)paint(entry,x,y,rgb,d>.78?Math.round(alpha*.7):alpha);
 }
}
function lava(entry,frame){
 const {width:w,height:h,palette,bubbles}=entry,t=frame/APARTMENT_MOTION_FPS;
 // A quiet central glow lets the PNG's glass shading and specular detail show.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(entry.mask[y*w+x])paint(entry,x,y,palette[0],entry.glow[y*w+x]);
 ellipse(entry,w*.5,h*.99,w*.42,h*.12,palette[1],170);
 for(const bubble of bubbles){
  const rise=wrap(t/bubble.period+bubble.phase,1),cy=h+bubble.ry-rise*(h+bubble.ry*2),cx=w*(.5+bubble.offset)+Math.sin(t/24*TAU+bubble.phase*TAU)*w*.085;
  ellipse(entry,cx,cy,bubble.rx,bubble.ry,palette[1],180);
  ellipse(entry,cx-bubble.rx*.2,cy-bubble.ry*.2,bubble.rx*.55,bubble.ry*.58,palette[2],125);
 }
 ellipse(entry,w*.5,h*.015,w*.32,h*.07,palette[1],145);
}
function musicNote(entry,x,y,size,rgb){
 rectangle(entry,x,y+size*.6,size*.45,size*.3,rgb);rectangle(entry,x+size*.35,y,Math.max(1,size*.12),size*.8,rgb);rectangle(entry,x+size*.4,y,size*.4,Math.max(1,size*.15),rgb);
}
function arcade(entry,frame){
 const {width:w,height:h,palette,seed}=entry,t=frame/APARTMENT_MOTION_FPS,mode=entry.game;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(entry.mask[y*w+x]){
  const i=(y*w+x)*4,data=entry.pixels.data,shade=y%3===0?.83:1;
  data[i]=Math.round(palette[0][0]*shade);data[i+1]=Math.round(palette[0][1]*shade);data[i+2]=Math.round(palette[0][2]*shade);data[i+3]=232;
 }
 // Theme-seeded scenery, score pips and sprites make the little games differ
 // between owners without loading or running another game inside the room.
 for(let i=0;i<9;i++){
  const x=wrap(hash(i,seed)%w-t*(mode===1?3:1),w),y=2+hash(i+31,seed)%Math.max(1,h-6);
  paint(entry,x,y,palette[3],150);
 }
 for(let i=0;i<5;i++)if((hash(i+57,seed)+Math.floor(t/2))%3)rectangle(entry,2+i*3,2,2,1,palette[2],230);
 const size=clamp(Math.floor(Math.min(w,h)/5),3,9),x=2+wrap(t*(3+seed%4)+seed%17,Math.max(1,w-size-4));
 if(mode===0){
  rectangle(entry,1,h-3,w-2,1,palette[3],210);
  const y=h-size-5-Math.max(0,Math.sin(t*2+seed%7))*h*.25;musicNote(entry,x,y,size,palette[2]);
  for(let i=0;i<3;i++)rectangle(entry,wrap(w-i*w*.35-t*4,w),h-5,2,2,palette[1],240);
 }else if(mode===1){
  const y=h*.62+Math.sin(t*1.4)*h*.12;
  rectangle(entry,x,y,size,2,palette[2]);rectangle(entry,x+size*.25,y-2,size*.45,5,palette[2]);
  rectangle(entry,wrap(x+size+frame*.7,w),y+1,2,1,palette[1]);
  musicNote(entry,w*.72,4+wrap(t*2,h*.5),Math.max(3,size-2),palette[3]);
 }else if(mode===2){
  for(let lane=0;lane<4;lane++){
   const lx=2+lane*(w-4)/4;rectangle(entry,lx,h-4,Math.max(2,(w-8)/4),1,palette[3],210);
   const yy=wrap(t*(4+lane*.4)+hash(lane,seed)%h,Math.max(1,h-5));
   rectangle(entry,lx,yy,Math.max(2,(w-10)/4),2,lane%2?palette[1]:palette[2],240);
  }
 }else{
  for(let i=0;i<5;i++)rectangle(entry,i*w/5,h-3-(hash(i+19,seed)%Math.max(2,Math.floor(h*.25))),w/5-1,Math.max(2,h*.3),palette[3],170);
  musicNote(entry,x,h*.4+Math.sin(t*2)*h*.14,size,palette[2]);
  rectangle(entry,wrap(w-t*2,w),h*.25,2,2,palette[1]);
 }
}

export function createApartmentMotionRenderer({
 createCanvas=()=>globalThis.document?.createElement('canvas'),maxEntries=48,maxPixels=196608,
 createPath=()=>typeof Path2D==='function'?new Path2D():null,
 reducedMotion=prefersReducedMotion
}={}){
 const entries=new Map();let totalPixels=0,generatedFrames=0;
 const entryLimit=Math.max(1,Math.floor(maxEntries)),pixelLimit=Math.max(1,Math.floor(maxPixels));
 function remove(key){const entry=entries.get(key);if(!entry)return;totalPixels-=entry.width*entry.height;entries.delete(key);entry.canvas.width=entry.canvas.height=1;}
 function entryFor(asset){
  let entry=entries.get(asset);
  if(entry&&entry.motion===asset.motion&&entry.assetWidth===asset.w&&entry.assetHeight===asset.h){entries.delete(asset);entries.set(asset,entry);return entry;}
  if(entry)remove(asset);
  const geometry=apartmentMotionGeometry(asset);if(!geometry||geometry.width*geometry.height>pixelLimit)return null;
  while(entries.size>=entryLimit||totalPixels+geometry.width*geometry.height>pixelLimit)remove(entries.keys().next().value);
  const canvas=createCanvas();if(!canvas)return null;canvas.width=geometry.width;canvas.height=geometry.height;
  const c=canvas.getContext('2d');if(!c)return null;
  const motion=asset.motion,seed=stringSeed(motion.seed??asset.id??'apartment'),palette=motion.kind==='lava'?
   [color(motion.palette?.[0],[110,80,178]),color(motion.palette?.[1],[213,100,192]),color(motion.palette?.[2],[255,191,222]),color(motion.palette?.[3],[105,53,143])]:
   [color(motion.palette?.[0],[18,29,49]),color(motion.palette?.[1],[102,198,193]),color(motion.palette?.[2],[255,219,127]),color(motion.palette?.[3],[115,123,192])];
  const clipPath=createPath();
  if(clipPath){
   const [u,v,uw,vh]=motion.bounds??[geometry.x/asset.w,geometry.y/asset.h,geometry.w/asset.w,geometry.h/asset.h];
   const polygon=motion.mask??motion.polygon??[[u,v],[u+uw,v],[u+uw,v+vh],[u,v+vh]];
   for(let index=0;index<polygon.length;index++){const point=polygon[index];clipPath[index?'lineTo':'moveTo'](point[0]*asset.w,point[1]*asset.h);}clipPath.closePath();
  }
  entry={...geometry,canvas,c,clipPath,pixels:c.createImageData(geometry.width,geometry.height),motion,assetWidth:asset.w,assetHeight:asset.h,seed,palette,game:stringSeed(motion.game??seed)%4,index:-1,bubbles:[],glow:new Uint8Array(geometry.width*geometry.height)};
  for(let i=0;i<5;i++)entry.bubbles.push({phase:hash(i,seed)/4294967296,period:24,offset:(hash(i+11,seed)/4294967296-.5)*.34,rx:Math.max(1.5,geometry.width*(.12+hash(i+23,seed)/4294967296*.07)),ry:Math.max(2,geometry.height*(.055+hash(i+37,seed)/4294967296*.035))});
  for(let y=0;y<entry.height;y++)for(let x=0;x<entry.width;x++)entry.glow[y*entry.width+x]=Math.round(9+15*(1-Math.abs((x+.5)/entry.width*2-1)));
  entries.set(asset,entry);totalPixels+=entry.width*entry.height;return entry;
 }
 return {
  draw(c,asset,item,time=0){
   if(!asset?.motion||!c||!item||reducedMotion())return false;
   const scale=Number.isFinite(item.scale)&&item.scale>0?item.scale:1,w=item.w||asset.w*scale,h=item.h||w*asset.h/asset.w;
   if(!(w>0&&h>0&&Number.isFinite(item.x)&&Number.isFinite(item.y)))return false;
   const entry=entryFor(asset);if(!entry)return false;
   const period=entry.motion.kind==='lava'?24:16,index=wrap(Math.floor((Number.isFinite(time)?time:0)*APARTMENT_MOTION_FPS),period*APARTMENT_MOTION_FPS);
   if(index!==entry.index){entry.pixels.data.fill(0);(entry.motion.kind==='lava'?lava:arcade)(entry,index);entry.c.putImageData(entry.pixels,0,0);entry.index=index;generatedFrames++;}
   // A sampled animation cell can straddle a slanted glass edge even when
   // its centre lies inside. Clip the final scaled image to the authored
   // polygon, using one cached path per bounded entry rather than per frame.
   if(entry.clipPath&&c.save&&c.restore&&c.translate&&c.scale&&c.clip){
    c.save();
    try{c.translate(item.x-w/2,item.y-h);c.scale(w/asset.w,h/asset.h);c.clip(entry.clipPath);c.imageSmoothingEnabled=false;c.drawImage(entry.canvas,entry.x,entry.y,entry.w,entry.h);}
    finally{c.restore();}
   }else{
    const smoothing=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
    try{c.drawImage(entry.canvas,item.x-w/2+entry.x/asset.w*w,item.y-h+entry.y/asset.h*h,entry.w/asset.w*w,entry.h/asset.h*h);}
    finally{c.imageSmoothingEnabled=smoothing;}
   }
   return true;
  },
  clear(){for(const key of entries.keys())remove(key);},
  get stats(){return {entries:entries.size,pixels:totalPixels,generatedFrames,maxEntries:entryLimit,maxPixels:pixelLimit};}
 };
}
const shared=createApartmentMotionRenderer();
export const drawApartmentMotion=(c,asset,item,time=0)=>shared.draw(c,asset,item,time);
export const clearApartmentMotionCache=()=>shared.clear();
export const getApartmentMotionStats=()=>shared.stats;
