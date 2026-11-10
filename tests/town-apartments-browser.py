"""Native apartment previews, resident navigation and owned-decor lifecycle."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import base64
import hashlib
import json

from playwright.sync_api import sync_playwright
from town_browser_compat import assert_original_furniture_stock

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'town/maps/coda-town-uploaded-3.json'
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
legacy = {'id': 'room-legacy-geranium', 'item': 'furniture-geranium', 'asset': 'decor-08-01', 'x': 1800, 'y': 900, 'scale': 1}
parser = argparse.ArgumentParser()
parser.add_argument('--legacy-tours', action='store_false', dest='skip_tours', help='Compatibility only: older builds that require E to enter rooms')
parser.add_argument('--preview', action='store_true')
parser.add_argument('--skip-tours', action='store_true', default=True, help='Run model/layer/purchase checks; automatic keyboard door tours have their own suite')
parser.add_argument('--screenshots', type=Path, default=Path('/workspace/.onboarding/apartment-homes'))
args = parser.parse_args()
args.screenshots.mkdir(parents=True, exist_ok=True)


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
            if(localStorage.getItem('__apartmentQASeed'))return;
            localStorage.setItem('__apartmentQASeed','1');
            localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,owned:['furniture-geranium'],rewards:[],earned:170,spent:20}));
            localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));
        })()''')
        page = context.new_page()
        page.set_default_timeout(180000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def save_image(name, data):
            (args.screenshots / (name + '.png')).write_bytes(base64.b64decode(data.split(',')[1]))

        page.expose_function('__saveApartmentImage', save_image)
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        original_stock=assert_original_furniture_stock(page)
        if page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        setup = page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type="module"]').src),url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
            const {getInterior,renderInterior,residents}=await import(url('urban-interiors'));
            const {SHOWROOMS}=await import(url('showroom-layout')),{preparePlacedFacingArt}=await import(url('furniture-art-access'));
            const homes=[...residents.map(r=>({id:r.id,name:r.name,scene:{kind:'apartment',floor:r.floor,resident:r.id}})),{id:'player',name:'Your rooftop home',scene:{kind:'apartment',floor:15,resident:'player'}}];
            const scenes=[...homes,...SHOWROOMS.map(r=>({id:'showroom-'+r.id,name:r.name,scene:{kind:'showroom',showroomId:r.id,floor:r.storeFloor}}))];
            await document.fonts.ready;
            const draw=entry=>{const m=getInterior(entry.scene),cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;renderInterior(c,entry.scene,{catalog:townBuilder.catalog,actors:m.actors,time:.6});return cv;};
            const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=Math.ceil(homes.length/3)*360;const sc=sheet.getContext('2d');sc.fillStyle='#121b21';sc.fillRect(0,0,sheet.width,sheet.height);sc.imageSmoothingEnabled=false;
            const showroomModels=scenes.slice(homes.length).map(r=>getInterior(r.scene)),storeCellWidth=Math.max(...showroomModels.map(m=>m.width)),storeColumns=2,storeRowHeights=Array.from({length:Math.ceil(showroomModels.length/storeColumns)},(_,i)=>Math.max(...showroomModels.slice(i*storeColumns,i*storeColumns+storeColumns).map(m=>m.height))+48);
            const storeSheet=document.createElement('canvas');storeSheet.width=storeCellWidth*storeColumns;storeSheet.height=storeRowHeights.reduce((n,h)=>n+h,0);const ss=storeSheet.getContext('2d');ss.fillStyle='#121b21';ss.fillRect(0,0,storeSheet.width,storeSheet.height);ss.imageSmoothingEnabled=false;
            const descriptions=[];
            for(let i=0;i<scenes.length;i++){
                const entry=scenes[i],m=getInterior(entry.scene);await preparePlacedFacingArt({objects:[...m.items,...(m.doors||[])]},townBuilder.catalog);const cv=draw(entry);await __saveApartmentImage(entry.id,cv.toDataURL());
                if(i<homes.length){const x=i%3*(1600/3),y=Math.floor(i/3)*360,fit=Math.min(520/m.width,320/m.height),w=m.width*fit,h=m.height*fit;sc.drawImage(cv,x+(1600/3-w)/2,y,w,h);sc.fillStyle='#ead2a1';sc.font='18px Georgia';sc.textAlign='center';sc.fillText(entry.name+' · '+(m.homePlan?.variant||'rooftop'),x+1600/6,y+344);}
                else {const index=i-homes.length,row=Math.floor(index/storeColumns),storeCellHeight=storeRowHeights[row],x=index%storeColumns*storeCellWidth,y=storeRowHeights.slice(0,row).reduce((n,h)=>n+h,0);ss.drawImage(cv,x+(storeCellWidth-m.width)/2,y,m.width,m.height);ss.fillStyle='#ead2a1';ss.font='22px Georgia';ss.textAlign='center';ss.fillText(entry.name,x+storeCellWidth/2,y+storeCellHeight-16);}
                if(entry.id==='showroom-midcentury-studio'){const large=document.createElement('canvas');large.width=cv.width*2;large.height=cv.height*2;const c=large.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(cv,0,0,large.width,large.height);await __saveApartmentImage('midcentury-apartment-large',large.toDataURL());}
                descriptions.push({id:entry.id,name:entry.name,scene:entry.scene,width:m.width,height:m.height,variant:m.homePlan?.variant,layout:m.apartmentLayout,collection:m.homePlan?.collection,owner:m.homePlan?.owner,rooms:m.rooms.map(a=>({id:a.id,name:a.name,role:a.functionalRole,point:a.point})),doors:m.privacyDoors,items:m.items.map(i=>({asset:i.asset,role:i.furnitureRole,fixtureRole:i.fixtureRole,x:i.x,y:i.y,w:i.w,h:i.h,depth:i.depth,wallMounted:i.wallMounted}))});
            }
            await __saveApartmentImage('npc-apartments-overview',sheet.toDataURL());
            const storeOverview=document.createElement('canvas');storeOverview.width=1600;storeOverview.height=Math.round(storeSheet.height*1600/storeSheet.width);const so=storeOverview.getContext('2d');so.imageSmoothingEnabled=false;so.drawImage(storeSheet,0,0,storeOverview.width,storeOverview.height);await __saveApartmentImage('showroom-apartments-overview',storeOverview.toDataURL());
            return {tag:app.search,homes:descriptions.filter(r=>!r.id.startsWith('showroom-')),showrooms:descriptions.filter(r=>r.id.startsWith('showroom-')),stock:window.CodaFurnitureCatalog};
        }''')
        (args.screenshots / 'preview.json').write_text(json.dumps(setup, indent=2))
        if not args.preview:
            checks = page.evaluate('''async()=>{
                const app=new URL(document.querySelector('script[type="module"]').src),url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
                const {getInterior,renderInterior,residents}=await import(url('urban-interiors'));
                const {assetImage}=await import(url('asset-color'));
                const {residentHomePose,interiorJourneyPose,journeyDuration,residentInScene}=await import(url('resident-journey'));
                const {APARTMENT_DECOR,APARTMENT_DECOR_ALIASES}=await import(url('apartment-decor'));
                const urban=townBuilder.urban,check=(ok,label)=>{if(!ok)throw Error(label);},distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
                const solid=(m,x,y)=>x<40||y<100||x>m.width-40||y>m.height-40||m.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
                function navigation(model,from=model.spawn){
                    const step=16,cols=Math.ceil(model.width/step),rows=Math.ceil(model.height/step),center=k=>({x:k%cols*step+8,y:Math.floor(k/cols)*step+8});
                    const start=Math.floor(from.y/step)*cols+Math.floor(from.x/step),parents=new Int32Array(cols*rows).fill(-2),queue=[start];parents[start]=-1;
                    for(let i=0;i<queue.length;i++){const k=queue[i],x=k%cols,y=Math.floor(k/cols);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy,n=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||parents[n]!==-2)continue;const p=center(n);if(solid(model,p.x,p.y))continue;parents[n]=k;queue.push(n);}}
                    return {queue,parents,center};
                }
                const reports=[];
                for(const resident of residents){
                    const scene={kind:'apartment',floor:resident.floor,resident:resident.id},model=getInterior(scene),nav=navigation(model),points=nav.queue.map(nav.center);
                    const reaches=p=>points.some(q=>distance(p,q)<24);
                    check(!solid(model,model.spawn.x,model.spawn.y),resident.id+' entrance is blocked');
                    for(const role of ['bedroom','bathroom','living','kitchen'])check(model.rooms.filter(r=>r.functionalRole===role).length===1,resident.id+' needs exactly one '+role);
                    for(const role of ['bed','sofa','fridge','sink','stove','toilet','vanity'])check(model.items.filter(i=>i.furnitureRole===role).length===1,resident.id+' needs exactly one '+role);
                    check(model.items.filter(i=>['shower','bathtub'].includes(i.furnitureRole)).length===1,resident.id+' has duplicate bathing fixtures');
                    check(model.privacyDoors?.length===2,resident.id+' lacks bedroom/bath privacy doors');
                    for(const door of model.privacyDoors){const p=door.axis==='vertical'?{x:door.x,y:door.y+door.length/2}:{x:door.x+door.length/2,y:door.y};check(!solid(model,p.x,p.y)&&reaches(p),resident.id+' privacy doorway is blocked');}
                    for(const area of model.homePlan.rooms)check(!solid(model,area.point.x,area.point.y)&&reaches(area.point),resident.id+' cannot reach '+area.id);
                    for(const p of model.homePlan.fixtureApproaches)check(!solid(model,p.x,p.y)&&reaches(p),resident.id+' cannot reach '+p.role);
                    const home=residentHomePose(resident.id);check(!solid(model,home.x,home.y)&&reaches(home),resident.id+' home pose is blocked');
                    let journeySamples=0;
                    for(const direction of ['home','out'])for(let t=0;t<journeyDuration(resident.id,direction);t+=.2){const p=interiorJourneyPose(resident.id,direction,t);if(p.hidden||!p.scene)continue;check(!solid(getInterior(p.scene),p.x,p.y),resident.id+' walks through a wall during '+direction+' at '+t);journeySamples++;if(p.scene.kind==='apartment')check(residentInScene(p,scene),resident.id+' journey appears in wrong apartment');}
                    reports.push({id:resident.id,variant:model.homePlan.variant,width:model.width,height:model.height,reachable:points.length,fixtureApproaches:model.homePlan.fixtureApproaches.length,journeySamples});
                }
                check(new Set(reports.map(r=>r.variant)).size===6,'NPC apartments repeat one floor plan');
                check(new Set(residents.map(r=>getInterior({kind:'apartment',resident:r.id}).items.find(i=>i.furnitureRole==='bed').asset)).size===18,'NPC bedroom furniture repeats one collection');
                check(APARTMENT_DECOR.length===48&&window.CodaFurnitureCatalog.length===484,'New furnishing stock is incomplete');
                const hashes=[];
                for(const def of APARTMENT_DECOR){const a=townBuilder.catalog.get(def.id);check(a&&a.canvas&&a.w===def.w&&a.h===def.h,'Missing native asset '+def.id);const pixels=a.canvas.getContext('2d').getImageData(0,0,a.w,a.h).data,digest=await crypto.subtle.digest('SHA-256',pixels);hashes.push([...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''));}
                check(new Set(hashes).size===48,'Apartment assets repeat an image');
                const layerCanvas=document.createElement('canvas');layerCanvas.width=2304;layerCanvas.height=1120;const lc=layerCanvas.getContext('2d');
                const playerScene={kind:'apartment',floor:15,resident:'player'},playerRug=getInterior(playerScene).items.find(i=>i.slot==='rug'||i.collectionSlot==='rug'),mark=playerRug?{x:playerRug.x,y:playerRug.y-4}:{x:1000,y:400};
                renderInterior(lc,playerScene,{catalog:townBuilder.catalog,actors:[],player:mark,drawPlayer:c=>{c.fillStyle='#ff00ff';c.fillRect(mark.x-16,mark.y-32,32,32);}});
                const pixels=lc.getImageData(mark.x-16,mark.y-32,32,32).data;let actorPixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]===255&&pixels[i+1]===0&&pixels[i+2]===255)actorPixels++;
                check(actorPixels===1024,'The apartment rug paints over the actor');
                const bachScene={kind:'apartment',floor:2,resident:'bach'},bach=getInterior(bachScene),bed=bach.items.find(i=>i.furnitureRole==='bed'),friend=bach.items.find(i=>i.collectionSlot==='toy'||i.furnitureRole==='personal-keepsake');
                const support=bach.items.find(i=>i.furnitureRole===friend.supportedBy)||bed;const bedImage=assetImage(townBuilder.catalog.get(support.asset)),friendImage=assetImage(townBuilder.catalog.get(friend.asset)),draw=lc.drawImage,order=[];
                lc.drawImage=function(source,...args){if(source===bedImage)order.push('support');if(source===friendImage)order.push('toy');return draw.call(this,source,...args);};
                renderInterior(lc,bachScene,{catalog:townBuilder.catalog,actors:[]});lc.drawImage=draw;
                check(order.indexOf('support')>=0&&order.indexOf('toy')>order.indexOf('support'),'Furniture paints over its supported toy');
                const layerChecks={actorAboveRugPixels:actorPixels,supportedToyDrawOrder:order};
                let clock=0,frames=0,walkDistance=0;const cv=document.createElement('canvas');cv.width=320;cv.height=240;const ctx=cv.getContext('2d');
                const moveAxis=(target,axis)=>{for(let i=0;Math.abs(urban.player[axis]-target)>.03&&i<4000;i++){const before={...urban.player},delta=target-before[axis],key=axis==='x'?(delta<0?'a':'d'):(delta<0?'w':'s');urban.frame(ctx,new Set([key]),Math.min(.04,Math.abs(delta)/450),clock+=40,320,240,()=>{});const d=distance(before,urban.player);check(d>.001,'Walking blocked at '+before.x+','+before.y+' toward '+key+' in '+urban.scene.resident);check(!solid(getInterior(urban.scene),urban.player.x,urban.player.y),'Player entered furniture');frames++;walkDistance+=d;}check(Math.abs(urban.player[axis]-target)<.04,'Could not reach a waypoint');};
                const move=p=>{moveAxis(p.x,'x');moveAxis(p.y,'y');};
                const walk=(target,label)=>{const m=getInterior(urban.scene),start={x:Math.floor(urban.player.x/16)*16+8,y:Math.floor(urban.player.y/16)*16+8};move(start);const {queue,parents,center}=navigation(m,urban.player),goal=queue.map(k=>({k,...center(k)})).sort((a,b)=>distance(a,target)-distance(b,target))[0];check(goal&&distance(goal,target)<25,label+' has no route');const path=[];for(let k=goal.k;k!==-1;k=parents[k])path.push(center(k));path.reverse();const before=walkDistance;for(let i=1;i<path.length;i++){const p=path[i],prev=path[i-1],next=path[i+1];if(!next||(p.x-prev.x)*(next.y-p.y)!==(p.y-prev.y)*(next.x-p.x))move(p);}if(!solid(m,target.x,target.y))move(target);return {label,distance:walkDistance-before,frames,position:{...urban.player}};};
                window.__homeQA={
                    hallDoor(id){const m=getInterior(urban.scene),zone=m.zones.find(z=>z.action==='room'&&z.resident===id);check(zone,'No unit door for '+id);return walk({x:zone.x+zone.w/2,y:zone.y+zone.h/2},id+' hall entrance');},
                    tour(){const m=getInterior(urban.scene);return m.homePlan.rooms.map(area=>walk(area.point,urban.scene.resident+' '+area.id));},
                    exit(){const m=getInterior(urban.scene),z=m.zones.find(z=>z.action==='exit');return walk({x:z.x+z.w/2,y:z.y+z.h/2},'Return to hall');}
                };
                return {homes:reports,assetHashes:hashes,aliases:APARTMENT_DECOR_ALIASES.map(a=>({id:a.id,w:a.w,h:a.h,boxes:a.boxes})),stock:window.CodaFurnitureCatalog,layerChecks};
            }''')
            (args.screenshots / 'model-checks.json').write_text(json.dumps(checks, indent=2))
            page.locator('#walk').click()
            tours = []
            for resident_id in ([] if args.skip_tours else ['bach', 'mozart', 'beethoven', 'haydn', 'ella', 'miles', 'zizi']):
                resident = next(row for row in setup['homes'] if row['id'] == resident_id)
                page.evaluate('(floor)=>townBuilder.urban.goFloor(floor)', resident['scene']['floor'])
                entry = page.evaluate('(id)=>__homeQA.hallDoor(id)', resident_id)
                page.locator('#map').focus()
                page.keyboard.press('e')
                page.wait_for_function('(id)=>townBuilder.urban.scene?.resident===id', arg=resident_id)
                areas = page.evaluate('__homeQA.tour()')
                exit_walk = page.evaluate('__homeQA.exit()')
                page.locator('#map').focus()
                page.keyboard.press('e')
                page.wait_for_function('townBuilder.urban.scene?.kind==="hall"')
                tours.append({'resident': resident_id, 'entry': entry, 'areas': areas, 'exit': exit_walk})
            (args.screenshots / 'tours.json').write_text(json.dumps(tours, indent=2))
            page.evaluate("townBuilder.urban.openRoom('player')")
            assert page.evaluate('townBuilder.urban.decor') == [legacy]
            products = [next(item for item in checks['stock'] if item['id'] == product_id) for product_id in ['furniture-apartment-fox-plush', 'furniture-apartment-patchwork-wall-art']]
            page.evaluate('townBuilder.urban.showShop()')
            before_balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance')
            for product in products:
                page.locator('.urban-catalog button').filter(has_text=product['name']).click()
                page.get_by_role('button', name=f"Buy · {product['price']} Notes", exact=True).click()
                page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)', arg=product['id'])
                assert page.locator('.urban-catalog button').filter(has_text=product['name']).is_disabled()
            balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance')
            assert balance == before_balance - sum(item['price'] for item in products)
            page.get_by_role('button', name='Close', exact=True).click()
            page.evaluate('townBuilder.urban.zoom(10000)')

            def frame():
                page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')

            def click_world(x, y):
                frame()
                point = page.evaluate('''({x,y})=>{const r=document.getElementById('map').getBoundingClientRect(),v=townBuilder.urban.view;return{x:r.x+r.width/2+(x-v.x)*v.zoom,y:r.y+r.height/2+(y-v.y)*v.zoom};}''', {'x': x, 'y': y})
                page.mouse.click(point['x'], point['y'])

            def choose(product):
                page.evaluate('townBuilder.urban.showInventory()')
                page.locator('.urban-catalog button').filter(has_text=product['name']).click()

            choose(products[0])
            click_world(1950, 820)
            page.wait_for_function('townBuilder.urban.decor.length===2')
            choose(products[1])
            click_world(550, 500)
            page.wait_for_function('townBuilder.urban.decor.length===3')
            art = page.evaluate("townBuilder.urban.decor.find(i=>i.item==='furniture-apartment-patchwork-wall-art')")
            assert art['y'] == 102 and art['scale'] == .75
            click_world(art['x'], art['y'] - 48)
            page.get_by_role('button', name='Move', exact=True).click()
            click_world(1400, 500)
            moved_art = page.evaluate("townBuilder.urban.decor.find(i=>i.item==='furniture-apartment-patchwork-wall-art')")
            assert moved_art['id'] == art['id'] and moved_art['x'] == 1400 and moved_art['y'] == 102
            click_world(1950, 790)
            page.get_by_role('button', name='Move', exact=True).click()
            click_world(2100, 910)
            saved = page.evaluate('townBuilder.urban.decor')
            assert next(item for item in saved if item['id'] == legacy['id']) == legacy
            page.screenshot(path=str(args.screenshots / 'player-owned-decor.png'))
            page.reload()
            page.wait_for_function('!!window.townBuilder')
            page.locator('#walk').click()
            page.evaluate("townBuilder.urban.openRoom('player');townBuilder.urban.zoom(10000)")
            assert page.evaluate('townBuilder.urban.decor') == saved
            assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == balance
            page.get_by_role('button', name='Furnish apartment', exact=True).click()
            page.get_by_role('button', name='Close', exact=True).click()
            for product in products:
                item = next(item for item in saved if item['item'] == product['id'])
                click_world(item['x'], item['y'] - (48 if item['scale'] == .75 else 30))
                page.get_by_role('button', name='Put away', exact=True).click()
            assert page.evaluate('townBuilder.urban.decor') == [legacy]
            assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == balance
            assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.filter(i=>i.startsWith("furniture-apartment-")).length') == 2
            result = {'models': checks, 'tours': tours, 'purchases': products, 'debit': before_balance - balance, 'wallSnap': moved_art, 'legacyDecorPreserved': True, 'reloadPreserved': True, 'putAwayPreservesOwnership': True, 'sourceUnchanged': True, 'pageErrors': errors}
            (args.screenshots / 'results.json').write_text(json.dumps(result, indent=2))
        assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
        assert not errors, errors
        print(json.dumps({'preview': args.preview, 'homes': len(setup['homes']), 'showrooms': len(setup['showrooms']), 'stock': len(setup['stock']), 'sourceUnchanged': True, 'pageErrors': errors}), flush=True)
        browser.close()
finally:
    server.shutdown()
