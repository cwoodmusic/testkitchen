import {blocked,cell,surfaceAt,COLS,ROWS} from './model.mjs?v=town-flight-1';
import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
export function createIslandNavigation(doc,catalog,dock){
 const sea=Object.create(doc);Object.defineProperties(sea,{objects:{value:doc.objects.filter(o=>!dock.boat.id||o.id!==dock.boat.id)},[Symbol.for('coda.town.waterNavigation')]:{value:true},[Symbol.for('coda.town.collisionRadius')]:{value:25}});
 const index=createPlayerCollisionIndex({getProject:()=>sea,catalog,getRevision:()=>0,maxViews:128});
 function clear(p){return [[0,0],[-24,0],[24,0],[0,-24],[0,24]].every(([dx,dy])=>{const x=p.x+dx,y=p.y+dy,a=cell(doc,Math.floor(x/64),Math.floor(y/64));return surfaceAt(doc,x,y)==='water'&&!a.bridge&&a.level===0&&!blocked(index.view({x,y}),x,y,catalog);});}
 let spawn;for(let r=0;r<32&&!spawn;r++){const candidates=[];for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){if(r&&Math.abs(x)!==r&&Math.abs(y)!==r)continue;const p={x:(Math.floor(dock.boat.x/64)+x)*64+32,y:(Math.floor(dock.boat.y/64)+y)*64+32};if(clear(p))candidates.push(p);}candidates.sort((a,b)=>Math.hypot(a.x-dock.boat.x,a.y-dock.boat.y)-Math.hypot(b.x-dock.boat.x,b.y-dock.boat.y));spawn=candidates[0];}
 if(!spawn)return null;
 const points=[spawn],seen=new Set([`${spawn.x},${spawn.y}`]);
 for(let i=0;i<points.length;i++)for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){const a=points[i],p={x:a.x+dx,y:a.y+dy},key=`${p.x},${p.y}`;if(seen.has(key)||p.x<32||p.y<32||p.x>COLS*64-32||p.y>ROWS*64-32)continue;seen.add(key);if(clear(p)&&clear({x:(p.x+a.x)/2,y:(p.y+a.y)/2}))points.push(p);}
 function move(boat,dx,dy,dt,speed=580){const length=Math.hypot(dx,dy);if(!length)return 0;const amount=speed*Math.min(.05,Math.max(0,dt)),steps=Math.max(1,Math.ceil(amount/4)),sx=dx/length*amount/steps,sy=dy/length*amount/steps,start={...boat};for(let i=0;i<steps;i++){if(clear({x:boat.x+sx,y:boat.y}))boat.x+=sx;if(clear({x:boat.x,y:boat.y+sy}))boat.y+=sy;}boat.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';return Math.hypot(boat.x-start.x,boat.y-start.y);}
 return {spawn,points,clear,move};
}
