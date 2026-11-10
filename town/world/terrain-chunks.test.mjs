import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerrainChunkCache,terrainChunkScale,visibleTerrainChunks} from './terrain-chunks.mjs';

const blank=()=>({cells:{},objects:[],edges:{}});
function canvas(width=320,height=240){
 const value={width,height},calls=[],stack=[];
 const c={canvas:value,calls,globalAlpha:1,globalCompositeOperation:'source-over',imageSmoothingEnabled:false,
  transform:{a:.5,b:0,c:0,d:.5,e:0,f:0},
  getTransform(){return {...this.transform};},setTransform(a,b,c,d,e,f){this.transform=typeof a==='object'?{...a}:{a,b,c,d,e,f};calls.push(['transform',this.transform]);},
  save(){stack.push({transform:{...this.transform},globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation});},restore(){Object.assign(this,stack.pop());},
  beginPath(){},rect(...r){calls.push(['rect',...r]);},clip(){calls.push(['clip']);},clearRect(...r){calls.push(['clear',...r]);},fillRect(...r){calls.push(['fill',...r,this.fillStyle]);},
  createPattern(source){calls.push(['pattern',source]);return {source};},drawImage(...r){calls.push(['image',...r]);}
 };
 value.getContext=()=>c;return value;
}
function fixture(options={}){
 const c=canvas().getContext('2d'),doc=blank(),paints=[],invalidations=[],water={index:0,image:{width:64,height:64}},counters={cutouts:0,water:0},frame={key:'source-1'};
 const cache=createTerrainChunkCache({createCanvas:canvas,...options});
 const raw=(ctx,d,bounds,opts)=>{paints.push({ctx,d,bounds,opts});ctx.fillStyle='#aabbcc';ctx.fillRect(0,0,16384,12288);};
 const hooks={frameKey:()=>frame.key,invalidateGround:(d,p)=>invalidations.push({d,p}),waterImage:()=>{counters.water++;return water.image;},waterKey:()=>water.index,withWaterCutout:(_c,fn)=>{counters.cutouts++;fn();}};
 const draw=(opts={})=>cache.draw(c,doc,null,opts,raw,hooks);
 return {c,doc,cache,draw,raw,hooks,paints,invalidations,water,counters,frame};
}

test('terrain chunks choose native close detail and generous medium samples while debug/overview transforms stay raw',()=>{
 const t={a:.4,b:0,c:0,d:.4,e:0,f:0};
 assert.equal(terrainChunkScale(t),1);
 assert.equal(terrainChunkScale({...t,a:.2,d:.2}),.5);
 for(const opts of [{terrainChunks:false},{overviewBake:true},{grid:true},{heightView:'colors'},{heightView:'plan'}])assert.equal(terrainChunkScale(t,opts),null);
 for(const transform of [{...t,a:.125,d:.125},{...t,a:1.1,d:1.1},{...t,b:.2},{...t,d:.5}])assert.equal(terrainChunkScale(transform),null);
 assert.equal(terrainChunkScale(t,{heightView:'art'}),1);
});

test('projected chunks cover the visible world once, including terrain above its unprojected row',()=>{
 const list=visibleTerrainChunks({x:480,y:-100,w:700,h:700},1);
 assert.equal(list.length,9);
 assert.equal(new Set(list.map(p=>p.key)).size,list.length);
 assert.ok(list.some(p=>p.x===0&&p.y===-512));
 assert.ok(list.some(p=>p.x===1024&&p.y===512));
 assert.deepEqual(visibleTerrainChunks({x:-2000,y:-2000,w:100,h:100},1),[]);
});

test('unchanged terrain turns hundreds of tile operations into cached draws without another authoritative scan',()=>{
 const f=fixture();assert.equal(f.draw({terrainRevision:0}),true);
 const first=f.cache.stats(f.c),builds=f.paints.length;
 assert.ok(first.chunks>0);assert.equal(first.builds,builds);assert.equal(first.scans,1);
 for(let i=0;i<60;i++)f.draw({terrainRevision:0});
 const after=f.cache.stats(f.c);assert.equal(f.paints.length,builds);assert.equal(after.scans,1);assert.equal(after.hits,first.chunks*60);
 assert.equal(f.counters.water,0,'dry terrain never synthesizes an invisible sea');
 assert.ok(f.paints.every(p=>p.opts.overviewBake&&p.opts.terrainChunks===false));
});

test('local edits invalidate projected affected chunks while a distant cached camera remains warm',()=>{
 const f=fixture();f.draw({terrainRevision:0});
 f.c.transform.e=-4000;f.draw({terrainRevision:0});
 const far=f.cache.stats(f.c),before=f.paints.length;
 f.doc.cells['1,1']={surface:'grass',level:4};f.draw({terrainRevision:1});
 assert.equal(f.paints.length,before,'an offscreen edit did not rebake the far camera');
 assert.equal(f.cache.stats(f.c).scans,far.scans+1);
 f.c.transform.e=0;f.draw({terrainRevision:1});
 assert.ok(f.paints.length>before,'returning to the edited cliff rebuilt its projected chunks');
});

test('generic callers detect direct cell edits and equal-data Undo reuses static pixels',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'sand',level:1};f.draw();
 const first=f.paints.length;
 f.doc.cells['1,1'].level=3;f.draw();assert.ok(f.paints.length>first);
 const edited=f.paints.length;
 f.doc.cells=JSON.parse(JSON.stringify(f.doc.cells));f.draw();assert.equal(f.paints.length,edited,'equal-value undo/open preserved cached pixels');
 f.doc.cells['1,1'].level=1;f.draw();assert.ok(f.paints.length>edited);
});

test('terrain surface and paving/source changes invalidate caches without changing document data',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'grass',level:0};const original=JSON.stringify(f.doc);f.draw({terrainRevision:0});
 const first=f.paints.length;f.frame.key='source-2';f.draw({terrainRevision:0});assert.ok(f.paints.length>first);
 assert.equal(JSON.stringify(f.doc),original);assert.equal(f.cache.stats(f.c).scans,2);
});

test('organic water underlays retain a live sea pattern without rebuilding static shore art',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'sand',level:0,curves:[{kind:'surface',corner:'nw',cx:128,cy:128,r:64,underX:4,underY:4}]};f.doc.cells['4,4']={surface:'water',level:0};
 f.draw({terrainRevision:0});const builds=f.paints.length,patterns=f.c.calls.filter(c=>c[0]==='pattern').length;
 assert.ok(f.counters.water>0);f.water.index++;f.draw({terrainRevision:0});
 assert.equal(f.paints.length,builds);assert.equal(f.c.calls.filter(c=>c[0]==='pattern').length,patterns+1);
 assert.ok(f.c.calls.some(c=>c[0]==='fill'&&c[1]===0&&c[3]===16384),'sea remains world anchored');
});

test('lowering a rounded water donor to sea level still supplies animated water behind its cutout',()=>{
 const f=fixture();f.doc.cells['1,1']={surface:'grass',level:2,curves:[{kind:'height',corner:'nw',cx:128,cy:128,r:64,lift:-1,under:{surface:'water',level:1},underX:8,underY:8}]};
 f.draw({terrainRevision:0});assert.ok(f.counters.water>0);
 const first=f.paints.length;f.water.index++;f.draw({terrainRevision:0});assert.equal(f.paints.length,first);
});

test('raised water patches redraw live with complete contributor bounds and cull when offscreen',()=>{
 const f=fixture();f.doc.cells['3,3']={surface:'water',level:2};f.draw({terrainRevision:0});
 assert.ok(f.cache.stats(f.c).livePatches>0);
 const first=f.paints.length;f.draw({terrainRevision:0});
 const live=f.paints.slice(first);assert.ok(live.length>0);assert.ok(live.every(p=>!p.opts.overviewBake));
 assert.ok(live.every(p=>p.bounds.y1>p.bounds.y0+8),'all north/south contributing terrain rows are included');
 f.c.transform.e=-4000;f.draw({terrainRevision:0});const moved=f.paints.length;f.draw({terrainRevision:0});assert.equal(f.paints.length,moved,'offscreen raised water does not redraw');
});

test('a visible working set larger than the cache bypasses before allocating and cannot churn itself',()=>{
 let allocations=0;const f=fixture({maxPixels:1000,createCanvas:(w,h)=>{allocations++;return canvas(w,h);}});
 for(let i=0;i<3;i++)assert.equal(f.draw({terrainRevision:0}),false);
 assert.equal(allocations,0);assert.equal(f.paints.length,0);assert.equal(f.cache.stats(f.c).bypasses,3);
});

test('LRU memory remains bounded while travelling and source invalidation rebuilds on demand',()=>{
 const f=fixture({maxPixels:2*520*520,maxEntries:2});
 f.c.canvas.width=200;f.c.canvas.height=200;
 for(let x=0;x<5;x++){f.c.transform.e=-x*512*.5;f.draw({terrainRevision:0});assert.ok(f.cache.stats(f.c).pixels<=2*520*520);assert.ok(f.cache.stats(f.c).chunks<=2);}
 const first=f.paints.length;f.cache.invalidate(f.c);f.draw({terrainRevision:0});assert.ok(f.paints.length>first);
});
