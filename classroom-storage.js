/* Keep the classroom's origin-wide legacy saves owned by one browser tab.
 * This is a local data-isolation guard, not a replacement for Firebase rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomStorage=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const WORKSPACE_KEY='codaClassroomWorkspaceV1',ACTIVE_KEY='codaClassroomActiveV1',TAB_KEY='codaClassroomTabV1';
 const NAME_PREFIX='__codaClassroomTabV1:',GUEST_KEY='codaClassroomGuestTabV1';
 const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,128}$/.test(value);
 const copy=value=>value?JSON.parse(JSON.stringify(value)):null;
 function validMarker(value){return !!value&&value.version===1&&id(value.tabId)&&id(value.epoch)&&id(value.classId)&&id(value.profileId);}
 function equal(a,b){return validMarker(a)&&validMarker(b)&&a.tabId===b.tabId&&a.epoch===b.epoch&&a.classId===b.classId&&a.profileId===b.profileId;}
 function ownershipError(){const error=Error('This tab no longer owns the classroom workspace.');error.code='classroom/workspace-lost';return error;}
 function create(options={}){
  const win=options.window||(typeof window==='undefined'?null:window),native=options.storage||win?.localStorage,sessions=options.sessionStorage||win?.sessionStorage;
  if(!native||!sessions)throw Error('Classroom storage is unavailable.');
  const scopedKeys=options.keys||win?.CodaClassroomProfileData?.SCOPED_KEYS;
  if(!Array.isArray(scopedKeys)||!scopedKeys.length||scopedKeys.some(key=>typeof key!=='string'||!key))throw Error('The classroom profile storage keys are required.');
  const keys=new Set(scopedKeys),shadow=new Map(),listeners=new Set();
  let installed=false,destroyed=false,lastSignature='',pendingNotification=false,originalDescriptor=null,isolatedGuest=false,guestProfile=null;
  const randomId=()=>{
   const crypto=win?.crypto||(typeof globalThis==='undefined'?null:globalThis.crypto);
   if(crypto?.randomUUID)return crypto.randomUUID();
   if(crypto?.getRandomValues){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
   throw Error('This browser cannot create a private classroom workspace.');
  };
  const readMarker=(store,key)=>{
   try{const raw=store.getItem(key);if(raw===null)return {exists:false,marker:null};const value=JSON.parse(raw);return {exists:true,marker:validMarker(value)?value:null};}
   catch{return {exists:true,marker:null};}
  };
  // window.name belongs to the browsing context and survives its reloads. A
  // fresh window opened from an existing tab can copy sessionStorage, but does
  // not inherit this name, so it must not silently inherit that tab's ownership.
  let storedId;try{storedId=sessions.getItem(TAB_KEY);}catch{throw Error('Classroom tab storage is unavailable.');}
  const namedId=String(win?.name||'').startsWith(NAME_PREFIX)?String(win.name).slice(NAME_PREFIX.length).split(':')[0]:null;
  const tabId=id(storedId)&&namedId===storedId?storedId:randomId();
  sessions.setItem(TAB_KEY,tabId);
  if(win)try{win.name=NAME_PREFIX+tabId;}catch{/* A unique fresh tabId still prevents accidental adoption. */}
  try{
   const raw=sessions.getItem(GUEST_KEY),saved=JSON.parse(raw||'null');
   const workspace=workspaceState(),keptProfile=workspace.owned&&equal(saved?.profile,workspace.marker);
   // A malformed snapshot stays isolated; only a valid foreign tab binding
   // can be ignored. A successful profile claim takes priority over old data.
   if(raw!==null&&(!workspace.owned||keptProfile)&&(saved?.version!==1||!id(saved?.tabId)||saved.tabId===tabId))isolatedGuest=true;
   if(isolatedGuest&&keptProfile)guestProfile=copy(workspace.marker);
   if(isolatedGuest&&saved?.version===1&&saved.values&&typeof saved.values==='object'&&!Array.isArray(saved.values)&&Object.entries(saved.values).every(([key,value])=>keys.has(key)&&typeof value==='string')){
    for(const [key,value]of Object.entries(saved.values))shadow.set(key,value);
   }
  }catch{isolatedGuest=!workspaceState().owned;}
  function workspaceState(){
   const shared=readMarker(native,WORKSPACE_KEY),local=readMarker(sessions,ACTIVE_KEY),marker=shared.marker,active=local.marker,owned=!!marker&&marker.tabId===tabId&&equal(marker,active);
   const blocked=!owned&&(shared.exists||local.exists),mode=owned?'owner':blocked?'blocked':'guest';
   return {tabId,mode,owned,blocked,marker:copy(marker),active:copy(active),installed,destroyed};
  }
  function state(){const current=workspaceState();return isolatedGuest?{...current,mode:'guest',owned:false,marker:null,active:null,isolatedGuest:true}:current;}
  function persistGuest(values,profile=guestProfile){sessions.setItem(GUEST_KEY,JSON.stringify({version:1,tabId,values:Object.fromEntries(values),...(profile?{profile}: {})}));}
  function enterGuest(options={}){
   const workspace=workspaceState();
   if(destroyed||workspace.owned&&options.keepProfile!==true)throw ownershipError();
   if(!isolatedGuest){const profile=workspace.owned?workspace.marker:null;persistGuest(new Map(),profile);guestProfile=copy(profile);shadow.clear();isolatedGuest=true;notify();}
   return state();
  }
  function notify(){
   if(destroyed)return;const current=state(),signature=JSON.stringify([current.mode,current.marker,current.active,current.isolatedGuest]);
   if(signature===lastSignature)return;lastSignature=signature;
   if(pendingNotification)return;pendingNotification=true;
   const run=()=>{pendingNotification=false;if(destroyed)return;const latest=state();for(const fn of listeners)try{fn(latest);}catch{}};
   if(typeof win?.queueMicrotask==='function')win.queueMicrotask(run);else Promise.resolve().then(run);
  }
  const allowed=()=>{const current=state();notify();return !isolatedGuest&&!current.blocked;};
  function observe(key,value){if(keys.has(key)){if(value===null)shadow.delete(key);else shadow.set(key,value);}return value;}
  function getItem(input){const key=String(input);if(!keys.has(key))return native.getItem(key);return allowed()?observe(key,native.getItem(key)):shadow.get(key)??null;}
  function setItem(input,value){const key=String(input),text=String(value);if(!keys.has(key)){native.setItem(key,text);if(key===WORKSPACE_KEY)notify();return;}if(isolatedGuest)persistGuest(new Map(shadow).set(key,text));else if(allowed())native.setItem(key,text);observe(key,text);}
  function removeItem(input){const key=String(input);if(!keys.has(key)){native.removeItem(key);if(key===WORKSPACE_KEY)notify();return;}if(isolatedGuest){const next=new Map(shadow);next.delete(key);persistGuest(next);}else if(allowed())native.removeItem(key);observe(key,null);}
  function visibleKeys(){
   const current=state(),all=[],privateStores=isolatedGuest||current.blocked;
   for(let index=0;index<native.length;index++){const key=native.key(index);if(key!==null&&(!privateStores||!keys.has(key)))all.push(key);}
   if(privateStores)for(const key of shadow.keys())if(!all.includes(key))all.push(key);
   return all;
  }
  function clear(){
   const blocked=isolatedGuest||state().blocked;
   for(const key of visibleKeys()){
    // A background tab's generic clear() must not release someone else's lock.
    if(blocked&&key===WORKSPACE_KEY)continue;
    removeItem(key);
   }
   shadow.clear();notify();
  }
  function key(index){const number=Number(index);return Number.isInteger(number)&&number>=0?visibleKeys()[number]??null:null;}
  const methods={getItem,setItem,removeItem,clear,key};
  const storage=new Proxy({}, {
   get(target,name){if(name==='__codaClassroomScoped')return true;if(name==='length')return visibleKeys().length;if(name===Symbol.toStringTag)return 'Storage';if(Object.prototype.hasOwnProperty.call(methods,name))return methods[name];if(typeof name==='symbol')return Reflect.get(target,name);if(name in Object.prototype)return Object.prototype[name];return getItem(name);},
   set(target,name,value){if(typeof name==='symbol')return Reflect.set(target,name,value);if(name==='__codaClassroomScoped'||name==='length')return false;setItem(name,value);return true;},
   deleteProperty(target,name){if(typeof name==='symbol')return Reflect.deleteProperty(target,name);removeItem(name);return true;},
   has(target,name){return name==='__codaClassroomScoped'||name==='length'||Object.prototype.hasOwnProperty.call(methods,name)||typeof name==='string'&&visibleKeys().includes(name);},
   ownKeys:()=>visibleKeys(),
   getOwnPropertyDescriptor(target,name){if(typeof name==='string'&&visibleKeys().includes(name))return {configurable:true,enumerable:true,writable:true,value:getItem(name)};return undefined;}
  });
  function owns(expected){const current=state();return current.owned&&(!expected||equal(current.marker,expected));}
  function cacheOwnValues(){if(!allowed())return;for(const key of keys)observe(key,native.getItem(key));}
  function claim(profile){
   if(destroyed)throw ownershipError();if(!id(profile?.classId)||!id(profile?.profileId))throw Error('Choose a valid classroom profile.');
   cacheOwnValues();
   const previous=sessions.getItem(ACTIVE_KEY),marker={version:1,tabId,epoch:randomId(),classId:profile.classId,profileId:profile.profileId};
   sessions.setItem(ACTIVE_KEY,JSON.stringify(marker));
   try{native.setItem(WORKSPACE_KEY,JSON.stringify(marker));}
   catch(error){try{if(previous===null)sessions.removeItem(ACTIVE_KEY);else sessions.setItem(ACTIVE_KEY,previous);}catch{}throw error;}
   if(!equal(workspaceState().marker,marker))throw ownershipError();
   if(isolatedGuest){isolatedGuest=false;guestProfile=null;shadow.clear();try{sessions.removeItem(GUEST_KEY);}catch{}}
   notify();if(!owns(marker))throw ownershipError();return copy(marker);
  }
  function release(){
   if(!owns())return false;
   native.removeItem(WORKSPACE_KEY);sessions.removeItem(ACTIVE_KEY);notify();return true;
  }
  function assertOwner(marker){if(destroyed||!validMarker(marker)||!owns(marker))throw ownershipError();}
  function guardedStorage(marker=state().marker){
   const expected=copy(marker),guard={};
   for(const method of ['getItem','setItem','removeItem','clear','key'])guard[method]=(...args)=>{assertOwner(expected);return methods[method](...args);};
   Object.defineProperty(guard,'length',{get(){assertOwner(expected);return visibleKeys().length;}});
   return guard;
  }
  function onStorage(event){if(!event||event.key===WORKSPACE_KEY||event.key===null)notify();}
  function install(){
   if(installed||!win)return storage;
   originalDescriptor=Object.getOwnPropertyDescriptor(win,'localStorage');
   Object.defineProperty(win,'localStorage',{configurable:true,enumerable:originalDescriptor?.enumerable??true,get:()=>storage});
   installed=true;win.addEventListener?.('storage',onStorage);cacheOwnValues();notify();return storage;
  }
  async function withLock(fn){
   if(typeof fn!=='function')throw TypeError('A classroom workspace action is required.');
   if(win?.navigator?.locks?.request)return win.navigator.locks.request('coda-classroom-workspace-v1',{mode:'exclusive'},()=>fn());
   return fn();
  }
  function destroy(){
   if(destroyed)return;destroyed=true;listeners.clear();win?.removeEventListener?.('storage',onStorage);
   // Keeping the guard installed prevents late callbacks retaining this window
   // from falling back to another student's native storage after disposal.
  }
  notify();
  return Object.freeze({storage,nativeStorage:native,tabId,install,getState:state,owns,claim,release,guardedStorage,withLock,enterGuest,
   subscribe(fn){if(typeof fn!=='function')throw TypeError('A classroom workspace listener is required.');listeners.add(fn);fn(state());return()=>listeners.delete(fn);},destroy});
 }
 return Object.freeze({WORKSPACE_KEY,ACTIVE_KEY,TAB_KEY,create});
});
