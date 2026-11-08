import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,height,terrainHeight,terrainView,surfaceAt,blocked,parseProject,History} from '../world/model.mjs';
import {movePlayer} from '../world/physics.mjs';
import {planPier} from './piers.mjs';
import {pierGeometry,submergedPierRuns} from '../world/piers.mjs';
import {regionHeightEdits} from './region.mjs';
import {planStairs} from './stairs.mjs';

const apply=(d,p)=>Object.assign(d.cells,Object.fromEntries(p.edits));
function shore(){
 const d=blank();for(let y=8;y<15;y++)for(let x=9;x<17;x++)d.cells[`${x},${y}`]={surface:x<=10?'sand':'water',level:x<=10?1:0};return d;
}
const world=(x,y)=>({x:(x+.5)*64,y:(y+.5)*64});

test('a shore pier retains the complete water floor while exposing a continuous walkable deck',()=>{
 const d=shore(),before=JSON.stringify(d),p=planPier(d,world(10,10),world(15,10),{width:1});
 assert(p.valid,p.message);assert.equal(p.level,1);assert.equal(p.axis,'ew');assert.equal(JSON.stringify(d),before);apply(d,p);
 for(let x=10;x<=15;x++){
  const a=cell(d,x,10);assert.equal(a.level,x===10?1:0);assert.equal(a.surface,x===10?'sand':'water');assert.equal(a.bridge,'ew');assert.deepEqual(a.pier,{level:1,axis:'ew'});
  assert.equal(height(d,(x+.5)*64,672),48);assert.equal(terrainHeight(d,(x+.5)*64,672),x===10?48:0);assert.equal(height(terrainView(d),(x+.5)*64,672),x===10?48:0);
 }
 const actor=world(10,10);for(let i=0;i<100;i++)movePlayer(d,actor,new Set(['d']),.01,new Map());assert(actor.x>15*64);assert.equal(height(d,actor.x,actor.y),48);
 assert.equal(blocked(d,13.5*64,11.5*64,new Map()),true);assert.equal(surfaceAt(d,13.5*64,10.5*64),'water');
});

test('a water-start pier uses the deck level control and rejects cuts through higher ground or barriers',()=>{
 const d=shore(),p=planPier(d,world(11,11),world(15,11),{width:1,level:3});assert(p.valid,p.message);assert.equal(p.level,3);
 d.cells['13,11']={surface:'grass',level:4};assert.equal(planPier(d,world(11,11),world(15,11),{width:1,level:3}).valid,false);
 delete d.cells['13,11'];d.edges['v:13:11']={style:'iron',gate:false,open:false};assert.equal(planPier(d,world(11,11),world(15,11),{width:1,level:3}).valid,false);
 d.edges={};d.cells['13,11']={surface:'grass',level:0,stairs:'north'};assert.equal(planPier(d,world(11,11),world(15,11),{width:1,level:3}).valid,false);
 assert.equal(planPier(d,{x:-1,y:60},world(15,11)).valid,false);
});

test('new sections join existing L and T decks and the support piles reach ground and into water',()=>{
 const d=shore();apply(d,planPier(d,world(10,10),world(15,10),{width:1}));
 const turn=planPier(d,world(13,10),world(13,13),{width:1});assert(turn.valid,turn.message);assert.equal(turn.level,1);apply(d,turn);
 const joint=pierGeometry(d,13,10);assert(joint.joins.west&&joint.joins.east&&joint.joins.south);assert.equal(joint.joins.north,false);
 const ocean=pierGeometry(d,13,13);assert.equal(ocean.z,48);assert.equal(ocean.ground,0);assert(ocean.supports.length>=2);
 for(const p of ocean.supports){assert(p.h>48);assert(p.y+p.h>p.waterline+40);assert(p.water);}
 const dry=pierGeometry(d,10,10);for(const p of dry.supports)assert.equal(p.y+p.h,p.waterline+3);
 const incompatible=planPier(d,world(11,11),world(13,11),{width:1,level:2});assert.equal(incompatible.valid,false);
});

test('pier geometry persists and is a single exact undo action without mutating objects or terrain curves',()=>{
 const d=shore();d.objects=[{id:'notice',asset:'notice',x:3000,y:3000,scale:1,rotation:0,layer:'objects',collision:false}];
 d.cells['14,10'].curves=[{kind:'surface',corner:'nw',cx:960,cy:704,r:64,underX:15,underY:10,under:{surface:'water',level:0}}];
 const before=JSON.stringify(d),history=new History(),plan=planPier(d,world(10,10),world(15,10),{width:1});assert(plan.valid,plan.message);history.record(d);apply(d,plan);
 assert.deepEqual(parseProject(JSON.stringify(d),new Set(['notice'])),d);assert.equal(d.cells['14,10'].curves[0].under.surface,'water');assert.equal(JSON.stringify(history.back(d)),before);
 const restored=history.forward(JSON.parse(before));assert.equal(restored.cells['15,10'].pier.level,1);
 for(const invalid of [null,{level:-1,axis:'ew'},{level:1.5,axis:'ew'},{level:9,axis:'ew'},{level:1,axis:'diagonal'},{level:1,axis:'ns'},{level:1,axis:'ew',hidden:2}]){
  const copy=structuredClone(restored);copy.cells['15,10'].pier=invalid;assert.throws(()=>parseProject(JSON.stringify(copy),new Set(['notice'])),/Invalid pier/);
 }
 const tooLow=structuredClone(restored);tooLow.cells['10,10'].pier.level=0;assert.throws(()=>parseProject(JSON.stringify(tooLow),new Set(['notice'])),/Invalid pier/);
});

test('regional height edits move the deck with its supporting floor and stairs replace pier metadata',()=>{
 const d=shore();apply(d,planPier(d,world(10,10),world(15,10),{width:1}));
 const region={x0:11,y0:10,x1:15,y1:10};apply(d,{edits:regionHeightEdits(d,region,1)});
 for(let x=11;x<=15;x++){assert.equal(cell(d,x,10).level,1);assert.equal(cell(d,x,10).pier.level,2);}
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);apply(d,{edits:regionHeightEdits(d,region,-1)});
 for(let x=11;x<=15;x++){assert.equal(cell(d,x,10).level,0);assert.equal(cell(d,x,10).pier.level,1);}
 const stairs=blank();stairs.cells['10,10']={surface:'sand',level:0,bridge:'ew',pier:{level:1,axis:'ew'},sidewalkCurb:true};stairs.cells['14,10']={surface:'grass',level:3};
 const plan=planStairs(stairs,{x:10,y:10},{x:14,y:10},{width:1});assert(plan.valid,plan.message);apply(stairs,plan);
 for(const[k]of plan.edits){assert.equal(stairs.cells[k].pier,undefined);assert.equal(stairs.cells[k].bridge,undefined);assert.equal(stairs.cells[k].sidewalkCurb,undefined);}
 assert.deepEqual(parseProject(JSON.stringify(stairs),new Set()),stairs);
});

test('submerged beams remain visible in the ocean but are occluded by a foreground bank',()=>{
 const d=shore();apply(d,planPier(d,world(10,10),world(15,10),{width:1}));
 const post=pierGeometry(d,15,10).supports[0],open=submergedPierRuns(d,post);assert(open.length>10);
 const screenY=open[Math.floor(open.length/2)].y,worldX=post.x+post.w/2,bankY=Math.floor((screenY+2*48+1)/64);
 d.cells[`${Math.floor(worldX/64)},${bankY}`]={surface:'grass',level:2};
 assert.equal(submergedPierRuns(d,post).some(r=>r.y===screenY),false);
});
