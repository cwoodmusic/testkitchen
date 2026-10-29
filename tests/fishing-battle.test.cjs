const test=require('node:test'),assert=require('node:assert/strict');
const {createBattleState,ANNOUNCEMENT_SECONDS}=require('../fishing-battle.js');
const fish={id:'glass-cavefish',name:'Glass Cavefish',rarity:'rare',rarityRank:2,color:'#b8e4df',accent:'#e6fff3'};

test('rarity announcements begin once per battle and remain silent for common or uncommon fish',()=>{
 const battle=createBattleState();battle.start({fish,time:10,id:'first'});assert.equal(battle.getState().announcementText,'RARE FISH!');
 battle.update({time:12,phase:'playing'});const elapsed=battle.getState().elapsed;
 battle.start({fish,time:12,id:'first'});assert.equal(battle.getState().elapsed,elapsed,'Repeated start calls do not replay the announcement');
 battle.update({time:10+ANNOUNCEMENT_SECONDS+.01});assert.equal(battle.getState().announcementVisible,false);
 battle.start({fish:{...fish,rarityRank:3},time:20,id:'second'});assert.equal(battle.getState().announcementText,'EPIC FISH!');
 battle.start({fish:{...fish,rarityRank:4},time:20,id:'third'});assert.equal(battle.getState().announcementText,'LEGENDARY FISH!');
 for(const rank of [0,1]){battle.start({fish:{...fish,rarityRank:rank},time:20,id:'common-'+rank});assert.equal(battle.getState().announcementVisible,false);assert.equal(battle.getState().announcement,null);}
});
test('bite preview shows the fish without announcing rarity before the battle starts',()=>{
 const battle=createBattleState();battle.update({phase:'bite',fish,time:1,progress:45});assert.equal(battle.getState().phase,'bite');assert.equal(battle.getState().announcementVisible,false);
 battle.start({fish,time:2,id:'hooked'});assert.equal(battle.getState().announcementVisible,true);assert.equal(battle.getState().elapsed,0);
});
test('paused or hidden clocks cannot expire the announcement or animate the battle',()=>{
 const battle=createBattleState();battle.start({fish,time:0,id:'paused'});battle.update({time:1,phase:'playing'});const before=battle.getState();
 battle.update({time:31,paused:true,progress:90});const paused=battle.getState();
 assert.equal(paused.elapsed,before.elapsed);assert.equal(paused.progress,before.progress);assert.equal(paused.fishX,before.fishX);assert.equal(paused.fishY,before.fishY);assert.equal(paused.announcementRemaining,before.announcementRemaining);
 battle.update({time:50,paused:false});assert.equal(battle.getState().elapsed,before.elapsed,'Resuming discards time accumulated while paused');
 battle.update({time:51,phase:'playing'});assert.equal(battle.getState().elapsed,before.elapsed+1);assert.equal(battle.getState().announcementVisible,true);
 battle.update({time:53,phase:'playing'});assert.equal(battle.getState().announcementVisible,false);
});
test('good taps reel the fish toward the rod while errors increase line tension and distance',()=>{
 const hit=createBattleState(),miss=createBattleState();for(const battle of [hit,miss])battle.start({fish,time:0,id:'motion'});
 const good=hit.update({time:.2,phase:'playing',progress:70,hits:1,misses:0,extras:0,lastJudgement:{kind:'hit',time:.2,noteId:'one'}});
 const bad=miss.update({time:.2,phase:'playing',progress:30,hits:0,misses:1,extras:0,lastJudgement:{kind:'miss',time:.2,noteId:'one'}});
 assert.ok(good.fishX<bad.fishX);assert.ok(good.tension<bad.tension);assert.equal(good.feedback,'Reeling it closer!');assert.equal(bad.feedback,'The fish is pulling!');
 assert.equal(hit.update({time:.3,phase:'playing',progress:70,hits:1,lastJudgement:{kind:'hit',time:.2,noteId:'one'},misses:0,extras:0}).reactionAt,.2,'Rendering the same judgement must not restart its reaction');
});
test('reduced motion and effects off keep a calm graphic while reflecting actual progress',()=>{
 for(const options of [{reducedMotion:()=>true},{getQuality:()=> 'off'}]){
  const battle=createBattleState(options);battle.start({fish,time:0,id:'calm'});
  const before=battle.update({time:1,phase:'playing',progress:75,hits:1,lastJudgement:{kind:'hit',time:1}}),after=battle.update({time:2,phase:'playing',progress:75,hits:1,lastJudgement:{kind:'hit',time:1}});
  assert.equal(before.fishX,after.fishX);assert.equal(before.fishY,after.fishY);assert.equal(before.wiggle,0);assert.equal(before.displayProgress,75);assert.equal(before.calm,true);
 }
});
test('battle state cannot mutate the fish catalog or alter catch rewards',()=>{
 const source={...fish,notes:24,xp:18},battle=createBattleState();battle.start({fish:source,time:0,id:'isolated'});source.color='#000000';const snapshot=battle.getState();snapshot.fish.notes=999;
 assert.equal(battle.getState().fish.notes,24);assert.equal(battle.getState().fish.color,fish.color);battle.update({time:1,progress:Infinity});assert.equal(battle.getState().progress,45);
 battle.clear();assert.deepEqual(battle.getState(),{active:false});
});
