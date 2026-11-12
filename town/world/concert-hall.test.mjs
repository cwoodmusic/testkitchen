import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {CONCERT_FOOTPRINT,getConcertHall,prepareConcertHallArt,concertHallDrawables,renderConcertHallBackground} from './concert-hall.mjs';

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

test('the detailed acoustic architecture is rasterized once and reuses its one background canvas',()=>{
 const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas'),original=globalThis.OffscreenCanvas,allocations=[];
 globalThis.OffscreenCanvas=class{constructor(w,h){allocations.push([w,h]);return createCanvas(w,h);}};
 try{
  const cv=createCanvas(32,32),c=cv.getContext('2d');c.globalAlpha=.7;c.imageSmoothingEnabled=true;const alpha=c.globalAlpha;
  for(let frame=0;frame<16;frame++)renderConcertHallBackground(c,hall);
  assert.deepEqual(allocations,[[hall.width,hall.height]],'Repeated performance frames must not rebuild the architectural canvas');
  assert.equal(c.globalAlpha,alpha);assert.equal(c.imageSmoothingEnabled,true);
  assert(c.getImageData(0,0,32,32).data.some((value,i)=>i%4===3&&value>0));
 }finally{if(original===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=original;}
});
