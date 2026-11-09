"""Picnic/beach catalog, native rendering and editable-project browser checks.

Run: python tests/town-leisure-browser.py [--map path/to/project.json]
The browser profile is temporary; source projects are never modified.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import argparse
import base64
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--map', type=Path, default=ROOT/'town/maps/coda-town-courtyards.json')
parser.add_argument('--visual-only', action='store_true')
args = parser.parse_args()
source_bytes = args.map.read_bytes()
source = json.loads(source_bytes)
source_hash = hashlib.sha256(source_bytes).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p, TemporaryDirectory() as temporary:
  browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context = browser.new_context(viewport={'width':1600,'height':1100},accept_downloads=True)
  page = context.new_page()
  errors = []
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/?kit=leisure')
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert page.locator('#category').input_value()=='@leisure'
  assert page.locator('#library .asset').count()==38
  urls=page.evaluate('''()=>{
   const app=new URL(document.querySelector('script[type="module"]').src),q=app.search;
   return Object.fromEntries(['runtime','model','asset-color','render'].map(name=>[name,new URL('../world/'+name+'.mjs'+q,app).href]));
  }''')
  page.locator('#file').set_input_files(str(args.map))
  page.wait_for_function('name=>townBuilder.project.name===name',arg=source['name'],timeout=120000)
  page.wait_for_function('n=>townBuilder.project.objects.length===n',arg=len(source['objects']),timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  before=page.evaluate('JSON.stringify(townBuilder.project)')
  for button, category in [('allAssets',''),('urbanKit','@urban'),('leisureKit','@leisure')]:
   page.locator('#'+button).click()
   assert page.locator('#category').input_value()==category
   assert page.evaluate('JSON.stringify(townBuilder.project)')==before
  for text, expected in [('beach chair north',1),('lounger west',1),('picnic basket',2),('blankets',4)]:
   page.locator('#search').fill(text)
   assert page.locator('#library .asset').count()==expected,(text,page.locator('#library .asset').count())
  page.locator('#leisureKit').click()
  # Thumbnail/full-resolution swap must replace the source canvas identity.
  lazy=page.evaluate('''async()=>{
   const all=[...townBuilder.catalog.values()].filter(a=>a.pack==='town-leisure-38');
   const result=[];
   for(const id of ['picnic-lantern','beach-cabana','beach-deck-chair-north']){
    const a=townBuilder.catalog.get(id),before=a.canvas,url=before.toDataURL();await a.ensureFull();const after=a.canvas;
    result.push({id,changed:before!==after,pixelsChanged:url!==after.toDataURL()});
   }
   await Promise.all(all.map(a=>a.ensureFull()));
   return {total:townBuilder.catalog.size,count:all.length,swaps:result};
  }''')
  assert lazy['count']==38,lazy
  assert all(x['changed'] and x['pixelsChanged'] for x in lazy['swaps']),lazy
  physics=page.evaluate('''async({model,color})=>{
   const {blocked}=await import(model),{assetFilter}=await import(color),all=[...townBuilder.catalog.values()].filter(a=>a.pack==='town-leisure-38');
   const flat=all.filter(a=>a.layer==='ground'),solid=all.filter(a=>a.collisionDefault),directions=['north','east','south','west'];
   const object=a=>({id:a.id,asset:a.id,x:8192,y:6144,scale:1,rotation:0,layer:a.layer,collision:a.collisionDefault});
   const doc=o=>({version:1,name:'Physics fixture',cells:{},edges:{},objects:[o],spawn:{x:8000,y:6400}});
   for(const a of all){
    if(assetFilter(a)!=='saturate(.84) brightness(.96)')throw Error('Missing shared grade '+a.id);
    const o=object(a),d=doc(o);
    if(!o.collision){if(blocked(d,o.x,o.y-a.h*.3,townBuilder.catalog))throw Error('Flat prop blocks walking '+a.id);}
    else for(const b of a.boxes){const x=o.x+b.x+b.w/2-a.w/2,y=o.y+b.y+b.h/2-a.h;if(!blocked(d,x,y,townBuilder.catalog))throw Error('Solid foot not physical '+a.id);}
    const pixels=a.canvas.getContext('2d').getImageData(0,0,a.w,a.h).data;let clear=0;
    for(let i=3;i<pixels.length;i+=4)if(pixels[i]===0)clear++;
    if(!clear)throw Error('Opaque backdrop '+a.id);
   }
   const cabana=townBuilder.catalog.get('beach-cabana'),co=object(cabana),cd=doc(co);
   for(const y of [co.y-10,co.y-70,co.y-cabana.h*.4])if(blocked(cd,co.x,y,townBuilder.catalog))throw Error('Cabana middle is blocked');
   const seats=[];
   for(const kind of ['deck-chair','lounger']){
    const views=directions.map(dir=>townBuilder.catalog.get('beach-'+kind+'-'+dir));
    if(views.some((a,i)=>!a||a.facing!==directions[i]))throw Error('Missing authored directional metadata');
    if(new Set(views.map(a=>a.canvas.toDataURL())).size!==4)throw Error('Directional art is duplicated');
    seats.push(...views.map(a=>({id:a.id,w:a.w,h:a.h,facing:a.facing})));
   }
   const lamp=townBuilder.catalog.get('picnic-lantern');if(!lamp.lightEmitters?.length)throw Error('Lantern has no authored glow');
   return {flat:flat.length,solid:solid.length,seats};
  }''',{'model':urls['model'],'color':urls['asset-color']})
  # Native shared object renderer over the game's own material textures.
  visuals=page.evaluate('''async({render:modelURL,runtime})=>{
   const{drawObject}=await import(modelURL),{groundTexture}=await import(new URL('./ground-render.mjs'+new URL(runtime).search,runtime).href);
   const character=window.createCodaCharacterRenderer({worldScale:2.5}),profile=character.normalizeProfile({}),all=[...townBuilder.catalog.values()].filter(a=>a.pack==='town-leisure-38');
   const sheets=[];
   for(const[group,assets]of [['picnic',all.filter(a=>a.group==='picnic')],['beach',all.filter(a=>a.group==='beach')],['chairs',all.filter(a=>a.id.startsWith('beach-deck-chair-')||a.id.startsWith('beach-lounger-'))]]){
    const columns=4,cw=380,ch=260,cv=document.createElement('canvas');cv.width=cw*columns;cv.height=ch*Math.ceil(assets.length/columns);const c=cv.getContext('2d');
    assets.forEach((a,i)=>{
     const cell=document.createElement('canvas');cell.width=cw;cell.height=ch;const g=cell.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;
     const texture=groundTexture(group==='picnic'?'grass':'sand');g.fillStyle=g.createPattern(texture,'repeat');g.fillRect(0,0,cw*2,ch*2);
     const o={id:a.id,asset:a.id,x:410,y:445,scale:1,rotation:0,layer:a.layer,collision:a.collisionDefault},d={cells:{},edges:{},objects:[o]};
     drawObject(g,o,d);character.drawPlayer(g,profile,{x:75,y:445,facing:'down',walking:false,phase:0},0);
     g.fillStyle='#17271dc9';g.fillRect(0,475,cw*2,45);g.fillStyle='#f8f0d9';g.font='23px sans-serif';g.fillText(a.name,16,506,cw*2-26);
     c.drawImage(cell,i%columns*cw,Math.floor(i/columns)*ch);
    });sheets.push({group,url:cv.toDataURL('image/jpeg',.88)});
   }
   return sheets;
  }''',{'render':urls['render'],'runtime':urls['runtime']})
  for result in visuals:
   Path('/tmp/leisure-'+result['group']+'.jpg').write_bytes(base64.b64decode(result['url'].split(',')[1]))
  print(json.dumps({'catalog':lazy,'physics':physics,'previews':[f'/tmp/leisure-{x["group"]}.jpg' for x in visuals],'sourceObjects':len(source['objects']),'errors':errors}),flush=True)
  if not args.visual_only:
   fixture={'version':1,'name':'Isolated leisure asset QA','cells':{},'edges':{},'spawn':{'x':8192,'y':6500},'objects':[]}
   data=page.evaluate("['picnic-blanket-gingham','picnic-basket-open','beach-deck-chair-north','beach-lounger-west','picnic-lantern'].map(id=>{const a=townBuilder.catalog.get(id);return {id,layer:a.layer,collision:a.collisionDefault};})")
   for i,a in enumerate(data):fixture['objects'].append({'id':f'qa-{i}','asset':a['id'],'x':7900+i*320,'y':6100,'scale':1,'rotation':0,'layer':a['layer'],'collision':a['collision']})
   def load_fixture():
    page.locator('#file').set_input_files({'name':'leisure-qa.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
    page.wait_for_function('townBuilder.project.name==="Isolated leisure asset QA"',timeout=120000)
    page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved in this browser")',timeout=120000)
   # A previous road rotation must not turn authored cardinal chair art sideways.
   load_fixture();placement_before=page.evaluate('JSON.stringify(townBuilder.project)')
   page.locator('#leisureKit').click();page.locator('#rotation').select_option('90')
   page.locator('[data-asset="beach-deck-chair-east"]').click()
   page.wait_for_function('document.querySelector("#status").textContent.startsWith("Ready to place")',timeout=120000)
   assert page.locator('#rotation').input_value()=='0'
   assert page.evaluate('JSON.stringify(townBuilder.project)')==placement_before
   page.evaluate('Object.assign(townBuilder.cam,{x:9300,y:6500,zoom:1})')
   r=page.locator('#map').bounding_box();page.mouse.click(r['x']+r['width']/2,r['y']+r['height']/2)
   placed=page.evaluate('townBuilder.project.objects.at(-1)')
   assert placed['asset']=='beach-deck-chair-east' and placed['rotation']==0,placed
   page.locator('#undo').click();assert page.evaluate('JSON.stringify(townBuilder.project)')==placement_before
   moves=[]
   for index in [0,1,2]:
    load_fixture();old=page.evaluate('JSON.stringify(townBuilder.project)');o=fixture['objects'][index]
    page.locator('[data-tool="select"]').click()
    a=page.evaluate('id=>{const a=townBuilder.catalog.get(id);return {w:a.w,h:a.h};}',o['asset'])
    page.evaluate('cam=>Object.assign(townBuilder.cam,cam)',{'x':o['x'],'y':o['y']-a['h']/2,'zoom':1})
    r=page.locator('#map').bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+90,y,steps=8);page.mouse.up()
    moved=page.evaluate('id=>townBuilder.project.objects.find(o=>o.id===id)',o['id'])
    assert abs(moved['x']-o['x'])>40,moved
    changed=page.evaluate('JSON.stringify(townBuilder.project)');page.locator('#undo').click();assert page.evaluate('JSON.stringify(townBuilder.project)')==old
    page.locator('#redo').click();assert page.evaluate('JSON.stringify(townBuilder.project)')==changed
    page.wait_for_function('document.querySelector("#status").textContent.startsWith("Saved in this browser")',timeout=120000)
    page.reload();page.wait_for_function('!!window.townBuilder',timeout=120000)
    assert page.evaluate('JSON.stringify(townBuilder.project)')==changed
    moves.append({'asset':o['asset'],'from':o['x'],'to':moved['x']})
   load_fixture()
   with page.expect_download() as saved:page.locator('#save').click()
   portable=Path(temporary)/'leisure-export.json';saved.value.save_as(str(portable));assert json.loads(portable.read_text())==fixture
   night=page.evaluate('townBuilder.night');page.locator('#play').click();page.wait_for_function('!!window.townGame',timeout=120000)
   assert page.evaluate('townGame.project')==fixture
   assert page.evaluate('townGame.night')==night
   assert page.evaluate('townGame.catalog.get("beach-lounger-west").facing')=='west'
   print(json.dumps({'moves':moves,'portableExport':True,'playParity':True,'errors':errors}),flush=True)
  assert not errors,errors
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  browser.close()
finally:
 server.shutdown()
