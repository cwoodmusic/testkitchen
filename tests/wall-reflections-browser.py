"""Real Canvas reflections stay cached, on glass, and below live artwork."""
import functools
import json
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

class WallReflectionTests(unittest.TestCase):
    def test_game_quality_controls_preserve_saved_project_cache_and_visible_actors(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        current=json.loads((ROOT/'published-world-project.json').read_text())
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
                context=browser.new_context(viewport={'width':1600,'height':1000})
                context.route('https://**/*',lambda route:route.abort())
                context.route('**/published-world-project.json*',lambda route:route.fulfill(content_type='application/json',body=json.dumps(current)))
                context.add_init_script("localStorage.setItem('codaArcadeFXV1','off');localStorage.setItem('arcadeAnimations','off');window.reflectionFrames=n=>new Promise(resolve=>{const next=()=>--n<=0?resolve():requestAnimationFrame(next);requestAnimationFrame(next);});")
                code=(ROOT/'developer-console.js').read_text()+'''\n(()=>{const original=window.createCodaDeveloperConsole;window.createCodaDeveloperConsole=api=>{const instance=original(api);window.__reflectionConsole=instance;window.__reflectionApi=api;return instance;};})();'''
                context.route('**/developer-console.js*',lambda route:route.fulfill(content_type='text/javascript',body=code))
                page=context.new_page();errors=[]
                page.on('pageerror',lambda error:errors.append(str(error)))
                page.goto(f'http://127.0.0.1:{server.server_port}/world-preview.html',wait_until='domcontentloaded')
                page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA.characters().spriteState.ready')
                stored=page.evaluate('''project=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readwrite'),record={...project,savedAt:123456789};tx.objectStore('layouts').put(record,'codaWorldProjectV1');tx.oncomplete=()=>{db.close();resolve(JSON.stringify(record));};tx.onerror=()=>reject(tx.error);};})''',current)
                page.reload(wait_until='domcontentloaded')
                page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA.characters().spriteState.ready')
                self.assertEqual(page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')
                page.evaluate('''()=>{window.reflectionProbe=()=>{
 const make=()=>{const c=document.createElement('canvas');c.width=1672;c.height=941;return c;},hash=canvas=>{let value=2166136261;for(const byte of canvas.getContext('2d').getImageData(0,0,1672,941).data)value=Math.imul(value^byte,16777619);return value>>>0;};
 const base=make(),raw=make();__reflectionConsole.renderBase(base.getContext('2d'));raw.getContext('2d').drawImage(__reflectionApi.environmentArt.background(),0,0);
 const p=CodaArcadeQA.position(),cam=CodaArcadeQA.camera(),scene=view.getContext('2d'),bg=base.getContext('2d');let visible=0;
 for(let y=Math.floor(p.y)-43;y<Math.floor(p.y)-3;y++)for(let x=Math.floor(p.x)-12;x<Math.floor(p.x)+12;x++){
  const a=scene.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data,b=bg.getImageData(x,y,1,1).data;if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])>40)visible++;
 }return {hash:hash(base),nativeHash:hash(raw),pixel:[...bg.getImageData(820,180,1,1).data],visible,state:CodaDeveloperConsole.getState().wallReflections};
};}''')
                off=page.evaluate('reflectionProbe()')
                self.assertFalse(off['state']['active'])
                self.assertEqual(off['state']['builds'],0)
                page.locator('#fxBtn').evaluate('button=>button.click()')
                page.evaluate('reflectionFrames(3)')
                full=page.evaluate('reflectionProbe()')
                self.assertTrue(full['state']['active'])
                self.assertEqual(full['state']['quality'],'full')
                self.assertEqual(full['state']['builds'],1)
                self.assertNotEqual(full['hash'],off['hash'])
                point=page.evaluate('()=>[[1000,340],[900,340],[1100,350]].find(([x,y])=>CodaArcadeQA.walkable(x,y))')
                self.assertIsNotNone(point)
                self.assertTrue(page.evaluate('p=>CodaArcadeQA.place(...p)',point))
                page.evaluate('reflectionFrames(12)')
                actors=page.evaluate('reflectionProbe()')
                self.assertGreater(actors['visible'],100,'Reflections below actors must preserve the visible avatar')
                self.assertEqual(actors['hash'],full['hash'],'Moving live actors must not enter the reflected source')
                self.assertEqual(actors['state']['builds'],1,'Ordinary frames must reuse the backdrop projection')
                page.locator('#fxBtn').evaluate('button=>button.click()')
                page.evaluate('reflectionFrames(3)')
                lite=page.evaluate('reflectionProbe()')
                self.assertEqual(lite['state']['quality'],'lite')
                self.assertEqual(lite['state']['builds'],1)
                self.assertGreater(sum(full['pixel'][:3]),sum(lite['pixel'][:3]))
                self.assertGreater(sum(lite['pixel'][:3]),sum(off['pixel'][:3]))
                page.locator('#fxBtn').evaluate('button=>button.click()')
                page.evaluate('reflectionFrames(3)')
                final=page.evaluate('reflectionProbe()')
                self.assertFalse(final['state']['active'])
                self.assertEqual(final['hash'],off['hash'])
                self.assertEqual({off['nativeHash'],full['nativeHash'],actors['nativeHash'],lite['nativeHash'],final['nativeHash']},{off['nativeHash']})
                self.assertEqual(page.evaluate('CodaDeveloperConsole.getProject()'),current)
                record=page.evaluate('''()=>new Promise((resolve,reject)=>{const open=indexedDB.open('codaArcadeAssetStudioDB',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('layouts','readonly'),get=tx.objectStore('layouts').get('codaWorldProjectV1');get.onsuccess=()=>resolve(JSON.stringify(get.result));tx.oncomplete=()=>db.close();};})''')
                self.assertEqual(record,stored)
                self.assertEqual(errors,[])
                print(json.dumps({'gameFull':full['state'],'gameLite':lite['state'],'gameOff':final['state'],'visibleActorPixels':actors['visible'],'samples':[off['pixel'],lite['pixel'],full['pixel']],'savedProjectUnchanged':True,'nativeSourceUnchanged':True}))
                context.close();browser.close()
        finally:
            server.shutdown();server.server_close()

    def test_real_backdrop_projects_colored_reflections_without_mutating_the_source(self):
        server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(ROOT)))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
                page=browser.new_page()
                page.route('**/reflection-test',lambda route:route.fulfill(content_type='text/html',body='<!doctype html><script src="/wall-reflections.js"></script>'))
                page.goto(f'http://127.0.0.1:{server.server_port}/reflection-test')
                actual=page.evaluate('''async()=>{
 const source=document.createElement('canvas');source.width=1672;source.height=941;
 const image=new Image();image.src='/assets/environment/v1/empty-arcade.png';await image.decode();source.getContext('2d').drawImage(image,0,0);
 const before=source.toDataURL(),output=document.createElement('canvas');output.width=1672;output.height=941;const g=output.getContext('2d');let quality='full';
 const api=CodaWallReflections.create({document,getQuality:()=>quality});
 api.draw(g,source);const first=api.getState(),pixels=g.getImageData(0,0,1672,941).data;
 const regions={north:[500,128,692,200],hall:[1380,309,211,170],boutique:[359,427,322,79],dance:[725,650,82,150],northwest:[87,659,160,180]},counts={};
 for(const [name,[x,y,w,h]]of Object.entries(regions)){let count=0;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(pixels[(yy*1672+xx)*4+3]>0)count++;counts[name]=count;}
 let outside=0,colored=0;for(let y=0;y<941;y++)for(let x=0;x<1672;x++){const at=(y*1672+x)*4;if(!pixels[at+3])continue;if(!CodaWallReflections.isGlassFloor(x+.5,y+.5))outside++;if(Math.max(...pixels.slice(at,at+3))-Math.min(...pixels.slice(at,at+3))>30)colored++;}
 const alpha=(x,y)=>g.getImageData(x,y,1,1).data[3],full=alpha(820,180);
 g.clearRect(0,0,1672,941);quality='lite';api.draw(g,source);const lite=alpha(820,180),second=api.getState();
 g.clearRect(0,0,1672,941);quality='off';const off=api.draw(g,source),offPixels=g.getImageData(0,0,1672,941).data.some(v=>v!==0);
 const protectedPoints=[[70,665],[64,690],[100,620],[170,700],[85,650],[85,665],[85,705],[85,800],[200,650],[246,658]].map(([x,y])=>({x,y,alpha:pixels[(y*1672+x)*4+3]}));
 const westGlass={x:90,y:730,glass:CodaWallReflections.isGlassFloor(90,730),alpha:pixels[(730*1672+90)*4+3]};
 return {first,second,counts,outside,colored,protectedPoints,westGlass,sourceUnchanged:before===source.toDataURL(),full,lite,off,offPixels};
}''')
                self.assertTrue(actual['sourceUnchanged'])
                self.assertIsNone(actual['first']['error'])
                self.assertEqual(actual['first']['builds'],1)
                self.assertEqual(actual['second']['builds'],1,'Lite should reuse the same cached projection')
                self.assertEqual(actual['outside'],0,'No reflection may leak onto protected architecture/carpet/tiles')
                self.assertGreater(actual['colored'],1000)
                for region,count in actual['counts'].items():self.assertGreater(count,300,region)
                for point in actual['protectedPoints']:self.assertEqual(point['alpha'],0,point)
                self.assertTrue(actual['westGlass']['glass'],actual['westGlass'])
                self.assertGreater(actual['westGlass']['alpha'],0,'Reflections reach the glass below the west rail')
                self.assertGreater(actual['full'],actual['lite'])
                self.assertFalse(actual['off'])
                self.assertFalse(actual['offPixels'])
                print(json.dumps(actual))
                browser.close()
        finally:
            server.shutdown();server.server_close()

if __name__=='__main__':unittest.main(verbosity=2)
