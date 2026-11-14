import {urbanTextures} from './urban-materials.mjs?v=town-review-3';
// Dedicated, footprint-free dry ground artwork. Keep the approved grass,
// Music Square paving and water atlas intact.
const load=path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Ground artwork could not load.'));i.src=new URL('../assets/'+path,import.meta.url);});
const [image,sand]=await Promise.all([load('ground-surfaces.png'),load('ground-repeats/sand.png')]);
const panel=image.width/3;
function texture(index){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
 // Mirrored continuation joins matching edge pixels on all four boundaries.
 // Plank and grain scale stays consistent across cells and brush masks.
 for(let y=0;y<2;y++)for(let x=0;x<2;x++){g.save();g.translate(x?512:0,y?512:0);g.scale(x?-1:1,y?-1:1);g.drawImage(image,index*panel,0,panel,image.height,0,0,256,256);g.restore();}
 return c;
}
// Sand is authored as a complete periodic field. Reflecting the old diagonal
// donor made conspicuous chevrons at every half-tile, despite equal end pixels.
const sandTexture=document.createElement('canvas');sandTexture.width=sandTexture.height=512;
const sandContext=sandTexture.getContext('2d');sandContext.imageSmoothingEnabled=false;sandContext.drawImage(sand,0,0,512,512);
export const groundTextures={dirt:texture(0),sand:sandTexture,wood:texture(2),...urbanTextures};

const patterns=new WeakMap();
/** Sample one world-aligned material field, including across cell boundaries. */
export function drawGroundTexture(c,surface,x,y,w,h,offsetX=0,offsetY=0){
 const source=groundTextures[surface];if(!source)return false;
 let cache=patterns.get(c);if(!cache)patterns.set(c,cache=new Map());
 const key=surface+':'+offsetX+':'+offsetY;
 let pattern=cache.get(key);
 if(!pattern){
  if(cache.size>=128)cache.clear();
  pattern=c.createPattern(source,'repeat');pattern.setTransform(new DOMMatrix().translate(offsetX,offsetY));cache.set(key,pattern);
 }
 c.save();
 // Area sampling preserves narrow mortar/expansion joints when minified.
 // It operates on the continuous field, not separately clamped 64px crops.
 const t=c.getTransform();
 if(Math.min(Math.hypot(t.a,t.b),Math.hypot(t.c,t.d))<1){c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';}
 c.fillStyle=pattern;
 if(Math.abs(t.b)<1e-9&&Math.abs(t.c)<1e-9&&t.a>0&&t.d>0){
  // Neighboring cells own the same rounded device boundary exactly once.
  // Fill the field through that clip so fractional geometry cannot leave a
  // translucent hairline, or restart the material's sampling phase.
  const left=Math.round(x*t.a+t.e),right=Math.round((x+w)*t.a+t.e),top=Math.round(y*t.d+t.f),bottom=Math.round((y+h)*t.d+t.f);
  c.setTransform(1,0,0,1,0,0);c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();c.setTransform(t);
  c.fillRect(x-1/t.a,y-1/t.d,w+2/t.a,h+2/t.d);
 }else c.fillRect(x,y,w,h);
 c.restore();return true;
}
