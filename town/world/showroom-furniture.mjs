import {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=apartment-homes-2';
export {SHOWROOM_FURNITURE} from './showroom-furniture-definitions.mjs?v=apartment-homes-2';

// Signature beds and seating keep the same bottom-center anchor and native
// cutaway perspective as the original furniture. The source atlas is retained
// alongside the extracted cutouts; the draw path never changes their colours.
export async function registerShowroomFurniture(add){
 const images=await Promise.all(SHOWROOM_FURNITURE.map(def=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);
  image.onerror=()=>reject(Error('The '+def.name+' artwork could not load.'));
  image.src=new URL('../assets/showrooms/'+def.file,import.meta.url);
 })));
 for(let i=0;i<SHOWROOM_FURNITURE.length;i++){
  const def=SHOWROOM_FURNITURE[i],image=images[i];
  const asset=add(def.id,def.name,'showroom furniture',def.w,def.h,c=>c.drawImage(image,0,0,def.w,def.h),def.boxes.map(box=>({...box})));
  asset.furnitureRole=def.role;asset.showroomId=def.showroomId;asset.kit='urban';
 }
}
