import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked,height,parseProject,History} from './model.mjs';
import {encodePaint} from './ground-paint.mjs';
import {encodeMask} from './organic-mask.mjs';
import {sidewalkCurbSegments,sidewalkCurbCorners,drawSidewalkCurbs} from './sidewalk-curbs.mjs';

const sidewalk=(level=0)=>({surface:'sidewalk',level,sidewalkCurb:true});
const sides=(d,x=10,y=10)=>sidewalkCurbSegments(d,x,y).map(s=>s.side);
const length=d=>Object.entries(d.cells).reduce((sum,[k])=>sum+sidewalkCurbSegments(d,...k.split(',').map(Number)).reduce((n,s)=>n+s.dx+s.dy,0),0);

test('a square sidewalk has exactly four outer borders at its actual elevation',()=>{
 const d=blank();d.cells['10,10']=sidewalk(2);
 assert.deepEqual(sides(d),['north','east','south','west']);
 for(const s of sidewalkCurbSegments(d,10,10)){assert.equal(s.z,96);assert.equal(s.dx+s.dy,64);}
 assert.equal(length(d),256);
});

test('adjoining squares remove the internal seam and repainting or erasing restores it',()=>{
 const d=blank();d.cells['10,10']=sidewalk();d.cells['11,10']=sidewalk();
 assert.deepEqual(sides(d),['north','south','west']);assert.deepEqual(sides(d,11,10),['north','east','south']);assert.equal(length(d),384);
 d.cells['11,10']={surface:'asphalt',level:0};assert(sides(d).includes('east'));
 delete d.cells['11,10'];assert(sides(d).includes('east'));
});

test('a two-by-two block and L expose only their perimeter, with a clean inside corner cap',()=>{
 const d=blank();for(const k of ['10,10','11,10','10,11','11,11'])d.cells[k]=sidewalk();
 assert.equal(length(d),512);assert.equal(sidewalkCurbCorners(d,10,10).length,0);
 delete d.cells['11,11'];assert.equal(length(d),512);
 assert.deepEqual(sidewalkCurbCorners(d,10,10),[{corner:'se',x:704,y:704,z:0,sx:1,sy:1}]);
});

test('unflagged sidewalks and soft-painted ground generate no curbs but can join square paving',()=>{
 const d=blank();d.cells['10,10']={surface:'sidewalk',level:0};assert.deepEqual(sides(d),[]);
 const paint=encodePaint([{surface:'sidewalk'}],new Uint8Array(256).fill(255));
 d.cells['10,10']={surface:'grass',level:0,paint};assert.deepEqual(sides(d),[]);
 d.cells['9,10']=sidewalk();assert(!sides(d,9,10).includes('east'));
 d.cells['10,10']={surface:'sidewalk',level:0};assert(!sides(d,9,10).includes('east'));
});

test('joins follow visible paint at the edge rather than its hidden grass or sidewalk base',()=>{
 const d=blank();d.cells['10,10']=sidewalk();
 const weights=new Uint8Array(512);for(let i=0;i<256;i++)weights[i*2+(Math.floor(i/16)<8?1:0)]=255;
 d.cells['11,10']={surface:'grass',level:0,paint:encodePaint([{surface:'grass'},{surface:'sidewalk'}],weights)};
 const edge=sidewalkCurbSegments(d,10,10).filter(s=>s.side==='east');
 assert.deepEqual(edge.map(s=>[s.y,s.dy]),[[672,32]]);
 d.cells['11,10']={surface:'sidewalk',level:0,paint:encodePaint([{surface:'dirt'}],new Uint8Array(256).fill(255))};
 assert(sides(d).includes('east'));
});

test('different elevations keep their own borders and stairs or bridges never generate them',()=>{
 const d=blank();d.cells['10,10']=sidewalk(1);d.cells['11,10']=sidewalk(2);
 const east=sidewalkCurbSegments(d,10,10).find(s=>s.side==='east');assert(east);assert.equal(east.shadow,false);
 assert(sides(d,11,10).includes('west'));
 d.cells['10,10']={...sidewalk(),stairs:'north'};assert.deepEqual(sides(d),[]);
 d.cells['10,10']={...sidewalk(),bridge:'ew'};assert.deepEqual(sides(d),[]);
});

test('organic cutouts do not receive a square border across missing foreground',()=>{
 const d=blank(),bits=Uint8Array.from({length:256},(_,i)=>i%16<8?1:0);
 d.cells['10,10']={...sidewalk(1),curves:[{kind:'height',corner:'nw',cx:704,cy:704,r:64,underX:11,underY:10,under:{surface:'grass',level:0},mask:encodeMask(bits)}]};
 assert(!sides(d).includes('east'));assert.deepEqual(sidewalkCurbSegments(d,10,10).filter(s=>s.side==='north').map(s=>s.dx),[32]);
});

test('derived curbs are walkable, portable, reversible and do not modify the map while rendering',()=>{
 const d=blank();d.cells['10,10']=sidewalk();const before=JSON.stringify(d),history=new History();history.record(d);
 const c={save(){},restore(){},translate(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){}};
 drawSidewalkCurbs(c,d,10,10);assert.equal(JSON.stringify(d),before);
 for(const [x,y]of [[641,672],[703,672],[672,641],[672,703]]){assert.equal(blocked(d,x,y,new Map()),false);assert.equal(height(d,x,y),0);}
 assert.deepEqual(parseProject(before,new Set()),d);d.cells['11,10']=sidewalk();const restored=history.back(d);assert.equal(JSON.stringify(restored),before);assert.equal(length(history.forward(restored)),384);
});
