"""Actual walk-test/game actor proportions, travel speed, gait and foot anchor."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import math
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
fixture = {'version': 1, 'name': 'Town character scale', 'spawn': {'x': 8192, 'y': 6144},
           'cells': {}, 'edges': {}, 'objects': []}
profile = {'skin': '#b98562', 'hair': '#54352b', 'hairstyle': 'bob', 'shirt': '#b7534e',
           'lowerColor': '#46566e', 'outfit': 'coat', 'headwear': 'straw', 'shoes': 'boots'}

# Only the app's named frame callback is controlled. Playwright's own animation
# polling and browser timers remain live, including normal project autosave.
instrument = '''(() => {
  const nativeRAF=requestAnimationFrame.bind(window);let queue=[],clock=null,id=0;
  window.requestAnimationFrame=cb=>cb.name==='frame'?(queue.push(cb),--id):nativeRAF(cb);
  window.__advance=count=>{if(clock===null)clock=performance.now();for(let i=0;i<count;i++){
    clock+=1000/60;const callbacks=queue;queue=[];for(const cb of callbacks)cb(clock);
  }};
  let wrapped;
  Object.defineProperty(window,'createCodaCharacterRenderer',{configurable:true,
    get:()=>wrapped,set:factory=>{
      window.__characterFactory=factory;
      wrapped=api=>{const renderer=factory(api),draw=renderer.drawPlayer;
        renderer.drawPlayer=(ctx,profile,motion,time)=>{
          window.__lastActor={api:{...api},profile:{...profile},motion:{...motion},time};
          return draw(ctx,profile,motion,time);
        };return renderer;
      };
    }});
})();'''

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1600, 'height': 1050})
        page.add_init_script(instrument)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        urls = page.evaluate('''async()=>{
          const url=document.querySelector('script[type="module"]').src,code=await(await fetch(url)).text();
          const dependency=name=>new URL(code.split(String.fromCharCode(10)).find(l=>l.includes(name+'.mjs')).split("'")[1],url).href;
          const runtime=dependency('runtime'),r=await(await fetch(runtime)).text();
          return {runtime,settings:new URL(r.split(String.fromCharCode(10)).find(l=>l.includes('player-settings.mjs')).split("'")[1],runtime).href};
        }''')
        settings = page.evaluate('async url=>{const m=await import(url);return {scale:m.PLAYER_SCALE,walk:m.WALK_SPEED,run:m.RUN_SPEED,gait:m.GAIT_PER_PIXEL};}', urls['settings'])
        assert settings == {'scale': 2.5, 'walk': 450, 'run': 780, 'gait': math.pi * 2 / 256}

        def advance(count=1):
            page.evaluate('(n)=>__advance(n)', count)

        def actor():
            return page.evaluate('__lastActor')

        def load(doc):
            page.locator('#file').set_input_files({'name': 'walk.json', 'mimeType': 'application/json', 'buffer': json.dumps(doc).encode()})
            page.wait_for_function('(name)=>townBuilder.project.name===name', arg=doc['name'])

        load(fixture)
        page.locator('#walk').click()
        advance()
        first = actor()
        assert first['api']['worldScale'] == 2.5

        # Compare actual opaque body bounds with the unscaled arcade renderer.
        bounds = page.evaluate('''()=>{
          function box(scale){const c=document.createElement('canvas');c.width=c.height=512;
            const g=c.getContext('2d'),r=__characterFactory({worldScale:scale});
            r.drawPlayer(g,__lastActor.profile,{x:256,y:350,facing:'down',walking:false,phase:0},0);
            const data=g.getImageData(0,0,512,512).data;let x0=512,y0=512,x1=-1,y1=-1;
            for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*4+3]>=250){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
            return {w:x1-x0+1,h:y1-y0+1,bottom:y1,top:y0};}
          return {native:box(1),town:box(__lastActor.api.worldScale)};
        }''')
        assert 2.4 < bounds['town']['h'] / bounds['native']['h'] < 2.6, bounds
        assert bounds['town']['h'] >= 110, bounds
        assert 349 <= bounds['town']['bottom'] <= 355, bounds

        def travel(keys, speed):
            before = actor()['motion']
            for key in keys:
                page.keyboard.down(key)
            advance(60)
            for key in reversed(keys):
                page.keyboard.up(key)
            after = actor()['motion']
            distance = math.hypot(after['x'] - before['x'], after['y'] - before['y'])
            assert abs(distance - speed) < .02, (keys, distance, speed)
            expected = (before['phase'] + distance * settings['gait']) % (2 * math.pi)
            assert abs(after['phase'] - expected) < 1e-7, (after, expected)
            assert after['walking']
            advance()
            assert not actor()['motion']['walking']
            assert abs(actor()['motion']['phase'] - after['phase']) < 1e-8
            return distance

        measured = {'walk': travel(['d'], 450), 'run': travel(['Shift', 'd'], 780),
                    'diagonal': travel(['w', 'd'], 450)}
        page.locator('#walk').click()

        # A raised floor changes the foot projection, not the actor's proportions.
        raised = json.loads(json.dumps(fixture))
        raised['name'] = 'Raised character anchor'
        raised['cells'] = {f'{x},{y}': {'surface': 'grass', 'level': 2}
                           for x in range(120, 181) for y in range(88, 105)}
        load(raised)
        page.locator('#walk').click()
        advance()
        anchored = actor()
        assert anchored['motion']['x'] == 8192 and anchored['motion']['y'] == 6144 - 96, anchored
        assert anchored['api']['worldScale'] == settings['scale']

        # Standalone test pages receive the same origin-checked avatar bridge.
        page.evaluate('(avatar)=>postMessage({type:"coda-town-state-result",avatar},location.origin)', profile)
        page.wait_for_timeout(30)
        advance()
        assert all(actor()['profile'][key] == value for key, value in profile.items())
        directions = page.evaluate('''()=>{const r=__characterFactory(__lastActor.api);return ['down','left','up','right'].map(facing=>{
          const c=document.createElement('canvas');c.width=c.height=256;r.drawPlayer(c.getContext('2d'),__lastActor.profile,{x:128,y:200,facing,walking:true,phase:1},0);return c.toDataURL();});}''')
        assert len(set(directions)) == 4

        capture = '''async ({url,game})=>{const{render}=await import(url),d=game?townGame.project:townBuilder.project;
          const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
          const r=__characterFactory(__lastActor.api),profile=__lastActor.profile;
          render(g,d,{x:8192,y:6048,zoom:.8},800,600,{player:{x:8192,y:6144},drawPlayer:(ctx,x,y)=>r.drawPlayer(ctx,profile,{x,y,facing:'down',walking:false,phase:0},0)});return c.toDataURL();}'''
        before = page.evaluate(capture, {'url': urls['runtime'], 'game': False})
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame')
        advance()
        assert actor()['api']['worldScale'] == settings['scale']
        assert actor()['motion']['y'] == 6144 - 96
        page.evaluate('(avatar)=>postMessage({type:"coda-town-state-result",avatar},location.origin)', profile)
        page.wait_for_timeout(30)
        advance()
        assert before == page.evaluate(capture, {'url': urls['runtime'], 'game': True})

        # Actual gameplay keyboard motion uses the same speeds (on the raised floor).
        travel(['d'], 450)
        travel(['Shift', 'd'], 780)

        samples = page.evaluate('''async url=>{
          const{render,catalog}=await import(url),make=()=>({version:1,name:'Character scale',spawn:{x:8192,y:6144},cells:{},edges:{},objects:[]});
          const square=make();square.objects.push({id:'square',asset:'music-square',x:8192,y:7168,scale:1,rotation:0,collision:true,layer:'ground'});
          const garden=make(),estate=catalog.get('estate-bach');garden.objects.push({id:'home',asset:'estate-bach',x:8192,y:7168,scale:1,rotation:0,collision:true,layer:'ground'});
          function sample(label,d,cam,p,scale,look){const c=document.createElement('canvas');c.width=320;c.height=240;const g=c.getContext('2d');g.setTransform(.5,0,0,.5,0,0);g.imageSmoothingEnabled=false;
            const r=__characterFactory({worldScale:scale});render(g,d,cam,640,480,{player:p,drawPlayer:(ctx,x,y)=>r.drawPlayer(ctx,look,{x,y,facing:'down',walking:false,phase:0},0)});return{label,url:c.toDataURL()};}
          const plain=__characterFactory({}).normalizeProfile({}),benchPoint={x:7600,y:5960},benchCam={x:7600,y:5820,zoom:1};
          const props=make();props.objects.push({id:'bench',asset:'props-1-150',x:8100,y:6130,scale:1,rotation:0,collision:true,layer:'objects'},
            {id:'tree',asset:'trees-0-480',x:8490,y:6250,scale:1,rotation:0,collision:true,layer:'objects'});
          return[sample('Before · native character size',square,benchCam,benchPoint,1,plain),sample('Town scale · same bench and camera',square,benchCam,benchPoint,2.5,plain),
            sample('Town scale · home porch and garden',garden,{x:8192,y:6700,zoom:.8},{x:8192,y:6820},2.5,__lastActor.profile),
            sample('Town scale · bench and full-size tree',props,{x:8250,y:6010,zoom:.8},{x:8220,y:6144},2.5,__lastActor.profile)];
        }''', urls['runtime'])
        page.evaluate('''samples=>{document.querySelectorAll('body>*').forEach(e=>e.style.display='none');
          const gallery=document.createElement('div');gallery.id='walkGallery';gallery.style.cssText='display:grid;grid-template-columns:repeat(2,640px);gap:12px;padding:12px;width:1316px;background:#20382b;color:#f5e3ba;font:20px Georgia';
          for(const s of samples){const tile=document.createElement('div'),img=document.createElement('img');img.src=s.url;img.width=640;img.height=480;img.style.cssText='display:block;image-rendering:pixelated;margin-top:8px';tile.append(document.createTextNode(s.label),img);gallery.append(tile);}document.body.append(gallery);
        }''', samples)
        page.locator('#walkGallery').screenshot(path=str(ROOT / 'docs/town-preview/walk-player.png'))
        assert not errors, errors
        browser.close()
        print(json.dumps({'body_bounds': bounds, 'measured_one_second': measured}))
finally:
    server.shutdown()

print('Walk test and gameplay share enlarged actors, faster travel, distance-based gait, cosmetics, foot anchors and exact scene pixels.')
