import {leisureDefinitions,leisureFamilies,leisureSheetCounts} from './leisure-definitions.mjs?v=north-walls-1';

const assetURL=path=>{const url=new URL('../assets/leisure/'+path,import.meta.url);url.search=new URL(import.meta.url).search;return url;};
const image=path=>new Promise((resolve,reject)=>{
 const source=new Image();source.onload=()=>resolve(source);
 source.onerror=()=>reject(Error('Picnic and beach artwork could not load: '+path));
 source.src=assetURL(path);
});
function sheetValid(s){
 return s&&leisureFamilies.includes(s.family)&&typeof s.file==='string'&&typeof s.thumb==='string'&&
  Number.isInteger(s.width)&&s.width>0&&Number.isInteger(s.height)&&s.height>0&&Array.isArray(s.cells)&&s.cells.length===leisureSheetCounts[s.family]&&
  s.cells.every(r=>r&&[r.x,r.y,r.w,r.h].every(Number.isInteger)&&r.x>=0&&r.y>=0&&r.w>0&&r.h>0&&r.x+r.w<=s.width&&r.y+r.h<=s.height);
}

export async function registerLeisure(catalog){
 const response=await fetch(assetURL('atlas.json'));
 if(!response.ok)throw Error('Picnic and beach atlas metadata unavailable.');
 const sheets=await response.json();
 if(!Array.isArray(sheets)||sheets.length!==leisureFamilies.length||sheets.some(s=>!sheetValid(s))||new Set(sheets.map(s=>s.family)).size!==leisureFamilies.length)throw Error('Picnic and beach atlas must contain its complete picnic, beach and directional seating sheets.');
 const thumbs=new Map(await Promise.all(sheets.map(async s=>[s.family,await image(s.thumb)]))),full=new Map(),pending=new Map();
 function ensure(s){
  if(full.has(s.family))return Promise.resolve(full.get(s.family));
  if(!pending.has(s.family))pending.set(s.family,image(s.file).then(source=>{
   if(source.width!==s.width||source.height!==s.height)throw Error('Picnic and beach artwork dimensions do not match its atlas.');
   full.set(s.family,source);return source;
  }).finally(()=>pending.delete(s.family)));
  return pending.get(s.family);
 }
 for(const def of leisureDefinitions){
  const s=sheets.find(s=>s.family===def.family),r=s.cells[def.index];
  // All eight directional seats share the artist's source-to-world scale.
  // Fitting a wider side view into a front-view width would shrink the chair.
  const fit=def.worldCellSize?def.worldCellSize/(s.height/2):Math.min(def.maxW/r.w,def.maxH/r.h),w=Math.ceil(r.w*fit),h=Math.ceil(r.h*fit);
  const boxes=def.feet.map(b=>({x:b.x*w,y:b.y*h,w:b.w*w,h:b.h*h}));
  let cached=null,cacheSource=null;
  const a={id:def.id,name:def.name,group:def.group,w,h,boxes,layer:def.layer,collisionDefault:def.solid,pack:'town-leisure-38',kit:'urban',facing:def.facing||'south',authoredFacing:!!def.authoredFacing,ensureFull:()=>ensure(s)};
  if(def.lightEmitters)a.lightEmitters=def.lightEmitters.map(e=>({...e,color:[...e.color]}));
  const drawNative=c=>{
   const source=full.get(s.family)||thumbs.get(s.family),sx=source.width/s.width,sy=source.height/s.height;
   c.drawImage(source,r.x*sx,r.y*sy,r.w*sx,r.h*sy,0,0,w,h);
  };
  a.draw=drawNative;
  // Keep the original source getter independent of optional facing previews.
  // A corrected South draw must never repaint this preserved native canvas.
  Object.defineProperty(a,'canvas',{get(){
   const source=full.get(s.family)||thumbs.get(s.family);
   if(!full.has(s.family))ensure(s).catch(()=>{});
   if(!cached||source!==cacheSource){cached=document.createElement('canvas');cached.width=w;cached.height=h;drawNative(cached.getContext('2d'));cacheSource=source;}
   return cached;
  }});
  catalog.set(a.id,a);
 }
}
