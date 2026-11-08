"""Inside fillets share clipped artwork, physical boundaries and saved projects."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start()
d={'version':1,'name':'Inside corner shapes','spawn':{'x':8520,'y':6500},'cells':{},'edges':{},'objects':[]}
for y in range(84,109):
 for x in range(116,141):
  if not (x>=128 and y>=96):d['cells'][f'{x},{y}']={'surface':'grass','level':3}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1600,'height':1050});errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  module=page.evaluate('''async()=>{const app=document.querySelector('script[type="module"]').src,s=await(await fetch(app)).text(),dep=n=>new URL(s.split(String.fromCharCode(10)).find(l=>l.includes(n+'.mjs')).split("'")[1],app).href;return {runtime:dep('runtime'),round:dep('round-terrain'),geometry:new URL('../world/round-geometry.mjs'+new URL(app).search,app).href};}''')
  page.locator('#file').set_input_files({'name':'inside.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Inside corner shapes"')
  page.locator('#heightView').select_option('plan');page.locator('#brush').fill('3');page.locator('[data-tool="round"]').click()
  box=page.locator('#map').bounding_box();x=box['x']+box['width']/2+32*.45;y=box['y']+box['height']/2+32*.45
  capture='''async({url,game=false,plan=false})=>{const{render}=await import(url),c=document.createElement('canvas');c.width=520;c.height=420;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,game?townGame.project:townBuilder.project,{x:8320,y:6210,zoom:1.1},520,420,plan?{heightView:'plan'}:{});return c.toDataURL();}'''
  samples=[]
  for i,(style,label) in enumerate([('smooth','Smooth inside corner'),('rocky','Rocky inside corner'),('bevel','Beveled inside corner')]):
   if i:page.locator('[data-tool="round"]').click()
   page.mouse.click(x,y)
   assert page.evaluate('(style)=>Object.values(townBuilder.project.cells).some(a=>a.curves?.some(q=>q.concave&&q.style===style))',style)
   samples.append({'label':label,'url':page.evaluate(capture,{'url':module['runtime']})})
  assert len(set(s['url'] for s in samples))==3
  page.locator('#undo').click();assert page.evaluate(capture,{'url':module['runtime']})==samples[1]['url']
  page.locator('#redo').click();assert page.evaluate(capture,{'url':module['runtime']})==samples[2]['url']
  page.locator('[data-tool="round"]').click();page.mouse.click(x,y);assert page.evaluate(capture,{'url':module['runtime']})==samples[0]['url']
  samples.append({'label':'Elevation plan · same fillet','url':page.evaluate(capture,{'url':module['runtime'],'plan':True})})
  additional=page.evaluate('''async({runtime,round,geometry})=>{
   const{render}=await import(runtime),{roundTerrain}=await import(round),{clipCurves,insideCurve,curveBounds}=await import(geometry),samples=[],checks=[];
   for(const corner of ['nw','ne','sw','se'])for(const style of ['smooth','rocky','bevel']){
    const q={corner,cx:256,cy:256,r:192,kind:'height',concave:true,style},b=curveBounds(q),c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');g.translate(-b.x0,-b.y0);g.fillStyle='white';
    for(let y=b.y0/64;y<b.y1/64;y++)for(let x=b.x0/64;x<b.x1/64;x++){g.save();clipCurves(g,{curves:[q]},x,y,0);g.fillRect(x*64,y*64,64,64);g.restore();}
    const data=g.getImageData(0,0,192,192).data;let bad=0;
    for(let py=3;py<190;py+=8)for(let px=3;px<190;px+=8){const wx=b.x0+px+.5,wy=b.y0+py+.5,expected=insideCurve(q,wx,wy),alpha=data[(py*192+px)*4+3];if((alpha<=16||alpha>=239)&&(alpha>=128)!==expected)bad++;}
    checks.push({corner,style,bad});
   }
   for(const surface of ['water','cobble']){
    const d={version:1,name:surface,spawn:{x:8520,y:6500},cells:{},edges:{},objects:[]};
    for(let y=84;y<109;y++)for(let x=116;x<141;x++)if(!(x>=128&&y>=96))d.cells[`${x},${y}`]={surface,level:0};
    Object.assign(d.cells,Object.fromEntries(roundTerrain(d,{x:8224,y:6176},3,'smooth').edits));const c=document.createElement('canvas');c.width=520;c.height=420;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,d,{x:8320,y:6210,zoom:1.1},520,420);samples.push({label:surface==='water'?'Inside shoreline':'Inside paved path',url:c.toDataURL()});
   }
   return {samples,checks};
  }''',module)
  assert all(check['bad']==0 for check in additional['checks']),additional['checks']
  samples.extend(additional['samples'])
  page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")');page.reload();page.wait_for_function('window.townBuilder?.project.name==="Inside corner shapes"')
  assert page.evaluate(capture,{'url':module['runtime']})==samples[0]['url']
  page.locator('#play').click();page.wait_for_function('!!window.townGame');assert page.evaluate(capture,{'url':module['runtime'],'game':True})==samples[0]['url']
  page.evaluate('''samples=>{document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const gallery=document.createElement('div');gallery.id='insideGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,520px);gap:12px;background:#20382b;padding:12px;width:1608px;color:#f5e3ba;font:20px Georgia';for(const s of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=s.url;img.width=520;img.height=420;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(s.label),img);gallery.append(tile);}document.body.append(gallery);}''',samples)
  page.locator('#insideGallery').screenshot(path=str(ROOT/'docs/town-preview/inside-corners.png'));assert not errors,errors;browser.close()
finally:server.shutdown()
print('Inside corner styles, clip/collision geometry, undo/redo, reload, water/path fillets and editor/game parity passed.')
