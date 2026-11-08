import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,cell,key,height,surfaceAt,blocked,parseProject,History,COLS,ROWS} from '../world/model.mjs';
import {groundMaterials,encodePaint,readPaint,materialKey} from '../world/ground-paint.mjs';
import {encodeMask} from '../world/organic-mask.mjs';
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

test('matching ground, invalid materials, and out-of-map clicks make no edits',()=>{
 const d=pond(),before=JSON.stringify(d);
 for(const [p,options]of [[{x:32,y:32},{}],[{x:-1,y:352},{}],[{x:352,y:352},{surface:'water'}],[{x:352,y:352},{surface:'lava'}],[{x:352,y:352},{surface:'cobble',paving:{}}]])assert.equal(planLandFill(d,p,options).edits.length,0);
 assert.equal(JSON.stringify(d),before);apply(d,planLandFill(d,{x:352,y:352}));assert.equal(planLandFill(d,{x:352,y:352}).edits.length,0);
});

test('every dry ground material can be replaced by another material without changing its floor',()=>{
 for(let i=0;i<groundMaterials.length;i++){
  const source=groundMaterials[i],surface=groundMaterials[(i+1)%groundMaterials.length],d=pond();
  for(const a of Object.values(d.cells)){a.surface=source;if(source==='cobble')a.paving='old-square';}
  const before=JSON.stringify(d),result=planLandFill(d,{x:352,y:352},{surface,paving:'music-square'});
  assert.equal(JSON.stringify(d),before);assert.equal(result.level,1);assert.equal(result.count,25);apply(d,result);
  for(let y=5;y<=9;y++)for(let x=5;x<=9;x++){const a=cell(d,x,y);assert.equal(a.surface,surface);assert.equal(a.level,1);assert.equal(a.paving,surface==='cobble'?'music-square':undefined);}
  assert.equal(planLandFill(d,{x:352,y:352},{surface,paving:'music-square'}).edits.length,0);
  assert.deepEqual(parseProject(JSON.stringify(d),new Set(['music-square','old-square'])),d);
 }
});

test('dry filling stops at other materials, water, different heights, stairs, and diagonal contact',()=>{
 const d=pond();for(const a of Object.values(d.cells))a.surface='grass';
 for(let y=5;y<=9;y++)d.cells[key(7,y)]={surface:'sand',level:1};
 d.cells['6,10']={surface:'grass',level:0};d.cells['4,4']={surface:'grass',level:1};d.cells['5,10']={surface:'water',level:1};
 d.cells['5,6']={surface:'grass',level:1,bridge:'ns',finish:'wood'};
 d.cells['6,6']={surface:'grass',level:1,stairs:'north',stairBase:1,stairRise:1,stairStart:0,stairEnd:1,finish:'stone'};
 const stair=JSON.stringify(d.cells['6,6']),result=planLandFill(d,{x:352,y:352},{surface:'brick'});assert.equal(result.count,9);apply(d,result);
 assert.equal(cell(d,6,9).surface,'brick');assert.equal(cell(d,7,7).surface,'sand');assert.equal(cell(d,8,7).surface,'grass');assert.equal(cell(d,6,10).surface,'grass');assert.equal(cell(d,4,4).surface,'grass');assert.equal(cell(d,5,10).surface,'water');
 assert.deepEqual(d.cells['5,6'],{surface:'brick',level:1,bridge:'ns',finish:'wood'});assert.equal(JSON.stringify(d.cells['6,6']),stair);
});

test('cobblestone fills distinguish the clicked paving from neighboring paving designs',()=>{
 const d=pond();for(const a of Object.values(d.cells)){a.surface='cobble';a.paving='music-square';}
 for(let y=5;y<=9;y++)d.cells[key(7,y)]={surface:'cobble',level:1,paving:'other-square'};
 d.cells['6,10']={surface:'cobble',level:1,paving:'auto'};
 const result=planLandFill(d,{x:352,y:352},{surface:'wood'});assert.equal(result.count,10);apply(d,result);
 assert.equal(cell(d,6,9).surface,'wood');assert.equal(cell(d,6,9).paving,undefined);assert.equal(cell(d,7,7).paving,'other-square');assert.equal(cell(d,8,7).paving,'music-square');assert.equal(cell(d,6,10).paving,'auto');
 assert.deepEqual(parseProject(JSON.stringify(d),new Set(['music-square','other-square'])),d);
});

test('soft-painted ground is selected by its visible material while other blend channels stay intact',()=>{
 const d=blank(),materials=[{surface:'grass'},{surface:'sand'}],weights=new Float64Array(256*2);
 for(let i=0;i<256;i++){weights[i*2]=i%16<8?55:255;weights[i*2+1]=i%16<8?200:0;}
 d.cells['10,10']={surface:'grass',level:1,paint:encodePaint(materials,weights)};
 for(const [x,y]of [[9,10],[11,10],[10,9],[10,11]])d.cells[key(x,y)]={surface:'grass',level:1};
 const before=JSON.stringify(d);assert.equal(planLandFill(d,{x:650,y:650},{surface:'sand'}).edits.length,0);assert.equal(JSON.stringify(d),before);
 const result=planLandFill(d,{x:650,y:650},{surface:'wood'});assert.equal(result.count,1);apply(d,result);
 const actual=readPaint(d.cells['10,10']),keys=actual.materials.map(materialKey);
 for(let i=0;i<256;i++)for(let j=0;j<keys.length;j++)assert.equal(actual.weights[i*keys.length+j],keys[j]==='grass'?(i%16<8?55:255):keys[j]==='wood'&&i%16<8?200:0);
 assert.equal(keys.includes('sand'),false);assert.equal(d.cells['11,10'].surface,'grass');assert.equal(d.cells['10,10'].level,1);
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('a painted source patch cannot connect through a different dominant material in the same tile',()=>{
 const d=blank(),materials=[{surface:'grass'},{surface:'sand'}],weights=new Float64Array(256*2);
 for(let i=0;i<256;i++)weights[i*2+(i%16===8?1:0)]=255;
 d.cells['10,10']={surface:'grass',level:1,paint:encodePaint(materials,weights)};
 apply(d,planLandFill(d,{x:650,y:650},{surface:'brick'}));
 const actual=readPaint(d.cells['10,10']),keys=actual.materials.map(materialKey);
 for(let i=0;i<256;i++){const expected=i%16<8?'brick':i%16===8?'sand':'grass';const j=keys.indexOf(expected);assert(j>=0);assert.equal(actual.weights[i*keys.length+j],255);}
 assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('rounded and organic dry islands retain their exact water shoreline while the land is repainted',()=>{
 for(const organic of [false,true]){
  const d=blank();for(let y=9;y<=11;y++)for(let x=9;x<=11;x++)d.cells[key(x,y)]={surface:'water',level:1};d.cells['10,10']={surface:'grass',level:1};
  if(organic){
   const bits=Uint8Array.from({length:256},(_,i)=>i%16<9+Math.floor(Math.sin(Math.floor(i/16)*.7)*2)?1:0);
   d.cells['10,10'].curves=[{kind:'surface',corner:'nw',cx:704,cy:704,r:64,underX:9,underY:10,under:{surface:'water',level:1},mask:encodeMask(bits)}];
  }else apply(d,roundTerrain(d,{x:672,y:672},3));
  const samples=[];for(let y=641;y<704;y+=3)for(let x=641;x<704;x+=3)samples.push({x,y,surface:surfaceAt(d,x,y),z:height(d,x,y)});
  const p=organic?{x:650,y:650}:{x:672,y:672};apply(d,planLandFill(d,p,{surface:'brick'}));
  for(const p of samples){assert.equal(height(d,p.x,p.y),p.z);assert.equal(surfaceAt(d,p.x,p.y),p.surface==='grass'?'brick':p.surface);}
  assert(d.cells['10,10'].curves.length>0);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
 }
});

test('reclaiming a water-backed organic facet never encodes water as a dry paint material',()=>{
 const d=blank(),bits=new Uint8Array(256).fill(1);
 for(let y=4;y<=6;y++)for(const start of [2,10])for(let x=start;x<start+3;x++)bits[y*16+x]=0;
 d.cells['10,10']={surface:'grass',level:0,curves:[{kind:'surface',corner:'nw',cx:704,cy:704,r:64,underX:9,underY:10,under:{surface:'water',level:0},mask:encodeMask(bits)}]};
 for(const[x,y]of [[9,10],[11,10],[10,9],[10,11]])d.cells[key(x,y)]={surface:'grass',level:1};
 assert.equal(surfaceAt(d,650,658),'water');assert.equal(surfaceAt(d,682,658),'water');apply(d,planLandFill(d,{x:650,y:658},{surface:'sand'}));
 assert.equal(surfaceAt(d,650,658),'sand');assert.equal(surfaceAt(d,682,658),'sand');assert.equal(surfaceAt(d,674,674),'grass');
 assert.equal(d.cells['10,10'].curves[0].under.paint,undefined);assert.deepEqual(parseProject(JSON.stringify(d),new Set()),d);
});

test('implicit grass fills the whole connected map with one portable, reversible edit operation',()=>{
 const d=blank();d.objects=[{id:'bench',asset:'bench',x:8000,y:6000,scale:1,rotation:0,layer:'objects',collision:true}];d.edges={'h:5:5':{style:'iron',gate:false,open:false}};
 const before=JSON.stringify(d),objects=JSON.stringify(d.objects),edges=JSON.stringify(d.edges),history=new History(),result=planLandFill(d,{x:8192,y:6144},{surface:'sidewalk'});
 assert.equal(result.count,COLS*ROWS);history.record(d);apply(d,result);assert.equal(JSON.stringify(d.objects),objects);assert.equal(JSON.stringify(d.edges),edges);assert.deepEqual(parseProject(JSON.stringify(d),new Set(['bench'])),d);
 assert.equal(cell(d,0,0).surface,'sidewalk');assert.equal(cell(d,COLS-1,ROWS-1).surface,'sidewalk');
 const restored=history.back(d);assert.equal(JSON.stringify(restored),before);assert.equal(history.forward(restored).cells['128,96'].surface,'sidewalk');
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
