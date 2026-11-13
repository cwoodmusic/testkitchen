"""Timed blue-note vendor quest: chase four cards, rebuild by ear, and use a directional net.
Permanent yellow-note collecting is covered separately from this vendor round.
"""
from collections import Counter
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import argparse
import json
import math

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/town-adventures'))
args = parser.parse_args()
OUT = args.screenshots
OUT.mkdir(parents=True, exist_ok=True)
TIME_LIMIT = 300
NAMES = {'quarter': 'Quarter note', 'eighth-pair': 'Two eighth notes',
         'sixteenth-group': 'Four sixteenth notes', 'quarter-rest': 'Quarter rest'}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, output):
        try:
            super().copyfile(source, output)
        except (BrokenPipeError, ConnectionResetError):
            pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1500, 'height': 1100})
        page.set_default_timeout(30000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))

        def state():
            return page.evaluate('townBuilder.urban.activities.state.rhythmCatch')

        def assert_hunting():
            snapshot = state()
            assert snapshot['phase'] == 'hunt', snapshot
            assert snapshot['remainingSeconds'] > 0, snapshot
            assert len(snapshot['bag']) <= 4, snapshot
            return snapshot

        def route_to(value):
            return page.evaluate(r'''async value=>{
              const t=townBuilder,app=new URL(document.querySelector('script[type="module"]').src),
                {blocked,height}=await import(new URL('../world/model.mjs'+app.search,app)),
                {createPlayerCollisionIndex}=await import(new URL('../world/player-collision-index.mjs'+app.search,app)),
                d=t.project,p=t.urban.activities.state.player,state=t.urban.activities.state.rhythmCatch;
              const token=value==='vendor'?{...(state.host.interaction||state.host)}:
                state.tokens.filter(n=>n.value===value).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
              if(!token)throw Error('The requested blue note is missing: '+value);
              if(value!=='vendor'){token.x=token.homeX;token.y=token.homeY;}
              const index=createPlayerCollisionIndex({getProject:()=>d,catalog:t.catalog,getRevision:()=>0,maxViews:128}),rawClear=q=>!blocked(index.view(q),q.x,q.y,t.catalog);
              const offsets=[[0,0],[9,0],[-9,0],[0,9],[0,-9]],clear=q=>offsets.every(([dx,dy])=>rawClear({x:q.x+dx,y:q.y+dy}));
              const linked=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(let i=1;i<=n;i++){
                const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},prev={x:a.x+(b.x-a.x)*(i-1)/n,y:a.y+(b.y-a.y)*(i-1)/n};
                if(!clear(q)||offsets.some(([dx,dy])=>Math.abs(height(d,q.x+dx,q.y+dy)-height(d,prev.x+dx,prev.y+dy))>14))return false;
              }return true;};
              let start;for(let r=0;r<=3&&!start;r++)for(let yy=-r;yy<=r&&!start;yy++)for(let xx=-r;xx<=r;xx++){
                const q={x:(Math.floor(p.x/64)+xx)*64+32,y:(Math.floor(p.y/64)+yy)*64+32};
                if(clear(q)&&linked(p,{x:q.x,y:p.y})&&linked({x:q.x,y:p.y},q)){start=q;break;}
              }
              if(!start)throw Error('No safe route start');
              const key=q=>`${q.x},${q.y}`,queue=[start],parents=new Map([[key(start),null]]),points=new Map([[key(start),start]]);let goal;
              for(let i=0;i<queue.length&&i<256*192;i++){
                const a=queue[i];if(Math.hypot(a.x-token.x,a.y-token.y)<40){goal=key(a);break;}
                for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){
                  const q={x:a.x+dx,y:a.y+dy},k=key(q);if(parents.has(k)||!clear(q)||!linked(a,q))continue;
                  parents.set(k,key(a));points.set(k,q);queue.push(q);
                }
              }
              if(!goal)throw Error('No walking path to blue note: '+JSON.stringify({value,player:p,token,queue:queue.length,visited:parents.size}));
              const path=[];for(let k=goal;k!==null;k=parents.get(k))path.push(points.get(k));path.reverse();const turns=[path[0]];
              for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],c=path[i+1];if(!c||(b.x-a.x)*(c.y-b.y)!==(b.y-a.y)*(c.x-b.x))turns.push(b);}
              return turns;
            }''', value)

        def walk_route(route):
            page.locator('#map').focus()
            for point in route:
                for axis, positive, negative in [('x', 'd', 'a'), ('y', 's', 'w')]:
                    for _ in range(300):
                        current = page.evaluate('townBuilder.urban.activities.state.player')[axis]
                        delta = point[axis]-current
                        if abs(delta) < 4:
                            break
                        key = positive if delta > 0 else negative
                        running = abs(delta) > 80
                        if running:
                            page.keyboard.down('Shift')
                        page.keyboard.down(key)
                        try:
                            # Time advances only with actual controller keys held.
                            # Slow near turns so latency cannot overshoot a narrow aisle.
                            page.clock.run_for(int(min(200, max(16, (abs(delta)-3)/(780 if running else 450)*1000))))
                        finally:
                            page.keyboard.up(key)
                            page.keyboard.up('Shift')
                        assert_hunting()
                    else:
                        page.screenshot(path=str(OUT/'route-blocked.png'))
                        raise AssertionError(('The real walker could not reach a safe route point', point, axis, page.evaluate('townBuilder.urban.activities.state.player')))

        def chase(value, quota):
            walk_route(route_to(value))
            for attempt in range(100):
                snapshot = assert_hunting()
                if snapshot['bag'].count(value) >= quota:
                    return
                # Use the actual rendered rim's forward midpoint to guide real
                # keyboard movement. Pure motion tests independently check its geometry.
                aim = page.evaluate(r'''async value=>{
                  const t=townBuilder,s=t.urban.activities.state,p=s.player,app=new URL(document.querySelector('script[type="module"]').src),
                    {height}=await import(new URL('../world/model.mjs'+app.search,app)),
                    {netSweepPose,facingAngle,flyingNotePose,NET_WINDUP_FRACTION}=await import(new URL('../world/rhythm-hunt-motion.mjs'+app.search,app));
                  const token=s.rhythmCatch.tokens.filter(n=>n.value===value).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
                  const z=height(t.project,p.x,p.y),note=flyingNotePose(token,s.rhythmCatch.flightTime,height(t.project,token.x,token.y),matchMedia('(prefers-reduced-motion: reduce)').matches),
                    dx=note.x-p.x,dy=note.y-(p.y-z-30),vertical=Math.abs(dy)>Math.abs(dx),
                    direction=vertical?(dy>0?'s':'w'):(dx>0?'d':'a'),facing={w:'up',s:'down',a:'left',d:'right'}[direction],
                    rim=netSweepPose(p,facingAngle(facing),(1+NET_WINDUP_FRACTION)/2,z);
                  return {direction,errorX:note.x-rim.x,errorY:note.y-rim.y,rx:rim.rx,ry:rim.ry};
                }''', value)
                ex, ey = aim['errorX'], aim['errorY']
                if (ex/aim['rx'])**2+(ey/aim['ry'])**2 < 1.5:
                    direction = aim['direction']
                    page.keyboard.down(direction)
                    page.clock.run_for(25)
                    page.keyboard.up(direction)
                    page.keyboard.press('f')
                    page.clock.run_for(560)
                else:
                    direction = ('d' if ex > 0 else 'a') if abs(ex) > abs(ey) else ('s' if ey > 0 else 'w')
                    page.keyboard.down(direction)
                    page.clock.run_for(int(min(110, max(28, math.hypot(ex, ey)/450*1000))))
                    page.keyboard.up(direction)
            raise AssertionError(('Unable to chase a moving blue note', value, state()))

        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        page.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'))
        page.wait_for_function('townBuilder.project.objects.length===137')
        if not page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        page.wait_for_timeout(1000)
        fixture = page.evaluate('''()=>{
          const d=structuredClone(townBuilder.project),v=townBuilder.ambient.actors.find(a=>a.role==='vendor'&&a.asset==='decor-07-06');
          d.spawn={...v.interaction};return d;
        }''')
        page.locator('#file').set_input_files({'name': 'vendor-game-fixture.json', 'mimeType': 'application/json', 'buffer': json.dumps(fixture).encode()})
        page.wait_for_timeout(500)
        page.locator('#walk').click()
        # Install before the round starts so performance.now has one monotonic
        # origin throughout the game; pause it only for focused clock checks.
        page.clock.install()
        page.locator('#map').focus()
        page.keyboard.press('e')
        # Keep placement reproducible; movement, flight and catches use the real game.
        page.evaluate('''()=>{let seed=0x52485954;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}''')
        page.get_by_role('button', name='Play Rhythm Catch', exact=True).click()
        page.wait_for_selector('#rhythmCatchCount')
        assert state()['timeLimit'] == TIME_LIMIT
        assert state()['remainingSeconds'] == TIME_LIMIT, 'The initial listening example must not spend hunt time'
        assert page.get_by_role('timer').inner_text() == '5:00'
        assert page.locator('.rhythm-catch-dialog .rhythm-slot').count() == 0, 'The answer must remain hidden'
        page.wait_for_timeout(1300)
        assert state()['remainingSeconds'] == TIME_LIMIT
        page.screenshot(path=str(OUT/'countdown.png'))
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="hunt"')
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        snapshot = assert_hunting()
        assert len(snapshot['tokens']) == 4
        assert Counter(t['value'] for t in snapshot['tokens']) == Counter(snapshot['target'])
        assert all(t['color'] == 'blue' for t in snapshot['tokens'])
        assert all(t['value'] in NAMES for t in snapshot['tokens'])
        first = snapshot['tokens']
        page.clock.run_for(800)
        later = state()['tokens']
        assert any(abs(a['x']-b['x'])+abs(a['y']-b['y']) > 1 for a, b in zip(first, later))
        assert state()['remainingSeconds'] < TIME_LIMIT-.5
        page.screenshot(path=str(OUT/'hunt.png'))

        # Real controller input must reach the net; a pure-angle unit test would
        # miss an integration bug that keeps swinging at one side of the sprite.
        for direction, expected in [('w', -math.pi/2), ('s', math.pi/2), ('a', math.pi), ('d', 0)]:
            page.locator('#map').focus()
            page.keyboard.down(direction)
            page.clock.run_for(100)
            page.keyboard.up(direction)
            page.keyboard.press('f')
            page.clock.run_for(100)
            swing = state()['swing']
            assert swing is not None, (direction, state())
            assert abs(math.atan2(math.sin(swing['angle']-expected), math.cos(swing['angle']-expected))) < .01, (direction, swing)
            page.screenshot(path=str(OUT/f'net-{direction}.png'))
            page.clock.run_for(470)

        target = state()['target']
        quotas = Counter(target)
        for value, quota in quotas.items():
            while state()['bag'].count(value) < quota:
                chase(value, state()['bag'].count(value)+1)
                print('Caught blue card', value, 'remaining', round(state()['remainingSeconds'], 1), flush=True)
        assert len(state()['bag']) == 4
        assert not state()['tokens']
        walk_route(route_to('vendor'))
        page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="arrange"')
        page.screenshot(path=str(OUT/'arrange.png'))
        before = state()['remainingSeconds']
        page.clock.run_for(3000)
        assert before-state()['remainingSeconds'] >= 2.9, 'Building must use the same countdown'
        for value in reversed(target):
            page.get_by_role('button', name='Add '+NAMES[value], exact=True).click()
        page.get_by_role('button', name='Check my rhythm', exact=True).click()
        assert state()['phase'] == 'arrange'
        assert state()['mistakes'] == 1
        for _ in target:
            page.locator('.rhythm-catch-dialog').get_by_role('button', name='Undo', exact=True).click()
        for value in target:
            page.get_by_role('button', name='Add '+NAMES[value], exact=True).click()
        page.get_by_role('button', name='Check my rhythm', exact=True).click()
        assert state()['phase'] == 'won'
        page.screenshot(path=str(OUT/'net-win.png'))
        saved = page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))')
        assert saved['netWins'] == 1
        assert saved['stars'] == 2
        page.clock.resume()

        page.get_by_role('button', name='Next rhythm', exact=True).click()
        page.wait_for_selector('#rhythmCatchCount')
        assert state()['remainingSeconds'] == TIME_LIMIT
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="hunt"')
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.locator('#map').focus()
        page.keyboard.press('r')
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="listen"')
        before = state()['remainingSeconds']
        page.clock.run_for(8000)
        assert before-state()['remainingSeconds'] >= 7.9, 'Replaying the example must spend hunt time'
        assert page.locator('.rhythm-catch-dialog .rhythm-slot').count() == 0
        page.evaluate('window.dispatchEvent(new Event("blur"))')
        assert state()['paused']
        before = state()['remainingSeconds']
        page.clock.fast_forward(15000)
        assert state()['remainingSeconds'] == before, 'A paused or backgrounded game must retain its remaining time'
        page.get_by_role('button', name='Continue', exact=True).click()
        # AudioContext.resume resolves asynchronously on the browser audio
        # thread. Pump frames without charging any of the paused interval.
        for _ in range(50):
            if not state()['paused']:
                break
            page.wait_for_timeout(20)
            page.clock.run_for(16)
        assert not state()['paused'], state()
        assert state()['remainingSeconds'] <= before
        page.clock.fast_forward((TIME_LIMIT+1)*1000)
        assert state()['phase'] == 'lost'
        assert state()['remainingSeconds'] == 0
        assert page.get_by_role('timer').inner_text() == '0:00'
        assert page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))') == saved, 'Expired rounds must not award stars'
        page.screenshot(path=str(OUT/'time-up.png'))
        page.get_by_role('button', name='Try again', exact=True).click()
        page.wait_for_selector('#rhythmCatchCount')
        assert state()['remainingSeconds'] == TIME_LIMIT
        assert len(state()['tokens']) == 4
        assert not state()['bag']
        assert page.get_by_role('timer').inner_text() == '5:00'
        page.get_by_role('button', name='Leave game', exact=True).click()
        assert state()['phase'] == 'idle'
        assert page.evaluate('townBuilder.project') == fixture, 'The game changed the saved map'
        page.clock.resume()
        page.reload()
        page.wait_for_function('!!window.townBuilder')
        assert page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))') == saved
        assert not errors, errors
        print('PASS: four blue notes, directional F swings, five-minute quest, timed build/replay, pause, expiry/retry, rewards and unchanged saved map.', flush=True)
        browser.close()
finally:
    server.shutdown()
