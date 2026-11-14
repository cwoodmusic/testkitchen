import {actorHeight,height,blocked,actorBlocked,actorTraversal,commitActorTraversal} from './model.mjs?v=town-coast-pier-1';

/** Ordinary note rays retain deck-only behavior; a lower player carries its
 * intentional walking layer across each sample without changing note height. */
export function clearNetPath(doc,from,to,catalog,viewAt=()=>doc){
 const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/4)),lower=!!from.underPier,check=lower?actorBlocked:blocked;let previous=from;
 for(let i=1;i<=steps;i++){
  const q={x:from.x+(to.x-from.x)*i/steps,y:from.y+(to.y-from.y)*i/steps};
  if(check(viewAt(q),q.x,q.y,catalog,previous))return false;
  if(lower)commitActorTraversal(q,actorTraversal(doc,previous,q.x,q.y));previous=q;
 }
 return true;
}

export function canBoardFishingDock(doc,player,dock){
 return Boolean(doc&&player&&dock?.stand&&!player.underPier&&Math.hypot(player.x-dock.stand.x,player.y-dock.stand.y)<190&&Math.abs(actorHeight(doc,player)-height(doc,dock.stand.x,dock.stand.y))<=14);
}

export function onSameOutdoorSurface(doc,actor,target){return Math.abs(actorHeight(doc,actor)-actorHeight(doc,target))<=14;}

/** Restore a runtime actor without carrying an obsolete under-deck flag. */
export function restoreOutdoorActor(doc,actor,position,catalog){
 if(!doc||!actor||!position)return actor;
 const next={...position};delete actor.underPier;
 if(next.underPier&&(actorHeight(doc,next)>=height(doc,next.x,next.y)-.001||actorBlocked(doc,next.x,next.y,catalog,next)))delete next.underPier;
 Object.assign(actor,next);return actor;
}
