/** Reading time stays separate from doorway movement and the authored timeline. */
export function createRoomPreface({text,playing=true}={}){
 if(typeof text!=='string'||!text.trim())throw new TypeError('A room preface needs narration text.');
 const narration=text.trim();let elapsed=0,active=!!playing,finished=false,cached=null;
 const invalidate=()=>{cached=null;};
 function snapshot(){return cached??=Object.freeze({text:narration,elapsed,playing:active,finished});}
 function update(deltaMs){
  if(!active||finished||typeof deltaMs!=='number'||!Number.isFinite(deltaMs)||deltaMs<=0)return false;
  // A late frame or a resumed background tab must not reveal a whole page.
  elapsed+=Math.min(100,deltaMs);invalidate();return true;
 }
 function pause(){if(!active)return false;active=false;invalidate();return true;}
 function play(){if(finished||active)return false;active=true;invalidate();return true;}
 function finish(){if(finished)return false;finished=true;active=false;invalidate();return true;}
 function restart(){elapsed=0;active=true;finished=false;invalidate();return true;}
 return Object.freeze({get state(){return snapshot();},update,pause,play,finish,restart});
}
