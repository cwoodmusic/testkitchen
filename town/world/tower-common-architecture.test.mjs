import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTowerCommonArchitecture} from './tower-common-architecture.mjs';
import {getInterior,residents} from './urban-interiors.mjs';
import {getElevatorVisualGeometry} from './interior-portal-art.mjs';
import {createAutomaticDoors} from './automatic-doors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';

const descriptors=[{kind:'lobby'},...Array.from({length:14},(_,i)=>({kind:'hall',floor:i+2})),{kind:'shop',floor:1},{kind:'shop',floor:2}];
const models=descriptors.map(s=>applyTowerCommonArchitecture(getInterior(s)));
const blocked=(m,x,y,pad=16)=>m.solids.some(r=>x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad);
function reachable(m){
 const step=8,cols=Math.ceil(m.width/step),rows=Math.ceil(m.height/step),seen=new Uint8Array(cols*rows),queue=[],toIndex=(x,y)=>Math.floor(y/step)*cols+Math.floor(x/step);
 const start=toIndex(m.spawn.x,m.spawn.y);queue.push(start);seen[start]=1;
 for(let head=0;head<queue.length;head++){
  const n=queue[head],x=n%cols,y=Math.floor(n/cols);
  for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
   if(X<0||X>=cols||Y<0||Y>=rows)continue;
   const next=Y*cols+X;if(seen[next]||blocked(m,X*step+4,Y*step+4))continue;
   seen[next]=1;queue.push(next);
  }
 }
 return(x,y)=>Boolean(seen[toIndex(x,y)]);
}

test('all tower and store lift glass belongs to a solid footprint while its front remains reachable',()=>{
 assert.equal(models.length,17);
 for(const m of models){
  const a=m.towerArchitecture,g=getElevatorVisualGeometry(m.elevator),r=a.liftFootprint;
  assert.deepEqual(r,{x:g.bounds.x,y:106,w:g.bounds.w,h:g.floorY-106});
  assert(m.solids.includes(r),'The metadata and actual footprint share the same rectangle');
  for(let y=g.opening.y+1;y<g.floorY;y+=5)for(let x=g.opening.x+1;x<g.opening.x+g.opening.w;x+=5)assert(blocked(m,x,y,0),`${m.id}: walkable lift glass at${x},${y}`);
  const x=m.elevator.x+m.elevator.w/2,y=g.floorY+20;
  assert(!blocked(m,x,y),`${m.id}: the lift must have a clear front approach`);
  assert(reachable(m)(x,y),`${m.id}: the lift approach must connect to the scene spawn`);
  assert.equal(m.solids[0].h,106,'Keep the original shell collider');
  const zone=m.zones.find(z=>z.id==='lift'||z.action==='store-elevator');
  assert(zone,'Every public lift retains its existing interaction');
  assert.equal(zone.y,g.floorY+12);assert.equal(zone.h,112);
  assert.equal(zone.action,m.kind==='shop'?'store-elevator':'elevator');
  assert(reachable(m)(zone.x+zone.w/2,zone.y+zone.h/2),`${m.id}: lift interaction belongs on the reachable landing`);
 }
});

test('every residential floor retains clear door channels and manual player locks',()=>{
 for(const m of models.filter(m=>m.kind==='hall')){
  assert.equal(m.towerArchitecture.northWallDepth,302);
  const before=JSON.stringify(m.doors);
  for(const door of m.doors){
   const channel=m.towerArchitecture.doorwayChannels.find(c=>c.id===(door.id||door.number)),floorY=door.threshold?.y??door.floorY??door.y+door.h,x=door.threshold?.x??door.x;
   assert.deepEqual(channel,{x:x-41,y:106,w:82,h:floorY-106,id:door.id||door.number});
   assert(!blocked(m,x,floorY-24),'An owner NPC can enter the actual aperture');
   assert(blocked(m,x-70,floorY-40),'Backing beside the opening must prevent walking around the leaf');
   const owner={id:'owner',x,y:floorY+30},guest={id:'guest',x,y:floorY+35};
   const doors=createAutomaticDoors([door],{canOpen:(_door,actor,isPlayer)=>!isPlayer&&actor.id==='owner'});
   doors.prime(guest,[owner]);assert.equal(doors.openness(door),1);
   assert.equal(doors.blocked(x,floorY,16,guest,true),true,'An animated owner door still requires E for the player');
   assert.equal(doors.blocked(x,floorY,16,owner,false),false);
  }
  assert.equal(JSON.stringify(m.doors),before);
 }
});

test('common facade recesses and exterior rails retain routes onto every stair flight',()=>{
 for(const m of models.filter(m=>m.kind!=='shop')){
  const canReach=reachable(m),a=m.towerArchitecture;
  for(const st of m.stairs){
   const x=st.x+st.w/2;
   for(const y of[st.y+24,st.y+st.h+20]){
    assert(!blocked(m,x,y),`${m.id}: the stair flight is blocked`);
    assert(canReach(x,y),`${m.id}: the stair flight is disconnected`);
   }
   if(st.y+st.h<a.northWallDepth)assert(a.facadeRecesses.some(r=>r.kind==='stairs'&&r.x===st.x&&r.y===st.y+st.h&&r.y+r.h===a.northWallDepth));
  }
  const lift=getElevatorVisualGeometry(m.elevator);
  if(lift.floorY<a.northWallDepth)assert(a.facadeRecesses.some(r=>r.kind==='lift'&&r.y===lift.floorY&&r.y+r.h===a.northWallDepth));
 }
});

test('the lobby directory mounts fully on the wall with a separate reachable E interaction',()=>{
 const m=models[0],d=m.directory,a=m.towerArchitecture,lift=getElevatorVisualGeometry(m.elevator),zone=m.zones.find(z=>z.id==='directory');
 assert.equal(a.northWallDepth,322);assert.deepEqual(d,{x:818,y:40,w:180,h:270});
 assert(lift.bounds.x-(d.x+d.w+10)>=14,'The board frame does not compete with the lift frame');
 assert(d.y>=0&&d.y+d.h<=a.northWallDepth-12);
 assert.equal(zone.action,'elevator');assert.equal(zone.x,d.x);assert.equal(zone.w,d.w);assert.equal(zone.y,a.northWallDepth+24);
 const x=zone.x+zone.w/2;assert(!blocked(m,x,zone.y));assert(reachable(m)(x,zone.y));
});

test('architecture is idempotent and never changes the 31 private room models',()=>{
 for(const m of models){const before=JSON.stringify(m);assert.strictEqual(applyTowerCommonArchitecture(m),m);assert.equal(JSON.stringify(m),before);}
 const privateScenes=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(s=>({kind:'showroom',showroomId:s.id}))];
 assert.equal(privateScenes.length,31);
 for(const scene of privateScenes){const m=getInterior(scene),before=JSON.stringify(m);assert.strictEqual(applyTowerCommonArchitecture(m),m);assert.equal(JSON.stringify(m),before);assert(!m.towerArchitecture);}
});
