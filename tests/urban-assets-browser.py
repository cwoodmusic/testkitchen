"""Urban buildings, road modules, materials and street props remain builder assets."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import threading
import zipfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


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
        assert page.locator('#category').input_value() == '@urban'
        assert page.locator('[data-asset="coda-residences"]').count() == 1
        assert page.locator('[data-asset="coda-furnishings"]').count() == 1
        props = json.loads((ROOT/'town/assets/urban/street-details.json').read_text())['items']
        for prop in props:
            assert page.locator(f'[data-asset="{prop["id"]}"]').count() == 1
        road_ids = page.evaluate('Array.from(townBuilder.catalog.values()).filter(a=>a.roadOpen).map(a=>a.id)')
        assert len(road_ids) == 15
        assert page.locator('[data-asset^="urban-road-"]').count() == 15
        assert page.locator('[data-asset^="urban-paint-"]').count() == 3
        assert page.evaluate('townBuilder.catalog.get("urban-hydrant-red").h') > 60
        assert page.evaluate('townBuilder.catalog.get("urban-hydrant-red").h') < 110
        assert page.evaluate('townBuilder.catalog.get("urban-manhole-lyre").boxes.length') == 0

        # A kit is a library filter: opening it never replaces the current map.
        fixture = {'version': 1, 'name': 'Urban asset preservation fixture', 'cells': {'0,0': {'surface': 'wood', 'level': 1}}, 'edges': {}, 'objects': [], 'spawn': {'x': 8192, 'y': 6144}}
        page.locator('#file').set_input_files({'name': 'urban-assets.json', 'mimeType': 'application/json', 'buffer': json.dumps(fixture).encode()})
        page.wait_for_function('townBuilder.project.name==="Urban asset preservation fixture"')
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        saved = page.evaluate('JSON.stringify(townBuilder.project)')
        page.locator('#allAssets').click()
        assert page.locator('#category').input_value() == ''
        assert page.locator('.asset').count() == page.evaluate('townBuilder.catalog.size')
        page.locator('#urbanKit').click()
        assert page.locator('#category').input_value() == '@urban'
        assert page.evaluate('JSON.stringify(townBuilder.project)') == saved
        page.reload()
        page.wait_for_function('window.townBuilder?.project.name==="Urban asset preservation fixture"', timeout=90000)
        assert page.evaluate('JSON.stringify(townBuilder.project)') == saved

        def world_point(x, y):
            return page.evaluate('''({x,y})=>{
              const r=document.getElementById('map').getBoundingClientRect(),c=townBuilder.cam;
              return {x:r.x+r.width/2+(x-c.x)*c.zoom,y:r.y+r.height/2+(y-c.y)*c.zoom};
            }''', {'x': x, 'y': y})

        def click_world(x, y):
            point = world_point(x, y)
            page.mouse.click(point['x'], point['y'])

        def asset(asset_id):
            page.locator('#search').fill(asset_id)
            button = page.locator(f'[data-asset="{asset_id}"]')
            button.click()
            page.wait_for_function('townBuilder.tool==="place"')

        # The placement controls honor dimensions, grid snapping and collisions.
        asset('urban-road-straight-ew')
        click_world(8051, 6201)
        road = page.evaluate('({...townBuilder.project.objects.at(-1)})')
        assert road['asset'] == 'urban-road-straight-ew'
        assert road['x'] % 512 == road['y'] % 512 == 0
        assert road['layer'] == 'ground' and not road['collision']
        page.locator('#duplicate').click()
        duplicate = page.evaluate('({...townBuilder.project.objects.at(-1)})')
        assert duplicate['x'] == road['x']+512
        assert duplicate['y'] == road['y']+512
        assert duplicate['x'] % 512 == duplicate['y'] % 512 == 0
        page.locator('#rotation').select_option('90')
        assert page.evaluate('townBuilder.project.objects.at(-1).rotation') == 90

        asset('urban-hydrant-red')
        click_world(7800, 6400)
        hydrant = page.evaluate('({...townBuilder.project.objects.at(-1)})')
        assert hydrant['asset'] == 'urban-hydrant-red'
        assert hydrant['collision'] and hydrant['layer'] == 'objects'
        asset('urban-manhole-lyre')
        click_world(8200, 6400)
        manhole = page.evaluate('({...townBuilder.project.objects.at(-1)})')
        assert not manhole['collision'] and manhole['layer'] == 'ground'
        collision = page.evaluate('''async()=>{
          const url=Array.from(document.querySelectorAll('script[src]')).find(s=>s.src.includes('/app.mjs')).src;
          const token=new URL(url).search;
          const {blocked}=await import('/town/world/model.mjs'+token);
          const d=townBuilder.project,c=townBuilder.catalog,h=d.objects.find(o=>o.asset==='urban-hydrant-red'),a=c.get(h.asset),b=a.boxes[0],m=d.objects.find(o=>o.asset==='urban-manhole-lyre');
          return {hydrant:blocked(d,h.x-a.w/2+b.x+b.w/2,h.y-a.h+b.y+b.h/2,c),manhole:blocked(d,m.x,m.y-20,c)};
        }''')
        assert collision == {'hydrant': True, 'manhole': False}

        # Material swatches activate the existing real terrain brush, preserving
        # square tiles, soft painting and blending as alternatives.
        for index, material in enumerate(['asphalt', 'sidewalk', 'brick']):
            page.locator('#search').fill('urban-paint-'+material)
            page.locator('[data-asset="urban-paint-'+material+'"]').click()
            assert page.evaluate('townBuilder.tool') == 'ground'
            assert page.locator('#surface').input_value() == material
            assert page.locator('#groundShape').input_value() == 'square'
            page.locator('#brush').fill('2')
            click_world(7600+index*240, 6800)
        painted = page.evaluate('''()=>{
          const surfaces=Object.values(townBuilder.project.cells).map(c=>c.surface);
          return ['asphalt','sidewalk','brick'].every(s=>surfaces.includes(s));
        }''')
        assert painted
        page.locator('#groundShape').select_option('round')
        page.locator('#brush').fill('3')
        page.locator('#surface').select_option('asphalt')
        click_world(8000, 6740)
        page.locator('[data-tool="blend"]').click()
        click_world(8000, 6800)
        assert page.locator('#groundShape').input_value() == 'round'
        assert page.evaluate('Object.values(townBuilder.project.cells).some(c=>c.paint)')

        # Downloaded maps and authored play retain those precise placed assets
        # and new ground material masks rather than a generated city scene.
        with page.expect_download() as project_download:
            page.locator('#save').click()
        project_path = Path(downloads)/'urban-builder-project.json'
        project_download.value.save_as(str(project_path))
        exported = json.loads(project_path.read_text())
        assert exported['name'] == fixture['name']
        assert any(o['asset'] == 'urban-hydrant-red' for o in exported['objects'])
        assert any(c['surface'] == 'sidewalk' for c in exported['cells'].values())
        page.evaluate('townBuilder.project.objects.length=0;townBuilder.project.cells={};')
        page.locator('#file').set_input_files(str(project_path))
        page.wait_for_function('(count)=>townBuilder.project.objects.length===count', arg=len(exported['objects']))
        assert page.evaluate('townBuilder.project.cells') == exported['cells']
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('townGame.project.name') == fixture['name']
        assert page.evaluate('townGame.project.objects.some(o=>o.asset==="urban-hydrant-red")')
        page.get_by_role('button', name='Town Builder', exact=True).click()
        page.wait_for_function('window.townBuilder?.project.name==="Urban asset preservation fixture"', timeout=90000)

        # The dedicated kit exports native images, new ground materials, and
        # usable anchors/connection/collision metadata without unrelated packs.
        assert page.locator('#urbanPack').count() == 1
        with page.expect_download(timeout=180000) as asset_download:
            page.locator('#urbanPack').click()
        archive_path = Path(downloads)/'coda-urban-kit.zip'
        asset_download.value.save_as(str(archive_path))
        with zipfile.ZipFile(archive_path) as archive:
            names = set(archive.namelist())
            for name in ['assets/coda-residences.png', 'assets/coda-furnishings.png', 'assets/urban-hydrant-red.png', 'assets/urban-manhole-lyre.png', 'assets/urban-road-straight-ew.png', 'ground/asphalt.png', 'ground/sidewalk.png', 'ground/brick.png']:
                assert name in names, name
            metadata = json.loads(archive.read('catalog.json'))
            by_id = {a['id']: a for a in metadata}
            assert by_id['urban-road-straight-ew']['snap'] == 512
            assert by_id['urban-road-straight-ew']['connections'] == ['east', 'west']
            assert by_id['urban-paint-asphalt']['paintSurface'] == 'asphalt'
            assert by_id['urban-hydrant-red']['collision']
            assert not by_id['urban-manhole-lyre']['collision']
            assert 'trees-0-320' not in by_id

        # A deliberately small asset arrangement makes native street modules
        # and individual urban props visible at their actual in-game scale.
        page.evaluate('''()=>{
          const d=townBuilder.project;d.objects=[];d.cells={};d.edges={};d.name='Urban asset kit · street pieces';document.getElementById('name').value=d.name;
          const put=(asset,x,y,rotation=0)=>{const a=townBuilder.catalog.get(asset);d.objects.push({id:'review-'+d.objects.length,asset,x,y,rotation,scale:1,layer:a.layer,collision:a.collisionDefault??a.boxes.length>0});};
          put('urban-road-straight-ew',7168,6144);put('urban-road-crossroads',8192,6144);put('urban-road-corner-sw',9216,6144);put('urban-road-straight-ns',8192,5120);
          put('urban-crosswalk',8192,5920);put('urban-hydrant-red',7670,6110);put('urban-hydrant-teal',8820,6100);put('urban-manhole-lyre',8170,5750);put('urban-manhole-iron',8980,5720);put('urban-storm-drain',7540,6040);put('urban-bollard',7780,6095);put('urban-bollard',8600,6095);put('urban-parking-meter',7350,6100);put('urban-trash-can',9060,6100);put('urban-bus-stop',9375,6095);put('urban-street-planter',9360,5250);
          d.spawn={x:8192,y:5800};townBuilder.cam.x=8192;townBuilder.cam.y=5570;townBuilder.cam.zoom=.43;
        }''')
        page.locator('#urbanKit').click()
        page.locator('[data-tool="select"]').click()
        page.mouse.move(20, 200)
        page.wait_for_timeout(250)
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-assets-kit.png'))
        page.locator('#search').fill('urban-')
        page.locator('#category').select_option('urban street details')
        page.wait_for_timeout(250)
        page.screenshot(path=str(ROOT/'docs/town-preview/urban-street-kit.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Urban asset kit browser checks passed: library, map preservation, snapped roads, street collisions, terrain paint/blend, playable maps, and portable urban ZIP.')
