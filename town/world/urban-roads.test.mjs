import test from 'node:test';
import assert from 'node:assert/strict';
import {roadDefinitions,roadFootprint,snapUrbanAsset,ROAD_SIZE,ROAD_MARGIN,ROAD_WIDTH} from './urban-roads.mjs';
const paved=(definition,x,y)=>roadFootprint(definition).some(r=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h);
const point=(side,along,depth=1)=>({north:{x:along,y:depth},east:{x:ROAD_SIZE-depth-1,y:along},south:{x:along,y:ROAD_SIZE-depth-1},west:{x:depth,y:along}}[side]);
test('all street shapes meet the same walkable road and sidewalk profile at each open edge',()=>{
 assert.equal(roadDefinitions.length,15);assert.equal(new Set(roadDefinitions.map(d=>d.id)).size,15);
 for(const d of roadDefinitions)for(const side of ['north','east','south','west'])for(let t=0;t<ROAD_SIZE;t++){
  const p=point(side,t),expected=d.open.includes(side)&&t>=ROAD_MARGIN&&t<ROAD_MARGIN+ROAD_WIDTH;
  assert.equal(paved(d,p.x,p.y),expected,d.id+' '+side+' '+t);
 }
});
test('every declared junction and corner connects its open approaches without a road gap',()=>{
 for(const d of roadDefinitions){
  const visited=new Set(['512,512']),queue=[{x:512,y:512}];
  for(let n=0;n<queue.length;n++)for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){
   const p={x:queue[n].x+dx,y:queue[n].y+dy},k=p.x+','+p.y;
   if(p.x<0||p.y<0||p.x>=1024||p.y>=1024||visited.has(k)||!paved(d,p.x,p.y))continue;visited.add(k);queue.push(p);
  }
  for(const side of d.open){const p={north:{x:512,y:0},east:{x:960,y:512},south:{x:512,y:960},west:{x:0,y:512}}[side];assert.ok(visited.has(p.x+','+p.y),d.id+' '+side);}
 }
});
test('road anchors preserve texture phase, rotation-safe grid alignment, and full-module joins',()=>{
 for(const p of [{x:131,y:280},{x:2490,y:950},{x:8100,y:6200}]){
  const a=snapUrbanAsset({snap:512},p),next=snapUrbanAsset({snap:512},{x:a.x+1024,y:a.y});
  assert.equal(a.x%512,0);assert.equal(a.y%512,0);assert.equal(next.x-a.x,1024);assert.equal(next.y,a.y);
  assert.equal(Math.abs((a.x-ROAD_SIZE/2)%512),0);assert.equal(Math.abs((a.y-ROAD_SIZE)%512),0);
 }
 assert.deepEqual(snapUrbanAsset({snap:64},{x:127,y:191,extra:true}),{x:128,y:192,extra:true});
 assert.deepEqual(snapUrbanAsset({}, {x:12.5,y:19.5}),{x:12.5,y:19.5});
});
