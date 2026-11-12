import {cell,height} from './model.mjs?v=opera-parallax-1';
import {curveUnder,frontEdge,curveBounds,curveOutline,clipCurves} from './round-geometry.mjs?v=opera-parallax-1';
import {decodeMask,encodeMask} from './organic-mask.mjs?v=opera-parallax-1';
import {cliffArt} from './detail-art.mjs?v=opera-parallax-1';
import {drawGround,groundFrameKey} from './ground-render.mjs?v=opera-parallax-1';
const inverses=new WeakMap(),angles={nw:Math.PI,ne:Math.PI*1.5,sw:Math.PI/2,se:0};
function clipUnder(c,q,x,y,z){
 if(q.mask!==undefined){
  let inverse=inverses.get(q);if(!inverse||inverse.source!==q.mask){const bits=decodeMask(q.mask);for(let i=0;i<bits.length;i++)bits[i]^=1;inverse={source:q.mask,curve:{...q,mask:encodeMask(bits)}};inverses.set(q,inverse);}
  clipCurves(c,{curves:[inverse.curve]},x,y,z);return;
 }
 const b=curveBounds(q),X=Math.max(x*64,b.x0),Y=Math.max(y*64,b.y0),right=Math.min((x+1)*64,b.x1),bottom=Math.min((y+1)*64,b.y1);
 c.beginPath();c.rect(X,Y-z,Math.max(0,right-X),Math.max(0,bottom-Y));c.clip();
 c.beginPath();if(!q.concave)c.rect(X,Y-z,Math.max(0,right-X),Math.max(0,bottom-Y));
 const outline=curveOutline(q);c.moveTo(q.cx,q.cy-z);c.lineTo(outline[0][0],outline[0][1]-z);
 if(!q.style||q.style==='smooth')c.arc(q.cx,q.cy-z,q.r,angles[q.corner],angles[q.corner]+Math.PI/2);else for(const[px,py]of outline.slice(1))c.lineTo(px,py-z);
 c.closePath();c.clip(q.concave?'nonzero':'evenodd');
}
export function drawRoundUnder(c,d,x,y,frameKey=groundFrameKey(d)){
 const a=cell(d,x,y);if(!a.curves?.length)return;
 for(let i=0;i<a.curves.length;i++){
  const q=a.curves[i],u=curveUnder(d,q),z=(q.kind==='height'?u.level:a.level)*48,X=x*64,Y=y*64-z;
  c.save();if(i)clipCurves(c,{curves:a.curves.slice(0,i)},x,y,z);clipUnder(c,q,x,y,z);drawGround(c,d,u,x,y,X,Y,frameKey);c.restore();
 }
}
export function drawRoundCliff(c,d,x,y){const a=cell(d,x,y);if(!a.curves?.some(q=>q.kind==='height'))return;const img=cliffArt;for(let i=0;i<16;i++){const X=x*64+i*4,edge0=frontEdge(a,X+.001,y),edge1=frontEdge(a,X+3.999,y),mid=frontEdge(a,X+2,y);if(mid>=(y+1)*64-.001)continue;const z=height(d,X+2,mid-.05),bottom=height(d,X+2,mid+.05),depth=z-bottom;if(depth<.1)continue;const sx=img.width*.06+(X%384)/384*img.width*.88,sw=img.width*.88*4/384;c.save();c.transform(1,(edge1-edge0)/4,0,1,X,edge0-z);c.fillStyle='#555b3e';c.fillRect(0,0,4,depth);for(let j=0;j<depth;j+=176){const h=Math.min(176,depth-j);c.drawImage(img,sx,img.height*.18,sw,img.height*.78*h/176,0,j,4,h);}c.drawImage(img,sx,0,sw,img.height*.28,0,-12,4,38);const shadow=c.createLinearGradient(0,0,0,depth);shadow.addColorStop(0,'#24311e55');shadow.addColorStop(.4,'#17221900');shadow.addColorStop(1,'#16211777');c.fillStyle=shadow;c.fillRect(0,13,4,Math.max(0,depth-13));c.restore();}}
