import {TILE,RISE,COLS,ROWS} from './model.mjs?v=apartment-scale-2';

// Selection masks are immutable, as in selectionContains. A shallow-copied
// region can reuse its cells array after a height edit. Weak keys release old
// selections and documents; each geometry retains only its last cropped view.
export function createSelectionGeometryCache({levelAt=(doc,x,y,key)=>doc.cells[key]?.level??0}={}){
 const masks=new WeakMap(),views=new WeakMap();
 function maskFor(region){
  const key=region.cells&&typeof region.cells==='object'?region.cells:region;
  const signature=[region.x0,region.y0,region.x1,region.y1,region.cells?.length??region.cells?.size??0].join(':'),old=masks.get(key);
  if(old?.signature===signature)return old;
  const x0=Math.max(0,Math.ceil(region.x0)),y0=Math.max(0,Math.ceil(region.y0)),x1=Math.min(COLS,Math.floor(region.x1)+1),y1=Math.min(ROWS,Math.floor(region.y1)+1),w=Math.max(0,x1-x0),h=Math.max(0,y1-y0),stride=w+2,bits=new Uint8Array((w+2)*(h+2));
  if(region.cells){
   for(const key of region.cells){
    if(typeof key!=='string')continue;
    const comma=key.indexOf(','),x=Number(key.slice(0,comma)),y=Number(key.slice(comma+1));
    if(!Number.isInteger(x)||!Number.isInteger(y)||key!==`${x},${y}`||x<x0||x>=x1||y<y0||y>=y1)continue;
    bits[(y-y0+1)*stride+x-x0+1]=1;
   }
  }else for(let y=0;y<h;y++)bits.fill(1,(y+1)*stride+1,(y+1)*stride+w+1);
  const runs=[],keys=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;){
   if(!bits[(y-y0+1)*stride+x-x0+1]){x++;continue;}
   const start=x,index=keys.length;
   while(x<x1&&bits[(y-y0+1)*stride+x-x0+1]){keys.push(`${x},${y}`);x++;}
   runs.push({x0:start,x1:x,y,index});
  }
  const mask={signature,x0,y0,x1,y1,stride,bits,runs,keys,docs:new WeakMap(),plan:null};masks.set(key,mask);return mask;
 }

 function build(mask,levels){
  const runs=[],groups=new Map(),{bits,stride}=mask;
  const edge=(axis,owner,line,level,start,end)=>{
   const key=[axis,owner,line,level].join(':'),group=groups.get(key)||{axis,owner,line,level,ranges:[]};
   if(!groups.has(key))groups.set(key,group);
   const previous=group.ranges.at(-1);
   if(previous&&previous[1]===start)previous[1]=end;else group.ranges.push([start,end]);
  };
  for(const row of mask.runs){
   let start=row.x0,level=levels?.[row.index]??0;
   for(let x=row.x0,index=row.index;x<row.x1;x++,index++){
    const current=levels?.[index]??0,at=(row.y-mask.y0+1)*stride+x-mask.x0+1;
    if(current!==level){runs.push({x0:start,x1:x,y:row.y,level});start=x;level=current;}
    if(!bits[at-stride])edge('h',row.y,row.y,current,x,x+1);
    if(!bits[at+stride])edge('h',row.y,row.y+1,current,x,x+1);
    if(!bits[at-1])edge('v',x,x,current,row.y,row.y+1);
    if(!bits[at+1])edge('v',x,x+1,current,row.y,row.y+1);
   }
   runs.push({x0:start,x1:row.x1,y:row.y,level});
  }
  const perimeter=[];
  for(const group of groups.values())for(const[start,end]of group.ranges)perimeter.push({axis:group.axis,owner:group.owner,line:group.line,level:group.level,start,end});
  return {runs,perimeter,count:mask.keys.length};
 }

 function geometry(doc,region,{plan=false,revision}={}){
  if(!region)return null;
  const mask=maskFor(region);
  if(plan)return mask.plan||(mask.plan=build(mask,null));
  const old=mask.docs.get(doc),hinted=revision!==undefined;
  if(hinted&&old?.hinted&&Object.is(old.revision,revision)&&old.cells===doc.cells)return old.geometry;
  const levels=new Float64Array(mask.keys.length);let same=!!old&&old.levels.length===levels.length;
  for(const row of mask.runs)for(let x=row.x0,index=row.index;x<row.x1;x++,index++){
   const level=levelAt(doc,x,row.y,mask.keys[index]);levels[index]=level;
   if(same&&level!==old.levels[index])same=false;
  }
  const result=same?old.geometry:build(mask,levels);
  mask.docs.set(doc,{hinted,revision,cells:doc.cells,levels,geometry:result});return result;
 }

 function view(geometry,bounds={x0:0,y0:0,x1:COLS,y1:ROWS}){
  const key=[bounds.x0,bounds.y0,bounds.x1,bounds.y1].join(':'),old=views.get(geometry);
  if(old?.key===key)return old.view;
  const fills=[],segments=[];
  for(const row of geometry.runs){
   if(row.y<bounds.y0||row.y>=bounds.y1)continue;
   const x0=Math.max(row.x0,bounds.x0),x1=Math.min(row.x1,bounds.x1);
   if(x1>x0)fills.push({x:x0*TILE,y:row.y*TILE-row.level*RISE,w:(x1-x0)*TILE,h:TILE});
  }
  for(const edge of geometry.perimeter){
   const horizontal=edge.axis==='h',owner0=horizontal?bounds.y0:bounds.x0,owner1=horizontal?bounds.y1:bounds.x1;
   if(edge.owner<owner0||edge.owner>=owner1)continue;
   const start=Math.max(edge.start,horizontal?bounds.x0:bounds.y0),end=Math.min(edge.end,horizontal?bounds.x1:bounds.y1);
   if(end<=start)continue;
   if(horizontal)segments.push([start*TILE,edge.line*TILE-edge.level*RISE,end*TILE,edge.line*TILE-edge.level*RISE]);
   else segments.push([edge.line*TILE,start*TILE-edge.level*RISE,edge.line*TILE,end*TILE-edge.level*RISE]);
  }
  const result={fills,segments};views.set(geometry,{key,view:result});return result;
 }
 return {geometry,view};
}

const cache=createSelectionGeometryCache();
export const selectionGeometry=cache.geometry;
export const selectionGeometryView=cache.view;
