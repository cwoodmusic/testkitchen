import {maskContains,maskBounds,maskRects,maskEdges,maskFront} from './organic-mask.mjs?v=furniture-facings-1';
export const cornerStyles=['smooth','rocky','bevel'];
const styleOf=q=>cornerStyles.includes(q.style)?q.style:'smooth';
const angles={nw:Math.PI,ne:Math.PI*1.5,sw:Math.PI/2,se:0};
const ends={nw:[[-1,0],[0,-1]],ne:[[0,-1],[1,0]],sw:[[0,1],[-1,0]],se:[[1,0],[0,1]]};
const outlineCache=new WeakMap();
function noise(seed,index){let n=Math.imul(seed^Math.imul(index+1,0x9e3779b9),0x85ebca6b);n^=n>>>13;n=Math.imul(n,0xc2b2ae35);n^=n>>>16;return (n>>>0)/4294967296;}
export function curveBounds(q){if(q.mask!==undefined)return maskBounds(q);return {x0:q.corner.includes('w')?q.cx-q.r:q.cx,x1:q.corner.includes('w')?q.cx:q.cx+q.r,y0:q.corner.includes('n')?q.cy-q.r:q.cy,y1:q.corner.includes('n')?q.cy:q.cy+q.r};}
// Boundary points use world coordinates, from the first cardinal endpoint to
// the second in clockwise screen order. All styles share those exact endpoints.
export function curveOutline(q){if(q.mask!==undefined)return maskEdges(q).flat();const style=styleOf(q),key=[q.cx,q.cy,q.r,q.corner,style].join(':'),cached=outlineCache.get(q);if(cached?.key===key)return cached.points;const start=angles[q.corner],segments=style==='bevel'?1:style==='rocky'?7:24,seed=Math.imul(Math.round(q.cx*16),73856093)^Math.imul(Math.round(q.cy*16),19349663)^Math.imul(Math.round(q.r*16),83492791)^Math.round(start*1000),points=[];for(let i=0;i<=segments;i++){if(i===0||i===segments){const p=ends[q.corner][i===0?0:1];points.push([q.cx+p[0]*q.r,q.cy+p[1]*q.r]);continue;}const jitter=style==='rocky'?(noise(seed,i*2)-.5)*.045:0,r=style==='rocky'?q.r*(.85+.15*noise(seed,i*2+1)):q.r,angle=start+Math.PI/2*i/segments+jitter;points.push([q.cx+Math.cos(angle)*r,q.cy+Math.sin(angle)*r]);}outlineCache.set(q,{key,points});return points;}
function inPolygon(x,y,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],cross=(x-a[0])*dy-(y-a[1])*dx,dot=(x-a[0])*dx+(y-a[1])*dy;if(Math.abs(cross)<=.001*Math.max(1,Math.hypot(dx,dy))&&dot>=-.001&&dot<=dx*dx+dy*dy+.001)return true;if((b[1]>y)!==(a[1]>y)&&x<(a[0]-b[0])*(y-b[1])/(a[1]-b[1])+b[0])hit=!hit;}return hit;}
export function insideCurve(q,x,y){if(q.mask!==undefined)return maskContains(q,x,y);const b=curveBounds(q);if(x<b.x0||x>b.x1||y<b.y0||y>b.y1)return true;if(styleOf(q)==='smooth'){const distance=(x-q.cx)**2+(y-q.cy)**2;return q.concave?distance>=q.r*q.r-.001:distance<=q.r*q.r+.001;}const inside=inPolygon(x,y,[[q.cx,q.cy],...curveOutline(q)]);return q.concave?!inside:inside;}
export function curveUnder(d,q){const a=q.under||d.cells[`${q.underX},${q.underY}`]||{surface:'grass',level:0};return {...a,level:Math.max(0,Math.min(8,a.level+(q.lift||0)))};}
export function roundedUnder(d,a,x,y){return a.curves?.find(q=>!insideCurve(q,x,y));}
function polygonFront(q,x){let y=-Infinity;const points=curveOutline(q);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(x<Math.min(a[0],b[0])-.001||x>Math.max(a[0],b[0])+.001)continue;if(Math.abs(b[0]-a[0])<.00001){if(Math.abs(x-a[0])<.001)y=Math.max(y,a[1],b[1]);continue;}const t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));y=Math.max(y,a[1]+(b[1]-a[1])*t);}return y;}
export function frontEdge(a,x,y){let edge=(y+1)*64;for(const q of a.curves||[]){if(q.kind==='height'&&q.mask!==undefined){const front=maskFront(q,x);if(front!==null&&front>=y*64-.001&&front<=edge+.001)edge=Math.min(edge,front);continue;}if(q.kind!=='height'||!q.corner.includes(q.concave?'n':'s'))continue;const b=curveBounds(q);if(x<b.x0||x>b.x1)continue;const front=styleOf(q)==='smooth'?q.cy+(q.concave?-1:1)*Math.sqrt(Math.max(0,q.r*q.r-(x-q.cx)**2)):polygonFront(q,x);if(front>=y*64-.001&&front<=edge+.001)edge=Math.min(edge,front);}return edge;}
function maskClipRects(c,q,z){
 // Native tiles use nearest-neighbor image sampling. Snap the contour to that
 // same device-pixel grid so subpixel clips cannot reveal the under-material
 // along an otherwise continuous tile boundary when zooming the editor.
 const t=c.getTransform?.(),snap=t&&Math.abs(t.b)<1e-9&&Math.abs(t.c)<1e-9&&t.a&&t.d,b=maskBounds(q);
 for(const r of maskRects(q,z)){
  if(!snap){c.rect(r.x,r.y,r.w,r.h);continue;}
  const x0=r.x===b.x0?r.x-1/Math.abs(t.a):(Math.round(r.x*t.a+t.e)-t.e)/t.a;
  const x1=r.x+r.w===b.x1?r.x+r.w+1/Math.abs(t.a):(Math.round((r.x+r.w)*t.a+t.e)-t.e)/t.a;
  const y0=r.y===b.y0-z?r.y-1/Math.abs(t.d):(Math.round(r.y*t.d+t.f)-t.f)/t.d;
  const y1=r.y+r.h===b.y1-z?r.y+r.h+1/Math.abs(t.d):(Math.round((r.y+r.h)*t.d+t.f)-t.f)/t.d;
  c.rect(x0,y0,x1-x0,y1-y0);
 }
}
export function clipCurves(c,a,x,y,z=0){
 // A mask already covers exactly its owner tile. A second, unsnapped clip
 // would reintroduce antialiased seams at every old square tile boundary.
 if(!a.curves?.some(q=>q.mask!==undefined)){c.beginPath();c.rect(x*64,y*64-z,64,64);c.clip();}
 for(const q of a.curves||[]){const b=curveBounds(q),X=x*64,Y=y*64;c.beginPath();
 if(q.mask!==undefined){maskClipRects(c,q,z);c.clip();continue;}
 if(q.concave){
  // An inside fillet adds the land outside the quarter disk in an empty notch.
  // Subtract only that sector, preserving the rest of this terrain cell.
  c.rect(X,Y-z,64,64);c.moveTo(q.cx,q.cy-z);const points=curveOutline(q);c.lineTo(points[0][0],points[0][1]-z);
  if(styleOf(q)==='smooth')c.arc(q.cx,q.cy-z,q.r,angles[q.corner],angles[q.corner]+Math.PI/2);else for(const[px,py]of points.slice(1))c.lineTo(px,py-z);
  c.closePath();c.clip('evenodd');continue;
 }
 if(b.x0>X)c.rect(X,Y-z,Math.min(64,b.x0-X),64);if(b.x1<X+64)c.rect(Math.max(X,b.x1),Y-z,X+64-Math.max(X,b.x1),64);if(b.y0>Y)c.rect(X,Y-z,64,Math.min(64,b.y0-Y));if(b.y1<Y+64)c.rect(X,Math.max(Y,b.y1)-z,64,Y+64-Math.max(Y,b.y1));if(styleOf(q)==='smooth'){c.moveTo(q.cx+q.r,q.cy-z);c.arc(q.cx,q.cy-z,q.r,0,Math.PI*2);}else{c.moveTo(q.cx,q.cy-z);for(const[px,py]of curveOutline(q))c.lineTo(px,py-z);c.closePath();}c.clip();}}
