"""Audit every authored arcade/lava view in reviewer and shared game rendering.

The expected visibility rule was checked against all 252 native crops: arcade
screens appear only in South views; all four lamp views expose glass. Baseline
contexts disable only new geometry/art registration to verify preserved physics
and original owner identities. Native source files and saved maps stay intact.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=ROOT/'work/animation-audit/browser')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


def ready(page):
    page.wait_for_function('!!window.townAssetReview?.catalog')
    page.wait_for_function("!/(loading|opening)/i.test(document.getElementById('previewStatus').textContent)")


MODULE = """path=>import(performance.getEntriesByType('resource').filter(e=>new URL(e.name).pathname===path).at(-1)?.name??path)"""
SNAPSHOT = """async()=>{
 const module=MODULE,{catalog}=await module('/town/world/catalog.mjs');
 const fields=['id','name','group','w','h','boxes','polygons','layer','owner','collectionOwner','apartmentCollection','slot','purpose','furnitureRole','style','pack','variant','aliasOf','sourceAssetId','price','wallMounted','collisionDefault','npcAvoid','depthSorted','fixedScale','footprint','door','mountDefault','furnitureFacing'];
 return [...catalog.values()].map(a=>{
  const physical={};for(const field of fields)if(a[field]!==undefined)physical[field]=a[field];
  const views={};if(typeof a.getFacingView==='function')for(const f of ['south','west','north','east']){
   const v=a.getFacingView(f,{image:false});if(v)views[f]={id:v.id,w:v.w,h:v.h,footCenter:v.footCenter,facing:v.facing,relativeFacing:v.relativeFacing};
  }
  return {id:a.id,physical,views,motions:Object.fromEntries(['south','west','north','east'].map(f=>[f,a.getFacingView?.(f,{image:false})?.motion??(f==='south'?a.motion:null)]))};
 });
}""".replace('MODULE', MODULE)

PROBE = """async baseline=>{
 const module=MODULE,check=(ok,message)=>{if(!ok)throw Error(message);};
 const {catalog}=await module('/town/world/catalog.mjs'),{prepareAssetPreview,availableFacings}=await module('/town/asset-review/preview.mjs');
 const {AUTHORED_MOTION_CORRECTIONS:corrections}=await module('/town/world/authored-motion-data.mjs');
 const {PARALLEL_ART_PATCHES:patches}=await module('/town/world/parallel-art-data.mjs');
 const {drawObject}=await module('/town/world/render.mjs'),{furnitureFacingPlacement,facingRotation}=await module('/town/world/furniture-facing.mjs');
 const {drawFurnitureFacingSource}=await module('/town/world/furniture-facing-source.mjs'),{assetFilter}=await module('/town/world/asset-color.mjs');
 const {drawApartmentMotion,getApartmentMotionStats}=await module('/town/world/apartment-motion.mjs');
 const originals=new Map(baseline.map(r=>[r.id,r])),correctionMap=new Map(corrections.map(r=>[r.id+'|'+r.facing,r]));
 const editedGeometry=new Map(patches.filter(p=>p.motionGeometry).map(p=>[p.id+'|'+(p.facing??'south'),p.motionGeometry]));
 const keep=m=>JSON.stringify(Object.fromEntries(Object.entries(m??{}).filter(([key])=>!['mask','bounds'].includes(key)).sort(([a],[b])=>a.localeCompare(b))));
 const targets=[...catalog.values()].filter(a=>a.id!=='coda-arcade'&&(a.id.endsWith('-arcade')||a.id.endsWith('-lava-lamp')));
 check(targets.length===63,'Expected 63 actual arcade/lamp assets, got '+targets.length);
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);return c;};
 const pixels=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
 const differences=(a,b,glass)=>{let changed=0,outside=0;for(let p=0;p<a.length;p+=4)if(a[p]!==b[p]||a[p+1]!==b[p+1]||a[p+2]!==b[p+2]||a[p+3]!==b[p+3]){changed++;if(glass&&!glass[p+3])outside++;}return {changed,outside};};
 const rows=[];let animated=0,staticViews=0,unchangedIdentities=0;
 for(const a of targets)for(const f of availableFacings(a)){
  await a.ensureFull(f);const preview=await prepareAssetPreview(a,f),v=a.getFacingView(f,{image:false}),motion=v.motion??(f==='south'?a.motion:null),key=a.id+'|'+f;
  const shouldAnimate=a.id.endsWith('-lava-lamp')||f==='south';
  check(preview.animated===shouldAnimate,'Reviewer motion visibility mismatch: '+key);
  check(!!motion===shouldAnimate,'Game motion visibility mismatch: '+key);
  if(motion){
   const old=originals.get(a.id).motions[f],correction=correctionMap.get(key),geometry=editedGeometry.get(key)??correction?.motionGeometry;
   check(keep(motion)===keep(old??correction?.identity),'Original game/seed/palette changed: '+key);if(old)unchangedIdentities++;
   if(geometry)check(JSON.stringify(motion.mask)===JSON.stringify(geometry.mask),'Declared active glass geometry differs: '+key);
  }
  const scale=3,w=preview.width,h=preview.height,stillCanvas=make(w*scale,h*scale),S=stillCanvas.getContext('2d');S.scale(scale,scale);preview.draw(S,0);const still=pixels(stillCanvas);
  const allowed=make(w*scale,h*scale),G=allowed.getContext('2d');G.scale(scale,scale);
  if(motion){G.beginPath();motion.mask.forEach(([u,y],i)=>G[i?'lineTo':'moveTo'](u*w,y*h));G.closePath();G.fill();}
  const glass=pixels(allowed),object={id:'motion-audit',asset:a.id,x:512,y:512,scale:1,rotation:facingRotation(f),layer:a.layer,collision:false},pose={x:512,y:512,offset:1};
  // Place the same authored view at local origin. This exercises production
  // drawObject without artificial cancellation of fractional world offsets.
  const placement={...furnitureFacingPlacement(a,object,pose,{includeImage:false}),x:0,y:0};
  const gameBase=make(w*scale,h*scale),C=gameBase.getContext('2d');C.scale(scale,scale);C.filter=assetFilter(a);drawFurnitureFacingSource(C,placement,a.getFacingDrawSource(f,{native:true}));const gameStill=pixels(gameBase);
  let first=null,moving=0,painted=0,outside=0,gamePainted=0,gameOutside=0;
  for(const time of [.5,6]){
   const frame=make(w*scale,h*scale),F=frame.getContext('2d');F.scale(scale,scale);preview.draw(F,time);const now=pixels(frame),change=differences(still,now,glass);painted=Math.max(painted,change.changed);outside+=change.outside;
   if(first)moving=differences(first,now).changed;else first=now;
   const game=make(w*scale,h*scale),B=game.getContext('2d');B.scale(scale,scale);drawObject(B,object,{cells:{},edges:{},objects:[object]},false,1,time,null,{pose,facing:placement,native:true});
   // Production caches graded static art before scaling; native review draws
   // grade the crop directly. Check each against its own exact still backing,
   // then compare the shared isolated motion pixels below.
   const gameChange=differences(gameStill,pixels(game),glass);gamePainted=Math.max(gamePainted,gameChange.changed);gameOutside+=gameChange.outside;
   if(change.outside||gameChange.outside){window.__motionDebug={id:a.id,facing:f,time,still:stillCanvas.toDataURL(),frame:frame.toDataURL(),game:game.toDataURL(),glass:allowed.toDataURL(),outside:change.outside,gameOutside:gameChange.outside};throw Error(key+' has '+change.outside+' reviewer and '+gameChange.outside+' game changed pixels outside glass');}
   frame.width=frame.height=game.width=game.height=1;
  }
  if(shouldAnimate){check(painted>3&&moving>0&&gamePainted>3,'No visible moving screen/lava: '+key);animated++;}
  else{check(painted===0&&moving===0&&gamePainted===0,'Cabinet back/profile moved: '+key);staticViews++;}
  // The shared interior renderer takes this exact view metadata. Check its
  // isolated overlay against the reviewer result, independently of drawObject.
  if(motion){const overlay=make(w*scale,h*scale),O=overlay.getContext('2d');O.scale(scale,scale);preview.draw(O,0);drawApartmentMotion(O,v,{x:w/2,y:h,w,h},.5);check(differences(first,pixels(overlay)).changed===0,'Interior view differs from reviewer '+key);overlay.width=overlay.height=1;}
  rows.push({id:a.id,facing:f,kind:motion?.kind??null,paintedPixels:painted,movingPixels:moving,gamePaintedPixels:gamePainted,outsideGlassPixels:outside,gameOutsideGlassPixels:gameOutside});
  stillCanvas.width=stillCanvas.height=allowed.width=allowed.height=gameBase.width=gameBase.height=1;
  if(rows.length%28===0)console.log('motion audit '+rows.length+'/252');
 }
 check(rows.length===252&&animated===159&&staticViews===93,'Authored motion coverage incomplete');
 const stats=getApartmentMotionStats();check(stats.entries<=stats.maxEntries&&stats.pixels<=stats.maxPixels,'Motion cache exceeded bounds');
 return {assets:targets.length,authoredViews:rows.length,animatedViews:animated,staticBackOrProfileViews:staticViews,existingIdentitiesRetained:unchangedIdentities,rows,cache:stats};
}""".replace('MODULE', MODULE)

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        before_context = browser.new_context(reduced_motion='reduce')
        before_context.route('**/town/world/authored-motion.mjs*', lambda route: route.fulfill(content_type='text/javascript', body='export const registerAuthoredMotion=()=>[];'))
        before_context.route('**/town/world/parallel-art-data.mjs*', lambda route: route.fulfill(content_type='text/javascript', body='export const PARALLEL_ART_PATCHES=[];'))
        before = before_context.new_page()
        before.set_default_timeout(120000)
        before.goto(origin+'/town/asset-review/')
        ready(before)
        baseline = before.evaluate(SNAPSHOT)
        before_context.close()

        context = browser.new_context(reduced_motion='no-preference', viewport={'width':1440,'height':1000})
        page = context.new_page()
        page.set_default_timeout(120000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: print(message.text, flush=True) if message.text.startswith('motion audit ') else None)
        page.goto(origin+'/town/asset-review/')
        ready(page)
        current = page.evaluate(SNAPSHOT)
        assert len(baseline) == len(current) == 1664
        for old, new in zip(baseline, current):
            assert old['physical'] == new['physical'], ('Physical metadata changed', old['id'])
            assert old['views'] == new['views'], ('Authored view size/anchor changed', old['id'])
        try:
            report = page.evaluate(PROBE, baseline)
        except Exception:
            debug = page.evaluate('window.__motionDebug??null')
            if debug:
                (args.output/'failure.json').write_text(json.dumps(debug, indent=2))
            raise
        report['physicalAssetsUnchanged'] = len(current)

        # Real reviewer RAF + IntersectionObserver and matchMedia scheduling.
        page.evaluate("async()=>{await townAssetReview.goTo('apartment-lava-lamp','south');}")
        page.wait_for_timeout(150)
        stats = "async()=>{const module="+MODULE+";return (await module('/town/world/apartment-motion.mjs')).getApartmentMotionStats();}"
        n0 = page.evaluate(stats)['generatedFrames']
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] > n0, 'Visible reviewer did not animate'
        page.screenshot(path=str(args.output/'periwinkle-live.png'))
        page.locator('#previewStage').evaluate("el=>el.style.transform='translateY(220vh)'")
        page.wait_for_timeout(180)
        n0 = page.evaluate(stats)['generatedFrames']
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] == n0, 'Offscreen reviewer generated frames'
        page.locator('#previewStage').evaluate("el=>el.style.transform=''")
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] > n0, 'Offscreen reviewer failed to resume'
        page.emulate_media(reduced_motion='reduce')
        page.wait_for_timeout(150)
        n0 = page.evaluate(stats)['generatedFrames']
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] == n0, 'Reduced-motion reviewer generated frames'
        page.emulate_media(reduced_motion='no-preference')
        page.wait_for_timeout(300)
        page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}")
        page.wait_for_timeout(150)
        n0 = page.evaluate(stats)['generatedFrames']
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] == n0, 'Hidden reviewer generated frames'
        page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")
        page.wait_for_timeout(400)
        assert page.evaluate(stats)['generatedFrames'] > n0, 'Visible reviewer failed to resume'
        report['reviewerPause'] = {'offscreen':True,'reducedMotion':True,'documentHidden':True,'resumes':True}
        page.evaluate("async()=>{await townAssetReview.goTo('collection-bach-arcade','south');}")
        page.wait_for_timeout(300)
        page.screenshot(path=str(args.output/'arcade-live.png'))
        report['pageErrors'] = errors
        assert not errors, errors
        (args.output/'results.json').write_text(json.dumps(report, indent=2)+'\n')
        context.close()
        browser.close()
    print(json.dumps({key:value for key,value in report.items() if key!='rows'}), flush=True)
finally:
    server.shutdown()
