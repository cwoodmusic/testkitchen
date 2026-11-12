import {height} from './model.mjs?v=opera-parallax-1';
import {CATCH_PATTERNS,remainingNotes,sameRhythm,reachableNoteSpots,scatterNotes} from './town-game-rules.mjs?v=town-games-1';
import {createGameAudio,noteSVG,noteName,gameButton,drawNote} from './town-game-audio.mjs?v=town-games-1';
export function createRhythmCatch({canvas,getProject,getPlayer,catalog,journal}){
 const audio=createGameAudio(),dialog=document.createElement('dialog'),hud=document.createElement('section');dialog.className='town-game-dialog rhythm-catch-dialog';dialog.setAttribute('aria-label','Rhythm Catch');hud.className='town-game-hud';hud.hidden=true;document.body.append(dialog,hud);
 let phase='idle',doc=null,round=0,target=[],tokens=[],bag=[],order=[],host=null,start=0,huntAt=0,aim=0,swingAt=-10,mistakes=0,message='',paused=false,lastCam=null,noticeUntil=0,busy=false,serial=0;
 const active=()=>phase!=='idle';
 function closeModal(){if(dialog.open)dialog.close();}
 function showModal(){if(!dialog.open)dialog.showModal();}
 function end(){serial++;busy=false;audio.stop();phase='idle';paused=false;tokens=[];bag=[];order=[];hud.hidden=true;closeModal();canvas.focus();}
 function title(text,description){dialog.replaceChildren();const k=document.createElement('div');k.className='town-game-eyebrow';k.textContent='CODA TOWN · RHYTHM CATCH';const h=document.createElement('h1');h.textContent=text;dialog.append(k,h);if(description){const p=document.createElement('p');p.textContent=description;dialog.append(p);}return dialog;}
 function buttons(...items){const row=document.createElement('div');row.className='town-game-actions';row.append(...items);dialog.append(row);}
 function fail(text){title('A little more room?',text);buttons(gameButton('Back to town',end));showModal();}
 async function demo(replay=false){
  if(busy)return;const ticket=serial;busy=true;const ok=await audio.unlock();if(ticket!==serial)return;busy=false;if(!active())return;
  if(!ok){phase='sound';title('Let’s hear the rhythm','Sound is needed for this challenge. Select Enable sound to try again.');buttons(gameButton('Enable sound',()=>demo(replay),'primary'),gameButton('Leave game',end));showModal();return;}
  audio.stop();paused=false;phase='listen';start=audio.time+.15;huntAt=start+12*.625;hud.hidden=true;
  title('Catch it by ear','Listen closely. Then catch the note values and rebuild what you heard.');const count=document.createElement('div');count.className='town-game-count';count.id='rhythmCatchCount';count.setAttribute('aria-live','polite');dialog.append(count);buttons(gameButton('Leave game',end));showModal();
  for(let i=0;i<4;i++)audio.tone(start+i*.625,.1,i===3?960:460,.22);
  for(let loop=0;loop<2;loop++){let beat=0;for(const value of target){audio.tone(start+(4+loop*4+beat)*.625,value*.625*.65,660,.27);beat+=value;}}
 }
 function startRound(){
  target=[...CATCH_PATTERNS[(journal.data.netWins+round)%CATCH_PATTERNS.length]];bag=[];order=[];mistakes=0;
  const player=getPlayer();if(!player){end();return;}
  tokens=scatterNotes(target,reachableNoteSpots(doc,catalog,player));
  if(!tokens.length){phase='unavailable';fail('This cart needs a larger connected patch of walkable town for the notes. Try a cart with more open paths nearby.');return;}
  phase='ready';void demo();
 }
 function startGame(actor){end();host=actor;doc=getProject();round=0;phase='ready';startRound();}
 function hunt(){phase='hunt';closeModal();canvas.focus();message='Find floating notes. Space or click swings your net.';updateHUD();hud.hidden=false;}
 function updateHUD(){
  hud.replaceChildren();const label=document.createElement('strong');label.textContent=`RHYTHM CATCH · ROUND ${round+1} / 3`;const progress=document.createElement('span');progress.textContent=`${bag.length} / ${target.length} notes · ${journal.data.stars} town stars`;
  const info=document.createElement('p');info.className='town-game-status';info.setAttribute('role','status');info.textContent=message;hud.append(label,progress,info);
  const row=document.createElement('div');row.className='town-game-actions';row.append(gameButton('Swing net',()=>swing(),'primary'),gameButton('Hear rhythm · R',()=>demo(true)),gameButton('Leave',end));hud.append(row);
 }
 function assemble(){phase='arrange';hud.hidden=true;audio.stop();title('Build the rhythm','Choose your caught notes in the order you heard them. The rhythm fills four beats.');
  const slots=document.createElement('div');slots.className='rhythm-slots';slots.setAttribute('aria-label','Your rhythm');for(let i=0;i<target.length;i++){const box=document.createElement('span');box.className='rhythm-slot';box.innerHTML=order[i]===undefined?'<span>?</span>':noteSVG(order[i]);slots.append(box);}dialog.append(slots);
  const tray=document.createElement('div');tray.className='rhythm-note-tray';const available=remainingNotes(bag,order);for(const value of [.5,1,2]){const count=available.filter(n=>n===value).length;if(!count)continue;const b=gameButton('',()=>{order.push(value);assemble();});b.innerHTML=noteSVG(value)+`<span>${noteName(value)} × ${count}</span>`;b.setAttribute('aria-label',`Add ${noteName(value)}`);tray.append(b);}dialog.append(tray);
  const info=document.createElement('p');info.setAttribute('role','status');info.textContent=message;dialog.append(info);
  buttons(gameButton('Check my rhythm',check,'primary'),gameButton('Undo',()=>{order.pop();assemble();}),gameButton('Hear it again',()=>{void demo(true);}),gameButton('Leave',end));showModal();
 }
 function check(){
  if(phase!=='arrange')return;
  if(order.length!==target.length){message='Use all the notes you caught, then check.';assemble();return;}
  if(!sameRhythm(order,target)){mistakes++;message='Almost! Listen again, then try a different order.';assemble();return;}
  phase='won';const stars=Math.max(1,3-Math.min(2,mistakes));journal.data.stars+=stars;journal.data.netWins++;journal.save();audio.tone(audio.time,.2,660);audio.tone(audio.time+.15,.3,990);
  title(round===2?'Town rhythm ranger!':'You caught the rhythm!',`+${stars} town stars · ${journal.data.stars} total. ${journal.warning||'Your progress is saved.'}`);
  const notes=document.createElement('div');notes.className='rhythm-slots';for(const value of target){const e=document.createElement('span');e.className='rhythm-slot';e.innerHTML=noteSVG(value);notes.append(e);}dialog.append(notes);
  buttons(gameButton(round===2?'Play another hunt':'Next rhythm',()=>{round=round===2?0:round+1;startRound();},'primary'),gameButton('Back to town',end));
 }
 function swing(pointer=false){
  if(phase!=='hunt'||paused)return;const now=performance.now()/1000;if(now-swingAt<.35)return;swingAt=now;
  const p=getPlayer(),near=tokens.filter(t=>Math.hypot(t.x-p.x,t.y-p.y)<220).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y));
  if(!pointer&&near.length)aim=Math.atan2(near[0].y-p.y,near[0].x-p.x);
  const hit=near.find(t=>Math.cos(Math.atan2(t.y-p.y,t.x-p.x)-aim)>.2);
  if(!hit){message='A little closer! Bring a note inside your net.';updateHUD();return;}
  const wanted=remainingNotes(target,bag);if(!wanted.includes(hit.value)){mistakes++;message=`That ${noteName(hit.value).toLowerCase()} isn’t needed. Try another note.`;audio.tone(audio.time,.1,220,.12);}else{bag.push(hit.value);tokens=tokens.filter(t=>t!==hit);message=`Caught a ${noteName(hit.value).toLowerCase()}!`;audio.tone(audio.time,.13,880,.17);}
  if(bag.length===target.length){message='All the note values are here. Can you put them in order?';assemble();}else updateHUD();
 }
 function pointer(e){if(phase!=='hunt'||!lastCam)return false;if(e.button!==0)return true;const r=canvas.getBoundingClientRect(),p=getPlayer(),z=height(doc,p.x,p.y),point={x:lastCam.x+(e.clientX-r.left-r.width/2)/lastCam.zoom,y:lastCam.y+(e.clientY-r.top-r.height/2)/lastCam.zoom};aim=Math.atan2(point.y-(p.y-z-50),point.x-p.x);e.preventDefault();swing(true);canvas.focus();return true;}
 function keydown(e){if(!active())return false;const key=e.key.toLowerCase();if(e.target?.closest?.('button')&&(key===' '||key==='enter'))return true;if(key==='escape'){e.preventDefault();end();return true;}if(paused||phase!=='hunt')return true;if(key===' '&&!e.repeat){e.preventDefault();swing();return true;}if(key==='r'&&!e.repeat){e.preventDefault();void demo(true);return true;}if(key==='e')return true;return false;}
 function pause(){if(!['listen','hunt','arrange'].includes(phase)||paused)return;paused=true;audio.suspend();title('Hunt paused','Your notes are safe. Take a breath, then continue.');buttons(gameButton('Continue',async()=>{await audio.resume();paused=false;if(phase==='listen')void demo(true);else if(phase==='hunt'){closeModal();canvas.focus();}else assemble();},'primary'),gameButton('Leave',end));showModal();}
 function tick(){if(!active())return;if(getProject()!==doc){end();return;}if(paused)return;if(phase==='listen'){
  const elapsed=audio.time-start,count=Math.floor(elapsed/.625),node=dialog.querySelector('#rhythmCatchCount');if(node){const text=count<0?'Get ready':count<4?['1','2','READY','GO!'][count]:'LISTEN';if(node.textContent!==text)node.textContent=text;}
  if(audio.time>=huntAt){if(bag.length===target.length)assemble();else hunt();}
 }}
 function draw(c,cam,time){if(phase!=='hunt')return;lastCam={...cam};const p=getPlayer();if(!p)return;
  for(const t of tokens){const z=height(doc,t.x,t.y),bob=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(time*2+t.phase)*8;const y=t.y-z-80+bob;
   c.save();c.shadowColor='#7bf1d0';c.shadowBlur=18;c.fillStyle='#244a43e8';c.strokeStyle='#91f5d7';c.lineWidth=3;c.beginPath();c.arc(t.x,y,36,0,Math.PI*2);c.fill();c.stroke();c.shadowBlur=0;c.fillStyle='#fff0bb';c.strokeStyle='#fff0bb';drawNote(c,t.value,t.x,y+4,.85);c.restore();
  }
  const age=performance.now()/1000-swingAt,sweeping=age<.32,angle=aim+(sweeping?Math.sin(age/.32*Math.PI)*.5:0),x=p.x,y=p.y-height(doc,p.x,p.y)-48,nx=x+Math.cos(angle)*125,ny=y+Math.sin(angle)*85;
  c.save();c.lineWidth=9;c.strokeStyle='#704f35';c.beginPath();c.moveTo(x+18,y+5);c.lineTo(nx,ny+20);c.stroke();c.lineWidth=4;c.strokeStyle=sweeping?'#fff2a9':'#86eacf';c.fillStyle='#8ce9d41c';c.beginPath();c.ellipse(nx,ny,68,48,angle*.15,0,Math.PI*2);c.fill();c.stroke();c.save();c.clip();c.lineWidth=1.5;c.strokeStyle='#c1ffe98c';for(let n=-90;n<90;n+=14){c.beginPath();c.moveTo(nx+n,ny-60);c.lineTo(nx+n+55,ny+60);c.stroke();c.beginPath();c.moveTo(nx+n,ny-60);c.lineTo(nx+n-55,ny+60);c.stroke();}c.restore();c.restore();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();end();});
 return {start:startGame,end,tick,draw,pointer,keydown,pause,get active(){return active();},get blocked(){return active()&&(paused||phase!=='hunt');},get state(){return {phase,round,target:[...target],tokens:tokens.map(t=>({...t})),bag:[...bag],order:[...order],paused,mistakes};}};
}
