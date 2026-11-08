// Material weights live below the terrain grid: a 4-world-pixel sample keeps
// round brushes smooth while remaining compact in portable version-1 maps.
export const PAINT_GRID=16,PAINT_STEP=4;
export const groundMaterials=['grass','cobble','dirt','wood','sand'];
const PIXELS=PAINT_GRID*PAINT_GRID,MAX_MATERIALS=8;
const descriptor=m=>m.surface==='cobble'?{surface:'cobble',paving:m.paving||'auto'}:{surface:m.surface};
export const materialKey=m=>m.surface==='cobble'?'cobble:'+(m.paving||'auto'):m.surface;
export function decodePaint(paint){const binary=atob(paint.weights);return {materials:paint.materials,weights:Uint8Array.from(binary,c=>c.charCodeAt(0))};}
export function readPaint(a){if(a.paint)return decodePaint(a.paint);return {materials:[descriptor(a)],weights:new Uint8Array(PIXELS).fill(255)};}

// Quantize by largest remainder so additive rendering always has total alpha
// 255. Duplicate/unused channels disappear; at most eight materials are saved.
export function encodePaint(materials,weights){
 const unique=[],indices=[],lookup=new Map();
 for(const material of materials){const m=descriptor(material),key=materialKey(m);if(!lookup.has(key)){lookup.set(key,unique.length);unique.push(m);}indices.push(lookup.get(key));}
 const source=new Float64Array(PIXELS*unique.length),coverage=new Float64Array(unique.length);
 for(let p=0;p<PIXELS;p++)for(let i=0;i<materials.length;i++){const value=Math.max(0,Number(weights[p*materials.length+i])||0),j=indices[i];source[p*unique.length+j]+=value;coverage[j]+=value;}
 let kept=unique.map((_,i)=>i).filter(i=>coverage[i]>1e-8);
 if(!kept.length)kept=[0];
 if(kept.length>MAX_MATERIALS)kept=kept.sort((a,b)=>coverage[b]-coverage[a]||a-b).slice(0,MAX_MATERIALS).sort((a,b)=>a-b);
 const out=new Uint8Array(PIXELS*kept.length);
 if(kept.length===1)out.fill(255);
 else for(let p=0;p<PIXELS;p++){
  const total=kept.reduce((sum,i)=>sum+source[p*unique.length+i],0);let assigned=0;
  if(kept.length===2){out[p*2]=total?Math.round(source[p*unique.length+kept[0]]*255/total):255;out[p*2+1]=255-out[p*2];continue;}
  const fractions=kept.map((i,j)=>{const value=total?source[p*unique.length+i]*255/total:j===0?255:0,n=Math.floor(value);out[p*kept.length+j]=n;assigned+=n;return {j,f:value-n};});
  fractions.sort((a,b)=>b.f-a.f||a.j-b.j);for(let i=0;i<255-assigned;i++)out[p*kept.length+fractions[i%fractions.length].j]++;
 }
 let binary='';for(const value of out)binary+=String.fromCharCode(value);
 return {materials:kept.map(i=>unique[i]),weights:btoa(binary)};
}
export function validPaint(paint,ids){
 if(!paint||typeof paint!=='object'||!Array.isArray(paint.materials)||paint.materials.length<1||paint.materials.length>MAX_MATERIALS||typeof paint.weights!=='string')return false;
 const seen=new Set();for(const m of paint.materials){if(!m||!groundMaterials.includes(m.surface)||m.paving!==undefined&&(m.surface!=='cobble'||typeof m.paving!=='string'||m.paving!=='auto'&&!ids.has(m.paving)))return false;const key=materialKey(m);if(seen.has(key))return false;seen.add(key);}
 const length=PIXELS*paint.materials.length;if(paint.weights.length!==Math.ceil(length/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(paint.weights))return false;
 try{const {weights}=decodePaint(paint);if(weights.length!==length)return false;for(let p=0;p<PIXELS;p++){let sum=0;for(let i=0;i<paint.materials.length;i++)sum+=weights[p*paint.materials.length+i];if(sum!==255)return false;}}catch{return false;}return true;
}
