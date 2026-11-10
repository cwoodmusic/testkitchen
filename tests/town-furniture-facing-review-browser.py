"""Native sprite/physical-base contacts; absent authored views are explicit evidence."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse, base64, hashlib, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--owners', nargs='+', default=['ellington','ella','showroom-retrofuture','showroom-cyberpunk','showroom-steampunk','showroom-robot'])
parser.add_argument('--screenshots', type=Path, default=Path('/workspace/.onboarding/furniture-facing-six-native'))
args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
MAP=ROOT/'town/maps/coda-town-uploaded-3.json';source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()
directions_file=ROOT/'town/assets/apartment-collections/directions-manifest.json'
(args.screenshots/'directions-manifest-at-start.json').write_bytes(directions_file.read_bytes())
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1600,'height':1050});page.set_default_timeout(180000)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.expose_function('__saveReviewImage',lambda name,url:(args.screenshots/(name+'.png')).write_bytes(base64.b64decode(url.split(',')[1])))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        reports=[]
        for owner in args.owners:
            report=page.evaluate('''async owner=>{
                const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app);
                const {furnitureFacingPlacement,furnitureFacingBoxes,cardinalFacing}=await import(url('furniture-facing')),{getInterior,renderInterior,residents}=await import(url('urban-interiors')),{SHOWROOMS}=await import(url('showroom-layout')),{drawApartmentMotion}=await import(url('apartment-motion'));
                const catalog=townBuilder.catalog,groups=[['bed','sofa','desk','record-console','coffee-table','counter'],['wardrobe','fridge','pantry','reading-chair','desk-chair','dining-chair'],['floor-lamp','table-lamp','lava-lamp','arcade','instrument','bath-fixture']],directions=[['south',0],['north',180],['east',270],['west',90]],rows=[];
                const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
                for(let group=0;group<groups.length;group++){
                    const slots=groups[group],sheet=document.createElement('canvas');sheet.width=1440;sheet.height=slots.length*300;const c=sheet.getContext('2d');c.fillStyle='#17232c';c.fillRect(0,0,sheet.width,sheet.height);c.imageSmoothingEnabled=false;
                    for(let i=0;i<slots.length;i++)for(let j=0;j<directions.length;j++){
                        const slot=slots[i],[direction,rotation]=directions[j],a=catalog.get('collection-'+owner+'-'+slot),x=j*360,y=i*300;if(!a)throw Error('Missing catalog '+owner+'/'+slot);
                        c.fillStyle='#eddbbe';c.font='16px sans-serif';c.fillText(slot+' · '+direction,x+10,y+22);let view,pending=null;
                        try{await a.ensureFull(direction);view=a.getFacingView(direction);}catch(e){pending=String(e);}
                        if(pending){c.fillStyle='#d9a980';c.font='14px sans-serif';c.fillText('AUTHORED VIEW WITHHELD',x+10,y+55);rows.push({owner,slot,direction,pending});continue;}
                        if(!view?.ready)throw Error('Native view not ready '+owner+'/'+slot+'/'+direction);
                        const cv=view.canvas,pix=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1,opaque=0;
                        for(let yy=0;yy<cv.height;yy++)for(let xx=0;xx<cv.width;xx++)if(pix[(yy*cv.width+xx)*4+3]>20){opaque++;x0=Math.min(x0,xx);y0=Math.min(y0,yy);x1=Math.max(x1,xx);y1=Math.max(y1,yy);}
                        if(opaque<50)throw Error('Empty native '+owner+'/'+slot+'/'+direction);
                        const item={x:0,y:0,scale:1,rotation},placement=furnitureFacingPlacement(a,item),boxes=furnitureFacingBoxes(a,item),center=placement.groundCenter;
                        if(placement.direction!==direction||placement.rotation!==0)throw Error('Flat sprite rotation '+owner+'/'+slot+'/'+direction);
                        const physical=boxes.length?{x:Math.min(...boxes.map(b=>b.x)),y:Math.min(...boxes.map(b=>b.y)),r:Math.max(...boxes.map(b=>b.x+b.w)),b:Math.max(...boxes.map(b=>b.y+b.h))}:null;
                        if(physical&&Math.hypot((physical.x+physical.r)/2-center.x,(physical.y+physical.b)/2-center.y)>.001)throw Error('Floor centre drift');
                        const bounds=placement.bounds,left=Math.min(bounds.x,physical?.x??bounds.x),top=Math.min(bounds.y,physical?.y??bounds.y),right=Math.max(bounds.x+bounds.w,physical?.r??bounds.x+bounds.w),bottom=Math.max(bounds.y+bounds.h,physical?.b??bounds.y+bounds.h),s=Math.min(1.5,320/(right-left),232/(bottom-top));
                        c.save();c.beginPath();c.rect(x,y+30,360,250);c.clip();c.translate(x+180-(left+right)/2*s,y+38-top*s);c.scale(s,s);
                        c.strokeStyle='#2c4653';c.lineWidth=1/s;for(let k=-350;k<350;k+=32){c.beginPath();c.moveTo(k,-400);c.lineTo(k,150);c.moveTo(-350,k);c.lineTo(350,k);c.stroke();}
                        c.drawImage(placement.image,placement.x,placement.y,placement.w,placement.h);drawApartmentMotion(c,view,{x:placement.x+placement.w/2,y:placement.y+placement.h,w:placement.w,h:placement.h},.75);
                        c.strokeStyle='#f58c75';c.lineWidth=1.4/s;for(const b of boxes)c.strokeRect(b.x,b.y,b.w,b.h);c.strokeStyle='#62ecc9';c.beginPath();c.moveTo(center.x-4/s,center.y);c.lineTo(center.x+4/s,center.y);c.moveTo(center.x,center.y-4/s);c.lineTo(center.x,center.y+4/s);c.stroke();c.restore();c.fillStyle='#b7c8c9';c.font='12px sans-serif';c.fillText('alpha '+(x1-x0+1)+'×'+(y1-y0+1)+' | native '+cv.width+'×'+cv.height,x+10,y+293);
                        let motionCheck=null;
                        if(view.motion){
                            const frame=t=>{const out=document.createElement('canvas');out.width=view.w;out.height=view.h;drawApartmentMotion(out.getContext('2d'),view,{x:view.w/2,y:view.h,w:view.w,h:view.h},t);return out.getContext('2d').getImageData(0,0,out.width,out.height).data;},A=frame(.5),B=frame(2.25);let painted=0,changed=0,outsideArt=0;
                            for(let at=0;at<A.length;at+=4){if(A[at+3]){painted++;if(pix[at+3]===0)outsideArt++;}if(A[at]!==B[at]||A[at+1]!==B[at+1]||A[at+2]!==B[at+2]||A[at+3]!==B[at+3])changed++;}
                            if(changed<4||painted<9)throw Error('No visible motion '+owner+'/'+slot+'/'+direction);
                            if(outsideArt>=Math.max(3,painted*.01))throw Error('Motion outside native silhouette '+owner+'/'+slot+'/'+direction+': '+outsideArt+'/'+painted);
                            motionCheck={changedPixels:changed,paintedPixels:painted,outsideArtPixels:outsideArt};
                        }
                        rows.push({owner,slot,direction,hash:await digest(pix),opaque,alpha:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},view:{w:view.w,h:view.h,footCenter:view.footCenter},physicalBoxes:boxes,groundCenter:center,picturedBounds:bounds,motion:view.motion?.kind||null,motionCheck});
                        if(slot==='arcade'&&direction==='north'&&view.motion)throw Error('North arcade screen animation');
                    }
                    await __saveReviewImage(owner+'-contact-'+(group+1),sheet.toDataURL());
                }
                const duplicates=[];for(const slot of groups.flat()){const list=rows.filter(r=>r.slot===slot&&!r.pending),south=list.find(r=>r.direction==='south');for(const r of list)if(r.direction!=='south'&&r.hash===south?.hash)duplicates.push({slot,direction:r.direction,reason:'Exact South pixel copy'});}
                const showroom=SHOWROOMS.find(s=>'showroom-'+s.id===owner),resident=residents.find(r=>r.id===owner),scene=showroom?{kind:'showroom',showroomId:showroom.id,floor:showroom.storeFloor}:{kind:'apartment',resident:owner,floor:resident.floor},model=getInterior(scene),missingScene=[];
                for(const it of model.items){const a=catalog.get(it.asset);try{await a?.ensureFull?.(cardinalFacing(it.rotation||0));}catch(e){missingScene.push({asset:it.asset,rotation:it.rotation||0,direction:cardinalFacing(it.rotation||0),reason:String(e)});}}
                const room=document.createElement('canvas');room.width=model.width;room.height=model.height;renderInterior(room.getContext('2d'),scene,{catalog,actors:[],time:.75});renderInterior(room.getContext('2d'),scene,{catalog,actors:[],time:.75});await __saveReviewImage(owner+'-room',room.toDataURL());
                return {owner,rows,exactSouthCopies:duplicates,missingScene,scene,items:model.items,sourceTag:app.search};
            }''',owner)
            reports.append(report);(args.screenshots/(owner+'-results.json')).write_text(json.dumps(report,indent=2))
            print(json.dumps({'owner':owner,'nativeViews':sum('pending' not in r for r in report['rows']),'withheld':sum('pending' in r for r in report['rows']),'exactSouthCopies':report['exactSouthCopies'],'missingSceneViews':report['missingScene']}),flush=True)
        assert not errors,errors;browser.close()
    assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
    (args.screenshots/'results.json').write_text(json.dumps({'owners':reports,'sourceUnchanged':True,'sourceHash':source_hash,'pageErrors':errors},indent=2))
finally:server.shutdown()
