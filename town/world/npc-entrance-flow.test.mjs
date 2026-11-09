import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {createAmbientNPCs} from './ambient-npcs.mjs';

// Start the second resident closer to the door but beside the line. They
// still have to walk to its marked tail before claiming a FIFO position.
test('a resident ahead of the line joins only after reaching the staging approach',()=>{
 const doc=blank();doc.spawn={x:8192,y:6800};
 doc.objects.push({id:'tower',asset:'coda-residences',x:8192,y:6144,scale:1,rotation:0,layer:'objects',collision:true});
 const catalog=new Map([['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}]]);
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,count:2});sim.update(0);
 const entrance=sim.district.tower,line=sim.queues.find(q=>q.entranceId===entrance.id).layout;
 assert(line&&line.capacity>=2);
 const forward={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}}[line.facing],right={x:forward.y,y:-forward.x};
 const tail=line.slots.at(-1),staging={x:tail.x+forward.x*86,y:tail.y+forward.y*86};
 const [first,second]=sim.residents;
 Object.assign(first,{x:staging.x+forward.x*80,y:staging.y+forward.y*80});
 Object.assign(second,{x:tail.x-forward.x*80+right.x*100,y:tail.y-forward.y*80+right.y*100});
 assert(sim.visit(first.id,entrance.id));assert(sim.visit(second.id,entrance.id));
 for(let frame=0;frame<12;frame++)sim.update(1/60);
 assert.equal(sim.events.filter(e=>e.type==='queue-join').length,0,'Nearness to the tail must not bypass the staging approach');
 const joined=new Map(),entered=new Set();
 for(let frame=0;frame<1800&&entered.size<2;frame++){
  sim.update(1/60);
  for(const event of sim.events){
   if(event.type==='queue-join'&&!joined.has(event.id)){
    const actor=sim.residents.find(a=>a.id===event.id);
    assert(actor&&Math.hypot(actor.x-staging.x,actor.y-staging.y)<=2,'Resident joined from ahead or beside the waiting line');
    joined.set(event.id,event.joinOrder);
   }
   if(event.type==='enter-building')entered.add(event.id);
  }
 }
 assert.deepEqual([...joined.keys()],[first.id,second.id]);
 assert.equal(entered.size,2,'Both residents must eventually enter rather than block each other in inverted queue positions');
 const served=sim.events.filter(e=>e.type==='queue-service'&&joined.get(e.id)===e.joinOrder).map(e=>e.id);
 assert.deepEqual(served,[first.id,second.id]);
});

// The leader has already joined when an oncoming visitor forces it sideways.
// Joining later must not let that visitor take the leader's rejoin position.
test('a later queue member stays behind a leader detouring around its approach',()=>{
 const doc=blank();doc.spawn={x:8192,y:6800};
 doc.objects.push({id:'tower',asset:'coda-residences',x:8192,y:6144,scale:1,rotation:0,layer:'objects',collision:true});
 const catalog=new Map([['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}]]);
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,count:2});sim.update(0);
 const entrance=sim.district.tower,line=sim.queues.find(q=>q.entranceId===entrance.id).layout;
 const forward={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}}[line.facing];
 const tail=line.slots.at(-1),staging={x:tail.x+forward.x*86,y:tail.y+forward.y*86};
 const [first,second]=sim.residents;
 Object.assign(first,{x:staging.x+forward.x*80,y:staging.y+forward.y*80});
 Object.assign(second,{x:staging.x-forward.x*250,y:staging.y-forward.y*250,_wait:100});
 assert(sim.visit(first.id,entrance.id));
 for(let frame=0;frame<300&&!sim.events.some(e=>e.type==='queue-join');frame++)sim.update(1/60);
 assert(sim.events.some(e=>e.type==='queue-join'&&e.id===first.id));
 // Talking to the head pauses it while the newly free staging approach is
 // taken by the later arrival. Releasing dialogue makes their paths cross.
 sim.setConversation(first.id,true,{x:first.x+80,y:first.y});
 assert(sim.visit(second.id,entrance.id));
 let overlappingDetour=false,minGap=Infinity,released=false;
 for(let frame=0;frame<1800;frame++){
  if(!released&&Math.hypot(second.x-staging.x,second.y-staging.y)<=100){sim.setConversation(first.id,false);released=true;}
  sim.update(1/60);
  if(first.queueEntranceId===entrance.id&&second.queueEntranceId===entrance.id&&Number.isInteger(first.queueIndex)&&Number.isInteger(second.queueIndex)){
   const gap=(second.x-first.x)*forward.x+(second.y-first.y)*forward.y;
   minGap=Math.min(minGap,gap);
   assert(gap>=68-.01,'A later member moved into the leader’s projected lane position during its detour');
   if(first._passingRemaining>0)overlappingDetour=true;
  }
  if(sim.events.filter(e=>e.type==='enter-building').length>=2)break;
 }
 const joins=sim.events.filter(e=>e.type==='queue-join'),services=sim.events.filter(e=>e.type==='queue-service'),entries=sim.events.filter(e=>e.type==='enter-building');
 const detour=sim.events.find(e=>e.type==='passing-start'&&e.id===first.id&&e.other===second.id);
 assert(detour&&detour.time>joins[0]?.time&&detour.time<joins[1]?.time,'The first member must detour around a still-unjoined later arrival');
 assert(overlappingDetour,'The later member must join while the leader is still passing');
 assert(minGap<80,'The fixture must exercise the following-distance gate');
 assert.deepEqual(joins.map(e=>e.id),[first.id,second.id]);
 assert.deepEqual(services.map(e=>e.id),[first.id,second.id]);
 assert.deepEqual(entries.map(e=>e.id),[first.id,second.id],'Both members must enter in FIFO order without getting stuck after the detour');
});

for(const kind of ['shop','arcade'])for(const hasTower of [true,false]){
 test(`deleting an occupied ${kind} recovers its visitor ${hasTower?'to their apartment':'to safe street ground'}`,()=>{
  const doc=blank();doc.spawn={x:8192,y:6800};let revision=0;
  const asset=kind==='arcade'?'coda-arcade':'coda-furnishings';
  const catalog=new Map([[asset,{w:400,h:600,urban:kind==='shop'?'shop':undefined,door:{x:200,y:600},boxes:[]}],['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}]]);
  const placed=(id,asset,x)=>({id,asset,x,y:6144,scale:1,rotation:0,layer:'objects',collision:true});
  doc.objects.push(placed('venue',asset,8192));if(hasTower)doc.objects.push(placed('tower','coda-residences',7000));
  const sim=createAmbientNPCs({getProject:()=>doc,getRevision:()=>revision,catalog,count:1});sim.update(0);
  const entrance=sim.district.anchors.find(a=>a.kind===kind),line=sim.queues.find(q=>q.entranceId===entrance.id).layout;
  assert(line);const tail=line.slots.at(-1),actor=sim.residents[0];Object.assign(actor,{x:tail.x,y:tail.y+166});
  const beforeVisit=JSON.stringify(doc);assert(sim.visit(actor.id,entrance.id));
  for(let frame=0;frame<1800&&actor.location.kind!==kind;frame++)sim.update(1/60);
  assert.equal(actor.location.kind,kind,'The visitor must actually enter before its venue is removed');
  assert(actor._venue);assert.equal(JSON.stringify(doc),beforeVisit);
  doc.objects=doc.objects.filter(o=>o.id!=='venue');revision++;
  const afterDeletion=JSON.stringify(doc);sim.update(0);
  assert(!actor._venue,'The missing venue must release its visit rather than keep a resident inside forever');
  assert(sim.events.some(e=>e.type==='venue-unavailable'&&e.id===actor.id));
  assert.equal(actor.hidden,false);
  if(hasTower){
   assert.equal(actor.state,'home');assert.equal(actor.location.kind,'apartment');assert.equal(actor.location.resident,actor.id);
   assert.equal(sim.interiorActors({kind:'apartment',resident:actor.id,floor:actor.location.floor}).length,1);
  }else{
   assert.equal(actor.location.kind,'street');assert.equal(blocked(doc,actor.x,actor.y,catalog),false);
   assert(sim.actors.some(a=>a.id===actor.id));
  }
  assert.equal(sim.interiorActors({kind, floor:1}).length,0,'The deleted interior must not retain the recovered visitor');
  assert.equal(JSON.stringify(doc),afterDeletion,'Recovery must not rewrite the remaining authored map');
 });
}

test('six simultaneous visitors reserve one staging approach and distinct overflow holds',()=>{
 const doc=blank();doc.spawn={x:8192,y:6800};
 doc.objects.push({id:'tower',asset:'coda-residences',x:8192,y:6144,scale:1,rotation:0,layer:'objects',collision:true});
 const catalog=new Map([['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}]]);
 const sim=createAmbientNPCs({getProject:()=>doc,catalog,count:6});sim.update(0);
 const entrance=sim.district.tower,line=sim.queues.find(q=>q.entranceId===entrance.id).layout,tail=line.slots.at(-1),staging={x:tail.x,y:tail.y+86};
 const offsets=[[0,100],[200,50],[-200,50],[280,-180],[-280,-180],[0,-300]];
 sim.residents.forEach((actor,i)=>Object.assign(actor,{x:staging.x+offsets[i][0],y:staging.y+offsets[i][1],_wait:100,_homeDue:Infinity}));
 const before=JSON.stringify(doc);
 for(const actor of sim.residents)assert(sim.visit(actor.id,entrance.id));
 assert.equal(sim.residents.filter(a=>a._queuePhase==='approach').length,1,'One unjoined resident must own the staging target');
 assert.equal(sim.residents.filter(a=>a._queuePhase==='overflow').length,5);
 const entered=new Set();let observedOverflow=false;
 for(let frame=0;frame<7200&&entered.size<6;frame++){
  sim.update(1/60);
  const approaching=sim.residents.filter(a=>a.location.kind==='street'&&a._queuePhase==='approach');
  assert(approaching.length<=1,'Unjoined visitors converged on a shared staging endpoint');
  const holds=sim.residents.filter(a=>a.location.kind==='street'&&a._queuePhase==='overflow').map(a=>a._goal?.approach||a);
  if(holds.length>=3)observedOverflow=true;
  for(let i=0;i<holds.length;i++)for(let j=i+1;j<holds.length;j++)assert(Math.hypot(holds[i].x-holds[j].x,holds[i].y-holds[j].y)>=85-.01,'Overflow visitors received the same or overlapping hold points');
  for(const event of sim.events)if(event.type==='enter-building')entered.add(event.id);
 }
 assert(observedOverflow);assert.equal(entered.size,6,'All six visitors must eventually enter instead of blocking shared endpoints');
 const serviceOrders=sim.events.filter(e=>e.type==='queue-service').map(e=>e.joinOrder);
 assert(serviceOrders.length>=6);
 for(let i=1;i<serviceOrders.length;i++)assert(serviceOrders[i]>serviceOrders[i-1],'Service must retain physical FIFO join order');
 assert.equal(JSON.stringify(doc),before);
});

for(const blockerKind of ['player','resident']){
 test(`a seated resident waits for a ${blockerKind} to clear the bench walk-up point`,()=>{
  const doc=blank();doc.spawn={x:8192,y:6800};let player=null;
  doc.objects.push({id:'tower',asset:'coda-residences',x:8192,y:6144,scale:1,rotation:0,layer:'objects',collision:true},{id:'bench',asset:'decor-06-01',x:8500,y:6350,scale:1,rotation:0,layer:'objects',collision:true});
  const catalog=new Map([['coda-residences',{w:400,h:600,urban:'tower',door:{x:200,y:600},boxes:[]}],['decor-06-01',{w:200,h:160,boxes:[{x:0,y:70,w:200,h:50}]}]]);
  const sim=createAmbientNPCs({getProject:()=>doc,getPlayer:()=>player,catalog,count:3});sim.update(0);
  const actor=sim.residents[2],bench=sim.district.benches[0],seatId=actor.seatId;
  assert(actor.seated&&seatId);assert.equal(sim.seatClaims.get(seatId),actor.id);
  const blocker=blockerKind==='player'?(player={...bench.approach}):sim.residents[0];
  if(blockerKind==='resident'){Object.assign(blocker,bench.approach);sim.setConversation(blocker.id,true,{x:blocker.x+80,y:blocker.y});}
  const before=JSON.stringify(doc),seat={x:actor.x,y:actor.y};actor._wait=0;
  sim.update(1/60);
  assert(actor.seated);assert.deepEqual({x:actor.x,y:actor.y},seat,'Standing must not teleport a resident onto someone at the walk-up point');
  assert.equal(sim.seatClaims.get(seatId),actor.id);
  assert.equal(sim.visit(actor.id,sim.district.tower.id),false,'A requested entrance trip must wait for safe room to stand');
  assert(actor.seated);assert.equal(sim.seatClaims.get(seatId),actor.id);
  blocker.x+=150;
  assert.equal(sim.visit(actor.id,sim.district.tower.id),true);
  assert.equal(actor.seated,false);assert.equal(sim.seatClaims.has(seatId),false);
  assert.deepEqual({x:actor.x,y:actor.y},bench.approach);
  assert.equal(blocked(doc,actor.x,actor.y,catalog),false);
  assert(sim.events.some(e=>e.type==='stand'&&e.id===actor.id));
  assert.equal(JSON.stringify(doc),before);
 });
}
