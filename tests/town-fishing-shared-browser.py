"""A real arcade guest and its Town Builder iframe share catches and idempotent rewards."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import json,math
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'work/town-sweep/shared';OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));context.route('https://**/*',lambda route:route.abort())
  old={'id':'existing-cave-catch','fishId':'silver-minnow','size':10,'at':1,'meter':'4/4','perfect':True,'caught':True,'rewarded':False,'result':{'id':'existing-cave-catch','fishId':'silver-minnow','rarity':'common','meter':'4/4','timeSignature':'4/4','hits':16,'misses':0,'extras':0,'perfect':True,'notes':4,'xp':8,'caught':True,'outcome':'caught'}}
  context.add_init_script('localStorage.setItem("codaArcadeFXV1","off");if(!localStorage.getItem("codaRhythmFishingV1"))localStorage.setItem("codaRhythmFishingV1",'+json.dumps(json.dumps({'version':1,'catches':[old]}))+');')
  page.goto(f'http://127.0.0.1:{server.server_port}/world-preview.html?guest=1');page.wait_for_function('window.CodaArcadeQA?.notes()&&CodaArcadeQA.classroomSession().canPlay');print('arcade ready',flush=True);wallet_before=page.evaluate('CodaArcadeQA.notes().balance');page.locator('#townBuilder').click();frame=page.frame_locator('iframe[title="Coda Town"]');frame.locator('#file').wait_for(state='attached');f=next(f for f in page.frames if '/town/builder/' in f.url);f.wait_for_function('!!window.townBuilder');frame.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'));f=next(f for f in page.frames if '/town/builder/' in f.url);f.wait_for_function('townBuilder.project.objects.length===137');frame.locator('#walk').click();page.wait_for_timeout(700);dock=f.evaluate('townBuilder.urban.activities.state.dock');fixture=f.evaluate('townBuilder.project');fixture['spawn']={k:dock['stand'][k] for k in ['x','y']};frame.locator('#walk').click();frame.locator('#file').set_input_files({'name':'shared-fishing-test.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_timeout(300);frame.locator('#walk').click();frame.locator('#map').focus();page.keyboard.press('e');f.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');print('boat ready',flush=True)
  frame.get_by_role('button',name='Fish journal · J',exact=True).click();assert frame.locator('.fishing-fish-card').count()==54;assert 'is-caught' in frame.locator('[data-fish-id="silver-minnow"]').get_attribute('class');frame.get_by_role('button',name='Back to boat',exact=True).click()
  page.clock.install();page.clock.pause_at(page.evaluate('Date.now()/1000')+1);frame.get_by_role('button',name='Cast · E',exact=True).click();f.wait_for_function('townBuilder.urban.activities.state.fishing.cave.phase==="rhythm"');state=lambda:f.evaluate('townBuilder.urban.activities.state.fishing.cave')
  def advance(target):
   current=state()['clock']
   if target>current:page.clock.run_for(max(1,math.floor((target-current)*1000)))
   for _ in range(30):
    if state()['clock']>=target-.000001:return
    page.clock.run_for(1)
  for _ in range(100):
   s=state()
   if s['phase']!='rhythm':break
   note=next((n for n in s['challenge']['notes'] if n['judgement']=='pending'),None);advance(note['time'] if note else s['clock']+.2)
   if state()['phase']!='rhythm':break
   if note:
    frame.locator('#fishingRhythmCanvas').focus();page.keyboard.down('Space')
    if note['requiresHold']:advance(note['holdEndTime'])
    page.keyboard.up('Space')
  s=state();assert s['phase']=='caught' and s['result']['perfect'],s['result']
  for _ in range(30):
   page.clock.run_for(32);page.wait_for_timeout(20)
   if state()['pendingCatch']['rewarded']:break
  assert state()['pendingCatch']['rewarded'],state()['journalError'];wallet_after=page.evaluate('CodaArcadeQA.notes().balance');assert wallet_after==wallet_before+8,(wallet_before,wallet_after)
  collection=page.evaluate('CodaArcadeQA.fishing().collection');assert collection['counts']['silver-minnow']==1;assert collection['counts']['copper-sprat']==1;assert collection['unique']==2
  frame.get_by_role('button',name='See fish collection',exact=True).click();page.screenshot(path=str(OUT/'cave-and-coast-journal.png'));assert 'is-caught' in frame.locator('[data-fish-id="silver-minnow"]').get_attribute('class');assert 'is-caught' in frame.locator('[data-fish-id="copper-sprat"]').get_attribute('class');page.clock.resume()
  # Opening and reading the collection never re-pays an already saved catch.
  frame.get_by_role('button',name='Back to boat',exact=True).click();frame.get_by_role('button',name='Fish journal · J',exact=True).click();assert page.evaluate('CodaArcadeQA.notes().balance')==wallet_after
  f.evaluate('parent.postMessage({type:"coda-town-close"},location.origin)');page.wait_for_timeout(200);assert page.locator('iframe[title="Coda Town"]').count()==0;page.reload();page.wait_for_function('!!window.CodaArcadeQA?.fishing()');collection=page.evaluate('CodaArcadeQA.fishing().collection');assert collection['counts']['silver-minnow']==1 and collection['counts']['copper-sprat']==1
  assert not errors,errors;print('PASS: actual arcade parent/iframe journal, old cave catch retained, new coastal catch saved, +8 Notes once, reload retains both.');b.close()
finally:server.shutdown()
