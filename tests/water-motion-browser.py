"""Native water moves continuously while dry terrain and physical shores stay fixed."""
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
          const module=renderCode.includes('./water-motion.mjs')?find(renderCode,'./water-motion.mjs',renderer):new URL('water-motion.mjs',renderer).href;
          return {catalog,runtime,renderer,module,integrated:renderCode.includes('./water-motion.mjs')};
        }''')
        result = page.evaluate('''async({catalog,module})=>{
          const {sources}=await import(catalog),water=await import(module),source=sources.ground[3],still=water.waterFrame(source,0),w=still.width,h=still.height;
          const canvas=()=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
          const pixels=cv=>cv.getContext('2d').getImageData(0,0,w,h).data;
          const shot=time=>{const cv=canvas();cv.getContext('2d').drawImage(water.waterFrame(source,time),0,0);return cv;};
          const a=shot(0),b=shot(3.25),loop=shot(15.25),native=pixels(a),moving=pixels(b),repeat=pixels(loop);
          let changed=0,wrongLoop=0;for(let i=0;i<native.length;i+=4){if(native[i]!==moving[i]||native[i+1]!==moving[i+1]||native[i+2]!==moving[i+2])changed++;for(let k=0;k<4;k++)if(moving[i+k]!==repeat[i+k])wrongLoop++;}
          const palette=new Set(new Uint32Array(native.buffer)),palettePreserved=[...new Uint32Array(moving.buffer)].every(pixel=>palette.has(pixel));
          const tiled=canvas(),c=tiled.getContext('2d');water.setWaterTime(3.25);
          for(let y=0;y<h/64;y++)for(let x=0;x<w/64;x++)water.drawAnimatedWater(c,source,x,y,x*64,y*64);
          const actual=pixels(tiled);let tileMismatch=0;for(let i=0;i<actual.length;i++)if(actual[i]!==moving[i])tileMismatch++;
          // Cover the middle mirror joins AND the period wrapping into the
          // next field, where the original source showed a brightness panel.
          const seamColumns=[0,source.width],seamRows=[0,source.height];let stillSeamMismatch=0;
          for(const x of seamColumns)for(let y=0;y<h;y++)for(let k=0;k<4;k++)if(native[(y*w+x)*4+k]!==native[(y*w+(x+w-1)%w)*4+k])stillSeamMismatch++;
          for(const y of seamRows)for(let x=0;x<w;x++)for(let k=0;k<4;k++)if(native[(y*w+x)*4+k]!==native[(((y+h-1)%h)*w+x)*4+k])stillSeamMismatch++;
          const edge=document.createElement('canvas');edge.width=edge.height=128;const eg=edge.getContext('2d'),reference=document.createElement('canvas');reference.width=reference.height=128;const rg=reference.getContext('2d');
          for(let y=0;y<2;y++)for(let x=0;x<2;x++)water.drawAnimatedWater(eg,source,w/64-1+x,h/64-1+y,x*64,y*64);
          const movingField=water.waterFrame(source,3.25);for(let y=0;y<2;y++)for(let x=0;x<2;x++)rg.drawImage(movingField,x?0:w-64,y?0:h-64,64,64,x*64,y*64,64,64);
          const e=eg.getImageData(0,0,128,128).data,r=rg.getImageData(0,0,128,128).data;let periodMismatch=0;for(let i=0;i<e.length;i++)if(e[i]!==r[i])periodMismatch++;
          const lineJump=x=>{let total=0;for(let y=0;y<h;y++)for(let k=0;k<3;k++)total+=Math.abs(moving[(y*w+x)*4+k]-moving[(y*w+(x+w-1)%w)*4+k]);return total/(h*3);};
          const ordinaryJumps=Array.from({length:w-2},(_,i)=>lineJump(i+1)).sort((a,b)=>a-b),seamJump=Math.max(...seamColumns.map(lineJump)),typicalJump=ordinaryJumps[Math.floor(ordinaryJumps.length*.95)];
          const sameCache=water.waterFrame(source,3.25)===water.waterFrame(source,3.25);
          const started=performance.now();for(let frame=0;frame<24;frame++){water.setWaterTime(frame/12);for(let y=0;y<8;y++)for(let x=0;x<8;x++)water.drawAnimatedWater(c,source,x,y,x*64,y*64);}const milliseconds=(performance.now()-started)/24;
          const proof=document.createElement('canvas');proof.width=w*2;proof.height=h+34;const g=proof.getContext('2d');g.fillStyle='#172b2b';g.fillRect(0,0,proof.width,proof.height);g.fillStyle='#e6d5a1';g.font='16px sans-serif';g.fillText('Native water · still frame',12,23);g.fillText('Native water · moving wavelets (3.25s)',w+12,23);g.drawImage(a,0,34);g.drawImage(b,w,34);window.waterMotionProof=proof.toDataURL();
          return {changed,pixels:w*h,wrongLoop,palettePreserved,tileMismatch,stillSeamMismatch,periodMismatch,seamJump,typicalJump,sameCache,milliseconds};
        }''', {'catalog': info['catalog'], 'module': info['module']})
        assert result['changed'] > result['pixels']*.4, result
        assert result['wrongLoop'] == 0, result
        assert result['palettePreserved'], result
        assert result['tileMismatch'] == 0, result
        assert result['sameCache'], result
        assert result['stillSeamMismatch'] == 0, result
        assert result['periodMismatch'] == 0, result
        assert result['seamJump'] <= result['typicalJump']*1.5, result
        assert result['milliseconds'] < 35, result
        import base64
        Path('/tmp/water-motion-native.png').write_bytes(base64.b64decode(page.evaluate('waterMotionProof').split(',')[1]))

        if info['integrated']:
            actual = page.evaluate('''async({runtime})=>{
              const {render}=await import(runtime),d={version:1,name:'Water animation proof',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};
              for(let y=91;y<=100;y++)for(let x=123;x<=132;x++)d.cells[x+','+y]={surface:x<129?'water':'sand',level:0};
              const before=JSON.stringify(d),w=800,h=600,cam={x:8192,y:6144,zoom:1};
              const shot=time=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;render(cv.getContext('2d'),d,cam,w,h,{time,night:false});return cv.getContext('2d').getImageData(0,0,w,h).data;};
              const a=shot(0),b=shot(3.25);let dryChanges=0,wetChanges=0;
              for(let y=0;y<h;y++)for(let x=0;x<w;x++){const X=x-w/2+cam.x,Y=y-h/2+cam.y,wet=d.cells[Math.floor(X/64)+','+Math.floor(Y/64)]?.surface==='water',i=(y*w+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]){if(wet)wetChanges++;else dryChanges++;}}
              return {dryChanges,wetChanges,unchanged:before===JSON.stringify(d)};
            }''', {'runtime': info['runtime']})
            assert actual['dryChanges'] == 0, actual
            assert actual['wetChanges'] > 20000, actual
            assert actual['unchanged'], actual
            page.evaluate('''async({runtime})=>{
              const {render}=await import(runtime),d={version:1,name:'Seamless ocean pier',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};
              for(let y=84;y<110;y++)for(let x=114;x<142;x++)d.cells[x+','+y]={surface:y<92?'sand':'water',level:y<92?1:0};
              for(let y=91;y<=101;y++)for(let x=127;x<=128;x++)Object.assign(d.cells[x+','+y],{bridge:'ns',finish:'wood',pier:{level:1,axis:'ns'}});
              const cv=document.createElement('canvas');cv.width=1400;cv.height=900;
              render(cv.getContext('2d'),d,{x:8192,y:6144,zoom:.85},cv.width,cv.height,{time:3.25,night:false});
              window.waterPierSeamProof=cv.toDataURL();
            }''', {'runtime': info['runtime']})
            Path('/tmp/water-pier-seams-fixed.png').write_bytes(base64.b64decode(page.evaluate('waterPierSeamProof').split(',')[1]))

        page.emulate_media(reduced_motion='reduce')
        assert page.evaluate('''async({catalog,module})=>{const {sources}=await import(catalog),water=await import(module);return water.waterFrame(sources.ground[3],5)===water.waterFrame(sources.ground[3],0);}''', {'catalog': info['catalog'], 'module': info['module']})
        assert not errors, errors
        print('Water motion browser checks passed:', result, 'production integration:', info['integrated'])
        browser.close()
finally:
    server.shutdown()
