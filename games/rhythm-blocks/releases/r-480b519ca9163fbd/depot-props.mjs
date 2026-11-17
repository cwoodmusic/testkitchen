/** Temporary, caption-clock illustrations inside the Parcel Depot's existing props. */
import {getDialogueStageCue} from './dialogue-reactions.mjs';

export const DEPOT_COURIER=Object.freeze({image:'assets/depot-courier.webp',cellSize:512,columns:3,rows:2,worldSize:76,feet:Object.freeze([274.97,263.06,236.91,275,257.97,242.13].map(x=>Object.freeze([x/512,405/512])))});
export const DEPOT_ROOST_CLEAN_IMAGE='assets/depot-roost-clean.webp';
export const DEPOT_CUE_DURATION_MS=4800;
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));

/** Finite illustrations share the speech clock, so pause, reveal and seek agree. */
export function getDepotPropState(state,{reducedMotion=false}={}){
 const cue=getDialogueStageCue(state);if(!cue)return null;
 const t=cue.elapsedMs,withBird=cue.cue==='courier-signal';
 const frame=withBird?(reducedMotion?(t<2300?2:0):t<180?1:t<800?2:t<1100?3:t<1800?4:t<2300?5:0):0;
 const birdPhase=!withBird?'idle':t<180?'alert':t<800?'turn':t<1100?'ruffle':t<1800?'listen':t<2300?'blink':'settled';
 const signal=t-(withBird?1000:0),phase=signal<0?'listening':signal<450?'scan':signal<1050?'received':signal<2700?'waiting':'no-reply';
 const pulse=clamp((signal-450)/600),received=signal>=450&&signal<1050;
 const flash=received?Math.sin(pulse*Math.PI)*.65:0;
 return{cue:cue.cue,elapsedMs:t,active:t<DEPOT_CUE_DURATION_MS,bird:{visible:withBird,frame,phase:birdPhase},radar:{phase,angle:reducedMotion?0:clamp(signal/900)*260-130,flash,pulseScale:reducedMotion?.7:.98-pulse*.82,pulseOpacity:received?(reducedMotion?.55:(1-pulse)*.9):0,sweepOpacity:reducedMotion?0:signal>=0&&signal<1050?.32:0,received:signal>=450}};
}

let serial=0;
/** Original artwork and furniture geometry remain unchanged, including on cleanup. */
export function createDepotProps({map,scene,reducedMotion=false,onReady=()=>{}}={}){
 const supported=scene?.id==='depot'&&scene.image==='assets/parcel-depot.webp';
 if(!supported)return{paint(){},needsAnimation(){return false;},destroy(){}};
 const document=map.ownerDocument,prefix=`depot-props-${++serial}`;
 let disposed=false,ready=false,lastState=null;
 const styles=new WeakMap(),set=(node,key,value)=>{let previous=styles.get(node);if(!previous){previous=new Map();styles.set(node,previous);}if(previous.get(key)!==value){node.style[key]=value;previous.set(key,value);}};
 const data=(node,key,value)=>{value=String(value);if(node.dataset[key]!==value)node.dataset[key]=value;};
 const el=(className)=>{const node=document.createElement('div');node.className=className;node.setAttribute('aria-hidden','true');return node;};
 const bird=el('depot-courier');bird.hidden=true;
 const matte=el('depot-courier-matte'),sprite=el('depot-courier-sprite');
 matte.style.backgroundImage=`url(${JSON.stringify(DEPOT_ROOST_CLEAN_IMAGE)})`;bird.append(matte,sprite);
 const screen=el('depot-radar');screen.hidden=true;
 screen.innerHTML=`<svg viewBox="0 0 120 120" aria-hidden="true"><defs><clipPath id="${prefix}-screen"><circle cx="60" cy="60" r="53"/></clipPath></defs><g clip-path="url(#${prefix}-screen)" fill="none" stroke="#94e8a5" stroke-opacity=".08"><circle cx="60" cy="60" r="18"/><circle cx="60" cy="60" r="36"/><path d="M7 60h106M60 7v106"/></g></svg>`;
 // HTML compositor layers carry transforms; their SVG geometry stays static.
 // Transforming SVG circles/paths directly forced SVG layout on every frame.
 const sweep=el('depot-radar-sweep'),flash=el('depot-radar-flash'),pulse=el('depot-radar-pulse'),center=el('depot-radar-center');
 sweep.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"><path fill="#b4ffd0" d="M60 60L108 38A53 53 0 0 1 111 75z"/></svg>';
 pulse.innerHTML='<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="47" fill="none" stroke="#d9ffd6" stroke-width="3"/></svg>';
 screen.append(sweep,flash,pulse,center);
 sprite.style.backgroundImage=`url(${JSON.stringify(DEPOT_COURIER.image)})`;
 map.append(bird,screen);
 const preloads=[];
 function loaded(){if(disposed||ready||preloads.length!==2||!preloads.every(image=>image.complete&&image.naturalWidth))return;ready=true;if(lastState)paint(lastState);onReady();}
 for(const source of [DEPOT_COURIER.image,DEPOT_ROOST_CLEAN_IMAGE]){const image=new Image();preloads.push(image);image.onload=loaded;image.src=source;}
 // Cached images still notify after construction, never inside a caller's const initializer.
 queueMicrotask(loaded);
 function paint(state){
  if(disposed)return;lastState=state;const pose=getDepotPropState(state,{reducedMotion});
  if(!pose){bird.hidden=true;screen.hidden=true;return;}
  for(const node of [bird,screen]){data(node,'stageCue',pose.cue);data(node,'elapsed',Math.round(pose.elapsedMs));data(node,'active',pose.active);}
  bird.hidden=!ready||!pose.bird.visible;data(bird,'phase',pose.bird.phase);data(bird,'frame',pose.bird.frame);
  const frame=pose.bird.frame,anchor=DEPOT_COURIER.feet[frame];
  set(sprite,'backgroundPosition',`${frame%3*50}% ${Math.floor(frame/3)*100}%`);
  set(sprite,'transform',`translate(${-anchor[0]*100}%,${-anchor[1]*100}%)`);
  data(sprite,'anchorX',anchor[0]);data(sprite,'anchorY',anchor[1]);
  screen.hidden=false;data(screen,'phase',pose.radar.phase);data(screen,'received',pose.radar.received);
  set(sweep,'transform',`rotate(${pose.radar.angle.toFixed(2)}deg)`);set(sweep,'opacity',String(pose.radar.sweepOpacity));
  set(flash,'opacity',pose.radar.flash.toFixed(3));set(pulse,'opacity',pose.radar.pulseOpacity.toFixed(3));set(pulse,'transform',`scale(${pose.radar.pulseScale.toFixed(3)})`);
  set(center,'opacity',pose.radar.received?(pose.radar.phase==='no-reply'?'.25':'.8'):'.15');
 }
 return{paint,needsAnimation(state){return !disposed&&!!getDepotPropState(state,{reducedMotion})?.active;},destroy(){if(disposed)return;disposed=true;for(const preload of preloads){preload.onload=null;preload.onerror=null;}bird.remove();screen.remove();lastState=null;}};
}
