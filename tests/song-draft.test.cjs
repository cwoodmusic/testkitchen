'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const drafts=require('../song-machine/draft-storage.js');
const profiles=require('../classroom-profile-data.js');
const song=()=>({bpm:110,meter:'4/4',bars:4,root:0,scale:'major',tracks:[{id:1,name:'Melody',sound:17,clef:'treble',volume:.7,mute:false,notes:[{p:72,t:0,d:4},{p:36,t:240,d:8}]}],drums:[0,1,2].map(()=>({sound:0,volume:.5,mute:false,notes:[]}))});
function storage(initial={}){const map=new Map(Object.entries(initial)),writes=[];return {getItem:key=>map.get(key)??null,setItem(key,value){writes.push([key,value]);map.set(key,value);},removeItem:key=>map.delete(key),writes,map};}

test('first load and view-only renders leave browser draft bytes untouched',()=>{
 const store=storage(),draft=drafts.create({storage:store,initialComposition:song()});
 assert.deepEqual(draft.get(),song());assert.equal(draft.getStatus().restored,false);
 for(let i=0;i<3;i++)assert.equal(draft.save(song()),true);
 assert.equal(store.writes.length,0);assert.equal(store.getItem(drafts.KEY),null);
 const changed=song();changed.bpm=137;assert.equal(draft.save(changed),true);
 assert.equal(store.writes.length,1);assert.equal(draft.save(changed),true);assert.equal(store.writes.length,1);
 assert.deepEqual(JSON.parse(store.getItem(drafts.KEY)),{version:1,composition:changed});
 const restored=drafts.create({storage:store,initialComposition:song()});assert.equal(restored.getStatus().restored,true);assert.deepEqual(restored.get(),changed);
 const copy=restored.get();copy.tracks[0].notes=[];assert.deepEqual(restored.get(),changed);
});

test('corrupt, future and oversized drafts remain untouched until a real edit',()=>{
 for(const raw of ['{broken',JSON.stringify({version:2,composition:song()}),JSON.stringify({version:1,composition:{...song(),tracks:[] ,drums:[]}}),'x'.repeat(2*1024*1024+1)]){
  const store=storage({[drafts.KEY]:raw}),draft=drafts.create({storage:store,initialComposition:song()});
  assert.equal(draft.getStatus().restored,false);assert.match(draft.getStatus().error,/could not be opened/);
  assert.deepEqual(draft.get(),song());assert.equal(draft.save(song()),false);assert.equal(store.getItem(drafts.KEY),raw);assert.equal(store.writes.length,0);
  const edit=song();edit.bpm=91;assert.equal(draft.save(edit),true);assert.equal(draft.getStatus().error,'');assert.deepEqual(JSON.parse(store.getItem(drafts.KEY)).composition,edit);
 }
});

test('quota and denied storage preserve last draft and leave recoverable visible status',()=>{
 const store=storage(),draft=drafts.create({storage:store,initialComposition:song()}),edit=song();edit.bpm=99;draft.save(edit);
 const prior=store.getItem(drafts.KEY);store.setItem=()=>{throw new Error('QuotaExceededError');};
 const later=song();later.bpm=70;assert.equal(draft.save(later),false);assert.equal(store.getItem(drafts.KEY),prior);assert.match(draft.getStatus().error,/Export a JSON copy/);assert.deepEqual(draft.get(),edit);
 for(const denied of [undefined,{getItem(){throw new Error('SecurityError');}}]){
  const blocked=drafts.create({storage:denied,initialComposition:song()});assert.deepEqual(blocked.get(),song());assert.equal(blocked.save(later),false);assert.match(blocked.getStatus().error,/saving is unavailable/);
 }
});

test('two tabs cannot silently replace each other or a cleared classroom profile',()=>{
 const store=storage(),first=drafts.create({storage:store,initialComposition:song()}),second=drafts.create({storage:store,initialComposition:song()});
 const one=song();one.bpm=120;assert.equal(first.save(one),true);const bytes=store.getItem(drafts.KEY);
 const two=song();two.bpm=72;assert.equal(second.save(two),false);assert.equal(store.getItem(drafts.KEY),bytes);assert.match(second.getStatus().error,/newer draft/);
 store.removeItem(drafts.KEY);one.bpm=150;assert.equal(first.save(one),false);assert.equal(store.getItem(drafts.KEY),null,'An old tab must not rewrite the prior student’s draft after profile clearing');
});

test('invalid save cannot replace a working draft; portable normalization strips metadata',()=>{
 const store=storage(),draft=drafts.create({storage:store,initialComposition:song()}),edit=song();edit.bpm=100;edit.studentEmail='do not keep';edit.masterVolume=15;
 assert.equal(draft.save(edit),true);const raw=store.getItem(drafts.KEY);assert.equal(raw.includes('studentEmail'),false);assert.equal(raw.includes('masterVolume'),false);
 assert.equal(draft.save({...song(),bpm:-1}),false);assert.equal(store.getItem(drafts.KEY),raw);assert.match(draft.getStatus().error,/could not be saved/);
});

test('profile switching clears drafts without uploading compositions, rollback preserves local work',()=>{
 const store=storage(),draft=drafts.create({storage:store,initialComposition:song()}),edit=song();edit.bpm=133;draft.save(edit);
 assert.ok(profiles.LOCAL_ONLY_KEYS.includes(drafts.KEY));assert.ok(!Object.values(profiles.KEYS).includes(drafts.KEY));
 const capture=profiles.capture(store);assert.equal(capture.ok,true);assert.equal(JSON.stringify(capture.data).includes('composition'),false);
 const backup=profiles.backup(store),bytes=store.getItem(drafts.KEY);
 assert.equal(profiles.apply(store,profiles.blank()).ok,true);assert.equal(store.getItem(drafts.KEY),null);
 assert.equal(profiles.restore(store,backup).ok,true);assert.equal(store.getItem(drafts.KEY),bytes);
 assert.equal(profiles.clear(store).ok,true);assert.equal(store.getItem(drafts.KEY),null);
});
