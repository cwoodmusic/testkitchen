import {curvePath} from './curve-path.mjs?v=town-compact-island-1';
import {cell,height} from './model.mjs?v=town-coast-pier-1';
import {clipCurves,curveUnder} from './round-geometry.mjs?v=town-compact-island-1';
// Native lip detail belongs to the raised surface; lower ground stays unshaded.
function rim(c,path,strong=false){for(const[width,alpha]of [[54,.035],[38,.07],[26,.13],[16,.23],[7,.34]]){c.strokeStyle=`rgba(18,43,28,${Math.min(.65,alpha*(strong?1.35:1))})`;c.lineWidth=width;c.stroke(path);}c.strokeStyle='#b7c87855';c.lineWidth=3;c.stroke(path);c.strokeStyle='#344523b8';c.lineWidth=1.5;c.stroke(path);}
export function drawTerrainRims(c,d,x0,x1,y0,y1){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const a=cell(d,x,y);if(a.stairs||a.level===0)continue;if(!a.curves&&[[0,-1],[-1,0],[1,0]].every(([dx,dy])=>{const b=cell(d,x+dx,y+dy);return !b.stairs&&!b.curves&&b.level>=a.level;}))continue;const z=a.level*48,X=x*64,Y=y*64-z;c.save();clipCurves(c,a,x,y,z);
 for(const side of ['north','west','east'])for(let i=0;i<4;i++){const t=i*16,px=side==='west'?X:side==='east'?X+64:X+t+8,py=side==='north'?y*64:y*64+t+8,insideX=side==='west'?px+.05:side==='east'?px-.05:px,insideY=side==='north'?py+.05:py,outsideX=side==='west'?px-.05:side==='east'?px+.05:px,outsideY=side==='north'?py-.05:py;if(height(d,insideX,insideY)-height(d,outsideX,outsideY)<1)continue;const path=new Path2D();if(side==='north'){path.moveTo(X+t,Y);path.lineTo(X+t+16,Y);}else{path.moveTo(px,Y+t);path.lineTo(px,Y+t+16);}rim(c,path,side==='east');}
 for(const q of a.curves||[]){if(q.kind!=='height'||curveUnder(d,q).level>=a.level)continue;rim(c,curvePath(q,z),q.corner.includes(q.concave?'w':'e'));}
 c.restore();}}
