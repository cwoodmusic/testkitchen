"""Wide room south floor, exterior faces, camera fit, entrances, and legacy saves."""
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
parser.add_argument('--screenshots', type=Path, default=ROOT/'work/room-south/final')
parser.add_argument('--skip-legacy',action='store_true',help='Skip the separately verified historical-save contexts for a compact live smoke')
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
 window.__worldModuleURL=iURL.href;const shell=await import(dep('wide-room-shell')),front=await import(dep('wide-room-frontage')),portal=await import(dep('interior-portal-art'));window.__visualBounds=shell.getInteriorVisualBounds;window.__frontage=front;window.__partitions=await import(dep('wide-room-partitions'));window.__doorGeometry=portal.getDoorVisualGeometry;const editorURL=new URL(a.match(/from\s+['"]([^'"]*room-editor\.mjs[^'"]*)['"]/)[1],app),editorText=await(await fetch(editorURL)).text(),modelURL=new URL(editorText.match(/from\s+['"]([^'"]*room-layout-model\.mjs[^'"]*)['"]/)[1],editorURL);window.__roomThemes=(await import(editorURL)).roomEditorThemes();window.__createRoomModel=(await import(modelURL)).createRoomLayoutModel;
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

def close_values(a,b,path='geometry'):
    if isinstance(a,(float,int)) and not isinstance(a,bool) and isinstance(b,(float,int)):
        assert math.isclose(a,b,abs_tol=1e-7),(path,a,b)
    elif isinstance(a,dict):
        assert isinstance(b,dict)and set(a)==set(b),(path,'keys')
        for key in a:close_values(a[key],b[key],path+'.'+key)
    elif isinstance(a,list):
        assert isinstance(b,list)and len(a)==len(b),(path,'length')
        for index,(x,y)in enumerate(zip(a,b)):close_values(x,y,path+'.'+str(index))
    else:assert a==b,(path,a,b)

def furniture(items):
    return sorted([{k:i.get(k,0 if k=='rotation'else []) if k in ['rotation','collisionBoxes']else i.get(k) for k in ['id','asset','x','y','w','h','rotation','solid','wallMounted','layer','collisionBoxes']} for i in items if not i.get('roomRugId')],key=lambda i:i['id'])

SURVEY=r'''async()=>{
 const rows=[];for(const t of __roomThemes){const b=__interiors.getInteriorBase(t.scene),groups=__partitions.wideRoomSouthPartitionGeometry(b).groups,m=__createRoomModel({themeId:t.id,scene:b,catalog:townBuilder.catalog}),g=__frontage.wideRoomSouthExteriorGeometry(b),v=__visualBounds(b);let exteriorPixels=0;
 if(g){const probe=document.createElement('canvas');probe.width=b.width;probe.height=136;const c=probe.getContext('2d');c.translate(0,-g.seam);__frontage.drawWideRoomSouthExterior(c,b);__frontage.drawWideRoomEntrance(c,b,0);const data=c.getImageData(0,28,b.width,108).data;for(let k=3;k<data.length;k+=4)if(data[k]>100)exteriorPixels++;}
 rows.push({partitionGroups:groups.map(g=>({id:g.id,room:g.room,bounds:g.bounds,floorY:g.floorY,doors:g.doors.map(d=>d.id)})),partitionDoorCount:groups.reduce((n,g)=>n+g.doors.length,0),uniquePartitionDoorCount:new Set(groups.flatMap(g=>g.doors)).size,partitionDoorsAreOriginal:groups.flatMap(g=>g.doors).every(d=>b.privacyDoors.includes(d)),id:t.id,request:t.scene,width:b.width,height:b.height,visual:v,expansion:b.wideRoomExpansion||null,frontage:g?{door:g.door,kind:__doorGeometry(g.door).kind,style:g.style,opening:g.opening}:null,exteriorPixels,record:m.record(),items:b.items.map(i=>({...i,collisionBoxes:i.collisionBoxes||[]})),walls:b.walls,solids:b.solids,privacyDoors:b.privacyDoors,zones:b.zones,spawn:b.spawn,portalExit:b.portalExit});}
 return rows;
}'''

PHOTO=r'''async input=>{
 const request=input.request||input,focus=input.focus;const m=__interiors.getInterior(request);await __warm(m);__interiors.clearInteriorRenderCache();const b=__visualBounds(m),cv=document.createElement('canvas');cv.width=b.w;cv.height=b.h;const c=cv.getContext('2d');c.fillStyle='#131b21';c.fillRect(0,0,cv.width,cv.height);c.translate(-b.x,-b.y);__interiors.renderInterior(c,request,{model:m,catalog:townBuilder.catalog,actors:[],player:focus,time:0});
 const out=document.createElement('canvas');out.width=b.w*2;out.height=b.h*2;out.getContext('2d').imageSmoothingEnabled=false;out.getContext('2d').drawImage(cv,0,0,out.width,out.height);return out.toDataURL('image/png');
}'''

"""Reusable synchronous-Playwright save proof; no repository/work-file dependencies.

Call verify_legacy_room_saves(browser, boot=boot, fixtures={
    'approved': approved_user_pack_or_record,
    'previous': previous_38_piece_record,
    'frozen': frozen_e6a709a_fixture,
}, baseline=optional_pre_expansion_capture).

boot(context) must return a loaded Builder page with its actual catalog and map.
This helper creates/closes disposable contexts and never edits production files.
"""
import copy
import json
import math
from pathlib import Path

KEY = 'codaRoomLayoutsV1:builder'
VICTORIAN = 'showroom-victorian-parlor'

INSTALL_CANONICAL = r'''async()=>{
 let app=new URL(document.querySelector('script[type=module]').src),text=await(await fetch(app)).text();
 if(!/from\s+['"][^'"]*urban\.mjs/.test(text)){app=new URL(text.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],app);text=await(await fetch(app)).text();}
 const urbanURL=new URL(text.match(/from\s+['"]([^'"]*urban\.mjs[^'"]*)['"]/)[1],app),urbanText=await(await fetch(urbanURL)).text(),interiorsURL=new URL(urbanText.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],urbanURL),interiorsText=await(await fetch(interiorsURL)).text(),runtimeURL=new URL(interiorsText.match(/from\s+['"]([^'"]*room-layout-runtime\.mjs[^'"]*)['"]/)[1],interiorsURL),runtimeText=await(await fetch(runtimeURL)).text(),modelURL=new URL(runtimeText.match(/from\s+['"]([^'"]*room-layout-model\.mjs[^'"]*)['"]/)[1],runtimeURL);
 const interiors=await import(interiorsURL),{createRoomLayoutModel}=await import(modelURL),facingURL=new URL(interiorsText.match(/from\s+['"]([^'"]*furniture-facing\.mjs[^'"]*)['"]/)[1],interiorsURL),{furnitureFacingBoxes}=await import(facingURL);
 window.__legacyRoomAudit={interiors,createRoomLayoutModel,furnitureFacingBoxes,catalog:townBuilder.catalog,moduleURL:interiorsURL.href};
}'''

COLLECT = r'''entries=>{
 const {interiors,createRoomLayoutModel,furnitureFacingBoxes,catalog}=__legacyRoomAudit;
 const items=list=>list.filter(i=>!i.roomRugId&&!i.id.startsWith('room-rug-')).map(i=>({
  id:i.id,asset:i.asset,x:i.x,y:i.y,w:i.w,h:i.h,rotation:i.rotation||0,solid:!!i.solid,wallMounted:!!i.wallMounted,layer:i.layer||'objects',support:i.supportedBy&&i.supportedBy!=='north-wall'?i.supportedBy:null,collisionBoxes:(i.collisionBoxes||[]).map(b=>({...b}))
 }));
 return entries.map(entry=>{
  const base=interiors.getInteriorBase(entry.request),model=createRoomLayoutModel({themeId:entry.themeId,scene:base,catalog,...(entry.record?{record:entry.record}:{})}),resolved=interiors.getInterior(entry.request);
  return {themeId:entry.themeId,request:entry.request,record:model.record(),defaultSignature:createRoomLayoutModel({themeId:entry.themeId,scene:base,catalog}).record().baseSignature,
   directItems:items(model.scene.items),runtimeItems:items(resolved.items),stock:items((base.roomLayoutBaseItems||base.items).map(i=>({...i,collisionBoxes:i.solid?furnitureFacingBoxes(catalog.get(i.asset),i):[]}))),
   width:resolved.width,height:resolved.height,spawn:resolved.spawn,portalExit:resolved.portalExit,privacyDoors:resolved.privacyDoors,expansion:resolved.wideRoomExpansion||null,
   raw:localStorage.getItem('codaRoomLayoutsV1:builder'),writes:__legacyLayoutWrites,moduleURL:__legacyRoomAudit.moduleURL};
 });
}'''


def _close(expected, actual, label):
    if isinstance(expected, (int, float)) and not isinstance(expected, bool):
        assert isinstance(actual, (int, float)) and math.isclose(expected, actual, abs_tol=1e-7), (label, expected, actual)
    elif isinstance(expected, dict):
        assert isinstance(actual, dict) and set(expected)==set(actual), (label, 'keys', set(expected), set(actual))
        for key in expected:_close(expected[key],actual[key],label+'.'+key)
    elif isinstance(expected, list):
        assert isinstance(actual,list) and len(expected)==len(actual),(label,'length',len(expected),len(actual))
        for index,(a,b) in enumerate(zip(expected,actual)):_close(a,b,label+'.'+str(index))
    else:assert expected==actual,(label,expected,actual)


def _physical(items):
    fields=('id','asset','x','y','w','h','rotation','solid','wallMounted','layer','support','collisionBoxes')
    result={}
    for item in items:
        if item.get('roomRugId') or item['id'].startswith('room-rug-'):continue
        row={key:item.get(key) for key in fields}
        row.update(rotation=item.get('rotation') or 0,solid=bool(item.get('solid')),wallMounted=bool(item.get('wallMounted')),layer=item.get('layer') or 'objects',collisionBoxes=item.get('collisionBoxes') or [])
        source=item.get('support',item.get('supportedBy'))
        row['support']=source if source and source!='north-wall' else None
        result[item['id']]=row
    assert len(result)==len([i for i in items if not i.get('roomRugId') and not i['id'].startswith('room-rug-')]),'Repeated furniture IDs'
    return result


def _record(actual,expected,label):
    for key in ('format','version','themeId','baseSignature'):_close(expected[key],actual[key],label+'.'+key)
    assert len(expected['placements'])==len(actual['placements']),(label,'placement count')
    _close({p['id']:p for p in expected['placements']},{p['id']:p for p in actual['placements']},label+'.placements')
    assert set(expected['removed'])==set(actual['removed']),(label,'removed')
    _close(expected['added'],actual['added'],label+'.added')
    _close(expected.get('rugs'),actual.get('rugs'),label+'.rugs')


def _turn(x,y,turn):
    return ((x,y),(-y,x),(-x,-y),(y,-x))[turn%4]


def _at_pose(source,pose):
    """Rigidly move frozen collider rectangles; independent of current collider code."""
    result=copy.deepcopy(source)
    rotation=pose.get('rotation') or 0
    turn=int((rotation-(source.get('rotation') or 0))/90)%4
    boxes=[]
    for box in source['collisionBoxes']:
        points=[]
        for x,y in [(box['x'],box['y']),(box['x']+box['w'],box['y']),(box['x']+box['w'],box['y']+box['h']),(box['x'],box['y']+box['h'])]:
            dx,dy=_turn(x-source['x'],y-source['y'],turn);points.append((pose['x']+dx,pose['y']+dy))
        xs,ys=zip(*points);boxes.append({'x':min(xs),'y':min(ys),'w':max(xs)-min(xs),'h':max(ys)-min(ys)})
    result.update(x=pose['x'],y=pose['y'],rotation=rotation,collisionBoxes=boxes)
    if 'support' in pose:result['support']=pose['support']
    if result.get('support'):
        result['solid']=False
        result['collisionBoxes']=[]
    return result


def _fixture_items(row,record,stock,label,exact=False):
    actual=_physical(row['runtimeItems'])
    for pose in record['placements']:
        assert pose['id'] in actual,(label,'missing saved piece',pose['id'])
        assert pose['id'] in stock,(label,'missing frozen stock geometry',pose['id'])
        _close(_at_pose(stock[pose['id']],pose),actual[pose['id']],label+'.'+pose['id'])
    for item_id in record['removed']:assert item_id not in actual,(label,'removed piece returned',item_id)
    for pose in record['added']:
        assert pose['id'] in actual,(label,'missing user addition',pose['id'])
        exemplars=[i for i in stock.values() if i['asset']==pose['asset']]
        assert exemplars,(label,'missing stock exemplar for user addition',pose['asset'])
        assert pose.get('scale',1)==1,'This frozen proof expects its original unit-scale user chair'
        expected=_at_pose(exemplars[0],pose);expected['id']=pose['id'];expected['asset']=pose['asset']
        _close(expected,actual[pose['id']],label+'.added.'+pose['id'])
    if exact:
        assert set(actual)=={p['id'] for p in record['placements']}|{p['id'] for p in record['added']},(label,'unexpected furniture')


def _structure(row,baseline_scene,label):
    expanded=row['request']['kind']=='showroom' or baseline_scene['width']==2304
    depth=64 if expanded else 0
    _close(baseline_scene['width'],row['width'],label+'.width')
    _close(baseline_scene['height']+depth,row['height'],label+'.height')
    _close({'x':baseline_scene['spawn']['x'],'y':baseline_scene['spawn']['y']+depth},row['spawn'],label+'.spawn')
    old=baseline_scene['portalExit'];new=row['portalExit']
    if old is None:
        if expanded:
            exit_zone=next(z for z in baseline_scene['zones'] if z.get('action') in ('showroom-lobby','exit'))
            _close({'x':exit_zone['x']+exit_zone['w']/2,'y':baseline_scene['height']-28+depth},new['threshold'],label+'.new south exit threshold')
            _close({'x':0,'y':-1},new['enterNormal'],label+'.new south exit normal')
        else:
            assert new is None,(label,'compact room exit changed')
    else:
        _close({'x':old['threshold']['x'],'y':old['threshold']['y']+depth},new['threshold'],label+'.exit.threshold')
        _close(old['enterNormal'],new['enterNormal'],label+'.exit.normal')
    _close(baseline_scene['privacyDoors'],row['privacyDoors'],label+'.privacyDoors')
    if expanded:
        assert row['expansion'] and row['expansion']['depth']==64,(label,'missing expansion metadata')
        _close(baseline_scene['height'],row['expansion']['previousHeight'],label+'.previousHeight')
    else:assert row['expansion'] is None,(label,'compact room expanded')


def verify_legacy_room_saves(browser, *, boot, fixtures, baseline=None, context_options=None, output=None):
    approved=fixtures['approved']
    if 'rooms' in approved:approved=approved['rooms'][VICTORIAN]
    previous=fixtures['previous'];frozen=fixtures['frozen']
    assert len(approved['placements'])==34 and len(approved['removed'])==4 and not approved['added']
    assert len(previous['placements'])==38 and not previous['removed'] and not previous['added']
    assert len(frozen['cases'])==31
    requests={case['themeId']:case['request'] for case in frozen['cases']}
    if baseline:requests.update({theme:s['request'] for theme,s in baseline['scenes'].items()})
    requests.setdefault(VICTORIAN,{'kind':'showroom','showroomId':'victorian-parlor','floor':1})
    current=(baseline or {}).get('records',{})
    cases=[('fresh-approved',None,{VICTORIAN:approved},True),('approved-override',{VICTORIAN:approved},{VICTORIAN:approved},True),('previous-38',{VICTORIAN:previous},{VICTORIAN:previous},True)]
    if current:cases.append(('current-31',current,current,True))
    legacy={case['themeId']:case['record'] for case in frozen['cases']}
    cases.append(('frozen-31',legacy,legacy,False))
    modified=frozen['modified'];cases.append(('modified-botanical',{modified['themeId']:modified['record']},{modified['themeId']:modified['record']},False))
    reports=[]
    for name,saved_records,expected_records,exact in cases:
        context=browser.new_context(**{'viewport':{'width':1600,'height':1000},**(context_options or {})})
        errors=[]
        context.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
        pack={'format':'coda-room-layouts','version':1,'owner':'builder','rooms':saved_records} if saved_records is not None else None
        raw=json.dumps(pack,separators=(',',':')) if pack is not None else None
        context.add_init_script('''({key,raw})=>{if(!/^https?:$/.test(location.protocol))return;if(raw===null)localStorage.removeItem(key);else localStorage.setItem(key,raw);window.__legacyLayoutWrites=0;for(const name of ['setItem','removeItem']){const original=Storage.prototype[name];Storage.prototype[name]=function(k,...args){if(k===key)window.__legacyLayoutWrites++;return original.call(this,k,...args);};}}'''.join(['(',')('+json.dumps({'key':KEY,'raw':raw})+')']))
        try:
            page=boot(context);page.evaluate(INSTALL_CANONICAL)
            entries=[{'themeId':theme,'request':requests[theme],'record':saved_records[theme] if saved_records is not None else None} for theme in expected_records]
            rows=page.evaluate(COLLECT,entries)
            for row in rows:
                theme=row['themeId'];label=name+'.'+theme;expected=expected_records[theme]
                _close(_physical(row['directItems']),_physical(row['runtimeItems']),label+'.editor/gameplay')
                stock=_physical(row['stock'])
                if baseline:
                    frozen_scene=baseline['scenes'][theme]
                    # Authored canonicalItems carry local/native box coordinates;
                    # resolved baseline items carry actual world collision boxes.
                    # Freeze all old shape/pose fields, then prefer the old world
                    # boxes wherever that piece existed in the captured default.
                    for item_id,old in _physical(frozen_scene.get('canonicalItems',[])).items():
                        assert item_id in stock,(label,'missing original stock',item_id)
                        _close({k:v for k,v in old.items() if k!='collisionBoxes'},{k:v for k,v in stock[item_id].items() if k!='collisionBoxes'},label+'.stock.'+item_id)
                    for item_id,old in _physical(frozen_scene['items']).items():
                        if item_id in stock and old['solid'] and stock[item_id]['solid'] and (old['w'],old['h'])==(stock[item_id]['w'],stock[item_id]['h']):
                            stock[item_id]['collisionBoxes']=_at_pose(old,stock[item_id])['collisionBoxes']
                if exact:_record(row['record'],expected,label+'.record')
                else:
                    wanted_signature=current.get(theme,{}).get('baseSignature',row['defaultSignature'])
                    assert row['record']['baseSignature']==wanted_signature,(label,'canonical signature changed')
                    for item_id in expected['removed']:assert item_id in row['record']['removed'],(label,'saved removal lost')
                    _close(expected['added'],row['record']['added'],label+'.user additions')
                _fixture_items(row,expected,stock,label,exact)
                if baseline:
                    _structure(row,baseline['scenes'][theme],label)
                    if name=='current-31':
                        frozen_physical=_physical(baseline['scenes'][theme]['items'])
                        # Raw authored support strings may name the asset; the
                        # captured record freezes the resolved furniture ID.
                        for pose in expected['placements']:
                            if 'support' in pose:frozen_physical[pose['id']]['support']=pose['support']
                        _close(frozen_physical,_physical(row['runtimeItems']),label+'.strict frozen current furniture')
                assert row['raw']==raw and row['writes']==0,(label,'read rewrote storage')
            assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY))==raw,(name,'stored bytes changed')
            assert not errors,(name,errors)
            reports.append({'case':name,'rooms':len(rows),'rawBytesUnchanged':True,'readOnlyWrites':0,'editorAndGameplayMatch':True,'furniturePosesSizesCollidersPreserved':True,'signaturesPreserved':True,'moduleURL':rows[0]['moduleURL']})
            print('Legacy save proof PASS: '+name+' ('+str(len(rows))+' rooms)',flush=True)
        finally:context.close()
    result={'passed':True,'approvedPieces':34,'approvedRemoved':4,'previousPieces':38,'frozenRooms':31,'modifiedBotanicalPreserved':True,'strictBaseline':bool(baseline),'baselineCommit':(baseline or {}).get('commit'),'cases':reports}
    if output:Path(output).write_text(json.dumps(result,indent=2))
    return result


try:
    baseline=json.loads(args.baseline.read_text())if args.baseline else None
    fixture=json.loads((ROOT/'tests/fixtures/victorian-user-layout.json').read_text())
    previous=json.loads((ROOT/'tests/fixtures/victorian-previous-default.json').read_text())
    frozen=json.loads((ROOT/'tests/fixtures/room-layout-e6a709a.json').read_text())
    with sync_playwright()as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.add_init_script('''if(!localStorage.getItem('__wideSeed')){localStorage.setItem('__wideSeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:1400,owned:['furniture-geranium'],rewards:[],earned:1420,spent:20}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Wide Room QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}''')
        page=boot(context);page.evaluate(INSTALL)
        world=page.evaluate('JSON.stringify(townBuilder.project)')
        protected=page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
        page.evaluate(r'''async()=>{const app=new URL(document.querySelector('script[type=module]').src),s=await(await fetch(__worldModuleURL)).text(),url=new URL(s.match(/from\s+['"]([^'"]*interior-portal-art\.mjs[^'"]*)['"]/)[1],__worldModuleURL);await(await import(url)).warmInteriorPortalArt();}''')
        rows=page.evaluate(SURVEY);assert len(rows)==31
        affected=[]
        for row in rows:
            expected=row['request']['kind']=='showroom'or row['width']==2304
            assert bool(row['expansion'])==expected,row['id']
            if expected:
                affected.append(row);e=row['expansion'];assert e['depth']==64 and row['height']==e['previousHeight']+64
                assert row['visual']=={'x':0,'y':0,'w':row['width'],'h':row['height']+108}
                assert row['frontage']['kind']=='front'and row['frontage']['door']['facing']=='down'
                assert row['frontage']['door']['threshold']['x']==row['portalExit']['threshold']['x']
                assert row['exteriorPixels']>row['width']*60
                assert row['portalExit']['threshold']['y']==e['previousThreshold']['y']+64
                assert row['spawn']['y']==e['previousSpawn']['y']+64
            else:assert row['visual']=={'x':0,'y':0,'w':row['width'],'h':row['height']}
            if baseline:
                old=baseline['scenes'][row['id']];assert row['width']==old['width']and row['height']==old['height']+(64 if expected else 0)
                close_values(furniture(old['items']),furniture(row['items']),row['id']+'.furniture')
                assert row['record']==baseline['records'][row['id']],row['id']+' changed a default saved record'
                if not expected:
                    for key in ['walls','solids','privacyDoors','spawn','portalExit']:close_values(old[key],row[key],row['id']+'.'+key)
        assert len(affected)==21
        assert sum(r['partitionDoorCount']for r in rows if r['request']['kind']=='showroom')==20
        assert all(r['partitionDoorsAreOriginal']and r['partitionDoorCount']==r['uniquePartitionDoorCount']for r in rows)
        (OUT/'geometry.json').write_text(json.dumps(rows,indent=2));note('All 21 wide rooms gain exactly64 indoor pixels and a108-pixel exterior; ten compact homes and all furnishing/save records stay unchanged')
        request={'kind':'showroom','showroomId':'victorian-parlor','floor':1}
        (OUT/'victorian-wide-after.png').write_bytes(base64.b64decode(page.evaluate(PHOTO,request).split(',')[1]))
        victorian=next(r for r in rows if r['id']=='showroom-victorian-parlor')
        assert len(victorian['partitionGroups'])==2
        for index,group in enumerate(victorian['partitionGroups']):
            focus={'x':group['room']['x']+group['room']['w']/2,'y':group['room']['y']+group['room']['h']/2}
            (OUT/f'victorian-partition-{index}-faded.png').write_bytes(base64.b64decode(page.evaluate(PHOTO,{'request':request,'focus':focus}).split(',')[1]))
            proof=page.evaluate('''({request,focus})=>{const m=__interiors.getInterior(request),c=document.createElement('canvas').getContext('2d'),a=__partitions.wideRoomPartitionDrawables(c,m),b=__partitions.wideRoomPartitionDrawables(c,m,{player:focus});return{opaque:a.map(d=>d.opacity),focused:b.map(d=>d.opacity)}}''',{'request':request,'focus':focus})
            assert all(v==1 for v in proof['opaque'])and proof['focused'].count(.3)==1 and all(v in[.3,1]for v in proof['focused'])
        note('Warmed Victorian opaque and faded partition faces captured; all twelve styles use20 original upright door references without duplicates')
        page.locator('#roomEditor').click();page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
        for row in affected:
            page.locator('#roomEditorTheme').select_option(row['id']);page.wait_for_function('id=>townBuilder.roomEditor.model.themeId===id',arg=row['id']);page.get_by_role('button',name='Fit room',exact=True).click()
            fit=page.evaluate('''()=>{const e=townBuilder.roomEditor,r=document.getElementById('map').getBoundingClientRect(),b=__visualBounds(e.model.scene),v=e.view;return{left:r.width/2+(b.x-v.x)*v.zoom,right:r.width/2+(b.x+b.w-v.x)*v.zoom,top:r.height/2+(b.y-v.y)*v.zoom,bottom:r.height/2+(b.y+b.h-v.y)*v.zoom,width:r.width,height:r.height}}''')
            assert fit['left']>=20 and fit['top']>=20 and fit['right']<=fit['width']-20 and fit['bottom']<=fit['height']-20,(row['id'],fit)
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY))is None
        page.locator('#roomEditorTheme').select_option('showroom-victorian-parlor');page.wait_for_function("townBuilder.roomEditor.model.themeId==='showroom-victorian-parlor'")
        page.evaluate('__warm(townBuilder.roomEditor.model.scene)');page.locator('#map').screenshot(path=str(OUT/'wide-editor-fit.png'))
        rug=page.evaluate("__snap().items.find(i=>i.roomRugId==='victorian-bath-rug')");b=rug['bounds'];start={'x':b['x']+b['w']/2,'y':b['y']+b['h']/2};at=page.evaluate('__point',start);page.mouse.click(at['x'],at['y'])
        held=page.evaluate('townBuilder.roomEditor.held');end={'x':180+held['offset']['x'],'y':480+held['offset']['y']};at=page.evaluate('__point',end);page.mouse.move(at['x'],at['y']);assert page.evaluate('townBuilder.roomEditor.held.valid');page.mouse.click(at['x'],at['y'])
        assert page.evaluate("townBuilder.roomEditor.model.record().rugs[0].y")>448
        page.get_by_role('button',name='Undo',exact=True).click();assert page.evaluate('!townBuilder.roomEditor.model.record().rugs')
        note('Editor Fit contains every full visual envelope; furniture places in the new floor band and Undo restores the approved design')
        page.locator('.room-editor-exit').click();page.locator('#walk').click();page.clock.install();page.clock.pause_at(page.evaluate('Date.now()/1000')+1);page.locator('#map').focus()
        walked=0
        def scene():return page.evaluate('({scene:townBuilder.urban.scene,player:{...townBuilder.urban.player}})')
        def move_axis(target,axis):
            global walked
            for _ in range(300):
                before=scene();delta=target-before['player'][axis]
                if abs(delta)<5:return
                key=('d'if delta>0 else'a')if axis=='x'else('s'if delta>0 else'w');scale=.375 if before['scene']['kind']in('showroom','apartment')else 1;running=abs(delta)>120;speed=(780 if running else 450)*scale
                if running:page.keyboard.down('Shift')
                page.keyboard.down(key)
                try:page.clock.run_for(int(min(180,max(17,(abs(delta)-3)/speed*1000))))
                finally:page.keyboard.up(key);page.keyboard.up('Shift')
                after=scene();assert after['scene']==before['scene'];assert abs(after['player'][axis]-before['player'][axis])>.01,('Blocked real walker',target,axis,before);walked+=abs(after['player'][axis]-before['player'][axis])
            raise AssertionError(('Walker did not reach point',target,axis,scene()))
        def walk(goal):
            route=page.evaluate(r'''goal=>{const t=townBuilder,m=__interiors.getInterior(t.urban.scene),start={...t.urban.player},pad=(['showroom','apartment'].includes(t.urban.scene.kind)?6:16)+6,step=16,solid=p=>p.x<40||p.y<100||p.x>m.width-40||p.y>m.height-40||m.solids.some(r=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad),clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));return Array.from({length:count+1},(_,i)=>({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count})).every(p=>!solid(p));},key=p=>`${p.x},${p.y}`;let initial;for(let r=0;r<5&&!initial;r++)for(let yy=-r;yy<=r&&!initial;yy++)for(let xx=-r;xx<=r;xx++){const p={x:(Math.floor(start.x/step)+xx)*step+8,y:(Math.floor(start.y/step)+yy)*step+8};if(!solid(p)&&clear(start,{x:p.x,y:start.y})&&clear({x:p.x,y:start.y},p)){initial=p;break;}}if(!initial)throw Error('No clear start');const queue=[initial],parent=new Map([[key(initial),null]]),points=new Map([[key(initial),initial]]);let end;for(let n=0;n<queue.length;n++){const a=queue[n];if(Math.hypot(a.x-goal.x,a.y-goal.y)<24&&clear(a,{x:goal.x,y:a.y})&&clear({x:goal.x,y:a.y},goal)){end=key(a);break;}for(const[dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){const p={x:a.x+dx,y:a.y+dy},k=key(p);if(parent.has(k)||solid(p)||!clear(a,p))continue;parent.set(k,key(a));points.set(k,p);queue.push(p);}}if(!end)throw Error('No route '+JSON.stringify({start,goal}));const path=[];for(let k=end;k!==null;k=parent.get(k))path.push(points.get(k));path.reverse();path.push({x:goal.x,y:path.at(-1).y},goal);const turns=[];for(const p of path){if(turns.length&&p.x===turns.at(-1).x&&p.y===turns.at(-1).y)continue;while(turns.length>1){const a=turns.at(-2),b=turns.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))turns.pop();else break;}turns.push(p);}return turns;}''',goal)
            for point in route:move_axis(point['x'],'x');move_axis(point['y'],'y')
        tours=[]
        for room_id,floor in [('victorian-parlor',1),('retrofuture',2)]:
            page.evaluate("floor=>{const u=townBuilder.urban;u.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-furnishings'));u.goStoreFloor(floor)}",floor)
            portal=page.evaluate("id=>{const p=townBuilder.urban.portals.find(p=>p.action==='showroom'&&p.showroomId===id);return{approach:p.approach}}",room_id);walk(portal['approach']);page.keyboard.press('e');page.clock.run_for(40)
            assert scene()['scene']['showroomId']==room_id
            page.evaluate('townBuilder.urban.zoom(10000)');page.clock.run_for(40)
            camera=page.evaluate('''()=>{const u=townBuilder.urban,b=__visualBounds(__interiors.getInterior(u.scene)),v=u.view,c=document.getElementById('map');return{bottom:v.y+c.clientHeight/v.zoom/2,expected:b.y+b.h}}''');assert camera['bottom']>=camera['expected']-.1,camera
            if floor==1:walk({'x':500,'y':456})
            return_portal=page.evaluate("()=>townBuilder.urban.portals.find(p=>p.action==='showroom-lobby').approach");walk(return_portal);page.locator('#map').screenshot(path=str(OUT/f'return-{room_id}.png'));page.keyboard.press('e');page.clock.run_for(40);assert scene()['scene']=={'kind':'shop','floor':floor};tours.append(room_id)
        page.evaluate("()=>{const u=townBuilder.urban;u.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-residences'));u.goFloor(__roomThemes.find(t=>t.id==='ella').scene.floor)}")
        approach=page.evaluate("()=>townBuilder.urban.portals.find(p=>p.action==='room'&&p.resident==='ella').approach");walk(approach);page.keyboard.press('e');page.clock.run_for(40);assert scene()['scene']['resident']=='ella'
        page.evaluate('townBuilder.urban.zoom(10000)');page.clock.run_for(40);returned=page.evaluate("()=>townBuilder.urban.portals.find(p=>p.action==='exit').approach");walk(returned);page.locator('#map').screenshot(path=str(OUT/'return-wide-home.png'));page.keyboard.press('e');page.clock.run_for(40);assert scene()['scene']['kind']=='hall';tours.append('ella')
        assert page.evaluate('JSON.stringify(townBuilder.project)')==world
        assert page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        note('Real WASD and E enter and exit lower/upper showrooms and a wide tower home through their shifted doors',{'rooms':tours,'walkedWorldPixels':round(walked)})
        context.close()
        legacy=None
        if not args.skip_legacy:
            legacy=verify_legacy_room_saves(browser,boot=boot,fixtures={'approved':fixture,'previous':previous,'frozen':frozen},baseline=baseline,output=OUT/'legacy-results.json');note('Approved34, previous38, frozen31, edited Botanical and current31 saves preserve poses/colliders/signatures/raw bytes',legacy)
        assert not errors and not failed,(errors,failed);assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        (OUT/'results.json').write_text(json.dumps({'passed':True,'expandedRooms':21,'compactRoomsUnchanged':10,'editorFitsAllExteriors':True,'newBandPlacement':True,'realDoorJourneys':tours,'legacy':legacy,'mapAndProgressUnchanged':True,'errors':errors,'failedResponses':failed,'steps':steps},indent=2));browser.close()
finally:server.shutdown()
