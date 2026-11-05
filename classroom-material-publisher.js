/* Private, individually assigned Classroom materials with durable retry guards. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomMaterialPublisher=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const ID=/^[A-Za-z0-9_-]{1,128}$/,PROFILE=/^[A-Za-z0-9_-]{8,64}$/,HASH=/^[a-f0-9]{64}$/,ATTEMPT=/^[a-f0-9]{32}$/;
 const RESERVED=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype']);
 const STATES=new Set(['claimed','sending','posted','uncertain','failed']),LEASE_MS=90000,PLAN_MS=10*60*1000;
 const CODES=new Set(['admin-required','session-changed','offline','busy','publish-busy','publish-permission-required','publishing-permission-required','materials-unavailable','material-publish-failed','classroom-timeout','invalid-profile-material','classroom-api-disabled','district-blocked','expired','revoked','oauth-denied','classroom-rate-limited','classroom-response-invalid','connect-required','invalid-course','invalid-roster','invalid-profile-link','roster-required','class-not-found','publish-plan-required','publish-plan-expired','publish-confirmation-required','posting-setup-required','posting-state-invalid','profile-link-changed','posting-paused']);
 const fail=code=>({ok:false,code}),record=value=>value&&typeof value==='object'&&!Array.isArray(value),own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
 const validId=value=>typeof value==='string'&&ID.test(value)&&!RESERVED.has(value),validProfile=value=>typeof value==='string'&&PROFILE.test(value)&&!RESERVED.has(value);
 const safeCode=(cause,fallback)=>CODES.has(cause?.code)?cause.code:fallback;
 const problem=code=>Object.assign(Error(code),{code});
 const cleanName=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f-\x9f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160):'Student';
 function create(options={}){
  for(const name of ['getContext','read','transaction','online','parseProfileLink','hashPass','random','serverTimestamp'])if(typeof options[name]!=='function')throw Error('Classroom publishing requires '+name);
  if(typeof options.google?.listProfileMaterials!=='function'||typeof options.google?.createProfileMaterial!=='function')throw Error('Classroom publishing requires the materials API.');
  const now=options.clock||Date.now;
  let serial=0,plan=null,running=null,destroyed=false;
  const exposed=new Set();
  const context=()=>{try{return options.getContext();}catch{return null;}};
  const approved=value=>value?.authorized===true&&value.signedIn===true&&validId(value.uid);
  const identity=value=>JSON.stringify([value?.uid,value?.identity]);
  const plain=value=>JSON.parse(JSON.stringify(value));
  function operation(){
   const initial=context();if(destroyed||!approved(initial)){clearPlan();throw problem('admin-required');}
   const owner=serial,key=identity(initial);
   const current=()=>!destroyed&&owner===serial&&approved(context())&&identity(context())===key;
   return {uid:initial.uid,key,current,guard(){if(!current()){if(owner===serial){serial++;clearPlan();}throw problem('session-changed');}}};
  }
  function randomId(){const bytes=options.random(16);if(!bytes||bytes.length!==16)throw problem('materials-unavailable');return Array.from(bytes,value=>Number(value).toString(16).padStart(2,'0')).join('');}
  function clearPlan(){
   if(plan){for(const row of plan.rows){row.link='';row.name='';}plan.rows=[];}plan=null;
   for(const rows of exposed){for(const row of rows)for(const key of Object.keys(row))try{delete row[key];}catch{}try{rows.length=0;}catch{}}
   exposed.clear();
  }
  function clear(){serial++;clearPlan();running=null;}
  function requirePublishing(){if(options.google.getState?.().canPublish===false)throw problem('publish-permission-required');}
  async function read(path,op){const value=await options.read(path);op.guard();return value;}
  async function transaction(path,updater,op){
   op.guard();
   try{const value=await options.transaction(path,current=>op.current()?updater(current):undefined);op.guard();return value;}
   catch(cause){if(!op.current())throw problem('session-changed');if(/permission[-_ ]denied/i.test((cause?.code||'')+' '+(cause?.message||'')))throw problem('posting-setup-required');throw cause;}
  }
  const snapshot=result=>typeof result?.snapshot?.val==='function'?result.snapshot.val():result?.snapshot??null;
  function validLedger(value,profileId){
   if(value===null||value===undefined)return null;
   if(!record(value)||Object.keys(value).some(key=>!['profileId','attemptId','state','leaseUntil','createdAt','updatedAt','materialId'].includes(key))||value.profileId!==profileId||!ATTEMPT.test(value.attemptId||'')||!STATES.has(value.state)||![value.leaseUntil,value.createdAt,value.updatedAt].every(number=>Number.isSafeInteger(number)&&number>=0)||value.state==='posted'&&!validId(value.materialId)||value.state!=='posted'&&own(value,'materialId'))throw problem('posting-state-invalid');
   return value;
  }
  async function materialIndex(op,courseId){
   requirePublishing();const response=await options.google.listProfileMaterials(courseId);op.guard();
   if(response?.ok===false)throw problem(safeCode(response,'materials-unavailable'));
   if(!Array.isArray(response?.materials))throw problem('classroom-response-invalid');
   const index=new Map(),hashes=new Map();
   for(const material of response.materials){
    op.guard();if(!['PUBLISHED','DRAFT','DELETED'].includes(material?.state)||!validId(material.id))continue;
    const attachments=Array.isArray(material.materials)?material.materials:(Array.isArray(material.links)?material.links.map(url=>({link:{url}})):[]);
    const recipients=material.individualStudentsOptions?.studentIds||material.studentIds||[];
    for(const item of attachments){
     if(typeof item?.link?.url!=='string')continue;
     let parsed;try{parsed=options.parseProfileLink(item.link.url);}catch{continue;}
     if(!parsed?.rawPass||typeof parsed.link!=='string')continue;
     let digest=hashes.get(parsed.rawPass);
     if(!digest){digest=await options.hashPass(parsed.rawPass);op.guard();if(!HASH.test(digest||''))continue;hashes.set(parsed.rawPass,digest);}
     const rows=index.get(digest)||[];
     rows.push({materialId:material.id,published:material.state==='PUBLISHED',oneLink:attachments.length===1,individual:material.assigneeMode==='INDIVIDUAL_STUDENTS',recipients:Array.isArray(recipients)?recipients:[]});index.set(digest,rows);
    }
   }
   return index;
  }
  function materialMatch(index,row){
   const matches=index.get(row.passHash)||[];
   const exact=matches.find(item=>item.published&&item.oneLink&&item.individual&&item.recipients.length===1&&item.recipients[0]===row.userId);
   if(exact)return {materialId:exact.materialId};
   return matches.length?{review:true}:null;
  }
  function ledgerPath(current,row){return 'classroomImports/'+current.uid+'/'+current.courseId+'/deliveries/'+row.userId+'/'+row.passHash;}
  async function inspectRow(current,row,op){
   const base='classroomImports/'+op.uid+'/'+current.courseId;
   const [mapping,meta,binding]=await Promise.all([read(base+'/students/'+row.userId,op),read('classes/'+current.classId+'/profiles/'+row.profileId+'/meta',op),read('passes/'+row.passHash,op)]);
   op.guard();if(mapping?.profileId!==row.profileId||meta?.passHash!==row.passHash||binding?.classId!==current.classId||binding?.profileId!==row.profileId)throw problem('profile-link-changed');
   return validLedger(await read(ledgerPath(current,row),op),row.profileId);
  }
  function statusFor(row,ledger,index){
   const match=materialMatch(index,row);
   if(match?.materialId)return {status:'already-posted',materialId:match.materialId};
   if(match?.review)return {status:'uncertain',code:'recipient-review'};
   if(ledger?.state==='posted')return {status:'uncertain',materialId:ledger.materialId,code:'posted-material-missing'};
   if(['sending','uncertain'].includes(ledger?.state))return {status:'uncertain',code:'delivery-unconfirmed'};
   if(ledger?.state==='claimed'&&ledger.leaseUntil>now())return {status:'busy'};
   return {status:row.link?'ready':'link-unavailable'};
  }
  function publicRow(row){return {userId:row.userId,name:row.name,alias:row.alias,status:row.status,...(row.materialId?{materialId:row.materialId}:{}),...(row.code?{code:row.code}:{})};}
  function resultFor(current){
   const result={ok:true,planId:current.id,courseId:current.courseId,classId:current.classId,rows:current.rows.map(publicRow),ready:0,posted:0,alreadyPosted:0,unavailable:0,failed:0,uncertain:0,busy:0};
   const counts={ready:'ready',posted:'posted','already-posted':'alreadyPosted','link-unavailable':'unavailable','profile-unavailable':'unavailable',failed:'failed',uncertain:'uncertain',busy:'busy'};
   for(const row of current.rows)result[counts[row.status]||'unavailable']++;
   exposed.add(result.rows);return result;
  }
  async function previewPosts(request){
   if(running)return fail('publish-busy');
   clearPlan();serial++;
   try{
    const op=operation();requirePublishing();if(!validId(request?.courseId))throw problem('invalid-course');
    if(!Array.isArray(request.students)||request.students.length>200||!Array.isArray(request.cards||[]))throw problem('invalid-roster');
    if(await options.online()!==true)throw problem('offline');op.guard();
    const ids=new Set(),students=request.students.map(value=>{if(!validId(value?.userId)||ids.has(value.userId))throw problem('invalid-roster');ids.add(value.userId);return {userId:value.userId,name:cleanName(value.name)||'Student'};});
    const cards=new Map();for(const card of request.cards||[]){if(!validId(card?.userId)||!validProfile(card.profileId)||!ids.has(card.userId)||cards.has(card.userId))throw problem('invalid-profile-link');cards.set(card.userId,card);}
    let mapping;
    try{mapping=await read('classroomImports/'+op.uid+'/'+request.courseId,op);}catch(cause){if(/permission[-_ ]denied/i.test((cause?.code||'')+' '+(cause?.message||'')))throw problem('posting-setup-required');throw cause;}
    if(!validProfile(mapping?.classId)||!record(mapping.students))throw problem('roster-required');
    const classMeta=await read('classes/'+mapping.classId+'/meta',op);if(!record(classMeta))throw problem('class-not-found');
    const current={id:randomId(),uid:op.uid,identity:op.key,courseId:request.courseId,classId:mapping.classId,createdAt:now(),rows:[]};
    const index=await materialIndex(op,request.courseId);
    for(const student of students){
     const bound=own(mapping.students,student.userId)?mapping.students[student.userId]:null;
     const row={...student,profileId:bound?.profileId,alias:'No arcade profile',status:'profile-unavailable',link:''};
     if(!validProfile(row.profileId)){current.rows.push(row);continue;}
     const meta=await read('classes/'+current.classId+'/profiles/'+row.profileId+'/meta',op);
     if(!record(meta)||!HASH.test(meta.passHash||'')){current.rows.push(row);continue;}
     const binding=await read('passes/'+meta.passHash,op);
     if(binding?.classId!==current.classId||binding?.profileId!==row.profileId){if(cards.has(student.userId))throw problem('invalid-profile-link');current.rows.push(row);continue;}
     row.alias=typeof meta.alias==='string'?meta.alias.slice(0,160):'Arcade profile';row.passHash=meta.passHash;
     const card=cards.get(student.userId);
     if(card){
      if(card.profileId!==row.profileId)throw problem('invalid-profile-link');
      let parsed;try{parsed=options.parseProfileLink(card.link);}catch{throw problem('invalid-profile-link');}
      if(!parsed?.rawPass||typeof parsed.link!=='string'||await options.hashPass(parsed.rawPass)!==meta.passHash)throw problem('invalid-profile-link');
      op.guard();row.link=parsed.link;
     }
     const ledger=validLedger(mapping.deliveries?.[row.userId]?.[row.passHash],row.profileId);
     Object.assign(row,statusFor(row,ledger,index));row.allowedToPost=row.status==='ready';current.rows.push(row);
    }
    op.guard();plan=current;return resultFor(current);
   }catch(cause){return fail(safeCode(cause,'materials-unavailable'));}
  }
  async function markPosted(current,row,materialId,op){
   const path=ledgerPath(current,row),attempt=randomId();
   const result=await transaction(path,old=>{
    const ledger=validLedger(old,row.profileId);if(ledger?.state==='posted')return undefined;
    return {profileId:row.profileId,attemptId:ledger?.attemptId||attempt,state:'posted',leaseUntil:0,createdAt:ledger?.createdAt??options.serverTimestamp(),updatedAt:options.serverTimestamp(),materialId};
   },op);
   const stored=snapshot(result);return result?.committed||stored?.state==='posted';
  }
  async function claim(current,row,op){
   const attempt=randomId(),path=ledgerPath(current,row),leaseUntil=now()+LEASE_MS;
   const result=await transaction(path,old=>{
    const ledger=validLedger(old,row.profileId);
    if(ledger&&(!(ledger.state==='failed'||ledger.state==='claimed'&&ledger.leaseUntil<=now())))return undefined;
    return {profileId:row.profileId,attemptId:attempt,state:'claimed',leaseUntil,createdAt:ledger?.createdAt??options.serverTimestamp(),updatedAt:options.serverTimestamp()};
   },op);
   const value=snapshot(result);
   return result?.committed&&value?.attemptId===attempt?value:{blocked:value||await read(path,op)};
  }
  async function transition(current,row,lease,next,op,materialId){
   const result=await transaction(ledgerPath(current,row),old=>{
    const ledger=validLedger(old,row.profileId);
    if(!ledger||ledger.attemptId!==lease.attemptId||ledger.state==='posted')return undefined;
    if(next==='sending'&&(ledger.state!=='claimed'||ledger.leaseUntil<=now()))return undefined;
    if(next!=='sending'&&ledger.state!=='sending')return undefined;
    return {profileId:row.profileId,attemptId:ledger.attemptId,state:next,leaseUntil:next==='sending'?ledger.leaseUntil:0,createdAt:ledger.createdAt,updatedAt:options.serverTimestamp(),...(next==='posted'?{materialId}:{})};
   },op);
   const stored=snapshot(result);return result?.committed||next==='posted'&&stored?.state==='posted';
  }
  async function publishPosts(request){
   if(running)return fail('publish-busy');
   if(request?.confirmed!==true)return fail('publish-confirmation-required');
   if(!plan||request.planId!==plan.id)return fail('publish-plan-required');
   const current=plan,owner={};running=owner;
   try{
    const op=operation();if(op.key!==current.identity)throw problem('session-changed');requirePublishing();
    if(now()-current.createdAt>PLAN_MS)throw problem('publish-plan-expired');
    if(await options.online()!==true)throw problem('offline');op.guard();
    const index=await materialIndex(op,current.courseId);let stop=false,setupFailure=false;
    for(const row of current.rows){
     op.guard();if(!row.passHash||!validProfile(row.profileId))continue;
     if(stop){if(row.status==='ready'){row.status='failed';row.code='posting-paused';}continue;}
     let lease=null,dispatched=false;
     try{
      const ledger=await inspectRow(current,row,op),next=statusFor(row,ledger,index);Object.assign(row,next);delete row.code;if(next.code)row.code=next.code;
      if(row.status==='already-posted'){
       try{await markPosted(current,row,row.materialId,op);}catch(cause){if(!op.current())throw cause;}
       continue;
      }
      if(row.status!=='ready')continue;
      if(!row.allowedToPost){row.status='uncertain';row.code='preview-changed';continue;}
      if(await options.online()!==true)throw problem('offline');op.guard();
      lease=await claim(current,row,op);
      if(lease.blocked){Object.assign(row,statusFor(row,validLedger(lease.blocked,row.profileId),index));if(row.status==='ready')row.status='busy';continue;}
      // Persist this before the request. A crash from here onward is uncertain
      // and may only be reconciled against Classroom, never blindly retried.
      if(!await transition(current,row,lease,'sending',op)){row.status='busy';continue;}
      op.guard();
      dispatched=true;
      const response=await options.google.createProfileMaterial({courseId:current.courseId,userId:row.userId,link:row.link,title:'Your Coda Arcade profile · '+row.alias});op.guard();
      if(response?.ok===true&&validId(response.materialId)){
       try{const saved=await transition(current,row,lease,'posted',op,response.materialId);row.status=saved?'posted':'uncertain';row.materialId=response.materialId;}
       catch(cause){if(!op.current())throw cause;row.status='uncertain';row.code='delivery-unconfirmed';}
       if(row.status==='uncertain')stop=true;
      }else{
       const uncertain=response?.uncertain===true||response?.ok!==false;
       row.status=uncertain?'uncertain':'failed';row.code=safeCode(response,'materials-unavailable');
       try{await transition(current,row,lease,uncertain?'uncertain':'failed',op);}catch(cause){if(!op.current())throw cause;}
       if(uncertain||['expired','revoked','oauth-denied','district-blocked','classroom-rate-limited','publish-permission-required','publishing-permission-required','session-changed'].includes(row.code))stop=true;
      }
     }catch(cause){
      if(!op.current())throw cause;
      row.status=dispatched?'uncertain':'failed';row.code=dispatched?'delivery-unconfirmed':safeCode(cause,'materials-unavailable');
      if(dispatched&&lease)try{await transition(current,row,lease,'uncertain',op);}catch(error){if(!op.current())throw error;}
      if(dispatched)stop=true;
      if(['posting-setup-required','offline'].includes(row.code)){stop=true;setupFailure=row.code==='posting-setup-required';}
     }
    }
    op.guard();const result=resultFor(current);if(setupFailure&&!result.posted&&!result.alreadyPosted)return {...result,ok:false,code:'posting-setup-required'};return result;
   }catch(cause){return fail(safeCode(cause,'materials-unavailable'));}
   finally{if(running===owner)running=null;}
  }
  return Object.freeze({previewPosts,publishPosts,clear,destroy(){clear();destroyed=true;},getState:()=>({busy:!!running,hasPlan:!!plan})});
 }
 return Object.freeze({create});
});
