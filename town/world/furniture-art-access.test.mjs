import test from 'node:test';
import assert from 'node:assert/strict';
import {furnitureFacingPointHit,ensureFacingArt,preparePlacedFacingArt} from './furniture-art-access.mjs';
import {furnitureFacingPlacement} from './furniture-facing.mjs';
import {APARTMENT_COLLECTION_ASSETS} from './apartment-collection-definitions.mjs';
import {createApartmentCollectionRuntime} from './apartment-collection-runtime.mjs';

test('clicking among 500 real collection views warms only the candidate inside the pointer bounds',async()=>{
 const definitions=APARTMENT_COLLECTION_ASSETS.slice(0,500),owners=[...new Set(definitions.map(def=>def.owner))],loads=[],canvases=[],thumbs=new Map(owners.map(owner=>[owner,{width:400,height:800}]))
 const manifest={collections:owners.map(owner=>({owner,file:owner+'-south.webp',width:400,height:800,cells:definitions.filter(def=>def.owner===owner).map((def,index)=>({id:def.id,x:index%4*100,y:Math.floor(index/4)*100,w:90,h:90}))}))};
 const directionManifest={collections:manifest.collections.map(collection=>({owner:collection.owner,views:Object.fromEntries(['north','east','west'].map(direction=>[direction,{file:collection.owner+'-'+direction+'.webp',width:400,height:800,cells:collection.cells}]))}))};
 const runtime=createApartmentCollectionRuntime({definitions,manifest,directionManifest,thumbnails:thumbs,loadImage:async file=>{loads.push(file);return {width:400,height:800};},createCanvas(){const canvas={width:0,height:0,painted:false};canvas.getContext=()=>({drawImage(){canvas.painted=true;},getImageData(){return {data:[0,0,0,canvas.painted?255:0]};}});canvases.push(canvas);return canvas;}});
 const assets=new Map(definitions.map(def=>[def.id,{...def,getFacingView:direction=>runtime.view(def.id,direction)}])),objects=definitions.map((def,index)=>({asset:def.id,x:index*1000,y:1000,scale:1,rotation:270}));
 const target=objects[0],placement=furnitureFacingPlacement(assets.get(target.asset),target,undefined,{includeImage:false}),point={x:placement.x+placement.w/2,y:placement.y+placement.h/2};
 const pick=()=>[...objects].reverse().find(object=>furnitureFacingPointHit(assets.get(object.asset),object,{x:object.x,y:object.y,offset:1},point));
 assert.strictEqual(pick(),target);assert.equal(loads.length,1);assert.equal(loads[0],definitions[0].owner+'-east.webp');assert.equal(runtime.stats.canvasEntries,1);assert.equal(canvases.length,1);
 await new Promise(resolve=>setImmediate(resolve));const builds=runtime.stats.canvasBuilds;for(let i=0;i<100;i++)assert.strictEqual(pick(),target);
 assert.equal(loads.length,1);assert.equal(runtime.stats.canvasEntries,1);assert.equal(runtime.stats.canvasBuilds,builds);runtime.clear();
});

test('facing hit tests retain alpha threshold, scaled view coordinates and legacy fallback',()=>{
 const samples=[],image={width:100,height:200,getContext:()=>({getImageData(x,y){samples.push([x,y]);return {data:[0,0,0,x===50?41:40]};}})},view={w:100,h:200,footCenter:{x:50,y:200}},a={id:'chair',w:100,h:200,boxes:[],getFacingView:()=>view,getFacingImage:()=>image},object={x:500,y:600,scale:2,rotation:0},pose={x:500,y:600,offset:1};
 assert.equal(furnitureFacingPointHit(a,object,pose,{x:500,y:400}),true);assert.deepEqual(samples.pop(),[50,100]);
 assert.equal(furnitureFacingPointHit(a,object,pose,{x:498,y:400}),false);assert.deepEqual(samples.pop(),[49,100]);
 assert.equal(furnitureFacingPointHit(a,object,pose,{x:600,y:400}),false);assert.equal(samples.length,0);assert.equal(furnitureFacingPointHit({...a,getFacingView:undefined,getFacingImage:undefined},object,pose,{x:500,y:400}),null);
});

test('library warmups keep relative facing even for an old north-authored chair',async()=>{
 const calls=[],a={facing:'north',authoredFacing:true,ensureFull(direction){calls.push({direction,thisValue:this});return direction;}};
 for(const rotation of [0,90,180,270,360])assert.equal(await ensureFacingArt(a,rotation),['south','west','north','east','south'][calls.length-1]);
 assert.deepEqual(calls.map(call=>call.direction),['south','west','north','east','south']);assert(calls.every(call=>call.thisValue===a));assert.equal(ensureFacingArt(null,270),undefined);
});

test('flat wall art and rugs prepare the same canonical texture used by rendering',async()=>{
 const calls=[],wall={wallMounted:true,ensureFull:direction=>calls.push(['wall',direction])},rug={layer:'ground',ensureFull:direction=>calls.push(['rug',direction])};
 await ensureFacingArt(wall,90);await ensureFacingArt(rug,270);assert.deepEqual(calls,[['wall','south'],['rug','south']]);calls.length=0;
 await preparePlacedFacingArt({objects:[{asset:'wall',rotation:90},{asset:'wall',rotation:180},{asset:'rug',rotation:270},{asset:'rug',rotation:0}]},new Map([['wall',wall],['rug',rug]]));
 assert.deepEqual(calls,[['wall','south'],['rug','south']]);
});

test('town import prepares each saved asset/facing once and bounds concurrent native work to four',async()=>{
 let active=0,peak=0;const calls=[],catalog=new Map(Array.from({length:12},(_,i)=>['asset-'+i,{ensureFull(direction){calls.push([i,direction]);peak=Math.max(peak,++active);return new Promise(resolve=>setImmediate(()=>{active--;resolve();}));}}]));
 const objects=Array.from({length:12},(_,i)=>({asset:'asset-'+i,rotation:[0,90,180,270][i%4]}));objects.push({...objects[0],rotation:360},{...objects[3]},{asset:'missing',rotation:270});
 await preparePlacedFacingArt({objects},catalog);assert.equal(calls.length,12);assert.equal(peak,4);assert.equal(active,0);assert.deepEqual(calls,Array.from({length:12},(_,i)=>[i,['south','west','north','east'][i%4]]));
});

test('preparation surfaces artwork failures without altering placed records',async()=>{
 const objects=[{asset:'chair',x:30,y:40,rotation:270}],before=JSON.stringify(objects),catalog=new Map([['chair',{ensureFull:()=>Promise.reject(Error('artwork offline'))}]]);
 await assert.rejects(preparePlacedFacingArt({objects},catalog),/artwork offline/);assert.equal(JSON.stringify(objects),before);
});

test('one missing source cannot finish room preparation before the other placed artwork settles',async()=>{
 const loaded=[],objects=Array.from({length:9},(_,i)=>({asset:'item-'+i,rotation:0})),catalog=new Map(objects.map((object,i)=>[object.asset,{async ensureFull(){if(i===0)throw Error('first source unavailable');await new Promise(resolve=>setImmediate(resolve));loaded.push(i);}}]));
 await assert.rejects(preparePlacedFacingArt({objects},catalog),/first source unavailable/);
 assert.deepEqual(loaded.sort((a,b)=>a-b),[1,2,3,4,5,6,7,8]);
});

test('alternating map placements prepare known provider/owner/facing families together',async()=>{
 const calls=[],catalog=new Map(),objects=[];
 for(let index=0;index<9;index++)for(const owner of ['bach','mozart','vivaldi']){
  const id=owner+'-'+index,asset={id,pack:'apartment-collections-864',collectionOwner:owner,ensureFull(direction){calls.push(owner+'|'+direction);return Promise.resolve();}};catalog.set(id,asset);objects.push({asset:id,rotation:270});
 }
 await preparePlacedFacingArt({objects},catalog);assert.deepEqual(calls,[...Array(9).fill('bach|east'),...Array(9).fill('mozart|east'),...Array(9).fill('vivaldi|east')]);
});
