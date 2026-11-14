import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {blank,cell,height,terrainView,stairProfile,RISE,COLS,ROWS} from './model.mjs';
import {clipCurves,curveUnder} from './round-geometry.mjs';
import {curvePath} from './curve-path.mjs';

const {createCanvas,Path2D}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.Path2D=Path2D;
const load=(name,result,scope)=>vm.runInNewContext(readFileSync(new URL(name,import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\} from .*;\r?\n/gm,'').replace(/^export /gm,'')+'\n'+result,scope);

function harness(){
 const grass=createCanvas(8,8),rock=createCanvas(384,256);grass.getContext('2d').fillStyle='#668544';grass.getContext('2d').fillRect(0,0,8,8);
 rock.getContext('2d').fillStyle='#556a7a';rock.getContext('2d').fillRect(0,0,384,256);
 const common={cell,height,RISE,stairProfile,clipCurves,curveUnder,curvePath,Path2D};
 const edge=load('./edge-shading.mjs','({drawTerrainRims,shadeLowerGround:typeof shadeLowerGround===\'function\'?shadeLowerGround:undefined})',common);
 const cliff=load('./construction.mjs','({drawCliff,drawStairs})',{...common,cliffArt:rock});
 const {drawRawTerrain}=load('./terrain-render.mjs','({drawRawTerrain})',{
  ...common,...edge,...cliff,terrainView,COLS,ROWS,cliffArt:rock,
  sources:{ground:[grass,grass,grass,grass]},groundFrameKey:()=>'',artSourceVersion:()=>0,
  invalidateGroundCache(){},groundTexture:()=>grass,waterFrame:()=>grass,currentWaterFrameIndex:()=>0,
  withLevelZeroWaterCutout:(_context,draw)=>draw(),drawTerrainChunks:()=>false,drawOverviewTerrain:()=>false,
  prepareOverviewRuns:()=>null,drawRoundUnder(){},drawRoundCliff(){},waterRimSegments:()=>[],
  drawPier(){},drawPierSubmerged(){},drawSidewalkCurbs(){},
  drawGround(c,_doc,a,_x,_y,X,Y){c.fillStyle=a.surface==='sand'?'#d2aa64':'#668544';c.fillRect(X,Y,64,64);}
 });
 return {drawRawTerrain,drawCliff:cliff.drawCliff};
}
const rgb=(c,x,y)=>Array.from(c.getImageData(x,y,1,1).data);

test('lower sand retains its original pixels beside stepped cliffs at every elevation',()=>{
 const {drawRawTerrain}=harness();
 for(const level of [1,2,7]){
  const doc=blank();for(let y=6;y<15;y++)for(let x=6;x<15;x++)doc.cells[`${x},${y}`]={surface:'sand',level:0};
  for(let y=6;y<=10;y++)for(let x=8;x<=11;x++)doc.cells[`${x},${y}`]={surface:'grass',level};
  const raw=JSON.stringify(doc),cv=createCanvas(640,640),c=cv.getContext('2d');c.translate(-384,-384);
  drawRawTerrain(c,doc,{x0:6,x1:15,y0:6,y1:15},{terrainChunks:false});c.resetTransform();
  // The old per-tile cast pass darkened the first9–36px of these receivers,
  // including the vertical strips beside the stepped side of the bank.
  for(let y=704;y<768;y++)for(let x=512;x<768;x++)assert.deepEqual(rgb(c,x-384,y-384),[210,170,100,255],`height${level}: sand at${x},${y}`);
  for(let y=640;y<704;y++)for(let x=768;x<832;x++)assert.deepEqual(rgb(c,x-384,y-384),[210,170,100,255],`height${level}: side sand at${x},${y}`);
  assert.notDeepEqual(rgb(c,608-384,700-384),[210,170,100,255],'The actual rock face remains visible');
  assert.equal(JSON.stringify(doc),raw,'Removing shadows must not alter terrain or saves');
 }
});

test('straight cliff artwork ends at its physical foot without a detached5px shadow strip',()=>{
 const {drawCliff}=harness(),doc=blank();doc.cells['8,8']={surface:'grass',level:2};doc.cells['8,9']={surface:'sand',level:0};
 const cv=createCanvas(128,160),c=cv.getContext('2d');c.fillStyle='#d2aa64';c.fillRect(0,0,128,160);c.translate(-512,-480);
 drawCliff(c,doc,8,8);c.resetTransform();
 for(let y=96;y<104;y++)for(let x=0;x<64;x++)assert.deepEqual(rgb(c,x,y),[210,170,100,255]);
 assert.notDeepEqual(rgb(c,32,90),[210,170,100,255],'Cliff texture and its internal shading remain');
});
