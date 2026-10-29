const test=require('node:test');
const assert=require('node:assert/strict');
const progression=require('../player-progression.js');
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
const pitch={mode:'classic',score:20,correct:15,misses:0,streak:10,won:true,perfect:true};
function danceResult(changes={}){
 const notesTotal=changes.notesTotal??32,hits=changes.hits??notesTotal,extras=changes.extras??0,wrongInputs=changes.wrongInputs??extras;
 const lateMisses=changes.lateMisses??notesTotal-hits-wrongInputs+extras,misses=changes.misses??wrongInputs+lateMisses,goodHits=changes.goodHits??0,perfectHits=changes.perfectHits??hits-goodHits;
 return {complete:true,difficulty:'hard',bars:8,notesTotal,hits,misses,bestStreak:hits,score:100*perfectHits+70*goodHits,perfectHits,goodHits,wrongInputs,lateMisses,extras,accuracy:hits/(hits+misses),perfect:misses===0,...changes};
}

test('completed DJ dances save run XP and reached achievements together before announcing rewards',()=>{
 const disk=storage(),write=disk.setItem,announced=[];let writes=0;
 disk.setItem=(key,value)=>{writes++;write(key,value);};
 const player=progression.create({storage:disk,onAward:award=>{
  assert.equal(JSON.parse(disk.getItem(progression.KEY)).events.some(event=>event.id===award.id),true);
  announced.push(award);
 }});
 const first=player.recordDanceResult('hard-perfect',danceResult());
 assert.equal(first.ok,true);assert.equal(first.amount,790);assert.equal(writes,1);
 assert.deepEqual(first.achievements,['dance-first-finish','dance-twenty-streak','dance-hard-groove','dance-perfect-set','dance-hard-perfect']);
 assert.equal(announced.length,6);assert.equal(announced[0].id,'game:dance:hard-perfect');assert.equal(announced[0].amount,90);
 for(const id of ['shutter','rollerskates','boombox'])assert.equal(player.unlocked(id),true);
 const replay=player.recordDanceResult('hard-perfect',danceResult());assert.equal(replay.alreadyAwarded,true);assert.equal(replay.amount,0);assert.equal(writes,1);assert.equal(announced.length,6);
 const next=player.recordDanceResult('normal-perfect',danceResult({difficulty:'normal'}));assert.equal(next.amount,190);assert.deepEqual(next.achievements,['dance-normal-groove']);
 const loaded=progression.create({storage:disk});assert.equal(loaded.getState().xp,980);assert.equal(loaded.unlocked('boombox'),true);
 for(const achievement of progression.DANCE_ACHIEVEMENTS){const events=JSON.parse(disk.getItem(progression.KEY)).events.filter(event=>event.id==='achievement:'+achievement.id);assert.equal(events.length,1);assert.equal(events[0].xp,achievement.xp);}
 for(const id of ['shutter','rollerskates','boombox'])assert.equal(progression.ACHIEVEMENT_REWARDS.find(item=>item.id===id).purchaseAlternative,true);
});

test('DJ difficulty and streak goals use completed-run evidence at their exact thresholds',()=>{
 for(const difficulty of ['easy','normal','hard'])for(const hits of [19,20]){
  const disk=storage(),player=progression.create({storage:disk}),result=danceResult({difficulty,notesTotal:25,hits});
  assert.equal(player.recordDanceResult('threshold',result).ok,true);
  const earned=new Set(JSON.parse(disk.getItem(progression.KEY)).events.map(event=>event.id));
  assert.equal(earned.has('achievement:dance-twenty-streak'),hits===20);
  assert.equal(earned.has('achievement:dance-normal-groove'),difficulty==='normal'&&hits===20);
  assert.equal(earned.has('achievement:dance-hard-groove'),difficulty==='hard'&&hits===20);
  assert.equal(earned.has('achievement:dance-perfect-set'),false);assert.equal(earned.has('achievement:dance-hard-perfect'),false);
 }
 const disk=storage(),player=progression.create({storage:disk});
 player.recordDanceResult('short-streak',danceResult({notesTotal:25,hits:25,bestStreak:19,extras:1}));
 assert.equal(player.unlocked('shutter'),false,'A high hit total is not evidence of a continuous streak');
});

test('DJ perfect rewards derive from actual hits and mistakes rather than the reported flag',()=>{
 for(const changes of [{hits:31,perfect:true},{extras:1,perfect:true}]){
  const disk=storage(),player=progression.create({storage:disk});
  assert.equal(player.recordDanceResult('not-perfect',danceResult(changes)).ok,true);
  const events=JSON.parse(disk.getItem(progression.KEY)).events;
  assert.equal(events.find(event=>event.id==='game:dance:not-perfect').xp,70);
  for(const id of ['dance-perfect-set','dance-hard-perfect'])assert.equal(events.some(event=>event.id==='achievement:'+id),false);
 }
 const disk=storage(),player=progression.create({storage:disk});
 assert.equal(player.recordDanceResult('all-hit',danceResult({perfect:false,goodHits:4})).ok,true);
 assert.equal(player.unlocked('rollerskates'),true);assert.equal(player.unlocked('boombox'),true,'Good timing still matches the step');
});

test('partial, empty, contradictory and malformed DJ results never award progress',()=>{
 const disk=storage(),player=progression.create({storage:disk});
 const changes=[{complete:false},{bars:7},{difficulty:'expert'},{notesTotal:0},{notesTotal:257},{hits:0},{hits:33},{hits:1.5},
  {misses:-1},{misses:10001},{wrongInputs:-1},{extras:2,wrongInputs:1},{lateMisses:257},{bestStreak:33},
  {score:3201},{perfectHits:31},{goodHits:1,perfectHits:32},{accuracy:.99},{accuracy:NaN},{accuracy:Infinity},{misses:1,lateMisses:0}];
 for(const [index,change]of changes.entries())assert.equal(player.recordDanceResult('bad-'+index,danceResult(change)).ok,false,JSON.stringify(change));
 const zero=danceResult({hits:0,bestStreak:0});assert.equal(player.recordDanceResult('zero-hits',zero).ok,false);
 for(const id of ['',null,'bad id','<script>','a'.repeat(129)])assert.equal(player.recordDanceResult(id,danceResult()).ok,false);
 for(const result of [null,{},[],{complete:true}])assert.equal(player.recordDanceResult('missing',result).ok,false);
 assert.equal(disk.getItem(progression.KEY),null);assert.equal(player.getState().xp,0);
});

test('altering a saved DJ run cannot upgrade its difficulty, streak or perfect achievements',()=>{
 const disk=storage(),player=progression.create({storage:disk}),first=player.recordDanceResult('same-run',danceResult({difficulty:'easy',notesTotal:8,hits:1}));
 assert.equal(first.amount,62);const saved=disk.getItem(progression.KEY);
 const replay=player.recordDanceResult('same-run',danceResult());assert.equal(replay.alreadyAwarded,true);assert.equal(replay.amount,0);assert.deepEqual(replay.achievements,[]);assert.equal(disk.getItem(progression.KEY),saved);
 assert.equal(player.unlocked('boombox'),false);
 const loaded=progression.create({storage:disk});assert.equal(loaded.recordDanceResult('same-run',danceResult()).amount,0);
 assert.equal(loaded.recordDanceResult('new-run',danceResult()).amount,740);assert.equal(loaded.unlocked('boombox'),true);
});

test('failed or paused DJ reward saves grant no partial achievements and allow a safe retry',()=>{
 const disk=storage(),write=disk.setItem,announced=[];let blocked=true,allowed=false;
 disk.setItem=(key,value)=>{if(blocked)throw Error('quota');write(key,value);};
 const player=progression.create({storage:disk,canRecord:()=>allowed,onAward:award=>announced.push(award)});
 assert.equal(player.recordDanceResult('retry',danceResult()).ok,false);assert.equal(disk.getItem(progression.KEY),null);
 allowed=true;assert.equal(player.recordDanceResult('retry',danceResult()).ok,false);assert.equal(player.getState().xp,0);assert.equal(announced.length,0);assert.equal(disk.getItem(progression.KEY),null);
 blocked=false;assert.equal(player.recordDanceResult('retry',danceResult()).amount,790);assert.equal(announced.length,6);
 assert.equal(player.recordDanceResult('retry',danceResult()).alreadyAwarded,true);assert.equal(announced.length,6);
 const thrown=progression.create({storage:disk,canRecord(){throw Error('profile unavailable');}});assert.equal(thrown.recordDanceResult('blocked',danceResult()).ok,false);
});

test('DJ reward callbacks cannot recursively duplicate the completed run',()=>{
 const disk=storage(),nested=[];let player;
 player=progression.create({storage:disk,onChange:()=>{if(player)nested.push(player.recordDanceResult('reentrant',danceResult()));}});
 assert.equal(player.recordDanceResult('reentrant',danceResult()).amount,790);
 assert.equal(nested.length,1);assert.equal(nested[0].alreadyAwarded,true);assert.equal(nested[0].amount,0);
 assert.equal(JSON.parse(disk.getItem(progression.KEY)).events.length,6);
});

test('DJ results use the current player journal and never revive cleared cached progress',()=>{
 for(const replacement of [null,JSON.stringify({version:1,xp:10,events:[{id:'quest:next-player',xp:10}],bestPitchLevel:0})]){
  let raw=null;const disk={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}},player=progression.create({storage:disk});
  player.awardXP('quest:previous-player',100,'Old player',{pitchLevel:30});raw=replacement;
  assert.equal(player.recordDanceResult('current-player',danceResult({difficulty:'easy',notesTotal:8,hits:1})).amount,62);
  const saved=JSON.parse(raw);assert.equal(saved.events.some(event=>event.id==='quest:previous-player'),false);assert.equal(saved.bestPitchLevel,0);
  assert.equal(saved.xp,replacement===null?62:72);
  assert.equal(saved.events.some(event=>event.id==='quest:next-player'),replacement!==null);
 }
});

test('DJ results leave corrupt or unreadable current journals unchanged instead of overwriting them',()=>{
 const corrupt=['{broken','null','{}',JSON.stringify({version:1,xp:100,events:[]}),
  JSON.stringify({version:1,xp:0,events:[{id:'quest:bad',xp:0}]})];
 for(const damaged of corrupt){
  let raw=null;const disk={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}},player=progression.create({storage:disk});
  player.awardXP('quest:cached-player',100);raw=damaged;
  assert.equal(player.recordDanceResult('corrupt',danceResult()).ok,false);assert.equal(raw,damaged);
 }
 let raw=null,blocked=false,writes=0;const disk={getItem(){if(blocked)throw Error('storage unavailable');return raw;},setItem(_key,value){writes++;raw=value;}};
 const player=progression.create({storage:disk});player.awardXP('quest:cached-player',100);const before=raw;blocked=true;
 assert.equal(player.recordDanceResult('unreadable',danceResult()).ok,false);assert.equal(raw,before);assert.equal(writes,1);
 blocked=false;assert.equal(player.recordDanceResult('unreadable',danceResult()).ok,true);
});

test('DJ results recheck permission and current-player proof immediately before their atomic write',()=>{
 for(const switchProfile of [false,true]){
  let raw=null,calls=0;const replacement=JSON.stringify({version:1,xp:5,events:[{id:'quest:next-player',xp:5}]});
  const disk={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
  const player=progression.create({storage:disk,canRecord:()=>{
   calls++;if(calls===2){if(switchProfile)raw=replacement;else return false;}return true;
  }});
  assert.equal(player.recordDanceResult('interrupted',danceResult()).ok,false);
  assert.equal(raw,switchProfile?replacement:null);
 }
});

test('DJ reward notifications stop if a save subscriber synchronously switches, clears or pauses the profile',()=>{
 for(const interruption of ['switch','clear','pause','award-callback']){
  let raw=null,allowed=true;const announced=[],replacement=JSON.stringify({version:1,xp:5,events:[{id:'quest:next-player',xp:5}]});
  const disk={getItem:()=>raw,setItem:(_key,value)=>{raw=value;}};
  const player=progression.create({storage:disk,canRecord:()=>allowed,onChange:()=>{
   if(interruption==='switch')raw=replacement;
   if(interruption==='clear')raw=null;
   if(interruption==='pause')allowed=false;
  },onAward:award=>{announced.push(award);if(interruption==='award-callback')raw=replacement;}});
  assert.equal(player.recordDanceResult('completed',danceResult()).ok,true,'The original run was saved before the subscriber interrupted');
  assert.equal(announced.length,interruption==='award-callback'?1:0);
  if(interruption==='award-callback')assert.equal(announced[0].id,'game:dance:completed');
  if(['switch','award-callback'].includes(interruption))assert.equal(raw,replacement);
  if(interruption==='clear')assert.equal(raw,null);
 }
});

test('verified game play, achievements and quests earn separately persisted XP',()=>{
 const saved=storage(),player=progression.create({storage:saved});
 assert.equal(player.getState().xp,0);assert.equal(player.getState().level,1);
 const run=player.recordGameEvent('pitch','run-1',pitch);
 assert.equal(run.ok,true);assert.equal(run.amount,270);assert.equal(run.level,3);
 assert.equal(player.recordGameEvent('pitch','run-1',pitch).alreadyAwarded,true);
 assert.equal(player.getState().xp,270);
 assert.equal(player.recordGameEvent('pitch','run-2',pitch).amount,70,'Only the new run earns again; achievements stay earned');
 assert.equal(player.recordQuest('bach-win',100).amount,100);
 assert.equal(player.recordQuest('bach-win',100).alreadyAwarded,true);
 assert.equal(progression.create({storage:saved}).getState().xp,440);
});

test('progression awards no XP from Notes balances, purchases, or malformed game results',()=>{
 const saved=storage();saved.setItem('codaNotesWalletV1',JSON.stringify({balance:999999,earned:999999,spent:1000}));
 const player=progression.create({storage:saved});assert.equal(player.getState().xp,0);
 for(const [game,result] of [['unknown',pitch],['pitch',{...pitch,correct:-1}],['pitch',{...pitch,streak:30}],['rhythm',{mode:'tap',total:5,hits:6,extra:0,early:0,late:0}]])assert.equal(player.recordGameEvent(game,'run',result).ok,false);
 assert.equal(player.getState().xp,0);
});

test('Rhythm Perfect achievement and bonus reward all matched notes with no extras, including early or late hits',()=>{
 for(const timing of [{early:2,late:0},{early:0,late:3},{early:2,late:3}]){
  const disk=storage(),player=progression.create({storage:disk});
  const result={mode:'tap',total:8,hits:8,extra:0,...timing};
  const first=player.recordGameEvent('rhythm','matched-round',result);
  assert.equal(first.ok,true);assert.equal(first.amount,146,'26 run XP + 20 Perfect bonus + two 50 XP achievements');
  const events=JSON.parse(disk.getItem(progression.KEY)).events;
  assert.equal(events.find(event=>event.id==='game:rhythm:matched-round').xp,46);
  assert.equal(events.filter(event=>event.id==='achievement:rhythm-perfect-round').length,1);
  assert.equal(player.recordGameEvent('rhythm','matched-round',result).alreadyAwarded,true);
  const loaded=progression.create({storage:disk});
  assert.equal(loaded.recordGameEvent('rhythm','another-round',result).amount,46,'A new run earns its bonus without replaying achievements');
  assert.equal(JSON.parse(disk.getItem(progression.KEY)).events.filter(event=>event.id==='achievement:rhythm-perfect-round').length,1);
 }
});

test('Rhythm misses or extra taps prevent Perfect rewards and empty rounds award nothing',()=>{
 for(const [changes,runXP] of [[{hits:7},24],[{extra:1},26]]){
  const disk=storage(),player=progression.create({storage:disk});
  const result={mode:'tap',total:8,hits:8,extra:0,early:0,late:0,perfect:true,...changes};
  assert.equal(player.recordGameEvent('rhythm','imperfect-round',result).ok,true);
  const events=JSON.parse(disk.getItem(progression.KEY)).events;
  assert.equal(events.find(event=>event.id==='game:rhythm:imperfect-round').xp,runXP,'An untrusted Perfect flag cannot grant the bonus');
  assert.equal(events.some(event=>event.id==='achievement:rhythm-perfect-round'),false);
 }
 const disk=storage(),player=progression.create({storage:disk});
 assert.equal(player.recordGameEvent('rhythm','empty-round',{mode:'tap',total:0,hits:0,extra:0,early:0,late:0,perfect:true}).ok,false);
 assert.equal(player.getState().xp,0);assert.equal(disk.getItem(progression.KEY),null);
});

test('level cosmetics and bonus sounds unlock at exact experience thresholds',()=>{
 const player=progression.create({storage:storage()});
 assert.equal(player.unlocked('watchchain'),false);player.awardXP('quest:test',80,'Test quest');
 assert.equal(player.getState().level,2);assert.equal(player.unlocked('watchchain'),true);
 assert.deepEqual(player.getState().unlockedSounds,[10]);assert.equal(player.unlocked('astronaut'),false);
 assert.equal(progression.soundRequiredLevel(17),12);assert.equal(progression.soundRequiredLevel(9),1);
});

test('failed saving never grants unsaved levels, and journals refresh between callers',()=>{
 const blocked=progression.create({storage:{getItem:()=>null,setItem(){throw Error('quota');}}});
 assert.equal(blocked.awardXP('quest:a',100,'Quest').ok,false);assert.equal(blocked.getState().xp,0);
 const saved=storage(),a=progression.create({storage:saved}),b=progression.create({storage:saved});
 a.awardXP('achievement:first',50,'First');b.awardXP('quest:second',100,'Second');a.refresh();assert.equal(a.getState().xp,150);
 assert.equal(a.awardXP('quest:second',100,'Second').alreadyAwarded,true);
});

test('award announcements happen only after a new saved award, never on reload or retry',()=>{
 const saved=storage(),announced=[],player=progression.create({storage:saved,onAward:award=>announced.push(award)});
 player.recordAchievement('first-triad-result');
 assert.equal(announced.length,1);assert.equal(announced[0].id,'achievement:first-triad-result');
 assert.equal(announced[0].amount,50);assert.equal(announced[0].levelBefore,1);
 assert.equal(progression.create({storage:saved,onAward:award=>announced.push(award)}).getState().xp,50);
 player.recordAchievement('first-triad-result');assert.equal(announced.length,1);
 const blocked=progression.create({storage:{getItem:()=>null,setItem(){throw Error('quota');}},onAward:award=>announced.push(award)});
 blocked.recordAchievement('failed');assert.equal(announced.length,1);
});

test('all reward identifiers correspond to actual character catalog and sound voices',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),sandbox={window:{}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../character-renderer.js'),'utf8'),sandbox);
 const renderer=sandbox.window.createCodaCharacterRenderer(),ids=new Set(Object.values(renderer.catalog).flatMap(items=>items.map(item=>item.id)));
 for(const item of progression.COSMETICS)assert.ok(ids.has(item.id),item.id);
 const voices=require('../song-machine/sound-library.js');
 assert.deepEqual(progression.SOUNDS.map(item=>[item.id,item.level]),voices.EXTRA.map(item=>[item.id,item.level]));
});


test('mastery companions unlock from saved achievements without purchases or auto-equipping',()=>{
 const disk=storage(),player=progression.create({storage:disk});
 assert.equal(player.unlocked('rhythmfox'),false);assert.equal(player.recordRhythmStreak(99).ok,false);
 assert.equal(player.recordRhythmStreak(100).ok,true);assert.equal(player.unlocked('rhythmfox'),true);
 assert.equal(player.recordRhythmStreak(100).alreadyAwarded,true);
 player.recordAchievement('fishing-all-species');assert.equal(player.unlocked('lakeotter'),true);
 assert.equal(progression.create({storage:disk}).unlocked('lakeotter'),true);
 assert.match(player.requirement('lakeotter'),/30 fish/);
});

test('Piano memory mastery needs all nine saved melodies and deduplicates its bonus',()=>{
 const disk=storage(),player=progression.create({storage:disk});
 for(const id of progression.PIANO_MEMORIES.slice(0,-1))player.recordPianoMemory(id);
 assert.equal(player.unlocked('pianophoenix'),false);assert.equal(player.recordPianoMemory('invented').ok,false);
 const loaded=progression.create({storage:disk});loaded.recordPianoMemory(progression.PIANO_MEMORIES.at(-1));
 assert.equal(loaded.unlocked('pianophoenix'),true);const xp=loaded.getState().xp;
 assert.equal(loaded.recordPianoMemory('twinkle').alreadyAwarded,true);assert.equal(loaded.getState().xp,xp);
 assert.equal(loaded.getState().achievementRewards.filter(item=>item.id==='pianophoenix').length,1);
});

test('Hard Advanced Triad mastery requires explicit difficulty, rule mode, and a win',()=>{
 const player=progression.create({storage:storage()}),result={mode:'computer',captures:5,score:10,won:true};
 for(const [id,extra]of [['missing',{}],['hard-only',{difficulty:'hard'}],['advanced-only',{rules:'advanced'}],['multiplayer',{mode:'multiplayer',rules:'advanced',difficulty:'hard'}],['lost',{rules:'advanced',difficulty:'hard',won:false}]]){
  assert.equal(player.recordGameEvent('triad',id,{...result,...extra}).ok,true);assert.equal(player.unlocked('triadchampion'),false);
 }
 assert.equal(player.recordGameEvent('triad','winner',{...result,mode:'advanced',difficulty:'hard'}).ok,true);
 assert.equal(player.unlocked('triadchampion'),true);
});

test('Pitch Race Level milestones preserve the highest completed level and require reported evidence',()=>{
 const disk=storage(),player=progression.create({storage:disk}),run={...pitch,mode:'levels',won:false,completedLevel:30};
 player.recordGameEvent('pitch','thirty',run);
 assert.equal(player.getState().bestPitchLevel,30);
 for(const id of ['pitchlaurel10','pitchlaurel20','pitchlaurel30'])assert.equal(player.unlocked(id),true);
 assert.equal(player.unlocked('pitchcrown40'),false);assert.equal(player.unlocked('starlight'),false);
 player.recordGameEvent('pitch','lower',{...run,completedLevel:10});assert.equal(player.getState().bestPitchLevel,30);
 player.recordGameEvent('pitch','unwon-current',{...pitch,mode:'levels',won:false,level:50});assert.equal(player.getState().bestPitchLevel,30);
 player.recordGameEvent('pitch','classic',{...pitch,mode:'classic',completedLevel:50});assert.equal(player.getState().bestPitchLevel,30);
 player.recordGameEvent('pitch','fifty',{...pitch,mode:'levels',level:50,won:true});
 assert.equal(player.getState().bestPitchLevel,50);assert.equal(player.unlocked('pitchcrown40'),true);assert.equal(player.unlocked('starlight'),true);
 assert.equal(progression.create({storage:disk}).getState().bestPitchLevel,50);
});

test('clef mastery requires consistent per-clef evidence and persists each unlock once',()=>{
 const disk=storage(),player=progression.create({storage:disk});
 const result={...pitch,staff:'bass',correct:20,streak:20,clefStats:{treble:{correct:0,misses:0,bestStreak:0},bass:{correct:20,misses:0,bestStreak:20}}};
 const first=player.recordGameEvent('pitch','bass',result);assert.equal(first.ok,true);
 for(const id of ['bassclefpin','basslaurel'])assert.equal(player.unlocked(id),true);
 assert.equal(player.unlocked('grandstaffbadge'),false);
 const grand={...result,staff:'grand',clefStats:{treble:{correct:10,misses:0,bestStreak:10},bass:{correct:10,misses:0,bestStreak:10}}};
 const award=player.recordGameEvent('pitch','grand',grand);assert.equal(award.amount,480,'80 run XP + 150 reader + 250 perfect');
 for(const id of ['grandstaffbadge','grandstaffcrown'])assert.equal(player.unlocked(id),true);
 assert.equal(player.recordGameEvent('pitch','grand',grand).alreadyAwarded,true);
 const loaded=progression.create({storage:disk});assert.equal(loaded.unlocked('grandstaffcrown'),true);
 const achievements=loaded.getState().achievementRewards;
 for(const id of ['bassclefpin','basslaurel','grandstaffbadge','grandstaffcrown'])assert.equal(achievements.filter(item=>item.id===id).length,1);
});

test('missing, contradictory, or malformed clef details never grant clef cosmetics',()=>{
 const base={...pitch,correct:20,streak:20,staff:'grand',clefStats:{treble:{correct:10,misses:0,bestStreak:10},bass:{correct:10,misses:0,bestStreak:10}}};
 const cases=[{...base,clefStats:undefined},{...base,staff:'piano'},{...base,correct:21},{...base,misses:1},{...base,staff:'treble'},
 {...base,clefStats:{...base.clefStats,bass:{correct:10,misses:0,bestStreak:11}}},
 {...base,clefStats:{...base.clefStats,bass:{correct:10,misses:-1,bestStreak:10}}}];
 for(const [i,result]of cases.entries()){
  const player=progression.create({storage:storage()});assert.equal(player.recordGameEvent('pitch','invalid-'+i,result).ok,true,'Legacy game XP still accepted');
  for(const id of ['bassclefpin','basslaurel','grandstaffbadge','grandstaffcrown'])assert.equal(player.unlocked(id),false,id+' invalid case '+i);
 }
 const player=progression.create({storage:storage()});player.recordGameEvent('pitch','missed',{...base,misses:1,clefStats:{...base.clefStats,treble:{correct:10,misses:1,bestStreak:5}}});
 assert.equal(player.unlocked('grandstaffbadge'),true);assert.equal(player.unlocked('grandstaffcrown'),false);
});

function savedXP(disk,xp){
 const events=[];let remaining=xp;
 while(remaining){const amount=Math.min(1000,remaining);events.push({id:'quest:level-fixture-'+events.length,xp:amount,reason:'Completed music practice'});remaining-=amount;}
 disk.setItem(progression.KEY,JSON.stringify({version:1,xp,events,bestPitchLevel:0}));
 return disk.getItem(progression.KEY);
}
const createWallet=disk=>require('../notes-shop.js').createWallet({storage:disk});

test('level 50 extends the existing twelve thresholds without moving earned levels',()=>{
 assert.deepEqual(progression.THRESHOLDS.slice(0,12),[0,80,180,320,500,720,980,1280,1630,2030,2480,2980]);
 assert.equal(progression.THRESHOLDS.length,50);
 for(const [index,xp]of progression.THRESHOLDS.entries()){
  assert.equal(progression.levelForXP(xp),index+1);
  if(index){assert.ok(xp>progression.THRESHOLDS[index-1]);assert.equal(progression.levelForXP(xp-1),index);}
 }
 assert.equal(progression.THRESHOLDS[19],9200);assert.equal(progression.THRESHOLDS[29],21450);
 assert.equal(progression.THRESHOLDS[39],38700);assert.equal(progression.THRESHOLDS[49],60950);
 const disk=storage();savedXP(disk,60950);const value=progression.create({storage:disk}).getState();
 assert.equal(value.level,50);assert.equal(value.nextLevelXP,null);assert.equal(value.progress,1);
 assert.equal(progression.levelForXP(100000),50);
});

test('every ten levels has a large Notes prize and later levels keep real reward listings',()=>{
 assert.deepEqual(progression.LEVEL_NOTES.filter(item=>item.level%10===0).map(item=>[item.level,item.amount]),[[10,1000],[20,1500],[30,2500],[40,4000],[50,6000]]);
 for(let level=13;level<=50;level++){
  const notes=progression.prizesForLevel(level).filter(item=>item.kind==='notes');assert.equal(notes.length,1);
  assert.equal(notes[0].id,'level-prize:'+level);assert.ok(notes[0].amount>=150);
  if(level%10)assert.ok(notes[0].amount<=500);
 }
 assert.equal(progression.prizesForLevel(2).find(item=>item.kind==='cosmetic').id,'watchchain');
 assert.equal(progression.prizesForLevel(2).find(item=>item.kind==='sound').id,10);
 for(const [level,id]of [[20,'glowstick'],[30,'spooky'],[40,'aurora'],[50,'festival']])assert.equal(progression.prizesForLevel(level).find(item=>item.kind==='vibe').id,id);
 const copy=progression.prizesForLevel(20);copy[0].amount=999999;copy[0].label='Changed';
 assert.equal(progression.LEVEL_NOTES.find(item=>item.level===20).amount,1500);assert.notEqual(progression.prizesForLevel(20)[0].label,'Changed');
 for(const bad of [0,51,-1,20.5,'20',NaN])assert.deepEqual(progression.prizesForLevel(bad),[]);
});

test('vibes unlock from the current saved experience level without equipping anything',()=>{
 const disk=storage();savedXP(disk,9199);const player=progression.create({storage:disk});
 assert.deepEqual(player.getState().unlockedVibes,[]);assert.equal(player.unlocked('glowstick'),false);
 player.awardXP('quest:one-more',1,'Music quest');assert.deepEqual(player.getState().unlockedVibes,['glowstick']);assert.equal(player.unlocked('glowstick'),true);
 savedXP(disk,21450);assert.deepEqual(player.refresh().unlockedVibes,['glowstick','spooky']);
 savedXP(disk,60950);assert.deepEqual(progression.create({storage:disk}).getState().unlockedVibes,['glowstick','spooky','aurora','festival']);
 assert.equal(disk.getItem('musicArcadeV1'),null,'A vibe unlock never rewrites the avatar');
});

test('reached level prizes backfill exactly once across reloads without adding XP',()=>{
 const disk=storage(),proof=savedXP(disk,10200),player=progression.create({storage:disk}),wallet=createWallet(disk);
 const expected=progression.LEVEL_NOTES.filter(item=>item.level<=21),total=expected.reduce((sum,item)=>sum+item.amount,0);
 const first=player.claimLevelPrizes(wallet);assert.equal(first.ok,true);assert.equal(first.amount,total);
 assert.deepEqual(first.claimed.map(item=>item.id),expected.map(item=>item.id));
 assert.equal(wallet.snapshot().balance,150+total);assert.equal(wallet.snapshot().earned,150+total);
 assert.equal(disk.getItem(progression.KEY),proof,'Currency prizes leave the XP journal byte-identical');
 assert.equal(player.getState().xp,10200);
 const loaded=progression.create({storage:disk}),next=loaded.claimLevelPrizes(createWallet(disk));
 assert.equal(next.ok,true);assert.equal(next.alreadyClaimed,true);assert.equal(next.amount,0);assert.deepEqual(next.claimed,[]);
 assert.equal(wallet.refresh().balance,150+total);
});

test('a full level 50 wallet receives every listed prize once and low levels receive none',()=>{
 const lowDisk=storage();savedXP(lowDisk,2029);const low=createWallet(lowDisk);
 assert.equal(progression.create({storage:lowDisk}).claimLevelPrizes(low).amount,0);assert.equal(low.snapshot().balance,150);
 const disk=storage(),proof=savedXP(disk,60950),player=progression.create({storage:disk}),wallet=createWallet(disk);
 const first=player.claimLevelPrizes(wallet),total=progression.LEVEL_NOTES.reduce((sum,item)=>sum+item.amount,0);
 assert.equal(first.claimed.length,39);assert.equal(first.amount,total);assert.equal(wallet.snapshot().balance,150+total);
 assert.deepEqual(wallet.snapshot().rewards,progression.LEVEL_NOTES.map(item=>item.id));
 assert.equal(player.claimLevelPrizes(wallet).amount,0);assert.equal(disk.getItem(progression.KEY),proof);
});

test('a failed prize save is retried without replaying earlier paid prizes',()=>{
 const disk=storage(),write=disk.setItem;let noteWrites=0,block=true;
 disk.setItem=(key,value)=>{if(key==='codaNotesWalletV1'&&JSON.parse(value).rewards.length&&++noteWrites===2&&block)throw Error('quota');write(key,value);};
 const proof=savedXP(disk,4250),player=progression.create({storage:disk}),wallet=createWallet(disk);
 const failed=player.claimLevelPrizes(wallet);assert.equal(failed.ok,false);assert.equal(failed.amount,1000);assert.equal(failed.claimed.length,1);
 assert.deepEqual(wallet.snapshot().rewards,['level-prize:10']);block=false;
 const retry=player.claimLevelPrizes(wallet);assert.equal(retry.ok,true);assert.equal(retry.amount,310);
 assert.deepEqual(wallet.snapshot().rewards,['level-prize:10','level-prize:13','level-prize:14']);
 assert.equal(wallet.snapshot().balance,1460);assert.equal(disk.getItem(progression.KEY),proof);
});

test('wallet callbacks cannot recursively duplicate prizes or create XP notifications',()=>{
 const disk=storage(),proof=savedXP(disk,9200);let player,wallet,changes=0;const nested=[];
 player=progression.create({storage:disk,onChange:()=>changes++});
 wallet=require('../notes-shop.js').createWallet({storage:disk,onChange:()=>{if(wallet)nested.push(player.claimLevelPrizes(wallet));}});
 const result=player.claimLevelPrizes(wallet);
 assert.equal(result.ok,true);assert.equal(nested.length,result.claimed.length);
 assert.ok(nested.every(value=>value.ok&&value.busy&&value.amount===0&&value.claimed.length===0));
 assert.equal(changes,0);assert.equal(disk.getItem(progression.KEY),proof);
});

test('paused, changed, cleared and unproved profiles cannot claim cached high-level rewards',()=>{
 const disk=storage();savedXP(disk,60950);let allowed=false,calls=0;
 const player=progression.create({storage:disk,canRecord:()=>allowed}),wallet={grantReward(){calls++;return {ok:true,amount:1000};}};
 assert.equal(player.claimLevelPrizes(wallet).ok,false);assert.equal(calls,0);
 allowed=true;disk.setItem(progression.KEY,'');assert.equal(player.claimLevelPrizes(wallet).ok,false);assert.equal(calls,0,'Cached level 50 is not proof for a fresh player');
 disk.setItem(progression.KEY,JSON.stringify({version:1,xp:60950,events:[]}));assert.equal(player.claimLevelPrizes(wallet).ok,false);assert.equal(calls,0,'The event journal, not its untrusted total, proves the level');
 savedXP(disk,60950);
 const changingWallet={grantReward(id,amount){calls++;savedXP(disk,0);return {ok:true,amount};}};
 const interrupted=player.claimLevelPrizes(changingWallet);assert.equal(interrupted.ok,false);assert.equal(calls,1);assert.equal(interrupted.claimed.length,1);
 const thrown=progression.create({storage:disk,canRecord(){throw Error('unavailable');}});assert.equal(thrown.claimLevelPrizes(wallet).ok,false);
});
