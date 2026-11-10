import {urbanTextures} from './urban-materials.mjs?v=furniture-facings-1';
// Dedicated, footprint-free dry ground artwork. Keep the approved grass,
// Music Square paving and water atlas intact.
const image=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Ground artwork could not load.'));i.src=new URL('../assets/ground-surfaces.png',import.meta.url);});
const panel=image.width/3;
function texture(index){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
 // Mirrored continuation joins matching edge pixels on all four boundaries.
 // Plank and grain scale stays consistent across cells and brush masks.
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);g.drawImage(image,index*panel,0,panel,image.height,0,0,256,256);g.restore();}
 return c;
}
export const groundTextures={dirt:texture(0),sand:texture(1),wood:texture(2),...urbanTextures};
