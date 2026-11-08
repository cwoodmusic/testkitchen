"""Rounded tall cliffs retain the exposed lower terrace face at their join."""
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
parser.add_argument('--baseline-ref', help='Prove this regression rejects a previous renderer revision.')
args = parser.parse_args()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1200, 'height':900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        if args.baseline_ref:
            for name in ['construction', 'round-render', 'terrain-render']:
                old = subprocess.check_output(['git','show',f'{args.baseline_ref}:town/world/{name}.mjs'],cwd=ROOT,text=True)
                page.route(re.compile(r'/town/world/'+name+r'\.mjs(?:\?.*)?$'), lambda route, request, body=old: route.fulfill(status=200,content_type='text/javascript',body=body))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const appURL=document.querySelector('script[type="module"]').src,code=await(await fetch(appURL)).text();
          const dependency=(source,name,parent)=>new URL(source.split(String.fromCharCode(10)).find(l=>l.includes(name+'.mjs')).split("'")[1],parent).href;
          const {roundTerrain}=await import(dependency(code,'round-terrain',appURL)),{blank,height}=await import(dependency(code,'model',appURL)),{render}=await import(dependency(code,'runtime',appURL));
          const renderURL=new URL('/town/world/render.mjs',location.origin),renderCode=await(await fetch(renderURL)).text(),constructionURL=dependency(renderCode,'construction',renderURL),constructionCode=await(await fetch(constructionURL)).text();
          const {cliffArt}=await import(dependency(constructionCode,'detail-art',constructionURL));
          const {sources}=await import(dependency(renderCode,'catalog',renderURL));
          function fixture(corner,style){
            const d=blank();for(let y=20;y<=29;y++)for(let x=20;x<=29;x++)d.cells[`${x},${y}`]={surface:'grass',level:3};
            for(let y=27;y<=32;y++)for(let x=corner==='se'?30:14;x<=(corner==='se'?35:19);x++)d.cells[`${x},${y}`]={surface:'grass',level:1};
            const plan=roundTerrain(d,{x:(corner==='se'?29.5:20.5)*64,y:29.5*64},3,style);for(const[k,a]of plan.edits)d.cells[k]=a;
            const q=Object.values(d.cells).flatMap(a=>a.curves||[]).find(q=>q.corner===corner&&q.kind==='height');
            if(!q)throw Error('No rounded feature for '+corner+' '+style);
            return {d,q,corner,style};
          }
          const fixtures=[];for(const corner of ['se','sw'])for(const style of ['smooth','rocky','bevel'])fixtures.push(fixture(corner,style));
          const camera={x:1856,y:1740,zoom:1},canvas=document.createElement('canvas');canvas.width=1100;canvas.height=750;const g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
          render(g,fixtures[0].d,camera,1100,750);const native=canvas.toDataURL();
          const paint=(c,color)=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=color;ctx.fillRect(0,0,c.width,c.height);};
          paint(sources.ground[0],'rgb(30,200,70)');paint(cliffArt,'rgb(166,84,28)');
          const checks=[];
          for(const {d,q,corner,style}of fixtures){
            const cam={x:q.cx,y:1840,zoom:1};render(g,d,cam,1100,750);
            const pixel=(x,y)=>Array.from(g.getImageData(Math.round(x-cam.x+550),Math.round(y-cam.y+375),1,1).data);
            const rock=p=>p[3]===255&&p[0]>p[1]*1.2&&p[1]>p[2]*1.3;
            const sign=corner==='se'?1:-1,x=q.cx+sign*38;
            const lastEdge=(Math.ceil((q.cy+q.r)/64))*64;
            const underSamples=[x,q.cx+sign*62,q.cx+sign*66];
            for(const X of underSamples){
              const north=height(d,X,lastEdge-.01),south=height(d,X,lastEdge+.01),Y=lastEdge-(north+south)/2,p=pixel(X,Y);
              checks.push({corner,style,kind:'lower terrace face',x:X,y:Y,north,south,pixel:p,passed:north===48&&south===0&&rock(p)});
            }
            // Find the actual high-to-under curved boundary through the model,
            // independent of the renderer's frontEdge implementation.
            let front=q.cy;
            for(let y=q.cy;y<=q.cy+q.r;y+=.25)if(height(d,x,y-.01)===144&&height(d,x,y+.25)<144){front=y;break;}
            const p=pixel(x,front-96);
            checks.push({corner,style,kind:'upper curved face',x,y:front-96,pixel:p,passed:front>q.cy&&rock(p)});
          }
          return {checks,native};
        }''')
        for check in result['checks']:
            print(json.dumps(check), flush=True)
        if args.baseline_ref:
            failed = [c for c in result['checks'] if not c['passed'] and c['kind']=='lower terrace face']
            assert len(failed)>=6, 'Baseline did not reproduce the missing lower terrace faces.'
            print(f'Baseline rejected: {len(failed)} exposed lower-face samples are missing.')
        else:
            assert all(c['passed'] for c in result['checks']), 'A curved/straight cliff junction has a missing or overwritten face.'
            page.evaluate('''url=>{document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const img=document.createElement('img');img.id='cliffJunction';img.src=url;img.style.cssText='display:block;image-rendering:pixelated';document.body.append(img);}''',result['native'])
            page.locator('#cliffJunction').screenshot(path=str(ROOT/'docs/town-preview/cliff-junction.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print('Rounded tall-cliff/lower-terrace junction checks passed across both directions and all corner styles.')
