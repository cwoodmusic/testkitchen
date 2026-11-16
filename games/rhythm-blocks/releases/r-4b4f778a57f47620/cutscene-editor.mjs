/** A local, quantized actor timeline. Changes are authored data, never game actions. */
import * as cinematic from './cutscene.mjs';

const LABEL_WIDTH=92;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const integer=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):fallback;
const clone=value=>structuredClone(value);
const frameFor=document=>document.defaultView?.requestAnimationFrame?.bind(document.defaultView)??(callback=>setTimeout(callback,16));
const actions=[['look','Look around'],['search','Search'],['examine','Examine'],['listen','Listen']];
const emotes=[['','No emote'],['idea','Lightbulb'],['question','Question mark'],['thinking','Thinking'],['surprise','Surprise'],['happy','Happy']];

export function createCutsceneEditor({document=globalThis.document,roomId,content,scene,onChange=mutation=>mutation(),onPreview=()=>{},state={}}={}){
 const element=document.createElement('section');element.className='dc-card cse-editor';element.id='developer-cutscene-timeline';
 const cleanup=[],gridCleanup=[],propertyCleanup=[],raf=frameFor(document);let bindingScope=cleanup,destroyed=false,pendingSeek=null,seekScheduled=false,drag=null,committingField=false;
 state.selectedIndex=integer(state.selectedIndex);state.tileWidth=clamp(integer(state.tileWidth,12)||12,4,48);state.currentTile=integer(state.currentTile);state.scrollLeft=integer(state.scrollLeft);state.playing=!!state.playing;
 const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!=='')node.textContent=String(text);return node;};
 const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);bindingScope.push(()=>node.removeEventListener(type,handler,options));};
 const button=(label,id,handler)=>{const node=el('button','mg-button',label);node.type='button';if(id)node.id=id;listen(node,'click',handler);return node;};
 const notes=()=>Array.isArray(content.cutscene)?content.cutscene:[];
 const actorName=id=>id==='mira'?'Mira':content.people?.find(person=>person.id===id)?.name??id;
 const actorIds=['mira',...(scene.actors??[]).map(actor=>actor.id)];
 const hasActor=id=>actorIds.includes(id);
 const headline=el('div','cse-heading');headline.append(el('h3','','Entrance scene timeline'),el('p','cse-help','Move clips along a character’s track. Drag their right edge to change the length. Every step is one walking tile.'));element.append(headline);
 let compiled,clips=[],totalTiles=0,displayTiles=24,quantumMs=scene.geometry.gridSize/scene.geometry.speed*1000;
 function compile(){
  compiled=null;
  try{compiled=cinematic.compileRoomCutscene?.({scene,beats:notes(),playerPosition:scene.geometry.start});}catch{/* Invalid drafts stay editable. */}
  if(!compiled){let cursor=0;compiled={quantumMs:scene.geometry.gridSize/scene.geometry.speed*1000,clips:notes().map((beat,index)=>{const startTile=integer(beat.startTile,cursor),durationTiles=Math.max(1,integer(beat.durationTiles,24));cursor=Math.max(cursor,startTile+durationTiles);return{...beat,index,actor:beat.actor??beat.speaker,startTile,durationTiles,minDurationTiles:1,endTile:startTile+durationTiles};}),totalTiles:0};compiled.totalTiles=Math.max(0,...compiled.clips.map(clip=>clip.endTile));}
  clips=compiled.clips??[];totalTiles=Math.max(0,integer(compiled.totalTiles));displayTiles=Math.max(24,totalTiles+16);quantumMs=Number(compiled.quantumMs)||scene.geometry.gridSize/scene.geometry.speed*1000;
  element.dataset.quantumMs=String(quantumMs);element.dataset.totalTiles=String(totalTiles);state.selectedIndex=clamp(state.selectedIndex,0,Math.max(0,notes().length-1));state.currentTile=clamp(state.currentTile,0,totalTiles);
 }
 compile();
 const clipFor=index=>clips.find(clip=>(clip.index??clips.indexOf(clip))===index);
 const minimumFor=index=>Math.max(1,integer(clipFor(index)?.minDurationTiles??clipFor(index)?.minimumDurationTiles,1));
 const transport=el('div','cse-transport'),readout=el('output','cse-readout');readout.id='developer-cutscene-time';readout.setAttribute('aria-live','off');
 const error=el('p','cse-error');error.setAttribute('role','status');error.hidden=true;
 const updateClock=tile=>{state.currentTile=clamp(integer(tile),0,totalTiles);scrub.value=String(state.currentTile);readout.textContent=`${state.currentTile} / ${totalTiles} tiles · 1 tile = ${(quantumMs/1000).toFixed(3)}s`;playhead.style.left=`${LABEL_WIDTH+state.currentTile*state.tileWidth}px`;};
 async function preview(command,tile=state.currentTile){
  error.hidden=true;state.playing=command==='play'?true:command==='pause'||command==='stop'?false:state.playing;
  if(command==='stop')updateClock(0);
  try{const result=await onPreview({command,tile:integer(tile)});if(result===false)throw new Error('The scene preview is unavailable.');}
  catch(reason){error.hidden=false;error.textContent=reason?.message??String(reason);state.playing=false;}
  if(!destroyed){playButton.setAttribute('aria-pressed',String(state.playing));pauseButton.setAttribute('aria-pressed',String(!state.playing));}
 }
 const playButton=button('▶ Play','developer-cutscene-play',()=>void preview('play'));
 const pauseButton=button('Ⅱ Pause','developer-cutscene-pause',()=>void preview('pause'));
 const stopButton=button('■ Stop','developer-cutscene-stop',()=>void preview('stop',0));
 for(const control of [playButton,pauseButton,stopButton])control.disabled=!clips.length;
 playButton.setAttribute('aria-pressed',String(state.playing));pauseButton.setAttribute('aria-pressed',String(!state.playing));transport.append(playButton,pauseButton,stopButton,readout);element.append(transport);
 const scrubLabel=el('label','cse-scrub');scrubLabel.append(el('span','','Playhead'));const scrub=el('input');scrub.id='developer-cutscene-scrub';scrub.type='range';scrub.min='0';scrub.max=String(totalTiles);scrub.step='1';scrub.value=String(state.currentTile);scrub.disabled=!clips.length;scrubLabel.append(scrub);element.append(scrubLabel);
 function seek(tile){updateClock(tile);pendingSeek=state.currentTile;if(!seekScheduled){seekScheduled=true;raf(()=>{seekScheduled=false;if(destroyed||pendingSeek===null)return;const next=pendingSeek;pendingSeek=null;void preview('seek',next);});}}
 listen(scrub,'input',()=>seek(scrub.value));
 const toolbar=el('div','cse-toolbar');
 function mutate(callback){if(destroyed)return;onChange(()=>{content.cutscene??=[];for(const clip of clips){const line=content.cutscene[clip.index??clips.indexOf(clip)];if(line){line.startTile??=clip.startTile;line.durationTiles??=clip.durationTiles;}}callback(content.cutscene);},committingField?{repaint:false}:undefined);if(committingField&&!destroyed){compile();scrub.max=String(totalTiles);renderGrid();updateClock(state.currentTile);}}
 function update(index,patch){mutate(lines=>{if(!lines[index])return;for(const [key,value]of Object.entries(patch))if(value===undefined)delete lines[index][key];else lines[index][key]=value;});}
 function selected(){return notes()[state.selectedIndex];}
 function nextId(){let index=1;while(notes().some(beat=>beat.id===`clip-${index}`))index++;return`clip-${index}`;}
 toolbar.append(button('+ Add clip','developer-cutscene-add',()=>{state.selectedIndex=notes().length;const actor=actorIds.find(id=>id!=='mira')??'mira',id=nextId();mutate(lines=>lines.push({id,speaker:actor,actor,text:'',action:'look',startTile:state.currentTile,durationTiles:1}));}),button('Duplicate','developer-cutscene-duplicate',()=>{const index=state.selectedIndex,beat=selected();if(!beat)return;const clip=clipFor(index),copy={...clone(beat),id:nextId(),startTile:(clip?.startTile??0)+(clip?.durationTiles??1)};state.selectedIndex=notes().length;mutate(lines=>lines.push(copy));}),button('Delete','developer-cutscene-delete',()=>{const index=state.selectedIndex;if(!selected())return;state.selectedIndex=Math.max(0,index-1);mutate(lines=>lines.splice(index,1));}));
 for(const control of toolbar.children)if(control.id!=='developer-cutscene-add')control.disabled=!notes().length;
 function zoom(delta){state.tileWidth=clamp(state.tileWidth+delta,4,48);state.scrollLeft=scroll.scrollLeft;renderGrid();updateClock(state.currentTile);}
 toolbar.append(button('− Zoom','developer-cutscene-zoom-out',()=>zoom(-4)),button('+ Zoom','developer-cutscene-zoom-in',()=>zoom(4)));element.append(toolbar);
 const scroll=el('div','cse-scroll');scroll.id='developer-cutscene-scroll';scroll.setAttribute('tabindex','0');scroll.setAttribute('aria-label','Character timeline tracks. Scroll sideways to see later clips.');const grid=el('div','cse-grid');const playhead=el('div','cse-playhead');playhead.setAttribute('aria-hidden','true');scroll.append(grid);element.append(scroll,error);
 listen(scroll,'scroll',()=>{state.scrollLeft=scroll.scrollLeft;});
 const properties=el('section','cse-properties');element.append(properties);
 const input=(label,value,id,{type='text',min,max,step,multiline=false,onCommit}={})=>{const wrap=el('label','dc-field');wrap.append(el('span','',label));const node=el(multiline?'textarea':'input');if(!multiline)node.type=type;node.id=id;node.value=value??'';if(min!==undefined)node.min=String(min);if(max!==undefined)node.max=String(max);if(step!==undefined)node.step=String(step);if(multiline)node.rows=3;listen(node,'change',()=>{committingField=true;try{onCommit(type==='number'?Number(node.value):node.value);}finally{committingField=false;}});wrap.append(node);return wrap;};
 function chips(label,value,options,id,onCommit){const wrap=el('div','dc-field');wrap.append(el('span','',label));const group=el('div','cse-chips');group.id=id;group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [key,name]of options){const choice=button(name,null,()=>onCommit(key));choice.dataset.cutsceneChoice=key;choice.setAttribute('aria-pressed',String(String(key)===String(value)));group.append(choice);}wrap.append(group);return wrap;}
 function selectClip(index,{focus=false}={}){state.selectedIndex=index;for(const node of grid.querySelectorAll('[data-cutscene-clip]'))node.setAttribute('aria-selected',String(Number(node.dataset.cutsceneClip)===index));renderProperties();if(focus)grid.querySelector(`[data-cutscene-clip="${index}"]`)?.focus({preventScroll:true});}
 function renderProperties(){
  for(const remove of propertyCleanup.splice(0))remove();const previousBindings=bindingScope;bindingScope=propertyCleanup;
  properties.replaceChildren();const index=state.selectedIndex,beat=selected(),clip=clipFor(index);
  if(!beat){properties.append(el('p','cse-empty','Add a clip to stage a movement, a line of dialogue, or an emote.'));bindingScope=previousBindings;return;}
  properties.append(el('h4','',`Clip ${index+1} · ${actorName(beat.actor??beat.speaker)}`));
  const timing=el('div','dc-fields');timing.append(input('Start tile',clip?.startTile??beat.startTile??0,'developer-cutscene-start',{type:'number',min:0,step:1,onCommit:value=>update(index,{startTile:integer(value)})}),input('Length in tiles',clip?.durationTiles??beat.durationTiles??1,'developer-cutscene-duration',{type:'number',min:minimumFor(index),step:1,onCommit:value=>update(index,{durationTiles:Math.max(minimumFor(index),integer(value,1))})}));properties.append(timing,el('p','cse-help',`Minimum length: ${minimumFor(index)} tile${minimumFor(index)===1?'':'s'} to finish the walk. Arrow keys move a selected clip one tile; Shift + arrow keys trim its length.`));
  const reorder=el('div','cse-toolbar');reorder.append(button('Earlier 1 tile','developer-cutscene-earlier',()=>update(index,{startTile:Math.max(0,(clip?.startTile??0)-1)})),button('Later 1 tile','developer-cutscene-later',()=>update(index,{startTile:(clip?.startTile??0)+1})));reorder.children[0].disabled=(clip?.startTile??0)===0;properties.append(reorder);
  properties.append(chips('Who moves',beat.actor??beat.speaker,actorIds.map(id=>[id,actorName(id)]),'developer-cutscene-actor',value=>update(index,{actor:value})),chips('Who speaks',beat.speaker,[['mira','Mira'],...(content.people??[]).map(person=>[person.id,person.name])],'developer-cutscene-speaker',value=>update(index,{speaker:value})),input('Dialogue (leave blank for action only)',beat.text??'','developer-cutscene-text',{multiline:true,onCommit:value=>update(index,{text:value})}));
  const targets=[['','Stay here / use coordinates'],...(scene.geometry.targets??[]).filter(target=>target.type!=='return').map(target=>[target.id,scene.objects?.find(object=>object.id===target.id)?.label??target.label??target.id])];
  properties.append(chips('Walk to',beat.target??'',targets,'developer-cutscene-target',value=>update(index,{target:value||undefined,destination:undefined})));
  const destination=beat.destination??clip?.to??scene.geometry.start,coords=el('div','dc-fields');
  coords.append(input('Destination X',destination.x,'developer-cutscene-x',{type:'number',min:scene.geometry.bounds.x,max:scene.geometry.bounds.x+scene.geometry.bounds.width,step:scene.geometry.gridSize,onCommit:value=>{if(Number.isFinite(value))update(index,{target:undefined,destination:{x:value,y:destination.y}});}}),input('Destination Y',destination.y,'developer-cutscene-y',{type:'number',min:scene.geometry.bounds.y,max:scene.geometry.bounds.y+scene.geometry.bounds.height,step:scene.geometry.gridSize,onCommit:value=>{if(Number.isFinite(value))update(index,{target:undefined,destination:{x:destination.x,y:value}});}}));properties.append(coords,el('p','cse-help','Choose a prop or enter room coordinates. The preview routes around solid furniture.'),chips('Action',beat.action??'look',actions,'developer-cutscene-action',value=>update(index,{action:value})),chips('Above their head',beat.emote??'',emotes,'developer-cutscene-emote',value=>update(index,{emote:value||undefined})));
  bindingScope=previousBindings;
 }
 function pointerStart(event,index,resize){
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();
  // Commit a dirty property before replacing its controls or capturing a new clip.
  // Its change handler refreshes only the grid, so reacquire the live clip below.
  if(properties.contains(document.activeElement)&&document.activeElement?.matches('input,textarea'))document.activeElement.blur();
  selectClip(index);const node=grid.querySelector(`[data-cutscene-clip="${index}"]`),clip=clipFor(index);if(!node||!clip)return;
  drag={index,resize,node,pointerId:event.pointerId,startX:event.clientX,startTile:clip.startTile,durationTiles:clip.durationTiles,scrollLeft:scroll.scrollLeft,changed:false};node.setPointerCapture?.(event.pointerId);
 }
 function pointerMove(event){
  if(!drag||drag.pointerId!==event.pointerId)return;const delta=Math.round((event.clientX-drag.startX+scroll.scrollLeft-drag.scrollLeft)/state.tileWidth);
  drag.nextStart=drag.resize?drag.startTile:Math.max(0,drag.startTile+delta);drag.nextDuration=drag.resize?Math.max(minimumFor(drag.index),drag.durationTiles+delta):drag.durationTiles;
  drag.changed=drag.nextStart!==drag.startTile||drag.nextDuration!==drag.durationTiles;drag.node.style.left=`${drag.nextStart*state.tileWidth}px`;drag.node.style.width=`${drag.nextDuration*state.tileWidth}px`;
  drag.node.dataset.startTile=String(drag.nextStart);drag.node.dataset.durationTiles=String(drag.nextDuration);drag.node.setAttribute('aria-label',describe(drag.index,drag.nextStart,drag.nextDuration));
 }
 function pointerEnd(event,cancelled=false){
  if(!drag||drag.pointerId!==event.pointerId)return;const current=drag;drag=null;if(cancelled||!current.changed){renderGrid();selectClip(current.index);return;}
  update(current.index,current.resize?{durationTiles:current.nextDuration}:{startTile:current.nextStart});
 }
 function describe(index,start,duration){const beat=notes()[index];return`${actorName(beat?.actor??beat?.speaker)} clip ${index+1}, starts at tile ${start}, length ${duration} tiles. ${beat?.text??beat?.action??''}`;}
 function renderGrid(){
  for(const remove of gridCleanup.splice(0))remove();const previousBindings=bindingScope;bindingScope=gridCleanup;
  grid.replaceChildren();grid.style.width=`${LABEL_WIDTH+displayTiles*state.tileWidth}px`;grid.style.setProperty('--cse-tile-width',`${state.tileWidth}px`);
  const ruler=el('div','cse-ruler');ruler.setAttribute('aria-hidden','true');const tickStep=Math.max(1,Math.ceil(displayTiles/300));
  for(let tile=0;tile<=displayTiles;tile+=tickStep){const tick=el('span','cse-tick');tick.style.left=`${tile*state.tileWidth}px`;if(tile%Math.max(5,tickStep*5)===0)tick.append(el('span','cse-tick-label',tile));ruler.append(tick);}grid.append(ruler);
  const orderedActors=[...new Set([...actorIds,...clips.map(clip=>clip.actor??clip.speaker).filter(Boolean)])];
  for(const actor of orderedActors){const track=el('div','cse-track');track.dataset.cutsceneActor=actor;track.append(el('div','cse-track-name',actorName(actor)));const lane=el('div','cse-lane');lane.dataset.cutsceneLane=actor;track.append(lane);grid.append(track);
   listen(lane,'dblclick',event=>{if(event.target.closest('[data-cutscene-clip]'))return;const tile=integer((event.clientX-lane.getBoundingClientRect().left)/state.tileWidth),id=nextId();state.selectedIndex=notes().length;mutate(lines=>lines.push({id,speaker:hasActor(actor)?actor:'mira',actor,text:'',action:'look',startTile:tile,durationTiles:1}));});
   for(const clip of clips.filter(clip=>(clip.actor??clip.speaker)===actor)){
    const index=clip.index??clips.indexOf(clip),beat=notes()[index];if(!beat)continue;const node=el('div','cse-clip');node.setAttribute('role','button');node.tabIndex=0;node.dataset.cutsceneClip=String(index);node.dataset.startTile=String(clip.startTile);node.dataset.durationTiles=String(clip.durationTiles);node.dataset.minDuration=String(minimumFor(index));node.setAttribute('aria-selected',String(index===state.selectedIndex));node.setAttribute('aria-label',describe(index,clip.startTile,clip.durationTiles));node.style.left=`${clip.startTile*state.tileWidth}px`;node.style.width=`${Math.max(1,clip.durationTiles)*state.tileWidth}px`;node.style.paddingRight=`${Math.min(11,clip.durationTiles*state.tileWidth*.25)}px`;
    const move=el('span','cse-move-band',clip.movementTiles?'↝ Walk':'• Hold'),talk=el('span','cse-talk-band',beat.text?`${actorName(beat.speaker)}: ${beat.text}`:beat.action??'Action'),emote=el('span','cse-emote-band',emotes.find(([id])=>id===beat.emote)?.[1]??'');node.append(move,talk,emote);
    const resize=el('span','cse-resize');resize.dataset.cutsceneResize=String(index);resize.style.width=`${clamp(clip.durationTiles*state.tileWidth*.25,4,12)}px`;resize.setAttribute('role','separator');resize.setAttribute('aria-orientation','vertical');resize.setAttribute('aria-label',`Resize clip ${index+1}`);node.append(resize);lane.append(node);
    listen(node,'pointerdown',event=>{if(event.target.closest('[data-cutscene-resize]'))return;pointerStart(event,index,false);});listen(resize,'pointerdown',event=>pointerStart(event,index,true));
    listen(node,'pointermove',pointerMove);listen(node,'pointerup',event=>pointerEnd(event));listen(node,'pointercancel',event=>pointerEnd(event,true));listen(node,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)pointerEnd(event,true);});
    listen(node,'click',event=>{event.stopPropagation();if(!drag)selectClip(index);});
    listen(node,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectClip(index);return;}if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();state.selectedIndex=index;const change=event.key==='ArrowRight'?1:-1;state.focusClip=index;update(index,event.shiftKey?{durationTiles:Math.max(minimumFor(index),clip.durationTiles+change)}:{startTile:Math.max(0,clip.startTile+change)});});
   }
  }
  grid.append(playhead);scroll.scrollLeft=state.scrollLeft;updateClock(state.currentTile);bindingScope=previousBindings;
 }
 listen(document,'quietbellcutscene',event=>{const detail=event.detail??{};if(detail.roomId!==roomId||!detail.preview||destroyed)return;state.playing=!!detail.playing&&!detail.finished;updateClock(detail.currentTile??0);playButton.setAttribute('aria-pressed',String(state.playing));pauseButton.setAttribute('aria-pressed',String(!state.playing));});
 renderGrid();renderProperties();updateClock(state.currentTile);
 if(state.focusClip!==undefined){const index=state.focusClip;delete state.focusClip;raf(()=>{if(!destroyed)grid.querySelector(`[data-cutscene-clip="${index}"]`)?.focus({preventScroll:true});});}
 return{element,state,destroy(){if(destroyed)return;destroyed=true;pendingSeek=null;drag=null;state.scrollLeft=scroll.scrollLeft;for(const remove of [...cleanup,...gridCleanup,...propertyCleanup])remove();}};
}
