// The hall shares the Opera House lot's exact floor area. Its floor and raised
// acoustic structure are cached separately, so the camera can reveal their depth.
import {drawAcousticCeiling,drawAcousticShell,drawAcousticAirBay,drawOrganAcousticPanels} from './concert-acoustics.mjs?v=opera-parallax-1';
export const CONCERT_FOOTPRINT=Object.freeze({width:4096,height:2560});
const rect=(x,y,w,h)=>({x,y,w,h});
const zone=(id,label,x,y,w,h,action,extra={})=>({id,label,x,y,w,h,action,...extra});
const ROWS=[1370,1510,1650,1840,1980,2120,2260];
const seatColumns=[...Array.from({length:14},(_,i)=>936+i*72),...Array.from({length:14},(_,i)=>2224+i*72)];
let hall=null,background=null,overhead=null,artPromise=null;
const art=new Map();
const ART_NAMES=['audience-chair','stage-chair','organ','reflector','balcony-rail','timber-rib','door','sconce'];

/** A stable, read-only scene description, with game-sized aisles and real seats. */
export function getConcertHall(){
 if(hall)return hall;
 const {width,height}=CONCERT_FOOTPRINT;
 const stage={x:768,y:300,w:2560,h:900,performerBounds:rect(1000,420,2096,680)};
 const balconies=[rect(80,176,610,1100),rect(3406,176,610,1100)];
 const solids=[rect(0,0,width,176),rect(0,0,72,height),rect(width-72,0,72,height),rect(0,height-48,width,48),...balconies,
  // Side aprons have a physical lip; the broad center staircase remains open.
  rect(stage.x,1194,1072,54),rect(2256,1194,1072,54),
  rect(1696,176,704,184),rect(768,176,800,144),rect(2528,176,800,144),rect(766,2326,100,42)];
 const seats=[],zones=[];
 for(let row=0;row<ROWS.length;row++)for(let column=0;column<seatColumns.length;column++){
  const x=seatColumns[column],y=ROWS[row],id=`seat-${row+1}-${column+1}`;
  const seat={id,x,y,seat:{x,y:y-10},approach:{x,y:y+54},ground:{x,y},facing:'up',row,column,number:column+1};
  seats.push(seat);solids.push({...rect(x-28,y-40,56,46),seatId:id});
  zones.push(zone(id,`Sit · row ${String.fromCharCode(65+row)}, seat ${column+1}`,x-26,y+34,52,40,'concert-seat',{seatId:id}));
 }
 zones.push(zone('concert-exit','Return to Coda Town',1904,2380,288,126,'exit'),
  zone('concert-programme','Tonight’s programme',738,2352,156,128,'concert-programme'),
  zone('concert-watch','Watch the performance',1948,1264,200,100,'concert-watch'));
 const s={id:'opera-concert-hall',kind:'concert',title:'Coda Opera House · Concert Hall',width,height,color:'#824d3e',trim:'#d6ae68',
  spawn:{x:2048,y:2416},stage,solids,zones,items:[],rooms:[],walls:[],rugs:[],windows:[],signs:[],lights:[],actors:[],
  audience:{seats,balconies,aisles:[rect(1940,1248,216,1264),rect(710,1280,174,1232),rect(3212,1280,174,1232),rect(710,1702,2676,80)]},
  stairs:{x:1880,y:1200,w:336,h:100},programme:{x:816,y:2410},exit:{x:2048,y:2504}};
 // A controller keeps the current seat and actors separately; all geometry is reusable.
 hall=deepFreeze(s);return hall;
}
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;}

/** Load the original architecture props once. The Node model has no DOM dependency. */
export function prepareConcertHallArt(){
 if(artPromise)return artPromise;
 if(typeof Image==='undefined')return Promise.resolve();
 artPromise=Promise.all(ART_NAMES.map(name=>new Promise(resolve=>{
  const img=new Image();img.onload=()=>{art.set(name,img);background=null;overhead=null;resolve(img);};img.onerror=()=>resolve(null);
  img.src=new URL(`../assets/concert/hall-${name}.png`,import.meta.url).href;
 }))).then(()=>undefined);return artPromise;
}

/** The independently cached floor/architecture layer; no baked-in musicians. */
export function renderConcertHallBackground(ctx,model=getConcertHall()){
 prepareConcertHallArt();
 if(!background){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(model.width,model.height):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!canvas){drawHall(ctx,model);return;}
  canvas.width=model.width;canvas.height=model.height;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;drawHall(c,model);background=canvas;
 }
 ctx.drawImage(background,0,0);
}

const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
const overlaps=(a,b)=>a.x+a.w>b.x&&a.x<b.x+b.w&&a.y+a.h>b.y&&a.y<b.y+b.h;
const OVERHEAD_HEIGHTS=Object.freeze({roof:{rate:.30,x:72,y:36},rig:{rate:.18,x:44,y:20}});

/** Camera-relative projection only: a stationary camera never animates a roof. */
export function concertHallOverheadPlanes(model=getConcertHall(),{camera,reducedMotion=false}={}){
 const reference=camera?.reference||{x:model.width/2,y:model.height/2};
 const dx=Number.isFinite(camera?.x)?camera.x-reference.x:0,dy=Number.isFinite(camera?.y)?camera.y-reference.y:0;
 const offset=kind=>{const h=OVERHEAD_HEIGHTS[kind];return {x:reducedMotion?0:clamp(-dx*h.rate,-h.x,h.x),y:reducedMotion?0:clamp(-dy*h.rate,-h.y,h.y)};};
 return [
  {id:'ceiling',height:'roof',bounds:rect(72,0,model.width-144,176)},
  ...model.audience.balconies.map((r,i)=>({id:`roof-${i}`,height:'roof',bounds:{...r},right:i===1})),
  {id:'suspension',height:'rig',bounds:rect(996,92,model.width-1992,188)}
 ].map(p=>({...p,offset:offset(p.height)}));
}

function makeCanvas(w,h){
 const cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):null;
 if(cv){cv.width=w;cv.height=h;}return cv;
}
function paintOverhead(c,model,plane){
 if(plane.id==='ceiling'){
  // This is a genuine opening in the roof, not a roof painted over the organ.
  c.save();exclude(c,rect(1696,0,704,176),model);drawAcousticCeiling(c,model.width);c.restore();
 }else if(plane.height==='roof')drawAcousticShell(c,plane.bounds,{right:plane.right,plane:'roof'});
 else{
  for(const x of [996,model.width-1568])drawAcousticAirBay(c,rect(x,92,572,202),{plane:'beam'});
  for(const rig of concertSuspendedReflectors(model))drawConcertSuspendedReflector(c,rig,{shadow:false});
 }
}
function overheadCutaways(model,{player,performance}={}){
 const cuts=[rect(1696,0,704,360)];
 // Gallery furniture stays on its fixed architectural ledges. The open roof
 // is cut away above those ledges, just as it is above the playable stage.
 for(const r of model.audience.balconies)for(let tier=0;tier<3;tier++)cuts.push(rect(r.x,r.y+178+tier*278,r.w,260));
 // The native body cache has transparent padding above the visible hair.
 // Cutting at its texture origin would bite into a cloud above a seated head.
 // Visible seated hair begins about 155px above the actor's floor anchor.
 for(const a of performance?.actors||[])cuts.push(rect(a.x-82,a.y-160,164,226));
 if(Number.isFinite(player?.x)&&Number.isFinite(player?.y))cuts.push(rect(player.x-100,player.y-190,200,240));
 return cuts;
}
function exclude(c,r,model){
 c.beginPath();c.rect(0,0,model.width,model.height);c.rect(r.x,r.y,r.w,r.h);c.clip('evenodd');
}

/** Four cropped RGBA blits; beams, wires and clouds remain connected in space. */
export function renderConcertHallOverhead(ctx,model=getConcertHall(),options={}){
 prepareConcertHallArt();
 const planes=concertHallOverheadPlanes(model,options),cuts=overheadCutaways(model,options);
 if(!overhead){
  const tiles=planes.map(p=>{
   const canvas=makeCanvas(p.bounds.w,p.bounds.h);if(!canvas)return {...p,canvas:null};
   const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.translate(-p.bounds.x,-p.bounds.y);paintOverhead(c,model,p);
   return {...p,canvas};
  });
  if(tiles.every(p=>p.canvas))overhead=tiles;
 }
 let blits=0;
 for(let i=0;i<planes.length;i++){
  const p=planes[i],b={...p.bounds,x:p.bounds.x+p.offset.x,y:p.bounds.y+p.offset.y};
  if(options.viewport&&!overlaps(b,options.viewport))continue;
  ctx.save();ctx.beginPath();ctx.rect(0,0,model.width,model.height);ctx.clip();ctx.imageSmoothingEnabled=false;
  // Only nearby silhouettes add clips (normally none or one). No masks or
  // temporary textures are allocated during walking or a seated camera drag.
  for(const cut of cuts)if(overlaps(b,cut))exclude(ctx,cut,model);
  if(overhead?.[i]?.canvas)ctx.drawImage(overhead[i].canvas,b.x,b.y);
  else{ctx.translate(p.offset.x,p.offset.y);paintOverhead(ctx,model,p);}
  ctx.restore();blits++;
 }
 return {blits,cachePixels:planes.reduce((sum,p)=>sum+p.bounds.w*p.bounds.h,0)};
}

/** Chair backs share the player's depth sort rather than flattening into the floor. */
export function concertHallDrawables(ctx,model=getConcertHall(),{viewport}={}){
 prepareConcertHallArt();
 return model.audience.seats.flatMap(seat=>{
  const bounds={x:seat.x-33,y:seat.y-74,w:66,h:74};
  if(viewport&&(bounds.x+bounds.w<viewport.x||bounds.x>viewport.x+viewport.w||bounds.y+bounds.h<viewport.y||bounds.y>viewport.y+viewport.h))return [];
  return [{y:seat.y,bounds,draw:()=>chair(ctx,seat.x,seat.y)}];
 });
}

const fill=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function polygon(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function line(c,x,y,x2,y2,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function sprite(c,name,x,y,w,h){const im=art.get(name);if(!im)return false;c.drawImage(im,Math.round(x),Math.round(y),Math.round(w),Math.round(h));return true;}
function glow(c,x,y,r,color){const g=c.createRadialGradient(x,y,2,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'#ffcc7700');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function wood(c,x,y,w,h,{light=false,vertical=false}={}){
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();fill(c,x,y,w,h,light?'#cc9858':'#a8753e');
 const grain=light?['#d1a166','#d9ad73','#c79352','#d1a064']:['#ae7b43','#b88449','#a7743d','#bd8b50'];
 const plank=28,length=224;
 if(vertical){
  for(let xx=x;xx<x+w;xx+=plank){fill(c,xx+1,y,plank-2,h,grain[Math.floor(xx/plank)%4]);line(c,xx+3,y,xx+3,y+h,'#e9be7730');for(let yy=y+(Math.floor(xx/plank)%3)*68;yy<y+h;yy+=length)line(c,xx,yy,xx+plank,yy,'#3b2c2650');}
 }else{
  for(let yy=y;yy<y+h;yy+=plank){const row=Math.floor((yy-y)/plank);fill(c,x,yy+1,w,plank-2,grain[row%4]);line(c,x,yy+2,x+w,yy+2,'#e9be7738');for(let xx=x-(row%3)*74;xx<x+w;xx+=length){line(c,xx,yy,xx,yy+plank,'#3b2c2660');line(c,xx+24,yy+17,xx+94,yy+17,'#51342020');line(c,xx+114,yy+9,xx+187,yy+9,'#eed1a020');}}
 }
 c.restore();
}
function carpet(c,x,y,w,h){
 fill(c,x,y,w,h,'#382a2b');fill(c,x+4,y+4,w-8,h-8,'#b78c53');fill(c,x+9,y+9,w-18,h-18,'#602d3a');
 for(let yy=y+18;yy<y+h-12;yy+=14)for(let xx=x+18;xx<x+w-12;xx+=14)fill(c,xx,yy,2,2,'#bc6b6926');
 line(c,x+15,y+15,x+15,y+h-15,'#c69d5d70');line(c,x+w-15,y+15,x+w-15,y+h-15,'#c69d5d70');
}
function chair(c,x,y,scale=1){
 const w=66*scale,h=74*scale;
 if(sprite(c,'audience-chair',x-w/2,y-h,w,h))return;
 fill(c,x-29*scale,y-13*scale,58*scale,12*scale,'#251f22');fill(c,x-26*scale,y-65*scale,52*scale,54*scale,'#59362d');
 fill(c,x-21*scale,y-61*scale,42*scale,44*scale,'#8d3447');fill(c,x-18*scale,y-58*scale,36*scale,3*scale,'#c0766b');
 for(const side of [-1,1]){fill(c,x+side*27*scale-3*scale,y-38*scale,6*scale,34*scale,'#bd9552');fill(c,x+side*22*scale-3*scale,y-9*scale,6*scale,10*scale,'#c7a963');}
}
function rail(c,x,y,w,h=88){
 fill(c,x,y+7,w,h,'#322823');wood(c,x,y,w,h,{light:false});
 const count=Math.ceil(w/260),segment=w/count;
 if(art.has('balcony-rail'))for(let i=0;i<count;i++)sprite(c,'balcony-rail',x+i*segment,y-12,segment+2,h+24);
 else{fill(c,x,y+3,w,6,'#deb472');fill(c,x,y+h-11,w,8,'#412f27');for(let xx=x+20;xx<x+w;xx+=44){line(c,xx,y+10,xx,y+h-17,'#c08b4b',5);line(c,xx+2,y+14,xx+27,y+h-20,'#b18350',2);}}
}
function wallPanel(c,x,y,w,h){
 wood(c,x,y,w,h,{vertical:true});
 if(art.has('timber-rib')){const n=Math.ceil(w/180);for(let i=0;i<n;i++)sprite(c,'timber-rib',x+i*w/n,y,w/n+2,h);}
 else for(let xx=x;xx<x+w;xx+=36){fill(c,xx,y,7,h,'#402c23');fill(c,xx+8,y,5,h,'#d09b58');}
}
function sconce(c,x,y){
 glow(c,x,y-38,180,'#ffd38632');
 if(!sprite(c,'sconce',x-36,y-118,72,120)){fill(c,x-7,y-62,14,64,'#a68143');polygon(c,[[x-24,y-86],[x+24,y-86],[x+15,y-48],[x-15,y-48]],'#ffdf9c');}
}
function balcony(c,r,right=false){
 c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();
 drawAcousticShell(c,r,{right,plane:'base'});
 // Three separate vineyard-style boxes step toward the stage. Their broad
 // beech fascias remain legible at the seated camera's smaller scale.
 for(let tier=0;tier<3;tier++){
  const y=r.y+190+tier*278,outer=26+tier*8,inner=r.w-22-(2-tier)*20;
  const local=x=>right?r.x+r.w-x:r.x+x;
  const left=right?local(inner):local(outer),width=inner-outer;
  fill(c,left,y-12,width,194,'#6a4030');wood(c,left+5,y-8,width-10,180,{light:false});
  for(let row=0;row<2;row++)for(let col=0;col<8;col++)chair(c,local(outer+30+(inner-outer-60)*col/7),y+61+row*72,.72);
  const points=[[local(outer),y+153],[local(inner),y+173],[local(inner),y+248],[local(outer),y+229]];
  polygon(c,points,'#7f4d29');
  polygon(c,[[local(outer+3),y+158],[local(inner-3),y+178],[local(inner-3),y+235],[local(outer+3),y+218]],'#d4a367');
  line(c,local(outer),y+153,local(inner),y+173,'#f0ce95',5);
  line(c,local(outer+4),y+219,local(inner-4),y+237,'#9d6e3b',4);
  for(let i=1;i<11;i++){const x=outer+(inner-outer)*i/11,ratio=(x-outer)/(inner-outer);line(c,local(x),y+166+ratio*20,local(x),y+216+ratio*18,'#a36d3838',2);}
  fill(c,local(right?inner-8:outer+2),y+188,6,17,'#dbb474');
 }
 c.restore();
}
function organ(c,x,y,w,h){
 glow(c,x+w/2,y+h*.55,w*.7,'#ffd99923');
 if(sprite(c,'organ',x,y,w,h))return;
 wood(c,x,y,w,h,{light:true,vertical:true});
 for(let i=0;i<33;i++){const pipeH=h*.36+h*.42*Math.sin(i/32*Math.PI),px=x+20+i*(w-40)/33;fill(c,px,y+h-pipeH-50,Math.max(8,(w-46)/33-5),pipeH,'#b6ac8d');fill(c,px+3,y+h-pipeH-47,4,pipeH-6,'#ece3bf');}
 fill(c,x+18,y+h-54,w-36,39,'#6b4230');
}
function reflector(c,x,y,w,h,flip=false){
 c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}
 if(!sprite(c,'reflector',x,y,w,h)){
  polygon(c,[[x+18,y+h*.22],[x+w*.65,y],[x+w,y+h*.42],[x+w*.75,y+h],[x+w*.13,y+h*.82]],'#b75975');
  polygon(c,[[x+18,y+h*.22],[x+w*.65,y],[x+w*.91,y+h*.33],[x+w*.21,y+h*.64]],'#dc8c9e');
  line(c,x+w*.15,y+h*.72,x+w*.76,y+h*.9,'#f3b1b8',4);
 }c.restore();
}
// Native stem caps measured from the unchanged 426×273 reflector cutout.
const STEM_CAPS=Object.freeze([[99,35],[228,56],[342,13]].map(Object.freeze));
export function concertSuspendedReflectors(model=getConcertHall()){
 const left=[{x:1060,y:152,w:200,h:128},{x:1370,y:148,w:174,h:112}];
 return [...left,...left.map(r=>({...r,x:model.width-r.x-r.w}))].map(r=>({...r,
  cables:STEM_CAPS.map(([x,y])=>({anchor:{x:r.x+r.w*x/426,y:109},cap:{x:r.x+r.w*x/426,y:r.y+r.h*y/273}})),
  shadow:{x:r.x+r.w*.12+16,y:r.y+r.h*.66+17,w:r.w*.84,h:r.h*.34},
  bodyTop:r.y+r.h*85/273,depth:320}));
}
export function drawConcertSuspendedReflector(c,r,{shadow=true,suspension=true}={}){
 c.save();
 if(shadow){c.save();c.beginPath();c.rect(r.x-8,136,r.w+32,158);c.clip();
 // A displaced shadow falls on the recessed bay, visibly separated from the
 // cloud's lit skin. All of it remains behind the rear-stage performer line.
 const s=r.shadow;
 for(const [scale,color]of [[1,'#080d1626'],[.8,'#080d1638'],[.55,'#080d1645']]){
  c.fillStyle=color;c.beginPath();c.ellipse(s.x+s.w/2,s.y+s.h/2,s.w*scale/2,s.h*scale/2,0,0,Math.PI*2);c.fill();
 }
 c.restore();}
 // Suspension is not inside the shadow clip: each full wire runs from its
 // roof plate's underside into the native image's measured stem cap.
 if(suspension){for(const cable of r.cables){
  const {anchor:a,cap:b}=cable;line(c,a.x,a.y,b.x,b.y,'#293138',2);line(c,a.x+1,a.y,b.x+1,b.y,'#b6b2a1',1);
 }
 reflector(c,r.x,r.y,r.w,r.h);
 // Roof anchor plates are separate from the PNG's lower stem caps.
 for(const {anchor:a}of r.cables){fill(c,a.x-6,104,12,5,'#6e563b');fill(c,a.x-4,105,8,2,'#d2c5a9');}}
 c.restore();
}
function stage(c,s){
 const r=s.stage;
 fill(c,r.x-9,r.y+18,r.w+18,r.h+52,'#241c22aa');
 wood(c,r.x,r.y,r.w,r.h,{light:true});
 // A fine inlaid stage border, darker apron and small gold footlights.
 for(const [off,color]of [[0,'#382d28'],[4,'#d6b27a'],[9,'#87603d']]){line(c,r.x+off,r.y+off,r.x+r.w-off,r.y+off,color,3);line(c,r.x+off,r.y+off,r.x+off,r.y+r.h,color,3);line(c,r.x+r.w-off,r.y+off,r.x+r.w-off,r.y+r.h,color,3);}
 wood(c,r.x,r.y+r.h-7,r.w,54,{light:false,vertical:true});
 line(c,r.x,r.y+r.h-6,r.x+r.w,r.y+r.h-6,'#efcb8b',5);
 for(let x=r.x+80;x<r.x+r.w-40;x+=220)if(x<1830||x>2266){fill(c,x-10,r.y+r.h-3,20,8,'#3d3027');glow(c,x,r.y+r.h,44,'#ffe6ac22');fill(c,x-4,r.y+r.h,8,3,'#ffe9b6');}
 const t=s.stairs;
 for(let i=0;i<8;i++){const yy=t.y+i*t.h/8;fill(c,t.x,yy,t.w,t.h/8,'#896341');fill(c,t.x+4,yy+1,t.w-8,4,'#d0ac73');fill(c,t.x+4,yy+7,t.w-8,3,'#503c2e');}
 // Short handrails stay beside the walkable opening rather than crossing it.
 for(const x of [t.x-13,t.x+t.w+7]){fill(c,x,t.y-8,6,t.h+14,'#a98245');fill(c,x+2,t.y-8,2,t.h+12,'#f1d398');}
}
function drawHall(c,s){
 const {width:w,height:h}=s;c.save();c.imageSmoothingEnabled=false;
 fill(c,0,0,w,h,'#171923');wood(c,72,176,w-144,h-224,{light:false});
 // Central and outer walking aisles connect every ground-floor seat to the door.
 carpet(c,1940,1238,216,1274);carpet(c,712,1284,172,1228);carpet(c,3212,1284,172,1228);
 carpet(c,884,1704,2328,74);carpet(c,712,2330,2672,182);
 fill(c,82,1268,606,1244,'#29252c');fill(c,3408,1268,606,1244,'#29252c');
 for(const xx of [88,3414]){wood(c,xx,1302,594,1210,{light:false,vertical:true});for(let yy=1370;yy<2410;yy+=290){wallPanel(c,xx+20,yy-72,554,188);sconce(c,xx+300,yy+65);}}
 // A broad timber chamber and galleries, with the organ centered over the stage.
 // The fixed ceiling recess and gallery walls remain behind the independently
 // projected timber. Their cast shade does not slide along with that timber.
 fill(c,72,0,w-144,176,'#292326');
 for(let i=0;i<s.audience.balconies.length;i++)balcony(c,s.audience.balconies[i],i===1);
 stage(c,s);
 // An actual dark volume sits below each roof return. Moving the decorative
 // choir banks outboard leaves air behind the suspended acoustic clouds.
 for(const [x,right]of [[788,false],[2532,true]]){
  drawAcousticAirBay(c,{x:right?2528:996,y:92,w:572,h:202},{plane:'shadow'});
  const bankX=right?3104:788;wood(c,bankX,294,224,26,{light:false});line(c,bankX,294,bankX+224,294,'#e9c389',3);
  for(let i=0;i<3;i++)chair(c,right?3260-i*66:840+i*66,298,.68);
 }
 drawOrganAcousticPanels(c,{x:1696,y:0,w:704,h:360});
 // Preserve the native organ's near-square proportions and reveal the red
 // acoustic panel bay that surrounds it in the modern Concert Hall.
 organ(c,1898,40,300,312);
 for(const rig of concertSuspendedReflectors(s))drawConcertSuspendedReflector(c,rig,{suspension:false});
 for(const x of [803,3293])sconce(c,x,390);
 // Interactive ground chairs are added through concertHallDrawables so their
 // backs correctly cover a visitor's feet on the north side of each row.
 // Low side boxes and architectural ribs continue to the lower lobby.
 for(const x of [76,w-104]){wood(c,x,0,28,h,{vertical:true});fill(c,x+1,0,3,h,'#d2a36a');}
 wood(c,72,h-48,w-144,48,{light:false});line(c,72,h-51,w-72,h-51,'#ddb373',4);
 for(const x of [270,3626])sprite(c,'door',x,2260,200,194);
 fill(c,1934,2496,228,16,'#b89967');fill(c,1940,2500,216,6,'#e0c492');
 // The programme lectern is off the route and has a physical matching base.
 fill(c,766,2364,100,14,'#211c2380');fill(c,786,2304,60,64,'#765133');polygon(c,[[764,2306],[852,2306],[866,2332],[778,2332]],'#d3b582');
 fill(c,778,2312,62,4,'#674c3a');fill(c,784,2321,56,3,'#674c3a');
 for(const x of [930,3166])sconce(c,x,2465);
 c.restore();
}
