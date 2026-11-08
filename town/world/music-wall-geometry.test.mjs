import {test} from 'node:test';
import assert from 'node:assert/strict';
import {musicSquareWalls,musicSquareAnchors,musicSquarePoint,musicSquareLocalPoint,nearestMusicWallAnchor,musicWallNode,planMusicWall,connectMusicWall} from './music-wall-geometry.mjs';
const square={id:'square',asset:'music-square',x:8197.75,y:7003.25,scale:1,rotation:0};
const dist=(p,s)=>Math.hypot(p.x-Math.max(s.x,Math.min(s.x+s.dx,p.x)),p.y-Math.max(s.y,Math.min(s.y+s.dy,p.y)));
const decode=k=>{const[,x,y,dx,dy]=k.split(':').map((n,i)=>i?Number(n):n);return {x,y,dx,dy};};
const close=(a,b)=>assert(Math.abs(a-b)<.0002,`${a} differs from ${b}`);

test('native perimeter describes the painted stone walls and leaves all four entrances open',()=>{
 const o={...square,x:1200,y:1600},walls=musicSquareWalls(o),anchors=musicSquareAnchors(o);assert.equal(walls.length,8);assert.equal(anchors.length,12);
 assert.equal(new Set(anchors.map(a=>`${a.x},${a.y}`)).size,12);
 for(const s of walls){assert(s.dx===0||s.dy===0);assert(s.dx>=0&&s.dy>=0);assert(s.width>=32);assert(s.x>=0&&s.y>=0&&s.x+s.dx<=2400&&s.y+s.dy<=1600);}
 for(const p of [{x:768,y:96},{x:768,y:992},{x:48,y:512},{x:1488,y:512}])assert(Math.min(...walls.map(s=>dist(musicSquarePoint(o,p),s)))>100);
 for(const p of anchors)assert.equal(Math.min(...walls.map(s=>dist(p,s))),0);
});

test('off-grid, rotated and resized squares retain their exact native attachment positions',()=>{
 for(const rotation of [0,90,180,270])for(const scale of [.25,.75,1,3]){
  const o={...square,rotation,scale},a=musicSquareAnchors(o).find(p=>p.id==='north-west-gate'),local=musicSquareLocalPoint(o,a);
  close(local.x,612);close(local.y,96);assert.equal(a.wallScale,scale);
  const snapped=musicWallNode({objects:[o],edges:{}},{x:a.x+3,y:a.y-2});close(snapped.x,a.x);close(snapped.y,a.y);assert.equal(snapped.objectId,o.id);assert.equal(snapped.wallScale,scale);
 }
});

test('wall faces accept T attachments, rather than forcing every join to a corner',()=>{
 for(const rotation of [0,90,180,270]){
  const o={...square,rotation},p=musicSquarePoint(o,{x:365,y:96}),near=rotation%180?{x:p.x+10,y:p.y}:{x:p.x,y:p.y+10},a=nearestMusicWallAnchor({objects:[o]},near,{radius:20});
  assert(a);close(a.x,p.x);close(a.y,p.y);assert.equal(a.wallId,'north-west');close(a.local.x,365);close(a.local.y,96);
 }
});

test('an active 64-pixel stroke escapes the baked wall magnet and retains its scale',()=>{
 const o={...square,scale:.75},doc={objects:[o],edges:{}},start=musicWallNode(doc,musicSquarePoint(o,{x:612,y:96})),end=musicWallNode(doc,{x:start.x,y:start.y-64},start,{radius:24});
 close(end.x,start.x);close(end.y,start.y-64);const edges=planMusicWall(start,end);assert.equal(edges.length,1);assert.equal(edges[0][1].wallScale,.75);assert.equal(decode(edges[0][0]).dy,64);
});

test('partial end pieces and L corners form a gap-free orthogonal line in either straight direction',()=>{
 const a={x:73.75,y:221.125},b={x:330.5,y:221.125},forward=planMusicWall(a,b),backward=planMusicWall(b,a);
 assert.deepEqual(forward,backward);assert.equal(forward.length,5);let end=a.x,total=0;
 for(const[k,e]of forward){const s=decode(k);close(s.x,end);assert(s.dx>0&&s.dx<=64);assert.equal(s.dy,0);assert.equal(s.y,a.y);assert.equal(e.style,'music-square');end=s.x+s.dx;total+=s.dx;}
 close(end,b.x);close(total,b.x-a.x);
 const turn=planMusicWall(a,{x:265.75,y:413.125}).map(([k])=>decode(k));assert.equal(turn.length,6);assert(turn.every(s=>!!s.dx!==!!s.dy));assert.equal(turn[2].x+turn[2].dx,turn[3].x);assert.equal(turn[2].y,turn[3].y);
});

test('a second stroke snaps to the existing off-grid endpoint and continues the same wall',()=>{
 const o={...square,scale:.75},doc={objects:[o],edges:{}},start=musicWallNode(doc,musicSquarePoint(o,{x:612,y:96})),end={x:start.x,y:start.y-128,wallScale:.75};
 assert.equal(connectMusicWall(doc,start,end),2);const restored=JSON.parse(JSON.stringify(doc)),again=musicWallNode(restored,{x:end.x+3,y:end.y-2});
 close(again.x,end.x);close(again.y,end.y);assert.equal(again.wallScale,.75);assert(again.existingEdge);assert.equal(again.baked,false);
 const next=musicWallNode(restored,{x:end.x+64,y:end.y},again,{radius:24});assert.equal(connectMusicWall(restored,again,next),1);assert.equal(Object.keys(restored.edges).length,3);
 assert(Object.values(restored.edges).every(e=>e.wallScale===.75));
});

test('snapping does not repaint an existing baked wall and entrances close only when explicitly drawn across',()=>{
 const doc={objects:[square],edges:{}},a=nearestMusicWallAnchor(doc,musicSquarePoint(square,{x:300,y:96})),b=nearestMusicWallAnchor(doc,musicSquarePoint(square,{x:400,y:96}));assert.deepEqual(planMusicWall(a,b),[]);
 const ends=musicSquareAnchors(square),left=ends.find(a=>a.id==='north-west-gate'),right=ends.find(a=>a.id==='north-east-gate'),gate=planMusicWall(left,right,true);assert(gate.length>0);assert(gate.every(([,e])=>e.gate&&!e.open));
 assert.deepEqual(planMusicWall({x:-1,y:64},{x:64,y:64}),[]);assert.deepEqual(planMusicWall({x:64,y:64},{x:NaN,y:64}),[]);
});

test('an existing extension can become a gate and a gate can become a closed stone wall',()=>{
 const doc={objects:[],edges:{}};connectMusicWall(doc,{x:8000.5,y:6000.25},{x:8064.5,y:6000.25});
 let a=musicWallNode(doc,{x:8000.5,y:6000.25}),b=musicWallNode(doc,{x:8064.5,y:6000.25});
 assert.equal(planMusicWall(a,b).length,0);assert.equal(connectMusicWall(doc,a,b,{gate:true}),1);assert.equal(Object.values(doc.edges)[0].gate,true);
 a=musicWallNode(doc,{x:8000.5,y:6000.25});b=musicWallNode(doc,{x:8064.5,y:6000.25});
 assert.equal(connectMusicWall(doc,a,b),1);assert.equal(Object.values(doc.edges)[0].gate,false);assert.equal(Object.keys(doc.edges).length,1);
});
