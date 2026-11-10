"""Walk through real exterior entrances and back outside, without E."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json';source=SOURCE.read_bytes();digest=hashlib.sha256(source).hexdigest();OUT=Path('/workspace/.onboarding/exterior-doors');OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1600,'height':1100});context.add_init_script('''(()=>{const raf=requestAnimationFrame;window.__exteriorObserve=null;window.__exteriorFrames=[];window.__exteriorKeys=[];addEventListener('keydown',e=>__exteriorKeys.push(e.key.toLowerCase()));window.requestAnimationFrame=f=>raf.call(window,t=>{f(t);if(__exteriorObserve&&window.townBuilder){const q=townBuilder.urban,p=q.portals.find(p=>p.id===__exteriorObserve);if(p){const a=q.scene?q.player:townBuilder.cam;__exteriorFrames.push({openness:q.automaticDoors.openness(p.door),distance:Math.hypot(a.x-p.threshold.x,a.y-p.threshold.y)});}}});})()''')
  page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder');
  if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  cases=[]
  for asset,rotation,kind in [('coda-furnishings',0,'shop'),('coda-furnishings',90,'shop'),('coda-residences',0,'lobby'),('sydney-opera-house',0,'concert')]:
   fixture=page.evaluate('''async ({asset,rotation})=>{const a=townBuilder.catalog.get(asset);await a.ensureFull?.();const o={id:'exterior-door-fixture',asset,x:8192,y:8500,scale:1,rotation,layer:'objects',collision:true},app=new URL(document.querySelector('script[type=module]').src),{buildingDoor}=await import(new URL('../world/urban.mjs'+app.search,app)),door=buildingDoor(o),angle=rotation*Math.PI/180,n={x:Math.sin(angle),y:-Math.cos(angle)};return {version:1,name:'Isolated exterior door QA',cells:{},edges:{},objects:[o],spawn:{x:door.x-n.x*180,y:door.y-n.y*180}};}''',{'asset':asset,'rotation':rotation})
   page.locator('#file').set_input_files({'name':'isolated-exterior.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_function('townBuilder.project.objects.length===1');page.locator('#walk').click();page.locator('#map').focus();page.wait_for_timeout(700)
   portal=page.evaluate('(()=>{const q=townBuilder.urban,p=q.portals[0];return {id:p.id,threshold:p.threshold,normal:p.enterNormal};})()');n=portal['normal'];key='d' if n['x']>.5 else 'a' if n['x']<-.5 else 's' if n['y']>.5 else 'w';page.evaluate('id=>{window.__exteriorObserve=id;window.__exteriorFrames=[]}',portal['id']);page.keyboard.down(key)
   try:page.wait_for_function('k=>townBuilder.urban.scene?.kind===k',arg=kind,timeout=10000);page.wait_for_timeout(600)
   finally:page.keyboard.up(key)
   assert page.evaluate('townBuilder.urban.scene?.kind')==kind;frames=page.evaluate('__exteriorFrames');assert any(f['openness']>0 and f['distance']>25 for f in frames),frames
   exit=page.evaluate('(()=>{const q=townBuilder.urban,p=q.portals.find(p=>p.action==="exit");Object.assign(q.player,{x:p.threshold.x-p.enterNormal.x*128,y:p.threshold.y-p.enterNormal.y*128});return {id:p.id,normal:p.enterNormal};})()');page.wait_for_timeout(950);n=exit['normal'];key='d' if n['x']>.5 else 'a' if n['x']<-.5 else 's' if n['y']>.5 else 'w';page.keyboard.down(key)
   try:page.wait_for_function('townBuilder.urban.scene===null',timeout=10000);page.wait_for_timeout(700)
   finally:page.keyboard.up(key)
   assert page.evaluate('townBuilder.urban.scene===null');after=page.evaluate('({...townBuilder.cam})');page.locator('#map').screenshot(path=str(OUT/(asset+'-'+str(rotation)+'.png')));page.locator('#walk').click();cases.append({'asset':asset,'rotation':rotation,'entered':kind,'openedBeforeTouch':True,'heldKeyArrivalStayedInside':True,'automaticExitStayedOutside':True,'after':after});print('Exterior door passed: '+asset+' '+str(rotation),flush=True)
  assert not page.evaluate('__exteriorKeys.filter(k=>k==="e"||k==="enter")')
  page.locator('#file').set_input_files(str(SOURCE));page.wait_for_function('townBuilder.project.objects.length===120');assert page.evaluate('townBuilder.project')==json.loads(source);assert not errors,errors;browser.close()
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==digest
 (OUT/'results.json').write_text(json.dumps({'cases':cases,'interactionKeys':0,'sourceUnchanged':True,'sourceHash':digest,'pageErrors':errors},indent=2))
finally:server.shutdown()
