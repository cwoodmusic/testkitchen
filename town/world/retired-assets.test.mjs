import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RETIRED_ASSET_IDS,isRetiredAsset} from './retired-assets.mjs';
import {blank,parseProject} from './model.mjs';

test('only the exact deletion marks are retired, including the unmarked pavilion exception',()=>{
 const upload=JSON.parse(readFileSync(new URL('../asset-reviews/2026-11-14-upload-3.json',import.meta.url),'utf8'));
 const requested=[...new Set(upload.reviews.filter(entry=>entry.issues?.includes('delete')).map(entry=>entry.assetId))];
 assert.equal(requested.length,48);
 assert.deepEqual([...RETIRED_ASSET_IDS].sort(),requested.sort());
 for(const id of requested){assert(isRetiredAsset(id));assert(isRetiredAsset({id}));}
 assert(!isRetiredAsset('house-pavilion-1'));
 assert(!isRetiredAsset('sydney-opera-house'));
});

test('selection retirement retains the providers and exact saved/imported placements',()=>{
 const catalog=new Map(RETIRED_ASSET_IDS.map(id=>[id,Object.freeze({id,w:384,h:256,draw(){},boxes:Object.freeze([])})]));
 catalog.set('house-pavilion-1',Object.freeze({id:'house-pavilion-1',w:384,h:256,draw(){},boxes:Object.freeze([])}));
 const before=[...catalog],offered=before.filter(([,asset])=>!isRetiredAsset(asset));
 assert.deepEqual(offered.map(([id])=>id),['house-pavilion-1']);
 const doc=blank();doc.objects=RETIRED_ASSET_IDS.map((asset,i)=>({id:'saved-'+i,asset,x:4096+i*64,y:4096,scale:1,rotation:0,layer:'objects',collision:true}));
 assert.deepEqual(parseProject(JSON.stringify(doc),new Set(catalog.keys())),doc);
 for(const[id,asset]of before){assert.strictEqual(catalog.get(id),asset);assert.equal(typeof asset.draw,'function');}
});
