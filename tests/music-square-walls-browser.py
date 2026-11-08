"""Music Square extensions share native stonework and concrete uses large slabs."""
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
        assert page.locator('#barrier option[value="music-square"]').count() == 1
        assert page.locator('#musicWalls').count() == 1
        dependencies = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src,code=await(await fetch(entry)).text();
          const find=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],entry).href;
          const model=find('../world/model.mjs'),catalog=find('../world/catalog.mjs');
          const catalogCode=await(await fetch(catalog)).text();
          const road=new URL(catalogCode.split(String.fromCharCode(10)).find(line=>line.includes('urban-roads.mjs')).split("'")[1],catalog).href;
          const texture=new URL('urban-materials.mjs'+new URL(road).search,road).href;
          return {model,catalog,texture,geometry:find('music-wall-geometry.mjs'),runtime:find('../world/runtime.mjs')};
        }''')

        # Large slabs replace the small limestone pavers in both road assets
        # and terrain paint, at the same native material phase.
        concrete = page.evaluate('''async urls=>{
          const {urbanTextures}=await import(urls.texture),cv=urbanTextures.sidewalk,c=cv.getContext('2d'),data=c.getImageData(0,0,512,512).data;
          const mean=x=>{let total=0;for(let y=12;y<500;y++){const i=(y*512+x)*4;total+=(data[i]+data[i+1]+data[i+2])/3;}return total/488;};
          const fields=[64,192,320,448].map(mean),joints=[127,128,255,256,383,384].map(mean),oldJoints=[32,96,160,224].map(mean);
          const road=townBuilder.catalog.get('urban-road-straight-ns').canvas.getContext('2d');
          const exact=[[20,160],[64,224],[80,320]].every(([x,y])=>Array.from(road.getImageData(x,y,1,1).data).every((v,i)=>v===data[(y*512+x)*4+i]));
          return {fields,joints,oldJoints,exact,opaque:Array.from(data).filter((_,i)=>i%4===3).every(a=>a===255)};
        }''', dependencies)
        assert concrete['opaque'] and concrete['exact'], concrete
        assert sum(concrete['fields'])/4 > min(concrete['joints'])+15, concrete
        assert min(concrete['oldJoints']) > min(concrete['joints'])+10, concrete

        square = {'id': 'music-square-off-grid', 'asset': 'music-square', 'x': 8003, 'y': 6507, 'rotation': 0, 'scale': 1, 'layer': 'ground', 'collision': True}
        fixture = {'version': 1, 'name': 'Music Square · matching walls', 'cells': {}, 'edges': {}, 'objects': [square], 'spawn': {'x': 8003, 'y': 5600}}

        def load(doc):
            page.locator('#file').set_input_files({'name': 'music-walls.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.evaluate('Object.assign(townBuilder.cam,{x:8260,y:4950,zoom:.6})')

        def point(x, y):
            return page.evaluate('''({x,y})=>{
              const r=document.getElementById('map').getBoundingClientRect(),c=townBuilder.cam;
              return {x:r.x+r.width/2+(x-c.x)*c.zoom,y:r.y+r.height/2+(y-c.y)*c.zoom};
            }''', {'x': x, 'y': y})

        def drag(points):
            first = point(*points[0]);page.mouse.move(first['x'], first['y']);page.mouse.down()
            for x, y in points[1:]:
                current = point(x, y);page.mouse.move(current['x'], current['y'], steps=6)
            page.mouse.up()

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        load(fixture)
        before = state()
        page.locator('#musicWalls').click()
        assert page.evaluate('townBuilder.tool') == 'fence'
        assert page.locator('#barrier').input_value() == 'music-square'

        # A non-grid source post anchors an L-shaped wall. Neither end should
        # be rounded onto the usual64px world grid.
        start = (8003-1200+925*1.5625, 6507-1600+96*1.5625)
        corner = (start[0], start[1]-384)
        end = (corner[0]+384, corner[1])
        drag([start, corner, end])
        page.wait_for_function('Object.keys(townBuilder.project.edges).length>0')
        edges = page.evaluate('Object.entries(townBuilder.project.edges)')
        assert all(key.startswith('w:') and edge['style']=='music-square' for key, edge in edges), edges
        assert start[0] % 64 != 0
        shape = page.evaluate('''async({url,start,corner,end})=>{
          const {segment,blocked,parseProject}=await import(url),d=townBuilder.project,lines=Object.keys(d.edges).map(k=>segment(k));
          const near=(a,b)=>Math.abs(a-b)<.001;
          const contains=(x,y)=>lines.some(s=>near(x,s.x)&&y>=s.y-.001&&y<=s.y+s.dy+.001||near(y,s.y)&&x>=s.x-.001&&x<=s.x+s.dx+.001);
          const contacts=[start,corner,end].every(p=>contains(p[0],p[1]));
          return {contacts,collision:blocked(d,start[0],start[1]-190,townBuilder.catalog),entryOpen:!blocked(d,8003,5057,townBuilder.catalog),portable:!!parseProject(JSON.stringify(d),new Set(townBuilder.catalog.keys()))};
        }''', {'url': dependencies['model'], 'start': start, 'corner': corner, 'end': end})
        assert shape == {'contacts': True, 'collision': True, 'entryOpen': True, 'portable': True}, shape

        # Releasing and extending another stroke must retain the same offset.
        extension = (end[0]+128, end[1])
        drag([end, extension])
        ends = page.evaluate('''async url=>{const{segment}=await import(url);return Object.keys(townBuilder.project.edges).map(k=>segment(k));}''', dependencies['model'])
        assert any(abs(s['x']+s['dx']-extension[0])<.001 and abs(s['y']+s['dy']-extension[1])<.001 for s in ends), ends

        # Gate openings reuse this finish and remain actual physical openings.
        page.locator('[data-tool="gate"]').click()
        gate_end = (extension[0]+64, extension[1])
        drag([extension, gate_end])
        gate = page.evaluate('Object.entries(townBuilder.project.edges).find(([k,e])=>e.gate)')
        assert gate is not None, 'A single64px gate could not be dragged from the existing endpoint'
        gate_check = page.evaluate('''async({model,runtime,key})=>{
          const{segment,blocked}=await import(model),{toggleGate}=await import(runtime),d=townBuilder.project,s=segment(key),player={x:s.x+s.dx/2,y:s.y+s.dy/2};
          const closed=blocked(d,player.x,player.y,townBuilder.catalog);const changed=toggleGate(d,player),opened=!blocked(d,player.x,player.y,townBuilder.catalog);toggleGate(d,player);return{closed,changed,opened};
        }''', {'model': dependencies['model'], 'runtime': dependencies['runtime'], 'key': gate[0]})
        assert gate_check == {'closed': True, 'changed': True, 'opened': True}, gate_check

        complete = state()
        page.locator('#undo').click()
        assert not page.evaluate('Object.values(townBuilder.project.edges).some(e=>e.gate)')
        page.locator('#redo').click()
        assert state() == complete
        page.locator('[data-tool="select"]').click();page.mouse.move(10, 90)
        page.wait_for_timeout(250)
        page.screenshot(path=str(ROOT/'docs/town-preview/music-square-walls.png'))

        # Save/import/restore/play share the same edge geometry and pixels.
        with page.expect_download() as download:
            page.locator('#save').click()
        project_path=Path(downloads)/'music-square-wall-project.json';download.value.save_as(str(project_path))
        exported=json.loads(project_path.read_text())
        assert exported['edges'] and exported['objects']==fixture['objects']
        page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
        page.reload();page.wait_for_function('window.townBuilder?.project.name==="Music Square · matching walls"', timeout=90000)
        assert page.evaluate('townBuilder.project.edges') == exported['edges']
        page.evaluate('townBuilder.project.edges={}')
        page.locator('#file').set_input_files(str(project_path))
        page.wait_for_function('(count)=>Object.keys(townBuilder.project.edges).length===count', arg=len(exported['edges']))
        page.locator('#play').click();page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('townGame.project.edges') == exported['edges']
        motion = page.evaluate('''async({model,runtime,start})=>{
          const{movePlayer}=await import(runtime),p={x:start[0]-110,y:start[1]-190};
          for(let i=0;i<60;i++)movePlayer(townGame.project,p,new Set(['d']),1/60,townGame.catalog);
          return p.x<start[0]-10;
        }''', {'model': dependencies['model'], 'runtime': dependencies['runtime'], 'start': start})
        assert motion, 'Walk movement crossed the attached stone wall'
        page.evaluate('p=>Object.assign(townGame.player,p)', {'x': start[0]-110, 'y': start[1]-190})
        page.locator('#world').focus();page.keyboard.down('d');page.wait_for_timeout(450);page.keyboard.up('d')
        assert page.evaluate('townGame.player.x') < start[0]-10, 'Actual keyboard movement crossed the attached wall'
        page.get_by_role('button', name='Town Builder', exact=True).click();page.wait_for_function('!!window.townBuilder', timeout=90000)

        wall_assets = page.evaluate('Array.from(townBuilder.catalog.values()).filter(a=>a.barrierStyle==="music-square").map(a=>a.id)')
        assert wall_assets, 'Matching wall missing from asset library'
        page.locator('#urbanKit').click();page.locator('#search').fill(wall_assets[0]);page.locator('[data-asset="'+wall_assets[0]+'"]').click()
        assert page.evaluate('townBuilder.tool') == 'fence'
        assert page.locator('#barrier').input_value() == 'music-square'
        with page.expect_download(timeout=180000) as kit_download:
            page.locator('#urbanPack').click()
        zip_path=Path(downloads)/'music-wall-kit.zip';kit_download.value.save_as(str(zip_path))
        with zipfile.ZipFile(zip_path) as archive:
            catalog={a['id']:a for a in json.loads(archive.read('catalog.json'))}
            for asset in wall_assets:
                assert catalog[asset]['barrierStyle']=='music-square'
                assert 'assets/'+asset+'.png' in archive.namelist()

        # A small street arrangement shows a full slab across each sidewalk
        # beside the real110px character, with no small beige paving tiles.
        page.evaluate('''()=>{
          const d=townBuilder.project;d.objects=[{id:'concrete-road',asset:'urban-road-straight-ns',x:8192,y:6656,scale:1,rotation:0,layer:'ground',collision:false}];d.cells={};d.edges={};d.name='Concrete sidewalks · large slabs';document.getElementById('name').value=d.name;
          d.spawn={x:7744,y:6200};townBuilder.cam.x=7990;townBuilder.cam.y=6144;townBuilder.cam.zoom=.8;
        }''')
        page.locator('#walk').click();page.wait_for_timeout(300)
        page.screenshot(path=str(ROOT/'docs/town-preview/concrete-sidewalks.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Music Square wall browser checks passed: native attachment, corners, continued runs, gates, collision, persistence, export, and large concrete slabs.')
