/* Time signatures: written note values and the pulse are related, but different. */
(function(root,factory){const notation=typeof module==='object'&&module.exports?require('./music-notation.js'):root?.CodaMusicNotation;const api=factory(notation);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaTimeSignatureLesson=api;})(typeof window==='undefined'?null:window,function(notation){
 'use strict';
 const LESSON=Object.freeze({id:'time-signatures',title:'Time signatures',total:8});
 const METERS=Object.freeze({
  '4/4':Object.freeze({id:'4/4',top:4,bottom:4,pulseBeats:1,pulses:4,barBeats:4,subdivisionBeats:1,labels:['ONE','two','three','four'],name:'Four-four'}),
  '6/8':Object.freeze({id:'6/8',top:6,bottom:8,pulseBeats:1.5,pulses:2,barBeats:3,subdivisionBeats:.5,labels:['ONE','la','li','TWO','la','li'],name:'Six-eight'}),
  '2/2':Object.freeze({id:'2/2',top:2,bottom:2,pulseBeats:2,pulses:2,barBeats:4,subdivisionBeats:1,labels:['ONE','and','TWO','and'],name:'Cut time'})
 });
 const VALUES=Object.freeze([{beats:4,name:'whole'},{beats:2,name:'half'},{beats:1.5,name:'dotted quarter'},{beats:1,name:'quarter'},{beats:.5,name:'eighth'},{beats:.25,name:'sixteenth'}].map(Object.freeze));
 const STEPS=Object.freeze([
  {id:'top-number',meter:'4/4',kind:'choice',prompt:'How many beats fit in this bar?',teach:'A bar is a group of beats. Count four taps.',answers:['4 beats','1 beat','2 beats'],correct:0,hint:'Count the four boxes.',success:'Yes! Four beats.'},
  {id:'bottom-number',meter:'4/4',kind:'choice',prompt:'Which note gets one beat here?',teach:'This is a quarter note. It gets one beat here.',noteExample:1,noteLabel:'Quarter note',answers:['Half note','Quarter note','Eighth note'],correct:1,hint:'The picture shows a quarter note.',success:'Yes! A quarter note.'},
  {id:'build-four',meter:'4/4',kind:'build',prompt:'Add 4 quarter notes.',teach:'Put one quarter note on each beat.',recipe:[1,1,1,1],hint:'Tap Add note four times.',success:'Yes! Your bar is full.'},
  {id:'six-eighths',meter:'6/8',kind:'choice',prompt:'How many little parts fit here?',teach:'These six little sounds travel in two groups.',noteExample:.5,noteLabel:'Eighth note',answers:['4 little parts','8 little parts','6 little parts'],correct:2,hint:'Count all six boxes.',success:'Yes! Six little parts.'},
  {id:'compound-pulse',meter:'6/8',kind:'choice',prompt:'How many BIG beats do you feel?',teach:'Feel two big beats: ONE-la-li, TWO-la-li.',answers:['2 big beats','6 big beats','3 big beats'],correct:0,hint:'Tap on ONE and TWO.',success:'Yes! Two big beats.'},
  {id:'build-six',meter:'6/8',kind:'build',prompt:'Add 6 eighth notes.',teach:'Put three eighth notes here. Put three there.',recipe:[.5,.5,.5,.5,.5,.5],hint:'Fill both groups of three.',success:'Yes! Two groups of three.'},
  {id:'cut-time',meter:'2/2',kind:'choice',prompt:'Which note gets one BIG beat here?',teach:'Cut time has two big beats. Each is a half note.',noteExample:2,noteLabel:'Half note',answers:['Quarter note','Half note','Eighth note'],correct:1,hint:'The picture shows a half note.',success:'Yes! A half note.'},
  {id:'build-cut',meter:'2/2',kind:'build',prompt:'Add 2 half notes.',teach:'One half note for ONE. One for TWO.',recipe:[2,2],hint:'Tap Add note twice.',success:'Yes! Your bar is full.'}
 ].map(step=>Object.freeze({...step,answers:step.answers?Object.freeze(step.answers):undefined,recipe:step.recipe?Object.freeze(step.recipe):undefined})));
 function validBar(values,step,steps=STEPS){const item=typeof step==='number'?steps[step]:steps.find(value=>value.id===step);return !!item?.recipe&&Array.isArray(values)&&values.length===item.recipe.length&&values.every((value,index)=>Number.isFinite(value)&&Math.abs(value-item.recipe[index])<1e-8);}
 function pulseSchedule(meter,{bpm=80,bars=2}={}){
  const value=METERS[meter];if(!value)return [];bpm=Number.isFinite(bpm)?Math.max(40,Math.min(160,bpm)):80;bars=Math.max(1,Math.min(4,Math.floor(bars)||1));
  const secondsPerQuarter=60/bpm/value.pulseBeats,perBar=value.barBeats/value.subdivisionBeats,result=[];
  for(let bar=0;bar<bars;bar++)for(let index=0;index<perBar;index++){const onset=index*value.subdivisionBeats,primary=Math.abs(onset/value.pulseBeats-Math.round(onset/value.pulseBeats))<1e-8;result.push({time:(bar*value.barBeats+onset)*secondsPerQuarter,bar,index,primary,accent:index===0,label:value.labels[index]});}
  return result;
 }
 function create(api={}){
  const host=api.host;if(!host)throw Error('A time-signature lesson needs a host.');const doc=host.ownerDocument,win=doc.defaultView,notes=api.notation||notation;
  const steps=()=>api.getSteps?.()||STEPS;
  let section=null,step=0,answered=false,bar=[],message='',correct=null,audio=null,voices=[],timers=[],lastSchedule=[],tapCount=0,destroyed=false,stage='look',hintOpen=false;
  const node=(tag,className,text)=>{const value=doc.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;};
  const button=(label,fn,attributes={})=>{const value=node('button','',label);value.type='button';for(const [key,text]of Object.entries(attributes))value.setAttribute(key,text);value.onclick=event=>{if(api.canRecord?.()===false){feedback('Your profile or lesson changed. Reopen the lesson before continuing.',false);return;}fn(event);};return value;};
  function feedback(text,ok){message=text;correct=ok;const value=section?.querySelector('.signature-feedback');if(value){value.textContent=text;value.dataset.correct=String(ok);}}
  function stopAudio(){for(const timer of timers)win.clearTimeout(timer);timers=[];for(const voice of voices)try{voice.stop();}catch{}voices=[];if(audio){audio.close().catch(()=>{});audio=null;}section?.querySelectorAll('.is-pulse').forEach(value=>value.classList.remove('is-pulse'));const live=section?.querySelector('.signature-count-live');if(live)live.textContent='';}
  function play(){
   stopAudio();lastSchedule=pulseSchedule(steps()[step].meter);tapCount=0;const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;
   if(!Constructor){feedback('Sound is unavailable. Look at the count boxes.',null);return;}
   try{audio=new Constructor();audio.resume().catch(()=>{});const context=audio,start=context.currentTime+.08;
    for(const event of lastSchedule){const at=start+event.time,voice=context.createOscillator(),gain=context.createGain();voice.type='triangle';voice.frequency.value=event.accent?1050:event.primary?840:500;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(event.primary ? .15 : .045,at+.006);gain.gain.exponentialRampToValueAtTime(.0001,at+.07);voice.connect(gain).connect(context.destination);voice.start(at);voice.stop(at+.08);voices.push(voice);
     timers.push(win.setTimeout(()=>{section?.querySelectorAll('.is-pulse').forEach(value=>value.classList.remove('is-pulse'));section?.querySelector('[data-signature-pulse="'+event.index+'"]')?.classList.add('is-pulse');const live=section?.querySelector('.signature-count-live');if(live)live.textContent=event.label;},(at-context.currentTime)*1000));}
    const value=METERS[steps()[step].meter],duration=value.pulses*60/80*2;timers.push(win.setTimeout(()=>{stopAudio();const live=section?.querySelector('.signature-count-live');if(live)live.textContent='';},(duration+.25)*1000));
   }catch{stopAudio();feedback('Sound could not start. Look at the count boxes.',null);}
  }
  function signature(parent,meter){const canvas=node('canvas','signature-symbol');canvas.width=100;canvas.height=116;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',meter==='2/2'?'Cut time sign: two-two':meter+' time signature');const draw=()=>{if(destroyed)return;const g=canvas.getContext('2d');g.clearRect(0,0,100,116);notes.drawTimeSignature(g,{x:50,y:58,meter,fontSize:76,color:'#f6efcf'});};draw();notes.load?.(doc)?.then?.(draw);parent.append(canvas);}
  function markCorrect(){if(answered)return;answered=true;stage='done';message='';correct=true;stopAudio();render(section,{step,answered:true});api.onCorrect?.();section?.querySelector('[data-tutorial-next]')?.focus({preventScroll:true});}
  function answer(index){if(answered)return;const value=steps()[step];if(index!==value.correct){feedback('Try again. You can use a hint.',false);return;}markCorrect();}
  function add(beats){if(answered)return;const value=steps()[step];if(bar.reduce((sum,n)=>sum+n,0)+beats>METERS[value.meter].barBeats+1e-8)return;bar.push(beats);message='';correct=null;render(section,{step,answered});}
  function check(){if(!validBar(bar,step,steps())){feedback('Keep filling the empty spaces.',false);return;}markCorrect();}
  function picture(parent,value){
   const visual=node('div','signature-visual');visual.dataset.signatureMeter=value.meter;
   if(value.visual?.kind==='notation'&&win.CodaEducationNotation){visual.innerHTML=win.CodaEducationNotation.toSVG(value.visual.score);parent.append(visual);return;}
   signature(visual,value.meter);
   if(value.noteExample&&value.id!=='six-eighths'){
    const shown=node('div','signature-note-example');shown.innerHTML=notes.glyphSVG(value.noteExample);shown.append(node('span','',value.noteLabel));visual.append(shown);
   }else{
    const pulse=node('div','signature-pulse-row'),meta=METERS[value.meter];pulse.dataset.signatureMeter=value.meter;pulse.setAttribute('role','img');pulse.setAttribute('aria-label',value.meter==='6/8'?'Two groups of three small parts':value.meter==='2/2'?'Two big beats':'Four beats');
    const groupSize=value.meter==='6/8'?3:value.meter==='2/2'?2:0;let group=pulse;
    meta.labels.forEach((text,index)=>{if(groupSize&&index%groupSize===0){group=node('div','signature-pulse-group');pulse.append(group);}const label=node('span','signature-pulse'+(index*meta.subdivisionBeats%meta.pulseBeats===0?' is-big':''),text);label.dataset.signaturePulse=index;group.append(label);});visual.append(pulse);
   }
   parent.append(visual);
  }
  function resetLearningScroll(){const viewport=section?.closest('.classroom-books');if(viewport)viewport.scrollTop=0;}
  function render(target,state={}){
   if(destroyed)return;
   const requested=Math.max(0,Math.min(steps().length-1,state.step||0)),focus=section?.contains(doc.activeElement)?doc.activeElement:null,focusAdd=focus?.getAttribute('data-signature-add'),focusUndo=focus?.hasAttribute('data-signature-undo');
   if(step!==requested){stopAudio();bar=[];message='';correct=null;tapCount=0;stage='look';hintOpen=false;}
   step=requested;answered=state.answered===true;if(answered)stage='done';section=target;section.replaceChildren();section.classList.add('time-signature-activity');section.dataset.signatureStage=stage;const value=steps()[step],meta=METERS[value.meter];
   const prompt=node('h3','signature-main-prompt',stage==='look'?value.teach:stage==='done'?value.success:value.prompt);prompt.tabIndex=-1;section.append(prompt);
   if(stage!=='look'&&value.kind==='build'){
    const pattern=node('div','signature-bar');pattern.setAttribute('aria-label','Fill '+value.recipe.length+' note spaces');
    value.recipe.forEach((beats,index)=>{const filled=answered||index<bar.length,cell=node('div','signature-bar-note signature-target-slot'+(filled?' is-filled':' is-empty'));cell.innerHTML=notes.glyphSVG(beats);if(value.meter==='6/8'&&index===3)cell.classList.add('signature-group-start');cell.dataset.signatureSlot=index;cell.setAttribute('role','img');cell.setAttribute('aria-label','Note '+(index+1)+(filled?' added':' empty'));pattern.append(cell);});section.append(pattern);
   }else picture(section,value);
   if(stage==='look'){
    const actions=node('div','signature-look-actions');actions.append(button('Listen',play,{'data-signature-listen':value.meter}),button('Your turn',()=>{stopAudio();stage='try';hintOpen=false;message='';render(section,{step,answered:false});section.querySelector('.signature-main-prompt')?.focus({preventScroll:true});},{'data-signature-try':''}));section.append(actions,node('p','signature-count-live',''));resetLearningScroll();return;
   }
   if(stage==='done'){
    const next=button(step===steps().length-1?'Try the quiz':'Next',()=>api.onNext?.(),{'data-tutorial-next':''});section.append(next);resetLearningScroll();return;
   }
   if(value.kind==='choice'){
    const answers=node('div','signature-answers');value.answers.forEach((text,index)=>answers.append(button(text,()=>answer(index),{'data-signature-answer':index})));section.append(answers);
   }else{
    const required=VALUES.find(item=>item.beats===value.recipe[0]),full=bar.length===value.recipe.length;
    const choices=node('div','signature-primary-note'),addButton=button('',()=>add(required.beats),{'aria-label':'Add '+required.name+' note','data-signature-add':required.beats});addButton.innerHTML=notes.glyphSVG(required.beats);addButton.append(node('span','','Add note'));addButton.disabled=full;choices.append(addButton);section.append(choices);
    const tools=node('div','signature-build-tools'),undo=button('Undo',()=>{bar.pop();message='';render(section,{step,answered:false});},{'data-signature-undo':''});undo.disabled=!bar.length;tools.append(undo);
    if(full)tools.append(button('Check',check,{'data-signature-check':''}));section.append(tools);
   }
   const help=node('div','signature-help'),hint=button(hintOpen?'Hide hint':'Hint',()=>{hintOpen=!hintOpen;render(section,{step,answered:false});},{'data-signature-hint':''});hint.setAttribute('aria-expanded',String(hintOpen));help.append(hint);section.append(help);if(hintOpen){section.append(node('p','signature-hint',value.hint));section.append(button('Listen again',play,{'data-signature-listen':value.meter}));}
   const status=node('p','tutorial-feedback signature-feedback',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.dataset.correct=String(correct);section.append(status);
   resetLearningScroll();
   if(focusAdd!==null&&focusAdd!==undefined||focusUndo){const nextFocus=section.querySelector('[data-signature-add]:not(:disabled)')||section.querySelector('[data-signature-check]');nextFocus?.focus({preventScroll:true});}
  }
  return {render,stopAudio,reset(){stopAudio();bar=[];step=-1;message='';answered=false;correct=null;tapCount=0;stage='look';hintOpen=false;},getState:()=>({step,stage,hintOpen,bar:bar.slice(),tapCount,audioPlaying:!!audio,schedule:lastSchedule.map(event=>({...event}))}),destroy(){stopAudio();destroyed=true;}};
 }
 return {LESSON,METERS,VALUES,STEPS,validBar,pulseSchedule,create};
});
