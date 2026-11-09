"""Visible entrance queues, committed passing and gazebo stage integration.

Run: python tests/town-npc-queues-stage-browser.py [--focused] [--map project.json]
Only isolated browser/simulator state is changed; source map bytes stay intact.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError
import argparse,base64,hashlib,json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--map',type=Path,default=ROOT/'town/maps/coda-town-uploaded-3.json')
parser.add_argument('--url',help='Optional published builder URL')
parser.add_argument('--screenshots',type=Path)
parser.add_argument('--focused',action='store_true',help='Only controlled entrance and stage checks')
parser.add_argument('--duration',type=int,default=360)
args=parser.parse_args()
source_bytes=args.map.read_bytes();source=json.loads(source_bytes);source_hash=hashlib.sha256(source_bytes).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1000})
  if args.url:
   def production(route):
    try:
     with urlopen(route.request.url,timeout=45) as response:route.fulfill(status=response.status,headers={'content-type':response.headers.get('content-type','application/octet-stream')},body=response.read())
    except HTTPError as error:route.fulfill(status=error.code,body=error.read())
   context.route('https://cwoodmusic.github.io/**',production)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def save_image(label,data):
   if args.screenshots:
    args.screenshots.mkdir(parents=True,exist_ok=True)
    (args.screenshots/(label+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  def save_data(label,data):
   if args.screenshots:
    args.screenshots.mkdir(parents=True,exist_ok=True)
    (args.screenshots/(label+'.json')).write_text(json.dumps(data,indent=2))
  page.expose_function('__saveQueueImage',save_image);page.expose_function('__saveQueueData',save_data)
  page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/',timeout=120000)
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  page.locator('#file').set_input_files(str(args.map))
  page.wait_for_function('n=>townBuilder.project.objects.length===n',arg=len(source['objects']),timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  urls=page.evaluate('''()=>{const app=new URL(document.querySelector('script[type="module"]').src);return Object.fromEntries(['model','runtime','ambient-npcs','npc-navigation','physics','player-settings'].map(name=>[name,new URL('../world/'+name+'.mjs'+app.search,app).href]));}''')
  result=page.evaluate('''async({urls,duration,focused})=>{
   const {createAmbientNPCs}=await import(urls['ambient-npcs']),{createNPCNavigator}=await import(urls['npc-navigation']);
   const {blocked,height}=await import(urls.model),{render}=await import(urls.runtime);
   const doc=townBuilder.project,catalog=townBuilder.catalog,before=JSON.stringify(doc),dt=1/60,cases=[],shots=new Set();
   const check=(ok,label)=>{if(!ok)throw Error(label);};
   const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
   const routeDistance=(p,route)=>Math.min(...route.slice(1).map((b,i)=>segmentDistance(p,route[i],b)));
   const vectors={down:{x:0,y:1},up:{x:0,y:-1},left:{x:-1,y:0},right:{x:1,y:0}};
   const seeded=()=>{let state=0x63cd1a;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};};
   const make=(count=18)=>{const s=createAmbientNPCs({getProject:()=>doc,catalog,count,random:seeded()});s.update(0);return s;};
   const nav=createNPCNavigator({getProject:()=>doc,catalog});
   const clear=p=>!blocked(nav.collisionView(p),p.x,p.y,catalog);
   function nearby(wanted,origin=null){for(let r=0;r<=256;r+=32)for(let i=0;i<(r?16:1);i++){const a=i/16*Math.PI*2,p={x:wanted.x+Math.cos(a)*r,y:wanted.y+Math.sin(a)*r};if(clear(p)&&(!origin||nav.connectionClear(origin,p)))return p;}return null;}
   function stopChat(sim){for(const actor of sim.residents){sim.setConversation(actor.id,true,{x:actor.x+80,y:actor.y});sim.setConversation(actor.id,false);}}
   async function capture(label,sim,point){
    if(shots.has(label))return;shots.add(label);const cv=document.createElement('canvas');cv.width=1100;cv.height=800;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;
    render(c,doc,{x:point.x,y:point.y-height(doc,point.x,point.y)-70,zoom:1},1100,800,{time:sim.simulationTime,night:false,terrainRevision:0,npcs:sim.actors,drawNPC:sim.draw});
    await window.__saveQueueImage(label,cv.toDataURL('image/png'));
   }
   function physical(sim,label){for(const a of sim.actors)if(a.role==='resident'&&!a.seated){check(clear(a),label+': '+a.id+' entered solid terrain/artwork at '+a.x+','+a.y);}}
   const queueResults=[];
   const initial=make(),buildings=initial.district.anchors.filter(a=>['tower','arcade','shop'].includes(a.kind));
   check(buildings.length===3,'Expected the current three building entrances');
   for(const building of buildings){
    const sim=make(2);stopChat(sim);check(typeof sim.visit==='function','Resident visit API missing');
    const publicQueue=sim.queues.find(q=>q.entranceId===building.id),layout=publicQueue?.layout;
    check(layout&&layout.slots.length>=2,building.kind+' has no usable two-person physical line');
    const f=vectors[layout.facing],r={x:f.y,y:-f.x},lateral=p=>(p.x-layout.door.x)*r.x+(p.y-layout.door.y)*r.y;
    await window.__saveQueueData('layout-'+building.kind,{building,layout,incomingSide:lateral(layout.entry),outgoingSide:lateral(layout.exit)});
    check(layout.shared||lateral(layout.entry)*lateral(layout.exit)<0&&Math.abs(lateral(layout.entry)-lateral(layout.exit))>=72,building.kind+' does not keep safe opposite entry and exit lanes');
    if(layout.shared){const corridor=layout.exitVia?.[0];check(corridor&&Array.isArray(layout.exitRoute),'Shared doorway lacks an explicit corridor and turn route');check((layout.slots[0].x-corridor.x)*f.x+(layout.slots[0].y-corridor.y)*f.y>=85.9,'Shared waiting line overlaps its outgoing corridor');check(Math.abs(lateral(layout.exitClear)-lateral(layout.exit))>=72,'Shared outgoing route never turns clear of the waiting line');}
    for(const p of [...layout.slots,layout.entry,layout.exit,layout.exitClear])check(clear(p),building.kind+' queue/lane point lies inside solid artwork');
    const tail=layout.slots.at(-1),people=sim.residents,ids=people.map(a=>a.id);
    for(let i=0;i<people.length;i++){
     const wanted={x:tail.x+f.x*(86+i*86),y:tail.y+f.y*(86+i*86)},p=nearby(wanted,tail);
     check(p,building.kind+' has no clear controlled arrival point');Object.assign(people[i],p);people[i]._wait=1000;
     check(sim.visit(people[i].id,building.id),building.kind+' rejected a valid visit');
    }
    let last=0,maxVisibleLine=0,exitSamples=0,entrySamples=0;const fifo=[],joined=[],served=[],entered=new Set(),exited=new Set(),cleared=new Set(),events=[],lineTrace=[];
    for(let frame=0;frame<150*60;frame++){
     sim.update(dt);physical(sim,building.kind);
     for(const event of sim.events.filter(e=>e.sequence>last)){
      last=Math.max(last,event.sequence);events.push(event);if(event.entranceId!==building.id)continue;
      if(event.type==='queue-join'){fifo.push({id:event.id,order:event.joinOrder});joined.push(event.id);}
      if(event.type==='queue-service'){
       const expected=fifo.shift();check(expected&&expected.id===event.id&&expected.order===event.joinOrder,building.kind+' served a resident out of FIFO order');served.push(event.id);
      }
      if(event.type==='queue-release'){const index=fifo.findIndex(p=>p.id===event.id);if(index>=0)fifo.splice(index,1);if(event.reason==='cleared exit')cleared.add(event.id);}
      if(event.type==='enter-venue')entered.add(event.id);
      if(event.type==='exit-building'){
       check(distance(event.position,layout.exit)<=8,building.kind+' spawned an exiting resident away from the outgoing lane');exited.add(event.id);
      }
     }
     // Home entries use the apartment journey event, other venues use enter-venue.
     for(const event of events)if(building.kind==='tower'&&event.type==='enter-building'&&ids.includes(event.id))entered.add(event.id);
     const q=sim.queues.find(q=>q.entranceId===building.id),incoming=q.people.filter(p=>p.direction==='in');
     check(incoming.filter(p=>p.active).length<=1,building.kind+' has multiple active queue heads');
     check(incoming.filter(p=>p.waiting).length<=layout.capacity,building.kind+' waiting line exceeded physical capacity');
     const forward=p=>(p.x-layout.entry.x)*f.x+(p.y-layout.entry.y)*f.y;
     const aligned=incoming.map(p=>({record:p,actor:sim.residents.find(a=>a.id===p.id)})).filter(({actor})=>actor&&Math.abs(lateral(actor)-lateral(layout.entry))<12&&forward(actor)>=-8&&forward(actor)<=forward(tail)+16);
     maxVisibleLine=Math.max(maxVisibleLine,aligned.length);
     if(frame%6===0)lineTrace.push({time:sim.simulationTime,people:incoming.map(p=>{const a=sim.residents.find(a=>a.id===p.id);return{id:p.id,index:p.index,slotIndex:p.slotIndex,active:p.active,x:a.x,y:a.y,state:a.state,phase:a._queuePhase};})});
     if(aligned.length>=2){
      for(let i=0;i<aligned.length;i++)for(let j=i+1;j<aligned.length;j++){
       const first=aligned[i],second=aligned[j];
       if(distance(first.actor,second.actor)<52||first.record.index<second.record.index&&forward(first.actor)>forward(second.actor)+8)await window.__saveQueueData('first-line-issue',{kind:building.kind,layout,aligned,lineTrace,events});
       check(distance(first.actor,second.actor)>=52,building.kind+' visible line collapsed into a clump');
       check(first.record.index>=second.record.index||forward(first.actor)<=forward(second.actor)+8,building.kind+' follower physically overtook its queue leader');
      }
      await capture('queue-'+building.kind,sim,{x:(layout.entry.x+tail.x)/2,y:(layout.entry.y+tail.y)/2});
     }
     for(const a of sim.actors){
      if(a.queueEntranceId!==building.id)continue;
      if(a._queuePhase==='entry'&&a.walking){entrySamples++;if(Math.abs(lateral(a)-lateral(layout.entry))>=12)await window.__saveQueueData('first-lane-issue',{kind:building.kind,direction:'in',layout,actor:{id:a.id,x:a.x,y:a.y,path:a._path,goal:a._goal,state:a.state,queuePhase:a._queuePhase},queue:q,events});check(Math.abs(lateral(a)-lateral(layout.entry))<12,building.kind+' incoming head drifts out of its lane');}
      if(a._queuePhase==='exit'&&a.walking){exitSamples++;const deviation=layout.shared?routeDistance(a,layout.exitRoute):Math.abs(lateral(a)-lateral(layout.exit));if(deviation>=12)await window.__saveQueueData('first-lane-issue',{kind:building.kind,direction:'out',layout,actor:{id:a.id,x:a.x,y:a.y,path:a._path,goal:a._goal,state:a.state,queuePhase:a._queuePhase},queue:q,events});check(deviation<12,building.kind+' outgoing walker leaves its selected safe exit route');}
     }
     if(ids.every(id=>entered.has(id))&&ids.every(id=>exited.has(id)&&cleared.has(id)))break;
     if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const data={kind:building.kind,layout,joined,served,maxVisibleLine,entrySamples,exitSamples,entered:[...entered],exited:[...exited],cleared:[...cleared],events,lineTrace,states:sim.residents.map(a=>({id:a.id,state:a.state,location:a.location,x:a.x,y:a.y,goal:a._goal,queuePhase:a._queuePhase}))};
    await window.__saveQueueData('queue-'+building.kind,data);
    check(maxVisibleLine>=2,building.kind+' never formed a visible two-person line');check(ids.every(id=>entered.has(id)),building.kind+' queued resident never entered');check(ids.every(id=>exited.has(id)),building.kind+' queued resident never exited');
    check(ids.every(id=>cleared.has(id)),building.kind+' resident never finished walking clear of the exit');check(entrySamples&&exitSamples,building.kind+' did not exercise both physical lanes');queueResults.push({...data,events:undefined,lineTrace:undefined});cases.push('visible FIFO and separate lanes: '+building.kind);
   }
   // Make an indoor visit finish just after a new resident joins the shared
   // doorway. This reproduces the real opposing-corridor deadlock directly.
   const sharedQueue=make().queues.find(q=>q.layout?.shared);let sharedCrossing=null;
   if(sharedQueue){
    const sim=make(2);stopChat(sim);const layout=sim.queues.find(q=>q.entranceId===sharedQueue.entranceId).layout,f=vectors[layout.facing],tail=layout.slots.at(-1),staging={x:tail.x+f.x*86,y:tail.y+f.y*86},[leaver,arriver]=sim.residents;
    const away=nearby({x:staging.x+500,y:staging.y+200});check(away&&clear(staging),'Shared corridor fixture has no physical arrival/holding points');
    Object.assign(leaver,staging,{_wait:1000});Object.assign(arriver,away,{_wait:1000});sim.setConversation(arriver.id,true,{x:arriver.x+80,y:arriver.y});check(sim.visit(leaver.id,sharedQueue.entranceId),'Shared doorway rejected first visit');
    let phase='first-entry',sequence=0,exitClearTime=null,incomingServiceTime=null,entered=false,minGap=Infinity,maxOutgoingRouteDeviation=0;const events=[],trace=[];
    for(let frame=0;frame<80*60;frame++){
     sim.update(dt);physical(sim,'shared opposing arrival/exit');
     for(const e of sim.events.filter(e=>e.sequence>sequence)){
      sequence=Math.max(sequence,e.sequence);events.push(e);
      if(e.id===leaver.id&&e.type==='enter-venue'&&phase==='first-entry'){
       sim.setConversation(leaver.id,true);Object.assign(arriver,staging);sim.setConversation(arriver.id,false);check(sim.visit(arriver.id,sharedQueue.entranceId),'Shared doorway rejected second visit');phase='second-approach';
      }
      if(e.id===arriver.id&&e.type==='queue-join'&&phase==='second-approach'){
       check(leaver._venue,'Shared fixture lost its indoor visitor');leaver._venue.elapsed=1000;sim.setConversation(leaver.id,false);phase='opposing-corridor';
      }
      if(e.id===leaver.id&&e.type==='queue-release'&&e.reason==='cleared exit')exitClearTime=e.time;
      if(e.id===arriver.id&&e.type==='queue-service')incomingServiceTime=e.time;
      if(e.id===arriver.id&&e.type==='enter-venue')entered=true;
     }
     const q=sim.queues.find(q=>q.entranceId===sharedQueue.entranceId),active=q.people.filter(p=>p.direction==='in'&&p.active),exiting=q.people.filter(p=>p.direction==='out');
     check(!(active.length&&exiting.length),'Shared corridor admits opposing active pedestrians');
     if(exiting.length){
      maxOutgoingRouteDeviation=Math.max(maxOutgoingRouteDeviation,routeDistance(leaver,layout.exitRoute));
      const waiting=q.people.filter(p=>p.direction==='in'&&!p.active);for(const p of waiting){const n=sim.residents.find(n=>n.id===p.id),end=layout.exitVia[0];check((n.x-end.x)*f.x+(n.y-end.y)*f.y>=68-1,'Incoming pedestrian advances into a reserved shared outgoing corridor');}
      if(Math.abs((leaver.x-layout.exit.x)*f.y-(leaver.y-layout.exit.y)*f.x)>=60)await capture('shared-corridor-turn',sim,{x:(layout.door.x+tail.x)/2,y:(layout.door.y+tail.y)/2});
     }
     if(leaver.location.kind==='street'&&arriver.location.kind==='street')minGap=Math.min(minGap,distance(leaver,arriver));
     if(frame%6===0)trace.push({time:sim.simulationTime,phase,people:sim.residents.map(n=>({id:n.id,x:n.x,y:n.y,state:n.state,location:n.location,queuePhase:n._queuePhase,path:n._path})),queue:q.people});
     if(entered&&exitClearTime!==null)break;
     if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    sharedCrossing={layout,entered,exitClearTime,incomingServiceTime,minGap,maxOutgoingRouteDeviation,events,trace,states:sim.residents.map(n=>({id:n.id,state:n.state,x:n.x,y:n.y,path:n._path,goal:n._goal,queuePhase:n._queuePhase,location:n.location}))};
    await window.__saveQueueData('shared-opposing-corridor',sharedCrossing);
    check(entered&&exitClearTime!==null,'Shared outgoing pedestrian and arriving head did not both complete');check(incomingServiceTime>=exitClearTime,'Shared entrance serviced incoming before outgoing cleared the corridor');check(minGap>=39.9,'Shared opposing pedestrians crossed one another');check(maxOutgoingRouteDeviation<12,'Shared outgoing pedestrian missed its validated turn pocket');cases.push('concurrent shared-door arrival waits for outgoing corridor and turn');
   }
   const stageSim=make(2);stopChat(stageSim);const stage=stageSim.district.stages?.[0];check(stage,'The current gazebo has no usable stage route');
   const a=stageSim.residents[0],b=stageSim.residents[1];Object.assign(a,stage.approach);
   const away=nearby({x:stage.approach.x+500,y:stage.approach.y+200});check(away,'No clear control point beside stage');Object.assign(b,away);
   check(stageSim.visitStage(a.id,stage.id),'Stage trip was rejected');check(!stageSim.visitStage(b.id,stage.id),'Stage capacity allowed a second performer');stageSim.setConversation(b.id,true,{x:b.x+80,y:b.y});
   let stairsIn=false,deck=false,stairsOut=false,stageExit=false,lastStageSequence=0;const stageEvents=[],stageTrace=[];let previous={x:a.x,y:a.y};
   for(let frame=0;frame<80*60;frame++){
    stageSim.update(dt);physical(stageSim,'gazebo');
    if(a.location.kind==='street')check(distance(previous,a)<=500*dt+3,'Gazebo trip teleported instead of walking');previous={x:a.x,y:a.y};
    for(const e of stageSim.events.filter(e=>e.sequence>lastStageSequence)){lastStageSequence=Math.max(lastStageSequence,e.sequence);if(e.id===a.id&&e.stageId===stage.id){stageEvents.push(e);if(e.type==='stage-exit')stageExit=true;}}
    if(a.stageId===stage.id){
     if(a.stagePhase!=='approaching'){check(a.groundAnchor&&distance(a.groundAnchor,stage.ground)<.01,'Stage actor uses the wrong projection height anchor');check(Math.abs(height(doc,a.x,a.y)-height(doc,stage.ground.x,stage.ground.y))<.1,'Stage actor crosses an unsupported terrain height');}
     check(stageSim.actors.filter(n=>n.stageId===stage.id).length===1,'Stage has multiple occupants');
     if(a.stagePhase==='stairs'&&distance(a,stage.via[0])<12)stairsIn=true;
     if(a.stagePhase==='deck'){deck=true;check(stairsIn,'Resident reached deck without using the front steps');check(distance(a,stage.deck)<12,'Resident stops outside the stage deck');await capture('gazebo-deck',stageSim,a);}
     if(a.stagePhase==='leaving'&&distance(a,stage.exit[0])<12)stairsOut=true;
     if(frame%6===0)stageTrace.push({time:stageSim.simulationTime,x:a.x,y:a.y,phase:a.stagePhase,groundAnchor:a.groundAnchor});
    }
    if(stageExit){check(deck&&stairsOut,'Stage exit skipped the deck or front stairs');check(distance(a,stage.approach)<12,'Stage exit did not return to its approach');break;}
    if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   await window.__saveQueueData('gazebo-stage',{stage,stairsIn,deck,stairsOut,stageExit,events:stageEvents,trace:stageTrace,state:{id:a.id,state:a.state,location:a.location,x:a.x,y:a.y,stageId:a.stageId,stagePhase:a.stagePhase,goal:a._goal}});
   check(stairsIn&&deck&&stairsOut&&stageExit,'Resident did not complete approach→stairs→deck→stairs→exit');
   stageSim.setConversation(b.id,false);check(stageSim.visitStage(b.id,stage.id),'Stage reservation was not released after exit');cases.push('gazebo stair/deck/exit and exclusive reservation');
   const {movePlayer}=await import(urls.physics),{WALK_SPEED}=await import(urls['player-settings']);
   const player={...stage.approach,facing:'up',walking:false,phase:0};let playerSteps=0;
   for(const target of [...stage.via,...stage.exit]){
    for(let step=0;distance(player,target)>1&&step<1200;step++){
     const dx=target.x-player.x,dy=target.y-player.y,horizontal=Math.abs(dx)>Math.abs(dy),delta=horizontal?dx:dy,key=horizontal?(dx<0?'a':'d'):(dy<0?'w':'s');
     const motion=movePlayer(doc,player,new Set([key]),Math.min(dt,Math.abs(delta)/WALK_SPEED),catalog);check(motion.distance>.01,'Player Walk test cannot traverse gazebo front stairs/deck');playerSteps++;
    }
    check(distance(player,target)<=1,'Player Walk test did not reach gazebo step/deck waypoint');
   }
   cases.push('player physics traverses gazebo front stairs and deck');
   let passing=null,natural=null;
   if(!focused){
    // Exercise the actual walker against a stationary pedestrian on an authored
    // map, independently measuring its trajectory and physical body clearance.
    const passingSim=make(2);stopChat(passingSim);const walker=passingSim.residents[0],bystander=passingSim.residents[1],bounds=passingSim.district.bounds;
    const inside=p=>p.x>bounds.x0&&p.x<bounds.x1&&p.y>bounds.y0&&p.y<bounds.y1;
    let corridor=null;
    for(const anchor of passingSim.district.anchors){
     for(let oy=0;oy<=640&&!corridor;oy+=80)for(const sign of [1,-1]){
      const start={x:anchor.x-240,y:anchor.y+oy*sign},end={x:start.x+480,y:start.y},corners=[start,end,{x:start.x,y:start.y-112},{x:end.x,y:end.y-112},{x:start.x,y:start.y+112},{x:end.x,y:end.y+112}];
      if(corners.every(p=>inside(p)&&clear(p))&&corners.every(p=>Math.abs(height(doc,p.x,p.y)-height(doc,start.x,start.y))<.1)&&nav.connectionClear(start,end)&&nav.connectionClear(corners[2],corners[3])&&nav.connectionClear(corners[4],corners[5])&&nav.connectionClear(corners[2],corners[4])&&nav.connectionClear(corners[3],corners[5])){corridor={start,end,obstacle:{x:start.x+180,y:start.y}};break;}
     }
     if(corridor)break;
    }
    check(corridor,'No physical street corridor for controlled passing fixture');
    Object.assign(walker,corridor.start,{state:'walking',_path:[corridor.end],_goal:{id:'qa-passing-end',kind:'hangout',...corridor.end,approach:corridor.end,_arrival:true},_progress:{...corridor.start,time:passingSim.simulationTime},_pending:false,_wait:1000,_homeDue:1000});
    Object.assign(bystander,corridor.obstacle,{_wait:1000});passingSim.setConversation(bystander.id,true,{x:bystander.x+80,y:bystander.y});
    let minDistance=Infinity,maxLateral=0,completed=false;const passTrace=[],passEvents=[];let passSequence=0;
    for(let frame=0;frame<20*60;frame++){
     passingSim.update(dt);physical(passingSim,'passing');const gap=distance(walker,bystander);minDistance=Math.min(minDistance,gap);maxLateral=Math.max(maxLateral,Math.abs(walker.y-corridor.start.y));
     if(frame%3===0)passTrace.push({time:passingSim.simulationTime,x:walker.x,y:walker.y,gap,state:walker.state,path:walker._path.map(p=>({...p})),passing:walker._passingRemaining});
     for(const e of passingSim.events.filter(e=>e.sequence>passSequence)){passSequence=Math.max(passSequence,e.sequence);passEvents.push(e);}
     if(walker._passingRemaining&&Math.abs(walker.y-corridor.start.y)>=60)await capture('pedestrian-detour',passingSim,{x:(walker.x+bystander.x)/2,y:(walker.y+bystander.y)/2});
     if(distance(walker,corridor.end)<12){completed=true;break;}
     if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    passing={corridor,minDistance,maxLateral,completed,events:passEvents,trace:passTrace,state:{x:walker.x,y:walker.y,state:walker.state,path:walker._path,goal:walker._goal}};
    await window.__saveQueueData('pedestrian-detour',passing);
    check(minDistance>=39.9,'Passing walker crossed another pedestrian body');check(maxLateral>=60,'Walker did not visibly go around the other person');check(completed,'Committed detour did not rejoin and complete its route');
    check(passEvents.some(e=>e.type==='passing-start')&&passEvents.some(e=>e.type==='passing-clear'),'Actual walker did not start and finish a committed passing route');cases.push('actual walker detours around a stationary pedestrian');

    const headOnSim=make(2);stopChat(headOnSim);const pair=headOnSim.residents,targets=[corridor.end,corridor.start];
    pair.forEach((n,i)=>Object.assign(n,i?corridor.end:corridor.start,{state:'walking',_path:[targets[i]],_goal:{id:'qa-head-on-'+i,kind:'hangout',...targets[i],approach:targets[i],_arrival:true},_progress:{...(i?corridor.end:corridor.start),time:headOnSim.simulationTime},_pending:false,_wait:1000,_homeDue:1000}));
    const headOnTrace=[],headOnDone=new Set();let headOnMin=Infinity,headOnLateral=0;
    for(let frame=0;frame<20*60;frame++){
     headOnSim.update(dt);physical(headOnSim,'head-on passing');headOnMin=Math.min(headOnMin,distance(pair[0],pair[1]));headOnLateral=Math.max(headOnLateral,...pair.map(n=>Math.abs(n.y-corridor.start.y)));
     pair.forEach((n,i)=>{if(distance(n,targets[i])<12)headOnDone.add(n.id);});
     if(frame%3===0)headOnTrace.push({time:headOnSim.simulationTime,people:pair.map(n=>({id:n.id,x:n.x,y:n.y,state:n.state,path:n._path,passing:n._passingRemaining}))});
     if(pair.some(n=>n._passingRemaining)&&pair.some(n=>Math.abs(n.y-corridor.start.y)>=60))await capture('pedestrians-head-on',headOnSim,{x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2});
     if(headOnDone.size===2)break;
     if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    await window.__saveQueueData('pedestrians-head-on',{corridor,minDistance:headOnMin,maxLateral:headOnLateral,completed:[...headOnDone],events:headOnSim.events,trace:headOnTrace});
    check(headOnMin>=39.9,'Head-on pedestrians walked through each other');check(headOnLateral>=60&&headOnDone.size===2,'Head-on pedestrians did not go around and both finish');check(headOnSim.events.some(e=>e.type==='passing-start')&&headOnSim.events.some(e=>e.type==='passing-clear'),'Head-on passing had no completed committed detour');cases.push('two actual head-on walkers maintain body clearance and finish');

    const sim=make(),progress=new Map(),maxGap=new Map(),stalls=new Map(),allEvents=[],lastPositions=new Map(),queueFIFO=new Map(),queueWaitSince=new Map(),maxQueueWait=new Map();
    let sequence=0,walkingChecks=0,sawSeat=false,sawStage=false;const issues=[],queueCounts={},statesAtStall=[];
    const snapshot=n=>({id:n.id,state:n.state,location:n.location,x:n.x,y:n.y,goal:n._goal,path:n._path,pending:n._pending,stuck:n._stuck,yield:n._yield,progress:n._progress,wait:n._wait,queueEntranceId:n.queueEntranceId,queueIndex:n.queueIndex,queuePhase:n._queuePhase,stageId:n.stageId,stagePhase:n.stagePhase,passing:n._passingRemaining,partner:n._passingPartner,entranceIntent:n._entranceIntent,venue:n._venue,journey:n._journey});
    for(let frame=0;frame<duration*60;frame++){
     sim.update(dt);const time=sim.simulationTime;
     for(const e of sim.events.filter(e=>e.sequence>sequence)){
      sequence=Math.max(sequence,e.sequence);allEvents.push(e);
      if(e.type==='queue-join'){const fifo=queueFIFO.get(e.entranceId)||[];fifo.push({id:e.id,order:e.joinOrder});queueFIFO.set(e.entranceId,fifo);queueWaitSince.set(e.id,time);queueCounts[e.entranceId]=(queueCounts[e.entranceId]||0)+1;}
      if(e.type==='queue-service'){const first=queueFIFO.get(e.entranceId)?.shift();if(!first||first.id!==e.id||first.order!==e.joinOrder)issues.push({type:'fifo',event:e,expected:first});}
      if(e.type==='queue-release'){const fifo=queueFIFO.get(e.entranceId)||[],index=fifo.findIndex(p=>p.id===e.id);if(index>=0)fifo.splice(index,1);const wait=queueWaitSince.get(e.id);if(wait!==undefined){maxQueueWait.set(e.entranceId,Math.max(maxQueueWait.get(e.entranceId)||0,time-wait));queueWaitSince.delete(e.id);}}
      if(e.type==='stage-deck')sawStage=true;
     }
     for(const n of sim.actors){
      if(n.role!=='resident')continue;
      if(n.seated){sawSeat=true;continue;}
      if(frame%6===0&&n.walking){walkingChecks++;if(!clear(n))issues.push({type:'collision',time,actor:snapshot(n)});}
      if(n.stageId&&n.stagePhase!=='approaching'){const s=sim.district.stages.find(s=>s.id===n.stageId);if(!n.groundAnchor||distance(n.groundAnchor,s.ground)>.01)issues.push({type:'stage-grounding',time,actor:snapshot(n)});}
      const previous=lastPositions.get(n.id);if(previous&&previous.time===time-dt&&distance(previous,n)>500*dt+3)issues.push({type:'position-pop',time,actor:snapshot(n),previous});lastPositions.set(n.id,{x:n.x,y:n.y,time});
      // Queuing, performing and indoor waits are intentional stationary states.
      // Queue progress is checked separately by FIFO service and releases.
      if((n.state==='walking'||n.state==='waiting')&&!n.queueEntranceId){
       let p=progress.get(n.id);if(!p||distance(p,n)>90){p={x:n.x,y:n.y,time};progress.set(n.id,p);}const gap=time-p.time;maxGap.set(n.id,Math.max(maxGap.get(n.id)||0,gap));
       if(gap>25&&!stalls.has(n.id)){stalls.set(n.id,{id:n.id,gap,time,...snapshot(n)});statesAtStall.push({time,navigation:sim.navigationStats,states:sim.residents.map(snapshot)});}
      }else progress.delete(n.id);
     }
     if(frame%6===0)for(const q of sim.queues){const active=q.people.filter(p=>p.direction==='in'&&p.active),out=q.people.filter(p=>p.direction==='out');if(active.length>1||q.layout.shared&&active.length&&out.length)issues.push({type:'entrance-head-conflict',time,queue:q});}
     if(frame%120===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const unfinishedQueueAges=Object.fromEntries([...queueWaitSince].map(([id,start])=>[id,sim.simulationTime-start]));
    for(const [id,age]of Object.entries(unfinishedQueueAges))if(age>90)issues.push({type:'queue-never-progressed',id,age,actor:snapshot(sim.residents.find(n=>n.id===id))});
    natural={duration,walkingChecks,sawSeat,sawStage,queueCounts,maxQueueWait:Object.fromEntries(maxQueueWait),unfinishedQueueAges,maxGap:Object.fromEntries(maxGap),stalls:[...stalls.values()],issues,events:allEvents,states:sim.residents.map(snapshot),navigation:sim.navigationStats,statesAtStall};
    await window.__saveQueueData('natural-city',natural);await capture('natural-city',sim,sim.district.tower.approach);
    check(!issues.length,'Natural city violated physical/FIFO/grounding invariants: '+JSON.stringify(issues.slice(0,2)));check(!stalls.size,'Natural residents stalled: '+[...stalls.keys()]);
    check(sawSeat&&sawStage,'Natural activity stopped using benches or gazebo');check(buildings.every(b=>queueCounts[b.id]),'Natural residents did not queue at all three buildings');
    check(allEvents.some(e=>e.type==='enter-room')&&allEvents.some(e=>e.type==='enter-building'),'Natural apartment trips did not complete');check(allEvents.some(e=>e.type==='chat'&&e.time>20),'Natural residents stopped socializing');cases.push('six-minute natural city: collision, queues, stage, homes and social liveness');
   }
   check(JSON.stringify(doc)===before,'Queue/stage behavior changed the map');
   return {cases,queues:queueResults,sharedCrossing:sharedCrossing&&{entered:sharedCrossing.entered,exitClearTime:sharedCrossing.exitClearTime,incomingServiceTime:sharedCrossing.incomingServiceTime,minGap:sharedCrossing.minGap,maxOutgoingRouteDeviation:sharedCrossing.maxOutgoingRouteDeviation},stage:{stairsIn,deck,stairsOut,stageExit},passing:passing&&{minDistance:passing.minDistance,maxLateral:passing.maxLateral,completed:passing.completed},natural:natural&&{duration:natural.duration,walkingChecks:natural.walkingChecks,sawSeat:natural.sawSeat,sawStage:natural.sawStage,queueCounts:natural.queueCounts,maxQueueWait:natural.maxQueueWait,maxGap:natural.maxGap,stalls:natural.stalls,issues:natural.issues},focused};
  }''',{'urls':urls,'duration':args.duration,'focused':args.focused})
  assert page.evaluate('townBuilder.project')==source
  if not args.focused:
   page.locator('#play').click();page.wait_for_function('!!window.townGame',timeout=120000)
   assert page.evaluate('townGame.project')==source
   page.evaluate('townGame.cam.zoom=.08');page.wait_for_timeout(2500)
   perf=page.evaluate('''()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1800){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})''')
   assert perf['fps']>25,perf
   result['overview']=perf
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  result.update(sourceUnchanged=True,errors=errors)
  if args.screenshots:save_data('results',result)
  print(json.dumps(result),flush=True)
  browser.close()
finally:server.shutdown()
