import {configureUrbanInteriors,getInteriorBase,residents} from '../world/urban-interiors.mjs?v=town-compact-island-1';
import {SHOWROOMS} from '../world/showroom-layout.mjs?v=town-room-placement-2';
import {createRoomRugItems} from '../world/room-rugs.mjs?v=town-victorian-default-1';

/** Register lazy room artwork only in the caller's private review catalog. */
export function registerReviewRoomRugs(catalog){
 if(!(catalog instanceof Map))throw new TypeError('Room-rug review needs a private asset Map.');
 configureUrbanInteriors(catalog);
 const descriptors=[...residents.map(resident=>({kind:'apartment',resident:resident.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(showroom=>({kind:'showroom',showroomId:showroom.id}))],seen=new Set(),enriched=new Set();
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
