"""Smaller NPC homes, open yards and unchanged arcade geometry in both modes."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--structural-only', action='store_true', help='Check dimensions and collision before final art is ready.')
args = parser.parse_args()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1600, 'height':1200})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        result = page.evaluate('''async()=>{
          const dependency=(code,name,parent)=>new URL(code.split(String.fromCharCode(10)).find(line=>line.includes(name+'.mjs')).split("'")[1],parent).href;
          const appURL=document.querySelector('script[type="module"]').src,app=await(await fetch(appURL)).text();
          const catalogURL=dependency(app,'catalog',appURL),catalogCode=await(await fetch(catalogURL)).text();
          const runtimeURL=dependency(app,'runtime',appURL),modelURL=dependency(app,'model',appURL);
          const {estateDefinitions}=await import(dependency(catalogCode,'estates',catalogURL));
          const {estateArt}=await import(dependency(catalogCode,'detail-art',catalogURL));
          const {blocked,parseProject}=await import(modelURL),{render,resizeSurface}=await import(runtimeURL),catalog=townBuilder.catalog;
          const checks=[],doc={version:1,name:'Open home estates',spawn:{x:8192,y:12000},cells:{},edges:{},objects:[]};
          const expectedIds=estateDefinitions.map(d=>'estate-'+d.id),actualIds=[...catalog.keys()].filter(id=>id.startsWith('estate-'));
          if(JSON.stringify(actualIds)!==JSON.stringify(expectedIds))throw Error('Saved estate asset identifiers changed.');
          if(estateArt.length!==19)throw Error('Native home artwork is incomplete.');
          for(const [i,def]of estateDefinitions.entries()){
            const id='estate-'+def.id,a=catalog.get(id),image=estateArt[def.index],object={id:'open-'+def.id,asset:id,x:1600+i%5*2800,y:2300+Math.floor(i/5)*2600,scale:1,rotation:0,collision:true,layer:'ground'};
            if(a.w!==def.size||a.h!==def.size)throw Error('Wrong rendered home size: '+id);
            if(def.id==='player'?a.w!==2048:Math.abs(a.w/def.sourceSize-.85)>.001)throw Error('Wrong home scale: '+id);
            if(image.naturalWidth<1024||image.naturalHeight<1024||image.naturalWidth!==image.naturalHeight)throw Error('Home artwork lost native detail or aspect ratio: '+id);
            const test={version:1,name:'Collision fixture',cells:{},edges:{},objects:[object],spawn:doc.spawn};
            const solid=(u,v)=>blocked(test,object.x+(u-.5)*a.w,object.y+(v-1)*a.h,catalog);
            if(!solid(.5,.4)||!solid(.5,def.front-.02))throw Error('House became walk-through: '+id);
            if(['clara','nina','vee-jay','player'].includes(def.id)&&!solid(.91,.4))throw Error('House wing lost collision: '+id);
            for(const[u,v]of [[.045,.7],[.955,.7],[.2,.91],[.8,.91],[.045,.12],[.955,.12],[.5,.9],[.5,.75]])if(solid(u,v))throw Error('Former perimeter remains blocked: '+id+' '+u+','+v);
            doc.objects.push(object);checks.push({id,size:a.w,native:image.naturalWidth,openYard:true,solidHouse:true});
          }
          const arcade=catalog.get('coda-arcade'),f=window.CodaArcadeFootprint;
          if(arcade.w!==1672||arcade.h!==1041||!arcade.fixedScale||arcade.footprint.w!==1512||arcade.footprint.h!==685)throw Error('Arcade size changed.');
          if(JSON.stringify(arcade.polygons)!==JSON.stringify(f.floorPolys.map(poly=>poly.map(([x,y])=>[x,y+100]))))throw Error('Arcade no longer matches its exact interior polygon.');
          doc.objects.push({id:'unchanged-arcade',asset:'coda-arcade',x:14500,y:11600,scale:1,rotation:0,collision:true,layer:'objects'});
          parseProject(JSON.stringify(doc),new Set(catalog.keys()));
          function capture(d,cam,w=480,h=520){
            const c=document.createElement('canvas');c.style.cssText=`width:${w}px;height:${h}px;position:absolute;left:-10000px`;document.body.append(c);
            const{ctx,width,height}=resizeSurface(c);render(ctx,d,cam,width,height);const url=c.toDataURL();c.remove();return url;
          }
          const gallery=[];
          for(const [id,label]of [['estate-haydn','Haydn · smaller home'],['estate-bach','Bach · smaller home'],['coda-arcade','Coda Arcade · same size'],['estate-mozart','Mozart · smaller home'],['estate-beethoven','Beethoven · smaller manor'],['estate-player','Your home · same size']]){
            const a=catalog.get(id),d={...doc,cells:{},edges:{},objects:[{id:'preview',asset:id,x:8192,y:8192,scale:1,rotation:0,collision:true,layer:a.layer}]};
            gallery.push({label,url:capture(d,{x:8192,y:8192-a.h/2,zoom:.21})});
          }
          return {checks,project:doc,runtimeURL,gallery};
        }''')
        for check in result['checks']:
            print(json.dumps(check), flush=True)
        if not args.structural_only:
            page.locator('#file').set_input_files({'name':'open-homes.json','mimeType':'application/json','buffer':json.dumps(result['project']).encode()})
            page.wait_for_function('townBuilder.project.name==="Open home estates"')
            snapshot='''async({url,game})=>{
              const{render,resizeSurface}=await import(url),c=document.createElement('canvas');c.style.cssText='width:1000px;height:700px;position:absolute;left:-10000px';document.body.append(c);
              const{ctx,width,height}=resizeSurface(c);render(ctx,game?townGame.project:townBuilder.project,{x:7200,y:3800,zoom:.24},width,height);const image=c.toDataURL();c.remove();return image;
            }'''
            before_project=page.evaluate('JSON.stringify(townBuilder.project)')
            before=page.evaluate(snapshot,{'url':result['runtimeURL'],'game':False})
            page.locator('#play').click()
            page.wait_for_function('!!window.townGame')
            assert page.evaluate('JSON.stringify(townGame.project)')==before_project, 'Saved home identifiers, positions or scales changed.'
            assert page.evaluate(snapshot,{'url':result['runtimeURL'],'game':True})==before, 'Editor/game home rendering differs.'
            page.evaluate('''samples=>{
              document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
              const g=document.createElement('div');g.id='openEstateGallery';g.style.cssText='display:grid;grid-template-columns:repeat(3,480px);gap:12px;background:#20382b;padding:12px;width:1476px;color:#f5e3ba;font:20px Georgia';
              for(const s of samples){const tile=document.createElement('div'),image=document.createElement('img');image.src=s.url;image.width=480;image.height=520;image.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(s.label),image);g.append(tile);}document.body.append(g);
            }''',result['gallery'])
            page.locator('#openEstateGallery').screenshot(path=str(ROOT/'docs/town-preview/open-estates.png'))
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()

print('All19 home dimensions and open-yard collision pass; arcade exact geometry retained.' if args.structural_only else 'Open homes passed: native detail, reduced NPC sizes, walkable former boundaries, saved placement identity, arcade geometry and editor/game pixel parity.')
