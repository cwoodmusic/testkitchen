import {COLS,ROWS,terrainView} from './model.mjs?v=furniture-facings-1';
import {sources} from './catalog.mjs?v=furniture-facings-1';
import {groundFrameKey,invalidateGroundCache} from './ground-render.mjs?v=furniture-facings-1';
import {waterFrame,currentWaterFrameIndex,withLevelZeroWaterCutout} from './water-motion.mjs?v=furniture-facings-1';
import {OverviewTerrainState,OVERVIEW_SCALE,OVERVIEW_PAD,WORLD_WIDTH,WORLD_HEIGHT,terrainBoundsForRect} from './overview-state.mjs?v=furniture-facings-1';

const entries=new WeakMap(),fullBounds={x0:0,x1:COLS,y0:0,y1:ROWS};
const world={x:-OVERVIEW_PAD,y:-OVERVIEW_PAD,w:WORLD_WIDTH+OVERVIEW_PAD*2,h:WORLD_HEIGHT+OVERVIEW_PAD*2};
function eligible(c,opts){
 const t=c.getTransform();
 return opts.overview!==false&&(!opts.heightView||opts.heightView==='art')&&Math.abs(t.b)<1e-9&&Math.abs(t.c)<1e-9&&t.a>0&&Math.abs(t.a-t.d)<1e-9&&t.a<=OVERVIEW_SCALE+1e-9&&c.globalAlpha===1&&c.globalCompositeOperation==='source-over';
}
function entryFor(c){
 let e=entries.get(c);if(e)return e;
 const canvas=document.createElement('canvas');canvas.width=Math.ceil(world.w*OVERVIEW_SCALE);canvas.height=Math.ceil(world.h*OVERVIEW_SCALE);
 e={canvas,ctx:canvas.getContext('2d'),state:new OverviewTerrainState(),key:null,fullBuilds:0,patchBuilds:0,scans:0,livePatches:[],waterKey:null,waterPattern:null,lastDoc:null,lastCells:null,lastRevision:null,lastFrame:null};entries.set(c,e);return e;
}
function paintCache(e,d,r,opts,raw,full){
 const g=e.ctx;g.setTransform(OVERVIEW_SCALE,0,0,OVERVIEW_SCALE,OVERVIEW_PAD*OVERVIEW_SCALE,OVERVIEW_PAD*OVERVIEW_SCALE);g.imageSmoothingEnabled=false;g.globalAlpha=1;g.globalCompositeOperation='source-over';
 g.save();g.beginPath();g.rect(r.x,r.y,r.w,r.h);g.clip();g.clearRect(r.x,r.y,r.w,r.h);
 withLevelZeroWaterCutout(g,()=>raw(g,d,full?fullBounds:terrainBoundsForRect(r),{...opts,overviewBake:true}));g.restore();
 if(full)e.fullBuilds++;else e.patchBuilds++;
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
 if(full||changes.changed.length)e.livePatches=e.state.livePatches();
 e.key=key;
 const image=waterFrame(sources.ground[3]),waterKey=currentWaterFrameIndex();
 if(e.waterKey!==waterKey||!e.waterPattern){e.waterPattern=c.createPattern(image,'repeat');e.waterKey=waterKey;}
 c.save();c.fillStyle=e.waterPattern;c.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);c.imageSmoothingEnabled=false;c.drawImage(e.canvas,world.x,world.y,world.w,world.h);c.restore();
 // Raised lakes retain original water phase and projection. The rectangles
 // do not overlap, and each redraw includes all contributing terrain rows.
 for(const r of e.livePatches){
  c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle='#101f19';c.fillRect(r.x,r.y,r.w,r.h);raw(c,d,terrainBoundsForRect(r),opts);c.restore();
 }
 return true;
}
export function overviewTerrainStats(c){const e=entries.get(c);return e?{fullBuilds:e.fullBuilds,patchBuilds:e.patchBuilds,scans:e.scans,livePatches:e.livePatches.length,pixels:e.canvas.width*e.canvas.height,scale:OVERVIEW_SCALE}:null;}
