/* A smaller view of the existing Song Machine state and playback engine. */
(function(root){
 'use strict';
 const LENGTHS=[{steps:16,label:'Whole'},{steps:8,label:'Half'},{steps:4,label:'Quarter'},{steps:2,label:'Eighth'},{steps:1,label:'Sixteenth'}];
 const PITCHES=Array.from({length:36},(_,index)=>83-index),DRUM_NAMES=['Kick','Snare','Hi-hat'];
 const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 function create(api){
  const doc=root.document,$=id=>doc.getElementById(id),main=doc.querySelector('main'),editorTitle=doc.querySelector('body>header h1'),advancedTitle=editorTitle.textContent;
  let mode='simple',selectedTrack=null,rendering=false,gridMode='scroll',soundListOpen=false,unlockOpen=false,unlockFocus=null,unlockInert=[];
  try{if(root.localStorage.getItem('codaSongEditorModeV1')==='advanced')mode='advanced';}catch{}
  const toggle=doc.createElement('button');toggle.id='songEditorMode';toggle.type='button';toggle.className='song-editor-mode';toggle.setAttribute('aria-controls','simpleSongEditor gridview');
  const header=doc.querySelector('body>header');header.insertBefore(toggle,header.querySelector('.song-master-volume')||null);
  const host=doc.createElement('section');host.id='simpleSongEditor';host.setAttribute('aria-label','Simple song composer');
  host.innerHTML=`<div class="simple-song-toolbar"><div class="simple-song-transport" role="group" aria-label="Simple playback controls"><button type="button" id="simplePlay" class="primary">▶ Play</button><button type="button" id="simpleStop">■ Stop</button><button type="button" id="simpleUndo" disabled>↶ Undo</button><button type="button" id="simpleLoop" aria-pressed="false">Loop: Off</button></div><label class="simple-tempo">Tempo <output id="simpleBpmValue">110 BPM</output><input id="simpleBpm" type="range" min="40" max="240" step="1" value="110" aria-label="Simple tempo in beats per minute"></label><label class="simple-instrument">Part<select id="simpleInstrument" aria-label="Part to edit"></select></label><button type="button" id="simpleMenu" aria-haspopup="dialog" aria-controls="settings-panel" aria-expanded="false">Menu</button></div><div id="simpleNotePalette" class="simple-note-palette" role="group" aria-label="Choose a note length">${LENGTHS.map(item=>`<button type="button" data-duration="${item.steps}" aria-label="${item.label} note" aria-pressed="false">${root.CodaMusicNotation.glyphSVG(item.steps/4)}<span>${item.label}</span></button>`).join('')}</div><div class="simple-song-caption"><p id="simpleEditingLabel"></p><span id="simpleLengthHint"></span></div><div class="simple-song-gesture" role="group" aria-label="Simple grid gesture mode"><button type="button" data-simple-grid-mode="scroll" aria-pressed="true">Tap &amp; scroll</button><button type="button" data-simple-grid-mode="draw" aria-pressed="false">Draw note lengths</button></div><p id="simpleSongHelp" class="simple-song-help">Choose a note length, then tap a square. Tap your note again to erase it. Swipe to explore the grid.</p><div id="simpleSongGrid" class="simple-song-grid-wrap" tabindex="-1" aria-label="Three octaves and three drum rows"></div><p id="simpleStatus" class="simple-song-status" role="status" aria-live="polite"></p>`;
  main.prepend(host);
  const close=doc.createElement('button');close.id='simpleMenuClose';close.type='button';close.textContent='Back to song';close.dataset.simpleOnly='true';$('settings-panel').prepend(close);
  const soundLabel=doc.createElement('label');soundLabel.id='simpleSoundLabel';soundLabel.dataset.simpleOnly='true';soundLabel.innerHTML='Instrument sound<select id="simpleSound" aria-label="Sound for the selected instrument"></select>';$('settings-panel').querySelector('.settings-fields').before(soundLabel);
  const settings=$('settings-panel'),originalHeading=settings.querySelector('h2'),settingsHelp=settings.querySelector('.help'),advancedHelp=settingsHelp.textContent;
  // Changing a voice edits this part; making another part is a separate choice.
  soundLabel.hidden=true;$('simpleSound').tabIndex=-1;
  const picker=doc.createElement('div');picker.className='simple-sound-chooser';picker.innerHTML='<span id="simpleSoundPickerLabel">Sound</span><button type="button" id="simpleSoundPicker" aria-labelledby="simpleSoundPickerLabel simpleSoundName" aria-haspopup="listbox" aria-controls="simpleSoundList" aria-expanded="false"><span id="simpleSoundName"></span><span aria-hidden="true">▾</span></button><div id="simpleSoundList" role="listbox" aria-label="Instrument sounds" hidden></div>';
  $('simpleInstrument').closest('label').after(picker);
  const unlock=doc.createElement('div');unlock.id='simpleUnlockBackdrop';unlock.className='simple-unlock-backdrop';unlock.hidden=true;unlock.innerHTML='<section class="simple-unlock-panel" role="dialog" aria-modal="true" aria-labelledby="simpleUnlockTitle" aria-describedby="simpleUnlockRequirement simpleUnlockProgress"><h2 id="simpleUnlockTitle"></h2><p id="simpleUnlockRequirement"></p><p id="simpleUnlockProgress"></p><button type="button" id="simpleUnlockClose">Got it</button></section>';doc.body.append(unlock);
  function catalog(){const progress=api.getProgress();return api.getSoundCatalog().map(item=>({...item,locked:item.level>progress.level}));}
  function soundOptions(){return [...$('simpleSoundList').querySelectorAll('[data-sound-option]')];}
  function closeSoundList(focus=false){soundListOpen=false;$('simpleSoundList').hidden=true;$('simpleSoundPicker').setAttribute('aria-expanded','false');if(focus)$('simpleSoundPicker').focus({preventScroll:true});}
  function focusSound(index){const options=soundOptions();if(!options.length)return;const target=options[Math.max(0,Math.min(options.length-1,index))];for(const option of options)option.tabIndex=option===target?0:-1;target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});}
  function placeSoundList(){const box=$('simpleSoundPicker').getBoundingClientRect(),width=Math.min(340,root.innerWidth-24),height=Math.min(420,root.innerHeight-24);let top=box.bottom+6,space=root.innerHeight-top-12;if(space<160){top=box.top-height-6;space=height;if(top<12)top=12;}const list=$('simpleSoundList');list.style.left=Math.max(12,Math.min(box.left,root.innerWidth-width-12))+'px';list.style.top=top+'px';list.style.width=width+'px';list.style.maxHeight=Math.max(80,Math.min(space,root.innerHeight-top-12))+'px';}
  function openSoundList(last=false){if(!selected()||unlockOpen)return;api.cancelGesture();renderSoundPicker();soundListOpen=true;$('simpleSoundList').hidden=false;placeSoundList();$('simpleSoundPicker').setAttribute('aria-expanded','true');const options=soundOptions(),current=options.findIndex(option=>+option.dataset.soundOption===selected().sound);focusSound(last?options.length-1:Math.max(0,current));}
  function closeUnlock(focus=true){if(!unlockOpen)return;unlockOpen=false;unlock.hidden=true;for(const [node,value]of unlockInert)node.inert=value;unlockInert=[];if(focus)(unlockFocus?.isConnected?unlockFocus:$('simpleSoundPicker')).focus({preventScroll:true});}
  function explainUnlock(item){
   const progress=api.getProgress(),threshold=api.levelThresholds[item.level-1],remaining=Number.isFinite(threshold)?Math.max(0,threshold-progress.xp):null;
   closeSoundList(false);unlockFocus=$('simpleSoundPicker');$('simpleUnlockTitle').textContent='🔒 '+item.name;$('simpleUnlockRequirement').textContent='Reach musician level '+item.level+' to unlock '+item.name+'.';
   $('simpleUnlockProgress').textContent='You are level '+progress.level+'. '+(remaining===null?'':remaining+' more XP to reach level '+item.level+'. ')+'Earn XP by playing games, finishing quests, and earning achievements.';
   unlockOpen=true;unlock.hidden=false;unlockInert=[main,doc.querySelector('body>header')].filter(Boolean).map(node=>[node,node.inert]);for(const [node]of unlockInert)node.inert=true;$('simpleUnlockClose').focus({preventScroll:true});
  }
  function chooseSound(value){const item=catalog().find(item=>item.id===value);if(!item||!selected())return;if(item.locked){explainUnlock(item);return;}api.setSound(selectedTrack,item.id);closeSoundList(true);}
  function renderSoundPicker(){
   const current=selected(),list=$('simpleSoundList');$('simpleSoundName').textContent=current?api.soundName(current.sound):'Choose a part';$('simpleSoundPicker').disabled=!current;
   const oldFocus=list.contains(doc.activeElement)?doc.activeElement.dataset.soundOption:null;
   list.innerHTML=catalog().map(item=>'<button type="button" role="option" id="simpleSoundOption-'+item.id+'" data-sound-option="'+item.id+'" data-locked="'+item.locked+'" data-required-level="'+item.level+'" tabindex="'+(current?.sound===item.id?'0':'-1')+'" aria-selected="'+(current?.sound===item.id)+'" aria-label="'+escape(item.name+(item.locked?', locked. Reach musician level '+item.level+' to unlock.':''))+'" class="simple-sound-option'+(item.locked?' is-locked':'')+'"><span>'+(item.locked?'🔒 ':'')+escape(item.name)+'</span>'+(item.locked?'<small>Level '+item.level+'</small>':'')+'</button>').join('');
   list.hidden=!soundListOpen;if(oldFocus!==null&&soundListOpen)list.querySelector('[data-sound-option="'+oldFocus+'"]')?.focus({preventScroll:true});
  }
  $('simpleSoundPicker').onclick=()=>soundListOpen?closeSoundList(true):openSoundList();
  $('simpleSoundPicker').onkeydown=event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();openSoundList(event.key==='End'||event.key==='ArrowUp');}};
  $('simpleSoundList').onclick=event=>{const option=event.target.closest('[data-sound-option]');if(option)chooseSound(+option.dataset.soundOption);};
  $('simpleSoundList').onkeydown=event=>{const options=soundOptions(),index=options.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();focusSound(event.key==='Home'?0:event.key==='End'?options.length-1:index+(event.key==='ArrowDown'?1:-1));}else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat&&index>=0)chooseSound(+options[index].dataset.soundOption);}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSoundList(true);}else if(event.key==='Tab'){event.preventDefault();closeSoundList(false);$(event.shiftKey?'simpleInstrument':'simpleMenu').focus({preventScroll:true});}else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){const from=options.slice(index+1).concat(options.slice(0,index+1)),match=from.find(option=>api.soundName(+option.dataset.soundOption).toLowerCase().startsWith(event.key.toLowerCase()));if(match){event.preventDefault();focusSound(options.indexOf(match));}}};
  $('simpleUnlockClose').onclick=()=>closeUnlock();unlock.addEventListener('pointerdown',event=>{if(event.target===unlock)closeUnlock();});
  doc.addEventListener('pointerdown',event=>{if(soundListOpen&&!picker.contains(event.target))closeSoundList(false);});
  doc.addEventListener('keydown',event=>{if(!unlockOpen)return;if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeUnlock();}else if(event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation();$('simpleUnlockClose').focus({preventScroll:true});}else event.stopImmediatePropagation();},true);

  function state(){return api.getState();}
  function selected(){const current=state();return current.tracks.find(track=>String(track.id)===selectedTrack)||null;}
  function ensureSelected(){const tracks=state().tracks;if(!tracks.some(track=>String(track.id)===selectedTrack))selectedTrack=tracks.length?String(tracks[0].id):null;}
  function syncMenu(){const open=mode==='simple'&&!settings.hidden;$('simpleMenu').setAttribute('aria-expanded',String(open));if(open){settings.setAttribute('role','dialog');settings.setAttribute('aria-modal','true');settings.setAttribute('aria-label','Song menu');}else{settings.removeAttribute('role');settings.removeAttribute('aria-modal');settings.removeAttribute('aria-label');}if(originalHeading)originalHeading.textContent=mode==='simple'?'Song menu':'Song Settings';}
  function closeMenu(focus=true){settings.hidden=true;$('settings-toggle').setAttribute('aria-expanded','false');syncMenu();if(focus&&mode==='simple')$('simpleMenu').focus({preventScroll:true});}
  function setMode(next){
   const value=next==='advanced'?'advanced':'simple';closeUnlock(false);closeSoundList(false);api.cancelGesture();api.cancelClear();closeMenu(false);mode=value;doc.body.dataset.editorMode=mode;
   const destination=mode==='simple'?'Advanced':'Simple';toggle.textContent='Switch to '+destination+' mode';toggle.setAttribute('aria-label',toggle.textContent);toggle.title='Current editor: '+(mode==='simple'?'Simple':'Advanced')+'. Switching views keeps your song.';editorTitle.textContent=mode==='simple'?'♫ Song Machine':advancedTitle;
   host.hidden=mode!=='simple';try{root.localStorage.setItem('codaSongEditorModeV1',mode);}catch{}
   settingsHelp.textContent=mode==='simple'?'Simple shows all notes. Advanced can hide notes outside your chosen scale. Your song can be up to 16 bars long.':advancedHelp;api.syncSharedPanels();render();return mode;
  }
  function svg(duration){return root.CodaMusicNotation.glyphSVG(duration/4);}
  function label(pitch){const band=pitch<60?'Low':pitch<72?'Middle':'High';return {band,name:api.noteName(pitch),label:band+' '+api.noteName(pitch)};}
  function row(pitch,drumIndex,count,measure){
   const current=state(),drum=drumIndex!==null,track=drum?current.drums[drumIndex]:selected(),id=drum?'d'+drumIndex:selectedTrack||'',pitchInfo=drum?null:label(pitch),title=drum?DRUM_NAMES[drumIndex]:pitchInfo.label;
   let html=`<div class="simple-song-row-label ${drum?'simple-drum-label':pitchInfo.band.toLowerCase()}" ${drum?`data-drum-row="${drumIndex}"`:`data-pitch="${pitch}"`} title="${escape(title)}">${drum?DRUM_NAMES[drumIndex]:pitch%12===0?escape(title):escape(pitchInfo.name)}</div>`;
   for(let step=0;step<count;step++){
    const own=track?.notes.find(note=>(drum||note.p===pitch)&&step>=note.t&&step<note.t+note.d);
    const ghost=!drum&&!own?current.tracks.find(other=>String(other.id)!==selectedTrack&&other.notes.some(note=>note.p===pitch&&step>=note.t&&step<note.t+note.d)):null;
    const other=ghost?.notes.find(note=>note.p===pitch&&step>=note.t&&step<note.t+note.d),note=own||other,start=note&&note.t===step;
    const colour=drum?'#d18bdf':api.pitchColors[pitch%12];
    const description=title+', bar '+(Math.floor(step/measure)+1)+', step '+(step%measure+1)+(own?', note':'')+(ghost?', '+ghost.name+' plays here':'');
    html+=`<div role="button" tabindex="${!drum&&pitch===PITCHES[0]&&step===0?'0':'-1'}" aria-label="${escape(description)}" aria-pressed="${!!own}" class="simple-song-cell cell ${drum?'perc ':''}${step%measure===0?'bar ':step%4===0?'beat ':''}${own?'filled ':ghost?'simple-ghost ':''}${start&&own?'start':''}" style="--pitch:${colour};--track:${colour}" data-track="${id}" data-pitch="${pitch}" data-step="${step}">${start?`<span class="simple-cell-note" aria-hidden="true">${svg(note.d)}</span>`:''}</div>`;
   }
   return html;
  }
  function render(){
   if(rendering)return;rendering=true;
   try{
    ensureSelected();const current=state(),track=selected();
    const instrumentOptions=current.tracks.map(item=>`<option value="${item.id}">${escape(item.name)}</option>`).join('')+(current.tracks.length<12?'<option value="add">+ New part</option>':'');
    $('simpleInstrument').innerHTML=instrumentOptions||'<option value="">No instruments</option>';if(selectedTrack)$('simpleInstrument').value=selectedTrack;renderSoundPicker();
    $('simpleBpm').value=current.bpm;$('simpleBpmValue').textContent=current.bpm+' BPM';
    $('simpleEditingLabel').textContent=track?'Editing '+track.name+' · Other parts play along':'Choose “New part” to write a melody.';
    $('simpleSound').innerHTML=track?api.soundOptions(track.sound):'';$('simpleSound').disabled=!track;
    $('simpleSoundLabel').firstChild.textContent=track?track.name+' sound':'Instrument sound';
    syncStatus();syncDuration();syncGridMode(gridMode);syncMenu();
    if(mode!=='simple')return;
    const wrap=$('simpleSongGrid'),scroll={left:wrap.scrollLeft,top:wrap.scrollTop},focused=doc.activeElement?.closest?.('.simple-song-cell'),focus=focused?{track:focused.dataset.track,pitch:focused.dataset.pitch,step:focused.dataset.step}:null;
    const count=api.total(),measure=api.measure();let html=`<div class="simple-song-pitch-grid" style="grid-template-columns:var(--simple-pitch-size) repeat(${count},var(--simple-step-size))"><div class="simple-bar-label simple-corner">Pitch / drums</div>`;
    for(let step=0;step<count;step++)html+=`<div class="simple-bar-label ${step%measure===0?'is-bar':''}">${step%measure===0?'Bar '+(Math.floor(step/measure)+1):''}</div>`;
    for(const pitch of PITCHES)html+=row(pitch,null,count,measure);
    for(let index=0;index<3;index++)html+=row(0,index,count,measure);
    wrap.innerHTML=html+'</div>';wrap.scrollLeft=scroll.left;wrap.scrollTop=scroll.top;
    if(focus)wrap.querySelector(`.simple-song-cell[data-track="${focus.track}"][data-pitch="${focus.pitch}"][data-step="${focus.step}"]`)?.focus({preventScroll:true});
   }finally{rendering=false;}
  }
  function syncDuration(){const duration=api.getDuration(),name=LENGTHS.find(item=>item.steps===duration)?.label;for(const button of $('simpleNotePalette').querySelectorAll('[data-duration]'))button.setAttribute('aria-pressed',String(+button.dataset.duration===duration));$('simpleLengthHint').textContent=name?name+' note selected':'Custom note length · choose a note above to change it';}
  function syncStatus(){if(!$('simpleStatus'))return;$('simpleStatus').textContent=$('status').textContent;$('simpleUndo').disabled=$('undo').disabled;$('simpleLoop').textContent=$('loop').textContent;$('simpleLoop').setAttribute('aria-pressed',String($('loop').classList.contains('active')));}
  function syncGridMode(next){gridMode=next==='draw'?'draw':'scroll';host.dataset.gridMode=gridMode;for(const button of doc.querySelectorAll('[data-simple-grid-mode]'))button.setAttribute('aria-pressed',String(button.dataset.simpleGridMode===gridMode));$('simpleSongHelp').textContent=gridMode==='draw'?'Tap to hear a note. Drag sideways to choose its length.':'Tap a square to hear it and add or erase a note. Swipe to explore.';}
  function setInstrument(id){closeSoundList(false);if(id==='add'){const added=api.addInstrument(selected()?.sound??0);if(added!==null&&added!==undefined)selectedTrack=String(added);}else if(state().tracks.some(track=>String(track.id)===String(id)))selectedTrack=String(id);render();}
  toggle.onclick=()=>setMode(mode==='simple'?'advanced':'simple');
  for(const [simple,original] of [['simplePlay','play'],['simpleStop','stop'],['simpleUndo','undo'],['simpleLoop','loop']])$(simple).onclick=()=>{$(original).click();syncStatus();};
  $('simpleBpm').oninput=event=>{$('bpm').value=event.target.value;$('bpm').dispatchEvent(new Event('input',{bubbles:true}));$('simpleBpmValue').textContent=state().bpm+' BPM';};
  $('simpleInstrument').onchange=event=>setInstrument(event.target.value);
  $('simpleSound').onchange=event=>{if(selectedTrack)api.setSound(selectedTrack,+event.target.value);};
  $('simpleNotePalette').onclick=event=>{const button=event.target.closest('[data-duration]');if(button){api.setDuration(+button.dataset.duration);syncDuration();}};
  $('duration').addEventListener('change',syncDuration);
  for(const button of doc.querySelectorAll('[data-simple-grid-mode]'))button.onclick=()=>api.setGridMode(button.dataset.simpleGridMode);
  $('simpleMenu').onclick=()=>{api.cancelGesture();api.cancelClear();settings.hidden=false;$('settings-toggle').setAttribute('aria-expanded','true');syncMenu();close.focus({preventScroll:true});};close.onclick=()=>closeMenu();
  settings.addEventListener('keydown',event=>{if(mode!=='simple'||settings.hidden)return;if(event.key==='Escape'){event.preventDefault();closeMenu();return;}if(event.key==='Tab'){const elements=[...settings.querySelectorAll('button,select,input,summary,a[href]')].filter(node=>!node.disabled&&!node.hidden&&node.getClientRects().length),first=elements[0],last=elements.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}}});
  root.addEventListener('resize',()=>closeSoundList(false));
  const grid=$('simpleSongGrid');grid.addEventListener('pointerdown',api.onDown);grid.addEventListener('pointermove',api.onMove);
  grid.addEventListener('keydown',event=>{const cell=event.target.closest('.simple-song-cell');if(!cell)return;const cells=[...grid.querySelectorAll('.simple-song-cell')],index=cells.indexOf(cell),columns=api.total(),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns}[event.key];if(offset){event.preventDefault();const next=cells[Math.max(0,Math.min(cells.length-1,index+offset))];cell.tabIndex=-1;next.tabIndex=0;next.focus();return;}if(event.key==='Enter'||event.key===' '){event.preventDefault();if(event.repeat)return;const id=cell.dataset.track,pitch=+cell.dataset.pitch,step=+cell.dataset.step,track=api.findTrack(id);if(!track)return;const drum=id.startsWith('d'),exists=track.notes.some(note=>(drum||note.p===pitch)&&step>=note.t&&step<note.t+note.d);api.auditionCell(id,pitch,api.getDuration());api.putNote(id,pitch,step,api.getDuration(),exists);}});
  for(const name of ['contextmenu','selectstart','dragstart'])grid.addEventListener(name,event=>{if(event.target.closest('.simple-song-cell'))event.preventDefault();});
  const observer=new MutationObserver(syncStatus);observer.observe($('status'),{subtree:true,childList:true,characterData:true});observer.observe($('undo'),{attributes:true,attributeFilter:['disabled']});observer.observe($('loop'),{attributes:true,childList:true,subtree:true});
  const gesture=host.querySelector('.simple-song-gesture');gesture.dataset.simpleOnly='true';settings.append(gesture);root.CodaMusicNotation.load(doc);setMode(mode);
  return {render,syncGridMode,getMode:()=>mode,setMode,getState:()=>({mode,selectedTrack,pitches:[...PITCHES],drumRows:3,gridMode,duration:api.getDuration(),soundListOpen,unlockOpen,soundOptions:catalog()}),setInstrument};
 }
 root.CodaSongSimpleMode={create};
})(window);
