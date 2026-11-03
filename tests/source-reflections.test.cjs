'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const repoRoot=path.resolve(__dirname,'..');
const meta=require('../scripts/reflection-floor-regions.json');
const {repairMask,combinedMask,pngSize}=require('../scripts/build-source-reflections.cjs');
const {generateManifest}=require('../scripts/build-floor-palette-compat.cjs');
const {isGlassFloor}=require('../wall-reflections.js');
const compat=require('../floor-palette-compat.js');
const [width,height]=meta.worldSize,mask=combinedMask();

test('reflection cleanup is confined to reviewed glass and leaves matching lamps, panels and borders alone',()=>{
 for(const [x,y]of [[453,427],[540,427],[625,427],[453,450],[540,465],[625,470],[775,650],[775,680],[780,750]])assert.equal(mask[y*width+x],1,`Unpaired streak ${x},${y} receives cleanup`);
 for(const [x,y]of [[397,450],[703,680],[650,600],[670,810],[808,700],[775,837],[1000,450]])assert.equal(mask[y*width+x],0,`The source lamp, matched reflection, wall, tile or rail at ${x},${y} is preserved`);
 let count=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){count++;assert.equal(isGlassFloor(x+.5,y+.5),true);}
 assert.ok(count>25000&&count<30000,'Repair both full streak zones without expanding over the room');
 for(const pass of meta.passes){const part=repairMask(pass);assert.equal(part.length,width*height);assert.equal(pass.floorFeather.top,undefined,'Orphan contact points must be replaced at the first floor row');}
});

test('the reviewed journal snapshot contains only exact opaque floor pigments from the unchanged export',()=>{
 const raw=fs.readFileSync(path.join(repoRoot,'published-world-project.json')),project=JSON.parse(raw),reference=JSON.parse(fs.readFileSync(path.join(repoRoot,meta.journalReference)));
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),meta.reviewedProjectSha256);
 // Asset/NPC placements can change while this immutable pigment snapshot
 // still matches the current authored background pixel for pixel below.
 assert.equal(reference.projectSha256,meta.journalProjectSha256);
 let opaque=0,erased=0;
 for(const [key,runs]of Object.entries(project.artwork['background.world'].tiles)){
  const [tx,ty]=key.split(',').map(Number),referencePixels=new Map();
  for(const [start,n,color]of reference.tiles[key]||[])for(let i=start;i<start+n;i++)referencePixels.set(i,color);
  for(const [start,n,color]of runs)for(let i=start;i<start+n;i++){
   const x=tx*64+i%64,y=ty*64+Math.floor(i/64);if(!mask[y*width+x])continue;
   if(/ff$/i.test(color)){opaque++;assert.equal(referencePixels.get(i),color);}
   else{erased++;assert.equal(referencePixels.has(i),false,'Transparent and partial authoring never become cleanup seeds');}
  }
 }
 assert.equal(opaque,7220);assert.equal(erased,1043);
 assert.deepEqual(fs.readFileSync(path.join(repoRoot,'published-world-project.json')),raw);
});

test('only exact reviewed opaque colors clear; custom paint and erasures remain authoritative',async()=>{
 const width=128,height=64,clearMask=new Uint8Array(width*height);clearMask[0]=clearMask[1]=clearMask[2]=1;
 const target={width,height,tiles:{'0,0':[[0,1,'#112233ff'],[1,1,'#00000000'],[2,1,'#33445580'],[3,1,'#112233ff']]}};
 const reference={width,height,tiles:{'0,0':[[0,1,'#112233ff']]}};
 const previous={version:1,width,height,tiles:{'0,0':[[0,1,'#445566ff','#112233ff'],[1,1,'#998877ff','#00000000']]}};
 const before=JSON.stringify({target,reference,previous}),manifest=generateManifest({previous,target,reference,clearMask,width,height});
 const mapper=compat.create({manifest});await mapper.ready;
 const incoming={width,height,tiles:{'0,0':[[0,1,'#112233ff'],[1,1,'#00000000'],[2,1,'#33445580'],[3,1,'#112233ff']]}};
 assert.deepEqual(mapper.resolveTexture('background.world',incoming).tiles,{'0,0':[[1,1,'#00000000'],[2,1,'#33445580'],[3,1,'#112233ff']]});
 for(const color of ['#00cc99ff','#00000000','#11223380']){
  const patch={width,height,tiles:{'0,0':[[0,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'Different, transparent or partial custom colors keep priority');
 }
 const old={width,height,tiles:{'0,0':[[0,1,'#445566ff']]}};
 assert.deepEqual(mapper.resolveTexture('background.world',old).tiles,{});
 assert.equal(JSON.stringify({target,reference,previous}),before);
 assert.deepEqual(generateManifest({previous:manifest,target,reference,clearMask,width,height}),manifest,'Rebuilding retains exact-color provenance and ordering');
 const custom=structuredClone(target);custom.tiles['0,0'][0][2]='#00cc99ff';
 const rebuilt=generateManifest({previous:manifest,target:custom,reference,clearMask,width,height});
 assert.ok(!rebuilt.tiles['0,0'].some(rule=>rule[2]==='#00cc99ff'),'A newly published custom color never becomes a cleanup seed');
});

test('previous repair targets outside the opaque footprint cannot be retargeted by an old raw export',async()=>{
 const width=128,height=64,clearMask=new Uint8Array(width*height);clearMask[0]=1;
 const target={width,height,tiles:{'0,0':[[0,1,'#112233ff'],[1,1,'#ff00ffff'],[2,1,'#00000000']]}};
 const reference={width,height,tiles:{'0,0':[[0,1,'#112233ff']]}};
 const previous={version:1,width,height,tiles:{'0,0':[[0,1,'#445566ff','#112233ff'],[1,1,'#ff00ffff','#00052fff'],[1,1,'#aa00ffff','#00052fff'],[2,1,'#998877ff','#00000000']]}};
 const manifest=generateManifest({previous,target,reference,clearMask,width,height}),mapper=compat.create({manifest});await mapper.ready;
 assert.deepEqual(mapper.resolveTexture('background.world',target).tiles,{'0,0':[[1,1,'#00052fff'],[2,1,'#00000000']]},'Existing navy repair must survive a stale magenta published pigment');
 for(const color of ['#00052fff','#00cc99ff','#00000000']){
  const patch={width,height,tiles:{'0,0':[[1,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',patch),patch,'No intermediate or custom color is newly seeded outside the reviewed footprint');
 }
 assert.deepEqual(generateManifest({previous:manifest,target,reference,clearMask,width,height}),manifest);
});

test('the complete historical palette retains every target outside the reviewed opaque footprint',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(repoRoot,'assets/environment/floor-palette-compat.json')));
 const reference=JSON.parse(fs.readFileSync(path.join(repoRoot,meta.journalReference))),reviewed=new Set();
 for(const [tile,runs]of Object.entries(reference.tiles))for(const[start,n]of runs)for(let i=start;i<start+n;i++)reviewed.add(tile+'/'+i);
 const outside=new Map();
 for(const [tile,rules]of Object.entries(manifest.tiles))for(const[start,n,color,target]of rules)for(let i=start;i<start+n;i++)
  if(!reviewed.has(tile+'/'+i))outside.set(tile+'/'+i+'/'+color.toLowerCase(),target===null?null:target.toLowerCase());
 const entries=[...outside].sort(([a],[b])=>a.localeCompare(b));
 // Captured from the published pre-repair manifest, before extending these two
 // regions. This catches a global rebase to stale colors in the raw export.
 assert.equal(entries.length,55581);
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex'),'cc1ac8e729ca63f06bf76f648c743bd563c17de9e6167abb5843ff7e05275e30');
});

test('native reflection sources retain their declared crop composition',()=>{
 for(const pass of meta.passes){
  const size=pngSize(fs.readFileSync(path.join(repoRoot,pass.source)));
  assert.ok(Math.abs(size[0]/size[1]-pass.sourcePlacement[2]/pass.sourcePlacement[3])<.01,'Generated crops must keep the declared layout aspect ratio');
 }
 assert.throws(()=>pngSize(Buffer.from('not a png')),/PNG/);
});
