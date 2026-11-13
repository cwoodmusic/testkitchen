"""Walk both Coda Furnishings floors and use every south-facing showroom door.

Only an isolated browser profile changes. The published map file is untouched.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import base64
import hashlib
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json'
OUT=ROOT/'work/store-hallways';OUT.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def copyfile(self,source,target):
        try:super().copyfile(source,target)
        except (BrokenPipeError,ConnectionResetError):pass

def protect_current_stock(page):
    expected=json.loads(subprocess.check_output(['node','-e',"process.stdout.write(JSON.stringify(require('./furniture-catalog.js')))"],cwd=ROOT,text=True))
    assert page.evaluate('window.CodaFurnitureCatalog')==expected,'The live store catalog differs from the canonical product definitions'
    legacy=json.loads((ROOT/'tests/fixtures/town-stock-original-100.json').read_text())['products']
    prices=json.loads((ROOT/'tests/fixtures/town-furniture-price-tiers.json').read_text())['legacy']
    differences=page.evaluate("""({legacy,prices})=>legacy.flatMap(old=>{const item=CodaFurnitureCatalog.find(p=>p.id===old.id);if(!item)return [{id:old.id,error:'missing'}];return [...new Set([...Object.keys(old),...Object.keys(item)])].filter(key=>item[key]!== (key==='price'?prices[old.id]:old[key])).map(key=>({id:old.id,key}));})""",{'legacy':legacy,'prices':prices})
    assert not differences,differences
    return {'originalProducts':len(legacy),'currentCatalogProducts':len(expected),'canonicalMetadataAndPricesPreserved':True}

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.add_init_script("""(()=>{if(localStorage.getItem('__storeHallwaySeed'))return;localStorage.setItem('__storeHallwaySeed','1');
          localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,owned:['furniture-geranium'],rewards:[],earned:170,spent:20}));
          localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));
          localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:3,best:45}},yellowNotes:{quarter:4,'eighth-pair':3,'sixteenth-group':2},npcRhythmWins:{bach:1}}));})()""")
        page=context.new_page();page.set_default_timeout(90000)
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        stock_protection=protect_current_stock(page)
        page.locator('#file').set_input_files(str(MAP));page.wait_for_function('townBuilder.project.objects.length===137')
        if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        fixture=page.evaluate("""()=>{const d=structuredClone(townBuilder.project),p=townBuilder.urban.portals.find(p=>p.object?.asset==='coda-furnishings');if(!p)throw Error('The store street door must exist');d.spawn={x:p.threshold.x-p.enterNormal.x*128,y:p.threshold.y-p.enterNormal.y*128};return d;}""")
        page.locator('#file').set_input_files({'name':'store-hallway-fixture.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
        page.wait_for_function('p=>townBuilder.project.spawn.x===p.x&&townBuilder.project.spawn.y===p.y',arg=fixture['spawn'])
        saved_before=page.evaluate("Object.fromEntries(Object.entries(localStorage).filter(([key])=>/codaNotesWallet|codaUrbanRoom|codaTownAdventures|codaRoomLayout/.test(key)))")
        page.locator('#walk').click()
        page.locator('#map').focus();outside_before=page.evaluate('townBuilder.urban.activities.state.player')
        page.keyboard.down('w');page.wait_for_timeout(200);page.keyboard.up('w')
        outside_after=page.evaluate('townBuilder.urban.activities.state.player')
        assert outside_before['y']-outside_after['y']>10,'The street approach must use actual WASD movement'
        assert page.evaluate('townBuilder.urban.scene') is None,'Walking toward the street door must wait for E'
        page.keyboard.press('e')
        page.wait_for_function("townBuilder.urban.scene?.kind==='shop'")
        print('Actual street WASD and E entered the store',flush=True)
        setup=page.evaluate(r'''async()=>{
          const app=new URL(document.querySelector('script[type="module"]').src),appSource=await(await fetch(app)).text(),urbanURL=new URL(appSource.match(/from\s+['"]([^'"]*world\/urban\.mjs[^'"]*)['"]/)[1],app),urbanSource=await(await fetch(urbanURL)).text(),interiorsURL=new URL(urbanSource.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],urbanURL),interiorsSource=await(await fetch(interiorsURL)).text(),
            module=name=>{const match=(interiorsSource+'\n'+urbanSource).match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"));return match?new URL(match[1],interiorsURL):new URL('../world/'+name+'.mjs'+app.search,app);},
            interiors=await import(interiorsURL),layout=await import(module('showroom-layout')),
            {preparePlacedFacingArt}=await import(module('furniture-art-access')),{warmHomeMaterials}=await import(module('home-materials')),
            {warmInteriorPortalArt,getDoorVisualGeometry}=await import(module('interior-portal-art')),{warmTowerCommonMaterials}=await import(module('tower-common-materials')),
            {interiorActorScale}=await import(module('interior-scale'));
          interiors.configureUrbanInteriors(townBuilder.catalog);window.storeSouthQA={...interiors,...layout,interiorActorScale,getDoorVisualGeometry};
          const check=(ok,text)=>{if(!ok)throw Error(text);},floors=[1,2].map(floor=>interiors.getInterior({kind:'shop',floor}));
          check(layout.SHOWROOMS.length===12,'The twelve original showroom IDs must remain');
          for(const model of floors){
            check(model.doors.length===(model.floor===1?8:4),'Incorrect showroom allocation');
            check(model.doors.every(d=>d.facing==='down'&&d.enterNormal?.x===0&&d.enterNormal?.y===-1),'A store showroom door still faces sideways');
            check(model.doors.every(d=>getDoorVisualGeometry(d).kind==='front'),'A south-facing store door must render as a full front door');
            check(!model.sideFacingShowrooms,'The lobby still uses side frontage architecture');
            check(model.lobbyFloorRects.some(r=>r.w>r.h&&r.w>1000),'Store must have real horizontal circulation halls');
            check(model.signs.every(label=>label.y<=(model.towerArchitecture?.northWallDepth||106)),'Generic text must not be painted over the walking floor');
            for(const display of layout.getStoreFloorShowrooms(model.floor)){
              const door=model.doors.find(d=>d.showroomId===display.id);
              check(door&&door.threshold.x===display.threshold.x&&door.threshold.y===display.threshold.y,'Door must use its authored showroom threshold');
              check(display.lobbyApproach.y>display.threshold.y,'A showroom must be approached from the south corridor');
              const inside=interiors.getInterior({kind:'showroom',showroomId:display.id});
              check(inside.items.length>8&&inside.collectionOwner==='showroom-'+display.id,'Showroom content or ownership changed');
              check(inside.width===display.apartment.width&&inside.height===display.apartment.height,'A public hallway resized the actual apartment');
              const primary=inside.portalExit?.door||inside.doors?.find(d=>d.id===inside.portalExit?.doorId);
              check(primary&&getDoorVisualGeometry(primary).kind==='front'&&inside.portalExit.enterNormal.x===0&&inside.portalExit.enterNormal.y===-1,'The primary showroom return door still faces sideways');
              check(inside.portalExit.threshold.y===inside.height-28,'The primary return must sit on the south edge');
              check(inside.privacyDoors.length===2,'The existing private bedroom and bathroom doors must remain');
            }
            await Promise.all([preparePlacedFacingArt({objects:[...model.items,...model.doors]},townBuilder.catalog),warmHomeMaterials(model.homeMaterialSuite),warmInteriorPortalArt(),warmTowerCommonMaterials()]);
          }
          const captures=[];await document.fonts.ready;
          for(const model of floors){
            interiors.clearInteriorRenderCache();const canvas=document.createElement('canvas');canvas.width=model.width;canvas.height=model.height;
            const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
            const texts=[],original=c.fillText.bind(c);c.fillText=(text,...args)=>{texts.push(String(text));return original(text,...args);};
            interiors.renderInterior(c,{kind:'shop',floor:model.floor},{catalog:townBuilder.catalog,actors:[],time:0});
            check(!texts.some(text=>/CODA FURNISHINGS|homes.*upstairs|UPPER GALLERY|larger homes/i.test(text)),'Store still paints a heading on the floor');
            const preview=document.createElement('canvas');preview.width=1600;preview.height=Math.ceil(model.height*1600/model.width);preview.getContext('2d').drawImage(canvas,0,0,preview.width,preview.height);
            captures.push({floor:model.floor,image:preview.toDataURL('image/png')});
          }
          return {ids:layout.SHOWROOMS.map(d=>({id:d.id,floor:d.storeFloor,approach:d.lobbyApproach,threshold:d.threshold,products:d.productIds})),stock:window.CodaFurnitureCatalog.map(i=>({id:i.id,asset:i.asset,price:i.price})),residents:interiors.residents.map(r=>({id:r.id,name:r.name})),captures};
        }''')
        for capture in setup['captures']:(OUT/f"floor-{capture['floor']}-overview.png").write_bytes(base64.b64decode(capture['image'].split(',')[1]))
        print('All twelve south-facing door models and both native floor renders verified',flush=True)
        page.clock.install();page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.locator('#map').focus()
        def scene():return page.evaluate('({scene:townBuilder.urban.scene,player:{...townBuilder.urban.player}})')
        walked=0
        def move_axis(target,axis):
            global walked
            for _ in range(300):
                before=scene();delta=target-before['player'][axis]
                if abs(delta)<5:return
                key=('d' if delta>0 else 'a') if axis=='x' else ('s' if delta>0 else 'w')
                scale=.375 if before['scene']['kind'] in ('showroom','apartment') else 1
                running=abs(delta)>120;speed=(780 if running else 450)*scale
                if running:page.keyboard.down('Shift')
                page.keyboard.down(key)
                try:page.clock.run_for(int(min(180,max(17,(abs(delta)-3)/speed*1000))))
                finally:page.keyboard.up(key);page.keyboard.up('Shift')
                after=scene()
                assert after['scene']==before['scene'],('A route changed rooms before E',before,after)
                assert abs(after['player'][axis]-before['player'][axis])>.01,('A real WASD walker was blocked',target,axis,before)
                walked+=abs(after['player'][axis]-before['player'][axis])
            raise AssertionError(('A real walker did not reach target',target,axis,scene()))
        def walk(goal):
            route=page.evaluate(r'''goal=>{
              const t=townBuilder,q=storeSouthQA,m=q.getInterior(t.urban.scene),start={...t.urban.player},pad=16*q.interiorActorScale(t.urban.scene)+6,step=16,
                solid=p=>p.x<40||p.y<100||p.x>m.width-40||p.y>m.height-40||m.solids.some(r=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad),
                clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));return Array.from({length:count+1},(_,i)=>({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count})).every(p=>!solid(p));},
                key=p=>`${p.x},${p.y}`;
              let initial;
              for(let radius=0;radius<5&&!initial;radius++)for(let yy=-radius;yy<=radius&&!initial;yy++)for(let xx=-radius;xx<=radius;xx++){
                const p={x:(Math.floor(start.x/step)+xx)*step+8,y:(Math.floor(start.y/step)+yy)*step+8};
                if(!solid(p)&&clear(start,{x:p.x,y:start.y})&&clear({x:p.x,y:start.y},p)){initial=p;break;}
              }
              if(!initial)throw Error('No clear route start');const queue=[initial],parent=new Map([[key(initial),null]]),points=new Map([[key(initial),initial]]);let end;
              for(let i=0;i<queue.length;i++){
                const a=queue[i];if(Math.hypot(a.x-goal.x,a.y-goal.y)<24&&clear(a,{x:goal.x,y:a.y})&&clear({x:goal.x,y:a.y},goal)){end=key(a);break;}
                for(const [dx,dy]of [[step,0],[-step,0],[0,step],[0,-step]]){const p={x:a.x+dx,y:a.y+dy},k=key(p);if(parent.has(k)||solid(p)||!clear(a,p))continue;parent.set(k,key(a));points.set(k,p);queue.push(p);}
              }
              if(!end)throw Error('No hallway route to '+JSON.stringify(goal)+' from '+JSON.stringify(start));
              const path=[];for(let k=end;k!==null;k=parent.get(k))path.push(points.get(k));path.reverse();path.push({x:goal.x,y:path.at(-1).y},goal);
              const turns=[];for(const p of path){if(turns.length&&p.x===turns.at(-1).x&&p.y===turns.at(-1).y)continue;while(turns.length>1){const a=turns.at(-2),b=turns.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))turns.pop();else break;}turns.push(p);}return turns;
            }''',goal)
            for point in route:move_axis(point['x'],'x');move_axis(point['y'],'y')
        def feature(action):
            return page.evaluate("action=>{const z=storeSouthQA.getInterior(townBuilder.urban.scene).zones.find(z=>z.action===action);if(!z)throw Error('Missing store circulation '+action);return {x:z.x+z.w/2,y:z.y+z.h/2};}",action)
        visited=[]
        for display in setup['ids']:
            current=scene()['scene']
            if current.get('floor')!=display['floor']:
                walk(feature('store-floor'));page.keyboard.press('e');page.clock.run_for(40)
                assert scene()['scene']=={'kind':'shop','floor':display['floor']},'The actual stairs must reach the upper hallway'
            walk(display['approach'])
            if len(visited) in (0,7,8,11):page.screenshot(path=str(OUT/f"door-{display['id']}.png"))
            page.keyboard.press('e');page.clock.run_for(40)
            current=scene()['scene'];assert current['kind']=='showroom' and current['showroomId']==display['id'],('Wrong showroom entered',display,current)
            inside_goal=page.evaluate("()=>{const m=storeSouthQA.getInterior(townBuilder.urban.scene),p=townBuilder.urban.player;return m.showroom.apartment.visitRoute.find(q=>Math.hypot(q.x-p.x,q.y-p.y)>36)||m.showroom.apartment.browse;}")
            walk(inside_goal)
            returned=page.evaluate("()=>{const p=townBuilder.urban.portals.find(p=>p.action==='showroom-lobby');if(!p)throw Error('No return portal');return p.approach;}")
            walk(returned)
            if len(visited) in (0,8):page.screenshot(path=str(OUT/f"showroom-return-{display['id']}.png"))
            page.keyboard.press('e');page.clock.run_for(40)
            current=scene();assert current['scene']['kind']=='shop' and current['scene']['floor']==display['floor']
            assert abs(current['player']['x']-display['approach']['x'])<2 and abs(current['player']['y']-display['approach']['y'])<2,('Showroom returned to the wrong hallway',display,current)
            visited.append(display['id']);print('Visited south door',display['id'],flush=True)
        # Reach each vertical circulation feature through ordinary corridors.
        walk(feature('store-elevator'));page.keyboard.press('e');page.get_by_role('button',name=re.compile(r'^Main lobby ·')).click();page.clock.run_for(40)
        assert scene()['scene']=={'kind':'shop','floor':1}
        street=page.evaluate("()=>townBuilder.urban.portals.find(p=>p.action==='exit').approach")
        walk(street);page.keyboard.press('e');page.clock.run_for(40);assert page.evaluate('townBuilder.urban.scene') is None
        assert page.evaluate('townBuilder.project')==fixture
        saved_after=page.evaluate("Object.fromEntries(Object.entries(localStorage).filter(([key])=>/codaNotesWallet|codaUrbanRoom|codaTownAdventures|codaRoomLayout/.test(key)))")
        for key,value in saved_before.items():assert saved_after.get(key)==value,('Saved purchases, notes or room state changed',key)
        assert page.evaluate('window.CodaFurnitureCatalog.map(i=>({id:i.id,asset:i.asset,price:i.price}))')==setup['stock']
        assert page.evaluate('storeSouthQA.residents.map(r=>({id:r.id,name:r.name}))')==setup['residents']
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        assert not errors,errors
        result={'southFacingShowrooms':len(visited),'visited':visited,'walkedWorldPixels':round(walked),'streetStairsAndLift':True,'primaryReturnsFaceSouth':True,'noFloorLabels':True,'savedMapPurchasesAndNotesUnchanged':True,'catalogAndResidentIdentitiesUnchanged':True,'stockProtection':stock_protection,'errors':errors}
        (OUT/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
        browser.close()
finally:
    server.shutdown()
