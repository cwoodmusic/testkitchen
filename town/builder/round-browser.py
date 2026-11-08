from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
d={'version':1,'name':'Rounded landscape','spawn':{'x':8192,'y':7200},'cells':{},'edges':{},'objects':[]}
for x in range(117,127):
 for y in range(95,105):d['cells'][f'{x},{y}']={'surface':'grass','level':3}
for x in range(129,139):
 for y in range(96,103):d['cells'][f'{x},{y}']={'surface':'water','level':0}
for x in range(117,137):
 for y in range(108,111):d['cells'][f'{x},{y}']={'surface':'cobble','level':0}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files({'name':'land.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Rounded landscape"');page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6430,zoom:.6})');page.locator('[data-tool="round"]').click()
 box=page.locator('#map').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
 def at(x,y,z=0):return (cx+(x*64-8192)*.6,cy+(y*64-z-6430)*.6)
 page.mouse.click(*at(117.5,104.5,144));assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.curves?.length)')
 page.locator('#undo').click();assert not page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.curves?.length)')
 page.locator('#redo').click();assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.curves?.length)')
 for x,y,z in [(126.5,104.5,144),(129.5,96.5,0),(138.5,96.5,0),(129.5,102.5,0),(138.5,102.5,0),(117.5,108.5,0),(117.5,110.5,0)]:page.mouse.click(*at(x,y,z))
 page.mouse.move(50,50);page.screenshot(path=str(ROOT/'docs/town-preview/rounded-terrain.png'))
 page.locator('#heightView').select_option('plan');page.screenshot(path=str(ROOT/'docs/town-preview/rounded-elevation-plan.png'))
 page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")');page.reload();page.wait_for_function('window.townBuilder?.project.name==="Rounded landscape"');assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.curves?.length)')
 snapshot='''async()=>{const{render}=await import('/town/world/runtime.mjs?v=cliff-pack-2');const c=document.createElement('canvas');c.width=800;c.height=600;render(c.getContext('2d'),window.townBuilder?.project||townGame.project,{x:8192,y:6430,zoom:.6},800,600);return c.toDataURL();}'''
 image=page.evaluate(snapshot);page.locator('#play').click();page.wait_for_function('!!window.townGame');assert image==page.evaluate(snapshot)
 assert not errors,errors;b.close()
server.shutdown();print('Rounded land, water and paving, undo/redo, saved geometry and editor/game pixel parity passed.')
