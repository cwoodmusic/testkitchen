// Reviewed source-only corrections. Physical product dimensions, collision bases
// and all North/East/West artwork remain untouched. Small previews avoid an
// angled legacy thumbnail while a corrected native source loads lazily.
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
export const SOUTH_ART_PREVIEW=Object.freeze({
 "file": "south-fixes/corrected-south-preview-9a6cc1ccc8cb.webp",
 "width": 448,
 "height": 128,
 "cells": [
  {
   "id": "collection-beethoven-coffee-table",
   "x": 0,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-clara-coffee-table",
   "x": 64,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-chopin-coffee-table",
   "x": 128,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-joplin-coffee-table",
   "x": 192,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-ellington-coffee-table",
   "x": 256,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-ella-coffee-table",
   "x": 320,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-miles-coffee-table",
   "x": 384,
   "y": 0,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-vee-jay-coffee-table",
   "x": 0,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-zizi-coffee-table",
   "x": 64,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-schoenberg-coffee-table",
   "x": 128,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-player-coffee-table",
   "x": 192,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-showroom-midcentury-studio-coffee-table",
   "x": 256,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-showroom-industrial-loft-coffee-table",
   "x": 320,
   "y": 64,
   "w": 64,
   "h": 39
  },
  {
   "id": "collection-showroom-midcentury-studio-arcade",
   "x": 384,
   "y": 64,
   "w": 36,
   "h": 64
  }
 ]
});
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
 const previews=new Map(SOUTH_ART_PREVIEW.cells.map(cell=>[cell.id,cell]));
 const result=[];
 for(const owner of CARDINAL_TABLE_SOUTH_OWNERS){
  const id='collection-'+owner+'-coffee-table',def=byId.get(id),source=owners.get(owner)?.views?.north;
  const frame=source?.cells?.find(cell=>cell.slot==='coffee-table'||cell.id===id);
  if(!def||!source||!frame)continue;
  result.push({id,owner,kind:'reviewed-cardinal-table',entry:{file:source.file,width:source.width,height:source.height},frame:{...frame,id},preview:previews.get(id)});
 }
 if(byId.has(arcadeCorrection.id))result.push({id:arcadeCorrection.id,owner:arcadeCorrection.owner,kind:arcadeCorrection.kind,
  entry:{file:arcadeCorrection.file,width:arcadeCorrection.entryWidth,height:arcadeCorrection.entryHeight},frame:arcadeCorrection.frame,preview:previews.get(arcadeCorrection.id)});
 return result;
}
