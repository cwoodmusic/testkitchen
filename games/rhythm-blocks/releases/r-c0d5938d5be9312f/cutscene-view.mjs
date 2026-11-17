import {createRoomCutscene} from './cutscene.mjs';
import {createRoomEntry} from './room-entry.mjs';
import {isWalkable,findPath} from './room.mjs';
import {createJrpgDialogue} from './jrpg-dialogue.mjs';
import {getNpcSpriteFrame} from './npc-sprites.mjs';

const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const EMOTES={
 idea:{label:'An idea',color:'#ffda70',path:'M8 3h8v2h3v9h-3v3H8v-3H5V5h3zm1 16h6v2H9zM11 0h2v2h-2zM0 8h3v2H0zm21 0h3v2h-3zM2 1h2v2H2zm18 0h2v2h-2z'},
 question:{label:'A question',color:'#9be3ee',path:'M7 3h10v2h3v7h-3v2h-4v4H9v-7h6V7H9v2H5V5h2zm2 18h4v3H9z'},
 thinking:{label:'Thinking',color:'#e8d5f6',path:'M2 10h4v4H2zm8 0h4v4h-4zm8 0h4v4h-4z'},
 surprise:{label:'A discovery',color:'#ffc69a',path:'M9 1h6v15H9zm0 19h6v4H9z'},
 happy:{label:'Delighted',color:'#c2ec9f',path:'M4 5h5v3H7v3H4zm11 0h5v6h-3V8h-2zM4 15h3v3h10v-3h3v5h-3v2H7v-2H4z'},
};

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
export function createCutsceneView({root,map,panel,roomView,scene,project,beats,playerPosition,preview=false,paused=false,tile=0,withEntry=true,playbackRate=1,onRateChange=()=>{},onFinish=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const entry=withEntry?createRoomEntry({scene,playerPosition,playerSize:project.player.worldSize}):null;
 const timeline=createRoomCutscene({scene,beats,playerPosition,actors:entry?.timeline.endActors,reducedMotion:reduced});
 let disposed=false,frame=0,last=0,lastCaption='',lastEvent='',finishing=false,reservedBottom=0,rate=playbackRate===2?2:1;
 const actorElements=new Map(scene.actors.map(actor=>[actor.id,map.querySelector('[data-actor="'+actor.id+'"]')]));
 const definitions=new Map(scene.actors.map(actor=>[actor.id,actor]));
 const names=new Map(project.content[scene.id].people.map(person=>[person.id,person.name]));
 const emotes=new Map(),emoteOrigins=new Map(),pickers=new Map(),spriteFrames=new Map(),styleValues=new WeakMap(),removers=[],wasInert=map.inert,wasOverflow=map.style.overflow;map.inert=!preview;
 const fade=document.createElement('div');fade.className='room-entry-fade';fade.setAttribute('aria-hidden','true');fade.hidden=!entry;root.append(fade);
 const speaker=panel.querySelector('#cutscene-speaker'),line=panel.querySelector('#cutscene-line'),counter=panel.querySelector('#cutscene-counter');
 const dialogue=createJrpgDialogue({panel,line});
 const nextButton=panel.querySelector('#cutscene-next'),skipButton=panel.querySelector('#cutscene-skip'),speedButton=panel.querySelector('#cutscene-speed');
 counter.textContent=preview?'Timeline preview':scene.title;
 nextButton.disabled=preview;skipButton.textContent=preview?'Stop preview':'Skip';
 const style=(element,name,value)=>{let values=styleValues.get(element);if(!values){values=new Map();styleValues.set(element,values);}if(values.get(name)!==value){element.style[name]=value;values.set(name,value);}};
 const data=(element,name,value)=>{if(element.dataset[name]!==value)element.dataset[name]=value;};
 const entering=()=>!!entry&&!entry.state.finished;
 function entryInfo(){const state=entry?.state;return state?{currentTile:state.currentTile,totalTiles:state.totalTiles,elapsed:state.elapsed,quantumMs:state.quantumMs,fadeTiles:entry.timeline.fadeTiles,fadeOpacity:state.fadeOpacity,finished:state.finished,playing:state.playing}:null;}
 function snapshot(){
  const story=timeline.state,arrival=entry?.state,info=entryInfo();
  if(arrival&&!arrival.finished)return{...story,index:-1,beat:null,actors:arrival.actors,focus:arrival.focus,elapsed:arrival.elapsed,holding:!arrival.actors.some(actor=>actor.moving),playing:arrival.playing,finished:false,nextPending:false,activeClips:arrival.activeClips??[],activeClipIds:arrival.activeClipIds??[],phase:'entry',entry:info};
  return{...story,phase:'story',entry:info};
 }
 function publicState(state=snapshot()){return freeze({...state,preview,roomId:scene.id,playbackRate:rate,textComplete:dialogue.state.complete,visibleCharacters:dialogue.state.visibleCharacters,totalCharacters:dialogue.state.totalCharacters});}
 function listen(target,name,fn,options){target.addEventListener(name,fn,options);removers.push(()=>target.removeEventListener(name,fn,options));}
 function emit(state){
  const key=[state.phase,Math.floor(state.entry?.currentTile??0),Math.floor(state.currentTile??0),state.index,state.playing,state.finished,state.nextPending,rate].join('|');if(key===lastEvent)return;lastEvent=key;
  document.dispatchEvent(new CustomEvent('quietbellcutscene',{detail:{...state,preview,roomId:scene.id,playbackRate:rate}}));
 }
 function paint(state=snapshot(),deltaMs=16,snapCamera=false){
  if(disposed)return;
  const arrival=state.phase==='entry',previousPhase=root.dataset.cutscenePhase;
  if(root.dataset.cutscenePhase!==state.phase){root.dataset.cutscenePhase=state.phase;map.style.overflow=arrival?'hidden':wasOverflow;}
  data(panel,'phase',state.phase);
  const opacity=arrival?state.entry.fadeOpacity:0;
  style(fade,'opacity',String(opacity));if(fade.hidden!==!(arrival&&opacity>0))fade.hidden=!(arrival&&opacity>0);
  const beat=state.beat,id=beat?.speaker??beat?.actor;
  const caption=[id,beat?.id,state.index,beat?.text].join('|');
  if(caption!==lastCaption){
   lastCaption=caption;speaker.textContent=id==='mira'?'Mira':names.get(id)??(id?String(id):'The party');
   panel.classList.toggle('cutscene-silent',!beat);
   dialogue.setLine(beat?.text??'');
   // Measure only when the text changes, before any animation writes. Reading
   // layout after moving every sprite forced a second layout on every frame.
   reservedBottom=panel.getBoundingClientRect().height+20;
  }
  if(!beat)dialogue.revealAll();
  dialogue.update(beat?Math.max(0,(state.currentTile-beat.startTile)*state.quantumMs):0);
  for(const actor of state.actors){
   const element=actorElements.get(actor.id),definition=definitions.get(actor.id);
   if(element&&definition){
    const sprite=getNpcSpriteFrame({project,actor:definition,pose:actor,elapsed:state.elapsed});
    const lean=!actor.moving&&['search','examine'].includes(actor.action)&&!reduced?(actor.facing==='left'?-3:3):0;
    const spriteKey=[sprite.image,sprite.backgroundSize,sprite.backgroundPosition,sprite.aspectRatio].join('|');
    if(spriteFrames.get(actor.id)!==spriteKey){spriteFrames.set(actor.id,spriteKey);style(element,'backgroundImage',`url(${JSON.stringify(sprite.image)})`);style(element,'backgroundSize',sprite.backgroundSize);style(element,'backgroundPosition',sprite.backgroundPosition);style(element,'aspectRatio',String(sprite.aspectRatio));}
    style(element,'transform',`translate3d(${actor.x-definition.feet.x}px,${actor.y-definition.feet.y}px,0) translate(${-sprite.anchor[0]*100}%,${-sprite.anchor[1]*100}%) rotate(${lean}deg)`);
    style(element,'transformOrigin',`${sprite.anchor[0]*100}% ${sprite.anchor[1]*100}%`);style(element,'zIndex',String(Math.round(actor.y)+1));
    data(element,'moving',String(actor.moving));data(element,'action',actor.action??'');data(element,'facing',sprite.facing);data(element,'frame',String(sprite.frame));data(element,'spriteRow',String(sprite.row));data(element,'spriteAnimated',String(sprite.animated));data(element,'emote',actor.emote??'');
   }
   if(preview){
    let picker=pickers.get(actor.id);
    if(!picker?.element.isConnected){
     const button=map.querySelector(`[data-person="${actor.id}"],[data-cutscene-actor="${actor.id}"]`);
     if(button){picker={element:button,origin:definition?.feet??{x:Number(button.dataset.originX),y:Number(button.dataset.originY)}};pickers.set(actor.id,picker);}
    }
    if(picker)style(picker.element,'transform',`translate3d(${actor.x-picker.origin.x}px,${actor.y-picker.origin.y}px,0)`);
   }
   const kind=actor.emote??(actor.id===id?beat?.emote:null),icon=EMOTES[kind];
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
    const origin=emoteOrigins.get(actor.id);
    style(emote,'transform',`translate3d(${actor.x-origin.x}px,${actor.y-size*.9-origin.y}px,0) translate(-50%,-100%)`);
    if(emote.hidden)emote.hidden=false;
   }else if(emote&&!emote.hidden)emote.hidden=true;
  }
  const player=state.actors.find(actor=>actor.id==='mira');
  roomView.setCinematicFrame({focus:state.focus,player,elapsed:state.elapsed,reservedBottom,deltaMs,snapCamera,reducedMotion:reduced});
  const disabled=preview||arrival||state.finished||state.nextPending;
  if(nextButton.disabled!==disabled)nextButton.disabled=disabled;
  if(!preview&&previousPhase==='entry'&&!arrival&&!disabled)nextButton.focus({preventScroll:true});
  const nextLabel=arrival?'Entering…':state.nextPending?'Walking…':'Next ›';if(nextButton.textContent!==nextLabel)nextButton.textContent=nextLabel;
  const rateLabel=`${rate}×`;if(speedButton.textContent!==rateLabel)speedButton.textContent=rateLabel;
  const pressed=String(rate===2),speedLabel=rate===2?'Double speed. Switch to normal speed.':'Normal speed. Switch to double speed.';
  if(speedButton.getAttribute('aria-pressed')!==pressed)speedButton.setAttribute('aria-pressed',pressed);
  if(speedButton.getAttribute('aria-label')!==speedLabel)speedButton.setAttribute('aria-label',speedLabel);
  emit(state);
  if(state.finished&&!preview&&!finishing){finishing=true;queueMicrotask(()=>{if(!disposed)onFinish({state,skipped:false});});}
 }
 function schedule(state=snapshot()){if(!disposed&&!frame&&state.playing&&!state.finished&&!document.hidden)frame=requestAnimationFrame(tick);}
 function tick(now){
  frame=0;if(disposed)return;const delta=last?Math.min(80,Math.max(0,now-last)):16;last=now;
  const transport=entering()?entry:timeline;
  // The following frame starts the story at its exact first pose. Never apply
  // this whole delta to both sides of the doorway/story handoff.
  for(let remaining=delta*rate;remaining>0;remaining-=100)transport.update(Math.min(100,remaining));
  const state=snapshot();paint(state,delta);schedule(state);
 }
 function pause(){entry?.pause();timeline.pause();if(frame)cancelAnimationFrame(frame);frame=0;last=0;paint();return publicState();}
 function play(){if(snapshot().finished){entry?.seek(0);timeline.seek(0);finishing=false;}if(entering())entry.play();timeline.play();last=0;paint();schedule();return publicState();}
 function seek(value){entry?.skip();timeline.seek(value);last=0;paint(snapshot(),16,true);schedule();return publicState();}
 function setRate(value){rate=value===2?2:1;last=0;onRateChange(rate);paint();return publicState();}
 function skip(){if(disposed)return;entry?.skip();timeline.skip();onFinish({state:snapshot(),skipped:true});}
 function destroy(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;for(const remove of removers)remove();for(const emote of emotes.values())emote.remove();fade.remove();dialogue.destroy();map.inert=wasInert;map.style.overflow=wasOverflow;roomView.setCinematicFrame(null);root.classList.remove('cutscene-playing','cutscene-preview');delete root.dataset.cutscenePhase;panel.classList.remove('cutscene-silent');delete panel.dataset.phase;panel.hidden=true;}
 function advance(){if(entering())return;if(!dialogue.state.complete){dialogue.revealAll();paint();return;}timeline.next();last=0;paint();schedule();}
 listen(nextButton,'click',advance);listen(skipButton,'click',skip);
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
 if(tile){entry?.skip();timeline.seek(tile);}if(paused){entry?.pause();timeline.pause();}paint();schedule();
 if(!preview)nextButton.focus({preventScroll:true});
 return Object.freeze({get state(){return publicState();},get safeState(){return entering()?publicState({...timeline.state,phase:'story',entry:entryInfo()}):publicState();},pause,play,seek,setRate,skip,destroy});
}
