import {interiorActorScale} from './interior-scale.mjs?v=town-polish-1';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs?v=town-polish-1';
import {furnitureAtGroundCenter,furnitureFacingBoxes,furnitureFacingDepth} from './furniture-facing.mjs?v=town-polish-1';

const definitions=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,a])),CALIBRATED=Symbol.for('coda.privateFurnitureCalibration');
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const median=list=>[...list].sort((a,b)=>a-b)[Math.floor(list.length/2)];
const slot=(item,a)=>item.slot||item.collectionSlot||a?.slot;
const assetFor=(item,catalog)=>catalog?.get(item.asset)||definitions.get(item.asset);
function footprint(a,item){
 const boxes=furnitureFacingBoxes(a,item);
 if(!boxes.length)return {x:item.x,y:item.y,w:0,h:0,cx:item.x,cy:item.y};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
function moveCenter(item,a,center){Object.assign(item,furnitureAtGroundCenter(a,item,center));}
function supportedParent(item,items){
 if(!item.supportedBy||item.supportedBy==='north-wall')return null;
 const candidates=items.filter(p=>p!==item&&(p.asset===item.supportedBy||p.furnitureRole===item.supportedBy||p.slot===item.supportedBy||p.collectionSlot===item.supportedBy));
 return candidates.find(p=>p.roomId===item.roomId)||candidates[0]||null;
}
function separateFrom(item,a,other,otherAsset,oldVector,gap=10){
 const p=footprint(a,item),base=footprint(otherAsset,other),horizontal=Math.abs(oldVector.x)>Math.abs(oldVector.y),side=(horizontal?oldVector.x:oldVector.y)<0?-1:1;
 moveCenter(item,a,horizontal?{x:base.cx+side*((base.w+p.w)/2+gap),y:p.cy}:{x:p.cx,y:base.cy+side*((base.h+p.h)/2+gap)});
}

/** Apply room drawing units without changing the persisted product or anchor. */
export function presentedRoomItem(item,scene){
 const factor=typeof scene==='number'?scene:interiorActorScale(scene);
 if(factor===1)return item;
 return {...item,scale:(item.scale??1)*factor,...(finite(item.w)?{w:item.w*factor}:{}),...(finite(item.h)?{h:item.h*factor}:{}),presentationScale:factor};
}

/**
 * A private room keeps its large floor plate. Its furniture uses the same
 * native furniture-to-person proportions as the town, in private drawing units.
 * This is presentation/model geometry only: catalog products and saves retain
 * their original IDs, fixed scale and coordinates.
 */
export function calibratePrivateFurniture(scene,catalog){
 const factor=interiorActorScale(scene);
 if(factor===1||!Array.isArray(scene?.items)||scene[CALIBRATED])return scene;
 const old=new Map(scene.items.map(item=>[item,{...item}])),oldBoxes=new Set(scene.items.flatMap(item=>item.collisionBoxes||[]));
 const assets=new Map(scene.items.map(item=>[item,assetFor(item,catalog)]));
 const oldCenter=item=>{const a=assets.get(item);return a?footprint(a,old.get(item)):{cx:item.x,cy:item.y};};
 for(const item of scene.items){
  const a=assets.get(item);if(!a||!finite(a.w)||!finite(a.h)||a.w<=0||a.h<=0)continue;
  const source=old.get(item),support=supportedParent(item,scene.items),mini=support?Math.min(1,source.w/a.w,source.h/a.h):1;
  const center=oldCenter(item);item.w=a.w*factor*mini;item.h=a.h*factor*mini;item.presentationScale=factor;
  if(!item.wallMounted&&item.layer!=='ground'&&!support)moveCenter(item,a,{x:center.cx,y:center.cy});
 }

 // A bedside table stays within arm's reach of the bed, rather than retaining
 // the old display-size spacing after both pieces return to human scale.
 const bed=scene.items.find(item=>slot(item,assets.get(item))==='bed'),nightstand=scene.items.find(item=>slot(item,assets.get(item))==='nightstand');
 if(bed&&nightstand){
  const oldBed=oldCenter(bed),oldNight=oldCenter(nightstand),side=oldNight.cx<oldBed.cx?-1:1,b=footprint(assets.get(bed),bed),n=footprint(assets.get(nightstand),nightstand);
  moveCenter(nightstand,assets.get(nightstand),{x:b.cx+side*((b.w+n.w)/2+5),y:b.cy-b.h*.3});
 }

 // Keep the connected appliance/counter run together rather than leaving the
 // old display-scale gaps between normal-size cabinets. Detached pantries stay
 // at their authored service-wall positions.
 const kitchenSlots=new Set(['fridge','sink','stove','counter','pantry']);
 const kitchen=scene.items.filter(item=>kitchenSlots.has(slot(item,assets.get(item))));
 const sink=kitchen.find(item=>slot(item,assets.get(item))==='sink');
 if(sink){
  const sourceSink=old.get(sink),row=kitchen.filter(item=>Math.abs(old.get(item).y-sourceSink.y)<=85);
  if(row.length>1){
   row.sort((a,b)=>oldCenter(a).cx-oldCenter(b).cx);
   const sourceBounds=row.map(item=>({item,...footprint(assets.get(item),old.get(item))}));
   const center=(Math.min(...sourceBounds.map(b=>b.x))+Math.max(...sourceBounds.map(b=>b.x+b.w)))/2;
   const gap=1.5,total=row.reduce((sum,item)=>sum+item.w,0)+gap*(row.length-1),front=median(sourceBounds.map(b=>b.y+b.h));
   let left=center-total/2;
   for(const item of row){
    const a=assets.get(item);item.x=left+item.w/2;const base=footprint(a,item);item.y+=front-(base.y+base.h);left+=item.w+gap;
   }
   const shelf=scene.items.find(item=>item.furnitureRole==='kitchen-shelf');
   if(shelf)shelf.x=(row[0].x+row.at(-1).x)/2;
  }
 }

 // Retain the direction of each conversation group, at furniture-scale
 // distances, leaving the additional floor area available for walking.
 const sofa=scene.items.find(item=>slot(item,assets.get(item))==='sofa');
 if(sofa){
  const a=assets.get(sofa),origin=oldCenter(sofa),anchor=footprint(a,sofa),ratio=sofa.w/old.get(sofa).w;
  const groupSlots=new Set(['coffee-table','reading-chair','floor-lamp','record-console','rug']);
  for(const item of scene.items){
   if(!groupSlots.has(slot(item,assets.get(item)))||item.wallMounted||item.supportedBy||(item.roomId&&sofa.roomId&&item.roomId!==sofa.roomId))continue;
   const before=oldCenter(item);if(Math.hypot(before.cx-origin.cx,before.cy-origin.cy)>700)continue;
   moveCenter(item,assets.get(item),{x:anchor.cx+(before.cx-origin.cx)*ratio,y:anchor.cy+(before.cy-origin.cy)*ratio});
  }
  const console=scene.items.find(item=>slot(item,assets.get(item))==='record-console'&&(!item.roomId||!sofa.roomId||item.roomId===sofa.roomId));
  if(console){const before=oldCenter(console),vector={x:before.cx-origin.cx,y:before.cy-origin.cy};separateFrom(console,assets.get(console),sofa,a,vector,Math.abs(vector.x)>Math.abs(vector.y)?24:48);}
  const table=scene.items.find(item=>slot(item,assets.get(item))==='coffee-table');
  if(table){
   const before=oldCenter(table);separateFrom(table,assets.get(table),sofa,a,{x:before.cx-origin.cx,y:before.cy-origin.cy},14);
   const chair=scene.items.find(item=>slot(item,assets.get(item))==='reading-chair'&&(!item.roomId||!sofa.roomId||item.roomId===sofa.roomId));
   if(chair){const c=oldCenter(chair),t=oldCenter(table);separateFrom(chair,assets.get(chair),table,assets.get(table),{x:c.cx-t.cx,y:c.cy-t.cy},14);}
  }
 }
 const table=scene.items.find(item=>slot(item,assets.get(item))==='dining-table'),chair=scene.items.find(item=>slot(item,assets.get(item))==='dining-chair');
 if(table&&chair){const t=oldCenter(table),c=oldCenter(chair);separateFrom(chair,assets.get(chair),table,assets.get(table),{x:c.cx-t.cx,y:c.cy-t.cy},10);}
 const vanity=scene.items.find(item=>slot(item,assets.get(item))==='vanity'),mirror=scene.items.find(item=>slot(item,assets.get(item))==='mirror');
 if(vanity&&mirror)mirror.x=vanity.x;

 // Listening targets belong to their actual furniture rather than the old
 // display-size coordinates. Keep the design/circulation contract meaningful.
 if(scene.interiorDesign)scene.interiorDesign={...scene.interiorDesign,focalPoints:(scene.interiorDesign.focalPoints||[]).map(point=>{
  const item=scene.items.find(item=>{const before=oldCenter(item);return Math.abs(before.cx-point.x)<1e-6&&Math.abs(before.cy-point.y)<1e-6;});
  if(!item)return {...point};const at=footprint(assets.get(item),item);return {...point,x:at.cx,y:at.cy};
 })};

 // A keepsake follows its actual tabletop/bed when the parent changes size.
 // Parent keys are legacy roles in homes and asset IDs in the showrooms.
 for(const item of scene.items){
  const parent=supportedParent(item,scene.items);if(!parent)continue;
  const source=old.get(item),previous=old.get(parent),sx=parent.w/previous.w,sy=parent.h/previous.h;
  item.x=parent.x+(source.x-previous.x)*sx;item.y=parent.y+(source.y-previous.y)*sy;
  item.depth=furnitureFacingDepth(assets.get(parent),parent,parent.y)+.25;item.solid=false;
 }

 // Remove only the old furniture bases. Structural walls retain their original
 // objects; each furniture collision array is rebuilt in place for consumers.
 scene.solids=scene.solids.filter(box=>!oldBoxes.has(box));
 for(const item of scene.items){
  const boxes=item.collisionBoxes||[];if(!item.collisionBoxes)Object.defineProperty(item,'collisionBoxes',{value:boxes});
  boxes.splice(0,boxes.length,...(item.solid?furnitureFacingBoxes(assets.get(item),item):[]));scene.solids.push(...boxes);
 }
 Object.defineProperty(scene,CALIBRATED,{value:true});return scene;
}
