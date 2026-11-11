import test from 'node:test';
import assert from 'node:assert/strict';
import {createFamilySourceCanvasCache,createFamilySourceView} from './family-furniture-source.mjs';
import {FAMILY_FURNITURE_ASSETS} from './family-furniture-definitions.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {furnitureFootCenter,furnitureFacingPlacement} from './furniture-facing.mjs';

const directions=['south','north','east','west'];
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9,`${actual} != ${expected}`);
function fixture({slot='rug',def,donorDef,views,canvasCache}={}){
 def??=FAMILY_FURNITURE_ASSETS.find(asset=>asset.slot===slot);
 donorDef??=APARTMENT_COLLECTION_ASSETS.find(asset=>asset.id===def.sourceAssetId);
 const counts={metadata:0,sources:[],ensures:[],canvases:[]},ready=new Set(),sources=new Map();
 const metadata=new Map(directions.map(facing=>{
  const side=facing==='east'||facing==='west',custom=views?.[facing],size=slot==='rug'&&side?{w:donorDef.h,h:donorDef.w}:{w:donorDef.w,h:donorDef.h};
  const view={...size,footCenter:slot==='rug'?{x:size.w/2,y:size.h}:furnitureFootCenter(donorDef),...custom};
  Object.defineProperty(view,'ready',{get:()=>ready.has(facing)});
  sources.set(facing,{image:{name:'corrected-'+facing},sx:13,sy:27,sw:view.w,sh:view.h,dx:0,dy:0,dw:view.w,dh:view.h,native:false,quality:'corrected-preview',revision:1});
  return [facing,view];
 }));
 const promise=Promise.resolve(),donor={...donorDef,
  getFacingView(facing,options){counts.metadata++;assert.deepEqual(options,{image:false});return metadata.get(facing)??null;},
  getFacingDrawSource(facing,options){counts.sources.push({facing,native:options.native});return sources.get(facing);},
  ensureFull(facing){counts.ensures.push(facing);return promise;},
  get canvas(){throw Error('Legacy donor canvas must never be read.');},
  getFacingImage(){throw Error('Legacy donor image must never be read.');}
 };
 const createCanvas=()=>{
  const canvas={width:0,height:0,draws:[],clears:0},ctx={drawImage(...args){canvas.draws.push(args);},clearRect(){canvas.draws.length=0;canvas.clears++;}};
  canvas.getContext=()=>ctx;counts.canvases.push(canvas);return canvas;
 };
 return {def,donor,counts,ready,sources,metadata,promise,createCanvas,helper:createFamilySourceView(def,donor,{createCanvas,canvasCache})};
}

test('all 62 source-derived products expose stable cardinal metadata without warming images or canvases',()=>{
 const definitions=FAMILY_FURNITURE_ASSETS.filter(def=>def.art==='collection-source');assert.equal(definitions.length,62);
 for(const def of definitions){
  const f=fixture({slot:def.slot,def});
  for(let pass=0;pass<4;pass++)for(const facing of directions){
   const view=f.helper.view(facing);assert.strictEqual(view,f.helper.view(facing));assert.equal(view.id,def.id+(facing==='south'?'':'|'+facing));assert.equal(view.ready,false);
   if(def.slot==='plant'){const original=f.metadata.get(facing);close(view.w,original.w*1.5);close(view.h,original.h*1.5);}
  }
  assert.deepEqual([f.helper.view().w,f.helper.view().h],[def.w,def.h]);assert.deepEqual(f.helper.view().footCenter,furnitureFootCenter(def));
  assert.equal(f.counts.metadata,4);assert.equal(f.counts.sources.length,0);assert.equal(f.counts.ensures.length,0);assert.equal(f.counts.canvases.length,0);
 }
});

test('the large South rug contains the approved overhead crop at the new bottom floor anchor without stretching',()=>{
 const f=fixture(),source=f.sources.get('south');Object.assign(source,{sw:160,sh:100,dx:10,dy:12,dw:160,dh:100});
 const preview=f.helper.drawSource(),same=f.helper.drawSource();assert.strictEqual(preview,same);assert.equal(preview.image.name,'corrected-south');
 const scale=420/180;close(preview.dx,10*scale);close(preview.dy,280-112*scale+12*scale);close(preview.dw,160*scale);close(preview.dh,100*scale);
 close(preview.dw/preview.dh,source.sw/source.sh);close(preview.dy+preview.dh,280);
 const canvas=f.helper.canvas();assert.deepEqual([canvas.width,canvas.height],[420,280]);assert.equal(canvas.draws[0][0].name,'corrected-south');
 assert.deepEqual(f.counts.ensures,[]);assert(f.counts.sources.every(call=>call.native===false));
 for(const facing of ['east','west']){const view=f.helper.view(facing);assert.deepEqual([view.w,view.h],[280,420]);assert.deepEqual(view.footCenter,{x:140,y:420});}
});

test('plants grow uniformly by 1.5 and every view stays on the new physical base',()=>{
 const f=fixture({slot:'plant',views:{east:{w:100,h:150,footCenter:{x:45,y:130}}}}),south=f.helper.view(),east=f.helper.view('east');
 assert.deepEqual([south.w,south.h],[138,216]);assert.deepEqual(south.footCenter,{x:69,y:187.5});
 assert.deepEqual([east.w,east.h],[150,225]);assert.deepEqual(east.footCenter,{x:67.5,y:195});
 for(const facing of directions){const old=f.sources.get(facing),next=f.helper.drawSource(facing);close(next.dw,old.dw*1.5);close(next.dh,old.dh*1.5);close(next.dw/next.dh,old.sw/old.sh);}
 const asset={...f.def,getFacingView:f.helper.view};
 for(const rotation of [0,90,180,270]){
  const pose=furnitureFacingPlacement(asset,{x:713,y:905,rotation,scale:.8},undefined,{includeImage:false});
  close(pose.x+pose.view.footCenter.x*pose.scaleX,pose.screenFootCenter.x);close(pose.y+pose.view.footCenter.y*pose.scaleY,pose.screenFootCenter.y);
 }
});

test('native loading delegates exactly and derived canvases update in place with no per-frame allocation',async()=>{
 const f=fixture({slot:'plant'}),south=f.helper.canvas(),preview=f.helper.drawSource();assert.strictEqual(f.helper.ensureFull('south'),f.promise);assert.deepEqual(f.counts.ensures,['south']);await f.promise;
 const source=f.sources.get('south');source.image={name:'native-corrected-south'};source.native=true;source.quality='native';source.revision++;f.ready.add('south');
 assert.strictEqual(f.helper.canvas(),south);assert.equal(south.draws[0][0].name,'native-corrected-south');assert.strictEqual(f.helper.drawSource(),preview);assert.equal(preview.native,true);assert.equal(south.clears,2);
 for(const facing of directions){const image=f.helper.image(facing);assert.strictEqual(image,f.helper.image(facing));assert.strictEqual(f.helper.view(facing).canvas,image);}
 const count=f.counts.canvases.length;assert.equal(count,4);
 for(let pass=0;pass<100;pass++){f.helper.draw({drawImage(){}});for(const facing of directions){f.helper.drawSource(facing,{native:true});f.helper.image(facing);}}
 assert.equal(f.counts.canvases.length,count);assert.deepEqual(f.counts.ensures,['south']);
});

test('source eviction clears the derived image and never falls back to old donor thumbnails',()=>{
 const f=fixture(),canvas=f.helper.canvas(),source=f.helper.drawSource();assert.equal(canvas.draws.length,1);
 f.sources.set('south',null);assert.strictEqual(f.helper.drawSource(),source);assert.equal(source.image,null);assert.strictEqual(f.helper.canvas(),canvas);assert.equal(canvas.draws.length,0);
 const revision=source.revision;f.helper.drawSource();assert.equal(source.revision,revision);
 f.sources.set('south',{image:{name:'restored-corrected-preview'},sx:0,sy:0,sw:180,sh:112,dx:0,dy:0,dw:180,dh:112,revision:2});
 assert.strictEqual(f.helper.canvas(),canvas);assert.equal(canvas.draws[0][0].name,'restored-corrected-preview');assert.equal(f.counts.canvases.length,1);
});

test('unsupported facings and unapproved source APIs do not substitute South art',async()=>{
 const f=fixture();assert.equal(f.helper.view('diagonal'),null);assert.equal(f.helper.image('diagonal'),null);assert.equal(f.helper.drawSource('diagonal'),null);await assert.rejects(f.helper.ensureFull('diagonal'),/Unknown family furniture facing/);
 assert.equal(f.counts.sources.length,0);assert.equal(f.counts.ensures.length,0);
 const wrong=Object.create(f.donor);wrong.id='wrong-source';assert.throws(()=>createFamilySourceView(f.def,wrong),/does not match/);
 const donor={id:f.donor.id,w:f.donor.w,h:f.donor.h};assert.throws(()=>createFamilySourceView(f.def,donor),/approved cardinal source/);
});

test('all 62 products share the global canvas count and pixel budget, then recover lazily after eviction and clear',()=>{
 const cache=createFamilySourceCanvasCache(),fixtures=FAMILY_FURNITURE_ASSETS.filter(def=>def.art==='collection-source').map(def=>fixture({slot:def.slot,def,canvasCache:cache}));
 const first=fixtures[0],view=first.helper.view(),source=first.helper.drawSource(),oldCanvas=first.helper.image();
 assert.equal(cache.stats.maxCanvases,48);assert.equal(cache.stats.maxPixels,4*1024*1024);
 for(const f of fixtures)for(const facing of directions){
  const canvas=f.helper.image(facing);assert.strictEqual(canvas,f.helper.image(facing));
  assert(cache.stats.canvasEntries<=48);assert(cache.stats.canvasPixels<=4*1024*1024);
 }
 assert.deepEqual([oldCanvas.width,oldCanvas.height],[1,1]);assert.strictEqual(first.helper.view(),view);assert.strictEqual(first.helper.drawSource(),source);
 const restored=first.helper.image();assert.notStrictEqual(restored,oldCanvas);assert.deepEqual([restored.width,restored.height],[420,280]);assert.equal(restored.draws[0][0].name,'corrected-south');
 const afterClear=cache.clear();assert.deepEqual(afterClear,{canvasEntries:0,canvasPixels:0,maxCanvases:48,maxPixels:4*1024*1024});
 for(const f of fixtures)for(const canvas of f.counts.canvases)assert.deepEqual([canvas.width,canvas.height],[1,1]);
 assert.strictEqual(first.helper.view(),view);assert.strictEqual(first.helper.drawSource(),source);assert.equal(cache.stats.canvasEntries,0);
 const reloaded=first.helper.canvas();assert.notStrictEqual(reloaded,restored);assert.equal(reloaded.draws[0][0].name,'corrected-south');assert.equal(cache.stats.canvasEntries,1);
});

test('shared canvases use LRU access order and reject an oversized view before allocating',()=>{
 const cache=createFamilySourceCanvasCache({maxCanvases:2,maxPixels:1024*1024}),f=fixture({canvasCache:cache});
 const south=f.helper.image('south'),east=f.helper.image('east');assert.strictEqual(f.helper.image('south'),south);
 f.helper.image('north');assert.deepEqual([east.width,east.height],[1,1]);assert.deepEqual([south.width,south.height],[420,280]);
 const restored=f.helper.image('east');assert.notStrictEqual(restored,east);assert.equal(cache.stats.canvasEntries,2);assert.equal(cache.stats.canvasPixels,2*420*280);
 const tiny=createFamilySourceCanvasCache({maxCanvases:1,maxPixels:100}),oversized=fixture({canvasCache:tiny});
 assert.throws(()=>oversized.helper.image(),/shared canvas budget/);assert.equal(oversized.counts.canvases.length,0);assert.equal(tiny.stats.canvasEntries,0);assert.equal(tiny.stats.canvasPixels,0);
});
