"""Concurrent party performances and editable physical actions through real UI.

The compiler is read only. Playback, seeking, imports, exports and edits use the
published controls, and no mutable game hook or network write is installed.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import copy
import importlib.util
import json
import math
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/party-performance-browser'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('party_tracks',ROOT/'tests/quiet-bell-cutscene-tracks-browser.py')
tracks=importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
cs,ui,paths=tracks.cs,tracks.ui,tracks.paths

AUDIO_OBSERVER=r'''(() => {
  const Native=window.AudioContext;if(!Native)return;
  const events=window.__partyAudioEvents=[],oscillators=new WeakMap();let sequence=0;
  const emit=(kind,extra={})=>events.push({kind,at:performance.now(),...extra});
  let Wrapper;
  Wrapper=new Proxy(Native,{construct(target,args,newTarget){
    const context=Reflect.construct(target,args,newTarget===Wrapper?target:newTarget);
    emit('context',{state:context.state,gesture:!!navigator.userActivation?.isActive});
    const create=context.createOscillator;
    context.createOscillator=function(...args){
      const oscillator=create.apply(this,args),record={id:++sequence,frequency:null,type:null};
      oscillators.set(oscillator,record);
      const set=oscillator.frequency.setValueAtTime;
      oscillator.frequency.setValueAtTime=function(value,time){record.frequency=value;return set.call(this,value,time);};
      const start=oscillator.start,stop=oscillator.stop,disconnect=oscillator.disconnect;
      oscillator.start=function(when){emit('start',{...record,type:oscillator.type,when,now:context.currentTime});return start.call(this,when);};
      oscillator.stop=function(when){emit('stop',{id:record.id,when:when??null,now:context.currentTime});return stop.call(this,when);};
      oscillator.disconnect=function(...args){emit('disconnect',{id:record.id});return disconnect.apply(this,args);};
      return oscillator;
    };
    for(const name of ['resume','suspend','close']){
      const method=context[name];context[name]=function(...args){emit(name,{state:this.state,gesture:!!navigator.userActivation?.isActive});return method.apply(this,args);};
    }
    return context;
  }});
  window.AudioContext=Wrapper;
})();'''


class AudioTraceBrowser:
    def __init__(self,browser):self.browser=browser
    def new_context(self,**options):
        context=self.browser.new_context(**options);context.add_init_script(AUDIO_OBSERVER);return context


def tick(page,duration=100):cs.tick(page,duration)
def current(page):return page.evaluate('quietBell.cutscene')
def actor(value,identifier):return next(a for a in value['actors'] if a['id']==identifier)


def seek(page,tile):
    scrub=page.locator('#developer-cutscene-scrub');scrub.focus()
    # Ensure an actual input event even when the thumb already starts at zero.
    page.keyboard.press('ArrowRight');page.keyboard.press('Home')
    for _ in range(int(tile)):page.keyboard.press('ArrowRight')
    tick(page,80)
    value=current(page)
    assert value and not value['playing'] and abs(value['currentTile']-tile)<.001,value
    return value


def inspect_sprites(page):
    return page.evaluate('''()=>{
      const state=quietBell.cutscene;
      return state.actors.map(actor=>{
        const node=document.querySelector(actor.id==='mira'?'#player-sprite':'.mg-npc[data-actor="'+actor.id+'"]');
        return {...actor,transform:node?.style.transform,gestureData:node?.dataset.gesture,
          frame:node?.dataset.frame,visible:!!node&&getComputedStyle(node).visibility!=='hidden'};
      });
    }''')


def sprite_angle(page,identifier):
    return page.locator('.mg-npc[data-actor="'+identifier+'"]').evaluate('''node=>{
      const matrix=new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return Math.atan2(matrix.b,matrix.a)*180/Math.PI;
    }''')


def trace_actual_frames(page):
    # Screenshots and browser protocol turns can span several virtual RAFs.
    # Observe every rendered frame so a short stumble is measured in full.
    page.evaluate('''()=>{
      window.__partyFrameTrace=[];
      function frame(){
        const state=quietBell.cutscene;if(!state)return;
        window.__partyFrameTrace.push(state.actors.map(actor=>{
          const node=document.querySelector(actor.id==='mira'?'#player-sprite':'.mg-npc[data-actor="'+actor.id+'"]');
          const matrix=new DOMMatrixReadOnly(getComputedStyle(node).transform);
          return{id:actor.id,moving:actor.moving,emote:actor.emote,gesture:actor.gesture,
            angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI,frame:node.dataset.frame,gait:actor.gait};
        }));requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    }''')


def capture_paused(page,path):
    # Screenshot capture can span multiple RAFs. Freeze with the same blur
    # behavior used by the game, then resume the unchanged performance.
    was_playing=bool(current(page) and current(page)['playing'])
    if was_playing:page.evaluate('window.dispatchEvent(new Event("blur"))')
    try:page.screenshot(path=str(path))
    finally:
        if was_playing:page.evaluate('window.dispatchEvent(new Event("focus"))')


def safe_saved_floor(page):
    cs.assert_floor(page,{'actors':page.evaluate('quietBell.scene.actors.map(a=>({id:a.id,...a.feet}))')})
    saved=page.evaluate('JSON.parse(localStorage.getItem("codaQuietBellPageOneV1"))')
    for poses in saved.get('roomCutscenes',{}).get('poses',{}).values():
        assert all(set(pose)<=set(['id','x','y','facing']) for pose in poses),poses
    assert saved['roomPosition']['y']<=page.evaluate('quietBell.scene.geometry.height')
    assert page.locator('.cutscene-magnifier').count()==0
    assert not page.locator('.mg-npc[data-gesture]:not([data-gesture=""])').count()


def compile_all_rooms(page):
    result=page.evaluate('''async()=>{
      const {createRoomCutscene}=await import(new URL('cutscene.mjs',document.baseURI));
      return Object.entries(quietBell.project.scenes).map(([id,scene])=>{
        const beats=quietBell.project.content[id].cutscene,performance=createRoomCutscene({scene,beats});
        let simultaneous=0,emotes=0;
        for(let tile=0;tile<performance.timeline.totalTiles;tile+=.5){
          performance.seek(tile);const actors=performance.state.actors;
          simultaneous=Math.max(simultaneous,actors.filter(a=>a.moving).length);
          emotes=Math.max(emotes,actors.filter(a=>a.emote).length);
        }
        const clips=performance.timeline.clips;
        return{id,simultaneous,emotes,adjustments:performance.timeline.adjustments,
          run:clips.filter(c=>c.actor==='pip'&&c.kind==='walk'&&c.gait==='run').length,
          gestures:clips.filter(c=>c.kind==='gesture').map(c=>({actor:c.actor,gesture:c.gesture,start:c.startTile,end:c.endTile})),
          targets:clips.filter(c=>c.kind==='walk'&&c.target).map(c=>c.target),
          captions:clips.filter(c=>c.kind==='dialogue').map(c=>({speaker:c.speaker,text:c.text,start:c.startTile,end:c.endTile}))};
      });
    }''')
    assert len(result)==23
    for room in result:
        assert room['simultaneous']>=3,room
        assert room['emotes']>=3,room
        assert room['run']>=1,room
        gestures=room['gestures']
        assert any(g['actor']=='iris' and g['gesture']=='magnify' for g in gestures),room
        tumble=[g for g in gestures if g['actor']=='pip']
        names=[g['gesture'] for g in tumble]
        assert all(name in names for name in ['trip','fallen','recover']),room
        falls=[next(g for g in tumble if g['gesture']==name) for name in ['trip','fallen','recover']]
        assert all(a['end']<=b['start'] for a,b in zip(falls,falls[1:])),room
        assert len(set(room['targets']))>=3,room
        speakers={line['speaker'] for line in room['captions']}
        assert {'mira','nell','iris','pip'}<=speakers,room
        assert all(a['end']<=b['start'] for a,b in zip(room['captions'],room['captions'][1:])),room
    return result


def normal_flow(browser,url,expected,width=1024,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',height=844 if width<500 else 768,
        skip_cutscenes=False,reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected)
    cs.wait_for_story(page)
    trace_actual_frames(page)
    original=cs.conserved(page)
    normal_before=cs.normal_storage(page)
    quantum=current(page)['quantumMs']
    total=current(page)['totalTiles']
    overlap=0;emotes=0;seen=set();frames=[];saved_shots=set();run_frames=set();magnifier_seen=False;angles={};lens_on_screen=False
    for _ in range(math.ceil(total*quantum/50)+10):
        value=current(page)
        if not value:break
        assert value['phase']=='story'
        overlap=max(overlap,sum(a['moving'] for a in value['actors']))
        emotes=max(emotes,sum(bool(a['emote']) for a in value['actors']))
        pip=actor(value,'pip');iris=actor(value,'iris')
        if pip.get('gait')=='run' and pip['moving']:
            run_frames.add(page.locator('.mg-npc[data-actor="pip"]').get_attribute('data-frame'))
        for pose in value['actors']:
            if pose.get('gesture'):seen.add((pose['id'],pose['gesture']))
        if pip.get('gesture') in ['trip','fallen','recover']:
            angles[pip['gesture']]=max(angles.get(pip['gesture'],0),abs(sprite_angle(page,'pip')))
        frames.append({'tile':value['currentTile'],'elapsed':value['elapsed'],'actors':inspect_sprites(page)})
        if pip.get('gesture') in ['trip','fallen','recover'] and .25<pip.get('gestureProgress',0)<.8:
            name=pip['gesture']
            node=page.locator('.mg-npc[data-actor="pip"]')
            assert node.get_attribute('data-gesture')==name
            if name not in saved_shots:
                capture_paused(page,OUT/f'normal-{width}-{reduced}-{name}.png');saved_shots.add(name)
        if iris.get('gesture')=='magnify' and .25<iris.get('gestureProgress',0)<.9:
            glass=page.locator('.cutscene-magnifier')
            assert glass.count()==1 and glass.is_visible()
            assert float(glass.evaluate('e=>getComputedStyle(e).opacity'))>.5
            assert glass.get_attribute('data-facing')==iris['facing']
            magnifier_seen=True
            box=glass.bounding_box()
            inside=box and box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width
            if inside and (value.get('beat') or {}).get('speaker')=='iris':lens_on_screen=True
            if inside and (value.get('beat') or {}).get('speaker')=='iris' and 'glass' not in saved_shots:
                capture_paused(page,OUT/f'normal-{width}-{reduced}-glass.png');saved_shots.add('glass')
        if value.get('beat') and not reduced:
            paths.assert_dialogue_clear_of_cast(page,minimum=1)
        tick(page,50)
    assert not current(page),'The room opening should conclude without a stuck performance.'
    rendered_trace=page.evaluate('window.__partyFrameTrace')
    (OUT/f'normal-{width}-{reduced}-frames.json').write_text(json.dumps(rendered_trace)+'\n')
    for rendered in rendered_trace:
        overlap=max(overlap,sum(a['moving'] for a in rendered))
        emotes=max(emotes,sum(bool(a['emote']) for a in rendered))
        for observed in rendered:
            if observed.get('gesture'):seen.add((observed['id'],observed['gesture']))
            if observed['id']=='pip' and observed.get('gait')=='run' and observed['moving']:
                run_frames.add(observed['frame'])
        for pip_frame in [a for a in rendered if a['id']=='pip' and a.get('gesture') in ['trip','fallen','recover']]:
            angles[pip_frame['gesture']]=max(angles.get(pip_frame['gesture'],0),abs(pip_frame['angle']))
    assert overlap>=3 and emotes>=3,(overlap,emotes)
    assert {('pip','trip'),('pip','fallen'),('pip','recover'),('iris','magnify')}<=seen,seen
    assert all(angles.get(name,0)>30 for name in ['trip','fallen','recover']),angles
    assert len(run_frames)>=2,run_frames
    assert magnifier_seen
    assert lens_on_screen,'The held lens should be on screen while Iris discusses her inspection.'
    assert cs.conserved(page)==original
    safe_saved_floor(page)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    # Reloading the completed scene keeps the exact safe room position and no
    # residual magnifier, fallen pose or cutscene overlay.
    before=ui.walker(page);page.reload();page.wait_for_function('!!window.quietBell?.state');tick(page,80)
    paths.validate_release(page,expected)
    assert not current(page)
    assert cs.point_distance(before,ui.walker(page))<.1
    assert cs.conserved(page)==original
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'width':width,'reducedMotion':reduced,'concurrentWalking':overlap,
            'concurrentEmotes':emotes,'runFrames':sorted(run_frames),'physicalActions':[list(v) for v in sorted(seen)],
            'realMagnifyingGlass':magnifier_seen,'safeFinishAndReload':True,'resourcesAndJournalUnchanged':True,
            'sampleCount':len(frames)}


def editor_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1200,'light',height=900)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);economy=cs.conserved(page)
    rooms=compile_all_rooms(page)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').click();tick(page,100)
    for identifier in ['nell','iris','pip','mira']:
        track=page.locator('.cse-track[data-cutscene-actor="'+identifier+'"]')
        for kind in ['walk','dialogue','emote','gesture']:
            assert track.locator('.cse-channel[data-cutscene-kind="'+kind+'"]').count()==1,(identifier,kind)
    baseline=tracks.export_project(page,'party-default')
    index=paths.select_track_clip(page,'iris','gesture')
    gesture_id=baseline['content']['depot']['cutscene'][index]['id']
    before=tracks.export_project(page,'before-gesture-drag')
    tracks.drag_item(page,tracks.selected(page),2)
    after=tracks.export_project(page,'after-gesture-drag')
    tracks.one_changed(before,after,gesture_id,['startTile'])
    paths.history(page,'undo')
    assert tracks.export_project(page,'undo-gesture')['content']['depot']['cutscene']==before['content']['depot']['cutscene']
    paths.history(page,'redo')
    assert tracks.export_project(page,'redo-gesture')['content']['depot']['cutscene']==after['content']['depot']['cutscene']
    # Changing a movement's gait never retimes a text/emote/physical-action row.
    pip_index=paths.select_track_clip(page,'pip','walk')
    before=tracks.export_project(page,'before-gait')
    walk_id=before['content']['depot']['cutscene'][pip_index]['id']
    page.locator('#developer-cutscene-gait [data-cutscene-choice="walk"]').click();tick(page,80)
    after=tracks.export_project(page,'after-gait')
    tracks.one_changed(before,after,walk_id,['gait'])
    paths.history(page,'undo')
    assert tracks.export_project(page,'undo-gait')['content']['depot']['cutscene']==before['content']['depot']['cutscene']
    # An added Action has its own row and exact editable enum, with one Undo.
    paths.select_track_clip(page,'iris','gesture')
    before=tracks.export_project(page,'before-action-add')
    page.locator('#developer-cutscene-add-gesture').click();tick(page,80)
    assert tracks.selected(page).get_attribute('data-cutscene-kind')=='gesture'
    page.locator('#developer-cutscene-gesture [data-cutscene-choice="recover"]').click();tick(page,80)
    added=tracks.export_project(page,'after-action-add')
    assert len(added['content']['depot']['cutscene'])==len(before['content']['depot']['cutscene'])+1
    assert added['content']['depot']['cutscene'][int(tracks.selected(page).get_attribute('data-cutscene-clip'))]['gesture']=='recover'
    page.locator('#developer-cutscene-delete').click();tick(page,80)
    assert tracks.export_project(page,'after-action-delete')['content']['depot']['cutscene']==before['content']['depot']['cutscene']
    # Round trip the complete directed project before restoring published timing.
    exported=tracks.export_project(page,'party-edited-round-trip')
    tracks.import_project(page,exported,'party-round-trip')
    assert tracks.export_project(page,'party-reimported')['content']['depot']['cutscene']==exported['content']['depot']['cutscene']
    tracks.import_project(page,baseline,'party-default-restored')
    clips=baseline['content']['depot']['cutscene']
    trips={clip['gesture']:clip for clip in clips if clip['kind']=='gesture' and clip['actor']=='pip'}
    glass=next(clip for clip in clips if clip['kind']=='gesture' and clip['gesture']=='magnify')
    tracks.start_paused(page)
    for name in ['trip','fallen','recover']:
        clip=trips[name];value=seek(page,clip['startTile']+min(clip['durationTiles']-1,clip['durationTiles']//2))
        assert actor(value,'pip')['gesture']==name,value
        if name in ['fallen','recover']:assert abs(sprite_angle(page,'pip'))>10,(name,sprite_angle(page,'pip'))
        before_pose=actor(value,'pip')
        transform=page.locator('.mg-npc[data-actor="pip"]').get_attribute('style')
        tick(page,350)
        assert current(page)['currentTile']==value['currentTile']
        assert page.locator('.mg-npc[data-actor="pip"]').get_attribute('style')==transform
        page.screenshot(path=str(OUT/f'editor-{name}.png'))
    value=seek(page,glass['startTile']+min(glass['durationTiles']-1,glass['durationTiles']//2))
    assert actor(value,'iris')['gesture']=='magnify'
    assert page.locator('.cutscene-magnifier').is_visible()
    page.screenshot(path=str(OUT/'editor-magnifier.png'))
    # Rate toggling while paused changes no pose or clip timing. Play resumes the
    # action at2x rather than restarting it or its doorway prelude.
    old=current(page);rate=old['playbackRate']
    page.locator('#developer-cutscene-speed').click();tick(page,100)
    changed=current(page)
    assert changed['playbackRate']==(1 if rate==2 else 2)
    assert changed['currentTile']==old['currentTile'] and not changed['playing']
    assert actor(changed,'iris')==actor(old,'iris')
    page.locator('#developer-cutscene-play').click();tick(page,140)
    assert current(page)['currentTile']>changed['currentTile'] and current(page)['phase']=='story'
    page.locator('#developer-cutscene-stop').click();tick(page,80)
    assert not current(page) and page.locator('.cutscene-magnifier').count()==0
    assert cs.normal_storage(page)==normal and cs.conserved(page)==economy
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'allRooms':rooms,'fourIndependentRows':True,'actionPointerDragAndUndoRedo':True,
            'gaitEditLeavesOtherTracksUntouched':True,'actionAddDeleteAndRoundTrip':True,'scrubbablePhysicalPoses':True,
            'pausedRateAndResume':True,'normalSaveBytesUntouched':True}


def next_and_skip_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',height=768,skip_cutscenes=False)
    base=paths.validate_release(page,expected);cs.wait_for_story(page)
    economy=cs.conserved(page);seen=set();clicks=0
    # Repeated genuine Next clicks can shorten reading holds, but cannot bypass
    # a physical tumble or recovery happening under somebody else's caption.
    for _ in range(1500):
        value=current(page)
        if not value:break
        pip=actor(value,'pip')
        if pip.get('gesture'):seen.add(pip['gesture'])
        if page.locator('#cutscene-next').is_enabled():
            page.locator('#cutscene-next').click();clicks+=1
        tick(page,40)
    assert not current(page),current(page)
    assert {'trip','fallen','recover'}<=seen,seen
    assert clicks>3
    assert cs.conserved(page)==economy
    safe_saved_floor(page)
    cs.replay(page)
    for _ in range(500):
        value=current(page)
        if actor(value,'pip').get('gesture')=='fallen':break
        tick(page,40)
    assert actor(current(page),'pip').get('gesture')=='fallen'
    page.locator('#cutscene-skip').click();tick(page,80)
    assert not current(page)
    safe_saved_floor(page)
    feet=ui.walker(page);page.keyboard.press('ArrowUp');tick(page,80)
    assert cs.conserved(page)==economy
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'nextPreservesAllTumblePhases':True,'nextClicks':clicks,
            'skipWhileFallenRestoresUprightControl':True,'resourcesAndJournalUnchanged':True}


def audio_events(page):return page.evaluate('window.__partyAudioEvents')
def audio_starts(page):return [event for event in audio_events(page) if event['kind']=='start']


def silent_control_click(page,selector):
    # Observe the same DOM event before and after its real button handler, so
    # unrelated native RAF callbacks cannot look like a control-generated cue.
    page.evaluate('''selector=>{
      const starts=()=>window.__partyAudioEvents.filter(e=>e.kind==='start').length;
      window.__partyAudioControl={};
      const before=event=>{if(!event.target.closest(selector))return;window.__partyAudioControl.before=starts();document.removeEventListener('click',before,true);};
      const after=event=>{if(!event.target.closest(selector))return;window.__partyAudioControl.after=starts();document.removeEventListener('click',after);};
      document.addEventListener('click',before,true);document.addEventListener('click',after);
    }''',selector)
    page.locator(selector).click()
    observed=page.evaluate('window.__partyAudioControl')
    assert observed.get('before') is not None and observed['before']==observed.get('after'),observed


def audio_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(AudioTraceBrowser(browser),url,1024,'light',height=768,
        skip_cutscenes=False,virtual_walk=False)
    base=paths.validate_release(page,expected);economy=cs.conserved(page)
    assert not audio_events(page),'Cinematic sound should create no context before a real user gesture.'
    # Public artwork can finish loading after the first performance has begun.
    # Use the real replay control so both short cues are observed after unlock.
    if current(page):page.locator('#cutscene-skip').click()
    else:page.locator('#menu').click()
    page.wait_for_function('window.__partyAudioEvents.some(e=>e.kind==="context")')
    assert next(event for event in audio_events(page) if event['kind']=='context')['gesture']
    if not page.locator('#menu-dialog').is_visible():page.locator('#menu').click()
    page.locator('#replay-cutscene').click();page.locator('#cutscene-speed').click()
    cs.wait_for_story(page)
    page.wait_for_function('quietBell.cutscene?.actors.some(a=>a.id==="pip"&&a.gesture==="fallen")')
    tick(page,80)
    starts=audio_starts(page)
    assert sum(abs(event['frequency']-205)<.001 for event in starts)==1,starts
    assert sum(abs(event['frequency']-145)<.001 for event in starts)==1,starts
    letter_voices=[event for event in starts if 210<event['frequency']<240]
    assert len(letter_voices)>=3,starts
    # Native context.currentTime can advance one render quantum while the first
    # oscillator/gain graph is constructed; past starts play immediately.
    assert all(-.05<event['when']-event['now']<.02 for event in starts),starts
    # Revealing the rest of a line synchronizes the cursor silently. It must
    # not play one bloop for every letter that was skipped.
    if not current(page)['textComplete']:silent_control_click(page,'#cutscene-next')
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    paused=current(page);count=len(audio_starts(page));tick(page,250)
    assert not current(page)['playing'] and current(page)['currentTile']==paused['currentTile']
    assert len(audio_starts(page))==count
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    tick(page,100)
    page.locator('#cutscene-skip').click();count=len(audio_starts(page));tick(page,180)
    assert not current(page) and len(audio_starts(page))==count
    safe_saved_floor(page)
    saved=cs.normal_storage(page)
    # The director's playhead can seek across both knock cues while paused
    # without producing sound, and natural playback resumes new letters only.
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').click()
    page.locator('#developer-cutscene-play').click();tick(page,240)
    page.locator('#developer-cutscene-pause').click();count=len(audio_starts(page));tick(page,180)
    assert not current(page)['playing'] and len(audio_starts(page))==count
    seek(page,15);tick(page,120)
    assert len(audio_starts(page))==count,'Scrubbing across the trip/fall must be silent.'
    silent_control_click(page,'#developer-cutscene-speed')
    assert len(audio_starts(page))==count
    spoken=page.evaluate('quietBell.project.content.depot.cutscene.filter(c=>c.kind==="dialogue")')
    profiles={}
    for speaker,base_frequency in [('nell',220),('iris',270),('pip',440),('mira',350)]:
        line=next(clip for clip in spoken if clip['speaker']==speaker)
        count=len(audio_starts(page));seek(page,line['startTile'])
        assert len(audio_starts(page))==count
        page.locator('#developer-cutscene-play').click();tick(page,220)
        page.locator('#developer-cutscene-pause').click()
        sounds=audio_starts(page)[count:]
        assert any(abs(event['frequency']/base_frequency-1)<.06 for event in sounds),(speaker,sounds)
        profiles[speaker]=[event['frequency'] for event in sounds]
    page.locator('#developer-cutscene-stop').click();tick(page,80)
    page.keyboard.press('F2');tick(page,80)
    assert cs.normal_storage(page)==saved and cs.conserved(page)==economy
    # Sound is changed through Settings, then a complete entrance and its first
    # physical cues play muted. No new audio voice may be scheduled.
    page.locator('#menu').click();page.locator('#sound').click()
    assert page.locator('#sound').get_attribute('aria-pressed')=='false'
    assert page.evaluate('localStorage.getItem("codaRhythmBlocksSoundV1")')=='off'
    page.locator('#replay-cutscene').click();count=len(audio_starts(page))
    cs.wait_for_story(page)
    page.wait_for_function('quietBell.cutscene?.actors.some(a=>a.id==="pip"&&a.gesture==="fallen")')
    tick(page,80)
    assert len(audio_starts(page))==count,'Sound off must mute letters and both wooden knocks.'
    page.locator('#cutscene-skip').click();tick(page,80)
    assert cs.conserved(page)==economy
    events=audio_events(page)
    assert any(event['kind']=='disconnect' for event in events),events
    assert any(event['kind']=='suspend' for event in events),events
    (OUT/'audio-events.json').write_text(json.dumps(events,indent=2)+'\n')
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'lazyTrustedGestureUnlock':True,'naturalLetterVoices':len(letter_voices),
            'tripAndFallExactlyOnce':True,'nearImmediateScheduling':True,'silentRevealAndSeek':True,
            'pauseAndSkipStopVoices':True,'settingsSoundMutesAllCinematicEffects':True,
            'characterVoiceProfiles':profiles,'normalSaveAndEconomyPreserved':True,
            'realWebAudioOscillatorsObserved':len([e for e in events if e['kind']=='start'])}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            runner=cs.PublicBrowser(browser) if url.startswith('https:') else browser
            result={'passed':True,'entry':url,'desktop':normal_flow(runner,url,args.expect_release),
                'editor':editor_flow(runner,url,args.expect_release),
                'nextAndSkip':next_and_skip_flow(runner,url,args.expect_release),
                'phones':[normal_flow(runner,url,args.expect_release,390,reduced) for reduced in [False,True]],
                'audio':audio_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1)
        name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
