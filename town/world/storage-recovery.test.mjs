import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank} from './model.mjs';
import {getSavedProjects,saveProject,restoreProject,MAX_PROJECT_BACKUPS} from './storage.mjs';

// A transactional fault-injection fixture: writes are staged until completion.
// Browser QA also exercises these operations against native IndexedDB.
function database(initial=[]){
 let values=new Map(initial.map(([k,v])=>[k,structuredClone(v)])),failPut=0;
 const db={
  failOnPut(n){failPut=n;},
  snapshot(){return structuredClone([...values]);},
  transaction(_name,mode){
   const staged=structuredClone(values);let pending=0,aborted=false,complete=false,puts=0;
   const tx={error:null,objectStore:()=>store,abort(){aborted=true;tx.error=Error('Aborted');setImmediate(()=>tx.onabort?.());}};
   function finish(){setImmediate(()=>{if(pending||aborted||complete)return;complete=true;if(mode==='readwrite')values=staged;tx.oncomplete?.();});}
   function request(read){
    const r={result:undefined};pending++;
    setImmediate(()=>{if(aborted)return;r.result=structuredClone(read());r.onsuccess?.();pending--;finish();});return r;
   }
   const store={
    get:key=>request(()=>staged.get(key)),getAllKeys:()=>request(()=>[...staged.keys()]),
    put(value,key){if(++puts===failPut){failPut=0;throw Error('Injected quota failure');}return request(()=>{staged.set(key,structuredClone(value));return key;});},
    delete:key=>request(()=>staged.delete(key)),
    openCursor(){
     const r={result:null},keys=[...staged.keys()].sort();let index=0;
     const next=()=>{pending++;setImmediate(()=>{if(aborted)return;const key=keys[index++];r.result=key===undefined?null:{key,value:structuredClone(staged.get(key)),continue:next};r.onsuccess?.();pending--;finish();});};
     next();return r;
    }
   };
   finish();return tx;
  }
 };
 return db;
}
const town=name=>({...blank(),name,objects:[],cells:{'1,1':{surface:'sand',level:0}}});

test('legacy current stays compatible, unchanged saves do not duplicate backups, and history is bounded',async()=>{
 const a=town('A'),db=database([['current',JSON.stringify(a)]]);
 await saveProject(db,town('B'));let saved=await getSavedProjects(db);
 assert.equal(typeof saved.current.raw,'string');assert.equal(saved.current.name,'B');assert.deepEqual(saved.backups.map(r=>r.name),['A']);assert.equal(saved.backups[0].savedAt,null);
 const unchanged=db.snapshot();assert.deepEqual(await saveProject(db,town('B')),{changed:false});assert.deepEqual(db.snapshot(),unchanged);
 for(const name of ['C','D','E'])await saveProject(db,town(name));
 saved=await getSavedProjects(db);assert.equal(saved.current.name,'E');assert.equal(saved.backups.length,MAX_PROJECT_BACKUPS);assert.deepEqual(saved.backups.map(r=>r.name),['D','C','B']);
 assert(saved.current.savedAt>0);assert(saved.backups.every(r=>r.readable&&r.capturedAt>0));
});

test('unreadable current remains byte-for-byte intact unless replacement is explicit',async()=>{
 const raw='{"version":1,"name":"unfinished save",',db=database([['current',raw]]),before=db.snapshot();
 let saved=await getSavedProjects(db);assert.equal(saved.current.text,raw);assert.equal(saved.current.raw,raw);assert.equal(saved.current.readable,false);
 await assert.rejects(saveProject(db,town('Recovered')),/existing saved town could not be read/);assert.deepEqual(db.snapshot(),before);
 await saveProject(db,town('Recovered'),{replaceUnreadable:true});saved=await getSavedProjects(db);
 assert.equal(saved.current.name,'Recovered');assert.equal(saved.backups[0].text,raw);assert.equal(saved.backups[0].readable,false);
});

test('restoring a backup retains the displaced current in the same history',async()=>{
 const db=database([['current',JSON.stringify(town('First'))]]);await saveProject(db,town('Second'));
 const first=(await getSavedProjects(db)).backups[0];assert.equal((await restoreProject(db,first.key)).name,'First');
 const saved=await getSavedProjects(db);assert.equal(saved.current.name,'First');assert(saved.backups.some(r=>r.name==='Second'));
 const before=db.snapshot();await assert.rejects(restoreProject(db,'backup:missing'),/no longer available/);assert.deepEqual(db.snapshot(),before);
});

test('a write failure rolls back the replacement and its staged backup together',async()=>{
 const db=database([['current',JSON.stringify(town('Only copy'))]]),before=db.snapshot();db.failOnPut(2);
 await assert.rejects(saveProject(db,town('Replacement')),/Injected quota failure/);assert.deepEqual(db.snapshot(),before);
 assert.equal((await getSavedProjects(db)).current.name,'Only copy');
});

test('unrecognized raw values are preserved, and invalid new projects cannot start a write',async()=>{
 const raw={unexpected:['old','format']},db=database([['current',raw]]),before=db.snapshot();
 assert.deepEqual((await getSavedProjects(db)).current.raw,raw);
 await assert.rejects(saveProject(db,town('New')),/existing saved town could not be read/);assert.deepEqual(db.snapshot(),before);
 assert.throws(()=>saveProject(db,{name:'not a town'}),/invalid town project/);assert.deepEqual(db.snapshot(),before);
 await saveProject(db,town('New'),{replaceUnreadable:true});assert.deepEqual((await getSavedProjects(db)).backups[0].raw,raw);
});
