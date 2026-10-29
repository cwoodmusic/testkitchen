const test=require('node:test'),assert=require('node:assert/strict');
const fishing=require('../rhythm-fishing-engine.js'),rewards=require('../fishing-progress.js');
const notes=require('../notes-shop.js'),experience=require('../player-progression.js');
function disk(){const data=new Map();return {data,fail:false,getItem:key=>data.get(key)||null,setItem(key,value){if(this.fail)throw Error('quota');data.set(key,value);}};}
function catchFish(fish=fishing.FISH[0],id='catch-one',meter=fish.meter){
 const session=fishing.createSession({fish,id,meter,startTime:0});
 for(let step=0;step<100&&session.getState().phase!=='caught';step++){
  const target=session.getState().notes.find(note=>note.judgement==='pending');assert.ok(target,'The score must provide another playable note');session.tap(target.time);
 }
 const result=session.getState().result;assert.equal(result.caught,true);return result;
}
function environment(options={}){
 const noteDisk=options.noteDisk||disk(),xpDisk=options.xpDisk||disk(),wallet=notes.createWallet({storage:noteDisk}),progression=experience.create({storage:xpDisk}),catches=options.catches||[];
 const controller=rewards.create({wallet,progression,catalog:fishing.FISH,getCatches:()=>catches});
 return {noteDisk,xpDisk,wallet,progression,catches,controller};
}

test('only a saved completed catch earns catalog Notes, XP, and one-time achievements',()=>{
 const result=catchFish(),env=environment();
 assert.equal(env.controller.reward(fishing.FISH[0],result).ok,false,'An unsaved catch cannot pay');
 assert.equal(env.wallet.snapshot().balance,150);assert.equal(env.progression.getState().xp,0);
 env.catches.push({...result});const paid=env.controller.reward({...fishing.FISH[0],notes:999,xp:999},result);
 assert.equal(paid.ok,true);assert.equal(paid.notes,4);assert.equal(paid.amount,4);assert.equal(paid.xp,108);
 assert.deepEqual(paid.achievements.map(value=>value.id),['fishing-first-catch','fishing-perfect-catch']);
 assert.equal(env.wallet.snapshot().balance,154);assert.equal(env.progression.getState().xp,108);
 const repeated=env.controller.reward(fishing.FISH[0],result);assert.equal(repeated.ok,true);assert.equal(repeated.alreadyClaimed,true);assert.equal(repeated.notes,0);assert.equal(repeated.xp,0);
 const restored=environment({noteDisk:env.noteDisk,xpDisk:env.xpDisk,catches:env.catches});
 assert.equal(restored.controller.reward(fishing.FISH[0],result).alreadyClaimed,true);
 assert.equal(restored.controller.snapshot().stats.total,1);assert.equal(restored.wallet.snapshot().balance,154);
});

test('escaped, unfinished, altered, unknown, and mismatched catch results award nothing',()=>{
 const result=catchFish(),env=environment({catches:[result]}),session=fishing.createSession({fish:fishing.FISH[0],id:'escaped'});session.abort();
 for(const invalid of [session.getState().result,{...result,caught:false},{...result,outcome:'playing'},{...result,reason:'aborted'},{...result,hits:0},{...result,fishId:'unknown'},{...result,notes:1000},{...result,xp:1000},{...result,meter:'3/4'},{...result,timeSignature:'6/8'},{...result,perfect:false},{...result,id:'a'.repeat(93)},{...result,misses:1,perfect:false}]){
  assert.equal(env.controller.reward(fishing.FISH[0],invalid).ok,false);
 }
 assert.equal(env.controller.reward(fishing.FISH[1],result).ok,false);
 assert.equal(env.wallet.snapshot().balance,150);assert.equal(env.progression.getState().xp,0);
});

test('Notes save failures pay no XP; retry after an XP failure does not pay Notes twice',()=>{
 const result=catchFish(),env=environment({catches:[result]});env.noteDisk.fail=true;
 assert.equal(env.controller.reward(fishing.FISH[0],result).ok,false);assert.equal(env.progression.getState().xp,0);
 env.noteDisk.fail=false;env.xpDisk.fail=true;
 const partial=env.controller.reward(fishing.FISH[0],result);assert.equal(partial.ok,false);assert.equal(partial.notes,4);assert.equal(partial.xp,0);
 assert.equal(env.wallet.snapshot().balance,154);assert.equal(env.progression.getState().xp,0);
 env.xpDisk.fail=false;const retry=env.controller.reward(fishing.FISH[0],result);
 assert.equal(retry.ok,true);assert.equal(retry.notes,0);assert.equal(retry.xp,108);assert.equal(env.wallet.snapshot().balance,154);
 assert.equal(env.controller.snapshot().error,'');
});

test('an interrupted achievement save retries only the missing XP and stays idempotent',()=>{
 const result=catchFish(),env=environment({catches:[result]}),original=env.progression.awardXP;let fail=true;
 env.progression.awardXP=(id,...args)=>{if(id==='achievement:fishing-perfect-catch'&&fail)return {ok:false,error:'Saving interrupted'};return original(id,...args);};
 const partial=env.controller.reward(fishing.FISH[0],result);assert.equal(partial.ok,false);assert.equal(partial.notes,4);assert.equal(partial.xp,58);
 assert.equal(env.progression.getState().xp,58);fail=false;
 const retry=env.controller.reward(fishing.FISH[0],result);assert.equal(retry.ok,true);assert.equal(retry.notes,0);assert.equal(retry.xp,50);
 assert.equal(env.progression.getState().xp,108);assert.equal(env.controller.reward(fishing.FISH[0],result).xp,0);
});

test('all thirty actual species and all three meters earn the nine authored achievements',()=>{
 const catches=fishing.FISH.map((fish,index)=>catchFish(fish,'catch-'+index,fish.meter));
 const env=environment({catches});const summary=env.controller.snapshot();
 assert.equal(summary.stats.total,30);assert.equal(summary.stats.species,30);assert.deepEqual(summary.stats.meterIds,['4/4','6/8','2/2']);
 assert.ok(summary.stats.legendary>0);assert.ok(summary.achievements.every(value=>value.earned));assert.equal(summary.achievements.length,9);
 const fish=fishing.FISH.at(-1),paid=env.controller.reward(fish,catches.at(-1));assert.equal(paid.ok,true);assert.equal(paid.achievements.length,9);assert.equal(paid.xp,fish.xp+9*50);
 assert.equal(env.wallet.snapshot().balance,150+fish.notes);assert.equal(env.controller.reward(fish,catches.at(-1)).xp,0);
});

test('journal duplicates, escapes, and invalid entries do not inflate collection achievements',()=>{
 const result=catchFish(),entries=[result,{result},null,{...result,id:'escaped',caught:false,outcome:'escaped'}, {...result,id:'invalid-perfect',perfect:false}];
 const stats=rewards.catchStats(entries,fishing.FISH);assert.equal(stats.total,1);assert.equal(stats.species,1);assert.equal(stats.perfect,1);
 const env=environment({catches:[{result}]});assert.equal(env.controller.reward(fishing.FISH[0],result).ok,true);
 const achievements=env.controller.getAchievements();assert.equal(achievements.find(value=>value.id==='fishing-five-catches').progress,1);assert.equal(achievements.find(value=>value.id==='fishing-all-species').earned,false);
});

test('unreadable journals and thrown reward providers fail closed without losing retry state',()=>{
 const result=catchFish(),env=environment({catches:[result]});
 const absent=rewards.create({catalog:fishing.FISH,wallet:env.wallet,progression:env.progression,getCatches(){throw Error('read');}});
 assert.equal(absent.reward(fishing.FISH[0],result).ok,false);assert.equal(env.wallet.snapshot().balance,150);
 const broken=rewards.create({catalog:fishing.FISH,wallet:{grantReward(){throw Error('write');}},progression:env.progression,getCatches:()=>[result]});
 assert.equal(broken.reward(fishing.FISH[0],result).ok,false);assert.equal(env.progression.getState().xp,0);
 const snapshot=env.controller.snapshot();snapshot.achievements.length=0;snapshot.stats.speciesIds.push('bad');assert.equal(env.controller.snapshot().achievements.length,9);assert.deepEqual(env.controller.snapshot().stats.speciesIds,[result.fishId]);
});
