"""Exercise the real ZIP download on an isolated small catalog subset."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from io import BytesIO
from pathlib import Path
from threading import Thread
import argparse,hashlib,json,zipfile
from urllib.parse import unquote,urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT,collection_graph,assert_frozen
parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/facing-export-final'));parser.add_argument('--south-overrides',action='store_true',help='Export two corrected legacy South assets and one collection South asset (expanded if present); inspect real library/shop/inventory thumbnails.');parser.add_argument('--review-snapshot',type=Path,help='Rehearsal only: route asset URLs to an immutable private review snapshot.');args=parser.parse_args();graph=collection_graph();args.screenshots.mkdir(parents=True,exist_ok=True)
snapshot=json.loads(args.review_snapshot.read_text()) if args.review_snapshot else None
snapshot_routes=({
    '/town/assets/apartment-collections/':snapshot['apartmentImageRoot'],
    '/town/assets/furniture-facings/':snapshot['legacyImageRoot'],
    **snapshot.get('routeByURLSuffix',{})
} if snapshot else {})
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def translate_path(self,path):
        actual=unquote(urlsplit(path).path)
        for prefix,root in snapshot_routes.items():
            if actual.startswith(prefix):
                relative=Path(actual[len(prefix):])
                candidate=Path(root)/relative
                if '..' not in relative.parts and candidate.is_file():return str(candidate)
        return super().translate_path(path)
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120},accept_downloads=True);page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.expose_function('__exportProgress',lambda item:print(json.dumps(item),flush=True))
        if args.south_overrides:context.add_init_script("localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:10000,owned:[],rewards:[],earned:10000,spent:0}));")
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        loaded_graph=page.evaluate('''async()=>{const app=new URL(document.querySelector('script[type=module]').src),base=new URL('../assets/apartment-collections/',app),result={};for(const file of ['manifest.json','directions-manifest.json']){const bytes=await(await fetch(new URL(file+app.search,base))).arrayBuffer();result[file]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}return result;}''')
        if snapshot:
            assert loaded_graph['manifest.json']==snapshot['southSHA256'],('Wrong private South graph',loaded_graph)
            assert loaded_graph['directions-manifest.json']==snapshot['directionsSHA256'],('Wrong private direction graph',loaded_graph)
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        setup=page.evaluate('''async overrideMode=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{supportsFurnitureFacing}=await import(url('furniture-facing')),{assetFilter}=await import(url('asset-color')),catalog=townBuilder.catalog;
            const expandedAssets=overrideMode?[...catalog.values()].filter(a=>{const v=a.getFacingView?.('south',{image:false});return a.id.startsWith('collection-')&&supportsFurnitureFacing(a)&&v&&(v.w>a.w+.5||v.h>a.h+.5);}):[];
            const grown=overrideMode?((window.CodaFurnitureCatalog||[]).find(item=>expandedAssets.some(a=>a.id===item.asset))||(window.CodaFurnitureCatalog||[]).find(item=>item.asset==='collection-showroom-midcentury-studio-bed')):null;
            const exportAsset=overrideMode?(expandedAssets[0]?.id||grown?.asset):null;
            if(overrideMode&&(!grown||!exportAsset))throw Error('Missing corrected collection South fallback product.');
            const ids=overrideMode?['apartment-corner-kitchen-counter','beach-lifeguard-chair',exportAsset]:['collection-bach-bed','furniture-2-180','beach-deck-chair-north','collection-bach-poster','collection-bach-rug'],selected=ids.map(id=>{const a=catalog.get(id);if(!a)throw Error('Missing subsetasset '+id);return a;}),chairs=new Map(['south','west','north','east'].map(d=>[d,catalog.get('beach-deck-chair-'+d)]));
            if(overrideMode){for(const a of new Set([...selected,catalog.get(grown.asset)]))await a.ensureFull('south');window.__southOverrideAsset=exportAsset;window.__southOverrideProduct=grown;}
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
            if(overrideMode){const donors=new Map(catalog);catalog.clear();for(const a of selected)catalog.set(a.id,a);Object.defineProperty(catalog,'get',{configurable:true,value:function(id){return Map.prototype.get.call(this,id)||donors.get(id);}});if(catalog.size!==3)throw Error('Same Map subset isolation failed');}
            else Object.defineProperty(catalog,'values',{configurable:true,value:function*(){yield* selected;}});
            if([...catalog.values()].length!==ids.length)throw Error('Catalog enumeration isolation failed');return {ids,sourceTag:app.search,grown,exportAsset,expandedSouthAssets:expandedAssets.length,expandedSouthProducts:(window.CodaFurnitureCatalog||[]).filter(p=>expandedAssets.some(a=>a.id===p.asset)).length,expandedSouthBoundsExercised:!!exportAsset&&expandedAssets.some(a=>a.id===exportAsset)};
        }''',args.south_overrides)
        thumbnails=None
        if args.south_overrides:
            page.evaluate('''()=>{
                window.__exportRecording=false;
                window.__compareSouthThumb=async(canvas,kind,id)=>{
                    const app=new URL(document.querySelector('script[type=module]').src),{assetFilter}=await import(new URL('../world/asset-color.mjs'+app.search,app)),a=townBuilder.catalog.get(id||__southOverrideAsset),v=a.getFacingView('south',{image:false}),image=a.getFacingImage('south'),base=new URL('../assets/apartment-collections/',app);
                    // The real draw chooses a direct native atlas while it is resident,
                    // then an already-rastered native crop after LRU eviction. Compare
                    // both valid paths independently at the full metadata envelope.
                    window.__thumbSourceCache??=new Map();let source=__thumbSourceCache.get(a.id);
                    if(!source){const manifest=await(await fetch(new URL('manifest.json'+app.search,base))).json(),directions=await(await fetch(new URL('directions-manifest.json'+app.search,base))).json(),owner=manifest.collections.find(c=>c.owner===a.owner),override=directions.collections.find(c=>c.owner===a.owner)?.views?.south,entry=override?.cells?.some(c=>(c.id||'collection-'+a.owner+'-'+c.slot)===a.id)?{...owner,...override}:owner,frame=entry.cells.find(c=>(c.id||'collection-'+a.owner+'-'+c.slot)===a.id),bitmap=await createImageBitmap(await(await fetch(new URL(entry.file+app.search,base))).blob());source={bitmap,frame};__thumbSourceCache.set(a.id,source);}
                    const A=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,comparisons=[];let painted=0;for(let i=3;i<A.length;i+=4)if(A[i]>20)painted++;
                    for(const path of ['direct-native-atlas','native-crop']){const expected=document.createElement('canvas');expected.width=canvas.width;expected.height=canvas.height;const c=expected.getContext('2d');c.imageSmoothingEnabled=kind==='library';const fit=kind==='library'?Math.min(100/v.w,85/v.h):Math.min(90/v.w,90/v.h),x=(expected.width-v.w*fit)/2,y=kind==='library'?(85-v.h*fit)/2:95-v.h*fit;c.translate(x,y);c.scale(fit,fit);if(kind==='library')c.filter=assetFilter(a);
                        if(path==='native-crop')c.drawImage(image,0,0,v.w,v.h);else{const f=source.frame,s=Math.min(v.w/f.w,v.h/f.h),w=f.w*s,h=f.h*s;c.drawImage(source.bitmap,f.x,f.y,f.w,f.h,Math.max(0,(v.w-w)/2),Math.max(0,v.h-h),w,h);}
                        const B=c.getImageData(0,0,expected.width,expected.height).data;let differences=0;for(let i=0;i<A.length;i++)if(A[i]!==B[i])differences++;comparisons.push({path,differences});expected.width=expected.height=1;}
                    const match=comparisons.find(p=>p.differences===0);if(!match||painted<20)throw Error(kind+' South thumbnail differs from full native metadata fit: '+JSON.stringify(comparisons)+'/'+painted);
                    return {kind,id:a.id,original:{w:a.w,h:a.h},view:{w:v.w,h:v.h},canvas:{w:canvas.width,h:canvas.height},paintedPixels:painted,exactNativeFit:true,matchingNativePath:match.path};
                };
            }''')
            grown=setup['grown'];page.locator('#category').select_option('');page.locator('#search').fill(setup['exportAsset'])
            library=page.locator('#library button[data-asset="'+setup['exportAsset']+'"]');library.scroll_into_view_if_needed()
            page.wait_for_function('''()=>{const c=document.querySelector('#library button[data-asset="'+__southOverrideAsset+'"] canvas');return c&&c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>20);}''')
            library_result=library.locator('canvas').evaluate('(c)=>__compareSouthThumb(c,"library")')
            page.evaluate('townBuilder.urban.showShop()')
            shop=page.locator('.urban-dialog[open] .urban-catalog button').filter(has=page.get_by_text(grown['name'],exact=True))
            shop_result=shop.locator('canvas').evaluate('(c)=>__compareSouthThumb(c,"shop",__southOverrideProduct.asset)');shop.click()
            page.locator('.urban-dialog[open]').get_by_role('button',name='Buy · '+str(grown['price'])+' Notes',exact=True).click()
            page.wait_for_function('id=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)',arg=grown['id'])
            page.keyboard.press('Escape');page.evaluate('townBuilder.urban.showInventory()')
            inventory=page.locator('.urban-dialog[open] .urban-catalog button').filter(has=page.get_by_text(grown['name'],exact=True))
            inventory_result=inventory.locator('canvas').evaluate('(c)=>__compareSouthThumb(c,"inventory",__southOverrideProduct.asset)')
            wallet=page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1"))');assert wallet['balance']==10000-grown['price'] and wallet['owned'].count(grown['id'])==1
            page.keyboard.press('Escape')
            page.evaluate('''async()=>{const app=new URL(document.querySelector('script[type=module]').src),{clearApartmentCollectionCache}=await import(new URL('../world/apartment-collections.mjs'+app.search,app));clearApartmentCollectionCache();}''')
            page.locator('#rotation').select_option('270');library.click()
            page.wait_for_function('townBuilder.catalog.get(__southOverrideAsset).getFacingView("east",{image:false}).ready===true')
            page.wait_for_function('document.getElementById("status").textContent.startsWith("Ready to place ")')
            assert page.evaluate('townBuilder.tool')=='place'
            assert page.locator('#assetName').inner_text()==page.evaluate('townBuilder.catalog.get(__southOverrideAsset).name')
            page.locator('#rotation').select_option('0');page.evaluate('__exportCalls=[];__exportRecording=true')
            thumbnails={'library':library_result,'shop':shop_result,'inventory':inventory_result,'purchaseDebitedOnce':True,'coldRotatedLibrarySelectionReady':True,'expandedSouthAssets':setup['expandedSouthAssets'],'expandedSouthProducts':setup['expandedSouthProducts'],'expandedSouthBoundsExercised':setup['expandedSouthBoundsExercised']}
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
        assert len(checked)==(12 if args.south_overrides else 14)
        ground=[n for n in names if n.startswith('ground/') and n.endswith('.png')];assert ground
        for name in ground:Image.open(BytesIO(archive.read(name))).verify()
        assert 'bottom-center' in archive.read('README.txt').decode()
    assert_frozen(graph);result={'graph':graph,'loadedManifestHashes':loaded_graph,'reviewSnapshot':str(args.review_snapshot) if snapshot else None,'finalAcceptance':not bool(snapshot),'setup':setup,'download':download.suggested_filename,'exportedAssets':len(setup['ids']),'checkedViews':checked,'flatArtCanonicalSouth':not args.south_overrides,'authoredNorthChairRelativeFacingsExact':not args.south_overrides,'collisionMetadataExact':True,'nativePNGBytesExact':True,'southThumbnails':thumbnails,'sourceUnchanged':True,'pageErrors':errors};(args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'exportedAssets':len(setup['ids']),'checkedPNGs':len(checked),'southThumbnailChecks':bool(thumbnails),'expandedSouthAssets':setup['expandedSouthAssets'],'expandedSouthProducts':setup['expandedSouthProducts'],'expandedSouthBoundsExercised':setup['expandedSouthBoundsExercised'],'sourceUnchanged':True,'pageErrors':errors,'finalAcceptance':not bool(snapshot)}),flush=True)
finally:server.shutdown()
