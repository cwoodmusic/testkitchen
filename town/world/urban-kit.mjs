// Portable street props use the same bottom-center anchors and foot collision
// as the rest of the builder. Manholes and drains stay on the ground layer.
export async function registerUrbanDetails(add){
 const response=await fetch(new URL('../assets/urban/street-details.json',import.meta.url));
 if(!response.ok)throw Error('Urban street asset metadata could not load.');
 const atlas=await response.json();
 const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Urban street artwork could not load.'));i.src=new URL('../assets/urban/'+atlas.file,import.meta.url);});
 for(const item of atlas.items){
  const w=Math.ceil(item.worldW),h=Math.ceil(item.worldH),a=add(item.id,item.name,'urban street details',w,h,c=>c.drawImage(image,item.x,item.y,item.w,item.h,0,0,w,h),item.boxes,item.layer);
  a.kit='urban';a.pack='urban-street-kit';a.facing='south';a.collisionDefault=item.boxes.length>0;
 }
}
export function isUrbanAsset(a){return a.kit==='urban'||a.group.startsWith('urban ');}
