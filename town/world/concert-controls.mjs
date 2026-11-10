let controlId=0;
const categoryLabels={orchestra:'Orchestra',jazz:'New Orleans jazz',piano:'Piano recital'};
const setText=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
const setAttribute=(element,name,value)=>{if(element.getAttribute(name)!==String(value))element.setAttribute(name,String(value));};

function loadStyles(document){
 if(document.querySelector('link[data-concert-controls-styles]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./concert-controls.css?v=opera-concert-1',import.meta.url).href;
 link.dataset.concertControlsStyles='';document.head.append(link);
}

/** Mount one accessible player for the town session's shared concert programme. */
export function mountConcertControls(concert,{canvas,onProgramme}={}){
 const document=canvas?.ownerDocument??globalThis.document,win=document?.defaultView??globalThis.window;
 if(!document?.createElement||!concert?.onChange)throw new TypeError('Concert controls need a document and a concert player.');
 loadStyles(document);
 const element=document.createElement('section');element.className='concert-controls';element.dataset.concertControls='';
 element.setAttribute('role','region');element.setAttribute('aria-label','Concert music');element.hidden=true;
 const heading=document.createElement('div');heading.className='concert-controls__heading';
 const title=document.createElement('span');title.className='concert-controls__eyebrow';title.textContent='Coda Opera House';
 const category=document.createElement('span');category.className='concert-controls__category';heading.append(title,category);
 const track=document.createElement('strong');track.className='concert-controls__track';track.setAttribute('aria-live','polite');track.setAttribute('aria-atomic','true');
 const status=document.createElement('span');status.className='concert-controls__status';
 const actions=document.createElement('div');actions.className='concert-controls__actions';
 const play=document.createElement('button');play.type='button';play.className='concert-controls__play';play.textContent='Play';
 const mute=document.createElement('button');mute.type='button';mute.className='concert-controls__mute';mute.textContent='Mute';
 mute.title='Mute the concert programme';mute.setAttribute('aria-pressed','false');
 const volumeLabel=document.createElement('label');volumeLabel.className='concert-controls__volume';
 const volumeText=document.createElement('span');volumeText.textContent='Volume';
 const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.step='1';volume.value='75';
 volume.id=`concert-volume-${++controlId}`;volumeLabel.htmlFor=volume.id;volumeLabel.append(volumeText,volume);
 const programme=document.createElement('button');programme.type='button';programme.className='concert-controls__programme';programme.textContent='Programme & credits';
 programme.title='View the programme, recording artists and music licences';programme.hidden=typeof onProgramme!=='function';
 actions.append(play,mute,volumeLabel,programme);element.append(heading,track,status,actions);document.body.append(element);
 let destroyed=false,lastState=concert.state,visible=false,resizeObserver=null,lastRenderKey='';
 const removers=[];
 function listen(target,name,handler,options){target?.addEventListener?.(name,handler,options);removers.push(()=>target?.removeEventListener?.(name,handler,options));}
 function safely(call){try{const result=call();result?.catch?.(()=>{});}catch{/* Playback errors are reported by the concert player. */}}
 listen(play,'click',()=>safely(()=>concert.state.status==='unavailable'?concert.retry():concert.state.playing?concert.pause():concert.play()));
 listen(mute,'click',()=>concert.toggleMute());
 listen(volume,'input',()=>concert.setVolume(Number(volume.value)/100));
 listen(programme,'click',()=>safely(()=>onProgramme?.(concert.state)));
 // Arrow keys operate the volume slider without also walking the character.
 listen(element,'keydown',event=>event.stopPropagation());
 function updatePosition(){
  if(destroyed)return;
  const bounds=canvas?.getBoundingClientRect?.()??{left:0,top:0,right:win?.innerWidth??800,bottom:win?.innerHeight??600,width:win?.innerWidth??800,height:win?.innerHeight??600};
  const width=Math.max(0,Math.min(390,bounds.width-24,(win?.innerWidth??bounds.right)-24));
  const onScreen=bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<(win?.innerHeight??bounds.bottom)&&bounds.right>0;
  element.hidden=!visible||!onScreen;
  if(element.hidden)return;
  element.style.width=`${width}px`;element.style.left=`${Math.max(12,bounds.left+12)}px`;
  // Leave the map status line and the town's movement hints readable below it.
  element.style.bottom=`${Math.max(54,(win?.innerHeight??bounds.bottom)-bounds.bottom+50)}px`;
 }
 function update(state){
  if(destroyed)return;
  lastState=state;
  // timeupdate fires several times a second. There is no ticking clock in this
  // compact player, so it need not trigger layout, DOM writes or live messages.
  const renderKey=JSON.stringify([state.status,state.playing,state.trackId,state.track?.title,state.track?.composer,state.track?.performer,state.category,state.context,state.muted,state.volume,state.enabled,state.hasVenue,state.destroyed]);
  if(renderKey===lastRenderKey)return;lastRenderKey=renderKey;
  visible=Boolean(!state.destroyed&&state.enabled&&(state.hasVenue||state.context==='concert'));
  element.dataset.state=state.status;updatePosition();
  const title=state.track?.title??'Tonight’s concert programme';
  setText(track,title);setAttribute(track,'title',[title,state.track?.composer,state.track?.performer].filter(Boolean).join(' · '));
  setText(category,categoryLabels[state.category]??'Live programme');
  const unavailable=state.status==='unavailable',loading=state.status==='loading';
  setText(play,unavailable?'Retry':state.playing?'Pause':loading?'Loading…':'Play');
  play.disabled=state.status==='empty'||loading;
  setAttribute(play,'aria-label',unavailable?'Retry concert music':state.playing?'Pause concert music':'Play concert music');
  setText(mute,state.muted?'Unmute':'Mute');setAttribute(mute,'aria-pressed',state.muted);
  setAttribute(mute,'title',state.muted?'Unmute the concert programme':'Mute the concert programme');
  const percent=Math.round(state.volume*100);
  if(Number(volume.value)!==percent)volume.value=String(percent);
  setAttribute(volume,'aria-valuetext',`${percent} percent`);
  const location=state.context==='concert'?'Full sound in the concert hall':state.context==='interior'?'Softly from the concert hall':'Softly across town';
  const message=unavailable?'Music is unavailable. Retry the programme.':state.status==='empty'?'No recordings are available.':state.status==='locked'?'Press Play to hear tonight’s programme.':loading?'Opening the next recording…':state.status==='suspended'?'Concert paused while this page is hidden.':state.playing?`${state.muted?'Muted · ':''}${location}`:'Concert paused';
  setText(status,message);
 }
 const unsubscribe=concert.onChange(update);
 listen(win,'resize',updatePosition,{passive:true});listen(win,'scroll',updatePosition,{passive:true,capture:true});
 if(canvas&&typeof win?.ResizeObserver==='function'){resizeObserver=new win.ResizeObserver(updatePosition);resizeObserver.observe(canvas);}
 return {
  element,updatePosition,
  destroy(){if(destroyed)return;destroyed=true;unsubscribe();for(const remove of removers.splice(0))remove();resizeObserver?.disconnect();element.remove();},
  get state(){return lastState;}
 };
}
