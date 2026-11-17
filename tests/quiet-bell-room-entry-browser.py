"""The party enters through a real doorway during a clock-driven room fade.

Only DOM events and read-only snapshots are observed. Room travel, notes,
director settings, preview, Skip and reload use the normal controls.
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/burst-entry-browser'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('entry_tracks', ROOT / 'tests/quiet-bell-cutscene-tracks-browser.py')
tracks = importlib.util.module_from_spec(spec);spec.loader.exec_module(tracks)
cs, ui, paths = tracks.cs, tracks.ui, tracks.paths
PARTY = ['mira', 'nell', 'iris', 'pip']

# The launcher rewrites its document, so ordinary document listeners installed
# before navigation can be removed. This transparent dispatch observer keeps
# the first public cinematic event while preserving native event semantics.
TRACE = r'''(() => {
  window.__entryEvents=[];window.__entryFrames=[];let started=false,afterEntry=0;
  const snapshot=value=>({phase:value.phase,entry:value.entry?{...value.entry}:null,
    roomId:value.roomId,currentTile:value.currentTile,elapsed:value.elapsed,
    playing:value.playing,playbackRate:value.playbackRate??1,finished:value.finished,
    text:value.beat?.text??'',actors:value.actors?.map(a=>({id:a.id,x:a.x,y:a.y,
      facing:a.facing,moving:a.moving,gait:a.gait??'walk',frame:document.querySelector(a.id==='mira'?'#player-sprite':'.mg-npc[data-actor="'+a.id+'"]')?.dataset.frame}))??[]});
  const dispatch=EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent=function(event){
    if(event.type==='quietbellcutscene'&&event.detail){
      window.__entryEvents.push(snapshot(event.detail));
      if(!started){started=true;requestAnimationFrame(sample);}
    }
    return dispatch.call(this,event);
  };
  function sample(now){
    const value=window.quietBell?.cutscene;
    if(value?.phase==='entry')afterEntry=0;
    if(value&&(value.phase==='entry'||afterEntry<5)&&window.__entryFrames.length<10000){
      window.__entryFrames.push({...snapshot(value),now});
      if(value.phase==='story')afterEntry++;
    }
    requestAnimationFrame(sample);
  }
})();'''


class TraceBrowser:
    def __init__(self, browser):
        self.browser = browser

    def new_context(self, **options):
        context = self.browser.new_context(**options)
        context.add_init_script(TRACE)
        return context


def tick(page, amount=80):
    cs.tick(page, amount)


def cutscene(page):
    return page.evaluate('quietBell.cutscene')


def pose(value, identifier):
    return next(actor for actor in value['actors'] if actor['id'] == identifier)


def no_errors(page, errors, writes, external):
    ui.protected_storage(page)
    paths.no_errors(errors, writes, external)


def reset_trace(page):
    page.evaluate('window.__entryEvents=[];window.__entryFrames=[];')


def wait_story(page):
    for _ in range(240):
        value = cutscene(page)
        if not value or value.get('phase') == 'story':
            return value
        tick(page, 50)
    raise AssertionError(cutscene(page))


def finish_entry_only(page):
    for _ in range(240):
        value = cutscene(page)
        if not value:
            return
        assert value['phase'] == 'entry' and value.get('beat') is None, value
        assert value['totalCharacters'] == 0
        tick(page, 50)
    raise AssertionError(cutscene(page))


def assert_silent_entry(page, value):
    assert value and value['phase'] == 'entry' and not value['finished'], value
    assert value['beat'] is None and abs(value['currentTile']) < .000001, value
    assert value['totalCharacters'] == 0
    assert page.locator('#cutscene-panel').evaluate('e=>e.classList.contains("cutscene-silent")')
    assert page.locator('#room-map').evaluate('e=>e.style.overflow') == 'hidden'
    assert page.locator('#cutscene-next').is_disabled()
    if not value['preview']:
        assert page.locator('#cutscene-skip').is_visible()
    fade = page.locator('.room-entry-fade')
    assert fade.count() == 1
    observed = fade.evaluate('''e=>({opacity:Number(getComputedStyle(e).opacity),
      expected:quietBell.cutscene?.entry?.fadeOpacity,phase:quietBell.cutscene?.phase})''')
    assert abs(observed['opacity']-observed['expected']) < .025, observed
    return observed['opacity']


def assert_first_event(page, room_id):
    events = page.evaluate('window.__entryEvents')
    first = next(event for event in events if event.get('phase') == 'entry' and event.get('roomId') == room_id)
    assert first['entry']['fadeOpacity'] > .999 and first['entry']['currentTile'] == 0, first
    assert first['currentTile'] == 0 and not first['text'], first
    height = page.evaluate('quietBell.scene.geometry.height')
    at = [pose(first, identifier) for identifier in PARTY]
    assert all(actor['y'] > height for actor in at), first
    assert max(actor['x'] for actor in at)-min(actor['x'] for actor in at) < .001, first
    assert all(actor['facing'] == 'up' for actor in at if actor['moving']), first
    return first


def assert_inside(page):
    result = page.evaluate('''async()=>{
      const {isWalkable}=await import(new URL('room.mjs',document.baseURI));
      const scene=quietBell.scene,ids=new Set(scene.actors.map(a=>a.id));
      const physical={...scene.geometry,obstacles:scene.geometry.obstacles.filter(o=>!ids.has(o.id))};
      const actors=scene.actors.map(a=>({id:a.id,valid:isWalkable(physical,a.feet)}));
      return{actors,playerValid:isWalkable(scene.geometry,quietBell.walker),save:JSON.parse(localStorage.getItem(quietBell.state.developerMode?'codaQuietBellDeveloperRunV1':'codaQuietBellPageOneV1'))};
    }''')
    assert result['playerValid'] and all(actor['valid'] for actor in result['actors']), result
    assert result['save']['roomPosition']['y'] <= page.evaluate('quietBell.scene.geometry.height'), result
    return result


def assert_trace(page):
    events = page.evaluate('window.__entryEvents')
    frames = page.evaluate('window.__entryFrames')
    entry = [event for event in events if event.get('phase') == 'entry']
    assert entry and all(not event['text'] and event['currentTile'] == 0 for event in entry), entry
    assert all(b['entry']['fadeOpacity'] <= a['entry']['fadeOpacity']+.000001 for a,b in zip(entry,entry[1:])), entry
    assert any(0 < event['entry']['fadeOpacity'] < 1 for event in entry), entry
    speed = page.evaluate('quietBell.scene.geometry.speed')
    maximum = 0
    for before, after in zip(frames,frames[1:]):
        # Playwright may dispatch several clock callbacks in a single browser
        # task. Compare positions to the actual cinematic transport, including
        # its final entry tick before the story clock begins at zero.
        def transport_elapsed(frame):
            return frame['entry']['elapsed']+(frame['elapsed'] if frame['phase']=='story' else 0)
        elapsed = max(0,transport_elapsed(after)-transport_elapsed(before))/1000
        for actor in after['actors']:
            old = pose(before,actor['id'])
            distance = math.hypot(actor['x']-old['x'],actor['y']-old['y'])
            maximum = max(maximum,distance)
            multiplier = 2 if actor.get('gait')=='run' or old.get('gait')=='run' else 1
            assert distance <= speed*multiplier*(elapsed+.001)+1, (before,after,actor)
    starts = {}
    moving_frames = {}
    running_segments = {}
    for identifier in PARTY:
        moved = [frame for frame in frames if frame['phase']=='entry' and pose(frame,identifier)['moving']]
        assert moved, identifier
        assert all(pose(frame,identifier)['gait']=='run' for frame in moved), identifier
        assert all(pose(frame,identifier)['facing']=='up' for frame in moved if pose(frame,identifier)['y']>1024)
        starts[identifier] = moved[0]['entry']['currentTile']
        moving_frames[identifier] = sorted({pose(frame,identifier).get('frame') for frame in moved})
        assert moving_frames[identifier]==['0','1','2'], (identifier,moving_frames)
        for frame in moved:
            expected = [1,0,2,0][math.floor(frame['elapsed']/62.5)%4]
            assert int(pose(frame,identifier)['frame'])==expected, (identifier,frame,expected)
        straight = []
        for before,after in zip(moved,moved[1:]):
            elapsed = (after['entry']['elapsed']-before['entry']['elapsed'])/1000
            if not elapsed:continue
            first,last = pose(before,identifier),pose(after,identifier)
            ratio = math.hypot(last['x']-first['x'],last['y']-first['y'])/(speed*elapsed)
            if ratio>1.85:straight.append(ratio)
        assert len(straight)>=3, (identifier,'Needs genuine faster-than-walk motion',straight)
        assert max(straight)<=2.00001, (identifier,straight)
        running_segments[identifier]=len(straight)
    assert starts['mira'] < starts['nell'] < starts['iris'] < starts['pip'], starts
    assert starts['pip']-starts['mira']<=4, ('The burst starts together rather than filing in slowly.',starts)
    stories = [frame for frame in frames if frame['phase']=='story']
    assert stories, frames[-3:]
    assert stories[0]['entry']['finished'], stories[0]
    duration = stories[0]['entry']['totalTiles']*stories[0]['entry']['quantumMs']
    assert duration<=2250, ('A stock entrance should rush into the room in about two seconds.',duration)
    assert all(pose(stories[0],identifier)['y'] <= page.evaluate('quietBell.scene.geometry.height') for identifier in PARTY)
    return {'fadeIsClockDriven':True,'staggeredParty':starts,'stepFrames':moving_frames,
            'allFourRunAtDoubleSpeed':True,'fasterRunCadence':True,'runningSegments':running_segments,
            'entryDurationMs':duration,'clusteredStarts':True,
            'noMovementJumpAtHandoff':True,'maxObservedWorldStep':maximum,'frames':len(frames)}


def replay(page):
    value = cutscene(page)
    if value:
        page.locator('#cutscene-skip').click()
    reset_trace(page)
    page.locator('#menu').click();page.locator('#replay-cutscene').click()


def opening_flow(browser, url, expected):
    context,page,errors,writes,external = ui.open_page(browser,url,1024,'dark',height=768,skip_cutscenes=False)
    base = paths.validate_release(page,expected)
    first = assert_first_event(page,'depot')
    original = cs.conserved(page)
    value = cutscene(page)
    if not value or value.get('phase')!='entry' or value['entry']['fadeOpacity'] < .8:
        reset_trace(page);replay(page)
    value = cutscene(page);assert_silent_entry(page,value)
    original_player = ui.walker(page)
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    paused = cutscene(page)
    assert not paused['playing']
    page.keyboard.down('ArrowRight');tick(page,300);page.keyboard.up('ArrowRight')
    assert cutscene(page)['entry']['currentTile'] == paused['entry']['currentTile']
    assert ui.walker(page) == original_player
    before_rate = paths.switch_rate(page,'#cutscene-speed')
    assert before_rate['playbackRate'] == 2 and not before_rate['playing']
    assert before_rate['entry']['currentTile'] == paused['entry']['currentTile']
    page.screenshot(path=str(OUT/'depot-fade-start.png'))
    # The burst's fade lasts less than a second. Observe a real frame inside
    # the document, then pause with the same blur event as the preceding check;
    # RPC/screenshot latency cannot consume the intermediate frame first.
    mid = page.evaluate('''()=>new Promise(resolve=>{
      window.dispatchEvent(new Event('focus'));
      function sample(){
        const value=quietBell.cutscene;
        if(!value||value.phase!=='entry'){resolve(null);return;}
        if(value.entry.fadeOpacity>.3&&value.entry.fadeOpacity<.7){
          window.dispatchEvent(new Event('blur'));resolve(value);return;
        }
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    })''')
    assert mid, 'The fade must expose intermediate opacity while the party walks.'
    assert_silent_entry(page,cutscene(page));assert cs.conserved(page)==original
    page.screenshot(path=str(OUT/'depot-fade-middle.png'))
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    for _ in range(100):
        value = cutscene(page)
        if value['phase'] != 'entry':break
        if all(pose(value,identifier)['y'] <= 1024 for identifier in PARTY):
            page.screenshot(path=str(OUT/'depot-party-through-door.png'));break
        tick(page,35)
    story = wait_story(page)
    assert story and story['phase']=='story' and story['beat'] and not story['entry']['fadeOpacity'], story
    assert page.locator('#cutscene-panel').is_visible()
    assert page.evaluate('document.activeElement?.id') == 'cutscene-next'
    assert page.locator('#room-map').evaluate('e=>e.style.overflow') != 'hidden'
    assert not page.locator('.room-entry-fade').is_visible()
    paths.assert_dialogue_clear_of_cast(page,minimum=1)
    page.screenshot(path=str(OUT/'depot-story-after-entry.png'))
    trace = assert_trace(page)
    assert cs.conserved(page) == original
    page.keyboard.press('Enter');tick(page,30)
    assert cutscene(page)['phase']=='story' and cutscene(page)['textComplete']
    page.locator('#cutscene-skip').click();tick(page,60)
    assert not cutscene(page);assert_inside(page)
    before_reload = cs.conserved(page);before_position = ui.walker(page)
    page.reload();page.wait_for_function('!!window.quietBell?.state');tick(page,80)
    paths.validate_release(page,expected)
    assert not cutscene(page) and cs.conserved(page)==before_reload
    assert math.hypot(ui.walker(page)['x']-before_position['x'],ui.walker(page)['y']-before_position['y']) < .1
    # Pay a real rhythm door, then revisit through its actual south threshold.
    ui.collect_sources(page)
    ui.press(page,'[data-door="garden"]');ui.build(page,['half','half-rest'])
    reset_trace(page);page.locator('#commit').click()
    page.wait_for_function('quietBell.state.roomId==="garden-porch"')
    assert_first_event(page,'garden-porch')
    arrival = cutscene(page);assert_silent_entry(page,arrival)
    committed = cs.conserved(page)
    page.screenshot(path=str(OUT/'garden-door-entry.png'))
    page.locator('#cutscene-skip').click();tick(page,50)
    assert cs.conserved(page)==committed;assert_inside(page)
    reset_trace(page);ui.press(page,'[data-return="return-depot"]')
    assert ui.state(page)['roomId']=='depot'
    revisited = cutscene(page);assert_silent_entry(page,revisited)
    assert revisited['totalTiles']==0, 'A seen room gets its doorway arrival without repeating its speech.'
    back = cs.conserved(page);finish_entry_only(page)
    assert cs.conserved(page)==back;assert_inside(page)
    assert not any(event['text'] for event in page.evaluate('window.__entryEvents'))
    no_errors(page,errors,writes,external);context.close()
    return {'releaseBase':base,'initialBlackFade':first['entry']['fadeOpacity'],**trace,
            'pauseAndDoubleSpeed':True,'storyWaitsForAllParty':True,'realRhythmDoorArrival':True,
            'seenRevisitEntryOnly':True,'skipSavesSafeFloor':True,'seenReloadResumes':True}


def open_entry_settings(page):
    details = page.locator('#developer-room-entry')
    if not details.evaluate('e=>e.open'):
        details.locator('summary').click()


def director_flow(browser,url,expected):
    context,page,errors,writes,external = ui.open_page(browser,url,1024,'light',height=768)
    base = paths.validate_release(page,expected);saved = cs.normal_storage(page);original = paths.resources(page)
    page.keyboard.press('F2');page.locator('[data-dev-tab="cutscene"]').click();tick(page,50)
    cs.select_timeline_mode(page)
    baseline = tracks.export_project(page,'entry-baseline')
    open_entry_settings(page)
    assert page.locator('#developer-room-entry-gait [data-cutscene-choice="run"]').get_attribute('aria-pressed')=='true'
    assert page.locator('#developer-room-entry-fade').input_value()=='6'
    assert page.locator('#developer-room-entry-spacing').input_value()=='1'
    page.locator('#developer-room-entry-gait [data-cutscene-choice="walk"]').click();tick(page,30)
    walking=tracks.export_project(page,'entry-walk')
    assert walking['scenes']['depot']['entry']['gait']=='walk'
    assert walking['content']==baseline['content'] and walking['doors']==baseline['doors'] and walking['sources']==baseline['sources']
    paths.history(page,'undo');walk_undo=tracks.export_project(page,'entry-walk-undo')
    assert walk_undo['scenes']['depot']==baseline['scenes']['depot']
    paths.history(page,'redo');assert tracks.export_project(page,'entry-walk-redo')['scenes']['depot']['entry']['gait']=='walk'
    open_entry_settings(page)
    for selector,value in [('#developer-room-entry-fade',18),('#developer-room-entry-spacing',3),('#developer-room-entry-door-x',736)]:
        tracks.set_number(page,selector,value)
    changed = tracks.export_project(page,'entry-settings-changed')
    config = changed['scenes']['depot']['entry']
    assert config['fadeTiles']==18 and config['staggerTiles']==3 and config['doorX']==736 and config['gait']=='walk', config
    assert changed['content']==baseline['content'] and changed['doors']==baseline['doors'] and changed['sources']==baseline['sources']
    paths.history(page,'undo');undone=tracks.export_project(page,'entry-settings-undo')
    assert undone['scenes']['depot'].get('entry',{}).get('doorX',768)==768
    paths.history(page,'redo');assert tracks.export_project(page,'entry-settings-redo')['scenes']['depot']['entry']==config
    tracks.import_project(page,changed,'entry-settings-import')
    assert tracks.export_project(page,'entry-settings-round-trip')['scenes']['depot']['entry']==config
    open_entry_settings(page);page.locator('#developer-cutscene-entry').click();tick(page,30)
    value=cutscene(page);assert_silent_entry(page,value)
    assert all(abs(pose(value,identifier)['x']-736)<.1 for identifier in PARTY)
    assert pose(value,'mira')['moving'] and pose(value,'mira')['gait']=='walk'
    assert 'Room entry' in page.locator('#developer-cutscene-time').inner_text()
    assert page.locator('.cutscene-path-overlay').count()==0
    page.locator('#developer-cutscene-pause').click();tick(page,30);paused=cutscene(page)
    tick(page,300);assert cutscene(page)['entry']['currentTile']==paused['entry']['currentTile']
    page.locator('#developer-cutscene-speed').click();tick(page,30)
    assert cutscene(page)['playbackRate']==2 and not cutscene(page)['playing']
    page.locator('#developer-cutscene-play').click();tick(page,90)
    assert cutscene(page)['entry']['currentTile'] > paused['entry']['currentTile']
    page.locator('#developer-cutscene-pause').click();tick(page,20)
    # A range already at zero emits no input for Home. Moving it first is a
    # genuine user seek, then Home returns precisely to authored story tile0.
    scrub=page.locator('#developer-cutscene-scrub');scrub.focus();page.keyboard.press('ArrowRight');tick(page,50)
    assert cutscene(page)['phase']=='story' and not cutscene(page)['playing']
    story=tracks.seek(page,0)
    assert story['phase']=='story' and story['entry']['finished'] and not story['entry']['fadeOpacity']
    assert not page.locator('.room-entry-fade').is_visible()
    assert page.locator('.cutscene-path-overlay').count()==1
    page.locator('#developer-cutscene-play').click();tick(page,120)
    assert cutscene(page)['phase']=='story' and cutscene(page)['currentTile'] > 0
    page.locator('#developer-cutscene-pause').click();tick(page,20);paused_story=cutscene(page)
    page.locator('#developer-cutscene-play').click();tick(page,120)
    assert cutscene(page)['phase']=='story' and cutscene(page)['currentTile'] > paused_story['currentTile']
    page.locator('#developer-cutscene-stop').click();tick(page,30)
    assert not cutscene(page) and not page.locator('.room-entry-fade').count()
    assert cs.normal_storage(page)==saved and paths.resources(page)==original
    open_entry_settings(page);page.locator('#developer-room-entry-gait [data-cutscene-choice="run"]').click();tick(page,30)
    running=tracks.export_project(page,'entry-run-custom-timing')
    assert running['scenes']['depot']['entry']=={**config,'gait':'run'}
    assert running['content']==baseline['content'] and running['doors']==baseline['doors'] and running['sources']==baseline['sources']
    page.locator('#developer-cutscene-entry').click();tick(page,30);run_first=cutscene(page)
    assert pose(run_first,'mira')['moving'] and pose(run_first,'mira')['gait']=='run'
    assert page.locator('#player-sprite').get_attribute('data-gait')=='run'
    tick(page,80);run_second=cutscene(page)
    elapsed=(run_second['entry']['elapsed']-run_first['entry']['elapsed'])/1000
    start,end=pose(run_first,'mira'),pose(run_second,'mira')
    travelled=math.hypot(end['x']-start['x'],end['y']-start['y'])
    speed=page.evaluate('quietBell.scene.geometry.speed')
    assert abs(travelled-speed*2*elapsed)<.001, (travelled,elapsed,speed)
    page.locator('#developer-cutscene-stop').click();tick(page,30)
    open_entry_settings(page);page.locator('#developer-room-entry-enabled').uncheck();tick(page,40)
    disabled=tracks.export_project(page,'entry-disabled')
    assert disabled['scenes']['depot']['entry']['enabled'] is False
    assert disabled['content']==baseline['content']
    assert page.locator('#developer-cutscene-entry').is_disabled()
    page.locator('#developer-apply').click();tick(page,50)
    assert cutscene(page)['phase']=='story' and not page.locator('.room-entry-fade').is_visible()
    page.locator('#cutscene-skip').click();tick(page,30)
    page.locator('#developer-end').click();tick(page,30)
    assert cs.normal_storage(page)==saved and paths.resources(page)==original
    page.keyboard.press('F2');page.locator('[data-dev-tab="cutscene"]').click();tick(page,30)
    cs.select_timeline_mode(page)
    # A room with no story still receives a real party arrival. Its resident
    # stays inside rather than joining the travelling party at the doorway.
    empty=copy.deepcopy(baseline);empty['settings']['startRoomId']='canal-porch'
    empty['content']['canal-porch']['cutscene']=[]
    tracks.import_project(page,empty,'empty-story-entry')
    page.locator('[data-dev-room="canal-porch"]').click();tick(page,40)
    page.locator('#developer-apply').click();tick(page,40)
    assert ui.state(page)['developerMode'] and ui.state(page)['roomId']=='canal-porch'
    value=cutscene(page);assert_silent_entry(page,value);resident=pose(value,'oren')
    assert not resident['moving'] and value['totalTiles']==0
    for _ in range(200):
        value=cutscene(page)
        if not value:break
        assert pose(value,'oren')['x']==resident['x'] and pose(value,'oren')['y']==resident['y']
        assert not pose(value,'oren')['moving'] and value['beat'] is None
        tick(page,50)
    assert not cutscene(page);assert_inside(page)
    before=ui.walker(page);page.reload();page.wait_for_function('!!window.quietBell?.state');tick(page,60)
    paths.validate_release(page,expected)
    assert not cutscene(page) and math.hypot(ui.walker(page)['x']-before['x'],ui.walker(page)['y']-before['y'])<.1
    page.locator('#menu').click();assert page.locator('#replay-cutscene').is_visible()
    page.locator('#replay-cutscene').click();assert_silent_entry(page,cutscene(page))
    assert cutscene(page)['totalTiles']==0;finish_entry_only(page)
    page.locator('#developer-end').click();tick(page,50)
    assert cs.normal_storage(page)==saved and paths.resources(page)==original
    # Outcome locations also stage an entry before their discussion.
    page.keyboard.press('F2');page.locator('[data-dev-tab="cutscene"]').click();tick(page,30)
    cs.select_timeline_mode(page)
    ending=copy.deepcopy(baseline);ending['settings']['startRoomId']='ending-home'
    tracks.import_project(page,ending,'ending-entry')
    page.locator('[data-dev-room="ending-home"]').click();tick(page,30)
    page.locator('#developer-apply').click();tick(page,30)
    assert ui.state(page)['phase']=='terminal' and ui.state(page)['roomId']=='ending-home'
    assert_silent_entry(page,cutscene(page));assert page.locator('#outcome').is_hidden()
    page.locator('#cutscene-skip').click();tick(page,30);assert_inside(page)
    page.locator('#developer-end').click();tick(page,30)
    assert cs.normal_storage(page)==saved and paths.resources(page)==original
    no_errors(page,errors,writes,external);context.close()
    return {'releaseBase':base,'entrySettingsUndoAndRoundTrip':True,'entryPaceUndoAndRoundTrip':True,
            'walkAndRunPreview':True,'explicitEntryTimingPreserved':True,'storyTimingUnchanged':True,
            'previewPauseRateAndSeek':True,'storyResumeDoesNotRestartEntry':True,'entryCanBeDisabled':True,'emptyStoryEntry':True,
            'residentStaysInside':True,'entryOnlyReloadResumes':True,'emptyStorySettingsReplay':True,'endingEntry':True,
            'normalSaveBytesUntouched':True}


def phone_flow(browser,url,expected,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,390,'dark',height=844,
        skip_cutscenes=False,reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected);assert_first_event(page,'depot');original=cs.conserved(page)
    value=cutscene(page)
    if not value or value.get('phase')!='entry' or value['entry']['fadeOpacity']<.8:replay(page)
    assert_silent_entry(page,cutscene(page));page.locator('#cutscene-speed').tap()
    assert cutscene(page)['playbackRate']==2
    tick(page,220);assert_silent_entry(page,cutscene(page))
    page.screenshot(path=str(OUT/('phone-reduced-fade.png' if reduced else 'phone-fade.png')))
    story=wait_story(page);assert story and story['beat']
    trace=assert_trace(page);assert cs.conserved(page)==original
    paths.assert_dialogue_clear_of_cast(page,minimum=1)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    page.locator('#cutscene-skip').tap();tick(page,40);assert_inside(page)
    no_errors(page,errors,writes,external);context.close()
    return {'releaseBase':base,'width':390,'reducedMotion':reduced,'actualTouchSpeedControl':True,
            'entryAndFade':trace,'noDocumentOverflow':True,'dialogueClearOfVisibleCast':True}


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
            raw=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            browser=TraceBrowser(cs.PublicBrowser(raw) if args.url else raw)
            result={'passed':True,'entry':url,'opening':opening_flow(browser,url,args.expect_release),
                    'director':director_flow(browser,url,args.expect_release),
                    'phones':[phone_flow(browser,url,args.expect_release,reduced) for reduced in [False,True]]}
            raw.close()
        result['seconds']=round(time.monotonic()-started,1)
        name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
