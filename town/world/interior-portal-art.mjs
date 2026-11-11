// Portal art is a projection of existing door definitions. It owns no timers,
// interaction state, collision, scene routing, or saved data.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(Number(n))?Number(n):fallback;
const unit=n=>Math.abs(n)<1e-8?0:n;
const openValue=n=>clamp(finite(n),0,1);
const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():null;
const mix=(a,b,t)=>{
 const aa=hex(a)||'#765941',bb=hex(b)||'#765941';
 return '#'+[1,3,5].map(i=>Math.round(parseInt(aa.slice(i,i+2),16)*(1-t)+parseInt(bb.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
};
const pixel=(c,x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(Math.round(p.x),Math.round(p.y)):c.moveTo(Math.round(p.x),Math.round(p.y)));c.closePath();c.fill();}
const seedOf=s=>{let n=2166136261;for(const a of String(s))n=Math.imul(n^a.charCodeAt(0),16777619);return n>>>0;};
const noise=(seed,x,y)=>(Math.imul(x+17,73856093)^Math.imul(y+31,19349663)^seed)>>>0;

export const PORTAL_ART_LIMITS=Object.freeze({entries:48,pixels:2*1024*1024,palettes:48});
export const COMMON_PORTAL_PALETTE=Object.freeze({frame:'#4a3930',trim:'#ad8952',light:'#d1b77a',metal:'#566363',dark:'#18242a',ivory:'#d9cfb7',accent:'#304e50'});

let authoredMaterial=null,authoredPromise=null,materialRevision=0;
export const interiorPortalArtReady=()=>Boolean(authoredMaterial);
export function warmInteriorPortalArt(){
 if(authoredPromise)return authoredPromise;
 const url=new URL('../assets/interiors/portal-materials-0af76c98c1c1.webp',import.meta.url);
 authoredPromise=fetch(url).then(response=>{if(!response.ok)throw Error('Portal materials could not load.');return response.blob();}).then(async blob=>{
  if(typeof createImageBitmap==='function')return createImageBitmap(blob);
  const objectURL=URL.createObjectURL(blob);
  try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=async()=>{try{if(image.decode)await image.decode();resolve(image);}catch(error){reject(error);}};image.onerror=()=>reject(Error('Portal materials could not decode.'));image.src=objectURL;});}
  finally{URL.revokeObjectURL(objectURL);}
 }).then(image=>{authoredMaterial=image;materialRevision++;});
 return authoredPromise;
}
// A single shared native atlas supplies grain. It is sampled only while a
// bounded leaf/frame texture is built; animation reuses those same textures.
function material(c,index,r,tint=null,shade=null){
 if(!authoredMaterial||r.w<1||r.h<1)return false;
 const cw=authoredMaterial.width/2,ch=authoredMaterial.height/3,sw=Math.min(cw-8,Math.max(48,r.w*2)),sh=Math.min(ch-8,Math.max(64,r.h*2));
 const sx=(index%2)*cw+(cw-sw)/2,sy=Math.floor(index/2)*ch+(ch-sh)/2;
 c.save();c.drawImage(authoredMaterial,sx,sy,sw,sh,Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h));
 if(tint){c.globalCompositeOperation='color';c.globalAlpha=.58;pixel(c,r.x,r.y,r.w,r.h,tint);c.globalAlpha=1;c.globalCompositeOperation='source-over';}
 if(shade)pixel(c,r.x,r.y,r.w,r.h,shade);c.restore();return true;
}

function paletteFor(d,options,palettes){
 const p=options.palette||{},theme=String(options.theme||d.showroomId||d.id||''),metal=options.material==='metal'||d.material==='metal'||/cyberpunk|retrofuture|robot|industrial/.test(theme),color=hex(options.color)||hex(d.color)||'#876348',trim=hex(p.trim)||hex(d.trim)||COMMON_PORTAL_PALETTE.trim;
 const key=[metal,color,trim,p.frame,p.metal,p.ivory,p.light,p.dark].join('|');
 if(palettes.has(key)){const value=palettes.get(key);palettes.delete(key);palettes.set(key,value);return value;}
 const frame=hex(p.frame)||COMMON_PORTAL_PALETTE.frame;
 const leaf=metal?mix(hex(p.metal)||'#647375',color,.16):mix('#866344',color,.52);
 const value={frame,frameDark:mix(frame,'#111820',.48),frameLight:mix(frame,'#c9aa77',.34),trim,light:hex(p.light)||mix(trim,'#f4e1b2',.5),ivory:hex(p.ivory)||COMMON_PORTAL_PALETTE.ivory,leaf,leafDark:mix(leaf,'#1c2428',.42),leafLight:mix(leaf,'#e5c994',.28),metal:hex(p.metal)||COMMON_PORTAL_PALETTE.metal,dark:hex(p.dark)||COMMON_PORTAL_PALETTE.dark,metallic:metal,key};
 palettes.set(key,value);while(palettes.size>PORTAL_ART_LIMITS.palettes)palettes.delete(palettes.keys().next().value);return value;
}

// These are the existing swing conventions used by automatic privacy doors:
// a start hinge closes toward +length, an end hinge toward -length, and swing
// chooses the room into which the leaf opens. Private rooms are seen from
// above: the visible door is its narrow top edge, never an upright facade.
export function getPrivacyDoorVisualGeometry(d,openness=0){
 const vertical=d.axis==='vertical',length=Math.max(24,finite(d.length,104)),end=d.hinge==='end',hinge=end?length-5:5,span=Math.max(14,length-10),open=openValue(openness),swing=d.swing===-1?-1:1;
 const angle=(end?-1:1)*Math.PI/2*(1-open),co=unit(Math.cos(angle)),si=unit(Math.sin(angle));
 const at=vertical?{x:finite(d.x),y:finite(d.y)+hinge}:{x:finite(d.x)+hinge,y:finite(d.y)};
 const vector=vertical?{x:swing*co,y:si}:{x:si,y:-swing*co};
 const height=8;
 const tip={x:at.x+vector.x*span,y:at.y+vector.y*span};
 return {kind:'top-down',privacy:true,vertical,length,span,height,openness:open,hinge:at,vector,tip,depth:Math.max(at.y,tip.y),gapStart:vertical?{x:finite(d.x),y:finite(d.y)+5}:{x:finite(d.x)+5,y:finite(d.y)},gapEnd:vertical?{x:finite(d.x),y:finite(d.y)+length-5}:{x:finite(d.x)+length-5,y:finite(d.y)}};
}

export function getDoorVisualGeometry(d,openness=0){
 if(d.axis==='vertical'||d.axis==='horizontal')return getPrivacyDoorVisualGeometry(d,openness);
 if(d.facing==='left'||d.facing==='right'){
  const at=d.threshold||{x:finite(d.x),y:finite(d.floorY,finite(d.y)+finite(d.h)/2)},length=Math.max(24,finite(d.triggerHalfWidth,64)*2);
  return getPrivacyDoorVisualGeometry({...d,axis:'vertical',x:at.x,y:at.y-length/2,length,swing:d.facing==='right'?-1:1,visualHeight:finite(d.visualHeight,clamp(finite(d.h,190)*.78,104,164))},openness);
 }
 const floorY=finite(d.threshold?.y,finite(d.floorY,finite(d.y)+finite(d.h,190))),x=finite(d.threshold?.x,finite(d.x)),span=Math.max(32,Math.min(finite(d.w,156)-24,finite(d.triggerHalfWidth,(finite(d.w,156)-24)/2)*2));
 const height=Math.max(80,finite(d.h,190)-20),end=d.hinge==='end',sign=end?-1:1,normal=finite(d.enterNormal?.y,d.facing==='up'?1:-1),swing=d.swing===-1?-1:d.swing===1?1:normal<0?-1:1,open=openValue(openness),angle=open*Math.PI/2;
 const hinge={x:x-sign*span/2,y:floorY},vector={x:sign*unit(Math.cos(angle)),y:swing*unit(Math.sin(angle))};
 return {kind:'front',privacy:false,span,height,openness:open,hinge,vector,tip:{x:hinge.x+vector.x*span,y:floorY+vector.y*span},depth:floorY,opening:{x:x-span/2,y:floorY-height,w:span,h:height},floorY};
}

export const interiorPortalVisualDepth=(d,openness=0)=>getDoorVisualGeometry(d,openness).depth;

export function getElevatorVisualGeometry(e){
 const w=Math.max(100,finite(e.w,224)),floorY=finite(e.y)+finite(e.h,180),height=clamp(w*1.03,206,264),openingW=w-40,openingH=height-44;
 return {x:finite(e.x),floorY,w,height,opening:{x:finite(e.x)+20,y:floorY-openingH,w:openingW,h:openingH},bounds:{x:finite(e.x)-18,y:floorY-height-10,w:w+72,h:height+30}};
}

const GLYPHS={
 '0':['01110','11011','11011','11011','11011','11011','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00110','01000','10000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],'-':['00000','00000','00000','11111','00000','00000','00000'],' ':['00000','00000','00000','00000','00000','00000','00000']
};
function pixelText(c,text,cx,y,color,scale=1){const value=String(text||'').toUpperCase(),width=Math.max(0,value.length*6-1)*scale;let x=Math.round(cx-width/2);for(const char of value){const glyph=GLYPHS[char]||GLYPHS['-'];for(let yy=0;yy<7;yy++)for(let xx=0;xx<5;xx++)if(glyph[yy][xx]==='1')pixel(c,x+xx*scale,y+yy*scale,scale,scale,color);x+=6*scale;}}

function grain(c,r,p,seed,metal=false){
 const dark=metal?mix(p.metal,p.dark,.22):p.leafDark,light=metal?mix(p.metal,p.ivory,.22):p.leafLight;
 for(let y=Math.ceil(r.y)+3;y<r.y+r.h-3;y+=7)for(let x=Math.ceil(r.x)+3;x<r.x+r.w-3;x+=7){const n=noise(seed,x,y);if(n%5===0)pixel(c,x,y,1,Math.min(3+n%9,r.y+r.h-y-2),n%3?dark:light);}
}
function recessedPanel(c,r,p,seed,glass=false){
 pixel(c,r.x,r.y,r.w,r.h,p.leafDark);pixel(c,r.x+2,r.y+2,r.w-4,r.h-4,p.leafLight);pixel(c,r.x+4,r.y+5,r.w-8,r.h-9,glass?'#809a98':mix(p.leaf,p.leafDark,.18));
 const textured=material(c,glass?4:p.metallic?3:0,{x:r.x+5,y:r.y+6,w:r.w-10,h:r.h-12},glass?'#96bcb2':p.leaf,glass?'#213b3922':'#10191e26');
 pixel(c,r.x+5,r.y+6,r.w-10,1,glass?'#c5d6c6':p.leafLight);pixel(c,r.x+r.w-5,r.y+6,1,r.h-12,p.leafDark);pixel(c,r.x+5,r.y+r.h-5,r.w-10,1,p.leafDark);
 if(glass){for(let y=r.y+10;y<r.y+r.h-7;y+=5)pixel(c,r.x+8,y,r.w-16,1,y%2?'#8da8a0':'#9cb5ac');}
 else if(!textured)grain(c,{x:r.x+5,y:r.y+7,w:r.w-10,h:r.h-14},p,seed,p.metallic);
}
function paintLeaf(c,w,h,p,variant,reverseLight){
 pixel(c,0,0,w,h,p.leafDark);pixel(c,2,2,w-4,h-4,p.leaf);pixel(c,reverseLight?w-3:2,3,1,h-6,p.leafLight);pixel(c,3,2,w-6,2,p.leafLight);
 const margin=Math.max(8,Math.round(w*.085)),upperH=Math.round(h*.43),lowerY=upperH+18,seed=seedOf(p.key+variant);
 if(!material(c,p.metallic?3:0,{x:4,y:5,w:w-8,h:h-10},p.leaf))grain(c,{x:4,y:5,w:w-8,h:h-10},p,seed,p.metallic);
 if(p.metallic){
  recessedPanel(c,{x:margin,y:11,w:w-margin*2,h:h-25},p,seed,variant==='bath');
  for(let y=h*.68;y<h*.84;y+=5)pixel(c,margin+8,y,w-margin*2-16,1,p.leafDark);
 }else{
  const gap=6,panelW=(w-margin*2-gap)/2;
  recessedPanel(c,{x:margin,y:11,w:panelW,h:upperH},p,seed,variant==='bath');recessedPanel(c,{x:margin+panelW+gap,y:11,w:panelW,h:upperH},p,seed+91,variant==='bath');
  recessedPanel(c,{x:margin,y:lowerY,w:w-margin*2,h:h-lowerY-11},p,seed+31);
  pixel(c,margin,upperH+14,w-margin*2,2,p.leafLight);
 }
 for(const y of [h*.18,h*.48,h*.81]){pixel(c,0,y,5,10,p.frameDark);pixel(c,1,y+1,3,8,p.trim);pixel(c,1,y+2,1,5,p.light);}
 const handleX=w-13,handleY=Math.round(h*.55);pixel(c,handleX-3,handleY-7,8,22,p.leafDark);pixel(c,handleX-2,handleY-6,6,20,p.trim);pixel(c,handleX-1,handleY-5,1,17,p.light);pixel(c,handleX-4,handleY,9,4,p.frameDark);pixel(c,handleX-3,handleY-1,8,3,p.light);pixel(c,handleX,handleY+9,2,4,p.dark);
}
function paintFrameBack(c,w,h,p,privacy=false){
 pixel(c,8,10,w+20,h+22,'#111c2442');pixel(c,0,0,14,h+28,p.frameDark);pixel(c,w+14,0,14,h+28,p.frameDark);pixel(c,0,0,w+28,20,p.frameDark);pixel(c,0,h+20,w+28,8,p.frameDark);
 if(privacy)pixel(c,14,20,w,h,'#111c2318');
 else{pixel(c,14,20,w,h,p.dark);pixel(c,18,24,w-8,h-6,'#111c23');pixel(c,19,h+1,w-10,16,'#5b5344');for(let x=21;x<w+10;x+=12){pixel(c,x,h+4,1,12,'#87765b');pixel(c,x+1,h+5,7,1,'#b2a17e');}}
 pixel(c,14,20,5,h,p.frameDark);pixel(c,19,20,2,h,p.frameLight);pixel(c,w+8,20,6,h,'#0b141b');
}
function paintFrameTrim(c,w,h,p){
 for(const x of [0,w+15]){pixel(c,x,10,13,h+18,p.frameDark);pixel(c,x+2,11,10,h+15,p.frame);material(c,1,{x:x+3,y:12,w:7,h:h+12},p.frame);pixel(c,x+3,12,2,h+12,p.frameLight);pixel(c,x+9,13,2,h+11,p.frameDark);pixel(c,x-1,h+18,15,9,p.frameDark);pixel(c,x,h+18,13,3,p.frameLight);pixel(c,x+2,h+21,9,4,p.frame);}
 pixel(c,0,3,w+28,8,p.frameDark);pixel(c,1,4,w+26,4,p.frameLight);pixel(c,2,10,w+24,9,p.frame);pixel(c,3,10,w+22,2,p.trim);pixel(c,9,18,w+10,2,p.frameLight);
 material(c,1,{x:4,y:13,w:w+20,h:4},p.frame);material(c,2,{x:3,y:4,w:w+22,h:2},p.trim);
 pixel(c,9,h+20,w+10,8,p.frameDark);pixel(c,11,h+20,w+6,3,p.light);pixel(c,13,h+24,w+2,2,p.trim);
}

function defaultCanvas(w,h){if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(w,h);if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}return null;}

export function createInteriorPortalArt({createCanvas=defaultCanvas,maxEntries=PORTAL_ART_LIMITS.entries,maxPixels=PORTAL_ART_LIMITS.pixels}={}){
 const textures=new Map(),palettes=new Map();let pixels=0,builds=0,revision=materialRevision;
 function drop(key){const old=textures.get(key);if(!old)return;pixels-=old.width*old.height;textures.delete(key);old.width=old.height=0;}
 function texture(key,w,h,paint){
  if(revision!==materialRevision){for(const old of textures.keys())drop(old);revision=materialRevision;}
  w=Math.max(1,Math.ceil(w));h=Math.max(1,Math.ceil(h));if(w*h>maxPixels)return null;
  if(textures.has(key)){const found=textures.get(key);textures.delete(key);textures.set(key,found);return found;}
  const cv=createCanvas(w,h);if(!cv)return null;cv.width=w;cv.height=h;const cc=cv.getContext('2d');cc.imageSmoothingEnabled=false;paint(cc);builds++;textures.set(key,cv);pixels+=w*h;
  while(textures.size>Math.max(1,maxEntries)||pixels>maxPixels)drop(textures.keys().next().value);return cv;
 }
 function cached(c,key,w,h,paint,x,y){const cv=texture(key,w,h,paint);if(cv)c.drawImage(cv,Math.round(x),Math.round(y));else{c.save();c.translate(x,y);paint(c);c.restore();}}
 function palette(d,o){return paletteFor(d,o,palettes);}
 function leaf(c,g,p,variant){
  const a=g.vector.x,b=g.vector.y,at=g.hinge,span=g.span,height=g.height;
  const perpendicular={x:-b*5,y:a*5};polygon(c,[{x:at.x+5,y:at.y+7},{x:g.tip.x+5,y:g.tip.y+7},{x:g.tip.x+perpendicular.x+8,y:g.tip.y+perpendicular.y+10},{x:at.x+perpendicular.x+8,y:at.y+perpendicular.y+10}],'#10212b2b');
  if(Math.abs(a)<.018){pixel(c,at.x-3,Math.min(at.y,g.tip.y)-height,6,height+Math.abs(g.tip.y-at.y),p.leafDark);pixel(c,at.x-2,Math.min(at.y,g.tip.y)-height,2,height+Math.abs(g.tip.y-at.y),p.leafLight);return;}
  c.save();c.translate(at.x,at.y-height);c.transform(a,b,0,1,0,0);const reverse=a<0;
  const key=['leaf',Math.round(span),Math.round(height),p.key,variant,reverse].join('|');cached(c,key,span,height,cc=>paintLeaf(cc,span,height,p,variant,reverse),0,0);
  c.restore();
  const freeTop={x:g.tip.x,y:g.tip.y-height};polygon(c,[freeTop,{x:freeTop.x+3,y:freeTop.y+1},{x:g.tip.x+3,y:g.tip.y+1},g.tip],p.leafDark);
 }
 function frontFrame(c,g,p,label,variant){
  const o=g.opening,w=o.w,h=o.h,x=o.x-14,y=o.y-20;
  cached(c,['back',Math.round(w),Math.round(h),p.key,!!g.privacy].join('|'),w+38,h+38,cc=>paintFrameBack(cc,w,h,p,!!g.privacy),x,y);
  if(g.privacy)leaf(c,g,p,variant);
  else{c.save();c.beginPath();c.rect(o.x,o.y,o.w,o.h);c.clip();leaf(c,g,p,variant);c.restore();}
  cached(c,['trim',Math.round(w),Math.round(h),p.key].join('|'),w+38,h+38,cc=>paintFrameTrim(cc,w,h,p),x,y);
  if(label){const text=String(label).slice(0,6),pw=Math.max(38,text.length*12+12),ph=21,px=o.x+(w-pw)/2,py=o.y-18;
   cached(c,['plaque',text,p.trim,p.frame].join('|'),pw,ph,cc=>{pixel(cc,0,0,pw,ph,p.frameDark);pixel(cc,1,1,pw-2,ph-2,p.trim);pixel(cc,3,3,pw-6,ph-6,p.frameDark);pixelText(cc,text,pw/2,4,p.light,2);pixel(cc,2,9,1,2,p.light);pixel(cc,pw-3,9,1,2,p.light);},px,py);
  }
 }
 function privacy(c,d,openness=0,options={}){
  const g=getPrivacyDoorVisualGeometry(d,openness),p=palette(d,options),span=g.span;c.save();c.imageSmoothingEnabled=false;
  // Two short jamb caps meet the existing wall ends. The open gap shows its
  // floor and threshold; there is no tall frame covering the room behind it.
  c.save();c.translate(g.gapStart.x,g.gapStart.y);c.transform(g.vertical?0:1,g.vertical?1:0,g.vertical?-1:0,g.vertical?0:1,0,0);
  cached(c,['plan-opening',span,p.key].join('|'),span+20,20,cc=>{
   pixel(cc,10,7,span,6,p.frameDark);pixel(cc,10,8,span,3,p.ivory);pixel(cc,10,8,span,1,p.light);
   for(const x of [4,span+4]){pixel(cc,x,2,12,16,p.frameDark);pixel(cc,x+1,3,10,14,p.frame);material(cc,1,{x:x+2,y:4,w:8,h:11},p.frame);pixel(cc,x+1,3,10,2,p.trim);pixel(cc,x+2,5,1,9,p.light);}
  },-10,-10);c.restore();
  // Rotate the actual narrow leaf in the floor plane around its real hinge.
  // This is an overhead edge, with wood grain, a brass pin and a small handle.
  const {x:a,y:b}=g.vector;
  c.save();c.translate(g.hinge.x+2,g.hinge.y+3);c.transform(a,b,-b,a,0,0);pixel(c,0,-4,span,8,'#14202730');c.restore();
  c.save();c.translate(g.hinge.x,g.hinge.y);c.transform(a,b,-b,a,0,0);
  cached(c,['plan-leaf',span,p.key].join('|'),span,12,cc=>{
   pixel(cc,0,2,span,8,p.leafDark);pixel(cc,1,3,span-2,5,p.leaf);
   material(cc,p.metallic?3:0,{x:2,y:3,w:span-4,h:5},p.leaf);
   pixel(cc,1,2,span-2,1,p.leafLight);pixel(cc,3,5,span-6,1,p.leafDark);pixel(cc,1,9,span-2,1,p.frameDark);
   pixel(cc,span-12,7,6,3,p.trim);pixel(cc,span-11,7,4,1,p.light);
  },0,-6);c.restore();
  pixel(c,g.hinge.x-2,g.hinge.y-2,4,4,p.trim);pixel(c,g.hinge.x-1,g.hinge.y-1,2,2,p.light);
  c.restore();return g;
 }
 function door(c,d,openness=0,options={}){
  const g=getDoorVisualGeometry(d,openness);if(g.privacy){
   const side=d.facing==='right'?1:-1,at=d.threshold||{x:finite(d.x),y:finite(d.floorY,finite(d.y)+finite(d.h)/2)};
   const def=d.axis?d:{...d,axis:'vertical',x:at.x,y:at.y-g.length/2,length:g.length,swing:d.facing==='right'?-1:1,visualHeight:g.height};const result=privacy(c,def,openness,options);
   if(!d.axis&&d.number){const p=palette(d,options),x=at.x+side*27,y=at.y-g.height*.43;c.save();pixel(c,x-18,y-13,36,25,p.frameDark);pixel(c,x-16,y-11,32,21,p.trim);pixel(c,x-14,y-9,28,17,p.frameDark);pixelText(c,d.number,x,y-7,p.light,1);c.restore();}return result;
  }
  const p=palette(d,options);c.save();c.imageSmoothingEnabled=false;frontFrame(c,g,p,d.number||options.label||'','panel');c.restore();return g;
 }
 function paintLiftShell(c,w,h,p){
  pixel(c,9,11,w+24,h+21,'#0c192742');pixel(c,0,0,w+28,h+18,p.frameDark);pixel(c,3,3,w+22,h+12,p.trim);pixel(c,6,6,w+16,h+7,p.metal);pixel(c,7,7,3,h+5,p.light);pixel(c,w+16,8,5,h+4,p.frameDark);
  pixel(c,22,39,w-16,h-39,p.dark);pixel(c,27,44,w-26,h-47,'#263439');pixel(c,30,47,w-32,h-56,'#51605d');
  for(let x=35;x<w-8;x+=13)pixel(c,x,49,1,h-64,'#6c7972');pixel(c,32,49,w-36,3,'#c8c4a1');
  pixel(c,29,h-23,w-28,21,'#877e68');for(let x=34;x<w-6;x+=15){pixel(c,x,h-21,1,17,'#514d43');pixel(c,x+1,h-20,10,1,'#b3a88b');}
  for(const x of [0,w+14]){pixel(c,x,27,14,h-13,p.frameDark);pixel(c,x+2,28,10,h-17,p.metal);pixel(c,x+3,29,2,h-18,p.light);pixel(c,x+10,29,2,h-18,p.trim);}
  for(const x of [4,w+18])material(c,2,{x,y:30,w:5,h:h-22},p.trim,'#15212630');
  pixel(c,-3,0,w+34,8,p.frameDark);pixel(c,-1,1,w+30,3,p.light);pixel(c,2,9,w+24,25,p.frame);pixel(c,3,10,w+22,2,p.trim);pixel(c,15,32,w-2,5,p.frameDark);
  pixel(c,17,h,w-4,8,p.frameDark);pixel(c,18,h,w-6,3,p.light);for(let x=22;x<w+9;x+=8)pixel(c,x,h+4,4,1,p.metal);
 }
 function paintLiftLeaf(c,w,h,p,right){
  pixel(c,0,0,w,h,p.frameDark);pixel(c,2,1,w-4,h-3,p.metal);const base=mix(p.metal,p.ivory,.25);
  if(!material(c,3,{x:3,y:3,w:w-6,h:h-7},'#849694'))for(let x=3;x<w-3;x++){const n=noise(317+(right?91:0),x,0);pixel(c,x,3,1,h-7,n%9===0?mix(base,p.dark,.19):n%7===0?mix(base,p.ivory,.19):base);}
  pixel(c,4,4,w-8,2,p.light);pixel(c,right?3:w-5,4,2,h-8,p.frameDark);pixel(c,right?w-4:3,4,1,h-9,'#c2c9b9');
  pixel(c,9,Math.round(h*.73),w-18,2,mix(p.metal,p.dark,.25));pixel(c,10,Math.round(h*.73)+2,w-20,1,p.light);
 }
 function elevator(c,e,options={}){
  const g=getElevatorVisualGeometry(e),p=palette({color:'#526b69',material:'metal'},options),o=g.opening,open=openValue(options.openness),floor=clamp(Math.round(finite(e.floor,1)),1,Math.max(1,Math.round(finite(options.floors,15)))),floors=Math.max(1,Math.round(finite(options.floors,15)));
  const x=g.x-14,y=g.floorY-g.height,w=g.w,h=g.height;c.save();c.imageSmoothingEnabled=false;
  cached(c,['lift-shell',Math.round(w),Math.round(h),p.key].join('|'),w+42,h+34,cc=>paintLiftShell(cc,w,h,p),x,y);
  c.save();c.beginPath();c.rect(o.x,o.y,o.w,o.h);c.clip();const half=o.w/2;
  for(const right of [false,true]){const lx=right?o.x+half+open*half:o.x-open*half;cached(c,['lift-leaf',Math.round(half),Math.round(o.h),p.key,right].join('|'),half,o.h,cc=>paintLiftLeaf(cc,half,o.h,p,right),lx,o.y);}
  c.restore();pixel(c,o.x-4,o.y-2,4,o.h+4,p.frameDark);pixel(c,o.x+o.w,o.y-2,4,o.h+4,p.frameDark);pixel(c,o.x-3,o.y-1,1,o.h+3,p.light);
  const displayW=70,displayX=g.x+w/2-displayW/2,displayY=y+11;
  cached(c,['lift-display',floor,p.trim].join('|'),displayW,22,cc=>{pixel(cc,0,0,displayW,22,p.frameDark);pixel(cc,1,1,displayW-2,20,p.trim);pixel(cc,3,3,displayW-6,16,'#0b191e');pixelText(cc,String(floor).padStart(2,'0'),displayW/2,4,'#f1c877',2);pixel(cc,8,12,3,2,'#ab9c6d');pixel(cc,displayW-11,12,3,2,'#ab9c6d');},displayX,displayY);
  const panelX=g.x+w+22,panelY=g.floorY-o.h*.53;
  pixel(c,panelX,panelY,25,62,p.frameDark);pixel(c,panelX+2,panelY+2,21,58,p.trim);pixel(c,panelX+4,panelY+4,17,54,p.metal);
  for(const [dy,up]of [[12,true],[36,false]]){pixel(c,panelX+7,panelY+dy,11,12,p.frameDark);pixel(c,panelX+8,panelY+dy+1,9,10,options.active?'#d2bb84':'#9eaa9d');const yy=panelY+dy+3;for(let row=0;row<3;row++)pixel(c,panelX+12-(up?row:2-row),yy+row,1+2*(up?row:2-row),1,'#26383c');}
  pixelText(c,options.label||'CODA LIFT',g.x+w/2,y-9,p.light,1);pixelText(c,'1-'+floors,g.x+w/2,g.floorY+13,p.trim,1);
  c.restore();return {...g,openness:open,floor,floors};
 }
 return {drawInteriorDoor:door,drawPrivacyDoor:privacy,drawElevatorPortal:elevator,clear(){for(const key of textures.keys())drop(key);palettes.clear();},stats:()=>({entries:textures.size,pixels,builds,palettes:palettes.size,maxEntries,maxPixels,authored:Boolean(authoredMaterial),sourcePixels:authoredMaterial?authoredMaterial.width*authoredMaterial.height:0})};
}

const shared=createInteriorPortalArt();
export const drawInteriorDoor=(...args)=>shared.drawInteriorDoor(...args);
export const drawPrivacyDoor=(...args)=>shared.drawPrivacyDoor(...args);
export const drawElevatorPortal=(...args)=>shared.drawElevatorPortal(...args);
export const clearInteriorPortalArtCache=()=>shared.clear();
export const getInteriorPortalArtCacheStats=()=>shared.stats();
