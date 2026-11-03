'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixtures=require('../wall-fixtures.js'),art=require('../environment-art.js');
const definition=fixtures.CATALOG.find(part=>part.name==='wall_lantern_arcade-west');
const retired=fixtures.CATALOG.find(part=>part.name==='wall_lantern_dance-upper-passage');
function asset(overrides={},part=definition){const[x,y,w,h]=part.bounds;return {id:'lamp-edit',origin:{name:part.name,bounds:part.bounds},wallFixture:part.name,x:x+w/2,y:y+h/2,w,h,rotation:0,opacity:100,visible:true,...overrides};}
function state(assets=[],animate){return fixtures.states(assets,animate).find(item=>item.name===definition.name);}
test('every sign, lantern and wall artwork has an isolated transparent source and a stable editor identity',()=>{
 assert.equal(fixtures.CATALOG.length,25);assert.equal(fixtures.CATALOG.filter(p=>p.kind==='lantern').length,11);
 assert.equal(new Set(fixtures.CATALOG.map(p=>p.name)).size,25);
 for(const part of fixtures.CATALOG){
  const source=art.FIXTURES[part.name];assert.ok(source);assert.deepEqual([source.width,source.height],part.bounds.slice(2));
  const bytes=fs.readFileSync(path.join(__dirname,'../assets/environment/v1',source.file));assert.equal(bytes[25],6,'PNG must retain RGBA transparency');
 }
 assert.ok(fs.existsSync(path.join(__dirname,'../assets/environment/v1/empty-arcade.png')),'Retain the previous scenery');
});
test('lifting and translating a lantern moves its actual light with its sprite',()=>{
 const before=state(),lifted=state([asset()]);assert.deepEqual(lifted.matrix,before.matrix);assert.equal(lifted.x,605);assert.equal(lifted.y,57);
 const moved=state([asset({x:800,y:300})]);assert.equal(moved.x,801);assert.equal(moved.y,299);assert.equal(moved.sourceX,605);assert.equal(moved.sourceY,57);
 assert.equal(state([asset({visible:false})]).visible,false);assert.equal(state([asset({opacity:25})]).opacity,.25);
});
test('rotation, nonuniform size, mirroring and animation use one shared sprite/light transform',()=>{
 const a=asset({w:128,h:35,rotation:90,flipX:true}),s=state([a],()=>({dx:12,dy:-7,scale:1.5,rot:0,alpha:.4}));
 const[x,y]=definition.light;assert.ok(s.matrix.every(Number.isFinite));assert.equal(s.opacity,.4);
 assert.ok(Math.abs(s.x-(s.matrix[0]*s.sourceX+s.matrix[2]*s.sourceY+s.matrix[4]))<1e-8);
 assert.ok(Math.abs(s.y-(s.matrix[1]*s.sourceX+s.matrix[3]*s.sourceY+s.matrix[5]))<1e-8);
 assert.notEqual(s.x,x);assert.notEqual(s.y,y);
});
test('duplicated lanterns keep an independent light without suppressing the original',()=>{
 const copy=asset({id:'copy',x:900,y:400});delete copy.origin;
 const lamps=fixtures.states([copy]).filter(item=>item.name===definition.name);assert.equal(lamps.length,2);assert.equal(lamps[0].x,605);assert.equal(lamps[1].x,901);
 assert.equal(fixtures.states([{...copy,wallFixture:'unknown'}]).length,24);
});
test('the retired passage lantern does not emit in an empty scene or the published world',()=>{
 const published=JSON.parse(fs.readFileSync(path.join(__dirname,'../published-world-project.json'),'utf8'));
 for(const assets of [[],published.assets]){
  assert.equal(fixtures.states(assets).some(item=>item.name===retired.name),false);
 }
 assert.equal(fixtures.states().length,24,'Keep the other default wall fixtures');
 assert.equal(state().visible,true,'Keep the current arcade lantern available');
});
test('explicitly placed passage lanterns and independent copies retain their own light',()=>{
 const original=asset({id:'passage-restored',x:900,y:400,opacity:60},retired);
 const copy=asset({id:'passage-copy',x:1050,y:650,opacity:40},retired);delete copy.origin;
 const lamps=fixtures.states([original,copy]).filter(item=>item.name===retired.name);
 assert.deepEqual(lamps.map(item=>({id:item.id,x:item.x,y:item.y,visible:item.visible,opacity:item.opacity})),[
  {id:'passage-restored',x:901,y:399,visible:true,opacity:.6},
  {id:'passage-copy',x:1051,y:649,visible:true,opacity:.4}
 ]);
 const copyOnly=fixtures.states([copy]).filter(item=>item.name===retired.name);
 assert.equal(copyOnly.length,1,'Placing a copy must not restore the retired default');
 assert.equal(copyOnly[0].id,'passage-copy');
});
