"""Square sidewalk painting builds its outer curb; soft painting stays uncurbed."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def project(name, cells=None):
    return {'version': 1, 'name': name, 'cells': cells or {}, 'edges': {},
            'objects': [], 'spawn': {'x': 8192, 'y': 6144}}


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as p, TemporaryDirectory() as downloads:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1760, 'height': 1120}, accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base+'/town/builder/?kit=urban')
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        if page.evaluate('townBuilder.night'):
            page.locator('#lightingToggle').click()
        urls = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src;
          const resolve=async(url,needle)=>{const text=await(await fetch(url)).text();return new URL(text.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],url).href;};
          const model=await resolve(entry,'../world/model.mjs'),runtime=await resolve(entry,'../world/runtime.mjs');
          const renderer=await resolve(runtime,'./render.mjs'),terrain=await resolve(renderer,'./terrain-render.mjs');
          return {model,runtime,curbs:await resolve(terrain,'./sidewalk-curbs.mjs')};
        }''')

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def load(doc):
            page.locator('#file').set_input_files({'name': 'sidewalk-curbs.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:1})')

        def paint(surface='sidewalk', shape='square', size='1'):
            page.locator('[data-tool="ground"]').click()
            page.locator('#surface').select_option(surface)
            page.locator('#groundShape').select_option(shape)
            page.locator('#brush').fill(size)
            for control in ['brushHardness', 'brushOpacity']:
                page.locator('#'+control).evaluate("el=>{el.value='100';el.dispatchEvent(new Event('input',{bubbles:true}));}")

        def point(x, y):
            return page.evaluate('''async({x,y,model})=>{
              const {height}=await import(model),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;
              const z=document.getElementById('heightView').value==='plan'?0:height(townBuilder.project,x,y);
              return {x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-z-cam.y)*cam.zoom};
            }''', {'x': (x+.5)*64, 'y': (y+.5)*64, 'model': urls['model']})

        def click(x, y):
            at = point(x, y)
            page.mouse.click(at['x'], at['y'])

        def drag(cells):
            at = point(*cells[0]);page.mouse.move(at['x'], at['y']);page.mouse.down()
            for cell in cells[1:]:
                at = point(*cell);page.mouse.move(at['x'], at['y'], steps=6)
            page.mouse.up()

        def segments(x, y):
            return page.evaluate('''async({url,x,y})=>{const{sidewalkCurbSegments}=await import(url);return sidewalkCurbSegments(townBuilder.project,x,y);}''', {'url': urls['curbs'], 'x': x, 'y': y})

        def sides(x, y):
            return {edge['side'] for edge in segments(x, y)}

        load(project('Square sidewalk · outside perimeter'))
        paint()
        click(125, 95)
        assert page.evaluate('townBuilder.project.cells["125,95"].sidewalkCurb') is True
        assert sides(125, 95) == {'north', 'east', 'south', 'west'}
        click(126, 95)
        assert sides(125, 95) == {'north', 'south', 'west'}
        assert sides(126, 95) == {'north', 'east', 'south'}

        # Verify the production renderer actually draws the curb and does not
        # leave the former shared edge as a second seam inside the concrete.
        pixels = page.evaluate('''async({runtime})=>{
          const {render}=await import(runtime),d=structuredClone(townBuilder.project),plain=structuredClone(d);
          for(const a of Object.values(plain.cells))delete a.sidewalkCurb;
          const w=384,h=256,cam={x:126*64,y:95.5*64,zoom:1};
          const shot=doc=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;render(c,doc,cam,w,h,{night:false});return c.getImageData(0,0,w,h).data;};
          const a=shot(d),b=shot(plain),different=(x,y)=>{const i=((Math.floor(y-cam.y+h/2))*w+Math.floor(x-cam.x+w/2))*4;return a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2];};
          let outer=0,inside=0;
          for(let y=95*64-4;y<96*64+4;y++)for(let x=125*64-4;x<127*64+4;x++)if(different(x,y))outer++;
          for(let y=95*64+16;y<96*64-16;y++)for(let x=126*64-5;x<126*64+5;x++)if(different(x,y))inside++;
          return {outer,inside};
        }''', urls)
        assert pixels['outer'] > 600, pixels
        assert pixels['inside'] == 0, pixels

        click(125, 96)
        assert sides(125, 95) == {'north', 'west'}
        assert sides(126, 95) == {'north', 'east', 'south'}
        assert sides(125, 96) == {'east', 'south', 'west'}
        # Erasing an adjacent square exposes the surviving tile's curb again.
        page.locator('[data-tool="erase"]').click();page.locator('#brush').fill('1')
        click(126, 95)
        assert 'east' in sides(125, 95)
        page.locator('#undo').click()
        assert 'east' not in sides(125, 95)

        # Existing projects may already have pure sidewalk without the new
        # authoring marker. A square click upgrades that same material.
        load(project('Square sidewalk · upgrade old paving', {'125,95': {'surface': 'sidewalk', 'level': 0}}))
        assert segments(125, 95) == []
        before_upgrade = state()
        paint();click(125, 95)
        assert page.evaluate('townBuilder.project.cells["125,95"].sidewalkCurb') is True
        assert len(sides(125, 95)) == 4
        page.locator('#undo').click();assert state() == before_upgrade
        page.locator('#redo').click();assert len(sides(125, 95)) == 4

        # Round brushes cannot opt cells into automatic construction, and
        # brushing an existing square releases its hard curb perimeter.
        paint(shape='round')
        click(128, 95)
        assert page.evaluate('Object.values(townBuilder.project.cells).filter(a=>a.sidewalkCurb).length') == 1
        assert segments(128, 95) == []
        round_before = state()
        click(125, 95)
        assert not page.evaluate('townBuilder.project.cells["125,95"].sidewalkCurb||false')
        assert segments(125, 95) == []
        page.locator('#undo').click();assert state() == round_before
        paint(surface='brick');click(125, 95)
        assert not page.evaluate('townBuilder.project.cells["125,95"].sidewalkCurb||false')
        assert segments(125, 95) == []

        # One multi-cell drag makes a single history action. A height change
        # is a boundary even where the two squares are both concrete.
        load(project('Square sidewalk · one joined stroke', {'129,95': {'surface': 'sidewalk', 'level': 1}}))
        paint()
        before_drag = state()
        drag([(125, 95), (126, 95), (126, 96), (127, 96)])
        after_drag = state()
        assert page.evaluate('Object.values(townBuilder.project.cells).filter(a=>a.sidewalkCurb).length') == 4
        page.locator('#undo').click();assert state() == before_drag
        page.locator('#redo').click();assert state() == after_drag
        click(128, 95)
        assert 'east' in sides(128, 95)
        click(129, 95)
        assert {edge['z'] for edge in segments(129, 95)} == {48}
        assert 'west' in sides(129, 95)
        legal = page.evaluate('''async url=>{
          const {blocked,parseProject}=await import(url),d=townBuilder.project;
          return {portable:!!parseProject(JSON.stringify(d),new Set(townBuilder.catalog.keys())),walkable:!blocked(d,125*64+2,95.5*64,townBuilder.catalog,{x:125*64-2,y:95.5*64})};
        }''', urls['model'])
        assert legal == {'portable': True, 'walkable': True}, legal

        # The authored marker, derived geometry, and production pixels are
        # identical after export, restore, and entering the playable map.
        with page.expect_download() as download:
            page.locator('#save').click()
        saved = Path(downloads)/'sidewalk-curbs.json';download.value.save_as(str(saved))
        exported = json.loads(saved.read_text())
        assert any(a.get('sidewalkCurb') for a in exported['cells'].values())
        geometry = {str((x, y)): segments(x, y) for x, y in [(125, 95), (126, 95), (126, 96), (127, 96), (129, 95)]}
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload();page.wait_for_function('window.townBuilder?.project.name==="Square sidewalk · one joined stroke"', timeout=90000)
        assert json.loads(state()) == exported
        assert {str((x, y)): segments(x, y) for x, y in [(125, 95), (126, 95), (126, 96), (127, 96), (129, 95)]} == geometry
        page.locator('#play').click();page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('townGame.project') == exported
        assert page.evaluate('''async({url,expected})=>{const{sidewalkCurbSegments}=await import(url);return JSON.stringify(sidewalkCurbSegments(townGame.project,125,95))===JSON.stringify(expected);}''', {'url': urls['curbs'], 'expected': geometry[str((125, 95))]})

        # A daylight reference shows the outside contour and inside corners
        # of a two-tile sidewalk built with the actual square painting tool.
        page.get_by_role('button', name='Town Builder', exact=True).click()
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        if page.locator('#npcToggle').count() and page.locator('#npcToggle').get_attribute('aria-pressed') == 'true':
            page.locator('#npcToggle').click()
        if page.evaluate('townBuilder.night'):
            page.locator('#lightingToggle').click()
        scene = {f'{x},{y}': {'surface': 'asphalt', 'level': 0}
                 for y in range(90, 104) for x in range(121, 136)}
        for y in range(95, 99):
            for x in range(124, 129):
                scene[f'{x},{y}'] = {'surface': 'grass', 'level': 0}
        load(project('Sidewalk · automatic outside curbs', scene))
        paint(size='2')
        drag([(123, 94), (130, 94), (130, 100), (123, 100)])
        paint(size='1');click(122, 97)
        page.mouse.move(10, 90)
        page.evaluate('Object.assign(townBuilder.cam,{x:8224,y:6176,zoom:.9})')
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.screenshot(path=str(ROOT/'docs/town-preview/sidewalk-curbs.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Sidewalk curb browser checks passed: square-only outside edges, joined corners, repaint/erase updates, undo, elevations, saved projects, and Play parity.')
