// Culling follows the pictured quad, including tall roofs and mounted props.
// The object anchor is its foot point, rather than the centre of the image.
export function spriteBounds(asset,object,pose){
 const scale=object.scale||1,angle=(object.rotation||0)*Math.PI/180;
 const C=Math.cos(angle),S=Math.sin(angle),width=asset.w*scale,height=asset.h*scale;
 const offset=height*(.5-(pose.offset??1));
 const x=pose.x-offset*S,y=pose.y+offset*C;
 const w=Math.abs(C)*width+Math.abs(S)*height,h=Math.abs(S)*width+Math.abs(C)*height;
 return {x:x-w/2,y:y-h/2,w,h};
}
export function intersectsViewport(bounds,view,padding=0){
 return bounds.x+bounds.w+padding>=view.x&&bounds.x-padding<=view.x+view.w&&bounds.y+bounds.h+padding>=view.y&&bounds.y-padding<=view.y+view.h;
}
export function actorBounds(x,y){return {x:x-160,y:y-320,w:320,h:360};}
