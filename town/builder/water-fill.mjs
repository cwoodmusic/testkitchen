import {COLS,ROWS,TILE,RISE,cell,key,height} from '../world/model.mjs?v=water-fill-1';
import {roundedUnder,curveUnder} from '../world/round-geometry.mjs?v=water-fill-1';

// Rounded terrain can contain two physical floors inside one tile. Small local
// components keep a lower corner from joining another basin across high land.
// Flat tiles use a single node, so filling the entire map stays inexpensive.
const GRID=16,STEP=TILE/GRID;
const directions=[[-1,0],[1,0],[0,-1],[0,1]];
const inMap=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
function snapshot(a){const out={surface:a.surface,level:a.level};if(a.paving!==undefined)out.paving=a.paving;if(a.paint)out.paint=a.paint;return out;}
function wet(a){if(a.surface==='water'&&a.paint===undefined&&a.paving===undefined)return a;const out={...a,surface:'water'};delete out.paint;delete out.paving;return out;}

export function planWaterFill(doc,p){
 const result=(message,level=null)=>({edits:[],level,count:0,message});
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return result('Click a ground surface to fill it with water.');
 const sx=Math.floor(p.x/TILE),sy=Math.floor(p.y/TILE);
 if(!inMap(sx,sy))return result('Click inside the map to fill water.');
 if(cell(doc,sx,sy).stairs)return result('Click flat ground beside the stairs to fill that height level.');
 const level=height(doc,p.x,p.y)/RISE;
 if(!Number.isInteger(level))return result('Click a flat ground level to fill water.');
 const cache=new Map();
 function analyze(x,y){
  if(!inMap(x,y))return null;const id=y*COLS+x;if(cache.has(id))return cache.get(id);
  const a=cell(doc,x,y);let node=null;
  if(!a.stairs){
   if(!a.curves?.length){if(a.level===level)node={x,y,a,flat:true,components:[new Set([0])]};}
   else {
    const labels=new Int16Array(GRID*GRID).fill(-1),facets=new Int16Array(GRID*GRID).fill(-1),components=[];
    for(let yy=0;yy<GRID;yy++)for(let xx=0;xx<GRID;xx++){
     const X=x*TILE+(xx+.5)*STEP,Y=y*TILE+(yy+.5)*STEP,q=roundedUnder(doc,a,X,Y),z=q?.kind==='height'?curveUnder(doc,q).level:a.level;
     if(z===level)facets[yy*GRID+xx]=q?a.curves.indexOf(q)+1:0;
    }
    for(let i=0;i<labels.length;i++)if(facets[i]>=0&&labels[i]<0){
     const component=components.length,found=new Set(),queue=[i];labels[i]=component;
     for(let j=0;j<queue.length;j++){
      const v=queue[j],xx=v%GRID,yy=Math.floor(v/GRID);found.add(facets[v]);
      for(const[dx,dy]of directions){const nx=xx+dx,ny=yy+dy,n=ny*GRID+nx;if(nx<0||ny<0||nx>=GRID||ny>=GRID||facets[n]<0||labels[n]>=0)continue;labels[n]=component;queue.push(n);}
     }components.push(found);
    }
    if(components.length)node={x,y,a,flat:false,labels,facets,components};
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
  if(!reached.has(id))reached.set(id,{node,facets:new Set()});for(const facet of node.components[component])reached.get(id).facets.add(facet);
  for(let side=0;side<directions.length;side++){
   const[dx,dy]=directions[side],other=analyze(node.x+dx,node.y+dy);if(!other)continue;
   if(node.flat&&other.flat){enqueue(other,0);continue;}
   for(let i=0;i<GRID;i++)if(boundary(node,side,i)===component){const next=boundary(other,side^1,i);if(next>=0)enqueue(other,next);}
  }
 }
 const edits=new Map(),changedDonors=new Map();let count=0;
 for(const[id,{node,facets}]of reached){
  const a=node.a,k=key(node.x,node.y);let next=a;
  if(facets.has(0))next=wet(next);
  if(a.curves?.length){
   if(!a.curves.some(q=>q.kind==='height')){next={...wet(a)};delete next.curves;}
   else {
    let changed=false;const curves=a.curves.map((q,i)=>{
     if(!facets.has(i+1))return q;const raw=q.under||cell(doc,q.underX,q.underY),under=wet(snapshot(raw));
     if(raw.surface==='water'&&raw.paint===undefined&&raw.paving===undefined)return q;
     changed=true;return {...q,under};
    });if(changed)next={...next,curves};
   }
  }
  if(next===a)continue;edits.set(k,next);count++;
  if(next.surface!==a.surface||next.paving!==a.paving||next.paint!==a.paint)changedDonors.set(k,snapshot(a));
 }
 // A corner outside the filled component may refer to a changed donor tile.
 // Freeze its original material rather than flooding that disconnected floor.
 // Store the raw donor level: curveUnder applies q.lift when it is evaluated.
 if(changedDonors.size)for(const k of Object.keys(doc.cells)){
  const a=edits.get(k)||doc.cells[k];if(!a.curves?.length)continue;let changed=false;
  const curves=a.curves.map(q=>{const under=changedDonors.get(key(q.underX,q.underY));if(q.under||!under)return q;changed=true;return {...q,under};});
  if(changed)edits.set(k,{...a,curves});
 }
 return {edits:[...edits],level,count,message:count?`Filled ${count.toLocaleString('en-US')} tiles with water at level ${level}.`:'This connected area is already water.'};
}
