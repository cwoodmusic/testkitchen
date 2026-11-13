import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function fixture(){
 let ready=false,canvases=0,paintCalls=0,warms=0;const source=readFileSync(new URL('./room-rugs.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace('export function ','function ')+'\n({createRoomRugItems})';
 const context={drawHomeMaterialRug(_c,r){paintCalls++;assert.equal(r.x,0);assert.equal(r.y,0);assert.equal(r.w,96);assert.equal(r.h,56);return ready;},async warmHomeMaterials(suite){warms++;assert.equal(suite.decorativeRugTexture,'victorian-bath-rug.png');ready=true;},document:{createElement(){canvases++;return {width:0,height:0,getContext:()=>({})};}}};
 return {...runInNewContext(source,context),get counts(){return {canvases,paintCalls,warms};}};
}
test('native scene rugs become ordinary noncolliding ground items without changing the source scene',()=>{
 const f=fixture(),catalog=new Map(),scene={rugs:[{x:436,y:194,w:96,h:56,id:'victorian-bath-rug',texture:'victorian-bath-rug.png',sourceRect:{x:104,y:110,w:1436,h:738}}]},before=JSON.stringify(scene),[item]=f.createRoomRugItems(scene,catalog),asset=catalog.get(item.asset);
 assert.equal(item.id,'room-rug-victorian-bath-rug');assert.equal(item.roomRugId,'victorian-bath-rug');assert.equal(item.x,484);assert.equal(item.y,250);assert.equal(item.w,96);assert.equal(item.h,56);assert.equal(item.rotation,0);assert.equal(item.layer,'ground');assert.equal(item.solid,false);assert.equal(item.collisionBoxes.length,0);
 assert.equal(asset.owner,undefined);assert.equal(asset.slot,undefined);assert.equal(asset.roomRug,true);assert.equal(asset.boxes.length,0);assert.equal(asset.layer,'ground');assert.equal(JSON.stringify(scene),before);assert.equal(f.counts.canvases,0,'Registration does not decode or allocate artwork');
 const again=f.createRoomRugItems(scene,catalog);assert.equal(catalog.size,1);assert.equal(catalog.get(again[0].asset),asset,'Repeated model creation reuses the shared catalog asset');
});
test('room rug canvas stays blank until native art is ready, then paints once and reuses its raster',async()=>{
 const f=fixture(),catalog=new Map();f.createRoomRugItems({rugs:[{id:'victorian-bath-rug',texture:'victorian-bath-rug.png',x:0,y:0,w:96,h:56}]},catalog);const asset=catalog.get('room-rug-victorian-bath-rug'),pending=asset.canvas;assert.equal(pending.width,96);assert.equal(pending.height,56);assert.equal(asset.canvas,pending);assert.equal(f.counts.canvases,1);assert.equal(f.counts.paintCalls,2);
 await asset.ensureFull();assert.equal(asset.canvas,pending);const painted=f.counts.paintCalls;for(let i=0;i<100;i++)assert.equal(asset.canvas,pending);assert.equal(f.counts.paintCalls,painted,'Ready frames do not redraw or decode the same native rug');assert.equal(f.counts.canvases,1);assert.equal(f.counts.warms,1);
});
