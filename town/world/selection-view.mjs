import {height} from './model.mjs?v=town-polish-1';
import {selectionGeometry,selectionGeometryView} from './selection-geometry.mjs?v=town-polish-1';

const paths=new WeakMap();

export function drawSelection(c,d,r,{plan=false,zoom=1,bounds={x0:0,y0:0,x1:256,y1:192},revision}={}){
 if(!r)return;c.save();c.fillStyle='#f0cb5940';c.strokeStyle='#ffe29b';c.lineWidth=2/zoom;
 if(r.preview&&r.outline?.length){
  c.beginPath();for(let i=0;i<r.outline.length;i++){const p=r.outline[i],Y=p.y-(plan?0:height(d,p.x,p.y));if(i===0)c.moveTo(p.x,Y);else c.lineTo(p.x,Y);}c.closePath();c.fill();c.setLineDash([7/zoom,5/zoom]);c.stroke();c.restore();return;
 }
 const geometry=selectionGeometry(d,r,{plan,revision}),view=selectionGeometryView(geometry,bounds);
 for(const rect of view.fills)c.fillRect(rect.x,rect.y,rect.w,rect.h);
 if(typeof Path2D!=='undefined'){
  let path=paths.get(view);
  if(!path){path=new Path2D();for(const[x0,y0,x1,y1]of view.segments){path.moveTo(x0,y0);path.lineTo(x1,y1);}paths.set(view,path);}
  c.stroke(path);
 }else{
  c.beginPath();for(const[x0,y0,x1,y1]of view.segments){c.moveTo(x0,y0);c.lineTo(x1,y1);}c.stroke();
 }
 c.restore();
}
