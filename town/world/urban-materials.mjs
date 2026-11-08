// The same source textures supply terrain brushes and modular street assets.
// Mirroring one donor quarter preserves matching boundary pixels without
// putting road markings or street furniture into the paintable material.
const image=await new Promise((resolve,reject)=>{
 const i=new Image();
 i.onload=()=>resolve(i);
 i.onerror=()=>reject(Error('Urban street surface artwork could not load.'));
 i.src=new URL('../assets/urban/street-surfaces.png',import.meta.url);
});
const panel=image.width/3;
function texture(index){
 const c=document.createElement('canvas');c.width=c.height=512;
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);
  g.drawImage(image,index*panel,0,panel,image.height,0,0,256,256);g.restore();
 }
 return c;
}
export const urbanTextures=Object.freeze({asphalt:texture(0),sidewalk:texture(1),brick:texture(2)});
