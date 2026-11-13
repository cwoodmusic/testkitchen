/** A southward addition to finalized private rooms, after furniture calibration. */
export const WIDE_ROOM_EXTRA_DEPTH=64;
export const WIDE_ROOM_EXTERIOR_DEPTH=108;
const EPS=1e-6;
const same=(a,b)=>Math.abs(a-b)<EPS;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function freezeDeep(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeDeep);Object.freeze(value);}return value;}
const signatureGeometry=scene=>({id:scene.id,width:scene.width,height:scene.height,walls:copy(scene.walls),privacyDoors:copy(scene.privacyDoors)});
const shifted=p=>({...p,y:p.y+WIDE_ROOM_EXTRA_DEPTH});
const qualifies=scene=>['apartment','showroom'].includes(scene?.kind)&&Number.isFinite(scene.width)&&Number.isFinite(scene.height)&&(scene.kind==='showroom'||scene.width>scene.height*1.8);

/** Preserve the original signature and every furnishing while adding usable floor. */
export function expandWideRoomShell(scene){
 if(!qualifies(scene)||scene.wideRoomExpansion)return scene;
 const previousHeight=scene.height,previousFloorBottom=previousHeight-28,newFloorBottom=previousFloorBottom+WIDE_ROOM_EXTRA_DEPTH,previousSpawn=point(scene.spawn)?{...scene.spawn}:undefined;
 scene.roomLayoutSignatureFrame=freezeDeep(signatureGeometry(scene));
 const walls=scene.walls||[],continuations=walls.filter(w=>w.w<=32&&w.h>w.w&&w.x>0&&w.x+w.w<scene.width&&same(w.y+w.h,previousFloorBottom)).map(w=>({...w,y:previousFloorBottom,h:WIDE_ROOM_EXTRA_DEPTH}));
 const extendShell=r=>{
  if(same(r.y,0)&&same(r.h,previousHeight)&&same(r.w,28)&&(same(r.x,0)||same(r.x,scene.width-28)))return {...r,h:previousHeight+WIDE_ROOM_EXTRA_DEPTH};
  if(same(r.x,0)&&same(r.y,previousFloorBottom)&&same(r.w,scene.width)&&same(r.h,28))return {...r,y:newFloorBottom};
  return r;
 };
 scene.walls=[...walls.map(extendShell),...continuations];
 scene.solids=[...(scene.solids||[]).map(extendShell),...continuations.map(({x,y,w,h})=>({x,y,w,h}))];
 // South rooms use either the shell line itself or an eight-pixel floor inset.
 // Keep their original inset, finishes, and furniture calibration zones.
 scene.rooms=(scene.rooms||[]).map(room=>{
  let next=room;
  if(['kitchen','dining'].includes(room.functionalRole))return next;
  const bottom=room.y+room.h;
  if(bottom>=previousFloorBottom-8-EPS&&bottom<=previousFloorBottom+EPS)next={...next,h:room.h+WIDE_ROOM_EXTRA_DEPTH};
  const field=room.floorBounds;
  if(field&&field.y+field.h>=previousFloorBottom-8-EPS&&field.y+field.h<=previousFloorBottom+EPS)next={...next,floorBounds:{...field,h:field.h+WIDE_ROOM_EXTRA_DEPTH}};
  return next;
 });
 const exitZone=(scene.zones||[]).find(z=>z.action==='showroom-lobby'||z.action==='exit'),oldPortal=scene.portalExit;
 const oldThreshold=point(oldPortal?.threshold)?oldPortal.threshold:point(scene.exit)?scene.exit:{x:exitZone?exitZone.x+exitZone.w/2:scene.width/2,y:previousFloorBottom};
 const threshold=shifted(oldThreshold),doorId=oldPortal?.doorId||oldPortal?.door?.id||exitZone?.doorId||exitZone?.id||scene.id+'-exit',triggerHalfWidth=oldPortal?.triggerHalfWidth||exitZone?.triggerHalfWidth||18,enterNormal=oldPortal?.enterNormal||{x:0,y:-1};
 scene.portalExit={...oldPortal,doorId,threshold,enterNormal:{...enterNormal},triggerHalfWidth,clearOpening:true,
  door:{...oldPortal?.door,id:doorId,threshold:{...threshold},enterNormal:{x:-enterNormal.x||0,y:-enterNormal.y||0},triggerHalfWidth,virtual:true,clearOpening:true}};
 if(point(scene.exit))scene.exit=shifted(scene.exit);
 if(previousSpawn)scene.spawn=shifted(previousSpawn);
 scene.zones=(scene.zones||[]).map(z=>z.action==='showroom-lobby'||z.action==='exit'?{...z,y:z.y+WIDE_ROOM_EXTRA_DEPTH,...(point(z.threshold)?{threshold:shifted(z.threshold)}:{})}:z);
 scene.height=previousHeight+WIDE_ROOM_EXTRA_DEPTH;
 scene.wideRoomExpansion=freezeDeep({previousHeight,depth:WIDE_ROOM_EXTRA_DEPTH,previousFloorBottom,newFloorBottom,previousSpawn,previousThreshold:{...oldThreshold},signatureGeometry:signatureGeometry(scene)});
 return scene;
}

/** Front-wall artwork is visible outside the playable room's physical bounds. */
export function getInteriorVisualBounds(scene){
 return {x:0,y:0,w:scene.width,h:scene.height+(scene.wideRoomExpansion?WIDE_ROOM_EXTERIOR_DEPTH:0)};
}
