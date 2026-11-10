"""Click-select an elevation/enclosed yard, then raise/lower with one undo."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'town/maps/coda-town-uploaded-3.json'
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
out = Path('/workspace/.onboarding/town-elevation-select')
out.mkdir(parents=True, exist_ok=True)
cells = {}
for y in range(59, 71):
    for x in range(59, 71):
        dry = 60 <= x < 70 and 60 <= y < 70
        cells[f'{x},{y}'] = {'surface': ('cobble' if (x + y) % 3 == 0 else 'grass') if dry else 'water', 'level': 2 if dry else 0}
edges = {}
for x in range(62, 66):
    for y in [62, 66]:
        edges[f'h:{x}:{y}'] = {'style': 'wood', 'gate': False, 'open': False}
for y in range(62, 66):
    for x in [62, 66]:
        edges[f'v:{x}:{y}'] = {'style': 'wood', 'gate': False, 'open': False}
edges['h:63:66']['gate'] = True
fixture = {'version': 1, 'name': 'Isolated click-elevation test', 'cells': cells, 'edges': edges, 'objects': [], 'spawn': {'x': 4064, 'y': 4064}}
enclosed = {f'{x},{y}' for x in range(62, 66) for y in range(62, 66)}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1600, 'height': 1000})
        page.set_default_timeout(90000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')

        def load(data):
            page.locator('#file').set_input_files({'name': 'click-elevation.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()})
            page.wait_for_function('(n)=>townBuilder.project.name===n', arg=data['name'])
            page.evaluate('Object.assign(townBuilder.cam,{x:4096,y:4096,zoom:.8})')

        def click(x, y, level=0):
            point = page.evaluate('''({x,y,level})=>{const r=document.getElementById('map').getBoundingClientRect(),c=townBuilder.cam,plan=document.getElementById('heightView').value==='plan';return{x:r.x+r.width/2+(x-c.x)*c.zoom,y:r.y+r.height/2+(y-(plan?0:level*48)-c.y)*c.zoom};}''', {'x': x, 'y': y, 'level': level})
            page.mouse.click(point['x'], point['y'])

        load(fixture)
        page.locator('#selectionShape').select_option('elevation')
        assert page.evaluate('townBuilder.tool') == 'region'
        assert page.locator('#selectionShape option').evaluate_all('(options)=>options.map(o=>o.value)') == ['rectangle', 'freeform', 'elevation']
        click(4064, 4064, 2)
        page.wait_for_function('townBuilder.region?.shape==="elevation"')
        region = page.evaluate('townBuilder.region')
        assert set(region['cells']) == enclosed and region['level'] == 2
        assert page.evaluate('townBuilder.project') == fixture
        page.locator('#raiseRegion').click()
        raised = page.evaluate('townBuilder.project')
        assert {key for key, cell in raised['cells'].items() if cell['level'] == 3} == enclosed
        assert page.evaluate('townBuilder.region.level') == 3
        assert 'Level 3' in page.locator('#regionInfo').inner_text()
        page.locator('#undo').click()
        assert page.evaluate('townBuilder.project') == fixture
        assert page.evaluate('townBuilder.region.level') == 2
        page.locator('#redo').click()
        assert page.evaluate('townBuilder.project') == raised
        page.locator('#lowerRegion').click()
        assert page.evaluate('townBuilder.project') == fixture
        page.screenshot(path=str(out / 'enclosed-elevation-selection.png'))

        # Opening the real fence gate connects the entire dry terrace, even
        # though it contains mixed ground materials. Water remains a boundary.
        opened = json.loads(json.dumps(fixture))
        opened['name'] = 'Open gate click-elevation test'
        opened['edges']['h:63:66']['open'] = True
        load(opened)
        page.locator('#heightView').select_option('plan')
        page.locator('#selectionShape').select_option('elevation')
        click(4064, 4064, 2)
        page.wait_for_function('townBuilder.region?.cells.length===100')
        assert page.evaluate('townBuilder.project') == opened
        click(3808, 3808)
        assert page.evaluate('townBuilder.region') is None
        assert page.locator('#raiseRegion').is_disabled()
        assert page.evaluate('townBuilder.project') == opened
        assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
        assert not errors, errors
        result = {'closedYardTiles': len(region['cells']), 'openGateTiles': 100, 'mixedMaterials': True, 'waterRejected': True, 'artworkAndPlanViews': True, 'singleUndo': True, 'sourceUnchanged': True, 'sourceHash': source_hash, 'pageErrors': errors}
        (out / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.shutdown()
