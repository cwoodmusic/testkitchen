import {assetImage} from './asset-color.mjs?v=showrooms-1';
import {applyShowroomLayout} from './showroom-layout.mjs?v=showrooms-1';
import {drawShowroomFloor,drawShowroomWallpaper} from './showroom-materials.mjs?v=showrooms-1';
// The apartment tower has one consistent floor plate. Residential floors use
// a 608px common hall and 1120px private apartments, within its 2304 × 1728 lot.
export const FLOOR_COUNT=15;
export const TOWER_FOOTPRINT=Object.freeze({width:2304,height:1728});
export const STORE_FOOTPRINT=Object.freeze({width:3072,height:2048});
export {residents} from './resident-profiles.mjs?v=showrooms-1';
import {residents} from './resident-profiles.mjs?v=showrooms-1';
const sceneCache=new Map(),backgroundCache=new Map();
let nativeCatalog=null,woodTexture=null,npcRenderer=null;
export function configureUrbanInteriors(catalog){nativeCatalog=catalog;for(const scene of sceneCache.values())warmScene(scene);}
if(typeof document!=='undefined'){
 import('./ground-textures.mjs?v=showrooms-1').then(({groundTextures})=>{woodTexture=groundTextures.wood;backgroundCache.clear();}).catch(()=>{});
}
const rect=(x,y,w,h)=>({x,y,w,h});
const zone=(id,label,x,y,w,h,action,extra={})=>({id,label,x,y,w,h,action,...extra});
function addItem(scene,asset,x,y,w,h=null,solid=true){
 const a=nativeCatalog?.get(asset),height=h||w*(a?.h||1)/(a?.w||1),item={id:`${scene.id}-item-${scene.items.length}`,asset,x,y,w,h:height,solid};scene.items.push(item);
 // Furniture is upright in the three-quarter cutaway. Its feet, rather than
 // its pictured height, block walking; beds occupy their full floor footprint.
 if(solid){const bed=asset==='furniture-2-180',depth=bed?height*.72:Math.min(height*.48,w*.5);scene.solids.push(rect(x-w*.43,y-depth,w*.86,depth));}
 return item;
}
function room(scene,name,x,y,w,h,material='wood'){scene.rooms.push({name,x,y,w,h,material});}
function shell(id,title,width,height,color='#526d63',trim='#c8aa77'){
 return {id,title,width,height,color,trim,spawn:{x:width/2,y:height-150},solids:[rect(0,0,width,106),rect(0,0,28,height),rect(width-28,0,28,height),rect(0,height-28,width,28)],items:[],zones:[],rooms:[],walls:[],rugs:[],windows:[],signs:[],lights:[],actors:[]};
}
function wall(scene,x,y,w,h){scene.walls.push(rect(x,y,w,h));scene.solids.push(rect(x,y,w,h));}
function windowAt(scene,x,y,w=148){scene.windows.push({x,y,w});}
function rug(scene,x,y,w,h,color=scene.color){scene.rugs.push({x,y,w,h,color});}
function sign(scene,text,x,y,size=23){scene.signs.push({text,x,y,size});}
function light(scene,x,y,r=190){scene.lights.push({x,y,r});}
function commonZones(s,floor){
 const mid=s.width/2;
 s.zones.push(zone('lift',`Elevator · floor ${floor}`,mid-120,130,240,200,'elevator',{floor}),zone('stair-up',floor<15?'Stairs up':'Top floor',200,160,250,210,'stairs-up',{floor}),zone('stair-down',floor>1?'Stairs down':'Street level',s.width-450,160,250,210,floor>1?'stairs-down':'exit',{floor}));
 sign(s,'ELEVATOR',mid,118,20);sign(s,floor<15?'UP ↑':'FLOOR 15',325,145,20);sign(s,floor>1?'DOWN ↓':'STREET ↓',s.width-325,145,20);
 s.elevator={x:mid-112,y:112,w:224,h:210,floor};s.stairs=[{x:200,y:170,w:250,h:192,up:true},{x:s.width-450,y:170,w:250,h:192,up:false}];
}
function lobby(){
 const s=shell('tower-lobby','Coda Residences · Grand Lobby',2304,1728,'#2b6371','#cda056');s.kind='lobby';s.floor=1;
 commonZones(s,1);rug(s,868,380,568,1160,'#3c8190');rug(s,170,820,540,550,'#7b5159');rug(s,1594,820,540,550,'#526d63');
 room(s,'Reception lounge',140,690,620,800);room(s,'Music salon',1544,690,620,800);
 for(const x of [600,1704])windowAt(s,x,24,220);
 addItem(s,'furniture-1-180',430,1070,350,235);addItem(s,'furniture-5-180',430,1325,270,240);addItem(s,'furniture-1-180',1850,1070,350,235);addItem(s,'furniture-0-180',1850,1390,330,340);
 addItem(s,'decor-05-05',550,600,250,230);addItem(s,'decor-05-06',1750,600,180,170);
 for(const x of [170,750,1554,2134])addItem(s,'decor-08-09',x,770,180,250);
 for(const [x,y]of [[170,1450],[2134,1450],[800,400],[1504,400]])addItem(s,'decor-08-02',x,y,130,165);
 s.zones.push(zone('street','Return to Coda Town',s.width/2-170,s.height-240,340,190,'exit'));
 s.directory={x:865,y:122,w:180,h:270};s.zones.push(zone('directory','Building directory',870,400,180,150,'elevator',{floor:1}));
 sign(s,'CODA RESIDENCES',1152,680,52);sign(s,'Fifteen floors. One musical neighbourhood.',1152,730,24);sign(s,'STREET',1152,1630,20);
 light(s,1152,600,420);light(s,430,1160,330);light(s,1850,1160,330);
 return s;
}
function hall(floor){
 const s=shell(`tower-floor-${floor}`,`Coda Residences · Floor ${floor}`,2304,608,'#536580','#b08e60');s.kind='hall';s.floor=floor;
 // The stair and lift core occupies the center of every residential hall;
 // apartment doors sit on the north wall at each end of a broad corridor.
 const occupants=residents.filter(r=>r.floor===floor),doors=floor===15?[{id:'player',name:'Your apartment',number:'15A',theme:'The Rooftop Studio'}]:occupants;
 s.elevator={x:1032,y:112,w:240,h:150,floor};s.stairs=[...(floor<15?[{x:730,y:120,w:220,h:155,up:true}]:[]),{x:1354,y:120,w:220,h:155,up:false}];
 s.zones.push(zone('lift',`Elevator · floor ${floor}`,1032,252,240,160,'elevator',{floor}));
 if(floor<15)s.zones.push(zone('stair-up','Stairs up',730,260,220,150,'stairs-up',{floor}));
 s.zones.push(zone('stair-down','Stairs down',1354,260,220,150,'stairs-down',{floor}));
 rug(s,100,420,2104,100,'#5b3e48');
 doors.forEach((r,i)=>{const x=doors.length===1?500:i===0?430:1874;s.doors??=[];s.doors.push({x,y:112,w:170,h:190,number:r.number,color:residents.find(n=>n.id===r.id)?.color||'#3c8190'});s.zones.push(zone(`room-${r.id}`,`${r.number} · ${r.name}`,x-95,282,190,150,'room',{resident:r.id,floor}));sign(s,r.theme,x,385,20);});
 for(const x of [150,2154])addItem(s,'decor-08-02',x,340,130,170);
 sign(s,`FLOOR ${floor}`,1152,505,24);sign(s,'LIFT',1152,116,18);sign(s,floor<15?'UP ↑':'ROOFTOP',840,116,18);sign(s,'DOWN ↓',1464,116,18);
 s.spawn={x:1152,y:440};s.zones.push(zone('lobby','Lobby directory',1057,435,190,130,'elevator',{floor}));return s;
}
function apartment(residentId){
 const r=residents.find(r=>r.id===residentId),player=residentId==='player',wide=player||(r?.floor||0)>=7,w=wide?2304:1088,h=1120;
 const s=shell(`apartment-${residentId}`,player?'Your apartment · The Rooftop Studio':`${r?.name||'Resident'} · ${r?.theme||'Apartment'}`,w,h,r?.color||'#3c8190',r?.trim||'#c8aa77');s.kind='apartment';s.floor=player?15:r?.floor||2;s.resident=residentId;s.residentInfo=r||null;
 const left=wide?650:420,right=wide?w-750:668,mid=w/2;
 room(s,'Bathroom',36,112,left-52,330,'tile');room(s,'Kitchen & dining',36,496,left-52,h-532,'tile');room(s,'Bedroom',right,112,w-right-36,330);room(s,player?'Your studio':'Living & music',right,496,w-right-36,h-532);
 // Two privacy walls with generous door openings onto the entry hall.
 for(const x of [left,right-20]){wall(s,x,106,20,112);wall(s,x,370,20,236);wall(s,x,820,20,h-848);}
 wall(s,28,460,left-8,20);wall(s,right-20,460,w-right-8,20);
 if(wide){room(s,'Library & gallery',left+36,112,right-left-72,330);rug(s,left+66,160,right-left-132,248);}
 const kx=left/2+18,bx=right+(w-right)/2;
 addItem(s,'furniture-7-180',128,346,154,215);addItem(s,'furniture-6-180',left-92,265,84,129);addItem(s,'furniture-8-180',left-112,428,136,155);
 addItem(s,'furniture-2-180',w-205,414,250,330);addItem(s,'decor-01-12',right+85,218,120,94);addItem(s,'decor-08-01',right+70,432,90,115,false);
 addItem(s,'furniture-3-180',wide?230:150,690,wide?300:218,210);addItem(s,'furniture-4-180',left-92,680,wide?124:108,180);addItem(s,'furniture-5-180',kx,996,230,215);
 rug(s,right+28,650,w-right-70,390);rug(s,mid-76,510,152,550,'#7b5159');
 // A calm circulation strip leads directly from the door to every room.
 if(!player){
  addItem(s,'furniture-1-180',wide?right+370:bx,990,wide?360:300,235);
  const instruments=r?.instruments||['decor-03-02'];
  if(wide){
   addItem(s,instruments[0],right+250,652,300,264);addItem(s,instruments[1],right+610,600,150,180);addItem(s,instruments[2],left+180,400,160,170);
   addItem(s,'decor-05-05',left+470,400,220,220);addItem(s,'decor-06-07',right+585,1010,150,154);
   addItem(s,'decor-08-09',right+90,1035,145,210);addItem(s,'decor-08-02',left+310,405,115,150);
  }else{
   addItem(s,instruments[0],bx,654,230,205);addItem(s,instruments[1],right+65,810,100,133);addItem(s,instruments[2],w-80,1025,90,130);
  }
  const ax=wide?mid:mid,ay=wide?750:650;s.actors.push({id:residentId,name:r?.name||residentId,x:ax,y:ay,facing:'down'});s.zones.push(zone('resident',`Talk to ${r?.name||'your neighbour'}`,ax-80,ay-70,160,180,'resident',{resident:residentId}));
 }else{
  // Starter essentials are fixed; the large studio is kept free for decor.
  addItem(s,'furniture-1-180',right+190,425,240,180);addItem(s,'decor-08-02',w-95,425,130,175);addItem(s,'decor-08-09',95,1060,145,210);
  s.zones.push(zone('decorate','Decorate your apartment',mid-190,715,380,300,'decorate'));
  sign(s,'YOUR ROOFTOP STUDIO',mid,690,26);
 }
 for(const x of wide?[220,mid,w-220]:[190,w-190])windowAt(s,x,20,155);
 sign(s,player?'15A':r?.number||'',mid,98,22);sign(s,player?'Make room for your own rhythm.':r?.theme||'',mid,1074,22);
 s.zones.push(zone('hall','Return to the hall',mid-105,h-210,210,175,'exit',{floor:s.floor}));s.spawn={x:mid,y:h-145};
 light(s,bx,210,250);light(s,kx,650,250);light(s,mid,840,350);return s;
}
function shop(){
 const s=shell('furniture-store','Coda Furnishings · Eight Rooms',STORE_FOOTPRINT.width,STORE_FOOTPRINT.height,'#665b58','#cda056');s.kind='shop';s.floor=1;
 applyShowroomLayout(s,{room,wall,addItem,rug,sign,light,zone,windowAt});return s;
}
function warmScene(scene){for(const item of scene.items)nativeCatalog?.get(item.asset)?.ensureFull?.().catch(()=>{});}
export function getInterior(scene={}){
 const requestedKind=scene.kind||'lobby',floor=Math.max(1,Math.min(15,Math.round(Number(scene.floor)||1))),kind=requestedKind==='hall'&&floor===1?'lobby':requestedKind,resident=scene.resident||'player',id=kind==='apartment'?`apartment-${resident}`:kind==='hall'?`tower-floor-${floor}`:kind==='shop'?'furniture-store':'tower-lobby';
 if(!sceneCache.has(id)){const s=kind==='apartment'?apartment(resident):kind==='hall'?hall(floor):kind==='shop'?shop():lobby();sceneCache.set(id,s);warmScene(s);}return sceneCache.get(id);
}
export function apartmentDecorBounds(scene){if(scene?.kind!=='apartment'||scene.resident!=='player')return null;return [rect(1584,512,656,540),rect(710,130,780,500)];}
function fill(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function floor(c,x,y,w,h,tile=false){
 c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 if(!tile&&woodTexture){const p=c.createPattern(woodTexture,'repeat');c.fillStyle=p;c.fillRect(x,y,w,h);fill(c,x,y,w,h,'#493b3624');}
 else if(tile){const step=48;fill(c,x,y,w,h,'#526d63');for(let yy=y;yy<y+h;yy+=step)for(let xx=x;xx<x+w;xx+=step){const odd=(Math.floor((xx-x)/step)+Math.floor((yy-y)/step))%2;fill(c,xx+2,yy+2,step-4,step-4,odd?'#b1a18a':'#d1bea2');fill(c,xx+4,yy+4,step-8,2,'#f5e6c888');fill(c,xx+4,yy+step-7,step-8,2,'#614c3c33');}}
 else{fill(c,x,y,w,h,'#94754f');for(let yy=y;yy<y+h;yy+=32)for(let xx=x-(Math.floor(yy/32)%2)*90;xx<x+w;xx+=180){fill(c,xx+2,yy+2,176,28,(Math.floor(xx/180)+Math.floor(yy/32))%3?'#b08e60':'#94754f');fill(c,xx+6,yy+6,158,2,'#c8aa77');fill(c,xx+20,yy+20,72,2,'#614c3c44');}}
 c.restore();
}
function carpet(c,r){
 fill(c,r.x+8,r.y+10,r.w,r.h,'#302c3138');fill(c,r.x,r.y,r.w,r.h,'#493b36');fill(c,r.x+4,r.y+4,r.w-8,r.h-8,'#c8aa77');fill(c,r.x+10,r.y+10,r.w-20,r.h-20,r.color);fill(c,r.x+17,r.y+17,r.w-34,r.h-34,'#302c3128');
 for(let y=r.y+28;y<r.y+r.h-22;y+=32)for(let x=r.x+28;x<r.x+r.w-22;x+=32){fill(c,x,y,4,4,'#e0c69566');if(x<r.x+46||x>r.x+r.w-52||y<r.y+46||y>r.y+r.h-52){fill(c,x-5,y+5,14,3,'#c8aa77');fill(c,x,y-4,4,17,'#c8aa77');}}
}
function plasterWall(c,r,color,trim){
 fill(c,r.x+12,r.y+16,r.w,r.h,'#16232b32');fill(c,r.x,r.y,r.w,r.h,'#614c3c');fill(c,r.x+3,r.y+3,r.w-6,r.h-6,color);
 if(r.w>r.h){fill(c,r.x+3,r.y+4,r.w-6,7,trim);fill(c,r.x+3,r.y+r.h-12,r.w-6,4,'#302c3155');fill(c,r.x+3,r.y+r.h-5,r.w-6,4,trim);}else{fill(c,r.x+3,r.y+3,5,r.h-6,trim);fill(c,r.x+r.w-7,r.y+3,4,r.h-6,'#302c3155');}
}
function drawWindow(c,x,y,w,color){
 const h=74;fill(c,x-w/2-12,y-6,w+24,h+12,'#614c3c');fill(c,x-w/2-8,y-2,w+16,h+4,'#e0c695');fill(c,x-w/2,y+6,w,h-12,'#3b4a61');
 for(let i=0;i<4;i++){fill(c,x-w/2+6+i*w/4,y+12,w/4-10,h-24,['#8fbfc1','#61a0a7','#99a6b5','#72859b'][i]);fill(c,x-w/2+8+i*w/4,y+14,4,h-28,'#c1dcd066');}
 fill(c,x-w/2,y+32,w,5,'#e0c695');fill(c,x-w/2-8,y+68,w+16,12,'#94754f');fill(c,x-w/2-6,y+68,w+12,3,'#f5e6c8');
 for(const xx of [x-w/2-18,x+w/2+7]){fill(c,xx,y-4,14,82,color);fill(c,xx+3,y,3,74,'#e8d6b377');}
}
function door(c,d){
 fill(c,d.x-d.w/2-12,d.y-6,d.w+24,d.h+18,'#614c3c');fill(c,d.x-d.w/2-6,d.y,d.w+12,d.h+6,'#c8aa77');fill(c,d.x-d.w/2,d.y+4,d.w,d.h-3,d.color||'#526d63');
 for(const yy of [d.y+16,d.y+102]){fill(c,d.x-d.w/2+14,yy,d.w-28,64,'#302c3144');fill(c,d.x-d.w/2+18,yy+4,d.w-36,3,'#f5e6c855');}fill(c,d.x+d.w/2-21,d.y+104,7,18,'#ebc679');
 fill(c,d.x-29,d.y+30,58,26,'#493b36');c.fillStyle='#ffe1a0';c.font='bold 18px Georgia';c.textAlign='center';c.fillText(d.number,d.x,d.y+50);fill(c,d.x-d.w/2-6,d.y+d.h,d.w+12,7,'#e0c695');
}
function elevator(c,e){
 fill(c,e.x-14,e.y-10,e.w+28,e.h+22,'#493b36');fill(c,e.x-7,e.y-4,e.w+14,e.h+12,'#cda056');fill(c,e.x,e.y+2,e.w,e.h,'#3b4a61');
 for(let x=e.x+5;x<e.x+e.w-5;x+=16){fill(c,x,e.y+8,12,e.h-16,(Math.floor(x/16)%2)?'#758879':'#99a6b5');fill(c,x+1,e.y+10,2,e.h-20,'#c1c9c5');}
 fill(c,e.x+e.w/2-3,e.y+4,6,e.h-4,'#493b36');fill(c,e.x+e.w+21,e.y+e.h*.45,20,45,'#614c3c');fill(c,e.x+e.w+27,e.y+e.h*.45+8,8,8,'#ebc679');fill(c,e.x+e.w+27,e.y+e.h*.45+27,8,8,'#c1dcd0');
 fill(c,e.x+e.w/2-34,e.y-37,68,24,'#302c31');c.fillStyle='#ffe1a0';c.font='bold 17px monospace';c.textAlign='center';c.fillText(String(e.floor).padStart(2,'0'),e.x+e.w/2,e.y-19);
}
function stairs(c,s){
 fill(c,s.x-7,s.y-4,s.w+14,s.h+14,'#493b36');const count=8;
 for(let i=0;i<count;i++){const y=s.y+i*s.h/count;fill(c,s.x,y,s.w,s.h/count-2,['#b1a18a','#d1bea2','#b1a18a','#958578'][s.up?i%4:(7-i)%4]);fill(c,s.x+4,y+2,s.w-8,3,'#f5e6c8');fill(c,s.x+4,y+s.h/count-5,s.w-8,3,'#614c3c');}
 for(const x of [s.x-8,s.x+s.w+1]){fill(c,x,s.y-8,7,s.h+24,'#493b36');fill(c,x,s.y-8,3,s.h+24,'#cda056');}
}
function background(s){
 if(backgroundCache.has(s.id))return backgroundCache.get(s.id);const cv=document.createElement('canvas');cv.width=s.width;cv.height=s.height;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
 floor(c,0,0,s.width,s.height);for(const r of s.rooms){if(r.floorFinish)drawShowroomFloor(c,r);else if(r.material==='tile')floor(c,r.x,r.y,r.w,r.h,true);}for(const r of s.rugs)carpet(c,r);
 // Full-height north facade, low cutaway south and side edges.
 plasterWall(c,rect(0,0,s.width,106),s.color,s.trim);plasterWall(c,rect(0,0,28,s.height),s.color,s.trim);plasterWall(c,rect(s.width-28,0,28,s.height),s.color,s.trim);plasterWall(c,rect(0,s.height-28,s.width,28),s.color,s.trim);
 // Wainscoting and fine masonry add depth without changing collision.
 for(let x=48;x<s.width-40;x+=62){fill(c,x,14,50,2,'#f5e6c833');fill(c,x,91,50,3,'#302c3144');fill(c,x+1,72,2,19,'#e0c69566');}
 for(const r of s.walls)plasterWall(c,r,r.color||s.color,r.trim||s.trim);for(const r of s.rooms)if(r.wallpaper)drawShowroomWallpaper(c,r);for(const w of s.windows)drawWindow(c,w.x,w.y,w.w,s.color);
 for(const d of s.doors||[])door(c,d);if(s.elevator)elevator(c,s.elevator);for(const st of s.stairs||[])stairs(c,st);
 if(s.directory){const r=s.directory;fill(c,r.x-10,r.y-8,r.w+20,r.h+16,'#614c3c');fill(c,r.x-4,r.y-2,r.w+8,r.h+4,'#cda056');fill(c,r.x+4,r.y+6,r.w-8,r.h-12,'#293246');c.textAlign='center';c.font='bold 15px Georgia';c.fillStyle='#e0c695';c.fillText('DIRECTORY',r.x+r.w/2,r.y+30);c.font='11px Georgia';for(let f=2;f<=15;f++){const names=f===15?'Your studio':residents.filter(n=>n.floor===f).map(n=>n.name.split(' ')[0]).join(' · ');c.fillStyle='#d1bea2';c.fillText(`${String(f).padStart(2,'0')}  ${names}`,r.x+r.w/2,r.y+34+f*14);}}
 for(const t of s.signs){c.textAlign='center';c.font=`${t.size>25?'bold ':''}${t.size}px Georgia`;c.fillStyle='#302c3155';c.fillText(t.text,t.x+2,t.y+2);c.fillStyle=t.size>25?'#ebc679':'#c8aa77';c.fillText(t.text,t.x,t.y);}
 // Warm pools from wall sconces sit underneath characters and furnishings.
 for(const l of s.lights){const glow=c.createRadialGradient(l.x,l.y,0,l.x,l.y,l.r);glow.addColorStop(0,'#ffe1a010');glow.addColorStop(1,'#ffe1a000');c.fillStyle=glow;c.fillRect(l.x-l.r,l.y-l.r,l.r*2,l.r*2);}
 backgroundCache.set(s.id,cv);return cv;
}
function drawItem(c,item){
 const a=nativeCatalog?.get(item.asset);if(!a)return;const scale=Number.isFinite(item.scale)&&item.scale>0?item.scale:1,w=item.w||a.w*scale,h=item.h||w*a.h/a.w;
 c.save();c.fillStyle='#16232b30';c.beginPath();c.ellipse(item.x,item.y-3,w*.39,Math.max(5,w*.045),0,0,Math.PI*2);c.fill();c.imageSmoothingEnabled=false;c.drawImage(assetImage(a),item.x-w/2,item.y-h,w,h);c.restore();
}
export function residentInteractionZones(actors=[]){
 return actors.filter(a=>!a.hidden&&Number.isFinite(a.x)&&Number.isFinite(a.y)).map(a=>zone(`resident-${a.id}`,`Talk to ${a.name||residents.find(r=>r.id===a.id)?.name||'your neighbour'}`,a.x-72,a.y-64,144,144,'resident',{resident:a.id}));
}
export function renderInterior(c,scene,{player,drawPlayer,time=0,decor=[],catalog,actors}={}){
 if(catalog&&catalog!==nativeCatalog)configureUrbanInteriors(catalog);const s=getInterior(scene);c.drawImage(background(s),0,0);
 const queue=s.items.map(item=>({y:item.y,draw:()=>drawItem(c,item)}));
 for(const item of decor){if(!item||!nativeCatalog?.has(item.asset)||!Number.isFinite(item.x)||!Number.isFinite(item.y))continue;queue.push({y:item.y,draw:()=>drawItem(c,item)});}
 const people=Array.isArray(actors)?actors:s.actors;
 if(people.length&&!npcRenderer&&typeof window!=='undefined'&&window.createCodaCharacterRenderer)npcRenderer=window.createCodaCharacterRenderer({worldScale:2.5});
 for(const a of people)if(!a.hidden)queue.push({y:a.y,draw:()=>npcRenderer?.drawNPC(c,a,time)});
 if(player&&drawPlayer)queue.push({y:player.y,draw:()=>drawPlayer(c,player)});queue.sort((a,b)=>a.y-b.y);for(const o of queue)o.draw();
}
