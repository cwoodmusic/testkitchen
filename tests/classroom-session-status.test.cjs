const test=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const classroom=require('../classroom-service.js');
const TAB='tab_current_1234',UID='teacher_12345678',ACTIVE='codaClassroomActiveV1',ADMIN='codaClassroomAdminTabV1';
function storage(seed={}){const values=new Map(Object.entries(seed)),writes=[];return {values,writes,getItem:key=>values.get(key)??null,setItem(key,value){writes.push([key,value]);values.set(key,String(value));},removeItem(key){writes.push([key,null]);values.delete(key);}};}
function fixture({teacher=true,profile=false,approved=true,student=false,expired=false,tabId=TAB}={}){
 const marker=profile?{version:1,tabId:TAB,epoch:'epoch_current_1234',classId:student?'class_12345678':'teacher_personal',profileId:student?'profile_12345678':UID}:null;
 const sessions=storage({...teacher?{[ADMIN]:JSON.stringify({version:1,tabId:TAB,uid:UID})}:{},...marker?{[ACTIVE]:JSON.stringify(marker)}:{}}),native=storage({musicArcadeV1:'unchanged player'}),calls=[],timers=[];
 const user=uid=>({uid,getIdTokenResult:async()=>({signInProvider:'google.com'})}),apps=[],staff={currentUser:teacher&&!expired?user(UID):null,authStateReady:async()=>calls.push('staff-ready')},auth={currentUser:student?user('anonymous_12345678'):null,authStateReady:async()=>calls.push('student-ready')};
 const record={classId:'class_12345678',profileId:'profile_12345678',passHash:'a'.repeat(64)};
 const values={'.info/serverTimeOffset':0,['classroomV1/admins/'+UID]:approved,['classroomV1/teacherPlayers/'+UID+'/meta']:{alias:'Teacher saved alias'},['classroomV1/sessions/anonymous_12345678']:record,['classroomV1/classes/'+record.classId+'/profiles/'+record.profileId+'/meta']:{alias:'Amber Fox 14',passHash:record.passHash}};
 const snapshot=value=>({val:()=>value});
 const sdk={getApps:()=>apps,initializeApp:(_config,name)=>{const app={name};apps.push(app);return app;},getAuth:app=>app.name==='coda-classroom-admin'?staff:auth,getDatabase:app=>({name:app.name}),browserSessionPersistence:'session',setPersistence:async()=>{},ref:(_db,path)=>({path}),get:async ref=>{calls.push(ref.path);return snapshot(values[ref.path]??null);},signOut:async instance=>{calls.push('sign-out');instance.currentUser=null;},onValue:(ref,fn)=>{calls.push('watch:'+ref.path);queueMicrotask(()=>fn(snapshot(values[ref.path])));return()=>{};},onAuthStateChanged:()=>()=>{}};
 const win={location:{hostname:'localhost'},crypto:webcrypto,setInterval:(fn,delay)=>{timers.push({fn,delay});return timers.length;},clearInterval(){},addEventListener(){},removeEventListener(){},document:{addEventListener(){},removeEventListener(){}}};
 const scope={tabId,nativeStorage:native,owns:()=>!!marker&&tabId===marker.tabId,subscribe:()=>()=>{},guardedStorage:()=>native};
 let loads=0;
 const service=classroom.create({window:win,config:{firebase:{projectId:'demo-session-status'},classroom:{enabled:true,namespace:'classroomV1'}},storageScope:scope,storage:native,sessionStorage:sessions,dataApi:{},sdkLoader:async()=>{loads++;return sdk;}});
 return {service,sessions,native,calls,values,staff,auth,timers,get loads(){return loads;}};
}
test('saved-session hint is tab-bound, bounded and never exposes aliases or tokens',()=>{
 const f=fixture({profile:true});assert.deepEqual(classroom.readSavedSession(f.sessions,TAB),{teacher:true,profile:true,kind:'teacher'});
 assert.deepEqual(classroom.readSavedSession(f.sessions,'different_tab_1234'),{teacher:false,profile:false,kind:null});
 assert.deepEqual(classroom.readSavedSession(storage({[ADMIN]:'bad JSON'}),TAB),{teacher:false,profile:false,kind:null});
 f.sessions.values.set(ADMIN,JSON.stringify({version:1,tabId:TAB,uid:'<script>'}));f.sessions.values.delete(ACTIVE);assert.equal(classroom.readSavedSession(f.sessions,TAB).teacher,false);
});
test('a guest or copied-tab binding checks status without loading Firebase or writing storage',async()=>{
 for(const options of [{teacher:false},{teacher:true,profile:true,tabId:'fresh_tab_123456'}]){const f=fixture(options),state=await f.service.inspectSession();assert.equal(state.signedIn,false);assert.equal(f.loads,0);assert.deepEqual(f.native.writes,[]);assert.deepEqual(f.sessions.writes,[]);f.service.destroy();}
});
test('verified teacher status waits for real authentication and reads only allowlist and player metadata',async()=>{
 const f=fixture({profile:true}),state=await f.service.inspectSession();assert.deepEqual(state,{ok:true,signedIn:true,kind:'teacher',alias:'Teacher saved alias',profileAvailable:true,authorized:true});
 assert.equal(f.service.getState().profile,null,'Status does not open or replace the live player');
 assert.ok(f.calls.includes('staff-ready'));assert.ok(f.calls.includes('classroomV1/teacherPlayers/'+UID+'/meta'));
 assert.ok(!f.calls.some(path=>path.endsWith('/state')||path.includes('/lease')));assert.deepEqual(f.native.writes,[]);assert.deepEqual(f.sessions.writes,[]);f.service.destroy();
});
test('expired authentication and revoked administrators cannot report approved personal profiles',async()=>{
 const expired=fixture({expired:true});assert.equal((await expired.service.inspectSession()).signedIn,false);assert.deepEqual(expired.native.writes,[]);expired.service.destroy();
 const revoked=fixture({approved:false}),state=await revoked.service.inspectSession();assert.equal(state.signedIn,true);assert.equal(state.authorized,false);assert.equal(state.profileAvailable,false);assert.equal(state.alias,'');assert.ok(!revoked.calls.some(path=>path.includes('teacherPlayers/')));revoked.service.destroy();
});
test('student status verifies the current binding and pass before returning its alias without opening progress',async()=>{
 const f=fixture({teacher:false,profile:true,student:true}),state=await f.service.inspectSession();assert.deepEqual(state,{ok:true,signedIn:true,kind:'student',alias:'Amber Fox 14',profileAvailable:true,authorized:false});assert.equal(f.service.getState().profile,null);assert.deepEqual(f.native.writes,[]);assert.deepEqual(f.sessions.writes,[]);f.service.destroy();
 const stale=fixture({teacher:false,profile:true,student:true});stale.values['classroomV1/sessions/anonymous_12345678'].profileId='different_profile';const other=await stale.service.inspectSession();assert.equal(other.signedIn,false);assert.equal(other.code,'profile-mismatch');assert.ok(!stale.calls.some(path=>path.endsWith('/meta')));stale.service.destroy();
});
