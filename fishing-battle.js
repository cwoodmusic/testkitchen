/* Small, clock-driven feedback for a hooked fish. It never changes the score. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaFishingBattle=api;root.createCodaFishingBattle=api.createCodaFishingBattle;}})(typeof window==='object'?window:null,function(){
 'use strict';
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const clone=value=>JSON.parse(JSON.stringify(value));
 const ANNOUNCEMENT_SECONDS=3.4;
 const RARITY_INK=['#9fbfd2','#a4dbbe','#8de5e1','#d5a9ff','#ffe29a'];
 function createBattleState(options={}){
  let serial=0,current=null;
  const calm=()=>options.reducedMotion?.()===true||options.getQuality?.()==='off';
  function start({fish,time=0,id,preview=false}={}){
   if(!fish)return getState();
   const key=String(id??('battle-'+(++serial)));
   if(current?.id===key)return getState();
   const rank=clamp(Math.round(finite(fish.rarityRank)),0,4),rare=rank>=2&&!preview;
   current={id:key,fish:clone(fish),rank,time:finite(time),startedTime:finite(time),elapsed:0,lastTime:finite(time),progress:45,displayProgress:45,phase:preview?'bite':'count-in',paused:false,hits:0,misses:0,extras:0,feedback:preview?'Your float is bobbing':'Listen to the count-in',reaction:null,reactionAt:-10,judgementKey:null,announcement:rare?{title:(rank===4?'LEGENDARY':rank===3?'EPIC':'RARE')+' FISH!',name:String(fish.name||'Something special took your bait'),visible:true,announced:true}:null};
   return getState();
  }
  function update(value={}){
   if(!current&&value.phase==='bite'&&value.fish)start({fish:value.fish,time:value.time,id:'bite-preview',preview:true});
   if(!current)return getState();
   const nextTime=finite(value.time,current.lastTime),delta=Math.max(0,nextTime-current.lastTime),wasPaused=current.paused;
   current.lastTime=Math.max(current.lastTime,nextTime);current.paused=value.paused===true;
   if(current.paused)return getState();
   const dt=wasPaused?0:delta;current.elapsed+=dt;current.time=nextTime;
   if(value.fish?.id===current.fish.id)current.fish=clone(value.fish);
   current.phase=String(value.phase||current.phase);
   current.progress=clamp(finite(value.progress,current.progress),0,100);
   const judgement=value.lastJudgement,kind=judgement?.kind||judgement?.type;
   const judgementKey=judgement?JSON.stringify([kind,judgement.time,judgement.noteId,value.hits,value.misses,value.extras]):null;
   let reaction=null;
   if(judgementKey&&judgementKey!==current.judgementKey&&['hit','miss','extra'].includes(kind))reaction=kind;
   else if(finite(value.hits,current.hits)>current.hits)reaction='hit';
   else if(finite(value.misses,current.misses)>current.misses)reaction='miss';
   else if(finite(value.extras,current.extras)>current.extras)reaction='extra';
   current.judgementKey=judgementKey;current.hits=finite(value.hits,current.hits);current.misses=finite(value.misses,current.misses);current.extras=finite(value.extras,current.extras);
   if(reaction){current.reaction=reaction;current.reactionAt=current.elapsed;}
   if(current.elapsed-current.reactionAt>1)current.reaction=null;
   const blend=calm()?1:1-Math.exp(-Math.min(.25,dt)*9);current.displayProgress+=(current.progress-current.displayProgress)*blend;
   if(Math.abs(current.progress-current.displayProgress)<.01)current.displayProgress=current.progress;
   current.feedback=current.phase==='bite'?'Your float is bobbing':current.phase==='count-in'?'Listen to the count-in':current.phase==='caught'?'Reeled in!':current.phase==='escaped'?'The fish slipped away':current.reaction==='hit'?'Reeling it closer!':current.reaction==='miss'||current.reaction==='extra'?'The fish is pulling!':'Keep a steady rhythm';
   if(current.announcement)current.announcement.visible=current.elapsed<ANNOUNCEMENT_SECONDS;
   return getState();
  }
  function getState(){
   if(!current)return {active:false};
   const quiet=calm(),reactionAge=Math.max(0,current.elapsed-current.reactionAt),kick=quiet?0:Math.max(0,1-reactionAge/.8),bad=current.reaction==='miss'||current.reaction==='extra',good=current.reaction==='hit';
   const tension=clamp(.23+(1-current.progress/100)*.5+(bad?.28:good?-.12:0)*kick,.08,1),baseX=.83-current.displayProgress*.0045;
   return {...clone(current),active:true,calm:quiet,fishX:clamp(baseX+(bad?.045:good?-.025:0)*kick+(quiet?0:Math.sin(current.elapsed*3.3)*.006),.30,.88),fishY:.61+(quiet?0:Math.sin(current.elapsed*4)*.045+(bad?Math.sin(reactionAge*18)*.045*kick:0)),tension,wiggle:quiet?0:Math.sin(current.elapsed*(bad?20:9))*(bad?3:1.5),kick,color:bad?'#f39eac':good?'#a0f2d1':RARITY_INK[current.rank],announcement:current.announcement?{...current.announcement}:null,announcementVisible:current.announcement?.visible===true,announcementText:current.announcement?.title||'',announcementRemaining:current.announcement?Math.max(0,ANNOUNCEMENT_SECONDS-current.elapsed):0,announcementExpiresAt:current.startedTime+ANNOUNCEMENT_SECONDS};
  }
  function clear(){current=null;}
  return {start,update,getState,clear};
 }
 function createCodaFishingBattle(api={}){
  const host=api.host;if(!host)throw Error('The fishing battle needs a host.');
  const doc=host.ownerDocument,win=doc.defaultView||window,model=createBattleState(api);
  host.classList.add('fishing-battle');host.setAttribute('aria-label','Fish and fishing line');
  const canvas=doc.createElement('canvas');canvas.className='fishing-battle-canvas';canvas.width=800;canvas.height=146;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','A hooked fish pulls against your rod. Good rhythm reels it closer.');
  const caption=doc.createElement('span');caption.className='fishing-battle-caption';caption.dataset.battleFeedback='';caption.textContent='Feel the pull. Keep the rhythm.';
  const announcement=doc.createElement('div');announcement.className='fishing-battle-announcement';announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');announcement.setAttribute('aria-atomic','true');announcement.hidden=true;
  const title=doc.createElement('strong'),name=doc.createElement('span');announcement.append(title,name);host.replaceChildren(canvas,caption,announcement);
  const g=canvas.getContext('2d');let destroyed=false,draws=0,announcements=0,lastAnnounced=null,line=null;
  function fallbackFish(ctx,fish,x,y,scale,wiggle){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=fish.color||'#8fc6c6';ctx.beginPath();ctx.ellipse(0,0,24,12,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(35,-14+wiggle);ctx.lineTo(35,14+wiggle);ctx.closePath();ctx.fill();ctx.fillStyle='#142238';ctx.fillRect(-16,-4,3,3);ctx.restore();}
  function resize(){const box=canvas.getBoundingClientRect(),width=Math.max(240,Math.round(box.width)||800),height=Math.max(50,Math.round(box.height)||146);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}return {width,height};}
  function draw(){
   if(destroyed||!g)return;const state=model.getState(),{width:w,height:h}=resize();draws++;g.clearRect(0,0,w,h);g.imageSmoothingEnabled=false;
   g.fillStyle='#11283c';g.fillRect(0,0,w,h);g.fillStyle='#173a4c';g.fillRect(0,h*.43,w,h*.57);g.fillStyle='#32617a';g.fillRect(0,Math.round(h*.43),w,2);
   if(!state.active){caption.textContent='Feel the pull. Keep the rhythm.';announcement.hidden=true;return;}
   const time=state.elapsed,moving=!state.calm&&!state.paused,scale=clamp(h/130,.52,1.2),anglerX=Math.round(w*.12),waterY=Math.round(h*.64),fishX=Math.round(w*state.fishX),fishY=Math.round(h*state.fishY),fishScale=scale*(1+state.rank*.09)*clamp(finite(state.fish.visualSize,finite(state.fish.battleSize,1)),.7,1.6);
   if(api.getQuality?.()!=='off')for(let i=0;i<10;i++){const x=(i*101+(state.calm?0:Math.sin(time*1.3+i)*8))%w,y=h*(.53+(i%4)*.1);g.fillStyle=i%2?'#4e8e9c55':'#67acb855';g.fillRect(Math.round(x),Math.round(y),15+i%3*8,1);}
   // The angler and rod share the boat's small, paused-clock-driven motion.
   const boatBob=state.calm?0:Math.sin(time*1.7)*1.4*scale,boatRock=state.calm?0:Math.sin(time*1.2)*.012+(state.reaction==='miss'||state.reaction==='extra'?state.kick*.018:state.reaction==='hit'?-state.kick*.007:0);
   g.save();g.translate(anglerX,waterY+boatBob);g.rotate(boatRock);g.translate(-anglerX,-waterY);
   // The boat, sleeves and rod remain deliberately small so the notation wins.
   g.fillStyle='#80543f';g.beginPath();g.moveTo(anglerX-31*scale,waterY+2);g.lineTo(anglerX+34*scale,waterY+2);g.lineTo(anglerX+23*scale,waterY+15*scale);g.lineTo(anglerX-22*scale,waterY+15*scale);g.closePath();g.fill();g.fillStyle='#d9aa6c';g.fillRect(anglerX-30*scale,waterY,64*scale,3*scale);
   g.fillStyle='#4a6879';g.fillRect(anglerX-6*scale,waterY-24*scale,15*scale,25*scale);g.fillStyle='#d8a078';g.fillRect(anglerX-5*scale,waterY-37*scale,14*scale,14*scale);g.fillStyle='#444159';g.fillRect(anglerX-9*scale,waterY-40*scale,22*scale,5*scale);g.fillStyle='#c3d1d3';g.fillRect(anglerX+8*scale,waterY-20*scale,16*scale,5*scale);
   const grip={x:anglerX+21*scale,y:waterY-18*scale},rodTip={x:anglerX+67*scale+state.tension*8*scale,y:waterY-(47-state.tension*15)*scale};
   g.lineCap='round';g.strokeStyle='#d4a875';g.lineWidth=3*scale;g.beginPath();g.moveTo(grip.x,grip.y);g.quadraticCurveTo(grip.x+12*scale,rodTip.y-23*scale,rodTip.x,rodTip.y);g.stroke();g.restore();
   const dx=rodTip.x-anglerX,dy=rodTip.y-waterY,tip={x:anglerX+dx*Math.cos(boatRock)-dy*Math.sin(boatRock),y:waterY+boatBob+dx*Math.sin(boatRock)+dy*Math.cos(boatRock)};
   const mouth={x:fishX-24*fishScale,y:fishY-2*fishScale},slack=(1-state.tension)*h*.18;
   line={rod:{...tip},mouth:{...mouth},fish:{x:fishX,y:fishY,scale:fishScale},boat:{x:anglerX,y:waterY+boatBob,rock:boatRock},slack,tension:state.tension};
   g.strokeStyle=state.color;g.lineWidth=1.6*scale;g.beginPath();g.moveTo(tip.x,tip.y);g.quadraticCurveTo((tip.x+mouth.x)/2,(tip.y+mouth.y)/2+slack,mouth.x,mouth.y);g.stroke();
   g.save();g.translate(fishX,fishY);g.rotate(Math.PI+(moving?Math.sin(time*5)*.08+(state.reaction==='hit'?-.12:state.reaction?-.2:0)*state.kick:0));
   if(typeof api.drawFish==='function')api.drawFish(g,state.fish,0,0,fishScale,false,state.wiggle);else{g.rotate(Math.PI);fallbackFish(g,state.fish,0,0,fishScale,state.wiggle);}g.restore();
   g.fillStyle='#c6f2e5';g.fillRect(Math.round(mouth.x-1),Math.round(mouth.y-1),2,2);
   if(moving&&state.kick>0&&api.getQuality?.()!=='off')for(let i=0;i<5;i++){const spread=(1-state.kick)*22,angle=i*.72+time*2;g.fillStyle=state.color;g.globalAlpha=state.kick*.8;g.fillRect(Math.round(fishX+Math.cos(angle)*(12+spread)),Math.round(fishY-9-Math.sin(i+1)*spread),2,2);}g.globalAlpha=1;
   if(state.paused){g.fillStyle='#11283c88';g.fillRect(0,0,w,h);}
   const text=state.paused?'Battle paused':state.feedback;if(caption.textContent!==text)caption.textContent=text;
   const rare=state.announcement;announcement.hidden=!rare?.visible;
   if(rare){announcement.dataset.rarity=state.fish.rarity||String(state.rank);if(lastAnnounced!==state.id){title.textContent=rare.title;name.textContent=rare.name;lastAnnounced=state.id;announcements++;}}
  }
  function start(value){if(destroyed)return model.getState();const state=model.start(value);draw();return state;}
  function update(value){if(destroyed)return model.getState();const state=model.update(value);draw();return state;}
  function clear(){model.clear();line=null;lastAnnounced=null;announcement.hidden=true;title.textContent='';name.textContent='';draw();}
  function getState(){return {...model.getState(),line:line?clone(line):null,draws,announcements,width:canvas.width,height:canvas.height,destroyed};}
  function destroy(){if(destroyed)return;destroyed=true;model.clear();host.replaceChildren();host.classList.remove('fishing-battle');}
  draw();return {start,update,clear,getState,destroy};
 }
 return {ANNOUNCEMENT_SECONDS,createBattleState,createCodaFishingBattle};
});
