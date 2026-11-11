// Movable strings use the same native bronze ironwork and copper lanterns as
// the rest of town. Their only physical obstructions are the two pole feet.
export const festivalLightDefinitions=Object.freeze([
 {id:'festival-festoon-warm',name:'Festival lights · warm festoon',w:832,h:480,count:9,size:30,palette:[[255,215,151]]},
 {id:'festival-festoon-color',name:'Festival lights · colored festoon',w:832,h:480,count:11,size:30,palette:[[255,208,139],[98,223,235],[255,139,195],[255,220,146]]},
 {id:'festival-lantern-garland',name:'Festival lights · copper lantern garland',w:832,h:512,count:5,size:64,palette:[[255,213,139]]}
]);

const ends=Object.freeze([120,712]);
const sag=t=>34+84*4*t*(1-t);
export function festivalLightGeometry(def){
 const bulbs=Array.from({length:def.count},(_,i)=>{
  const t=(i+1)/(def.count+1),x=ends[0]+(ends[1]-ends[0])*t,y=sag(t)+8;
  return {x,y,size:def.size,color:def.palette[i%def.palette.length]};
 });
 return {posts:ends.map(x=>({x:x-36,y:def.h-40,w:72,h:40})),bulbs};
}

function cord(c){
 const draw=(offset,color,width)=>{
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();
  for(let i=0;i<=80;i++){
   const t=i/80,x=Math.round((ends[0]+(ends[1]-ends[0])*t)/2)*2,y=Math.round((sag(t)+offset)/2)*2;
   if(i)c.lineTo(x,y);else c.moveTo(x,y);
  }c.stroke();
 };
 draw(2,'#141f1ce0',4);draw(0,'#4c4234',2);draw(-1,'#a48c5b88',1);
}
function pole(c,asset,x,height){
 c.save();c.translate(x-asset.w*height/asset.h/2,0);c.scale(height/asset.h,height/asset.h);asset.draw(c);c.restore();
}
function hangingLantern(c,head,b){
 const height=b.size,width=height*64/84,left=b.x-width/2;
 c.strokeStyle='#443b2d';c.lineWidth=2;c.beginPath();c.moveTo(b.x,b.y-8);c.lineTo(b.x,b.y+3);c.stroke();
 c.drawImage(head,0,0,64,84,left,b.y,width,height);
 if(b.color[0]<200||b.color[2]>170){
  // A tint sits only on the native glass; the bronze roof and cage remain.
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=.54;
  c.fillStyle=`rgb(${b.color.join(',')})`;c.beginPath();c.ellipse(b.x,b.y+height*.52,width*.23,height*.22,0,0,Math.PI*2);c.fill();c.restore();
 }
}

const lamp=(u,v,radius=150,power=.72,color)=>({u,v,groundU:u,groundV:1,kind:'lamp',radius,power,...(color?{color}:{})});
const nativeFestivalEmitters=Object.freeze({
 'decor-13-01':[lamp(.095,.45,170,.72),lamp(.91,.45,170,.72)],
 'decor-13-03':[lamp(.105,.60,140,.62),lamp(.89,.60,140,.62)],
 'decor-13-05':[lamp(.07,.39,155,.75),lamp(.93,.39,155,.75)],
 'decor-13-06':[{u:.5,v:.46,kind:'window',radius:115,power:.68,color:[255,185,89]}],
 'decor-07-01':[lamp(.055,.48,135,.62),lamp(.945,.48,135,.62)],
 'decor-07-02':[lamp(.055,.47,135,.62),lamp(.945,.47,135,.62)],
 'decor-07-06':[lamp(.055,.35,145,.70)],
 'decor-07-08':[{u:.51,v:.42,kind:'window',radius:110,power:.58,color:[255,174,77]}]
});

function performanceDeck(c,wood){
 c.save();c.imageSmoothingEnabled=false;c.drawImage(wood,0,0,512,384,0,0,512,384);
 // An inset frame lies on the ground plane. The native grain stays visible
 // through its stain; there is no raised fascia, step, or collision edge.
 c.fillStyle='#63472e50';
 c.fillRect(0,0,512,12);c.fillRect(0,372,512,12);c.fillRect(0,12,12,360);c.fillRect(500,12,12,360);
 c.fillStyle='#49382888';c.fillRect(0,0,512,2);c.fillRect(0,382,512,2);c.fillRect(0,0,2,384);c.fillRect(510,0,2,384);
 c.fillStyle='#d0b07c66';c.fillRect(3,3,506,1);c.fillRect(3,3,1,378);
 c.fillStyle='#49362899';
 for(const x of [128,256,384]){c.fillRect(x,2,1,9);c.fillRect(x,373,1,9);}
 for(const y of [128,256]){c.fillRect(2,y,9,1);c.fillRect(501,y,9,1);}
 c.fillStyle='#d0bc8b';for(const x of [6,504])for(const y of [6,376]){c.fillRect(x,y,2,2);c.fillStyle='#493b2b';c.fillRect(x+1,y+1,1,1);c.fillStyle='#d0bc8b';}
 c.restore();
}

export async function registerFestivalLights(add,catalog){
 const post=catalog.get('decor-14-01'),lantern=catalog.get('decor-14-04');
 if(!post||!lantern)throw Error('Festival lights need the native bronze lamp artwork.');
 const[,,{groundTextures}]=await Promise.all([post.ensureFull?.(),lantern.ensureFull?.(),import('./ground-textures.mjs?v=town-polish-1')]);
 // Extract only the lantern roof/glass/cage. Its stake, leaves and ground base
 // are not part of a hanging fixture.
 const whole=document.createElement('canvas');whole.width=lantern.w;whole.height=lantern.h;lantern.draw(whole.getContext('2d'));
 const head=document.createElement('canvas');head.width=64;head.height=84;
 head.getContext('2d').drawImage(whole,24,0,64,84,0,0,64,84);
 for(const def of festivalLightDefinitions){
  const {posts,bulbs}=festivalLightGeometry(def);
  const a=add(def.id,def.name,'festival lighting',def.w,def.h,c=>{
   c.save();c.imageSmoothingEnabled=false;cord(c);
   for(const b of bulbs)hangingLantern(c,head,b);
   for(const x of ends)pole(c,post,x,def.h);
   c.restore();
  },posts,'objects');
  a.kit='urban';a.facing='south';a.collisionDefault=true;a.pack='town-decor-256';
  a.lightEmitters=[...ends.map(x=>lamp(x/def.w,.22,230,.86)),...bulbs.map(b=>lamp(b.x/def.w,(b.y+b.size*.53)/def.h,def.size>40?160:135,.70,b.color))];
 }
 const deck=add('festival-performance-deck','Festival performance deck · flat timber patio','festival staging',512,384,c=>performanceDeck(c,groundTextures.wood),[],'ground');
 Object.assign(deck,{kit:'urban',facing:'south',collisionDefault:false,scene:true});
 for(const[id,emitters]of Object.entries(nativeFestivalEmitters)){
  const a=catalog.get(id);if(a&&!a.lightEmitters?.length)a.lightEmitters=emitters.map(e=>({...e}));
 }
}
