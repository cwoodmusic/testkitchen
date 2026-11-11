import {COLS,ROWS,TILE,cell,key} from '../world/model.mjs?v=door-price-2';
import {roundedUnder,curveUnder} from '../world/round-geometry.mjs?v=door-price-2';
import {MASK_GRID,MASK_STEP,encodeMask} from '../world/organic-mask.mjs?v=door-price-2';
import {readPaint,encodePaint,materialKey} from '../world/ground-paint.mjs?v=door-price-2';

const PIXELS=MASK_GRID*MASK_GRID;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const priority={water:0,cobble:1,asphalt:2,sidewalk:3,brick:4,wood:5,dirt:6,grass:7,sand:8};
const signature=a=>`${a.level}:${a.surface}:${a.paving||''}`;
function snapshot(a){const out={surface:a.surface,level:a.level};if(a.paving!==undefined)out.paving=a.paving;if(a.paint)out.paint=a.paint;return out;}
function rank(a,b){return a.level-b.level||(priority[a.surface]??0)-(priority[b.surface]??0);}
function hash(x,y,seed){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295*2-1;}
function noise(x,y,period,seed){
 x/=period;y/=period;const X=Math.floor(x),Y=Math.floor(y),fx=x-X,fy=y-Y,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
 const a=hash(X,Y,seed)*(1-sx)+hash(X+1,Y,seed)*sx,b=hash(X,Y+1,seed)*(1-sx)+hash(X+1,Y+1,seed)*sx;return a*(1-sy)+b*sy;
}

// The brush changes a narrow band around the real coast. Its circular cursor
// only limits influence; the shore itself follows a continuous, world-anchored
// noise field and local smoothing, so repeated dabs do not stamp circular arcs.
export function planOrganicEdges(doc,p,{size=192,strength=.5}={}){
 const fail=message=>({edits:[],count:0,message});
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return fail('Brush along a shoreline or terrain edge.');
 const amount=clamp(Number(strength)||0,0,1),radius=clamp(Number(size)||192,16,960)/2;
 if(!amount)return fail('Increase edge strength to shape this shoreline.');
 const samples=new Map(),tiles=new Map(),edits=new Map(),paints=new WeakMap();
 function visibleMaterial(a,i,level){
  let field;
  if(a.paint){if(!paints.has(a.paint))paints.set(a.paint,readPaint(a));field=paints.get(a.paint);}
  let material=a;
  if(field){let best=0;for(let j=1;j<field.materials.length;j++)if(field.weights[i*field.materials.length+j]>field.weights[i*field.materials.length+best])best=j;material=field.materials[best];}
  return {material:{surface:material.surface,level,...(material.surface==='cobble'?{paving:material.paving||'auto'}:{})},field,index:i};
 }
 function sample(gx,gy){
  const id=`${gx},${gy}`;if(samples.has(id))return samples.get(id);
  const x=Math.floor(gx/MASK_GRID),y=Math.floor(gy/MASK_GRID);if(x<0||y<0||x>=COLS||y>=ROWS)return null;
  const a=cell(doc,x,y),X=(gx+.5)*MASK_STEP,Y=(gy+.5)*MASK_STEP,q=roundedUnder(doc,a,X,Y),under=q?curveUnder(doc,q):a;
  const visible=visibleMaterial(under,(gy%MASK_GRID+MASK_GRID)%MASK_GRID*MASK_GRID+(gx%MASK_GRID+MASK_GRID)%MASK_GRID,q?.kind==='height'?under.level:a.level),material=visible.material,value={...visible,material,id:signature(material),x,y,protected:!!(a.stairs||a.bridge)};samples.set(id,value);return value;
 }
 function tile(x,y){
  const k=key(x,y);if(tiles.has(k))return tiles.get(k);const a=cell(doc,x,y),materials=new Map(),grid=[];
  if(!a.curves?.length&&!a.paint){const material=snapshot(a),id=signature(material),s={material,id,x,y,protected:!!(a.stairs||a.bridge)},value={a,grid:new Array(PIXELS).fill(s),materials:new Map([[id,material]])};tiles.set(k,value);return value;}
  for(let gy=0;gy<MASK_GRID;gy++)for(let gx=0;gx<MASK_GRID;gx++){const s=sample(x*MASK_GRID+gx,y*MASK_GRID+gy);grid.push(s);materials.set(s.id,s.material);}
  const value={a,grid,materials};tiles.set(k,value);return value;
 }
 const x0=Math.max(0,Math.floor((p.x-radius)/TILE)),x1=Math.min(COLS-1,Math.floor((p.x+radius)/TILE)),y0=Math.max(0,Math.floor((p.y-radius)/TILE)),y1=Math.min(ROWS-1,Math.floor((p.y+radius)/TILE));
 let count=0;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const flat=cell(doc,x,y);
  if(!flat.curves?.length&&!flat.paint&&[-1,0,1].every(dy=>[-1,0,1].every(dx=>{const b=cell(doc,x+dx,y+dy);return !b.curves?.length&&!b.paint&&signature(b)===signature(flat);})))continue;
  const current=tile(x,y),a=current.a;if(a.stairs||a.bridge||current.materials.size>2)continue;
  const pair=new Map(current.materials);
  if(pair.size===1){
   const other=new Map(),own=current.grid[0].id;
   for(let i=-3;i<MASK_GRID+3;i++)for(const[gx,gy]of [[i,-3],[i,MASK_GRID+2],[-3,i],[MASK_GRID+2,i]]){
    const s=sample(x*MASK_GRID+gx,y*MASK_GRID+gy);if(!s||s.protected||s.id===own)continue;
    if(!other.has(s.id))other.set(s.id,{material:s.material,count:0});other.get(s.id).count++;
   }
   const best=[...other.values()].sort((a,b)=>b.count-a.count||rank(b.material,a.material))[0];if(best)pair.set(signature(best.material),best.material);
  }
  if(pair.size!==2)continue;
  const [background,foreground]=[...pair.values()].sort(rank),fg=signature(foreground),bg=signature(background),mask=new Uint8Array(PIXELS);
  let changed=false;
  const occupancy=(gx,gy)=>{const s=sample(gx,gy);return !s||s.protected||s.id!==fg&&s.id!==bg?null:s.id===fg?1:0;};
  for(let gy=0;gy<MASK_GRID;gy++)for(let gx=0;gx<MASK_GRID;gx++){
   const i=gy*MASK_GRID+gx,GX=x*MASK_GRID+gx,GY=y*MASK_GRID+gy,X=(GX+.5)*MASK_STEP,Y=(GY+.5)*MASK_STEP,old=current.grid[i].id===fg?1:0;mask[i]=old;
   const distance=Math.hypot(X-p.x,Y-p.y);if(distance>=radius)continue;
   const fall=clamp((radius-distance)/(radius*.42),0,1),influence=fall*fall*(3-2*fall),reach=1+Math.floor(amount*influence*2),warp=32*amount*influence;
   // Every changed point must be close to an existing opposite material.
   // This preserves broad interiors and prevents detached noisy speckles.
   let boundary=false;
   for(let j=-reach;j<=reach&&!boundary;j++)for(let k=-reach;k<=reach;k++){if(k*k+j*j>reach*reach)continue;const v=occupancy(GX+k,GY+j);if(v!==null&&v!==old){boundary=true;break;}}
   if(!boundary)continue;
   const wx=(noise(X,Y,144,7)*.75+noise(X,Y,48,11)*.25)*warp,wy=(noise(X,Y,144,23)*.75+noise(X,Y,48,29)*.25)*warp;
   const cx=Math.floor((X+wx)/MASK_STEP),cy=Math.floor((Y+wy)/MASK_STEP),kernel=[1,2,1];let total=0,covered=0;
   for(let j=-1;j<=1;j++)for(let k=-1;k<=1;k++){const v=occupancy(cx+k*2,cy+j*2);if(v===null)continue;const w=kernel[k+1]*kernel[j+1];total+=w;covered+=v*w;}
   if(!total)continue;const wanted=covered/total>=.5+noise(X,Y,24,41)*.055?1:0;
   if(wanted!==old){mask[i]=wanted;changed=true;}
  }
  if(!changed)continue;
  // A painted tile's base surface can differ from the color actually visible
  // in the brush. Preserve blends at unchanged samples; newly shaped samples
  // receive the material being extended, rather than a neighboring paint map.
  function layer(material,id,value){
   const out=snapshot(material);if(!current.grid.some(s=>s.field))return out;
   const materials=[],lookup=new Map(),channels=[];
   const channel=m=>{const k=materialKey(m);if(!lookup.has(k)){lookup.set(k,materials.length);materials.push(m);channels.push(new Float64Array(PIXELS));}return channels[lookup.get(k)];};
   for(let i=0;i<PIXELS;i++){
    const old=current.grid[i];
    if(mask[i]===value&&old.id===id&&old.field){for(let j=0;j<old.field.materials.length;j++)channel(old.field.materials[j])[i]=old.field.weights[old.index*old.field.materials.length+j];}
    else channel(material)[i]=255;
   }
   const weights=new Float64Array(PIXELS*materials.length);for(let i=0;i<PIXELS;i++)for(let j=0;j<materials.length;j++)weights[i*materials.length+j]=channels[j][i];
   const paint=encodePaint(materials,weights);if(paint.materials.length>1)out.paint=paint;
   return out;
  }
  const fore=layer(foreground,fg,1),back=layer(background,bg,0),next={...a,...fore};delete next.curves;if(fore.paint===undefined)delete next.paint;if(fore.paving===undefined)delete next.paving;if(next.surface!==a.surface||next.paint!==a.paint)delete next.sidewalkCurb;
  let kept=0;for(const value of mask)kept+=value;
  if(!kept){next.surface=back.surface;next.level=back.level;if(back.paint!==undefined)next.paint=back.paint;else delete next.paint;if(back.paving!==undefined)next.paving=back.paving;else delete next.paving;}
  else if(kept<PIXELS)next.curves=[{kind:fore.level===back.level?'surface':'height',corner:'nw',cx:(x+1)*TILE,cy:(y+1)*TILE,r:TILE,underX:x,underY:y,under:back,mask:encodeMask(mask)}];
  edits.set(key(x,y),next);count++;
 }
 // Freeze old raw donor floors before a tile changes its foreground. Other
 // corners can point into the edited band; their original height must remain.
 const donors=new Map();for(const[k,next]of edits){const old=doc.cells[k]||{surface:'grass',level:0};if(next.level!==old.level||next.surface!==old.surface||next.paint!==old.paint||next.paving!==old.paving)donors.set(k,snapshot(old));}
 if(donors.size)for(const k of new Set([...Object.keys(doc.cells),...edits.keys()])){
  const a=edits.get(k)||doc.cells[k];if(!a?.curves?.length)continue;let touched=false;
  const curves=a.curves.map(q=>{const under=donors.get(key(q.underX,q.underY));if(q.under||!under)return q;touched=true;return {...q,under};});if(touched)edits.set(k,{...a,curves});
 }
 return {edits:[...edits],count,message:count?`Shaped ${count} terrain tiles with organic edges.`:'Brush across a shoreline or height boundary to break up its straight edges.'};
}
