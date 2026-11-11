import {TILE,RISE} from './model.mjs?v=interior-polish-1';

const empty=Object.freeze({surface:'grass',level:0});
const dry=new Set(['grass','dirt','sand','wood','asphalt','sidewalk','brick']);
const plain=a=>!a.paint&&!a.curves?.length&&!a.stairs&&!a.bridge&&!a.pier&&!a.sidewalkCurb;

// This is only a cold-bake accelerator at the fixed 1/8 overview raster scale.
// Its integer-sized cells share a single projected texture phase. Normal live
// rendering, curved edges, paint interpolation and every terrain border retain
// their original per-cell rendering. The caller keeps row-level rims/piers.
export function prepareOverviewRuns(d,{x0,x1,y0,y1},texture){
 const width=x1-x0,height=y1-y0,stride=width+2;
 if(width<=0||height<=0)return {draw:(_c,x)=>x,runs:0,cells:0};
 // Read each padded world coordinate once. Eligibility then reads these
 // references rather than constructing and looking up nine keys per cell.
 const refs=new Array(stride*(height+2));
 for(let y=-1;y<=height;y++)for(let x=-1;x<=width;x++)refs[(y+1)*stride+x+1]=d.cells[`${x+x0},${y+y0}`]||empty;
 const ends=new Uint16Array(width*height),materials=new Array(width*height),levels=new Uint8Array(width*height);
 const cardinal=[-1,1,-stride,stride],around=[-stride-1,-stride,-stride+1,-1,1,stride-1,stride,stride+1];
 let runs=0,cells=0;
 const eligible=(a,i)=>{
  if(!plain(a)||!Number.isInteger(a.level)||a.level<0||a.level>8)return false;
  const water=a.surface==='water';
  if(water?a.level!==0:!dry.has(a.surface))return false;
  for(const offset of cardinal){const b=refs[i+offset];if(!plain(b)||b.level!==a.level||water&&b.surface!=='water')return false;}
  // Blend interpolation reads diagonals even when the center has no paint.
  if(!water)for(const offset of around)if(refs[i+offset].paint)return false;
  return true;
 };
 for(let y=0;y<height;y++)for(let x=0;x<width;){
  const i=(y+1)*stride+x+1,a=refs[i];
  if(!eligible(a,i)){x++;continue;}
  const start=x;
  while(++x<width){const at=(y+1)*stride+x+1,b=refs[at];if(b.surface!==a.surface||b.level!==a.level||!eligible(b,at))break;}
  for(let at=start;at<x;at++){const k=y*width+at;ends[k]=x+x0;materials[k]=a.surface;levels[k]=a.level;}
  runs++;cells+=x-start;
 }
 const contexts=new WeakMap();
 return {
  runs,cells,
  draw(c,x,y){
   if(x<x0||x>=x1||y<y0||y>=y1)return x;
   const index=(y-y0)*width+x-x0,end=ends[index];if(!end)return x;
   const surface=materials[index],z=levels[index]*RISE,X=x*TILE,Y=y*TILE-z,w=(end-x)*TILE;
   if(surface==='water'){c.clearRect(X,Y,w,TILE);return end;}
   const source=texture?.(surface);if(!source)return x;
   let patterns=contexts.get(c);if(!patterns){patterns=new Map();contexts.set(c,patterns);}
   const key=surface+':'+z;let saved=patterns.get(key);
   if(!saved||saved.source!==source||saved.width!==source.width||saved.height!==source.height){
    const pattern=c.createPattern(source,'repeat');if(!pattern)return x;
    pattern.setTransform({a:1,b:0,c:0,d:1,e:0,f:-z});
    saved={pattern,source,width:source.width,height:source.height};patterns.set(key,saved);
   }
   c.fillStyle=saved.pattern;c.fillRect(X,Y,w,TILE);return end;
  }
 };
}
