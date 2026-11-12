"""Vendor Rhythm Catch and pier fishing: real walking, rhythm inputs, rewards, saves and normal play."""
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
  # Walk real controller routes to each needed note and swing the net.
  target=page.evaluate('townBuilder.urban.activities.state.rhythmCatch.target')
  for value in [*target,'vendor']:
   route=page.evaluate("""async value=>{
    const t=townBuilder,{blocked,height}=await import('/town/world/model.mjs?v=opera-parallax-1'),d=t.project,p=t.urban.activities.state.player,state=t.urban.activities.state.rhythmCatch;
    const token=value==='vendor'?{...(state.host.interaction||state.host)}:state.tokens.filter(n=>n.value===value).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
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
   before=page.evaluate('townBuilder.urban.activities.state.rhythmCatch.bag.length');page.keyboard.press('f');page.wait_for_function('(n)=>townBuilder.urban.activities.state.rhythmCatch.bag.length===n+1',arg=before)
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
  # An isolated map spawn at the computed pier boarding point exercises E.
  dock=page.evaluate('townBuilder.urban.activities.state.dock');assert dock,dock
  page.locator('#walk').click();fixture['spawn']={'x':dock['stand']['x'],'y':dock['stand']['y']};page.locator('#file').set_input_files({'name':'dock-game-fixture.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});page.wait_for_timeout(400);page.locator('#walk').click();page.locator('#map').focus();page.keyboard.press('e');page.wait_for_selector('.town-fishing-dialog[open]');page.wait_for_timeout(300);page.screenshot(path=str(OUT/'fishing-boat.png'))
  modes=[('echo','Echo the fish'),('current','Beat current'),('hold','Reel & hold'),('response','Call & response')]
  catches=[]
  for mode,label in modes:
   page.get_by_role('button',name=label,exact=True).click()
   state=page.evaluate('townBuilder.urban.activities.state.fishing');shadow=min(state['school'],key=lambda f:(f['x']-state['boat']['x'])**2+(f['y']-state['boat']['y'])**2)
   for axis,key1,key2 in [('x','d','a'),('y','s','w')]:
    current=page.evaluate('townBuilder.urban.activities.state.fishing.boat')[axis];delta=shadow[axis]-current
    if abs(delta)<.015:continue
    key=key1 if delta>0 else key2;page.keyboard.down(key);page.wait_for_function('([axis,target,sign])=>sign*(townBuilder.urban.activities.state.fishing.boat[axis]-target)>=-.01',arg=[axis,shadow[axis],1 if delta>0 else -1]);page.keyboard.up(key)
   page.keyboard.press('e');page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="challenge"');page.screenshot(path=str(OUT/('fishing-'+mode+'.png')))
   if mode=='hold':
    page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_function('townBuilder.urban.activities.state.fishing.paused');page.get_by_role('button',name='Continue',exact=True).click();page.wait_for_function('!townBuilder.urban.activities.state.fishing.paused')
   events=page.evaluate('townBuilder.urban.activities.state.fishing.challenge.events')
   for event in events:
    now=page.evaluate('townBuilder.urban.activities.state.fishing.audioTime');wait=max(0,(event['at']-now)*1000)
    if wait>0:page.wait_for_timeout(wait+25)
    if event['hold']:
     page.keyboard.down('Space');page.wait_for_timeout(event['duration']*.87*1000);page.keyboard.up('Space')
    else:page.keyboard.press('Space')
   page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="result"',timeout=20000)
   state=page.evaluate('townBuilder.urban.activities.state.fishing');assert state['challenge']['caught'],(mode,state['challenge']);assert state['challenge']['hits']==len(events),(mode,state['challenge'])
   catches.append({'mode':mode,'fish':state['challenge']['fish']['name'],'hits':state['challenge']['hits']})
   page.screenshot(path=str(OUT/('fish-win-'+mode+'.png')));page.get_by_role('button',name='Cast again',exact=True).click()
  page.get_by_role('button',name='Fish journal',exact=True).click();page.screenshot(path=str(OUT/'fish-journal.png'));assert page.locator('.fish-journal-card').count()==24
  saved=page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))');assert sum(v['count'] for v in saved['fish'].values())==4
  page.locator('.town-fishing-dialog .fishing-heading').get_by_role('button',name='Leave boat',exact=True).click();page.wait_for_function('townBuilder.urban.activities.state.fishing.phase==="idle"')
  assert page.evaluate('townBuilder.project')==fixture,'Games changed the saved map'
  page.reload();page.wait_for_function('!!window.townBuilder');restored=page.evaluate('townBuilder.urban.activities.state.fishing.journal');assert restored==saved,'Saved adventure progress did not survive reload'
  # Both games work in the normal play route, including a narrow touch layout.
  page.goto(f'http://127.0.0.1:{server.server_port}/town/?map=builder');page.wait_for_function('!!window.townGame')
  assert page.evaluate('townGame.project.objects.length')==137
  page.locator('#world').focus();page.keyboard.press('e');page.wait_for_selector('.town-fishing-dialog[open]');page.set_viewport_size({'width':650,'height':950});page.screenshot(path=str(OUT/'mobile-fishing.png'))
  assert page.evaluate('document.querySelector(".town-fishing-dialog").getBoundingClientRect().width<=innerWidth')
  page.get_by_role('button',name='Fish journal',exact=True).click();assert page.locator('.fish-journal-card.discovered').count()>0
  page.locator('.town-fishing-dialog .fishing-heading').get_by_role('button',name='Leave boat',exact=True).click()
  print('ALL FOUR CATCHES',json.dumps(catches),flush=True)
  assert not errors,errors
  print('END-TO-END PASS: net collection, wrong/correct ordering, stars, all four fishing modes, hold pause, 24-card journal, saved catches, unchanged map and exits.',flush=True)
  b.close()
finally:server.shutdown()
