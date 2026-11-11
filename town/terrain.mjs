import {W,H,paths,allHomes,residents,landmarks,terraces,landStairs,accessPath,riverX,bridges,baseElevation,biomeAt,townTrees,groves,inRect} from './model.mjs';
import {noise,rect,ellipse,flower,fence,bench,lamp,material,fountain,planter,musicalDetail,environmentDetail} from './art.mjs?v=family-rooms-1';
import {rockFace,grassLip} from './terrain-tiles.mjs?v=family-rooms-1';
import {drawMusicSquare} from './square.mjs?v=family-rooms-1';
import {drawNaturalWater} from './shore.mjs?v=family-rooms-1';
const CHUNK=1024,OVERVIEW_W=3200,OVERVIEW_H=2400;
const canvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const segments=paths.flatMap(p=>p.slice(1).map((b,i)=>({a:p[i],b,width:220,kind:1}))).concat(allHomes.map(h=>{const [a,b]=accessPath(h);return {a,b,width:128,kind:2};}));
function segmentRect(s){const [ax,ay]=s.a,[bx,by]=s.b;return {x:Math.min(ax,bx)-s.width/2,y:Math.min(ay,by)-s.width/2,w:Math.abs(ax-bx)+s.width,h:Math.abs(ay-by)+s.width};}
function fillMaterial(c,index,tone,r){const pattern=c.createPattern(material(index,tone),'repeat');if(index===1)pattern.setTransform(new DOMMatrix().scale(.5));c.fillStyle=pattern;c.fillRect(r.x,r.y,r.w,r.h);}
function drawStairs(c,s,base=0){const n=Math.max(4,Math.ceil(Math.abs(s.from-s.to)/6)),rise=(s.to-s.from)/n;for(let i=n-1;i>=0;i--){const t=i/n,z=base+s.from+rise*i,x=s.x+(s.axis==='x'?s.w*t:0),y=s.y+(s.axis==='y'?s.h*t:0)-z,w=s.axis==='x'?s.w/n+2:s.w,h=s.axis==='y'?s.h/n+Math.abs(rise)+2:s.h;rect(c,x,y,w,h,'#766f5a');fillMaterial(c,1,'ridge',{x:x+2,y:y+2,w:w-4,h:Math.max(2,h-4)});rect(c,x+2,y+2,w-4,Math.max(2,h-4),'#9e967c70');rect(c,x,y,w,3,'#d0c3a0');if(s.axis==='x'){rect(c,x,y,3,h,'#d2c39d');rect(c,x+w-3,y,3,h,'#4a5043');}else rect(c,x,y+h-4,w,4,'#454c3e');}
 const high=Math.max(s.from,s.to)+base;for(const side of [0,1]){const x=s.axis==='y'?s.x+side*s.w:s.x,y=s.axis==='y'?s.y-high:s.y+side*s.h-high;rect(c,x-5,y,10,32,'#8e8a70');rect(c,x-7,y-4,14,6,'#c0b99a');}}
function drawPorch(c,h){const p=h.porch,base=baseElevation(h.door.x,h.porch.y),top=base+p.rise,fy=p.y+p.h;
 rect(c,p.x+12,fy-base+10,p.w+38,22,'#10292045');
 fillMaterial(c,1,'forest',{x:p.x,y:fy-top,w:p.w,h:p.rise});
 rect(c,p.x,fy-top,p.w,4,'#b4aa8b');
 if(p.material==='stone')fillMaterial(c,1,'ridge',{x:p.x,y:p.y-top,w:p.w,h:p.h});
 else{rect(c,p.x,p.y-top,p.w,p.h,'#5e5542');for(let y=p.y-top;y<fy-top;y+=14){rect(c,p.x+3,y+1,p.w-6,11,'#8b7956');rect(c,p.x+4,y+2,p.w-8,1,'#b29a6c');for(let x=p.x+10;x<p.x+p.w;x+=94)rect(c,x,y+3,1,7,'#60543e');}}
 // Side rails and a clear central stair opening make the height legible.
 fence(c,p.x,p.y-top+12,110,{height:42});fence(c,p.x+p.w-110,p.y-top+12,110,{height:42});fence(c,p.x,fy-top,p.w/2-106,{height:42});fence(c,p.x+p.w/2+106,fy-top,p.w/2-106,{height:42});
 for(const x of [p.x,p.x+p.w]){rect(c,x-5,p.y-top-38,10,p.h,'#a08c65');rect(c,x-5,p.y-top-38,3,p.h,'#d0b98a');for(let y=p.y;y<=fy;y+=48){rect(c,x-7,y-top-46,14,52,'#685f49');rect(c,x-6,y-top-46,3,50,'#b8a27a');}}
 drawStairs(c,h.stairs,base);
 planter(c,p.x+90,fy-top-26,100);planter(c,p.x+p.w-90,fy-top-26,100);
}
function drawTerrace(c,t){const south=t.y+t.h,top=south-t.height;const shadow=c.createLinearGradient(0,south,0,south+160);shadow.addColorStop(0,'#16232b88');shadow.addColorStop(1,'#16232b00');c.fillStyle=shadow;c.fillRect(t.x,south,t.w+40,160);rockFace(c,t.x,top,t.w,t.height,t.x);fillMaterial(c,0,t.tone,{x:t.x,y:t.y-t.height,w:t.w,h:t.h});grassLip(c,t.x,top,t.w,t.x);rect(c,t.x+t.w-8,t.y-t.height,8,t.h,'#21343b44');}
function drawRoad(c,s,pass){const [ax,ay]=s.a,[bx,by]=s.b,vertical=ax===bx,len=Math.abs(bx-ax)+Math.abs(by-ay),n=Math.max(1,Math.ceil(len/120));for(let i=0;i<n;i++){const t=i/n,u=(i+1)/n,x=ax+(bx-ax)*t,y=ay+(by-ay)*t,xx=ax+(bx-ax)*u,yy=ay+(by-ay)*u,z=baseElevation((x+xx)/2,(y+yy)/2),first=i===0?s.width/2:0,last=i===n-1?s.width/2:0;
 const r=vertical?{x:ax-s.width/2,y:Math.min(y,yy)-z-(ay<by?first:last),w:s.width,h:Math.abs(yy-y)+first+last+1}:{x:Math.min(x,xx)-(ax<bx?first:last),y:ay-s.width/2-z,w:Math.abs(xx-x)+first+last+1,h:s.width};
 if(pass===0){const border=vertical?{x:r.x-7,y:r.y,w:r.w+14,h:r.h}:{x:r.x,y:r.y-7,w:r.w,h:r.h+14};rect(c,border.x,border.y,border.w,border.h,'#8d8b70');}
 else fillMaterial(c,s.kind===1?2:1,s.kind===1?'garden':'ridge',r);
 }}
function drawBridge(c,b){const x=b.x-b.w/2,y=b.y-b.h/2;rect(c,x-8,y+10,b.w+28,b.h+18,'#18382c55');rect(c,x,y,b.w,b.h,'#554e3b');for(let dx=0;dx<b.w;dx+=16){rect(c,x+dx+1,y+3,13,b.h-6,'#91805b');rect(c,x+dx+2,y+3,1,b.h-6,'#c0ad7d');}for(const dy of [0,b.h]){fence(c,x,y+dy,b.w);for(const dx of [0,b.w])lamp(c,x+dx,y+dy);}}
export function bakeTerrain(){
 const cache=new Map();let overview=null;
 function paint(c,view,detail=true){fillMaterial(c,0,'lawn',view);
  // Biomes are authored areas, so brightness and color describe the landscape.
  for(const grove of groves)if(intersects(grove,view))fillMaterial(c,0,'forest',grove);
  const meadow={x:2800,y:9500,w:4800,h:2400};if(intersects(meadow,view)){c.save();c.beginPath();c.moveTo(2900,10300);c.bezierCurveTo(3000,9700,4000,9700,4800,9750);c.bezierCurveTo(5700,9450,7000,9900,7470,10600);c.bezierCurveTo(7820,11600,6600,11850,5400,11780);c.bezierCurveTo(4200,12000,2700,11700,2900,10300);c.closePath();c.clip();fillMaterial(c,0,'meadow',meadow);c.restore();}
  const marsh={x:9000,y:10700,w:6600,h:1200};if(intersects(marsh,view))fillMaterial(c,0,'marsh',marsh);
  for(const t of terraces)if(intersects({x:t.x,y:t.y-t.height,w:t.w,h:t.h+t.height+200},view))drawTerrace(c,t);
  // Private lots sit within their neighborhood, with a quiet lawn and a planted edge.
  for(const h of allHomes){const z=baseElevation(h.door.x,h.porch.y),lot={x:h.x-180,y:h.y-160-z,w:h.w+360,h:h.h+h.porch.h+h.stairs.h+340};if(!intersects(lot,view))continue;fence(c,lot.x,lot.y+80,lot.w);for(let j=0;j<4;j++){rect(c,h.x-118,h.y+180+j*76-z,74,38,'#3a4230');for(let k=0;k<10;k++)flower(c,h.x-112+k*6,h.y+196+j*76-z,['#b0aa7d','#8e9c83','#8b8194','#ac8b76'][j]);}}
  for(const pass of [0,1])for(const s of segments)if(intersects({...segmentRect(s),y:segmentRect(s).y-180,h:segmentRect(s).h+200},view))drawRoad(c,s,pass);
  drawMusicSquare(c);
  drawNaturalWater(c,view);
  for(const b of bridges)if(intersects({x:b.x-b.w/2,y:b.y-b.h/2,w:b.w,h:b.h},view))drawBridge(c,b);
  for(const s of landStairs)if(intersects({x:s.x,y:s.y-160,w:s.w,h:s.h+160},view))drawStairs(c,s);
  for(const h of allHomes){const p=h.porch,z=baseElevation(h.door.x,h.porch.y)+p.rise;if(intersects({x:p.x-40,y:p.y-z-50,w:p.w+80,h:p.h+h.stairs.h+z+80},view))drawPorch(c,h);}
  if(detail){for(const t of townTrees){if(!intersects({x:t.x-300,y:t.y-150,w:700,h:300},view))continue;const z=baseElevation(t.x,t.y),shadow=c.createRadialGradient(t.x+90,t.y-z+30,20,t.x+90,t.y-z+30,280*t.size);shadow.addColorStop(0,'#102b2380');shadow.addColorStop(1,'#102b2300');c.fillStyle=shadow;c.fillRect(t.x-230,t.y-z-160,660,390);}}
 }
 function chunk(cx,cy){const key=cx+','+cy;if(cache.has(key)){const c=cache.get(key);cache.delete(key);cache.set(key,c);return c;}const c=canvas(CHUNK,CHUNK),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(-cx*CHUNK,-cy*CHUNK);paint(g,{x:cx*CHUNK,y:cy*CHUNK,w:CHUNK,h:CHUNK});cache.set(key,c);if(cache.size>32)cache.delete(cache.keys().next().value);return c;}
 function draw(c,view){const x0=Math.max(0,Math.floor(view.x/CHUNK)),x1=Math.min(Math.ceil(W/CHUNK)-1,Math.floor((view.x+view.w)/CHUNK)),y0=Math.max(0,Math.floor(view.y/CHUNK)),y1=Math.min(Math.ceil(H/CHUNK)-1,Math.floor((view.y+view.h)/CHUNK));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)c.drawImage(chunk(x,y),x*CHUNK,y*CHUNK);}
 function drawOverview(c){if(!overview){overview=canvas(OVERVIEW_W,OVERVIEW_H);const g=overview.getContext('2d');g.scale(OVERVIEW_W/W,OVERVIEW_H/H);paint(g,{x:0,y:0,w:W,h:H},false);}c.drawImage(overview,0,0,OVERVIEW_W,OVERVIEW_H,0,0,W,H);}
 return {draw,drawOverview,trees:townTrees,cacheSize:()=>cache.size};
}
