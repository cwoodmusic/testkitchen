import {PAINT_GRID,PAINT_STEP,readPaint,materialKey} from './ground-paint.mjs?v=showrooms-1';
import {sources,catalog} from './catalog.mjs?v=showrooms-1';
import {cell,height,terrainView} from './model.mjs?v=showrooms-1';
import {drawPaving,drawPavingMaterial} from './paving.mjs?v=showrooms-1';
import {groundTextures} from './ground-textures.mjs?v=showrooms-1';
import {drawAnimatedWater} from './water-motion.mjs?v=showrooms-1';

const tiles=new WeakMap(),fields=new WeakMap(),legacyFields=new Map();
export function invalidateGroundCache(d,paints=[]){tiles.delete(d);tiles.delete(terrainView(d));for(const paint of paints)fields.delete(paint);}
function canvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
const materialBuffer=canvas(64),mask=canvas(PAINT_GRID+2),blendBuffer=canvas(64);
const materialContext=materialBuffer.getContext('2d'),maskContext=mask.getContext('2d'),blendContext=blendBuffer.getContext('2d');

// This key changes only when property paving moves, rotates, scales or changes
// elevation. Texture masks otherwise stay cached while the camera moves.
export function groundFrameKey(d){return d.objects.filter(o=>catalog.get(o.asset)?.pavingSource).map(o=>[o.asset,o.x,o.y,o.scale,o.rotation,height(d,o.x,o.y)].join(':')).join('|');}

export function groundTexture(surface){return groundTextures[surface]||sources.ground[['grass','cobble','dirt','water'].indexOf(surface)];}
export function drawMaterial(c,d,a,x,y,X,Y,{raw=false}={}){
 const index=['grass','cobble','dirt','water'].indexOf(a.surface);
 if(a.surface==='cobble')(raw?drawPavingMaterial:drawPaving)(c,d,x,y,Y,a.paving);
 else if(a.surface==='water')drawAnimatedWater(c,sources.ground[3],x,y,X,Y);
 else if(index>=0)c.drawImage(sources.ground[index],x%8*64,y%8*64,64,64,X,Y,64,64);
 else c.drawImage(groundTextures[a.surface],x%8*64,y%8*64,64,64,X,Y,64,64);
}

function field(a){
 if(!a.paint){const id=materialKey(a);if(!legacyFields.has(id))legacyFields.set(id,readPaint(a));return legacyFields.get(id);}
 if(!fields.has(a.paint))fields.set(a.paint,readPaint(a));
 return fields.get(a.paint);
}
function neighborhood(d,a,x,y){
 const neighbors=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const b=dx===0&&dy===0?a:cell(d,x+dx,y+dy);
  neighbors.push(b.level===a.level&&!b.stairs&&!b.bridge&&b.surface!=='water'?b:a);
 }
 return neighbors;
}
function sameNeighbors(previous,current){return previous.length===current.length&&current.every((a,i)=>{const b=previous[i];return a.paint===b.paint&&a.surface===b.surface&&a.paving===b.paving&&a.level===b.level;});}
function tileCache(d){if(!tiles.has(d))tiles.set(d,new Map());return tiles.get(d);}
function cacheTile(cache,key,value){if(cache.size>=4096&&!cache.has(key))cache.delete(cache.keys().next().value);cache.set(key,value);}
function pavingNeighbors(d,x,y){
 // Paving's edge mask reads the real cardinal cells, including lower ground.
 // The height-filtered blend neighborhood would hide some material edits.
 return [[-1,0],[1,0],[0,-1],[0,1]].map(([dx,dy])=>{const a=cell(d,x+dx,y+dy);return `${a.surface}:${!!a.stairs}:${!!a.bridge}`;}).join('|');
}

function drawPlainPaving(c,d,a,x,y,X,Y,frameKey){
 // Rounded under-layers and clipped tops keep their original compositing.
 // Only the ordinary opaque, pixel-sampled floor can be flattened unchanged.
 if(d.cells[`${x},${y}`]!==a||a.curves?.length||c.imageSmoothingEnabled||c.globalAlpha!==1||c.globalCompositeOperation!=='source-over'){
  drawMaterial(c,d,a,x,y,X,Y);return;
 }
 const cache=tileCache(d),key=['paving',x,y,y*64-Y,a.paving].join(':'),neighbors=pavingNeighbors(d,x,y);
 let entry=cache.get(key);
 if(!entry||entry.frameKey!==frameKey||entry.neighbors!==neighbors){
  const out=canvas(64),g=out.getContext('2d');g.imageSmoothingEnabled=false;g.translate(-X,-Y);drawMaterial(g,d,a,x,y,X,Y);
  entry={frameKey,neighbors,canvas:out};cacheTile(cache,key,entry);
 }
 c.drawImage(entry.canvas,X,Y);
}

export function drawGround(c,d,a,x,y,X,Y,frameKey=''){
 if(a.surface==='water'||a.stairs||a.bridge){drawMaterial(c,d,a,x,y,X,Y);return;}
 const neighbors=neighborhood(d,a,x,y);
 if(!a.paint&&!neighbors.some(b=>b.paint)){if(a.surface==='cobble')drawPlainPaving(c,d,a,x,y,X,Y,frameKey);else drawMaterial(c,d,a,x,y,X,Y);return;}
 const cache=tileCache(d),z=y*64-Y,cacheKey=[x,y,z,a.surface,a.paving].join(':'),cached=cache.get(cacheKey);
 if(cached&&cached.paint===a.paint&&cached.frameKey===frameKey&&sameNeighbors(cached.neighbors,neighbors)){c.drawImage(cached.canvas,X,Y);return;}
 const neighborFields=neighbors.map(field),materials=[...new Map(neighborFields.flatMap(f=>f.materials).map(m=>[materialKey(m),m])).values()];
 blendContext.setTransform(1,0,0,1,0,0);blendContext.clearRect(0,0,64,64);blendContext.globalCompositeOperation='lighter';
 for(const material of materials){
  const id=materialKey(material),indices=neighborFields.map(f=>f.materials.findIndex(m=>materialKey(m)===id)),alpha=maskContext.createImageData(PAINT_GRID+2,PAINT_GRID+2);
  // A one-sample halo interpolates coverage across cell boundaries. It also
  // keeps a large soft stroke from revealing the underlying terrain grid.
  for(let gy=-1;gy<=PAINT_GRID;gy++)for(let gx=-1;gx<=PAINT_GRID;gx++){
   const dx=gx<0?-1:gx>=PAINT_GRID?1:0,dy=gy<0?-1:gy>=PAINT_GRID?1:0;
   const ni=(dy+1)*3+dx+1,f=neighborFields[ni],clamped=neighbors[ni]===a&&(dx||dy),px=clamped?Math.max(0,Math.min(PAINT_GRID-1,gx)):(gx+PAINT_GRID)%PAINT_GRID,py=clamped?Math.max(0,Math.min(PAINT_GRID-1,gy)):(gy+PAINT_GRID)%PAINT_GRID,index=indices[ni],offset=((gy+1)*(PAINT_GRID+2)+gx+1)*4;
   alpha.data[offset]=alpha.data[offset+1]=alpha.data[offset+2]=255;
   alpha.data[offset+3]=index<0?0:f.weights[(py*PAINT_GRID+px)*f.materials.length+index];
  }
  maskContext.putImageData(alpha,0,0);
  materialContext.setTransform(1,0,0,1,0,0);materialContext.globalCompositeOperation='source-over';materialContext.clearRect(0,0,64,64);materialContext.imageSmoothingEnabled=false;
  materialContext.save();materialContext.translate(-X,-Y);drawMaterial(materialContext,d,material,x,y,X,Y,{raw:true});materialContext.restore();
  materialContext.globalCompositeOperation='destination-in';materialContext.imageSmoothingEnabled=true;
  materialContext.drawImage(mask,-PAINT_STEP,-PAINT_STEP,(PAINT_GRID+2)*PAINT_STEP,(PAINT_GRID+2)*PAINT_STEP);
  blendContext.drawImage(materialBuffer,0,0);
 }
 // Keep any slight source-art transparency over its original ground rather
 // than exposing the renderer background. Material weights stay normalized.
 const out=canvas(64),g=out.getContext('2d');g.drawImage(blendBuffer,0,0);g.globalCompositeOperation='destination-over';g.save();g.translate(-X,-Y);drawMaterial(g,d,a,x,y,X,Y,{raw:true});g.restore();
 cacheTile(cache,cacheKey,{paint:a.paint,frameKey,neighbors:neighbors.map(b=>({...b})),canvas:out});c.drawImage(out,X,Y);
}
