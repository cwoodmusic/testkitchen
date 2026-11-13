/* One catch collection for arcade waters and the island coast. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaFishJournal=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';const KEY='codaRhythmFishingV1',copy=v=>JSON.parse(JSON.stringify(v));
 function normalize(raw,catalog){
  const ids=new Set(catalog.map(f=>f.id)),coast=new Set(catalog.filter(f=>f.coastal).map(f=>f.id));
  if(raw==null)return {version:1,catches:[]};if(raw.version!==1||!Array.isArray(raw.catches)||raw.catches.length>5000)throw Error('The fish journal could not be read.');
  const seen=new Set(),catches=[];
  for(const c of raw.catches){if(!c||typeof c.id!=='string'||!c.id.length||c.id.length>160||!ids.has(c.fishId)||!Number.isFinite(c.size)||c.size<=0||c.size>2000||!Number.isFinite(c.at)||typeof c.rewarded!=='boolean'||!c.result||c.result.id!==c.id)throw Error('A saved catch could not be read.');if(!seen.has(c.id)){seen.add(c.id);catches.push(copy(c));}}
  const legacyCoast={};for(const [id,r]of Object.entries(raw.legacyCoast||{}))if(coast.has(id)&&Number.isSafeInteger(r?.count)&&r.count>0&&r.count<=1e6&&Number.isFinite(r.best)&&r.best>=0&&r.best<=2000)legacyCoast[id]={count:r.count,best:r.best};
  return {version:1,catches,...(Object.keys(legacyCoast).length?{legacyCoast}:{})};
 }
 function read(storage,catalog){const raw=storage?.getItem(KEY);return normalize(raw?JSON.parse(raw):null,catalog);}
 function merge(a,b,catalog){
  a=normalize(a,catalog);b=normalize(b,catalog);const byId=new Map(a.catches.map(c=>[c.id,c]));for(const c of b.catches){const old=byId.get(c.id);if(!old)byId.set(c.id,c);else if(old.fishId===c.fishId)old.rewarded=old.rewarded||c.rewarded;}
  if(byId.size>5000)throw Error('Your fish journal is full. Export your progress before adding more catches.');
  const legacyCoast={...a.legacyCoast};for(const [id,r]of Object.entries(b.legacyCoast||{})){const old=legacyCoast[id];legacyCoast[id]={count:Math.max(old?.count||0,r.count),best:Math.max(old?.best||0,r.best)};}
  return normalize({version:1,catches:[...byId.values()],legacyCoast},catalog);
 }
 function counts(journal,catalog){return Object.fromEntries(catalog.map(f=>[f.id,journal.catches.filter(c=>c.fishId===f.id).length+(journal.legacyCoast?.[f.id]?.count||0)]));}
 function arcadeStorage(storage,catalog,isGuest){
  const archive='codaTownFishingJournalV1:guest';
  const saved=()=>{const scoped=read(storage,catalog);if(!isGuest())return scoped;const text=storage.getItem(archive);return merge(scoped,text?JSON.parse(text):null,catalog);};
  return {getItem(key){return key===KEY?JSON.stringify(saved()):storage.getItem(key);},setItem(key,value){if(key!==KEY){storage.setItem(key,value);return;}const next=merge(saved(),JSON.parse(value),catalog);storage.setItem(KEY,JSON.stringify(next));if(isGuest())storage.setItem(archive,JSON.stringify(next));}};
 }
 return Object.freeze({KEY,normalize,read,merge,counts,arcadeStorage});
});
