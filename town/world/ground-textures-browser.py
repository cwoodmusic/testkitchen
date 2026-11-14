"""Native dry-ground detail, seamless sampling and both paint modes in play."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
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
        result = page.evaluate('''async()=>{
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const appURL=document.querySelector('script[type="module"]').src,app=await(await fetch(appURL)).text(),runtimeURL=dependency(app,'runtime',appURL),groundURL=dependency(app,'ground-render',appURL),ground=await(await fetch(groundURL)).text();
          const texturesURL=dependency(ground,'ground-textures',groundURL),catalogURL=dependency(ground,'catalog',groundURL),{groundTextures}=await import(texturesURL),{sources}=await import(catalogURL),{render}=await import(runtimeURL);
          const d={version:1,name:'Native ground detail',cells:{},edges:{},objects:[],spawn:{x:8192,y:6400}},checks=[],gallery=[];
          function filled(surface){const copy={...d,cells:{}};for(let y=88;y<104;y++)for(let x=120;x<136;x++)copy.cells[x+','+y]={surface,level:0};return copy;}
          const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
          for(const surface of ['dirt','sand','wood']){
            const texture=groundTextures[surface],pixels=texture.getContext('2d').getImageData(0,0,512,512).data,colors=new Set(),light=[];let wrap=true,opaque=true;
            for(let y=0;y<512;y++)for(let x=0;x<512;x++){
              const i=(y*512+x)*4;if(pixels[i+3]!==255)opaque=false;
              if(x%4===0&&y%4===0){colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);light.push(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]);}
            }
            for(let t=0;t<512;t++)for(let k=0;k<4;k++)if(pixels[(t*512)*4+k]!==pixels[(t*512+511)*4+k]||pixels[t*4+k]!==pixels[(511*512+t)*4+k])wrap=false;
            light.sort((a,b)=>a-b);const spread=light[Math.floor(light.length*.9)]-light[Math.floor(light.length*.1)];
            const differences=[];let seamDifference=0;
            for(let x=1;x<512;x++){let sum=0;for(let y=0;y<512;y++)for(let k=0;k<3;k++)sum+=Math.abs(pixels[(y*512+x)*4+k]-pixels[(y*512+x-1)*4+k]);differences.push(sum/(512*3));}
            for(let y=0;y<512;y++)for(let k=0;k<3;k++)seamDifference+=Math.abs(pixels[(y*512)*4+k]-pixels[(y*512+511)*4+k]);
            differences.sort((a,b)=>a-b);const seamRatio=seamDifference/(512*3)/differences[Math.floor(differences.length/2)];
            // Render a non-zero atlas phase through the production terrain
            // renderer, crossing eight cells and one complete texture wrap.
            const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
            const left=125*64,top=93*64;render(g,filled(surface),{x:left+256,y:top+256,zoom:1},512,512);
            const output=g.getImageData(0,0,512,512).data;let aligned=true;
            for(let y=0;y<512&&aligned;y++)for(let x=0;x<512&&aligned;x++){
              const a=(y*512+x)*4,b=(((top+y)%512)*512+(left+x)%512)*4;
              for(let k=0;k<4;k++)if(output[a+k]!==pixels[b+k]){aligned=false;break;}
            }
            checks.push({surface,opaque,wrap,seamRatio,colors:colors.size,lumaSpread:spread,aligned});
            const image=document.createElement('canvas');image.width=240;image.height=180;const ctx=image.getContext('2d');ctx.setTransform(.5,0,0,.5,0,0);ctx.imageSmoothingEnabled=false;
            render(ctx,filled(surface),{x:8192,y:6144,zoom:.9},480,360);gallery.push({surface,url:image.toDataURL()});
          }
          const old=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=new URL('../assets/ground.png',groundURL).href;}),oldDirt=document.createElement('canvas');oldDirt.width=oldDirt.height=512;
          oldDirt.getContext('2d').drawImage(old,0,old.height/2,old.width/2,old.height/2,0,0,512,512);
          return {checks,gallery,runtimeURL,newDirtSource:sources.ground[2]===groundTextures.dirt,oldDirtReplaced:oldDirt.toDataURL()!==groundTextures.dirt.toDataURL()};
        }''')
        for check in result['checks']:
            print(json.dumps(check),flush=True)
            assert check['opaque'] and check['aligned'],check
            # Equal endpoint pixels are expected for the retained mirrored
            # dirt/wood. Natural sand repeats have ordinary grain variation at
            # their boundary, without reflecting the whole dune field.
            assert check['wrap'] or (check['surface']=='sand' and check['seamRatio']<1.5),check
            assert check['colors']>500 and check['lumaSpread']>15,('Ground lost material detail',check)
        assert result['newDirtSource'] and result['oldDirtReplaced'],'The old dirt atlas is still being used.'

        def load(name):
            d={'version':1,'name':name,'cells':{},'edges':{},'objects':[],'spawn':{'x':8192,'y':6400}}
            page.locator('#file').set_input_files({'name':'materials.json','mimeType':'application/json','buffer':json.dumps(d).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name',arg=name)
            page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.7})')

        def point(x,y):
            box=page.locator('#map').bounding_box()
            return box['x']+box['width']/2+(x-8192)*.7,box['y']+box['height']/2+(y-6144)*.7

        def shape(mode,surface,size):
            page.locator('[data-tool="ground"]').click();page.locator('#groundShape').select_option(mode);page.locator('#surface').select_option(surface);page.locator('#brush').fill(str(size))
            for selector in ['#brushHardness','#brushOpacity']:
                page.locator(selector).evaluate('(el)=>{el.value=100;el.dispatchEvent(new Event("input",{bubbles:true}));}')

        tile_capture='''async url=>{const{render}=await import(url),c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,townBuilder.project,{x:8224,y:6176,zoom:1},64,64);return c.toDataURL();}'''
        for material in ['dirt','sand','wood']:
            load('Both brush modes · '+material);shape('round',material,3);page.mouse.click(*point(8224,6176))
            assert page.evaluate('!!townBuilder.project.cells["128,96"].paint')
            round_pixels=page.evaluate(tile_capture,result['runtimeURL'])
            shape('square',material,1);page.mouse.click(*point(8224,6176))
            assert page.evaluate('(surface)=>townBuilder.project.cells["128,96"].surface===surface&&!townBuilder.project.cells["128,96"].paint',material)
            assert round_pixels==page.evaluate(tile_capture,result['runtimeURL']),('Brush modes use different artwork',material)

        # Real UI painting creates the mixed saved map used for the comparison
        # panel and the actual town-route render-parity assertion.
        load('New dirt, sand and wood')
        shape('round','dirt',1.5);page.mouse.move(*point(7900,6300));page.mouse.down();page.mouse.move(*point(8490,6300),steps=12);page.mouse.up()
        shape('square','wood',3);page.mouse.click(*point(8060,6110))
        shape('round','sand',3);page.mouse.click(*point(8340,6120))
        capture='''async({url,game=false})=>{const{render}=await import(url),c=document.createElement('canvas');c.width=240;c.height=180;const g=c.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;render(g,game?townGame.project:townBuilder.project,{x:8192,y:6144,zoom:.72},480,360);return c.toDataURL();}'''
        mixed=page.evaluate(capture,{'url':result['runtimeURL']})
        saved=page.evaluate('JSON.stringify(townBuilder.project)')
        page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved")')
        page.reload();page.wait_for_function('window.townBuilder?.project.name==="New dirt, sand and wood"')
        assert saved==page.evaluate('JSON.stringify(townBuilder.project)')
        assert mixed==page.evaluate(capture,{'url':result['runtimeURL']})
        page.locator('#play').click();page.wait_for_function('!!window.townGame')
        assert mixed==page.evaluate(capture,{'url':result['runtimeURL'],'game':True}),'Saved material map differs in gameplay.'
        samples=[{'label':{'dirt':'Pebbled dirt · no footprints','sand':'Dune sand · granular detail','wood':'Timber · grain and plank joints'}[item['surface']],'url':item['url']} for item in result['gallery']]
        samples.append({'label':'Square wood · round sand · freehand dirt','url':mixed})
        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const gallery=document.createElement('div');gallery.id='materialGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(2,480px);gap:12px;padding:12px;width:996px;background:#20382b;color:#f5e3ba;font:20px Georgia';
          for(const sample of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=sample.url;img.width=480;img.height=360;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(sample.label),img);gallery.append(tile);}document.body.append(gallery);
        }''',samples)
        gallery_path=Path(os.environ.get('CODA_GROUND_GALLERY',str(ROOT/'docs/town-preview/ground-materials.png')))
        gallery_path.parent.mkdir(parents=True,exist_ok=True)
        page.locator('#materialGallery').screenshot(path=str(gallery_path))
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()

print('Detailed dirt/sand/wood, seamless wrap and world sampling, both paint modes, save/reload and editor/game pixel parity passed.')
