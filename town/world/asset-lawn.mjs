import {assetImage} from './asset-color.mjs?v=builder-tools-1';

const cache=new WeakMap();
export const supportsLawnReveal=a=>a.id==='music-square'||a.id.startsWith('estate-');

// Remove only the native lawn around a scene's perimeter. Stone, timber,
// roofs, flowers and the sharply detailed foliage remain in the foreground.
// The world ground then supplies the lawn, including square and soft paint.
export function lawnCoverage({data,width,height},a){
 const length=width*height,sum=new Float64Array((width+1)*(height+1)),squared=new Float64Array(sum.length),stride=width+1;
 for(let y=0;y<height;y++){
  let row=0,row2=0;
  for(let x=0;x<width;x++){
   const i=y*width+x,k=i*4,L=data[k]*.3+data[k+1]*.59+data[k+2]*.11;row+=L;row2+=L*L;
   sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;squared[(y+1)*stride+x+1]=squared[y*stride+x+1]+row2;
  }
 }
 const music=a.id==='music-square',band=music ? .065 : .18,textureThreshold=music?1500:950,alpha=new Uint8Array(length),detailed=new Uint8Array(length),seen=new Uint8Array(length),queue=[];
 const rect=(I,x0,y0,x1,y1)=>I[y1*stride+x1]-I[y0*stride+x1]-I[y1*stride+x0]+I[y0*stride+x0];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height;if(Math.min(u,1-u,v,1-v)>band)continue;
  const X=u*a.w,Y=v*a.h;
  if(!music&&a.boxes?.some(b=>X>=b.x-3&&X<=b.x+b.w+3&&Y>=b.y-3&&Y<=b.y+b.h+3))continue;
  const i=y*width+x,k=i*4,r=data[k],g=data[k+1],b=data[k+2];
  if(data[k+3]<12||g<r*.92||g<b*1.45||r<b*1.2)continue;
  const x0=Math.max(0,x-4),x1=Math.min(width,x+5),y0=Math.max(0,y-4),y1=Math.min(height,y+5),n=(x1-x0)*(y1-y0),mean=rect(sum,x0,y0,x1,y1)/n,variance=Math.max(0,rect(squared,x0,y0,x1,y1)/n-mean*mean);
  alpha[i]=255;if(variance>textureThreshold)detailed[i]=1;
 }
 // Grass has occasional bright blades and grain. Keeping every one as an
 // opaque pixel leaves green confetti on a newly paved verge. Preserve only
 // coherent, detailed plant clusters rather than those isolated lawn marks.
 for(let start=0;start<length;start++)if(detailed[start]===1){
  const component=[start];detailed[start]=2;
  for(let head=0;head<component.length;head++){
   const i=component[head],x=i%width,y=Math.floor(i/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const X=x+dx,Y=y+dy,n=Y*width+X;if(X<0||Y<0||X>=width||Y>=height||detailed[n]!==1)continue;
    detailed[n]=2;component.push(n);
   }
  }
  if(component.length>=48)for(const i of component)alpha[i]=0;
 }
 // Only perimeter-connected lawn is ground. Green window shutters or a green
 // roof cannot become a terrain hole simply because they share its palette.
 const enqueue=i=>{if(!seen[i]&&alpha[i]){seen[i]=1;queue.push(i);}};
 for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x);}
 for(let y=1;y<height-1;y++){enqueue(y*width);enqueue(y*width+width-1);}
 for(let head=0;head<queue.length;head++){
  const i=queue[head],x=i%width,y=Math.floor(i/width);
  if(x)enqueue(i-1);if(x+1<width)enqueue(i+1);if(y)enqueue(i-width);if(y+1<height)enqueue(i+width);
 }
 for(let i=0;i<length;i++)if(!seen[i])alpha[i]=0;
 return alpha;
}

export function assetMapImage(a){
 const source=assetImage(a);if(!supportsLawnReveal(a))return source;
 if(cache.has(source))return cache.get(source);
 const analysis=document.createElement('canvas'),factor=Math.min(1,768/source.width);analysis.width=Math.max(1,Math.round(source.width*factor));analysis.height=Math.max(1,Math.round(source.height*factor));
 const g=analysis.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,analysis.width,analysis.height);
 const pixels=g.getImageData(0,0,analysis.width,analysis.height),coverage=lawnCoverage(pixels,a);
 for(let i=0;i<coverage.length;i++){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=coverage[i];}g.putImageData(pixels,0,0);
 const out=document.createElement('canvas');out.width=source.width;out.height=source.height;const c=out.getContext('2d');c.drawImage(source,0,0);c.globalCompositeOperation='destination-out';c.drawImage(analysis,0,0,out.width,out.height);
 cache.set(source,out);return out;
}
