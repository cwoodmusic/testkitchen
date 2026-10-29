/* Small cosmetic companions share the avatar's world coordinates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaPetCompanion=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const IDS=Object.freeze(['none','cosmiccat','neondragon','lakeotter','rhythmfox','pianophoenix']);
 const vectors={down:[0,1],left:[-1,0],up:[0,-1],right:[1,0]};
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const petId=value=>IDS.includes(value)?value:'none';
 function drawPet(ctx,id,motion={},time=0,options={}){
  if(!ctx||petId(id)==='none')return false;
  const x=finite(motion.x),y=finite(motion.y),scale=Math.max(.125,Math.min(4,finite(motion.scale,1))),facing=vectors[motion.facing]?motion.facing:'down',side=facing==='left'||facing==='right',back=facing==='up';
  const quiet=options.reducedMotion===true,phase=finite(motion.phase),moving=motion.moving===true,t=finite(time),step=quiet?0:Math.sin(phase),bob=quiet?0:moving?-Math.round(Math.abs(step)):id==='neondragon'||id==='pianophoenix'?Math.round(Math.sin(t*3)):-Math.round(Math.sin(t*2)*.35);
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
  const rect=(a,b,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(a),Math.round(b),w,h);};
  rect(-9,0,18,3,'#080d2355');
  ctx.translate(0,bob);if(facing==='left')ctx.scale(-1,1);
  const feet=(color,spread=7)=>{rect(-spread,-3+(moving&&step>0?1:0),5,3,color);rect(spread-5,-3+(moving&&step<0?1:0),5,3,color);};
  const eyes=(color='#192332')=>{if(back)return;if(side){rect(4,-17,3,3,color);rect(4,-17,1,1,'#f5fff6');}else{rect(-6,-17,3,3,color);rect(3,-17,3,3,color);rect(-6,-17,1,1,'#f5fff6');rect(3,-17,1,1,'#f5fff6');}};
  if(id==='cosmiccat'){
   rect(side?-14:8,-14,5,11,'#5b447f');rect(side?-15:10,-17,4,7,'#aa7ae6');rect(side?-14:11,-18,2,3,'#e9abf2');
   rect(-8,-14,16,12,'#624c8c');rect(-6,-12,12,8,'#7b62aa');feet('#b7a0e1');
   rect(-9,-23,18,12,'#8c72be');rect(-7,-26,5,6,'#9e84d4');rect(3,-26,5,6,'#9e84d4');rect(-6,-24,2,3,'#edabd8');rect(4,-24,2,3,'#edabd8');
   rect(-7,-21,14,9,'#a28ad2');if(!back){rect(side?4:-3,-12,side?5:6,3,'#d9c6f3');rect(side?8:-1,-14,2,2,'#efb7dc');}eyes('#24223d');
   rect(-5,-8,10,2,'#63dce2');rect(-1,-9,2,4,'#fff0a8');rect(-2,-8,4,2,'#fff0a8');
   if(!quiet){const glint=Math.floor(t*2)%3;if(glint===0){rect(13,-24,1,5,'#ddfbff');rect(11,-22,5,1,'#ddfbff');}}
  }else if(id==='neondragon'){
   // Wings and tail sit behind the tiny dragon's round body.
   rect(-15,-18,5,10,'#347b9f');rect(-12,-21,5,13,'#60c4d0');rect(9,-18,6,10,'#347b9f');rect(7,-21,5,13,'#60c4d0');rect(-11,-17,2,7,'#bda8ed');rect(10,-17,2,7,'#bda8ed');
   rect(side?-15:7,-8,9,5,'#399391');rect(side?-18:13,-11,5,5,'#70e6ca');
   rect(-8,-18,16,16,'#4dadad');rect(-5,-14,10,11,'#aeefb6');feet('#5bcbc1');
   rect(-9,-25,18,13,'#69d3c5');rect(-6,-28,3,5,'#f3d89b');rect(4,-28,3,5,'#f3d89b');rect(side?4:-6,-16,side?8:12,5,'#8be6cc');eyes('#203f55');
   rect(-1,-23,3,3,'#caa7f2');rect(-1,-19,3,2,'#a181dd');if(!back)rect(side?9:-2,-13,side?2:4,1,'#34766f');
  }else if(id==='lakeotter'){
   rect(side?-14:5,-9,11,6,'#60485c');rect(side?-17:13,-8,5,4,'#826275');
   rect(-8,-16,16,14,'#79596a');rect(-5,-14,10,10,'#d1b39d');feet('#4b3e51');
   rect(-9,-23,18,12,'#9c7880');rect(-10,-24,5,5,'#79596a');rect(6,-24,5,5,'#79596a');rect(-8,-23,2,2,'#d7b6ae');rect(7,-23,2,2,'#d7b6ae');
   if(!back){rect(side?3:-7,-16,side?8:14,5,'#e0c7b0');rect(side?9:-1,-16,3,2,'#3d3449');}eyes();
   rect(-6,-9,12,2,'#3fb9c3');rect(-2,-10,4,4,'#e4cf7a');rect(-1,-11,2,6,'#ffe6a2');
  }else if(id==='rhythmfox'){
   rect(side?-17:7,-12,11,7,'#b66b49');rect(side?-20:14,-15,7,6,'#f1dec2');rect(side?-19:16,-13,4,5,'#fff0d8');
   rect(-8,-15,16,13,'#c47b4f');rect(-4,-12,9,9,'#efd2a5');feet('#4c3b49');
   rect(-9,-24,18,13,'#e6a25e');rect(-8,-28,5,8,'#d88c56');rect(4,-28,5,8,'#d88c56');rect(-7,-26,2,4,'#653e4b');rect(5,-26,2,4,'#653e4b');
   if(!back){rect(side?3:-7,-16,side?8:14,5,'#f7dfbc');rect(side?9:-1,-15,3,2,'#4c3342');}eyes('#3c303e');
   rect(-6,-9,12,2,'#a471c6');rect(1,-10,2,5,'#f5e4a2');rect(-2,-6,4,2,'#f5e4a2');
  }else if(id==='pianophoenix'){
   const flutter=quiet?0:Math.round(Math.sin(t*5)*2);
   rect(-14,-16+flutter,7,9,'#d59c5c');rect(-12,-18+flutter,7,8,'#ffe2a0');rect(8,-16-flutter,7,9,'#d59c5c');rect(6,-18-flutter,7,8,'#ffe2a0');
   rect(side?-12:-5,-7,side?8:10,8,'#e49a58');rect(side?-15:-3,-4,side?7:6,7,'#ffe2a0');
   rect(-7,-19,14,15,'#fff1ca');rect(-4,-16,8,10,'#f4d59d');feet('#c88d56',6);
   rect(-7,-27,14,13,'#fff6de');rect(-3,-30,3,5,'#f6cb78');rect(1,-32,3,7,'#ffe9a6');rect(4,-29,2,5,'#dc9d5c');
   if(!back){rect(side?6:-2,-19,side?5:4,3,'#d89453');}eyes('#4a3c56');rect(-2,-12,4,4,'#ac82c7');rect(-1,-11,2,2,'#f9e6a4');
  }
  ctx.restore();return true;
 }
 function create(api={}){
  let state={active:false,id:'none',x:0,y:0,facing:'down',moving:false,phase:0,roomId:null};
  const profile=()=>{try{return api.getProfile?.()||{};}catch{return {};}};
  function anchor(player){
   const facing=vectors[player?.facing]?player.facing:'down',[dx,dy]=vectors[facing];
   return{x:player.x-dx*34-dy*10,y:player.y-dy*34+dx*10,facing};
  }
  function reset(player,roomId){
   const id=petId(profile().pet);
   if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y)||id==='none'){state={...state,active:false,id:'none',moving:false,roomId:roomId??state.roomId};return getState();}
   state={active:true,id,...anchor(player),moving:false,phase:0,roomId:roomId??null};return getState();
  }
  function update(player,dt,roomId){
   const id=petId(profile().pet);
   if(!player||!Number.isFinite(player.x)||!Number.isFinite(player.y)||id==='none')return reset(null,roomId);
   if(!state.active||state.id!==id||state.roomId!==(roomId??null)||Math.hypot(player.x-state.x,player.y-state.y)>300)return reset(player,roomId);
   const elapsed=Math.max(0,Math.min(.25,finite(dt))),target=anchor(player),dx=target.x-state.x,dy=target.y-state.y,distance=Math.hypot(dx,dy),step=Math.min(distance,360*elapsed,distance*(1-Math.exp(-elapsed*9)));
   state.moving=step>.025;
   if(distance>.1&&step>0){state.x+=dx/distance*step;state.y+=dy/distance*step;state.facing=Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up';state.phase+=step/5;}
   else if(!state.moving){if(distance<=.1){state.x=target.x;state.y=target.y;}state.facing=target.facing;}
   return getState();
  }
  function getState(){return{...state};}
  function draw(ctx,time=0){if(!state.active)return false;let quiet=false;try{quiet=typeof api.reducedMotion==='function'?!!api.reducedMotion():api.reducedMotion===true;}catch{}return drawPet(ctx,state.id,state,time,{reducedMotion:quiet});}
  return{update,draw,reset,getState};
 }
 return Object.freeze({IDS,create,drawPet});
});
