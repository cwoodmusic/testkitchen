/** A local, quantized actor timeline. Changes are authored data, never game actions. */
import * as cinematic from './cutscene.mjs';

const LABEL_WIDTH=92;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const integer=(value,fallback=0)=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):fallback;
const clone=value=>structuredClone(value);
const frameFor=document=>document.defaultView?.requestAnimationFrame?.bind(document.defaultView)??(callback=>setTimeout(callback,16));
const actions=[['look','Look around'],['search','Search'],['examine','Examine'],['listen','Listen']];
const emotes=[['','No emote'],['idea','Lightbulb'],['question','Question mark'],['thinking','Thinking'],['surprise','Surprise'],['happy','Happy']];
const gestures=[['magnify','Magnifying glass'],['trip','Trip'],['fallen','On the floor'],['recover','Get up']];
const gaits=[['walk','Walk'],['run','Run']];
const kinds=[['walk','Walk'],['dialogue','Text'],['emote','Emote'],['gesture','Action']];
const kindOf=beat=>kinds.some(([kind])=>kind===beat?.kind)?beat.kind:'walk';
const kindName=kind=>kinds.find(([id])=>id===kind)?.[1]??'Walk';

export function createCutsceneEditor({document=globalThis.document,roomId,content,scene,onChange=mutation=>mutation(),onPreview=()=>{},onSelection=()=>{},state={}}={}){
 const element=document.createElement('section');element.className='dc-card cse-editor';element.id='developer-cutscene-timeline';
 const cleanup=[],gridCleanup=[],propertyCleanup=[],raf=frameFor(document);let bindingScope=cleanup,destroyed=false,pendingSeek=null,seekScheduled=false,drag=null,committingField=false,entryPreviewActive=false;
 state.selectedIndex=integer(state.selectedIndex);state.tileWidth=clamp(integer(state.tileWidth,12)||12,4,48);state.currentTile=integer(state.currentTile);state.scrollLeft=integer(state.scrollLeft);state.scrollTop=integer(state.scrollTop);state.playing=!!state.playing;state.playbackRate=state.playbackRate===2?2:1;
 const el=(tag,className='',text='')=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined&&text!=='')node.textContent=String(text);return node;};
 const listen=(node,type,handler,options)=>{node.addEventListener(type,handler,options);bindingScope.push(()=>node.removeEventListener(type,handler,options));};
 const button=(label,id,handler)=>{const node=el('button','mg-button',label);node.type='button';if(id)node.id=id;listen(node,'click',handler);return node;};
 const notes=()=>Array.isArray(content.cutscene)?content.cutscene:[];
 if(notes().some(beat=>!beat.kind)&&cinematic.separateCutsceneTracks){
  const selectedId=notes()[state.selectedIndex]?.id;
  try{content.cutscene=cinematic.separateCutsceneTracks({scene,beats:notes(),playerPosition:scene.geometry.start});if(selectedId){const index=notes().findIndex(beat=>beat.id===selectedId);if(index>=0)state.selectedIndex=index;}}catch{/* Invalid drafts remain editable. */}
 }
 const actorName=id=>id==='mira'?'Mira':content.people?.find(person=>person.id===id)?.name??id;
 const actorIds=['mira',...(scene.actors??[]).map(actor=>actor.id)];
 const hasActor=id=>actorIds.includes(id);
 const headline=el('div','cse-heading');headline.append(el('h3','','Scene timeline'),el('p','cse-help','Drag or resize each row.'));element.append(headline);
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
 const minimumFor=index=>kindOf(notes()[index])==='walk'?Math.max(1,integer(clipFor(index)?.minDurationTiles??clipFor(index)?.minimumDurationTiles,1)):1;
 const transport=el('div','cse-transport'),readout=el('output','cse-readout');readout.id='developer-cutscene-time';readout.setAttribute('aria-live','off');
 const error=el('p','cse-error');error.setAttribute('role','status');error.hidden=true;
 const updateClock=tile=>{state.currentTile=clamp(integer(tile),0,totalTiles);scrub.value=String(state.currentTile);readout.textContent=`${state.currentTile} / ${totalTiles} tiles · 1 tile = ${(quantumMs/1000).toFixed(3)}s`;playhead.style.left=`${LABEL_WIDTH+state.currentTile*state.tileWidth}px`;};
 async function preview(command,tile=state.currentTile,extra={}){
  error.hidden=true;state.playing=command==='play'||command==='entry'?true:command==='pause'||command==='stop'?false:state.playing;
  if(command==='entry')entryPreviewActive=true;else if(command==='stop'||command==='seek')entryPreviewActive=false;
  if(command==='stop'||command==='entry')updateClock(0);
  try{const result=await onPreview({command,tile:integer(tile),...extra});if(result===false)throw new Error('The scene preview is unavailable.');if(result?.playbackRate)state.playbackRate=result.playbackRate===2?2:1;}
  catch(reason){error.hidden=false;error.textContent=reason?.message??String(reason);state.playing=false;if(command==='entry')entryPreviewActive=false;}
  if(!destroyed){paintTransport();paintRate();}
 }
 const playButton=button('▶ Play','developer-cutscene-play',()=>void preview('play'));
 const pauseButton=button('Ⅱ Pause','developer-cutscene-pause',()=>void preview('pause'));
 const stopButton=button('■ Stop','developer-cutscene-stop',()=>void preview('stop',0));
 const rateButton=button('1× speed','developer-cutscene-speed',()=>{state.playbackRate=state.playbackRate===2?1:2;paintRate();void preview('rate',state.currentTile,{rate:state.playbackRate});});
 function paintRate(){rateButton.textContent=`${state.playbackRate}× speed`;rateButton.setAttribute('aria-pressed',String(state.playbackRate===2));rateButton.setAttribute('aria-label',`${state.playbackRate===2?'Double':'Normal'} playback speed. Switch to ${state.playbackRate===2?'normal':'double'} speed.`);}
 paintRate();
 function paintTransport(){for(const control of [playButton,pauseButton,stopButton])control.disabled=!clips.length&&!entryPreviewActive;playButton.setAttribute('aria-pressed',String(state.playing));pauseButton.setAttribute('aria-pressed',String(!state.playing));}
 paintTransport();transport.append(playButton,pauseButton,stopButton,rateButton);element.append(transport);
 const scrubLabel=el('div','cse-scrub'),scrubTitle=el('label','','Playhead');scrubTitle.htmlFor='developer-cutscene-scrub';scrubLabel.append(scrubTitle);const scrub=el('input');scrub.id='developer-cutscene-scrub';scrub.type='range';scrub.min='0';scrub.max=String(totalTiles);scrub.step='1';scrub.value=String(state.currentTile);scrub.disabled=!clips.length;scrubLabel.append(scrub,readout);element.append(scrubLabel);
 function seek(tile){updateClock(tile);pendingSeek=state.currentTile;if(!seekScheduled){seekScheduled=true;raf(()=>{seekScheduled=false;if(destroyed||pendingSeek===null)return;const next=pendingSeek;pendingSeek=null;void preview('seek',next);});}}
 listen(scrub,'input',()=>seek(scrub.value));
 const toolbar=el('div','cse-toolbar');
 function mutate(callback){if(destroyed)return;onChange(()=>{content.cutscene??=[];for(const clip of clips){const line=content.cutscene[clip.index??clips.indexOf(clip)];if(line){line.startTile??=clip.startTile;line.durationTiles??=clip.durationTiles;}}callback(content.cutscene);},committingField?{repaint:false}:undefined);if(committingField&&!destroyed){compile();scrub.max=String(totalTiles);renderGrid();updateClock(state.currentTile);notifySelection();}}
 function update(index,patch){mutate(lines=>{if(!lines[index])return;for(const [key,value]of Object.entries(patch))if(value===undefined)delete lines[index][key];else lines[index][key]=value;});}
 function selected(){return notes()[state.selectedIndex];}
 function nextId(){let index=1;while(notes().some(beat=>beat.id===`clip-${index}`))index++;return`clip-${index}`;}
 function addClip(kind,actor=selected()?.actor??selected()?.speaker,startTile=state.currentTile){
  if(notes().length>=384)return;
  if(!hasActor(actor))actor=actorIds.find(id=>id!=='mira')??'mira';
  const clip={id:nextId(),kind,actor,startTile,durationTiles:kind==='dialogue'?Math.max(1,Math.ceil(3000/quantumMs)):kind==='emote'||kind==='gesture'?Math.max(1,Math.ceil(1000/quantumMs)):1};
  if(kind==='walk')clip.action='look';else if(kind==='dialogue'){clip.speaker=actor;clip.text='';}else if(kind==='emote')clip.emote='question';else clip.gesture=actor==='iris'?'magnify':'trip';
  state.selectedIndex=notes().length;state.revealClip=state.selectedIndex;mutate(lines=>lines.push(clip));
 }
 toolbar.append(button('+ Walk','developer-cutscene-add',()=>addClip('walk')),button('+ Text','developer-cutscene-add-dialogue',()=>addClip('dialogue')),button('+ Emote','developer-cutscene-add-emote',()=>addClip('emote')),button('+ Action','developer-cutscene-add-gesture',()=>addClip('gesture')),button('Duplicate','developer-cutscene-duplicate',()=>{const index=state.selectedIndex,beat=selected();if(!beat||notes().length>=384)return;const clip=clipFor(index),copy={...clone(beat),id:nextId(),startTile:(clip?.startTile??0)+(clip?.durationTiles??1)};state.selectedIndex=notes().length;state.revealClip=state.selectedIndex;mutate(lines=>lines.push(copy));}),button('Delete','developer-cutscene-delete',()=>{const index=state.selectedIndex;if(!selected())return;state.selectedIndex=Math.max(0,index-1);mutate(lines=>lines.splice(index,1));}));
 for(const control of toolbar.children)control.disabled=control.id.startsWith('developer-cutscene-add')?notes().length>=384:!notes().length;
 function zoom(delta){state.tileWidth=clamp(state.tileWidth+delta,4,48);state.scrollLeft=scroll.scrollLeft;renderGrid();updateClock(state.currentTile);}
 toolbar.append(button('− Zoom','developer-cutscene-zoom-out',()=>zoom(-4)),button('+ Zoom','developer-cutscene-zoom-in',()=>zoom(4)));
 const scroll=el('div','cse-scroll');scroll.id='developer-cutscene-scroll';scroll.setAttribute('tabindex','0');scroll.setAttribute('aria-label','Separate Walk, Text, Emote and Action timeline rows for each character. Scroll to see more rows or later clips.');const grid=el('div','cse-grid');const playhead=el('div','cse-playhead');playhead.setAttribute('aria-hidden','true');scroll.append(grid);element.append(scroll,error,toolbar);
 listen(scroll,'scroll',()=>{state.scrollLeft=scroll.scrollLeft;state.scrollTop=scroll.scrollTop;});
 const properties=el('section','cse-properties');element.append(properties);
 const input=(label,value,id,{type='text',min,max,step,multiline=false,onCommit}={})=>{const wrap=el('label','dc-field');wrap.append(el('span','',label));const node=el(multiline?'textarea':'input');if(!multiline)node.type=type;node.id=id;node.value=value??'';if(min!==undefined)node.min=String(min);if(max!==undefined)node.max=String(max);if(step!==undefined)node.step=String(step);if(multiline)node.rows=3;listen(node,'change',()=>{committingField=true;try{onCommit(type==='number'?Number(node.value):node.value);}finally{committingField=false;}});wrap.append(node);return wrap;};
 const entrySettings=el('details','dc-advanced cse-entry-settings');entrySettings.id='developer-room-entry';entrySettings.open=!!state.entryOpen;entrySettings.append(el('summary','','Room entry'));
 listen(entrySettings,'toggle',()=>{state.entryOpen=entrySettings.open;});
 const entryEnabled=el('label','dc-checkbox'),entryToggle=el('input');entryToggle.type='checkbox';entryToggle.id='developer-room-entry-enabled';entryToggle.checked=scene.entry?.enabled!==false;entryEnabled.append(entryToggle,el('span','','Enter through the doorway before the scene'));
 const entryPreview=button('Preview room entry','developer-cutscene-entry',()=>void preview('entry',0));entryPreview.disabled=!entryToggle.checked;
 function updateEntry(patch){
  if(destroyed)return;
  onChange(()=>{scene.entry={...scene.entry,...patch};},{repaint:false});
  entryPreview.disabled=scene.entry?.enabled===false;
  for(const [key,id]of [['fadeTiles','developer-room-entry-fade'],['staggerTiles','developer-room-entry-spacing'],['doorX','developer-room-entry-door-x']])if(Object.hasOwn(patch,key))entrySettings.querySelector('#'+id).value=String(scene.entry[key]);
  if(Object.hasOwn(patch,'gait'))for(const choice of entrySettings.querySelectorAll('#developer-room-entry-gait [data-cutscene-choice]'))choice.setAttribute('aria-pressed',String(choice.dataset.cutsceneChoice===scene.entry.gait));
 }
 listen(entryToggle,'change',()=>updateEntry({enabled:entryToggle.checked}));
 const doorway=scene.geometry.targets?.find(target=>target.type==='return')?.x??scene.geometry.start.x;
 const entryFields=el('div','dc-fields');entryFields.append(
  input('Fade length (walking tiles)',scene.entry?.fadeTiles??6,'developer-room-entry-fade',{type:'number',min:0,max:128,step:1,onCommit:value=>updateEntry({fadeTiles:clamp(integer(value),0,128)})}),
  input('Party spacing (walking tiles)',scene.entry?.staggerTiles??1,'developer-room-entry-spacing',{type:'number',min:0,max:64,step:1,onCommit:value=>updateEntry({staggerTiles:clamp(integer(value),0,64)})}),
  input('Doorway X',scene.entry?.doorX??doorway,'developer-room-entry-door-x',{type:'number',min:0,max:scene.geometry.width,step:1,onCommit:value=>{if(Number.isFinite(value))updateEntry({doorX:clamp(value,0,scene.geometry.width)});}}),
 );
 entrySettings.append(entryEnabled,chips('Entrance pace',scene.entry?.gait??'run',gaits,'developer-room-entry-gait',value=>updateEntry({gait:value})),entryFields,entryPreview,el('p','cse-help','The party runs in first, then the authored timeline starts. Run is twice walking speed; timing fields still use normal walking tiles. These settings leave the Walk, Text, Emote and Action rows at their existing times.'));
 element.append(entrySettings);
 function chips(label,value,options,id,onCommit){const wrap=el('div','dc-field');wrap.append(el('span','',label));const group=el('div','cse-chips');group.id=id;group.setAttribute('role','group');group.setAttribute('aria-label',label);for(const [key,name]of options){const choice=button(name,null,()=>onCommit(key));choice.dataset.cutsceneChoice=key;choice.setAttribute('aria-pressed',String(String(key)===String(value)));group.append(choice);}wrap.append(group);return wrap;}
 function flushProperty(){if(element.contains(document.activeElement)&&document.activeElement?.matches('input,textarea'))document.activeElement.blur();}
 function notifySelection(){const beat=selected();onSelection(beat?{roomId,clipIndex:state.selectedIndex,actorId:beat.actor??beat.speaker,kind:kindOf(beat)}:null);}
 function revealClip(index){
  const node=grid.querySelector(`[data-cutscene-clip="${index}"]`);if(!node||!scroll.clientHeight)return;
  const viewport=scroll.getBoundingClientRect(),box=node.getBoundingClientRect(),left=viewport.left+LABEL_WIDTH+1,right=viewport.left+scroll.clientWidth-1,top=viewport.top+1,bottom=viewport.top+scroll.clientHeight-1;
  if(box.top<top)scroll.scrollTop-=top-box.top;else if(box.bottom>bottom)scroll.scrollTop+=box.bottom-bottom;
  if(box.left<left||box.width>right-left)scroll.scrollLeft+=box.left-left;else if(box.right>right)scroll.scrollLeft+=box.right-right;
  state.scrollTop=scroll.scrollTop;state.scrollLeft=scroll.scrollLeft;
 }
 function selectClip(index,{focus=false}={}){flushProperty();if(destroyed||!notes()[index])return false;state.selectedIndex=index;for(const node of grid.querySelectorAll('[data-cutscene-clip]'))node.setAttribute('aria-selected',String(Number(node.dataset.cutsceneClip)===index));renderProperties();notifySelection();if(focus)grid.querySelector(`[data-cutscene-clip="${index}"]`)?.focus({preventScroll:true});return true;}
 function selectActor(id){
  flushProperty();if(destroyed||!hasActor(id))return false;
  const matches=clips.filter(clip=>(clip.actor??clip.speaker)===id&&kindOf(clip)==='walk'),chosen=matches.find(clip=>clip.startTile<=state.currentTile&&state.currentTile<clip.endTile)??matches[0];
  if(chosen){const index=chosen.index??clips.indexOf(chosen),selected=selectClip(index);if(selected)revealClip(index);return selected;}
  addClip('walk',id);return true;
 }
 function updatePath(index,{waypoints,destination,keepTarget=true}={}){
  flushProperty();if(destroyed||!notes()[index]||kindOf(notes()[index])!=='walk'||!Array.isArray(waypoints)||waypoints.length>32||waypoints.some(point=>!Number.isFinite(point?.x)||!Number.isFinite(point?.y)))return false;
  if(!keepTarget&&(!Number.isFinite(destination?.x)||!Number.isFinite(destination?.y)))return false;
  state.selectedIndex=index;
  const patch={waypoints:clone(waypoints)};if(!keepTarget){patch.target=undefined;patch.destination=clone(destination);}
  update(index,patch);return true;
 }
 function renderProperties(){
  for(const remove of propertyCleanup.splice(0))remove();const previousBindings=bindingScope;bindingScope=propertyCleanup;
  properties.replaceChildren();const index=state.selectedIndex,beat=selected(),clip=clipFor(index);
  if(!beat){delete properties.dataset.cutsceneKind;properties.append(el('p','cse-empty','Add a Walk, Text, Emote or Action item. Each has its own timing.'));bindingScope=previousBindings;return;}
  const kind=kindOf(beat);properties.dataset.cutsceneKind=kind;
  properties.append(el('h4','',`${kindName(kind)} · ${actorName(beat.actor??beat.speaker)}`));
  const timing=el('div','dc-fields');timing.append(input('Start tile',clip?.startTile??beat.startTile??0,'developer-cutscene-start',{type:'number',min:0,step:1,onCommit:value=>update(index,{startTile:integer(value)})}),input('Length in tiles',clip?.durationTiles??beat.durationTiles??1,'developer-cutscene-duration',{type:'number',min:minimumFor(index),step:1,onCommit:value=>update(index,{durationTiles:Math.max(minimumFor(index),integer(value,1))})}));
  const minimum=minimumFor(index),minimumText=kind==='walk'?`Minimum length: ${minimum} tile${minimum===1?'':'s'} to finish the walk.`:'Minimum length: 1 walking tile.';
  properties.append(timing,el('p','cse-help',`${minimumText} Arrow keys move this item one tile; Shift + arrow keys trim its length. Other rows keep their timing.`));
  const reorder=el('div','cse-toolbar');reorder.append(button('Earlier 1 tile','developer-cutscene-earlier',()=>update(index,{startTile:Math.max(0,(clip?.startTile??0)-1)})),button('Later 1 tile','developer-cutscene-later',()=>update(index,{startTile:(clip?.startTile??0)+1})));reorder.children[0].disabled=(clip?.startTile??0)===0;properties.append(reorder);
  if(kind==='dialogue'){
   properties.append(chips('Who speaks',beat.speaker??beat.actor,[['mira','Mira'],...(content.people??[]).map(person=>[person.id,person.name])],'developer-cutscene-speaker',value=>update(index,{speaker:value,actor:beat.actor??beat.speaker})),input('Dialogue',beat.text??'','developer-cutscene-text',{multiline:true,onCommit:value=>update(index,{text:value})}));
  }else if(kind==='emote'){
   properties.append(chips('Character',beat.actor??beat.speaker,actorIds.map(id=>[id,actorName(id)]),'developer-cutscene-actor',value=>update(index,{actor:value})),chips('Emote above their head',beat.emote??'question',emotes.filter(([id])=>id),'developer-cutscene-emote',value=>update(index,{emote:value})),el('p','cse-help','This reaction appears over the character wherever they are walking. Delete the item to remove it.'));
  }else if(kind==='gesture'){
   properties.append(chips('Character',beat.actor??beat.speaker,actorIds.map(id=>[id,actorName(id)]),'developer-cutscene-actor',value=>update(index,{actor:value})),chips('Physical action',beat.gesture??'magnify',gestures,'developer-cutscene-gesture',value=>update(index,{gesture:value})),el('p','cse-help','Move or trim this action independently of walking, text and emotes. Its pose follows the playhead, including when paused or seeking.'));
  }else{
   properties.append(chips('Who moves',beat.actor??beat.speaker,actorIds.map(id=>[id,actorName(id)]),'developer-cutscene-actor',value=>update(index,{actor:value})));
   properties.append(chips('Pace',beat.gait??'walk',gaits,'developer-cutscene-gait',value=>update(index,{gait:value})),el('p','cse-help','Run moves twice as fast as Walk. Timeline increments remain one normal walking tile.'));
   const targets=[['','Stay here / use coordinates'],...(scene.geometry.targets??[]).filter(target=>target.type!=='return').map(target=>[target.id,scene.objects?.find(object=>object.id===target.id)?.label??target.label??target.id])];
   properties.append(chips('Walk to',beat.target??'',targets,'developer-cutscene-target',value=>update(index,{target:value||undefined,destination:undefined})));
   const destination=beat.destination??clip?.to??scene.geometry.start,coords=el('div','dc-fields');
   coords.append(input('Destination X',destination.x,'developer-cutscene-x',{type:'number',min:scene.geometry.bounds.x,max:scene.geometry.bounds.x+scene.geometry.bounds.width,step:scene.geometry.gridSize,onCommit:value=>{if(Number.isFinite(value))update(index,{target:undefined,destination:{x:value,y:destination.y}});}}),input('Destination Y',destination.y,'developer-cutscene-y',{type:'number',min:scene.geometry.bounds.y,max:scene.geometry.bounds.y+scene.geometry.bounds.height,step:scene.geometry.gridSize,onCommit:value=>{if(Number.isFinite(value))update(index,{target:undefined,destination:{x:destination.x,y:value}});}}));
   properties.append(coords,el('p','cse-help','Click a character in the scene to show its colored route. Drag the route points to reshape the walk; the preview routes around solid furniture.'),chips('Action',beat.action??'look',actions,'developer-cutscene-action',value=>update(index,{action:value})));
  }
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
  state.revealClip=current.index;update(current.index,current.resize?{durationTiles:current.nextDuration}:{startTile:current.nextStart});
 }
 function describe(index,start,duration){const beat=notes()[index],kind=kindOf(beat);return`${actorName(beat?.actor??beat?.speaker)} ${kindName(kind).toLowerCase()} item ${index+1}, starts at tile ${start}, length ${duration} tiles. ${kind==='dialogue'?beat?.text??'':kind==='emote'?emotes.find(([id])=>id===beat?.emote)?.[1]??'':kind==='gesture'?gestures.find(([id])=>id===beat?.gesture)?.[1]??'':beat?.action??''}`;}
 function renderGrid(){
  for(const remove of gridCleanup.splice(0))remove();const previousBindings=bindingScope;bindingScope=gridCleanup;
  grid.replaceChildren();grid.style.width=`${LABEL_WIDTH+displayTiles*state.tileWidth}px`;grid.style.setProperty('--cse-tile-width',`${state.tileWidth}px`);
  const ruler=el('div','cse-ruler');ruler.setAttribute('aria-hidden','true');const tickStep=Math.max(1,Math.ceil(displayTiles/300));
  for(let tile=0;tile<=displayTiles;tile+=tickStep){const tick=el('span','cse-tick');tick.style.left=`${tile*state.tileWidth}px`;if(tile%Math.max(5,tickStep*5)===0)tick.append(el('span','cse-tick-label',tile));ruler.append(tick);}grid.append(ruler);
  const orderedActors=[...new Set([...(scene.actors??[]).map(actor=>actor.id),'mira',...clips.map(clip=>clip.actor??clip.speaker).filter(Boolean)])];
  for(const actor of orderedActors){
   const track=el('div','cse-track');track.dataset.cutsceneActor=actor;track.setAttribute('role','group');track.setAttribute('aria-label',`${actorName(actor)} timeline`);
   const heading=el('div','cse-actor-heading');heading.append(el('span','',actorName(actor)));track.append(heading);grid.append(track);
   for(const [kind,title]of kinds){
    const row=el('div','cse-channel');row.dataset.cutsceneKind=kind;row.append(el('div','cse-track-name',title));
    const lane=el('div','cse-lane');lane.dataset.cutsceneLane=actor;lane.dataset.cutsceneKind=kind;lane.setAttribute('aria-label',`${actorName(actor)} ${title.toLowerCase()} row`);row.append(lane);track.append(row);
    listen(lane,'dblclick',event=>{if(event.target.closest('[data-cutscene-clip]'))return;const tile=integer((event.clientX-lane.getBoundingClientRect().left)/state.tileWidth);addClip(kind,actor,tile);});
    for(const clip of clips.filter(clip=>(clip.actor??clip.speaker)===actor&&kindOf(clip)===kind)){
     const index=clip.index??clips.indexOf(clip),beat=notes()[index];if(!beat)continue;const node=el('div','cse-clip');node.setAttribute('role','button');node.tabIndex=0;node.dataset.cutsceneClip=String(index);node.dataset.cutsceneKind=kind;node.dataset.startTile=String(clip.startTile);node.dataset.durationTiles=String(clip.durationTiles);node.dataset.minDuration=String(minimumFor(index));node.setAttribute('aria-selected',String(index===state.selectedIndex));node.setAttribute('aria-label',describe(index,clip.startTile,clip.durationTiles));node.style.left=`${clip.startTile*state.tileWidth}px`;node.style.width=`${Math.max(1,clip.durationTiles)*state.tileWidth}px`;node.style.paddingRight=`${Math.min(11,clip.durationTiles*state.tileWidth*.25)}px`;
     const label=kind==='dialogue'?beat.text||'Text…':kind==='emote'?emotes.find(([id])=>id===beat.emote)?.[1]??'Emote':kind==='gesture'?gestures.find(([id])=>id===beat.gesture)?.[1]??'Action':clip.movementTiles?`${beat.gait==='run'?'Run':'Walk'} · ${scene.objects?.find(object=>object.id===beat.target)?.label??beat.target??'destination'}`:actions.find(([id])=>id===beat.action)?.[1]??'Stay here';
     node.append(el('span','cse-clip-text',label));
     const resize=el('span','cse-resize');resize.dataset.cutsceneResize=String(index);resize.style.width=`${clamp(clip.durationTiles*state.tileWidth*.25,4,12)}px`;resize.setAttribute('role','separator');resize.setAttribute('aria-orientation','vertical');resize.setAttribute('aria-label',`Resize ${title.toLowerCase()} item ${index+1}`);node.append(resize);lane.append(node);
     listen(node,'pointerdown',event=>{if(event.target.closest('[data-cutscene-resize]'))return;pointerStart(event,index,false);});listen(resize,'pointerdown',event=>pointerStart(event,index,true));
     listen(node,'pointermove',pointerMove);listen(node,'pointerup',event=>pointerEnd(event));listen(node,'pointercancel',event=>pointerEnd(event,true));listen(node,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)pointerEnd(event,true);});
     listen(node,'click',event=>{event.stopPropagation();if(!drag)selectClip(index);});
     listen(node,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectClip(index);return;}if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();state.selectedIndex=index;const change=event.key==='ArrowRight'?1:-1;state.focusClip=index;state.revealClip=index;update(index,event.shiftKey?{durationTiles:Math.max(minimumFor(index),clip.durationTiles+change)}:{startTile:Math.max(0,clip.startTile+change)});});
    }
   }
  }
  grid.append(playhead);scroll.scrollLeft=state.scrollLeft;scroll.scrollTop=state.scrollTop;updateClock(state.currentTile);bindingScope=previousBindings;
 }
 listen(document,'quietbellcutscene',event=>{const detail=event.detail??{};if(detail.roomId!==roomId||!detail.preview||destroyed)return;state.playing=!!detail.playing&&!detail.finished;if(detail.playbackRate)state.playbackRate=detail.playbackRate===2?2:1;updateClock(detail.currentTile??0);if(detail.phase==='entry'){entryPreviewActive=!detail.finished;if(!detail.finished){const entry=detail.entry??{};readout.textContent=`Room entry · ${integer(entry.currentTile)} / ${integer(entry.totalTiles)} tiles`;}}paintTransport();paintRate();});
 renderGrid();renderProperties();updateClock(state.currentTile);notifySelection();
 function fitTimeline(){
  const body=element.closest('#developer-body');if(destroyed||!body||!element.isConnected)return;
  const available=body.getBoundingClientRect().bottom-scroll.getBoundingClientRect().top-3;
  scroll.style.maxHeight=`${Math.max(44,Math.min(465,Math.floor(available)))}px`;
 }
 let layoutObserver=null;
 if(document.defaultView?.ResizeObserver){layoutObserver=new document.defaultView.ResizeObserver(fitTimeline);for(const node of [headline,transport,scrubLabel])layoutObserver.observe(node);cleanup.push(()=>layoutObserver.disconnect());}
 raf(()=>{if(destroyed)return;const body=element.closest('#developer-body');if(body)layoutObserver?.observe(body);fitTimeline();});
 if(state.revealClip!==undefined){const index=state.revealClip;delete state.revealClip;raf(()=>{if(!destroyed)revealClip(index);});}
 if(state.focusClip!==undefined){const index=state.focusClip;delete state.focusClip;raf(()=>{if(!destroyed)grid.querySelector(`[data-cutscene-clip="${index}"]`)?.focus({preventScroll:true});});}
 return{element,state,selectActor,selectClip,updatePath,flush:flushProperty,destroy(){if(destroyed)return;destroyed=true;pendingSeek=null;drag=null;state.scrollLeft=scroll.scrollLeft;state.scrollTop=scroll.scrollTop;for(const remove of [...cleanup,...gridCleanup,...propertyCleanup])remove();}};
}
