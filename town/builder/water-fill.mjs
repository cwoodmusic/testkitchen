import {COLS,ROWS,TILE,RISE,cell,key,height} from '../world/model.mjs?v=map-recovery-1';
import {roundedUnder,curveUnder} from '../world/round-geometry.mjs?v=map-recovery-1';
import {readPaint,encodePaint,materialKey} from '../world/ground-paint.mjs?v=map-recovery-1';

// Rounded terrain can contain two physical floors inside one tile. Small local
// components keep a lower corner from joining another basin across high land.
// Flat tiles use a single node, so filling the entire map stays inexpensive.
const GRID=16,STEP=TILE/GRID;
const directions=[[-1,0],[1,0],[0,-1],[0,1]];
const inMap=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
function snapshot(a){const out={surface:a.surface,level:a.level};if(a.paving!==undefined)out.paving=a.paving;if(a.paint)out.paint=a.paint;return out;}
function materialMatches(a,b){return a.surface===b.surface&&a.paint===undefined&&b.paint===undefined&&(a.surface!=='cobble'||(a.paving||'auto')===(b.paving||'auto'));}
function replaceMaterial(a,target){
 if(a.surface===target.surface&&a.paint===undefined&&(target.surface==='cobble'?(a.paving||'auto')===target.paving:a.paving===undefined))return a;
 const out={...a,surface:target.surface};delete out.paint;delete out.paving;delete out.sidewalkCurb;if(target.surface==='cobble')out.paving=target.paving;return out;
}
// A soft-painted tile may still have grass as its base surface. Its visible
// material comes from the strongest channel at this exact 4px paint sample.
function dominantMaterial(a,i,paintCache){
 if(!a.paint)return a;
 if(!paintCache.has(a.paint))paintCache.set(a.paint,readPaint(a));
 const {materials,weights}=paintCache.get(a.paint);let strongest=0;
 for(let j=1;j<materials.length;j++)if(weights[i*materials.length+j]>weights[i*materials.length+strongest])strongest=j;
 return materials[strongest];
}
function replaceSourceSamples(a,target,sourceKey,indices,wholeLayer){
 // A bucket lays down a solid material. Keeping the minority channel from a
 // soft edge leaves an unselectable grass ribbon after both sides are filled.
 // Hidden samples in a fully reached curve facet must normalize too, because
 // the texture interpolator otherwise bleeds their old color into the edge.
 if(wholeLayer)return replaceMaterial(a,target);
 const old=readPaint(a),source=old.materials.findIndex(m=>materialKey(m)===sourceKey);
 if(source<0)return a;
 const targetKey=materialKey(target);if(targetKey===sourceKey)return a;
 const materials=[...old.materials];let into=materials.findIndex(m=>materialKey(m)===targetKey);
 if(into<0){into=materials.length;materials.push(target);}
 const weights=new Float64Array(GRID*GRID*materials.length);
 for(let i=0;i<GRID*GRID;i++)for(let j=0;j<old.materials.length;j++)weights[i*materials.length+j]=old.weights[i*old.materials.length+j];
 let changed=false;for(const i of indices){const at=i*materials.length;for(let j=0;j<materials.length;j++){const value=j===into?255:0;if(weights[at+j]!==value)changed=true;weights[at+j]=value;}}
 if(!changed)return a;
 const paint=encodePaint(materials,weights);
 if(paint.materials.length===1)return replaceMaterial(a,paint.materials[0]);
 const out={...a,paint};delete out.sidewalkCurb;return out;
}

export function planWaterFill(doc,p){return planTerrainFill(doc,p,{surface:'water'});}
// Land filling follows the clicked material. The water bucket instead floods
// every connected material at the clicked height, as it did before.
export function planTerrainFill(doc,p,{surface='water',paving='auto',matchSourceMaterial=false}={}){

 const result=(message,level=null)=>({edits:[],level,count:0,message}),target={surface,...(surface==='cobble'?{paving}:{})},operation=matchSourceMaterial?'land':'water';
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return result(`Click a ground surface to fill it with ${operation}.`);
 const sx=Math.floor(p.x/TILE),sy=Math.floor(p.y/TILE);
 if(!inMap(sx,sy))return result(`Click inside the map to fill ${operation}.`);
 if(cell(doc,sx,sy).stairs)return result('Click flat ground beside the stairs to fill that height level.');
 const level=height(doc,p.x,p.y)/RISE;
 if(!Number.isInteger(level))return result(`Click a flat ground level to fill ${operation}.`);
 const clicked=cell(doc,sx,sy),clickedUnder=roundedUnder(doc,clicked,p.x,p.y),clickedMaterial=clickedUnder?curveUnder(doc,clickedUnder):clicked,paintCache=new WeakMap();
 const clickedIndex=Math.floor((p.y-sy*TILE)/STEP)*GRID+Math.floor((p.x-sx*TILE)/STEP),sourceKey=matchSourceMaterial?materialKey(dominantMaterial(clickedMaterial,clickedIndex,paintCache)):null;
 if(matchSourceMaterial&&sourceKey===materialKey(target))return result(`This connected ground already uses ${surface}.`,level);
 const traversable=(a,i=0)=>!matchSourceMaterial||materialKey(dominantMaterial(a,i,paintCache))===sourceKey;
 const cache=new Map();
 function analyze(x,y){
  if(!inMap(x,y))return null;const id=y*COLS+x;if(cache.has(id))return cache.get(id);
  const a=cell(doc,x,y);let node=null;
  if(!a.stairs){
   if(!a.curves?.length&&(!matchSourceMaterial||!a.paint)){if(a.level===level&&traversable(a))node={x,y,a,flat:true,components:[new Set([0])]};}
   else {
    const labels=new Int16Array(GRID*GRID).fill(-1),facets=new Int16Array(GRID*GRID).fill(-1),visibleFacets=new Int16Array(GRID*GRID),components=[],samples=[],layers=[a,...(a.curves||[]).map(q=>curveUnder(doc,q))];
    for(let yy=0;yy<GRID;yy++)for(let xx=0;xx<GRID;xx++){
     const X=x*TILE+(xx+.5)*STEP,Y=y*TILE+(yy+.5)*STEP,q=roundedUnder(doc,a,X,Y),facet=q?a.curves.indexOf(q)+1:0,layer=layers[facet],z=q?.kind==='height'?layer.level:a.level,i=yy*GRID+xx;
     visibleFacets[i]=facet;if(z===level&&traversable(layer,i))facets[i]=facet;
    }
    for(let i=0;i<labels.length;i++)if(facets[i]>=0&&labels[i]<0){
     const component=components.length,found=new Set(),queue=[i];labels[i]=component;
     for(let j=0;j<queue.length;j++){
      const v=queue[j],xx=v%GRID,yy=Math.floor(v/GRID);found.add(facets[v]);
      for(const[dx,dy]of directions){const nx=xx+dx,ny=yy+dy,n=ny*GRID+nx;if(nx<0||ny<0||nx>=GRID||ny>=GRID||facets[n]<0||labels[n]>=0)continue;labels[n]=component;queue.push(n);}
     }components.push(found);samples.push(queue);
    }
    if(components.length)node={x,y,a,flat:false,labels,facets,visibleFacets,components,samples};
   }
  }
  cache.set(id,node);return node;
 }
 const seed=analyze(sx,sy);if(!seed)return result('This point has no connected flat ground to fill.',level);
 let seedComponent=0;
 if(!seed.flat){
  const xx=Math.max(0,Math.min(GRID-1,Math.floor((p.x-sx*TILE)/STEP))),yy=Math.max(0,Math.min(GRID-1,Math.floor((p.y-sy*TILE)/STEP)));
  seedComponent=seed.labels[yy*GRID+xx];
  // A click can land just outside a curve between its connectivity samples.
  // Choose the nearest sample of that exact visible floor, not the high cap.
  if(seedComponent<0){const q=roundedUnder(doc,seed.a,p.x,p.y),facet=q?seed.a.curves.indexOf(q)+1:0;let distance=Infinity;
   for(let i=0;i<seed.labels.length;i++)if(seed.labels[i]>=0&&seed.facets[i]===facet){const d=(i%GRID-xx)**2+(Math.floor(i/GRID)-yy)**2;if(d<distance){distance=d;seedComponent=seed.labels[i];}}
  }
  if(seedComponent<0)return result('Click farther inside this rounded ground surface to fill it.',level);
 }
 const seen=new Set(),queue=[],reached=new Map();
 function enqueue(node,component){const code=(node.y*COLS+node.x)*GRID*GRID+component;if(seen.has(code))return;seen.add(code);queue.push([node,component]);}
 enqueue(seed,seedComponent);
 function boundary(node,side,i){if(node.flat)return 0;return node.labels[side===0?i*GRID:side===1?i*GRID+GRID-1:side===2?i:(GRID-1)*GRID+i];}
 for(let n=0;n<queue.length;n++){
  const[node,component]=queue[n],id=node.y*COLS+node.x;
  if(!reached.has(id))reached.set(id,{node,facets:new Set(),samples:new Set()});const reach=reached.get(id);
  for(const facet of node.components[component])reach.facets.add(facet);if(!node.flat)for(const i of node.samples[component])reach.samples.add(i);
  for(let side=0;side<directions.length;side++){
   const[dx,dy]=directions[side],other=analyze(node.x+dx,node.y+dy);if(!other)continue;
   if(node.flat&&other.flat){enqueue(other,0);continue;}
   for(let i=0;i<GRID;i++)if(boundary(node,side,i)===component){const next=boundary(other,side^1,i);if(next>=0)enqueue(other,next);}
  }
 }
 const edits=new Map(),changedDonors=new Map();let count=0;
 for(const[id,{node,facets,samples}]of reached){
  const a=node.a,k=key(node.x,node.y);let next=a;
  function replaceLayer(raw,facet){
   if(!matchSourceMaterial)return replaceMaterial(raw,target);
   // Water is physical terrain, never a soft-paint channel. Preserve the
   // existing whole-facet reclamation behavior for a water-backed curve.
   if(node.flat||raw.surface==='water')return replaceMaterial(raw,target);
   const selected=[...samples].filter(i=>node.facets[i]===facet),wholeLayer=node.visibleFacets.every((f,i)=>f!==facet||samples.has(i));
   return replaceSourceSamples(raw,target,sourceKey,selected,wholeLayer);
  }
  if(facets.has(0))next=replaceLayer(next,0);
  if(a.curves?.length){
   let changed=false;const curves=a.curves.map((q,i)=>{
    if(!facets.has(i+1))return q;const raw=q.under||cell(doc,q.underX,q.underY),under=replaceLayer(raw,i+1);
    if(under===raw)return q;changed=true;return {...q,under:snapshot(under)};
   });if(changed)next={...next,curves};
   // Water covers every material at this height, including a hidden cap.
   // Land keeps shoreline masks until both sides match. Height curves stay.
   if(!curves.some(q=>q.kind==='height')&&(!matchSourceMaterial||curves.every(q=>materialMatches(next,curveUnder(doc,q))))){next={...replaceMaterial(next,target)};delete next.curves;}
  }
  if(next===a)continue;edits.set(k,next);count++;
  if(next.surface!==a.surface||next.paving!==a.paving||next.paint!==a.paint)changedDonors.set(k,snapshot(a));
 }
 // A corner outside the filled component may refer to a changed donor tile.
 // Freeze its original material rather than changing that disconnected floor.
 // Store the raw donor level: curveUnder applies q.lift when it is evaluated.
 if(changedDonors.size)for(const k of Object.keys(doc.cells)){
  const a=edits.get(k)||doc.cells[k];if(!a.curves?.length)continue;let changed=false;
  const curves=a.curves.map(q=>{const under=changedDonors.get(key(q.underX,q.underY));if(q.under||!under)return q;changed=true;return {...q,under};});
  if(changed)edits.set(k,{...a,curves});
 }
 return {edits:[...edits],level,count,message:count?`Filled ${count.toLocaleString('en-US')} tiles with ${surface} at level ${level}.`:matchSourceMaterial?`This connected ground already uses ${surface}.`:'This connected area is already water.'};
}
