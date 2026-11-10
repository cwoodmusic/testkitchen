"""Exercise the real ZIP download on an isolated five-asset catalog subset."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
import argparse,hashlib,json,zipfile
from PIL import Image
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen
parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/facing-export-final'));args=parser.parse_args();graph=collection_graph();args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120},accept_downloads=True);page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.expose_function('__exportProgress',lambda item:print(json.dumps(item),flush=True))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        setup=page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{supportsFurnitureFacing}=await import(url('furniture-facing')),{assetFilter}=await import(url('asset-color')),catalog=townBuilder.catalog;
            const ids=['collection-bach-bed','furniture-2-180','beach-deck-chair-north','collection-bach-poster','collection-bach-rug'],selected=ids.map(id=>{const a=catalog.get(id);if(!a)throw Error('Missing subsetasset '+id);return a;}),chairs=new Map(['south','west','north','east'].map(d=>[d,catalog.get('beach-deck-chair-'+d)]));
            window.__exportCalls=[];window.__exportRecording=true;
            for(const a of selected){const original=a.ensureFull;a.ensureFull=async function(direction='south'){if(__exportRecording){__exportCalls.push({id:a.id,direction});await __exportProgress({asset:a.id,direction,state:'loading'});}await original?.call(a,direction);if(__exportRecording)await __exportProgress({asset:a.id,direction,state:'ready'});};}
            window.__exportReferences=async()=>{
                window.__exportRecording=false;const refs=[];const digest=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(v=>v.toString(16).padStart(2,'0')).join('');
                for(const a of selected){const upright=supportsFurnitureFacing(a),base=a.id==='beach-deck-chair-north'?'north':'south',directions=upright?[['south',0],['west',90],['north',180],['east',270]]:[['south',0]],views=[];
                    for(const [relative,rotation]of directions){await a.ensureFull(relative);const list=['south','west','north','east'],actual=list[(list.indexOf(base)+list.indexOf(relative))%4],v=a.getFacingView(relative),native=a.id==='beach-deck-chair-north'?chairs.get(actual).canvas:a.getFacingImage(relative),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.w);canvas.height=Math.ceil(v.h);const c=canvas.getContext('2d');c.filter=assetFilter(a);c.drawImage(native,0,0,canvas.width,canvas.height);const hash=await digest(c.getImageData(0,0,canvas.width,canvas.height).data);views.push({relative,actual,rotation,width:v.w,height:v.h,pixelWidth:canvas.width,pixelHeight:canvas.height,footCenter:v.footCenter,hash,path:relative==='south'?'assets/'+a.id+'.png':'assets/facings/'+a.id+'-'+actual+'.png'});}
                    refs.push({id:a.id,upright,width:a.w,height:a.h,baseFacing:base,collision:a.boxes,polygons:a.polygons||[],views});
                }
                return {assets:refs,calls:__exportCalls};
            };
            // Keep lookup-only donors such as Music Square available to ground export.
            Object.defineProperty(catalog,'values',{configurable:true,value:function*(){yield* selected;}});
            if([...catalog.values()].length!==5)throw Error('Catalog enumeration isolation failed');return {ids,sourceTag:app.search};
        }''')
        with page.expect_download() as download_info:
            page.locator('#pack').click()
            page.wait_for_function('!document.getElementById("pack").disabled',timeout=90000)
            export_status=page.locator('#status').inner_text();print(json.dumps({'exportStatus':export_status}),flush=True)
            assert 'failed' not in export_status.lower(),export_status
        download=download_info.value;archive_path=args.screenshots/'asset-pack.zip';download.save_as(str(archive_path));assert not download.failure()
        page.wait_for_function('!document.getElementById("pack").disabled');assert 'downloaded' in page.locator('#status').inner_text().lower()
        reference=page.evaluate('__exportReferences()');assert not errors,errors;browser.close()
    with zipfile.ZipFile(archive_path) as archive:
        names=archive.namelist();assert len(names)==len(set(names));meta=json.loads(archive.read('catalog.json'));assert {a['id'] for a in meta}==set(setup['ids']);by_id={a['id']:a for a in meta};checked=[]
        for expected in reference['assets']:
            actual=by_id[expected['id']];assert actual['width']==expected['width'] and actual['height']==expected['height'];assert actual['collision']==expected['collision'] and actual['polygons']==expected['polygons']
            calls=[x['direction'] for x in reference['calls'] if x['id']==expected['id']]
            assert set(calls)==({'south','west','north','east'} if expected['upright'] else {'south'}),(expected['id'],calls)
            if expected['upright']:assert set(actual['facings'])=={'south','west','north','east'}
            else:assert 'facings' not in actual,'Flat poster/rug exported unused upright views'
            for view in expected['views']:
                png=Image.open(BytesIO(archive.read(view['path']))).convert('RGBA');assert png.size==(view['pixelWidth'],view['pixelHeight']);assert hashlib.sha256(png.tobytes()).hexdigest()==view['hash'],view['path']
                if expected['upright']:
                    facing=actual['facings'][view['actual']];assert facing['image']==view['path'];assert facing['width']==view['width'] and facing['height']==view['height'];assert facing['footCenter']==view['footCenter'];assert facing['rotation']==view['rotation']
                checked.append({'asset':expected['id'],'actualFacing':view['actual'],'relativeFacing':view['relative'],'rotation':view['rotation'],'png':view['path'],'nativePixelsExact':True})
        assert len(checked)==14
        ground=[n for n in names if n.startswith('ground/') and n.endswith('.png')];assert ground
        for name in ground:Image.open(BytesIO(archive.read(name))).verify()
        assert 'bottom-center' in archive.read('README.txt').decode()
    assert_frozen(graph);result={'graph':graph,'setup':setup,'download':download.suggested_filename,'exportedAssets':5,'checkedViews':checked,'flatArtCanonicalSouth':True,'authoredNorthChairRelativeFacingsExact':True,'collisionMetadataExact':True,'nativePNGBytesExact':True,'sourceUnchanged':True,'pageErrors':errors};(args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'exportedAssets':5,'checkedPNGs':len(checked),'sourceUnchanged':True,'pageErrors':errors}),flush=True)
finally:server.shutdown()
