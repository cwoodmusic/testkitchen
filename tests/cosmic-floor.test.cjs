'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const meta=require('../scripts/cosmic-floor-regions.json');
const {floorMask,authoredShapeMask,rebaseArtwork,repairPoints,recolorRepairs}=require('../scripts/build-cosmic-floor.cjs');
const mask=floorMask(meta),width=meta.worldSize[0];

test('cosmic palette reaches exposed floor while protecting the existing architecture and dance tiles',()=>{
 for(const [x,y]of [[1000,500],[450,450],[425,440],[790,600],[110,740],[775,525]])
  assert.equal(mask[y*width+x],1,`Exposed floor ${x},${y} must receive the new palette`);
 for(const [x,y]of [[250,250],[400,750],[500,350],[850,60],[840,600],[1460,780]])
  assert.equal(mask[y*width+x],0,`Protected carpet, tile, wall or sign ${x},${y} must stay intact`);
 assert.equal(mask.length,1672*941);
});

test('the glass repair scope includes both jagged walkway ends and samples only unobstructed main floor',()=>{
 const witnesses=[[300,460],[315,465],[330,464],[800,540]],tiles={};
 for(const [x,y]of witnesses){
  const key=Math.floor(x/64)+','+Math.floor(y/64),index=y%64*64+x%64;
  (tiles[key]??=[]).push([index,1,'#3601f1ff']);
 }
 for(const runs of Object.values(tiles))runs.sort((a,b)=>a[0]-b[0]);
 const project={artwork:{'background.world':{width:1672,height:941,tiles}}};
 assert.deepEqual(repairPoints(project,meta.authoredFloorRepair).sort(),witnesses.slice().sort(),
  'The former narrow repair band left these purple fringe pixels unchanged');
 const [dx,dy]=meta.authoredFloorRepair.sampleOffset;
 for(const [x,y]of witnesses)assert.equal(mask[(y+dy)*width+x+dx],1,'Repair samples must come from exposed glass floor');
 const rebased=rebaseArtwork(project,new Uint8Array(mask.length).fill(1),width,meta.authoredFloorRepair);
 assert.equal(rebased.removed,0,'Expanding a native floor mask must not erase the authored trim-covering silhouette');
 assert.deepEqual(rebased.project,project);
});

test('recoloring an authored repair preserves its exact coverage, original alpha and every other pixel',()=>{
 const project={assets:[{id:'wall',x:123}],artwork:{'background.world':{width:1672,height:941,
  tiles:{'6,7':[[1728,3,'#3601f180'],[1800,2,'#001122ff']]}}}};
 // Tile6,7 pixel1728 is world384,475; the second run is outside this repair.
 const points=repairPoints(project,{bounds:[384,475,3,1]}),before=structuredClone(project);
 assert.deepEqual(points,[[384,475],[385,475],[386,475]]);
 const samples=points.map(([x,y])=>[x,y,'#ddaa55']),result=recolorRepairs(project,samples);
 assert.deepEqual(result.project.artwork['background.world'].tiles['6,7'],[[1728,3,'#ddaa5580'],[1800,2,'#001122ff']]);
 assert.deepEqual(result.project.assets,project.assets);assert.deepEqual(project,before);
 assert.deepEqual(repairPoints(result.project,{bounds:[384,475,3,1]}),points,'Painted silhouette remains exact');
 const repeat=recolorRepairs(result.project,samples);
 assert.equal(repeat.changed,0);assert.deepEqual(repeat.project,result.project);
});

test('floor-family repair selection leaves warm lamp and cyan wall details intact',()=>{
 const project={artwork:{'background.world':{width:1672,height:941,tiles:{'12,8':[
  [768,1,'#3601f1ff'],[769,1,'#e14488ff'],[770,1,'#08dcffff']
 ]}}}};
 assert.deepEqual(repairPoints(project,{bounds:[768,524,3,1],blueFloorOnly:true}),[[768,524]]);
});

test('later authored pathway erasures and custom paint survive old floor rebasing and palette sampling',()=>{
 const owned=authoredShapeMask(meta,require('../assets/environment/boutique-pathway-shape.json'));
 const project={artwork:{'background.world':{width:1672,height:941,tiles:{
  '4,6':[[3584+15,1,'#00000000']], //271,440: beyond the earlier repair bounds.
  '4,7':[[172,1,'#0a0b32ff']] //300,450: blue custom paint, not old floor material.
 }}}};
 const result=rebaseArtwork(project,new Uint8Array(mask.length).fill(1),width,null,owned);
 assert.equal(result.removed,0);assert.deepEqual(result.project,project);
 assert.deepEqual(repairPoints(project,meta.authoredFloorRepair,owned),[]);
});

test('rebasing splits a journal run at the floor-wall boundary without changing retained colors or layout',()=>{
 const color='#aabbccff',wall='#112233ff',project={
  format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},scenery:'environment-v1',
  assets:[{id:'keep-this-prop',x:42,y:123}],collision:[[431,0]],strokes:[{tool:'erase',size:1,points:[[4,5]]}],
  characters:{riff:{x:1353,y:467}},rooms:{piano:{collision:[[33,0]]}},
  artwork:{'background.world':{width:1672,height:941,tiles:{'12,9':[[1536,64,color]],'13,9':[[1536,10,wall]]}},
   'object.dance_north_wall_west':{width:127,height:64,tiles:{'0,0':[[0,2,'#00000000']]}}}
 };
 const before=structuredClone(project),result=rebaseArtwork(project,mask,width);
 assert.deepEqual(project,before,'The input export is never mutated');
 assert.deepEqual(result.project.artwork['background.world'].tiles,{
  '12,9':[[1536,10,color],[1595,5,color]],'13,9':[[1536,10,wall]]
 });
 assert.equal(result.removed,49);assert.equal(result.retained,25);
 for(const key of ['assets','collision','strokes','characters','rooms'])assert.deepEqual(result.project[key],before[key]);
 assert.deepEqual(result.project.artwork['object.dance_north_wall_west'],before.artwork['object.dance_north_wall_west']);
 const repeat=rebaseArtwork(result.project,mask,width);
 assert.equal(repeat.removed,0);assert.deepEqual(repeat.project,result.project,'Rebuilding is idempotent');
});
