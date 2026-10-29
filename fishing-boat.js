/* Decorative boat motion uses the caller's paused game clock and travel phase. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingBoat=api;})(typeof window==='object'?window:null,function(){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const copy=value=>JSON.parse(JSON.stringify(value));
 function pose(state={},options={}){
  const boat=state.boat||{},time=finite(state.time),quality=options.getQuality?.()||'full',calm=options.reducedMotion?.()===true||quality==='off',moving=state.moving===true;
  const phase=(finite(boat.phase)*1.2)%TAU,amount=quality==='lite'?.72:1,rowingAmount=calm?0:clamp(finite(state.rowingAmount,moving?1:0),0,1),stroke=Math.sin(phase)*rowingAmount,pull=calm||!moving?0:Math.max(0,Math.cos(phase))*rowingAmount;
  const direction=boat.facing==='left'?-1:boat.facing==='right'?1:0;
  return {x:finite(boat.x),y:finite(boat.y),time,moving,occupied:state.occupied!==false,calm,quality,
   bob:calm?0:(Math.sin(time*1.8)*.8+Math.sin(time*.7)*.25+(moving?Math.sin(phase*2)*.35:0))*amount,
   rock:calm?0:(Math.sin(time*1.4)*.014+(Math.sin(phase)*.026+direction*.009)*rowingAmount)*amount,
   stroke,pull,rowingAmount,splash:pull*pull*amount,
   oars:[-1,1].map(side=>({side,rootX:side*9,rootY:1,tipX:side*(36+Math.cos(phase)*3*rowingAmount),tipY:15+stroke*13})),
   // This is artwork only. The game's existing movement/collision footprint
   // continues to own whether the boat can enter any position.
   hull:{halfWidth:30,halfHeight:18}};
 }
 function create(options={}){
  let last=null,destroyed=false;
  function oar(ctx,value){
   const dx=value.tipX-value.rootX,dy=value.tipY-value.rootY,length=Math.hypot(dx,dy);
   ctx.save();ctx.translate(value.rootX,value.rootY);ctx.rotate(Math.atan2(dy,dx));
   ctx.fillStyle='#e3bd88';ctx.fillRect(0,-1.4,length,2.8);ctx.fillStyle='#a7754b';ctx.fillRect(length-5,-4,12,8);ctx.fillStyle='#d9ab6d';ctx.fillRect(length-5,-4,12,2);ctx.fillStyle='#8a5d43';ctx.fillRect(length+5,-3,2,6);ctx.restore();
  }
  function draw(ctx,state={}){
   if(destroyed||!ctx)return getState();
   const elapsed=last?clamp(finite(state.time)-last.time,0,.1):0,target=state.moving===true?1:0,rowingAmount=last?last.rowingAmount+(target-last.rowingAmount)*(1-Math.exp(-elapsed*9)):target;
   last=pose({...state,rowingAmount},options);
   const p=last;
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(p.x,p.y);
   ctx.fillStyle='#102338a8';ctx.beginPath();ctx.ellipse(0,7,30,18,0,0,TAU);ctx.fill();
   if(!p.calm&&p.moving&&p.splash>.02){
    const count=p.quality==='lite'?2:4;
    for(const value of p.oars)for(let at=0;at<count;at++){
     const spread=1-p.pull,x=value.tipX+value.side*(at*3+spread*5),y=value.tipY+at%2*3+spread*7;
     ctx.fillStyle=at%2?'#a7e4e0b0':'#65bfc9a0';ctx.fillRect(Math.round(x),Math.round(y),at%2?2:3,2);
    }
   }
   ctx.save();ctx.translate(0,p.bob);ctx.rotate(p.rock);
   for(const value of p.oars)oar(ctx,value);
   ctx.fillStyle='#6f493b';ctx.beginPath();ctx.moveTo(-30,-5);ctx.quadraticCurveTo(0,-24,31,-5);ctx.lineTo(24,15);ctx.quadraticCurveTo(0,28,-24,15);ctx.closePath();ctx.fill();
   ctx.fillStyle='#bc8757';ctx.beginPath();ctx.moveTo(-27,-5);ctx.quadraticCurveTo(0,-20,28,-5);ctx.lineTo(22,12);ctx.quadraticCurveTo(0,23,-22,12);ctx.closePath();ctx.fill();
   ctx.fillStyle='#785141';ctx.fillRect(-23,-5,46,15);
   for(let x=-18;x<=18;x+=9){ctx.fillStyle='#9b6c49';ctx.fillRect(x,-5,1,15);ctx.fillStyle='#d0a16c';ctx.fillRect(x+1,-3,1,11);}
   ctx.fillStyle='#d9af77';ctx.fillRect(-23,-7,46,3);ctx.fillStyle='#a16d47';ctx.fillRect(-20,0,40,3);ctx.fillStyle='#e3bb82';ctx.fillRect(-20,0,40,1);
   if(p.occupied){
    if(typeof state.drawRider==='function')state.drawRider(ctx,copy(p));
    else{ctx.fillStyle='#d8a47e';ctx.fillRect(-5,-22,10,10);ctx.fillStyle='#9ea1ab';ctx.fillRect(-7,-12,14,15);}
   }
   ctx.fillStyle='#d9aa70';ctx.fillRect(-19,11,38,3);ctx.fillStyle='#80543b';ctx.fillRect(-17,14,34,2);ctx.fillStyle='#e6c58f';ctx.fillRect(-23,-4,2,3);ctx.fillRect(22,-4,2,3);
   ctx.restore();ctx.restore();return getState();
  }
  function getState(){return last?copy(last):null;}
  function destroy(){destroyed=true;last=null;}
  return {draw,getState,destroy};
 }
 return {pose,create};
});
