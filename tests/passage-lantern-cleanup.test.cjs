'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/passage-lantern-cleanup-regions.json');
const {passageLanternMask,isPassageLanternArea}=require('../scripts/build-passage-lantern-cleanup.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const compat=require('../floor-palette-compat.js'),{isGlassFloor}=require('../wall-reflections.js');
const mask=passageLanternMask(),[width,height]=meta.worldSize,read=file=>fs.readFileSync(path.join(root,file));
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('the lantern contour includes suspension, bulb, warmed cap and both floor halos without consuming other lamps',()=>{
 for(const[x,y]of [[841,604],[843,620],[843,640],[843,650],[843,678],[843,705],[813,640],[818,672],[869,642],[867,669]])assert.equal(mask[y*width+x],1,`Lantern or glow at ${x},${y} is repaired`);
 for(const[x,y]of [[843,590],[843,715],[843,725],[818,819],[819,502],[816,596],[809,650],[876,650],[775,680],[113,700],[397,450],[250,250]])assert.equal(mask[y*width+x],0,`Other native art at ${x},${y} is preserved`);
 assert.equal(mask.reduce((count,pixel)=>count+pixel,0),5609);
 assert.equal(isGlassFloor(843.5,650.5),false,'The actual cap needs repair along with the glass halo');
 assert.equal(isPassageLanternArea(843.5,650.5),true);
 assert.equal(meta.floorFeather,undefined,'Replace the entire warmed cap, without feathered pink remnants');
});

test('existing blue authored trim retains priority and neither project nor palette is rewritten',async()=>{
 assert.equal(digest(read('published-world-project.json')),meta.reviewedProjectSha256);
 const rawPalette=read('assets/environment/floor-palette-compat.json');
 assert.equal(digest(rawPalette),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const manifest=JSON.parse(rawPalette),published=JSON.parse(read('published-world-project.json')).artwork['background.world'];
 let exposed=0,paintedTrim=0;
 for(const[tile,runs]of Object.entries(published.tiles)){
  const[tx,ty]=tile.split(',').map(Number);
  for(const[start,n,color]of runs)for(let i=start;i<start+n;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64);if(!mask[y*width+x])continue;
   assert.match(color,/ff$/i);
   assert.ok(x>=854&&x<=862&&y>=598&&y<=626,'Authored trim stays away from the removed lamp and warmed cap');
   if((manifest.tiles[tile]||[]).some(([a,length,old,next])=>a<=i&&i<a+length&&old===color&&next===null))exposed++;
   else{
    paintedTrim++;
    const[r,g,b]=color.slice(1,7).match(/../g).map(value=>parseInt(value,16));
    assert.ok(r<=35&&g<=35&&b<=174&&b>=r,'Retain quiet blue frame paint without restoring lamp warmth');
   }
  }
 }
 assert.equal(exposed,49);assert.equal(paintedTrim,150);
 const mapper=compat.create({manifest});await mapper.ready;
 for(const[x,y]of [[843,650],[813,640],[869,642]])for(const color of ['#17c379ff','#00000000','#a342c680']){
  const tile=Math.floor(x/64)+','+Math.floor(y/64),index=(y%64)*64+x%64;
  const patch={width,height,tiles:{[tile]:[[index,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'Custom opaque, partial or erased pixels remain authoritative');
 }
});

test('the lamp pass retains an immutable pre-edit native and the source crop composition',()=>{
 assert.equal(digest(read(meta.before)),meta.beforeSha256);
 assert.deepEqual(pngSize(read(meta.before)),meta.worldSize);
 const[sw,sh]=pngSize(read(meta.source)),[,,w,h]=meta.sourcePlacement;
 assert.ok(Math.abs(sw/sh-w/h)<.01);
});
