export {HOME_MATERIAL_SUITES,getHomeMaterialSuite,applyHomeMaterialSuite} from './home-material-definitions.mjs?v=apartment-scale-1';

// Seam-safe authored tiles are decoded once into ImageBitmap. The completed
// room background owns all subsequent material painting, including its grain.
const images=new Map();
function request(file){
 if(!file||typeof document==='undefined'||typeof createImageBitmap!=='function')return null;
 let state=images.get(file);if(state)return state;
 state={image:null,error:null,promise:null};images.set(file,state);
 const url=new URL('../assets/home-materials/'+file,import.meta.url);url.search=new URL(import.meta.url).search;
 state.promise=fetch(url).then(response=>{if(!response.ok)throw Error('Material '+response.status);return response.blob();}).then(blob=>createImageBitmap(blob)).then(image=>{state.image=image;return image;}).catch(error=>{state.error=error;return null;});
 return state;
}
export function warmHomeMaterials(suite){if(!suite)return Promise.resolve();return Promise.all(suite.assets.map(file=>request(file)?.promise)).then(()=>{});}
export const getHomeMaterialCacheStats=()=>({textures:images.size,ready:[...images.values()].filter(state=>state.image).length,pixels:[...images.values()].reduce((n,state)=>n+(state.image?state.image.width*state.image.height:0),0)});
const px=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
function field(c,finish,r,file=finish.texture){const image=request(file)?.image;c.fillStyle=image?c.createPattern(image,'repeat'):finish.colors[0];c.fillRect(r.x,r.y,r.w,r.h);}
export function drawHomeMaterialFloor(c,room){
 const finish=room.floorFinish||room.floor;if(!finish?.homeMaterial)return false;
 c.save();c.beginPath();c.rect(room.x,room.y,room.w,room.h);c.clip();
 // World coordinates keep the same grain phase through every room join.
 field(c,finish,room);
 if(finish.glaze>0){c.globalAlpha=finish.glaze;c.fillStyle=finish.colors[0];c.fillRect(room.x,room.y,room.w,room.h);}
 c.restore();return true;
}
export function drawHomeMaterialWallpaper(c,room){
 const finish=room.wallpaper;if(!finish?.homeMaterial)return false;
 const [,light,dark,metal]=finish.colors;
 for(const area of room.wallpaperAreas||[]){
  c.save();c.beginPath();c.rect(area.x,area.y,area.w,area.h);c.clip();
  const dadoHeight=Math.min(22,Math.max(0,area.h-8)),dadoY=area.y+area.h-dadoHeight;
  field(c,finish,{...area,h:Math.max(0,area.h-dadoHeight)});
  if(finish.trimTexture){c.save();c.translate(0,dadoY);field(c,finish,{x:area.x,y:0,w:area.w,h:dadoHeight},finish.trimTexture);c.restore();}
  else{field(c,finish,{x:area.x,y:dadoY,w:area.w,h:dadoHeight});px(c,area.x,dadoY,area.w,1,light);px(c,area.x,dadoY+2,area.w,1,metal+'75');}
  px(c,area.x,area.y,area.w,2,dark);px(c,area.x+2,area.y+2,area.w-4,1,light+'A0');
  px(c,area.x,dadoY-2,area.w,1,metal+'B0');px(c,area.x,dadoY-1,area.w,1,dark+'A0');
  px(c,area.x,area.y+area.h-3,area.w,2,dark);px(c,area.x+1,area.y+area.h-4,area.w-2,1,light+'70');c.restore();
 }
 return true;
}
