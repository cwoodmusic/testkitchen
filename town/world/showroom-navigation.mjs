const STEP=8,RADIUS=6,GOAL_TOLERANCE=14,cache=new WeakMap();
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const point=p=>p&&finite(p.x)&&finite(p.y);
const same=(a,b)=>a.x===b.x&&a.y===b.y;

function collision(scene){
 const solids=(scene.solids||[]).filter(r=>r&&[r.x,r.y,r.w,r.h].every(finite)&&r.w>0&&r.h>0).map(r=>({x:r.x-RADIUS,y:r.y-RADIUS,w:r.w+RADIUS*2,h:r.h+RADIUS*2}));
 const inside=p=>point(p)&&p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40;
 const clear=p=>inside(p)&&!solids.some(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h);
 function segment(a,b){
  if(!clear(a)||!clear(b))return false;
  for(const r of solids){
   let from=0,to=1,intersects=true;
   for(const axis of ['x','y']){
    const delta=b[axis]-a[axis],low=r[axis],high=low+r[axis==='x'?'w':'h'];
    if(delta===0){if(a[axis]<low||a[axis]>high){intersects=false;break;}}
    else{const first=(low-a[axis])/delta,last=(high-a[axis])/delta;from=Math.max(from,Math.min(first,last));to=Math.min(to,Math.max(first,last));if(from>to){intersects=false;break;}}
   }
   if(intersects)return false;
  }
  return true;
 }
 return {solids,clear,segment};
}
function compact(points){
 const result=[];
 for(const p of points){
  if(result.length&&same(p,result.at(-1)))continue;
  while(result.length>1){const a=result.at(-2),b=result.at(-1);if(Math.abs((b.x-a.x)*(p.y-b.y)-(b.y-a.y)*(p.x-b.x))>1e-8)break;result.pop();}
  result.push({x:p.x,y:p.y});
 }
 return Object.freeze(result.map(Object.freeze));
}
const routes=visitRoute=>Object.freeze({visitRoute,exitRoute:Object.freeze([...visitRoute].reverse())});

/** Replan edited display rooms without changing their authored tours or models. */
export function getShowroomNavigation(scene){
 if(!scene||typeof scene!=='object')return null;
 if(cache.has(scene))return cache.get(scene);
 const plan=scene.showroom?.apartment;
 if(!plan||!Array.isArray(plan.visitRoute)||!Array.isArray(plan.exitRoute)){cache.set(scene,null);return null;}
 if(scene.layoutRevision===undefined&&!scene.roomLayoutBaseItems&&!scene.wideRoomExpansion){const original=Object.freeze({visitRoute:plan.visitRoute,exitRoute:plan.exitRoute});cache.set(scene,original);return original;}
 const {spawn}=scene,goal=plan.browse;
 if(!point(spawn)||!point(goal)||!finite(scene.width)||!finite(scene.height)||scene.width<80||scene.height<152){cache.set(scene,null);return null;}
 const geometry=collision(scene);
 if(!geometry.clear(spawn)){cache.set(scene,null);return null;}
 const original=plan.visitRoute;
 if(original.length&&original.every(point)&&same(original[0],spawn)&&same(original.at(-1),goal)&&original.every((p,i)=>i?geometry.segment(original[i-1],p):geometry.clear(p))){const result=routes(original);cache.set(scene,result);return result;}

 const cols=Math.ceil(scene.width/STEP),rows=Math.ceil(scene.height/STEP),total=cols*rows,blocked=new Uint8Array(total),parents=new Int32Array(total),queue=new Int32Array(total);
 parents.fill(-2);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x*STEP+4<40||x*STEP+4>scene.width-40||y*STEP+4<112||y*STEP+4>scene.height-40)blocked[y*cols+x]=1;
 for(const r of geometry.solids){const x0=Math.max(0,Math.ceil((r.x-4)/STEP)),x1=Math.min(cols-1,Math.floor((r.x+r.w-4)/STEP)),y0=Math.max(0,Math.ceil((r.y-4)/STEP)),y1=Math.min(rows-1,Math.floor((r.y+r.h-4)/STEP));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;}
 const at=index=>({x:(index%cols)*STEP+4,y:Math.floor(index/cols)*STEP+4}),sx=Math.floor(spawn.x/STEP),sy=Math.floor(spawn.y/STEP);let tail=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const x=sx+dx,y=sy+dy,index=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||blocked[index]||parents[index]!==-2||!geometry.segment(spawn,at(index)))continue;
  parents[index]=-1;queue[tail++]=index;
 }
 const exactGoal=geometry.clear(goal);let end=-1,bestDistance=Infinity;
 for(let head=0;head<tail;head++){
  const index=queue[head],p=at(index),distance=(p.x-goal.x)**2+(p.y-goal.y)**2;
  if(distance<=GOAL_TOLERANCE**2){
   if(exactGoal&&geometry.segment(p,goal)){end=index;break;}
   if(!exactGoal&&distance<bestDistance){end=index;bestDistance=distance;}
  }
  const x=index%cols,y=Math.floor(index/cols);
  // Inflating every solid by six pixels makes it wider than an eight-pixel
  // axial grid edge, so two free neighboring nodes cannot cross a thin wall.
  for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=Y*cols+X;if(X<0||Y<0||X>=cols||Y>=rows||blocked[next]||parents[next]!==-2)continue;parents[next]=index;queue[tail++]=next;}
 }
 if(end<0){cache.set(scene,null);return null;}
 const path=[];for(let index=end;index>=0;index=parents[index])path.push(at(index));path.reverse();path.unshift(spawn);if(exactGoal)path.push(goal);
 const result=routes(compact(path));cache.set(scene,result);return result;
}
