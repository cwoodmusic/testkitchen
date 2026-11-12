import {getElevatorVisualGeometry} from './interior-portal-art.mjs?v=opera-parallax-1';

const NORTH_SHELL_DEPTH=106;
const valid=r=>r&&[r.x,r.y,r.w,r.h].every(Number.isFinite)&&r.w>0&&r.h>0;
const rect=(x,y,w,h)=>({x,y,w,h});
function subtract(r,cut){
 const x=Math.max(r.x,cut.x),y=Math.max(r.y,cut.y),right=Math.min(r.x+r.w,cut.x+cut.w),bottom=Math.min(r.y+r.h,cut.y+cut.h);
 if(right<=x||bottom<=y)return[r];
 return[rect(r.x,r.y,r.w,y-r.y),rect(r.x,bottom,r.w,r.y+r.h-bottom),rect(r.x,y,x-r.x,bottom-y),rect(right,y,r.x+r.w-right,bottom-y)].filter(valid);
}

/** Match the existing public portals' floor planes, without moving a doorway. */
export function applyTowerCommonArchitecture(scene){
 if(!['lobby','hall','shop'].includes(scene?.kind)||scene.towerArchitecture)return scene;
 const common=scene.kind!=='shop',doors=common?(scene.doors||[]).filter(d=>!d.axis&&!['left','right'].includes(d.facing)):[],stairs=common?(scene.stairs||[]).filter(valid):[];
 const elevator=scene.elevator?getElevatorVisualGeometry(scene.elevator):null;
 const northWallDepth=common?Math.max(NORTH_SHELL_DEPTH,...doors.map(d=>d.threshold?.y??d.floorY??d.y+d.h),elevator?.floorY??NORTH_SHELL_DEPTH):NORTH_SHELL_DEPTH;
 const doorwayChannels=doors.map(d=>{
  const x=d.threshold?.x??d.x,floorY=d.threshold?.y??d.floorY??d.y+d.h,half=d.triggerHalfWidth??Math.max(0,(d.w-24)/2);
  return {...rect(x-half,NORTH_SHELL_DEPTH,half*2,floorY-NORTH_SHELL_DEPTH),id:d.id||d.number};
 }).filter(valid);
 const liftFootprint=elevator?rect(elevator.bounds.x,NORTH_SHELL_DEPTH,elevator.bounds.w,elevator.floorY-NORTH_SHELL_DEPTH):null;
 const facadeRecesses=[];
 if(common){
  const cuts=[...doorwayChannels,...stairs.map(st=>rect(st.x,NORTH_SHELL_DEPTH,st.w,northWallDepth-NORTH_SHELL_DEPTH)),...(liftFootprint?[{...liftFootprint,h:northWallDepth-NORTH_SHELL_DEPTH}]:[])];
  let backing=[rect(28,NORTH_SHELL_DEPTH,scene.width-56,northWallDepth-NORTH_SHELL_DEPTH)].filter(valid);
  for(const cut of cuts)backing=backing.flatMap(r=>subtract(r,cut));
  scene.solids.push(...backing);
  if(elevator&&elevator.floorY<northWallDepth)facadeRecesses.push({...rect(elevator.bounds.x,elevator.floorY,elevator.bounds.w,northWallDepth-elevator.floorY),kind:'lift'});
  for(const st of stairs){
   const floorY=st.y+st.h;
   if(floorY<northWallDepth)facadeRecesses.push({...rect(st.x,floorY,st.w,northWallDepth-floorY),kind:'stairs'});
   // These rails lie outside the flight, matching the existing stair drawing.
   for(const x of [st.x-8,st.x+st.w])scene.solids.push(rect(x,Math.max(NORTH_SHELL_DEPTH,st.y-8),8,st.h+24));
  }
 }
 if(valid(liftFootprint))scene.solids.push(liftFootprint);
 if(elevator)for(const zone of scene.zones||[]){
  // The glass is now physical architecture. Lift controls belong on the
  // landing in front of it, rather than inside the blocked facade.
  if(zone.id==='lift'||zone.action==='store-elevator')Object.assign(zone,{y:elevator.floorY+12,h:112});
 }
 if(scene.kind==='lobby'&&scene.directory&&elevator){
  const directory=scene.directory;
  directory.x=Math.min(directory.x,elevator.bounds.x-directory.w-24);
  directory.y=northWallDepth-directory.h-12;
  const zone=(scene.zones||[]).find(z=>z.id==='directory');
  if(zone)Object.assign(zone,{x:directory.x,y:northWallDepth+24,w:directory.w});
 }
 scene.towerArchitecture={northWallDepth,facadeRecesses,doorwayChannels,liftFootprint};
 return scene;
}
