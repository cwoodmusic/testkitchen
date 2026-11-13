import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {blocked,height} from './model.mjs?v=town-flight-1';
import {NOTE_VALUES,reachableNoteSpots,scatterNotes} from './town-game-rules.mjs?v=town-notes-1';
import {launchFlyingNotes,advanceFlyingNote,flyingNotePose,netSweepHits,facingAngle,angleFacing,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs?v=town-fairies-1';
import {drawRhythmNet} from './rhythm-net-render.mjs?v=town-fairies-1';
import {drawNoteFairy} from './note-fairy-render.mjs?v=town-fairies-1';
import {noteSVG,noteName} from './town-game-audio.mjs?v=town-fairies-1';

const directionForKey={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
export function createYellowNoteCatch({canvas,getProject,getPlayer,getFacing=()=>'down',setFacing=()=>{},catalog,inventory,canUseNet=()=>true,isEquipped=()=>true,getLimit=()=>5}){
 let doc=null,tokens=[],flightTime=0,swingAt=-Infinity,swingProgress=0,swinging=false,swingHit=false,aim=facingAngle(getFacing()),lastCounts='',lastLayout='',visible=false;
 const collision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0,maxViews:128}),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hud=document.createElement('section');hud.className='yellow-note-inventory';hud.hidden=true;hud.setAttribute('aria-label','Yellow note inventory');
 const counts=document.createElement('div');counts.className='yellow-note-counts';counts.setAttribute('role','list');
 const cells=new Map();for(const value of NOTE_VALUES){const cell=document.createElement('span');cell.className='yellow-note-count';cell.setAttribute('role','listitem');cell.innerHTML=noteSVG(value)+'<span>0</span>';counts.append(cell);cells.set(value,cell);}
 const gear=document.createElement('small');gear.className='yellow-note-status';
 const announcement=document.createElement('span');announcement.className='note-catch-announcement';announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');
 hud.append(counts,gear,announcement);document.body.append(hud);
 function updateHUD(){
  if(canvas.id==='map'){const r=canvas.getBoundingClientRect(),layout=[r.right,r.bottom,innerWidth,innerHeight].join(':');if(layout!==lastLayout){lastLayout=layout;hud.style.right=Math.max(12,innerWidth-r.right+12)+'px';hud.style.bottom=Math.max(12,innerHeight-r.bottom+12)+'px';}}
  const equipped=isEquipped(),label=equipped?'Net equipped · F':'Tab · Equip net';if(gear.textContent!==label)gear.textContent=label;hud.dataset.equipped=String(equipped);
  const values=inventory.counts,key=NOTE_VALUES.map(value=>values[value]).join(':');if(key===lastCounts)return;lastCounts=key;
  for(const value of NOTE_VALUES){const cell=cells.get(value);cell.querySelector('span').textContent=values[value];cell.setAttribute('aria-label',noteName(value)+': '+values[value]);cell.title=noteName(value);}
 }
 function limit(){const count=Number(getLimit());return Number.isFinite(count)?Math.max(0,Math.min(5,Math.floor(count))):5;}
 // A hidden slot keeps its home instead of replacing the fairy currently being
 // chased. Blue quest fairies temporarily reserve some of the five island slots.
 function activeTokens(){return tokens.slice(0,limit()).filter(token=>!(token.respawnAt>flightTime));}
 function cancelSwing(){swinging=false;swingAt=-Infinity;swingProgress=0;swingHit=false;}
 function reset(){doc=null;tokens=[];flightTime=0;cancelSwing();collision.invalidate();hide();}
 function hide(){visible=false;hud.hidden=true;cancelSwing();}
 function sync(){
  const next=getProject(),player=getPlayer();if(!next||!player)return false;
  if(doc!==next){doc=next;collision.invalidate();tokens=launchFlyingNotes(scatterNotes(NOTE_VALUES,reachableNoteSpots(doc,catalog,player,{clearance:9})).slice(0,5)).map(token=>({...token,id:'yellow-'+token.id,color:'yellow'}));flightTime=0;cancelSwing();}
  return true;
 }
 function clearPath(a,b){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));let previous=a;
  for(let i=1;i<=steps;i++){const q={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};if(blocked(collision.view(q),q.x,q.y,catalog,previous))return false;previous=q;}return true;
 }
 function catchAlongSweep(player,angle,from,to,z=0){
  if(!doc||!player||!visible||!isEquipped())return false;
  const token=activeTokens().find(token=>!(token.retryAt>flightTime)&&netSweepHits(flyingNotePose(token,flightTime,height(doc,token.x,token.y),reduced.matches),player,angle,from,to,z)&&clearPath(player,token));
  if(!token)return false;
  if(!inventory.add(token.value)){token.retryAt=flightTime+1;announcement.textContent=inventory.error||'Your notes could not be saved. Please try again.';return false;}
  token.respawnAt=flightTime+12;token.x=token.homeX;token.y=token.homeY;token.vx=token.vy=0;announcement.textContent='Caught '+noteName(token.value).toLowerCase()+'. Saved for an NPC rhythm request.';updateHUD();return true;
 }
 function swing(){
  if(!visible||!canUseNet()||!isEquipped())return false;const now=performance.now()/1000;if(now-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return false;
  aim=facingAngle(getFacing());setFacing(angleFacing(aim));swingAt=now;swingProgress=0;swingHit=false;swinging=true;canvas.focus();return true;
 }
 function tick(keys=new Set(),dt=0){
  if(!sync()){hide();return;}visible=true;hud.hidden=false;updateHUD();dt=Math.min(.05,Math.max(0,dt));flightTime+=dt;
  const player=getPlayer();for(const token of activeTokens())advanceFlyingNote(token,player,dt,flightTime,(a,b)=>!blocked(collision.view(b),b.x,b.y,catalog,a));
  if(!canUseNet()||!isEquipped()){cancelSwing();return;}
  if(swinging){setFacing(angleFacing(aim));const progress=Math.min(1,(performance.now()/1000-swingAt)/NET_SWEEP_SECONDS),z=height(doc,player.x,player.y);if(!swingHit)swingHit=catchAlongSweep(player,aim,swingProgress,progress,z);swingProgress=progress;if(progress>=1)swinging=false;}
 }
 function keydown(event){
  if(!visible||!canUseNet()||event.ctrlKey||event.metaKey||event.altKey)return false;const key=event.key.toLowerCase(),age=performance.now()/1000-swingAt;
  if(directionForKey[key]&&age>=NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)setFacing(directionForKey[key]);
  if((key==='f'||key===' ')&&!event.repeat){if(event.target?.closest?.('button')&&key===' ')return false;event.preventDefault();swing();return true;}return false;
 }
 function pointer(event){
  if(!visible||!canUseNet()||event.ctrlKey||event.metaKey||event.altKey)return false;if(event.button!==0)return true;event.preventDefault();swing();return true;
 }
 function draw(c,cam,time,{net=true}={}){
  if(!visible||!doc)return;
  for(const token of activeTokens()){
   const point=flyingNotePose(token,flightTime,height(doc,token.x,token.y),reduced.matches);if(Math.abs(point.x-cam.x)>canvas.clientWidth/2/cam.zoom+50||Math.abs(point.y-cam.y)>canvas.clientHeight/2/cam.zoom+50)continue;
   drawNoteFairy(c,token,{time:flightTime,z:height(doc,token.x,token.y),reducedMotion:reduced.matches});
  }
  if(net&&canUseNet()&&isEquipped()){const player=getPlayer(),age=performance.now()/1000-swingAt,active=age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS;drawRhythmNet(c,player,{angle:active?aim:facingAngle(getFacing()),age:active?age:Infinity,z:height(doc,player.x,player.y),reducedMotion:reduced.matches,swinging});}
 }
 window.addEventListener('blur',cancelSwing);
 return {tick,draw,keydown,pointer,reset,hide,cancelSwing,catchAlongSweep,get swingFacing(){return this.lockedFacing;},get lockedFacing(){const age=performance.now()/1000-swingAt;return visible&&canUseNet()&&isEquipped()&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS?angleFacing(aim):null;},get netStroke(){if(!visible||!canUseNet()||!isEquipped())return null;const age=performance.now()/1000-swingAt,active=age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS;return {angle:active?aim:facingAngle(getFacing()),age:active?age:Infinity};},get state(){return {tokens:activeTokens().map(token=>({...token})),limit:limit(),equipped:isEquipped(),counts:inventory.counts,total:inventory.total,flightTime,swing:swinging?{angle:aim,progress:swingProgress,hit:swingHit}:null};}};
}
