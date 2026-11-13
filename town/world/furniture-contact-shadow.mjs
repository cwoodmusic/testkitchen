// Contact shadows belong to the pictured feet, independently of the legacy
// placement pivot and collision base. A side-facing sprite can be much taller
// and narrower than those saved dimensions.
const SAMPLE_LIMIT=96;
const opaque=192;
const positive=n=>Number.isFinite(n)&&n>0;
const canvasFactory=()=>typeof OffscreenCanvas==='function'?new OffscreenCanvas(SAMPLE_LIMIT,SAMPLE_LIMIT):typeof document!=='undefined'?document.createElement('canvas'):null;

export function createFurnitureContactShadowPainter({createCanvas=canvasFactory}={}){
 const cache=new WeakMap();
 let sampler=null,context=null,allocations=0,samples=0;
 function measure(image,ready,revision){
  // Pending cardinal canvases may be transparent or contain a provisional
  // crop. Wait for their native art rather than retaining a blank preview.
  if(!image||typeof image!=='object')return null;
  if(ready===false||image.complete===false){cache.delete(image);return null;}
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  if(!positive(width)||!positive(height))return null;
  const old=cache.get(image);
  if(old&&old.width===width&&old.height===height&&old.ready===ready&&old.revision===revision)return old.geometry;
  let measured=null;
  try{
   if(!sampler){sampler=createCanvas();if(!sampler)return null;sampler.width=sampler.height=SAMPLE_LIMIT;context=sampler.getContext('2d',{willReadFrequently:true});allocations++;}
   if(!context)return null;
   const scale=Math.min(1,SAMPLE_LIMIT/width,SAMPLE_LIMIT/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
   context.clearRect(0,0,SAMPLE_LIMIT,SAMPLE_LIMIT);context.imageSmoothingEnabled=false;
   context.drawImage(image,0,0,width,height,0,0,w,h);
   const pixels=context.getImageData(0,0,w,h).data;samples++;
   let left=w,right=-1,top=h,bottom=-1;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>=opaque){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   if(bottom>=0){
    let contactLeft=w,contactRight=-1;
    const start=Math.max(top,bottom-Math.max(1,Math.ceil(h*.055))+1);
    for(let y=start;y<=bottom;y++)for(let x=left;x<=right;x++)if(pixels[(y*w+x)*4+3]>=opaque){contactLeft=Math.min(contactLeft,x);contactRight=Math.max(contactRight,x);}
    if(contactRight>=contactLeft)measured=Object.freeze({left:left/w,right:(right+1)/w,bottom:(bottom+1)/h,contactLeft:contactLeft/w,contactRight:(contactRight+1)/w});
   }
  }catch{
   // A tainted or unavailable bitmap should omit this cosmetic effect. The
   // original artwork can still render without substituting a guessed oval.
   // Reset the same sampler if a foreign image tainted it, so other furniture
   // can still be measured without allocating another canvas.
   if(sampler)sampler.width=SAMPLE_LIMIT;
  }
  cache.set(image,{width,height,ready,revision,geometry:measured});
  return measured;
 }
 function draw(c,asset,item,facing){
  if(!facing||!facing.image||!positive(facing.w)||!positive(facing.h)||!Number.isFinite(facing.x)||!Number.isFinite(facing.y)||item.layer==='ground'||asset.layer==='ground'||item.furnitureRole==='rug'||asset.furnitureRole==='rug'||asset.purpose==='rug'||item.wallMounted||asset.wallMounted||item.supportedBy)return false;
  const contact=measure(facing.image,facing.view?.ready,facing.view?.revision);
  if(!contact)return false;
  const span=(contact.contactRight-contact.contactLeft)*facing.w;
  if(!positive(span))return false;
  const x=facing.x+(contact.contactLeft+contact.contactRight)*facing.w/2,y=facing.y+contact.bottom*facing.h;
  c.save();
  try{
   c.fillStyle='#16232b1c';c.beginPath();c.ellipse(x,y,span*.46,Math.min(3,Math.max(.75,span*.045)),0,0,Math.PI*2);c.fill();
  }finally{c.restore();}
  return true;
 }
 return {geometry:(image,options)=>measure(image,options?.ready,options?.revision),draw,get stats(){return {allocations,samples,samplerWidth:sampler?.width||0,samplerHeight:sampler?.height||0};}};
}

const shared=createFurnitureContactShadowPainter();
export const drawFurnitureContactShadow=(context,asset,item,facing)=>shared.draw(context,asset,item,facing);
