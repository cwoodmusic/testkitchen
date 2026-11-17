"""Caption-timed Pip reactions and the Parcel Depot's temporary story props.

The actual dialogue controls, authoring seeks and playtests drive every state.
Normal saves, retained room nodes and native layout work are observed read-only.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/depot-reactions-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('depot_manual',ROOT/'tests/quiet-bell-manual-dialogue-browser.py')
manual=importlib.util.module_from_spec(spec);spec.loader.exec_module(manual)
cs,ui,paths,tracks=manual.cs,manual.ui,manual.paths,manual.tracks


def tick(page,ms=100):cs.tick(page,max(1,round(ms)))
def state(page):return cs.cutscene(page)
def line_id(page):return manual.line_id(state(page))
def press(page,selector):
    getattr(page.locator(selector),'tap' if page.viewport_size['width']<500 else 'click')()


def crop(page,selector,name):
    bounds=page.locator(selector).bounding_box();assert bounds,(selector,bounds)
    page.screenshot(path=str(OUT/name),clip=bounds)


def next_line(page):
    old=line_id(page);assert old,state(page)
    if not state(page)['textComplete']:press(page,'#cutscene-next')
    press(page,'#cutscene-next')
    assert line_id(page)!=old,state(page)


def to_line(page,identifier):
    for _ in range(8):
        if line_id(page)==identifier:return
        next_line(page)
    raise AssertionError((identifier,state(page)))


def visibility(page,hidden):
    if hidden:
        page.evaluate('''()=>{
          window.__depotVisibility=['hidden','visibilityState'].map(key=>[key,Object.getOwnPropertyDescriptor(document,key)]);
          Object.defineProperty(document,'hidden',{configurable:true,value:true});
          Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
          document.dispatchEvent(new Event('visibilitychange'));
        }''')
    else:
        page.evaluate('''()=>{
          for(const[key,descriptor]of window.__depotVisibility)if(descriptor)Object.defineProperty(document,key,descriptor);else delete document[key];
          delete window.__depotVisibility;document.dispatchEvent(new Event('visibilitychange'));
        }''')


def observe(page):
    """Read the helper contract and rendered layers without changing transport."""
    return page.evaluate('''async()=>{
      const s=quietBell.cutscene;
      const {getDialogueReaction,getDialogueStageCue}=await import(new URL('dialogue-reactions.mjs',document.baseURI));
      const nodes=[...document.querySelectorAll('.cutscene-emote[data-character="pip"]')].map(n=>({
        hidden:n.hidden,emote:n.dataset.cutsceneEmote,dataset:{...n.dataset},opacity:n.style.opacity,transform:n.style.transform}));
      const partSelectors='.depot-courier-sprite,.depot-radar-sweep,.depot-radar-flash,.depot-radar-pulse,.depot-radar-center';
      const read=n=>n?{hidden:n.hidden,dataset:{...n.dataset},style:n.getAttribute('style')}:null;
      const bird=document.querySelector('.depot-courier'),radar=document.querySelector('.depot-radar');
      return{reaction:s?getDialogueReaction(s):null,cue:s?getDialogueStageCue(s):null,emotes:nodes,
        stage:bird||radar?{bird:read(bird),radar:read(radar),
          parts:[...document.querySelectorAll(partSelectors)].map(n=>({part:n.classList[0],...read(n)}))}:null};
    }''')


def active_shock(value):
    assert value['reaction'] and value['reaction']['actorId']=='pip' and value['reaction']['emote']=='surprise',value
    assert any(not n['hidden'] and n['emote']=='surprise' and n['dataset'].get('dialogueReaction')=='true' for n in value['emotes']),value
    return value['reaction']


def assert_cue(value,name):
    assert value['cue'] and value['cue']['cue']==name,value
    stage=value['stage'];assert stage and not stage['radar']['hidden'] and stage['radar']['dataset']['stageCue']==name,value
    if name=='courier-signal':assert not stage['bird']['hidden'] and stage['bird']['dataset']['stageCue']==name,value
    else:assert stage['bird']['hidden'],value


def assert_prop_bounds(page):
    value=page.evaluate('''()=>{
      const view=document.getElementById('room-scene').getBoundingClientRect();
      return[...document.querySelectorAll('.depot-courier-sprite,.depot-radar')].map(n=>{const r=n.getBoundingClientRect();
        return{part:n.className,x:r.x,right:r.right,y:r.y,bottom:r.bottom,view:{x:view.x,y:view.y,right:view.right,bottom:view.bottom}};});
    }''')
    for part in value:
        view=part['view'];assert part['x']>=view['x']-1 and part['right']<=view['right']+1 and part['y']>=view['y']-1 and part['bottom']<=view['bottom']+1,part
    return value


def safe(page,errors,writes,external):
    ui.protected_storage(page);paths.no_errors(errors,writes,external)


def room_probe(page):
    page.evaluate('''()=>{
      window.__roomRetention=(()=>{const map=document.getElementById('room-map');
      const direct=[...map.children].filter(n=>![...n.classList].some(c=>c.startsWith('cutscene-')||c==='depot-courier'||c==='depot-radar'));
      const actors=[...map.querySelectorAll('.mg-npc[data-actor]')].map(node=>({id:node.dataset.actor,node}));
      const retained=[map,...direct,...actors.map(a=>a.node)],removed=[];
      const observer=new MutationObserver(records=>{for(const record of records)for(const gone of record.removedNodes)for(const node of retained)
        if(gone===node||gone.contains?.(node))removed.push(node===map?'room-map':node.dataset.actor??node.id??node.className);});
      observer.observe(map.parentElement,{childList:true,subtree:true});
      return{read(){return{sameMap:document.getElementById('room-map')===map,directRetained:direct.every(n=>n.parentElement===map),
        sameActors:actors.every(a=>document.querySelector('.mg-npc[data-actor="'+a.id+'"]')===a.node),removed:[...removed]};},stop(){observer.disconnect();}};})();
    }''')


def retained(page):
    value=page.evaluate('window.__roomRetention.read()')
    assert value['sameMap'] and value['directRetained'] and value['sameActors'] and not value['removed'],value
    return value


def manual_flow(browser,url,expected,width=1024,reduced=False,delay=0):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',
        reduced_motion='reduce' if reduced else 'no-preference')
    page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
    base=paths.validate_release(page,expected);original=cs.conserved(page)
    cs.replay(page);assert line_id(page)=='depot-arrival-1'
    tick(page,delay)
    physical_before=state(page)['currentTile'];next_line(page)
    assert line_id(page)=='depot-arrival-2'
    first=observe(page);reaction=active_shock(first);assert reaction['elapsedMs']<=40,first
    assert_cue(first,'courier-signal')
    room_probe(page);tick(page,350);before_reveal=observe(page);age=active_shock(before_reveal)['elapsedMs']
    assert before_reveal['stage']['bird']['dataset']['phase']=='turn' and before_reveal['stage']['bird']['dataset']['frame']=='2',before_reveal
    bounds=assert_prop_bounds(page)
    if not state(page)['textComplete']:
        press(page,'#cutscene-next');after_reveal=observe(page)
        assert active_shock(after_reveal)['elapsedMs']>=age and line_id(page)=='depot-arrival-2',after_reveal
    tick(page,200);visible=observe(page);active_shock(visible)
    assert visible['stage']!=first['stage'] or reduced,'The courier illustration should move during this caption.'
    # Pause via visibility/blur freezes the caption clock and its prop illustration.
    visibility(page,True);paused=observe(page);clock=state(page)
    if width==1024 and not delay:
        page.screenshot(path=str(OUT/'pip-shock-and-courier-desktop.png'))
        crop(page,'.depot-courier-sprite','courier-turn-crop.png')
        crop(page,'.cutscene-emote[data-character="pip"]','pip-shock-crop.png')
    tick(page,600);assert observe(page)==paused and state(page)==clock
    visibility(page,False);tick(page,200);assert state(page)['dialogueElapsed']>clock['dialogueElapsed']
    page.evaluate('window.dispatchEvent(new Event("blur"))');paused=observe(page);clock=state(page)
    tick(page,400);assert observe(page)==paused and state(page)==clock
    page.evaluate('window.dispatchEvent(new Event("focus"))');tick(page,200)
    assert state(page)['dialogueElapsed']>clock['dialogueElapsed']
    assert observe(page)['stage']['bird']['dataset']['phase']=='ruffle',observe(page)
    # A held, fully revealed caption still gives its transient reaction time to settle.
    current=active_shock(observe(page))
    if not reduced:
        tick(page,max(0,current['durationMs']-current['elapsedMs']-100))
        fading=observe(page);active_shock(fading)
        visible=[n for n in fading['emotes'] if not n['hidden'] and n['dataset'].get('dialogueReaction')=='true']
        assert any(0<float(n['opacity'])<.8 for n in visible),fading
    tick(page,reaction['durationMs']+500);settled=observe(page)
    assert settled['reaction'] is None and line_id(page)=='depot-arrival-2',settled
    assert retained(page);page.evaluate('window.__roomRetention.stop()')
    to_line(page,'depot-arrival-4');assert_cue(observe(page),'radar')
    before=observe(page);tick(page,700);received=observe(page);assert received['stage']!=before['stage'] or reduced
    assert received['stage']['radar']['dataset']['phase']=='received' and received['stage']['radar']['dataset']['received']=='true',received
    flash=next(p for p in received['stage']['parts'] if p['part']=='depot-radar-flash')
    assert 'opacity: 0.' in flash['style'],received
    if width==1024 and not delay:crop(page,'.depot-radar','radar-received-crop.png')
    cs.assert_panel_layout(page);page.screenshot(path=str(OUT/f'depot-{width}-{reduced}-{delay}.png'))
    tick(page,2500);assert observe(page)['stage']['radar']['dataset']['phase']=='no-reply',observe(page)
    tick(page,2000);settled_props=observe(page)
    assert all(settled_props['stage'][key]['dataset']['active']=='false' for key in ['bird','radar']),settled_props
    if delay:
        settled_clock=state(page)['dialogueElapsed'];tick(page,300);assert state(page)['dialogueElapsed']==settled_clock,'Finite props must eventually stop idle RAF work.'
    to_line(page,'depot-arrival-6');assert_cue(observe(page),'courier-signal')
    press(page,'#cutscene-skip');tick(page,80)
    assert not state(page) and not observe(page)['stage']
    assert page.locator('.cutscene-emote[data-dialogue-reaction="true"]').count()==0
    assert not page.locator('.mg-npc[data-actor="pip"]').evaluate('n=>n.hasAttribute("data-dialogue-reaction")')
    assert cs.conserved(page)==original
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':width,'reducedMotion':reduced,'delayMs':delay,'physicalTileAtPip':physical_before,
        'immediateShock':True,'revealDoesNotRestart':True,'naturalSettle':True,'birdRadarAndFinalWitness':True,
        'pauseVisibilityAndBlur':True,'retainedRoomNodes':True,'propBounds':bounds,'skipCleanup':True,'resourcesUnchanged':True}


def editor_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light')
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);original=cs.conserved(page)
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    starts={clip['id']:clip['startTile'] for clip in project['content']['depot']['cutscene'] if clip['kind']=='dialogue'}
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    press(page,'[data-dev-tab="cutscene"]')
    pip_index=next(i for i,c in enumerate(project['content']['depot']['cutscene']) if c['id']=='depot-arrival-2')
    press(page,f'[data-cutscene-dialogue-index="{pip_index}"]')
    press(page,'#developer-cutscene-reactions summary')
    assert page.locator('[data-dialogue-reaction="surprise"]').get_attribute('aria-pressed')=='true'
    assert page.locator('[data-dialogue-stage-cue="courier-signal"]').get_attribute('aria-pressed')=='true'
    press(page,'[data-dialogue-reaction="question"]');press(page,'[data-dialogue-reaction="surprise"]')
    press(page,'[data-dialogue-stage-cue="none"]');press(page,'[data-dialogue-stage-cue="courier-signal"]')
    tools=page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):tools.locator('summary').click()
    page.locator('#developer-cutscene-dialogue-reaction-duration').fill('18')
    assert page.locator('#developer-cutscene-dialogue-reaction-duration').evaluate('n=>document.activeElement===n')
    with page.expect_download() as event:page.locator('#developer-export').dispatch_event('click')
    target=OUT/'authored-depot-reaction.json';event.value.save_as(target);authored=json.loads(target.read_text())
    if tools.evaluate('e=>e.open'):tools.locator('summary').click()
    changed=authored['content']['depot']['cutscene'][pip_index]
    assert changed['reaction']=={'emote':'surprise','durationTiles':18} and changed['stageCue']=='courier-signal',changed
    for index,raw in enumerate(project['content']['depot']['cutscene']):
        actual=authored['content']['depot']['cutscene'][index]
        assert actual==({**raw,'reaction':{'emote':'surprise','durationTiles':18}} if index==pip_index else raw)
    # Pending numeric input must not rebuild the actual NPC before its click arrives.
    page.locator('#developer-cutscene-dialogue-reaction-duration').fill('20')
    press(page,'#room-map [data-person="nell"]')
    assert page.locator('[data-dialogue-speaker="nell"]').get_attribute('aria-pressed')=='true'
    after_actor=tracks.export_project(page,'depot-pending-duration-npc')
    assert after_actor['content']['depot']['cutscene'][pip_index]['reaction']['durationTiles']==20
    press(page,f'[data-cutscene-dialogue-index="{pip_index}"]')
    if not page.locator('#developer-cutscene-reactions').evaluate('n=>n.open'):press(page,'#developer-cutscene-reactions summary')
    page.locator('#developer-cutscene-dialogue-reaction-duration').fill('18')
    page.locator('#developer-save').dispatch_event('click');tick(page,50)
    cs.select_timeline_mode(page)
    tracks.start_paused(page)
    tracks.seek(page,starts['depot-arrival-2']+3);first=observe(page);active_shock(first);assert_cue(first,'courier-signal')
    tick(page,800);assert observe(page)==first,'A paused director preview must retain the exact speech reaction pose.'
    tracks.seek(page,starts['depot-arrival-2']+6);later=observe(page)
    assert active_shock(later)['progress']>first['reaction']['progress']
    tracks.seek(page,starts['depot-arrival-2']+3);assert observe(page)==first,'Seeking to the same tile must recreate the same pose.'
    tracks.seek(page,starts['depot-arrival-4']+3);assert_cue(observe(page),'radar')
    press(page,'#developer-cutscene-play');tick(page,350);press(page,'#developer-cutscene-pause')
    frozen=observe(page);tick(page,700);assert observe(page)==frozen
    press(page,'#developer-cutscene-stop');tick(page,60);assert not state(page) and not observe(page)['stage']
    # Apply uses the same caption effects in the real, manually advanced playtest.
    press(page,'#developer-apply');page.locator('#developer-console').wait_for(state='hidden');cs.wait_for_story(page)
    to_line(page,'depot-arrival-2');active_shock(observe(page));assert_cue(observe(page),'courier-signal')
    press(page,'#cutscene-skip');tick(page,80);assert not observe(page)['stage']
    assert cs.normal_storage(page)==normal
    # A different room does not instantiate depot art or inherit its speech cues.
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    press(page,'[data-dev-room="garden-porch"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
    page.locator('#developer-console').wait_for(state='hidden');cs.wait_for_story(page)
    assert state(page)['roomId']=='garden-porch' and not observe(page)['stage'] and not observe(page)['cue'] and not observe(page)['reaction']
    press(page,'#cutscene-skip');tick(page,60);press(page,'#developer-end');tick(page,80)
    assert cs.normal_storage(page)==normal and cs.conserved(page)==original
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'deterministicCaptionSeek':True,'previewPauseAndStopCleanup':True,
        'authoredReactionAndPropControls':True,'focusedDurationExport':True,'pendingDurationActualNpcClick':True,
        'actualPlaytest':True,'otherRoomHasNoDepotEffects':True,'normalSaveBytesUntouched':True}


def native_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark',virtual_walk=False)
    base=paths.validate_release(page,expected);original=cs.conserved(page);normal=cs.normal_storage(page)
    # Isolate newly animated props from the existing moving player's left/top.
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    project['scenes']['depot']['entry']={'enabled':False}
    project['content']['depot']['cutscene']=[clip for clip in project['content']['depot']['cutscene'] if clip['kind']=='dialogue']
    manual.apply_project(page,project);to_line(page,'depot-arrival-2');active_shock(observe(page))
    # Caption measurement and overlay creation happen once before the interval.
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    cdp=context.new_cdp_session(page);cdp.send('Performance.enable')
    def metrics():return{m['name']:m['value'] for m in cdp.send('Performance.getMetrics')['metrics']}
    room_probe(page)
    page.evaluate('''()=>{
      window.__depotFrames=[];let remaining=80;
      function frame(){const s=quietBell.cutscene;if(!s||remaining--<=0)return;
        window.__depotFrames.push({elapsed:s.dialogueElapsed,tile:s.currentTile,
          parts:[...document.querySelectorAll('.depot-courier-sprite,.depot-radar-sweep,.depot-radar-flash,.depot-radar-pulse')].map(n=>n.getAttribute('style'))});requestAnimationFrame(frame);}
      requestAnimationFrame(frame);
    }''')
    before=metrics();page.wait_for_timeout(1000);after=metrics();frames=page.evaluate('window.__depotFrames')
    assert len(frames)>=20 and frames[-1]['elapsed']>frames[0]['elapsed'],frames
    assert len({json.dumps(row['parts']) for row in frames})>=3,frames
    layout_count=after.get('LayoutCount',0)-before.get('LayoutCount',0)
    to_line(page,'depot-arrival-4')
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    before=metrics();page.wait_for_timeout(1000);after=metrics()
    radar_layouts=after.get('LayoutCount',0)-before.get('LayoutCount',0)
    assert layout_count<=3,('Reaction playback must not measure layout on each frame.',layout_count)
    assert radar_layouts<=3,('Radar playback must not measure layout on each frame.',radar_layouts)
    retention=retained(page);page.evaluate('window.__roomRetention.stop()')
    press(page,'#cutscene-skip');tick(page,100);assert not observe(page)['stage']
    press(page,'#developer-end');tick(page,80)
    assert cs.conserved(page)==original and cs.normal_storage(page)==normal
    cdp.detach();safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'nativeFrames':len(frames),'layoutCount':layout_count,'radarLayoutCount':radar_layouts,'retention':retention,
        'noPerFrameLayout':True,'resourcesUnchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'manual':[manual_flow(runner,url,args.expect_release),
                manual_flow(runner,url,args.expect_release,delay=60000),
                manual_flow(runner,url,args.expect_release,390),manual_flow(runner,url,args.expect_release,320,True)],
                'editor':editor_flow(runner,url,args.expect_release),'native':native_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
