'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {alphaBounds,bottomRect,validateMetadata}=require('../scripts/build-south-facing-furniture.cjs');
const meta=require('../scripts/south-facing-furniture.json');

test('south-facing furniture preserves the three sofa footprints and foot baselines',()=>{
 const expected={'sofa-south':[164,131,139],'sofa-compact-south':[162,109,121],'sofa-lounge-south':[288,105,262]};
 for(const item of meta.items.filter(item=>item.mode==='bottom')){
  assert.deepEqual([item.width,item.height,item.maxWidth],expected[item.id]);
  const rect=bottomRect(200,100,item.width,item.height,item.maxWidth);
  assert.ok(rect.width<=item.maxWidth);assert.equal(rect.y+rect.height,item.height);
  assert.equal(rect.x,Math.floor((item.width-rect.width)/2));
 }
 const paths=validateMetadata(meta);
 assert.equal(paths.outputs.length,10);assert.equal(meta.items.filter(item=>item.mode==='center').length,4);
 assert.ok(paths.outputs.every(output=>!paths.inputs.includes(output)),'Original furniture is never overwritten');
});

test('generated furniture crop ignores faint empty-border noise without moving solid feet',()=>{
 const pixels=new Uint8ClampedArray(4*4*4);pixels[3]=8;pixels[(1*4+1)*4+3]=255;pixels[(3*4+2)*4+3]=200;
 assert.deepEqual(alphaBounds(pixels,4,4,8),{x:1,y:1,width:2,height:3});
 assert.equal(alphaBounds(new Uint8ClampedArray(4*4*4),4,4,8),null);
 assert.throws(()=>validateMetadata({...meta,items:[{...meta.items[0],environmentOutput:meta.items[0].source}]}),/new, distinct PNG/);
});
