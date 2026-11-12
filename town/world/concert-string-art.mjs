// Local character units: the stage renderer supplies its existing 2.5x scale.
// Front-facing musicians hold the instrument on their own left (screen right).
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const point=(x,y)=>({x,y});
const at=(p,v,d)=>point(p.x+v.x*d,p.y+v.y*d);

/** The bridge stays under the bow throughout a stroke; only the bow slides. */
export function violinPlayingGeometry(actor={},beat=0){
 const offset=actor.seated?8:0,stroke=Math.sin(finite(beat)+finite(actor.phase))*5;
 const bridge=point(17,-24+offset),bowAxis=point(.34,.94);
 return {
  offset,stroke,chin:point(8,-27+offset),chinRest:point(9,-26+offset),
  leftShoulder:point(10,-23+offset),leftElbow:point(16,-12+offset),leftHand:point(30,-28+offset),
  rightShoulder:point(-11,-23+offset),rightElbow:point(-8+stroke*.25,-12+offset),
  bridge,bowAxis,bowTip:at(bridge,bowAxis,-18+stroke),bowGrip:at(bridge,bowAxis,11+stroke),
  neckStart:point(21,-26+offset),scroll:point(38,-32+offset)
 };
}
function pixel(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);}
function line(c,a,b,color,width=1){
 const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.x-a.x),Math.abs(b.y-a.y))));
 for(let i=0;i<=steps;i++){const t=i/steps;pixel(c,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,width,width,color);}
}
function arm(c,shoulder,elbow,hand,shirt,skin){
 line(c,shoulder,elbow,'#20232d',5);line(c,shoulder,elbow,shirt,4);
 line(c,elbow,hand,'#342d30',4);line(c,elbow,hand,skin,3);
}

/** Native bodies omit their neutral lap arms only for this instrument pose. */
export function drawViolinPlayingPose(c,actor={},beat=0){
 const g=violinPlayingGeometry(actor,beat),o=g.offset,appearance=actor.appearance||{},skin=appearance.skin||'#d6a37c',shirt=appearance.shirt||'#292c38';
 const viola=actor.instrument==='viola',wood=viola?'#a5683f':'#c38143',light=viola?'#d09b62':'#e9b56c',dark='#59372a';
 // Bent elbows connect both hands to the actual shoulders. The left forearm
 // supports the neck from below instead of leaving a floating hand beside it.
 arm(c,g.leftShoulder,g.leftElbow,g.leftHand,shirt,skin);
 arm(c,g.rightShoulder,g.rightElbow,g.bowGrip,shirt,skin);
 // A stepped, nearly horizontal body rests below the jaw. Two distinct bouts
 // and a narrow waist keep this readable as a violin rather than a tiny cello.
 for(const [x,y,w,h,color]of [
  [0,-27,7,8,dark],[-2,-25,11,5,dark],[1,-28,5,10,wood],[-1,-24,9,5,wood],
  [6,-27,6,5,dark],[7,-26,5,3,wood],
  [11,-29,7,7,dark],[10,-27,10,4,dark],[12,-28,5,6,wood],[11,-26,8,3,wood],
  [2,-26,2,6,light],[13,-27,2,3,light],
  [1,-27,4,2,'#302b2b'],[2,-27,2,1,'#625047']
 ])pixel(c,x+6,y+o,w,h,color);
 line(c,g.neckStart,g.scroll,dark,3);line(c,at(g.neckStart,point(1,0),1),point(37,-31+o),'#b47b47',2);
 pixel(c,36,-34+o,5,5,dark);pixel(c,37,-33+o,3,3,light);
 pixel(c,32,-31+o,2,1,'#d2b47b');pixel(c,35,-35+o,2,2,dark);
 // Fingerboard and strings run from the tailpiece over the bridge to the neck.
 line(c,point(11,-23+o),point(35,-31+o),'#302c2b',2);
 line(c,point(11,-24+o),point(35,-32+o),'#ecdbab');
 pixel(c,15,-26+o,2,5,light);pixel(c,11,-22+o,2,2,dark);pixel(c,20,-24+o,2,2,dark);
 // Left fingertips curl over the neck while the thumb remains beneath it.
 pixel(c,g.leftHand.x-1,g.leftHand.y-1,4,3,skin);pixel(c,g.leftHand.x,g.leftHand.y-2,1,2,'#f0ceb0');pixel(c,g.leftHand.x+2,g.leftHand.y-2,1,2,skin);
 // The bow is transverse to the strings, and the right hand always grips its
 // frog. Sliding along this same axis keeps the hair touching the bridge.
 line(c,g.bowTip,g.bowGrip,'#573a2e',2);
 line(c,point(g.bowTip.x-1,g.bowTip.y+1),point(g.bowGrip.x-1,g.bowGrip.y+1),'#eee1bd');
 pixel(c,g.bowGrip.x-2,g.bowGrip.y-2,5,4,'#292b30');
 pixel(c,g.bowGrip.x-1,g.bowGrip.y-1,4,3,skin);pixel(c,g.bowGrip.x,g.bowGrip.y-1,2,1,'#edc5a4');
 return g;
}
