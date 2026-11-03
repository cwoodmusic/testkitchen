'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {cleanupMask}=require('../scripts/build-walkway-cleanup.cjs');
const boutique=require('../scripts/boutique-rectangle-regions.json'),stage=require('../scripts/stage-wall-regions.json');

test('later rectangular walls own the removed diagonal and black floor but preserve neighboring artwork',()=>{
 const mask=cleanupMask(boutique),at=(x,y)=>mask[y*1672+x];
 for(const [x,y]of [[330,410],[365,445],[300,470],[425,495],[397,359]])assert.equal(at(x,y),1);
 for(const [x,y]of [[250,450],[500,350],[619,547],[400,750],[1000,500]])assert.equal(at(x,y),0);
});

test('the flat stage wall owns both old plaques and its former return while protecting dance tiles and fixtures',()=>{
 const mask=cleanupMask(stage),at=(x,y)=>mask[y*1672+x];
 for(const [x,y]of [[619,547],[667,562],[739,665],[755,715],[785,665]])assert.equal(at(x,y),1);
 for(const [x,y]of [[600,680],[625,700],[630,740],[500,600],[835,650],[365,445]])assert.equal(at(x,y),0);
});
