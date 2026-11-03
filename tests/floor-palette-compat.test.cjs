'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../floor-palette-compat.js'),art=require('../artwork-editor.js');
const OLD='#3601f1ff',GLASS='#00153aff';
function manifest(tiles={'0,0':[[0,2,OLD,GLASS],[2,1,OLD,null],[3,1,OLD,'#000c47ff'],[3,1,'#000c47ff','#ffffffff'],[4,1,OLD,GLASS]]}){return {version:1,width:70,height:2,tiles};}
function patch(){return {width:70,height:2,tiles:{'0,0':[[0,4,OLD],[4,1,'#3601f180'],[5,1,'#00000000'],[6,1,'#17c379ff']],'1,0':[[0,2,'#abcdef88']]}};}

test('known pigments change only at matching positions, with null revealing current material',()=>{
 const input=patch(),before=JSON.stringify(input),resolver=create({manifest:manifest()}),result=resolver.resolveTexture('background.world',input);
 assert.equal(resolver.getState().error,null);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(result.tiles['0,0'],[[0,2,GLASS],[3,1,'#000c47ff'],[4,1,'#3601f180'],[5,1,'#00000000'],[6,1,'#17c379ff']]);
 assert.deepEqual(result.tiles['1,0'],input.tiles['1,0']);assert.equal(art.validateTexture(result),true);
 assert.equal(resolver.resolveTexture('object.dance_north_wall_west',input),input,'Object erasures and their pigments stay raw');
 assert.equal(resolver.resolveTexture('background.world',{...input,width:71}).width,71);
});

test('resolved textures are cached and idempotent, with no cascading old-color rules',()=>{
 const input=patch(),resolver=create({manifest:manifest()}),first=resolver.resolveTexture('background.world',input);
 assert.equal(resolver.resolveTexture('background.world',input),first);
 assert.equal(resolver.resolveTexture('background.world',first),first);
 assert.equal(first.tiles['0,0'][1][2],'#000c47ff','A new color must not enter another rule in the same pass');
 const unrelated={width:70,height:2,tiles:{'0,0':[[0,1,'#ff8044ff']]}};
 assert.equal(resolver.resolveTexture('background.world',unrelated),unrelated,'Custom paint is not recolored');
 const empty=create({manifest:manifest({'0,0':[[0,4,OLD,null]]})}).resolveTexture('background.world',{width:70,height:2,tiles:{'0,0':[[0,4,OLD]]}});
 assert.deepEqual(empty.tiles,{});assert.equal(art.validateTexture(empty),true);
});

test('overlapping historical colors match the raw pigment once and later duplicate targets win',()=>{
 const resolver=create({manifest:manifest({'0,0':[[0,1,OLD,'#000000ff'],[0,1,'#001122ff','#334455ff'],[0,1,OLD,GLASS]]})});
 const input={width:70,height:2,tiles:{'0,0':[[0,1,OLD],[1,1,'#001122ff']]}};
 assert.deepEqual(resolver.resolveTexture('background.world',input).tiles['0,0'],[[0,1,GLASS],[1,1,'#001122ff']]);
});

test('one manifest fetch finishes before resolution and failure safely preserves local paint',async()=>{
 let finish,calls=0;
 const resolver=create({url:'/palette.json?v=test',fetch:(url,options)=>{calls++;assert.equal(url,'/palette.json?v=test');assert.equal(options.cache,'no-cache');return new Promise(resolve=>finish=resolve);}}),input=patch();
 assert.equal(resolver.getState().ready,false);assert.equal(resolver.resolveTexture('background.world',input),input);
 finish({ok:true,json:async()=>manifest()});await resolver.ready;
 assert.equal(calls,1);assert.equal(resolver.getState().ready,true);assert.notEqual(resolver.resolveTexture('background.world',input),input);
 const failed=create({fetch:async()=>({ok:false,status:404})});await failed.ready;
 assert.match(failed.getState().error,/HTTP 404/);assert.equal(failed.resolveTexture('background.world',input),input);
});

test('malformed manifests cannot recolor or discard saved data',async()=>{
 for(const value of [{...manifest(),version:2},{...manifest(),width:0},manifest({'2,0':[[0,1,OLD,null]]}),manifest({'1,0':[[5,2,OLD,null]]}),manifest({'0,0':[[0,0,OLD,null]]}),manifest({'0,0':[[0,1,'purple',GLASS]]}),manifest({'0,0':[[0,1,OLD,'script']]})]){
  const resolver=create({manifest:value});await resolver.ready;assert.ok(resolver.getState().error);const input=patch();assert.equal(resolver.resolveTexture('background.world',input),input);
 }
});
