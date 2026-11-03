'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const meta=require('../scripts/west-neon-uniform-regions.json'),{westNeonMask}=require('../scripts/build-west-neon-uniform.cjs');
const png=require('../scripts/rgba-png.cjs'),compat=require('../floor-palette-compat.js');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

test('the west finish preserves every native pixel outside its dedicated vertical-cap mask',()=>{
 assert.equal(sha(read(meta.before)),meta.beforeSha256);
 const before=png.decode(read(meta.before)),after=png.decode(read(meta.output)),mask=westNeonMask();
 assert.deepEqual([before.width,before.height],meta.worldSize);assert.deepEqual([after.width,after.height],meta.worldSize);
 let changed=0,outside=0;
 for(let i=0;i<mask.length;i++){
  const at=i*4;if(before.data[at]===after.data[at]&&before.data[at+1]===after.data[at+1]&&before.data[at+2]===after.data[at+2]&&before.data[at+3]===after.data[at+3])continue;
  changed++;if(!mask[i])outside++;
 }
 assert.ok(changed>1000,'The complete old upper and lower neon profiles must be replaced');
 assert.equal(outside,0,'Keep all previous walls, floors, pictures, furniture and lamps exact');
 for(let x=60;x<282;x++){
  const at=(507*before.width+x)*4;
  assert.deepEqual(after.data.subarray(at,at+4),before.data.subarray(at,at+4),'The north horizontal hot core remains byte-exact');
 }
});

test('the narrow native strip has no authored overlap and preserves saved floor paint and erasures',async()=>{
 assert.equal(sha(read('published-world-project.json')),'90b0319e0102c454c0f3217576c0ac5e157101952136a9584b4b4ae8d33a5b2b');
 const palette=read('assets/environment/floor-palette-compat.json');
 assert.equal(sha(palette),'8135e15d9907eacadfacac92e2f52e3d03a041ae3ba394edeff04af8aef38a44');
 const patch=JSON.parse(read('published-world-project.json')).artwork['background.world'],mask=westNeonMask();let overlap=0;
 for(const[key,runs]of Object.entries(patch.tiles)){
  const[tx,ty]=key.split(',').map(Number);
  for(const[start,n]of runs)for(let i=start;i<start+n;i++)if(mask[(ty*64+Math.floor(i/64))*1672+tx*64+i%64])overlap++;
 }
 assert.equal(overlap,0,'No palette migration or authored-pixel removal is needed');
 const mapper=compat.create({manifest:JSON.parse(palette)});await mapper.ready;
 for(const y of [550,700,800])for(const color of ['#17c379ff','#00000000','#a342c680']){
  const x=77,key=Math.floor(x/64)+','+Math.floor(y/64),index=(y%64)*64+x%64;
  const custom={width:1672,height:941,tiles:{[key]:[[index,1,color]]}};
  assert.equal(mapper.resolveTexture('background.world',custom),custom,'A custom opaque, erased or partial pixel keeps priority');
 }
});
