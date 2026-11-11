import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeInteriorDoorways,PRIVATE_DOOR_CLEAR_WIDTH,PUBLIC_DOOR_CLEAR_WIDTH} from './interior-doorways.mjs';
import {createAutomaticDoors} from './automatic-doors.mjs';
import {getPrivacyDoorVisualGeometry,getDoorVisualGeometry} from './interior-portal-art.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';

const hit=(p,r,pad)=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad;
const centre=d=>d.axis==='vertical'?{x:d.x,y:d.y+d.length/2}:{x:d.x+d.length/2,y:d.y};
function fixture(axis='vertical'){
 const vertical=axis==='vertical',walls=vertical?[{x:200,y:0,w:18,h:100},{x:200,y:232,w:18,h:300}]:[{x:0,y:200,w:100,h:18},{x:232,y:200,w:300,h:18}],door={id:'bedroom',roomId:'bedroom',axis,x:vertical?209:100,y:vertical?100:209,length:132};
 return {kind:'apartment',width:900,height:800,walls,solids:walls.map(r=>({...r})),privacyDoors:[door],rooms:[{id:'bedroom',x:28,y:28,w:172,h:504}],items:[],zones:[]};
}

test('private apertures narrow around the same centre and seal old gaps with seamless matching walls/collision',()=>{
 for(const axis of ['vertical','horizontal']){
  const s=fixture(axis),d=s.privacyDoors[0],before=centre(d),room=JSON.stringify(s.rooms),counts={walls:s.walls.length,solids:s.solids.length};normalizeInteriorDoorways(s);
  assert.equal(d.length,36);assert.equal(d.clearOpening,true);assert.deepEqual(centre(d),before);assert.equal(JSON.stringify(s.rooms),room);assert.equal(s.width,900);assert.equal(s.height,800);assert.deepEqual({walls:s.walls.length,solids:s.solids.length},counts,'Extend authored wall segments rather than introducing visible endcap seams');
  for(const wall of s.walls)assert(s.solids.some(r=>r.x===wall.x&&r.y===wall.y&&r.w===wall.w&&r.h===wall.h),'Rendered wall and actual collider coincide');
  const retired=axis==='vertical'?{x:209,y:110}:{x:110,y:209};assert(s.solids.some(r=>hit(retired,r,6)));assert(!s.solids.some(r=>hit(before,r,6)));
  const after=JSON.stringify(s);normalizeInteriorDoorways(s);assert.equal(JSON.stringify(s),after,'Normalization is idempotent');
 }
});

test('a real six-radius walker crosses each 36-wide leaf both ways while retired aperture portions stay blocked',()=>{
 for(const axis of ['vertical','horizontal'])for(const sign of [-1,1]){
  const s=normalizeInteriorDoorways(fixture(axis)),d=s.privacyDoors[0],c=centre(d),normal=axis==='vertical'?{x:1,y:0}:{x:0,y:1},p={x:c.x+normal.x*sign*100,y:c.y+normal.y*sign*100},doors=createAutomaticDoors([d]);doors.prime(p);let crossed=false;
  for(let i=0;i<80;i++){
   doors.update(.02,p,[]);const next={x:p.x-normal.x*sign*168.75*.02,y:p.y-normal.y*sign*168.75*.02};
   if(!s.solids.some(r=>hit(next,r,6))&&!doors.blocked(next.x,next.y,6))Object.assign(p,next);
   if(((p.x-c.x)*normal.x+(p.y-c.y)*normal.y)*sign< -40){crossed=true;break;}
  }
  assert(crossed);assert(doors.openness(d)>.7);const tangent=axis==='vertical'?{x:c.x,y:c.y+15}:{x:c.x+15,y:c.y};assert(s.solids.some(r=>hit(tangent,r,6)),'Foot radius cannot leak through the new jamb');
 }
});

test('clear-opening rendering uses the complete actual passage instead of stealing width with old jamb insets',()=>{
 for(const axis of ['vertical','horizontal'])for(const hinge of ['start','end']){
  const d={id:'private',axis,x:200,y:300,length:PRIVATE_DOOR_CLEAR_WIDTH,clearOpening:true,hinge};
  for(const openness of [0,.5,1]){const g=getPrivacyDoorVisualGeometry(d,openness);assert.equal(g.span,36);assert.equal(Math.hypot(g.gapEnd.x-g.gapStart.x,g.gapEnd.y-g.gapStart.y),36);assert(Math.abs(Math.hypot(g.tip.x-g.hinge.x,g.tip.y-g.hinge.y)-36)<1e-8);}
 }
 const shop={kind:'shop',walls:[],solids:[],doors:[{id:'suite',facing:'right',x:1216,y:129,w:156,h:190,threshold:{x:1216,y:224},triggerHalfWidth:64}],zones:[{id:'suite',action:'showroom',x:1220,y:160,w:48,h:128,triggerHalfWidth:64}]};normalizeInteriorDoorways(shop);assert.equal(shop.doors[0].triggerHalfWidth,41);assert.equal(getDoorVisualGeometry(shop.doors[0],1).span,82);assert.equal(shop.zones[0].triggerHalfWidth,41);assert.deepEqual(shop.doors[0].threshold,{x:1216,y:224});
});

configureUrbanInteriors(new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(a=>[a.id,a])));
const privateScenes=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(s=>({kind:'showroom',showroomId:s.id}))];
test('all 31 real homes have matching 36-wide passages and six-radius clear doorway crossings',()=>{
 let count=0;
 for(const scene of privateScenes){
  const m=getInterior(scene);assert.equal(m.privacyDoors.length,2);
  for(const d of m.privacyDoors){
   count++;assert.equal(d.length,36,scene.resident||scene.showroomId);assert.equal(getPrivacyDoorVisualGeometry(d,1).span,36);const c=centre(d),n=d.axis==='vertical'?{x:1,y:0}:{x:0,y:1};
   for(let distance=-30;distance<=30;distance+=2){const p={x:c.x+n.x*distance,y:c.y+n.y*distance};assert(!m.solids.some(r=>hit(p,r,6)),`${m.id}/${d.id}: blocked passage at ${distance}`);}
  }
 }
 assert.equal(count,62);
});

test('manual store entrances and returns retain their exact authored NPC threshold/route centres',()=>{
 const publicScenes=[getInterior({kind:'shop',floor:1}),getInterior({kind:'shop',floor:2})];
 for(const display of SHOWROOMS){
  const lobby=publicScenes[display.storeFloor-1],door=lobby.doors.find(d=>d.showroomId===display.id),inside=getInterior({kind:'showroom',showroomId:display.id});
  assert.equal(getDoorVisualGeometry(door,0).span,PUBLIC_DOOR_CLEAR_WIDTH);assert.deepEqual(door.threshold,display.threshold);assert.equal(inside.portalExit.triggerHalfWidth,18);assert.deepEqual(inside.portalExit.threshold,display.apartment.portalExit.threshold);
  for(const route of [display.apartment.visitRoute,display.apartment.exitRoute])for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3);
   for(let j=0;j<=steps;j++){const p={x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps};assert(!inside.solids.some(r=>hit(p,r,6)),`${inside.id}: owner route blocked by door normalization`);}
  }
 }
});
