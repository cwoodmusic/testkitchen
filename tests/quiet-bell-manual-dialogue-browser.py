"""Player-paced JRPG dialogue without skipping physical party performances.

Real clicks/keys drive normal play and imported authoring fixtures. Read-only
snapshots, native frame observations and WebAudio scheduling prove the result.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import copy
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/manual-dialogue-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('manual_party',ROOT/'tests/quiet-bell-party-performance-browser.py')
party=importlib.util.module_from_spec(spec);spec.loader.exec_module(party)
cs,ui,paths,tracks=party.cs,party.ui,party.paths,party.tracks
entry_spec=importlib.util.spec_from_file_location('manual_entry',ROOT/'tests/quiet-bell-room-entry-browser.py')
entry=importlib.util.module_from_spec(entry_spec);entry_spec.loader.exec_module(entry)


def tick(page,ms=100):cs.tick(page,ms)
def state(page):return cs.cutscene(page)
def line_id(value):return (value.get('beat') or {}).get('id') if value else None


def click_box(page,selector='#cutscene-panel'):
    # Observe the actual input atomically so unrelated RAF callbacks cannot
    # masquerade as a click-triggered movement jump or audio burst.
    page.locator(selector).evaluate('''node=>{
      window.__manualClick={};
      const take=()=>({state:quietBell.cutscene,audio:(window.__partyAudioEvents??[]).filter(e=>e.kind==='start').length});
      node.addEventListener('click',()=>window.__manualClick.before=take(),{capture:true,once:true});
      node.addEventListener('click',()=>window.__manualClick.after=take(),{once:true});
    }''')
    action=page.locator(selector).tap if page.viewport_size['width']<500 else page.locator(selector).click
    action(position={'x':24,'y':18} if selector=='#cutscene-panel' else None)
    observed=page.evaluate('window.__manualClick')
    assert observed.get('before') and observed.get('after'),observed
    before,after=observed['before']['state'],observed['after']['state']
    if before and after:
        assert abs(before['currentTile']-after['currentTile'])<.000001,(before,after)
        assert all(cs.point_distance(cs.actor(before,a['id']),a)<.000001 for a in after['actors'])
    assert observed['before']['audio']==observed['after']['audio'],'A control click cannot emit a catch-up burst.'
    return before,after


def wait_complete(page):
    for _ in range(600):
        value=state(page)
        assert value and value.get('manualDialogue'),value
        if value['textComplete']:return value
        tick(page,100)
    raise AssertionError(state(page))


def frame_trace(page):
    page.evaluate('''()=>{
      window.__manualPhysical=[];let count=0;
      function frame(){
        const value=quietBell.cutscene;if(!value||count++>=600)return;
        window.__manualPhysical.push({tile:value.currentTile,actors:value.actors.map(a=>({id:a.id,x:a.x,y:a.y,gait:a.gait,moving:a.moving,gesture:a.gesture,facing:a.facing}))});
        requestAnimationFrame(frame);
      }requestAnimationFrame(frame);
    }''')


def normal_flow(browser,url,expected,width=1024,reduced=False):
    context,page,errors,writes,external=ui.open_page(entry.TraceBrowser(browser),url,width,'dark',
        height=844 if width<500 else 768,skip_cutscenes=False,reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected)
    # Network/image loading can outlast the short initial physical cues. Replay
    # through normal controls after load so every device observes the same start.
    if state(page):page.locator('#cutscene-skip').click()
    page.evaluate('window.__entryFrames=[];window.__entryEvents=[]')
    page.locator('#menu').click();page.locator('#replay-cutscene').click()
    cs.wait_for_story(page);tick(page,100)
    initial=state(page);assert initial and initial.get('manualDialogue') and initial.get('awaitingAdvance'),initial
    original=cs.conserved(page);first_id=line_id(initial)
    frame_trace(page);tick(page,800)
    partial=state(page)
    assert line_id(partial)==first_id and 0<partial['visibleCharacters']<partial['totalCharacters'],partial
    before,revealed=click_box(page)
    assert line_id(revealed)==first_id and revealed['textComplete']
    assert revealed['visibleCharacters']==revealed['totalCharacters']
    tick(page,60000)
    held=state(page)
    assert held and line_id(held)==first_id and held['textComplete'] and not held['finished'],held
    assert held['awaitingAdvance']
    assert page.locator('#cutscene-panel').get_attribute('data-dialogue-state')=='waiting'
    physical=page.evaluate('window.__manualPhysical')
    assert max(sum(a['moving'] for a in sample['actors']) for sample in physical)>=3
    seen={a['gesture'] for sample in physical for a in sample['actors'] if a['id']=='pip' and a.get('gesture')}
    assert {'trip','fallen','recover'}<=seen,seen
    entry_frames=page.evaluate('window.__entryFrames')
    stories=[frame for frame in entry_frames if frame.get('phase')=='story']
    assert stories
    assert not any(all(a['facing']=='down' for a in frame['actors'] if a['id'] in ['mira','nell','iris','pip']) for frame in stories[:5]),stories[:5]
    page.screenshot(path=str(OUT/f'held-{width}-{reduced}.png'))
    before,second=click_box(page)
    assert line_id(second)!=first_id and second['visibleCharacters']<=1,second
    visited=[first_id,line_id(second)]
    # Keyboard and visible Next use the same first-reveal/second-advance rule.
    tick(page,450);old=state(page);assert not old['textComplete']
    page.keyboard.press('Space');revealed=state(page)
    assert line_id(revealed)==line_id(old) and revealed['textComplete']
    page.keyboard.press('e');third=state(page)
    assert line_id(third)!=line_id(revealed);visited.append(line_id(third))
    for _ in range(12):
        value=state(page)
        if not value:break
        done=wait_complete(page)
        tick(page,4000)
        assert line_id(state(page))==line_id(done),'Even complete lines await an explicit acknowledgement.'
        before,after=click_box(page,'#cutscene-next')
        if after and line_id(after):visited.append(line_id(after))
        tick(page,80)
    assert not state(page),state(page)
    authored=page.evaluate('quietBell.project.content.depot.cutscene.filter(c=>c.kind==="dialogue").map(c=>c.id)')
    assert visited==authored,(visited,authored)
    party.safe_saved_floor(page);assert cs.conserved(page)==original
    feet=ui.walker(page);page.reload();page.wait_for_function('!!window.quietBell?.state');tick(page,100)
    paths.validate_release(page,expected)
    assert not state(page) and cs.point_distance(feet,ui.walker(page))<.1
    assert cs.conserved(page)==original
    ui.protected_storage(page);paths.no_errors(errors,writes,external);context.close()
    return {'releaseBase':base,'width':width,'reducedMotion':reduced,'manualLines':visited,
            'sixtySecondHold':True,'firstClickRevealsNextAdvances':True,'keyboardSpaceAndE':True,
            'physicalActionsContinue':sorted(seen),'noCommonSouthHandoffFrame':True,'safeFinishAndReload':True}


def long_project(page):
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    text=('Look at the tiny brass scratches around this receiver. Somebody repaired it with the window open, because the green pollen is caught beneath the new thread. '
          'I call that a promising clue, and I refuse to let a hurried conversation carry it away before we have looked properly. '
          'If there is a bakery at the far end of this mystery, I shall investigate that with equal determination. ')*3
    text=text[:599]+'.'
    assert len(text)==600
    project['content']['depot']['cutscene']=[
        {'id':'manual-long-first','kind':'dialogue','actor':'mira','speaker':'mira','text':text,'startTile':0,'durationTiles':1},
        {'id':'manual-long-second','kind':'dialogue','actor':'iris','speaker':'iris','text':'Your observations are specific. Your bakery hypothesis requires evidence. We may examine both without rushing either conclusion.','startTile':1,'durationTiles':1}]
    project['scenes']['depot']['entry']={'enabled':False}
    return project


def apply_project(page,project):
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').click()
    cs.select_timeline_mode(page)
    tracks.import_project(page,project,'manual-long-dialogue')
    page.locator('#developer-apply').click();page.locator('#developer-console').wait_for(state='hidden')
    assert ui.state(page)['developerMode']
    assert state(page) and state(page)['manualDialogue'] and not state(page)['preview']


def long_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',height=768)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);original=cs.conserved(page)
    apply_project(page,long_project(page));tick(page,600)
    first=state(page);assert first['totalCharacters']==600 and not first['textComplete'],first
    physical_tile=first['currentTile'];shown=first['visibleCharacters'];tick(page,1800)
    later=state(page)
    assert later['currentTile']==physical_tile and later['visibleCharacters']>shown,later
    assert later['dialogueElapsed']>first['dialogueElapsed']
    tick(page,70000)
    held=state(page);assert line_id(held)=='manual-long-first' and held['textComplete'],held
    assert page.locator('#cutscene-line').evaluate('e=>e.scrollTop>0'),'The full600-character line scrolls within the fixed JRPG window.'
    cs.assert_panel_layout(page);page.screenshot(path=str(OUT/'long-line-held.png'))
    _,second=click_box(page);assert line_id(second)=='manual-long-second' and second['visibleCharacters']<=1
    wait_complete(page);tick(page,10000)
    assert line_id(state(page))=='manual-long-second'
    page.keyboard.press('Enter');tick(page,100);assert not state(page)
    assert cs.normal_storage(page)==normal and cs.conserved(page)==original
    # Authored director preview keeps automatic tile timing and silent seeking.
    page.keyboard.press('F2');page.locator('[data-dev-tab="cutscene"]').click()
    cs.select_timeline_mode(page)
    page.locator('#developer-cutscene-play').click();tick(page,1000)
    preview=state(page);assert preview and preview['preview'] and not preview['manualDialogue'] and preview['finished'],preview
    page.locator('#developer-cutscene-scrub').focus();page.keyboard.press('Home');tick(page,80)
    preview=state(page);assert preview['currentTile']==0 and not preview['playing'] and not preview['manualDialogue']
    old=copy.deepcopy(preview);click_box(page)
    assert state(page)==old,'Clicking the director canvas cannot acknowledge or retime authored dialogue.'
    page.locator('#developer-cutscene-stop').click();tick(page,60)
    page.locator('[data-dev-tab="playtest"]').click();page.locator('#developer-return').click();tick(page,100)
    assert not ui.state(page)['developerMode'] and cs.normal_storage(page)==normal
    ui.protected_storage(page);paths.no_errors(errors,writes,external);context.close()
    return {'releaseBase':base,'characters':600,'revealOutlastsPhysicalClock':True,'scrollsAndWaits':True,
            'followingLineGetsFreshRevealClock':True,'directorAutoTimingAndSeekUnchanged':True,'normalSaveBytesUntouched':True}


def audio_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(party.AudioTraceBrowser(browser),url,1024,'light',height=768,virtual_walk=False)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);original=cs.conserved(page)
    apply_project(page,long_project(page))
    page.wait_for_function('quietBell.cutscene?.currentTile>=quietBell.cutscene?.totalTiles')
    before=state(page);starts=len(party.audio_starts(page));page.wait_for_timeout(700)
    after=state(page);new=party.audio_starts(page)[starts:]
    assert after['currentTile']==before['currentTile'] and after['visibleCharacters']>before['visibleCharacters']
    assert len(new)>=3,new
    assert all(abs(event['frequency']/350-1)<.06 for event in new),new
    _,revealed=click_box(page);assert revealed['textComplete'] and line_id(revealed)=='manual-long-first'
    page.evaluate('window.dispatchEvent(new Event("blur"))');count=len(party.audio_starts(page));age=state(page)['dialogueElapsed'];page.wait_for_timeout(200)
    assert len(party.audio_starts(page))==count and state(page)['dialogueElapsed']==age
    page.evaluate('window.dispatchEvent(new Event("focus"))');_,second=click_box(page)
    assert line_id(second)=='manual-long-second'
    count=len(party.audio_starts(page));page.wait_for_timeout(450)
    assert any(abs(event['frequency']/270-1)<.06 for event in party.audio_starts(page)[count:])
    page.locator('#cutscene-skip').click();count=len(party.audio_starts(page));page.wait_for_timeout(180)
    assert not state(page) and len(party.audio_starts(page))==count
    assert cs.normal_storage(page)==normal and cs.conserved(page)==original
    ui.protected_storage(page);paths.no_errors(errors,writes,external);context.close()
    return {'releaseBase':base,'realBloopsContinueAfterPhysicalEnd':True,'silentRevealAndAdvanceClicks':True,
            'pauseAndSkipStopSound':True,'nextSpeakerFreshVoice':True,'normalSaveBytesUntouched':True}


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
            result={'passed':True,'entry':url,'normal':normal_flow(runner,url,args.expect_release),
                'phones':[normal_flow(runner,url,args.expect_release,390,reduced) for reduced in [False,True]],
                'longLine':long_flow(runner,url,args.expect_release),'audio':audio_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
