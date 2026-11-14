"""Continuous ground fields, running-bond repeats and fractional zoom sampling."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import base64
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/review-3'
OUT.mkdir(parents=True, exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const appURL=document.querySelector('script[type="module"]').src,app=await(await fetch(appURL)).text();
          const runtimeURL=dependency(app,'runtime',appURL),groundURL=dependency(app,'ground-render',appURL),ground=await(await fetch(groundURL)).text();
          const {render}=await import(runtimeURL),{groundTexture}=await import(groundURL);
          const {groundTextures}=await import(dependency(ground,'ground-textures',groundURL));
          const {registerReviewGroundSurfaces}=await import('/town/asset-review/catalog-extras.mjs');
          const {prepareAssetPreview}=await import('/town/asset-review/preview.mjs');
          const catalog=new Map();registerReviewGroundSurfaces(catalog,{surfaces:['sand','sidewalk','brick'],groundTexture});
          const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          function difference(a,b){let unequal=0,max=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);max=Math.max(max,d);changed||=!!d;}if(changed)unequal++;}return {unequal,max};}
          const canvas=()=>{const c=document.createElement('canvas');c.width=320;c.height=240;return c;};
          const checks=[],captures=[],samples=[];
          const camera={x:8192.35,y:6144.7};
          for(const surface of ['sand','sidewalk','brick']){
            const source=groundTexture(surface),data=pixels(source);let mirrored=0,opaque=true;
            for(let y=0;y<512;y++)for(let x=0;x<256;x++){
              const a=(y*512+x)*4,b=(y*512+511-x)*4;
              if(data[a]===data[b]&&data[a+1]===data[b+1]&&data[a+2]===data[b+2])mirrored++;
            }
            for(let i=3;i<data.length;i+=4)if(data[i]!==255)opaque=false;
            samples.push({surface,opaque,mirrorIdenticalFraction:mirrored/(512*256)});
            const preview=await prepareAssetPreview(catalog.get('surface:'+surface));
            for(const zoom of [.2,.333,.45,.67,1,1.35])for(const level of [0,3]){
              const doc={version:1,name:'Ground field phase',cells:{},edges:{},objects:[],spawn:{x:8192,y:6144}};
              for(let y=50;y<143;y++)for(let x=80;x<177;x++)doc.cells[x+','+y]={surface,level};
              const before=JSON.stringify(doc),actual=canvas(),a=actual.getContext('2d');a.imageSmoothingEnabled=false;
              render(a,doc,{...camera,zoom},320,240,{terrainChunks:false});
              const reference=canvas(),r=reference.getContext('2d');r.imageSmoothingEnabled=zoom<1;r.imageSmoothingQuality='high';
              r.translate(160,120);r.scale(zoom,zoom);r.translate(-camera.x,-camera.y);
              const pattern=r.createPattern(source,'repeat');pattern.setTransform(new DOMMatrix().translate(0,-level*48));r.fillStyle=pattern;r.fillRect(0,-level*48,16384,12288);
              const parity=difference(pixels(actual),pixels(reference));
              checks.push({surface,zoom,level,kind:'production-raw-continuous-reference',...parity,mapUnchanged:before===JSON.stringify(doc)});
              const cached=canvas(),g=cached.getContext('2d');g.imageSmoothingEnabled=false;
              render(g,doc,{...camera,zoom},320,240);
              let cachedOpaque=true;for(let i=3,d=pixels(cached);i<d.length;i+=4)if(d[i]!==255)cachedOpaque=false;
              checks.push({surface,zoom,level,kind:'production-cached-terrain',opaque:cachedOpaque,mapUnchanged:before===JSON.stringify(doc)});
              if(level===0&&[.333,.45,1].includes(zoom))captures.push({file:surface+'-production-'+zoom+'.png',url:cached.toDataURL()});
              if(level!==0)continue;
              const reviewed=canvas(),v=reviewed.getContext('2d');v.imageSmoothingEnabled=false;v.translate(160,120);v.scale(zoom,zoom);v.translate(-768.35,-768.7);preview.draw(v);
              const expected=canvas(),e=expected.getContext('2d');e.imageSmoothingEnabled=zoom<1;e.imageSmoothingQuality='high';e.translate(160,120);e.scale(zoom,zoom);e.translate(-768.35,-768.7);e.fillStyle=e.createPattern(source,'repeat');e.fillRect(0,0,1536,1536);
              checks.push({surface,zoom,kind:'review-continuous-reference',...difference(pixels(reviewed),pixels(expected))});
              if([.333,.45,1].includes(zoom))captures.push({file:surface+'-review-'+zoom+'.png',url:reviewed.toDataURL()});
            }
          }
          // The brick motif must preserve both course rhythm and half-brick
          // stagger at every translated repeat, including old mirror joins.
          const brick=groundTextures.brick,d=pixels(brick);let periodic=true;
          for(let y=0;y<512;y++)for(let x=0;x<512;x++)for(let k=0;k<4;k++)if(d[(y*512+x)*4+k]!==d[((y%32)*512+x%64)*4+k])periodic=false;
          const gray=(x,y)=>{const i=(y*512+x)*4;return d[i]-d[i+1]<35&&d[i+1]-d[i+2]<25&&d[i+1]>60;};
          const runningBond={periodic,firstCourseJoint:gray(32,8),firstCourseHalfBrick:gray(16,8),secondCourseJoint:gray(15,24)||gray(16,24),secondCourseHalfBrick:gray(32,24)};
          return {samples,checks,captures,runningBond};
        }''')
        for item in result.pop('captures'):
            (OUT / item['file']).write_bytes(base64.b64decode(item['url'].split(',')[1]))
        for item in result['samples']:
            assert item['opaque'], item
            if item['surface'] in ['sand', 'brick']:
                assert item['mirrorIdenticalFraction'] < .05, item
        for check in result['checks']:
            if 'unequal' in check:
                assert check['unequal'] == 0, check
            if 'opaque' in check:
                assert check['opaque'], check
            if 'mapUnchanged' in check:
                assert check['mapUnchanged'], check
        bond = result['runningBond']
        assert bond['periodic'] and bond['firstCourseJoint'] and bond['secondCourseJoint'], bond
        assert not bond['firstCourseHalfBrick'] and not bond['secondCourseHalfBrick'], bond
        assert not errors, errors
        result['pageErrors'] = errors
        (OUT / 'ground-repeat-browser-results.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'checks': len(result['checks']), 'samples': result['samples'], 'runningBond': bond, 'pageErrors': errors}))
        browser.close()
finally:
    server.shutdown()

print('Ground repeat, world/elevation phase, native/fractional zoom, review sampling, opacity and unchanged map checks passed.')
