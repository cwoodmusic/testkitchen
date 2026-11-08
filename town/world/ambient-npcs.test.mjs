import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,height,COLS,ROWS} from './model.mjs';
import {createAmbientNPCs,planNPCPath,npcConnectionClear} from './ambient-npcs.mjs';

const catalog=new Map();
function random(seed=17){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function barrier(doc,x=5){for(let y=0;y<ROWS;y++)doc.edges[`v:${x}:${y}`]={style:'iron',gate:false,open:false};}

test('pedestrian routes cannot jump closed walls, and a real open gate reconnects the street',()=>{
 const doc=blank();barrier(doc);doc.edges['v:5:3']={style:'iron',gate:true,open:false};
 const from={x:224,y:224},to={x:480,y:224};assert.deepEqual(planNPCPath(doc,catalog,from,to),[]);
 assert.equal(npcConnectionClear(doc,catalog,{x:288,y:224},{x:352,y:224}),false);
 doc.edges['v:5:3'].open=true;const path=planNPCPath(doc,catalog,from,to);assert(path.length>0);
 let previous=from;for(const point of path){assert(npcConnectionClear(doc,catalog,previous,point));previous=point;}
});

test('water and bare cliffs block navigation while production stair profiles connect the floors',()=>{
 const from={x:224,y:224},to={x:480,y:224},water=blank();
 for(let y=0;y<25;y++)water.cells[`5,${y}`]={surface:'water',level:0};assert.deepEqual(planNPCPath(water,catalog,from,to),[]);
 const cliff=blank();for(let y=0;y<25;y++)for(let x=6;x<20;x++)cliff.cells[`${x},${y}`]={surface:'grass',level:2};
 assert.deepEqual(planNPCPath(cliff,catalog,from,to),[]);
 cliff.cells['5,3']={surface:'wood',level:0,stairs:'east',stairBase:0,stairRise:2,stairStart:0,stairEnd:1};
 const path=planNPCPath(cliff,catalog,from,to);assert(path.length>0);assert(path.some(p=>height(cliff,p.x,p.y)>0));
 let previous=from;for(const point of path){assert(npcConnectionClear(cliff,catalog,previous,point));previous=point;}
});

test('ambient musicians actually walk using collision, stay on their side of a wall, and never alter the map',()=>{
 const doc=blank();for(let y=0;y<ROWS;y++)doc.edges[`w:8192:${y*64}:0:64`]={style:'music-square',gate:false,open:false,wallScale:1};
 for(let y=93;y<98;y++)for(let x=120;x<124;x++)doc.cells[`${x},${y}`]={surface:'water',level:0};
 const localCatalog=new Map([['box',{w:240,h:240,boxes:[{x:0,y:0,w:240,h:240}]}]]);
 doc.objects.push({id:'test-building',asset:'box',x:8400,y:6400,scale:1,rotation:0,layer:'objects',collision:true});
 const before=JSON.stringify(doc),cam={x:8192,y:6144,zoom:.8};
 const ambient=createAmbientNPCs({getProject:()=>doc,catalog:localCatalog,getCamera:()=>cam,getViewport:()=>({width:1200,height:800}),random:random(),count:4});
 ambient.update(0,0);assert.equal(ambient.actors.length,4);
 const initial=new Map(ambient.actors.map(a=>[a.id,{x:a.x,y:a.y,phase:a.phase,side:Math.sign(a.x-8192)}]));let sawWalking=false;
 for(let frame=0;frame<360;frame++){
  ambient.update(1/60,frame/60);
  for(const actor of ambient.actors){assert(Number.isFinite(actor.x)&&Number.isFinite(actor.y));assert.equal(blocked(doc,actor.x,actor.y,localCatalog),false);assert.equal(Math.sign(actor.x-8192),initial.get(actor.id).side);sawWalking||=actor.walking;}
 }
 assert(sawWalking);assert(ambient.actors.some(a=>Math.hypot(a.x-initial.get(a.id).x,a.y-initial.get(a.id).y)>100));assert(ambient.actors.some(a=>a.phase!==initial.get(a.id).phase));
 assert.equal(JSON.stringify(doc),before);
});

test('a camera pan recycles only off-screen actors and water-only scenes hide them safely',()=>{
 let doc=blank();const cam={x:5000,y:5000,zoom:1},view={width:1000,height:700};
 const ambient=createAmbientNPCs({getProject:()=>doc,catalog,getCamera:()=>cam,getViewport:()=>view,random:random(22),count:3});
 ambient.update(0);const old=ambient.actors.map(a=>({...a}));assert.equal(old.length,3);cam.x=11000;
 for(let i=0;i<4;i++)ambient.update(1/60);
 for(const actor of ambient.actors){const prior=old.find(a=>a.id===actor.id);if(Math.abs(actor.x-prior.x)>1000)assert(Math.abs(actor.x-cam.x)>=view.width/2||Math.abs(actor.y-height(doc,actor.x,actor.y)-cam.y)>=view.height/2);}
 doc=blank();for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)doc.cells[`${x},${y}`]={surface:'water',level:0};const before=JSON.stringify(doc);ambient.update(.1);
 assert.equal(ambient.actors.length,0);assert.equal(JSON.stringify(doc),before);
});
