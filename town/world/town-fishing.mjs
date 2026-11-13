import {createIslandNavigation} from './island-sailing.mjs?v=town-flight-1';
import {loadCaveFishing} from './cave-fishing-loader.mjs?v=town-flight-1';
import {createFishingJournalBridge} from './fishing-journal-bridge.mjs?v=town-flight-1';
import {gameButton} from './town-game-audio.mjs?v=town-store-halls-1';
export function createTownFishing({canvas,journal,getProject,getPlayer,getOwner,catalog}){
 const hud=document.createElement('section');hud.className='town-game-hud island-sailing-hud';hud.hidden=true;document.body.append(hud);
 let phase='idle',doc=null,dock=null,ashore=null,boat=null,navigation=null,school=[],clock=0,room=null,host=null,bridge=null,lastCam=null,destination=null,serial=0,paused=false,moving=false,engine=null,owner=null;const held=new Set();let loading=null,loadingSerial=-1;
 const active=()=>phase!=='idle';
 function announce(text){const p=hud.querySelector('[role="status"]');if(p)p.textContent=text;}
 function end(){serial++;phase='idle';paused=false;held.clear();destination=null;room?.destroy();room=null;bridge?.destroy();bridge=null;if(host?.open)host.close();host?.remove();host=null;hud.hidden=true;if(ashore&&getPlayer())Object.assign(getPlayer(),doc===getProject()?ashore:getProject().spawn);ashore=null;boat=null;navigation=null;school=[];canvas.focus();}
 async function prepare(){
  if(room&&owner===getOwner())return room;if(loading&&loadingSerial===serial)return loading;const ticket=serial;loadingSerial=ticket;
  loading=(async()=>{engine=await loadCaveFishing();if(ticket!==serial)return null;room?.destroy();bridge?.destroy();host?.remove();owner=getOwner();bridge=createFishingJournalBridge({getOwner,legacy:journal});await bridge.ready();if(ticket!==serial)return null;
   host=document.createElement('dialog');host.className='island-fishing-challenge';host.setAttribute('aria-label','Island rhythm fishing');document.body.append(host);
   room=window.createCodaRhythmFishing({host,outdoor:true,storage:bridge.storage,backgroundSrc:new URL('../../assets/world/rhythm-fishing-cave.png',import.meta.url).href,getQuality:()=> 'lite',onCatch:(fish,result)=>bridge.reward(fish,result),onClose(){if(host.open)host.close();if(phase!=='idle'){phase='sail';hud.hidden=false;announce('Sail to another fish shadow, or return to the pier.');canvas.focus();}}});return room;
  })().finally(()=>{if(loadingSerial===ticket)loading=null;});return loading;
 }
 function controls(){hud.replaceChildren();const title=document.createElement('strong');title.textContent='ISLAND FISHING';const p=document.createElement('p');p.setAttribute('role','status');p.textContent='WASD / arrows to sail · Shift for speed · E to cast or dock · J fish journal';hud.append(title,p);const actions=document.createElement('div');actions.className='town-game-actions';actions.append(gameButton('Cast · E',cast,'primary'),gameButton('Fish journal · J',collection),gameButton('Return to pier',end));hud.append(actions);
  const pad=document.createElement('div');pad.className='island-boat-pad';for(const [label,key]of [['↑','w'],['←','a'],['↓','s'],['→','d']]){const b=gameButton(label,()=>{});b.setAttribute('aria-label','Sail '+key);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(key);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>held.delete(key);pad.append(b);}hud.append(pad);
 }
 function fillSchool(){
  const points=[...navigation.points].sort((a,b)=>Math.hypot(a.x-boat.x,a.y-boat.y)-Math.hypot(b.x-boat.x,b.y-boat.y));school=[];
  const place=(p,fish)=>school.push({id:'coast-shadow-'+school.length,x:p.x,y:p.y,homeX:p.x,homeY:p.y,fishId:fish.id,phase:Math.random()*Math.PI*2});
  const first=points.find(p=>Math.hypot(p.x-boat.x,p.y-boat.y)>175);if(first)place(first,engine.COASTAL_FISH[0]);
  const shuffled=points.map(p=>({p,rank:Math.random()})).sort((a,b)=>a.rank-b.rank);for(const {p}of shuffled){if(school.length>=72)break;if(school.some(f=>Math.hypot(f.x-p.x,f.y-p.y)<330))continue;const distance=Math.hypot(p.x-dock.stand.x,p.y-dock.stand.y),maxRank=distance<1700?1:distance<4000?2:4,fish=engine.COASTAL_FISH.filter(f=>f.rarityRank<=maxRank);place(p,fish[Math.floor(Math.random()*fish.length)]);}
 }
 async function start(at){
  end();const ticket=serial;phase='loading';dock=at;doc=getProject();ashore={...getPlayer()};controls();hud.hidden=false;announce('Preparing your boat and fish journal…');
  try{const ready=await prepare();if(ticket!==serial||!ready)return;navigation=createIslandNavigation(doc,catalog,dock);if(!navigation||navigation.points.length<6)throw Error('This pier needs a clear connection to the island’s water.');boat={...navigation.spawn,facing:'down'};Object.assign(getPlayer(),{x:boat.x,y:boat.y});fillSchool();clock=0;phase='sail';announce('Sail around the island. Find shadows near the shore and out at sea.');canvas.focus();}catch(error){if(ticket!==serial)return;phase='sail-error';announce(error.message||'Fishing could not start. Please try again.');}
 }
 function nearDock(){return boat&&dock&&Math.hypot(boat.x-dock.stand.x,boat.y-dock.stand.y)<190;}
 function nearest(){return boat?[...school].sort((a,b)=>Math.hypot(a.x-boat.x,a.y-boat.y)-Math.hypot(b.x-boat.x,b.y-boat.y))[0]:null;}
 function cast(){if(phase!=='sail')return;const shadow=nearest();if(!shadow||Math.hypot(shadow.x-boat.x,shadow.y-boat.y)>240){announce('Sail closer to a fish shadow, then cast.');return;}held.clear();destination=null;phase='challenge';hud.hidden=true;room.openChallenge(shadow.fishId);host.showModal();school=school.filter(f=>f!==shadow);}
 function collection(){if(!room||phase==='loading')return;held.clear();destination=null;phase='journal';hud.hidden=true;room.openCollection();host.showModal();}
 function interact(){if(phase==='sail'){if(nearDock())end();else cast();}return true;}
 function keydown(e){if(!active())return false;if(phase==='challenge'||phase==='journal')return true;const key=e.key.toLowerCase();if(key==='escape'){e.preventDefault();end();return true;}if(key==='e'&&!e.repeat){e.preventDefault();interact();return true;}if(key==='j'&&!e.repeat){e.preventDefault();collection();return true;}return false;}
 function pointer(e){if(phase!=='sail'||!lastCam)return false;if(e.button!==0)return true;const r=canvas.getBoundingClientRect();destination={x:lastCam.x+(e.clientX-r.left-r.width/2)/lastCam.zoom,y:lastCam.y+(e.clientY-r.top-r.height/2)/lastCam.zoom};if(!navigation.clear(destination))destination=null;e.preventDefault();canvas.focus();return true;}
 function tick(keys=new Set(),dt=0){if(!active())return;if(getProject()!==doc||getOwner()!==owner&&room){end();return;}if(phase!=='sail'||paused||!boat)return;clock+=dt;
  const has=k=>keys.has(k)||held.has(k);let dx=(has('d')||has('arrowright')?1:0)-(has('a')||has('arrowleft')?1:0),dy=(has('s')||has('arrowdown')?1:0)-(has('w')||has('arrowup')?1:0);
  if(dx||dy)destination=null;else if(destination){dx=destination.x-boat.x;dy=destination.y-boat.y;if(Math.hypot(dx,dy)<18){destination=null;dx=dy=0;}}
  moving=navigation.move(boat,dx,dy,dt,has('shift')?850:580)>0;Object.assign(getPlayer(),{x:boat.x,y:boat.y});
  for(const f of school){const next={x:f.homeX+Math.sin(clock*.7+f.phase)*32,y:f.homeY+Math.sin(clock*.53+f.phase*2)*24};if(navigation.clear(next)){f.x=next.x;f.y=next.y;}}
 }
 function draw(c,cam,w,h,time){if(!active()||!boat)return;lastCam={...cam};const left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom,pad=120;
  for(const f of school){if(f.x<left-pad||f.x>left+w/cam.zoom+pad||f.y<top-pad||f.y>top+h/cam.zoom+pad)continue;c.save();c.translate(f.x,f.y);c.rotate(Math.sin(clock*.6+f.phase)*.25);c.fillStyle='#072c4699';c.beginPath();c.ellipse(0,0,29,12,0,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(-22,0);c.lineTo(-40,-13);c.lineTo(-40,13);c.closePath();c.fill();c.restore();}
  c.save();c.translate(boat.x,boat.y+12);c.rotate(({down:0,left:Math.PI/2,up:Math.PI,right:-Math.PI/2})[boat.facing]||0);c.fillStyle='#0b253760';c.beginPath();c.ellipse(0,15,68,25,0,0,Math.PI*2);c.fill();c.fillStyle='#956537';c.beginPath();c.moveTo(-45,-18);c.quadraticCurveTo(-58,35,0,51);c.quadraticCurveTo(58,35,45,-18);c.closePath();c.fill();c.strokeStyle='#dfb67a';c.lineWidth=5;c.stroke();c.fillStyle='#b88d59';c.fillRect(-39,6,78,11);c.strokeStyle='#d7b580';c.lineWidth=6;for(const side of [-1,1]){c.beginPath();c.moveTo(side*31,8);c.lineTo(side*84,12+(moving?Math.sin(time*7)*18:0));c.stroke();}c.restore();
 }
 window.addEventListener('blur',()=>{held.clear();destination=null;paused=true;});window.addEventListener('focus',()=>{paused=false;});document.addEventListener('visibilitychange',()=>{paused=document.hidden;held.clear();destination=null;});
 return {start,end,tick,draw,pointer,keydown,interact,pause(){held.clear();destination=null;},get active(){return active();},get fullscreen(){return !!host?.open;},get blocked(){return active();},get sailing(){return active()&&!!boat;},get facing(){return boat?.facing||'down';},get state(){const current=room?.getState();return {phase,paused,boat:boat?{...boat}:null,school:school.map(f=>({...f})),waterCells:navigation?.points.length||0,challenge:current?.challenge||null,cave:current||null,journal:current?.collection||null};}};
}
