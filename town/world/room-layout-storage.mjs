import {ROOM_LAYOUT_FORMAT,ROOM_LAYOUT_VERSION} from './room-layout-model.mjs?v=town-compact-island-1';

export const ROOM_LAYOUT_STORAGE_PREFIX='codaRoomLayoutsV1:';
export const ROOM_LAYOUTS_FORMAT='coda-room-layouts';
const MAX_BYTES=4*1024*1024,MAX_ROOMS=64;
const clone=value=>JSON.parse(JSON.stringify(value));
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validId=id=>typeof id==='string'&&/^[a-z0-9][a-z0-9:_-]{0,149}$/i.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const validOwner=owner=>typeof owner==='string'&&owner.length>0&&owner.length<=256&&!/[\u0000-\u001f]/.test(owner);
const fail=error=>({ok:false,changed:false,error});
export function roomLayoutStorageKey(owner='builder'){if(!validOwner(owner))throw Error('A valid room-layout owner is required.');return ROOM_LAYOUT_STORAGE_PREFIX+owner;}
export function validateRoomLayoutRecord(themeId,record){
 if(!validId(themeId)||!plain(record)||record.format!==ROOM_LAYOUT_FORMAT||record.version!==ROOM_LAYOUT_VERSION||record.themeId!==themeId||typeof record.baseSignature!=='string'||record.baseSignature.length>100||!Array.isArray(record.placements)||!Array.isArray(record.removed)||!Array.isArray(record.added))return fail('The file contains an unsupported room layout.');
 if(record.placements.length+record.added.length>600||record.removed.length>600)return fail('A room contains too many furniture pieces.');
 if(record.placements.some(p=>!plain(p)||!validId(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.y)||![0,90,180,270].includes(p.rotation??0))||record.removed.some(id=>!validId(id))||record.added.some(p=>!plain(p)||!validId(p.id)||typeof p.asset!=='string'||p.asset.length>160||!Number.isFinite(p.x)||!Number.isFinite(p.y)||![0,90,180,270].includes(p.rotation??0)))return fail('A furniture placement is invalid.');
 if(record.rugs!==undefined){
  if(!Array.isArray(record.rugs)||record.rugs.length>600)return fail('The room contains an invalid rug layout.');
  const ids=new Set();for(const rug of record.rugs){if(!plain(rug)||!validId(rug.id)||ids.has(rug.id)||rug.removed!==undefined&&typeof rug.removed!=='boolean'||!rug.removed&&(!Number.isFinite(rug.x)||!Number.isFinite(rug.y)||![0,90,180,270].includes(rug.rotation??0)))return fail('A rug placement is invalid.');ids.add(rug.id);}
 }
 return {ok:true,changed:false};
}

/** Local design templates are separate from purchases, player rooms and maps. */
export function createRoomLayoutStorage({storage,owner='builder',eventTarget=globalThis}={}){
 const key=roomLayoutStorageKey(owner);if(storage===undefined)try{storage=globalThis.localStorage;}catch{}
 let lastRaw,cache;
 const empty=()=>({format:ROOM_LAYOUTS_FORMAT,version:1,owner,rooms:{}});
 function parse(raw){
  if(typeof raw!=='string'||raw.length>MAX_BYTES)throw Error('The room-layout file is too large.');let value;try{value=JSON.parse(raw);}catch{throw Error('The room-layout file is not valid JSON.');}
  if(!plain(value)||value.format!==ROOM_LAYOUTS_FORMAT||value.version!==1||!plain(value.rooms)||Object.keys(value.rooms).length>MAX_ROOMS)throw Error('Choose a supported room-layout export.');
  const rooms={};for(const [themeId,record]of Object.entries(value.rooms)){const result=validateRoomLayoutRecord(themeId,record);if(!result.ok)throw Error(result.error);Object.defineProperty(rooms,themeId,{value:clone(record),enumerable:true,writable:true,configurable:true});}
  if(value.recoveryBackup!==undefined&&(typeof value.recoveryBackup!=='string'||value.recoveryBackup.length>MAX_BYTES))throw Error('The recovery backup is invalid.');
  return {format:ROOM_LAYOUTS_FORMAT,version:1,owner,rooms,...(typeof value.recoveryBackup==='string'?{recoveryBackup:value.recoveryBackup}:{})};
 }
 function read(){
  let raw;try{raw=storage?.getItem(key)??null;}catch{return fail('Browser saving is unavailable. Your room designs have not changed.');}
  if(raw===lastRaw&&cache)return {ok:true,pack:cache,raw};
  if(raw===null){cache=empty();lastRaw=raw;return {ok:true,pack:cache,raw};}
  try{cache=parse(raw);lastRaw=raw;return {ok:true,pack:cache,raw};}catch(error){return fail(error.message+' Stored room designs have not changed.');}
 }
 function notify(themeIds){
  if(typeof eventTarget?.dispatchEvent!=='function')return;
  try{const detail={owner,themeIds:[...themeIds],key};let event;if(typeof globalThis.CustomEvent==='function')event=new CustomEvent('coda-room-layout-change',{detail});else if(typeof globalThis.Event==='function'){event=new Event('coda-room-layout-change');Object.defineProperty(event,'detail',{value:detail});}if(event)eventTarget.dispatchEvent(event);}catch{}
 }
 function write(pack,themeIds){
  const raw=JSON.stringify(pack);if(raw.length>MAX_BYTES)return fail('These room layouts are too large to save. Remove some furniture first.');
  try{if(typeof storage?.setItem!=='function')throw Error('unavailable');storage.setItem(key,raw);}catch{return fail('Browser saving is unavailable. The previous room designs are unchanged.');}
  lastRaw=raw;cache=clone(pack);notify(themeIds);return {ok:true,changed:true,themeIds:[...themeIds]};
 }
 function load(themeId){if(!validId(themeId))return fail('Choose a valid room theme.');const state=read();return state.ok?{ok:true,record:state.pack.rooms[themeId]?clone(state.pack.rooms[themeId]):null}:state;}
 function save(themeId,record){const result=validateRoomLayoutRecord(themeId,record);if(!result.ok)return result;const state=read();if(!state.ok)return state;const pack=clone(state.pack);pack.rooms[themeId]=clone(record);return write(pack,[themeId]);}
 function remove(themeId){if(!validId(themeId))return fail('Choose a valid room theme.');const state=read();if(!state.ok)return state;if(!Object.prototype.hasOwnProperty.call(state.pack.rooms,themeId))return {ok:true,changed:false};const pack=clone(state.pack);delete pack.rooms[themeId];return write(pack,[themeId]);}
 function exportJSON(){const state=read();if(!state.ok)throw Error(state.error);return JSON.stringify(state.pack,null,2);}
 function exportRawJSON(){try{return storage?.getItem(key)??JSON.stringify(empty(),null,2);}catch{throw Error('The stored room designs cannot be read for backup.');}}
 function importJSON(raw,{validateRecord}={}){
  let pack;try{pack=parse(raw);}catch(error){return fail(error.message);}
  if(validateRecord!==undefined&&typeof validateRecord!=='function')return fail('A room-layout validator is required.');
  if(validateRecord)for(const [themeId,record]of Object.entries(pack.rooms)){try{const result=validateRecord(themeId,clone(record));if(result===false||result?.ok===false)return fail(result?.error||'A room layout cannot be placed in its selected theme.');}catch(error){return fail(error.message||'A room layout cannot be opened.');}}
  const current=read();if(!current.ok){let storedRaw;try{storedRaw=storage?.getItem(key);}catch{return current;}if(typeof storedRaw!=='string'||pack.recoveryBackup!==storedRaw)return fail('The existing room data cannot be read. Import its matching recovery file to repair it safely.');if(typeof validateRecord!=='function')return fail('Every recovered room must be checked against its theme before repair.');return write(pack,Object.keys(pack.rooms));}
  const merged=clone(current.pack);for(const [themeId,record]of Object.entries(pack.rooms))merged.rooms[themeId]=record;
  if(pack.recoveryBackup!==undefined)merged.recoveryBackup=pack.recoveryBackup;
  return write(merged,Object.keys(pack.rooms));
 }
 return {key,owner,load,save,remove,exportJSON,exportRawJSON,importJSON,get raw(){try{return storage?.getItem(key)??null;}catch{return null;}}};
}
