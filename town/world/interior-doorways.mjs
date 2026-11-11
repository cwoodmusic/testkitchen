// Aperture sizes belong to the scene, independent of room/furniture scaling.
// Keep authored door centres and routes; close the retired sides of wide gaps.
export const PRIVATE_DOOR_CLEAR_WIDTH=36;
export const PUBLIC_DOOR_CLEAR_WIDTH=82;
const privateRoom=s=>s?.kind==='apartment'||s?.kind==='showroom';
const near=(a,b)=>Math.abs(a-b)<1e-6;
const along=(r,vertical)=>vertical?r.y:r.x;
const extent=(r,vertical)=>vertical?r.h:r.w;

function privacyAperture(scene,door){
 const vertical=door.axis==='vertical',oldLength=door.length;
 if(!Number.isFinite(oldLength)||oldLength<=0)return;
 door.clearOpening=true;
 if(oldLength<=PRIVATE_DOOR_CLEAR_WIDTH)return;
 const oldStart=vertical?door.y:door.x,oldEnd=oldStart+oldLength,centre=(oldStart+oldEnd)/2,start=centre-PRIVATE_DOOR_CLEAR_WIDTH/2,end=centre+PRIVATE_DOOR_CLEAR_WIDTH/2,line=vertical?door.x:door.y;
 const neighbours=(scene.walls||[]).filter(r=>{
  const cross=vertical?r.x:r.y,thickness=vertical?r.w:r.h;
  return line>=cross-1e-6&&line<=cross+thickness+1e-6&&(near(along(r,vertical)+extent(r,vertical),oldStart)||near(along(r,vertical),oldEnd));
 });
 if(!neighbours.length)throw Error('Privacy doorway has no matching wall ends: '+door.id);
 const band=neighbours[0];door.wallThickness=vertical?band.w:band.h;
 for(const [a,b,leading]of [[oldStart,start,true],[end,oldEnd,false]]){
  if(b<=a)continue;
  const adjacent=neighbours.find(r=>leading?near(along(r,vertical)+extent(r,vertical),oldStart):near(along(r,vertical),oldEnd));
  if(adjacent){
   const before={x:adjacent.x,y:adjacent.y,w:adjacent.w,h:adjacent.h},matches=scene.solids.filter(r=>near(r.x,before.x)&&near(r.y,before.y)&&near(r.w,before.w)&&near(r.h,before.h));
   const update=vertical?(leading?{h:before.h+b-a}:{y:a,h:before.h+b-a}):(leading?{w:before.w+b-a}:{x:a,w:before.w+b-a});
   // Extend the original wall itself so authored wall grain/trim has no new
   // end-cap seam; update its matching physical rectangle at the same time.
   Object.assign(adjacent,update);for(const solid of matches)Object.assign(solid,update);
  }else{
   const fill={...band,...(vertical?{y:a,h:b-a}:{x:a,w:b-a})};scene.walls.push(fill);scene.solids.push(fill);
  }
 }
 if(vertical)door.y=start;else door.x=start;
 door.length=PRIVATE_DOOR_CLEAR_WIDTH;
 // The room's optional doorway rectangle is interaction metadata, not a
 // second aperture; give it the same current bounds without mutating plans.
 const room=(scene.rooms||[]).find(r=>r.id===door.roomId||r.functionalRole===door.roomId);
 if(room?.door)room.door={...room.door,...(vertical?{y:start,h:door.length}:{x:start,w:door.length})};
}

function manualApertures(scene){
 const width=privateRoom(scene)?PRIVATE_DOOR_CLEAR_WIDTH:PUBLIC_DOOR_CLEAR_WIDTH;
 for(const door of scene.doors||[]){
  door.clearOpening=true;door.triggerHalfWidth=width/2;
  if(door.axis==='vertical'){door.y+=(door.length-width)/2;door.length=width;}
  else if(door.axis==='horizontal'){door.x+=(door.length-width)/2;door.length=width;}
  else door.w=width+24; // Upright front frames have twelve pixels per jamb.
 }
 for(const z of scene.zones||[]){
  if(!['room','showroom','showroom-lobby','exit'].includes(z.action)||z.id==='stair-down'||z.id==='stair-up')continue;
  z.clearOpening=true;z.triggerHalfWidth=width/2;
  if(z.action==='exit'){
   // The generic exit factory derives its clear span from this zone width.
   const cx=z.x+z.w/2;z.x=cx-width/2;z.w=width;
  }
 }
 const exit=scene.portalExit;
 if(exit?.threshold&&exit.enterNormal){
  exit.clearOpening=true;exit.triggerHalfWidth=width/2;
  exit.door={...(exit.door||{}),id:exit.doorId||exit.id||'apartment-exit',threshold:{...exit.threshold},enterNormal:{x:-exit.enterNormal.x,y:-exit.enterNormal.y},triggerHalfWidth:width/2,virtual:true,clearOpening:true};
 }
}

export function normalizeInteriorDoorways(scene){
 if(!scene||scene.kind==='concert')return scene;
 if(privateRoom(scene))for(const door of scene.privacyDoors||[])privacyAperture(scene,door);
 manualApertures(scene);
 return scene;
}
