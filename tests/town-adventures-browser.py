"""Chase moving note bugs with the forward F sweep, return to the vendor, and build the rhythm.
Island sailing and shared cave fishing are exercised in town-island-browser.py.
"""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from threading import Thread
from playwright.sync_api import sync_playwright
import json
import argparse
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--screenshots',type=Path,default=Path('/tmp/town-adventures'))
args=parser.parse_args();OUT=args.screenshots;OUT.mkdir(parents=True,exist_ok=True)
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1500,'height':1100});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/');page.wait_for_function('!!window.townBuilder');page.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'));page.wait_for_function('townBuilder.project.objects.length===137');
  if not page.evaluate('townBuilder.npcsVisible'):page.locator('#npcToggle').click()
  page.wait_for_timeout(1200)
  # Use the real vendor interaction with an isolated spawn beside his cart.
  fixture=page.evaluate('''()=>{const d=structuredClone(townBuilder.project),v=townBuilder.ambient.actors.find(a=>a.role==='vendor'&&a.asset==='decor-07-06');d.spawn={...v.interaction};return d;}''')
  page.locator('#file').set_input_files({'name':'vendor-game-fixture.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_timeout(500);page.locator('#walk').click();page.locator('#map').focus();page.keyboard.press('e');page.get_by_role('button',name='Play Rhythm Catch',exact=True).click();
  page.wait_for_selector('#rhythmCatchCount');page.wait_for_timeout(1300);page.screenshot(path=str(OUT/'countdown.png'));page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="hunt"',timeout=30000);page.screenshot(path=str(OUT/'hunt.png'))
  state=page.evaluate('townBuilder.urban.activities.state.rhythmCatch');assert len(state['tokens'])==96;assert max(t['x'] for t in state['tokens'])-min(t['x'] for t in state['tokens'])>5000;assert all(n['value'] in ['quarter','eighth-pair','sixteenth-group','quarter-rest'] for n in state['tokens'])
  first=page.evaluate('townBuilder.urban.activities.state.rhythmCatch.tokens');page.wait_for_timeout(800);later=page.evaluate('townBuilder.urban.activities.state.rhythmCatch.tokens');assert any(abs(a['x']-b['x'])+abs(a['y']-b['y'])>20 for a,b in zip(first,later))
  fps=page.evaluate('''async()=>{const times=[];await new Promise(resolve=>{const take=t=>{times.push(t);if(times.length<100)requestAnimationFrame(take);else resolve();};requestAnimationFrame(take);});return (times.length-1)*1000/(times.at(-1)-times[0]);}''');assert fps>45,fps;print('Active note hunt FPS',round(fps,1),flush=True)
  # Walk real controller routes to each needed note and swing the net.
  target=page.evaluate('townBuilder.urban.activities.state.rhythmCatch.target')
  for value in [*target,'vendor']:
   route=page.evaluate("""async value=>{
    const t=townBuilder,{blocked,height}=await import('/town/world/model.mjs?v=opera-parallax-1'),d=t.project,p=t.urban.activities.state.player,state=t.urban.activities.state.rhythmCatch;
    const token=value==='vendor'?{...(state.host.interaction||state.host)}:state.tokens.filter(n=>n.value===value).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
    if(value!=='vendor'){token.x=token.homeX;token.y=token.homeY;}
    const rawClear=q=>!blocked(d,q.x,q.y,t.catalog);
    const clear=q=>[[0,0],[9,0],[-9,0],[0,9],[0,-9]].every(([dx,dy])=>rawClear({x:q.x+dx,y:q.y+dy}));
    const linked=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(let i=1;i<=n;i++){const q={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n},prev={x:a.x+(b.x-a.x)*(i-1)/n,y:a.y+(b.y-a.y)*(i-1)/n};if(!rawClear(q)||Math.abs(height(d,q.x,q.y)-height(d,prev.x,prev.y))>14)return false;}return true;};
    let start;for(let r=0;r<=3&&!start;r++)for(let yy=-r;yy<=r&&!start;yy++)for(let xx=-r;xx<=r;xx++){const q={x:(Math.floor(p.x/64)+xx)*64+32,y:(Math.floor(p.y/64)+yy)*64+32};if(clear(q)&&linked(p,{x:q.x,y:p.y})&&linked({x:q.x,y:p.y},q)){start=q;break;}}if(!start)throw Error('No safe route start');const key=q=>`${q.x},${q.y}`,queue=[start],parents=new Map([[key(start),null]]),points=new Map([[key(start),start]]);let goal;
    for(let i=0;i<queue.length&&i<7000;i++){const a=queue[i];if(Math.hypot(a.x-token.x,a.y-token.y)<32){goal=key(a);break;}for(const[dx,dy]of [[64,0],[-64,0],[0,64],[0,-64]]){const q={x:a.x+dx,y:a.y+dy},k=key(q);if(parents.has(k)||!clear(q))continue;if(!linked(a,q))continue;parents.set(k,key(a));points.set(k,q);queue.push(q);}}
    if(!goal)throw Error('No walking path to note');const path=[];for(let k=goal;k!==null;k=parents.get(k))path.push(points.get(k));path.reverse();const turns=[path[0]];for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],c=path[i+1];if(!c||(b.x-a.x)*(c.y-b.y)!==(b.y-a.y)*(c.x-b.x))turns.push(b);}return turns;
   }""",value)
   for point in route:
    for axis,positive,negative in [('x','d','a'),('y','s','w')]:
     current=page.evaluate('townBuilder.urban.activities.state.player')[axis];delta=point[axis]-current
     if abs(delta)<10:continue
     key=positive if delta>0 else negative;page.keyboard.down(key)
     page.wait_for_function('([axis,target,sign])=>sign*(townBuilder.urban.activities.state.player[axis]-target)>=-7',arg=[axis,point[axis],1 if delta>0 else -1],timeout=40000)
     page.keyboard.up(key)
   if value=='vendor':
    page.keyboard.press('e');continue
   before=page.evaluate('(value)=>townBuilder.urban.activities.state.rhythmCatch.bag.filter(v=>v===value).length',value)
   for attempt in range(100):
    snap=page.evaluate("value=>{const s=townBuilder.urban.activities.state,p=s.player;return {p,t:s.rhythmCatch.tokens.filter(t=>t.value===value).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0],count:s.rhythmCatch.bag.filter(v=>v===value).length};}",value)
    if snap['count']>before:break
    p0,t=snap['p'],snap['t'];dx,dy=t['x']-p0['x'],t['y']-p0['y'];vertical=abs(dy)>abs(dx);direction=('s' if dy>0 else 'w') if vertical else ('d' if dx>0 else 'a');distance=(dx*dx+dy*dy)**.5
    desired=58 if direction=='w' else 135
    if distance>desired+35:
     page.keyboard.down(direction);page.wait_for_timeout(110);page.keyboard.up(direction)
    elif distance<desired-35:
     opposite={'w':'s','s':'w','a':'d','d':'a'}[direction];page.keyboard.down(opposite);page.wait_for_timeout(65);page.keyboard.up(opposite)
    else:
     page.keyboard.down(direction);page.wait_for_timeout(28);page.keyboard.up(direction);page.keyboard.press('f')
     if attempt==0:page.wait_for_timeout(150);page.screenshot(path=str(OUT/'forward-net-sweep.png'));page.wait_for_timeout(410)
     else:page.wait_for_timeout(560)
   else:raise AssertionError(('Unable to chase a moving note',value,snap))
  page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="arrange"');page.screenshot(path=str(OUT/'arrange.png'))
  names={'quarter':'Quarter note','eighth-pair':'Two eighth notes','sixteenth-group':'Four sixteenth notes','quarter-rest':'Quarter rest'}
  for v in reversed(target):page.get_by_role('button',name='Add '+names[v],exact=True).click()
  page.get_by_role('button',name='Check my rhythm',exact=True).click();assert page.evaluate('townBuilder.urban.activities.state.rhythmCatch.phase')=='arrange'
  for _ in target:page.locator('.rhythm-catch-dialog').get_by_role('button',name='Undo',exact=True).click()
  for v in target:page.get_by_role('button',name='Add '+names[v],exact=True).click()
  page.get_by_role('button',name='Check my rhythm',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="won"');page.screenshot(path=str(OUT/'net-win.png'))
  assert page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest")).netWins')==1
  page.get_by_role('button',name='Back to town',exact=True).click()
  page.wait_for_function('townBuilder.urban.activities.state.rhythmCatch.phase==="idle"');
  assert page.evaluate('townBuilder.project')==fixture,'Catching notes changed the saved map'
  saved=page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))');assert saved['netWins']==1
  page.reload();page.wait_for_function('!!window.townBuilder');assert page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest")).netWins')==1
  assert not errors,errors
  print('END-TO-END PASS: chase flying notes, F forward sweeps, vendor return, wrong/correct rhythm, stars, save/reload, unchanged map.',flush=True)
  b.close()
finally:server.shutdown()
