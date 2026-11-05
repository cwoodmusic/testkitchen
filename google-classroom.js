/* Teacher-initiated Classroom access; individual materials need extra consent. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.CodaGoogleClassroom=api;
})(typeof window==='undefined'?null:window,function(root){
 'use strict';
 const SCOPES=Object.freeze([
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly'
 ]);
 const PUBLISH_SCOPE='https://www.googleapis.com/auth/classroom.courseworkmaterials';
 const PUBLISH_SCOPES=Object.freeze([...SCOPES,PUBLISH_SCOPE]);
 const BASE='https://classroom.googleapis.com/v1/';
 const fail=code=>({ok:false,code});
 const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 const label=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().replace(/\s+/g,' ').slice(0,max):'';
 function profileLink(value){
  if(typeof value!=='string'||!value||value.length>2048||/[\u0000-\u0020\u007f]/.test(value))return null;
  try{
   const url=new URL(value),local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
   if(url.username||url.password||url.protocol!=='https:'&&!(local&&url.protocol==='http:'))return null;
   const pass=new URLSearchParams(url.hash.slice(1)).get('classroom-pass');
   return pass&&pass.length<=512?url.href:null;
  }catch{return null;}
 }
 function materialRow(item){
  if(!item||typeof item!=='object'||!identifier(item.id))throw {classroomCode:'classroom-response-invalid'};
  const ids=item.individualStudentsOptions?.studentIds??[],attachments=item.materials??[];
  if(!Array.isArray(ids)||ids.length>500||ids.some(id=>!identifier(id))||!Array.isArray(attachments)||attachments.length>100)throw {classroomCode:'classroom-response-invalid'};
  return {id:item.id,state:label(item.state,32),title:label(item.title,300),assigneeMode:label(item.assigneeMode,64),individualStudentsOptions:{studentIds:[...ids]},materials:attachments.map(attachment=>{
   const url=attachment?.link?.url;
   if(url===undefined)return {};
   if(typeof url!=='string'||url.length>8192)throw {classroomCode:'classroom-response-invalid'};
   return {link:{url}};
  })};
 }
 function apiError(status,value){
  const error=value?.error||{},details=Array.isArray(error.details)?error.details:[],errors=Array.isArray(error.errors)?error.errors:[];
  const reasons=[error.status,...details.map(item=>item?.reason),...errors.map(item=>item?.reason)].filter(item=>typeof item==='string').join(' ');
  const message=typeof error.message==='string'?error.message.toLowerCase():'';
  if(/SERVICE_DISABLED|accessNotConfigured|API_DISABLED/.test(reasons)||/api.*(?:has not been used|is disabled)|enable.*classroom.*api/.test(message))return 'classroom-api-disabled';
  if(/admin_policy_enforced|domainPolicy|DOMAIN_POLICY|ORG_POLICY_VIOLATION|ORG_RESTRICTION|ACCESS_BLOCKED/i.test(reasons)||/blocked by.*(?:admin|organization)|organization.*policy|domain.*policy/.test(message))return 'district-blocked';
  if(/revoked/i.test(reasons+' '+message))return 'revoked';
  if(status===401)return 'expired';
  if(/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/.test(reasons)||/insufficient.*scope/.test(message))return 'oauth-denied';
  if(status===429||/RESOURCE_EXHAUSTED|rateLimitExceeded|quotaExceeded/.test(reasons))return 'classroom-rate-limited';
  return 'roster-unavailable';
 }
 function oauthError(value){
  const code=typeof value?.code==='string'?value.code.replace(/^auth\//,''):'';
  if(['account-mismatch','user-mismatch','credential-already-in-use'].includes(code))return 'account-mismatch';
  if(['admin-policy-enforced','admin_policy_enforced','district-blocked'].includes(code))return 'district-blocked';
  if(['user-token-expired','expired'].includes(code))return 'expired';
  if(['session-changed','closed','admin-required'].includes(code))return code;
  return 'oauth-denied';
 }
 function create(options={}){
  if(typeof options.getSession!=='function'||typeof options.connectGoogle!=='function')throw Error('Classroom access needs a verified teacher session.');
  const fetcher=options.fetch||root?.fetch?.bind(root)||globalThis.fetch?.bind(globalThis),now=options.clock||Date.now;
  const Abort=options.AbortController||root?.AbortController||globalThis.AbortController;
  const setTimer=options.setTimeout||root?.setTimeout?.bind(root)||globalThis.setTimeout,clearTimer=options.clearTimeout||root?.clearTimeout?.bind(root)||globalThis.clearTimeout;
  const requestTimeout=Math.min(30000,Math.max(1,Number(options.requestTimeoutMs)||30000));
  let token='',expiresAt=0,bound='',pending='',serial=0,loading=false,destroyed=false,code='',courseCount=0,studentCount=0,canPublish=false;
  const controllers=new Set(),exposed=new Set();
  function session(){
   try{
    const value=options.getSession();
    if(value?.signedIn!==true||value.authorized!==true||typeof value.uid!=='string'||!value.uid||value.uid.length>128)return null;
    return {uid:value.uid,key:JSON.stringify([value.uid,typeof value.identity==='string'?value.identity:value.uid])};
   }catch{return null;}
  }
  function clearResults(){
   const seen=new Set(),wipe=value=>{if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const key of Object.keys(value)){wipe(value[key]);try{delete value[key];}catch{}}if(Array.isArray(value))try{value.length=0;}catch{}};
   for(const rows of exposed)wipe(rows);
   exposed.clear();courseCount=0;studentCount=0;
  }
  function invalidate(reason=''){
   serial++;token='';expiresAt=0;bound='';pending='';loading=false;canPublish=false;code=reason;
   for(const controller of controllers)controller.abort();controllers.clear();clearResults();
  }
  function check(){
   if(destroyed)return fail('closed');
   const active=session();
   if((bound||pending)&&(!active||(bound||pending)!==active.key)){invalidate('session-changed');return fail('session-changed');}
   if(token&&now()>=expiresAt){invalidate('expired');return fail('expired');}
   return active?{ok:true,session:active}:fail('admin-required');
  }
  function guard(owner,key){return !destroyed&&owner===serial&&session()?.key===key;}
  function connection(){
   const state=check();if(!state.ok)return state;
   return token?state:fail(['expired','revoked','oauth-denied','district-blocked','session-changed'].includes(code)?code:'connect-required');
  }
  function expose(rows){exposed.add(rows);return rows;}
  async function connect(settings={}){
   const state=check();if(!state.ok)return state;if(loading)return fail('busy');
   const publishing=settings?.publish===true;
   if(token&&(!publishing||canPublish))return {ok:true};
   // Call the injected popup bridge before awaiting anything so this remains
   // attached to the teacher's explicit click, not a background sign-in.
   const owner=++serial,key=state.session.key;pending=key;loading=true;code='';
   try{
    const result=await options.connectGoogle({scopes:[...(publishing?PUBLISH_SCOPES:SCOPES)]});
    if(!guard(owner,key)){if(owner===serial)invalidate('session-changed');return fail('session-changed');}
    if(result?.ok===false){code=oauthError(result);return fail(code);}
    if(result?.uid!==state.session.uid){invalidate('account-mismatch');return fail('account-mismatch');}
    if(typeof result.accessToken!=='string'||!result.accessToken||result.accessToken.length>8192||/\s/.test(result.accessToken)){code='oauth-denied';return fail(code);}
    const expiry=Number.isFinite(result.expiresAt)?Math.min(result.expiresAt,now()+55*60*1000):now()+55*60*1000;
    if(expiry<=now()){code='expired';return fail(code);}
    const granted=Array.isArray(result.grantedScopes)?result.grantedScopes:typeof result.grantedScopes==='string'?result.grantedScopes.split(/\s+/):null;
    if(publishing&&granted&&!granted.includes(PUBLISH_SCOPE)){code='publishing-permission-required';return fail(code);}
    token=result.accessToken;expiresAt=expiry;bound=key;canPublish=publishing;return {ok:true};
   }catch(error){
    if(!guard(owner,key)){if(owner===serial)invalidate('session-changed');return fail('session-changed');}
    code=oauthError(error);return fail(code);
   }finally{if(owner===serial){loading=false;pending='';}}
  }
  async function request(path,params,owner,key,settings={}){
   if(!guard(owner,key))throw {classroomCode:'session-changed'};
   if(now()>=expiresAt){invalidate('expired');throw {classroomCode:'expired'};}
   if(typeof fetcher!=='function')throw {classroomCode:'roster-unavailable'};
   const url=new URL(path,BASE);for(const [name,value]of Object.entries(params))if(value){if(Array.isArray(value)){for(const item of value)url.searchParams.append(name,item);}else url.searchParams.set(name,value);}
   const controller=typeof Abort==='function'?new Abort():null;if(controller)controllers.add(controller);
   const writing=settings.method==='POST';let dispatched=false,status=0,timer=null,timedOut=false;
   const uncertain=()=>writing&&dispatched&&!(status>=400&&status<500);
   const deadline=new Promise((_,reject)=>{timer=setTimer(()=>{timedOut=true;controller?.abort();reject({classroomCode:'classroom-timeout',uncertain:uncertain()});},requestTimeout);});
   const aborted=new Promise((_,reject)=>{controller?.signal.addEventListener('abort',()=>reject({classroomCode:timedOut?'classroom-timeout':'session-changed',uncertain:uncertain()}),{once:true});});
   const awaitResponse=promise=>Promise.race([promise,deadline,aborted]);
   try{
    dispatched=true;
    const response=await awaitResponse(fetcher(url.href,{method:writing?'POST':'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json',...(writing?{'Content-Type':'application/json'}:{})},credentials:'omit',cache:'no-store',redirect:'error',...(writing?{body:JSON.stringify(settings.body)}:{}),...(controller?{signal:controller.signal}:{})}));
    status=response.status;
    if(!guard(owner,key))throw {classroomCode:'session-changed'};
    let body;try{body=await awaitResponse(response.json());}catch(error){if(error?.classroomCode)throw error;throw {classroomCode:response.ok?'classroom-response-invalid':apiError(response.status,null)};}
    if(!guard(owner,key))throw {classroomCode:'session-changed'};
    if(!response.ok)throw {classroomCode:apiError(response.status,body)};
    if(!body||typeof body!=='object'||Array.isArray(body))throw {classroomCode:'classroom-response-invalid'};
    if(body.error)throw {classroomCode:apiError(response.status,body)};
    return body;
   }catch(error){throw {classroomCode:error?.classroomCode||(!guard(owner,key)?'session-changed':'roster-unavailable'),...(writing?{uncertain:uncertain()}:{} )};}
   finally{if(timer!==null)clearTimer(timer);if(controller)controllers.delete(controller);}
  }
  async function pages(kind,courseId){
   const state=connection();if(!state.ok)return state;if(loading)return fail('busy');
   const owner=++serial,key=state.session.key;loading=true;pending=key;code='';
   const rows=new Map(),seen=new Set();let pageToken='';
   try{
    for(let page=0;page<100;page++){
     const courses=kind==='courses',body=await request(courses?'courses':'courses/'+encodeURIComponent(courseId)+'/students',courses?{
      teacherId:'me',courseStates:'ACTIVE',pageSize:'100',fields:'nextPageToken,courses(id,name,section)',pageToken
     }:{pageSize:'100',fields:'nextPageToken,students(userId,profile(name(fullName,givenName,familyName)))',pageToken},owner,key);
     const list=body[kind];if(list!==undefined&&!Array.isArray(list))throw {classroomCode:'classroom-response-invalid'};
     for(const item of list||[]){
      const id=courses?item?.id:item?.userId;if(!identifier(id))throw {classroomCode:'classroom-response-invalid'};
      if(rows.has(id))continue;
      if(courses)rows.set(id,{id,name:label(item.name,250)||'Untitled class',section:label(item.section,100)});
      else{const name=item.profile?.name||{};rows.set(id,{userId:id,name:label(name.fullName)||label([name.givenName,name.familyName].filter(value=>typeof value==='string').join(' '))||'Unnamed student'});}
      if(rows.size>(courses?5000:200))throw {classroomCode:courses?'classroom-response-invalid':'roster-too-large'};
     }
     if(body.nextPageToken===undefined||body.nextPageToken===''){
      if(!guard(owner,key))throw {classroomCode:'session-changed'};
      const values=expose([...rows.values()]);if(courses){courseCount=values.length;return {ok:true,courses:values};}
      studentCount=values.length;return {ok:true,courseId,students:values};
     }
     if(typeof body.nextPageToken!=='string'||body.nextPageToken.length>4096||seen.has(body.nextPageToken))throw {classroomCode:'classroom-response-invalid'};
     seen.add(body.nextPageToken);pageToken=body.nextPageToken;
    }
    throw {classroomCode:'classroom-response-invalid'};
   }catch(error){
    const reason=error?.classroomCode||(!guard(owner,key)?'session-changed':'roster-unavailable');
    if(owner===serial){
     if(['expired','revoked','oauth-denied','district-blocked','session-changed'].includes(reason))invalidate(reason);else code=reason;
    }
    return fail(reason);
   }finally{if(owner===serial){loading=false;pending='';}}
  }
  async function listProfileMaterials(courseId){
   if(!identifier(courseId))return fail('invalid-course');
   const state=connection();if(!state.ok)return state;if(loading)return fail('busy');if(!canPublish)return fail('publishing-permission-required');
   const owner=++serial,key=state.session.key;loading=true;pending=key;code='';
   const rows=new Map(),seen=new Set();let pageToken='';
   try{
    for(let page=0;page<100;page++){
     const body=await request('courses/'+encodeURIComponent(courseId)+'/courseWorkMaterials',{
      pageSize:'100',courseWorkMaterialStates:['PUBLISHED','DRAFT','DELETED'],fields:'nextPageToken,courseWorkMaterial(id,state,title,assigneeMode,individualStudentsOptions(studentIds),materials(link(url)))',pageToken
     },owner,key);
     const list=body.courseWorkMaterial;if(list!==undefined&&!Array.isArray(list))throw {classroomCode:'classroom-response-invalid'};
     for(const item of list||[]){const row=materialRow(item);if(!rows.has(row.id))rows.set(row.id,row);if(rows.size>5000)throw {classroomCode:'classroom-response-invalid'};}
     if(body.nextPageToken===undefined||body.nextPageToken===''){
      if(!guard(owner,key))throw {classroomCode:'session-changed'};
      return {ok:true,materials:expose([...rows.values()])};
     }
     if(typeof body.nextPageToken!=='string'||body.nextPageToken.length>4096||seen.has(body.nextPageToken))throw {classroomCode:'classroom-response-invalid'};
     seen.add(body.nextPageToken);pageToken=body.nextPageToken;
    }
    throw {classroomCode:'classroom-response-invalid'};
   }catch(error){
    const reason=error?.classroomCode||(!guard(owner,key)?'session-changed':'materials-unavailable');
    if(owner===serial){
     if(['expired','revoked','district-blocked','session-changed'].includes(reason))invalidate(reason);
     else{code=reason;if(reason==='oauth-denied')canPublish=false;}
    }
    return fail(reason==='roster-unavailable'?'materials-unavailable':reason);
   }finally{if(owner===serial){loading=false;pending='';}}
  }
  async function createProfileMaterial(value){
   const courseId=value?.courseId,userId=value?.userId,link=profileLink(value?.link),title=label(value?.title,300);
   if(!identifier(courseId)||!identifier(userId)||!link||!title)return {...fail('invalid-profile-material'),uncertain:false};
   const state=connection();if(!state.ok)return {...state,uncertain:false};if(loading)return {...fail('busy'),uncertain:false};if(!canPublish)return {...fail('publishing-permission-required'),uncertain:false};
   const owner=++serial,key=state.session.key;loading=true;pending=key;code='';
   const body={title,state:'PUBLISHED',assigneeMode:'INDIVIDUAL_STUDENTS',individualStudentsOptions:{studentIds:[userId]},materials:[{link:{url:link}}]};
   try{
    // This write has no automatic retries. An uncertain result must be checked
    // against Classroom before a teacher can attempt another publication.
    const result=await request('courses/'+encodeURIComponent(courseId)+'/courseWorkMaterials',{fields:'id'},owner,key,{method:'POST',body});
    if(!guard(owner,key))throw {classroomCode:'session-changed',uncertain:true};
    if(!identifier(result.id))throw {classroomCode:'classroom-response-invalid',uncertain:true};
    return {ok:true,materialId:result.id};
   }catch(error){
    const reason=error?.classroomCode||(!guard(owner,key)?'session-changed':'material-publish-failed');
    if(owner===serial){
     if(['expired','revoked','district-blocked','session-changed'].includes(reason))invalidate(reason);
     else{code=reason;if(reason==='oauth-denied')canPublish=false;}
    }
    return {ok:false,code:reason==='roster-unavailable'?'material-publish-failed':reason,uncertain:error?.uncertain===true};
   }finally{if(owner===serial){loading=false;pending='';}}
  }
  return Object.freeze({
   connect,
   listCourses:()=>pages('courses'),
   loadRoster:courseId=>identifier(courseId)?pages('students',courseId):Promise.resolve(fail('invalid-course')),
   listProfileMaterials,
   createProfileMaterial,
   disconnect(){invalidate();return {ok:true};},
   getState(){check();return {connected:!!token,loading,courseCount,studentCount,canPublish,code};},
   destroy(){destroyed=true;invalidate('closed');}
  });
 }
 return Object.freeze({SCOPES,PUBLISH_SCOPE,PUBLISH_SCOPES,create});
});
