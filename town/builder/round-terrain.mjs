import {cell,key,COLS,ROWS} from '../world/model.mjs?v=stairs-topdown-1';
import {curveBounds,cornerStyles} from '../world/round-geometry.mjs?v=stairs-topdown-1';
const featureKey=q=>[q.corner,q.cx,q.cy,q.r,q.kind,q.underX,q.underY,q.lift||0].join(':');
const styleOf=q=>cornerStyles.includes(q.style)?q.style:'smooth';
export function roundTerrain(d,p,width=3,style='smooth'){style=cornerStyles.includes(style)?style:'smooth';const edits=new Map(),radius=Math.max(1,Math.min(8,Math.floor(Number(width)||1))),scan=Math.floor(radius/2),cx=Math.floor(p.x/64),cy=Math.floor(p.y/64),restyled=new Set();let corners=0;
 function restyle(q,prototype){const id=featureKey(q);if(restyled.has(id)||styleOf(q)===style)return;restyled.add(id);const b=curveBounds(q);let changed=false;for(let y=Math.max(0,Math.floor(b.y0/64));y<Math.min(ROWS,Math.ceil(b.y1/64));y++)for(let x=Math.max(0,Math.floor(b.x0/64));x<Math.min(COLS,Math.ceil(b.x1/64));x++){const k=key(x,y),a=edits.get(k)||cell(d,x,y);if(a.stairs||a.bridge)continue;const curves=[...(a.curves||[])],index=curves.findIndex(c=>featureKey(c)===id);if(index>=0)curves[index]={...curves[index],style};else{if(a.level!==prototype.level||q.kind==='surface'&&a.surface!==prototype.surface||curves.length>=8)continue;curves.push({...q,style});}edits.set(k,{...a,curves});changed=true;}if(changed)corners++;}
 for(let y=Math.max(1,cy-scan);y<=Math.min(ROWS-2,cy+scan);y++)for(let x=Math.max(1,cx-scan);x<=Math.min(COLS-2,cx+scan);x++){
  const a=cell(d,x,y);if(a.stairs||a.bridge)continue;if(a.curves?.length){for(const q of a.curves)restyle(q,a);continue;}
  for(const[dx,dy,corner]of [[-1,-1,'nw'],[1,-1,'ne'],[-1,1,'sw'],[1,1,'se']]){
   const h=cell(d,x+dx,y),v=cell(d,x,y+dy),diag=cell(d,x+dx,y+dy),kind=h.level<a.level&&v.level<a.level&&diag.level<a.level?'height':a.surface!=='grass'&&h.level===a.level&&v.level===a.level&&h.surface!==a.surface&&v.surface!==a.surface&&diag.surface!==a.surface?'surface':null;if(!kind)continue;
   const matches=(xx,yy)=>{if(xx<0||yy<0||xx>=COLS||yy>=ROWS)return false;const b=cell(d,xx,yy);return !b.stairs&&!b.bridge&&b.level===a.level&&(kind==='height'||b.surface===a.surface);};
   let runX=1,runY=1;while(runX<16&&matches(x-dx*runX,y))runX++;while(runY<16&&matches(x,y-dy*runY))runY++;
   let r=Math.min(radius*64,runX*32,runY*32),q;
   // Retain the original high/material cells under the mask so all styles can
   // be changed back without progressively eroding or shrinking the corner.
   for(;r>=16;r-=16){const vx=(x+(dx>0?1:0))*64,vy=(y+(dy>0?1:0))*64;q={corner,cx:vx-dx*r,cy:vy-dy*r,r,kind,underX:x+dx,underY:y+dy,style};const b=curveBounds(q);let fits=true;for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64)&&fits;yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++)if(!matches(xx,yy)){fits=false;break;}if(fits)break;}
   if(r<16)continue;const b=curveBounds(q);corners++;
   for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64);yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++){const k=key(xx,yy),old=edits.get(k)||cell(d,xx,yy),curves=[...(old.curves||[])];if(curves.length<8){curves.push(q);edits.set(k,{...old,curves});}}
  }
 }
 return {edits:[...edits],corners};
}
