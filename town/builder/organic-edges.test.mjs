import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,key,cell,height,surfaceAt,blocked,parseProject,History} from '../world/model.mjs';
import {decodeMask,validMask} from '../world/organic-mask.mjs';
import {roundTerrain} from './round-terrain.mjs';
import {planOrganicEdges} from './organic-edges.mjs';
import {readPaint,encodePaint,materialKey} from '../world/ground-paint.mjs';
import {roundedUnder,curveUnder} from '../world/round-geometry.mjs';

const apply=(doc,plan)=>Object.assign(doc.cells,Object.fromEntries(plan.edits));
function beach({high=0,low=0}={}){
 const d=blank();for(let y=86;y<107;y++)for(let x=122;x<135;x++)d.cells[key(x,y)]={surface:x<128?'sand':'water',level:x<128?high:low};return d;
}
function profile(d){const points=[];for(let y=5922;y<6370;y+=8){let edge=8100;for(let x=8102;x<8300;x+=4)if(surfaceAt(d,x,y)==='sand')edge=x;points.push(edge);}return points;}

test('painting a straight coast produces a deterministic irregular contour rather than a circular corner stamp',()=>{
 const d=beach(),before=JSON.stringify(d),p={x:8192,y:6144},options={size:512,strength:1},a=planOrganicEdges(d,p,options),b=planOrganicEdges(d,p,options);
 assert(a.count>0);assert.deepEqual(a,b);assert.equal(JSON.stringify(d),before);apply(d,a);
 const edge=profile(d);assert(new Set(edge).size>=4);assert(edge.some((x,i)=>x!==edge[edge.length-1-i]),'the shore follows world noise rather than a symmetric brush circle');
 for(const[,next]of a.edits)for(const q of next.curves||[]){assert(validMask(q.mask));assert.equal(q.r,64);assert.equal(q.concave,undefined);}
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('flat interiors, zero strength and invalid coordinates make no terrain edits',()=>{
 const d=blank();assert.equal(planOrganicEdges(d,{x:8192,y:6144},{size:512,strength:1}).edits.length,0);
 const shore=beach();assert.equal(planOrganicEdges(shore,{x:8192,y:6144},{strength:0}).edits.length,0);
 assert.equal(planOrganicEdges(shore,{x:NaN,y:6144}).edits.length,0);assert.equal(planOrganicEdges(shore,{x:-2000,y:-2000}).edits.length,0);
});

test('organic edges see filled or painted material rather than its old grass base',()=>{
 const plain=blank(),painted=blank();
 for(let y=90;y<=102;y++)for(let x=122;x<=133;x++){
  plain.cells[key(x,y)]={surface:x<128?'dirt':'grass',level:0};
  painted.cells[key(x,y)]=x<128?{surface:'grass',level:0,paint:encodePaint([{surface:'dirt'}],new Uint8Array(256).fill(255))}:{surface:'grass',level:0};
 }
 const p={x:8192,y:6144},options={size:384,strength:1},a=planOrganicEdges(plain,p,options),b=planOrganicEdges(painted,p,options);
 assert(a.count>0);assert.equal(b.count,a.count);assert.deepEqual(b.edits,a.edits);
 apply(painted,b);assert.deepEqual(parseProject(JSON.stringify(painted),new Set()),painted);
});

test('shaping a blended material edge preserves unchanged samples outside the brush',()=>{
 const d=blank(),materials=[{surface:'grass'},{surface:'dirt'}],weights=new Float64Array(512);
 for(let i=0;i<256;i++){weights[i*2]=i%16<8?45:220;weights[i*2+1]=255-weights[i*2];}
 for(let y=94;y<=98;y++)for(let x=126;x<=130;x++)d.cells[key(x,y)]={surface:x<128?'dirt':'grass',level:1};
 d.cells['128,96']={surface:'grass',level:1,paint:encodePaint(materials,weights)};
 const at=(doc,x,y)=>{const a=cell(doc,Math.floor(x/64),Math.floor(y/64)),q=roundedUnder(doc,a,x,y),f=readPaint(q?curveUnder(doc,q):a),i=(Math.floor(y%64/4)*16+Math.floor(x%64/4))*f.materials.length;return Object.fromEntries(f.materials.map((m,j)=>[materialKey(m),f.weights[i+j]]).filter(([,v])=>v));};
 const before=structuredClone(d),p={x:8224,y:6176},size=64,result=planOrganicEdges(d,p,{size,strength:1});assert(result.count>0);apply(d,result);
 for(let y=6146;y<6208;y+=4)for(let x=8194;x<8256;x+=4)if(Math.hypot(x-p.x,y-p.y)>=size/2)assert.deepEqual(at(d,x,y),at(before,x,y));
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('a dab changes only its painted boundary band, leaving the rest of the beach untouched',()=>{
 const d=beach(),p={x:8192,y:6144},size=192,samples=[];
 for(let y=5986;y<6304;y+=4)for(let x=8066;x<8320;x+=4)samples.push({x,y,surface:surfaceAt(d,x,y),z:height(d,x,y)});
 apply(d,planOrganicEdges(d,p,{size,strength:1}));let changed=0;
 for(const old of samples){const surface=surfaceAt(d,old.x,old.y);if(surface!==old.surface){changed++;assert(Math.hypot(old.x-p.x,old.y-p.y)<size/2);assert(Math.abs(old.x-8192)<=12,'a single dab cannot leap away from the old coast');}else if(Math.hypot(old.x-p.x,old.y-p.y)>=size/2)assert.equal(height(d,old.x,old.y),old.z);}
 assert(changed>0);
});

test('organic cliff silhouettes, material drawing and walking collision use the same physical contour',()=>{
 const d=beach({high:3,low:1}),plan=planOrganicEdges(d,{x:8192,y:6144},{size:384,strength:1});assert(plan.count>0);apply(d,plan);
 for(const[k,a]of plan.edits){const[x,y]=k.split(',').map(Number);for(const q of a.curves||[]){const mask=decodeMask(q.mask);for(let i=0;i<mask.length;i++){const X=x*64+(i%16)*4+2,Y=y*64+Math.floor(i/16)*4+2,z=mask[i]?a.level:q.under.level,surface=mask[i]?a.surface:q.under.surface;assert.equal(height(d,X,Y),z*48);assert.equal(surfaceAt(d,X,Y),surface);assert.equal(blocked(d,X,Y,new Map()),surface==='water');}}}
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('existing round cliffs can be brushed into finer natural contours without changing floor heights',()=>{
 const d=blank();for(let y=90;y<101;y++)for(let x=124;x<133;x++)d.cells[key(x,y)]={surface:'sand',level:2};
 apply(d,roundTerrain(d,{x:7968,y:5792},5));const result=planOrganicEdges(d,{x:7968,y:5792},{size:256,strength:1});assert(result.count>0);apply(d,result);
 for(let y=5670;y<5940;y+=4)for(let x=7846;x<8110;x+=4)assert([0,96].includes(height(d,x,y)));
 assert(result.edits.some(([,a])=>a.curves?.some(q=>q.mask)));assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('editing a donor does not change a disconnected lifted cliff elsewhere in the map',()=>{
 const d=beach(),p={x:8192,y:6144},options={size:384,strength:1},preview=planOrganicEdges(d,p,options),changed=preview.edits.find(([k,a])=>a.surface!==cell(d,...k.split(',').map(Number)).surface||a.level!==cell(d,...k.split(',').map(Number)).level);assert(changed);
 const [underX,underY]=changed[0].split(',').map(Number),old=cell(d,underX,underY);
 d.cells['100,100']={surface:'grass',level:4,curves:[{kind:'height',corner:'nw',cx:6464,cy:6464,r:64,underX,underY,lift:1}]};const surface=surfaceAt(d,6401,6401),z=height(d,6401,6401);
 apply(d,planOrganicEdges(d,p,options));assert.equal(surfaceAt(d,6401,6401),surface);assert.equal(height(d,6401,6401),z);assert.equal(d.cells['100,100'].curves[0].under.level,old.level);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('bridges, stairs, placed objects, fences and player spawn survive an edge stroke',()=>{
 const d=beach();d.cells['128,96']={surface:'water',level:0,bridge:'ns',finish:'wood'};d.cells['127,96']={surface:'sand',level:0,stairs:'east',finish:'stone'};
 d.objects=[{id:'bench',asset:'bench',x:8128,y:6000,scale:1,rotation:0,layer:'objects',collision:true}];d.edges={'h:127:95':{style:'wood',gate:false,open:false}};
 const bridge=JSON.stringify(d.cells['128,96']),stairs=JSON.stringify(d.cells['127,96']),objects=JSON.stringify(d.objects),edges=JSON.stringify(d.edges),spawn=JSON.stringify(d.spawn);
 apply(d,planOrganicEdges(d,{x:8192,y:6144},{size:384,strength:1}));assert.equal(JSON.stringify(d.cells['128,96']),bridge);assert.equal(JSON.stringify(d.cells['127,96']),stairs);assert.equal(JSON.stringify(d.objects),objects);assert.equal(JSON.stringify(d.edges),edges);assert.equal(JSON.stringify(d.spawn),spawn);
});

test('a complete organic stroke is portable and reversible with the existing project history',()=>{
 const d=beach(),history=new History(),before=JSON.stringify(d);history.record(d);
 for(let y=6000;y<=6272;y+=24)apply(d,planOrganicEdges(d,{x:8192,y},{size:192,strength:.5}));
 assert.notEqual(JSON.stringify(d),before);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);const restored=history.back(d);assert.equal(JSON.stringify(restored),before);assert.deepEqual(history.forward(restored),d);
});

test('repeated strokes on a diagonal tall cliff cannot detach tiny land scraps',()=>{
 const d=blank();for(let y=90;y<110;y++)for(let x=120;x<136;x++)d.cells[key(x,y)]={surface:x+y<225?'grass':'water',level:x+y<225?8:0};
 for(let i=0;i<3;i++)apply(d,planOrganicEdges(d,{x:8110+i*8,y:6230-i*8+(i%4-1)*4},{size:192,strength:1}));
 const size=96,samples=new Uint8Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++)samples[y*size+x]=height(d,8100+x*4+2,6052+y*4+2)>0?1:0;
 let components=0;
 for(let i=0;i<samples.length;i++)if(samples[i]){
  components++;const queue=[i];samples[i]=0;
  for(let head=0;head<queue.length;head++){const index=queue[head],x=index%size,y=Math.floor(index/size);for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(X>=0&&Y>=0&&X<size&&Y<size&&samples[Y*size+X]){samples[Y*size+X]=0;queue.push(Y*size+X);}}
 }
 assert.equal(components,1,'A few brush dabs must not turn four-pixel scraps into detached384px cliff towers');
});
