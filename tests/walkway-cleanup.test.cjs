'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const meta=require('../scripts/walkway-cleanup-regions.json'),{cleanupMask}=require('../scripts/build-walkway-cleanup.cjs'),{rebaseArtwork}=require('../scripts/build-cosmic-floor.cjs');
const mask=cleanupMask(meta),width=meta.worldSize[0];

test('cleanup includes the marked joins, blue stub and upper lamp but protects the rest of the arcade',()=>{
 for(const [x,y]of [[500,495],[672,493],[775,490],[800,540],[835,470],[840,590]])assert.equal(mask[y*width+x],1,`Marked repair ${x},${y}`);
 for(const [x,y]of [[512,360],[620,390],[1000,500],[400,750],[835,640],[650,65],[1351,512]])assert.equal(mask[y*width+x],0,`Unmarked fixture/floor ${x},${y}`);
});

test('the later user pathway shape owns every changed pixel so cleanup cannot restore its old diagonal',()=>{
 const shape=require('../assets/environment/boutique-pathway-shape.json');let count=0;
 for(const [y,x0,x1]of shape.deltaRuns)for(let x=x0;x<x1;x++){
  assert.equal(mask[y*width+x],0,`New authored shape ${x},${y} must not use old cleanup art`);count++;
 }
 assert.equal(count,16226);assert.equal(mask[450*width+300],0);
 assert.equal(shape.transparentRuns.reduce((n,[y,x0,x1])=>n+x1-x0,0),10543);
 assert.deepEqual(shape.sampleOffset,[640,128]);
});

test('the completed repair image replaces only journals inside its exact ownership mask, including old glow colors',()=>{
 const project={assets:[{id:'mirror',x:616,y:384}],collision:[[10,0]],characters:{riff:{x:1353,y:467}},rooms:{piano:{collision:[[33,0]]}},
  artwork:{'background.world':{width:1672,height:941,tiles:{'4,7':[[172,1,'#3601f1ff']],'13,7':[[1411,1,'#ffbb44ff']],'20,9':[[0,2,'#aabbccff']]}},
   'object.dance_north_wall_west':{width:127,height:64,tiles:{'0,0':[[0,2,'#00000000']]}}}};
 // 300,450 belongs to the later authored reshape; 835,470 is old glow cleanup.
 const before=structuredClone(project),result=rebaseArtwork(project,mask,width);
 assert.equal(result.removed,1);assert.deepEqual(result.project.artwork['background.world'].tiles,{'4,7':[[172,1,'#3601f1ff']],'20,9':[[0,2,'#aabbccff']]});
 for(const key of ['assets','collision','characters','rooms'])assert.deepEqual(result.project[key],before[key]);
 assert.deepEqual(result.project.artwork['object.dance_north_wall_west'],before.artwork['object.dance_north_wall_west']);
 assert.deepEqual(project,before);assert.deepEqual(rebaseArtwork(result.project,mask,width).project,result.project);
});
