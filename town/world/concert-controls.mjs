let controlId=0;
const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
const setAttribute=(element,name,value)=>{if(element.getAttribute(name)!==String(value))element.setAttribute(name,String(value));};
const musicIsOn=state=>Boolean(state.wanted&&!state.muted&&!['locked','empty','unavailable','inactive','destroyed'].includes(state.status));

function loadStyles(document){
 if(document.querySelector('link[data-concert-controls-styles]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./concert-controls.css?v=town-music-settings-1',import.meta.url).href;
 link.dataset.concertControlsStyles='';document.head.append(link);
}

/** The programme keeps one audio player; these views only change its preferences. */
export function mountConcertControls(concert,{canvas,onProgramme,toolbar,onSettingsOpen}={}){
 const document=canvas?.ownerDocument??globalThis.document,win=document?.defaultView??globalThis.window;
 if(!document?.createElement||!concert?.onChange)throw new TypeError('Concert controls need a document and a concert player.');
 loadStyles(document);
 const id=++controlId;
 const element=document.createElement('section');element.className='concert-controls';element.dataset.concertControls='';
 element.setAttribute('role','region');element.setAttribute('aria-label','Now playing at the Opera House');element.hidden=true;
 const current=document.createElement('div');current.setAttribute('aria-live','polite');current.setAttribute('aria-atomic','true');
 const track=document.createElement('strong');track.className='concert-controls__track';
 const composer=document.createElement('span');composer.className='concert-controls__composer';current.append(track,composer);
 const status=document.createElement('span');status.className='concert-controls__status';status.setAttribute('role','status');
 element.append(current,status);document.body.append(element);
 const controls=document.createElement('div');controls.className='concert-toolbar';controls.dataset.concertControls='';
 controls.setAttribute('role','group');controls.setAttribute('aria-label','Concert music controls');
 const musicButton=document.createElement('button');musicButton.type='button';musicButton.className='concert-controls__music';musicButton.textContent='Music off';musicButton.setAttribute('aria-pressed','false');
 const settingsButton=document.createElement('button');settingsButton.type='button';settingsButton.className='concert-controls__settings';settingsButton.textContent='Settings';settingsButton.setAttribute('aria-expanded','false');settingsButton.setAttribute('aria-haspopup','dialog');settingsButton.setAttribute('aria-controls',`concert-settings-${id}`);
 controls.append(musicButton,settingsButton);
 const toolbarHost=toolbar??document.querySelector('header nav')??document.querySelector('header')??document.body;
 const playHeader=toolbarHost.tagName==='NAV'?toolbarHost.parentElement:null;
 const addedHostClass=!toolbarHost.classList.contains('concert-toolbar-host'),addedHeaderClass=playHeader&&!playHeader.classList.contains('concert-play-header');
 toolbarHost.classList.add('concert-toolbar-host');if(playHeader)playHeader.classList.add('concert-play-header');
 // Builder's long scrolling toolbar starts with its brand. Keep music next to
 // it; the play page's shorter navigation can wrap its remaining actions.
 if(toolbarHost.tagName==='HEADER')toolbarHost.insertBefore(controls,toolbarHost.children[1]??null);else toolbarHost.prepend(controls);
 const settingsDialog=document.createElement('dialog');settingsDialog.id=`concert-settings-${id}`;settingsDialog.className='concert-settings';settingsDialog.dataset.concertControls='';settingsDialog.setAttribute('aria-label','Settings');
 const dialogHeader=document.createElement('div');dialogHeader.className='concert-settings__header';
 const dialogTitle=document.createElement('h2');dialogTitle.textContent='Settings';
 const done=document.createElement('button');done.type='button';done.className='concert-settings__close';done.textContent='Done';dialogHeader.append(dialogTitle,done);
 const musicHeading=document.createElement('h3');musicHeading.textContent='Opera House music';
 const volumeLabel=document.createElement('label');volumeLabel.className='concert-controls__volume';volumeLabel.htmlFor=`concert-volume-${id}`;
 const volumeText=document.createElement('span');volumeText.textContent='Opera House volume';
 const volumeValue=document.createElement('output');volumeValue.className='concert-controls__volume-value';volumeValue.setAttribute('for',`concert-volume-${id}`);volumeLabel.append(volumeText,volumeValue);
 const volume=document.createElement('input');volume.type='range';volume.className='concert-controls__volume-input';volume.min='0';volume.max='100';volume.step='1';volume.value='75';volume.id=`concert-volume-${id}`;volume.setAttribute('aria-label','Opera House volume');
 const retry=document.createElement('button');retry.type='button';retry.className='concert-controls__retry';retry.textContent='Retry music';retry.hidden=true;
 const programme=document.createElement('button');programme.type='button';programme.className='concert-controls__programme';programme.textContent='Programme & credits';programme.title='View the programme, recording artists and music licences';programme.hidden=typeof onProgramme!=='function';
 settingsDialog.append(dialogHeader,musicHeading,volumeLabel,volume,retry,programme);document.body.append(settingsDialog);
 let destroyed=false,lastState=concert.state,visible=false,resizeObserver=null,lastRenderKey='',restoreSettingsFocus=true,initialFrame=null;
 const removers=[];
 function listen(target,name,handler,options){target?.addEventListener?.(name,handler,options);removers.push(()=>target?.removeEventListener?.(name,handler,options));}
 function safely(call){try{const result=call();result?.catch?.(()=>{});}catch{/* Playback errors are reported by the concert player. */}}
 function finishClose(){setAttribute(settingsButton,'aria-expanded','false');if(restoreSettingsFocus&&!destroyed)settingsButton.focus({preventScroll:true});restoreSettingsFocus=true;}
 function closeSettings(restoreFocus=true){
  restoreSettingsFocus=restoreFocus;
  if(settingsDialog.open&&typeof settingsDialog.close==='function')settingsDialog.close();
  else{settingsDialog.removeAttribute('open');finishClose();}
 }
 listen(musicButton,'click',()=>safely(()=>{
  if(musicIsOn(concert.state)){concert.setMuted(true);return;}
  concert.setMuted(false);return concert.state.status==='unavailable'?concert.retry():concert.play();
 }));
 listen(settingsButton,'click',()=>{
  if(settingsDialog.open)return;
  onSettingsOpen?.();restoreSettingsFocus=true;
  if(typeof settingsDialog.showModal==='function')settingsDialog.showModal();else settingsDialog.setAttribute('open','');
  setAttribute(settingsButton,'aria-expanded','true');volume.focus({preventScroll:true});
 });
 listen(done,'click',()=>closeSettings());
 listen(settingsDialog,'cancel',event=>{event.preventDefault();event.stopPropagation();closeSettings();});
 listen(settingsDialog,'close',finishClose);
 listen(volume,'input',()=>concert.setVolume(Number(volume.value)/100));
 listen(retry,'click',()=>safely(()=>{concert.setMuted(false);return concert.retry();}));
 listen(programme,'click',()=>{closeSettings(false);safely(()=>onProgramme?.(concert.state));});
 // Only keydown is isolated: keyup must still clear any held walking keys.
 listen(controls,'keydown',event=>event.stopPropagation());
 listen(settingsDialog,'keydown',event=>event.stopPropagation());
 function updatePosition(){
  if(destroyed)return;
  const bounds=canvas?.getBoundingClientRect?.()??{left:0,top:0,right:win?.innerWidth??800,bottom:win?.innerHeight??600,width:win?.innerWidth??800,height:win?.innerHeight??600};
  const viewportWidth=win?.innerWidth??bounds.right,visibleLeft=Math.max(0,bounds.left),visibleRight=Math.min(viewportWidth,bounds.right);
  // Narrow Builder screens retain their sidebars. Use a readable screen-wide
  // note when the remaining canvas is too thin to contain two lines of text.
  const narrow=visibleRight-visibleLeft<160,left=narrow?12:Math.max(12,visibleLeft+12);
  const width=Math.max(0,Math.min(320,(narrow?viewportWidth:visibleRight)-left-12));
  const onScreen=bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<(win?.innerHeight??bounds.bottom)&&bounds.right>0&&bounds.left<viewportWidth;
  element.hidden=!visible||!onScreen;
  if(element.hidden)return;
  element.style.width=`${width}px`;element.style.left=`${left}px`;
  // Leave the map status line and the town's movement hints readable below it.
  const viewportHeight=win?.innerHeight??bounds.bottom,touchBounds=document.querySelector('#touch')?.getBoundingClientRect?.(),inventoryBounds=document.querySelector('.yellow-note-inventory')?.getBoundingClientRect?.();
  const touchClearance=touchBounds?.width>0&&touchBounds.height>0&&touchBounds.top<viewportHeight&&touchBounds.bottom>0?viewportHeight-touchBounds.top+8:0;
  const inventoryClearance=inventoryBounds?.width>0&&inventoryBounds.height>0&&inventoryBounds.top<viewportHeight&&inventoryBounds.bottom>0&&inventoryBounds.left<left+width&&inventoryBounds.right>left?viewportHeight-inventoryBounds.top+8:0;
  element.style.bottom=`${Math.max(54,viewportHeight-bounds.bottom+50,touchClearance,inventoryClearance)}px`;
 }
 function update(state){
  if(destroyed)return;
  lastState=state;
  // Audio time events do not change this view or announce the same title again.
  const renderKey=JSON.stringify([state.status,state.wanted,state.trackId,state.track?.title,state.track?.composer,state.track?.performer,state.context,state.muted,state.volume,state.enabled,state.hasVenue,state.destroyed]);
  if(renderKey===lastRenderKey)return;lastRenderKey=renderKey;
  visible=Boolean(!state.destroyed&&state.enabled&&(state.hasVenue||state.context==='concert'));
  element.dataset.state=state.status;updatePosition();
  const title=state.track?.title??'Tonight’s concert programme',credit=state.track?.composer||state.track?.performer||'Coda Opera House';
  setText(track,title);setText(composer,credit);setAttribute(element,'title',[title,credit,state.track?.performer].filter(Boolean).join(' · '));
  const unavailable=state.status==='unavailable',disabled=!visible||state.status==='empty',on=musicIsOn(state);
  setText(musicButton,on?'Music on':'Music off');setAttribute(musicButton,'aria-pressed',on);setAttribute(musicButton,'aria-label',on?'Turn concert music off':unavailable?'Retry concert music':'Turn concert music on');setAttribute(musicButton,'title',unavailable?'Retry the Opera House programme':on?'Turn Opera House music off':'Turn Opera House music on');
  musicButton.disabled=disabled;settingsButton.disabled=Boolean(state.destroyed);retry.hidden=!unavailable;
  const percent=Math.round(state.volume*100);
  if(Number(volume.value)!==percent)volume.value=String(percent);
  setText(volumeValue,`${percent}%`);setAttribute(volume,'aria-valuetext',`${percent} percent`);
  const location=state.context==='concert'?'Full sound in the concert hall':state.context==='interior'?'Softly from the concert hall':'Softly across town';
  const message=unavailable?'Music is unavailable. Turn music on to retry.':state.status==='empty'?'No recordings are available.':state.status==='locked'?'Turn music on to hear tonight’s programme.':state.status==='intermission'?'Between performances.':state.status==='loading'?'Opening the next recording.':state.status==='suspended'?'Concert paused while this page is hidden.':state.muted?'Concert music is off.':state.wanted?location:'Concert music is paused.';
  setText(status,message);
 }
 const unsubscribe=concert.onChange(update);
 listen(win,'resize',updatePosition,{passive:true});listen(win,'scroll',updatePosition,{passive:true,capture:true});
 if(canvas&&typeof win?.ResizeObserver==='function'){resizeObserver=new win.ResizeObserver(updatePosition);resizeObserver.observe(canvas);}
 // Play creates its touch controls immediately after mounting this shared HUD.
 if(typeof win?.requestAnimationFrame==='function')initialFrame=win.requestAnimationFrame(()=>{initialFrame=null;updatePosition();});
 return {
  element,musicButton,settingsButton,settingsDialog,updatePosition,
  destroy(){if(destroyed)return;destroyed=true;unsubscribe();if(settingsDialog.open)closeSettings(false);for(const remove of removers.splice(0))remove();resizeObserver?.disconnect();if(initialFrame!==null)win?.cancelAnimationFrame?.(initialFrame);element.remove();controls.remove();settingsDialog.remove();if(addedHostClass)toolbarHost.classList.remove('concert-toolbar-host');if(addedHeaderClass)playHeader.classList.remove('concert-play-header');},
  get state(){return lastState;}
 };
}
