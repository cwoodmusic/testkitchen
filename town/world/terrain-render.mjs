import {shadeLowerGround,drawTerrainRims} from './edge-shading.mjs?v=showrooms-1';
import {drawRoundUnder,drawRoundCliff} from './round-render.mjs?v=showrooms-1';
import {clipCurves} from './round-geometry.mjs?v=showrooms-1';
import {drawGround,groundFrameKey,groundTexture} from './ground-render.mjs?v=showrooms-1';
import {drawCliff,drawStairs} from './construction.mjs?v=showrooms-1';
import {RISE,COLS,ROWS,cell,terrainView} from './model.mjs?v=showrooms-1';
import {sources} from './catalog.mjs?v=showrooms-1';
import {waterRimSegments} from './water-rim.mjs?v=showrooms-1';
import {drawPier,drawPierSubmerged} from './piers.mjs?v=showrooms-1';
import {drawSidewalkCurbs} from './sidewalk-curbs.mjs?v=showrooms-1';
import {drawOverviewTerrain} from './overview-terrain.mjs?v=showrooms-1';
import {prepareOverviewRuns} from './overview-runs.mjs?v=showrooms-1';
const lawns=new WeakMap();
function drawWaterRim(c,d,x,y,X,Y){
 c.strokeStyle='#97b9a1';c.lineWidth=5;
 const z=y*64-Y;for(const s of waterRimSegments(d,x,y)){c.beginPath();c.moveTo(s.x,s.y-z);c.lineTo(s.x+s.dx,s.y+s.dy-z);c.stroke();}
}
function drawBridge(c,d,a,x,y,X,Y){
 c.fillStyle=a.finish==='stone'?'#a4a08a':'#9a7b50';c.fillRect(X,Y,64,64);c.strokeStyle='#544d3c';
 for(let j=0;j<64;j+=10){c.beginPath();c.moveTo(X+(a.bridge==='ew'?j:0),Y+(a.bridge==='ns'?j:0));c.lineTo(X+(a.bridge==='ew'?j:64),Y+(a.bridge==='ns'?j:64));c.stroke();}
 c.strokeStyle='#d1b581';c.lineWidth=5;
 for(const side of [-1,1]){
  const dx=a.bridge==='ns'?side:0,dy=a.bridge==='ew'?side:0;if(cell(d,x+dx,y+dy).bridge===a.bridge)continue;
  c.beginPath();c.moveTo(X+(dx>0?64:0),Y+(dy>0?64:0)-28);c.lineTo(X+(dx?dx>0?64:0:64),Y+(dy?dy>0?64:0:64)-28);c.stroke();
 }
}
export function drawTerrain(c,d,bounds,opts={}){if(!drawOverviewTerrain(c,d,bounds,opts,drawRawTerrain))drawRawTerrain(c,d,bounds,opts);}
export function drawRawTerrain(c,d,{x0,x1,y0,y1},opts={}){
 // All ground/cliff helpers see the untouched floor below raised piers.
 const scene=d;d=terrainView(d);
 // A continuous ground plane prevents the sky clear color appearing through
 // projection cutouts. Actual cliff faces, rather than this lawn, fill supports.
 if(!lawns.has(c))lawns.set(c,c.createPattern(sources.ground[0],'repeat'));
 c.fillStyle=lawns.get(c);c.fillRect(0,0,COLS*64,ROWS*64);
 const frameKey=groundFrameKey(d);
 const runs=opts.overviewBake&&!opts.grid?prepareOverviewRuns(d,{x0,x1,y0,y1},surface=>surface==='dirt'?sources.ground[2]:groundTexture(surface)):null;
 for(let y=y0;y<y1;y++){
  for(let x=x0;x<x1;x++){
   if(runs){const end=runs.draw(c,x,y);if(end>x){x=end-1;continue;}}
   const a=cell(d,x,y),X=x*64,Y=y*64,z=a.level*RISE;
   if(a.stairs){
    // Stairs are terrain surfaces, not a final overlay. The next southern row
    // can cover them, just as it covers any other surface behind its bank.
    drawCliff(c,d,x,y);drawStairs(c,d,x,y);continue;
   }
   if(a.curves?.length){drawRoundUnder(c,d,x,y,frameKey);drawRoundCliff(c,d,x,y);c.save();clipCurves(c,a,x,y,z);}
   drawGround(c,d,a,x,y,X,Y-z,frameKey);
   if(a.surface==='water')drawWaterRim(c,d,x,y,X,Y-z);
   shadeLowerGround(c,d,x,y,z);
   if(a.curves?.length)c.restore();
   // A rounded high face can also expose its lower shelf at this tile edge.
   drawCliff(c,d,x,y);
   if(a.bridge&&!a.pier)drawBridge(c,d,a,x,y,X,Y-z);
   if(opts.grid){c.lineWidth=1;c.strokeStyle='#e3e6bb30';c.strokeRect(X,Y-z,64,64);}
  }
  drawTerrainRims(c,d,x0,x1,y,y+1);
  // Keep curb lips above the ground shading, while southern terrain rows can
  // still cover them naturally at a higher elevation.
  for(let x=x0;x<x1;x++)drawSidewalkCurbs(c,scene,x,y);
  for(let x=x0;x<x1;x++)if(cell(scene,x,y).pier)drawPier(c,scene,x,y,groundTexture('wood'));
 }
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(cell(scene,x,y).pier)drawPierSubmerged(c,scene,x,y);
}
