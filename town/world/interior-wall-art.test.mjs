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
const activeModels=descriptors.map(getInterior),preserved=m=>m.roomLayoutLegacySources?.[0]??m,sourceModels=activeModels.map(preserved),previousModels=activeModels.flatMap(m=>m.roomLayoutLegacySources?.slice(1)||[]),legacyModels=activeModels.flatMap(m=>m.roomLayoutLegacySources||[]),models=[...activeModels,...legacyModels],previousDefaults=activeModels.filter(m=>m.approvedRoomLayout).map(m=>m.roomLayoutPreviousDefault);
const color=(c,x,y)=>[...c.getImageData(x,y,1,1).data];

test('actual reported junctions return only along the adjoining authored wall face',()=>{
 for(const [id,x]of [['cyberpunk',772],['retrofuture',396]]){
  const m=preserved(getInterior({kind:'showroom',showroomId:id})),g=interiorWallNetworkGeometry(m);
  assert(g.returns.some(r=>r.x===x&&r.y===0&&r.w===16&&r.h===106));
  assert(g.returns.some(r=>r.x===x&&r.y===444&&r.w===16&&r.h===106));
  assert(!g.paint.some(r=>inside(r,x+8,438)),'Do not conceal the real14px circulation strip between separate rooms');
 }
 const robot=interiorWallNetworkGeometry(preserved(getInterior({kind:'showroom',showroomId:'robot'})));
 for(const x of [268,750])assert(robot.returns.some(r=>r.x===x&&r.y===0&&r.w===16&&r.h===106));
});

test('all31 active and91 preserved wall networks retain physical models without unsupported floor bridges',()=>{
 assert.equal(activeModels.length,31);assert.equal(legacyModels.length,91);assert.equal(previousModels.length,61);
 assert.equal(previousDefaults.length,15);assert.equal(new Set(previousDefaults).size,15);assert(previousDefaults.every(m=>previousModels.includes(m)),'Every replaced default remains in the complete wall-network checks');
 let projected=0;
 for(const m of models){
  const before=JSON.stringify(m),g=interiorWallNetworkGeometry(m);
  for(const r of g.returns){
   projected++;assert(r.face);assert(r.y>=r.face.y&&r.y+r.h<=r.face.y+r.face.h);
   assert(r.x===r.face.x+r.face.w||r.x+r.w===r.face.x,`${m.id}: a return must lie on the actual face edge`);
   assert(['up','down'].includes(r.returnDirection),`${m.id}: return direction must be explicit`);
   assert(m.walls.some(w=>w.x===r.x&&w.w===r.w&&(r.returnDirection==='up'?w.y===r.y+r.h:w.y+w.h===r.y)),`${m.id}: return must meet its actual wall edge`);
  }
  for(const r of g.northCaps){
   assert.equal(r.capDirection,'north');assert(r.face);
   assert.equal(r.y,Math.max(0,r.face.y));assert(r.x>=r.face.x&&r.x+r.w<=r.face.x+r.face.w);
   assert(r.y+r.h<=r.face.y+r.face.h,`${m.id}: the cap must remain inside its authored face`);
  }
  for(const r of g.paint){
   for(const d of g.apertures)assert(!overlap(r,d),`${m.id}: cap covers a real doorway`);
   const x=r.x+r.w/2,y=r.y+r.h/2;assert([...m.walls,...g.returns,...g.northCaps,...g.cornerCaps].some(w=>inside(w,x,y)),`${m.id}: unsupported floor patch`);
  }
  assert.equal(JSON.stringify(m),before);
 }
 assert(projected>50,'Exercise the complete home/showroom wall network');
});

test('every current and preserved wallpaper face has a north cap matching its side-wall thickness',()=>{
 let faces=0,sourceFaces=0;
 for(const m of models){
  const g=interiorWallNetworkGeometry(m),expected=m.kind==='showroom'||m.wideRoomLayout?.version>=3?16:m.resident==='player'&&!m.wideRoomLayout?20:18;
  for(const face of g.faces){
   faces++;if(sourceModels.includes(m))sourceFaces++;const cap=g.northCaps.find(r=>r.x===face.x&&r.y===face.y&&r.w===face.w);assert(cap,`${m.id}: missing north cap above${JSON.stringify(face)}`);
   assert.equal(cap.h,expected,`${m.id}: horizontal and vertical wall caps share the same width`);
   assert(cap.y>=0&&cap.y+cap.h<=m.height,'North caps cannot disappear above the canvas');
  }
 }
 assert(sourceFaces>=130,'Retain coverage of every original resident, player and showroom wallpaper band');assert(faces>=sourceFaces,'Also check every new default wallpaper band');
});

test('north caps meet side caps without a seam and leave the wallpaper below visible',()=>{
 for(const request of [{kind:'apartment',resident:'bach'},{kind:'showroom',showroomId:'midcentury-studio'},{kind:'apartment',resident:'player'}]){
  const m=getInterior(request),g=interiorWallNetworkGeometry(m),cv=createCanvas(m.width,m.height),c=cv.getContext('2d');
  c.fillStyle='#557799';c.fillRect(0,0,m.width,m.height);drawInteriorWallNetwork(c,m);
  const cap=g.northCaps.find(r=>r.x>28&&g.returns.some(side=>(side.x===r.x+r.w||side.x+side.w===r.x)&&side.y===r.y));assert(cap,m.id+' needs a real L join');
  const side=g.returns.find(side=>(side.x===cap.x+cap.w||side.x+side.w===cap.x)&&side.y===cap.y),y=cap.y+Math.floor(cap.h/2),join=side.x===cap.x+cap.w?cap.x+cap.w:cap.x;
  assert.deepEqual(color(c,join-4,y),color(c,join+4,y),m.id+' must not draw an internal seam through its north/side join');
  for(let x=join-3;x<=join+3;x++)assert.deepEqual(color(c,x,y),color(c,join-4,y),m.id+' corner needs continuous cap material');
  assert.deepEqual(color(c,cap.x+Math.floor(cap.w/2),cap.y+cap.h+4),[85,119,153,255],m.id+' wallpaper continues directly below the cap');
  if(cap.y===0)assert.notDeepEqual(color(c,cap.x+Math.floor(cap.w/2),1),[85,119,153,255],'The first cap row remains visible at y0');
  cv.width=cv.height=1;
 }
});

test('junction pixels are continuous while native wallpaper fields and the source gap stay intact',()=>{
 const m=preserved(getInterior({kind:'showroom',showroomId:'retrofuture'})),cv=createCanvas(m.width,m.height),c=cv.getContext('2d');
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

test('the preserved Bach kitchen corner meets the adjoining face without covering wallpaper or the bedroom door',()=>{
 const m=preserved(getInterior({kind:'apartment',resident:'bach'})),before=JSON.stringify(m),g=interiorWallNetworkGeometry(m);
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

test('all62 current and182 preserved36px doorway slits stay free of cap, trim and shadow pixels',()=>{
 let count=0;
 for(const m of models){
  const cv=createCanvas(m.width,m.height),c=cv.getContext('2d');drawInteriorWallNetwork(c,m);
  for(const d of m.privacyDoors){
   count++;assert.equal(d.length,36);const g=interiorWallNetworkGeometry(m),r=g.apertures[m.privacyDoors.indexOf(d)],data=c.getImageData(r.x,r.y,r.w,r.h).data;
   for(let i=3;i<data.length;i+=4)assert.equal(data[i],0,`${m.id}/${d.id}: visible construction intrudes into the passable slit`);
  }
  cv.width=cv.height=1;
 }
 assert.equal(count,244);assert.equal(previousDefaults.reduce((sum,m)=>sum+m.privacyDoors.length,0),30,'Both privacy openings of every newly preserved default receive the same native pixel checks');
 const untouched=createCanvas(100,100),c=untouched.getContext('2d');assert.equal(drawInteriorWallNetwork(c,{kind:'shop'}),false);assert.equal(drawInteriorWallNetwork(c,{kind:'hall'}),false);assert.equal(drawInteriorWallNetwork(c,{kind:'concert'}),false);
});

test('Victorian front corners continue the partition caps through the adjoining skirting without floor notches or seams',()=>{
 const m=getInterior({kind:'showroom',showroomId:'victorian-parlor'}),before=JSON.stringify(m),g=interiorWallNetworkGeometry(m),cv=createCanvas(m.width,m.height),c=cv.getContext('2d');
 assert.deepEqual(g.cornerCaps.map(({x,y,w,h})=>({x,y,w,h})),[{x:356,y:326,w:16,h:16},{x:372,y:326,w:16,h:16},{x:588,y:326,w:16,h:16}]);
 c.fillStyle='#102030';c.fillRect(0,0,m.width,m.height);drawInteriorWallNetwork(c,m);
 for(const x of [364,380,596]){
  for(let y=324;y<340;y++)assert.deepEqual(color(c,x,y),color(c,x,323),`The wall at${x} must continue through its front corner at${y}`);
  assert.deepEqual(color(c,x,345),[16,32,48,255],'The cap stops at the front trim rather than extending over the hall floor');
 }
 for(let x=358;x<386;x++)assert.deepEqual(color(c,x,334),color(c,364,334),'The shared partition cap has no seam between its two wall halves');
 assert.equal(JSON.stringify(m),before,'Corner artwork preserves the original walls, colliders, furniture and saved-layout signature');
});

test('every front corner cap is supported by an exactly adjoining wall band and preserves the actual floor gaps',()=>{
 for(const m of models){const g=interiorWallNetworkGeometry(m);for(const cap of g.cornerCaps){
  assert.equal(cap.cornerDirection,'south');assert.equal(cap.y,cap.wall.y+cap.wall.h);assert.equal(cap.y,cap.front.y);assert.equal(cap.h,cap.front.h);
  assert(cap.wall.x===cap.front.x+cap.front.w||cap.wall.x+cap.wall.w===cap.front.x);
  assert(cap.w===cap.wall.w&&cap.w<=32&&cap.h<=32);
  for(const doorway of g.apertures)assert(!overlap(cap,doorway));
 }}
 const retro=interiorWallNetworkGeometry(preserved(getInterior({kind:'showroom',showroomId:'retrofuture'})));assert(!retro.cornerCaps.some(cap=>inside(cap,404,438)),'The preserved14px circulation gap remains open');
});
