"""Applied library deletions preserve real saved-map import, export and Play."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/review-3/retirements';OUT.mkdir(parents=True,exist_ok=True)
review=json.loads((ROOT/'town/asset-reviews/2026-11-14-upload-3.json').read_text())
retired=sorted({r['assetId'] for r in review['reviews'] if 'delete' in r.get('issues',[])})
fixture={'version':1,'name':'Retired asset compatibility','cells':{},'edges':{},
 'spawn':{'x':10000,'y':12000},'objects':[
 {'id':'saved-cottage','asset':'house-cottage-0','x':10000,'y':10000,'scale':1,'rotation':90,'layer':'objects','collision':True},
 {'id':'saved-estate','asset':'estate-bach','x':13500,'y':10800,'scale':.5,'rotation':270,'layer':'ground','collision':True}]}
protected={'musicArcadeV1':'{"sentinel":"keep arcade"}','codaNotesWalletV1':'{"notes":23}'}

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,source,target):
  try:super().copyfile(source,target)
  except (BrokenPipeError,ConnectionResetError):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
errors=[]
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
  context.add_init_script('const protectedValues='+json.dumps(protected)+';for(const[k,v]of Object.entries(protectedValues))if(localStorage.getItem(k)===null)localStorage.setItem(k,v);')
  page=context.new_page();page.set_default_timeout(120000);page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
  page.wait_for_function('!!window.townBuilder?.catalog && !document.getElementById("name").disabled')
  offered=page.locator('#library [data-asset]').evaluate_all('(items)=>items.map(e=>e.dataset.asset)')
  assert not set(retired).intersection(offered)
  assert page.evaluate('(ids)=>ids.every(id=>townBuilder.catalog.has(id))',retired)
  page.locator('#category').select_option('houses')
  assert page.locator('#library [data-asset]').evaluate_all('(items)=>items.map(e=>e.dataset.asset)')==['house-pavilion-1']
  paving=page.locator('#paving option').evaluate_all('(items)=>items.map(e=>e.value)')
  assert not set(retired).intersection(paving)
  page.locator('#file').set_input_files({'name':'legacy-town.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
  page.wait_for_function('townBuilder.project.name==="Retired asset compatibility" || /Invalid|could not|exceeds/i.test(document.getElementById("status").textContent)')
  assert page.evaluate('townBuilder.project.name')==fixture['name'],page.locator('#status').inner_text()
  assert page.evaluate('townBuilder.project.objects')==fixture['objects']
  page.evaluate('()=>{townBuilder.cam.x=10000;townBuilder.cam.y=10000;townBuilder.cam.zoom=.22;}')
  page.wait_for_function('townBuilder.project.objects.every(o=>townBuilder.catalog.get(o.asset)?.canvas?.width>0)')
  center=page.evaluate('''()=>{
   const cv=document.getElementById('map'),a=townBuilder.catalog.get('house-cottage-0');
   return {x:cv.clientWidth/2+a.h/2*.22,y:cv.clientHeight/2};
  }''')
  page.locator('#map').click(position=center)
  assert page.locator('#assetName').inner_text()==page.evaluate("townBuilder.catalog.get('house-cottage-0').name")
  assert page.locator('#duplicate').is_disabled()
  page.evaluate("document.getElementById('duplicate').onclick()")
  assert page.evaluate('townBuilder.project.objects')==fixture['objects']
  page.screenshot(path=str(OUT/'saved-retired-assets.png'))
  with page.expect_download() as pending:page.locator('#save').click()
  pending.value.save_as(OUT/'legacy-town-export.json')
  exported=json.loads((OUT/'legacy-town-export.json').read_text())
  assert exported['objects']==fixture['objects'] and exported['spawn']==fixture['spawn']
  page.locator('#play').click();page.wait_for_function('!!window.townGame')
  assert page.evaluate('townGame.project.objects')==fixture['objects']
  assert page.evaluate('(ids)=>ids.every(id=>townGame.catalog.has(id))',retired)
  assert page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',list(protected))==protected
  assert not errors,errors
  result={'passed':True,'retiredSelections':len(retired),'allProvidersRetained':True,'unmarkedSibling':'house-pavilion-1',
   'legacyImportExportAndPlayExact':True,'retiredDuplicationBlocked':True,'protectedProgressUnchanged':True,'errors':errors}
  (OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
  browser.close()
finally:server.shutdown()
