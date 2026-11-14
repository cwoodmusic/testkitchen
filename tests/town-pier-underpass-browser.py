"""Actual Play movement and net projection on the ground below a raised pier."""
import argparse, asyncio, base64, hashlib, json
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'town/maps/coda-town-plaza-boardwalk.json'
parser=argparse.ArgumentParser()
parser.add_argument('--url',help='Published Builder URL; requests retain verified TLS')
parser.add_argument('--screenshots',type=Path,default=ROOT/'work/pier-underpass/browser')
parser.add_argument('--label',default='local')
args=parser.parse_args();OUT=args.screenshots;OUT.mkdir(parents=True,exist_ok=True)
map_hash=hashlib.sha256(MAP.read_bytes()).hexdigest();object_count=len(json.loads(MAP.read_text())['objects'])
errors=[];failed=[];network=[];steps=[];cache={};closing=False

class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
 def copyfile(self,a,b):
  try:super().copyfile(a,b)
  except(BrokenPipeError,ConnectionResetError):pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
url=args.url or f'http://127.0.0.1:{server.server_port}/town/builder/'

def note(name,data=None):
 steps.append({'step':name,'data':data});(OUT/'progress.json').write_text(json.dumps(steps,indent=2));print(name,flush=True)

def fetch_verified(address,byte_range):
 headers={'Accept-Encoding':'identity'}
 if byte_range:headers['Range']=byte_range
 try:response=urlopen(Request(address,headers=headers),timeout=45)
 except HTTPError as error:response=error
 with response:return response.status,{k:v for k,v in response.headers.items() if k.lower() in {'content-type','content-range','accept-ranges','cache-control'}},response.read()

async def trusted(route):
 request=route.request;key=(request.url,request.headers.get('range',''))
 if key not in cache:cache[key]=asyncio.create_task(asyncio.to_thread(fetch_verified,*key))
 try:
  status,headers,body=await cache[key];network.append({'url':key[0],'status':status,'bytes':len(body)})
  await route.fulfill(status=status,headers=headers,body=body)
 except Exception as error:
  if not closing:errors.append(str(error));await route.abort()

INSTALL=r'''async()=>{
 let playURL=new URL(document.querySelector('script[type=module]').src),text=await(await fetch(playURL)).text();
 if(!/from\s+['"][^'"]*runtime\.mjs/.test(text)){playURL=new URL(text.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1],playURL);text=await(await fetch(playURL)).text();}
 const dep=(src,base,name)=>new URL(src.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],base),runtimeURL=dep(text,playURL,'runtime'),rt=await(await fetch(runtimeURL)).text(),physicsURL=dep(rt,runtimeURL,'physics'),physics=await(await fetch(physicsURL)).text(),modelURL=dep(physics,physicsURL,'model'),renderURL=dep(rt,runtimeURL,'render'),render=await(await fetch(renderURL)).text(),maskURL=dep(render,renderURL,'pier-actor-occlusion');
 window.__pier={playURL:playURL.href,scale:(await import(runtimeURL)).PLAYER_SCALE,model:await import(modelURL),mask:await import(maskURL),modelURL:modelURL.href,maskURL:maskURL.href,traces:[],shafts:[]};
 const sample=()=>{const g=townGame,p=g.player,m=__pier.model;if(__pier.record)__pier.traces.push({x:p.x,y:p.y,under:!!p.underPier,z:m.actorHeight(g.project,p),deck:m.height(g.project,p.x,p.y),ground:m.terrainHeight(g.project,p.x,p.y),camY:g.cam.y});requestAnimationFrame(sample);};requestAnimationFrame(sample);
 const proto=CanvasRenderingContext2D.prototype,move=proto.moveTo,line=proto.lineTo,stroke=proto.stroke,memo=new WeakMap();
 proto.moveTo=function(x,y){if(this.strokeStyle==='#5d412b'&&this.lineWidth===6)memo.set(this,{move:{x,y}});return move.call(this,x,y);};
 proto.lineTo=function(x,y){if(this.strokeStyle==='#5d412b'&&this.lineWidth===6){const at=memo.get(this);if(at)at.line={x,y};}return line.call(this,x,y);};
 proto.stroke=function(...args){const at=memo.get(this);if(this.strokeStyle==='#5d412b'&&this.lineWidth===6&&at?.line&&at.move.x>12000){const g=townGame,p=g.player,tool=g.urban.activities.netToolPose,z=__pier.model.actorHeight(g.project,p);if(tool){__pier.shafts.push({move:at.move,line:at.line,expected:{x:p.x+tool.hand.x*__pier.scale,y:p.y-z+tool.hand.y*__pier.scale},under:!!p.underPier,z,active:tool.active,canvas:this.canvas.id||'scratch'});if(__pier.shafts.length>512)__pier.shafts.shift();}}return stroke.apply(this,args);};
 window.__pierSample=()=>{const g=townGame,p=g.player;return{player:{...p},height:__pier.model.actorHeight(g.project,p),deck:__pier.model.height(g.project,p.x,p.y),ground:__pier.model.terrainHeight(g.project,p.x,p.y),cam:{...g.cam},net:g.urban.activities.netEquipped,tool:g.urban.activities.netToolPose,mask:__pier.mask.pierActorOcclusionStats(document.getElementById('world').getContext('2d'))};};
}'''

PIXEL_PROBE = r'''async()=>{
async function pierPixelProbe({x=13080,y=11104}={}) {
  const app=new URL(__pier.playURL),source=await(await fetch(app)).text();
  const dep=(text,base,name)=>new URL(text.match(new RegExp("from\\s+['\"]([^'\"]*"+name+"\\.mjs[^'\"]*)['\"]"))[1],base);
  const runtimeURL=dep(source,app,'runtime'),runtimeSource=await(await fetch(runtimeURL)).text(),renderURL=dep(runtimeSource,runtimeURL,'render'),renderSource=await(await fetch(renderURL)).text();
  const modelURL=dep(renderSource,renderURL,'model'),occlusionURL=dep(renderSource,renderURL,'pier-actor-occlusion'),occlusionSource=await(await fetch(occlusionURL)).text(),piersURL=dep(occlusionSource,occlusionURL,'piers'),groundURL=dep(renderSource,renderURL,'ground-render');
  const [{render},M,{drawPier},{groundTexture},{PLAYER_SCALE}]=await Promise.all([import(renderURL),import(modelURL),import(piersURL),import(groundURL),import(runtimeURL)]);
  const game=window.townGame||townBuilder,doc=game.project,before=JSON.stringify(doc),actor={x,y,underPier:true},z=M.actorHeight(doc,actor),deck=M.height(doc,x,y);
  if(deck-z<M.PIER_WALK_CLEARANCE||M.actorBlocked(doc,x,y,game.catalog,actor))throw Error('Choose an actual clear lower-pier point');
  const character=createCodaCharacterRenderer({worldScale:PLAYER_SCALE}),profile=character.normalizeProfile({}),top={id:'mozart',x:x+75,y:y+deck-z,depth:y-1,facing:'down',walking:false};
  // The supported depth override deliberately draws the top actor first even
  // while their real deck height projects them into the lower actor's bitmap.
  if(M.actorHeight(doc,top)!==deck)throw Error('Top NPC must occupy the actual deck');
  const w=640,h=500,cam={x:x+20,y:y-125,zoom:1},canvas=()=>{const cv=document.createElement('canvas');cv.width=w;cv.height=h;return cv;};
  function shot(withNPC,mode){
    const cv=canvas(),c=cv.getContext('2d');
    render(c,doc,cam,w,h,{time:0,night:false,npcs:withNPC?[top]:[],drawNPC:(ctx,npc)=>character.drawNPC(ctx,npc,0),...(mode?{player:mode==='masked'?actor:{...actor,underPier:false},drawPlayer:(ctx,X,Y)=>character.drawPlayer(ctx,profile,{x:actor.x,y:actor.y-z,facing:'down',walking:false},0)}:{})});
    return cv;
  }
  const terrain=shot(false,null),background=shot(true,null),reference=shot(true,'reference'),masked=shot(true,'masked'),mask=canvas(),c=mask.getContext('2d');
  c.translate(w/2,h/2);c.translate(-cam.x,-cam.y);
  for(const [key,a]of Object.entries(doc.cells))if(a.pier&&a.pier.level*M.RISE-z>=M.PIER_WALK_CLEARANCE){const[X,Y]=key.split(',').map(Number);drawPier(c,doc,X,Y,groundTexture('wood'),{afterY:actor.y});}
  const data=cv=>cv.getContext('2d').getImageData(0,0,w,h).data,A=data(masked),B=data(background),R=data(reference),T=data(terrain),K=data(mask);
  const same=(a,b,i)=>a[i]===b[i]&&a[i+1]===b[i+1]&&a[i+2]===b[i+2]&&a[i+3]===b[i+3];
  let erasedPlayer=0,visiblePlayer=0,preservedTopNPC=0,erasureErrors=0,visibleErrors=0,npcErrors=0,maxVisibleDelta=0;const visibleEdgeSamples=[];
  for(let i=0;i<A.length;i+=4){
    if(!same(R,B,i)&&K[i+3]===255){erasedPlayer++;if(!same(A,B,i))erasureErrors++;}
    if(!same(R,B,i)&&K[i+3]===0){visiblePlayer++;const delta=Math.max(...[0,1,2,3].map(k=>Math.abs(A[i+k]-R[i+k])));maxVisibleDelta=Math.max(maxVisibleDelta,delta);if(delta>1)visibleErrors++;if(delta&&visibleEdgeSamples.length<10)visibleEdgeSamples.push({x:(i/4)%w,y:Math.floor(i/4/w),delta,actual:[...A.slice(i,i+4)],reference:[...R.slice(i,i+4)]});}
    if(!same(B,T,i)&&K[i+3]===255){preservedTopNPC++;if(!same(A,B,i))npcErrors++;}
  }
  const result={actor,z,deck,topNPC:top,topNPCHeight:M.actorHeight(doc,top),erasedPlayer,visiblePlayer,preservedTopNPC,erasureErrors,visibleErrors,npcErrors,maxVisibleDelta,visibleEdgeSamples,mapUnchanged:JSON.stringify(doc)===before,moduleURL:renderURL.href};
  if(erasedPlayer<32||visiblePlayer<32||preservedTopNPC<32||erasureErrors||visibleErrors||npcErrors||!result.mapUnchanged)throw Error(JSON.stringify(result));
  return {...result,images:{masked:masked.toDataURL(),reference:reference.toDataURL(),topNPCOnly:background.toDataURL(),foregroundMask:mask.toDataURL()}};
}

return await pierPixelProbe();
}'''

async def main():
 global closing
 async with async_playwright()as playwright:
  browser=await playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=await browser.new_context(viewport={'width':1440,'height':1000})
  if args.url:await context.route('https://cwoodmusic.github.io/testkitchen/**',trusted)
  await context.add_init_script('''if(!localStorage.getItem('__underPierQA')){localStorage.setItem('__underPierQA','1');localStorage.setItem('codaTownBuilderNightV1','day');localStorage.setItem('codaNotesWalletV1',JSON.stringify({version:1,balance:500000,owned:['furniture-geranium'],rewards:[],earned:500020,spent:20}));localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Under Pier QA',customized:true}));localStorage.setItem('codaTownAdventuresV1:guest',JSON.stringify({version:1,stars:7,netWins:2,fish:{'copper-sprat':{count:2,best:14.5}},yellowNotes:{quarter:5,'eighth-pair':2,'sixteenth-group':3},npcRhythmWins:{mozart:2}}));}''')
  page=await context.new_page();page.set_default_timeout(90000)
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('response',lambda response:failed.append({'url':response.url,'status':response.status})if response.status>=400 else None)
  await page.goto(url,wait_until='domcontentloaded');await page.wait_for_function('!!window.townBuilder?.roomEditor')
  await page.locator('#file').set_input_files(str(MAP));await page.wait_for_function('count=>townBuilder.project.objects.length===count',arg=object_count)
  await page.locator('#play').click();await page.wait_for_function('!!window.townGame?.player');await page.evaluate(INSTALL)
  await page.clock.install();await page.clock.pause_at(await page.evaluate('Date.now()/1000')+1)
  await page.locator('#world').focus();await page.clock.run_for(50)
  world=await page.evaluate('JSON.stringify(townGame.project)')
  protected=await page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest","codaUrbanRoomV1","codaRoomLayoutsV1:builder"].map(k=>[k,localStorage.getItem(k)]))')
  note('Actual saved town is loaded in Play',await page.evaluate('({modelURL:__pier.modelURL,maskURL:__pier.maskURL})'))

  async def seed(x,y):
   await page.evaluate('p=>{delete townGame.player.underPier;Object.assign(townGame.player,p);__pier.traces=[];__pier.record=false;}',{'x':x,'y':y})
   await page.clock.run_for(34)

  async def hold(key,duration):
   await page.evaluate('__pier.traces=[];__pier.record=true')
   await page.keyboard.down(key)
   try:await page.clock.run_for(duration)
   finally:await page.keyboard.up(key)
   await page.evaluate('__pier.record=false')
   return await page.evaluate('__pier.traces')

  async def top_person_fixture():
   await page.evaluate('''()=>{const a=townGame.ambient.residents[0];__pier.person={actor:a,before:{...a}};Object.assign(a,{x:townGame.player.x,y:townGame.player.y,location:{kind:'street'},state:'idle',hidden:false,alpha:1,_held:true,_journey:null,_venue:null});delete a.underPier;delete a.interaction;}''')
   await page.clock.run_for(34)
   assert await page.evaluate('__pier.model.actorHeight(townGame.project,__pier.person.actor)')==384

  async def restore_person():
   await page.evaluate('''()=>{const{actor,before}=__pier.person;for(const key of Object.keys(actor))delete actor[key];Object.assign(actor,before);delete __pier.person;}''')

  await seed(12960,11104)
  first=await hold('d',270);inside=await page.evaluate('__pierSample()')
  assert inside['player'].get('underPier') and inside['height']==0 and inside['deck']==384,inside
  assert all(p['z']==0 and abs(p['camY']-p['y'])<1e-7 for p in first)
  await top_person_fixture();await page.keyboard.press('e');await page.clock.run_for(34)
  assert await page.evaluate('!townGame.urban.blocked&&!townGame.urban.active&&!townGame.urban.activities.sailing'),'E interacted with the deck NPC above the player'
  await restore_person()
  await page.keyboard.press('Tab');await page.clock.run_for(34)
  assert (await page.evaluate('__pierSample()'))['net']
  await page.keyboard.press('a')
  await page.keyboard.press('f');await page.clock.run_for(160)
  overhead=await page.evaluate('__pierSample()');assert overhead['tool']['active'] and overhead['height']==0
  await page.locator('#world').screenshot(path=str(OUT/('under-net-overhead-'+args.label+'.png')))
  await page.clock.run_for(335)
  await page.locator('#world').screenshot(path=str(OUT/('under-net-contact-'+args.label+'.png')))
  shafts=await page.evaluate('__pier.shafts.filter(s=>s.under&&s.active)')
  assert shafts and all(abs(s['move']['x']-s['expected']['x'])<1e-7 and abs(s['move']['y']-s['expected']['y'])<1e-7 for s in shafts),shafts
  assert all(s['canvas']=='scratch'for s in shafts),'The under-pier net bypassed foreground occlusion'
  masked=await page.evaluate('__pierSample()');assert masked['mask']and masked['mask']['frames']>0 and masked['mask']['pixels']<2_000_000,masked
  await page.clock.run_for(400)
  second=await hold('d',1030);exit_state=await page.evaluate('__pierSample()')
  assert exit_state['player']['x']>13520 and not exit_state['player'].get('underPier')and exit_state['height']==0,exit_state
  reverse=await hold('a',1300);back=await page.evaluate('__pierSample()')
  assert back['player']['x']<13000 and not back['player'].get('underPier')and back['height']==0,back
  assert any(p['under']for p in reverse)and all(p['z']==0 and abs(p['camY']-p['y'])<1e-7 for p in second+reverse)
  note('Real D/A crosses all six raised-pier columns below the deck; camera and net stay at beach elevation',{'inside':inside,'exit':exit_state,'back':back,'actualShaftSamples':len(shafts)})

  await page.keyboard.press('Tab');await page.clock.run_for(34)
  await seed(13216,10656)
  top=await hold('s',1100);top_state=await page.evaluate('__pierSample()')
  assert top_state['player']['y']>11100 and all(not p['under']and p['z']==384 and abs(p['camY']-(p['y']-384))<1e-7 for p in top),top_state
  await page.locator('#world').screenshot(path=str(OUT/('top-deck-'+args.label+'.png')))
  await page.keyboard.press('Tab');await page.clock.run_for(34);await page.keyboard.press('f');await page.clock.run_for(160)
  top_shafts=await page.evaluate('__pier.shafts.filter(s=>!s.under&&s.active&&s.z===384)')
  assert top_shafts and all(abs(s['move']['y']-s['expected']['y'])<1e-7 for s in top_shafts),top_shafts
  assert all(s['canvas']=='world'for s in top_shafts),'A top-deck net should retain its direct drawing path'
  await page.locator('#world').screenshot(path=str(OUT/('top-net-'+args.label+'.png')))
  await top_person_fixture();await page.keyboard.press('e');await page.clock.run_for(34)
  assert await page.evaluate('document.querySelector(".urban-dialog").open'),'The same-layer deck NPC should still accept E interaction'
  await page.keyboard.press('Escape');await page.clock.run_for(34);await restore_person()
  note('The same pier remains walkable on top from its raised shore, with ordinary384px actor/net projection',top_state)

  pixels=await page.evaluate(PIXEL_PROBE)
  for name,data in pixels.pop('images').items():(OUT/(name+'-'+args.label+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  note('Actual native avatar pixels hide behind foreground timber/deck while overlapping top-deck NPC pixels remain intact',pixels)

  assert await page.evaluate('JSON.stringify(townGame.project)')==world
  assert await page.evaluate('()=>Object.fromEntries(["codaNotesWalletV1","musicArcadeV1","codaTownAdventuresV1:guest","codaUrbanRoomV1","codaRoomLayoutsV1:builder"].map(k=>[k,localStorage.getItem(k)]))')==protected
  assert hashlib.sha256(MAP.read_bytes()).hexdigest()==map_hash
  assert not errors and not failed,(errors,failed)
  result={'passed':True,'label':args.label,'underCrossingBothDirections':True,'underHeightAndCamera':0,'topHeight':384,'actualNetShaftProjection':True,'differentLayerNPCInteractionBlocked':True,'sameLayerNPCInteractionRetained':True,'nativeOcclusion':pixels,'mapAndProgressUnchanged':True,'underState':inside,'topState':top_state,'maskState':masked['mask'],'shafts':shafts,'topShafts':top_shafts,'traces':{'east':first+second,'west':reverse,'top':top},'verifiedHTTPSRequests':len(network),'errors':errors,'failedResponses':failed,'steps':steps}
  (OUT/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps({'passed':True,'label':args.label,'underBothDirections':True,'topHeight':384,'actualNetProjection':True,'errors':errors,'failedResponses':failed}),flush=True)
  closing=True;await context.close();await browser.close()

try:asyncio.run(main())
finally:server.shutdown()
