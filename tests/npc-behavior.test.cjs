const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../npc-behavior.js'),'utf8'),context);
const create=context.window.createCodaNPCBehavior;
const IDS=['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles'];
const GAME=()=>({index:1,name:'Music Triad',x:200,y:100,npcX:200,npcY:100});
function setup(options={}){
  const npcs=options.npcs||[{id:'bach',name:'J. S. Bach',x:100,y:100,look:0}];
  let available=options.games||[GAME()],user=options.player||{x:-9999,y:-9999},calls=[];
  const inside=options.inside||((x,y)=>x>=0&&x<1672&&y>=0&&y<941);
  const engine=create({npcs,inside,route:(...args)=>{calls.push(args);return options.route?options.route(...args):[{x:args[2],y:args[3]}];},getGames:()=>available,getPlayer:()=>user,getDialogue:options.getDialogue});
  return {engine,npcs,calls,inside,setGames:value=>{available=value;},setPlayer:value=>{user=value;}};
}
function run(engine,seconds){for(let t=0;t<seconds;t+=.1)engine.update(.1);}

test('project dialogue edits affect greetings, biography, choices and replies without changing routines',()=>{
  let edited=null;const env=setup({getDialogue:()=>edited}),defaults=JSON.parse(JSON.stringify(context.window.CodaNPCDialogueDefaults.bach));
  assert.match(env.engine.beginConversation('bach').line,/independent/);env.engine.endConversation();
  edited={...defaults,description:'A teacher with a question.',greetings:['Hello, class!'],choices:[{id:'music',label:'Our music lesson',reply:'Keep the beat steady.'},{id:'activity',label:'What now?',reply:''},{id:'custom-one',label:'A new idea',reply:'Try clapping the rhythm.'}]};
  const conversation=env.engine.beginConversation('bach');
  assert.equal(conversation.line,'Hello, class!');assert.equal(conversation.description,edited.description);
  assert.deepEqual(Array.from(conversation.choices,choice=>choice.id),['music','activity','custom-one']);
  assert.equal(env.engine.say('bach','custom-one'),'Try clapping the rhythm.');
  assert.match(env.engine.say('bach','activity'),/exploring.*arcade/);
  assert.equal(env.engine.snapshot()[0].description,edited.description);
  env.engine.endConversation();edited=null;
  assert.equal(env.engine.getConversation('bach').description,defaults.description);
  assert.match(env.engine.say('bach','music'),/counterpoint/);
  run(env.engine,1);assert.ok(env.calls.length>0,'Dialogue does not replace movement routines');
});

test('nine historical musical personalities have distinct conversations, safe spawn points, and varied routines',()=>{
  const npcs=IDS.map((id,look)=>({id,x:1450,y:752,look})),env=setup({npcs,games:[0,1,2,3].map(index=>({...GAME(),index,x:700+index*100,npcX:700+index*100,npcY:323}))});
  assert.equal(env.engine.snapshot().length,9);
  assert.equal(new Set(npcs.map(p=>p.x+':'+p.y)).size,9);
  for(const p of npcs){assert.equal(env.inside(p.x,p.y),true);assert.equal(p.hidden,false);const data=env.engine.getConversation(p.id);assert.equal(data.fictional,true);assert.ok(data.description.length>50);assert.equal(data.choices.length,4);}
  assert.match(env.engine.say('bach','music'),/counterpoint/i);
  assert.match(env.engine.say('miles','music'),/Kind of Blue.*1959/);
  assert.match(env.engine.say('ella','music'),/Scat singing/);
  env.engine.update(.1);
  assert.ok(env.calls.length<=2,'Pathfinding is budgeted across the whole crowd');
  run(env.engine,1);
  assert.ok(new Set(npcs.map(p=>p.mode)).size>=3);
  assert.equal(new Set(npcs.filter(p=>p.mode==='cabinet').map(p=>p.goal)).size,npcs.filter(p=>p.mode==='cabinet').length,'Visitors reserve distinct cabinets');
});

test('walking direction and animation phase follow actual movement and never pass through a blocked wall',()=>{
  const env=setup({inside:(x,y)=>x>=0&&y>=0&&(x<110||x>190)}),p=env.npcs[0];
  env.engine.update(.1);assert.equal(p.walking,true);assert.equal(p.facing,'right');assert.ok(p.phase>0);
  for(let i=0;i<50;i++){env.engine.update(.1);assert.ok(p.x<110,'NPC must not jump across an invalid segment returned by navigation');assert.equal(env.inside(p.x,p.y),true);}
  const phase=p.phase;env.engine.beginConversation(p);run(env.engine,1);assert.equal(p.phase,phase);assert.equal(p.walking,false);
});

test('an empty failed route is waiting, not a successful activity arrival, and retries back off',()=>{
  const env=setup({route:()=>[]});
  env.engine.update(.1);assert.equal(env.npcs[0].arrived,false);assert.equal(env.npcs[0].activity,'waiting');
  run(env.engine,3);assert.equal(env.npcs[0].arrived,false);assert.equal(env.npcs[0].walking,false);
  assert.ok(env.calls.length<=6,'Unavailable routes must not be retried every frame');
});

test('real arrival dwells at a game, then moves on to a different activity',()=>{
  const env=setup({games:[{...GAME(),x:100,y:100,npcX:100,npcY:100}]}),p=env.npcs[0];
  env.engine.update(.1);assert.equal(p.arrived,true);assert.equal(p.activity,'playing');assert.equal(p.facing,'up');
  const initial=p.wait;run(env.engine,2);assert.ok(p.wait<initial);assert.equal(p.mode,'cabinet');
  run(env.engine,6);assert.equal(p.mode,'lounge');assert.equal(p.arrived,false);assert.equal(p.activity,'walking');
});

test('conversation pauses one musician, faces the player, and resumes their pending route',()=>{
  const env=setup({player:{x:100,y:200}}),p=env.npcs[0];env.engine.update(.1);
  const before={x:p.x,y:p.y,phase:p.phase};
  const data=env.engine.beginConversation('bach');assert.equal(data.name,'J. S. Bach');assert.equal(p.activity,'chatting');assert.equal(p.conversation,true);assert.equal(p.facing,'down');
  run(env.engine,2);assert.deepEqual({x:p.x,y:p.y,phase:p.phase},before);assert.equal(p.walking,false);
  assert.match(env.engine.say('bach','activity'),/on my way to Music Triad/);
  env.engine.endConversation();assert.equal(p.conversation,false);env.engine.update(.1);assert.ok(p.x>before.x);assert.equal(p.walking,true);
});

test('a paused activity keeps its dwell time, and starting a new conversation releases the old speaker',()=>{
  const env=setup({npcs:[{id:'bach',x:100,y:100},{id:'mozart',x:400,y:300}],games:[{...GAME(),npcX:100,npcY:100}]}),p=env.npcs[0];
  env.engine.update(.1);assert.equal(p.arrived,true);const wait=p.wait;env.engine.beginConversation(p);run(env.engine,2);assert.equal(p.wait,wait);
  env.engine.beginConversation('mozart');assert.equal(p.conversation,false);assert.equal(env.npcs[1].conversation,true);
  env.engine.endConversation();assert.equal(env.npcs[1].conversation,false);assert.equal(env.engine.beginConversation('missing'),null);
});

test('moved cabinets update destination identities; hidden cabinets remove pending game visits',()=>{
  const env=setup();env.engine.update(.1);const p=env.npcs[0];
  env.setGames([{...GAME(),npcX:340,npcY:210}]);run(env.engine,.4);
  let state=env.engine.snapshot()[0];assert.equal(state.target.x,340);assert.equal(state.target.y,210);assert.match(p.routeKey,/340\.0:210\.0/);
  env.setGames([]);env.engine.update(.1);state=env.engine.snapshot()[0];assert.notEqual(state.target?.mode,'cabinet');assert.equal(p.arrived,false);
});

test('the player and other visitors are never shoved through or overlapped while yielding',()=>{
  const user={x:145,y:100},env=setup({player:user});
  for(let i=0;i<100;i++){env.engine.update(.1);const p=env.npcs[0];assert.ok(Math.hypot(p.x-user.x,p.y-user.y)>=19-1e-8);assert.equal(env.inside(p.x,p.y),true);}
  const p=env.npcs[0];assert.ok(p.phase>0);assert.equal(Number.isFinite(p.x),true);
});

test('yielding sidesteps keep a musician facing their route instead of flashing a side view',()=>{
  const env=setup({player:{x:160,y:100},games:[{...GAME(),npcX:260,npcY:100}]}),p=env.npcs[0];let sidesteps=0;
  for(let frame=0;frame<120;frame++){
    const before={x:p.x,y:p.y,phase:p.phase};env.engine.update(.05);
    if(p.y-before.y>.1&&p.x<180){
      sidesteps++;assert.equal(p.facing,'right','A short crowd-avoidance step must not turn the character for one frame');
      assert.equal(p.walking,true);assert.ok(p.phase>before.phase,'The sidestep still advances movement animation');
    }
  }
  assert.ok(sidesteps>0,'The scenario must actually exercise crowd avoidance');
});

test('route invalidation preserves positions and respects the shared pathfinding budget',()=>{
  const env=setup({npcs:IDS.map((id,i)=>({id,x:100+i*30,y:100+i*20})),route:()=>[]});run(env.engine,.4);
  const before=env.npcs.map(p=>({x:p.x,y:p.y}));env.calls.length=0;env.engine.invalidateRoutes();env.engine.update(.1);
  assert.ok(env.calls.length<=2);assert.deepEqual(env.npcs.map(p=>({x:p.x,y:p.y})),before);assert.ok(env.npcs.every(p=>!p.walking));
});

test('a completely blocked map hides unspawnable visitors and permits safe entry when it opens',()=>{
  let open=false;const env=setup({npcs:IDS.map(id=>({id,x:1450,y:752})),inside:(x,y)=>open&&x>=0&&y>=0&&x<1672&&y<941});
  assert.ok(env.npcs.every(p=>p.hidden));run(env.engine,3);assert.equal(env.calls.length,0);
  open=true;run(env.engine,3);assert.ok(env.npcs.every(p=>!p.hidden&&env.inside(p.x,p.y)));
});

test('new collision under a visitor despawns them before safe reentry rather than bypassing a wall',()=>{
  let blocked=false;
  const env=setup({inside:(x,y)=>x>=0&&y>=0&&x<1672&&y<941&&(!blocked||x>=500)}),p=env.npcs[0];
  env.engine.update(.1);const before={x:p.x,y:p.y};blocked=true;env.engine.invalidateRoutes();
  assert.equal(p.hidden,true);assert.equal(p.walking,false);assert.deepEqual({x:p.x,y:p.y},before,'Recovery cannot visibly jump through the new obstacle');
  run(env.engine,.3);assert.equal(p.hidden,true,'Reentry must not happen in the same edit frame');
  run(env.engine,1);assert.equal(p.hidden,false);assert.equal(env.inside(p.x,p.y),true);assert.ok(p.x>=500);
});

test('standing-cell recovery also catches unannounced map changes and ends an unspawnable conversation',()=>{
  let open=true;const env=setup({inside:(x,y)=>open&&x>=0&&y>=0&&x<1672&&y<941}),p=env.npcs[0];
  env.engine.beginConversation(p);assert.equal(p.conversation,true);open=false;env.engine.update(.1);
  assert.equal(p.hidden,true);assert.equal(p.conversation,false);assert.equal(env.engine.snapshot()[0].conversation,false);
  run(env.engine,3);assert.equal(p.hidden,true);assert.equal(env.calls.length,0);
  open=true;run(env.engine,3);assert.equal(p.hidden,false);assert.equal(env.inside(p.x,p.y),true);
});

test('a visitor escapes when the player walks onto their feet, then resumes the routine',()=>{
  const env=setup({games:[{...GAME(),npcX:300,npcY:100}]}),p=env.npcs[0];env.engine.update(.1);
  const user={x:p.x,y:p.y};env.setPlayer(user);
  for(let frame=0;frame<40;frame++){
    const before={x:p.x,y:p.y};env.engine.update(.1);
    assert.ok(Math.hypot(p.x-before.x,p.y-before.y)<=6.5+1e-7,'Giving space is ordinary walking, not a position jump');
    assert.equal(env.inside(p.x,p.y),true);
  }
  assert.ok(Math.hypot(p.x-user.x,p.y-user.y)>=44);
  assert.ok(p.phase>0);assert.ok(p.x>user.x+80,'Clearing the overlap must not strand the visitor at the spacing boundary');
  run(env.engine,2);assert.equal(p.arrived,true);assert.equal(p.activity,'playing');
});

test('visitors route past a stationary player instead of stopping in a ring around them',()=>{
  const user={x:160,y:100},env=setup({player:user,games:[{...GAME(),npcX:300,npcY:100}]}),p=env.npcs[0];let detoured=false;
  for(let frame=0;frame<60;frame++){
    env.engine.update(.1);detoured=detoured||Math.abs(p.y-100)>20;
    assert.ok(Math.hypot(p.x-user.x,p.y-user.y)>=44-1e-7);
  }
  assert.equal(detoured,true,'The route must go around the person standing on it');
  assert.equal(p.arrived,true);assert.equal(p.activity,'playing');assert.ok(env.calls.length<=3,'Local passing should not pathfind every frame');
  assert.deepEqual(user,{x:160,y:100});
});

test('a player entering a tight group disperses the crowd and nobody freezes at the give-space threshold',()=>{
  const npcs=IDS.map((id,index)=>index?{id,x:500+32*Math.cos((index-1)*Math.PI/4),y:500+32*Math.sin((index-1)*Math.PI/4)}:{id,x:500,y:500});
  const env=setup({npcs,games:[0,1,2,3].map(index=>({...GAME(),index,npcX:700+index*100,npcY:300}))}),user={x:500,y:500};env.setPlayer(user);
  for(let frame=0;frame<100;frame++){
    const before=npcs.map(p=>({x:p.x,y:p.y})),queries=env.calls.length;env.engine.update(.1);
    assert.ok(env.calls.length-queries<=2,'A crowded frame still shares the route budget');
    npcs.forEach((p,index)=>{assert.equal(env.inside(p.x,p.y),true);assert.ok(Math.hypot(p.x-before[index].x,p.y-before[index].y)<=7.8+1e-7);});
  }
  for(const p of npcs)assert.ok(Math.hypot(p.x-user.x,p.y-user.y)>80,'Every visitor must return to a destination beyond the player’s immediate space');
  assert.ok(new Set(npcs.map(p=>p.mode)).size>=3);assert.deepEqual(user,{x:500,y:500});
});

test('idle visitors give space, while conversations and authored or pinned positions remain still',()=>{
  const env=setup({games:[{...GAME(),npcX:100,npcY:100}]}),p=env.npcs[0];env.engine.update(.1);assert.equal(p.arrived,true);
  env.setPlayer({x:105,y:100});run(env.engine,2);assert.ok(Math.hypot(p.x-105,p.y-100)>=44);assert.equal(p.arrived,false);
  env.engine.beginConversation(p);const talking={x:p.x,y:p.y,phase:p.phase};env.setPlayer({x:p.x,y:p.y});run(env.engine,1);
  assert.deepEqual({x:p.x,y:p.y,phase:p.phase},talking);env.engine.endConversation();run(env.engine,2);assert.ok(Math.hypot(p.x-talking.x,p.y-talking.y)>=44);
  for(const key of ['userPlaced','authoredPosition','pinned']){
    const fixed={id:'bach',x:100,y:100,[key]:true},f=setup({npcs:[fixed],player:{x:100,y:100}});run(f.engine,3);
    assert.equal(fixed.x,100);assert.equal(fixed.y,100);assert.equal(fixed.walking,false,'A developer-positioned visitor is not moved by spacing');
  }
});

test('new collision under a pinned visitor waits for that authored position instead of moving them to an entrance',()=>{
  let open=true;const fixed={id:'bach',x:100,y:100,pinned:true},env=setup({npcs:[fixed],inside:(x,y)=>open&&x>=0&&y>=0&&x<1672&&y<941});
  open=false;run(env.engine,1);assert.equal(fixed.hidden,true);assert.equal(fixed.x,100);assert.equal(fixed.y,100);
  open=true;run(env.engine,2);assert.equal(fixed.hidden,false);assert.equal(fixed.x,100);assert.equal(fixed.y,100);
});
