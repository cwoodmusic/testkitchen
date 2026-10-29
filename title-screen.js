/* Guest entry stays quiet; remembered sessions receive a read-only sign-in check. */
(function(win){
 'use strict';
 const doc=win.document,$=id=>doc.getElementById(id),config=win.ARCADE_ACCOUNTS_CONFIG||{};
 const world=new URL('world-preview.html?v=freeze-104',win.location.href),guestWorld=new URL(world);guestWorld.searchParams.set('guest','1');
 const incoming=win.CodaClassroom?.consumeFragment(win.location,win.history);
 if(incoming!==null&&incoming!==undefined){world.hash=new URLSearchParams({'classroom-pass':incoming}).toString();win.location.replace(world.href);return;}
 let scope=null,storage=null;
 try{scope=win.CodaClassroomStorage.create({window:win,keys:win.CodaClassroomProfileData.SCOPED_KEYS});storage=scope.install();}catch{}
 const profile=$('titleProfile'),guest=$('titleGuest'),hint=$('titleProfileHint'),motion=$('titleMotion'),sessionStatus=$('titleSessionStatus');
 let inspection=null,inspecting=false,inspectionGeneration=0,identitySignature='',service=null,stopSession=null,authSignature='';
 function savedSession(){try{return win.CodaClassroom?.readSavedSession?.(win.sessionStorage,scope?.tabId)||{teacher:false,profile:false,kind:null};}catch{return {teacher:false,profile:false,kind:null};}}
 function profileOptions(view){const open=new URL(world);open.searchParams.set('profile',view);return open.href;}
 function setSessionStatus(state,text){if(!sessionStatus)return;sessionStatus.dataset.sessionState=state;sessionStatus.textContent=text;}
 function renderIdentity(){
   const state=scope?.getState(),owned=state?.owned===true,blocked=state?.blocked===true,enabled=config.classroom?.enabled===true,saved=savedSession(),remembered=!state?.isolatedGuest&&!blocked&&(owned||saved.teacher);
   profile.classList.toggle('is-primary',remembered||enabled);guest.classList.toggle('is-primary',!remembered&&!enabled);
   profile.classList.toggle('is-unavailable',!remembered&&!enabled);profile.removeAttribute('aria-disabled');
   $('titleTeacher').innerHTML='<span aria-hidden="true">♧</span> '+(inspection?.signedIn&&inspection.kind==='teacher'?'Teacher tools':'For teachers')+' <span aria-hidden="true">↗</span>';
   guest.querySelector('strong').textContent='Play as guest';guest.querySelector('small').textContent='Jump in and explore';guest.href=guestWorld.href;
   if(remembered){
     $('startTitle').textContent='Welcome back.';$('titleGreeting').textContent='Ready for more music?';
     const alias=inspection?.signedIn&&typeof inspection.alias==='string'?inspection.alias.trim().slice(0,40):'';
     profile.querySelector('strong').textContent=alias?'Continue as '+alias:owned?'Continue profile':'Continue to arcade';
     profile.querySelector('small').textContent=inspecting?'Checking your saved sign-in…':inspection?.signedIn?'Pick up your adventure':'Reopen your saved sign-in';profile.href=world.href;
     const view=saved.teacher?'admin':'student';
     if(inspecting){setSessionStatus('checking','Checking sign-in…');hint.textContent='Your profile will be checked before the game opens.';}
     else if(inspection?.signedIn){setSessionStatus('signed-in',alias?'Signed in as '+alias:inspection.kind==='teacher'?'Signed in · Teacher account':'Signed in · Student profile');hint.textContent='Your sign-in stays ready when you refresh this tab.';}
     else if(inspection?.ok===false){setSessionStatus('unavailable','Profile saved · Sign-in check unavailable');hint.textContent='Continue to try again. Your profile will be checked in the arcade.';}
     else{setSessionStatus('signed-out','Sign-in needed');hint.textContent='Open your profile options to sign in again.';profile.href=profileOptions(view);profile.querySelector('small').textContent='Open your profile to sign in';}
   }else{
     $('startTitle').textContent='Let’s play.';$('titleGreeting').textContent='Your adventure starts here.';
     profile.querySelector('strong').textContent='Open my profile';profile.querySelector('small').textContent='Use your picture card';profile.href=profileOptions('student');
     setSessionStatus(blocked?'blocked':'guest',blocked?'Another arcade tab is open':'Playing as guest');
     hint.textContent=blocked?'Close your other arcade tab before changing players.':enabled?'No card yet? Your teacher can help.':'Profiles are being set up. Guest play is ready.';
     if(!enabled){profile.setAttribute('aria-disabled','true');profile.querySelector('small').textContent='Cards coming soon';}
   }
 }
 function closeInspection(){stopSession?.();stopSession=null;service?.destroy?.();service=null;authSignature='';}
 async function checkIdentity(force=false){
   const state=scope?.getState(),saved=savedSession(),signature=JSON.stringify([state?.tabId,state?.owned,state?.blocked,state?.marker,saved]);
   if(!force&&signature===identitySignature){renderIdentity();return;}
   identitySignature=signature;const generation=++inspectionGeneration;closeInspection();inspection=null;
   if(state?.isolatedGuest||state?.blocked||(!state?.owned&&!saved.teacher)){inspecting=false;renderIdentity();return;}
   inspecting=true;renderIdentity();
   try{
     const currentService=win.CodaClassroom.create({window:win,config,storageScope:scope});service=currentService;
     if(typeof currentService.inspectSession!=='function')throw Error('Session inspection unavailable.');
     const result=await currentService.inspectSession();if(generation!==inspectionGeneration)return;inspection=result;
     inspecting=false;
     // Retain the result when connect() removed an expired local binding.
     const latest=scope?.getState();identitySignature=JSON.stringify([latest?.tabId,latest?.owned,latest?.blocked,latest?.marker,savedSession()]);
     const authState=()=>{const current=currentService.getState?.();return JSON.stringify([current?.admin?.signedIn,current?.admin?.authorized,current?.code]);};
     authSignature=authState();stopSession=currentService.subscribe?.(()=>{if(generation!==inspectionGeneration)return;const next=authState();if(next===authSignature)return;authSignature=next;if(!inspecting)void checkIdentity(true);});
   }catch{if(generation!==inspectionGeneration)return;inspection={ok:false,signedIn:false};inspecting=false;}
   renderIdentity();
 }
 profile.addEventListener('click',event=>{if(profile.getAttribute('aria-disabled')==='true')event.preventDefault();});
 function readMotion(){try{return storage?.getItem('arcadeAnimations')!=='off';}catch{return true;}}
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');let animate=readMotion();
 function renderMotion(){const limited=reduced?.matches===true,on=animate&&!limited;doc.body.classList.toggle('motion-off',!on);motion.hidden=false;motion.disabled=limited;motion.setAttribute('aria-pressed',String(on));motion.textContent=limited?'Motion: Reduced':'✧ Motion: '+(on?'On':'Off');}
 motion.onclick=()=>{animate=!animate;try{storage?.setItem('arcadeAnimations',animate?'on':'off');}catch{}renderMotion();};
 reduced?.addEventListener?.('change',renderMotion);
 win.addEventListener('storage',event=>{if(event.key==='arcadeAnimations'){animate=readMotion();renderMotion();}});
 scope?.subscribe(()=>{void checkIdentity();});void checkIdentity();renderMotion();
 win.addEventListener('pageshow',event=>{if(event.persisted)void checkIdentity(true);});
})(window);
