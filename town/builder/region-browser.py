from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1500,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
 page.locator('[data-tool="region"]').click();box=page.locator('#map').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 # Drag backwards across tile boundaries. Selecting alone must not mutate data.
 page.mouse.move(x+100,y+100);page.mouse.down();page.mouse.move(x-100,y-100,steps=10);page.mouse.up()
 r=page.evaluate('townBuilder.region');n=(r['x1']-r['x0']+1)*(r['y1']-r['y0']+1)
 assert n>9;assert page.evaluate('Object.keys(townBuilder.project.cells).length')==0
 page.locator('#raiseRegion').click();assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===1)');assert page.evaluate('Object.keys(townBuilder.project.cells).length')==n
 page.locator('#raiseRegion').click();assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===2)')
 page.locator('#undo').click();assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===1)')
 page.locator('#redo').click();assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===2)')
 page.locator('#lowerRegion').click();assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===1)')
 page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")')
 page.screenshot(path=str(ROOT/'docs/town-preview/land-selection.png'))
 page.locator('#clearRegion').click();assert page.locator('#raiseRegion').is_disabled()
 page.reload();page.wait_for_function('window.townBuilder?.project.cells');assert page.evaluate('Object.values(townBuilder.project.cells).every(c=>c.level===1)')
 assert not errors,errors;b.close()
server.shutdown();print('Region browser checks passed: reverse drag, batch raise/lower, one-action undo/redo, clear, and autosave reload.')
