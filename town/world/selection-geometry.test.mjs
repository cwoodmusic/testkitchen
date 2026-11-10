import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSelectionGeometryCache} from './selection-geometry.mjs';
import {drawSelection} from './selection-view.mjs';

const region=(x0,y0,x1,y1,cells)=>({x0,y0,x1,y1,...(cells?{cells}: {})});
const doc=()=>({cells:{}});
const whole={x0:0,y0:0,x1:256,y1:192};
function reference(d,r,bounds=whole,plan=false){
 const members=r.cells?new Set(r.cells):null,contains=(x,y)=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1&&(!members||members.has(`${x},${y}`)),fills=[],segments=[];
 for(let y=Math.max(bounds.y0,r.y0);y<Math.min(bounds.y1,r.y1+1);y++)for(let x=Math.max(bounds.x0,r.x0);x<Math.min(bounds.x1,r.x1+1);x++){
  if(!contains(x,y))continue;
  const X=x*64,Y=y*64-(plan?0:(d.cells[`${x},${y}`]?.level??0)*48);fills.push([X,Y]);
  if(!contains(x,y-1))segments.push([X,Y,X+64,Y]);
  if(!contains(x+1,y))segments.push([X+64,Y,X+64,Y+64]);
  if(!contains(x,y+1))segments.push([X+64,Y+64,X,Y+64]);
  if(!contains(x-1,y))segments.push([X,Y+64,X,Y]);
 }
 return {fills,segments};
}
const segmentKey=([x0,y0,x1,y1])=>x0<x1||x0===x1&&y0<y1?[x0,y0,x1,y1].join(','):[x1,y1,x0,y0].join(',');
function unitSegments(segments){
 const result=[];
 for(const[x0,y0,x1,y1]of segments){
  const count=Math.round(Math.hypot(x1-x0,y1-y0)/64);
  for(let i=0;i<count;i++)result.push(segmentKey([x0+(x1-x0)*i/count,y0+(y1-y0)*i/count,x0+(x1-x0)*(i+1)/count,y0+(y1-y0)*(i+1)/count]));
 }
 return result.sort();
}
function assertEquivalent(d,r,bounds=whole,options={}){
 const cache=createSelectionGeometryCache(),g=cache.geometry(d,r,options),actual=cache.view(g,bounds),expected=reference(d,r,bounds,options.plan),fills=[];
 for(const rect of actual.fills)for(let x=rect.x;x<rect.x+rect.w;x+=64)fills.push([x,rect.y]);
 assert.deepEqual(fills.sort(),expected.fills.sort());
 assert.deepEqual(unitSegments(actual.segments),unitSegments(expected.segments));
 return {g,actual};
}

test('cached freeform perimeter keeps holes, disconnected islands and duplicate mask entries',()=>{
 const d=doc(),cells=['0,0','1,0','2,0','0,1','2,1','0,2','1,2','2,2','4,1','4,1'],r=region(0,0,4,2,cells),{g}=assertEquivalent(d,r);
 assert.equal(g.count,9);assert(g.perimeter.length<reference(d,r).segments.length,'Straight perimeter edges should merge');
 assertEquivalent(d,r,{x0:0,y0:1,x1:2,y1:3});
});

test('equal-elevation fill runs split at height changes while outer edges keep their owning tile height',()=>{
 const d=doc(),r=region(0,0,4,3);
 for(let y=0;y<=3;y++)for(let x=0;x<=4;x++)d.cells[`${x},${y}`]={level:(x<2?2:4)+y%2};
 const {g}=assertEquivalent(d,r);assert.equal(g.runs.length,8);
 assertEquivalent(d,r,{x0:1,y0:1,x1:4,y1:3});
 assertEquivalent(d,r,whole,{plan:true});
});

test('viewport cropping neither creates an interior boundary nor drops a raised north-edge perimeter',()=>{
 const d=doc(),r=region(0,0,9,9),cache=createSelectionGeometryCache(),g=cache.geometry(d,r,{revision:1});
 assert.equal(cache.view(g,{x0:3,y0:3,x1:6,y1:6}).segments.length,0);
 d.cells['0,0']={level:8};
 const {actual}=assertEquivalent(d,r,{x0:0,y0:0,x1:2,y1:2});
 assert(actual.segments.some(p=>p[1]===-384),'A boundary above world row zero must remain visible');
});

test('a revision hint avoids per-tile work on warm frames and still refreshes raises, lowering and replaced terrain',()=>{
 let reads=0;const cache=createSelectionGeometryCache({levelAt:(d,x,y,key)=>{reads++;return d.cells[key]?.level??0;}}),d=doc(),r=region(0,0,255,191),first=cache.geometry(d,r,{revision:1});
 assert.equal(reads,49152);assert.equal(first.runs.length,192);assert.equal(first.perimeter.length,4);
 assert.strictEqual(cache.geometry(d,r,{revision:1}),first);assert.equal(reads,49152);
 const view=cache.view(first,whole);assert.strictEqual(cache.view(first,whole),view);
 cache.view(first,{x0:120,y0:80,x1:130,y1:90});assert.equal(reads,49152,'Panning must not re-read terrain');
 d.cells['10,10']={level:3};const raised=cache.geometry(d,r,{revision:2});assert.notStrictEqual(raised,first);assert(raised.runs.some(row=>row.y===10&&row.level===3));
 d.cells['10,10'].level=1;const lowered=cache.geometry(d,r,{revision:3});assert(lowered.runs.some(row=>row.y===10&&row.level===1));
 d.cells={};const replaced=cache.geometry(d,r,{revision:3});assert.equal(replaced.runs.length,192);
});

test('calls without a revision detect direct in-place terrain edits and planning does not read terrain',()=>{
 let reads=0;const cache=createSelectionGeometryCache({levelAt:(d,x,y,key)=>{reads++;return d.cells[key]?.level??0;}}),d=doc(),r=region(0,0,1,1),first=cache.geometry(d,r);
 assert.strictEqual(cache.geometry(d,r),first);assert.equal(reads,8);
 d.cells['0,0']={level:2};const raised=cache.geometry(d,r);assert.notStrictEqual(raised,first);
 d.cells['0,0'].level=4;assert.notStrictEqual(cache.geometry(d,r),raised);
 const before=reads,plan=cache.geometry(d,r,{plan:true});assert.equal(reads,before);assert(plan.runs.every(row=>row.level===0));
 assert.strictEqual(cache.geometry(doc(),r,{plan:true}),plan,'Planning projection is shared across documents');
});

test('height-selection region copies reuse immutable masks and each document keeps its own elevation',()=>{
 const cache=createSelectionGeometryCache(),cells=['0,0','1,0','1,1'],r=region(0,0,1,1,cells),d=doc(),other=doc();other.cells['1,1']={level:5};
 const first=cache.geometry(d,r,{revision:1});assert.strictEqual(cache.geometry(d,{...r,level:1},{revision:1}),first);
 const second=cache.geometry(other,r,{revision:1});assert.notStrictEqual(second,first);assert(second.runs.some(row=>row.level===5));
 assert.strictEqual(cache.geometry(d,r,{revision:1}),first);
});

test('selection renderer draws row runs and reuses a cached Path2D across unchanged frames',()=>{
 const NativePath=globalThis.Path2D;let paths=0,fills=0,strokes=0;
 globalThis.Path2D=class{constructor(){paths++;}moveTo(){}lineTo(){}};
 const c={save(){},restore(){},fillRect(){fills++;},stroke(){strokes++;}},d=doc(),r=region(0,0,255,191);
 try{
  drawSelection(c,d,r,{revision:1});drawSelection(c,d,r,{revision:1});
  assert.equal(paths,1);assert.equal(fills,384);assert.equal(strokes,2);
  drawSelection(c,d,r,{revision:1,bounds:{x0:5,y0:5,x1:15,y1:15}});assert.equal(paths,2);assert.equal(fills,394);
 }finally{globalThis.Path2D=NativePath;}
});
