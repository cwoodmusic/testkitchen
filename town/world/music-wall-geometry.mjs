// These are the physical baselines of the walls painted into Music Square.
// Keep the four entrance gaps open; snapping never invents a wall across one.
export const MUSIC_SQUARE_NATIVE_SIZE=Object.freeze({w:1536,h:1024});
export const MUSIC_SQUARE_WORLD_SIZE=Object.freeze({w:2400,h:1600});
const NATIVE_SCALE=2400/1536,STEP=64,MAP_W=256*STEP,MAP_H=192*STEP,EPS=.0001;
const nativeWall=(id,side,ax,ay,bx,by,width)=>Object.freeze({id,side,a:Object.freeze({x:ax,y:ay}),b:Object.freeze({x:bx,y:by}),width});
export const MUSIC_SQUARE_NATIVE_WALLS=Object.freeze([
 nativeWall('north-west','north',48,96,612,96,32),nativeWall('north-east','north',925,96,1488,96,32),
 nativeWall('south-west','south',48,992,584,992,32),nativeWall('south-east','south',947,992,1488,992,32),
 nativeWall('west-north','west',48,96,48,395,44),nativeWall('west-south','west',48,600,48,992,44),
 nativeWall('east-north','east',1488,96,1488,395,44),nativeWall('east-south','east',1488,600,1488,992,44)
]);
const nativeAnchors=[
 ['north-west-corner',48,96],['north-east-corner',1488,96],['south-west-corner',48,992],['south-east-corner',1488,992],
 ['north-west-gate',612,96],['north-east-gate',925,96],['south-west-gate',584,992],['south-east-gate',947,992],
 ['west-north-gate',48,395],['west-south-gate',48,600],['east-north-gate',1488,395],['east-south-gate',1488,600]
];
const round=n=>Math.round(n*10000)/10000;
const point=p=>({x:round(p.x),y:round(p.y)});
const validPoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inMap=p=>validPoint(p)&&p.x>=0&&p.y>=0&&p.x<=MAP_W&&p.y<=MAP_H;
const scaleOf=o=>Number.isFinite(o?.scale)&&o.scale>0?o.scale:1;
const squareKey=o=>o.id??['music-square',o.x,o.y,scaleOf(o),o.rotation||0].join(':');
const sameSquare=(a,b)=>a.squareKey&&a.squareKey===b.squareKey||a.objectId!=null&&a.objectId===b.objectId;
const sharesWall=(a,b)=>(a.wallIds||[a.wallId]).some(id=>id&&(b.wallIds||[b.wallId]).includes(id));
function rotate(p,angle){switch((angle%360+360)%360){case 90:return {x:-p.y,y:p.x};case 180:return {x:-p.x,y:-p.y};case 270:return {x:p.y,y:-p.x};default:return {...p};}}
export function musicSquarePoint(o,p){
 const s=scaleOf(o),v=rotate({x:(p.x*NATIVE_SCALE-1200)*s,y:(p.y*NATIVE_SCALE-1600)*s},o.rotation||0);
 return point({x:o.x+v.x,y:o.y+v.y});
}
export function musicSquareLocalPoint(o,p){
 const s=scaleOf(o),v=rotate({x:(p.x-o.x)/s,y:(p.y-o.y)/s},-(o.rotation||0));
 return point({x:(v.x+1200)/NATIVE_SCALE,y:(v.y+1600)/NATIVE_SCALE});
}
export function musicSquareWalls(o){return MUSIC_SQUARE_NATIVE_WALLS.map(w=>{
 const a=musicSquarePoint(o,w.a),b=musicSquarePoint(o,w.b),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),dx=round(Math.abs(b.x-a.x)),dy=round(Math.abs(b.y-a.y));
 return {id:w.id,side:w.side,a,b,x,y,dx,dy,axis:dx?'h':'v',width:w.width*scaleOf(o),objectId:o.id??null,wallScale:scaleOf(o)};
});}
export function musicSquareAnchors(o){return nativeAnchors.map(([id,x,y])=>{
 const wallIds=MUSIC_SQUARE_NATIVE_WALLS.filter(w=>[w.a,w.b].some(p=>p.x===x&&p.y===y)).map(w=>w.id);
 return {...musicSquarePoint(o,{x,y}),id,wallId:wallIds[0],wallIds,objectId:o.id??null,squareKey:squareKey(o),local:{x,y},anchor:true,baked:true,wallScale:scaleOf(o)};
});}
function projected(p,s){const length=s.dx*s.dx+s.dy*s.dy,t=length?Math.max(0,Math.min(1,((p.x-s.x)*s.dx+(p.y-s.y)*s.dy)/length)):0;return point({x:s.x+s.dx*t,y:s.y+s.dy*t});}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function nearestMusicWallAnchor(doc,p,{radius=64}={}){
 if(!validPoint(p))return null;let best=null;
 for(const o of doc.objects||[]){
  if(o.asset!=='music-square'||o.mount)continue;
  const ends=musicSquareAnchors(o),endRadius=Math.min(radius,32*scaleOf(o));
  const endpoint=ends.filter(a=>inMap(a)&&distance(a,p)<=endRadius).sort((a,b)=>distance(a,p)-distance(b,p))[0];
  if(endpoint){const d=distance(endpoint,p);if(!best||d<best.distance)best={...endpoint,distance:d};continue;}
  for(const wall of musicSquareWalls(o)){
   const a=projected(p,wall),d=distance(a,p);if(d>radius||!inMap(a)||best&&d>=best.distance)continue;
   best={...a,id:wall.id+'-wall',wallId:wall.id,wallIds:[wall.id],objectId:o.id??null,squareKey:squareKey(o),local:musicSquareLocalPoint(o,a),anchor:true,baked:true,wallScale:scaleOf(o),distance:d};
  }
 }
 return best;
}
// Existing extensions are attachment targets too, so a second drag retains
// the first drag's off-grid phase instead of snapping back to the terrain grid.
function existingMusicAnchor(doc,p,radius=32){
 let best=null;
 for(const[k,e]of Object.entries(doc.edges||{})){
  if(e.style!=='music-square')continue;
  const bits=k.split(':'),kind=bits[0];let s;
  if(kind==='w'&&bits.length===5)s={x:+bits[1],y:+bits[2],dx:+bits[3],dy:+bits[4]};
  else if(['h','v'].includes(kind)&&bits.length===3)s={x:+bits[1]*STEP,y:+bits[2]*STEP,dx:kind==='h'?STEP:0,dy:kind==='v'?STEP:0};
  if(!s||!Object.values(s).every(Number.isFinite))continue;
  const ends=[{x:s.x,y:s.y},{x:s.x+s.dx,y:s.y+s.dy}],end=ends.filter(a=>distance(a,p)<=radius).sort((a,b)=>distance(a,p)-distance(b,p))[0],a=end||projected(p,s),d=distance(a,p);
  if(d>radius||!inMap(a)||best&&d>=best.distance)continue;
  best={...point(a),anchor:true,baked:false,existingEdge:k,existingGate:!!e.gate,existingOpen:!!e.open,wallScale:e.wallScale||1,distance:d};
 }
 return best;
}
export function musicWallNode(doc,p,origin,{radius=96,existingRadius=32}={}){
 if(!validPoint(p))return null;
 const baked=nearestMusicWallAnchor(doc,p,{radius}),existing=existingMusicAnchor(doc,p,existingRadius),found=!baked?existing:!existing?baked:baked.distance<=existing.distance?baked:existing;
 if(found){
  if(origin?.baked&&found.baked&&sameSquare(origin,found)&&sharesWall(origin,found))return {...origin};
  return found;
 }
 const base=validPoint(origin)?origin:{x:0,y:0};
 return {x:round(Math.max(0,Math.min(MAP_W,base.x+Math.round((p.x-base.x)/STEP)*STEP))),y:round(Math.max(0,Math.min(MAP_H,base.y+Math.round((p.y-base.y)/STEP)*STEP))),wallScale:origin?.wallScale||1,anchor:false};
}
function wallKey(a,b){const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y);return ['w',x,y,dx,dy].map((n,i)=>i?n===0?'0':String(round(n)):n).join(':');}
export function planMusicWall(a,b,gate=false){
 if(!inMap(a)||!inMap(b)||distance(a,b)<EPS)return [];
 if(a.baked&&b.baked&&sameSquare(a,b)&&sharesWall(a,b))return [];
 if(a.existingEdge&&a.existingEdge===b.existingEdge&&a.existingGate===!!gate&&!a.existingOpen)return [];
 const edges=[],scale=a.anchor?a.wallScale:b.anchor?b.wallScale:a.wallScale||b.wallScale||1,wallScale=Number.isFinite(scale)?Math.max(.25,Math.min(3,scale)):1;
 const append=(from,to)=>{
  if(distance(from,to)<EPS)return;const horizontal=Math.abs(from.y-to.y)<EPS,fixed=horizontal?from.y:from.x,start=Math.min(horizontal?from.x:from.y,horizontal?to.x:to.y),end=Math.max(horizontal?from.x:from.y,horizontal?to.x:to.y);
  for(let at=start;at<end-EPS;at=round(at+STEP)){
   const next=Math.min(end,round(at+STEP)),p=point(horizontal?{x:at,y:fixed}:{x:fixed,y:at}),q=point(horizontal?{x:next,y:fixed}:{x:fixed,y:next});
   edges.push([wallKey(p,q),{style:'music-square',gate:!!gate,open:false,wallScale}]);
  }
 };
 const corner=point({x:b.x,y:a.y});append(a,corner);append(corner,b);return edges;
}
export function connectMusicWall(doc,a,b,{gate=false}={}){const edges=planMusicWall(a,b,gate);Object.assign(doc.edges,Object.fromEntries(edges));return edges.length;}
