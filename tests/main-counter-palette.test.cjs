'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {matches,recolorPixels,create}=require('../main-counter-palette.js');
const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../published-world-project.json'),'utf8'));

test('only the three known Notes-counter source icons receive the mint palette',()=>{
 for(const id of ['asset-40','asset-41','asset-42']){
  const asset=project.assets.find(asset=>asset.id===id),before=JSON.stringify(asset);assert.ok(matches(asset));
  assert.ok(matches({...asset,x:900,y:700,rotation:45,flipX:true,opacity:30,w:80,h:60}),'Moved, flipped or translucent copies keep their palette');
  assert.equal(matches({...asset,id:'asset-99'}),false,'Another alien sign elsewhere is independent');
  assert.equal(matches({...asset,data:asset.data.slice(0,-1)+'A'}),false,'Replacement artwork is not recolored');
  assert.equal(JSON.stringify(asset),before);
 }
});

test('cyan faces become mint-white, purple outlines emerald, and alpha/shape/gold stay intact',()=>{
 const original=new Uint8ClampedArray([0,230,255,255,255,0,240,180,38,5,64,255,255,160,0,255,245,245,245,255,255,0,220,0]);
 const copy=new Uint8ClampedArray(original),result=recolorPixels(original);
 assert.deepEqual(original,copy);
 assert.ok(result[0]>200&&result[1]===255&&result[2]>225,'Bright cyan icon faces become pale mint');
 assert.ok(result[5]>result[4]&&result[5]>result[6],'Magenta borders become emerald');
 assert.ok(result[9]>result[8]&&result[9]>result[10],'Dark purple frame retains a dark jade shade');
 for(let index=3;index<original.length;index+=4)assert.equal(result[index],original[index],'Every alpha byte must stay unchanged');
 assert.deepEqual(result.slice(12,16),original.slice(12,16),'Gold fasteners stay gold');
 assert.deepEqual(result.slice(16),original.slice(16),'Neutral highlights and invisible pixels stay byte-identical');
});

test('disabled, missing, and unfinished image sources pass through untouched',()=>{
 const asset=project.assets.find(asset=>asset.id==='asset-40'),source={complete:false,naturalWidth:0},canvas={width:330,height:294};
 assert.equal(create().image(asset,source),source);
 assert.equal(create({enabled:()=>false}).image(asset,canvas),canvas);
 assert.equal(create().image(asset,null),null);
 assert.equal(create().image({...asset,id:'unrelated'},canvas),canvas);
});
