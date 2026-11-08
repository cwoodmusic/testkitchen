"""Water buckets follow clicked terrain height and remain one reversible edit."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def basin(name):
    cells = {}
    for y in range(89, 104):
        for x in range(120, 136):
            rim = x in (120, 135) or y in (89, 103)
            cells[f'{x},{y}'] = {'surface': 'grass', 'level': 2 if rim else 1}
    for x in range(125, 134):
        cells[f'{x},98'] = {'surface': 'asphalt', 'level': 1}
    cells['124,94'] = {'surface': 'water', 'level': 1}
    for y in range(91, 102):
        cells[f'130,{y}'] = {'surface': 'grass', 'level': 1, 'bridge': 'ns', 'finish': 'wood'}
    for x, y, direction in [(122, 90, 'north'), (130, 90, 'north'), (130, 102, 'south')]:
        cells[f'{x},{y}'] = {'surface': 'wood', 'level': 1, 'stairs': direction, 'finish': 'stone'}
    cells['140,96'] = {'surface': 'sand', 'level': 1}
    return {'version': 1, 'name': name, 'cells': cells,
            'edges': {'h:118:104': {'style': 'wood', 'gate': False, 'open': False}},
            'objects': [], 'spawn': {'x': 8192, 'y': 6912}}


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p, TemporaryDirectory() as downloads:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1600, 'height': 1050}, accept_downloads=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base+'/town/builder/')
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        assert page.locator('[data-tool="fillWater"]').count() == 1
        dependencies = page.evaluate('''async()=>{
          const url=document.querySelector('script[type="module"]').src,code=await(await fetch(url)).text();
          const dependency=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],url).href;
          return {model:dependency('../world/model.mjs'),runtime:dependency('../world/runtime.mjs')};
        }''')

        def load(doc, view='art'):
            page.locator('#file').set_input_files({'name': 'water-basin.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')
            page.locator('#heightView').select_option(view)
            page.locator('#level').fill('8')
            page.locator('[data-tool="fillWater"]').click()
            assert page.locator('#heightView').input_value() == view

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def point(x, y):
            return page.evaluate('''async({x,y,url})=>{
              const {height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;
              const z=document.getElementById('heightView').value==='plan'?0:height(townBuilder.project,x,y);
              return {x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-z-cam.y)*cam.zoom};
            }''', {'x': x, 'y': y, 'url': dependencies['model']})

        def click(x, y):
            pos = point(x, y)
            page.mouse.click(pos['x'], pos['y'])

        def assert_basin(original):
            current = json.loads(state())
            expected = json.loads(json.dumps(original))
            for y in range(90, 103):
                for x in range(121, 135):
                    cell = expected['cells'][f'{x},{y}']
                    if 'stairs' not in cell:
                        cell['surface'] = 'water'
            assert current == expected, 'Fill crossed a height boundary, changed a protected stair/bridge, or missed connected ground.'
            assert current['cells']['140,96'] == original['cells']['140,96'], 'A disconnected island at the same level was filled.'
            return current

        seed = (126.5*64, 96.5*64)
        original = basin('Water fill · clicked height')
        load(original)
        before = state()
        click(*seed)
        filled = assert_basin(original)
        assert page.locator('#level').input_value() == '8', 'Fill changed the unrelated inspector setting.'
        after = state()
        click(*seed)  # Already-water clicks must not add an empty undo entry.
        assert state() == after
        page.locator('#undo').click()
        assert state() == before, 'One fill (plus a no-op click) was not one undo action.'
        page.locator('#redo').click()
        assert state() == after

        # This is a bucket, not a drag brush: crossing a lower level while held
        # cannot flood that level. Panning also leaves the project unchanged.
        start, end = point(*seed), point(137.5*64, 96.5*64)
        page.mouse.move(start['x'], start['y'])
        page.mouse.down()
        page.mouse.move(end['x'], end['y'], steps=10)
        page.mouse.up()
        assert state() == after, 'Dragging a fill stroke flooded another level.'
        page.mouse.move(start['x'], start['y'])
        page.mouse.down(button='right')
        page.mouse.move(start['x']+50, start['y']+20, steps=4)
        page.mouse.up(button='right')
        assert state() == after, 'Right-drag pan changed water.'

        # Both projected art views and the unprojected elevation plan must pick
        # the level under the click, independent of the inspector's value 8.
        for view in ['colors', 'plan']:
            original = basin('Water fill · '+view)
            load(original, view)
            click(*seed)
            assert_basin(original)
            page.locator('#undo').click()
            assert json.loads(state()) == original

        original = basin('Water fill · lake basin')
        load(original)
        click(*seed)
        filled = assert_basin(original)
        # The same map collision used during play blocks water while retaining
        # its bridge and the dry, usable stair connections at both bridge ends.
        collision = page.evaluate('''async url=>{
          const {blocked}=await import(url),d=townBuilder.project,c=townBuilder.catalog;
          return {water:blocked(d,126.5*64,96.5*64,c),bridge:blocked(d,130.5*64,96.5*64,c)};
        }''', dependencies['model'])
        assert collision == {'water': True, 'bridge': False}
        page.screenshot(path=str(ROOT/'docs/town-preview/water-fill.png'))

        # Save project remains a portable map file; restoring it and reloading
        # the local map retains exactly the filled cells and bridge metadata.
        with page.expect_download() as download_info:
            page.locator('#save').click()
        download = download_info.value
        saved_file = Path(downloads)/'water-fill.json'
        download.save_as(saved_file)
        assert json.loads(saved_file.read_text()) == filled
        page.evaluate('townBuilder.project.cells={}')
        page.locator('#file').set_input_files(str(saved_file))
        page.wait_for_function('townBuilder.project.cells["126,96"]?.surface==="water"')
        assert json.loads(state()) == filled
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload()
        page.wait_for_function('window.townBuilder?.project.cells["126,96"]?.surface==="water"', timeout=90000)
        assert json.loads(state()) == filled

        capture = '''async({url,game=false})=>{
          const {render}=await import(url),c=document.createElement('canvas');c.width=400;c.height=300;
          const g=c.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;
          render(g,game?townGame.project:townBuilder.project,{x:8192,y:6144,zoom:.7},800,600);
          return c.toDataURL();
        }'''
        builder_image = page.evaluate(capture, {'url': dependencies['runtime']})
        page.locator('#walk').click()
        assert page.locator('#walk').inner_text() == 'Stop walk test'
        page.keyboard.press('d')
        page.wait_for_timeout(100)
        page.locator('#walk').click()
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('townGame.project.cells["126,96"].surface') == 'water'
        assert page.evaluate(capture, {'url': dependencies['runtime'], 'game': True}) == builder_image
        # Starting on the bridge demonstrates actual authored-play movement
        # stopping at the flooded cell next to the bridge, at the same height.
        page.evaluate('Object.assign(townGame.player,{x:130.5*64,y:96.5*64})')
        page.keyboard.down('d')
        page.wait_for_timeout(350)
        page.keyboard.up('d')
        assert page.evaluate('townGame.player.x') < 131*64
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Water fill browser checks passed: clicked height in all views, protected boundaries/bridges/stairs, single undo, click-only behavior, saving, and gameplay parity.')
