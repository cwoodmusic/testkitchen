import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {APARTMENT_MOTION_FPS,apartmentMotionGeometry,createApartmentMotionRenderer} from './apartment-motion.mjs';

const digest=data=>createHash('sha256').update(data).digest('hex');
function asset(kind='lava',id='collection-clara-lava-lamp'){
 return {id,w:80,h:160,canvas:{getContext(){throw Error('The native PNG must not be read or repainted');}},motion:{kind,bounds:[.2,.12,.6,.66],mask:[[.4,.12],[.6,.12],[.8,.78],[.2,.78]],palette:kind==='lava'?['#68509c','#bd65cc','#f3b9e5','#79469b']:['#142739','#73c8b0','#ffdc98','#9183c7']}};
}
function fixture(options={}){
 const canvases=[],calls=[];
 const createCanvas=()=>{
  const canvas={width:0,height:0,puts:0,allocations:0,pixels:null};
  const context={createImageData(w,h){canvas.allocations++;return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(pixels){canvas.puts++;canvas.pixels=pixels;}};
  canvas.getContext=()=>context;canvases.push(canvas);return canvas;
 };
 const renderer=createApartmentMotionRenderer({createCanvas,reducedMotion:()=>false,...options});
 const c={imageSmoothingEnabled:true,drawImage(canvas,...coordinates){calls.push({canvas,coordinates});}};
 return {renderer,canvases,c,calls,item:{x:140,y:300,w:160,h:320}};
}
function assertClipped(canvas,geometry){
 assert(canvas.pixels.data.some(value=>value>0));
 for(let i=0;i<geometry.mask.length;i++)if(!geometry.mask[i])assert.equal(canvas.pixels.data[i*4+3],0,`Pixel ${i} escaped the authored mask`);
}

test('normalized glass geometry follows the authored polygon and caps only the cropped animation grid',()=>{
 const a=asset(),geometry=apartmentMotionGeometry(a);
 assert.equal(geometry.x,16);assert.equal(geometry.y,19.2);assert.equal(geometry.w,48);assert.equal(geometry.h,105.60000000000001);
 assert.equal(geometry.mask[0],0);assert.equal(geometry.mask[Math.floor(geometry.height/2)*geometry.width+Math.floor(geometry.width/2)],1);
 const large=apartmentMotionGeometry({...a,w:800,h:1600});assert.equal(Math.max(large.width,large.height),128);
 for(const bad of [{...a,w:Infinity},{...a,motion:{kind:'lava',bounds:[.9,0,.3,.5]}},{...a,motion:{kind:'lava',mask:[[0,0],[1,0],[NaN,1]]}},{...a,motion:{kind:'unrelated',bounds:[0,0,1,1]}}])assert.equal(apartmentMotionGeometry(bad),null);
});

test('lava moves inside the actual glass, loops cleanly and preserves native artwork and item anchoring',()=>{
 const {renderer,c,canvases,calls,item}=fixture(),a=asset(),native=a.canvas,geometry=apartmentMotionGeometry(a);
 assert.equal(renderer.draw(c,a,item,0),true);const canvas=canvases[0],first=digest(canvas.pixels.data);assertClipped(canvas,geometry);
 renderer.draw(c,a,item,6);assert.notEqual(digest(canvas.pixels.data),first);assertClipped(canvas,geometry);
 renderer.draw(c,a,item,24);assert.equal(digest(canvas.pixels.data),first);
 assert.strictEqual(a.canvas,native);assert.equal(c.imageSmoothingEnabled,true);assert.equal(canvases.length,1);assert.equal(canvas.allocations,1);
 const expected=[item.x-item.w/2+geometry.x/a.w*item.w,item.y-item.h+geometry.y/a.h*item.h,geometry.w/a.w*item.w,geometry.h/a.h*item.h];
 assert.deepEqual(calls[0].coordinates,expected);
});

test('native pixel buffers are reused and an animation frame updates only at its quantized interval',()=>{
 const {renderer,c,canvases,item}=fixture(),a=asset();renderer.draw(c,a,item,0);
 const canvas=canvases[0],pixels=canvas.pixels;
 for(let frame=0;frame<60;frame++)renderer.draw(c,a,item,frame/1000);
 assert.equal(canvas.puts,1);assert.equal(renderer.stats.generatedFrames,1);
 renderer.draw(c,a,item,1/APARTMENT_MOTION_FPS);assert.equal(canvas.puts,2);assert.strictEqual(canvas.pixels,pixels);assert.equal(canvas.allocations,1);
});

test('arcade pixels animate only on their screen and owner seeds produce 27 distinct games',()=>{
 const {renderer,c,canvases,item}=fixture({maxEntries:64}),hashes=new Set();
 for(let owner=0;owner<27;owner++){
  const a=asset('arcade',`collection-owner-${owner}-arcade`);a.motion.game=`owner-${owner}-rhythm-game`;
  renderer.draw(c,a,item,0);const canvas=canvases.at(-1),first=digest(canvas.pixels.data);hashes.add(first);assertClipped(canvas,apartmentMotionGeometry(a));
  renderer.draw(c,a,item,2);assert.notEqual(digest(canvas.pixels.data),first);assertClipped(canvas,apartmentMotionGeometry(a));
 }
 assert.equal(hashes.size,27);assert.equal(renderer.stats.entries,27);
});

test('lava colours and bubble positions remain deterministic and unique for all 27 owners',()=>{
 const {renderer,c,canvases,item}=fixture({maxEntries:64}),hashes=new Set();
 for(let owner=0;owner<27;owner++){
  const a=asset('lava',`collection-owner-${owner}-lava-lamp`);renderer.draw(c,a,item,4);hashes.add(digest(canvases.at(-1).pixels.data));
 }
 assert.equal(hashes.size,27);
 const other=fixture(),a=asset('lava','collection-owner-4-lava-lamp');other.renderer.draw(other.c,a,other.item,4);
 assert.equal(digest(other.canvases[0].pixels.data),digest(canvases[4].pixels.data));
});

test('the LRU bounds cached pixels and releases old canvas backings instead of retaining frame histories',()=>{
 const {renderer,c,canvases,item}=fixture({maxEntries:2,maxPixels:12000});
 for(let owner=0;owner<100;owner++){
  renderer.draw(c,asset('lava',`owner-${owner}`),item,owner);
  assert(renderer.stats.entries<=2);assert(renderer.stats.pixels<=12000);
 }
 for(const canvas of canvases.slice(0,-2)){assert.equal(canvas.width,1);assert.equal(canvas.height,1);}
 renderer.clear();assert.equal(renderer.stats.entries,0);assert.equal(renderer.stats.pixels,0);
 assert(canvases.every(canvas=>canvas.width===1&&canvas.height===1));
 const bounded=fixture({maxPixels:8});assert.equal(bounded.renderer.draw(bounded.c,asset(),bounded.item,0),false);assert.equal(bounded.canvases.length,0);
});

test('reduced motion leaves canonical art static and does not generate hidden animation frames',()=>{
 let reduced=true;const {renderer,c,canvases,item}=fixture({reducedMotion:()=>reduced}),a=asset();
 assert.equal(renderer.draw(c,a,item,0),false);assert.equal(canvases.length,0);
 reduced=false;renderer.draw(c,a,item,0);assert.equal(renderer.stats.generatedFrames,1);
 reduced=true;renderer.draw(c,a,item,8);assert.equal(renderer.stats.generatedFrames,1);
 reduced=false;renderer.draw(c,a,item,0);assert.equal(renderer.stats.generatedFrames,1);assert.equal(canvases.length,1);
 assert.equal(renderer.draw(c,{w:40,h:80},item,0),false);assert.equal(renderer.draw(c,a,{x:NaN,y:3},0),false);
});

test('the final glass clip reuses its cached path and restores caller state at every camera scale',()=>{
 const paths=[],events=[],stack=[];
 const f=fixture({createPath(){const path={points:[],moveTo(...p){this.points.push(p);},lineTo(...p){this.points.push(p);},closePath(){this.closed=true;}};paths.push(path);return path;}}),a=asset('arcade');
 Object.assign(f.c,{
  save(){stack.push(this.imageSmoothingEnabled);events.push('save');},restore(){this.imageSmoothingEnabled=stack.pop();events.push('restore');},
  translate(x,y){events.push(['translate',x,y]);},scale(x,y){events.push(['scale',x,y]);},clip(path){events.push(['clip',path]);}
 });
 const before=JSON.stringify(a.motion);
 for(let frame=0;frame<30;frame++)f.renderer.draw(f.c,a,{...f.item,w:80+frame,h:160+frame*2},frame/8);
 assert.equal(paths.length,1);assert.equal(f.canvases.length,1);assert(paths[0].closed);assert.deepEqual(paths[0].points,a.motion.mask.map(([u,v])=>[u*a.w,v*a.h]));
 assert.equal(events.filter(e=>e==='save').length,30);assert.equal(events.filter(e=>e==='restore').length,30);assert.equal(f.c.imageSmoothingEnabled,true);assert.equal(stack.length,0);
 assert(events.filter(Array.isArray).filter(e=>e[0]==='clip').every(e=>e[1]===paths[0]));assert.equal(JSON.stringify(a.motion),before);
 const geometry=apartmentMotionGeometry(a);assert.deepEqual(f.calls[0].coordinates,[geometry.x,geometry.y,geometry.w,geometry.h]);
 a.motion={...a.motion,mask:[[.3,.2],[.7,.2],[.6,.7],[.4,.7]],bounds:[.3,.2,.4,.5]};f.renderer.draw(f.c,a,f.item,1);assert.equal(paths.length,2);assert.equal(f.canvases[0].width,1);
});

test('a failed draw still restores the outer canvas state and reduced motion allocates no clip path',()=>{
 let reduced=true,paths=0,saves=0,restores=0;
 const f=fixture({reducedMotion:()=>reduced,createPath(){paths++;return {moveTo(){},lineTo(){},closePath(){}};}}),a=asset('arcade');
 Object.assign(f.c,{save(){saves++;},restore(){restores++;this.imageSmoothingEnabled=true;},translate(){},scale(){},clip(){},drawImage(){throw Error('target disposed');}});
 assert.equal(f.renderer.draw(f.c,a,f.item,0),false);assert.equal(paths,0);assert.equal(f.canvases.length,0);
 reduced=false;assert.throws(()=>f.renderer.draw(f.c,a,f.item,0),/target disposed/);assert.equal(paths,1);assert.equal(saves,1);assert.equal(restores,1);assert.equal(f.c.imageSmoothingEnabled,true);
});
