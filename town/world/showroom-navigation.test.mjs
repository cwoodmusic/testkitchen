import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {getShowroomNavigation} from './showroom-navigation.mjs';
import {getInterior,configureUrbanInteriors,residents} from './urban-interiors.mjs';
import {SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE} from './showroom-layout.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {furnitureFacingBoxes} from './furniture-facing.mjs';
import {interiorActorScale} from './interior-scale.mjs';
import {getConcertHall} from './concert-hall.mjs';

const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));
configureUrbanInteriors(catalog);
const close=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-8;
function clear(scene,p){return p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40&&!scene.solids.some(r=>p.x>=r.x-6&&p.x<=r.x+r.w+6&&p.y>=r.y-6&&p.y<=r.y+r.h+6);}
function clearRoute(scene,route){
 for(let i=0;i<route.length;i++){
  const a=route[Math.max(0,i-1)],b=route[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));
  for(let j=0;j<=steps;j++)if(!clear(scene,{x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps}))return false;
 }
 return true;
}
function fixture({spawn={x:60,y:180},browse={x:300,y:180},solids=[]}={}){
 const visitRoute=[{...spawn},{...browse}];return {kind:'showroom',width:400,height:300,spawn,solids,items:[],layoutRevision:1,showroom:{apartment:{browse,visitRoute,exitRoute:[...visitRoute].reverse()}}};
}
function historicalScene(source){
 if(!source.roomLayoutBaseItems)return source;
 const previous=new Set(source.items.flatMap(item=>item.collisionBoxes||[])),items=source.roomLayoutBaseItems.map(item=>({...item,collisionBoxes:item.solid?furnitureFacingBoxes(catalog.get(item.asset),item):[]}));
 return {...source,roomLayoutBaseItems:undefined,items,solids:[...source.solids.filter(box=>!previous.has(box)),...items.flatMap(item=>item.collisionBoxes)]};
}
function victorianTable({small=false}={}){
 const base=historicalScene(getInterior({kind:'showroom',showroomId:'victorian-parlor'})),previous=base.items.find(item=>item.asset==='family-showroom-victorian-parlor-coffee-table');
 const asset=catalog.get(small?'collection-showroom-victorian-parlor-coffee-table':previous.asset),item=small?{id:'navigation-small-coffee',asset:asset.id,w:asset.w*.75,h:asset.h*.75,x:912,y:388,rotation:90,solid:true}:{...previous,x:912,y:348,rotation:90};
 const boxes=furnitureFacingBoxes(asset,item);Object.defineProperty(item,'collisionBoxes',{value:boxes});const removed=new Set(small?[]:previous.collisionBoxes);
 const scene={...base,layoutRevision:1,items:small?[...base.items,item]:base.items.map(old=>old===previous?item:old),solids:[...base.solids.filter(box=>!removed.has(box)),...boxes]};
 return {base,scene,boxes};
}
function venueWith(edited){
 const url=new URL('./resident-venue.mjs',import.meta.url),source=readFileSync(url,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\n({venueVisitPose,venueVisitDuration});';
 return vm.runInNewContext(source,{getConcertHall,residents,SHOWROOMS,STORE_TRAFFIC,STORE_VERTICAL_CORE,interiorActorScale,getShowroomNavigation,getInterior:request=>request.kind==='showroom'&&request.showroomId===edited.showroomId?edited:getInterior(request)},{filename:url.pathname});
}

test('expanded showroom tours start at the active entrance without mutating any of the31 furnished models',()=>{
 const models=[...residents.map(resident=>getInterior({kind:'apartment',resident:resident.id})),getInterior({kind:'apartment',resident:'player'}),...SHOWROOMS.map(room=>getInterior({kind:'showroom',showroomId:room.id}))],before=JSON.stringify(models);
 assert.equal(models.length,31);
 for(const scene of models){
  const navigation=getShowroomNavigation(scene);
  if(scene.kind==='showroom'){
   assert(scene.wideRoomExpansion);assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(clearRoute(scene,navigation.exitRoute));assert(close(navigation.visitRoute[0],scene.spawn));assert(Math.hypot(navigation.visitRoute.at(-1).x-scene.showroom.apartment.browse.x,navigation.visitRoute.at(-1).y-scene.showroom.apartment.browse.y)<=14);assert.deepEqual(navigation.exitRoute,[...navigation.visitRoute].reverse());
   assert.equal(getShowroomNavigation(scene),navigation);
  }
  else assert.equal(navigation,null);
 }
 assert.equal(JSON.stringify(models),before);
});

test('a promoted default replans even without an editor revision instead of crossing its stale tour',()=>{
 const scene=fixture({solids:[{x:160,y:140,w:40,h:80}]});delete scene.layoutRevision;scene.roomLayoutBaseItems=[];
 const navigation=getShowroomNavigation(scene);assert(navigation);assert(!clearRoute(scene,scene.showroom.apartment.visitRoute));assert(clearRoute(scene,navigation.visitRoute));assert(close(navigation.visitRoute[0],scene.spawn));assert(close(navigation.visitRoute.at(-1),scene.showroom.apartment.browse));
});

test('the approved Victorian default has a clear visitor route around its newly arranged furniture',()=>{
 const scene=getInterior({kind:'showroom',showroomId:'victorian-parlor'}),before=JSON.stringify(scene),navigation=getShowroomNavigation(scene);
 assert.equal(scene.layoutRevision,undefined);assert.equal(scene.roomLayoutBaseItems.length,38);assert.equal(scene.items.length,34);
 assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(clearRoute(scene,navigation.exitRoute));assert(close(navigation.visitRoute[0],scene.spawn));assert(Math.hypot(navigation.visitRoute.at(-1).x-scene.showroom.apartment.browse.x,navigation.visitRoute.at(-1).y-scene.showroom.apartment.browse.y)<=14);assert.deepEqual(navigation.exitRoute,[...navigation.visitRoute].reverse());assert.equal(JSON.stringify(scene),before);
});

test('a clear edited tour is reused and an obstructed one replans around current furniture',()=>{
 const open=fixture(),before=JSON.stringify(open),original=open.showroom.apartment.visitRoute;
 assert.equal(getShowroomNavigation(open).visitRoute,original);assert.equal(JSON.stringify(open),before);
 const scene=fixture({solids:[{x:160,y:140,w:40,h:80}]}),snapshot=JSON.stringify(scene),navigation=getShowroomNavigation(scene);
 assert(!clearRoute(scene,scene.showroom.apartment.visitRoute));assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(clearRoute(scene,navigation.exitRoute));
 assert(close(navigation.visitRoute[0],scene.spawn));assert(close(navigation.visitRoute.at(-1),scene.showroom.apartment.browse));assert.deepEqual(navigation.exitRoute,[...navigation.visitRoute].reverse());
 assert(navigation.visitRoute.length>2);assert.equal(getShowroomNavigation(scene),navigation,'One immutable room model shares one cached plan');assert.equal(JSON.stringify(scene),snapshot);
});

test('the moved Victorian family table blocks the old tour but NPCs can take a real detour',()=>{
 const {base,scene,boxes}=victorianTable(),before=JSON.stringify([base,scene]),navigation=getShowroomNavigation(scene);
 assert.deepEqual(boxes,[{x:915,y:276.75,w:52.5,h:142.5}]);assert(!clearRoute(scene,base.showroom.apartment.visitRoute),'The original line really crosses the new table');
 assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(close(navigation.visitRoute[0],scene.spawn));assert(close(navigation.visitRoute.at(-1),base.showroom.apartment.browse));
 assert.deepEqual(navigation.exitRoute,[...navigation.visitRoute].reverse());assert.equal(JSON.stringify([base,scene]),before);
});

test('an occupied Victorian browse point uses the closest reachable spot within fourteen pixels',()=>{
 const {scene}=victorianTable({small:true}),goal=scene.showroom.apartment.browse,navigation=getShowroomNavigation(scene);
 assert(!clear(scene,goal));assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(Math.hypot(navigation.visitRoute.at(-1).x-goal.x,navigation.visitRoute.at(-1).y-goal.y)<=14);
 assert.deepEqual(navigation.visitRoute.at(-1),{x:908,y:348});assert.deepEqual(navigation.exitRoute,[...navigation.visitRoute].reverse());
});

test('grid-start connectors cannot cut furniture corners and routes have no redundant collinear legs',()=>{
 const scene=fixture({spawn:{x:152,y:160},browse:{x:300,y:148},solids:[{x:160,y:160,w:10,h:10}]}),navigation=getShowroomNavigation(scene);
 assert(navigation);assert(clearRoute(scene,navigation.visitRoute));assert(close(navigation.visitRoute[0],scene.spawn));
 for(let i=2;i<navigation.visitRoute.length;i++){const [a,b,c]=navigation.visitRoute.slice(i-2,i+1);assert(Math.abs((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x))>1e-8);}
});

test('unreachable or obstructed destinations never fall back to a blocked authored route',()=>{
 for(const scene of [fixture({solids:[{x:170,y:106,w:20,h:166}]}),fixture({solids:[{x:280,y:160,w:40,h:40}]}),fixture({solids:[{x:55,y:175,w:10,h:10}]})]){
  const before=JSON.stringify(scene);assert.equal(getShowroomNavigation(scene),null);assert.equal(getShowroomNavigation(scene),null);assert.equal(JSON.stringify(scene),before);
 }
});

test('shop visitors use the resolved edited interior and safely return through the same lobby door',()=>{
 const {scene}=victorianTable(),before=JSON.stringify(scene),venue=venueWith(scene),duration=venue.venueVisitDuration('bach','shop',{slot:0,stay:2});let inside=false,browsed=false,returned=false;
 for(let time=0;time<=duration;time+=.02){
  const pose=venue.venueVisitPose('bach','shop',time,{slot:0,stay:2});assert.equal(pose.id,'bach');
  if(pose.scene.kind==='showroom'){inside=true;assert(clear(scene,pose));if(pose.purpose.startsWith('Browsing')){browsed=true;assert(close(pose,scene.showroom.apartment.browse));}}
  else if(inside&&pose.scene.kind==='shop')returned=true;
 }
 assert(inside&&browsed&&returned);assert(venue.venueVisitPose('bach','shop',duration+1,{slot:0,stay:2}).done);assert.equal(JSON.stringify(scene),before);
 const blocked={...scene,layoutRevision:2,solids:[...scene.solids,{x:scene.spawn.x-10,y:scene.spawn.y-10,w:20,h:20}]},waiting=venueWith(blocked),end=waiting.venueVisitDuration('bach','shop',{slot:0,stay:2});
 for(let time=0;time<=end;time+=.1)assert.notEqual(waiting.venueVisitPose('bach','shop',time,{slot:0,stay:2}).scene.kind,'showroom','An invalid imported obstruction must not teleport a visitor inside');
});
