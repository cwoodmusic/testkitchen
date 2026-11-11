import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {interiorWallNetworkGeometry,drawInteriorWallNetwork} from './interior-wall-art.mjs';
import {getInterior,residents} from './urban-interiors.mjs';
import {SHOWROOMS} from './showroom-layout.mjs';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const inside=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
const descriptors=[...residents.map(r=>({kind:'apartment',resident:r.id})),{kind:'apartment',resident:'player'},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id}))];
const models=descriptors.map(getInterior);
const color=(c,x,y)=>[...c.getImageData(x,y,1,1).data];

test('actual reported junctions return only along the adjoining authored wall face',()=>{
 for(const [id,x]of [['cyberpunk',772],['retrofuture',396]]){
  const m=getInterior({kind:'showroom',showroomId:id}),g=interiorWallNetworkGeometry(m);
  assert(g.returns.some(r=>r.x===x&&r.y===0&&r.w===16&&r.h===106));
  assert(g.returns.some(r=>r.x===x&&r.y===444&&r.w===16&&r.h===106));
  assert(!g.paint.some(r=>inside(r,x+8,438)),'Do not conceal the real14px circulation strip between separate rooms');
 }
 const robot=interiorWallNetworkGeometry(getInterior({kind:'showroom',showroomId:'robot'}));
 for(const x of [268,750])assert(robot.returns.some(r=>r.x===x&&r.y===0&&r.w===16&&r.h===106));
});

test('all31 wall networks preserve every physical model and never invent an unsupported floor bridge',()=>{
 assert.equal(models.length,31);let projected=0;
 for(const m of models){
  const before=JSON.stringify(m),g=interiorWallNetworkGeometry(m);
  for(const r of g.returns){
   projected++;assert(r.face);assert(r.y>=r.face.y&&r.y+r.h<=r.face.y+r.face.h);
   assert(r.x===r.face.x+r.face.w||r.x+r.w===r.face.x,`${m.id}: a return must lie on the actual face edge`);
   assert(['up','down'].includes(r.returnDirection),`${m.id}: return direction must be explicit`);
   assert(m.walls.some(w=>w.x===r.x&&w.w===r.w&&(r.returnDirection==='up'?w.y===r.y+r.h:w.y+w.h===r.y)),`${m.id}: return must meet its actual wall edge`);
  }
  for(const r of g.paint){
   for(const d of g.apertures)assert(!overlap(r,d),`${m.id}: cap covers a real doorway`);
   const x=r.x+r.w/2,y=r.y+r.h/2;assert([...m.walls,...g.returns].some(w=>inside(w,x,y)),`${m.id}: unsupported floor patch`);
  }
  assert.equal(JSON.stringify(m),before);
 }
 assert(projected>50,'Exercise the complete home/showroom wall network');
});

test('junction pixels are continuous while native wallpaper fields and the source gap stay intact',()=>{
 const m=getInterior({kind:'showroom',showroomId:'retrofuture'}),cv=createCanvas(m.width,m.height),c=cv.getContext('2d');
 c.fillStyle='#102030';c.fillRect(0,0,m.width,m.height);c.fillStyle='#557799';c.fillRect(28,444,368,106);
 c.imageSmoothingEnabled=true;c.fillStyle='#abcdef';
 assert(drawInteriorWallNetwork(c,m));assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.globalAlpha,1);
 c.fillRect(600,700,1,1);assert.deepEqual(color(c,600,700),[171,205,239,255],'Actual canvas paint state is restored');
 assert.deepEqual(color(c,300,470),[85,119,153,255],'Never replace the actual wallpaper with a flat wall rectangle');
 assert.deepEqual(color(c,404,438),[16,32,48,255],'The separate source floor gap is not silently sealed');
 for(let y=0;y<106;y++)assert.notDeepEqual(color(c,404,y),[16,32,48,255],`North join missing at${y}`);
 for(let y=444;y<550;y++)assert.notDeepEqual(color(c,404,y),[16,32,48,255],`Lower face return missing at${y}`);
 assert.deepEqual(color(c,404,412),color(c,404,414),'No internal edge is drawn across a structural T join');
 cv.width=cv.height=1;
});

test('Bach kitchen corner continues to the adjoining face bottom without covering wallpaper or the bedroom door',()=>{
 const m=getInterior({kind:'apartment',resident:'bach'}),before=JSON.stringify(m),g=interiorWallNetworkGeometry(m);
 const corner=g.returns.find(r=>r.returnDirection==='down'&&r.x===430&&r.y===530&&r.w===18&&r.h===50);
 assert(corner,'The actual reported corner must continue to the kitchen face bottom at580');
 assert.deepEqual(corner.face,{x:36,y:492,w:394,h:88});
 const cv=createCanvas(m.width,m.height),c=cv.getContext('2d'),floor=[16,32,48,255];
 c.fillStyle='#102030';c.fillRect(0,0,m.width,m.height);c.fillStyle='#557799';c.fillRect(36,492,394,88);
 drawInteriorWallNetwork(c,m);
 const originalCap=color(c,439,528);
 for(let y=530;y<578;y++)assert.deepEqual(color(c,439,y),originalCap,`Cap colour must continue through the old end at${y}`);
 for(const y of [578,579])assert.notDeepEqual(color(c,439,y),floor,'The finished cap edge must reach the face bottom');
 for(let x=430;x<448;x++)assert.deepEqual(color(c,x,528),color(c,x,540),`The entire existing cap profile continues at${x}`);
 assert.deepEqual(color(c,400,540),[85,119,153,255],'The authored wallpaper field remains unchanged');
 for(let y=389;y<425;y++)assert.deepEqual(color(c,439,y),floor,`The real bedroom aperture remains open at${y}`);
 assert.equal(JSON.stringify(m),before,'Rendering must leave physical walls, doorways and saved layout geometry unchanged');
 cv.width=cv.height=1;
});

test('all62 actual36px doorway slits remain completely free of cap, trim and shadow pixels',()=>{
 let count=0;
 for(const m of models){
  const cv=createCanvas(m.width,m.height),c=cv.getContext('2d');drawInteriorWallNetwork(c,m);
  for(const d of m.privacyDoors){
   count++;assert.equal(d.length,36);const g=interiorWallNetworkGeometry(m),r=g.apertures[m.privacyDoors.indexOf(d)],data=c.getImageData(r.x,r.y,r.w,r.h).data;
   for(let i=3;i<data.length;i+=4)assert.equal(data[i],0,`${m.id}/${d.id}: visible construction intrudes into the passable slit`);
  }
  cv.width=cv.height=1;
 }
 assert.equal(count,62);
 const untouched=createCanvas(100,100),c=untouched.getContext('2d');assert.equal(drawInteriorWallNetwork(c,{kind:'shop'}),false);assert.equal(drawInteriorWallNetwork(c,{kind:'hall'}),false);assert.equal(drawInteriorWallNetwork(c,{kind:'concert'}),false);
});
