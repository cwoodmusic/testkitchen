import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,barriers,connect,blocked,segment,parseProject,History} from './model.mjs';
import {planMusicWall} from './music-wall-geometry.mjs';
import {toggleGate} from './physics.mjs';
const catalog=new Map(),ids=new Set();
const restore=d=>parseProject(JSON.stringify(d),ids);

test('off-grid Music Square wall paths retain scale and partial segments through portable saves and undo/redo',()=>{
 const d=blank();connect(d,{x:10,y:10},{x:11,y:10},'wood');
 const history=new History(),before=structuredClone(d);history.record(d);
 const a={x:8197.3125,y:7001.125,anchor:true,wallScale:.75},b={x:8347.6875,y:7129.125};
 const edits=planMusicWall(a,b);assert.equal(edits.length,5);Object.assign(d.edges,Object.fromEntries(edits));
 const saved=restore(d);assert.deepEqual(saved,d);assert(Object.keys(saved.edges).some(k=>k.startsWith('h:')));
 const world=Object.keys(saved.edges).filter(k=>k.startsWith('w:')).map(segment);
 assert.deepEqual(world[0],{x:a.x,y:a.y,dx:64,dy:0});
 assert(world.some(s=>s.dx===22.375&&s.dy===0));
 assert(Object.entries(saved.edges).filter(([k])=>k.startsWith('w:')).every(([,e])=>e.wallScale===.75));
 const undone=history.back(saved);assert.deepEqual(undone,before);
 assert.deepEqual(history.forward(undone),saved);
});

test('production collision and gate interaction use fractional world segments in both orientations',()=>{
 for(const vertical of [false,true]){
  const a={x:9000.25,y:6000.75},b={x:a.x+(vertical?0:64),y:a.y+(vertical?64:0)},middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const wall=blank();Object.assign(wall.edges,Object.fromEntries(planMusicWall(a,b)));
  assert.equal(blocked(wall,middle.x,middle.y,catalog),true);
  assert.equal(toggleGate(wall,middle),false);
  const gate=blank();Object.assign(gate.edges,Object.fromEntries(planMusicWall(a,b,true)));
  const saved=restore(gate);assert.equal(blocked(saved,middle.x,middle.y,catalog),true);
  assert.equal(blocked(saved,middle.x+(vertical?32:0),middle.y+(vertical?0:32),catalog),false);
  assert.equal(toggleGate(saved,middle),true);assert.equal(blocked(saved,middle.x,middle.y,catalog),false);
  assert.equal(Object.values(saved.edges)[0].open,true);
  assert.equal(toggleGate(saved,middle),true);assert.equal(blocked(saved,middle.x,middle.y,catalog),true);
 }
});

test('legacy grid barriers keep their coordinates, validation and gate behavior for every finish',()=>{
 for(const style of barriers)for(const vertical of [false,true]){
  const d=blank();connect(d,{x:128,y:96},{x:128+(vertical?0:1),y:96+(vertical?1:0)},style,true);
  const restored=restore(d),[key]=Object.keys(restored.edges),s=segment(key),middle={x:s.x+s.dx/2,y:s.y+s.dy/2};
  assert.equal(key,vertical?'v:128:96':'h:128:96');
  assert.deepEqual(s,{x:8192,y:6144,dx:vertical?0:64,dy:vertical?64:0});
  assert.equal(blocked(restored,middle.x,middle.y,catalog),true);assert.equal(toggleGate(restored,middle),true);
  assert.equal(blocked(restored,middle.x,middle.y,catalog),false);assert.deepEqual(restore(restored),restored);
 }
});

test('portable validation rejects malformed world edges and incompatible wall metadata',()=>{
 const valid={style:'music-square',gate:false,open:false,wallScale:1},k='w:8192.25:6144.5:64:0';
 const cases=[
  ['w:-1:6144:64:0',valid],['w:8192:6144:-64:0',valid],['w:8192:6144:0:-64',valid],
  ['w:8192:6144:64:64',valid],['w:8192:6144:0:0',valid],['w:8192:6144:65:0',valid],
  ['w:8192:6144:0:65',valid],['w:8192.12345:6144:64:0',valid],['w:8.192e3:6144:64:0',valid],
  ['w:16360:6144:64:0',valid],['w:8192:12260:0:64',valid],
  [k,{...valid,style:'wood'}],['h:128:96',{...valid,style:'brick'}],
  ...[.24,3.01,0,-1,Infinity,NaN,'1',null].map(wallScale=>[k,{...valid,wallScale}]),
  [k,{...valid,gate:'false'}],[k,{...valid,open:null}]
 ];
 for(const[key,edge]of cases){const d=blank();d.edges[key]=edge;assert.throws(()=>restore(d),/Invalid fence or wall|Fence outside map/,key+' '+JSON.stringify(edge));}
 for(const wallScale of [.25,.75,1,3]){const d=blank();d.edges[k]={...valid,wallScale};assert.deepEqual(restore(d),d);}
});
