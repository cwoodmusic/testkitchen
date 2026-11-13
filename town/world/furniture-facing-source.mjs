import {drawStaticImage} from './static-sprite-cache.mjs?v=town-flight-1';
export const FURNITURE_NATIVE_VIEWS=192;
export const FURNITURE_NATIVE_PIXELS=4*1024*1024;
export const FURNITURE_OVERVIEW_EDGE=32;
const finite=Number.isFinite;
export const furnitureFacingSourceKey=(asset,placement)=>placement?.view?.id||`${asset.id}|${placement.direction}`;

/** Flat patterns keep the saved canvas transform, but share atlas admission. */
export function flatFurnitureFacingPlacement(asset,bounds){
 if(!bounds||!(asset.wallMounted||asset.layer==='ground')||typeof asset.getFacingDrawSource!=='function')return null;
 let view;try{view=asset.getFacingView?.('south',{image:false});}catch{}
 if(!view||!finite(view.w)||!finite(view.h)||view.w<=0||view.h<=0)view={id:asset.id,w:asset.w,h:asset.h};
 return {...bounds,view,direction:'south',flat:true};
}
export function flatFurnitureFacingLocalPlacement(asset,pose,placement){
 return {x:-asset.w/2,y:-asset.h*(pose.offset??1),w:asset.w,h:asset.h,view:placement.view,direction:'south',scaleX:asset.w/placement.view.w,scaleY:asset.h/placement.view.h};
}

/** Select native views once per stable visible set, never by draw/LRU order. */
export function createFurnitureFacingSourceRoster({maxViews=FURNITURE_NATIVE_VIEWS,maxPixels=FURNITURE_NATIVE_PIXELS,overviewEdge=FURNITURE_OVERVIEW_EDGE}={}){
 maxViews=finite(maxViews)?Math.max(0,Math.floor(maxViews)):FURNITURE_NATIVE_VIEWS;
 maxPixels=finite(maxPixels)?Math.max(0,Math.floor(maxPixels)):FURNITURE_NATIVE_PIXELS;
 const edge=finite(overviewEdge)?Math.max(0,overviewEdge):FURNITURE_OVERVIEW_EDGE;
 let admitted=new Set(),stamp='',pixels=0,candidates=0,updates=0,changes=0,reused=0;
 function update(entries,{pixelScale=1,focus={x:0,y:0}}={}){
  updates++;const views=new Map(),scale=finite(pixelScale)?Math.max(0,pixelScale):1;
  for(const entry of entries){
   const a=entry.asset,p=entry.placement;if(!p?.view||typeof a?.getFacingDrawSource!=='function'||a.canRenderNative===false||p.view.canRenderNative===false||typeof a.canRenderNative==='function'&&!a.canRenderNative(p.direction))continue;
   const projected=Math.max(p.w,p.h)*scale,priority=entry.selected?2:entry.focused?1:0;
   if(!priority&&projected<=edge)continue;
   const key=furnitureFacingSourceKey(a,p),cost=Math.ceil(p.view.w)*Math.ceil(p.view.h);
   if(!finite(cost)||cost<=0||cost>maxPixels)continue;
   const cx=p.x+p.w/2,cy=p.y+p.h/2,distance=(cx-focus.x)**2+(cy-focus.y)**2,old=views.get(key);
   if(old){old.cost=Math.max(old.cost,cost);old.priority=Math.max(old.priority,priority);old.projected=Math.max(old.projected,projected);old.distance=Math.min(old.distance,distance);}
   else views.set(key,{key,cost,priority,projected,distance});
  }
  candidates=views.size;
  const all=[...views.values()].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  // Subpixel camera noise cannot continually exchange two warm boundary
  // entries; an eight-pixel size band retains the current working set.
  const nextStamp=all.map(v=>`${v.key}:${v.cost}:${v.priority}:${Math.floor(v.projected/8)}:${Math.round(v.distance)}`).join(';');
  if(nextStamp===stamp){reused++;return admitted;}stamp=nextStamp;
  all.sort((a,b)=>b.priority-a.priority||Math.floor(b.projected/8)-Math.floor(a.projected/8)||Number(admitted.has(b.key))-Number(admitted.has(a.key))||a.distance-b.distance||(a.key<b.key?-1:a.key>b.key?1:0));
  const next=new Set();let used=0;
  for(const view of all){if(next.size>=maxViews)break;if(used+view.cost>maxPixels)continue;next.add(view.key);used+=view.cost;}
  if(next.size!==admitted.size||[...next].some(key=>!admitted.has(key)))changes++;
  admitted=next;pixels=used;return admitted;
 }
 return {update,isNative:(a,p)=>admitted.has(furnitureFacingSourceKey(a,p)),
  source(a,p){return furnitureFacingDrawSource(a,p,{native:admitted.has(furnitureFacingSourceKey(a,p))});},
  clear(){admitted=new Set();stamp='';pixels=0;candidates=0;},
  get stats(){return {nativeViews:admitted.size,nativePixels:pixels,candidates,maxViews,maxPixels,overviewEdge:edge,updates,changes,reused};}};
}

/** No canvas/image getter fallback: an overview request must stay an overview. */
export function furnitureFacingDrawSource(asset,placement,{native=true}={}){
 if(typeof asset?.getFacingDrawSource!=='function')return null;
 try{return asset.getFacingDrawSource(placement.direction,{native})||null;}catch{return null;}
}

/** Direct atlas crop, preserving authored contain padding and the foot anchor. */
export function drawFurnitureFacingSource(ctx,placement,source){
 if(!source?.image)return false;
 const sx=source.sx??0,sy=source.sy??0,sw=source.sw,sh=source.sh;
 const dx=source.dx??0,dy=source.dy??0,dw=source.dw??placement.view.w,dh=source.dh??placement.view.h;
 if(![sx,sy,sw,sh,dx,dy,dw,dh].every(finite)||sw<=0||sh<=0||dw<=0||dh<=0)return false;
 drawStaticImage(ctx,source.image,sx,sy,sw,sh,placement.x+dx*placement.scaleX,placement.y+dy*placement.scaleY,dw*placement.scaleX,dh*placement.scaleY);return true;
}
