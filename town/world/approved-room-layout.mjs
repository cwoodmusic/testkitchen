import {APPROVED_ROOM_LAYOUTS,APPROVED_ROOM_LAYOUT_SOURCE_SHA256} from './approved-room-layout-data.mjs?v=town-room-floorplan-1';
import {cloneRoomLayoutScene} from './room-layout-sources.mjs?v=town-wide-layout-1';
import {roomLayoutSignature} from './room-layout-model.mjs?v=town-review-3';
import {furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs?v=opera-parallax-1';
import {refreshRoomLayoutNavigation} from './room-layout-navigation.mjs?v=town-room-floorplan-1';

const themeId=scene=>scene.kind==='showroom'?'showroom-'+scene.showroomId:scene.kind==='apartment'?scene.resident:null;
const signature=scene=>roomLayoutSignature({...scene,items:scene.roomLayoutBaseItems||scene.items});

/** Promote the supplied room records without changing canonical saved stock. */
export function applyApprovedRoomLayout(authored,catalog){
 const id=themeId(authored),record=APPROVED_ROOM_LAYOUTS[id];if(!record)return authored;
 const alternatives=[authored,...authored.roomLayoutLegacySources||[]],source=alternatives.find(scene=>signature(scene)===record.baseSignature);
 if(!source)throw Error('The approved '+id+' layout no longer matches a preserved room source.');
 const scene=cloneRoomLayoutScene(source),stock=scene.roomLayoutBaseItems||scene.items,byId=new Map(stock.map(item=>[item.id,item]));
 const requested=new Set([...record.placements.map(item=>item.id),...record.removed]);
 if(record.added.length||requested.size!==byId.size||[...requested].some(key=>!byId.has(key)))throw Error('The approved '+id+' furniture stock has changed.');
 // Keep furniture rectangles distinct from architecture before rebuilding:
 // removed and moved pieces must never survive as invisible wall colliders.
 const oldBases=new Set(scene.items.flatMap(item=>item.collisionBoxes||[])),structural=scene.solids.filter(box=>!oldBases.has(box));
 scene.roomLayoutBaseItems=stock.map(item=>cloneRoomLayoutScene(item));
 scene.items=record.placements.map(pose=>{
  const item=cloneRoomLayoutScene(byId.get(pose.id)),asset=catalog.get(item.asset);if(!asset)throw Error('Missing approved furniture: '+item.asset);
  Object.assign(item,{x:pose.x,y:pose.y,rotation:pose.rotation||0});
  if(pose.support)item.supportedBy=pose.support;
  else if(item.supportedBy!=='north-wall'){
   const wasSupported=!!item.supportedBy;delete item.supportedBy;delete item.depth;
   if(wasSupported)item.solid=!!(asset.solid??asset.collisionDefault??asset.boxes?.length);
  }
  return item;
 });
 const items=new Map(scene.items.map(item=>[item.id,item]));
 for(const item of scene.items)if(item.supportedBy&&item.supportedBy!=='north-wall'){
  const parent=items.get(item.supportedBy);if(!parent)throw Error('Missing approved tabletop support: '+item.supportedBy);
  item.solid=false;item.depth=furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25;
 }
 for(const item of scene.items){
  const boxes=item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[];
  if(Array.isArray(item.collisionBoxes))item.collisionBoxes.splice(0,item.collisionBoxes.length,...boxes);
  else Object.defineProperty(item,'collisionBoxes',{value:boxes,configurable:true});
 }
 scene.solids=[...structural,...scene.items.flatMap(item=>item.collisionBoxes)];
 if(scene.familyFurniture){
  const family=scene.familyFurniture;scene.familyFurniture={...family,diningSeats:(family.diningSeats||[]).filter(key=>items.has(key))};
 }
 if(scene.showroom)scene.showroom={...scene.showroom,apartment:{...scene.showroom.apartment,items:scene.items}};
 scene.approvedRoomLayout={sourceSHA256:APPROVED_ROOM_LAYOUT_SOURCE_SHA256,baseSignature:record.baseSignature,previousDefaultSignature:signature(authored)};
 // A historical wall plan is restored only for the record that explicitly
 // names it. Prior default recipes remain available for older partial saves.
 const legacy=[...authored.roomLayoutLegacySources||[],authored];
 if(legacy.length)Object.defineProperty(scene,'roomLayoutLegacySources',{value:[...new Set(legacy)],configurable:true});
 Object.defineProperty(scene,'roomLayoutPreviousDefault',{value:authored,configurable:true});
 return refreshRoomLayoutNavigation(scene);
}
