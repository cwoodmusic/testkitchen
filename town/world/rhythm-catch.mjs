import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {launchFlyingNotes,advanceFlyingNote,flyingNotePose,netSweepHits,facingAngle,angleFacing,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs?v=town-notes-1';
import {drawRhythmNet} from './rhythm-net-render.mjs?v=town-notes-1';
import {createRhythmRoundClock} from './rhythm-round-clock.mjs?v=town-notes-1';
import {blocked,height} from './model.mjs?v=town-flight-1';
import {CATCH_PATTERNS,NOTE_VALUES,catchAttacks,remainingNotes,sameRhythm,reachableNoteSpots,scatterNotes} from './town-game-rules.mjs?v=town-notes-1';
import {createGameAudio,noteSVG,noteName,gameButton,drawCatchNote} from './town-game-audio.mjs?v=town-notes-1';
export function createRhythmCatch({canvas,getProject,getPlayer,getFacing=()=>'down',setFacing=()=>{},catalog,journal,onExtraSweep=()=>false,audio=createGameAudio()}){
 const clock=createRhythmRoundClock({duration:300}),dialog=document.createElement('dialog'),hud=document.createElement('section');dialog.className='town-game-dialog rhythm-catch-dialog';dialog.setAttribute('aria-label','Rhythm Catch');hud.className='town-game-hud blue-rhythm-hud';hud.hidden=true;document.body.append(dialog,hud);
 let phase='idle',doc=null,round=0,target=[],tokens=[],bag=[],order=[],host=null,start=0,huntAt=0,aim=0,swingAt=-10,mistakes=0,message='',paused=false,lastCam=null,busy=false,serial=0,returningToBuild=false,flightTime=0,lastTick=null,swingProgress=0,swingHit=false,swinging=false;
 const collision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0,maxViews:128}),motionQuery=matchMedia('(prefers-reduced-motion: reduce)'),now=()=>performance.now()/1000;
 const active=()=>phase!=='idle';
 function closeModal(){if(dialog.open)dialog.close();}
 function showModal(){if(!dialog.open)dialog.showModal();}
 function end(){serial++;busy=false;audio.stop();clock.reset();phase='idle';paused=false;swinging=false;lastTick=null;tokens=[];bag=[];order=[];hud.hidden=true;closeModal();canvas.focus();}
 function title(text,description){dialog.replaceChildren();const k=document.createElement('div');k.className='town-game-eyebrow';k.textContent='CODA TOWN · BLUE NOTE CHALLENGE';const h=document.createElement('h1');h.textContent=text;dialog.append(k,h);if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}return dialog;}
 function buttons(...items){const row=document.createElement('div');row.className='town-game-actions';row.append(...items);dialog.append(row);}
 function addTimer(parent){const timer=document.createElement('div');timer.className='rhythm-round-timer';timer.setAttribute('role','timer');timer.setAttribute('aria-label','Time remaining');parent.append(timer);paintTimers();}
 function paintTimers(){const seconds=Math.ceil(clock.remainingSeconds),text=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;for(const element of [...hud.querySelectorAll('[role="timer"]'),...dialog.querySelectorAll('[role="timer"]')]){if(element.textContent!==text)element.textContent=text;element.dataset.urgent=String(seconds<=30);}}
 function timeUp(){serial++;busy=false;audio.stop();clock.stop(now());phase='lost';paused=false;swinging=false;lastTick=null;tokens=[];hud.hidden=true;title('Time’s up!','The five minutes include catching all four blue cards and rebuilding the rhythm at the vendor. Give it another listen and try again. Your yellow-note inventory is safe.');addTimer(dialog);buttons(gameButton('Try again',startRound,'primary'),gameButton('Back to town',end));showModal();}
 function updateClock(){if(['idle','won','lost','unavailable'].includes(phase))return false;clock.update(now());if(clock.expired){timeUp();return false;}paintTimers();return true;}
 function fail(text){title('A little more room?',text);buttons(gameButton('Back to town',end));showModal();}
 async function demo(replay=false){
  if(!updateClock()||busy)return;if(phase!=='listen')returningToBuild=phase==='arrange';
  const ticket=serial;busy=true;const ok=await audio.unlock();if(ticket!==serial)return;busy=false;if(!active()||!updateClock())return;
  if(!ok){phase='sound';title('Let’s hear the rhythm','Sound is needed for this challenge. Select Enable sound to try again.');if(clock.started)addTimer(dialog);buttons(gameButton('Enable sound',()=>demo(replay),'primary'),gameButton('Leave game',end));showModal();return;}
  audio.stop();paused=false;phase='listen';start=audio.time+.15;huntAt=start+12*.625;hud.hidden=true;
  title('Four blue cards. Five minutes.','Listen to the rhythm by ear. After the count-in and example, find the four blue cards around town and return here to put them in the order you heard. Yellow cards belong to your saved inventory.');addTimer(dialog);const count=document.createElement('div');count.className='town-game-count';count.id='rhythmCatchCount';count.setAttribute('aria-live','polite');dialog.append(count);buttons(gameButton('Leave game',end));showModal();
  for(let i=0;i<4;i++)audio.tone(start+i*.625,.1,i===3?960:460,.22);
  for(let loop=0;loop<2;loop++){let beat=0;for(const value of target){const attacks=catchAttacks(value);for(const offset of attacks)audio.tone(start+(4+loop*4+beat+offset)*.625,.625/Math.max(1,attacks.length)*.65,660,.27);beat++;}}
 }
 function startRound(){
  serial++;busy=false;audio.stop();clock.reset();paused=false;swinging=false;swingAt=-10;returningToBuild=false;
  target=[...CATCH_PATTERNS[(journal.data.netWins+round)%CATCH_PATTERNS.length]];bag=[];order=[];mistakes=0;
  const player=getPlayer();if(!player){end();return;}
  collision.invalidate();tokens=launchFlyingNotes(scatterNotes(target,reachableNoteSpots(doc,catalog,player,{clearance:9})).slice(0,target.length)).map(t=>({...t,color:'blue'}));flightTime=0;lastTick=null;
  if(tokens.length!==target.length){phase='unavailable';fail('This cart needs a larger connected patch of walkable town for four blue cards. Try a cart with more open paths nearby.');return;}
  phase='ready';void demo();
 }
 function startGame(actor){end();host={...actor,interaction:actor.interaction?{...actor.interaction}:null};doc=getProject();round=0;phase='ready';startRound();}
 function hunt(){if(!clock.started)clock.start(now());if(!updateClock())return;phase='hunt';lastTick=null;swinging=false;closeModal();canvas.focus();message='Find the four BLUE cards, sweep with F, then return to the vendor to build the rhythm before time runs out.';updateHUD();hud.hidden=false;}
 function updateHUD(){
  hud.replaceChildren();const label=document.createElement('strong');label.textContent=`BLUE NOTE CHALLENGE · ROUND ${round+1} / 3`;addTimer(hud);const progress=document.createElement('span');progress.textContent=`${bag.length} / 4 blue cards caught · ${tokens.length} to find`;
  const info=document.createElement('p');info.className='town-game-status';info.setAttribute('role','status');info.textContent=message;hud.append(label,progress,info);
  const row=document.createElement('div');row.className='town-game-actions';row.append(gameButton('Swing net · F',()=>swing(),'primary'),gameButton('Build at vendor · E',()=>interact()),gameButton('Hear rhythm · R',()=>demo(true)),gameButton('Leave',end));hud.append(row);
 }
 function assemble(){if(!updateClock())return;phase='arrange';hud.hidden=true;audio.stop();title('Build the rhythm by ear','Put your four blue cards in the order you heard them. Each card fills one beat. The clock keeps running while you build or listen again.');addTimer(dialog);
  const slots=document.createElement('div');slots.className='rhythm-slots';slots.setAttribute('aria-label','Your rhythm');for(let i=0;i<target.length;i++){const box=document.createElement('span');box.className='rhythm-slot';box.innerHTML=order[i]===undefined?'<span>?</span>':noteSVG(order[i]);slots.append(box);}dialog.append(slots);
  const tray=document.createElement('div');tray.className='rhythm-note-tray';const available=remainingNotes(bag,order);for(const value of NOTE_VALUES){const count=available.filter(n=>n===value).length;if(!count)continue;const b=gameButton('',()=>{if(!updateClock())return;if(order.length<target.length)order.push(value);assemble();});b.innerHTML=noteSVG(value)+`<span>${noteName(value)} × ${count}</span>`;b.setAttribute('aria-label',`Add ${noteName(value)}`);tray.append(b);}dialog.append(tray);
  const info=document.createElement('p');info.setAttribute('role','status');info.textContent=message;dialog.append(info);
  buttons(gameButton('Check my rhythm',check,'primary'),gameButton('Catch more notes',()=>{if(!updateClock())return;message='Find the remaining blue cards, then return to the vendor.';hunt();}),gameButton('Undo',()=>{if(!updateClock())return;order.pop();assemble();}),gameButton('Hear it again',()=>{void demo(true);}),gameButton('Leave',end));showModal();
 }
 function check(){
  if(phase!=='arrange'||!updateClock())return;
  if(order.length!==target.length){message='Choose four blue cards to fill four beats. Find the missing blue cards if you need more.';assemble();return;}
  if(!sameRhythm(order,target)){mistakes++;message='Almost! Listen again, then try a different order.';assemble();return;}
  clock.stop(now());saveWin(Math.max(1,3-Math.min(2,mistakes)));
 }
 function saveWin(stars){
  if(!['arrange','reward'].includes(phase))return;const data=journal.data,before={stars:data.stars,netWins:data.netWins};let saved=false;
  data.stars+=stars;data.netWins++;try{saved=journal.save()!==false;}catch{}
  if(!saved){data.stars=before.stars;data.netWins=before.netWins;phase='reward';title('Rhythm complete · save pending',journal.warning||'You got the rhythm right, but your progress could not be saved. Your remaining time is held while you retry.');addTimer(dialog);const ticket=serial;buttons(gameButton('Try saving again',()=>{if(ticket===serial)saveWin(stars);},'primary'),gameButton('Back to town',end));showModal();return;}
  phase='won';audio.tone(audio.time,.2,660);audio.tone(audio.time+.15,.3,990);
  title(round===2?'Town rhythm ranger!':'You caught the rhythm!',`+${stars} town stars · ${journal.data.stars} total. Your progress is saved.`);addTimer(dialog);
  const notes=document.createElement('div');notes.className='rhythm-slots';for(const value of target){const e=document.createElement('span');e.className='rhythm-slot';e.innerHTML=noteSVG(value);notes.append(e);}dialog.append(notes);
  buttons(gameButton(round===2?'Play another hunt':'Next rhythm',()=>{round=round===2?0:round+1;startRound();},'primary'),gameButton('Back to town',end));
 }

 function swing(pointer=false){
  if(phase!=='hunt'||paused||!updateClock())return;const time=now();if(time-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return;
  if(!pointer)aim=facingAngle(getFacing());setFacing(angleFacing(aim));swingAt=time;swingProgress=0;swingHit=false;swinging=true;
 }
 function updateSwing(time){
  if(!swinging)return;const p=getPlayer(),progress=Math.min(1,(time-swingAt)/NET_SWEEP_SECONDS),z=height(doc,p.x,p.y);
  if(!swingHit){const hit=tokens.find(t=>{
   const point=flyingNotePose(t,flightTime,height(doc,t.x,t.y),motionQuery.matches);if(!netSweepHits(point,p,aim,swingProgress,progress,z))return false;
   const steps=Math.max(1,Math.ceil(Math.hypot(t.x-p.x,t.y-p.y)/4));let previous=p;
   for(let i=1;i<=steps;i++){const q={x:p.x+(t.x-p.x)*i/steps,y:p.y+(t.y-p.y)*i/steps};if(blocked(collision.view(q),q.x,q.y,catalog,previous))return false;previous=q;}return true;
  });
  if(hit){swingHit=true;bag.push(hit.value);tokens=tokens.filter(t=>t!==hit);message=tokens.length?`Caught a blue ${noteName(hit.value)}. ${tokens.length} blue cards left to find.`:'All four blue cards caught! Return to the vendor and build the rhythm before time runs out.';audio.tone(audio.time,.13,880,.17);updateHUD();}
  else if(onExtraSweep(p,aim,swingProgress,progress,z))swingHit=true;
  }
  swingProgress=progress;if(progress===1)swinging=false;
 }
 function nearVendor(){const p=getPlayer(),at=host?.interaction||host;return !!(p&&at&&Math.hypot(p.x-at.x,p.y-at.y)<160);}
 function interact(){if(phase!=='hunt')return true;if(!updateClock())return true;if(!nearVendor()){message='Bring the blue cards back to the vendor before building the rhythm.';updateHUD();return true;}order=[];message='Build what you heard, or head out to find the remaining blue cards.';assemble();return true;}
 function pointer(e){if(phase!=='hunt'||!lastCam)return false;if(e.button!==0)return true;if(paused||now()-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS){e.preventDefault();return true;}const r=canvas.getBoundingClientRect(),p=getPlayer(),z=height(doc,p.x,p.y),point={x:lastCam.x+(e.clientX-r.left-r.width/2)/lastCam.zoom,y:lastCam.y+(e.clientY-r.top-r.height/2)/lastCam.zoom};aim=Math.atan2(point.y-(p.y-z-53),point.x-p.x);setFacing(angleFacing(aim));e.preventDefault();swing(true);canvas.focus();return true;}
 function keydown(e){if(!active())return false;const key=e.key.toLowerCase();if(e.target?.closest?.('button')&&(key===' '||key==='enter'))return true;if(key==='escape'){e.preventDefault();end();return true;}if(paused||phase!=='hunt')return true;const facing={w:'up',arrowup:'up',s:'down',arrowdown:'down',a:'left',arrowleft:'left',d:'right',arrowright:'right'}[key];if(facing&&now()-swingAt>=NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)setFacing(facing);if((key==='f'||key===' ')&&!e.repeat){e.preventDefault();swing();return true;}if(key==='r'&&!e.repeat){e.preventDefault();void demo(true);return true;}if(key==='e'&&!e.repeat){e.preventDefault();interact();return true;}return false;}
 function pause(){if(!['ready','sound','listen','hunt','arrange'].includes(phase))return;serial++;busy=false;if(paused){audio.suspend();return;}if(!updateClock())return;clock.pause(now());paused=true;lastTick=null;swinging=false;audio.suspend();title('Challenge paused','Your blue cards, remaining time and yellow-note inventory are safe.');addTimer(dialog);buttons(gameButton('Continue',async()=>{const ticket=serial;await audio.resume();if(ticket!==serial)return;paused=false;clock.resume(now());if(['ready','sound','listen'].includes(phase))void demo(true);else if(phase==='hunt'){closeModal();canvas.focus();}else assemble();},'primary'),gameButton('Leave',end));showModal();}
 function tick(){if(!active())return;if(getProject()!==doc){end();return;}if(paused){lastTick=null;return;}if(!updateClock())return;const time=now(),dt=lastTick===null?0:Math.min(.05,time-lastTick);lastTick=phase==='hunt'?time:null;if(phase==='hunt'){const p=getPlayer();flightTime+=dt;for(const t of tokens)advanceFlyingNote(t,p,dt,flightTime,(a,b)=>!blocked(collision.view(b),b.x,b.y,catalog,a));updateSwing(time);}if(phase==='listen'){
  const elapsed=audio.time-start,count=Math.floor(elapsed/.625),node=dialog.querySelector('#rhythmCatchCount');if(node){const text=count<0?'Get ready':count<4?['1','2','READY','GO!'][count]:'LISTEN';if(node.textContent!==text)node.textContent=text;}
  if(audio.time>=huntAt){if(returningToBuild){returningToBuild=false;assemble();}else hunt();}
 }}
 function draw(c,cam,time){if(phase!=='hunt')return;lastCam={...cam};const p=getPlayer();if(!p)return;
  for(const t of tokens){const point=flyingNotePose(t,flightTime,height(doc,t.x,t.y),motionQuery.matches),y=point.y;if(Math.abs(t.x-cam.x)>canvas.clientWidth/2/cam.zoom+60||Math.abs(y-cam.y)>canvas.clientHeight/2/cam.zoom+60)continue;
   c.save();c.translate(t.x,y);c.fillStyle='#bce9ff99';const flap=motionQuery.matches?5:5+Math.abs(Math.sin(flightTime*23+t.phase))*12;for(const side of [-1,1]){c.beginPath();c.ellipse(side*42,-10,flap,8,side*.5,0,Math.PI*2);c.fill();}
   c.fillStyle='#164fa8';c.strokeStyle='#8fe0ff';c.lineWidth=3;c.beginPath();c.arc(0,0,39,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#f5fdff';c.strokeStyle='#f5fdff';drawCatchNote(c,t.value,0,4,.85);c.restore();
  }
  const age=now()-swingAt,recovering=age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS;
  drawRhythmNet(c,p,{angle:recovering?aim:facingAngle(getFacing()),age:recovering?age:Infinity,z:height(doc,p.x,p.y),reducedMotion:motionQuery.matches,swinging});
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();end();});
 return {start:startGame,end,tick,draw,pointer,keydown,pause,interact,get active(){return active();},get fullscreen(){return dialog.open;},get blocked(){return active()&&(paused||phase!=='hunt');},get swingFacing(){const age=now()-swingAt;return phase==='hunt'&&age>=0&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS?angleFacing(aim):null;},get state(){return {phase,round,target:[...target],host:host?{x:host.x,y:host.y,interaction:host.interaction}:null,tokens:tokens.map(t=>({...t})),bag:[...bag],order:[...order],paused,mistakes,flightTime,remainingSeconds:clock.remainingSeconds,timeLimit:clock.timeLimit,timerStarted:clock.started,swing:swinging?{angle:aim,progress:swingProgress,hit:swingHit}:null};}};
}
