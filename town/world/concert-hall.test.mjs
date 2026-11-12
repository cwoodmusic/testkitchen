import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {CONCERT_FOOTPRINT,getConcertHall,prepareConcertHallArt,concertHallDrawables,renderConcertHallBackground,concertSuspendedReflectors,drawConcertSuspendedReflector,concertHallOverheadPlanes,renderConcertHallOverhead} from './concert-hall.mjs';

const hall=getConcertHall(),pad=16;
// Match the interior controller's circular-foot approximation and safety pad.
function solid(x,y){return x<40||y<100||x>hall.width-40||y>hall.height-40||hall.solids.some(r=>x>r.x-pad&&x<r.x+r.w+pad&&y>r.y-pad&&y<r.y+r.h+pad);}
function navigation(){
 const step=16,columns=hall.width/step+1,rows=hall.height/step+1,seen=new Uint8Array(columns*rows),queue=[];
 const ix=Math.round(hall.spawn.x/step),iy=Math.round(hall.spawn.y/step),start=iy*columns+ix;
 seen[start]=1;queue.push(start);
 for(let i=0;i<queue.length;i++){
  const p=queue[i],x=p%columns,y=Math.floor(p/columns);
  for(const [dx,dy]of [[0,-1],[1,0],[0,1],[-1,0]]){
   const nx=x+dx,ny=y+dy,next=ny*columns+nx;
   if(nx<0||ny<0||nx>=columns||ny>=rows||seen[next]||solid(nx*step,ny*step))continue;
   seen[next]=1;queue.push(next);
  }
 }
 return point=>!!seen[Math.round(point.y/step)*columns+Math.round(point.x/step)];
}

test('the concert room shares the exact Opera House lot footprint and a stable immutable model',()=>{
 assert.deepEqual(CONCERT_FOOTPRINT,{width:4096,height:2560});
 assert.equal(hall.width,CONCERT_FOOTPRINT.width);assert.equal(hall.height,CONCERT_FOOTPRINT.height);
 assert.equal(getConcertHall(),hall);assert.ok(Object.isFrozen(hall));assert.ok(Object.isFrozen(hall.audience.seats));
 assert.equal(hall.kind,'concert');assert.equal(solid(hall.spawn.x,hall.spawn.y),false);
 assert.deepEqual(hall.stage.performerBounds,{x:1000,y:420,w:2096,h:680});
});

test('every audience chair has one physical base and a clear, accurately labelled interaction approach',()=>{
 const seats=hall.audience.seats;
 assert.equal(seats.length,196);assert.equal(new Set(seats.map(s=>s.id)).size,seats.length);
 for(const seat of seats){
  const base=hall.solids.find(s=>s.seatId===seat.id),zone=hall.zones.find(z=>z.seatId===seat.id);
  assert.deepEqual(base,{x:seat.x-28,y:seat.y-40,w:56,h:46,seatId:seat.id});
  assert.ok(zone,seat.id);assert.equal(zone.action,'concert-seat');assert.equal(seat.facing,'up');
  assert.equal(solid(seat.approach.x,seat.approach.y),false,`${seat.id}: approach clear`);
  assert.ok(seat.approach.x>=zone.x&&seat.approach.x<=zone.x+zone.w&&seat.approach.y>=zone.y&&seat.approach.y<=zone.y+zone.h,`${seat.id}: prompt at its own approach`);
  assert.ok(solid(seat.seat.x,seat.seat.y),`${seat.id}: only deliberate sit interaction occupies chair`);
 }
});

test('a player can walk from the entrance to every seat, the programme and the stage without passing through chairs',()=>{
 const canReach=navigation();
 for(const seat of hall.audience.seats)assert.ok(canReach(seat.approach),seat.id);
 for(const z of hall.zones.filter(z=>z.action!=='concert-seat'))assert.ok(canReach({x:z.x+z.w/2,y:z.y+z.h/2}),z.id);
 for(const y of [1296,1248,1216,1168,1056,864,608,432])assert.ok(canReach({x:2048,y}),`center stairs/stage y${y}`);
 for(const x of [1904,2048,2192])assert.ok(canReach({x,y:1232}),`broad stairs x${x}`);
 // The front lip blocks walking off the stage beside the stairs.
 assert.ok(solid(1100,1216));assert.ok(solid(2900,1216));
});

test('performers have a genuinely empty stage and architectural galleries cannot be entered accidentally',()=>{
 const p=hall.stage.performerBounds;
 for(let y=p.y;y<=p.y+p.h;y+=32)for(let x=p.x;x<=p.x+p.w;x+=32)assert.equal(solid(x,y),false,`stage ${x},${y}`);
 for(const balcony of hall.audience.balconies){assert.ok(solid(balcony.x+balcony.w/2,balcony.y+balcony.h/2));assert.ok(!hall.audience.seats.some(s=>s.x>balcony.x&&s.x<balcony.x+balcony.w));}
 for(const r of hall.solids){assert.ok(r.x>=0&&r.y>=0&&r.w>0&&r.h>0);assert.ok(r.x+r.w<=hall.width&&r.y+r.h<=hall.height);}
});

test('interactive chair backs join the depth sort at their floor anchors and cull outside the camera',()=>{
 const drawables=concertHallDrawables({},hall);
 assert.equal(drawables.length,hall.audience.seats.length);
 drawables.forEach((drawable,i)=>{const seat=hall.audience.seats[i];assert.equal(drawable.y,seat.y);assert.equal(typeof drawable.draw,'function');assert.deepEqual(drawable.bounds,{x:seat.x-33,y:seat.y-74,w:66,h:74});});
 const first=hall.audience.seats[0],clipped=concertHallDrawables({},hall,{viewport:{x:first.x-31,y:first.y-72,w:62,h:70}});
 assert.equal(clipped.length,1);assert.equal(clipped[0].y,first.y);
 assert.equal(concertHallDrawables({},hall,{viewport:{x:0,y:0,w:100,h:100}}).length,0);
});

test('static prop cutouts are local RGBA PNGs and the pure model can load without a browser',async()=>{
 await prepareConcertHallArt();
 const manifest=JSON.parse(await readFile(new URL('../assets/concert/hall-props.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(manifest.sprites).length,8);
 for(const prop of Object.values(manifest.sprites)){
  const bytes=await readFile(new URL(`../assets/concert/${prop.file}`,import.meta.url));
  assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),prop.width);assert.equal(bytes.readUInt32BE(20),prop.height);assert.equal(bytes[25],6,`${prop.file}: RGBA`);
 }
});

test('suspended cloud wires visibly connect the roof plates to the actual native stem caps and stay above the rear musicians',async()=>{
 const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
 const image=await loadImage(new URL('../assets/concert/hall-reflector.png',import.meta.url).pathname),source=createCanvas(image.width,image.height),sc=source.getContext('2d');sc.drawImage(image,0,0);
 for(const rig of concertSuspendedReflectors(hall)){
  assert(rig.bodyTop>126,'Cloud skins must have air below the roof soffit');
  assert(rig.y+rig.h<=280,'Keep suspended skin above the seated rear-brass silhouettes');
  const cv=createCanvas(hall.width,360),c=cv.getContext('2d');drawConcertSuspendedReflector(c,rig);
  assert.equal(rig.cables.length,3,'Reuse the three native attachment points');
  for(const {anchor,cap}of rig.cables){
   const sx=Math.round((cap.x-rig.x)*image.width/rig.w),sy=Math.round((cap.y-rig.y)*image.height/rig.h);
   assert(sc.getImageData(sx,sy,1,1).data[3]>128,'The wire must meet an opaque native cap, not transparent padding');
   assert(cap.y>anchor.y+30,'Suspension must expose real cable clearance');
   assert(c.getImageData(Math.round(anchor.x),anchor.y-3,1,1).data[3]>128,'The wire begins inside the mounting plate');
   for(let y=anchor.y;y<Math.floor(cap.y);y++){
    const row=c.getImageData(Math.round(anchor.x)-1,y,3,1).data;
    assert([...row].some((value,i)=>i%4===3&&value>0),`Cable is disconnected at${anchor.x},${y}`);
   }
  }
  cv.width=cv.height=1;
 }
 source.width=source.height=1;
});

test('overhead depth responds to the actual camera in both axes, stays bounded, and stops with the camera',()=>{
 const reference={x:2048,y:1280},view=(x,y)=>({camera:{x:reference.x+x,y:reference.y+y,reference,seated:true}});
 const a=concertHallOverheadPlanes(hall,view(-120,-72)),b=concertHallOverheadPlanes(hall,view(120,72));
 assert.deepEqual(concertHallOverheadPlanes(hall,view(-120,-72)),a,'Time and animation clocks do not move this architecture');
 for(let i=0;i<a.length;i++){
  assert(a[i].offset.x-b[i].offset.x>40,'Horizontal drag must create visible differential projection');
  assert(a[i].offset.y-b[i].offset.y>25,'Vertical drag must not be saturated by the default watch camera');
 }
 for(const p of concertHallOverheadPlanes(hall,{camera:{x:-1e5,y:1e5}})){
  assert(Math.abs(p.offset.x)<=72&&Math.abs(p.offset.y)<=36,'Walking near hall edges cannot project a roof across the stage');
 }
 for(const p of concertHallOverheadPlanes(hall,{...view(-120,-72),reducedMotion:true}))assert.deepEqual(p.offset,{x:0,y:0});
 const explicit=concertHallOverheadPlanes(hall,{camera:{x:2048,y:810,reference:{x:2048,y:810},seated:true}});
 assert(explicit.every(p=>p.offset.x===0&&p.offset.y===0),'Watch reference follows the actual viewport clamp, including a wider screen');
});

test('the detailed floor and four cropped overhead textures are rasterized once and reused while the camera moves',()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),original=globalThis.OffscreenCanvas,allocations=[];
 globalThis.OffscreenCanvas=class{constructor(w,h){allocations.push([w,h]);return createCanvas(w,h);}};
 try{
  const cv=createCanvas(32,32),c=cv.getContext('2d');c.globalAlpha=.7;c.imageSmoothingEnabled=true;const alpha=c.globalAlpha;
  for(let frame=0;frame<16;frame++){
   renderConcertHallBackground(c,hall);
   renderConcertHallOverhead(c,hall,{camera:{x:1988+frame*8,y:1244+frame*5}});
  }
  assert.deepEqual(allocations,[[hall.width,hall.height],[3952,176],[610,1100],[610,1100],[2104,188]],'Repeated camera movement must reuse one floor cache and four tightly cropped RGBA textures');
  assert(allocations.slice(1).reduce((sum,[w,h])=>sum+w*h,0)<2_500_000,'Elevated art must not allocate a second full-size hall canvas');
  assert.equal(c.globalAlpha,alpha);assert.equal(c.imageSmoothingEnabled,true);
  assert(c.getImageData(0,0,32,32).data.some((value,i)=>i%4===3&&value>0));
 }finally{if(original===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=original;}
});

test('actual cached cloud pixels move relative to the floor while organ, actors and a nearby player remain uncovered',()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),a=createCanvas(hall.width,400),b=createCanvas(hall.width,400);
 const reference={x:2048,y:1280};
 for(const [cv,x,y]of [[a,1928,1208],[b,2168,1352]])renderConcertHallOverhead(cv.getContext('2d'),hall,{camera:{x,y,reference},viewport:{x:900,y:0,w:2300,h:400}});
 function pinkCentroid(cv){
  const data=cv.getContext('2d').getImageData(980,150,600,190).data;let x=0,y=0,n=0;
  for(let i=0;i<data.length;i+=4)if(data[i+3]>128&&data[i]>data[i+1]*1.2&&data[i+2]>data[i+1]*1.15){x+=(i/4)%600;y+=Math.floor(i/4/600);n++;}
  assert(n>100,'A detached pink cloud must actually be drawn, not just reported by an offset helper');return {x:x/n,y:y/n};
 }
 const ca=pinkCentroid(a),cb=pinkCentroid(b);
 assert(Math.abs(ca.x-cb.x)>35&&Math.abs(ca.y-cb.y)>20,'Both camera axes move actual cached reflector pixels against fixed world coordinates');
 const cv=createCanvas(hall.width,400),c=cv.getContext('2d'),player={x:1150,y:300},actor={x:2940,y:470,seated:true};
 renderConcertHallOverhead(c,hall,{camera:{x:1928,y:1208,reference},player,performance:{actors:[actor]}});
 for(const r of [{x:1696,y:0,w:704,h:360},{x:player.x-100,y:player.y-190,w:200,h:240},{x:actor.x-82,y:actor.y-160,w:164,h:226}]){
  const area=c.getImageData(r.x,r.y,r.w,Math.min(r.h,400-r.y)).data;
  assert([...area].filter((_,i)=>i%4===3).every(alpha=>alpha===0),'The organ bay and silhouettes retain a clear cutaway at the nearest camera pose');
 }
 a.width=a.height=b.width=b.height=cv.width=cv.height=1;
});

test('performer cutaways follow visible heads and never slice the suspended pink skins at either camera extreme',()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),reference={x:2048,y:1280};
 const actors=[{x:2980,y:470,seated:true},{x:2747,y:470,seated:true},{x:2514,y:470,seated:true}];
 for(const [x,y]of [[1928,1208],[2168,1352],[0,0]]){
  const plain=createCanvas(hall.width,400),orchestra=createCanvas(hall.width,400),camera={x,y,reference};
  renderConcertHallOverhead(plain.getContext('2d'),hall,{camera});
  renderConcertHallOverhead(orchestra.getContext('2d'),hall,{camera,performance:{actors}});
  const a=plain.getContext('2d').getImageData(2500,130,700,180).data,b=orchestra.getContext('2d').getImageData(2500,130,700,180).data;
  let skin=0;
  for(let i=0;i<a.length;i+=4)if(a[i+3]>128&&a[i]>a[i+1]*1.2&&a[i+2]>a[i+1]*1.15){
   skin++;assert.deepEqual([...b.subarray(i,i+4)],[...a.subarray(i,i+4)],'A transparent actor-cache margin must not remove part of a cloud');
  }
  assert(skin>100);plain.width=plain.height=orchestra.width=orchestra.height=1;
 }
});

test('late native prop loads invalidate both architectural caches and settle into reuse',async()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),Canvas=globalThis.OffscreenCanvas,Image=globalThis.Image,loads=[],allocations=[];
 globalThis.OffscreenCanvas=class{constructor(w,h){allocations.push([w,h]);return createCanvas(w,h);}};
 globalThis.Image=class{constructor(){
  const image=createCanvas(4,4),c=image.getContext('2d');c.fillStyle='#d78eab';c.fillRect(0,0,4,4);
  Object.defineProperty(image,'src',{set(){loads.push(()=>image.onload());}});return image;
 }};
 try{
  // A fresh module mirrors entering while the eight native PNGs are loading.
  const renderer=await import('./concert-hall.mjs?late-native-props');
  const cv=createCanvas(8,8),c=cv.getContext('2d'),paint=()=>{renderer.renderConcertHallBackground(c,hall);renderer.renderConcertHallOverhead(c,hall);};
  paint();assert.equal(allocations.length,5);assert.equal(loads.length,8);
  loads.forEach(load=>load());await renderer.prepareConcertHallArt();
  paint();assert.equal(allocations.length,10,'Native props replace both the floor and overhead fallback textures');
  for(let frame=0;frame<8;frame++)paint();
  assert.equal(allocations.length,10,'Completed image loads do not repeatedly rebuild either cache');
  cv.width=cv.height=1;
 }finally{
  if(Canvas===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=Canvas;
  if(Image===undefined)delete globalThis.Image;else globalThis.Image=Image;
 }
});
