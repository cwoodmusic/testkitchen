"""Read every real native collection view and check renderer-facing semantics."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse, base64, json
from playwright.sync_api import sync_playwright
from town_facing_acceptance import ROOT, collection_graph, assert_frozen
from town_browser_compat import assert_original_furniture_stock

parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/collection-facings-final'));args=parser.parse_args()
graph=collection_graph()  # Fail before opening Chrome while production is incomplete.
args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1740,'height':1120},device_scale_factor=2);page.set_default_timeout(240000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.expose_function('__saveNativeFacing',lambda name,url:(args.screenshots/(name+'.png')).write_bytes(base64.b64decode(url.split(',')[1])))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        stock=assert_original_furniture_stock(page)
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        report=page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),catalog=townBuilder.catalog;
            const {APARTMENT_COLLECTIONS,getApartmentCollectionRuntimeStats}=await import(url('apartment-collections')),{supportsFurnitureFacing,furnitureFacingPlacement,furnitureFacingBoxes}=await import(url('furniture-facing')),{flatFurnitureFacingPlacement}=await import(url('furniture-facing-source')),{drawApartmentMotion}=await import(url('apartment-motion'));
            const check=(v,m)=>{if(!v)throw Error(m);},digest=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(v=>v.toString(16).padStart(2,'0')).join(''),rows=[],exactCopies=[],motions=[],directionPairs=[['south',0],['west',90],['north',180],['east',270]],asymmetric=new Set(['bed','sofa','wardrobe','desk','reading-chair','desk-chair','dining-chair','sink','stove','fridge','counter','pantry','toilet','vanity','bath-fixture','linen-storage','record-console','arcade','instrument']);
            check(APARTMENT_COLLECTIONS.length===31,'Wrong owner count');
            for(const collection of APARTMENT_COLLECTIONS){
                const southHashes=new Map(),geometry=new Map(collection.assets.map(d=>{const a=catalog.get(d.id);return [d.id,JSON.stringify({w:a.w,h:a.h,boxes:a.boxes,polygons:a.polygons})];}));
                for(const [direction,rotation]of directionPairs){
                    await Promise.all(collection.assets.map(def=>catalog.get(def.id).ensureFull(direction)));
                    const sheet=document.createElement('canvas');sheet.width=8*180;sheet.height=4*190;const sc=sheet.getContext('2d');sc.fillStyle='#17232c';sc.fillRect(0,0,sheet.width,sheet.height);sc.imageSmoothingEnabled=false;
                    for(const [index,def]of collection.assets.entries()){
                        const a=catalog.get(def.id),view=a.getFacingView(direction);check(view?.ready&&view.canvas,'Missing native '+def.id+'/'+direction);const image=view.canvas,c=image.getContext('2d',{willReadFrequently:true}),pixels=c.getImageData(0,0,image.width,image.height).data;
                        let x0=image.width,y0=image.height,x1=-1,y1=-1,opaque=0;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>20){opaque++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
                        check(opaque>20,'Empty native '+def.id+'/'+direction);check(image.width===Math.ceil(view.w)&&image.height===Math.ceil(view.h),'View/native dimensions differ');
                        const normalized=document.createElement('canvas');normalized.width=normalized.height=128;const nc=normalized.getContext('2d');nc.imageSmoothingEnabled=false;const visibleW=x1-x0+1,visibleH=y1-y0+1,s=Math.min(124/visibleW,124/visibleH);nc.drawImage(image,x0,y0,visibleW,visibleH,(128-visibleW*s)/2,(128-visibleH*s)/2,visibleW*s,visibleH*s);const hash=await digest(nc.getImageData(0,0,128,128).data);
                        if(direction==='south')southHashes.set(def.id,hash);else if(hash===southHashes.get(def.id))exactCopies.push({id:def.id,slot:def.slot,direction,asymmetric:asymmetric.has(def.slot)});
                        const placed={asset:def.id,x:500,y:600,scale:1,rotation},supported=supportsFurnitureFacing(a,placed),upright=furnitureFacingPlacement(a,placed,undefined,{includeImage:false});
                        if(supported){check(upright?.direction===direction&&upright.rotation===0,'Upright view flattened/spun');const full=furnitureFacingPlacement(a,placed);check(full.image===image,'Renderer uses an alternate native source');const boxes=furnitureFacingBoxes(a,placed);if(boxes.length){const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.w)),top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.h));check(Math.hypot(upright.groundCenter.x-(left+right)/2,upright.groundCenter.y-(top+bottom)/2)<.001,'Art/physical floor centre drift');}}
                        else {check(a.wallMounted||a.layer==='ground','Unexpected unsupported collection prop');check(upright===null,'Flat artwork incorrectly takes upright path');const flat=flatFurnitureFacingPlacement(a,{x:0,y:0,w:a.w,h:a.h});check(flat?.direction==='south','Wall/rug path must use canonical South');}
                        let motion=null;if(view.motion){
                            const frame=t=>{const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.w);canvas.height=Math.ceil(view.h);drawApartmentMotion(canvas.getContext('2d'),view,{x:view.w/2,y:view.h,w:view.w,h:view.h},t);return canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;},A=frame(.5),B=frame(2.25);let changed=0,painted=0,outside=0;
                            for(let at=0;at<A.length;at+=4){if(A[at+3]){painted++;if(!pixels[at+3])outside++;}if(A[at]!==B[at]||A[at+1]!==B[at+1]||A[at+2]!==B[at+2]||A[at+3]!==B[at+3])changed++;}
                            check(changed>3&&painted>8,'No live motion '+def.id+'/'+direction);check(outside<Math.max(3,painted*.01),'Motion outside native silhouette '+def.id+'/'+direction);motion={id:def.id,direction,kind:view.motion.kind,changedPixels:changed,paintedPixels:painted,outsideArtPixels:outside};motions.push(motion);
                        }
                        if(def.slot==='arcade'&&direction==='north')check(!view.motion,'Rear arcade animates an invisible screen');
                        check(geometry.get(def.id)===JSON.stringify({w:a.w,h:a.h,boxes:a.boxes,polygons:a.polygons}),'Direction provider mutated physical geometry');
                        rows.push({id:def.id,owner:collection.owner,slot:def.slot,direction,nativeWidth:image.width,nativeHeight:image.height,hash,opaquePixels:opaque,viewWidth:view.w,viewHeight:view.h,footCenter:view.footCenter,supportsUpright:supported,motion:motion?.kind||null});
                        const cellX=index%8*180,cellY=Math.floor(index/8)*190,display=Math.min(160/visibleW,150/visibleH);sc.drawImage(image,x0,y0,visibleW,visibleH,cellX+(180-visibleW*display)/2,cellY+4+(150-visibleH*display)/2,visibleW*display,visibleH*display);sc.fillStyle='#e9d6b9';sc.font='12px sans-serif';sc.textAlign='center';sc.fillText(def.slot,cellX+90,cellY+176);
                    }
                    await __saveNativeFacing(collection.owner+'-'+direction,sheet.toDataURL());
                    const stats=getApartmentCollectionRuntimeStats();check(stats.sourceEntries<=4&&stats.canvasEntries<=192&&stats.canvasPixels<=4*1024*1024,'Native memory limits exceeded');
                }
            }
            check(rows.length===3968,'Incomplete real four-facing coverage');check(motions.filter(m=>m.direction==='south').length===62,'Wrong South animation count');check(!exactCopies.some(c=>c.asymmetric),'Asymmetric side/rear artwork repeats South pixels: '+JSON.stringify(exactCopies.filter(c=>c.asymmetric)));
            return {sourceTag:app.search,owners:APARTMENT_COLLECTIONS.length,assets:rows.length/4,views:rows.length,rows,exactSouthCopies:exactCopies,motions,artRuntime:getApartmentCollectionRuntimeStats()};
        }''')
        assert not errors,errors;browser.close()
    assert_frozen(graph);report.update(graph=graph,originalStock=stock,sourceUnchanged=True,pageErrors=errors)
    (args.screenshots/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'owners':report['owners'],'assets':report['assets'],'nativeViews':report['views'],'animatedViews':len(report['motions']),'sourceUnchanged':True,'pageErrors':errors}),flush=True)
finally:server.shutdown()
