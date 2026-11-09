import {catalog,preparePlacedArt,render,resizeSurface,findStart,movePlayer,toggleGate,follow,PLAYER_SCALE,GAIT_PER_PIXEL} from './runtime.mjs?v=picnic-beach-1';
import {loadProject} from './storage.mjs?v=picnic-beach-1';
import {createUrbanController} from './urban.mjs?v=picnic-beach-1';
import {createUrbanTour} from './urban-tour.mjs?v=picnic-beach-1';
import {createSandFootprints} from './sand-footprints.mjs?v=picnic-beach-1';
import {createAmbientNPCs} from './ambient-npcs.mjs?v=picnic-beach-1';
import {readNightPreference,saveNightPreference} from './lighting-settings.mjs?v=picnic-beach-1';
const canvas=document.getElementById('world'),route=new URLSearchParams(location.search),tour=route.get('map')!=='builder',preview=route.get('urban')==='1';
document.querySelectorAll('body > :not(#world):not(script)').forEach(e=>e.remove());
const header=document.createElement('header'),title=document.createElement('h1'),nav=document.createElement('nav');
header.append(title,nav);document.body.append(header);
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();b.blur();canvas.focus();};nav.append(b);return b;}
button('Town Builder',()=>location.href='builder/');
button(tour?'Play saved town':'Urban district tour',()=>location.href=tour?'?map=builder':'?urban=1');
button('Back to arcade',()=>{if(parent!==window)parent.postMessage({type:'coda-town-close'},location.origin);else location.href='../';});
let night=readNightPreference();const lighting=button(night?'City night':'Daylight',()=>{night=!night;saveNightPreference(night);lighting.textContent=night?'City night':'Daylight';});lighting.id='lightingToggle';
const footer=document.createElement('footer');footer.textContent='WASD / arrows · Walk    Shift · Run    E · Enter / interact    Wheel · Zoom';document.body.append(footer);
let doc,loadError;try{doc=tour?createUrbanTour():await loadProject(new Set(catalog.keys()));if(doc)await preparePlacedArt(doc);}catch(e){doc=null;loadError=e;}
if(!doc){title.textContent=loadError?'Could not load town':'No saved builder town';footer.textContent=loadError?loadError.message:'Open Town Builder, create a map, then choose Play this town.';}else{
 title.textContent=doc.name;
 const character=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});let avatar=character.normalizeProfile({}),facing='down',walking=false,walkPhase=0;
 const player=findStart(doc,catalog),cam={x:player.x,y:player.y,zoom:.8},keys=new Set();
 const urban=createUrbanController({canvas,getProject:()=>doc,getPlayer:()=>player,preview});
 const ambient=createAmbientNPCs({getProject:()=>doc,catalog,getCamera:()=>cam,getViewport:()=>({width:canvas.clientWidth,height:canvas.clientHeight})});
 const footprints=createSandFootprints({getProject:()=>doc});
 const drawPlayer=(c,x,y,state={facing,walking,phase:walkPhase},now=performance.now())=>character.drawPlayer(c,avatar,{x,y,...state},now/1000);
 addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='coda-town-state-result'&&e.data.avatar)avatar=character.normalizeProfile(e.data.avatar);});
 if(parent!==window)parent.postMessage({type:'coda-town-state'},location.origin);
 addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(urban.keydown(e)){keys.clear();return;}if(e.target.closest('button,a'))return;keys.add(e.key.toLowerCase());if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault();if(e.key.toLowerCase()==='e'&&!e.repeat)toggleGate(doc,player);});
 addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
 canvas.onpointerdown=e=>urban.handlePointer(e);
 canvas.onwheel=e=>{e.preventDefault();if(urban.active)urban.zoom(e.deltaY);else cam.zoom=Math.max(.15,Math.min(2,cam.zoom*Math.exp(-e.deltaY*.001)));};
 const touch=document.createElement('div');touch.id='touch';touch.innerHTML='<div class="dpad"></div>';document.body.append(touch);
 for(const [label,k]of [['↑','w'],['←','a'],['↓','s'],['→','d']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label','Walk '+k);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(k);};b.onpointerup=b.onpointercancel=()=>keys.delete(k);touch.firstChild.append(b);}
 const action=document.createElement('button');action.textContent='Interact';action.onclick=()=>{if(!urban.interact())toggleGate(doc,player);};touch.append(action);
 let last=performance.now();function frame(now){
  const dt=Math.min(.04,(now-last)/1000);last=now;const {ctx,width,height}=resizeSurface(canvas);urban.tick();if(!urban.active)ambient.update(dt,now/1000);
  if(!urban.frame(ctx,keys,dt,now,width,height,(c,x,y,state)=>drawPlayer(c,x,y,state,now))){
   if(!urban.blocked){const motion=movePlayer(doc,player,keys,dt,catalog);if(motion.facing)facing=motion.facing;walking=motion.walking;walkPhase=(walkPhase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);}
   footprints.update([{id:'__player__',...player,walking},...ambient.actors],now/1000);follow(cam,player,doc);render(ctx,doc,cam,width,height,{night,time:now/1000,npcs:ambient.actors,drawNPC:ambient.draw,drawFootprints:(c,d,t)=>footprints.draw(c,d,t),player,drawPlayer:(c,x,y)=>drawPlayer(c,x,y,undefined,now)});
  }requestAnimationFrame(frame);
 }requestAnimationFrame(frame);window.townGame={project:doc,player,cam,catalog,urban,ambient,footprints,get night(){return night;}};
}
