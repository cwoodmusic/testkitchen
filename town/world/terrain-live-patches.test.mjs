import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createTerrainChunkCache} from './terrain-chunks.mjs';
import {setWaterTime,drawAnimatedWater,waterFrame,currentWaterFrameIndex,withLevelZeroWaterCutout} from './water-motion.mjs';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');

test('live lake patches leave no dark grid at fractional zooms and camera positions',()=>{
 const doc={cells:{'65,90':{surface:'water',level:2}},objects:[],edges:{}},raw=JSON.stringify(doc);
 for(const scale of [.175,.3,.5,.6,.8])for(const phase of [0,.13,.49,.73]){
  const cv=createCanvas(640,480),c=cv.getContext('2d'),cache=createTerrainChunkCache({createCanvas,prefetch:false});
  c.fillStyle='#102030';c.fillRect(0,0,cv.width,cv.height);
  c.setTransform(scale,0,0,scale,-4000*scale+phase,-5000*scale+phase);
  let draws=0;
  const paint=ctx=>{draws++;ctx.fillStyle='#7eae4e';ctx.fillRect(0,0,16384,12288);};
  assert.equal(cache.draw(c,doc,null,{terrainRevision:0},paint),true);
  const first=cache.stats(c),image=c.getImageData(0,0,cv.width,cv.height).data;
  assert(first.livePatches>0,'The fixture must exercise live water redraws');
  for(let i=0;i<image.length;i+=4)if(image[i]!==126||image[i+1]!==174||image[i+2]!==78||image[i+3]!==255){
   assert.fail(`Live patches changed opaque ground at ${i/4%cv.width},${Math.floor(i/4/cv.width)} with scale ${scale}, phase ${phase}: ${Array.from(image.slice(i,i+4))}`);
  }
  const before=draws;
  cache.draw(c,doc,null,{terrainRevision:0},paint);
  assert.deepEqual(c.getImageData(0,0,cv.width,cv.height).data,image,'A subsequent live refresh introduced a dark edge');
  assert.equal(cache.stats(c).builds,first.builds,'Animation reuses the static terrain');
  if(scale<.8)assert(draws>before,'Visible raised water still redraws each frame');
  assert(cache.stats(c).pixels<=16*1024*1024);
  cache.invalidate(c);assert.equal(cache.stats(c).pixels,0);
 }
 assert.equal(JSON.stringify(doc),raw);
});

test('live water redraws preserve the cached texture sampling while the camera pans',()=>{
 const texture=createCanvas(16,16),p=texture.getContext('2d');
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){p.fillStyle=(x+y)%3?'#cfb641':'#164358';p.fillRect(x,y,1,1);}
 const dry={cells:{},objects:[],edges:{}},lake={...dry,cells:{'65,90':{surface:'water',level:2}}};
 for(const scale of [.175,.3,.5,.6])for(const phase of [.13,.49,.73]){
  const images=[];
  for(const doc of [dry,lake]){
   const cv=createCanvas(640,480),c=cv.getContext('2d'),cache=createTerrainChunkCache({createCanvas,prefetch:false});
   c.setTransform(scale,0,0,scale,-4000*scale+phase,-5000*scale+phase);
   const paint=ctx=>{ctx.fillStyle=ctx.createPattern(texture,'repeat');ctx.fillRect(0,0,16384,12288);};
   cache.draw(c,doc,null,{terrainRevision:0},paint);cache.draw(c,doc,null,{terrainRevision:0},paint);
   images.push(c.getImageData(0,0,cv.width,cv.height).data);
   cache.invalidate(c);
  }
  assert.deepEqual(images[1],images[0],`A live redraw changed the static texture at scale ${scale}, phase ${phase}`);
 }
});

test('live rasters keep sea sampling continuous while raised lake water continues animating',()=>{
 const previousDocument=globalThis.document;globalThis.document={createElement:()=>createCanvas(1,1)};
 try{
  const source=createCanvas(64,64),s=source.getContext('2d'),image=s.createImageData(64,64);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=(y*64+x)*4;image.data.set([x*3,y*3,(x+y)*2,255],i);}s.putImageData(image,0,0);
  const hooks={withWaterCutout:withLevelZeroWaterCutout,waterImage:()=>waterFrame(source),waterKey:currentWaterFrameIndex};
  const raw=ctx=>{ctx.fillStyle='#7eae4e';ctx.fillRect(0,0,16384,12288);drawAnimatedWater(ctx,source,65,90,4160,5664);drawAnimatedWater(ctx,source,66,90,4224,5760);};
  const sea={cells:{'66,90':{surface:'water',level:0}},objects:[],edges:{}},lake={...sea,cells:{...sea.cells,'65,90':{surface:'water',level:2}}};
  const scenes=[sea,lake].map(doc=>({doc,cv:createCanvas(160,160),cache:createTerrainChunkCache({createCanvas,prefetch:false}),colors:[]}));
  for(const time of [0,2]){
   setWaterTime(time);
   for(const item of scenes){
    const c=item.cv.getContext('2d');c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,160,160);c.setTransform(.5,0,0,.5,-4096*.5,-5568*.5);
    item.cache.draw(c,item.doc,null,{terrainRevision:0},raw,hooks);
    item.colors.push({sea:Array.from(c.getImageData(80,112,1,1).data),lake:Array.from(c.getImageData(48,64,1,1).data)});
   }
  }
  for(let frame=0;frame<2;frame++)assert.deepEqual(scenes[1].colors[frame].sea,scenes[0].colors[frame].sea,'Sea below a live patch must use the same global water sampler');
  assert.notDeepEqual(scenes[1].colors[0].lake,scenes[1].colors[1].lake,'Raised lake water must keep animating');
  assert.notDeepEqual(scenes[1].colors[0].sea,scenes[1].colors[1].sea,'The shared sea remains animated too');
  for(const item of scenes)item.cache.invalidate(item.cv.getContext('2d'));
 }finally{setWaterTime(0);if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});
