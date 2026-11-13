import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {launchFlyingNotes,advanceFlyingNote,flyingNotePose,netSweepPose,netSweepHits,facingAngle,angleFacing,NET_SWEEP_SECONDS,NET_RECOVERY_SECONDS} from './rhythm-hunt-motion.mjs?v=town-flight-1';
import {blocked,height} from './model.mjs?v=town-flight-1';
import {CATCH_PATTERNS,NOTE_VALUES,catchAttacks,remainingNotes,sameRhythm,reachableNoteSpots,scatterNotes} from './town-game-rules.mjs?v=town-flight-1';
import {createGameAudio,noteSVG,noteName,gameButton,drawCatchNote} from './town-game-audio.mjs?v=town-flight-1';
export function createRhythmCatch({canvas,getProject,getPlayer,getFacing=()=>'down',setFacing=()=>{},catalog,journal}){
 const audio=createGameAudio(),dialog=document.createElement('dialog'),hud=document.createElement('section');dialog.className='town-game-dialog rhythm-catch-dialog';dialog.setAttribute('aria-label','Rhythm Catch');hud.className='town-game-hud';hud.hidden=true;document.body.append(dialog,hud);
 let phase='idle',doc=null,round=0,target=[],tokens=[],bag=[],order=[],host=null,start=0,huntAt=0,aim=0,swingAt=-10,mistakes=0,message='',paused=false,lastCam=null,noticeUntil=0,busy=false,serial=0,returningToBuild=false,flightTime=0,lastTick=null,swingProgress=0,swingHit=false,swinging=false;
 const collision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>0,maxViews:128}),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
 const active=()=>phase!=='idle';
 function closeModal(){if(dialog.open)dialog.close();}
 function showModal(){if(!dialog.open)dialog.showModal();}
 function end(){serial++;busy=false;audio.stop();phase='idle';paused=false;swinging=false;lastTick=null;tokens=[];bag=[];order=[];hud.hidden=true;closeModal();canvas.focus();}
 function title(text,description){dialog.replaceChildren();const k=document.createElement('div');k.className='town-game-eyebrow';k.textContent='CODA TOWN · RHYTHM CATCH';const h=document.createElement('h1');h.textContent=text;dialog.append(k,h);if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}return dialog;}
 function buttons(...items){const row=document.createElement('div');row.className='town-game-actions';row.append(...items);dialog.append(row);}
 function fail(text){title('A little more room?',text);buttons(gameButton('Back to town',end));showModal();}
 async function demo(replay=false){
  if(phase!=='listen')returningToBuild=phase==='arrange';
  if(busy)return;const ticket=serial;busy=true;const ok=await audio.unlock();if(ticket!==serial)return;busy=false;if(!active())return;
  if(!ok){phase='sound';title('Let’s hear the rhythm','Sound is needed for this challenge. Select Enable sound to try again.');buttons(gameButton('Enable sound',()=>demo(replay),'primary'),gameButton('Leave game',end));showModal();return;}
  audio.stop();paused=false;phase='listen';start=audio.time+.15;huntAt=start+12*.625;hud.hidden=true;
  title('Catch it by ear','Listen closely. Then catch the note values and rebuild what you heard.');const count=document.createElement('div');count.className='town-game-count';count.id='rhythmCatchCount';count.setAttribute('aria-live','polite');dialog.append(count);buttons(gameButton('Leave game',end));showModal();
  for(let i=0;i<4;i++)audio.tone(start+i*.625,.1,i===3?960:460,.22);
  for(let loop=0;loop<2;loop++){let beat=0;for(const value of target){const attacks=catchAttacks(value);for(const offset of attacks)audio.tone(start+(4+loop*4+beat+offset)*.625,.625/Math.max(1,attacks.length)*.65,660,.27);beat++;}}
 }
 function startRound(){
  target=[...CATCH_PATTERNS[(journal.data.netWins+round)%CATCH_PATTERNS.length]];bag=[];order=[];mistakes=0;
  const player=getPlayer();if(!player){end();return;}
  collision.invalidate();tokens=launchFlyingNotes(scatterNotes(target,reachableNoteSpots(doc,catalog,player)));flightTime=0;lastTick=null;
  if(!tokens.length){phase='unavailable';fail('This cart needs a larger connected patch of walkable town for the notes. Try a cart with more open paths nearby.');return;}
  phase='ready';void demo();
 }
 function startGame(actor){end();host={...actor,interaction:actor.interaction?{...actor.interaction}:null};doc=getProject();round=0;phase='ready';startRound();}
 function hunt(){phase='hunt';lastTick=null;swinging=false;closeModal();canvas.focus();message='Chase the flying notes and sweep your net with F. Bring your collection back to the vendor to build the rhythm.';updateHUD();hud.hidden=false;}
 function updateHUD(){
  hud.replaceChildren();const label=document.createElement('strong');label.textContent=`RHYTHM CATCH · ROUND ${round+1} / 3`;const progress=document.createElement('span');progress.textContent=`${bag.length} collected · 4 beats to build · ${journal.data.stars} town stars`;
  const info=document.createElement('p');info.className='town-game-status';info.setAttribute('role','status');info.textContent=message;hud.append(label,progress,info);
  const row=document.createElement('div');row.className='town-game-actions';row.append(gameButton('Swing net · F',()=>swing(),'primary'),gameButton('Build at vendor · E',()=>interact()),gameButton('Hear rhythm · R',()=>demo(true)),gameButton('Leave',end));hud.append(row);
 }
 function assemble(){phase='arrange';hud.hidden=true;audio.stop();title('Build the rhythm','Choose four of your caught cards in the order you heard them. Each card fills one beat.');
  const slots=document.createElement('div');slots.className='rhythm-slots';slots.setAttribute('aria-label','Your rhythm');for(let i=0;i<target.length;i++){const box=document.createElement('span');box.className='rhythm-slot';box.innerHTML=order[i]===undefined?'<span>?</span>':noteSVG(order[i]);slots.append(box);}dialog.append(slots);
  const tray=document.createElement('div');tray.className='rhythm-note-tray';const available=remainingNotes(bag,order);for(const value of NOTE_VALUES){const count=available.filter(n=>n===value).length;if(!count)continue;const b=gameButton('',()=>{if(order.length<target.length)order.push(value);assemble();});b.innerHTML=noteSVG(value)+`<span>${noteName(value)} × ${count}</span>`;b.setAttribute('aria-label',`Add ${noteName(value)}`);tray.append(b);}dialog.append(tray);
  const info=document.createElement('p');info.setAttribute('role','status');info.textContent=message;dialog.append(info);
  buttons(gameButton('Check my rhythm',check,'primary'),gameButton('Catch more notes',()=>{message='Keep collecting, then return to the vendor.';hunt();}),gameButton('Undo',()=>{order.pop();assemble();}),gameButton('Hear it again',()=>{void demo(true);}),gameButton('Leave',end));showModal();
 }
 function check(){
  if(phase!=='arrange')return;
  if(order.length!==target.length){message='Choose four cards to fill four beats. Catch more if you need different cards.';assemble();return;}
  if(!sameRhythm(order,target)){mistakes++;message='Almost! Listen again, then try a different order.';assemble();return;}
  phase='won';const stars=Math.max(1,3-Math.min(2,mistakes));journal.data.stars+=stars;journal.data.netWins++;journal.save();audio.tone(audio.time,.2,660);audio.tone(audio.time+.15,.3,990);
  title(round===2?'Town rhythm ranger!':'You caught the rhythm!',`+${stars} town stars · ${journal.data.stars} total. ${journal.warning||'Your progress is saved.'}`);
  const notes=document.createElement('div');notes.className='rhythm-slots';for(const value of target){const e=document.createElement('span');e.className='rhythm-slot';e.innerHTML=noteSVG(value);notes.append(e);}dialog.append(notes);
  buttons(gameButton(round===2?'Play another hunt':'Next rhythm',()=>{round=round===2?0:round+1;startRound();},'primary'),gameButton('Back to town',end));
 }
 function swing(pointer=false){
  if(phase!=='hunt'||paused)return;const now=performance.now()/1000;if(now-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS)return;
  if(!pointer)aim=facingAngle(getFacing());swingAt=now;swingProgress=0;swingHit=false;swinging=true;
 }
 function updateSwing(now){
  if(!swinging)return;const p=getPlayer(),progress=Math.min(1,(now-swingAt)/NET_SWEEP_SECONDS),z=height(doc,p.x,p.y);
  if(!swingHit){const hit=tokens.find(t=>{
   // Solid walls and cliffs must stop the net as well as the flying notes.
   const point=flyingNotePose(t,flightTime,height(doc,t.x,t.y),motionQuery.matches);
   if(!netSweepHits(point,p,aim,swingProgress,progress,z))return false;
   const steps=Math.max(1,Math.ceil(Math.hypot(t.x-p.x,t.y-p.y)/4));let previous=p;
   for(let i=1;i<=steps;i++){const q={x:p.x+(t.x-p.x)*i/steps,y:p.y+(t.y-p.y)*i/steps};if(blocked(collision.view(q),q.x,q.y,catalog,previous))return false;previous=q;}return true;
  });
  if(hit){swingHit=true;bag.push(hit.value);tokens=tokens.filter(t=>t!==hit);message=`Caught: ${noteName(hit.value)}. Bring your cards to the vendor to build.`;audio.tone(audio.time,.13,880,.17);updateHUD();}
  }
  swingProgress=progress;if(progress===1){swinging=false;if(!swingHit){message='Missed! Chase a note, face it, and sweep with F.';updateHUD();}}
 }
 function nearVendor(){const p=getPlayer(),at=host?.interaction||host;return !!(p&&at&&Math.hypot(p.x-at.x,p.y-at.y)<160);}
 function interact(){if(phase!=='hunt')return true;if(!nearVendor()){message='Bring your notes back to the vendor before building the rhythm.';updateHUD();return true;}order=[];message='Build what you heard, or head out to catch more cards.';assemble();return true;}
 function pointer(e){if(phase!=='hunt'||!lastCam)return false;if(e.button!==0)return true;if(paused||performance.now()/1000-swingAt<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS){e.preventDefault();return true;}const r=canvas.getBoundingClientRect(),p=getPlayer(),z=height(doc,p.x,p.y),point={x:lastCam.x+(e.clientX-r.left-r.width/2)/lastCam.zoom,y:lastCam.y+(e.clientY-r.top-r.height/2)/lastCam.zoom};aim=Math.atan2(point.y-(p.y-z-53),point.x-p.x);setFacing(angleFacing(aim));e.preventDefault();swing(true);canvas.focus();return true;}
 function keydown(e){if(!active())return false;const key=e.key.toLowerCase();if(e.target?.closest?.('button')&&(key===' '||key==='enter'))return true;if(key==='escape'){e.preventDefault();end();return true;}if(paused||phase!=='hunt')return true;if((key==='f'||key===' ')&&!e.repeat){e.preventDefault();swing();return true;}if(key==='r'&&!e.repeat){e.preventDefault();void demo(true);return true;}if(key==='e'&&!e.repeat){e.preventDefault();interact();return true;}return false;}
 function pause(){if(!['listen','hunt','arrange'].includes(phase)||paused)return;paused=true;lastTick=null;swinging=false;audio.suspend();title('Hunt paused','Your notes are safe. Take a breath, then continue.');buttons(gameButton('Continue',async()=>{await audio.resume();paused=false;if(phase==='listen')void demo(true);else if(phase==='hunt'){closeModal();canvas.focus();}else assemble();},'primary'),gameButton('Leave',end));showModal();}
 function tick(){if(!active())return;if(getProject()!==doc){end();return;}if(paused){lastTick=null;return;}const now=performance.now()/1000,dt=lastTick===null?0:Math.min(.05,now-lastTick);lastTick=phase==='hunt'?now:null;if(phase==='hunt'){const p=getPlayer();flightTime+=dt;for(const t of tokens)advanceFlyingNote(t,p,dt,flightTime,(a,b)=>!blocked(collision.view(b),b.x,b.y,catalog,a));updateSwing(now);}if(phase==='listen'){
  const elapsed=audio.time-start,count=Math.floor(elapsed/.625),node=dialog.querySelector('#rhythmCatchCount');if(node){const text=count<0?'Get ready':count<4?['1','2','READY','GO!'][count]:'LISTEN';if(node.textContent!==text)node.textContent=text;}
  if(audio.time>=huntAt){if(returningToBuild){returningToBuild=false;assemble();}else hunt();}
 }}
 function draw(c,cam,time){if(phase!=='hunt')return;lastCam={...cam};const p=getPlayer();if(!p)return;
  for(const t of tokens){const point=flyingNotePose(t,flightTime,height(doc,t.x,t.y),motionQuery.matches),y=point.y;if(Math.abs(t.x-cam.x)>canvas.clientWidth/2/cam.zoom+60||Math.abs(y-cam.y)>canvas.clientHeight/2/cam.zoom+60)continue;
   c.save();c.translate(t.x,y);c.fillStyle='#d8f6d977';
   const flap=motionQuery.matches?5:5+Math.abs(Math.sin(flightTime*23+t.phase))*12;
   for(const side of [-1,1]){c.beginPath();c.ellipse(side*42,-10,flap,8,side*.5,0,Math.PI*2);c.fill();}
   c.fillStyle='#244a43e8';c.strokeStyle='#91f5d7';c.lineWidth=3;c.beginPath();c.arc(0,0,39,0,Math.PI*2);c.fill();c.stroke();c.fillStyle='#fff0bb';c.strokeStyle='#fff0bb';drawCatchNote(c,t.value,0,4,.85);c.restore();
  }
  const age=performance.now()/1000-swingAt,sweeping=swinging&&age<=NET_SWEEP_SECONDS,recovering=age>=NET_SWEEP_SECONDS&&age<NET_SWEEP_SECONDS+NET_RECOVERY_SECONDS,z=height(doc,p.x,p.y),base=sweeping||recovering?aim:facingAngle(getFacing()),pose=netSweepPose(p,base,sweeping?age/NET_SWEEP_SECONDS:recovering?1-(age-NET_SWEEP_SECONDS)/NET_RECOVERY_SECONDS:0,z),{grip,x:nx,y:ny}=pose;
  c.save();
  if(sweeping&&!motionQuery.matches){
   c.strokeStyle='#fce9af66';c.lineWidth=4;c.lineCap='round';c.beginPath();
   const u=Math.max(0,Math.min(1,age/NET_SWEEP_SECONDS));for(let i=0;i<=12;i++){const a=netSweepPose(p,base,Math.max(0,u-.25)+Math.min(.25,u)*i/12,z);if(i)c.lineTo(a.x,a.y);else c.moveTo(a.x,a.y);}c.stroke();
  }
  c.lineCap='round';c.lineWidth=5;c.strokeStyle='#714b2d';c.beginPath();c.moveTo(grip.x,grip.y);c.lineTo(nx,ny+4);c.stroke();c.lineWidth=1.5;c.strokeStyle='#d9b27d';c.beginPath();c.moveTo(grip.x,grip.y-1);c.lineTo(nx,ny+3);c.stroke();
  c.translate(nx,ny);c.rotate(Math.sin(pose.angle)*.3-.2);
  // A loose mesh bag hangs below the oval rim; it is not a flat tennis racket.
  c.beginPath();c.moveTo(-28,0);c.bezierCurveTo(-26,28,-17,42,0,44);c.bezierCurveTo(18,42,26,28,28,0);c.quadraticCurveTo(0,14,-28,0);c.closePath();c.fillStyle='#eaf4de22';c.fill();c.save();c.clip();c.lineWidth=1;c.strokeStyle='#f0f3d38c';
  for(let i=-35;i<=35;i+=9){c.beginPath();c.moveTo(i,-8);c.quadraticCurveTo(i*.55,24,i*.3+8,48);c.stroke();c.beginPath();c.moveTo(i,-8);c.quadraticCurveTo(i*.6,24,i*.3-8,48);c.stroke();}
  for(let yy=9;yy<44;yy+=8){c.beginPath();c.moveTo(-30,yy);c.quadraticCurveTo(0,yy+8,30,yy);c.stroke();}c.restore();
  c.lineWidth=2;c.strokeStyle='#c3cfb6aa';c.beginPath();c.moveTo(-28,0);c.bezierCurveTo(-24,30,-16,43,0,44);c.bezierCurveTo(17,43,25,27,28,0);c.stroke();
  c.lineWidth=3;c.strokeStyle=sweeping?'#ffe5a1':'#bca37a';c.beginPath();c.ellipse(0,0,29,12,0,0,Math.PI*2);c.stroke();c.restore();

 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();end();});
 return {start:startGame,end,tick,draw,pointer,keydown,pause,interact,get active(){return active();},get fullscreen(){return dialog.open;},get blocked(){return active()&&(paused||phase!=='hunt');},get state(){return {phase,round,target:[...target],host:host?{x:host.x,y:host.y,interaction:host.interaction}:null,tokens:tokens.map(t=>({...t})),bag:[...bag],order:[...order],paused,mistakes,flightTime,swing:swinging?{angle:aim,progress:swingProgress,hit:swingHit}:null};}};
}
