import {drawShowroomWallpaper} from './showroom-materials.mjs?v=town-library-review-1';
import {getHomeMaterialCacheStats} from './home-materials.mjs?v=town-library-review-1';
import {drawInteriorDoor} from './interior-portal-art.mjs?v=opera-parallax-1';

const FACE_HEIGHT=96,EPS=.001,MAX_ENTRIES=48,MAX_PIXELS=4*1024*1024;
const geometryCache=new WeakMap(),textures=new Map();let pixels=0,builds=0;
const valid=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
const pixel=(c,x,y,w,h,color)=>{if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const clamp=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):1;

/** Existing horizontal south partitions, projected upward from their floor line. */
export function wideRoomSouthPartitionGeometry(scene){
 if(!scene?.wideRoomExpansion||!['apartment','showroom'].includes(scene.kind))return {groups:[]};
 if(geometryCache.has(scene))return geometryCache.get(scene);
 const rooms=(scene.rooms||[]).filter(r=>valid(r)&&!r.portalRoom&&r.functionalRole!=='apartment'),faces=rooms.flatMap(r=>(r.wallpaperAreas||[]).filter(valid)),groups=new Map();
 for(const wall of scene.walls||[]){
  if(!valid(wall)||wall.h>32||wall.w<=wall.h||wall.y>=scene.height-40)continue;
  const floorY=wall.y+wall.h/2;
  // Some room arrangements already expose this physical band as the native
  // north wall of the room below. Preserve that complete authored face.
  if(faces.some(face=>face.h>=64&&floorY>=face.y-EPS&&floorY<=face.y+face.h+EPS&&overlap(face,wall)>=wall.w-40))continue;
  const candidates=rooms.filter(r=>r.y+r.h<=wall.y+EPS&&wall.y-r.y-r.h<=32&&overlap(r,wall)>Math.min(wall.w,r.w)*.45).sort((a,b)=>(wall.y-a.y-a.h)-(wall.y-b.y-b.h)||overlap(b,wall)-overlap(a,wall));
  const room=candidates[0];if(!room)continue;
  const roomId=room.id||room.functionalRole||room.name,key=[roomId,floorY,wall.h].join('|');
  if(!groups.has(key))groups.set(key,{id:key,roomId,room:{x:room.x,y:room.y,w:room.w,h:room.h},floorY,thickness:wall.h,walls:[],doors:[]});
  groups.get(key).walls.push({...wall});
 }
 const trim=scene.homeMaterialSuite?.trim||{wood:scene.color||'#876348',light:scene.trim||'#d9c49b',shadow:'#3c342e',metal:'#ab8d59'},wallpaper=scene.homeMaterialSuite?.wallpaper||rooms.find(r=>r.functionalRole==='living')?.wallpaper||rooms.find(r=>r.functionalRole!=='bathroom'&&r.wallpaper)?.wallpaper;
 for(const group of groups.values()){
  const left=Math.min(...group.walls.map(w=>w.x)),right=Math.max(...group.walls.map(w=>w.x+w.w));
  group.doors=(scene.privacyDoors||[]).filter(d=>d.axis==='horizontal'&&Math.abs(d.y-group.floorY)<EPS&&Number.isFinite(d.x)&&Number.isFinite(d.length)&&d.length>0&&d.x>=left-EPS&&d.x+d.length<=right+EPS);
  group.faces=group.walls.map(w=>({x:w.x,y:group.floorY-FACE_HEIGHT,w:w.w,h:FACE_HEIGHT+group.thickness/2}));
  group.bounds={x:left,y:group.floorY-FACE_HEIGHT-4,w:right-left,h:FACE_HEIGHT+4+Math.max(14,group.thickness/2)};
  group.wallpaper=wallpaper;group.trim=trim;group.theme=scene.collectionOwner||scene.showroomId||scene.resident;
 }
 const result={groups:[...groups.values()].sort((a,b)=>a.floorY-b.floorY||a.bounds.x-b.bounds.x)};geometryCache.set(scene,result);return result;
}

function drop(group){const entry=textures.get(group);if(!entry)return;pixels-=entry.canvas.width*entry.canvas.height;entry.canvas.width=entry.canvas.height=0;textures.delete(group);}
export function clearWideRoomPartitionCache(scene){
 if(scene){for(const group of geometryCache.get(scene)?.groups||[])drop(group);return;}
 for(const group of [...textures.keys()])drop(group);
}
export const getWideRoomPartitionCacheStats=()=>({entries:textures.size,pixels,builds,maxEntries:MAX_ENTRIES,maxPixels:MAX_PIXELS});

function paintFace(c,group){
 const {trim:p,floorY,thickness}=group,top=floorY-FACE_HEIGHT;
 for(const face of group.faces){
  c.save();c.beginPath();c.rect(face.x,face.y,face.w,face.h);c.clip();
  if(group.wallpaper)drawShowroomWallpaper(c,{x:0,y:0,wallpaper:group.wallpaper,wallpaperAreas:[{x:face.x,y:top,w:face.w,h:FACE_HEIGHT}]});
  else pixel(c,face.x,top,face.w,FACE_HEIGHT,p.wood);
  // A consistent cap profile meets the existing vertical cutaway walls. The
  // face uses dry-room wallpaper even on the hallway side of a bathroom.
  pixel(c,face.x,top,face.w,6,p.shadow);pixel(c,face.x,top+1,face.w,2,p.light);pixel(c,face.x+1,top+3,face.w-2,2,p.wood);
  pixel(c,face.x,floorY-4,face.w,4,p.shadow);pixel(c,face.x,floorY-3,face.w,1,p.light);pixel(c,face.x,floorY,face.w,thickness/2,p.wood);pixel(c,face.x,floorY+thickness/2-1,face.w,1,p.shadow);
  for(const x of [face.x,face.x+face.w-3]){pixel(c,x,top+6,3,FACE_HEIGHT-10,p.wood);pixel(c,x,top+7,1,FACE_HEIGHT-12,p.light);}
  c.restore();
 }
}
function canvasFor(c,width,height){
 if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);
 const document=c.canvas?.ownerDocument||globalThis.document;if(!document?.createElement)return null;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;return canvas;
}
function drawFace(c,group,ready){
 let entry=textures.get(group);if(entry&&entry.ready!==ready){drop(group);entry=null;}
 if(!entry){
  const {bounds}=group,w=Math.ceil(bounds.w),h=Math.ceil(bounds.h),canvas=w*h<=MAX_PIXELS?canvasFor(c,w,h):null;
  if(!canvas){paintFace(c,group);return;}
  const cc=canvas.getContext('2d');cc.imageSmoothingEnabled=false;cc.translate(-bounds.x,-bounds.y);paintFace(cc,group);entry={canvas,ready};textures.set(group,entry);pixels+=w*h;builds++;
  while(textures.size>MAX_ENTRIES||pixels>MAX_PIXELS)drop(textures.keys().next().value);
 }else{textures.delete(group);textures.set(group,entry);}
 c.drawImage(entry.canvas,group.bounds.x,group.bounds.y);
}
function visualDoor(door){
 const visual={...door,threshold:{x:door.x+door.length/2,y:door.y},enterNormal:{x:0,y:-(door.swing||1)},swing:-(door.swing||1),w:door.length+24,h:96,triggerHalfWidth:door.length/2,facing:'down'};
 delete visual.axis;delete visual.length;return visual;
}
function focusBehind(group,player){
 return Number.isFinite(player?.x)&&Number.isFinite(player?.y)&&player.x>=group.room.x-18&&player.x<=group.room.x+group.room.w+18&&player.y>=group.room.y&&player.y<=group.floorY+12;
}

/** Depth-sort with furnishings and people at the unchanged physical wall line. */
export function wideRoomPartitionDrawables(c,scene,{player,doorOpenness=()=>0,opacity=1}={}){
 const {groups}=wideRoomSouthPartitionGeometry(scene);if(!groups.length)return [];
 const ready=getHomeMaterialCacheStats().ready;
 return groups.map(group=>{
  const alpha=clamp(opacity)*(focusBehind(group,player) ? .3 : 1);
  return {y:group.floorY,bounds:{...group.bounds},doors:group.doors,opacity:alpha,draw(){
   c.save();c.imageSmoothingEnabled=false;c.globalAlpha*=alpha;
   try{
    drawFace(c,group,ready);
    for(const door of group.doors)drawInteriorDoor(c,visualDoor(door),doorOpenness(door),{theme:group.theme,palette:{frame:group.trim.wood,trim:group.trim.metal,light:group.trim.light,dark:group.trim.shadow}});
   }finally{c.restore();}
  }};
 });
}
