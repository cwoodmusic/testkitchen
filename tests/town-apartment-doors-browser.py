"""Real-key automatic door journeys, with optional metadata-only furniture art.

--mock-collections intercepts only this isolated browser's catalog imports. All
real definitions, room geometry, collision boxes and door controllers remain
unchanged. Placeholder art is explicitly excluded from visual/artwork QA.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import argparse,hashlib,json,re
from playwright.sync_api import sync_playwright
from town_browser_compat import assert_original_furniture_stock

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json'
parser=argparse.ArgumentParser()
parser.add_argument('--mock-collections',action='store_true')
parser.add_argument('--showrooms',nargs='*',help='Optional representative showroom IDs; default visits all12')
parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/apartment-doors'))
args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
legacy={'id':'room-legacy-geranium','item':'furniture-geranium','asset':'decor-08-01','x':1800,'y':900,'scale':1}
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1740,'height':1120})
  context.add_init_script('''(()=>{
   localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,owned:['furniture-geranium'],rewards:[],earned:170,spent:20}));
   localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));
   window.__doorObservations=[];window.__doorObserveId=null;window.__doorKeys=[];addEventListener('keydown',e=>__doorKeys.push(e.key.toLowerCase()));
   const raf=requestAnimationFrame;window.__doorTrace=[];window.__doorLast='';window.requestAnimationFrame=fn=>raf.call(window,t=>{fn(t);const q=window.__activeDoorQA||window.townBuilder?.urban;if(q){const p=q.portals.find(p=>p.id===window.__doorObserveId);if(p&&q.scene)window.__doorObservations.push({openness:q.automaticDoors.openness(p.door),distance:Math.hypot(q.player.x-p.threshold.x,q.player.y-p.threshold.y)});const s=JSON.stringify(q.scene);if(s!==__doorLast){__doorLast=s;__doorTrace.push({time:t,scene:q.scene?{...q.scene}:null});}}});
  })()''')
  if args.mock_collections:
   def mock_registry(route):
    tag=urlsplit(route.request.url).query
    body=f"""export * from './apartment-collection-definitions.mjs?{tag}';
import {{APARTMENT_COLLECTION_ASSETS}} from './apartment-collection-definitions.mjs?{tag}';
export async function registerApartmentCollections(add){{return APARTMENT_COLLECTION_ASSETS.map(d=>{{const a=add(d.id,d.name,'apartment collections',d.w,d.h,c=>{{c.fillStyle='#a78262';c.fillRect(2,2,d.w-4,d.h-4);c.fillStyle='#dfce9d';c.fillRect(6,6,d.w-12,Math.max(8,d.h*.48));c.fillStyle='#38444d';c.font='9px sans-serif';c.fillText(d.slot,8,d.h-9);}},d.boxes.map(b=>({{...b}})),d.layer);Object.assign(a,{{...d,kit:'urban',pack:'TEST-ONLY-placeholder',collisionDefault:d.solid,npcAvoid:d.solid,depthSorted:d.solid,furnitureRole:d.purpose,collectionSlot:d.slot}});return a;}});}}
"""
    route.fulfill(status=200,content_type='text/javascript',body=body)
   context.route('**/world/apartment-collections.mjs*',mock_registry)
   def mock_catalog(route):
    body=(ROOT/'town/world/catalog.mjs').read_text();tag=urlsplit(route.request.url).query
    if 'registerApartmentCollections' not in body:
     body=f"import {{registerApartmentCollections}} from './apartment-collections.mjs?{tag}';\n"+body
     body=body.replace('await registerApartmentDecor(add);','await registerApartmentDecor(add);\nawait registerApartmentCollections(add);')
    route.fulfill(status=200,content_type='text/javascript',body=body)
   context.route('**/world/catalog.mjs*',mock_catalog)
  page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
  page.wait_for_function('!!window.townBuilder')
  original_stock=assert_original_furniture_stock(page)
  page.locator('#file').set_input_files(str(SOURCE));page.wait_for_function('townBuilder.project.objects.length===120')
  if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  page.locator('#walk').click();page.locator('#map').focus()
  setup=page.evaluate('''async()=>{
   const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{getInterior,residents}=await import(url('urban-interiors')),{SHOWROOMS}=await import(url('showroom-layout'));
   window.__doorQA={getInterior,residents,SHOWROOMS,q:()=>window.__activeDoorQA||townBuilder.urban,snapshot(){const q=this.q();return {scene:q.scene?{...q.scene}:null,player:{...q.player},portals:q.portals.map(p=>({id:p.id,action:p.action,resident:p.resident,showroomId:p.showroomId,threshold:p.threshold,enterNormal:p.enterNormal,approach:p.approach,trigger:p.trigger,openness:q.automaticDoors.openness(p.door)})),doors:q.automaticDoors?.states.map(s=>({id:s.id,openness:s.openness,target:s.target,occupied:s.occupied,opening:s.opening}))};}
   };return {showrooms:SHOWROOMS.map(r=>({id:r.id,name:r.name,storeFloor:r.storeFloor})),stock:CodaFurnitureCatalog.length,residents:residents.map(r=>({id:r.id,floor:r.floor})),tag:app.search,placeholderArt:[...townBuilder.catalog.values()].filter(a=>a.pack==='TEST-ONLY-placeholder').length};
  }''')
  assert len(setup['showrooms'])==12 and setup['stock']==484,setup
  if args.mock_collections:assert setup['placeholderArt']==992,setup
  def snap():return page.evaluate('__doorQA.snapshot()')
  def key_for(n):return 'd' if n['x']>.5 else 'a' if n['x']<-.5 else 's' if n['y']>.5 else 'w'
  def approach_fixture(target):
   # Set a clear initial pose; the crossing itself uses actual keyboard events.
   before=snap();page.evaluate('p=>Object.assign(__doorQA.q().player,p)',target);page.wait_for_timeout(950)
   at=snap();assert at['scene']==before['scene'],at
   return {'initialPose':at['player'],'scene':at['scene'],'crossingUsesRealKeys':True}
  def cross(portal,expected,hold_after=500):
   count=page.evaluate('__doorTrace.length');page.evaluate('id=>{window.__doorObserveId=id;window.__doorObservations=[]}',portal['id']);key=key_for(portal['enterNormal']);page.keyboard.down(key)
   try:
    page.wait_for_function('expected=>{const s=(window.__activeDoorQA||townBuilder.urban).scene;return Object.entries(expected).every(([k,v])=>s?.[k]===v)}',arg=expected,timeout=8000)
    page.wait_for_timeout(hold_after)
   finally:page.keyboard.up(key)
   after=snap();assert all(after['scene'].get(k)==v for k,v in expected.items()),after
   trace=page.evaluate('(n)=>__doorTrace.slice(n)',count);assert len(trace)==1,trace
   observations=page.evaluate('window.__doorObservations');assert any(o['openness']>0 and o['distance']>24 for o in observations),observations;page.evaluate('window.__doorObserveId=null');return {'beforePortal':portal,'after':after,'transitions':trace,'openedBeforeLeaf':True}
  journeys=[]
  page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'))")
  assert page.evaluate("townBuilder.urban.openShowroom('retrofuture')") is False
  assert snap()['scene']=={'kind':'shop','floor':1}
  # Use the actual lift interaction and its visible floor directory.
  page.evaluate("()=>{const q=townBuilder.urban,z=__doorQA.getInterior(q.scene).zones.find(z=>z.action==='store-elevator');Object.assign(q.player,{x:z.x+z.w/2,y:z.y+z.h/2});}")
  page.locator('#map').focus();page.keyboard.press('e')
  page.get_by_role('button',name=re.compile('^Upper gallery ·')).click()
  page.wait_for_function('townBuilder.urban.scene?.kind==="shop"&&townBuilder.urban.scene.floor===2')
  assert snap()['player']=={'x':1536,'y':380},snap()
  assert page.evaluate("townBuilder.urban.openShowroom('victorian-parlor')") is False
  # The stairs return to the matching arrival on the main floor.
  page.evaluate("()=>{const q=townBuilder.urban,z=__doorQA.getInterior(q.scene).zones.find(z=>z.action==='store-floor');Object.assign(q.player,{x:z.x+z.w/2,y:z.y+z.h/2});}")
  page.locator('#map').focus();page.keyboard.press('e')
  page.wait_for_function('townBuilder.urban.scene?.floor===1')
  assert snap()['player']=={'x':1732,'y':380},snap()
  floor_navigation={'liftViaInteraction':True,'stairsViaInteraction':True,'wrongFloorRoomsRejected':True}
  for showroom in [r for r in setup['showrooms'] if not args.showrooms or r['id'] in args.showrooms]:
   if snap()['scene']['floor']!=showroom['storeFloor']:
    page.get_by_role('button',name='Store floors',exact=True).click();page.get_by_role('button',name=re.compile('^Upper gallery ·' if showroom['storeFloor']==2 else '^Main lobby ·')).click();page.wait_for_function('floor=>townBuilder.urban.scene?.floor===floor',arg=showroom['storeFloor'])
   portal=next(p for p in snap()['portals'] if p.get('showroomId')==showroom['id'] and p['action']=='showroom')
   n=portal['enterNormal'];t=portal['threshold'];approach={'x':t['x']-n['x']*128,'y':t['y']-n['y']*128}
   entry_route=approach_fixture(approach);entered=cross(portal,{'kind':'showroom','showroomId':showroom['id'],'floor':showroom['storeFloor']},600)
   # Walk well clear of the arrival threshold before choosing to leave.
   exit_portal=next(p for p in snap()['portals'] if p['action']=='showroom-lobby');n=exit_portal['enterNormal'];t=exit_portal['threshold']
   exit_route=approach_fixture({'x':t['x']-n['x']*128,'y':t['y']-n['y']*128});exited=cross(exit_portal,{'kind':'shop','floor':showroom['storeFloor']},600)
   page.wait_for_timeout(150);assert snap()['scene']=={'kind':'shop','floor':showroom['storeFloor']}
   journeys.append({'id':showroom['id'],'floor':showroom['storeFloor'],'entryRoute':entry_route,'entry':entered,'exitRoute':exit_route,'exit':exited})
   if showroom['id']=='industrial-loft':page.locator('#map').screenshot(path=str(args.screenshots/'store-main-doors.png'))
   print('Automatic keyboard entry + exit: '+showroom['id'],flush=True)
   (args.screenshots/'journeys-progress.json').write_text(json.dumps(journeys,indent=2))
  page.locator('#map').screenshot(path=str(args.screenshots/'store-upper-doors.png'))
  # One compact and one wide home, plus the player's existing room record.
  tower=[]
  for resident in ['bach','miles','player']:
   floor=15 if resident=='player' else next(r['floor'] for r in setup['residents'] if r['id']==resident)
   page.evaluate('(floor)=>townBuilder.urban.goFloor(floor)',floor);portal=next(p for p in snap()['portals'] if p.get('resident')==resident);n=portal['enterNormal'];t=portal['threshold']
   approach_fixture({'x':t['x']-n['x']*128,'y':t['y']-n['y']*128});entered=cross(portal,{'kind':'apartment','resident':resident},600)
   if resident=='player':assert page.evaluate('townBuilder.urban.decor')==[legacy]
   exit_portal=next(p for p in snap()['portals'] if p['action']=='exit');n=exit_portal['enterNormal'];t=exit_portal['threshold'];approach_fixture({'x':t['x']-n['x']*128,'y':t['y']-n['y']*128});exited=cross(exit_portal,{'kind':'hall','floor':floor},600)
   tower.append({'resident':resident,'entry':entered,'exit':exited});print('Automatic apartment entry + exit: '+resident,flush=True)
  page.locator('#map').screenshot(path=str(args.screenshots/'hall-door.png'))
  # A production controller without builder's intentional friendship preview.
  page.locator('#walk').click()
  lock_setup=page.evaluate('''async()=>{
   const app=new URL(document.querySelector('script[type=module]').src),{createUrbanController}=await import(new URL('../world/urban.mjs'+app.search,app));
   const cv=document.createElement('canvas');cv.width=1200;cv.height=760;cv.tabIndex=0;cv.id='door-lock-qa';cv.style.cssText='position:fixed;left:0;top:0;width:1200px;height:760px;z-index:9999';document.body.append(cv);const keys=new Set();window.__doorNPCs=[];addEventListener('keydown',e=>keys.add(e.key.toLowerCase()));addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
   const q=createUrbanController({canvas:cv,getProject:()=>townBuilder.project,getPlayer:()=>({x:0,y:0}),getResidents:()=>__doorNPCs,preview:false});window.__activeDoorQA=q;
   const ctx=cv.getContext('2d'),actorRenderer=window.createCodaCharacterRenderer({worldScale:128/44}),actorProfile=actorRenderer.normalizeProfile({});let last=performance.now();window.__doorLockStop=false;function lockFrame(now){if(__doorLockStop)return;const dt=Math.min(.04,(now-last)/1000);last=now;q.frame(ctx,keys,dt,now,cv.width,cv.height,(c,x,y,state)=>actorRenderer.drawPlayer(c,actorProfile,{x,y,...state},now/1000));requestAnimationFrame(lockFrame);}requestAnimationFrame(lockFrame);
   q.goFloor(__doorQA.residents.find(r=>r.id==='bach').floor);const portal=q.portals.find(p=>p.resident==='bach');Object.assign(q.player,{x:portal.threshold.x,y:portal.threshold.y+130});cv.focus();return {portal:{threshold:portal.threshold,normal:portal.enterNormal},floor:q.scene.floor};
  }''')
  page.keyboard.down('w');page.wait_for_timeout(750);locked=snap();assert locked['scene']['kind']=='hall';assert next(p for p in locked['portals'] if p.get('resident')=='bach')['openness']==0,locked
  page.evaluate('t=>window.__doorNPCs=[{id:"bach",x:t.x,y:t.y+30}]',lock_setup['portal']['threshold']);page.wait_for_timeout(350);npc_open=snap();assert next(p for p in npc_open['portals'] if p.get('resident')=='bach')['openness']>.9,npc_open
  assert npc_open['scene']['kind']=='hall' and abs(npc_open['player']['y']-locked['player']['y'])<5,(locked,npc_open)
  page.keyboard.up('w');page.locator('#door-lock-qa').screenshot(path=str(args.screenshots/'locked-owner-npc-open.png'))
  # Closing is independent of distance to the owner's new stationary pose.
  page.evaluate('()=>{window.__doorNPCs=[];const q=__activeDoorQA;q.player.y+=120;}');page.wait_for_timeout(1100);closed=snap();assert next(p for p in closed['portals'] if p.get('resident')=='bach')['openness']==0,closed
  page.evaluate("__activeDoorQA.openRoom('player')");assert page.evaluate('__activeDoorQA.decor')==[legacy]
  privacy=[]
  for privacy_case in [('player',0),('player',1),('steampunk-horizontal',None)]:
   case,index=privacy_case
   if case=='steampunk-horizontal':
    page.evaluate("()=>{const q=__activeDoorQA;q.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));q.goStoreFloor(2);q.openShowroom('steampunk');}")
    index=page.evaluate("__doorQA.getInterior(__activeDoorQA.scene).privacyDoors.findIndex(d=>d.axis==='horizontal')")
    assert index>=0
   info=page.evaluate('''i=>{const q=__activeDoorQA,m=__doorQA.getInterior(q.scene),d=m.privacyDoors[i],s=q.automaticDoors.states.find(s=>s.door===d),o=s.opening;window.__doorNPCs=[];Object.assign(q.player,{x:o.x+o.nx*125,y:o.y+o.ny*125});return {id:s.id,o,axis:d.axis};}''',index)
   o=info['o'];n={'x':-o['nx'],'y':-o['ny']};page.wait_for_timeout(1100);page.locator('#door-lock-qa').screenshot(path=str(args.screenshots/(case+'-'+str(index)+'-closed.png')));key=key_for(n);page.keyboard.down(key);page.wait_for_timeout(600);page.keyboard.up(key);through=snap();state=next(d for d in through['doors'] if d['id']==info['id']);assert state['openness']>.7,state
   signed=(through['player']['x']-o['x'])*o['nx']+(through['player']['y']-o['y'])*o['ny'];assert signed<-25,('Player did not walk through privacy door',info,through)
   page.locator('#door-lock-qa').screenshot(path=str(args.screenshots/(case+'-'+str(index)+'-open.png')))
   # Stand 100px inside: door must close after the character clears the leaf.
   page.evaluate('o=>Object.assign(__activeDoorQA.player,{x:o.x-o.nx*110,y:o.y-o.ny*110})',o);page.wait_for_timeout(1100);after=snap();assert next(d for d in after['doors'] if d['id']==info['id'])['openness']==0,after
   # A passing NPC also opens, holds, and clears this same physical leaf.
   page.evaluate('o=>{Object.assign(__activeDoorQA.player,{x:1152,y:900});window.__doorNPCs=[{id:"bath-test-npc",x:o.x+o.nx*60,y:o.y+o.ny*60}]}',o);page.wait_for_timeout(300);opened=snap();assert next(d for d in opened['doors'] if d['id']==info['id'])['openness']>.9,opened
   page.evaluate('o=>{window.__doorNPCs[0].x=o.x-o.nx*120;window.__doorNPCs[0].y=o.y-o.ny*120}',o);page.wait_for_timeout(1100);npc_closed=snap();assert next(d for d in npc_closed['doors'] if d['id']==info['id'])['openness']==0,npc_closed
   page.locator('#door-lock-qa').screenshot(path=str(args.screenshots/(case+'-'+str(index)+'-closed-behind.png')))
   privacy.append({'scene':case,'axis':info['axis'],'id':info['id'],'playerCrossed':True,'closedBehindPlayer':True,'npcOpenedAndCleared':True})
  page.locator('#door-lock-qa').screenshot(path=str(args.screenshots/'privacy-door.png'))
  assert page.evaluate('__doorKeys.filter(k=>k==="e").length')==2 and page.evaluate('__doorKeys.filter(k=>k==="enter").length')==0,'An entrance crossing used an interaction key'
  assert page.evaluate('townBuilder.project')==json.loads(SOURCE.read_bytes())
  assert not errors,errors
  page.evaluate('window.__doorLockStop=true');browser.close()
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
 result={'mockArtwork':args.mock_collections,'artworkVerified':False,'setup':setup,'originalStock':original_stock,'floorNavigation':floor_navigation,'showroomJourneys':journeys,'towerJourneys':tower,'lock':{'uninvitedBlocked':True,'ownerNpcOpened':True,'uninvitedStillBlocked':True,'closedBehind':True},'privacy':privacy,'sourceUnchanged':True,'sourceHash':source_hash,'pageErrors':errors}
 (args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'showrooms':len(journeys),'towerHomes':len(tower),'locks':True,'privacy':privacy,'doorInteractionKeys':0,'storeMenuInteractionKeys':2,'mockArtwork':args.mock_collections,'sourceUnchanged':True,'pageErrors':errors}),flush=True)
finally:server.shutdown()
