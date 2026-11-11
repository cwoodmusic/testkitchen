import {APARTMENT_DECOR,APARTMENT_DECOR_ALIASES} from './apartment-decor-definitions.mjs?v=family-rooms-1';
export {APARTMENT_DECOR,APARTMENT_DECOR_ALIASES} from './apartment-decor-definitions.mjs?v=family-rooms-1';

// Keep the native silhouettes and pixel proportions. Purchased legacy items
// use this same contain fit inside their original world canvas and boxes.
export function apartmentImageRect(def,image){
 const scale=Math.min(def.w/image.width,def.h/image.height),w=image.width*scale,h=image.height*scale;
 return {x:Math.max(0,(def.w-w)/2),y:Math.max(0,def.h-h),w,h};
}

const nativeEmitters={
 'apartment-arc-floor-lamp':{u:.69,v:.2,radius:150,power:.84,color:[255,221,161]},
 'apartment-mushroom-lamp':{u:.5,v:.29,radius:115,power:.72,color:[255,192,111]},
 'apartment-lava-lamp':{u:.5,v:.49,radius:105,power:.7,color:[239,145,217]},
 'apartment-reading-lamp':{u:.75,v:.23,radius:130,power:.8,color:[255,221,167]}
};
function emitters(def,rect){
 const source=nativeEmitters[def.id];
 if(!source)return [];
 return [{...source,kind:'window',u:(rect.x+source.u*rect.w)/def.w,v:(rect.y+source.v*rect.h)/def.h}];
}

export async function registerApartmentDecor(add){
 const defs=[...APARTMENT_DECOR,...APARTMENT_DECOR_ALIASES];
 const images=await Promise.all(defs.map(def=>new Promise((resolve,reject)=>{
  const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('The '+def.name+' apartment artwork could not load.'));
  image.src=new URL('../assets/apartments/'+def.file,import.meta.url).href;
 })));
 return defs.map((def,index)=>{
  const image=images[index],rect=apartmentImageRect(def,image),alias=!!def.aliasOf;
  const asset=add(def.id,def.name,alias?'showroom furniture':'apartment furniture',def.w,def.h,c=>{
   c.imageSmoothingEnabled=false;c.drawImage(image,rect.x,rect.y,rect.w,rect.h);
  },def.boxes.map(box=>({...box})),def.layer);
  Object.assign(asset,{
   kit:'urban',pack:'apartment-decor-48',facing:'south',purpose:def.purpose,
   furnitureRole:alias?def.role:def.purpose,apartmentCategory:def.category,
   collisionDefault:def.solid,npcAvoid:def.solid,depthSorted:def.solid,
   wallMounted:!!def.wallMounted,lightEmitters:emitters(def,rect),
   ...(alias?{showroomId:def.showroomId,theme:def.theme,aliasOf:def.aliasOf}: {})
  });
  return asset;
 });
}
