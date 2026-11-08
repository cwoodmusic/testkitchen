"""Painted ground shows through scene lawns; builder pedestrians can be hidden."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def project(name, objects=None):
    return {'version': 1, 'name': name, 'cells': {}, 'edges': {},
            'objects': objects or [], 'spawn': {'x': 8192, 'y': 6144}}


def placed(asset, x=8192, y=6950, scale=1, rotation=0):
    return {'id': asset, 'asset': asset, 'x': x, 'y': y, 'scale': scale,
            'rotation': rotation, 'layer': 'ground', 'collision': True}


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1760, 'height': 1120})
        context.add_init_script('''
          window.__npcDrawCount=0;
          Object.defineProperty(window,'createCodaCharacterRenderer',{configurable:true,set(factory){
            Object.defineProperty(window,'createCodaCharacterRenderer',{configurable:true,writable:true,value:function(...args){
              const renderer=factory(...args),draw=renderer.drawNPC;
              renderer.drawNPC=function(...values){window.__npcDrawCount++;return draw.apply(renderer,values);};
              return renderer;
            }});
          }});
        ''')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base+'/town/builder/?kit=urban')
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        assert page.locator('#npcToggle').count() == 1
        assert page.evaluate('townBuilder.npcsVisible') is True
        assert page.locator('#npcToggle').get_attribute('aria-pressed') == 'true'
        dependencies = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src,code=await(await fetch(entry)).text();
          const find=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],entry).href;
          const runtime=find('../world/runtime.mjs'),source=await(await fetch(runtime)).text();
          const render=new URL(source.split(String.fromCharCode(10)).find(line=>line.includes("'./render.mjs")).split("'")[1],runtime).href;
          const renderSource=await(await fetch(render)).text();
          const lawnLine=renderSource.split(String.fromCharCode(10)).find(line=>line.includes("'./asset-lawn.mjs"));
          const lawn=lawnLine?new URL(lawnLine.split("'")[1],render).href:null;
          return {model:find('../world/model.mjs'),runtime,render,lawn};
        }''')

        def load(doc, camera=None):
            page.locator('#file').set_input_files({'name': 'scene.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")')
            page.evaluate('camera=>Object.assign(townBuilder.cam,camera)', camera or {'x': 8192, 'y': 6144, 'zoom': .7})

        def state():
            return page.evaluate('JSON.stringify(townBuilder.project)')

        def point(x, y):
            return page.evaluate('''async({x,y,url})=>{
              const {height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;
              return {x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-height(townBuilder.project,x,y)-cam.y)*cam.zoom};
            }''', {'x': x, 'y': y, 'url': dependencies['model']})

        # Hide both the visual pedestrians and their preview simulation. Neither
        # the toolbar choice nor its persistence may mutate the authored town.
        npc_doc = project('NPC visibility · isolated preview')
        load(npc_doc)
        page.wait_for_function('townBuilder.ambient.actors.length===10&&window.__npcDrawCount>0', timeout=20000)
        before = state()
        page.locator('#npcToggle').click()
        assert page.evaluate('townBuilder.npcsVisible') is False
        assert page.locator('#npcToggle').get_attribute('aria-pressed') == 'false'
        paused = page.evaluate('JSON.stringify(townBuilder.ambient.actors.map(a=>({id:a.id,x:a.x,y:a.y,phase:a.phase})))')
        page.evaluate('window.__npcDrawCount=0')
        page.wait_for_timeout(650)
        assert page.evaluate('window.__npcDrawCount') == 0
        assert page.evaluate('JSON.stringify(townBuilder.ambient.actors.map(a=>({id:a.id,x:a.x,y:a.y,phase:a.phase})))') == paused
        assert state() == before
        page.locator('#walk').click()
        page.wait_for_timeout(250)
        assert page.evaluate('window.__npcDrawCount') == 0, 'Hidden NPCs reappeared in Walk test.'
        page.locator('#walk').click()
        page.reload()
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        assert page.evaluate('townBuilder.npcsVisible') is False
        page.wait_for_timeout(200)
        assert page.evaluate('window.__npcDrawCount') == 0
        assert state() == before
        page.locator('#npcToggle').click()
        page.wait_for_function('window.__npcDrawCount>0', timeout=15000)
        assert page.evaluate('townBuilder.npcsVisible') is True
        assert state() == before
        page.locator('#npcToggle').click()
        if os.environ.get('CODA_NPC_ONLY'):
            browser.close()
            print('Builder NPC visibility checks passed: actual drawing and simulation pause, Walk test, persistence, resume, and unchanged map.')
            raise SystemExit(0)
        if page.evaluate('townBuilder.night'):
            page.locator('#lightingToggle').click()

        # Compare the actual map sprite with its untouched native artwork.
        # Grass can become transparent, but architecture and colorful flowers
        # keep their original pixels. This catches broad rectangular masking.
        probes = page.evaluate('''async({lawn,render})=>{
          const {assetMapImage}=await import(lawn),{drawObject}=await import(render),results={};
          for(const id of ['music-square','estate-bach','estate-nina']){
            const a=townBuilder.catalog.get(id),raw=a.canvas.getContext('2d').getImageData(0,0,a.w,a.h).data;
            const image=assetMapImage(a),out=document.createElement('canvas');out.width=a.w;out.height=a.h;
            const c=out.getContext('2d');c.drawImage(image,0,0);
            const pixels=c.getImageData(0,0,a.w,a.h).data;
            let removed=0,changedSolid=0,architectureLost=0,architecture=0,flowerLost=0,flowers=0,point=null;
            for(let y=0;y<a.h;y++)for(let x=0;x<a.w;x++){
              const i=(y*a.w+x)*4;if(raw[i+3]<250)continue;
              const lost=pixels[i+3]<32;
              if(lost)removed++;
              if(pixels[i+3]===255&&(pixels[i]!==raw[i]||pixels[i+1]!==raw[i+1]||pixels[i+2]!==raw[i+2]))changedSolid++;
              const central=id==='music-square'?x>a.w*.2&&x<a.w*.8&&y>a.h*.15&&y<a.h*.88:x>a.w*.25&&x<a.w*.78&&y>a.h*.12&&y<a.h*.55;
              if(central){architecture++;if(lost)architectureLost++;}
              const colorful=raw[i]>200&&raw[i+1]>185&&raw[i+2]>180||raw[i]>raw[i+1]+40&&raw[i+2]>100;
              if(colorful){flowers++;if(lost)flowerLost++;}
              if(!point&&lost&&x>3&&x<a.w*.08&&y>a.h*.35&&y<a.h*.68){
                let clear=true;
                for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(pixels[((y+dy)*a.w+x+dx)*4+3]>0)clear=false;
                if(clear)point={x,y};
              }
            }
            const exact=document.createElement('canvas');exact.width=a.w;exact.height=a.h;
            drawObject(exact.getContext('2d'),{asset:id,x:a.w/2,y:a.h,scale:1,rotation:0,collision:false},{cells:{},objects:[],edges:{}});
            const original=a.canvas.getContext('2d').getImageData(0,0,a.w,a.h).data;
            results[id]={removed,changedSolid,architectureLost,architecture,flowers,flowerLost,point,
                         cached:assetMapImage(a)===image,rawUntouched:original.every((value,i)=>value===raw[i]),
                         actualSprite:exact.toDataURL()===out.toDataURL()};
          }return results;
        }''', dependencies)
        for asset, proof in probes.items():
            assert proof['removed'] > 300, (asset, proof)
            assert proof['changedSolid'] == 0, (asset, proof)
            assert proof['architectureLost'] == 0, (asset, proof)
            assert proof['flowerLost'] < max(3, proof['flowers']*.002), (asset, proof)
            assert proof['point'], (asset, proof)
            assert proof['cached'] and proof['rawUntouched'] and proof['actualSprite'], (asset, proof)

        # Paint real ground through each asset's lawn with both editor modes.
        # Compare at transparent lawn pixels against the exact same terrain
        # rendered with that asset omitted; retained asset pixels stay above it.
        for asset, shape, material, rotation, scale in [
            ('music-square','square','sidewalk',0,1),
            ('estate-bach','round','asphalt',90,.75),
        ]:
            o = placed(asset, scale=scale, rotation=rotation)
            doc = project('Paint through '+asset, [o])
            local = probes[asset]['point']
            world = page.evaluate('''({id,o,p})=>{
              const a=townBuilder.catalog.get(id),angle=o.rotation*Math.PI/180,dx=(p.x-a.w/2)*o.scale,dy=(p.y-a.h)*o.scale;
              return {x:o.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:o.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
            }''', {'id':asset,'o':o,'p':local})
            load(doc, {'x':world['x'],'y':world['y'],'zoom':.9})
            page.locator('[data-tool="ground"]').click()
            page.locator('#groundShape').select_option(shape)
            page.locator('#surface').select_option(material)
            page.locator('#brush').fill('3')
            for control in ['brushHardness','brushOpacity']:
                page.locator('#'+control).evaluate("e=>{e.value='100';e.dispatchEvent(new Event('input'));}")
            pnt = point(world['x'],world['y'])
            page.mouse.click(pnt['x'],pnt['y'])
            page.mouse.move(20,20)
            assert page.evaluate('Object.keys(townBuilder.project.cells).length>0')
            proof = page.evaluate('''async({runtime,world})=>{
              const {render}=await import(runtime),d=townBuilder.project,cam={x:world.x,y:world.y,zoom:1};
              const shot=doc=>{const cv=document.createElement('canvas');cv.width=cv.height=80;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;render(c,doc,cam,80,80);return [...c.getImageData(40,40,1,1).data];};
              return {withAsset:shot(d),withoutAsset:shot({...d,objects:[]})};
            }''', {**dependencies,'world':world})
            assert proof['withAsset'] == proof['withoutAsset'], (asset, proof)

        # A clean view of an adjoining plaza and estate demonstrates that the
        # terrain can meet both scene assets without hiding their decorations.
        scene = project('Paintable asset edges', [placed('music-square',7700,7100),placed('estate-bach',9700,7100)])
        for y in range(84,113):
            for x in range(137,143):
                scene['cells'][f'{x},{y}']={'surface':'sidewalk','level':0,'sidewalkCurb':True}
        load(scene, {'x':8900,'y':6350,'zoom':.64})
        page.locator('[data-tool="select"]').click()
        page.mouse.move(20,20)
        page.wait_for_timeout(100)
        page.screenshot(path=str(ROOT/'docs/town-preview/painted-asset-edges.png'))
        expected = state()
        expected_art = page.evaluate('''async({runtime})=>{
          const {render}=await import(runtime),cv=document.createElement('canvas');cv.width=cv.height=80;
          render(cv.getContext('2d'),townBuilder.project,{x:8900,y:6350,zoom:1},80,80);
          return cv.toDataURL();
        }''', dependencies)
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame', timeout=90000)
        assert page.evaluate('JSON.stringify(townGame.project)') == expected
        page.wait_for_function('window.__npcDrawCount>0', timeout=15000)
        parity = page.evaluate('''async({runtime})=>{
          const {render}=await import(runtime),cv=document.createElement('canvas');cv.width=cv.height=80;
          render(cv.getContext('2d'),townGame.project,{x:8900,y:6350,zoom:1},80,80);
          return cv.toDataURL();
        }''', dependencies)
        assert parity == expected_art, 'Play rendered the authored scene differently from the builder.'
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('Asset lawn/NPC browser checks passed: native detail preservation, square/round ground painting, transformed scenes, hidden/paused builder NPCs, persistence, Walk test, and Play.')
