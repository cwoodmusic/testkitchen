"""Placed Opera House receives actual town residents; seats reserve and galleries face inward."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/town-sweep/concert';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1740,'height':1120});page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'));page.wait_for_function('townBuilder.project.objects.length===137');page.wait_for_timeout(1000)
  if not page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  before=page.evaluate('JSON.stringify(townBuilder.project)');page.locator('#walk').click();page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='sydney-opera-house'))");page.wait_for_function('townBuilder.urban.scene?.kind==="concert"')
  initial=page.evaluate("townBuilder.ambient.interiorActors({kind:'concert'})");assert len(initial)>=2;assert any(a['seated'] for a in initial)
  reservations=[a['seatId'] for a in initial];assert len(set(reservations))==len(reservations);assert page.evaluate('(id)=>townBuilder.urban.watchSeat(id)',reservations[0])==False
  assert page.evaluate("townBuilder.urban.watchSeat('seat-1-14')");page.wait_for_timeout(800);page.screenshot(path=str(OUT/'audience-and-inward-galleries.png'))
  # Advance the actual simulation so a walking spectator reaches its chair.
  seated_before=sum(a['seated'] for a in initial)
  page.evaluate("async()=>{for(let n=0;n<200;n++){townBuilder.ambient.update(.1,n/10);if(n%20===0)await new Promise(r=>setTimeout(r,0));}}")
  people=page.evaluate("townBuilder.ambient.interiorActors({kind:'concert'})");assert sum(a['seated'] for a in people)>seated_before
  assert len({a['seatId'] for a in people})==len(people);assert all(a['seatId']!='seat-1-14' for a in people)
  page.screenshot(path=str(OUT/'seated-visitors.png'));events=page.evaluate('townBuilder.ambient.events');assert any(e['type']=='enter-venue' and e.get('kind')=='opera' for e in events)
  data=page.evaluate("async()=>{const {getConcertHall}=await import('/town/world/concert-hall.mjs?v=town-flight-1');return getConcertHall().audience.galleryFacing;}");assert data=={'left':'right','right':'left'}
  page.locator('#npcToggle').click();page.wait_for_timeout(100);assert page.evaluate('townBuilder.npcsVisible')==False;page.locator('#npcToggle').click();page.get_by_role('button',name='Go outside',exact=True).click();page.wait_for_function('!townBuilder.urban.active');assert page.evaluate('JSON.stringify(townBuilder.project)')==before;assert not errors,errors
  page.goto(f'http://127.0.0.1:{server.server_port}/town/?map=builder');page.wait_for_function('!!window.townGame');page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='sydney-opera-house'))");page.wait_for_function("townGame.ambient.interiorActors({kind:'concert'}).some(a=>a.seated)");assert page.evaluate('JSON.stringify(townGame.project)')==before;assert not errors,errors
  print(json.dumps({'initialAudience':len(initial),'seatedAfterVisit':sum(a['seated'] for a in people),'galleryFacing':data,'mapUnchanged':True,'errors':errors}));b.close()
finally:server.shutdown()
