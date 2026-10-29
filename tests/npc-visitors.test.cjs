const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const catalog=require('../npc-visitors.js');

function setup(options={}){
 const sandbox=vm.createContext({window:{}});
 for(const file of ['npc-visitors.js','npc-behavior.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),sandbox);
 const cast=sandbox.window.CodaMusicianCast;
 const npcs=options.npcs||cast.map(person=>({...person,x:1450,y:752}));
 const owned=new Set(options.owned||[]);let missions=options.missions||[],blocked=false;
 const entrance=options.entrance||{x:1450,y:752};
 const inside=(x,y)=>x>=0&&y>=0&&x<1672&&y<941&&(!blocked||Math.hypot(x-entrance.x,y-entrance.y)>100);
 const calls=[];
 const engine=sandbox.window.createCodaNPCBehavior({npcs,rotation:true,maxVisitors:6,visitDuration:options.visitDuration||2,entryInterval:.5,random:()=>options.random||0,inside,
  route:(...points)=>{calls.push(points);return options.route?options.route(...points):[{x:points[2],y:points[3]}];},
  getEntrance:()=>entrance,isUnlocked:id=>owned.has(id),getMissions:()=>missions,getGames:()=>[0,1,2,3].map(index=>({index,name:'Cabinet '+index,npcX:720+index*110,npcY:323})),getPlayer:()=>({x:-9999,y:-9999}),isPinned:options.isPinned,isOffscreen:options.isOffscreen});
 return{engine,npcs,owned,entrance,calls,inside,setMissions:value=>missions=value,blockEntrance:value=>blocked=value,cast};
}
function run(engine,seconds,observe){for(let time=0;time<seconds;time+=.1){engine.update(.1);observe?.();}}

test('three original invitations have distinct identities, appearances and stable shop ids',()=>{
 assert.equal(catalog.profiles.length,3);assert.equal(catalog.catalog.length,3);
 assert.deepEqual(catalog.catalog.map(item=>item.price),[6000,8000,10000]);
 assert.deepEqual(catalog.profiles.map(profile=>profile.appearance.form),['tv','alien','robot']);
 for(const item of catalog.catalog){assert.equal(item.slot,'visitor');assert.equal(catalog.get(item.actorId),item);assert.equal(catalog.get(item.id),item);assert.ok(item.description.length>70);}
 assert.equal(new Set(catalog.profiles.flatMap(profile=>profile.greetings)).size,6);
 assert.ok(Object.isFrozen(catalog)&&Object.isFrozen(catalog.profiles[0].appearance));
});

test('locked invitations stay absent while historical visitors rotate through the real entrance',()=>{
 const env=setup(),seen=new Set(env.npcs.filter(p=>!p.hidden).map(p=>p.id)),previous=new Map(env.npcs.map(p=>[p.id,{x:p.x,y:p.y,hidden:p.hidden}]));let arrivals=0,departures=0;
 assert.equal(env.cast.length,15);assert.equal(seen.size,6);
 run(env.engine,180,()=>{
  assert.ok(env.npcs.filter(p=>!p.hidden).length<=6);
  for(const p of env.npcs){
   const before=previous.get(p.id);
   if(p.unlockItem){assert.equal(p.hidden,true);assert.equal(env.engine.beginConversation(p),null);}
   if(!p.hidden){seen.add(p.id);assert.equal(env.inside(p.x,p.y),true);}
   if(before.hidden&&!p.hidden){arrivals++;assert.ok(Math.hypot(p.x-env.entrance.x,p.y-env.entrance.y)<=86,'Arrivals start at the arcade entrance');}
   if(!before.hidden&&p.hidden){departures++;assert.ok(Math.hypot(p.x-env.entrance.x,p.y-env.entrance.y)<=86,'A visitor walks out before disappearing');}
   if(!before.hidden&&!p.hidden)assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=10,'Visible visitors never teleport across the room');
   previous.set(p.id,{x:p.x,y:p.y,hidden:p.hidden});
  }
 });
 assert.ok(arrivals>=3&&departures>=3,'The roster should visibly change during a visit');
 assert.equal(seen.size,12,'All historical musicians get a turn');
});

test('buying an invitation brings its original visitor through the doorway and retains ownership on recreation',()=>{
 const env=setup(),vee=env.npcs.find(p=>p.id==='vee-jay');assert.equal(vee.hidden,true);
 env.owned.add('visitor-vee-jay');let entered=false;
 run(env.engine,65,()=>{if(!vee.hidden)entered=true;});assert.equal(entered,true);
 assert.equal(env.engine.snapshot().find(p=>p.id==='vee-jay').unlocked,true);
 assert.equal(vee.appearance.form,'tv');assert.match(env.engine.say(vee,'music'),/texture/);
 const restored=setup({owned:[...env.owned],random:.95});assert.equal(restored.engine.snapshot().find(p=>p.id==='vee-jay').unlocked,true);
 assert.equal(restored.npcs.filter(p=>p.unlockItem&&!p.hidden).every(p=>p.id==='vee-jay'),true);
});

test('active quest givers, conversations and authored visitors stay available while absent quest givers return promptly',()=>{
 const env=setup({missions:[{person:'bach',status:'active'},{person:'miles',status:'complete'}]}),bach=env.npcs.find(p=>p.id==='bach'),miles=env.npcs.find(p=>p.id==='miles');
 assert.equal(bach.hidden,false);assert.equal(miles.hidden,false,'Saved active and ready-to-collect givers start onsite');
 const talking=env.npcs.find(p=>!p.hidden&&p.id!=='bach'&&p.id!=='miles');env.engine.beginConversation(talking);
 const before={x:talking.x,y:talking.y};run(env.engine,100);
 assert.equal(bach.hidden,false);assert.equal(miles.hidden,false);assert.equal(talking.hidden,false);assert.deepEqual({x:talking.x,y:talking.y},before);
 env.engine.endConversation();
 const absent=env.npcs.find(p=>p.hidden&&!p.unlockItem);env.setMissions([{person:'bach',status:'active'},{person:absent.id,status:'active'}]);
 let returned=false;run(env.engine,35,()=>{if(!absent.hidden)returned=true;});assert.equal(returned,true,'A newly needed quest giver should return on the next doorway exchange');
 const authored=setup({npcs:[{id:'bach',x:900,y:500,userPlaced:true},{id:'mozart',x:1100,y:500}],isPinned:p=>p.userPlaced});run(authored.engine,90);
 assert.equal(authored.npcs[0].hidden,false);assert.equal(authored.npcs[0].x,900);assert.equal(authored.npcs[0].y,500);
});

test('blocked doorway arrivals wait safely and cannot appear at a seed in the middle of the map',()=>{
 const env=setup({route:()=>[]});env.blockEntrance(true);env.owned.add('visitor-vee-jay');
 run(env.engine,80);assert.equal(env.npcs.find(p=>p.id==='vee-jay').hidden,true);
 for(const p of env.npcs)if(!p.hidden)assert.equal(env.inside(p.x,p.y),true);
 assert.ok(env.calls.length<500,'An unavailable exit retains a bounded route retry budget');
 env.blockEntrance(false);run(env.engine,10);assert.equal(env.engine.getVisitorState().locked.includes('vee-jay'),false);
});


test('a requested historical visitor returns by the doorway and a locked invitation cannot be recalled',()=>{
 const env=setup({visitDuration:55}),person=env.npcs.find(p=>p.hidden&&!p.unlockItem);
 assert.ok(person);assert.equal(env.engine.requestVisit(person.id),true);
 assert.equal(env.engine.requestVisit('vee-jay'),false);assert.equal(env.engine.requestVisit('missing'),false);
 assert.equal(person.hidden,true,'A recall is an invitation, not an instant teleport');
 run(env.engine,.6);assert.equal(person.hidden,true,'The requested visitor waits while a regular walks out');
 let entered=false;
 run(env.engine,60,()=>{assert.ok(env.npcs.filter(p=>!p.hidden).length<=6,'Invitations cannot exceed the visitor cap');if(!person.hidden)entered=true;});
 assert.equal(entered,true,'A requested visitor enters after a doorway exchange');
 assert.equal(env.npcs.find(p=>p.id==='vee-jay').hidden,true);
 run(env.engine,20);assert.equal(person.hidden,false,'A recalled visitor stays long enough to find and talk to');
});


test('expanded historical roster has one Bach plus Schoenberg, Handel, and Vivaldi',()=>{
 const env=setup();assert.equal(env.cast.filter(person=>person.id==='bach').length,1);
 for(const id of ['schoenberg','handel','vivaldi']){const person=env.cast.find(person=>person.id===id);assert.ok(person);assert.ok(env.engine.getConversation(id).description.length>50);assert.ok(env.engine.say(id,'music').length>80);}
 assert.equal(new Set(env.cast.map(person=>person.id)).size,env.cast.length);
});

test('even more than six protected quest givers cannot expand or underfill the initial cap',()=>{
 const env=setup({missions:['bach','mozart','beethoven','clara','joplin','ellington','ella','nina'].map(person=>({person,status:'active'}))});
 assert.equal(env.engine.getVisitorState().onsite.length,6);run(env.engine,80,()=>assert.equal(env.engine.getVisitorState().onsite.length,6));
 const two=setup({missions:[{person:'bach',status:'active'},{person:'miles',status:'complete'}]});assert.equal(two.engine.getVisitorState().onsite.length,6,'Protected entries are deduplicated before filling all slots');
});

test('a requested visitor stays queued when every onsite musician is protected',()=>{
 const env=setup({visitDuration:1}),onsite=env.npcs.filter(p=>!p.hidden),person=env.npcs.find(p=>p.hidden&&!p.unlockItem);
 env.setMissions(onsite.map(p=>({person:p.id,status:'active'})));assert.equal(env.engine.requestVisit(person.id),true);
 run(env.engine,35,()=>{assert.equal(env.engine.getVisitorState().onsite.length,6);assert.equal(person.hidden,true);});
 env.setMissions([]);let returned=false;run(env.engine,55,()=>{assert.ok(env.engine.getVisitorState().onsite.length<=6);if(!person.hidden)returned=true;});assert.equal(returned,true);
});

test('offscreen departures cannot fade away from a blocked exit and resume when the route opens',()=>{
 let routeOpen=false;const env=setup({visitDuration:55,isOffscreen:()=>true,route:(x,y,tx,ty)=>routeOpen?[{x:tx,y:ty}]:[]});
 const requested=env.npcs.find(p=>p.hidden&&!p.unlockItem);env.engine.requestVisit(requested.id);run(env.engine,.2);
 const leaving=env.engine.snapshot().find(p=>p.visitState==='leaving');assert.ok(leaving);
 run(env.engine,45,()=>{assert.equal(env.engine.getVisitorState().onsite.length,6);assert.equal(requested.hidden,true);const person=env.engine.snapshot().find(p=>p.id===leaving.id);assert.equal(person.hidden,false);assert.equal(person.visitorOpacity,1);});
 routeOpen=true;let left=false,entered=false;
 run(env.engine,60,()=>{assert.ok(env.engine.getVisitorState().onsite.length<=6);const person=env.npcs.find(p=>p.id===leaving.id);if(person.hidden&&!left){left=true;assert.ok(Math.hypot(person.x-env.entrance.x,person.y-env.entrance.y)<=86);}if(!requested.hidden){assert.equal(left,true);entered=true;}});
 assert.equal(left,true);assert.equal(entered,true);
});
