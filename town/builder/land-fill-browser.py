"""Land buckets replace connected dry or wet materials without crossing boundaries."""
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


def dry_patch(name):
    doc = basin(name)
    for y in range(90, 103):
        for x in range(121, 128):
            cell = doc['cells'][f'{x},{y}']
            if cell['surface'] == 'water':
                cell['surface'] = 'grass'
        doc['cells'][f'128,{y}'] = {'surface': 'dirt', 'level': 1}
    doc['cells']['124,96'] = {'surface': 'sand', 'level': 1}
    doc['cells']['122,98'] = {'surface': 'water', 'level': 1}
    doc['cells']['122,92'] = {'surface': 'grass', 'level': 2}
    return doc


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
          const brush=dependency('./ground-brush.mjs'),brushCode=await(await fetch(brush)).text();
          const paint=new URL(brushCode.split(String.fromCharCode(10)).find(line=>line.includes('../world/ground-paint.mjs')).split("'")[1],brush).href;
          return {model:dependency('../world/model.mjs'),runtime:dependency('../world/runtime.mjs'),round:dependency('./round-terrain.mjs'),brush,paint};
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
            assert page.locator('#surface').input_value() == material
            label = page.locator('#surface option:checked').inner_text()
            assert label in page.locator('#hint').inner_text()

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

        def expected_dry(original, material):
            expected = json.loads(json.dumps(original))
            for y in range(90, 103):
                for x in range(121, 128):
                    cell = expected['cells'][f'{x},{y}']
                    if cell['surface'] == 'grass' and cell['level'] == 1 and 'stairs' not in cell:
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
            click(*seed)  # An already-matching surface must not add an undo entry.
            assert state() == after
            page.locator('#undo').click()
            assert state() == before, 'One land fill (plus no-op) must be one undo action.'
            page.locator('#redo').click()
            assert state() == after

        # Clicking existing land uses the same selected material. Other dry
        # finishes, water and raised terrain remain boundaries of that region.
        for material in ['dirt', 'sand', 'wood', 'cobble', 'asphalt', 'sidewalk', 'brick']:
            original = dry_patch('Dry land fill · '+material)
            load(original, material)
            before = state()
            click(*seed)
            assert json.loads(state()) == expected_dry(original, material), material
            after = state()
            click(*seed)
            assert state() == after
            page.locator('#undo').click()
            assert state() == before, 'A dry-land bucket stroke must be one undo action.'
            page.locator('#redo').click()
            assert state() == after

        original = dry_patch('Dry land fill · same material')
        load(original, 'grass')
        before = state()
        click(*seed)
        assert state() == before, 'Filling grass with grass should keep the document untouched.'

        # Round brushes keep the base cell's surface and store the actual
        # visible material in paint channels. The bucket must use those pixels.
        painted = basin('Land fill · round-brush sand patch')
        for y in range(90, 103):
            for x in range(121, 135):
                painted['cells'][f'{x},{y}'] = {'surface': 'grass', 'level': 1}
        load(painted, 'wood')
        page.evaluate('''async url=>{
          const {paintGround}=await import(url),d=townBuilder.project;
          Object.assign(d.cells,Object.fromEntries(paintGround(d,{x:125.5*64,y:96.5*64},{size:224,hardness:.55,opacity:1,surface:'sand'}).edits));
        }''', dependencies['brush'])
        assert page.evaluate('townBuilder.project.cells["125,96"].surface==="grass"&&!!townBuilder.project.cells["125,96"].paint')
        painted_samples = page.evaluate('''async({model,paint})=>{
          const {cell,height}=await import(model),{readPaint}=await import(paint),d=townBuilder.project,points=[];
          for(let y=94*64+2;y<99*64;y+=4)for(let x=123*64+2;x<129*64;x+=4){
            const a=cell(d,Math.floor(x/64),Math.floor(y/64)),p=readPaint(a),n=(Math.floor(y%64/4)*16+Math.floor(x%64/4))*p.materials.length;
            let index=0;for(let i=1;i<p.materials.length;i++)if(p.weights[n+i]>p.weights[n+index])index=i;
            points.push({x,y,z:height(d,x,y),surface:p.materials[index].surface});
          }return points;
        }''', dependencies)
        assert any(p['surface'] == 'sand' for p in painted_samples)
        assert any(p['surface'] == 'grass' for p in painted_samples)
        painted_before = state()
        click(*seed)
        assert page.evaluate('''async({model,paint,points})=>{
          const {cell,height}=await import(model),{readPaint}=await import(paint),d=townBuilder.project;
          return points.every(point=>{const a=cell(d,Math.floor(point.x/64),Math.floor(point.y/64)),p=readPaint(a),n=(Math.floor(point.y%64/4)*16+Math.floor(point.x%64/4))*p.materials.length;
            let index=0;for(let i=1;i<p.materials.length;i++)if(p.weights[n+i]>p.weights[n+index])index=i;
            return height(d,point.x,point.y)===point.z&&p.materials[index].surface===(point.surface==='sand'?'wood':point.surface);
          });
        }''', {**dependencies, 'points': painted_samples}), 'The bucket ignored round-brush pixels and filled their underlying grass.'
        assert page.evaluate('townBuilder.project.cells["121,91"].surface==="grass"&&!townBuilder.project.cells["121,91"].paint')
        painted_after = state()
        page.locator('#undo').click()
        assert state() == painted_before
        page.locator('#redo').click()
        assert state() == painted_after

        # A continuous painted strip is a visible material boundary, even
        # though every tile beneath it still declares a grass base surface.
        painted['name'] = 'Land fill · round-brush material boundary'
        load(painted, 'brick')
        page.evaluate('''async url=>{
          const {paintGround}=await import(url),d=townBuilder.project;
          for(let y=89.5*64;y<=103.5*64;y+=24)Object.assign(d.cells,Object.fromEntries(paintGround(d,{x:128.5*64,y},{size:128,hardness:.65,opacity:1,surface:'sand'}).edits));
        }''', dependencies['brush'])
        click(*seed)
        assert page.evaluate('''async({model,paint})=>{
          const {cell}=await import(model),{readPaint}=await import(paint),d=townBuilder.project;
          const surface=(x,y)=>{const p=readPaint(cell(d,Math.floor(x/64),Math.floor(y/64))),n=(Math.floor(y%64/4)*16+Math.floor(x%64/4))*p.materials.length;let index=0;for(let i=1;i<p.materials.length;i++)if(p.weights[n+i]>p.weights[n+index])index=i;return p.materials[index].surface;};
          return surface(125.5*64,96.5*64)==='brick'&&surface(128.5*64,96.5*64)==='sand'&&surface(132.5*64,96.5*64)==='grass';
        }''', dependencies), 'A grass fill crossed the painted sand boundary.'

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
        sand_shore = state()
        page.locator('#surface').select_option('brick')
        assert 'brick' in page.locator('#hint').inner_text().lower()
        click(126.5*64, 95.5*64)
        assert page.evaluate('''async({url,points})=>{
          const {height,surfaceAt}=await import(url),d=townBuilder.project;
          return points.every(p=>height(d,p.x,p.y)===p.z&&surfaceAt(d,p.x,p.y)===(p.surface==='water'?'brick':p.surface));
        }''', {'url': dependencies['model'], 'points': samples}), 'Repainting the dry rounded shore crossed its grass material boundary.'
        brick_shore = state()
        page.locator('#undo').click()
        assert state() == sand_shore
        page.locator('#redo').click()
        assert state() == brick_shore

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

        # Save and play a region that was repainted on existing dry land.
        original = dry_patch('Land fill · painted dry ground')
        load(original, 'cobble')
        click(*seed)
        dry = expected_dry(original, 'cobble')
        assert json.loads(state()) == dry
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
        page.wait_for_function('townBuilder.project.cells["125,96"]?.surface==="cobble"')
        assert json.loads(state()) == dry
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload()
        page.wait_for_function('window.townBuilder?.project.cells["125,96"]?.surface==="cobble"', timeout=90000)
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

print('Land fill browser checks passed: wet and dry source materials, material/height/water boundaries, bridges/stairs, one-step undo, saves, and playable painted ground.')
