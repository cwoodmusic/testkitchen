import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,parseProject,History,MAX_PROJECT_LENGTH} from '../world/model.mjs';
import {readPaint,decodePaint,encodePaint,materialKey,validPaint,PAINT_GRID} from '../world/ground-paint.mjs';
import {paintGround,brushPoints} from './ground-brush.mjs';
import {saveProject} from '../world/storage.mjs';
const apply=(d,p,options)=>{const result=paintGround(d,p,options);for(const[k,a]of result.edits)d.cells[k]=a;return result;};
function sample(d,x,y,surface){const a=cell(d,Math.floor(x/64),Math.floor(y/64)),paint=readPaint(a),n=(Math.floor(y%64/4)*PAINT_GRID+Math.floor(x%64/4))*paint.materials.length;return paint.materials.reduce((sum,m,i)=>sum+(m.surface===surface?paint.weights[n+i]:0),0);}
function normalized(d){for(const a of Object.values(d.cells))if(a.paint)assert(validPaint(a.paint,new Set()));}

test('round ground dabs follow their actual center and leave circular corners untouched',()=>{
 const d=blank();apply(d,{x:128,y:128},{size:96,hardness:1,opacity:1,surface:'dirt'});
 assert.equal(sample(d,130,130,'dirt'),255);assert.equal(sample(d,166,166,'dirt'),0);assert.equal(sample(d,174,130,'dirt'),255);assert.equal(sample(d,178,130,'dirt'),0);
 const shifted=blank();apply(shifted,{x:147,y:151},{size:24,hardness:1,opacity:1,surface:'sand'});assert.equal(sample(shifted,146,150,'sand'),255);assert.equal(sample(shifted,130,130,'sand'),0);normalized(d);
});
test('softness feathers material coverage and repeated low opacity dabs build naturally',()=>{
 const d=blank(),options={size:96,hardness:0,opacity:.5,surface:'dirt'};apply(d,{x:128,y:128},options);
 const center=sample(d,130,130,'dirt'),edge=sample(d,170,130,'dirt');assert(center>115&&center<130);assert(edge>0&&edge<center);assert.equal(sample(d,178,130,'dirt'),0);
 apply(d,{x:128,y:128},options);assert(sample(d,130,130,'dirt')>center);assert(sample(d,130,130,'dirt')<255);normalized(d);
 assert.equal(paintGround(blank(),{x:128,y:128},{surface:'grass'}).changed,false);
});
test('material blending softens legacy seams on both sides without changing terrain or collision surfaces',()=>{
 const d=blank();for(let y=0;y<4;y++){d.cells[`1,${y}`]={surface:'dirt',level:2};d.cells[`2,${y}`]={surface:'sand',level:2};}
 apply(d,{x:128,y:96},{mode:'blend',size:96,hardness:1,opacity:1});
 assert(sample(d,126,98,'sand')>0);assert(sample(d,130,98,'dirt')>0);assert.equal(d.cells['1,1'].surface,'dirt');assert.equal(d.cells['2,1'].surface,'sand');assert.equal(d.cells['1,1'].level,2);assert(sample(d,86,98,'sand')===0);normalized(d);
});
test('painting and blending protect water, bridges, stairs and elevation boundaries',()=>{
 const d=blank();d.cells['1,1']={surface:'water',level:0};d.cells['2,1']={surface:'cobble',level:0,stairs:'north'};d.cells['3,1']={surface:'water',level:0,bridge:'ew'};
 const before=JSON.stringify(d.cells);for(const mode of ['paint','blend'])for(const x of [96,160,224])assert.equal(paintGround(d,{x,y:96},{size:32,hardness:1,opacity:1,surface:'sand',mode}).changed,false);assert.equal(JSON.stringify(d.cells),before);
 const cliff=blank();for(let y=0;y<4;y++){cliff.cells[`1,${y}`]={surface:'dirt',level:0};cliff.cells[`2,${y}`]={surface:'sand',level:2};}
 assert.equal(paintGround(cliff,{x:128,y:96},{mode:'blend',size:96,hardness:1,opacity:1}).changed,false);
});
test('paint remains portable, undoable and normalized through repeated material edits',()=>{
 const d=blank(),history=new History();d.cells['1,1']={surface:'grass',level:3,finish:'stone'};history.record(d);
 apply(d,{x:96,y:96},{size:48,hardness:.3,opacity:.7,surface:'dirt'});apply(d,{x:104,y:96},{size:48,hardness:.3,opacity:.8,surface:'sand'});normalized(d);
 assert.equal(d.cells['1,1'].level,3);assert.equal(d.cells['1,1'].finish,'stone');assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 const old=history.back(d);assert.equal(old.cells['1,1'].paint,undefined);assert.deepEqual(history.forward(old),d);
});
test('weight encoding merges duplicates, prunes empty channels and rejects malformed saved paint',()=>{
 const materials=[{surface:'grass'},{surface:'dirt'},{surface:'grass'},{surface:'sand'}],weights=new Float64Array(256*4);for(let i=0;i<256;i++){weights[i*4]=10;weights[i*4+1]=20;weights[i*4+2]=10;}
 const paint=encodePaint(materials,weights);assert.deepEqual(paint.materials.map(materialKey),['grass','dirt']);assert(validPaint(paint,new Set()));const decoded=decodePaint(paint);assert.equal(decoded.weights[0]+decoded.weights[1],255);
 const d=blank();d.cells['1,1']={surface:'grass',level:0,paint};assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 for(const invalid of [{...paint,weights:'bad'}, {...paint,materials:[{surface:'water'}, {surface:'dirt'}]}, {...paint,materials:[{surface:'grass'},{surface:'grass'}]}, {...paint,materials:[{surface:'cobble',paving:'missing'},{surface:'dirt'}]}, {...paint,weights:btoa('\0'.repeat(512))}]){d.cells['1,1'].paint=invalid;assert.throws(()=>parseProject(JSON.stringify(d),new Set()),/Invalid ground paint/);}
});
test('interpolated brush points cover long pointer moves without gaps and end at the cursor',()=>{
 const points=brushPoints({x:0,y:0},{x:1000,y:400},192);assert.deepEqual(points.at(-1),{x:1000,y:400});let last={x:0,y:0};for(const p of points){assert(Math.hypot(p.x-last.x,p.y-last.y)<=24);last=p;}assert.deepEqual(brushPoints(null,{x:10,y:20}),[{x:10,y:20}]);assert.deepEqual(brushPoints({x:1,y:1},{x:1,y:1}),[]);
});

test('larger painted projects reload while oversized JSON is rejected before autosave writes',async()=>{
 const d=blank();apply(d,{x:128,y:128},{size:96,hardness:.5,opacity:.8,surface:'dirt'});
 const text=JSON.stringify(d)+' '.repeat(12*1024*1024);assert(text.length>12000000);assert.deepEqual(parseProject(text,new Set()),d);assert.equal(MAX_PROJECT_LENGTH,64*1024*1024);
 assert.throws(()=>parseProject(' '.repeat(MAX_PROJECT_LENGTH+1),new Set()),/Project exceeds 64 MiB/);
 let writes=0;const database={transaction(){writes++;throw Error('Oversized JSON reached IndexedDB');}};
 await assert.rejects(Promise.resolve().then(()=>saveProject(database,{...d,padding:'x'.repeat(MAX_PROJECT_LENGTH)})),/Project exceeds 64 MiB/);assert.equal(writes,0);
});
