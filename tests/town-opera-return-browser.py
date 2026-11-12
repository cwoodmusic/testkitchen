"""Reproduce concert -> watch -> exit and far zoom -> walking zoom on the saved town.
Only a temporary imported copy gets a door-side spawn; source maps stay untouched.
"""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from threading import Thread
from playwright.sync_api import sync_playwright
import argparse,json,statistics,math,hashlib
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--screenshots',type=Path,default=Path('/tmp/town-opera-return'));args=p.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'town/maps/coda-town-plaza-boardwalk.json';original=SOURCE.read_bytes();source_hash=hashlib.sha256(original).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,s,o):
  try:super().copyfile(s,o)
  except (BrokenPipeError,ConnectionResetError):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
INSTRUMENT='''(()=>{const raf=window.requestAnimationFrame.bind(window);let active=false,frames=[],draws=0;window.__returnPerf={start(){active=true;frames=[];},stop(){active=false;return frames;}};window.requestAnimationFrame=fn=>raf(now=>{if(!active||fn.name!=='frame')return fn(now);const start=performance.now();draws=0;try{return fn(now);}finally{frames.push({at:now,cpu:performance.now()-start,draws});}});for(const proto of [CanvasRenderingContext2D.prototype,OffscreenCanvasRenderingContext2D.prototype]){const draw=proto.drawImage;proto.drawImage=function(...args){if(active)draws++;return draw.apply(this,args);};}})()'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1920,'height':1080});context.add_init_script(INSTRUMENT);page=context.new_page();page.set_default_timeout(45000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  fixture=json.loads(original);opera=next(o for o in fixture['objects'] if o['asset']=='sydney-opera-house');door=page.evaluate("(()=>{const a=townBuilder.catalog.get('sydney-opera-house');return {w:a.w,h:a.h,door:a.door};})()")
  fixture['spawn']={'x':opera['x']-door['w']/2+door['door']['x'],'y':opera['y']-door['h']+door['door']['y']+120}
  page.locator('#file').set_input_files({'name':'return-regression.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_function('townBuilder.project.objects.length===137');page.locator('#walk').click();page.locator('#map').focus()
  reports=[]
  def sample(name):
   page.wait_for_timeout(1600);page.evaluate('__returnPerf.start()');page.wait_for_timeout(2500);frames=page.evaluate('__returnPerf.stop()');assert len(frames)>4,name
   cpu=sorted(f['cpu'] for f in frames);report={'name':name,'fps':round((len(frames)-1)*1000/(frames[-1]['at']-frames[0]['at']),1),'cpuMedian':round(statistics.median(cpu),2),'cpuP95':round(cpu[int(len(cpu)*.95)],2),'drawMedian':statistics.median(f['draws'] for f in frames)};reports.append(report);print(json.dumps(report),flush=True);return report
  baseline=sample('outside-before')
  for cycle in range(3):
   page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='sydney-opera-house'))");page.wait_for_function("townBuilder.urban.scene?.kind==='concert'");page.evaluate("townBuilder.urban.watchSeat('seat-1-14')");page.wait_for_function('!!townBuilder.urban.seated');page.wait_for_timeout(500)
   if cycle==0:
    page.screenshot(path=str(args.screenshots/'floor-seated.png'));page.mouse.move(1000,500);page.mouse.wheel(0,300);page.wait_for_timeout(300);page.screenshot(path=str(args.screenshots/'floor-intermediate-zoom.png'))
   page.get_by_role('button',name='Go outside',exact=True).click();page.wait_for_function('!townBuilder.urban.active');after=sample('outside-after-watch-'+str(cycle));assert after['fps']>=baseline['fps']*.75,after
   assert after['cpuP95']<=max(45,baseline['cpuP95']*2),'Concert exit accumulated expensive frame work'
  delta=math.log(.8/.065)*1000
  for cycle in range(2):
   page.mouse.move(1000,500);page.mouse.wheel(0,delta);page.wait_for_function('townBuilder.cam.zoom<.07');wide=sample('zoom-out-'+str(cycle));assert wide['drawMedian']<1000,'Distant lakes redraw thousands of terrain details';assert wide['cpuMedian']<60,'Overview still consumes the animation thread'
   page.mouse.wheel(0,-delta);page.wait_for_function('townBuilder.cam.zoom>.79');close=sample('zoom-back-'+str(cycle));assert close['fps']>=baseline['fps']*.75,'Zooming back failed to recover walking performance'
  page.locator('#walk').click();assert page.evaluate('townBuilder.project')==fixture,'Rendering modified saved map data';assert SOURCE.read_bytes()==original;assert not errors,errors
  (args.screenshots/'results.json').write_text(json.dumps({'reports':reports,'sourceHash':source_hash,'mapUnchanged':True,'pageErrors':errors},indent=2));browser.close()
finally:server.shutdown()
