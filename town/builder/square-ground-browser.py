"""Square tile painting remains available beside soft round painting."""
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

        def load(name, cells=None):
            doc = {'version':1,'name':name,'cells':cells or {},'edges':{},'objects':[],'spawn':{'x':8192,'y':6400}}
            page.locator('#file').set_input_files({'name':'square.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name',arg=name)
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')

        def point(x, y):
            box = page.locator('#map').bounding_box()
            return (box['x']+box['width']/2+(x-8192)*.7, box['y']+box['height']/2+(y-6144)*.7)

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project.cells)')

        load('Round then square')
        page.locator('[data-tool="ground"]').click()
        assert page.locator('#groundShape').input_value()=='round'
        page.locator('#surface').select_option('dirt')
        page.locator('#brush').fill('1')
        page.mouse.click(*point(8192+32,6144+32))
        assert page.evaluate('!!townBuilder.project.cells["128,96"].paint')
        page.locator('#groundShape').select_option('square')
        assert page.locator('#softGroundControls').is_hidden()
        page.locator('#surface').select_option('sand')
        page.mouse.click(*point(8192+45,6144+20))
        assert page.evaluate('townBuilder.project.cells["128,96"].surface==="sand"&&!townBuilder.project.cells["128,96"].paint')
        page.locator('#undo').click()
        assert page.evaluate('!!townBuilder.project.cells["128,96"].paint')
        page.locator('#redo').click()
        assert page.evaluate('townBuilder.project.cells["128,96"].surface==="sand"&&!townBuilder.project.cells["128,96"].paint')

        load('Continuous tile drag')
        before = state()
        page.locator('#surface').select_option('wood')
        page.mouse.move(*point(125.1*64,98.2*64));page.mouse.down()
        page.mouse.move(*point(135.8*64,98.2*64),steps=1);page.mouse.up()
        assert page.evaluate('Array.from({length:11},(_,i)=>townBuilder.project.cells[(125+i)+",98"]?.surface==="wood").every(Boolean)')
        painted = state()
        page.locator('#undo').click();assert state()==before
        page.locator('#redo').click();assert state()==painted
        page.locator('#brush').fill('3')
        page.mouse.click(*point(130.9*64,102.1*64))
        assert page.evaluate('Array.from({length:3},(_,dy)=>Array.from({length:3},(_,dx)=>townBuilder.project.cells[(129+dx)+","+(101+dy)]?.surface==="wood")).flat().every(Boolean)')

        # Height and curved boundary metadata survive a tile material change.
        curve={'corner':'se','cx':128*64,'cy':99*64,'r':64,'kind':'height','underX':130,'underY':101}
        special={'128,100':{'surface':'dirt','level':2,'curves':[curve]},'129,100':{'surface':'water','level':0},'130,100':{'surface':'wood','level':0,'bridge':'ew'},'131,100':{'surface':'cobble','level':0,'stairs':'north'}}
        load('Protected ground',special)
        page.locator('#brush').fill('1')
        page.locator('#surface').select_option('sand')
        page.mouse.click(*point(128.5*64,100.5*64-96))
        assert page.evaluate('(q)=>{const a=townBuilder.project.cells["128,100"];return a.surface==="sand"&&a.level===2&&JSON.stringify(a.curves)===JSON.stringify([q]);}',curve)
        for x in [129,130,131]:
            old=page.evaluate('(key)=>JSON.stringify(townBuilder.project.cells[key])',f'{x},100')
            page.mouse.click(*point((x+.5)*64,100.8*64))
            assert page.evaluate('(key)=>JSON.stringify(townBuilder.project.cells[key])',f'{x},100')==old

        page.locator('[data-tool="blend"]').click()
        assert page.locator('#groundShape').is_disabled()
        assert page.locator('#groundShape').input_value()=='round'
        assert page.locator('#softGroundControls').is_visible()
        page.locator('[data-tool="ground"]').click()
        assert page.locator('#groundShape').input_value()=='square'
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()

print('Round/square choice, tile replacement, fast drag coverage, widths, Undo/Redo, preserved terrain and protected surfaces passed.')
