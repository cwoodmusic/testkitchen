import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitScenePixels,createScenePartitionCache} from './scene-partition.mjs';

test('source RGBA appears in exactly one base or cropped foreground layer',()=>{
 const source=new Uint8ClampedArray([20,40,60,128,80,100,120,64,140,160,180,192,200,220,240,255]);
 const owners=new Uint16Array([0,1,2,1]),bounds=[{x:1,y:0,w:3,h:1},{x:2,y:0,w:1,h:1}];
 const result=splitScenePixels(source,4,1,owners,bounds);
 for(let x=0;x<4;x++){
  const layers=[result.base.slice(x*4,x*4+4)];
  result.parts.forEach(({bounds:b,data})=>{if(x>=b.x&&x<b.x+b.w)layers.push(data.slice((x-b.x)*4,(x-b.x)*4+4));});
  const visible=layers.filter(p=>p[3]);assert.equal(visible.length,1);assert.deepEqual(visible[0],source.slice(x*4,x*4+4));
 }
 assert.equal(result.parts[0].data[4+3],0,'Overlapping pixel is not duplicated in another part');
});
test('transparent and unowned pixels preserve their original alpha without broad opaque masks',()=>{
 const source=new Uint8ClampedArray([10,20,30,0,40,50,60,7,70,80,90,255,100,110,120,33]);
 const split=splitScenePixels(source,2,2,new Uint16Array([1,0,0,1]),[{x:0,y:0,w:2,h:2}]);
 assert.equal(split.base[7],7);assert.equal(split.base[11],255);assert.equal(split.parts[0].data[3],0);assert.equal(split.parts[0].data[15],33);
 assert.equal(split.parts[0].data[7],0);assert.equal(split.parts[0].data[11],0);
});
test('cropped layer coordinates retain native pixel phase across rows',()=>{
 const source=Uint8ClampedArray.from({length:4*3*4},(_,i)=>i%4===3?128:i);
 const owners=new Uint16Array(12);owners[5]=1;owners[6]=1;owners[9]=1;owners[10]=1;
 const split=splitScenePixels(source,4,3,owners,[{x:1,y:1,w:2,h:2}]);
 assert.deepEqual(split.parts[0].data.slice(0,8),source.slice(5*4,7*4));assert.deepEqual(split.parts[0].data.slice(8),source.slice(9*4,11*4));
 assert.equal(split.base[5*4+3],0);assert.equal(split.base[4*4+3],128);
});


function canvas(width,height){
 const surface={width,height,data:new Uint8ClampedArray(width*height*4)};
 const context={
  createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
  putImageData:image=>surface.data.set(image.data),
  getImageData:()=>({data:surface.data.slice(),width,height}),
  drawImage:source=>surface.data.set(source.data),
  beginPath(){},moveTo(){},lineTo(){},closePath(){},
  // Fixtures use rectangles exactly matching the tight mask canvas.
  fill(){surface.data.fill(255);}
 };
 surface.getContext=()=>context;return surface;
}
const asset=()=>({w:2,h:1,sceneParts:[{outline:[[0,0],[1,0],[1,1],[0,1]],depth:1}]});

test('a source revision creates fresh pixel layers without changing a retained earlier frame',()=>{
 const source=canvas(2,1);source.data.set([1,2,3,128,4,5,6,64]);const a=asset(),cache=createScenePartitionCache({createCanvas:canvas});
 const first=cache.partition(a,source,0),before=first.parts[0].canvas.data.slice();assert.strictEqual(cache.partition(a,source,0),first);
 source.data.set([20,30,40,128,50,60,70,64]);const next=cache.partition(a,source,1);
 assert.notStrictEqual(next,first);assert.strictEqual(next.spec,first.spec,'Unchanged geometry reuses ownership');
 assert.deepEqual(first.parts[0].canvas.data,before);assert.equal(next.parts[0].canvas.data[0],20);
});
test('partition cache evicts old layers under its memory budget without shrinking live frame canvases',()=>{
 const source=canvas(2,1),a=asset(),cache=createScenePartitionCache({maxPixels:4,createCanvas:canvas});
 source.data.set([1,2,3,128,4,5,6,64]);const first=cache.partition(a,source,0);source.data[0]=99;
 const latest=cache.partition(a,source,1);assert.equal(cache.size,1);assert(cache.pixels<=4);
 assert.equal(first.parts[0].canvas.width,1);assert.equal(first.parts[0].canvas.data[0],1);assert.equal(latest.parts[0].canvas.data[0],99);
});
test('overlapping fragments assign their pixels to the foreground owner for each orientation',()=>{
 const source=canvas(1,1);source.data.set([30,60,90,128]);const outline=[[0,0],[1,0],[1,1],[0,1]],a={w:1,h:1,sceneParts:[{outline,depth:1},{outline,depth:2}]};
 const cache=createScenePartitionCache({createCanvas:canvas}),forward=cache.partition(a,source,0,[1,2]),turned=cache.partition(a,source,0,[2,1]);
 assert.equal(forward.parts[0].canvas.data[3],0);assert.equal(forward.parts[1].canvas.data[3],128);
 assert.equal(turned.parts[0].canvas.data[3],128);assert.equal(turned.parts[1].canvas.data[3],0);assert.equal(turned.base.getContext('2d').getImageData().data[3],0);
});
