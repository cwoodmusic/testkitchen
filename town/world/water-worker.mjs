import {waterDisplacements,mirroredWaterIndex} from './water-motion.mjs?v=opera-smooth-1';
let state;
self.onmessage=({data})=>{
 if(data.original){
  const {original,sourceWidth,width,height}=data,canvas=new OffscreenCanvas(width,height),c=canvas.getContext('2d',{willReadFrequently:true}),image=c.createImageData(width,height);
  state={original,width,height,c,canvas,image,pixels:new Uint32Array(image.data.buffer),mirrorX:Int32Array.from({length:width+14},(_,i)=>mirroredWaterIndex(i-7,sourceWidth)),mirrorY:Int32Array.from({length:height+8},(_,i)=>mirroredWaterIndex(i-4,height/2)*sourceWidth)};return;
 }
 const {index}=data,{original,width,height,c,canvas,image,pixels,mirrorX,mirrorY}=state,displacement=waterDisplacements(width,height,index);
 for(let row=0;row<height;row++){
  const start=displacement.x[row]+7,offset=row*width,y=row+4;
  for(let col=0;col<width;col++)pixels[offset+col]=original[mirrorY[y+displacement.y[col]]+mirrorX[col+start]];
 }
 c.putImageData(image,0,0);const bitmap=canvas.transferToImageBitmap();self.postMessage({index,image:bitmap},[bitmap]);
};
