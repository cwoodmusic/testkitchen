import {maskEdges} from './organic-mask.mjs?v=queues-stage-1';
import {curveOutline} from './round-geometry.mjs?v=queues-stage-1';
export function curvePath(q,z=0){const path=new Path2D();if(q.mask!==undefined){for(const[[x,y],[xx,yy]]of maskEdges(q,z)){path.moveTo(x,y);path.lineTo(xx,yy);}return path;}if(!q.style||q.style==='smooth'){const angle={nw:Math.PI,ne:Math.PI*1.5,sw:Math.PI/2,se:0}[q.corner];path.arc(q.cx,q.cy-z,q.r,angle,angle+Math.PI/2);}else{const points=curveOutline(q);path.moveTo(points[0][0],points[0][1]-z);for(const[x,y]of points.slice(1))path.lineTo(x,y-z);}return path;}
