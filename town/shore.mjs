import {W,H,riverX,riverHalfWidth,lakeShore,water} from './model.mjs';
import {material,rect,noise} from './art.mjs?v=festival-town-1';
import {shorelineTile} from './terrain-tiles.mjs?v=festival-town-1';
function outline(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
export function drawNaturalWater(c,view){
 // Water and dry ground share one collision boundary. Banks are connected,
 // unrotated terrain tiles; no decorative fringe is stamped around a curve.
 const river=[];for(let y=-64;y<=H+64;y+=32)river.push([riverX(y)-riverHalfWidth(y),y]);for(let y=H+64;y>=-64;y-=32)river.push([riverX(y)+riverHalfWidth(y),y]);
 const coast=[[8200,H],[8200,11240+Math.sin(8200/850)*90]];for(let x=8200;x<=W;x+=32)coast.push([x,11240+Math.sin(x/850)*90]);coast.push([W,H]);
 c.fillStyle=c.createPattern(material(3,'saturate(.85) brightness(.8)'),'repeat');for(const shape of [river,lakeShore,coast]){outline(c,shape);c.fill();}
 const size=16,x0=Math.max(0,Math.floor((view.x-48)/size)*size),y0=Math.max(0,Math.floor((view.y-64)/size)*size),x1=Math.min(W,view.x+view.w+48),y1=Math.min(H,view.y+view.h+64);
 for(let y=y0;y<y1;y+=size)for(let x=x0;x<x1;x+=size){const wet=water(x+8,y+8),north=water(x+8,y-8),south=water(x+8,y+24),east=water(x+24,y+8),west=water(x-8,y+8);
  if(wet&&!north)shorelineTile(c,x,y,'north',1);
  if(!wet&&north)shorelineTile(c,x,y,'south',1);
  if(!wet&&east)shorelineTile(c,x,y,'east',1);
  if(!wet&&west)shorelineTile(c,x,y,'west',1);
  if(!wet&&(north||south||east||west)&&noise(x,y)>.89){for(let i=0;i<4;i++){const xx=x+i*4,hh=14+(i%3)*5;rect(c,xx,y-hh,2,hh,'#32633b');rect(c,xx-2,y-8,4,3,'#73a753');if(i===1)rect(c,xx,y-hh-5,3,7,'#b08e60');}}
 }
}
