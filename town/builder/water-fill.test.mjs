import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,key,parseProject,height,surfaceAt,History,COLS,ROWS} from '../world/model.mjs';
import {planWaterFill} from './water-fill.mjs';
import {roundTerrain} from './round-terrain.mjs';
const apply=(d,result)=>Object.assign(d.cells,Object.fromEntries(result.edits));
function basin(){const d=blank();for(let y=4;y<=10;y++)for(let x=4;x<=10;x++)d.cells[key(x,y)]={surface:'grass',level:x===4||y===4||x===10||y===10?2:1};return d;}

test('one click fills the connected height through mixed materials and existing water without crossing its banks',()=>{
 const d=basin();d.cells['5,5'].surface='asphalt';d.cells['6,5'].surface='water';d.cells['7,5'].surface='cobble';d.cells['7,5'].paving='music-square';
 d.cells['14,14']={surface:'grass',level:1};const before=JSON.stringify(d),result=planWaterFill(d,{x:352,y:352});
 assert.equal(JSON.stringify(d),before);assert.equal(result.level,1);assert.equal(result.count,24);apply(d,result);
 for(let y=5;y<10;y++)for(let x=5;x<10;x++)assert.equal(cell(d,x,y).surface,'water');
 assert.equal(cell(d,4,5).surface,'grass');assert.equal(cell(d,14,14).surface,'grass');assert.equal(cell(d,3,5).surface,'grass');assert.equal(cell(d,7,5).paving,undefined);
 assert.equal(planWaterFill(d,{x:352,y:352}).edits.length,0);
});

test('diagonal islands do not join and a stair strip remains intact while a bridge gains water beneath it',()=>{
 const d=basin();for(let y=5;y<10;y++)d.cells[key(7,y)]={surface:'wood',level:1,stairs:'north',stairBase:1,stairRise:1,stairStart:0,stairEnd:1};
 d.cells['6,6']={surface:'wood',level:1,bridge:'ns',finish:'stone'};const staircase=JSON.stringify(d.cells['7,6']);
 const result=planWaterFill(d,{x:352,y:416});apply(d,result);assert.equal(cell(d,6,6).surface,'water');assert.equal(cell(d,6,6).bridge,'ns');assert.equal(cell(d,6,6).finish,'stone');assert.equal(JSON.stringify(d.cells['7,6']),staircase);assert.equal(cell(d,8,6).surface,'grass');
 assert.equal(planWaterFill(d,{x:480,y:416}).edits.length,0);
 const diagonal=blank();diagonal.cells['5,5']={surface:'grass',level:3};diagonal.cells['6,6']={surface:'grass',level:3};apply(diagonal,planWaterFill(diagonal,{x:352,y:352}));assert.equal(cell(diagonal,6,6).surface,'grass');
});

test('whole implicit flat maps fill within bounds and support a real project and undo round trip',()=>{
 const d=blank(),history=new History(),before=JSON.stringify(d),result=planWaterFill(d,{x:8192,y:6144});assert.equal(result.count,COLS*ROWS);assert.equal(Object.keys(d.cells).length,0);
 history.record(d);apply(d,result);assert.equal(Object.keys(d.cells).length,COLS*ROWS);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);assert.equal(JSON.stringify(history.back(d)),before);assert.equal(planWaterFill(d,{x:-1,y:100}).count,0);
});

test('filling a rounded upper plateau preserves all physical heights and leaves its lower floor dry',()=>{
 const d=blank();for(let y=5;y<12;y++)for(let x=5;x<12;x++)d.cells[key(x,y)]={surface:'grass',level:2};apply(d,roundTerrain(d,{x:352,y:352},5));
 const points=[];for(let y=305;y<800;y+=11)for(let x=305;x<800;x+=11)points.push({x,y,z:height(d,x,y)});
 const result=planWaterFill(d,{x:600,y:600});assert.equal(result.level,2);apply(d,result);
 for(const p of points){assert.equal(height(d,p.x,p.y),p.z);if(p.z===96)assert.equal(surfaceAt(d,p.x,p.y),'water');else assert.equal(surfaceAt(d,p.x,p.y),'grass');}
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('clicking a rounded lower cutout fills its actual level and keeps the high cap and its height unchanged',()=>{
 const d=blank();for(let y=5;y<12;y++)for(let x=5;x<12;x++)d.cells[key(x,y)]={surface:'grass',level:2};apply(d,roundTerrain(d,{x:352,y:352},5));
 assert.equal(height(d,321,321),0);assert.equal(cell(d,5,5).level,2);const result=planWaterFill(d,{x:321,y:321});assert.equal(result.level,0);apply(d,result);
 assert.equal(surfaceAt(d,321,321),'water');assert.equal(height(d,321,321),0);assert.equal(surfaceAt(d,600,600),'grass');assert.equal(height(d,600,600),96);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('changed donors cannot leak water into a disconnected or lifted rounded floor',()=>{
 const d=basin();d.cells['20,20']={surface:'grass',level:4,curves:[{kind:'height',corner:'nw',cx:1344,cy:1344,r:64,underX:5,underY:5,lift:1}]};
 const before=height(d,1281,1281);assert.equal(before,96);apply(d,planWaterFill(d,{x:352,y:352}));
 assert.equal(height(d,1281,1281),before);assert.equal(surfaceAt(d,1281,1281),'grass');assert.equal(d.cells['20,20'].curves[0].under.level,1);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('same-height painted corner masks become a continuous water surface while world objects stay untouched',()=>{
 const d=basin();d.cells['7,7'].surface='sidewalk';apply(d,roundTerrain(d,{x:480,y:480},1));d.edges['h:5:5']={style:'iron',gate:false,open:false};d.objects.push({id:'p',asset:'bench',x:352,y:352,scale:1,rotation:0,layer:'objects',collision:true});const objects=JSON.stringify(d.objects),edges=JSON.stringify(d.edges),spawn=JSON.stringify(d.spawn);
 apply(d,planWaterFill(d,{x:480,y:480}));assert.equal(d.cells['7,7'].surface,'water');assert.equal(d.cells['7,7'].curves,undefined);assert.equal(JSON.stringify(d.objects),objects);assert.equal(JSON.stringify(d.edges),edges);assert.equal(JSON.stringify(d.spawn),spawn);
});

test('separate lower corners inside one terrain tile cannot connect through its raised center',()=>{
 const d=blank();d.cells['6,7']={surface:'grass',level:1};d.cells['8,7']={surface:'grass',level:1};
 d.cells['7,7']={surface:'grass',level:2,curves:[{kind:'height',corner:'nw',cx:512,cy:512,r:64,underX:6,underY:7},{kind:'height',corner:'se',cx:448,cy:448,r:64,underX:8,underY:7}]};
 apply(d,planWaterFill(d,{x:416,y:480}));assert.equal(surfaceAt(d,449,449),'water');assert.equal(surfaceAt(d,511,511),'grass');assert.equal(cell(d,8,7).surface,'grass');assert.equal(height(d,480,480),96);
});
