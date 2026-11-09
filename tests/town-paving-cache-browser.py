"""Native-pixel and edit-invalidation regression checks for cached town paving.

Run with: python tests/town-paving-cache-browser.py
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1200, 'height': 900})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder', timeout=120000)
        result = page.evaluate('''async()=>{
          const {drawGround,drawMaterial,groundFrameKey}=await import('../world/ground-render.mjs?v=overview-fast-1');
          const {encodePaint}=await import('../world/ground-paint.mjs?v=overview-fast-1');
          const check=(ok,message)=>{if(!ok)throw Error(message);};
          const cv=document.createElement('canvas');cv.width=cv.height=96;
          const c=cv.getContext('2d',{willReadFrequently:true}),originalFill=CanvasRenderingContext2D.prototype.fillRect;
          let fills=0,parityCases=0;
          CanvasRenderingContext2D.prototype.fillRect=function(...args){fills++;return originalFill.apply(this,args);};
          const fresh=()=>{
            const d={cells:{},objects:[{asset:'music-square',x:2000,y:2000,scale:1,rotation:0}],edges:{}};
            for(let y=9;y<=11;y++)for(let x=9;x<=11;x++)d.cells[`${x},${y}`]={surface:'cobble',paving:'music-square',level:2};
            d.cells['9,10']={surface:'grass',level:0};return d;
          };
          function draw(d,{x=10,y=10,a=d.cells[`${x},${y}`],z=a.level*48,zoom=1,offset=.0,smooth=false,alpha=1,clip=false,direct=false}={}){
            c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,96,96);
            const X=x*64,Y=y*64-z;c.setTransform(zoom,0,0,zoom,12+offset-X*zoom,12+offset-Y*zoom);
            c.imageSmoothingEnabled=smooth;c.globalAlpha=alpha;c.save();
            if(clip){c.beginPath();c.arc(X+32,Y+32,30,0,Math.PI*2);c.clip();}
            const before=fills;
            if(direct)drawMaterial(c,d,a,x,y,X,Y);else drawGround(c,d,a,x,y,X,Y,groundFrameKey(d));
            c.restore();c.globalAlpha=1;
            return {pixels:Array.from(c.getImageData(0,0,96,96).data),fills:fills-before};
          }
          function parity(d,options={}){
            const actual=draw(d,options),expected=draw(d,{...options,direct:true});
            check(actual.pixels.every((v,i)=>v===expected.pixels[i]),`Pixel mismatch ${JSON.stringify(options)}`);
            parityCases++;return actual;
          }
          try{
            let d=fresh();check(parity(d).fills>0,'Cold tile did not render');
            check(parity(d).fills===0,'Warm pure paving rebuilt its pattern');
            for(const zoom of [.4,.8,1,1.3])for(const offset of [0,.35])parity(d,{zoom,offset});
            // A lower neighbor is excluded from blend interpolation but still
            // changes the real paving edge; mutating it must invalidate.
            d.cells['9,10'].surface='cobble';check(parity(d).fills>0,'Lower cobble neighbor left stale edge');
            d.cells['9,10']={surface:'grass',level:0,stairs:'south'};check(parity(d).fills>0,'Stair edit did not invalidate');
            delete d.cells['9,10'].stairs;check(parity(d).fills>0,'Removed stair left stale edge');
            d.cells['9,10'].bridge='ew';check(parity(d).fills>0,'Bridge edit did not invalidate');
            delete d.cells['9,10'].bridge;check(parity(d).fills>0,'Removed bridge left stale edge');
            for(const change of [()=>d.objects[0].x+=71,()=>d.objects[0].rotation=90,()=>d.objects[0].scale=1.25,()=>{
              const o=d.objects[0];d.cells[`${Math.floor(o.x/64)},${Math.floor(o.y/64)}`]={surface:'grass',level:4};
            },()=>d.objects.push({asset:'music-square',x:710,y:680,scale:1,rotation:0}),()=>d.objects.pop()]){
              change();check(parity(d).fills>0,'Property transform/elevation/add/remove did not invalidate');
            }
            d.cells['10,10'].paving='auto';check(parity(d).fills>0,'Paving donor selection did not invalidate');
            check(parity(d,{z:144}).fills>0,'A different projection reused the wrong elevation');
            for(const copy of [structuredClone(d),JSON.parse(JSON.stringify(d))]){
              check(parity(copy).fills>0,'Undo/reload document reused another document cache');
              check(parity(copy).fills===0,'Undo/reload document cannot warm its own cache');
            }
            // Curve under-layers and clipped tops must preserve the original
            // two-pass alpha compositing rather than flatten their edge pixels.
            d=fresh();const under={surface:'cobble',paving:'auto',level:0};
            check(parity(d,{a:under,z:96,clip:true}).fills>0,'Synthetic curve under-layer was flattened');
            d.cells['10,10'].curves=[{kind:'surface'}];
            check(parity(d,{clip:true}).fills>0,'Clipped top was flattened');
            delete d.cells['10,10'].curves;
            check(parity(d,{alpha:.5}).fills>0,'Translucent floor was flattened');
            check(parity(d,{smooth:true,zoom:.8}).fills>0,'Filtered floor was flattened');
            // Keep the existing blended-paint path and its edit invalidation.
            const weights=new Float64Array(16*16*2);for(let i=0;i<weights.length;i++)weights[i]=127.5;
            d.cells['10,10']={surface:'grass',level:2,paint:encodePaint([{surface:'grass'},{surface:'cobble',paving:'music-square'}],weights)};
            const firstBlend=draw(d),secondBlend=draw(d);check(firstBlend.pixels.every((v,i)=>v===secondBlend.pixels[i]),'Blend warm pixels changed');
            check(secondBlend.fills===0,'Blend no longer caches');
            d.cells['10,10'].paint=structuredClone(d.cells['10,10'].paint);check(draw(d).fills>0,'Blend paint replacement did not invalidate');
            // The shared cache must stay bounded while crossing a large map.
            const large={cells:{},objects:[],edges:{}};
            for(let y=0;y<65;y++)for(let x=0;x<64;x++)large.cells[`${x},${y}`]={surface:'cobble',paving:'music-square',level:0};
            c.imageSmoothingEnabled=false;c.globalAlpha=1;c.setTransform(1,0,0,1,0,0);
            for(let y=0;y<65;y++)for(let x=0;x<64;x++){
              c.setTransform(1,0,0,1,-x*64,-y*64);drawGround(c,large,large.cells[`${x},${y}`],x,y,x*64,y*64,'');
            }
            check(draw(large,{x:63,y:64}).fills===0,'Recent bounded-cache tile was lost');
            check(draw(large,{x:0,y:0}).fills>0,'Old paving tiles were retained without a bound');
            // Same visible work, with readback forcing Canvas raster completion.
            d=fresh();const a=d.cells['10,10'],X=640,Y=544,key=groundFrameKey(d),n=12000;
            c.imageSmoothingEnabled=false;c.globalAlpha=1;c.setTransform(1,0,0,1,-X,-Y);
            drawGround(c,d,a,10,10,X,Y,key);
            let t=performance.now();for(let i=0;i<n;i++)drawMaterial(c,d,a,10,10,X,Y);c.getImageData(0,0,64,64);const uncached=performance.now()-t;
            t=performance.now();for(let i=0;i<n;i++)drawGround(c,d,a,10,10,X,Y,key);c.getImageData(0,0,64,64);const cached=performance.now()-t;
            check(cached<uncached*.7,`Paving cache did not reduce work: ${cached}/${uncached}`);
            return {parityCases,draws:n,uncachedMs:uncached,cachedMs:cached};
          }finally{CanvasRenderingContext2D.prototype.fillRect=originalFill;}
        }''')
        assert not errors, errors
        print(json.dumps(result), flush=True)
        browser.close()
finally:
    server.shutdown()
