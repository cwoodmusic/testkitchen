/* Verified Google developer roles remain separate from classroom staff roles. */
const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const classroom=require('../classroom-service.js');
const OWNERS=['first.owner@example.org','second.owner@example.org'],TAB='developer_tab_1234';
async function digest(email){const result=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('coda-developer-owner:v1:'+email));return Buffer.from(result).toString('hex');}
function storage(seed={}){const map=new Map(Object.entries(seed));return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),map};}
async function fixture({email=OWNERS[0],approved=false,grant=false,emailVerified=true,claimVerified=true,provider='google.com',claimEmail=email,guest=false,denyRoles=false}={}){
 const uid='google_developer_1234',user={uid,email,emailVerified,getIdTokenResult:async()=>({signInProvider:provider,claims:{email:claimEmail,email_verified:claimVerified}})};
 const sessions=storage(guest?{}:{codaClassroomAdminTabV1:JSON.stringify({version:1,tabId:TAB,uid})}),native=storage(),apps=[],calls=[],watchers=new Map(),authWatchers=[];
 const staff={currentUser:guest?null:user},student={currentUser:null},values={'.info/serverTimeOffset':0,['classroomV1/admins/'+uid]:approved};
 const key=String(email||'').trim().toLowerCase().replaceAll('.',',');values['classroomV1/developerAccess/'+key]=grant;
 let sdkLoads=0,holdGet=null;
 const snapshot=value=>({val:()=>value??null});
 const sdk={getApps:()=>apps,initializeApp:(_config,name)=>{const app={name};apps.push(app);return app;},getAuth:app=>app.name==='coda-classroom-admin'?staff:student,getDatabase:app=>({name:app.name}),browserSessionPersistence:'session',setPersistence:async()=>{},ref:(_db,path)=>({path}),
  get:async ref=>{calls.push({kind:'get',path:ref.path});if(holdGet)await holdGet(ref);if(denyRoles&&ref.path.includes('/developerAccess'))throw Error('denied');return snapshot(values[ref.path]);},
  set:async(ref,value)=>{calls.push({kind:'set',path:ref.path,value});values[ref.path]=value;for(const callback of watchers.get(ref.path)||[])callback(snapshot(value));},
  onValue:(ref,callback,error)=>{calls.push({kind:'watch',path:ref.path});if(denyRoles&&ref.path.includes('/developerAccess')){error?.(Error('denied'));return()=>{};}const set=watchers.get(ref.path)||new Set();set.add(callback);watchers.set(ref.path,set);callback(snapshot(values[ref.path]));return()=>set.delete(callback);},
  onAuthStateChanged:(instance,callback)=>{authWatchers.push({instance,callback});return()=>{};},
  signOut:async instance=>{instance.currentUser=null;for(const item of authWatchers)if(item.instance===instance)item.callback(null);}
 };
 const win={location:{hostname:'localhost'},crypto:webcrypto,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},document:{addEventListener(){},removeEventListener(){}}};
 const scope={tabId:TAB,nativeStorage:native,owns:()=>true,subscribe:()=>()=>{},guardedStorage:()=>native};
 const config={firebase:{projectId:'demo-developer-access'},classroom:{enabled:true,namespace:'classroomV1'},developer:{ownerEmailSha256:await Promise.all(OWNERS.map(digest))}};
 const service=classroom.create({window:win,config,dataApi:{},storageScope:scope,storage:native,sessionStorage:sessions,sdkLoader:async()=>{sdkLoads++;return sdk;}});
 return {service,user,staff,sdk,values,calls,key,get sdkLoads(){return sdkLoads;},hold:fn=>{holdGet=fn;},emit:(path,value)=>{values[path]=value;for(const fn of watchers.get(path)||[])fn(snapshot(value));},replaceUser:value=>{staff.currentUser=value;for(const item of authWatchers)if(item.instance===staff)item.callback(value);}};
}
test('both verified owner accounts have developer management without school-admin approval',async()=>{
 for(const email of OWNERS){const f=await fixture({email});await f.service.connect();const state=f.service.getState();assert.equal(state.admin.authorized,false);assert.equal(state.admin.developer,true);assert.equal(state.admin.developerOwner,true);assert.equal(state.admin.signedIn,true);f.service.destroy();}
});
test('school administrators do not become developers without a separate grant',async()=>{
 const f=await fixture({email:'teacher@example.org',approved:true});await f.service.connect();assert.equal(f.service.getState().admin.authorized,true);assert.equal(f.service.getState().admin.developer,false);assert.equal(f.service.getState().admin.developerOwner,false);assert.equal((await f.service.grantDeveloperAccess('other@example.org')).code,'developer-owner-required');assert.equal(f.calls.filter(call=>call.kind==='set').length,0);f.service.destroy();
});
test('verified delegated Google users receive only their own role and revoke immediately',async()=>{
 const f=await fixture({email:'another.teacher@example.org',grant:true});const seen=[];f.service.subscribe(state=>seen.push(state.admin.developer));await f.service.connect();assert.equal(f.service.getState().admin.developer,true);assert.equal(f.service.getState().admin.developerOwner,false);assert.ok(f.calls.filter(call=>call.path.includes('/developerAccess')).every(call=>call.path.endsWith('/'+f.key)));f.emit('classroomV1/developerAccess/'+f.key,null);assert.equal(f.service.getState().admin.developer,false);assert.equal(seen.at(-1),false);f.emit('classroomV1/developerAccess/'+f.key,true);assert.equal(f.service.getState().admin.developer,true);f.service.destroy();
});
test('unverified, non-Google, and mismatched email identities cannot acquire developer access',async()=>{
 for(const opts of [{emailVerified:false},{claimVerified:false},{provider:'password'},{claimEmail:'pretender@example.org'}]){const f=await fixture(opts);await f.service.connect();assert.equal(f.service.getState().admin.developer,false);assert.equal(f.service.getState().admin.developerOwner,false);f.service.destroy();}
});
test('owners list, grant and revoke normalized email entries while both owner identities stay protected',async()=>{
 const f=await fixture();await f.service.connect();f.values['classroomV1/developerAccess']={'class,teacher@example,org':true,'disabled@example,org':false,'invalid/key':true};assert.deepEqual(await f.service.listDeveloperAccess(),{ok:true,developers:[{email:'class.teacher@example.org'}]});assert.deepEqual(await f.service.grantDeveloperAccess(' New.Teacher@Example.org '),{ok:true,email:'new.teacher@example.org'});assert.equal(f.values['classroomV1/developerAccess/new,teacher@example,org'],true);assert.deepEqual(await f.service.revokeDeveloperAccess('new.teacher@example.org'),{ok:true,email:'new.teacher@example.org'});assert.equal(f.values['classroomV1/developerAccess/new,teacher@example,org'],null);for(const owner of OWNERS)assert.equal((await f.service.revokeDeveloperAccess(owner)).code,'developer-owner-protected');assert.equal((await f.service.grantDeveloperAccess('bad/email@example.org')).code,'invalid-developer-email');f.service.destroy();
});
test('role denial preserves ordinary staff privileges and never self-promotes',async()=>{
 const f=await fixture({email:'teacher@example.org',approved:true,denyRoles:true});await f.service.connect();assert.equal(f.service.getState().admin.authorized,true);assert.equal(f.service.getState().admin.developer,false);assert.equal(f.calls.filter(call=>call.kind==='set').length,0);f.service.destroy();
});
test('guest checks do not initialize auth and identity replacement invalidates owner permission',async()=>{
 const guest=await fixture({guest:true});assert.equal(guest.service.getState().admin.developer,false);assert.equal(guest.sdkLoads,0);assert.equal((await guest.service.inspectSession()).signedIn,false);assert.equal(guest.sdkLoads,0);guest.service.destroy();
 const f=await fixture();await f.service.connect();assert.equal(f.service.getState().admin.developerOwner,true);f.replaceUser({uid:'different_user_1234'});assert.equal(f.service.getState().admin.developer,false);assert.equal(f.service.getState().admin.developerOwner,false);f.service.destroy();
});
test('late owner-management responses do not survive sign-out',async()=>{
 const f=await fixture();await f.service.connect();let release;f.hold(async ref=>{if(ref.path==='classroomV1/developerAccess')await new Promise(resolve=>release=resolve);});const pending=f.service.listDeveloperAccess();while(!release)await new Promise(resolve=>setImmediate(resolve));f.replaceUser(null);release();assert.equal((await pending).code,'closed');assert.equal(f.service.getState().admin.developer,false);f.service.destroy();
});
test('refreshing the same owner proof leaves open-editor permission live during delayed management reads',async()=>{
 const f=await fixture();await f.service.connect();const seen=[];f.service.subscribe(state=>seen.push(state.admin.developer));let release;f.hold(async ref=>{if(ref.path==='classroomV1/admins/'+f.user.uid)await new Promise(resolve=>release=resolve);});
 const pending=f.service.listDeveloperAccess();while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal(f.service.getState().admin.developer,true);assert.equal(f.service.getState().admin.developerOwner,true);release();assert.equal((await pending).ok,true);assert.equal(f.service.getState().admin.developer,true);assert.ok(seen.every(Boolean));
 f.user.email='changed@example.org';assert.equal(f.service.getState().admin.developer,false,'A same-UID email change invalidates the old verified role immediately');f.service.destroy();
});
test('an existing grant watcher can revoke access while another proof refresh is awaiting the server',async()=>{
 const f=await fixture({email:'teacher@example.org',grant:true});await f.service.connect();let release;f.hold(async ref=>{if(ref.path==='classroomV1/admins/'+f.user.uid)await new Promise(resolve=>release=resolve);});const pending=f.service.listDeveloperAccess();while(!release)await new Promise(resolve=>setImmediate(resolve));f.emit('classroomV1/developerAccess/'+f.key,null);assert.equal(f.service.getState().admin.developer,false);release();assert.equal((await pending).ok,false);assert.equal(f.service.getState().admin.developer,false);f.service.destroy();
});
