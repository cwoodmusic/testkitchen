import {COLS,ROWS,cell,key,stairProfile} from '../world/model.mjs?v=urban-assets-2';
import {selectionContains,selectionTiles} from '../world/selection.mjs?v=urban-assets-2';
export {selectionContains,selectionCount,selectionTiles} from '../world/selection.mjs?v=urban-assets-2';
export function regionBetween(a,b){const clamp=(v,max)=>Math.max(0,Math.min(max-1,Math.floor(v)));return {x0:clamp(Math.min(a.x,b.x),COLS),y0:clamp(Math.min(a.y,b.y),ROWS),x1:clamp(Math.max(a.x,b.x),COLS),y1:clamp(Math.max(a.y,b.y),ROWS)};}
export function regionFromPolygon(input,{preview=false}={}){
 const points=input.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)).map(p=>({x:Math.max(0,Math.min(COLS*64,p.x)),y:Math.max(0,Math.min(ROWS*64,p.y))}));if(!points.length)return null;
 let bounds=regionBetween({x:Math.min(...points.map(p=>p.x))/64,y:Math.min(...points.map(p=>p.y))/64},{x:Math.max(...points.map(p=>p.x))/64,y:Math.max(...points.map(p=>p.y))/64});const cells=[];
 // Scan each terrain row once. This stays responsive for a whole-map lasso
 // even when a long freehand boundary contains thousands of pointer samples.
 if(!preview&&points.length>=3)for(let y=bounds.y0;y<=bounds.y1;y++){
  const Y=(y+.5)*64,crossings=[],selected=new Set();
  const range=(left,right)=>{for(let x=Math.max(bounds.x0,Math.ceil(Math.min(left,right)/64-.5-1e-8));x<=Math.min(bounds.x1,Math.floor(Math.max(left,right)/64-.5+1e-8));x++)selected.add(x);};
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[j],b=points[i];if(Math.abs(a.y-Y)<.001&&Math.abs(b.y-Y)<.001)range(a.x,b.x);
   if((a.y>Y)!==(b.y>Y))crossings.push(a.x+(b.x-a.x)*(Y-a.y)/(b.y-a.y));
   if(Math.abs(b.y-Y)<.001){const x=Math.round(b.x/64-.5);if(Math.abs((x+.5)*64-b.x)<.001&&x>=bounds.x0&&x<=bounds.x1)selected.add(x);}
  }
  crossings.sort((a,b)=>a-b);for(let i=0;i+1<crossings.length;i+=2)range(crossings[i],crossings[i+1]);
  for(const x of [...selected].sort((a,b)=>a-b))cells.push(key(x,y));
 }
 if(!preview&&!cells.length)cells.push(key(Math.min(COLS-1,Math.floor(points[0].x/64)),Math.min(ROWS-1,Math.floor(points[0].y/64))));
 if(!preview){let x0=COLS,y0=ROWS,x1=0,y1=0;for(const k of cells){const[x,y]=k.split(',').map(Number);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}bounds={x0,y0,x1,y1};}
 return {...bounds,shape:'freeform',cells,outline:points,...(preview?{preview:true}:{})};
}
// Preserve surface, stairs and bridge metadata while moving each cell one level.
// Return edits first, so the caller can record one undo entry only for real edits.
export function regionHeightEdits(doc,region,delta){const edits=[];if(!region||region.preview||![1,-1].includes(delta))return edits;for(const[x,y]of selectionTiles(region)){const a=cell(doc,x,y);if(a.stairs&&a.stairBase!==undefined){const q=stairProfile(a),base=Math.round((q.base+delta)*1e9)/1e9;if(base>=0&&base+q.rise<=8+1e-8)edits.push([key(x,y),{...a,level:Math.floor(base),stairBase:base}]);continue;}const level=Math.max(0,Math.min(a.stairs?7:8,a.level+delta));if(level!==a.level){const next={...a,level};if(a.curves)next.curves=a.curves.map(q=>q.kind==='height'&&(q.under||!selectionContains(region,q.underX,q.underY))?{...q,lift:Math.max(-8,Math.min(8,(q.lift||0)+level-a.level))}:q);edits.push([key(x,y),next]);}}return edits;}
