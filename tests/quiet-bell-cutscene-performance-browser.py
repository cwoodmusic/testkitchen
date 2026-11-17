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
OUT=ROOT/'work/manual-dialogue-native'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('quiet_bell_ui',ROOT/'tests/rhythm-blocks-browser.py')
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)


def metrics(cdp):
    return {item['name']:item['value'] for item in cdp.send('Performance.getMetrics')['metrics']}


def percentile(values,fraction):
    return sorted(values)[min(len(values)-1,int(len(values)*fraction))] if values else 0


def wait_for_story(page):
    """Let the real doorway transport finish before measuring authored clips."""
    page.wait_for_function("window.quietBell?.cutscene?.phase==='story'", polling='raf')


def observe(page,duration_ms=7500,advance=False):
    """Record native RAF frames while optional real clicks advance manual text."""
    page.evaluate('''duration=>{
      window.__nativeObservation=new Promise(resolve=>{
        const frames=[];let started=performance.now(),previous=started;
        function sample(now){
          const state=window.quietBell?.cutscene,camera=window.quietBell?.camera;
          frames.push({at:now,delta:now-previous,index:state?.index,tile:state?.currentTile,
            manualDialogue:state?.manualDialogue,dialogueElapsed:state?.dialogueElapsed,
            actors:state?.actors?.map(actor=>({id:actor.id,x:actor.x,y:actor.y,moving:actor.moving,gait:actor.gait,gesture:actor.gesture,gestureProgress:actor.gestureProgress,emote:actor.emote})),camera});
          previous=now;
          if(now-started<duration)requestAnimationFrame(sample);else resolve(frames);
        }requestAnimationFrame(sample);
      });
    }''',duration_ms)
    if advance:
        # The first click reveals an unfinished line; the second moves to the
        # next line. Neither click is allowed to change the physical playhead.
        page.wait_for_timeout(1800);page.locator('#cutscene-next').click()
        page.wait_for_timeout(1800);page.locator('#cutscene-next').click()
    return page.evaluate('window.__nativeObservation')


def rendered_motion(page):
    """Check composited sprites actually follow the observed moving feet."""
    return page.evaluate('''async()=>{
      const {CAST}=await import(new URL('cast.mjs',document.baseURI));
      return new Promise(resolve=>{
        const samples=[];let attempts=0;
        function sample(){
          const state=window.quietBell?.cutscene,scene=window.quietBell?.scene;
          const actor=state?.actors.find(actor=>actor.moving&&actor.id!=='mira'&&!actor.gesture);
          if(actor&&scene){
            const definition=scene.actors.find(item=>item.id===actor.id);
            const sprite=window.quietBell.project.cast[definition.character];
            const node=document.querySelector('[data-actor="'+actor.id+'"]');
            const animated=node.dataset.spriteAnimated==='true',row=Number(node.dataset.spriteRow),frame=Number(node.dataset.frame);
            const walk=sprite.walk??CAST[definition.character]?.walk;
            const anchor=animated?walk?.anchors?.[row]?.[frame]??sprite.anchor:sprite.anchor;
            const map=document.getElementById('room-map').getBoundingClientRect(),rect=node.getBoundingClientRect();
            const scale=map.width/scene.geometry.width;
            const foot={x:rect.left+rect.width*anchor[0],y:rect.top+rect.height*anchor[1]};
            const expected={x:map.left+actor.x*scale,y:map.top+actor.y*scale};
            samples.push({id:actor.id,x:actor.x,y:actor.y,animated,row,frame,anchor,foot,expected,error:Math.hypot(foot.x-expected.x,foot.y-expected.y)});
          }
          if(samples.length>=5||++attempts>=60)resolve(samples);else requestAnimationFrame(sample);
        }requestAnimationFrame(sample);
      });
    }''')


def analyze(frames,speed,require_transition=True):
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
            multiplier=2 if actor.get('gait')=='run' or old.get('gait')=='run' else 1
            assert step<=speed*multiplier*max(0,current['delta'])/1000+5, ('Actor teleported between native frames',actor['id'],step,current['delta'],multiplier)
        if previous.get('camera') and current.get('camera'):
            first,second=previous['camera'],current['camera']
            step=math.hypot(second['offsetX']-first['offsetX'],second['offsetY']-first['offsetY'])
            camera_steps.append(step)
            assert step<100, ('Camera snapped between speakers',step,current['delta'])
        if current.get('index')!=previous.get('index'):
            transitions.append({'from':previous.get('index'),'to':current.get('index'),'at':current['at']})
    assert sum(moving_samples.values())>=12, ('Movement needs intermediate rendered positions',moving_samples)
    if require_transition:assert transitions, 'The observation must include a real speaker handoff.'
    return {'frames':len(frames),'p50FrameMs':percentile(gaps,.5),'p95FrameMs':percentile(gaps,.95),
            'maxFrameMs':max(gaps),'maxWorldStep':max(world_steps,default=0),
            'maxCameraStep':max(camera_steps,default=0),'movingSamples':moving_samples,'speakerTransitions':transitions}


class NativeAudioBrowser:
    """Observe genuine oscillators without replacing their sound behavior."""
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        context=self.browser.new_context(**options)
        context.add_init_script(r'''(()=>{
          window.__nativeCinematicStarts=[];
          const Native=window.AudioContext;if(!Native)return;
          let Wrapper;
          Wrapper=new Proxy(Native,{construct(target,args,newTarget){
            const context=Reflect.construct(target,args,newTarget===Wrapper?target:newTarget);
            const create=context.createOscillator;
            context.createOscillator=function(...args){
              const oscillator=create.apply(this,args);let frequency=null;
              const set=oscillator.frequency.setValueAtTime;
              oscillator.frequency.setValueAtTime=function(value,time){frequency=value;return set.call(this,value,time);};
              const start=oscillator.start;
              oscillator.start=function(when){
                window.__nativeCinematicStarts.push({at:performance.now(),frequency,when,now:context.currentTime});
                return start.call(this,when);
              };
              return oscillator;
            };
            return context;
          }});
          window.AudioContext=Wrapper;
        })();''')
        return context


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
        wait_for_story(page)
    speed=page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)')
    # Check composited feet while the fresh replay is certainly still walking;
    # keep the DOM reads outside the measured interval.
    visible=rendered_motion(page)
    assert len(visible)>=5, ('Expected real sprite movement',visible)
    assert max(item['error'] for item in visible)<3, ('Rendered sprite is stale or misplaced',visible)
    assert math.hypot(visible[-1]['x']-visible[0]['x'],visible[-1]['y']-visible[0]['y'])>1, visible
    layout_start=dialogue_layout(page)
    before=metrics(cdp);frames=observe(page,advance=not preview);after=metrics(cdp)
    clearance=assert_dialogue_clearance(frames,[layout_start,dialogue_layout(page)])
    gestures={}
    for frame in frames:
        for actor in frame.get('actors') or []:
            if actor.get('gesture'):gestures.setdefault(actor['id'],set()).add(actor['gesture'])
    if reduced=='reduce':
        assert gestures.get('pip',set())>={'trip','fallen','recover'}, ('Reduced motion must retain readable essential acting.',gestures)
        assert 'magnify' in gestures.get('iris',set()), ('Reduced motion lost Iris’s inspection prop.',gestures)
    result={'name':name,'width':width,'height':height,'cpuThrottle':cpu,'reducedMotion':reduced,
            'preview':preview,'playbackRate':page.evaluate('quietBell.cutscene?.playbackRate??1'),'releaseBase':page.evaluate('document.baseURI'),**analyze(frames,speed),**clearance,'renderedFootSamples':visible,'observedGestures':{actor:sorted(values) for actor,values in gestures.items()},
            'browserWork':{key:after[key]-before[key] for key in ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','ScriptDuration','TaskDuration'] if key in before and key in after}}
    page.locator('#cutscene-skip').click() if not preview else page.locator('#developer-cutscene-stop').click()
    ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    (OUT/f'{name}-frames.json').write_text(json.dumps(frames)+'\n')
    context.close();return result



def early_next(browser,url):
    """Manual Next changes the caption immediately while every walk continues."""
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',height=768,
        virtual_walk=False,skip_cutscenes=False,reduced_motion='no-preference')
    cdp=context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    page.locator('#cutscene-skip').click();page.locator('#menu').click();page.locator('#replay-cutscene').click()
    wait_for_story(page)
    before_resources=ui.resources(ui.state(page));before_journal=page.evaluate('quietBell.journey')
    assert page.evaluate('quietBell.cutscene.manualDialogue')
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
    assert after['index']!=before['index'] and not after['nextPending'], click
    assert after['dialogueElapsed']==0 and after['currentTile']==before['currentTile'], click
    for actor in after['actors']:
        old=next(item for item in before['actors'] if item['id']==actor['id'])
        assert math.hypot(actor['x']-old['x'],actor['y']-old['y'])<.001, click
    assert page.locator('#cutscene-next').is_enabled()
    frames=observe(page,advance=True)
    result={'name':'native-early-next-cpu4','releaseBase':page.evaluate('document.baseURI'),
            'firstClickRevealsText':True,'nextImmediatelyChangesCaptionWithoutTeleport':True,
            **assert_dialogue_clearance(frames,[layout_start,dialogue_layout(page)]),
            **analyze(frames,page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)'))}
    assert ui.resources(ui.state(page))==before_resources
    assert page.evaluate('quietBell.journey')==before_journal
    page.locator('#cutscene-skip').click();ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    (OUT/'native-early-next-cpu4-frames.json').write_text(json.dumps(frames)+'\n')
    context.close();return result


def native_entry(browser,url):
    """Watch the real fade, doorway walk and story handoff on a slower CPU."""
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',height=768,
        virtual_walk=False,skip_cutscenes=False,reduced_motion='no-preference')
    page.evaluate('document.fonts.ready')
    cdp=context.new_cdp_session(page);cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    ui.skip_cutscene(page)
    before_resources=ui.resources(ui.state(page));before_journal=page.evaluate('quietBell.journey')
    before_save=page.evaluate('(key)=>localStorage.getItem(key)',ui.SAVE_KEY)
    page.locator('#menu').click();page.locator('#replay-cutscene').click()
    assert page.evaluate("quietBell.cutscene?.phase==='entry'")
    speed=page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)')
    observation=page.evaluate('''async()=>{
      const {CAST}=await import(new URL('cast.mjs',document.baseURI));
      return new Promise(resolve=>{
        const frames=[],feet=[];let started=performance.now(),previous=started,storyFrames=0;
        function sample(now){
          const state=window.quietBell?.cutscene,scene=window.quietBell?.scene;
          const map=document.getElementById('room-map'),fade=document.querySelector('.room-entry-fade');
          frames.push({at:now,delta:now-previous,index:state?.index,tile:state?.currentTile,
            phase:state?.phase,entry:state?.entry,camera:window.quietBell?.camera,
            overflow:map.style.overflow,fadeHidden:fade?.hidden,fadeOpacity:Number(fade?.style.opacity??0),
            hasBeat:!!state?.beat,totalCharacters:state?.totalCharacters,text:document.getElementById('cutscene-line').textContent,
            silent:document.getElementById('cutscene-panel').classList.contains('cutscene-silent'),
            actors:state?.actors?.map(actor=>{
              const node=document.querySelector('[data-actor="'+actor.id+'"]');
              return{id:actor.id,x:actor.x,y:actor.y,moving:actor.moving,facing:actor.facing,gait:actor.gait,gesture:actor.gesture,gestureProgress:actor.gestureProgress,
                frame:node?Number(node.dataset.frame):null,row:node?Number(node.dataset.spriteRow):null,
                animated:node?.dataset.spriteAnimated==='true'};
            })});
          const actor=state?.actors?.find(actor=>actor.moving&&actor.id!=='mira');
          if(state?.phase==='entry'&&actor&&feet.length<5){
            const definition=scene.actors.find(item=>item.id===actor.id),sprite=quietBell.project.cast[definition.character];
            const node=document.querySelector('[data-actor="'+actor.id+'"]');
            const row=Number(node.dataset.spriteRow),frame=Number(node.dataset.frame),walk=sprite.walk??CAST[definition.character]?.walk;
            const anchor=walk?.anchors?.[row]?.[frame]??sprite.anchor;
            const bounds=map.getBoundingClientRect(),rect=node.getBoundingClientRect(),scale=bounds.width/scene.geometry.width;
            const foot={x:rect.left+rect.width*anchor[0],y:rect.top+rect.height*anchor[1]};
            const expected={x:bounds.left+actor.x*scale,y:bounds.top+actor.y*scale};
            feet.push({id:actor.id,x:actor.x,y:actor.y,frame,row,anchor,foot,expected,
              error:Math.hypot(foot.x-expected.x,foot.y-expected.y)});
          }
          previous=now;if(state?.phase==='story')storyFrames++;
          if(storyFrames>=2||now-started>15000)resolve({frames,feet});else requestAnimationFrame(sample);
        }requestAnimationFrame(sample);
      });
    }''')
    frames=observation['frames'];entry=[frame for frame in frames if frame['phase']=='entry']
    story=[frame for frame in frames if frame['phase']=='story']
    (OUT/'native-entry-cpu4-frames.json').write_text(json.dumps(frames)+'\n')
    assert len(entry)>=12 and len(story)>=2, ('Missing native entry/story frames',len(entry),len(story))
    assert entry[0]['fadeOpacity']>0, entry[0]
    for previous,current in zip(entry,entry[1:]):
        assert current['entry']['currentTile']>=previous['entry']['currentTile'], ('Entry clock reversed',previous,current)
        assert current['fadeOpacity']<=previous['fadeOpacity']+.000001, ('Fade reversed',previous,current)
    assert all(not frame['hasBeat'] and frame['totalCharacters']==0 and frame['silent'] for frame in entry), 'Story dialogue started before arrival.'
    assert all(frame['overflow']=='hidden' for frame in entry), 'Offscreen entry sprites must be clipped.'
    assert all(frame['overflow']!='hidden' and frame['fadeHidden'] and frame['entry']['finished'] for frame in story), 'Entry clipping/fade was not restored.'
    assert len(observation['feet'])>=5 and max(item['error'] for item in observation['feet'])<3, observation['feet']
    steps={}
    for frame in entry:
        for actor in frame['actors']:
            if actor['id']!='mira' and actor['moving']:
                assert actor['animated'], actor
                steps.setdefault(actor['id'],{'frames':set(),'facings':set()})
                steps[actor['id']]['frames'].add(actor['frame']);steps[actor['id']]['facings'].add(actor['facing'])
    assert set(steps)=={'nell','iris','pip'}, steps
    assert all(len(item['frames'])>=2 and 'up' in item['facings'] for item in steps.values()), steps
    assert any(len(item['facings'])>=2 for item in steps.values()), 'Entry cast never visibly turns.'
    assert ui.resources(ui.state(page))==before_resources
    assert page.evaluate('quietBell.journey')==before_journal
    assert page.evaluate('(key)=>localStorage.getItem(key)',ui.SAVE_KEY)==before_save, 'Visual entry changed the saved run.'
    result={'name':'native-entry-cpu4','releaseBase':page.evaluate('document.baseURI'),
            'cpuThrottle':4,'entryFrames':len(entry),'fadeStartsAt':entry[0]['fadeOpacity'],
            'fadeEndsAt':entry[-1]['fadeOpacity'],'entryTileAtHandoff':story[0]['entry']['currentTile'],
            'entryClockMonotonic':True,'dialogueWaitsForArrival':True,'clippingRestored':True,
            'saveAndResourcesPreserved':True,'renderedFootSamples':observation['feet'],
            'walkSprites':{actor:{key:sorted(value) for key,value in item.items()} for actor,item in steps.items()},
            **analyze(frames,speed)}
    ui.skip_cutscene(page);ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    context.close();return result


def native_party_performance(browser,url):
    """Hold a caption while acting finishes, then speak past the physical clock."""
    context,page,errors,writes,external=ui.open_page(NativeAudioBrowser(browser),url,1024,'light',height=768,
        virtual_walk=False,skip_cutscenes=False,reduced_motion='no-preference')
    page.evaluate('document.fonts.ready')
    cdp=context.new_cdp_session(page);cdp.send('Performance.enable')
    cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
    ui.skip_cutscene(page)
    before_resources=ui.resources(ui.state(page));before_journal=page.evaluate('quietBell.journey')
    before_save=page.evaluate('(key)=>localStorage.getItem(key)',ui.SAVE_KEY)
    page.locator('#menu').click();page.locator('#replay-cutscene').click();wait_for_story(page)
    speed=page.evaluate('quietBell.scene.geometry.speed*(quietBell.cutscene?.playbackRate??1)')
    before=metrics(cdp)
    frames=page.evaluate('''()=>new Promise(resolve=>{
      const frames=[];let started=performance.now(),previous=started,physicalEndFrames=0;
      function sample(now){
        const state=window.quietBell?.cutscene,scene=window.quietBell?.scene;
        const map=document.getElementById('room-map').getBoundingClientRect();
        const scale=map.width/scene.geometry.width;
        const prop=document.querySelector('.cutscene-magnifier[data-character="iris"]');
        const propStyle=prop?getComputedStyle(prop):null,propRect=prop?.getBoundingClientRect();
        const iris=state?.actors.find(actor=>actor.id==='iris');
        frames.push({at:now,delta:now-previous,index:state?.index,tile:state?.currentTile,
          elapsed:state?.elapsed,manualDialogue:state?.manualDialogue,dialogueElapsed:state?.dialogueElapsed,
          text:document.getElementById('cutscene-line').textContent,textComplete:state?.textComplete,
          camera:quietBell.camera,
          magnifier:prop?{visible:!prop.hidden&&propStyle.display!=='none'&&Number(propStyle.opacity)>.01,
            opacity:Number(propStyle.opacity),width:propRect.width,height:propRect.height,
            handDistance:iris?Math.hypot(propRect.x+propRect.width/2-(map.x+iris.x*scale),propRect.y+propRect.height/2-(map.y+iris.y*scale))/scale:null}:null,
          actors:state?.actors?.map(actor=>{
            const node=actor.id==='mira'?document.getElementById('player-sprite'):document.querySelector('[data-actor="'+actor.id+'"]');
            const transform=node?new DOMMatrixReadOnly(getComputedStyle(node).transform):null;
            return{id:actor.id,x:actor.x,y:actor.y,moving:actor.moving,gait:actor.gait,
              gesture:actor.gesture,gestureProgress:actor.gestureProgress,emote:actor.emote,
              facing:actor.facing,frame:Number(node?.dataset.frame),
              renderedGesture:node?.dataset.gesture??'',
              renderedRotation:transform?Math.atan2(transform.b,transform.a)*180/Math.PI:0};
          })});
        previous=now;
        if(state?.currentTile>=state?.totalTiles)physicalEndFrames++;
        if(!state||physicalEndFrames>=3||now-started>40000)resolve(frames);else requestAnimationFrame(sample);
      }requestAnimationFrame(sample);
    })''')
    after=metrics(cdp)
    (OUT/'native-party-cpu4-frames.json').write_text(json.dumps(frames)+'\n')
    assert len(frames)>=30 and all(frame.get('actors') for frame in frames), 'Performance ended before its expressive actions.'
    held_duration=frames[-1]['at']-frames[0]['at']
    assert held_duration>=15000, ('The caption must survive a real15second read.',held_duration)
    assert all(frame['manualDialogue'] and frame['index']==frames[0]['index'] for frame in frames), 'Caption advanced without a click.'
    readable=[frame for frame in frames if frame['at']-frames[0]['at']>6000]
    assert readable and all(frame['textComplete'] and frame['text']==readable[0]['text'] for frame in readable), 'The fully revealed line was replaced or changed while reading.'
    assert page.evaluate('quietBell.cutscene.currentTile>=quietBell.cutscene.totalTiles&&!quietBell.cutscene.finished')
    simultaneous=[frame for frame in frames if sum(actor['moving'] for actor in frame['actors'] if actor['id']!='mira')>=3]
    assert len(simultaneous)>=3, 'The companions must investigate at the same time.'
    reactions=[frame for frame in frames if sum(bool(actor.get('emote')) for actor in frame['actors'])>=2]
    assert reactions, 'Separate concurrent emotes were not observed.'
    pip=[next(actor for actor in frame['actors'] if actor['id']=='pip') for frame in frames]
    iris=[next(actor for actor in frame['actors'] if actor['id']=='iris') for frame in frames]
    running=[actor for actor in pip if actor.get('moving') and actor.get('gait')=='run']
    assert len(running)>=6 and len({actor['frame'] for actor in running})>=2, 'Pip must visibly run rather than slide.'
    gesture_order=[]
    for actor in pip:
        gesture=actor.get('gesture')
        if gesture and (not gesture_order or gesture_order[-1]!=gesture):gesture_order.append(gesture)
    assert gesture_order==['trip','fallen','recover'], gesture_order
    for gesture in gesture_order:
        states=[actor for actor in pip if actor.get('gesture')==gesture]
        assert len(states)>=3, (gesture,len(states))
        assert all(actor['renderedGesture']==gesture for actor in states), ('Pose was not rendered',gesture,states)
        assert all(a['gestureProgress']<=b['gestureProgress'] for a,b in zip(states,states[1:])), ('Gesture clock reversed',gesture)
        assert all(not actor['moving'] for actor in states), ('Tumble feet must stay planted',gesture)
    fallen=[actor for actor in pip if actor.get('gesture')=='fallen']
    assert min(abs(actor['renderedRotation']) for actor in fallen)>45, 'Pip never visibly falls down.'
    recovery=[actor for actor in pip if actor.get('gesture')=='recover']
    assert abs(recovery[0]['renderedRotation'])>45 and abs(recovery[-1]['renderedRotation'])<15, 'Pip must visibly get back up.'
    assert abs(pip[-1]['renderedRotation'])<5 and not pip[-1].get('gesture'), 'Pip did not return upright.'
    magnifying=[(frame,actor) for frame,actor in zip(frames,iris) if actor.get('gesture')=='magnify' and .15<actor.get('gestureProgress',0)<.85]
    assert len(magnifying)>=3 and all(frame['magnifier'] and frame['magnifier']['visible'] for frame,actor in magnifying), 'Iris needs an actual held magnifying glass.'
    assert all(frame['magnifier']['width']>0 and frame['magnifier']['height']>0 and frame['magnifier']['handDistance']<170 for frame,actor in magnifying), 'The magnifying glass must remain attached to Iris.'
    assert ui.resources(ui.state(page))==before_resources
    assert page.evaluate('quietBell.journey')==before_journal
    assert page.evaluate('(key)=>localStorage.getItem(key)',ui.SAVE_KEY)==before_save, 'Acting changed the saved run.'
    # The physical RAF clock is now parked. A real Continue click starts the
    # next typewriter line and its real character voice without moving anyone.
    settled=page.evaluate('quietBell.cutscene')
    audio_before=page.evaluate('window.__nativeCinematicStarts.length')
    page.locator('#cutscene-next').click()
    clicked=page.evaluate('quietBell.cutscene')
    assert clicked['index']!=settled['index'] and clicked['currentTile']==settled['currentTile']
    assert clicked['dialogueElapsed']<300, clicked
    for actor in clicked['actors']:
        old=next(item for item in settled['actors'] if item['id']==actor['id'])
        assert math.hypot(actor['x']-old['x'],actor['y']-old['y'])<.001
    page.wait_for_function('count=>window.__nativeCinematicStarts.length>count',arg=audio_before)
    page.wait_for_timeout(350)
    speaking=page.evaluate('quietBell.cutscene')
    assert speaking['currentTile']==settled['currentTile'] and speaking['dialogueElapsed']>clicked['dialogueElapsed']
    assert speaking['visibleCharacters']>clicked['visibleCharacters']
    new_voices=page.evaluate('count=>window.__nativeCinematicStarts.slice(count)',audio_before)
    assert any(430<=voice['frequency']<=460 for voice in new_voices), ('Pip needs actual new bloops after the physical clock stopped.',new_voices)
    assert ui.resources(ui.state(page))==before_resources and page.evaluate('quietBell.journey')==before_journal
    assert page.evaluate('(key)=>localStorage.getItem(key)',ui.SAVE_KEY)==before_save
    result={'name':'native-party-cpu4','releaseBase':page.evaluate('document.baseURI'),'cpuThrottle':4,
            'concurrentMovingFrames':len(simultaneous),'concurrentEmoteFrames':len(reactions),
            'pipRunFrames':len(running),'pipGestureOrder':gesture_order,'heldMagnifierFrames':len(magnifying),
            'saveAndResourcesPreserved':True,'heldCaptionMilliseconds':held_duration,
            'captionHoldsUntilClick':True,'dialogueAndVoicesContinueAfterPhysicalEnd':True,
            'voicesAfterPhysicalEnd':len(new_voices),**analyze(frames,speed,require_transition=False),
            'browserWork':{key:after[key]-before[key] for key in ['LayoutCount','LayoutDuration','RecalcStyleCount','RecalcStyleDuration','ScriptDuration','TaskDuration'] if key in before and key in after}}
    ui.skip_cutscene(page);ui.protected_storage(page)
    assert not errors and not writes and not external,(errors,writes,external)
    result['errors']=errors
    context.close();return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
    parser.add_argument('--only',choices=['entry','party','phone','reduced','preview','next'])
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
            cases=[('entry',lambda:native_entry(browser,url)),('party',lambda:native_party_performance(browser,url)),
                   ('phone',lambda:scenario(browser,url,'native-phone-cpu4',390,844,4)),
                   ('reduced',lambda:scenario(browser,url,'native-reduced',1024,768,1,reduced='reduce')),
                   ('preview',lambda:scenario(browser,url,'native-preview-cpu4',1024,768,4,preview=True)),
                   ('next',lambda:early_next(browser,url))]
            results=[run() for name,run in cases if not args.only or name==args.only]
            raw.close()
        if args.expect_release:
            assert all('/releases/'+args.expect_release+'/' in item['releaseBase'] for item in results), results
        result={'passed':True,'entry':url,'scenarios':results}
        name='public' if args.url else 'source' if args.source else 'launcher'
        if args.only:name+='-'+args.only
        (OUT/f'{name}-results.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
