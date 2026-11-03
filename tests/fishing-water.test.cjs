'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const nav=require('../fishing-water.js'),data=require('../fishing-water-regions.js');
const ids=['lantern-lake','glowstone-narrows','mistfen-channel','mosswater-basin','tidegate-inlet','starlit-expanse'];
const samples=[[0,0],[-18,0],[18,0],[0,-12],[0,12],[-18,-12],[18,-12],[-18,12],[18,12]];

// Deliberately scan every original edge as an independent reference for the
// optimized row index, including points that land exactly on a bank or island.
function inside(points,x,y){
 let hit=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
  if(Math.abs(cross)<1e-7&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
 }
 return hit;
}
function reference(id,x,y){
 const region=data.screens[id];
 return !!region&&Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&x<=1000&&y>=0&&y<=620&&inside(region.outer,x,y)&&!region.holes.some(hole=>inside(hole,x,y));
}

test('all six coastlines belong to the current native screen artwork',()=>{
 assert.equal(data.version,1);assert.equal(data.width,1000);assert.equal(data.height,620);
 assert.deepEqual(Object.keys(data.screens).sort(),ids.slice().sort());
 for(const id of ids){
  const region=data.screens[id],image=fs.readFileSync(path.join(__dirname,'..',region.source));
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'),region.sourceSha256,id+' must update its collision outline when the art changes');
  assert.deepEqual([image.readUInt32BE(16),image.readUInt32BE(20)],[1592,988]);
  assert.equal(nav.has(id),true);assert.equal(nav.regionFor({id}),region);
  assert.ok(Object.isFrozen(region)&&Object.isFrozen(region.outer));
 }
});

test('boats can reach painted bays outside the former oval while actual banks remain dry',()=>{
 let expanded=0;
 for(const id of ids){
  const region=data.screens[id];
  assert.ok(region.wetWitnesses.length>0&&region.dryWitnesses.length>0);
  for(const [x,y]of region.wetWitnesses){
   assert.equal(nav.isWater(id,x,y),true,id+' visible water '+x+','+y);
   assert.equal(nav.isBoatWater(id,x,y),true,id+' complete hull at visible water '+x+','+y);
   if(((x-550)/360)**2+((y-350)/185)**2>=.97)expanded++;
  }
  for(const [x,y]of region.dryWitnesses){assert.equal(nav.isWater(id,x,y),false,id+' rock/shore '+x+','+y);assert.equal(nav.isBoatWater(id,x,y),false);}
 }
 assert.ok(expanded>=12,'The new navigation must open many previously invisible boundaries across the world');
});

test('the optimized lookup exactly matches full-edge geometry at fractional positions and every shoreline edge',()=>{
 let seed=17691;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const id of ids){
  for(let n=0;n<2500;n++){
   const x=random()*1002-1,y=random()*622-1;
   assert.equal(nav.isWater(id,x,y),reference(id,x,y),id+' fractional point '+x+','+y);
  }
  for(const polygon of [data.screens[id].outer,...data.screens[id].holes])for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length];
   for(const ratio of [0,.25,.5,.75])for(const offset of [[0,0],[.001,0],[-.001,0],[0,.001],[0,-.001]]){
    const x=a[0]+(b[0]-a[0])*ratio+offset[0],y=a[1]+(b[1]-a[1])*ratio+offset[1];
    assert.equal(nav.isWater(id,x,y),reference(id,x,y),id+' shoreline point '+x+','+y);
   }
  }
 }
});

test('all nine hull samples block rock islands and corners that an axis-only boat would clip',()=>{
 assert.deepEqual(nav.BOAT_SAMPLES,samples);
 let cornerGuard=null;
 for(const id of ids){
  for(const hole of data.screens[id].holes)for(const [x,y]of hole)assert.equal(nav.isWater(id,x,y),false,'An island/post boundary is solid');
  for(let y=20;y<=600&&!cornerGuard;y+=4)for(let x=20;x<=980;x+=4){
   const wet=samples.map(([dx,dy])=>nav.isWater(id,x+dx,y+dy));
   if(wet.slice(0,5).every(Boolean)&&!wet.every(Boolean)){cornerGuard={id,x,y};break;}
  }
 }
 assert.ok(cornerGuard,'Exercise a real bank where checking only center/axes would let a hull corner enter rock');
 const {id,x,y}=cornerGuard;
 assert.equal(samples.slice(0,5).every(([dx,dy])=>reference(id,x+dx,y+dy)),true);
 assert.equal(samples.every(([dx,dy])=>reference(id,x+dx,y+dy)),false);
 assert.equal(nav.isBoatWater(id,x,y),false);
});

test('invalid positions, unknown screens and water outside the frame are rejected',()=>{
 for(const id of ['unknown','__proto__',null,{}]){assert.equal(nav.has(id),false);assert.equal(nav.regionFor(id),null);assert.equal(nav.isWater(id,550,350),false);assert.equal(nav.isBoatWater(id,550,350),false);}
 for(const [x,y]of [[NaN,350],[550,Infinity],[-1,350],[1001,350],[550,-1],[550,621]]){assert.equal(nav.isWater(ids[0],x,y),false);assert.equal(nav.isBoatWater(ids[0],x,y),false);}
});
