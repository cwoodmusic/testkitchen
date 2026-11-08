"""Standalone palette matching, native-art cache invalidation and shared scene review."""
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
        page = browser.new_page(viewport={'width':1600, 'height':900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const renderURL=new URL('/town/world/render.mjs',location.origin),code=await(await fetch(renderURL)).text();
          const helperLine=code.split(String.fromCharCode(10)).find(line=>line.includes('asset-color.mjs'));
          const colorURL=helperLine?new URL(helperLine.split("'")[1],renderURL).href:new URL('./asset-color.mjs',renderURL).href;
          const {assetImage,assetFilter}=await import(colorURL),catalog=townBuilder.catalog;
          const ids=['trees-0-480','trees-1-480','props-1-150','props-2-65','props-3-130','decor-01-01','decor-02-01','decor-02-05'];
          await Promise.all(ids.map(id=>catalog.get(id).ensureFull?.()));
          const checks=[];
          for(const id of ['music-square','estate-player','steps-stone','cliff-ivy']){
            const a=catalog.get(id);checks.push({id,unchanged:assetImage(a)===a.canvas});
          }
          for(const id of ids){
            const a=catalog.get(id),raw=a.canvas,graded=assetImage(a),r=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data,g=graded.getContext('2d').getImageData(0,0,graded.width,graded.height).data;
            let alpha=true,rawColor=0,gradedColor=0,changed=0;
            for(let i=0;i<r.length;i+=4){if(r[i+3]!==g[i+3])alpha=false;if(r[i+3]<128)continue;rawColor+=Math.max(r[i],r[i+1],r[i+2])-Math.min(r[i],r[i+1],r[i+2]);gradedColor+=Math.max(g[i],g[i+1],g[i+2])-Math.min(g[i],g[i+1],g[i+2]);if(r[i]!==g[i]||r[i+1]!==g[i+1]||r[i+2]!==g[i+2])changed++;}
            checks.push({id,alpha,changed,lessChroma:gradedColor<rawColor,cached:assetImage(a)===graded});
          }
          // A lazy pack switches canvases when native artwork arrives. A new
          // source identity must receive its own grade rather than cached pixels.
          let current=document.createElement('canvas');current.width=current.height=8;
          const lazy={group:'props',get canvas(){return current;}},first=assetImage(lazy);current=document.createElement('canvas');current.width=current.height=16;
          checks.push({id:'native upgrade',fresh:assetImage(lazy)!==first&&assetImage(lazy).width===16});
          const doc={version:1,name:'Shared palette review',spawn:{x:8192,y:7300},cells:{},edges:{},objects:[]};
          const add=(asset,x,y,scale=1,layer='objects')=>doc.objects.push({id:asset,asset,x,y,scale,rotation:0,collision:false,layer});
          add('music-square',8192,6850,.5,'ground');
          add('trees-0-480',7465,6650,.64);add('trees-1-480',8910,6690,.64);
          add('props-1-150',7670,7020,1.2);add('props-2-65',8770,6995,1.2);add('props-3-130',8475,7080,1.1);
          add('decor-01-01',7870,7080,1);add('decor-02-01',8120,7100,1.25);add('decor-02-05',8315,7090,1.25);
          let base=code.split(String.fromCharCode(10)).filter(line=>!line.includes('asset-color.mjs')).join(String.fromCharCode(10)).replaceAll('assetImage(a)','a.canvas');
          base=base.replace(/from ['"]([^'"]+)['"]/g,(_,spec)=>'from '+JSON.stringify(new URL(spec,renderURL).href));
          const rawModule=await import(URL.createObjectURL(new Blob([base],{type:'text/javascript'})));
          const gradedCode='import {assetImage} from '+JSON.stringify(colorURL)+';'+base.replace('c.drawImage(a.canvas,','c.drawImage(assetImage(a),');
          const gradedModule=await import(URL.createObjectURL(new Blob([gradedCode],{type:'text/javascript'})));
          const camera={x:8192,y:6680,zoom:.55},samples=[];
          for(const [label,module]of [['Before · raw standalone packs',rawModule],['Matched palette · same scene and ground',gradedModule]]){
            const c=document.createElement('canvas');c.width=900;c.height=650;const g=c.getContext('2d');g.imageSmoothingEnabled=false;module.render(g,doc,camera,900,650);samples.push({label,url:c.toDataURL()});
          }
          return {checks,samples,project:doc};
        }''')
        for check in result['checks']:
            print(json.dumps(check), flush=True)
            assert all(value for key,value in check.items() if key not in ['id','changed']), check
            if 'changed' in check:
                assert check['changed'] > 0, check
        page.locator('#file').set_input_files({'name':'palette.json','mimeType':'application/json','buffer':json.dumps(result['project']).encode()})
        page.wait_for_function('townBuilder.project.name==="Shared palette review"')
        capture='''async game=>{const{render}=await import('/town/world/render.mjs?color-parity'),c=document.createElement('canvas');c.width=900;c.height=650;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,game?townGame.project:townBuilder.project,{x:8192,y:6680,zoom:.55},900,650);return c.toDataURL();}'''
        editor=page.evaluate(capture,False)
        assert editor==result['samples'][1]['url'], 'Production renderer does not use the matched asset palette.'
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame')
        assert page.evaluate(capture,True)==editor, 'Editor/game asset colors differ.'
        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
          const gallery=document.createElement('div');gallery.id='colorGallery';gallery.style.cssText='display:flex;gap:12px;background:#20382b;padding:12px;width:1824px;color:#f5e3ba;font:20px Georgia';
          for(const sample of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=sample.url;img.width=900;img.height=650;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(sample.label),img);gallery.append(tile);}document.body.append(gallery);
        }''',result['samples'])
        page.locator('#colorGallery').screenshot(path=str(ROOT/'docs/town-preview/asset-color.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print('Standalone palette matching preserves alpha and approved scenes; native-art caching and editor/game palette parity passed.')
