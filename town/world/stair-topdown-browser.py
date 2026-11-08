"""Actual stair artwork keeps parallel sides in north/south orthographic views."""
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
        page = browser.new_page(viewport={'width':1200, 'height':1200})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async () => {
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const renderURL=new URL('/town/world/render.mjs',location.origin).href;
          const source=await (await fetch(renderURL)).text();
          const constructionURL=dependency(source,'construction',renderURL),modelURL=dependency(source,'model',renderURL),catalogURL=dependency(source,'catalog',renderURL);
          const appURL=document.querySelector('script[type="module"]').src,appSource=await (await fetch(appURL)).text();
          const stairsURL=dependency(appSource,'stairs',appURL),runtimeURL=dependency(appSource,'runtime',appURL);
          const {drawStairs}=await import(constructionURL),{blank}=await import(modelURL),{planStairs}=await import(stairsURL),{render}=await import(runtimeURL),{catalog}=await import(catalogURL);
          function fixture(direction,width,finish){
            const d=blank(),low={x:20,y:direction==='north'?26:22},high={x:20,y:direction==='north'?22:26};
            d.name='Top-down stair regression';d.spawn={x:1312,y:1800};
            for(let x=16;x<=24;x++)for(let y=direction==='north'?19:26;y<=(direction==='north'?22:29);y++)d.cells[`${x},${y}`]={surface:'grass',level:2};
            const plan=planStairs(d,low,high,{width,finish});if(!plan.valid)throw Error(plan.message);
            for(const[k,a]of plan.edits)d.cells[k]=a;
            return {d,plan};
          }
          const checks=[],gallery=[];
          for(const finish of ['stone','wood','brick'])for(const direction of ['north','south'])for(const width of [1,3]){
            const {d,plan}=fixture(direction,width,finish),c=document.createElement('canvas'),left=(20-Math.floor(width/2))*64-16,top=1100;
            c.width=width*64+32;c.height=800;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.translate(-left,-top);
            const tiles=plan.edits.map(([key])=>key.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
            for(const[x,y]of tiles)drawStairs(g,d,x,y);
            const data=g.getImageData(0,0,c.width,c.height).data,rows=[];
            for(let y=0;y<c.height;y++){
              let first=-1,last=-1;
              for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>=200){if(first<0)first=x;last=x;}
              if(first>=0)rows.push({y,first,last});
            }
            if(!rows.length)throw Error('No stair artwork rendered for '+finish+' '+direction);
            const firstY=rows[0].y+2,lastY=rows.at(-1).y-2,interior=rows.filter(r=>r.y>=firstY&&r.y<=lastY);
            const bad=interior.filter(r=>r.first!==16||r.last!==16+width*64-1);
            checks.push({finish,direction,width,passed:interior.length>100&&bad.length===0,rows:interior.length,badRows:bad.length,example:bad[0]||null});
            if(width===3){
              const image=document.createElement('canvas');image.width=360;image.height=460;const ctx=image.getContext('2d');ctx.imageSmoothingEnabled=false;
              render(ctx,d,{x:1312,y:1520,zoom:.9},360,460);
              gallery.push({finish,direction,url:image.toDataURL()});
            }
          }
          for(const finish of ['stone','wood','brick']){
            const c=catalog.get('steps-'+finish).canvas,data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
            let bad=0;
            for(let y=2;y<c.height-2;y++)if(data[(y*c.width)*4+3]<200||data[(y*c.width+c.width-1)*4+3]<200)bad++;
            checks.push({finish,kind:'decorative flight',passed:bad===0,rows:c.height-4,badRows:bad});
          }
          return {checks,gallery,project:fixture('north',3,'stone').d,runtimeURL};
        }''')
        for check in result['checks']:
            print(json.dumps(check), flush=True)
        assert all(check['passed'] for check in result['checks']), 'North/south stair art still has tapered or angled side bounds.'

        # The fixture goes through the normal save/play flow; both screens use
        # identical static rendering with the same production stair modules.
        page.locator('#file').set_input_files({'name':'topdown.json','mimeType':'application/json','buffer':json.dumps(result['project']).encode()})
        page.wait_for_function('townBuilder.project.name==="Top-down stair regression"')
        capture='''async ({url,game})=>{const{render}=await import(url),c=document.createElement('canvas');c.width=360;c.height=460;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,game?townGame.project:townBuilder.project,{x:1312,y:1520,zoom:.9},360,460);return c.toDataURL();}'''
        before=page.evaluate(capture,{'url':result['runtimeURL'],'game':False})
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame')
        assert before==page.evaluate(capture,{'url':result['runtimeURL'],'game':True}), 'Editor/game stair rendering differs.'

        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
          const gallery=document.createElement('div');gallery.id='stairsGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(3,360px);gap:12px;background:#20382b;padding:12px;width:1128px;color:#f5e3ba;font:18px Georgia';
          for(const direction of ['north','south'])for(const finish of ['stone','wood','brick']){
            const sample=samples.find(s=>s.finish===finish&&s.direction===direction),tile=document.createElement('div'),img=document.createElement('img');
            img.src=sample.url;img.width=360;img.height=460;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';
            tile.append(document.createTextNode(finish[0].toUpperCase()+finish.slice(1)+' · ascent '+direction),img);gallery.append(tile);
          }
          document.body.append(gallery);
        }''',result['gallery'])
        page.locator('#stairsGallery').screenshot(path=str(ROOT/'docs/town-preview/stairs-topdown.png'))
        assert not errors,errors
        browser.close()
finally:
    server.shutdown()

print('Actual stone/wood/brick north/south stairs keep parallel sides at widths 1 and 3; editor/game pixel parity passed.')
