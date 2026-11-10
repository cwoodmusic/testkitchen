import {blocked,height,segment,cell,TILE} from './model.mjs?v=apartment-homes-2';
import {WALK_SPEED,RUN_SPEED} from './player-settings.mjs?v=apartment-homes-2';
export function findStart(doc,catalog){if(!blocked(doc,doc.spawn.x,doc.spawn.y,catalog))return {...doc.spawn};for(let r=1;r<100;r++)for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){if(Math.abs(x)!==r&&Math.abs(y)!==r)continue;const p={x:doc.spawn.x+x*64,y:doc.spawn.y+y*64};if(!blocked(doc,p.x,p.y,catalog))return p;}throw Error('No walkable start found. Place a walk start on clear ground.');}
export function movePlayer(doc,player,keys,dt,catalog){
 const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0),len=Math.hypot(dx,dy)||1,speed=keys.has('shift')?RUN_SPEED:WALK_SPEED;
 if(!dx&&!dy)return {distance:0,surfaceDistance:0,walking:false,facing:null};
 const start={x:player.x,y:player.y},steps=Math.max(4,Math.ceil(speed*dt/1.5));let surfaceDistance=0;
 for(let i=0;i<steps;i++){
  let sx=dx/len*speed*dt/steps,sy=dy/len*speed*dt/steps;
  const before={x:player.x,y:player.y},z=height(doc,player.x,player.y),ground=Math.hypot(sx,sy);
  if(ground){
   const a=cell(doc,Math.floor(player.x/TILE),Math.floor(player.y/TILE)),b=cell(doc,Math.floor((player.x+sx)/TILE),Math.floor((player.y+sy)/TILE));
   if(a.stairs||b.stairs){
    // A steep north-facing stair can project seven times farther than its
    // ground run. Budget both surface and projected travel before collision.
    const costAt=f=>{const x=sx*f,y=sy*f,dz=height(doc,player.x+x,player.y+y)-z;return Math.max(Math.hypot(x,y),Math.hypot(x,y,dz),Math.hypot(x,y-dz));};
    let factor=Math.min(1,ground/costAt(1));
    // At a landing, dz need not shrink linearly with the ground step. Refine
    // only those boundary cases so neither the actor nor camera exceeds budget.
    if(costAt(factor)>ground+1e-7){let low=0,high=factor;for(let j=0;j<12;j++){const mid=(low+high)/2;if(costAt(mid)<=ground)low=mid;else high=mid;}factor=low;}
    sx*=factor;sy*=factor;
   }
  }
  const x=player.x+sx,y=player.y+sy;
  if(!blocked(doc,x,player.y,catalog,player))player.x=x;
  if(!blocked(doc,player.x,y,catalog,player))player.y=y;
  surfaceDistance+=Math.hypot(player.x-before.x,player.y-before.y,height(doc,player.x,player.y)-z);
 }
 const distance=Math.hypot(player.x-start.x,player.y-start.y);
 return {distance,surfaceDistance,walking:distance>1e-8,facing:dx||dy?Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up':null};
}
export function toggleGate(doc,player){for(const[k,v]of Object.entries(doc.edges)){const s=segment(k);if(v.gate&&Math.hypot(player.x-s.x-s.dx/2,player.y-s.y-s.dy/2)<120){v.open=!v.open;return true;}}return false;}
export function follow(cam,player,doc){cam.x=player.x;cam.y=player.y-height(doc,player.x,player.y);}
