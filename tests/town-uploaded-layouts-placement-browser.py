"""Exact uploaded room defaults and real clear-floor placement in Builder/Play."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import base64
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT/'town/maps/coda-town-plaza-boardwalk.json'
LAYOUTS = ROOT/'town/room-layouts/approved-layouts-1.json'
UPLOAD_SHA = 'b7535338a3f7332285d2b84ff388ad3d1fac20b3833ec6667e59a21c4e9f7f95'
KEY = 'codaRoomLayoutsV1:builder'
parser = argparse.ArgumentParser()
parser.add_argument('--layouts', type=Path, default=LAYOUTS)
parser.add_argument('--screenshots', type=Path, default=ROOT/'work/room-layout-fix/browser')
args = parser.parse_args()
OUT = args.screenshots
OUT.mkdir(parents=True, exist_ok=True)
upload_bytes = args.layouts.read_bytes()
assert hashlib.sha256(upload_bytes).hexdigest() == UPLOAD_SHA
pack = json.loads(upload_bytes)
assert len(pack['rooms']) == 15
map_hash = hashlib.sha256(MAP.read_bytes()).hexdigest()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass
    def copyfile(self, source, target):
        try: super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError): pass


INSTALL = r'''async()=>{
 let app=new URL(document.querySelector('script[type=module]').src),code=await(await fetch(app)).text();
 if(!/from\s+['"][^'"]*urban\.mjs/.test(code)){
  app=new URL(code.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],app);code=await(await fetch(app)).text();
 }
 const dep=(source,base,name)=>new URL(source.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],base),
  urbanURL=dep(code,app,'urban'),urban=await(await fetch(urbanURL)).text(),interiorURL=dep(urban,urbanURL,'urban-interiors'),
  source=await(await fetch(interiorURL)).text();
 window.__interiors=await import(interiorURL);
 const editorURL=window.townBuilder?dep(code,app,'room-editor'):new URL('../builder/room-editor.mjs',interiorURL),editor=await(await fetch(editorURL)).text();
 window.__layoutModel=await import(dep(editor,editorURL,'room-layout-model'));
 window.__facing=await import(dep(source,interiorURL,'furniture-facing'));
 const navigationURL=new URL('../world/apartment-navigation.mjs'+app.search,app),navigation=await import(navigationURL),journeys=await import(new URL('../world/resident-journey.mjs'+app.search,app));
 window.__showroomNavigation=await import(dep(await(await fetch(navigationURL)).text(),navigationURL,'showroom-navigation'));
 const materials=await import(dep(source,interiorURL,'home-materials')),art=await import(dep(source,interiorURL,'furniture-art-access')),
  bounds=await import(dep(source,interiorURL,'wide-room-shell'));
 const catalog=window.townBuilder?.catalog||townGame.catalog;
 window.__warm=async scene=>{await Promise.all([art.preparePlacedFacingArt({objects:scene.items},catalog),materials.warmHomeMaterials(scene.homeMaterialSuite)]);for(const item of scene.items)if(item.roomRugId)await catalog.get(item.asset).ensureFull();};
 window.__recordFor=(id,request)=>__layoutModel.createRoomLayoutModel({themeId:id,scene:__interiors.getInterior(request),catalog}).record();
 window.__renderRoom=async request=>{
  const scene=__interiors.getInterior(request);await __warm(scene);__interiors.clearInteriorRenderCache();
  const b=bounds.getInteriorVisualBounds(scene),cv=document.createElement('canvas');cv.width=Math.ceil(b.w);cv.height=Math.ceil(b.h);
  const c=cv.getContext('2d');c.translate(-b.x,-b.y);__interiors.renderInterior(c,request,{model:scene,catalog,actors:[],time:0});
  return {image:cv.toDataURL('image/png'),width:scene.width,height:scene.height,visual:b,items:scene.items.length};
 };
 window.__doorProof=request=>{
  const scene=__interiors.getInterior(request),doors=[];
  for(const d of scene.privacyDoors||[]){
   const vertical=d.axis==='vertical',length=d.length||36,cx=vertical?d.x:d.x+length/2,cy=vertical?d.y+length/2:d.y;
   for(let at=-24;at<=24;at+=2){
    const p={x:cx+(vertical?at:0),y:cy+(vertical?0:at)};
    const hit=scene.solids.find(b=>p.x+6>b.x&&p.x-6<b.x+b.w&&p.y+6>b.y&&p.y-6<b.y+b.h);
    if(hit)throw Error('A six-pixel player cannot cross '+scene.id+' / '+d.id+' at '+JSON.stringify({p,hit}));
   }
   doors.push({id:d.id,axis:d.axis,x:cx,y:cy,length});
  }
  return {id:scene.id,doors};
 };
 window.__npcProof=request=>{
  const scene=__interiors.getInterior(request),home=scene.actors.find(a=>a.id===request.resident),routes=navigation.getApartmentNavigation(scene,home,scene.spawn);
  if(!routes||routes.outRoute.length<3)throw Error('The resident needs an actual detour around the placed chair');
  const check=p=>{if(scene.solids.some(b=>p.x+6>b.x&&p.x-6<b.x+b.w&&p.y+6>b.y&&p.y-6<b.y+b.h))throw Error('Resident crosses placed furniture at '+JSON.stringify(p));};
  for(const path of [routes.outRoute,routes.homeRoute])for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));
   for(let j=0;j<=n;j++)check({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});
  }
  const length=routes.outRoute.slice(1).reduce((s,p,i)=>s+Math.hypot(p.x-routes.outRoute[i].x,p.y-routes.outRoute[i].y),0),privateTime=length/58.5;
  let samples=0;for(let t=.01;t<privateTime;t+=.05){const p=journeys.interiorJourneyPose(request.resident,'out',t);if(p.scene.kind!=='apartment')throw Error('Resident skipped its edited private route');check(p);samples++;}
  const duration=journeys.journeyDuration(request.resident,'home');
  for(let t=.01;t<privateTime;t+=.05){const p=journeys.interiorJourneyPose(request.resident,'home',duration-privateTime+t);if(p.scene.kind!=='apartment')throw Error('Resident skipped its edited return route');check(p);samples++;}
  return {outRoute:routes.outRoute,homeRoute:routes.homeRoute,samples};
 };
 window.__showroomProof=request=>{
  const scene=__interiors.getInterior(request),navigation=__showroomNavigation.getShowroomNavigation(scene);
  const check=p=>{if(scene.solids.some(b=>p.x+6>=b.x&&p.x-6<=b.x+b.w&&p.y+6>=b.y&&p.y-6<=b.y+b.h))throw Error('Showroom route clips furniture at '+JSON.stringify(p));};
  const inspect=path=>{if(!path?.length)throw Error('A showroom route is missing');for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(let j=0;j<=n;j++)check({x:a.x+(b.x-a.x)*j/n,y:a.y+(b.y-a.y)*j/n});}};
  if(!navigation)throw Error('The edited showroom needs a collision-free tour');inspect(navigation.visitRoute);inspect(navigation.exitRoute);
  const browse=scene.showroom.apartment.browse;check(browse);
  if(navigation.visitRoute.at(-1).x!==browse.x||navigation.visitRoute.at(-1).y!==browse.y)throw Error('The tour must reach its refreshed clear browsing point');
  const approaches=[];for(const d of scene.privacyDoors||[]){const vertical=d.axis==='vertical',length=d.length||36,cx=vertical?d.x:d.x+length/2,cy=vertical?d.y+length/2:d.y;for(const sign of [-1,1]){
   const target={x:cx+(vertical?24*sign:0),y:cy+(vertical?0:24*sign)},plan={...scene,showroom:{apartment:{browse:target,visitRoute:[scene.spawn,target],exitRoute:[target,scene.spawn]}}},route=__showroomNavigation.getShowroomNavigation(plan);
   if(!route||route.visitRoute.at(-1).x!==target.x||route.visitRoute.at(-1).y!==target.y)throw Error('A real door approach became unreachable');inspect(route.visitRoute);approaches.push(target);
  }}
  return {browse,visitRoute:navigation.visitRoute,exitRoute:navigation.exitRoute,approaches};
 };
 if(window.townBuilder){
  window.__point=p=>{const r=document.getElementById('map').getBoundingClientRect(),v=townBuilder.roomEditor.view;return{x:r.left+r.width/2+(p.x-v.x)*v.zoom,y:r.top+r.height/2+(p.y-v.y)*v.zoom};};
  window.__item=id=>{const item=townBuilder.roomEditor.model.scene.items.find(i=>i.id===id);return item?{...item,bounds:__facing.furnitureFacingBounds(catalog.get(item.asset),item)}:null;};
  window.__snap=()=>{const e=townBuilder.roomEditor;return{record:e.model.record(),held:e.held,status:e.status,raw:localStorage.getItem('codaRoomLayoutsV1:builder'),revision:e.model.revision};};
 }
}'''

server = ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
errors, reports = [], []
requests = {}


def exact(actual, expected, name):
    if actual != expected:
        (OUT/'record-mismatch.json').write_text(json.dumps({'name':name,'actual':actual,'expected':expected},indent=2))
        raise AssertionError('Room record differs from the exact upload: '+name)


try:
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1800,'height':1100},accept_downloads=True)
        context.add_init_script('''(()=>{if(localStorage.getItem('__uploadedLayoutTestSeed'))return;localStorage.setItem('__uploadedLayoutTestSeed','1');
          localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:1234,owned:[],rewards:[],earned:1234,spent:0}));
          localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Preserve this profile',customized:true}));
          localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[]}));
          localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:19,netWins:2,fish:{},yellowNotes:{quarter:7,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{}}));})()''')
        page=context.new_page();page.set_default_timeout(90000)
        page.on('pageerror',lambda error:errors.append(str(error)))
        try:
            page.goto(origin+'/town/builder/')
            page.wait_for_function('!!window.townBuilder?.roomEditor')
            page.locator('#file').set_input_files(str(MAP))
            page.wait_for_function('townBuilder.project.objects.length===137')
            page.locator('#lightingToggle').select_option('day')
            if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
            world=page.evaluate('JSON.stringify(townBuilder.project)')
            protected=page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaUrbanRoomV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
            page.clock.install();page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
            page.locator('#roomEditor').click()
            page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
            page.evaluate(INSTALL)

            def choose(theme):
                page.locator('#roomEditorTheme').select_option(theme)
                page.wait_for_function('id=>townBuilder.roomEditor.theme.id===id&&townBuilder.roomEditor.model.themeId===id',arg=theme)
                requests[theme]=page.evaluate('townBuilder.roomEditor.theme.scene')
                page.locator('#map').focus()

            # Fresh defaults match every exact pose, removal and support in the
            # independent raw upload, without writing a room-template save.
            assert page.evaluate('(key)=>localStorage.getItem(key)',KEY) is None
            for theme, expected in pack['rooms'].items():
                choose(theme)
                actual=page.evaluate('townBuilder.roomEditor.model.record()')
                exact(actual,expected,'fresh Builder '+theme)
                exact(page.evaluate('([id,request])=>__recordFor(id,request)',[theme,requests[theme]]),expected,'fresh runtime '+theme)
                assert page.evaluate('townBuilder.roomEditor.model.scene.width') == 1184
                assert page.evaluate('townBuilder.roomEditor.model.scene.height') == 512
                door=page.evaluate('(request)=>__doorProof(request)',requests[theme])
                assert len(door['doors']) == 2,door
                reports.append({'theme':theme,'placements':len(actual['placements']),'removed':len(actual['removed']),'doorCrossings':door['doors']})
            assert page.evaluate('(key)=>localStorage.getItem(key)',KEY) is None
            print('Exact fresh defaults and 30 door crossings passed.',flush=True)

            # Import through the actual editor input, then reopen and reload.
            page.locator('.room-editor-panel input[type=file]').set_input_files(str(args.layouts))
            page.wait_for_function('document.querySelector(".room-editor-save").textContent.includes("imported")')
            raw=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
            exact(json.loads(raw)['rooms'],pack['rooms'],'actual import')
            for theme,expected in pack['rooms'].items():
                choose(theme);exact(page.evaluate('townBuilder.roomEditor.model.record()'),expected,'imported Builder '+theme)
            page.locator('.room-editor-exit').click()
            assert page.evaluate('JSON.stringify(townBuilder.project)') == world
            page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor')
            page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
            page.evaluate(INSTALL)
            assert page.evaluate('(key)=>localStorage.getItem(key)',KEY) == raw
            choose('bach');exact(page.evaluate('townBuilder.roomEditor.model.record()'),pack['rooms']['bach'],'reload Bach')
            page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
            print('Exact actual import and reload passed.',flush=True)

            def snap():return page.evaluate('__snap()')
            def screen(p):return page.evaluate('(p)=>__point(p)',p)
            def move(anchor):
                h=snap()['held'];p=screen({'x':anchor['x']+h['offset']['x'],'y':anchor['y']+h['offset']['y']})
                page.mouse.move(p['x'],p['y']);return p
            def palette(asset,all_furniture=False):
                panel=page.locator('.room-editor-panel');panel.get_by_role('button',name='All furniture' if all_furniture else 'This theme',exact=True).click()
                slot=page.evaluate('(id)=>townBuilder.catalog.get(id).slot',asset)
                page.get_by_role('searchbox',name='Search room furniture').fill(slot.replace('-',' '))
                target=page.locator('.room-editor-piece[data-asset='+json.dumps(asset)+']')
                for _ in range(6):
                    if target.count():break
                    panel.get_by_role('button',name='Show more pieces',exact=True).click(timeout=1000)
                target.click(timeout=10000)
                assert snap()['held']['item']['asset'] == asset
                page.keyboard.press('ArrowDown')

            # The old fixed NPC walking strip rejected this visible floor.
            baseline=snap()['record'];palette('collection-bach-dining-chair')
            added=snap()['held']['item']['id'];p=move({'x':930,'y':428})
            assert snap()['held']['valid'],snap()['held']
            page.mouse.click(p['x'],p['y']);assert snap()['held'] is None
            item=page.evaluate('(id)=>__item(id)',added);b=item['bounds'];start=screen({'x':b['x']+b['w']/2,'y':b['y']+b['h']*.6})
            page.mouse.move(start['x'],start['y']);page.mouse.down()
            assert snap()['held']['originalId'] == added
            before_drag=snap();dest=move({'x':900,'y':428})
            assert snap()['held']['valid'],snap()['held']
            assert snap()['raw'] == before_drag['raw']
            page.mouse.up();assert snap()['held'] is None
            item=page.evaluate('(id)=>__item(id)',added)
            assert abs(item['x']-900)<.001 and abs(item['y']-428)<.001,item
            npc_proof=page.evaluate('(request)=>__npcProof(request)',requests['bach'])
            assert npc_proof['samples'] > 100
            page.clock.run_for(34);page.screenshot(path=str(OUT/'clear-floor-chair-drag.png'))
            page.locator('.room-editor-panel').get_by_role('button',name='Undo',exact=True).click()
            page.locator('.room-editor-panel').get_by_role('button',name='Undo',exact=True).click()
            exact(snap()['record'],baseline,'chair drag undo')

            # The actual wall and opening remain protected after narrowing the
            # excessive doorway margin. Invalid clicks cannot save a record.
            palette('collection-bach-dining-chair')
            for target,reason in [({'x':372,'y':250},'wall'),({'x':276,'y':340},'door')]:
                before=snap()['raw'];p=move(target);held=snap()['held']
                assert not held['valid'] and reason in held['reason'].lower(),held
                page.mouse.click(p['x'],p['y']);assert snap()['held'] and snap()['raw']==before
            page.keyboard.press('Escape')
            palette('collection-bach-table-lamp');p=move({'x':254,'y':359})
            assert snap()['held']['valid'],snap()['held']
            page.mouse.click(p['x'],p['y']);assert snap()['held'] is None
            page.locator('.room-editor-panel').get_by_role('button',name='Undo',exact=True).click()
            exact(snap()['record'],baseline,'privacy margin undo')

            for theme in ['showroom-midcentury-studio','showroom-art-deco-lounge','bach']:
                choose(theme);proof=page.evaluate('(request)=>__renderRoom(request)',requests[theme])
                (OUT/(theme+'.png')).write_bytes(base64.b64decode(proof.pop('image').split(',')[1]))
                assert proof['width']==1184 and proof['height']==512

            # This unmodified theme had the same false hard target at its old
            # browsing point. Use its actual purchasable native chair in the UI.
            choose('showroom-victorian-parlor');page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
            palette('collection-showroom-victorian-parlor-dining-chair',all_furniture=True)
            victorian_id=snap()['held']['item']['id'];p=move({'x':908,'y':366})
            assert snap()['held']['valid'],snap()['held']
            page.mouse.click(p['x'],p['y']);assert snap()['held'] is None,snap()
            victorian_record=snap()['record'];placed=page.evaluate('(id)=>__item(id)',victorian_id)
            assert abs(placed['x']-908)<.001 and abs(placed['y']-366)<.001
            victorian_before=page.evaluate('(request)=>__showroomProof(request)',requests['showroom-victorian-parlor'])
            assert len(victorian_before['approaches'])==4
            page.clock.run_for(34);page.screenshot(path=str(OUT/'victorian-clear-floor-chair.png'))
            palette('collection-showroom-victorian-parlor-dining-chair',all_furniture=True)
            actual_wall=page.evaluate('()=>{const w=townBuilder.roomEditor.model.scene.walls.find(w=>w.h>100&&w.w<64);return{x:w.x+w.w/2,y:w.y+w.h/2+10};}')
            spawn=page.evaluate('({...townBuilder.roomEditor.model.scene.spawn})')
            for target,reason in [(actual_wall,'wall'),(spawn,'clear')]:
                raw_before=snap()['raw'];p=move(target);held=snap()['held']
                assert not held['valid'] and reason in held['reason'].lower(),held
                page.mouse.click(p['x'],p['y']);assert snap()['held'] and snap()['raw']==raw_before
            page.keyboard.press('Escape')
            page.locator('.room-editor-exit').click();page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor')
            page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');page.evaluate(INSTALL)
            choose('showroom-victorian-parlor');exact(snap()['record'],victorian_record,'Victorian clear-floor reload')
            victorian_after=page.evaluate('(request)=>__showroomProof(request)',requests['showroom-victorian-parlor'])
            assert len(victorian_after['approaches'])==4
            (OUT.parent/'victorian-browser-results.json').write_text(json.dumps({'passed':True,'asset':placed['asset'],'position':{'x':placed['x'],'y':placed['y']},'oldBrowse':{'x':908,'y':356},'recordReloadExact':True,'before':victorian_before,'after':victorian_after,'wallAndSpawnProtected':True,'errors':errors},indent=2))
            print('Victorian actual palette placement, save/reload, clear tour and four reachable door approaches passed.',flush=True)
            page.locator('.room-editor-exit').click()
            assert page.evaluate('JSON.stringify(townBuilder.project)') == world
            page.locator('#play').click();page.wait_for_function('!!window.townGame')
            page.evaluate(INSTALL)
            for theme,expected in pack['rooms'].items():
                actual=page.evaluate('([id,request])=>__recordFor(id,request)',[theme,requests[theme]])
                exact(actual,expected,'saved-town Play '+theme)
            # The supported preview route unlocks named homes without editing
            # player friendships, and still loads this exact saved builder map.
            url=page.url+'&urban=1';page.goto(url);page.wait_for_function('!!window.townGame')
            page.evaluate(INSTALL)
            for theme in ['showroom-midcentury-studio','showroom-art-deco-lounge','bach']:
                request=requests[theme]
                page.evaluate('''request=>{
                  const u=townGame.urban;u.reset();u.enterBuilding(townGame.project.objects.find(o=>o.asset===(request.kind==='apartment'?'coda-residences':'coda-furnishings')));
                  if(request.kind==='apartment')u.openRoom(request.resident);else{u.goStoreFloor(request.floor||1);if(!u.openShowroom(request.showroomId))throw Error('Could not open showroom');}
                }''',request)
                page.clock.run_for(34)
                actual=page.evaluate('([id,request])=>__recordFor(id,request)',[theme,request]);exact(actual,pack['rooms'][theme],'actual Play room '+theme)
                page.locator('#world').screenshot(path=str(OUT/(theme+'-play.png')))
            assert page.evaluate('JSON.stringify(townGame.project)') == world
            current=page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaUrbanRoomV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
            exact(current,protected,'protected player progress')
            assert not errors,errors
            assert hashlib.sha256(MAP.read_bytes()).hexdigest()==map_hash
            assert hashlib.sha256(args.layouts.read_bytes()).hexdigest()==UPLOAD_SHA
            (OUT/'results.json').write_text(json.dumps({'passed':True,'uploadSHA256':UPLOAD_SHA,'rooms':reports,'exactFreshDefaults':15,'exactImportedRooms':15,'exactPlayRooms':15,'realDragOldNPCStrip':True,'nativeResidentDetour':npc_proof,'clearPrivacyMargin':True,'wallDoorStillProtected':True,'mapAndProgressUnchanged':True,'errors':errors},indent=2))
            print('PASS: all15 exact uploaded defaults/import/reload/Play, 30 six-pixel door crossings, real native chair drag across the retired NPC strip, legal doorway margin, real wall/door rejection, unchanged map/progress.',flush=True)
        except Exception as error:
            try:
                page.screenshot(path=str(OUT/'failure.png'),full_page=True)
                (OUT/'failure.json').write_text(json.dumps({'error':str(error),'errors':errors,'body':page.locator('body').inner_text()[:8000],'editor':page.evaluate('window.townBuilder?.roomEditor?.model?__snap():null')},indent=2))
            except Exception:pass
            raise
        finally:
            context.close();browser.close()
finally:
    server.shutdown()
