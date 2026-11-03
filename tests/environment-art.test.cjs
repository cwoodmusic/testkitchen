'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const art=require('../environment-art.js');
const root=path.resolve(__dirname,'..');
function legacyParts(){
 const html=fs.readFileSync(path.join(root,'world-preview.html'),'utf8'),parts=[];
 const first=html.match(/const foregroundParts=(\[.*?\]);/s);assert.ok(first,'Existing foreground identities stay discoverable');parts.push(...JSON.parse(first[1]));
 for(const match of html.matchAll(/foregroundParts\.push\(\.\.\.(\[.*?\])\);/gs))parts.push(...JSON.parse(match[1]));return parts;
}

test('replacement artwork retains all furniture, palm and bollard identities and source sizes',()=>{
 const parts=legacyParts(),expected=parts.filter(part=>['object','plant','obelisk'].includes(part.type));
 assert.equal(expected.length,36);assert.equal(Object.keys(art.OBJECTS).length,36);
 for(const part of expected){const mapped=art.OBJECTS[part.name];assert.ok(mapped,part.name);assert.deepEqual([mapped.width,mapped.height],part.bounds.slice(2),part.name+' must preserve editor texture dimensions');}
 assert.equal(expected.filter(part=>part.type==='plant').length,21);
});

test('existing published prop journals remain addressable and duplicate image files load only once',()=>{
 const project=JSON.parse(fs.readFileSync(path.join(root,'published-world-project.json'),'utf8'));
 for(const item of project.assets)if(item.origin&&art.OBJECTS[item.origin.name])assert.deepEqual([art.OBJECTS[item.origin.name].width,art.OBJECTS[item.origin.name].height],item.origin.bounds.slice(2));
 assert.equal(art.FILES[0],'empty-walls.png');assert.equal(art.FILES.length,new Set(art.FILES).size);
 assert.ok(art.FILES.includes('lounge-couch-south.png'));assert.ok(art.FILES.includes('dance-couch-left-south.png'));assert.ok(art.FILES.includes('dance-couch-right-south.png'));
 assert.equal(Object.values(art.OBJECTS).filter(item=>item.file==='table.png').length,3);
 assert.equal(Object.values(art.OBJECTS).filter(item=>item.file==='palm.png').length,21);
 for(const name of ['cabinet_pitch_race','cabinet_music_triad','disco_ball_arcade','rhythm_fishing_trapdoor','dance_passage_plant_leaves'])assert.equal(art.OBJECTS[name],undefined,'Legacy/procedural sources must remain available through fallback');
});

test('south-facing sofas retain legacy texture dimensions and the accepted counter, table and DJ designs',()=>{
 for(const [name,file,width,height]of [
  ['lounge_sofa','lounge-couch-south.png',288,105],['dance_left_couch','dance-couch-left-south.png',164,131],['dance_right_couch','dance-couch-right-south.png',162,109]
 ])assert.deepEqual(art.OBJECTS[name],{file,width,height,mirror:false});
 for(const file of ['lounge-couch.png','dance-couch-left.png','dance-couch-right.png'])assert.ok(fs.existsSync(path.join(root,'assets/environment/v1',file)),'Keep the earlier source '+file);
 for(const [name,file]of [['main_counter','main-counter.png'],['boutique_counter','boutique-counter.png'],['dance_dj_console','dj-console.png'],['lounge_center_candle_table','table.png']])assert.equal(art.OBJECTS[name].file,file);
});

test('contain fitting preserves proportions without cropping or leaking outside legacy source bounds',()=>{
 assert.deepEqual(art.fitRect(100,50,80,80),{x:0,y:20,width:80,height:40});
 assert.deepEqual(art.fitRect(50,100,80,80),{x:20,y:0,width:40,height:80});
 for(const spec of Object.values(art.OBJECTS))for(const [sw,sh]of [[768,1024],[1024,768],[512,512],[2048,64]]){
  const rect=art.fitRect(sw,sh,spec.width,spec.height);assert.ok(rect.width>0&&rect.height>0);assert.ok(rect.x>=0&&rect.y>=0);assert.ok(rect.x+rect.width<=spec.width&&rect.y+rect.height<=spec.height);
  assert.ok(Math.abs(rect.width/sw-rect.height/sh)<=Math.max(1/sw,1/sh),'Only final pixel rounding may change aspect ratio');
 }
});

test('only correctly sized background and bounded raster sources are accepted',()=>{
 assert.deepEqual(art.WORLD,{width:1672,height:941});assert.equal(art.validSourceSize(1672,941,true),true);
 for(const size of [[1672,940],[941,1672],[0,941],[-1,941],[8193,1],[8192,8192],[NaN,941],[1.5,1]])assert.equal(art.validSourceSize(...size,true),false);
 assert.equal(art.validSourceSize(2048,2048),true);assert.equal(art.validSourceSize(8192,2048),true);assert.equal(art.validSourceSize(8192,2049),false);
 for(const args of [[0,10,20,30],[10,10,-1,20],[Infinity,10,20,30]])assert.equal(art.fitRect(...args),null);
});

test('structural background crops cannot capture movable or unknown props',()=>{
 for(const part of legacyParts()){
  const crop=art.structuralBounds(part);
  if(['wall','wall-mask'].includes(part.type))assert.deepEqual(crop,{x:part.bounds[0],y:part.bounds[1],width:part.bounds[2],height:part.bounds[3]});else assert.equal(crop,null,part.name);
 }
 for(const part of [null,{name:'cabinet_pitch_race',bounds:[0,0,10,10]},{type:'wall',bounds:[-1,0,10,10]},{type:'wall',bounds:[1670,0,10,10]},{type:'wall',bounds:[0,0,10,10],poly:[[0,0],[1,1]]},{type:'wall',bounds:[0,0,10,10],poly:[[0,0],[Infinity,1],[2,2]]}])assert.equal(art.structuralBounds(part),null);
});

test('environment metadata is immutable and a missing browser document fails clearly',()=>{
 assert.ok(Object.isFrozen(art.OBJECTS));assert.ok(Object.values(art.OBJECTS).every(Object.isFrozen));assert.ok(Object.isFrozen(art.FILES));
 assert.throws(()=>art.create(),/requires a document/);
});
