import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank} from './model.mjs';
import {encodePaint} from './ground-paint.mjs';
import {encodeMask} from './organic-mask.mjs';
import {createSandFootprints,sandCoverage,footprintOpacity} from './sand-footprints.mjs';

function beach(){const d=blank();for(let y=10;y<18;y++)for(let x=10;x<30;x++)d.cells[`${x},${y}`]={surface:'sand',level:0};return d;}
function walk(doc,fps=60,{distance=440,duration=1}={}){
 const footprints=createSandFootprints({getProject:()=>doc}),actor={id:'player',x:672,y:800,walking:true};footprints.update([actor],0);
 for(let i=1;i<=fps*duration;i++){actor.x=672+distance*i/(fps*duration);footprints.update([actor],i/fps);}
 return footprints;
}

test('sand walking creates alternating impressions from distance at any ordinary frame rate',()=>{
 const d=beach(),before=JSON.stringify(d),slow=walk(d,20),fast=walk(d,120);
 assert.equal(slow.marks.length,10);assert.equal(fast.marks.length,10);
 for(let i=0;i<slow.marks.length;i++){
  const a=slow.marks[i],b=fast.marks[i];assert(Math.abs(a.x-b.x)<1e-6);assert(Math.abs(a.y-b.y)<1e-6);assert(Math.abs(a.born-b.born)<1e-6);assert.equal(a.side,i%2?1:-1);
 }
 assert.equal(JSON.stringify(d),before);
});

test('footprints recognize painted and rounded sand, excluding water, stairs, bridges and other materials',()=>{
 const d=blank(),weights=new Float64Array(512);for(let i=0;i<256;i++){weights[i*2]=i%16<8?35:255;weights[i*2+1]=i%16<8?220:0;}
 d.cells['10,10']={surface:'grass',level:1,paint:encodePaint([{surface:'grass'},{surface:'sand'}],weights)};
 assert(sandCoverage(d,650,650)>.8);assert.equal(sandCoverage(d,690,650),0);
 const bits=Uint8Array.from({length:256},(_,i)=>i%16<8?1:0);
 d.cells['11,10']={surface:'grass',level:2,curves:[{kind:'height',corner:'nw',cx:768,cy:704,r:64,underX:12,underY:10,under:{surface:'sand',level:0},mask:encodeMask(bits)}]};
 assert.equal(sandCoverage(d,710,650),0);assert.equal(sandCoverage(d,750,650),1);
 d.cells['12,10']={surface:'sand',level:0,bridge:'ew'};d.cells['13,10']={surface:'sand',level:0,stairs:'north'};d.cells['14,10']={surface:'water',level:0};
 for(const x of [800,864,928,-1])assert.equal(sandCoverage(d,x,650),0);
 const noSand=walk(blank(),60);assert.equal(noSand.marks.length,0);
});

test('the full shoe stays on sand and cannot straddle a shoreline',()=>{
 const d=blank();for(let x=10;x<22;x++)d.cells[`${x},10`]={surface:'sand',level:0};
 const traces=createSandFootprints({getProject:()=>d}),p={id:'p',x:650,y:641,walking:true};traces.update([p],0);
 for(let i=1;i<=60;i++){p.x=650+440*i/60;traces.update([p],i/60);}
 assert(traces.marks.length>0);assert(traces.marks.every(mark=>mark.y>640));assert(traces.marks.every(mark=>mark.side===1));
});

test('impressions fade over seconds and expire even when pedestrians are hidden',()=>{
 const d=beach(),traces=walk(d),mark=traces.marks[0],fresh=footprintOpacity(mark,mark.born),middle=footprintOpacity(mark,mark.born+3.5);
 assert(fresh>.35);assert(middle>0&&middle<fresh);assert.equal(footprintOpacity(mark,mark.born+4.5),0);
 traces.update([],6);assert.equal(traces.marks.length,0);
});

test('teleports, stationary animation and map changes do not create a dotted line across the world',()=>{
 let d=beach();const traces=createSandFootprints({getProject:()=>d}),p={id:'p',x:672,y:800,walking:true};traces.update([p],0);
 p.x=1200;traces.update([p],1/60);assert.equal(traces.marks.length,0);
 for(let i=2;i<20;i++)traces.update([p],i/60);assert.equal(traces.marks.length,0);
 p.x=1244;p.walking=false;traces.update([p],.4);assert.equal(traces.marks.length,0);
 p.x=1288;p.walking=true;traces.update([p],.5);assert(traces.marks.length>0);
 d=beach();traces.update([p],.6);assert.equal(traces.marks.length,0);
});

test('the transient history has a fixed cap and a rewound clock clears old tracks',()=>{
 const d=beach(),traces=createSandFootprints({getProject:()=>d,maxMarks:6,step:24}),p={id:'p',x:672,y:800,walking:true};traces.update([p],0);
 for(let i=1;i<=90;i++){p.x=672+i*10;traces.update([p],i/60);}
 assert.equal(traces.marks.length,6);const previous=traces.marks[0].x;traces.marks[0].x=1;assert.equal(traces.marks[0].x,previous);
 traces.update([p],0);assert.equal(traces.marks.length,0);
});
