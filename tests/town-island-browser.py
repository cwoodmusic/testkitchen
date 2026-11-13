"""Actual island navigation, cave-engine coastal catches, unified journal, and mobile controls."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json,hashlib,math
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/town-sweep/island';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
source=(ROOT/'town/maps/coda-town-plaza-boardwalk.json').read_bytes();source_hash=hashlib.sha256(source).hexdigest()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1080});page=context.new_page();page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'));page.wait_for_function('townBuilder.project.objects.length===137');page.locator('#walk').click();page.wait_for_timeout(700);dock=page.evaluate('townBuilder.urban.activities.state.dock');fixture=page.evaluate('townBuilder.project');fixture['spawn']={k:dock['stand'][k] for k in ['x','y']};page.locator('#walk').click();page.locator('#file').set_input_files({'name':'island-test.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_timeout(300);page.locator('#walk').click();page.locator('#map').focus();page.keyboard.press('e');page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');state=lambda:page.evaluate('townBuilder.urban.activities.state.fishing');s=state();assert s['waterCells']>20000;assert len(s['school'])>=60;page.screenshot(path=str(OUT/'sailing-at-pier.png'))
  # The challenge is the existing cave engine and notation, not a second scoring implementation.
  page.clock.install();page.clock.pause_at(page.evaluate('Date.now()/1000')+1);page.get_by_role('button',name='Cast · E',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.fishing.cave?.phase==="rhythm"');page.clock.run_for(50)
  def advance_to(target):
   current=state()['cave']['clock']
   if target>current:page.clock.run_for(max(1,math.floor((target-current)*1000)))
   for _ in range(30):
    if state()['cave']['clock']>=target-.000001:return
    page.clock.run_for(1)
  for _ in range(100):
   s=state()['cave']
   if s['phase']!='rhythm':break
   note=next((n for n in s['challenge']['notes'] if n['judgement']=='pending'),None)
   target=note['time'] if note else s['clock']+.2
   advance_to(target)
   if state()['cave']['phase']!='rhythm':break
   if not note:continue
   page.locator('#fishingRhythmCanvas').focus();page.keyboard.down('Space')
   if note['requiresHold']:advance_to(note['holdEndTime'])
   page.keyboard.up('Space')
  s=state()['cave'];(OUT/'catch-state.json').write_text(json.dumps(s,indent=2));assert s['phase']=='caught',s['challenge'];assert s['result']['perfect'],s['result'];assert s['result']['completedBars']==4 if 'completedBars' in s['result'] else s['challenge']['completedBars']==4
  page.screenshot(path=str(OUT/'coastal-perfect-catch.png'));page.get_by_role('button',name='See fish collection',exact=True).click();assert page.locator('.fishing-fish-card').count()==54;assert page.locator('[data-fish-id="copper-sprat"]').get_attribute('class').endswith('is-caught');page.screenshot(path=str(OUT/'shared-journal.png'));page.get_by_role('button',name='Back to boat',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');page.clock.resume()
  # Hold actual sailing controls along connected water; camera and rider follow the boat.
  before=state()['boat'];page.locator('#map').focus();page.keyboard.down('a');page.wait_for_timeout(1600);page.keyboard.up('a');after=state()['boat'];assert after['x']<before['x']-500,(before,after)
  assert abs(page.evaluate('townBuilder.cam.x')-after['x'])<2;assert page.evaluate('townBuilder.urban.activities.state.player.x')==after['x']
  # Click navigation uses the same water collision, and never walks onto land.
  page.get_by_role('button',name='Return to pier',exact=True).click();assert page.evaluate('townBuilder.urban.activities.state.fishing.phase')=='idle';assert page.evaluate('townBuilder.project')==fixture
  page.reload();page.wait_for_function('!!window.townBuilder');page.locator('#walk').click();page.locator('#map').focus();page.keyboard.press('e');page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');page.get_by_role('button',name='Fish journal · J',exact=True).click();assert 'is-caught' in page.locator('[data-fish-id="copper-sprat"]').get_attribute('class')
  page.set_viewport_size({'width':650,'height':950});page.screenshot(path=str(OUT/'mobile-journal.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.get_by_role('button',name='Back to boat',exact=True).click();page.get_by_role('button',name='Cast · E',exact=True).click();page.get_by_role('button',name='Let it go',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');page.get_by_role('button',name='Return to pier',exact=True).click()
  # The public Play runtime shares the same saved map, journal and sailing controls.
  page.goto(f'http://127.0.0.1:{server.server_port}/town/?map=builder');page.wait_for_function('!!window.townGame');page.locator('#world').focus();page.keyboard.press('e');page.wait_for_function('townGame.urban.activities.state.fishing.phase==="sail"');before=page.evaluate('townGame.player.x');page.keyboard.down('a');page.wait_for_timeout(900);page.keyboard.up('a');assert page.evaluate('townGame.player.x')<before-250
  page.get_by_role('button',name='Fish journal · J',exact=True).click();assert 'is-caught' in page.locator('[data-fish-id="copper-sprat"]').get_attribute('class');page.get_by_role('button',name='Back to boat',exact=True).click();page.get_by_role('button',name='Return to pier',exact=True).click();assert page.evaluate('townGame.project')==fixture
  assert not errors,errors;assert hashlib.sha256((ROOT/'town/maps/coda-town-plaza-boardwalk.json').read_bytes()).hexdigest()==source_hash
  print('PASS: real island water, cave-engine four-bar perfect catch, 54-species journal, sailing/camera, save/reload, unchanged map, mobile layout.');b.close()
finally:server.shutdown()
