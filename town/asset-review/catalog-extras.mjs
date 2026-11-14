import {configureUrbanInteriors,getInteriorBase,residents} from '../world/urban-interiors.mjs?v=town-front-facing-2';
import {SHOWROOMS} from '../world/showroom-layout.mjs?v=town-room-placement-2';
import {createRoomRugItems} from '../world/room-rugs.mjs?v=town-library-review-1';
import {drawShowroomFloor,drawShowroomWallpaper,prepareShowroomFinish} from '../world/showroom-materials.mjs?v=town-library-review-1';
import {finishRepeatSize} from './material-repeat-sizes.mjs?v=town-library-review-1';

function reviewInteriorDescriptors(){return [...residents.map(resident=>({kind:'apartment',resident:resident.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(showroom=>({kind:'showroom',showroomId:showroom.id}))];}

/** Register lazy room artwork only in the caller's private review catalog. */
export function registerReviewRoomRugs(catalog){
 if(!(catalog instanceof Map))throw new TypeError('Room-rug review needs a private asset Map.');
 configureUrbanInteriors(catalog);
 const descriptors=reviewInteriorDescriptors(),seen=new Set(),enriched=new Set();
 function visit(scene){
  if(!scene||seen.has(scene))return;seen.add(scene);
  for(const item of createRoomRugItems(scene,catalog)){
   if(enriched.has(item.asset))continue;enriched.add(item.asset);
   const original=catalog.get(item.asset);if(original.group==='room rugs'&&original.roomId===scene.id)continue;
   const asset=Object.defineProperties({},Object.getOwnPropertyDescriptors(original));
   // Copy metadata before enriching: an existing rug may still be shared with
   // the game catalog. Its drawing and lazy canvas getter stay untouched.
   Object.assign(asset,{group:'room rugs',name:original.name+' · '+scene.title,pack:'room-rugs',owner:scene.collectionOwner||scene.resident||scene.id,sourceAssetId:item.asset,roomId:scene.id,roomTitle:scene.title});
   catalog.set(item.asset,asset);
  }
  for(const prior of scene.roomLayoutLegacySources||[])visit(prior);
 }
 for(const descriptor of descriptors)visit(getInteriorBase(descriptor));
 return catalog;
}

/** Current room finishes are private review entries, never placeable game stock. */
export function registerReviewMaterials(catalog){
 if(!(catalog instanceof Map))throw new TypeError('Material review needs a private asset Map.');
 configureUrbanInteriors(catalog);
 const finishes=new Set();
 function add(finish,kind,scene,room,area){
  if(!finish)return;
  const owner=finish.owner||scene.collectionOwner||scene.resident||scene.id;
  const finishId=finish.id||finish.pattern;
  if(!finishId)throw Error('Room material needs a stable finish identity.');
  const key=kind+'|'+owner+'|'+finishId;if(finishes.has(key))return;finishes.add(key);
  const id='finish:'+kind+':'+finishId;
  if(catalog.has(id))return;
  const repeat=finishRepeatSize(finish,kind),origin={x:area?.x??room?.x??0,y:area?.y??room?.y??0};
  const w=repeat.w,h=kind==='floor'?repeat.h:area?.h||106;
  const paint=(c,width,height)=>{
   c.save();try{
    c.translate(-origin.x,-origin.y);
    const bounds={x:origin.x,y:origin.y,w:width,h:height};
    // One field preserves world phase; wall caps/dado occur once per run.
    if(kind==='floor')drawShowroomFloor(c,{...bounds,floorFinish:finish});
    else drawShowroomWallpaper(c,{x:room?.x??origin.x,y:room?.y??origin.y,wallpaper:finish,wallpaperAreas:[bounds]});
   }finally{c.restore();}
  };
  catalog.set(id,{id,name:(finish.name||finish.label||finishId)+' · '+(kind==='floor'?'floor':'wallpaper'),group:kind==='floor'?'interior floors':'interior walls',
   w,h,facing:'south',furnitureFacing:false,layer:'ground',pack:'interior-materials',owner,collectionOwner:owner,purpose:kind==='floor'?'floor finish':'wallpaper finish',
   finishId,finishKind:kind,materialFinish:finish,texture:finish.texture||null,roomId:scene.id,roomTitle:scene.title,materialOrigin:origin,
   reviewSample:{kind,columns:3,rows:kind==='floor'?3:1,label:kind==='floor'?'3×3 tiled sample':'connected wall sample'},
   ensureFull:()=>prepareShowroomFinish(finish,kind),draw:c=>paint(c,w,h),drawReviewSample:(c,width,height)=>paint(c,width,height)});
 }
 for(const descriptor of reviewInteriorDescriptors()){
  const scene=getInteriorBase(descriptor);if(!scene)continue;
  add(scene.homeMaterialSuite?.floor,'floor',scene,null,null);
  for(const room of scene.rooms||[]){
   if(room.portalRoom)continue;
   if(room.floorOverlay!==false)add(room.floorFinish,'floor',scene,room,null);
   if(room.wallpaperAreas?.length)add(room.wallpaper,'wall',scene,room,room.wallpaperAreas[0]);
  }
 }
 return catalog;
}

/** Repeat only actual wall bays; framed pictures, corners and posts stay single. */
export function registerReviewWallSegments(catalog){
 for(const id of ['construction-3','construction-4','construction-5','music-square-wall']){
  const original=catalog.get(id);if(!original||original.reviewSample)continue;
  const asset=Object.defineProperties({},Object.getOwnPropertyDescriptors(original));
  asset.reviewSample={kind:'wall',columns:3,rows:1,label:'connected wall sample',...(id==='music-square-wall'?{stepX:424}:{})};
  catalog.set(id,asset);
 }
 return catalog;
}

export function registerReviewGroundSurfaces(catalog,{surfaces,groundTexture}){
 for(const surface of surfaces){
  const id='surface:'+surface;
  catalog.set(id,{id,name:surface[0].toUpperCase()+surface.slice(1)+' ground texture',group:'ground textures',w:512,h:512,facing:'south',layer:'ground',
   reviewSample:{kind:'floor',columns:3,rows:3,label:'3×3 tiled sample'},draw(c){c.drawImage(groundTexture(surface),0,0,512,512);}});
 }
 return catalog;
}
