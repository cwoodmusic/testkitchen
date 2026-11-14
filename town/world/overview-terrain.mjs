import {COLS,ROWS,terrainView} from './model.mjs?v=town-coast-pier-1';
import {sources} from './catalog.mjs?v=town-review-3';
import {groundFrameKey,invalidateGroundCache} from './ground-render.mjs?v=town-review-3';
import {waterFrame,currentWaterFrameIndex,withLevelZeroWaterCutout} from './water-motion.mjs?v=opera-smooth-1';
import {OverviewTerrainState,OVERVIEW_SCALE,OVERVIEW_PAD,WORLD_WIDTH,WORLD_HEIGHT,terrainBoundsForRect} from './overview-state.mjs?v=town-coast-pier-1';

const entries=new WeakMap(),fullBounds={x0:0,x1:COLS,y0:0,y1:ROWS};
const world={x:-OVERVIEW_PAD,y:-OVERVIEW_PAD,w:WORLD_WIDTH+OVERVIEW_PAD*2,h:WORLD_HEIGHT+OVERVIEW_PAD*2};
const sameWaterFrame=(previous,key,image)=>previous?.waterImage===image&&(typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap||previous.waterKey===key);
function eligible(c,opts){
 const t=c.getTransform();
 return opts.overview!==false&&(!opts.heightView||opts.heightView==='art')&&Math.abs(t.b)<1e-9&&Math.abs(t.c)<1e-9&&t.a>0&&Math.abs(t.a-t.d)<1e-9&&t.a<=OVERVIEW_SCALE+1e-9&&c.globalAlpha===1&&c.globalCompositeOperation==='source-over';
}
function entryFor(c){
 let e=entries.get(c);if(e)return e;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(world.w*OVERVIEW_SCALE);canvas.height=Math.ceil(world.h*OVERVIEW_SCALE);
 e={canvas,ctx:canvas.getContext('2d'),state:new OverviewTerrainState(),key:null,fullBuilds:0,patchBuilds:0,liveBuilds:0,scans:0,livePatches:[],liveFrames:new Map(),waterKey:null,waterPattern:null,lastDoc:null,lastCells:null,lastRevision:null,lastFrame:null,waterImage:null};entries.set(c,e);return e;
}
function paintCache(e,d,r,opts,raw,full,live=false){
 const g=e.ctx;g.setTransform(OVERVIEW_SCALE,0,0,OVERVIEW_SCALE,OVERVIEW_PAD*OVERVIEW_SCALE,OVERVIEW_PAD*OVERVIEW_SCALE);g.imageSmoothingEnabled=false;g.globalAlpha=1;g.globalCompositeOperation='source-over';
 g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();g.clearRect(r.x,r.y,r.w,r.h);
 withLevelZeroWaterCutout(g,()=>raw(g,d,full?fullBounds:terrainBoundsForRect(r),{...opts,overviewBake:true}));g.restore();
 if(full)e.fullBuilds++;else if(live)e.liveBuilds++;else e.patchBuilds++;
}

// One projected-world image preserves north/south occlusion across regions.
// Its transparent sea is animated separately, so water never freezes in cache.
export function drawOverviewTerrain(c,d,bounds,opts,raw){
 if(!eligible(c,opts))return false;
 const e=entryFor(c),frame=groundFrameKey(terrainView(d)),revision=opts.terrainRevision;
 // Builder/game can provide an authoritative edit stamp. Generic callers
 // retain value-based detection, including direct mutations and equal Undo.
 const reuse=Number.isFinite(revision)&&e.lastDoc===d&&e.lastCells===d.cells&&e.lastRevision===revision&&e.lastFrame===frame;
 const changes=reuse?{first:false,changed:[],paints:[],dirty:null}:e.state.scan(d),key=frame+'|grid:'+!!opts.grid;
 if(!reuse)e.scans++;
 e.lastDoc=d;e.lastCells=d.cells;e.lastRevision=revision;e.lastFrame=frame;
 if(changes.paints.length)invalidateGroundCache(d,changes.paints);
 const full=e.key!==key||changes.first||changes.changed.length>512||changes.dirty&&changes.dirty.w*changes.dirty.h>WORLD_WIDTH*WORLD_HEIGHT*.4;
 if(full)paintCache(e,d,world,opts,raw,true);else if(changes.dirty)paintCache(e,d,changes.dirty,opts,raw,false);
 if(full||changes.changed.length){e.livePatches=e.state.livePatches();e.liveFrames.clear();}
 e.key=key;
 const image=waterFrame(sources.ground[3]),waterKey=currentWaterFrameIndex();
 if(!e.waterPattern||!sameWaterFrame(e,waterKey,image)){e.waterPattern=c.createPattern(image,'repeat');e.waterKey=waterKey;e.waterImage=image;}
 // In the far overview waves move less than one backing pixel. The baked
 // lakes retain their complete banks/occlusion there. Closer views animate
 // only visible patches; offscreen lakes must never redraw the entire town.
 const t=c.getTransform(),view={x:-t.e/t.a,y:-t.f/t.d,w:c.canvas.width/t.a,h:c.canvas.height/t.d};
 if(t.a>OVERVIEW_SCALE/2)for(const r of e.livePatches){
  if(r.x+r.w<=view.x||r.x>=view.x+view.w||r.y+r.h<=view.y||r.y>=view.y+view.h)continue;
  const key=r.x+','+r.y;
  if(sameWaterFrame(e.liveFrames.get(key),waterKey,image))continue;
  // Keep the same fixed overview raster and sampler for animated lakes too.
  // Redrawing at fractional camera scale left dark seams and texture panels.
  paintCache(e,d,r,{...opts,liveTerrainPatch:true},raw,false,true);
  e.liveFrames.set(key,{waterKey,waterImage:image});
 }
 c.save();c.fillStyle=e.waterPattern;c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);c.imageSmoothingEnabled=false;c.drawImage(e.canvas,world.x,world.y,world.w,world.h);c.restore();
 return true;
}
export function overviewTerrainStats(c){const e=entries.get(c);return e?{fullBuilds:e.fullBuilds,patchBuilds:e.patchBuilds,liveBuilds:e.liveBuilds,scans:e.scans,livePatches:e.livePatches.length,pixels:e.canvas.width*e.canvas.height,scale:OVERVIEW_SCALE}:null;}
