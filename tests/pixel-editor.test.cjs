const test=require('node:test'),assert=require('node:assert/strict'),pixel=require('../pixel-editor.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');

test('pixel projects accept bounded explicit colours and transparent edits only',()=>{
 assert.equal(pixel.validate({player:{down:[[40,45,'#ff6699'],[41,45,null]]}}),true);
 for(const value of [null,[],{stranger:{down:[]}},{player:{north:[]}},{player:{down:[[80,45,'#ffffff']]}},{player:{down:[[0,96,null]]}},{player:{down:[[0,0,'red']]}},{player:{down:[[0,0,'#123456'],[0,0,null]]}},{player:{down:[[0,0,'url(javascript:bad)']]}}])assert.equal(pixel.validate(value),false,JSON.stringify(value));
});
test('editing, erasing and restoring are immutable and independent for each actor and facing',()=>{
 const original={bach:{down:[[40,45,'#ff0000']]}};
 const painted=pixel.changePixels(original,'player','left',[[40,45],[41,45]],'#ABCDEF');assert.deepEqual(original,{bach:{down:[[40,45,'#ff0000']]}});assert.deepEqual(painted.player.left,[[40,45,'#abcdef'],[41,45,'#abcdef']]);
 const erased=pixel.changePixels(painted,'player','left',[[40,45]],null);assert.equal(erased.player.left[0][2],null);
 const restored=pixel.changePixels(erased,'player','left',[[40,45],[41,45]],undefined);assert.deepEqual(restored,original);
});
test('normalization removes empty views and keeps a deterministic pixel order',()=>{
 assert.deepEqual(pixel.normalize({player:{down:[],left:[[2,3,'#FFAACC'],[1,2,null]]},dj:{}}),{player:{left:[[1,2,null],[2,3,'#ffaacc']]}});
});
test('drag interpolation paints continuous diagonals and flood fill respects colour boundaries',()=>{
 assert.deepEqual(pixel.linePoints([0,0],[3,3]),[[0,0],[1,1],[2,2],[3,3]]);
 const data=new Uint8ClampedArray(80*96*4);for(let y=0;y<96;y++)for(let x=0;x<80;x++){const at=(y*80+x)*4;data[at]=x<40?100:200;data[at+3]=255;}
 const points=pixel.floodPixels(data,1,1);assert.equal(points.length,40*96);assert.ok(points.every(([x])=>x<40));assert.deepEqual(pixel.floodPixels([],0,0),[]);
});
test('the character renderer validates pixel data and clones its edit journal',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);const r=sandbox.window.createCodaCharacterRenderer();
 const data={player:{right:[[40,45,'#ff0000']]}};assert.equal(r.setPixelEdits(data),true);data.player.right[0][2]='#000000';assert.equal(r.getPixelEdits().player.right[0][2],'#ff0000');
 const copy=r.getPixelEdits();copy.player.right=[];assert.equal(r.getPixelEdits().player.right.length,1);assert.equal(r.setPixelEdits({player:{down:[[90,0,null]]}}),false);assert.equal(r.getPixelEdits().player.right.length,1);
});

test('room musician pixel details use the same validated journal and renderer as arcade characters',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);const renderer=sandbox.window.createCodaCharacterRenderer();
 let data={};for(const id of ['chopin','captain-cadence'])data=pixel.changePixels(data,id,'down',[[40,45]],'#42cafe');
 assert.equal(pixel.validate(data),true);assert.equal(renderer.setPixelEdits(data),true);
 assert.deepEqual(JSON.parse(JSON.stringify(renderer.getPixelEdits())),data);
 assert.equal(pixel.changePixels(data,'unknown-room-character','down',[[40,45]],'#42cafe'),null);
 assert.equal(renderer.setPixelEdits({'unknown-room-character':{down:[[40,45,'#42cafe']]}}),false);
 assert.deepEqual(JSON.parse(JSON.stringify(renderer.getPixelEdits())),data,'Invalid targets cannot replace working room sprite details');
});

test('name labels clear added tall pixels in every facing and ignore erased pixels',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../character-renderer.js'),'utf8'),sandbox);const r=sandbox.window.createCodaCharacterRenderer();
 const original=r.labelOffset({}),bach=r.labelOffset({},'bach');r.setPixelEdits({player:{up:[[40,0,'#ff0000']],down:[[40,10,null]]},bach:{left:[[40,2,'#00ff00']]}});
 assert.equal(r.labelOffset({}),89);assert.equal(r.labelOffset({},'bach'),87);assert.equal(r.labelOffset({characterId:'bach'}),87);
 r.setPixelEdits({player:{up:[[40,0,null]]}});assert.equal(r.labelOffset({}),original);assert.equal(r.labelOffset({},'bach'),bach);
});
