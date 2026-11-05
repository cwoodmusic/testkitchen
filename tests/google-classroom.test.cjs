'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../google-classroom.js');
const UID='teacher_12345678';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function fixture({responses=[],connect,fetch,requestTimeoutMs}={}){
 let now=1000,session={uid:UID,identity:'sign-in-1',signedIn:true,authorized:true};
 const calls=[],oauth=[],queue=[...responses];
 const client=api.create({getSession:()=>session,clock:()=>now,requestTimeoutMs,
  connectGoogle:options=>{oauth.push(options);return connect?connect(options):Promise.resolve({uid:UID,accessToken:'test-only-secret-token',expiresAt:100000});},
  fetch:async(url,options)=>{
   calls.push({url,options});if(fetch)return fetch(url,options);
   const next=queue.shift();if(next instanceof Error)throw next;
   return {ok:(next?.status||200)<400,status:next?.status||200,json:async()=>next?.body||{}};
  }});
 return {client,calls,oauth,queue,setSession:value=>{session=value;},session:()=>session,setNow:value=>{now=value;}};
}
const response=(body,status=200)=>({body,status});

test('only an explicit teacher connect requests the two read-only scopes',async()=>{
 const f=fixture();assert.deepEqual(f.client.getState(),{connected:false,loading:false,courseCount:0,studentCount:0,canPublish:false,code:''});
 assert.equal((await f.client.listCourses()).code,'connect-required');assert.equal((await f.client.loadRoster('123')).code,'connect-required');assert.equal(f.oauth.length,0);
 const pending=f.client.connect();assert.equal(f.oauth.length,1,'The popup starts before any await to retain click activation');
 assert.deepEqual(f.oauth[0],{scopes:[...api.SCOPES]});assert.equal(api.SCOPES.length,2);
 assert.ok(api.SCOPES.every(scope=>scope.endsWith('.readonly')));assert.deepEqual(await pending,{ok:true});
 assert.deepEqual(await f.client.connect(),{ok:true});assert.equal(f.oauth.length,1);f.client.destroy();
});
test('guest, student and unapproved sessions never open Google or call the API',async()=>{
 for(const session of [null,{uid:UID,signedIn:false,authorized:true},{uid:UID,signedIn:true,authorized:false},{uid:'',signedIn:true,authorized:true}]){
  const f=fixture();f.setSession(session);
  assert.equal((await f.client.connect()).code,'admin-required');assert.equal((await f.client.listCourses()).code,'admin-required');
  assert.equal(f.oauth.length,0);assert.equal(f.calls.length,0);f.client.destroy();
 }
});
test('course pagination uses teacher-owned active courses and credential-free fixed-origin GETs',async()=>{
 const f=fixture({responses:[response({courses:[{id:'123',name:'Music 3',section:'Period 1'}],nextPageToken:'next-page'}),response({courses:[{id:'123',name:'Duplicate'},{id:'456',name:'Music 4'}]})]});
 await f.client.connect();const result=await f.client.listCourses();
 assert.deepEqual(result,{ok:true,courses:[{id:'123',name:'Music 3',section:'Period 1'},{id:'456',name:'Music 4',section:''}]});
 assert.equal(f.calls.length,2);
 for(const [index,call]of f.calls.entries()){
  const url=new URL(call.url);assert.equal(url.origin,'https://classroom.googleapis.com');assert.equal(url.pathname,'/v1/courses');
  assert.equal(url.searchParams.get('teacherId'),'me');assert.equal(url.searchParams.get('courseStates'),'ACTIVE');assert.equal(url.searchParams.get('pageSize'),'100');
  assert.equal(url.searchParams.get('fields'),'nextPageToken,courses(id,name,section)');assert.equal(url.searchParams.get('pageToken'),index?'next-page':null);
  assert.equal(call.options.method,'GET');assert.equal(call.options.credentials,'omit');assert.equal(call.options.cache,'no-store');assert.equal(call.options.redirect,'error');
  assert.equal(call.options.headers.Authorization,'Bearer test-only-secret-token');assert.ok(!call.url.includes('secret'));assert.ok(call.options.signal);
 }
 assert.deepEqual(f.client.getState(),{connected:true,loading:false,courseCount:2,studentCount:0,canPublish:false,code:''});
 f.client.disconnect();assert.equal(result.courses.length,0,'Previously exposed previews are cleared on disconnect');
});
test('student pagination returns only stable IDs and bounded display names, never email or photos',async()=>{
 const f=fixture({responses:[response({students:[{userId:'001',profile:{name:{fullName:'  María\n  Music  '},emailAddress:'never-import@example.invalid',photoUrl:'private-photo'}}],nextPageToken:'last'}),response({students:[{userId:'002',profile:{name:{givenName:'Sam',familyName:'Student'}}},{userId:'001',profile:{name:{fullName:'Duplicate'}}}]})]});
 await f.client.connect();const result=await f.client.loadRoster('class_123');
 assert.deepEqual(result,{ok:true,courseId:'class_123',students:[{userId:'001',name:'María Music'},{userId:'002',name:'Sam Student'}]});
 for(const call of f.calls){const url=new URL(call.url);assert.equal(url.pathname,'/v1/courses/class_123/students');assert.equal(url.searchParams.get('fields'),'nextPageToken,students(userId,profile(name(fullName,givenName,familyName)))');assert.ok(!call.url.includes('email'));assert.ok(!call.url.includes('photo'));}
 assert.equal(f.client.getState().studentCount,2);assert.ok(!JSON.stringify(f.client.getState()).includes('María'));assert.ok(!JSON.stringify(f.client.getState()).includes('secret'));
 f.client.disconnect();assert.equal(result.students.length,0);assert.equal(f.client.getState().studentCount,0);
});
test('a roster over 200 students fails rather than silently truncating',async()=>{
 const students=Array.from({length:201},(_,index)=>({userId:String(index+1),profile:{name:{fullName:'Student '+index}}}));
 const f=fixture({responses:[response({students:students.slice(0,100),nextPageToken:'p2'}),response({students:students.slice(100,200),nextPageToken:'p3'}),response({students:students.slice(200)})]});
 await f.client.connect();assert.deepEqual(await f.client.loadRoster('123'),{ok:false,code:'roster-too-large'});assert.equal(f.calls.length,3);assert.equal(f.client.getState().studentCount,0);
});
test('repeated page tokens, malformed records, and invalid course IDs fail safely',async()=>{
 const f=fixture({responses:[response({nextPageToken:'same'}),response({nextPageToken:'same'})]});await f.client.connect();
 assert.equal((await f.client.listCourses()).code,'classroom-response-invalid');assert.equal(f.calls.length,2);
 assert.equal((await f.client.loadRoster('../bad?token=secret')).code,'invalid-course');assert.equal(f.calls.length,2);
 const bad=fixture({responses:[response({students:[{profile:{name:{fullName:'Missing ID'}}}]})]});await bad.client.connect();
 assert.equal((await bad.client.loadRoster('123')).code,'classroom-response-invalid');
});
test('account mismatch, teacher identity changes and revocation discard pending OAuth results',async()=>{
 const mismatch=fixture({connect:async()=>({uid:'other_teacher',accessToken:'test-only-secret'})});assert.equal((await mismatch.client.connect()).code,'account-mismatch');assert.equal(mismatch.client.getState().connected,false);
 for(const change of [state=>({...state,uid:'other_teacher'}),state=>({...state,identity:'sign-in-2'}),state=>({...state,authorized:false})]){
  const gate=deferred(),f=fixture({connect:()=>gate.promise});const pending=f.client.connect();f.setSession(change(f.session()));
  gate.resolve({uid:UID,accessToken:'must-not-survive'});assert.equal((await pending).code,'session-changed');assert.equal(f.client.getState().connected,false);assert.equal(f.calls.length,0);
 }
});
test('identity changes after headers or JSON cannot expose a stale roster',async()=>{
 const gate=deferred(),f=fixture({fetch:()=>gate.promise});await f.client.connect();const pending=f.client.loadRoster('123');
 f.setSession({...f.session(),identity:'new-sign-in'});gate.resolve({ok:true,status:200,json:async()=>({students:[{userId:'001',profile:{name:{fullName:'Private student'}}}]})});
 assert.equal((await pending).code,'session-changed');assert.equal(f.client.getState().connected,false);
 const body=deferred(),g=fixture({fetch:async()=>({ok:true,status:200,json:()=>body.promise})});await g.client.connect();const jsonPending=g.client.loadRoster('123');await Promise.resolve();await Promise.resolve();
 g.setSession({...g.session(),authorized:false});body.resolve({students:[{userId:'001',profile:{name:{fullName:'Private student'}}}]});
 assert.equal((await jsonPending).code,'session-changed');assert.equal(g.client.getState().studentCount,0);
});
test('disconnect aborts in-flight requests and erases previously returned names',async()=>{
 const f=fixture({responses:[response({students:[{userId:'001',profile:{name:{fullName:'Private student'}}}]})]});await f.client.connect();const preview=await f.client.loadRoster('123');const original=preview.students[0];
 f.queue.push(response({}));const pending=f.client.listCourses();const signal=f.calls.at(-1).options.signal;f.client.disconnect();
 assert.equal(signal.aborted,true);assert.equal((await pending).code,'session-changed');assert.deepEqual(original,{});assert.equal(preview.students.length,0);assert.equal(f.client.getState().connected,false);
});
test('expired tokens require an explicit reconnect and never leave old previews',async()=>{
 const f=fixture({responses:[response({courses:[{id:'123',name:'Private course'}]})]});await f.client.connect();const courses=await f.client.listCourses();f.setNow(100000);
 assert.equal((await f.client.listCourses()).code,'expired');assert.equal(courses.courses.length,0);assert.equal(f.calls.length,1);assert.equal(f.oauth.length,1);
 f.setNow(1000);assert.equal((await f.client.connect()).ok,true);assert.equal(f.oauth.length,2);
});
test('Google failures produce bounded friendly codes without leaking backend messages',async()=>{
 const cases=[
  [401,{error:{message:'PRIVATE access token secret'}},'expired'],
  [401,{error:{message:'Token was revoked PRIVATE'}},'revoked'],
  [403,{error:{details:[{reason:'SERVICE_DISABLED'}],message:'PRIVATE project metadata'}},'classroom-api-disabled'],
  [403,{error:{errors:[{reason:'accessNotConfigured'}]}},'classroom-api-disabled'],
  [403,{error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}},'oauth-denied'],
  [403,{error:{errors:[{reason:'domainPolicy'}]}},'district-blocked'],
  [403,{error:{message:'PRIVATE student permission denied'}},'roster-unavailable'],
  [429,{error:{status:'RESOURCE_EXHAUSTED'}},'classroom-rate-limited']
 ];
 for(const [status,body,code]of cases){const f=fixture({responses:[response(body,status)]});await f.client.connect();assert.deepEqual(await f.client.listCourses(),{ok:false,code});assert.ok(!JSON.stringify(f.client.getState()).includes('PRIVATE'));}
 const popup=fixture({connect:async()=>{throw {code:'auth/popup-closed-by-user',message:'PRIVATE'};}});assert.deepEqual(await popup.client.connect(),{ok:false,code:'oauth-denied'});
});
test('concurrent operations are rejected and destruction permanently disables access',async()=>{
 const gate=deferred(),f=fixture({fetch:()=>gate.promise});await f.client.connect();const pending=f.client.listCourses();
 assert.equal((await f.client.loadRoster('123')).code,'busy');assert.equal((await f.client.connect()).code,'busy');assert.equal(f.calls.length,1);
 f.client.destroy();assert.equal(f.calls[0].options.signal.aborted,true);gate.resolve({ok:true,status:200,json:async()=>({courses:[]})});assert.equal((await pending).code,'session-changed');assert.equal((await f.client.connect()).code,'closed');
});
test('disconnect still clears credentials if a caller has frozen a returned preview',async()=>{
 const f=fixture({responses:[response({courses:[{id:'123',name:'Class'}]})]});await f.client.connect();const result=await f.client.listCourses();Object.freeze(result.courses[0]);Object.freeze(result.courses);
 assert.doesNotThrow(()=>f.client.disconnect());assert.equal(f.client.getState().connected,false);assert.equal((await f.client.listCourses()).code,'connect-required');
});
const PRIVATE_LINK='https://www.coda-arcade.com/world-preview.html#classroom-pass=CODA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AA';
const publication=extra=>({courseId:'course_123',userId:'student_456',link:PRIVATE_LINK,title:'Your Coda Arcade card',...extra});
test('publishing permission is a separate explicit incremental consent and preserves roster previews',async()=>{
 const f=fixture({responses:[response({students:[{userId:'001',profile:{name:{fullName:'Private student'}}}]})],connect:async({scopes})=>({uid:UID,accessToken:scopes.includes(api.PUBLISH_SCOPE)?'write-token':'read-token',grantedScopes:scopes})});
 await f.client.connect();const preview=await f.client.loadRoster('course_123');
 assert.equal(f.client.getState().canPublish,false);
 assert.deepEqual(await f.client.createProfileMaterial(publication()),{ok:false,code:'publishing-permission-required',uncertain:false});assert.equal(f.calls.length,1);
 assert.equal((await f.client.listProfileMaterials('course_123')).code,'publishing-permission-required');
 const upgrade=f.client.connect({publish:true});assert.equal(f.oauth.length,2,'Incremental popup starts synchronously from the explicit click');assert.deepEqual(f.oauth[1].scopes,[...api.SCOPES,api.PUBLISH_SCOPE]);
 assert.deepEqual(await upgrade,{ok:true});assert.equal(f.client.getState().canPublish,true);assert.equal(preview.students[0].name,'Private student');
 await f.client.connect();await f.client.connect({publish:true});assert.equal(f.oauth.length,2);assert.ok(!JSON.stringify(f.client.getState()).includes('write-token'));
});
test('cancelled or withheld write grants preserve the existing read connection and previews',async()=>{
 for(const result of ['cancel','withhold']){
  let count=0;const f=fixture({responses:[response({courses:[{id:'123',name:'Existing class'}]}),response({courses:[]})],connect:async({scopes})=>{
   if(++count===1)return {uid:UID,accessToken:'original-read-token'};
   if(result==='cancel')throw {code:'auth/popup-closed-by-user'};
   return {uid:UID,accessToken:'new-but-not-write-token',grantedScopes:[...api.SCOPES]};
  }});
  await f.client.connect();const preview=await f.client.listCourses();
  assert.equal((await f.client.connect({publish:true})).code,result==='cancel'?'oauth-denied':'publishing-permission-required');
  assert.equal(f.client.getState().connected,true);assert.equal(f.client.getState().canPublish,false);assert.equal(preview.courses[0].name,'Existing class');
  assert.equal((await f.client.listCourses()).ok,true);assert.equal(f.calls[1].options.headers.Authorization,'Bearer original-read-token');
 }
});
test('material listing uses the singular Google response field, scans all states and preserves attachment counts',async()=>{
 const f=fixture({responses:[response({courseWorkMaterial:[{id:'material_1',state:'PUBLISHED',title:'Card',assigneeMode:'INDIVIDUAL_STUDENTS',individualStudentsOptions:{studentIds:['student_456']},materials:[{link:{url:PRIVATE_LINK}},{driveFile:{id:'not-requested'}}]}],nextPageToken:'p2'}),response({courseWorkMaterial:[{id:'material_2',state:'DRAFT',title:'Draft',assigneeMode:'ALL_STUDENTS',materials:[]}]})]});
 await f.client.connect({publish:true});const result=await f.client.listProfileMaterials('course_123');
 assert.equal(result.ok,true);assert.equal(result.materials.length,2);assert.deepEqual(result.materials[0].materials,[{link:{url:PRIVATE_LINK}},{}]);assert.equal(result.materials[1].state,'DRAFT');
 assert.deepEqual(result.materials[1].individualStudentsOptions,{studentIds:[]});
 for(const call of f.calls){const url=new URL(call.url);assert.equal(url.pathname,'/v1/courses/course_123/courseWorkMaterials');assert.deepEqual(url.searchParams.getAll('courseWorkMaterialStates'),['PUBLISHED','DRAFT','DELETED']);assert.equal(call.options.method,'GET');assert.ok(url.searchParams.get('fields').includes('courseWorkMaterial('));assert.ok(!call.url.includes('CODA-'));}
 assert.ok(!JSON.stringify(f.client.getState()).includes('material_1'));assert.ok(!JSON.stringify(f.client.getState()).includes('classroom-pass'));
 const link=result.materials[0].materials[0].link;f.client.disconnect();assert.deepEqual(link,{});assert.equal(result.materials.length,0);assert.equal(f.client.getState().canPublish,false);
});
test('material creation always posts one individual student and one link regardless of caller extras',async()=>{
 const f=fixture({responses:[response({id:'material_created'},201)]});await f.client.connect({publish:true});
 const result=await f.client.createProfileMaterial(publication({assigneeMode:'ALL_STUDENTS',individualStudentsOptions:{studentIds:['other','students']},state:'DRAFT',materials:[{link:{url:'https://unrelated.invalid'}}]}));
 assert.deepEqual(result,{ok:true,materialId:'material_created'});assert.equal(f.calls.length,1);
 const call=f.calls[0],url=new URL(call.url);assert.equal(url.origin,'https://classroom.googleapis.com');assert.equal(url.pathname,'/v1/courses/course_123/courseWorkMaterials');assert.equal(url.searchParams.get('fields'),'id');
 assert.equal(call.options.method,'POST');assert.equal(call.options.headers['Content-Type'],'application/json');assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');
 assert.deepEqual(JSON.parse(call.options.body),{title:'Your Coda Arcade card',state:'PUBLISHED',assigneeMode:'INDIVIDUAL_STUDENTS',individualStudentsOptions:{studentIds:['student_456']},materials:[{link:{url:PRIVATE_LINK}}]});
});
test('invalid recipients and private profile URLs fail before any POST',async()=>{
 const f=fixture();await f.client.connect({publish:true});
 for(const value of [publication({userId:['001','002']}),publication({userId:'../student'}),publication({courseId:'course/bad'}),publication({link:'javascript:alert(1)'}),publication({link:'https://school.example/no-private-pass'}),publication({link:'https://user:password@school.example/#classroom-pass=private'}),publication({title:''})]){
  assert.deepEqual(await f.client.createProfileMaterial(value),{ok:false,code:'invalid-profile-material',uncertain:false});
 }
 assert.equal(f.calls.length,0);
});
test('withheld granular material permission disables publishing while retaining the read connection',async()=>{
 const f=fixture({responses:[response({students:[{userId:'001',profile:{name:{fullName:'Private student'}}}]}),response({error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}},403)]});
 await f.client.connect();const preview=await f.client.loadRoster('course_123');await f.client.connect({publish:true});
 assert.equal((await f.client.listProfileMaterials('course_123')).code,'oauth-denied');assert.equal(f.client.getState().canPublish,false);assert.equal(f.client.getState().connected,true);assert.equal(preview.students[0].name,'Private student');
});
test('authoritative material HTTP failures are definitive and are never retried automatically',async()=>{
 for(const [status,body,code]of [[400,{error:{message:'PRIVATE backend'}},'material-publish-failed'],[401,{error:{}},'expired'],[403,{error:{details:[{reason:'ACCESS_TOKEN_SCOPE_INSUFFICIENT'}]}},'oauth-denied'],[429,{error:{}},'classroom-rate-limited']]){
  const f=fixture({responses:[response(body,status)]});await f.client.connect({publish:true});
  assert.deepEqual(await f.client.createProfileMaterial(publication()),{ok:false,code,uncertain:false});assert.equal(f.calls.length,1);assert.ok(!JSON.stringify(f.client.getState()).includes('PRIVATE'));
  if(status===403){assert.equal(f.client.getState().connected,true);assert.equal(f.client.getState().canPublish,false);}
 }
});
test('network, server and malformed material success responses are uncertain with no automatic retry',async()=>{
 for(const next of [new TypeError('PRIVATE network failure'),response({error:{message:'PRIVATE server'}},500),response({},201)]){
  const f=fixture({responses:[next]});await f.client.connect({publish:true});const result=await f.client.createProfileMaterial(publication());
  assert.equal(result.ok,false);assert.equal(result.uncertain,true);assert.equal(f.calls.length,1);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 }
 const f=fixture({fetch:async()=>({ok:true,status:201,json:async()=>{throw Error('PRIVATE body')}})});await f.client.connect({publish:true});assert.equal((await f.client.createProfileMaterial(publication())).uncertain,true);assert.equal(f.calls.length,1);
});
test('disconnect after dispatch makes the material outcome uncertain and clears publishing permission',async()=>{
 const f=fixture({fetch:()=>new Promise(()=>{})});await f.client.connect({publish:true});const pending=f.client.createProfileMaterial(publication());
 assert.equal(f.calls.length,1);f.client.disconnect();assert.deepEqual(await pending,{ok:false,code:'session-changed',uncertain:true});assert.equal(f.calls[0].options.signal.aborted,true);assert.equal(f.client.getState().canPublish,false);
});
test('material request timeout aborts a hung POST within the configured bound without retry',async()=>{
 const f=fixture({requestTimeoutMs:10,fetch:()=>new Promise(()=>{})});await f.client.connect({publish:true});
 assert.deepEqual(await f.client.createProfileMaterial(publication()),{ok:false,code:'classroom-timeout',uncertain:true});assert.equal(f.calls.length,1);assert.equal(f.calls[0].options.signal.aborted,true);
});
