/* A self-contained, polyphonic piano room. No samples or network are needed. */
(function(root){
 'use strict';
 const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
 const SHORTCUTS=['a','w','s','e','d','f','t','g','y','h','u','j','k'];
 const CHOPIN_APPEARANCE=Object.freeze({name:'Chopin',skin:'#e6b99d',hair:'#493239',shirt:'#282b42',lowerColor:'#3d3a4a',hairstyle:'long',outfit:'coat',shoes:'oxfords',accessory:'bowtie'});
 const melodyLibrary=typeof module==='object'&&module.exports?require('./piano-melodies.js'):root.CodaPianoMelodies;
 const LESSONS=melodyLibrary?.LESSONS||Object.freeze([]);
 function fitMelodyRegister(source){
  if(!source?.notes?.length)return null;const pitches=source.notes.map(offset=>60+offset),lowest=Math.min(...pitches),highest=Math.max(...pitches),baseMidi=[60,48,72].find(base=>lowest>=base&&highest<=base+21);
  if(baseMidi===undefined)return null;return {baseMidi,octave:baseMidi/12-1,lowest,highest,first:pitches[0],pitches,notes:source.notes.map(offset=>60+offset-baseMidi)};
 }
 const SCALE_KEYS=Object.freeze([
  {id:'c',name:'C',tonic:0,major:['C','D','E','F','G','A','B','C'],minorId:'c',minorName:'C',minor:['C','D','E♭','F','G','A♭','B♭','C']},
  {id:'d-flat',name:'D♭',tonic:1,major:['D♭','E♭','F','G♭','A♭','B♭','C','D♭'],minorId:'c-sharp',minorName:'C♯',minor:['C♯','D♯','E','F♯','G♯','A','B','C♯']},
  {id:'d',name:'D',tonic:2,major:['D','E','F♯','G','A','B','C♯','D'],minorId:'d',minorName:'D',minor:['D','E','F','G','A','B♭','C','D']},
  {id:'e-flat',name:'E♭',tonic:3,major:['E♭','F','G','A♭','B♭','C','D','E♭'],minorId:'e-flat',minorName:'E♭',minor:['E♭','F','G♭','A♭','B♭','C♭','D♭','E♭']},
  {id:'e',name:'E',tonic:4,major:['E','F♯','G♯','A','B','C♯','D♯','E'],minorId:'e',minorName:'E',minor:['E','F♯','G','A','B','C','D','E']},
  {id:'f',name:'F',tonic:5,major:['F','G','A','B♭','C','D','E','F'],minorId:'f',minorName:'F',minor:['F','G','A♭','B♭','C','D♭','E♭','F']},
  {id:'f-sharp',name:'F♯',tonic:6,major:['F♯','G♯','A♯','B','C♯','D♯','E♯','F♯'],minorId:'f-sharp',minorName:'F♯',minor:['F♯','G♯','A','B','C♯','D','E','F♯']},
  {id:'g',name:'G',tonic:7,major:['G','A','B','C','D','E','F♯','G'],minorId:'g',minorName:'G',minor:['G','A','B♭','C','D','E♭','F','G']},
  {id:'a-flat',name:'A♭',tonic:8,major:['A♭','B♭','C','D♭','E♭','F','G','A♭'],minorId:'g-sharp',minorName:'G♯',minor:['G♯','A♯','B','C♯','D♯','E','F♯','G♯']},
  {id:'a',name:'A',tonic:9,major:['A','B','C♯','D','E','F♯','G♯','A'],minorId:'a',minorName:'A',minor:['A','B','C','D','E','F','G','A']},
  {id:'b-flat',name:'B♭',tonic:10,major:['B♭','C','D','E♭','F','G','A','B♭'],minorId:'b-flat',minorName:'B♭',minor:['B♭','C','D♭','E♭','F','G♭','A♭','B♭']},
  {id:'b',name:'B',tonic:11,major:['B','C♯','D♯','E','F♯','G♯','A♯','B'],minorId:'b',minorName:'B',minor:['B','C♯','D','E','F♯','G','A','B']}
 ].map(Object.freeze));
 function buildScale(key,type){
  const major=type==='major',steps=major?[0,2,4,5,7,9,11,12]:[0,2,3,5,7,8,10,12],ascending=steps.map(offset=>key.tonic+offset),upSpellings=major?key.major:key.minor;
  const notes=Object.freeze([...ascending,...ascending.slice(0,-1).reverse()]),spellings=Object.freeze([...upSpellings,...upSpellings.slice(0,-1).reverse()]),name=(major?key.name:key.minorName)+(major?' major':' natural minor');
  const events=Object.freeze(notes.map((offset,index)=>Object.freeze({midi:60+offset,pitchOffset:offset,spelling:spellings[index],index,pitchIndex:index,onset:index,beats:index===notes.length-1?2:1,rest:false})));
  return Object.freeze({id:(major?key.id:key.minorId)+'-'+type,name,type,kind:'scale',meter:'4/4',quarterBpm:100,totalBeats:16,notes,spellings,events,description:'Play '+name+' up to the next note with the same letter, then back down. Follow the glowing keys and the notes on the back wall.'});
 }
 const SCALES=Object.freeze(['major','minor'].flatMap(type=>SCALE_KEYS.map(key=>buildScale(key,type))));
 const INTERVALS=Object.freeze([[1,'minor second'],[2,'major second'],[3,'minor third'],[4,'major third'],[5,'perfect fourth'],[7,'perfect fifth'],[12,'octave']].flatMap(([semitones,name])=>[1,-1].map(direction=>({id:(direction>0?'up-':'down-')+semitones,name:name+' '+(direction>0?'higher':'lower'),start:direction>0?0:12,target:direction>0?semitones:12-semitones}))));
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function noteName(midi){return NOTE_NAMES[midi%12]+(Math.floor(midi/12)-1);}
 function noteLetter(midi){return NOTE_NAMES[midi%12];}
 function keyPositionName(midi,firstMidi){const position=midi-firstMidi;return (position<12?'lower ':position<24?'higher ':'highest ')+noteLetter(midi);}
 function frequency(midi){return 440*Math.pow(2,(midi-69)/12);}
 // Measured from the room painting. Each hit polygon is also the exact live
 // light/name overlay, so a drawn key and the sound underfoot cannot diverge.
 function paintedFloorKeys(){
  const sx=1000/1593,sy=620/987,project=points=>points.map(([x,y])=>[x*sx,y*sy]),offsets=[0,2,4,5,7,9,11,12,14,16,17,19,21,23];
  const front=index=>170+(1427-170)*index/14,back=index=>240+(1358-240)*index/14;
  const keys=offsets.map((offset,index)=>({offset,black:false,polygon:project([[back(index),640],[back(index+1),640],[front(index+1),824],[front(index),824]])}));
  const blacks=[[1,1],[3,2],[6,4],[8,5],[10,6],[13,8],[15,9],[18,11],[20,12],[22,13]];
  return keys.concat(blacks.map(([offset,index])=>{const top=back(index),bottom=top+(front(index)-top)*(742-640)/(824-640);return {offset,black:true,polygon:project([[top-22,640],[top+22,640],[bottom+28,742],[bottom-28,742]])};}));
 }
 function polygonContains(polygon,x,y){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [xi,yi]=polygon[i],[xj,yj]=polygon[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
 function createCodaPianoLab(api={}){
  const host=api.host;if(!host)throw new Error('Piano Lab needs a host element.');
  const doc=host.ownerDocument,win=doc.defaultView||root;
  let opened=false,octave=4,volume=.55,sustain=false,context=null,master=null,voices=new Map(),held=new Map(),pointerKeys=new Map(),computerKeys=new Map();
  let recording=false,recordStart=0,recorded=[],recordHeld=new Map(),playing=false,playTimers=[],recordTimer=null,lesson=null,lessonStep=0,completed=new Set(),priorFocus=null,destroyed=false;
  let roomEditor=null,roomCamera=null,roomFinger=null,roomFrame=0,frameTime=0,roomClock=0,roomKeys=new Set(),roomDest=null,roomPlayer={x:500,y:310,facing:'down',phase:0,jump:0,velocity:0},floorNote=null,showNames=false,keyboardMode='walk',lastWallNote=null;
  let fullscreen=null;
  let challengeMode='free',interval=null,intervalStep=0,mobileView='room',menuOpen=false,dialogueOpen=false,melodyMode='guided',listening=false,dialogueKind='',dialogueTune=null,pendingReward=null,playedChallengeNotes=[],playedChallengeNotation=[],correctRun=0,chopinReaction={emote:'',text:'',until:0,started:0};const learned=new Set();let demoTimers=[],dialogueFocus=null;const touchHeld=new Set(),roomChopin={x:860,y:306,visible:true};
  const joystick={x:0,y:0};
  const companion=win.CodaPetCompanion?.create({getProfile:api.getAvatar,reducedMotion:()=>win.matchMedia?.('(prefers-reduced-motion:reduce)').matches===true});
  const clearJoystick=()=>{joystick.x=joystick.y=0;};
  const joystickState=()=>({...joystick,strength:Math.hypot(joystick.x,joystick.y),active:!!(joystick.x||joystick.y)});
  const mobileLayout=()=>win.matchMedia?.('(max-width:760px), (pointer:coarse)').matches===true;
  const renderer=api.renderer||(typeof win.createCodaCharacterRenderer==='function'?win.createCodaCharacterRenderer({}):null),ROOM={width:1000,height:620,keyX:130,keyY:370,keyW:740,keyH:185};
  const now=()=>win.performance.now()/1000;
  let challengeRun=null,challengeSerial=0;
  function challengeEvent(){if(!challengeRun)return null;const {finished,...event}=challengeRun;return {...event};}
  function beginChallenge(details,restart=true){
   if(!restart)return;
   challengeRun=null;if(!opened||destroyed||roomEditor?.isEditing())return;
   const runId='piano-'+(win.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++challengeSerial).toString(36)+'-'+Math.random().toString(36).slice(2));
   challengeRun={runId,...details,mistakes:0,finished:false};try{api.onChallengeStart?.(challengeEvent());}catch{}
  }
  function challengeMistake(){if(challengeRun&&!challengeRun.finished)challengeRun.mistakes=Math.min(10000,challengeRun.mistakes+1);}
  function completeChallenge(){
   if(!challengeRun||challengeRun.finished||!opened||destroyed||roomEditor?.isEditing()||listening)return;
   challengeRun.finished=true;try{api.onChallengeComplete?.(challengeEvent());}catch{}
  }
  host.classList.add('piano-lab');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','pianoLabTitle');
  host.innerHTML=`<div class="piano-room-shell">
   <header class="piano-room-heading"><div><h1 id="pianoLabTitle">Piano Lab</h1></div><div class="piano-room-heading-actions"><button type="button" id="pianoFullscreen" aria-pressed="false">Fullscreen</button><button type="button" id="pianoMenuButton" aria-haspopup="dialog" aria-controls="pianoMenuBackdrop">Menu</button><button type="button" id="closepiano" aria-label="Return to arcade">← Arcade</button></div></header>
   <section class="piano-walk-room" aria-label="Walkable Piano Lab"><div class="piano-room-canvas-viewport"><canvas id="pianoRoomCanvas" width="1000" height="620" tabindex="0" aria-label="Piano Lab. Walk with WASD or arrow keys, or the joystick. Step on the giant piano keys to play. Space jumps. Press E near Chopin to talk. Open Menu for keyboard, recording and settings."></canvas><canvas id="pianoWallStaff" class="piano-wall-staff-mirror" width="428" height="120" hidden role="img" aria-label="Piano challenge score"></canvas><p id="pianoWallNote" class="piano-wall-note" role="status" aria-live="polite">Back wall: no note yet.</p></div><p id="pianoRoomMessage" class="piano-mobile-feedback" role="status" aria-live="polite">Walk over the piano to play. Talk to Chopin for a challenge.</p></section>
   <div id="pianoMenuBackdrop" class="piano-menu-backdrop" hidden><section class="piano-menu-panel" role="dialog" aria-modal="true" aria-labelledby="pianoMenuTitle"><header class="piano-menu-heading"><h2 id="pianoMenuTitle">Piano Lab menu</h2><button type="button" id="pianoMenuClose" aria-label="Close Piano Lab menu">Back to room</button></header>
   <nav class="piano-tool-menu" aria-label="Piano Lab tools"><button type="button" data-piano-view="games">Chopin games</button><button type="button" data-piano-view="keyboard">Keyboard</button><button type="button" data-piano-view="recording">Record</button><button type="button" data-piano-view="settings">Settings</button></nav>
   <main class="piano-workspace"><section id="pianoKeyboardPanel" class="piano-stage" aria-label="Accessible piano keyboard">
    <div class="piano-display"><span id="pianoNoteDisplay" aria-live="off">Ready to play</span><span id="pianoModeDisplay">FREE PLAY</span></div>
    <p class="piano-mobile-swipe">Swipe sideways for more keys.</p><div class="piano-keyboard-scroll"><div id="pianoKeys" class="piano-keyboard" role="group" aria-label="Piano keys, from lower sounds on the left to higher sounds on the right. Use arrow keys to move between keys and Enter or Space to play."></div></div>
    <p class="piano-shortcuts">Tap a key or use Enter. Choose Piano shortcuts in Settings to play with <kbd>A W S E D F T G Y H U J K</kbd>.</p>
   </section><aside class="piano-activities"><section id="pianoRecordingPanel"><h2>Make a recording</h2><p>Record up to 60 seconds. Your last take stays in this browser.</p><div class="piano-record-actions"><button type="button" id="pianoRecord">● Record</button><button type="button" id="pianoPlayback" disabled>▶ Play take</button><button type="button" id="pianoClear" disabled>Clear take</button></div><p id="pianoRecordStatus">No recording yet.</p><p>Close this menu to record on the giant floor piano, or switch to Keyboard.</p></section>
    <section id="pianoChallengePanel"><h2>Chopin’s challenges</h2><button type="button" id="pianoTalkChopin">Talk to Chopin</button><label for="pianoLesson">Choose a melody · 35 Notes once each</label><select id="pianoLesson"><option value="">Choose a melody</option>${LESSONS.map(item=>`<option value="${item.id}">${item.name}</option>`).join('')}</select><p id="pianoLessonDescription">Talk to Chopin to learn a melody, then try it from memory.</p><div id="pianoLessonProgress" class="piano-lesson-progress" aria-label="Lesson progress"></div><div class="piano-challenge-actions"><button type="button" id="pianoLessonRestart" hidden>Restart melody</button><button type="button" id="pianoListenMelody" disabled>Hear melody</button><button type="button" id="pianoMemoryStart" disabled>Play from memory · 60 bonus Notes</button></div><label for="pianoScale">Major and minor scales · 35 Notes once each</label><select id="pianoScale">${['major','minor'].map(type=>`<optgroup label="${type==='major'?'Major keys':'Natural minor keys'}">${SCALES.filter(item=>item.type===type).map(item=>`<option value="${item.id}">${item.name}</option>`).join('')}</optgroup>`).join('')}</select><button type="button" id="pianoStartScale">Try this scale</button><p>A scale is a musical ladder. Climb to the next note with the same letter, then come back down.</p><label for="pianoInterval">Interval game</label><select id="pianoInterval">${INTERVALS.map(item=>`<option value="${item.id}">${item.name}</option>`).join('')}</select><button type="button" id="pianoStartInterval">Try this interval</button><p class="piano-interval-help">An interval is the distance between two notes. Higher sounds are to the right; lower sounds are to the left.</p><p id="pianoIntervalPrompt"></p><button type="button" id="pianoFreePlay">Return to free play</button><p id="pianoGameInstructions">Free play: stepping on a key makes a sound.</p></section>
    <section id="pianoSettingsPanel"><h2>Piano settings</h2><div class="piano-controls"><label>Keyboard controls <select id="pianoKeyboardMode"><option value="walk">Walk around</option><option value="piano">Piano shortcuts</option></select></label><label>Note range <select id="pianoOctave" aria-label="Piano note range"><option value="3">Low notes</option><option value="4" selected>Middle notes</option><option value="5">High notes</option></select></label><label>Volume <input id="pianoVolume" aria-label="Piano volume" type="range" min="0" max="100" value="55"></label><button id="pianoSustain" type="button" aria-pressed="false">Sustain: Off</button><button id="pianoPanic" type="button">Release all notes</button><label class="piano-letter-setting"><input id="pianoKeyNames" type="checkbox" aria-label="Show letter names on keys">Show letter names on keys</label></div><div class="piano-room-tools" id="pianoRoomTools"></div></section>
    <p id="pianoMessage" class="piano-message" role="status" aria-live="polite">Sound starts when you play your first note.</p>
   </aside></main></section></div>
   <div id="pianoDialogueBackdrop" class="piano-dialogue-backdrop" hidden><section class="piano-dialogue-panel" role="dialog" aria-modal="true" aria-labelledby="pianoDialogueTitle"><header class="piano-dialogue-heading"><h2 id="pianoDialogueTitle">Frédéric Chopin</h2><button type="button" id="pianoDialogueClose" aria-label="Close Chopin dialogue">×</button></header><p id="pianoDialogueText"></p><div id="pianoDialogueChoices" class="piano-dialogue-actions"></div></section></div>
  </div>`;
  const el=id=>host.querySelector('#'+id),keyButtons=new Map();
  const storage=api.storage||(()=>{try{return win.localStorage;}catch{return null;}})();
  function message(text){if(mobileLayout())text=text.replace(/press E\b/gi,'tap Play note');el('pianoMessage').textContent=text;el('pianoRoomMessage').textContent=text;}
  const blocked=()=>menuOpen||dialogueOpen;
  function pauseRoom(){roomFinger?.stop('panel');releaseControls();releaseAll();setSustain(false);roomDest=null;roomPlayer.jump=roomPlayer.velocity=0;}
  function syncPanels(){host.dataset.menuOpen=String(menuOpen);host.dataset.dialogueOpen=String(dialogueOpen);el('pianoMenuBackdrop').hidden=!menuOpen;el('pianoDialogueBackdrop').hidden=!dialogueOpen;el('pianoMenuButton').setAttribute('aria-expanded',String(menuOpen));el('pianoRoomCanvas').inert=blocked();roomCamera?.update();api.onViewChange?.(mobileView);}
  function setMobileView(view,focus=false){
   if(!['room','games','keyboard','recording','settings'].includes(view))return;
   if(view!=='room')roomEditor?.close();
   stopDemo();pauseRoom();if(view==='room'){menuOpen=false;mobileView='room';}else{menuOpen=true;dialogueOpen=false;mobileView=view;}
   host.dataset.mobileView=mobileView;
   for(const button of host.querySelectorAll('[data-piano-view]'))button.setAttribute('aria-pressed',String(button.dataset.pianoView===view));
   for(const [id,matching]of [['pianoKeyboardPanel','keyboard'],['pianoRecordingPanel','recording'],['pianoChallengePanel','games'],['pianoSettingsPanel','settings']])el(id).hidden=menuOpen&&view!==matching;
   syncPanels();if(focus){const target=view==='room'?el('pianoRoomCanvas'):view==='games'?el('pianoLesson'):view==='keyboard'?keyButtons.get((octave+1)*12):view==='settings'?el('pianoKeyboardMode'):el('pianoRecord');target?.focus({preventScroll:true});}
  }
  function returnToFloor(){closeDialogue(false);setMobileView('room',true);}
  function stopDemo(){for(const timer of demoTimers)win.clearTimeout(timer);demoTimers=[];listening=false;releaseAll();}
  function closeDialogue(focus=true){stopDemo();dialogueOpen=false;dialogueKind='';syncPanels();if(focus)(dialogueFocus?.isConnected&&dialogueFocus.getClientRects().length&&!el('pianoDialogueBackdrop').contains(dialogueFocus)?dialogueFocus:el('pianoRoomCanvas')).focus({preventScroll:true});}
  function dialogue(text,choices=[],kind='talk'){
   roomEditor?.close();
   stopDemo();stopPlayback();pauseRoom();dialogueFocus=dialogueOpen?dialogueFocus:doc.activeElement;menuOpen=false;mobileView='room';host.dataset.mobileView='room';dialogueOpen=true;dialogueKind=kind;el('pianoDialogueText').textContent=text;el('pianoDialogueChoices').replaceChildren();
   for(const choice of choices){const button=doc.createElement('button');button.type='button';button.textContent=choice.label;if(choice.action)button.dataset.pianoDialogueAction=choice.action;if(choice.melody)button.dataset.pianoMelody=choice.melody;if(choice.scale)button.dataset.pianoScale=choice.scale;button.addEventListener('click',choice.run);el('pianoDialogueChoices').append(button);}
   syncPanels();(el('pianoDialogueChoices').querySelector('button')||el('pianoDialogueClose')).focus({preventScroll:true});
  }
  function loadProgress(){try{const saved=JSON.parse(storage?.getItem('codaPianoProgressV1')||'null');for(const id of saved?.learned||[])if(LESSONS.some(item=>item.id===id))learned.add(id);for(const id of saved?.completed||[])if(typeof id==='string'&&/^(piano-lesson:|piano-memory:|piano-interval:|piano-scale:|piano-scale-memory:)/.test(id)){completed.add(id);if(id.startsWith('piano-lesson:')&&LESSONS.some(item=>item.id===id.slice(13)))learned.add(id.slice(13));}}catch{}}
  function saveProgress(){try{storage?.setItem('codaPianoProgressV1',JSON.stringify({learned:[...learned],completed:[...completed]}));}catch{}}
  function loadTake(){try{const saved=JSON.parse(storage?.getItem('codaPianoTakeV1')||'null');if(validTake(saved))recorded=saved;}catch{}}
  function validTake(value){return Array.isArray(value)&&value.length<=1024&&value.every(note=>note&&Number.isInteger(note.midi)&&note.midi>=48&&note.midi<=96&&Number.isFinite(note.at)&&note.at>=0&&note.at<=60&&Number.isFinite(note.duration)&&note.duration>0&&note.duration<=60&&note.at+note.duration<=60.1);}
  function persistTake(){try{storage?.setItem('codaPianoTakeV1',JSON.stringify(recorded));}catch{message('Your take is ready for this visit; this browser could not save it.');}}
  function updateRecordingUI(){
   el('pianoRecord').textContent=recording?'■ Finish recording':'● Record';el('pianoRecord').setAttribute('aria-pressed',String(recording));
   el('pianoPlayback').textContent=playing?'■ Stop take':'▶ Play take';el('pianoPlayback').disabled=recording||!recorded.length;
   el('pianoClear').disabled=recording||playing||!recorded.length;
   el('pianoRecordStatus').textContent=recording?'Recording… '+Math.floor(Math.min(60,now()-recordStart))+' / 60 seconds':recorded.length?recorded.length+' note'+(recorded.length===1?'':'s')+' · '+Math.ceil(Math.max(...recorded.map(note=>note.at+note.duration)))+' seconds saved.':'No recording yet.';
  }
  function drawKeys(){
   let whites=0;el('pianoKeys').innerHTML='';keyButtons.clear();
   for(let offset=0;offset<=24;offset++){
    const midi=(octave+1)*12+offset,black=[1,3,6,8,10].includes(midi%12),button=doc.createElement('button');
    button.type='button';button.className='piano-key '+(black?'piano-black':'piano-white');button.dataset.midi=String(midi);button.setAttribute('aria-label','Play '+keyPositionName(midi,(octave+1)*12));button.setAttribute('aria-pressed','false');
    button.style.setProperty('--key-position',String(black?whites-.31:whites));
    button.innerHTML='<span class="piano-key-name"'+(showNames?'':' hidden')+'>'+noteLetter(midi)+'</span>'+(offset<SHORTCUTS.length?'<kbd>'+SHORTCUTS[offset].toUpperCase()+'</kbd>':'');
    if(!black)whites++;button.addEventListener('pointerdown',event=>{event.preventDefault();if(event.button!==0)return;button.focus({preventScroll:true});try{button.setPointerCapture(event.pointerId);}catch{}pointerKeys.set(event.pointerId,midi);press(midi,'pointer:'+event.pointerId);});
    button.addEventListener('keydown',event=>{
     if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?24:clamp(offset+(event.key==='ArrowRight'?1:-1),0,24);keyButtons.get((octave+1)*12+target)?.focus();}
     if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)press(midi,'button:'+midi);}
    });
    button.addEventListener('keyup',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();release(midi,'button:'+midi);}});
    button.addEventListener('blur',()=>release(midi,'button:'+midi));
    el('pianoKeys').append(button);keyButtons.set(midi,button);
   }
   el('pianoKeys').style.setProperty('--white-keys',String(whites));updateKeyHighlights();
  }
  function targetMidi(){return challengeMode==='interval'&&interval&&intervalStep<2?(octave+1)*12+(intervalStep?interval.target:interval.start):lesson&&melodyMode!=='memory'&&lessonStep<lesson.notes.length?(octave+1)*12+lesson.notes[lessonStep]:null;}
  function displayNote(midi){const index=lesson?.kind==='scale'?lesson.notes.findIndex(offset=>(octave+1)*12+offset===midi):-1;return index>=0?lesson.spellings[index]:noteLetter(midi);}
  function reactChopin(emote,text){chopinReaction={emote,text,started:roomClock,until:roomClock+(emote==='cheer'?2.5:1.7)};}
  function reactionState(){return {...chopinReaction,active:roomClock<chopinReaction.until,facing:'down'};}
  function wallStaffState(){
   if(challengeMode==='free')return {visible:false,mode:'free',notes:[],events:[],bounds:{x:286,y:72,width:428,height:120},mirror:false};
   const memory=melodyMode==='memory'&&(challengeMode==='melody'||challengeMode==='scale'),offsets=interval?[interval.start,interval.target]:lesson?.notes||[],notes=memory?playedChallengeNotes:offsets.map(offset=>(octave+1)*12+offset),step=memory?notes.length:interval?intervalStep:lessonStep;
   const data={notes,events:memory?playedChallengeNotation.flatMap(event=>[...(event.restsBefore||[]),event]):lesson?.events,step,mode:memory?'memory':challengeMode,meter:lesson?.meter||'4/4',label:interval?'Chopin’s interval':lesson?.name||'Piano challenge',spellings:memory?undefined:lesson?.spellings};
   const score=win.CodaPianoWallNotation?.createScore?.(data)||{...data,notes:[],events:[],answerHidden:memory};if(memory){score.total=offsets.length;score.step=lessonStep;score.complete=lessonStep>=offsets.length&&offsets.length>0;}
   return {...score,visible:true,bounds:{x:286,y:72,width:428,height:120},mirror:!roomEditor?.isEditing()&&(mobileLayout()||(roomCamera?.getState().zoom||1)>1.2)};
  }
  function keyHighlightState(){const midi=targetMidi(),key=paintedKeys.find(key=>(octave+1)*12+key.offset===midi);return {midi,visible:midi!==null,polygon:key?key.polygon.map(point=>point.slice()):[],pulse:!win.matchMedia?.('(prefers-reduced-motion:reduce)').matches,outlineWidth:4};}
  function updateKeyHighlights(){const next=targetMidi();for(const [midi,button] of keyButtons){const label=button.querySelector('.piano-key-name');if(label)label.textContent=displayNote(midi);button.setAttribute('aria-label','Play '+keyPositionName(midi,(octave+1)*12).replace(noteLetter(midi),displayNote(midi)));const active=held.has(midi);button.classList.toggle('is-playing',active);button.setAttribute('aria-pressed',String(active));button.classList.toggle('is-next',midi===next);}}
  function audio(){
   if(!context){const Constructor=api.AudioContext||win.AudioContext||win.webkitAudioContext;if(!Constructor){message('Audio is unavailable in this browser. The keyboard and lessons still work.');return null;}try{context=new Constructor();master=context.createGain();master.gain.value=volume*.24;master.connect(context.destination);}catch{message('Audio could not start. You can still use the keyboard and lessons.');return null;}}
   if(context.state==='suspended')context.resume().catch(()=>message('Tap a piano key to enable sound.'));
   return context;
  }
  function startVoice(midi){
   const ctx=audio();if(!ctx||ctx.state==='closed')return;stopVoice(midi,true);const at=ctx.currentTime,envelope=ctx.createGain();envelope.gain.setValueAtTime(.0001,at);envelope.gain.exponentialRampToValueAtTime(.65,at+.008);envelope.gain.exponentialRampToValueAtTime(.20,at+.35);envelope.gain.exponentialRampToValueAtTime(.0001,at+4);envelope.connect(master);
   const oscillators=[1,2,3].map((partial,index)=>{const oscillator=ctx.createOscillator(),gain=ctx.createGain();oscillator.type='sine';oscillator.frequency.value=frequency(midi)*partial;gain.gain.value=[1,.18,.055][index];oscillator.connect(gain);gain.connect(envelope);oscillator.start(at);oscillator.stop(at+4.1);return oscillator;});
   const voice={envelope,oscillators,timer:null};voice.timer=win.setTimeout(()=>{if(voices.get(midi)===voice){voices.delete(midi);try{envelope.disconnect();}catch{}}},4200);voices.set(midi,voice);
  }
  function stopVoice(midi,immediate=false){const voice=voices.get(midi);if(!voice)return;voices.delete(midi);win.clearTimeout(voice.timer);if(context?.state!=='closed'){const at=context.currentTime;try{voice.envelope.gain.cancelScheduledValues(at);voice.envelope.gain.setTargetAtTime(.0001,at,immediate?.008:.09);for(const oscillator of voice.oscillators)oscillator.stop(at+(immediate?.04:.4));}catch{}}win.setTimeout(()=>{try{voice.envelope.disconnect();}catch{}},immediate?60:450);}
  function captureRelease(midi){const entry=recordHeld.get(midi);if(!entry)return;entry.duration=clamp(now()-recordStart-entry.at,.04,60-entry.at);recordHeld.delete(midi);}
  function press(midi,source='external',playback=false){
   if(!opened||destroyed||roomEditor?.isEditing()||pinchBlocked()||(!playback&&(dialogueOpen||listening))||!Number.isInteger(midi))return;
   let sources=held.get(midi);if(!sources){sources=new Set();held.set(midi,sources);startVoice(midi);if(recording&&!playback&&recorded.length<1024){const at=clamp(now()-recordStart,0,59.96),entry={midi,at,duration:.04};recorded.push(entry);recordHeld.set(midi,entry);}if(!playback){if(challengeMode!=='free'){const written=lesson?.events?.filter(event=>!event.rest)[lessonStep];const matches=midi===(octave+1)*12+(lesson?.notes?.[lessonStep]??-1000),prior=lesson?.events?.filter(event=>!event.rest)[lessonStep-1],restsBefore=matches&&prior?lesson.events.filter(event=>event.rest&&event.onset>=prior.onset+prior.beats-1e-8&&event.onset<written.onset).map(event=>({midi:null,beats:event.beats,rest:true})):[];playedChallengeNotes.push(midi);playedChallengeNotation.push({midi,beats:written?.beats||1,rest:false,restsBefore,spelling:matches?written?.spelling:undefined});if(playedChallengeNotes.length>64){playedChallengeNotes.splice(0,playedChallengeNotes.length-64);playedChallengeNotation.splice(0,playedChallengeNotation.length-64);}}if(challengeMode==='interval')advanceInterval(midi);else advanceLesson(midi);}}
   sources.add(source);lastWallNote=midi;el('pianoWallNote').textContent='Back wall: '+displayNote(midi);el('pianoNoteDisplay').textContent=Array.from(held.keys()).sort((a,b)=>a-b).map(displayNote).join(' · ');updateKeyHighlights();
  }
  function release(midi,source='external'){const sources=held.get(midi);if(!sources)return;sources.delete(source);if(sources.size)return;held.delete(midi);captureRelease(midi);if(!sustain&&!voices.get(midi)?.completionTail)stopVoice(midi);el('pianoNoteDisplay').textContent=held.size?Array.from(held.keys()).sort((a,b)=>a-b).map(displayNote).join(' · '):'Ready to play';updateKeyHighlights();}
  function releaseAll(force=false){clearJoystick();touchHeld.clear();for(const midi of recordHeld.keys())captureRelease(midi);held.clear();computerKeys.clear();pointerKeys.clear();roomKeys.clear();floorNote=roomPlayer.jump>1?null:floorKeyAt(roomPlayer.x,roomPlayer.y);for(const [midi,voice] of voices)if(force||!voice.completionTail)stopVoice(midi,true);el('pianoNoteDisplay').textContent='Ready to play';updateKeyHighlights();}
  function setSustain(value){sustain=!!value;el('pianoSustain').setAttribute('aria-pressed',String(sustain));el('pianoSustain').textContent='Sustain: '+(sustain?'On':'Off');if(!sustain)for(const midi of voices.keys())if(!held.has(midi)&&!voices.get(midi)?.completionTail)stopVoice(midi);}
  function stopPlayback(){for(const timer of playTimers)win.clearTimeout(timer);playTimers=[];playing=false;releaseAll();updateRecordingUI();}
  function stopRecording(){if(!recording)return;for(const midi of recordHeld.keys())captureRelease(midi);recording=false;win.clearInterval(recordTimer);recordTimer=null;persistTake();updateRecordingUI();message(recorded.length?'Take saved. Press Play take to hear it.':'No notes recorded. Try another take.');}
  function toggleRecording(){if(roomEditor?.isEditing())return;if(recording){stopRecording();return;}stopPlayback();releaseAll();recorded=[];recordHeld.clear();recordStart=now();recording=true;updateRecordingUI();message('Recording started. Play anything you like.');recordTimer=win.setInterval(()=>{if(now()-recordStart>=60)stopRecording();else updateRecordingUI();},200);}
  function togglePlayback(){if(roomEditor?.isEditing())return;if(playing){stopPlayback();message('Playback stopped.');return;}if(!recorded.length||recording)return;releaseAll();audio();playing=true;el('pianoModeDisplay').textContent='PLAYING TAKE';updateRecordingUI();for(let index=0;index<recorded.length;index++){const note=recorded[index],source='take:'+index;playTimers.push(win.setTimeout(()=>{if(playing)press(note.midi,source,true);},note.at*1000),win.setTimeout(()=>release(note.midi,source),(note.at+note.duration)*1000));}const duration=Math.max(...recorded.map(note=>note.at+note.duration));playTimers.push(win.setTimeout(()=>{stopPlayback();updateGameInstructions();message('Playback finished.');},duration*1000+100));}
  function renderLesson(){
   el('pianoLessonDescription').textContent=lesson?(melodyMode==='memory'?'Play '+lesson.name+' from memory. No glowing hints this time.':lesson.description):'Talk to Chopin to learn a melody, then try it from memory.';el('pianoLessonRestart').hidden=!lesson;el('pianoLessonRestart').textContent=lesson?.kind==='scale'?'Restart scale':'Restart melody';el('pianoListenMelody').textContent=lesson?.kind==='scale'?'Hear scale':'Hear melody';
   el('pianoModeDisplay').textContent=playing?'PLAYING TAKE':lesson?lesson.kind==='scale'?(melodyMode==='memory'?'MEMORY SCALE':'GUIDED SCALE'):melodyMode==='memory'?'MEMORY MELODY':'GUIDED MELODY':'FREE PLAY';
   el('pianoLessonProgress').innerHTML=lesson?(melodyMode==='memory'?'<span>'+lessonStep+' / '+lesson.notes.length+' notes</span>':lesson.notes.map((offset,index)=>'<span class="'+(index<lessonStep?'is-done':index===lessonStep?'is-current':'')+'">'+(lesson.spellings?.[index]||noteLetter((octave+1)*12+offset))+'</span>').join('')):'';
   el('pianoLessonProgress').setAttribute('aria-label',lesson?'Lesson progress: '+lessonStep+' of '+lesson.notes.length+' notes complete.':'No lesson selected.');el('pianoListenMelody').disabled=!lesson;el('pianoMemoryStart').disabled=!canRememberLesson();el('pianoMemoryStart').textContent=lesson?.kind==='scale'?'Play scale from memory · 60 bonus Notes':'Play from memory · 60 bonus Notes';updateKeyHighlights();
  }
  function updateGameInstructions(){el('pianoOctave').disabled=challengeMode==='melody'||challengeMode==='scale';el('pianoGameInstructions').textContent=challengeMode==='free'?'Free play: stepping on a key makes a sound.':mobileLayout()?'Play the next pitch whenever you are ready. Walk to a key, then tap Play note. No rhythm timing or holds are required.':'Play the next pitch whenever you are ready. Walk to a key, then press E. No rhythm timing or holds are required.';el('pianoModeDisplay').textContent=challengeMode==='free'?'FREE PLAY':challengeMode==='interval'?'INTERVAL GAME':challengeMode==='scale'?(melodyMode==='memory'?'MEMORY SCALE':'GUIDED SCALE'):melodyMode==='memory'?'MEMORY MELODY':'GUIDED MELODY';}
  function chooseLesson(id,mode='guided',restart=true){
   stopDemo();stopPlayback();releaseAll();const source=LESSONS.find(item=>item.id===id)||null,register=source?fitMelodyRegister(source):null;
   lesson=source&&register?{...source,notes:register.notes,register}:null;lessonStep=0;playedChallengeNotes=[];playedChallengeNotation=[];correctRun=0;el('pianoScale').value=SCALES[0].id;melodyMode=mode==='memory'&&lesson&&learned.has(lesson.id)?'memory':'guided';interval=null;intervalStep=0;challengeMode=lesson?'melody':'free';
   if(register){octave=register.octave;el('pianoOctave').value=String(octave);floorNote=null;drawKeys();syncFloorNote();}
   el('pianoLesson').value=lesson?.id||'';el('pianoIntervalPrompt').textContent='';renderLesson();updateGameInstructions();
   if(!lesson)challengeRun=null;
   if(source&&!register){message('This melody needs a wider piano range. Choose another tune.');return;}
   if(lesson)beginChallenge({kind:'melody',mode:melodyMode,lessonId:lesson.id,melodyId:lesson.id},restart);
   if(lesson)message(melodyMode==='memory'?'Memory challenge: play the next pitch without glowing hints.':'Next: '+keyPositionName((octave+1)*12+lesson.notes[0],(octave+1)*12)+'.');
  }
  function reward(id,amount=35){
   const remember=()=>{completed.add(id);if(id.startsWith('piano-lesson:'))learned.add(id.slice(13));saveProgress();pendingReward=null;renderLesson();};
   if(completed.has(id)){remember();return ' You have already collected these Notes.';}
   if(typeof api.onReward!=='function'){remember();return '';}
   try{const result=api.onReward(id,amount);if(result?.ok!==false&&(result===true||Number(result)>0||result?.amount>0||result?.alreadyClaimed||result?.ok===true)){remember();return result?.alreadyClaimed?' You have already collected these Notes.':' You earned '+(result?.amount||amount)+' Notes!';}}catch{}
   pendingReward={id,amount};return ' Your Notes could not be saved. Try saving again.';
  }
  function canRememberLesson(){return !!lesson&&(lesson.kind==='scale'?completed.has('piano-scale:'+lesson.id):learned.has(lesson.id));}
  function prepareActiveMemory(){if(canRememberLesson()){if(lesson.kind==='scale')prepareScale(lesson.id,'memory');else prepareMelody(lesson.id,'memory');}}
  // Finishing a challenge clears input, but its final piano voice keeps the
  // normal bounded envelope. Panic, blur and leaving the room still stop it.
  function completionDialogue(text){for(const voice of voices.values())voice.completionTail=true;const choices=[];if(pendingReward)choices.push({label:'Try saving reward again',action:'retry-reward',run:()=>completionDialogue('Beautifully played!'+reward(pendingReward.id,pendingReward.amount))});if(melodyMode!=='memory'&&canRememberLesson())choices.push({label:'Try from memory · 60 bonus Notes',action:'memory',run:prepareActiveMemory});choices.push(lesson?.kind==='scale'?{label:'Choose another scale',action:'scales',run:scaleChoices}:{label:'Choose another melody',action:'melodies',run:melodyChoices},{label:'Keep exploring',action:'close',run:returnToFloor});dialogue(text,choices,'complete');}
  function advanceLesson(midi){
   if(!lesson||lessonStep>=lesson.notes.length)return;const expected=(octave+1)*12+lesson.notes[lessonStep];
   if(midi!==expected){challengeMistake();correctRun=0;reactChopin('think',melodyMode==='memory'?'Let’s try that phrase again.':'Take your time. Try the glowing key.');if(melodyMode==='memory'){lessonStep=0;renderLesson();message('Not quite. Try the whole '+(lesson.kind==='scale'?'scale':'tune')+' again from the beginning.');}else message('Next: '+(lesson.kind==='scale'?lesson.spellings[lessonStep]:keyPositionName(expected,(octave+1)*12))+'.');return;}
   lessonStep++;correctRun++;if(correctRun%3===0)reactChopin('clap','Lovely! Keep going.');renderLesson();updateGameInstructions();
   if(lessonStep===lesson.notes.length){completeChallenge();reactChopin('cheer','Beautifully played!');const text=melodyMode==='memory'?'You remembered the whole '+(lesson.kind==='scale'?'scale, up and down':'melody')+'!':'Beautifully played! You have learned '+lesson.name+(lesson.kind==='scale'?' up and down':'')+'.';const paid=reward((lesson.kind==='scale'?(melodyMode==='memory'?'piano-scale-memory:':'piano-scale:'):melodyMode==='memory'?'piano-memory:':'piano-lesson:')+lesson.id,melodyMode==='memory'?60:35);message(text+paid);completionDialogue(text+paid);}
   else message(melodyMode==='memory'?'Keep going! '+lessonStep+' / '+lesson.notes.length+' notes.':'Next: '+(lesson.kind==='scale'?lesson.spellings[lessonStep]:keyPositionName((octave+1)*12+lesson.notes[lessonStep],(octave+1)*12))+'.');
  }
  function chooseScale(id,mode='guided',restart=true){
   stopDemo();stopPlayback();releaseAll();lesson=SCALES.find(item=>item.id===id)||SCALES[0];lessonStep=0;playedChallengeNotes=[];playedChallengeNotation=[];correctRun=0;melodyMode=mode==='memory'&&completed.has('piano-scale:'+lesson.id)?'memory':'guided';interval=null;intervalStep=0;challengeMode='scale';
   if(SCALES.some(item=>item.id===id))beginChallenge({kind:'scale',mode:melodyMode,scaleType:lesson.type,lessonId:lesson.id},restart);else challengeRun=null;
   octave=4;el('pianoOctave').value='4';floorNote=null;drawKeys();syncFloorNote();el('pianoLesson').value='';el('pianoScale').value=lesson.id;el('pianoIntervalPrompt').textContent='';renderLesson();updateGameInstructions();
   message(melodyMode==='memory'?'Memory scale: play all the way up and back down without glowing hints.':'Play '+lesson.name+' up and back down. Start on '+lesson.spellings[0]+'.');
  }
  function prepareScale(id,mode='guided',restart=true){
   chooseScale(id,mode,restart);const memory=melodyMode==='memory',choices=[{label:memory?'Play from memory':'Let’s play',action:'play',run:returnToFloor},{label:'Hear the scale first',action:'listen',run:()=>demonstrate(lesson.id,melodyMode)}];
   if(!memory&&canRememberLesson())choices.push({label:'Play from memory · 60 bonus Notes',action:'memory',run:prepareActiveMemory});
   choices.push({label:'Choose another scale',action:'scales',run:scaleChoices});
   const text=memory?'Can you play '+lesson.name+' up and back down from memory? There are no glowing hints or future notes on the wall. A wrong note starts the scale again. Take your time. Finish for 60 bonus Notes, once for this scale.':'Let’s play '+lesson.name+'. Climb eight notes to the top, then come back down to your starting note. '+(lesson.type==='major'?'Major scales use the pattern: whole, whole, half, whole, whole, whole, half.':'Natural minor scales use: whole, half, whole, whole, half, whole, whole.')+' Follow the glowing keys. The wall shows the notes. Stand on each key and '+(mobileLayout()?'tap Play note':'press E')+'. Finish the whole trip for 35 Notes, once for this scale.';
   dialogue(text,choices,memory?'prepare-scale-memory':'prepare-scale');
  }
  function scaleChoices(){dialogue('Choose a major or natural minor scale. We will climb to the top, then come back down. Black keys are part of some scales.',SCALES.map(item=>({label:item.name+(completed.has('piano-scale-memory:'+item.id)?' · memorized':completed.has('piano-scale:'+item.id)?' · learned':''),scale:item.id,run:()=>prepareScale(item.id)})).concat({label:'Back',action:'back',run:talkChopin}),'scales');}
  function prepareMelody(id,mode='guided',restart=true){
   chooseLesson(id,mode,restart);if(!lesson)return;dialogueTune=lesson.id;
   const memory=melodyMode==='memory';const text=memory?'Can you play '+lesson.name+' without the glowing hints? A wrong note sends you back to the beginning. Take your time. Finish it for 60 bonus Notes, once for this melody.':'Let’s learn '+lesson.name+'. Follow the glowing keys. Stand on a key and '+(mobileLayout()?'tap Play note':'press E')+'. The wall shows the tune’s rhythm and rests, but you only need to play the next pitch. Take as much time as you like; no holds are needed. Finish the tune for 35 Notes, once for this melody.';
   dialogue(text,[{label:memory?'Play from memory':'Let’s play',action:'play',run:returnToFloor},{label:'Hear the melody first',action:'listen',run:()=>demonstrate(lesson.id,mode)},{label:'Choose another melody',action:'melodies',run:melodyChoices}],'prepare');
  }
  function demonstrate(id,mode='guided'){
   releaseAll(true);const tune=LESSONS.find(item=>item.id===id)||SCALES.find(item=>item.id===id);if(!tune)return;stopDemo();pauseRoom();listening=true;el('pianoDialogueText').textContent='Listen to '+tune.name+'. Then play the pitches at your own speed.';for(const button of el('pianoDialogueChoices').querySelectorAll('button'))button.disabled=true;
   const beatMs=60000/(tune.quarterBpm||100),events=tune.events||tune.notes.map((offset,index)=>({midi:(octave+1)*12+offset,onset:index,beats:1,rest:false}));let end=0;
   events.forEach((event,index)=>{const at=event.onset*beatMs,length=event.beats*beatMs;end=Math.max(end,at+length);if(event.rest)return;const source='demo:'+index;demoTimers.push(win.setTimeout(()=>{if(listening)press(event.midi,source,true);},at),win.setTimeout(()=>release(event.midi,source),at+Math.max(80,length*.86)));});
   demoTimers.push(win.setTimeout(()=>{stopDemo();if(tune.kind==='scale')prepareScale(id,mode,false);else prepareMelody(id,mode,false);},end+150));
  }
  function melodyChoices(){dialogue('Choose a tune to learn. I will show you one note at a time.',LESSONS.map(item=>({label:item.name+(learned.has(item.id)?' · learned':''),melody:item.id,run:()=>prepareMelody(item.id)})).concat({label:'Back',action:'back',run:talkChopin}),'melodies');}
  function startInterval(){stopDemo();stopPlayback();releaseAll();lesson=null;lessonStep=0;melodyMode='guided';el('pianoLesson').value='';interval=INTERVALS.find(item=>item.id===el('pianoInterval').value)||INTERVALS[0];intervalStep=0;playedChallengeNotes=[];playedChallengeNotation=[];correctRun=0;challengeMode='interval';if(INTERVALS.some(item=>item.id===el('pianoInterval').value))beginChallenge({kind:'interval',mode:'guided',lessonId:interval.id});else challengeRun=null;renderLesson();updateGameInstructions();const text='Start on the '+keyPositionName((octave+1)*12+interval.start,(octave+1)*12)+', then play a '+interval.name+'. Stand on each key and '+(mobileLayout()?'tap Play note':'press E')+'.';el('pianoIntervalPrompt').textContent=text;message(text);dialogue(text,[{label:'Let’s play',action:'play',run:returnToFloor},{label:'Choose another interval',action:'intervals',run:()=>{closeDialogue(false);setMobileView('games',true);el('pianoInterval').focus();}}],'interval');}
  function advanceInterval(midi){if(!interval||intervalStep>=2)return;const expected=(octave+1)*12+(intervalStep?interval.target:interval.start);if(midi!==expected){challengeMistake();correctRun=0;reactChopin('think','You can try that note again.');message(intervalStep?'Find a '+interval.name+' from your starting note.':'Start on the '+keyPositionName(expected,(octave+1)*12)+'.');return;}intervalStep++;correctRun++;reactChopin(intervalStep===2?'cheer':'clap',intervalStep===2?'Exactly right!':'Good starting note!');updateKeyHighlights();if(intervalStep===2){completeChallenge();el('pianoIntervalPrompt').textContent='Correct! '+keyPositionName((octave+1)*12+interval.start,(octave+1)*12)+' → '+keyPositionName((octave+1)*12+interval.target,(octave+1)*12);const text='Exactly right!'+reward('piano-interval:'+interval.id);message(text);completionDialogue(text);}else message('Good. Now play a '+interval.name+'.');}
  const WHITE_OFFSETS=[0,2,4,5,7,9,11,12,14,16,17,19,21,23],BLACK_KEYS=[[1,1],[3,2],[6,4],[8,5],[10,6],[13,8],[15,9],[18,11],[20,12],[22,13]];
  const paintedKeys=paintedFloorKeys();
  function floorKeyAt(x,y){if(backdropReady){for(let at=paintedKeys.length-1;at>=0;at--)if(polygonContains(paintedKeys[at].polygon,x,y))return (octave+1)*12+paintedKeys[at].offset;return null;}if(x<ROOM.keyX||x>=ROOM.keyX+ROOM.keyW||y<ROOM.keyY||y>ROOM.keyY+ROOM.keyH)return null;const width=ROOM.keyW/WHITE_OFFSETS.length;if(y<ROOM.keyY+112)for(const [offset,index] of BLACK_KEYS){const left=ROOM.keyX+(index-.31)*width;if(x>=left&&x<left+width*.62)return (octave+1)*12+offset;}return (octave+1)*12+WHITE_OFFSETS[Math.min(WHITE_OFFSETS.length-1,Math.floor((x-ROOM.keyX)/width))];}
  function syncFloorNote(){const next=roomPlayer.jump>1?null:floorKeyAt(roomPlayer.x,roomPlayer.y);if(next===floorNote)return;if(floorNote!==null){release(floorNote,'floor');release(floorNote,'floor-intent');}floorNote=next;if(next!==null&&challengeMode==='free')press(next,'floor');}
  function talkChopin(){const choices=[...(api.openHistory?[{label:'Tell me some music history',action:'history',run:()=>api.openHistory()}]:[]),{label:'Learn a melody · earn Notes',action:'melodies',run:melodyChoices},{label:'Play major and minor scales',action:'scales',run:scaleChoices},{label:'Try an interval',action:'intervals',run:()=>{closeDialogue(false);setMobileView('games',true);el('pianoInterval').focus();}}];if(canRememberLesson())choices.push({label:'Play '+lesson.name+' from memory',action:'memory',run:prepareActiveMemory});if(challengeMode!=='free')choices.push({label:'Continue my challenge',action:'play',run:returnToFloor});choices.push({label:'Just exploring',action:'close',run:returnToFloor});dialogue('Hello! I’m Chopin. We can learn a familiar tune, climb a scale, or try a jump between two notes. What would you like to do?',choices);}
  function useRoomCamera(){return !!roomCamera&&!roomEditor?.isEditing();}
  function pinchBlocked(){const gesture=roomFinger?.getState();return !!(gesture?.pinching||gesture?.suppressed);}
  function roomPoint(clientX,clientY){if(roomEditor?.isEditing())return roomEditor.toWorld(clientX,clientY);if(useRoomCamera())return roomCamera.toWorld(clientX,clientY);const box=el('pianoRoomCanvas').getBoundingClientRect();return {x:(clientX-box.left)/box.width*ROOM.width,y:(clientY-box.top)/box.height*ROOM.height};}
  function nearChopin(){return roomChopin.visible&&Math.hypot(roomPlayer.x-roomChopin.x,roomPlayer.y-roomChopin.y)<110;}
  function roomPointer(event){if(event.defaultPrevented||blocked()||roomEditor?.isEditing()||pinchBlocked()||event.button!==0||roomFinger&&event.pointerType==='touch'&&mobileLayout())return;clearJoystick();el('pianoRoomCanvas').focus({preventScroll:true});const point=roomPoint(event.clientX,event.clientY);roomDest={x:clamp(point.x,0,ROOM.width),y:clamp(point.y,0,ROOM.height)};}
  const roomContext=el('pianoRoomCanvas').getContext('2d');
  let roomBackdrop=null,roomBaseArtwork=null,backdropReady=false;
  // Reuse the painting's illuminated key textures inside its existing frame.
  // Twenty-four keys cover every major/minor tonic and its octave without
  // moving a room fixture or wrapping a high pitch down to the wrong register.
  function makeExpandedKeyboardBackground(source){
   const canvas=doc.createElement('canvas');canvas.width=source.naturalWidth;canvas.height=source.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);ctx.save();ctx.scale(canvas.width/1000,canvas.height/620);ctx.imageSmoothingEnabled=true;
   const sx=canvas.width/1593,sy=canvas.height/987,oldFronts=[170,268,366,468,556,663,761,860,945,1041,1131,1230,1323,1427];
   const path=key=>{ctx.beginPath();ctx.moveTo(...key.polygon[0]);for(const point of key.polygon.slice(1))ctx.lineTo(...point);ctx.closePath();};
   const whites=paintedKeys.filter(key=>!key.black),blacks=paintedKeys.filter(key=>key.black);
   whites.forEach((key,index)=>{const xs=key.polygon.map(point=>point[0]),ys=key.polygon.map(point=>point[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y,pink=index%2===0;
    ctx.save();path(key);ctx.clip();const wash=ctx.createLinearGradient(0,y,0,y+h);wash.addColorStop(0,pink?'#e68bed':'#a6d9ff');wash.addColorStop(.48,pink?'#fbcdf9':'#c7f8ff');wash.addColorStop(1,pink?'#f2a0ea':'#7ed9f4');ctx.fillStyle=wash;ctx.fillRect(x,y,w,h);
    const sample=index%13,left=oldFronts[sample]+15,right=oldFronts[sample+1]-15;ctx.globalAlpha=.68;ctx.drawImage(source,left*sx,758*sy,(right-left)*sx,55*sy,x,y,w,h);ctx.globalAlpha=1;ctx.restore();
    path(key);ctx.strokeStyle='#362749';ctx.lineWidth=3.4;ctx.stroke();ctx.strokeStyle=pink?'#ffd6ff':'#b7faff';ctx.lineWidth=1.7;ctx.stroke();ctx.beginPath();ctx.moveTo(...key.polygon[3]);ctx.lineTo(...key.polygon[2]);ctx.strokeStyle=pink?'#f467e4':'#5dbbea';ctx.lineWidth=3;ctx.stroke();
   });
   blacks.forEach(key=>{const xs=key.polygon.map(point=>point[0]),ys=key.polygon.map(point=>point[1]),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
    ctx.save();path(key);ctx.clip();const dark=ctx.createLinearGradient(x,y,x+w,y+h);dark.addColorStop(0,'#10132e');dark.addColorStop(.65,'#0b1836');dark.addColorStop(1,'#132453');ctx.fillStyle=dark;ctx.fillRect(x,y,w,h);ctx.globalAlpha=.62;ctx.drawImage(source,300*sx,650*sy,7*sx,68*sy,x,y,w,h);ctx.globalAlpha=1;ctx.restore();path(key);ctx.strokeStyle='#091527';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#568bca';ctx.lineWidth=1.4;ctx.stroke();ctx.beginPath();ctx.moveTo(...key.polygon[3]);ctx.lineTo(...key.polygon[2]);ctx.strokeStyle='#965ec5';ctx.lineWidth=2.5;ctx.stroke();
   });
   ctx.restore();return canvas;
  }
  if(typeof api.backgroundUrl==='string'&&api.backgroundUrl){roomBackdrop=new win.Image();roomBackdrop.onload=()=>{backdropReady=roomBackdrop.naturalWidth>0;if(backdropReady)roomBaseArtwork=makeExpandedKeyboardBackground(roomBackdrop);};roomBackdrop.src=api.backgroundUrl;}
  function drawRoom(){
   const g=roomContext;if(!g)return;const vibe=roomEditor?.isEditing()?null:api.getVibe?.();g.clearRect(0,0,1000,620);g.imageSmoothingEnabled=false;const cameraActive=useRoomCamera();if(cameraActive){roomCamera.update();roomCamera.begin(g);}roomEditor?.beforeScene(g);
   const labelScale=cameraActive?el('pianoRoomCanvas').getBoundingClientRect().width/ROOM.width*roomCamera.getState().zoom:1,keyLabelSize=black=>cameraActive?Math.max(black?10:13,Math.ceil((black?11:13)/Math.max(.1,labelScale))):(black?10:13);
   const rect=(x,y,w,h,color)=>{g.fillStyle=color;g.fillRect(x,y,w,h);},text=(value,x,y,size,color,align='center')=>{g.fillStyle=color;g.font='bold '+size+'px monospace';g.textAlign=align;g.fillText(value,x,y);};
   const help=challengeMode==='free'?'STEP ON A KEY TO PLAY':'STAND ON A KEY + PRESS E';
   if(!backdropReady){
   rect(0,0,1000,620,'#10172e');rect(26,20,948,212,'#263052');
   for(let x=26;x<974;x+=44){rect(x,20,2,212,'#3c3e67');rect(x+2,20,1,212,'#1a2544');}for(let y=20;y<232;y+=42){rect(26,y,948,2,'#3b3e66');rect(26,y+2,948,2,'#192440');}
   rect(25,229,950,10,'#151b30');rect(25,238,950,4,'#7c5b9a');rect(25,242,950,378,'#23283f');
   for(let row=0;row<10;row++)for(let col=0;col<19;col++){const x=25+col*50,y=242+row*38;rect(x+3,y+3,45,33,(row+col)%2?'#292841':'#25243c');rect(x,y,50,2,'#465078');rect(x,y+2,50,1,'#171e36');rect(x,y,2,38,'#445079');rect(x+2,y+3,1,34,'#151f35');}
   // Recessed neon wall columns and their crisp, broken tile reflections.
   for(const [x,color,shade] of [[47,'#6fdfee','#24536d'],[234,'#bb7adb','#49345e'],[758,'#ba7ada','#48365d'],[946,'#69d7ec','#26536c']]){rect(x-11,28,22,208,'#151a30');rect(x-7,32,14,196,shade);rect(x-3,34,6,190,color);rect(x-1,36,2,186,'#ecf4ff');for(let row=0;row<9;row++){const y=248+row*38;rect(x-8-(row%2)*3,y,16+(row%2)*6,30,shade);rect(x-2,y+3,4,25,row<4?color:shade);}}
   // Side wall bevels tie the room into the connected arcade architecture.
   rect(9,22,17,598,'#11172b');rect(15,28,7,592,'#3c4270');rect(21,27,3,593,'#8a6eb0');rect(974,22,17,598,'#11172b');rect(976,28,7,592,'#3c4270');rect(975,27,2,593,'#8166a2');
   rect(35,28,930,4,'#6e4391');rect(35,33,930,2,'#db8dde');
   rect(280,47,440,153,'#101e30');rect(286,53,428,141,'#16353f');rect(292,59,416,129,'#0d232e');text('PIANO LAB',500,86,18,'#e4c9f4');
   text(lastWallNote===null?'♪':noteLetter(lastWallNote),500,156,60,lastWallNote===null?'#46667a':'#aaffdf');
   text(help,500,185,12,'#94a4c1');
   for(const x of [90,910]){rect(x-10,60,20,100,'#392d4f');rect(x-6,68,12,72,'#ffd48d');rect(x-3,72,6,63,'#fff2bb');rect(x-19,143,38,5,'#8c5361');}
   // Framed scores, a book cabinet, and rolled music give Chopin a lived-in corner.
   for(const x of [139,771]){rect(x,82,70,103,'#110f23');rect(x+3,85,64,97,'#997391');rect(x+8,90,54,87,'#dfcfbb');for(let line=0;line<8;line++)rect(x+14,106+line*7,40,1,'#8e7586');for(let i=0;i<9;i++)rect(x+18+(i%4)*9,105+Math.floor(i/4)*23+(i%3)*7,5,3,'#4b465a');}
   rect(57,180,145,55,'#181528');rect(61,184,137,5,'#715369');rect(61,224,137,7,'#674e65');for(let i=0;i<12;i++){rect(66+i*10,192+(i%3)*3,8,31-(i%3)*3,['#5b516e','#7d626f','#3e6873','#8b7459'][i%4]);rect(68+i*10,197+(i%3)*3,4,2,'#b39c9d');}
   // The side piano and bench stay off the giant keyboard walking surface.
   rect(785,194,129,42,'#111225');rect(795,184,104,15,'#3e354e');rect(789,237,9,29,'#171526');rect(901,237,9,29,'#171526');rect(797,191,101,4,'#77617d');rect(818,169,42,25,'#665167');rect(823,171,33,21,'#e0ccbb');for(let line=0;line<4;line++)rect(828,176+line*4,23,1,'#947c8c');
   for(let x=795;x<901;x+=8)rect(x,216,7,16,'#e9e4e9');for(let x=800;x<895;x+=16)rect(x,215,4,11,'#1a1930');
   if(roomChopin.visible)text('FRÉDÉRIC CHOPIN',roomChopin.x,roomChopin.y-129,12,'#dec4ef');
   }
   if(backdropReady){
    g.drawImage(roomEditor?.getBackground()||roomBaseArtwork||roomBackdrop,0,0,1000,620);
    // Preserve the painting's neon frame, scanlines, and polished piano keys.
    // Only the current note, key lighting, and optional letter names are live.
   }
   vibe?.drawAtmosphere?.(g,{width:ROOM.width,height:ROOM.height,time:roomClock,lights:[]});
   if(backdropReady){text('PIANO LAB',500,102,15,'#e4c9f4');text(lastWallNote===null?'♪':noteLetter(lastWallNote),500,153,46,lastWallNote===null?'#637fa8':'#b7ffe6');text(help,500,178,10,'#b1b6d9');}
   const score=wallStaffState();if(score.visible)win.CodaPianoWallNotation?.draw?.(g,{score,...score.bounds,time:roomClock,reducedMotion:win.matchMedia?.('(prefers-reduced-motion:reduce)').matches===true});
   const keyWidth=ROOM.keyW/WHITE_OFFSETS.length,expected=targetMidi();
   function floorKey(offset,left,width,black){const midi=(octave+1)*12+offset,active=held.has(midi),next=midi===expected;rect(left,ROOM.keyY,width-2,black?112:ROOM.keyH,active?'#d789c6':next?'#91dbca':black?'#201f35':'#d9d6de');rect(left+2,ROOM.keyY+2,width-6,black?97:ROOM.keyH-14,active?'#efafe0':next?'#b0f9e7':black?'#343047':'#f1edf0');if(showNames)text(noteLetter(midi),left+width/2,ROOM.keyY+(black?90:163),black?14:18,black?'#d4cce0':'#5b536c');}
   if(backdropReady){
    for(const key of paintedKeys){
     const midi=(octave+1)*12+key.offset,active=held.has(midi),next=midi===expected;
     if(active||next){g.save();g.beginPath();g.moveTo(...key.polygon[0]);for(let at=1;at<key.polygon.length;at++)g.lineTo(...key.polygon[at]);g.closePath();g.globalCompositeOperation='screen';const pulse=win.matchMedia?.('(prefers-reduced-motion:reduce)').matches?0:(Math.sin(roomClock*4)+1)*.045;g.fillStyle=active?'#ffbde8':'#60ffd1';g.globalAlpha=active?.62:.38+pulse;g.fill();g.globalCompositeOperation='source-over';g.globalAlpha=1;g.strokeStyle='#102e47';g.lineWidth=7;g.stroke();g.strokeStyle=active?'#fff5ff':'#f7ff99';g.lineWidth=4;g.stroke();g.restore();}
     if(showNames){const x=key.polygon.reduce((sum,point)=>sum+point[0],0)/4,y=key.black?key.polygon[2][1]-9:key.polygon[2][1]-11;g.font='bold '+(keyLabelSize(key.black))+'px monospace';g.textAlign='center';g.lineWidth=3;g.strokeStyle='#111533';g.strokeText(displayNote(midi),x,y);g.fillStyle=key.black?'#eeefff':'#242c5a';g.fillText(displayNote(midi),x,y);}
    }
   }else{
    rect(ROOM.keyX-9,ROOM.keyY-9,ROOM.keyW+18,ROOM.keyH+21,'#111426');rect(ROOM.keyX-4,ROOM.keyY-4,ROOM.keyW+8,ROOM.keyH+13,'#76627d');
    WHITE_OFFSETS.forEach((offset,index)=>floorKey(offset,ROOM.keyX+index*keyWidth,keyWidth,false));BLACK_KEYS.forEach(([offset,index])=>floorKey(offset,ROOM.keyX+(index-.31)*keyWidth,keyWidth*.62,true));
   }
   roomEditor?.afterBackground(g,roomPlayer.y);
   const chopinLook=vibe?.characterAppearance?.(CHOPIN_APPEARANCE,{id:'chopin',role:'npc'})||CHOPIN_APPEARANCE;
   const actors=[...(roomChopin.visible?[{x:roomChopin.x,y:roomChopin.y,id:'chopin'}]:[]),{x:roomPlayer.x,y:roomPlayer.y,id:'player'}].sort((a,b)=>a.y-b.y);
   companion?.draw(g,roomClock);
   for(const actor of actors){g.save();g.translate(actor.x,actor.y);g.scale(1.5,1.5);if(renderer){if(actor.id==='player')renderer.drawPlayer(g,api.getAvatar?.()||{},{x:0,y:0,facing:roomPlayer.facing,walking:roomKeys.size>0||!!roomDest||roomFinger?.getState().following===true||!!(joystick.x||joystick.y),phase:roomPlayer.phase,jumpHeight:roomPlayer.jump/1.5},roomClock);else renderer.drawPlayer(g,chopinLook,{x:0,y:0,facing:'down',pixelTarget:'chopin',emote:reactionState().active?chopinReaction.emote:'',emoteTime:roomClock-chopinReaction.started},roomClock);}else{rect(-8,-45,16,15,actor.id==='player'?'#c38d6c':'#e6b99d');rect(-10,-28,20,20,actor.id==='player'?'#92959c':'#282b42');rect(-9,-8,7,8,'#404257');rect(2,-8,7,8,'#404257');}if(actor.id==='chopin')vibe?.drawCharacterCostume?.(g,{id:'chopin',role:'npc',x:0,y:0,scale:1,facing:'down',time:roomClock});vibe?.drawCharacterGlow?.(g,{x:0,y:actor.id==='player'?-roomPlayer.jump/1.5:0,facing:actor.id==='player'?roomPlayer.facing:'down',time:roomClock,scale:1});g.restore();}
   const chopinLabelOffset=Math.max(78,(renderer?.labelOffset?.(chopinLook,'chopin')||52)*1.5);
   if(backdropReady&&roomChopin.visible){g.font='bold 12px monospace';g.textAlign='center';g.lineWidth=3;g.strokeStyle='#10142c';g.strokeText('CHOPIN',roomChopin.x,roomChopin.y-chopinLabelOffset);g.fillStyle='#e8d7f5';g.fillText('CHOPIN',roomChopin.x,roomChopin.y-chopinLabelOffset);}
   if(roomChopin.visible&&reactionState().active){const x=clamp(roomChopin.x,120,880),y=roomChopin.y-Math.max(116,chopinLabelOffset+36);rect(x-112,y,224,27,'#172538');text(chopinReaction.text,x,y+18,12,'#fff3ba');}
   if(nearChopin()){rect(roomChopin.x-109,roomChopin.y+13,220,29,'#172538');text('E · TALK TO CHOPIN',roomChopin.x+1,roomChopin.y+33,13,'#b7f6e4');}
   if(challengeMode!=='free'&&floorNote!==null){rect(roomPlayer.x-70,roomPlayer.y+12,140,27,'#172538');text('E · PLAY '+displayNote(floorNote),roomPlayer.x,roomPlayer.y+31,13,'#ffddb0');}
   if(!backdropReady){rect(26,610,948,4,'#8b5c9a');rect(30,615,940,3,'#332a4b');}
   roomEditor?.afterScene(g,roomPlayer.y);if(cameraActive)roomCamera.end(g);
   const mirror=el('pianoWallStaff');mirror.hidden=!score.visible||!score.mirror;el('pianoWallNote').hidden=!mirror.hidden;mirror.setAttribute('aria-label',(score.label||'Piano challenge')+'. '+(score.answerHidden?'Your played notes only.':'Read the highlighted note on the staff.'));if(!mirror.hidden)win.CodaPianoWallNotation?.draw?.(mirror.getContext('2d'),{score,x:0,y:0,width:428,height:120,time:roomClock,reducedMotion:win.matchMedia?.('(prefers-reduced-motion:reduce)').matches===true});
  }
  function roomTick(timestamp){if(!opened)return;const dt=frameTime?Math.min(.05,(timestamp-frameTime)/1000):0;frameTime=timestamp;if(roomEditor?.isEditing()||blocked()){drawRoom();roomFrame=win.requestAnimationFrame(roomTick);return;}roomClock+=dt;
   let dx=(roomKeys.has('d')||roomKeys.has('arrowright')?1:0)-(roomKeys.has('a')||roomKeys.has('arrowleft')?1:0),dy=(roomKeys.has('s')||roomKeys.has('arrowdown')?1:0)-(roomKeys.has('w')||roomKeys.has('arrowup')?1:0);
   const finger=roomFinger?.getState(),fingerTarget=finger?.following?finger.target:null;let speedScale=1;
   if(pinchBlocked()){clearJoystick();dx=dy=0;roomDest=null;}else if(dx||dy){roomFinger?.stop('direction-controls');roomDest=null;}else if(joystick.x||joystick.y){dx=joystick.x;dy=joystick.y;speedScale=Math.hypot(dx,dy);roomDest=null;}else if(fingerTarget){const point=roomPoint(fingerTarget.clientX,fingerTarget.clientY);dx=clamp(point.x,0,ROOM.width)-roomPlayer.x;dy=clamp(point.y,0,ROOM.height)-roomPlayer.y;if(Math.hypot(dx,dy)<3)dx=dy=0;}else if(roomDest){dx=roomDest.x-roomPlayer.x;dy=roomDest.y-roomPlayer.y;if(Math.hypot(dx,dy)<3){roomDest=null;dx=dy=0;}}
   const distance=Math.hypot(dx,dy);if(distance){const step=Math.min(220*speedScale*dt,roomDest||fingerTarget?distance:Infinity),mx=dx/distance*step,my=dy/distance*step,parts=Math.max(1,Math.ceil(step/4)),before={x:roomPlayer.x,y:roomPlayer.y};const safe=(x,y)=>{if(x<0||x>ROOM.width||y<0||y>ROOM.height)return false;const base=x>=50&&x<=950&&y>=250&&y<=590&&(!roomChopin.visible||Math.hypot(x-roomChopin.x,y-roomChopin.y)>30);return roomEditor?roomEditor.walkable(x,y,base):base;};for(let index=0;index<parts;index++){if(safe(roomPlayer.x+mx/parts,roomPlayer.y))roomPlayer.x+=mx/parts;if(safe(roomPlayer.x,roomPlayer.y+my/parts))roomPlayer.y+=my/parts;}const moved=Math.hypot(roomPlayer.x-before.x,roomPlayer.y-before.y);if(moved<.01)roomDest=null;roomPlayer.phase+=moved/14;roomPlayer.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';}
   if(roomPlayer.jump>0||roomPlayer.velocity>0){roomPlayer.velocity-=650*dt;roomPlayer.jump=Math.max(0,roomPlayer.jump+roomPlayer.velocity*dt);if(!roomPlayer.jump)roomPlayer.velocity=0;}
   companion?.update(roomPlayer,dt,'piano');syncFloorNote();drawRoom();roomFrame=win.requestAnimationFrame(roomTick);
  }
  function pointerUp(event){const midi=pointerKeys.get(event.pointerId);if(midi===undefined)return;pointerKeys.delete(event.pointerId);release(midi,'pointer:'+event.pointerId);}
  function isTyping(target){return /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName)||target?.isContentEditable;}
  function keyDown(event){
   if(!opened||event.defaultPrevented||roomEditor?.isEditing()||event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.key==='Escape'){if(fullscreen?.handleEscape(event))return;event.preventDefault();event.stopPropagation?.();if(dialogueOpen)closeDialogue();else if(menuOpen)setMobileView('room',true);else close();return;}
   if(event.key==='Tab'){const controls=Array.from((dialogueOpen?el('pianoDialogueBackdrop'):menuOpen?el('pianoMenuBackdrop'):host).querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]')).filter(node=>!node.hidden&&node.getClientRects().length);if(!controls.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&(doc.activeElement===first||!host.contains(doc.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(doc.activeElement===last||!host.contains(doc.activeElement))){event.preventDefault();first.focus();}return;}
   if(dialogueOpen)return;if(menuOpen&&(mobileView!=='keyboard'||event.target?.closest?.('button')&&!event.target?.classList?.contains('piano-key')))return;if(isTyping(event.target))return;if(pinchBlocked()){event.preventDefault();return;}
   const key=event.key.toLowerCase(),inRoom=!blocked()&&(event.target===el('pianoRoomCanvas')||keyboardMode==='walk'&&!event.target?.classList?.contains('piano-key'));
   if(inRoom&&['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright'].includes(key)){event.preventDefault();clearJoystick();roomFinger?.stop('direction-controls');roomKeys.add(key);return;}
   if(inRoom&&key==='e'){event.preventDefault();if(event.repeat)return;if(floorNote!==null&&challengeMode!=='free')press(floorNote,'floor-intent');else if(nearChopin())talkChopin();return;}
   if(inRoom&&event.code==='Space'){event.preventDefault();if(!event.repeat&&!roomPlayer.jump){roomPlayer.velocity=280;roomPlayer.jump=.1;}return;}
   // A focused piano key uses Space as a button; elsewhere Space is the pedal.
   if(event.code==='Space'&&!event.target?.classList?.contains('piano-key')){event.preventDefault();if(!event.repeat)setSustain(true);return;}
   if(menuOpen&&(mobileView!=='keyboard'||keyboardMode!=='piano'))return;const offset=SHORTCUTS.indexOf(event.key.toLowerCase());if(offset<0)return;event.preventDefault();if(event.repeat)return;const midi=(octave+1)*12+offset;computerKeys.set(event.code||event.key,midi);press(midi,'keyboard:'+(event.code||event.key));
  }
  function keyUp(event){if(!opened)return;roomKeys.delete(event.key.toLowerCase());if(event.key.toLowerCase()==='e'&&floorNote!==null)release(floorNote,'floor-intent');if(event.code==='Space'&&!event.target?.classList?.contains('piano-key')){event.preventDefault();setSustain(false);}const code=event.code||event.key,midi=computerKeys.get(code);if(midi!==undefined){event.preventDefault();computerKeys.delete(code);release(midi,'keyboard:'+code);}}
  function controlMove(x,y){
   if(!Number.isFinite(x)||!Number.isFinite(y)||!opened||destroyed||doc.hidden||blocked()||mobileView!=='room'||roomEditor?.isEditing()||pinchBlocked()){clearJoystick();return false;}
   const length=Math.hypot(x,y),scale=Math.max(1,length);joystick.x=x/scale;joystick.y=y/scale;
   if(length){roomFinger?.stop('joystick');roomDest=null;roomKeys.clear();}
   return true;
  }
  function control(raw,pressed){
   const key=raw==='Space'?' ':String(raw).toLowerCase();
   if(!opened||destroyed||pressed&&(blocked()||roomEditor?.isEditing()||pinchBlocked())||!['w','a','s','d','arrowup','arrowleft','arrowdown','arrowright','e',' '].includes(key))return false;
   const target=el('pianoRoomCanvas'),event={key,code:key===' '?'Space':'',target,preventDefault(){},repeat:false,defaultPrevented:false};
   if(pressed){if(touchHeld.has(key))return true;target.focus({preventScroll:true});touchHeld.add(key);keyDown(event);}else{touchHeld.delete(key);keyUp(event);}
   return true;
  }
  function releaseControls(){clearJoystick();if(!pinchBlocked())roomFinger?.stop('controls-released');for(const key of Array.from(touchHeld))control(key,false);touchHeld.clear();roomKeys.clear();roomDest=null;}
  function blur(){clearJoystick();roomFinger?.stop('blur');roomKeys.clear();roomDest=null;if(opened){releaseAll(true);setSustain(false);}}
  function visibility(){if(doc.hidden)blur();}
  function open(){if(destroyed||opened)return;priorFocus=doc.activeElement;opened=true;host.hidden=false;host.scrollTop=0;companion?.reset(roomPlayer,'piano');setMobileView('room');loadTake();updateRecordingUI();el('pianoRoomCanvas').focus({preventScroll:true});frameTime=0;roomFrame=win.requestAnimationFrame(roomTick);api.onOpen?.();}
  function close(){clearJoystick();if(!opened)return;challengeRun=null;fullscreen?.exit();stopDemo();menuOpen=dialogueOpen=false;syncPanels();roomEditor?.close();stopRecording();stopPlayback();releaseAll(true);setSustain(false);roomFinger?.stop('closed');roomKeys.clear();opened=false;host.hidden=true;win.cancelAnimationFrame(roomFrame);frameTime=0;roomDest=null;try{context?.suspend().catch(()=>{});}catch{}api.onClose?.();if(priorFocus?.isConnected&&!host.contains(priorFocus))priorFocus.focus({preventScroll:true});}
  function getState(){return {open:opened,fullscreen:fullscreen?.getState()||{active:false,mode:'off',pending:false},menuOpen,dialogueOpen,dialogueKind,blocked:blocked(),companion:companion?.getState()||null,melodyMode,listening,challengeRun:challengeRun?{...challengeRun}:null,learned:Array.from(learned),pendingReward:pendingReward?{...pendingReward}:null,joystick:joystickState(),editor:roomEditor?.getState()||null,camera:roomCamera?.getState()||{x:0,y:0,zoom:1,pinching:pinchBlocked()},mobileView,fingerWalk:roomFinger?.getState()||null,octave,volume,sustain,held:Array.from(held.keys()),voiceCount:voices.size,audioState:context?.state||'closed',recording,playing,recorded:recorded.map(note=>({...note})),lesson:lesson?.id||null,lessonStep,lessonLength:lesson?.notes.length||0,challengeMode,scale:lesson?.kind==='scale'?lesson.id:null,scaleStep:lesson?.kind==='scale'?lessonStep:0,wallStaff:wallStaffState(),keyHighlight:keyHighlightState(),chopinReaction:reactionState(),playedChallengeNotes:playedChallengeNotes.slice(),lessonPitches:lesson?.notes.map(offset=>(octave+1)*12+offset)||[],lessonScore:lesson?.events?.map(event=>({...event}))||[],melodyRegister:lesson?.register?{baseMidi:lesson.register.baseMidi,lowest:lesson.register.lowest,highest:lesson.register.highest,first:lesson.register.first}:null,interval:interval?{...interval}:null,intervalStep,completed:Array.from(completed),showNames,keyboardMode,lastWallNote,floorNote,player:{...roomPlayer},chopin:{...roomChopin,name:'Frédéric Chopin'},background:{ready:backdropReady,url:api.backgroundUrl||null},floorKeys:backdropReady?paintedKeys.map(key=>({midi:(octave+1)*12+key.offset,black:key.black,polygon:key.polygon.map(point=>point.slice())})):[]};}
  function destroy(){close();fullscreen?.destroy();roomEditor?.destroy();roomCamera?.destroy();roomFinger?.dispose();destroyed=true;win.removeEventListener('keydown',keyDown);win.removeEventListener('keyup',keyUp);win.removeEventListener('pointerup',pointerUp);win.removeEventListener('pointercancel',pointerUp);win.removeEventListener('blur',blur);doc.removeEventListener('visibilitychange',visibility);try{context?.close().catch(()=>{});}catch{}}
  fullscreen=win.createCodaRoomFullscreen?.({host,button:el('pianoFullscreen'),label:'Piano Lab',onBeforeChange:()=>{releaseAll();roomDest=null;},onChange:()=>{roomCamera?.update();if(opened)drawRoom();api.onViewChange?.(mobileView);}})||null;if(!fullscreen)el('pianoFullscreen').disabled=true;
  el('closepiano').addEventListener('click',close);el('pianoPanic').addEventListener('click',()=>{stopPlayback();releaseAll(true);setSustain(false);message('All notes released.');});
  el('pianoSustain').addEventListener('click',()=>setSustain(!sustain));el('pianoVolume').addEventListener('input',event=>{volume=Number(event.target.value)/100;if(master&&context)master.gain.setTargetAtTime(volume*.24,context.currentTime,.02);});
  el('pianoOctave').addEventListener('change',event=>{if(challengeMode==='melody'||challengeMode==='scale'){event.target.value=String(octave);return;}stopPlayback();releaseAll();octave=Number(event.target.value);drawKeys();lessonStep=0;intervalStep=0;renderLesson();updateGameInstructions();if(interval)startInterval();});
  el('pianoRecord').addEventListener('click',toggleRecording);el('pianoPlayback').addEventListener('click',togglePlayback);el('pianoClear').addEventListener('click',()=>{recorded=[];persistTake();updateRecordingUI();message('Recording cleared.');});
  el('pianoLesson').addEventListener('change',event=>{if(event.target.value)prepareMelody(event.target.value);else{chooseLesson('');returnToFloor();}});el('pianoLessonRestart').addEventListener('click',()=>lesson?.kind==='scale'?prepareScale(lesson.id,melodyMode):prepareMelody(lesson?.id,melodyMode));
  el('pianoStartScale').addEventListener('click',()=>prepareScale(el('pianoScale').value));el('pianoTalkChopin').addEventListener('click',talkChopin);el('pianoStartInterval').addEventListener('click',startInterval);el('pianoFreePlay').addEventListener('click',()=>{el('pianoLesson').value='';chooseLesson('');message('Free play: step onto any giant key to make it sing.');returnToFloor();});
  el('pianoKeyNames').addEventListener('change',event=>{showNames=event.target.checked;for(const span of host.querySelectorAll('.piano-key-name'))span.hidden=!showNames;});
  el('pianoKeyboardMode').addEventListener('change',event=>{keyboardMode=event.target.value;releaseAll();});
  el('pianoMenuButton').addEventListener('click',()=>setMobileView('games',true));el('pianoMenuClose').addEventListener('click',()=>setMobileView('room',true));el('pianoDialogueClose').addEventListener('click',()=>closeDialogue());el('pianoMemoryStart').addEventListener('click',prepareActiveMemory);el('pianoListenMelody').addEventListener('click',()=>{if(lesson){if(lesson.kind==='scale')prepareScale(lesson.id,melodyMode,false);else prepareMelody(lesson.id,melodyMode,false);demonstrate(lesson.id,melodyMode);}});
  roomFinger=win.createCodaFingerWalk?.({canvas:el('pianoRoomCanvas'),enabled:()=>opened&&!destroyed&&!blocked()&&!roomEditor?.isEditing()&&mobileLayout()&&mobileView==='room',onStart:()=>{clearJoystick();roomDest=null;roomKeys.clear();el('pianoRoomCanvas').focus({preventScroll:true});},onStop:()=>{roomDest=null;},onPinch:gesture=>roomCamera?.onPinch(gesture)})||null;
  const Camera=win.createCodaRoomCamera||win.createCodaCaveCamera;
  if(Camera){host.classList.add('piano-follow-camera');roomCamera=Camera({canvas:el('pianoRoomCanvas'),width:ROOM.width,height:ROOM.height,viewportElement:host.querySelector('.piano-room-canvas-viewport'),label:'Piano room',className:'piano-camera-controls',maxZoom:3,enabled:()=>opened&&!destroyed&&!dialogueOpen&&(!menuOpen||mobileView==='settings')&&!roomEditor?.isEditing(),getFocus:()=>roomPlayer,getGestureState:()=>roomFinger?.getState(),onGestureStart:()=>{clearJoystick();roomDest=null;roomKeys.clear();touchHeld.clear();roomPlayer.jump=roomPlayer.velocity=0;releaseAll();setSustain(false);}});if(mobileLayout())roomCamera.setZoom(2);}
  el('pianoRoomCanvas').addEventListener('pointerdown',roomPointer);
  win.addEventListener('keydown',keyDown);win.addEventListener('keyup',keyUp);win.addEventListener('pointerup',pointerUp);win.addEventListener('pointercancel',pointerUp);win.addEventListener('blur',blur);doc.addEventListener('visibilitychange',visibility);
  for(const button of host.querySelectorAll('[data-piano-view]'))button.addEventListener('click',()=>setMobileView(button.dataset.pianoView,true));
  win.CodaMusicNotation?.load?.(doc).catch?.(()=>{});loadProgress();drawKeys();loadTake();updateRecordingUI();renderLesson();setMobileView('room');
  function openDeveloperConsole(tab='objects'){
   if(!opened||destroyed||!roomEditor||api.canDevelop?.()===false)return false;
   closeDialogue(false);stopRecording();stopPlayback();setMobileView('room');
   roomEditor.open(tab);return roomEditor.isOpen();
  }
  roomEditor=win.createCodaRoomDeveloperEditor?.({id:'piano',name:'Piano Lab',host,canvas:el('pianoRoomCanvas'),width:ROOM.width,height:ROOM.height,renderer,getAvatar:api.getAvatar,storage,canEdit:()=>opened&&!destroyed&&api.canDevelop?.()!==false&&!blocked(),baseWalkable:(x,y)=>x>=50&&x<=950&&y>=250&&y<=590&&(!roomChopin.visible||Math.hypot(x-roomChopin.x,y-roomChopin.y)>30),
   getSharedSprites:api.getSharedSprites,setSharedSprites:api.setSharedSprites,getPixelProfile:id=>id==='chopin'?{name:'Chopin',skin:'#e6b99d',hair:'#493239',shirt:'#282b42',lowerColor:'#3d3a4a',hairstyle:'long',outfit:'coat',shoes:'oxfords',accessory:'bowtie'}:api.getAvatar?.()||{},getPixelTargets:()=>[{id:'player',name:'Your avatar'},{id:'chopin',name:'Frédéric Chopin'}],
   getBackground:()=>roomBaseArtwork||roomBackdrop,getEntities:()=>[{id:'chopin',name:'Frédéric Chopin',kind:'npc',...roomChopin,w:40,h:64}],
   onEntityChange:(id,patch)=>{if(id==='chopin')Object.assign(roomChopin,{x:860,y:306,visible:true},patch);},
   onActiveChange:active=>{roomFinger?.stop('editor');releaseControls();roomKeys.clear();roomDest=null;stopRecording();stopPlayback();releaseAll(true);setSustain(false);roomPlayer.jump=roomPlayer.velocity=0;frameTime=0;if(active){challengeRun=null;closeDialogue(false);setMobileView('room');}},
   onProjectChange:(before,after)=>api.onEditorProjectChange?.(before,after)
  })||null;
  const developerButton=host.querySelector('[data-room-dev-open]'),developerPanel=host.querySelector('[data-room-editor="piano"]');
  if(developerPanel)developerPanel.id='room-dev-console-piano';
  if(developerButton){
   host.querySelector('.piano-room-heading-actions').insertBefore(developerButton,el('pianoMenuButton'));
   developerButton.textContent='Developer';developerButton.title='Open Piano Lab developer console (F2)';developerButton.setAttribute('aria-controls','room-dev-console-piano');
   developerButton.onclick=()=>{if(roomEditor.isOpen())roomEditor.close();else openDeveloperConsole();};
  }
  const cameraControls=host.querySelector('.piano-camera-controls');if(cameraControls)el('pianoRoomTools').append(cameraControls);drawRoom();
  return {open,close,destroy,openDeveloperConsole,getState,getControlState:()=>({open:opened,mobileView,menuOpen,dialogueOpen,blocked:blocked(),challengeMode,editing:roomEditor?.isEditing()||false,pinching:pinchBlocked()}),control,controlMove,releaseControls,setMobileView,getEditor:()=>roomEditor};
 }
 const exported={createCodaPianoLab,noteName,noteLetter,keyPositionName,frequency,fitMelodyRegister,LESSONS,SCALES,INTERVALS,paintedFloorKeys,polygonContains};
 if(typeof module==='object'&&module.exports)module.exports=exported;else root.createCodaPianoLab=createCodaPianoLab;
})(typeof window==='object'?window:globalThis);
