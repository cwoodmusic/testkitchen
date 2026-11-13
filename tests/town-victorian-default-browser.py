"""User-promoted Victorian defaults, fresh gameplay, Reset, and old saved overrides."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import argparse, base64, hashlib, json, math
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'town/maps/coda-town-plaza-boardwalk.json'
KEY = 'codaRoomLayoutsV1:builder'
TABLE = 'showroom-victorian-parlor:family-room-1:family-coffee-table-1'
RUG = 'room-rug-victorian-bath-rug'
parser = argparse.ArgumentParser()
parser.add_argument('--url', help='Published builder URL; HTTPS uses verified urllib transport')
parser.add_argument('--baseline',type=Path,help='Optional frozen all-room records from before default promotion')
parser.add_argument('--screenshots', type=Path, default=ROOT/'work/victorian-default/browser')
args = parser.parse_args()
OUT = args.screenshots
OUT.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(MAP.read_bytes()).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def copyfile(self, source, target):
        try: super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = args.url or f'http://127.0.0.1:{server.server_port}/town/builder/'
steps = []
errors, failed = [], []

def note(name, data=None):
    steps.append({'step': name, 'data': data})
    (OUT/'progress.json').write_text(json.dumps(steps, indent=2))
    print(name, flush=True)

INSTALL = r'''async()=>{
 let app=new URL(document.querySelector('script[type=module]').src),a=await(await fetch(app)).text();
 if(!/from\s+['"][^'"]*urban\.mjs/.test(a)){app=new URL(a.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],app);a=await(await fetch(app)).text();}
 const uURL=new URL(a.match(/from\s+['"]([^'"]*urban\.mjs[^'"]*)['"]/)[1],app),u=await(await fetch(uURL)).text(),iURL=new URL(u.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],uURL),src=await(await fetch(iURL)).text(),dep=name=>new URL(src.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],iURL);
 window.__worldModuleURL=iURL.href;
 const f=await import(dep('furniture-facing'));window.__interiors=await import(iURL);window.__bounds=f.furnitureFacingBounds;
 window.__warm=async m=>{const{preparePlacedFacingArt}=await import(dep('furniture-art-access')),{warmHomeMaterials}=await import(dep('home-materials')),{warmInteriorPortalArt}=await import(dep('interior-portal-art')),{warmInteriorWindows}=await import(dep('interior-window-art')),catalog=window.townBuilder?.catalog||townGame.catalog;await Promise.all([preparePlacedFacingArt({objects:m.items},catalog),warmHomeMaterials(m.homeMaterialSuite),warmInteriorPortalArt(),warmInteriorWindows(m,catalog),document.fonts.ready]);for(const i of m.items)if(i.roomRugId)await catalog.get(i.asset).ensureFull();};
 window.__point=p=>{const e=townBuilder.roomEditor,r=document.getElementById('map').getBoundingClientRect(),v=e.view;return{x:r.left+r.width/2+(p.x-v.x)*v.zoom,y:r.top+r.height/2+(p.y-v.y)*v.zoom}};
 window.__snap=()=>{const e=townBuilder.roomEditor;return{record:e.model.record(),revision:e.model.revision,held:e.held,status:e.status,raw:localStorage.getItem('codaRoomLayoutsV1:builder'),writes:window.__layoutWrites,items:e.model.scene.items.map(i=>({id:i.id,asset:i.asset,roomRugId:i.roomRugId||null,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation||0,solid:i.solid,layer:i.layer,bounds:__bounds(townBuilder.catalog.get(i.asset),i)}))}};
}'''

def transport(context):
    if not args.url: return
    cache = {}
    def trusted(route):
        url = route.request.url
        if url not in cache:
            try: response = urlopen(Request(url, headers={'Accept-Encoding': 'identity'}), timeout=60)
            except HTTPError as error: response = error
            with response:
                cache[url] = (response.status, {k:v for k,v in response.headers.items() if k.lower() in {'content-type','content-range','accept-ranges','cache-control'}}, response.read())
        status, headers, body = cache[url]
        route.fulfill(status=status, headers=headers, body=body)
    context.route('https://cwoodmusic.github.io/testkitchen/**', trusted)

def boot(context):
    transport(context)
    page = context.new_page()
    page.set_default_timeout(90000)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: failed.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
    page.goto(url)
    page.wait_for_function('!!window.townBuilder?.roomEditor')
    page.locator('#file').set_input_files(str(MAP))
    page.wait_for_function('townBuilder.project.objects.length===137')
    return page

def same_pose(a, b):
    return all(math.isclose(a[k], b[k], abs_tol=.001) for k in ['x','y','rotation'])

def assert_record(actual, expected):
    assert actual['baseSignature']==expected['baseSignature']
    assert {p['id']:p for p in actual['placements']}=={p['id']:p for p in expected['placements']}
    assert set(actual['removed'])==set(expected['removed'])
    assert actual['added']==expected['added']
    assert actual.get('rugs')==expected.get('rugs')

def close_values(a,b,path='geometry'):
    if isinstance(a,(float,int)) and not isinstance(a,bool) and isinstance(b,(float,int)):
        assert math.isclose(a,b,abs_tol=1e-7),(path,a,b)
    elif isinstance(a,dict):
        assert isinstance(b,dict) and set(a)==set(b),(path,'keys')
        for key in a:close_values(a[key],b[key],path+'.'+key)
    elif isinstance(a,list):
        assert isinstance(b,list) and len(a)==len(b),(path,'length')
        for index,(x,y) in enumerate(zip(a,b)):close_values(x,y,path+'.'+str(index))
    else:assert a==b,(path,a,b)

def physical_items(items):
    keys=['id','asset','x','y','w','h','solid','layer','wallMounted','collisionBoxes']
    return sorted([{**{k:i.get(k) for k in keys},'rotation':i.get('rotation',0)} for i in items if not i.get('roomRugId')],key=lambda i:i['id'])

CAPTURE = r'''async game=>{
 const q=game?townGame:townBuilder,request=q.urban.scene,m=__interiors.getInterior(request);await __warm(m);__interiors.clearInteriorRenderCache();
 const cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;__interiors.renderInterior(cv.getContext('2d'),request,{model:m,catalog:q.catalog,actors:[],time:0});
 const out=document.createElement('canvas');out.width=m.width*2;out.height=m.height*2;out.getContext('2d').imageSmoothingEnabled=false;out.getContext('2d').drawImage(cv,0,0,out.width,out.height);
 return {items:m.items.filter(i=>!i.roomRugId).map(i=>({id:i.id,asset:i.asset,x:i.x,y:i.y,rotation:i.rotation||0,support:i.supportedBy&&i.supportedBy!=='north-wall'?i.supportedBy:null})),width:m.width,height:m.height,spawn:m.spawn,portalExit:m.portalExit,image:out.toDataURL('image/png'),world:JSON.stringify(q.project)};
}'''

try:
    user_pack=json.loads((ROOT/'tests/fixtures/victorian-user-layout.json').read_text())
    desired=user_pack['rooms']['showroom-victorian-parlor']
    assert len(desired['placements'])==34 and len(desired['removed'])==4 and not desired['added']
    before=json.loads(args.baseline.read_text()) if args.baseline else None
    if before:
        saved_records=before['records']
    else:
        frozen=json.loads((ROOT/'tests/fixtures/room-layout-e6a709a.json').read_text())
        saved_records={c['themeId']:c['record'] for c in frozen['cases']}
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1000})
        context.add_init_script('''if(!localStorage.getItem('__defaultSeed')){localStorage.setItem('__defaultSeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:500000,owned:['furniture-geranium'],rewards:[],earned:500020,spent:20}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Default QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}''')
        page=boot(context)
        world=page.evaluate('JSON.stringify(townBuilder.project)')
        protected=page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
        page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
        page.locator('#roomEditorTheme').select_option('showroom-victorian-parlor');page.wait_for_function("townBuilder.roomEditor.model.themeId==='showroom-victorian-parlor'")
        page.evaluate(INSTALL);page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
        fresh=page.evaluate('__snap()');assert_record(fresh['record'],desired)
        assert fresh['raw'] is None
        note('Fresh editor uses exactly the uploaded 34-piece default, with its four removals and no autosave')

        def check_room(proof):
            items={i['id']:i for i in proof['items']};expected={i['id']:i for i in desired['placements']}
            assert set(items)==set(expected)
            for item_id,pose in expected.items():
                item=items[item_id]
                for key in ['x','y','rotation','support']:assert item[key]==pose[key],(item_id,key,item[key],pose[key])
            assert proof['world']==world
            assert proof['width']==1184 and proof['height']==448

        page.locator('.room-editor-exit').click();page.locator('#walk').click()
        page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));townBuilder.urban.openShowroom('victorian-parlor')")
        walk=page.evaluate(CAPTURE,False);check_room(walk)
        (OUT/'victorian-default-room.png').write_bytes(base64.b64decode(walk.pop('image').split(',')[1]));walk.pop('world')
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY)) is None
        page.locator('#walk').click();page.locator('#play').click();page.wait_for_function('!!window.townGame');page.evaluate(INSTALL)
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='coda-furnishings'));townGame.urban.openShowroom('victorian-parlor')")
        play=page.evaluate(CAPTURE,True);check_room(play)
        (OUT/'victorian-default-play.png').write_bytes(base64.b64decode(play.pop('image').split(',')[1]));play.pop('world')
        assert (OUT/'victorian-default-room.png').read_bytes()==(OUT/'victorian-default-play.png').read_bytes()
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY)) is None
        note('Fresh Walk and Play use the uploaded poses and render identical room pixels without a saved override')

        page.get_by_role('button',name='Town Builder',exact=True).click();page.wait_for_function('!!window.townBuilder?.roomEditor')
        page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');page.locator('#roomEditorTheme').select_option('showroom-victorian-parlor');page.wait_for_function("townBuilder.roomEditor.model?.themeId==='showroom-victorian-parlor'")
        page.evaluate(INSTALL);page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
        rug=page.evaluate("__snap().items.find(i=>i.roomRugId==='victorian-bath-rug')")
        b=rug['bounds'];start={'x':b['x']+b['w']/2,'y':b['y']+b['h']/2}
        at=page.evaluate('__point',start);page.mouse.move(at['x'],at['y']);page.mouse.down();at=page.evaluate('__point',{'x':start['x']+8,'y':start['y']+12});page.mouse.move(at['x'],at['y'],steps=5);page.mouse.up()
        assert page.evaluate('!!townBuilder.roomEditor.model.record().rugs')
        page.locator('.room-editor-panel').get_by_role('button',name='Reset theme',exact=True).click()
        assert_record(page.evaluate('townBuilder.roomEditor.model.record()'),desired)
        saved=page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY));assert saved
        page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor');page.locator('#roomEditor').click();page.wait_for_function("townBuilder.roomEditor.model?.themeId==='showroom-victorian-parlor'")
        assert_record(page.evaluate('townBuilder.roomEditor.model.record()'),desired)
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY))==saved
        assert page.evaluate('JSON.stringify(townBuilder.project)')==world
        assert page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        note('Reset restores the uploaded default and original rug, persists across reload, and preserves map/progress')
        context.close()

        old=browser.new_context(viewport={'width':1600,'height':1000})
        pack={'format':'coda-room-layouts','version':1,'owner':'builder','rooms':saved_records};raw=json.dumps(pack)
        old.add_init_script('localStorage.setItem(%s,%s)'%(json.dumps(KEY),json.dumps(raw)))
        page=boot(old);page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');page.evaluate(INSTALL)
        for theme,record in saved_records.items():
            page.locator('#roomEditorTheme').select_option(theme);page.wait_for_function('id=>townBuilder.roomEditor.model.themeId===id',arg=theme)
            assert page.evaluate('townBuilder.roomEditor.status.kind')!='error',(theme,page.evaluate('townBuilder.roomEditor.status'))
            actual=page.evaluate('townBuilder.roomEditor.model.record()')
            if before:assert_record(actual,record)
            else:
                poses={p['id']:p for p in actual['placements']}
                for pose in record['placements']:assert poses[pose['id']]==pose
            if before:
                frozen_scene=before['scenes'][theme]
                resolved=page.evaluate('request=>{const m=__interiors.getInterior(request);return{items:m.items.map(i=>({...i,collisionBoxes:i.collisionBoxes||[]})),walls:m.walls,solids:m.solids,privacyDoors:m.privacyDoors,spawn:m.spawn,portalExit:m.portalExit}}',frozen_scene['request'])
                close_values(physical_items(frozen_scene['items']),physical_items(resolved['items']),theme+'.items')
                for key in ['walls','solids','privacyDoors','spawn','portalExit']:close_values(frozen_scene[key],resolved[key],theme+'.'+key)
                if theme!='showroom-victorian-parlor':
                    authored=page.evaluate('request=>{const m=__interiors.getInteriorBase(request);return{items:m.items.map(i=>({...i,collisionBoxes:i.collisionBoxes||[]})),walls:m.walls,solids:m.solids,privacyDoors:m.privacyDoors,spawn:m.spawn,portalExit:m.portalExit}}',frozen_scene['request'])
                    close_values(physical_items(frozen_scene['items']),physical_items(authored['items']),theme+'.defaultItems')
                    for key in ['walls','solids','privacyDoors','spawn','portalExit']:close_values(frozen_scene[key],authored[key],theme+'.default.'+key)
            assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY))==raw
        note('All 31 previous saved designs override the new default without moving furniture or rewriting stored bytes')
        assert not errors and not failed,(errors,failed)
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        (OUT/'results.json').write_text(json.dumps({'passed':True,'defaultPlacements':34,'defaultRemoved':4,'oldSavedRooms':len(saved_records),'walk':walk,'play':play,'mapAndProgressUnchanged':True,'errors':errors,'failedResponses':failed,'steps':steps},indent=2))
        browser.close()
finally:
    server.shutdown()
