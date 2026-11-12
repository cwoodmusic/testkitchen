// Track changes move the curtain first; an ensemble is replaced only behind
// fully closed velvet. Audio keeps its one continuous town-wide player.
export const CONCERT_CHANGEOVER=Object.freeze({close:.7,hold:.25,open:.85,reducedHold:.3});
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>n*n*(3-2*n);
const key=p=>String(p?.id||p?.title||'concert');
export function createConcertCurtain({createPerformance}={}){
 let model=null,current=null,pending=null,phase='open',started=0,closure=0,last=0,reduced=false,from=0,external=false;
 function swap(){model=createPerformance(pending,model);current=key(pending);pending=null;}
 function update(program,time=0,{reducedMotion=false,timeline}={}){
  const now=Number.isFinite(time)?Math.max(last,time):last;last=now;reduced=!!reducedMotion;
  if(timeline){
   const shown=timeline.phase==='closing'?timeline.previousTrack:program;
   if(!model||key(shown)!==current){pending=shown;swap();}
   phase=timeline.phase;closure=clamp(timeline.closure);pending=phase==='closing'?timeline.nextTrack:null;external=true;
   return {performance:model,phase,closure,programmeId:current,pendingProgrammeId:pending?key(pending):null};
  }
  if(external){external=false;phase='open';closure=0;pending=null;}
  if(!model){pending=program;swap();}
  else if(key(program)!==(pending?key(pending):current)){
   pending=program;
   // Repeated Next clicks replace the waiting act without exposing it or
   // restarting an already closing curtain.
   if(phase==='open'||phase==='opening'){started=now;from=closure;phase='closing';}
  }
  for(let step=0;step<3;step++){
   const elapsed=Math.max(0,now-started);
   if(phase==='closing'){
    closure=reduced?1:from+(1-from)*ease(clamp(elapsed/CONCERT_CHANGEOVER.close));
    if(!reduced&&elapsed+1e-9<CONCERT_CHANGEOVER.close)break;
    started+=reduced?0:CONCERT_CHANGEOVER.close;closure=1;if(pending)swap();phase='closed';continue;
   }
   if(phase==='closed'){
    closure=1;if(pending)swap();const hold=reduced?CONCERT_CHANGEOVER.reducedHold:CONCERT_CHANGEOVER.hold;
    if(elapsed<hold)break;started+=hold;phase='opening';continue;
   }
   if(phase==='opening'){
    closure=reduced?0:1-ease(clamp(elapsed/CONCERT_CHANGEOVER.open));
    if(reduced||elapsed>=CONCERT_CHANGEOVER.open){closure=0;phase='open';}break;
   }
   break;
  }
  return {performance:model,phase,closure,programmeId:current,pendingProgrammeId:pending?key(pending):null};
 }
 return {update,reset(){model=current=pending=null;phase='open';closure=from=0;external=false;started=last=0;},get state(){return {performance:model,phase,closure,programmeId:current,pendingProgrammeId:pending?key(pending):null};}};
}
const fill=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
export function drawConcertCurtain(c,stage,state={},{viewport}={}){
 if(!stage||!c)return false;
 const closed=clamp(Number(state.closure)||0);
 // The modern hall has no permanent proscenium. Open panels, valance and
 // track are completely stowed, leaving the pipe chamber and ceiling clear.
 if(closed===0)return false;
 const x=stage.x-32,y=Math.min(0,stage.y),w=stage.w+64,h=stage.y+stage.h-y;
 if(viewport&&(x+w<viewport.x||x>viewport.x+viewport.w||y+h<viewport.y||y>viewport.y+viewport.h))return false;
 c.save();c.imageSmoothingEnabled=false;
 const panel=w*.5*closed,palette=['#341b2a','#4d2033','#69263e','#82324b','#9c4258','#7c2d46','#592237','#3b1c2d'];
 for(const side of [0,1]){
  const left=side?x+w-panel:x;
  fill(c,left+5,y+18,panel,h-24,'#130f1c80');
  fill(c,left,y,panel,h,'#60243b');
  for(let col=0;col<panel;col+=8){const index=Math.floor((side?panel-col:col)/8)%palette.length;fill(c,left+col,y,Math.min(8,panel-col),h,palette[index]);}
  for(let row=24;row<h-18;row+=58)fill(c,left+4,y+row,Math.max(1,panel-8),1,'#e3977915');
  fill(c,left,y+h-15,panel,3,'#d3a761');fill(c,left,y+h-11,panel,2,'#7f5438');fill(c,left,y+h-7,panel,3,'#b78a4e');
  const cap=Math.min(4,panel),edge=side?left:left+panel-cap;fill(c,edge,y,cap,h-16,'#c28b55');fill(c,edge+Math.min(1,cap/2),y+1,Math.min(1,cap),h-20,'#edc786');
 }
 // The rig is above the visible ceiling line, never across the organ pipes.
 c.restore();return true;
}
