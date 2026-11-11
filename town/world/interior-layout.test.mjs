import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {getInterior,configureUrbanInteriors,residents,apartmentDecorBounds,apartmentWallDecorBounds} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';
import {furnitureFacingBoxes,furnitureFacingBounds} from './furniture-facing.mjs';

// Real authored view dimensions/anchors, without fetching or rasterizing art.
// A rotated PNG's rectangle is not a valid stand-in for a cardinal view.
const json=name=>JSON.parse(readFileSync(new URL('../assets/apartment-collections/'+name,import.meta.url)));
const manifest=json('manifest.json'),thumbnails=new Map(manifest.collections.map(c=>[c.owner,{width:1,height:1}]));
const runtime=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest:json('directions-manifest.json'),thumbnails,loadImage(){throw Error('Layout checks must not load art');},createCanvas(){throw Error('Layout checks must not rasterize art');}});
const catalog=new Map(APARTMENT_COLLECTION_ASSETS.map(a=>[a.id,{...a,getFacingView:direction=>runtime.view(a.id,direction)}]));
configureUrbanInteriors(catalog);
const requests=[...residents.map(r=>({kind:'apartment',resident:r.id,floor:r.floor})),{kind:'apartment',resident:'player',floor:15},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id,floor:r.storeFloor}))];
const models=requests.map(getInterior),RADIUS=6,findings={};
const slot=item=>item.slot||item.collectionSlot||catalog.get(item.asset)?.slot;
const itemFor=(m,role)=>m.items.find(i=>slot(i)===role);
const owner=m=>m.resident||'showroom-'+m.showroomId;
const roleRoom=(m,item,role)=>m.rooms.find(r=>item.roomId&&r.id===item.roomId)||m.rooms.find(r=>r.functionalRole===role);
const overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-6&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-6;
const contains=(r,p)=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h;
const blocked=(m,p)=>p.x<28+RADIUS||p.y<106+RADIUS||p.x>m.width-28-RADIUS||p.y>m.height-28-RADIUS||m.solids.some(b=>p.x>=b.x-RADIUS&&p.x<=b.x+b.w+RADIUS&&p.y>=b.y-RADIUS&&p.y<=b.y+b.h+RADIUS);
function footprint(item){
 const boxes=furnitureFacingBoxes(catalog.get(item.asset),item),x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 const right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
const round=p=>Object.fromEntries(Object.entries(p).map(([key,value])=>[key,typeof value==='number'?Math.round(value*100)/100:value]));
function navigation(m){
 const step=6,cols=Math.ceil(m.width/step),rows=Math.ceil(m.height/step),state=new Uint8Array(cols*rows),seen=new Uint8Array(cols*rows),queue=new Int32Array(cols*rows);
 const at=index=>({x:index%cols*step+step/2,y:Math.floor(index/cols)*step+step/2});
 const clear=index=>{if(!state[index])state[index]=blocked(m,at(index))?2:1;return state[index]===1;};
 const sx=Math.floor(m.spawn.x/step),sy=Math.floor(m.spawn.y/step);let end=0;
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy,index=y*cols+x;if(x>=0&&x<cols&&y>=0&&y<rows&&clear(index)&&!seen[index]){seen[index]=1;queue[end++]=index;}}
 for(let head=0;head<end;head++){
  const index=queue[head],x=index%cols,y=Math.floor(index/cols);
  for(const [X,Y]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(X<0||X>=cols||Y<0||Y>=rows)continue;const next=Y*cols+X;if(!seen[next]&&clear(next)){seen[next]=1;queue[end++]=next;}}
 }
 return p=>{
  if(blocked(m,p))return false;const x=Math.floor(p.x/step),y=Math.floor(p.y/step);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const X=x+dx,Y=y+dy;if(X>=0&&X<cols&&Y>=0&&Y<rows&&seen[Y*cols+X]&&Math.hypot(at(Y*cols+X).x-p.x,at(Y*cols+X).y-p.y)<9)return true;}
  return false;
 };
}
const reachable=new Map(models.map(m=>[m,navigation(m)]));
function check(name,failures){findings[name]=failures;test(name,()=>assert.equal(failures.length,0,failures.slice(0,24).map(f=>JSON.stringify(f)).join('\n')));}

const presence=[];
for(const m of models)for(const role of ['bed','sofa','dining-table','dining-chair','rug'])if(m.items.filter(i=>slot(i)===role).length!==1)presence.push({owner:owner(m),missingOrRepeated:role});
check('all31 actual homes have one bed, living group, dining table/chair and native rug',presence);

const seats=[];
for(const m of models)for(const [seatRole,targetRole]of [['dining-chair','dining-table'],['desk-chair','desk'],['reading-chair','coffee-table']]){
 const seat=itemFor(m,seatRole),target=itemFor(m,targetRole);if(!seat||!target)continue;
 if(seatRole==='reading-chair'&&seat.roomId&&target.roomId&&seat.roomId!==target.roomId)continue;
 const s=footprint(seat),t=footprint(target),angle=(seat.rotation||0)*Math.PI/180,front={x:-Math.sin(angle),y:Math.cos(angle)},dx=t.cx-s.cx,dy=t.cy-s.cy;
 const dot=front.x*dx+front.y*dy,cross=Math.abs(front.x*dy-front.y*dx);
 if((seat.rotation||0)%90!==0||dot<=0||cross>2)seats.push({owner:owner(m),seat:seatRole,rotation:seat.rotation||0,seatCenter:round({x:s.cx,y:s.cy}),target:round({x:t.cx,y:t.cy}),crossAxisError:Math.round(cross*100)/100});
}
check('actual dining, work and conversation seats face their own table along a cardinal axis',seats);

const backs=[];
for(const m of models)for(const [role,area]of [['bed','bedroom'],['sink','kitchen'],['stove','kitchen'],['counter','kitchen'],['fridge','kitchen'],['pantry','kitchen'],['vanity','bathroom']]){
 const item=itemFor(m,role);if(!item)continue;const room=roleRoom(m,item,area);if(!room){backs.push({owner:owner(m),role,error:'Missing functional room'});continue;}
 const b=footprint(item),turn=((item.rotation||0)%360+360)%360;
 const gap=turn===0?b.y-room.y:turn===90?room.x+room.w-b.x-b.w:turn===180?room.y+room.h-b.y-b.h:b.x-room.x;
 if(gap<4-1e-6||gap>8+1e-6)backs.push({owner:owner(m),role,backGap:Math.round(gap*100)/100,physicalBase:round(b),room:{x:room.x,y:room.y,w:room.w,h:room.h}});
}
check('beds and kitchen/bath cabinets have a real backing edge within4–8px of their functional wall',backs);

const windows=[];
for(const m of models)for(const item of m.items.filter(i=>['bed','wardrobe','fridge','pantry'].includes(slot(i)))){
 const image=furnitureFacingBounds(catalog.get(item.asset),item);
 for(const w of m.windows||[]){const glass={x:w.x-w.w/2,y:w.y+6,w:w.w,h:62};if(overlap(image,glass))windows.push({owner:owner(m),role:slot(item),picturedBounds:round(image),window:glass});}
}
check('tall furniture and bedheads leave actual window glazing visible',windows);

const approaches=[];
for(const m of models)for(const item of m.items.filter(i=>['sink','stove','counter','fridge','pantry','vanity','toilet','bath-fixture','linen-storage','wardrobe','desk'].includes(slot(i)))){
 const b=footprint(item),turn=(((item.rotation||0)/90)%4+4)%4,options=[];
 for(const gap of [12,20,28])for(const offset of [-.25,0,.25]){
  const sides=[{x:b.cx+b.w*offset,y:b.y+b.h+gap},{x:b.x-gap,y:b.cy+b.h*offset},{x:b.cx+b.w*offset,y:b.y-gap},{x:b.x+b.w+gap,y:b.cy+b.h*offset}];
  options.push(sides[turn]);if(catalog.get(item.asset).purpose==='bathtub')options.push(...sides);
 }
 if(!options.some(p=>reachable.get(m)(p)))approaches.push({owner:owner(m),role:slot(item),physicalBase:round(b),frontCandidates:options.slice(0,3).map(round)});
}
check('every kitchen, storage, bathroom and work fixture has a reachable front approach for the actual6px player',approaches);

const doors=[];
for(const m of models)for(const door of m.privacyDoors||[]){
 if(door.length!==36)doors.push({owner:owner(m),door:door.id,error:'Opening changed',length:door.length});
 for(const along of [10,18,26])for(const normal of [-28,-14,0,14,28]){
  const p=door.axis==='vertical'?{x:door.x+normal,y:door.y+along}:{x:door.x+along,y:door.y+normal};
  if(!reachable.get(m)(p)){doors.push({owner:owner(m),door:door.id,blockedLanding:round(p)});break;}
 }
}
check('all36px privacy openings retain reachable landings on both sides',doors);

const routes=[];
for(const m of models){
 const paths=[];
 if(m.resident&&m.resident!=='player')paths.push([{x:m.width/2,y:m.floor>=7?750:650},{x:m.width/2,y:975}]);
 if(m.kind==='showroom'){const room=SHOWROOMS.find(s=>s.id===m.showroomId);paths.push(room.apartment.visitRoute,room.apartment.exitRoute);}
 for(const points of paths)for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));
  for(let n=0;n<=count;n++){const p={x:a.x+(b.x-a.x)*n/count,y:a.y+(b.y-a.y)*n/count};if(blocked(m,p)){routes.push({owner:owner(m),blockedAuthoredRoute:round(p)});break;}}
 }
}
check('fixed resident departures and showroom shopping routes remain physically clear',routes);

const player=models.find(m=>m.resident==='player'),savedFloor=apartmentDecorBounds(player),savedWall=apartmentWallDecorBounds(player),saved=[];
assert.deepEqual(savedFloor,[{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}]);
assert.deepEqual(savedWall,[{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}]);
for(const item of player.items){
 const a=catalog.get(item.asset);
 if(item.wallMounted){const image=furnitureFacingBounds(a,item);for(const region of savedWall)if(overlap(image,region))saved.push({role:slot(item),error:'Built-in covers saved wall area',image:round(image),region});}
 else for(const base of furnitureFacingBoxes(a,item))for(const region of savedFloor)if(overlap(base,region))saved.push({role:slot(item),error:'Built-in occupies saved floor area',base:round(base),region});
}
check('the player keeps all original saved furnishing regions free of new built-ins',saved);

after(()=>{if(process.env.CODA_LAYOUT_REPORT)writeFileSync(process.env.CODA_LAYOUT_REPORT,JSON.stringify({models:models.length,radius:RADIUS,failures:findings},null,2)+'\n');});
