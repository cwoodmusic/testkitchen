"""Verify an authored map survives the editor-to-game handoff without art changes."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading,json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
fixture={'version':1,'name':'Shared engine test','spawn':{'x':8192,'y':6144},'cells':{},'edges':{},'objects':[]}
for x in range(120,125):
 for y in range(92,97):fixture['cells'][f'{x},{y}']={'surface':'cobble','level':2}
for x in range(129,134):
 for y in range(95,100):fixture['cells'][f'{x},{y}']={'surface':'water','level':0}
for x in range(129,134):fixture['cells'][f'{x},97']['bridge']='ew'
fixture['cells']['124,97']={'surface':'cobble','level':1,'stairs':'north','finish':'stone'}
for x in range(125,129):fixture['edges'][f'h:{x}:100']={'style':'limestone','gate':False,'open':False}
fixture['edges']['v:128:99']={'style':'iron','gate':True,'open':False}
for i,(asset,x,y,layer) in enumerate([('trees-0-480',8650,6150,'objects'),('props-4-960',7400,6700,'objects'),('ivy-0',8110,6400,'overgrowth'),('music-square',9500,7600,'ground')]):fixture['objects'].append({'id':str(i),'asset':asset,'x':x,'y':y,'scale':1,'rotation':0,'layer':layer,'collision':asset!='ivy-0'})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1500,'height':950});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/town/builder/');page.wait_for_function('!!window.townBuilder')
 page.locator('#file').set_input_files({'name':'map.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
 page.wait_for_function('townBuilder.project.name==="Shared engine test"')
 # Compare actual terrain/objects with matched viewport/camera. No editor guides
 # or animated actor: those are deliberately not part of the static scene.
 snapshot='''async () => {const {render,resizeSurface}=await import('/town/world/runtime.mjs');const d=window.townBuilder?.project||window.townGame.project;const c=document.createElement('canvas');c.style.cssText='width:800px;height:600px;position:absolute;left:-10000px';document.body.append(c);const {ctx,width,height}=resizeSurface(c);render(ctx,d,{x:8192,y:6250,zoom:.8},width,height);const result=c.toDataURL();c.remove();return result;}'''
 before=page.evaluate(snapshot)
 page.locator('#play').click();page.wait_for_url('**/town/?map=builder');page.wait_for_function('!!window.townGame')
 assert page.evaluate('JSON.stringify(townGame.project)')==json.dumps(fixture,separators=(',',':'))
 after=page.evaluate(snapshot);assert before==after,'Editor and playable scene pixels differ'
 assert page.locator('#world').evaluate('(c)=>c.width===Math.ceil(c.clientWidth/2)')
 x=page.evaluate('townGame.player.x');page.keyboard.down('d');page.wait_for_timeout(200);page.keyboard.up('d');assert page.evaluate('townGame.player.x')>x
 page.screenshot(path=str(ROOT/'docs/town-preview/builder-play.png'))
 page.get_by_role('button',name='Edit town',exact=True).click();page.wait_for_function('window.townBuilder?.project.name==="Shared engine test"')
 assert page.evaluate('townBuilder.project.objects.length')==4
 assert not errors,errors
 browser.close()
server.shutdown();print('Shared engine checks passed: saved map playable, exact static scene pixel parity, matching pixel scale, movement, and return to editing.')
