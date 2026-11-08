"""Native sand impressions remain subtle, transient and outside saved maps."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1500, 'height': 680})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        result = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src,code=await(await fetch(entry)).text();
          const dependency=needle=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],entry).href;
          const {render}=await import(dependency('../world/runtime.mjs'));
          const {createSandFootprints}=await import(new URL('../world/sand-footprints.mjs',entry));
          const doc={version:1,name:'Sand footsteps',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};
          for(let y=90;y<106;y++)for(let x=116;x<143;x++)doc.cells[x+','+y]={surface:'sand',level:0};
          const before=JSON.stringify(doc),tracks=createSandFootprints({getProject:()=>doc}),actor={id:'player',x:7860,y:6176,walking:true};
          tracks.update([actor],0);for(let i=1;i<=60;i++){actor.x=7860+i*7.5;tracks.update([actor],i/60);}
          const base=document.createElement('canvas');base.width=1500;base.height=680;const c=base.getContext('2d');
          c.imageSmoothingEnabled=false;const cam={x:8100,y:6176,zoom:1.05};
          render(c,doc,cam,1500,680,{time:0,night:false});
          const shot=time=>{const cv=document.createElement('canvas');cv.width=1500;cv.height=680;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(base,0,0);g.save();g.translate(750,340);g.scale(cam.zoom,cam.zoom);g.translate(-cam.x,-cam.y);tracks.draw(g,doc,time);g.restore();return cv;};
          const first=shot(1),faded=shot(6),original=c.getImageData(0,0,1500,680).data,now=first.getContext('2d').getImageData(0,0,1500,680).data,last=faded.getContext('2d').getImageData(0,0,1500,680).data;
          let touched=0,after=0;for(let i=0;i<now.length;i+=4){if(now[i]!==original[i]||now[i+1]!==original[i+1]||now[i+2]!==original[i+2])touched++;if(last[i]!==original[i]||last[i+1]!==original[i+1]||last[i+2]!==original[i+2])after++;}
          const preview=document.createElement('canvas');preview.width=1500;preview.height=680;const g=preview.getContext('2d');g.drawImage(first,0,0);g.fillStyle='#20362de8';g.fillRect(0,0,1500,56);g.fillStyle='#f2dfaa';g.font='20px system-ui';g.fillText('Sand footprints · fresh impressions fade completely after a few seconds',28,36);
          const char=window.createCodaCharacterRenderer({worldScale:2.5});g.save();g.translate(750,340);g.scale(cam.zoom,cam.zoom);g.translate(-cam.x,-cam.y);char.drawPlayer(g,char.normalizeProfile({}),{x:actor.x,y:actor.y,facing:'right',walking:false,phase:0},1);g.restore();
          document.body.append(preview);preview.style.cssText='position:fixed;inset:0;z-index:10000;display:block;width:1500px;height:680px';
          return {marks:tracks.marks.length,touched,after,unchanged:before===JSON.stringify(doc)};
        }''')
        assert result['marks'] == 10, result
        assert 250 < result['touched'] < 2000, result
        assert result['after'] == 0, result
        assert result['unchanged'], result
        assert not errors, errors
        page.screenshot(path=str(ROOT/'docs/town-preview/sand-footprints.png'))
        assert not errors, errors
        browser.close()
        print('Sand footprint browser checks passed: native impressions, complete fade, and unchanged project.')
finally:
    server.shutdown()
    server.server_close()
