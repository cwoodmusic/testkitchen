import {decorCollisionBoxes} from './scene-collision.mjs?v=opera-shells-1';
import {decorDefinitions} from './decor-definitions.mjs?v=opera-shells-1';
const image=path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Artwork could not load: '+path));i.src=new URL('../assets/decor/'+path,import.meta.url);});
export async function registerDecor(catalog){const response=await fetch(new URL('../assets/decor/atlas.json',import.meta.url));if(!response.ok)throw Error('Decoration atlas metadata unavailable.');const sheets=await response.json();if(sheets.length!==16)throw Error('Decoration pack needs all 16 sheets.');const thumbs=await Promise.all(sheets.map(s=>image(s.thumb))),full=new Map(),pending=new Map();
 function ensure(s){if(full.has(s.family))return Promise.resolve(full.get(s.family));if(!pending.has(s.family))pending.set(s.family,image(s.file).then(i=>{full.set(s.family,i);pending.delete(s.family);return i;},e=>{pending.delete(s.family);throw e;}));return pending.get(s.family);}
 for(const def of decorDefinitions){const s=sheets.find(s=>s.family===def.family),r=s.cells[def.index],fit=Math.min(def.maxW/r.w,def.maxH/r.h),w=Math.ceil(r.w*fit),h=Math.ceil(r.h*fit),mount=def.mount,boxes=decorCollisionBoxes(def,w,h);
  let cached=null,cacheSource=null;const a={id:def.id,name:def.name,group:def.group,w,h,boxes,layer:'objects',mountDefault:mount,overhang:def.overhang,collisionDefault:def.solid&&!mount,npcAvoid:def.npcAvoid&&!mount,depthSorted:def.depthSorted&&!mount,pack:'town-decor-256',facing:'south',ensureFull:()=>ensure(s)};
  a.draw=c=>{const source=full.get(s.family)||thumbs[s.family],sx=source.width/s.width,sy=source.height/s.height;c.drawImage(source,r.x*sx,r.y*sy,r.w*sx,r.h*sy,0,0,w,h);};
  Object.defineProperty(a,'canvas',{get(){const source=full.get(s.family)||thumbs[s.family];if(!full.has(s.family))ensure(s).catch(()=>{});if(!cached||source!==cacheSource){cached=document.createElement('canvas');cached.width=w;cached.height=h;a.draw(cached.getContext('2d'));cacheSource=source;}return cached;}});catalog.set(a.id,a);
 }
}
