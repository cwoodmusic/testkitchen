import {createRoomWalker,DEPOT_ROOM} from './room.mjs';
import {MIRA} from './mira.mjs';

const keyDirections={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
const vectors={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const targetNames={nell:'Talk to Nell',iris:'Talk to Iris',pip:'Talk to Pip','depot-chest':'Open the chest',garden:'Inspect garden door',workshop:'Inspect workshop door',canal:'Inspect canal door'};

/** A reusable room controller; it moves feet and reports interactions, never notes. */
export function createRoomView({scene,map=scene,player,floor,controls,interactButton,prompt,savedPosition=null,room=DEPOT_ROOM,canMove=()=>true,onInteract=()=>{},onStop=()=>{},onReachChange=()=>{}}){
  const names={...targetNames,...Object.fromEntries(room.targets.filter(target=>target.label).map(target=>[target.id,target.label]))};
  player.style.width=`${MIRA.worldSize/room.width*100}%`;
  map.style.width=`${room.width}px`;map.style.height=`${room.height}px`;
  let walker=createRoomWalker({room,savedPosition}),pendingTarget=null,frameId=0,lastTime=0,walkPhase=0,lastPaint='',reachKey='',pulseUntil=0,pulseDirection=null,disposed=false,positionDirty=false;
  let viewportWidth=scene.clientWidth,viewportHeight=scene.clientHeight,camera={scale:1,offsetX:0,offsetY:0,width:viewportWidth,height:viewportHeight},cameraKey='';
  const held=new Set(),pointers=new Map(),removers=[];
  const setText=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
  function listen(element,event,handler,options){element.addEventListener(event,handler,options);removers.push(()=>element.removeEventListener(event,handler,options));}
  function enabled(){return!disposed&&canMove()&&!document.hidden;}
  function snapshot(){return{...walker.state,pendingTarget};}
  function savePosition(){const {x,y,facing}=walker.state;positionDirty=false;onStop({x,y,facing});}
  function followCamera(state){
    const width=Math.max(1,viewportWidth),height=Math.max(1,viewportHeight);
    // Pull back from the old fill-and-crop framing and keep the full room height.
    const scale=Math.min(Math.max(width/room.width,height/room.height)*.8,height/room.height);
    const bound=(value,min,max)=>Math.max(min,Math.min(max,value));
    const offsetX=room.width*scale<=width?(width-room.width*scale)/2:bound(width*.5-state.x*scale,width-room.width*scale,0);
    const offsetY=(height-room.height*scale)/2;
    camera={scale,offsetX,offsetY,width,height};const key=[scale,offsetX,offsetY].join('|');
    if(key!==cameraKey){cameraKey=key;map.style.setProperty('--room-scale',scale);map.style.transform=`translate(${offsetX}px,${offsetY}px) scale(${scale})`;}
  }
  function paint(){
    if(disposed)return;
    const state=walker.state,row=Math.max(0,MIRA.directions.indexOf(state.facing)),col=state.moving?[1,0,2,0][Math.floor(walkPhase/125)%4]:0;
    followCamera(state);
    const signature=[state.x,state.y,row,col].join('|');
    if(signature!==lastPaint){
      lastPaint=signature;const anchor=MIRA.anchors[row][col];
      player.style.left=`${state.x/room.width*100}%`;player.style.top=`${state.y/room.height*100}%`;
      player.style.transform=`translate(${-anchor[0]*100}%,${-anchor[1]*100}%)`;
      player.style.backgroundPosition=`${col*50}% ${row*100/3}%`;player.style.zIndex=String(Math.round(state.y));
      player.dataset.facing=state.facing;player.dataset.frame=String(col);player.dataset.moving=String(state.moving);
    }
    const nearby=walker.nearbyTarget(),nextReach=room.targets.filter(target=>walker.withinReach(target.id)).map(target=>target.id).join('|');
    prompt.hidden=!nearby||!enabled();
    interactButton.disabled=!enabled()||!nearby;
    setText(interactButton,nearby?names[nearby.id]??'Interact':'Interact');
    setText(prompt,!canMove()?'Close the panel to keep exploring.':pendingTarget?`Walking to ${names[pendingTarget]?.replace(/^(Talk to |Open the |Inspect )/,'')??'your destination'}…`:nearby?`${names[nearby.id]??'Interact'} · E or Space`:'Arrows / WASD · E interacts · I opens notes');
    for(const button of controls.querySelectorAll('[data-walk]'))button.disabled=!enabled();
    if(nextReach!==reachKey){
      reachKey=nextReach;
      for(const target of room.targets){const button=map.querySelector(`[data-person="${target.id}"],[data-door="${target.id}"],[data-chest="${target.id}"],[data-inspect="${target.id}"],[data-return="${target.id}"]`);if(button)button.dataset.near=String(walker.withinReach(target.id));}
      onReachChange(snapshot());
    }
  }
  function clearInput(){held.clear();pointers.clear();pulseUntil=0;pulseDirection=null;}
  function stop({persist=true}={}){
    const active=positionDirty||walker.state.moving||pendingTarget!==null||held.size||pointers.size||pulseDirection;
    if(frameId)cancelAnimationFrame(frameId);frameId=0;lastTime=0;pendingTarget=null;clearInput();walker.stop();walkPhase=0;paint();
    if(active&&persist)savePosition();
  }
  function complete(id){pendingTarget=null;walker.stop();clearInput();paint();onInteract(id);if(!disposed)savePosition();}
  function schedule(){if(!frameId&&enabled())frameId=requestAnimationFrame(frame);}
  function frame(now){
    frameId=0;if(!enabled()){stop();return;}
    const elapsed=lastTime?Math.min(50,Math.max(0,now-lastTime)):16;lastTime=now;
    const active=new Set([...held,...pointers.values()]);
    if(pulseDirection&&now<pulseUntil)active.add(pulseDirection);else{pulseDirection=null;pulseUntil=0;}
    let dx=0,dy=0;for(const direction of active){dx+=vectors[direction][0];dy+=vectors[direction][1];}
    const before=walker.state,wasMoving=before.moving;
    if(dx||dy){pendingTarget=null;walker.move(dx,dy,elapsed);}else walker.update(elapsed);
    if(walker.state.x!==before.x||walker.state.y!==before.y||walker.state.facing!==before.facing)positionDirty=true;
    if(walker.state.moving)walkPhase+=elapsed;else walkPhase=0;
    if(pendingTarget&&walker.withinReach(pendingTarget)){const id=pendingTarget;complete(id);}
    else if(pendingTarget&&!walker.state.moving&&!walker.state.destination){pendingTarget=null;savePosition();}
    // Interacting with a threshold can replace this controller synchronously.
    if(disposed)return;
    if(wasMoving&&!walker.state.moving&&positionDirty)savePosition();
    paint();
    if((dx||dy)||walker.state.moving||walker.state.destination||pendingTarget)schedule();
    else{lastTime=0;if(positionDirty)savePosition();}
  }
  function request(id){
    if(!enabled()||!room.targets.some(target=>target.id===id))return false;
    stop({persist:false});
    if(walker.withinReach(id)){complete(id);return true;}
    pendingTarget=id;
    if(!walker.approach(id)){pendingTarget=null;paint();return false;}
    paint();schedule();return true;
  }
  function goTo(point){
    if(!enabled())return false;stop({persist:false});if(!walker.goTo(point))return false;paint();schedule();return true;
  }
  function interact(){if(!enabled())return;const target=walker.nearbyTarget();if(target)request(target.id);else prompt.textContent='Walk closer to a person, a chest, or a door.';}
  function refresh(){if(!enabled()&&(walker.state.moving||pendingTarget))stop();else paint();}
  function reset(){stop({persist:false});walker=createRoomWalker({room});reachKey='';lastPaint='';paint();savePosition();}
  listen(floor,'click',event=>{
    if(event.detail===0){interact();return;}
    const rect=map.getBoundingClientRect();goTo({x:(event.clientX-rect.left)/rect.width*room.width,y:(event.clientY-rect.top)/rect.height*room.height});
  });
  listen(interactButton,'click',interact);
  listen(document,'keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,[contenteditable="true"]')||!enabled())return;
    const key=event.key.toLowerCase(),direction=keyDirections[key];
    if(direction){event.preventDefault();pendingTarget=null;held.add(direction);schedule();}
    else if((key==='e'||key===' ')&&!event.repeat){
      if(key===' '&&event.target.closest('button,a')&&event.target!==floor)return;
      event.preventDefault();interact();
    }
  });
  listen(document,'keyup',event=>{const direction=keyDirections[event.key.toLowerCase()];if(direction){event.preventDefault();held.delete(direction);schedule();}});
  for(const button of controls.querySelectorAll('[data-walk]')){
    listen(button,'pointerdown',event=>{if(event.button!==0||!enabled())return;event.preventDefault();button.setPointerCapture(event.pointerId);pendingTarget=null;pointers.set(event.pointerId,button.dataset.walk);schedule();});
    const release=event=>{if(pointers.delete(event.pointerId))schedule();};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(button,name,release);
    listen(button,'click',event=>{if(event.detail!==0||!enabled())return;pulseDirection=button.dataset.walk;pulseUntil=performance.now()+180;pendingTarget=null;schedule();});
  }
  listen(window,'blur',()=>stop());
  listen(document,'visibilitychange',()=>{if(document.hidden)stop();});
  listen(window,'pagehide',()=>stop());
  const resize=()=>{viewportWidth=scene.clientWidth;viewportHeight=scene.clientHeight;paint();};
  if(globalThis.ResizeObserver){const observer=new ResizeObserver(resize);observer.observe(scene);removers.push(()=>observer.disconnect());}else listen(window,'resize',resize);
  paint();
  return Object.freeze({get state(){return snapshot();},get camera(){return{...camera};},request,goTo,withinReach:id=>walker.withinReach(id),interact,stop,refresh,reset,destroy(){stop();disposed=true;for(const remove of removers)remove();}});
}
