"""Wide and steep flights keep authored tread detail at one projected scale."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import re
import subprocess
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline-ref')
args = parser.parse_args()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1400, 'height':1200})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        if args.baseline_ref:
            old = subprocess.check_output(['git', 'show', args.baseline_ref+':town/world/construction.mjs'], cwd=ROOT).decode()
            page.route(re.compile(r'/town/world/construction\.mjs(?:\?.*)?$'), lambda route: route.fulfill(body=old, content_type='text/javascript'))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const renderURL=new URL('/town/world/render.mjs',location.origin).href,source=await(await fetch(renderURL)).text();
          const {drawStairs}=await import(dependency(source,'construction',renderURL));
          const {blank}=await import(dependency(source,'model',renderURL));
          const appURL=document.querySelector('script[type="module"]').src,app=await(await fetch(appURL)).text();
          const {render,PLAYER_SCALE}=await import(dependency(app,'runtime',appURL));
          const checks=[],samples=[],left=1248,top=900,w=128,h=512;
          const make=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
          function fixture(direction,width,finish,base,rise){
            const d=blank(),vertical=['north','south'].includes(direction),first=20-Math.floor(width/2);
            for(let lane=0;lane<width;lane++)d.cells[`${vertical?first+lane:20},${vertical?20:first+lane}`]={surface:'cobble',level:Math.floor(base),stairs:direction,stairBase:base,stairRise:rise,stairStart:0,stairEnd:1,finish};
            return d;
          }
          function capture(d){const c=make(),g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(-left,-top);for(const key of Object.keys(d.cells)){const[x,y]=key.split(',').map(Number);drawStairs(g,d,x,y);}return {canvas:c,data:g.getImageData(0,0,w,h).data};}
          function compare(a,b){let compared=0,bad=0;for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){
            const n=(y*w+x)*4;if(a[n+3]<240||b[n+3]<240)continue;
            if(a[n-w*4+3]<240||a[n+w*4+3]<240||a[n-8+3]<240||a[n+8+3]<240||b[n-w*4+3]<240||b[n+w*4+3]<240||b[n-8+3]<240||b[n+8+3]<240)continue;
            compared++;if([0,1,2,3].some(i=>Math.abs(a[n+i]-b[n+i])>1))bad++;
          }return {compared,bad};}
          for(const finish of ['stone','wood','brick'])for(const direction of ['north','south','east','west']){
            const grades=[];
            for(const[base,rise]of [[1,.5],[0,3],[0,6]]){
              const captures=[1,3,8].map(width=>capture(fixture(direction,width,finish,base,rise)));
              for(let n=1;n<captures.length;n++){const q=compare(captures[0].data,captures[n].data);checks.push({finish,direction,rise,width:[3,8][n-1],kind:'width',...q,passed:q.compared>300&&q.bad===0});}
              grades.push(captures[0]);
            }
            const q=compare(grades[0].data,grades[2].data);checks.push({finish,direction,kind:'mild versus grade 6',...q,passed:q.compared>100&&q.bad===0});
            if(direction==='north'){
              const data=grades[2].data,luma=[];
              for(let Y=1020;Y<1320;Y++){let sum=0;for(let X=1284;X<1340;X++){const n=((Y-top)*w+X-left)*4;sum+=(data[n]+data[n+1]+data[n+2])/3;}luma.push(sum/56);}
              const peaks=[];for(let y=2;y<luma.length-2;y++)if(luma[y]>luma[y-1]+5&&luma[y]>luma[y+1]+20&&(peaks.length===0||y-peaks.at(-1)>10))peaks.push(y);
              const colors=new Set();for(let n=0;n<data.length;n+=4)if(data[n+3]>240)colors.add([data[n],data[n+1],data[n+2]].join(','));
              checks.push({finish,kind:'fine treads at maximum slope',treads:peaks.length,colors:colors.size,passed:peaks.length>=12&&peaks.length<=18&&colors.size>80});
            }
          }
          const character=createCodaCharacterRenderer({worldScale:PLAYER_SCALE||2.5}),profile=character.normalizeProfile({});
          for(const rise of [1,6])for(const width of [1,3,8]){
            const d=fixture('north',width,'stone',0,rise);
            for(let y=10;y<20;y++)for(let x=10;x<30;x++)d.cells[`${x},${y}`]={surface:'grass',level:rise};
            const canvas=document.createElement('canvas');canvas.width=440;canvas.height=440;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
            render(c,d,{x:1312,y:(1280-rise*48+1344)/2,zoom:.75},440,440,{player:{x:1312,y:1376},drawPlayer:(g,x,y)=>character.drawPlayer(g,profile,{x,y,facing:'up',walking:false},0)});
            samples.push({label:`${rise===1?'One-level':'Steep six-level'} · ${width} tile${width===1?'':'s'} wide`,url:canvas.toDataURL()});
          }
          return {checks,samples};
        }''')
        failed = [c for c in result['checks'] if not c['passed']]
        print(json.dumps({'checks':len(result['checks']), 'failed_count':len(failed), 'failed':failed[:6]}), flush=True)
        assert not failed, 'Stair materials magnify or lose tread detail as width/grade changes.'
        page.evaluate('''samples=>{document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const gallery=document.createElement('div');gallery.id='stairScaleGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,440px);gap:12px;padding:12px;width:1368px;background:#20382b;color:#f5e3ba;font:18px Georgia';for(const sample of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=sample.url;img.width=440;img.height=440;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(sample.label),img);gallery.append(tile);}document.body.append(gallery);}''', result['samples'])
        page.locator('#stairScaleGallery').screenshot(path=str(ROOT/'docs/town-preview/stairs-material-scale.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print('Authored stair materials keep their world scale across widths and extreme grades in all directions.')
