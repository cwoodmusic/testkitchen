import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildingDepthSlices,physicalObjectDepth,scenePartDepth,buildingSliceRect,batchBuildingDepthQueue} from './actor-depth.mjs';
import {OPERA_BUILDING} from './opera-building.mjs';

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

test('cropped opera facade strips cover native pixels exactly once in every quarter-turn orientation',()=>{
 const a=OPERA_BUILDING;
 for(const rotation of [0,90,180,270])for(const scale of [.5,1,2]){
  const o=placed({rotation,scale}),slices=buildingDepthSlices(a,o),r=rotation*Math.PI/180;
  let area=0;
  for(const part of slices){
   const crop=buildingSliceRect(a,o,part);assert(crop&&crop.w>0&&crop.h>0);
   assert(crop.x>=0&&crop.y>=0&&crop.x+crop.w<=a.w+1e-6&&crop.y+crop.h<=a.h+1e-6);
   const xs=[[crop.x,crop.y],[crop.x+crop.w,crop.y],[crop.x,crop.y+crop.h],[crop.x+crop.w,crop.y+crop.h]].map(([x,y])=>o.x+((x-a.w/2)*Math.cos(r)-(y-a.h)*Math.sin(r))*scale);
   assert(Math.abs(Math.min(...xs)-part.x0)<1e-6,'Crop must start at the existing world clip');
   assert(Math.abs(Math.max(...xs)-part.x1)<1e-6,'Crop must end at the existing world clip');
   area+=crop.w*crop.h;
  }
  assert(Math.abs(area-a.w*a.h)<1e-4,'Combined crops must sample one full native image rather than one full image per strip');
 }
});

test('source crop padding covers rounded device edges without moving native pixel phase',()=>{
 const a={w:400,h:600},o=placed(),part={x0:900,x1:1000};
 assert.deepEqual(buildingSliceRect(a,o,part),{x:100,y:0,w:100,h:600});
 assert.deepEqual(buildingSliceRect(a,o,part,2.5),{x:97.5,y:0,w:105,h:600});
 assert.deepEqual(buildingSliceRect(a,o,{x0:700,x1:850},2.5),{x:0,y:0,w:52.5,h:600});
 assert.equal(buildingSliceRect(a,placed({rotation:45}),part),null,'Unsupported angles keep the existing full-image fallback');
});

const strip=(building,x0,x1,y)=>({building,y,fragment:{x0,x1,depth:y}});
test('consecutive strips batch into disjoint union clips without crossing a pedestrian layer',()=>{
 const building={},npc={id:'npc',y:25},queue=[strip(building,0,20,10),strip(building,40,60,20),npc,strip(building,20,40,30)],before=JSON.stringify(queue),batched=batchBuildingDepthQueue(queue);
 assert.equal(batched.length,3);assert.strictEqual(batched[1],npc);
 assert.deepEqual(batched[0].fragment.spans,[{x0:0,x1:20},{x0:40,x1:60}]);
 assert.equal(batched[0].depthBatchCount,2);assert.equal(JSON.stringify(queue),before,'Shared cached geometry must remain unchanged');
 const orderAt=(entries,x)=>entries.filter(e=>!e.building||(e.fragment.spans||[e.fragment]).some(p=>x>=p.x0&&x<p.x1)).map(e=>e.building?'building':e.id);
 for(const x of [10,30,50,100])assert.deepEqual(orderAt(batched,x),orderAt(queue,x),`NPC occlusion must be identical at x=${x}`);
});

test('whole opera batches become one draw while foreign objects split the draw at their exact queue position',()=>{
 const a=OPERA_BUILDING,o=placed(),slices=buildingDepthSlices(a,o),queue=slices.map(p=>strip(o,p.x0,p.x1,p.depth)).sort((a,b)=>a.y-b.y),batched=batchBuildingDepthQueue(queue);
 assert.equal(batched.length,1);assert.equal(batched[0].depthBatchCount,slices.length);
 assert.equal(batched[0].fragment.spans.length,1);
 const crop=buildingSliceRect(a,o,batched[0].fragment);assert.deepEqual(crop,{x:0,y:0,w:a.w,h:a.h});
 const other={id:'fence',y:0};
 const divided=batchBuildingDepthQueue([...queue.slice(0,20),other,...queue.slice(20)]);
 assert.equal(divided.length,3);assert.strictEqual(divided[1],other);
 assert.equal(divided[0].depthBatchCount+divided[2].depthBatchCount,slices.length);
 const secondBuilding={};assert.equal(batchBuildingDepthQueue([strip(o,0,10,1),strip(secondBuilding,10,20,2)]).length,2);
});
