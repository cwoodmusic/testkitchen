import {CARDINAL_GENERATED_PATCHES,CARDINAL_ART_PREVIEW} from './cardinal-art-patches.mjs?v=room-defaults-curtain-1';
import {collectionImageRect} from './apartment-collection-art.mjs?v=room-defaults-curtain-1';
// Reviewed source-only corrections. Original atlases, physical dimensions and
// collision bases stay immutable. Small previews show the corrected facing
// while its individual native source loads lazily within the existing cache.
export const CARDINAL_TABLE_SOUTH_OWNERS=Object.freeze([
 "beethoven",
 "clara",
 "chopin",
 "joplin",
 "ellington",
 "ella",
 "miles",
 "vee-jay",
 "zizi",
 "schoenberg",
 "player",
 "showroom-midcentury-studio",
 "showroom-industrial-loft"
]);
export {CARDINAL_ART_PREVIEW as SOUTH_ART_PREVIEW} from './cardinal-art-patches.mjs?v=room-defaults-curtain-1';
const arcadeCorrection={
 "id": "collection-showroom-midcentury-studio-arcade",
 "owner": "showroom-midcentury-studio",
 "file": "south-fixes/midcentury-arcade-south-d3d457042101.webp",
 "entryWidth": 825,
 "entryHeight": 1342,
 "frame": {
  "id": "collection-showroom-midcentury-studio-arcade",
  "slot": "arcade",
  "x": 0,
  "y": 0,
  "w": 825,
  "h": 1342,
  "viewWidth": 100,
  "viewHeight": 176,
  "footCenter": [
   0.5,
   0.94
  ],
  "motion": {
   "kind": "arcade",
   "mask": [
    [
     0.27,
     0.24
    ],
    [
     0.73,
     0.24
    ],
    [
     0.73,
     0.49
    ],
    [
     0.27,
     0.49
    ]
   ],
   "palette": [
    "#14243b",
    "#b278ce",
    "#fff0bf",
    "#e1a54e"
   ],
   "seed": 25,
   "game": "atomic-walnut",
   "review": "Orthographic generated front glass; conservative interior rectangle excludes bezel/control shelf."
  }
 },
 "kind": "generated-front-cabinet",
 "viewWidth": 100,
 "viewHeight": 176
};

export function resolveSouthArtCorrections(definitions,directionManifest){
 const byId=new Map(definitions.map(def=>[def.id,def]));
 const owners=new Map((directionManifest?.collections||[]).map(collection=>[collection.owner,collection]));
 const previews=new Map(CARDINAL_ART_PREVIEW.cells.map(cell=>[cell.id+'|'+(cell.facing??'south'),cell]));
 const result=[];
 for(const owner of CARDINAL_TABLE_SOUTH_OWNERS){
  const id='collection-'+owner+'-coffee-table',def=byId.get(id),source=owners.get(owner)?.views?.north;
  const frame=source?.cells?.find(cell=>cell.slot==='coffee-table'||cell.id===id);
  if(!def||!source||!frame)continue;
  result.push({id,owner,kind:'reviewed-cardinal-table',entry:{file:source.file,width:source.width,height:source.height},frame:{...frame,id},preview:previews.get(id+'|south')});
 }
 if(byId.has(arcadeCorrection.id))result.push({id:arcadeCorrection.id,owner:arcadeCorrection.owner,kind:arcadeCorrection.kind,
  entry:{file:arcadeCorrection.file,width:arcadeCorrection.entryWidth,height:arcadeCorrection.entryHeight},frame:arcadeCorrection.frame,preview:previews.get(arcadeCorrection.id+'|south')});
 for(const patch of CARDINAL_GENERATED_PATCHES){
  const def=byId.get(patch.id),owner=owners.get(patch.owner);
  // Injected fixture manifests and future replacement source sheets must be
  // reviewed separately; never apply an old crop to a different collection.
  if(!def||def.owner!==patch.owner||owner?.views?.north?.sourceDigest!==patch.ownerSourceDigest)continue;
  const original=patch.sourceFrame,drawDef={w:original.viewWidth??def.w,h:original.viewHeight??def.h};
  const rect=collectionImageRect(drawDef,original),point=original.footCenter;
  const floor=Array.isArray(point)?{x:rect.x+point[0]*rect.w,y:rect.y+point[1]*rect.h}:original.worldFootCenter??(patch.facing==='south'?southFloorCenter(def):{x:drawDef.w/2,y:drawDef.h});
  const frame={id:patch.id,slot:patch.slot,x:0,y:0,w:patch.width,h:patch.height,viewWidth:drawDef.w,viewHeight:drawDef.h,worldFootCenter:floor,digest:patch.cropSha256,...(original.motion?{motion:original.motion}: {})};
  const key=patch.id+'|'+patch.facing;
  const previous=result.findIndex(fix=>fix.id===patch.id&&(fix.facing??'south')===patch.facing);if(previous>=0)result.splice(previous,1);
  result.push({id:patch.id,owner:patch.owner,facing:patch.facing,kind:'reviewed-generated-cardinal',entry:{file:patch.file,width:patch.width,height:patch.height},frame,preview:previews.get(key)});
 }
 return result;
}
function southFloorCenter(def){
 const points=[];for(const b of def.boxes||[])points.push([b.x,b.y],[b.x+b.w,b.y+b.h]);for(const polygon of def.polygons||[])for(const point of polygon)points.push(point);
 if(!points.length)return {x:def.w/2,y:def.h};
 const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);return {x:(Math.min(...xs)+Math.max(...xs))/2,y:(Math.min(...ys)+Math.max(...ys))/2};
}
