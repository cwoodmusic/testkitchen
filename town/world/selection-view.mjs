import {cell,height} from './model.mjs?v=city-residents-1';
import {selectionContains} from './selection.mjs?v=city-residents-1';

export function drawSelection(c,d,r,{plan=false,zoom=1,bounds={x0:0,y0:0,x1:256,y1:192}}={}){
 if(!r)return;c.save();c.fillStyle='#f0cb5940';c.strokeStyle='#ffe29b';c.lineWidth=2/zoom;
 if(r.preview&&r.outline?.length){
  c.beginPath();for(let i=0;i<r.outline.length;i++){const p=r.outline[i],Y=p.y-(plan?0:height(d,p.x,p.y));if(i===0)c.moveTo(p.x,Y);else c.lineTo(p.x,Y);}c.closePath();c.fill();c.setLineDash([7/zoom,5/zoom]);c.stroke();c.restore();return;
 }
 c.beginPath();
 for(let y=Math.max(bounds.y0,r.y0);y<=Math.min(bounds.y1-1,r.y1);y++)for(let x=Math.max(bounds.x0,r.x0);x<=Math.min(bounds.x1-1,r.x1);x++){
  if(!selectionContains(r,x,y))continue;const X=x*64,Y=y*64-(plan?0:cell(d,x,y).level*48);c.fillRect(X,Y,64,64);
  if(!selectionContains(r,x,y-1)){c.moveTo(X,Y);c.lineTo(X+64,Y);}
  if(!selectionContains(r,x+1,y)){c.moveTo(X+64,Y);c.lineTo(X+64,Y+64);}
  if(!selectionContains(r,x,y+1)){c.moveTo(X+64,Y+64);c.lineTo(X,Y+64);}
  if(!selectionContains(r,x-1,y)){c.moveTo(X,Y+64);c.lineTo(X,Y);}
 }
 c.stroke();c.restore();
}
