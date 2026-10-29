const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const stageModule=require('../dance-floor-stage.js');
function fixture(options={}){
 const player={x:1000,y:700,name:'Player',facing:'left',profile:{notes:30}},npcs=Array.from({length:7},(_,at)=>({id:'artist-'+at,name:'Artist '+at,x:900+at*18,y:410+at*11,facing:'up',activity:'walking',walking:true,route:[{x:180,y:230}],appearance:{hat:'none'}}));
 const stage=stageModule.create({player,npcs,isWalkable:()=>true,random:()=>.4,...options});
 return {player,npcs,stage};
}
const clone=value=>JSON.parse(JSON.stringify(value));
function advance(stage,seconds){for(let at=0;at<Math.ceil(seconds*120);at++)stage.update(1/120);}

test('stages one player and three random eligible visitors on separated walkable dance-floor positions',()=>{
 const {player,npcs,stage}=fixture();npcs[0].hidden=true;npcs[1].pinned=true;npcs[2].conversation=true;
 npcs.push({id:'dj',x:393,y:621},{id:'placed',x:250,y:300,userPlaced:true},{id:'authored',x:300,y:300,authoredPosition:true});
 const old=clone(npcs);assert.equal(stage.start(),true);const state=stage.getState();
 assert.equal(state.active,true);assert.equal(state.dancers.length,4);assert.deepEqual({x:player.x,y:player.y},stageModule.PLAYER_SPOT);
 assert.equal(state.dancers[0].id,'player');
 for(const excluded of ['artist-0','artist-1','artist-2','dj','placed','authored'])assert.equal(state.dancers.some(actor=>actor.id===excluded),false,excluded);
 for(const [at,actor]of state.dancers.entries()){
  const {x,y}=actor.base;assert.ok(x>=119&&x<=683&&y>=667&&y<=843);
  for(const other of state.dancers.slice(at+1))assert.ok(Math.hypot(x-other.base.x,y-other.base.y)>=44);
 }
 for(const p of npcs){if(!state.poses[p.id])assert.deepEqual(p,old.find(actor=>actor.id===p.id));}
});

test('larger dance steps and bounce ease out and return, with front-facing poses and no avatar/profile mutation',()=>{
 const {player,npcs,stage}=fixture(),original=clone({player,npcs});stage.start();const base=stage.pose();
 assert.equal(stage.hit('left'),true);assert.equal(stage.pose().x,base.x,'input does not teleport the sprite');
 advance(stage,.16);const moving=stage.pose();assert.ok(moving.x<base.x-12&&moving.x>=base.x-18);assert.equal(moving.facing,'down');assert.equal(moving.emote,'dance');assert.equal(moving.walking,true);assert.ok(moving.jumpHeight>5);assert.ok(moving.phase>0);
 advance(stage,.7);const settled=stage.pose();assert.ok(Math.abs(settled.x-base.x)<.02);assert.equal(settled.walking,false);assert.equal(settled.jumpHeight,0);
 assert.equal(player.facing,original.player.facing);assert.deepEqual(player.profile,original.player.profile);
 for(const npc of npcs){const old=original.npcs.find(other=>other.id===npc.id);assert.equal(npc.activity,old.activity);assert.equal(npc.facing,old.facing);assert.deepEqual(npc.route,old.route);assert.deepEqual(npc.appearance,old.appearance);}
});

test('a miss briefly tips the player over while the NPCs keep taking their own on-beat steps',()=>{
 const {stage}=fixture();stage.start();assert.equal(stage.miss('left'),true);assert.equal(stage.cue('right'),true);advance(stage,.3);
 const state=stage.getState(),player=stage.pose();assert.equal(player.falling,true);assert.ok(player.rotation<-1.2);assert.ok(player.scaleY<.85);assert.equal(player.jumpHeight,0);
 for(const dancer of state.dancers.filter(actor=>!actor.isPlayer)){const pose=stage.pose(dancer.id);assert.equal(pose.falling,false);assert.equal(pose.rotation,0);assert.equal(dancer.steps,1);assert.ok(pose.x>dancer.base.x);}
 advance(stage,.5);assert.equal(stage.pose().falling,false);assert.equal(stage.pose().rotation,0);assert.equal(stage.pose().scaleY,1);
 assert.equal(stage.step('up',{actorId:'player'}),true);assert.equal(stage.getState().dancers[0].steps,1);
});

test('blocked staging positions are replaced nearby and a fully blocked floor never mutates the world',()=>{
 const blocked=fixture({isWalkable:(x,y)=>Math.hypot(x-395,y-755)>10});assert.equal(blocked.stage.start(),true);assert.ok(Math.hypot(blocked.player.x-395,blocked.player.y-755)>10);
 const empty=fixture({isWalkable:()=>false}),before=clone({player:empty.player,npcs:empty.npcs});assert.equal(empty.stage.start(),false);assert.deepEqual({player:empty.player,npcs:empty.npcs},before);assert.equal(empty.stage.pose(),null);
 const failing=fixture({isWalkable:()=>{throw Error('Unavailable collision map');}});assert.equal(failing.stage.start(),false);
});

test('motion obeys collision along its entire short step instead of crossing thin blocked strips',()=>{
 let staged=false;
 const {player,stage}=fixture({isWalkable:(x,y)=>!staged||x<399||x>402});assert.equal(stage.start(),true);staged=true;
 stage.step('right',{actorId:'player'});stage.update(.2);assert.ok(player.x<399,'must not hop through the blocked strip to the clear far side');
 for(let at=0;at<40;at++){stage.update(1/60);assert.ok(player.x<399);}
});

test('close restores exact pre-game positions, is idempotent and preserves routine and identity fields',()=>{
 const {player,npcs,stage}=fixture(),before=clone({player,npcs});stage.start();stage.hit('down');advance(stage,.12);stage.miss();advance(stage,.2);stage.close();
 assert.deepEqual({player,npcs},before);assert.equal(stage.getState().active,false);assert.deepEqual(stage.getState().dancers,[]);assert.equal(stage.pose('player'),null);
 stage.close();stage.destroy();assert.deepEqual({player,npcs},before);assert.equal(stage.step('up'),false);assert.equal(stage.miss(),false);assert.equal(stage.start(),true);stage.close();assert.deepEqual({player,npcs},before);
});

test('a nonparticipating visitor on the player spot watches from an edge and returns unchanged afterward',()=>{
 const player={x:1400,y:760},npcs=[0,1,2].map(at=>({id:'dancer-'+at,x:900+at*30,y:500,facing:'left',activity:'waiting'}));
 const spectator={id:'joplin',name:'Scott Joplin',x:395,y:755,facing:'up',activity:'waiting',route:[{x:280,y:790}],appearance:{glasses:'round'}};npcs.push(spectator);
 const before=clone({player,npcs}),stage=stageModule.create({player,npcs,random:()=>.999999,isWalkable:()=>true});assert.equal(stage.start(),true);
 const state=stage.getState();assert.deepEqual({x:player.x,y:player.y},stageModule.PLAYER_SPOT);assert.equal(state.dancers.some(actor=>actor.id==='joplin'),false);assert.equal(state.watchers[0].id,'joplin');
 for(const dancer of state.dancers)assert.ok(Math.hypot(spectator.x-dancer.base.x,spectator.y-dancer.base.y)>=56);
 assert.ok(spectator.x<260||spectator.x>530,'the visitor watches from a floor edge');assert.equal(stage.pose('joplin'),null);
 assert.equal(spectator.facing,'up');assert.deepEqual(spectator.route,before.npcs[3].route);stage.hit('left');advance(stage,.2);stage.close();assert.deepEqual({player,npcs},before);
});

test('a pinned or authored occupant stays put and the complete dance formation finds clear feet positions around them',()=>{
 for(const marker of ['pinned','authoredPosition']){
  const player={x:1400,y:760},occupant={id:'fixed',x:395,y:755,[marker]:true,facing:'up'},npcs=[0,1,2].map(at=>({id:'dancer-'+at,x:900+at*30,y:500}));npcs.push(occupant);
  const before=clone({player,npcs}),stage=stageModule.create({player,npcs,isWalkable:()=>true,random:()=>.99999});assert.equal(stage.start(),true);
  assert.deepEqual(occupant,before.npcs[3]);assert.equal(stage.getState().watchers.length,0);
  for(const dancer of stage.getState().dancers)assert.ok(Math.hypot(occupant.x-dancer.base.x,occupant.y-dancer.base.y)>=56);
  stage.close();assert.deepEqual({player,npcs},before);
 }
});

test('crowding that has no safe formation aborts before moving either dancers or spectators',()=>{
 const player={x:1400,y:760},npcs=[0,1,2].map(at=>({id:'dancer-'+at,x:900+at*30,y:500}));npcs.push({id:'spectator',x:395,y:755});
 const before=clone({player,npcs}),stage=stageModule.create({player,npcs,isWalkable:(x,y)=>x===395&&y===755,random:()=>.99999});assert.equal(stage.start(),false);assert.deepEqual({player,npcs},before);assert.equal(stage.getState().active,false);assert.deepEqual(stage.getState().watchers,[]);
});

test('reduced motion keeps steps small and removes tipping, bouncing and scaling effects',()=>{
 const {stage}=fixture({reducedMotion:()=>true});stage.start();const base=stage.pose();stage.hit('right');stage.miss();advance(stage,.2);const pose=stage.pose();
 assert.ok(pose.x-base.x<=3);assert.equal(pose.rotation,0);assert.equal(pose.jumpHeight,0);assert.equal(pose.scaleY,1);assert.equal(pose.falling,true);
});

test('short visitor lists, duplicate IDs and invalid directions stay safe and browser module has no side effects',()=>{
 const player={x:10,y:20},npcs=[{id:'solo',x:30,y:50},{id:'solo',x:60,y:70}];const stage=stageModule.create({player,npcs,random:()=>Infinity});assert.equal(stage.start(),true);assert.equal(stage.getState().dancers.length,2);
 const before=stage.getState();assert.equal(stage.start(),true);assert.equal(stage.step('backflip'),false);stage.update(NaN);stage.update(-1);assert.deepEqual(stage.getState(),before);
 const window={};vm.runInNewContext(fs.readFileSync(require.resolve('../dance-floor-stage.js'),'utf8'),{window});assert.equal(typeof window.CodaDanceFloorStage.create,'function');assert.deepEqual(JSON.parse(JSON.stringify(window.CodaDanceFloorStage.FLOOR_BOUNDS)),stageModule.FLOOR_BOUNDS);
 assert.equal(stageModule.create({}).start(),false);
});
