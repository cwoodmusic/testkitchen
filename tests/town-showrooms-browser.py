"""Separate apartment showrooms: real lobby doors, complete homes and purchases.

Run: python tests/town-showrooms-browser.py --screenshots /tmp/town-apartment-showrooms
Only an isolated browser profile changes; the source map is never rewritten.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import urlopen
import argparse
import base64
import hashlib
import json
from playwright.sync_api import sync_playwright
from town_browser_compat import assert_original_furniture_stock

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--map', type=Path, default=ROOT / 'town/maps/coda-town-uploaded-3.json')
parser.add_argument('--url', help='Optional published builder URL')
parser.add_argument('--skip-tours', action='store_true', default=True, help='Run collection/purchase checks; automatic real-key journeys have their own suite')
parser.add_argument('--legacy-tours', action='store_false', dest='skip_tours', help='Compatibility only: older builds that require E to enter rooms')
parser.add_argument('--preview', action='store_true', help='Capture lobby and apartment scenes without walking/purchase checks')
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/town-apartment-showrooms'))
args = parser.parse_args()
source_bytes = args.map.read_bytes()
source = json.loads(source_bytes)
source_hash = hashlib.sha256(source_bytes).hexdigest()
args.screenshots.mkdir(parents=True, exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1600, 'height': 1100})
        if args.url:
            published_responses = {}
            def production(route):
                # Playwright routing disables Chromium's normal HTTP cache.
                # Reuse only successful bytes fetched from this published URL
                # during this run, so the profile-gate reload keeps that normal
                # static-site behavior without skipping the first live read.
                cached = published_responses.get(route.request.url)
                if cached:
                    route.fulfill(status=200, headers=cached[0], body=cached[1])
                    return
                try:
                    with urlopen(route.request.url, timeout=45) as response:
                        headers = {'content-type': response.headers.get('content-type', 'application/octet-stream')}
                        body = response.read()
                        if response.status == 200:
                            published_responses[route.request.url] = (headers, body)
                        route.fulfill(status=response.status, headers=headers, body=body)
                except HTTPError as error:
                    route.fulfill(status=error.code, body=error.read())
            context.route('https://cwoodmusic.github.io/**', production)
        page = context.new_page()
        page.set_default_timeout(180000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        def save_image(label, data):
            (args.screenshots / (label + '.png')).write_bytes(base64.b64decode(data.split(',')[1]))
        page.expose_function('__saveShowroomImage', save_image)
        page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/', timeout=180000)
        page.wait_for_function('!!window.townBuilder')
        original_stock=assert_original_furniture_stock(page)
        page.locator('#file').set_input_files(str(args.map))
        page.wait_for_function('n=>townBuilder.project.objects.length===n', arg=len(source['objects']))
        assert page.evaluate('townBuilder.project') == source
        if page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        page.locator('#walk').click()
        page.evaluate("""()=>{
            const shop=townBuilder.project.objects.find(o=>o.asset==='coda-furnishings');
            if(!shop||!townBuilder.urban.enterBuilding(shop))throw Error('Current map has no enterable furniture store');
        }""")
        page.wait_for_function("townBuilder.urban.scene?.kind==='shop'")
        setup = page.evaluate("""async()=>{
            const app=new URL(document.querySelector('script[type="module"]').src);
            const url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
            const {getInterior,renderInterior}=await import(url('urban-interiors'));
            const {SHOWROOMS}=await import(url('showroom-layout')),{preparePlacedFacingArt}=await import(url('furniture-art-access'));
            const urban=townBuilder.urban,lobbies=[getInterior({kind:'shop',floor:1}),getInterior({kind:'shop',floor:2})],lobby=lobbies[0];
            const check=(ok,label)=>{if(!ok)throw Error(label);};
            const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
            const stock=window.CodaFurnitureCatalog;
            const solid=(model,x,y)=>x<40||y<100||x>model.width-40||y>model.height-40||model.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
            check(lobby.width===3072&&lobby.height===2048,'Store lobby no longer fits the placed building');
            check(SHOWROOMS.length===12&&lobbies[0].id!==lobbies[1].id,'Expected twelve homes and separate store-floor models');check(SHOWROOMS.filter(r=>r.storeFloor===1).length===8&&SHOWROOMS.filter(r=>r.storeFloor===2).length===4,'Incorrect store floor allocation');
            const doorZones=lobbies.flatMap(m=>m.zones.filter(z=>z.action==='showroom'));
            check(doorZones.length===12&&new Set(doorZones.map(z=>z.showroomId)).size===12,'Store lacks twelve independent apartment doors');
            check(!lobby.items.some(i=>/^showroom-.*-(bed|sofa)$/.test(i.asset)),'Lobby still exposes apartment furniture as open bays');
            check(stock.length===484,'Expected 100 preserved products plus twelve 32-piece owner collections');
            const allProducts=new Map(stock.map(i=>[i.id,i]));
            const required=['kitchen','dining','living','bedroom','bathroom'];
            const matches=(area,role)=>{
                if(area.functionalRole)return area.functionalRole===role;
                const text=[area.functionalRole,area.role,area.name,area.id].filter(Boolean).join(' ').toLowerCase();
                return role==='bedroom'?/bed|sleep/.test(text):role==='bathroom'?/bath/.test(text):text.includes(role);
            };
            const rooms=SHOWROOMS.map(display=>{
                const scene={kind:'showroom',showroomId:display.id,floor:display.storeFloor},model=getInterior(scene),floorLobby=lobbies.find(m=>m.floor===display.storeFloor);check(model.floor===display.storeFloor,'Wrong showroom floor');
                check(model!==lobby&&model.id!==lobby.id,display.name+' still shares the lobby scene');
                check(model.kind==='showroom'&&model.showroomId===display.id,display.name+' has the wrong scene identity');
                check(model.width===display.w&&model.height===display.h,display.name+' exceeds its reserved physical floor area');
                check(model.items.length>=9,display.name+' is not a complete furnished apartment');
                const areas=required.map(role=>{const area=model.rooms.find(r=>matches(r,role));check(area,display.name+' lacks a '+role+' area');return {role,area};});
                const bath=areas.find(a=>a.role==='bathroom').area;
                const privacy=model.walls.filter(w=>w.x<=bath.x+bath.w+24&&w.x+w.w>=bath.x-24&&w.y<=bath.y+bath.h+24&&w.y+w.h>=bath.y-24);
                check(privacy.length>=2,display.name+' bathroom has no enclosing privacy walls');
                for(const slot of ['sink','stove','toilet','bath-fixture','vanity','mirror'])check(model.items.filter(i=>i.slot===slot).length===1,display.name+' needs exactly one apartment essential: '+slot);
                check(model.items.filter(i=>i.furnitureRole==='fridge').length===1,display.name+' lacks a refrigerator');
                for(const role of ['bedroom','bathroom'])check(model.rooms.filter(r=>r.functionalRole===role).length===1,display.name+' repeats its '+role);
                check(model.privacyDoors?.length===2,display.name+' lacks two visible privacy doors');
                for(const door of model.privacyDoors){const at=door.axis==='horizontal'?{x:door.x+door.length/2,y:door.y}:{x:door.x,y:door.y+door.length/2};check(!solid(model,at.x,at.y),display.name+' privacy doorway is blocked');}
                for(const role of ['bed','sofa']){
                    const asset='collection-showroom-'+display.id+'-'+role,product='furniture-'+asset;
                    check(model.items.some(i=>i.asset===asset),display.name+' lacks its unique '+role);
                    check(allProducts.get(product)?.asset===asset,display.name+' signature '+role+' cannot be purchased as displayed');
                    check(display.productIds.includes(product),display.name+' collection omits its '+role);
                }
                check(display.productIds.every(id=>allProducts.has(id)),display.name+' displays unavailable stock');
                check(model.zones.some(z=>z.action==='shop'&&z.showroomId===display.id),display.name+' has no collection interaction');
                check(model.zones.some(z=>z.action==='showroom-lobby'),display.name+' has no return door');
                check(display.lobbyReturn&&!solid(floorLobby,display.lobbyReturn.x,display.lobbyReturn.y),display.name+' returns into a wall');
                check(solid(floorLobby,display.x+display.w/2,display.y+display.h/2),display.name+' is still an open lobby bay');
                return {display,scene,model,areas};
            });
            check(new Set(rooms.map(r=>r.model.id)).size===12,'Apartment scenes share their cache identity');
            check(new Set(SHOWROOMS.map(r=>r.floorFinish?.id||r.floor?.id)).size===12,'Apartment floors repeat');
            check(new Set(SHOWROOMS.map(r=>r.wallpaper?.id)).size===12,'Apartment wallpapers repeat');
            const assetIds=[...new Set([...lobbies,...rooms.map(r=>r.model)].flatMap(m=>m.items.map(i=>i.asset)))];
            for(const m of lobbies)await preparePlacedFacingArt({objects:[...m.items,...(m.doors||[])]},townBuilder.catalog);
            await document.fonts.ready;
            const draw=scene=>{const m=getInterior(scene),cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;const c=cv.getContext('2d');c.imageSmoothingEnabled=false;renderInterior(c,scene,{catalog:townBuilder.catalog,actors:[],time:0});return cv;};
            const lobbyCanvas=draw({kind:'shop',floor:1});
            await window.__saveShowroomImage('lobby-full',lobbyCanvas.toDataURL('image/png'));
            const overview=document.createElement('canvas');overview.width=1600;overview.height=Math.ceil(lobby.height*1600/lobby.width);
            const oc=overview.getContext('2d');oc.imageSmoothingEnabled=false;oc.drawImage(lobbyCanvas,0,0,overview.width,overview.height);
            await window.__saveShowroomImage('lobby-overview',overview.toDataURL('image/png'));
            const upperCanvas=draw({kind:'shop',floor:2});await window.__saveShowroomImage('lobby-upper-full',upperCanvas.toDataURL('image/png'));
            const cellW=Math.max(...rooms.map(r=>r.model.width)),columns=2,rowHeights=Array.from({length:Math.ceil(rooms.length/columns)},(_,i)=>Math.max(...rooms.slice(i*columns,i*columns+columns).map(r=>r.model.height))+48);const sheet=document.createElement('canvas');sheet.width=cellW*columns;sheet.height=rowHeights.reduce((n,h)=>n+h,0);const sc=sheet.getContext('2d');sc.fillStyle='#131b21';sc.fillRect(0,0,sheet.width,sheet.height);sc.imageSmoothingEnabled=false;
            for(let i=0;i<rooms.length;i++){
                const r=rooms[i];await preparePlacedFacingArt({objects:[...r.model.items,...(r.model.doors||[])]},townBuilder.catalog);const cv=draw(r.scene);await window.__saveShowroomImage('apartment-'+r.display.id,cv.toDataURL('image/png'));
                const row=Math.floor(i/columns),cellH=rowHeights[row],x=i%columns*cellW,y=rowHeights.slice(0,row).reduce((n,h)=>n+h,0);sc.drawImage(cv,x,y,r.model.width,r.model.height);sc.fillStyle='#e2c794';sc.font='bold 22px Georgia';sc.textAlign='center';sc.fillText(r.display.name,x+cellW/2,y+cellH-16);
            }
            const sheetOverview=document.createElement('canvas');sheetOverview.width=1600;sheetOverview.height=Math.ceil(sheet.height*1600/sheet.width);const soc=sheetOverview.getContext('2d');soc.imageSmoothingEnabled=false;soc.drawImage(sheet,0,0,sheetOverview.width,sheetOverview.height);
            await window.__saveShowroomImage('apartments-overview',sheetOverview.toDataURL('image/png'));
            const signatureHashes=[];
            for(const r of rooms)for(const role of ['bed','sofa']){
                const id='collection-showroom-'+r.display.id+'-'+role,a=townBuilder.catalog.get(id);await a?.ensureFull?.();check(a?.canvas,id+' art failed to load');
                const pixels=a.canvas.getContext('2d').getImageData(0,0,a.canvas.width,a.canvas.height).data;
                const digest=await crypto.subtle.digest('SHA-256',pixels);signatureHashes.push({id,hash:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')});
            }
            check(new Set(signatureHashes.map(i=>i.hash)).size===24,'Signature furniture repeats the same image');
            const cv=document.createElement('canvas');cv.width=320;cv.height=240;const ctx=cv.getContext('2d');let steps=0,clock=0,walkDistance=0;
            const moveAxis=(target,axis)=>{
                for(let frame=0;Math.abs(urban.player[axis]-target)>.05&&frame<6000;frame++){
                    const before={...urban.player},delta=target-before[axis],key=axis==='x'?(delta<0?'a':'d'):(delta<0?'w':'s');
                    urban.frame(ctx,new Set([key]),Math.min(1/60,Math.abs(delta)/450),clock+=1000/60,320,240,()=>{});
                    const moved=distance(urban.player,before);check(moved>.001,'WASD blocked in '+urban.scene.kind+' at '+before.x+','+before.y+' heading '+key);
                    check(!solid(getInterior(urban.scene),urban.player.x,urban.player.y),'Player entered a wall or furniture');steps++;walkDistance+=moved;
                }
                check(Math.abs(urban.player[axis]-target)<=.05,'Player did not reach a route waypoint');
            };
            const move=p=>{moveAxis(p.x,'x');moveAxis(p.y,'y');};
            const walk=(predicate,preferred,label)=>{
                const model=getInterior(urban.scene),step=16,cols=Math.ceil(model.width/step),rows=Math.ceil(model.height/step),center=k=>({x:(k%cols)*step+8,y:Math.floor(k/cols)*step+8});
                const initial={...urban.player},start=Math.floor(initial.y/step)*cols+Math.floor(initial.x/step);move(center(start));
                const parents=new Int32Array(cols*rows).fill(-2),queue=[start];parents[start]=-1;
                for(let i=0;i<queue.length;i++){
                    const k=queue[i],x=k%cols,y=Math.floor(k/cols);
                    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
                        const xx=x+dx,yy=y+dy,next=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||parents[next]!==-2)continue;
                        const p=center(next);if(solid(model,p.x,p.y))continue;parents[next]=k;queue.push(next);
                    }
                }
                const candidates=queue.map(k=>({k,...center(k)})).filter(predicate).sort((a,b)=>distance(a,preferred)-distance(b,preferred));
                check(candidates.length,label+' has no route with real16px foot padding');
                const goal=candidates[0],path=[];for(let k=goal.k;k!==-1;k=parents[k])path.push(center(k));path.reverse();
                const turns=[];for(let i=1;i<path.length;i++){const p=path[i],prev=path[i-1],next=path[i+1];if(!next||(p.x-prev.x)*(next.y-p.y)!==(p.y-prev.y)*(next.x-p.x))turns.push(p);}
                const beforeSteps=steps,beforeDistance=walkDistance;for(const p of turns)move(p);
                return {label,position:{...urban.player},steps:steps-beforeSteps,distance:walkDistance-beforeDistance,route:turns};
            };
            const inside=(p,r,inset=0)=>p.x>=r.x+inset&&p.x<=r.x+r.w-inset&&p.y>=r.y+inset&&p.y<=r.y+r.h-inset;
            window.__apartmentQA={
                enter(id){check(urban.scene?.kind==='shop','Doors must be approached from the lobby');const r=rooms.find(r=>r.display.id===id),z=doorZones.find(z=>z.showroomId===id),at=r.display.lobbyApproach||r.display.lobbyReturn;return walk(p=>inside(p,z),at,'Lobby door '+r.display.name);},
                areas(id){check(urban.scene?.kind==='showroom'&&urban.scene.showroomId===id,'Wrong apartment scene');const r=rooms.find(r=>r.display.id===id);return r.areas.map(({role,area})=>walk(p=>inside(p,area,12),area.point||{x:area.x+area.w/2,y:area.y+area.h/2},r.display.name+' '+role));},
                browse(id){const r=rooms.find(r=>r.display.id===id),z=r.model.zones.find(z=>z.action==='shop'&&z.showroomId===id);return walk(p=>inside(p,z),{x:z.x+z.w/2,y:z.y+z.h/2},r.display.name+' collection');},
                exit(id){const r=rooms.find(r=>r.display.id===id),z=r.model.zones.find(z=>z.action==='showroom-lobby');return walk(p=>inside(p,z),r.model.spawn,r.display.name+' return door');},
                returned(id){const r=rooms.find(r=>r.display.id===id);check(urban.active&&urban.scene?.kind==='shop','Return unexpectedly left the store');check(distance(urban.player,r.display.lobbyReturn)<1,'Return did not restore this apartment lobby door');return {...urban.player};}
            };
            return {tag:app.search,width:lobby.width,height:lobby.height,floors:lobbies.map(m=>({id:m.id,floor:m.floor,width:m.width,height:m.height})),signatureHashes,rooms:rooms.map(r=>({id:r.display.id,name:r.display.name,storeFloor:r.display.storeFloor,style:r.display.style,floor:r.display.floorFinish||r.display.floor,wallpaper:r.display.wallpaper,productIds:r.display.productIds,width:r.model.width,height:r.model.height,areaNames:r.areas.map(a=>a.area.name),interiorDesign:r.model.interiorDesign,items:r.model.items.map(i=>({asset:i.asset,role:i.furnitureRole,rotation:i.rotation}))})),stock:stock.map(i=>({id:i.id,name:i.name,price:i.price,asset:i.asset,category:i.category}))};
        }""")
        (args.screenshots / 'setup.json').write_text(json.dumps(setup, indent=2))
        if args.preview:
            assert hashlib.sha256(args.map.read_bytes()).hexdigest() == source_hash
            assert not errors, errors
            print(json.dumps({'preview': True, 'rooms': len(setup['rooms']), 'sourceUnchanged': True, 'pageErrors': errors}), flush=True)
            browser.close()
            raise SystemExit(0)
        walks = []
        for index, room in enumerate([] if args.skip_tours else setup['rooms']):
            entry_walk = page.evaluate('(id)=>__apartmentQA.enter(id)', room['id'])
            page.locator('#map').focus()
            page.keyboard.press('e')
            page.wait_for_function("id=>townBuilder.urban.scene?.kind==='showroom'&&townBuilder.urban.scene.showroomId===id", arg=room['id'])
            area_walks = page.evaluate('(id)=>__apartmentQA.areas(id)', room['id'])
            browse_walk = page.evaluate('(id)=>__apartmentQA.browse(id)', room['id'])
            page.locator('#map').focus()
            page.keyboard.press('e')
            page.wait_for_selector('.urban-dialog[open]')
            assert page.locator('.urban-dialog h2').inner_text() == 'Coda Furnishings · ' + room['name']
            assert page.get_by_label('Showroom collection').input_value() == room['id']
            summary = page.get_by_label('Collection details').inner_text()
            assert room['floor']['label'] in summary
            assert room['wallpaper']['label'] in summary
            expected = sorted(i['name'] for i in setup['stock'] if i['id'] in room['productIds'])
            assert sorted(page.locator('.urban-catalog button span').all_text_contents()) == expected
            page.get_by_role('button', name='Close', exact=True).click()
            method = ['door', 'escape', 'hud'][index % 3]
            exit_walk = None
            if method == 'door':
                exit_walk = page.evaluate('(id)=>__apartmentQA.exit(id)', room['id'])
                page.locator('#map').focus()
                page.keyboard.press('e')
            elif method == 'escape':
                page.locator('#map').focus()
                page.keyboard.press('Escape')
            else:
                page.get_by_role('button', name='Back to lobby', exact=True).click()
            page.wait_for_function("townBuilder.urban.scene?.kind==='shop'")
            returned = page.evaluate('(id)=>__apartmentQA.returned(id)', room['id'])
            walks.append({'room': room['id'], 'entry': entry_walk, 'areas': area_walks, 'browse': browse_walk, 'returnMethod': method, 'exit': exit_walk, 'returned': returned})
            (args.screenshots / 'walks-progress.json').write_text(json.dumps(walks, indent=2))
        page.get_by_role('button', name='Browse furniture', exact=True).click()
        assert page.get_by_label('Showroom collection').locator('option').count() == 13
        assert page.locator('.urban-catalog button').count() == 484
        assert sorted(page.locator('.urban-catalog button span').all_text_contents()) == sorted(item['name'] for item in setup['stock'])
        collection = setup['rooms'][0]
        page.get_by_label('Showroom collection').select_option(collection['id'])
        page.locator('.urban-categories button[data-category="furniture"]').click()
        assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == 'furniture'
        selected_stock = [item for item in setup['stock'] if item['id'] in collection['productIds'] and item['category'] == 'furniture']
        assert page.locator('.urban-catalog button').count() == len(selected_stock)
        products = [next(item for item in setup['stock'] if item['id'] == f"furniture-collection-showroom-{collection['id']}-{role}") for role in ['bed', 'sofa']]
        assert [item['price'] for item in products] == [80, 70]
        before_balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1"))?.balance??150')
        assert before_balance == 150
        purchases = []
        for product in products:
            page.locator('.urban-catalog button').filter(has_text=product['name']).click()
            page.get_by_role('button', name='Back to showroom catalog', exact=True).click()
            assert page.get_by_label('Showroom collection').input_value() == collection['id']
            assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == 'furniture'
            prior_balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1"))?.balance??150')
            page.locator('.urban-catalog button').filter(has_text=product['name']).click()
            page.get_by_role('button', name=f"Buy · {product['price']} Notes", exact=True).click()
            page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)', arg=product['id'])
            assert page.get_by_label('Showroom collection').input_value() == collection['id']
            assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == 'furniture'
            owned_card = page.locator('.urban-catalog button').filter(has_text=product['name'])
            assert owned_card.is_disabled() and 'Owned' in owned_card.inner_text()
            assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == prior_balance - product['price']
            purchases.append({'id': product['id'], 'asset': product['asset'], 'debit': product['price'], 'owned': True})
        assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == 0
        page.screenshot(path=str(args.screenshots / 'collection-shopping.png'))
        page.get_by_role('button', name='Close', exact=True).click()
        assert page.evaluate('townBuilder.project') == source
        page.evaluate('townBuilder.urban.zoom(4000)')
        perf = page.evaluate("""()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1200){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})""")
        assert perf['fps'] > 25, perf
        if args.skip_tours:
            page.evaluate('(id)=>townBuilder.urban.openShowroom(id)', collection['id'])
        else:
            page.evaluate('(id)=>__apartmentQA.enter(id)', collection['id'])
            page.locator('#map').focus()
            page.keyboard.press('e')
        page.wait_for_function("id=>townBuilder.urban.scene?.kind==='showroom'&&townBuilder.urban.scene.showroomId===id", arg=collection['id'])
        page.evaluate('townBuilder.urban.zoom(-Math.log(.9/townBuilder.urban.view.zoom)*1000)')
        apartment_perf = page.evaluate("""()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1200){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})""")
        assert apartment_perf['fps'] > 25, apartment_perf
        page.screenshot(path=str(args.screenshots / 'active-apartment.png'))
        page.get_by_role('button', name='Back to lobby', exact=True).click()
        page.evaluate('(id)=>__apartmentQA.returned(id)', collection['id'])
        wallet_before = page.evaluate('localStorage.getItem("codaNotesWalletV1")')
        page.evaluate('localStorage.setItem("codaClassroomWorkspaceV1",JSON.stringify({version:1,private:true}))')
        page.reload()
        page.wait_for_function('!!window.townBuilder')
        page.evaluate('townBuilder.urban.showShop()')
        assert 'Open town from the arcade' in page.locator('.urban-dialog').inner_text()
        assert page.evaluate('localStorage.getItem("codaNotesWalletV1")') == wallet_before
        assert page.evaluate('townBuilder.project') == source
        assert hashlib.sha256(args.map.read_bytes()).hexdigest() == source_hash
        assert not errors, errors
        result = {**setup, 'originalStock':original_stock, 'walks': walks, 'shopping': {'collection': collection['id'], 'purchases': purchases, 'totalDebit': 150, 'balance': 0}, 'performance': {'lobby': perf, 'apartment': apartment_perf}, 'sourceUnchanged': True, 'sourceHash': source_hash, 'pageErrors': errors}
        (args.screenshots / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps({'rooms':len(setup['rooms']),'stock':len(setup['stock']),'shopping':result['shopping'],'performance':result['performance'],'sourceUnchanged':True,'pageErrors':errors}), flush=True)
        browser.close()
finally:
    server.shutdown()
