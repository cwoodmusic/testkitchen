// A portable 4-world-pixel contour. The same bits clip native ground artwork
// and select physical ground height/material, so the shore cannot drift.
export const MASK_GRID=16,MASK_STEP=4;
const PIXELS=MASK_GRID*MASK_GRID,BYTES=PIXELS/8,decoded=new Map();
export function validMask(mask){
 if(typeof mask!=='string'||mask.length!==44||!/^[A-Za-z0-9+/]{43}=$/.test(mask))return false;
 try{const data=atob(mask);return data.length===BYTES&&btoa(data)===mask;}catch{return false;}
}
function readMask(mask){
 if(decoded.has(mask))return decoded.get(mask);
 if(!validMask(mask))throw Error('Invalid organic terrain mask.');
 const data=atob(mask),out=new Uint8Array(PIXELS);
 for(let i=0;i<PIXELS;i++)out[i]=(data.charCodeAt(i>>3)>>(7-(i&7)))&1;
 if(decoded.size>=2048)decoded.clear();decoded.set(mask,out);return out;
}
export function decodeMask(mask){return new Uint8Array(readMask(mask));}
export function encodeMask(values){
 if(!values||values.length!==PIXELS)throw Error('Organic terrain needs 256 contour samples.');
 const data=new Uint8Array(BYTES);for(let i=0;i<PIXELS;i++)if(values[i])data[i>>3]|=1<<(7-(i&7));
 return btoa(String.fromCharCode(...data));
}
export function maskBounds(q){return {x0:q.cx-64,x1:q.cx,y0:q.cy-64,y1:q.cy};}
export function maskContains(q,x,y){
 const b=maskBounds(q);if(x<b.x0||x>=b.x1||y<b.y0||y>=b.y1)return true;
 return !!readMask(q.mask)[Math.floor((y-b.y0)/MASK_STEP)*MASK_GRID+Math.floor((x-b.x0)/MASK_STEP)];
}
// Horizontal runs are exact rectangles, without alpha fringes or a second
// bitmap resolution. This list also makes rendering testable without a DOM.
export function maskRects(q,z=0){
 const values=readMask(q.mask),b=maskBounds(q),rects=[];
 for(let y=0;y<MASK_GRID;y++)for(let x=0;x<MASK_GRID;){
  if(!values[y*MASK_GRID+x]){x++;continue;}const start=x;
  while(x<MASK_GRID&&values[y*MASK_GRID+x])x++;
  rects.push({x:b.x0+start*MASK_STEP,y:b.y0+y*MASK_STEP-z,w:(x-start)*MASK_STEP,h:MASK_STEP});
 }
 return rects;
}
// Only internal contour edges belong here. Existing terrain-rim code handles
// tile boundaries against their actual neighbors and avoids square seams.
export function maskEdges(q,z=0){
 const data=readMask(q.mask),b=maskBounds(q),edges=[];
 for(let y=0;y<MASK_GRID;y++)for(let x=0;x<MASK_GRID;x++){
  const v=data[y*MASK_GRID+x],X=b.x0+x*MASK_STEP,Y=b.y0+y*MASK_STEP-z;
  if(x+1<MASK_GRID&&v!==data[y*MASK_GRID+x+1])edges.push([[X+MASK_STEP,Y],[X+MASK_STEP,Y+MASK_STEP]]);
  if(y+1<MASK_GRID&&v!==data[(y+1)*MASK_GRID+x])edges.push([[X,Y+MASK_STEP],[X+MASK_STEP,Y+MASK_STEP]]);
 }
 return edges;
}
export function maskFront(q,x){
 const b=maskBounds(q);if(x<b.x0||x>=b.x1)return null;
 const col=Math.max(0,Math.min(MASK_GRID-1,Math.floor((x-b.x0)/MASK_STEP))),data=readMask(q.mask);
 for(let y=MASK_GRID-1;y>=0;y--)if(data[y*MASK_GRID+col])return b.y0+(y+1)*MASK_STEP;
 return b.y0;
}
