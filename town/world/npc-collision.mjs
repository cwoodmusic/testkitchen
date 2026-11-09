// Plantings are destinations to walk around even when their optional player
// collision has been switched off. Keep this policy in derived NPC views;
// saved placements and the player's collision toggle remain untouched.
export const NPC_COLLISION_RADIUS=18;
export const NPC_COLLISION_RADIUS_KEY=Symbol.for('coda.town.collisionRadius');

export function npcCollisionObject(object,asset){
 return !object.mount&&!object.collision&&asset?.npcAvoid?{...object,collision:true}:object;
}

// Call when authored geometry changes, rather than during every movement
// sample. The navigator also applies the same policy to its cached bins.
export function npcCollisionProject(doc,catalog){
 if(!doc?.objects)return doc;
 let objects=null;
 for(let i=0;i<doc.objects.length;i++){
  const original=doc.objects[i],derived=npcCollisionObject(original,catalog.get(original.asset));
  if(derived!==original){objects??=doc.objects.slice();objects[i]=derived;}
 }
 if(!objects&&doc[NPC_COLLISION_RADIUS_KEY]===NPC_COLLISION_RADIUS)return doc;
 return {...doc,objects:objects||doc.objects,[NPC_COLLISION_RADIUS_KEY]:NPC_COLLISION_RADIUS};
}
