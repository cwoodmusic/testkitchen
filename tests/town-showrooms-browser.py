"""Eight physical showrooms, distinct finishes and collection-aware shopping.

Run: python tests/town-showrooms-browser.py --screenshots /tmp/town-showrooms-final
The source map is imported into an isolated browser profile and never rewritten.
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


ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--map', type=Path, default=ROOT / 'town/maps/coda-town-uploaded-3.json')
parser.add_argument('--url', help='Optional published builder URL')
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/town-showrooms-final'))
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
            def production(route):
                try:
                    with urlopen(route.request.url, timeout=45) as response:
                        route.fulfill(status=response.status, headers={
                            'content-type': response.headers.get('content-type', 'application/octet-stream')
                        }, body=response.read())
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
            const model=getInterior({kind:'shop'}),rooms=model.rooms.filter(r=>r.showroomId);
            const check=(ok,label)=>{if(!ok)throw Error(label);};
            check(model.width===3072&&model.height===2048,'The store no longer fits its exterior footprint');
            check(rooms.length===8,'Expected eight actual showroom rooms');
            for(const field of ['showroomId','name','style'])check(new Set(rooms.map(r=>r[field])).size===8,'Repeated '+field);
            check(new Set(rooms.map(r=>r.floorFinish?.id)).size===8,'The eight floors are not distinct');
            check(new Set(rooms.map(r=>r.wallpaper?.id)).size===8,'The eight wallpapers are not distinct');
            const stock=window.CodaFurnitureCatalog;
            check(stock.length===36,'Existing stock changed');
            const allIds=new Set(stock.map(i=>i.id));
            check(new Set(rooms.flatMap(r=>r.productIds||[])).size===stock.length,'Some existing products have no showroom collection');
            for(const room of rooms){
                check(room.productIds?.length>=4,room.name+' has no complete furniture collection');
                check(room.productIds.every(id=>allIds.has(id)),room.name+' displays an unavailable product');
                check(model.items.filter(i=>i.showroomId===room.showroomId).length>=4,room.name+' is not furnished');
                check(model.walls.filter(w=>w.showroomId===room.showroomId).length>=4,room.name+' is an open bay rather than a room with walls');
                check(model.zones.some(z=>z.action==='shop'&&z.showroomId===room.showroomId),room.name+' has no browsing interaction');
            }
            await Promise.all([...new Set(model.items.map(i=>i.asset))].map(id=>Promise.resolve(townBuilder.catalog.get(id)?.ensureFull?.()).catch(()=>{})));
            await document.fonts.ready;
            const full=document.createElement('canvas');full.width=model.width;full.height=model.height;
            renderInterior(full.getContext('2d'),{kind:'shop'},{catalog:townBuilder.catalog,actors:[],time:0});
            await window.__saveShowroomImage('full-store',full.toDataURL('image/png'));
            const overview=document.createElement('canvas');overview.width=1600;overview.height=Math.ceil(model.height*1600/model.width);
            const oc=overview.getContext('2d');oc.imageSmoothingEnabled=false;oc.scale(1600/model.width,1600/model.width);
            renderInterior(oc,{kind:'shop'},{catalog:townBuilder.catalog,actors:[],time:0});
            await window.__saveShowroomImage('overview',overview.toDataURL('image/png'));
            const floorSamples=[];
            for(const room of rooms){
                const crop=document.createElement('canvas');crop.width=room.w+64;crop.height=room.h+160;
                const c=crop.getContext('2d');c.fillStyle='#131b21';c.fillRect(0,0,crop.width,crop.height);
                c.translate(32-room.x,96-room.y);renderInterior(c,{kind:'shop'},{catalog:townBuilder.catalog,actors:[],time:0});
                await window.__saveShowroomImage('room-'+room.showroomId,crop.toDataURL('image/png'));
                const sample=full.getContext('2d').getImageData(room.x+28,room.y+350,48,48).data;
                const colors=new Set();let sum=[0,0,0];
                for(let i=0;i<sample.length;i+=4){colors.add(sample[i]+','+sample[i+1]+','+sample[i+2]);for(let j=0;j<3;j++)sum[j]+=sample[i+j];}
                floorSamples.push({id:room.showroomId,colors:colors.size,mean:sum.map(n=>Math.round(n/(sample.length/4)))});
            }
            const cv=document.createElement('canvas');cv.width=320;cv.height=240;const ctx=cv.getContext('2d'),urban=townBuilder.urban;
            const solid=(x,y)=>x<40||y<100||x>model.width-40||y>model.height-40||model.solids.some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
            let steps=0,clock=0,walkDistance=0;
            const moveAxis=(target,axis)=>{
                for(let frame=0;Math.abs(urban.player[axis]-target)>.05&&frame<3000;frame++){
                    const before={...urban.player},delta=target-before[axis],key=axis==='x'?(delta<0?'a':'d'):(delta<0?'w':'s');
                    urban.frame(ctx,new Set([key]),Math.min(1/60,Math.abs(delta)/450),clock+=1000/60,320,240,()=>{});
                    const moved=Math.hypot(urban.player.x-before.x,urban.player.y-before.y);
                    check(moved>.001,'Actual WASD movement is blocked at '+before.x+','+before.y+' heading '+key);
                    check(!solid(urban.player.x,urban.player.y),'Actual player entered showroom furniture or a wall');
                    steps++;walkDistance+=moved;
                }
                check(Math.abs(urban.player[axis]-target)<=.05,'Actual player did not reach a route waypoint');
            };
            const move=(p)=>{moveAxis(p.x,'x');moveAxis(p.y,'y');};
            const step=16,cols=Math.ceil(model.width/step),rows=Math.ceil(model.height/step),center=k=>({x:(k%cols)*step+8,y:Math.floor(k/cols)*step+8});
            window.__walkToShowroom=(id)=>{
                const room=rooms.find(r=>r.showroomId===id),zone=model.zones.find(z=>z.showroomId===id&&z.action==='shop');
                check(room&&zone,'Unknown showroom '+id);
                const current=urban.player,start=Math.floor(current.y/step)*cols+Math.floor(current.x/step);
                move(center(start));
                const parent=new Int32Array(cols*rows).fill(-2),queue=[start];parent[start]=-1;
                for(let i=0;i<queue.length;i++){
                    const k=queue[i],x=k%cols,y=Math.floor(k/cols);
                    for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
                        const xx=x+dx,yy=y+dy,next=yy*cols+xx;
                        if(xx<0||yy<0||xx>=cols||yy>=rows||parent[next]!==-2)continue;
                        const p=center(next);if(solid(p.x,p.y))continue;parent[next]=k;queue.push(next);
                    }
                }
                const candidates=queue.map(k=>({k,...center(k)})).filter(p=>p.x>=zone.x&&p.x<=zone.x+zone.w&&p.y>=zone.y&&p.y<=zone.y+zone.h&&p.x>room.x+32&&p.x<room.x+room.w-32&&p.y>room.y+96&&p.y<room.y+room.h-32);
                candidates.sort((a,b)=>Math.hypot(a.x-room.browse.x,a.y-room.browse.y)-Math.hypot(b.x-room.browse.x,b.y-room.browse.y));
                check(candidates.length,room.name+' cannot be entered through its doorway with real player padding');
                const goal=candidates[0],path=[];for(let k=goal.k;k!==-1;k=parent[k])path.push(center(k));path.reverse();
                const turns=[];for(let i=1;i<path.length;i++){const p=path[i],prev=path[i-1],next=path[i+1];if(!next||(p.x-prev.x)*(next.y-p.y)!==(p.y-prev.y)*(next.x-p.x))turns.push(p);}
                const beforeSteps=steps,beforeDistance=walkDistance;for(const p of turns)move(p);
                return {id,name:room.name,position:{...urban.player},steps:steps-beforeSteps,distance:walkDistance-beforeDistance,route:turns};
            };
            window.__showroomModel=model;
            return {tag:app.search,rooms:rooms.map(r=>({id:r.showroomId,name:r.name,style:r.style,floor:r.floorFinish,wallpaper:r.wallpaper,productIds:r.productIds})),floorSamples,width:model.width,height:model.height,stock:stock.map(i=>({id:i.id,name:i.name,price:i.price,category:i.category}))};
        }""")
        walks = []
        for room in setup['rooms']:
            walk = page.evaluate('(id)=>window.__walkToShowroom(id)', room['id'])
            walks.append(walk)
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
        page.get_by_role('button', name='Browse furniture', exact=True).click()
        assert page.get_by_label('Showroom collection').locator('option').count() == 9
        assert page.locator('.urban-catalog button').count() == 36
        all_text = page.locator('.urban-catalog button span').all_text_contents()
        assert sorted(all_text) == sorted(item['name'] for item in setup['stock'])
        product = min(setup['stock'], key=lambda item: item['price'])
        collection = next(room for room in setup['rooms'] if product['id'] in room['productIds'])
        page.get_by_label('Showroom collection').select_option(collection['id'])
        page.locator('.urban-categories button[data-category="' + product['category'] + '"]').click()
        assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == product['category']
        selected_stock = [item for item in setup['stock'] if item['id'] in collection['productIds'] and item['category'] == product['category']]
        assert page.locator('.urban-catalog button').count() == len(selected_stock)
        page.locator('.urban-catalog button').filter(has_text=product['name']).click()
        page.get_by_role('button', name='Back to showroom catalog', exact=True).click()
        assert page.get_by_label('Showroom collection').input_value() == collection['id']
        assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == product['category']
        before_balance = page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1"))?.balance??150')
        page.locator('.urban-catalog button').filter(has_text=product['name']).click()
        page.get_by_role('button', name=f"Buy · {product['price']} Notes", exact=True).click()
        page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)', arg=product['id'])
        assert page.get_by_label('Showroom collection').input_value() == collection['id']
        assert page.locator('.urban-categories button[aria-pressed="true"]').get_attribute('data-category') == product['category']
        owned_card = page.locator('.urban-catalog button').filter(has_text=product['name'])
        assert owned_card.is_disabled() and 'Owned' in owned_card.inner_text()
        assert page.evaluate('JSON.parse(localStorage.getItem("codaNotesWalletV1")).balance') == before_balance - product['price']
        page.screenshot(path=str(args.screenshots / 'collection-shopping.png'))
        page.get_by_role('button', name='Close', exact=True).click()
        assert page.evaluate('townBuilder.project') == source
        page.evaluate('townBuilder.urban.zoom(4000)')
        perf = page.evaluate("""()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1200){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})""")
        assert perf['fps'] > 25, perf
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
        result = {**setup, 'walks': walks, 'shopping': {'item': product, 'collection': collection['id'], 'debit': product['price'], 'owned': True}, 'performance': perf, 'sourceUnchanged': True, 'pageErrors': errors}
        (args.screenshots / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result), flush=True)
        browser.close()
finally:
    server.shutdown()
