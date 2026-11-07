import {COLS,ROWS,cell,key} from '../world/model.mjs';
export function regionBetween(a,b){const clamp=(v,max)=>Math.max(0,Math.min(max-1,Math.floor(v)));return {x0:clamp(Math.min(a.x,b.x),COLS),y0:clamp(Math.min(a.y,b.y),ROWS),x1:clamp(Math.max(a.x,b.x),COLS),y1:clamp(Math.max(a.y,b.y),ROWS)};}
// Preserve surface, stairs and bridge metadata while moving each cell one level.
// Return edits first, so the caller can record one undo entry only for real edits.
export function regionHeightEdits(doc,region,delta){const edits=[];if(!region||![1,-1].includes(delta))return edits;for(let y=region.y0;y<=region.y1;y++)for(let x=region.x0;x<=region.x1;x++){const a=cell(doc,x,y),level=Math.max(0,Math.min(a.stairs?7:8,a.level+delta));if(level!==a.level)edits.push([key(x,y),{...a,level}]);}return edits;}
