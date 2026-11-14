import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,height,actorHeight,blocked} from './model.mjs';
import {canBoardFishingDock,restoreOutdoorActor,clearNetPath,onSameOutdoorSurface} from './outdoor-actor-layer.mjs';
import {createTownFishing} from './town-fishing.mjs';

const catalog=new Map();
function fixture(){const doc=blank();doc.cells['3,3']={surface:'sand',level:0,bridge:'ns',pier:{axis:'ns',level:8}};return {doc,under:{x:224,y:224,underPier:true},top:{x:224,y:224},dock:{stand:{x:224,y:224},boat:{x:300,y:280,virtual:true}}};}

test('boarding requires the deck surface rather than merely sharing the dock coordinates',()=>{
 const f=fixture(),raw=JSON.stringify(f.doc);assert.equal(height(f.doc,224,224),384);assert.equal(actorHeight(f.doc,f.under),0);assert.equal(canBoardFishingDock(f.doc,f.under,f.dock),false);assert.equal(onSameOutdoorSurface(f.doc,f.under,f.top),false);assert.equal(onSameOutdoorSurface(f.doc,f.under,{x:160,y:224}),true);assert.equal(canBoardFishingDock(f.doc,f.top,f.dock),true);
 assert.equal(canBoardFishingDock(f.doc,{x:160,y:224},f.dock),false,'Nearby low beach is not a deck approach');f.doc.cells['2,3']={surface:'grass',level:8};assert.equal(canBoardFishingDock(f.doc,{x:160,y:224},f.dock),true);delete f.doc.cells['2,3'];assert.equal(JSON.stringify(f.doc),raw);
 assert.equal(canBoardFishingDock(f.doc,{x:224,y:500},f.dock),false);assert.equal(canBoardFishingDock(f.doc,f.top,null),false);
});

test('runtime restores preserve valid lower-layer flags and clear stale deck, water and removed-pier flags without touching the map',()=>{
 const f=fixture(),raw=JSON.stringify(f.doc),saved={...f.under},actor={x:300,y:300};assert.equal(blocked(f.doc,saved.x,saved.y,catalog,saved),false);restoreOutdoorActor(f.doc,actor,saved,catalog);assert.deepEqual(actor,saved);assert.deepEqual(saved,f.under);assert.equal(JSON.stringify(f.doc),raw);
 restoreOutdoorActor(f.doc,actor,{x:224,y:224},catalog);assert.equal(actor.underPier,undefined);assert.equal(actorHeight(f.doc,actor),384);
 const stale={x:224,y:224,underPier:true};f.doc.cells['3,3'].surface='water';restoreOutdoorActor(f.doc,actor,stale,catalog);assert.equal(actor.underPier,undefined);f.doc.cells['3,3'].surface='sand';restoreOutdoorActor(f.doc,actor,{x:203,y:248,underPier:true},catalog);assert.equal(actor.underPier,undefined,'A restored actor cannot keep a lower layer inside a real timber support');f.doc.cells['3,3'].pier.level=1;restoreOutdoorActor(f.doc,actor,stale,catalog);assert.equal(actor.underPier,undefined);delete f.doc.cells['3,3'].pier;delete f.doc.cells['3,3'].bridge;restoreOutdoorActor(f.doc,actor,stale,catalog);assert.equal(actor.underPier,undefined);
});

test('a boat or changed-project spawn cannot inherit the preceding underwater walking marker',()=>{
 const f=fixture(),actor={...f.under};restoreOutdoorActor(f.doc,actor,{x:400,y:400},catalog);assert.equal(actor.underPier,undefined);assert.deepEqual(actor,{x:400,y:400});restoreOutdoorActor(f.doc,actor,f.under,catalog);assert.equal(actor.underPier,true);restoreOutdoorActor(blank(),actor,{x:1000,y:1000},catalog);assert.equal(actor.underPier,undefined);
});

test('the public fishing start API refuses a lower actor before loading audio, journals, boat navigation or mutating its position',async t=>{
 const old={document:globalThis.document,window:globalThis.window};t.after(()=>Object.assign(globalThis,old));const hud={hidden:true,querySelector:()=>null};globalThis.document={createElement:()=>hud,body:{append(){}},addEventListener(){}};globalThis.window={addEventListener(){}};
 const f=fixture(),raw=JSON.stringify(f.doc),player={...f.under},fishing=createTownFishing({canvas:{focus(){}},journal:{},getProject:()=>f.doc,getPlayer:()=>player,getOwner:()=>'guest',catalog});assert.equal(await fishing.start(f.dock),false);assert.equal(fishing.state.phase,'idle');assert.deepEqual(player,f.under);assert.equal(JSON.stringify(f.doc),raw);
});


test('lower net rays carry their layer while ordinary note rays keep deck-only collision',()=>{
 const f=fixture();f.doc.cells['4,3']={surface:'sand',level:0,bridge:'ns',pier:{axis:'ns',level:8}};const raw=JSON.stringify(f.doc);assert.equal(clearNetPath(f.doc,f.under,{x:352,y:224},catalog),true,'A lower ray crosses two elevated deck cells before exiting to sand');assert.equal(clearNetPath(f.doc,{x:160,y:224},{x:224,y:224},catalog),false,'A plain note ray must not automatically gain an under-deck layer');assert.equal(JSON.stringify(f.doc),raw);assert.deepEqual(f.under,{x:224,y:224,underPier:true});
 f.doc.cells['4,3'].surface='water';assert.equal(clearNetPath(f.doc,f.under,{x:352,y:224},catalog),false);
});
