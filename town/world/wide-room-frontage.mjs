import {drawInteriorDoor} from './interior-portal-art.mjs?v=opera-parallax-1';
import {WIDE_ROOM_EXTERIOR_DEPTH} from './wide-room-shell.mjs?v=town-wide-rooms-1';

// The exterior is a projection below the playable floor. Its upright entrance
// follows the real portal's X, without moving that portal or its collision.
const PRIVATE_OPENING=36,DOOR_FLOOR_OFFSET=78;
const validColor=color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color);
const color=(value,fallback)=>validColor(value)?value:fallback;
const mix=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
const pixel=(c,x,y,w,h,value)=>{if(w<=0||h<=0)return;c.fillStyle=value;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const seedOf=value=>[...String(value)].reduce((seed,char)=>Math.imul(seed^char.charCodeAt(0),16777619)>>>0,2166136261);
const grain=(seed,x,y)=>(Math.imul(x+17,73856093)^Math.imul(y+31,19349663)^seed)>>>0;

export function wideRoomSouthExteriorGeometry(scene){
 if(!scene?.wideRoomExpansion||!['apartment','showroom'].includes(scene.kind)||!Number.isFinite(scene.width)||!Number.isFinite(scene.height)||scene.width<120||scene.height<140)return null;
 const threshold=scene.portalExit?.threshold,exit=scene.zones?.find(zone=>zone.action==='exit'&&!['stair-up','stair-down'].includes(zone.id));
 const rawX=threshold?.x??scene.exit?.x??(exit?exit.x+exit.w/2:scene.width/2);
 if(!Number.isFinite(rawX))return null;
 const x=Math.max(44,Math.min(scene.width-44,rawX)),seam=scene.height-28,floorY=scene.height+DOOR_FLOOR_OFFSET,half=PRIVATE_OPENING/2;
 const suite=scene.homeMaterialSuite,trim=suite?.trim||{},owner=scene.collectionOwner||scene.showroomId||scene.resident||scene.id||'';
 const wood=color(trim.wood,color(scene.color,'#7b6754')),light=color(trim.light,color(scene.trim,'#d6c09b')),dark=color(trim.shadow,'#3b3430'),metal=color(trim.metal,'#ab8c58');
 const wall=color(suite?.wallpaper?.presentation?.color,mix(wood,light,.72)),base=mix(wall,'#788780',.16);
 const style=/cyberpunk|retrofuture|robot/.test(owner)?'metal':/industrial/.test(owner)?'brick':/coastal|rustic|haydn|vivaldi/.test(owner)?'siding':'stone';
 const parts=[{x:0,y:seam,w:x-half,h:WIDE_ROOM_EXTERIOR_DEPTH+28},{x:x+half,y:seam,w:scene.width-x-half,h:WIDE_ROOM_EXTERIOR_DEPTH+28}];
 const source=scene.portalExit?.door||{},number=scene.residentInfo?.number||(scene.resident==='player'?'15A':'');
 const door={...source,id:source.id||scene.portalExit?.doorId||'south-entry',threshold:{x,y:floorY},enterNormal:{x:0,y:1},facing:'down',w:PRIVATE_OPENING+24,h:106,triggerHalfWidth:half,color:wood,trim:metal,...(number?{number}:{})};
 // An axis would select the overhead privacy renderer. This entrance is an
 // upright exterior projection, even when its physical source is virtual.
 delete door.axis;delete door.length;
 return {bounds:{x:0,y:seam,w:scene.width,h:WIDE_ROOM_EXTERIOR_DEPTH+28},seam,floorY,opening:{x:x-half,y:seam,w:PRIVATE_OPENING,h:floorY-seam},parts,door,owner,style,palette:{wood,light,dark,metal,base,highlight:mix(base,light,.4),shade:mix(base,dark,.3)},seed:seedOf(owner)};
}

function masonry(c,g){
 const {seam,palette:p,style,seed}=g,top=seam+10,bottom=g.floorY-17;
 if(style==='siding'){
  for(let y=top,row=0;y<bottom;y+=12,row++){
   pixel(c,0,y,g.bounds.w,12,mix(p.base,p.wood,(row%4)*.025));pixel(c,0,y,g.bounds.w,1,p.shade);pixel(c,0,y+2,g.bounds.w,1,p.highlight);
   for(let x=8;x<g.bounds.w;x+=67){const at=x+grain(seed,row,x)%20;pixel(c,at,y+6,20+grain(seed,x,row)%22,1,mix(p.base,p.wood,.16));pixel(c,at+15,y+9,9,1,mix(p.base,p.light,.14));}
  }
 }else{
  const brick=style==='brick',metal=style==='metal',w=brick?56:metal?96:88,h=brick?16:metal?72:24;
  pixel(c,0,top,g.bounds.w,bottom-top,p.shade);
  for(let y=top,row=0;y<bottom;y+=h,row++)for(let x=-w;x<g.bounds.w;x+=w){
   const xx=x+(!metal&&row%2?w/2:0),n=grain(seed,x,row),base=n%5===0?mix(p.base,p.wood,.08):p.base;
   pixel(c,xx+1,y+1,w-1,h-1,base);pixel(c,xx+2,y+2,w-4,1,p.highlight);pixel(c,xx+2,y+h-2,w-4,1,mix(base,p.dark,.17));
   for(let n=0;n<5;n++){const at=grain(seed+n,x,y);pixel(c,xx+5+at%(w-10),y+5+(at>>>9)%Math.max(1,h-9),1+at%2,1,at%2?mix(base,p.light,.15):mix(base,p.dark,.1));}
   if(metal){for(const dx of [5,w-6])for(const dy of [5,h-6]){pixel(c,xx+dx,y+dy,2,2,p.shade);pixel(c,xx+dx,y+dy,1,1,p.light);}pixel(c,xx+11,y+13,18,1,p.metal);}
  }
 }
}

function wallPart(c,g,part){
 const {seam,floorY,palette:p}=g;
 c.save();c.beginPath();c.rect(part.x,part.y,part.w,part.h);c.clip();
 // The narrow top return and stepped cornice match the room's cutaway caps.
 pixel(c,0,seam,g.bounds.w,10,p.dark);pixel(c,1,seam+1,g.bounds.w-2,2,p.light);pixel(c,2,seam+3,g.bounds.w-4,3,p.wood);pixel(c,0,seam+7,g.bounds.w,2,p.metal);pixel(c,0,seam+9,g.bounds.w,3,mix(p.dark,p.wood,.42));
 c.save();c.beginPath();c.rect(0,seam+10,g.bounds.w,floorY-seam-27);c.clip();masonry(c,g);c.restore();
 // Short pilasters and a recessed skirting course give the front a finished
 // exterior face rather than a stretched rectangle of interior wallpaper.
 for(let x=12;x<g.bounds.w;x+=176){
  pixel(c,x,seam+12,12,floorY-seam-28,p.shade);pixel(c,x+1,seam+13,3,floorY-seam-30,p.highlight);pixel(c,x+9,seam+13,2,floorY-seam-30,mix(p.base,p.dark,.2));
  for(const y of [seam+11,floorY-19]){pixel(c,x-3,y,18,4,p.dark);pixel(c,x-2,y+1,16,2,p.light);}
 }
 pixel(c,0,floorY-18,g.bounds.w,3,p.dark);pixel(c,1,floorY-17,g.bounds.w-2,1,p.light);pixel(c,0,floorY-14,g.bounds.w,14,p.wood);
 for(let x=6;x<g.bounds.w;x+=32){pixel(c,x,floorY-11,24,1,mix(p.wood,p.light,.2));pixel(c,x+25,floorY-11,1,8,p.dark);}
 pixel(c,0,floorY,g.bounds.w,5,p.dark);pixel(c,0,floorY+1,g.bounds.w,2,p.light);pixel(c,2,floorY+5,g.bounds.w-4,8,mix(p.base,p.dark,.4));pixel(c,4,floorY+13,g.bounds.w-8,5,p.dark);
 // Two recessed shadow steps stay within the shared 108px visual allowance.
 pixel(c,5,floorY+18,g.bounds.w-10,4,'#111b2360');pixel(c,9,floorY+22,g.bounds.w-18,4,'#111b2330');
 c.restore();
}

/** Static architecture: paint once with the interior's cached background. */
export function drawWideRoomSouthExterior(c,scene){
 const g=wideRoomSouthExteriorGeometry(scene);if(!g)return null;
 c.save();c.imageSmoothingEnabled=false;
 try{
  for(const part of g.parts)wallPart(c,g,part);
  const {palette:p,seam,door}=g;
  // Small brass/glass entry lanterns keep the passage readable at fit zoom.
  for(const side of [-1,1]){const x=door.threshold.x+side*43-4,y=seam+44;
   pixel(c,x+3,y-8,2,8,p.dark);pixel(c,x-2,y,12,3,p.dark);pixel(c,x,y+3,8,15,p.dark);pixel(c,x+2,y+4,4,10,'#e4ca86');pixel(c,x+2,y+4,1,8,'#fff1c3');pixel(c,x+1,y+17,6,2,p.metal);
  }
 }finally{c.restore();}return g;
}

/** Animate the existing front-door art without touching its automatic state. */
export function drawWideRoomEntrance(c,scene,openness=0){
 const g=wideRoomSouthExteriorGeometry(scene);if(!g)return null;
 const p=g.palette,result=drawInteriorDoor(c,g.door,openness,{theme:g.owner,palette:{frame:p.wood,trim:p.metal,light:p.light,dark:p.dark}}),x=g.door.threshold.x,y=g.floorY;
 c.save();try{
  // A shallow exterior doorstep finishes the opening below the real door
  // frame, without bridging its cap or the clear passage above the sill.
  pixel(c,x-25,y+9,50,5,p.dark);pixel(c,x-24,y+9,48,2,p.light);pixel(c,x-23,y+14,46,5,mix(p.base,p.dark,.24));pixel(c,x-22,y+14,44,1,p.highlight);pixel(c,x-21,y+19,42,4,'#111b2360');
 }finally{c.restore();}return result;
}
