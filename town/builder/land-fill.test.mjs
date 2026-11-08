import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,key,height,surfaceAt,blocked,parseProject,History,COLS,ROWS} from '../world/model.mjs';
import {groundMaterials} from '../world/ground-paint.mjs';
import {planLandFill} from './land-fill.mjs';
import {planWaterFill} from './water-fill.mjs';
import {roundTerrain} from './round-terrain.mjs';
const apply=(d,result)=>Object.assign(d.cells,Object.fromEntries(result.edits));
function pond(){const d=blank();for(let y=5;y<=9;y++)for(let x=5;x<=9;x++)d.cells[key(x,y)]={surface:'water',level:1};return d;}

test('water remains water when removing a surface mask whose dry cap is fully hidden',()=>{
 const d=blank();for(const [x,y]of [[9,10],[11,10],[10,9],[10,11]])d.cells[key(x,y)]={surface:'grass',level:1};
 d.cells['10,10']={surface:'grass',level:0,curves:[{kind:'surface',corner:'se',cx:640,cy:640,r:128,concave:true,underX:11,underY:11,under:{surface:'water',level:0}}]};
 assert.equal(surfaceAt(d,672,672),'water');apply(d,planWaterFill(d,{x:672,y:672}));
 assert.equal(surfaceAt(d,672,672),'water');assert.equal(d.cells['10,10'].surface,'water');assert.equal(d.cells['10,10'].curves,undefined);
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('every ground material can reclaim connected water with a portable, collision-correct result',()=>{
 for(const surface of groundMaterials){
  const d=pond(),before=JSON.stringify(d),result=planLandFill(d,{x:352,y:352},{surface,paving:'music-square'});
  assert.equal(JSON.stringify(d),before);assert.equal(result.level,1);assert.equal(result.count,25);apply(d,result);
  for(let y=5;y<=9;y++)for(let x=5;x<=9;x++){const a=cell(d,x,y);assert.equal(a.surface,surface);assert.equal(a.level,1);assert.equal(a.paving,surface==='cobble'?'music-square':undefined);assert.equal(a.paint,undefined);}
  assert.equal(blocked(d,352,352,new Map()),false);assert.deepEqual(parseProject(JSON.stringify(d),new Set(['music-square'])),d);
 }
});

test('dry shorelines, another height, and diagonal contact keep other water bodies separate',()=>{
 const d=pond();for(let y=5;y<=9;y++)d.cells[key(7,y)]={surface:'grass',level:1};
 d.cells['6,10']={surface:'water',level:0};d.cells['4,4']={surface:'water',level:1};
 apply(d,planLandFill(d,{x:352,y:352},{surface:'dirt'}));
 assert.equal(cell(d,6,9).surface,'dirt');assert.equal(cell(d,7,7).surface,'grass');assert.equal(cell(d,8,7).surface,'water');assert.equal(cell(d,6,10).surface,'water');assert.equal(cell(d,4,4).surface,'water');
});

test('bridges retain their finish and stairs remain unchanged while reclaiming water',()=>{
 const d=pond();d.cells['6,6']={surface:'water',level:1,bridge:'ns',finish:'wood'};
 for(let y=5;y<=9;y++)d.cells[key(7,y)]={surface:'water',level:1,stairs:'north',stairBase:1,stairRise:1,stairStart:0,stairEnd:1,finish:'stone'};
 const stairs=JSON.stringify(d.cells['7,6']);apply(d,planLandFill(d,{x:352,y:352}));
 assert.deepEqual(d.cells['6,6'],{surface:'grass',level:1,bridge:'ns',finish:'wood'});assert.equal(JSON.stringify(d.cells['7,6']),stairs);assert.equal(cell(d,8,6).surface,'water');
 assert.equal(planLandFill(d,{x:480,y:416}).edits.length,0);
});

test('dry clicks, invalid materials, and out-of-map clicks make no edits',()=>{
 const d=pond(),before=JSON.stringify(d);
 for(const [p,options]of [[{x:32,y:32},{}],[{x:-1,y:352},{}],[{x:352,y:352},{surface:'water'}],[{x:352,y:352},{surface:'lava'}],[{x:352,y:352},{surface:'cobble',paving:{}}]])assert.equal(planLandFill(d,p,options).edits.length,0);
 assert.equal(JSON.stringify(d),before);apply(d,planLandFill(d,{x:352,y:352}));assert.equal(planLandFill(d,{x:352,y:352}).edits.length,0);
});

test('a rounded lake keeps its grass shoreline when the water becomes sand',()=>{
 const d=blank();d.cells['10,10']={surface:'water',level:0};apply(d,roundTerrain(d,{x:672,y:672},3));
 const samples=[];for(let y=641;y<704;y+=3)for(let x=641;x<704;x+=3)samples.push({x,y,surface:surfaceAt(d,x,y),z:height(d,x,y)});
 apply(d,planLandFill(d,{x:672,y:672},{surface:'sand'}));
 for(const p of samples){assert.equal(height(d,p.x,p.y),p.z);assert.equal(surfaceAt(d,p.x,p.y),p.surface==='water'?'sand':p.surface);}
 assert(d.cells['10,10'].curves.length>0);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('a rounded dry island survives water-to-asphalt filling at the same height',()=>{
 const d=blank();for(let y=9;y<=11;y++)for(let x=9;x<=11;x++)d.cells[key(x,y)]={surface:'water',level:0};d.cells['10,10']={surface:'grass',level:0};apply(d,roundTerrain(d,{x:672,y:672},3));
 const samples=[];for(let y=577;y<768;y+=7)for(let x=577;x<768;x+=7)samples.push({x,y,surface:surfaceAt(d,x,y)});
 apply(d,planLandFill(d,{x:608,y:608},{surface:'asphalt'}));
 for(const p of samples)assert.equal(surfaceAt(d,p.x,p.y),p.surface==='water'?'asphalt':p.surface);
 assert.equal(surfaceAt(d,672,672),'grass');assert.equal(surfaceAt(d,641,641),'asphalt');assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('rounded lower water is reclaimed at its visible height without changing the high cliff or lifted donors',()=>{
 const d=blank();for(let y=5;y<12;y++)for(let x=5;x<12;x++)d.cells[key(x,y)]={surface:'grass',level:2};apply(d,roundTerrain(d,{x:352,y:352},5));apply(d,planWaterFill(d,{x:321,y:321}));
 const samples=[];for(let y=305;y<800;y+=17)for(let x=305;x<800;x+=17)samples.push({x,y,z:height(d,x,y)});
 const result=planLandFill(d,{x:321,y:321},{surface:'dirt'});assert.equal(result.level,0);apply(d,result);
 assert.equal(surfaceAt(d,321,321),'dirt');assert.equal(surfaceAt(d,600,600),'grass');for(const p of samples)assert.equal(height(d,p.x,p.y),p.z);
 const lifted=pond();lifted.cells['20,20']={surface:'grass',level:4,curves:[{kind:'height',corner:'nw',cx:1344,cy:1344,r:64,underX:5,underY:5,lift:1}]};
 apply(lifted,planLandFill(lifted,{x:352,y:352},{surface:'sand'}));assert.equal(surfaceAt(lifted,1281,1281),'water');assert.equal(height(lifted,1281,1281),96);assert.equal(lifted.cells['20,20'].curves[0].under.level,1);
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);assert.deepEqual(parseProject(JSON.stringify(lifted),new Set()),lifted);
});

test('a whole-water map supports land fill, one undo, redo, and persistent replay without touching world objects',()=>{
 const d=blank();apply(d,planWaterFill(d,{x:8192,y:6144}));d.objects=[{id:'bench',asset:'bench',x:8000,y:6000,scale:1,rotation:0,layer:'objects',collision:true}];d.edges={'h:5:5':{style:'iron',gate:false,open:false}};
 const before=JSON.stringify(d),objects=JSON.stringify(d.objects),edges=JSON.stringify(d.edges),history=new History(),result=planLandFill(d,{x:8192,y:6144},{surface:'brick'});
 assert.equal(result.count,COLS*ROWS);history.record(d);apply(d,result);assert.equal(JSON.stringify(d.objects),objects);assert.equal(JSON.stringify(d.edges),edges);assert.deepEqual(parseProject(JSON.stringify(d),new Set(['bench'])),d);
 const restored=history.back(d);assert.equal(JSON.stringify(restored),before);assert.equal(history.forward(restored).cells['128,96'].surface,'brick');
});

test('tiny shore masks stay precise for land while the water bucket keeps its full-height fill behavior',()=>{
 const fixture=()=>{
  const d=blank();for(const[x,y]of [[9,10],[11,10],[10,9],[10,11]])d.cells[key(x,y)]={surface:'grass',level:1};
  d.cells['10,10']={surface:'water',level:0,curves:[{kind:'surface',corner:'se',cx:625,cy:625,r:16,underX:12,underY:12}]};return d;
 };
 const land=fixture();assert.deepEqual(parseProject(JSON.stringify(land),new Set()),land);assert.equal(surfaceAt(land,640.05,640.05),'grass');apply(land,planLandFill(land,{x:672,y:672},{surface:'sand'}));
 assert.equal(surfaceAt(land,672,672),'sand');assert.equal(surfaceAt(land,640.05,640.05),'grass');
 const water=fixture();apply(water,planWaterFill(water,{x:672,y:672}));assert.equal(surfaceAt(water,640.05,640.05),'water');assert.equal(water.cells['10,10'].curves,undefined);
});
