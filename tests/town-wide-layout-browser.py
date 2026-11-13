"""Native wide-room defaults, source-aware saved layouts, and live room switching.

Run locally, or pass --url for a deployed Builder. HTTPS requests use Python's
verified TLS transport without disabling browser certificate validation.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import argparse, base64, hashlib, json, math
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT/'town/maps/coda-town-plaza-boardwalk.json'
KEY = 'codaRoomLayoutsV1:builder'
VICTORIAN = 'showroom-victorian-parlor'
parser = argparse.ArgumentParser()
parser.add_argument('--url', help='Published Builder URL')
parser.add_argument('--screenshots', type=Path, default=ROOT/'work/wide-layout/browser')
parser.add_argument('--skip-legacy', action='store_true', help='Skip the separately verified historical save-bank contexts')
parser.add_argument('--baseline-dir', type=Path, help='Optional verbose frozen scenes for failure diagnostics')
args = parser.parse_args()
OUT = args.screenshots
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((ROOT/'tests/fixtures/room-layout-ac1ee72.json').read_text())
shape_manifest = json.loads((ROOT/'tests/fixtures/room-layout-98c6c7a.json').read_text())
map_hash = hashlib.sha256(MAP.read_bytes()).hexdigest()
errors, failed, steps = [], [], []

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def copyfile(self, source, target):
        try: super().copyfile(source,target)
        except (BrokenPipeError,ConnectionResetError): pass

server = ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url = args.url or f'http://127.0.0.1:{server.server_port}/town/builder/'

def note(name, data=None):
    steps.append({'step':name,'data':data})
    (OUT/'progress.json').write_text(json.dumps(steps,indent=2))
    print(name,flush=True)

def transport(context):
    if not args.url:return
    cache={}
    def trusted(route):
        address=route.request.url
        if address not in cache:
            try:response=urlopen(Request(address,headers={'Accept-Encoding':'identity'}),timeout=60)
            except HTTPError as error:response=error
            with response:cache[address]=(response.status,{k:v for k,v in response.headers.items() if k.lower() in {'content-type','content-range','accept-ranges','cache-control'}},response.read())
        status,headers,body=cache[address]
        route.fulfill(status=status,headers=headers,body=body)
    context.route('https://cwoodmusic.github.io/testkitchen/**',trusted)

def boot(context):
    transport(context)
    page=context.new_page()
    page.set_default_timeout(90000)
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('response',lambda response:failed.append({'url':response.url,'status':response.status}) if response.status>=400 else None)
    page.goto(url)
    page.wait_for_function('!!window.townBuilder?.roomEditor')
    page.locator('#file').set_input_files(str(MAP))
    page.wait_for_function('townBuilder.project.objects.length===137')
    return page

INSTALL = r'''async()=>{
 let app=new URL(document.querySelector('script[type=module]').src),text=await(await fetch(app)).text();
 if(!/from\s+['"][^'"]*urban\.mjs/.test(text)){app=new URL(text.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],app);text=await(await fetch(app)).text();}
 const urbanURL=new URL(text.match(/from\s+['"]([^'"]*urban\.mjs[^'"]*)['"]/)[1],app),urbanText=await(await fetch(urbanURL)).text(),iURL=new URL(urbanText.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],urbanURL),iText=await(await fetch(iURL)).text(),dep=name=>new URL(iText.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],iURL),runtimeURL=dep('room-layout-runtime'),runtimeText=await(await fetch(runtimeURL)).text(),modelURL=new URL(runtimeText.match(/from\s+['"]([^'"]*room-layout-model\.mjs[^'"]*)['"]/)[1],runtimeURL),editorURL=new URL('../builder/room-editor.mjs'+app.search,iURL);
 const I=await import(iURL),M=await import(modelURL),F=await import(dep('furniture-facing')),N=await import(new URL('./showroom-navigation.mjs'+iURL.search,iURL)),W=await import(dep('wide-room-shell'));
 window.__game=window.townBuilder||window.townGame;window.__audit={I,M,F,N,W,catalog:__game.catalog,themes:(await import(editorURL)).roomEditorThemes(),moduleURL:iURL.href};
 window.__warm=async scene=>{const{preparePlacedFacingArt}=await import(dep('furniture-art-access')),{warmHomeMaterials}=await import(dep('home-materials')),{warmInteriorPortalArt}=await import(dep('interior-portal-art')),{warmInteriorWindows}=await import(dep('interior-window-art'));await Promise.all([preparePlacedFacingArt({objects:scene.items},__audit.catalog),warmHomeMaterials(scene.homeMaterialSuite),warmInteriorPortalArt(),warmInteriorWindows(scene,__audit.catalog),document.fonts.ready]);for(const item of scene.items)if(item.roomRugId)await __audit.catalog.get(item.asset).ensureFull();};
 window.__point=p=>{const e=townBuilder.roomEditor,r=document.getElementById('map').getBoundingClientRect(),v=e.view;return{x:r.left+r.width/2+(p.x-v.x)*v.zoom,y:r.top+r.height/2+(p.y-v.y)*v.zoom}};
 window.__sceneSnapshot=scene=>{const result=JSON.parse(JSON.stringify(scene));result.items=scene.items.map(item=>({...item,collisionBoxes:(item.collisionBoxes||[]).map(box=>({...box}))}));return result;};
}'''

SURVEY = r'''()=>{
 const{I,M,F,N,W,catalog,themes}=__audit,rows=[],assert=(ok,message)=>{if(!ok)throw Error(message)},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),slot=i=>i.slot||i.collectionSlot||catalog.get(i.asset)?.slot,overlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1e-6&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1e-6;
 function flood(scene){
  const step=8,cols=Math.ceil(scene.width/step),rows=Math.ceil(scene.height/step),total=cols*rows,blocked=new Uint8Array(total),seen=new Uint8Array(total),queue=new Int32Array(total),at=index=>({x:(index%cols)*step+4,y:Math.floor(index/cols)*step+4}),clear=p=>p&&p.x>=40&&p.y>=112&&p.x<=scene.width-40&&p.y<=scene.height-40&&!scene.solids.some(r=>p.x>=r.x-6&&p.x<=r.x+r.w+6&&p.y>=r.y-6&&p.y<=r.y+r.h+6);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x*step+4<40||x*step+4>scene.width-40||y*step+4<112||y*step+4>scene.height-40)blocked[y*cols+x]=1;
  for(const r of scene.solids){const x0=Math.max(0,Math.ceil((r.x-10)/step)),x1=Math.min(cols-1,Math.floor((r.x+r.w+2)/step)),y0=Math.max(0,Math.ceil((r.y-10)/step)),y1=Math.min(rows-1,Math.floor((r.y+r.h+2)/step));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)blocked[y*cols+x]=1;}
  let tail=0;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const X=Math.floor(scene.spawn.x/step)+x,Y=Math.floor(scene.spawn.y/step)+y,index=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&!blocked[index]&&Math.hypot(at(index).x-scene.spawn.x,at(index).y-scene.spawn.y)<=12){seen[index]=1;queue[tail++]=index;}}
  for(let head=0;head<tail;head++){const index=queue[head],x=index%cols,y=Math.floor(index/cols);for(const[X,Y]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const n=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&!blocked[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}}
  return p=>{if(!clear(p))return false;for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const X=Math.floor(p.x/step)+x,Y=Math.floor(p.y/step)+y,index=Y*cols+X;if(X>=0&&Y>=0&&X<cols&&Y<rows&&seen[index]&&Math.hypot(at(index).x-p.x,at(index).y-p.y)<=11)return true;}return false;};
 }
 for(const theme of themes){
  const base=I.getInteriorBase(theme.scene),model=M.createRoomLayoutModel({themeId:theme.id,scene:base,catalog}),record=model.record(),again=M.createRoomLayoutModel({themeId:theme.id,scene:base,catalog,record}),scene=again.scene,source=base.roomLayoutLegacySources?.[0]||base;
  assert(same(record,again.record()),theme.id+': fresh record cannot reload');assert(!model.hasEdits&&!again.hasEdits,theme.id+': fresh has edits');
  const info={themeId:theme.id,request:theme.scene,record,marker:base.wideRoomLayout||null,width:base.width,height:base.height,visual:W.getInteriorVisualBounds(base),sourceWidth:source.width,sourceHeight:source.height,editor:__sceneSnapshot(model.scene),reloaded:__sceneSnapshot(scene),resolved:__sceneSnapshot(I.getInterior(theme.scene)),navigation:theme.scene.kind==='showroom'?N.getShowroomNavigation(base):null};
  if(base.wideRoomLayout){
   assert(record.baseSignature!==M.createRoomLayoutModel({themeId:theme.id,scene:source,catalog}).record().baseSignature,theme.id+': reused legacy signature');
   const oldBed=source.rooms.find(r=>r.functionalRole==='bedroom'),mirrored=source.kind==='showroom'?source.showroom.column===1:oldBed.x+oldBed.w/2>source.width/2;assert(base.wideRoomLayout.mirrored===mirrored,theme.id+': changed mirrored side');
   const originals=new Map((source.roomLayoutBaseItems||source.items).map(i=>[i.id,i])),stock=base.roomLayoutBaseItems||base.items;
   assert(same(stock.map(i=>i.id).sort(),[...originals.keys()].sort()),theme.id+': stock IDs changed');
   const before=new Map(base.items.map(i=>[i.id,i]));let solidCount=0,supportedCount=0;
   for(const item of scene.items){if(item.roomRugId)continue;const original=originals.get(item.id),prior=before.get(item.id),asset=catalog.get(item.asset);assert(original&&prior,theme.id+': invented active item '+item.id);assert(item.asset===original.asset,item.id+': changed art');
    if(item.designRole!=='family-living-rug')assert(item.w===original.w&&item.h===original.h,item.id+': resized native art');
    for(const field of['x','y','w','h','solid','supportedBy','depth'])assert(item[field]===prior[field],item.id+': reload changed '+field);assert((item.rotation||0)===(prior.rotation||0),item.id+': reload changed rotation');
    const expected=item.solid?F.furnitureFacingBoxes(asset,item):[];assert(same(item.collisionBoxes||[],expected),item.id+': wrong real-catalog collider');assert(same(prior.collisionBoxes||[],expected),item.id+': fresh bases differ from reloaded bases');
    if(item.supportedBy&&item.supportedBy!=='north-wall'){const parent=scene.items.find(p=>p.id===item.supportedBy);assert(parent&&!item.solid&&!expected.length,item.id+': bad support');assert(item.depth===F.furnitureFacingDepth(catalog.get(parent.asset),parent,parent.y)+.25,item.id+': bad tabletop depth');supportedCount++;}
    else if(original.solid)assert(item.solid,item.id+': lost real runtime collisionDefault');
    if(item.solid)solidCount++;
   }
   assert(solidCount>10,theme.id+': no solid furniture');
   for(const zone of scene.zones.filter(z=>['showroom-lobby','exit'].includes(z.action)))assert(zone.x>=0&&zone.y>=0&&zone.x+zone.w<=scene.width&&zone.y+zone.h<=scene.height,theme.id+': return trigger extends outside its resized floor');
   for(const seat of scene.items.filter(i=>i.seatingTarget)){
    const target=scene.items.find(i=>i.id===seat.seatingTarget);assert(target,seat.id+': missing seating target');
    const center=item=>{const boxes=F.furnitureFacingBoxes(catalog.get(item.asset),item),left=Math.min(...boxes.map(b=>b.x)),top=Math.min(...boxes.map(b=>b.y)),right=Math.max(...boxes.map(b=>b.x+b.w)),bottom=Math.max(...boxes.map(b=>b.y+b.h));return{x:(left+right)/2,y:(top+bottom)/2,w:right-left,h:bottom-top};},s=center(seat),t=center(target),r=(seat.rotation||0)*Math.PI/180,front={x:-Math.sin(r),y:Math.cos(r)},dx=t.x-s.x,dy=t.y-s.y;
    assert(front.x*dx+front.y*dy>0&&Math.abs(front.x*dy-front.y*dx)<=(Math.abs(front.x)>.5?t.h:t.w)/2+2,seat.id+': chair faces away from its own table');
   }
   const bed=base.rooms.find(r=>r.functionalRole==='bedroom'),bath=base.rooms.find(r=>r.functionalRole==='bathroom'),kitchen=base.rooms.find(r=>r.functionalRole==='kitchen'),cx=r=>mirrored?base.width-r.x-r.w/2:r.x+r.w/2;
   assert(cx(bed)<cx(bath)&&cx(bath)<cx(kitchen),theme.id+': private/shared wing flow');
   for(const role of['dining','music'])assert(base.rooms.find(r=>r.functionalRole===role)?.floorOverlay===false,theme.id+': semantic floor overpaint');
   const reaches=flood(scene),targets=[['spawn',scene.spawn]];
   for(const d of scene.privacyDoors){assert(d.axis==='horizontal'&&d.length===36&&d.clearOpening,theme.id+': privacy door shape');targets.push([d.id+' north',{x:d.x+18,y:d.y-24}],[d.id+' south',{x:d.x+18,y:d.y+24}]);}
   for(const r of scene.rooms)if(r.point)targets.push([r.functionalRole,r.point]);for(const p of scene.homePlan?.fixtureApproaches||[])targets.push([p.role,p]);for(const i of scene.items)if(i.approach)targets.push([i.id,i.approach]);
   for(const[name,point]of targets)assert(reaches(point),theme.id+': unreachable '+name+' '+JSON.stringify(point));
   const family=scene.familyFurniture;assert(family&&family.diningSeats.every(id=>scene.items.some(i=>i.id===id))&&family.livingSeats.every(id=>scene.items.some(i=>i.id===id)),theme.id+': dangling family seats');
   info.checkedTargets=targets.length;info.solidFurniture=solidCount;info.supportedFurniture=supportedCount;
   if(theme.id==='player'){
    const floors=[{x:1584,y:512,w:656,h:540},{x:710,y:130,w:780,h:500}],walls=[{x:380,y:4,w:650,h:98},{x:1280,y:4,w:280,h:98},{x:1760,y:4,w:140,h:98}];for(const i of scene.items){for(const box of i.collisionBoxes||[])assert(!floors.some(r=>overlap(r,box)),i.id+': covers owned floor');if(i.wallMounted)assert(!walls.some(r=>overlap(r,F.furnitureFacingBounds(catalog.get(i.asset),i))),i.id+': covers owned wall');}
    const arcade=scene.items.find(i=>!i.roomExpansion&&slot(i)==='arcade'),parent=scene.items.find(i=>i.id===arcade?.supportedBy);assert(arcade&&parent&&slot(parent)==='record-console'&&!arcade.solid&&arcade.w===originals.get(arcade.id).w&&arcade.h===originals.get(arcade.id).h,'Player mini arcade lost native console support');info.miniArcade={id:arcade.id,supportedBy:parent.id,w:arcade.w,h:arcade.h};
   }
  }
  rows.push(info);
 }
 return rows;
}'''

PHOTO = r'''async request=>{
 const{I,W,catalog}=__audit,m=I.getInterior(request);await __warm(m);I.clearInteriorRenderCache();const b=W.getInteriorVisualBounds(m),cv=document.createElement('canvas');cv.width=b.w;cv.height=b.h;const c=cv.getContext('2d');c.fillStyle='#131b21';c.fillRect(0,0,cv.width,cv.height);I.renderInterior(c,request,{model:m,catalog,actors:[],time:0});return cv.toDataURL('image/png');
}'''

# Compatibility normalization and verifier are embedded below, so a fresh checkout
# needs only the small immutable fixture and the existing historical save fixtures.

"""Frozen ac1ee72 full-room compatibility proof, reusable by browser tests."""
import copy
import hashlib
import json
import math
from pathlib import Path

LAYOUT_KEY = 'codaRoomLayoutsV1:builder'
SCENE_FIELDS = ('id','title','width','height','color','trim','spawn','solids','items','zones','rooms','walls','rugs','windows','signs','lights','actors','kind','floor','showroomId','storeFloor','showroom','apartmentLayout','collectionOwner','interiorDesign','portalExit','privacyDoors','homeMaterialSuite','familyFurnitureZones','familyFurniture','resident','residentInfo','homePlan')
# These arrays describe sets of geometry/IDs. Route vertices, colors, paint layers,
# rooms, and nested source plans retain their meaningful order.
UNORDERED_KEYS = {'solids','walls','collisionBoxes','privacyDoors','doors','windows','lights','actors','diningSeats','livingSeats','removed','placements','added','rugs'}


def normalize(value, key=None):
    if isinstance(value, bool) or value is None or isinstance(value,str):return value
    if isinstance(value,(int,float)):
        assert math.isfinite(value),'Non-finite fixture coordinate'
        rounded=round(value,7)
        return int(rounded) if rounded==int(rounded) else rounded
    if isinstance(value,dict):return {k:normalize(v,k) for k,v in sorted(value.items())}
    if isinstance(value,list):
        result=[normalize(v) for v in value]
        if key in UNORDERED_KEYS:result.sort(key=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False))
        return result
    raise TypeError(type(value).__name__)


def fingerprint(value):
    raw=json.dumps(normalize(value),sort_keys=True,separators=(',',':'),ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def normalized_scene(scene):
    """Live resolved WORLD geometry only; source stock alternatives are excluded."""
    result=copy.deepcopy({k:scene[k] for k in SCENE_FIELDS if k in scene})
    items=result.get('items',[]);ids={i['id'] for i in items}
    # Stable semantic defaults make absence and explicit defaults equivalent.
    for item in items:
        item['rotation']=item.get('rotation') or 0
        item['solid']=bool(item.get('solid'))
        item['wallMounted']=bool(item.get('wallMounted'))
        item['layer']=item.get('layer') or 'objects'
        item['collisionBoxes']=item.get('collisionBoxes') or []
    result['items']=sorted(items,key=lambda i:i['id'])
    family=result.get('familyFurniture')
    if family:
        for field in ('diningSeats','livingSeats'):
            if field in family:family[field]=[item_id for item_id in family[field] if item_id in ids]
    # These are authored alternatives, not the live furnishing being checked.
    showroom=result.get('showroom')
    if showroom:
        showroom.pop('items',None)
        apartment=showroom.get('apartment')
        if apartment:
            apartment.pop('items',None);apartment.pop('calibrationEntry',None)
    if result.get('homePlan'):result['homePlan'].pop('items',None)
    if scene.get('wideRoomExpansion'):
        result['wideRoomExpansion']={k:v for k,v in scene['wideRoomExpansion'].items() if k!='signatureGeometry'}
    return normalize(result)


def room_fingerprints(row):
    gameplay=normalized_scene(row['resolved']);editor=normalized_scene(row['editor'])
    return {'request':row['request'],'gameplaySHA256':fingerprint(gameplay),'editorSHA256':fingerprint(editor),
            'navigationSHA256':fingerprint(row.get('navigation')),
            'editorNavigationSHA256':fingerprint(row.get('editorNavigation',row.get('navigation'))),
            'recordSHA256':fingerprint(row['record']),'baseSignature':row['record']['baseSignature'],
            'signatureSHA256':fingerprint(row['record']['baseSignature']),
            'items':len(gameplay.get('items',[])),
            'familyPieces':sum(i.get('roomExpansion')=='family-room-1' for i in gameplay.get('items',[]))}


COMPAT_INSTALL = r'''async()=>{
 let app=new URL(document.querySelector('script[type=module]').src),text=await(await fetch(app)).text();
 if(!/from\s+['"][^'"]*urban\.mjs/.test(text)){app=new URL(text.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],app);text=await(await fetch(app)).text();}
 const urbanURL=new URL(text.match(/from\s+['"]([^'"]*urban\.mjs[^'"]*)['"]/)[1],app),urbanText=await(await fetch(urbanURL)).text(),iURL=new URL(urbanText.match(/from\s+['"]([^'"]*urban-interiors\.mjs[^'"]*)['"]/)[1],urbanURL),iText=await(await fetch(iURL)).text(),runtimeURL=new URL(iText.match(/from\s+['"]([^'"]*room-layout-runtime\.mjs[^'"]*)['"]/)[1],iURL),runtimeText=await(await fetch(runtimeURL)).text(),modelURL=new URL(runtimeText.match(/from\s+['"]([^'"]*room-layout-model\.mjs[^'"]*)['"]/)[1],runtimeURL),navURL=new URL('./showroom-navigation.mjs'+iURL.search,iURL);
 window.__roomCompat={I:await import(iURL),M:await import(modelURL),N:await import(navURL),moduleURL:iURL.href};
}'''

COMPAT_CAPTURE = r'''entries=>{
 const{I,M,N}=__roomCompat,catalog=window.townBuilder?.catalog||townGame.catalog,
 snap=scene=>{const s=JSON.parse(JSON.stringify(scene));s.items=scene.items.map(i=>({...i,collisionBoxes:(i.collisionBoxes||[]).map(b=>({...b}))}));return s;};
 return entries.map(e=>{const base=I.getInteriorBase(e.request),model=M.createRoomLayoutModel({themeId:e.themeId,scene:base,catalog,...(e.record?{record:e.record}:{})}),resolved=I.getInterior(e.request);return{themeId:e.themeId,request:e.request,record:model.record(),editor:snap(model.scene),resolved:snap(resolved),navigation:e.request.kind==='showroom'?N.getShowroomNavigation(resolved):null,editorNavigation:e.request.kind==='showroom'?N.getShowroomNavigation(model.scene):null};});
}'''


def verify_legacy_layouts(browser, *, boot, manifest, fixtures, context_options=None, output=None, baseline_dir=None, only_cases=None):
    """boot(context) loads Builder; fixtures accepts approved/previous/frozen JSON."""
    approved=fixtures['approved'];approved=approved['rooms'] if 'rooms' in approved else {approved['themeId']:approved}
    previous=fixtures['previous'];previous=previous['rooms'] if 'rooms' in previous else {previous['themeId']:previous}
    frozen=fixtures['frozen']
    banks={'current31':manifest['currentRecords'],'approved34':approved,'previous38':previous,
           'frozen31':{c['themeId']:c['record'] for c in frozen['cases']},
           'modifiedBotanical':{frozen['modified']['themeId']:frozen['modified']['record']}}
    reports=[]
    for case,bank in banks.items():
        if only_cases and case not in only_cases:continue
        expected=manifest['cases'][case]
        assert set(bank)==set(expected),(case,'fixture room set changed')
        raw=json.dumps({'format':'coda-room-layouts','version':1,'owner':'builder','rooms':bank},separators=(',',':'))
        context=browser.new_context(**{'viewport':{'width':1600,'height':1100},**(context_options or {})})
        context.add_init_script('''({key,raw})=>{if(!/^https?:$/.test(location.protocol))return;localStorage.setItem(key,raw);window.__roomCompatWrites=0;for(const name of ['setItem','removeItem']){const old=Storage.prototype[name];Storage.prototype[name]=function(k,...args){if(k===key)window.__roomCompatWrites++;return old.call(this,k,...args);};}}'''.join(['(',')('+json.dumps({'key':LAYOUT_KEY,'raw':raw})+')']))
        errors=[]
        context.on('page',lambda page:page.on('pageerror',lambda error:errors.append(str(error))))
        try:
            page=boot(context);page.evaluate(COMPAT_INSTALL)
            rows=page.evaluate(COMPAT_CAPTURE,[{'themeId':theme,'request':expected[theme]['request'],'record':record} for theme,record in bank.items()])
            for row in rows:
                theme=row['themeId'];actual=room_fingerprints(row);wanted=expected[theme]
                mismatch={k:{'expected':wanted[k],'actual':actual[k]} for k in wanted if wanted[k]!=actual[k]}
                if mismatch:
                    diagnostic={'case':case,'theme':theme,'mismatch':mismatch,'actual':row}
                    if baseline_dir:
                        source=Path(baseline_dir)/(case+'-ac1ee72.json')
                        if source.exists():diagnostic['frozen']=next(r for r in json.loads(source.read_text())['rooms'] if r['themeId']==theme)
                    if output:
                        Path(output).parent.mkdir(parents=True,exist_ok=True)
                        Path(output).with_suffix('.failure.json').write_text(json.dumps(diagnostic,indent=2))
                    raise AssertionError((case,theme,mismatch))
            assert page.evaluate('localStorage.getItem(%s)'%json.dumps(LAYOUT_KEY))==raw,(case,'stored layout bytes changed')
            assert page.evaluate('window.__roomCompatWrites')==0,(case,'reading layouts wrote storage')
            assert not errors,(case,errors)
            report={'case':case,'rooms':len(rows),'completeScenesAndNavigationMatch':True,'recordsAndSignaturesMatch':True,'rawBytesUnchanged':True,'writes':0,'moduleURL':page.evaluate('__roomCompat.moduleURL')}
            reports.append(report);print('Full legacy geometry PASS: '+case+' ('+str(len(rows))+' rooms)',flush=True)
        finally:context.close()
    result={'passed':True,'sourceCommit':manifest['sourceCommit'],'cases':reports,'completeResolvedWorldGeometry':True}
    if output:Path(output).write_text(json.dumps(result,indent=2))
    return result


class Walker:
    """Use actual keyboard events and collision-aware cardinal route planning."""
    def __init__(self,page):
        self.page=page
        self.distance=0
        page.clock.install()
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.locator('#world, #map').focus(timeout=5000)

    def scene(self):
        return self.page.evaluate('({scene:__game.urban.scene,player:{...__game.urban.player}})')

    def axis(self,target,axis):
        page=self.page
        for _ in range(300):
            before=self.scene();delta=target-before['player'][axis]
            if abs(delta)<5:return
            key=('d' if delta>0 else 'a') if axis=='x' else ('s' if delta>0 else 'w')
            scale=.375 if before['scene']['kind'] in ('showroom','apartment') else 1
            running=abs(delta)>120;speed=(780 if running else 450)*scale
            if running:page.keyboard.down('Shift')
            page.keyboard.down(key)
            try:page.clock.run_for(int(min(180,max(17,(abs(delta)-3)/speed*1000))))
            finally:page.keyboard.up(key);page.keyboard.up('Shift')
            after=self.scene()
            assert after['scene']==before['scene'],('Unexpected portal',before,after)
            moved=abs(after['player'][axis]-before['player'][axis])
            assert moved>.01,('Blocked actual walker',target,axis,before)
            self.distance+=moved
        raise AssertionError(('Walker did not reach point',target,axis,self.scene()))

    def walk(self,goal):
        route=self.page.evaluate(r'''goal=>{
         const u=__game.urban,m=__audit.I.getInterior(u.scene),start={...u.player},pad=(['showroom','apartment'].includes(u.scene.kind)?6:16)+6,step=16,solid=p=>p.x<40||p.y<100||p.x>m.width-40||p.y>m.height-40||m.solids.some(r=>p.x>=r.x-pad&&p.x<=r.x+r.w+pad&&p.y>=r.y-pad&&p.y<=r.y+r.h+pad),clear=(a,b)=>{const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));return Array.from({length:count+1},(_,i)=>({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count})).every(p=>!solid(p));},key=p=>`${p.x},${p.y}`;
         let initial;for(let r=0;r<5&&!initial;r++)for(let yy=-r;yy<=r&&!initial;yy++)for(let xx=-r;xx<=r;xx++){const p={x:(Math.floor(start.x/step)+xx)*step+8,y:(Math.floor(start.y/step)+yy)*step+8};if(!solid(p)&&clear(start,{x:p.x,y:start.y})&&clear({x:p.x,y:start.y},p)){initial=p;break;}}
         if(!initial)throw Error('No clear start');const queue=[initial],parent=new Map([[key(initial),null]]),points=new Map([[key(initial),initial]]);let end;
         for(let n=0;n<queue.length;n++){const a=queue[n];if(Math.hypot(a.x-goal.x,a.y-goal.y)<24&&clear(a,{x:goal.x,y:a.y})&&clear({x:goal.x,y:a.y},goal)){end=key(a);break;}for(const[dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){const p={x:a.x+dx,y:a.y+dy},k=key(p);if(parent.has(k)||solid(p)||!clear(a,p))continue;parent.set(k,key(a));points.set(k,p);queue.push(p);}}
         if(!end)throw Error('No route '+JSON.stringify({start,goal}));const path=[];for(let k=end;k!==null;k=parent.get(k))path.push(points.get(k));path.reverse();path.push({x:goal.x,y:path.at(-1).y},goal);const turns=[];for(const p of path){if(turns.length&&p.x===turns.at(-1).x&&p.y===turns.at(-1).y)continue;while(turns.length>1){const a=turns.at(-2),b=turns.at(-1);if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))turns.pop();else break;}turns.push(p);}return turns;
        }''',goal)
        for point in route:self.axis(point['x'],'x');self.axis(point['y'],'y')

    def interact(self):
        self.page.keyboard.press('e');self.page.clock.run_for(50)


def editor(page,theme):
    if not page.evaluate('townBuilder.roomEditor.active'):page.locator('#roomEditor').click()
    page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
    page.locator('#roomEditorTheme').select_option(theme)
    page.wait_for_function('id=>townBuilder.roomEditor.model.themeId===id',arg=theme)
    assert page.evaluate('townBuilder.roomEditor.status.kind')!='error',page.evaluate('townBuilder.roomEditor.status')


ACTIVE = r'''()=>{
 const u=__game.urban,m=__audit.I.getInterior(u.scene),states=u.automaticDoors.states,privacy=m.privacyDoors||[],returnPortal=u.portals.find(p=>['showroom-lobby','exit'].includes(p.action));
 return{signature:__audit.M.createRoomLayoutModel({themeId:m.id,scene:__audit.I.getInteriorBase(u.scene),catalog:__audit.catalog,record:JSON.parse(localStorage.getItem('codaRoomLayoutsV1:builder')).rooms[m.id]}).record().baseSignature,
 scene:__sceneSnapshot(m),player:{...u.player},privacy:privacy.map(d=>({id:d.id,x:d.x,y:d.y,axis:d.axis,length:d.length})),states:states.filter(s=>privacy.some(d=>d.id===s.id)).map(s=>({id:s.id,x:s.door.x,y:s.door.y,axis:s.door.axis,length:s.door.length})),allOriginalReferences:privacy.every(d=>states.some(s=>s.door===d)),free:!m.solids.some(r=>u.player.x>=r.x-6&&u.player.x<=r.x+r.w+6&&u.player.y>=r.y-6&&u.player.y<=r.y+r.h+6),returnApproach:returnPortal.approach,returnThreshold:returnPortal.threshold,modelThreshold:m.portalExit.threshold};
}'''


try:
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.add_init_script('''if(!localStorage.getItem('__wideLayoutSeed')){localStorage.setItem('__wideLayoutSeed','1');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:500000,owned:['furniture-geranium'],rewards:[],earned:500020,spent:20}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Wide Layout QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}''')
        page=boot(context);page.evaluate(INSTALL)
        world=page.evaluate('JSON.stringify(townBuilder.project)')
        protected=page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')
        rows=page.evaluate(SURVEY)
        assert len(rows)==31
        changed=[row for row in rows if row['marker']]
        assert len(changed)==30,[(row['themeId'],row['width'],row['height']) for row in rows if not row['marker']]
        reshaped=[row for row in rows if row['marker'] and row['marker']['version']==2]
        assert len(reshaped)==23,[(row['themeId'],row['marker']) for row in rows]
        for row in rows:
            if row['request']['kind']=='apartment':assert (row['width'],row['height'])==(2368,1132),(row['themeId'],row['width'],row['height'])
            else:assert (row['width'],row['height'])==(1184,512),(row['themeId'],row['width'],row['height'])
            assert row['visual']['h']==row['height']+108
            assert row['visual']['w']*620==row['visual']['h']*1184,(row['themeId'],'room shape differs from the Victorian reference')
            assert normalized_scene(row['editor'])==normalized_scene(row['reloaded']),(row['themeId'],'fresh full-scene metadata changed on record reload')
            if not row['marker'] or row['marker']['version']!=2:
                for key,value in room_fingerprints(row).items():assert value==shape_manifest['cases']['fresh'][row['themeId']][key],(row['themeId'],'an approved lower room changed',key)
            if row['request']['kind']=='apartment':
                scene=row['editor'];center=row['width']/2
                assert scene['spawn']['x']==center and scene['portalExit']['threshold']['x']==center,(row['themeId'],'arrival/exit did not follow the resized home center')
                assert all(actor['x']==center for actor in scene.get('actors',[])),(row['themeId'],'resident actor did not follow the resized home center')
        victorian=next(row for row in rows if row['themeId']==VICTORIAN)
        for key,value in room_fingerprints(victorian).items():assert value==manifest['cases']['fresh'][VICTORIAN][key],('Victorian changed',key,value)
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY)) is None
        (OUT/'fresh-survey.json').write_text(json.dumps(rows,indent=2))
        note('All 31 rooms share the Victorian visual proportions; 23 reshaped defaults fully reload, eight approved lower rooms remain exact, and all functional targets are reachable',{'rooms':31,'standardLayouts':30,'reshaped':23,'checkedRouteTargets':sum(row.get('checkedTargets',0) for row in rows)})

        for row in rows:
            editor(page,row['themeId']);page.locator('.room-editor-fit').click()
            fit=page.evaluate('''()=>{const e=townBuilder.roomEditor,r=document.getElementById('map').getBoundingClientRect(),b=__audit.W.getInteriorVisualBounds(e.model.scene),v=e.view;return{left:r.width/2+(b.x-v.x)*v.zoom,right:r.width/2+(b.x+b.w-v.x)*v.zoom,top:r.height/2+(b.y-v.y)*v.zoom,bottom:r.height/2+(b.y+b.h-v.y)*v.zoom,width:r.width,height:r.height}}''')
            assert fit['left']>=20 and fit['top']>=20 and fit['right']<=fit['width']-20 and fit['bottom']<=fit['height']-20,(row['themeId'],fit)
        assert page.evaluate('localStorage.getItem(%s)'%json.dumps(KEY)) is None
        note('Editor Fit shows every full room and south exterior without saving a default override')
        for theme in ['showroom-art-deco-lounge','showroom-retrofuture','showroom-robot','bach','player']:
            request=next(row['request'] for row in rows if row['themeId']==theme)
            (OUT/(theme+'-new-default.png')).write_bytes(base64.b64decode(page.evaluate(PHOTO,request).split(',')[1]))
        note('Warm native lower/upper/newly wide home/player photographs captured')

        # Seed an actual old architecture, then keep a live Play room open while
        # Builder Reset/Undo/Redo/import changes both walls and placed furniture.
        theme='showroom-retrofuture';request=next(row['request'] for row in rows if row['themeId']==theme)
        old_record=shape_manifest['currentRecords'][theme]
        new_record=next(row['record'] for row in rows if row['themeId']==theme)
        old_pack={'format':'coda-room-layouts','version':1,'owner':'builder','rooms':{theme:old_record}}
        page.evaluate('({key,pack})=>localStorage.setItem(key,JSON.stringify(pack))',{'key':KEY,'pack':old_pack})
        page.reload();page.wait_for_function('!!window.townBuilder?.roomEditor');page.evaluate(INSTALL)
        editor(page,theme)
        assert fingerprint(page.evaluate('townBuilder.roomEditor.model.record()'))==fingerprint(old_record)
        assert fingerprint(normalized_scene(page.evaluate('__sceneSnapshot(townBuilder.roomEditor.model.scene)')))==shape_manifest['cases']['current31'][theme]['editorSHA256']
        page.locator('.room-editor-exit').click();page.locator('#play').click();page.wait_for_function('!!window.townGame?.urban');page.evaluate(INSTALL)
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='coda-furnishings'));townGame.urban.goStoreFloor(2);townGame.urban.openShowroom('retrofuture')")
        page.wait_for_function("townGame.urban.scene?.showroomId==='retrofuture'")
        old_active=page.evaluate(ACTIVE)
        assert old_active['signature']==old_record['baseSignature'] and old_active['allOriginalReferences'] and old_active['free']
        assert fingerprint(normalized_scene(old_active['scene']))==shape_manifest['cases']['current31'][theme]['gameplaySHA256']
        note('Actual Play has opened the saved upper showroom with its complete previous walls and furniture')
        original_play_url=page.url
        control=boot(context);control.evaluate(INSTALL);editor(control,theme)

        def expect_active(record):
            expected=record['baseSignature']
            page.bring_to_front()
            page.wait_for_function('signature=>{const u=townGame.urban,m=__audit.I.getInterior(u.scene),record=JSON.parse(localStorage.getItem("codaRoomLayoutsV1:builder")).rooms[m.id],fresh=__audit.M.createRoomLayoutModel({themeId:m.id,scene:__audit.I.getInteriorBase(u.scene),catalog:__audit.catalog,record});return fresh.record().baseSignature===signature&&(m.privacyDoors||[]).every(d=>u.automaticDoors.states.some(s=>s.door===d))}',arg=expected)
            result=page.evaluate(ACTIVE)
            assert page.url==original_play_url,'Active source switch reloaded Play'
            assert result['signature']==expected and result['allOriginalReferences'] and result['free'],result
            assert sorted(result['privacy'],key=lambda x:x['id'])==sorted(result['states'],key=lambda x:x['id'])
            assert result['returnThreshold']==result['modelThreshold']
            assert fingerprint(control.evaluate('townBuilder.roomEditor.model.record()'))==fingerprint(record)
            runtime_scene=normalized_scene(result['scene'])
            editor_scene=normalized_scene(control.evaluate('__sceneSnapshot(townBuilder.roomEditor.model.scene)'))
            if fingerprint(runtime_scene)!=fingerprint(editor_scene):
                (OUT/'active-source-mismatch.json').write_text(json.dumps({'runtime':runtime_scene,'editor':editor_scene},indent=2))
                raise AssertionError(('Active Play and Editor differ',[(key,fingerprint(runtime_scene.get(key)),fingerprint(editor_scene.get(key))) for key in runtime_scene if runtime_scene.get(key)!=editor_scene.get(key)]))
            return result

        control.get_by_role('button',name='Reset theme',exact=True).click();new_active=expect_active(new_record)
        assert old_active['scene']['height']==896 and new_active['scene']['height']==512
        assert old_active['player']['y']>new_active['scene']['height']-40
        assert new_active['player']==new_active['scene']['spawn'],'A player outside the resized room did not return to its safe arrival'
        assert old_active['privacy']!=new_active['privacy'],'The source-switch test did not change actual door geometry'
        control.bring_to_front();control.get_by_role('button',name='Undo',exact=True).click();expect_active(old_record)
        control.bring_to_front();control.get_by_role('button',name='Redo',exact=True).click();expect_active(new_record)
        control.bring_to_front();control.locator('.room-editor-panel input[type=file]').set_input_files({'name':'previous-wide-room.json','mimeType':'application/json','buffer':json.dumps(old_pack).encode()})
        control.wait_for_function('townBuilder.roomEditor.status.text==="Room layouts imported."');expect_active(old_record)
        control.bring_to_front();control.get_by_role('button',name='Reset theme',exact=True).click();expect_active(new_record)
        note('Real Builder Reset, Undo, Redo and file import switch full saved architecture in Editor and active Play, including door definitions, without reloading Play')

        walker=Walker(page);tours=[]
        walker.walk(page.evaluate("townGame.urban.portals.find(p=>p.action==='showroom-lobby').approach"));walker.interact()
        assert walker.scene()['scene']=={'kind':'shop','floor':2};tours.append('retrofuture reset while inside Play')
        page.evaluate("townGame.urban.goStoreFloor(1)");page.clock.run_for(40)
        walker.walk(page.evaluate("townGame.urban.portals.find(p=>p.action==='showroom'&&p.showroomId==='art-deco-lounge').approach"));walker.interact()
        assert walker.scene()['scene']['showroomId']=='art-deco-lounge'
        walker.walk(page.evaluate("townGame.urban.portals.find(p=>p.action==='showroom-lobby').approach"));walker.interact()
        assert walker.scene()['scene']=={'kind':'shop','floor':1};tours.append('art-deco-lounge')
        floor=next(row['request']['floor'] for row in rows if row['themeId']=='bach')
        control.bring_to_front();control.locator('.room-editor-exit').click();control.locator('#walk').click()
        home_walker=Walker(control)
        control.evaluate("floor=>{townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='coda-residences'));townBuilder.urban.goFloor(floor)}",floor);control.clock.run_for(40)
        home_walker.walk(control.evaluate("townBuilder.urban.portals.find(p=>p.action==='room'&&p.resident==='bach').approach"));home_walker.interact()
        assert home_walker.scene()['scene']['resident']=='bach'
        assert control.evaluate('__audit.I.getInterior(townBuilder.urban.scene).width')==next(row['width'] for row in rows if row['themeId']=='bach')
        home_walker.walk(control.evaluate("townBuilder.urban.portals.find(p=>p.action==='exit').approach"));home_walker.interact()
        assert home_walker.scene()['scene']=={'kind':'hall','floor':floor};tours.append('newly wide Bach home')
        note('Actual WASD/E enters and leaves lower/upper showrooms and a newly widened lower-floor apartment',{'tours':tours,'walkedWorldPixels':round(walker.distance+home_walker.distance)})
        assert page.evaluate('JSON.stringify(townGame.project)')==world
        assert page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest"].map(k=>[k,localStorage.getItem(k)]))')==protected
        context.close()
        legacy=None;prior_shapes=None
        if not args.skip_legacy:
            fixtures={'approved':json.loads((ROOT/'tests/fixtures/victorian-user-layout.json').read_text()),'previous':json.loads((ROOT/'tests/fixtures/victorian-previous-default.json').read_text()),'frozen':json.loads((ROOT/'tests/fixtures/room-layout-e6a709a.json').read_text())}
            legacy=verify_legacy_layouts(browser,boot=boot,manifest=manifest,fixtures=fixtures,output=OUT/'legacy-results.json',baseline_dir=args.baseline_dir)
            prior_shapes=verify_legacy_layouts(browser,boot=boot,manifest=shape_manifest,fixtures=fixtures,only_cases={'current31'},output=OUT/'previous-shape-results.json')
        assert not errors and not failed,(errors,failed)
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==map_hash
        result={'passed':True,'standardLayouts':30,'reshapedDefaults':23,'equalVictorianVisualProportions':True,'approvedVictorianUnchanged':True,'actualRuntimeNativeCatalog':True,'allRecordsReload':True,'activePlaySourceSwitch':True,'realDoorJourneys':tours,'mapAndProgressUnchanged':True,'legacy':legacy,'previousShapes':prior_shapes,'errors':errors,'failedResponses':failed,'steps':steps}
        (OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
        browser.close()
finally:
    server.shutdown()
