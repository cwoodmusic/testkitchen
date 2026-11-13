"""Sparse yellow fairies, Tab-equipped net, and persistent inventory remain separate from blue hunts."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json
import math
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/fairy-forgiving/yellow';OUT.mkdir(parents=True,exist_ok=True)
VALUES={'quarter','eighth-pair','sixteenth-group'}
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json'
source_hash=hashlib.sha256(MAP.read_bytes()).hexdigest()

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):pass
    def copyfile(self,source,target):
        try:super().copyfile(source,target)
        except (BrokenPipeError,ConnectionResetError):pass

def verify_forgiving_f(browser,origin,version):
    """Use the public controller with a still fairy to isolate an actual F near miss."""
    probe=browser.new_page(viewport={'width':1000,'height':760},reduced_motion='reduce')
    probe.add_init_script('let edgeSeed=421;Math.random=()=>((edgeSeed=(Math.imul(edgeSeed,1664525)+1013904223)>>>0)/4294967296);')
    errors=[];probe.on('pageerror',lambda error:errors.append(str(error)))
    probe.route(origin+'/__fairy_edge_probe',lambda route:route.fulfill(content_type='text/html',body='<body style="margin:0;background:#233a30;color:#fff0bd;font:18px system-ui"><p style="margin:16px">A fairy just beyond the visible hoop can be caught with F.</p><canvas id="edgeNet" width="1000" height="620" tabindex="0"></canvas></body>'))
    probe.goto(origin+'/__fairy_edge_probe')
    probe.add_script_tag(url=origin+'/character-renderer.js'+version)
    probe.clock.install();probe.clock.pause_at(probe.evaluate('Date.now()/1000')+1)
    setup=probe.evaluate(r'''async version=>{
      const base=new URL('/town/world/',location.href),load=name=>import(new URL(name+version,base)),
        [{createYellowNoteCatch},{createNoteInventory},motion,{blocked}]=await Promise.all([load('yellow-note-catch.mjs'),load('note-inventory.mjs'),load('rhythm-hunt-motion.mjs'),load('model.mjs')]);
      const doc={version:1,cells:{},edges:{},objects:[],spawn:{x:1344,y:1344}};
      for(let i=0;i<43;i++)for(const [x,y]of [[i,0],[i,42],[0,i],[42,i]])doc.cells[`${x},${y}`]={surface:'water',level:0};
      const before=JSON.stringify(doc),player={...doc.spawn},catalog=new Map(),canvas=document.querySelector('canvas'),data={stars:0,yellowNotes:{},npcRhythmWins:{}};let saves=0;
      const inventory=createNoteInventory({data,save(){saves++;return true;}}),yellow=createYellowNoteCatch({canvas,getProject:()=>doc,getPlayer:()=>player,getFacing:()=>'right',catalog,inventory,isEquipped:()=>true});
      yellow.tick(new Set(),0);
      const progress=motion.NET_STRIKE_FRACTION,samples=Array.from({length:2001},(_,i)=>motion.netSweepPose({x:0,y:0},0,i/2000)).filter(p=>p.catchable),visibleReach=Math.max(...samples.map(p=>p.x+p.rx)),gap=Math.min(6,motion.FAIRY_CATCH_PADDING/2),offset={x:visibleReach+gap,y:motion.netSweepPose({x:0,y:0},0,progress).y};
      let selected;
      for(const token of yellow.state.tokens){
        const point=motion.flyingNotePose(token,0,0,true),candidate={x:point.x-offset.x,y:point.y-offset.y};
        if(Array.from({length:33},(_,i)=>({x:candidate.x+(token.x-candidate.x)*i/32,y:candidate.y+(token.y-candidate.y)*i/32})).some(p=>blocked(doc,p.x,p.y,catalog)))continue;
        if(!motion.netSweepHits(point,candidate,0,0,progress))continue;
        if(yellow.state.tokens.some(other=>other.id!==token.id&&motion.netSweepHits(motion.flyingNotePose(other,0,0,true),candidate,0,0,progress)))continue;
        selected={token,point,candidate};break;
      }
      if(!selected)throw Error('No clear isolated edge approach for the generated fairy');Object.assign(player,selected.candidate);
      const rawVisibleHit=samples.some(p=>{const dx=selected.point.x-player.x-p.x,dy=selected.point.y-player.y-p.y,{u,v}=p.rim,det=u.x*v.y-u.y*v.x;return ((dx*v.y-dy*v.x)/det)**2+((u.x*dy-u.y*dx)/det)**2<=1;});
      const character=window.createCodaCharacterRenderer({worldScale:2.5}),ctx=canvas.getContext('2d');
      window.edgeProbe={yellow,inventory,selected,progress,seconds:motion.NET_SWEEP_SECONDS,trusted:false,draw(){
        ctx.fillStyle='#233a30';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(280-player.x,380-player.y);
        yellow.draw(ctx,{x:player.x,y:player.y,zoom:1},0,{net:false});
        const stroke=yellow.netStroke,pose=motion.netVisualPose(player,0,stroke.age);
        character.drawPlayer(ctx,{hairstyle:'short',shirt:'#87939e'},{...player,facing:'right',toolPose:motion.netToolPose(player,0,stroke.age)},0);
        window.edgeDrawNet(ctx,player,{angle:0,age:stroke.age,reducedMotion:true});ctx.restore();
      },report(){return {counts:inventory.counts,total:inventory.total,saves,remaining:yellow.state.tokens.length,mapUnchanged:before===JSON.stringify(doc),trusted:this.trusted};}};
      window.edgeDrawNet=(await load('rhythm-net-render.mjs')).drawRhythmNet;
      canvas.addEventListener('keydown',event=>{window.edgeProbe.trusted=event.isTrusted;yellow.keydown(event);});canvas.focus();
      return {progress,seconds:motion.NET_SWEEP_SECONDS,padding:motion.FAIRY_CATCH_PADDING,gap,rawVisibleHit,paddedHit:motion.netSweepHits(selected.point,player,0,0,progress),value:selected.token.value};
    }''',version)
    assert setup['padding']==12 and 0<setup['gap']<setup['padding']
    assert not setup['rawVisibleHit'] and setup['paddedHit'],'The fairy must be beyond every visible rim in the stroke, inside only the small catch allowance'
    assert setup['value'] in VALUES
    probe.keyboard.press('f');probe.clock.run_for(round(setup['progress']*setup['seconds']*1000))
    probe.evaluate('edgeProbe.draw()');probe.screenshot(path=str(OUT/'edge-before-f-catch.png'))
    probe.evaluate('edgeProbe.yellow.tick(new Set(),0)')
    result=probe.evaluate('edgeProbe.report()')
    assert result['trusted'] and result['total']==1 and result['counts'][setup['value']]==1
    assert result['saves']==1 and result['remaining']==4 and result['mapUnchanged']
    assert set(result['counts'])==VALUES
    probe.evaluate('edgeProbe.draw()');probe.screenshot(path=str(OUT/'edge-saved-f-catch.png'))
    assert not errors,errors
    print('Forgiving actual F catch beyond the visible stroke',json.dumps({**setup,**result}),flush=True)
    probe.close()

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1600,'height':1100})
        context.add_init_script("let yellowSeed=421;Math.random=()=>((yellowSeed=(Math.imul(yellowSeed,1664525)+1013904223)>>>0)/4294967296);")
        context.add_init_script("""window.yellowInk=0;window.netInk=0;window.noteBadgeInk=0;
          const fill=CanvasRenderingContext2D.prototype.fill,stroke=CanvasRenderingContext2D.prototype.stroke,arc=CanvasRenderingContext2D.prototype.arc;
          CanvasRenderingContext2D.prototype.arc=function(x,y,r,...args){if(this.canvas.id==='map'&&r>=35&&r<=45&&['#164fa8','#ddb538'].includes(this.fillStyle))noteBadgeInk++;return arc.call(this,x,y,r,...args);};
          CanvasRenderingContext2D.prototype.fill=function(...args){if(this.canvas.id==='map'&&this.fillStyle==='#ddb538')yellowInk++;return fill.apply(this,args);};
          CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.canvas.id==='map'&&this.strokeStyle==='#5d412b')netInk++;return stroke.apply(this,args);};""")
        page=context.new_page();page.set_default_timeout(60000);errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('PAGE ERROR',str(e),flush=True)))
        state=lambda:page.evaluate('townBuilder.urban.activities.state')
        def assert_moving_net_geometry(game):
            poses=page.evaluate(r'''async game=>{
              const t=window[game],p=t.urban.activities.state.player,app=new URL(document.querySelector('script[type="module"]').src),base=game==='townBuilder'?'../world/':'./world/',
                {height}=await import(new URL(base+'model.mjs'+app.search,app)),
                {netSweepPose,NET_WINDUP_FRACTION,NET_CONTACT_FRACTION}=await import(new URL(base+'rhythm-hunt-motion.mjs'+app.search,app)),z=height(t.project,p.x,p.y);
              return {overhead:netSweepPose(p,0,NET_WINDUP_FRACTION,z),contact:netSweepPose(p,0,NET_CONTACT_FRACTION,z)};
            }''',game)
            u,v=poses['overhead']['rim']['u'],poses['overhead']['rim']['v']
            assert abs(u['x'])<1e-7 and abs(v['y'])<1e-7
            assert abs(u['y'])>abs(v['x'])>=12,'The whole hoop must turn upright above the body'
            assert abs(poses['contact']['rim']['minHeight'])<1e-7
            assert poses['contact']['meshTip']['height']>poses['contact']['rim']['maxHeight'],'The hoop leads the trailing net into the ground'
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder')
        page.locator('#file').set_input_files(str(MAP));page.wait_for_function('townBuilder.project.objects.length===137')
        if not page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
        page.clock.install();page.locator('#walk').click();page.wait_for_function('townBuilder.urban.activities.state.yellowNotes.tokens.length===5')
        fixture=page.evaluate('townBuilder.project');assert state()['rhythmCatch']['phase']=='idle'
        assert state()['yellowNotes']['total']==0
        assert all(token['color']=='yellow' for token in state()['yellowNotes']['tokens'])
        assert all(token['value'] in VALUES for token in state()['yellowNotes']['tokens'])
        assert set(state()['yellowNotes']['counts'])==VALUES
        assert page.locator('.yellow-note-count').count()==3
        assert page.locator('.yellow-note-count[title="Quarter rest"]').count()==0
        assert not state()['netEquipped']
        page.locator('#map').focus();page.evaluate('netInk=0');page.keyboard.press('f');page.wait_for_timeout(160)
        assert state()['yellowNotes']['swing'] is None and state()['yellowNotes']['total']==0
        box=page.locator('#map').bounding_box();page.mouse.click(box['x']+20,box['y']+box['height']/2);page.wait_for_timeout(120)
        assert state()['yellowNotes']['swing'] is None and page.evaluate('netInk')==0
        page.keyboard.press('Tab');assert state()['netEquipped']
        page.keyboard.down('d');page.wait_for_timeout(30);page.keyboard.up('d')
        resting=page.evaluate(r'''async()=>{const t=townBuilder,p=t.urban.activities.state.player,app=new URL(document.querySelector('script[type="module"]').src),{height}=await import(new URL('../world/model.mjs'+app.search,app)),{netVisualPose,facingAngle}=await import(new URL('../world/rhythm-hunt-motion.mjs'+app.search,app));return {p,z:height(t.project,p.x,p.y),pose:netVisualPose(p,facingAngle('right'),Infinity,height(t.project,p.x,p.y)),tool:t.urban.activities.netToolPose};}''')
        assert resting['pose']['groundForward']<0 and resting['pose']['layer']=='behind' and resting['pose']['behind']
        assert resting['pose']['y']+resting['pose']['ry']<resting['p']['y']-resting['z']-58
        assert resting['tool'] and resting['tool']['facing']=='right' and not resting['tool']['active']
        assert_moving_net_geometry('townBuilder')
        page.screenshot(path=str(OUT/'shoulder-carried-yellow-net.png'))
        page.mouse.click(box['x']+20,box['y']+box['height']/2)
        assert state()['yellowNotes']['swing']['angle']==0,'Pointer location must not change right-facing swing'
        page.wait_for_timeout(800);page.keyboard.press('Tab');assert not state()['netEquipped']
        page.keyboard.press('f');page.wait_for_timeout(100);assert state()['yellowNotes']['swing'] is None
        page.keyboard.press('Tab');assert state()['netEquipped']
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        SWING_MS=page.evaluate('''async()=>{const app=new URL(document.querySelector('script[type="module"]').src),m=await import(new URL('../world/rhythm-hunt-motion.mjs'+app.search,app));return Math.ceil((m.NET_SWEEP_SECONDS+m.NET_RECOVERY_SECONDS)*1000)+40;}''')


        # Reach the nearest actual yellow home along legal map paths.
        route=page.evaluate(r'''async()=>{
          const t=townBuilder,s=t.urban.activities.state,p=s.player,d=t.project,app=new URL(document.querySelector('script[type="module"]').src),
            {blocked,height}=await import(new URL('../world/model.mjs'+app.search,app)),{createPlayerCollisionIndex}=await import(new URL('../world/player-collision-index.mjs'+app.search,app));
          const index=createPlayerCollisionIndex({getProject:()=>d,catalog:t.catalog,getRevision:()=>0,maxViews:128}),targets=s.yellowNotes.tokens.map(token=>({...token,x:token.homeX,y:token.homeY}));
          const offsets=[[0,0],[9,0],[-9,0],[0,9],[0,-9]],rawClear=q=>!blocked(index.view(q),q.x,q.y,t.catalog),clear=q=>offsets.every(([dx,dy])=>rawClear({x:q.x+dx,y:q.y+dy}));
          const linked=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},old={x:a.x+(b.x-a.x)*(i-1)/n,y:a.y+(b.y-a.y)*(i-1)/n};if(!clear(q)||offsets.some(([dx,dy])=>Math.abs(height(d,q.x+dx,q.y+dy)-height(d,old.x+dx,old.y+dy))>14))return false;}return true;};
          let start;for(let r=0;r<4&&!start;r++)for(let y=-r;y<=r&&!start;y++)for(let x=-r;x<=r;x++){const q={x:(Math.floor(p.x/64)+x)*64+32,y:(Math.floor(p.y/64)+y)*64+32};if(clear(q)&&linked(p,{x:q.x,y:p.y})&&linked({x:q.x,y:p.y},q)){start=q;break;}}
          if(!start)throw Error('No walking start');const key=q=>`${q.x},${q.y}`,queue=[start],parents=new Map([[key(start),null]]),points=new Map([[key(start),start]]);let goal,token;
          for(let i=0;i<queue.length&&i<256*192;i++){const a=queue[i];token=targets.find(token=>Math.hypot(token.x-a.x,token.y-a.y)<40);if(token){goal=key(a);break;}for(const [dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){const q={x:a.x+dx,y:a.y+dy},k=key(q);if(parents.has(k)||!clear(q)||!linked(a,q))continue;parents.set(k,key(a));points.set(k,q);queue.push(q);}}
          if(!goal)throw Error('No route to a yellow card');const path=[];for(let k=goal;k!==null;k=parents.get(k))path.push(points.get(k));path.reverse();const turns=[path[0]];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],c=path[i+1];if(!c||(b.x-a.x)*(c.y-b.y)!==(b.y-a.y)*(c.x-b.x))turns.push(b);}return {token,path:turns};
        }''')
        print('Nearest yellow home',route['token']['id'],'route turns',len(route['path']),flush=True)
        page.locator('#map').focus()
        for point in route['path']:
            for axis,positive,negative in [('x','d','a'),('y','s','w')]:
                for _ in range(300):
                    current=state()['player'][axis];delta=point[axis]-current
                    if abs(delta)<4:break
                    key=positive if delta>0 else negative;running=abs(delta)>80
                    if running:page.keyboard.down('Shift')
                    page.keyboard.down(key)
                    try:page.clock.run_for(int(min(200,max(16,(abs(delta)-3)/(780 if running else 450)*1000))))
                    finally:page.keyboard.up(key);page.keyboard.up('Shift')
                    assert len(state()['yellowNotes']['tokens'])<=5
                else:raise AssertionError(('A real walker could not reach fairy route',point,axis,state()['player']))
        for attempt in range(120):
            if state()['yellowNotes']['total']>0:break
            aim=page.evaluate(r'''async()=>{
              const t=townBuilder,s=t.urban.activities.state,p=s.player,app=new URL(document.querySelector('script[type="module"]').src),
                {height}=await import(new URL('../world/model.mjs'+app.search,app)),
                {netSweepPose,facingAngle,flyingNotePose,NET_STRIKE_FRACTION}=await import(new URL('../world/rhythm-hunt-motion.mjs'+app.search,app));
              const token=s.yellowNotes.tokens.sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],
                z=height(t.project,p.x,p.y),note=flyingNotePose(token,s.yellowNotes.flightTime,height(t.project,token.x,token.y),matchMedia('(prefers-reduced-motion: reduce)').matches),dx=note.x-p.x,dy=note.y-(p.y-z-30),direction=Math.abs(dy)>Math.abs(dx)?(dy>0?'s':'w'):(dx>0?'d':'a'),rim=netSweepPose(p,facingAngle({w:'up',s:'down',a:'left',d:'right'}[direction]),NET_STRIKE_FRACTION,z);
              const ex=note.x-rim.x,ey=note.y-rim.y,u=rim.rim.u,v=rim.rim.v,det=u.x*v.y-u.y*v.x;
              return {direction,errorX:ex,errorY:ey,mouthDistance:((ex*v.y-ey*v.x)/det)**2+((u.x*ey-u.y*ex)/det)**2};
            }''')
            ex,ey=aim['errorX'],aim['errorY']
            if aim['mouthDistance']<1.5:
                page.keyboard.down(aim['direction']);page.clock.run_for(22);page.keyboard.up(aim['direction']);page.screenshot(path=str(OUT/'fairy-before-catch.png'));page.keyboard.press('f');page.clock.run_for(SWING_MS)
            else:
                direction=('d' if ex>0 else 'a') if abs(ex)>abs(ey) else ('s' if ey>0 else 'w')
                page.keyboard.down(direction);page.clock.run_for(int(min(110,max(28,math.hypot(ex,ey)/450*1000))));page.keyboard.up(direction)
        else:raise AssertionError(('Could not catch a yellow card',state()))
        saved_counts=state()['yellowNotes']['counts'];assert state()['yellowNotes']['total']==1
        assert set(saved_counts)==VALUES
        assert len(state()['yellowNotes']['tokens'])==4;assert state()['rhythmCatch']['phase']=='idle'
        assert page.evaluate('townBuilder.project')==fixture;page.screenshot(path=str(OUT/'saved-yellow-inventory.png'))
        print('Caught yellow by real F sweep',saved_counts,flush=True)
        page.clock.run_for(12500);assert len(state()['yellowNotes']['tokens'])==5
        assert all(token['value'] in VALUES for token in state()['yellowNotes']['tokens'])
        assert state()['yellowNotes']['total']==1

        assert page.evaluate('noteBadgeInk')==0,'The fairy must not have a large circular badge'
        page.clock.resume()
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
            page.wait_for_timeout(200);page.locator('#walk').click();page.wait_for_function('townBuilder.urban.activities.state.yellowNotes.tokens.length===5')
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
        assert state()['yellowNotes']['counts']==saved_counts and len(state()['yellowNotes']['tokens'])<=1
        assert len(state()['yellowNotes']['tokens'])+len(state()['rhythmCatch']['tokens'])<=5
        assert page.locator('.blue-rhythm-hud button').count()==0
        page.locator('#map').focus();page.keyboard.press('Escape')
        page.get_by_role('heading',name='Are you sure you want to end Rhythm Catch?',exact=True).wait_for()
        assert state()['rhythmCatch']['requestingEnd']
        page.get_by_role('button',name='End Rhythm Catch',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="idle"')
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
        page.wait_for_function('townGame.urban.activities.state.yellowNotes.tokens.length===5')
        assert page.evaluate('townGame.urban.activities.state.yellowNotes.counts')==saved_counts
        assert page.locator('.yellow-note-count').count()==3
        page.locator('#world').focus();assert not page.evaluate('townGame.urban.activities.state.netEquipped')
        page.keyboard.press('f');assert page.evaluate('townGame.urban.activities.state.yellowNotes.swing') is None
        page.keyboard.press('Tab');assert page.evaluate('townGame.urban.activities.state.netEquipped')
        page.keyboard.down('d');page.wait_for_timeout(45);page.keyboard.up('d')
        resting=page.evaluate(r'''async()=>{const t=townGame,p=t.player,app=new URL(document.querySelector('script[type="module"]').src),{height}=await import(new URL('./world/model.mjs'+app.search,app)),{netVisualPose,facingAngle}=await import(new URL('./world/rhythm-hunt-motion.mjs'+app.search,app));return {p,z:height(t.project,p.x,p.y),pose:netVisualPose(p,facingAngle('right'),Infinity,height(t.project,p.x,p.y)),tool:t.urban.activities.netToolPose};}''')
        assert resting['pose']['groundForward']<0 and resting['pose']['layer']=='behind'
        assert resting['pose']['y']+resting['pose']['ry']<resting['p']['y']-resting['z']-58
        assert resting['tool'] and resting['tool']['facing']=='right' and not resting['tool']['active']
        assert_moving_net_geometry('townGame')
        page.screenshot(path=str(OUT/'public-play-shoulder-carry.png'));page.keyboard.press('f')
        assert page.evaluate('townGame.urban.activities.state.yellowNotes.swing.angle')==0
        page.wait_for_timeout(600)
        page.set_viewport_size({'width':650,'height':950});page.screenshot(path=str(OUT/'mobile-yellow-inventory.png'))
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.wait_for_timeout(350);assert page.locator('.yellow-note-inventory').is_hidden()
        page.get_by_role('button',name='Go outside',exact=True).click();page.wait_for_selector('.yellow-note-inventory',state='visible')
        assert page.evaluate('townGame.project')==fishing_fixture
        assert hashlib.sha256(MAP.read_bytes()).hexdigest()==source_hash
        verify_forgiving_f(browser,f'http://127.0.0.1:{server.server_port}',page.evaluate("new URL(document.querySelector('script[type=\"module\"]').src).search"))
        assert not errors,errors
        print('PASS: five yellow fairies, Tab equip, shoulder carry, upright rotating hoop and hoop-first contact, forward F/click, inventory/replenish/reload, NPC requests, combined five-note cap, Escape exit, public Play/mobile and unchanged map.',flush=True)
        browser.close()
finally:server.shutdown()
