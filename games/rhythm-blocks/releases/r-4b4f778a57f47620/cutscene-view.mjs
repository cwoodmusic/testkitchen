import {createRoomCutscene} from './cutscene.mjs';
import {isWalkable,findPath} from './room.mjs';

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
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
  return {...actor,feet:{x:at.x,y:at.y}};
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
export function createCutsceneView({root,map,panel,roomView,scene,project,beats,playerPosition,preview=false,paused=false,tile=0,onFinish=()=>{}}){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const timeline=createRoomCutscene({scene,beats,playerPosition,reducedMotion:reduced});
 let disposed=false,frame=0,last=0,lastCaption='',lastEvent='',finishing=false;
 const actorElements=new Map(scene.actors.map(actor=>[actor.id,map.querySelector('[data-actor="'+actor.id+'"]')]));
 const emotes=new Map(),removers=[],wasInert=map.inert;map.inert=true;
 const speaker=panel.querySelector('#cutscene-speaker'),line=panel.querySelector('#cutscene-line'),counter=panel.querySelector('#cutscene-counter');
 const nextButton=panel.querySelector('#cutscene-next'),skipButton=panel.querySelector('#cutscene-skip');
 function listen(target,name,fn,options){target.addEventListener(name,fn,options);removers.push(()=>target.removeEventListener(name,fn,options));}
 function emit(state){
  const key=[Math.floor(state.currentTile??0),state.index,state.playing,state.finished].join('|');if(key===lastEvent)return;lastEvent=key;
  document.dispatchEvent(new CustomEvent('quietbellcutscene',{detail:{...state,preview,roomId:scene.id}}));
 }
 function paint(){
  if(disposed)return;
  const state=timeline.state,beat=state.beat,id=beat?.speaker??beat?.actor;
  const person=project.content[scene.id].people.find(person=>person.id===id);
  const caption=[id,beat?.id,state.index,beat?.text].join('|');
  if(caption!==lastCaption){lastCaption=caption;speaker.textContent=id==='mira'?'Mira':person?.name??(id?String(id):'The party');line.textContent=beat?.text??(state.finished?'Scene finished.':state.actors.some(actor=>actor.moving)?'The party looks around…':'');}
  counter.textContent=preview?'Timeline preview':scene.title;
  for(const actor of state.actors){
   const element=actorElements.get(actor.id),definition=scene.actors.find(item=>item.id===actor.id);
   if(element&&definition){
    const sprite=project.cast[definition.character],bob=actor.moving&&!reduced?Math.sin((state.elapsed??0)/75)*1.4:0;
    const lean=!actor.moving&&['search','examine'].includes(actor.action)&&!reduced?(actor.facing==='left'?-3:3):0;
    element.style.left=`${actor.x/scene.geometry.width*100}%`;element.style.top=`${actor.y/scene.geometry.height*100}%`;
    element.style.transform=`translate(${-sprite.anchor[0]*100}%,${-sprite.anchor[1]*100}%) translateY(${-Math.abs(bob)}px) rotate(${lean}deg)`;
    element.style.transformOrigin='50% 92%';element.style.zIndex=String(Math.round(actor.y)+1);
    element.dataset.moving=String(actor.moving);element.dataset.action=actor.action??'';element.dataset.facing=actor.facing??'down';element.dataset.emote=actor.emote??'';
   }
   const kind=actor.emote??(actor.id===id?beat?.emote:null),icon=EMOTES[kind];
   let emote=emotes.get(actor.id);
   if(icon){
    if(!emote){emote=document.createElement('div');emote.className='cutscene-emote';emote.dataset.character=actor.id;emote.setAttribute('role','img');map.append(emote);emotes.set(actor.id,emote);}
    if(emote.dataset.cutsceneEmote!==kind){emote.dataset.cutsceneEmote=kind;emote.setAttribute('aria-label',icon.label);emote.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path fill="${icon.color}" d="${icon.path}"/></svg>`;}
    const size=definition?.worldSize??project.player.worldSize;
    emote.style.left=`${actor.x/scene.geometry.width*100}%`;emote.style.top=`${(actor.y-size*.9)/scene.geometry.height*100}%`;emote.hidden=false;
   }else if(emote)emote.hidden=true;
  }
  const player=state.actors.find(actor=>actor.id==='mira');
  roomView.setCinematicFrame({focus:state.focus,player,elapsed:state.elapsed,reservedBottom:preview?0:panel.getBoundingClientRect().height+20});
  nextButton.disabled=preview||state.finished;skipButton.textContent=preview?'Stop preview':'Skip';
  emit(state);
  if(state.finished&&!preview&&!finishing){finishing=true;queueMicrotask(()=>{if(!disposed)onFinish({state,skipped:false});});}
 }
 function schedule(){if(!disposed&&!frame&&timeline.state.playing&&!timeline.state.finished&&!document.hidden)frame=requestAnimationFrame(tick);}
 function tick(now){frame=0;if(disposed)return;const delta=last?Math.min(80,Math.max(0,now-last)):16;last=now;timeline.update(delta);paint();schedule();}
 function pause(){timeline.pause();if(frame)cancelAnimationFrame(frame);frame=0;last=0;paint();return timeline.state;}
 function play(){timeline.play();last=0;paint();schedule();return timeline.state;}
 function seek(value){timeline.seek(value);last=0;paint();schedule();return timeline.state;}
 function skip(){if(disposed)return;const state=timeline.state;timeline.skip();onFinish({state:{...state,playing:false},skipped:true});}
 function destroy(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;for(const remove of removers)remove();for(const emote of emotes.values())emote.remove();map.inert=wasInert;roomView.setCinematicFrame(null);root.classList.remove('cutscene-playing','cutscene-preview');panel.hidden=true;}
 listen(nextButton,'click',()=>{timeline.next();last=0;paint();schedule();});listen(skipButton,'click',skip);
 listen(document,'keydown',event=>{
  if(preview||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,[contenteditable="true"]'))return;
  if(['Enter',' '].includes(event.key)&&event.target.closest('button'))return;
  if(['Escape','Enter',' ','e','E'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.repeat)return;if(event.key==='Escape')skip();else{timeline.next();last=0;paint();schedule();}}
 });
 let resumeAfterHidden=false;
 listen(document,'visibilitychange',()=>{if(document.hidden){resumeAfterHidden=resumeAfterHidden||timeline.state.playing;pause();}else if(resumeAfterHidden){resumeAfterHidden=false;play();}});
 listen(window,'blur',()=>{resumeAfterHidden=resumeAfterHidden||timeline.state.playing;pause();});listen(window,'focus',()=>{if(resumeAfterHidden&&!document.hidden){resumeAfterHidden=false;play();}});
 root.classList.add('cutscene-playing');root.classList.toggle('cutscene-preview',preview);panel.hidden=false;
 if(tile)timeline.seek(tile);if(paused)timeline.pause();paint();schedule();
 if(!preview)nextButton.focus({preventScroll:true});
 return Object.freeze({get state(){return freeze({...timeline.state,preview,roomId:scene.id});},pause,play,seek,skip,destroy});
}
