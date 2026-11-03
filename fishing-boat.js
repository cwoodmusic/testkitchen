/* Pixel boat artwork follows the caller's paused game clock and travel phase. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishingBoat=api;})(typeof window==='object'?window:null,function(){
 'use strict';
 const TAU=Math.PI*2;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const copy=value=>JSON.parse(JSON.stringify(value));
 function pose(state={},options={}){
  const boat=state.boat||{},time=finite(state.time),quality=options.getQuality?.()||'full',calm=options.reducedMotion?.()===true||quality==='off',moving=state.moving===true;
  const phase=(finite(boat.phase)*1.2)%TAU,amount=quality==='lite'?.72:1,rowingAmount=calm?0:clamp(finite(state.rowingAmount,moving?1:0),0,1),stroke=Math.sin(phase)*rowingAmount,pull=calm||!moving?0:Math.max(0,Math.cos(phase))*rowingAmount;
  const facing=['down','left','up','right'].includes(boat.facing)?boat.facing:'down',heading={down:0,left:Math.PI/2,up:Math.PI,right:-Math.PI/2}[facing],direction=facing==='left'?-1:facing==='right'?1:0;
  return {x:finite(boat.x),y:finite(boat.y),time,moving,occupied:state.occupied!==false,calm,quality,facing,heading,
   bob:calm?0:(Math.sin(time*1.8)*.8+Math.sin(time*.7)*.25+(moving?Math.sin(phase*2)*.35:0))*amount,
   rock:calm?0:(Math.sin(time*1.4)*.014+(Math.sin(phase)*.026+direction*.009)*rowingAmount)*amount,
   stroke,pull,rowingAmount,splash:pull*pull*amount,
   oars:[-1,1].map(side=>({side,rootX:side*7,rootY:-1,tipX:side*(16+Math.cos(phase)*2*rowingAmount),tipY:3+stroke*6})),
   // The stepped hull fits inside the game's unchanged 18×12 half-footprint
   // in every direction, including its one-pixel bob and lateral sway.
   hull:{halfWidth:18,halfHeight:12}};
 }
 function create(options={}){
  let last=null,destroyed=false;
  function oar(ctx,value){
   const dx=value.tipX-value.rootX,dy=value.tipY-value.rootY,steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy)));
   ctx.fillStyle='#d1ab73';
   for(let at=0;at<=steps;at++)ctx.fillRect(Math.round(value.rootX+dx*at/steps),Math.round(value.rootY+dy*at/steps),2,2);
   const tipX=Math.round(value.tipX),tipY=Math.round(value.tipY);
   ctx.fillStyle='#735a3f';ctx.fillRect(tipX-2,tipY-1,5,4);ctx.fillStyle='#e0bc7b';ctx.fillRect(tipX-1,tipY-1,3,1);
  }
  function hull(ctx,p){
   // Keep the readable 28×20 world silhouette inside the same collision box.
   // Horizontal turns widen the local prow axis instead of rotating a tall
   // hull through the shore. Snap every edge before the cardinal rotation.
   const horizontal=p.facing==='left'||p.facing==='right',scaleX=horizontal?10/9:14/9,scaleY=horizontal?1.4:1;
   const rect=(x,y,width,height)=>{const left=Math.round(x*scaleX),top=Math.round(y*scaleY);ctx.fillRect(left,top,Math.round((x+width)*scaleX)-left,Math.round((y+height)*scaleY)-top);};
   // A square stern and stepped, pointed south prow read clearly from above.
   ctx.fillStyle='#172a36';rect(-7,-10,14,1);rect(-9,-9,18,14);rect(-7,5,14,3);rect(-5,8,10,1);rect(-3,9,6,1);
   ctx.fillStyle='#9b6c42';rect(-7,-9,14,14);rect(-5,5,10,3);rect(-3,8,6,2);
   ctx.fillStyle='#d7a866';rect(-7,-9,2,14);rect(5,-9,2,14);rect(-5,5,2,3);rect(3,5,2,3);rect(-3,8,6,1);
   ctx.fillStyle='#e8c58a';rect(-5,-9,10,2);rect(-7,-7,1,10);rect(-3,6,6,1);
   ctx.fillStyle='#41575a';rect(-5,-7,10,11);
   ctx.fillStyle='#64746a';rect(-4,-6,8,2);rect(-4,1,8,2);
   ctx.fillStyle='#273c43';rect(-1,-7,1,11);
   ctx.fillStyle='#c89b5d';rect(-6,-2,12,3);ctx.fillStyle='#eed19a';rect(-6,-2,12,1);
   ctx.fillStyle='#7ca69a';rect(-8,-6,1,7);rect(7,-6,1,7);
  }
  function draw(ctx,state={}){
   if(destroyed||!ctx)return getState();
   const elapsed=last?clamp(finite(state.time)-last.time,0,.1):0,target=state.moving===true?1:0,rowingAmount=last?last.rowingAmount+(target-last.rowingAmount)*(1-Math.exp(-elapsed*9)):target;
   last=pose({...state,rowingAmount},options);
   const p=last;
   ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(p.x),Math.round(p.y));
   ctx.fillStyle='#102f4090';ctx.fillRect(-10,-5,20,14);ctx.fillRect(-12,-2,24,8);
   ctx.save();ctx.translate(Math.round(p.rock*30),Math.round(p.bob));
   ctx.save();ctx.rotate(p.heading);
   if(!p.calm&&p.moving&&p.splash>.02){
    const count=p.quality==='lite'?2:4;
    for(const value of p.oars)for(let at=0;at<count;at++){
     const spread=1-p.pull,x=value.tipX+value.side*(at*2+spread*3),y=value.tipY+at%2*3+spread*4;
     ctx.fillStyle=at%2?'#a7e4e0b0':'#65bfc9a0';ctx.fillRect(Math.round(x),Math.round(y),at%2?2:3,2);
    }
   }
   for(const value of p.oars)oar(ctx,value);
   hull(ctx,p);ctx.restore();
   // Rider artwork keeps the world's upright axes; its callback still owns
   // avatar facing and is never rotated with the hull or oars.
   if(p.occupied){
    if(typeof state.drawRider==='function')state.drawRider(ctx,copy(p));
    else{ctx.fillStyle='#d8a47e';ctx.fillRect(-4,-20,8,8);ctx.fillStyle='#9ea1ab';ctx.fillRect(-5,-12,10,13);}
   }
   ctx.restore();ctx.restore();return getState();
  }
  function getState(){return last?copy(last):null;}
  function destroy(){destroyed=true;last=null;}
  return {draw,getState,destroy};
 }
 return {pose,create};
});
