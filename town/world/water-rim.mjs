import {cell,surfaceAt} from './model.mjs?v=showrooms-1';

// A rounded or brushed neighbor may be water at the shared edge even when
// its main material is land. Follow the actual shore, not its terrain square.
export function waterRimSegments(d,x,y){
 const own=cell(d,x,y),X=x*64,Y=y*64,segments=[];
 for(const[dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
  const other=cell(d,x+dx,y+dy),vertical=dx!==0,baseX=X+(dx>0?64:0),baseY=Y+(dy>0?64:0);
  const add=(start,end)=>segments.push({x:baseX+(vertical?0:start),y:baseY+(vertical?start:0),dx:vertical?0:end-start,dy:vertical?end-start:0});
  if(!own.curves?.length&&!other.curves?.length){if(own.surface==='water'&&other.surface!=='water')add(0,64);continue;}
  let start=null;
  for(let t=0;t<=64;t+=4){
   const px=baseX+(vertical?0:t+2),py=baseY+(vertical?t+2:0),shore=t<64&&surfaceAt(d,px-dx*.05,py-dy*.05)==='water'&&surfaceAt(d,px+dx*.05,py+dy*.05)!=='water';
   if(shore&&start===null)start=t;else if(!shore&&start!==null){add(start,t);start=null;}
  }
 }
 return segments;
}
