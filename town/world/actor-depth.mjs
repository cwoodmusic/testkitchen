// Depth is expressed in unprojected ground coordinates. Elevation changes
// where artwork is drawn, but must not change which ground row owns it.
const cache=new WeakMap();
const rotatePoint=(a,o,x,y)=>{const r=(o.rotation||0)*Math.PI/180,s=o.scale||1,dx=(x-a.w/2)*s,dy=(y-a.h)*s;return {x:o.x+dx*Math.cos(r)-dy*Math.sin(r),y:o.y+dx*Math.sin(r)+dy*Math.cos(r)};};
const rectPoints=b=>[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]];
const shapePolygons=(a,polygons=a.polygons)=>{const shapes=[...(polygons||[]),...(a.boxes||[]).map(rectPoints)];return shapes.length?shapes:a.footprint?[rectPoints(a.footprint)]:[];};

export function scenePartDepth(a,o,part){
 const xs=part.outline.map(p=>p[0]),left=Math.min(...xs),right=Math.max(...xs);
 return Math.max(rotatePoint(a,o,left,part.depth).y,rotatePoint(a,o,right,part.depth).y);
}
export function physicalObjectDepth(a,o,fallback=o.y){
 if(!a.depthSorted)return fallback;
 const points=shapePolygons(a).flat();return points.length?Math.max(...points.map(([x,y])=>rotatePoint(a,o,x,y).y)):fallback;
}

// One queue depth cannot describe the arcade's recessed facade and its club
// wing. Partition the original image by its physical front envelope instead.
// Constant-front buildings merge to one draw; no actor or camera participates.
export function buildingDepthSlices(a,o){
 if(o.mount||!a.frontAtX)return null;
 const key=[o.x,o.y,o.scale||1,o.rotation||0,a.w,a.h].join(':'),old=cache.get(o);
 if(old?.key===key&&old.asset===a)return old.parts;
 // A thin railing can block feet while the opaque artwork beneath it is a
 // walkable floor. Use its masonry envelope for image depth, not that rail.
 const polygons=shapePolygons(a,a.depthPolygons??a.polygons).map(p=>p.map(([x,y])=>rotatePoint(a,o,x,y)));
 if(!polygons.length)return null;
 const image=rectPoints({x:0,y:0,w:a.w,h:a.h}).map(([x,y])=>rotatePoint(a,o,x,y));
 const imageLeft=Math.min(...image.map(p=>p.x)),imageRight=Math.max(...image.map(p=>p.x));
 const points=polygons.flat(),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),edges=[],breaks=[imageLeft,imageRight,left,right];
 for(const polygon of polygons)for(let i=0;i<polygon.length;i++){
  const p=polygon[i],q=polygon[(i+1)%polygon.length];breaks.push(p.x);
  if(Math.abs(p.x-q.x)<1e-8)continue;
  const slope=(q.y-p.y)/(q.x-p.x);edges.push({x0:Math.min(p.x,q.x),x1:Math.max(p.x,q.x),slope,intercept:p.y-slope*p.x});
 }
 // The upper envelope can change where edges from different polygons cross.
 for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
  const p=edges[i],q=edges[j],delta=p.slope-q.slope;if(Math.abs(delta)<1e-8)continue;
  const x=(q.intercept-p.intercept)/delta;if(x>Math.max(p.x0,q.x0)+1e-8&&x<Math.min(p.x1,q.x1)-1e-8)breaks.push(x);
 }
 const front=x=>{const X=Math.max(left+1e-6,Math.min(right-1e-6,x));let value=-Infinity;for(const e of edges)if(X>=e.x0-1e-8&&X<=e.x1+1e-8)value=Math.max(value,e.slope*X+e.intercept);return Number.isFinite(value)?value:o.y;};
 const stops=breaks.filter(x=>x>=imageLeft-1e-6&&x<=imageRight+1e-6).sort((x,y)=>x-y).filter((x,i,list)=>!i||x-list[i-1]>1e-6),parts=[];
 for(let i=1;i<stops.length;i++){
  const x0=stops[i-1],x1=stops[i];if(x1-x0<1e-6)continue;
  // Diagonal facades retain a close approximation while bounding draw count.
  const n=Math.max(1,Math.ceil(Math.abs(front(x1-1e-6)-front(x0+1e-6))/16));
  for(let j=0;j<n;j++){
   const start=x0+(x1-x0)*j/n,end=x0+(x1-x0)*(j+1)/n,depth=front((start+end)/2),previous=parts.at(-1);
   if(previous&&Math.abs(previous.depth-depth)<1e-6)previous.x1=end;else parts.push({x0:start,x1:end,depth});
  }
 }
 cache.set(o,{key,asset:a,parts});return parts;
}

// A world-vertical facade strip maps to native image columns or rows at the
// builder's quarter-turn rotations. Crop the source as well as clipping the
// destination, so a narrow strip never submits the complete large texture.
// Padding is in world units and covers the existing rounded device clip edge.
export function buildingSliceRect(a,o,part,padding=0){
 if(!part||!Number.isFinite(part.x0)||!Number.isFinite(part.x1)||part.x1<=part.x0||!Number.isFinite(a.w)||!Number.isFinite(a.h)||a.w<=0||a.h<=0)return null;
 const scale=o.scale||1,turn=(o.rotation||0)/90;
 if(scale<=0||!Number.isFinite(turn)||Math.abs(turn-Math.round(turn))>1e-8)return null;
 const quarter=((Math.round(turn)%4)+4)%4,pad=Math.max(0,Number.isFinite(padding)?padding:0),left=part.x0-pad,right=part.x1+pad;
 const clamp=(value,max)=>Math.max(0,Math.min(max,value));
 if(quarter===0||quarter===2){
  const x0=quarter===0?(left-o.x)/scale+a.w/2:(o.x-right)/scale+a.w/2;
  const x1=quarter===0?(right-o.x)/scale+a.w/2:(o.x-left)/scale+a.w/2;
  const x=clamp(x0,a.w),end=clamp(x1,a.w);return {x,y:0,w:Math.max(0,end-x),h:a.h};
 }
 const y0=quarter===1?a.h-(right-o.x)/scale:a.h+(left-o.x)/scale;
 const y1=quarter===1?a.h-(left-o.x)/scale:a.h+(right-o.x)/scale;
 const y=clamp(y0,a.h),end=clamp(y1,a.h);return {x:0,y,w:a.w,h:Math.max(0,end-y)};
}

// The caller sorts the complete queue first, including NPCs, player, fences
// and other objects. Consecutive strips of one building can then share one
// draw without crossing a single foreign layer. Disjoint x ranges retain a
// union clip: merging their bounding rectangle alone would cover a gap.
// Building entries must be dispatched using the returned fragment metadata,
// rather than an original per-strip draw closure retained on the entry.
export function batchBuildingDepthQueue(queue){
 const result=[],candidate=entry=>entry?.building!=null&&Number.isFinite(entry.fragment?.x0)&&Number.isFinite(entry.fragment?.x1)&&entry.fragment.x1>entry.fragment.x0;
 for(let i=0;i<queue.length;){
  const first=queue[i];
  if(!candidate(first)){result.push(first);i++;continue;}
  let end=i+1;
  while(end<queue.length&&candidate(queue[end])&&queue[end].building===first.building)end++;
  if(end===i+1){result.push(first);i=end;continue;}
  const ranges=[];let count=0;
  for(let at=i;at<end;at++){
   const entry=queue[at];count+=entry.depthBatchCount||1;
   for(const span of entry.fragment.spans||[entry.fragment])ranges.push({x0:span.x0,x1:span.x1});
  }
  ranges.sort((a,b)=>a.x0-b.x0||a.x1-b.x1);
  const spans=[];
  for(const span of ranges){
   const previous=spans.at(-1);
   if(previous&&span.x0<=previous.x1+1e-7)previous.x1=Math.max(previous.x1,span.x1);
   else spans.push(span);
  }
  result.push({...first,fragment:{...first.fragment,x0:spans[0].x0,x1:spans.at(-1).x1,spans},depthBatchCount:count});
  i=end;
 }
 return result;
}
