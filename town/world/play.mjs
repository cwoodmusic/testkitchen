import {catalog,preparePlacedArt,render,resizeSurface,findStart,movePlayer,toggleGate,follow,PLAYER_SCALE,GAIT_PER_PIXEL} from './runtime.mjs?v=town-flight-1';
import {loadProject} from './storage.mjs?v=town-flight-1';
import {createUrbanController} from './urban.mjs?v=town-flight-1';
import {createConcertAudio} from './concert-audio.mjs?v=opera-parallax-1';
import {mountConcertControls} from './concert-controls.mjs?v=opera-parallax-1';
import {CONCERT_PROGRAMME} from './concert-programme.mjs?v=opera-players-1';
import {createUrbanTour} from './urban-tour.mjs?v=town-flight-1';
import {createSandFootprints} from './sand-footprints.mjs?v=town-flight-1';
import {createAmbientNPCs} from './ambient-npcs.mjs?v=town-flight-1';
import {createPlayerCollisionIndex} from './player-collision-index.mjs?v=town-flight-1';
import {readNightPreference,saveNightPreference} from './lighting-settings.mjs?v=opera-parallax-1';
const canvas=document.getElementById('world'),route=new URLSearchParams(location.search),tour=route.get('map')!=='builder',preview=route.get('urban')==='1';
document.querySelectorAll('body > :not(#world):not(script)').forEach(e=>e.remove());
const header=document.createElement('header'),title=document.createElement('h1'),nav=document.createElement('nav');
header.append(title,nav);document.body.append(header);
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();b.blur();canvas.focus();};nav.append(b);return b;}
button('Town Builder',()=>location.href='builder/?v=town-flight-1');
button(tour?'Play saved town':'Urban district tour',()=>location.href=tour?'?map=builder&v=town-flight-1':'?urban=1&v=town-flight-1');
button('Back to arcade',()=>{if(parent!==window)parent.postMessage({type:'coda-town-close'},location.origin);else location.href='../?v=opera-parallax-1';});
let night=readNightPreference();const lighting=button(night?'City night':'Daylight',()=>{night=!night;saveNightPreference(night);lighting.textContent=night?'City night':'Daylight';});lighting.id='lightingToggle';
const footer=document.createElement('footer');footer.textContent='WASD / arrows · Walk    Shift · Run    Bedroom / bath doors automatic    E · Enter / interact    Wheel · Zoom';document.body.append(footer);
let doc,loadError;try{doc=tour?createUrbanTour():await loadProject(new Set(catalog.keys()));if(doc)await preparePlacedArt(doc);}catch(e){doc=null;loadError=e;}
if(!doc){title.textContent=loadError?'Could not load town':'No saved builder town';footer.textContent=loadError?loadError.message:'Open Town Builder, create a map, then choose Play this town.';}else{
 title.textContent=doc.name;
 const character=window.createCodaCharacterRenderer({worldScale:PLAYER_SCALE});let avatar=character.normalizeProfile({}),facing='down',walking=false,walkPhase=0;
 const player=findStart(doc,catalog),cam={x:player.x,y:player.y,zoom:.8},keys=new Set();
 let cityRevision=0;
 const playerCollision=createPlayerCollisionIndex({getProject:()=>doc,catalog,getRevision:()=>cityRevision});
 const urban=createUrbanController({canvas,getProject:()=>doc,getPlayer:()=>player,getFacing:()=>facing,setFacing:value=>{facing=value;},onConversation:(id,active,viewer)=>ambient.setConversation(id,active,viewer),getResidents:scene=>scene?ambient.interiorActors(scene):ambient.actors,getConcert:()=>concert,preview});
 const concert=createConcertAudio({programme:CONCERT_PROGRAMME,changeover:true,getProject:()=>doc,getScene:()=>urban.scene});
 mountConcertControls(concert,{canvas,onProgramme:()=>urban.showProgramme()});
 const ambient=createAmbientNPCs({getConcertSeat:()=>urban.seated?.id||null,getInteriorPlayer:()=>urban.scene?.kind==='concert'?urban.player:null,getProject:()=>doc,catalog,getRevision:()=>cityRevision,getPlayer:()=>urban.active?null:player});
 const footprints=createSandFootprints({getProject:()=>doc});
 const drawPlayer=(c,x,y,state={facing,walking,phase:walkPhase},now=performance.now())=>character.drawPlayer(c,avatar,{x,y,...state,...(urban.activities.sailing?{seated:true,walking:false,facing:urban.activities.boatFacing}:{})},now/1000);
 addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='coda-town-state-result'&&e.data.avatar)avatar=character.normalizeProfile(e.data.avatar);});
 if(parent!==window)parent.postMessage({type:'coda-town-state'},location.origin);
 addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(urban.keydown(e)){keys.clear();return;}if(e.target.closest('button,a'))return;keys.add(e.key.toLowerCase());if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault();if(e.key.toLowerCase()==='e'&&!e.repeat&&toggleGate(doc,player))cityRevision++;});
 addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
 canvas.onpointerdown=e=>urban.handlePointer(e);
 canvas.onwheel=e=>{e.preventDefault();if(urban.active)urban.zoom(e.deltaY);else cam.zoom=Math.max(.15,Math.min(2,cam.zoom*Math.exp(-e.deltaY*.001)));};
 const touch=document.createElement('div');touch.id='touch';touch.innerHTML='<div class="dpad"></div>';document.body.append(touch);
 for(const [label,k]of [['↑','w'],['←','a'],['↓','s'],['→','d']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label','Walk '+k);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(k);};b.onpointerup=b.onpointercancel=()=>keys.delete(k);touch.firstChild.append(b);}
 const action=document.createElement('button');action.textContent='Interact';action.onclick=()=>{if(!urban.interact()&&toggleGate(doc,player))cityRevision++;};touch.append(action);
 let last=performance.now();function frame(now){
  const dt=Math.min(.04,(now-last)/1000);last=now;const {ctx,width,height}=resizeSurface(canvas);if(urban.activities.fullscreen){urban.activities.tick(keys,dt);requestAnimationFrame(frame);return;}concert.updateContext(urban.scene);urban.tick();ambient.update(dt,now/1000);
  if(!urban.frame(ctx,keys,dt,now,width,height,(c,x,y,state)=>drawPlayer(c,x,y,state,now))){
   if(!urban.blocked){const motion=movePlayer(playerCollision.view(player),player,keys,dt,catalog);if(motion.facing)facing=motion.facing;walking=motion.walking;walkPhase=(walkPhase+motion.surfaceDistance*GAIT_PER_PIXEL)%(Math.PI*2);}
   footprints.update([{id:'__player__',...player,walking},...ambient.actors],now/1000);follow(cam,player,doc);render(ctx,doc,cam,width,height,{terrainRevision:cityRevision,hiddenBoat:urban.activities.hiddenBoat,night,time:now/1000,npcs:ambient.actors,drawNPC:ambient.draw,drawFootprints:(c,d,t)=>footprints.draw(c,d,t),player,drawPlayer:(c,x,y)=>drawPlayer(c,x,y,undefined,now)});urban.drawOutdoor(ctx,cam,width,height,now/1000);
  }requestAnimationFrame(frame);
 }requestAnimationFrame(frame);window.townGame={project:doc,player,cam,catalog,urban,ambient,footprints,concert,playerCollision,get night(){return night;}};
}
