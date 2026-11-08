"""Road lighting, live water, sand tracks and authored piers share the real preview."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import argparse
import json
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--without-pier', action='store_true', help='Check the integrated night/motion features while the pier UI is being built.')
args = parser.parse_args()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def project(name, surface=None):
    d = {'version': 1, 'name': name, 'cells': {}, 'edges': {}, 'objects': [], 'spawn': {'x': 7900, 'y': 6144}}
    if surface:
        for y in range(84, 110):
            for x in range(112, 145):
                d['cells'][f'{x},{y}'] = {'surface': surface, 'level': 0}
    return d


def put(d, asset, x, y, layer='objects', collision=True):
    d['objects'].append({'id': f'fixture-{len(d["objects"])}', 'asset': asset, 'x': x, 'y': y, 'scale': 1, 'rotation': 0, 'layer': layer, 'collision': collision})


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
        if page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        urls = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src;
          const resolve=async(url,needle)=>{const code=await(await fetch(url)).text(),line=code.split(String.fromCharCode(10)).find(line=>line.includes(needle));if(!line)throw Error('Missing '+needle+' in '+url);return new URL(line.split("'")[1],url).href;};
          const model=await resolve(entry,'../world/model.mjs'),runtime=await resolve(entry,'../world/runtime.mjs'),renderer=await resolve(runtime,'./render.mjs');
          return {model,runtime,renderer,night:await resolve(renderer,'./city-night.mjs'),water:await resolve(renderer,'./water-motion.mjs'),footprints:await resolve(entry,'../world/sand-footprints.mjs'),brush:await resolve(entry,'./ground-brush.mjs')};
        }''')

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def load(d, camera=None):
            page.locator('#file').set_input_files({'name': 'night-motion.json', 'mimeType': 'application/json', 'buffer': json.dumps(d).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=d['name'])
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.evaluate('camera=>Object.assign(townBuilder.cam,camera)', camera or {'x': 8192, 'y': 6144, 'zoom': .8})

        def daylight():
            if page.evaluate('townBuilder.night'):
                page.locator('#lightingToggle').click()

        def night():
            if not page.evaluate('townBuilder.night'):
                page.locator('#lightingToggle').click()

        def point(x, y):
            return page.evaluate('''async({x,y,url})=>{const{height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),c=townBuilder.cam,z=document.getElementById('heightView').value==='plan'?0:height(townBuilder.project,x,y);return{x:r.x+r.width/2+(x-c.x)*c.zoom,y:r.y+r.height/2+(y-z-c.y)*c.zoom};}''', {'x': x, 'y': y, 'url': urls['model']})

        # Large road fixtures have a physical foot, not a solid pole-sized wall.
        asset_ids = ['urban-roadlight-heritage', 'urban-roadlight-double', 'urban-roadlight-neon', 'urban-uplight-warm', 'urban-uplight-cyan', 'urban-uplight-magenta']
        lights = page.evaluate('''ids=>ids.map(id=>{const a=townBuilder.catalog.get(id);return a&&{id,w:a.w,h:a.h,kit:a.kit,boxes:a.boxes,emitters:a.lightEmitters};})''', asset_ids)
        assert all(lights), lights
        for a in lights[:3]:
            assert a['h'] >= 650 and a['kit'] == 'urban', a
            assert len(a['boxes']) == 1 and a['boxes'][0]['h'] < a['h']*.1, a
            assert a['boxes'][0]['y'] >= a['h']*.9, a
            assert a['emitters'] and all(e['kind'] == 'lamp' for e in a['emitters']), a
        for a in lights[3:]:
            assert a['boxes'] == [] and a['emitters'][0]['kind'] == 'uplight', a
            assert a['emitters'][0]['beamHeight'] > 300, a
        page.locator('#search').fill('road light')
        assert all(page.locator('[data-asset="'+asset+'"] ').count() for asset in asset_ids[:3])
        page.locator('#search').fill('')

        # Assess upward illumination on a constant facade, without bright art
        # pixels being mistaken for the emitted bloom itself.
        illumination = page.evaluate('''async({url})=>{
          const {renderCityNight,cityLights}=await import(url),catalog=townBuilder.catalog,w=700,h=700,cam={x:8192,y:6144,zoom:1};
          const doc={version:1,name:'Uplight field',cells:{},edges:{},objects:[{asset:'urban-uplight-cyan',x:8192,y:6280,scale:1,rotation:0}],spawn:{x:8192,y:6144}};
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');c.fillStyle='#62676d';c.fillRect(0,0,w,h);renderCityNight(c,doc,cam,w,h,0,{catalog});
          const data=c.getImageData(0,0,w,h).data,sample=(X,Y)=>{const x=Math.round(w/2+X-cam.x),y=Math.round(h/2+Y-cam.y),out=[0,0,0];for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const i=((y+dy)*w+x+dx)*4;for(let j=0;j<3;j++)out[j]+=data[i+j]/81;}return out;};
          return {above:sample(8192,6090),below:sample(8192,6440),lights:cityLights(doc,catalog)};
        }''', {'url': urls['night']})
        assert illumination['above'][1] > illumination['below'][1]+5, illumination
        assert illumination['above'][2] > illumination['above'][0]+8, illumination
        gazebo_glow = page.evaluate('''async({url})=>{
          const {renderCityNight,cityLights}=await import(url),catalog=townBuilder.catalog,a=catalog.get('props-4-960'),w=1400,h=1400,cam={x:8192,y:6280-a.h/2,zoom:1};
          const doc={version:1,name:'Gazebo field',cells:{},edges:{},objects:[{asset:a.id,x:8192,y:6280,scale:1,rotation:0}],spawn:{x:8192,y:6144}},lights=cityLights(doc,catalog);
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;const c=cv.getContext('2d');c.fillStyle='#62676d';c.fillRect(0,0,w,h);renderCityNight(c,doc,cam,w,h,0,{catalog});
          const data=c.getImageData(0,0,w,h).data,sample=(X,Y)=>{const x=Math.round(w/2+X-cam.x),y=Math.round(h/2+Y-cam.y),i=(y*w+x)*4;return Array.from(data.slice(i,i+3));};
          return {heads:lights.filter(l=>l.kind==='lamp').map(l=>sample(l.x,l.y)),far:sample(8192-650,cam.y)};
        }''', {'url': urls['night']})
        assert len(gazebo_glow['heads']) == 4, gazebo_glow
        assert all(rgb[0] > rgb[2]+8 and rgb[0] > gazebo_glow['far'][0]+30 for rgb in gazebo_glow['heads']), gazebo_glow

        city = project('Coda Town · boulevard and arcade lights')
        for y in range(60, 125):
            for x in range(78, 187):
                city['cells'][f'{x},{y}'] = {'surface': 'asphalt', 'level': 0}
        for y in range(111, 115):
            for x in range(78, 187):
                city['cells'][f'{x},{y}'] = {'surface': 'sidewalk', 'level': 0, 'sidewalkCurb': True}
        put(city, 'coda-arcade', 7600, 7000)
        put(city, 'props-4-960', 10660, 6550)
        put(city, 'urban-roadlight-heritage', 5860, 7360)
        put(city, 'urban-roadlight-double', 9560, 7360)
        put(city, 'urban-roadlight-neon', 10960, 7360)
        put(city, 'urban-uplight-cyan', 6960, 6870, collision=False)
        put(city, 'urban-uplight-magenta', 8300, 6880, collision=False)
        put(city, 'urban-uplight-warm', 10580, 6530, collision=False)
        load(city, {'x': 8350, 'y': 5770, 'zoom': .20})
        night()
        city_before = state()
        emitted = page.evaluate('''async({url})=>{const{cityLights}=await import(url),d=townBuilder.project,c=townBuilder.catalog;const one=id=>cityLights(d,c,d.objects.filter(o=>o.asset===id));return {arcade:one('coda-arcade'),gazebo:one('props-4-960'),uplights:cityLights(d,c).filter(l=>l.kind==='uplight'),house:cityLights(d,c,[{asset:'estate-bach',x:8192,y:6144,scale:1,rotation:0}])};}''', {'url': urls['night']})
        neon = [e for e in emitted['arcade'] if e['kind'] == 'neon']
        assert len(neon) >= 10 and len({tuple(e['color']) for e in neon}) >= 2, emitted
        assert len(emitted['gazebo']) >= 8 and emitted['house'], emitted
        assert len(emitted['uplights']) == 3
        page.wait_for_timeout(200)
        page.screenshot(path=str(ROOT/'docs/town-preview/night-lights.png'))
        assert state() == city_before, 'Lighting modified the saved map.'
        render_cost = page.evaluate('''async({url})=>{
          const {render}=await import(url),d=townBuilder.project,cv=document.createElement('canvas');cv.width=1000;cv.height=720;const c=cv.getContext('2d'),times=[];
          for(let i=-2;i<8;i++){const start=performance.now();render(c,d,{x:8350+i*12,y:5770+i*4,zoom:.25},1000,720,{night:true,time:0});c.getImageData(0,0,1,1);if(i>=0)times.push(performance.now()-start);}
          return {mean:times.reduce((a,b)=>a+b,0)/times.length,max:Math.max(...times)};
        }''', {'url': urls['runtime']})
        assert render_cost['mean'] < 160 and render_cost['max'] < 450, render_cost

        # Rendering at two times moves only the water, with a repeatable loop.
        motion = page.evaluate('''async({runtime,model})=>{
          const {render}=await import(runtime),{height,blocked}=await import(model),d={version:1,name:'Animated shore',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};
          for(let y=90;y<=102;y++)for(let x=120;x<=137;x++)d.cells[x+','+y]={surface:x<129?'water':'sand',level:0};
          const before=JSON.stringify(d),w=880,h=640,cam={x:8192,y:6144,zoom:1};
          const shot=time=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;render(cv.getContext('2d'),d,cam,w,h,{time,night:false});return cv.getContext('2d').getImageData(0,0,w,h).data;};
          const a=shot(0),b=shot(3.25),loop=shot(15.25);let dry=0,wet=0,repeat=0;
          for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x-w/2+cam.x,Y=y-h/2+cam.y,i=(y*w+x)*4,water=d.cells[Math.floor(X/64)+','+Math.floor(Y/64)]?.surface==='water';if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){if(water)wet++;else dry++;}for(let j=0;j<4;j++)if(b[i+j]!==loop[i+j])repeat++;}
          return {dry,wet,repeat,same:before===JSON.stringify(d),waterBlocked:blocked(d,8100,6144,new Map()),sandClear:!blocked(d,8400,6144,new Map()),height:height(d,8100,6144)};
        }''', {'runtime': urls['runtime'], 'model': urls['model']})
        assert motion['dry'] == 0 and motion['wet'] > 30000 and motion['repeat'] == 0, motion
        assert motion['same'] and motion['waterBlocked'] and motion['sandClear'] and motion['height'] == 0, motion

        # Real WASD movement emits temporary tracks, without painting terrain.
        sand = project('Sand · temporary walking tracks', 'sand')
        load(sand)
        daylight()
        sand_before = state()
        page.locator('#walk').click()
        page.locator('#map').focus()
        page.keyboard.down('d')
        page.wait_for_timeout(1250)
        page.keyboard.up('d')
        page.wait_for_function('townBuilder.footprints.marks.length>=4')
        tracks = page.evaluate('''async({runtime})=>{
          const {render}=await import(runtime),b=townBuilder,d=b.project,t=performance.now()/1000,w=900,h=520,cam={x:b.cam.x-120,y:b.cam.y,zoom:1};
          const shot=withTracks=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;render(cv.getContext('2d'),d,cam,w,h,{time:t,night:false,...(withTracks?{drawFootprints:(c,d,t)=>b.footprints.draw(c,d,t)}:{})});return cv.getContext('2d').getImageData(0,0,w,h).data;};
          const a=shot(false),c=shot(true);let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==c[i]||a[i+1]!==c[i+1]||a[i+2]!==c[i+2])changed++;return {count:b.footprints.marks.length,changed};
        }''', {'runtime': urls['runtime']})
        assert tracks['count'] >= 4 and tracks['changed'] > 40, tracks
        assert state() == sand_before, 'Footsteps were saved into terrain.'
        page.wait_for_function('townBuilder.footprints.marks.length===0', timeout=7000)
        assert state() == sand_before
        page.locator('#walk').click()
        dirt = project('Dirt · no sand tracks', 'dirt')
        load(dirt)
        page.locator('#walk').click()
        page.locator('#map').focus()
        page.keyboard.down('d');page.wait_for_timeout(600);page.keyboard.up('d')
        assert page.evaluate('townBuilder.footprints.marks.length') == 0
        page.locator('#walk').click()

        # The pier is an authored elevated deck over an unchanged water floor.
        if not args.without_pier:
            assert page.locator('[data-tool="pier"]').count() == 1
            pier = project('Timber pier · shore to ocean')
            for y in range(90, 110):
                for x in range(120, 141):
                    pier['cells'][f'{x},{y}'] = {'surface': 'sand' if y <= 94 else 'water', 'level': 1 if y <= 94 else 0}
            pier['spawn'] = {'x': 8192, 'y': 94.5*64}
            load(pier, {'x': 8192, 'y': 6320, 'zoom': .9})
            page.locator('[data-tool="pier"]').click()
            page.locator('#brush').fill('2')
            start, end = point(8192, 94.5*64), point(8192, 103.5*64)
            before = state()
            page.mouse.move(start['x'], start['y']);page.mouse.down()
            page.mouse.move(end['x'], end['y'], steps=30)
            assert state() == before, 'The live preview changed the authored map before release.'
            page.mouse.up()
            page.wait_for_function('Object.values(townBuilder.project.cells).some(a=>a.pier)')
            after = state()
            deck = page.evaluate('''async url=>{const{height,blocked}=await import(url),d=townBuilder.project,piers=Object.entries(d.cells).filter(([k,a])=>a.pier);return {piers,deckHeight:height(d,8192,100.5*64),deckClear:!blocked(d,8192,100.5*64,townBuilder.catalog),waterBlocked:blocked(d,8500,100.5*64,townBuilder.catalog)};}''', urls['model'])
            assert len(deck['piers']) >= 9 and deck['deckHeight'] == 48 and deck['deckClear'] and deck['waterBlocked'], deck
            for key, a in deck['piers']:
                if int(key.split(',')[1]) > 94:
                    assert a['surface'] == 'water' and a['level'] == 0 and a['pier']['level'] == 1, (key, a)
            page.locator('#undo').click();assert state() == before
            page.locator('#redo').click();assert state() == after
            page.locator('#walk').click()
            page.locator('#map').focus()
            page.keyboard.down('s');page.wait_for_timeout(1100);page.keyboard.up('s')
            walked = page.evaluate('townBuilder.cam.y')
            assert walked > 6250, walked
            page.locator('#walk').click()
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6320,zoom:.9})')
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.screenshot(path=str(ROOT/'docs/town-preview/pier.png'))
            with page.expect_download() as info:
                page.locator('#save').click()
            path = Path(downloads)/'pier.json';info.value.save_as(path)
            assert json.loads(path.read_text()) == json.loads(after)
            page.reload();page.wait_for_function("!!window.townBuilder&&townBuilder.project.name==='Timber pier · shore to ocean'", timeout=90000)
            assert json.loads(state()) == json.loads(after)
            page.locator('#play').click();page.wait_for_function('!!window.townGame', timeout=90000)
            assert page.evaluate('JSON.stringify(townGame.project)') == after
        assert not errors, errors
        print('Night/motion/pier browser checks passed:', {'lights': len(lights), 'neon': len(neon), 'renderMs': render_cost, 'water': motion, 'tracks': tracks, 'pier': not args.without_pier})
        context.close()
        browser.close()
finally:
    server.shutdown()
