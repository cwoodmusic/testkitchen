// The same source textures supply terrain brushes and modular street assets.
// Mirroring one donor quarter preserves matching boundary pixels without
// putting road markings or street furniture into the paintable material.
const load=path=>new Promise((resolve,reject)=>{
 const i=new Image();
 i.onload=()=>resolve(i);
 i.onerror=()=>reject(Error('Urban street surface artwork could not load.'));
 i.src=new URL('../assets/urban/'+path,import.meta.url);
});
const [image,concrete]=await Promise.all([load('street-surfaces.png'),load('concrete-sidewalk.png')]);
function texture(index,source=image){
 const panel=source===image?image.width/3:source.width;
 const c=document.createElement('canvas');c.width=c.height=512;
 const g=c.getContext('2d');g.imageSmoothingEnabled=false;
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);
  g.drawImage(source,index*panel,0,panel,source.height,0,0,256,256);g.restore();
 }
 return c;
}
// The concrete donor has two pours across instead of eight small pavers.
// At this shared world scale, expansion joints are 128 world pixels apart:
// one broad slab spans the full width of a modular sidewalk.
export const urbanTextures=Object.freeze({asphalt:texture(0),sidewalk:texture(0,concrete),brick:texture(2)});
