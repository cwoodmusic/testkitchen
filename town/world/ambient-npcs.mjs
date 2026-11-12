import {blocked,height,TILE} from './model.mjs?v=north-walls-1';
import {movePlayer} from './physics.mjs?v=north-walls-1';
import {WALK_SPEED,GAIT_PER_PIXEL,PLAYER_SCALE} from './player-settings.mjs?v=north-walls-1';
import {buildNPCDistrict} from './npc-district.mjs?v=north-walls-1';
import {createNPCNavigator,npcPavingAt,npcMaterialCost} from './npc-navigation.mjs?v=north-walls-1';
import {residents as profiles,residentHomePose,interiorJourneyPose,residentInScene} from './resident-journey.mjs?v=north-walls-1';
import {createEntranceQueues} from './entrance-queue.mjs?v=north-walls-1';
import {venueVisitPose,SHOP_VISIT_CAPACITY} from './resident-venue.mjs?v=north-walls-1';
import {planNPCPassing} from './npc-passing.mjs?v=north-walls-1';
export {planNPCPath,npcConnectionClear} from './npc-navigation.mjs?v=north-walls-1';

export const AMBIENT_RESIDENTS=Object.freeze(['bach','mozart','clara','nina','joplin','miles','chopin','haydn','vee-jay','zizi','beethoven','ellington','ella','handel','vivaldi','metronome','schoenberg','dj']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const facing=(a,b)=>Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?b.x<a.x?'left':'right':b.y<a.y?'up':'down';
function randomSource(seed=0x63cd1a){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const street={kind:'street'},forwardVectors={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}};
const vendorLines=name=>/coffee/i.test(name)?[
 'The espresso machine keeps a surprisingly good rhythm. I call this morning’s blend the Coda Roast.',
 'A warm cup, a little night music, and a seat in the square. That’s a lovely evening.'
]:/bakery|bread/i.test(name)?[
 'I knead along to the music from the square. The bread seems to rise better with a good melody.',
 'The first tray is always my favourite part of the day. That warm bread smell travels right down the street.'
]:/flower/i.test(name)?[
 'I’m arranging these colours like notes in a chord. A little contrast makes everything sing.',
 'The flowers catch the glow of the street lamps beautifully. Have a look at the little blue ones.'
]:['There’s always something to listen to in Coda Town. Have you heard the music in the square?', 'I love watching the neighbourhood come alive around these little stalls.'];

// Residents belong to the city, not the viewport. Their positions, activities
// and indoor journeys continue when the player pans away or enters a building.
export function createAmbientNPCs({getProject,catalog,getRevision=()=>0,getPlayer,count=18,random=randomSource()}={}){
 let activeDoc=null,lastRevision,city=null,people=[],vendors=[],renderer=null,elapsed=0,socialAt=0,eventSequence=0,joinSequence=0,passingBudget=1;
 let rendezvous=null,rendezvousSequence=0,lastChatAt=0,rendezvousRetryAt=48;
 const claims=new Map(),stageClaims=new Map(),approachClaims=new Map(),overflowClaims=new Map(),events=[];
 const navigator=createNPCNavigator({getProject,catalog,getBounds:()=>city?.bounds,budgetMs:1.5});
 const entrances=createEntranceQueues({getEntrances:()=>city?.anchors.filter(a=>['tower','shop','arcade'].includes(a.kind))||[],getProject,catalog,pointClear:p=>clearPoint(p),connectionClear:(a,b)=>navigator.connectionClear(a,b)});
 const outdoor=()=>people.filter(a=>a.location.kind==='street'&&!a.hidden);
 const record=(type,actor,extra={})=>{events.push({type,id:actor.id,time:elapsed,sequence:++eventSequence,...extra});if(events.length>512)events.shift();};
 const inDistrict=p=>city&&p.x>=city.bounds.x0&&p.x<=city.bounds.x1&&p.y>=city.bounds.y0&&p.y<=city.bounds.y1;
 function clearPoint(p){return inDistrict(p)&&!blocked(navigator.collisionView(p),p.x,p.y,catalog);}
 function standingNear(wanted,index=0,spread=true){
  if(!wanted)return null;
  const candidates=[];
  for(let ring=0;ring<8;ring++)for(let i=0;i<(ring?12:1);i++){
   const angle=(i/12+index*.137)*Math.PI*2,r=ring*48,p={x:wanted.x+Math.cos(angle)*r,y:wanted.y+Math.sin(angle)*r};
   if(!clearPoint(p)||spread&&(outdoor().some(a=>distance(a,p)<85)||[...overflowClaims.values()].some(a=>distance(a,p)<85)||rendezvous?.members.some(m=>distance(m.point,p)<85)))continue;
   candidates.push({...p,score:r+npcMaterialCost(npcPavingAt(activeDoc,catalog,p))*18});
  }
  candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
 }
 function releaseEntrance(actor,reason='finished'){
  const target=entrances.target(actor.id);
  const entranceId=actor._entranceIntent?.building.id||target?.entranceId;
  if(target)record('queue-release',actor,{entranceId:target.entranceId,direction:target.direction,joinOrder:actor._entranceIntent?.joinOrder,reason});
  for(const [id,owner]of approachClaims)if(owner===actor.id)approachClaims.delete(id);
  overflowClaims.delete(actor.id);
  entrances.release(actor.id);delete actor._entranceIntent;delete actor._queuePoint;delete actor.queueEntranceId;delete actor.queueIndex;delete actor._queuePhase;
  if(entranceId)wakeApproach(entranceId);
 }
 function releaseStage(actor){
  if(actor.stageId&&stageClaims.get(actor.stageId)===actor.id)stageClaims.delete(actor.stageId);
  delete actor.stageId;delete actor.stagePhase;delete actor._stage;delete actor.groundAnchor;
 }
 function overflowSpot(actor,building){
  const sides=city.anchors.filter(a=>a.kind==='hangout'&&a.objectId===building.objectId);
  return sides[actor._index%Math.max(1,sides.length)]||city.anchors.find(a=>a.kind==='plaza')||building;
 }
 function wakeApproach(entranceId){
  if(approachClaims.has(entranceId))return;
  const layout=entrances.layout(entranceId);
  if(!layout||entrances.inspect(entranceId).filter(p=>p.direction==='in'&&p.waiting).length>=layout.capacity)return;
  const tail=layout.slots.at(-1),next=people.filter(a=>a._entranceIntent?.building.id===entranceId&&a._queuePhase==='overflow'&&!a._held).sort((a,b)=>distance(a,tail)-distance(b,tail))[0];
  if(next)next._entranceIntent.retryAt=Math.min(next._entranceIntent.retryAt,elapsed+.15);
 }
 function requestLine(actor){
  const intent=actor._entranceIntent;if(!intent)return false;
  if(entrances.request(actor.id,intent.building.id)){
   if(!intent.joinOrder){intent.joinOrder=++joinSequence;record('queue-join',actor,{entranceId:intent.building.id,joinOrder:intent.joinOrder,purpose:intent.purpose});}
   if(approachClaims.get(intent.building.id)===actor.id)approachClaims.delete(intent.building.id);
   overflowClaims.delete(actor.id);actor.queueEntranceId=intent.building.id;actor._queuePhase='joining';wakeApproach(intent.building.id);return true;
  }
  waitOutsideLine(actor);return false;
 }
 function waitOutsideLine(actor){
  const intent=actor._entranceIntent;
  if(approachClaims.get(intent.building.id)===actor.id)approachClaims.delete(intent.building.id);
  overflowClaims.delete(actor.id);
  intent.retryAt=elapsed+4+random()*4;actor._queuePhase='overflow';
  const spot=overflowSpot(actor,intent.building),origin=spot.approach||spot;
  const p=standingNear(origin,actor._index);
  if(p){overflowClaims.set(actor.id,p);go(actor,{id:intent.building.id+':overflow',kind:'queue-overflow',approach:p,...p,_arrival:true});}
  else{cancel(actor);actor.state='queue-wait';actor.walking=false;actor.purpose='Waiting near the entrance';overflowClaims.set(actor.id,{x:actor.x,y:actor.y});}
 }
 function beginEntrance(actor,building,purpose){
  const layout=entrances.layout(building.id);if(!layout){idle(actor,4);return false;}
  if(actor.seated&&!stand(actor))return false;
  cancelRendezvous(actor,'entrance visit');
  if(actor.conversation)endChat(actor);releaseEntrance(actor,'new destination');releaseStage(actor);
  actor._entranceIntent={building,purpose,retryAt:0,joinOrder:null};actor._queuePhase='approach';
  if(approachClaims.has(building.id)||entrances.inspect(building.id).filter(p=>p.direction==='in'&&p.waiting).length>=layout.capacity){waitOutsideLine(actor);return true;}
  approachClaims.set(building.id,actor.id);
  const tail=layout.slots.at(-1),f=forwardVectors[layout.facing],wanted={x:tail.x+f.x*86,y:tail.y+f.y*86};
  const point=clearPoint(wanted)&&navigator.connectionClear(tail,wanted)?wanted:tail;
  go(actor,{id:building.id+':approach',kind:'queue-approach',approach:point,...point,_arrival:true},purpose==='home');return true;
 }
 function updateLines(){
  for(const actor of people){
   const intent=actor._entranceIntent;if(!intent||actor.location.kind!=='street'||actor._held||actor.state==='entering')continue;
   const layout=entrances.layout(intent.building.id);if(!layout){releaseEntrance(actor,'entrance unavailable');idle(actor,4);continue;}
   let target=entrances.target(actor.id);
   if(!target){
    if(elapsed<intent.retryAt)continue;
    if(actor._queuePhase==='overflow'){beginEntrance(actor,intent.building,intent.purpose);continue;}
    // Join from the staging point behind the tail, never from a nearby side
    // approach that could put a later arrival across the leader's path.
    if(actor._queuePhase==='approach')continue;
    if(!requestLine(actor))continue;target=entrances.target(actor.id);if(!target)continue;
   }
   actor.queueIndex=target.slotIndex;
   if(target.active)continue;
   if(!actor._queuePoint||distance(actor._queuePoint,target.point)>3){
    actor._queuePoint={...target.point};actor._queuePhase='slot';
    go(actor,{id:intent.building.id+':slot',kind:'queue-slot',approach:target.point,...target.point,_arrival:true},intent.purpose==='home');continue;
   }
   if(actor.state!=='queuing')continue;
   actor.facing=target.facing;actor.purpose='Waiting in line';
   if(target.head&&!(intent.purpose==='shop'&&people.filter(a=>a._venue?.kind==='shop').length>=SHOP_VISIT_CAPACITY)&&entrances.claim(actor.id,actor)){
    record('queue-service',actor,{entranceId:target.entranceId,joinOrder:intent.joinOrder});actor._queuePhase='entry';
    go(actor,{id:intent.building.id+':door',kind:'queue-door',approach:target.entry,...target.entry,_arrival:true},intent.purpose==='home');
   }
  }
 }
 function startVenue(actor,building){
  const occupied=new Set(people.filter(a=>a._venue?.kind==='shop').map(a=>a._venue.slot));
  const slot=building.kind==='shop'?Array.from({length:SHOP_VISIT_CAPACITY},(_,i)=>(i+actor._index)%SHOP_VISIT_CAPACITY).find(i=>!occupied.has(i)):undefined;
  actor._venue={kind:building.kind,elapsed:0,stay:20+random()*24,entranceId:building.id,slot};actor.state=building.kind==='shop'?'shopping':'arcade';actor.walking=false;
  record('enter-venue',actor,{entranceId:building.id,kind:building.kind});applyVenue(actor,0);
 }
 function exitBuilding(actor,building){
  const layout=entrances.layout(building.id);if(!layout||!entrances.claimExit(actor.id,building.id))return false;
  const target=entrances.target(actor.id),p=target.exit,player=getPlayer?.();
  if(!clearPoint(p)||outdoor().some(a=>a!==actor&&distance(a,p)<44)||player&&distance(player,p)<44)return false;
  Object.assign(actor,p,{location:{...street},hidden:false,alpha:0,facing:layout.facing,_journey:null,_venue:null,_homeDue:building.kind==='tower'?elapsed+55+random()*65:actor._homeDue});
  actor.queueEntranceId=building.id;actor._queuePhase='exit';
  record('exit-building',actor,{entranceId:building.id,position:{...p},door:layout.door});
  const [first,...rest]=[...(target.exitVia||[]),target.exitClear];
  go(actor,{id:building.id+':exit',kind:'queue-exit',approach:first,...first,_via:rest,_arrival:true});return true;
 }
 function applyVenue(actor,dt){
  const visit=actor._venue;visit.elapsed+=dt;const pose=venueVisitPose(actor.id,visit.kind,visit.elapsed,{stay:visit.stay,slot:visit.slot});
  Object.assign(actor,{x:pose.x,y:pose.y,location:{...pose.scene},facing:pose.facing,phase:pose.phase,walking:pose.walking,hidden:pose.hidden,activity:pose.activity,purpose:pose.purpose});
  if(pose.done){const building=city.anchors.find(a=>a.id===visit.entranceId);if(building)exitBuilding(actor,building);}
 }
 function beginStage(actor,stage){
  if(stageClaims.has(stage.id)&&stageClaims.get(stage.id)!==actor.id)return false;
  if(actor.seated&&!stand(actor))return false;
  cancelRendezvous(actor,'stage visit');
  if(actor.conversation)endChat(actor);releaseEntrance(actor,'stage visit');releaseStage(actor);
  stageClaims.set(stage.id,actor.id);actor._stage=stage;actor.stageId=stage.id;actor.stagePhase='approaching';
  record('stage-approach',actor,{stageId:stage.id});
  go(actor,{id:stage.id+':approach',kind:'stage-approach',approach:stage.approach,...stage.approach,_arrival:true});return true;
 }
 function leaveStage(actor){
  const stage=actor._stage;actor.stagePhase='leaving';record('stage-leave',actor,{stageId:stage.id});
  const [first,...rest]=stage.exit;
  go(actor,{id:stage.id+':exit',kind:'stage-exit',approach:first,...first,_via:rest,_arrival:true});
 }
 function releaseSeat(actor){if(actor.seatId&&claims.get(actor.seatId)===actor.id)claims.delete(actor.seatId);delete actor.seatId;actor.seated=false;delete actor.depth;delete actor.groundAnchor;}
 function idle(actor,wait=2){actor.state='idle';actor.activity='';actor.purpose='Taking in the neighbourhood';actor.walking=false;actor._wait=wait;actor._path=[];actor._pending=false;}
 function cancel(actor){navigator.cancel(actor.id);actor._routeToken++;actor._pending=false;actor._path=[];actor._passingRemaining=0;delete actor._passingStart;}
 function awayFromDoors(point){return city.anchors.filter(a=>['tower','shop','arcade'].includes(a.kind)).every(a=>distance(point,a.threshold||a)>320);}
 function socialCandidate(actor){
  return actor.location.kind==='street'&&!actor.hidden&&!actor.conversation&&!actor._held&&!actor._entranceIntent&&!actor.queueEntranceId&&!actor.stageId&&!actor.seatId&&!actor._goingHome&&!actor._passingRemaining&&!actor._rendezvous
   &&elapsed>=(actor._socialAfter||0)&&awayFromDoors(actor)
   &&(actor.state==='idle'&&actor._wait>2||actor.state==='walking'&&!actor._yield&&['hangout','plaza'].includes(actor._goal?.kind));
 }
 function releaseRendezvous(reason,resume=true){
  const meeting=rendezvous;if(!meeting)return null;rendezvous=null;rendezvousRetryAt=elapsed+5;
  for(const member of meeting.members){
   const actor=member.actor;delete actor._rendezvous;
   if(resume&&member.goal)actor._resumeGoal={...member.goal};else if(!resume)delete actor._resumeGoal;
  }
  record(reason==='complete'?'social-complete':'social-cancel',meeting.members[0].actor,{meetingId:meeting.id,partner:meeting.members[1].actor.id,reason});
  return meeting;
 }
 function cancelRendezvous(actor,reason='canceled',resume=true){
  if(!rendezvous||actor&&!rendezvous.members.some(m=>m.actor===actor))return;
  const meeting=releaseRendezvous(reason,resume);
  for(const {actor:member}of meeting.members){
   if(member.conversation)endChat(member);
   if(member.location.kind==='street'&&!member._entranceIntent&&!member.stageId){cancel(member);idle(member,.2);}
  }
 }
 function meetingPoints(a,b){
  const pair=[a,b],player=getPlayer?.(),occupied=[...outdoor().filter(actor=>!pair.includes(actor)),...vendors,...(player?[player]:[])];
  const clear=point=>clearPoint(point)&&awayFromDoors(point)&&occupied.every(actor=>distance(actor,point)>=85)&&[...overflowClaims.values()].every(p=>distance(p,point)>=85);
  const centers=[{x:(a.x+b.x)/2,y:(a.y+b.y)/2},a,b];
  for(const center of centers)for(const radius of [0,96,192])for(let angle=0;angle<(radius?4:1);angle++){
   const x=center.x+Math.cos(angle*Math.PI/2)*radius,y=center.y+Math.sin(angle*Math.PI/2)*radius;
   for(const axis of [{x:1,y:0},{x:0,y:1}]){
    const p={x:x-axis.x*60,y:y-axis.y*60},q={x:x+axis.x*60,y:y+axis.y*60};
    if(!clear(p)||!clear(q)||Math.abs(height(activeDoc,p.x,p.y)-height(activeDoc,q.x,q.y))>.5||!navigator.connectionClear(p,q))continue;
    const direct=distance(a,p)+distance(b,q)<=distance(a,q)+distance(b,p),points=direct?[p,q]:[q,p];
    if(distance(a,points[0])<=1400&&distance(b,points[1])<=1400)return points;
   }
  }
  return null;
 }
 function scheduleRendezvous(available){
  if(rendezvous||elapsed-lastChatAt<48||elapsed<rendezvousRetryAt)return;
  rendezvousRetryAt=elapsed+5;
  const pairs=[];
  for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){
   const a=available[i],b=available[j],gap=distance(a,b);if(gap>2400)continue;
   pairs.push({a,b,score:Math.max(a._lastChatAt??-100,b._lastChatAt??-100)*1000+gap});
  }
  pairs.sort((a,b)=>a.score-b.score);
  for(const {a,b}of pairs.slice(0,6)){
   const points=meetingPoints(a,b);if(!points)continue;
   const id='social:'+ ++rendezvousSequence;
   rendezvous={id,deadline:elapsed+25,phase:'approach',members:[a,b].map((actor,i)=>({actor,point:points[i],arrived:false,goal:actor.state==='walking'?{...actor._goal,_arrival:true}:actor._resumeGoal?{...actor._resumeGoal}:null}))};
   record('social-meeting',a,{meetingId:id,partner:b.id,points:[a,b].map((actor,i)=>({id:actor.id,...points[i]}))});
   for(const member of rendezvous.members){member.actor._rendezvous=id;go(member.actor,{id:id+':'+member.actor.id,kind:'social-meeting',approach:member.point,...member.point,_arrival:true});}
   return;
  }
 }
 function arriveRendezvous(actor){
  const member=rendezvous?.members.find(m=>m.actor===actor);if(!member){idle(actor,1);return;}
  member.arrived=true;actor.state='social-wait';actor.walking=false;actor.purpose='Waiting to catch up with '+rendezvous.members.find(m=>m!==member).actor.name;
  record('social-arrive',actor,{meetingId:rendezvous.id,partner:rendezvous.members.find(m=>m!==member).actor.id});
 }
 function updateRendezvous(){
  if(!rendezvous)return;
  const meeting=rendezvous;
  if(meeting.phase==='chat')return;
  if(elapsed>=meeting.deadline){cancelRendezvous(null,'meeting timeout');return;}
  if(meeting.members.some(({actor})=>actor.location.kind!=='street'||actor.hidden||actor._held||actor._entranceIntent||actor.queueEntranceId||actor.stageId||actor.seatId||!['walking','waiting','social-wait'].includes(actor.state))){cancelRendezvous(null,'meeting interrupted');return;}
  if(meeting.members.every(m=>m.arrived)){
   const [a,b]=meeting.members.map(m=>m.actor);
   if(distance(a,b)<75||distance(a,b)>160||!navigator.connectionClear(a,b)){cancelRendezvous(null,'meeting obstructed');return;}
   meeting.phase='chat';startChat(a,b);
  }
 }
 function endChat(actor){
  if(rendezvous?.phase==='chat'&&rendezvous.members.some(m=>m.actor===actor))releaseRendezvous('complete');
  const partner=people.find(p=>p.id===actor.conversation);delete actor.conversation;
  if(partner?.conversation===actor.id){delete partner.conversation;idle(partner,1.5+random()*2);}
  idle(actor,1.5+random()*2);
 }
 function startChat(a,b){
  for(const actor of [a,b])if(actor.state==='walking'&&actor._goal?.kind!=='social-meeting')actor._resumeGoal={...actor._goal,_arrival:true};
  cancel(a);cancel(b);const duration=8+random()*8;
  lastChatAt=elapsed;
  for(const [actor,other]of [[a,b],[b,a]]){actor.state='chatting';actor.activity='chatting';actor.conversation=other.id;actor.facing=facing(actor,other);actor._wait=duration;actor._lastChatAt=elapsed;actor._socialAfter=elapsed+duration+18+random()*18;actor.walking=false;actor.purpose='Talking with '+other.name;}
  record('chat',a,{partner:b.id,...(rendezvous?.phase==='chat'?{rendezvous:true,meetingId:rendezvous.id}:{})});
 }
 function home(actor,wait){
  cancelRendezvous(actor,'returning home');
  cancel(actor);delete actor._resumeGoal;releaseEntrance(actor);releaseStage(actor);releaseSeat(actor);const pose=residentHomePose(actor.id);
  Object.assign(actor,{x:pose.x,y:pose.y,facing:pose.facing,walking:false,activity:'',location:{...pose.scene},hidden:false,state:'home',purpose:'At home',_journey:null,_leaveAt:elapsed+wait});
 }
 function journey(actor,direction){
  cancel(actor);releaseSeat(actor);actor._journey={direction,elapsed:0};actor._doorWait=0;actor.state=direction==='out'?'departing':'returning';record(direction==='out'?'leave-room':'enter-building',actor,{position:{x:actor.x,y:actor.y},door:actor._lastDoor||city.tower?.threshold||city.tower?.approach,artDoor:city.tower?.door});
  applyJourney(actor,0);
 }
 function applyJourney(actor,dt){
  const trip=actor._journey;trip.elapsed+=dt;const pose=interiorJourneyPose(actor.id,trip.direction,trip.elapsed);
  if(pose.done){
   if(trip.direction==='home'){record('enter-room',actor);home(actor,24+random()*35);return;}
   if(!city.tower||!exitBuilding(actor,city.tower)){Object.assign(actor,{location:{kind:'lobby',floor:1},x:1152,y:1578,hidden:false,walking:false,purpose:'Waiting for the doorway'});}return;
  }
  Object.assign(actor,{x:pose.x,y:pose.y,facing:pose.facing,walking:pose.walking,phase:pose.phase,hidden:pose.hidden,location:{...pose.scene},activity:'',purpose:pose.activity});
 }
 function sit(actor,bench){
  actor._bench=bench;actor.seatId=bench.id;claims.set(bench.id,actor.id);actor.state='seated';actor.activity='relaxing';actor.seated=true;actor.groundAnchor=bench.ground;actor.walking=false;actor.facing=bench.facing;actor.depth=bench.seatedDepth??Math.max(bench.seat.y,bench.approach.y);actor.x=bench.seat.x;actor.y=bench.seat.y;actor._wait=16+random()*20;actor.purpose='Enjoying a seat in the square';record('sit',actor,{seat:bench.id});
 }
 function stand(actor){
  const bench=actor._bench,player=getPlayer?.();
  if(bench&&(outdoor().some(a=>a!==actor&&!a.seated&&distance(a,bench.approach)<56)||player&&distance(player,bench.approach)<56)){actor._wait=.5;return false;}
  releaseSeat(actor);if(bench){actor.x=bench.approach.x;actor.y=bench.approach.y;}actor._bench=null;idle(actor,1+random());record('stand',actor);return true;
 }
 function arrive(actor){
  const goal=actor._goal;actor._lastGoal=goal?.id;actor._visits++;actor.walking=false;
  if(goal?.kind==='social-meeting'){arriveRendezvous(actor);return;}
  if(goal?.kind==='queue-approach'){requestLine(actor);return;}
  if(goal?.kind==='queue-overflow'){actor.state='queue-wait';actor.walking=false;actor.purpose='Waiting near the entrance';return;}
  if(goal?.kind==='queue-slot'){actor.state='queuing';actor.walking=false;actor.purpose='Waiting in line';return;}
  if(goal?.kind==='queue-door'){actor.state='entering';actor.facing=entrances.target(actor.id)?.facing||'up';actor._wait=.55;actor.activity='';actor.purpose='Going through the doorway';return;}
  if(goal?.kind==='queue-exit'){releaseEntrance(actor,'cleared exit');idle(actor,.4+random());return;}
  if(goal?.kind==='stage-approach'){
   const stage=actor._stage;actor.stagePhase='stairs';actor.groundAnchor=stage.ground;record('stage-enter',actor,{stageId:stage.id,position:{x:actor.x,y:actor.y}});
   const [first,...rest]=stage.via;go(actor,{id:stage.id+':deck',kind:'stage-deck',approach:first,...first,_via:rest,_arrival:true});return;
  }
  if(goal?.kind==='stage-deck'){actor.state='on-stage';actor.stagePhase='deck';actor.activity='';actor.walking=false;actor._wait=12+random()*18;actor.purpose='Enjoying the gazebo stage';record('stage-deck',actor,{stageId:actor.stageId,position:{x:actor.x,y:actor.y}});return;}
  if(goal?.kind==='stage-exit'){const stageId=actor.stageId;releaseStage(actor);idle(actor,1);record('stage-exit',actor,{stageId,position:{x:actor.x,y:actor.y}});return;}
  if(goal?.kind==='bench'){sit(actor,goal);return;}
  if(goal?.kind==='exit'){idle(actor,.5+random());actor.purpose='Just left home';return;}
  if(actor._goingHome&&city.tower){actor.state='entering';actor.facing=city.tower.facing==='down'?'up':city.tower.facing==='up'?'down':city.tower.facing==='left'?'right':'left';actor._wait=.55;actor.activity='';actor.purpose='Opening the building door';return;}
  idle(actor,6+random()*12);actor.purpose=goal?.kind==='arcade'?'Outside Coda Arcade':goal?.kind==='shop'?'Window shopping':goal?.kind==='tower'?'Outside Coda Residences':'Enjoying the neighbourhood';record('arrive',actor,{destination:goal?.id});
 }
 function go(actor,goal,goingHome=false,avoid=[]){
  if(actor._rendezvous&&goal.kind!=='social-meeting')cancelRendezvous(actor,'new destination');
  delete actor._resumeGoal;
  if(!goal._arrival&&goal.kind==='stage'){if(!beginStage(actor,goal))idle(actor,3);return;}
  if(!goal._arrival&&(['shop','arcade'].includes(goal.kind)||goingHome&&goal.kind==='tower')){beginEntrance(actor,goal,goingHome?'home':goal.kind);return;}

  // Visitors gather beside the entrance. The central doorway is reserved for
  // the one resident currently returning home and for people walking out.
  if(!goingHome&&goal.kind==='tower'&&!goal._arrival){
   const sides=city.anchors.filter(a=>a.kind==='hangout'&&a.objectId===goal.objectId);
   if(sides.length)goal=sides[actor._index%sides.length];
  }
  // Entrances and hangouts are areas, not single standing pixels. Give each
  // resident an individual arrival spot so a crowd cannot occupy one node.
  if(goingHome&&!goal._arrival){
   const origin=city.tower?.threshold||goal.approach||goal,lateral=['left','right'].includes(city.tower?.facing)?{x:0,y:1}:{x:1,y:0},offset=(actor._index%3-1)*18;
   const wanted={x:origin.x+lateral.x*offset,y:origin.y+lateral.y*offset},p=clearPoint(wanted)&&navigator.connectionClear(origin,wanted)?wanted:origin;
   goal={...goal,x:p.x,y:p.y,approach:p,_arrival:true};
  }
  if(goal.kind!=='bench'&&!goal._arrival){
   const origin=goal.approach||goal,radius=goingHome?38:100;
   for(let n=0;n<8;n++){
    const angle=(actor._index*.618+n/8)*Math.PI*2,p={x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius};
    if(clearPoint(p)&&navigator.connectionClear(origin,p)){
     goal={...goal,approach:p,x:p.x,y:p.y,_arrival:true};break;
    }
   }
  }
  cancel(actor);actor._goal=goal;actor._goingHome=goingHome;actor.state='waiting';actor.purpose=goingHome?'Walking home':goal.kind==='bench'?'Going to sit down':'Visiting the neighbourhood';actor.walking=false;actor._pending=true;
  if(goal.kind==='bench'){actor.seatId=goal.id;claims.set(goal.id,actor.id);}
  const token=actor._routeToken;
  const target=goal.approach||goal,pinned=['queue-slot','queue-door','queue-exit','stage-deck','stage-exit'].includes(goal.kind);
  if(pinned&&(Math.abs(actor.x-target.x)<.01||Math.abs(actor.y-target.y)<.01)){
   const route=[target,...(goal._via||[])];let previous=actor,clear=true;
   for(const point of route){if(Math.abs(previous.x-point.x)>.01&&Math.abs(previous.y-point.y)>.01||!navigator.connectionClear(previous,point)){clear=false;break;}previous=point;}
   if(clear){actor._pending=false;actor._path=route.filter((p,i)=>distance(p,i?route[i-1]:actor)>.1);actor.state='walking';actor._stuck=0;actor._yield=0;actor._progress={x:actor.x,y:actor.y,time:elapsed};if(!actor._path.length)arrive(actor);return;}
  }
  navigator.request(actor.id,{x:actor.x,y:actor.y},goal.approach||goal,path=>{
   if(actor._routeToken!==token||actor.location.kind!=='street')return;
   actor._pending=false;
   const joined=path.length||distance(actor,target)<8,route=joined?[...path,...(goal._via||[])]:[];if(route.length){actor._path=route;actor.state='walking';actor._stuck=0;actor._yield=0;actor._progress={x:actor.x,y:actor.y,time:elapsed};}
   else if(distance(actor,goal.approach||goal)<8)arrive(actor);
   else{releaseSeat(actor);if(goal.kind.startsWith('queue-'))releaseEntrance(actor,'route unavailable');if(goal.kind.startsWith('stage-'))releaseStage(actor);idle(actor,2+random()*3);record('unreachable',actor,{destination:goal.id});}
  },{avoid});
 }
 function chooseDestination(actor){
  if(actor._resumeGoal){const goal=actor._resumeGoal;delete actor._resumeGoal;go(actor,goal);return;}
  if(actor._initialStage&&city.stages?.length){actor._initialStage=false;if(beginStage(actor,city.stages[0]))return;}
  if(city.tower&&elapsed>=actor._homeDue){go(actor,city.tower,true);return;}
  const free=city.benches.filter(b=>!claims.has(b.id)&&b.id!==actor._lastGoal);
  if(free.length&&(actor._visits+actor._index)%3!==0){const bench=free[Math.floor(random()*free.length)];go(actor,bench);return;}
  const choices=city.anchors.filter(a=>a.id!==actor._lastGoal&&distance(actor,a)>90&&(a.kind!=='stage'||!stageClaims.has(a.id)));
  if(!choices.length){idle(actor,3);return;}
  // Pick a real entrance or gathering spot. Variation happens in the choice
  // and the time spent there, rather than in random steps around the camera.
  go(actor,choices[Math.floor(random()*choices.length)]);
 }
 function initialize(doc){
  rendezvous=null;rendezvousSequence=0;lastChatAt=0;rendezvousRetryAt=48;
  people=[];claims.clear();stageClaims.clear();approachClaims.clear();overflowClaims.clear();entrances.clear();elapsed=0;socialAt=0;events.length=0;eventSequence=0;joinSequence=0;
  for(let i=0;i<Math.max(0,Math.min(18,count));i++){
   const id=AMBIENT_RESIDENTS[i],profile=profiles.find(p=>p.id===id),actor={id,name:profile?.name||id,role:'resident',x:city.center.x,y:city.center.y,facing:'down',walking:false,phase:i*.7,alpha:1,activity:'',state:'idle',location:{...street},hidden:false,speed:180+i%5*12,purpose:'Enjoying the neighbourhood',_index:i,_initialStage:i===4,_path:[],_wait:1+i*.35,_routeToken:0,_pending:false,_visits:0,_homeDue:38+i*8,_stuck:0,_yield:0};
   people.push(actor);
   if(city.tower&&i>=10){home(actor,4+(i-10)*6);continue;}
   const anchors=city.anchors,p=standingNear(anchors[i%Math.max(1,anchors.length)]||city.center,i);
   if(p)Object.assign(actor,p);else actor.hidden=true;
  }
  // A few residents are already enjoying the neighbourhood on arrival.
  for(const [index,slot]of [[2,0],[3,2]]){const actor=people[index],bench=city.benches[slot];if(actor&&!actor.hidden&&actor.location.kind==='street'&&bench)sit(actor,bench);}
  const gathering=city.anchors.find(a=>a.kind==='plaza')||city.anchors.find(a=>a.kind==='hangout');
  if(gathering&&people.length>=2){
   const a=people[0],b=people[1],p=standingNear({x:gathering.x-65,y:gathering.y},0,false),q=p&&standingNear({x:p.x+130,y:p.y},1,false);
   if(p&&q&&distance(p,q)>75&&distance(p,q)<200&&navigator.connectionClear(p,q)){Object.assign(a,p,{hidden:false});Object.assign(b,q,{hidden:false});startChat(a,b);}
  }
 }
 function sync(doc,revision){
  if(activeDoc===doc&&lastRevision===revision)return;
  cancelRendezvous(null,'geometry changed',false);
  const first=!activeDoc;activeDoc=doc;lastRevision=revision;city=buildNPCDistrict(doc,catalog);navigator.invalidate(revision);entrances.clear();stageClaims.clear();approachClaims.clear();overflowClaims.clear();
  vendors=city.vendors.map((v,i)=>({...v,role:'vendor',location:{...street},state:'vending',activity:'',walking:false,phase:0,alpha:1,hidden:false,dialogue:vendorLines(v.name),appearance:{hairstyle:['curly','short','buns'][i%3],skin:['#bf8862','#e0b38c','#98694e'][i%3],hair:['#3b3035','#665044','#332832'][i%3],shirt:['#607b72','#8e655c','#686c88'][i%3],lowerColor:'#3e4350',outfit:'waistcoat',headwear:i%3===1?'chef':'none',shoes:'loafers'}}));
  if(first){initialize(doc);return;}
  for(const actor of people){
   cancel(actor);delete actor._resumeGoal;releaseEntrance(actor,'geometry changed');releaseStage(actor);
   if(actor._venue&&!city.anchors.some(a=>a.id===actor._venue.entranceId)){
    actor._venue=null;record('venue-unavailable',actor);
    if(city.tower){home(actor,4+random()*8);continue;}
    Object.assign(actor,{location:{...street},hidden:true});
   }
   if(actor.location.kind!=='street')continue;
   if(actor.conversation)endChat(actor);releaseSeat(actor);actor._bench=null;
   if(!clearPoint(actor)||actor.hidden){const p=standingNear(city.tower?.approach||city.center,actor._index);if(p){Object.assign(actor,p);actor.hidden=false;}else actor.hidden=true;}
   idle(actor,1+random()*2);
  }
 }
 function walkActor(actor,dt){
  const progress=actor._progress;
  if(progress&&distance(actor,progress)>90)actor._progress={x:actor.x,y:actor.y,time:elapsed};
  else if(progress&&elapsed-progress.time>5){
   const player=getPlayer?.(),avoid=[...outdoor(),...vendors,...(player?[{...player,id:'__player__'}]:[])].filter(b=>b.id!==actor.id&&!b.seated&&distance(actor,b)<450).map(b=>({x:b.x,y:b.y,r:48}));
   go(actor,{...actor._goal,_arrival:true},actor._goingHome,avoid);return;
  }
  const target=actor._path[0];if(!target){arrive(actor);return;}
  const others=[...outdoor(),...vendors],player=getPlayer?.();if(player)others.push({...player,id:'__player__'});
  const peers=others.filter(b=>b.id!==actor.id&&!b.seated&&Math.abs(height(activeDoc,b.x,b.y)-height(activeDoc,actor.x,actor.y))<14);
  const closesBodyGap=next=>peers.some(b=>distance(next,b)<40&&distance(next,b)<distance(actor,b)-.01);
  const incoming=b=>b.queueEntranceId===actor.queueEntranceId&&b._queuePhase!=='exit'&&Number.isInteger(b.queueIndex);
  const leader=actor.queueEntranceId&&actor._queuePhase!=='exit'&&peers.filter(b=>incoming(b)&&b.queueIndex<actor.queueIndex).sort((a,b)=>b.queueIndex-a.queueIndex)[0];
  const lineForward=leader&&forwardVectors[entrances.layout(actor.queueEntranceId)?.facing];
  // A leader can briefly leave the lane while passing an unjoined visitor.
  // Keep its place along the whole lane until it has moved forward; a later
  // member must not occupy the leader's rejoin point during that detour.
  const closesLineGap=next=>lineForward&&(next.x-leader.x)*lineForward.x+(next.y-leader.y)*lineForward.y<68;
  const dx=target.x-actor.x,dy=target.y-actor.y;
  if(Math.abs(dx)<1.5&&Math.abs(dy)<1.5){
   if(closesBodyGap(target)||closesLineGap(target))return;
   actor.x=target.x;actor.y=target.y;actor._path.shift();
   if(actor._passingRemaining>0){actor._passingRemaining--;if(!actor._passingRemaining){delete actor._passingStart;delete actor._passingPartner;record('passing-clear',actor);}}
   if(!actor._path.length)arrive(actor);return;
  }
  const horizontal=Math.abs(dx)>Math.abs(dy),direction=horizontal?Math.sign(dx):Math.sign(dy),key=horizontal?direction<0?'a':'d':direction<0?'w':'s';
  let amount=Math.min(dt*actor.speed/WALK_SPEED,(horizontal?Math.abs(dx):Math.abs(dy))/WALK_SPEED);
  const vector={a:{x:-1,y:0},d:{x:1,y:0},w:{x:0,y:-1},s:{x:0,y:1}}[key];
  if(closesLineGap({x:actor.x+vector.x*amount*WALK_SPEED,y:actor.y+vector.y*amount*WALK_SPEED})){actor.purpose='Following the line';return;}
  const obstruction=peers.find(b=>distance(actor,b)<68&&(horizontal?(b.x-actor.x)*direction>8&&Math.abs(b.y-actor.y)<48:(b.y-actor.y)*direction>8&&Math.abs(b.x-actor.x)<48));
  if(obstruction){
   actor._yield+=dt;actor.purpose='Giving someone room';
   const sameLine=actor.queueEntranceId&&actor.queueEntranceId===obstruction.queueEntranceId&&actor._queuePhase!=='exit'&&obstruction._queuePhase!=='exit';
   if(sameLine&&actor.queueIndex>obstruction.queueIndex)return;
   if(!actor._passingRemaining){
    if(actor._yield<.35)return;
    // The other walker first clears a committed sideways/retreat waypoint;
    // this walker waits instead of entering that person's escape space.
    if(obstruction._passingRemaining&&obstruction._passingPartner===actor.id&&obstruction._passingStart&&distance(obstruction,obstruction._passingStart)<48)return;
    const next={x:actor.x+vector.x*amount*WALK_SPEED,y:actor.y+vector.y*amount*WALK_SPEED};
    const yielding=obstruction.role!=='resident'||actor._index>obstruction._index||obstruction._held||obstruction.state!=='walking'||closesBodyGap(next);
    if(yielding&&passingBudget&&elapsed>=(actor._passRetry||0)){
     passingBudget--;actor._passRetry=elapsed+1.2;
     const options={actor,path:actor._path,obstacle:obstruction,others:peers,connectionClear:(a,b)=>navigator.connectionClear(a,b),inside:inDistrict};
     let detour=planNPCPassing({...options,clearance:52});
     // Personal space can shrink in a narrow passage, while the hard foot
     // separation remains forty pixels and all static obstacles still apply.
     if(!detour&&actor._yield>=.8)detour=planNPCPassing({...options,clearance:40});
     if(detour){actor._path=detour.path;actor._passingRemaining=detour.bypassCount;actor._passingStart={x:actor.x,y:actor.y};actor._passingPartner=obstruction.id;actor._yield=0;record('passing-start',actor,{other:obstruction.id,side:detour.side,via:detour.bypassWaypoints,retreat:detour.retreat,clearance:detour.clearance});return;}
    }
    const priority=obstruction.role==='resident'&&obstruction.state==='walking'&&!obstruction._held&&peers.filter(b=>b.role==='resident'&&b.state==='walking'&&distance(actor,b)<110).every(b=>actor._index<=b._index);
    if(!priority)return;
    amount*=.72;
   }
   // A committed passing route keeps its chosen waypoints. Repeatedly
   // selecting a fresh perpendicular step here caused the original wobble.
  }else actor._yield=0;
  const next={x:actor.x+vector.x*amount*WALK_SPEED,y:actor.y+vector.y*amount*WALK_SPEED};
  if(closesBodyGap(next))return;
  const motion=movePlayer(navigator.collisionView(actor),actor,new Set([key]),amount,catalog);actor.walking=motion.walking;if(motion.facing)actor.facing=motion.facing;actor.phase=(actor.phase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);
  actor._stuck=motion.distance<.05?actor._stuck+dt:0;
  if(actor._stuck>.7){actor._stuck=0;go(actor,{...actor._goal,_arrival:true},actor._goingHome);}
 }
 function update(dt,_time){
  const doc=getProject?.();if(!doc)return;dt=Math.min(.1,Math.max(0,Number(dt)||0));sync(doc,getRevision());elapsed+=dt;passingBudget=1;
  navigator.update();
  for(const actor of people){
   actor.walking=false;actor.alpha=Math.min(1,actor.alpha+dt*2.5);
   if(actor._held){actor.facing=actor._talkFacing||actor.facing;continue;}
   if(actor._journey){applyJourney(actor,dt);continue;}
   if(actor._venue){applyVenue(actor,dt);continue;}
   if(actor.state==='home'){if(city.tower&&elapsed>=actor._leaveAt)journey(actor,'out');continue;}
   if(actor.hidden)continue;
   if(['waiting','queuing','queue-wait','social-wait'].includes(actor.state))continue;
   if(actor.state==='walking'){walkActor(actor,dt);continue;}
   actor._wait=Math.max(0,actor._wait-dt);
   if(actor.state==='seated'){if(!actor._wait)stand(actor);continue;}
   if(actor.state==='chatting'){if(!actor._wait)endChat(actor);continue;}
   if(actor.state==='entering'){
    if(!actor._wait){const intent=actor._entranceIntent;if(intent){const {building,purpose}=intent;actor._lastDoor=entrances.target(actor.id)?.entry;releaseEntrance(actor,'entered');if(purpose==='home')journey(actor,'home');else startVenue(actor,building);}else journey(actor,'home');}continue;
   }
   if(actor.state==='on-stage'){if(!actor._wait)leaveStage(actor);continue;}
   if(!actor._wait)chooseDestination(actor);
  }
  updateLines();
  updateRendezvous();
  if(elapsed>=socialAt){
   socialAt=elapsed+.75;
   const available=outdoor().filter(socialCandidate);
   for(const actor of available){const other=available.find(b=>b!==actor&&socialCandidate(b)&&distance(actor,b)>75&&distance(actor,b)<210&&navigator.connectionClear(actor,b));if(socialCandidate(actor)&&other)startChat(actor,other);}
   scheduleRendezvous(outdoor().filter(socialCandidate));
  }
 }
 function interiorActors(scene){return people.filter(a=>a.location.kind!=='street'&&!a.hidden&&residentInScene({...a,scene:a.location},scene)).map(a=>({...a}));}
 function setConversation(id,active,viewer){
  const actor=[...people,...vendors].find(a=>a.id===id);if(!actor)return;
  if(active){
   cancelRendezvous(actor,'player dialogue');
   if(actor.conversation)endChat(actor);
   actor._heldActivity=actor.activity;actor._held=true;actor.walking=false;actor.activity='chatting';
   if(viewer)actor.facing=actor._talkFacing=facing(actor,viewer);
  }else{actor._held=false;actor.activity=actor._heldActivity||'';delete actor._heldActivity;delete actor._talkFacing;}
 }
 function draw(ctx,actor,time=elapsed){
  if(!renderer&&globalThis.window?.createCodaCharacterRenderer)renderer=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});
  if(!renderer||actor.hidden)return;ctx.save();ctx.globalAlpha*=Number.isFinite(actor.alpha)?actor.alpha:1;renderer.drawNPC(ctx,actor,time);ctx.restore();
 }
 function reset(){rendezvous=null;lastChatAt=0;rendezvousRetryAt=48;activeDoc=null;people=[];vendors=[];claims.clear();stageClaims.clear();approachClaims.clear();overflowClaims.clear();entrances.clear();events.length=0;elapsed=0;}
 function visit(id,entranceId){const actor=people.find(a=>a.id===id),building=city?.anchors.find(a=>a.id===entranceId||a.objectId===entranceId);return !!(actor&&building&&['tower','shop','arcade'].includes(building.kind)&&actor.location.kind==='street'&&!actor._held&&beginEntrance(actor,building,building.kind==='tower'?'home':building.kind));}
 function visitStage(id,stageId){const actor=people.find(a=>a.id===id),stage=city?.stages.find(a=>a.id===stageId);return !!(actor&&stage&&actor.location.kind==='street'&&!actor._held&&beginStage(actor,stage));}
 return {update,draw,reset,interiorActors,setConversation,visit,visitStage,get queues(){return city?city.anchors.filter(a=>['tower','shop','arcade'].includes(a.kind)).map(a=>({entranceId:a.id,layout:entrances.layout(a.id),people:entrances.inspect(a.id)})):[];},get actors(){return [...outdoor(),...vendors];},get residents(){return people;},get district(){return city;},get events(){return events.slice();},get simulationTime(){return elapsed;},get navigationStats(){return navigator.stats;},get seatClaims(){return new Map(claims);}};
}
