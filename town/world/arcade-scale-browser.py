"""Arcade exterior uses the interior's shape in character-relative town units."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1700, 'height':1200})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const appURL=document.querySelector('script[type="module"]').src,app=await(await fetch(appURL)).text();
          const runtimeURL=dependency(app,'runtime',appURL),modelURL=dependency(app,'model',appURL),catalogURL=dependency(app,'catalog',appURL),catalogSource=await(await fetch(catalogURL)).text();
          const arcadeURL=dependency(catalogSource,'arcade',catalogURL),arcadeSource=await(await fetch(arcadeURL)).text();
          const geometryURL=dependency(arcadeSource,'arcade-geometry',arcadeURL);
          const {arcadeGeometry,arcadeFootprint,arcadePointToInterior,arcadePointFromInterior,arcadeFrontAtX}=await import(geometryURL);
          const {render,resizeSurface,movePlayer,PLAYER_SCALE}=await import(runtimeURL),{blank,blocked,parseProject}=await import(modelURL),catalog=townBuilder.catalog;
          const a=catalog.get('coda-arcade'),s=a.interiorScale,f=arcadeFootprint;
          if(s!==2.5||s!==PLAYER_SCALE||a.w!==4180||a.h!==2603||!a.fixedScale)throw Error('Arcade did not adopt the town character scale.');
          if(JSON.stringify(a.polygons)!==JSON.stringify(arcadeGeometry.polygons))throw Error('Catalog floor differs from authoritative converted polygons.');
          for(let i=0;i<f.floorPolys.length;i++)for(let j=0;j<f.floorPolys[i].length;j++){
            const [x,y]=a.polygons[i][j],p=arcadePointToInterior({x,y}),expected=f.floorPolys[i][j];
            if(p.x!==expected[0]||p.y!==expected[1])throw Error('Floor shape changed rather than converting units.');
          }
          if(a.footprint.w/s!==f.bounds.w||a.footprint.h/s!==f.bounds.h)throw Error('Wrong physical floor bounds.');
          const d=blank(),o={id:'arcade',asset:'coda-arcade',x:8192,y:8192,scale:1,rotation:0,collision:true,layer:'objects'};d.objects.push(o);
          let points=0;
          for(let y=0;y<f.height;y+=31)for(let x=0;x<f.width;x+=31){
            const q=arcadePointFromInterior({x,y});if(blocked(d,o.x-a.w/2+q.x,o.y-a.h+q.y,catalog)!==f.contains(x,y))throw Error('Floor collision lost its exact inside/outside shape.');points++;
          }
          const checks=[];
          function marker(objects,actor){
            const c=document.createElement('canvas');c.width=c.height=300;
            render(c.getContext('2d'),{...d,objects},{x:actor.x,y:actor.y-50,zoom:1},300,300,{player:actor,drawPlayer:(ctx,x,y)=>{ctx.fillStyle='#ff00ff';ctx.fillRect(x-20,y-110,40,110);}});
            const data=c.getContext('2d').getImageData(0,0,300,300).data;let pixels=0;
            for(let i=0;i<data.length;i+=4)if(data[i]===255&&data[i+1]===0&&data[i+2]===255)pixels++;
            return pixels;
          }
          for(const nativeX of [400,1000,1477]){
            const localX=nativeX*s,front=arcadeFrontAtX(localX),actor={x:o.x-a.w/2+localX,y:o.y-a.h+front+2};
            if(blocked(d,actor.x,actor.y,catalog))throw Error('Foreground probe is inside the building.');
            const expected=marker([],actor),visible=marker([o],actor);
            checks.push({nativeX,expected,visible,passed:expected===visible});
          }
          if(checks.some(q=>!q.passed))throw Error('Arcade transparent padding occludes a foreground actor: '+JSON.stringify(checks));
          const rearPoint=arcadePointFromInterior({x:1477,y:210}),rear={x:o.x-a.w/2+rearPoint.x,y:o.y-a.h+rearPoint.y};
          if(blocked(d,rear.x,rear.y,catalog))throw Error('Rear probe is inside the floor.');
          const rearExpected=marker([],rear),rearVisible=marker([o],rear);
          if(rearVisible>=rearExpected)throw Error('Rear actor incorrectly draws over the building.');
          checks.push({kind:'behind building',expected:rearExpected,visible:rearVisible,passed:rearVisible<rearExpected});
          const localX=f.entrance.x*s,front=arcadeFrontAtX(localX),actor={x:o.x-a.w/2+localX,y:o.y-a.h+front+180};
          for(let i=0;i<50;i++)movePlayer(d,actor,new Set(['w','shift']),.02,catalog);
          const gap=actor.y-(o.y-a.h+front);if(gap<0||gap>2)throw Error('Invisible collision gap prevents approaching the entrance.');
          parseProject(JSON.stringify(d),new Set(catalog.keys()));
          const profile=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE}),avatar=profile.normalizeProfile({});
          function image(doc,cam,actor){
            const c=document.createElement('canvas');c.style.cssText='width:800px;height:520px;position:absolute;left:-10000px';document.body.append(c);
            const{ctx,width,height}=resizeSurface(c);render(ctx,doc,cam,width,height,{player:actor,drawPlayer:(g,x,y)=>profile.drawPlayer(g,avatar,{x,y,facing:'up',walking:false,phase:0},0)});
            const url=c.toDataURL();c.remove();return url;
          }
          const home=catalog.get('estate-bach'),house=blank(),h={id:'home',asset:home.id,x:8192,y:8192,scale:1,rotation:0,collision:true,layer:'ground'};house.objects.push(h);
          const homeActor={x:h.x,y:h.y-home.h+home.h*.78};
          const gallery=[
            {label:'Arcade · full interior floor at town scale',url:image(d,{x:o.x,y:o.y-a.h/2,zoom:.18},actor)},
            {label:'NPC home · same character and camera scale',url:image(house,{x:h.x,y:h.y-home.h/2,zoom:.18},homeActor)},
            {label:'Arcade entrance · character fits the door',url:image(d,{x:actor.x,y:actor.y-160,zoom:.8},actor)},
            {label:'NPC porch · same character scale',url:image(house,{x:homeActor.x,y:homeActor.y-120,zoom:.8},homeActor)}
          ];
          return {project:d,runtimeURL,gallery,checks,points,gap};
        }''')
        page.locator('#file').set_input_files({'name':'arcade-scale.json','mimeType':'application/json','buffer':json.dumps(result['project']).encode()})
        page.wait_for_function('townBuilder.project.name==="My Coda Town"&&townBuilder.project.objects.length===1')
        capture='''async({url,game})=>{const{render}=await import(url),c=document.createElement('canvas');c.width=900;c.height=650;const g=c.getContext('2d');g.imageSmoothingEnabled=false;render(g,game?townGame.project:townBuilder.project,{x:8192,y:6890,zoom:.2},900,650);return c.toDataURL();}'''
        before=page.evaluate(capture,{'url':result['runtimeURL'],'game':False})
        page.locator('#play').click();page.wait_for_function('!!window.townGame')
        assert before==page.evaluate(capture,{'url':result['runtimeURL'],'game':True}), 'Arcade editor/game pixels differ.'
        page.evaluate('''samples=>{
          document.querySelectorAll('body>*').forEach(e=>e.style.display='none');const grid=document.createElement('div');grid.id='arcadeScaleGallery';
          grid.style.cssText='display:grid;grid-template-columns:repeat(2,800px);gap:12px;padding:12px;width:1636px;background:#20382b;color:#f5e3ba;font:20px Georgia';
          for(const s of samples){const tile=document.createElement('div'),image=document.createElement('img');image.src=s.url;image.width=800;image.height=520;image.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(s.label),image);grid.append(tile);}document.body.append(grid);
        }''',result['gallery'])
        page.locator('#arcadeScaleGallery').screenshot(path=str(ROOT/'docs/town-preview/arcade-scale.png'))
        print(json.dumps({key:result[key] for key in ['points','checks','gap']}))
        assert not errors,errors;browser.close()
finally:
    server.shutdown()

print('Arcade scale, exact converted interior collision, foreground visibility, door approach and editor/game parity passed.')
