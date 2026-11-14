import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {getApartmentNavigation} from './apartment-navigation.mjs';
import {residents} from './resident-profiles.mjs';
import {interiorActorScale} from './interior-scale.mjs';
import {configureUrbanInteriors,getInteriorBase} from './urban-interiors.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {createRoomLayoutModel} from './room-layout-model.mjs';

const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} versus ${b}`);
const length=route=>route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-route[i].x,p.y-route[i].y),0);
const origin={x:100,y:280},exit={x:600,y:280};
function fixture(solids=[]){return {kind:'apartment',width:800,height:480,spawn:{...exit},actors:[{id:'bach',...origin}],items:[],solids,layoutRevision:1};}
function clear(scene,p){return p.x>=40&&p.x<=scene.width-40&&p.y>=112&&p.y<=scene.height-40&&!scene.solids.some(r=>p.x>=r.x-6&&p.x<=r.x+r.w+6&&p.y>=r.y-6&&p.y<=r.y+r.h+6);}
function checkRoute(scene,route){
 for(let i=0;i<route.length;i++){
  const a=route[Math.max(0,i-1)],b=route[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*2));
  for(let j=0;j<=n;j++)assert(clear(scene,{x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n}),`A resident crossed a solid on segment ${i}`);
 }
}
function journeyFor(getScene){
 const url=new URL('./resident-journey.mjs',import.meta.url),source=readFileSync(url,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\} from .*;\r?\n/gm,'').replace(/^export function /gm,'function ')+'\n({residentHomePose,interiorJourneyPose,journeyDuration});';
 return vm.runInNewContext(source,{residents,interiorActorScale,getApartmentNavigation,getInterior:getScene},{filename:url.pathname});
}

test('unobstructed apartment legs keep their exact original endpoints, duration and walking cadence',()=>{
 const scene=fixture(),before=JSON.stringify(scene),route=getApartmentNavigation(scene,origin,exit),journey=journeyFor(()=>scene);
 assert.deepEqual(route.outRoute,[origin,exit]);assert.deepEqual(route.homeRoute,[exit,origin]);assert.equal(getApartmentNavigation(scene,origin,exit),route);
 assert(Object.isFrozen(route)&&Object.isFrozen(route.outRoute)&&route.outRoute.every(Object.isFrozen));
 const resident=residents.find(r=>r.id==='bach'),publicDistance=1178+244+Math.abs(430-1152),expected=publicDistance/156+500/58.5+4+resident.floor*.35;
 near(journey.journeyDuration('bach','out'),expected);near(journey.journeyDuration('bach','home'),expected);
 const a=journey.interiorJourneyPose('bach','out',.2),b=journey.interiorJourneyPose('bach','out',.21),distance=Math.hypot(b.x-a.x,b.y-a.y);
 near(distance/.01,58.5);near(((b.phase-a.phase+Math.PI*2)%(Math.PI*2))/distance,Math.PI*2/56.25);
 assert.equal(JSON.stringify(scene),before);
});

test('blocked apartment legs detour through actual free space and reverse the same safe route',()=>{
 const scene=fixture([{x:280,y:240,w:40,h:80}]),before=JSON.stringify(scene),route=getApartmentNavigation(scene,origin,exit);
 assert(route);assert(route.outRoute.length>2);assert.deepEqual(route.outRoute[0],origin);assert.deepEqual(route.outRoute.at(-1),exit);
 assert.deepEqual(route.homeRoute,[...route.outRoute].reverse());assert(length(route.outRoute)>500);checkRoute(scene,route.outRoute);checkRoute(scene,route.homeRoute);assert.equal(JSON.stringify(scene),before);
});

test('native Bach and mirrored Mozart chairs remain placeable and residents walk around their real footprints',()=>{
 const catalog=new Map([...APARTMENT_COLLECTION_ASSETS,...FAMILY_FURNITURE_ASSETS].map(asset=>[asset.id,asset]));configureUrbanInteriors(catalog);
 for(const [id,x]of [['bach',900],['mozart',284]]){
  const source=getInteriorBase({kind:'apartment',resident:id}),model=createRoomLayoutModel({themeId:id,scene:source,catalog}),home=source.actors.find(actor=>actor.id===id);
  const baseline=getApartmentNavigation(source,home,source.spawn);assert(baseline);assert.equal(baseline.outRoute.length,2);
  assert.equal(model.add('collection-'+id+'-dining-chair',{x,y:428}).ok,true);assert.equal(model.place().ok,true);
  const scene=model.scene,record=JSON.stringify(model.record()),route=getApartmentNavigation(scene,home,scene.spawn),journey=journeyFor(()=>scene);
  assert(route&&route.outRoute.length>2,id+' needs a genuine furniture detour');checkRoute(scene,route.outRoute);checkRoute(scene,route.homeRoute);
  const privateTime=length(route.outRoute)/58.5;
  for(let t=0;t<privateTime;t+=.01){const pose=journey.interiorJourneyPose(id,'out',t);assert.equal(pose.scene.kind,'apartment');assert(clear(scene,pose),id+' walks clear of furniture');}
  const opening=journey.interiorJourneyPose(id,'out',privateTime+.35);assert.equal(opening.walking,false);near(opening.x,scene.spawn.x);near(opening.y,scene.spawn.y);
  const returnAt=journey.journeyDuration(id,'home')-privateTime;
  for(let t=.001;t<privateTime;t+=.01){const pose=journey.interiorJourneyPose(id,'home',returnAt+t);assert.equal(pose.scene.kind,'apartment');assert(clear(scene,pose),id+' returns around furniture');}
  assert.equal(JSON.stringify(model.record()),record,'Navigation cannot rewrite a room design');
 }
});

test('blocked home or entrance points never use the showroom router’s nearby-goal fallback',()=>{
 for(const solids of [[{x:595,y:275,w:10,h:10}],[{x:95,y:275,w:10,h:10}],[{x:390,y:106,w:20,h:346}]]){
  const scene=fixture(solids);assert.equal(getApartmentNavigation(scene,origin,exit),null);assert.equal(getApartmentNavigation(scene,origin,exit),null);
  const journey=journeyFor(()=>scene);assert.equal(journey.journeyDuration('bach','out'),Infinity);
  for(const time of [0,1,10000,Infinity]){const pose=journey.interiorJourneyPose('bach','out',time);assert.equal(pose.done,false);assert.equal(pose.walking,false);assert.equal(pose.waiting,true);assert.equal(pose.resumeAt,0);near(pose.x,origin.x);near(pose.y,origin.y);}
  const arrival=journey.interiorJourneyPose('bach','home',10000);assert.equal(arrival.scene.kind,'apartment');assert.equal(arrival.waiting,true);near(arrival.x,exit.x);near(arrival.y,exit.y);
 }
});

test('scene replacements, revision changes and replaced collider arrays invalidate apartment route caches',()=>{
 const scene=fixture(),original=getApartmentNavigation(scene,origin,exit);
 scene.solids.push({x:280,y:240,w:40,h:80});scene.layoutRevision++;
 const detour=getApartmentNavigation(scene,origin,exit);assert.notEqual(detour,original);assert(detour.outRoute.length>2);checkRoute(scene,detour.outRoute);
 scene.solids=[];const straight=getApartmentNavigation(scene,origin,exit);assert.notEqual(straight,detour);assert.equal(straight.outRoute.length,2);
 assert.notEqual(getApartmentNavigation({...scene},origin,exit),straight);
});

test('the actual ambient journey caller freezes an unreachable trip and resumes from its safe endpoint after an edit',()=>{
 for(const direction of ['out','home']){
  let scene=fixture([{x:390,y:106,w:20,h:346}]);const journey=journeyFor(()=>scene),source=readFileSync(new URL('./ambient-npcs.mjs',import.meta.url),'utf8'),start=source.indexOf(' function applyJourney('),end=source.indexOf(' function sit(',start);assert(start>=0&&end>start);
  let exited=0;
  const apply=vm.runInNewContext(source.slice(start,end)+'\napplyJourney',{interiorJourneyPose:journey.interiorJourneyPose,city:{tower:{}},record(){},home(){throw Error('The resident must not complete a blocked trip');},exitBuilding(){exited++;return true;}},{filename:'ambient-npcs.mjs:applyJourney'});
  const paused=journey.interiorJourneyPose('bach',direction,10000),resumeAt=paused.resumeAt,at=direction==='out'?origin:exit,actor={id:'bach',_journey:{direction,elapsed:resumeAt}};
  for(let i=0;i<100;i++){apply(actor,.1);assert.equal(actor._journey.elapsed,resumeAt);near(actor.x,at.x);near(actor.y,at.y);assert.equal(actor.walking,false);}
  scene={...scene,solids:[],layoutRevision:2};apply(actor,.016);
  near(actor._journey.elapsed,resumeAt+.016);assert.equal(actor.location.kind,'apartment');assert.equal(actor.walking,true);near(actor.x,at.x+(direction==='out'?1:-1)*.016*58.5);near(actor.y,at.y);assert.equal(exited,0);
 }
});
