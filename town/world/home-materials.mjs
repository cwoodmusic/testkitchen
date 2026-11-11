export {HOME_MATERIAL_SUITES,getHomeMaterialSuite,applyHomeMaterialSuite} from './home-material-definitions.mjs?v=family-rooms-1';

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
const surfaceTiles=new Map();
const SURFACE_TILE_LIMITS=Object.freeze({entries:96,pixels:2*1024*1024});
let surfacePixels=0;
const hash=(x,y,seed)=>{let n=Math.imul(x+17,374761393)^Math.imul(y+31,668265263)^seed;n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0;};
const ownerSeed=owner=>[...owner].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,0);
function tileFor(finish){
 if(!finish.surfaceStyle||typeof document==='undefined')return null;
 const key=[finish.pattern,finish.surfaceStyle,...finish.colors].join('|');let tile=surfaceTiles.get(key);
 if(tile){surfaceTiles.delete(key);surfaceTiles.set(key,tile);return tile;}
 const size=finish.surfaceStyle==='terrazzo'?128:64;tile=document.createElement('canvas');tile.width=tile.height=size;
 const c=tile.getContext('2d');c.imageSmoothingEnabled=false;
 const [base,light,dark,accent,grout]=finish.colors,seed=ownerSeed(finish.owner||finish.id),style=finish.surfaceStyle;
 px(c,0,0,size,size,base);
 if(style==='carpet'){
  // Small woven fibres read as plain carpet, with no decorative repeat motif.
  for(let y=0;y<size;y+=2)for(let x=0;x<size;x+=2){const n=hash(x,y,seed);c.globalAlpha=.23+(n%4)*.05;px(c,x+(n%2),y,1,1,n%3?light:dark);if(n%13===0)px(c,x,y+1,2,1,accent);}c.globalAlpha=1;
 }else if(style==='terrazzo'){
  // Low contrast chips stay beneath the furniture, never a giant room grid.
  for(let n=0;n<220;n++){const x=hash(n,3,seed)%size,y=hash(n,11,seed)%size;px(c,x,y,1+(n%3===0?1:0),1,n%3?light:dark);if(n%7===0)px(c,x+1,y+1,1,1,accent);}
 }else{
  const wall=style==='ceramic-wall',slab=style==='slab',stone=style==='stone',clay=style==='clay',deco=style==='deco';
  const w=wall?32:slab?64:stone?32:16,h=wall?16:slab?32:stone?32:16;
  px(c,0,0,size,size,grout);
  for(let y=0,row=0;y<size;y+=h,row++)for(let x=-w;x<size;x+=w){
   const xx=x+((wall||stone)&&row%2?w/2:0),n=hash(x,y,seed),face=deco&&((Math.floor(x/w)+row)%2)?accent:n%5===0?accent:base;
   px(c,xx+1,y+1,w-1,h-1,face);px(c,xx+2,y+2,w-3,1,light);
   if(wall){c.globalAlpha=.35;px(c,xx+2,y+h-2,w-3,1,dark);c.globalAlpha=1;}
   else for(let i=0;i<(clay?4:2);i++){c.globalAlpha=.4;px(c,xx+3+hash(i,n,seed)%Math.max(1,w-6),y+4+hash(n,i,seed)%Math.max(1,h-7),1,1,i%2?light:dark);c.globalAlpha=1;}
   if(deco&&n%7===0){px(c,xx+w-3,y+h-3,2,2,dark);px(c,xx+w-2,y+h-2,1,1,light);}
  }
 }
 surfaceTiles.set(key,tile);surfacePixels+=size*size;
 while(surfaceTiles.size>SURFACE_TILE_LIMITS.entries||surfacePixels>SURFACE_TILE_LIMITS.pixels){const oldest=surfaceTiles.keys().next().value,canvas=surfaceTiles.get(oldest);surfaceTiles.delete(oldest);surfacePixels-=canvas.width*canvas.height;canvas.width=canvas.height=0;}
 return tile;
}
export const getHomeSurfacePatternCacheStats=()=>({entries:surfaceTiles.size,pixels:surfacePixels,maxEntries:SURFACE_TILE_LIMITS.entries,maxPixels:SURFACE_TILE_LIMITS.pixels});
function field(c,finish,r,file=finish.texture){
 const trim=file===finish.trimTexture&&Boolean(file),style=trim?finish.trimPresentation:finish.presentation,image=finish.surfaceStyle&&!trim?tileFor(finish):request(file)?.image;
 const pattern=image?c.createPattern(image,'repeat'):null;
 if(pattern){const sx=style?.scaleX??style?.scale??1,sy=style?.scaleY??style?.scale??1;pattern.setTransform?.({a:sx,b:0,c:0,d:sy,e:0,f:0});}
 c.fillStyle=pattern||finish.colors[0];c.fillRect(r.x,r.y,r.w,r.h);
 if(style?.color&&style.opacity>0){c.save();c.globalAlpha*=style.opacity;c.fillStyle=style.color;c.fillRect(r.x,r.y,r.w,r.h);c.restore();}
}
export function drawHomeMaterialFloor(c,room){
 const finish=room.floorFinish||room.floor;if(!finish?.homeMaterial)return false;if(room.floorOverlay===false)return true;
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
