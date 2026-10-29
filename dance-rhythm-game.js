/* The DJ's line-dance game. Timing lives in the pure engine; this view owns
 * notation, touch/keyboard input and short-lived Web Audio voices. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./dance-rhythm-engine.js'):root?.CodaDanceRhythmEngine,node?require('./music-notation.js'):root?.CodaMusicNotation,node?require('./rhythm-beaming.js'):root?.CodaRhythmBeaming);
 if(node)module.exports=api;if(root)root.CodaDanceRhythmGame=api;
})(typeof window==='undefined'?null:window,function(engineModule,notation,beaming){
 'use strict';
 const ARROWS=Object.freeze({left:'←',down:'↓',up:'↑',right:'→'});
 const DIRECTIONS=Object.freeze(Object.keys(ARROWS));
 const MODES=Object.freeze([{id:'easy',title:'Easy',help:'One step on the beat.'},{id:'normal',title:'Normal',help:'Add steps between the beats.'},{id:'hard',title:'Hard',help:'Quick steps and surprise rhythms.'}].map(Object.freeze));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function create(api={}){
  const doc=api.document||api.host?.ownerDocument||document,win=doc.defaultView;
  if(!engineModule?.create)throw Error('The dance rhythm engine could not load.');
  const ownHost=!api.host,host=api.host||doc.createElement('section');if(ownHost)doc.body.append(host);
  host.classList.add('dance-rhythm-game');host.hidden=true;host.setAttribute('aria-label','DJ line dance');
  let opened=false,destroyed=false,phase='closed',mode='easy',engine=null,state=null,frame=0,priorFocus=null,finished=false,runId=null;
  let audio=null,master=null,audioStart=0,nextClick=-4,voices=new Set(),feedbackTimer=0,lastPointer=null,music=true;
  let canvas=null,ctx=null,scoreText=null,feedbackText=null,countText=null,beatText=null,progress=null,statusText='',nextCue=0;
  const held=new Set(),clock=()=>typeof api.now==='function'?api.now():win.performance.now()/1000;
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(text,action,name,value='')=>{const item=node('button','',text);item.type='button';if(name)item.setAttribute('data-dance-'+name,value);item.onclick=action;return item;};
  const allowed=()=>{try{return api.canPlay?.()!==false;}catch{return false;}};
  function getState(){return {open:opened,phase,difficulty:mode,runId,music,audioPlaying:!!audio,engine:engine?.getState()||state,lastFeedback:statusText};}
  function changed(){api.onChange?.(getState());}
  function safeCallback(name,...args){try{return api[name]?.(...args);}catch(error){win.console?.error?.('Dance callback failed:',error);return false;}}
  function stopAudio(){
   for(const voice of voices)try{voice.stop();}catch{}voices.clear();
   if(audio){const old=audio;audio=null;master=null;old.close().catch(()=>{});}
  }
  function tone(frequency,at,duration,gain=.035,type='sine'){
   if(!audio||!master||!music)return;
   try{const context=audio,osc=context.createOscillator(),envelope=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,at);envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(gain,at+.006);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(envelope).connect(master);voices.add(osc);osc.onended=()=>{voices.delete(osc);try{osc.disconnect();envelope.disconnect();}catch{}};osc.start(at);osc.stop(at+duration+.012);}catch{}
  }
  function startAudio(startTime){
   stopAudio();const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;if(!Constructor)return;
   try{audio=new Constructor();master=audio.createGain();master.gain.value=.7;master.connect(audio.destination);audioStart=audio.currentTime-startTime;audio.resume().catch(()=>{});}catch{stopAudio();}
  }
  function scheduleAudio(now){
   if(!audio||!state)return;const beatSeconds=state.beatSeconds;
   while(nextClick<state.chart.totalBeats&&nextClick<=state.beat+.18/beatSeconds){
    const due=audioStart+now+(nextClick-state.beat)*beatSeconds;if(due<audio.currentTime-.08){nextClick++;continue;}
    const at=Math.max(audio.currentTime+.004,due),barBeat=((nextClick%4)+4)%4;
    tone(barBeat===0?1100:800,at,.04,nextClick<0?.047:.024);
    if(nextClick>=0){const chord=[130.81,174.61,196,164.81][Math.floor(nextClick/8)%4];tone(chord,at,.18,barBeat===0?.055:.035,'triangle');if(barBeat===1||barBeat===3){tone(150,at,.08,.028,'square');tone(940,at,.035,.012);}if(nextClick%2===0)tone(chord*2,at+.05,.22,.016,'triangle');}
    nextClick++;
   }
  }
  function header(title){const top=node('header','dance-rhythm-heading');top.append(node('h2','',title),button('×',()=>close('exit'),'close'));top.querySelector('button').setAttribute('aria-label','Exit dance game');host.append(top);}
  function renderMenu(){
   host.classList.remove('is-playing');
   phase='menu';state=null;engine?.destroy();engine=null;stopAudio();win.cancelAnimationFrame(frame);host.replaceChildren();header('DJ line dance');
   host.append(node('p','dance-rhythm-help','Press the matching arrow when its note reaches the glowing line. Tap once for each note.'));
   const choices=node('div','dance-rhythm-modes');for(const option of MODES){const choice=button('',()=>start(option.id),'mode',option.id);choice.append(node('strong','',option.title),node('span','',option.help));choices.append(choice);}host.append(choices);
   host.append(node('p','dance-rhythm-small','Keyboard: arrow keys. Phone: tap the arrow buttons. Miss a step? Get back up and keep dancing!'));
   changed();host.querySelector('[data-dance-mode]')?.focus({preventScroll:true});position();
  }
  function renderGame(){
   host.classList.add('is-playing');
   host.replaceChildren();header('DJ line dance');const line=node('div','dance-rhythm-stats');scoreText=node('span','','Score 0');beatText=node('span','','8 bars');line.append(scoreText,beatText);host.append(line);
   const score=node('div','dance-rhythm-score');canvas=node('canvas','dance-rhythm-staff');canvas.width=680;canvas.height=177;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Rhythm notes and direction arrows scroll left toward the glowing line.');ctx=canvas.getContext('2d');score.append(canvas);countText=node('div','dance-rhythm-count');countText.setAttribute('aria-live','off');score.append(countText);host.append(score);
   const bottom=node('div','dance-rhythm-status');feedbackText=node('p','dance-rhythm-feedback','Get ready…');feedbackText.setAttribute('role','status');progress=node('progress');progress.max=32;progress.value=0;progress.setAttribute('aria-label','Dance progress');bottom.append(feedbackText,progress);host.append(bottom);
   const settings=node('div','dance-rhythm-options'),label=node('label'),toggle=node('input');toggle.type='checkbox';toggle.checked=music;toggle.dataset.danceMusic='';toggle.onchange=()=>{music=toggle.checked;if(master)master.gain.setTargetAtTime(music?.7:0,audio.currentTime,.025);changed();};label.append(toggle,doc.createTextNode('Music & beat'));settings.append(label);host.append(settings);
   const controls=node('div','dance-rhythm-controls');controls.setAttribute('role','group');controls.setAttribute('aria-label','Dance arrows');
   for(const direction of ['up','left','right','down']){const control=button(ARROWS[direction],null,'arrow',direction);control.setAttribute('aria-label',direction+' dance step');control.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();lastPointer={id:event.pointerId,direction};control.setPointerCapture?.(event.pointerId);control.classList.add('is-pressed');input(direction);});for(const type of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(type,()=>{control.classList.remove('is-pressed');lastPointer=null;});controls.append(control);}host.append(controls);
   notation?.load?.(doc);position();
  }
  function position(){
   if(!opened)return;host.style.removeProperty('left');host.style.removeProperty('top');host.style.removeProperty('transform');
   // Keep the play panel stable while the camera fits dancers below it.
   if(phase!=='menu'){host.style.top='8px';return;}
   const anchor=api.getAnchor?.();if(!anchor||!Number.isFinite(anchor.x)||!Number.isFinite(anchor.y))return;
   const rect=host.getBoundingClientRect(),width=rect.width,height=rect.height,left=clamp(anchor.x-width/2,8,Math.max(8,win.innerWidth-width-8));
   host.style.left=left+'px';host.style.top=clamp(anchor.y-height-14,8,Math.max(8,win.innerHeight-height-8))+'px';host.style.transform='none';
  }
  function markFeedback(text,kind){statusText=text;if(feedbackText){feedbackText.textContent=text;feedbackText.dataset.judgment=kind;}win.clearTimeout(feedbackTimer);feedbackTimer=win.setTimeout(()=>{if(feedbackText&&phase==='playing'){feedbackText.textContent='Keep the beat!';feedbackText.removeAttribute('data-judgment');}},650);}
  function handleEvents(events){
   for(const event of events||[]){
    if(event.type==='hit'){markFeedback(event.judgment==='perfect'?'Perfect!':'Good step!','hit');safeCallback('onStep',{...event,success:true});}
    else if(event.type==='miss'||event.type==='extra'){markFeedback('Whoops! Get back up.','miss');safeCallback('onMiss',{...event,success:false});}
    else if(event.type==='complete')finish();
   }
  }
  function start(difficulty='easy'){
   if(destroyed||!opened||!allowed())return false;mode=MODES.some(item=>item.id===difficulty)?difficulty:'easy';
   runId=win.crypto?.randomUUID?.()||'dance-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   engine?.destroy();engine=engineModule.create({difficulty:mode,seed:api.seed??Math.floor(Math.random()*0xffffffff)});finished=false;held.clear();statusText='Get ready…';nextClick=-4;nextCue=0;
   const now=clock();engine.start(now);state=engine.getState();phase='countin';startAudio(now);renderGame();const ready=safeCallback('onStart',{runId,difficulty:mode,chart:state.chart,bpm:state.bpm});
   if(ready===false){renderMenu();const help=node('p','dance-rhythm-feedback','The dance floor needs a little more space. Try again in a moment.');help.setAttribute('role','status');host.append(help);return false;}
   win.cancelAnimationFrame(frame);tick();changed();return true;
  }
  function input(direction){
   if(!opened||!engine||!['countin','playing'].includes(phase)||!allowed())return false;
   const result=engine.input(direction,clock());state=result?.state||engine.getState();handleEvents(result?.events);updateStatus();return true;
  }
  function updateStatus(){
   if(!state)return;if(scoreText)scoreText.textContent='Score '+state.score+' · Streak '+state.streak;
   if(beatText)beatText.textContent=state.phase==='countin'?mode+' · '+state.bpm+' BPM':'Bar '+Math.min(state.chart.bars,Math.floor(Math.max(0,state.beat)/4)+1)+' / '+state.chart.bars;
   if(progress)progress.value=clamp(state.beat,0,state.chart.totalBeats);if(countText){countText.textContent=state.countIn?.active?state.countIn.label:'';countText.hidden=!state.countIn?.active;}
  }
  function draw(){
   if(!ctx||!state)return;const width=canvas.width,height=canvas.height,target=122,scale=mode==='hard'?82:90,beat=state.beat,y=86;
   ctx.clearRect(0,0,width,height);ctx.fillStyle='#101a2ced';ctx.fillRect(0,0,width,height);
   ctx.strokeStyle='#9bb1cb';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(73,y);ctx.lineTo(width-12,y);ctx.stroke();
   notation?.drawTimeSignature?.(ctx,{x:35,y:69,fontSize:52,meter:'4/4',color:'#f4e9d4'});
   const notes=(state.events||state.chart.events).map(note=>({...note,onset:note.beat,judgement:note.status==='hit'?'hit':['wrong','miss'].includes(note.status)?'miss':null}));
   const xFor=note=>target+(note.beat-beat)*scale;
   ctx.save();ctx.beginPath();ctx.rect(75,8,width-84,height-12);ctx.clip();
   for(let bar=0;bar<=state.chart.bars;bar++){const x=target+(bar*4-beat)*scale-17;if(x<72||x>width)continue;ctx.strokeStyle='#768ba5';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-25);ctx.lineTo(x,y+25);ctx.stroke();if(bar<state.chart.bars){ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillStyle='#b8cce0';ctx.fillText(String(bar+1),x+5,24);}}
   beaming?.draw?.(ctx,{notes,meter:'4/4',fontSize:52,y,left:76,right:width-10,top:8,height:height-12,xForNote:xFor});
   ctx.font='bold 36px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   for(const note of notes){const x=xFor(note);if(x<78||x>width-10||note.rest)continue;ctx.fillStyle=note.status==='hit'?'#a5ffd5':['miss','wrong'].includes(note.status)?'#ff94b0':'#f4eaff';ctx.fillText(ARROWS[note.direction]||'',x,139);}
   ctx.restore();ctx.save();ctx.shadowColor='#86ffe0';ctx.shadowBlur=9;ctx.strokeStyle='#99ffdf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(target,16);ctx.lineTo(target,160);ctx.stroke();ctx.restore();ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillStyle='#b5ffe6';ctx.fillText('STEP',target,174);
   canvas.dataset.visibleNotes=String(notes.filter(note=>xFor(note)>=76&&xFor(note)<=width-10).length);canvas.dataset.beamGroups=String(beaming?.plan?.(notes,{meter:'4/4'})?.groups.length||0);
  }
  function tick(){
   if(!opened||destroyed||!engine||finished)return;if(!allowed()){close('profile-changed');return;}
   const now=clock(),result=engine.update(now);state=result?.state||engine.getState();phase=state.phase;handleEvents(result?.events);
   if(finished)return;
   while(nextCue<state.chart.events.length&&state.chart.events[nextCue].beat<=state.beat){const note=state.chart.events[nextCue++];if(!note.rest)safeCallback('onCue',{direction:note.direction,note:{...note},beat:note.beat});}
   scheduleAudio(now);updateStatus();draw();position();frame=win.requestAnimationFrame(tick);
  }
  function finish(){
   host.classList.remove('is-playing');
   if(finished||!opened)return;finished=true;phase='result';state=engine.getState();win.cancelAnimationFrame(frame);stopAudio();held.clear();win.clearTimeout(feedbackTimer);host.replaceChildren();header('Dance complete!');
   const accuracy=Math.round((state.accuracy||0)*100);host.append(node('p','dance-rhythm-result',state.misses===0?'Perfect dance!':accuracy>=80?'Great dancing!':'Keep practising—you can do it!'));
   host.append(node('p','dance-rhythm-help','Score '+state.score+' · '+state.hits+' steps right · '+accuracy+'% · Best streak '+state.bestStreak));
   const reward=safeCallback('onFinish',{runId,complete:state.complete,difficulty:mode,score:state.score,hits:state.hits,misses:state.misses,accuracy:state.accuracy,bestStreak:state.bestStreak,perfect:state.perfect,bars:state.chart.bars,notesTotal:state.notesTotal,perfectHits:state.perfectHits,goodHits:state.goodHits,wrongInputs:state.wrongInputs,lateMisses:state.lateMisses,extras:state.extras});
   if(reward?.ok&&reward.amount>0){
    const line=node('p','dance-rhythm-rewards','+'+reward.amount+' XP'+(reward.unlocks?.length?' · Unlocked: '+reward.unlocks.join(', '):''));line.setAttribute('role','status');host.append(line);
   }else if(reward?.ok===false){const line=node('p','dance-rhythm-small',reward.error||'Progress could not save. Try another dance.');line.setAttribute('role','status');host.append(line);}
   const choices=node('div','dance-rhythm-result-actions');choices.append(button('Dance again',()=>start(mode),'again'),button('Choose difficulty',renderMenu,'choose'),button('Back to the arcade',()=>close('finished'),'done'));host.append(choices);position();changed();host.querySelector('[data-dance-again]')?.focus({preventScroll:true});
  }
  function open(options={}){
   if(destroyed||!allowed())return false;if(opened)return true;priorFocus=doc.activeElement;opened=true;host.hidden=false;host.dataset.danceOpen='true';music=options.music!==false;renderMenu();safeCallback('onOpen',{});return true;
  }
  function close(reason='exit'){
   if(!opened)return false;opened=false;phase='closed';win.cancelAnimationFrame(frame);win.clearTimeout(feedbackTimer);stopAudio();engine?.destroy();engine=null;held.clear();lastPointer=null;host.hidden=true;host.dataset.danceOpen='false';host.replaceChildren();canvas=ctx=scoreText=feedbackText=countText=beatText=progress=null;safeCallback('onClose',{reason});if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});changed();return true;
  }
  function keydown(event){
   if(!opened||event.ctrlKey||event.metaKey||event.altKey)return;const key=String(event.key).toLowerCase();
   if(key==='escape'){event.preventDefault();event.stopImmediatePropagation();close('escape');return;}
   const direction={arrowleft:'left',arrowright:'right',arrowup:'up',arrowdown:'down'}[key];
   if(!direction&&!['w','a','s','d',' '].includes(key))return;event.preventDefault();event.stopImmediatePropagation();if(!direction||event.repeat||held.has(direction))return;held.add(direction);host.querySelector('[data-dance-arrow="'+direction+'"]')?.classList.add('is-pressed');input(direction);
  }
  function keyup(event){const direction={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[event.key];if(direction){held.delete(direction);host.querySelector('[data-dance-arrow="'+direction+'"]')?.classList.remove('is-pressed');if(opened){event.preventDefault();event.stopImmediatePropagation();}}}
  function blur(){held.clear();for(const control of host.querySelectorAll('.is-pressed'))control.classList.remove('is-pressed');if(opened&&['countin','playing'].includes(phase))close('paused');}
  function contextmenu(event){if(opened){event.preventDefault();event.stopPropagation();}}
  function visibility(){if(doc.hidden)blur();}
  doc.addEventListener('keydown',keydown,true);doc.addEventListener('keyup',keyup,true);doc.addEventListener('visibilitychange',visibility);win.addEventListener('blur',blur);win.addEventListener('resize',position);host.addEventListener('contextmenu',contextmenu);host.addEventListener('dragstart',contextmenu);
  return {open,start,input,close,getState,getBounds:()=>opened?host.getBoundingClientRect():null,reposition:position,destroy(){if(destroyed)return;close('destroyed');destroyed=true;doc.removeEventListener('keydown',keydown,true);doc.removeEventListener('keyup',keyup,true);doc.removeEventListener('visibilitychange',visibility);win.removeEventListener('blur',blur);win.removeEventListener('resize',position);host.removeEventListener('contextmenu',contextmenu);host.removeEventListener('dragstart',contextmenu);if(ownHost)host.remove();}};
 }
 return Object.freeze({ARROWS,DIRECTIONS,MODES,create});
});
