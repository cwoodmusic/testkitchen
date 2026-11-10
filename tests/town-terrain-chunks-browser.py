"""Terrain chunk visual/animation checks in an isolated browser.

Run: python3 tests/town-terrain-chunks-browser.py
Native terrain is cached before the final camera resample, so fractional-zoom
grain pixels need not be bit-identical. This checks coarse colour/shore masks,
missing-pixel and seam bands, stable dry land, live water and edit/Undo refresh.
The source map is never rewritten.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import base64
import hashlib
import json

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'town/maps/coda-town-uploaded-3.json'
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=Path('/workspace/.onboarding/terrain-chunks-browser'))
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
source = MAP.read_bytes()
source_hash = hashlib.sha256(source).hexdigest()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1500, 'height': 1000})
        page.set_default_timeout(180000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def save_image(name, url):
            (args.output / (name + '.png')).write_bytes(base64.b64decode(url.split(',')[1]))

        page.expose_function('__saveTerrainChunkImage', save_image)
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/', timeout=180000)
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate(r'''async original=>{
          const app=new URL(document.querySelector('script[type="module"]').src);
          const url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
          const {drawTerrain}=await import(url('terrain-render'));
          const {terrainChunkStats}=await import(url('terrain-chunks'));
          const {setWaterTime}=await import(url('water-motion'));
          const {height}=await import(url('model'));
          const {paintGround}=await import(new URL('./ground-brush.mjs'+app.search,app));
          const doc=structuredClone(original),W=1280,H=900,pixelScale=.5,width=W*pixelScale,canvasHeight=H*pixelScale;
          const check=(condition,label)=>{if(!condition)throw Error(label);};
          function make(){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=canvasHeight;return {canvas,c:canvas.getContext('2d',{willReadFrequently:true})};}
          function render(target,cam,time,revision=0,raw=false){
            const c=target.c;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,width,canvasHeight);c.fillStyle='#101f19';c.fillRect(0,0,width,canvasHeight);
            c.setTransform(pixelScale,0,0,pixelScale,0,0);c.imageSmoothingEnabled=false;c.save();c.translate(W/2,H/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);
            const left=cam.x-W/2/cam.zoom,top=cam.y-H/2/cam.zoom;
            const bounds={x0:Math.max(0,Math.floor(left/64)-1),x1:Math.min(256,Math.ceil((left+W/cam.zoom)/64)+1),y0:Math.max(0,Math.floor(top/64)-1),y1:Math.min(192,Math.ceil((top+H/cam.zoom+48*9)/64)+1)};
            setWaterTime(time);drawTerrain(c,doc,bounds,{terrainRevision:revision,overview:false,terrainChunks:!raw,heightView:'art'});c.restore();
            return c.getImageData(0,0,width,canvasHeight).data;
          }
          function coarse(data,block=8){
            const out=[];for(let y=0;y<canvasHeight;y+=block)for(let x=0;x<width;x+=block){
              let r=0,g=0,b=0,n=0;for(let yy=y;yy<Math.min(y+block,canvasHeight);yy++)for(let xx=x;xx<Math.min(x+block,width);xx++){const i=(yy*width+xx)*4;r+=data[i];g+=data[i+1];b+=data[i+2];n++;}
              out.push([r/n,g/n,b/n]);
            }return out;
          }
          const water=rgb=>rgb[2]>rgb[0]*1.25&&rgb[1]>rgb[0]*1.25;
          const sky=(data,i)=>data[i]===16&&data[i+1]===31&&data[i+2]===25;
          function compare(a,b,cam){
            const A=coarse(a),B=coarse(b),deltas=A.map((p,i)=>Math.max(...p.map((v,k)=>Math.abs(v-B[i][k])))).sort((a,b)=>a-b);
            let shoreMismatch=0,holes=0,total=0,seamDelta=0,seamPixels=0,otherDelta=0,otherPixels=0;
            for(let i=0;i<A.length;i++)if(water(A[i])!==water(B[i]))shoreMismatch++;
            const scale=cam.zoom*pixelScale,tx=width/2-cam.x*scale,ty=canvasHeight/2-cam.y*scale;
            const seamXs=new Set(),seamYs=new Set();
            for(let x=Math.floor((cam.x-W/2/cam.zoom)/512);x<=Math.ceil((cam.x+W/2/cam.zoom)/512);x++)seamXs.add(Math.round(x*512*scale+tx));
            for(let y=Math.floor((cam.y-H/2/cam.zoom)/512);y<=Math.ceil((cam.y+H/2/cam.zoom)/512);y++)seamYs.add(Math.round(y*512*scale+ty));
            for(let y=0;y<canvasHeight;y++)for(let x=0;x<width;x++){
              const i=(y*width+x)*4;if(sky(b,i)&&!sky(a,i))holes++;
              const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
              if(seamXs.has(x)||seamYs.has(y)){seamDelta+=d;seamPixels++;}else{otherDelta+=d;otherPixels++;}total++;
            }
            const report={coarseMean:deltas.reduce((n,v)=>n+v,0)/deltas.length,coarseP95:deltas[Math.floor(deltas.length*.95)],waterMaskMismatch:shoreMismatch/A.length,extraSkyPixels:holes,seamMean:seamDelta/Math.max(1,seamPixels),otherMean:otherDelta/Math.max(1,otherPixels)};
            check(report.extraSkyPixels<=Math.max(8,total*.0001),'Cached terrain introduced sky-coloured holes: '+JSON.stringify(report));
            check(report.coarseMean<7&&report.coarseP95<20,'Terrain geometry/colour diverged beyond native-grain resampling: '+JSON.stringify(report));
            check(report.waterMaskMismatch<.02,'Cached shoreline water mask moved: '+JSON.stringify(report));
            check(report.seamMean<Math.max(20,report.otherMean*3+8),'Chunk seam bands differ disproportionately: '+JSON.stringify(report));
            return report;
          }
          const cases=[{name:'organic-shore',x:12500,y:9700,zoom:.48},{name:'ocean-shore',x:14500,y:9700,zoom:.48},{name:'courtyards',x:10500,y:7600,zoom:.8},{name:'fractional-pan',x:12500.375,y:9700.625,zoom:.37}];
          const stair=Object.entries(doc.cells).find(([,a])=>a.stairs);
          if(stair){const [x,y]=stair[0].split(',').map(Number),X=x*64+32,Y=y*64+32;cases.push({name:'stairs',x:X,y:Y-height(doc,X,Y),zoom:.8});}
          const reports=[];
          for(const cam of cases){
            const raw=make(),cached=make(),A=render(raw,cam,0,0,true);render(cached,cam,0);const B=render(cached,cam,0);
            const before=terrainChunkStats(cached.c),report={name:cam.name,camera:cam,...compare(A,B,cam)};
            render(cached,cam,0);const warm=terrainChunkStats(cached.c);check(warm.builds===before.builds&&warm.scans===before.scans,'A warm camera rebaked or scanned terrain');
            await __saveTerrainChunkImage(cam.name+'-raw',raw.canvas.toDataURL());await __saveTerrainChunkImage(cam.name+'-cached',cached.canvas.toDataURL());
            const C=render(cached,cam,1.75);let changedWater=0,dryChanged=0,dryPixels=0;
            const grass=(data,i)=>data[i+1]>data[i]*1.05&&data[i+1]>data[i+2]*1.25;
            for(let y=2;y<canvasHeight-2;y++)for(let x=2;x<width-2;x++){
              const i=(y*width+x)*4,changed=B[i]!==C[i]||B[i+1]!==C[i+1]||B[i+2]!==C[i+2];
              if(changed&&water([B[i],B[i+1],B[i+2]])&&water([C[i],C[i+1],C[i+2]]))changedWater++;
              if(grass(B,i)&&[-2,0,2].every(dy=>[-2,0,2].every(dx=>grass(B,((y+dy)*width+x+dx)*4)))){dryPixels++;if(changed)dryChanged++;}
            }
            check(dryChanged===0,'Static dry land changed when only water time advanced');
            if(cam.name==='ocean-shore')check(changedWater>100,'Visible ocean stopped animating');
            report.animation={changedWater,dryChanged,dryPixels};report.cache=warm;reports.push(report);
          }
          // Exercise actual brush paint plus elevation and Undo on a copied map.
          const entry=Object.entries(doc.cells).filter(([key,a])=>!a.curves?.length&&!a.stairs&&!a.bridge&&a.surface!=='water').sort(([ak],[bk])=>{
            const [ax,ay]=ak.split(',').map(Number),[bx,by]=bk.split(',').map(Number);return Math.hypot(ax*64-10500,ay*64-7600)-Math.hypot(bx*64-10500,by*64-7600);
          })[0];check(entry,'No dry edit fixture found');
          const [cx,cy]=entry[0].split(',').map(Number),X=cx*64+32,Y=cy*64+32,cam={name:'edit-undo',x:X,y:Y-height(doc,X,Y),zoom:.8},cached=make(),raw=make();
          const initial=render(cached,cam,0,0),saved=structuredClone(doc.cells),start=terrainChunkStats(cached.c);
          const plan=paintGround(doc,{x:X,y:Y},{size:180,hardness:.4,opacity:1,surface:entry[1].surface==='sand'?'dirt':'sand'});
          check(plan.changed,'Brush did not alter the isolated fixture');for(const [key,a]of plan.edits)doc.cells[key]=a;
          const painted=render(cached,cam,0,1),paintStats=terrainChunkStats(cached.c);check(paintStats.builds>start.builds,'Paint edit did not rebuild visible chunks');compare(render(raw,cam,0,1,true),painted,cam);
          doc.cells[entry[0]]={...doc.cells[entry[0]],level:Math.min(8,(doc.cells[entry[0]].level+1)%9)};
          const raised=render(cached,cam,0,2),raiseStats=terrainChunkStats(cached.c);check(raiseStats.builds>paintStats.builds,'Elevation edit did not rebuild projected chunks');compare(render(raw,cam,0,2,true),raised,cam);
          doc.cells=saved;const undone=render(cached,cam,0,3);let undoPixels=0;for(let i=0;i<initial.length;i++)if(initial[i]!==undone[i])undoPixels++;
          check(undoPixels===0,'Undo failed to restore the cached scene exactly');
          return {cases:reports,editUndo:{brushCells:plan.edits.length,paintBuilds:paintStats.builds-start.builds,elevationBuilds:raiseStats.builds-paintStats.builds,undoPixelDifferences:undoPixels},sourceUnchanged:JSON.stringify(original)===JSON.stringify(doc)};
        }''', json.loads(source))
        assert not errors, errors
        assert hashlib.sha256(MAP.read_bytes()).hexdigest() == source_hash
        result['sourceHash'] = source_hash
        result['pageErrors'] = errors
        (args.output / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result))
        browser.close()
finally:
    server.shutdown()
