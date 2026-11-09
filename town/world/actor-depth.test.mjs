import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildingDepthSlices,physicalObjectDepth,scenePartDepth} from './actor-depth.mjs';

const placed=(extra={})=>({x:1000,y:2000,scale:1,rotation:0,...extra});
const house={w:400,h:600,footprint:{x:50,y:400,w:300,h:150},frontAtX:x=>x>=50&&x<=350?550:null};

test('transparent canvas below a facade is not the building depth',()=>{
 const slices=buildingDepthSlices(house,placed());assert.equal(slices.length,1);assert.equal(slices[0].depth,1950);
 assert.equal(slices[0].x0,800);assert.equal(slices[0].x1,1200);
});
test('recessed wings keep their individual depth without reference to any actor',()=>{
 const asset={w:400,h:500,polygons:[[[0,100],[200,100],[200,450],[0,450]],[[200,100],[400,100],[400,350],[200,350]]],frontAtX:x=>x<200?450:350};
 const o=placed(),pieces=buildingDepthSlices(asset,o);assert.deepEqual(pieces,[{x0:800,x1:1000,depth:1950},{x0:1000,x1:1200,depth:1850}]);
 assert.strictEqual(buildingDepthSlices(asset,o),pieces);o.x+=100;assert.notStrictEqual(buildingDepthSlices(asset,o),pieces);
});
test('rotated scaled physical footprints still cover the complete source image width',()=>{
 const slices=buildingDepthSlices(house,placed({rotation:90,scale:2}));assert.equal(slices.length,1);
 assert.equal(slices[0].depth,2300);assert(Math.abs(slices[0].x0-1000)<1e-6);assert(Math.abs(slices[0].x1-2200)<1e-6);
});
test('decorative overlays retain their authored depth while solid plants use their feet',()=>{
 const flower={w:200,h:300,boxes:[{x:20,y:230,w:160,h:50}]};
 assert.equal(physicalObjectDepth(flower,placed()),2000);flower.depthSorted=true;
 assert.equal(physicalObjectDepth(flower,placed()),1980);assert.equal(physicalObjectDepth(flower,placed({rotation:90})),2080);
});
test('composite fragment depth follows its ground baseline rather than its roof outline',()=>{
 const a={w:2400,h:1600},part={outline:[[100,100],[500,100],[500,300],[100,300]],depth:340};
 assert.equal(scenePartDepth(a,placed(),part),740);assert.equal(scenePartDepth(a,placed({rotation:90}),part),1300);
});
