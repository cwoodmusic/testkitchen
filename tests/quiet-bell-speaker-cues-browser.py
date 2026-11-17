"""A temporary speaking marker and visual conversation turns follow actual speech.

Real game controls exercise stock scenes, authored fixtures, timeline seeking and
playtests. Native frame/layout work, rendered sprite rows and saves are read-only.
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
OUT=ROOT/'work/speaker-cues-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('speaker_depot',ROOT/'tests/quiet-bell-depot-reactions-browser.py')
depot=importlib.util.module_from_spec(spec);spec.loader.exec_module(depot)
cs,ui,paths,tracks,manual=depot.cs,depot.ui,depot.paths,depot.tracks,depot.manual
tick,press,state=depot.tick,depot.press,depot.state
SPEAKERS=['nell','pip','mira','iris','nell','mira']


def observe(page):
    return page.evaluate('''()=>{
      const s=quietBell.cutscene,marker=document.querySelector('.cutscene-speaking-cue');
      const actors=[...document.querySelectorAll('.mg-npc[data-actor]')].map(n=>({id:n.dataset.actor,facing:n.dataset.facing,
        row:n.dataset.spriteRow,speaking:n.dataset.speaking,position:n.style.backgroundPosition,transform:n.style.transform}));
      const player=document.getElementById('player-sprite');actors.push({id:'mira',facing:player.dataset.facing,speaking:player.dataset.speaking,
        position:player.style.backgroundPosition,transform:player.style.transform});
      return{state:s,marker:marker?{hidden:marker.hidden,dataset:{...marker.dataset},opacity:marker.style.opacity,
        label:marker.getAttribute('aria-label'),transform:marker.style.transform}:null,actors};
    }''')


def cue(page,speaker):
    value=observe(page);marker=value['marker'];assert marker and not marker['hidden'],value
    assert marker['dataset']['character']==speaker and marker['dataset']['speakerCue']=='true',value
    assert marker['dataset']['cueDuration']=='1600',value
    assert [a['id'] for a in value['actors'] if a.get('speaking')=='true']==[speaker],value
    return value


def actor_dom(value,identifier):return next(a for a in value['actors'] if a['id']==identifier)


def protected_headings(value):
    protected=[]
    for actor in value['state']['actors']:
        if actor['moving'] or actor.get('gesture') or actor.get('action') in ['examine','search','listen']:
            assert actor_dom(value,actor['id'])['facing']==actor['facing'],(actor,value)
            protected.append(actor['id'])
    return protected


def marker_layout(page):
    for _ in range(9):
        value=page.evaluate('''()=>{
      const n=document.querySelector('.cutscene-speaking-cue'),r=n.getBoundingClientRect();
      const other=document.querySelector('.cutscene-emote[data-character="pip"][data-dialogue-reaction="true"]'),b=other?.getBoundingClientRect();
      return{speaker:n.dataset.character,line:quietBell.cutscene?.beat?.id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,windowWidth:innerWidth,
        panelTop:document.getElementById('cutscene-panel').getBoundingClientRect().top,
        separateShock:!b||Math.min(r.right,b.right)<=Math.max(r.left,b.left)+1||Math.min(r.bottom,b.bottom)<=Math.max(r.top,b.top)+1};
        }''')
        inside=value['x']>=-1 and value['right']<=value['windowWidth']+1 and value['y']>=-1 and value['bottom']<=value['panelTop']+1
        if inside:break
        tick(page,80)
    assert value['width']>0 and value['height']>0 and value['separateShock'],value
    assert inside,value
    return value


def unchanged_feet(before,after):
    assert abs(before['currentTile']-after['currentTile'])<.000001,(before,after)
    for a in before['actors']:
        b=cs.actor(after,a['id']);assert cs.point_distance(a,b)<.000001 and a['facing']==b['facing'],(a,b)


def manual_flow(browser,url,expected,width=1024,reduced=False,delay=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',reduced_motion='reduce' if reduced else 'no-preference')
    page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);original=cs.conserved(page)
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    cs.replay(page);observed=[];protected=set();bounds=[]
    for index,speaker in enumerate(SPEAKERS):
        assert depot.line_id(page)==f'depot-arrival-{index+1}'
        assert page.locator('.cutscene-advance-hint').count()==0
        panel_text=page.locator('#cutscene-panel').inner_text()
        assert 'Click to continue' not in panel_text and 'Click to reveal' not in panel_text
        start=cue(page,speaker);assert int(start['marker']['dataset']['cueElapsed'])<=40,start
        if reduced:assert float(start['marker']['opacity'])==1,start
        protected.update(protected_headings(start));tick(page,350);during=cue(page,speaker)
        protected.update(protected_headings(during));bounds.append(marker_layout(page))
        old_age=int(during['marker']['dataset']['cueElapsed']);before=state(page)
        if not before['textComplete']:
            press(page,'#cutscene-next');after=cue(page,speaker);unchanged_feet(before,after['state'])
            assert int(after['marker']['dataset']['cueElapsed'])>=old_age,'Reveal must not restart the speaking marker.'
        if index==1:
            depot.active_shock(depot.observe(page));depot.assert_cue(depot.observe(page),'courier-signal')
            page.screenshot(path=str(OUT/f'pip-marker-{width}-{reduced}-{delay}.png'))
        if index==3:depot.assert_cue(depot.observe(page),'radar')
        if index==0 and delay:
            tick(page,60000);held=observe(page);assert held['marker']['hidden'] and depot.line_id(page)=='depot-arrival-1'
            age=state(page)['dialogueElapsed'];tick(page,300);assert state(page)['dialogueElapsed']==age
        observed.append(speaker)
        if index<len(SPEAKERS)-1:
            before=state(page);depot.next_line(page);unchanged_feet(before,state(page))
    assert cs.normal_storage(page)==normal,'Speech cues must not write normal saves during the scene.'
    press(page,'#cutscene-skip');tick(page,60)
    assert not state(page) and page.locator('.cutscene-speaking-cue').count()==0
    assert not any(a.get('speaking')=='true' for a in observe(page)['actors'])
    assert page.evaluate('quietBell.project')==project
    assert cs.conserved(page)==original
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':width,'reducedMotion':reduced,'afterPhysicalEnd':delay,'speakers':observed,
        'protectedAuthoredHeadings':sorted(protected),'markerBounds':bounds,'revealDoesNotRestart':True,
        'feetAndPathsUnchanged':True,'pipShockAndPropsPreserved':True,'advanceHintsRemoved':True,'saveBytesUnchanged':True,'skipCleanup':True}


def fixture(project):
    project=copy.deepcopy(project);scene=project['scenes']['depot'];scene['entry']={'enabled':False}
    positions={'nell':(450,700),'iris':(1100,700),'pip':(768,600)}
    for actor in scene['actors']:
        x,y=positions[actor['id']];dx,dy=x-actor['feet']['x'],y-actor['feet']['y'];actor['feet']={'x':x,'y':y};actor['facing']='up'
        for item in scene['geometry']['obstacles']:
            if item['id']==actor['id']:item['x']+=dx;item['y']+=dy
        for item in scene['geometry']['targets']:
            if item['id']==actor['id']:
                item['x']+=dx;item['y']+=dy;item['approach']['x']+=dx;item['approach']['y']+=dy
        for item in scene['objects']:
            if item['id']==actor['id']:item['rect']['x']+=dx;item['rect']['y']+=dy
    scene['geometry']['start']={'x':768,'y':900,'facing':'down'}
    order=['nell','pip','mira','iris','iris','nell']
    project['content']['depot']['cutscene']=[{'id':f'speaking-{i+1}','kind':'dialogue','speaker':who,'actor':who,
        'text':f'{who.capitalize()} shares this clue with the party. Take your time; the next line waits until you are ready.',
        'startTile':i,'durationTiles':1} for i,who in enumerate(order)]
    return project


EXPECTED_FACING={
    'nell':{'nell':'right','iris':'left','pip':'left','mira':'left'},
    'pip':{'nell':'right','iris':'left','pip':'down','mira':'up'},
    'mira':{'nell':'right','iris':'left','pip':'down','mira':'up'},
    'iris':{'nell':'right','iris':'left','pip':'right','mira':'right'},
}


def assert_fixture_facing(value,speaker):
    assert {a['id']:a['facing'] for a in value['actors']}==EXPECTED_FACING[speaker],value
    # Background row changes prove both the NPC and protagonist render paths turn.
    for actor in value['actors']:
        row=['down','left','right','up'].index(actor['facing'])
        assert abs(float(actor['position'].split()[1].rstrip('%'))-row*100/3)<.01,actor


def authored_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',virtual_walk=False)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);original=cs.conserved(page)
    project=fixture(page.evaluate('JSON.parse(JSON.stringify(quietBell.project))'))
    manual.apply_project(page,project);first=cue(page,'nell');assert_fixture_facing(first,'nell')
    original_poses=copy.deepcopy(first['state']['actors']);cdp=context.new_cdp_session(page);cdp.send('Performance.enable')
    def metrics():return{v['name']:v['value'] for v in cdp.send('Performance.getMetrics')['metrics']}
    depot.room_probe(page)
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    page.evaluate('''()=>{window.__speakerFrames=[];let count=0;function frame(){const n=document.querySelector('.cutscene-speaking-cue');
      if(!n||count++>80)return;window.__speakerFrames.push({age:n.dataset.cueElapsed,opacity:n.style.opacity,transform:n.style.transform});requestAnimationFrame(frame);}requestAnimationFrame(frame);}''')
    before=metrics();page.wait_for_timeout(800);after=metrics();frames=page.evaluate('window.__speakerFrames')
    layouts=after.get('LayoutCount',0)-before.get('LayoutCount',0);assert len(frames)>=20 and layouts<=3,(frames,layouts)
    assert int(frames[-1]['age'])>int(frames[0]['age']);depot.retained(page)
    # Real hidden/focus controls freeze the marker's caption-clock pose.
    depot.visibility(page,True);paused=observe(page);page.wait_for_timeout(250);assert observe(page)==paused
    depot.visibility(page,False)
    for line_number,speaker in enumerate(['nell','pip','mira','iris','iris','nell']):
        current=cue(page,speaker);assert_fixture_facing(current,speaker)
        if line_number:assert int(current['marker']['dataset']['cueElapsed'])<=100,current
        assert current['state']['actors']==original_poses,'Visual conversation turns must never rewrite authored poses.'
        if speaker=='mira':page.screenshot(path=str(OUT/'mira-speaking-authored.png'))
        if depot.line_id(page)!='speaking-6':depot.next_line(page)
    # Last caption has no physical or prop work; after reveal/fade it must stop RAF.
    if not state(page)['textComplete']:press(page,'#cutscene-next')
    page.wait_for_function('quietBell.cutscene.dialogueElapsed>=1450',polling='raf')
    fading=observe(page);assert not fading['marker']['hidden'] and 0<float(fading['marker']['opacity'])<1,fading
    page.wait_for_timeout(250);settled=observe(page);assert settled['marker']['hidden']
    age=state(page)['dialogueElapsed'];page.wait_for_timeout(200);assert state(page)['dialogueElapsed']==age
    depot.retained(page);page.evaluate('window.__roomRetention.stop()');press(page,'#cutscene-skip');tick(page,50)
    assert page.locator('.cutscene-speaking-cue').count()==0 and cs.normal_storage(page)==normal
    # Automatic director timing seeks the same neutral cue without changing feet.
    page.keyboard.press('F2');press(page,'[data-dev-tab="cutscene"]');cs.select_timeline_mode(page)
    preview_project=copy.deepcopy(project)
    for i,clip in enumerate(preview_project['content']['depot']['cutscene']):clip['startTile']=i*40;clip['durationTiles']=40
    tracks.import_project(page,preview_project,'speaker-timed-preview');tracks.start_paused(page)
    tracks.seek(page,80+3);first_seek=cue(page,'mira');assert_fixture_facing(first_seek,'mira');tick(page,300)
    assert observe(page)==first_seek
    tracks.seek(page,80+6);later=cue(page,'mira');assert int(later['marker']['dataset']['cueElapsed'])>int(first_seek['marker']['dataset']['cueElapsed'])
    tracks.seek(page,80+3);assert observe(page)==first_seek
    tracks.seek(page,80+20);assert observe(page)['marker']['hidden']
    press(page,'#developer-cutscene-stop');tick(page,60);assert page.locator('.cutscene-speaking-cue').count()==0
    # The same component applies to other rooms, independently of depot effects.
    press(page,'[data-dev-room="garden-porch"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
    page.locator('#developer-console').wait_for(state='hidden');cs.wait_for_story(page)
    cue(page,'nell');depot.next_line(page);cue(page,'pip')
    assert state(page)['roomId']=='garden-porch' and not depot.observe(page)['stage']
    press(page,'#cutscene-skip');tick(page,60);page.keyboard.press('F2')
    press(page,'[data-dev-tab="playtest"]');press(page,'#developer-return');tick(page,60)
    assert cs.normal_storage(page)==normal and cs.conserved(page)==original
    cdp.detach();depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'nativeFrames':len(frames),'layoutCount':layouts,'allActorAndPlayerSpriteDirections':True,
        'sameSpeakerNewLineRecues':True,'actualApplyPlaytest':True,'visualOnlyTurns':True,'hiddenPause':True,
        'finiteMarkerStopsIdleRaf':True,'deterministicPreviewSeek':True,'otherRoomUsesSpeakerCues':True,'stopCleanup':True,'normalSaveBytesUnchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'manual':[manual_flow(runner,url,args.expect_release),manual_flow(runner,url,args.expect_release,delay=True),
                manual_flow(runner,url,args.expect_release,390),manual_flow(runner,url,args.expect_release,320,True)],'authored':authored_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
