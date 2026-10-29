/* Private classroom Profile Passes: generated pictures, local QR cards, admin recovery. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.CodaClassroomUI=api;root.createCodaClassroomUI=api.create;}})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const ERRORS=Object.freeze({
  'not-configured':'Class passes are not ready here yet. You can still play on this device.',
  'classroom-disabled':'Your teacher is finishing classroom setup. You can keep playing on this device.',
  'setup-required':'Your teacher is finishing classroom setup. You can keep playing on this device.',
  'invalid-pass':'That pass did not work. Ask your teacher for a new card.',
  'pass-revoked':'That card has been replaced. Ask your teacher for the new card.',
  'profile-not-found':'That profile is no longer available. Ask your teacher for help.',
  'permission-denied':'This Google account cannot manage classes. Ask your school administrator.',
  'admin-required':'This Google account cannot manage classes. Ask your school administrator.',
  'admin-not-approved':'This Google account is not approved as a school administrator. Use your approved teacher account, or ask your school administrator to approve the setup ID above.',
  'unauthenticated':'Please sign in again to manage your classes.',
  'unavailable':'We could not connect. Check your connection and try again.',
  'network-request-failed':'We could not connect. Check your connection and try again.',
  'offline':'You are offline. Reconnect, then try again.',
  'too-many-requests':'Please wait a moment, then try again.',
  'resource-exhausted':'Please wait a moment, then try again.',
  'popup-closed-by-user':'Sign-in was closed. You can try again when you are ready.',
  'popup-blocked':'Your browser blocked sign-in. Allow the sign-in window, then try again.',
  'unsaved-progress':'Some progress has not saved yet. Stay here and save before leaving.',
  'logout-unavailable':'Log out could not finish. Keep this tab open and try Log out again.',
  'newer-progress':'Your profile has a newer save. The changes on this device are being kept safe.',
  'unsaved-conflict':'Your profile has a newer save. Unsaved changes on this device are being kept safe.',
  'lease-lost':'This profile has moved to another device. Use your card to play here again.',
  'session-revoked':'This card has been replaced. Ask your teacher for the new card.',
  'qr-unavailable':'The card picture could not load. You can still copy the pass link.',
  'class-full':'This class has 200 profiles. Create another class to add more.',
  'personal-player-unavailable':'This Google account has no saved player yet. Save your player from the device with your latest progress first.',
  'personal-player-exists':'This Google account already has a saved player. Choose Open my player to continue.',
  'personal-player-student-active':'Leave the student profile before saving your own player.',
  'personal-save-failed':'Your player could not save. Check your connection and try again on this device.',
  'personal-open-failed':'Your player could not open. Check your connection and try again.',
  'invalid-nickname':'Choose an arcade nickname with 1–40 characters on one line.',
  'personal-rename-failed':'Your nickname could not save. Your previous nickname is still in use. Check your connection and try again.'
 });
 const errorCode=value=>typeof value?.code==='string'?value.code.replace(/^(?:auth|functions)\//,''):typeof value==='string'?value:'';
 const friendlyError=value=>ERRORS[errorCode(value)]||'We could not finish that. Please try again.';
 const text=(value,fallback='')=>typeof value==='string'?value:fallback;
 const list=(result,key)=>Array.isArray(result)?result:Array.isArray(result?.[key])?result[key]:[];
 const PAGE_SIZE=20,aliasOrder=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
 const searchText=value=>text(value).trim().replace(/\s+/g,' ').toLowerCase();
 const PICTURES=['fox','owl','fish','cat','robot','star','planet','leaf'];
 const ART={
  fox:'<path d="M11 13L23 22H41L53 13V39L42 52H22L11 39Z" fill="#ed9c54"/><path d="M12 29L31 39L52 29L42 50H22Z" fill="#fff0ce"/><path d="M14 16L22 24H14ZM50 16L42 24H50Z" fill="#773c53"/><path d="M21 29H25V34H21ZM39 29H43V34H39ZM29 39H35V44H29Z" fill="#28233c"/>',
  owl:'<path d="M12 16L23 21H41L52 16V43L43 53H21L12 43Z" fill="#ac83ce"/><circle cx="23" cy="33" r="10" fill="#fff1c8"/><circle cx="41" cy="33" r="10" fill="#fff1c8"/><path d="M21 29H25V36H21ZM39 29H43V36H39ZM29 38H35L32 45Z" fill="#302444"/>',
  fish:'<path d="M13 31L5 22V43L14 35C23 55 49 49 58 32C49 15 23 11 13 31Z" fill="#5fd5d0"/><path d="M26 20L35 11L42 23ZM27 44L36 53L42 42Z" fill="#a88ce4"/><path d="M44 26H49V32H44Z" fill="#20334b"/><path d="M24 27V37M30 24V40" stroke="#d5ffed" stroke-width="3"/>',
  cat:'<path d="M13 12L25 22H39L51 12V43L42 51H22L13 43Z" fill="#a892dc"/><path d="M18 21L23 26H18ZM46 21L41 26H46Z" fill="#efbedf"/><path d="M21 30H26V35H21ZM38 30H43V35H38ZM29 38H35L32 43Z" fill="#302746"/><path d="M6 38H24M40 38H58M8 44H23M41 44H56" stroke="#fff0d6" stroke-width="2"/>',
  robot:'<path d="M29 9H35V20H29Z" fill="#c3a2ed"/><path d="M17 20H47V48H17Z" fill="#70cad9"/><path d="M9 28H17V41H9ZM47 28H55V41H47Z" fill="#a48bcf"/><path d="M23 28H29V35H23ZM35 28H41V35H35Z" fill="#173b50"/><path d="M24 40H40V44H24Z" fill="#fff1bb"/><path d="M23 50H28V56H23ZM36 50H41V56H36Z" fill="#a48bcf"/>',
  star:'<path d="M32 8L39 24L57 26L43 38L47 56L32 47L17 56L21 38L7 26L25 24Z" fill="#f8d785"/><path d="M23 29H27V35H23ZM37 29H41V35H37ZM25 40H39V44H25Z" fill="#63486c"/>',
  planet:'<circle cx="32" cy="32" r="19" fill="#9c8ad9"/><path d="M16 24C28 14 44 21 50 35C36 41 25 38 16 24Z" fill="#70d5d7"/><ellipse cx="32" cy="34" rx="29" ry="8" transform="rotate(-20 32 34)" fill="none" stroke="#f4d48f" stroke-width="5"/>',
  leaf:'<path d="M49 11C16 8 6 30 20 45C34 60 56 42 49 11Z" fill="#81d49c"/><path d="M16 53L43 23M25 43L22 28M32 35L44 35" fill="none" stroke="#285f5e" stroke-width="4"/>'
 };
 function pictureNode(doc,picture,seed=''){
  const supplied=text(picture).toLowerCase(),known=PICTURES.find(key=>supplied===key||supplied.endsWith('-'+key)||supplied.startsWith(key+'-'));
  let sum=0;for(const character of supplied||text(seed))sum=(Math.imul(sum,31)+character.charCodeAt(0))>>>0;
  const id=known||PICTURES[sum%PICTURES.length],svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('role','img');svg.setAttribute('aria-label','Generated '+id+' profile picture');svg.classList.add('classpass-picture');svg.dataset.profilePicture=id;svg.innerHTML='<rect width="64" height="64" rx="12" fill="#203b51"/>'+ART[id];return svg;
 }
 function create(api={}){
  const body=api.panelBody||api.host,service=api.service;if(!body||!service)throw Error('Class passes need a panel and service.');
  const doc=body.ownerDocument,win=doc.defaultView||root;
  let opened=false,disposed=false,view='student',section=null,busy='',message='',messageKind='status',confirmation=null,card=null,printSheet=null,printTimer=null,logoutRetry=false;
  let classes=[],profiles=[],selectedClass='',classDraft='',joinDraft='',profileSearch='',profilePage=0,generation=0,lastAuthorized=false;
  let nicknameEditing=false,nicknameDraft='',nicknameOwner='';
  const snapshot=()=>{try{return service.getState?.()||{};}catch{return {};}};
  const authorized=()=>snapshot().admin?.authorized===true;
  const canManage=()=>authorized()&&snapshot().enabled!==false;
  const element=(tag,className,value)=>{const node=doc.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;};
  const button=(label,action,id,kind='')=>{const node=element('button','classpass-button '+kind,label);node.type='button';if(id)node.id=id;node.disabled=!!busy||snapshot().loading===true;node.onclick=action;return node;};
  function configurationNotice(state){
   if(view!=='admin')return element('p','classpass-notice',ERRORS['not-configured']);
   const reason=state.configurationReason,notice=element('p','classpass-notice',reason==='unsupported-host'?'Google sign-in is not available at this website address. ':reason==='secure-crypto-unavailable'?'Google sign-in needs a secure browser connection. Open the site using HTTPS in an up-to-date browser. ':'Google sign-in is not ready here yet. You can still play on this device.');
   if(reason==='unsupported-host'||reason==='secure-crypto-unavailable'){
    const link=element('a','','Open Coda Arcade securely');link.id='classpassSigninSite';link.href=win.CodaArcadeHost?.CUSTOM_ORIGIN||'https://www.coda-arcade.com';notice.append(link);
   }
   return notice;
  }
  function setMessage(value,kind='status'){message=value;messageKind=kind;}
  function resetBrowser(){profileSearch='';profilePage=0;}
  function selectClass(value){if(selectedClass!==value){resetBrowser();profiles=[];}selectedClass=value;}
  function showError(result){const code=errorCode(result);setMessage(view==='student'&&['permission-denied','unauthenticated','admin-required'].includes(code)?ERRORS['invalid-pass']:friendlyError(result),'error');}
  function current(token){return opened&&!disposed&&token===generation;}
  function cleanupPrint(){if(printTimer)win.clearTimeout(printTimer);printTimer=null;printSheet?.remove();printSheet=null;doc.documentElement.classList.remove('coda-classroom-printing');win.removeEventListener('afterprint',cleanupPrint);}
  function clearCard(){if(card){card.pass='';card.link='';}card=null;section?.querySelectorAll('.classpass-card').forEach(node=>node.remove());cleanupPrint();}
  function close(){opened=false;generation++;busy='';confirmation=null;joinDraft='';classDraft='';clearNickname();resetBrowser();clearCard();section?.remove();section=null;api.closePanel?.();}
  function receipt(result){
   if(!canManage()||!result||typeof result.pass!=='string'||typeof result.link!=='string'||!result.pass.length||result.pass.length>512)return false;
   let parsed;try{parsed=new URL(result.link,win.location.href);}catch{return false;}
   if(!['http:','https:'].includes(parsed.protocol)||new URLSearchParams(parsed.hash.slice(1)).get('classroom-pass')!==result.pass||parsed.href.length>2048)return false;
   clearCard();card={alias:text(result.alias,'Music friend'),profileId:text(result.profileId),picture:result.picture,pass:result.pass,link:parsed.href};return true;
  }
  async function act(label,operation,done){
   if(busy||disposed||!opened)return;const token=++generation;busy=label;setMessage('');render();
   try{
    const result=await operation();if(!current(token))return;
    if(result?.ok===false){
     if(errorCode(result)==='unsaved-progress'&&label==='Leaving')confirmation={kind:'unsaved-leave'};
     else showError(result);return;
    }
    if(done)await done(result,token);
   }catch(error){if(current(token))showError(error);}
   finally{if(current(token)){busy='';render();if(confirmation?.kind==='unsaved-leave')section?.querySelector('#classpassCancel')?.focus({preventScroll:true});}}
  }
  async function readProfiles(token){
   if(!selectedClass||!canManage())return;
   const classId=selectedClass,result=await service.listProfiles(classId);if(!current(token)||!canManage()||classId!==selectedClass)return;
   if(result?.ok===false){showError(result);return;}
   profiles=list(result,'profiles').filter(item=>item&&typeof item.profileId==='string').map(item=>({profileId:item.profileId,alias:text(item.alias,'Music friend'),picture:item.picture})).sort((a,b)=>aliasOrder.compare(a.alias,b.alias)||aliasOrder.compare(a.profileId,b.profileId));
  }
  async function readClasses(token,select=''){
   if(!canManage())return;const result=await service.listClasses();if(!current(token)||!canManage())return;
   if(result?.ok===false){showError(result);return;}
   classes=list(result,'classes').filter(item=>item&&typeof item.classId==='string').map(item=>({classId:item.classId,label:text(item.label,'Class')})).sort((a,b)=>aliasOrder.compare(a.label,b.label)||aliasOrder.compare(a.classId,b.classId));
   selectClass(classes.some(item=>item.classId===(select||selectedClass))?(select||selectedClass):(classes[0]?.classId||''));
   await readProfiles(token);
  }
  function refreshClasses(select=''){if(!canManage())return;return act('Loading classes',async()=>({ok:true}),(_,token)=>readClasses(token,select));}
  function requestConfirmation(value){confirmation=value;setMessage('');render();section?.querySelector('#classpassCancel')?.focus({preventScroll:true});}
  const studentSelected=state=>!!state.profile&&state.profile.kind!=='teacher';
  function localPlayerName(){try{const profile=JSON.parse(win.localStorage.getItem('musicArcadeV1')||'null');return text(profile?.name).trim().slice(0,40);}catch{return '';}}
  function personalOpened(){setMessage('Your player is saved with your Google account.');const state=snapshot();if(state.profile?.kind==='teacher'&&!state.locked&&!state.waitingTakeover)api.onProfile?.(state.profile);}
  function openPersonalPlayer(){if(!canManage()||!snapshot().personal?.available||typeof service.openPersonalPlayer!=='function')return;return act('Opening your player',()=>service.openPersonalPlayer(),personalOpened);}
  function savePersonalPlayer(){
   const state=snapshot();if(!canManage()||!state.personal||state.personal.available||studentSelected(state)||typeof service.savePersonalPlayer!=='function')return;
   requestConfirmation({kind:'save-personal',alias:localPlayerName()});
  }
  function teacherNicknameOwner(state){
   const profile=state.profile,admin=state.admin;
   return state.enabled===true&&admin?.authorized===true&&profile?.kind==='teacher'&&profile.profileId&&profile.profileId===admin.uid&&!state.locked&&!state.waitingTakeover
    ?JSON.stringify([profile.classId||'',profile.profileId,admin.uid]):'';
  }
  function canRenamePersonal(state){return !!teacherNicknameOwner(state)&&!state.readOnly&&!state.loading&&typeof service.renamePersonalPlayer==='function';}
  function clearNickname(){nicknameEditing=false;nicknameDraft='';nicknameOwner='';}
  function beginNickname(){
   const state=snapshot();if(busy||!canRenamePersonal(state))return;
   nicknameEditing=true;nicknameOwner=teacherNicknameOwner(state);nicknameDraft=text(state.profile.alias);setMessage('');render();section?.querySelector('#classpassNicknameInput')?.focus({preventScroll:true});
  }
  function saveNickname(event){
   event.preventDefault();const state=snapshot();
   if(busy||!nicknameEditing||!canRenamePersonal(state)||nicknameOwner!==teacherNicknameOwner(state))return;
   const alias=nicknameDraft.trim();
   if(!alias||alias.length>40||/[\x00-\x1f\x7f-\x9f]/.test(nicknameDraft)){showError({code:'invalid-nickname'});render();return;}
   return act('Saving nickname',()=>service.renamePersonalPlayer(alias),()=>{clearNickname();setMessage('Nickname saved.');});
  }
  function renderNicknameControls(host,state){
   const owner=teacherNicknameOwner(state);if(!owner||typeof service.renamePersonalPlayer!=='function')return;
   if(!nicknameEditing){if(canRenamePersonal(state))host.append(button('Change nickname',beginNickname,'classpassPersonalRename'));return;}
   if(nicknameOwner!==owner)return;
   const form=element('form','classpass-nickname-form');form.id='classpassNicknameForm';form.noValidate=true;
   const label=element('label','','Arcade nickname');label.htmlFor='classpassNicknameInput';
   const input=element('input');input.id='classpassNicknameInput';input.type='text';input.maxLength=40;input.required=true;input.autocomplete='off';input.value=nicknameDraft;input.disabled=!!busy||state.loading===true||state.readOnly===true;input.oninput=()=>{nicknameDraft=input.value;};
   const save=button('Save nickname',()=>{},'classpassNicknameSave','is-primary');save.type='submit';save.disabled=save.disabled||state.readOnly===true;
   const cancel=button('Cancel',()=>{if(busy)return;clearNickname();setMessage('');render();section?.querySelector('#classpassPersonalRename')?.focus({preventScroll:true});},'classpassNicknameCancel');
   const actions=element('div','classpass-actions');actions.append(save,cancel);form.append(label,input,actions);form.onsubmit=saveNickname;host.append(form);
  }
  function leave(discard=false){const teacher=snapshot().profile?.kind==='teacher';return act('Leaving',()=>service.leave(discard?{discard:true}:undefined),()=>{confirmation=null;joinDraft='';setMessage(teacher?'Your player is closed on this device. It stays saved with your Google account.':'You have left this device. Use your card to return.');api.onProfile?.(null);});}
  function logOut(){
   if(disposed||busy)return;
   if(!opened)open('student');
   confirmation=null;clearCard();logoutRetry=true;
   return act('Logging out',async()=>{const result=await service.logOut();logoutRetry=result?.ok===false;return result;},()=>{classes=[];profiles=[];joinDraft='';setMessage('You are logged out.');api.onProfile?.(null);});
  }
  function confirmAction(){
   const pending=confirmation;if(!pending)return;
   if(pending.kind==='save-personal'){
    const state=snapshot();confirmation=null;
    if(!canManage()||!state.personal||state.personal.available||studentSelected(state)||typeof service.savePersonalPlayer!=='function'){render();return;}
    if(pending.alias!==localPlayerName()){setMessage('Your player changed. Check the current player and try again.');render();return;}
    return act('Saving your player',()=>service.savePersonalPlayer(),personalOpened);
   }
   if(pending.kind==='leave'){confirmation=null;return leave();}
   if(pending.kind==='takeover'){confirmation=null;return act('Opening your profile',()=>service.takeOver(),()=>{setMessage('Your profile is ready on this device.');api.onProfile?.(snapshot().profile);});}
   if(pending.kind==='unsaved-leave'){confirmation=null;return leave(true);}
   if(pending.kind==='use-saved'){
    confirmation=null;
    if(errorCode(snapshot())!=='unsaved-conflict'){setMessage('Check your connection, then try again.');render();return;}
    return act('Loading saved progress',()=>service.useSavedProgress(),()=>{setMessage('Your saved progress is ready.');const next=snapshot();if(next.profile&&!next.locked)api.onProfile?.(next.profile);});
   }
   if(pending.kind==='reissue')return act('Making a new card',()=>service.reissuePass(pending.classId,pending.profileId),(result)=>{confirmation=null;if(!receipt(result))showError({code:'qr-unavailable'});});
   if(pending.kind==='delete-profile')return act('Deleting profile',()=>service.deleteProfile(pending.classId,pending.profileId),async(_,token)=>{confirmation=null;await readProfiles(token);setMessage('Profile deleted.');});
   if(pending.kind==='delete-class')return act('Deleting class',()=>service.deleteClass(pending.classId),async(_,token)=>{confirmation=null;selectClass('');await readClasses(token);setMessage('Class deleted.');});
  }
  async function copyLink(){
   if(!card||busy)return;const value=card.link;
   try{
    if(win.navigator.clipboard?.writeText)await win.navigator.clipboard.writeText(value);
    else{const area=element('textarea');area.value=value;area.className='classpass-copy-buffer';doc.body.append(area);area.select();const copied=doc.execCommand?.('copy');area.remove();if(!copied)throw Error('copy');}
    if(opened&&card){setMessage('Pass link copied.');render();}
   }catch{if(opened){setMessage('Copy was not available. Select the pass below to copy it.','error');render();}}
  }
  async function copySetupID(uid){
   try{await win.navigator.clipboard.writeText(uid);if(opened){setMessage('Setup ID copied.');render();}}
   catch{if(opened){setMessage('Select the setup ID below to copy it.');render();}}
  }
  function makeCard(printing=false){
   const article=element('article','classpass-card');article.setAttribute('aria-label','Private Profile Pass card');
   article.append(element('p','classpass-card-brand','CODA ARCADE · PROFILE PASS'),pictureNode(doc,card.picture,card.profileId),element('h3','classpass-card-alias',card.alias));
   const qr=element('div','classpass-qr');try{qr.append((api.qr||root?.CodaClassroomPassQR).createSVG(card.link,{document:doc}));}catch{qr.append(element('p','classpass-qr-fallback','Use the pass below.'));}
   article.append(qr,element('p','classpass-card-instruction','Scan this card to open your profile.'));
   const pass=element('code','classpass-pass',card.pass);pass.setAttribute('aria-label','Private Profile Pass code');pass.tabIndex=0;article.append(pass);
   article.append(element('p','classpass-card-private','Keep your card private. If it is lost, ask your teacher for a new one.'));
   if(!printing)article.append(element('p','classpass-once','This pass is shown now. After you close this card, a replacement is needed to print a new one.'));
   return article;
  }
  function printCard(){
   if(!card||busy)return;cleanupPrint();printSheet=element('div','classroom-print-sheet');printSheet.append(makeCard(true));doc.body.append(printSheet);doc.documentElement.classList.add('coda-classroom-printing');win.addEventListener('afterprint',cleanupPrint,{once:true});printTimer=win.setTimeout(cleanupPrint,60000);
   try{win.print();}catch{cleanupPrint();setMessage('Printing could not open. Copy the pass link instead.','error');render();}
  }
  function renderCard(){
   section.append(element('h2','','Your new Profile Pass'),element('p','classpass-lead','Print this picture card. You do not need to memorize its code.'),makeCard());
   const actions=element('div','classpass-actions');actions.append(button('Print card',printCard,'classpassPrint','is-primary'),button('Copy pass link',copyLink,'classpassCopy'),button('Done · hide pass',()=>{clearCard();setMessage('Card hidden. A lost card can be replaced by a teacher.');render();},'classpassHide'));section.append(actions);
  }
  function renderConfirmation(){
   const pending=confirmation,box=element('section','classpass-confirm');box.setAttribute('role','alertdialog');box.setAttribute('aria-labelledby','classpassConfirmTitle');box.setAttribute('aria-describedby','classpassConfirmText');
   const values={
    leave:pending.personal?['Close your player here?','Your progress stays saved with your Google account.','Close my player']:['Leave this device?','Your profile and saved progress stay safe. Use your card to play here again.','Leave this device'],
    takeover:['Use this device?',pending.personal?'Your player will close on the other device. Your saved progress stays with your Google account.':'Your profile will close on the other device. Your saved progress stays with your card.','Use this device'],
    'save-personal':['Save this player to your Google account?',(pending.alias?'Save “'+pending.alias+'”':'Save the current player')+' with its avatar, level, Notes and outfits. Use the device with your latest progress for this first save.','Save this player to my account'],
    'unsaved-leave':['Some progress has not saved.','Stay here and try saving. Leaving now will lose the unsaved changes on this device.','Leave without saving'],
    'use-saved':['Use your saved progress?','This replaces the unsaved changes on this device with your saved progress. The unsaved changes will be lost.','Use saved progress'],
    reissue:['Replace this pass?','This keeps '+text(pending.alias,'the profile')+'’s saved progress. Old cards and signed-in devices will stop working.','Replace pass'],
    'delete-profile':['Delete this profile?','This permanently removes '+text(pending.alias,'the profile')+' and its saved progress. Its cards will stop working.','Delete profile'],
    'delete-class':['Delete this class?','This permanently removes the class and its profiles, including their saved progress.','Delete class']
   }[pending.kind]||['Continue?','Please check this action.','Continue'];
   const title=element('h2','',values[0]);title.id='classpassConfirmTitle';const explain=element('p','',values[1]);explain.id='classpassConfirmText';box.append(title,explain);
   const actions=element('div','classpass-actions');actions.append(button(values[2],confirmAction,'classpassConfirm',pending.kind.startsWith('delete')||['unsaved-leave','use-saved'].includes(pending.kind)?'is-danger':'is-primary'));
   actions.append(button(pending.kind==='unsaved-leave'?'Stay and save':'Cancel',()=>{
    confirmation=null;if(pending.kind==='unsaved-leave')act('Saving',()=>service.flush(),()=>setMessage('Your progress has saved.'));else render();
   },'classpassCancel'));box.append(actions);section.append(box);
  }
  function renderStudent(state){
   const personal=state.profile?.kind==='teacher';
   section.append(element('h2','',personal?'Your player':'Your Profile Pass'));
   if(state.configured!==false&&state.enabled===false){section.append(element('p','classpass-lead','Your teacher is finishing classroom setup.'),element('p','','You can keep playing on this device.'));return;}
   const code=errorCode(state),conflict=['newer-progress','unsaved-conflict'].includes(code),retryConnection=state.profile&&state.pending&&state.locked&&['unavailable','offline','network-request-failed'].includes(code);
   if(conflict||retryConnection){
    section.append(element('p','classpass-lead','Your progress needs a check.'),element('p','',conflict?ERRORS[code]:'We could not connect. The changes on this device are being kept safe.'));
    const actions=element('div','classpass-actions');actions.append(button('Try again',()=>act('Checking progress',()=>service.flush(),()=>setMessage('Progress checked.')),'classpassRetryProgress','is-primary'));
    if(code==='unsaved-conflict')actions.append(button('Use saved progress',()=>requestConfirmation({kind:'use-saved'}),'classpassUseSaved'));
    section.append(actions);return;
   }
   if(state.waitingTakeover){
    section.append(element('p','classpass-lead','Your profile is open on another device.'),element('p','','You can use this device instead. The other one will close.'));
    section.append(button('Use this device',()=>requestConfirmation({kind:'takeover',personal}),'classpassTakeover','is-primary'));return;
   }
   if(state.profile&&!state.locked){
    const identity=element('div','classpass-identity');identity.append(pictureNode(doc,state.profile.picture,state.profile.profileId),element('h3','',text(state.profile.alias,'Music friend')));section.append(identity);
    section.append(element('p','classpass-lead',personal?'Your player is ready.':'Your profile is ready.'),element('p','classpass-save-status',state.pending?'Saving your progress…':personal?'Saved with your Google account. Sign in on another device to keep playing.':'Use your card on another device to keep playing.'));
    if(personal)renderNicknameControls(section,state);
    section.append(button(personal?'Close my player here':'Leave this device',()=>requestConfirmation({kind:'leave',personal}),'classpassLeave'));return;
   }
   if(personal){section.append(element('p','classpass-notice','Your player is closed on this device. It stays saved with your Google account.'));if(canManage()&&state.personal?.available)section.append(button('Open my player',openPersonalPlayer,'classpassPersonalOpen','is-primary'));return;}
   if(state.locked)section.append(element('p','classpass-notice','Your profile has closed on this device. Use your card to play here again.'));
   section.append(element('p','classpass-lead','Scan your picture card with your camera. Tap the link to play.'));
   const form=element('form','classpass-join-form'),label=element('label','','Have a pass link or code?');label.htmlFor='classpassJoinInput';
   const input=element('input');input.type='text';input.id='classpassJoinInput';input.value=joinDraft;input.autocomplete='off';input.spellcheck=false;input.autocapitalize='none';input.maxLength=2048;input.setAttribute('aria-label','Profile Pass link or code');input.placeholder='Paste your pass here';input.disabled=!!busy||state.loading===true;input.oninput=()=>{joinDraft=input.value;};
   const submit=button('Open my profile',()=>{},'classpassJoin','is-primary');submit.type='submit';submit.disabled=submit.disabled||state.configured===false;
   form.onsubmit=event=>{event.preventDefault();const pass=joinDraft.trim();if(!pass){setMessage('Paste the link or code from your card.','error');render();return;}joinDraft='';act('Opening your profile',()=>service.join(pass),()=>{const next=snapshot();setMessage(next.waitingTakeover?'':'Your profile is ready.');if(next.profile&&!next.waitingTakeover&&!next.locked)api.onProfile?.(next.profile);});};
   form.append(label,input,submit);section.append(form,element('p','classpass-help','No name, password, or security answers are needed. If your card is lost, ask your teacher.'));
  }
  function renderProfileBrowser(state){
   const browser=element('section','classpass-browser');browser.setAttribute('aria-label','Browse classroom profiles');
   browser.append(element('h3','','Class profiles'));
   const label=element('label','','Find a profile');label.htmlFor='classpassProfileSearch';
   const search=element('input');search.type='search';search.id='classpassProfileSearch';search.value=profileSearch;search.maxLength=80;search.placeholder='Search alias, e.g. Amber Fox 14';search.autocomplete='off';search.spellcheck=false;search.disabled=!!busy||state.loading===true;
   search.oninput=()=>{profileSearch=search.value;profilePage=0;render();};
   const clear=button('Clear search',()=>{resetBrowser();render();section?.querySelector('#classpassProfileSearch')?.focus({preventScroll:true});},'classpassClearSearch');clear.disabled=clear.disabled||!profileSearch;
   const field=element('div','classpass-search-field');field.append(search,clear);browser.append(label,field,element('p','classpass-help','Search the generated alias on a student’s card. Keep student names in your school roster.'));
   const query=searchText(profileSearch),matches=query?profiles.filter(profile=>searchText(profile.alias).includes(query)):profiles;
   const pages=Math.max(1,Math.ceil(matches.length/PAGE_SIZE));profilePage=Math.max(0,Math.min(profilePage,pages-1));
   const start=profilePage*PAGE_SIZE,end=Math.min(start+PAGE_SIZE,matches.length);
   const count=element('p','classpass-profile-count',matches.length?'Showing '+(start+1)+'–'+end+' of '+matches.length+(query?' matches · '+profiles.length+' profiles in this class':' profiles'):(profiles.length?'0 matches · '+profiles.length+' profiles in this class':'0 profiles'));
   count.id='classpassProfileCount';count.setAttribute('role','status');count.setAttribute('aria-live','polite');browser.append(count);
   function pager(bottom=false){
    const suffix=bottom?'Bottom':'',nav=element('nav','classpass-pagination');nav.setAttribute('aria-label',bottom?'Profile pages below results':'Profile pages');
    function turn(step){
     profilePage+=step;render();section?.querySelector('#classpassProfileSearch')?.scrollIntoView({block:'nearest'});
     const target=section?.querySelector('#classpassRoster'+(step<0?'Prev':'Next'));(target&&!target.disabled?target:section?.querySelector('#classpassRosterPage'))?.focus({preventScroll:true});
    }
    const previous=button('Previous',()=>turn(-1),'classpassRosterPrev'+suffix),next=button('Next',()=>turn(1),'classpassRosterNext'+suffix);
    previous.disabled=previous.disabled||profilePage===0;next.disabled=next.disabled||profilePage>=pages-1;
    const page=element('span','classpass-page-number','Page '+(profilePage+1)+' of '+pages);page.id='classpassRosterPage'+suffix;page.tabIndex=-1;nav.append(previous,page,next);return nav;
   }
   if(matches.length)browser.append(pager());
   const roster=element('div','classpass-roster');roster.setAttribute('aria-label','Generated classroom profiles');
   const classId=selectedClass;
   for(const profile of matches.slice(start,end)){
    const row=element('article','classpass-profile-row');row.dataset.profileId=profile.profileId;
    const identity=element('div','classpass-profile-identity');identity.append(pictureNode(doc,profile.picture,profile.profileId),element('strong','',profile.alias));row.append(identity);
    const tools=element('div','classpass-actions');tools.append(button('Replace pass',()=>requestConfirmation({kind:'reissue',classId,profileId:profile.profileId,alias:profile.alias}),'',''),button('Delete profile',()=>requestConfirmation({kind:'delete-profile',classId,profileId:profile.profileId,alias:profile.alias}),'','is-danger'));row.append(tools);roster.append(row);
   }
   if(!matches.length)roster.append(element('p','classpass-empty',profiles.length?'No profiles match this search. Try another alias or clear the search.':'No profiles yet. Make a new profile card to begin.'));
   browser.append(roster);if(matches.length>PAGE_SIZE)browser.append(pager(true));section.append(browser);
  }
  function renderPersonalPlayer(state){
   if(!state.personal||typeof service.savePersonalPlayer!=='function'||typeof service.openPersonalPlayer!=='function')return;
   const box=element('section','classpass-personal-player classpass-notice');box.setAttribute('aria-label','Your Google-saved player');box.append(element('h3','','Your arcade player'));
   if(state.profile?.kind==='teacher'&&(state.locked||state.waitingTakeover)){
    box.append(element('p','classpass-help','Your player needs a check before you keep playing.'),button('Check saved progress',()=>{view='student';setMessage('');render();},'classpassPersonalCheck','is-primary'));
   }
   else if(state.personal.active){const active=button('Your player is open',()=>{},'classpassPersonalOpen');active.disabled=true;box.append(element('p','classpass-help','Your avatar, level, Notes and outfits save with your Google account.'),active);if(state.profile?.kind==='teacher')box.append(element('p','classpass-help','Nickname: '+text(state.profile.alias,'Music friend')));renderNicknameControls(box,state);}
   else if(state.personal.available){box.append(element('p','classpass-help','Open your Google-saved player on this device.'),button('Open my player',openPersonalPlayer,'classpassPersonalOpen','is-primary'));}
   else{
    box.append(element('p','classpass-help','On the device with your latest progress, save this player to your Google account. Then sign in on other devices.'));
    const save=button('Save this player to my account',savePersonalPlayer,'classpassPersonalSave','is-primary');save.disabled=save.disabled||studentSelected(state);box.append(save);
    if(studentSelected(state)){box.append(element('p','classpass-help','Leave the student profile before saving your own player.'),button('Leave student profile',()=>requestConfirmation({kind:'leave'}),'classpassPersonalLeaveStudent'));}
   }
   section.append(box);
  }
  function renderAdmin(state){
   section.append(element('h2','','Teacher class passes'));
   const uid=text(state.admin?.uid),showSetup=()=>{
    section.append(element('p','classpass-notice',state.admin?.authorized?'Your account is approved. Classroom access is still being finished.':'Ask your school administrator to approve this setup ID.'));
    if(/^[A-Za-z0-9_-]{1,128}$/.test(uid)){const value=element('code','classpass-setup-id',uid);value.setAttribute('aria-label','Administrator setup ID');section.append(value,button('Copy setup ID',()=>copySetupID(uid),'classpassCopySetup'));}
    section.append(element('p','classpass-help','Class cards can be made after the school finishes setup.'));
   };
   if(!state.admin?.authorized){
    section.append(element('p','classpass-lead',state.admin?.signedIn?'This Google account is not a school administrator here.':'School administrators can make picture cards and replace lost passes.'));
    if(!state.admin?.signedIn){const signIn=button('Sign in with Google',()=>act('Signing in',()=>service.adminSignIn(),(_,token)=>canManage()?readClasses(token):undefined),'classpassAdminSignIn','is-primary');signIn.disabled=signIn.disabled||state.configured===false;section.append(signIn);}
    else{showSetup();section.append(button('Sign out of Google',()=>act('Signing out',()=>service.adminSignOut()),'classpassAdminSignOut'));}
    return;
   }
   if(state.enabled===false){showSetup();section.append(button('Sign out of Google',()=>act('Signing out',()=>service.adminSignOut()),'classpassAdminSignOut'));return;}
   renderPersonalPlayer(state);
   const actions=element('div','classpass-actions classpass-admin-tools');actions.append(button('Refresh lists',()=>refreshClasses(),'classpassRefresh'),button('Sign out of Google',()=>{clearCard();classes=[];profiles=[];act('Signing out',()=>service.adminSignOut());},'classpassAdminSignOut'));section.append(actions);
   const createForm=element('form','classpass-create-class'),label=element('label','','Class label');label.htmlFor='classpassClassLabel';const input=element('input');input.type='text';input.id='classpassClassLabel';input.maxLength=40;input.value=classDraft;input.placeholder='Blue class';input.disabled=!!busy;input.oninput=()=>{classDraft=input.value;};
   const add=button('Create class',()=>{},'classpassCreateClass');add.type='submit';createForm.append(label,input,add,element('p','classpass-help','Use a group label. Do not enter children’s names.'));
   createForm.onsubmit=event=>{event.preventDefault();const value=classDraft.trim();if(!value){setMessage('Add a short class label, such as Blue class.','error');render();return;}act('Creating class',()=>service.createClass(value),async(result,token)=>{classDraft='';await readClasses(token,result.classId);setMessage('Class created.');});};section.append(createForm);
   if(!classes.length){section.append(element('p','classpass-empty','Create a class to make your first picture card.'));return;}
   const classLabel=element('label','classpass-select-label','Choose a class');classLabel.htmlFor='classpassClass';const choose=element('select');choose.id='classpassClass';choose.disabled=!!busy;
   for(const item of classes){const option=element('option','',item.label);option.value=item.classId;choose.append(option);}choose.value=selectedClass;choose.onchange=()=>{selectClass(choose.value);act('Loading profiles',async()=>({ok:true}),(_,token)=>readProfiles(token));};section.append(classLabel,choose);
   const tools=element('div','classpass-actions');tools.append(button('Make a new profile card',()=>act('Making a profile',()=>service.createProfile(selectedClass),async(result,token)=>{if(!receipt(result))showError({code:'qr-unavailable'});await readProfiles(token);}), 'classpassCreateProfile','is-primary'));
   tools.append(button('Delete class',()=>requestConfirmation({kind:'delete-class',classId:selectedClass}),'classpassDeleteClass','is-danger'));section.append(tools,element('p','classpass-help','Every profile gets a generated alias and picture. Replacing a lost card keeps its progress.'));
   renderProfileBrowser(state);
  }
  function render(){
   if(!opened||disposed||!section?.isConnected)return;
   const focus=section.contains(doc.activeElement)?doc.activeElement:null,focusId=focus?.id,selection=focus&&typeof focus.selectionStart==='number'?{start:focus.selectionStart,end:focus.selectionEnd}:null;
   section.replaceChildren();const state=snapshot();
   const tabs=element('nav','classpass-tabs');tabs.setAttribute('aria-label',state.profile?.kind==='teacher'?'Player and teacher pages':'Profile Pass pages');for(const [id,label]of [['student',state.profile?.kind==='teacher'?'My player':'My pass'],['admin','For teachers']]){const tab=button(label,()=>{if(busy)return;clearCard();confirmation=null;view=id;setMessage('');render();if(id==='admin'&&authorized())refreshClasses();},'classpassTab-'+id);tab.setAttribute('aria-pressed',String(view===id));tab.disabled=tab.disabled||!!confirmation||!!card;tabs.append(tab);}section.append(tabs);
   if(state.configured===false)section.append(configurationNotice(state));
   if(confirmation)renderConfirmation();else if(card&&canManage())renderCard();else if(view==='admin')renderAdmin(state);else renderStudent(state);
   if(typeof service.logOut==='function'&&(state.profile||state.admin?.signedIn||logoutRetry)){
    const actions=element('div','classpass-actions');actions.append(button('Log out',logOut,'classpassLogOut'));section.append(actions);
   }
   const code=errorCode(state),shownRecovery=view==='student'&&['newer-progress','unsaved-conflict'].includes(code),notice=message||(state.code&&!state.waitingTakeover?friendlyError(state):'');
   const status=element('p','classpass-status',busy?busy+'…':shownRecovery&&notice===ERRORS[code]?'':notice);status.id='classpassStatus';status.setAttribute('role',messageKind==='error'?'alert':'status');status.setAttribute('aria-live','polite');if(messageKind==='error')status.classList.add('is-error');section.append(status);
   if(focusId){const restored=doc.getElementById(focusId);if(restored&&section.contains(restored)&&!restored.disabled){restored.focus({preventScroll:true});if(selection&&restored.setSelectionRange)try{restored.setSelectionRange(selection.start,selection.end);}catch{}}}
  }
  function open(next='student'){
   if(disposed)return;generation++;busy='';clearCard();clearNickname();confirmation=null;message='';joinDraft='';classDraft='';view=next==='admin'?'admin':'student';opened=true;
   api.openPanel?.(view==='admin'?'Teacher class passes':snapshot().profile?.kind==='teacher'?'Your player':'Your Profile Pass');section=element('section','classroom-profile-ui');section.setAttribute('aria-label','Private classroom profiles');body.append(section);render();
   if(view==='admin'&&canManage())refreshClasses();else section.querySelector('#classpassJoinInput')?.focus({preventScroll:true});
  }
  const unsubscribe=service.subscribe?.(()=>{
   const state=snapshot();if(nicknameEditing&&(nicknameOwner!==teacherNicknameOwner(state)||(state.readOnly&&!state.loading))){clearNickname();if(busy==='Saving nickname'){generation++;busy='';}}
   const allowed=canManage();if(!allowed){clearCard();classes=[];profiles=[];selectClass('');resetBrowser();classDraft='';if(confirmation&&['reissue','delete-profile','delete-class'].includes(confirmation.kind))confirmation=null;if(lastAuthorized){generation++;busy='';}}
   if(confirmation?.kind==='save-personal'&&(!allowed||studentSelected(snapshot())||snapshot().personal?.available))confirmation=null;
   if(opened){render();if(view==='admin'&&allowed&&!lastAuthorized&&!busy)refreshClasses();}
   lastAuthorized=allowed;
  });
  const observer=typeof win.MutationObserver==='function'?new win.MutationObserver(()=>{
   const wrapper=body.parentElement,hidden=wrapper&&(wrapper.hidden||win.getComputedStyle(wrapper).display==='none');
   if(opened&&(!section?.isConnected||hidden)){opened=false;generation++;busy='';joinDraft='';confirmation=null;clearNickname();resetBrowser();clearCard();}
  }):null;
  observer?.observe(body.parentElement||body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
  return {open,close,logOut,handleEscape(){if(!opened)return false;if(confirmation){confirmation=null;render();}else close();return true;},getState:()=>({open:opened,view,busy:!!busy,cardVisible:!!card,classId:selectedClass,confirmation:confirmation?.kind||null}),destroy(){disposed=true;opened=false;generation++;clearCard();clearNickname();joinDraft='';confirmation=null;section?.remove();observer?.disconnect();if(typeof unsubscribe==='function')unsubscribe();}};
 }
 return Object.freeze({create,friendlyError,pictureNode});
});
