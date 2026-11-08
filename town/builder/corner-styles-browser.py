"""Click-through corner styles change shared art, physical edges and saved maps."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
d={'version':1,'name':'Corner styles','spawn':{'x':8192,'y':7300},'cells':{f'{x},{y}':{'surface':'grass','level':3} for x in range(117,129) for y in range(94,106)},'edges':{},'objects':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files({'name':'styles.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Corner styles"');page.locator('#heightView').select_option('plan');page.locator('[data-tool="round"]').click()
 box=page.locator('#map').bounding_box();x=box['x']+box['width']/2+(117.5*64-8192)*.45;y=box['y']+box['height']/2+(105.5*64-6144)*.45
 capture='''async()=>{const{render}=await import('/town/world/runtime.mjs?v=stair-depth-1');const c=document.createElement('canvas');c.width=240;c.height=180;const g=c.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;render(g,townBuilder.project,{x:7660,y:6590,zoom:.9},480,360);return c.toDataURL();}'''
 samples=[]
 for i,(style,label) in enumerate([('smooth','Smooth round'),('rocky','Rocky irregular'),('bevel','Beveled')]):
  if i==1:page.locator('[data-tool="round"]').click()
  if i==2:page.locator('#cornerStyle').click()
  assert label in page.locator('#cornerStyle').inner_text()
  page.mouse.click(x,y)
  assert page.evaluate('(style)=>Object.values(townBuilder.project.cells).some(c=>c.curves?.some(q=>(q.style||"smooth")===style))',style)
  samples.append({'label':label,'url':page.evaluate(capture)})
 assert len(set(s['url'] for s in samples))==3
 page.locator('#cornerStyle').click();page.mouse.click(x,y);assert page.evaluate(capture)==samples[0]['url']
 page.locator('#undo').click();assert page.evaluate(capture)==samples[2]['url'];page.locator('#redo').click();assert page.evaluate(capture)==samples[0]['url']
 page.locator('#cornerStyle').click();page.mouse.click(x,y);page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")');page.reload();page.wait_for_function('window.townBuilder?.project.name==="Corner styles"');assert page.evaluate(capture)==samples[1]['url']
 before=page.evaluate(capture);page.locator('#play').click();page.wait_for_function('!!window.townGame');game=page.evaluate(capture.replace('townBuilder.project','townGame.project'));assert before==game
 page.evaluate('''samples=>{document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const gallery=document.createElement('div');gallery.id='cornerGallery';gallery.style.cssText='display:flex;gap:12px;background:#20382b;padding:12px;width:1500px;color:#f5e3ba;font:20px Georgia';for(const s of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=s.url;img.width=480;img.height=360;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(s.label),img);gallery.append(tile);}document.body.append(gallery);}''',samples)
 page.locator('#cornerGallery').screenshot(path=str(ROOT/'docs/town-preview/corner-styles.png'))
 assert not errors,errors;b.close()
server.shutdown();print('Corner cycling, repeat brush restyling, reversible geometry, undo/redo, reload and editor/game parity passed.')
