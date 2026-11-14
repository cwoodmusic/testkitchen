import test from 'node:test';
import assert from 'node:assert/strict';
import {availableFacings,prepareAssetPreview,assetPreviewSample} from './preview.mjs';

function context(){
 const stack=[],draws=[];
 return {filter:'brightness(.5)',imageSmoothingEnabled:true,draws,get stackDepth(){return stack.length;},
  save(){stack.push({filter:this.filter,imageSmoothingEnabled:this.imageSmoothingEnabled});},
  restore(){Object.assign(this,stack.pop());},
  drawImage(...args){draws.push({args,filter:this.filter,smoothing:this.imageSmoothingEnabled});},
  translate(x,y){draws.push({translate:[x,y]});}
 };
}
function directional(extra={}){
 const view={w:90,h:180,facing:'west'};
 return {id:'fixture',group:'furniture',w:180,h:120,layer:'objects',getFacingView:direction=>direction==='west'?view:direction==='south'?{w:180,h:120}:null,...extra};
}

test('facing discovery reads only metadata and retains every supported direction in stable order',()=>{
 const calls=[],asset=directional({getFacingView(direction,options){calls.push([direction,options]);return Object.defineProperty({w:30,h:80},'canvas',{get(){throw Error('Discovery must not warm artwork');}});},ensureFull(){throw Error('Discovery must not fetch images');},getFacingImage(){throw Error('Discovery must not read images');}});
 assert.deepEqual(availableFacings(asset),['south','west','north','east']);
 assert.equal(calls.length,4);assert(calls.every(([,options])=>options.image===false));
 assert.deepEqual(availableFacings(directional()),['south','west']);assert.deepEqual(availableFacings(null),[]);
});

test('ground, wall-mounted and scene assets expose their original drawing without invented rotations',()=>{
 for(const extra of [{layer:'ground'},{wallMounted:true},{scene:true},{urban:'tower'},{group:'trees'}]){
  const asset=directional({...extra,getFacingView(){throw Error('A flat or scene asset has only its original view');}});
  assert.deepEqual(availableFacings(asset),['south']);
 }
});

test('a single huge procedural asset draws directly without creating or accessing its cached canvas',async()=>{
 let ensured=false,painted=false;
 const asset={id:'building',group:'landmarks',w:3014,h:4521,ensureFull:async()=>{ensured=true;},draw(c){assert(ensured);painted=true;c.drawImage('native-building',0,0,3014,4521);},get canvas(){throw Error('Do not allocate a full building canvas');}};
 const preview=await prepareAssetPreview(asset),c=context();assert.deepEqual([preview.width,preview.height],[3014,4521]);preview.draw(c,20);
 assert.equal(preview.animated,false);
 assert(painted);assert.equal(c.draws[0].args[0],'native-building');assert.equal(c.stackDepth,0);
});

test('fountain previews reuse one selected native water source and restore the caller canvas state',async()=>{
 const previousDocument=globalThis.document,width=10,height=10,data=new Uint8ClampedArray(width*height*4),source={width,height};let canvases=0;
 for(let y=2;y<8;y++)for(let x=2;x<8;x++)data.set([30+x*2,150+y*3,200,255],(y*width+x)*4);
 globalThis.document={createElement(){canvases++;const canvas={width:0,height:0},g={filter:'none',drawImage(){},getImageData(){return {width,height,data};},createImageData(w,h){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(){}};canvas.getContext=()=>g;return canvas;}};
 try{
  const asset={id:'review-fountain',name:'Test fountain',group:'props',w:width,h:height,draw:c=>c.drawImage(source,0,0)},preview=await prepareAssetPreview(asset),c=context();
  assert.equal(preview.animated,true);preview.draw(c,0);assert.equal(canvases,0,'A still first frame needs no animation canvas');
  preview.draw(c,.75);assert.equal(canvases,3,'Prepare only a selected source, water-mask sample and small overlay');
  const allocated=canvases;for(let frame=10;frame<25;frame++)preview.draw(c,frame/12);assert.equal(canvases,allocated);
  assert(c.draws.some(draw=>draw.filter==='none'&&draw.args.length===3),'Graded water is overlaid without a second color filter');
  assert.equal(c.filter,'brightness(.5)');assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.stackDepth,0);
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('reviewer animates only the selected authored glass and keeps native still exports allocation-free',async()=>{
 const previousDocument=globalThis.document;let canvases=0;
 globalThis.document={createElement(){canvases++;const canvas={width:0,height:0};canvas.getContext=()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}});return canvas;}};
 try{
  const southMotion={kind:'arcade',seed:9,game:'original-owner-game',palette:['#142739','#73c8b0','#ffdc98','#9183c7'],mask:[[.2,.2],[.7,.2],[.7,.5],[.2,.5]],bounds:[.2,.2,.5,.3]},lampMotion={kind:'lava',seed:9,mask:[[.4,.2],[.6,.2],[.7,.6],[.3,.6]],bounds:[.3,.2,.4,.4]};
  const south={w:180,h:120,motion:southMotion},west={w:90,h:180},east={w:90,h:180,motion:lampMotion},image={width:400,height:400};
  const asset=directional({id:'motion-review-fixture',motion:southMotion,getFacingView:f=>({south,west,east}[f]),getFacingImage:()=>image}),before=JSON.stringify(southMotion);
  const front=await prepareAssetPreview(asset,'south'),back=await prepareAssetPreview(asset,'west'),lamp=await prepareAssetPreview(asset,'east'),c=context();
  assert.equal(front.animated,true);assert.equal(back.animated,false);assert.equal(lamp.animated,true);
  for(const preview of [front,back,lamp])preview.draw(c,0);assert.equal(canvases,0,'Still exports need no animation buffer');
  front.draw(c,1);assert.equal(canvases,1,'Only a small procedural screen is allocated; no native view is repainted');
  const screen=c.draws.at(-1);assert.equal(screen.filter,'none');assert(screen.args[0].width<=128&&screen.args[0].height<=128);
  for(let frame=8;frame<60;frame++)front.draw(c,frame/8);assert.equal(canvases,1,'Warm preview frames reuse their stable selected-view proxy');
  back.draw(c,4);assert.equal(canvases,1,'South animation must not bleed onto back/profile views');
  lamp.draw(c,1);assert.equal(canvases,2);assert.equal(JSON.stringify(southMotion),before);assert.equal(c.filter,'brightness(.5)');assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.stackDepth,0);
 }finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('preparing a cardinal view waits for native artwork and preserves its authored crop and contain padding',async()=>{
 let finish,ready=false,loadDirection;
 const pending=new Promise(resolve=>{finish=()=>{ready=true;resolve();};}),image={width:500,height:700};
 const asset=directional({ensureFull(direction){loadDirection=direction;return pending;},getFacingDrawSource(direction,options){assert(ready);assert.equal(direction,'west');assert.equal(options.native,true);return {image,sx:10,sy:20,sw:150,sh:300,dx:4,dy:7,dw:75,dh:150,native:true};},getFacingImage(){throw Error('Native atlas descriptors need no extra canvas');}});
 const preparing=prepareAssetPreview(asset,'west');assert.equal(loadDirection,'west');finish();
 const preview=await preparing,c=context();assert.deepEqual([preview.width,preview.height,preview.facing,preview.actualFacing],[90,180,'west','west']);preview.draw(c);
 assert.deepEqual(c.draws[0].args,[image,10,20,150,300,4,7,75,150]);assert.equal(c.draws[0].filter,'saturate(.88) brightness(.97)');assert.equal(c.draws[0].smoothing,false);
 assert.equal(c.filter,'brightness(.5)');assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.stackDepth,0);
});

test('cardinal image APIs use the selected real drawing rather than rotating the original',async()=>{
 const images={south:{id:'south'},west:{id:'west'}};let wanted;
 const asset=directional({getFacingImage(direction){wanted=direction;return images[direction];},draw(){throw Error('The original drawing cannot substitute for a cardinal view');}});
 const preview=await prepareAssetPreview(asset,'west'),c=context();preview.draw(c);
 assert.equal(wanted,'west');assert.deepEqual(c.draws[0].args,[images.west,0,0,90,180]);
});

test('an authored original orientation stays identifiable independently of relative controls',async()=>{
 const asset=directional({facing:'north',getFacingView:direction=>direction==='south'?{w:180,h:120,facing:'north'}:null,getFacingImage:()=>({id:'native-north'})});
 const preview=await prepareAssetPreview(asset);assert.equal(preview.facing,'south');assert.equal(preview.actualFacing,'north');
});

test('failed, missing and low-resolution native loads remain explicit preview errors',async()=>{
 const broken=directional({ensureFull:async()=>{throw Error('Artwork download failed');}});
 await assert.rejects(prepareAssetPreview(broken,'west'),/Artwork download failed/);
 await assert.rejects(prepareAssetPreview(directional(),'north'),RangeError);
 await assert.rejects(prepareAssetPreview(directional(),'west'),/unavailable/);
 for(const source of [null,{image:{},sw:10,sh:10,native:false},{image:{},sw:0,sh:20,native:true}]){
  await assert.rejects(prepareAssetPreview(directional({getFacingDrawSource:()=>source}),'west'),/not ready|Invalid artwork crop/);
 }
 for(const asset of [null,{w:0,h:20},{w:Infinity,h:20}])await assert.rejects(prepareAssetPreview(asset),TypeError);
});

test('a thrown drawing restores the caller canvas state and leaves the asset unchanged',async()=>{
 const asset={id:'broken-draw',group:'trees',w:80,h:120,draw(c){assert.equal(c.filter,'saturate(.8) brightness(.94)');throw Error('Cannot draw');}},before={...asset};
 const preview=await prepareAssetPreview(asset),c=context();assert.throws(()=>preview.draw(c),/Cannot draw/);
 assert.equal(c.filter,'brightness(.5)');assert.equal(c.imageSmoothingEnabled,true);assert.equal(c.stackDepth,0);assert.deepEqual(asset,before);
});

test('floor previews repeat the existing native tile3×3 without changing the catalog size or review identity',async()=>{
 const tile={width:512,height:512},asset={id:'surface:wood',w:512,h:512,layer:'ground',reviewSample:{kind:'floor',columns:3,rows:3,label:'3×3 tiled sample'},draw:c=>c.drawImage(tile,0,0,512,512)},before={...asset};
 const preview=await prepareAssetPreview(asset),c=context();preview.draw(c);
 assert.deepEqual([preview.width,preview.height],[1536,1536]);assert.equal(preview.sample.label,'3×3 tiled sample');
 assert.equal(c.draws.filter(d=>d.args).length,9);
 assert.deepEqual(c.draws.filter(d=>d.translate).map(d=>d.translate),[[0,0],[512,0],[1024,0],[0,512],[512,512],[1024,512],[0,1024],[512,1024],[1024,1024]]);
 assert.deepEqual(asset,before);assert.deepEqual([asset.w,asset.h,asset.id],[512,512,'surface:wood']);assert.equal(c.stackDepth,0);
});

test('connected finish samples paint one field so wall caps and floor-room frames cannot repeat at each join',async()=>{
 for(const [kind,rows,h]of [['floor',3,128],['wall',1,106]]){
  let calls=0,args;
  const asset={id:'finish:'+kind+':fixture',w:128,h,layer:'ground',reviewSample:{kind,columns:3,rows,label:kind==='floor'?'3×3 tiled sample':'connected wall sample'},draw(){throw Error('Do not repeat independently framed areas');},drawReviewSample(c,w,height){calls++;args=[w,height];c.drawImage('one-connected-material-field',0,0,w,height);}};
  const preview=await prepareAssetPreview(asset),c=context();preview.draw(c);assert.equal(calls,1);assert.deepEqual(args,[384,h*rows]);assert.equal(c.draws.length,1);assert.equal(c.stackDepth,0);
 }
 assert.deepEqual(assetPreviewSample({w:512,h:160,reviewSample:{kind:'wall',columns:3,rows:1,stepX:424}}),{kind:'wall',columns:3,rows:1,stepX:424,width:1360,height:160,tileWidth:512,tileHeight:160});
});
