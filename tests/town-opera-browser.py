"""Placeable Opera House, accessible hall, live ensembles and continuous music.

Run: python3 tests/town-opera-browser.py --screenshots /tmp/town-opera
The imported fixture exists only in an isolated browser profile. Source maps
and the user's existing browser storage are never edited.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from urllib.error import HTTPError
from urllib.request import urlopen
import argparse
import hashlib
import json

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'town/maps/coda-town-uploaded-3.json'
SOURCE_SHA = 'c1eaa096ff14b3a4d2b66ba85a87eb9cfda95027e6d138162c27c8c1e73277b9'
parser = argparse.ArgumentParser()
parser.add_argument('--url', help='Optional published builder URL')
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/town-opera'))
args = parser.parse_args()
args.screenshots.mkdir(parents=True, exist_ok=True)
source_bytes = SOURCE.read_bytes()
assert hashlib.sha256(source_bytes).hexdigest() == SOURCE_SHA


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            # Skipping a recording intentionally cancels its media request.
            pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p, TemporaryDirectory() as downloads:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1740, 'height': 1120}, accept_downloads=True)
        if args.url:
            published_responses = {}

            def production(route):
                cached = published_responses.get(route.request.url)
                if cached:
                    route.fulfill(status=200, headers=cached[0], body=cached[1])
                    return
                try:
                    with urlopen(route.request.url, timeout=45) as response:
                        headers = {'content-type': response.headers.get('content-type', 'application/octet-stream')}
                        body = response.read()
                        if response.status == 200:
                            published_responses[route.request.url] = (headers, body)
                        route.fulfill(status=response.status, headers=headers, body=body)
                except HTTPError as error:
                    route.fulfill(status=error.code, body=error.read())

            context.route('https://cwoodmusic.github.io/**', production)
        page = context.new_page()
        page.set_default_timeout(180000)
        errors, failed_responses = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: failed_responses.append({'url': response.url, 'status': response.status}) if response.status >= 400 and '/town/' in response.url else None)
        page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/', timeout=180000)
        page.wait_for_function('!!window.townBuilder?.concert')
        page.locator('#file').set_input_files(str(SOURCE))
        page.wait_for_function('townBuilder.project.objects.length===120')
        assert page.evaluate('townBuilder.project') == json.loads(source_bytes)
        assert not page.evaluate('townBuilder.project.objects.some(o=>o.asset==="sydney-opera-house")')
        assert not page.evaluate('townBuilder.concert.state.hasVenue')

        # The new venue appears as an ordinary movable urban asset. Loading its
        # library never rewrites the user's map or silently places a building.
        page.locator('#urbanKit').click()
        assert page.locator('[data-asset="sydney-opera-house"]').count() == 1
        assert page.evaluate('townBuilder.project') == json.loads(source_bytes)
        asset = page.evaluate('''()=>{
            const a=townBuilder.catalog.get('sydney-opera-house');
            return {id:a.id,w:a.w,h:a.h,urban:a.urban,fixedScale:a.fixedScale,footprint:a.footprint,door:a.door,boxes:a.boxes,polygons:a.polygons,lights:a.lightEmitters};
        }''')
        assert asset['urban'] == 'opera' and asset['fixedScale']
        assert asset['footprint']['w'] == 4096 and asset['footprint']['h'] == 2560
        assert asset['boxes'] or asset['polygons']
        assert asset['lights']
        placed = {'id': 'opera-browser-fixture', 'asset': 'sydney-opera-house', 'x': 8192, 'y': 8000, 'scale': 1, 'rotation': 0, 'layer': 'objects', 'collision': True}
        door = {'x': placed['x'] - asset['w'] / 2 + asset['door']['x'], 'y': placed['y'] - asset['h'] + asset['door']['y']}
        fixture = {'version': 1, 'name': 'Opera House isolated browser fixture', 'cells': {}, 'edges': {}, 'objects': [placed], 'spawn': {'x': door['x'], 'y': door['y'] + 100}}
        page.locator('#file').set_input_files({'name': 'opera-fixture.json', 'mimeType': 'application/json', 'buffer': json.dumps(fixture).encode()})
        page.wait_for_function('townBuilder.project.name==="Opera House isolated browser fixture"')
        page.wait_for_function('townBuilder.concert.state.hasVenue')
        if page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        page.evaluate('''()=>{const o=townBuilder.project.objects[0],a=townBuilder.catalog.get(o.asset);townBuilder.cam.x=o.x;townBuilder.cam.y=o.y-a.h/2;townBuilder.cam.zoom=.24;}''')
        page.wait_for_timeout(300)
        page.screenshot(path=str(args.screenshots / 'opera-exterior.png'))
        page.locator('#map').screenshot(path=str(args.screenshots / 'opera-exterior-map.png'))

        # Export/import retains the venue as editable map data.
        with page.expect_download() as exported:
            page.locator('#save').click()
        exported_path = Path(downloads) / 'opera-fixture.json'
        exported.value.save_as(str(exported_path))
        assert json.loads(exported_path.read_text()) == fixture
        page.locator('#walk').click()
        page.locator('#map').focus()
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.kind==="concert"')
        page.wait_for_function('townBuilder.concert.state.playing&&townBuilder.concert.currentTime>.1')
        assert page.evaluate('townBuilder.concert.state.failedTrackIds.length') == 0
        page.wait_for_function('Math.abs(townBuilder.concert.audioElement.volume-townBuilder.concert.state.volume)<.005')
        inside = page.evaluate('townBuilder.concert.state')
        assert inside['contextGain'] == 1 and inside['effectiveVolume'] == inside['volume']

        setup = page.evaluate('''async()=>{
            const app=new URL(document.querySelector('script[type="module"]').src);
            const url=name=>new URL('../world/'+name+'.mjs'+app.search,app).href;
            const {getInterior,renderInterior}=await import(url('urban-interiors'));
            const {prepareConcertHallArt,concertHallDrawables}=await import(url('concert-hall'));
            const {stageCollisionBoxes,createStagePerformance}=await import(url('concert-performers'));
            const {CONCERT_PROGRAMME}=await import(url('concert-programme'));
            const {blocked}=await import(url('model'));
            const urban=townBuilder.urban,model=getInterior(urban.scene),check=(ok,label)=>{if(!ok)throw Error(label);};
            let stageBoxes=[];
            const refreshStage=()=>stageBoxes=stageCollisionBoxes(urban.performance,{catalog:townBuilder.catalog});
            const solid=(x,y)=>x<40||y<100||x>model.width-40||y>model.height-40||[...model.solids,...stageBoxes].some(r=>x>=r.x-16&&x<=r.x+r.w+16&&y>=r.y-16&&y<=r.y+r.h+16);
            check(model.width===4096&&model.height===2560,'Hall floor does not match its exterior footprint');
            check(!solid(urban.player.x,urban.player.y),'Hall entrance spawns in a solid');
            check(Array.isArray(model.audience?.seats)&&model.audience.seats.length>=100,'Hall has no selectable audience seating');
            check(model.stage?.performerBounds,'Hall has no stage performer bounds');
            const object=townBuilder.project.objects[0],asset=townBuilder.catalog.get(object.asset),dx=object.x-asset.w/2,dy=object.y-asset.h;
            check(!blocked(townBuilder.project,dx+asset.door.x,dy+asset.door.y+100,townBuilder.catalog),'The exterior door approach is blocked');
            const step=16,cols=Math.ceil(model.width/step),rows=Math.ceil(model.height/step),center=k=>({x:k%cols*step+8,y:Math.floor(k/cols)*step+8});
            const flood=from=>{
                refreshStage();
                const start=Math.floor(from.y/step)*cols+Math.floor(from.x/step),parents=new Int32Array(cols*rows).fill(-2),queue=[start];parents[start]=-1;
                for(let i=0;i<queue.length;i++){const k=queue[i],x=k%cols,y=Math.floor(k/cols);for(const [xx,yy]of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){
                    const next=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||parents[next]!==-2)continue;const p=center(next);if(solid(p.x,p.y))continue;parents[next]=k;queue.push(next);
                }}return {parents,queue};
            };
            const nav=flood(urban.player),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),nearest=(points,target)=>points.reduce((best,p)=>!best||distance(p,target)<distance(best,target)?p:best,null);
            const reachable=nav.queue.map(center),seatReach=model.audience.seats.map(seat=>{
                const at=nearest(reachable,seat.approach);check(at&&distance(at,seat.approach)<13,'Seat '+seat.id+' has no reachable padded approach');return {id:seat.id,approach:seat.approach,reachable:at};
            });
            await prepareConcertHallArt();
            const testChair=model.audience.seats[0],pixelCanvas=document.createElement('canvas');pixelCanvas.width=model.width;pixelCanvas.height=model.height;
            const pc=pixelCanvas.getContext('2d'),pink=(depth)=>{
                renderInterior(pc,urban.scene,{catalog:townBuilder.catalog,performance:urban.performance,time:0,player:{x:testChair.x,y:depth},drawPlayer:c=>{c.fillStyle='#ff00ff';c.fillRect(testChair.x-25,testChair.y-65,50,60);}});
                const pixels=pc.getImageData(testChair.x-25,testChair.y-65,50,60).data;let count=0;
                for(let i=0;i<pixels.length;i+=4)if(pixels[i]===255&&pixels[i+1]===0&&pixels[i+2]===255)count++;return count;
            };
            const chairDepth={behind:pink(testChair.y-1),inFront:pink(testChair.y+1),drawables:concertHallDrawables(pc,model).length};
            check(chairDepth.drawables===model.audience.seats.length,'Interactive chairs are missing from the depth layer');
            check(chairDepth.inFront>2000&&chairDepth.behind<chairDepth.inFront*.8,'A chair does not cover a visitor walking behind it');
            const cv=document.createElement('canvas');cv.width=320;cv.height=240;const ctx=cv.getContext('2d');let clock=0,walkDistance=0,walkFrames=0;
            const moveAxis=(target,axis)=>{for(let i=0;Math.abs(urban.player[axis]-target)>.02&&i<5000;i++){
                const before={...urban.player},delta=target-before[axis],key=axis==='x'?(delta<0?'a':'d'):(delta<0?'w':'s');
                urban.frame(ctx,new Set([key]),Math.min(.04,Math.abs(delta)/450),clock+=40,320,240,()=>{});
                const moved=distance(before,urban.player);check(moved>.001,'WASD collision blocked route at '+before.x+','+before.y+' toward '+key);check(!solid(urban.player.x,urban.player.y),'Player entered a chair or wall');walkDistance+=moved;walkFrames++;
            }check(Math.abs(urban.player[axis]-target)<.03,'Route did not reach a waypoint');};
            const move=point=>{moveAxis(point.x,'x');moveAxis(point.y,'y');};
            const walk=(target,label)=>{
                refreshStage();
                const from={...urban.player},gx=Math.floor(from.x/step),gy=Math.floor(from.y/step),candidates=[];
                const segmentClear=(a,b)=>{const n=Math.max(1,Math.ceil(distance(a,b)/2));for(let i=0;i<=n;i++)if(solid(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;return true;};
                for(let y=gy-4;y<=gy+4;y++)for(let x=gx-4;x<=gx+4;x++){
                    if(x<0||y<0||x>=cols||y>=rows)continue;const p=center(y*cols+x);if(solid(p.x,p.y))continue;
                    for(const first of ['x','y']){const bend=first==='x'?{x:p.x,y:from.y}:{x:from.x,y:p.y};if(segmentClear(from,bend)&&segmentClear(bend,p))candidates.push({point:p,first,distance:distance(from,p)});}
                }
                candidates.sort((a,b)=>a.distance-b.distance);const snap=candidates[0];check(snap,label+' has no clear grid approach');
                moveAxis(snap.point[snap.first],snap.first);const second=snap.first==='x'?'y':'x';moveAxis(snap.point[second],second);
                const {parents,queue}=flood(urban.player),candidate=queue.map(k=>({k,...center(k)})).sort((a,b)=>distance(a,target)-distance(b,target))[0];
                check(candidate&&distance(candidate,target)<35,label+' has no walking route');
                const path=[];for(let k=candidate.k;k!==-1;k=parents[k])path.push(center(k));path.reverse();
                const turns=[];for(let i=1;i<path.length;i++){const p=path[i],prev=path[i-1],next=path[i+1];if(!next||(p.x-prev.x)*(next.y-p.y)!==(p.y-prev.y)*(next.x-p.x))turns.push(p);}
                const before=walkDistance;for(const point of turns)move(point);if(!solid(target.x,target.y))move(target);
                return {label,distance:walkDistance-before,frames:walkFrames,position:{...urban.player},turns:turns.length};
            };
            window.__operaQA={
                seat(id){const seat=model.audience.seats.find(s=>s.id===id);check(seat,'Unknown seat');return walk(seat.approach,'Seat '+id);},
                stage(){return walk({x:model.stage.x+200,y:model.stage.y+model.stage.h-120},'Stage via centre stairs');},
                block(role){
                    const boxes=refreshStage(),performer=urban.performance.actors.find(a=>a.instrument==='baton')||urban.performance.actors[0];
                    const box=role==='performer'?boxes.find(b=>b.role===role&&b.owner===performer.id):boxes.find(b=>b.role===role);
                    check(box,'Missing '+role+' collision');
                    let boundary,target,key,axis;
                    if(role==='performer'){boundary=box.y+box.h+16;target={x:box.x+box.w/2,y:boundary+48};key='w';axis='y';}
                    else {const y=box.y+box.h/2;boundary=Math.max(...boxes.filter(b=>y>=b.y-16&&y<=b.y+b.h+16).map(b=>b.x+b.w+16));target={x:boundary+48,y};key='a';axis='x';}
                    const route=walk(target,'Approach '+role),before={...urban.player};
                    for(let i=0;i<24;i++)urban.frame(ctx,new Set([key]),.04,clock+=40,320,240,()=>{});
                    const after={...urban.player};
                    check(before[axis]-after[axis]>10,'Probe did not walk toward '+role);
                    check(after[axis]>=boundary-.01&&after[axis]<=boundary+3.1,'Player walked through '+role);
                    return {role,boundary,before,after,route};
                },
                overlapTarget(){
                    const track=CONCERT_PROGRAMME.find(t=>t.category==='piano'),future=createStagePerformance(track,{stage:model.stage});
                    const box=stageCollisionBoxes(future,{catalog:townBuilder.catalog}).find(b=>b.role==='piano-body');
                    check(box,'Future recital has no grand-piano body');
                    const point={x:box.x+box.w/2,y:box.y+box.h/2};refreshStage();
                    check(!solid(point.x,point.y),'Future piano position is not clear during orchestra');
                    return {trackId:track.id,box,point,route:walk(point,'Stand on future piano footprint')};
                },
                changeAtOverlap(id){
                    const before={...urban.player};
                    for(let i=0;i<CONCERT_PROGRAMME.length*2+2&&townBuilder.concert.currentTrack.id!==id;i++){
                        townBuilder.concert.skip();urban.performance;
                    }
                    check(townBuilder.concert.currentTrack.id===id,'Could not select the target recital');
                    // Intentionally read the new model before the next frame:
                    // inspection must not consume the collision-settling event.
                    urban.performance;refreshStage();
                    return {before,beforeFrame:{...urban.player},overlap:solid(urban.player.x,urban.player.y)};
                },
                clearFeet(){refreshStage();return !solid(urban.player.x,urban.player.y);},
                exit(){const z=model.zones.find(z=>z.action==='exit');check(z,'Hall lacks exit');return walk({x:z.x+z.w/2,y:z.y+z.h/2},'Hall exit');},
                get programme(){return CONCERT_PROGRAMME;},
                performance(){const p=urban.performance;check(p,'Hall has no performance');return {kind:p.kind,programmeId:p.programmeId,pianist:p.pianist,actors:p.actors.map(a=>({id:a.id,x:a.x,y:a.y,instrument:a.instrument})),props:p.props.length};}
            };
            return {tag:app.search,width:model.width,height:model.height,seats:seatReach,stage:model.stage,chairDepth,programme:CONCERT_PROGRAMME.map(t=>({id:t.id,title:t.title,category:t.category,pianist:t.pianist,composer:t.composer,src:t.src,sourceUrl:t.sourceUrl,license:t.license})),reachable:nav.queue.length};
        }''')
        assert {'orchestra', 'jazz', 'piano'} <= {track['category'] for track in setup['programme']}
        assert {'chopin', 'liszt'} <= {track['pianist'] for track in setup['programme'] if track['category'] == 'piano'}
        assert all(track['license'] and track['sourceUrl'] for track in setup['programme'])
        (args.screenshots / 'setup.json').write_text(json.dumps(setup, indent=2))

        # Audio context gain changes without selecting or restarting a song.
        before_exit = page.evaluate('townBuilder.concert.state')
        page.get_by_role('button', name='Go outside', exact=True).click()
        page.wait_for_function('!townBuilder.urban.active&&townBuilder.concert.state.context==="town"')
        page.wait_for_function('Math.abs(townBuilder.concert.audioElement.volume-townBuilder.concert.state.volume*.06)<.005')
        outside = page.evaluate('townBuilder.concert.state')
        assert outside['trackId'] == before_exit['trackId']
        assert before_exit['currentTime'] <= outside['currentTime'] < before_exit['currentTime'] + 4
        assert outside['contextGain'] == .06 and outside['playing']
        page.locator('#map').focus()
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.scene?.kind==="concert"')
        page.wait_for_function('townBuilder.concert.state.context==="concert"')
        after_entry = page.evaluate('townBuilder.concert.state')
        assert after_entry['trackId'] == outside['trackId']
        assert outside['currentTime'] <= after_entry['currentTime'] < outside['currentTime'] + 4

        # Every selected seat is reached using actual controller movement. E
        # seats the player, E stands up, and movement also returns to the aisle.
        walks = []
        seats = setup['seats']
        chosen = [seats[index] for index in sorted({0, len(seats)//7, len(seats)//3, len(seats)//2-1, len(seats)//2, len(seats)*2//3, len(seats)*6//7, len(seats)-1})]
        for index, seat in enumerate(chosen):
            route = page.evaluate('(id)=>__operaQA.seat(id)', seat['id'])
            page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            walk_zoom = page.evaluate('townBuilder.urban.view.zoom')
            page.locator('#map').focus()
            page.keyboard.press('e')
            page.wait_for_function('!!townBuilder.urban.seated')
            seated = page.evaluate('townBuilder.urban.seated')
            assert (seated.get('id') or seated.get('seatId')) == seat['id'], seated
            watch_view = page.evaluate('townBuilder.urban.view')
            assert watch_view['zoom'] <= .6 and watch_view['zoom'] < walk_zoom
            if index % 2:
                page.keyboard.down('ArrowDown')
                page.wait_for_function('!townBuilder.urban.seated')
                page.keyboard.up('ArrowDown')
            else:
                page.keyboard.press('e')
            page.wait_for_function('!townBuilder.urban.seated')
            assert page.evaluate('townBuilder.urban.view.zoom') == walk_zoom
            walks.append({**route, 'seat': seat['id'], 'walkZoom': walk_zoom, 'watchView': watch_view})
        (args.screenshots / 'walks.json').write_text(json.dumps(walks, indent=2))

        # Leaving the venue while seated must restore the normal walking zoom
        # on the next visit, whether the exit is the HUD button or Escape.
        camera_checks = []
        for method in ['hud', 'escape']:
            walk_zoom = page.evaluate('townBuilder.urban.view.zoom')
            page.evaluate('(id)=>townBuilder.urban.watchSeat(id)', chosen[3]['id'])
            page.wait_for_function('!!townBuilder.urban.seated')
            if method == 'hud':
                page.get_by_role('button', name='Go outside', exact=True).click()
            else:
                page.locator('#map').focus()
                page.keyboard.press('Escape')
            page.wait_for_function('!townBuilder.urban.active')
            page.locator('#map').focus()
            page.keyboard.press('e')
            page.wait_for_function('townBuilder.urban.scene?.kind==="concert"')
            returned_zoom = page.evaluate('townBuilder.urban.view.zoom')
            assert returned_zoom == walk_zoom
            camera_checks.append({'method': method, 'walkZoom': walk_zoom, 'returnedZoom': returned_zoom})

        # A narrow builder canvas still fits the entire stage when a visitor
        # sits down. This exercises the actual resize/layout and camera path.
        page.set_viewport_size({'width': 650, 'height': 900})
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        page.evaluate('(id)=>townBuilder.urban.watchSeat(id)', chosen[3]['id'])
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        narrow = page.evaluate('''()=>{const c=document.getElementById('map');return {width:c.clientWidth,height:c.clientHeight,view:townBuilder.urban.view};}''')
        assert .04 <= narrow['view']['zoom'] < .2, narrow
        stage = setup['stage']
        assert narrow['view']['x'] - narrow['width'] / narrow['view']['zoom'] / 2 <= stage['x']
        assert narrow['view']['x'] + narrow['width'] / narrow['view']['zoom'] / 2 >= stage['x'] + stage['w']
        assert narrow['view']['y'] - narrow['height'] / narrow['view']['zoom'] / 2 <= stage['y']
        assert narrow['view']['y'] + narrow['height'] / narrow['view']['zoom'] / 2 >= stage['y'] + stage['h']
        page.screenshot(path=str(args.screenshots / 'narrow-watch-view.png'))
        page.evaluate('townBuilder.urban.standUp()')
        page.set_viewport_size({'width': 1740, 'height': 1120})
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')

        # Releasing a movement key after focusing the volume slider must clear
        # the game's held-key state rather than leave the avatar walking.
        page.evaluate('__operaQA.exit()')
        page.locator('#map').focus()
        key_start = page.evaluate('({...townBuilder.urban.player})')
        page.keyboard.down('w')
        page.wait_for_timeout(120)
        page.locator('.concert-controls input[type="range"]').focus()
        page.keyboard.up('w')
        released = page.evaluate('({...townBuilder.urban.player})')
        page.wait_for_timeout(250)
        stopped = page.evaluate('({...townBuilder.urban.player})')
        assert key_start['y'] - released['y'] > 10
        assert abs(released['x'] - stopped['x']) + abs(released['y'] - stopped['y']) < .1, (released, stopped)
        focus_check = {'start': key_start, 'released': released, 'stopped': stopped}
        page.locator('#map').focus()

        def select_category(category):
            for _ in range(len(setup['programme']) + 1):
                if page.evaluate('townBuilder.concert.currentTrack.category') == category:
                    break
                page.evaluate('townBuilder.concert.skip()')
            page.wait_for_function('(category)=>townBuilder.urban.performance?.kind===category', arg=category)

        # The center staircase is traversable, while real musician and grand
        # piano footprints stop the player. Navigation includes these solids.
        collisions = []
        for category, role in [('piano', 'piano-body'), ('orchestra', 'performer')]:
            select_category(category)
            stage_route = page.evaluate('__operaQA.stage()')
            collision = page.evaluate('(role)=>__operaQA.block(role)', role)
            return_route = page.evaluate('__operaQA.exit()')
            collisions.append({'category': category, 'stageRoute': stage_route, 'collision': collision, 'returnRoute': return_route})

        # If a new lineup needs the patch where a visitor is standing, the
        # next frame moves their feet clear. Reading the model first must not
        # swallow this event or leave the player trapped in the new piano.
        select_category('orchestra')
        overlap = page.evaluate('__operaQA.overlapTarget()')
        overlap_change = page.evaluate('(id)=>__operaQA.changeAtOverlap(id)', overlap['trackId'])
        assert overlap_change['overlap']
        page.wait_for_function('__operaQA.clearFeet()')
        overlap_settled = page.evaluate('({...townBuilder.urban.player})')
        assert abs(overlap_settled['x'] - overlap_change['before']['x']) + abs(overlap_settled['y'] - overlap_change['before']['y']) > 10
        assert stage['x'] <= overlap_settled['x'] <= stage['x'] + stage['w']
        assert stage['y'] <= overlap_settled['y'] <= stage['y'] + stage['h']
        overlap_check = {'target': overlap, 'change': overlap_change, 'settled': overlap_settled}
        (args.screenshots / 'ensemble-overlap.json').write_text(json.dumps(overlap_check, indent=2))
        page.evaluate('__operaQA.exit()')

        # A shuffled bag visits each complete recording once. The visible
        # players follow the actual track, including both named piano avatars.
        page.evaluate('townBuilder.urban.zoom(10000)')
        page.evaluate('townBuilder.concert.retry()')
        recordings, seen = [], set()
        for index in range(len(setup['programme'])):
            page.wait_for_function('townBuilder.concert.state.playing&&townBuilder.concert.currentTime>.1&&townBuilder.urban.performance?.programmeId===townBuilder.concert.currentTrack.id')
            track = page.evaluate('townBuilder.concert.currentTrack')
            assert track['id'] not in seen, 'Playlist repeated before completing its shuffle bag'
            seen.add(track['id'])
            performance = page.evaluate('__operaQA.performance()')
            expected = {'orchestra': 52, 'jazz': 8, 'piano': 1}[track['category']]
            assert len(performance['actors']) == expected, (track['id'], performance)
            assert performance['kind'] == track['category']
            if track['pianist']:
                assert performance['pianist'] == track['pianist']
            page.evaluate('''async()=>{
                const ids=townBuilder.urban.performance.assetIds||[];
                await Promise.all(ids.map(id=>townBuilder.catalog.get(id)?.ensureFull?.()));
                if(ids.some(id=>!townBuilder.catalog.get(id)?.canvas))throw Error('A stage instrument failed to load');
            }''')
            media = page.evaluate('''()=>{const a=townBuilder.concert.audioElement;return {duration:a.duration,readyState:a.readyState,currentSrc:a.currentSrc,networkState:a.networkState,error:a.error?.code||null};}''')
            assert media['duration'] > 60 and media['readyState'] >= 2 and not media['error'], media
            assert media['currentSrc'] == track['src']
            assert not page.evaluate('townBuilder.concert.state.failedTrackIds.length')
            label = track['category'] + ('-' + track['pianist'] if track.get('pianist') else '')
            page.locator('#map').screenshot(path=str(args.screenshots / ('concert-' + label + '.png')))
            page.evaluate('(id)=>townBuilder.urban.watchSeat(id)', chosen[3]['id'])
            page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            page.locator('#map').screenshot(path=str(args.screenshots / ('watch-' + label + '.png')))
            page.evaluate('townBuilder.urban.standUp()')
            recordings.append({'track': track['id'], 'category': track['category'], 'pianist': track.get('pianist'), 'performers': expected, 'media': media})
            if index < len(setup['programme']) - 1:
                page.evaluate('townBuilder.concert.skip()')

        # The displayed programme includes recording-level credits and links,
        # and audio preferences persist without changing the project.
        page.locator('.urban-hud').get_by_role('button', name='Programme & credits', exact=True).click()
        page.wait_for_selector('.urban-dialog[open]')
        credits = page.locator('.urban-dialog').inner_text()
        for track in setup['programme']:
            assert track['title'] in credits
        assert page.locator('.urban-dialog a[href^="https://"]').count() >= len(setup['programme'])
        page.screenshot(path=str(args.screenshots / 'programme-credits.png'))
        page.get_by_role('button', name='Close', exact=True).click()
        volume_before = page.evaluate('townBuilder.concert.state.volume')
        page.evaluate('townBuilder.concert.setVolume(.4);townBuilder.concert.setMuted(true)')
        assert page.evaluate('townBuilder.concert.state.effectiveVolume') == 0
        assert page.evaluate('townBuilder.concert.audioElement.muted')
        preferences = page.evaluate('JSON.parse(localStorage.getItem("codaTownConcertAudioV1"))')
        assert preferences['volume'] == .4 and preferences['muted']
        page.evaluate('(v)=>{townBuilder.concert.setMuted(false);townBuilder.concert.setVolume(v);}', volume_before)

        # Full-hall view must stay responsive even with all orchestra players.
        for _ in setup['programme']:
            if page.evaluate('townBuilder.concert.currentTrack.category') == 'orchestra':
                break
            page.evaluate('townBuilder.concert.skip()')
        page.wait_for_function('townBuilder.urban.performance?.kind==="orchestra"')
        perf = page.evaluate('''()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1500){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start),frames,ms:now-start});}requestAnimationFrame(tick);})''')
        assert perf['fps'] > 25, perf
        exit_route = page.evaluate('__operaQA.exit()')
        page.locator('#map').focus()
        page.keyboard.press('e')
        page.wait_for_function('!townBuilder.urban.active')
        assert page.evaluate('townBuilder.project') == fixture
        assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_SHA
        assert not errors, errors
        assert not failed_responses, failed_responses
        result = {'asset': asset, 'hall': {key: setup[key] for key in ['width', 'height', 'stage', 'reachable', 'chairDepth']}, 'reachableSeats': len(seats), 'walks': walks, 'exit': exit_route, 'recordings': recordings, 'audioContinuity': {'inside': inside, 'beforeExit': before_exit, 'outside': outside, 'afterEntry': after_entry}, 'cameraChecks': camera_checks, 'narrowWatch': narrow, 'focusCheck': focus_check, 'stageCollisions': collisions, 'ensembleOverlap': overlap_check, 'performance': perf, 'sourceUnchanged': True, 'sourceHash': SOURCE_SHA, 'pageErrors': errors, 'failedResponses': failed_responses}
        (args.screenshots / 'results.json').write_text(json.dumps(result, indent=2))
        print(json.dumps(result), flush=True)
        browser.close()
finally:
    server.shutdown()
