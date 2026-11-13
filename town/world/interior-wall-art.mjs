// Cutaway walls share one cap network. Wallpaper remains the authored upright
// face; its adjoining wall edge returns to the same height at either end.
const EPS=.001;
const privateScene=s=>s?.kind==='apartment'||s?.kind==='showroom';
const valid=r=>Number.isFinite(r.x)&&Number.isFinite(r.y)&&r.w>0&&r.h>0;
const contains=(r,x,y)=>x>=r.x-EPS&&y>=r.y-EPS&&x<r.x+r.w-EPS&&y<r.y+r.h-EPS;
const same=(a,b)=>Math.abs(a-b)<EPS;
function subtract(r,cut){
 const x=Math.max(r.x,cut.x),y=Math.max(r.y,cut.y),right=Math.min(r.x+r.w,cut.x+cut.w),bottom=Math.min(r.y+r.h,cut.y+cut.h);
 if(right<=x||bottom<=y)return [r];
 return [{...r,h:y-r.y},{...r,y:bottom,h:r.y+r.h-bottom},{...r,x:r.x,y,w:x-r.x,h:bottom-y},{...r,x:right,y,w:r.x+r.w-right,h:bottom-y}].filter(valid);
}
const subtractAll=(rects,cuts)=>cuts.reduce((parts,cut)=>parts.flatMap(r=>subtract(r,cut)),rects);
const unique=rects=>[...new Map(rects.map(r=>[[r.x,r.y,r.w,r.h].join(','),r])).values()];
function aperture(d){
 const thickness=d.wallThickness||18;
 return d.axis==='vertical'?{x:d.x-thickness/2,y:d.y,w:thickness,h:d.length}:{x:d.x,y:d.y-thickness/2,w:d.length,h:thickness};
}
function boundaryEdges(rects,context){
 const result=new Map();
 for(const r of rects)for(const side of ['left','right','top','bottom']){
  const vertical=side==='left'||side==='right',at=vertical?(side==='left'?r.x:r.x+r.w):(side==='top'?r.y:r.y+r.h),start=vertical?r.y:r.x,end=start+(vertical?r.h:r.w),cuts=[start,end];
  for(const other of context){const a=vertical?other.y:other.x,b=a+(vertical?other.h:other.w);if(a>start&&a<end)cuts.push(a);if(b>start&&b<end)cuts.push(b);}
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++){
   const a=cuts[i-1],b=cuts[i];if(b-a<EPS)continue;
   const mid=(a+b)/2,sign=side==='left'||side==='top'?-1:1,x=vertical?at+sign*.01:mid,y=vertical?mid:at+sign*.01;
   if(context.some(other=>contains(other,x,y)))continue;
   const key=[side,at,a,b].join(',');result.set(key,{side,at,start:a,end:b,color:r.color,trim:r.trim});
  }
 }
 return [...result.values()];
}
export function interiorWallNetworkGeometry(scene){
 if(!privateScene(scene))return null;
 const walls=(scene.walls||[]).filter(valid).map(r=>({...r})),faces=unique((scene.rooms||[]).filter(r=>r.wallpaper&&!r.portalRoom).flatMap(r=>r.wallpaperAreas||[]).filter(valid)),apertures=(scene.privacyDoors||[]).map(aperture).filter(valid),returns=[];
 const sideWalls=walls.filter(wall=>wall.w<=32&&wall.h>wall.w);
 for(const wall of walls){
  if(wall.w>32||wall.h<=wall.w)continue;
  for(const face of faces){
   if(face.h<32||!same(wall.x,face.x+face.w)&&!same(wall.x+wall.w,face.x))continue;
   const bottom=face.y+face.h;
   // This is an upright return on an existing face edge, not an attempt to
   // connect unrelated pieces across an open strip of circulation floor.
   const wallBottom=wall.y+wall.h,sourceFace={x:face.x,y:face.y,w:face.w,h:face.h};
   if(wall.y>face.y+EPS&&wall.y<=bottom+EPS&&wallBottom>bottom+EPS)returns.push({...wall,y:face.y,h:wall.y-face.y,face:sourceFace,returnDirection:'up'});
   // A shared wall can also end partway through its adjoining raised face.
   // Finish that face edge with the same cap width and profile, rather than
   // leaving the wallpaper/dado hanging below an abruptly cut wall end.
   if(wall.y<=face.y+EPS&&wallBottom>face.y+EPS&&wallBottom<bottom-EPS)returns.push({...wall,y:wallBottom,h:bottom-wallBottom,face:sourceFace,returnDirection:'down'});
  }
 }
 // A north-facing wallpaper band has a real horizontal cap, with the same
 // thickness and material as its adjoining side walls. Keep it inside the
 // face so the first row remains visible even when that face starts at y0.
 const northBands=faces.map(face=>{
  const adjoining=sideWalls.find(wall=>(same(wall.x,face.x+face.w)||same(wall.x+wall.w,face.x))&&wall.y<=face.y+face.h+EPS&&wall.y+wall.h>=face.y-EPS),frame=adjoining||sideWalls[0],thickness=frame?.w||(scene.kind==='showroom'?16:18);
  const x=Math.max(0,face.x),y=Math.max(0,face.y),right=Math.min(scene.width,face.x+face.w),bottom=Math.min(scene.height,face.y+Math.min(face.h,thickness));
  return {x,y,w:right-x,h:bottom-y,color:frame?.color||scene.homeMaterialSuite?.trim?.wood||scene.color,trim:frame?.trim||scene.homeMaterialSuite?.trim?.light||scene.trim,face:{...face},capDirection:'north'};
 }).filter(valid);
 // A side partition can stop at the front wall's north edge. Continue its
 // cutaway cap through that adjoining band's thickness so the L join has no
 // floor-shaped notch. Exact contact never bridges a real circulation gap.
 const cornerBands=sideWalls.flatMap(wall=>walls.filter(front=>front.h<=32&&front.w>front.h&&same(front.y,wall.y+wall.h)&&(same(front.x+front.w,wall.x)||same(front.x,wall.x+wall.w))).map(front=>({x:wall.x,y:front.y,w:wall.w,h:front.h,color:wall.color,trim:wall.trim,cornerDirection:'south',wall:{...wall},front:{...front}})));
 const projectedReturns=unique(subtractAll(returns,apertures)),northCaps=unique(subtractAll(northBands,apertures)),cornerCaps=unique(subtractAll(cornerBands,apertures)),paint=unique(subtractAll([...subtractAll(walls,faces),...projectedReturns,...northCaps,...cornerCaps],apertures)),outer=[{x:0,y:0,w:scene.width,h:3},{x:0,y:102,w:scene.width,h:4},{x:0,y:0,w:28,h:scene.height},{x:scene.width-28,y:0,w:28,h:scene.height},{x:0,y:scene.height-28,w:scene.width,h:28}],context=[...paint,...outer];
 return {paint,returns:projectedReturns,northCaps,cornerCaps,faces,apertures,edges:boundaryEdges(paint,context)};
}
function edgeRect(edge,width,inset=0){
 const {side,at,start,end}=edge;
 if(side==='left')return {x:at+inset,y:start,w:width,h:end-start};
 if(side==='right')return {x:at-inset-width,y:start,w:width,h:end-start};
 if(side==='top')return {x:start,y:at+inset,w:end-start,h:width};
 return {x:start,y:at-inset-width,w:end-start,h:width};
}
const fill=(c,r,color)=>{c.fillStyle=color;c.fillRect(r.x,r.y,r.w,r.h);};
export function drawInteriorWallNetwork(c,scene){
 const network=interiorWallNetworkGeometry(scene);if(!network)return false;
 const palette=scene.homeMaterialSuite?.trim||{wood:scene.color||'#927b60',light:scene.trim||'#dfcba6',shadow:'#443d37'};
 c.save();c.imageSmoothingEnabled=false;
 // Small edge shadows replace the old sixteen-pixel shadow on every separate
 // rectangle. No shadow, cap or trim crosses an actual door aperture.
 c.save();c.globalAlpha*=.18;
 for(const edge of network.edges)if(edge.side==='right'||edge.side==='bottom'){
  const r=edgeRect(edge,2,-2);for(const part of subtractAll([r],network.apertures))fill(c,part,palette.shadow);
 }
 c.restore();
 for(const r of network.paint)fill(c,r,r.color||palette.wood);
 for(const edge of network.edges){
  fill(c,edgeRect(edge,1),palette.shadow);
  if(edge.side==='left'||edge.side==='top')fill(c,edgeRect(edge,2,1),edge.trim||palette.light);
  else fill(c,edgeRect(edge,1,1),palette.shadow);
 }
 c.restore();return true;
}
