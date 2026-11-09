import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {npcCollisionProject} from './npc-collision.mjs';
import {createAmbientNPCs} from './ambient-npcs.mjs';

function readyForMeeting(){
 const doc=blank();doc.spawn={x:8192,y:6200};let revision=0;
 doc.objects.push({id:'tower',asset:'coda-residences',x:8192,y:7000,scale:1,rotation:0,layer:'objects',collision:true});
 const catalog=new Map([['coda-residences',{w:2400,h:1600,urban:'tower',door:{x:1200,y:1600},boxes:[]}],['flower-bed',{w:128,h:128,boxes:[{x:0,y:0,w:128,h:128}],npcAvoid:true}]]);
 doc.objects.push({id:'planting',asset:'flower-bed',x:8150,y:6660,scale:1,rotation:0,layer:'objects',collision:false});
 const sim=createAmbientNPCs({getProject:()=>doc,getRevision:()=>revision,catalog,count:2});sim.update(0);
 // End the opening tableau and hold both residents until the periodic social
 // deadline. The later chat must come from routed rendezvous, not that tableau.
 for(const actor of sim.residents)sim.setConversation(actor.id,true,{x:actor.x+80,y:actor.y});
 for(let frame=0;frame<490;frame++)sim.update(.1);
 const goals=new Map();
 sim.residents.forEach((actor,i)=>{
  sim.setConversation(actor.id,false);
  const x=i?8800:7500,y=5800,target={x,y:7200},goal={id:'casual:'+actor.id,kind:'hangout',approach:target,...target,_arrival:true};goals.set(actor.id,goal);
  Object.assign(actor,{x,y,state:'walking',location:{kind:'street'},hidden:false,activity:'',conversation:undefined,_wait:0,_path:[target],_pending:false,_goingHome:false,_progress:{x,y,time:sim.simulationTime},_goal:goal,_homeDue:Infinity,_socialAfter:0,_yield:0});
 });
 return {doc,catalog,sim,goals,edit:()=>revision++};
}

function advanceUntil(fixture,predicate,seconds=30){
 const {sim,doc,catalog}=fixture,view=npcCollisionProject(doc,catalog);
 for(let frame=0;frame<seconds*60;frame++){
  sim.update(1/60);
  for(const actor of sim.actors)if(actor.role==='resident'&&actor.walking)assert.equal(blocked(view,actor.x,actor.y,catalog),false,'A social route crossed authored collision');
  if(predicate())return;
 }
 assert.fail(`Condition was not reached after ${seconds} city seconds`);
}

function scheduledMeeting(fixture){
 advanceUntil(fixture,()=>fixture.sim.events.some(e=>e.type==='social-meeting'),8);
 return fixture.sim.events.find(e=>e.type==='social-meeting');
}

test('a quiet city routes a later conversation, waits for both arrivals, and resumes both casual trips',()=>{
 const fixture=readyForMeeting(),{sim,doc,goals}=fixture,before=JSON.stringify(doc);
 const meeting=scheduledMeeting(fixture);assert(meeting.time>=48);
 const targets=sim.residents.map(actor=>actor._goal?.approach);
 assert(targets.every(Boolean));const view=npcCollisionProject(doc,fixture.catalog);
 for(const point of targets){assert.equal(blocked(view,point.x,point.y,fixture.catalog),false);assert(sim.district.anchors.filter(a=>['tower','shop','arcade'].includes(a.kind)).every(a=>Math.hypot(point.x-(a.threshold||a).x,point.y-(a.threshold||a).y)>320),'A meeting point blocked an entrance');}
 const separation=Math.hypot(targets[0].x-targets[1].x,targets[0].y-targets[1].y);
 assert(separation>=75&&separation<=160,'Conversation spots must leave room for two facing residents');
 assert.equal(sim.events.filter(e=>e.type==='chat'&&e.time>0).length,0,'A routed social visit must not chat before both arrive');
 advanceUntil(fixture,()=>sim.events.some(e=>e.type==='chat'&&e.rendezvous),30);
 const chat=sim.events.find(e=>e.type==='chat'&&e.rendezvous),arrivals=sim.events.filter(e=>e.type==='social-arrive'&&e.sequence>meeting.sequence&&e.sequence<chat.sequence);
 assert.equal(new Set(arrivals.map(e=>e.id)).size,2,'Both residents must finish their approach before conversation');
 assert.equal(sim.events.filter(e=>e.type==='social-meeting').length,1,'Only one rendezvous may own the pair while they approach');
 const [a,b]=sim.residents;assert.equal(a.conversation,b.id);assert.equal(b.conversation,a.id);
 assert.equal(a.state,'chatting');assert.equal(b.state,'chatting');
 const resumed=new Set();
 advanceUntil(fixture,()=>{for(const actor of sim.residents)if(actor.state==='walking'&&actor._goal?.id===goals.get(actor.id).id){assert.deepEqual(actor._goal.approach,goals.get(actor.id).approach);resumed.add(actor.id);}return resumed.size===2;},25);
 assert.equal(JSON.stringify(doc),before,'Social scheduling must not write activity or goals into the authored map');
});

for(const interruption of ['dialogue','explicit visit','geometry edit']){
 test(`${interruption} cancels an approaching rendezvous and releases the other resident`,()=>{
  const fixture=readyForMeeting(),{sim,doc}=fixture;scheduledMeeting(fixture);
  const [a,b]=sim.residents;
  if(interruption==='dialogue')sim.setConversation(a.id,true,{x:a.x+80,y:a.y});
  if(interruption==='explicit visit')assert(sim.visit(a.id,sim.district.tower.id));
  if(interruption==='geometry edit'){fixture.edit();sim.update(0);}
  const afterEdit=JSON.stringify(doc);
  assert(sim.events.some(e=>e.type==='social-cancel'),'Interruption must explicitly release the paired social reservation');
  assert(!b._rendezvous);assert.notEqual(b.state,'social-wait');assert(!(['walking','waiting'].includes(b.state)&&b._goal?.kind==='social-meeting'),'The partner must not remain on an abandoned meeting route');
  assert.equal(a.conversation,undefined);assert.equal(b.conversation,undefined);
  for(let frame=0;frame<120;frame++)sim.update(1/60);
  assert.equal(sim.events.filter(e=>e.type==='chat'&&e.rendezvous).length,0,'An interrupted meeting must not start a stale paired conversation');
  assert.equal(JSON.stringify(doc),afterEdit);
 });
}

test('an unreachable social arrival times out and releases both casual routes',()=>{
 const fixture=readyForMeeting(),{sim,doc}=fixture,before=JSON.stringify(doc);scheduledMeeting(fixture);
 const delayed=[...sim.residents].sort((a,b)=>Math.hypot(b.x-b._goal.approach.x,b.y-b._goal.approach.y)-Math.hypot(a.x-a._goal.approach.x,a.y-a._goal.approach.y))[0];
 assert(Math.hypot(delayed.x-delayed._goal.approach.x,delayed.y-delayed._goal.approach.y)>100,'The delayed participant must still have a real approach to walk');
 delayed.speed=0;
 advanceUntil(fixture,()=>sim.events.some(e=>e.type==='social-cancel'&&/time/i.test(e.reason)),30);
 assert(sim.residents.every(actor=>!actor._rendezvous&&actor.state!=='social-wait'&&!(['walking','waiting'].includes(actor.state)&&actor._goal?.kind==='social-meeting')));
 assert.equal(sim.events.filter(e=>e.type==='chat'&&e.rendezvous).length,0,'One arrival cannot start a paired conversation');
 assert.equal(JSON.stringify(doc),before);
});
