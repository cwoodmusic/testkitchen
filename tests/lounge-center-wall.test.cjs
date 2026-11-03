'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {metadata:meta,centerWallMask,compositorMeta}=require('../scripts/lounge-center-wall-mask.cjs');
const {pngSize}=require('../scripts/build-source-reflections.cjs');
const mask=centerWallMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('only the center purple facade may flatten; both angled sides and the floor stay outside its mask',()=>{
 for(const[x,y]of [[234,80],[359,80],[245,100],[300,120],[354,130],[300,34]])assert.equal(mask[y*width+x],1,`Center facade ${x},${y} receives a flat face`);
 for(const[x,y]of [[232,80],[361,80],[210,76],[188,103],[223,130],[400,100],[435,120],[300,147],[300,170],[155,236]])assert.equal(mask[y*width+x],0,`Angled wall, lamp, floor or prior lounge art at ${x},${y} is protected`);
 let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){
  count++;assert.ok(x>=233&&x<361&&y>=33&&y<147,'The mask cannot widen into either angled side face');
 }
 assert.equal(count,7512);
});

test('the existing LOUNGE sign, its glow and the complete blue cap retain their exact original pixels',()=>{
 for(let y=36;y<95;y++)for(let x=235;x<355;x++)assert.equal(mask[y*width+x],0,'Preserve the full sign and its original halo, rather than redrawing the lettering');
 for(let y=16;y<=32;y++)for(let x=174;x<461;x++)assert.equal(mask[y*width+x],0,'The facade must meet the current cap without moving or repainting it');
 assert.equal(compositorMeta().preserveProject,true);
 const raw=read('published-world-project.json');assert.equal(digest(raw),meta.reviewedProjectSha256);
 let overlap=0;
 for(const[tile,runs]of Object.entries(JSON.parse(raw).artwork['background.world'].tiles)){
  const[tx,ty]=tile.split(',').map(Number);
  for(const[start,length]of runs)for(let i=start;i<start+length;i++)if(mask[(ty*64+Math.floor(i/64))*width+tx*64+i%64])overlap++;
 }
 assert.equal(overlap,0,'The center facade change must not consume any saved artwork');
});

test('the generated center facade keeps the approved crop composition and immutable common baseline',()=>{
 assert.equal(digest(read(meta.before)),meta.beforeSha256);
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const[sw,sh]=pngSize(read(meta.source)),[,,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01);
});
