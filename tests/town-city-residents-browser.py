"""Persistent city residents, social activities and cart dialogue regression.

Run: python tests/town-city-residents-browser.py --map project.json
The source JSON is never modified. Simulation runs in an isolated browser.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError
import argparse
import base64
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--map',type=Path,default=ROOT/'town/maps/coda-town-courtyards.json')
parser.add_argument('--screenshots',type=Path)
parser.add_argument('--duration',type=int,default=360,help='Seconds of deterministic city simulation')
parser.add_argument('--url',help='Optional published builder URL')
args=parser.parse_args()
source_bytes=args.map.read_bytes();source=json.loads(source_bytes)
source_hash=hashlib.sha256(source_bytes).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1000})
  if args.url:
   # Chromium has separate CA storage; the environment's verified HTTP client
   # fulfills production requests without disabling certificate validation.
   def production(route):
    try:
     with urlopen(route.request.url,timeout=45) as response:
      route.fulfill(status=response.status,headers={'content-type':response.headers.get('content-type','application/octet-stream')},body=response.read())
    except HTTPError as error:route.fulfill(status=error.code,body=error.read())
   context.route('https://cwoodmusic.github.io/**',production)
  page=context.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/',timeout=120000)
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  page.locator('#file').set_input_files(str(args.map))
  page.wait_for_function('n=>townBuilder.project.objects.length===n',arg=len(source['objects']),timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  if not page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  urls=page.evaluate('''()=>{
   const app=new URL(document.querySelector('script[type="module"]').src);
   return Object.fromEntries(['ambient-npcs','model','runtime','resident-profiles','urban-interiors'].map(name=>[name,new URL('../world/'+name+'.mjs'+app.search,app).href]));
  }''')
  # A separate simulator can advance several city minutes without changing the
  # live editor's clock, camera, NPCs, saved project or player progress.
  behavior=page.evaluate('''async({urls,duration})=>{
   const {createAmbientNPCs}=await import(urls['ambient-npcs']),{blocked,height}=await import(urls.model);
   const {render}=await import(urls.runtime),{residents:profiles}=await import(urls['resident-profiles']);
   const {getInterior,renderInterior}=await import(urls['urban-interiors']);
   const doc=townBuilder.project,before=JSON.stringify(doc),catalog=townBuilder.catalog;
   const check=(ok,message)=>{if(!ok)throw Error(message);};
   const seeded=()=>{let n=0x63cd1a;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};};
   const cameraA={x:8192,y:6144,zoom:.8},cameraB={x:1000,y:1000,zoom:.08};
   const make=cam=>createAmbientNPCs({getProject:()=>doc,catalog,getCamera:()=>cam,getViewport:()=>({width:1040,height:942}),random:seeded()});
   const a=make(cameraA),b=make(cameraB);a.update(0,0);b.update(0,0);
   const poses=sim=>sim.residents.map(n=>({id:n.id,x:n.x,y:n.y,state:n.state,activity:n.activity,location:n.location}));
   check(a.residents.length===18,'All eighteen residents were not initialized');
   check(new Set(a.residents.map(n=>n.id)).size===18,'Resident identities are duplicated');
   check(JSON.stringify(poses(a))===JSON.stringify(poses(b)),'Initial population follows the camera');
   // Zero simulation time isolates a pan from ordinary movement. Navigation
   // deliberately uses a wall-time budget, so comparing two independently
   // advanced planners frame-for-frame would test CPU scheduling instead.
   const initialPoses=JSON.stringify(poses(a));
   for(let i=1;i<=20;i++){
    Object.assign(cameraA,{x:i%2?14500:1000,y:i%2?1000:11000,zoom:i%2?.08:1.6});
    a.update(0,0);
    check(JSON.stringify(poses(a))===initialPoses,'Moving the camera changed resident behavior');
   }
   const ids=a.residents.map(n=>n.id).sort(),vendorIds=a.actors.filter(n=>String(n.id).startsWith('vendor:')).map(n=>n.id).sort();
   const vendorStarts=new Map(a.actors.filter(n=>vendorIds.includes(n.id)).map(n=>[n.id,{x:n.x,y:n.y}]));
   const seen={walking:0,seated:0,chatting:0,apartment:0,hall:0,lobby:0},visited=new Set(),shots={};
   const progress=new Map(),stalls=new Map();let maxMotionGap=0;
   const scenes=[{kind:'lobby',floor:1},...Array.from({length:13},(_,i)=>({kind:'hall',floor:i+2})),...profiles.map(r=>({kind:'apartment',floor:r.floor,resident:r.id}))];
   function shot(label,actors,focus,time){
    if(shots[label])return;
    const cv=document.createElement('canvas');cv.width=900;cv.height=650;const c=cv.getContext('2d');
    c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;
    render(c,doc,{x:focus.x,y:focus.y-height(doc,focus.x,focus.y)-60,zoom:1.4},1800,1300,{time,night:false,npcs:actors,drawNPC:a.draw,terrainRevision:0});
    shots[label]=cv.toDataURL('image/png');
   }
   function interiorShot(scene,actors,time){
    if(shots['apartment-door'])return;
    const cv=document.createElement('canvas');cv.width=900;cv.height=650;const c=cv.getContext('2d'),m=getInterior(scene);
    const actor=actors[0],scale=Math.min(.85,850/m.width,600/m.height);
    c.fillStyle='#131b21';c.fillRect(0,0,900,650);c.save();c.translate((900-m.width*scale)/2,(650-m.height*scale)/2);c.scale(scale,scale);
    renderInterior(c,scene,{actors,time});c.restore();shots['apartment-door']=cv.toDataURL('image/png');
   }
   for(let frame=1;frame<=duration*10;frame++){
    const time=frame/10;a.update(.1,time);
    check(JSON.stringify(a.residents.map(n=>n.id).sort())===JSON.stringify(ids),'A resident was recreated or removed');
    for(const n of a.actors){
     check(Number.isFinite(n.x)&&Number.isFinite(n.y),'Non-finite actor position');
     if(vendorStarts.has(n.id)){
      const old=vendorStarts.get(n.id);check(n.x===old.x&&n.y===old.y,'Vendor left its cart');shot('cart-host',a.actors,n,time);continue;
     }
     const q=a.district.bounds;
     check(n.x>=q.x0-64&&n.x<=q.x1+64&&n.y>=q.y0-64&&n.y<=q.y1+64,'Resident left the three-building district');
     if(n.state==='walking'||n.state==='waiting'){
      let old=progress.get(n.id);
      if(!old||Math.hypot(n.x-old.x,n.y-old.y)>=90){old={x:n.x,y:n.y,time};progress.set(n.id,old);}
      const gap=time-old.time;maxMotionGap=Math.max(maxMotionGap,gap);
      if(gap>25)stalls.set(n.id,{id:n.id,seconds:gap,state:n.state,goal:n._goal?.id,x:n.x,y:n.y});
     }else progress.delete(n.id);
     if(n.walking){seen.walking++;check(!blocked(doc,n.x,n.y,catalog),`Walking resident ${n.id} entered a solid, water or cliff at ${n.x},${n.y}`);}
     if(n.seated||n.activity==='relaxing'){
      seen.seated++;check(a.seatClaims.get(n.seatId)===n.id,'Seated resident has no exclusive bench claim');
      const bench=a.district.benches.find(b=>b.id===n.seatId);check(bench&&Math.hypot(n.x-bench.seat.x,n.y-bench.seat.y)<1,'Seated pose is detached from its bench cushion');
      shot('bench-sitting',a.actors,n,time);
      if(String(n.seatId).startsWith('bench:'))shot('standalone-bench',a.actors,n,time);
     }
     if(n.activity==='chatting'){
      seen.chatting++;const partner=a.actors.find(other=>other.id===n.conversation&&other.activity==='chatting'&&other.conversation===n.id&&Math.hypot(other.x-n.x,other.y-n.y)<240);
      check(partner,'Chatting resident has no nearby conversation partner');
      const direction=Math.abs(partner.x-n.x)>Math.abs(partner.y-n.y)?partner.x<n.x?'left':'right':partner.y<n.y?'up':'down';
      check(n.facing===direction,'Conversation participants do not face one another');
      shot('conversation',a.actors,{x:(n.x+partner.x)/2,y:(n.y+partner.y)/2},time);
     }
     if(frame%10===0)for(const anchor of a.district.anchors)if(Math.hypot(n.x-anchor.x,n.y-anchor.y)<120)visited.add(anchor.kind);
    }
    if(frame%10===0){
     const present=new Set(a.actors.filter(n=>ids.includes(n.id)).map(n=>n.id));
     for(const scene of scenes){
      const actors=a.interiorActors(scene);
      for(const actor of actors){check(!present.has(actor.id),'Resident is duplicated between street/interior scenes');present.add(actor.id);seen[scene.kind]++;}
      if(scene.kind==='apartment'&&actors.some(n=>n.walking&&n.y>850))interiorShot(scene,actors,time);
     }
    }
    if(frame%100===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   check(seen.walking>0,'Residents never walked');check(seen.seated>0,'Residents never sat on benches');
   check(seen.chatting>0,'Residents never stopped for a conversation');
   check(seen.apartment>0&&seen.hall>0&&seen.lobby>0,'Apartment/hall/lobby trips did not occur');
   check(JSON.stringify(a.actors.filter(n=>vendorIds.includes(n.id)).map(n=>n.id).sort())===JSON.stringify(vendorIds),'Vendor identities changed');
   check(JSON.stringify(doc)===before,'Resident simulation modified the map');
   window.__cityResidentShots=shots;
   const events=a.events,returns=events.filter(e=>e.type==='enter-room'),cycles=returns.filter(e=>events.some(l=>l.id===e.id&&l.type==='exit-building'&&l.time>e.time)),laterChats=events.filter(e=>e.type==='chat'&&e.time>20);
   const diagnostics=a.residents.map(n=>({id:n.id,state:n.state,location:n.location,x:n.x,y:n.y,goal:n._goal,homeDue:n._homeDue,pending:n._pending,pathLength:n._path?.length,next:n._path?.[0],yield:n._yield,stuck:n._stuck,wait:n._wait}));
   return {residents:ids.length,vendors:vendorIds.length,cameraIndependent:true,seen,visited:[...visited],events,laterChats:laterChats.length,homeReturns:returns.length,completeCycles:cycles.length,maxMotionGap,stalls:[...stalls.values()],diagnostics,navigation:a.navigationStats,simulationTime:a.simulationTime};
  }''',{'urls':urls,'duration':args.duration})
  if args.screenshots:
   args.screenshots.mkdir(parents=True,exist_ok=True)
   (args.screenshots/'behavior.json').write_text(json.dumps(behavior,indent=2))
   for label,data in page.evaluate('__cityResidentShots').items():
    (args.screenshots/(label+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  assert behavior['homeReturns']>0,('No resident completed a return to their apartment',behavior['diagnostics'],behavior['navigation'])
  assert behavior['completeCycles']>0,'No resident left again after returning to their apartment'
  assert not behavior['stalls'],('Residents stayed in transit without making progress for over 25 seconds',behavior['stalls'])
  assert behavior['laterChats']>0,'Residents never formed a conversation after their initial placement'
  assert {'tower','arcade','shop'}<=set(behavior['visited']),('Residents did not visit all three buildings',behavior['visited'])
  # Real builder panning must leave the original residents in the same city.
  page.evaluate('Object.assign(townBuilder.cam,{x:1000,y:1000,zoom:.08})')
  page.wait_for_timeout(350)
  assert page.evaluate('townBuilder.project')==source
  page.locator('#play').click();page.wait_for_function('!!window.townGame',timeout=120000)
  assert page.evaluate('townGame.project')==source
  page.evaluate('Object.assign(townGame.cam,{x:11200,y:6500,zoom:.08})')
  page.wait_for_timeout(2500)
  perf=page.evaluate('''()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1800){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})''')
  assert perf['fps']>25,perf
  # Entering the player's room keeps the same city simulation advancing.
  before=page.evaluate('townGame.ambient.simulationTime')
  page.evaluate("()=>{const tower=townGame.project.objects.find(o=>townGame.catalog.get(o.asset)?.urban==='tower');if(!tower)throw Error('No apartment tower');townGame.urban.enterBuilding(tower);townGame.urban.openRoom('player');}")
  page.wait_for_timeout(1100)
  assert page.evaluate('townGame.urban.scene.resident')=='player'
  assert page.evaluate('townGame.ambient.simulationTime')>before,'Residents stopped advancing while player was indoors'
  page.evaluate('townGame.urban.reset()')
  # Cart hosts only open conversation. They do not change Notes or sell goods.
  vendor=page.evaluate("(()=>{const v=townGame.ambient.actors.find(n=>String(n.id).startsWith('vendor:'));return v&&{id:v.id,x:v.x,y:v.y};})()")
  assert vendor,'No cart host is visible on the populated map'
  target=page.evaluate('''id=>{const v=townGame.ambient.district.vendors.find(v=>v.id===id);return v.interaction||v;}''',vendor['id'])
  page.evaluate('p=>Object.assign(townGame.player,p)',target)
  page.keyboard.press('e');page.wait_for_function("document.querySelector('.urban-dialog').open")
  dialogue=page.locator('.urban-dialog').inner_text()
  assert not any(word in dialogue.lower() for word in ['buy ·','purchase','your balance','notes wallet']),dialogue
  assert page.locator('.urban-dialog button').count()>=1
  page.wait_for_timeout(700)
  assert page.evaluate("id=>{const v=townGame.ambient.actors.find(n=>n.id===id);return v._held===true;}",vendor['id'])
  if args.screenshots:page.screenshot(path=str(args.screenshots/'vendor-dialogue.png'))
  page.locator('.urban-dialog button').filter(has_text='Close').first.click()
  assert page.evaluate("id=>!townGame.ambient.actors.find(n=>n.id===id)._held",vendor['id'])
  # A resident pauses for the player, then resumes their existing trip.
  held=page.evaluate('''()=>{
   const residents=townGame.ambient.actors.filter(n=>n.role==='resident');
   const n=residents.find(n=>n.state==='walking'&&n._goal&&Math.hypot(n.x-n._goal.x,n.y-n._goal.y)>300&&residents.every(b=>b===n||Math.hypot(b.x-n.x,b.y-n.y)>250));
   if(!n)throw Error('No walking resident available for a greeting');
   Object.assign(townGame.player,{x:n.x+80,y:n.y});
   if(!townGame.urban.interact())throw Error('Resident greeting did not open');
   return {id:n.id,x:n.x,y:n.y};
  }''')
  page.wait_for_timeout(1100)
  assert page.evaluate('''p=>{const n=townGame.ambient.residents.find(n=>n.id===p.id);return n._held&&n.x===p.x&&n.y===p.y&&!n.walking;}''',held),'Resident walked away during player dialogue'
  page.locator('.urban-dialog button').filter(has_text='Close').first.click()
  page.evaluate('townGame.player.x+=350')
  page.wait_for_function('''p=>{const n=townGame.ambient.residents.find(n=>n.id===p.id);return !n._held&&Math.hypot(n.x-p.x,n.y-p.y)>20;}''',arg=held,timeout=15000)
  # Friendship doors keep their gate. An isolated test profile can then open
  # an invited room to check the same live resident's indoor conversation.
  indoor=page.evaluate('''()=>{
   const n=townGame.ambient.residents.find(n=>n.state==='home'&&n._leaveAt>townGame.ambient.simulationTime+6);
   if(!n)throw Error('No resident is currently at home');
   const tower=townGame.project.objects.find(o=>townGame.catalog.get(o.asset)?.urban==='tower');
   townGame.urban.enterBuilding(tower);townGame.urban.openRoom(n.id);return{id:n.id,x:n.x,y:n.y};
  }''')
  assert 'friendship' in page.locator('.urban-dialog').inner_text().lower(),'Apartment friendship gate was bypassed'
  page.locator('.urban-dialog button').filter(has_text='Close').first.click()
  page.evaluate('''id=>window.postMessage({type:'coda-town-state-result',people:[{id,relationship:{count:5}}]},location.origin)''',indoor['id'])
  page.wait_for_timeout(50)
  page.evaluate('''id=>{townGame.urban.openRoom(id);const n=townGame.ambient.interiorActors(townGame.urban.scene).find(n=>n.id===id);if(!n)throw Error('Resident missing from their room');Object.assign(townGame.urban.player,{x:n.x+75,y:n.y});townGame.urban.interact();}''',indoor['id'])
  page.wait_for_timeout(1000)
  assert page.evaluate('''p=>{const n=townGame.ambient.residents.find(n=>n.id===p.id);return n._held&&n.x===p.x&&n.y===p.y;}''',indoor),'Indoor resident did not pause for the player'
  page.keyboard.press('Escape');page.wait_for_function("!document.querySelector('.urban-dialog').open")
  assert page.evaluate('id=>!townGame.ambient.residents.find(n=>n.id===id)._held',indoor['id']),'Escape left the resident held'
  page.evaluate('townGame.urban.reset()')
  assert page.evaluate('townGame.project')==source
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  summary={k:v for k,v in behavior.items() if k not in {'events','diagnostics'}}
  print(json.dumps({'behavior':summary,'overview':perf,'indoorSimulation':True,'dialogueHoldResume':True,'friendshipGateRetained':True,'vendorDialogue':dialogue,'sourceObjects':len(source['objects']),'errors':errors}),flush=True)
  browser.close()
finally:server.shutdown()
