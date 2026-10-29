const test = require('node:test');
const assert = require('node:assert/strict');
const {createCodaWorldLighting, traceFloorRay, transformPoint, LANTERNS} = require('../world-lighting.js');

function fixture(options={}) {
  let time=0,quality='full',reduced=false,revision=0,checks=0;
  let balls=[{id:'test-ball',x:2000,y:2000,radius:28,spin:.8,seed:0,visible:true,rays:true,opacity:1}];
  const allowed=options.allowed||(()=>true);
  const lighting=createCodaWorldLighting({width:10000,height:10000,
    getTime:()=>time,getQuality:()=>quality,reducedMotion:()=>reduced,
    getBallStates:()=>balls,getMapRevision:()=>revision,
    isWalkable:(x,y)=>{checks++;return allowed(x,y);},makeCanvas:()=>canvas()});
  return {lighting,time:v=>time=v,quality:v=>quality=v,reduced:v=>reduced=v,balls:v=>balls=v,
    revision:()=>revision++,checks:()=>checks};
}
function context() {
  return {shadowBlur:30,calls:[],save(){},restore(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},clip(){this.calls.push(['clip']);},fill(){},stroke(){this.calls.push(['stroke']);},setTransform(){},clearRect(){this.calls.push(['clear']);},
    createRadialGradient(){return {addColorStop(){}};},
    drawImage(...args){this.calls.push(['image',...args]);},
    fillRect(...args){assert.equal(this.shadowBlur,0,'No per-frame shadow blur');this.calls.push(['rect',...args]);}};
}
function canvas(){const ctx=context();ctx.shadowBlur=0;return {width:64,height:64,getContext:()=>ctx};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} must match ${b}`);

test('room-boundary tracing stays inside its geometric outline',()=>{
  const hit=traceFloorRay({x:5,y:20},{x:105,y:20},x=>x<35||x>65);
  assert.equal(hit.hitWall,true);assert.ok(hit.x<35&&hit.x>=31);
  near(hit.y,20);near(hit.length,hit.x-5);
  assert.equal(traceFloorRay({x:5,y:20},{x:105,y:20},()=>false),null);
  assert.equal(traceFloorRay({x:NaN,y:20},{x:105,y:20},()=>true),null);
});

test('full/lite/off and hidden or rays-disabled balls have bounded independent light geometry',()=>{
  const f=fixture();let state=f.lighting.snapshot();
  assert.equal(state.rayCount,32);assert.equal(state.spotCount,32);
  f.quality('lite');state=f.lighting.snapshot();assert.equal(state.spotCount,12);
  f.quality('off');state=f.lighting.snapshot();assert.equal(state.spotCount,0);assert.equal(state.rayCount,0);
  f.quality('full');f.balls([{id:'hidden',x:2000,y:2000,visible:false},{id:'no-rays',x:2000,y:2000,rays:false}]);
  state=f.lighting.snapshot();assert.equal(state.balls.length,2);assert.equal(state.spotCount,0);
});

test('spinning facets create moving floor pins and geometry is reused within its refresh interval',()=>{
  const f=fixture();const first=f.lighting.snapshot(),checks=f.checks();
  assert.equal(checks,0,'Light projection must never consult the walking collision map');
  assert.deepEqual(f.lighting.snapshot().spots,first.spots);assert.equal(f.checks(),checks);
  f.time(1);const next=f.lighting.snapshot();assert.notDeepEqual(next.spots,first.spots);
  assert.equal(next.spots.length,32);
  for(const spot of next.spots)assert.ok(spot.x>=0&&spot.y>=0&&spot.x<10000&&spot.y<10000);
});

test('circling reflections have short moving traces, with no trails for reduced or stopped motion',()=>{
  const f=fixture(),first=f.lighting.snapshot();
  assert.ok(first.spots.every(spot=>spot.trace));
  for(const spot of first.spots)assert.ok(Math.hypot(spot.trace.x-spot.x,spot.trace.y-spot.y)<=9.000001);
  const ctx=context();f.lighting.drawFloorPins(ctx);
  assert.equal(ctx.calls.filter(call=>call[0]==='stroke').length,first.spotCount);
  f.time(1);assert.notDeepEqual(f.lighting.snapshot().spots,first.spots);
  f.reduced(true);assert.ok(f.lighting.snapshot().spots.every(spot=>spot.trace===null));
  f.reduced(false);
  for(const stopped of [{animate:false},{spin:0}]){
    f.balls([{id:'still',x:2000,y:2000,radius:28,...stopped}]);
    assert.ok(f.lighting.snapshot().spots.every(spot=>spot.trace===null));
  }
});

test('translating, rotating and resizing a ball transforms its anchor and every projected pin together',()=>{
  const f=fixture(),original=f.lighting.snapshot();
  const matrix=[0,2,-1,0,5000,1000];
  f.balls([{id:'test-ball',x:2000,y:2000,radius:28,spin:.8,seed:0,matrix}]);
  const moved=f.lighting.snapshot(),anchor=transformPoint(matrix,2000,2000);
  near(moved.balls[0].x,anchor.x);near(moved.balls[0].y,anchor.y);
  assert.equal(moved.spotCount,original.spotCount);
  for(let i=0;i<original.spots.length;i++){
    const expected=transformPoint(matrix,original.spots[i].x,original.spots[i].y);
    near(moved.spots[i].x,expected.x);near(moved.spots[i].y,expected.y);
  }
});

test('floor pins ignore blocked walking cells and collision edits cannot displace them',()=>{
  const allowed=(x,y)=>x>=650&&x<1000&&y>=315&&y<700;
  const open=fixture(),blocked=fixture({allowed});
  const balls=[{id:'main',x:878,y:130,radius:28,spin:.55}];
  open.balls(balls);blocked.balls(balls);
  for(const time of [0,.04,.08,.12,1]){
    open.time(time);blocked.time(time);blocked.revision();
    const clear=open.lighting.snapshot(),edited=blocked.lighting.snapshot();
    assert.ok(edited.spotCount>0);
    assert.deepEqual(edited.spots,clear.spots,'Blocked furniture must not move or truncate pins');
    assert.deepEqual(edited.beams,clear.beams,'Beams must still reach their projected pins');
    assert.ok(edited.spots.some(spot=>!allowed(spot.x,spot.y)), 'Light must cross blocked cells');
  }
  assert.equal(blocked.checks(),0);
});

test('even an entirely blocked walking map leaves the decorative light pattern intact',()=>{
  const open=fixture(),blocked=fixture({allowed:()=>false});
  assert.deepEqual(blocked.lighting.snapshot().spots,open.lighting.snapshot().spots);
  assert.equal(blocked.lighting.snapshot().spotCount,32);
  assert.equal(blocked.checks(),0);
});

test('reduced motion and an individual asset animation switch freeze projected geometry',()=>{
  for(const mode of ['reduced','asset']){
    const f=fixture();
    if(mode==='reduced')f.reduced(true);else f.balls([{id:'test-ball',x:2000,y:2000,radius:28,spin:.8,animate:false}]);
    const first=f.lighting.snapshot();f.time(3);const later=f.lighting.snapshot();
    assert.deepEqual(later.spots,first.spots);
    assert.deepEqual(later.beams,first.beams);
  }
});

test('the photographed corridor lantern has a measured glass core and visibly breathing light levels',()=>{
  const f=fixture(),first=f.lighting.snapshot();
  const lamp=first.lanterns.find(lamp=>lamp.id==='dance-passage-lantern');
  assert.deepEqual([lamp.x,lamp.y,lamp.w,lamp.h],[843,650,8,15]);
  assert.equal(new Set(LANTERNS.map(lamp=>lamp.id)).size,LANTERNS.length);
  f.time(1.5);const later=f.lighting.snapshot().lanterns.find(other=>other.id===lamp.id);
  assert.notEqual(lamp.intensity,later.intensity);
  f.reduced(true);const steady=f.lighting.snapshot().lanterns;f.time(4);
  assert.deepEqual(f.lighting.snapshot().lanterns,steady);
});

test('drawing reuses a small glow atlas and avoids live shadow blur',()=>{
  const f=fixture(),ctx=context();
  f.lighting.drawDisco(ctx);f.lighting.drawLanterns(ctx);
  assert.ok(ctx.calls.some(call=>call[0]==='image'));
  const textures=f.lighting.snapshot().glowTextures;assert.equal(textures,7);
  for(let i=1;i<10;i++){f.time(i/10);f.lighting.drawDisco(ctx);f.lighting.drawLanterns(ctx);}
  assert.equal(f.lighting.snapshot().glowTextures,textures);
  f.quality('off');const count=ctx.calls.length;f.lighting.drawDisco(ctx);f.lighting.drawLanterns(ctx);
  assert.equal(ctx.calls.length,count,'Off must leave the original artwork untouched');
});

test('beam clips are batched by room and the smaller raster is reused until geometry changes',()=>{
  const f=fixture(),ctx=context();
  f.balls([{id:'arcade',x:878,y:130,radius:28},{id:'dance',x:392,y:548,radius:29,club:true}]);
  f.lighting.drawDisco(ctx);
  const surface=ctx.calls.find(call=>call[0]==='image'&&call[1].width>64)[1],raster=surface.getContext('2d');
  assert.equal(raster.calls.filter(call=>call[0]==='clip').length,2,'A ray must reuse its room clip');
  assert.equal(raster.calls.filter(call=>call[0]==='clear').length,1);
  f.lighting.drawDisco(ctx);f.time(.008);f.lighting.drawDisco(ctx);
  assert.equal(raster.calls.filter(call=>call[0]==='clear').length,1,'Do not rerasterize unchanged beams each display frame');
  f.revision();f.lighting.drawDisco(ctx);
  assert.equal(raster.calls.filter(call=>call[0]==='clear').length,1,'Collision edits must not disturb decorative projections');
  f.time(.04);f.lighting.drawDisco(ctx);
  assert.equal(raster.calls.filter(call=>call[0]==='clear').length,2,'Advancing animation must refresh the projection');
});
