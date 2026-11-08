"""Real east/west stair artwork covers its projected surface without lane gaps."""
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
        page = browser.new_page(viewport={'width':1600, 'height':1200})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async () => {
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const renderURL=new URL('/town/world/render.mjs',location.origin).href,source=await (await fetch(renderURL)).text();
          const constructionURL=dependency(source,'construction',renderURL),modelURL=dependency(source,'model',renderURL);
          const appURL=document.querySelector('script[type="module"]').src,appSource=await (await fetch(appURL)).text();
          const stairsURL=dependency(appSource,'stairs',appURL),runtimeURL=dependency(appSource,'runtime',appURL);
          const {drawStairs}=await import(constructionURL),{blank,height}=await import(modelURL),{planStairs}=await import(stairsURL),{render}=await import(runtimeURL);
          function fixture(direction,width,finish,phase,rise){
            const d=blank(),low={x:(direction==='east'?20:28)+phase,y:22},high={x:low.x+(direction==='east'?6:-6),y:22};
            for(let x=high.x-(direction==='west'?3:0);x<=high.x+(direction==='east'?3:0);x++)for(let y=18;y<=26;y++)d.cells[`${x},${y}`]={surface:'grass',level:rise};
            const plan=planStairs(d,low,high,{width,finish});if(!plan.valid)throw Error(plan.message);
            for(const[k,a]of plan.edits)d.cells[k]=a;
            return {d,plan};
          }
          const checks=[],gallery=[];
          for(const finish of ['stone','wood','brick'])for(const direction of ['east','west'])for(const width of [1,3])for(const phase of [0,1])for(const rise of [1,3]){
            const {d,plan}=fixture(direction,width,finish,phase,rise),tiles=plan.edits.map(([key])=>key.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
            const x0=Math.min(...tiles.map(p=>p[0]))*64,x1=(Math.max(...tiles.map(p=>p[0]))+1)*64,y0=Math.min(...tiles.map(p=>p[1]))*64,y1=(Math.max(...tiles.map(p=>p[1]))+1)*64;
            const left=x0-16,top=y0-rise*48-16,c=document.createElement('canvas');c.width=x1-x0+32;c.height=y1-y0+rise*48+32;
            const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(-left,-top);
            for(const[x,y]of tiles)drawStairs(g,d,x,y);
            const pixels=g.getImageData(0,0,c.width,c.height).data;let samples=0,bad=0,example=null;
            for(let x=x0+3;x<x1-3;x+=2)for(let y=y0+3;y<y1-3;y+=2){
              const sx=Math.round(x-left),sy=Math.round(y-height(d,x,y)-top),alpha=pixels[(sy*c.width+sx)*4+3];samples++;
              if(alpha<180){bad++;example||={x,y,alpha};}
            }
            checks.push({finish,direction,width,phase,rise,passed:bad===0,samples,bad,example});
            if(width===3&&phase===0&&rise===3){
              const image=document.createElement('canvas');image.width=560;image.height=360;const ctx=image.getContext('2d');ctx.imageSmoothingEnabled=false;
              render(ctx,d,{x:(x0+x1)/2,y:(y0+y1)/2-rise*24,zoom:1},560,360);
              gallery.push({finish,direction,url:image.toDataURL()});
            }
          }
          return {checks,gallery};
        }''')
        failed = [check for check in result['checks'] if not check['passed']]
        print(json.dumps({'cases':len(result['checks']), 'failed':failed}), flush=True)
        assert not failed, 'East/west stair surfaces contain transparent gaps or disconnected lanes.'
        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
          const gallery=document.createElement('div');gallery.id='sidewaysGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,560px);gap:12px;background:#20382b;padding:12px;width:1728px;color:#f5e3ba;font:18px Georgia';
          for(const direction of ['east','west'])for(const finish of ['stone','wood','brick']){
            const sample=samples.find(s=>s.finish===finish&&s.direction===direction),tile=document.createElement('div'),img=document.createElement('img');img.src=sample.url;img.width=560;img.height=360;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';
            tile.append(document.createTextNode(finish[0].toUpperCase()+finish.slice(1)+' · ascent '+direction),img);gallery.append(tile);
          }
          document.body.append(gallery);
        }''',result['gallery'])
        page.locator('#sidewaysGallery').screenshot(path=str(ROOT/'docs/town-preview/stairs-sideways.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print('Actual east/west stair surfaces stay connected across finishes, widths, phases and rises.')
