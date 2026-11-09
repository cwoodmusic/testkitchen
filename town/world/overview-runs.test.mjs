import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareOverviewRuns} from './overview-runs.mjs';

const bounds={x0:1,x1:7,y0:1,y1:5};
function document(surface='grass',level=0){
 const cells={};for(let y=0;y<=5;y++)for(let x=0;x<=7;x++)cells[`${x},${y}`]={surface,level};return {cells};
}
function context(){
 const calls=[],patterns=[];
 return {calls,patterns,clearRect:(...args)=>calls.push(['clear',...args]),fillRect:(...args)=>calls.push(['fill',...args]),
  createPattern(source,repeat){const value={source,repeat,setTransform(matrix){this.matrix=matrix;}};patterns.push(value);return value;}
 };
}
const textures=Object.fromEntries(['grass','dirt','sand','wood','asphalt','sidewalk','brick'].map(surface=>[surface,{surface,width:512,height:512}]));

test('flat dry rows use exact texture and global projected phase',()=>{
 for(const surface of Object.keys(textures)){
  const d=document(surface,4),before=JSON.stringify(d),c=context(),r=prepareOverviewRuns(d,bounds,s=>textures[s]);
  assert.equal(r.cells,24);assert.equal(r.runs,4);
  assert.equal(r.draw(c,1,1),7);assert.deepEqual(c.calls,[['fill',64,64-192,384,64]]);
  assert.equal(c.patterns[0].source,textures[surface]);assert.deepEqual(c.patterns[0].matrix,{a:1,b:0,c:0,d:1,e:0,f:-192});
  r.draw(c,1,2);assert.equal(c.patterns.length,1);
  assert.equal(JSON.stringify(d),before);
 }
});

test('a material change splits runs without removing neighboring floor',()=>{
 const d=document();d.cells['3,2'].surface='dirt';d.cells['4,2'].surface='dirt';
 const r=prepareOverviewRuns(d,bounds,s=>textures[s]),c=context();
 assert.equal(r.draw(c,1,2),3);assert.equal(r.draw(c,3,2),5);assert.equal(r.draw(c,5,2),7);
 assert.deepEqual(c.calls,[['fill',64,128,128,64],['fill',192,128,128,64],['fill',320,128,128,64]]);
});

test('painted and complex cells retain their per-cell rendering',()=>{
 for(const change of [{paint:{}},{curves:[{}]},{stairs:'north'},{bridge:'ns'},{pier:{level:1}},{sidewalkCurb:true},{surface:'cobble'},{level:NaN}]){
  const d=document();Object.assign(d.cells['3,2'],change);const r=prepareOverviewRuns(d,bounds,s=>textures[s]);
  assert.equal(r.draw(context(),3,2),3,JSON.stringify(change));
 }
 for(const change of [{paint:{}},{curves:[{}]},{stairs:'north'},{bridge:'ns'},{pier:{level:1}},{sidewalkCurb:true},{level:1}]){
  const d=document();Object.assign(d.cells['2,2'],change);const r=prepareOverviewRuns(d,bounds,s=>textures[s]);
  assert.equal(r.draw(context(),3,2),3,'Cardinal neighbor '+JSON.stringify(change));
 }
 const d=document();d.cells['2,1'].paint={};assert.equal(prepareOverviewRuns(d,bounds,s=>textures[s]).draw(context(),3,2),3,'Diagonal paint affects interpolation');
});

test('only interior level-zero sea clears a combined cutout',()=>{
 const d=document('water'),c=context(),r=prepareOverviewRuns(d,bounds,()=>{throw Error('Water must not sample a static texture');});
 assert.equal(r.draw(c,1,1),7);assert.deepEqual(c.calls,[['clear',64,64,384,64]]);
 for(const change of [{surface:'grass'},{level:1},{curves:[{}]},{bridge:'ew'},{paint:{}}]){
  const other=document('water');Object.assign(other.cells['2,2'],change);
  assert.equal(prepareOverviewRuns(other,bounds).draw(context(),3,2),3,JSON.stringify(change));
 }
 assert.equal(prepareOverviewRuns(document('water',2),bounds).draw(context(),3,2),3,'Raised lakes stay live');
});

test('padded cell references are read once and draw performs no document lookup',()=>{
 const original=document(),cells=original.cells;let reads=0;
 const d={cells:new Proxy(cells,{get(target,key){reads++;return target[key];}})};
 const r=prepareOverviewRuns(d,bounds,s=>textures[s]);assert.equal(reads,(6+2)*(4+2));
 for(let y=1;y<5;y++)r.draw(context(),1,y);assert.equal(reads,48);
 assert.equal(r.draw(context(),3,2),7,'A run may start at a later eligible cell');
 assert.equal(r.draw(context(),0,2),0);assert.equal(r.draw(context(),7,2),7);assert.equal(r.draw(context(),1,5),1);
 assert.equal(prepareOverviewRuns(d,{x0:2,x1:2,y0:2,y1:3}).draw(context(),2,2),2);
});

test('each bake sees edits and patterns stay local to context and source identity',()=>{
 const d=document(),c=context(),r=prepareOverviewRuns(d,bounds,s=>textures[s]);r.draw(c,1,1);r.draw(c,1,2);assert.equal(c.patterns.length,1);
 const other=context();r.draw(other,1,1);assert.equal(other.patterns.length,1);
 d.cells['2,2'].level=1;assert.equal(prepareOverviewRuns(d,bounds,s=>textures[s]).draw(c,3,2),3);
 const restore=structuredClone(d);restore.cells['2,2'].level=0;
 assert.equal(prepareOverviewRuns(restore,bounds,s=>textures[s]).draw(c,3,2),7);
});
