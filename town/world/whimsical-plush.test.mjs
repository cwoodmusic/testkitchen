import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {WHIMSICAL_PLUSH_DEFINITIONS as definitions,WHIMSICAL_PLUSH_DIRECTIONS as directions} from './whimsical-plush-definitions.mjs';
import {registerWhimsicalPlush,getWhimsicalPlushCacheStats} from './whimsical-plush.mjs';

const base=new URL('../assets/whimsical-plush/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',base))),sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('twelve new plush products have48 real cardinal source drawings and bounded native art',()=>{
 assert.equal(definitions.length,12);assert.equal(new Set(definitions.map(d=>d.id)).size,12);assert.equal(manifest.frames.length,48);assert(manifest.width*manifest.height<=4*1024*1024);
 for(const def of definitions){
  assert.equal(def.purpose,'plush');assert.equal(def.slot,'toy');assert(!/fox|axolotl/.test(def.id),'The pack adds genuinely new toys rather than renaming existing plushes');
  assert(def.w>=60&&def.w<=76&&def.h>=66&&def.h<=88);assert(def.boxes[0].y+def.boxes[0].h<=def.h);
  const frames=manifest.frames.filter(f=>f.id===def.id);assert.deepEqual(frames.map(f=>f.direction),directions);assert.equal(new Set(frames.map(f=>f.pixelSHA256)).size,4,'Facing artwork must use four independent native crops');
  for(const f of frames){for(const key of ['rect','sourceRect'])assert([f[key].x,f[key].y,f[key].w,f[key].h].every(Number.isInteger));assert(f.rect.x+f.rect.w<=manifest.width&&f.rect.y+f.rect.h<=manifest.height);assert.equal(f.rect.w,f.sourceRect.w);assert.equal(f.rect.h,f.sourceRect.h,'Packing must not resize source artwork');}
 }
 assert.equal(sha(readFileSync(new URL(manifest.file,base))),manifest.sha256);
 for(const source of manifest.sources)assert.equal(sha(readFileSync(new URL(source.file,base))),source.sha256,'Keep the image_gen originals with their exact source bytes');
});

function fixture(){
 const loads=[],canvases=[],assets=[];
 const loadImage=async url=>{loads.push(url);return url.includes('thumb')?{width:manifest.thumbnailWidth,height:manifest.thumbnailHeight,kind:'preview'}:{width:manifest.width,height:manifest.height,kind:'native'};};
 const createCanvas=()=>{const calls=[],canvas={width:0,height:0,calls,getContext:()=>({drawImage(...args){calls.push(args);},set imageSmoothingEnabled(_value){}})};canvases.push(canvas);return canvas;};
 const add=(id,name,group,w,h,draw,boxes,layer)=>{const a={id,name,group,w,h,draw,boxes,layer};assets.push(a);return a;};
 return {loads,canvases,assets,options:{manifest,loadImage,createCanvas},add};
}

test('startup loads one small preview and metadata alone never fetches the native sheet',async()=>{
 const f=fixture(),assets=await registerWhimsicalPlush(f.add,f.options);assert.equal(assets.length,12);assert.equal(f.loads.length,1);assert(f.loads[0].includes('thumb'));assert.equal(f.canvases.length,0);
 for(const asset of assets)for(const direction of directions){const view=asset.getFacingView(direction,{image:false});assert.equal(view.ready,false);assert.deepEqual(view.footCenter,{x:asset.w/2,y:asset.h-10});assert.equal(view.w,asset.w);assert.equal(view.h,asset.h);}
 assert.equal(f.loads.length,1);assert.equal(f.canvases.length,0);
 await Promise.all(assets.flatMap(a=>directions.map(d=>a.ensureFull(d))));assert.equal(f.loads.length,2);assert.equal(getWhimsicalPlushCacheStats().nativeLoads,1);assert.equal(getWhimsicalPlushCacheStats().nativeReady,true);
});

test('every cardinal preview paints its own native crop with stable feet and reuses bounded view canvases',async()=>{
 const f=fixture(),assets=await registerWhimsicalPlush(f.add,f.options);await assets[0].ensureFull();
 for(const asset of assets){const crops=[];for(const direction of directions){const canvas=asset.getFacingImage(direction),view=asset.getFacingView(direction);assert.equal(view.canvas,canvas);assert.equal(asset.getFacingImage(direction),canvas);assert.equal(canvas.width,asset.w);assert.equal(canvas.height,asset.h);assert.equal(view.ready,true);const call=canvas.calls[0];assert.equal(call[0].kind,'native');crops.push(call.slice(1,5));assert(call.slice(1).every(Number.isFinite));}assert.equal(new Set(crops.map(c=>JSON.stringify(c))).size,4);}
 const stats=getWhimsicalPlushCacheStats();assert.equal(stats.canvasEntries,48);assert(stats.canvasEntries<=stats.maxCanvasEntries&&stats.canvasPixels<=stats.maxCanvasPixels&&stats.nativePixels<=stats.maxNativePixels);assert.equal(f.loads.length,2);
});

test('incomplete or repeated facing metadata fails before any artwork can be requested',async()=>{
 const f=fixture();await assert.rejects(registerWhimsicalPlush(f.add,{...f.options,manifest:{...manifest,frames:manifest.frames.slice(1)}}),/48native cardinal/);assert.equal(f.loads.length,0);
 const duplicate=structuredClone(manifest);duplicate.frames[1]=structuredClone(duplicate.frames[0]);await assert.rejects(registerWhimsicalPlush(f.add,{...f.options,manifest:duplicate}),/Invalid plush cardinal/);assert.equal(f.loads.length,0);
});
