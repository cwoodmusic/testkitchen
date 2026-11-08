import {catalog,preparePlacedArt,render,resizeSurface,findStart,movePlayer,toggleGate,follow} from './runtime.mjs?v=home-open-1';
import {loadProject} from './storage.mjs?v=home-open-1';
const canvas=document.getElementById('world');
// Reuse the town route and arcade session bridge; replace the editor chrome
// with gameplay controls while rendering the very same authored document.
document.querySelectorAll('body > :not(#world):not(script)').forEach(e=>e.remove());
const header=document.createElement('header'),title=document.createElement('h1'),nav=document.createElement('nav');
header.append(title,nav);document.body.append(header);
function button(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;nav.append(b);return b;}
button('Edit town',()=>location.href='builder/');
button('Original town',()=>location.href='./');
button('Back to arcade',()=>{if(parent!==window)parent.postMessage({type:'coda-town-close'},location.origin);else location.href='../';});
const footer=document.createElement('footer');footer.textContent='WASD / arrows · Walk    Shift · Run    E · Open gate    Wheel · Zoom';document.body.append(footer);
let doc,loadError;try{doc=await loadProject(new Set(catalog.keys()));if(doc)await preparePlacedArt(doc);}catch(e){doc=null;loadError=e;}
if(!doc){title.textContent=loadError?'Could not load town':'No saved builder town';footer.textContent=loadError?loadError.message:'Open Town Builder, create a map, then choose Play this town.';}else{
 title.textContent=doc.name;
 const character=window.createCodaCharacterRenderer({});let avatar=character.normalizeProfile({}),facing='down',walking=false,player;
 try{player=findStart(doc,catalog);}catch(e){footer.textContent=e.message;throw e;}
 const cam={x:player.x,y:player.y,zoom:.8},keys=new Set();
 addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.type==='coda-town-state-result'&&e.data.avatar)avatar=character.normalizeProfile(e.data.avatar);});
 if(parent!==window)parent.postMessage({type:'coda-town-state'},location.origin);
 addEventListener('keydown',e=>{if(e.target.closest('button,a'))return;keys.add(e.key.toLowerCase());if(e.key.startsWith('Arrow')||e.key===' ')e.preventDefault();if(e.key.toLowerCase()==='e'&&!e.repeat)toggleGate(doc,player);});
 addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
 canvas.onwheel=e=>{e.preventDefault();cam.zoom=Math.max(.15,Math.min(2,cam.zoom*Math.exp(-e.deltaY*.001)));};
 // Touch controls feed the same movement code as keyboard and editor walk test.
 const touch=document.createElement('div');touch.id='touch';touch.innerHTML='<div class="dpad"></div>';document.body.append(touch);
 for(const [label,k]of [['↑','w'],['←','a'],['↓','s'],['→','d']]){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label','Walk '+k);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(k);};b.onpointerup=b.onpointercancel=()=>keys.delete(k);touch.firstChild.append(b);}
 const action=document.createElement('button');action.textContent='Gate';action.onclick=()=>toggleGate(doc,player);touch.append(action);
 let last=performance.now();function frame(now){const dt=Math.min(.04,(now-last)/1000);last=now;const motion=movePlayer(doc,player,keys,dt,catalog);if(motion.facing)facing=motion.facing;walking=motion.walking;follow(cam,player,doc);const {ctx,width,height}=resizeSurface(canvas);render(ctx,doc,cam,width,height,{player,drawPlayer:(c,x,y)=>character.drawPlayer(c,avatar,{x,y,facing,walking,phase:now*.008},now/1000)});requestAnimationFrame(frame);}requestAnimationFrame(frame);
 window.townGame={project:doc,player,cam,catalog};
}
