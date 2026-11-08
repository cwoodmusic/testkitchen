"""Freeform land selection edits and highlights its actual terrain mask."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1600, 'height':1050})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        doc={'version':1,'name':'Freeform terrace selection','cells':{},'edges':{},'objects':[],'spawn':{'x':8192,'y':6400}}
        page.locator('#file').set_input_files({'name':'lasso.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
        page.wait_for_function('townBuilder.project.name==="Freeform terrace selection"')
        page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')
        page.locator('#heightView').select_option('plan')
        page.locator('[data-tool="region"]').click()
        page.locator('#selectionShape').select_option('freeform')

        def point(x, y):
            box=page.locator('#map').bounding_box()
            return box['x']+box['width']/2+(x*64-8192)*.7,box['y']+box['height']/2+(y*64-6144)*.7

        path=[(123,94),(130,94),(130,96),(126,96),(126,102),(123,102),(123,94)]
        original=page.evaluate('JSON.stringify(townBuilder.project)')
        page.mouse.move(*point(*path[0]));page.mouse.down()
        for x,y in path[1:-1]:page.mouse.move(*point(x,y),steps=4)
        assert page.evaluate('townBuilder.region.preview&&townBuilder.region.outline.length>4')
        assert page.locator('#raiseRegion').is_disabled()
        page.mouse.move(*point(*path[-1]),steps=4);page.mouse.up()
        assert page.evaluate('townBuilder.region.cells.length')==32
        assert '32 tiles selected' in page.locator('#regionInfo').inner_text()
        assert page.evaluate('JSON.stringify(townBuilder.project)')==original
        assert page.evaluate('!townBuilder.region.cells.includes("128,100")&&townBuilder.region.cells.includes("124,100")')
        page.locator('#raiseRegion').click()
        assert page.evaluate('Object.keys(townBuilder.project.cells).length===32&&Object.values(townBuilder.project.cells).every(a=>a.level===1)')
        assert page.evaluate('!townBuilder.project.cells["128,100"]')
        raised=page.evaluate('JSON.stringify(townBuilder.project)')
        page.locator('#undo').click();assert page.evaluate('JSON.stringify(townBuilder.project)')==original
        page.locator('#redo').click();assert page.evaluate('JSON.stringify(townBuilder.project)')==raised
        page.locator('#lowerRegion').click()
        assert page.evaluate('Object.values(townBuilder.project.cells).every(a=>a.level===0)')
        page.locator('#undo').click()

        # Selection overlay must leave the concave notch untouched in all views.
        checks=page.evaluate('''async()=>{
          const appURL=document.querySelector('script[type="module"]').src,source=await(await fetch(appURL)).text();
          const runtime=new URL(source.split(String.fromCharCode(10)).find(l=>l.includes('runtime.mjs')).split("'")[1],appURL).href;
          const {render}=await import(runtime),d=townBuilder.project,r=townBuilder.region;
          const check=[];
          for(const view of ['art','colors','plan']){
            const canvases=[false,true].map(selected=>{const c=document.createElement('canvas');c.width=900;c.height=700;render(c.getContext('2d'),d,{x:8192,y:6144,zoom:.7},900,700,{heightView:view,region:selected?r:null});return c;});
            const sample=(x,y,level)=>canvases.map(c=>Array.from(c.getContext('2d').getImageData(Math.round(450+(x*64+12-8192)*.7),Math.round(350+(y*64+12-(view==='plan'?0:level*48)-6144)*.7),1,1).data));
            const inside=sample(124,100,1),outside=sample(128,100,0);check.push({view,inside:JSON.stringify(inside[0])!==JSON.stringify(inside[1]),outside:JSON.stringify(outside[0])===JSON.stringify(outside[1])});
          }
          return check;
        }''')
        assert all(c['inside'] and c['outside'] for c in checks),checks
        page.mouse.move(30,30)
        page.screenshot(path=str(ROOT/'docs/town-preview/freeform-selection.png'))
        page.keyboard.press('Escape');assert page.evaluate('townBuilder.region===null')
        page.mouse.click(*point(127.25,98.25))
        assert page.evaluate('townBuilder.region.cells.length')==1
        page.locator('#clearRegion').click();assert page.evaluate('townBuilder.region===null')

        page.locator('#selectAllLand').click()
        assert page.locator('#selectionShape').input_value()=='rectangle'
        assert page.evaluate('!townBuilder.region.cells&&townBuilder.region.x0===0&&townBuilder.region.x1===255&&townBuilder.region.y1===191')
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()

print('Lasso preview, actual shape/count, masked raise/lower, Undo/Redo, all-view highlighting, one-tile click and whole-map rectangle passed.')
