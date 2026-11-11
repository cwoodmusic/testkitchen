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
  for(const finish of [suite.floor,suite.wallpaper,suite.bedroomFloor,suite.kitchenFloor,suite.wetFloor,suite.wetWallpaper]){assert(finish.homeMaterial);assert.equal(finish.owner,suite.owner);assert(finish.texture?.startsWith(suite.owner+'-')||finish.surfaceStyle);assert(finish.colors.every(color=>/^#[0-9a-f]{6}$/i.test(color)));}
  assert.notEqual(suite.floor.texture,suite.wetFloor.texture);assert.equal(suite.wetWallpaper.texture,null,'Wet floor artwork must never repeat up bathroom walls');assert.equal(suite.wetWallpaper.surfaceStyle,'ceramic-wall');assert.equal(suite.bedroomFloor.surfaceStyle,'carpet');assert.notEqual(suite.kitchenFloor.surfaceStyle,'carpet');
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


test('bedrooms, kitchens, living rooms and bathrooms get separate appropriate finishes without changing their floor regions',()=>{
 const roles=['apartment','bedroom','kitchen','dining','living','bathroom'];
 for(const suite of HOME_MATERIAL_SUITES){
  const scene={rooms:roles.map((functionalRole,i)=>({functionalRole,name:functionalRole,x:i*20,y:112,w:120,h:160})),walls:[],privacyDoors:[],items:[],solids:[],zones:[],spawn:{x:20,y:300}},before=scene.rooms.map(r=>[r.x,r.y,r.w,r.h]);applyHomeMaterialSuite(scene,suite.owner);
  const byRole=new Map(scene.rooms.map(r=>[r.functionalRole,r]));assert.equal(byRole.get('bedroom').floorFinish,suite.bedroomFloor);assert.equal(byRole.get('kitchen').floorFinish,suite.kitchenFloor);assert.equal(byRole.get('bathroom').floorFinish,suite.wetFloor);assert.equal(byRole.get('bathroom').wallpaper,suite.wetWallpaper);assert.equal(byRole.get('living').floorFinish,suite.floor);
  assert.equal(new Set(['bedroom','kitchen','bathroom','living'].map(role=>byRole.get(role).floorFinish.id)).size,4);assert.equal(byRole.get('dining').floorOverlay,false,'Semantic dining nook must not repaint a rectangle across an open-plan boundary');assert.deepEqual(scene.rooms.map(r=>[r.x,r.y,r.w,r.h]),before);
 }
 const botanical=getHomeMaterialSuite('showroom-botanical-conservatory'),mcm=getHomeMaterialSuite('showroom-midcentury-studio');assert(botanical.floor.presentation.opacity>=.75);assert(botanical.wallpaper.presentation.opacity>=.65);assert(mcm.floor.presentation.opacity>=.65);assert.equal(botanical.floor.presentation.scale,.5);assert.notEqual(botanical.floor.presentation.color,botanical.floor.colors[0]);
});

test('small patterned surfaces share world phase and cache their detail once instead of generating each frame',async()=>{
 const old={document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};let canvases=0;const transforms=[];
 const ctx=()=>({globalAlpha:1,save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){},createPattern(){return {setTransform(value){transforms.push(value);}};}});
 globalThis.document={createElement(){canvases++;return {width:0,height:0,getContext:ctx};}};globalThis.fetch=async()=>({ok:true,blob:async()=>({})});globalThis.createImageBitmap=async()=>({width:192,height:96});
 try{
  const material=await import('./home-materials.mjs?room-contrast-pattern-cache-test'),suite=getHomeMaterialSuite('showroom-midcentury-studio');await material.warmHomeMaterials(suite);
  const c=ctx();for(const x of [0,128])material.drawHomeMaterialFloor(c,{x,y:0,w:128,h:160,floorFinish:suite.floor});assert.equal(transforms.length,2);assert.deepEqual(transforms[0],transforms[1]);assert.equal(transforms[0].e,0);assert.equal(transforms[0].f,0,'Adjacent rectangles use the same world-aligned texture, never a local room offset');
  for(const row of HOME_MATERIAL_SUITES){material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:row.bedroomFloor});material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:row.kitchenFloor});material.drawHomeMaterialWallpaper(c,{wallpaper:row.wetWallpaper,wallpaperAreas:[{x:0,y:0,w:128,h:106}]});}
  const first=material.getHomeSurfacePatternCacheStats();assert.equal(canvases,93);assert.equal(first.entries,93);assert(first.entries<=first.maxEntries&&first.pixels<=first.maxPixels);
  for(const row of HOME_MATERIAL_SUITES)for(const finish of [row.bedroomFloor,row.kitchenFloor])material.drawHomeMaterialFloor(c,{x:0,y:0,w:128,h:128,floorFinish:finish});assert.equal(canvases,93,'Re-entry reuses every procedural tile');
 }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});


test('Botanical and Midcentury bathrooms replace the busy mirrored wet repeat with quiet square floor tiles',()=>{
 const expected=new Map([['showroom-botanical-conservatory','stone'],['showroom-midcentury-studio','porcelain']]);
 for(const suite of HOME_MATERIAL_SUITES){
  if(expected.has(suite.owner)){assert.equal(suite.wetFloor.texture,null);assert.equal(suite.wetFloor.surfaceStyle,expected.get(suite.owner));assert.equal(suite.wetFloor.presentation.scale,.5);assert.notEqual(suite.wetFloor.pattern,suite.wetWallpaper.pattern);assert.notDeepEqual(suite.wetFloor.colors,suite.wetWallpaper.colors,'Floor and wall retain separate values and tile layouts');}
  else {assert.equal(suite.wetFloor.texture,suite.owner+'-wet-floor.webp');assert.equal(suite.wetFloor.surfaceStyle,undefined,'Other29 authored fancy bathroom floors stay intact');}
 }
});
