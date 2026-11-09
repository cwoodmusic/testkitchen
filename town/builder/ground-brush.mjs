import {cell,key,COLS,ROWS,RISE} from '../world/model.mjs?v=queues-stage-1';
import {roundedUnder} from '../world/round-geometry.mjs?v=queues-stage-1';
import {PAINT_GRID,PAINT_STEP,groundMaterials,materialKey,readPaint,encodePaint} from '../world/ground-paint.mjs?v=queues-stage-1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),PIXELS=PAINT_GRID*PAINT_GRID;
// Pointer interpolation is in world units, independent of pointer-event rate.
export function brushPoints(from,to,size=192){if(!from)return [{...to}];const distance=Math.hypot(to.x-from.x,to.y-from.y);if(!distance)return [];const count=Math.ceil(distance/Math.max(PAINT_STEP,Math.min(24,size*.12)));return Array.from({length:count},(_,i)=>({x:from.x+(to.x-from.x)*(i+1)/count,y:from.y+(to.y-from.y)*(i+1)/count}));}
export function paintGround(doc,p,{size=192,hardness=.45,opacity=.8,surface='dirt',paving='auto',mode='paint',blendRadius=16}={}){
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!groundMaterials.includes(surface)&&mode!=='blend')return {edits:[],changed:false};
 const radius=clamp(Number(size)||192,8,1024)/2,strength=clamp(Number(opacity)||0,0,1),hard=clamp(Number(hardness)||0,0,1),feather=radius*(1-hard),edits=[],decoded=new Map(),samples=new Map(),target=surface==='cobble'?{surface,paving}: {surface},kernel=[1,4,6,4,1],step=Math.max(PAINT_STEP,Math.round(clamp(Number(blendRadius)||16,4,64)/2/PAINT_STEP)*PAINT_STEP);
 if(!strength)return {edits,changed:false};
 function tile(x,y){const k=key(x,y);if(!decoded.has(k)){const a=cell(doc,x,y),paint=readPaint(a);decoded.set(k,{a,...paint,keys:paint.materials.map(materialKey)});}return decoded.get(k);}
 function sample(gx,gy){if(gx<0||gy<0||gx>=COLS*PAINT_GRID||gy>=ROWS*PAINT_GRID)return null;const k=gy*COLS*PAINT_GRID+gx;if(samples.has(k))return samples.get(k);const x=Math.floor(gx/PAINT_GRID),y=Math.floor(gy/PAINT_GRID),t=tile(x,y),wx=gx*PAINT_STEP+PAINT_STEP/2,wy=gy*PAINT_STEP+PAINT_STEP/2;let result=null;if(!t.a.stairs&&!t.a.bridge&&groundMaterials.includes(t.a.surface)&&!roundedUnder(doc,t.a,wx,wy))result={...t,offset:((gy%PAINT_GRID)*PAINT_GRID+gx%PAINT_GRID)*t.materials.length,z:t.a.level*RISE};samples.set(k,result);return result;}
 const x0=Math.max(0,Math.floor((p.x-radius)/64)),x1=Math.min(COLS-1,Math.floor((p.x+radius)/64)),y0=Math.max(0,Math.floor((p.y-radius)/64)),y1=Math.min(ROWS-1,Math.floor((p.y+radius)/64));
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const source=tile(x,y);if(source.a.stairs||source.a.bridge||!groundMaterials.includes(source.a.surface))continue;
  const channels=new Map(),materials=new Map();function channel(m){const k=materialKey(m);if(!channels.has(k)){channels.set(k,new Float64Array(PIXELS));materials.set(k,m);}return channels.get(k);}
  for(let i=0;i<source.materials.length;i++){const values=channel(source.materials[i]);for(let n=0;n<PIXELS;n++)values[n]=source.weights[n*source.materials.length+i];}
  if(mode!=='blend')channel(target);const targetKey=materialKey(target);let touched=false;
  for(let gy=0;gy<PAINT_GRID;gy++)for(let gx=0;gx<PAINT_GRID;gx++){
   const wx=x*64+(gx+.5)*PAINT_STEP,wy=y*64+(gy+.5)*PAINT_STEP,distance=Math.hypot(wx-p.x,wy-p.y);if(distance>=radius)continue;
   const current=sample(x*PAINT_GRID+gx,y*PAINT_GRID+gy);if(!current)continue;
   const t=feather?clamp((radius-distance)/feather,0,1):1,alpha=strength*t*t*(3-2*t);if(alpha<1/1024)continue;
   const wanted=new Map();let total=0;
   if(mode==='blend'){
    for(let ky=-2;ky<=2;ky++)for(let kx=-2;kx<=2;kx++){
     const neighbor=sample(x*PAINT_GRID+gx+kx*step/PAINT_STEP,y*PAINT_GRID+gy+ky*step/PAINT_STEP);if(!neighbor||neighbor.z!==current.z)continue;const weight=kernel[kx+2]*kernel[ky+2];total+=weight;
     for(let i=0;i<neighbor.materials.length;i++){const m=neighbor.materials[i],k=neighbor.keys[i];if(!wanted.has(k))wanted.set(k,{material:m,value:0});wanted.get(k).value+=neighbor.weights[neighbor.offset+i]*weight;}
    }
    if(!total)continue;for(const value of wanted.values())value.value/=total;
   }
   const n=gy*PAINT_GRID+gx;if(mode==='blend'){for(const {material}of wanted.values())channel(material);for(const[k,values]of channels)values[n]=values[n]*(1-alpha)+(wanted.get(k)?.value||0)*alpha;}else for(const[k,values]of channels)values[n]=values[n]*(1-alpha)+(k===targetKey?255:0)*alpha;touched=true;
  }
  if(!touched)continue;
  const list=[...materials.values()],weights=new Float64Array(PIXELS*list.length),values=[...channels.values()];for(let n=0;n<PIXELS;n++)for(let i=0;i<list.length;i++)weights[n*list.length+i]=values[i][n];
  const paint=encodePaint(list,weights),before=source.a.paint||encodePaint(source.materials,source.weights);if(paint.weights===before.weights&&JSON.stringify(paint.materials)===JSON.stringify(before.materials)&&!source.a.sidewalkCurb)continue;
  const next={...source.a};delete next.sidewalkCurb;if(paint.materials.length===1&&materialKey(paint.materials[0])===materialKey(source.a))delete next.paint;else next.paint=paint;edits.push([key(x,y),next]);
 }
 return {edits,changed:edits.length>0};
}
