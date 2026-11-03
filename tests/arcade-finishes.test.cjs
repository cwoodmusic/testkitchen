'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {registry,readPasses,combinedMask,validatePass}=require('../scripts/build-arcade-finishes.cjs');
const {cleanupMask}=require('../scripts/build-walkway-cleanup.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const root=path.resolve(__dirname,'..');

test('the aggregate pass keeps four independent reviewed masks within their own source crops',()=>{
 assert.equal(readPasses().length,4);
 const aggregate=combinedMask(),coverage=new Uint8Array(aggregate.length);
 for(const{meta}of readPasses()){
  const mask=validatePass(meta),[sw,sh]=pngSize(fs.readFileSync(path.join(root,meta.source))),[,,w,h]=meta.sourcePlacement;
  assert.deepEqual(mask,cleanupMask(meta));assert.ok(Math.abs(sw/sh-w/h)<.01);
  for(let i=0;i<mask.length;i++)if(mask[i]){assert.equal(coverage[i],0,'Independent changes cannot overwrite another requested region');coverage[i]=1;}
 }
 assert.deepEqual(aggregate,coverage);
 for(const[x,y]of [[843,650],[294,367],[240,110],[75,512],[83,551]])assert.equal(aggregate[y*1672+x],1);
 for(const[x,y]of [[290,65],[400,100],[200,115],[819,502],[397,450],[300,750],[843,725]])assert.equal(aggregate[y*1672+x],0,'Preserve signs, side walls, other lamps and panels');
});

test('aggregate provenance remains the approved native with unchanged project and palette',()=>{
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 assert.equal(digest(registry.before),registry.beforeSha256);
 assert.equal(digest('published-world-project.json'),'90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b');
 assert.equal(digest('assets/environment/floor-palette-compat.json'),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const invalid={...readPasses()[0].meta,sourcePlacement:[1,1,2,2]};
 assert.throws(()=>validatePass(invalid),/outside its source placement/);
});
