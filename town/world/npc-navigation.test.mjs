import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,ROWS} from './model.mjs';
import {createNPCNavigator,npcConnectionClear,planNPCPath,npcCollisionProject} from './npc-navigation.mjs';
import {movePlayer} from './physics.mjs';

const catalog=new Map();
function finish(navigator,max=2000){for(let i=0;i<max&&navigator.stats.pending;i++)navigator.update({budgetMs:Infinity,maxSteps:300});assert.equal(navigator.stats.pending,0,'Route queue did not finish');}
function verify(doc,path,from){let previous=from;for(const next of path){assert(npcConnectionClear(doc,catalog,previous,next));previous=next;}}

test('queued city routes cross more than the old local radius without blocking the requesting frame',()=>{
 const doc=blank(),bounds={x0:1000,y0:1000,x1:9000,y1:6000};
 for(let y=16;y<92;y++)doc.cells[`60,${y}`]={surface:'water',level:0};
 // A dry gap connects the two sides; the path must reach it, not cross water.
 doc.cells['60,45']={surface:'sidewalk',level:0};
 const nav=createNPCNavigator({getProject:()=>doc,catalog,getBounds:()=>bounds}),from={x:2080,y:1952},to={x:5984,y:1952};let path;
 nav.request('bach',from,to,p=>path=p);assert.equal(path,undefined);assert.equal(nav.stats.pending,1);
 const count=nav.update({budgetMs:Infinity,maxSteps:5});assert.equal(count,5);assert.equal(path,undefined,'Large search completed outside its node allowance');
 finish(nav);assert(path.length);assert.deepEqual(path.at(-1),to);verify(doc,path,from);
 assert(path.some(p=>p.y>=45*64),'Route did not use the dry gap');
 const edges=nav.stats.edges;nav.plan(from,to);assert.equal(nav.stats.edges,edges,'Identical route did not reuse navigation edges');
});

test('live geometry invalidation cancels queued work and refreshes a gate cached in the same document',()=>{
 const doc=blank();for(let y=0;y<ROWS;y++)doc.edges[`v:5:${y}`]={style:'iron',gate:false,open:false};
 doc.edges['v:5:3']={style:'iron',gate:true,open:true};
 const nav=createNPCNavigator({getProject:()=>doc,catalog}),from={x:224,y:224},to={x:480,y:224};
 nav.invalidate(1);const path=nav.plan(from,to,{radius:14});assert(path.length);verify(doc,path,from);
 let abandoned;nav.request('clara',from,to,p=>abandoned=p);nav.update({maxSteps:1,budgetMs:Infinity});
 doc.edges['v:5:3'].open=false;nav.invalidate(2);assert.deepEqual(abandoned,[]);assert.equal(nav.stats.pending,0);assert.equal(nav.stats.edges,0);
 assert.deepEqual(nav.plan(from,to,{radius:14,maxNodes:600}),[]);
 const stable=nav.stats.invalidations;nav.invalidate(2);assert.equal(nav.stats.invalidations,stable,'Unchanged revision invalidated navigation');
});

test('collision bins retain rotated and scaled solids at their edges while excluding far-away objects',()=>{
 const doc=blank(),localCatalog=new Map([['building',{w:200,h:200,boxes:[{x:0,y:0,w:200,h:200}]}]]);
 doc.objects.push({id:'near',asset:'building',x:1040,y:1100,rotation:90,scale:2,collision:true},{id:'far',asset:'building',x:9000,y:9000,rotation:0,scale:1,collision:true});
 const nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog}),completeNPCView=npcCollisionProject(doc,localCatalog);
 for(let y=700;y<1400;y+=43)for(let x=700;x<1500;x+=43){const point={x,y},view=nav.collisionView(point);assert.equal(blocked(view,x,y,localCatalog),blocked(completeNPCView,x,y,localCatalog));assert(view.objects.every(o=>o.id!=='far'));}
 assert.equal(nav.connectionClear({x:850,y:1050},{x:1500,y:1050}),false);
});

test('requests are fair, replaceable, cancellable and leave the authored map unchanged',()=>{
 const doc=blank(),before=JSON.stringify(doc),nav=createNPCNavigator({getProject:()=>doc,catalog}),from={x:4000,y:4000},calls=[];
 nav.request('bach',from,{x:6000,y:4000},()=>calls.push('old'));
 nav.request('bach',from,{x:5000,y:4000},p=>calls.push(['bach',p]));
 nav.request('clara',from,{x:4000,y:5000},p=>calls.push(['clara',p]));
 nav.request('cancelled',from,{x:5000,y:5000},()=>calls.push('cancelled'));nav.cancel('cancelled');
 assert.equal(nav.stats.pending,2);finish(nav);assert.equal(calls.length,2);assert.deepEqual(new Set(calls.map(c=>c[0])),new Set(['bach','clara']));
 for(const[,path]of calls){assert(path.length);verify(doc,path,from);}
 assert.equal(JSON.stringify(doc),before);
});

test('compatibility routing retains stair and closed-wall collision while live endpoints can use a nearby clear tile',()=>{
 const doc=blank(),from={x:224,y:224},to={x:480,y:224};
 for(let y=0;y<25;y++)for(let x=6;x<20;x++)doc.cells[`${x},${y}`]={surface:'grass',level:2};
 assert.deepEqual(planNPCPath(doc,catalog,from,to),[]);
 doc.cells['5,3']={surface:'wood',level:0,stairs:'east',stairBase:0,stairRise:2,stairStart:0,stairEnd:1};
 const path=planNPCPath(doc,catalog,from,to);assert(path.length);verify(doc,path,from);
});

test('temporary crowds detour a queued route without changing shared authored walkability',()=>{
 const doc=blank(),before=JSON.stringify(doc),nav=createNPCNavigator({getProject:()=>doc,catalog}),from={x:224,y:224},to={x:864,y:224};
 const direct=nav.plan(from,to);assert.deepEqual(direct,[to]);const version=nav.stats.invalidations;
 let detour;nav.request('passing',from,to,p=>detour=p,{avoid:[{x:544,y:224,r:48},{x:from.x,y:from.y,r:48},{x:to.x,y:to.y,r:48}]});finish(nav);
 assert(detour.length);assert(detour.some(p=>p.y!==224),'Crowded middle tile did not cause a detour');verify(doc,detour,from);
 const warmEdges=nav.stats.edges;assert.deepEqual(nav.plan(from,to),direct,'Temporary crowd leaked into shared walkability');assert.equal(nav.stats.edges,warmEdges,'Previously cached clear route was rebuilt');assert.equal(nav.stats.invalidations,version);
 assert.equal(JSON.stringify(doc),before);
});

test('NPCs route and walk around a default-off flower bed without changing player collision',()=>{
 const doc=blank(),localCatalog=new Map([['flowers',{w:192,h:160,boxes:[{x:0,y:64,w:192,h:96}],npcAvoid:true}]]);
 const bed={id:'flower-bed',asset:'flowers',x:544,y:256,scale:1,rotation:0,collision:false,layer:'objects'};doc.objects.push(bed);
 const before=JSON.stringify(doc),from={x:224,y:224},to={x:864,y:224},nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog});
 assert.equal(blocked(doc,544,224,localCatalog),false,'Player collision toggle should stay off');
 assert.equal(blocked(nav.collisionView({x:544,y:224}),544,224,localCatalog),true,'NPC view omitted the flower bed');
 assert.equal(npcConnectionClear(doc,localCatalog,from,to),false);
 const path=nav.plan(from,to);assert(path.length);assert(path.some(p=>p.y!==224),'NPC took a straight route across the flowers');
 let previous=from;
 for(const next of path){assert(npcConnectionClear(doc,localCatalog,previous,next));previous=next;}
 const actor={x:420,y:224};
 for(let i=0;i<60;i++)movePlayer(nav.collisionView(actor),actor,new Set(['d']),1/60,localCatalog);
 assert(actor.x<448,'Walking physics entered the flower footprint');
 assert.equal(JSON.stringify(doc),before);assert.strictEqual(bed.collision,false);
});

test('NPC-only planted obstacles retain transformed geometry, while mounted foliage and walkable decor stay clear',()=>{
 const doc=blank(),localCatalog=new Map([
  ['shrub',{w:160,h:100,boxes:[{x:0,y:20,w:160,h:80}],npcAvoid:true}],
  ['cloth',{w:160,h:100,boxes:[{x:0,y:20,w:160,h:80}]}]
 ]);
 doc.objects.push({id:'shrub',asset:'shrub',x:1040,y:1100,scale:2,rotation:90,collision:false,layer:'objects'},
  {id:'cloth',asset:'cloth',x:1400,y:1100,scale:1,rotation:0,collision:false,layer:'ground'},
  {id:'mounted',asset:'shrub',x:1800,y:1100,scale:1,rotation:0,collision:false,mount:{x:28,y:17,u:.5,v:.5}});
 const derived=npcCollisionProject(doc,localCatalog),nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog});
 assert.notStrictEqual(derived,doc);assert.strictEqual(derived.cells,doc.cells);assert.strictEqual(derived.edges,doc.edges);
 assert.notStrictEqual(derived.objects[0],doc.objects[0]);assert.strictEqual(derived.objects[1],doc.objects[1]);assert.strictEqual(derived.objects[2],doc.objects[2]);
 let hit=false;
 for(let y=850;y<1350;y+=31)for(let x=900;x<1500;x+=31){
  const p={x,y},actual=blocked(nav.collisionView(p),x,y,localCatalog),expected=blocked(derived,x,y,localCatalog);
  assert.equal(actual,expected,'Transformed NPC obstacle was lost at a navigation bin boundary');hit||=actual;
 }
 assert(hit);assert.equal(blocked(derived,1400,1080,localCatalog),false);assert.equal(blocked(derived,1800,1080,localCatalog),false);
 assert(doc.objects.every(o=>o.collision===false));
});

test('bench footprints block actual NPC movement and invalidation honors later player-solid edits',()=>{
 const doc=blank(),localCatalog=new Map([['bench',{w:192,h:128,boxes:[{x:0,y:64,w:192,h:64}]}]]);
 doc.objects.push({id:'bench',asset:'bench',x:544,y:256,scale:1,rotation:0,collision:true,layer:'objects'});
 const nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog}),actor={x:420,y:224};nav.invalidate(1);
 for(let i=0;i<60;i++)movePlayer(nav.collisionView(actor),actor,new Set(['d']),1/60,localCatalog);
 assert(actor.x<448,'NPC walked through the bench seat');
 doc.objects[0].collision=false;nav.invalidate(2);
 for(let i=0;i<60;i++)movePlayer(nav.collisionView(actor),actor,new Set(['d']),1/60,localCatalog);
 assert(actor.x>700,'Explicitly disabled ordinary bench collision did not invalidate');
});

test('NPC foot clearance survives derived views and still fits a one-tile doorway',()=>{
 const doc=blank(),localCatalog=new Map([['wall',{w:256,h:256,boxes:[{x:0,y:0,w:256,h:256}]}]]);
 for(const[id,x]of [['left',384],['right',704]])doc.objects.push({id,asset:'wall',x,y:512,scale:1,rotation:0,collision:true,layer:'objects'});
 const before=JSON.stringify(doc),view=npcCollisionProject(doc,localCatalog),radius=Symbol.for('coda.town.collisionRadius'),nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog});
 assert.equal(doc[radius],undefined);assert.equal(view[radius],18);assert.equal({...view}[radius],18);assert.equal(nav.collisionView({x:544,y:384})[radius],18);
 assert.equal(blocked(doc,524,384,localCatalog),false,'Player point should clear the original ten-pixel margin');
 assert.equal(blocked(view,524,384,localCatalog),true,'NPC foot circle must not graze the wall');
 assert.equal(blocked({...view},544,384,localCatalog),false,'A sixty-four-pixel opening must remain usable');
 const from={x:544,y:224},to={x:544,y:544},path=nav.plan(from,to);assert.deepEqual(path,[to]);assert(npcConnectionClear(doc,localCatalog,from,to));
 assert.equal(JSON.stringify(view),before,'Collision clearance must not enter saved JSON');assert.equal(JSON.stringify(doc),before);
});

test('a nearby pedestrian is considered when rerouting from a crowded corner',()=>{
 const doc=blank(),nav=createNPCNavigator({getProject:()=>doc,catalog}),from={x:224,y:384},to={x:1300,y:384},crowd={x:288,y:384,r:48};
 const path=nav.plan(from,to,{avoid:[crowd]});assert(path.length);
 let previous=from;
 for(const end of path){
  const n=Math.max(1,Math.ceil(Math.hypot(end.x-previous.x,end.y-previous.y)/3));
  for(let i=1;i<=n;i++){const p={x:previous.x+(end.x-previous.x)*i/n,y:previous.y+(end.y-previous.y)*i/n};assert(Math.hypot(p.x-crowd.x,p.y-crowd.y)>=crowd.r,'Route ignored a pedestrian less than96pixels from its start');}
  previous=end;
 }
 assert.deepEqual(nav.plan(from,to),createNPCNavigator({getProject:()=>doc,catalog}).plan(from,to),'Temporary crowds must not affect the shared static cache');
});
