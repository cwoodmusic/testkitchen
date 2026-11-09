import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,blocked} from './model.mjs';
import {createEntranceQueues} from './entrance-queue.mjs';

const door=(id='tower',facing='down')=>({id,kind:'tower',threshold:{x:8192,y:6144},approach:{x:8192,y:6212},door:{x:8192,y:6116},facing});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

test('a bounded FIFO line advances without losing places or duplicating actors',()=>{
 const e=door(),queues=createEntranceQueues({getEntrances:()=>[e]});
 assert(queues.request('bach',e.id));assert(queues.request('clara',e.id));assert(queues.request('nina',e.id));
 assert(!queues.request('ella',e.id));assert(queues.request('clara',e.id));assert.equal(queues.size,3);
 assert.equal(queues.target('bach').head,true);assert.equal(queues.target('nina').index,2);
 assert(!queues.claim('clara'));assert(!queues.claim('bach',{x:9000,y:9000}));
 assert(queues.claim('bach',queues.target('bach').point));assert(queues.target('bach').active);
 assert(queues.request('ella',e.id),'The active door user no longer occupies a waiting slot');
 const line=queues.inspect(e.id);assert.deepEqual(line.map(a=>a.id),['bach','clara','nina','ella']);
 assert.equal(queues.target('clara').slotIndex,0);assert.equal(queues.target('ella').slotIndex,2);
 assert(queues.release('bach'));assert.equal(queues.target('clara').head,true);
 assert(queues.claim('clara',queues.target('clara').point));assert.equal(queues.target('nina').slotIndex,0);
 assert.equal(queues.release('missing'),false);
});

test('all four facings keep one straight incoming lane separate from the exit',()=>{
 const vectors={down:{x:0,y:1},left:{x:-1,y:0},up:{x:0,y:-1},right:{x:1,y:0}};
 const opposites={down:'up',left:'right',up:'down',right:'left'};
 for(const facing of Object.keys(vectors)){
  const e=door('door:'+facing,facing),q=createEntranceQueues({getEntrances:()=>[e]});
  const l=q.layout(e.id),f=vectors[facing],right={x:f.y,y:-f.x};
  assert.equal(l.shared,false);assert.equal(l.capacity,3);assert(distance(l.entry,l.exit)>=72);
  assert.equal(dot({x:l.entry.x-l.door.x,y:l.entry.y-l.door.y},right),-36);
  assert.equal(dot({x:l.exit.x-l.door.x,y:l.exit.y-l.door.y},right),36);
  for(let i=0;i<l.slots.length;i++){
   assert.equal(dot({x:l.slots[i].x-l.entry.x,y:l.slots[i].y-l.entry.y},f),86*(i+1));
   if(i)assert.equal(distance(l.slots[i],l.slots[i-1]),86);
  }
  q.request('resident',e.id);assert.equal(q.target('resident').facing,opposites[facing]);
 }
});

test('real non-player flower obstacles shorten a queue without changing saved collision flags',()=>{
 const doc=blank(),e=door(),catalog=new Map([['flowers',{w:600,h:40,boxes:[{x:0,y:0,w:600,h:40}],npcAvoid:true}]]);
 doc.objects.push({id:'flowerbed',asset:'flowers',x:e.threshold.x,y:e.threshold.y+280,scale:1,rotation:0,collision:false,layer:'overgrowth'});
 const before=JSON.stringify(doc),q=createEntranceQueues({getEntrances:()=>[e],getProject:()=>doc,catalog});
 assert(!blocked(doc,e.threshold.x,e.threshold.y+258,catalog),'Player collision remains switched off');
 const layout=q.layout(e.id);assert.equal(layout.capacity,2);assert(q.request('one',e.id));assert(q.request('two',e.id));assert(!q.request('three',e.id));
 assert.equal(JSON.stringify(doc),before);
});

test('a shared narrow doorway serializes entrance and exit claims while keeping the line aside',()=>{
 const e=door(),clear=p=>p.y-e.threshold.y>=45||Math.abs(p.x-e.threshold.x)<=10;
 const q=createEntranceQueues({getEntrances:()=>[e],pointClear:clear}),l=q.layout(e.id);
 assert(l?.shared);assert.deepEqual(l.entry,e.threshold);assert.deepEqual(l.exit,e.threshold);
 assert(l.slots.every(p=>clear(p)));assert(l.corridorRun>=180);assert(l.slots[0].y>=e.threshold.y+l.corridorRun+86);assert(Math.abs(l.exitClear.x-e.threshold.x)>=72);
 assert(q.request('incoming',e.id));assert(q.claimExit('outgoing',e.id));assert(!q.claim('incoming'));
 assert.equal(q.target('outgoing').direction,'out');assert.deepEqual(q.target('outgoing').point,l.exitClear);
 q.release('outgoing');assert(q.claim('incoming',q.target('incoming').point));assert(!q.claimExit('another-exit',e.id));
 q.release('incoming');assert(q.claimExit('another-exit',e.id));
});

test('wide entrances allow one outgoing walker beside the incoming head',()=>{
 const e=door(),q=createEntranceQueues({getEntrances:()=>[e]});q.request('incoming',e.id);assert(q.claim('incoming'));
 assert(q.claimExit('outgoing',e.id));assert(!q.claimExit('second-outgoing',e.id));
 assert(distance(q.target('incoming').entry,q.target('outgoing').exit)>=72);
 q.release('outgoing');assert(q.claimExit('second-outgoing',e.id));
});

test('an obstructed entrance rejects admission and a full destination does not discard another place',()=>{
 const a=door('a'),b={...door('b'),threshold:{x:10000,y:6144}},list=[a,b];
 const q=createEntranceQueues({getEntrances:()=>list});q.request('transfer',a.id);
 for(const id of ['b1','b2','b3'])assert(q.request(id,b.id));
 assert(!q.request('transfer',b.id));assert.equal(q.target('transfer').entranceId,'a');
 const blockedQueue=createEntranceQueues({getEntrances:()=>list,pointClear:()=>false});assert.equal(blockedQueue.layout(a.id),null);assert(!blockedQueue.request('resident',a.id));
 assert(!q.request('unknown','not-a-door'));
});

test('moving a building updates targets and returned coordinates cannot mutate queue geometry',()=>{
 const e=door(),q=createEntranceQueues({getEntrances:()=>[e]});q.request('resident',e.id);
 const before=q.target('resident');before.point.x=-1;assert.notEqual(q.target('resident').point.x,-1);
 const layout=q.layout(e.id);layout.slots[0].y=-1;assert.notEqual(q.layout(e.id).slots[0].y,-1);
 e.threshold.x+=240;e.approach.x+=240;e.door.x+=240;
 assert.equal(q.target('resident').point.x,8192+240-36);
 q.clear();assert.equal(q.size,0);assert.deepEqual(q.inspect(e.id),[]);assert.equal(q.target('resident'),null);
});

test('waiting exits at a shared door cannot be starved by a continuous incoming line',()=>{
 const e=door(),clear=p=>p.y-e.threshold.y>=45||Math.abs(p.x-e.threshold.x)<=10;
 const q=createEntranceQueues({getEntrances:()=>[e],pointClear:clear});
 for(const id of ['in1','in2','in3'])assert(q.request(id,e.id));
 assert(q.claim('in1'));assert(!q.claimExit('out1',e.id));assert(!q.claimExit('out2',e.id));
 assert.equal(q.pendingExitCount,2);assert.equal(q.target('out1'),null);assert.equal(q.pendingExitCount,2,'Reading a pending target must not cancel its exit intent');
 q.release('in1');
 assert(!q.claim('in2'),'The next incoming actor must let an already waiting exit through');
 assert(!q.claimExit('out2',e.id),'Later exits must not overtake the earliest request');
 assert(q.claimExit('out1',e.id));assert(!q.claim('in2'));q.release('out1');
 assert(!q.claim('in2'),'The second waiting exit must also receive a turn');
 assert(q.claimExit('out2',e.id));q.release('out2');
 assert.equal(q.pendingExitCount,0);assert(q.claim('in2'));
});

test('canceling an exit intent releases shared-door priority and clear removes all intents',()=>{
 const e=door(),clear=p=>p.y-e.threshold.y>=45||Math.abs(p.x-e.threshold.x)<=10;
 const q=createEntranceQueues({getEntrances:()=>[e],pointClear:clear});q.request('in1',e.id);q.request('in2',e.id);q.claim('in1');
 assert(!q.claimExit('canceled',e.id));assert(q.release('canceled'));assert.equal(q.pendingExitCount,0);
 q.release('in1');assert(q.claim('in2'),'Canceled exit must not hold up the next visitor');
 assert(!q.claimExit('another',e.id));q.clear();assert.equal(q.pendingExitCount,0);assert(q.claimExit('fresh',e.id));
});

test('pending exit requests are bounded and wide entrances retain parallel incoming use',()=>{
 const e=door(),q=createEntranceQueues({getEntrances:()=>[e],exitCapacity:2});
 q.request('in1',e.id);q.request('in2',e.id);assert(q.claim('in1'));assert(q.claimExit('out1',e.id));
 assert(!q.claimExit('out2',e.id));assert(!q.claimExit('out3',e.id));assert(!q.claimExit('out4',e.id));assert.equal(q.pendingExitCount,2);
 q.release('in1');assert(q.claim('in2'),'Separate exit lane must not block incoming service');
 q.release('out1');assert(!q.claimExit('out4',e.id),'A new exit must not displace a full pending line');
 assert(q.claimExit('out2',e.id));q.release('out2');assert(!q.claimExit('out4',e.id),'Newly admitted exit must join behind the earlier waiter');
 assert(q.claimExit('out3',e.id));q.release('out3');assert(q.claimExit('out4',e.id));
});

const segmentDistance=(p,a,b)=>{
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length)):0;
 return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
};

test('shared frontage reserves its whole corridor and exits turn clear of the waiting line',()=>{
 const vectors={down:{x:0,y:1},left:{x:-1,y:0},up:{x:0,y:-1},right:{x:1,y:0}};
 for(const facing of Object.keys(vectors)){
  const e=door('narrow:'+facing,facing),f=vectors[facing],r={x:f.y,y:-f.x};
  const local=p=>({forward:dot({x:p.x-e.threshold.x,y:p.y-e.threshold.y},f),side:dot({x:p.x-e.threshold.x,y:p.y-e.threshold.y},r)});
  const clear=p=>{const q=local(p);return q.forward>=160||Math.abs(q.side)<=24;};
  const q=createEntranceQueues({getEntrances:()=>[e],pointClear:clear}),layout=q.layout(e.id);
  assert(layout?.shared);assert(layout.corridorRun>=180);assert.equal(layout.exitVia.length,1);
  assert.deepEqual(layout.exitRoute,[layout.exit,...layout.exitVia,layout.exitClear]);
  assert(Math.abs(local(layout.exitClear).side)>=72);assert.equal(local(layout.exitClear).forward,layout.corridorRun);
  for(const slot of layout.slots){
   assert(local(slot).forward>=layout.corridorRun+86,'Waiting actor occupies the outgoing corridor');
   for(let i=1;i<layout.exitRoute.length;i++)assert(segmentDistance(slot,layout.exitRoute[i-1],layout.exitRoute[i])>=72,'A waiting place intersects the exit route');
  }
  for(let i=1;i<layout.exitRoute.length;i++){
   const a=layout.exitRoute[i-1],b=layout.exitRoute[i];assert(a.x===b.x||a.y===b.y,'Shared exit route must make an explicit cardinal turn');
   for(let k=0;k<=24;k++)assert(clear({x:a.x+(b.x-a.x)*k/24,y:a.y+(b.y-a.y)*k/24}));
  }
  q.request('incoming',e.id);q.claimExit('outgoing',e.id);
  const outgoing=q.target('outgoing');assert.deepEqual(outgoing.exitVia,layout.exitVia);assert.deepEqual(outgoing.exitRoute,layout.exitRoute);
  for(let i=1;i<outgoing.exitRoute.length;i++){
   const a=outgoing.exitRoute[i-1],b=outgoing.exitRoute[i];
   for(let k=0;k<=60;k++)assert(distance({x:a.x+(b.x-a.x)*k/60,y:a.y+(b.y-a.y)*k/60},q.target('incoming').point)>=68);
  }
  q.release('outgoing');assert(q.claim('incoming',q.target('incoming').point));
  const start=layout.slots[0];
  for(let k=0;k<=60;k++)assert(distance({x:start.x+(layout.entry.x-start.x)*k/60,y:start.y+(layout.entry.y-start.y)*k/60},layout.exitClear)>=68,'Incoming head faces off with an actor who already cleared the exit');
 }
});

test('a single-width passage without a safe lateral clearing pocket does not admit a queue',()=>{
 const e=door(),q=createEntranceQueues({getEntrances:()=>[e],pointClear:p=>Math.abs(p.x-e.threshold.x)<=10});
 assert.equal(q.layout(e.id),null);assert(!q.request('incoming',e.id));assert(!q.claimExit('outgoing',e.id));
});
