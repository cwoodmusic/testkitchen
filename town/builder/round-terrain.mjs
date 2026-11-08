import {cell,key,COLS,ROWS} from '../world/model.mjs?v=cliff-pack-2';
import {insideCurve,curveBounds} from '../world/round-geometry.mjs';
export function roundTerrain(d,p,width=3){const edits=new Map(),radius=Math.max(1,Math.min(8,Math.floor(Number(width)||1))),scan=Math.floor(radius/2),cx=Math.floor(p.x/64),cy=Math.floor(p.y/64);let corners=0;
 for(let y=Math.max(1,cy-scan);y<=Math.min(ROWS-2,cy+scan);y++)for(let x=Math.max(1,cx-scan);x<=Math.min(COLS-2,cx+scan);x++){
  const a=cell(d,x,y);if(a.stairs||a.bridge||a.curves?.length)continue;
  for(const[dx,dy,corner]of [[-1,-1,'nw'],[1,-1,'ne'],[-1,1,'sw'],[1,1,'se']]){
   const h=cell(d,x+dx,y),v=cell(d,x,y+dy),diag=cell(d,x+dx,y+dy),kind=h.level<a.level&&v.level<a.level&&diag.level<a.level?'height':a.surface!=='grass'&&h.level===a.level&&v.level===a.level&&h.surface!==a.surface&&v.surface!==a.surface&&diag.surface!==a.surface?'surface':null;if(!kind)continue;
   const matches=(xx,yy)=>{if(xx<0||yy<0||xx>=COLS||yy>=ROWS)return false;const b=cell(d,xx,yy);return !b.stairs&&!b.bridge&&b.level===a.level&&(kind==='height'||b.surface===a.surface);};
   let runX=1,runY=1;while(runX<16&&matches(x-dx*runX,y))runX++;while(runY<16&&matches(x,y-dy*runY))runY++;
   let r=Math.min(radius*64,runX*32,runY*32),q;
   // Shrink rather than cutting through another terrace or a narrow concavity.
   for(;r>=16;r-=16){const vx=(x+(dx>0?1:0))*64,vy=(y+(dy>0?1:0))*64;q={corner,cx:vx-dx*r,cy:vy-dy*r,r,kind,underX:x+dx,underY:y+dy};const b=curveBounds(q);let fits=true;for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64)&&fits;yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++)if(!matches(xx,yy)){fits=false;break;}if(fits)break;}
   if(r<16)continue;const b=curveBounds(q);corners++;
   for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64);yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++){const k=key(xx,yy),old=edits.get(k)||{...cell(d,xx,yy)},points=[[xx*64,yy*64],[(xx+1)*64,yy*64],[xx*64,(yy+1)*64],[(xx+1)*64,(yy+1)*64]],inside=points.map(([px,py])=>insideCurve(q,px,py));if(inside.every(Boolean))continue;
    if(inside.every(v=>!v)){edits.set(k,{surface:diag.surface,level:kind==='height'?diag.level:a.level});continue;}
    const curves=[...(old.curves||[])];if(curves.length<8){curves.push(q);edits.set(k,{...old,curves});}
   }
  }
 }
 return {edits:[...edits],corners};
}
