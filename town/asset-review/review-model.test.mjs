import test from 'node:test';
import assert from 'node:assert/strict';
import {createAssetReview,ASSET_REVIEW_STORAGE_KEY as KEY,ASSET_REVIEW_ISSUES} from './review-model.mjs';

const DATE='2026-11-14T06:00:00.000Z';
const catalog=new Map([['sofa',{name:'Victorian sofa',group:'furniture',w:180,h:144}],['rug',{name:'Bath rug',group:'rugs',w:72,h:48}]]);
const make=options=>createAssetReview({catalog,now:()=>new Date(DATE),...options});
function memory(entries={}){
 const data=new Map(Object.entries(entries)),writes=[];let denied=false;
 return {data,writes,getItem:key=>data.get(key)??null,setItem(key,value){if(denied)throw Error('quota');writes.push(key);data.set(key,value);},deny(value=true){denied=value;}};
}

test('each actual asset/facing keeps its own status and repair note across reloads',()=>{
 const storage=memory({'maps/current':'map','player-progress':'inventory'}),review=make({storage});
 assert.deepEqual(review.get('sofa'),{status:'unreviewed',note:'',issues:[]});
 review.set('sofa','west',{status:'flagged',note:'The left arm is backward.',issues:[]});
 review.set('sofa','east',{status:'ok'});review.set('rug','south',{note:'Make the border less plain.'});
 const reloaded=make({storage});
 assert.deepEqual(reloaded.get('sofa','west'),{status:'flagged',note:'The left arm is backward.',issues:[]});
 assert.deepEqual(reloaded.get('sofa','east'),{status:'ok',note:'',issues:[]});assert.equal(reloaded.get('rug').note,'Make the border less plain.');
 assert.deepEqual(reloaded.get('sofa','north'),{status:'unreviewed',note:'',issues:[]});
 assert.equal(storage.data.get('maps/current'),'map');assert.equal(storage.data.get('player-progress'),'inventory');assert(storage.writes.every(key=>key===KEY));
 assert.equal(reloaded.saved,true);assert.equal(reloaded.warning,'');
});

test('patches preserve the other field, clear status/note independently and remove only an empty unreviewed entry',()=>{
 const review=make({storage:memory()});review.set('sofa','south',{status:'flagged',note:'Keep this exact note.'});
 review.set('sofa','south',{status:'ok'});assert.deepEqual(review.get('sofa'),{status:'ok',note:'Keep this exact note.',issues:[]});
 review.set('sofa','south',{status:'unreviewed'});assert.equal(review.entries().length,1);
 review.set('sofa','south',{note:''});assert.equal(review.entries().length,0);
 review.set('rug','south',{status:'flagged'});assert.equal(review.snapshot().reviews[0].note,'');
});

test('export identifies every marked/noted facing with catalog metadata and independent summary counts',()=>{
 const review=make({storage:memory()});review.set('sofa','west',{status:'flagged',note:'Fix arm'});review.set('sofa','east',{status:'ok'});review.set('rug','south',{note:'Needs a floral border'});
 const file=review.snapshot();assert.equal(file.format,'coda-asset-review');assert.equal(file.version,1);assert.equal(file.repository,'cwoodmusic/testkitchen');assert.equal(file.exportedAt,DATE);assert.equal(file.catalogAssetCount,2);
 assert.deepEqual(file.counts,{entries:3,reviewed:2,flagged:1,noted:2,assetsReviewed:1,assetsFlagged:1});
 assert.deepEqual(file.reviews[0],{assetId:'sofa',name:'Victorian sofa',group:'furniture',width:180,height:144,facing:'west',status:'flagged',baseStatus:'flagged',note:'Fix arm',issues:[],updatedAt:DATE});
 assert.doesNotThrow(()=>JSON.stringify(file));
});

test('failed persistence retains all text and flags in memory and export, then retries successfully',()=>{
 const storage=memory(),review=make({storage});review.set('sofa','south',{status:'ok'});storage.deny();
 const note='Every detail stays.\n'+('Gold border — ♫ <tag> & text\n'.repeat(10000));review.set('sofa','west',{status:'flagged',note});
 assert.equal(review.saved,false);assert.match(review.warning,/download/i);assert.equal(review.get('sofa','west').note,note);assert.equal(review.snapshot().reviews.find(entry=>entry.facing==='west').note,note);
 assert.deepEqual(make({storage}).get('sofa'),{status:'ok',note:'',issues:[]});
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
 assert.equal(ticks,time);assert.equal(storage.writes.length,writes);assert.deepEqual(review.get('rug'),{status:'ok',note:'',issues:[]});
 review.set('rug','south',{status:'ok'});assert.equal(storage.writes.length,writes);
});

test('known issues deduplicate in stable order and every returned array is independent',()=>{
 const review=make({storage:memory()}),input=['delete','perspective','delete','cut-off'];
 const result=review.set('sofa','west',{issues:input});assert.deepEqual(result,{status:'flagged',note:'',issues:['perspective','cut-off','delete']});
 input.push('angled');result.issues.pop();review.get('sofa','west').issues.push('angled');review.entries()[0].issues.length=0;review.snapshot().reviews[0].issues.length=0;
 assert.deepEqual(review.get('sofa','west').issues,['perspective','cut-off','delete']);
 assert.deepEqual(ASSET_REVIEW_ISSUES.map(issue=>issue.id),['perspective','cut-off','angled','delete']);assert(Object.isFrozen(ASSET_REVIEW_ISSUES));assert(ASSET_REVIEW_ISSUES.every(Object.isFrozen));
});

test('issue-only flags restore the previous review decision when their last checkbox is cleared',()=>{
 const storage=memory(),review=make({storage});
 review.set('sofa','west',{issues:['perspective']});assert.equal(review.get('sofa','west').status,'flagged');
 review.set('sofa','west',{note:'Keep this text while changing checkboxes.'});
 review.set('sofa','west',{issues:[]});assert.deepEqual(review.get('sofa','west'),{status:'unreviewed',note:'Keep this text while changing checkboxes.',issues:[]});
 review.set('sofa','east',{status:'ok'});review.set('sofa','east',{issues:['angled','cut-off']});
 assert.equal(review.get('sofa','east').status,'flagged');const reloaded=make({storage});
 reloaded.set('sofa','east',{issues:['angled']});assert.equal(reloaded.get('sofa','east').status,'flagged');
 reloaded.set('sofa','east',{issues:[]});assert.deepEqual(reloaded.get('sofa','east'),{status:'ok',note:'',issues:[]});
});

test('manual flags remain deliberate while marking OK or unreviewed clears all checkboxes without losing notes',()=>{
 const storage=memory(),review=make({storage});review.set('rug','south',{issues:['delete'],note:'Keep the reason.'});
 review.set('rug','south',{status:'flagged'});const reloaded=make({storage});reloaded.set('rug','south',{issues:[]});assert.equal(reloaded.get('rug').status,'flagged');
 reloaded.set('rug','south',{issues:['angled','delete']});reloaded.set('rug','south',{status:'ok'});
 assert.deepEqual(reloaded.get('rug'),{status:'ok',note:'Keep the reason.',issues:[]});
 reloaded.set('rug','south',{issues:['cut-off']});reloaded.set('rug','south',{status:'unreviewed'});
 assert.deepEqual(reloaded.get('rug'),{status:'unreviewed',note:'Keep the reason.',issues:[]});
});

test('issue flags persist separately for each facing and export a deletion request without changing assets',()=>{
 const before=JSON.stringify([...catalog]),storage=memory(),review=make({storage});
 review.set('sofa','west',{issues:['perspective','cut-off'],note:'Match the right view.'});review.set('sofa','east',{issues:['angled']});review.set('rug','south',{issues:['delete']});
 const reloaded=make({storage}),file=reloaded.snapshot();assert.equal(file.version,1);assert.equal(file.counts.flagged,3);assert.equal(file.counts.assetsFlagged,2);
 assert.deepEqual(reloaded.get('sofa','west').issues,['perspective','cut-off']);assert.deepEqual(reloaded.get('sofa','east').issues,['angled']);assert.deepEqual(reloaded.get('sofa','north').issues,[]);
 const request=file.reviews.find(entry=>entry.assetId==='rug');assert.deepEqual(request.issues,['delete']);assert.equal(request.status,'flagged');assert.equal(file.issueLabels.delete,'Mark for deletion');
 assert.equal(catalog.has('rug'),true);assert.equal(JSON.stringify([...catalog]),before);assert.equal(storage.writes.every(key=>key===KEY),true);
});

test('version-one review files without issue fields preserve their original flags, OKs and notes',()=>{
 const raw=JSON.stringify({format:'coda-asset-review',version:1,reviews:[
  {assetId:'sofa',facing:'west',status:'flagged',note:'An earlier hand-written repair.'},
  {assetId:'sofa',facing:'east',status:'ok',note:'Correct as drawn.'}
 ]}),storage=memory({[KEY]:raw}),review=make({storage});
 assert.equal(review.saved,true);assert.equal(review.warning,'');assert.equal(storage.writes.length,0);
 assert.deepEqual(review.get('sofa','west'),{status:'flagged',note:'An earlier hand-written repair.',issues:[]});
 review.set('sofa','west',{issues:['perspective']});review.set('sofa','west',{issues:[]});assert.equal(review.get('sofa','west').status,'flagged');
 assert.deepEqual(make({storage}).get('sofa','east'),{status:'ok',note:'Correct as drawn.',issues:[]});
});

test('unknown or malformed issue patches fail atomically without changing earlier repairs',()=>{
 const storage=memory(),review=make({storage});review.set('sofa','west',{issues:['angled'],note:'Keep this note.'});const before=review.entries(),writes=storage.writes.length;
 for(const issues of [null,'angled',{},['unknown'],['delete','__proto__'],[42]])assert.throws(()=>review.set('sofa','west',{issues,note:'Must not replace the original'}));
 assert.deepEqual(review.entries(),before);assert.equal(storage.writes.length,writes);assert.equal({}.polluted,undefined);
});

test('malformed saved issues preserve readable notes and protect original bytes for recovery',()=>{
 for(const issues of [null,'delete',['future-issue'],['angled','future-issue']]){
  const raw=JSON.stringify({format:'coda-asset-review',version:1,reviews:[{assetId:'rug',facing:'south',status:'flagged',note:'Keep this existing repair.',issues}]}),storage=memory({[KEY]:raw}),review=make({storage});
  assert.equal(review.saved,false);assert(review.warning);assert.equal(review.get('rug').note,'Keep this existing repair.');
  assert(review.get('rug').issues.every(issue=>ASSET_REVIEW_ISSUES.some(known=>known.id===issue)));
  review.set('sofa','west',{issues:['delete']});assert.equal(review.snapshot().reviews.length,2);assert.equal(storage.data.get(KEY),raw);assert.equal(storage.writes.length,0);
 }
});

test('failed browser saves retain issue arrays in the downloadable review and retry the entire state',()=>{
 const storage=memory(),review=make({storage});storage.deny();review.set('rug','south',{issues:['delete'],note:'Remove only after review.'});
 assert.equal(review.saved,false);assert.deepEqual(review.snapshot().reviews[0].issues,['delete']);
 storage.deny(false);review.set('rug','south',{issues:['delete']});assert.equal(review.saved,true);
 assert.deepEqual(make({storage}).get('rug'),{status:'flagged',note:'Remove only after review.',issues:['delete']});
});
