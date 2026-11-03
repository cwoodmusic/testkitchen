'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/east-floor-cleanup-regions.json');
const {combinedMask,repairMask}=require('../scripts/build-east-floor-cleanup.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const {isGlassFloor}=require('../wall-reflections.js'),compat=require('../floor-palette-compat.js');
const mask=combinedMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('east cleanup reaches every blue cap ghost while protecting the real wall, pillar, panels and neon',()=>{
 for(const[x,y]of [[728,647],[776,641],[768,651],[765,653],[775,635],[775,639],[781,631],[728,650],[735,655],[750,660],[780,660],[800,660],[740,680],[775,700],[790,740]])assert.equal(mask[y*width+x],1,`Blue ghost at ${x},${y} is repaired`);
 for(const[x,y]of [[724,640],[720,645],[703,600],[808,650],[819,700],[650,750],[775,827],[113,700],[397,450]])assert.equal(mask[y*width+x],0,`Earlier art at ${x},${y} remains unchanged`);
 let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){count++;assert.equal(isGlassFloor(x+.5,y+.5),true);}
 assert.equal(count,14596);
 const pass=meta.passes[0];assert.equal(repairMask(pass).length,width*height);
 assert.deepEqual(pass.floorFeather.leftBelow,[725,728,628]);
 assert.equal(pass.floorFeather.top,undefined,'The old cap outline above the previous y649 pass must be fully removed');
});

test('east cleanup retains raw project and palette bytes and custom saved floor colors',async()=>{
 assert.equal(digest(read('published-world-project.json')),meta.reviewedProjectSha256);
 const rawPalette=read('assets/environment/floor-palette-compat.json');
 assert.equal(digest(rawPalette),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const manifest=JSON.parse(rawPalette),published=JSON.parse(read('published-world-project.json')).artwork['background.world'];
 let overlap=0;
 for(const[tile,runs]of Object.entries(published.tiles)){
  const[tx,ty]=tile.split(',').map(Number);
  for(const[start,n,color]of runs)for(let i=start;i<start+n;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64);if(!mask[y*width+x])continue;
   overlap++;assert.match(color,/ff$/i);
   assert.ok(manifest.tiles[tile].some(([a,length,old,next])=>a<=i&&i<a+length&&old===color&&next===null),'The existing exact palette already exposes this native repair');
  }
 }
 assert.equal(overlap,133);
 const mapper=compat.create({manifest});await mapper.ready;
 for(const[x,y]of [[728,647],[776,641],[775,700]])for(const color of ['#17c379ff','#00000000','#a342c680']){
  const tile=Math.floor(x/64)+','+Math.floor(y/64),index=(y%64)*64+x%64;
  const patch={width,height,tiles:{[tile]:[[index,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'Custom paint, erasures and partial paint keep priority');
 }
});

test('east cleanup keeps an immutable pre-pass native and the exact source crop composition',()=>{
 assert.equal(digest(read(meta.before)),'d02c110c6674974cec2411a3b6b617ae6384e1369e607d0b0deb0a338e37a060');
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const[sw,sh]=pngSize(read(meta.source)),[,,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01);
});
