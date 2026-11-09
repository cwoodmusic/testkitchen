"""Art-grounded collision and actor layering regression.

Run: python tests/town-collision-layers-browser.py [--map project.json]
Uses isolated browser storage and never changes the source project file.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
from urllib.error import HTTPError
import argparse,base64,hashlib,json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--map',type=Path,default=ROOT/'town/maps/coda-town-uploaded-3.json')
parser.add_argument('--url',help='Optional published builder URL')
parser.add_argument('--duration',type=int,default=360,help='Simulated city seconds')
parser.add_argument('--step',type=float,default=1/60,help='Simulation step; default matches 60 FPS')
parser.add_argument('--screenshots',type=Path)
parser.add_argument('--diagnostic',action='store_true',help='Collect known native-art parity differences while testing other behavior')
args=parser.parse_args()
if not 0<args.step<=.1:parser.error('--step must be greater than zero and at most 0.1 seconds')
source_bytes=args.map.read_bytes();source=json.loads(source_bytes);source_hash=hashlib.sha256(source_bytes).hexdigest()
class Quiet(SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1500,'height':1000})
  if args.url:
   def production(route):
    try:
     with urlopen(route.request.url,timeout=45) as response:route.fulfill(status=response.status,headers={'content-type':response.headers.get('content-type','application/octet-stream')},body=response.read())
    except HTTPError as error:route.fulfill(status=error.code,body=error.read())
   context.route('https://cwoodmusic.github.io/**',production)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def save_image(name,data):
   if args.screenshots:
    args.screenshots.mkdir(parents=True,exist_ok=True)
    (args.screenshots/(name+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  page.expose_function('__saveCollisionImage',save_image)
  def save_data(name,data):
   if args.screenshots:
    args.screenshots.mkdir(parents=True,exist_ok=True)
    (args.screenshots/(name+'.json')).write_text(json.dumps(data,indent=2))
  page.expose_function('__saveCollisionData',save_data)
  page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/',timeout=120000)
  page.wait_for_function('!!window.townBuilder',timeout=120000)
  page.locator('#file').set_input_files(str(args.map))
  page.wait_for_function('n=>townBuilder.project.objects.length===n',arg=len(source['objects']),timeout=120000)
  assert page.evaluate('townBuilder.project')==source
  urls=page.evaluate('''()=>{const app=new URL(document.querySelector('script[type="module"]').src);return Object.fromEntries(['model','runtime','npc-navigation','npc-district','ambient-npcs','physics','render','terrain-render','asset-lawn'].map(name=>[name,new URL('../world/'+name+'.mjs'+app.search,app).href]));}''')
  result=page.evaluate('''async({urls,duration,step,diagnostic})=>{
   const {blocked,height}=await import(urls.model),{render}=await import(urls.runtime);
   const {createNPCNavigator}=await import(urls['npc-navigation']);
   const {createAmbientNPCs}=await import(urls['ambient-npcs']);
   const {assetMapImage,assetMapImageRevision}=await import(urls['asset-lawn']);
   const {movePlayer}=await import(urls.physics),{drawObject}=await import(urls.render),{drawTerrain}=await import(urls['terrain-render']);
   const doc=townBuilder.project,catalog=townBuilder.catalog,before=JSON.stringify(doc),cases=[],shots={};
   const check=(ok,label)=>{if(!ok)throw Error(label);};
   const object=(asset,extra={})=>({id:'fixture:'+asset,asset,x:8192,y:7000,scale:1,rotation:0,layer:asset==='music-square'?'ground':'objects',collision:true,...extra});
   const fixture=o=>({version:1,name:'Collision/layer regression',cells:{},edges:{},objects:[o],spawn:{x:8192,y:7200}});
   const local=(o,a,x,y)=>{const r=(o.rotation||0)*Math.PI/180,dx=(x-a.w/2)*o.scale,dy=(y-a.h)*o.scale;return{x:o.x+dx*Math.cos(r)-dy*Math.sin(r),y:o.y+dx*Math.sin(r)+dy*Math.cos(r)};};
   const native=(o,a,x,y)=>local(o,a,x/1536*a.w,y/1024*a.h);
   const navigatorFor=d=>createNPCNavigator({getProject:()=>d,catalog});
   // These probes are authored from the native painting, independent of the
   // collision boxes that the implementation uses. A flat isolated fixture
   // ensures a terrain cliff or unrelated prop cannot make a false pass.
   const square=object('music-square'),squareArt=catalog.get(square.asset),squareDoc=fixture(square);
   const squareSolids=[['left bench',390,205],['right bench',1140,205],['northwest flowerbed',240,175],['north inner flowerbed',550,165],['north inner right bed',980,165],['northeast flowerbed',1300,175],['west planter',242,451],['east planter',1290,451],['southwest planter',267,765],['southeast planter',1265,765],['northwest lamp base',140,230],['northeast lamp base',1400,230],['southwest lamp base',130,900],['southeast lamp base',1400,900],['fountain basin',768,520]];
   for(const [label,x,y]of squareSolids){const q=native(square,squareArt,x,y);check(blocked(squareDoc,q.x,q.y,catalog),'Native Music Square '+label+' remains walkable');cases.push('square solid: '+label);}
   for(const [label,x,y]of [['left seat approach',360,245],['right seat approach',1110,245],['west walk',430,540],['east walk',1100,540],['north entrance',768,110],['south entrance',768,960],['west entrance',45,490],['east entrance',1490,490]]){const q=native(square,squareArt,x,y);check(!blocked(squareDoc,q.x,q.y,catalog),'Native Music Square '+label+' was closed');cases.push('square clear: '+label);}
   for(const id of ['decor-06-01','decor-06-02','decor-06-03']){
    const o=object(id),a=catalog.get(id),d=fixture(o),seat=local(o,a,a.w*.5,a.h*.7),approach=local(o,a,a.w*.5,a.h+65);
    check(blocked(d,seat.x,seat.y,catalog),id+' pictured bench seat remains walkable');check(!blocked(d,approach.x,approach.y,catalog),id+' approach was blocked');
    const nav=navigatorFor(d),from=local(o,a,-100,a.h*.7),to=local(o,a,a.w+100,a.h*.7),path=nav.plan(from,to);
    check(path.length,id+' has no route around its seat');let previous=from;
    for(const end of path){const n=Math.ceil(Math.hypot(end.x-previous.x,end.y-previous.y)/3);for(let i=1;i<=n;i++){const q={x:previous.x+(end.x-previous.x)*i/n,y:previous.y+(end.y-previous.y)*i/n};check(!blocked(d,q.x,q.y,catalog),id+' path crosses bench');}previous=end;}
    cases.push('bench seat/approach/route: '+id);
   }
   const gazebo=object('props-4-960'),gazeboArt=catalog.get(gazebo.asset),gazeboDoc=fixture(gazebo);
   for(const [label,x,y]of [['west planter',.15,.85],['east planter',.85,.85],['west front post',.30,.80],['east front post',.70,.80],['rear rail',.5,.60]]){const p=local(gazebo,gazeboArt,gazeboArt.w*x,gazeboArt.h*y);check(blocked(gazeboDoc,p.x,p.y,catalog),'Gazebo '+label+' remains walkable');}
   for(const [label,x,y]of [['center deck',.5,.72],['center stair',.5,.98]]){const p=local(gazebo,gazeboArt,gazeboArt.w*x,gazeboArt.h*y);check(!blocked(gazeboDoc,p.x,p.y,catalog),'Gazebo '+label+' was closed');}
   cases.push('gazebo posts/planters/rail and open center stair');
   // Existing flowers were saved with the old default collision:false. NPC
   // routing now treats their planted base as an obstacle while preserving
   // the explicit player setting and the map's original saved boolean.
   for(const id of ['decor-10-06','decor-10-07','decor-10-13']){
    const o=object(id,{collision:false}),a=catalog.get(id),d=fixture(o),q=local(o,a,a.w*.5,a.h*.86),nav=navigatorFor(d);
    check(!blocked(d,q.x,q.y,catalog),id+' lost the player collision-off setting');
    check(blocked(nav.collisionView(q),q.x,q.y,catalog),id+' legacy flower base still accepts pedestrians');
    const from=local(o,a,-110,a.h*.86),to=local(o,a,a.w+110,a.h*.86),path=nav.plan(from,to);
    check(path.length,id+' has no pedestrian detour');let previous=from;
    for(const end of path){const n=Math.ceil(Math.hypot(end.x-previous.x,end.y-previous.y)/3);for(let i=1;i<=n;i++){const p={x:previous.x+(end.x-previous.x)*i/n,y:previous.y+(end.y-previous.y)*i/n};check(!blocked(nav.collisionView(p),p.x,p.y,catalog),id+' pedestrian path crosses planted base');}previous=end;}
    const walker={...from};for(let i=0;i<240;i++)movePlayer(nav.collisionView(walker),walker,new Set(['d']),1/60,catalog);
    check(walker.x<q.x,id+' pedestrian physics walked through its planted base');
    check(d.objects[0].collision===false,id+' policy rewrote the saved map');cases.push('legacy flower avoidance: '+id);
   }
   const marker='#fb0df9',make=()=>{const cv=document.createElement('canvas');cv.width=1000;cv.height=700;return cv.getContext('2d',{willReadFrequently:true});};
   const paint=(c,x,y)=>{c.fillStyle=marker;c.fillRect(x-25,y-140,50,140);};
   const markerPixels=c=>{const p=c.getImageData(0,0,1000,700).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]===251&&p[i+1]===13&&p[i+2]===249&&p[i+3]===255)n++;return n;};
   const pixels=c=>new Uint8Array(c.getImageData(0,0,1000,700).data);
   const difference=(a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;};
   function markerFrame(d,p,kind='npc',unrelated=false){const c=make();c.imageSmoothingEnabled=false;const cam={x:p.x,y:p.y-45,zoom:1};render(c,d,cam,1000,700,{time:0,night:false,terrainRevision:0,...(kind==='npc'?{npcs:[{id:'qa-marker',...p}],drawNPC:(c,n)=>paint(c,n.x,n.y),...(unrelated?{player:{x:p.x+8000,y:p.y+6000},drawPlayer:()=>{}}:{})}:{player:p,drawPlayer:paint})});return c;}
   function nativeArtFrame(d,focus,zoom=1){
    const c=make(),cam={x:focus.x,y:focus.y-45,zoom};c.imageSmoothingEnabled=false;
    c.fillStyle='#101f19';c.fillRect(0,0,1000,700);c.save();c.translate(500,350);c.scale(zoom,zoom);c.translate(-cam.x,-cam.y);
    const left=cam.x-500/zoom,top=cam.y-350/zoom;
    drawTerrain(c,d,{x0:Math.max(0,Math.floor(left/64)-1),x1:Math.min(256,Math.ceil((left+1000/zoom)/64)+1),y0:Math.max(0,Math.floor(top/64)-1),y1:Math.min(192,Math.ceil((top+700/zoom+48*9)/64)+1)},{time:0,terrainRevision:0});
    for(const o of d.objects)drawObject(c,o,d,false,1,0);c.restore();return c;
   }
   const artParity=[];
   async function artCompare(id,d,focus,zoom=1,context=null,label=id){
    const c=context||make();c.imageSmoothingEnabled=false;
    render(c,d,{x:focus.x,y:focus.y-45,zoom},1000,700,{time:0,night:false,terrainRevision:0});
    const native=nativeArtFrame(d,focus,zoom),actual=pixels(c),expected=pixels(native);let changed=0,severe=0,max=0;
    for(let i=0;i<actual.length;i+=4){let delta=0;for(let k=0;k<4;k++)delta=Math.max(delta,Math.abs(actual[i+k]-expected[i+k]));if(delta)changed++;if(delta>8)severe++;max=Math.max(max,delta);}
    await window.__saveCollisionImage('native-art-'+label+'-'+zoom,c.canvas.toDataURL('image/png'));await window.__saveCollisionImage('native-baseline-'+label+'-'+zoom,native.canvas.toDataURL('image/png'));
    if(!diagnostic)check(changed===0,id+' layer splitting changed native artwork ('+changed+' pixels at '+zoom+', maximum channel error '+max+')');
    artParity.push({id,label,zoom,changed,severe,max});shots['native-art-'+label+'-'+zoom]=c.canvas.toDataURL('image/png');
   }
   for(const id of ['music-square','props-4-960','coda-residences','coda-furnishings','coda-arcade']){
    const o=object(id),a=catalog.get(id),d=fixture(o),focus=local(o,a,a.w*.5,a.h*.83);
    for(const zoom of ['music-square','props-4-960'].includes(id)?[1,.25,.08]:[1])await artCompare(id,d,focus,zoom);
   }
   // The second rim edit reuses the very same mutable source canvas. A cache
   // keyed only by canvas identity would keep the first edit's stale pixels.
   const editedSquare=object('music-square'),editDoc=fixture(editedSquare),rimFocus=native(editedSquare,squareArt,15,740),warmed=make();
   const tileAt=(x,y)=>{const p=native(editedSquare,squareArt,x,y);return `${Math.floor(p.x/64)},${Math.floor(p.y/64)}`;};
   editDoc.cells[tileAt(15,700)]={surface:'asphalt',level:0};
   await artCompare('music-square',editDoc,rimFocus,1,warmed,'rim-first');
   const firstSource=assetMapImage(squareArt,editedSquare,editDoc),firstRevision=assetMapImageRevision(firstSource);
   editDoc.cells[tileAt(15,780)]={surface:'sidewalk',level:0};
   await artCompare('music-square',editDoc,rimFocus,1,warmed,'rim-second');
   const secondSource=assetMapImage(squareArt,editedSquare,editDoc),secondRevision=assetMapImageRevision(secondSource);
   check(firstSource===secondSource,'Second rim edit did not exercise mutable-canvas reuse');check(secondRevision>firstRevision,'Second rim edit did not advance the source revision');
   for(const zoom of [.25,.08])await artCompare('music-square',editDoc,rimFocus,zoom,null,'rim-second');
   cases.push('two successive mutable Music Square rim edits');
   const sceneMasks=[];
   for(const [label,x,y,behind]of [['bench behind',390,140,true],['bench in front',390,245,false],['flowerbed behind',230,145,true],['flowerbed in front',230,220,false]]){
    const p=native(square,squareArt,x,y),c=markerFrame(squareDoc,p),clean=markerFrame({...squareDoc,objects:[]},p),visible=markerPixels(c),full=markerPixels(clean);
    await window.__saveCollisionImage('mask-'+label.replaceAll(' ','-'),c.canvas.toDataURL('image/png'));
    check(behind?visible<full*.98:visible>=full*.99,'Music Square '+label+' has wrong foreground occlusion ('+visible+'/'+full+')');
    sceneMasks.push({label,visible,full});shots['mask-'+label.replaceAll(' ','-')]=c.canvas.toDataURL('image/png');cases.push('square layer: '+label);
   }
   const buildingCases=[];
   for(const id of ['coda-residences','coda-furnishings','coda-arcade']){
    const o=object(id),a=catalog.get(id),d=fixture(o);
    for(const fraction of [.25,.5,.75]){
     const x=a.w*fraction,front=Math.max(...[-25,-12,0,12,25].map(dx=>a.frontAtX?.(x+dx)).filter(Number.isFinite));if(front===null||!Number.isFinite(front))continue;
     const p=local(o,a,x,front+24),npc=markerFrame(d,p),player=markerFrame(d,p,'player'),withPlayer=markerFrame(d,p,'npc',true),clean=markerFrame({...d,objects:[]},p),visible=markerPixels(npc),full=markerPixels(clean);
     const nav=navigatorFor(d);check(!blocked(nav.collisionView(p),p.x,p.y,catalog),id+' front marker point is not physically clear');
     check(difference(pixels(npc),pixels(player))===0,id+' NPC and player have different front depth at column '+fraction);
     check(difference(pixels(npc),pixels(withPlayer))===0,id+' NPC disappears when an unrelated player changes column');
     await window.__saveCollisionImage('facade-'+id+'-'+fraction,npc.canvas.toDataURL('image/png'));
     if(!diagnostic)check(visible>=full*.94,id+' front pedestrian is hidden by the facade at column '+fraction+' ('+visible+'/'+full+')');
     buildingCases.push({id,column:fraction,visible,full,blocked:blocked(d,p.x,p.y,catalog),x:p.x,y:p.y,localX:x,localFront:front});
    }
    if(id==='coda-arcade'){
     const x=a.w*.5,corner=local(o,a,x,a.frontAtX(x)+18),nav=navigatorFor(d);
     check(blocked(nav.collisionView(corner),corner.x,corner.y,catalog),'Arcade recessed corner accepts a pedestrian whose body crosses its adjacent wing');
     cases.push('arcade recessed-corner body clearance');
    }
    if(a.footprint&&a.urban){
     const foot=a.footprint,base=foot.y+foot.h,plinth=local(o,a,foot.x-15,base-30),approach=local(o,a,a.door.x,a.door.y+116);
     check(blocked(d,plinth.x,plinth.y,catalog),id+' visible side plinth remains walkable');
     check(!blocked(d,approach.x,approach.y,catalog),id+' door approach was blocked');
    }
    cases.push('player/NPC facade depth: '+id);
   }
   // Use a real resident renderer for visual review in the actual unchanged map.
   const sim=createAmbientNPCs({getProject:()=>doc,catalog}),progress=new Map(),stalls=new Map(),previousResidents=new Map(),maxGapByActor=new Map();let sawSeat=false,sawWalk=false,doorTransitions=0,steps=0;
   sim.update(0);const npcNav=navigatorFor(doc);
   function capture(label,actors,p,time){if(shots[label])return;const c=make();c.imageSmoothingEnabled=false;render(c,doc,{x:p.x,y:p.y-height(doc,p.x,p.y)-60,zoom:1.1},1000,700,{time,night:false,terrainRevision:0,npcs:actors,drawNPC:sim.draw});shots[label]=c.canvas.toDataURL('image/png');void window.__saveCollisionImage(label,shots[label]);}
      for(let frame=1;frame<=Math.ceil(duration/step);frame++){
    const time=frame*step;sim.update(step,time);
    const threshold=sim.district.tower?.threshold||sim.district.tower?.approach;
    for(const n of sim.residents){
     const previous=previousResidents.get(n.id);
     if(previous&&previous.kind==='street'&&n.location.kind!=='street'){
      check(threshold&&Math.hypot(previous.x-threshold.x,previous.y-threshold.y)<=160,'Resident disappeared into an asset away from the apartment door: '+n.id);doorTransitions++;
     }
     if(previous&&previous.kind!=='street'&&n.location.kind==='street')check(threshold&&Math.hypot(n.x-threshold.x,n.y-threshold.y)<=256,'Resident reappeared away from apartment door: '+n.id);
     previousResidents.set(n.id,{x:n.x,y:n.y,kind:n.location.kind});
    }
    for(const n of sim.actors){
     if(n.role==='vendor'){capture('vendor-grounding',sim.actors,n,time);continue;}
     if(n.walking){sawWalk=true;steps++;check(!blocked(npcNav.collisionView(n),n.x,n.y,catalog),'Actual map pedestrian entered solid artwork at '+n.x+','+n.y);}
     if(n.seated){sawSeat=true;capture(String(n.seatId).startsWith('square-seat:')?'square-bench-seat':'standalone-bench-seat',sim.actors,n,time);}
     if(n.state==='walking'||n.state==='waiting'){
      let p=progress.get(n.id);if(!p||Math.hypot(n.x-p.x,n.y-p.y)>90){p={x:n.x,y:n.y,time};progress.set(n.id,p);}const gap=time-p.time;maxGapByActor.set(n.id,Math.max(maxGapByActor.get(n.id)||0,gap));if(gap>25)stalls.set(n.id,{id:n.id,gap,time,state:n.state,x:n.x,y:n.y,goal:n._goal,path:n._path,pending:n._pending,stuck:n._stuck,yield:n._yield,progress:n._progress});
     }else progress.delete(n.id);
    }
    if(frame%100===0)await new Promise(resolve=>setTimeout(resolve,0));
   }
   const entries=sim.events.filter(e=>e.type==='enter-building').length,returns=sim.events.filter(e=>e.type==='enter-room').length,laterChats=sim.events.filter(e=>e.type==='chat'&&e.time>20).length;
   const stateDiagnostics=sim.residents.map(n=>({id:n.id,state:n.state,location:n.location,x:n.x,y:n.y,goal:n._goal,path:n._path,pending:n._pending,stuck:n._stuck,yield:n._yield,progress:n._progress,wait:n._wait,homeDue:n._homeDue,journey:n._journey}));
   await window.__saveCollisionData('behavior',{states:stateDiagnostics,events:sim.events,navigation:sim.navigationStats,maxGapByActor:Object.fromEntries(maxGapByActor),stalls:[...stalls.values()],steps,entries,returns,laterChats,doorTransitions,artParity,buildingCases,sceneMasks});
   check(sawSeat&&sawWalk,'Corrected collision stopped normal city activity');check(entries&&returns&&doorTransitions,'Residents can no longer complete apartment trips through their door');check(laterChats>0,'Residents no longer form conversations after their initial placement');check(!stalls.size,'Residents stall after collision fixes: '+[...stalls.keys()]);
   check(JSON.stringify(doc)===before,'Collision/layer checking changed source map');
   window.__collisionLayerShots=shots;
   return {cases,buildingCases,sceneMasks,artParity,simulation:{steps,entries,returns,laterChats,doorTransitions,seating:sawSeat,stalls:[...stalls.values()]},sourceObjects:doc.objects.length};
  }''',{'urls':urls,'duration':args.duration,'step':args.step,'diagnostic':args.diagnostic})
  if args.screenshots:
   args.screenshots.mkdir(parents=True,exist_ok=True)
   (args.screenshots/'results.json').write_text(json.dumps(result,indent=2))
   for label,data in page.evaluate('__collisionLayerShots').items():(args.screenshots/(label+'.png')).write_bytes(base64.b64decode(data.split(',')[1]))
  assert page.evaluate('townBuilder.project')==source
  page.locator('#play').click();page.wait_for_function('!!window.townGame',timeout=120000)
  assert page.evaluate('townGame.project')==source
  page.evaluate('townGame.cam.zoom=.08');page.wait_for_timeout(2500)
  perf=page.evaluate('''()=>new Promise(resolve=>{const start=performance.now();let frames=0;function tick(now){frames++;if(now-start<1800){requestAnimationFrame(tick);return;}resolve({fps:frames*1000/(now-start)});}requestAnimationFrame(tick);})''')
  assert perf['fps']>25,perf
  assert hashlib.sha256(args.map.read_bytes()).hexdigest()==source_hash
  assert not errors,errors
  print(json.dumps({**result,'diagnostic':args.diagnostic,'overview':perf,'sourceUnchanged':True,'errors':errors}),flush=True)
  browser.close()
finally:server.shutdown()
