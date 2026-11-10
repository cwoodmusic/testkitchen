import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticDoors,createAutomaticPortalGate,doorOpening} from './automatic-doors.mjs';
const privacy={id:'bath',roomId:'bathroom',axis:'vertical',x:420,y:218,length:132};
const portal={id:'entry',threshold:{x:100,y:200},enterNormal:{x:0,y:-1},triggerHalfWidth:70};
const advance=(doors,count,player,actors=[])=>{for(let i=0;i<count;i++)doors.update(.02,player,actors);};

test('a closed privacy leaf opens before a running walker reaches it',()=>{
 const doors=createAutomaticDoors([privacy]),p={x:privacy.x-185,y:284};assert(doors.blocked(420,284));
 for(let i=0;i<11;i++){doors.update(.02,p);p.x+=780*.02;}
 assert(doors.openness(privacy)>=.99);assert.equal(doors.blocked(420,284),false);assert(p.x<privacy.x);
});
test('a nearby NPC keeps an open doorway clear after the player leaves',()=>{
 const doors=createAutomaticDoors([privacy]),p={x:privacy.x-20,y:284},npc={id:'clara',x:privacy.x+12,y:284};doors.prime(p);
 advance(doors,100,{x:1000,y:1000},[npc]);assert.equal(doors.openness(privacy),1);assert(doors.states[0].occupied);
 advance(doors,35,{x:1000,y:1000},[]);assert(doors.openness(privacy)<1);advance(doors,20,{x:1000,y:1000},[]);assert.equal(doors.openness(privacy),0);
});
test('the leaf closes behind a walker after their body clears, even in a small room',()=>{
 const doors=createAutomaticDoors([privacy]),p={x:410,y:284};doors.prime(p);assert.equal(doors.openness(privacy),1);
 p.x=privacy.x+74;advance(doors,35,p);assert.equal(doors.openness(privacy),1,'A body in the hold band keeps it open');
 p.x=privacy.x+100;advance(doors,20,p);assert.equal(doors.openness(privacy),1,'Clear delay allows the last walker to pass');
 advance(doors,30,p);assert.equal(doors.openness(privacy),0,'Standing inside the room does not leave its door open');
});
test('a person entering a closing doorway reverses the leaf without closing on them',()=>{
 const doors=createAutomaticDoors([privacy]);doors.prime({x:410,y:284});advance(doors,34,{x:1000,y:1000});const closing=doors.openness(privacy);assert(closing<1&&closing>0);
 advance(doors,10,{x:privacy.x,y:284});assert.equal(doors.openness(privacy),1);assert(!doors.blocked(privacy.x,284));
});
test('locked apartment doors do not open for an uninvited player but do for their owner',()=>{
 const door={id:'room-clara',threshold:{x:400,y:300},enterNormal:{x:0,y:-1},triggerHalfWidth:85};
 const doors=createAutomaticDoors([door],{canOpen:(_d,a,isPlayer)=>!isPlayer&&a.id==='clara'});
 advance(doors,30,{x:400,y:320});assert.equal(doors.openness(door),0);
 advance(doors,10,{x:400,y:320},[{id:'clara',x:400,y:340}]);assert.equal(doors.openness(door),1);
});
test('side-facing portal leaves block their actual threshold until open',()=>{
 const left={id:'left-unit',threshold:{x:1216,y:224},enterNormal:{x:-1,y:0},triggerHalfWidth:64};
 assert.deepEqual(doorOpening(left),{x:1216,y:224,nx:-1,ny:0,half:64,privacy:false});const doors=createAutomaticDoors([left]);assert(doors.blocked(1216,224));doors.prime({x:1240,y:224});assert(!doors.blocked(1216,224));
});
test('door states and state references remain stable while animating',()=>{
 const doors=createAutomaticDoors([privacy]),states=doors.states,state=states[0];advance(doors,100,{x:400,y:284});assert.strictEqual(doors.states,states);assert.strictEqual(doors.states[0],state);
});
test('portals require walking into the threshold and do not fire merely for standing nearby',()=>{
 const gate=createAutomaticPortalGate(),p={x:100,y:245};assert.equal(gate.update(.02,p,{x:0,y:0},[portal]),null);
 assert.equal(gate.update(.02,p,{x:0,y:1},[portal]),null);assert.strictEqual(gate.update(.02,p,{x:0,y:-1},[portal]),portal);
 assert.equal(gate.update(.02,{x:180,y:245},{x:0,y:-1},[portal]),null);
});
test('arrivals need a short clear step and cooldown, preventing held-key transitions at spawn',()=>{
 const gate=createAutomaticPortalGate();gate.arrive({x:100,y:245});
 for(let i=0;i<40;i++)assert.equal(gate.update(.02,{x:100,y:245},{x:0,y:-1},[portal]),null);
 assert.strictEqual(gate.update(.02,{x:100,y:205},{x:0,y:-1},[portal]),portal);
});
test('left and right showroom thresholds work in opposite directions without cross-hall triggers',()=>{
 const gate=createAutomaticPortalGate(),left={id:'left',threshold:{x:1216,y:224},enterNormal:{x:-1,y:0},triggerHalfWidth:64},right={id:'right',threshold:{x:1856,y:224},enterNormal:{x:1,y:0},triggerHalfWidth:64};
 assert.strictEqual(gate.update(.02,{x:1244,y:224},{x:-1,y:0},[left,right]),left);
 assert.strictEqual(gate.update(.02,{x:1828,y:224},{x:1,y:0},[left,right]),right);
 assert.equal(gate.update(.02,{x:1536,y:224},{x:1,y:0},[left,right]),null);
});
test('friendship-locked portal remains closed until its live permission changes',()=>{
 let invited=false;const gate=createAutomaticPortalGate(),locked={...portal,allowed:()=>invited};
 assert.equal(gate.update(.02,{x:100,y:245},{x:0,y:-1},[locked]),null);invited=true;assert.strictEqual(gate.update(.02,{x:100,y:245},{x:0,y:-1},[locked]),locked);
});

test('privacy doors stay closed for someone standing inside but anticipate approach in both directions',()=>{
 for(const direction of [-1,1]){
  const doors=createAutomaticDoors([privacy]),p={x:privacy.x+direction*180,y:284};advance(doors,30,p);assert.equal(doors.openness(privacy),0,'A stationary person away from the threshold does not open it');
  for(let i=0;i<11;i++){p.x-=direction*780*.02;doors.update(.02,p);}
  assert.equal(doors.openness(privacy),1);assert(!doors.blocked(privacy.x,284));
 }
});
test('walking parallel to a door outside its clear threshold does not open a private room',()=>{
 const doors=createAutomaticDoors([privacy]),p={x:privacy.x-110,y:230};
 for(let i=0;i<20;i++){p.y+=3;doors.update(.02,p);}assert.equal(doors.openness(privacy),0);
});

test('an uninvited player cannot cross a locked door even when its owner has opened it',()=>{
 const door={id:'clara',threshold:{x:400,y:300},enterNormal:{x:0,y:-1},triggerHalfWidth:85};
 const doors=createAutomaticDoors([door],{canOpen:(_d,a,isPlayer)=>!isPlayer&&a.id==='clara'}),owner={id:'clara',x:400,y:320},guest={id:'__player__',x:400,y:340};
 advance(doors,15,guest,[owner]);assert.equal(doors.openness(door),1);assert(doors.blocked(400,300,16,guest,true));assert(!doors.blocked(400,300,16,owner,false));
});

test('horizontal bedroom leaves share the same opening, crossing and close-behind safety',()=>{
 const door={id:'bed',roomId:'bedroom',axis:'horizontal',x:200,y:300,length:132},doors=createAutomaticDoors([door]),p={x:266,y:115};
 for(let i=0;i<12;i++){doors.update(.02,p);p.y+=780*.02;}
 assert.equal(doors.openness(door),1);assert(!doors.blocked(266,300));
 p.y=400;advance(doors,60,p);assert.equal(doors.openness(door),0);assert(doors.blocked(266,300));
});
