"""Visit all31 native homes, bound background memory, and verify re-entry."""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json';before=hashlib.sha256(SOURCE.read_bytes()).hexdigest();OUT=Path('/workspace/.onboarding/interior-cache');OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':1500,'height':1000});page.set_default_timeout(180000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  result=page.evaluate('''async()=>{
   const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app);
   const {getInterior,renderInterior,residents,getInteriorRenderCacheStats,clearInteriorRenderCache}=await import(url('urban-interiors')),{SHOWROOMS}=await import(url('showroom-layout')),{preparePlacedFacingArt}=await import(url('furniture-art-access'));await import(url('ground-textures'));await document.fonts.ready;
   const scenes=[...residents.map(r=>({kind:'apartment',resident:r.id,floor:r.floor})),{kind:'apartment',resident:'player',floor:15},...SHOWROOMS.map(r=>({kind:'showroom',showroomId:r.id,floor:r.storeFloor}))],check=(v,m)=>{if(!v)throw Error(m);},backgrounds=[],visits=[];
   const digest=async c=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',c.getImageData(0,0,c.canvas.width,c.canvas.height).data))].map(n=>n.toString(16).padStart(2,'0')).join('');
   async function draw(scene){const model=getInterior(scene);await preparePlacedFacingArt({objects:[...model.items,...(model.doors||[])]},townBuilder.catalog);const cv=document.createElement('canvas');cv.width=model.width;cv.height=model.height;const c=cv.getContext('2d'),native=c.drawImage;let bg;
    c.drawImage=function(image,...args){if(image.width===model.width&&image.height===model.height)bg=image;return native.call(this,image,...args);};
    renderInterior(c,scene,{catalog:townBuilder.catalog,actors:[],time:.4});await new Promise(r=>setTimeout(r,0));renderInterior(c,scene,{catalog:townBuilder.catalog,actors:[],time:.4});c.drawImage=native;check(bg&&bg!==cv,'Did not observe native interior background');return {canvas:cv,c,bg,hash:await digest(c)};
   }
   clearInteriorRenderCache();let first;
   for(const scene of scenes){const rendered=await draw(scene);if(!first)first={scene,hash:rendered.hash};backgrounds.push(rendered.bg);const stats=getInteriorRenderCacheStats();check(stats.backgrounds<=8&&stats.pixels<=16*1024*1024,'Background budget exceeded after '+JSON.stringify(scene));visits.push({scene,stats});rendered.canvas.width=rendered.canvas.height=0;}
   const afterAll=getInteriorRenderCacheStats(),released=backgrounds.filter(c=>c.width===0&&c.height===0).length;check(released>=23,'Evicted backgrounds retain native backing stores');
   const revisited=await draw(first.scene);check(revisited.hash===first.hash,'Re-entering an evicted home changed its native rendering');const afterReentry=getInteriorRenderCacheStats();check(afterReentry.backgrounds<=8&&afterReentry.pixels<=16*1024*1024,'Re-entry exceeded background budget');
   clearInteriorRenderCache();check(getInteriorRenderCacheStats().backgrounds===0&&getInteriorRenderCacheStats().pixels===0,'Explicit cache clear did not free memory');check(backgrounds.every(c=>c.width===0&&c.height===0),'Cleared cache left a native canvas allocated');
   return {homes:scenes.length,visits,afterAll,releasedNativeBackings:released,reentryPixelsExact:true,afterReentry,afterClear:getInteriorRenderCacheStats()};
  }''')
  assert not errors,errors;browser.close()
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==before
 result.update(sourceUnchanged=True,pageErrors=errors);(OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
finally:server.shutdown()
