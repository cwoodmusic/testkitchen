'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/passage-transition-cleanup-regions.json');
const {passageTransitionMask,isPassageTransitionArea}=require('../scripts/build-passage-transition-cleanup.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const {floorFeatherWeight}=require('../scripts/build-walkway-cleanup.cjs'),compat=require('../floor-palette-compat.js');
const mask=passageTransitionMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('transition cleanup removes the whole neon route and star while preserving caps and actual lamps',()=>{
 for(const[x,y]of [[269,367],[294,367],[358,367],[295,340],[295,390],[295,425],[295,450]])assert.equal(mask[y*width+x],1,`Neon or pink streak at ${x},${y} is repaired`);
 for(const[x,y]of [[268,367],[359,367],[397,450],[295,339],[295,457],[843,650],[113,700],[250,250]])assert.equal(mask[y*width+x],0,`Surrounding artwork at ${x},${y} remains unchanged`);
 assert.equal(mask.reduce((count,pixel)=>count+pixel,0),10530);
 assert.equal(isPassageTransitionArea(294.5,367.5),true);
 assert.equal(floorFeatherWeight(meta.floorFeather,269,367),1,'Do not retain a pink fragment where the strip joins the left cap');
 assert.equal(floorFeatherWeight(meta.floorFeather,358,367),1,'Remove the complete strip up to the boutique wall');
 assert.equal(meta.floorFeather.top,undefined);
});

test('the existing palette exposes transition glass without changing saved colors or project data',async()=>{
 assert.equal(digest(read('published-world-project.json')),meta.reviewedProjectSha256);
 const rawPalette=read('assets/environment/floor-palette-compat.json');
 assert.equal(digest(rawPalette),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const manifest=JSON.parse(rawPalette),published=JSON.parse(read('published-world-project.json')).artwork['background.world'];
 let opaque=0,erased=0;
 for(const[tile,runs]of Object.entries(published.tiles)){
  const[tx,ty]=tile.split(',').map(Number);
  for(const[start,n,color]of runs)for(let i=start;i<start+n;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64);if(!mask[y*width+x])continue;
   if(/ff$/i.test(color))opaque++;else{assert.equal(color,'#00000000');erased++;}
   assert.ok((manifest.tiles[tile]||[]).some(([a,length,old,next])=>a<=i&&i<a+length&&old===color&&next===null));
  }
 }
 assert.equal(opaque,173);assert.equal(erased,1869,'Published pathway erasures remain raw and unchanged');
 const mapper=compat.create({manifest});await mapper.ready;
 for(const color of ['#17c379ff','#00000000','#a342c680']){
  const x=294,y=367,tile=Math.floor(x/64)+','+Math.floor(y/64),index=(y%64)*64+x%64;
  const patch={width,height,tiles:{[tile]:[[index,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'Different saved pigments and erasures keep priority');
 }
});

test('transition cleanup uses the immutable approved base and exact source composition',()=>{
 assert.equal(digest(read(meta.before)),meta.beforeSha256);
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const[sw,sh]=pngSize(read(meta.source)),[,,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01);
});
