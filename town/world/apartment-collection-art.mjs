export function collectionImageRect(def,frame){
 const scale=Math.min(def.w/frame.w,def.h/frame.h),w=frame.w*scale,h=frame.h*scale;
 return {x:Math.max(0,(def.w-w)/2),y:Math.max(0,def.h-h),w,h};
}
// Authoring metadata only: identify a floor lamp's pictured base independently
// of its large overhanging shade. This does not alter any source pixels.
export function collectionFloorBaseU(pixels,width,height){
 const start=Math.floor(height*.9);let weightedX=0,total=0;
 for(let y=start;y<height;y++)for(let x=0;x<width;x++){
  const alpha=pixels[(y*width+x)*4+3];if(alpha<128)continue;
  const weight=alpha*(1+(y-start)/Math.max(1,height-start));weightedX+=(x+.5)*weight;total+=weight;
 }
 return total?weightedX/total/width:.5;
}
export function collectionMotion(def,frame){
 const motion=frame.motion;if(!motion)return null;
 const rect=collectionImageRect(def,frame),point=([u,v])=>[(rect.x+u*rect.w)/def.w,(rect.y+v*rect.h)/def.h],mask=motion.mask.map(point),xs=mask.map(p=>p[0]),ys=mask.map(p=>p[1]);
 return {...motion,mask,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]};
}
