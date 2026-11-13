import {COLS,ROWS,TILE,RISE} from './model.mjs?v=town-flight-1';

export const OVERVIEW_SCALE=.125,OVERVIEW_PAD=512,LIVE_PATCH_SIZE=512;
export const WORLD_WIDTH=COLS*TILE,WORLD_HEIGHT=ROWS*TILE;
const keys=Array.from({length:COLS*ROWS},(_,i)=>`${i%COLS},${Math.floor(i/COLS)}`);
const curveFields=['kind','corner','cx','cy','r','mask','style','concave','lift','underX','underY'];
const defaultLayer={surface:'grass',level:0};

function paintSnapshot(p){return p?{ref:p,weights:p.weights,materials:p.materials.map(m=>[m.surface,m.paving])}:null;}
function samePaint(s,p){
 if(!s||!p)return !s&&!p;
 if(s.weights!==p.weights||s.materials.length!==p.materials.length)return false;
 for(let i=0;i<s.materials.length;i++)if(s.materials[i][0]!==p.materials[i].surface||s.materials[i][1]!==p.materials[i].paving)return false;
 return true;
}
function layerSnapshot(a){return {surface:a.surface,level:a.level,paving:a.paving,paint:paintSnapshot(a.paint)};}
function sameLayer(s,a){return s.surface===a.surface&&s.level===a.level&&s.paving===a.paving&&samePaint(s.paint,a.paint);}
const under=(d,q)=>q.under||d.cells[`${q.underX},${q.underY}`]||defaultLayer;
function snapshot(a,d){
 if(!a)return null;
 return {plain:!a.paint&&!a.curves?.length&&!a.stairs&&!a.bridge&&!a.pier&&!a.sidewalkCurb,surface:a.surface,level:a.level,paving:a.paving,stairs:a.stairs,bridge:a.bridge,finish:a.finish,stairBase:a.stairBase,stairRise:a.stairRise,stairStart:a.stairStart,stairEnd:a.stairEnd,sidewalkCurb:a.sidewalkCurb,paint:paintSnapshot(a.paint),pier:a.pier?{level:a.pier.level,axis:a.pier.axis}:null,curves:a.curves?.map(q=>({values:curveFields.map(k=>q[k]),under:layerSnapshot(under(d,q))}))||[]};
}
function same(s,a,d){
 if(!s||!a)return !s&&!a;
 // These loads run for every map cell, every overview frame. Keep the common
 // two-field terrain shape free of dynamic property loops and empty arrays.
 if(s.surface!==a.surface||s.level!==a.level||s.paving!==a.paving||s.stairs!==a.stairs||s.bridge!==a.bridge||s.finish!==a.finish||s.stairBase!==a.stairBase||s.stairRise!==a.stairRise||s.stairStart!==a.stairStart||s.stairEnd!==a.stairEnd||s.sidewalkCurb!==a.sidewalkCurb)return false;
 if(s.paint?!samePaint(s.paint,a.paint):a.paint)return false;
 if(s.pier?!a.pier||s.pier.level!==a.pier.level||s.pier.axis!==a.pier.axis:a.pier)return false;
 const curves=a.curves;if(!curves?.length)return s.curves.length===0;
 if(s.curves.length!==curves.length)return false;
 for(let i=0;i<curves.length;i++){
  const q=curves[i],old=s.curves[i];
  for(let k=0;k<curveFields.length;k++)if(old.values[k]!==q[curveFields[k]])return false;
  if(!sameLayer(old.under,under(d,q)))return false;
 }
 return true;
}
function changedPaints(s,a,d,result){
 if(!s||!a)return;
 if(s.paint?.ref===a.paint&&!samePaint(s.paint,a.paint))result.add(a.paint);
 for(let i=0;i<Math.min(s.curves.length,a.curves?.length||0);i++){
  const old=s.curves[i].under.paint,p=under(d,a.curves[i]).paint;
  if(old?.ref===p&&!samePaint(old,p))result.add(p);
 }
}
export function higherWaterRects(d,a,x,y){
 if(!a)return [];
 const result=[],add=z=>{if(z>0)result.push({x:x*TILE,y:y*TILE-z,w:TILE,h:TILE});};
 if(a.surface==='water'&&!a.stairs)add(a.level*RISE);
 for(const q of a.curves||[]){const u=under(d,q);if(u.surface!=='water')continue;const level=q.kind==='height'?Math.max(0,Math.min(8,u.level+(q.lift||0))):a.level;add(level*RISE);}
 return result;
}
export function livePatchRects(rects){
 const found=new Set();
 for(const r of rects)for(let y=Math.floor((r.y-TILE)/LIVE_PATCH_SIZE);y<=Math.floor((r.y+r.h+TILE)/LIVE_PATCH_SIZE);y++)for(let x=Math.floor((r.x-TILE)/LIVE_PATCH_SIZE);x<=Math.floor((r.x+r.w+TILE)/LIVE_PATCH_SIZE);x++)found.add(`${x},${y}`);
 return [...found].map(k=>{const[x,y]=k.split(',').map(Number);return {x:x*LIVE_PATCH_SIZE,y:y*LIVE_PATCH_SIZE,w:LIVE_PATCH_SIZE,h:LIVE_PATCH_SIZE};});
}
export function projectedDirtyRect(changed){
 if(!changed.length)return null;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const i of changed){const x=i%COLS*TILE,y=Math.floor(i/COLS)*TILE;x0=Math.min(x0,x-128);y0=Math.min(y0,y-OVERVIEW_PAD-128);x1=Math.max(x1,x+TILE+128);y1=Math.max(y1,y+TILE+128);}
 x0=Math.max(-OVERVIEW_PAD,x0);y0=Math.max(-OVERVIEW_PAD,y0);x1=Math.min(WORLD_WIDTH+OVERVIEW_PAD,x1);y1=Math.min(WORLD_HEIGHT+OVERVIEW_PAD,y1);
 return {x:x0,y:y0,w:x1-x0,h:y1-y0};
}
export function terrainBoundsForRect(r){return {x0:Math.max(0,Math.floor((r.x-64)/TILE)),x1:Math.min(COLS,Math.ceil((r.x+r.w+64)/TILE)),y0:Math.max(0,Math.floor((r.y-128)/TILE)),y1:Math.min(ROWS,Math.ceil((r.y+r.h+OVERVIEW_PAD)/TILE))};}

// Values, rather than object identity alone, preserve direct field edits and
// allow an equal-data Undo/Open document to reuse the same overview bitmap.
export class OverviewTerrainState{
 constructor(){this.cells=new Array(keys.length);this.water=new Map();this.initialized=false;}
 scan(d){
  const changed=[],paints=new Set(),first=!this.initialized,cells=d.cells;
  for(let i=0;i<keys.length;i++){
   const a=cells[keys[i]],s=this.cells[i];
   if(!first&&s?.plain&&a&&s.surface===a.surface&&s.level===a.level&&(a.surface!=='cobble'||s.paving===a.paving)&&!a.paint&&!a.curves?.length&&!a.stairs&&!a.bridge&&!a.pier&&!a.sidewalkCurb)continue;
   if(!first&&same(s,a,d)){
    // Equal-data Open/Undo can replace paint identities without rebuilding.
    // Keep identities current so a later in-place paint edit clears decoders.
    if(s?.paint){s.paint.ref=a.paint;s.paint.weights=a.paint.weights;}
    for(let q=0;q<(s?.curves.length||0);q++)if(s.curves[q].under.paint)s.curves[q].under.paint.ref=under(d,a.curves[q]).paint;
    continue;
   }
   changedPaints(s,a,d,paints);this.cells[i]=snapshot(a,d);changed.push(i);
   const rects=higherWaterRects(d,a,i%COLS,Math.floor(i/COLS));if(rects.length)this.water.set(i,rects);else this.water.delete(i);
  }
  this.initialized=true;
  return {first,changed,paints:[...paints],dirty:projectedDirtyRect(changed)};
 }
 livePatches(){return livePatchRects([...this.water.values()].flat());}
}
