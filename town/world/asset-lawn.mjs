import {assetImage} from './asset-color.mjs?v=interior-polish-1';
import {readPaint} from './ground-paint.mjs?v=interior-polish-1';
import {roundedUnder,curveUnder} from './round-geometry.mjs?v=interior-polish-1';

const cache=new WeakMap(),imageRevisions=new WeakMap();
export const assetMapImageRevision=image=>imageRevisions.get(image)||0;
export const supportsLawnReveal=a=>a.id==='music-square'||a.id.startsWith('estate-');

// Remove only the native lawn around a scene's perimeter. Stone, timber,
// roofs, flowers and the sharply detailed foliage remain in the foreground.
// The world ground then supplies the lawn, including square and soft paint.
export function lawnCoverage({data,width,height},a){
 const length=width*height,sum=new Float64Array((width+1)*(height+1)),squared=new Float64Array(sum.length),stride=width+1;
 for(let y=0;y<height;y++){
  let row=0,row2=0;
  for(let x=0;x<width;x++){
   const i=y*width+x,k=i*4,L=data[k]*.3+data[k+1]*.59+data[k+2]*.11;row+=L;row2+=L*L;
   sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;squared[(y+1)*stride+x+1]=squared[y*stride+x+1]+row2;
  }
 }
 const music=a.id==='music-square',band=music ? .065 : .18,textureThreshold=music?1500:950,alpha=new Uint8Array(length),detailed=new Uint8Array(length),seen=new Uint8Array(length),queue=[];
 const rect=(I,x0,y0,x1,y1)=>I[y1*stride+x1]-I[y0*stride+x1]-I[y1*stride+x0]+I[y0*stride+x0];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=(x+.5)/width,v=(y+.5)/height;if(Math.min(u,1-u,v,1-v)>band)continue;
  if(music&&musicArchitecturePoint(u*1536,v*1024))continue;
  const X=u*a.w,Y=v*a.h;
  if(!music&&a.boxes?.some(b=>X>=b.x-3&&X<=b.x+b.w+3&&Y>=b.y-3&&Y<=b.y+b.h+3))continue;
  const i=y*width+x,k=i*4,r=data[k],g=data[k+1],b=data[k+2];
  if(data[k+3]<12||g<r*.92||g<b*1.45||r<b*1.2)continue;
  const x0=Math.max(0,x-4),x1=Math.min(width,x+5),y0=Math.max(0,y-4),y1=Math.min(height,y+5),n=(x1-x0)*(y1-y0),mean=rect(sum,x0,y0,x1,y1)/n,variance=Math.max(0,rect(squared,x0,y0,x1,y1)/n-mean*mean);
  alpha[i]=255;if(variance>textureThreshold)detailed[i]=1;
 }
 // Grass has occasional bright blades and grain. Keeping every one as an
 // opaque pixel leaves green confetti on a newly paved verge. Preserve only
 // coherent, detailed plant clusters rather than those isolated lawn marks.
 for(let start=0;start<length;start++)if(detailed[start]===1){
  const component=[start];detailed[start]=2;
  for(let head=0;head<component.length;head++){
   const i=component[head],x=i%width,y=Math.floor(i/width);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const X=x+dx,Y=y+dy,n=Y*width+X;if(X<0||Y<0||X>=width||Y>=height||detailed[n]!==1)continue;
    detailed[n]=2;component.push(n);
   }
  }
  if(component.length>=48)for(const i of component)alpha[i]=0;
 }
 // Only perimeter-connected lawn is ground. Green window shutters or a green
 // roof cannot become a terrain hole simply because they share its palette.
 const enqueue=i=>{if(!seen[i]&&alpha[i]){seen[i]=1;queue.push(i);}};
 for(let x=0;x<width;x++){enqueue(x);enqueue((height-1)*width+x);}
 for(let y=1;y<height-1;y++){enqueue(y*width);enqueue(y*width+width-1);}
 for(let head=0;head<queue.length;head++){
  const i=queue[head],x=i%width,y=Math.floor(i/width);
  if(x)enqueue(i-1);if(x+1<width)enqueue(i+1);if(y)enqueue(i-width);if(y+1<height)enqueue(i+width);
 }
 for(let i=0;i<length;i++)if(!seen[i])alpha[i]=0;
 return alpha;
}

function legacyAssetMapImage(a){
 const source=assetImage(a);if(!supportsLawnReveal(a))return source;
 if(cache.has(source))return cache.get(source);
 const analysis=document.createElement('canvas'),factor=Math.min(1,768/source.width);analysis.width=Math.max(1,Math.round(source.width*factor));analysis.height=Math.max(1,Math.round(source.height*factor));
 const g=analysis.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,analysis.width,analysis.height);
 const pixels=g.getImageData(0,0,analysis.width,analysis.height),coverage=lawnCoverage(pixels,a);
 for(let i=0;i<coverage.length;i++){pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=coverage[i];}g.putImageData(pixels,0,0);
 const out=document.createElement('canvas');out.width=source.width;out.height=source.height;const c=out.getContext('2d');c.drawImage(source,0,0);c.globalCompositeOperation='destination-out';c.drawImage(analysis,0,0,out.width,out.height);
 cache.set(source,out);return out;
}


// Music Square has an authored foreground silhouette. Stone and moss belong
// to the architecture even when their colors resemble the surrounding lawn.
const northPost=[[903,24],[906,19],[947,19],[950,24],[951,59],[946,64],[946,100],[941,104],[908,104],[903,100],[903,65],[900,61],[901,25]];
const northEast=[[1467,41],[1508,77],[1508,99],[1503,102],[1473,102],[1444,70],[1444,44]];
const southWest=[[33,932],[94,968],[95,983],[69,1003],[26,977],[26,951]];
const southPost=[[556,930],[564,921],[601,921],[612,930],[612,998],[604,1008],[558,1008],[556,999]];
const lampHead=[[0,0],[9,19],[25,37],[31,48],[24,96],[11,119],[-11,119],[-26,96],[-31,47],[-20,30],[-8,17]];
const squareRects=[[63,101,1410,844],[33,96,30,896],[1473,96,32,896],[63,42,1410,59],[63,945,1410,59]];
const preparations=new WeakMap(),paintFields=new WeakMap(),grassTiles=new WeakMap();
const polygon=(c,points)=>{c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();};
const mirror=(points,axis=1536)=>points.map(([x,y])=>[axis-x,y]);
const squarePolygons=[northEast,mirror(northEast),southWest,mirror(southWest),northPost,mirror(northPost),southPost,mirror(southPost,1531),... [139,1393].map(center=>lampHead.map(([x,y])=>[x+center,y]))];
function musicArchitecturePoint(x,y){
 if(squareRects.some(([X,Y,w,h])=>x>=X&&x<=X+w&&y>=Y&&y<=Y+h))return true;
 return squarePolygons.some(points=>{let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;});
}
function squareForegroundMask(source,width,height){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const c=canvas.getContext('2d');
 c.scale(width/1536,height/1024);c.fillStyle='#fff';
 // The piazza floor, complete side spines, and both broad horizontal rails.
 for(const r of squareRects)c.fillRect(...r);
 for(const points of squarePolygons){c.beginPath();polygon(c,points);c.fill();}
 // The two lantern tips rise above the stone wall. Their tight hulls still
 // contain small pockets of background lawn between the metal roof edges.
 // Remove that background only here; stone never goes through a color key.
 const rows=Math.ceil(height*42/1024),sample=document.createElement('canvas');sample.width=width;sample.height=height;
 const g=sample.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,width,height);
 const original=g.getImageData(0,0,width,rows),mask=c.getImageData(0,0,width,rows);
 for(let y=0;y<rows;y++)for(let x=0;x<width;x++){
  const X=(x+.5)/width*1536;if(![139,1393].some(center=>Math.abs(X-center)<35))continue;
  const k=(y*width+x)*4,r=original.data[k],G=original.data[k+1],b=original.data[k+2];
  if(G>r*.92&&G>b*1.45&&r>b*1.2)mask.data[k+3]=0;
 }
 // Keep the connected metal silhouette, not isolated yellow petals that
 // happen to share the bronze palette beside a lantern tip.
 for(const center of [139,1393]){
  const left=Math.max(0,Math.floor((center-35)/1536*width)),right=Math.min(width,Math.ceil((center+35)/1536*width)),seen=new Uint8Array(width*rows),queue=[];
  const enqueue=(x,y)=>{if(x<left||x>=right||y<0||y>=rows)return;const i=y*width+x;if(seen[i]||mask.data[i*4+3]<8)return;seen[i]=1;queue.push(i);};
  for(let x=left;x<right;x++)enqueue(x,rows-1);
  for(let at=0;at<queue.length;at++){const i=queue[at],x=i%width,y=Math.floor(i/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)enqueue(x+dx,y+dy);}
  for(let y=0;y<rows;y++)for(let x=left;x<right;x++)if(!seen[y*width+x])mask.data[(y*width+x)*4+3]=0;
 }
 // A small source flower sits beside each finial shoulder. At the matte's
 // working resolution it can touch the bronze component by one sample; this
 // authored background pocket follows the actual head edge instead.
 for(let y=0;y<rows;y++)for(let x=0;x<width;x++){
  const X=(x+.5)/width*1536,Y=(y+.5)/height*1024;
  if(Y>=23&&Y<32&&[139,1393].some(center=>X>=center-19&&X<center-11))mask.data[(y*width+x)*4+3]=0;
 }
 c.setTransform(1,0,0,1,0,0);c.putImageData(mask,0,0);return canvas;
}
function prepareSquare(source){
 if(preparations.has(source))return preparations.get(source);
 const factor=Math.min(1,768/source.width),width=Math.max(1,Math.round(source.width*factor)),height=Math.max(1,Math.round(source.height*factor));
 const value={source,width,height,foreground:squareForegroundMask(source,width,height),documents:new WeakMap()};preparations.set(source,value);return value;
}
function poseKey(a,o){return [o.x,o.y,o.scale||1,o.rotation||0,a.w,a.h].join(':');}
function worldBounds(a,o){
 const s=o.scale||1,r=(o.rotation||0)*Math.PI/180,C=Math.cos(r),S=Math.sin(r),points=[];
 for(const x of [-a.w/2,a.w/2])for(const y of [-a.h,0])points.push({x:o.x+(x*C-y*S)*s,y:o.y+(x*S+y*C)*s});
 return {x0:Math.floor(Math.min(...points.map(p=>p.x))/64),x1:Math.floor(Math.max(...points.map(p=>p.x))/64),y0:Math.floor(Math.min(...points.map(p=>p.y))/64),y1:Math.floor(Math.max(...points.map(p=>p.y))/64)};
}
function terrainReferences(doc,bounds,previous){
 const refs=[],donors=new Set();let i=0,same=!!previous;
 for(let y=bounds.y0;y<=bounds.y1;y++)for(let x=bounds.x0;x<=bounds.x1;x++){
  const a=doc.cells[`${x},${y}`];refs.push(a);if(previous?.[i++]!==a)same=false;
  for(const q of a?.curves||[])if(!q.under)donors.add(`${q.underX},${q.underY}`);
 }
 for(const k of donors){const a=doc.cells[k];refs.push(a);if(previous?.[i++]!==a)same=false;}
 if(previous?.length!==refs.length)same=false;
 return {refs,same};
}
function fieldFor(a){if(!paintFields.has(a.paint))paintFields.set(a.paint,readPaint(a));return paintFields.get(a.paint);}
function grassWeight(a,i){
 if(!a||a.surface==='grass'&&!a.paint&&!a.bridge)return 255;
 if(a.bridge)return 0;
 if(!a.paint)return 0;
 const f=fieldFor(a);let value=0;for(let j=0;j<f.materials.length;j++)if(f.materials[j].surface==='grass')value+=f.weights[i*f.materials.length+j];return value;
}
function grassTile(doc,a,x,y){
 if(!a.curves?.length&&grassTiles.has(a))return grassTiles.get(a);
 const tile=document.createElement('canvas');tile.width=tile.height=16;const c=tile.getContext('2d'),pixels=c.createImageData(16,16);
 for(let yy=0;yy<16;yy++)for(let xx=0;xx<16;xx++){
  const i=yy*16+xx,X=x*64+xx*4+2,Y=y*64+yy*4+2,q=a.curves?.length?roundedUnder(doc,a,X,Y):null,layer=q?curveUnder(doc,q):a;
  pixels.data[i*4]=pixels.data[i*4+1]=pixels.data[i*4+2]=255;pixels.data[i*4+3]=grassWeight(layer,i);
 }
 c.putImageData(pixels,0,0);if(!a.curves?.length)grassTiles.set(a,tile);return tile;
}
function contextualSquare(a,o,doc,source){
 const prepared=prepareSquare(source),key=poseKey(a,o),bounds=worldBounds(a,o);
 let entries=prepared.documents.get(doc);if(!entries){entries=new Map();prepared.documents.set(doc,entries);}
 let entry=entries.get(key);const references=terrainReferences(doc,bounds,entry?.refs);
 if(entry&&references.same){entries.delete(key);entries.set(key,entry);return entry.image;}
 if(references.refs.every(tile=>!tile||tile.surface==='grass'&&!tile.paint&&!tile.curves?.length&&!tile.bridge)){const natural=entry||{};natural.refs=references.refs;natural.image=source;entries.delete(key);entries.set(key,natural);if(entries.size>12)entries.delete(entries.keys().next().value);return source;}
 // A small transform LRU also reuses builder placement ghosts, whose object
 // IDs change each frame even when the preview remains at the same position.
 if(!entry&&entries.size>=12){const oldest=entries.keys().next().value;entry=entries.get(oldest);entries.delete(oldest);}
 if(!entry)entry={};
 if(!entry.mask){entry.mask=document.createElement('canvas');entry.mask.width=prepared.width;entry.mask.height=prepared.height;}
 const mask=entry.mask,m=mask.getContext('2d'),fx=prepared.width/a.w,fy=prepared.height/a.h,s=o.scale||1,r=(o.rotation||0)*Math.PI/180,C=Math.cos(r),S=Math.sin(r);
 m.setTransform(1,0,0,1,0,0);m.globalCompositeOperation='source-over';m.clearRect(0,0,mask.width,mask.height);m.fillStyle='#fff';m.fillRect(0,0,mask.width,mask.height);
 m.setTransform(fx*C/s,-fy*S/s,fx*S/s,fy*C/s,fx*(a.w/2-(C*o.x+S*o.y)/s),fy*(a.h+(S*o.x-C*o.y)/s));
 let changed=false;
 for(let y=bounds.y0;y<=bounds.y1;y++)for(let x=bounds.x0;x<=bounds.x1;x++){
  const tile=doc.cells[`${x},${y}`];if(!tile||tile.surface==='grass'&&!tile.paint&&!tile.curves?.length&&!tile.bridge)continue;
  // A material edit beneath the opaque piazza floor cannot affect its rim.
  const points=[[x*64,y*64],[(x+1)*64,y*64],[x*64,(y+1)*64],[(x+1)*64,(y+1)*64]];
  if(points.every(([X,Y])=>{const dx=(X-o.x)/s,dy=(Y-o.y)/s,u=(dx*C+dy*S+a.w/2)/a.w*1536,v=(-dx*S+dy*C+a.h)/a.h*1024;return u>=63&&u<=1473&&v>=101&&v<=945;}))continue;
  changed=true;m.clearRect(x*64,y*64,64,64);
  if(tile.paint||tile.curves?.length)m.drawImage(grassTile(doc,tile,x,y),x*64,y*64,64,64);
 }
 if(!changed){entry.image=source;}else{
  m.setTransform(1,0,0,1,0,0);m.drawImage(prepared.foreground,0,0);
  if(!entry.out){entry.out=document.createElement('canvas');entry.out.width=source.width;entry.out.height=source.height;}
  const c=entry.out.getContext('2d');c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,entry.out.width,entry.out.height);c.drawImage(source,0,0);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0,entry.out.width,entry.out.height);c.globalCompositeOperation='source-over';entry.image=entry.out;imageRevisions.set(entry.out,(imageRevisions.get(entry.out)||0)+1);
 }
 entry.refs=references.refs;entries.set(key,entry);return entry.image;
}

export function assetMapImage(a,o=null,doc=null){
 if(a.id!=='music-square')return legacyAssetMapImage(a);
 const source=assetImage(a);
 // Library and no-context previews keep the complete original planting.
 // In the world, terrain determines whether that exterior layer remains.
 return o&&doc&&!o.mount?contextualSquare(a,o,doc,source):source;
}
