"""Real editor table placement and native rug drag/save shared with Walk and Play."""
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
parser.add_argument('--screenshots', type=Path, default=ROOT/'work/room-placement')
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
 window.__warm=async m=>{const{preparePlacedFacingArt}=await import(dep('furniture-art-access')),{warmHomeMaterials}=await import(dep('home-materials')),catalog=window.townBuilder?.catalog||townGame.catalog;await Promise.all([preparePlacedFacingArt({objects:m.items},catalog),warmHomeMaterials(m.homeMaterialSuite)]);for(const i of m.items)if(i.roomRugId)await catalog.get(i.asset).ensureFull();};
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

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        # Reading all genuinely old saves may not rewrite or upgrade their raw bytes.
        frozen = json.loads((ROOT/'tests/fixtures/room-layout-e6a709a.json').read_text())
        pack = {'format':'coda-room-layouts','version':1,'owner':'builder','rooms':{c['themeId']:c['record'] for c in frozen['cases']}}
        old_raw = json.dumps(pack)
        legacy = browser.new_context(viewport={'width':1600,'height':1000})
        legacy.add_init_script('localStorage.setItem(%s,%s)' % (json.dumps(KEY),json.dumps(old_raw)))
        page = boot(legacy)
        page.locator('#roomEditor').click()
        page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
        for case in frozen['cases']:
            theme = case['themeId']
            page.locator('#roomEditorTheme').select_option(theme)
            page.wait_for_function('id=>townBuilder.roomEditor.model.themeId===id', arg=theme)
            assert page.evaluate('townBuilder.roomEditor.status.kind') != 'error', (theme,page.evaluate('townBuilder.roomEditor.status'))
            assert page.evaluate('localStorage.getItem(%s)' % json.dumps(KEY)) == old_raw
        note('31 frozen room saves open without rewriting their bytes')
        legacy.close()

        context = browser.new_context(viewport={'width':1600,'height':1000})
        context.add_init_script('''(()=>{if(!localStorage.getItem('__placementSeed')){localStorage.setItem('__placementSeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:500000,owned:['furniture-geranium'],rewards:[],earned:500020,spent:20}));localStorage.setItem('codaUrbanRoomV1',JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Placement QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}window.__layoutWrites=0;const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='codaRoomLayoutsV1:builder')window.__layoutWrites++;return set.call(this,key,value);};})()''')
        page = boot(context)
        world = page.evaluate('JSON.stringify(townBuilder.project)')
        protected = page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","codaUrbanRoomV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
        page.locator('#roomEditor').click()
        page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
        page.locator('#roomEditorTheme').select_option('showroom-victorian-parlor')
        page.wait_for_function("townBuilder.roomEditor.model.themeId==='showroom-victorian-parlor'")
        page.evaluate(INSTALL)
        page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
        sofa = page.evaluate(r'''async()=>{
         const a=townBuilder.catalog.get('collection-showroom-victorian-parlor-sofa');await a.ensureFull('west');await a.ensureFull('east');
         const west=a.getFacingDrawSource('west',{native:true}),east=a.getFacingDrawSource('east',{native:true}),crop=s=>{const c=document.createElement('canvas');c.width=s.sw;c.height=s.sh;c.getContext('2d').drawImage(s.image,s.sx,s.sy,s.sw,s.sh,0,0,s.sw,s.sh);return c},w=crop(west),e=crop(east),wp=w.getContext('2d').getImageData(0,0,w.width,w.height).data,ep=e.getContext('2d').getImageData(0,0,e.width,e.height).data;
         let mismatch=0;for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++)for(let k=0;k<4;k++)if(wp[(y*w.width+x)*4+k]!==ep[(y*e.width+e.width-1-x)*4+k])mismatch++;
         const sheet=document.createElement('canvas');sheet.width=w.width+e.width+48;sheet.height=Math.max(w.height,e.height)+60;const c=sheet.getContext('2d');c.fillStyle='#e6dfd3';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#493b36';c.font='18px sans-serif';c.fillText('Left',12,27);c.fillText('Right',w.width+36,27);c.drawImage(w,12,42);c.drawImage(e,w.width+36,42);
         return{mismatch,width:w.width,height:w.height,eastWidth:e.width,eastHeight:e.height,quality:west.quality,image:sheet.toDataURL('image/png')};
        }''')
        (OUT/'sofa-facing-placement2.png').write_bytes(base64.b64decode(sofa.pop('image').split(',')[1]))
        assert sofa['mismatch']==0 and sofa['width']==sofa['eastWidth'] and sofa['height']==sofa['eastHeight'] and sofa['quality']=='native',sofa
        note('Actual native left sofa is an exact reflection of the right sofa',sofa)

        def snap(): return page.evaluate('__snap()')
        def item(item_id): return next(i for i in snap()['items'] if i['id']==item_id)
        def screen(point): return page.evaluate('__point', point)
        def move(point):
            at = screen(point)
            page.mouse.move(at['x'],at['y'])
        def click(point):
            at = screen(point)
            page.mouse.click(at['x'],at['y'])
        def pick(item_id):
            b = item(item_id)['bounds']
            click({'x':b['x']+b['w']/2,'y':b['y']+b['h']*.6})
            assert snap()['held']['originalId']==item_id
        def cursor_for(anchor):
            h = snap()['held']
            return {'x':anchor['x']+h['offset']['x'],'y':anchor['y']+h['offset']['y']}

        original = snap()
        pick(TABLE)
        page.keyboard.press('ArrowLeft')
        legal = cursor_for({'x':912,'y':348})
        move(legal)
        assert snap()['held']['valid'], snap()['held']
        click(legal)
        placed = snap()
        assert placed['held'] is None and same_pose(item(TABLE),{'x':912,'y':348,'rotation':90})
        assert placed['writes']==original['writes']+1
        page.screenshot(path=str(OUT/'table-clear-floor-placed.png'))
        note('Large rotated table places on clear floor across the old fixed tour strip',item(TABLE))

        pick(TABLE)
        for anchor, reason in [({'x':355,'y':220},'wall'),({'x':1060,'y':340},'clear')]:
            before = snap()
            point = cursor_for(anchor)
            move(point)
            assert not snap()['held']['valid'] and reason in snap()['held']['reason'].lower(), snap()['held']
            click(point)
            assert snap()['held'] and snap()['raw']==before['raw'] and snap()['writes']==before['writes']
        page.keyboard.press('Escape')
        note('Real walls and arrival space still reject placement without saving')

        rug_original = item(RUG)
        assert same_pose(rug_original,{'x':484,'y':250,'rotation':0}) and rug_original['layer']=='ground' and not rug_original['solid']
        b = rug_original['bounds']
        start = {'x':b['x']+b['w']/2,'y':b['y']+b['h']/2}
        end = {'x':start['x']-14,'y':start['y']+20}
        before = snap()
        at = screen(start)
        page.mouse.move(at['x'],at['y'])
        page.mouse.down()
        at = screen(end)
        page.mouse.move(at['x'],at['y'],steps=8)
        assert snap()['held']['originalId']==RUG and snap()['held']['valid']
        assert snap()['raw']==before['raw'] and snap()['revision']==before['revision']
        page.mouse.up()
        moved = snap()
        assert moved['held'] is None and same_pose(item(RUG),{'x':470,'y':270,'rotation':0})
        assert moved['writes']==before['writes']+1 and moved['revision']==before['revision']+1
        assert moved['record']['rugs']==[{'id':'victorian-bath-rug','x':item(RUG)['x'],'y':item(RUG)['y'],'rotation':0}]
        note('Real left-button rug drag commits and saves exactly once on release',item(RUG))

        pick(RUG)
        page.keyboard.press('ArrowLeft')
        click(cursor_for({'x':470,'y':270}))
        assert snap()['held'] is None and same_pose(item(RUG),{'x':470,'y':270,'rotation':90})
        rotated = snap()
        panel = page.locator('.room-editor-panel')
        panel.get_by_role('button',name='Undo',exact=True).click()
        assert same_pose(item(RUG),{'x':470,'y':270,'rotation':0})
        panel.get_by_role('button',name='Undo',exact=True).click()
        assert same_pose(item(RUG),rug_original) and 'rugs' not in snap()['record']
        panel.get_by_role('button',name='Redo',exact=True).click()
        panel.get_by_role('button',name='Redo',exact=True).click()
        assert snap()['record']==rotated['record']
        pick(RUG)
        page.keyboard.press('Delete')
        assert not any(i['id']==RUG for i in snap()['items']) and snap()['record']['rugs']==[{'id':'victorian-bath-rug','removed':True}]
        panel.get_by_role('button',name='Undo',exact=True).click()
        assert snap()['record']==rotated['record']
        note('Rug rotation, undo, redo, deletion, and restore retain exact records')

        # Escape during a genuine drag must never save its interrupted preview.
        b=item(RUG)['bounds'];start={'x':b['x']+b['w']/2,'y':b['y']+b['h']/2}
        before=snap();at=screen(start);page.mouse.move(at['x'],at['y']);page.mouse.down();at=screen({'x':start['x']-10,'y':start['y']-10});page.mouse.move(at['x'],at['y'],steps=3);page.keyboard.press('Escape');page.mouse.up()
        assert snap()['held'] is None and snap()['raw']==before['raw'] and snap()['writes']==before['writes']
        saved=snap();page.screenshot(path=str(OUT/'rug-moved-and-rotated.png'))
        page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor');page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model');page.evaluate(INSTALL);page.evaluate('__warm(townBuilder.roomEditor.model.scene)')
        assert snap()['record']==saved['record'] and snap()['raw']==saved['raw'] and snap()['writes']==0
        note('Interrupted drag does not save; a fresh reload restores the exact rug pose')

        page.locator('.room-editor-exit').click()
        page.locator('#walk').click()
        page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));townBuilder.urban.openShowroom('victorian-parlor')")
        def render_proof(game):
            proof=page.evaluate(r'''async game=>{
             const q=game?townGame:townBuilder,m=__interiors.getInterior(q.urban.scene);await __warm(m);__interiors.clearInteriorRenderCache();
             const i=m.items.find(i=>i.roomRugId==='victorian-bath-rug'),a=q.catalog.get(i.asset),cv=document.createElement('canvas');cv.width=m.width;cv.height=m.height;
             __interiors.renderInterior(cv.getContext('2d'),q.urban.scene,{model:m,catalog:q.catalog,actors:[],time:0});
             const plain=document.createElement('canvas');plain.width=m.width;plain.height=m.height;
             __interiors.renderInterior(plain.getContext('2d'),q.urban.scene,{model:{...m,items:m.items.filter(v=>!v.roomRugId)},catalog:q.catalog,actors:[],time:0});
             const actual=cv.getContext('2d').getImageData(0,0,m.width,m.height).data,before=plain.getContext('2d').getImageData(0,0,m.width,m.height).data;
             let changed=0,x0=m.width,y0=m.height,x1=-1,y1=-1;
             for(let k=0;k<actual.length;k+=4)if(Math.max(Math.abs(actual[k]-before[k]),Math.abs(actual[k+1]-before[k+1]),Math.abs(actual[k+2]-before[k+2]))>3){const x=(k/4)%m.width,y=Math.floor(k/4/m.width);changed++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
             const native=a.canvas.getContext('2d').getImageData(0,0,a.canvas.width,a.canvas.height).data,colors=new Set();
             for(let k=0;k<native.length;k+=4)if(native[k+3]>15)colors.add((native[k]<<16)|(native[k+1]<<8)|native[k+2]);
             return{rugItems:m.items.filter(v=>v.roomRugId).length,primitiveRugs:m.rugs.filter(v=>v.texture).length,item:{x:i.x,y:i.y,rotation:i.rotation},changed,changedBounds:{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1},bounds:__bounds(a,i),nativeColors:colors.size,image:cv.toDataURL('image/png'),world:JSON.stringify(q.project)};
            }''',game)
            (OUT/('room-play-placements2.png' if game else 'room-placements2.png')).write_bytes(base64.b64decode(proof.pop('image').split(',')[1]))
            unchanged = proof.pop('world') == world
            assert same_pose(proof['item'],{'x':470,'y':270,'rotation':90}) and proof['changed']>2000 and proof['nativeColors']>150,proof
            b,c=proof['bounds'],proof['changedBounds']
            assert c['x']>=math.floor(b['x']) and c['y']>=math.floor(b['y']) and c['x']+c['w']<=math.ceil(b['x']+b['w']) and c['y']+c['h']<=math.ceil(b['y']+b['h']),proof
            assert unchanged and proof['rugItems']==1 and proof['primitiveRugs']==0
            return proof
        walk=render_proof(False)
        npc=page.evaluate(r'''async()=>{const u=new URL(__worldModuleURL),{venueVisitDuration,venueVisitPose}=await import(new URL('./resident-venue.mjs'+u.search,u)),m=__interiors.getInterior(townBuilder.urban.scene),duration=venueVisitDuration('bach','shop',{slot:0,stay:1});let inside=0;for(let t=0;t<duration;t+=.2){const p=venueVisitPose('bach','shop',t,{slot:0,stay:1});if(p.scene.kind!=='showroom'||p.scene.showroomId!=='victorian-parlor')continue;inside++;if(m.solids.some(b=>p.x+6>b.x&&p.x-6<b.x+b.w&&p.y+6>b.y&&p.y-6<b.y+b.h))throw Error('Visitor clips edited furniture at '+p.x+','+p.y);}const end=venueVisitPose('bach','shop',duration,{slot:0,stay:1});return{inside,duration,returned:end.done&&end.scene.kind==='shop'}}''')
        assert npc['inside']>0 and npc['returned'],npc
        note('A real venue visit detours around the saved table and returns to the store',npc)
        page.locator('#walk').click()
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame')
        page.evaluate(INSTALL)
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='coda-furnishings'));townGame.urban.openShowroom('victorian-parlor')")
        play=render_proof(True)
        assert (OUT/'room-placements2.png').read_bytes()==(OUT/'room-play-placements2.png').read_bytes(),'Walk and Play must paint identical saved room pixels'
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY))==saved['raw']
        assert page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","codaUrbanRoomV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        assert not errors and not failed,(errors,failed)
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        note('Walk and Play render the same saved native rug pixels, with map and progress preserved',{'walk':walk,'play':play})
        (OUT/'results.json').write_text(json.dumps({'passed':True,'oldRawSaves':31,'tableClearFloor':True,'nativeRugTrueDrag':True,'sofa':sofa,'walk':walk,'play':play,'npc':npc,'mapWalletProfileDecorUnchanged':True,'errors':errors,'failedResponses':failed,'steps':steps},indent=2))
        browser.close()
finally:
    server.shutdown()
