import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {decorDefinitions} from './decor-definitions.mjs';
import {musicSquareCollisionGeometry,musicSquareSceneParts,decorCollisionBoxes,propCollisionBoxes,gazeboSceneParts,urbanBuildingCollision} from './scene-collision.mjs';

function fixture(asset,w,h,geometry,rotation=0,scale=1){
 const doc=blank(),o={id:'fixture',asset,x:8192,y:6144,scale,rotation,collision:true,layer:'objects'};doc.objects.push(o);
 const catalog=new Map([[asset,{w,h,boxes:geometry.boxes||[],polygons:geometry.polygons||[]}]]);
 const local=(x,y)=>{const r=rotation*Math.PI/180,dx=(x-w/2)*scale,dy=(y-h)*scale;return {x:o.x+dx*Math.cos(r)-dy*Math.sin(r),y:o.y+dx*Math.sin(r)+dy*Math.cos(r)};};
 return {doc,catalog,hit:(x,y)=>{const p=local(x,y);return blocked(doc,p.x,p.y,catalog);}};
}

test('native square benches, beds, lamp plinths and fountain block occupied artwork while approaches stay open',()=>{
 const solids=[[390,205],[1140,205],[240,175],[550,165],[980,165],[1300,175],[242,451],[1290,451],[267,765],[1265,765],[140,230],[1400,230],[130,900],[1400,900],[1285,932],[768,480]];
 const clear=[[360,245],[426,245],[1110,245],[1176,245],[430,540],[1100,540],[768,110],[768,960],[45,490],[1490,490],[768,720]];
 for(const rotation of [0,90,180,270])for(const scale of [.5,1,2]){
  const f=fixture('music-square',2400,1600,musicSquareCollisionGeometry(),rotation,scale);
  for(const[x,y]of solids)assert(f.hit(x*2400/1536,y*1600/1024),`Expected raised artwork ${x},${y} to block at ${rotation}/${scale}`);
  for(const[x,y]of clear)assert(!f.hit(x*2400/1536,y*1600/1024),`Expected walkway ${x},${y} open at ${rotation}/${scale}`);
 }
});

test('bench and planter collision covers their seat/base, not the narrow old foot strip',()=>{
 for(const id of ['decor-06-01','decor-06-02','decor-06-03','decor-08-02']){
  const def=decorDefinitions.find(d=>d.id===id),f=fixture(id,200,180,{boxes:decorCollisionBoxes(def,200,180)});
  assert(f.hit(100,120),id+' should block its seat or container');assert(!f.hit(100,225),id+' approach should remain clear');
 }
 const defs=decorDefinitions.filter(d=>d.group==='foliage and rocks'&&d.index<13);
 assert.equal(defs.length,13);assert(defs.every(d=>d.npcAvoid&&d.depthSorted));
 assert(defs.filter(d=>/daisy|iris/.test(d.name)).every(d=>d.solid===false),'Player collision defaults on loose flowers stay optional');
 const mount=decorDefinitions.find(d=>d.id==='decor-15-01');assert.deepEqual(decorCollisionBoxes(mount,200,200),[]);
});

test('gazebo posts, raised side flowers and back railing block while its deck and entry remain usable',()=>{
 const f=fixture('gazebo',960,960,{boxes:propCollisionBoxes(4,960,960)});
 for(const[x,y]of [[.10,.8],[.9,.8],[.3,.8],[.7,.8],[.5,.60]])assert(f.hit(x*960,y*960));
 for(const[x,y]of [[.5,.74],[.5,.9],[.5,1.06]])assert(!f.hit(x*960,y*960));
 const parts=gazeboSceneParts(960,960);assert(parts.some(p=>p.kind==='roof'));assert(parts.every(p=>p.outline.length>=4&&Number.isFinite(p.depth)));
});

test('urban plinth collision covers visible base edges while exact interior footprint is preserved',()=>{
 const footprint={x:355,y:2763,w:2304,h:1728},source={...footprint},physical=urbanBuildingCollision(footprint,4491),f=fixture('tower',3014,4521,physical);
 assert.deepEqual(footprint,source);assert.deepEqual(physical.boxes[0],source);
 assert(f.hit(footprint.x-15,4491-30));assert(f.hit(1507,4491+20));assert(!f.hit(1507,4491+116));
 assert.equal(physical.front,4515);assert.equal(physical.right-physical.left,2352);
});

test('scene occluder fragments use scaled local artwork and retain fountain animation',()=>{
 const pieces=musicSquareSceneParts();assert.equal(new Set(pieces.map(p=>p.id)).size,pieces.length);
 const bench=pieces.find(p=>p.id==='bench-west');assert.equal(bench.depth,234*1600/1024);assert(bench.outline.every(([x,y])=>x>=0&&y>=0&&x<=2400&&y<=1600));
 assert(pieces.find(p=>p.kind==='fountain').animate);
 assert.equal(pieces.filter(p=>p.kind==='planter').length,8);
});
