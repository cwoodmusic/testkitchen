import {blocked,height,TILE} from './model.mjs?v=map-recovery-1';
import {movePlayer} from './physics.mjs?v=map-recovery-1';
import {WALK_SPEED,GAIT_PER_PIXEL,PLAYER_SCALE} from './player-settings.mjs?v=map-recovery-1';
import {buildNPCDistrict} from './npc-district.mjs?v=map-recovery-1';
import {createNPCNavigator,npcPavingAt,npcMaterialCost} from './npc-navigation.mjs?v=map-recovery-1';
import {residents as profiles,residentHomePose,interiorJourneyPose,residentInScene} from './resident-journey.mjs?v=map-recovery-1';
export {planNPCPath,npcConnectionClear} from './npc-navigation.mjs?v=map-recovery-1';

export const AMBIENT_RESIDENTS=Object.freeze(['bach','mozart','clara','nina','joplin','miles','chopin','haydn','vee-jay','zizi','beethoven','ellington','ella','handel','vivaldi','metronome','schoenberg','dj']);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const facing=(a,b)=>Math.abs(b.x-a.x)>Math.abs(b.y-a.y)?b.x<a.x?'left':'right':b.y<a.y?'up':'down';
function randomSource(seed=0x63cd1a){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
const street={kind:'street'};
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
 let activeDoc=null,lastRevision,city=null,people=[],vendors=[],renderer=null,elapsed=0,socialAt=0;
 const claims=new Map(),events=[];
 const navigator=createNPCNavigator({getProject,catalog,getBounds:()=>city?.bounds,budgetMs:1.5});
 const outdoor=()=>people.filter(a=>a.location.kind==='street'&&!a.hidden);
 const record=(type,actor,extra={})=>{events.push({type,id:actor.id,time:elapsed,...extra});if(events.length>256)events.shift();};
 const inDistrict=p=>city&&p.x>=city.bounds.x0&&p.x<=city.bounds.x1&&p.y>=city.bounds.y0&&p.y<=city.bounds.y1;
 function clearPoint(p){return inDistrict(p)&&!blocked(navigator.collisionView(p),p.x,p.y,catalog);}
 function standingNear(wanted,index=0,spread=true){
  if(!wanted)return null;
  const candidates=[];
  for(let ring=0;ring<8;ring++)for(let i=0;i<(ring?12:1);i++){
   const angle=(i/12+index*.137)*Math.PI*2,r=ring*48,p={x:wanted.x+Math.cos(angle)*r,y:wanted.y+Math.sin(angle)*r};
   if(!clearPoint(p)||spread&&outdoor().some(a=>distance(a,p)<85))continue;
   candidates.push({...p,score:r+npcMaterialCost(npcPavingAt(activeDoc,catalog,p))*18});
  }
  candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
 }
 function releaseSeat(actor){if(actor.seatId&&claims.get(actor.seatId)===actor.id)claims.delete(actor.seatId);delete actor.seatId;actor.seated=false;delete actor.depth;}
 function idle(actor,wait=2){actor.state='idle';actor.activity='';actor.purpose='Taking in the neighbourhood';actor.walking=false;actor._wait=wait;actor._path=[];actor._pending=false;}
 function cancel(actor){navigator.cancel(actor.id);actor._routeToken++;actor._pending=false;actor._path=[];}
 function endChat(actor){
  const partner=people.find(p=>p.id===actor.conversation);delete actor.conversation;
  if(partner?.conversation===actor.id){delete partner.conversation;idle(partner,1.5+random()*2);}
  idle(actor,1.5+random()*2);
 }
 function startChat(a,b){
  cancel(a);cancel(b);const duration=8+random()*8;
  for(const [actor,other]of [[a,b],[b,a]]){actor.state='chatting';actor.activity='chatting';actor.conversation=other.id;actor.facing=facing(actor,other);actor._wait=duration;actor._socialAfter=elapsed+duration+18+random()*18;actor.walking=false;actor.purpose='Talking with '+other.name;}
  record('chat',a,{partner:b.id});
 }
 function home(actor,wait){
  cancel(actor);releaseSeat(actor);const pose=residentHomePose(actor.id);
  Object.assign(actor,{x:pose.x,y:pose.y,facing:pose.facing,walking:false,activity:'',location:{...pose.scene},hidden:false,state:'home',purpose:'At home',_journey:null,_leaveAt:elapsed+wait});
 }
 function journey(actor,direction){
  cancel(actor);releaseSeat(actor);actor._journey={direction,elapsed:0};actor.state=direction==='out'?'departing':'returning';record(direction==='out'?'leave-room':'enter-building',actor);
  applyJourney(actor,0);
 }
 function applyJourney(actor,dt){
  const trip=actor._journey;trip.elapsed+=dt;const pose=interiorJourneyPose(actor.id,trip.direction,trip.elapsed);
  if(pose.done){
   if(trip.direction==='home'){record('enter-room',actor);home(actor,24+random()*35);return;}
   const p=city.tower&&standingNear(city.tower.approach,actor._index,false);
   if(!p){home(actor,8);return;}
   Object.assign(actor,p,{location:{...street},hidden:false,alpha:0,facing:city.tower.facing||'down',_journey:null,_homeDue:elapsed+55+random()*65});idle(actor,1+random()*2);record('exit-building',actor);return;
  }
  Object.assign(actor,{x:pose.x,y:pose.y,facing:pose.facing,walking:pose.walking,phase:pose.phase,hidden:pose.hidden,location:{...pose.scene},activity:'',purpose:pose.activity});
 }
 function sit(actor,bench){
  actor._bench=bench;actor.seatId=bench.id;claims.set(bench.id,actor.id);actor.state='seated';actor.activity='relaxing';actor.seated=true;actor.walking=false;actor.facing=bench.facing;actor.depth=Math.max(bench.seat.y,bench.approach.y);actor.x=bench.seat.x;actor.y=bench.seat.y;actor._wait=16+random()*20;actor.purpose='Enjoying a seat in the square';record('sit',actor,{seat:bench.id});
 }
 function stand(actor){const bench=actor._bench;releaseSeat(actor);if(bench){actor.x=bench.approach.x;actor.y=bench.approach.y;}actor._bench=null;idle(actor,1+random());record('stand',actor);}
 function arrive(actor){
  const goal=actor._goal;actor._lastGoal=goal?.id;actor._visits++;actor.walking=false;
  if(goal?.kind==='bench'){sit(actor,goal);return;}
  if(actor._goingHome&&city.tower){actor.state='entering';actor.facing=city.tower.facing==='down'?'up':city.tower.facing==='up'?'down':city.tower.facing==='left'?'right':'left';actor._wait=.55;actor.activity='';actor.purpose='Opening the building door';return;}
  idle(actor,6+random()*12);actor.purpose=goal?.kind==='arcade'?'Outside Coda Arcade':goal?.kind==='shop'?'Window shopping':goal?.kind==='tower'?'Outside Coda Residences':'Enjoying the neighbourhood';record('arrive',actor,{destination:goal?.id});
 }
 function go(actor,goal,goingHome=false,avoid=[]){
  // Entrances and hangouts are areas, not single standing pixels. Give each
  // resident an individual arrival spot so a crowd cannot occupy one node.
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
  navigator.request(actor.id,{x:actor.x,y:actor.y},goal.approach||goal,path=>{
   if(actor._routeToken!==token||actor.location.kind!=='street')return;
   actor._pending=false;
   if(path.length){actor._path=path;actor.state='walking';actor._stuck=0;actor._yield=0;actor._progress={x:actor.x,y:actor.y,time:elapsed};}
   else if(distance(actor,goal.approach||goal)<8)arrive(actor);
   else{releaseSeat(actor);idle(actor,2+random()*3);record('unreachable',actor,{destination:goal.id});}
  },{avoid});
 }
 function chooseDestination(actor){
  if(city.tower&&elapsed>=actor._homeDue){go(actor,city.tower,true);return;}
  const free=city.benches.filter(b=>!claims.has(b.id)&&b.id!==actor._lastGoal);
  if(free.length&&(actor._visits+actor._index)%3!==0){const bench=free[Math.floor(random()*free.length)];go(actor,bench);return;}
  const choices=city.anchors.filter(a=>a.id!==actor._lastGoal&&distance(actor,a)>90);
  if(!choices.length){idle(actor,3);return;}
  // Pick a real entrance or gathering spot. Variation happens in the choice
  // and the time spent there, rather than in random steps around the camera.
  go(actor,choices[Math.floor(random()*choices.length)]);
 }
 function initialize(doc){
  people=[];claims.clear();elapsed=0;socialAt=0;events.length=0;
  for(let i=0;i<Math.max(0,Math.min(18,count));i++){
   const id=AMBIENT_RESIDENTS[i],profile=profiles.find(p=>p.id===id),actor={id,name:profile?.name||id,role:'resident',x:city.center.x,y:city.center.y,facing:'down',walking:false,phase:i*.7,alpha:1,activity:'',state:'idle',location:{...street},hidden:false,speed:180+i%5*12,purpose:'Enjoying the neighbourhood',_index:i,_path:[],_wait:1+i*.35,_routeToken:0,_pending:false,_visits:0,_homeDue:38+i*8,_stuck:0,_yield:0};
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
   if(p&&q&&distance(p,q)>75&&distance(p,q)<200){Object.assign(a,p,{hidden:false});Object.assign(b,q,{hidden:false});startChat(a,b);}
  }
 }
 function sync(doc,revision){
  if(activeDoc===doc&&lastRevision===revision)return;
  const first=!activeDoc;activeDoc=doc;lastRevision=revision;city=buildNPCDistrict(doc,catalog);navigator.invalidate(revision);
  vendors=city.vendors.map((v,i)=>({...v,role:'vendor',location:{...street},state:'vending',activity:'',walking:false,phase:0,alpha:1,hidden:false,dialogue:vendorLines(v.name),appearance:{hairstyle:['curly','short','buns'][i%3],skin:['#bf8862','#e0b38c','#98694e'][i%3],hair:['#3b3035','#665044','#332832'][i%3],shirt:['#607b72','#8e655c','#686c88'][i%3],lowerColor:'#3e4350',outfit:'waistcoat',headwear:i%3===1?'chef':'none',shoes:'loafers'}}));
  if(first){initialize(doc);return;}
  for(const actor of people){
   cancel(actor);if(actor.location.kind!=='street')continue;
   if(actor.conversation)endChat(actor);releaseSeat(actor);actor._bench=null;
   if(!clearPoint(actor)||actor.hidden){const p=standingNear(city.tower?.approach||city.center,actor._index);if(p){Object.assign(actor,p);actor.hidden=false;}else actor.hidden=true;}
   idle(actor,1+random()*2);
  }
 }
 function walkActor(actor,dt){
  const progress=actor._progress;
  if(progress&&distance(actor,progress)>90)actor._progress={x:actor.x,y:actor.y,time:elapsed};
  else if(progress&&elapsed-progress.time>5){
   const avoid=outdoor().filter(b=>b!==actor&&!b.seated&&distance(actor,b)<450).map(b=>({x:b.x,y:b.y,r:48}));
   go(actor,actor._goal,actor._goingHome,avoid);return;
  }
  const target=actor._path[0];if(!target){arrive(actor);return;}
  let dx=target.x-actor.x,dy=target.y-actor.y;
  if(Math.abs(dx)<1.5&&Math.abs(dy)<1.5){actor.x=target.x;actor.y=target.y;actor._path.shift();if(!actor._path.length)arrive(actor);return;}
  let horizontal=Math.abs(dx)>Math.abs(dy),direction=horizontal?Math.sign(dx):Math.sign(dy),key=horizontal?direction<0?'a':'d':direction<0?'w':'s',amount=Math.min(dt*actor.speed/WALK_SPEED,(horizontal?Math.abs(dx):Math.abs(dy))/WALK_SPEED);
  const others=[...outdoor(),...vendors],player=getPlayer?.();if(player)others.push({...player,id:'__player__'});
  const obstruction=others.find(b=>b.id!==actor.id&&!b.seated&&distance(actor,b)<68&&(horizontal?(b.x-actor.x)*direction>8&&Math.abs(b.y-actor.y)<48:(b.y-actor.y)*direction>8&&Math.abs(b.x-actor.x)<48)&&Math.abs(height(activeDoc,b.x,b.y)-height(activeDoc,actor.x,actor.y))<14);
  if(obstruction){
   actor._yield+=dt;actor.purpose='Giving someone room';
   if(actor._yield<.45)return;
   const side=horizontal?{x:0,y:direction}:{x:-direction,y:0};let clear=false;
   for(const sign of [1,-1]){const p={x:actor.x+side.x*24*sign,y:actor.y+side.y*24*sign};if(inDistrict(p)&&navigator.connectionClear(actor,p)&&!others.some(b=>b.id!==actor.id&&distance(b,p)<44)){key=side.x?side.x*sign<0?'a':'d':side.y*sign<0?'w':'s';amount=Math.min(dt*actor.speed*.6/WALK_SPEED,12/WALK_SPEED);clear=true;break;}}
   if(!clear){
    // Personal space is a preference. In a packed passage, give one walker
    // priority instead of letting a ring of pedestrians wait forever.
    const priority=others.filter(b=>b.role==='resident'&&b.state==='walking'&&distance(actor,b)<110).every(b=>actor._index<=b._index);
    if(actor._yield<1.3||!priority||obstruction.role!=='resident'||obstruction.state!=='walking')return;
    amount*=.55;
   }
  }else actor._yield=0;
  const motion=movePlayer(navigator.collisionView(actor),actor,new Set([key]),amount,catalog);actor.walking=motion.walking;if(motion.facing)actor.facing=motion.facing;actor.phase=(actor.phase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);
  actor._stuck=motion.distance<.05?actor._stuck+dt:0;
  if(actor._stuck>.7){actor._stuck=0;go(actor,actor._goal,actor._goingHome);}
 }
 function update(dt,_time){
  const doc=getProject?.();if(!doc)return;dt=Math.min(.1,Math.max(0,Number(dt)||0));sync(doc,getRevision());elapsed+=dt;
  navigator.update();
  for(const actor of people){
   actor.walking=false;actor.alpha=Math.min(1,actor.alpha+dt*2.5);
   if(actor._held){actor.facing=actor._talkFacing||actor.facing;continue;}
   if(actor._journey){applyJourney(actor,dt);continue;}
   if(actor.state==='home'){if(city.tower&&elapsed>=actor._leaveAt)journey(actor,'out');continue;}
   if(actor.hidden)continue;
   if(actor.state==='waiting')continue;
   if(actor.state==='walking'){walkActor(actor,dt);continue;}
   actor._wait=Math.max(0,actor._wait-dt);
   if(actor.state==='seated'){if(!actor._wait)stand(actor);continue;}
   if(actor.state==='chatting'){if(!actor._wait)endChat(actor);continue;}
   if(actor.state==='entering'){if(!actor._wait)journey(actor,'home');continue;}
   if(!actor._wait)chooseDestination(actor);
  }
  if(elapsed>=socialAt){
   socialAt=elapsed+.75;
   const available=outdoor().filter(a=>!a._held&&a.state==='idle'&&a._wait>2&&elapsed>=(a._socialAfter||0));
   for(const actor of available){const other=available.find(b=>b!==actor&&b.state==='idle'&&distance(actor,b)>75&&distance(actor,b)<210);if(actor.state==='idle'&&other)startChat(actor,other);}
  }
 }
 function interiorActors(scene){return people.filter(a=>a.location.kind!=='street'&&!a.hidden&&residentInScene({...a,scene:a.location},scene)).map(a=>({...a}));}
 function setConversation(id,active,viewer){
  const actor=[...people,...vendors].find(a=>a.id===id);if(!actor)return;
  if(active){
   if(actor.conversation)endChat(actor);
   actor._heldActivity=actor.activity;actor._held=true;actor.walking=false;actor.activity='chatting';
   if(viewer)actor.facing=actor._talkFacing=facing(actor,viewer);
  }else{actor._held=false;actor.activity=actor._heldActivity||'';delete actor._heldActivity;delete actor._talkFacing;}
 }
 function draw(ctx,actor,time=elapsed){
  if(!renderer&&globalThis.window?.createCodaCharacterRenderer)renderer=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});
  if(!renderer||actor.hidden)return;ctx.save();ctx.globalAlpha*=Number.isFinite(actor.alpha)?actor.alpha:1;renderer.drawNPC(ctx,actor,time);ctx.restore();
 }
 function reset(){activeDoc=null;people=[];vendors=[];claims.clear();events.length=0;elapsed=0;}
 return {update,draw,reset,interiorActors,setConversation,get actors(){return [...outdoor(),...vendors];},get residents(){return people;},get district(){return city;},get events(){return events.slice();},get simulationTime(){return elapsed;},get navigationStats(){return navigator.stats;},get seatClaims(){return new Map(claims);}};
}
