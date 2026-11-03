/* Four steady, smoothly cycling PAR lights on editable arcade image assets. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaDJFloodlights=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const FIELDS=['version','enabled','speed','intensity','beamLength'];
 const HEADS=[.170899,.390494,.607913,.828203],HUES=[185,315,265,38];
 const LEDS=[[0,0],[0,-1],[.866,-.5],[.866,.5],[0,1],[-.866,.5],[-.866,-.5]];
 const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
 function defaults(){return {version:1,enabled:true,speed:1,intensity:60,beamLength:160};}
 function validate(value){return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===FIELDS.length&&Object.keys(value).every(key=>FIELDS.includes(key))&&value.version===1&&typeof value.enabled==='boolean'&&finite(value.speed,0,4)&&finite(value.intensity,0,100)&&finite(value.beamLength,20,500);}
 const shade=(hue,alpha=1)=>'hsla('+hue.toFixed(3)+',92%,64%,'+alpha+')';
 function create(api={}){
  const quality=()=>['full','lite','off'].includes(api.getQuality?.())?api.getQuality():'full';
  const reduced=()=>api.reducedMotion?.()===true;
  const now=()=>{const value=api.getTime?.();return Number.isFinite(value)?value:0;};
  function state(asset){
   if(!asset||!validate(asset.floodLights)||![asset.x,asset.y,asset.w,asset.h].every(Number.isFinite)||asset.w<=0||asset.h<=0)return null;
   const settings=asset.floodLights,animation=api.getAnimation?.(asset)||{},time=reduced()?0:now(),phase=time*settings.speed;
   const rotation=(Number.isFinite(asset.rotation)?asset.rotation:0)*Math.PI/180+(Number.isFinite(animation.rot)?animation.rot:0),scale=Number.isFinite(animation.scale)?animation.scale:1;
   const scaleX=scale*(asset.flipX===true?-1:1),scaleY=scale*(asset.flipY===true?-1:1);
   const x=asset.x+(Number.isFinite(animation.dx)?animation.dx:0),y=asset.y+(Number.isFinite(animation.dy)?animation.dy:0);
   const opacity=Math.max(0,Math.min(1,(Number.isFinite(asset.opacity)?asset.opacity:100)/100))*(Number.isFinite(animation.alpha)?animation.alpha:1);
   const q=quality(),visible=asset.visible!==false&&opacity>0,enabled=visible&&settings.enabled&&settings.intensity>0&&q!=='off';
   const cs=Math.cos(rotation),sn=Math.sin(rotation);
   const heads=HEADS.map((fraction,index)=>{
    const localX=(fraction-.5)*asset.w,localY=asset.h*.33,hue=(HUES[index]+phase*30)%360;
    const angle=(index-1.5)*.24+(q==='full'&&!reduced()?Math.sin(phase*.35+index*.6)*.07:0);
    const endLocalX=localX+Math.tan(angle)*settings.beamLength,endLocalY=localY+settings.beamLength;
    return {index,localX,localY,x:x+localX*cs*scaleX-localY*sn*scaleY,y:y+localX*sn*scaleX+localY*cs*scaleY,hue,color:shade(hue),angle,
     endLocalX,endLocalY,endX:x+endLocalX*cs*scaleX-endLocalY*sn*scaleY,endY:y+endLocalX*sn*scaleX+endLocalY*cs*scaleY};
   });
   return {id:asset.id,x,y,width:asset.w,height:asset.h,rotation,scale,scaleX,scaleY,opacity,enabled,quality:q,settings,heads};
  }
  function drawBeams(ctx){
   if(!ctx||quality()==='off')return;
   for(const asset of api.getAssets?.()||[]){
    const rig=state(asset);if(!rig?.enabled)continue;
    const power=rig.settings.intensity/100,length=rig.settings.beamLength,width=Math.min(rig.width*.42,length*.46),lens=Math.max(3,rig.width*.035);
    ctx.save();ctx.translate(rig.x,rig.y);ctx.rotate(rig.rotation);ctx.scale(rig.scaleX,rig.scaleY);ctx.globalAlpha=(ctx.globalAlpha??1)*rig.opacity;ctx.globalCompositeOperation='screen';ctx.shadowBlur=0;
    for(const head of rig.heads){
     const endX=head.endLocalX,endY=head.endLocalY,gradient=ctx.createLinearGradient(head.localX,head.localY,endX,endY);
     gradient.addColorStop(0,shade(head.hue,power*(rig.quality==='full'?.42:.28)));
     gradient.addColorStop(.45,shade(head.hue,power*(rig.quality==='full'?.24:.16)));
     gradient.addColorStop(.82,shade(head.hue,power*(rig.quality==='full'?.17:.09)));gradient.addColorStop(1,shade(head.hue,0));
     ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(head.localX-lens,head.localY);ctx.lineTo(head.localX+lens,head.localY);ctx.lineTo(endX+width/2,endY);ctx.lineTo(endX-width/2,endY);ctx.closePath();ctx.fill();
     if(rig.quality==='full'){
      // A narrow luminous shaft keeps each physical can legible on the bright
      // dance tiles, while the broad cone remains translucent around it.
      const core=ctx.createLinearGradient(head.localX,head.localY,endX,endY);
      core.addColorStop(0,shade(head.hue,power*.2));core.addColorStop(.5,shade(head.hue,power*.18));core.addColorStop(1,shade(head.hue,power*.025));
      ctx.fillStyle=core;ctx.beginPath();ctx.moveTo(head.localX-lens*.4,head.localY);ctx.lineTo(head.localX+lens*.4,head.localY);ctx.lineTo(endX+width*.17,endY);ctx.lineTo(endX-width*.17,endY);ctx.closePath();ctx.fill();
      const radius=width*.7;ctx.save();ctx.translate(endX,endY);ctx.scale(1,.32);
      const pool=ctx.createRadialGradient(0,0,0,0,0,radius);pool.addColorStop(0,shade(head.hue,power*.32));pool.addColorStop(.4,shade(head.hue,power*.14));pool.addColorStop(1,shade(head.hue,0));ctx.fillStyle=pool;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
     }
    }
    ctx.restore();
   }
  }
  function drawFixture(ctx,asset){
   const rig=state(asset);if(!ctx||!rig?.enabled)return;
   const power=rig.settings.intensity/100,rx=Math.max(.5,rig.width*.0075),ry=Math.max(.5,rig.height*.032),spacingX=rig.width*.019,spacingY=rig.height*.084;
   ctx.save();const opacity=ctx.globalAlpha??1;ctx.shadowBlur=0;
   for(const head of rig.heads){
    if(rig.quality==='full'){
     const radius=spacingX*2.8,glow=ctx.createRadialGradient(head.localX,head.localY,0,head.localX,head.localY,radius);glow.addColorStop(0,shade(head.hue,power*.2));glow.addColorStop(1,shade(head.hue,0));ctx.globalCompositeOperation='screen';ctx.globalAlpha=opacity;ctx.fillStyle=glow;ctx.fillRect(head.localX-radius,head.localY-radius,radius*2,radius*2);
    }
    // Tint the seven existing round LEDs, leaving the circular can and its
    // highlights visible instead of laying a solid colour over the face.
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=opacity*(.5+.5*power);
    for(const [dx,dy]of LEDS){
     const x=head.localX+dx*spacingX,y=head.localY+dy*spacingY;
     ctx.fillStyle=head.color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();
     ctx.fillStyle='hsla('+head.hue.toFixed(3)+',98%,92%,.85)';ctx.beginPath();ctx.ellipse(x,y,rx*.38,ry*.38,0,0,Math.PI*2);ctx.fill();
    }
   }
   ctx.restore();
  }
  function snapshot(){return {quality:quality(),rigs:(api.getAssets?.()||[]).map(state).filter(Boolean).map(rig=>({id:rig.id,x:rig.x,y:rig.y,width:rig.width,height:rig.height,rotation:rig.rotation,scale:rig.scale,scaleX:rig.scaleX,scaleY:rig.scaleY,opacity:rig.opacity,enabled:rig.enabled,settings:{...rig.settings},heads:rig.heads.map(head=>({...head}))}))};}
  return {drawBeams,drawFixture,snapshot};
 }
 return Object.freeze({defaults,validate,create});
});
