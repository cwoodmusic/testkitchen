import test from 'node:test';
import assert from 'node:assert/strict';
import {leisureDefinitions,leisureSheetCounts} from './leisure-definitions.mjs';

const assets=new Map(leisureDefinitions.map(a=>[a.id,a]));
test('picnic and beach collections expose 38 unique independent decorations',()=>{
 assert.equal(leisureDefinitions.length,38);
 assert.equal(assets.size,38);
 assert.equal(leisureDefinitions.filter(a=>a.group==='picnic').length,16);
 assert.equal(leisureDefinitions.filter(a=>a.group==='beach').length,22);
 for(const a of leisureDefinitions){
  assert.ok(a.index>=0&&a.index<leisureSheetCounts[a.family],a.id);
  assert.ok(a.maxW>0&&a.maxH>0,a.id);
  for(const b of a.feet){
   assert.ok(b.x>=0&&b.y>=0&&b.w>0&&b.h>0,a.id);
   assert.ok(b.x+b.w<=1&&b.y+b.h<=1,a.id);
  }
  assert.equal(a.feet.length>0,a.solid,a.id);
 }
});

test('flat blankets, beach towel and paddleboard are walkable ground objects',()=>{
 for(const id of ['picnic-blanket-gingham','picnic-blanket-striped','picnic-quilt-patchwork','beach-towel-striped','beach-paddleboard']){
  const a=assets.get(id);
  assert.equal(a.layer,'ground',id);
  assert.equal(a.solid,false,id);
  assert.deepEqual(a.feet,[],id);
 }
 for(const id of ['picnic-cheese-board','picnic-lemonade','picnic-thermos'])assert.equal(assets.get(id).solid,false,id);
});

test('both beach seating styles have four distinct authored directional cells',()=>{
 for(const style of ['beach-deck-chair','beach-lounger']){
  const views=['north','east','south','west'].map(facing=>{
   const a=assets.get(`${style}-${facing}`);
   assert.equal(a.facing,facing);
   assert.equal(a.family,'seating');
   assert.equal(a.group,'beach');
   assert.equal(a.solid,true);
   assert.equal(a.worldCellSize,160);
   assert.equal(a.authoredFacing,true);
   return a.index;
  });
  assert.equal(new Set(views).size,4);
 }
 assert.equal(leisureDefinitions.filter(a=>a.family==='seating').length,8);
 assert.ok(!leisureDefinitions.some(a=>a.family==='beach'&&[3,4].includes(a.index)));
});

test('cabana posts leave its central approach open',()=>{
 const a=assets.get('beach-cabana');
 assert.equal(a.feet.length,4);
 for(let y=0;y<=1;y+=.05)assert.ok(!a.feet.some(b=>.5>=b.x&&.5<=b.x+b.w&&y>=b.y&&y<=b.y+b.h));
});

test('camping lantern has a modest warm native light emitter',()=>{
 const a=assets.get('picnic-lantern'),[light]=a.lightEmitters;
 assert.equal(light.kind,'lamp');
 assert.ok(light.u>0&&light.u<1&&light.v>0&&light.v<1);
 assert.ok(light.radius>0&&light.radius<200);
 assert.ok(light.power>0&&light.power<1);
 assert.ok(light.color[0]>light.color[1]&&light.color[1]>light.color[2]);
});
