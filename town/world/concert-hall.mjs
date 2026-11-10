// The hall shares the Opera House lot's exact floor area. Architecture is static;
// the programme supplies its own musicians, instruments and animated performance.
export const CONCERT_FOOTPRINT=Object.freeze({width:4096,height:2560});
const rect=(x,y,w,h)=>({x,y,w,h});
const zone=(id,label,x,y,w,h,action,extra={})=>({id,label,x,y,w,h,action,...extra});
const ROWS=[1370,1510,1650,1840,1980,2120,2260];
const seatColumns=[...Array.from({length:14},(_,i)=>936+i*72),...Array.from({length:14},(_,i)=>2224+i*72)];
let hall=null,background=null,artPromise=null;
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
  const img=new Image();img.onload=()=>{art.set(name,img);background=null;resolve(img);};img.onerror=()=>resolve(null);
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
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();fill(c,x,y,w,h,light?'#a67c4e':'#735038');
 const grain=light?['#ad8355','#b18a5b','#9d7448','#a47a4d']:['#79563c','#805d41','#715037','#896145'];
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
 fill(c,r.x-8,r.y+16,r.w+16,r.h+20,'#1a1921a0');wood(c,r.x,r.y,r.w,r.h,{light:false});
 for(let row=0;row<7;row++){
  const yy=r.y+170+row*126,inset=(6-row)*15;
  fill(c,r.x+inset,yy-80,r.w-inset*2,110,'#3a2928');
  for(let col=0;col<6;col++)chair(c,r.x+72+inset+col*(r.w-144-inset*2)/5,yy,.9);
  line(c,r.x+inset,yy+12,r.x+r.w-inset,yy+12,'#d4a564',4);
 }
 rail(c,r.x,r.y+r.h-74,r.w,74);
 // Vertical brass rails follow the raised gallery's inner edge.
 const ix=right?r.x:r.x+r.w-13;
 fill(c,ix,r.y+140,12,r.h-172,'#503629');fill(c,ix+3,r.y+140,4,r.h-172,'#d3ab62');
 for(let yy=r.y+160;yy<r.y+r.h-45;yy+=66){fill(c,ix-5,yy,22,8,'#8a613b');fill(c,ix-3,yy-3,18,4,'#dbb776');}
 sconce(c,r.x+r.w/2,r.y+95);
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
 wallPanel(c,72,0,w-144,182);fill(c,72,172,w-144,10,'#281f22');line(c,80,168,w-80,168,'#e5b77a',4);
 for(const x of [788,2532]){wood(c,x,176,776,144,{light:false});for(let i=0;i<10;i++)chair(c,x+54+i*74,298,.8);rail(c,x,294,776,44);}
 for(let i=0;i<s.audience.balconies.length;i++)balcony(c,s.audience.balconies[i],i===1);
 stage(c,s);
 organ(c,1696,16,704,344);
 // The acoustic petals remain above the performers' silhouettes.
 reflector(c,1050,40,300,190);reflector(c,1430,54,310,198,true);reflector(c,2364,54,310,198);reflector(c,2744,40,300,190,true);
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
