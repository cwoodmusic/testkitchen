import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,ROWS} from './model.mjs';
import {createNPCNavigator,npcConnectionClear,planNPCPath} from './npc-navigation.mjs';

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
 const nav=createNPCNavigator({getProject:()=>doc,catalog:localCatalog});
 for(let y=700;y<1400;y+=43)for(let x=700;x<1500;x+=43){const point={x,y},view=nav.collisionView(point);assert.equal(blocked(view,x,y,localCatalog),blocked(doc,x,y,localCatalog));assert(view.objects.every(o=>o.id!=='far'));}
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
