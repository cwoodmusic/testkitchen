'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),meta=require('../scripts/west-neon-uniform-regions.json');
const {westNeonMask,isWestNeonArea}=require('../scripts/build-west-neon-uniform.cjs'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const read=file=>fs.readFileSync(path.join(root,file)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('the uniform tube owns the entire west vertical but excludes north reference, wall art, blue outer edge and lower turn',()=>{
 const mask=westNeonMask();assert.equal(mask.reduce((n,v)=>n+v,0),6080);
 for(const y of [511,530,550,600,630,650,665,680,700,720,750,780,800,810,814]){assert.equal(mask[y*1672+77],1);assert.equal(isWestNeonArea(77.5,y+.5),true);}
 for(const[x,y]of [[77,507],[77,510],[100,507],[150,507],[245,507],[272,507],[68,700],[89,700],[110,570],[165,570],[180,750],[77,815],[92,828],[119,837],[843,650]])assert.equal(mask[y*1672+x],0,`Preserve reference, geometry, signs or corner at ${x},${y}`);
 const [sx,sy,sw,sh,x,y,w,h]=meta.sourceCopies[0];
 assert.deepEqual([sx,sy,sw,sh],[69,511,20,304]);assert.deepEqual([x,y,w,h],[72,511,13,304]);
 assert.equal(h,sh,'Narrow only the neon cross-section; do not stretch cap-joint cadence vertically');
});

test('the west style pass retains the immutable current room and exact generated crop composition',()=>{
 assert.equal(sha(read(meta.before)),meta.beforeSha256);
 assert.equal(meta.beforeSha256,'9281fd551b53d7dd8575e7d5b9d2860ac57c2009a9998b96fe89b4a19c2cd385');
 assert.equal(sha(read('published-world-project.json')),'90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b');
 assert.equal(sha(read('assets/environment/floor-palette-compat.json')),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 assert.deepEqual(meta.sourcePlacement,[40,490,250,355]);const[w,h]=pngSize(read(meta.source));assert.ok(Math.abs(w/h-250/355)<.01);
});

test('the native-only west mask has no authored overlap and cannot require deleting user paint',()=>{
 const mask=westNeonMask(),patch=JSON.parse(read('published-world-project.json')).artwork['background.world'];let overlap=0;
 for(const[key,runs]of Object.entries(patch.tiles)){const[tx,ty]=key.split(',').map(Number);for(const[start,n]of runs)for(let i=start;i<start+n;i++)if(mask[(ty*64+Math.floor(i/64))*1672+tx*64+i%64])overlap++;}
 assert.equal(overlap,0);assert.notEqual(meta.preserveAuthoredOverlap,true);
});
