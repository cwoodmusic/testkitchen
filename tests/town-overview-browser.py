"""Overview rendering, edit invalidation and builder interaction regressions.

Run: python tests/town-overview-browser.py [--map project.json]
Uses an isolated browser profile; it never modifies the source project file.
"""
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
parser = argparse.ArgumentParser()
parser.add_argument('--map',type=Path,default=ROOT/'town/maps/coda-town-courtyards.json')
parser.add_argument('--screenshots',type=Path,help='Optional directory for the raised-water depth comparison')
args = parser.parse_args()
source_bytes=args.map.read_bytes()
source=json.loads(source_bytes)
source_hash=hashlib.sha256(source_bytes).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
  page=context.new_page();errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/?kit=leisure')
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  page.locator('#file').set_input_files(str(args.map))
  page.wait_for_function('n=>townBuilder.project.objects.length===n',arg=len(source['objects']),timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  if page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  if page.evaluate('townBuilder.night'):page.locator('#lightingToggle').click()
  page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.8})')
  urls=page.evaluate('''()=>{
   const app=new URL(document.querySelector('script[type="module"]').src),q=app.search;
   return Object.fromEntries(['runtime','model','overview-terrain','ground-brush','round-terrain','organic-edges','water-fill','land-fill','region'].map(name=>[name,new URL((['ground-brush','round-terrain','organic-edges','water-fill','land-fill','region'].includes(name)?'./':'../world/')+name+'.mjs'+q,app).href]));
  }''')
  # Native rendering fixtures exercise edits against the same warmed canvas,
  # then compare a new canvas/document to catch stale caches and bad repair.
  result=page.evaluate('''async urls=>{
   const {render}=await import(urls.runtime),{overviewTerrainStats}=await import(urls['overview-terrain']);
   const {paintGround}=await import(urls['ground-brush']);
   const {roundTerrain}=await import(urls['round-terrain']);
   const {planOrganicEdges}=await import(urls['organic-edges']);
   const {planWaterFill}=await import(urls['water-fill']);
   const {planLandFill}=await import(urls['land-fill']);
   const {regionBetween,regionHeightEdits}=await import(urls.region);
   const check=(ok,message)=>{if(!ok)throw Error(message);};
   const make=()=>{const cv=document.createElement('canvas');cv.width=600;cv.height=450;return cv.getContext('2d',{willReadFrequently:true});};
   const c=make(),w=1200,h=900,cam={x:8192,y:7800,zoom:.12},cases=[];
   const fixture={version:1,name:'Overview regression fixture',cells:{},edges:{},objects:[],spawn:{x:8192,y:7800}};
   for(let y=0;y<192;y++)for(let x=0;x<256;x++)fixture.cells[`${x},${y}`]={surface:'water',level:0};
   for(let y=80;y<=144;y++)for(let x=80;x<=144;x++)fixture.cells[`${x},${y}`]={surface:'grass',level:3};
   fixture.objects.push({id:'donor',asset:'music-square',x:14500,y:10800,scale:1,rotation:0,layer:'ground',collision:true});
   const pixels=(g,d,options={})=>{
    g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;
    render(g,d,{...cam,...options.cam},w,h,{time:3,night:false,...options});
    return new Uint8Array(g.getImageData(0,0,600,450).data);
   };
   const different=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;};
   function parity(label,d=fixture,options={}){
    const before=JSON.stringify(d),actual=pixels(c,d,options),fresh=pixels(make(),structuredClone(d),options),n=different(actual,fresh);
    check(n===0,`${label}: warmed/fresh overview differs in ${n} channels`);
    check(JSON.stringify(d)===before,`${label}: renderer modified project`);
    cases.push(label);return actual;
   }
   let previous=parity('cold cache');
   check(overviewTerrainStats(c)?.fullBuilds>=1,'Overview cache was not used');
   check(different(previous,parity('warm cache'))===0,'Unchanged frame was unstable');
   parity('fractional camera',{...fixture},{cam:{x:8192.35,y:7800.45,zoom:.083}});
   function edit(label,change){const before=pixels(c,fixture);change();const next=parity(label);check(different(before,next)>0,label+': visible edit did not appear');previous=next;}
   edit('in-place material',()=>fixture.cells['118,119'].surface='sand');
   edit('in-place height',()=>fixture.cells['118,119'].level=4);
   edit('soft ground painting',()=>{for(const[k,a]of paintGround(fixture,{x:7600,y:7800},{size:240,hardness:.65,opacity:1,surface:'cobble',paving:'music-square'}).edits)fixture.cells[k]=a;});
   edit('raise region',()=>{for(const[k,a]of regionHeightEdits(fixture,regionBetween({x:115,y:117},{x:119,y:121}),1))fixture.cells[k]=a;});
   edit('lower region',()=>{for(const[k,a]of regionHeightEdits(fixture,regionBetween({x:115,y:117},{x:119,y:121}),-1))fixture.cells[k]=a;});
   // Material and height curves are both part of the original terrain model.
   edit('rounded coast',()=>{const result=roundTerrain(fixture,{x:5121,y:5121},3,'smooth');check(result.edits.length,'Round fixture made no edits');for(const[k,a]of result.edits)fixture.cells[k]=a;});
   parity('organic coast',fixture,{cam:{x:5700,y:5700,zoom:.16}});
   const organic=planOrganicEdges(fixture,{x:5128,y:5600},{size:240,strength:.8});
   check(organic.edits.length,'Organic fixture made no edits');for(const[k,a]of organic.edits)fixture.cells[k]=a;
   parity('organic coast edit',fixture,{cam:{x:5700,y:5700,zoom:.16}});
   for(let y=129;y<=131;y++)for(let x=129;x<=131;x++)fixture.cells[`${x},${y}`]={surface:'sand',level:3};
   const fill=planLandFill(fixture,{x:8320,y:8320},{surface:'cobble',paving:'music-square'});check(fill.edits.length,'Land fill fixture made no edits');
   for(const[k,a]of fill.edits)fixture.cells[k]=a;parity('fill land');
   edit('paving donor move',()=>fixture.objects[0].x+=96);
   edit('paving donor scale',()=>fixture.objects[0].scale=1.25);
   edit('paving donor rotation',()=>fixture.objects[0].rotation=90);
   edit('paving donor elevation',()=>fixture.cells['228,168']={surface:'grass',level:2});
   for(let y=132;y<=134;y++)for(let x=132;x<=134;x++)fixture.cells[`${x},${y}`]={surface:'grass',level:1};
   const water=planWaterFill(fixture,{x:8512,y:8512});check(water.edits.length,'Raised lake fill made no edits');
   for(const[k,a]of water.edits)fixture.cells[k]=a;parity('raised lake');
   const lakeCam={x:8512,y:8450,zoom:.24},lakeA=pixels(c,fixture,{time:0,cam:lakeCam}),lakeB=pixels(c,fixture,{time:4,cam:lakeCam});
   check(different(lakeA,lakeB)>0,'Raised lake stopped animating');
   // At the cache's native scale there is no resampling offset. Record any
   // edge-compositing difference separately for visual depth inspection.
   const lakeAligned={x:8512,y:8448,zoom:.25},lakeC=make(),lakeRawC=make();
   const lakeCached=pixels(lakeC,fixture,{cam:lakeAligned}),lakeRaw=pixels(lakeRawC,fixture,{cam:lakeAligned,overview:false});
   const lakeDepth={changedPixels:0,severePixels:0,maxChannelError:0};
   for(let i=0;i<lakeCached.length;i+=4){let error=0;for(let k=0;k<4;k++)error=Math.max(error,Math.abs(lakeCached[i+k]-lakeRaw[i+k]));if(error)lakeDepth.changedPixels++;if(error>8)lakeDepth.severePixels++;lakeDepth.maxChannelError=Math.max(lakeDepth.maxChannelError,error);}
   check(lakeDepth.severePixels===0,'Raised-water depth differs from the native-scale raw renderer');
   window.__overviewDepthImages=[lakeC.canvas.toDataURL('image/png'),lakeRawC.canvas.toDataURL('image/png')];
   fixture.cells['116,120']={surface:'cobble',paving:'music-square',level:1,stairs:'north',stairBase:1,stairRise:2,stairStart:0,stairEnd:1,finish:'stone'};
   fixture.cells['116,121']={surface:'grass',level:1};parity('stairs and side banks');
   for(let y=145;y<=149;y++)fixture.cells[`128,${y}`]={surface:'water',level:0,bridge:'ns',finish:'wood',pier:{level:3,axis:'ns'}};
   parity('pier decks and submerged posts',fixture,{cam:{x:8192,y:9000,zoom:.2}});
   for(let y=122;y<=124;y++)for(let x=132;x<=134;x++)fixture.cells[`${x},${y}`]={surface:'sidewalk',level:3,sidewalkCurb:true};
   parity('concrete curbs and corners');
   parity('grid view',fixture,{grid:true});parity('height colors',fixture,{heightView:'colors'});parity('elevation plan',fixture,{heightView:'plan'});
   parity('undo/reload document identity',structuredClone(fixture));
   const close=pixels(make(),fixture,{cam:{x:7600,y:7800,zoom:.8}}),rawClose=pixels(make(),fixture,{cam:{x:7600,y:7800,zoom:.8},overview:false});
   check(different(close,rawClose)===0,'Close view changed its original terrain pixels');
   const waterA=pixels(c,fixture,{time:0}),waterB=pixels(c,fixture,{time:3.5});check(different(waterA,waterB)>0,'Overview sea stopped animating');
   // The builder supplies a numeric revision after every tool change. Stable
   // revisions avoid a full scan, while edits, document replacements, and
   // paving-donor dependencies must still invalidate the warmed bitmap.
   const stamped=structuredClone(fixture),stampC=make();
   const stampedPixels=(d,revision)=>pixels(stampC,d,{terrainRevision:revision});
   let stampFrame=stampedPixels(stamped,10),scans=overviewTerrainStats(stampC).scans;
   check(different(stampFrame,stampedPixels(stamped,10))===0,'Stable revision changed pixels');
   check(overviewTerrainStats(stampC).scans===scans,'Stable revision rescanned all cells');
   cases.push('stable revision skips cell scan');
   stamped.cells['123,123'].surface='sand';
   const edited=stampedPixels(stamped,11);
   check(different(stampFrame,edited)>0,'Revision edit did not appear');
   check(different(edited,pixels(make(),structuredClone(stamped),{terrainRevision:11}))===0,'Revision edit differs from a fresh render');
   check(overviewTerrainStats(stampC).scans===++scans,'New revision did not scan the in-place edit');
   cases.push('revision updates in-place cell');
   stamped.cells={...stamped.cells};stampedPixels(stamped,11);
   check(overviewTerrainStats(stampC).scans===++scans,'Replacing cells with the same revision skipped invalidation');
   cases.push('cell identity invalidates same revision');
   stamped.objects[0].x+=96;
   const moved=stampedPixels(stamped,11);
   check(different(moved,pixels(make(),structuredClone(stamped),{terrainRevision:11}))===0,'Paving donor changed under the same revision without invalidation');
   check(overviewTerrainStats(stampC).scans===++scans,'Paving donor frame did not force a scan');
   cases.push('donor dependency invalidates same revision');
   const replacement={...stamped};stampedPixels(replacement,11);
   check(overviewTerrainStats(stampC).scans===++scans,'Replacing document with the same revision skipped invalidation');
   cases.push('document identity invalidates same revision');
   window.__overviewFixture=fixture;window.__overviewPixelTest={pixels,make,different,cam};
   return {cases,stats:overviewTerrainStats(c),seaAnimated:true,raisedLakeAnimated:true,closeViewExact:true,lakeDepth};
  }''',urls)
  if args.screenshots:
   args.screenshots.mkdir(parents=True,exist_ok=True)
   for name,data in zip(['raised-water-cached.png','raised-water-raw.png'],page.evaluate('__overviewDepthImages')):
    (args.screenshots/name).write_bytes(base64.b64decode(data.split(',')[1]))
  page.emulate_media(reduced_motion='reduce')
  reduced=page.evaluate('''async urls=>{
   const{render}=await import(urls.runtime),d=window.__overviewFixture,cv=document.createElement('canvas');cv.width=600;cv.height=450;const c=cv.getContext('2d');
   const draw=time=>{c.setTransform(.5,0,0,.5,0,0);c.imageSmoothingEnabled=false;render(c,d,{x:8192,y:7800,zoom:.12},1200,900,{time,night:false});return c.getImageData(0,0,600,450).data;};
   const a=draw(0),b=draw(8);let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;
  }''',urls)
  assert reduced==0,('Reduced-motion overview changed',reduced)
  page.emulate_media(reduced_motion='no-preference')
  # The real tools must update the overview immediately, including Undo/Redo.
  page.evaluate('Object.assign(townBuilder.cam,{x:8192,y:6144,zoom:.12})')
  page.evaluate('''async url=>{window.__overviewStats=(await import(url)).overviewTerrainStats;}''',urls['overview-terrain'])
  page.wait_for_function('!!__overviewStats(document.getElementById("map").getContext("2d"))')
  def builds():
   return page.evaluate('''()=>{const s=__overviewStats(document.getElementById('map').getContext('2d'));return s.fullBuilds+s.patchBuilds;}''')
  def painted(previous):
   page.wait_for_function('''previous=>{const s=__overviewStats(document.getElementById('map').getContext('2d'));return s.fullBuilds+s.patchBuilds>previous;}''',arg=previous,timeout=120000)
  before=page.evaluate('JSON.stringify(townBuilder.project)')
  page.locator('[data-tool="ground"]').click();page.locator('#groundShape').select_option('square');page.locator('#surface').select_option('sand');page.locator('#brush').fill('1')
  def point(x,y):
   return page.evaluate('''async({x,y,url})=>{const{height}=await import(url),r=document.getElementById('map').getBoundingClientRect(),cam=townBuilder.cam;return{x:r.x+r.width/2+(x-cam.x)*cam.zoom,y:r.y+r.height/2+(y-height(townBuilder.project,x,y)-cam.y)*cam.zoom};}''',{'x':x,'y':y,'url':urls['model']})
  target=point(12064,8032);count=builds();page.mouse.click(target['x'],target['y']);painted(count)
  afterPaint=page.evaluate('JSON.stringify(townBuilder.project)');assert afterPaint!=before,'Actual overview ground tool made no edit'
  count=builds();page.locator('#undo').click();painted(count);assert page.evaluate('JSON.stringify(townBuilder.project)')==before
  count=builds();page.locator('#redo').click();painted(count);assert page.evaluate('JSON.stringify(townBuilder.project)')==afterPaint
  page.locator('[data-tool="lower"]').click();target=point(12064,8032);count=builds();page.mouse.click(target['x'],target['y']);painted(count)
  afterLower=page.evaluate('JSON.stringify(townBuilder.project)');assert afterLower!=afterPaint,'Actual overview level tool made no edit'
  count=builds();page.locator('#undo').click();painted(count);assert page.evaluate('JSON.stringify(townBuilder.project)')==afterPaint
  count=builds();page.locator('#redo').click();painted(count);assert page.evaluate('JSON.stringify(townBuilder.project)')==afterLower
  page.wait_for_function('document.getElementById("status").textContent.startsWith("Saved in this browser")',timeout=120000)
  page.reload();page.wait_for_function('!!window.townBuilder',timeout=120000)
  assert page.evaluate('JSON.stringify(townBuilder.project)')==afterLower,'Edited overview did not survive reload'
  page.locator('#file').set_input_files(str(args.map));page.wait_for_function('value=>JSON.stringify(townBuilder.project.cells["188,125"])===JSON.stringify(value)',arg=source['cells'].get('188,125'))
  assert page.evaluate('townBuilder.project')==source
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  print(json.dumps({'render':result,'reducedMotionExact':True,'actualToolsUndoReload':True,'sourceObjects':len(source['objects']),'errors':errors}),flush=True)
  browser.close()
finally:server.shutdown()
