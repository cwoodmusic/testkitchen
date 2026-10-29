/* The dance game borrows world actors and the camera for one DJ-led set. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDanceFloorWorld=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const BOUNDS=Object.freeze({x:100,y:450,width:640,height:440});
 function fitCamera(viewport,bounds=BOUNDS){
  const zoom=Math.min(viewport.width/bounds.width,viewport.height/bounds.height)*.92;
  return {zoom,targetZoom:zoom,x:bounds.x+bounds.width/2-(viewport.left+viewport.width/2)/zoom,y:bounds.y+bounds.height/2-(viewport.top+viewport.height/2)/zoom};
 }
 function create(api={}){
  const win=api.window||window,stage=win.CodaDanceFloorStage.create({player:api.player,npcs:api.npcs,isWalkable:api.isWalkable,reducedMotion:api.reducedMotion});
  let active=false,previous=null,restoring=false,run=null;
  function cleanup(reason='close'){
   if(!active||restoring)return;restoring=true;active=false;run=null;stage.close();
   if(previous){api.setCamera(previous.camera);api.setFacing?.(previous.facing);if(api.canPlay?.()!==false&&!win.document.hidden&&!['profile','hidden','paused','profile-changed','destroyed'].includes(reason))api.restoreMusic?.(previous.music);}
   previous=null;api.clearInput?.();api.onChange?.();restoring=false;
  }
  function anchor(){
   const dj=api.getDJ(),cam=api.getCamera(),box=api.canvas.getBoundingClientRect();
   return {x:box.left+(dj.x-cam.x)*cam.zoom*box.width/api.width,y:box.top+(dj.y-55-cam.y)*cam.zoom*box.height/api.height};
  }
  const game=win.CodaDanceRhythmGame.create({canPlay:()=>active&&api.canPlay?.()!==false,getAnchor:anchor,
   onStart(event){
    run=null;
    if(stage.getState().active)stage.close();
    if(!stage.start()){api.onError?.('The dance floor is blocked. Leave some clear space in the middle.');return false;}
    run={id:event.runId,owner:api.getIdentity?.()};
    api.clearInput?.();api.onChange?.();return true;
   },
   onCue:event=>stage.cue(event.direction),
   onStep:event=>stage.step(event.direction,{actorId:'player'}),
   onMiss:event=>stage.miss(event.direction),
   onFinish:event=>{
    stage.cue('down');
    if(!active||api.canPlay?.()===false||!run||event.runId!==run.id||api.getIdentity?.()!==run.owner)return {ok:false,error:'Your player changed before the dance finished.'};
    run=null;return api.onFinish?.(event);
   },
   onClose:({reason}={})=>cleanup(reason)
  });
  return {
   open(){
    if(active||api.canPlay?.()===false)return false;
    previous={camera:{...api.getCamera()},facing:api.getFacing?.()||'down',music:api.pauseMusic?.()};
    api.closeConversation?.();api.closePanel?.();api.clearInput?.();active=true;
    if(game.open()===false){cleanup();return false;}api.onChange?.();return true;
   },
   isOpen:()=>active,
   update(dt){if(!active)return;if(api.canPlay?.()===false){game.close('profile');cleanup('profile');return;}stage.update(dt);},
   updateCamera(viewport){
    if(!active||!stage.getState().active)return false;
    const panel=game.getBounds?.(),image=api.canvas?.getBoundingClientRect(),floor=win.CodaDanceFloorStage.FLOOR_BOUNDS;
    if(panel&&image?.height>0&&floor){
     const top=Math.max(viewport.top,(panel.bottom+8-image.top)*api.height/image.height),height=viewport.top+viewport.height-top;
     if(height>0){
      // Include room for heads and labels above the dance tiles, without
      // putting the directional pad over the dancers on shorter screens.
      const bounds={x:floor.x-20,y:floor.y-70,width:floor.width+40,height:floor.height+85};
      api.setCamera(fitCamera({...viewport,top,height},bounds));return true;
     }
    }
    api.setCamera(fitCamera(viewport));return true;
   },
   pose:id=>active?stage.pose(id):null,
   close(reason='close'){game.close(reason);cleanup(reason);},
   getState:()=>({active,game:game.getState(),stage:stage.getState(),bounds:{...BOUNDS}}),
   destroy(){game.destroy();cleanup();stage.destroy();}
  };
 }
 return Object.freeze({BOUNDS,fitCamera,create});
});
