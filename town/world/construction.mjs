import {cell,height,segment,RISE,stairProfile} from './model.mjs?v=terrain-kit-1';
import {wallArt,constructionArt,stairArt,stairTreadBounds,cliffArt} from './detail-art.mjs?v=terrain-kit-1';
export const barrierHeight=style=>style==='iron'?144:style==='wood'||style==='rail'?136:160;
function piece(c,img,sx,sy,sw,sh,x,y,w,h){if(sw>0&&sh>0&&w>0&&h>0)c.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
// Clip one continuous rock field to the heights on BOTH sides of an edge.
// The southern side can be a slope, so a midpoint rectangle leaves gaps.
function drawSlopedCliff(c,d,x,y){
 const X=x*64,edge=(y+1)*64,img=cliffArt,parts=[];
 let highest=-Infinity,lowest=Infinity;
 for(let i=0;i<16;i++){
  let left=i*4,right=left+4,top0=height(d,X+left+.001,edge-.001),top1=height(d,X+right-.001,edge-.001),base0=height(d,X+left+.001,edge+.001),base1=height(d,X+right-.001,edge+.001);
  const gap0=top0-base0,gap1=top1-base1;if(Math.max(gap0,gap1)<=.01)continue;
  if(gap0<0){const t=-gap0/(gap1-gap0);left+=(right-left)*t;top0+=(top1-top0)*t;base0=top0;}
  if(gap1<0){const t=gap0/(gap0-gap1);right=left+(right-left)*t;top1=top0+(top1-top0)*t;base1=top1;}
  parts.push({left,right,top0,top1,base0,base1});highest=Math.max(highest,top0,top1);lowest=Math.min(lowest,base0,base1);
 }
 if(!parts.length)return;
 c.save();c.beginPath();for(const p of parts){c.moveTo(X+p.left,edge-p.top0);c.lineTo(X+p.right,edge-p.top1);c.lineTo(X+p.right,edge-p.base1);c.lineTo(X+p.left,edge-p.base0);c.closePath();}c.clip();
 const top=edge-highest,depth=highest-lowest,sx=img.width*.06+(X%384)/384*img.width*.88,sw=img.width*.88*64/384;
 c.fillStyle='#655a3e';c.fillRect(X,top,64,depth);
 for(let j=0;j<depth;j+=176){const h=Math.min(176,depth-j);c.drawImage(img,sx,img.height*.18,sw,img.height*.78*h/176,X,top+j,64,h);}
 const shade=c.createLinearGradient(0,top,0,top+depth);shade.addColorStop(0,'#24311e66');shade.addColorStop(.35,'#17221900');shade.addColorStop(1,'#16211788');c.fillStyle=shade;c.fillRect(X,top,64,depth);c.restore();
 // Grass belongs on terrain lips, not between adjacent stair lanes.
 if(!cell(d,x,y).stairs)for(const p of parts){const w=p.right-p.left;if(w<=.01)continue;c.save();c.transform(1,(p.top0-p.top1)/w,0,1,X+p.left,edge-p.top0);const sx=img.width*.06+((X+p.left)%384)/384*img.width*.88;c.drawImage(img,sx,0,img.width*.88*w/384,img.height*.28,0,-12,w,38);c.restore();}
}
// All cells along a face sample one world-anchored rock field. Grass crowns
// overlap the lawn by a few pixels; source rock is never stamped as oval decals.
export function drawCliff(c,d,x,y){const a=cell(d,x,y),b=cell(d,x,y+1);if(a.stairs||a.curves?.length||b.stairs||b.curves?.length){drawSlopedCliff(c,d,x,y);return;}const X=x*64,Y=y*64,z=a.level*RISE,south=height(d,X+32,Y+64+.001);if(a.stairs||z<=south+.01)return;const top=Y+64-z,depth=z-south,img=cliffArt,period=384;
 c.fillStyle='#555b3e';c.fillRect(X,top,64,depth);
 const sx=img.width*.06+(X%period)/period*img.width*.88,sw=img.width*.88*64/period;
 for(let j=0;j<depth;j+=176){const dh=Math.min(176,depth-j);piece(c,img,sx,img.height*.18,sw,img.height*.78*dh/176,X,top+j,64,dh);}
 // Top grass is actual painted cliff foliage, overlaid across the lawn seam.
 piece(c,img,sx,0,sw,img.height*.28,X,top-12,64,38);
 const shade=c.createLinearGradient(0,top,0,top+depth);shade.addColorStop(0,'#24311e66');shade.addColorStop(.35,'#17221900');shade.addColorStop(1,'#16211788');c.fillStyle=shade;c.fillRect(X,top+13,64,Math.max(0,depth-13));
 c.fillStyle='#17271c22';c.fillRect(X,top+depth,64,5);
}
const flatStairs=new Map();
export function drawStairs(c,d,x,y){const a=cell(d,x,y);if(!a.stairs)return;const q=stairProfile(a),vertical=['north','south'].includes(a.stairs),X=x*64,Y=y*64;
 const same=(xx,yy)=>{const b=cell(d,xx,yy),p=stairProfile(b);return b.stairs===a.stairs&&Math.abs(p.base-q.base)<1e-8&&Math.abs(p.rise-q.rise)<1e-8&&p.start===q.start&&p.end===q.end&&(b.finish||'stone')===(a.finish||'stone');};let start=vertical?x:y,end=start;
 while(start>0&&same(vertical?start-1:x,vertical?y:start-1))start--;
 while(end<(vertical?255:191)&&same(vertical?end+1:x,vertical?y:end+1))end++;
 const span=end-start+1,part=(vertical?x:y)-start,rawPhase=(vertical?y:x)%2,phase=['east','south'].includes(a.stairs)?1-rawPhase:rawPhase,k=[a.finish,a.stairs,span,part,phase].join(':');
 if(!flatStairs.has(k)){
  const tile=document.createElement('canvas');tile.width=tile.height=64;const g=tile.getContext('2d'),image=stairArt[a.finish]||stairArt.stone;
  // Every direction uses the opaque tread interior. Perspective edges leave
  // diagonal holes between rotated E/W lanes and make N/S flights taper.
  // Reverse the sampled lane when rotating west, so wide treads stay joined.
  const sample=stairTreadBounds(image),lane=a.stairs==='west'?span-1-part:part;
  g.imageSmoothingEnabled=false;g.save();if(a.stairs==='east'){g.translate(64,0);g.rotate(Math.PI/2);}if(a.stairs==='west'){g.translate(0,64);g.rotate(-Math.PI/2);}if(a.stairs==='south'){g.translate(0,64);g.scale(1,-1);}
  g.drawImage(image,sample.x+sample.w*lane/span,sample.y+sample.h*phase/2,sample.w/span,sample.h/2,0,0,64,64);g.restore();flatStairs.set(k,tile);
 }
 const tile=flatStairs.get(k),zAt=(fx,fy)=>{const t={north:1-fy,south:fy,east:fx,west:1-fx}[a.stairs];return (q.base+q.rise*Math.max(0,Math.min(1,(t-q.start)/(q.end-q.start))))*RISE;};
 // Project the actual walking surface, including partial first/last landings.
 // Thin affine strips keep the treads joined over any rise and all four axes.
 for(let i=0;i<8;i++){const n=i*8,z0=zAt(vertical?.5:n/64,vertical?n/64:.5),z1=zAt(vertical?.5:(n+8)/64,vertical?(n+8)/64:.5);c.save();if(vertical){c.transform(1,0,0,1-(z1-z0)/8,X,Y+n-z0);c.drawImage(tile,0,n,64,8,0,0,64,8);}else{c.transform(1,-(z1-z0)/8,0,1,X+n,Y-z0);c.drawImage(tile,n,0,8,64,0,0,8,64);}c.restore();}
}
export function barrierRuns(d){const groups=new Map();for(const[k,e]of Object.entries(d.edges)){const s=segment(k),axis=s.dx?'h':'v',z=height(d,s.x+2,s.y+2),fixed=axis==='h'?s.y:s.x,t=axis==='h'?s.x:s.y,g=[axis,fixed,z,e.style,!!e.gate,!!e.open].join(':');if(!groups.has(g))groups.set(g,[]);groups.get(g).push({s,e,t,z,axis});}const runs=[];for(const group of groups.values()){group.sort((a,b)=>a.t-b.t);let current;for(const p of group){if(!current||p.t!==current.end||p.e.gate){current={...p,start:p.t,end:p.t+64};runs.push(current);}else current.end+=64;}}return runs;}
export function drawBarrierRun(c,run){const {s,e,z,axis,start,end}=run,h=barrierHeight(e.style),length=end-start,img=wallArt[e.style]||wallArt.wood,X=s.x,Y=s.y-z;c.save();c.translate(X,Y);
 if(e.open){c.globalAlpha=.95;const ph=h+12;piece(c,img,0,0,img.width*.23,img.height,-21,-ph,42,ph);c.restore();return;}
 c.fillStyle='#15221d38';if(axis==='h')c.fillRect(0,0,length+12,13);else c.fillRect(-18,-h,length?40:0,length+h+10);
 if(axis==='h'){
   for(let p=0;p<length;p+=256){const w=Math.min(256,length-p);if(e.style==='rail'){for(const y of [-h+30,-48])piece(c,img,img.width*.25,img.height*.45,img.width*.5,img.height*.16,p,y,w,22);}else piece(c,img,img.width*.235,img.height*.16,img.width*.53,img.height*.77,p,-h,w,h);}
 }else{
   const v=constructionArt[{limestone:4,brick:5,plaster:6}[e.style]];
   if(v){for(let p=0;p<length;p+=256){const n=Math.min(256,length-p);piece(c,v,v.width*.27,v.height*.24,v.width*.46,v.height*.5,-23,p-h,46,n);}}
   else{c.save();c.translate(-14,-h);c.rotate(Math.PI/2);for(let p=0;p<length;p+=256)piece(c,img,img.width*.235,img.height*.2,img.width*.53,img.height*.65,p,-18,Math.min(256,length-p),36);c.restore();}
 }
 if(e.gate&&axis==='h')piece(c,constructionArt[7],constructionArt[7].width*.23,0,constructionArt[7].width*.54,constructionArt[7].height,0,-h,length,h);
 c.restore();}
export function barrierPosts(d){const nodes=new Map();for(const[k,e]of Object.entries(d.edges)){const s=segment(k),axis=s.dx?'h':'v';for(const [x,y]of [[s.x,s.y],[s.x+s.dx,s.y+s.dy]]){const k=`${x},${y}`;if(!nodes.has(k))nodes.set(k,{x,y,e,axes:new Set(),degree:0,gate:false});const p=nodes.get(k);p.axes.add(axis);p.degree++;p.gate||=e.gate;}}
 return [...nodes.values()].filter(p=>p.degree!==2||p.axes.size>1||p.axes.has('h')&&p.x%256===0||p.axes.has('v')&&p.y%256===0||p.gate);}
export function drawPost(c,p,d){const img=wallArt[p.e.style]||wallArt.wood,h=barrierHeight(p.e.style)+18,z=height(d,p.x+2,p.y+2),w=p.gate?28:p.e.style==='wood'||p.e.style==='rail'?44:64;piece(c,img,0,0,img.width*.23,img.height,p.x-w/2,p.y-z-h,w,h+8);}
