'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),{meta,mask}=require('../scripts/build-northwest-neon-cap.cjs'),pixels=mask();
const compat=require('../floor-palette-compat.js'),{pngSize}=require('../scripts/build-source-reflections.cjs');
const read=file=>fs.readFileSync(path.join(root,file)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('northwest cap route owns the upper join, old lower rail and removed lamp but protects note glyphs and dance panels',()=>{
 for(const[x,y]of [[76,508],[160,508],[245,508],[251,508],[272,508],[76,540],[83,551],[90,560],[90,600],[110,640],[150,650],[225,650],[110,670]])assert.equal(pixels[y*1672+x],1,`Reviewed change at ${x},${y}`);
 for(const[x,y]of [[110,570],[165,570],[50,550],[75,680],[180,700],[300,550],[350,700],[397,450],[843,650]])assert.equal(pixels[y*1672+x],0,`Keep picture, cap, lower perimeter, panels or unrelated art at ${x},${y}`);
 assert.equal(pixels.reduce((n,value)=>n+value,0),18466);
 assert.deepEqual(meta.sourcePlacement,[30,480,300,225]);
 assert.ok(meta.sourceCopies.some(([sx,sy,sw,sh,x,y,w,h])=>x===244&&y===503&&x+w>=256&&h===12),'The top tube bridges the entire post seam rather than leaving a detached end');
});

test('reviewed northwest source and baseline retain their exact logical crop and immutable project data',()=>{
 assert.deepEqual(meta.worldSize,[1672,941]);
 assert.equal(sha(read(meta.before)),meta.beforeSha256);
 assert.equal(sha(read('published-world-project.json')),'90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b');
 assert.equal(sha(read('assets/environment/floor-palette-compat.json')),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const[w,h]=pngSize(read(meta.source));assert.ok(Math.abs(w/h-300/225)<.01);
});

test('all existing authored northwest pixels already expose the native repair without any new palette migration',async()=>{
 const patch=JSON.parse(read('published-world-project.json')).artwork['background.world'];
 const mapper=compat.create({manifest:JSON.parse(read('assets/environment/floor-palette-compat.json'))});await mapper.ready;
 const resolved=mapper.resolveTexture('background.world',patch);let original=0,opaque=0,visible=0;
 function visit(texture,fn){for(const[key,runs]of Object.entries(texture.tiles)){const[tx,ty]=key.split(',').map(Number);for(const[start,n,color]of runs)for(let i=start;i<start+n;i++){const x=tx*64+i%64,y=ty*64+Math.floor(i/64);if(pixels[y*1672+x])fn(color);}}}
 visit(patch,color=>{original++;if(/ff$/i.test(color))opaque++;});visit(resolved,()=>visible++);
 assert.equal(original,672);assert.equal(opaque,624);assert.equal(visible,0,'No obsolete authored border or lamp pigment may cover the cleaned native art');
 for(const color of ['#17c379ff','#00000000','#a342c680']){const i=(551%64)*64+83%64,custom={width:1672,height:941,tiles:{'1,8':[[i,1,color]]}};assert.equal(mapper.resolveTexture('background.world',custom),custom,'Unmatched custom paint and author erasures retain their priority');}
});
