"""Compare outdoor building depth/crops against the published renderer.

Two isolated origins serve immutable Git baseline code and current working
code. Static time, seeded randomness and stopped app animation make native
building/NPC pixels comparable at quarter turns and fractional camera poses.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import unquote, urlsplit
import argparse
import base64
import json
import subprocess

from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', default='fd79869')
parser.add_argument('--output', type=Path, default=Path('/workspace/.onboarding/opera-render-pixels'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
commit = subprocess.check_output(['git', 'rev-parse', args.baseline], cwd=ROOT, text=True).strip()
snapshot = {}


class Files(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip('/')
        if path.endswith('/'):
            path += 'index.html'
        if self.server.baseline and Path(path).suffix in ['.mjs', '.js', '.css', '.html'] and '..' not in Path(path).parts:
            if path not in snapshot:
                r = subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=ROOT, capture_output=True)
                snapshot[path] = r.stdout if r.returncode == 0 else None
            data = snapshot[path]
            if data is not None:
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(path))
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
        super().do_GET()


servers = []
for baseline in [True, False]:
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Files, directory=str(ROOT)))
    server.baseline = baseline
    Thread(target=server.serve_forever, daemon=True).start()
    servers.append(server)

SETUP = r"""async()=>{
 const app=new URL(document.querySelector('script[type="module"]').src),url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
 const {render}=await import(url('render')),{buildingDepthSlices}=await import(url('actor-depth'));
 const catalog=townBuilder.catalog,renderer=window.createCodaCharacterRenderer({worldScale:2.5});
 await Promise.all(['sydney-opera-house','coda-arcade','coda-residences','coda-furnishings'].map(id=>catalog.get(id)?.ensureFull?.()));
 const rotate=(o,x,y)=>{const r=o.rotation*Math.PI/180;return{x:o.x+x*Math.cos(r)-y*Math.sin(r),y:o.y+x*Math.sin(r)+y*Math.cos(r)};};
 const make=(asset,rotation)=>{
  const a=catalog.get(asset),object={id:'pixel-building',asset,x:8192,y:6144,rotation,scale:1,layer:'objects',collision:true};
  const corners=[[-a.w/2,-a.h],[a.w/2,-a.h],[a.w/2,0],[-a.w/2,0]].map(([x,y])=>rotate(object,x,y));
  const center={x:corners.reduce((s,p)=>s+p.x,0)/4,y:corners.reduce((s,p)=>s+p.y,0)/4};
  const parts=buildingDepthSlices(a,object)||[],indices=[0,Math.floor(parts.length/2),parts.length-1],actors=[];
  for(const i of [...new Set(indices)]){
   const part=parts[i];if(!part)continue;
   for(const side of [-1,1])actors.push({id:'pixel-npc-'+i+'-'+side,name:'Pixel depth musician',x:(part.x0+part.x1)/2,y:part.depth+side*58,facing:'down',walking:false,activity:'',appearance:{skin:'#d8ad8e',hair:'#332b31',shirt:side<0?'#4b7890':'#b77768',lowerColor:'#293443',hairstyle:'short',outfit:'coat',headwear:'none',eyewear:'none',accessory:'none'}});
  }
  return {object,center,actors,tip:rotate(object,0,-a.h*.79),dimensions:{w:a.w,h:a.h},parts:parts.length};
 };
 window.__pixelQA={
  fixtures(){const list=[];for(const asset of ['sydney-opera-house','coda-arcade','coda-residences','coda-furnishings'])for(const rotation of [0,90,180,270]){
   const scene=make(asset,rotation);
   for(const [zoom,dx,dy]of [[.13,.37,.63],[.37,17.29,-11.73],[.82,-43.41,28.19]])list.push({id:asset+'-'+rotation+'-'+zoom,...scene,camera:{x:scene.center.x+dx,y:scene.center.y+dy,zoom}});
   list.push({id:asset+'-'+rotation+'-roof-offscreen',...scene,camera:{x:scene.tip.x+.43,y:scene.tip.y+.61,zoom:.85},roofOnly:true});
  }return list;},
  draw(fixture){
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.setTransform(.5,0,0,.5,0,0);
   const doc={version:1,name:'Isolated depth comparison',cells:{},edges:{},objects:[fixture.object],spawn:{x:0,y:0}};
   render(c,doc,fixture.camera,1280,960,{time:7.25,night:false,terrainRevision:1,terrainChunks:false,npcs:fixture.actors,drawNPC:(ctx,npc,t)=>renderer.drawNPC(ctx,npc,t)});
   return canvas.toDataURL('image/png');
  }
 };
 return {tag:app.search,catalogSize:catalog.size};
}"""

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        contexts, pages, errors = [], [], []
        for index, server in enumerate(servers):
            context = browser.new_context(viewport={'width': 1280, 'height': 960}, device_scale_factor=2)
            context.add_init_script('''(()=>{let n=123456789;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};window.requestAnimationFrame=()=>0;})()''')
            page = context.new_page()
            page.set_default_timeout(180000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/?pixel-qa=1')
            page.wait_for_function('!!window.townBuilder', polling=100)
            setup = page.evaluate(SETUP)
            print(('baseline' if index == 0 else 'working') + ' ready ' + setup['tag'], flush=True)
            contexts.append(context)
            pages.append(page)
        fixtures = pages[0].evaluate('__pixelQA.fixtures()')
        results = []
        for fixture in fixtures:
            paths = []
            for label, page in zip(['baseline', 'working'], pages):
                data = page.evaluate('(fixture)=>__pixelQA.draw(fixture)', fixture)
                path = args.output / (fixture['id'] + '-' + label + '.png')
                path.write_bytes(base64.b64decode(data.split(',')[1]))
                paths.append(path)
            before, after = [Image.open(path).convert('RGB') for path in paths]
            diff = ImageChops.difference(before, after)
            differences = [max(pixel) for pixel in diff.getdata()]
            changed = sum(value > 0 for value in differences)
            significant = sum(value > 8 for value in differences)
            row = {'id': fixture['id'], 'parts': fixture['parts'], 'actors': len(fixture['actors']), 'changedPixels': changed, 'significantPixels': significant, 'maximumDifference': max(differences), 'bounds': diff.getbbox()}
            if changed:
                diff.save(args.output / (fixture['id'] + '-diff.png'))
            results.append(row)
            (args.output / 'results.json').write_text(json.dumps({'baseline': commit, 'scenarios': results, 'pageErrors': errors}, indent=2))
            print(json.dumps(row), flush=True)
        assert not errors, errors
        assert not [row for row in results if row['significantPixels'] > 30], 'Building pixels changed; inspect the diff images.'
        browser.close()
finally:
    for server in servers:
        server.shutdown()
