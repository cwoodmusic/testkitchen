'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const meta=require('../scripts/boutique-join-regions.json'),{cleanupMask}=require('../scripts/build-walkway-cleanup.cjs'),{rebaseArtwork}=require('../scripts/build-cosmic-floor.cjs');
const mask=cleanupMask(meta),width=meta.worldSize[0];

test('canonical native join owns only the reviewed left post, deleted floor and straight wall cap',()=>{
 for(const [x,y]of [[247,445],[300,470],[400,495],[267,508],[492,520]])assert.equal(mask[y*width+x],1);
 for(const [x,y]of [[239,445],[500,495],[300,426],[300,527],[620,390],[1351,512],[400,330],[835,640]])assert.equal(mask[y*width+x],0);
 assert.equal(mask.reduce((sum,value)=>sum+value,0),26000);
});

test('only journals owned by the exact composed-source patch are retired; other transparent edits and all layout stay raw',()=>{
 const project={assets:[{id:'wall',visible:false,x:384.5,y:504}],collision:[[5581,1]],
  artwork:{'background.world':{width:1672,height:941,tiles:{'4,7':[[172,1,'#00000000']],'8,7':[[0,1,'#00000000']]}},
   'object.dance_north_wall_west':{width:127,height:64,tiles:{'0,0':[[0,2,'#00000000']]}}}};
 const before=structuredClone(project),result=rebaseArtwork(project,mask,width);
 assert.equal(result.removed,1);assert.deepEqual(result.project.artwork['background.world'].tiles,{'8,7':[[0,1,'#00000000']]});
 assert.deepEqual(result.project.assets,project.assets);assert.deepEqual(result.project.collision,project.collision);
 assert.deepEqual(result.project.artwork['object.dance_north_wall_west'],project.artwork['object.dance_north_wall_west']);
 assert.deepEqual(project,before);
});
