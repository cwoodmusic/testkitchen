"""Cliff anchoring, lazy native art, game parity and the full 256-piece pack."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import threading,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
d={'version':1,'name':'Cliff decoration workshop','spawn':{'x':8192,'y':6800},'cells':{f'{x},{y}':{'surface':'grass','level':4} for x in range(116,140) for y in range(91,101)},'edges':{},'objects':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1050});errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
 page.goto(base+'/town/builder/');page.wait_for_function('!!window.townBuilder')
 assert page.evaluate('[...townBuilder.catalog.values()].filter(a=>a.pack==="town-decor-256").length')==256
 assert not [u for u in requests if '/decor/pack-' in u and u.endswith('.png')]
 page.locator('#file').set_input_files({'name':'cliff.json','mimeType':'application/json','buffer':json.dumps(d).encode()});page.wait_for_function('townBuilder.project.name==="Cliff decoration workshop"');page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6368,zoom:.7})')
 box=page.locator('#map').bounding_box();cx=box['x']+box['width']/2;cy=box['y']+box['height']/2
 def at(x,y):return (cx+(x-8192)*.7,cy+(y-6368)*.7)
 page.locator('#cliffMount').click();page.locator('[data-asset="cliff-lantern"]').click();page.mouse.click(*at(8224,6368))
 assert page.evaluate('townBuilder.project.objects[0].mount.y')==100
 page.locator('#mountHeight').evaluate("e=>{e.value=75;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'));}")
 assert page.evaluate('townBuilder.project.objects[0].mount.v')==.75
 before=page.evaluate('''async()=>{const{mountPose}=await import('/town/world/cliff-mount.mjs');return mountPose(townBuilder.project,townBuilder.project.objects[0]).y;}''')
 page.locator('#brush').fill('1');page.locator('[data-tool="raise"]').click();page.mouse.click(*at(8224,6224))
 after=page.evaluate('''async()=>{const{mountPose}=await import('/town/world/cliff-mount.mjs');return mountPose(townBuilder.project,townBuilder.project.objects[0]).y;}''');assert abs(after-before+36)<.01,(before,after)
 page.locator('[data-asset="cliff-ivy"]').click();page.mouse.click(*at(7900,6330))
 page.locator('[data-asset="cliff-roots"]').click();page.mouse.click(*at(8550,6325))
 for group,asset,x in [('containers','decor-01-01',7850),('containers','decor-01-09',7980),('strings','decor-02-01',8150),('strings','decor-02-03',8300),('strings','decor-02-05',8450)]:
  page.locator('#category').select_option(group);page.locator(f'[data-asset="{asset}"]').click();page.wait_for_function('document.querySelector("#status").textContent.startsWith("Ready to place")');page.mouse.click(*at(x,6700))
 assert len(set(u for u in requests if '/decor/pack-' in u and u.endswith('.png')))==2
 page.locator('[data-tool="select"]').click();page.mouse.move(50,50);page.screenshot(path=str(ROOT/'docs/town-preview/cliff-decorations.png'))
 page.locator('#mountSurface').select_option('cliff');page.mouse.click(*at(8400,6320));assert page.evaluate('townBuilder.project.objects.filter(o=>o.mount).length')==4
 page.locator('#undo').click();assert page.evaluate('townBuilder.project.objects.filter(o=>o.mount).length')==3
 page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")');count=page.evaluate('townBuilder.project.objects.length');page.reload();page.wait_for_function(f'window.townBuilder?.project.objects.length==={count}');assert page.evaluate('townBuilder.project.objects.filter(o=>o.mount).length')==3
 snapshot='''async()=>{const{render}=await import('/town/world/runtime.mjs?v=cliff-pack-1');const d=window.townBuilder?.project||townGame.project,c=document.createElement('canvas');c.width=800;c.height=600;render(c.getContext('2d'),d,{x:8192,y:6400,zoom:.6},800,600);return c.toDataURL();}'''
 editor=page.evaluate(snapshot);page.locator('#play').click();page.wait_for_function('!!window.townGame');assert page.evaluate(snapshot)==editor
 page.get_by_role('button',name='Edit town',exact=True).click();page.wait_for_function('!!window.townBuilder')
 # Full-resolution gallery is an explicit review operation, separate from startup.
 page.evaluate('''async()=>{const{preparePlacedArt}=await import('/town/world/catalog.mjs?v=cliff-pack-1');await preparePlacedArt({objects:[...townBuilder.catalog.values()].filter(a=>a.pack).map(a=>({asset:a.id}))});const grid=document.createElement('div');grid.id='decorGallery';grid.style.cssText='position:absolute;left:0;top:0;width:1600px;display:grid;grid-template-columns:repeat(8,200px);background:#20372b;z-index:9999';for(const a of townBuilder.catalog.values()){if(!a.pack)continue;const tile=document.createElement('div');tile.style.cssText='height:170px;padding:8px;color:#f0dfb5;text-align:center;font:12px system-ui';const c=document.createElement('canvas');c.width=184;c.height=134;const g=c.getContext('2d'),s=Math.min(174/a.w,124/a.h);g.translate((184-a.w*s)/2,(134-a.h*s)/2);g.scale(s,s);a.draw(g);tile.append(c,document.createTextNode(a.name));grid.append(tile);}document.body.append(grid);}''')
 page.locator('#decorGallery').screenshot(path=str(ROOT/'docs/town-preview/decor-256-library.png'))
 page.evaluate("const g=document.querySelector('#decorGallery');g.style.width='1024px';g.style.gridTemplateColumns='repeat(16,64px)';for(const t of g.children){t.style.height='80px';t.style.padding='2px';t.style.fontSize='6px';const c=t.querySelector('canvas');c.style.width='60px';c.style.height='50px';}")
 page.locator('#decorGallery').screenshot(path='/tmp/coda-decor-review.png')
 assert not errors,errors;b.close()
server.shutdown();print('Cliff attachment, height changes, lazy art, 256 assets, save/reload and editor/game pixel parity passed.')
