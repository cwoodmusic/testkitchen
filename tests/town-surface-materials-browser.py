"""Native31-home/15-common-floor architectural proof, clipping and cache checks.

Furniture pose acceptance is intentionally separate from this surface suite.
All browser storage is isolated; the uploaded source map is never changed.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse,base64,hashlib,json,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'town/maps/coda-town-uploaded-3.json'
parser=argparse.ArgumentParser();parser.add_argument('--screenshots',type=Path,default=Path('/tmp/town-surface-materials'));parser.add_argument('--skip-common',action='store_true',help='Recheck all31private suites without repeating unchanged15common captures');parser.add_argument('--baseline',type=Path,help='Optional immutable pre-change scene/save fingerprint');args=parser.parse_args();args.screenshots.mkdir(parents=True,exist_ok=True);source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
fingerprint=['node','tests/town-surface-contract-fingerprint.mjs','--output',str(args.screenshots/'physical-contracts.json')]
if args.baseline:fingerprint+=['--baseline',str(args.baseline)]
subprocess.run(fingerprint,cwd=ROOT,check=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=browser.new_context(viewport={'width':1740,'height':1120});page=context.new_page();page.set_default_timeout(240000);errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
  page.expose_function('__saveSurface',lambda name,data:(args.screenshots/(name+'.png')).write_bytes(base64.b64decode(data.split(',')[1])))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
  report=page.evaluate(r'''async({skipCommon})=>{
   const app=new URL(document.querySelector('script[type=module]').src),url=n=>new URL('../world/'+n+'.mjs'+app.search,app),{getInterior,renderInterior,residents,clearInteriorRenderCache,getInteriorRenderCacheStats}=await import(url('urban-interiors')),{HOME_MATERIAL_SUITES,warmHomeMaterials,getHomeMaterialCacheStats,drawHomeMaterialFloor,drawHomeMaterialWallpaper}=await import(url('home-materials')),{SHOWROOMS}=await import(url('showroom-layout')),{preparePlacedFacingArt}=await import(url('furniture-art-access')),{getApartmentCollectionRuntimeStats}=await import(url('apartment-collections')),{warmTowerCommonMaterials,getTowerCommonMaterialStats}=await import(url('tower-common-materials')),{warmInteriorPortalArt,getInteriorPortalArtCacheStats}=await import(url('interior-portal-art'));
   const check=(x,m)=>{if(!x)throw Error(m);},digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join(''),canvas=(w,h)=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;},pixels=cv=>cv.getContext('2d',{willReadFrequently:true}).getImageData(0,0,cv.width,cv.height).data;
   check(HOME_MATERIAL_SUITES.length===31,'Wrong material-suite count');await Promise.all([Promise.all(HOME_MATERIAL_SUITES.map(warmHomeMaterials)),warmTowerCommonMaterials(),warmInteriorPortalArt()]);const materialStats=getHomeMaterialCacheStats();check(materialStats.textures===124&&materialStats.ready===124&&materialStats.pixels<4*1024*1024,'Material decode set is incomplete/unbounded');
   const swatches=[],categoryHashes={floor:[],wall:[],wet:[],dado:[]},sheet=canvas(1240,31*150),sc=sheet.getContext('2d');sc.fillStyle='#17232d';sc.fillRect(0,0,sheet.width,sheet.height);sc.imageSmoothingEnabled=false;
   for(const [index,suite]of HOME_MATERIAL_SUITES.entries()){
    const row={owner:suite.owner};let column=0;
    for(const [category,finish,wall]of [['floor',suite.floor,false],['wall',suite.wallpaper,true],['wet',suite.wetFloor,false]]){
     const draw=split=>{const cv=canvas(272,272),c=cv.getContext('2d');c.imageSmoothingEnabled=false;if(wall)drawHomeMaterialWallpaper(c,{wallpaper:finish,wallpaperAreas:[{x:8,y:8,w:256,h:106}]});else for(const r of split?[{x:8,y:8,w:128,h:256},{x:136,y:8,w:128,h:256}]:[{x:8,y:8,w:256,h:256}])drawHomeMaterialFloor(c,{...r,floorFinish:finish});return cv;};
     const cv=draw(false),data=pixels(cv),hash=await digest(data);check(hash===await digest(pixels(draw(false))),'Non-deterministic material '+suite.owner+'/'+category);if(!wall)check(hash===await digest(pixels(draw(true))),'Floor phase splits at room/circulation joins '+suite.owner+'/'+category);
     let outside=0,visible=0;for(let y=0;y<272;y++)for(let x=0;x<272;x++){const a=data[(y*272+x)*4+3];if(!a)continue;if(x<8||x>=264||y<8||y>=(wall?114:264))outside++;else visible++;}check(outside===0&&visible>20000,'Clip/opacity failure '+suite.owner+'/'+category);row[category]={hash,outsidePixels:outside,visible};categoryHashes[category].push(hash);
     sc.drawImage(cv,8,8,256,wall?106:256,column*310+7,index*150+4,wall?294:130,wall?122:130);sc.fillStyle='#f1e0bb';sc.font='12px sans-serif';sc.fillText(suite.owner+' '+category,column*310+7,index*150+146);column++;
     if(wall){const dado=canvas(256,22);dado.getContext('2d').drawImage(cv,8,92,256,22,0,0,256,22);const dadoHash=await digest(pixels(dado));row.dado={hash:dadoHash};categoryHashes.dado.push(dadoHash);sc.drawImage(dado,938,index*150+45,294,26);sc.fillText('separate22px dado',938,index*150+146);}
    }
    swatches.push(row);
   }
   for(const [category,hashes]of Object.entries(categoryHashes))check(new Set(hashes).size===31,'Duplicate actual '+category+' material pixels');await __saveSurface('31-material-swatches',sheet.toDataURL());
   const renderer=createCodaCharacterRenderer({worldScale:1}),profile=renderer.normalizeProfile({}),probe=canvas(256,256);renderer.drawPlayer(probe.getContext('2d'),profile,{x:128,y:220,scale:1,facing:'down'},.4);const pp=pixels(probe);let y0=256,y1=-1;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(pp[(y*256+x)*4+3]>128){y0=Math.min(y0,y);y1=Math.max(y1,y);}const avatarScale=128/(y1-y0+1);
   const owners=[...residents.map(r=>({id:r.id,scene:{kind:'apartment',resident:r.id,floor:r.floor}})),{id:'player',scene:{kind:'apartment',resident:'player',floor:15}},...SHOWROOMS.map(s=>({id:'showroom-'+s.id,scene:{kind:'showroom',showroomId:s.id,floor:s.storeFloor}}))],commons=Array.from({length:15},(_,i)=>({id:'common-floor-'+(i+1),scene:{kind:i?'hall':'lobby',floor:i+1}})),rooms=[],cache=[];clearInteriorRenderCache();let firstStaticHash=null;
   async function render(scene,withPlayer){const m=getInterior(scene);await Promise.all([warmHomeMaterials(m.homeMaterialSuite),preparePlacedFacingArt({objects:[...m.items,...(m.doors||[])]},townBuilder.catalog)]);const cv=canvas(m.width,m.height),draw=()=>renderInterior(cv.getContext('2d'),scene,{catalog:townBuilder.catalog,actors:[],time:.4,...(withPlayer?{player:m.spawn,drawPlayer:(c,pose)=>renderer.drawPlayer(c,profile,{...pose,scale:avatarScale,facing:'down'},.4)}:{})});draw();await new Promise(r=>requestAnimationFrame(r));draw();return cv;}
   for(const owner of [...owners,...(skipCommon?[]:commons)]){
    const m=getInterior(owner.scene);if(owner.scene.kind==='apartment'||owner.scene.kind==='showroom')check(m.homeMaterialSuite?.owner===owner.id,'Scene is not bound to its own surface suite '+owner.id);const staticCV=await render(owner.scene,false),hash=await digest(pixels(staticCV));if(owner.id==='bach')firstStaticHash=hash;const cv=await render(owner.scene,true);await __saveSurface(owner.id,cv.toDataURL());rooms.push({id:owner.id,scene:owner.scene,width:m.width,height:m.height,staticHash:hash,suite:m.homeMaterialSuite?.id||null});
    const b=getInteriorRenderCacheStats(),a=getApartmentCollectionRuntimeStats(),p=getInteriorPortalArtCacheStats(),t=getTowerCommonMaterialStats();check(b.backgrounds<=8&&b.pixels<=16*1024*1024,'Background cache overflow');check(a.sourceEntries<=4&&a.canvasEntries<=192&&a.canvasPixels<=4*1024*1024,'Furniture cache overflow');check(p.entries<=p.maxEntries&&p.pixels<=p.maxPixels&&p.palettes<=48,'Portal cache overflow');check(t.ready&&t.tiles<=t.maxTiles,'Common material cache overflow');cache.push({id:owner.id,background:b,art:a,portals:p,common:t});
   }
   const reentry=await render(owners[0].scene,false);check(firstStaticHash===await digest(pixels(reentry)),'Returning to an evicted home changes static native pixels');const beforeMaterials=getHomeMaterialCacheStats(),beforePortal=getInteriorPortalArtCacheStats(),m=getInterior(commons[7].scene);await render(commons[7].scene,true);const stablePortal=getInteriorPortalArtCacheStats(),cv=canvas(m.width,m.height);for(let n=0;n<120;n++)renderInterior(cv.getContext('2d'),commons[7].scene,{catalog:townBuilder.catalog,actors:[],time:.4});const afterMaterials=getHomeMaterialCacheStats(),afterPortal=getInteriorPortalArtCacheStats();check(JSON.stringify(beforeMaterials)===JSON.stringify(afterMaterials),'Repeated common frames decode new home materials');check(afterPortal.builds===stablePortal.builds,'Stable common frames rebuild portal textures');
   return {privateHomes:owners.length,commonFloors:skipCommon?0:commons.length,avatar:{targetHeight:128,scale:avatarScale},swatches,uniquePixels:Object.fromEntries(Object.entries(categoryHashes).map(([k,v])=>[k,new Set(v).size])),materialStats,rooms,cache,reentryPixelsIdentical:true,afterMaterials,afterPortal,sourceTag:app.search};
  }''',{'skipCommon':args.skip_common})
  assert not errors,errors;browser.close()
 assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash
 report.update(pageErrors=errors,sourceMapUnchanged=True,requests=requests);(args.screenshots/'results.json').write_text(json.dumps(report,indent=2));print(json.dumps({'privateHomes':report['privateHomes'],'commonFloors':report['commonFloors'],'uniquePixels':report['uniquePixels'],'materialStats':report['materialStats'],'reentryPixelsIdentical':True,'sourceMapUnchanged':True,'pageErrors':errors}),flush=True)
finally:server.shutdown()
