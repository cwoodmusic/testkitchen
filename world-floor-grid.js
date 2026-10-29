/* Reuse the approved floor beneath moved cabinets without changing other art. */
(function(root){
 'use strict';
 // Measured from the adjoining, unoccupied floor in the approved artwork.
 // It is hand drawn: its grout does not fall on a uniform 12px lattice.
 const ROWS=[166,178,189,203,215,227,238,249,262,273,284,296,310,323,336,349,362,375];
 // These intervals end above the cyan floor star at y410.
 const DONOR_ROWS=[375,387,399];
 root.createCodaArcadeFloorGrid=function({worldArt,floorArt}){
  let source=null,sourceKey='',plate=null,repairMask=null,pixels=null,sourcePixels=null;
  let floorReady=!floorArt,readiness=null,floorError=null,slowLoading=false;
  const cabinetPlates=new Map();
  const make=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
  async function decoded(image,label){
   if(!image.complete||!image.naturalWidth)await new Promise((resolve,reject)=>{
    const clear=()=>{clearTimeout(timer);image.removeEventListener('load',loaded);image.removeEventListener('error',failed);};
    const failed=()=>{clear();reject(Error(label+' could not load. Reload the arcade to try again.'));};
    const loaded=()=>{if(!image.naturalWidth){failed();return;}clear();resolve();};
    // Slow mobile connections can finish after this notice. Keep their load
    // listeners alive; only a real image error should reject readiness.
    const timer=setTimeout(()=>{slowLoading=true;},30000);
    image.addEventListener('load',loaded,{once:true});image.addEventListener('error',failed,{once:true});
    // An already-failed image has no further load event to wait for.
    if(image.complete)image.naturalWidth?loaded():failed();
   });
   if(typeof image.decode==='function')try{await image.decode();}catch{throw Error(label+' could not decode. Reload the arcade to try again.');}
  }
  function ready(){
   if(!floorArt)return Promise.resolve();
   if(!readiness)readiness=Promise.all([decoded(worldArt,'Arcade artwork'),decoded(floorArt,'Arcade floor artwork')]).then(()=>{
    if(floorArt.naturalWidth!==worldArt.naturalWidth||floorArt.naturalHeight!==worldArt.naturalHeight)throw Error('Arcade floor artwork dimensions do not match the world.');
    floorReady=true;slowLoading=false;
   }).catch(error=>{floorError=error.message;throw error;});
   return readiness;
  }
  function original(){
   if(sourcePixels)return sourcePixels;
   if(!worldArt.complete||!worldArt.naturalWidth)return null;
   const c=make(worldArt.naturalWidth,worldArt.naturalHeight),g=c.getContext('2d',{willReadFrequently:true});
   g.drawImage(worldArt,0,0);sourcePixels=g.getImageData(0,0,c.width,c.height).data;return sourcePixels;
  }
  function cabinet(bounds,bottom){
   if(floorArt){
    if(!floorReady)return null;
    const [x,y,w]=bounds,height=bottom-y,key=JSON.stringify([bounds,bottom]);
    if(!cabinetPlates.has(key)){
     const canvas=make(w,height),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
     // The plate is already a complete clean floor in world coordinates.
     // Copy it once, including reflected-floor extensions, without tile repeats.
     ctx.drawImage(floorArt,x,y,w,height,0,0,w,height);cabinetPlates.set(key,canvas);
    }
    return cabinetPlates.get(key);
   }
   const raw=original();if(!raw)return null;
   const [x,y,w,h]=bounds,height=bottom-y,canvas=make(w,height),ctx=canvas.getContext('2d',{willReadFrequently:true});
   ctx.imageSmoothingEnabled=false;
   // Keep the donor's original world X, and join each complete grout interval
   // to its real destination rows. No square texture repeats or new grid phase.
   for(let i=0;i<ROWS.length-1;i++){
    const top=Math.max(y,ROWS[i]),end=Math.min(bottom,ROWS[i+1]);if(end<=top)continue;
    const donor=i%(DONOR_ROWS.length-1),sy=DONOR_ROWS[donor],sh=DONOR_ROWS[donor+1]-sy;
    ctx.drawImage(worldArt,x,sy,w,sh,0,top-y,w,end-top);
   }
   const image=ctx.getImageData(0,0,w,height),data=image.data,width=worldArt.naturalWidth;
   // Match the quiet donor's lighting to the actual floor around this opening.
   // A coarse harmonic color correction joins both side edges and the lower
   // edge smoothly, instead of leaving four differently colored rectangles.
   const step=4,nx=Math.ceil((w-1)/step)+1,ny=Math.ceil((height-1)/step)+1;
   const field=new Float32Array(nx*ny*3),sample=(buffer,bw,bh,xx,yy,c)=>{
    let total=0,count=0;
    for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
     const px=Math.max(0,Math.min(bw-1,Math.round(xx)+dx)),py=Math.max(0,Math.min(bh-1,Math.round(yy)+dy));
     total+=buffer[(py*bw+px)*4+c];count++;
    }return total/count;
   };
   const sx=i=>i*(w-1)/(nx-1),sy=j=>j*(height-1)/(ny-1);
   for(let j=0;j<ny;j++)for(let c=0;c<3;c++){
    const yy=sy(j),left=sample(raw,width,worldArt.naturalHeight,x-4,y+yy,c)-sample(data,w,height,0,yy,c),
     right=sample(raw,width,worldArt.naturalHeight,x+w+3,y+yy,c)-sample(data,w,height,w-1,yy,c);
    for(let i=0;i<nx;i++)field[(j*nx+i)*3+c]=left+(right-left)*i/(nx-1);
   }
   for(let i=0;i<nx;i++)for(let c=0;c<3;c++){
    field[((ny-1)*nx+i)*3+c]=sample(raw,width,worldArt.naturalHeight,x+sx(i),bottom+3,c)-sample(data,w,height,sx(i),height-1,c);
   }
   for(let pass=0;pass<180;pass++)for(let j=1;j<ny-1;j++)for(let i=1;i<nx-1;i++)for(let c=0;c<3;c++){
    const at=(j*nx+i)*3+c;field[at]=(field[at-3]+field[at+3]+field[at-nx*3]+field[at+nx*3])*.25;
   }
   for(let yy=0;yy<height;yy++)for(let xx=0;xx<w;xx++){
    const fx=xx/(w-1)*(nx-1),fy=yy/(height-1)*(ny-1),ix=Math.min(nx-2,Math.floor(fx)),iy=Math.min(ny-2,Math.floor(fy)),tx=fx-ix,ty=fy-iy;
    for(let c=0;c<3;c++){
     const at=(iy*nx+ix)*3+c,a=field[at]*(1-tx)+field[at+3]*tx,b=field[at+nx*3]*(1-tx)+field[at+nx*3+3]*tx;
     data[(yy*w+xx)*4+c]=Math.max(0,Math.min(255,Math.round(data[(yy*w+xx)*4+c]+a*(1-ty)+b*ty)));
    }
    // Cover the old body completely. Feather only its reflected floor light.
    if(yy>=h)data[(yy*w+xx)*4+3]=Math.round(255*Math.min(1,(xx+1)/8,(w-xx)/8,(height-yy)/24));
   }
   if(height>h){
    // Below the old cabinet body, the grout already exists. Change only the
    // reflected lighting: keep its source texture rather than copying a second
    // set of tile edges over it. Blur the color *difference*, never the floor.
    const rh=height-h,radius=8,difference=new Float32Array(w*rh*3),horizontal=new Float32Array(difference.length),smooth=new Float32Array(difference.length);
    for(let yy=0;yy<rh;yy++)for(let xx=0;xx<w;xx++)for(let c=0;c<3;c++)
     difference[(yy*w+xx)*3+c]=data[((yy+h)*w+xx)*4+c]-raw[((y+h+yy)*width+x+xx)*4+c];
    for(let yy=0;yy<rh;yy++)for(let xx=0;xx<w;xx++)for(let c=0;c<3;c++){
     let sum=0;for(let dx=-radius;dx<=radius;dx++)sum+=difference[(yy*w+Math.max(0,Math.min(w-1,xx+dx)))*3+c];
     horizontal[(yy*w+xx)*3+c]=sum/(radius*2+1);
    }
    for(let yy=0;yy<rh;yy++)for(let xx=0;xx<w;xx++)for(let c=0;c<3;c++){
     let sum=0;for(let dy=-radius;dy<=radius;dy++)sum+=horizontal[(Math.max(0,Math.min(rh-1,yy+dy))*w+xx)*3+c];
     smooth[(yy*w+xx)*3+c]=sum/(radius*2+1);
    }
    for(let yy=0;yy<rh;yy++)for(let xx=0;xx<w;xx++)for(let c=0;c<3;c++)
     data[((yy+h)*w+xx)*4+c]=Math.max(0,Math.min(255,Math.round(raw[((y+h+yy)*width+x+xx)*4+c]+smooth[(yy*w+xx)*3+c])));
   }
   ctx.putImageData(image,0,0);return canvas;
  }
  function render(base,suppressed=[]){
   if(!worldArt.complete||!worldArt.naturalWidth)return base;
   const key=[...suppressed].sort().join('|');if(source===base&&sourceKey===key&&plate)return base;
   if(source!==base){
    source=base;plate=make(worldArt.naturalWidth,worldArt.naturalHeight);const ctx=plate.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(base,0,0);pixels=ctx.getImageData(0,0,plate.width,plate.height).data;
   }
   repairMask=make(plate.width,plate.height);const mg=repairMask.getContext('2d');mg.fillStyle='#fff';
   // Used for diagnostics only; rendering never paints a second floor overlay.
   for(const name of suppressed){const part=(root.CodaWorldObjectCatalog||[]).find(p=>p.name===name);if(part?.cleanup?.kind==='arcade-cabinet-floor')mg.fillRect(...part.bounds);}
   sourceKey=key;return base;
  }
  function point(x,y){return Number.isFinite(x)&&Number.isFinite(y)&&plate&&x>=0&&y>=0&&x<plate.width&&y<plate.height?[Math.floor(x),Math.floor(y)]:null;}
  function snapshot(){return {ready:floorReady&&!!plate,mode:floorArt?'flat-floor-plate':'source-aligned-repairs',artReady:floorReady,error:floorError,slowLoading,cabinetSurfaces:cabinetPlates.size,
   maskAt(x,y){const p=point(x,y);return p?repairMask.getContext('2d').getImageData(...p,1,1).data[3]:0;},
   pixelAt(x,y){const p=point(x,y);if(!p)return null;const at=(p[1]*plate.width+p[0])*4;return Array.from(pixels.slice(at,at+4));}};}
  return {render,cabinet,snapshot,ready,isReady:()=>floorReady};
 };
})(window);
