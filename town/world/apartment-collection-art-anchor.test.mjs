import test from'node:test';import assert from'node:assert/strict';
import{collectionFloorBaseU,collectionImageRect}from'./apartment-collection-art.mjs';
function fixture(w,h){const p=new Uint8ClampedArray(w*h*4);return{p,rect(x,y,W,H,a=255){for(let Y=y;Y<y+H;Y++)for(let X=x;X<x+W;X++)p[(Y*w+X)*4+3]=a;}};}
test('pictured lamp-base centroid ignores the overhanging shade and faint shadow',()=>{
 const f=fixture(20,40);f.rect(0,0,20,28);f.rect(3,38,4,2);f.rect(17,38,3,2,64);const old=f.p.slice();assert.equal(collectionFloorBaseU(f.p,20,40),.25);assert.deepEqual(f.p,old);
});
test('base measurement keeps symmetric feet centred and has a transparent fallback',()=>{
 const f=fixture(20,40);f.rect(0,38,3,2);f.rect(17,38,3,2);assert.equal(collectionFloorBaseU(f.p,20,40),.5);assert.equal(collectionFloorBaseU(new Uint8ClampedArray(40),5,2),.5);
});
test('the source anchor changes horizontal picture alignment while preserving the physical height',()=>{
 const def={w:152,h:190},frame={w:210,h:180},rect=collectionImageRect(def,frame),physicalY=177,foot=[.23,(physicalY-rect.y)/rect.h];
 assert.equal(rect.y+foot[1]*rect.h,physicalY);assert.ok(rect.x+foot[0]*rect.w<def.w/2);assert.equal(rect.w/rect.h,frame.w/frame.h);
});
