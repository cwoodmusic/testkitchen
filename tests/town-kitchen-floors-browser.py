"""Check native kitchen-floor pixels; --baseline optionally protects old saved rooms."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from playwright.sync_api import sync_playwright
import argparse,base64,json,math,hashlib

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--baseline',type=Path,help='Optional previously captured kitchen/furniture JSON')
parser.add_argument('--url',help='Optional published builder URL; HTTPS uses verified urllib transport')
parser.add_argument('--screenshots',type=Path,default=ROOT/'work/victorian-finish')
args=parser.parse_args();OUT=args.screenshots;OUT.mkdir(parents=True,exist_ok=True)
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json';source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
 def copyfile(self,source,target):
  try:super().copyfile(source,target)
  except (BrokenPipeError,ConnectionResetError):pass

def close_values(a,b,path='geometry'):
 if isinstance(a,(float,int)) and not isinstance(a,bool) and isinstance(b,(float,int)):
  assert math.isclose(a,b,abs_tol=1e-7), (path,a,b)
 elif isinstance(a,dict):
  assert isinstance(b,dict) and set(a)==set(b),(path,'keys')
  for key in a:close_values(a[key],b[key],path+'.'+key)
 elif isinstance(a,list):
  assert isinstance(b,list) and len(a)==len(b),(path,'length')
  for i,(x,y) in enumerate(zip(a,b)):close_values(x,y,path+'.'+str(i))
 else:assert a==b,(path,a,b)

CAPTURE_JS = r'''
async()=>{
   const app=new URL(document.querySelector('script[type="module"]').src),a=await(await fetch(app)).text(),urbanURL=new URL(a.match(/from\s+['"]([^'"]*world\/urban\.mjs[^'"]*)['"]/)[1],app),u=await(await fetch(urbanURL)).text(),interiorsURL=new URL(u.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],urbanURL),source=await(await fetch(interiorsURL)).text(),dep=name=>new URL(source.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],interiorsURL);
   const interiors=await import(interiorsURL),{preparePlacedFacingArt}=await import(dep('furniture-art-access')),{warmHomeMaterials,drawHomeMaterialFloor,drawHomeMaterialRug}=await import(dep('home-materials')),{warmInteriorPortalArt}=await import(dep('interior-portal-art')),{warmInteriorWindows}=await import(dep('interior-window-art'));
   const scene=townBuilder.urban.scene,model=interiors.getInterior(scene);await Promise.all([preparePlacedFacingArt({objects:[...model.items,...(model.doors||[])]},townBuilder.catalog),warmHomeMaterials(model.homeMaterialSuite),warmInteriorPortalArt(),warmInteriorWindows(model,townBuilder.catalog)]);await document.fonts.ready;interiors.clearInteriorRenderCache();
   const canvas=document.createElement('canvas');canvas.width=model.width;canvas.height=model.height;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;interiors.renderInterior(c,scene,{catalog:townBuilder.catalog,actors:[],time:0});
   const out=document.createElement('canvas');out.width=model.width*2;out.height=model.height*2;out.getContext('2d').imageSmoothingEnabled=false;out.getContext('2d').drawImage(canvas,0,0,out.width,out.height);
   const {SHOWROOMS}=await import(dep('showroom-layout')),{furnitureFacingBounds}=await import(dep('furniture-facing')),{createRoomLayoutModel}=await import(new URL('./room-layout-model.mjs'+dep('room-layout-runtime').search,interiorsURL)),records={},rooms=[];
   for(const d of SHOWROOMS.filter(d=>d.storeFloor===1)){
    const m=interiors.getInterior({kind:'showroom',showroomId:d.id,floor:1}),k=m.rooms.find(r=>r.functionalRole==='kitchen'),cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;const fc=cv.getContext('2d');drawHomeMaterialFloor(fc,k);const pixels=fc.getImageData(0,0,cv.width,cv.height).data;let x0=cv.width,y0=cv.height,x1=-1,y1=-1;
    for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(pixels[(y*cv.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const furniture=m.items.map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation||0,solid:i.solid,wallMounted:!!i.wallMounted,slot:i.slot||null,collisionBoxes:(i.collisionBoxes||[]).map(b=>({...b}))}));
    const fixtures=m.items.filter(i=>['sink','counter','stove','fridge','pantry'].includes(i.slot)).map(i=>({id:i.id,asset:i.asset,slot:i.slot,x:i.x,y:i.y,w:i.w,h:i.h,bounds:furnitureFacingBounds(townBuilder.catalog.get(i.asset),i)}));
    const roomGeometry=m.rooms.map(r=>({id:r.id||null,role:r.functionalRole||null,x:r.x,y:r.y,w:r.w,h:r.h,point:r.point||null}));
    const old=window.__savedKitchenLayouts?.rooms['showroom-'+d.id];if(old)createRoomLayoutModel({themeId:'showroom-'+d.id,scene:interiors.getInteriorBase({kind:'showroom',showroomId:d.id,floor:1}),catalog:townBuilder.catalog,record:old});
    records['showroom-'+d.id]=createRoomLayoutModel({themeId:'showroom-'+d.id,scene:m,catalog:townBuilder.catalog}).record();
    let rugProof=null;
    if(d.id==='victorian-parlor'){
     const mat=m.rugs.find(r=>r.x===436&&r.y===194),probe=document.createElement('canvas');probe.width=128;probe.height=88;const rc=probe.getContext('2d');rc.translate(16-mat.x,16-mat.y);
     const ready=typeof drawHomeMaterialRug==='function'&&drawHomeMaterialRug(rc,mat),data=rc.getImageData(0,0,128,88).data,colors=new Set();let count=0,outside=0;
     for(let y=0;y<88;y++)for(let x=0;x<128;x++){const at=(y*128+x)*4;if(!data[at+3])continue;count++;colors.add((data[at]<<16)|(data[at+1]<<8)|data[at+2]);if(x<16||x>=112||y<16||y>=72)outside++;}
     rugProof={ready,colors:colors.size,pixels:count,outsidePixels:outside,texture:mat.texture||null};
    }
    rooms.push({id:d.id,column:d.column,width:m.width,height:m.height,kitchen:{x:k.x,y:k.y,w:k.w,h:k.h,floorBounds:k.floorBounds||null,floorArea:k.floorArea||null},paintedBounds:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},fixtures,furniture,roomGeometry,rugs:m.rugs,rugProof,trimPresentation:m.homeMaterialSuite.wallpaper.trimPresentation,savedLayoutAccepted:!!old,walls:m.walls,privacyDoors:m.privacyDoors,spawn:m.spawn,portalExit:{threshold:m.portalExit.threshold,enterNormal:m.portalExit.enterNormal}});
   }
   return {image:out.toDataURL('image/png'),width:model.width,height:model.height,name:model.title,items:model.items.length,scene,rooms,savedLayouts:{format:'coda-room-layouts',version:1,owner:'builder',rooms:records}};
  }
'''

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1600,'height':1000})
  baseline=json.loads(args.baseline.read_text()) if args.baseline else None
  pack=baseline.get('savedLayouts') if baseline else None
  if pack:
   raw=json.dumps(pack);context.add_init_script('window.__savedKitchenLayouts=%s;if(!localStorage.getItem("codaRoomLayoutsV1:builder"))localStorage.setItem("codaRoomLayoutsV1:builder",%s);'%(json.dumps(pack),json.dumps(raw)))
  if args.url:
   cache={}
   def trusted(route):
    url=route.request.url
    if url not in cache:
     headers={'Accept-Encoding':'identity'}
     if route.request.headers.get('range'):headers['Range']=route.request.headers['range']
     try:response=urlopen(Request(url,headers=headers),timeout=60)
     except HTTPError as error:response=error
     with response:cache[url]=(response.status,{k:v for k,v in response.headers.items() if k.lower() in {'content-type','content-range','accept-ranges','cache-control'}},response.read())
    status,headers,body=cache[url];route.fulfill(status=status,headers=headers,body=body)
   context.route('https://cwoodmusic.github.io/testkitchen/**',trusted)
  page=context.new_page();page.set_default_timeout(90000);errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  page.locator('#file').set_input_files(str(MAP));page.wait_for_function('townBuilder.project.objects.length===137');fixture=page.evaluate('townBuilder.project')
  if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  page.locator('#walk').click();page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));townBuilder.urban.openShowroom('victorian-parlor')")
  page.wait_for_function("townBuilder.urban.scene?.showroomId==='victorian-parlor'")
  result=page.evaluate(CAPTURE_JS)
  (OUT/'victorian-after.png').write_bytes(base64.b64decode(result.pop('image').split(',')[1]))
  assert len(result['rooms'])==8
  old_rooms={r['id']:r for r in baseline['rooms']} if baseline else {}
  for room in result['rooms']:
   expected={'x':28 if room['column'] else 880,'y':106,'w':304 if room['id']=='midcentury-studio' else 276,'h':170}
   assert room['paintedBounds']==expected,(room['id'],room['paintedBounds'],expected)
   assert room['kitchen']['floorBounds']==expected
   for fixture_item in room['fixtures']:
    bounds=fixture_item['bounds'];assert bounds['x']>=expected['x']-1e-7 and bounds['x']+bounds['w']<=expected['x']+expected['w']+1e-7,(room['id'],fixture_item)
   if baseline:
    old=old_rooms[room['id']]
    for key in ['width','height','fixtures','furniture','roomGeometry','walls','privacyDoors','spawn','portalExit']:close_values(old[key],room[key],room['id']+'.'+key)
    assert room['savedLayoutAccepted'],room['id']
   if room['id']=='victorian-parlor':
    trim=room['trimPresentation'];assert trim['style']=='complete-scroll' and trim['insetTop']==4 and trim['insetBottom']==4
    assert 22-trim['insetTop']-trim['insetBottom']==14
    assert any(all(rug.get(k)==v for k,v in {'x':436,'y':194,'w':96,'h':56}.items()) for rug in room['rugs'])
    proof=room['rugProof'];assert proof['ready'] and proof['texture'],'The detailed native bath-rug bitmap must be ready, without a vector fallback'
    assert proof['colors']>=150 and proof['pixels']>2000 and proof['outsidePixels']==0,proof
   else:assert not room['rugs'],room['id']
  if pack:assert page.evaluate('localStorage.getItem("codaRoomLayoutsV1:builder")')==raw,'Saved layouts were rewritten'
  assert page.evaluate('townBuilder.project')==fixture
  assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  assert not failed,failed
  (OUT/'kitchens-after.json').write_text(json.dumps(result,indent=2))
  print(json.dumps({'rooms':8,'nativeFloorPixels':True,'mirrorsAndMidcenturyException':True,'fixturesCovered':True,'furnitureAndCollidersUnchanged':bool(baseline),'savedLayoutsAccepted':8 if pack else 0,'savedLayoutsUnchanged':bool(pack),'completeScrollArtHeight':14,'nativeBathRug':True,'rugDetailColors':proof['colors'],'rugOutsidePixels':proof['outsidePixels'],'mapUnchanged':True,'errors':errors,'failedResponses':failed,'after':str(OUT/'victorian-after.png')}),flush=True)
  browser.close()
finally:server.shutdown()
