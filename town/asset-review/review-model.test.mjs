import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetReview,ASSET_REVIEW_STORAGE_KEY as KEY} from './review-model.mjs';

const DATE='2026-11-14T06:00:00.000Z';
const catalog=new Map([['sofa',{name:'Victorian sofa',group:'furniture',w:180,h:144}],['rug',{name:'Bath rug',group:'rugs',w:72,h:48}]]);
const make=options=>createAssetReview({catalog,now:()=>new Date(DATE),...options});
function memory(entries={}){
 const data=new Map(Object.entries(entries)),writes=[];let denied=false;
 return {data,writes,getItem:key=>data.get(key)??null,setItem(key,value){if(denied)throw Error('quota');writes.push(key);data.set(key,value);},deny(value=true){denied=value;}};
}

test('each actual asset/facing keeps its own status and repair note across reloads',()=>{
 const storage=memory({'maps/current':'map','player-progress':'inventory'}),review=make({storage});
 assert.deepEqual(review.get('sofa'),{status:'unreviewed',note:''});
 review.set('sofa','west',{status:'flagged',note:'The left arm is backward.'});
 review.set('sofa','east',{status:'ok'});review.set('rug','south',{note:'Make the border less plain.'});
 const reloaded=make({storage});
 assert.deepEqual(reloaded.get('sofa','west'),{status:'flagged',note:'The left arm is backward.'});
 assert.deepEqual(reloaded.get('sofa','east'),{status:'ok',note:''});assert.equal(reloaded.get('rug').note,'Make the border less plain.');
 assert.deepEqual(reloaded.get('sofa','north'),{status:'unreviewed',note:''});
 assert.equal(storage.data.get('maps/current'),'map');assert.equal(storage.data.get('player-progress'),'inventory');assert(storage.writes.every(key=>key===KEY));
 assert.equal(reloaded.saved,true);assert.equal(reloaded.warning,'');
});

test('patches preserve the other field, clear status/note independently and remove only an empty unreviewed entry',()=>{
 const review=make({storage:memory()});review.set('sofa','south',{status:'flagged',note:'Keep this exact note.'});
 review.set('sofa','south',{status:'ok'});assert.deepEqual(review.get('sofa'),{status:'ok',note:'Keep this exact note.'});
 review.set('sofa','south',{status:'unreviewed'});assert.equal(review.entries().length,1);
 review.set('sofa','south',{note:''});assert.equal(review.entries().length,0);
 review.set('rug','south',{status:'flagged'});assert.equal(review.snapshot().reviews[0].note,'');
});

test('export identifies every marked/noted facing with catalog metadata and independent summary counts',()=>{
 const review=make({storage:memory()});review.set('sofa','west',{status:'flagged',note:'Fix arm'});review.set('sofa','east',{status:'ok'});review.set('rug','south',{note:'Needs a floral border'});
 const file=review.snapshot();assert.equal(file.format,'coda-asset-review');assert.equal(file.version,1);assert.equal(file.repository,'cwoodmusic/testkitchen');assert.equal(file.exportedAt,DATE);assert.equal(file.catalogAssetCount,2);
 assert.deepEqual(file.counts,{entries:3,reviewed:2,flagged:1,noted:2,assetsReviewed:1,assetsFlagged:1});
 assert.deepEqual(file.reviews[0],{assetId:'sofa',name:'Victorian sofa',group:'furniture',width:180,height:144,facing:'west',status:'flagged',note:'Fix arm',updatedAt:DATE});
 assert.doesNotThrow(()=>JSON.stringify(file));
});

test('failed persistence retains all text and flags in memory and export, then retries successfully',()=>{
 const storage=memory(),review=make({storage});review.set('sofa','south',{status:'ok'});storage.deny();
 const note='Every detail stays.\n'+('Gold border — ♫ <tag> & text\n'.repeat(10000));review.set('sofa','west',{status:'flagged',note});
 assert.equal(review.saved,false);assert.match(review.warning,/download/i);assert.equal(review.get('sofa','west').note,note);assert.equal(review.snapshot().reviews.find(entry=>entry.facing==='west').note,note);
 assert.deepEqual(make({storage}).get('sofa'),{status:'ok',note:''});
 storage.deny(false);review.set('sofa','west',{note});assert.equal(review.saved,true);assert.equal(review.warning,'');assert.equal(make({storage}).get('sofa','west').note,note);
});

test('blocked or absent browser storage still supports a complete downloadable review',()=>{
 for(const storage of [null,{}, {getItem(){throw Error('denied');},setItem(){throw Error('denied');}}]){
  const review=make({storage});assert.equal(review.saved,false);assert(review.warning);review.set('rug','south',{status:'flagged',note:'Fix this rug.'});
  assert.equal(review.snapshot().reviews[0].note,'Fix this rug.');assert.equal(review.snapshot().counts.flagged,1);
 }
});

test('corrupt or unsupported stored envelopes remain untouched while new repair notes stay exportable',()=>{
 for(const raw of ['{','null','[]',JSON.stringify({format:'other',version:1,reviews:[]}),JSON.stringify({format:'coda-asset-review',version:2,reviews:[]})]){
  const storage=memory({[KEY]:raw}),review=make({storage});assert.equal(review.saved,false);assert(review.warning);
  review.set('sofa','south',{note:'Keep this fresh note.'});assert.equal(review.get('sofa').note,'Keep this fresh note.');assert.equal(review.snapshot().counts.noted,1);
  assert.equal(storage.data.get(KEY),raw);assert.equal(storage.writes.length,0);
 }
});

test('saved metadata keeps removed catalog assets identifiable without touching current catalog objects',()=>{
 const original=memory(),review=make({storage:original});review.set('sofa','west',{note:'The original western picture.'});
 const removed=createAssetReview({storage:original,now:()=>DATE,catalog:[]});assert.equal(removed.get('sofa','west').note,'The original western picture.');
 assert.equal(removed.entries()[0].name,'Victorian sofa');assert.equal(removed.entries()[0].width,180);
 const raw=JSON.stringify([...catalog]);review.set('sofa','north',{status:'flagged'});assert.equal(JSON.stringify([...catalog]),raw);
 const entry=removed.entries()[0];entry.note='Changed clone';assert.equal(removed.get('sofa','west').note,'The original western picture.');
});

test('valid saved notes on either side of a malformed record remain available for recovery',()=>{
 const raw=JSON.stringify({format:'coda-asset-review',version:1,reviews:[
  {assetId:'sofa',facing:'west',status:'flagged',note:'Preserve the first note.'},
  {assetId:'constructor',facing:'east',status:'flagged',note:'Unsafe ID'},
  {assetId:'rug',facing:'south',status:'flagged',note:'Preserve the last note.'}
 ]}),storage=memory({[KEY]:raw}),review=make({storage});
 assert.equal(review.saved,false);assert(review.warning);assert.equal(review.entries().length,2);
 assert.equal(review.get('sofa','west').note,'Preserve the first note.');assert.equal(review.get('rug').note,'Preserve the last note.');
 review.set('sofa','east',{note:'A new recoverable note.'});assert.equal(review.snapshot().reviews.length,3);
 assert.equal(storage.data.get(KEY),raw);assert.equal(storage.writes.length,0);assert.equal({}.polluted,undefined);
});

test('untrusted IDs, invalid record fields and prototype keys cannot change the review model',()=>{
 const storage=memory(),review=make({storage});
 for(const id of ['__proto__','constructor','prototype','',null,'bad\u0000id'])assert.throws(()=>review.set(id,'south',{note:'bad'}),TypeError);
 assert.throws(()=>review.set('sofa','diagonal',{status:'flagged'}),RangeError);assert.throws(()=>review.set('sofa','south',{status:'done'}),RangeError);assert.throws(()=>review.set('sofa','south',{note:42}),TypeError);
 const patch=JSON.parse('{"note":"<script>not code</script>","__proto__":{"polluted":true},"name":"invented"}');review.set('sofa','south',patch);
 assert.equal({}.polluted,undefined);assert.equal(review.get('sofa').note,'<script>not code</script>');assert.equal(review.entries()[0].name,'Victorian sofa');
 assert.equal(storage.writes.length,1);assert.equal(review.snapshot().counts.noted,1);
});

test('entries and reads are fresh snapshots without storage writes or export clock churn',()=>{
 const storage=memory();let ticks=0;const review=make({storage,now:()=>{ticks++;return DATE;}});review.set('rug','south',{status:'ok'});
 const writes=storage.writes.length,time=ticks;for(let i=0;i<100;i++){const entry=review.get('rug');entry.status='flagged';review.entries()[0].note='Changed';}
 assert.equal(ticks,time);assert.equal(storage.writes.length,writes);assert.deepEqual(review.get('rug'),{status:'ok',note:''});
 review.set('rug','south',{status:'ok'});assert.equal(storage.writes.length,writes);
});
