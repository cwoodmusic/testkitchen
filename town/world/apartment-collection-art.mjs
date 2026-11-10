export function collectionImageRect(def,frame){
 const scale=Math.min(def.w/frame.w,def.h/frame.h),w=frame.w*scale,h=frame.h*scale;
 return {x:Math.max(0,(def.w-w)/2),y:Math.max(0,def.h-h),w,h};
}
export function collectionMotion(def,frame){
 const motion=frame.motion;if(!motion)return null;
 const rect=collectionImageRect(def,frame),point=([u,v])=>[(rect.x+u*rect.w)/def.w,(rect.y+v*rect.h)/def.h],mask=motion.mask.map(point),xs=mask.map(p=>p[0]),ys=mask.map(p=>p[1]);
 return {...motion,mask,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]};
}
