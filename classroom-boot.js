/* Establish shared-device isolation before the arcade reads any saved player. */
(function(win){
 'use strict';
 const config=win.ARCADE_ACCOUNTS_CONFIG||{},privacy=config.mode==='classroom'||config.classroom?.privacy===true||config.classroom?.enabled===true;
 const ENTRY_KEY='codaClassroomEntryV1';
 let requestedView=null,requestedGuest=false;
 try{
   const entry=new URL(win.location.href),view=entry.searchParams.get('profile');
   requestedGuest=entry.searchParams.get('guest')==='1'&&view!=='student'&&view!=='admin';
   if(view==='student'||view==='admin'){
     entry.searchParams.delete('profile');
     win.history.replaceState(win.history.state,'',entry.pathname+entry.search+entry.hash);
     requestedView=view;
   }
 }catch{/* Opening the profile from its button remains available. */}
 const incoming=win.CodaClassroom?.consumeFragment(win.location,win.history);
 let card=incoming,scope=null,error=false,gate=null,service=null,ui=null,notice='';
 try{
   scope=win.CodaClassroomStorage.create({window:win,keys:win.CodaClassroomProfileData.SCOPED_KEYS});scope.install();
   win.CodaClassroomStorageInstance=scope;
   notice=win.sessionStorage.getItem('codaClassroomNoticeV1')||'';win.sessionStorage.removeItem('codaClassroomNoticeV1');
 }catch{error=true;}
 // Explicit guest play never restores saved authentication. If profile stores
 // are present, isolate guest saves before any game module reads them.
 try{if(requestedGuest&&incoming===null){const value=scope?.getState();if(value?.blocked||value?.owned)scope.enterGuest({keepProfile:true});}}catch{error=true;}
 const initial=scope?.getState(),guestEntry=incoming===null&&(requestedGuest||initial?.isolatedGuest===true)&&!error;
 // Only a reload requested by this boot may carry an unopened title action.
 // Session storage can be copied into a new tab, so bind it to this tab ID.
 try{
   const pending=JSON.parse(win.sessionStorage.getItem(ENTRY_KEY)||'null');
   win.sessionStorage.removeItem(ENTRY_KEY);
   if(!requestedGuest&&!requestedView&&scope?.tabId&&pending?.version===1&&pending.tabId===scope.tabId&&['student','admin'].includes(pending.view))requestedView=pending.view;
 }catch{}
 let preparing=incoming!==null||initial?.mode==='owner'||initial?.blocked===true&&!guestEntry,recovering=false;
 if(preparing)win.document.documentElement.classList.add('classroom-preparing');
 const style=win.document.createElement('style');style.textContent=
   'html:is(.classroom-preparing,.classroom-protected) :is(#worldStage,#pianoroom,#musicClassroom,#rhythmFishing,#gameoverlay,#room){visibility:hidden!important}'+
   '#classroom-session-notice{position:fixed;inset:0;z-index:9500;background:#17243c;color:#f5fff8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:28px;text-align:center;font:22px/1.4 system-ui}'+
   '#classroom-session-notice[hidden]{display:none!important}#classroom-session-notice h2{font-size:clamp(26px,5vw,36px);margin:0}#classroom-session-notice p{max-width:30ch;margin:0}'+
   '.classroom-loading-spinner{width:44px;height:44px;border:5px solid #abe8d13d;border-top-color:#abe8d1;border-radius:50%;animation:classroom-loading-turn 1s linear infinite}'+
   '@keyframes classroom-loading-turn{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.classroom-loading-spinner{animation:none}}';
 win.document.head.append(style);
 function finishLoading(protect=false){
   preparing=false;recovering=protect;win.document.documentElement.classList.remove('classroom-preparing');win.document.documentElement.classList.toggle('classroom-protected',protect);
   if(gate){gate.hidden=true;gate.setAttribute('aria-busy','false');}
 }
 function hideGate(){finishLoading();}
 function showGate(text){
   preparing=true;recovering=false;win.document.documentElement.classList.add('classroom-preparing');win.document.documentElement.classList.remove('classroom-protected');
   if(!gate){gate=win.document.createElement('section');gate.id='classroom-session-notice';gate.setAttribute('role','status');gate.setAttribute('aria-live','polite');win.document.body.append(gate);}
   gate.hidden=false;gate.setAttribute('aria-busy','true');gate.replaceChildren();const spinner=win.document.createElement('span');spinner.className='classroom-loading-spinner';spinner.setAttribute('aria-hidden','true');
   const heading=win.document.createElement('h2');heading.textContent='Loading…';
   const message=win.document.createElement('p');message.textContent=text;
   gate.append(spinner,heading,message);
 }
 function start(options={}){
   if(!privacy&&!preparing)return null;
   const current=card;let entryView=requestedView,identityReloading=false;card=null;requestedView=null;
   const reloadIdentity=()=>{
     identityReloading=true;
     showGate('Getting your arcade ready.');
     if(entryView&&scope?.tabId)try{win.sessionStorage.setItem(ENTRY_KEY,JSON.stringify({version:1,tabId:scope.tabId,view:entryView}));}catch{}
     win.location.reload();
   };
   const returnToTitle=()=>{
     if(win.CodaDeveloperTestMode?.isEnabled?.())return false;
     try{
       identityReloading=true;preparing=true;
       win.document.documentElement.classList.add('classroom-preparing');
       win.location.replace(new URL('index.html',win.location.href).href);return true;
     }catch{identityReloading=false;return false;}
   };
   const settings=error?{...config,classroom:{...config.classroom,enabled:false}}:config;
   service=win.CodaClassroom.create({window:win,config:settings,storageScope:scope,
     onIdentityChange:event=>{
       options.beforeIdentityChange?.(event);
       if(event.exitToTitle&&entryView){openRecovery();return;}
       if(event.exitToTitle&&returnToTitle())return;
       if(event.reloadNeeded){reloadIdentity();return;}
       hideGate();options.onState?.(service.getState());
     },
     onLock:event=>{
       options.onLock?.(event);
       if(event.exitToTitle&&entryView){openRecovery();return;}
       if(event.exitToTitle&&returnToTitle())return;
       if(event.reloadNeeded){try{win.sessionStorage.setItem('codaClassroomNoticeV1',event.reason);}catch{}reloadIdentity();return;}
       openRecovery();
     }
   });
   win.CodaClassroomSession=service;
   ui=win.createCodaClassroomUI({...options,service});win.CodaClassroomUIInstance=ui;
   service.subscribe(value=>options.onState?.(value));
   const openEntry=()=>{ui.open(entryView||'student');entryView=null;};
   function openRecovery(){const alreadyRecovering=recovering;finishLoading(true);options.onState?.(service.getState());if(!alreadyRecovering||entryView)openEntry();}
   if(preparing)showGate(current!==null?'Opening your card…':initial?.blocked?'Another arcade tab is using this browser.':'Opening your profile…');
   Promise.resolve(current!==null?service.join(current):guestEntry?{ok:true,guest:true}:service.resume()).then(result=>{
     if(identityReloading)return;
     const value=service.getState();
     if(result.ok&&value.profile&&!value.locked&&!value.waitingTakeover){hideGate();if(entryView)openEntry();return;}
     if(!result.ok||value.locked||value.waitingTakeover||!guestEntry&&(notice&&(!requestedGuest||initial?.mode==='owner')||initial?.blocked)){openRecovery();return;}
     hideGate();if(entryView)openEntry();
   }).catch(()=>{if(!identityReloading)openRecovery();});
   return {service,ui,open:view=>ui.open(view),logOut:()=>ui.logOut?.(),canPlay:()=>{const value=service.getState();return !preparing&&!recovering&&!value.loading&&!value.locked&&!value.waitingTakeover&&(!value.profile||service.isWritable());},getState:()=>({preparing,recovering,privacy,...service.getState()})};
 }
 // A signed-in student uses the connected world, including when a cabinet
 // opens the site's older landing page in the same tab.
 if(/\/classic-arcade\.html$/.test(win.location.pathname)&&!win.location.pathname.includes('/song-machine/')&&initial?.mode==='owner'){
   win.location.replace(new URL('world-preview.html',win.location.href).href);
 }
 win.CodaClassroomBoot=Object.freeze({start,getState:()=>({preparing,recovering,privacy,storageAvailable:!error}),hideGate});
})(window);
