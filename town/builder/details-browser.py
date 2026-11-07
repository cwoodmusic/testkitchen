"""Actual rendered art review and functional elevation/large-selection checks."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
d={'version':1,'name':'Terrace workshop','spawn':{'x':8192,'y':6528},'cells':{},'edges':{},'objects':[]}
for x in range(114,134):
 for y in range(89,100):d['cells'][f'{x},{y}']={'surface':'grass','level':3}
for x in range(117,132):
 for y in range(100,104):d['cells'][f'{x},{y}']={'surface':'grass','level':2}
for x in range(119,130):
 for y in range(104,108):d['cells'][f'{x},{y}']={'surface':'grass','level':1}
for y,level in [(100,2),(104,1),(108,0)]:
 for x in range(123,128):d['cells'][f'{x},{y}']={'surface':'cobble','level':level,'stairs':'north','finish':'stone'}
for x in range(118,131):d['edges'][f'h:{x}:94']={'style':'limestone','gate':False,'open':False}
for y in range(94,99):d['edges'][f'v:118:{y}']={'style':'limestone','gate':False,'open':False}
for x in range(130,139):d['edges'][f'h:{x}:107']={'style':'wood','gate':False,'open':False}
for i,asset in enumerate(['ivy-0','ivy-1','ivy-2']):d['objects'].append({'id':str(i),'asset':asset,'x':(121+i*3)*64,'y':94*64,'scale':1,'rotation':0,'collision':False,'layer':'overgrowth'})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
 assert page.evaluate('[...townBuilder.catalog.keys()].filter(k=>k.startsWith("estate-")).length')==19
 page.locator('#file').set_input_files({'name':'terraces.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Terrace workshop"')
 page.evaluate('Object.assign(townBuilder.cam,{x:8064,y:6200,zoom:.65})');page.wait_for_timeout(250)
 page.screenshot(path=str(ROOT/'docs/town-preview/terraces-detail.png'))
 page.locator('#heightView').select_option('plan');assert page.locator('#heightLegend').is_visible()
 page.locator('#selectLand').click();box=page.locator('#map').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 page.mouse.move(x-150,y-100);page.mouse.down();page.mouse.move(x+150,y+100,steps=10);page.mouse.up();assert page.evaluate('townBuilder.region!==null')
 page.locator('#raiseRegion').click();page.locator('#undo').click()
 page.screenshot(path=str(ROOT/'docs/town-preview/elevation-plan.png'))
 page.locator('#selectAllLand').click();assert page.evaluate('(townBuilder.region.x1+1)*(townBuilder.region.y1+1)')==49152
 page.locator('#lowerRegion').click();assert page.evaluate('Math.max(...Object.values(townBuilder.project.cells).map(c=>c.level))')==2
 page.locator('#undo').click();assert page.evaluate('Math.max(...Object.values(townBuilder.project.cells).map(c=>c.level))')==3
 page.locator('#clearRegion').click();page.locator('#heightView').select_option('art')
 # Check complete property assets in actual shared renderer, not concept images.
 d['name']='Your library garden';d['cells']={};d['edges']={};d['objects']=[{'id':'home','asset':'estate-player','x':8192,'y':7168,'scale':1,'rotation':0,'collision':True,'layer':'ground'}]
 page.locator('#file').set_input_files({'name':'home.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Your library garden"')
 page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.4})');page.locator('#category').select_option('home estates');page.wait_for_timeout(300)
 page.screenshot(path=str(ROOT/'docs/town-preview/home-estate.png'))
 # Authored parcel collision keeps the yard open and the house solid.
 assert page.evaluate('''async()=>{const {blocked}=await import('/town/world/model.mjs');const d=townBuilder.project,c=townBuilder.catalog;return !blocked(d,8192,7000,c)&&blocked(d,8192,5900,c);}''')
 # Render the complete library as an actual browser asset sheet for review.
 page.evaluate('''()=>{const grid=document.createElement('div');grid.id='estateGallery';grid.style.cssText='position:absolute;left:0;top:0;width:1600px;display:grid;grid-template-columns:repeat(4,400px);background:#20382b;z-index:9999';for(const a of townBuilder.catalog.values()){if(!a.id.startsWith('estate-'))continue;const tile=document.createElement('div');tile.style.cssText='padding:12px;color:#f1dfb9;text-align:center;font:16px Georgia';const c=document.createElement('canvas');c.width=c.height=376;const g=c.getContext('2d');g.scale(376/a.w,376/a.h);a.draw(g);tile.append(c,document.createTextNode(a.name));grid.append(tile);}document.body.append(grid);}''')
 page.locator('#estateGallery').screenshot(path=str(ROOT/'docs/town-preview/home-estates-library.png'))
 page.evaluate("const g=document.querySelector('#estateGallery');g.style.width='800px';g.style.gridTemplateColumns='repeat(4,200px)';for(const c of g.querySelectorAll('canvas')){c.style.width='176px';c.style.height='176px';}")
 page.locator('#estateGallery').screenshot(path='/tmp/coda-estate-review.png')
 assert not errors,errors;b.close()
server.shutdown();print('Detail checks passed: 19 estates, connected art, elevation plan, region and whole-map heights, undo, and parcel collision.')
