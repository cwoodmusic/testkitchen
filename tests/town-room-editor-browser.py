"""Real Town Builder room-editor controls and shared playable layouts.

Every mutation uses an isolated browser profile. The uploaded town source,
world document, wallet, profile and separately owned room decorations are guarded.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from tempfile import gettempdir
import argparse,hashlib,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json'
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--screenshots',type=Path,default=Path(gettempdir())/'coda-room-editor-browser');args=parser.parse_args();OUT=args.screenshots;OUT.mkdir(parents=True,exist_ok=True);source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start();steps=[]
def note(name,data=None):
 steps.append({'step':name,'data':data});(OUT/'progress.json').write_text(json.dumps(steps,indent=2));print(name,flush=True)
try:
 with sync_playwright()as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1600,'height':1100},accept_downloads=True)
  context.add_init_script("""(()=>{if(localStorage.getItem('__roomEditorQASeed'))return;localStorage.setItem('__roomEditorQASeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:500000,owned:['furniture-geranium'],rewards:[],earned:500020,spent:20}));localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Room Editor QA',customized:true}));})()""")
  page=context.new_page();page.set_default_timeout(90000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/?kit=urban');page.wait_for_function('!!window.townBuilder?.roomEditor');page.locator('#file').set_input_files(str(SOURCE));page.wait_for_function('townBuilder.project.objects.length===120')
   baseline=page.evaluate('()=>({world:JSON.stringify(townBuilder.project),cam:{...townBuilder.cam},wallet:localStorage.getItem("codaNotesWalletV1"),decor:localStorage.getItem("codaUrbanRoomV1"),profile:localStorage.getItem("musicArcadeV1")})');module_url=page.evaluate('new URL("../world/urban-interiors.mjs"+new URL(document.querySelector("script[type=module]").src).search,document.querySelector("script[type=module]").src).href')
   page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');page.set_default_timeout(15000);panel=page.get_by_role('region',name='Room editor',exact=True)if page.get_by_role('region',name='Room editor',exact=True).count()else page.locator('.room-editor-panel')
   assert page.locator('#roomEditorTheme option').count()==31;assert page.locator('#roomEditorTheme').input_value()=='showroom-midcentury-studio';assert page.locator('#walk').is_disabled()and page.locator('#play').is_disabled()
   page.evaluate('''async()=>{const app=new URL(document.querySelector('script[type=module]').src),{furnitureFacingBounds,furnitureFacingBoxes}=await import(new URL('../world/furniture-facing.mjs'+app.search,app));window.__editorBounds=id=>{const e=townBuilder.roomEditor,i=e.model.scene.items.find(i=>i.id===id);return furnitureFacingBounds(townBuilder.catalog.get(i.asset),i);};window.__editorSnapshot=()=>{const e=townBuilder.roomEditor;return{theme:e.theme.id,record:e.model.record(),revision:e.model.revision,held:e.held,raw:localStorage.getItem('codaRoomLayoutsV1:builder'),items:e.model.scene.items.map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,rotation:i.rotation||0,w:i.w,h:i.h})),world:JSON.stringify(townBuilder.project),cam:{...townBuilder.cam}};};window.__editorMoveCandidates=()=>{const e=townBuilder.roomEditor,h=e.held,m=e.model.scene,a=townBuilder.catalog.get(h.item.asset),old=new Set([h.originalId,...h.companions.map(i=>i.id)]),others=m.items.filter(i=>!old.has(i.id)),oldBoxes=new Set(m.items.flatMap(i=>i.collisionBoxes||[])),structural=m.solids.filter(b=>!oldBoxes.has(b)),candidates=[];for(let y=150;y<m.height-55;y+=24)for(let x=65;x<m.width-55;x+=24){const item={...h.item,x,y},boxes=furnitureFacingBoxes(a,item);if(boxes.some(b=>[...structural,...others.flatMap(i=>i.collisionBoxes||[])].some(r=>b.x<r.x+r.w&&b.x+b.w>r.x&&b.y<r.y+r.h&&b.y+b.h>r.y)))continue;const distance=Math.hypot(x-h.item.x,y-h.item.y);if(distance>45&&distance<300)candidates.push({x,y,cursor:{x:x+h.offset.x,y:y+h.offset.y},distance});}return candidates.sort((a,b)=>a.distance-b.distance).slice(0,35);};}''')
   def snap():return page.evaluate('__editorSnapshot()')
   def world_point(point):return page.evaluate('p=>{const r=document.getElementById("map").getBoundingClientRect(),v=townBuilder.roomEditor.view;return{x:r.left+r.width/2+(p.x-v.x)*v.zoom,y:r.top+r.height/2+(p.y-v.y)*v.zoom}}',point)
   def move(point):
    p=world_point(point);page.mouse.move(p['x'],p['y']);page.evaluate('()=>new Promise(requestAnimationFrame)')
   def click(point):
    p=world_point(point);page.mouse.click(p['x'],p['y']);page.evaluate('()=>new Promise(requestAnimationFrame)')
   def pick(item_id):
    b=page.evaluate('id=>__editorBounds(id)',item_id);click({'x':b['x']+b['w']/2,'y':b['y']+b['h']*.4});page.wait_for_function('!!townBuilder.roomEditor.held');assert page.evaluate('townBuilder.roomEditor.held.originalId')==item_id
   def choose_theme(theme):
    page.locator('#roomEditorTheme').select_option(theme);page.wait_for_function('id=>townBuilder.roomEditor.theme.id===id&&townBuilder.roomEditor.model.themeId===id',arg=theme);page.locator('#map').focus()
   initial=snap();sofa=next(i for i in initial['items']if i['asset'].endswith('-sofa'));pick(sofa['id']);held=snap();assert held['record']==initial['record']and held['raw']==initial['raw'];note('pick keeps original committed scene and storage')
   facings=[]
   for key,rotation,direction in [('ArrowUp',180,'north'),('ArrowRight',270,'east'),('ArrowDown',0,'south'),('ArrowLeft',90,'west')]:
    page.keyboard.press(key);actual=snap();assert actual['held']['item']['rotation']==rotation;assert actual['record']==initial['record']and actual['cam']==baseline['cam'];facings.append({'key':key,'rotation':rotation,'direction':direction})
   page.screenshot(path=str(OUT/'held-cardinal-ghost.png'));page.keyboard.press('Escape');assert not snap()['held']and snap()['record']==initial['record']and snap()['raw']==initial['raw'];note('four arrow facings and cancel preserve original',facings)
   pick(sofa['id']);offset=snap()['held']['offset'];invalid={'x':10+offset['x'],'y':150+offset['y']};move(invalid);assert not snap()['held']['valid'];assert page.locator('.room-editor-held').get_attribute('data-valid')=='false';assert page.locator('.room-editor-save').get_attribute('data-state')=='error';click(invalid);assert snap()['record']==initial['record']and snap()['raw']==initial['raw'];page.screenshot(path=str(OUT/'invalid-placement.png'));note('invalid collision preview refuses commit')
   valid=None
   for candidate in page.evaluate('__editorMoveCandidates()'):
    move(candidate['cursor'])
    if snap()['held']['valid']:
     click(candidate['cursor'])
     if not snap()['held']:valid=candidate;break
   assert valid,{'status':page.evaluate('townBuilder.roomEditor.status'),'held':snap()['held']};moved=snap();new_sofa=next(i for i in moved['items']if i['id']==sofa['id']);assert abs(new_sofa['x']-valid['x'])<.05 and abs(new_sofa['y']-valid['y'])<.05;assert moved['raw']and len([i for i in moved['items']if i['id']==sofa['id']])==1;note('click placement commits one stable instance',new_sofa)
   panel.get_by_role('button',name='Undo',exact=True).click();assert snap()['record']==initial['record'];panel.get_by_role('button',name='Redo',exact=True).click();assert snap()['record']==moved['record'];pick(sofa['id']);page.keyboard.press('Delete');assert not any(i['id']==sofa['id']for i in snap()['items']);panel.get_by_role('button',name='Undo',exact=True).click();assert snap()['record']==moved['record'];note('undo redo delete and undo restore exact records')
   # The palette starts a new held piece even when its initial point is blocked.
   raw_before_add=snap()['raw'];panel.get_by_role('button',name='All furniture',exact=True).click();page.get_by_role('searchbox',name='Search room furniture').fill('Headphone Whale');page.locator('.room-editor-piece[data-asset="plush-headphone-whale"]').click();assert snap()['held']and snap()['held']['originalId']is None and snap()['raw']==raw_before_add;page.keyboard.press('ArrowRight');assert snap()['held']['item']['rotation']==270
   added_id=snap()['held']['item']['id'];added_valid=False
   for candidate in page.evaluate('__editorMoveCandidates()'):
    move(candidate['cursor'])
    if snap()['held']['valid']:
     click(candidate['cursor'])
     if not snap()['held']:added_valid=True;break
   assert added_valid;assert any(i['id']==added_id and i['asset']=='plush-headphone-whale'for i in snap()['items']);page.screenshot(path=str(OUT/'palette-added-cardinal-plush.png'));panel.get_by_role('button',name='Undo',exact=True).click();assert snap()['record']==moved['record'];note('actual palette adds cardinal plush without charging wallet, undo removes it')
   choose_theme('bach');bach=snap();assert bach['theme']=='bach';choose_theme('player');assert snap()['theme']=='player';choose_theme('showroom-midcentury-studio');assert snap()['record']==moved['record'];note('three themes remain separate')
   with page.expect_download()as download:panel.get_by_role('button',name='Export layouts ↓',exact=True).click()
   export_path=OUT/'actual-export.json';download.value.save_as(export_path);pack=json.loads(export_path.read_text());assert pack['format']=='coda-room-layouts'and pack['rooms']['showroom-midcentury-studio']==moved['record'];assert not any(k in pack for k in ['wallet','project','profile'])
   panel.get_by_role('button',name='Reset theme',exact=True).click();assert snap()['record']==initial['record'];page.locator('.room-editor-panel input[type=file]').set_input_files(str(export_path));page.wait_for_function('document.querySelector(".room-editor-save").textContent.includes("imported")');assert snap()['record']==moved['record'];note('actual JSON export and import restore exact edited room')
   before_bad=snap();invalid_pack=json.loads(export_path.read_text());invalid_pack['rooms']['showroom-midcentury-studio']['placements'][0]['x']=-10000;page.locator('.room-editor-panel input[type=file]').set_input_files({'name':'invalid-room-layout.json','mimeType':'application/json','buffer':json.dumps(invalid_pack).encode()});page.wait_for_function('document.querySelector(".room-editor-save").dataset.state==="error"');assert snap()['record']==before_bad['record']and snap()['raw']==before_bad['raw'];note('invalid import is atomic and preserves valid saved scene')
   page.locator('.room-editor-panel input[type=file]').set_input_files({'name':'empty-layouts.json','mimeType':'application/json','buffer':json.dumps({'format':'coda-room-layouts','version':1,'owner':'builder','rooms':{}}).encode()});page.wait_for_function('document.querySelector(".room-editor-save").textContent.includes("imported")');assert snap()['record']==moved['record'];note('merge import preserves unrelated saved themes')
   panel.get_by_role('button',name='Back to town',exact=True).click();assert not page.evaluate('townBuilder.roomEditor.active');assert page.evaluate('JSON.stringify(townBuilder.project)')==baseline['world']and page.evaluate('({...townBuilder.cam})')==baseline['cam'];note('exit restores world document and camera exactly')
   page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor');page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');assert page.locator('#roomEditorTheme').input_value()=='showroom-midcentury-studio';assert page.evaluate('townBuilder.roomEditor.model.record()')==moved['record'];page.screenshot(path=str(OUT/'persisted-editor.png'));page.locator('.room-editor-exit').click();note('fresh reload retains saved theme and committed edit')
   page.locator('#walk').click();page.evaluate('()=>{const q=townBuilder.urban;q.enterBuilding(townBuilder.project.objects.find(o=>o.asset==="coda-furnishings"));q.goStoreFloor(1);q.openShowroom("midcentury-studio");}')
   walk=page.evaluate('''async args=>{const {getInterior}=await import(args.url),q=townBuilder.urban,m=getInterior(q.scene);return{item:m.items.find(i=>i.id===args.id),layoutRevision:m.layoutRevision,modelId:m.id};}''',{'url':module_url,'id':sofa['id']});assert walk['item']and abs(walk['item']['x']-new_sofa['x'])<1e-8 and abs(walk['item']['y']-new_sofa['y'])<1e-8;page.locator('#map').screenshot(path=str(OUT/'same-layout-walk-test.png'));page.locator('#walk').click();note('walk test resolves the same saved edited furniture',walk)
   page.locator('#play').click();page.wait_for_function('!!window.townGame');game=page.evaluate('()=>{const q=townGame.urban;q.enterBuilding(townGame.project.objects.find(o=>o.asset==="coda-furnishings"));q.goStoreFloor(1);q.openShowroom("midcentury-studio");return{objects:townGame.project.objects.length};}');assert game['objects']==120
   play=page.evaluate('''async args=>{const {getInterior}=await import(args.url),m=getInterior(townGame.urban.scene);return{item:m.items.find(i=>i.id===args.id),layoutRevision:m.layoutRevision,world:JSON.stringify(townGame.project)};}''',{'url':module_url,'id':sofa['id']});assert play['item']and abs(play['item']['x']-new_sofa['x'])<1e-8 and abs(play['item']['y']-new_sofa['y'])<1e-8;assert play['world']==baseline['world'];page.locator('#world').screenshot(path=str(OUT/'same-layout-play-town.png'));note('Play this town uses the same saved room and original town map',{'item':play['item'],'layoutRevision':play['layoutRevision']})
   final=page.evaluate('()=>({wallet:localStorage.getItem("codaNotesWalletV1"),decor:localStorage.getItem("codaUrbanRoomV1"),profile:localStorage.getItem("musicArcadeV1")})');assert final=={k:baseline[k]for k in final};assert not errors,errors
   (OUT/'results.json').write_text(json.dumps({'passed':True,'themes':31,'arrowFacings':facings,'editedItem':new_sofa,'actualExport':pack,'walk':walk,'play':{'item':play['item'],'layoutRevision':play['layoutRevision']},'worldWalletProfileOwnedDecorUnchanged':True,'sourceMapHash':source_hash,'pageErrors':errors,'steps':steps},indent=2));note('all focused editor checks passed')
  except Exception as error:
   try:page.screenshot(path=str(OUT/'failure.png'));(OUT/'failure.json').write_text(json.dumps({'error':str(error),'pageErrors':errors,'body':page.locator('body').inner_text()[:8000],'editor':page.evaluate('window.townBuilder?.roomEditor?.model?({theme:townBuilder.roomEditor.theme,record:townBuilder.roomEditor.model.record(),held:townBuilder.roomEditor.held,status:townBuilder.roomEditor.status}):null')},indent=2))
   except Exception:pass
   raise
  finally:browser.close()
finally:server.shutdown()
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
