import test from 'node:test';
import assert from 'node:assert/strict';
import {availableFacings,prepareAssetPreview} from './preview.mjs';

function context(){
 const stack=[],draws=[];
 return {filter:'brightness(.5)',imageSmoothingEnabled:true,draws,get stackDepth(){return stack.length;},
  save(){stack.push({filter:this.filter,imageSmoothingEnabled:this.imageSmoothingEnabled});},
  restore(){Object.assign(this,stack.pop());},
  drawImage(...args){draws.push({args,filter:this.filter,smoothing:this.imageSmoothingEnabled});}
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
 const preview=await prepareAssetPreview(asset),c=context();assert.deepEqual([preview.width,preview.height],[3014,4521]);preview.draw(c);
 assert(painted);assert.equal(c.draws[0].args[0],'native-building');assert.equal(c.stackDepth,0);
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
