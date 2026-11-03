'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/dance-reflection-floor-regions.json');
const {combinedMask,repairMask}=require('../scripts/build-dance-reflections.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const {isGlassFloor}=require('../wall-reflections.js'),compat=require('../floor-palette-compat.js');
const mask=combinedMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('dance finishing masks remove both side streaks and preserve the panels, wall, rails and neon',()=>{
 for(const[x,y]of [[113,680],[113,700],[123,750],[124,740],[703,650],[703,680],[703,720],[775,680],[775,740]])assert.equal(mask[y*width+x],1,`Marked streak at ${x},${y} is repaired`);
 for(const[x,y]of [[75,700],[80,810],[112,650],[180,700],[650,750],[700,600],[810,700],[775,827],[300,850],[397,450]])assert.equal(mask[y*width+x],0,`Protected architecture, panels or prior room art at ${x},${y} remains unchanged`);
 let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){count++;assert.equal(isGlassFloor(x+.5,y+.5),true);}
 assert.equal(count,26592);
 for(const pass of meta.passes){assert.equal(repairMask(pass).length,width*height);assert.equal(pass.floorFeather.top,undefined,'Do not leave the head of a phantom streak');}
});

test('dance finishing leaves the published journal and every historical palette target byte-identical',async()=>{
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
   assert.ok(manifest.tiles[tile].some(([a,length,old,next])=>a<=i&&i<a+length&&old===color&&next===null),'Existing exact rules already reveal cleaned native glass');
  }
 }
 assert.equal(overlap,120);
 const mapper=compat.create({manifest});await mapper.ready;
 for(const[x,y]of [[113,700],[123,750],[703,680],[775,680]])for(const color of ['#17c379ff','#00000000','#a342c680']){
  const tile=Math.floor(x/64)+','+Math.floor(y/64),index=(y%64)*64+x%64;
  const patch={width,height,tiles:{[tile]:[[index,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'Intentional custom paint, transparency and partial paint keep priority');
 }
});

test('the finishing crop and immutable baseline preserve the approved room composition',()=>{
 assert.equal(digest(read(meta.before)),'23771e83b4dabb48af5dfa9c8a3aa1b2572c44de74663867a9fe5c265ea6171b');
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const [sw,sh]=pngSize(read(meta.source)),[, ,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01);
});
