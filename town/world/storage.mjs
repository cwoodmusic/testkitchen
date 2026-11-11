import {parseProject,MAX_PROJECT_LENGTH} from './model.mjs?v=family-rooms-1';

const BACKUP_PREFIX='backup:',BACKUP_FORMAT='coda-town-backup-v1',META_KEY='current-meta';
export const MAX_PROJECT_BACKUPS=3;
const knownReadable=new WeakMap();
let backupSequence=0;

export function openDatabase(){return new Promise((resolve,reject)=>{const r=indexedDB.open('coda-town-builder',1);r.onupgradeneeded=()=>r.result.createObjectStore('maps');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}

function looksLikeTown(d){return d&&typeof d==='object'&&d.version===1&&typeof d.name==='string'&&d.cells&&typeof d.cells==='object'&&d.edges&&typeof d.edges==='object'&&Array.isArray(d.objects)&&d.spawn&&Number.isFinite(d.spawn.x)&&Number.isFinite(d.spawn.y);}
function readTown(text){
 if(typeof text!=='string')throw Error('Saved town uses an unrecognized format.');
 if(text.length>MAX_PROJECT_LENGTH)throw Error('Saved town exceeds 64 MiB.');
 const doc=JSON.parse(text);if(!looksLikeTown(doc))throw Error('Saved data is not a town project.');return doc;
}
function timestamp(value){return Number.isFinite(value)&&value>=0?value:null;}
function record(key,value,meta={}){
 const wrapped=key.startsWith(BACKUP_PREFIX)&&value?.format===BACKUP_FORMAT;
 const raw=wrapped?value.data:value;
 let text=typeof raw==='string'?raw:null,name='Unreadable saved town',objects=null,cells=null,readable=false,error;
 try{const doc=readTown(raw);name=doc.name;objects=doc.objects.length;cells=Object.keys(doc.cells).length;readable=true;}catch(e){error=e.message;}
 return {key,raw,text,name,objects,cells,readable,error,savedAt:timestamp(wrapped?value.savedAt:meta.savedAt),capturedAt:timestamp(wrapped?value.capturedAt:null)};
}
function collect(store,done){
 const entries=new Map(),request=store.openCursor();
 request.onsuccess=()=>{const cursor=request.result;if(cursor){entries.set(String(cursor.key),cursor.value);cursor.continue();}else done(entries);};
}
// Autosave only needs the previous current body, metadata and backup keys.
// Recovery reads full snapshots; routine edits avoid cloning every backup.
function saveInputs(store,done){
 let remaining=3,keys,current,meta;
 const finish=()=>{if(--remaining)return;const entries=new Map(keys.map(key=>[String(key),undefined]));if(entries.has('current'))entries.set('current',current);entries.set(META_KEY,meta);done(entries);};
 const keyRequest=store.getAllKeys();keyRequest.onsuccess=()=>{keys=keyRequest.result;finish();};
 const currentRequest=store.get('current');currentRequest.onsuccess=()=>{current=currentRequest.result;finish();};
 const metaRequest=store.get(META_KEY);metaRequest.onsuccess=()=>{meta=metaRequest.result;finish();};
}
function transactionError(tx){return tx.error||Error('Local town transaction aborted.');}

// Reading never repairs, deletes or replaces the current slot. In particular,
// a failed parse leaves the exact original bytes available for recovery/export.
export function getSavedProjects(db){return new Promise((resolve,reject)=>{
 const tx=db.transaction('maps','readonly');let result;
 collect(tx.objectStore('maps'),entries=>{
  const current=entries.has('current')?record('current',entries.get('current'),entries.get(META_KEY)):null;
  const backups=[...entries].filter(([key])=>key.startsWith(BACKUP_PREFIX)).map(([key,value])=>record(key,value)).sort((a,b)=>(b.capturedAt||0)-(a.capturedAt||0)||b.key.localeCompare(a.key));
  result={current,backups};
 });
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(transactionError(tx));tx.onabort=()=>reject(transactionError(tx));
});}

export async function loadProject(ids){
 const db=await openDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('maps','readonly'),r=tx.objectStore('maps').get('current');let doc=null;
  r.onsuccess=()=>{try{doc=r.result===undefined?null:parseProject(r.result,ids);}catch(e){reject(e);}};
  tx.oncomplete=()=>resolve(doc);tx.onerror=()=>reject(transactionError(tx));tx.onabort=()=>reject(transactionError(tx));
 });}finally{db.close();}
}

// The old JSON-string current slot stays compatible with previous releases.
// Its preceding value and the replacement commit in the same transaction, so
// a quota/write failure cannot discard the only recoverable copy.
export function saveProject(db,doc,{replaceUnreadable=false}={}){
 const text=JSON.stringify(doc);if(text.length>MAX_PROJECT_LENGTH)throw Error('Project exceeds 64 MiB.');
 if(!looksLikeTown(doc))throw Error('Cannot save an invalid town project.');
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('maps','readwrite'),store=tx.objectStore('maps');let failure,result;
  saveInputs(store,entries=>{
   try{
    const previous=entries.get('current'),hasPrevious=entries.has('current');
    if(previous===text){result={changed:false};return;}
    if(hasPrevious&&!replaceUnreadable&&knownReadable.get(db)!==previous){
     try{readTown(previous);}catch{throw Error('The existing saved town could not be read. Export or recover it before replacing it.');}
    }
    const now=Date.now(),backups=[...entries].filter(([key])=>key.startsWith(BACKUP_PREFIX)).map(([key])=>({key,capturedAt:Number(key.slice(BACKUP_PREFIX.length).split(':')[0])||0}));
    let backup=null;
    if(hasPrevious){
     do{backup=BACKUP_PREFIX+now+':'+String(backupSequence++).padStart(6,'0');}while(entries.has(backup));
     const meta=entries.get(META_KEY);
     store.put({format:BACKUP_FORMAT,data:previous,capturedAt:now,savedAt:timestamp(meta?.savedAt)},backup);
     backups.push({key:backup,capturedAt:now});
    }
    backups.sort((a,b)=>a.key===backup?-1:b.key===backup?1:b.capturedAt-a.capturedAt||b.key.localeCompare(a.key));
    for(const old of backups.slice(MAX_PROJECT_BACKUPS))store.delete(old.key);
    store.put(text,'current');store.put({savedAt:now},META_KEY);result={changed:true,backup,savedAt:now};
   }catch(e){failure=e;tx.abort();}
  });
  tx.oncomplete=()=>{knownReadable.set(db,text);resolve(result);};
  tx.onerror=()=>reject(failure||transactionError(tx));tx.onabort=()=>reject(failure||transactionError(tx));
 });
}

export async function restoreProject(db,key){
 const saved=await getSavedProjects(db),selected=key==='current'?saved.current:saved.backups.find(r=>r.key===key);
 if(!selected)throw Error('That saved town is no longer available.');
 if(!selected.readable)throw Error('That saved town could not be read. Export it before attempting a repair.');
 const doc=readTown(selected.text);
 await saveProject(db,doc,{replaceUnreadable:true});return doc;
}
