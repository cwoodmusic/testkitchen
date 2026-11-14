import {getShowroomNavigation} from './showroom-navigation.mjs?v=town-wide-rooms-1';

const STEP=6,RADIUS=6;
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const role=item=>item.slot||item.collectionSlot||item.furnitureRole;
const inside=(r,p)=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h;

/** Recalculate derived destinations once after private furniture is committed. */
export function refreshRoomLayoutNavigation(scene){
 if(!['apartment','showroom'].includes(scene.kind)||!scene.approvedRoomLayout&&!Number.isFinite(scene.layoutRevision))return scene;
 if(!point(scene.spawn)||!Number.isFinite(scene.width)||!Number.isFinite(scene.height)||scene.width<=0||scene.height<=0||!Array.isArray(scene.solids)||!Array.isArray(scene.items))return scene;
 const cols=Math.ceil(scene.width/STEP),rows=Math.ceil(scene.height/STEP),blocked=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows),at=n=>({x:n%cols*STEP+STEP/2,y:Math.floor(n/cols)*STEP+STEP/2});
 const clear=p=>point(p)&&p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40&&!scene.solids.some(b=>p.x>=b.x-RADIUS&&p.x<=b.x+b.w+RADIUS&&p.y>=b.y-RADIUS&&p.y<=b.y+b.h+RADIUS);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x*STEP+3<40||x*STEP+3>scene.width-40||y*STEP+3<112||y*STEP+3>scene.height-40)blocked[y*cols+x]=1;
 for(const b of scene.solids){const x0=Math.max(0,Math.ceil((b.x-RADIUS-3)/STEP)),x1=Math.min(cols-1,Math.floor((b.x+b.w+RADIUS-3)/STEP)),y0=Math.max(0,Math.ceil((b.y-RADIUS-3)/STEP)),y1=Math.min(rows-1,Math.floor((b.y+b.h+RADIUS-3)/STEP));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;}
 let tail=0;const sx=Math.floor(scene.spawn.x/STEP),sy=Math.floor(scene.spawn.y/STEP);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy,n=y*cols+x;if(x>=0&&x<cols&&y>=0&&y<rows&&!blocked[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
 for(let head=0;head<tail;head++){const n=queue[head],x=n%cols,y=Math.floor(n/cols);for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=Y*cols+X;if(X>=0&&X<cols&&Y>=0&&Y<rows&&!blocked[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}}}
 const reaches=p=>{
  if(!clear(p))return false;const x=Math.floor(p.x/STEP),y=Math.floor(p.y/STEP);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy,n=Y*cols+X;if(X>=0&&X<cols&&Y>=0&&Y<rows&&seen[n]&&Math.hypot(at(n).x-p.x,at(n).y-p.y)<=10)return true;}return false;
 };
 const nearest=(area,preferred)=>{
  if(point(preferred)&&inside(area,preferred)&&reaches(preferred))return {...preferred};let result=null,distance=Infinity;
  for(let index=0;index<tail;index++){const p=at(queue[index]);if(!inside(area,p))continue;const d=(p.x-preferred.x)**2+(p.y-preferred.y)**2;if(d<distance){distance=d;result=p;}}return result;
 };
 scene.rooms=(scene.rooms||[]).map(room=>({...room,point:nearest(room,point(room.point)?room.point:{x:room.x+room.w/2,y:room.y+room.h*.65})}));
 if(scene.familyFurniture){
  const family=scene.familyFurniture,nook=family.bedroomNook;scene.familyFurniture={...family,diningSeats:scene.items.filter(item=>item.seatingTarget===family.diningTable).map(item=>item.id),livingSeats:scene.items.filter(item=>item.seatingTarget===family.livingTable).map(item=>item.id),...(nook?{bedroomNook:{...nook,seat:scene.items.find(item=>item.seatingTarget===nook.table)?.id||null}}:{})};
 }
 const approaches=[];
 for(const item of scene.items){
  delete item.approach;if(!item.solid||!item.collisionBoxes?.length)continue;
  const boxes=item.collisionBoxes,x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h)),cx=(x+right)/2,cy=(y+bottom)/2,turn=((Math.round((item.rotation||0)/90)%4)+4)%4,options=[];
  for(const gap of [14,22,32]){const sides=[{x:cx,y:bottom+gap},{x:x-gap,y:cy},{x:cx,y:y-gap},{x:right+gap,y:cy}];options.push(sides[turn],...sides);}
  const p=options.find(reaches);if(p){item.approach={...p};approaches.push({role:item.furnitureRole||role(item),asset:item.asset,roomId:item.roomId,...p});}
 }
 if(scene.homePlan)scene.homePlan={...scene.homePlan,rooms:scene.rooms,fixtureApproaches:approaches};
 if(scene.showroom){
  const plan=scene.showroom.apartment,dining=scene.items.find(item=>item.id===scene.familyFurniture?.diningTable),area=scene.rooms.find(r=>r.functionalRole==='dining')||{x:40,y:112,w:scene.width-80,h:scene.height-152},preferred=dining?.approach||area.point||plan.browse||scene.spawn,browse=nearest(area,preferred)||nearest({x:40,y:112,w:scene.width-80,h:scene.height-152},preferred)||{...scene.spawn};
  const route=[{...scene.spawn},browse];scene.showroom={...scene.showroom,apartment:{...plan,spawn:{...scene.spawn},areas:scene.rooms,items:scene.items,browse,visitRoute:route,exitRoute:[...route].reverse()}};
  const navigation=getShowroomNavigation(scene);if(navigation)Object.assign(scene.showroom.apartment,{visitRoute:navigation.visitRoute,exitRoute:navigation.exitRoute});
 }
 return scene;
}
