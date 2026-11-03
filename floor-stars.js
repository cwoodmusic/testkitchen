/* Sparse floor glints, replacing the old magenta square twinkle layer.
 * Positions stay inside exposed floor; this pass runs below props and actors. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFloorStars=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const LOUNGE_POINTS=Object.freeze([[155,236],[245,189],[332,224],[291,309],[410,248]].map(Object.freeze));
 const POINTS=Object.freeze([
  [569,218],[720,169],[943,188],[1122,216],[1284,192],[1508,356],[1370,391],[1193,346],
  [1014,368],[827,293],[723,403],[516,450],[299,408],[903,470],[1068,481],[1262,465],
  [1507,515],[1413,585],[1176,575],[987,591],[886,644],[1064,710],[1269,692],[1513,731],
  [1401,772],[1186,762],[944,772],[755,779],[111,767],[521,226],[795,436],[1464,431],
  [617,237],[701,319],[900,299],[1109,301],[1290,292],[1534,638],[1035,421],[955,527],
  [1151,430],[879,556],[1380,673],[1113,638],[999,668],[1554,784],[1302,765],[908,344],
  ...LOUNGE_POINTS
 ].map(Object.freeze));
 const COLORS=Object.freeze(['#fff1cd','#cdeeff','#e7f7ff']);
 function brightness(index,time){
  const phase=index*2.3999632297,period=6.5+index%7*.65;
  const breath=.5+.5*Math.sin(time*Math.PI*2/period+phase);
  const cycle=(time+index*1.73)%(13+index%5);
  // A small, soft brightness dip supplies an occasional flicker without
  // switching the point off or producing a full-intensity flash.
  const flicker=1-.32*Math.exp(-Math.pow((cycle-1.8)/.23,2));
  return (.16+.65*Math.pow(breath,3))*flicker;
 }
 function create(api={}){
  const quality=()=>api.getQuality?.()||'full';
  const animated=()=>quality()!=='off'&&!api.reducedMotion?.()&&api.getAnimation?.()!==false;
  const time=()=>{const value=api.getTime?.();return Math.max(0,Number.isFinite(value)?value:0);};
  function snapshot(){
   const moving=animated(),now=time(),visible=quality()!=='off';
   return {visible,animated:moving,count:POINTS.length,stars:POINTS.map(([x,y],index)=>({x,y,color:COLORS[index%COLORS.length],alpha:visible?(moving?brightness(index,now):.4):0}))};
  }
  function draw(ctx){
   if(!ctx||quality()==='off')return;
   const state=snapshot(),strength=quality()==='lite'?.8:1;
   ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';
   for(const star of state.stars){
    ctx.fillStyle=star.color;ctx.globalAlpha=star.alpha*strength;
    ctx.fillRect(star.x,star.y,1,1);
    // Only the brighter points form a tiny, crisp cross. No glow textures,
    // gradients, dust or nebula wash compete with the glass floor surface.
    ctx.globalAlpha=star.alpha*star.alpha*.45*strength;
    ctx.fillRect(star.x-2,star.y,5,1);ctx.fillRect(star.x,star.y-2,1,5);
   }
   ctx.restore();
  }
  return {draw,snapshot};
 }
 return Object.freeze({POINTS,LOUNGE_POINTS,COLORS,brightness,create});
});
