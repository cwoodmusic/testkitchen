import {cell,key,COLS,ROWS} from '../world/model.mjs?v=collision-layers-1';
import {curveBounds,cornerStyles} from '../world/round-geometry.mjs?v=collision-layers-1';
const featureKey=q=>[q.corner,q.cx,q.cy,q.r,q.kind,q.underX,q.underY,q.lift||0,q.concave?1:0,q.under?.surface,q.under?.level,q.under?.paving].join(':');
const styleOf=q=>cornerStyles.includes(q.style)?q.style:'smooth';
const directions=[[-1,-1,'nw'],[1,-1,'ne'],[-1,1,'sw'],[1,1,'se']];
const inMap=(x,y)=>x>=0&&y>=0&&x<COLS&&y<ROWS;
const available=a=>!a.stairs&&!a.bridge;
function snapshot(a){const out={surface:a.surface,level:a.level};if(a.paving!==undefined)out.paving=a.paving;if(a.paint)out.paint=a.paint;return out;}

export function roundTerrain(d,p,width=3,style='smooth'){
 style=cornerStyles.includes(style)?style:'smooth';
 const edits=new Map(),radius=Math.max(1,Math.min(8,Math.floor(Number(width)||1))),scan=Math.floor(radius/2),cx=Math.floor(p.x/64),cy=Math.floor(p.y/64),restyled=new Set();let corners=0;
 const compatible=(x,y,kind)=>(edits.get(key(x,y))||cell(d,x,y)).curves?.every(q=>q.kind===kind)??true;
 function restyle(q,prototype){
  const id=featureKey(q);if(restyled.has(id)||styleOf(q)===style)return;restyled.add(id);
  const b=curveBounds(q);let changed=false;
  for(let y=Math.max(0,Math.floor(b.y0/64));y<Math.min(ROWS,Math.ceil(b.y1/64));y++)for(let x=Math.max(0,Math.floor(b.x0/64));x<Math.min(COLS,Math.ceil(b.x1/64));x++){
   const k=key(x,y),a=edits.get(k)||cell(d,x,y);if(!available(a))continue;
   const curves=[...(a.curves||[])],index=curves.findIndex(c=>featureKey(c)===id);
   if(index>=0)curves[index]={...curves[index],style};
   else{if(a.level!==prototype.level||q.kind==='surface'&&a.surface!==prototype.surface||curves.some(c=>c.kind!==q.kind)||curves.length>=8)continue;curves.push({...q,style});}
   edits.set(k,{...a,curves});changed=true;
  }
  if(changed)corners++;
 }
 function stamp(q,prototype){
  const b=curveBounds(q);corners++;
  for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64);yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++){
   const k=key(xx,yy),old=edits.get(k)||cell(d,xx,yy),curves=[...(old.curves||[])];if(curves.length>=8)continue;
   const next={...old,curves:[...curves,q]};
   if(q.concave){next.level=prototype.level;if(next.surface!==prototype.surface||q.kind==='surface'){next.surface=prototype.surface;delete next.paint;if(prototype.paving!==undefined)next.paving=prototype.paving;else delete next.paving;}}
   edits.set(k,next);
  }
 }
 for(let y=Math.max(1,cy-scan);y<=Math.min(ROWS-2,cy+scan);y++)for(let x=Math.max(1,cx-scan);x<=Math.min(COLS-2,cx+scan);x++){
  const a=cell(d,x,y);if(!available(a))continue;
  if(a.curves?.length){for(const q of a.curves)restyle(q,a);continue;}
  for(const[dx,dy,corner]of directions){
   const h=cell(d,x+dx,y),v=cell(d,x,y+dy),diag=cell(d,x+dx,y+dy);
   // Outside corners retain the circle inside the original raised/material area.
   const kind=h.level<a.level&&v.level<a.level&&diag.level<a.level?'height':a.surface!=='grass'&&h.level===a.level&&v.level===a.level&&h.surface!==a.surface&&v.surface!==a.surface&&diag.surface!==a.surface?'surface':null;
   if(kind){
    const matches=(xx,yy)=>{if(!inMap(xx,yy)||!compatible(xx,yy,kind))return false;const b=cell(d,xx,yy);return available(b)&&b.level===a.level&&(kind==='height'||b.surface===a.surface);};
    let runX=1,runY=1;while(runX<16&&matches(x-dx*runX,y))runX++;while(runY<16&&matches(x,y-dy*runY))runY++;
    let r=Math.min(radius*64,runX*32,runY*32),q;
    // Keep original cells under the mask so changing styles is reversible.
    for(;r>=16;r-=16){
     const vx=(x+(dx>0?1:0))*64,vy=(y+(dy>0?1:0))*64;q={corner,cx:vx-dx*r,cy:vy-dy*r,r,kind,underX:x+dx,underY:y+dy,style};
     const b=curveBounds(q);let fits=true;
     for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64)&&fits;yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++)if(!matches(xx,yy)){fits=false;break;}
     if(fits)break;
    }
    if(r>=16)stamp(q,a);
    continue;
   }
   // An inside corner is the empty quarter of three matching arms. Add a
   // complementary fillet there, rather than cutting either arm away.
   const innerKind=h.level>a.level&&v.level===h.level&&diag.level===h.level?'height':h.level===a.level&&v.level===a.level&&diag.level===a.level&&h.surface!=='grass'&&h.surface!==a.surface&&v.surface===h.surface&&diag.surface===h.surface?'surface':null;
   if(!innerKind||!available(h)||!available(v)||!available(diag))continue;
   const matchesLow=(xx,yy)=>{if(!inMap(xx,yy)||!compatible(xx,yy,innerKind))return false;const b=cell(d,xx,yy);return available(b)&&b.level===a.level&&(innerKind==='height'||b.surface===a.surface);};
   const matchesHigh=(xx,yy)=>{if(!inMap(xx,yy))return false;const b=cell(d,xx,yy);return available(b)&&b.level===h.level&&(innerKind==='height'||b.surface===h.surface);};
   let lowX=1,lowY=1,armX=1,armY=1;
   while(lowX<16&&matchesLow(x-dx*lowX,y))lowX++;while(lowY<16&&matchesLow(x,y-dy*lowY))lowY++;
   while(armX<16&&matchesHigh(x-dx*armX,y+dy))armX++;while(armY<16&&matchesHigh(x+dx,y-dy*armY))armY++;
   let r=Math.min(radius*64,lowX*32,lowY*32,armX*64,armY*64),q;
   for(;r>=16;r-=16){
    const vx=(x+(dx>0?1:0))*64,vy=(y+(dy>0?1:0))*64;
    q={corner,cx:vx-dx*r,cy:vy-dy*r,r,kind:innerKind,underX:x-dx*Math.ceil(r/64),underY:y-dy*Math.ceil(r/64),style,concave:true};
    const b=curveBounds(q);let fits=true;
    for(let yy=Math.floor(b.y0/64);yy<Math.ceil(b.y1/64)&&fits;yy++)for(let xx=Math.floor(b.x0/64);xx<Math.ceil(b.x1/64);xx++)if(!matchesLow(xx,yy)){fits=false;break;}
    if(fits)break;
   }
   if(r<16)continue;
   // A neighboring notch can fill the apparent donor in this very stroke.
   // Preserve the original floor independently of every added fillet.
   q.under=snapshot(a);if(!inMap(q.underX,q.underY)){q.underX=x;q.underY=y;}
   stamp(q,h);
  }
 }
 // Added inside fillets can occupy a floor referenced by a new or historical
 // outside corner. Freeze that floor before its donor changes, including
 // affected corners outside this brush. Clone metadata so planning stays pure.
 const changedDonors=new Map();
 for(const[k,next]of edits){const old=d.cells[k]||{surface:'grass',level:0};if(next.level!==old.level||next.surface!==old.surface||next.paving!==old.paving||next.paint!==old.paint)changedDonors.set(k,snapshot(old));}
 if(changedDonors.size){
  const replacements=new WeakMap(),keys=new Set([...Object.keys(d.cells),...edits.keys()]);
  for(const k of keys){
   const a=edits.get(k)||d.cells[k];if(!a?.curves?.length)continue;let changed=false;
   const curves=a.curves.map(q=>{const floor=changedDonors.get(key(q.underX,q.underY));if(q.under||!floor)return q;changed=true;if(!replacements.has(q))replacements.set(q,{...q,under:floor});return replacements.get(q);});
   if(changed)edits.set(k,{...a,curves});
  }
 }
 return {edits:[...edits],corners};
}
