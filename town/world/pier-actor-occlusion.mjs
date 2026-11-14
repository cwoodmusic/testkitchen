import {actorHeight,cell,RISE,TILE,COLS,ROWS,PIER_WALK_CLEARANCE} from './model.mjs?v=town-coast-pier-1';
import {pierGeometry} from './piers.mjs?v=town-coast-pier-1';
import {intersectsViewport} from './render-visibility.mjs?v=opera-parallax-1';

const buffers=new WeakMap();
const defaultCanvas=(w,h)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;};

// Native deck artwork and timber are opaque. An alpha mask needs their exact
// silhouette, without repainting wood textures, grain colors or wet gradients.
export function pierActorOcclusionRects(g,afterY=-Infinity){
 const rects=[{x:g.x,y:g.y,w:TILE,h:TILE+(g.joins.south?0:3)}];
 for(const p of g.supports){
  if(p.groundY<afterY)continue;
  rects.push({x:p.x,y:p.y,w:p.w,h:p.h},{x:p.x,y:p.y+12,w:p.w,h:5});
  // The final native grain strokes can extend a few pixels past the timber.
  if(p.h>9){const last=p.y+9+Math.floor((p.h-9-1e-7)/24)*24,bottom=p.y+p.h;
   for(const stroke of [{x:p.x+Math.round(p.w*.6),y:last,w:2,h:11,alpha:1},{x:p.x+7,y:last+3,w:1,h:8,alpha:1/3}]){const end=stroke.y+stroke.h,top=Math.max(stroke.y,bottom);if(end>top)rects.push({...stroke,y:top,h:end-top});}
  }
 }
 return rects;
}

/** Composite only the actor's ink, so an overhead deck never repaints another
 * pedestrian or object already in the normal depth queue. Top-deck actors
 * retain their direct drawing path and the terrain cache stays unchanged. */
export function drawPierOccludedActor(c,doc,actor,draw,_wood,{createCanvas=defaultCanvas}={}){
 const z=actorHeight(doc,actor),at=cell(doc,Math.floor(actor.x/TILE),Math.floor(actor.y/TILE));
 if(!actor.underPier||!at.pier||at.pier.level*RISE-z<PIER_WALK_CLEARANCE){draw(c);return false;}
 // This is an ink envelope, not the renderer's actor-culling rectangle. The
 // net can extend183px sideways and159px below the feet during its downswing.
 const bounds={x:Math.floor(actor.x-192),y:Math.floor(actor.y-z-320),w:384,h:512},pieces=[];
 const x0=Math.max(0,Math.floor(bounds.x/TILE)),x1=Math.min(COLS,Math.ceil((bounds.x+bounds.w)/TILE));
 const y0=Math.max(0,Math.floor(actor.y/TILE)-1),y1=Math.min(ROWS,Math.ceil((bounds.y+bounds.h+RISE*8+12)/TILE));
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
  const a=cell(doc,x,y);if(!a.pier||a.pier.level*RISE-z<PIER_WALK_CLEARANCE)continue;
  const rects=pierActorOcclusionRects(pierGeometry(doc,x,y),actor.y);
  if(rects.some(rect=>intersectsViewport(rect,bounds)))pieces.push(rects);
 }
 if(!pieces.length){draw(c);return false;}
 let cached=buffers.get(c);
 if(!cached){cached={actor:createCanvas(bounds.w,bounds.h),mask:createCanvas(bounds.w,bounds.h),frames:0,tiles:0};buffers.set(c,cached);}
 const ink=cached.actor.getContext('2d'),mask=cached.mask.getContext('2d');
 for(const g of [ink,mask]){g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,g.canvas.width,g.canvas.height);g.setTransform(1,0,0,1,-bounds.x,-bounds.y);g.imageSmoothingEnabled=false;}
 draw(ink);
 mask.fillStyle='#fff';for(const rects of pieces)for(const rect of rects){mask.globalAlpha=rect.alpha??1;mask.fillRect(rect.x,rect.y,rect.w,rect.h);}mask.globalAlpha=1;
 ink.setTransform(1,0,0,1,0,0);ink.globalCompositeOperation='destination-out';ink.drawImage(cached.mask,0,0);ink.globalCompositeOperation='source-over';
 c.save();c.imageSmoothingEnabled=false;c.drawImage(cached.actor,bounds.x,bounds.y);c.restore();
 cached.frames++;cached.tiles+=pieces.length;return true;
}

export function pierActorOcclusionStats(c){const entry=buffers.get(c);return entry?{frames:entry.frames,tiles:entry.tiles,pixels:entry.actor.width*entry.actor.height+entry.mask.width*entry.mask.height}:null;}
