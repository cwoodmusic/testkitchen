const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const D=require('../classroom-profile-data.js');
const Progress=require('../player-progression.js');
const Shop=require('../notes-shop.js');
const Fishing=require('../fishing-progress.js');
const Engine=require('../rhythm-fishing-engine.js');
const Lessons=require('../classroom-tutorials.js');

function storage(initial={}){
 const values=new Map(Object.entries(initial)),calls=[];let failure=null;
 return {values,calls,failNext(key,operation='set'){failure={key,operation};},
  getItem(key){calls.push(['get',key]);return values.has(key)?values.get(key):null;},
  setItem(key,value){calls.push(['set',key]);if(failure?.key===key&&failure.operation==='set'){failure=null;throw Error('quota');}values.set(key,String(value));},
  removeItem(key){calls.push(['remove',key]);if(failure?.key===key&&failure.operation==='remove'){failure=null;throw Error('blocked');}values.delete(key);}};
}
const clone=value=>JSON.parse(JSON.stringify(value));
const dump=store=>Object.fromEntries([...store.values].sort(([a],[b])=>a.localeCompare(b)));
function profile(){
 const data=D.blank(),ids=['quest:piano-lesson:twinkle','quest:piano-memory:twinkle','quest:piano-scale:c-major','quest:bach-triad-win','achievement:classroom-note-naming','fishing:catch-1'];
 data.progression.events=ids.map((id,index)=>({id,xp:index===4?50:index===5?8:100}));data.progression.xp=data.progression.events.reduce((sum,event)=>sum+event.xp,0);data.progression.bestPitchLevel=25;
 data.wallet={version:1,balance:284,earned:644,spent:360,owned:['witch','guitar','alien','cosmiccat'],rewards:['piano-lesson:twinkle','piano-memory:twinkle','piano-scale:c-major','npc-mission:bach-triad-win','fishing:catch-1']};
 Object.assign(data.avatar,{hairstyle:'mohawk',hair:'#c13f69',headwear:'witch',accessory:'guitar',form:'alien',pet:'cosmiccat',customized:true,walked:4312.5,jumps:14,emotesUsed:8,visited:[0,1,2,3]});
 data.avatar.gameStats.pitchCorrect=34;data.avatar.gameStats.seen=['pitch:run-1'];
 data.missions.missions['bach-triad-win']={acceptedAt:100,progress:1,completedAt:200,rewardedAt:300};data.missions.seen=['triad:run-1'];
 data.piano.learned=['twinkle'];data.piano.completed=['piano-lesson:twinkle','piano-memory:twinkle','piano-scale:c-major'];
 data.lessons.lessons['note-naming']={step:10,completed:true,completedAt:400};data.quizzes.quizzes['note-naming']={bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:400};
 data.fishing.catches=[{id:'catch-1',fishId:'silver-minnow',size:8.2,at:500,meter:'4/4',perfect:true,caught:true,rewarded:true,result:{id:'catch-1',fishId:'silver-minnow',rarity:'common',meter:'4/4',timeSignature:'4/4',hits:16,misses:0,extras:0,perfect:true,notes:4,xp:8,caught:true,outcome:'caught'}}];
 data.pitch.bestCompleted=25;data.pitchTutorials.completed=['treble','bass'];return data;
}

test('blank classroom profiles are bounded, private, and independent of guest state',()=>{
 const first=D.blank(),second=D.blank();assert.equal(D.validate(first).ok,true);assert.equal(first.progression.xp,0);assert.equal(first.wallet.balance,150);assert.equal(first.avatar.hairstyle,'bald');assert.equal(first.avatar.shirt,'#999ca6');
 first.wallet.rewards.push('something');assert.deepEqual(second.wallet.rewards,[]);
 assert.deepEqual(Object.keys(first),['avatar','progression','wallet','missions','fishing','piano','lessons','quizzes','pitch','pitchTutorials','finalExam']);
 assert.equal(D.SCOPED_KEYS.includes('codaPianoTakeV1'),true);assert.equal(Object.values(D.KEYS).includes('codaPianoTakeV1'),false);assert.equal(Object.keys(D.SCHEMA.properties).length,11);
 assert.ok(Object.isFrozen(D.SCHEMA));assert.ok(Object.isFrozen(D.SCHEMA.properties.avatar.properties));
});

test('all major/minor scale and memory rewards fit the closed piano journal and preserve old saves',()=>{
 const piano=require('../piano-lab.js'),scales=piano.SCALES.map(scale=>scale.id),schema=D.SCHEMA.properties.piano.properties.completed;
 assert.equal(scales.length,24);assert.equal(schema.maxItems,80);assert.equal(schema.items.enum.length,80);
 for(const id of scales)for(const prefix of ['piano-scale:','piano-scale-memory:'])assert.ok(schema.items.enum.includes(prefix+id));
 const saved=D.blank(),tokens=schema.items.enum;
 saved.piano.completed=[...tokens];saved.wallet.rewards=[...tokens];saved.wallet.balance=saved.wallet.earned=10000;
 saved.progression.events=tokens.map(id=>({id:'quest:'+id,xp:100}));
 saved.progression.events.push({id:'achievement:piano-memory-master',xp:250});
 saved.progression.xp=saved.progression.events.reduce((sum,event)=>sum+event.xp,0);
 const store=storage();assert.equal(D.validate(saved).ok,true);assert.equal(D.apply(store,saved).ok,true);
 assert.deepEqual(D.capture(store).data,saved);
 const missing=clone(saved);missing.progression.events=missing.progression.events.filter(event=>event.id!=='quest:piano-scale-memory:b-major');missing.progression.xp-=100;
 assert.equal(D.validate(missing).ok,false,'A memory reward still requires its saved XP proof');
 const unknown=clone(saved);unknown.piano.completed.push('piano-scale-memory:unlisted-key');assert.equal(D.validate(unknown).ok,false);
 const old=profile();delete old.lessons.lessons['major-minor-keys'];delete old.quizzes.quizzes['major-minor-keys'];
 const restored=D.validate(old);assert.equal(restored.ok,true,restored.error);assert.equal(restored.data.lessons.lessons['major-minor-keys'].step,0);
 assert.equal(restored.data.quizzes.quizzes['major-minor-keys'].index,0);
});

test('major/minor lesson completion needs the passing quiz and its own earned experience',()=>{
 const saved=D.blank(),id='major-minor-keys';
 saved.lessons.lessons[id]={step:8,completed:true,completedAt:400};
 saved.quizzes.quizzes[id]={bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:400};
 assert.equal(D.validate(saved).ok,false);
 saved.progression.events=[{id:'achievement:classroom-'+id,xp:50}];saved.progression.xp=50;
 assert.equal(D.validate(saved).ok,true);
 const wrong=clone(saved);wrong.quizzes.quizzes[id].answers=wrong.quizzes.quizzes[id].bestAnswers=[2,2,2,2,2];assert.equal(D.validate(wrong).ok,false);
 saved.lessons.lessons[id].studentName='Not permitted';assert.equal(D.validate(saved).ok,false);
});

test('a full avatar, currency, progression, missions, catches, lessons, and checkpoint round trip',()=>{
 const data=profile(),store=storage();assert.equal(D.validate(data).ok,true);assert.equal(D.apply(store,data).ok,true);
 const captured=D.capture(store);assert.equal(captured.ok,true,captured.error);assert.deepEqual(captured.data,data);
 const avatar=JSON.parse(store.getItem(D.KEYS.avatar));assert.equal(avatar.name,undefined);assert.equal(avatar.hairstyle,'mohawk');assert.equal(avatar.headwear,'witch');assert.equal(avatar.form,'alien');
 assert.equal(JSON.parse(store.getItem(D.KEYS.progression)).events[0].reason,'Arcade activity');assert.equal(captured.data.progression.events[0].reason,undefined);
});

test('every authored mission keeps its exact bounded target in the private cloud schema',()=>{
 const {DEFINITIONS}=require('../musician-missions.js');
 const schema=D.SCHEMA.properties.missions.properties.missions;
 const targets=Object.fromEntries(Object.entries(schema.properties).map(([id,value])=>[id,value.properties.progress.maximum]));
 assert.deepEqual(targets,Object.fromEntries(DEFINITIONS.map(mission=>[mission.id,mission.target])));
 assert.deepEqual(schema.required,[],'New mission fields are optional for existing profiles');
 assert.equal(Object.keys(targets).length,29);
 for(const value of Object.values(schema.properties))assert.deepEqual(Object.keys(value.properties),['acceptedAt','progress','completedAt','rewardedAt']);
});

test('new quest journals round trip without inventing entries in legacy saves',()=>{
 const legacy=profile(),before=clone(legacy),store=storage();
 assert.equal(D.validate(legacy).ok,true);assert.equal(D.apply(store,legacy).ok,true);assert.deepEqual(D.capture(store).data,before);
 const targets=D.SCHEMA.properties.missions.properties.missions.properties;
 const data=D.blank();
 for(const [id,value]of Object.entries(targets))data.missions.missions[id]={acceptedAt:100,progress:value.properties.progress.maximum,completedAt:200,rewardedAt:0};
 data.missions.seen=['fishing:catch-fixture','piano:melody-fixture','triad:match-fixture'];
 assert.equal(D.validate(data).ok,true);assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
 assert.deepEqual(D.blank().missions.missions,{},'New quest catalog entries are never silently accepted for a player');
 const bad=clone(data);bad.missions.missions['ella-fish-five'].progress=6;assert.equal(D.validate(bad).ok,false,'Each quest still uses its own bounded target');
 bad.missions.missions['ella-fish-five'].progress=5;bad.missions.missions['miles-fish-legendary'].privateName='Child';assert.equal(D.validate(bad).ok,false,'Mission journals remain closed records');
});

test('new mission rewards retain Notes and experience replay protection across profile restore',()=>{
 const data=D.blank(),id='miles-fish-legendary',paid='npc-mission:'+id,xp='quest:'+id;
 data.missions.missions[id]={acceptedAt:100,progress:1,completedAt:200,rewardedAt:300};
 assert.equal(D.validate(data).ok,false,'A collected quest cannot omit its reward journals');
 data.wallet.rewards=[paid];data.wallet.balance=650;data.wallet.earned=650;assert.equal(D.validate(data).ok,false,'Notes alone cannot invent a new quest XP award');
 data.progression.events=[{id:xp,xp:100}];data.progression.xp=100;
 const store=storage();assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
 const wallet=Shop.createWallet({storage:store,getAvatar:()=>JSON.parse(store.getItem(D.KEYS.avatar))}),progress=Progress.create({storage:store});
 assert.equal(wallet.grantReward(paid,500).alreadyClaimed,true);assert.equal(progress.recordQuest(id).alreadyAwarded,true);
 assert.equal(wallet.snapshot().balance,650);assert.equal(progress.getState().xp,100);
});

function levelProfile(xp){
 const data=D.blank();data.progression.xp=xp;
 for(let remaining=xp,index=0;remaining>0;index++){const amount=Math.min(1000,remaining);data.progression.events.push({id:'game:earned-level-fixture:'+index,xp:amount});remaining-=amount;}
 return data;
}

test('every level Notes prize requires its exact earned threshold without awarding extra experience',()=>{
 assert.equal(Progress.THRESHOLDS.length,50);assert.equal(Progress.LEVEL_NOTES.length,39);
 const ids=new Set();
 for(const prize of Progress.LEVEL_NOTES){
  assert.equal(prize.id,'level-prize:'+prize.level);assert.equal(ids.has(prize.id),false);ids.add(prize.id);
  const threshold=Progress.THRESHOLDS[prize.level-1],data=levelProfile(threshold);
  data.wallet.rewards=[prize.id];data.wallet.earned=150+prize.amount;data.wallet.balance=150+prize.amount;
  const valid=D.validate(data);assert.equal(valid.ok,true,prize.id+': '+valid.error);assert.deepEqual(valid.data,data);
  const locked=levelProfile(threshold-1);locked.wallet=clone(data.wallet);assert.equal(D.validate(locked).ok,false,prize.id+' cannot be claimed one XP early');
  const short=clone(data);short.wallet.earned=prize.amount-1;assert.equal(D.validate(short).ok,false,prize.id+' retains its exact fixed Notes amount');
  const store=storage();assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
  assert.equal(data.progression.events.some(event=>event.id.includes('level-prize:')),false,'Currency prizes never create experience events');
 }
 for(const level of [10,...Array.from({length:38},(_,index)=>index+13)])assert.equal(ids.has('level-prize:'+level),true,'Every intended payout is checked');
});

test('level prize journals reject invented IDs and underfunded combined payouts while preserving old saves',()=>{
 const existing=profile();assert.equal(D.validate(existing).ok,true,'No level prize is silently added to a legacy profile');
 for(const id of ['level-prize:','level-prize:1','level-prize:9','level-prize:11','level-prize:12','level-prize:51','level-prize:010','level-prize:20:again']){
  const data=levelProfile(Progress.THRESHOLDS.at(-1));data.wallet.rewards=[id];data.wallet.earned=100000;
  assert.equal(D.validate(data).ok,false,id+' is not an authored payout');
 }
 const data=levelProfile(Progress.THRESHOLDS.at(-1)),sum=Progress.LEVEL_NOTES.reduce((total,prize)=>total+prize.amount,0);
 data.wallet.rewards=Progress.LEVEL_NOTES.map(prize=>prize.id);data.wallet.earned=sum;data.wallet.spent=sum;data.wallet.balance=0;
 assert.equal(D.validate(data).ok,true,'Previously valid wallets need not prove an assumed starting balance');
 data.wallet.earned=sum-1;assert.equal(D.validate(data).ok,false,'The same earned Notes cannot fund multiple fixed prizes twice');
});

test('sanitization strips personal prose, developer state, and recordings at every level',()=>{
 const raw=profile();Object.assign(raw,{name:'A Child',email:'child@example.test',songs:{title:'My private song'},dialogue:{secret:'class notes'},worldProject:{assets:[]},hallOfFame:{score:99999}});
 Object.assign(raw.avatar,{name:'A Child',nickname:'Little One',email:'child@example.test',birthdate:'2016-01-01',dialogue:'my address',editor:{layers:[]}});
 raw.progression.events[0].reason='A Child won a prize';raw.fishing.catches[0].result.fish={name:'Private nickname',image:'https://example.test/name'};raw.piano.recording=[{midi:60}];
 const result=D.sanitize(raw);assert.equal(result.ok,true,result.error);const text=JSON.stringify(result.data);for(const phrase of ['A Child','Little One','child@example','2016-01','my address','worldProject','hallOfFame','recording','My private song','Private nickname'])assert.equal(text.includes(phrase),false,phrase);
 assert.equal(D.validate(raw).ok,false,'Strict validation rejects fields not in the closed cloud schema');assert.deepEqual(result.data,profile());
});

test('experience is recomputed from stable ids and no equipment alone can create ownership',()=>{
 const raw=D.blank();raw.progression.xp=20000000;raw.avatar.headwear='celestialcrown';raw.avatar.accessory='guitar';raw.avatar.form='alien';raw.avatar.pet='neondragon';
 const result=D.sanitize(raw);assert.equal(result.ok,true);assert.equal(result.data.progression.xp,0);assert.equal(result.data.avatar.headwear,'none');assert.equal(result.data.avatar.accessory,'none');assert.equal(result.data.avatar.form,'human');assert.equal(result.data.avatar.pet,'none');assert.deepEqual(result.data.wallet.owned,[]);assert.equal(D.validate(raw).ok,false);
 const valid=profile();assert.deepEqual(D.sanitize(valid).data,valid,'Saved owned cosmetics must remain equipped');
 const long='game:pitch:'+'x'.repeat(128);valid.progression.events.push({id:long,xp:5});valid.progression.xp+=5;assert.equal(D.sanitize(valid).data.progression.events.at(-1).id,long);
});

test('DJ dance gear survives a classroom save and restore from its earned achievements without purchases',()=>{
 const data=D.blank(),store=storage();
 Object.assign(data.avatar,{eyewear:'shutter',shoes:'rollerskates',accessory:'boombox'});
 data.progression.events=[
  {id:'achievement:dance-twenty-streak',xp:100},
  {id:'achievement:dance-perfect-set',xp:150},
  {id:'achievement:dance-hard-perfect',xp:250}
 ];
 data.progression.xp=500;
 assert.deepEqual(data.wallet.owned,[]);
 const validated=D.validate(data);assert.equal(validated.ok,true,validated.error);assert.deepEqual(validated.data,data);
 assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
 assert.deepEqual(JSON.parse(store.getItem(D.KEYS.wallet)).owned,[],'Earning gear never invents a purchase');
});

test('unearned and unowned DJ dance gear resets to the existing player defaults',()=>{
 const data=D.blank();Object.assign(data.avatar,{eyewear:'shutter',shoes:'rollerskates',accessory:'boombox'});
 const clean=D.sanitize(data);assert.equal(clean.ok,true,clean.error);
 for(const slot of ['eyewear','shoes','accessory'])assert.equal(clean.data.avatar[slot],D.blank().avatar[slot],slot);
 assert.deepEqual(clean.data.progression.events,[]);assert.deepEqual(clean.data.wallet.owned,[]);
});

test('previously purchased DJ dance gear stays equipped without its dance achievements',()=>{
 const data=D.blank(),store=storage();
 Object.assign(data.avatar,{eyewear:'shutter',shoes:'rollerskates',accessory:'boombox'});
 data.wallet.owned=['shutter','rollerskates','boombox'];
 assert.deepEqual(data.progression.events,[]);
 assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
});

test('applying a student replaces every scoped store and leaves unrelated guest work intact',()=>{
 const guest=storage({'musicArcadeV1':'{"name":"Guest work","walked":33}','codaPianoTakeV1':'[{"midi":60,"at":0,"duration":1}]','codaWorldProjectV1':'EXACT editor bytes','unrelated-account':'untouched','codaHallOfFameV1':'scores'}),before=dump(guest),backup=D.backup(guest);
 assert.equal(D.apply(guest,profile()).ok,true);assert.equal(guest.getItem('codaPianoTakeV1'),null);assert.equal(guest.getItem('codaWorldProjectV1'),'EXACT editor bytes');assert.equal(guest.getItem('unrelated-account'),'untouched');assert.equal(guest.getItem('codaHallOfFameV1'),null);
 assert.equal(D.apply(guest,D.blank()).ok,true);const second=D.capture(guest).data;assert.deepEqual(second,D.blank(),'A second student must not inherit any first-student progress');
 assert.equal(D.restore(guest,backup).ok,true);assert.deepEqual(dump(guest),before,'Leaving classroom play must recover exact raw guest data, including freeform local work');
 assert.equal(D.sanitize(backup).ok,false,'Raw backups are never a cloud DTO');
});

test('local compositions, named Hall records and practice history never sync or cross student profiles',()=>{
 const privateValues={codaPianoTakeV1:'[{"midi":64,"at":0,"duration":1}]',codaDJLibraryV1:'[{"title":"Private family song","composition":{"tracks":[]}}]',codaHallOfFameV1:'{"version":1,"records":{"pitch":{"name":"Private learner","score":90}}}','rhythm-room-practice-v1':'[{"total":16,"hits":12,"missed":4}]'};
 const store=storage(privateValues),before=dump(store),saved=D.backup(store),captured=D.capture(store);
 assert.equal(captured.ok,true);assert.deepEqual(captured.data,D.blank());const uploaded=JSON.stringify(captured.data);for(const key of Object.keys(privateValues))assert.equal(uploaded.includes(key),false);assert.equal(uploaded.includes('Private'),false);
 assert.equal(D.apply(store,D.blank()).ok,true);for(const key of Object.keys(privateValues))assert.equal(store.getItem(key),null,key+' must be empty for a new student');
 store.setItem('codaDJLibraryV1','student A private song');store.setItem('codaHallOfFameV1','student A private scores');assert.equal(D.apply(store,D.blank()).ok,true);for(const key of Object.keys(privateValues))assert.equal(store.getItem(key),null,key+' must not cross from student A to B');
 assert.equal(D.restore(store,saved).ok,true);assert.deepEqual(dump(store),before,'Guest names, compositions, recordings and practice history return byte for byte');
 const hall=require('../hall-of-fame.js');assert.ok(D.LOCAL_ONLY_KEYS.includes(hall.KEY));
});

test('a failed write or removal rolls back all prior changes in the profile transaction',()=>{
 for(const method of ['apply','clear','restore']){
  const original=storage(Object.fromEntries(D.SCOPED_KEYS.map((key,index)=>[key,'old-'+index]))),before=dump(original),saved=D.backup(storage(Object.fromEntries(D.SCOPED_KEYS.map((key,index)=>[key,'new-'+index]))));
  original.failNext(D.SCOPED_KEYS[5],method==='clear'?'remove':'set');const result=method==='apply'?D.apply(original,profile()):method==='clear'?D.clear(original):D.restore(original,saved);
  assert.equal(result.ok,false,method);assert.equal(result.rolledBack,true,method);assert.deepEqual(dump(original),before,method+' must restore every exact old value');
 }
 const store=storage({'unrelated':'keep'});assert.equal(D.clear(store).ok,true);assert.equal(store.getItem('unrelated'),'keep');
 const invalid=D.blank();invalid.wallet.balance=-1;const before=dump(store);assert.equal(D.apply(store,invalid).ok,false);assert.deepEqual(dump(store),before);
});

test('the restored real reward engines refuse duplicate XP, Notes, quests, catches, and lesson rewards',()=>{
 const store=storage();assert.equal(D.apply(store,profile()).ok,true);const progression=Progress.create({storage:store}),wallet=Shop.createWallet({storage:store,getAvatar:()=>JSON.parse(store.getItem(D.KEYS.avatar))}),xp=progression.getState().xp,balance=wallet.snapshot().balance;
 assert.equal(progression.recordQuest('piano-lesson:twinkle').alreadyAwarded,true);assert.equal(progression.recordPianoMemory('twinkle').alreadyAwarded,true);assert.equal(progression.awardXP('achievement:classroom-note-naming',50,'Learned notes').alreadyAwarded,true);
 for(const id of profile().wallet.rewards)assert.equal(wallet.grantReward(id,100).alreadyClaimed,true,id);
 const catches=JSON.parse(store.getItem(D.KEYS.fishing)).catches,fishing=Fishing.create({catalog:Engine.FISH,wallet,progression,getCatches:()=>catches});
 // Include the first-catch/perfect milestones that the original catch paid.
 progression.recordAchievement('fishing-first-catch');progression.recordAchievement('fishing-perfect-catch');const beforeFishing=progression.getState().xp;
 assert.equal(fishing.reward('silver-minnow',catches[0].result).alreadyClaimed,true);assert.equal(progression.getState().xp,beforeFishing);assert.equal(wallet.snapshot().balance,balance);assert.equal(progression.getState().events,undefined);
 assert.equal(Lessons.readProgress(store).completed.includes('note-naming'),true);assert.equal(xp,profile().progression.xp);
});

test('inconsistent reward ledgers are rejected rather than inventing or dropping a payment',()=>{
 for(const mutate of [
  data=>{data.progression.events=data.progression.events.filter(event=>event.id!=='quest:piano-lesson:twinkle');},
  data=>{data.wallet.rewards=data.wallet.rewards.filter(id=>id!=='npc-mission:bach-triad-win');},
  data=>{data.wallet.rewards=data.wallet.rewards.filter(id=>id!=='fishing:catch-1');},
  data=>{data.progression.events=data.progression.events.filter(event=>event.id!=='fishing:catch-1');},
  data=>{data.quizzes.quizzes['note-naming'].answers=[2,2,0,1,0];data.quizzes.quizzes['note-naming'].bestAnswers=[];},
  data=>{data.progression.events=data.progression.events.filter(event=>event.id!=='achievement:classroom-note-naming');}
 ]){const data=profile();mutate(data);data.progression.xp=data.progression.events.reduce((sum,event)=>sum+event.xp,0);const store=storage({'musicArcadeV1':'guest'}),before=dump(store);assert.equal(D.sanitize(data).ok,false);assert.equal(D.apply(store,data).ok,false);assert.deepEqual(dump(store),before);}
 const pending=profile();pending.fishing.catches[0].rewarded=false;pending.wallet.rewards=pending.wallet.rewards.filter(id=>id!=='fishing:catch-1');pending.progression.events=pending.progression.events.filter(event=>event.id!=='fishing:catch-1');pending.progression.xp-=8;assert.equal(D.validate(pending).ok,true,'A saved catch awaiting an explicit reward retry is valid');
});

test('unknown paid startup-repair prefixes cannot create quest XP when a profile is restored',()=>{
 for(const token of ['npc-mission:retired-mission','npc-mission:','piano-lesson:retired-melody','piano-interval:retired-interval','piano-scale:retired-scale']){
  const data=D.blank();data.wallet.rewards=[token];const store=storage({'unrelated':'guest work'}),before=dump(store);
  assert.equal(D.sanitize(data).ok,false,token);assert.equal(D.validate(data).ok,false,token);assert.equal(D.apply(store,data).ok,false,token);assert.deepEqual(dump(store),before);
  const expected=token.startsWith('npc-mission:')?'quest:'+token.slice('npc-mission:'.length):'quest:'+token;
  data.progression.events=[{id:expected,xp:100}];data.progression.xp=100;
  assert.equal(D.apply(store,data).ok,true,token+' with an existing stable XP record remains recoverable');
  const captured=D.capture(store);assert.equal(captured.ok,true);assert.deepEqual(captured.data.wallet.rewards,[token],'Retired paid IDs must never be discarded');
  const progression=Progress.create({storage:store});const result=progression.recordQuest(token.startsWith('npc-mission:')?token.slice('npc-mission:'.length):token);
  assert.equal(result.alreadyAwarded,true);assert.equal(progression.getState().xp,100,'The real startup repair must be a no-op');
 }
});

test('a complete memory-quest chain requires its mastery XP record before restore',()=>{
 const data=D.blank();data.wallet.rewards=['piano-memory:twinkle'];data.progression.events=Progress.PIANO_MEMORIES.map(id=>({id:'quest:piano-memory:'+id,xp:100}));data.progression.xp=900;
 const store=storage({'unrelated':'guest work'}),before=dump(store);assert.equal(D.sanitize(data).ok,false);assert.equal(D.validate(data).ok,false);assert.equal(D.apply(store,data).ok,false);assert.deepEqual(dump(store),before);
 data.progression.events.push({id:'achievement:piano-memory-master',xp:250});data.progression.xp+=250;
 assert.equal(D.apply(store,data).ok,true);const progression=Progress.create({storage:store});
 for(const id of Progress.PIANO_MEMORIES)assert.equal(progression.recordPianoMemory(id).alreadyAwarded,true);
 assert.equal(progression.getState().xp,1150,'Startup must not award another mastery prize');
 assert.deepEqual(D.capture(store).data.progression.events,data.progression.events,'Every quest and mastery replay-protection ID remains intact');
});

test('present damaged or unsupported local saves fail capture without changing any bytes',()=>{
 for(const [slot,value]of [['wallet','not json'],['wallet',JSON.stringify({...profile().wallet,version:9})],['wallet',JSON.stringify({...profile().wallet,balance:'100'})],['progression',JSON.stringify({...profile().progression,xp:99999})],['fishing',JSON.stringify({version:1,catches:[{id:'broken'}]})],['piano',JSON.stringify({learned:['unknown-tune'],completed:[]})]]){
  const store=storage({[D.KEYS[slot]]:value}),before=dump(store);const result=D.capture(store);assert.equal(result.ok,false,slot);assert.match(result.error,/invalid|damaged|unsupported|read safely/);assert.deepEqual(dump(store),before);
 }
 const absent=D.capture(storage());assert.equal(absent.ok,true);assert.deepEqual(absent.data,D.blank());
});

test('size limits never truncate replay-protection journals and a Firebase empty-list round trip is valid',()=>{
 const tooMany=D.blank();tooMany.wallet.rewards=Array.from({length:4097},(_,index)=>'game:pitch:'+index);assert.equal(D.sanitize(tooMany).ok,false);assert.match(D.sanitize(tooMany).error,/no entries were discarded/);
 const huge=D.blank();huge.progression.events=Array.from({length:17000},(_,index)=>({id:'game:pitch:'+String(index).padStart(5,'0')+'-'+'x'.repeat(490),xp:1}));huge.progression.xp=17000;assert.equal(D.sanitize(huge).ok,false);assert.match(D.sanitize(huge).error,/8 MiB/);
 function firebase(value){if(Array.isArray(value))return value.length?value.map(firebase):undefined;if(value&&typeof value==='object'){const entries=Object.entries(value).map(([key,item])=>[key,firebase(item)]).filter(([,item])=>item!==undefined);return entries.length?Object.fromEntries(entries):undefined;}return value;}
 const roundtrip=firebase(D.blank());const checked=D.validate(roundtrip);assert.equal(checked.ok,true,checked.error);assert.deepEqual(checked.data,D.blank());
});

test('the standalone browser module has the same schema, defaults, and API as Node',()=>{
 const context={window:{},TextEncoder};vm.runInNewContext(fs.readFileSync(require.resolve('../classroom-profile-data.js'),'utf8'),context);const browser=context.window.CodaClassroomProfileData;
 assert.equal(browser.validate(browser.blank()).ok,true);assert.equal(JSON.stringify(browser.SCHEMA),JSON.stringify(D.SCHEMA));assert.deepEqual(Object.keys(browser).sort(),Object.keys(D).sort());
 const polluted=JSON.parse('{"__proto__":{"name":"secret"},"avatar":{"__proto__":{"email":"secret"}}}');const clean=browser.sanitize(polluted);assert.equal(clean.ok,true);assert.equal(JSON.stringify(clean.data).includes('secret'),false);assert.equal({}.name,undefined);
});

test('the cloud cosmetic enums preserve every current renderer choice',()=>{
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../character-renderer.js'),'utf8'),sandbox);const renderer=sandbox.window.createCodaCharacterRenderer();
 for(const [slot,group]of Object.entries({hairstyle:'hairstyles',outfit:'outfits',headwear:'headwear',eyewear:'eyewear',accessory:'accessories',shoes:'shoes',emote:'emotes',form:'forms',pet:'pets'}))assert.deepEqual([...D.SCHEMA.properties.avatar.properties[slot].enum].sort(),Array.from(renderer.catalog[group],item=>item.id).sort(),slot+' must not silently discard a saved customization');
});


test('Dynamics and Tempo lessons and quizzes use their exact completion and XP records',()=>{
 for(const [id,answers]of Object.entries({dynamics:[0,1,2,0,1],tempo:[1,0,2,1,0]})){
  const data=D.blank();data.lessons.lessons[id]={step:8,completed:true,completedAt:400};
  data.quizzes.quizzes[id]={bankVersion:1,index:5,answers:[...answers],bestAnswers:[...answers],completedAt:400};
  assert.equal(D.validate(data).ok,false,'Completion needs the earned XP journal');
  data.progression.events=[{id:'achievement:classroom-'+id,xp:50}];data.progression.xp=50;
  assert.equal(D.validate(data).ok,true);const store=storage();assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
  const wrong=clone(data);wrong.quizzes.quizzes[id].answers=wrong.quizzes.quizzes[id].bestAnswers=answers.map(answer=>(answer+1)%3);assert.equal(D.validate(wrong).ok,false);
  const beyond=clone(data);beyond.lessons.lessons[id].step=9;assert.equal(D.validate(beyond).ok,false);
 }
 const old=profile();delete old.finalExam;for(const id of ['dynamics','tempo']){delete old.lessons.lessons[id];delete old.quizzes.quizzes[id];}
 const result=D.validate(old);assert.equal(result.ok,true,result.error);
 for(const id of ['dynamics','tempo']){assert.deepEqual(result.data.lessons.lessons[id],{step:0,completed:false,completedAt:0});assert.deepEqual(result.data.quizzes.quizzes[id],{bankVersion:1,index:0,answers:[],bestAnswers:[],completedAt:0});}
});

const EXAM_CATEGORIES=['note-naming','bass-clef','grand-staff','rhythm-tree','time-signatures','major-minor-keys','dynamics','tempo'];
function activeExam(size=40){const exam=D.blank().finalExam;exam.size=size;exam.questionIds=EXAM_CATEGORIES.flatMap(id=>Array.from({length:size/8},(_,index)=>id+'-'+String(index+1).padStart(3,'0')));exam.orders=exam.questionIds.map((_,index)=>index%6);exam.answers=exam.questionIds.map(()=>-1);return exam;}
function bestExam(){const exam=activeExam();exam.answers.fill(0);exam.index=40;exam.submitted=true;exam.attempts=1;exam.bestPercent=80;exam.bestScore=32;exam.bestTotal=40;exam.bestByCategory=Object.fromEntries(EXAM_CATEGORIES.map(id=>[id,{correct:4,total:5}]));return exam;}

test('final exam is optional for old clouds while every original DTO slot remains required',()=>{
 const old=D.blank();delete old.finalExam;const result=D.validate(old);assert.equal(result.ok,true,result.error);assert.deepEqual(result.data.finalExam,D.blank().finalExam);
 assert.deepEqual(D.SCHEMA.required,Object.keys(D.KEYS).filter(key=>key!=='finalExam'));
 for(const key of D.SCHEMA.required){const incomplete=clone(old);delete incomplete[key];assert.equal(D.validate(incomplete).ok,false,key+' remains required');}
 const engine=require('../final-exam.js');assert.equal(D.KEYS.finalExam,engine.KEY);assert.deepEqual(D.blank().finalExam,engine.getDefaults());
 const absentLists=D.blank();delete absentLists.finalExam.questionIds;delete absentLists.finalExam.orders;delete absentLists.finalExam.answers;
 assert.deepEqual(D.validate(absentLists).data.finalExam,D.blank().finalExam,'Firebase empty lists return as blank lists');
});

test('the bounded final exam preserves every balanced active answer and shuffled choice order',()=>{
 const schema=D.SCHEMA.properties.finalExam,ids=schema.properties.questionIds.items.enum;
 assert.equal(ids.length,800);assert.equal(new Set(ids).size,800);
 assert.deepEqual(ids,EXAM_CATEGORIES.flatMap(category=>Array.from({length:100},(_,index)=>category+'-'+String(index+1).padStart(3,'0'))));
 for(const size of [24,40,80]){
  const data=D.blank();data.finalExam=activeExam(size);data.finalExam.answers[0]=2;data.finalExam.index=size-1;
  assert.equal(D.validate(data).ok,true);const store=storage();assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
  assert.equal(require('../final-exam.js').validateState(data.finalExam,{getQuestion:id=>({id,category:id.slice(0,-4),prompt:'Test only',choices:[{id:'a',text:'a'},{id:'b',text:'b'},{id:'c',text:'c'}],answer:'a'})}).ok,true,'Engine and DTO accept the same state shape');
 }
});

test('final exam rejects unknown/private fields, invalid IDs, unbalanced sets, and mismatched progress without rewriting local bytes',()=>{
 const mutations=[
  exam=>{exam.studentName='Private name';},exam=>{exam.bankVersion=2;},exam=>{exam.size=32;},exam=>{exam.questionIds[0]='note-naming-101';},
  exam=>{exam.questionIds[0]='note-naming-000';},exam=>{exam.questionIds[0]='note-naming-1';},exam=>{exam.questionIds[0]='private-free-text-001';},
  exam=>{exam.questionIds[1]=exam.questionIds[0];},exam=>{exam.questionIds[0]='tempo-100';},exam=>{exam.questionIds.pop();},
  exam=>{exam.orders[0]=6;},exam=>{exam.answers[0]=3;},exam=>{exam.answers[0]=-2;},exam=>{exam.orders.pop();},exam=>{exam.answers.pop();},
  exam=>{exam.index=40;},exam=>{exam.submitted=true;exam.index=40;},exam=>{exam.attempts=100001;},exam=>{exam.completedAt=1;},
  exam=>{exam.bestByCategory.tempo.correct=1;},exam=>{exam.bestPercent=80;},exam=>{exam.bestTotal=20;},exam=>{exam.bestByCategory.dynamics.email='Private';},
 ];
 for(const mutate of mutations){
  const data=D.blank();data.finalExam=activeExam();mutate(data.finalExam);const store=storage({[D.KEYS.finalExam]:JSON.stringify(data.finalExam),'unrelated':'guest work'}),before=dump(store);
  assert.equal(D.validate(data).ok,false,JSON.stringify(data.finalExam));assert.equal(D.sanitize(data).ok,false);assert.equal(D.capture(store).ok,false);assert.equal(D.apply(store,data).ok,false);assert.deepEqual(dump(store),before);
 }
});

test('final exam summaries stay consistent and completion only restores after its exact saved XP reward',()=>{
 const data=D.blank();data.finalExam=bestExam();assert.equal(D.validate(data).ok,true,'A passing result may await its one-time reward');
 const store=storage();assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
 data.progression.events=[{id:'achievement:haydn-final-exam',xp:200}];data.progression.xp=200;assert.equal(D.validate(data).ok,true,'XP-first save must be accepted before completedAt is written');
 data.finalExam.completedAt=600;assert.equal(D.validate(data).ok,true);assert.equal(D.apply(store,data).ok,true);assert.deepEqual(D.capture(store).data,data);
 const progression=Progress.create({storage:store});assert.equal(progression.recordAchievement('haydn-final-exam').alreadyAwarded,true);assert.equal(progression.getState().xp,200,'Restore cannot mint another exam reward');
 for(const mutate of [
  saved=>{saved.progression.events=[];saved.progression.xp=0;},saved=>{saved.progression.events[0].xp=199;saved.progression.xp=199;},
  saved=>{saved.finalExam.bestPercent=81;},saved=>{saved.finalExam.bestScore=31;saved.finalExam.bestPercent=78;saved.finalExam.bestByCategory.tempo.correct=3;},
  saved=>{saved.finalExam.bestByCategory.tempo.total=4;},saved=>{saved.finalExam.bestByCategory.tempo.correct=3;},saved=>{saved.finalExam.answers[0]=-1;},
 ]){const invalid=clone(data);mutate(invalid);assert.equal(D.validate(invalid).ok,false);}
});

test('new exam and browser-only Song Machine drafts cannot cross profiles and old backups still restore',()=>{
 const draft='Private song title and notes',exam=JSON.stringify(activeExam()),store=storage({[D.KEYS.finalExam]:exam,codaSongMachineDraftV1:draft,'unrelated':'guest work'}),before=dump(store),saved=D.backup(store);
 assert.ok(D.LOCAL_ONLY_KEYS.includes('codaSongMachineDraftV1'));assert.equal(Object.values(D.KEYS).includes('codaSongMachineDraftV1'),false);
 assert.equal(D.apply(store,D.blank()).ok,true);assert.equal(store.getItem('codaSongMachineDraftV1'),null);assert.deepEqual(JSON.parse(store.getItem(D.KEYS.finalExam)),D.blank().finalExam);
 store.setItem('codaSongMachineDraftV1','Student A private draft');store.setItem(D.KEYS.finalExam,exam);const captured=D.capture(store);assert.equal(captured.ok,true);assert.equal(JSON.stringify(captured.data).includes('Student A'),false);
 assert.equal(D.apply(store,D.blank()).ok,true);assert.equal(store.getItem('codaSongMachineDraftV1'),null);assert.deepEqual(JSON.parse(store.getItem(D.KEYS.finalExam)),D.blank().finalExam);
 assert.equal(D.restore(store,saved).ok,true);assert.deepEqual(dump(store),before);
 const old=clone(saved);delete old.values[D.KEYS.finalExam];delete old.values.codaSongMachineDraftV1;
 assert.equal(D.restore(store,old).ok,true);assert.equal(store.getItem(D.KEYS.finalExam),null);assert.equal(store.getItem('codaSongMachineDraftV1'),null);
 const incomplete=clone(old);delete incomplete.values[D.KEYS.wallet];assert.equal(D.restore(store,incomplete).ok,false,'Original scoped backup fields remain required');
 const extra=clone(old);extra.values.email='private';assert.equal(D.restore(store,extra).ok,false);
 for(const key of [D.KEYS.finalExam,'codaSongMachineDraftV1']){const failing=storage(Object.fromEntries(D.SCOPED_KEYS.map(key=>[key,'original '+key]))),prior=dump(failing);failing.failNext(key,key==='codaSongMachineDraftV1'?'remove':'set');assert.equal(D.apply(failing,D.blank()).ok,false);assert.deepEqual(dump(failing),prior);}
});

test('authored assessments and exam study follow player isolation while teaching configuration stays on the device',()=>{
 const keys=['codaAuthoredExamSessionV1','codaAuthoredQuizzesV1','codaAuthoredLessonsV1','codaClassroomExamStudyV1','codaClassroomLearningPathsV1'];
 const authorKey='codaEducationContentDraftV1',original=Object.fromEntries(keys.map(key=>[key,'guest attempt '+key]));
 original[authorKey]='teacher content';const store=storage(original),saved=D.backup(store);
 for(const key of keys){assert.ok(D.LOCAL_ONLY_KEYS.includes(key));assert.ok(D.SCOPED_KEYS.includes(key));assert.ok(!Object.values(D.KEYS).includes(key));}
 assert.ok(!D.SCOPED_KEYS.includes(authorKey));
 assert.equal(D.apply(store,D.blank()).ok,true);
 for(const key of keys)assert.equal(store.getItem(key),null);
 assert.equal(store.getItem(authorKey),'teacher content');
 for(const key of keys)store.setItem(key,'student-private attempt');
 const captured=D.capture(store);assert.equal(captured.ok,true);assert.ok(!JSON.stringify(captured.data).includes('student-private'));
 assert.equal(D.restore(store,saved).ok,true);for(const key of keys)assert.equal(store.getItem(key),original[key]);
 const older=clone(saved);for(const key of keys)delete older.values[key];
 assert.equal(D.restore(store,older).ok,true);for(const key of keys)assert.equal(store.getItem(key),null);
 for(const key of keys){const failing=storage(Object.fromEntries(D.SCOPED_KEYS.map(slot=>[slot,'previous '+slot]))),prior=dump(failing);failing.failNext(key,'remove');assert.equal(D.apply(failing,D.blank()).ok,false);assert.deepEqual(dump(failing),prior);}
});
