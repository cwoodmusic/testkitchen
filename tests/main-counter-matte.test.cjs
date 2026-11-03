'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const png=require('../scripts/rgba-png.cjs'),meta=require('../scripts/main-counter-matte-regions.json');
const {topMask,compose,furnitureManifest}=require('../scripts/build-main-counter-matte.cjs');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pixel=(image,x,y)=>Array.from(image.data.subarray((y*image.width+x)*4,(y*image.width+x)*4+4));

test('lossless PNG compositing preserves RGB even beneath tiny or zero alpha',()=>{
 const image={width:3,height:2,data:Buffer.from([250,7,129,0,19,214,8,1,100,200,250,254,0,0,0,255,25,80,190,12,255,255,255,128])};
 assert.deepEqual(png.decode(png.encode(image)),image);
 assert.throws(()=>png.decode(Buffer.from('not PNG')),/PNG/);
 const original=png.decode(read(meta.before));assert.deepEqual([original.width,original.height],[560,238]);
 assert.deepEqual(pixel(original,195,29),[200,252,244,251],'Decode the original PNG filters without alpha-premultiplication drift');
});

test('the reviewed mask covers all four green reflection columns and protects gold, front panels and alpha',()=>{
 const before=png.decode(read(meta.before)),mask=topMask(before);
 for(const[x,y]of [[50,28],[195,29],[195,35],[350,35],[420,35]])assert.equal(mask[y*before.width+x],1,`Matte tabletop ${x},${y}`);
 for(const[x,y]of [[195,27],[195,75],[200,115],[40,150],[520,205],[0,0],[110,8]])assert.equal(mask[y*before.width+x],0,`Protected trim, front or outline ${x},${y}`);
 const source={width:before.width,height:before.height,data:Buffer.alloc(before.data.length)};
 for(let at=0;at<source.data.length;at+=4){source.data[at]=5;source.data[at+1]=60;source.data[at+2]=36;source.data[at+3]=254;}
 const result=compose(before,source);assert.equal(result.allowed,19328);
 for(let i=0;i<mask.length;i++){
  assert.equal(result.data[i*4+3],before.data[i*4+3],'The original alpha silhouette remains exact');
  if(!mask[i])assert.deepEqual(result.data.subarray(i*4,i*4+4),before.data.subarray(i*4,i*4+4));
 }
});

test('the generated matte top removes bright bands while every unreviewed sprite byte remains exact',()=>{
 const before=png.decode(read(meta.before)),after=png.decode(read(meta.output)),mask=topMask(before);let changed=0;
 assert.deepEqual([after.width,after.height],meta.size);
 assert.equal(sha(read(meta.before)),'acbd11c434715584d16ca7f8f6266a12aba358b021de60bf8da8280773dc68b7');
 for(let i=0;i<mask.length;i++){
  assert.equal(after.data[i*4+3],before.data[i*4+3]);
  if(!mask[i])assert.deepEqual(after.data.subarray(i*4,i*4+4),before.data.subarray(i*4,i*4+4));
  if(!after.data.subarray(i*4,i*4+3).equals(before.data.subarray(i*4,i*4+3)))changed++;
 }
 assert.ok(changed>18000);
 for(const[x,y]of [[50,28],[195,29],[195,35],[350,35],[420,35]]){
  const old=pixel(before,x,y),matte=pixel(after,x,y);
  assert.ok(matte[1]<130&&matte[1]<old[1]-70,'Replace bright green/white bands with matte jade: '+x+','+y);
  assert.ok(matte[1]>matte[0]&&matte[1]>matte[2],'Keep the tabletop green');
 }
 const libraryBefore=png.decode(read(meta.libraryBefore)),libraryAfter=png.decode(read(meta.libraryOutput));
 assert.deepEqual([libraryAfter.width,libraryAfter.height],[361,142]);
 for(let y=0;y<142;y++)for(let x=0;x<361;x++){
  const at=(y*361+x)*4;assert.equal(libraryAfter.data[at+3],libraryBefore.data[at+3]);
  if(y>=40)assert.deepEqual(libraryAfter.data.subarray(at,at+4),libraryBefore.data.subarray(at,at+4),'The lit front and feet remain unchanged in the library copy');
 }
});

test('only the jade-counter furniture provenance and its source digest change',()=>{
 const before=JSON.parse(read(meta.furnitureManifestBefore)),after=JSON.parse(read(meta.furnitureManifest)),expected=furnitureManifest(before,read(meta.output),read(meta.libraryOutput));
 assert.deepEqual(after,expected);
 for(const item of after.items){
  const old=before.items.find(record=>record.id===item.id);
  if(item.id==='counter-jade-south'){assert.deepEqual({...item,sha256:old.sha256},old);continue;}
  assert.deepEqual(item,old,'Other furniture records stay intact');
  for(const file of item.outputs)assert.equal(sha(read(file)),old.sha256,'Other furniture PNGs remain byte-identical');
 }
 for(const source of after.sources)if(source.path!==meta.output)assert.deepEqual(source,before.sources.find(record=>record.path===source.path));
});
