/* A browser-only working copy. Portable composition files stay unchanged. */
(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./composition.js'):root.CodaSongComposition);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaSongDraft=api;
})(typeof window==='undefined'?null:window,function(compositions){
 'use strict';
 const KEY='codaSongMachineDraftV1';
 function create({storage,initialComposition,onStatus=()=>{}}){
  let composition=compositions.normalize(initialComposition),signature=JSON.stringify(composition),raw=null;
  let restored=false,error='',saved=false;
  try{
   raw=storage.getItem(KEY);
   if(raw!==null){
    if(raw.length>compositions.MAX_FILE_BYTES)throw Error('size');
    const draft=JSON.parse(raw);
    if(draft?.version!==1)throw Error('version');
    composition=compositions.normalize(draft.composition);signature=JSON.stringify(composition);restored=true;saved=true;
   }
  }catch{error='Your saved draft could not be opened. It stays untouched until you edit a song.';}
  function getStatus(){return {restored,saved,error};}
  function report(){onStatus(getStatus());return getStatus();}
  function save(song){
   let next;
   try{next=compositions.normalize(song);}catch{error='This song could not be saved. Export a JSON copy before leaving.';report();return false;}
   const nextSignature=JSON.stringify(next);
   if(nextSignature===signature)return !error;
   try{
    // A second editor must not silently replace work saved by another tab.
    if(storage.getItem(KEY)!==raw)throw Error('changed');
    const encoded=JSON.stringify({version:1,composition:next});
    if(encoded.length>compositions.MAX_FILE_BYTES)throw Error('size');
    storage.setItem(KEY,encoded);raw=encoded;signature=nextSignature;composition=next;saved=true;error='';report();return true;
   }catch(failure){saved=false;error=failure.message==='changed'?'This browser has a newer draft. Export this song before reopening Song Machine.':'Browser saving is unavailable. Export a JSON copy before leaving.';report();return false;}
  }
  return {get:()=>JSON.parse(JSON.stringify(composition)),getStatus,save,report};
 }
 return Object.freeze({KEY,create});
});
