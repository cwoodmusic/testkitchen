"""Native-frame continuity checks for room cinematics, including slower devices.

No virtual clock or mutable game hooks are used. The retained JSON reports
frame gaps and browser work as evidence; timing-sensitive FPS thresholds are
intentionally avoided in favor of visible movement/camera continuity.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import math
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/cutscene-performance'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('quiet_bell_ui',ROOT/'tests/rhythm-blocks-browser.py')
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)


def metrics(cdp):
    return {item['name']:item['value'] for item in cdp.send('Performance.getMetrics')['metrics']}


def percentile(values,fraction):
    return sorted(values)[min(len(values)-1,int(len(values)*fraction))] if values else 0


def observe(page,duration_ms=7500):
    return page.evaluate('''duration=>new Promise(resolve=>{
      const frames=[];let started=performance.now(),previous=started;
      function sample(now){
        const state=window.quietBell?.cutscene,camera=window.quietBell?.camera;
        frames.push({at:now,delta:now-previous,index:state?.index,tile:state?.currentTile,
          actors:state?.actors?.map(actor=>({id:actor.id,x:actor.x,y:actor.y,moving:actor.moving})),camera});
        previous=now;
        if(now-started<duration)requestAnimationFrame(sample);else resolve(frames);
      }requestAnimationFrame(sample);
    })''',duration_ms)



def rendered_motion(page):
    """Check composited sprites actually follow the observed moving feet."""
    return page.evaluate('''()=>new Promise(resolve=>{
      const samples=[];let attempts=0;
      function sample(){
        const state=window.quietBell?.cutscene,scene=window.quietBell?.scene;
        const actor=state?.actors.find(actor=>actor.moving&&actor.id!=='mira');
        if(actor&&scene){
          const definition=scene.actors.find(item=>item.id===actor.id);
          const sprite=window.quietBell.project.cast[definition.character];
          const map=document.getElementById('room-map').getBoundingClientRect();
          const rect=document.querySelector('[data-actor="'+actor.id+'"]').getBoundingClientRect();
          const scale=map.width/scene.geometry.width;
          const foot={x:rect.left+rect.width*sprite.anchor[0],y:rect.top+rect.height*sprite.anchor[1]};
          const expected={x:map.left+actor.x*scale,y:map.top+actor.y*scale};
          samples.push({id:actor.id,x:actor.x,y:actor.y,foot,expected,error:Math.hypot(foot.x-expected.x,foot.y-expected.y)});
        }
        if(samples.length>=5||++attempts>=60)resolve(samples);else requestAnimationFrame(sample);
      }requestAnimationFrame(sample);
    })''')


def analyze(frames,speed):
    gaps=[frame['delta'] for frame in frames[1:]]
    world_steps=[];camera_steps=[];moving_samples={};transitions=[]
    for previous,current in zip(frames,frames[1:]):
        old_actors={actor['id']:actor for actor in previous.get('actors') or []}
        for actor in current.get('actors') or []:
            old=old_actors.get(actor['id'])
            if not old:continue
            step=math.hypot(actor['x']-old['x'],actor['y']-old['y'])
            world_steps.append(step)
            if step>.1:moving_samples[actor['id']]=moving_samples.get(actor['id'],0)+1
            assert step<=speed*max(0,current['delta'])/1000+5, ('Actor teleported between native frames',actor['id'],step,current['delta'])
        if previous.get('camera') and current.get('camera'):
            first,second=previous['camera'],current['camera']
            step=math.hypot(second['offsetX']-first['offsetX'],second['offsetY']-first['offsetY'])
            camera_steps.append(step)
            assert step<100, ('Camera snapped between speakers',step,current['delta'])
        if current.get('index')!=previous.get('index'):
            transitions.append({'from':previous.get('index'),'to':current.get('index'),'at':current['at']})
    assert sum(moving_samples.values())>=12, ('Movement needs intermediate rendered positions',moving_samples)
    assert transitions, 'The observation must include a real speaker handoff.'
    return {'frames':len(frames),'p50FrameMs':percentile(gaps,.5),'p95FrameMs':percentile(gaps,.95),
            'maxFrameMs':max(gaps),'maxWorldStep':max(world_steps,default=0),
            'maxCameraStep':max(camera_steps,default=0),'movingSamples':moving_samples,'speakerTransitions':transitions}


class PublicBrowser:
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        context=self.browser.new_context(ignore_https_errors=True,**options)
        original=context.route
        def route(pattern,handler):
            def handle(request_route):
                if request_route.request.url.split('?')[0].endswith('/favicon.ico'):request_route.fulfill(status=204)
                else:handler(request_route)
            original(pattern,handle)
        context.route=route
        return context



def dialogue_layout(page):
    return page.evaluate('''()=>{
      const state=quietBell.cutscene,scene=quietBell.scene;
      return{index:state.index,panelTop:document.getElementById('cutscene-panel').getBoundingClientRect().top,
        viewportTop:document.getElementById('room-scene').getBoundingClientRect().top,
        sizes:Object.fromEntries([...scene.actors.map(actor=>[actor.id,actor.worldSize]),['mira',quietBell.project.player.worldSize]])};
    }''')


def assert_dialogue_clearance(frames,layouts):
    by_index={item['index']:item for item in layouts};checked=0;minimum_gap=float('inf')
    for frame in frames:
        layout=by_index.get(frame.get('index'));camera=frame.get('camera')
        if not layout or not camera:continue
        for actor in frame.get('actors') or []:
            size=layout['sizes'][actor['id']];foot=layout['viewportTop']+camera['offsetY']+actor['y']*camera['scale']
            top=foot-size*camera['scale'];bottom=foot+size*.12*camera['scale']
            assert top>=layout['viewportTop']-1, ('Character cropped above room',actor,top,layout)
            assert bottom<=layout['panelTop']+1, ('Dialogue covers character',actor,bottom,layout,frame)
            minimum_gap=min(minimum_gap,layout['panelTop']-bottom);checked+=1
    assert checked>0
    return{'actorSamplesAboveDialogue':checked,'minimumConservativeGap':minimum_gap}


def scenario(browser,url,name,width,height,cpu,reduced='no-preference',preview=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'light',height=height,
        virtual_walk=False,skip_cutscenes=False,reduced_motion=reduced)
    page.evaluate('document.fonts.ready')
    cdp=context.new_cdp_session(page);cdp.send('Performance.enable')
    cdp.send('Emulation.setCPUThrottlingRate',{'rate':cpu})
    if preview:
        page.locator('#cutscene-skip').click();page.keyboard.press('F2')
        page.locator('[data-dev-tab="cutscene"]').click();page.locator('#developer-cutscene-play').click()
        page.wait_for_function('!!window.quietBell?.cutscene?.preview')
    else:
        # Explicit replay starts all measurements from the same authored frame.
        page.locator('#cutscene-skip').click();page.locator('#menu').click();page.locator('#replay-cutscene').click()
        page.wait_for_function('!!window.quietBell?.cutscene')
    speed=page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)')
    # Check composited feet while the fresh replay is certainly still walking;
    # keep the DOM reads outside the measured interval.
    visible=rendered_motion(page)
    assert len(visible)>=5, ('Expected real sprite movement',visible)
    assert max(item['error'] for item in visible)<3, ('Rendered sprite is stale or misplaced',visible)
    assert math.hypot(visible[-1]['x']-visible[0]['x'],visible[-1]['y']-visible[0]['y'])>1, visible
    layout_start=dialogue_layout(page)
    before=metrics(cdp);frames=observe(page);after=metrics(cdp)
    clearance=assert_dialogue_clearance(frames,[layout_start,dialogue_layout(page)])
    result={'name':name,'width':width,'height':height,'cpuThrottle':cpu,'reducedMotion':reduced,
            'preview':preview,'playbackRate':page.evaluate('quietBell.cutscene?.playbackRate??1'),'releaseBase':page.evaluate('document.baseURI'),**analyze(frames,speed),**clearance,'renderedFootSamples':visible,
            'browserWork':{key:after[key]-before[key] for key in ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','ScriptDuration','TaskDuration'] if key in before and key in after}}
    page.locator('#cutscene-skip').click() if not preview else page.locator('#developer-cutscene-stop').click()
    ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    (OUT/f'{name}-frames.json').write_text(json.dumps(frames)+'\n')
    context.close();return result



def early_next(browser,url):
    """Clicking Next during a walk queues the text advance without a teleport."""
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',height=768,
        virtual_walk=False,skip_cutscenes=False,reduced_motion='no-preference')
    cdp=context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    page.locator('#cutscene-skip').click();page.locator('#menu').click();page.locator('#replay-cutscene').click()
    before_resources=ui.resources(ui.state(page));before_journal=page.evaluate('quietBell.journey')
    if not page.evaluate('quietBell.cutscene.textComplete'):
        first_index=page.evaluate('quietBell.cutscene.index')
        page.locator('#cutscene-next').click()
        assert page.evaluate('quietBell.cutscene.textComplete')
        assert page.evaluate('quietBell.cutscene.index')==first_index
    layout_start=dialogue_layout(page)
    page.evaluate('''()=>{
      const button=document.getElementById('cutscene-next');
      button.addEventListener('click',()=>{window.__nextClick={before:window.quietBell.cutscene};},{capture:true,once:true});
      button.addEventListener('click',()=>{window.__nextClick.after=window.quietBell.cutscene;},{once:true});
    }''')
    page.locator('#cutscene-next').click()
    click=page.evaluate('window.__nextClick');before,after=click['before'],click['after']
    assert any(actor['moving'] for actor in before['actors']), before
    assert after['index']==before['index'] and after['nextPending'], click
    for actor in after['actors']:
        old=next(item for item in before['actors'] if item['id']==actor['id'])
        assert math.hypot(actor['x']-old['x'],actor['y']-old['y'])<.001, click
    assert page.locator('#cutscene-next').is_disabled()
    frames=page.evaluate('''index=>new Promise(resolve=>{
      const frames=[];let started=performance.now(),previous=started;
      function sample(now){
        const state=window.quietBell?.cutscene;
        frames.push({at:now,delta:now-previous,index:state?.index,tile:state?.currentTile,
          nextPending:state?.nextPending,actors:state?.actors?.map(actor=>({id:actor.id,x:actor.x,y:actor.y,moving:actor.moving})),camera:window.quietBell?.camera});
        previous=now;
        if(state&&state.index>index&&!state.nextPending||now-started>10000)resolve(frames);
        else requestAnimationFrame(sample);
      }requestAnimationFrame(sample);
    })''',before['index'])
    assert frames[-1]['index']>before['index'] and not frames[-1]['nextPending'], frames[-1]
    result={'name':'native-early-next-cpu4','releaseBase':page.evaluate('document.baseURI'),
            'firstClickRevealsText':True,'nextQueuedWithoutTeleport':True,
            **assert_dialogue_clearance(frames,[layout_start,dialogue_layout(page)]),**analyze(frames,page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)'))}
    assert ui.resources(ui.state(page))==before_resources
    assert page.evaluate('quietBell.journey')==before_journal
    page.locator('#cutscene-skip').click();ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    (OUT/'native-early-next-cpu4-frames.json').write_text(json.dumps(frames)+'\n')
    context.close();return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
    args=parser.parse_args();server=None
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with sync_playwright() as p:
            raw=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            browser=PublicBrowser(raw) if url.startswith('https:') else raw
            results=[scenario(browser,url,'native-phone-cpu4',390,844,4),
                     scenario(browser,url,'native-reduced',1024,768,1,reduced='reduce'),
                     scenario(browser,url,'native-preview-cpu4',1024,768,4,preview=True),
                     early_next(browser,url)]
            raw.close()
        if args.expect_release:
            assert all('/releases/'+args.expect_release+'/' in item['releaseBase'] for item in results), results
        result={'passed':True,'entry':url,'scenarios':results}
        name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/f'{name}-results.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
