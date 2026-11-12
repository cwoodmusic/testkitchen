import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {drawAcousticCeiling,drawAcousticShell,drawAcousticAirBay,drawOrganAcousticPanels} from './concert-acoustics.mjs';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
const WIDTH=800,HEIGHT=800;
const cases=[
 {name:'ceiling coffers',bounds:{x:72,y:0,w:WIDTH-144,h:176},draw:c=>drawAcousticCeiling(c,WIDTH)},
 {name:'left acoustic shell',bounds:{x:100,y:200,w:360,h:480},draw:c=>drawAcousticShell(c,Object.freeze({x:100,y:200,w:360,h:480}),{right:false})},
 {name:'right acoustic shell',bounds:{x:100,y:200,w:360,h:480},draw:c=>drawAcousticShell(c,Object.freeze({x:100,y:200,w:360,h:480}),{right:true})},
 {name:'suspended acoustic air bay',bounds:{x:100,y:92,w:572,h:202},draw:c=>drawAcousticAirBay(c,Object.freeze({x:100,y:92,w:572,h:202}))},
 {name:'organ acoustic panels',bounds:{x:200,y:180,w:360,h:410},draw:c=>drawOrganAcousticPanels(c,Object.freeze({x:200,y:180,w:360,h:410}))}
];
const matrix=c=>{const m=c.getTransform();return ['a','b','c','d','e','f'].map(k=>m[k]);};
const bytes=cv=>cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
const digest=cv=>createHash('sha256').update(bytes(cv)).digest('hex');
const dispose=cv=>{cv.width=cv.height=1;};

for(const entry of cases)test(`${entry.name} stays inside its architectural region`,()=>{
 const cv=createCanvas(WIDTH,HEIGHT),c=cv.getContext('2d'),r=entry.bounds;
 assert.equal(entry.draw(c),true);
 const data=bytes(cv);let painted=0;
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  const a=data[(y*WIDTH+x)*4+3];
  if(x<r.x||x>=r.x+r.w||y<r.y||y>=r.y+r.h)assert.equal(a,0,`${entry.name} paints playable space at${x},${y}`);
  else if(a)painted++;
 }
 assert(painted>r.w*r.h*.03,`${entry.name} must produce visible architecture`);
 dispose(cv);
});

test('architectural painting restores canvas state and releases its clipping',()=>{
 for(const entry of cases){
  const cv=createCanvas(WIDTH,HEIGHT),c=cv.getContext('2d');
  c.setTransform(.8,0,0,.75,13,7);c.globalAlpha=.63;c.globalCompositeOperation='multiply';c.imageSmoothingEnabled=true;
  c.fillStyle='#132457';c.strokeStyle='#764321';c.lineWidth=3;c.font='13px serif';c.textAlign='right';
  const before={matrix:matrix(c),alpha:c.globalAlpha,composite:c.globalCompositeOperation,smoothing:c.imageSmoothingEnabled,width:c.lineWidth,font:c.font,align:c.textAlign};
  entry.draw(c);
  const after={matrix:matrix(c),alpha:c.globalAlpha,composite:c.globalCompositeOperation,smoothing:c.imageSmoothingEnabled,width:c.lineWidth,font:c.font,align:c.textAlign};
  assert.deepEqual(after,before,entry.name);
  // The Node canvas paint-style getters retain their last JS assignment
  // even when native save/restore restored the correct paint. Probe pixels.
  c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.fillRect(780,780,1,1);
  assert.deepEqual([...c.getImageData(780,780,1,1).data],[19,36,87,255],`${entry.name} restores its caller's fill paint`);
  c.lineWidth=1;c.strokeRect(770.5,770.5,4,4);assert.deepEqual([...c.getImageData(770,772,1,1).data],[118,67,33,255],`${entry.name} restores its caller's stroke paint`);
  c.fillStyle='#0033ff';c.fillRect(790,790,1,1);
  assert.deepEqual([...c.getImageData(790,790,1,1).data],[0,51,255,255],`${entry.name} leaves no active clip`);
  dispose(cv);
 }
});

test('architectural rendering is deterministic across fresh canvases',()=>{
 for(const entry of cases){
  const a=createCanvas(WIDTH,HEIGHT),b=createCanvas(WIDTH,HEIGHT);
  entry.draw(a.getContext('2d'));entry.draw(b.getContext('2d'));
  assert.equal(digest(a),digest(b),entry.name);dispose(a);dispose(b);
 }
});

test('the suspended bay has an opaque roof soffit and a fading open bottom without a lower frame',()=>{
 const cv=createCanvas(WIDTH,HEIGHT),c=cv.getContext('2d'),r={x:100,y:92,w:572,h:202};
 drawAcousticAirBay(c,r);
 assert.equal(c.getImageData(r.x+r.w/2,r.y+4,1,1).data[3],255,'The upper timber is a solid roof return');
 const bottom=c.getImageData(r.x,r.y+r.h-1,r.w,1).data;
 assert([...bottom].filter((_,i)=>i%4===3).every(alpha=>alpha<=8),'The lowest edge must fade to air, not become a visible sill');
 const mid=c.getImageData(r.x+r.w/2,r.y+r.h/2,1,1).data;
 assert(mid[3]>32&&mid[0]<70&&mid[1]<70,'Recessed shade supplies depth below the soffit');
 dispose(cv);
});

test('the acoustic timber and red stage panels retain readable contrast when zoomed out',()=>{
 for(const entry of cases){
  const cv=createCanvas(WIDTH,HEIGHT);entry.draw(cv.getContext('2d'));
  const thumb=createCanvas(WIDTH/4,HEIGHT/4),c=thumb.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(cv,0,0,thumb.width,thumb.height);
  const data=bytes(thumb),levels=[];let warm=0,red=0;
  for(let i=0;i<data.length;i+=4)if(data[i+3]>128){
   const [r,g,b]=data.subarray(i,i+3);levels.push(.2126*r+.7152*g+.0722*b);
   if(r>g*1.13&&g>b*1.15&&r-b>35)warm++;
   if(r>g*1.45&&r>b*1.12&&r>60)red++;
  }
  levels.sort((a,b)=>a-b);assert(levels.length>100,entry.name);
  assert(levels[Math.floor(levels.length*.9)]-levels[Math.floor(levels.length*.1)]>24,`${entry.name} loses its depth at a normal overview zoom`);
  if(entry.name==='organ acoustic panels')assert(red>levels.length*.05,'The stage backdrop should read as red acoustic treatment');
  else assert(warm>levels.length*.05,`${entry.name} should read as warm timber`);
  dispose(cv);dispose(thumb);
 }
});
