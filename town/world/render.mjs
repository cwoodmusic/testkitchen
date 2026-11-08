import {drawSelection} from './selection-view.mjs?v=music-walls-1';
import {drawTerrain} from './terrain-render.mjs?v=music-walls-1';
import {mountPose} from './cliff-mount.mjs?v=music-walls-1';
import {elevationView} from './elevation-view.mjs?v=music-walls-1';
import {barrierRuns,drawBarrierRun,barrierPosts,drawPost} from './construction.mjs?v=music-walls-1';
import {TILE,RISE,COLS,ROWS,cell,height,segment} from './model.mjs?v=music-walls-1';
import {catalog} from './catalog.mjs?v=music-walls-1';
import {assetImage} from './asset-color.mjs?v=music-walls-1';
import {renderCityNight} from './city-night.mjs?v=music-walls-1';
function drawBrush(c,d,brush,zoom){
 const radius=brush.size/2,color=brush.blend?'#b7eddf':'#ffe2a1';
 c.save();
 if(brush.shape==='square'){
  const width=Math.max(1,Math.round(brush.size/64)),left=Math.floor(brush.x/64)-Math.floor(width/2),top=Math.floor(brush.y/64)-Math.floor(width/2);
  c.lineWidth=1.5/zoom;c.strokeStyle=color;c.fillStyle='#ffe2a112';
  for(let y=top;y<top+width;y++)for(let x=left;x<left+width;x++){const z=cell(d,x,y).level*RISE;c.fillRect(x*64,y*64-z,64,64);c.strokeRect(x*64,y*64-z,64,64);}
  c.restore();return;
 }
 for(const scale of [1,brush.hardness]){
  if(scale<.03||scale>.99&&scale!==1)continue;
  const path=new Path2D();
  for(let i=0;i<=96;i++){const t=i/96*Math.PI*2,x=brush.x+Math.cos(t)*radius*scale,y=brush.y+Math.sin(t)*radius*scale,Y=y-height(d,x,y);if(i===0)path.moveTo(x,Y);else path.lineTo(x,Y);}
  path.closePath();c.setLineDash(scale===1?[]:[4/zoom,4/zoom]);
  c.strokeStyle='#14261dd9';c.lineWidth=3.5/zoom;c.stroke(path);c.strokeStyle=color;c.lineWidth=1.2/zoom;c.stroke(path);
 }
 c.restore();
}
export function drawObject(c,o,d,collision=false,alpha=1){const a=catalog.get(o.asset);if(!a)return;const pose=mountPose(d,o);if(!pose)return;c.save();c.globalAlpha=alpha;c.translate(pose.x,pose.y);c.rotate(o.rotation*Math.PI/180);c.scale(o.scale,o.scale);c.drawImage(assetImage(a),-a.w/2,-a.h*pose.offset);if(collision&&o.collision){c.fillStyle='#f5616260';c.strokeStyle='#ff9c8b';for(const p of a.polygons||[]){c.beginPath();c.moveTo(p[0][0]-a.w/2,p[0][1]-a.h);for(const[x,y]of p)c.lineTo(x-a.w/2,y-a.h);c.closePath();c.fill();c.stroke();}for(const b of a.boxes){c.fillRect(b.x-a.w/2,b.y-a.h,b.w,b.h);c.strokeRect(b.x-a.w/2,b.y-a.h,b.w,b.h);}}c.restore();}
function objectDepth(o,d,player){
 const a=catalog.get(o.asset),pose=mountPose(d,o);
 // Large irregular buildings contain transparent canvas below their facade.
 // Sort at the physical front in the actor's column, not that blank anchor.
 if(player&&a.frontAtX&&!o.rotation&&!o.mount){const front=a.frontAtX((player.x-o.x)/o.scale+a.w/2);if(front!==null)return o.y+(front-a.h)*o.scale;}
 return pose.depth;
}
export function render(c,d,cam,w,h,opts={}){const screenTransform=c.getTransform();c.clearRect(0,0,w,h);c.fillStyle='#101f19';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);const left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom;const x0=Math.max(0,Math.floor(left/64)-1),x1=Math.min(COLS,Math.ceil((left+w/cam.zoom)/64)+1),y0=Math.max(0,Math.floor(top/64)-1),y1=Math.min(ROWS,Math.ceil((top+h/cam.zoom+RISE*9)/64)+1);if(opts.heightView==='plan'){elevationView(c,d,cam,w,h,opts);c.restore();return;}drawTerrain(c,d,{x0,x1,y0,y1},opts);
 const visible=d.objects.filter(o=>{const a=catalog.get(o.asset);if(!a)return false;const r=Math.max(a.w,a.h)*o.scale,pose=mountPose(d,o);return pose&&pose.x+r>left&&pose.x-r<left+w/cam.zoom&&pose.y+r>top&&pose.y-r<top+h/cam.zoom;});
 for(const o of visible.filter(o=>!o.mount&&o.layer==='ground'))drawObject(c,o,d,opts.collision);
 const queue=visible.filter(o=>o.mount||o.layer==='objects').map(o=>({y:objectDepth(o,d,opts.player),draw:()=>drawObject(c,o,d,opts.collision)}));for(const run of barrierRuns(d))queue.push({y:run.axis==='h'?run.s.y:run.s.y+run.end-run.start,draw:()=>drawBarrierRun(c,run)});for(const p of barrierPosts(d))queue.push({y:p.y+.1,draw:()=>drawPost(c,p,d)});for(const npc of opts.npcs||[])if(opts.drawNPC&&Number.isFinite(npc.x)&&Number.isFinite(npc.y))queue.push({y:npc.y,draw:()=>opts.drawNPC(c,{...npc,y:npc.y-height(d,npc.x,npc.y)},opts.time||0)});if(opts.player)queue.push({y:opts.player.y,draw:()=>{const p=opts.player,z=height(d,p.x,p.y);if(opts.drawPlayer)opts.drawPlayer(c,p.x,p.y-z);else{c.fillStyle='#1a251a66';c.beginPath();c.ellipse(p.x,p.y-z,16,7,0,0,7);c.fill();}}});queue.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
 for(const o of visible.filter(o=>!o.mount&&o.layer==='overgrowth'))drawObject(c,o,d,opts.collision);
 if(opts.night&&(!opts.heightView||opts.heightView==='art')){c.save();c.setTransform(screenTransform);renderCityNight(c,d,cam,w,h,opts.time||0,{catalog,objects:visible});c.restore();}
 if(opts.heightView==='colors')elevationView(c,d,cam,w,h,opts);
 if(opts.region)drawSelection(c,d,opts.region,{zoom:cam.zoom,bounds:{x0,x1,y0,y1}});
 if(opts.selected){const o=opts.selected,a=catalog.get(o.asset),pose=mountPose(d,o);if(pose){c.save();c.translate(pose.x,pose.y);c.rotate(o.rotation*Math.PI/180);c.scale(o.scale,o.scale);c.strokeStyle='#f6d77d';c.lineWidth=3/(cam.zoom*o.scale);c.strokeRect(-a.w/2,-a.h*pose.offset,a.w,a.h);c.restore();}}if(opts.ghost)drawObject(c,opts.ghost,d,false,.55);if(opts.hover){c.strokeStyle='#f1da8b';c.lineWidth=2/cam.zoom;c.strokeRect(opts.hover.x*64,opts.hover.y*64-cell(d,opts.hover.x,opts.hover.y).level*RISE,64,64);}if(opts.brush)drawBrush(c,d,opts.brush,cam.zoom);c.restore();}
