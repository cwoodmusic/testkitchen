import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,height,surfaceAt,blocked,parseProject} from '../world/model.mjs';
import {roundTerrain} from './round-terrain.mjs';
import {insideCurve,frontEdge} from '../world/round-geometry.mjs';
const directions=[[-1,-1,'nw'],[1,-1,'ne'],[-1,1,'sw'],[1,1,'se']];
const apply=(d,p,width=3,style='smooth')=>{const r=roundTerrain(d,p,width,style);Object.assign(d.cells,Object.fromEntries(r.edits));return r;};
function notch(dx,dy,surface='grass'){
 const d=blank(),high={surface,level:surface==='grass'?3:0};
 for(let y=10;y<30;y++)for(let x=10;x<30;x++)if(!((dx<0?x>=20:x<20)&&(dy<0?y>=20:y<20)))d.cells[`${x},${y}`]={...high};
 return {d,p:{x:(dx<0?20.5:19.5)*64,y:(dy<0?20.5:19.5)*64},vertex:{x:1280,y:1280}};
}
test('inside land corners add a fillet in all four orientations without cutting the arms',()=>{
 for(const[dx,dy,corner]of directions)for(const style of ['smooth','rocky','bevel']){
  const {d,p,vertex:v}=notch(dx,dy),near={x:v.x-dx*8,y:v.y-dy*8};assert.equal(height(d,near.x,near.y),0);
  const r=apply(d,p,3,style),q=r.edits.flatMap(([,a])=>a.curves||[]).find(q=>q.concave);
  assert(q,corner+' '+style);assert.equal(q.corner,corner);assert.equal(q.r,192);assert.equal(height(d,near.x,near.y),144);
  assert.equal(height(d,v.x-dx*160,v.y-dy*160),0);assert.equal(height(d,v.x+dx*32,v.y-dy*96),144);assert.equal(height(d,v.x-dx*96,v.y+dy*32),144);
  assert(blocked(d,near.x,near.y,new Map(),{x:v.x-dx*160,y:v.y-dy*160}));assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set()));
 }
});
test('inside water and paving corners use the same physical material boundary',()=>{
 for(const[dx,dy]of directions)for(const surface of ['water','cobble']){
  const {d,p,vertex:v}=notch(dx,dy,surface);apply(d,p,3,'smooth');
  const x=v.x-dx*8,y=v.y-dy*8;assert.equal(surfaceAt(d,x,y),surface);assert.equal(surfaceAt(d,v.x-dx*160,v.y-dy*160),'grass');
  assert.equal(blocked(d,x,y,new Map()),surface==='water');assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set()));
 }
});
test('inside corner restyles preserve the radius and restore the original smooth geometry',()=>{
 const {d,p}=notch(-1,-1);apply(d,p,3,'smooth');const samples=[];
 for(let y=1281;y<1472;y+=8)for(let x=1281;x<1472;x+=8)samples.push([x,y,height(d,x,y)]);
 for(const style of ['rocky','bevel','smooth']){const r=apply(d,p,1,style);assert.equal(r.corners,1);assert(r.edits.every(([,a])=>a.curves.every(q=>q.r===192&&q.concave&&q.style===style)));}
 for(const[x,y,z]of samples)assert.equal(height(d,x,y),z);
});
test('small enclosed holes retain their original lower floor without a donor self-reference',()=>{
 const d=blank();for(let y=10;y<30;y++)for(let x=10;x<30;x++)d.cells[`${x},${y}`]={surface:'grass',level:3};d.cells['20,20']={surface:'grass',level:0};
 const r=apply(d,{x:1312,y:1312},1);assert.equal(r.corners,4);const a=d.cells['20,20'];assert(a.curves.every(q=>q.concave&&q.under?.level===0));
 assert.equal(height(d,1284,1284),144);assert.equal(height(d,1312,1312),0);assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set()));
 const bad=structuredClone(d);bad.cells['20,20'].curves[0].under.curves=[];assert.throws(()=>parseProject(JSON.stringify(bad),new Set()),/curve/);
});
test('neighboring inside fillets cannot raise each other\'s lower floor in the same stroke',()=>{
 const d=blank();for(const[x,y]of [[15,12],[14,11],[15,11],[12,13],[13,14],[12,14]])d.cells[`${x},${y}`]={surface:'grass',level:3};
 apply(d,{x:14.5*64,y:12.5*64},8);
 assert.equal(height(d,14*64+2,12*64+62),0);assert.equal(height(d,13*64+62,13*64+2),0);
 assert(d.cells['14,12'].curves.some(q=>q.concave&&q.under?.level===0));assert(d.cells['13,13'].curves.some(q=>q.concave&&q.under?.level===0));
 assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set()));
});
test('inside fills preserve lower floors used by new and previously saved outside corners',()=>{
 const make=()=>{const d=blank();for(const[x,y]of [[17,15],[15,16],[15,17],[16,17]])d.cells[`${x},${y}`]={surface:'grass',level:3};return d;};
 const together=make();apply(together,{x:16.5*64,y:16.5*64},8);assert.equal(height(together,1089,1023),0);assert(together.cells['17,15'].curves.some(q=>!q.concave&&q.under?.level===0));
 const separate=make();apply(separate,{x:17.5*64,y:15.5*64},1);assert.equal(height(separate,1089,1023),0);
 const before=JSON.stringify(separate),r=roundTerrain(separate,{x:16.5*64,y:16.5*64},1);assert.equal(JSON.stringify(separate),before,'planning must not mutate existing masks');assert(r.edits.some(([k])=>k==='17,15'),'the affected older corner joins this undoable stroke');
 Object.assign(separate.cells,Object.fromEntries(r.edits));assert.equal(height(separate,1089,1023),0);assert.doesNotThrow(()=>parseProject(JSON.stringify(separate),new Set()));
});
test('a broad stroke shrinks or skips incompatible material and height masks in staged cells',()=>{
 const d=blank();for(const[k,surface]of [['19,17','grass'],['18,18','cobble'],['19,18','grass'],['20,18','grass'],['18,19','cobble'],['19,19','cobble'],['20,19','cobble'],['20,20','grass']])d.cells[k]={surface,level:3};
 const r=apply(d,{x:16.5*64,y:16.5*64},8);assert(r.edits.length>0);for(const a of Object.values(d.cells))if(a.curves)assert.equal(new Set(a.curves.map(q=>q.kind)).size,1,'one cell cannot mix floor and height cutouts');
 assert.doesNotThrow(()=>parseProject(JSON.stringify(d),new Set()));
});
test('concave front edges agree with collision geometry for each style',()=>{
 for(const corner of ['nw','ne'])for(const style of ['smooth','rocky','bevel']){
  const q={corner,cx:corner==='nw'?128:64,cy:128,r:64,kind:'height',concave:true,style};
  for(const x of [80,96,112]){const edge=frontEdge({curves:[q]},x,1);assert(edge>=64&&edge<128);assert(insideCurve(q,x,edge-.05));assert(!insideCurve(q,x,edge+.05));}
 }
});
