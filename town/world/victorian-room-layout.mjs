import {furnitureFacingDepth} from './furniture-facing.mjs?v=opera-parallax-1';

// Exact approved Room Editor export. The original complete stock is retained
// separately so older saved layouts keep their IDs, signature and solid flags.
export const VICTORIAN_ROOM_POSES=Object.freeze([
 Object.freeze(["showroom-victorian-parlor-item-0",234.5,174.99999999999997,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-2",297.65,132.73,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-3",234.5,127.39999999999998,0,"showroom-victorian-parlor-item-0"]),
 Object.freeze(["showroom-victorian-parlor-item-4",297.65,105.99249999999999,0,"showroom-victorian-parlor-item-2"]),
 Object.freeze(["showroom-victorian-parlor-item-5",246,94,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-6",442,136,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-7",442,66.4,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-8",543.6,149.70000000000002,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-24",928,94,0,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-dining-chair-5",848.1537084398976,185.73657289002557,90,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-dining-chair-6",655.6979539641944,189.52173913043478,270,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-dining-chair-2",750.7179028132992,228.19462915601025,180,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-dining-table-1",756.468030690537,154.87468030690542,180,null]),
 Object.freeze(["showroom-victorian-parlor-item-20",316.23161125319695,207.42212276214838,90,null]),
 Object.freeze(["showroom-victorian-parlor-item-1",62.47263427109982,143.70127877237852,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-18",136.08634271099746,242.44833759590793,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-23",130.78710997442457,308.91560102301787,0,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:bedroom-plant-1",136.7437340153453,199.4590792838875,0,"showroom-victorian-parlor-item-18"]),
 Object.freeze(["showroom-victorian-parlor-item-19",81.57994884910485,228.62404092071608,270,null]),
 Object.freeze(["showroom-victorian-parlor-item-9",414.4434462450013,158.74665676187436,270,null]),
 Object.freeze(["showroom-victorian-parlor-item-14",911.8083612461653,141.18585287231565,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-10",965.4186627047499,140.2366555015339,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-12",1012.2132117772132,140.05498325230087,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-13",1126.007356384217,139.70418062308266,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-15",1126.007356384217,73.40418062308268,0,"showroom-victorian-parlor-item-13"]),
 Object.freeze(["showroom-victorian-parlor-item-11",1066.3617392400295,140.22668899693218,0,null]),
 Object.freeze(["showroom-victorian-parlor-item-16",1108.437871922503,331.4417917608599,90,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-coffee-table-1",1075.2531969309464,320.2014066496164,270,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-lounge-chair-2",996.5277493606138,318.9616368286445,270,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-statement-plant-1",646.7212276214834,144.31649616368287,0,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-living-rug-1",753.6753609988488,266.93096609143697,0,null]),
 Object.freeze(["showroom-victorian-parlor:family-room-1:family-lounge-chair-1",998.7868286445013,365.1406649616368,270,null]),
 Object.freeze(["showroom-victorian-parlor-item-22",1046.9974424552431,333.1595396419438,0,"showroom-victorian-parlor:family-room-1:family-coffee-table-1"]),
 Object.freeze(["showroom-victorian-parlor-item-21",1150.6956010230178,417.4846547314578,0,null]),
]);
export const VICTORIAN_ROOM_REMOVALS=Object.freeze(["showroom-victorian-parlor-item-17","showroom-victorian-parlor:family-room-1:family-dining-chair-1","showroom-victorian-parlor:family-room-1:family-dining-chair-3","showroom-victorian-parlor:family-room-1:family-dining-chair-4"]);

export function applyVictorianRoomLayout(scene,assets){
 if(scene?.kind!=='showroom'||scene.id!=='showroom-victorian-parlor')return false;
 const items=new Map(scene.items.map(item=>[item.id,item])),ids=[...VICTORIAN_ROOM_POSES.map(([id])=>id),...VICTORIAN_ROOM_REMOVALS];
 if(items.size!==ids.length||ids.some(id=>!items.has(id)))return false;
 // Snapshot before changing poses or supports: support changes also change the
 // solid flag included in the existing room-layout signature.
 scene.roomLayoutBaseItems=scene.items.map(item=>({...item,collisionBoxes:(item.collisionBoxes||[]).map(box=>({...box}))}));
 for(const [id,x,y,rotation,support]of VICTORIAN_ROOM_POSES){
  const item=items.get(id);Object.assign(item,{x,y,rotation});
  if(support)item.supportedBy=support;
  else if(item.supportedBy!=='north-wall'){
   const wasSupported=!!item.supportedBy;delete item.supportedBy;delete item.depth;
   if(wasSupported){const asset=assets.get(item);item.solid=!!(asset.solid??asset.collisionDefault??asset.boxes?.length);}
  }
 }
 // The visible order follows the export too; the four removed pieces remain
 // only in the compatibility snapshot and cannot contribute active colliders.
 scene.items=VICTORIAN_ROOM_POSES.map(([id])=>items.get(id));
 if(scene.familyFurniture?.diningSeats){const active=new Set(scene.items.map(item=>item.id));scene.familyFurniture={...scene.familyFurniture,diningSeats:scene.familyFurniture.diningSeats.filter(id=>active.has(id))};}
 for(const item of scene.items){
  const parent=items.get(item.supportedBy);if(!parent)continue;
  item.solid=false;item.depth=furnitureFacingDepth(assets.get(parent),parent,parent.y)+.25;
 }
 return true;
}
