"""Freehand ground painting, material blending and playable-map parity."""
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
        urls = page.evaluate('''async()=>{
          const url=document.querySelector('script[type="module"]').src,code=await(await fetch(url)).text();
          const dependency=name=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],url).href;
          return {runtime:dependency('runtime'),brush:dependency('ground-brush'),version:new URL(url).search};
        }''')

        def project(name, cells=None):
            return {'version':1,'name':name,'cells':cells or {},'edges':{},'objects':[],'spawn':{'x':8192,'y':6400}}

        def load(doc):
            page.locator('#file').set_input_files({'name':'ground.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name',arg=doc['name'])
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')

        def set_range(selector, value):
            page.locator(selector).evaluate('(el,value)=>{el.value=value;el.dispatchEvent(new Event("input",{bubbles:true}));}',str(value))

        def settings(size=3, hardness=45, opacity=100):
            page.locator('#brush').fill(str(size))
            set_range('#brushHardness',hardness)
            set_range('#brushOpacity',opacity)
            assert page.locator('#brushHardnessValue').inner_text()==f'{hardness}%'
            assert page.locator('#brushOpacityValue').inner_text()==f'{opacity}%'

        def point(x,y):
            box=page.locator('#map').bounding_box()
            return (box['x']+box['width']/2+(x-8192)*.7,box['y']+box['height']/2+(y-6144)*.7)

        def click(x,y):
            page.mouse.click(*point(x,y))

        def stroke(a,b,steps=1):
            page.mouse.move(*point(*a));page.mouse.down();page.mouse.move(*point(*b),steps=steps);page.mouse.up()

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project.cells)')

        def weight(x,y,surface):
            return page.evaluate('''({x,y,surface})=>{
              const a=townBuilder.project.cells[Math.floor(x/64)+','+Math.floor(y/64)]||{surface:'grass'};
              if(!a.paint)return a.surface===surface?255:0;
              const p=a.paint,i=p.materials.findIndex(m=>m.surface===surface);
              if(i<0)return 0;
              const values=atob(p.weights),gx=Math.floor((x%64)/4),gy=Math.floor((y%64)/4);
              return values.charCodeAt((gy*16+gx)*p.materials.length+i);
            }''',{'x':x,'y':y,'surface':surface})

        capture='''async({url,game=false})=>{
          const{render}=await import(url),c=document.createElement('canvas');c.width=320;c.height=210;
          const g=c.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;
          render(g,game?townGame.project:townBuilder.project,{x:8192,y:6144,zoom:.85},640,420);
          return c.toDataURL();
        }'''

        load(project('Round ground brush'))
        page.locator('[data-tool="ground"]').click();page.locator('#surface').select_option('dirt')
        assert page.locator('#groundBrushSettings').is_visible()
        assert 'water' not in page.locator('#surface option').evaluate_all('(options)=>options.map(o=>o.value)')
        settings(hardness=30,opacity=65);click(8032,6304)
        center=weight(8032,6304,'dirt');edge=weight(8116,6304,'dirt')
        assert center>120 and 0<edge<center/2,(center,edge)
        assert weight(8112,6384,'dirt')==0, 'Round brush filled a corner outside its circle.'
        assert weight(8128,6304,'dirt')==0, 'Round brush painted beyond its radius.'
        round_state=state();page.locator('#undo').click();assert state()=='{}'
        page.locator('#redo').click();assert state()==round_state
        page.locator('#undo').click();settings(hardness=100,opacity=65);click(8032,6304)
        assert weight(8116,6304,'dirt')>edge+80, 'Hardness did not change edge coverage.'
        page.locator('#undo').click();settings(hardness=100,opacity=20);click(8032,6304)
        low=weight(8032,6304,'dirt');page.locator('#undo').click()
        settings(hardness=100,opacity=100);click(8032,6304)
        assert weight(8032,6304,'dirt')>low+150, 'Opacity did not change paint strength.'

        # A single long pointer event must produce an unbroken narrow stroke,
        # and the complete interpolated stroke must remain one undo action.
        load(project('Continuous ground brush'));page.locator('[data-tool="ground"]').click()
        settings(size=1,hardness=100,opacity=100);before=state()
        stroke((7920,6260),(8464,6260),steps=1)
        for x in range(7920,8465,16):assert weight(x,6260,'dirt')>245, ('Gap in fast stroke',x)
        assert weight(8192,6300,'dirt')==0
        after=state();page.locator('#undo').click();assert state()==before
        page.locator('#redo').click();assert state()==after
        # Pan with the right button must not stamp a hidden first dab.
        page.mouse.move(*point(8192,6260));page.mouse.down(button='right');page.mouse.move(*point(8240,6260));page.mouse.up(button='right')
        assert state()==after,'Right-drag pan changed paint.'
        page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')

        # A softer multi-material freehand curve supplies a real-art preview.
        load(project('Soft ground preview'));page.locator('[data-tool="ground"]').click()
        settings(size=2.75,hardness=30,opacity=70);page.locator('#surface').select_option('dirt')
        page.mouse.move(*point(7890,6200));page.mouse.down()
        for pos in [(8000,6060),(8160,6070),(8280,6200),(8450,6250)]:page.mouse.move(*point(*pos),steps=8)
        page.mouse.up()
        settings(size=1.25,hardness=35,opacity=80);page.locator('#surface').select_option('cobble')
        stroke((7960,6310),(8400,6310),steps=12)
        soft_image=page.evaluate(capture,{'url':urls['runtime']})

        cells={f'{x},{y}':{'surface':'dirt','level':0} for x in range(122,128) for y in range(90,104)}
        load(project('Blend old ground boundary',cells));before_blend=page.evaluate(capture,{'url':urls['runtime']})
        assert weight(8186,6144,'dirt')==255 and weight(8198,6144,'dirt')==0
        page.locator('[data-tool="blend"]').click();settings(size=4,hardness=60,opacity=85)
        old_state=state();stroke((8192,6000),(8192,6290),steps=8)
        left,right=weight(8186,6144,'dirt'),weight(8198,6144,'dirt')
        assert 40<left<245 and 10<right<210,('Boundary did not mix both ways',left,right)
        blended=state();after_blend=page.evaluate(capture,{'url':urls['runtime']})
        assert before_blend!=after_blend,'Blended weights did not change actual rendering.'
        page.locator('#undo').click();assert state()==old_state
        page.locator('#redo').click();assert state()==blended

        # Brushes preserve traversability and elevation; these cells must be
        # protected even when a large soft stamp overlaps them.
        protected=page.evaluate('''async url=>{
          const{paintGround}=await import(url),d={version:1,name:'Protected',objects:[],edges:{},spawn:{x:8192,y:6400},cells:{
            '127,95':{surface:'water',level:0},'128,95':{surface:'cobble',level:0,stairs:'north'},
            '127,96':{surface:'water',level:0,bridge:'ns'},'128,96':{surface:'dirt',level:3}}};
          const preserved=['127,95','128,95','127,96'].map(k=>JSON.stringify(d.cells[k]));
          for(const mode of ['paint','blend'])for(const[k,a]of paintGround(d,{x:8192,y:6144},{size:512,hardness:.5,opacity:1,surface:'sand',mode}).edits)d.cells[k]=a;
          return preserved.every((v,i)=>v===JSON.stringify(d.cells[['127,95','128,95','127,96'][i]]))&&d.cells['128,96'].level===3;
        }''',urls['brush'])
        assert protected,'Brush changed protected water, steps, bridges or elevation.'

        # Portable export and autosave use the same validated project format.
        with page.expect_download() as download:
            page.locator('#save').click()
        saved=json.loads(Path(download.value.path()).read_text())
        assert json.dumps(saved['cells'],separators=(',',':'))==blended
        page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")')
        page.reload();page.wait_for_function('window.townBuilder?.project.name==="Blend old ground boundary"')
        assert state()==blended,'Autosave/reload lost material weights.'
        before=page.evaluate(capture,{'url':urls['runtime']})
        page.locator('#play').click();page.wait_for_function('!!window.townGame')
        assert before==page.evaluate(capture,{'url':urls['runtime'],'game':True}),'Editor/game ground rendering differs.'

        # Pixel-exact marker materials expose a one-sided interpolation bug:
        # the untouched neighbor must receive the same halo as a painted tile.
        # Restore the actual art before capturing any preview or game frame.
        seams=page.evaluate('''async version=>{
          const{blank,cell}=await import('/town/world/model.mjs'+version),
            {sources}=await import('/town/world/catalog.mjs'+version),
            {drawGround}=await import('/town/world/ground-render.mjs'+version),
            {encodePaint}=await import('/town/world/ground-paint.mjs'+version);
          const backups=[0,2].map(index=>{const original=sources.ground[index],saved=document.createElement('canvas');saved.width=original.width;saved.height=original.height;saved.getContext('2d').drawImage(original,0,0);return{index,saved};});
          try{
            for(const[index,color]of [[0,'rgb(0,255,0)'],[2,'rgb(255,0,0)']]){const image=sources.ground[index],g=image.getContext('2d');g.clearRect(0,0,image.width,image.height);g.fillStyle=color;g.fillRect(0,0,image.width,image.height);}
            const d=blank();d.cells['20,20']={surface:'grass',level:0,paint:encodePaint([{surface:'dirt'}],new Uint8Array(256).fill(255))};
            const c=document.createElement('canvas');c.width=128;c.height=64;const g=c.getContext('2d');
            drawGround(g,d,cell(d,20,20),20,20,0,0);drawGround(g,d,cell(d,21,20),21,20,64,0);
            const pixels=[60,61,62,63,64,65,66,67].map(x=>Array.from(g.getImageData(x,32,1,1).data));
            const donorDoc=blank();donorDoc.cells['20,20']={surface:'grass',level:0,paint:encodePaint([{surface:'grass'}],new Uint8Array(256).fill(255))};
            const donor={surface:'grass',level:0,paint:encodePaint([{surface:'dirt'}],new Uint8Array(256).fill(255))},out=document.createElement('canvas');out.width=out.height=64;
            drawGround(out.getContext('2d'),donorDoc,donor,20,20,0,0);
            return{pixels,donor:Array.from(out.getContext('2d').getImageData(32,32,1,1).data)};
          }finally{
            for(const{index,saved}of backups){const image=sources.ground[index],g=image.getContext('2d');g.clearRect(0,0,image.width,image.height);g.drawImage(saved,0,0);}
          }
        }''',urls['version'])
        expected_red=[255,255,223,159,95,31,0,0]
        assert all(abs(pixel[0]-expected)<=1 for pixel,expected in zip(seams['pixels'],expected_red)),('Discontinuous tile halo',seams['pixels'])
        assert all(pixel[3]==255 and abs(pixel[0]+pixel[1]-255)<=1 and pixel[2]==0 for pixel in seams['pixels']),('Transparent or dark material seam',seams['pixels'])
        assert seams['donor']==[255,0,0,255],('Rounded-under donor ignored at its tile center',seams['donor'])

        gallery=[{'label':'Soft round brush · dirt and cobble','url':soft_image},{'label':'Original material boundary','url':before_blend},{'label':'Blend ground · softened transition','url':after_blend}]
        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
          const gallery=document.createElement('div');gallery.id='groundGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,640px);gap:12px;padding:12px;width:1968px;background:#20382b;color:#f5e3ba;font:20px Georgia';
          for(const sample of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=sample.url;img.width=640;img.height=420;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(sample.label),img);gallery.append(tile);}document.body.append(gallery);
        }''',gallery)
        page.locator('#groundGallery').screenshot(path=str(ROOT/'docs/town-preview/ground-brush.png'))
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()

print('Freehand circular/soft brushes, hardness/opacity, continuous strokes, blending, opaque reciprocal halos, protections, export, undo, reload and editor/game parity passed.')
