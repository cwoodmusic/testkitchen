import {drawSelection} from './selection-view.mjs?v=queues-stage-1';
import {drawTerrain} from './terrain-render.mjs?v=queues-stage-1';
import {mountPose} from './cliff-mount.mjs?v=queues-stage-1';
import {elevationView} from './elevation-view.mjs?v=queues-stage-1';
import {barrierRuns,drawBarrierRun,barrierPosts,drawPost} from './construction.mjs?v=queues-stage-1';
import {TILE,RISE,COLS,ROWS,cell,height,segment} from './model.mjs?v=queues-stage-1';
import {catalog} from './catalog.mjs?v=queues-stage-1';
import {assetMapImage,assetMapImageRevision} from './asset-lawn.mjs?v=queues-stage-1';
import {overviewObjectImage} from './overview-sprites.mjs?v=queues-stage-1';
import {renderCityNight} from './city-night.mjs?v=queues-stage-1';
import {setWaterTime} from './water-motion.mjs?v=queues-stage-1';
import {drawFountainMotion} from './fountain-motion.mjs?v=queues-stage-1';
import {buildingDepthSlices,physicalObjectDepth,scenePartDepth} from './actor-depth.mjs?v=queues-stage-1';
import {scenePartitionCache} from './scene-partition.mjs?v=queues-stage-1';
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
export function drawObject(c,o,d,collision=false,alpha=1,time=0,fragment=null,prepared=null){
 const a=catalog.get(o.asset);if(!a)return;const pose=mountPose(d,o);if(!pose)return;
 c.save();c.globalAlpha=alpha;
 if(fragment?.x0!==undefined){
  const t=c.getTransform();c.beginPath();
  if(Math.abs(t.b)<1e-9&&Math.abs(t.c)<1e-9&&t.a>0){
   // Adjacent strips share one device-pixel edge, so their clips cannot
   // introduce a translucent seam when the camera stops between pixels.
   const left=Math.round(fragment.x0*t.a+t.e),right=Math.round(fragment.x1*t.a+t.e);
   c.setTransform(1,0,0,1,0,0);c.rect(left,0,right-left,c.canvas.height);c.clip();c.setTransform(t);
  }else{c.rect(fragment.x0,-65536,fragment.x1-fragment.x0,131072);c.clip();}
 }
 c.translate(pose.x,pose.y);c.rotate(o.rotation*Math.PI/180);c.scale(o.scale,o.scale);
 const image=prepared?.image||assetMapImage(a,o,d),display=prepared?.display||overviewObjectImage(c,a,image);
 if(prepared){prepared.image=image;prepared.display=display;}
 const index=fragment?.outline?a.sceneParts?.indexOf(fragment):-1,isCompositeLayer=!!fragment?.base||index>=0;
 if(isCompositeLayer){
  const partition=prepared?.partition||scenePartitionCache.partition(a,display,assetMapImageRevision(image),a.sceneParts.map(p=>scenePartDepth(a,o,p)));
  if(prepared)prepared.partition=partition;
  const layer=fragment.base?{canvas:partition.base,x:0,y:0,w:display.width,h:display.height}:partition.parts[index],fx=a.w/display.width,fy=a.h/display.height;
  if(layer.w&&layer.h)c.drawImage(layer.canvas,layer.x*fx-a.w/2,layer.y*fy-a.h*pose.offset,layer.w*fx,layer.h*fy);
 }else{
  if(fragment?.outline){c.beginPath();fragment.outline.forEach(([x,y],i)=>{if(i)c.lineTo(x-a.w/2,y-a.h*pose.offset);else c.moveTo(x-a.w/2,y-a.h*pose.offset);});c.closePath();c.clip();}
  c.drawImage(display,-a.w/2,-a.h*pose.offset,a.w,a.h);
 }
 if(!fragment||fragment.animate){
  c.save();
  if(fragment?.outline){c.beginPath();fragment.outline.forEach(([x,y],i)=>{if(i)c.lineTo(x-a.w/2,y-a.h*pose.offset);else c.moveTo(x-a.w/2,y-a.h*pose.offset);});c.closePath();c.clip();}
  c.translate(-a.w/2,-a.h*pose.offset);drawFountainMotion(c,a,image,time);c.restore();
 }
 if(collision&&o.collision)drawCollisionLocal(c,a);
 c.restore();
}
function drawCollisionLocal(c,a){
 c.fillStyle='#f5616260';c.strokeStyle='#ff9c8b';
 for(const p of a.polygons||[]){c.beginPath();c.moveTo(p[0][0]-a.w/2,p[0][1]-a.h);for(const[x,y]of p)c.lineTo(x-a.w/2,y-a.h);c.closePath();c.fill();c.stroke();}
 for(const b of a.boxes){c.fillRect(b.x-a.w/2,b.y-a.h,b.w,b.h);c.strokeRect(b.x-a.w/2,b.y-a.h,b.w,b.h);}
}
export function drawObjectCollision(c,o,d){
 const a=catalog.get(o.asset),pose=mountPose(d,o);if(!a||!pose||!o.collision)return;
 c.save();c.translate(pose.x,pose.y);c.rotate(o.rotation*Math.PI/180);c.scale(o.scale,o.scale);drawCollisionLocal(c,a);c.restore();
}
function composite(a,o){return !o.mount&&a.sceneParts?.length;}
function depthSorted(a,o){return o.mount||o.layer==='objects'||a.depthSorted||a.frontAtX;}
export function render(c,d,cam,w,h,opts={}){setWaterTime(opts.time||0);const screenTransform=c.getTransform();c.clearRect(0,0,w,h);c.fillStyle='#101f19';c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.scale(cam.zoom,cam.zoom);c.translate(-cam.x,-cam.y);const left=cam.x-w/2/cam.zoom,top=cam.y-h/2/cam.zoom;const x0=Math.max(0,Math.floor(left/64)-1),x1=Math.min(COLS,Math.ceil((left+w/cam.zoom)/64)+1),y0=Math.max(0,Math.floor(top/64)-1),y1=Math.min(ROWS,Math.ceil((top+h/cam.zoom+RISE*9)/64)+1);if(opts.heightView==='plan'){elevationView(c,d,cam,w,h,opts);c.restore();return;}drawTerrain(c,d,{x0,x1,y0,y1},opts);if(opts.drawFootprints)opts.drawFootprints(c,d,opts.time||0);
 const visible=d.objects.filter(o=>{const a=catalog.get(o.asset);if(!a)return false;const r=Math.max(a.w,a.h)*o.scale,pose=mountPose(d,o);return pose&&pose.x+r>left&&pose.x-r<left+w/cam.zoom&&pose.y+r>top&&pose.y-r<top+h/cam.zoom;});
 const prepared=new Map();
 const drawPlaced=(o,collision=false,fragment=null)=>{let image=prepared.get(o);if(!image){image={};prepared.set(o,image);}drawObject(c,o,d,collision,1,opts.time||0,fragment,image);};
 // Composite scenes retain their complete native ground artwork. Only their
 // raised silhouettes return to the depth queue; paving is never repainted on
 // top of a pedestrian.
 for(const o of visible){const a=catalog.get(o.asset);if(composite(a,o))drawPlaced(o,false,{base:true});else if(!o.mount&&o.layer==='ground'&&!depthSorted(a,o))drawPlaced(o);}
 const queue=[];
 for(const o of visible){
  const a=catalog.get(o.asset);
  if(composite(a,o)){
   for(const part of a.sceneParts)queue.push({y:scenePartDepth(a,o,part),draw:()=>drawPlaced(o,false,part)});
  }else if(depthSorted(a,o)){
   const slices=buildingDepthSlices(a,o);
   if(slices)for(const part of slices)queue.push({y:part.depth,draw:()=>drawPlaced(o,false,slices.length===1?null:part)});
   else queue.push({y:physicalObjectDepth(a,o,mountPose(d,o).depth),draw:()=>drawPlaced(o)});
  }
 }
 for(const run of barrierRuns(d))queue.push({y:run.axis==='h'?run.s.y:run.s.y+run.end-run.start,draw:()=>drawBarrierRun(c,run)});
 for(const p of barrierPosts(d))queue.push({y:p.y+.1,draw:()=>drawPost(c,p,d)});
 for(const npc of opts.npcs||[])if(opts.drawNPC&&Number.isFinite(npc.x)&&Number.isFinite(npc.y))queue.push({y:npc.depth??npc.y,draw:()=>opts.drawNPC(c,{...npc,y:npc.y-height(d,npc.groundAnchor?.x??npc.x,npc.groundAnchor?.y??npc.y)},opts.time||0)});
 if(opts.player)queue.push({y:opts.player.y,draw:()=>{const p=opts.player,z=height(d,p.x,p.y);if(opts.drawPlayer)opts.drawPlayer(c,p.x,p.y-z);else{c.fillStyle='#1a251a66';c.beginPath();c.ellipse(p.x,p.y-z,16,7,0,0,7);c.fill();}}});
 queue.sort((a,b)=>a.y-b.y).forEach(a=>a.draw());
 for(const o of visible){const a=catalog.get(o.asset);if(!o.mount&&o.layer==='overgrowth'&&!depthSorted(a,o)&&!composite(a,o))drawPlaced(o);}
 if(opts.collision)for(const o of visible)drawObjectCollision(c,o,d);
 if(opts.night&&(!opts.heightView||opts.heightView==='art')){c.save();c.setTransform(screenTransform);renderCityNight(c,d,cam,w,h,opts.time||0,{catalog,objects:visible});c.restore();}
 if(opts.heightView==='colors')elevationView(c,d,cam,w,h,opts);
 if(opts.region)drawSelection(c,d,opts.region,{zoom:cam.zoom,bounds:{x0,x1,y0,y1}});
 if(opts.selected){const o=opts.selected,a=catalog.get(o.asset),pose=mountPose(d,o);if(pose){c.save();c.translate(pose.x,pose.y);c.rotate(o.rotation*Math.PI/180);c.scale(o.scale,o.scale);c.strokeStyle='#f6d77d';c.lineWidth=3/(cam.zoom*o.scale);c.strokeRect(-a.w/2,-a.h*pose.offset,a.w,a.h);c.restore();}}if(opts.ghost)drawObject(c,opts.ghost,d,false,.55,opts.time||0);if(opts.hover){c.strokeStyle='#f1da8b';c.lineWidth=2/cam.zoom;c.strokeRect(opts.hover.x*64,opts.hover.y*64-cell(d,opts.hover.x,opts.hover.y).level*RISE,64,64);}if(opts.brush)drawBrush(c,d,opts.brush,cam.zoom);c.restore();}
