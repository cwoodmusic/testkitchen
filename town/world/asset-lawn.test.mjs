import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lawnCoverage,supportsLawnReveal} from './asset-lawn.mjs';

function pixels(width=100,height=100,color=[90,125,28,255]){
 const data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++)data.set(color,i*4);
 return {data,width,height};
}
function fill(image,x,y,w,h,color){for(let Y=y;Y<y+h;Y++)for(let X=x;X<x+w;X++)image.data.set(color,(Y*image.width+X)*4);}

test('scene lawn reveal is limited to Music Square and home estates',()=>{
 for(const id of ['music-square','estate-bach','estate-player'])assert(supportsLawnReveal({id}));
 for(const id of ['house-square-0','props-2-65','decor-14-01','urban-road-straight-ns'])assert.equal(supportsLawnReveal({id}),false);
});

test('only perimeter-connected lawn is removed and scene interiors remain intact',()=>{
 const image=pixels(),before=new Uint8ClampedArray(image.data),coverage=lawnCoverage(image,{id:'music-square',w:100,h:100,boxes:[]});
 assert.equal(coverage[0],255);assert.equal(coverage[2*100+50],255);assert.equal(coverage[50*100+50],0);assert.equal(coverage[50*100+10],0);
 assert.deepEqual(image.data,before);
});

test('stone, colorful flowers, and protected house architecture never become ground holes',()=>{
 const image=pixels();fill(image,0,10,5,15,[185,156,128,255]);fill(image,95,20,5,15,[220,150,210,255]);
 const coverage=lawnCoverage(image,{id:'estate-green-roof',w:100,h:100,boxes:[{x:0,y:40,w:15,h:20}]});
 assert.equal(coverage[0],255);assert.equal(coverage[15*100+2],0);assert.equal(coverage[25*100+98],0);assert.equal(coverage[50*100+2],0);assert.equal(coverage[50*100+98],255);
});

test('an isolated green decoration is protected even when its color matches lawn',()=>{
 const image=pixels(100,100,[180,150,120,255]);fill(image,0,0,100,2,[90,125,28,255]);fill(image,10,10,5,5,[90,125,28,255]);
 const coverage=lawnCoverage(image,{id:'estate-test',w:100,h:100,boxes:[]});
 assert(coverage[0]>0);assert.equal(coverage[12*100+12],0);
});
