/* Continuous original-sprite motion and the compatible legacy frame selector. */
(function(){
  'use strict';
  const DIRECTIONS=Object.freeze(['down','left','up','right']);
  const CLIPS=Object.freeze({
    idle:Object.freeze({offset:0,frames:2,fps:2}),walk:Object.freeze({offset:2,frames:6,fps:8}),
    wave:Object.freeze({offset:8,frames:4,fps:8}),dance:Object.freeze({offset:12,frames:6,fps:8}),
    interact:Object.freeze({offset:18,frames:4,fps:6}),talk:Object.freeze({offset:22,frames:4,fps:6}),
    sit:Object.freeze({offset:26,frames:2,fps:2})
  });
  const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
  const wrap=(value,size)=>((value%size)+size)%size;
  function sample(raw={},time=0,reducedMotion=false){
    const motion=raw&&typeof raw==='object'?raw:{},quiet=!!reducedMotion;
    const t=finite(time),actionTime=finite(motion.emoteTime,t);
    let direction=DIRECTIONS.includes(motion.facing)?motion.facing:'down';
    const walking=motion.walking===true,phase=finite(motion.phase),emote=typeof motion.emote==='string'?motion.emote:'';
    let clip='idle',frame=0;
    if(!quiet){
      if(walking){clip='walk';frame=Math.floor(wrap(phase,Math.PI*2)/(Math.PI*2)*CLIPS.walk.frames);}
      else if(emote==='spin'){
        direction=DIRECTIONS[wrap(DIRECTIONS.indexOf(direction)+Math.floor(actionTime*6),4)];
        frame=Math.floor(wrap(actionTime*4,2));
      }else{
        clip={wave:'wave',dance:'dance',robot:'dance',disco:'wave',talk:'talk',playing:'interact',interact:'interact',sit:'sit'}[emote]||'idle';
        const definition=CLIPS[clip],clock=clip==='idle'?t+finite(motion.seed)*.173:actionTime;
        if(emote==='robot')frame=[0,2,4,2][Math.floor(wrap(clock*4,4))];
        else if(emote==='disco')frame=[2,3,2,1][Math.floor(wrap(clock*3,4))];
        else frame=Math.floor(wrap(clock*definition.fps,definition.frames));
      }
    }
    const directionIndex=DIRECTIONS.indexOf(direction),index=directionIndex*28+CLIPS[clip].offset+frame;
    return {direction,facing:direction,directionIndex,clip,frame,index,walking,quiet,phase,actionTime};
  }

  // These joints describe the complete neutral original sprite in its 80×96
  // cell. A limb includes its sleeve, outline and shoe rather than a moving
  // rectangle that can cut through a hand or repaint part of the torso.
  const RIGS={
    down:{direction:'down',neck:68,hipY:79,split:40,nearArm:1,nearLeg:1,handArm:1,mirrored:false,
      arms:[
        {pivot:[30,68],polygon:[[28,65],[32,66],[33,70],[32,77],[23,78],[21,76],[21,70],[25,66]]},
        {pivot:[49,68],polygon:[[47,66],[51,65],[55,68],[57,73],[55,78],[47,78],[46,73]]}
      ],legs:[{pivot:[35,79]},{pivot:[45,79]}]},
    left:{direction:'left',neck:65,hipY:77,split:40,nearArm:1,nearLeg:1,handArm:0,mirrored:false,
      arms:[
        {pivot:[29,67],polygon:[[26,64],[32,66],[33,71],[31,77],[22,77],[20,73],[20,68]]},
        {pivot:[48,67],polygon:[[46,65],[51,66],[55,69],[55,76],[47,77],[45,72]]}
      ],legs:[{pivot:[35,77]},{pivot:[44,77]}]},
    up:{direction:'up',neck:68,hipY:80,split:40,nearArm:0,nearLeg:0,handArm:0,mirrored:false,
      arms:[
        {pivot:[29,70],polygon:[[27,67],[32,69],[33,74],[31,80],[22,80],[20,76],[22,70]]},
        {pivot:[50,70],polygon:[[48,67],[53,68],[57,73],[56,80],[48,80],[46,74]]}
      ],legs:[{pivot:[35,80]},{pivot:[45,80]}]}
  };
  const mirrorPoint=([x,y])=>[80-x,y];
  RIGS.right={...RIGS.left,direction:'right',mirrored:true,
    arms:RIGS.left.arms.map(part=>({pivot:mirrorPoint(part.pivot),polygon:part.polygon.map(mirrorPoint)})),
    legs:RIGS.left.legs.map(part=>({pivot:mirrorPoint(part.pivot)}))};
  function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
  freeze(RIGS);
  function rigDefinition(direction){return RIGS[DIRECTIONS.includes(direction)?direction:'down'];}

  function rigPose(raw={},time=0,reducedMotion=false){
    const motion=raw&&typeof raw==='object'?raw:{},sampled=sample(motion,time,reducedMotion);
    const part=()=>({angle:0,x:0,y:0,scaleY:1});
    const pose={active:false,clip:sampled.clip,rootY:0,bodyAngle:0,arms:[part(),part()],legs:[part(),part()]};
    if(reducedMotion)return pose;
    const direction=sampled.direction,side=direction==='left'||direction==='right';
    const suppliedRig=motion.rig&&Array.isArray(motion.rig.arms)&&motion.rig.arms.length===2?motion.rig:null;
    const definition=suppliedRig||rigDefinition(direction==='right'?'left':direction);
    const emote=typeof motion.emote==='string'?motion.emote:'';
    const t=Math.max(0,finite(motion.emoteTime,finite(time)));
    // Ease gestures into the neutral source pose instead of replacing the
    // entire body with a different drawing on the first emote frame.
    const amount=Math.max(0,Math.min(1,t/.3)),ease=amount*amount*(3-2*amount);
    const armSign=index=>definition.arms[index].pivot[0]<40?1:-1;
    if(motion.walking===true){
      pose.active=true;
      const stride=Math.sin(finite(motion.phase));
      pose.rootY=-.35*stride*stride;
      for(let index=0;index<2;index++){
        const swing=index===0?stride:-stride,lift=Math.max(0,swing);
        pose.arms[index].angle=-.13*swing;
        pose.legs[index].angle=(side?.14:.025)*swing;
        pose.legs[index].y=-(side?.6:.7)*lift;
        pose.legs[index].scaleY=side?1:1-.07*lift;
      }
    }else if(emote==='wave'){
      pose.active=true;
      const arm=definition.nearArm;
      pose.arms[arm].angle=armSign(arm)*(1.8+.18*Math.sin(t*10))*ease;
      pose.arms[1-arm].angle=.025*Math.sin(t*5)*ease;
    }else if(['dance','robot','disco'].includes(emote)){
      pose.active=true;
      const beat=Math.sin(t*6),sway=Math.sin(t*3),robot=emote==='robot';
      const pulse=robot?Math.pow(Math.sin(t*4),3):sway;
      pose.rootY=-.25*beat*beat*ease;
      pose.bodyAngle=(robot?.035:.045)*pulse*ease;
      for(let index=0;index<2;index++){
        const swing=index===0?beat:-beat;
        pose.arms[index].angle=armSign(index)*((robot?.32:.23)+.13*pulse*(index===0?1:-1))*ease;
        pose.legs[index].angle=(side?.11:.025)*swing*ease;
        pose.legs[index].y=-.5*Math.max(0,swing)*ease;
        pose.legs[index].scaleY=1-.035*Math.max(0,swing)*ease;
      }
      if(emote==='disco'){
        const arm=definition.nearArm;
        pose.arms[arm].angle=armSign(arm)*(1.55+.08*beat)*ease;
      }
    }else if(['talk','playing','interact'].includes(emote)){
      pose.active=true;
      const arm=definition.handArm,playing=emote!=='talk';
      pose.arms[arm].angle=armSign(arm)*(playing?.2+.045*Math.sin(t*6):.09*Math.sin(t*4))*ease;
      pose.arms[1-arm].angle=.025*Math.sin(t*4+.7)*ease;
    }else if(emote==='sit'){
      pose.active=true;pose.rootY=2*ease;
      for(let index=0;index<2;index++){
        pose.arms[index].angle=armSign(index)*.08*ease;
        pose.legs[index].scaleY=1-.15*ease;
        pose.legs[index].y=-.5*ease;
      }
    }
    if(direction==='right'&&pose.active&&!suppliedRig){
      pose.bodyAngle=-pose.bodyAngle;
      for(const limb of [...pose.arms,...pose.legs]){limb.angle=-limb.angle;limb.x=-limb.x;}
    }
    return pose;
  }
  window.CodaSpriteAnimation=Object.freeze({directions:DIRECTIONS,clips:CLIPS,framesPerDirection:28,sample,rigDefinition,rigPose});
})();
