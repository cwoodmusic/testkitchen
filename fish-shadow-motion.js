/* Swimming changes live shadow positions; catch identity and rarity stay intact. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishShadowMotion=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const TAU=Math.PI*2,MAX_DT=.25,STEP=1/60;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const angle=value=>Math.atan2(Math.sin(value),Math.cos(value));
 function hash(value){let result=2166136261;for(const letter of String(value))result=Math.imul(result^letter.charCodeAt(0),16777619);return result>>>0;}
 function generator(seed){let state=seed>>>0;return ()=>{state=(state+0x6d2b79f5)>>>0;let value=Math.imul(state^(state>>>15),1|state);value^=value+Math.imul(value^(value>>>7),61|value);return ((value^(value>>>14))>>>0)/4294967296;};}
 function create(api={}){
  if(typeof api.isWater!=='function')throw Error('Fish swimming needs the lake water boundary.');
  const states=new WeakMap();let salt=0,updates=0,initializations=0,substeps=0,active=0,maxStep=0;
  if(typeof api.random==='function'){const value=api.random();if(Number.isFinite(value))salt=Math.floor(clamp(value,0,.999999999)*4294967296)>>>0;}
  const wet=(x,y)=>{try{return Number.isFinite(x)&&Number.isFinite(y)&&api.isWater(x,y)===true;}catch{return false;}};
  function stateFor(shadow){
   let state=states.get(shadow);
   if(state&&state.id===shadow.id&&state.fishId===shadow.fishId&&state.seed===shadow.seed)return state;
   const random=generator(hash(shadow.id+':'+shadow.fishId+':'+shadow.seed)^salt),heading=!state&&Number.isFinite(shadow.heading)?angle(shadow.heading):random()*TAU-Math.PI;
   state={id:shadow.id,fishId:shadow.fishId,seed:shadow.seed,random,heading,age:0,baseSpeed:22+random()*18,phase:random()*TAU,bias:(random()-.5)*.3,turnIn:2+random()*2.5,escapeSign:random()<.5?-1:1};
   states.set(shadow,state);initializations++;return state;
  }
  function pathIsWater(x,y,nx,ny){const parts=Math.max(1,Math.ceil(Math.hypot(nx-x,ny-y)));for(let at=1;at<=parts;at++){const t=at/parts;if(!wet(x+(nx-x)*t,y+(ny-y)*t))return false;}return true;}
  function clearance(x,y,heading,distance){
   const dx=Math.cos(heading),dy=Math.sin(heading);let available=0;
   for(let at=1;at<=5;at++){const length=distance*at/5;if(!wet(x+dx*length,y+dy*length))break;available=at/5;}
   return available;
  }
  function steer(shadow,state,dt,boat){
   state.age+=dt;state.turnIn-=dt;
   if(state.turnIn<=0){state.bias=(state.random()-.5)*.58;state.turnIn=2+state.random()*3;}
   const speed=clamp(state.baseSpeed*(1+.09*Math.sin(state.age*.8+state.phase)),20,45),lookahead=speed*.9+12;
   let desired=state.heading+(state.bias+.13*Math.sin(state.age*.65+state.phase))*dt;
   if(clearance(shadow.x,shadow.y,state.heading,lookahead)<1){
    let best=state.heading,bestScore=-Infinity;
    // Look ahead before reaching the bank. A stable preferred turn avoids
    // alternately choosing left/right while skirting the shore.
    for(const offset of [0,.35,-.35,.7,-.7,1.15,-1.15,1.6,-1.6,2.2,-2.2,Math.PI]){
     const candidate=state.heading+offset,space=clearance(shadow.x,shadow.y,candidate,lookahead);
     const score=space*5-Math.abs(offset)*.22+(Math.sign(offset)===state.escapeSign ? .04 : 0);
     if(score>bestScore){best=candidate;bestScore=score;}
    }
    desired=best;
   }
   if(boat&&Number.isFinite(boat.x)&&Number.isFinite(boat.y)){
    const dx=shadow.x-boat.x,dy=shadow.y-boat.y,distance=Math.hypot(dx,dy);
    if(distance>1&&distance<54){const amount=(1-distance/54)*.65;desired=Math.atan2(Math.sin(desired)+dy/distance*amount,Math.cos(desired)+dx/distance*amount);}
   }
   const turn=clamp(angle(desired-state.heading),-1.65*dt,1.65*dt);state.heading=angle(state.heading+turn);
   const distance=speed*dt,nx=shadow.x+Math.cos(state.heading)*distance,ny=shadow.y+Math.sin(state.heading)*distance;
   let moved=0;
   if(pathIsWater(shadow.x,shadow.y,nx,ny)){shadow.x=nx;shadow.y=ny;moved=distance;maxStep=Math.max(maxStep,distance);}
   shadow.heading=state.heading;shadow.swimSpeed=moved?speed:0;shadow.vx=moved?Math.cos(state.heading)*speed:0;shadow.vy=moved?Math.sin(state.heading)*speed:0;shadow.swimPhase=state.age*speed/10+state.phase;
  }
  function update(shadows,dt,options={}){
   if(!Array.isArray(shadows)||!Number.isFinite(dt)||dt<=0||options.paused)return shadows;
   const duration=Math.min(MAX_DT,dt);let remaining=duration;active=0;updates++;
   const swimmers=shadows.filter(shadow=>shadow&&typeof shadow==='object'&&shadow.visible!==false&&shadow.id!==options.selectedId&&wet(shadow.x,shadow.y));
   active=swimmers.length;
   while(remaining>1e-8){const step=Math.min(STEP,remaining);for(const shadow of swimmers)steer(shadow,stateFor(shadow),step,options.boat);remaining-=step;substeps++;}
   return shadows;
  }
  return {update,snapshot:()=>({updates,initializations,substeps,active,maxStep,maxDelta:MAX_DT}),forget:shadow=>states.delete(shadow)};
 }
 return {create,MAX_DT,STEP};
});
