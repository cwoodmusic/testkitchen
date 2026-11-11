"""Render all 31 furnished homes and reject renamed duplicate artwork.

This suite exercises native catalog canvases and complete interior rendering,
not hand-authored stand-ins. It changes an isolated guest profile only.
Run after the owner-specific collection integration is ready.
"""
from functools import partial
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import base64
import hashlib
import json
import statistics

from playwright.sync_api import sync_playwright
from town_browser_compat import assert_original_furniture_stock

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'town/maps/coda-town-uploaded-3.json'
parser = argparse.ArgumentParser()
parser.add_argument('--performance', action='store_true', help='Measure real interior frame callbacks after native artwork warmup')
parser.add_argument('--screenshots', type=Path, default=Path('/workspace/.onboarding/apartment-collections'))
args = parser.parse_args()
args.screenshots.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(MAP.read_bytes()).hexdigest()
legacy = {'id': 'room-legacy-geranium', 'item': 'furniture-geranium', 'asset': 'decor-08-01', 'x': 1800, 'y': 900, 'scale': 1}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1740, 'height': 1120})
        context.add_init_script('''(()=>{
            if(localStorage.getItem('__collectionsQASeed'))return;
            localStorage.setItem('__collectionsQASeed','1');
            localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,owned:['furniture-geranium'],rewards:[],earned:170,spent:20}));
            localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));
        })()''')
        context.add_init_script('''(()=>{const raf=requestAnimationFrame;window.__collectionFrames=null;window.requestAnimationFrame=fn=>raf.call(window,t=>{const start=performance.now();try{return fn(t);}finally{if(window.__collectionFrames&&fn.name==='frame')__collectionFrames.push({at:t,cpu:performance.now()-start});}});})()''')
        page = context.new_page()
        page.set_default_timeout(180000)
        errors = []
        native_requests = []
        page.on('request', lambda request: native_requests.append(request.url) if '/assets/apartment-collections/' in request.url and request.url.split('?')[0].endswith('.webp') and '-thumb.' not in request.url else None)
        page.on('pageerror', lambda error: errors.append(str(error)))

        def save_image(name, data):
            (args.screenshots / (name + '.png')).write_bytes(base64.b64decode(data.split(',')[1]))

        page.expose_function('__saveCollectionImage', save_image)
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        original_stock=assert_original_furniture_stock(page)
        page.locator('#file').set_input_files(str(MAP))
        page.wait_for_function('townBuilder.project.objects.length===120')
        report = page.evaluate(r'''async()=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=name=>new URL('../world/'+name+'.mjs'+app.search,app);
            const {getInterior,renderInterior,residents,STORE_FOOTPRINT,getInteriorRenderCacheStats}=await import(url('urban-interiors'));
            const {SHOWROOMS}=await import(url('showroom-layout')),{assetImage}=await import(url('asset-color')),{preparePlacedFacingArt}=await import(url('furniture-art-access')),{cardinalFacing}=await import(url('furniture-facing'));
            const {warmHomeMaterials,getHomeMaterialCacheStats}=await import(url('home-materials')),{warmInteriorPortalArt,interiorPortalArtReady}=await import(url('interior-portal-art')),{warmTowerCommonMaterials,towerCommonMaterialsReady}=await import(url('tower-common-materials'));
            window.__warmCollectionScene=async scene=>{const model=getInterior(scene);await Promise.all([preparePlacedFacingArt({objects:[...model.items,...(model.doors||[])]},townBuilder.catalog),warmHomeMaterials(model.homeMaterialSuite),warmInteriorPortalArt(),warmTowerCommonMaterials()]);if(!interiorPortalArtReady()||!towerCommonMaterialsReady())throw Error('Architectural native textures are not ready');return model;};
            const {drawApartmentMotion,getApartmentMotionStats,createApartmentMotionRenderer}=await import(url('apartment-motion'));
            const {APARTMENT_COLLECTIONS,getApartmentCollectionRuntimeStats}=await import(url('apartment-collections'));
            const check=(b,m)=>{if(!b)throw Error(m);},catalog=townBuilder.catalog;
            const owners=[...residents.map(r=>({id:r.id,scene:{kind:'apartment',resident:r.id,floor:r.floor}})),{id:'player',scene:{kind:'apartment',resident:'player',floor:15}},...SHOWROOMS.map(r=>({id:'showroom-'+r.id,scene:{kind:'showroom',showroomId:r.id,floor:r.storeFloor}}))];
            check(SHOWROOMS.length===12&&owners.length===31,'Expected 18 resident homes, player home and twelve showrooms');check(SHOWROOMS.filter(r=>r.storeFloor===1).length===8&&SHOWROOMS.filter(r=>r.storeFloor===2).length===4,'Wrong store floor split');window.__collectionShowroomFloors=Object.fromEntries(SHOWROOMS.map(r=>[r.id,r.storeFloor]));check(getInterior({kind:'shop',floor:1}).id!==getInterior({kind:'shop',floor:2}).id,'Store floors share one cached model');check(window.CodaFurnitureCatalog.length===484,'Missing collection products');
            check(STORE_FOOTPRINT.width===3072&&STORE_FOOTPRINT.height===2048,'Store exterior floor plate changed');
            const placedByID=new Map(),byID=new Map(),byPixels=new Map(),records=[],duplicates=[],pixelDuplicates=[],motionReports=[],motionImages=[];
            const digest=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(n=>n.toString(16).padStart(2,'0')).join('');
            // Crop transparent padding and contain at one common resolution.
            // New IDs or a differently sized empty canvas cannot hide a clone.
            async function artSignature(asset){
                const image=assetImage(asset),native=document.createElement('canvas');native.width=image.width;native.height=image.height;const nc=native.getContext('2d',{willReadFrequently:true});nc.drawImage(image,0,0);
                const p=nc.getImageData(0,0,native.width,native.height).data;let x0=native.width,y0=native.height,x1=-1,y1=-1,opaque=0;
                for(let y=0;y<native.height;y++)for(let x=0;x<native.width;x++)if(p[(y*native.width+x)*4+3]>20){opaque++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
                check(opaque>50,'Empty collection artwork '+asset.id);const cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=false;
                const w=x1-x0+1,h=y1-y0+1,s=Math.min(124/w,124/h);c.drawImage(image,x0,y0,w,h,(128-w*s)/2,(128-h*s)/2,w*s,h*s);
                return {hash:await digest(c.getImageData(0,0,128,128).data),image:cv,opaque};
            }
            for(const owner of owners){
                const model=getInterior(owner.scene),collection=APARTMENT_COLLECTIONS.find(c=>c.owner===owner.id);check(collection?.assets.length===32,'Incomplete owner collection '+owner.id);await Promise.all(collection.assets.map(def=>catalog.get(def.id)?.ensureFull?.()));
                for(const [index,item]of model.items.entries()){const previous=placedByID.get(item.asset),name=owner.id+' placed '+index;if(previous)duplicates.push({asset:item.asset,first:previous,second:name});else placedByID.set(item.asset,name);}
                const slots=model.items.map(item=>item.collectionSlot||item.slot||catalog.get(item.asset)?.slot);for(const slot of ['poster','toy','lava-lamp','arcade'])check(slots.filter(s=>s===slot).length===1,owner.id+' lacks its one visible '+slot);
                for(const row of collection.assets.map((def,index)=>({owner:owner.id,item:model.items.find(i=>i.asset===def.id)||{asset:def.id,furnitureRole:def.purpose,unused:true},index,asset:catalog.get(def.id)}))){
                check(row.asset?.canvas,'Missing collection asset '+row.item.asset);const name=row.owner+' item '+row.index,previous=byID.get(row.item.asset);
                if(previous)duplicates.push({asset:row.item.asset,first:previous,second:name});else byID.set(row.item.asset,name);
                const art=await artSignature(row.asset),same=byPixels.get(art.hash);if(same)pixelDuplicates.push({first:same,second:name,asset:row.item.asset});else byPixels.set(art.hash,name);
                records.push({...row,signature:art.hash,image:art.image,opaque:art.opaque});
                if(row.asset.motion){
                    const a=row.asset,native=assetImage(a),before=await digest(native.getContext('2d').getImageData(0,0,native.width,native.height).data),item={x:a.w/2,y:a.h,w:a.w,h:a.h};
                    const frame=time=>{const cv=document.createElement('canvas');cv.width=a.w;cv.height=a.h;drawApartmentMotion(cv.getContext('2d'),a,item,time);return cv;};
                    const first=frame(.5),afterFirst=getApartmentMotionStats(),same=frame(.51),afterSame=getApartmentMotionStats(),second=frame(2.25),A=first.getContext('2d').getImageData(0,0,a.w,a.h).data,B=second.getContext('2d').getImageData(0,0,a.w,a.h).data,staticPixels=native.getContext('2d').getImageData(0,0,a.w,a.h).data;
                    let changed=0,painted=0,outsideArt=0;for(let i=0;i<A.length;i+=4){if(A[i+3]){painted++;if(staticPixels[i+3]===0)outsideArt++;}if(A[i]!==B[i]||A[i+1]!==B[i+1]||A[i+2]!==B[i+2]||A[i+3]!==B[i+3])changed++;}
                    check(changed>3&&painted>8,owner.id+' '+a.motion.kind+' has no visible animation');check(outsideArt<Math.max(3,painted*.01),owner.id+' animation paints outside its native prop silhouette');
                    check(afterFirst.generatedFrames===afterSame.generatedFrames,'Animation rebuilt within one 8FPS interval');check(before===await digest(native.getContext('2d').getImageData(0,0,native.width,native.height).data),'Animation mutated the authored native artwork');
                    const reduced=createApartmentMotionRenderer({reducedMotion:()=>true}),quiet=document.createElement('canvas');quiet.width=a.w;quiet.height=a.h;check(reduced.draw(quiet.getContext('2d'),a,item,.5)===false&&reduced.stats.entries===0,'Reduced-motion setting creates a live overlay');
                    const preview=document.createElement('canvas');preview.width=a.w*2+8;preview.height=a.h;const pc=preview.getContext('2d');pc.drawImage(native,0,0);pc.drawImage(first,0,0);pc.drawImage(native,a.w+8,0);pc.drawImage(second,a.w+8,0);motionImages.push({owner:owner.id,kind:a.motion.kind,image:preview});
                    motionReports.push({owner:owner.id,asset:a.id,kind:a.motion.kind,changedPixels:changed,paintedPixels:painted,outsideArtPixels:outsideArt,authoredPixelsUnchanged:true,same8FpsFrameReused:true});
                }
                }
                if(owner.scene.kind==='showroom')check(model.width===1184&&model.height===(owner.scene.floor===2?832:448),owner.id+' has the wrong floor plate');
                await __warmCollectionScene(owner.scene);
                for(const item of [...model.items,...(model.doors||[])]){const a=catalog.get(item.asset);if(a?.getFacingView){const direction=a.wallMounted||a.layer==='ground'?'south':cardinalFacing(item.rotation||0);check(a.getFacingView(direction)?.ready!==false,owner.id+' posed artwork is not native-ready: '+item.asset+' '+direction);}}
                const cv=document.createElement('canvas');cv.width=model.width;cv.height=model.height;renderInterior(cv.getContext('2d'),owner.scene,{catalog,actors:[],time:.4});await __saveCollectionImage(owner.id,cv.toDataURL());renderInterior(cv.getContext('2d'),owner.scene,{catalog,actors:[],time:.4});
            }
            check(records.length===992,'The complete native catalog has missing props');check(motionReports.length===62,'Every home needs one animated lava lamp and arcade');
            for(let offset=0;offset<motionImages.length;offset+=18){const entries=motionImages.slice(offset,offset+18),cv=document.createElement('canvas');cv.width=1200;cv.height=Math.ceil(entries.length/4)*220;const c=cv.getContext('2d');c.fillStyle='#17212b';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;entries.forEach((r,i)=>{const x=i%4*300,y=Math.floor(i/4)*220,s=Math.min(286/r.image.width,180/r.image.height);c.drawImage(r.image,x+(300-r.image.width*s)/2,y,r.image.width*s,r.image.height*s);c.fillStyle='#f0dcbb';c.font='15px sans-serif';c.textAlign='center';c.fillText(r.owner+' · '+r.kind,x+150,y+207);});await __saveCollectionImage('motion-'+String(offset/18+1).padStart(2,'0'),cv.toDataURL());}
            const sheetWidth=1536,cellWidth=256,cellHeight=200,perSheet=48;
            for(let offset=0;offset<records.length;offset+=perSheet){const entries=records.slice(offset,offset+perSheet),cv=document.createElement('canvas');cv.width=sheetWidth;cv.height=Math.ceil(entries.length/6)*cellHeight;const c=cv.getContext('2d');c.fillStyle='#16212a';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;
                entries.forEach((r,i)=>{const x=i%6*cellWidth,y=Math.floor(i/6)*cellHeight;c.drawImage(r.image,x+64,y+4,128,128);c.textAlign='center';c.fillStyle='#f0dcbb';c.font='15px sans-serif';c.fillText(r.owner,x+128,y+153);c.font='12px sans-serif';c.fillText((r.item.furnitureRole||r.item.fixtureRole||r.asset.purpose||'decor').slice(0,32),x+128,y+174);c.fillText(r.item.asset.slice(-34),x+128,y+192);});
                await __saveCollectionImage('furniture-'+String(offset/perSheet+1).padStart(2,'0'),cv.toDataURL());
            }
            // Persist detailed evidence even if the uniqueness assertion fails.
            window.__collectionsEvidence={owners:owners.map(o=>{const m=getInterior(o.scene);return {id:o.id,floor:m.floor,width:m.width,height:m.height,aspect:m.width/m.height,items:m.items.length,doors:m.privacyDoors,collection:m.homePlan?.collection};}),duplicateIDs:duplicates,duplicateArt:pixelDuplicates,placedItems:placedByID.size,items:records.map(r=>({owner:r.owner,asset:r.item.asset,role:r.item.furnitureRole||r.item.fixtureRole||r.asset.purpose,signature:r.signature,opaque:r.opaque}))};
            const runtime=getApartmentCollectionRuntimeStats(),motionCache=getApartmentMotionStats(),backgroundCache=getInteriorRenderCacheStats(),materialCache=getHomeMaterialCacheStats();check(materialCache.ready===124&&materialCache.textures===124,'Not all31 native material suites were decoded');check(backgroundCache.backgrounds<=backgroundCache.maxBackgrounds&&backgroundCache.pixels<=backgroundCache.maxPixels,'Interior background cache exceeds limits');check(runtime.sourceEntries<=runtime.maxSources&&runtime.canvasEntries<=runtime.maxCanvases&&runtime.canvasPixels<=runtime.maxCanvasPixels,'Native collection caches exceed their limits');check(motionCache.entries<=motionCache.maxEntries&&motionCache.pixels<=motionCache.maxPixels,'Animation cache exceeds its limits');
            return {...window.__collectionsEvidence,stock:window.CodaFurnitureCatalog.length,sourceTag:app.search,motions:motionReports,motionCache:getApartmentMotionStats(),artRuntime:getApartmentCollectionRuntimeStats(),backgroundCache:getInteriorRenderCacheStats(),materialCache};
        }''')
        (args.screenshots / 'collections.json').write_text(json.dumps(report, indent=2))
        assert not report['duplicateIDs'], report['duplicateIDs']
        assert not report['duplicateArt'], report['duplicateArt']
        performance = []
        if args.performance:
            page.locator('#walk').click()
            for owner in ['showroom-midcentury-studio', 'showroom-retrofuture', 'bach', 'player']:
                page.evaluate('''async id=>{const q=townBuilder.urban;if(id.startsWith('showroom-')){q.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));q.goStoreFloor(__collectionShowroomFloors[id.slice(9)]);q.openShowroom(id.slice(9));}else q.openRoom(id);await __warmCollectionScene(q.scene);}''',owner)
                page.wait_for_timeout(1000)
                request_count=len(native_requests)
                measured_started=datetime.now(timezone.utc).isoformat()
                page.evaluate('window.__collectionFrames=[]')
                page.wait_for_timeout(2500)
                frames=page.evaluate('(()=>{const a=__collectionFrames;window.__collectionFrames=null;return a})()')
                cpu=sorted(f['cpu'] for f in frames);duration=frames[-1]['at']-frames[0]['at'];gaps=[frames[i]['at']-frames[i-1]['at'] for i in range(1,len(frames))]
                row={'owner':owner,'measuredStartedUTC':measured_started,'measuredFinishedUTC':datetime.now(timezone.utc).isoformat(),'fps':round((len(frames)-1)*1000/duration,2),'cpuMeanMs':round(statistics.mean(cpu),3),'cpuP95Ms':round(cpu[int(len(cpu)*.95)],3),'cpuMaxMs':round(max(cpu),3),'stallsOver50Ms':sum(g>50 for g in gaps)}
                row['nativeAtlasRequestsDuringFrames']=len(native_requests)-request_count
                assert row['nativeAtlasRequestsDuringFrames']==0,row
                performance.append(row);assert row['fps']>35 and row['cpuP95Ms']<50,row
            page.locator('#walk').click()
        report['performance']=performance
        report['originalStock']=original_stock
        (args.screenshots / 'collections.json').write_text(json.dumps(report, indent=2))
        page.locator('#walk').click()
        page.evaluate("townBuilder.urban.openRoom('player')")
        assert page.evaluate('townBuilder.urban.decor') == [legacy]
        page.reload()
        page.wait_for_function('!!window.townBuilder')
        page.locator('#walk').click()
        page.evaluate("townBuilder.urban.openRoom('player')")
        assert page.evaluate('townBuilder.urban.decor') == [legacy]
        assert not errors, errors
        browser.close()
    assert hashlib.sha256(MAP.read_bytes()).hexdigest() == source_hash
    (args.screenshots / 'results.json').write_text(json.dumps({'owners':len(report['owners']),'items':len(report['items']),'placedItems':report['placedItems'],'duplicateIDs':report['duplicateIDs'],'duplicateArt':report['duplicateArt'],'motions':len(report['motions']),'motionCache':report['motionCache'],'artRuntime':report['artRuntime'],'backgroundCache':report['backgroundCache'],'materialCache':report['materialCache'],'performance':performance,'originalStock':original_stock,'sourceUnchanged':True,'sourceHash':source_hash,'pageErrors':errors},indent=2))
    print(json.dumps({'owners':len(report['owners']),'uniqueFurniture':len(report['items']),'placedFurniture':report['placedItems'],'sourceUnchanged':True,'pageErrors':errors}),flush=True)
finally:
    server.shutdown()
