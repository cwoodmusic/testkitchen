import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeMask,decodeMask,validMask,maskRects,maskEdges,maskContains,MASK_GRID} from './organic-mask.mjs';
import {blank,parseProject,height,surfaceAt,blocked,History} from './model.mjs';
import {insideCurve,clipCurves,frontEdge} from './round-geometry.mjs';
import {planLandFill} from '../builder/land-fill.mjs';
import {planWaterFill} from '../builder/water-fill.mjs';
import {waterRimSegments} from './water-rim.mjs';

const values=()=>Uint8Array.from({length:256},(_,i)=>Math.floor(i/16)<6+i%16%5?1:0);
const contour=(bits,kind='height')=>({kind,corner:'nw',cx:704,cy:704,r:64,underX:9,underY:10,under:{surface:'water',level:kind==='height'?1:0},mask:encodeMask(bits)});
const contains=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;

test('portable organic masks keep all256bits and reject malformed or noncanonical encodings',()=>{
 const bits=values(),mask=encodeMask(bits);assert.equal(mask.length,44);assert(validMask(mask));assert.deepEqual(decodeMask(mask),bits);const edited=decodeMask(mask);edited[0]^=1;assert.deepEqual(decodeMask(mask),bits);
 assert.equal(atob(encodeMask(Uint8Array.from({length:256},(_,i)=>i===0?1:0))).charCodeAt(0),128);
 for(const invalid of ['',mask.slice(1),mask.replace('=','!'),mask+'=',null,4])assert.equal(validMask(invalid),false);
 assert.throws(()=>encodeMask(new Uint8Array(255)),/256/);
});

test('native-ground clipping, visible material and physical height share exactly the same contour samples',()=>{
 const bits=values(),q=contour(bits),d=blank();d.cells['10,10']={surface:'grass',level:3,curves:[q]};
 const rectangles=[];const c={beginPath(){},rect(x,y,w,h){rectangles.push({x,y,w,h});},clip(){}};clipCurves(c,d.cells['10,10'],10,10,0);
 const actual=rectangles;assert.deepEqual(actual,maskRects(q));
 for(let y=0;y<MASK_GRID;y++)for(let x=0;x<MASK_GRID;x++){
  const X=642+x*4,Y=642+y*4,inside=!!bits[y*16+x];
  assert.equal(actual.some(r=>contains(r,X,Y)),inside);assert.equal(insideCurve(q,X,Y),inside);assert.equal(maskContains(q,X,Y),inside);
  assert.equal(height(d,X,Y),inside?144:48);assert.equal(surfaceAt(d,X,Y),inside?'grass':'water');assert.equal(blocked(d,X,Y,new Map()),!inside);
 }
 for(let x=0;x<16;x++){
  const X=642+x*4,front=frontEdge(d.cells['10,10'],X,10);assert.equal(front,640+(6+x%5)*4);
  assert.equal(height(d,X,front-.01),144);assert.equal(height(d,X,front+.01),48);
 }
});

test('native contour clips keep tile-edge texture coverage and snap only the actual interior contour',()=>{
 const q=contour(values()),rectangles=[],t={a:.4,b:0,c:0,d:.4,e:-254.2,f:-239.7};
 const c={getTransform:()=>t,beginPath(){},rect(x,y,w,h){rectangles.push({x,y,w,h});},clip(){}};
 clipCurves(c,{curves:[q]},10,10,48);
 const raw=maskRects(q,48);assert.equal(rectangles.length,raw.length);
 const integer=n=>Math.abs(n-Math.round(n))<1e-8;
 for(let i=0;i<raw.length;i++){
  const r=raw[i],a=rectangles[i];
  if(r.x===640)assert(a.x*t.a+t.e<r.x*t.a+t.e-.99);else assert(integer(a.x*t.a+t.e));
  if(r.x+r.w===704)assert((a.x+a.w)*t.a+t.e>(r.x+r.w)*t.a+t.e+.99);else assert(integer((a.x+a.w)*t.a+t.e));
  if(r.y===592)assert(a.y*t.d+t.f<r.y*t.d+t.f-.99);else assert(integer(a.y*t.d+t.f));
  if(r.y+r.h===656)assert((a.y+a.h)*t.d+t.f>(r.y+r.h)*t.d+t.f+.99);else assert(integer((a.y+a.h)*t.d+t.f));
 }
});

test('organic height changes block cliff crossing even when both foreground and receiving ground are dry',()=>{
 const q=contour(values()),d=blank();q.under.surface='sand';d.cells['10,10']={surface:'grass',level:3,curves:[q]};
 const x=642,front=frontEdge(d.cells['10,10'],x,10);
 assert.equal(blocked(d,x,front+1,new Map()),false);assert.equal(blocked(d,x,front+1,new Map(),{x,y:front-1}),true);
});

test('organic outlines contain the actual irregular edge without outlining every terrain tile',()=>{
 const q=contour(values()),edges=maskEdges(q);assert(edges.length>16);
 for(const[[x,y],[xx,yy]]of edges){assert(x>=640&&x<=704&&y>=640&&y<=704);assert(Math.hypot(xx-x,yy-y)===4);assert(!(x===xx&&(x===640||x===704)));assert(!(y===yy&&(y===640||y===704)));}
 const full=contour(new Uint8Array(256).fill(1));assert.equal(maskEdges(full).length,0);assert(maskRects(full).every(r=>r.w===64));
});

test('water shading follows the true organic shoreline and never leaves a straight tile-boundary seam',()=>{
 const d=blank(),bits=new Uint8Array(256);for(let y=0;y<8;y++)bits.fill(1,y*16,(y+1)*16);
 d.cells['10,10']={surface:'grass',level:2,curves:[contour(bits)]};d.cells['10,11']={surface:'water',level:1};
 assert.equal(waterRimSegments(d,10,11).some(s=>s.y===704&&s.dy===0),false);
 for(let x=0;x<8;x++)bits[15*16+x]=1;d.cells['10,10'].curves[0].mask=encodeMask(bits);
 const edge=waterRimSegments(d,10,11).filter(s=>s.y===704&&s.dy===0);assert.deepEqual(edge,[{x:640,y:704,dx:32,dy:0}]);
 const normal=blank();normal.cells['10,10']={surface:'water',level:0};assert.equal(waterRimSegments(normal,10,10).length,4);
});

test('land and water buckets honor organic shore materials and survive portable save and undo',()=>{
 const bits=values(),q=contour(bits,'surface'),d=blank();d.cells['10,10']={surface:'grass',level:0,curves:[q]};
 for(const[x,y]of [[9,10],[11,10],[10,9],[10,11]])d.cells[`${x},${y}`]={surface:'grass',level:1};
 d.edges['w:8000.25:6400.5:64:0']={style:'music-square',gate:false,open:false,wallScale:1};
 const original=JSON.stringify(d),history=new History();history.record(d);
 Object.assign(d.cells,Object.fromEntries(planLandFill(d,{x:642,y:702},{surface:'sand'}).edits));
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)assert.equal(surfaceAt(d,642+x*4,642+y*4),bits[y*16+x]?'grass':'sand');
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);assert.equal(JSON.stringify(history.back(d)),original);
 Object.assign(d.cells,Object.fromEntries(planWaterFill(d,{x:642,y:642}).edits));assert.equal(d.cells['10,10'].surface,'water');assert.equal(d.cells['10,10'].curves,undefined);
});

test('saved masks require a valid64pxowner cell and cannot smuggle unsupported contour data',()=>{
 const d=blank();d.cells['10,10']={surface:'grass',level:2,curves:[contour(values())]};assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 for(const change of [{mask:'A'.repeat(44)},{r:32},{corner:'se'},{cx:705},{cy:640},{concave:true}]){
  const invalid=structuredClone(d);Object.assign(invalid.cells['10,10'].curves[0],change);assert.throws(()=>parseProject(JSON.stringify(invalid),new Set()),/Invalid terrain curve/);
 }
});
