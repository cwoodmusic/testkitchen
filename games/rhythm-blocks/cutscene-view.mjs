import {createRoomCutscene} from './cutscene.mjs';
import {createRoomEntry} from './room-entry.mjs';
import {createRoomPreface} from './room-preface.mjs';
import {isWalkable,findPath} from './room.mjs';
import {createJrpgDialogue} from './jrpg-dialogue.mjs';
import {getNpcSpriteFrame} from './npc-sprites.mjs';
import {getNpcForwardFall,PIP_FORWARD_FALL} from './npc-gestures.mjs';
import {getDialogueReaction,getDialogueStageCue} from './dialogue-reactions.mjs';
import {createDepotProps} from './depot-props.mjs';
import {getSpeakerCues,getConversationActors} from './speaker-cues.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const EMOTES={
 idea:{label:'An idea',color:'#ffda70',path:'M8 3h8v2h3v9h-3v3H8v-3H5V5h3zm1 16h6v2H9zM11 0h2v2h-2zM0 8h3v2H0zm21 0h3v2h-3zM2 1h2v2H2zm18 0h2v2h-2z'},
 question:{label:'A question',color:'#9be3ee',path:'M7 3h10v2h3v7h-3v2h-4v4H9v-7h6V7H9v2H5V5h2zm2 18h4v3H9z'},
 thinking:{label:'Thinking',color:'#e8d5f6',path:'M2 10h4v4H2zm8 0h4v4h-4zm8 0h4v4h-4z'},
 surprise:{label:'Surprised',color:'#ffc69a',path:'M9 1h6v15H9zm0 19h6v4H9z'},
 happy:{label:'Delighted',color:'#c2ec9f',path:'M4 5h5v3H7v3H4zm11 0h5v6h-3V8h-2zM4 15h3v3h10v-3h3v5h-3v2H7v-2H4z'},
};

/** The body pivots around its measured boots; cinematic gestures never move feet. */
export function getCutsceneGesturePose(actor,{reducedMotion=false}={}){
 const gesture=actor?.gesture??null,p=clamp(Number.isFinite(actor?.gestureProgress)?actor.gestureProgress:0,0,1),direction=actor?.facing==='left'?-1:1;
 let angle=0;
 if(gesture==='trip'){
  if(reducedMotion)angle=82*p;
  else{
   const keys=[[0,0],[.22,-10],[.5,18],[.7,8],[1,82]];
   const end=keys.findIndex(key=>key[0]>=p),right=keys[Math.max(1,end)],left=keys[Math.max(0,end-1)];
   angle=left[1]+(right[1]-left[1])*(p-left[0])/(right[0]-left[0]);
  }
 }else if(gesture==='fallen')angle=82;
 else if(gesture==='recover'){const progress=reducedMotion?p:p*p*(3-2*p);angle=82*(1-progress);}
 return{angle:angle?angle*direction:0,progress:p,gesture,magnifying:gesture==='magnify'};
}

// A held brass lens, shaded on a tiny pixel grid like the party artwork. Its
// handle ends in a raised hand, while the transparent glass sits at eye level.
const MAGNIFIER_SVG='<svg viewBox="0 0 32 44" aria-hidden="true" shape-rendering="crispEdges"><path fill="#251e24" d="M10 0h12v2h6v4h2v16h-2v4h-6v2h-8v4h-2v4h-2v4H8v4H0V34h2v-4h2v-4h4v-4H6V6h2V2h2z"/><path fill="#77552c" d="M11 2h10v2h6v4h2v12h-2v4h-6v2H11v-2H7v-4H5V8h2V4h4z"/><path fill="#efc66b" d="M11 3h10v2h5v4h2v10h-2v4h-5v2H11v-2H7v-4H5V9h2V5h4z"/><path fill="#9e733a" d="M11 6h10v2h3v4h2v7h-2v3h-4v2h-9v-2H8V9h3z"/><path fill="#88d5d9" fill-opacity=".72" d="M12 7h9v2h3v11h-3v2h-9v-2H9V10h3z"/><path fill="#e2ffff" d="M12 8h7v2h-5v3h-3v4H9v-6h3z"/><path fill="#3f8f9e" d="M21 15h3v5h-3v2h-7v-2h6v-2h1z"/><path fill="#c49a4f" d="M11 24h7v4h-4v4h-3v4H8v4H3v-5h3v-5h3v-3h2z"/><path fill="#68422d" d="M10 29h4v4h-3v4H8v4H3v-5h3v-4h4z"/><path fill="#f4d397" d="M3 34h6v2h2v4H9v2H3v-2H1v-4h2z"/><path fill="#bd8459" d="M9 36h2v4H9v2H3v-2h5v-2h1z"/></svg>';

/** Keep the visible cast, interaction feet and collision in the same place. */
export function stageCutsceneScene(scene,poses=[]){
 const localIds=new Set(scene.actors.map(actor=>actor.id));
 const floor={...scene.geometry,obstacles:scene.geometry.obstacles.filter(item=>!localIds.has(item.id))};
 const deltas=new Map(),actors=scene.actors.map(actor=>{
  const at=poses.find(pose=>pose?.id===actor.id);
  if(!at||!Number.isFinite(at.x)||!Number.isFinite(at.y)||!isWalkable(floor,at))return actor;
  deltas.set(actor.id,{x:at.x-actor.feet.x,y:at.y-actor.feet.y});
  return {...actor,feet:{x:at.x,y:at.y},...(['up','down','left','right'].includes(at.facing)?{facing:at.facing}:{})};
 });
 if(!deltas.size)return scene;
 const obstacles=scene.geometry.obstacles.map(item=>deltas.has(item.id)?{...item,x:item.x+deltas.get(item.id).x,y:item.y+deltas.get(item.id).y}:item);
 const geometry={...scene.geometry,obstacles};
 let targets=scene.geometry.targets.map(target=>{
  const delta=deltas.get(target.id);if(!delta)return target;
  const at={x:target.x+delta.x,y:target.y+delta.y},b=geometry.bounds,r=geometry.radius;
  const candidates=[[0,65],[65,0],[-65,0],[0,-65],[65,65],[-65,65],[65,-65],[-65,-65]].map(([x,y])=>({x:clamp(at.x+x,b.x+r,b.x+b.width-r),y:clamp(at.y+y,b.y+r,b.y+b.height-r)}));
  const approach=candidates.find(point=>isWalkable(geometry,point))??target.approach;
  return {...target,...at,approach,range:Math.max(target.range,Math.hypot(at.x-approach.x,at.y-approach.y)+1)};
 });
 // A searching companion may now stand at a prop's former approach. Find a
 // reachable alternative inside the same interaction range, keeping the prop
 // itself fixed to the artwork.
 const mira=poses.find(pose=>pose?.id==='mira'),from=isWalkable(geometry,mira)?mira:geometry.start;
 targets=targets.map(target=>{
  if(isWalkable(geometry,target.approach)&&Math.hypot(target.x-target.approach.x,target.y-target.approach.y)<=target.range)return target;
  const candidates=[];
  for(const ratio of [.65,.85,.98])for(let index=0;index<24;index++){
   const angle=index*Math.PI/12;
   candidates.push({x:target.x+Math.cos(angle)*target.range*ratio,y:target.y+Math.sin(angle)*target.range*ratio});
  }
  candidates.sort((a,b)=>Math.hypot(a.x-target.approach.x,a.y-target.approach.y)-Math.hypot(b.x-target.approach.x,b.y-target.approach.y));
  const approach=candidates.find(point=>isWalkable(geometry,point)&&findPath({...geometry,targets},from,point));
  return approach?{...target,approach}:target;
 });
 const objects=scene.objects.map(item=>deltas.has(item.id)?{...item,rect:{...item.rect,x:item.rect.x+deltas.get(item.id).x,y:item.rect.y+deltas.get(item.id).y}}:item);
 return freeze({...scene,actors,objects,geometry:{...geometry,targets}});
}

/** Cinematic visuals are temporary; only onFinish may retain their final feet. */
export function createCutsceneView({root,map,panel,roomView,scene,project,beats,playerPosition,preview=false,paused=false,tile=0,withEntry=true,narration=null,cinematicAudio=null,playbackRate=1,onRateChange=()=>{},onFinish=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const entry=withEntry?createRoomEntry({scene,playerPosition,playerSize:project.player.worldSize}):null;
 const timeline=createRoomCutscene({scene,beats,playerPosition,actors:entry?.timeline.endActors,reducedMotion:reduced,manualDialogue:!preview});
 const preface=withEntry&&!preview&&typeof narration==='string'&&narration.trim()?createRoomPreface({text:narration}):null;
 const prefaceActors=preface?(entry?.state.actors??timeline.state.actors).map(actor=>({...actor,moving:false,gait:'walk',action:null,target:null,emote:null,gesture:null,gestureProgress:0})):null;
 const prefaceBeat=preface?freeze({id:scene.id+'-narration',kind:'narration',speaker:'narrator',text:preface.state.text,startTile:0}):null;
 // Keep both physical clocks at their exact initial pose while the room is read.
 if(preface){entry?.pause();timeline.pause();}
 let disposed=false,frame=0,last=0,lastCaption='',lastEvent='',finishing=false,reservedBottom=0,speakingCue=null,rate=playbackRate===2?2:1;
 const playerElement=map.querySelector('#player-sprite');
 const actorElements=new Map(scene.actors.map(actor=>[actor.id,map.querySelector('[data-actor="'+actor.id+'"]')]));
 const definitions=new Map(scene.actors.map(actor=>[actor.id,actor]));
 const names=new Map(project.content[scene.id].people.map(person=>[person.id,person.name]));
 const emotes=new Map(),emoteOrigins=new Map(),props=new Map(),fallSprites=new Map(),pickers=new Map(),spriteFrames=new Map(),styleValues=new WeakMap(),removers=[],wasInert=map.inert,wasOverflow=map.style.overflow;
 const actorOpacity=new Map([...actorElements].filter(([,element])=>element).map(([id,element])=>[id,element.style.opacity]));
 // Begin decoding before the doorway run, rather than fetching the pose sheet
 // at impact and briefly hiding Pip while its first CSS background arrives.
 const fallImage=new Image();let fallReady=false;fallImage.onload=()=>{fallReady=true;if(!disposed)paint();};fallImage.src=PIP_FORWARD_FALL.image;
 if(fallImage.complete&&fallImage.naturalWidth)fallReady=true;
 map.inert=!preview;
 const fade=document.createElement('div');fade.className='room-entry-fade';fade.setAttribute('aria-hidden','true');fade.hidden=!entry;root.append(fade);
 const speaker=panel.querySelector('#cutscene-speaker'),line=panel.querySelector('#cutscene-line'),counter=panel.querySelector('#cutscene-counter');
 const dialogue=createJrpgDialogue({panel,line}),soundTrack=cinematicAudio?.createTrack();
 const nextButton=panel.querySelector('#cutscene-next'),skipButton=panel.querySelector('#cutscene-skip'),speedButton=panel.querySelector('#cutscene-speed');
 counter.textContent=preview?'Timeline preview':scene.title;
 nextButton.disabled=preview;skipButton.textContent=preview?'Stop preview':'Skip';
 const style=(element,name,value)=>{let values=styleValues.get(element);if(!values){values=new Map();styleValues.set(element,values);}if(values.get(name)!==value){element.style[name]=value;values.set(name,value);}};
 const data=(element,name,value)=>{if(element.dataset[name]!==value)element.dataset[name]=value;};
 const depotProps=createDepotProps({map,scene,reducedMotion:reduced,onReady:()=>{if(!disposed)paint();}});
 const narrating=()=>!!preface&&!preface.state.finished;
 const entering=()=>!!entry&&!entry.state.finished;
 function entryInfo(){const state=entry?.state;return state?{currentTile:state.currentTile,totalTiles:state.totalTiles,elapsed:state.elapsed,quantumMs:state.quantumMs,fadeTiles:entry.timeline.fadeTiles,fadeOpacity:state.fadeOpacity,finished:state.finished,playing:state.playing}:null;}
 function snapshot(){
  const story=timeline.state,arrival=entry?.state,info=entryInfo(),narration=preface?.state??null;
  if(narrating())return{...story,index:-2,beat:prefaceBeat,actors:prefaceActors,focus:{x:scene.geometry.width/2,y:scene.geometry.height/2},elapsed:0,currentTile:0,holding:true,playing:narration.playing,finished:false,nextPending:false,awaitingAdvance:true,manualDialogue:true,dialogueElapsed:narration.elapsed,dialogueFinished:false,activeClips:[],activeClipIds:[],phase:'narration',entry:info,narration};
  if(arrival&&!arrival.finished)return{...story,index:-1,beat:null,actors:arrival.actors,focus:arrival.focus,elapsed:arrival.elapsed,holding:!arrival.actors.some(actor=>actor.moving),playing:arrival.playing,finished:false,nextPending:false,awaitingAdvance:false,dialogueElapsed:0,dialogueFinished:false,activeClips:arrival.activeClips??[],activeClipIds:arrival.activeClipIds??[],phase:'entry',entry:info,narration};
  return{...story,phase:'story',entry:info,narration};
 }
 function publicState(state=snapshot()){return freeze({...state,preview,roomId:scene.id,playbackRate:rate,textComplete:dialogue.state.complete,visibleCharacters:dialogue.state.visibleCharacters,totalCharacters:dialogue.state.totalCharacters});}
 function listen(target,name,fn,options){target.addEventListener(name,fn,options);removers.push(()=>target.removeEventListener(name,fn,options));}
 function emit(state){
  const key=[state.phase,Math.floor(state.entry?.currentTile??0),Math.floor(state.currentTile??0),state.index,state.playing,state.finished,state.nextPending,rate].join('|');if(key===lastEvent)return;lastEvent=key;
  document.dispatchEvent(new CustomEvent('quietbellcutscene',{detail:{...state,preview,roomId:scene.id,playbackRate:rate}}));
 }
 function paint(state=snapshot(),deltaMs=16,snapCamera=false,audible=false){
  if(disposed)return;
  const arrival=state.phase==='entry',previousPhase=root.dataset.cutscenePhase;
  if(root.dataset.cutscenePhase!==state.phase){root.dataset.cutscenePhase=state.phase;map.style.overflow=arrival||state.phase==='narration'?'hidden':wasOverflow;}
  data(panel,'phase',state.phase);
  const opacity=arrival?state.entry.fadeOpacity:0;
  style(fade,'opacity',String(opacity));if(fade.hidden!==!(arrival&&opacity>0))fade.hidden=!(arrival&&opacity>0);
  const beat=state.beat,id=beat?.speaker??beat?.actor;
  const caption=[id,beat?.id,state.index,beat?.text].join('|');
  if(caption!==lastCaption){
   lastCaption=caption;speaker.textContent=id==='narrator'?'Narrator':id==='mira'?'Mira':names.get(id)??(id?String(id):'The party');
   panel.classList.toggle('cutscene-silent',!beat);
   dialogue.setLine(beat?.text??'');
   // Measure only when the text changes, before any animation writes. Reading
   // layout after moving every sprite forced a second layout on every frame.
   reservedBottom=panel.getBoundingClientRect().height+20;
  }
  if(!beat)dialogue.revealAll();
  dialogue.update(beat?state.manualDialogue?state.dialogueElapsed:Math.max(0,(state.currentTile-beat.startTile)*state.quantumMs):0);
  soundTrack?.sample(state,{visibleCharacters:dialogue.state.visibleCharacters,audible});
  const speechReaction=getDialogueReaction(state);
  const speakerCue=getSpeakerCues(state,{reducedMotion:reduced});
  const conversationActors=getConversationActors(state);
  if(speakingCue&&!speakerCue?.showMarker&&!speakingCue.hidden)speakingCue.hidden=true;
  depotProps.paint(state);
  for(const actor of conversationActors){
   const element=actorElements.get(actor.id),definition=definitions.get(actor.id);
   const reaction=speechReaction?.actorId===actor.id?speechReaction:null;
   const emoteKind=reaction?.emote??actor.emote??(actor.id===id?beat?.emote:null);
   const gesture=getCutsceneGesturePose(actor,{reducedMotion:reduced});
   const sprite=element&&definition?getNpcSpriteFrame({project,actor:definition,pose:actor,elapsed:state.elapsed}):null;
   const forwardCandidate=definition?getNpcForwardFall({project,actor:definition,pose:actor,standingSprite:sprite}):null;
   const forward=fallReady?forwardCandidate:null;
   if(element&&definition){
    const lean=forwardCandidate?0:gesture.gesture?gesture.angle:!actor.moving&&['search','examine'].includes(actor.action)&&!reduced?(actor.facing==='left'?-3:3):0;
    const spriteKey=[sprite.image,sprite.backgroundSize,sprite.backgroundPosition,sprite.aspectRatio].join('|');
    if(spriteFrames.get(actor.id)!==spriteKey){spriteFrames.set(actor.id,spriteKey);style(element,'backgroundImage',`url(${JSON.stringify(sprite.image)})`);style(element,'backgroundSize',sprite.backgroundSize);style(element,'backgroundPosition',sprite.backgroundPosition);style(element,'aspectRatio',String(sprite.aspectRatio));}
    style(element,'transform',`translate3d(${actor.x-definition.feet.x}px,${actor.y-definition.feet.y}px,0) translate(${-sprite.anchor[0]*100}%,${-sprite.anchor[1]*100}%) rotate(${lean}deg)`);
    style(element,'transformOrigin',`${sprite.anchor[0]*100}% ${sprite.anchor[1]*100}%`);style(element,'zIndex',String(Math.round(actor.y)+1));
    data(element,'moving',String(actor.moving));data(element,'action',actor.action??'');data(element,'facing',sprite.facing);data(element,'frame',String(sprite.frame));data(element,'spriteRow',String(sprite.row));data(element,'spriteAnimated',String(sprite.animated));data(element,'emote',emoteKind??'');data(element,'dialogueReaction',String(!!reaction));data(element,'speaking',String(speakerCue?.speakerId===actor.id));
    data(element,'gait',actor.gait??'walk');data(element,'gesture',gesture.gesture??'');data(element,'gestureProgress',String(Math.round(gesture.progress*10000)/10000));
    style(element,'opacity',forward?String(forward.standingOpacity):actorOpacity.get(actor.id)??'');
    data(element,'spriteMode',forward?'forward-fall':'standing');
    if(forward){data(element,'forwardPose',forward.pose);data(element,'headX',String(actor.x+forward.head.x));data(element,'headY',String(actor.y+forward.head.y));data(element,'footX',String(actor.x));data(element,'footY',String(actor.y));}
    else for(const name of ['forwardPose','headX','headY','footX','footY'])delete element.dataset[name];
   }
   let fall=fallSprites.get(actor.id);
   if(forward){
    if(!fall){
     const node=document.createElement('div');node.className='cutscene-forward-fall';node.dataset.character=actor.id;node.setAttribute('aria-hidden','true');
     const layers=[0,1].map(()=>{const child=document.createElement('div');child.className='cutscene-forward-fall-frame';node.append(child);return child;});
     node.style.left=`${actor.x/scene.geometry.width*100}%`;node.style.top=`${actor.y/scene.geometry.height*100}%`;node.style.width=`${definition.worldSize/scene.geometry.width*100}%`;
     fall={element:node,layers,origin:{x:actor.x,y:actor.y}};fallSprites.set(actor.id,fall);map.append(node);
    }
    style(fall.element,'transform',`translate3d(${actor.x-fall.origin.x}px,${actor.y-fall.origin.y}px,0)`);style(fall.element,'zIndex',String(Math.round(actor.y)+1));
    data(fall.element,'facing',forward.facing);data(fall.element,'pose',forward.pose);data(fall.element,'gesture',forward.gesture);
    for(const [index,node]of fall.layers.entries()){
     const layer=forward.layers[index];
     if(!layer){node.hidden=true;continue;}
     style(node,'backgroundImage',`url(${JSON.stringify(layer.image)})`);style(node,'backgroundSize',layer.backgroundSize);style(node,'backgroundPosition',layer.backgroundPosition);
     style(node,'transform',`translate(${-layer.anchor[0]*100}%,${-layer.anchor[1]*100}%)`);style(node,'opacity',String(layer.opacity));
     data(node,'pose',layer.pose);data(node,'frame',String(layer.frame));data(node,'row',String(layer.row));data(node,'anchorX',String(layer.anchor[0]));data(node,'anchorY',String(layer.anchor[1]));
     node.hidden=false;
    }
    fall.element.hidden=false;
   }else if(fall)fall.element.hidden=true;
   let prop=props.get(actor.id);
   if(gesture.magnifying){
    if(!prop){
     const node=document.createElement('div');node.className='cutscene-prop cutscene-magnifier';node.dataset.prop='magnifying-glass';node.dataset.character=actor.id;node.setAttribute('role','img');node.setAttribute('aria-label',`${names.get(actor.id)??actor.id} holds a magnifying glass`);node.innerHTML=MAGNIFIER_SVG;
     node.style.left=`${actor.x/scene.geometry.width*100}%`;node.style.top=`${actor.y/scene.geometry.height*100}%`;
     prop={element:node,origin:{x:actor.x,y:actor.y}};props.set(actor.id,prop);map.append(node);
    }
    const size=(definition?.worldSize??project.player.worldSize)/160,pull=Math.min(1,gesture.progress/.16,(1-gesture.progress)/.16),left=actor.facing==='left',offsetX=(left?-57:13)*size,offsetY=(-96+22*(1-pull))*size;
    style(prop.element,'transform',`translate3d(${actor.x-prop.origin.x+offsetX}px,${actor.y-prop.origin.y+offsetY}px,0) scale(${size}) scaleX(${left?-1:1}) rotate(${(left?1:-1)*15*(1-pull)}deg)`);
    style(prop.element,'opacity',String(Math.min(1,pull*3)));style(prop.element,'zIndex',String(Math.round(actor.y)+(actor.facing==='up'?0:2)));data(prop.element,'facing',actor.facing);data(prop.element,'gestureProgress',String(Math.round(gesture.progress*10000)/10000));if(prop.element.hidden)prop.element.hidden=false;
   }else if(prop&&!prop.element.hidden)prop.element.hidden=true;
   if(preview){
    let picker=pickers.get(actor.id);
    if(!picker?.element.isConnected){
     const button=map.querySelector(`[data-person="${actor.id}"],[data-cutscene-actor="${actor.id}"]`);
     if(button){picker={element:button,origin:definition?.feet??{x:Number(button.dataset.originX),y:Number(button.dataset.originY)}};pickers.set(actor.id,picker);}
    }
    if(picker)style(picker.element,'transform',`translate3d(${actor.x-picker.origin.x}px,${actor.y-picker.origin.y}px,0)`);
   }
   const kind=emoteKind,icon=EMOTES[kind];
   let emote=emotes.get(actor.id);
   if(icon){
    const size=definition?.worldSize??project.player.worldSize;
    if(!emote){
     emote=document.createElement('div');emote.className='cutscene-emote';emote.dataset.character=actor.id;emote.setAttribute('role','img');
     const origin={x:actor.x,y:actor.y-size*.9};emoteOrigins.set(actor.id,origin);
     emote.style.left=`${origin.x/scene.geometry.width*100}%`;emote.style.top=`${origin.y/scene.geometry.height*100}%`;
     map.append(emote);emotes.set(actor.id,emote);
    }
    if(emote.dataset.cutsceneEmote!==kind){emote.dataset.cutsceneEmote=kind;emote.setAttribute('aria-label',icon.label);emote.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path fill="${icon.color}" d="${icon.path}"/></svg>`;}
    data(emote,'dialogueReaction',String(!!reaction));data(emote,'reactionElapsed',reaction?String(Math.round(reaction.elapsedMs)):'');data(emote,'reactionDuration',reaction?String(reaction.durationMs):'');
    style(emote,'opacity',reaction&&!reduced?String(clamp((reaction.durationMs-reaction.elapsedMs)/200,0,1)):'1');
    const origin=emoteOrigins.get(actor.id);
    const radians=gesture.angle*Math.PI/180;
    const head=forward?{x:actor.x+forward.head.x,y:actor.y+forward.head.y-12}:{x:actor.x+Math.sin(radians)*size*.8,y:actor.y-Math.cos(radians)*size*.9};
    style(emote,'transform',`translate3d(${head.x-origin.x}px,${head.y-origin.y}px,0) translate(-50%,-100%)`);
    if(emote.hidden)emote.hidden=false;
   }else if(emote){data(emote,'dialogueReaction','false');data(emote,'reactionElapsed','');data(emote,'reactionDuration','');if(!emote.hidden)emote.hidden=true;}
   if(speakerCue?.showMarker&&speakerCue.speakerId===actor.id){
    if(!speakingCue){
     speakingCue=document.createElement('div');speakingCue.className='cutscene-speaking-cue';speakingCue.setAttribute('role','img');
     speakingCue.style.left='0';speakingCue.style.top='0';
     speakingCue.innerHTML='<svg viewBox="0 0 36 28" aria-hidden="true" shape-rendering="crispEdges"><path fill="#201b2d" d="M4 0h28v2h4v19h-4v3H17l-7 4v-4H4v-3H0V4h4z"/><path fill="#f1d18c" d="M4 2h28v2h2v15h-2v3H16l-4 3v-3H4v-3H2V4h2z"/><path fill="#30243d" d="M5 5h26v13H5z"/><path fill="#fff1c8" d="M8 10h4v4H8zm8 0h4v4h-4zm8 0h4v4h-4z"/></svg>';
     map.append(speakingCue);
    }
    const size=definition?.worldSize??project.player.worldSize,radians=gesture.angle*Math.PI/180;
    const head=forward?{x:actor.x+forward.head.x,y:actor.y+forward.head.y-12}:{x:actor.x+Math.sin(radians)*size*.8,y:actor.y-Math.cos(radians)*size*.9};
    data(speakingCue,'character',actor.id);data(speakingCue,'speakerCue','true');data(speakingCue,'cueElapsed',String(Math.round(speakerCue.elapsedMs)));data(speakingCue,'cueDuration',String(speakerCue.durationMs));
    const label=`${actor.id==='mira'?'Mira':names.get(actor.id)??actor.id} is speaking`;if(speakingCue.getAttribute('aria-label')!==label)speakingCue.setAttribute('aria-label',label);
    const cueSide=actor.x>scene.geometry.width*.5?-1:1;
    const cueX=`calc(${head.x}px ${cueSide>0?'+':'-'} max(${size*.45}px,calc(34px / var(--room-scale,1))))`;
    style(speakingCue,'transform',`translate3d(${cueX},${head.y+size*.04}px,0) translate(-50%,-100%)`);style(speakingCue,'opacity',String(speakerCue.opacity));if(speakingCue.hidden)speakingCue.hidden=false;
   }
  }
  const player=conversationActors.find(actor=>actor.id==='mira');
  const showCourier=getDialogueStageCue(state)?.cue==='courier-signal'&&scene.id==='depot'&&scene.image==='assets/parcel-depot.webp';
  const focus=showCourier?{...state.focus,x:850}:state.focus;
  roomView.setCinematicFrame({focus,player,playerVisual:getCutsceneGesturePose(player,{reducedMotion:reduced}),elapsed:state.elapsed,reservedBottom,deltaMs,snapCamera,reducedMotion:reduced});
  if(playerElement)data(playerElement,'speaking',String(speakerCue?.speakerId==='mira'));
  const silentManual=state.manualDialogue&&!beat;
  const disabled=preview||arrival||state.finished||state.nextPending||silentManual;
  if(nextButton.disabled!==disabled)nextButton.disabled=disabled;
  const reading=!preview&&!arrival&&!!beat&&!state.finished;
  if(reading){
   const complete=dialogue.state.complete;
   data(panel,'dialogueMode','manual');data(panel,'dialogueState',complete?'waiting':'revealing');
   const nextLabel=complete?state.phase==='narration'?'Enter the room':'Advance to the next line':'Show the rest of this line';if(nextButton.getAttribute('aria-label')!==nextLabel)nextButton.setAttribute('aria-label',nextLabel);
  }else{delete panel.dataset.dialogueMode;delete panel.dataset.dialogueState;nextButton.removeAttribute('aria-label');}
  if(!preview&&previousPhase==='entry'&&!arrival&&!disabled)nextButton.focus({preventScroll:true});
  const nextLabel=state.phase==='narration'&&dialogue.state.complete?'Enter room ›':arrival?'Entering…':silentManual&&state.dialogueFinished?'Finishing…':state.nextPending||silentManual?'Walking…':'Next ›';if(nextButton.textContent!==nextLabel)nextButton.textContent=nextLabel;
  const rateLabel=`${rate}×`;if(speedButton.textContent!==rateLabel)speedButton.textContent=rateLabel;
  const pressed=String(rate===2),speedLabel=rate===2?'Double speed. Switch to normal speed.':'Normal speed. Switch to double speed.';
  if(speedButton.getAttribute('aria-pressed')!==pressed)speedButton.setAttribute('aria-pressed',pressed);
  if(speedButton.getAttribute('aria-label')!==speedLabel)speedButton.setAttribute('aria-label',speedLabel);
  emit(state);
  if(state.finished&&!preview&&!finishing){finishing=true;queueMicrotask(()=>{if(!disposed)onFinish({state,skipped:false});});}
 }
 function schedule(state=snapshot()){
  const waiting=state.phase==='narration'?dialogue.state.complete:state.manualDialogue&&state.phase==='story'&&state.currentTile>=state.totalTiles&&dialogue.state.complete;
  if(!disposed&&!frame&&state.playing&&!state.finished&&!document.hidden&&(!waiting||getSpeakerCues(state)?.showMarker||getDialogueReaction(state)||depotProps.needsAnimation(state)))frame=requestAnimationFrame(tick);
 }
 function tick(now){
  frame=0;if(disposed)return;const delta=last?Math.min(80,Math.max(0,now-last)):16;last=now;
  const transport=narrating()?preface:entering()?entry:timeline;
  // The following frame starts the story at its exact first pose. Never apply
  // this whole delta to both sides of the doorway/story handoff.
  for(let remaining=delta*rate;remaining>0;remaining-=100)transport.update(Math.min(100,remaining));
  const state=snapshot();paint(state,delta,false,true);schedule(state);
 }
 function pause(){soundTrack?.stop();preface?.pause();entry?.pause();timeline.pause();if(frame)cancelAnimationFrame(frame);frame=0;last=0;paint();return publicState();}
 function play(){void cinematicAudio?.unlock();if(snapshot().finished){preface?.restart();entry?.seek(0);timeline.seek(0);finishing=false;}if(narrating())preface.play();else{if(entering())entry.play();timeline.play();}last=0;paint();schedule();return publicState();}
 function seek(value){soundTrack?.stop();const resume=narrating()&&preface.state.playing;preface?.finish();entry?.skip();timeline.seek(value);if(resume&&!timeline.state.finished)timeline.play();last=0;paint(snapshot(),16,true);schedule();return publicState();}
 function setRate(value){rate=value===2?2:1;last=0;onRateChange(rate);paint();return publicState();}
 function skip(){if(disposed)return;soundTrack?.stop();preface?.finish();entry?.skip();timeline.skip();onFinish({state:snapshot(),skipped:true});}
 function destroy(){if(disposed)return;disposed=true;soundTrack?.destroy();depotProps.destroy();speakingCue?.remove();if(playerElement)delete playerElement.dataset.speaking;if(frame)cancelAnimationFrame(frame);frame=0;for(const remove of removers)remove();for(const emote of emotes.values())emote.remove();for(const prop of props.values())prop.element.remove();for(const fall of fallSprites.values())fall.element.remove();fallImage.onload=null;for(const [id,element]of actorElements)if(element){for(const name of ['gesture','gestureProgress','gait','spriteMode','forwardPose','headX','headY','footX','footY','dialogueReaction','speaking'])delete element.dataset[name];element.style.opacity=actorOpacity.get(id)??'';}fade.remove();dialogue.destroy();map.inert=wasInert;map.style.overflow=wasOverflow;roomView.setCinematicFrame(null);root.classList.remove('cutscene-playing','cutscene-preview');delete root.dataset.cutscenePhase;panel.classList.remove('cutscene-silent');delete panel.dataset.phase;delete panel.dataset.dialogueMode;delete panel.dataset.dialogueState;nextButton.removeAttribute('aria-label');panel.hidden=true;}
 function advance(){
  if(preview)return;
  if(narrating()){
   if(!dialogue.state.complete){dialogue.revealAll();paint();return;}
   const resume=preface.state.playing;preface.finish();
   if(resume){if(entering())entry.play();timeline.play();}
   last=0;paint();schedule();return;
  }
  if(entering()||!snapshot().beat)return;
  if(!dialogue.state.complete){dialogue.revealAll();paint();return;}timeline.next();last=0;paint();schedule();
 }
 listen(nextButton,'click',advance);listen(skipButton,'click',skip);
 listen(panel,'click',event=>{if(preview||event.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;advance();});
 listen(speedButton,'click',()=>setRate(rate===2?1:2));
 listen(document,'keydown',event=>{
  if(preview||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,[contenteditable="true"]'))return;
  if(['Enter',' '].includes(event.key)&&event.target.closest('button'))return;
  if(['Escape','Enter',' ','e','E'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.repeat)return;if(event.key==='Escape')skip();else advance();}
 });
 let resumeAfterHidden=false;
 listen(document,'visibilitychange',()=>{if(document.hidden){resumeAfterHidden=resumeAfterHidden||snapshot().playing;pause();}else if(resumeAfterHidden){resumeAfterHidden=false;play();}});
 listen(window,'blur',()=>{resumeAfterHidden=resumeAfterHidden||snapshot().playing;pause();});listen(window,'focus',()=>{if(resumeAfterHidden&&!document.hidden){resumeAfterHidden=false;play();}});
 root.classList.add('cutscene-playing');root.classList.toggle('cutscene-preview',preview);panel.hidden=false;
 if(globalThis.ResizeObserver){const observer=new ResizeObserver(entries=>{const size=entries[0]?.borderBoxSize?.[0]?.blockSize;if(Number.isFinite(size))reservedBottom=size+20;});observer.observe(panel);removers.push(()=>observer.disconnect());}
 if(tile){preface?.finish();entry?.skip();timeline.seek(tile);if(!paused)timeline.play();}if(paused){preface?.pause();entry?.pause();timeline.pause();}paint();schedule();
 if(!preview)nextButton.focus({preventScroll:true});
 return Object.freeze({get state(){return publicState();},get safeState(){return narrating()||entering()?publicState({...timeline.state,phase:'story',entry:entryInfo(),narration:preface?.state??null}):publicState();},pause,play,seek,setRate,skip,destroy});
}
