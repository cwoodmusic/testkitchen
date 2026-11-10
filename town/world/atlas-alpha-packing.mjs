// Asset-packing cleanup only: preserve every retained RGB/alpha sample while
// removing tiny disconnected gutter fragments and thin neighboring-row tails.
export function cleanAtlasComponents(data,width,height,{columns=4,rows=8,minAlpha=16,minArea=16,areaRatio=.01}={}){
 const pixels=new Uint8ClampedArray(data),cells=[];let removedPixels=0,removedComponents=0;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x0=Math.floor(col*width/columns),y0=Math.floor(row*height/rows),w=Math.floor((col+1)*width/columns)-x0,h=Math.floor((row+1)*height/rows)-y0,labels=new Uint32Array(w*h),queue=new Uint32Array(w*h),components=[null];
  const alpha=at=>pixels[((Math.floor(at/w)+y0)*width+at%w+x0)*4+3];
  for(let at=0;at<labels.length;at++){
   if(labels[at]||alpha(at)<minAlpha)continue;
   const id=components.length,component={area:0,left:w,top:h,right:0,bottom:0};let next=0,end=1;queue[0]=at;labels[at]=id;
   while(next<end){
    const p=queue[next++],x=p%w,y=Math.floor(p/w);component.area++;component.left=Math.min(component.left,x);component.right=Math.max(component.right,x);component.top=Math.min(component.top,y);component.bottom=Math.max(component.bottom,y);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     if(!dx&&!dy)continue;const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=w||Y>=h)continue;
     const q=Y*w+X;if(!labels[q]&&alpha(q)>=minAlpha){labels[q]=id;queue[end++]=q;}
    }
   }
   components.push(component);
  }
  const largest=Math.max(0,...components.slice(1).map(c=>c.area)),main=components.find(c=>c?.area===largest),threshold=Math.max(minArea,largest*areaRatio),near=Math.max(4,Math.min(w,h)*.035),keep=components.map(c=>{
   if(!c)return false;
   const cw=c.right-c.left+1,ch=c.bottom-c.top+1,gapX=Math.max(0,main.left-c.right,c.left-main.right),gapY=Math.max(0,main.top-c.bottom,c.top-main.bottom),nearBody=Math.hypot(gapX,gapY)<=near;
   const edgeStripe=c.area<largest*.12&&ch<=Math.max(8,Math.floor(h*.04))&&cw>ch*8&&(c.top<=4||c.bottom>=h-5);
   const retained=nearBody||c.area>=threshold&&!edgeStripe;if(!retained)removedComponents++;return retained;
  });
  let left=w,top=h,right=-1,bottom=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const local=y*w+x,at=((y+y0)*width+x+x0)*4;
   if(keep[labels[local]]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);continue;}
   if(pixels[at+3])removedPixels++;pixels[at]=pixels[at+1]=pixels[at+2]=pixels[at+3]=0;
  }
  cells.push({cell:{x:x0,y:y0,w,h},bounds:right>=left?{x:x0+left,y:y0+top,w:right-left+1,h:bottom-top+1}:null});
 }
 return {pixels,cells,removedPixels,removedComponents};
}

/** Find each column's quiet row gaps without cutting sprites that drift across a nominal grid row. */
export function adaptiveAtlasRegions(data,width,height,{columns=4,rows=8,alpha=128,searchFraction=.22,minGap=40}={}){
 const regions=new Array(columns*rows),step=height/rows,gap=Math.min(minGap,Math.max(1,Math.floor(step*.4)));
 for(let col=0;col<columns;col++){
  const x=Math.floor(col*width/columns),right=Math.floor((col+1)*width/columns),splits=[0];
  for(let row=1;row<rows;row++){
   const target=row*step,margin=Math.floor(step*searchFraction),lo=Math.max(splits.at(-1)+gap,Math.floor(target-margin)),hi=Math.min(height-(rows-row)*gap,Math.ceil(target+margin));
   let best=Infinity,chosen=Math.round(target);
   for(let y=lo;y<=hi;y++){
    let count=0;for(let Y=Math.max(0,y-1);Y<=Math.min(height-1,y+1);Y++)for(let X=x;X<right;X++)if(data[(Y*width+X)*4+3]>=alpha)count++;
    const score=count*1000+Math.abs(y-target);if(score<best){best=score;chosen=y;}
   }
   splits.push(chosen);
  }
  splits.push(height);
  for(let row=0;row<rows;row++)regions[row*columns+col]={x,y:splits[row],w:right-x,h:splits[row+1]-splits[row]};
 }
 return regions;
}

/** Retain native RGBA samples and clean isolated gutters after adaptive row ownership is known. */
export function cleanAdaptiveAtlas(data,width,height,options={}){
 const pixels=new Uint8ClampedArray(data.length),regions=adaptiveAtlasRegions(data,width,height,options),cells=[];let removedPixels=0,removedComponents=0;
 for(const cell of regions){
  const chunk=new Uint8ClampedArray(cell.w*cell.h*4);
  for(let y=0;y<cell.h;y++)chunk.set(data.subarray(((cell.y+y)*width+cell.x)*4,((cell.y+y)*width+cell.x+cell.w)*4),y*cell.w*4);
  const clean=cleanAtlasComponents(chunk,cell.w,cell.h,{...options,columns:1,rows:1}),b=clean.cells[0].bounds;
  for(let y=0;y<cell.h;y++)pixels.set(clean.pixels.subarray(y*cell.w*4,(y+1)*cell.w*4),((cell.y+y)*width+cell.x)*4);
  cells.push({cell,bounds:b?{x:cell.x+b.x,y:cell.y+b.y,w:b.w,h:b.h}:null});removedPixels+=clean.removedPixels;removedComponents+=clean.removedComponents;
 }
 return {pixels,cells,removedPixels,removedComponents};
}
