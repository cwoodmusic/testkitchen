"""Actual ambient sit() against native four-facing standalone benches."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,base64,json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];MAP=ROOT/'town/maps/coda-town-uploaded-3.json';before=hashlib.sha256(MAP.read_bytes()).hexdigest()
parser=argparse.ArgumentParser();parser.add_argument('--reference',type=Path,help='Earlier contact PNG; South image columns must remain exact');parser.add_argument('--screenshots',type=Path,default=Path('/workspace/.onboarding/bench-four-facing'));args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.expose_function('__saveBenchContact',lambda name,url:(args.screenshots/(name+'.png')).write_bytes(base64.b64decode(url.split(',')[1])))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  report=page.evaluate('''async()=>{
   const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{createAmbientNPCs}=await import(url('ambient-npcs')),{render}=await import(url('render')),{furnitureFacingPlacement,furnitureFacingDepth,furnitureFacingBoxes}=await import(url('furniture-facing'));
   const catalog=townBuilder.catalog,ids=['decor-06-01','decor-06-02','decor-06-03','props-1-150'],directions=[['south',0],['north',180],['east',270],['west',90]],rows=[],sheet=document.createElement('canvas');sheet.width=1600;sheet.height=4*440;const sc=sheet.getContext('2d');
   for(let i=0;i<ids.length;i++)for(let j=0;j<directions.length;j++){
    const id=ids[i],[direction,rotation]=directions[j],a=catalog.get(id);await a.ensureFull(direction);
    const object={id:'bench-fixture',asset:id,x:2048,y:2048,rotation,scale:1,layer:'objects',collision:true},doc={version:1,cells:{},edges:{},objects:[object],spawn:{x:2048,y:2048}},sim=createAmbientNPCs({getProject:()=>doc,catalog,count:3});sim.update(0,0);
    const npc=sim.actors.find(p=>p.id==='clara'),bench=sim.district.benches[0];if(!npc?.seated||npc.seatId!==bench.id||!sim.events.some(e=>e.type==='sit'&&e.id==='clara'))throw Error('Actual sit() did not claim '+id+'/'+direction);
    const placement=furnitureFacingPlacement(a,object),boxes=furnitureFacingBoxes(a,object),cam={x:2048,y:2020,zoom:Math.min(1.5,300/Math.max(placement.w,placement.h))},canvas=document.createElement('canvas');canvas.width=400;canvas.height=390;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
    const opts={time:.5,heightView:'art',night:false,grid:false,npcs:[],drawNPC:sim.draw};render(ctx,doc,cam,400,390,opts);const empty=ctx.getImageData(0,0,400,390).data;render(ctx,doc,cam,400,390,{...opts,npcs:[npc]});const withNpc=ctx.getImageData(0,0,400,390).data;let changed=0;for(let at=0;at<empty.length;at+=4)if(empty[at]!==withNpc[at]||empty[at+1]!==withNpc[at+1]||empty[at+2]!==withNpc[at+2]||empty[at+3]!==withNpc[at+3])changed++;
    const px=i*440,xx=j*400;sc.fillStyle='#14212b';sc.fillRect(xx,px,400,440);sc.drawImage(canvas,xx,px+35);sc.fillStyle='#f1dfbe';sc.font='17px sans-serif';sc.fillText(a.name+' · '+direction,xx+10,px+24);sc.font='13px sans-serif';sc.fillText('NPC depth '+npc.depth.toFixed(1)+' / bench '+furnitureFacingDepth(a,object).toFixed(1),xx+10,px+432);
    rows.push({id,direction,rotation,assetSize:{w:a.w,h:a.h},seat:bench.seat,approach:bench.approach,benchDepth:furnitureFacingDepth(a,object),npc:{id:npc.id,x:npc.x,y:npc.y,facing:npc.facing,seated:npc.seated,depth:npc.depth,groundAnchor:npc.groundAnchor,seatId:npc.seatId},picturedBounds:placement.bounds,boxes,npcChangedPixels:changed,sitEvent:sim.events.find(e=>e.type==='sit'&&e.id==='clara')});
   }
   await __saveBenchContact('standalone-benches-seated-npc',sheet.toDataURL());return {sourceTag:app.search,rows};
  }''')
  assert not errors,errors;browser.close();assert hashlib.sha256(MAP.read_bytes()).hexdigest()==before;south_comparison=None
  if args.reference:
   from PIL import Image
   reference=Image.open(args.reference).convert('RGB');current=Image.open(args.screenshots/'standalone-benches-seated-npc.png').convert('RGB')
   assert reference.size==current.size
   south_comparison=[]
   for row in range(4):
    box=(0,row*440,400,(row+1)*440);A=reference.crop(box).tobytes();B=current.crop(box).tobytes();changed=sum(A[i:i+3]!=B[i:i+3] for i in range(0,len(A),3));south_comparison.append({'row':row,'changedPixels':changed});assert changed==0,south_comparison
  report.update(sourceUnchanged=True,sourceHash=before,pageErrors=errors,southReferenceComparison=south_comparison);(args.screenshots/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'cases':len(report['rows']),'pageErrors':errors,'sourceUnchanged':True}))
finally:server.shutdown()
