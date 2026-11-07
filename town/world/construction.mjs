import {cell,height,segment,RISE} from './model.mjs';
import {wallArt,constructionArt,stairArt,cliffArt} from './detail-art.mjs';
export const barrierHeight=style=>style==='iron'?144:style==='wood'||style==='rail'?136:160;
function piece(c,img,sx,sy,sw,sh,x,y,w,h){if(sw>0&&sh>0&&w>0&&h>0)c.drawImage(img,sx,sy,sw,sh,x,y,w,h);}
// All cells along a face sample one world-anchored rock field. Grass crowns
// overlap the lawn by a few pixels; source rock is never stamped as oval decals.
export function drawCliff(c,d,x,y){const a=cell(d,x,y),X=x*64,Y=y*64,z=a.level*RISE,south=cell(d,x,y+1).level*RISE;if(z<=south)return;const top=Y+64-z,depth=z-south,img=cliffArt,period=384;
 c.fillStyle='#555b3e';c.fillRect(X,top,64,depth);
 const sx=img.width*.06+(X%period)/period*img.width*.88,sw=img.width*.88*64/period;
 for(let j=0;j<depth;j+=176){const dh=Math.min(176,depth-j);piece(c,img,sx,img.height*.18,sw,img.height*.78*dh/176,X,top+j,64,dh);}
 // Top grass is actual painted cliff foliage, overlaid across the lawn seam.
 piece(c,img,sx,0,sw,img.height*.28,X,top-12,64,38);
 const shade=c.createLinearGradient(0,top,0,top+depth);shade.addColorStop(0,'#24311e66');shade.addColorStop(.35,'#17221900');shade.addColorStop(1,'#16211788');c.fillStyle=shade;c.fillRect(X,top+13,64,Math.max(0,depth-13));
 c.fillStyle='#17271c22';c.fillRect(X,top+depth,64,5);
}
export function drawStairs(c,d,x,y){const a=cell(d,x,y);if(!a.stairs)return;const image=stairArt[a.finish]||stairArt.stone,vertical=['north','south'].includes(a.stairs),X=x*64,Y=y*64,z=a.level*RISE;
 // Adjacent cells form one wide flight rather than separate little stair sprites.
 const same=(xx,yy)=>{const b=cell(d,xx,yy);return b.stairs===a.stairs&&b.level===a.level&&(b.finish||'stone')===(a.finish||'stone');};let start=vertical?x:y,end=start;
 while(start>0&&same(vertical?start-1:x,vertical?y:start-1))start--;
 while(end<(vertical?255:191)&&same(vertical?end+1:x,vertical?y:end+1))end++;
 const span=end-start+1,part=(vertical?x:y)-start;
 c.save();if(vertical){piece(c,image,image.width*part/span,0,image.width/span,image.height,X,Y-z-RISE,64,64+RISE);}else{c.translate(X+32,Y-z+32-RISE/2);c.rotate(a.stairs==='east'?Math.PI/2:-Math.PI/2);piece(c,image,image.width*part/span,0,image.width/span,image.height,-32,-56,64,112);}c.restore();
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
