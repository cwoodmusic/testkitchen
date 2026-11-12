import {furnitureFacingDepth} from './furniture-facing.mjs?v=opera-shells-1';

// The owner's approved Room Editor export, applied after automatic furnishing.
// Only poses and tabletop supports change; item order, sizes and stock stay put.
const poses=Object.freeze([
 Object.freeze(["showroom-midcentury-studio-item-0",949.5,174.99999999999997,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-1",1113.2,245.92000000000002,90,null]),
 Object.freeze(["showroom-midcentury-studio-item-2",886.35,132.73,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-3",949.5,127.39999999999998,0,"showroom-midcentury-studio-item-0"]),
 Object.freeze(["showroom-midcentury-studio-item-4",886.35,105.99249999999999,0,"showroom-midcentury-studio-item-2"]),
 Object.freeze(["showroom-midcentury-studio-item-5",898,94,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-8",580.6,144.4,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-12",54.69999999999999,137.3,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-18",1016.16,274.7,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-19",1016.16,290.4,180,null]),
 Object.freeze(["showroom-midcentury-studio-item-21",495.78,311.5,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-22",56,389.18,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-23",1016.16,310,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-24",208,94,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-coffee-table-1",384,379.25,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-lounge-chair-1",293.15,350,270,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-lounge-chair-2",474.85,350,90,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-living-rug-1",384,420,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-statement-plant-1",268,406.25,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-20",484.1391304347826,149.13056265984656,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-9",727.1480818414321,193.08491048593353,90,null]),
 Object.freeze(["showroom-midcentury-studio-item-6",700.4859335038363,133.72890025575447,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-7",705.0281329923273,80.02659846547314,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-table-1",155,276,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-10",103.08030690537086,133.1007441606058,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-14",151.77391304347827,139.1007672634271,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-13",213.40076726342713,140.4859566066576,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-15",213.40076726342713,74.1859566066576,0,"showroom-midcentury-studio-item-13"]),
 Object.freeze(["showroom-midcentury-studio-item-11",283.602836402054,141.62892335857578,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-5",68.0258312020461,253.11257817495203,270,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-3",112.30000000000001,282.57263427109973,180,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-4",197.7,280.3015345268542,180,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-6",243.48818908847505,247.05631219029732,90,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-2",200.7281329923273,210.78286445012787,0,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:family-dining-chair-1",121.38439897698208,209.2687748511429,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-16",385.51406649616376,310.16329923273656,0,null]),
 Object.freeze(["showroom-midcentury-studio-item-17",848.0612886628836,159.52877237851663,270,null]),
 Object.freeze(["showroom-midcentury-studio:family-room-1:bedroom-plant-1",814.6006039202366,306.52813299232736,0,null]),
]);

export function applyMidcenturyRoomLayout(scene,assets){
 if(scene?.kind!=='showroom'||scene.id!=='showroom-midcentury-studio')return false;
 const items=new Map(scene.items.map(item=>[item.id,item]));
 if(poses.some(([id])=>!items.has(id)))return false;
 for(const [id,x,y,rotation,support]of poses){
  const item=items.get(id);Object.assign(item,{x,y,rotation});
  if(support)item.supportedBy=support;
  else if(item.supportedBy!=='north-wall'){
   const wasSupported=!!item.supportedBy;delete item.supportedBy;delete item.depth;
   if(wasSupported){const a=assets.get(item);item.solid=!!(a.solid??a.collisionDefault??a.boxes?.length);}
  }
 }
 // Recalculate after every parent has its final pose, including the moved
 // pantry and its lava lamp. Physics is rebuilt by the caller afterwards.
 for(const item of scene.items){
  const parent=items.get(item.supportedBy);if(!parent)continue;
  item.solid=false;item.depth=furnitureFacingDepth(assets.get(parent),parent,parent.y)+.25;
 }
 return true;
}
