/* The DJ's line-dance game. Timing lives in the pure engine; this view owns
 * notation, touch/keyboard input and short-lived Web Audio voices. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const api=factory(node?require('./dance-rhythm-engine.js'):root?.CodaDanceRhythmEngine,node?require('./music-notation.js'):root?.CodaMusicNotation,node?require('./rhythm-beaming.js'):root?.CodaRhythmBeaming,node?require('./dance-campaign.js'):root?.CodaDanceCampaign,node?require('./dance-song-audio.js'):root?.CodaDanceSongAudio);
 if(node)module.exports=api;if(root)root.CodaDanceRhythmGame=api;
})(typeof window==='undefined'?null:window,function(engineModule,notation,beaming,campaign,songAudio){
 'use strict';
 const ARROWS=Object.freeze({left:'←',down:'↓',up:'↑',right:'→'});
 const DIRECTIONS=Object.freeze(Object.keys(ARROWS));
 const MODES=Object.freeze([{id:'normal',title:'Normal',help:'Steady steps · 80 BPM'},{id:'hard',title:'Hard',help:'Steps between beats · 92 BPM'},{id:'extreme',title:'Extreme',help:'Syncopated steps · 88 BPM'}].map(Object.freeze));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function create(api={}){
  const doc=api.document||api.host?.ownerDocument||document,win=doc.defaultView;
  if(!engineModule?.create)throw Error('The dance rhythm engine could not load.');
  const ownHost=!api.host,host=api.host||doc.createElement('section');if(ownHost)doc.body.append(host);
  host.classList.add('dance-rhythm-game');host.hidden=true;host.setAttribute('aria-label','DJ line dance');
  let opened=false,destroyed=false,phase='closed',mode='normal',stageId=campaign.STAGES[0].id,watching=false,menuTier='normal',nextMusicBeat=0,nextRhythmCue=0,engine=null,state=null,frame=0,priorFocus=null,finished=false,runId=null;
  let audio=null,master=null,musicBus=null,clickBus=null,audioStart=0,nextClick=-8,voices=new Set(),feedbackTimer=0,lastPointer=null,music=true,metronome=true;
  let nextWatch=0;
  let canvas=null,ctx=null,scoreText=null,feedbackText=null,countText=null,beatText=null,progress=null,statusText='',nextCue=0;
  const held=new Set(),clock=()=>{
   if(typeof api.now==='function')return api.now();
   // Use the audio transport for cues, input judging, scrolling, and beat pulses.
   // Compensate device output latency so visuals follow the sound being heard.
   if(audio){if(audio.state!=='running')return state?.startedAt!==null&&state?.startedAt!==undefined?state.startedAt+(state.elapsed||0):win.performance.now()/1000;return audio.currentTime-audioStart-(audio.baseLatency||0)-(audio.outputLatency||0);}
   return win.performance.now()/1000;
  };
  const node=(tag,className,text)=>{const item=doc.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;};
  const button=(text,action,name,value='')=>{const item=node('button','',text);item.type='button';if(name)item.setAttribute('data-dance-'+name,value);item.onclick=action;return item;};
  const allowed=()=>{try{return api.canPlay?.()!==false;}catch{return false;}};
  function getState(){return {open:opened,phase,difficulty:mode,stageId,watching,runId,music,metronome,audioPlaying:audio?.state==='running',clockSource:typeof api.now==='function'?'custom':audio?'audio':'performance',engine:engine?.getState()||state,lastFeedback:statusText};}
  function changed(){api.onChange?.(getState());}
  function safeCallback(name,...args){try{return api[name]?.(...args);}catch(error){win.console?.error?.('Dance callback failed:',error);return false;}}
  function stopAudio(){
   for(const voice of voices)try{voice.stop();}catch{}voices.clear();
   if(audio){const old=audio;audio=null;master=null;musicBus=null;clickBus=null;old.close().catch(()=>{});}
  }
  function tone(frequency,at,duration,gain=.035,type='sine',channel='music',slide=null,part='backing'){
   if(!audio||!master||(channel==='click'?!metronome:!music))return;
   try{const context=audio,osc=context.createOscillator(),envelope=context.createGain();osc.type=type;osc.codaDancePart=part;osc.codaDanceGain=gain;osc.frequency.setValueAtTime(frequency,at);if(slide)osc.frequency.exponentialRampToValueAtTime(slide,at+duration*.75);envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(gain,at+.006);envelope.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(envelope).connect(channel==='click'?clickBus:musicBus);voices.add(osc);osc.onended=()=>{voices.delete(osc);try{osc.disconnect();envelope.disconnect();}catch{}};osc.start(at);osc.stop(at+duration+.012);}catch{}
  }
  function startAudio(startTime){
   stopAudio();const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;if(!Constructor)return;
   try{audio=new Constructor();master=audio.createGain();master.gain.value=.7;master.connect(audio.destination);musicBus=audio.createGain();musicBus.gain.value=music?1:0;musicBus.connect(master);clickBus=audio.createGain();clickBus.gain.value=metronome?1:0;clickBus.connect(master);audioStart=audio.currentTime-startTime;audio.resume().catch(()=>{});}catch{stopAudio();}
  }
  function scheduleAudio(now){
   if(!audio||audio.state!=='running'||!state)return;
   const chart=state.chart,seconds=state.beatSeconds,until=Math.min(chart.totalBeats,state.beat+.2/seconds),when=beat=>audioStart+state.startedAt+(beat+chart.countInBeats)*seconds;
   while(nextClick/2<=until&&nextClick/2<chart.totalBeats){
    const beat=nextClick++/2,bar=((beat%chart.beatsPerBar)+chart.beatsPerBar)%chart.beatsPerBar,pulse=chart.pulses.findIndex(value=>Math.abs(value-bar)<1e-6),due=when(beat);
    if(pulse>=0&&due>=audio.currentTime-.08)tone(pulse===0?1400:1000,Math.max(audio.currentTime+.004,due),.035,beat<0?.075:.055,'sine','click');
   }
   for(const event of campaign.musicEvents(stageId,nextMusicBeat,until)){
    const due=when(event.beat);if(due<audio.currentTime-.08)continue;const at=Math.max(audio.currentTime+.004,due),duration=event.duration*seconds;
    if(music)songAudio.schedule(audio,event,at,duration,musicBus,campaign.stageFor(stageId).style.id,(source,nodes)=>{
     voices.add(source);source.onended=()=>{voices.delete(source);try{source.disconnect();for(const node of nodes)node.disconnect();}catch{}};
    });
   }
   nextMusicBeat=Math.max(nextMusicBeat,until);
   // A soft woodblock-like synth doubles the exact notated tapping rhythm.
   while(nextRhythmCue<chart.events.length&&chart.events[nextRhythmCue].beat<until){
    const note=chart.events[nextRhythmCue++];if(note.rest)continue;const due=when(note.beat);if(due<audio.currentTime-.08)continue;
    tone(440*2**((campaign.stageFor(stageId).tonic+12-69)/12),Math.max(audio.currentTime+.004,due),Math.min(.11,note.duration*seconds*.5),.022,'sine','music',null,'rhythm');
   }
  }
  function savedProgress(){try{return api.getProgress?.()||campaign.progress([]);}catch{return campaign.progress([]);}}

  function header(title){const top=node('header','dance-rhythm-heading');top.append(node('h2','',title),button('×',()=>close('exit'),'close'));top.querySelector('button').setAttribute('aria-label','Exit dance game');host.append(top);}
  function renderMenu(){
   host.classList.remove('is-playing');phase='menu';host.classList.remove('is-watching');state=null;engine?.destroy();engine=null;stopAudio();win.cancelAnimationFrame(frame);host.replaceChildren();header('DJ line dance');
   const saved=savedProgress();host.append(node('p','dance-rhythm-help','Ten stages per difficulty · 16 bars each · Score 80% to pass. A perfect score unlocks the song in the jukebox.'));
   const choices=node('div','dance-rhythm-modes');for(const option of MODES){const tier=saved.tiers.find(item=>item.difficulty===option.id),choice=button('',()=>{menuTier=option.id;renderMenu();},'mode',option.id);choice.disabled=!tier?.unlocked;choice.setAttribute('aria-pressed',String(menuTier===option.id));choice.append(node('strong','',option.title),node('span','',tier?.unlocked?tier.passed.length+' / 10 passed':'Pass all ten '+MODES[MODES.findIndex(m=>m.id===option.id)-1].title+' stages'));choices.append(choice);}host.append(choices);
   const tier=saved.tiers.find(item=>item.difficulty===menuTier)||saved.tiers[0],list=node('div','dance-stage-list');
   for(const stage of campaign.STAGES){const row=node('div','dance-stage-row'),passed=tier.passed.includes(stage.id),play=button((stage.index+1)+'. '+stage.title+' · '+stage.style.label+' · '+stage.meter+(passed?' · Passed':''),()=>start(menuTier,stage.id),'stage',stage.id);play.disabled=!campaign.canPlay(menuTier,stage.id,saved);row.append(play);if(passed)row.append(button('Watch dance',()=>start(menuTier,stage.id,true),'watch',stage.id));if(saved.songs.includes(stage.id))row.append(node('span','dance-song-earned','♫ Song unlocked'));list.append(row);}host.append(list);
   host.append(node('p','dance-rhythm-small','Arrow keys or touch arrows · Watch unlocked dances for fun, without scoring.'));changed();position();
  }

  function renderGame(){
   host.classList.add('is-playing');host.classList.toggle('is-watching',watching);
   host.replaceChildren();header((watching?'Watching · ':'')+campaign.stageFor(stageId).title);const line=node('div','dance-rhythm-stats');scoreText=node('span','','Score 0');beatText=node('span','','16 bars');line.append(scoreText,beatText);host.append(line);
   const score=node('div','dance-rhythm-score');canvas=node('canvas','dance-rhythm-staff');canvas.width=680;canvas.height=220;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Rhythm notes and direction arrows scroll left toward the glowing line.');ctx=canvas.getContext('2d');score.append(canvas);countText=node('div','dance-rhythm-count');countText.setAttribute('aria-live','off');score.append(countText);host.append(score);
   const bottom=node('div','dance-rhythm-status');feedbackText=node('p','dance-rhythm-feedback','Get ready…');feedbackText.setAttribute('role','status');progress=node('progress');progress.max=state.chart.totalBeats;progress.value=0;progress.setAttribute('aria-label','Dance progress');bottom.append(feedbackText,progress);host.append(bottom);
   const settings=node('div','dance-rhythm-options');
   for(const [key,title]of [['music','EDM music'],['metronome','Metronome click']]){
    const label=node('label'),toggle=node('input');toggle.type='checkbox';toggle.checked=key==='music'?music:metronome;toggle.setAttribute('data-dance-'+key,'');
    toggle.onchange=()=>{if(key==='music')music=toggle.checked;else metronome=toggle.checked;const bus=key==='music'?musicBus:clickBus;if(bus)bus.gain.setTargetAtTime(toggle.checked?1:0,audio.currentTime,.015);changed();};label.append(toggle,doc.createTextNode(title));settings.append(label);
   }host.append(settings);
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
    if(event.type==='hit'){if(!watching)markFeedback(event.judgment==='perfect'?'Perfect!':'Good step!','hit');safeCallback('onStep',{...event,success:true,watching});}
    else if(event.type==='miss'||event.type==='extra'){markFeedback('Whoops! Get back up.','miss');safeCallback('onMiss',{...event,success:false});}
    else if(event.type==='complete')finish();
   }
  }
  function start(difficulty='normal',selectedStage=campaign.STAGES[0].id,watch=false){
   if(destroyed||!opened||!allowed())return false;mode=MODES.some(item=>item.id===difficulty)?difficulty:'normal';stageId=campaign.stageFor(selectedStage).id;watching=watch===true;menuTier=mode;
   const saved=savedProgress();if(!campaign.canPlay(mode,stageId,saved)||watching&&!saved.tiers.find(t=>t.difficulty===mode)?.passed.includes(stageId))return false;
   runId=win.crypto?.randomUUID?.()||'dance-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   engine?.destroy();engine=engineModule.create({difficulty:mode,stageId});finished=false;held.clear();statusText='Get ready…';nextClick=0;nextCue=0;nextMusicBeat=0;nextRhythmCue=0;nextWatch=0;
   const now=clock();engine.start(now);state=engine.getState();phase='countin';nextClick=-Math.ceil(state.chart.countInBeats*2);startAudio(now);renderGame();const ready=safeCallback('onStart',{runId,difficulty:mode,chart:state.chart,bpm:state.bpm,watching,stageId});
   if(ready===false){renderMenu();const help=node('p','dance-rhythm-feedback','The dance floor needs a little more space. Try again in a moment.');help.setAttribute('role','status');host.append(help);return false;}
   win.cancelAnimationFrame(frame);tick();changed();return true;
  }
  function input(direction){
   if(watching||!opened||!engine||!['countin','playing'].includes(phase)||!allowed())return false;
   const result=engine.input(direction,clock());state=result?.state||engine.getState();handleEvents(result?.events);updateStatus();return true;
  }
  function updateStatus(){
   if(!state)return;if(scoreText)scoreText.textContent=watching?'Watch dance · no score':'Score '+state.score+' / '+(state.notesTotal*100)+' · Streak '+state.streak;
   if(beatText)beatText.textContent=state.phase==='countin'?mode+' · '+state.bpm+' BPM':state.chart.meter+' · Bar '+Math.min(state.chart.bars,Math.floor(Math.max(0,state.beat)/state.chart.beatsPerBar)+1)+' / '+state.chart.bars;
   if(progress)progress.value=clamp(state.beat,0,state.chart.totalBeats);if(countText){countText.textContent=state.countIn?.active?state.countIn.label:'';countText.hidden=!state.countIn?.active;}
  }
  function draw(){
   if(!ctx||!state)return;const measured=Math.max(280,Math.round(canvas.getBoundingClientRect().width));if(canvas.width!==measured)canvas.width=measured;const width=canvas.width,height=canvas.height,target=100,scale=mode==='hard'?100:112,beat=state.beat,y=105;
   ctx.clearRect(0,0,width,height);ctx.fillStyle='rgba(10,21,36,.88)';ctx.fillRect(0,0,width,height);
   ctx.strokeStyle='#9bb1cb';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(73,y);ctx.lineTo(width-12,y);ctx.stroke();
   notation?.drawTimeSignature?.(ctx,{x:30,y:82,fontSize:68,meter:state.chart.meter,color:'#f4e9d4'});
   const notes=(state.events||state.chart.events).map(note=>({...note,onset:note.beat,judgement:note.status==='hit'?'hit':['wrong','miss'].includes(note.status)?'miss':null}));
   const xFor=note=>target+(note.beat-beat)*scale;
   ctx.save();
   const barBeat=((beat%state.chart.beatsPerBar)+state.chart.beatsPerBar+1e-7)%state.chart.beatsPerBar,pulseIndex=Math.max(0,state.chart.pulses.findLastIndex(at=>at<=barBeat)),pulseAge=barBeat-state.chart.pulses[pulseIndex],pulse=Math.max(0,1-pulseAge/.24),downbeat=pulseIndex===0,reduced=win.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
   const strength=reduced?0:pulse;
   ctx.shadowColor=downbeat?'#ffe79b':'#86ffe0';ctx.shadowBlur=8+strength*18;ctx.strokeStyle=downbeat?'#ffe79b':'#99ffdf';ctx.lineWidth=3+strength*(downbeat?7:5);ctx.beginPath();ctx.moveTo(target,25);ctx.lineTo(target,192);ctx.stroke();ctx.restore();
   ctx.save();ctx.beginPath();ctx.rect(75,8,width-84,height-12);ctx.clip();
   for(let bar=0;bar<=state.chart.bars;bar++){const x=target+(bar*state.chart.beatsPerBar-beat)*scale-17;if(x<72||x>width)continue;ctx.strokeStyle='#768ba5';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-25);ctx.lineTo(x,y+25);ctx.stroke();if(bar<state.chart.bars){ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillStyle='#b8cce0';ctx.fillText(String(bar+1),x+5,24);}}
   beaming?.draw?.(ctx,{notes,meter:state.chart.meter,fontSize:74,y,left:76,right:width-10,top:8,height:height-12,xForNote:xFor});
   ctx.font='bold 44px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   for(const note of notes){const x=xFor(note);if(x<78||x>width-10||note.rest)continue;ctx.fillStyle=note.status==='hit'?'#a5ffd5':['miss','wrong'].includes(note.status)?'#ff94b0':'#f4eaff';ctx.fillText(ARROWS[note.direction]||'',x,170);}
   ctx.restore();
   ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillStyle='#eafff5';ctx.fillText('STEP',target,213);
   // A fixed four-beat indicator reinforces the pulse even with reduced motion.
   const current=pulseIndex;for(let i=0;i<state.chart.pulses.length;i++){ctx.fillStyle=i===current?(i===0?'#ffe79b':'#99ffdf'):'#53647a';ctx.fillRect(width-state.chart.pulses.length*16-10+i*16,205,10,6);}
   canvas.dataset.beatPulse=String(pulse);canvas.dataset.beatIndex=String(current);canvas.dataset.notationSize='74';

   canvas.dataset.visibleNotes=String(notes.filter(note=>xFor(note)>=76&&xFor(note)<=width-10).length);canvas.dataset.beamGroups=String(beaming?.plan?.(notes,{meter:state.chart.meter})?.groups.length||0);
  }
  function tick(){
   if(!opened||destroyed||!engine||finished)return;if(!allowed()){close('profile-changed');return;}
   const now=clock();
   if(watching){const live=engine.getState();while(nextWatch<live.notes.length&&live.startedAt+(live.chart.countInBeats+live.notes[nextWatch].beat)*live.beatSeconds<=now){const note=live.notes[nextWatch++],at=live.startedAt+(live.chart.countInBeats+note.beat)*live.beatSeconds;const judged=engine.input(note.direction,at);state=judged.state;handleEvents(judged.events);if(finished)return;}}
   const result=engine.update(now);state=result?.state||engine.getState();phase=state.phase;handleEvents(result?.events);
   if(finished)return;
   while(nextCue<state.chart.events.length&&state.chart.events[nextCue].beat<=state.beat){const note=state.chart.events[nextCue++];if(!note.rest)safeCallback('onCue',{direction:note.direction,note:{...note},beat:note.beat,watching});}
   scheduleAudio(now);updateStatus();draw();position();frame=win.requestAnimationFrame(tick);
  }
  function finish(){
   host.classList.remove('is-playing');
   if(finished||!opened)return;finished=true;phase='result';state=engine.getState();win.cancelAnimationFrame(frame);stopAudio();held.clear();win.clearTimeout(feedbackTimer);host.replaceChildren();header('Dance complete!');
   const percent=campaign.scorePercent({...state,notesTotal:state.notesTotal}),accuracy=Math.floor(percent*10)/10,passed=percent>=80;host.append(node('p','dance-rhythm-result',watching?'Thanks for watching!':state.allPerfect?'Perfect score!':passed?'Stage passed!':'Try again · 80% needed'));
   host.append(node('p','dance-rhythm-help','Score '+state.score+' · '+state.hits+' steps right · '+accuracy+'% · Best streak '+state.bestStreak));
   const reward=watching?null:safeCallback('onFinish',{version:2,stageId,meter:state.chart.meter,watching:false,runId,complete:state.complete,difficulty:mode,score:state.score,hits:state.hits,misses:state.misses,accuracy:state.accuracy,bestStreak:state.bestStreak,perfect:state.perfect,bars:state.chart.bars,notesTotal:state.notesTotal,perfectHits:state.perfectHits,goodHits:state.goodHits,wrongInputs:state.wrongInputs,lateMisses:state.lateMisses,extras:state.extras});
   if(reward?.ok&&reward.amount>0){
    const line=node('p','dance-rhythm-rewards','+'+reward.amount+' XP'+(reward.unlocks?.length?' · Unlocked: '+reward.unlocks.join(', '):''));line.setAttribute('role','status');host.append(line);
   }else if(reward?.ok===false){const line=node('p','dance-rhythm-small',reward.error||'Progress could not save. Try another dance.');line.setAttribute('role','status');host.append(line);}
   const choices=node('div','dance-rhythm-result-actions');choices.append(button(watching?'Watch again':'Try again',()=>start(mode,stageId,watching),'again'),button('Choose stage',renderMenu,'choose'),button('Back to the arcade',()=>close('finished'),'done'));host.append(choices);position();changed();host.querySelector('[data-dance-again]')?.focus({preventScroll:true});
  }
  function open(options={}){
   if(destroyed||!allowed())return false;if(opened)return true;priorFocus=doc.activeElement;opened=true;host.hidden=false;host.dataset.danceOpen='true';music=options.music!==false;metronome=options.metronome!==false;renderMenu();safeCallback('onOpen',{});return true;
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
