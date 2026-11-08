from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
d={'version':1,'name':'Drag stair connection','spawn':{'x':7968,'y':6432},'cells':{},'edges':{},'objects':[]}
for x in range(128,141):
 for y in range(93,106):d['cells'][f'{x},{y}']={'surface':'grass','level':3}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files({'name':'hill.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Drag stair connection"')
 page.locator('#heightView').select_option('plan');page.locator('[data-tool="steps"]').click();box=page.locator('#map').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
 def point(x,y):return (cx+(x*64-8192)*.45,cy+(y*64-6144)*.45)
 sx,sy=point(124.5,100.5);ex,ey=point(133.5,100.5)
 page.mouse.move(sx,sy);page.mouse.down();page.mouse.move(ex,ey,steps=12)
 assert page.evaluate('Object.values(townBuilder.project.cells).filter(c=>c.stairs).length')==0
 page.mouse.up();assert page.evaluate('Object.values(townBuilder.project.cells).filter(c=>c.stairs).length')==30
 forward=page.evaluate('JSON.stringify(townBuilder.project.cells)');page.locator('#undo').click();assert page.evaluate('Object.values(townBuilder.project.cells).filter(c=>c.stairs).length')==0
 page.mouse.move(ex,ey);page.mouse.down();page.mouse.move(sx,sy,steps=12);page.mouse.up();assert page.evaluate('JSON.stringify(townBuilder.project.cells)')==forward
 page.locator('#heightView').select_option('art');page.mouse.move(50,50);page.screenshot(path=str(ROOT/'docs/town-preview/drag-stairs.png'))
 page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")');page.reload();page.wait_for_function('window.townBuilder?.project.cells["124,100"]?.stairRise!==undefined')
 # Actual paving-to-scene join and exact arcade rendering.
 d['name']='Matching paving';d['cells']={f'{x},{y}':{'surface':'cobble','level':0,'paving':'auto'} for x in range(126,130) for y in range(112,120)};d['objects']=[{'id':'square','asset':'music-square','x':8192,'y':7168,'scale':1,'rotation':0,'collision':True,'layer':'ground'}]
 page.locator('#file').set_input_files({'name':'paving.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Matching paving"');page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:7050,zoom:.6})');page.wait_for_timeout(150)
 assert page.evaluate('''async()=>{const {resolvePaving}=await import('/town/world/paving.mjs');return resolvePaving(townBuilder.project,8192,7200).asset.id==='music-square';}''')
 page.screenshot(path=str(ROOT/'docs/town-preview/matched-paving.png'))
 d['objects'][0]['asset']='estate-player';d['name']='Matching home paving';page.locator('#file').set_input_files({'name':'home-paving.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Matching home paving"');page.wait_for_timeout(100)
 assert page.evaluate('''async()=>{const {resolvePaving}=await import('/town/world/paving.mjs');return resolvePaving(townBuilder.project,8192,7200).asset.id==='estate-player';}''')
 page.screenshot(path=str(ROOT/'docs/town-preview/matched-home-paving.png'))
 d['name']='Coda Arcade · exact footprint';d['cells']={};d['objects']=[{'id':'arcade','asset':'coda-arcade','x':8192,'y':7168,'scale':1,'rotation':0,'collision':True,'layer':'objects'}]
 page.locator('#file').set_input_files({'name':'arcade.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Coda Arcade · exact footprint"');page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6600,zoom:.6})');page.locator('#category').select_option('landmarks');page.wait_for_timeout(150)
 assert page.evaluate('townBuilder.catalog.get("coda-arcade").polygons.length')==9
 assert page.evaluate('''async()=>{const {blocked}=await import('/town/world/model.mjs');const a=townBuilder.catalog.get('coda-arcade'),o=townBuilder.project.objects[0],f=window.CodaArcadeFootprint;if(a.w!==f.width||a.h!==f.height+100||!a.fixedScale)return false;for(let y=0;y<f.height;y+=17)for(let x=0;x<f.width;x+=17){if(blocked(townBuilder.project,o.x-a.w/2+x,o.y-a.h+100+y,townBuilder.catalog)!==f.contains(x,y))return false;}return true;}''')
 page.screenshot(path=str(ROOT/'docs/town-preview/arcade-exterior.png'))
 page.locator('[data-asset="coda-arcade"]').click();assert page.locator('#scale').is_disabled();assert page.locator('#scale').input_value()=='1'
 assert not errors,errors;b.close()
server.shutdown();print('Drag stairs, reverse drag, undo, saved profiles, matching paving and arcade rendering passed.')
