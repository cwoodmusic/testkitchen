"""Fountain pools and falling jets move without altering their native stonework."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import threading

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1500, 'height': 1000})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(base+'/town/builder/')
        page.wait_for_function('!!window.townBuilder', timeout=90000)
        info = page.evaluate('''async()=>{
          const entry=document.querySelector('script[type="module"]').src,code=await(await fetch(entry)).text();
          const find=(text,needle,url)=>new URL(text.split(String.fromCharCode(10)).find(line=>line.includes(needle)).split("'")[1],url).href;
          const catalog=find(code,'../world/catalog.mjs',entry),runtime=find(code,'../world/runtime.mjs',entry),r=await(await fetch(runtime)).text();
          const renderer=find(r,'./render.mjs',runtime),renderCode=await(await fetch(renderer)).text();
          return {catalog,runtime,renderer,lawn:find(renderCode,'./asset-lawn.mjs',renderer),module:find(renderCode,'./fountain-motion.mjs',renderer)};
        }''')
        result = page.evaluate('''async({catalog,runtime,lawn,module})=>{
          const {catalog:assets,preparePlacedArt,render}=await import(runtime),{assetMapImage}=await import(lawn),motion=await import(module),results=[];
          const proof=document.createElement('canvas');proof.width=1200;proof.height=900;const g=proof.getContext('2d');g.fillStyle='#21362c';g.fillRect(0,0,1200,900);g.fillStyle='#ead9ac';g.font='18px sans-serif';g.fillText('Native fountains · still frame',12,25);g.fillText('Native fountains · flowing jets and ripples',612,25);
          for(const[id,row]of [['music-square',0],['props-0-360',1]]){
            const a=assets.get(id);await a.ensureFull?.();const image=assetMapImage(a),w=image.width,h=image.height;
            const native=()=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;cv.getContext('2d').drawImage(image,0,0);return cv;};
            const pixels=cv=>cv.getContext('2d').getImageData(0,0,w,h).data;
            const shot=time=>{const cv=native();motion.drawFountainMotion(cv.getContext('2d'),a,image,time);return cv;};
            const before=native(),zero=shot(0),moving=shot(.75),again=shot(4.75),original=pixels(before),start=pixels(zero),animated=pixels(moving),loop=pixels(again),frame=motion.fountainFrame(a,image,.75);
            let changed=0,jetChanges=0,poolChanges=0,architectureChanges=0,zeroChanges=0,loopChanges=0;
            for(let y=0;y<h;y++)for(let x=0;x<w;x++){
              const i=(y*w+x)*4,same=original[i]===animated[i]&&original[i+1]===animated[i+1]&&original[i+2]===animated[i+2]&&original[i+3]===animated[i+3];
              if(!same){changed++;const X=x-frame.region.x,Y=y-frame.region.y,j=Y*frame.region.w+X;if(X<0||Y<0||X>=frame.region.w||Y>=frame.region.h||!frame.mask[j])architectureChanges++;else if(frame.jets[j])jetChanges++;else poolChanges++;}
              for(let k=0;k<4;k++){if(original[i+k]!==start[i+k])zeroChanges++;if(animated[i+k]!==loop[i+k])loopChanges++;}
            }
            const crop=id==='music-square'?{x:a.w*.37,y:a.h*.29,w:a.w*.26,h:a.h*.32}:{x:0,y:0,w:a.w,h:a.h};
            for(const[cv,col]of [[before,0],[moving,1]]){const scale=Math.min(560/crop.w,390/crop.h),dx=col*600+(600-crop.w*scale)/2,dy=42+row*425+(400-crop.h*scale)/2;g.imageSmoothingEnabled=false;g.drawImage(cv,crop.x,crop.y,crop.w,crop.h,dx,dy,crop.w*scale,crop.h*scale);}
            const d={version:1,name:'Fountain animation proof',cells:{},edges:{},objects:[{id:'test',asset:id,x:8192,y:6144,scale:1,rotation:0,layer:'ground',collision:true}],spawn:{x:8192,y:6200}},saved=JSON.stringify(d);
            const field=t=>{const cv=document.createElement('canvas');cv.width=900;cv.height=700;const cam={x:8192,y:6144-a.h*.5,zoom:Math.min(.65,650/a.h)};render(cv.getContext('2d'),d,cam,900,700,{time:t,night:false});return cv.getContext('2d').getImageData(0,0,900,700).data;};
            const first=field(0),later=field(.75);let productionChanges=0;for(let i=0;i<first.length;i+=4)if(first[i]!==later[i]||first[i+1]!==later[i+1]||first[i+2]!==later[i+2])productionChanges++;
            results.push({id,changed,jetChanges,poolChanges,architectureChanges,zeroChanges,loopChanges,productionChanges,unchanged:JSON.stringify(d)===saved,cropPixels:frame.width*frame.height,assetPixels:w*h});
          }
          window.fountainMotionProof=proof.toDataURL();return results;
        }''', info)
        for item in result:
            assert item['changed'] > 1000, item
            assert item['jetChanges'] > 100, item
            assert item['poolChanges'] > 100, item
            assert item['architectureChanges'] == 0, item
            assert item['zeroChanges'] == 0, item
            assert item['loopChanges'] == 0, item
            assert item['productionChanges'] > 100, item
            assert item['unchanged'], item
        Path('/tmp/fountain-motion-native.png').write_bytes(base64.b64decode(page.evaluate('fountainMotionProof').split(',')[1]))
        page.emulate_media(reduced_motion='reduce')
        assert page.evaluate('''async({runtime,lawn,module})=>{
          const {catalog}=await import(runtime),{assetMapImage}=await import(lawn),{drawFountainMotion}=await import(module),a=catalog.get('props-0-360'),image=assetMapImage(a),cv=document.createElement('canvas');cv.width=a.w;cv.height=a.h;const c=cv.getContext('2d');c.drawImage(image,0,0);const before=c.getImageData(0,0,a.w,a.h).data;drawFountainMotion(c,a,image,1);const after=c.getImageData(0,0,a.w,a.h).data;return before.every((v,i)=>v===after[i]);
        }''', info)
        assert not errors, errors
        print('Fountain motion browser checks passed:', result)
        browser.close()
finally:
    server.shutdown()
