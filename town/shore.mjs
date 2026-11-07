import {W,H,riverX,riverHalfWidth,lakeShore,water} from './model.mjs';
import {material,noise,rect,environmentDetail} from './art.mjs';

function outline(c,points,dy=0){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y+dy):c.moveTo(x,y+dy));c.closePath();}
function bank(c,points,view){
 // Offset soil and contact shadow expose a real bank instead of a flat outline.
 outline(c,points,24);c.lineJoin='round';c.lineWidth=66;c.strokeStyle='#17392d60';c.stroke();
 outline(c,points,12);c.lineWidth=38;c.strokeStyle=c.createPattern(material(2,'orchard'),'repeat');c.stroke();
 outline(c,points);c.fillStyle=c.createPattern(material(3,'saturate(.65) brightness(.72)'),'repeat');c.fill();
 c.lineWidth=14;c.strokeStyle=c.createPattern(material(0,'garden'),'repeat');c.stroke();
 c.save();outline(c,points);c.clip();c.lineWidth=60;c.strokeStyle='#183d3d77';c.stroke();c.lineWidth=3;c.strokeStyle='#a2c6ad66';c.stroke();c.restore();
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(length/28));for(let j=0;j<count;j++){const t=j/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;if(x<view.x-90||x>view.x+view.w+90||y<view.y-90||y>view.y+view.h+90)continue;const r=noise(x,y),nx=(b[1]-a[1])/Math.max(length,1),ny=-(b[0]-a[0])/Math.max(length,1);let direction=water(x+nx*30,y+ny*30)?-1:1;const bx=x+nx*direction*28,by=y+ny*direction*28;if(j%3===0){c.save();c.translate(x,y);c.rotate(Math.atan2(b[1]-a[1],b[0]-a[0])+(direction<0?Math.PI:0));environmentDetail(c,3,-105,-62,210,83);c.restore();}if(r>.72)environmentDetail(c,1,bx-38,by-44,76,60);if(r<.18)environmentDetail(c,2,bx-55,by-94,110,115);if(r>.88){rect(c,x-5,y-2,13,2,'#aec9b077');rect(c,x-2,y+3,7,1,'#aec9b077');}}}
}
export function drawNaturalWater(c,view){
 const river=[];for(let y=-64;y<=H+64;y+=32)river.push([riverX(y)-riverHalfWidth(y),y]);for(let y=H+64;y>=-64;y-=32)river.push([riverX(y)+riverHalfWidth(y),y]);
 bank(c,river,view);bank(c,lakeShore,view);
 const coast=[[8200,H],[8200,11240+Math.sin(8200/850)*90]];for(let x=8200;x<=W;x+=32)coast.push([x,11240+Math.sin(x/850)*90]);coast.push([W,H]);bank(c,coast,view);
}
