'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const fishing=require('../rhythm-fishing-engine.js'),world=require('../fishing-biomes.js'),progress=require('../fishing-progress.js');
const shared=['silver-minnow','cave-guppy','bluegill'];

function catchPerfect(options){
 const game=fishing.createSession({id:'biome-test-catch',startTime:0,...options});
 for(let turn=0;turn<400&&!game.getState().result;turn++){
  const state=game.getState(),note=state.notes.find(value=>value.judgement==='pending'&&value.time>=state.now);
  assert.ok(note,'Every live challenge has a future playable note');
  const boundary=game.timeAtBeat((Math.max(0,Math.floor((state.beat+1e-9)/state.barBeats))+1)*state.barBeats);
  game.update(Math.min(note.time,boundary));
  if(game.getState().result)break;
  if(boundary<note.time)continue;
  assert.equal(game.tap(note.time).kind,'hit');
 }
 assert.equal(game.getState().phase,'caught');return game.getState();
}

test('all thirty stable species have frozen biome habitats with exactly three common travelers',()=>{
 assert.equal(fishing.FISH.length,30);assert.equal(new Set(fishing.FISH.map(fish=>fish.id)).size,30);
 assert.deepEqual(fishing.FISH.filter(fish=>fish.biomes.length===3).map(fish=>fish.id),shared);
 for(const fish of fishing.FISH){
  assert.ok(Object.isFrozen(fish.biomes));assert.deepEqual(fish.biomes,world.fishHabitats(fish));
  if(shared.includes(fish.id))assert.equal(fish.rarity,'common');
  else assert.equal(fish.biomes.length,1,fish.id+' has one home biome');
  assert.ok(fish.notes>0&&fish.xp>0);
 }
});

test('each biome supplies its own meter and every rarity without leaking exclusive species',()=>{
 const pools=[];
 for(const biome of Object.values(world.BIOMES)){
  const pool=fishing.availableFish(undefined,undefined,biome.id);pools.push(pool);
  assert.equal(pool.length,12);assert.deepEqual(pool,fishing.availableFish(biome.meter,undefined,biome.id));
  assert.ok(pool.every(fish=>fish.biomes.includes(biome.id)&&fish.meters.includes(biome.meter)));
  for(const id of shared)assert.ok(pool.some(fish=>fish.id===id));
  for(const rarity of fishing.RARITIES){
   const choices=fishing.availableFish(undefined,rarity.id,biome.id);assert.ok(choices.length,biome.id+'/'+rarity.id);
   for(const draw of [0,.25,.75,.999999]){
    const fish=fishing.chooseFish({biome:biome.id,rarity:rarity.id,random:()=>draw});
    assert.ok(choices.includes(fish));assert.equal(fishing.canFishInBiome(fish,biome.id),true);
   }
  }
 }
 for(let a=0;a<pools.length;a++)for(let b=a+1;b<pools.length;b++)
  assert.deepEqual(pools[a].filter(fish=>pools[b].includes(fish)).map(fish=>fish.id),shared);
});

test('invalid habitats and conflicting biome meters cannot produce an encounter',()=>{
 for(const biome of ['unknown','__proto__','constructor']){
  assert.deepEqual(fishing.availableFish(undefined,undefined,biome),[]);
  assert.equal(fishing.canFishInBiome('silver-minnow',biome),false);
  assert.throws(()=>fishing.chooseFish({biome}),/known fishing biome/);
  assert.throws(()=>fishing.createSession({fish:'silver-minnow',biome}),/known fishing biome/);
 }
 assert.equal(fishing.canFishInBiome('not-a-fish','cave'),false);
 assert.equal(fishing.canFishInBiome('glass-cavefish','swamp'),false);
 assert.deepEqual(fishing.availableFish('6/8',undefined,'cave'),[]);
 assert.throws(()=>fishing.chooseFish({biome:'cave',meter:'6/8'}),/uses 4\/4/);
 assert.throws(()=>fishing.createSession({biome:'cave',fish:'sapphire-pike'}),/does not live/);
 assert.throws(()=>fishing.createSession({biome:'ocean',fish:'silver-minnow',meter:'4/4'}),/uses 2\/2/);
 assert.deepEqual(fishing.availableFish('cut',undefined,'ocean'),fishing.availableFish('2/2',undefined,'ocean'));
 assert.deepEqual(fishing.availableFish(undefined,undefined,'starlit-expanse'),fishing.availableFish(undefined,undefined,'ocean'));
});

test('shared catches use each biome pulse while rewards and old catch records stay compatible',()=>{
 for(const biome of Object.values(world.BIOMES)){
  const state=catchPerfect({fish:'silver-minnow',biome:biome.id}),result=state.result;
  assert.equal(state.meter,biome.meter);assert.equal(state.biome,biome.id);assert.equal(result.biome,biome.id);
  assert.equal(result.notes,4);assert.equal(result.xp,8);assert.equal(result.perfect,true);
  assert.equal(progress.validCatch(result,fishing.FISH),true);
  const legacy={...result};delete legacy.biome;
  assert.equal(progress.validCatch(legacy,fishing.FISH),true,'Old journal entries do not need biome metadata');
 }
 const legacy=catchPerfect({fish:'silver-minnow',meter:'6/8'});
 assert.equal(legacy.meter,'6/8');assert.equal(Object.hasOwn(legacy.result,'biome'),false);
 for(const meter of Object.keys(fishing.METERS))
  assert.equal(fishing.createSession({practice:true,fish:'silver-minnow',meter}).getState().meter,meter);
});

test('legacy rhythm-only browser views still run without an exploration module',()=>{
 const sandbox={window:{},Date,Math,Set,Map,JSON,Object,Number,Array,Error};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../rhythm-fishing-engine.js'),'utf8'),sandbox);
 const engine=sandbox.window.CodaRhythmFishing;
 assert.equal(engine.FISH.length,30);assert.equal(engine.chooseFish({random:()=>0}).id,'silver-minnow');
 assert.equal(engine.createSession({fish:'silver-minnow',meter:'6/8'}).getState().meter,'6/8');
 assert.deepEqual(Array.from(engine.fishFor('bluegill').biomes),['cave','swamp','ocean']);
 assert.throws(()=>engine.chooseFish({biome:'cave'}),/known fishing biome/);
});
