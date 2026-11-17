"""Edit cinematic routes through actual map inputs, without mutating game hooks.

Path drags, timeline edits, speed switches, emotes, export and Undo all use the
same controls as a player. Only read-only snapshots and saved-file contents are
inspected. The optional clock advances actual RAF callbacks.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import math
import time

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/cutscene-path-editing'
OUT.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('cutscene_ui', ROOT / 'tests/quiet-bell-cutscene-browser.py')
cs = importlib.util.module_from_spec(spec); spec.loader.exec_module(cs)
ui = cs.ui


def tick(page, duration=100):
    cs.tick(page, duration)


def cutscene(page):
    return page.evaluate('window.quietBell.cutscene')


def normal_storage(page):
    return cs.normal_storage(page)


def resources(page):
    return cs.conserved(page)


def distance(a, b):
    return math.hypot(a['x'] - b['x'], a['y'] - b['y'])


def export_project(page, name):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    with page.expect_download() as event:
        page.locator('#developer-export').click()
    path = OUT / (name + '.json')
    event.value.save_as(path)
    if tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    return json.loads(path.read_text())


def history(page, action):
    tools = page.locator('#developer-console details.dc-tools')
    if not tools.evaluate('e=>e.open'):
        tools.locator('summary').click()
    page.locator('#developer-' + action).click();tick(page, 100)
    if tools.evaluate('e=>e.open'):
        tools.locator('summary').click()


def selected_actor(page):
    return page.locator('.cse-clip[aria-selected="true"]').evaluate(
        'e=>e.closest("[data-cutscene-actor]").dataset.cutsceneActor')


def selected_index(page):
    return int(page.locator('.cse-clip[aria-selected="true"]').get_attribute('data-cutscene-clip'))


def select_track_clip(page, identifier, kind, touch=False):
    cs.select_timeline_mode(page, touch)
    node = page.locator('.cse-track[data-cutscene-actor="' + identifier + '"] .cse-clip[data-cutscene-kind="' + kind + '"]').first
    node.evaluate('e=>e.scrollIntoView({block:"nearest",inline:"nearest"})')
    getattr(node, 'tap' if touch else 'click')()
    tick(page, 80)
    assert page.locator('.cse-clip[aria-selected="true"]').get_attribute('data-cutscene-kind') == kind
    return selected_index(page)


def overlay(page, actor=None):
    selector = '.cutscene-path-overlay'
    if actor:
        selector += '[data-path-actor="' + actor + '"]'
    return page.locator(selector)


def assert_displayed_cardinal(page):
    points = overlay(page).locator('[data-cutscene-path-line]').evaluate(
        'line=>Array.from(line.points,p=>({x:p.x,y:p.y}))')
    # Mira's default closing clip is stationary. It has one route point and a
    # draggable endpoint, becoming a cardinal walk after that endpoint moves.
    assert points, points
    for first, second in zip(points, points[1:]):
        assert abs(first['x']-second['x']) <= .000001 or abs(first['y']-second['y']) <= .000001, points


def actor_button(page, identifier):
    if identifier == 'mira':
        return page.locator('.cutscene-mira-pick[data-cutscene-actor="mira"]')
    return page.locator('#room-map [data-person="' + identifier + '"]')


def select_actor(page, identifier, touch=False):
    cs.select_timeline_mode(page, touch)
    node = actor_button(page, identifier)
    getattr(node, 'tap' if touch else 'click')()
    tick(page, 80)
    assert page.locator('[data-dev-tab="cutscene"]').get_attribute('aria-selected') == 'true'
    assert selected_actor(page) == identifier, (identifier, selected_actor(page))
    assert page.locator('.cse-clip[aria-selected="true"]').get_attribute('data-cutscene-kind') == 'walk'
    assert overlay(page, identifier).count() == 1, identifier
    line = overlay(page, identifier).locator('[data-cutscene-path-line]')
    assert line.count() == 1 and line.get_attribute('marker-end'), identifier
    assert overlay(page, identifier).locator('[data-path-endpoint="true"]').count() == 1
    assert_displayed_cardinal(page)
    return line.get_attribute('stroke') or line.evaluate('e=>getComputedStyle(e).stroke')


def screen_point(page, world):
    return page.locator('#room-map').evaluate('''(map,at)=>{
      const box=map.getBoundingClientRect();
      return{x:box.left+at.x*box.width/1536,y:box.top+at.y*box.height/1024};
    }''', world)


def route_point(page):
    return overlay(page).locator('[data-cutscene-path-line]').evaluate('''line=>{
      const length=line.getTotalLength(),matrix=line.getScreenCTM();
      for(const ratio of [.5,.35,.65,.25,.75]){
        const at=line.getPointAtLength(length*ratio),point=new DOMPoint(at.x,at.y).matrixTransform(matrix);
        if(point.x<8||point.y<8||point.x>innerWidth-8||point.y>innerHeight-8)continue;
        const hit=document.elementFromPoint(point.x,point.y);
        if(hit===line)return{x:point.x,y:point.y};
      }
      return null;
    }''')


def drag(page, start, end, touch=False):
    if touch:
        session = page.context.new_cdp_session(page)
        def send(kind, point=None):
            points = [] if point is None else [{'x':point['x'],'y':point['y'],'id':1,'radiusX':1,'radiusY':1,'force':1}]
            session.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':points})
        send('touchStart', start)
        for step in range(1, 11):
            send('touchMove', {'x':start['x']+(end['x']-start['x'])*step/10,
                               'y':start['y']+(end['y']-start['y'])*step/10})
            if step in [3, 7, 10]:
                assert_displayed_cardinal(page)
        send('touchEnd'); session.detach()
    else:
        page.mouse.move(start['x'], start['y']);page.mouse.down()
        for step in range(1, 11):
            page.mouse.move(start['x']+(end['x']-start['x'])*step/10,
                            start['y']+(end['y']-start['y'])*step/10)
            if step in [3, 7, 10]:
                assert_displayed_cardinal(page)
        page.mouse.up()
    tick(page, 160)
    assert_displayed_cardinal(page)


def drag_endpoint(page, world, touch=False):
    handle = overlay(page).locator('[data-path-endpoint="true"]')
    box = handle.bounding_box()
    assert box and box['width'] >= 19 and box['height'] >= 19, box
    drag(page, {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}, screen_point(page, world), touch)


def verify_path(page, project, index):
    return page.evaluate('''async({project,index})=>{
      const {compileRoomCutscene}=await import(new URL('cutscene.mjs',document.baseURI));
      const {isWalkable}=await import(new URL('room.mjs',document.baseURI));
      const scene=project.scenes.depot,ids=new Set(scene.actors.map(a=>a.id));
      const physical={...scene.geometry,obstacles:scene.geometry.obstacles.filter(o=>!ids.has(o.id))};
      const clip=compileRoomCutscene({scene,beats:project.content.depot.cutscene,playerPosition:scene.geometry.start}).clips.find(c=>c.index===index);
      const invalid=[],nonCardinal=[];
      for(let i=0;i<clip.path.length;i++){
        const p=clip.path[i];if(!isWalkable(physical,p))invalid.push(p);
        if(i){const a=clip.path[i-1],length=Math.hypot(p.x-a.x,p.y-a.y),steps=Math.ceil(length/4);
          if(Math.abs(p.x-a.x)>1e-6&&Math.abs(p.y-a.y)>1e-6)nonCardinal.push({from:a,to:p});
          for(let n=1;n<steps;n++){const q={x:a.x+(p.x-a.x)*n/steps,y:a.y+(p.y-a.y)*n/steps};if(!isWalkable(physical,q))invalid.push(q);}}
      }
      return{invalid,cardinal:nonCardinal.length===0,nonCardinal,path:clip.path,minimum:clip.minimumDurationTiles,duration:clip.durationTiles,to:clip.to,
        destinationWalkable:!project.content.depot.cutscene[index].destination||isWalkable(physical,project.content.depot.cutscene[index].destination)};
    }''', {'project':project,'index':index})


def validate_release(page, expected):
    base = page.evaluate('document.baseURI')
    if expected:
        assert '/releases/' + expected + '/' in base, base
    return base


def no_errors(errors, writes, external):
    assert not errors and not writes and not external, (errors, writes, external)


def assert_dialogue_clear_of_cast(page, minimum=4):
    result = page.evaluate('''()=>{
      const box=document.getElementById('cutscene-panel').getBoundingClientRect();
      const viewport=document.getElementById('room-scene').getBoundingClientRect();
      const visible=[];
      for(const element of document.querySelectorAll('.mg-npc,#player-sprite')){
        const rect=element.getBoundingClientRect();
        const left=Math.max(rect.left,viewport.left,0),right=Math.min(rect.right,viewport.right,innerWidth);
        const top=Math.max(rect.top,viewport.top,0),bottom=Math.min(rect.bottom,viewport.bottom,innerHeight);
        if(right<=left||bottom<=top)continue;
        const overlap=Math.max(0,Math.min(right,box.right)-Math.max(left,box.left))*Math.max(0,Math.min(bottom,box.bottom)-Math.max(top,box.top));
        visible.push({id:element.dataset.actor??'mira',overlap,rect:{left,right,top,bottom}});
      }
      return{box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},visible};
    }''')
    assert len(result['visible']) >= minimum, result
    assert all(item['overlap'] < 1 for item in result['visible']), result
    return len(result['visible'])


def switch_rate(page, selector):
    # Compare the two sides of the same real DOM click. Sampling in separate
    # protocol turns can admit an unrelated RAF and look like a position jump.
    page.evaluate('''selector=>{
      window.__pathRateSwitch={};
      const before=event=>{if(!event.target.closest(selector))return;
        window.__pathRateSwitch.before=quietBell.cutscene;document.removeEventListener('click',before,true);};
      const after=event=>{if(!event.target.closest(selector))return;
        window.__pathRateSwitch.after=quietBell.cutscene;document.removeEventListener('click',after);};
      document.addEventListener('click',before,true);document.addEventListener('click',after);
    }''', selector)
    page.locator(selector).click()
    proof = page.evaluate('window.__pathRateSwitch')
    assert proof.get('before') and proof.get('after'), proof
    assert abs(proof['after']['elapsed'] - proof['before']['elapsed']) < .001, proof
    assert all(distance(a, next(b for b in proof['after']['actors'] if b['id'] == a['id'])) < .001 for a in proof['before']['actors']), proof
    return proof['after']


def cardinal_flow(browser, url, expected):
    context, page, errors, writes, external = ui.open_page(browser,url,1024,'light',height=768)
    base = validate_release(page, expected);original = resources(page)
    page.locator('#walk-floor').focus()
    page.keyboard.down('ArrowRight');page.keyboard.down('ArrowUp')
    both = ui.walker(page);previous = both;up_samples = []
    for _ in range(7):
        tick(page,50);current = ui.walker(page)
        assert abs(current['x']-previous['x']) < .001, (previous,current)
        assert current['y'] <= previous['y'], (previous,current)
        up_samples.append({'x':current['x'],'y':current['y']});previous=current
    assert both['y']-previous['y'] > 50, (both,previous)
    page.keyboard.up('ArrowUp')
    resumed = ui.walker(page);previous=resumed;right_samples=[]
    for _ in range(7):
        tick(page,50);current=ui.walker(page)
        assert abs(current['y']-previous['y']) < .001, (previous,current)
        assert current['x'] >= previous['x'], (previous,current)
        right_samples.append({'x':current['x'],'y':current['y']});previous=current
    assert previous['x']-resumed['x'] > 50, (resumed,previous)
    page.keyboard.up('ArrowRight');tick(page,100)
    assert not ui.walker(page)['moving']
    assert resources(page)==original
    # Audit the actual released compiler and all authored room scripts. Editing
    # points may be off-grid, but every rendered walking segment is cardinal.
    paths=page.evaluate('''async()=>{
      const {compileRoomCutscene}=await import(new URL('cutscene.mjs',document.baseURI));
      const p=quietBell.project;let rooms=0,clips=0,segments=0;const bad=[];
      for(const [id,scene]of Object.entries(p.scenes)){
        rooms++;const timeline=compileRoomCutscene({scene,beats:p.content[id].cutscene??[],playerPosition:scene.geometry.start});
        for(const clip of timeline.clips){clips++;for(let i=1;i<clip.path.length;i++){
          segments++;const a=clip.path[i-1],b=clip.path[i];
          if(Math.abs(a.x-b.x)>1e-6&&Math.abs(a.y-b.y)>1e-6)bad.push({room:id,clip:clip.id,a,b});
        }}
      }
      return{rooms,clips,segments,bad};
    }''')
    assert paths['rooms']==23 and paths['clips']>=92 and not paths['bad'],paths
    ui.protected_storage(page);no_errors(errors,writes,external)
    context.close()
    return {'releaseBase':base,'newestHeldKeyWins':True,'releaseResumesOtherKey':True,
            'upSamples':up_samples,'rightSamples':right_samples,'authoredPaths':paths,'resourcesUntouched':True}


def rate_flow(browser, url, expected):
    context, page, errors, writes, external = ui.open_page(
        browser, url, 1024, 'light', height=768, skip_cutscenes=False)
    base = validate_release(page, expected)
    page.locator('#cutscene-panel').wait_for(state='visible')
    original = resources(page);saved = normal_storage(page)
    first = cutscene(page)
    assert first['playbackRate'] == 1
    assert_dialogue_clear_of_cast(page)
    quantum = first['quantumMs']
    tick(page, 400);normal = cutscene(page)
    slow_delta = normal['elapsed'] - first['elapsed']
    switched = switch_rate(page, '#cutscene-speed')
    assert switched['playbackRate'] == 2 and switched['quantumMs'] == quantum
    assert page.locator('#cutscene-speed').get_attribute('aria-pressed') == 'true'
    tick(page, 400);fast = cutscene(page)
    fast_delta = fast['elapsed'] - switched['elapsed']
    assert 1.8 <= fast_delta / slow_delta <= 2.2, (slow_delta, fast_delta)
    assert resources(page) == original and normal_storage(page) == saved
    page.locator('#cutscene-speed').click()
    assert cutscene(page)['playbackRate'] == 1
    page.locator('#cutscene-skip').click()
    ui.protected_storage(page);no_errors(errors, writes, external)
    context.close()
    return {'releaseBase':base,'normalDeltaMs':slow_delta,'doubleDeltaMs':fast_delta,
            'continuousSpeedSwitch':True,'authoredQuantumUnchanged':True,'dialogueClearOfFourCharacters':True,
            'normalStorageUntouched':True}


def desktop_flow(browser, url, expected):
    context, page, errors, writes, external = ui.open_page(browser, url, 1024, 'light', height=768)
    base = validate_release(page, expected)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').click();tick(page, 100)
    cs.select_timeline_mode(page)
    saved = normal_storage(page);original = resources(page)
    colors = {who:select_actor(page, who) for who in ['nell','iris','pip','mira']}
    assert len(set(colors.values())) == 4, colors
    mira_index = selected_index(page)
    before_mira = export_project(page, 'desktop-mira-stationary')
    drag_endpoint(page, {'x':930,'y':900})
    moved_mira = export_project(page, 'desktop-mira-first-walk')
    assert moved_mira['content']['depot']['cutscene'][mira_index].get('destination')
    mira_path=verify_path(page, moved_mira, mira_index)
    assert not mira_path['invalid'] and mira_path['cardinal'],mira_path
    history(page, 'undo')
    restored_mira = export_project(page, 'desktop-mira-undo')
    assert restored_mira['content']['depot']['cutscene'] == before_mira['content']['depot']['cutscene']
    select_actor(page, 'nell');index = selected_index(page)
    before = export_project(page, 'desktop-before-route')
    start = route_point(page)
    assert start, 'The route stroke is a real draggable hit target.'
    drag(page, start, screen_point(page, {'x':720,'y':800}))
    after = export_project(page, 'desktop-waypoint-route')
    beat = after['content']['depot']['cutscene'][index]
    assert beat.get('waypoints') and beat.get('waypoints') != before['content']['depot']['cutscene'][index].get('waypoints'), beat
    assert beat.get('target') == before['content']['depot']['cutscene'][index].get('target'), beat
    checked = verify_path(page, after, index)
    assert not checked['invalid'] and checked['cardinal'] and checked['duration'] >= checked['minimum'], checked
    history(page, 'undo')
    undone = export_project(page, 'desktop-one-undo')
    assert undone['content']['depot']['cutscene'] == before['content']['depot']['cutscene'], 'One path drag is one Undo transaction.'
    history(page, 'redo')
    redone = export_project(page, 'desktop-redo')
    assert redone['content']['depot']['cutscene'] == after['content']['depot']['cutscene']
    drag_endpoint(page, {'x':640,'y':800})
    endpoint = export_project(page, 'desktop-endpoint-route')
    endpoint_beat = endpoint['content']['depot']['cutscene'][index]
    assert endpoint_beat.get('destination') and not endpoint_beat.get('target'), endpoint_beat
    assert endpoint_beat['waypoints'] == beat['waypoints']
    # Dropping a destination over the depot counter projects it to actual floor.
    drag_endpoint(page, {'x':160,'y':355})
    projected = export_project(page, 'desktop-wall-projection')
    checked = verify_path(page, projected, index)
    assert checked['destinationWalkable'] and not checked['invalid'] and checked['cardinal'], checked
    assert resources(page) == original and normal_storage(page) == saved
    # Actual map selection must preserve a dirty line across its blur/repaint.
    line = 'The route glows where the old post used to pass.'
    dialogue_index = select_track_clip(page, 'nell', 'dialogue')
    assert overlay(page).count() == 0, 'A text clip cannot expose path handles that would change its payload.'
    page.locator('#developer-cutscene-text').fill(line)
    select_actor(page, 'iris')
    dirty = export_project(page, 'desktop-dirty-selection')
    assert dirty['content']['depot']['cutscene'][dialogue_index]['text'] == line
    select_track_clip(page, 'nell', 'emote')
    assert overlay(page).count() == 0, 'An emote clip cannot expose path handles.'
    page.locator('#developer-cutscene-emote [data-cutscene-choice="idea"]').click();tick(page, 100)
    page.locator('#developer-cutscene-play').click();tick(page, 250)
    playing = cutscene(page)
    assert playing and playing['preview'] and playing['playing'], playing
    assert_dialogue_clear_of_cast(page)
    assert page.locator('.cutscene-emote[data-character="nell"][data-cutscene-emote="idea"]').is_visible()
    select_actor(page, 'nell')
    paused = cutscene(page)
    assert paused and paused['preview'] and not paused['playing'], 'Selecting a moving actor pauses the preview for path editing.'
    assert_dialogue_clear_of_cast(page)
    page.screenshot(path=str(OUT / 'selected-moving-route-desktop.png'))
    page.locator('#developer-cutscene-play').click();tick(page, 100)
    first = cutscene(page);tick(page, 400);normal = cutscene(page)
    normal_delta = normal['elapsed'] - first['elapsed']
    switched = switch_rate(page, '#developer-cutscene-speed')
    assert switched['playbackRate'] == 2 and switched['quantumMs'] == first['quantumMs']
    assert page.locator('#developer-cutscene-speed').get_attribute('aria-pressed') == 'true'
    tick(page, 400);fast = cutscene(page)
    fast_delta = fast['elapsed'] - switched['elapsed']
    assert 1.8 <= fast_delta / normal_delta <= 2.2, (normal_delta, fast_delta)
    page.locator('#developer-cutscene-pause').click();tick(page, 50)
    paused = cutscene(page)
    page.locator('#developer-cutscene-speed').click();tick(page, 200)
    still = cutscene(page)
    assert not still['playing'] and still['playbackRate'] == 1 and still['elapsed'] == paused['elapsed']
    page.locator('#developer-cutscene-stop').click();tick(page, 100)
    assert cutscene(page) is None
    assert resources(page) == original and normal_storage(page) == saved
    # Dialogue-map selection keeps its original behavior outside Cutscene mode.
    page.locator('[data-dev-tab="dialogue"]').click();tick(page, 80)
    actor_button(page, 'nell').click();tick(page, 80)
    assert page.locator('#developer-person-name').input_value() == 'Nell'
    assert page.locator('[data-dev-tab="dialogue"]').get_attribute('aria-selected') == 'true'
    assert overlay(page).count() == 0
    page.keyboard.press('F2');tick(page, 100)
    assert normal_storage(page) == saved
    ui.protected_storage(page);no_errors(errors, writes, external)
    context.close()
    return {'releaseBase':base,'actorColors':colors,'clickSelectsPath':True,'miraPathEditable':True,
            'waypointAndEndpointDrags':True,'cardinalLiveAndCompiledPaths':True,'oneUndoPerDrag':True,'blockedDestinationProjected':True,
            'dirtyDialoguePreserved':True,'movingActorSelectionPauses':True,'doubleSpeedRatio':fast_delta/normal_delta,
            'emotesVisible':True,'dialogueClearOfFourCharacters':True,'dialogueSelectionPreserved':True,'normalStorageUntouched':True}


def phone_flow(browser, url, expected):
    context, page, errors, writes, external = ui.open_page(browser, url, 390, 'dark', height=844)
    base = validate_release(page, expected)
    saved = normal_storage(page);original = resources(page)
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
    page.locator('[data-dev-tab="cutscene"]').tap();tick(page, 100)
    cs.select_timeline_mode(page, True)
    select_actor(page, 'iris', True)
    index = selected_index(page)
    before = export_project(page, 'phone-before-route')
    drag_endpoint(page, {'x':850,'y':780}, touch=True)
    after = export_project(page, 'phone-endpoint-route')
    beat = after['content']['depot']['cutscene'][index]
    assert beat.get('destination') and not beat.get('target'), beat
    assert beat != before['content']['depot']['cutscene'][index]
    checked = verify_path(page, after, index)
    assert checked['destinationWalkable'] and not checked['invalid'] and checked['cardinal'], checked
    emote_index = select_track_clip(page, 'iris', 'emote', True)
    page.locator('#developer-cutscene-emote [data-cutscene-choice="question"]').tap();tick(page, 80)
    start_tile = int(page.locator('#developer-cutscene-start').input_value())
    page.locator('#developer-cutscene-play').tap();tick(page, 100)
    # Pause before a precise keyboard seek: a playing range is updated by RAF
    # between key presses, so N Right presses do not necessarily reach tile N.
    page.locator('#developer-cutscene-pause').tap();tick(page, 80)
    scrub = page.locator('#developer-cutscene-scrub');scrub.focus();page.keyboard.press('Home')
    for _ in range(start_tile):
        page.keyboard.press('ArrowRight')
    tick(page, 100)
    sought = cutscene(page)
    assert not sought['playing'] and abs(sought['currentTile']-start_tile) < .001, sought
    assert any(clip['actor']=='iris' and clip['index']==emote_index and clip['emote']=='question'
               for clip in sought['activeClips']), sought
    assert page.locator('.cutscene-emote[data-character="iris"][data-cutscene-emote="question"]').is_visible()
    assert_dialogue_clear_of_cast(page)
    page.screenshot(path=str(OUT / 'route-and-emote-390.png'))
    page.locator('#developer-cutscene-stop').tap();tick(page, 80)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1')
    assert resources(page) == original and normal_storage(page) == saved
    page.keyboard.press('F2');tick(page, 80)
    ui.protected_storage(page);no_errors(errors, writes, external)
    context.close()
    return {'releaseBase':base,'width':390,'actualTouchPathDrag':True,'cardinalLiveAndCompiledPaths':True,'projectedFloor':True,
            'emotePreview':True,'dialogueClearOfFourCharacters':True,'noDocumentOverflow':True,'normalStorageUntouched':True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--expect-release')
    args = parser.parse_args()
    server = None
    started = time.monotonic()
    if args.url:
        url = args.url
    else:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(ui.Quiet, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
        url = f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/' + ('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            runner = cs.PublicBrowser(browser) if url.startswith('https:') else browser
            result = {'entry':url,'cardinal':cardinal_flow(runner,url,args.expect_release),
                      'rate':rate_flow(runner,url,args.expect_release),
                      'desktop':desktop_flow(runner,url,args.expect_release),
                      'phone':phone_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds'] = round(time.monotonic()-started,1)
        name = 'public' if args.url else 'source' if args.source else 'launcher'
        (OUT / (name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:
            server.shutdown()


if __name__ == '__main__':
    main()
