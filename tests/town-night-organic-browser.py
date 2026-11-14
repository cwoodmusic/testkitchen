"""City-night preview stays live while organic shore edits remain portable."""
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


def project(name):
    return {'version': 1, 'name': name, 'cells': {}, 'edges': {}, 'objects': [], 'spawn': {'x': 8192, 'y': 6144}}


def put(doc, asset, x, y, layer='objects', collision=True):
    doc['objects'].append({'id': f'preview-{len(doc["objects"])}', 'asset': asset, 'x': x, 'y': y, 'scale': 1, 'rotation': 0, 'layer': layer, 'collision': collision})


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
        assert page.locator('#lightingToggle').count() == 1
        assert page.locator('[data-tool="organic"]').count() == 1
        assert page.locator('#lightingToggle').input_value() == 'auto'
        assert page.evaluate('townBuilder.night') is False
        dependencies = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src,code=await(await fetch(entry)).text();
          const find=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],entry).href;
          return {model:find('../world/model.mjs'),runtime:find('../world/runtime.mjs')};
        }''')

        def load(doc, camera=None):
            page.locator('#file').set_input_files({'name': 'preview.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.evaluate('camera=>Object.assign(townBuilder.cam,camera)', camera or {'x': 8192, 'y': 6144, 'zoom': .55})

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def daylight():
            page.locator('#lightingToggle').select_option('day')
            assert page.evaluate('townBuilder.night') is False

        def night():
            page.locator('#lightingToggle').select_option('night')
            assert page.evaluate('townBuilder.night') is True

        def point(x, y):
            return page.evaluate('''async({x,y,url})=>{
              const {height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;
              const z=document.getElementById('heightView').value==='plan'?0:height(townBuilder.project,x,y);
              return {x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-z-cam.y)*cam.zoom};
            }''', {'x': x, 'y': y, 'url': dependencies['model']})

        # Isolate one lamp so blue ambient light and a soft warm pool can be
        # assessed against the same source ground, without moving NPCs.
        lighting = project('City night · isolated lamp')
        for y in range(84, 109):
            for x in range(113, 144):
                lighting['cells'][f'{x},{y}'] = {'surface': 'asphalt', 'level': 0}
        put(lighting, 'decor-14-01', 8192, 6208)
        load(lighting)
        light_check = page.evaluate('''async({doc,url})=>{
          const {render,preparePlacedArt}=await import(url);await preparePlacedArt(doc);
          const w=1000,h=720,cam={x:8192,y:6144,zoom:.6};
          const shot=(night,time=0,heightView='art')=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');render(c,doc,cam,w,h,{night,time,heightView});return {cv,data:c.getImageData(0,0,w,h).data};};
          const day=shot(false),dark=shot(true);
          const sample=(data,x,y)=>{const xx=Math.round(w/2+(x-cam.x)*cam.zoom),yy=Math.round(h/2+(y-cam.y)*cam.zoom),out=[0,0,0];let count=0;
            for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const i=((yy+dy)*w+xx+dx)*4;for(let k=0;k<3;k++)out[k]+=data[i+k];count++;}return out.map(v=>v/count);};
          const luma=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
          const ratio=(x,y)=>luma(sample(dark.data,x,y))/Math.max(1,luma(sample(day.data,x,y)));
          const near=[];for(const x of [-96,-48,48,96])for(const y of [-144,-64,32,96])near.push(ratio(8192+x,6208+y));
          const far=[ratio(7592,6208),ratio(8792,6208),ratio(7592,5984),ratio(8792,5984)];
          const planDay=shot(false,0,'plan').cv.toDataURL(),planNight=shot(true,0,'plan').cv.toDataURL();
          return {near,far,planIdentical:planDay===planNight};
        }''', {'doc': lighting, 'url': dependencies['runtime']})
        far_mean = sum(light_check['far'])/len(light_check['far'])
        assert far_mean < .88, light_check
        assert sum(v > far_mean+.1 for v in light_check['near']) >= 3, light_check
        assert light_check['planIdentical'], 'Night tint obscured the elevation plan.'

        # A real plaza preview has animated residents and atmosphere, while
        # the underlying project remains byte-for-byte an authored map.
        city = project('Coda Town · city night')
        put(city, 'urban-road-straight-ns', 8192, 7680, 'ground', False)
        put(city, 'music-square', 8192, 6950, 'ground')
        for x in [7744, 8640]:
            put(city, 'decor-14-01', x, 6350)
        for x in [6832, 9552]:
            put(city, 'trees-0-480', x, 6700)
        put(city, 'trees-5-200', 7340, 6440, collision=False)
        put(city, 'trees-5-200', 9030, 6450, collision=False)
        load(city, {'x': 8192, 'y': 6120, 'zoom': .49})
        night()
        before_night = state()
        page.wait_for_function('townBuilder.ambient?.actors?.length>=6', timeout=20000)
        actors_before = page.evaluate('townBuilder.ambient.actors.map(a=>({id:a.id,x:a.x,y:a.y}))')
        page.wait_for_timeout(2400)
        actors_after = page.evaluate('townBuilder.ambient.actors.map(a=>({id:a.id,x:a.x,y:a.y,walking:a.walking}))')
        moved = sum(any(a['id'] == b['id'] and abs(a['x']-b['x'])+abs(a['y']-b['y']) > 3 for b in actors_after) for a in actors_before)
        assert moved >= 3, (actors_before, actors_after)
        actor_safety = page.evaluate('''async url=>{const {blocked}=await import(url);return townBuilder.ambient.actors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&!blocked(townBuilder.project,a.x,a.y,townBuilder.catalog));}''', dependencies['model'])
        assert actor_safety, 'A wandering resident entered a solid object or water.'
        assert state() == before_night, 'Night lighting or NPC simulation changed saved map data.'
        fireflies = page.evaluate('''async url=>{
          const {render,preparePlacedArt}=await import(url),doc=townBuilder.project;
          await preparePlacedArt(doc);const w=1000,h=720,cam={x:8192,y:6120,zoom:.49};
          const shot=(night,time)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');render(c,doc,cam,w,h,{night,time});return c.getImageData(0,0,w,h).data;};
          const changed=(a,b)=>{let pixels=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>8)pixels++;return pixels;};
          return {day:changed(shot(false,0),shot(false,4)),night:changed(shot(true,0),shot(true,4))};
        }''', dependencies['runtime'])
        assert fireflies['day'] == 0 and 24 < fireflies['night'] < 10000, fireflies
        page.screenshot(path=str(ROOT/'docs/town-preview/city-night.png'))
        daylight()
        assert state() == before_night
        night()
        assert state() == before_night

        # A brush along a straight shore should create an irregular contour,
        # preserving its sand/water materials and the distant interiors.
        shore = project('Organic edges · sand shoreline')
        for y in range(83, 111):
            for x in range(112, 145):
                shore['cells'][f'{x},{y}'] = {'surface': 'sand' if x < 128 else 'water', 'level': 0}
        shore['spawn'] = {'x': 7900, 'y': 6144}
        load(shore, {'x': 8192, 'y': 6144, 'zoom': .7})
        daylight()
        page.locator('[data-tool="organic"]').click()
        page.locator('#brush').fill('4')
        if page.locator('#edgeStrength').count():
            page.locator('#edgeStrength').press('End')
        original = state()
        start, end = point(8192, 5680), point(8192, 6512)
        page.mouse.move(start['x'], start['y'])
        page.mouse.down()
        page.mouse.move(end['x'], end['y'], steps=60)
        page.mouse.up()
        page.wait_for_function('Object.values(townBuilder.project.cells).some(a=>a.curves?.some(q=>q.mask))')
        sculpted = state()
        assert sculpted != original
        contour = page.evaluate('''async url=>{
          const {surfaceAt,blocked,height}=await import(url),d=townBuilder.project,xs=[],water=[],land=[];
          for(let y=5730;y<6470;y+=12){let first=null;for(let x=8066;x<8320;x+=4){const surface=surfaceAt(d,x,y);if(surface==='water'&&first===null)first=x;if(surface==='water')water.push([x,y]);else if(surface==='sand')land.push([x,y]);}if(first!==null)xs.push(first);}
          return {min:Math.min(...xs),max:Math.max(...xs),distinct:new Set(xs).size,water:water.length,land:land.length,collisionWater:water.every(([x,y])=>blocked(d,x,y,townBuilder.catalog)),collisionLand:land.every(([x,y])=>!blocked(d,x,y,townBuilder.catalog)),heightSame:[...water,...land].every(([x,y])=>height(d,x,y)===0),inside:surfaceAt(d,7800,6100),outside:surfaceAt(d,8800,6100)};
        }''', dependencies['model'])
        assert contour['distinct'] >= 3 and contour['max']-contour['min'] >= 8, contour
        assert contour['water'] and contour['land'] and contour['collisionWater'] and contour['collisionLand'], contour
        assert contour['heightSame'] and contour['inside'] == 'sand' and contour['outside'] == 'water', contour
        page.screenshot(path=str(ROOT/'docs/town-preview/organic-shore.png'))
        page.locator('#undo').click()
        assert state() == original, 'One brush stroke did not undo as one edit.'
        page.locator('#redo').click()
        assert state() == sculpted

        with page.expect_download() as download_info:
            page.locator('#save').click()
        saved = Path(downloads)/'organic-shore.json'
        download_info.value.save_as(saved)
        assert saved.read_text().strip()
        assert json.loads(saved.read_text()) == json.loads(sculpted)
        page.evaluate('townBuilder.project.cells={}')
        page.locator('#file').set_input_files(str(saved))
        page.wait_for_function('Object.values(townBuilder.project.cells).some(a=>a.curves?.some(q=>q.mask))')
        assert state() == sculpted
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload()
        page.wait_for_function('window.townBuilder?.project.name==="Organic edges · sand shoreline"', timeout=90000)
        assert state() == sculpted
        night()
        page.locator('#walk').click()
        assert page.locator('#walk').inner_text() == 'Stop walk test'
        assert page.evaluate('townBuilder.night') is True
        page.wait_for_timeout(500)
        assert state() == sculpted
        page.locator('#walk').click()
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('JSON.stringify(townGame.project)') == sculpted
        assert page.evaluate('townGame.night') is True
        assert page.evaluate('Object.values(townGame.project.cells).some(a=>a.curves?.some(q=>q.mask))')
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Night and organic-shore browser checks passed: warm light pools, readable plans, wandering residents, unchanged map data, irregular physical shores, one-stroke undo, and portable play.')
