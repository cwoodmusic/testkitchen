"""Owned-room cardinal controls, hit testing, persistence and invalid turns.

--front-only exercises controls/geometry with native south art as the fallback;
it does not claim that authored north/east/west views have been verified.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,hashlib,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json'
parser=argparse.ArgumentParser();parser.add_argument('--front-only',action='store_true');parser.add_argument('--normal-camera',action='store_true',help='Keep the real default camera and stand near saved furniture instead of zooming out');parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/furniture-facing'));args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest();legacy={'id':'room-legacy-geranium','item':'furniture-geranium','asset':'decor-08-01','x':1800,'y':900,'scale':1};product_id='furniture-collection-showroom-midcentury-studio-reading-chair'
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120})
  context.add_init_script("""(()=>{if(localStorage.getItem('__facingQASeed'))return;localStorage.setItem('__facingQASeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:150,owned:['furniture-geranium','furniture-collection-showroom-midcentury-studio-reading-chair'],rewards:[],earned:170,spent:20}));localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));})()""")
  if args.front_only:context.route('**/directions-manifest.json*',lambda route:route.fulfill(status=200,content_type='application/json',body='{"collections":[]}'))
  page=context.new_page();page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  page.locator('#file').set_input_files(str(SOURCE));page.wait_for_function('townBuilder.project.objects.length===120');page.locator('#walk').click();page.evaluate("townBuilder.urban.openRoom('player')")
  if args.normal_camera:page.evaluate('Object.assign(townBuilder.urban.player,{x:2050,y:700})')
  else:page.evaluate('townBuilder.urban.zoom(10000)')
  info=page.evaluate('''async id=>{const app=new URL(document.querySelector('script[type=module]').src),{furnitureFacingBounds}=await import(new URL('../world/furniture-facing.mjs'+app.search,app)),{presentedRoomItem}=await import(new URL('../world/private-furniture.mjs'+app.search,app));window.__facingBounds=item=>furnitureFacingBounds(townBuilder.catalog.get(item.asset),presentedRoomItem(item,townBuilder.urban.scene,townBuilder.catalog));const p=CodaFurnitureCatalog.find(p=>p.id===id);await townBuilder.catalog.get(p.asset).ensureFull();return p;}''',product_id)
  def frame():page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
  def click_world(x,y):
   frame();point=page.evaluate('p=>{const r=document.getElementById("map").getBoundingClientRect(),v=townBuilder.urban.view;return{x:r.x+r.width/2+(p.x-v.x)*v.zoom,y:r.y+r.height/2+(p.y-v.y)*v.zoom}}',{'x':x,'y':y});page.mouse.click(point['x'],point['y'])
  def choose():
   page.evaluate('townBuilder.urban.showInventory()');page.locator('.urban-catalog button').filter(has_text=info['name']).click()
  def current():return page.evaluate('(id)=>townBuilder.urban.decor.find(o=>o.item===id)',product_id)
  def click_placed():
   b=page.evaluate('id=>__facingBounds(townBuilder.urban.decor.find(o=>o.item===id))',product_id);click_world(b['x']+b['w']/2,b['y']+b['h']*.6);page.get_by_role('group',name='Turn furniture',exact=True).wait_for()
  choose();hud=page.get_by_role('group',name='Furniture facing',exact=True)
  assert sorted(hud.locator('button').all_text_contents())==['East','North','South','West']
  hud.locator('[data-room-facing="north"]').click();assert page.evaluate('townBuilder.urban.furnitureRotation')==180
  page.locator('#map').focus();page.keyboard.press('r');assert page.evaluate('townBuilder.urban.furnitureRotation')==270
  page.keyboard.press('r');assert page.evaluate('townBuilder.urban.furnitureRotation')==0
  click_world(2100,800);page.wait_for_function('id=>townBuilder.urban.decor.some(o=>o.item===id)',arg=product_id);first=current();assert first['rotation']==0
  turned=[]
  for direction,rotation in [('north',180),('east',270),('south',0),('west',90)]:
   click_placed();page.get_by_role('group',name='Turn furniture',exact=True).locator('[data-room-facing="'+direction+'"]').click();page.wait_for_function('!document.querySelector(".urban-dialog[open]")');item=current();assert item['rotation']==rotation and item['id']==first['id'] and item['x']==2100 and item['y']==800,item
   turned.append({'direction':direction,'rotation':rotation,'bounds':page.evaluate('item=>__facingBounds(item)',item)})
  click_placed();page.get_by_role('button',name='Move',exact=True).click();assert page.evaluate('townBuilder.urban.furnitureRotation')==90;click_world(2150,900);moved=current();assert moved['rotation']==90 and moved['id']==first['id'] and moved['x']==2150 and moved['y']==900
  page.screenshot(path=str(args.screenshots/'facing-controls.png'));saved=page.evaluate('townBuilder.urban.decor');assert next(o for o in saved if o['id']==legacy['id'])==legacy
  wallet=page.evaluate('localStorage.getItem("codaNotesWalletV1")');page.reload();page.wait_for_function('!!window.townBuilder');page.locator('#walk').click();page.evaluate("townBuilder.urban.openRoom('player')")
  if args.normal_camera:page.evaluate('Object.assign(townBuilder.urban.player,{x:2050,y:700})')
  else:page.evaluate('townBuilder.urban.zoom(10000)')
  assert page.evaluate('townBuilder.urban.decor')==saved
  page.evaluate('''async()=>{const app=new URL(document.querySelector('script[type=module]').src),{furnitureFacingBounds}=await import(new URL('../world/furniture-facing.mjs'+app.search,app)),{presentedRoomItem}=await import(new URL('../world/private-furniture.mjs'+app.search,app));window.__facingBounds=item=>furnitureFacingBounds(townBuilder.catalog.get(item.asset),presentedRoomItem(item,townBuilder.urban.scene,townBuilder.catalog));}''')
  choose();assert page.evaluate('townBuilder.urban.furnitureRotation')==90;page.get_by_role('group',name='Furniture facing',exact=True).locator('[data-room-facing="south"]').click()
  if args.normal_camera:page.evaluate('Object.assign(townBuilder.urban.player,{x:2050,y:925})')
  edge_point=page.evaluate('''async id=>{const q=townBuilder.urban,app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{roomItemBoxes}=await import(url('urban-room')),{furniturePresentationScale}=await import(url('private-furniture')),{apartmentDecorBounds}=await import(url('urban-interiors')),item=q.decor.find(o=>o.item===id),scale=(placed,asset)=>furniturePresentationScale(placed,q.scene,asset),boxes=rotation=>roomItemBoxes({...item,x:0,y:0,rotation},townBuilder.catalog,scale),relative=rotation=>__facingBounds({...item,x:0,y:0,rotation}),south=relative(0),north=relative(180),southBottom=south.y+south.h,northBottom=north.y+north.h,area=apartmentDecorBounds(q.scene).find(r=>2150>=r.x&&2150<=r.x+r.w);if(!(northBottom>southBottom+2))throw Error('Chair has no asymmetric boundary for a meaningful invalid-turn check');return {x:2150,y:Math.floor(area.y+area.h-southBottom-1),southBottom,northBottom,southPhysicalBottom:Math.max(...boxes(0).map(b=>b.y+b.h)),northPhysicalBottom:Math.max(...boxes(180).map(b=>b.y+b.h))};}''',product_id)
  click_world(edge_point['x'],edge_point['y']);edge=current();assert edge['rotation']==0 and edge['y']==edge_point['y'],{'item':edge,'point':edge_point,'notice':page.locator('.urban-prompt').inner_text()}
  click_placed();page.get_by_role('group',name='Turn furniture',exact=True).locator('[data-room-facing="north"]').click();page.get_by_role('status').filter(has_text='inside').wait_for();assert current()==edge
  page.screenshot(path=str(args.screenshots/'invalid-turn-rejected.png'));page.get_by_role('button',name='Close',exact=True).click();click_placed();page.get_by_role('button',name='Put away',exact=True).click();assert page.evaluate('townBuilder.urban.decor')==[legacy]
  assert page.evaluate('localStorage.getItem("codaNotesWalletV1")')==wallet
  assert page.evaluate('(id)=>JSON.parse(localStorage.getItem("codaNotesWalletV1")).owned.includes(id)',product_id)
  assert page.evaluate('townBuilder.project')==json.loads(SOURCE.read_bytes());assert not errors,errors;browser.close()
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
 result={'normalPlayCamera':args.normal_camera,'frontFallbackOnly':args.front_only,'directionArtworkVerified':False,'cardinalControls':turned,'keyboardR':True,'movePreservedFacing':True,'reloadPreservedFacing':True,'invalidTurnRejectedWithoutMutation':True,'derivedBoundary':edge_point,'ownershipAndWalletUnchanged':True,'legacyDecorUnchanged':True,'sourceUnchanged':True,'pageErrors':errors};(args.screenshots/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
finally:server.shutdown()
