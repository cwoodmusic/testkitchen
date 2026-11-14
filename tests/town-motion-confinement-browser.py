"""Real canvas clipping at fractional camera scales, without loading native art."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/parallel-projection/motion-confinement'
OUT.mkdir(parents=True, exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(reduced_motion='no-preference')
        page.goto(f'http://127.0.0.1:{server.server_port}/town/world/apartment-motion.mjs')
        result = page.evaluate('''async()=>{
         const {createApartmentMotionRenderer}=await import('/town/world/apartment-motion.mjs'),check=(ok,message)=>{if(!ok)throw Error(message);};
         const mask=[[.22,.2],[.7,.22],[.66,.48],[.24,.46]],rows=[];let paths=0,canvases=0;
         const renderer=createApartmentMotionRenderer({reducedMotion:()=>false,createPath:()=>{paths++;return new Path2D();},createCanvas:()=>{canvases++;return document.createElement('canvas');}});
         const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
         for(const kind of ['arcade','lava']){
          const asset={id:'slanted-'+kind,w:100,h:176,motion:{kind,mask,seed:11,game:'unchanged-owner-game',palette:['#142739','#73c8b0','#ffdc98','#9183c7']},get canvas(){throw Error('Native art must not be read or repainted');}},before=JSON.stringify(asset.motion),item={x:50,y:176,w:100,h:176};
          for(const scale of [.5,1,1.7,4]){
           const width=Math.ceil(100*scale+16),height=Math.ceil(176*scale+16),allowed=make(width,height),g=allowed.getContext('2d');g.translate(6.325,6.125);g.scale(scale,scale);g.beginPath();mask.forEach(([u,v],i)=>g[i?'lineTo':'moveTo'](u*100,v*176));g.closePath();g.fill();const glass=pixels(allowed);let first=null,moving=0,painted=0;
           for(const time of [.5,2.25]){
            const out=make(width,height),c=out.getContext('2d');c.translate(6.325,6.125);c.scale(scale,scale);c.globalAlpha=.75;c.imageSmoothingEnabled=true;const transform=Array.from(c.getTransform().toFloat64Array());renderer.draw(c,asset,item,time);
            check(c.imageSmoothingEnabled&&c.globalAlpha===.75&&JSON.stringify(Array.from(c.getTransform().toFloat64Array()))===JSON.stringify(transform),'Caller state changed');
            const frame=pixels(out);let outside=0;for(let at=0;at<frame.length;at+=4){if(frame[at+3]){painted++;if(!glass[at+3])outside++;}if(first&&(frame[at]!==first[at]||frame[at+1]!==first[at+1]||frame[at+2]!==first[at+2]||frame[at+3]!==first[at+3]))moving++;}
            check(outside===0,kind+' at '+scale+' paints '+outside+' pixels outside declared glass');
            // A caller draw outside the glass must remain unclipped.
            c.globalAlpha=1;c.fillStyle='#ff0000';c.fillRect(0,0,4,4);const x=Math.floor(6.325+scale),y=Math.floor(6.125+scale);check(c.getImageData(x,y,1,1).data[3]>0,'Clip leaked into caller drawing');
            first??=frame;out.width=out.height=1;
           }
           check(painted>8&&moving>1,'Animation is missing');rows.push({kind,scale,painted,moving,outsideGlass:0});allowed.width=allowed.height=1;
          }
          const priorPaths=paths,priorCanvases=canvases,out=make(200,352),c=out.getContext('2d');for(let frame=0;frame<60;frame++)renderer.draw(c,asset,item,frame/60);check(paths===priorPaths&&canvases===priorCanvases,'Warm frames allocated paths/canvases');check(JSON.stringify(asset.motion)===before,'Owner motion identity changed');
         }
         return {rows,paths,canvases,cache:renderer.stats};
        }''')
        browser.close()
    (OUT / 'results.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({'cases': len(result['rows']), 'outsideGlassPixels': 0, 'paths': result['paths'],
                      'canvases': result['canvases'], 'warmFramesAllocate': False}), flush=True)
finally:
    server.shutdown()
