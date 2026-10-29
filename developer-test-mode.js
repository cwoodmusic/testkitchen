/* Disposable unlock previews. Real player stores, account bindings and editor
 * databases stay outside this page's in-memory test workspace. */
(function(root,factory){const library=factory();if(typeof module==='object'&&module.exports)module.exports=library;if(root)root.CodaDeveloperTestMode=library.create(root);})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const EXTRA_KEYS=Object.freeze(['codaWorldProjectV1','codaRoomProjectV1:piano','codaRoomProjectV1:fishing','codaArcadeAssetSceneV1','codaForegroundEditsV1','codaForegroundEditsV2','codaCollisionEditsV891','codaNPCOutfitsV1','codaArcadeCameraZoomV1','codaArcadeFXV1','codaFishingAudioV1','codaArcadeVibeV1']);
 const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 function memoryStorage(entries=[]){
  const values=new Map(entries.map(([key,value])=>[String(key),String(value)]));
  const methods={getItem:key=>values.get(String(key))??null,setItem(key,value){values.set(String(key),String(value));},removeItem(key){values.delete(String(key));},clear(){values.clear();},key(index){return Number.isInteger(Number(index))&&Number(index)>=0?[...values.keys()][Number(index)]??null:null;}};
  return new Proxy({}, {get(target,key){if(key==='length')return values.size;if(key===Symbol.toStringTag)return 'Storage';if(own(methods,key))return methods[key];if(typeof key==='symbol')return Reflect.get(target,key);if(key in Object.prototype)return Object.prototype[key];return methods.getItem(key);},set(target,key,value){if(typeof key==='symbol')return Reflect.set(target,key,value);if(key==='length')return false;methods.setItem(key,value);return true;},deleteProperty(target,key){if(typeof key==='symbol')return Reflect.deleteProperty(target,key);methods.removeItem(key);return true;},ownKeys:()=>[...values.keys()],has:(_target,key)=>key==='length'||own(methods,key)||typeof key==='string'&&values.has(key),getOwnPropertyDescriptor(_target,key){if(typeof key==='string'&&values.has(key))return {configurable:true,enumerable:true,writable:true,value:values.get(key)};return undefined;}});
 }
 function create(win){
  let requested=false;try{requested=new URL(win?.location?.href).searchParams.get('dev-test')==='1';}catch{}
  let isolated=false,seeded=false,source='blank',error='',originalName='',local=null,sessions=null,banner=null;
  const enabled=()=>requested;
  const state=()=>({enabled:requested,isolated,seeded,source,error});
  function cleanURL(test){const url=new URL(win.location.href);url.searchParams.delete('dev-test');url.searchParams.delete('profile');url.hash='';if(test)url.searchParams.set('dev-test','1');return url.href;}
  function restoreName(){if(requested)try{win.name=originalName;}catch{}}
  function enter(){if(requested)return false;try{win.location.assign(cleanURL(true));return true;}catch{return false;}}
  function exit(){if(!requested)return false;restoreName();try{win.location.replace(cleanURL(false));return true;}catch{return false;}}
  function configure(){
   const config=win.ARCADE_ACCOUNTS_CONFIG||{},next={...config,enabled:false,mode:'classroom',classroom:{...config.classroom,enabled:false,privacy:true}};
   delete next.firebase;win.ARCADE_ACCOUNTS_CONFIG=next;
  }
  function protectNetwork(){
   const doc=win.document;if(!doc?.createElement||!doc.head?.append)return;
   const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="connect-src 'self'; form-action 'none'";policy.dataset.developerTestPolicy='';doc.head.append(policy);
  }
  function cloneSource(native,nativeSession){
   const data=win.CodaClassroomProfileData,boundaryAPI=win.CodaClassroomStorage;
   if(!native||!nativeSession||!data?.SCOPED_KEYS||!boundaryAPI?.create)return [];
   const sessionCopy=memoryStorage();
   try{for(const key of [boundaryAPI.TAB_KEY,boundaryAPI.ACTIVE_KEY]){const value=nativeSession.getItem(key);if(value!==null)sessionCopy.setItem(key,value);}}catch{return [];}
   const shadow={name:originalName,crypto:win.crypto,queueMicrotask:win.queueMicrotask?.bind(win)};let boundary;
   try{
    boundary=boundaryAPI.create({window:shadow,storage:native,sessionStorage:sessionCopy,keys:data.SCOPED_KEYS});
    const initial=boundary.getState();if(initial.blocked)return [];
    const output=[],reader=initial.owned?boundary.guardedStorage():boundary.storage;
    // An unbound browser can contain stale student values. Only this tab's
    // positively owned player is copied; a guest receives a fresh demo player.
    if(initial.owned)for(const key of data.SCOPED_KEYS){const value=reader.getItem(key);if(value!==null)output.push([key,value]);}
    for(const key of EXTRA_KEYS){const value=reader.getItem(key);if(value!==null)output.push([key,value]);}
    const current=boundary.getState();if(current.blocked||initial.owned&&!current.owned)return [];
    source=initial.owned?'own-player':'guest';return output;
   }catch{return [];}finally{boundary?.destroy();}
  }
  function install(){
   try{originalName=String(win.name||'');}catch{}
   let native=null,nativeSession=null;try{native=win.localStorage;}catch{}try{nativeSession=win.sessionStorage;}catch{}
   local=memoryStorage(cloneSource(native,nativeSession));sessions=memoryStorage();
   configure();protectNetwork();
   const descriptors={};for(const key of ['localStorage','sessionStorage','indexedDB','name'])descriptors[key]=Object.getOwnPropertyDescriptor(win,key);
   // Classroom storage gives its temporary workspace a new tab name. Keep
   // that name in memory too: pagehide is too late to restore the browser's
   // underlying browsing-context name before some reloads. Otherwise exiting
   // a reloaded preview invalidates the real tab's Google-session binding.
   let previewName=originalName;
   const denied=()=>{const failure=Error('IndexedDB is unavailable in developer test mode.');failure.name='SecurityError';throw failure;};
   try{
    Object.defineProperty(win,'localStorage',{configurable:true,enumerable:descriptors.localStorage?.enumerable??true,get:()=>local});
    Object.defineProperty(win,'sessionStorage',{configurable:true,enumerable:descriptors.sessionStorage?.enumerable??true,get:()=>sessions});
    Object.defineProperty(win,'indexedDB',{configurable:true,enumerable:descriptors.indexedDB?.enumerable??true,value:Object.freeze({open:denied,deleteDatabase:denied,databases:async()=>[]})});
    Object.defineProperty(win,'name',{configurable:true,enumerable:descriptors.name?.enumerable??true,get:()=>previewName,set:value=>{previewName=String(value);}});
    isolated=true;win.addEventListener?.('pagehide',restoreName);
   }catch{
    // The caller must stop gameplay when isolation is unavailable, rather
    // than quietly run an unlock preview against the real browser stores.
    for(const [key,descriptor]of Object.entries(descriptors))try{if(descriptor)Object.defineProperty(win,key,descriptor);else delete win[key];}catch{}
    isolated=false;error='This browser could not start test mode safely. Exit test mode to keep playing.';
    // classroom-boot runs before the world can check seedUnlocks(). Stop its
    // tab/session initialization too if native stores could not be replaced.
    try{win.CodaClassroomStorage={...win.CodaClassroomStorage,create(){throw Error('Developer test storage is unavailable.');}};}catch{}
   }
  }
  function seedUnlocks(options={}){
   if(!requested)return {ok:false,enabled:false};
   if(!isolated)return {ok:false,error:error||'Test mode could not isolate browser storage.'};
   const data=options.profileData||win.CodaClassroomProfileData,catalog=options.progression||win.CodaPlayerProgression;
   if(!data?.blank||!data?.validate||!data?.KEYS||!catalog?.THRESHOLDS?.length){error='Test mode could not load its player tools.';return {ok:false,error};}
   if(seeded)return {ok:true,alreadySeeded:true};
   let nickname='Test player';if(source==='own-player')try{const avatar=JSON.parse(local.getItem(data.KEYS.avatar)||'null');if(typeof avatar?.name==='string'&&avatar.name.trim())nickname=avatar.name.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim().slice(0,40)||nickname;}catch{}
   function prepare(base){
    const next=JSON.parse(JSON.stringify(base)),events=next.progression.events,known=new Set(events.map(event=>event.id));
    const achievementIDs=new Set(['bowtie','starclip','partyglasses','halo'].map(id=>'achievement:'+id));
    for(const item of catalog.ACHIEVEMENT_REWARDS||[])achievementIDs.add('achievement:'+item.achievement);
    for(const achievement of win.CodaFishingProgress?.ACHIEVEMENTS||[])achievementIDs.add('achievement:'+achievement.id);
    for(const id of achievementIDs)if(!known.has(id)){events.push({id,xp:50});known.add(id);}
    let xp=events.reduce((sum,event)=>sum+event.xp,0),target=Math.max(...catalog.THRESHOLDS);if(!Number.isSafeInteger(target)||target<0||target>20000000)throw Error('Invalid test level range.');
    let serial=0;while(xp<target){const id='test-mode:experience:'+serial++;if(known.has(id))continue;const amount=Math.min(1000,target-xp);events.push({id,xp:amount});known.add(id);xp+=amount;}
    next.progression.xp=xp;next.progression.bestPitchLevel=Math.max(50,next.progression.bestPitchLevel||0);next.pitch.bestCompleted=Math.max(50,next.pitch.bestCompleted||0);
    const owned=data.SCHEMA?.properties?.wallet?.properties?.owned?.items?.enum||[...new Set(Object.values(data.CATALOG||{}).flat())];
    if(owned.length>256)throw Error('The test wardrobe is too large.');next.wallet={...next.wallet,balance:1000000,earned:1000000,spent:0,owned:[...new Set(owned)]};
    next.piano.learned=[...(catalog.PIANO_MEMORIES||data.SCHEMA?.properties?.piano?.properties?.learned?.items?.enum||[])];
    next.avatar.customized=true;next.avatar.jumps=Math.max(10,next.avatar.jumps||0);next.avatar.emotesUsed=Math.max(5,next.avatar.emotesUsed||0);next.avatar.walked=Math.max(450,next.avatar.walked||0);
    return data.validate(next);
   }
   try{
    const copied=data.capture(local);let result=prepare(copied.ok?copied.data:data.blank());if(!result.ok)result=prepare(data.blank());if(!result.ok)throw Error('Invalid test player.');
    for(const [slot,key]of Object.entries(data.KEYS))local.setItem(key,JSON.stringify(slot==='avatar'?{...result.data.avatar,name:nickname}:result.data[slot]));
    seeded=true;error='';return {ok:true};
   }catch{error='Your test player could not be prepared safely. Exit test mode and try again.';return {ok:false,error};}
  }
  function mountBanner(host){
   if(!requested||banner?.isConnected)return banner;
   const doc=win.document;if(!doc?.createElement)return null;
   banner=doc.createElement('aside');banner.dataset.developerTestBanner='';banner.setAttribute('role','status');banner.setAttribute('aria-label','Developer test mode');
   banner.style.cssText='position:fixed;left:50%;bottom:max(10px,env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483600;display:flex;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 24px);box-sizing:border-box;padding:8px 10px;background:#222f43e8;border:1px solid #9aebd7;border-radius:10px;color:#eafff8;font:700 12px/1.35 system-ui;pointer-events:none;box-shadow:0 3px 20px #0008';
   const words=doc.createElement('span');words.textContent=error||'TEST MODE · Unlocks preview · Real progress will not change';
   const close=doc.createElement('button');close.type='button';close.textContent='Exit test mode';close.dataset.developerTestExit='';close.style.cssText='pointer-events:auto;flex:none;min-height:44px;padding:7px 10px;background:#315d59;border:1px solid #a3eddb;border-radius:7px;color:#fff;font:700 13px system-ui;cursor:pointer';close.onclick=exit;
   banner.append(words,close);(host||doc.body||doc.documentElement)?.append(banner);return banner;
  }
  if(requested)install();
  return Object.freeze({isEnabled:enabled,seedUnlocks,enter,exit,mountBanner,getState:state});
 }
 return Object.freeze({create,memoryStorage,EXTRA_KEYS});
});
