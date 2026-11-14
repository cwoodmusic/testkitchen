import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_CATEGORIES,assetCategory,categorySearchTerms} from './categories.mjs';
import {APARTMENT_COLLECTION_ASSETS} from '../world/apartment-collection-definitions.mjs';
import {FAMILY_FURNITURE_ASSETS} from '../world/family-furniture-definitions.mjs';

test('requested furniture and finishes are prominent, stable navigation labels',()=>{
 assert.deepEqual(ASSET_CATEGORIES.slice(0,8),['Chairs','Tables','Beds','Sofas','Rugs','Carpets','Wallpapers','Floors']);
 assert.equal(new Set(ASSET_CATEGORIES).size,ASSET_CATEGORIES.length);
 assert.ok(Object.isFrozen(ASSET_CATEGORIES));
});

test('declared object roles override bedroom/kitchen collection names without artwork access',()=>{
 const cases=[
  [{id:'collection-showroom-coastal-bedroom-dining-chair',name:'Coastal Bedroom dining chair',slot:'dining-chair',purpose:'chair'},'Chairs'],
  [{id:'collection-showroom-rustic-kitchen-sofa',name:'Rustic Kitchen loveseat',slot:'sofa'},'Sofas'],
  [{id:'family-showroom-coastal-bedroom-dining-table',name:'Coastal Bedroom family table',slot:'dining-table'},'Tables'],
  [{name:'Bedroom collection',furnitureRole:'desk-chair'},'Chairs'],
  [{name:'Kitchen room mirror',purpose:'wall-art'},'Decorations'],
  [{name:'Bedroom rug',purpose:'rug',group:'apartment furniture'},'Rugs']
 ];
 for(const [metadata,expected] of cases){
  const asset=Object.freeze({...metadata,get canvas(){throw Error('Classification must not load artwork.');}});
  const before=Object.getOwnPropertyDescriptors(asset);assert.equal(assetCategory(asset),expected);assert.deepEqual(Object.getOwnPropertyDescriptors(asset),before);
 }
});

test('procedural carpet, object rug, wallpaper and other flooring remain distinct',()=>{
 const carpet={id:'finish:floor:bach-carpet',finishKind:'floor',materialFinish:{kind:'carpet',surfaceStyle:'carpet',texture:null}};
 assert.equal(assetCategory(carpet),'Carpets');
 assert.equal(assetCategory({materialFinish:{kind:'carpet'}}),'Carpets');
 assert.equal(assetCategory({finishKind:'floor',materialFinish:{surfaceStyle:'carpet'},texture:null}),'Carpets');
 assert.equal(assetCategory({id:'finish:floor:bach-floor',finishKind:'floor',materialFinish:{kind:'floor'}}),'Floors');
 assert.equal(assetCategory({finishKind:'floor',finishId:'not-a-carpet-brand',materialFinish:{kind:'floor'}}),'Floors');
 for(const kind of ['wall','wet-wall'])assert.equal(assetCategory({finishKind:'wall',materialFinish:{kind}}),'Wallpapers');
 assert.equal(assetCategory({id:'room-rug-victorian-bath-rug',group:'room rugs'}),'Rugs');
 assert.equal(assetCategory({id:'family-ella-rug',slot:'rug',sourceAssetId:'collection-ella-rug'}),'Rugs');
 assert.ok(categorySearchTerms(carpet).includes('carpets'));
 assert.ok(!categorySearchTerms({slot:'rug'}).includes('carpet'));
});

test('legacy and decor use the principal object instead of incidental accessories or packs',()=>{
 const cases=[
  [{name:'Bagpipes on stool',group:'brass and winds'},'Music & Instruments'],
  [{name:'Carved oak park bench',group:'street furniture'},'Chairs'],
  [{name:'Luthier workbench',group:'music workshop'},'Desks'],
  [{name:'Violin-making tools cabinet',group:'music workshop'},'Storage'],
  [{name:'Analog mixing desk',group:'music workshop'},'Music & Instruments'],
  [{name:'Hanging guitar shop sign',group:'signs and lights'},'Decorations'],
  [{name:'Limestone street planter',group:'urban street details'},'Plants & Pots'],
  [{name:'Rose-covered wooden arch',group:'garden features'},'Garden & Outdoor'],
  [{name:'Stone drinking fountain',group:'street furniture'},'Garden & Outdoor'],
  [{name:'Round stained-glass lyre window',group:'architectural details'},'Walls'],
  [{id:'music-square-wall',name:'Music Square matching stone wall',group:'construction'},'Walls'],
  [{name:'Decorative water wheel',group:'waterfront'},'Waterfront'],
  [{id:'surface:grass',name:'Grass ground texture',layer:'ground'},'Terrain'],
  [{name:'An unfamiliar ornament',purpose:'constructor'},'Decorations']
 ];
 for(const [asset,expected] of cases)assert.equal(assetCategory(asset),expected,asset.name||asset.id);
});

test('all real collection furniture is partitioned by kind across every owner style',()=>{
 const counts={};for(const asset of APARTMENT_COLLECTION_ASSETS){const category=assetCategory(asset);assert.ok(ASSET_CATEGORIES.includes(category),asset.id);counts[category]=(counts[category]||0)+1;}
 assert.equal(counts.Chairs,93);assert.equal(counts.Tables,62);assert.equal(counts.Beds,31);assert.equal(counts.Sofas,31);assert.equal(counts.Rugs,31);
 const familyCounts={};for(const asset of FAMILY_FURNITURE_ASSETS){const category=assetCategory(asset);familyCounts[category]=(familyCounts[category]||0)+1;}
 assert.deepEqual(familyCounts,{Tables:62,Rugs:31,'Plants & Pots':31});
});

test('search terms include category labels and familiar names in lowercase',()=>{
 for(const category of ASSET_CATEGORIES){
  const fixture=category==='Wallpapers'?{finishKind:'wall'}:null;
  if(fixture)assert.ok(categorySearchTerms(fixture).includes(category.toLowerCase()));
 }
 assert.match(categorySearchTerms({slot:'sofa'}),/couch/);
 assert.match(categorySearchTerms({slot:'dining-chair'}),/seating/);
 assert.match(categorySearchTerms({slot:'shelf'}),/shelves/);
 assert.equal(categorySearchTerms({slot:'sofa'}),categorySearchTerms({slot:'sofa'}).toLowerCase());
});
