"""Walking to room observations prompts optional, replayable party discussions.

Game inputs author, approach, read, replay and explicitly search. Read-only
snapshots verify independent arrival poses, once-only sources and normal saves.
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
OUT=ROOT/'work/object-dialogues-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('object_speakers',ROOT/'tests/quiet-bell-speaker-cues-browser.py')
speakers=importlib.util.module_from_spec(spec);spec.loader.exec_module(speakers)
depot,cs,ui,paths,tracks=speakers.depot,speakers.cs,speakers.ui,speakers.paths,speakers.tracks
tick,press,state=depot.tick,depot.press,depot.state
DEV_SAVE='codaQuietBellDeveloperRunV1'


def saved(page,developer=False):return page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))',DEV_SAVE if developer else ui.SAVE_KEY)
def resources(page):return ui.resources(ui.state(page))
def observation(project,room,identifier):return next(e for e in project['content'][room]['inspections'] if e['id']==identifier)


def hit_point(button):
    return button.evaluate('''e=>{const r=e.getBoundingClientRect();
      for(const fy of [.5,.75,.25,.9,.1])for(const fx of [.5,.25,.75,.1,.9]){const x=r.x+r.width*fx,y=r.y+r.height*fy;
        if(x>=8&&x<=innerWidth-8&&y>=8&&y<=innerHeight-8&&document.elementFromPoint(x,y)?.closest('button')===e)return{x,y};}return null;}''')


def reveal_target(page,identifier):
    """Use current geometry and actual arrow inputs instead of depot-only aisles."""
    button=page.locator(f'#room-map [data-inspect="{identifier}"]')
    for _ in range(24):
        point=hit_point(button)
        if point:return point
        plan=page.evaluate('''async id=>{const {findPath}=await import(new URL('room.mjs',document.baseURI));
          const geometry=quietBell.scene.geometry,target=geometry.targets.find(t=>t.id===id);
          return{route:findPath(geometry,quietBell.walker,target.approach),speed:geometry.speed,at:quietBell.walker};}''',identifier)
        assert plan['route'],(identifier,plan)
        at=plan['at'];destination=next((point for point in plan['route'] if cs.point_distance(point,at)>=8),plan['route'][-1])
        axis='x' if abs(destination['x']-at['x'])>=abs(destination['y']-at['y']) else 'y'
        delta=destination[axis]-at[axis];key=('ArrowRight' if delta>0 else 'ArrowLeft') if axis=='x' else ('ArrowDown' if delta>0 else 'ArrowUp')
        page.locator('#walk-floor').focus();page.keyboard.down(key);tick(page,abs(delta)/plan['speed']*1000+20);page.keyboard.up(key);tick(page,25)
        assert cs.point_distance(at,ui.walker(page))>.1,(identifier,plan,ui.walker(page))
    raise AssertionError(('Cannot bring the inspection into view',identifier,ui.walker(page)))


def click_inspection(page,identifier,expect_discussion=True):
    origin=ui.walker(page);point=reveal_target(page,identifier)
    if page.viewport_size['width']<500:page.touchscreen.tap(point['x'],point['y'])
    else:page.mouse.click(point['x'],point['y'])
    if ui.walker(page)['moving']:assert not state(page),'The party must approach before it starts inspecting.'
    for _ in range(250):
        if state(page) or page.locator('#lore-dialog').is_visible():break
        tick(page,100)
    current=state(page)
    if expect_discussion:
        assert current and current['context']=='inspection' and current['interactionId']==identifier,{'current':current,'loreOpen':page.locator('#lore-dialog').is_visible(),
            'savedSeen':saved(page,ui.state(page).get('developerMode',False)).get('roomObjectDialogues'),
            'object':page.evaluate('(id)=>quietBell.project.content[quietBell.state.roomId].inspections.find(e=>e.id===id)',identifier),
            'editorOpen':page.locator('#developer-console').is_visible(),'walker':ui.walker(page)}
        assert current['phase']=='story' and not current.get('preview')
        assert page.locator('#cutscene-panel').get_attribute('data-interaction-id')==identifier
        assert page.locator('#lore-dialog').is_hidden()
    else:assert not current and page.locator('#lore-dialog').is_visible(),current
    target=page.evaluate('(id)=>quietBell.scene.geometry.targets.find(t=>t.id===id)',identifier)
    assert cs.point_distance(ui.walker(page),target)<=target['range']+.1,(identifier,ui.walker(page),target)
    assert page.locator('#lore-dialog').get_attribute('data-observation')==identifier
    return cs.point_distance(origin,ui.walker(page))


def close_lore(page):
    if page.locator('#lore-dialog').is_visible():press(page,'#lore-close')


def assert_exchange(page,entry,skip=False):
    initial=resources(page);poses=copy.deepcopy(state(page)['actors']);walk=ui.walker(page)
    for index,line in enumerate(e for e in entry['dialogue'] if e['text'].strip()):
        value=state(page);assert value['beat']['text']==line['text'] and value['beat']['speaker']==line['speaker'],value
        speakers.cue(page,line['speaker']);assert value['actors']==poses
        assert cs.point_distance(walk,ui.walker(page))<.001
        tick(page,180)
        if not state(page)['textComplete']:
            before=state(page);press(page,'#cutscene-next');after=state(page)
            assert after['textComplete'] and after['beat']['id']==before['beat']['id']
            speakers.unchanged_feet(before,after)
        assert page.locator('.cutscene-advance-hint').count()==0
        if skip:press(page,'#cutscene-skip');break
        depot.next_line(page);tick(page,20)
    assert not state(page) and page.locator('#lore-dialog').is_visible()
    assert page.locator('#lore-copy').inner_text()==entry['text'] and page.locator('#lore-title').inner_text()==entry['title']
    assert resources(page)==initial,'A discussion cannot collect, spend or reveal note sources.'
    return poses


def normal_flow(browser,url,expected,width=1024,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected)
    if width==1024:
        # Seed compatibility from a genuine inventory-bearing run, changing only
        # the optional field that did not exist in earlier saves.
        ui.press(page,'[data-person="nell"]');press(page,'#take-parcel');ui.close_panels(page)
        before=resources(page);legacy=saved(page);legacy.pop('roomObjectDialogues',None)
        page.evaluate('([key,value])=>localStorage.setItem(key,JSON.stringify(value))',[ui.SAVE_KEY,legacy])
        page.reload();page.wait_for_function('!!window.quietBell?.state');ui.skip_intro(page);ui.skip_cutscene(page)
        assert resources(page)==before
    page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
    project=page.evaluate('quietBell.project');entry=observation(project,'depot','returned-letter');initial=resources(page)
    arrival=copy.deepcopy(saved(page).get('roomCutscenes'));distance=click_inspection(page,entry['id']);assert distance>5
    assert saved(page)['roomObjectDialogues']['seen'].get(entry['id']) is None
    assert_exchange(page,entry,skip=width<500)
    assert saved(page)['roomCutscenes']==arrival,'Object discussions must not retain or mark arrival choreography.'
    signature=saved(page)['roomObjectDialogues']['seen'][entry['id']];assert signature.startswith('object-v1-')
    assert page.locator('#lore-discussion').is_visible() and page.locator('#lore-search').is_hidden()
    close_lore(page);click_inspection(page,entry['id'],False);press(page,'#lore-discussion')
    assert state(page)['interactionId']==entry['id'];assert_exchange(page,entry,True)
    assert saved(page)['roomObjectDialogues']['seen'][entry['id']]==signature
    close_lore(page);page.reload();page.wait_for_function('!!window.quietBell?.state');ui.skip_intro(page);ui.skip_cutscene(page)
    assert resources(page)==initial
    page.clock.pause_at(page.evaluate('Date.now()/1000')+1);click_inspection(page,entry['id'],False)
    assert saved(page)['roomObjectDialogues']['seen'][entry['id']]==signature
    if width==1024:
        close_lore(page);second=observation(project,'depot','dispatch-map');click_inspection(page,second['id'])
        page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
        assert not state(page) and saved(page)['roomObjectDialogues']['seen'].get(second['id']) is None
        press(page,'#developer-close');tick(page,80);click_inspection(page,second['id']);assert_exchange(page,second,True)
    page.screenshot(path=str(OUT/f'lore-{width}-{reduced}.png'))
    close_lore(page);assert resources(page)==initial
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':width,'reducedMotion':reduced,'actualApproachDistance':distance,'legacySaveInventoryPreserved':width==1024,
        'jrpgPartyDiscussion':True,'noDialogueGrants':True,'arrivalStateUnchanged':True,'onceThenReplay':True,
        'reloadSeenRestored':True,'cancelDoesNotMarkSeen':width==1024}


def editor_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light');page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    entry=observation(project,'depot','returned-letter');entry['dialogue']=[{'id':'object-test-one','speaker':'iris','text':'A custom object sentence remains editable.','durationTiles':20,'author':{'keep':'yes'}},
        {'id':'object-test-two','speaker':'mira','text':'Another custom sentence waits for us.','durationTiles':20}]
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible');tracks.import_project(page,project,'object-authoring-fixture')
    press(page,'[data-dev-tab="dialogue"]');press(page,'#room-map [data-inspect="returned-letter"]')
    wrapper=page.locator('#developer-object-dialogue');assert wrapper.get_attribute('data-interaction-id')=='returned-letter'
    textarea=wrapper.locator('#developer-cutscene-dialogue-text');assert textarea.input_value()==entry['dialogue'][0]['text']
    tools=page.locator('#developer-console details.dc-tools');tools.locator('summary').click()
    sentinel='This pending object sentence survives focused export.';textarea.fill(sentinel)
    with page.expect_download() as event:page.locator('#developer-export').dispatch_event('click')
    target=OUT/'pending-object-export.json';event.value.save_as(target);exported=json.loads(target.read_text());tools.locator('summary').click()
    changed=observation(exported,'depot',entry['id']);assert changed['dialogue'][0]['text']==sentinel and changed['dialogue'][0]['author']=={'keep':'yes'}
    assert exported['content']['depot']['cutscene']==project['content']['depot']['cutscene']
    textarea.fill('A pending edit survives selecting the other landmark.');press(page,'#room-map [data-inspect="dispatch-map"]')
    assert page.locator('#developer-object-dialogue').get_attribute('data-interaction-id')=='dispatch-map'
    assert page.locator('#developer-cutscene-dialogue-text').input_value()==observation(project,'depot','dispatch-map')['dialogue'][0]['text']
    press(page,'#room-map [data-inspect="returned-letter"]');assert page.locator('#developer-cutscene-dialogue-text').input_value().startswith('A pending edit')
    press(page,'#developer-cutscene-dialogue-add');page.locator('#developer-cutscene-dialogue-text').fill('An added object reply.');press(page,'[data-dialogue-speaker="pip"]')
    authored=tracks.export_project(page,'object-added');assert len(observation(authored,'depot',entry['id'])['dialogue'])==3
    press(page,'#developer-cutscene-dialogue-remove');assert len(observation(tracks.export_project(page,'object-removed'),'depot',entry['id'])['dialogue'])==2
    # Apply the authored script and verify its real object-triggered speech.
    press(page,'#developer-apply');page.locator('#developer-console').wait_for(state='hidden');ui.skip_cutscene(page)
    applied=page.evaluate('quietBell.project');entry=observation(applied,'depot','returned-letter')
    click_inspection(page,entry['id']);assert_exchange(page,entry)
    assert cs.normal_storage(page)==normal
    close_lore(page);press(page,'#developer-end');tick(page,60);assert cs.normal_storage(page)==normal
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'pendingExport':True,'customMetadataAndArrivalPreserved':True,'actualMapSelectionChangesScript':True,
        'addRemoveReplies':True,'appliedSpeechMatchesAuthoredData':True,'normalSaveBytesUnchanged':True}


def hidden_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark');page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page)
    page.keyboard.press('F2');press(page,'[data-dev-room="workshop-alcove"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
    page.locator('#developer-console').wait_for(state='hidden');ui.skip_cutscene(page)
    project=page.evaluate('quietBell.project');entry=observation(project,'workshop-alcove','workshop-alcove-hollow-perch');before=resources(page)
    gates=[d['id'] for d in project['doors'].values() if d.get('revealAfter')==entry['sourceId']]
    assert gates and all(not page.locator(f'[data-door="{identifier}"]').count() for identifier in gates)
    click_inspection(page,entry['id']);assert_exchange(page,entry,True)
    assert resources(page)==before and page.locator('#lore-search').is_enabled()
    assert all(not page.locator(f'[data-door="{identifier}"]').count() for identifier in gates)
    press(page,'#lore-discussion');assert_exchange(page,entry,True);assert resources(page)==before
    press(page,'#lore-search');tick(page,80);claimed=resources(page)
    assert claimed['claimedSources']==before['claimedSources']+[entry['sourceId']]
    assert claimed['actions']==before['actions']+[{'type':'claim','sourceId':entry['sourceId']}]
    assert all(page.locator(f'[data-door="{identifier}"]').is_visible() for identifier in gates)
    click_inspection(page,entry['id'],False);assert page.locator('#lore-search').is_disabled()
    press(page,'#lore-discussion');assert_exchange(page,entry,True);assert resources(page)==claimed
    close_lore(page);layouts=[]
    for room_id in ['garden-fork','workshop-fork','canal-fork','garden-alcove','workshop-alcove','canal-final']:
        page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
        press(page,f'[data-dev-room="{room_id}"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
        page.locator('#developer-console').wait_for(state='hidden');ui.skip_cutscene(page)
        page.wait_for_function('[...document.images].every(i=>i.complete&&i.naturalWidth>0)')
        project=page.evaluate('quietBell.project');scene=project['scenes'][room_id]
        assert scene['layoutRevision']=='varied-layouts-1' and scene['image']==f'assets/rooms/{room_id}-layout.webp',scene
        art=page.locator('.mg-art').evaluate('n=>({src:n.src,width:n.naturalWidth,height:n.naturalHeight})')
        assert f'/{room_id}-layout.webp' in art['src'] and art['width']==1536 and art['height']==1024,art
        nav=page.evaluate('''async()=>{const{findPath,isWalkable}=await import(new URL('room.mjs',document.baseURI)),scene=quietBell.scene,g=scene.geometry,at=quietBell.walker;
          return{spawnValid:isWalkable(g,at),targets:g.targets.map(t=>{const route=findPath(g,at,t.approach),end=route?.at(-1)??at;
            return{id:t.id,walkable:isWalkable(g,t.approach),reachable:route!==null,inRange:Math.hypot(end.x-t.x,end.y-t.y)<=t.range+.1};})};}''')
        assert nav['spawnValid'] and all(t['walkable'] and t['reachable'] and t['inRange'] for t in nav['targets']),nav
        landmark=next(e for e in project['content'][room_id]['inspections'] if e.get('dialogue'))
        distance=click_inspection(page,landmark['id']);assert_exchange(page,landmark,True);close_lore(page)
        page.screenshot(path=str(OUT/f'layout-{room_id}.png'))
        layouts.append({'room':room_id,'image':art['src'],'targetsChecked':len(nav['targets']),'landmark':landmark['id'],'actualApproachDistance':distance})
    press(page,'#developer-end');tick(page,80);assert cs.normal_storage(page)==normal
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'dialogueAndReplayDoNotClaim':True,'explicitSearchClaimsOnce':True,'hiddenGateOnlyAfterSearch':True,
        'variedLayoutsAndStagedNavigation':layouts,'normalSaveBytesUnchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release');parser.add_argument('--core-only',action='store_true')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'normal':[normal_flow(runner,url,args.expect_release),normal_flow(runner,url,args.expect_release,390),normal_flow(runner,url,args.expect_release,320,True)],'editor':editor_flow(runner,url,args.expect_release)}
            if not args.core_only:result['hidden']=hidden_flow(runner,url,args.expect_release)
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
