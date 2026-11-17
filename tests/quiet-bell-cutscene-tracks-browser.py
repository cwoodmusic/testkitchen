"""Move Walk, Text and Emote timeline items independently through real controls.

Imports are ordinary authoring JSON; snapshots and pure compiler calls are
read-only. Pointer drags, keyboard seeks, Undo, exports and previews exercise the
same interface used to direct a room scene.
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
OUT = ROOT / 'work/timeline-tracks'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('track_paths', ROOT / 'tests/quiet-bell-cutscene-path-editing-browser.py')
paths = importlib.util.module_from_spec(spec);spec.loader.exec_module(paths)
cs, ui = paths.cs, paths.ui
KINDS = ['walk', 'dialogue', 'emote']


def tick(page, duration=100):
    cs.tick(page, duration)


def export_project(page, name):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    with page.expect_download() as event:
        page.locator('#developer-export').click()
    target = OUT / (name + '.json')
    event.value.save_as(target)
    if tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    return json.loads(target.read_text())


def import_project(page, project, name):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    page.locator('#developer-file').set_input_files({'name':name+'.json','mimeType':'application/json',
                                                    'buffer':json.dumps(project).encode()})
    tick(page, 140)
    if tools.evaluate('e=>e.open'):
        tools.locator('summary').click()


def selected(page):
    return page.locator('.cse-clip[aria-selected="true"]')


def select_clip(page, actor, kind, touch=False):
    return paths.select_track_clip(page, actor, kind, touch)


def set_number(page, selector, value):
    node = page.locator(selector)
    node.fill(str(value));node.press('Tab');tick(page, 100)


def records(project):
    result = project['content']['depot']['cutscene']
    assert len({clip['id'] for clip in result}) == len(result), result
    return {clip['id']:clip for clip in result}


def one_changed(before, after, identifier, expected_fields):
    old, new = records(before), records(after)
    assert old.keys() == new.keys(), (old.keys(),new.keys())
    assert all(old[key] == new[key] for key in old if key != identifier), (identifier,old,new)
    changed = {key for key in set(old[identifier]) | set(new[identifier])
               if old[identifier].get(key) != new[identifier].get(key)}
    assert changed == set(expected_fields), (identifier,changed,expected_fields,old[identifier],new[identifier])


def drag_item(page, node, tiles, touch=False, resize=False):
    handle = node.locator('[data-cutscene-resize]') if resize else node
    handle.evaluate('e=>e.scrollIntoView({block:"center",inline:"nearest"})')
    point = handle.evaluate('''e=>{
      const r=e.getBoundingClientRect(),s=e.closest('.cse-scroll').getBoundingClientRect();
      const left=Math.max(r.left,s.left,0),right=Math.min(r.right,s.right,innerWidth);
      const top=Math.max(r.top,s.top,0),bottom=Math.min(r.bottom,s.bottom,innerHeight);
      for(const ratio of [.25,.5,.75,.1,.9]){
        const x=left+(right-left)*ratio,y=(top+bottom)/2,hit=document.elementFromPoint(x,y);
        if(resize ? hit?.closest('[data-cutscene-resize]')===e : hit?.closest('[data-cutscene-clip]')===e&&!hit?.closest('[data-cutscene-resize]'))return{x,y};
      }
      return null;
    }'''.replace('if(resize ?', 'if(' + ('true' if resize else 'false') + ' ?'))
    assert point, 'The visible clip has no actual pointer hit target.'
    width = page.locator('.cse-grid').evaluate('e=>parseFloat(getComputedStyle(e).getPropertyValue("--cse-tile-width"))')
    end = {'x':point['x']+tiles*width,'y':point['y']}
    assert 3 < end['x'] < page.viewport_size['width']-3, (point,end)
    if touch:
        session = page.context.new_cdp_session(page)
        def send(kind, at=None):
            touches = [] if at is None else [{'x':at['x'],'y':at['y'],'id':1,'radiusX':1,'radiusY':1,'force':1}]
            session.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':touches})
        send('touchStart',point)
        for step in range(1,9):
            send('touchMove',{'x':point['x']+(end['x']-point['x'])*step/8,'y':point['y']})
        send('touchEnd');session.detach()
    else:
        page.mouse.move(point['x'],point['y']);page.mouse.down()
        page.mouse.move(end['x'],end['y'],steps=8);page.mouse.up()
    tick(page, 140)


def assert_lanes(page):
    for actor in ['nell','iris','pip','mira']:
        track = page.locator('.cse-track[data-cutscene-actor="'+actor+'"]')
        assert track.count() == 1, actor
        for kind in KINDS:
            channel = track.locator('.cse-channel[data-cutscene-kind="'+kind+'"]')
            assert channel.count() == 1, (actor,kind)
            assert channel.locator('.cse-clip[data-cutscene-kind="'+kind+'"]').count() >= 1, (actor,kind)
            assert channel.locator('.cse-clip:not([data-cutscene-kind="'+kind+'"])').count() == 0


def seek(page, tile):
    cs.select_timeline_mode(page)
    node = page.locator('#developer-cutscene-scrub');node.focus();page.keyboard.press('Home')
    for _ in range(tile):
        page.keyboard.press('ArrowRight')
    tick(page, 90)
    value = page.evaluate('quietBell.cutscene')
    assert value and not value['playing'] and abs(value['currentTile']-tile)<.001, value
    return value


def start_paused(page):
    page.locator('#developer-cutscene-play').click();tick(page, 100)
    page.locator('#developer-cutscene-pause').click();tick(page, 80)


def pose(value, actor='nell'):
    return next(item for item in value['actors'] if item['id']==actor)


def assert_silent(page, value):
    assert value['beat'] is None, value
    assert page.locator('#cutscene-panel').evaluate('e=>e.classList.contains("cutscene-silent")')
    assert not page.locator('#cutscene-line').inner_text().strip()
    assert page.locator('#cutscene-line').evaluate('e=>getComputedStyle(e).visibility') == 'hidden'


def assert_emote_tracks_actor(page, value):
    visible = page.locator('.cutscene-emote[data-character="nell"][data-cutscene-emote="idea"]')
    assert visible.is_visible()
    at = pose(value)
    measured = visible.evaluate('''(e,at)=>{
      const r=e.getBoundingClientRect(),map=document.getElementById('room-map').getBoundingClientRect();
      const scale=map.width/1536;
      return{center:(r.left+r.right)/2,expectedX:map.left+at.x*scale,
        bottom:r.bottom,feet:map.top+at.y*scale};
    }''',at)
    assert abs(measured['center']-measured['expectedX']) < 3, measured
    assert measured['bottom'] < measured['feet']-12, measured


def assert_jrpg_style(page):
    page.evaluate('document.fonts.ready')
    style=page.locator('#cutscene-line').evaluate('''e=>{
      const text=getComputedStyle(e),box=getComputedStyle(e.closest('#cutscene-panel'));
      return{font:text.fontFamily,size:parseFloat(text.fontSize),loaded:document.fonts.check(text.fontSize+' QuietBellBlock'),
        border:parseFloat(box.borderTopWidth),background:box.backgroundImage,
        prefix:e.querySelector('.jrpg-glyph-rows')?.textContent?.slice(0,6)};
    }''')
    assert 'QuietBellBlock' in style['font'] and style['loaded'] and style['size']>=16,style
    assert style['border']>=3 and 'gradient' in style['background'],style
    assert style['prefix']=='NELL: ',style


def screenshot_tracks(page, name):
    page.locator('.cse-track[data-cutscene-actor="nell"]').evaluate(
        'e=>e.scrollIntoView({block:"center",inline:"nearest"})')
    page.locator('.cse-scroll').evaluate('e=>{e.scrollLeft=0;}')
    page.screenshot(path=str(OUT/name))


def desktop_flow(browser, url, expected):
    context,page,errors,writes,external = ui.open_page(browser,url,1024,'light',height=768)
    base = paths.validate_release(page,expected)
    saved, original = cs.normal_storage(page), paths.resources(page)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').click();tick(page,100)
    cs.select_timeline_mode(page)
    assert_lanes(page)
    baseline = export_project(page,'default-separated')
    assert all(set(clip['kind'] for clip in content['cutscene'])==set([*KINDS,'gesture'])
               for content in baseline['content'].values()), 'Every shipped room has Walk, Text, Emote and Action clips.'
    for kind, delta, resize in [('dialogue',3,False),('emote',2,True),('walk',2,False)]:
        index = select_clip(page,'nell',kind)
        identifier = baseline['content']['depot']['cutscene'][index]['id']
        before = export_project(page,'before-'+kind)
        if kind!='walk':
            assert page.locator('.cutscene-path-overlay').count()==0
            assert page.locator('#developer-cutscene-x').count()==0
        drag_item(page,selected(page),delta,resize=resize)
        after = export_project(page,'after-'+kind)
        one_changed(before,after,identifier,['durationTiles' if resize else 'startTile'])
        old,new=records(before)[identifier],records(after)[identifier]
        key='durationTiles' if resize else 'startTile'
        assert new[key] == old[key]+delta, (old,new)
        paths.history(page,'undo')
        assert export_project(page,'undo-'+kind)['content']['depot']['cutscene']==before['content']['depot']['cutscene']
        paths.history(page,'redo')
        assert export_project(page,'redo-'+kind)['content']['depot']['cutscene']==after['content']['depot']['cutscene']
    # New items enter their own lane and Delete removes only that item.
    for kind, control in [('walk','developer-cutscene-add'),('dialogue','developer-cutscene-add-dialogue'),
                          ('emote','developer-cutscene-add-emote')]:
        before=export_project(page,'before-add-'+kind)
        page.locator('#'+control).click();tick(page,100)
        added=export_project(page,'after-add-'+kind)
        assert len(added['content']['depot']['cutscene'])==len(before['content']['depot']['cutscene'])+1
        fresh=added['content']['depot']['cutscene'][int(selected(page).get_attribute('data-cutscene-clip'))]
        assert fresh['kind']==kind, fresh
        assert all(records(added)[key]==value for key,value in records(before).items())
        page.locator('#developer-cutscene-delete').click();tick(page,100)
        assert export_project(page,'after-delete-'+kind)['content']['depot']['cutscene']==before['content']['depot']['cutscene']
    # A real saved project uses separate items even after export/import.
    round_trip = export_project(page,'typed-before-round-trip')
    page.locator('#developer-save').click();tick(page,70)
    import_project(page,round_trip,'typed-import')
    assert export_project(page,'typed-after-round-trip')['content']['depot']['cutscene']==round_trip['content']['depot']['cutscene']
    # Import a prior combined scene, including literal text and private author
    # metadata. No cutscene action may affect the normal run while converting it.
    legacy = copy.deepcopy(baseline)
    legacy['content']['depot']['cutscene']=[{
        'id':'old-director-note','actor':'nell','speaker':'nell','target':'returned-letter','action':'examine',
        'text':'A <literal> legacy line with its own timing.','emote':'idea','startTile':3,'durationTiles':60,
        'waypoints':[],'authorMemo':{'note':'Keep this exact author annotation.'}}]
    import_project(page,legacy,'legacy-combined')
    converted = export_project(page,'legacy-separated')
    clips=converted['content']['depot']['cutscene']
    assert {clip['kind'] for clip in clips}==set(KINDS) and len(clips)==3,clips
    for clip in clips:
        assert clip['startTile']==3 and clip['durationTiles']==60,clip
        assert clip['authorMemo']==legacy['content']['depot']['cutscene'][0]['authorMemo'],clip
    assert next(clip for clip in clips if clip['kind']=='dialogue')['text']==legacy['content']['depot']['cutscene'][0]['text']
    assert next(clip for clip in clips if clip['kind']=='walk')['waypoints']==[]
    assert next(clip for clip in clips if clip['kind']=='emote')['emote']=='idea'
    # Older directors could move two actors at once while assigning both
    # spoken lines to a third speaker. Conversion must not serialize those
    # dialogue items onto that speaker's lane and shift their timing.
    overlapping_legacy=copy.deepcopy(baseline)
    overlapping_legacy['content']['depot']['cutscene']=[
        {'id':'nell-speaking-as-mira','actor':'nell','speaker':'mira','target':'returned-letter','action':'examine',
         'text':'Mira speaks while Nell examines the letter.','emote':'idea','startTile':3,'durationTiles':60},
        {'id':'iris-speaking-as-mira','actor':'iris','speaker':'mira','target':'dispatch-map','action':'search',
         'text':'Mira answers while Iris studies the route.','emote':'question','startTile':3,'durationTiles':60},
    ]
    import_project(page,overlapping_legacy,'legacy-overlapping-speaker')
    preserved=export_project(page,'legacy-overlapping-separated')
    spoken=[clip for clip in preserved['content']['depot']['cutscene'] if clip['kind']=='dialogue']
    assert len(spoken)==2 and {clip['actor'] for clip in spoken}=={'nell','iris'},spoken
    assert all(clip['speaker']=='mira' and clip['startTile']==3 and clip['durationTiles']==60 for clip in spoken),spoken
    start_paused(page);concurrent=seek(page,4)
    spoken_active=[clip for clip in concurrent['activeClips'] if clip.get('kind')=='dialogue']
    assert len(spoken_active)==2 and {clip['actor'] for clip in spoken_active}=={'nell','iris'},concurrent
    assert pose(concurrent,'nell')['moving'] and pose(concurrent,'iris')['moving'],concurrent
    page.locator('#developer-cutscene-stop').click();tick(page,80)
    # A controlled overlapping example proves the three lanes remain separate
    # at playback, rather than being recombined into one underlying action.
    fixture=copy.deepcopy(converted)
    fixture['content']['depot']['cutscene']=[
        {'id':'independent-walk','kind':'walk','actor':'nell','target':'returned-letter','action':'examine','startTile':0,'durationTiles':30},
        {'id':'independent-text','kind':'dialogue','actor':'nell','speaker':'nell','text':'The words arrive while I keep walking. Each line and each little thought can have its own place in this scene.','startTile':3,'durationTiles':24},
        {'id':'independent-emote','kind':'emote','actor':'nell','emote':'idea','startTile':6,'durationTiles':4},
    ]
    import_project(page,fixture,'overlapping-channels')
    select_clip(page,'nell','walk');assert page.locator('.cutscene-path-overlay').count()==1
    start_paused(page)
    quiet=seek(page,2);assert pose(quiet)['moving'];assert_silent(page,quiet)
    speaking=seek(page,4);assert pose(speaking)['moving'] and speaking['beat']['kind']=='dialogue'
    assert not speaking['textComplete'] and 0 < speaking['visibleCharacters'] < speaking['totalCharacters'], speaking
    assert not page.locator('#cutscene-panel').evaluate('e=>e.classList.contains("cutscene-silent")')
    assert_jrpg_style(page)
    with_emote=seek(page,7);assert pose(with_emote)['moving'];assert pose(with_emote)['emote']=='idea'
    assert_emote_tracks_actor(page,with_emote);paths.assert_dialogue_clear_of_cast(page)
    original_pose={key:pose(with_emote)[key] for key in ['x','y','facing','moving']}
    no_emote=seek(page,10);assert pose(no_emote)['emote'] is None and pose(no_emote)['moving']
    assert page.locator('.cutscene-emote[data-character="nell"]').is_hidden()
    walk_before=export_project(page,'before-text-retime')
    select_clip(page,'nell','dialogue');set_number(page,'#developer-cutscene-start',9)
    walk_after=export_project(page,'after-text-retime')
    one_changed(walk_before,walk_after,'independent-text',['startTile'])
    start_paused(page);same=seek(page,7)
    assert {key:pose(same)[key] for key in original_pose}==original_pose,(original_pose,pose(same))
    assert_silent(page,same);assert_emote_tracks_actor(page,same)
    select_clip(page,'nell','emote');set_number(page,'#developer-cutscene-start',2)
    emote_moved=export_project(page,'after-emote-retime')
    one_changed(walk_after,emote_moved,'independent-emote',['startTile'])
    start_paused(page);early=seek(page,3)
    assert pose(early)['moving'] and pose(early)['emote']=='idea';assert_silent(page,early)
    assert_emote_tracks_actor(page,early)
    later=seek(page,9);assert later['beat']['id']=='independent-text'
    assert pose(later)['moving'] and pose(later)['emote'] is None
    screenshot_tracks(page,'independent-tracks-desktop.png')
    page.locator('#developer-cutscene-stop').click();tick(page,80)
    assert paths.resources(page)==original and cs.normal_storage(page)==saved
    page.keyboard.press('F2');tick(page,80)
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'threeRowsPerCharacter':True,'independentPointerDragAndResize':True,
            'independentAddAndDelete':True,'undoRedoAndTypedRoundTrip':True,'legacyTimingAndMetadataPreserved':True,
            'overlappingLegacyActorAndSpeakerPreserved':True,
            'textAndEmoteOverlapActualWalking':True,'silentIntervals':True,'emoteFollowsWalkingFeet':True,
            'retimingTextAndEmoteLeavesWalkingUnchanged':True,'protectedSaveBytesUntouched':True}


def phone_flow(browser,url,expected,width):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',height=844)
    base=paths.validate_release(page,expected);saved=cs.normal_storage(page);original=paths.resources(page)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').tap();tick(page,100)
    cs.select_timeline_mode(page, True)
    assert_lanes(page)
    before=export_project(page,'phone-'+str(width)+'-before')
    index=select_clip(page,'nell','dialogue',True);identifier=before['content']['depot']['cutscene'][index]['id']
    drag_item(page,selected(page),2,touch=True)
    after=export_project(page,'phone-'+str(width)+'-text-drag')
    one_changed(before,after,identifier,['startTile'])
    assert records(after)[identifier]['startTile']==records(before)[identifier]['startTile']+2
    assert page.locator('.cutscene-path-overlay').count()==0
    for selector in ['#developer-cutscene-add','#developer-cutscene-add-dialogue','#developer-cutscene-add-emote',
                     '#developer-cutscene-play','#developer-cutscene-speed']:
        box=page.locator(selector).bounding_box()
        assert box and box['width']>=43.5 and box['height']>=43.5,(selector,box)
    start_paused(page);active=seek(page,3)
    assert active['beat'] and active['beat']['kind']=='dialogue' and pose(active)['moving'],active
    assert_jrpg_style(page)
    paths.assert_dialogue_clear_of_cast(page)
    screenshot_tracks(page,'independent-tracks-'+str(width)+'.png')
    page.locator('#developer-cutscene-stop').tap();tick(page,90)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    assert paths.resources(page)==original and cs.normal_storage(page)==saved
    page.keyboard.press('F2');tick(page,80)
    ui.protected_storage(page);paths.no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'width':width,'actualTouchMovesTextOnly':True,'threeRowsPerCharacter':True,
            'walkDuringSeparateText':True,'readableNonblockingDialogue':True,'noDocumentOverflow':True,
            'protectedSaveBytesUntouched':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
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
            result={'passed':True,'entry':url,'desktop':desktop_flow(runner,url,args.expect_release),
                    'phones':[phone_flow(runner,url,args.expect_release,width) for width in [390,320]]}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1)
        name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
