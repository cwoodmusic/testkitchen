// Cardinal art is upright. Saved placement rotations continue to rotate the
// original physical bases around their existing bottom-center anchor.
const DIRECTIONS=['south','west','north','east'];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validRect=r=>r&&[r.x,r.y,r.w,r.h].every(finite)&&r.w>0&&r.h>0;
const point=p=>p&&finite(p.x)&&finite(p.y);
const quarter=rotation=>{const n=(finite(rotation)?rotation:0)/90;return Math.abs(n-Math.round(n))<1e-8?((Math.round(n)%4)+4)%4:null;};
export function cardinalFacing(rotation=0){return DIRECTIONS[((Math.round((finite(rotation)?rotation:0)/90)%4)+4)%4];}
export function facingRotation(direction){const i=DIRECTIONS.indexOf(direction);return i<0?0:i*90;}
function turn(x,y,n){switch(n){case 0:return {x,y};case 1:return {x:-y,y:x};case 2:return {x:-x,y:-y};case 3:return {x:y,y:-x};}}
function scales(a,o){
 const s=finite(o.scale)&&o.scale>0?o.scale:1;
 return {x:finite(o.scaleX)&&o.scaleX>0?o.scaleX:finite(o.w)&&o.w>0?o.w/a.w:s,y:finite(o.scaleY)&&o.scaleY>0?o.scaleY:finite(o.h)&&o.h>0?o.h/a.h:s};
}
function vertices(a){
 const points=[];
 for(const b of a?.boxes||[])if(validRect(b))points.push([b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]);
 for(const p of a?.polygons||[])for(const q of p)if(Array.isArray(q)&&finite(q[0])&&finite(q[1]))points.push(q);
 return points;
}
/** Pure world-unit centre of the original physical bases, not image alpha. */
export function furnitureFootprintBounds(a){
 const points=vertices(a);
 if(!points.length)return {x:a.w/2,y:a.h,w:0,h:0,cx:a.w/2,cy:a.h};
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
 for(const [X,Y]of points){x=Math.min(x,X);y=Math.min(y,Y);right=Math.max(right,X);bottom=Math.max(bottom,Y);}
 return {x,y,w:right-x,h:bottom-y,cx:(x+right)/2,cy:(y+bottom)/2};
}
export function furnitureFootCenter(a){const b=furnitureFootprintBounds(a);return {x:b.cx,y:b.cy};}
/** Place a newly arranged item by its floor centre, retaining its saved pivot. */
export function furnitureAtGroundCenter(a,o,center){
 const foot=furnitureFootCenter(a),offset=transform(a,o,foot.x,foot.y,{x:0,y:0});
 return {...o,x:center.x-offset.x,y:center.y-offset.y};
}
function transform(a,o,x,y,anchor={x:o.x||0,y:o.y||0},offset=1){
 const s=scales(a,o),n=quarter(o.rotation),dx=(x-a.w/2)*s.x,dy=(y-a.h*offset)*s.y,r=(o.rotation||0)*Math.PI/180,p=n===null?{x:dx*Math.cos(r)-dy*Math.sin(r),y:dx*Math.sin(r)+dy*Math.cos(r)}:turn(dx,dy,n);
 return {x:anchor.x+p.x,y:anchor.y+p.y};
}
function bounds(points){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y);}return {x,y,w:right-x,h:bottom-y};}

/** Existing collision boxes, quarter-turned exactly; no direction art changes physics. */
export function furnitureFacingBoxes(a,o={}){
 if(!a||!finite(a.w)||!finite(a.h))return [];
 const s=scales(a,o),n=quarter(o.rotation),list=(a.boxes||[]).filter(validRect);
 if(n===0)return list.map(b=>({x:o.x+(b.x-a.w/2)*s.x,y:o.y+(b.y-a.h)*s.y,w:b.w*s.x,h:b.h*s.y}));
 return list.map(b=>bounds([[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([x,y])=>transform(a,o,x,y))));
}
export function supportsFurnitureFacing(a,o={}){
 return !!a&&!o.mount&&a.furnitureFacing!==false&&!a.scene&&!a.sceneParts?.length&&!a.urban&&!a.frontAtX&&a.group!=='trees'&&!a.wallMounted&&a.layer!=='ground'&&a.id!=='music-square'&&a.id!=='coda-arcade'&&!a.id?.startsWith('estate-')&&(typeof a.getFacingView==='function'||typeof a.getFacingImage==='function');
}

/**
 * View dimensions and footCenter are WORLD units. A raster may have any
 * resolution. Metadata-only callers avoid warming imagery during culling.
 */
export function furnitureFacingPlacement(a,o={},pose={x:o.x||0,y:o.y||0,offset:1},{includeImage=true}={}){
 if(!supportsFurnitureFacing(a,o)||quarter(o.rotation)===null)return null;
 const direction=cardinalFacing(o.rotation),n=quarter(o.rotation),s=scales(a,o);
 let view;try{view=a.getFacingView?.(direction,{image:includeImage});}catch{return null;}
 view??={w:a.w,h:a.h,footCenter:furnitureFootCenter(a)};
 if(!finite(view.w)||!finite(view.h)||view.w<=0||view.h<=0)return null;
 const fc=point(view.footCenter)?view.footCenter:point(view.anchor)?view.anchor:{x:view.w/2,y:view.h};
 const source=furnitureFootCenter(a),groundCenter=transform(a,o,source.x,source.y),screenFootCenter=transform(a,o,source.x,source.y,{x:pose.x,y:pose.y},pose.offset??1);
 // Uniform placements retain aspect. Explicit legacy width/height placements
 // swap their horizontal/depth scales on side views to retain the old base.
 const sx=n%2?s.y:s.x,sy=n%2?s.x:s.y,w=view.w*sx,h=view.h*sy;
 // Preserve the old South arithmetic exactly, including fractional legacy
 // scales at a room boundary; algebraic cancellation can differ by 1e-13.
 const canonicalSouth=n===0&&view.w===a.w&&view.h===a.h&&fc.x===source.x&&fc.y===source.y;
 const rect=canonicalSouth?{x:pose.x-a.w*s.x/2,y:pose.y-a.h*s.y*(pose.offset??1),w:a.w*s.x,h:a.h*s.y}:{x:screenFootCenter.x-fc.x*sx,y:screenFootCenter.y-fc.y*sy,w,h};
 let image;
 if(includeImage)try{image=view.canvas||view.image||a.getFacingImage?.(direction)||a.canvas;}catch{image=a.canvas;}
 return {...rect,bounds:{...rect},image,direction,view,groundCenter,screenFootCenter,scaleX:sx,scaleY:sy,rotation:0};
}

/** Actual pictured bounds, with exact legacy south geometry when no view API exists. */
export function furnitureFacingBounds(a,o={},pose={x:o.x||0,y:o.y||0,offset:1}){
 const facing=furnitureFacingPlacement(a,o,pose,{includeImage:false});if(facing)return facing.bounds;
 const s=scales(a,o),offset=pose.offset??1;
 if(quarter(o.rotation)===0)return {x:pose.x-a.w*s.x/2,y:pose.y-a.h*s.y*offset,w:a.w*s.x,h:a.h*s.y};
 return bounds([[0,0],[a.w,0],[a.w,a.h],[0,a.h]].map(([x,y])=>transform(a,o,x,y,pose,offset)));
}

/** Ground row used for furniture/actor depth, independent of terrain projection. */
export function furnitureFacingDepth(a,o={},fallback=o.y){
 const points=vertices(a);return points.length?Math.max(...points.map(([x,y])=>transform(a,o,x,y).y)):fallback;
}
