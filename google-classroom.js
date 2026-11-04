/* Teacher-initiated, read-only Google Classroom access. Tokens stay in memory. */
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
 const BASE='https://classroom.googleapis.com/v1/';
 const fail=code=>({ok:false,code});
 const identifier=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
 const label=(value,max=200)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').trim().replace(/\s+/g,' ').slice(0,max):'';
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
  let token='',expiresAt=0,bound='',pending='',serial=0,loading=false,destroyed=false,code='',courseCount=0,studentCount=0;
  const controllers=new Set(),exposed=new Set();
  function session(){
   try{
    const value=options.getSession();
    if(value?.signedIn!==true||value.authorized!==true||typeof value.uid!=='string'||!value.uid||value.uid.length>128)return null;
    return {uid:value.uid,key:JSON.stringify([value.uid,typeof value.identity==='string'?value.identity:value.uid])};
   }catch{return null;}
  }
  function clearResults(){
   for(const rows of exposed){
    for(const row of rows)for(const key of Object.keys(row))try{delete row[key];}catch{}
    try{rows.length=0;}catch{}
   }
   exposed.clear();courseCount=0;studentCount=0;
  }
  function invalidate(reason=''){
   serial++;token='';expiresAt=0;bound='';pending='';loading=false;code=reason;
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
  async function connect(){
   const state=check();if(!state.ok)return state;if(loading)return fail('busy');
   if(token)return {ok:true};
   // Call the injected popup bridge before awaiting anything so this remains
   // attached to the teacher's explicit click, not a background sign-in.
   const owner=++serial,key=state.session.key;pending=key;loading=true;code='';
   try{
    const result=await options.connectGoogle({scopes:[...SCOPES]});
    if(!guard(owner,key)){if(owner===serial)invalidate('session-changed');return fail('session-changed');}
    if(result?.ok===false){code=oauthError(result);return fail(code);}
    if(result?.uid!==state.session.uid){invalidate('account-mismatch');return fail('account-mismatch');}
    if(typeof result.accessToken!=='string'||!result.accessToken||result.accessToken.length>8192||/\s/.test(result.accessToken)){code='oauth-denied';return fail(code);}
    const expiry=Number.isFinite(result.expiresAt)?Math.min(result.expiresAt,now()+55*60*1000):now()+55*60*1000;
    if(expiry<=now()){code='expired';return fail(code);}
    token=result.accessToken;expiresAt=expiry;bound=key;return {ok:true};
   }catch(error){
    if(!guard(owner,key)){if(owner===serial)invalidate('session-changed');return fail('session-changed');}
    code=oauthError(error);return fail(code);
   }finally{if(owner===serial){loading=false;pending='';}}
  }
  async function request(path,params,owner,key){
   if(!guard(owner,key))throw {classroomCode:'session-changed'};
   if(now()>=expiresAt){invalidate('expired');throw {classroomCode:'expired'};}
   if(typeof fetcher!=='function')throw {classroomCode:'roster-unavailable'};
   const url=new URL(path,BASE);for(const [name,value]of Object.entries(params))if(value)url.searchParams.set(name,value);
   const controller=typeof Abort==='function'?new Abort():null;if(controller)controllers.add(controller);
   try{
    const response=await fetcher(url.href,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},credentials:'omit',cache:'no-store',redirect:'error',...(controller?{signal:controller.signal}:{})});
    if(!guard(owner,key))throw {classroomCode:'session-changed'};
    let body;try{body=await response.json();}catch{throw {classroomCode:response.ok?'classroom-response-invalid':apiError(response.status,null)};}
    if(!guard(owner,key))throw {classroomCode:'session-changed'};
    if(!response.ok)throw {classroomCode:apiError(response.status,body)};
    if(!body||typeof body!=='object'||Array.isArray(body))throw {classroomCode:'classroom-response-invalid'};
    if(body.error)throw {classroomCode:apiError(response.status,body)};
    return body;
   }finally{if(controller)controllers.delete(controller);}
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
  return Object.freeze({
   connect,
   listCourses:()=>pages('courses'),
   loadRoster:courseId=>identifier(courseId)?pages('students',courseId):Promise.resolve(fail('invalid-course')),
   disconnect(){invalidate();return {ok:true};},
   getState(){check();return {connected:!!token,loading,courseCount,studentCount,code};},
   destroy(){destroyed=true;invalidate('closed');}
  });
 }
 return Object.freeze({SCOPES,create});
});
