'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const meta=require('../scripts/dance-floor-blend-regions.json');
const {repairMask}=require('../scripts/build-dance-floor-blend.cjs');
const {floorFeatherWeight}=require('../scripts/build-walkway-cleanup.cjs');
const {isGlassFloor}=require('../wall-reflections.js');
const {rebaseArtwork}=require('../scripts/build-cosmic-floor.cjs');
const {width,height}={width:meta.worldSize[0],height:meta.worldSize[1]},mask=repairMask();

test('dance-floor repair reaches the mismatched glass without touching walls, panels or rails',()=>{
 for(const [x,y]of [[630,650],[740,690],[780,700],[750,800],[730,825],[700,830]])
  assert.equal(mask[y*width+x],1,`The exposed floor at ${x},${y} receives the blend`);
 for(const [x,y]of [[700,630],[740,640],[740,660],[620,690],[640,750],[670,810],[780,830],[808,700],[750,837],[500,750]])
  assert.equal(mask[y*width+x],0,`The wall, authored neon, painted panel or rail at ${x},${y} stays unchanged`);
 const [left,top,w,h]=meta.repairBounds;let pixels=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(mask[y*width+x]){
  pixels++;assert.ok(x>=left&&x<left+w&&y>=top&&y<top+h,'No repair pixel escapes the reviewed bounds');
  assert.equal(isGlassFloor(x+.5,y+.5),true,'All repaired pixels belong to the shared glass geometry');
 }
 assert.ok(pixels>20000&&pixels<35000,'The mask repairs the full patch rather than a few witness pixels');
});

test('current published artwork has no repair overlap and every saved field remains byte-identical',()=>{
 const projectPath=path.join(__dirname,'..','published-world-project.json'),raw=fs.readFileSync(projectPath),project=JSON.parse(raw),before=structuredClone(project);
 const checked=rebaseArtwork(project,mask,width);
 assert.equal(checked.removed,0,'The native-only compositor must not consume authored background pixels');
 assert.deepEqual(checked.project,project);assert.deepEqual(project,before);
 assert.deepEqual(fs.readFileSync(projectPath),raw,'Checking the repair never writes the published export');
 assert.equal(meta.preserveProject,true);
});

test('feathering retains wall-contact reflections and fades the new floor into its surrounding edges',()=>{
 const f=meta.floorFeather,weight=(x,y)=>floorFeatherWeight(f,x,y);
 assert.ok(weight(750,649)<.02,'Keep almost all of the original reflected wall contact at the top');
 assert.ok(weight(750,660)>weight(750,649));
 assert.equal(weight(750,680),1,'The patch interior uses the matching generated floor');
 assert.ok(weight(806,750)<.04,'The right boundary meets unchanged glass softly');
 assert.ok(weight(750,836)<.03,'The blend fades before the front rail');
 assert.ok(weight(618,680)<.03,'The upper tile-side edge keeps its original contact glow');
});

test('adding a top feather leaves every existing compositor weight unchanged when it is absent',()=>{
 const old={right:[789,807],bottom:[770,806],leftBelow:[596,618,649]};
 for(let y=506;y<837;y+=7)for(let x=596;x<808;x+=5){
  let expected=Math.max(0,Math.min(1,(807-x-.5)/18,(806-y-.5)/36));
  if(y>=649)expected=Math.max(0,Math.min(expected,(x+.5-596)/22));
  assert.equal(floorFeatherWeight(old,x,y),expected,'Older artwork passes retain their exact feather arithmetic');
 }
 assert.equal(floorFeatherWeight(undefined,700,700),1);
});
