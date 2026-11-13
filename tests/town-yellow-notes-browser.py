"""Permanent yellow catches save independently from the timed blue vendor game."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json
import math
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/rhythm-timed/yellow';OUT.mkdir(parents=True,exist_ok=True)
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json'
source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def copyfile(self,source,target):
        try:super().copyfile(source,target)
        except (BrokenPipeError,ConnectionResetError):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.add_init_script("let yellowSeed=421;Math.random=()=>((yellowSeed=(Math.imul(yellowSeed,1664525)+1013904223)>>>0)/4294967296);")
        context.add_init_script("""window.yellowInk=0;window.netInk=0;
          const fill=CanvasRenderingContext2D.prototype.fill,stroke=CanvasRenderingContext2D.prototype.stroke;
          CanvasRenderingContext2D.prototype.fill=function(...args){if(this.canvas.id==='map'&&this.fillStyle==='#ddb538')yellowInk++;return fill.apply(this,args);};
          CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas.id==='map'&&this.strokeStyle==='#5d412b')netInk++;return stroke.apply(this,args);};""")
        page=context.new_page();page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',str(e),flush=True)))
        state=lambda:page.evaluate('townBuilder.urban.activities.state')
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        page.locator('#file').set_input_files(str(MAP));page.wait_for_function('townBuilder.project.objects.length===137')
        if not page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        page.locator('#walk').click();page.wait_for_function('townBuilder.urban.activities.state.yellowNotes.tokens.length===96')
        fixture=page.evaluate('townBuilder.project');assert state()['rhythmCatch']['phase']=='idle'
        assert state()['yellowNotes']['total']==0
        assert all(token['color']=='yellow' for token in state()['yellowNotes']['tokens'])

        # Reach the nearest actual yellow home along legal map paths.
        route=page.evaluate(r'''async()=>{
          const t=townBuilder,s=t.urban.activities.state,p=s.player,d=t.project,app=new URL(document.querySelector('script[type="module"]').src),
            {blocked,height}=await import(new URL('../world/model.mjs'+app.search,app));
          const targets=s.yellowNotes.tokens.map(token=>({...token,x:token.homeX,y:token.homeY}));
          const rawClear=q=>!blocked(d,q.x,q.y,t.catalog),clear=q=>[[0,0],[9,0],[-9,0],[0,9],[0,-9]].every(([dx,dy])=>rawClear({x:q.x+dx,y:q.y+dy}));
          const linked=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},old={x:a.x+(b.x-a.x)*(i-1)/n,y:a.y+(b.y-a.y)*(i-1)/n};if(!rawClear(q)||Math.abs(height(d,q.x,q.y)-height(d,old.x,old.y))>14)return false;}return true;};
          let start;for(let r=0;r<4&&!start;r++)for(let y=-r;y<=r&&!start;y++)for(let x=-r;x<=r;x++){const q={x:(Math.floor(p.x/64)+x)*64+32,y:(Math.floor(p.y/64)+y)*64+32};if(clear(q)&&linked(p,{x:q.x,y:p.y})&&linked({x:q.x,y:p.y},q)){start=q;break;}}
          if(!start)throw Error('No walking start');const key=q=>`${q.x},${q.y}`,queue=[start],parents=new Map([[key(start),null]]),points=new Map([[key(start),start]]);let goal,token;
          for(let i=0;i<queue.length&&i<256*192;i++){const a=queue[i];token=targets.find(token=>Math.hypot(token.x-a.x,token.y-a.y)<40);if(token){goal=key(a);break;}for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){const q={x:a.x+dx,y:a.y+dy},k=key(q);if(parents.has(k)||!clear(q)||!linked(a,q))continue;parents.set(k,key(a));points.set(k,q);queue.push(q);}}
          if(!goal)throw Error('No route to a yellow card');const path=[];for(let k=goal;k!==null;k=parents.get(k))path.push(points.get(k));path.reverse();const turns=[path[0]];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],c=path[i+1];if(!c||(b.x-a.x)*(c.y-b.y)!==(b.y-a.y)*(c.x-b.x))turns.push(b);}return {token,path:turns};
        }''')
        print('Nearest yellow home',route['token']['id'],'route turns',len(route['path']),flush=True)
        page.locator('#map').focus();page.keyboard.down('Shift')
        try:
            for point in route['path']:
                for axis,positive,negative in [('x','d','a'),('y','s','w')]:
                    current=state()['player'][axis];delta=point[axis]-current
                    if abs(delta)<10:continue
                    key=positive if delta>0 else negative;page.keyboard.down(key)
                    try:page.wait_for_function('([axis,target,sign])=>sign*(townBuilder.urban.activities.state.player[axis]-target)>=-7',arg=[axis,point[axis],1 if delta>0 else -1],timeout=20000)
                    finally:page.keyboard.up(key)
        finally:page.keyboard.up('Shift')
        for attempt in range(120):
            if state()['yellowNotes']['total']>0:break
            aim=page.evaluate(r'''async()=>{
              const t=townBuilder,s=t.urban.activities.state,p=s.player,app=new URL(document.querySelector('script[type="module"]').src),
                {height}=await import(new URL('../world/model.mjs'+app.search,app)),
                {netSweepPose,facingAngle,flyingNotePose,NET_WINDUP_FRACTION}=await import(new URL('../world/rhythm-hunt-motion.mjs'+app.search,app));
              const token=s.yellowNotes.tokens.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],
                z=height(t.project,p.x,p.y),note=flyingNotePose(token,s.yellowNotes.flightTime,height(t.project,token.x,token.y),matchMedia('(prefers-reduced-motion: reduce)').matches),dx=note.x-p.x,dy=note.y-(p.y-z-30),direction=Math.abs(dy)>Math.abs(dx)?(dy>0?'s':'w'):(dx>0?'d':'a'),rim=netSweepPose(p,facingAngle({w:'up',s:'down',a:'left',d:'right'}[direction]),(1+NET_WINDUP_FRACTION)/2,z);
              return {direction,errorX:note.x-rim.x,errorY:note.y-rim.y,rx:rim.rx,ry:rim.ry};
            }''')
            ex,ey=aim['errorX'],aim['errorY']
            if (ex/aim['rx'])**2+(ey/aim['ry'])**2<1.5:
                page.keyboard.down(aim['direction']);page.wait_for_timeout(22);page.keyboard.up(aim['direction']);page.keyboard.press('f');page.wait_for_timeout(570)
            else:
                direction=('d' if ex>0 else 'a') if abs(ex)>abs(ey) else ('s' if ey>0 else 'w')
                page.keyboard.down(direction);page.wait_for_timeout(min(110,max(28,math.hypot(ex,ey)/450*1000)));page.keyboard.up(direction)
        else:raise AssertionError(('Could not catch a yellow card',state()))
        saved_counts=state()['yellowNotes']['counts'];assert state()['yellowNotes']['total']==1
        assert len(state()['yellowNotes']['tokens'])==95;assert state()['rhythmCatch']['phase']=='idle'
        assert page.evaluate('townBuilder.project')==fixture;page.screenshot(path=str(OUT/'saved-yellow-inventory.png'))
        print('Caught yellow by real F sweep',saved_counts,flush=True)
        page.wait_for_timeout(12500);assert len(state()['yellowNotes']['tokens'])==96
        assert state()['yellowNotes']['total']==1

        print('Yellow respawn passed',flush=True)

        # Entering the concert suppresses the yellow world overlay and the net.
        page.evaluate("townBuilder.urban.enterBuilding(townBuilder.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.wait_for_timeout(350);page.evaluate('yellowInk=netInk=0');page.wait_for_timeout(800)
        assert page.locator('.yellow-note-inventory').is_hidden();assert page.evaluate('[yellowInk,netInk]')==[0,0]
        assert state()['yellowNotes']['swing'] is None
        page.get_by_role('button',name='Go outside',exact=True).click();page.wait_for_selector('.yellow-note-inventory',state='visible')
        assert page.evaluate('townBuilder.project')==fixture

        print('Concert suppression passed',flush=True)

        def set_spawn(point,name):
            page.locator('#walk').click()
            doc=page.evaluate('townBuilder.project');doc['spawn']={k:point[k] for k in ['x','y']}
            page.locator('#file').set_input_files({'name':name+'.json','mimeType':'application/json','buffer':json.dumps(doc).encode()})
            page.wait_for_timeout(200);page.locator('#walk').click();page.wait_for_function('townBuilder.urban.activities.state.yellowNotes.tokens.length===96')
            return doc

        # An ordinary E conversation remains reachable with the always-on net.
        page.evaluate('townBuilder.ambient.reset()');page.wait_for_function("townBuilder.ambient.actors.some(a=>a.id==='bach'&&!a.hidden)")
        neighbour=page.evaluate("townBuilder.ambient.actors.find(a=>a.id==='bach'&&!a.hidden)")
        assert neighbour
        set_spawn({'x':neighbour['x']+35,'y':neighbour['y']+30},'yellow-neighbour-fixture')
        page.locator('#map').focus();page.keyboard.press('e')
        print('NPC approach',json.dumps({'actor':neighbour['id'],'player':state()['player'],'dialog':page.locator('.urban-dialog').inner_text()}),flush=True)
        page.get_by_role('button',name='Hear rhythm request',exact=True).wait_for(state='visible')
        page.locator('.urban-dialog').get_by_role('button',name='Close',exact=True).click();page.wait_for_selector('.yellow-note-inventory',state='visible')

        print('NPC E offer reachable',flush=True)

        # Blue vendor introduction keeps the saved yellow bank separate.
        vendor=page.evaluate("townBuilder.ambient.actors.find(a=>a.role==='vendor'&&a.asset==='decor-07-06')")
        assert vendor
        set_spawn(vendor['interaction'],'yellow-blue-fixture');page.locator('#map').focus();page.keyboard.press('e');page.get_by_role('button',name='Play Rhythm Catch',exact=True).click()
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="listen"')
        assert state()['yellowNotes']['counts']==saved_counts
        assert state()['rhythmCatch']['timeLimit']==300 and len(state()['rhythmCatch']['tokens'])==4
        assert all(token['color']=='blue' for token in state()['rhythmCatch']['tokens'])
        page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="hunt"',timeout=25000)
        assert state()['yellowNotes']['counts']==saved_counts and len(state()['yellowNotes']['tokens'])==96
        page.locator('.town-game-hud').get_by_role('button',name='Leave',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="idle"')
        page.wait_for_selector('.yellow-note-inventory',state='visible')

        print('Blue independence passed',flush=True)

        # Fishing hides both yellow cards and the yellow net until disembarking.
        dock=state()['dock'];assert dock
        fishing_fixture=set_spawn(dock['stand'],'yellow-fishing-fixture');page.locator('#map').focus();page.keyboard.press('e')
        page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="sail"');page.evaluate('yellowInk=netInk=0');page.wait_for_timeout(800)
        assert page.locator('.yellow-note-inventory').is_hidden();assert page.evaluate('[yellowInk,netInk]')==[0,0]
        page.get_by_role('button',name='Return to pier',exact=True).click();page.wait_for_selector('.yellow-note-inventory',state='visible')
        assert state()['yellowNotes']['counts']==saved_counts;assert page.evaluate('townBuilder.project')==fishing_fixture
        page.reload();page.wait_for_function('!!window.townBuilder');page.locator('#walk').click();page.wait_for_function('townBuilder.urban.activities.state.yellowNotes.total===1')
        assert state()['yellowNotes']['counts']==saved_counts;assert page.evaluate('townBuilder.project')==fishing_fixture
        # Public Play uses the same bank and direction-sensitive net.
        page.goto(f'http://127.0.0.1:{server.server_port}/town/?map=builder');page.wait_for_function('!!window.townGame')
        page.wait_for_function('townGame.urban.activities.state.yellowNotes.tokens.length===96')
        assert page.evaluate('townGame.urban.activities.state.yellowNotes.counts')==saved_counts
        page.locator('#world').focus();page.keyboard.down('d');page.wait_for_timeout(45);page.keyboard.press('f');page.keyboard.up('d')
        assert page.evaluate('townGame.urban.activities.state.yellowNotes.swing.angle')==0
        page.wait_for_timeout(600)
        page.set_viewport_size({'width':650,'height':950});page.screenshot(path=str(OUT/'mobile-yellow-inventory.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.wait_for_timeout(350);assert page.locator('.yellow-note-inventory').is_hidden()
        page.get_by_role('button',name='Go outside',exact=True).click();page.wait_for_selector('.yellow-note-inventory',state='visible')
        assert page.evaluate('townGame.project')==fishing_fixture
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        assert not errors,errors
        print('PASS: permanent yellow cards, real F capture, inventory/replenish/reload, NPC E offer, independent blue challenge, no yellow overlay in concert/fishing, unchanged map.',flush=True)
        browser.close()
finally:server.shutdown()
