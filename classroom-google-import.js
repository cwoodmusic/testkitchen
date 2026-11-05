/* Teacher-only Google Classroom roster preview and private card printing. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomGoogleImport=api;})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const NEW_CLASS='__new__',PAGE_SIZE=20;
 const ERRORS=Object.freeze({
  'admin-required':'Sign in with your approved teacher account to import a class.',
  'admin-not-approved':'Sign in with your approved teacher account to import a class.',
  'session-changed':'Your teacher sign-in changed. Connect Google Classroom again.',
  'closed':'Your teacher sign-in changed. Connect Google Classroom again.',
  'oauth-denied':'Google Classroom was not connected. You can try again when you are ready.',
  'popup-closed-by-user':'The Google window was closed. Choose Connect Google Classroom to try again.',
  'popup-blocked':'Allow the Google sign-in window, then try connecting again.',
  'account-mismatch':'Choose the same school Google account you use for the teacher tools.',
  'classroom-api-disabled':'Google Classroom access has not been enabled for this arcade yet. Ask your arcade administrator to finish setup.',
  'district-blocked':'Your school has not allowed this app to access Google Classroom. Ask your district Google administrator for help.',
  'oauth-expired':'Your Google Classroom connection expired. Connect again to continue.',
  'oauth-revoked':'Google Classroom access ended. Connect again to continue.',
  'expired':'Your Google Classroom connection expired. Connect again to continue.',
  'revoked':'Google Classroom access ended. Connect again to continue.',
  'connect-required':'Connect Google Classroom before loading a class.',
  'not-connected':'Connect Google Classroom before loading a class.',
  'roster-too-large':'An arcade class can hold up to 200 profiles. Choose a smaller roster before importing.',
  'classroom-rate-limited':'Google Classroom is busy. Wait a moment, then try again.',
  'invalid-course':'Choose one of your Google Classroom classes before loading its roster.',
  'classroom-response-invalid':'Google Classroom returned an incomplete class list or roster. Try loading it again.',
  'classroom-import-unavailable':'Classroom import is not available here yet. Refresh the arcade and try again.',
  'roster-required':'Preview the Google Classroom roster again before importing.',
  'import-conflict':'Another import changed this class. Preview the roster again before importing.',
  'busy':'Another classroom action is still finishing. Wait a moment, then try again.',
  'roster-setup-required':'Classroom import setup needs an update from your arcade administrator. Your existing classes and cards still work.',
  'roster-unavailable':'The class roster could not load. Check your connection and try again.',
  'courses-unavailable':'Your Google Classroom classes could not load. Check your connection and try again.',
  'invalid-class-label':'Use 1–40 letters, numbers, spaces, hyphens, or underscores. Start the class name with a letter or number.',
  'class-not-found':'The arcade class is no longer available. Refresh the class list before trying again.',
  'import-target-conflict':'This Google Classroom class is already linked to another arcade class. Choose that arcade class to continue.',
  'profile-already-linked':'Each student needs their own profile. Choose a different profile for repeated links.',
  'class-full':'An arcade class can hold up to 200 profiles. Choose another class or import fewer students.',
  'invalid-roster':'This roster could not be used. Load the Google Classroom class again.',
  'invalid-import-choices':'Check the choices beside each student before importing.',
  'no-students-selected':'Choose Create new profile or an existing profile for at least one student.',
  'offline':'You are offline. Reconnect before importing a class.',
  'import-failed':'The import could not finish. Keep this window open and try again.',
  'publish-permission-required':'Google needs permission to post profile links. Choose Prepare Classroom posts and approve the request.',
  'publishing-permission-required':'Google needs permission to post profile links. Choose Prepare Classroom posts and approve the request.',
  'materials-unavailable':'Classroom posts could not be checked. Your cards are still here. Try preparing again.',
  'publish-plan-required':'Prepare the Classroom posts again before publishing.',
  'publish-plan-expired':'The posting preview expired. Prepare the Classroom posts again before publishing.',
  'publish-confirmation-required':'Review the recipients, then choose Publish profile links.',
  'publish-busy':'Classroom posting is already in progress. Wait a moment, then check the remaining posts.',
  'posting-setup-required':'Classroom posting needs an update from your arcade administrator. Your profiles and cards are unchanged.',
  'invalid-profile-link':'One profile link is no longer available. Check that student’s profile before posting.',
  'invalid-profile-material':'One profile link could not be prepared for its student. Check the profile before posting.',
  'material-publish-failed':'A Classroom post could not finish. Keep the cards and check the delivery list before trying again.',
  'classroom-timeout':'Google Classroom did not confirm the request. Keep the cards and check the delivery list before trying again.',
  'print-failed':'Print preview could not open. Your new cards are still here. Try printing again.'
 });
 const text=(value,fallback='')=>typeof value==='string'?value:fallback;
 const code=value=>text(value?.code).replace(/^auth\//,'');
 const safeLabel=value=>text(value).normalize('NFKD').replace(/[^A-Za-z0-9 _-]/g,' ').trim().replace(/^[^A-Za-z0-9]+/,'').replace(/\s+/g,' ').slice(0,40)||'Classroom class';
 function create(options={}){
  const service=options.service,initialHost=options.host,doc=options.document||initialHost?.ownerDocument||root?.document,win=doc?.defaultView||root;
  if(!initialHost||!service||!doc)throw Error('A teacher import needs a host and service.');
  const canUse=()=>{try{if(options.canUse)return options.canUse()===true;const state=service.getState?.();return state?.enabled!==false&&state?.admin?.signedIn===true&&state?.admin?.authorized===true&&typeof state.admin.uid==='string'&&!!state.admin.uid;}catch{return false;}};
  const identity=()=>{try{const value=options.getIdentity?options.getIdentity():service.getState?.().admin?.uid;return typeof value==='string'?value:JSON.stringify(value??null);}catch{return '';}};
  const element=(tag,className,value)=>{const node=doc.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;};
  const section=element('section','classroom-google-import');section.setAttribute('aria-label','Google Classroom import');
  let host=initialHost,opened=false,disposed=false,owner='',serial=0,busy='',message='',isError=false;
  let connected=false,courses=[],classes=[],courseId='',target=NEW_CLASS,newLabel='',roster=[],preview=null,choices=new Map(),page=0;
  let result=null,cards=[],keyRows=[],cardsSaved=false,closeWarning=false,printSheet=null,printTitle=null,printTimer=null,printSequence=0,unsubscribe=null;
  let appendMode=false,knownStudents=new Set(),needsReconnect=false,postPlan=null,postRows=[],postedStudents=new Set(),uncertainStudents=new Set();
  const button=(label,action,id,primary=false)=>{const node=element('button','google-import-button'+(primary?' is-primary':''),label);node.type='button';if(id)node.id=id;node.disabled=!!busy;node.onclick=action;return node;};
  function say(value,error=false){message=value;isError=error;}
  function fail(value){const error=code(value);if(['expired','revoked','connect-required','oauth-expired','oauth-revoked','not-connected','session-changed','closed','oauth-denied','account-mismatch'].includes(error)){if(cards.length||result)needsReconnect=true;else{connected=false;courses=[];courseId='';clearPreview();}}else if(['roster-required','import-conflict'].includes(error)&&!cards.length&&!result)clearPreview();say(ERRORS[error]||'We could not finish that. Check your connection and try again.',true);}
  function cleanupPrint(){if(printTimer)win.clearTimeout(printTimer);printTimer=null;printSheet?.remove();printSheet=null;if(printTitle!==null){doc.title=printTitle;printTitle=null;}doc.documentElement.classList.remove('coda-google-roster-printing');win.removeEventListener('afterprint',cleanupPrint);}
  function clearPosting(){postPlan=null;postRows=[];postedStudents.clear();uncertainStudents.clear();}
  function clearCards(){for(const card of cards){card.pass='';card.link='';card.name='';}cards=[];keyRows=[];result=null;cardsSaved=false;clearPosting();cleanupPrint();}
  function clearPreview(){roster=[];preview=null;choices.clear();page=0;appendMode=false;}
  function erase(){serial++;busy='';connected=false;courses=[];classes=[];courseId='';target=NEW_CLASS;newLabel='';knownStudents.clear();needsReconnect=false;clearPreview();clearCards();closeWarning=false;message='';isError=false;}
  function accessCurrent(){return !disposed&&canUse()&&owner===identity();}
  function resetAccess(){erase();owner='';opened=false;try{service.disconnectGoogleClassroom?.();}catch{}render();}
  function current(token){if(token!==serial||!opened||disposed)return false;if(!accessCurrent()){resetAccess();return false;}return true;}
  async function run(label,operation,done){
   if(busy||!opened||!accessCurrent())return;
   const token=++serial;busy=label;say('');render();
   try{const value=await operation(()=>current(token));if(!current(token))return;if(value?.ok===false){fail(value);return;}if(done)await done(value,()=>current(token));}
   catch(error){if(current(token))fail(error);}
   finally{if(current(token)){busy='';render();}}
  }
  function open(){if(disposed||!canUse())return false;if(opened)return true;erase();owner=identity();opened=true;render();options.onOpen?.();section.querySelector('#googleRosterConnect')?.focus({preventScroll:true});return true;}
  function close({force=false}={}){
   if(disposed)return true;
   if(!force&&busy)return false;
   if(!force&&cards.length&&!cardsSaved){closeWarning=true;render();return false;}
   erase();owner='';opened=false;try{service.disconnectGoogleClassroom?.();}catch{}render();options.onClose?.();return true;
  }
  function connect(){
   return run('Connecting Google Classroom',async valid=>{
    const value=await service.connectGoogleClassroom();if(!valid()||value?.ok===false)return value;
    const [courseResult,classResult]=await Promise.all([service.listGoogleClassroomCourses(),service.listClasses()]);
    if(!valid())return {ok:false,code:'session-changed'};
    if(courseResult?.ok===false)return courseResult;if(classResult?.ok===false)return classResult;
    return {ok:true,courses:courseResult?.courses||[],classes:classResult?.classes||[]};
   },value=>{
    connected=true;needsReconnect=false;courses=value.courses.filter(item=>typeof item?.id==='string').map(item=>({id:item.id,name:text(item.name,'Classroom class'),section:text(item.section)}));
    classes=value.classes.filter(item=>typeof item?.classId==='string').map(item=>({classId:item.classId,label:text(item.label,'Arcade class')}));
    say(courses.length?'Choose the class you want to bring into the arcade.':'No Google Classroom classes were found for this teacher account.');
   });
  }
  function selectedCourse(){return courses.find(item=>item.id===courseId);}
  function rememberClass(classId,label){if(!classId)return;const item=classes.find(value=>value.classId===classId);if(item)item.label=label||item.label;else classes.push({classId,label:label||'Arcade class'});target=classId;}
  function defaultChoices(){
   const hasProfiles=(preview?.profiles||[]).length>0;
   choices=new Map(roster.map(student=>{const row=(preview?.students||[]).find(item=>item.userId===student.userId);const action=row?.status==='existing'?'existing':row?.status==='missing'?'skip':appendMode?(knownStudents.has(student.userId)?'skip':'create'):hasProfiles?'skip':'create';return [student.userId,{action}];}));
  }
  function loadPreview(){
   if(!courseId||!selectedCourse())return;
   if(target===NEW_CLASS&&!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(newLabel.trim())){fail({code:'invalid-class-label'});render();return;}
   const captured={courseId,classId:target===NEW_CLASS?undefined:target};
   return run('Loading class roster',async valid=>{
    const loaded=await service.loadGoogleClassroomRoster(captured.courseId);if(!valid()||loaded?.ok===false)return loaded;
    const students=(loaded?.students||[]).filter(item=>typeof item?.userId==='string').map(item=>({userId:item.userId,name:text(item.name,'Student')}));
    const value=await service.previewRosterImport({...captured,students});if(value?.ok===false)return value;return {ok:true,students,value};
   },loaded=>{
    roster=loaded.students;preview=loaded.value;page=0;
    if(preview?.newClass===false&&typeof preview.classId==='string')rememberClass(preview.classId,preview.label);
    defaultChoices();say(roster.length?'Check each student before importing. Existing profiles keep their cards and progress.':'This Google Classroom class has no students to import.');
   });
  }
  function selectUnlinked(){
   if(!accessCurrent()||busy||!preview)return;
   for(const student of roster){const row=preview.students?.find(item=>item.userId===student.userId);if(row?.status==='unlinked')choices.set(student.userId,{action:'create'});}
   appendMode=true;say('Review the selected students before adding their new profiles. Existing and missing profiles are unchanged.');render();
  }
  function refreshRoster(){
   if(!result||busy||cards.length&&!cardsSaved||!accessCurrent())return;
   postPlan=null;
   const captured={courseId,classId:result.classId,label:result.label};
   return run('Checking for new students',async valid=>{
    const loaded=await service.loadGoogleClassroomRoster(captured.courseId);if(!valid()||loaded?.ok===false)return loaded;
    const students=(loaded?.students||[]).filter(item=>typeof item?.userId==='string').map(item=>({userId:item.userId,name:text(item.name,'Student')}));
    const value=await service.previewRosterImport({courseId:captured.courseId,classId:captured.classId,students});if(value?.ok===false)return value;return {ok:true,students,value};
   },loaded=>{
    clearCards();roster=loaded.students;preview=loaded.value;page=0;appendMode=true;needsReconnect=false;rememberClass(preview.classId||captured.classId,preview.label||captured.label);defaultChoices();
    say('The roster is up to date. Only newly seen, unlinked students are selected for new profiles. Review the choices before adding them.');
   });
  }
  function reconnect(){postPlan=null;return run('Connecting Google Classroom',()=>service.connectGoogleClassroom(),()=>{connected=true;needsReconnect=false;say('Google Classroom is connected. You can check for new students again.');});}
  function summary(){
   const counts={create:0,link:0,existing:0,skip:0},used=new Set();let duplicate=false;
   for(const student of roster){
    const row=preview?.students?.find(item=>item.userId===student.userId),choice=choices.get(student.userId)||{action:'skip'};
    const action=row?.status==='existing'?'existing':choice.action;counts[action]=(counts[action]||0)+1;
    const profile=action==='existing'?row?.profileId:action==='link'?choice.profileId:null;
    if(profile){if(used.has(profile))duplicate=true;used.add(profile);}
   }
   return {counts,duplicate};
  }
  function importRoster(){
   if(preview?.newClass===true&&!/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/.test(newLabel.trim())){fail({code:'invalid-class-label'});render();return;}
   const {counts,duplicate}=summary();if(duplicate){fail({code:'profile-already-linked'});render();return;}if(!counts.create&&!counts.link)return;
   const request={courseId,students:roster.map(item=>({...item})),choices:roster.map(student=>{
    const row=preview?.students?.find(item=>item.userId===student.userId),choice=choices.get(student.userId)||{action:'skip'};
    return {userId:student.userId,...(row?.status==='existing'?{action:'skip'}:choice)};
   })};
   if(preview?.newClass===false)request.classId=preview.classId||target;else request.label=newLabel.trim();
   return run('Importing profiles',()=>service.importRoster(request),value=>{
    result={classId:text(value.classId),label:text(value.label,newLabel),created:Number(value.created)||0,linked:Number(value.linked)||0,existing:Number(value.existing)||0,skipped:Number(value.skipped)||0};
    rememberClass(result.classId,result.label);knownStudents=new Set(roster.map(student=>student.userId));clearPosting();
    cards=(value.cards||[]).filter(item=>typeof item?.pass==='string'&&typeof item?.link==='string').map(item=>({...item,name:roster.find(student=>student.userId===item.userId)?.name||text(item.name)}));
    const profiles=new Map((preview?.profiles||[]).map(item=>[item.profileId,item]));
    keyRows=roster.flatMap(student=>{
     const old=preview?.students?.find(item=>item.userId===student.userId),choice=choices.get(student.userId),card=cards.find(item=>item.userId===student.userId);
     const profile=old?.status==='existing'?old:card||choice?.action==='link'&&profiles.get(choice.profileId);
     return profile?[{name:student.name,alias:text(profile.alias,'Existing profile')}]:[];
    });
    cardsSaved=false;say('Class imported. Save, print, or post the new profile links before closing.');options.onChanged?.({classId:result.classId,label:result.label,created:result.created,linked:result.linked});
   });
  }
  function viewLinkedClass(){
   if(!accessCurrent()||!preview||busy)return;
   const {counts}=summary();if(counts.create||counts.link||!counts.existing)return;
   result={classId:text(preview.classId),label:text(preview.label,classes.find(item=>item.classId===target)?.label||'Arcade class'),created:0,linked:0,existing:counts.existing,skipped:counts.skip};
   keyRows=roster.flatMap(student=>{const existing=preview.students?.find(item=>item.userId===student.userId&&item.status==='existing');return existing?[{name:student.name,alias:text(existing.alias,'Existing profile')}]:[];});
   cards=[];cardsSaved=true;say('Your linked profiles are unchanged. You can print the private teacher key.');
   knownStudents=new Set(roster.map(student=>student.userId));rememberClass(result.classId,result.label);clearPosting();
   options.onChanged?.({classId:result.classId,label:result.label,created:0,linked:0});render();
  }
  const POST_LABELS=Object.freeze({ready:'Ready · assigned only to this student',posted:'Posted to this student',
   'already-posted':'Already posted · will be skipped','link-unavailable':'No new link available','profile-unavailable':'Profile unavailable',
   uncertain:'Check Google Classroom · delivery is uncertain',busy:'Another posting attempt is still being checked',failed:'Not posted · prepare again after checking access'});
  function receiptPostRows(rows,expectedIds){
   if(!Array.isArray(rows))throw {code:'materials-unavailable'};
   const expected=new Set(expectedIds),seen=new Set(),owned=new Set(cards.map(card=>card.userId));
   for(const row of rows){if(typeof row?.userId!=='string'||seen.has(row.userId)||!POST_LABELS[row.status]||row.status==='ready'&&!expected.has(row.userId))throw {code:'materials-unavailable'};seen.add(row.userId);}
   if([...expected].some(userId=>!seen.has(userId)))throw {code:'materials-unavailable'};
   return rows.filter(row=>owned.has(row.userId));
  }
  function mergePostRows(rows){
   const supplied=Array.isArray(rows)?rows:[],seen=new Set(),next=new Map(postRows.map(row=>[row.userId,row]));
   for(const value of supplied){const card=cards.find(item=>item.userId===value?.userId);if(!card||seen.has(card.userId)||!POST_LABELS[value.status])throw {code:'materials-unavailable'};seen.add(card.userId);
    let status=value.status;
    if(status==='posted'||status==='already-posted'){postedStudents.add(card.userId);uncertainStudents.delete(card.userId);}
    else if(status==='uncertain')uncertainStudents.add(card.userId);
    if(postedStudents.has(card.userId)&&status!=='posted'&&status!=='already-posted')status='already-posted';else if(uncertainStudents.has(card.userId))status='uncertain';
    next.set(card.userId,{userId:card.userId,name:card.name,alias:card.alias,status});
   }
   postRows=cards.map(card=>next.get(card.userId)).filter(Boolean);
   if(cards.length&&cards.every(card=>postedStudents.has(card.userId)))cardsSaved=true;
  }
  function preparePosts(){
   if(!result||!cards.length||busy||!accessCurrent())return;
   const remaining=cards.filter(card=>!postedStudents.has(card.userId)).map(card=>({userId:card.userId,profileId:card.profileId,alias:card.alias,name:card.name,link:card.link}));
   if(!remaining.length)return;
   postPlan=null;
   return run('Preparing Classroom posts',async valid=>{
    // This is the first awaited operation after the teacher's click so Google
    // can open its additional-permission consent window from user activation.
    const allowed=await service.connectGoogleClassroomPublishing();if(!valid()||allowed?.ok===false)return allowed;
    return await service.previewClassroomPosts({courseId,cards:remaining});
   },value=>{
    postPlan=null;
    const rows=receiptPostRows(value.rows,remaining.map(card=>card.userId));
    const unsafe=rows.some(row=>row.status==='ready'&&(postedStudents.has(row.userId)||uncertainStudents.has(row.userId)));
    mergePostRows(rows);if(unsafe)throw {code:'materials-unavailable'};
    const ready=rows.filter(row=>row.status==='ready').length;
    if(ready){if(typeof value.planId!=='string'||!value.planId)throw {code:'publish-plan-required'};postPlan={id:value.planId,ready,userIds:remaining.map(card=>card.userId)};}
    needsReconnect=false;say(ready?'Review the recipients below. Publishing creates a private Classwork item for each selected student.':'The delivery check is ready. Already posted links will not be sent again.');
   });
  }
  function publishPosts(){
   if(!postPlan||!postPlan.ready||busy||!accessCurrent())return;
   const plan=postPlan;postPlan=null;
   const uncertain=()=>{mergePostRows(postRows.filter(row=>plan.userIds.includes(row.userId)&&row.status==='ready').map(row=>({...row,status:'uncertain'})));};
   return run('Publishing profile links',async()=>{
    try{const value=await service.publishClassroomPosts({planId:plan.id,confirmed:true});
     if(value?.ok===false&&!['publish-permission-required','publishing-permission-required','publish-plan-required','publish-plan-expired','publish-confirmation-required','publish-busy','posting-setup-required','roster-required','invalid-profile-link','invalid-profile-material','offline'].includes(code(value)))uncertain();
     return value;
    }catch(error){uncertain();throw error;}
   },value=>{
    try{mergePostRows(receiptPostRows(value.rows,plan.userIds));}catch(error){uncertain();throw error;}
    const posted=cards.filter(card=>postedStudents.has(card.userId)).length;
    say(posted===cards.length?'All new profile links are posted to their individual students. You can check for new students when the roster changes.':posted+' of '+cards.length+' profile links are posted. Keep these cards and check any students marked as needing attention.');
   });
  }
  function makeCard(card){
   const article=element('article','google-import-card');article.setAttribute('aria-label','Private arcade player card');
   article.append(element('p','google-card-brand','CODA ARCADE · PROFILE PASS'));
   if(typeof options.pictureNode==='function')article.append(options.pictureNode(doc,card.picture,card.profileId));
   article.append(element('h3','google-card-alias',text(card.alias,'Music friend')));
   const qr=element('div','google-card-qr');
   try{const api=options.qr||root?.CodaClassroomPassQR;if(!api?.createSVG)throw Error('qr');qr.append(api.createSVG(card.link,{document:doc}));}
   catch{qr.append(element('p','','Use your private pass below.'));}
   article.append(qr,element('p','google-card-instruction','Scan this card to open your profile.'),element('code','google-card-pass',card.pass),element('p','google-card-private','Keep your card private. Ask your teacher for help if it is lost.'));
   return article;
  }
  function makeKey(){
   const key=element('section','google-teacher-key');key.append(element('h1','','PRIVATE · Teacher roster key'),element('p','',result?.label||'Arcade class'),element('p','','Keep this teacher copy private. Student cards use generated aliases.'));
   const table=element('table'),thead=element('thead'),head=element('tr');head.append(element('th','','Student'),element('th','','Arcade alias'));thead.append(head);table.append(thead);
   const body=element('tbody');for(const row of keyRows){const tr=element('tr');tr.append(element('td','',row.name),element('td','',row.alias));body.append(tr);}table.append(body);key.append(table);return key;
  }
  function print(kind){
   if(!accessCurrent()||!result||busy||kind==='cards'&&!cards.length||kind==='key'&&!keyRows.length)return;
   cleanupPrint();printSheet=element('div','classroom-google-print-sheet');printSheet.dataset.printKind=kind;
   if(kind==='key')printSheet.append(makeKey());else{const grid=element('div','google-print-cards');for(const card of cards)grid.append(makeCard(card));printSheet.append(grid);}
   doc.body.append(printSheet);printTitle=doc.title;
   const label=safeLabel(result.label).replace(/\s+/g,'-'),unique=Date.now().toString(36)+'-'+(++printSequence);
   doc.title=(kind==='cards'?'Coda-Class-Cards-':'Coda-Teacher-Key-')+label+'-'+unique;
   doc.documentElement.classList.add('coda-google-roster-printing');win.addEventListener('afterprint',cleanupPrint,{once:true});printTimer=win.setTimeout(cleanupPrint,120000);
   try{win.print();}catch{cleanupPrint();fail({code:'print-failed'});render();}
  }
  function renderSetup(){
   section.append(element('h3','','Import from Google Classroom'),element('p','google-import-help','Choose a school class, check its roster, and make arcade profiles together. Student names stay in teacher tools; the game keeps generated aliases.'));
   if(!connected){section.append(button('Connect Google Classroom',connect,'googleRosterConnect',true));return;}
   const form=element('form','google-import-settings');form.onsubmit=event=>{event.preventDefault();loadPreview();};
   const courseLabel=element('label','','Google Classroom class');courseLabel.htmlFor='googleRosterCourse';
   const select=element('select');select.id='googleRosterCourse';select.disabled=!!busy;const empty=element('option','','Choose a class');empty.value='';select.append(empty);
   for(const item of courses){const option=element('option','',item.name+(item.section?' · '+item.section:''));option.value=item.id;select.append(option);}select.value=courseId;
   select.onchange=()=>{courseId=select.value;newLabel=safeLabel(selectedCourse()?.name);clearPreview();say('');render();};
   const targetLabel=element('label','','Arcade class');targetLabel.htmlFor='googleRosterTarget';const targetSelect=element('select');targetSelect.id='googleRosterTarget';targetSelect.disabled=!!busy;
   const createOption=element('option','','Create a new arcade class');createOption.value=NEW_CLASS;targetSelect.append(createOption);
   for(const item of classes){const option=element('option','',item.label);option.value=item.classId;targetSelect.append(option);}targetSelect.value=target;
   targetSelect.onchange=()=>{target=targetSelect.value;clearPreview();say('');render();};form.append(courseLabel,select,targetLabel,targetSelect);
   if(target===NEW_CLASS){const label=element('label','','New arcade class name');label.htmlFor='googleRosterLabel';const input=element('input');input.id='googleRosterLabel';input.type='text';input.maxLength=40;input.value=newLabel;input.disabled=!!busy;input.oninput=()=>{newLabel=input.value;};form.append(label,input);}
   const previewButton=button('Preview roster',()=>{},'googleRosterPreview',true);previewButton.type='submit';previewButton.disabled=previewButton.disabled||!courseId;form.append(previewButton);section.append(form);
   if(preview)renderPreview();
  }
  function renderPreview(){
   const {counts,duplicate}=summary();section.append(element('h4','','Review student profiles'));
   section.append(element('p','google-import-help',appendMode?'Already linked students keep their profiles and cards. Review the selected unlinked students before adding new profiles.':(preview.profiles||[]).length?'Link students to their existing arcade aliases to keep their progress. New students need a new profile. Unlinked students start as Skip.':'Choose which students should receive new arcade profiles.'));
   if(preview.newClass===false&&preview.students?.some(student=>student.status==='unlinked'))section.append(button('Select unlinked students',selectUnlinked,'googleRosterSelectUnlinked'));
   const list=element('div','google-roster-list'),pages=Math.max(1,Math.ceil(roster.length/PAGE_SIZE));page=Math.min(page,pages-1);
   for(const [offset,student]of roster.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).entries()){
    const row=element('article','google-roster-row');row.dataset.userId=student.userId;const name=element('strong','google-roster-name',student.name);row.append(name);
    const linked=preview.students?.find(item=>item.userId===student.userId),choice=choices.get(student.userId)||{action:'skip'};
    if(linked?.status==='existing')row.append(element('p','google-roster-linked','Already linked · '+text(linked.alias,'Existing arcade profile')));
    else{
     if(linked?.status==='missing')row.append(element('p','google-import-help','The previous profile is unavailable. Choose another profile, create a new one, or skip.'));
     const id='googleRosterChoice-'+(page*PAGE_SIZE+offset),label=element('label','google-import-choice-label','Arcade profile for '+student.name);label.htmlFor=id;
     const select=element('select');select.id=id;select.disabled=!!busy;
     for(const [value,label]of [['skip','Skip this student'],['create','Create new profile']]){const option=element('option','',label);option.value=value;select.append(option);}
     for(const profile of preview.profiles||[]){const option=element('option','','Link '+profile.alias);option.value='link:'+profile.profileId;option.disabled=!!profile.linkedTo&&profile.linkedTo!==student.userId;select.append(option);}
     select.value=choice.action==='link'?'link:'+choice.profileId:choice.action;select.onchange=()=>{choices.set(student.userId,select.value.startsWith('link:')?{action:'link',profileId:select.value.slice(5)}:{action:select.value});say('');render();};row.append(label,select);
    }
    list.append(row);
   }
   section.append(list);
   if(pages>1){const nav=element('div','google-import-actions');const previous=button('Previous students',()=>{page--;render();},'googleRosterPrevious'),next=button('Next students',()=>{page++;render();},'googleRosterNext');previous.disabled=previous.disabled||page===0;next.disabled=next.disabled||page===pages-1;nav.append(previous,element('span','google-roster-page','Page '+(page+1)+' of '+pages),next);section.append(nav);}
   section.append(element('p','google-import-summary',counts.create+' new profiles · '+counts.link+' profiles to link · '+counts.existing+' already linked · '+counts.skip+' skipped'));
   if(duplicate)section.append(element('p','google-import-error',ERRORS['profile-already-linked']));
   const count=counts.create+counts.link,label=appendMode&&!counts.link?'Add '+counts.create+' new '+(counts.create===1?'profile':'profiles'):'Import '+count+' '+(count===1?'student':'students');
   const confirm=button(label,importRoster,'googleRosterImport',true);confirm.disabled=confirm.disabled||duplicate||count===0;section.append(confirm);
   if(!counts.create&&!counts.link&&counts.existing)section.append(button('View private teacher key',viewLinkedClass,'googleRosterViewKey',true));
  }
  function renderResult(){
   section.append(element('h3','','Class imported'),element('p','google-import-summary',result.created+' new profiles · '+result.linked+' linked · '+result.existing+' already linked · '+result.skipped+' skipped'));
   section.append(element('p','google-import-help',cards.length?'Existing profiles keep their cards and progress. Save, print, or post the new links now; their private passes are kept only while this window stays open.':'Linked profiles keep their cards and progress. Use the private teacher key to match student names to arcade aliases.'));
   section.append(element('p','google-import-help','Repeating an import keeps existing cards. For a missing card, use For teachers → Replace pass; the old card will stop working.'));
   const actions=element('div','google-import-actions');if(cards.length)actions.append(button('Print '+cards.length+' new '+(cards.length===1?'card':'cards'),()=>print('cards'),'googleRosterPrintCards',true));if(keyRows.length)actions.append(button('Print private teacher key',()=>print('key'),'googleRosterPrintKey'));section.append(actions);
   if(cards.length&&typeof service.connectGoogleClassroomPublishing==='function'&&typeof service.previewClassroomPosts==='function'&&typeof service.publishClassroomPosts==='function')renderPosting();
   if(cards.length){const label=element('label','google-import-saved');const checkbox=element('input');checkbox.type='checkbox';checkbox.id='googleRosterCardsSaved';checkbox.checked=cardsSaved;checkbox.onchange=()=>{cardsSaved=checkbox.checked;render();};label.append(checkbox,element('span','','I saved, printed, or posted the new links.'));section.append(label);}
   if(keyRows.length){const details=element('details','google-import-key-preview'),summary=element('summary','','View private teacher roster key');details.append(summary,makeKey());section.append(details);}
   if(needsReconnect)section.append(button('Reconnect Google Classroom',reconnect,'googleRosterReconnect'));
   const refresh=button('Check for new students',refreshRoster,'googleRosterRefresh');refresh.disabled=refresh.disabled||cards.length>0&&!cardsSaved||needsReconnect;section.append(refresh);
   if(cards.length&&!cardsSaved)section.append(element('p','google-import-help','Save, print, or finish posting these new links before checking for more students.'));
   section.append(button('Done',()=>close(),'googleRosterDone'));
  }
  function renderPosting(){
   const box=element('section','google-posting');box.setAttribute('aria-label','Private Google Classroom posts');box.append(element('h4','','Send private profile links'),element('p','google-import-help','Students will find their own profile link in Google Classroom’s Classwork tab. Each item is assigned to one student.'));
   const allPosted=cards.every(card=>postedStudents.has(card.userId));
   if(!allPosted)box.append(button(postRows.length?'Prepare remaining Classroom posts':'Prepare Classroom posts',preparePosts,'googleRosterPreparePosts'));
   if(postRows.length){
    const list=element('div','google-post-rows');
    for(const value of postRows){const row=element('article','google-post-row');row.dataset.userId=value.userId;row.dataset.deliveryStatus=value.status;row.append(element('strong','',value.name),element('span','google-post-alias',value.alias),element('p','google-post-state',POST_LABELS[value.status]));list.append(row);}box.append(list);
    const delivered=cards.filter(card=>postedStudents.has(card.userId)).length;box.append(element('p','google-import-summary',delivered+' of '+cards.length+' new profile links delivered'));
   }
   if(postPlan?.ready)box.append(button('Publish '+postPlan.ready+' profile '+(postPlan.ready===1?'link':'links'),publishPosts,'googleRosterPublishPosts',true));
   if(allPosted)box.append(element('p','google-post-complete','All new links are posted to their individual students.'));
   if(postRows.some(row=>row.status==='uncertain'||row.status==='busy')){
    box.append(element('p','google-import-help','Check the Classwork tab for any delivery marked as uncertain. The arcade will not resend an uncertain post automatically.'));
    const link=element('a','google-classroom-link','Open Google Classroom');link.href='https://classroom.google.com/';link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';box.append(link);
   }
   section.append(box);
  }
  function render(){
   if(disposed)return;
   if(opened&&!accessCurrent()){erase();owner='';opened=false;try{service.disconnectGoogleClassroom?.();}catch{}}
   const focus=section.contains(doc.activeElement)?doc.activeElement:null,focusId=focus?.id,selection=focus&&typeof focus.selectionStart==='number'?{start:focus.selectionStart,end:focus.selectionEnd}:null;
   section.replaceChildren();section.hidden=!canUse();if(section.hidden)return;
   if(!opened){section.append(button('Import from Google Classroom',open,'googleRosterOpen'));return;}
   if(closeWarning){const warning=element('div','google-import-warning');warning.setAttribute('role','alertdialog');warning.setAttribute('aria-label','Save the new cards before closing');warning.append(element('h3','','Save the new cards before closing'),element('p','','This window keeps the new cards only until it closes. Return to save, print, or post the links, or close and clear the private passes.'));
    const actions=element('div','google-import-actions');actions.append(button('Back to cards',()=>{closeWarning=false;render();section.querySelector('#googleRosterPrintCards')?.focus({preventScroll:true});},'googleRosterKeepCards',true),button('Close and clear cards',()=>close({force:true}),'googleRosterDiscardCards'));warning.append(actions);section.append(warning);section.querySelector('#googleRosterKeepCards')?.focus({preventScroll:true});return;}
   const header=element('div','google-import-header');header.append(element('span','google-import-private','TEACHER TOOLS'),button('Close import',()=>close(),'googleRosterClose'));section.append(header);
   if(result)renderResult();else renderSetup();
   const status=element('p','google-import-status'+(isError?' is-error':''),busy||message);status.id='googleRosterStatus';status.setAttribute('role',isError?'alert':'status');status.setAttribute('aria-live','polite');section.append(status);
   if(focusId){const restored=section.querySelector('#'+focusId);if(restored&&!restored.disabled){restored.focus({preventScroll:true});if(selection&&restored.setSelectionRange)try{restored.setSelectionRange(selection.start,selection.end);}catch{}}}
  }
  function mount(nextHost=host){if(disposed)return false;if(!nextHost)throw Error('A teacher import needs a host.');host=nextHost;host.append(section);render();return true;}
  const beforeUnload=event=>{if(opened&&accessCurrent()&&(busy==='Importing profiles'||busy==='Publishing profile links'||cards.length&&!cardsSaved)){event.preventDefault();event.returnValue='';}};
  win.addEventListener('beforeunload',beforeUnload);
  unsubscribe=service.subscribe?.(()=>{if(opened&&!accessCurrent())resetAccess();else if(!opened)render();});
  mount();
  return {mount,open,close,render,getState:()=>({open:opened,busy:!!busy,connected,courseCount:courses.length,rosterCount:roster.length,cardCount:cards.length,hasUnprintedCards:cards.length>0&&!cardsSaved,stage:closeWarning?'close-warning':result?'cards':preview?'preview':connected?'classes':'connect'}),destroy(){if(disposed)return;close({force:true});disposed=true;serial++;cleanupPrint();section.remove();win.removeEventListener('beforeunload',beforeUnload);if(typeof unsubscribe==='function')unsubscribe();unsubscribe=null;}};
 }
 return Object.freeze({create});
});
