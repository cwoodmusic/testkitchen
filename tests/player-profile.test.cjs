const test=require('node:test'),assert=require('node:assert/strict');
const profile=require('../player-profile.js'),catalog=require('../player-progression.js'),missions=require('../musician-missions.js');
test('profile shows the exact next level, XP remaining and real next prizes',()=>{
 const source={avatar:{name:'Melody',headwear:'witch'},progression:{xp:130,level:2},notes:{balance:74}},before=JSON.stringify(source);
 const view=profile.profileModel(source,catalog);
 assert.equal(view.name,'Melody');assert.equal(view.level,2);assert.equal(view.nextLevel,3);assert.equal(view.xpToNext,50);assert.equal(view.levelXP,50);assert.equal(view.levelSize,100);assert.equal(view.progress,.5);
 assert.deepEqual(view.nextPrizes,[{id:'beret',label:'Artist beret',kind:'cosmetic'},{id:11,label:'Neon Marimba',kind:'sound'}]);assert.equal(view.notes,74);
 assert.equal(JSON.stringify(source),before);view.avatar.headwear='none';assert.equal(source.avatar.headwear,'witch','Profile snapshots must not change equipment');
});
test('exact level thresholds and maximum level never invent a further prize',()=>{
 for(const [index,xp] of catalog.THRESHOLDS.entries()){
  const view=profile.profileModel({progression:{xp}},catalog);assert.equal(view.level,index+1);
  if(index<catalog.THRESHOLDS.length-1){assert.equal(view.xpToNext,catalog.THRESHOLDS[index+1]-xp);assert.equal(view.progress,0);assert.ok(view.nextPrizes.length);}
  else{assert.equal(view.atMax,true);assert.equal(view.nextLevel,null);assert.equal(view.xpToNext,0);assert.equal(view.progress,1);assert.deepEqual(view.nextPrizes,[]);}
 }
 const beyond=profile.profileModel({progression:{xp:catalog.THRESHOLDS.at(-1)+1000}},catalog);assert.equal(beyond.level,catalog.THRESHOLDS.length);assert.equal(beyond.atMax,true);
});
test('active and pending-reward missions retain actual goals, progress and rewards',()=>{
 const snapshot={missions:missions.DEFINITIONS.slice(0,9).map((mission,index)=>({...mission,status:['active','complete','rewarded','available'][index%4],progress:index===0?999:1}))};
 const view=profile.profileModel({missions:snapshot},catalog);
 assert.equal(view.activeMissions.length,5);assert.equal(view.completedMissions.length,2);assert.equal(view.availableMissions.length,2);
 assert.equal(view.activeMissions[0].progress,1);assert.equal(view.activeMissions[0].reward,90);assert.equal(view.activeMissions[0].gameName,'Music Triad');assert.equal(view.activeMissions[1].status,'complete');
 assert.equal(snapshot.missions[0].progress,999,'Display clamping must not alter saved mission data');
});
test('new or malformed profile data stays readable without making up progress',()=>{
 const fresh=profile.profileModel({},catalog);assert.equal(fresh.name,'Guest');assert.equal(fresh.level,1);assert.equal(fresh.xpToNext,80);assert.equal(fresh.notes,0);assert.deepEqual(fresh.activeMissions,[]);
 const broken=profile.profileModel({avatar:{name:42},progression:{xp:NaN},notes:{balance:-1},missions:{missions:[null,{status:'unknown'}]}},catalog);
 assert.equal(broken.level,1);assert.equal(broken.xp,0);assert.equal(broken.notes,0);assert.deepEqual(broken.activeMissions,[]);
});
test('tutorial state and recent XP are copied for display without consuming rewards',()=>{
 const progress={version:1,completed:['note-naming'],lessons:[{id:'note-naming',title:'Note naming',step:4,total:4,completed:true},{id:'rhythm-tree',title:'The rhythm tree',step:1,total:5,completed:false}]};
 const view=profile.profileModel({tutorials:progress,progression:{xp:50,recent:[{id:'achievement:lesson',xp:50,reason:'Note naming lesson'}]}},catalog);
 assert.deepEqual(view.tutorials,progress);assert.equal(view.recent[0].reason,'Note naming lesson');view.tutorials.completed.push('rhythm-tree');assert.deepEqual(progress.completed,['note-naming']);
});

test('level-gated quest previews show the next tier and its next-level prize without inventing access',()=>{
 const definitions=[
  {id:'lake-three',person:'miles',title:'Lake three',game:'fishing',target:3,reward:90,minLevel:3,status:'locked',progress:0},
  {id:'piano-three',person:'miles',title:'Piano three',game:'piano',target:2,reward:100,minLevel:3,status:'locked',progress:0},
  {id:'lake-five',person:'miles',title:'Lake five',game:'fishing',target:5,reward:150,minLevel:5,status:'locked',progress:0},
  {id:'old-one',person:'miles',title:'Old mission',game:'triad',target:1,reward:40,status:'available',progress:0}
 ];
 const first=profile.profileModel({progression:{xp:0},missions:definitions},catalog);
 assert.equal(first.nextUnlockLevel,3);assert.deepEqual(first.upcomingMissions.map(m=>m.id),['lake-three','piano-three']);
 assert.deepEqual(first.availableMissions.map(m=>m.id),['old-one']);assert.equal(first.availableMissions[0].minLevel,1);assert.equal(first.availableMissions[0].unlocked,true);
 assert.equal(first.upcomingMissions[0].gameName,'Rhythm Fishing');assert.equal(first.upcomingMissions[1].gameName,'Piano Lab');
 assert.equal(first.nextPrizes.some(p=>p.kind==='quest'),false,'Level two does not unlock these quests');
 const second=profile.profileModel({progression:{xp:catalog.THRESHOLDS[1]},missions:definitions},catalog);
 assert.deepEqual(second.nextPrizes.find(p=>p.kind==='quest'),{id:'quests-level-3',label:'2 new quests at Level 3',kind:'quest',count:2});
 assert.equal(second.upcomingMissions[0].unlocked,false);assert.equal(definitions[0].status,'locked');
});
test('accepted quests retain exact IDs when a level gate temporarily prevents play or collection',()=>{
 const view=profile.profileModel({progression:{xp:0},missions:[
  {id:'miles-easy',person:'miles',status:'active',game:'triad',target:1,progress:0,reward:40},
  {id:'miles-fishing',person:'miles',status:'active',game:'fishing',minLevel:5,unlocked:false,target:4,progress:2,reward:90},
  {id:'miles-piano',person:'miles',status:'complete',game:'piano',minLevel:3,unlocked:false,target:2,progress:2,reward:100},
  {id:'miles-old',person:'miles',status:'rewarded',game:'triad',minLevel:5,target:1,progress:1,reward:80}
 ]},catalog);
 assert.deepEqual(view.activeMissions.map(m=>m.id),['miles-easy','miles-fishing','miles-piano']);
 assert.equal(view.activeMissions[0].unlocked,true);assert.equal(view.activeMissions[1].unlocked,false);assert.equal(view.activeMissions[2].unlocked,false);
 assert.equal(view.completedMissions[0].id,'miles-old');assert.equal(view.completedMissions[0].reward,80);
});
test('shared level rewards expose Notes and vibes without mutating the catalog',()=>{
 const prizes=[{id:'level-prize:20',label:'1500 Notes',kind:'notes',amount:1500,level:20},{id:'glowstick',label:'Glowstick Vibe',kind:'vibe',level:20}];
 const custom={THRESHOLDS:Array.from({length:21},(_,n)=>n*100),prizesForLevel:level=>level===20?prizes:[]};
 const model=profile.profileModel({progression:{xp:1800}},custom);
 assert.equal(model.level,19);assert.equal(model.nextLevel,20);
 assert.deepEqual(model.nextPrizes,[{id:'level-prize:20',label:'1500 Notes',kind:'notes',amount:1500},{id:'glowstick',label:'Glowstick Vibe',kind:'vibe'}]);
 model.nextPrizes[0].amount=0;assert.equal(prizes[0].amount,1500);assert.equal(prizes[0].level,20);
});
