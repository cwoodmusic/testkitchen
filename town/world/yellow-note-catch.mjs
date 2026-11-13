import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {blocked,height} from './model.mjs?v=town-flight-1';
import {NOTE_VALUES,reachableNoteSpots,scatterNotes} from './town-game-rules.mjs?v=town-notes-1';
import {launchFlyingNotes,advanceFlyingNote,flyingNotePose,netSweepHits,facingAngle,angleFacing,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs?v=town-notes-1';
import {drawRhythmNet} from './rhythm-net-render.mjs?v=town-notes-1';
import {noteSVG,noteName,drawCatchNote,gameButton} from './town-game-audio.mjs?v=town-notes-1';

const directionForKey={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'};
export function createYellowNoteCatch({canvas,getProject,getPlayer,getFacing=()=>'down',setFacing=()=>{},catalog,inventory,canUseNet=()=>true}){
 let doc=null,tokens=[],flightTime=0,lastCam=null,swingAt=-Infinity,swingProgress=0,swinging=false,swingHit=false,aim=facingAngle(getFacing()),lastCounts='',lastLayout='',visible=false;
 const collision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0,maxViews:128}),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hud=document.createElement('section');hud.className='yellow-note-inventory';hud.hidden=true;hud.setAttribute('aria-label','Yellow note inventory');
 const title=document.createElement('strong');title.textContent='YELLOW NOTE INVENTORY';const counts=document.createElement('div');counts.className='yellow-note-counts';counts.setAttribute('role','list');
 const cells=new Map();for(const value of NOTE_VALUES){const cell=document.createElement('span');cell.className='yellow-note-count';cell.setAttribute('role','listitem');cell.innerHTML=noteSVG(value)+'<span>0</span>';counts.append(cell);cells.set(value,cell);}
 const status=document.createElement('p');status.className='yellow-note-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='F to swing · Save yellow notes for your neighbours’ rhythm requests.';
 const button=gameButton('Swing net · F',()=>swing());hud.append(title,counts,status,button);document.body.append(hud);
 function updateHUD(){
  if(canvas.id==='map'){const r=canvas.getBoundingClientRect(),layout=[r.right,r.bottom,innerWidth,innerHeight].join(':');if(layout!==lastLayout){lastLayout=layout;hud.style.right=Math.max(12,innerWidth-r.right+12)+'px';hud.style.bottom=Math.max(12,innerHeight-r.bottom+12)+'px';}}
  const values=inventory.counts,key=NOTE_VALUES.map(value=>values[value]).join(':');if(key===lastCounts)return;lastCounts=key;
  for(const value of NOTE_VALUES){const cell=cells.get(value);cell.querySelector('span').textContent=values[value];cell.setAttribute('aria-label',noteName(value)+': '+values[value]);cell.title=noteName(value);}
 }
 function reset(){doc=null;tokens=[];flightTime=0;swinging=false;swingAt=-Infinity;swingProgress=0;lastCam=null;collision.invalidate();hide();}
 function hide(){visible=false;hud.hidden=true;swinging=false;}
 function sync(){
  const next=getProject(),player=getPlayer();if(!next||!player)return false;
  if(doc!==next){doc=next;collision.invalidate();tokens=launchFlyingNotes(scatterNotes(NOTE_VALUES,reachableNoteSpots(doc,catalog,player))).map(token=>({...token,id:'yellow-'+token.id,color:'yellow'}));flightTime=0;swinging=false;swingAt=-Infinity;}
  return true;
 }
 function clearPath(a,b){
  const steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));let previous=a;
  for(let i=1;i<=steps;i++){const q={x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps};if(blocked(collision.view(q),q.x,q.y,catalog,previous))return false;previous=q;}return true;
 }
 function catchAlongSweep(player,angle,from,to,z=0){
  if(!doc||!player)return false;
  const token=tokens.find(token=>!(token.respawnAt>flightTime)&&!(token.retryAt>flightTime)&&netSweepHits(flyingNotePose(token,flightTime,height(doc,token.x,token.y),reduced.matches),player,angle,from,to,z)&&clearPath(player,token));
  if(!token)return false;
  if(!inventory.add(token.value)){token.retryAt=flightTime+1;status.textContent=inventory.error||'Your notes could not be saved. Please try again.';return false;}
  token.respawnAt=flightTime+12;token.x=token.homeX;token.y=token.homeY;token.vx=token.vy=0;status.textContent='Caught '+noteName(token.value).toLowerCase()+'. Saved for an NPC rhythm request.';updateHUD();return true;
 }
 function swing(angle=facingAngle(getFacing())){
  if(!visible||!canUseNet())return false;const now=performance.now()/1000;if(now-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return false;
  aim=angle;setFacing(angleFacing(aim));swingAt=now;swingProgress=0;swingHit=false;swinging=true;canvas.focus();return true;
 }
 function tick(keys=new Set(),dt=0){
  if(!sync()){hide();return;}visible=true;hud.hidden=false;button.hidden=!canUseNet();updateHUD();dt=Math.min(.05,Math.max(0,dt));flightTime+=dt;
  const player=getPlayer();for(const token of tokens){if(token.respawnAt>flightTime)continue;advanceFlyingNote(token,player,dt,flightTime,(a,b)=>!blocked(collision.view(b),b.x,b.y,catalog,a));}
  if(!canUseNet()){swinging=false;return;}
  if(swinging){setFacing(angleFacing(aim));const progress=Math.min(1,(performance.now()/1000-swingAt)/NET_SWEEP_SECONDS),z=height(doc,player.x,player.y);if(!swingHit)swingHit=catchAlongSweep(player,aim,swingProgress,progress,z);swingProgress=progress;if(progress>=1)swinging=false;}
 }
 function keydown(event){
  if(!visible||!canUseNet())return false;const key=event.key.toLowerCase();
  if(directionForKey[key]&&!swinging)setFacing(directionForKey[key]);
  if((key==='f'||key===' ')&&!event.repeat){if(event.target?.closest?.('button')&&key===' ')return false;event.preventDefault();swing();return true;}return false;
 }
 function pointer(event){
  if(!visible||!canUseNet()||!lastCam)return false;if(event.button!==0)return true;event.preventDefault();const player=getPlayer(),rect=canvas.getBoundingClientRect(),point={x:lastCam.x+(event.clientX-rect.left-rect.width/2)/lastCam.zoom,y:lastCam.y+(event.clientY-rect.top-rect.height/2)/lastCam.zoom},z=height(doc,player.x,player.y);
  swing(Math.atan2(point.y-(player.y-z-30),point.x-player.x));return true;
 }
 function draw(c,cam,time,{net=true}={}){
  if(!visible||!doc)return;lastCam={...cam};
  for(const token of tokens){if(token.respawnAt>flightTime)continue;const point=flyingNotePose(token,flightTime,height(doc,token.x,token.y),reduced.matches);if(Math.abs(point.x-cam.x)>canvas.clientWidth/2/cam.zoom+65||Math.abs(point.y-cam.y)>canvas.clientHeight/2/cam.zoom+65)continue;
   c.save();c.translate(point.x,point.y);const flap=reduced.matches?7:5+Math.abs(Math.sin(flightTime*23+token.phase))*11;c.fillStyle='#ffdf8588';for(const side of [-1,1]){c.beginPath();c.ellipse(side*41,-9,flap,8,side*.5,0,Math.PI*2);c.fill();}
   c.fillStyle='#ddb538';c.strokeStyle='#fff1a5';c.lineWidth=3;c.beginPath();c.arc(0,0,38,0,Math.PI*2);c.fill();c.stroke();c.fillStyle=c.strokeStyle='#392c08';drawCatchNote(c,token.value,0,3,.85);c.restore();
  }
  if(net&&canUseNet()){const player=getPlayer(),age=performance.now()/1000-swingAt,active=age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS;drawRhythmNet(c,player,{angle:active?aim:facingAngle(getFacing()),age:active?age:Infinity,z:height(doc,player.x,player.y),reducedMotion:reduced.matches,swinging});}
 }
 window.addEventListener('blur',()=>{swinging=false;});
 return {tick,draw,keydown,pointer,reset,hide,catchAlongSweep,get swingFacing(){return this.lockedFacing;},get lockedFacing(){const age=performance.now()/1000-swingAt;return visible&&canUseNet()&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS?angleFacing(aim):null;},get state(){return {tokens:tokens.filter(token=>!(token.respawnAt>flightTime)).map(token=>({...token})),counts:inventory.counts,total:inventory.total,flightTime,swing:swinging?{angle:aim,progress:swingProgress,hit:swingHit}:null};}};
}
