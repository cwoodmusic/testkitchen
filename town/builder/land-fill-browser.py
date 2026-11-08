"""Land buckets reclaim connected water without crossing dry shores or heights."""
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
            cells[f'{x},{y}'] = {'surface': 'grass' if rim or x == 128 else 'water', 'level': 2 if rim else 1}
    cells['124,96'] = {'surface': 'grass', 'level': 1}  # A dry island is a fill boundary.
    for y in range(91, 102):
        cells[f'126,{y}'] = {'surface': 'water', 'level': 1, 'bridge': 'ns', 'finish': 'wood'}
    cells['123,90'] = {'surface': 'wood', 'level': 1, 'stairs': 'north', 'finish': 'stone'}
    cells['140,96'] = {'surface': 'water', 'level': 3}
    cells['140,98'] = {'surface': 'water', 'level': 1}
    return {'version': 1, 'name': name, 'cells': cells,
            'edges': {'h:118:104': {'style': 'wood', 'gate': False, 'open': False}},
            'objects': [], 'spawn': {'x': 125.5*64, 'y': 96.5*64}}


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
        assert page.locator('[data-tool="fillLand"]').count() == 1
        assert page.locator('[data-tool="fillWater"]').count() == 1
        assert page.locator('[data-tool="water"]').count() == 1
        dependencies = page.evaluate('''async()=>{
          const url=document.querySelector('script[type="module"]').src,code=await(await fetch(url)).text();
          const dependency=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],url).href;
          return {model:dependency('../world/model.mjs'),runtime:dependency('../world/runtime.mjs'),round:dependency('./round-terrain.mjs')};
        }''')

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def load(doc, material='grass', view='art'):
            page.locator('#file').set_input_files({'name': 'land-basin.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')
            page.locator('#heightView').select_option(view)
            page.locator('#surface').select_option(material)
            page.locator('#paving').select_option('music-square')
            page.locator('#level').fill('8')
            page.locator('[data-tool="fillLand"]').click()
            assert page.locator('#heightView').input_value() == view

        def point(x, y):
            return page.evaluate('''async({x,y,url})=>{
              const {height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;
              const z=document.getElementById('heightView').value==='plan'?0:height(townBuilder.project,x,y);
              return {x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-z-cam.y)*cam.zoom};
            }''', {'x': x, 'y': y, 'url': dependencies['model']})

        def click(x, y):
            pos = point(x, y)
            page.mouse.click(pos['x'], pos['y'])

        def expected_land(original, material):
            expected = json.loads(json.dumps(original))
            for y in range(90, 103):
                for x in range(121, 128):
                    cell = expected['cells'][f'{x},{y}']
                    if cell['surface'] == 'water' and 'stairs' not in cell:
                        cell['surface'] = material
                        if material == 'cobble':
                            cell['paving'] = 'music-square'
            return expected

        seed = (125.5*64, 96.5*64)
        # Each dry material is available, and cobble uses the chosen donor.
        for material in ['grass', 'dirt', 'sand', 'wood', 'cobble', 'asphalt', 'sidewalk', 'brick']:
            original = basin('Land fill · '+material)
            load(original, material)
            before = state()
            click(*seed)
            assert json.loads(state()) == expected_land(original, material), material
            assert page.locator('#level').input_value() == '8'
            after = state()
            click(*seed)  # Already-dry clicks must not insert an empty undo entry.
            assert state() == after
            page.locator('#undo').click()
            assert state() == before, 'One land fill (plus no-op) must be one undo action.'
            page.locator('#redo').click()
            assert state() == after

        # The chosen height must follow the projected ground in every view.
        for view in ['colors', 'plan']:
            original = basin('Land fill · '+view)
            load(original, 'dirt', view)
            click(*seed)
            assert json.loads(state()) == expected_land(original, 'dirt')

        # A rounded shoreline has grass and water inside the same terrain tile.
        # Reclaim only the actual water footprint, including its curved edge.
        rounded = basin('Land fill · rounded shore')
        for y in range(90, 103):
            for x in range(121, 135):
                rounded['cells'][f'{x},{y}'] = {'surface': 'water' if 125 <= x <= 127 and 94 <= y <= 96 else 'grass', 'level': 1}
        load(rounded, 'sand')
        page.evaluate('''async url=>{
          const {roundTerrain}=await import(url),d=townBuilder.project;
          Object.assign(d.cells,Object.fromEntries(roundTerrain(d,{x:125.5*64,y:94.5*64},3).edits));
        }''', dependencies['round'])
        samples = page.evaluate('''async url=>{
          const {height,surfaceAt}=await import(url),d=townBuilder.project,points=[];
          for(let y=93*64+2;y<98*64;y+=8)for(let x=124*64+2;x<129*64;x+=8)points.push({x,y,z:height(d,x,y),surface:surfaceAt(d,x,y)});
          return points;
        }''', dependencies['model'])
        assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.curves?.length)')
        click(126.5*64, 95.5*64)
        assert page.evaluate('''async({url,points})=>{
          const {height,surfaceAt}=await import(url),d=townBuilder.project;
          return points.every(p=>height(d,p.x,p.y)===p.z&&surfaceAt(d,p.x,p.y)===(p.surface==='water'?'sand':p.surface));
        }''', {'url': dependencies['model'], 'points': samples}), 'Land fill reshaped the rounded shoreline or repainted its dry grass.'

        original = basin('Land fill · reclaimed shore')
        load(original)
        click(*seed)
        dry = expected_land(original, 'grass')
        assert json.loads(state()) == dry
        after = state()
        start, end = point(*seed), point(132.5*64, 96.5*64)
        page.mouse.move(start['x'], start['y'])
        page.mouse.down()
        page.mouse.move(end['x'], end['y'], steps=10)
        page.mouse.up()
        assert state() == after, 'A held land bucket must not drain a second basin.'
        page.mouse.move(start['x'], start['y'])
        page.mouse.down(button='right')
        page.mouse.move(start['x']+35, start['y']+15, steps=4)
        page.mouse.up(button='right')
        assert state() == after, 'Right-drag pan must not alter water.'

        # The existing water bucket keeps its broader same-height behavior.
        page.locator('[data-tool="fillWater"]').click()
        click(*seed)
        rewetted = json.loads(state())
        assert rewetted['cells']['125,96']['surface'] == 'water'
        assert rewetted['cells']['124,96']['surface'] == 'water'
        assert rewetted['cells']['128,96']['surface'] == 'water'
        assert rewetted['cells']['140,98']['surface'] == 'water'
        page.locator('#undo').click()
        assert json.loads(state()) == dry
        page.locator('[data-tool="fillLand"]').click()
        page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')
        page.screenshot(path=str(ROOT/'docs/town-preview/land-fill.png'))

        collision = page.evaluate('''async url=>{
          const {blocked}=await import(url),d=townBuilder.project,c=townBuilder.catalog;
          return {land:blocked(d,125.5*64,96.5*64,c),water:blocked(d,132.5*64,96.5*64,c),bridge:blocked(d,126.5*64,96.5*64,c)};
        }''', dependencies['model'])
        assert collision == {'land': False, 'water': True, 'bridge': False}
        with page.expect_download() as download_info:
            page.locator('#save').click()
        saved_file = Path(downloads)/'land-fill.json'
        download_info.value.save_as(saved_file)
        assert json.loads(saved_file.read_text()) == dry
        page.evaluate('townBuilder.project.cells={}')
        page.locator('#file').set_input_files(str(saved_file))
        page.wait_for_function('townBuilder.project.cells["125,96"]?.surface==="grass"')
        assert json.loads(state()) == dry
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload()
        page.wait_for_function('window.townBuilder?.project.cells["125,96"]?.surface==="grass"', timeout=90000)
        assert json.loads(state()) == dry

        # Play the exact authored terrain and move from new land to its shore.
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=90000)
        assert json.loads(page.evaluate('JSON.stringify(townGame.project)')) == dry
        page.evaluate('Object.assign(townGame.player,{x:128.5*64,y:96.5*64})')
        before_x = page.evaluate('townGame.player.x')
        page.keyboard.down('d')
        page.wait_for_timeout(350)
        page.keyboard.up('d')
        assert before_x < page.evaluate('townGame.player.x') < 129*64
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Land fill browser checks passed: selected materials, water-only height boundaries, bridges/stairs, one-step undo, saves, and playable reclaimed land.')
