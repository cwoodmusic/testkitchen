import test from 'node:test';
import assert from 'node:assert/strict';
import {drawShowroomFloor,drawShowroomWallpaper} from './showroom-materials.mjs';

const wood=['#a87342','#d8a46a','#65442d','#bb8750','#513b2e'];
const paper=['#eee1be','#fff1d1','#687a63','#c69848','#568b8b'];
const floorPatterns=['teak-planks','terrazzo','bathroom-hex'];
const wallPatterns=['midcentury-atomic','tiny-stars','music-confetti'];
const upperFloors=['spaceport-terrazzo','neon-panels','clockwork-parquet','companion-cork'];
const upperWalls=['orbital','circuit','clockwork','companion'];

// A small source-over raster canvas records the actual whole-pixel material
// output without requiring a browser or duplicating the material algorithms.
function rasterDocument(){
 const canvases=[];
 return {canvases,document:{createElement(name){
  assert.equal(name,'canvas');
  const canvas={width:0,height:0,pixels:null,writes:0,fractionalWrites:0};canvases.push(canvas);
  const context={fillStyle:'#000000',fillRect(x,y,w,h){
   canvas.writes++;if([x,y,w,h].some(value=>!Number.isInteger(value)))canvas.fractionalWrites++;
   const hex=this.fillStyle.slice(1),r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16),alpha=hex.length===8?parseInt(hex.slice(6,8),16)/255:1;
   assert(Number.isFinite(r+g+b+alpha),`Invalid material colour ${this.fillStyle}`);
   for(let yy=Math.max(0,y);yy<Math.min(canvas.height,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(canvas.width,x+w);xx++){
    const i=(yy*canvas.width+xx)*4;
    canvas.pixels[i]=Math.round(r*alpha+canvas.pixels[i]*(1-alpha));canvas.pixels[i+1]=Math.round(g*alpha+canvas.pixels[i+1]*(1-alpha));canvas.pixels[i+2]=Math.round(b*alpha+canvas.pixels[i+2]*(1-alpha));canvas.pixels[i+3]=255;
   }
  }};
  canvas.getContext=()=>{canvas.pixels??=new Uint8ClampedArray(canvas.width*canvas.height*4);return context;};return canvas;
 }}};
}
function drawingTarget(){
 return {texture:null,save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},fillRect(){},createPattern(canvas,repetition){assert.equal(repetition,'repeat');this.texture=canvas;return {};}};
}
function drawTexture(pattern,kind='floor',colors=kind==='floor'?wood:paper,draw={drawShowroomFloor,drawShowroomWallpaper}){
 const target=drawingTarget(),finish={pattern,colors},room={x:21,y:37,w:710,h:510,floor:finish,wallpaper:finish,wallpaperAreas:[{x:21,y:37,w:710,h:190}]};
 (kind==='floor'?draw.drawShowroomFloor:draw.drawShowroomWallpaper)(target,room);return target.texture;
}
function differences(a,b){
 assert.equal(a.length,b.length);let count=0;
 for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;
 return count/(a.length/4);
}
function stats(canvas,base){
 const rgb=[1,3,5].map(index=>parseInt(base.slice(index,index+2),16)),colors=new Set();let quiet=0;
 for(let i=0;i<canvas.pixels.length;i+=4){
  const [r,g,b]=canvas.pixels.slice(i,i+3);colors.add(`${r},${g},${b}`);
  if(r===rgb[0]&&g===rgb[1]&&b===rgb[2])quiet++;
  assert.equal(canvas.pixels[i+3],255);
 }
 return {colors:colors.size,quiet:quiet/(canvas.width*canvas.height)};
}
async function withRaster(run){
 const original=globalThis.document,raster=rasterDocument();globalThis.document=raster.document;
 try{return await run(raster);}finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
}

test('material textures are generated once per finish, reused across rooms, and deterministic in a fresh cache',()=>withRaster(async raster=>{
 const fresh=await import('./showroom-materials.mjs?deterministic-material-test');
 for(const [kind,patterns,colors]of [['floor',[...floorPatterns,...upperFloors],wood],['wallpaper',[...wallPatterns,...upperWalls],paper]])for(const pattern of patterns){
  const first=drawTexture(pattern,kind,colors),writes=first.writes,count=raster.canvases.length;
  const again=drawTexture(pattern,kind,colors.slice());
  assert.strictEqual(again,first);assert.equal(first.writes,writes);assert.equal(raster.canvases.length,count);
  const regenerated=drawTexture(pattern,kind,colors,fresh);
  assert.notStrictEqual(regenerated,first);assert.deepEqual(regenerated.pixels,first.pixels);
  assert.equal(first.width,kind==='floor'?256:96);assert.equal(first.height,first.width);assert.equal(first.fractionalWrites,0);
 }
}));

test('the four upper collections have individual floors and calm coordinated wall motifs',()=>withRaster(()=>{
 for(const [kind,patterns]of [['floor',upperFloors],['wallpaper',upperWalls]]){
  const canvases=patterns.map(pattern=>drawTexture(pattern,kind,kind==='floor'?wood:paper));
  for(let i=0;i<canvases.length;i++){
   assert(stats(canvases[i],kind==='floor'?wood[0]:paper[0]).colors>=6);
   if(kind==='wallpaper'){const result=stats(canvases[i],paper[0]);assert(result.quiet>.75&&result.quiet<.995,'A themed wall still needs quiet background around its furniture');}
   for(let j=i+1;j<canvases.length;j++)assert(differences(canvases[i].pixels,canvases[j].pixels)>.01,patterns[i]+' must not fall through to '+patterns[j]);
  }
 }
}));

test('teak, terrazzo and bathroom hex have visibly distinct structure even with the same palette',()=>withRaster(()=>{
 const textures=floorPatterns.map(pattern=>drawTexture(pattern));
 for(let a=0;a<textures.length;a++){
  assert(stats(textures[a],wood[0]).colors>=8,'Pixel grain should create more than flat palette blocks');
  for(let b=a+1;b<textures.length;b++)assert(differences(textures[a].pixels,textures[b].pixels)>.2,`${floorPatterns[a]} and ${floorPatterns[b]} should differ across the room`);
 }
 const parquet=drawTexture('parquet');assert(differences(textures[0].pixels,parquet.pixels)>.2,'Narrow teak boards should not reuse parquet square panels');
}));

test('atomic, stars and music paper remain sparse and distinct from the old diamond wallpaper',()=>withRaster(()=>{
 const textures=wallPatterns.map(pattern=>drawTexture(pattern,'wallpaper'));
 for(let a=0;a<textures.length;a++){
  const result=stats(textures[a],paper[0]);assert(result.quiet>.78,'Small accents should leave a calm cream wall');assert(result.quiet<.99,'Motifs should remain visible');assert(result.colors>=6,'The paper needs native pixel grain and motif detail');
  for(let b=a+1;b<textures.length;b++)assert(differences(textures[a].pixels,textures[b].pixels)>.015,`${wallPatterns[a]} and ${wallPatterns[b]} should have different motifs`);
 }
 const geometric=drawTexture('geometric','wallpaper');assert(differences(textures[0].pixels,geometric.pixels)>.1,'Atomic boomerangs and starbursts should replace the Victorian diamond layout');
}));
