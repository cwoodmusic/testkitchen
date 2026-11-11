import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {HOME_MATERIAL_SUITES,getHomeMaterialSuite,applyHomeMaterialSuite} from './home-material-definitions.mjs';
import {APARTMENT_COLLECTION_OWNERS} from './apartment-collection-definitions.mjs';

test('every collection owner has an independent named dry and sanitary material suite',()=>{
 assert.deepEqual(HOME_MATERIAL_SUITES.map(s=>s.owner).sort(),[...APARTMENT_COLLECTION_OWNERS].sort());
 for(const key of ['name','floor','wall','wet']){
  const values=HOME_MATERIAL_SUITES.map(s=>key==='name'?s.name:s.construction[key]);assert.equal(new Set(values).size,31,'Distinct constructions are required for '+key);
 }
 for(const suite of HOME_MATERIAL_SUITES){
  assert.equal(getHomeMaterialSuite(suite.owner),suite);assert(Object.isFrozen(suite));assert.equal(new Set(suite.assets).size,4);
  for(const finish of [suite.floor,suite.wallpaper,suite.wetFloor,suite.wetWallpaper]){assert(finish.homeMaterial);assert.equal(finish.owner,suite.owner);assert(finish.texture.startsWith(suite.owner+'-'));assert(finish.colors.every(color=>/^#[0-9a-f]{6}$/i.test(color)));}
  assert.notEqual(suite.floor.texture,suite.wetFloor.texture);assert.equal(suite.wetWallpaper.texture,suite.wetFloor.texture,'Matching sanitary ceramic may continue up a wet wall');
 }
 assert.equal(getHomeMaterialSuite('not-a-resident'),null);
});

test('all31 authored suites ship complete distinct native tile files within a fixed decode budget',()=>{
 const root=new URL('../assets/home-materials/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root))),files=manifest.collections.flatMap(c=>c.files);
 assert.equal(manifest.owners,31);assert.equal(manifest.textures,124);assert.equal(files.length,124);assert.equal(new Set(files.map(f=>f.file)).size,124);assert(manifest.pixels<4*1024*1024);
 assert.deepEqual(manifest.collections.map(c=>c.owner).sort(),HOME_MATERIAL_SUITES.map(c=>c.owner).sort());
 for(const suite of HOME_MATERIAL_SUITES){const shipped=manifest.collections.find(c=>c.owner===suite.owner);assert.deepEqual(shipped.files.map(f=>f.file).sort(),suite.assets.slice().sort());}
 for(const file of files){assert(file.width>0&&file.height>0);assert.equal(createHash('sha256').update(readFileSync(new URL(file.file,root))).digest('hex'),file.sha256,file.file);}
 for(const suffix of ['floor','wall','wet-floor'])assert.equal(new Set(manifest.collections.map(c=>c.files.find(f=>f.file===c.owner+'-'+suffix+'.webp').sha256)).size,31,'Each owner needs actual distinct '+suffix+' art');
});

test('surface binding preserves every physical rectangle, furnishing and interaction',()=>{
 const scene={kind:'apartment',width:2304,height:1120,rooms:[{name:'Bathroom',functionalRole:'bathroom',x:36,y:112,w:598,h:330},{name:'Studio',functionalRole:'living',x:1584,y:496,w:684,h:588,wallpaperAreas:[{x:1584,y:390,w:684,h:88}]}],walls:[{x:650,y:106,w:20,h:112}],privacyDoors:[{id:'private',x:660,y:218,length:152}],items:[{asset:'owned',x:1800,y:800,rotation:90}],solids:[{x:650,y:106,w:20,h:112}],zones:[{id:'decorate',x:962,y:715,w:380,h:300}],spawn:{x:1152,y:975},ownedDecor:[{productId:'owned-chair'}]};
 const before=structuredClone(scene),items=scene.items,solids=scene.solids,zones=scene.zones;
 assert.equal(applyHomeMaterialSuite(scene,'player'),scene);assert.equal(scene.items,items);assert.equal(scene.solids,solids);assert.equal(scene.zones,zones);
 for(const key of ['items','solids','zones','spawn','ownedDecor','width','height'])assert.deepEqual(scene[key],before[key]);
 for(let i=0;i<scene.rooms.length;i++)for(const key of ['name','functionalRole','x','y','w','h'])assert.deepEqual(scene.rooms[i][key],before.rooms[i][key]);
 for(let i=0;i<scene.walls.length;i++)for(const key of ['x','y','w','h'])assert.equal(scene.walls[i][key],before.walls[i][key]);
 assert.equal(scene.rooms[0].floorFinish,scene.homeMaterialSuite.wetFloor);assert.equal(scene.rooms[1].floorFinish,scene.homeMaterialSuite.floor);assert.deepEqual(scene.rooms[1].wallpaperAreas,before.rooms[1].wallpaperAreas);
 assert.deepEqual(scene.privacyDoors.map(({color,trim,...door})=>door),before.privacyDoors);
});

test('repeated room warmups reuse decoded bitmaps and never create DOM images',async()=>{
 const old={document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let fetches=0,decodes=0;const urls=[];
 globalThis.document={createElement(){throw Error('Materials must not use DOM image decoding');}};
 globalThis.fetch=async url=>{fetches++;urls.push(String(url));return {ok:true,blob:async()=>({url:String(url)})};};
 globalThis.createImageBitmap=async()=>{decodes++;return {width:192,height:96};};
 try{const fresh=await import('./home-materials.mjs?material-bitmap-cache-test'),suite=getHomeMaterialSuite('showroom-midcentury-studio');await fresh.warmHomeMaterials(suite);await fresh.warmHomeMaterials(suite);assert.equal(fetches,4);assert.equal(decodes,4);assert(urls.every(url=>url.endsWith('?material-bitmap-cache-test')));assert.deepEqual(fresh.getHomeMaterialCacheStats(),{textures:4,ready:4,pixels:4*192*96});}
 finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
