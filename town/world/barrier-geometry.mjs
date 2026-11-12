import {height,segment} from './model.mjs?v=room-defaults-curtain-1';
import {MUSIC_WALL_HEIGHT,MUSIC_WALL_WIDTH,MUSIC_WALL_SCALE,musicWallDonors} from './music-wall-art.mjs?v=room-defaults-curtain-1';

export const barrierHeight=style=>style==='music-square'?MUSIC_WALL_HEIGHT:style==='iron'?144:style==='wood'||style==='rail'?136:160;

export function deriveBarrierRuns(doc){
 const groups=new Map();
 for(const[key,e]of Object.entries(doc.edges)){
  const s=segment(key),axis=s.dx?'h':'v',z=height(doc,s.x+2,s.y+2),fixed=axis==='h'?s.y:s.x,t=axis==='h'?s.x:s.y,keyGroup=[axis,fixed,z,e.style,!!e.gate,!!e.open,e.wallScale||1].join(':');
  if(!groups.has(keyGroup))groups.set(keyGroup,[]);groups.get(keyGroup).push({s,e,t,z,axis});
 }
 const runs=[];
 for(const group of groups.values()){
  group.sort((a,b)=>a.t-b.t);let current;
  for(const part of group){
   const length=part.s.dx||part.s.dy;
   if(!current||part.t>current.end+.0001||part.e.gate){current={...part,start:part.t,end:part.t+length};runs.push(current);}
   else current.end=Math.max(current.end,part.t+length);
  }
 }
 return runs;
}

export function deriveBarrierPosts(doc,runs=deriveBarrierRuns(doc)){
 const nodes=new Map(),rounded=value=>Math.round(value*10000)/10000;
 function node(x,y,e){
  x=rounded(x);y=rounded(y);const key=`${x},${y}`;
  if(!nodes.has(key))nodes.set(key,{x,y,e,axes:new Set(),degree:0,gate:false});
  const p=nodes.get(key);if(e.style==='music-square')p.e=e;return p;
 }
 for(const[key,e]of Object.entries(doc.edges)){
  const s=segment(key),axis=s.dx?'h':'v';
  for(const[x,y]of [[s.x,s.y],[s.x+s.dx,s.y+s.dy]]){const p=node(x,y,e);p.axes.add(axis);p.degree++;p.gate||=e.gate;}
 }
 for(const run of runs)if(run.e.style==='music-square'&&!run.e.gate){
  const step=256*(run.e.wallScale||1);
  for(let t=run.start+step;t<run.end-.0001;t+=step){const p=node(run.axis==='h'?t:run.s.x,run.axis==='v'?t:run.s.y,run.e);p.periodic=true;p.axes.add(run.axis);}
 }
 return [...nodes.values()].filter(p=>p.periodic||p.degree!==2||p.axes.size>1||p.gate||p.e.style!=='music-square'&&(p.axes.has('h')&&p.x%256===0||p.axes.has('v')&&p.y%256===0));
}

// Bounds include the pictured face, cap and cast shadow in projected world
// coordinates. A high wall/pillar can be visible while its ground anchor is
// below the viewport; an open Music Square gate draws only its separate posts.
export function barrierRunBounds(run){
 const {s,e,z=0,axis,start,end}=run,length=end-start,X=s.x,Y=s.y-z,h=barrierHeight(e.style);
 if(length<=0)return null;
 if(e.style==='music-square'){
  if(e.open)return null;
  const scale=Number.isFinite(e.wallScale)?e.wallScale:1;
  if(axis==='h')return {x:X,y:Y-h*scale,w:length,h:(h+7)*scale};
  const left=Math.min((musicWallDonors.vertical.x-48)*MUSIC_WALL_SCALE,-MUSIC_WALL_WIDTH/2,-18),right=Math.max((musicWallDonors.vertical.x-48)*MUSIC_WALL_SCALE+MUSIC_WALL_WIDTH,MUSIC_WALL_WIDTH/2+5,18);
  return {x:X+left*scale,y:Y,w:(right-left)*scale,h:length};
 }
 if(e.open)return {x:X-21,y:Y-h-12,w:42,h:h+12};
 if(axis==='h')return {x:X,y:Y-h,w:length+12,h:h+13};
 const masonry=['limestone','brick','plaster'].includes(e.style),left=masonry?-23:-32,right=masonry?23:22;
 return {x:X+left,y:Y-h,w:right-left,h:length+h+10};
}

export function barrierPostBounds(post,doc){
 const z=Number.isFinite(post.z)?post.z:height(doc,post.x+2,post.y+2),Y=post.y-z;
 if(post.e.style==='music-square'){
  const scale=post.wallScale??post.e.wallScale??1,r=musicWallDonors.post;
  // Include either the native stone pilaster or the iron gate-post donor.
  const left=(r.x-r.anchorX)*MUSIC_WALL_SCALE,right=(r.x+r.w-r.anchorX)*MUSIC_WALL_SCALE,top=(r.y-r.anchorY)*MUSIC_WALL_SCALE,bottom=(r.y+r.h-r.anchorY)*MUSIC_WALL_SCALE;
  const x0=post.gate?Math.min(left,-14):left,x1=post.gate?Math.max(right,14):right,y0=post.gate?Math.min(top,-MUSIC_WALL_HEIGHT-24):top,y1=post.gate?Math.max(bottom,8):bottom;
  return {x:post.x+x0*scale,y:Y+y0*scale,w:(x1-x0)*scale,h:(y1-y0)*scale};
 }
 const h=barrierHeight(post.e.style)+18,w=post.gate?28:['wood','rail'].includes(post.e.style)?44:64;
 return {x:post.x-w/2,y:Y-h,w,h:h+8};
}

export function createBarrierGeometryCache(){
 const documents=new WeakMap();
 return function geometry(doc,{revision}={}){
  const hinted=Number.isFinite(revision),old=documents.get(doc);
  if(hinted&&old&&old.revision===revision&&old.edges===doc.edges&&old.cells===doc.cells)return old.geometry;
  const runs=deriveBarrierRuns(doc),posts=deriveBarrierPosts(doc,runs);
  for(const post of posts)post.z=height(doc,post.x+2,post.y+2);
  const result={runs,posts,runItems:runs.map(run=>({run,bounds:barrierRunBounds(run)})),postItems:posts.map(post=>({post,bounds:barrierPostBounds(post,doc)}))};
  // Generic callers may mutate edges, gate state or terrain directly. Without
  // an authoritative revision they rebuild rather than hashing every frame.
  if(hinted)documents.set(doc,{revision,edges:doc.edges,cells:doc.cells,geometry:result});
  else documents.delete(doc);
  return result;
 };
}

export const barrierGeometry=createBarrierGeometryCache();
export function barrierRuns(doc,options={}){return Number.isFinite(options.revision)?barrierGeometry(doc,options).runs:deriveBarrierRuns(doc);}
export function barrierPosts(doc,runsOrOptions,options={}){
 if(Array.isArray(runsOrOptions))return deriveBarrierPosts(doc,runsOrOptions);
 const opts=runsOrOptions||options;return Number.isFinite(opts.revision)?barrierGeometry(doc,opts).posts:deriveBarrierPosts(doc);
}
