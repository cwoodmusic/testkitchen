'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/lounge-floor-regions.json');
const {loungeMask,isLoungeFloor}=require('../scripts/build-lounge-floor.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const mask=loungeMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('lounge glass reaches the whole floral room while preserving walls, caps, neon and the boutique',()=>{
 for(const[x,y]of [[150,220],[210,160],[300,180],[425,210],[437,240],[200,300],[280,350],[350,350]])assert.equal(mask[y*width+x],1,`Lounge floor ${x},${y} is replaced`);
 for(const[x,y]of [[75,250],[140,145],[260,140],[400,160],[450,220],[200,316],[260,330],[300,365],[365,280],[397,359],[800,210],[775,641],[113,700]])assert.equal(mask[y*width+x],0,`Earlier architecture or art at ${x},${y} is preserved`);
 let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){count++;assert.equal(isLoungeFloor(x+.5,y+.5),true);}
 assert.ok(count>54000&&count<55000,'The replacement follows the complete reviewed lounge silhouette');
});

test('lounge floor replacement has no authored overlap and leaves project and palette bytes intact',()=>{
 const rawProject=read('published-world-project.json');assert.equal(digest(rawProject),meta.reviewedProjectSha256);
 assert.equal(digest(read('assets/environment/floor-palette-compat.json')),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const project=JSON.parse(rawProject);let overlap=0;
 for(const[tile,runs]of Object.entries(project.artwork['background.world'].tiles)){
  const[tx,ty]=tile.split(',').map(Number);
  for(const[start,length]of runs)for(let i=start;i<start+length;i++)if(mask[(ty*64+Math.floor(i/64))*width+tx*64+i%64])overlap++;
 }
 assert.equal(overlap,0,'Native finishing cannot consume an authored floor stroke');
});

test('lounge source and immutable baseline retain the reviewed composition',()=>{
 assert.equal(digest(read(meta.before)),meta.beforeSha256);
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const[sw,sh]=pngSize(read(meta.source)),[,,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01,'The generated lounge crop cannot be stretched into another layout');
});
