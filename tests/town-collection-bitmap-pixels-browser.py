"""Compare live bitmap-backed native views to decoded DOM-image RGBA references."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,json
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen,bitmap_probe_script
parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path,default=Path('/workspace/.onboarding/collection-facings-release/results.json'));parser.add_argument('--allow-changed',nargs='*',default=[],help='Exact id|direction keys for independently approved art corrections');parser.add_argument('--output',type=Path,default=Path('/workspace/.onboarding/collection-bitmap-pixels'));args=parser.parse_args();graph=collection_graph();baseline=json.loads(args.baseline.read_text());assert len(baseline['rows'])==3968;args.output.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120})
        context.add_init_script(bitmap_probe_script())
        page=context.new_page();page.set_default_timeout(240000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        report=page.evaluate('''async ({baseline,allowedChanges})=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),base=new URL('../assets/apartment-collections/',app),assetURL=file=>{const u=new URL(file,base);u.search=app.search;return u;};
            const {APARTMENT_COLLECTIONS,APARTMENT_COLLECTION_ASSETS,getApartmentCollectionRuntimeStats}=await import(url('apartment-collections')),{createApartmentCollectionRuntime}=await import(url('apartment-collection-runtime'));
            const manifest=await (await fetch(assetURL('manifest.json'))).json(),directions=await (await fetch(assetURL('directions-manifest.json'))).json();
            const domImage=file=>new Promise((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=async()=>{im.onload=im.onerror=null;try{if(im.decode)await im.decode();resolve(im);}catch(e){reject(e);}};im.onerror=()=>reject(Error('DOM reference load failed '+file));im.src=assetURL(file);});
            const thumbnails=new Map(await Promise.all(manifest.collections.map(async c=>[c.owner,await domImage(c.thumbnail)]))),reference=createApartmentCollectionRuntime({definitions:APARTMENT_COLLECTION_ASSETS,manifest,directionManifest:directions,thumbnails,loadImage:domImage,createCanvas:()=>document.createElement('canvas')});
            const allowed=new Set(allowedChanges),accepted=new Map(baseline.map(r=>[r.id+'|'+r.direction,r])),rows=[],mismatches=[],normalizedMismatches=[],digest=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(v=>v.toString(16).padStart(2,'0')).join('');
            for(const owner of APARTMENT_COLLECTIONS)for(const direction of ['south','west','north','east']){
                await Promise.all(owner.assets.flatMap(def=>[townBuilder.catalog.get(def.id).ensureFull(direction),reference.ensureAsset(def.id,direction)]));
                for(const def of owner.assets){
                    const live=townBuilder.catalog.get(def.id).getFacingView(direction),old=reference.view(def.id,direction),A=live.canvas,B=old.canvas;if(!live.ready||!old.ready||A.width!==B.width||A.height!==B.height)throw Error('Native dimensions/readiness differ '+def.id+'/'+direction);
                    const a=A.getContext('2d').getImageData(0,0,A.width,A.height).data,b=B.getContext('2d').getImageData(0,0,B.width,B.height).data;let changed=0,max=0,x0=A.width,y0=A.height,x1=-1,y1=-1;
                    for(let at=0;at<a.length;at+=4){if(a[at+3]>20){const n=at/4,x=n%A.width,y=Math.floor(n/A.width);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}const diff=Math.max(Math.abs(a[at]-b[at]),Math.abs(a[at+1]-b[at+1]),Math.abs(a[at+2]-b[at+2]),Math.abs(a[at+3]-b[at+3]));if(diff){changed++;max=Math.max(max,diff);}}
                    const hash=await digest(a),referenceHash=await digest(b);if(changed)mismatches.push({id:def.id,direction,changedPixels:changed,maxDifference:max,hash,referenceHash});
                    const w=x1-x0+1,h=y1-y0+1,cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;const s=Math.min(124/w,124/h);c.drawImage(A,x0,y0,w,h,(128-w*s)/2,(128-h*s)/2,w*s,h*s);const normalizedHash=await digest(c.getImageData(0,0,128,128).data),prior=accepted.get(def.id+'|'+direction);if(!prior||normalizedHash!==prior.hash)normalizedMismatches.push({id:def.id,direction,hash:normalizedHash,before:prior?.hash,allowed:allowed.has(def.id+'|'+direction)});
                    if(live.w!==old.w||live.h!==old.h||JSON.stringify(live.footCenter)!==JSON.stringify(old.footCenter))throw Error('Bitmap path changes facing metadata');rows.push({id:def.id,direction,nativeHash:hash,domNativeHash:referenceHash,normalizedHash,changedPixels:changed});
                }
                for(const stats of [reference.stats,getApartmentCollectionRuntimeStats()])if(stats.sourceEntries>4||stats.canvasEntries>192||stats.canvasPixels>4*1024*1024)throw Error('Native cache exceeds budget');
            }
            const bitmaps=__bitmapCalls.filter(x=>x.url.includes('/assets/apartment-collections/')&&!x.url.includes('-thumb')&&!x.url.includes('overview'));if(new Set(bitmaps.map(b=>new URL(b.url).pathname)).size!==124||bitmaps.some(b=>b.input!=='blob'))throw Error('The live native Blob bitmap path was not exercised for all124 sheets');
            reference.clear();return {views:rows.length,rows,mismatches,normalizedMismatches,bitmapNativeLoads:bitmaps.length,bitmapCalls:__bitmapCalls,liveRuntime:getApartmentCollectionRuntimeStats(),referenceAfterClear:reference.stats};
        }''',{'baseline':baseline['rows'],'allowedChanges':args.allow_changed})
        assert not errors,errors;browser.close()
    assert_frozen(graph);report.update(graph=graph,acceptedBaseline=str(args.baseline),sourceUnchanged=True,pageErrors=errors);(args.output/'results.json').write_text(json.dumps(report,indent=2));assert report['views']==3968 and not report['mismatches'] and not any(not r['allowed'] for r in report['normalizedMismatches']) and {r['id']+'|'+r['direction'] for r in report['normalizedMismatches']}==set(args.allow_changed),{'pixelMismatches':report['mismatches'][:5],'signatureMismatches':report['normalizedMismatches'][:5]};print(json.dumps({'views':3968,'fullRGBAChanges':0,'unchangedAcceptedSignatures':3968-len(report['normalizedMismatches']),'approvedArtChanges':len(report['normalizedMismatches']),'bitmapNativeLoads':report['bitmapNativeLoads'],'sourceUnchanged':True,'pageErrors':errors}),flush=True)
finally:server.shutdown()
