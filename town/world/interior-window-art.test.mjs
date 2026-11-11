import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decorDefinitions} from './decor-definitions.mjs';
import {INTERIOR_WINDOW_ASSETS,interiorWindowAssetId,interiorWindowGeometry,warmInteriorWindows,drawInteriorWindow} from './interior-window-art.mjs';

const frames=JSON.parse(readFileSync(new URL('../assets/decor/atlas.json',import.meta.url),'utf8')).find(f=>f.family===15).cells;
const ids=Object.values(INTERIOR_WINDOW_ASSETS);
function context(){
 const calls=[],stack=[],c={calls,imageSmoothingEnabled:true};c.save=()=>stack.push(c.imageSmoothingEnabled);c.restore=()=>{c.imageSmoothingEnabled=stack.pop();};c.drawImage=(...args)=>calls.push(args);c.fillRect=()=>{throw Error('Detailed windows must draw their actual native artwork');};return c;
}

test('interior donors are actual existing architectural window sprites, never the nearby gates',()=>{
 for(const id of ids){const d=decorDefinitions.find(d=>d.id===id);assert(d);assert.equal(d.group,'architectural details');assert.match(d.name,/window/i);}
 assert.equal(interiorWindowAssetId({showroomId:'midcentury-studio'}),'decor-16-09');assert.equal(interiorWindowAssetId({collectionOwner:'showroom-botanical-conservatory'}),'decor-16-10');assert.equal(interiorWindowAssetId({resident:'bach'}),'decor-16-08');assert.equal(interiorWindowAssetId({}, {asset:'decor-16-04'}),'decor-16-09');
});

test('native donor aspect and existing window centre/top are preserved within the north wall band',()=>{
 for(const index of [7,8,9])for(const maxWidth of [70,80,155,220]){
  const source=frames[index],window=Object.freeze({x:600,y:24,w:maxWidth}),g=interiorWindowGeometry(window,{width:source.w,height:source.h});assert(g);assert.equal(g.x+g.w/2,600);assert.equal(g.y,24);assert(g.w<=maxWidth+1e-9);assert(g.y+g.h<=102+1e-9);assert(Math.abs(g.w/g.h-source.w/source.h)<1e-12,'No squashing a detailed window into the old landscape rectangle');
 }
 assert.equal(interiorWindowGeometry({x:0,y:20,w:150},null),null);
});

test('window rendering draws the current real native image once and preserves caller state and metadata',()=>{
 let reads=0;const native={width:282,height:268},asset={id:'decor-16-09',group:'construction',get canvas(){reads++;return native;}},catalog=new Map([[asset.id,asset]]),window=Object.freeze({x:300,y:20,w:155}),scene=Object.freeze({kind:'showroom',showroomId:'midcentury-studio'}),c=context(),g=drawInteriorWindow(c,window,{catalog,scene});
 assert(g);assert.equal(g.asset,asset.id);assert.equal(reads,1);assert.equal(c.calls.length,1);assert.strictEqual(c.calls[0][0],native);assert.deepEqual(c.calls[0].slice(1),[g.x,g.y,g.w,g.h]);assert.equal(c.imageSmoothingEnabled,true);assert.equal(drawInteriorWindow(c,window,{catalog:new Map(),scene}),false);assert.equal(c.calls.length,1);
});

test('window native warming deduplicates repeated scene entries and subsequent drawing uses the new canvas',async()=>{
 let loads=0,current={width:80,height:76},finish;const loaded={width:282,height:268},asset={id:'decor-16-09',group:'construction',get canvas(){return current;},ensureFull(){loads++;return new Promise(resolve=>{finish=()=>{current=loaded;resolve();};});}},catalog=new Map([[asset.id,asset]]),scene={kind:'showroom',showroomId:'midcentury-studio',windows:[{x:220,y:24,w:80},{x:780,y:24,w:70}]};
 const c=context();drawInteriorWindow(c,scene.windows[0],{catalog,scene});const a=warmInteriorWindows(scene,catalog),b=warmInteriorWindows(scene,catalog);await Promise.resolve();assert.equal(loads,1);finish();await Promise.all([a,b]);await warmInteriorWindows(scene,catalog);assert.equal(loads,1);drawInteriorWindow(c,scene.windows[0],{catalog,scene});assert.notStrictEqual(c.calls[0][0],loaded);assert.strictEqual(c.calls[1][0],loaded,'A cached background can refresh with full native detail');
});
