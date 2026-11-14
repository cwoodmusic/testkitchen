import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blank,cell,height,terrainHeight,actorHeight,actorTraversal,actorBlocked,blocked,PIER_WALK_CLEARANCE} from './model.mjs';
import {movePlayer,follow} from './physics.mjs';
import {npcConnectionClear} from './npc-navigation.mjs';
import {createPlayerCollisionIndex} from './player-collision-index.mjs';
import {pierPostCentres} from './pier-post-layout.mjs';

const catalog=new Map();
function pier({level=8,shore=false,waterRow}={}){
 const doc=blank();
 for(let y=10;y<=17;y++)for(let x=10;x<=12;x++)doc.cells[x+','+y]={surface:y===waterRow?'water':'sand',level:0,bridge:'ns',pier:{level,axis:'ns'}};
 if(shore)for(let x=10;x<=12;x++)doc.cells[x+',9']={surface:'grass',level};
 return doc;
}
function walk(doc,actor,key,frames,{indexed=false}={}){
 const trace=[],index=indexed?createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0}):null;
 for(let i=0;i<frames;i++){const motion=movePlayer(index?index.view(actor):doc,actor,new Set([key]),1/60,catalog),cam={};follow(cam,actor,doc);trace.push({x:actor.x,y:actor.y,z:actorHeight(doc,actor),under:!!actor.underPier,motion,cam});}
 return trace;
}

test('a dry beach crosses below a high pier in both directions without climbing its deck',()=>{
 const doc=pier(),raw=JSON.stringify(doc);
 for(const [start,key]of [[{x:608,y:864},'d'],[{x:864,y:864},'a']]){
  const actor={...start},trace=walk(doc,actor,key,35);assert(trace.some(p=>p.under));assert.equal(actor.underPier,undefined);
  assert(trace.every(p=>p.z===0&&p.cam.y===p.y));assert(trace.every(p=>Math.abs(p.motion.distance-p.motion.surfaceDistance)<1e-7));
  assert(Math.abs(actor.x-start.x)>250);assert.equal(actor.y,start.y);
 }
 assert.equal(JSON.stringify(doc),raw,'Walking layers must never be added to saved terrain or spawn data');
});

test('under-deck motion retains its layer through small axis and diagonal substeps and exits onto the same ground',()=>{
 const doc=pier(),actor={x:704,y:608};
 const south=walk(doc,actor,'s',76);assert(south.some(p=>p.under));assert.equal(actor.underPier,undefined);assert(south.every(p=>p.z===0));
 const north=walk(doc,actor,'w',76);assert(north.some(p=>p.under));assert.equal(actor.underPier,undefined);assert(Math.abs(actor.y-608)<1e-7);
 const corner={x:634,y:830};for(let n=0;n<10;n++)movePlayer(doc,corner,new Set(['d','s']),1/60,catalog);
 assert(corner.underPier);assert.equal(actorHeight(doc,corner),0);assert(Math.hypot(corner.x-634,corner.y-830)>50);
});

test('an approach at deck elevation stays on top, including above water, and returns to its upper shore',()=>{
 const doc=pier({shore:true,waterRow:13}),actor={x:704,y:608},trace=walk(doc,actor,'s',55);
 assert(trace.every(p=>!p.under&&p.z===384));assert(actor.y>1000);walk(doc,actor,'w',55);assert(Math.abs(actor.y-608)<1e-7);assert.equal(actor.underPier,undefined);
 assert.equal(height(doc,704,864),384);assert.equal(terrainHeight(doc,704,864),0);
});

test('under-deck water, abrupt ground cliffs and insufficient headroom stay blocked without layer jumps',()=>{
 const water=pier({waterRow:13}),actor={x:704,y:800,underPier:true};walk(water,actor,'s',25);assert(actor.y<832);assert.equal(actorHeight(water,actor),0);assert(actor.underPier);
 assert.equal(blocked(water,704,864,catalog),false,'The existing deck remains walkable over water');
 assert.equal(actorBlocked(water,704,864,catalog,{x:704,y:831,underPier:true}),true);
 const low=pier({level:1}),beach={x:608,y:864};walk(low,beach,'d',25);assert(beach.x<640);assert.equal(beach.underPier,undefined);assert.equal(actorHeight(low,beach),0);
 const enough=pier({level:PIER_WALK_CLEARANCE/48});assert.equal(actorBlocked(enough,640,864,catalog,{x:639,y:864}),false);
 const cliff=pier({shore:true}),below={x:704,y:645,underPier:true};walk(cliff,below,'w',12);assert(below.y>=640);assert.equal(actorHeight(cliff,below),0);
});

test('support timber blocks only its physical ground-layer base while top-deck movement stays clear',()=>{
 const doc=pier(),post=pierPostCentres(10,12,{north:true,south:true,east:true,west:false})[0];
 assert.equal(actorBlocked(doc,post.x,post.y,catalog,{x:post.x,y:post.y-24,underPier:true}),true);
 assert.equal(actorBlocked(doc,post.x,post.y,catalog,{x:post.x,y:post.y-24}),false);
 assert.equal(blocked(doc,post.x,post.y,catalog,{x:post.x,y:post.y-24}),false);
 const gap={x:704,y:800,underPier:true};walk(doc,gap,'s',8);assert(gap.y>855,'A real corridor remains between adjacent timber posts');
});

test('static NPC and fairy connections retain deck-only collision instead of admitting half of an underpass',()=>{
 const doc=pier(),from={x:639,y:864},to={x:640,y:864};
 assert.equal(blocked(doc,to.x,to.y,catalog,from),true);
 assert.equal(npcConnectionClear(doc,catalog,{x:608,y:864},{x:864,y:864}),false);
 assert.equal(actorBlocked(doc,to.x,to.y,catalog,from),false,'Only explicit actual-actor traversal can select the lower layer');
 assert.deepEqual(actorTraversal(doc,from,to.x,to.y),{underPier:true,height:0});
});

test('the actual east beach crosses under all six high-pier columns using production indexed collision views',()=>{
 const doc=JSON.parse(readFileSync(new URL('../maps/coda-town-plaza-boardwalk.json',import.meta.url),'utf8')),raw=JSON.stringify(doc);
 for(const [start,key]of [[{x:12960,y:11104},'d'],[{x:13530,y:11104},'a']]){
  const actor={...start},trace=walk(doc,actor,key,76,{indexed:true});assert(trace.filter(p=>p.under).length>45);assert.equal(actor.underPier,undefined);assert(trace.every(p=>p.z===0));assert(Math.abs(actor.x-start.x)>560);
 }
 const top={x:13216,y:10656};const trace=walk(doc,top,'s',70,{indexed:true});assert(trace.every(p=>!p.under&&p.z===384));
 assert.equal(JSON.stringify(doc),raw);assert.equal(cell(doc,206,173).pier.level,8);
});
