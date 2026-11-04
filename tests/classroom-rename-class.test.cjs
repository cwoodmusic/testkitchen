'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const classroom=require('../classroom-service.js'),data=require('../classroom-profile-data.js');
const CLASS='class_fixture_0001',PROFILE='profile_fixture_0001',UID='teacher_fixture_0001';
const clone=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
const read=(tree,path)=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],tree)??null;
function write(tree,path,value){const keys=path.split('/').filter(Boolean),last=keys.pop();let node=tree;for(const key of keys)node=node[key]??={};if(value===null)delete node[last];else node[last]=clone(value);}
function snapshot(value){return {val:()=>clone(value),child:path=>snapshot(read(value,path)),forEach:fn=>{for(const [key,item]of Object.entries(value||{}))fn({key,...snapshot(item)});}};}
function storage(){const values=new Map();return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}
async function fixture({approved=true}={}){
 const meta={ownerUid:UID,label:'Blue class',createdAt:1000},profileMeta={alias:'Blue Owl 27',picture:'owl',createdAt:1000,passHash:'a'.repeat(64)};
 const tree={'.info':{serverTimeOffset:0,connected:true},classroomV1:{admins:{[UID]:approved},classes:{[CLASS]:{meta:clone(meta),profiles:{[PROFILE]:{meta:profileMeta,state:{schemaVersion:1,revision:1,updatedAt:1000,data:data.blank()}}}}},directory:{[CLASS]:{meta:clone(meta),profiles:{[PROFILE]:{alias:profileMeta.alias,picture:'owl'}}}},passes:{keep:{classId:CLASS,profileId:PROFILE}},sessions:{keep:{classId:CLASS,profileId:PROFILE}},hallOfFame:{classes:{[CLASS]:{best:42}}}}};
 const calls=[],apps=[],auths=new Map(),watchers=[],authWatchers=[],controls={beforeGet:null,rejectUpdate:false},native=storage(),session=storage();
 const notify=path=>{for(const watcher of watchers)if(watcher.path===path)watcher.callback(snapshot(read(tree,path)));};
 const sdk={
  getApps:()=>apps,initializeApp:(_config,name)=>{const app={name};apps.push(app);return app;},
  getAuth:app=>{if(!auths.has(app.name))auths.set(app.name,{currentUser:null});return auths.get(app.name);},getDatabase:app=>({name:app.name}),
  setPersistence:async()=>{},browserSessionPersistence:'session',ref:(database,path)=>({database,path}),
  GoogleAuthProvider:class{setCustomParameters(){}},
  signInWithPopup:async auth=>{auth.currentUser={uid:UID,getIdTokenResult:async()=>({signInProvider:'google.com'})};return {user:auth.currentUser};},
  signInAnonymously:async auth=>{auth.currentUser={uid:'student_fixture_0001'};return {user:auth.currentUser};},
  signOut:async auth=>{auth.currentUser=null;for(const watcher of authWatchers)if(watcher.auth===auth)watcher.callback(null);},
  onAuthStateChanged:(auth,callback)=>{const watcher={auth,callback};authWatchers.push(watcher);return()=>authWatchers.splice(authWatchers.indexOf(watcher),1);},
  get:async ref=>{calls.push({kind:'get',path:ref.path});if(controls.beforeGet)await controls.beforeGet(ref);return snapshot(read(tree,ref.path));},
  onValue:(ref,callback)=>{const watcher={path:ref.path,callback};watchers.push(watcher);if(ref.path==='.info/connected'&&controls.holdConnection)controls.connectionEntered?.();else callback(snapshot(read(tree,ref.path)));return()=>{const index=watchers.indexOf(watcher);if(index>=0)watchers.splice(index,1);};},
  serverTimestamp:()=>10000,
  set:async(ref,value)=>{calls.push({kind:'set',path:ref.path,value:clone(value)});write(tree,ref.path,value);notify(ref.path);},
  update:async(ref,changes)=>{calls.push({kind:'update',path:ref.path,changes:clone(changes)});if(controls.rejectUpdate)throw Error('PERMISSION_DENIED');for(const [key,value]of Object.entries(changes))write(tree,ref.path+'/'+key,value);},
  runTransaction:async(ref,updater)=>{const next=updater(clone(read(tree,ref.path)));if(next===undefined)return {committed:false,snapshot:snapshot(read(tree,ref.path))};write(tree,ref.path,next);return {committed:true,snapshot:snapshot(next)};}
 };
 const window={crypto,location:{hostname:'localhost'},localStorage:native,sessionStorage:session,setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},document:{addEventListener(){},removeEventListener(){},visibilityState:'visible'}};
 const service=classroom.create({window,crypto,dataApi:data,storage:native,sessionStorage:session,config:{firebase:{projectId:'demo-rename-class'},classroom:{enabled:true,namespace:'classroomV1'}},sdkLoader:async()=>sdk});
 return {service,tree,calls,controls,sdk,auths,watchers,notify,write:(path,value)=>{write(tree,path,value);notify(path);},writes:()=>calls.filter(call=>['set','update'].includes(call.kind)),signIn:()=>service.adminSignIn()};
}
function pausedRead(f){let entered,release;const ready=new Promise(resolve=>entered=resolve),held=new Promise(resolve=>release=resolve);f.controls.beforeGet=ref=>{if(ref.path===`classroomV1/classes/${CLASS}/meta`){entered();return held;}};return {ready,release};}
test('rename atomically changes only the two label leaves and preserves every linked record',async()=>{
 const f=await fixture();assert.equal((await f.signIn()).ok,true);const before=clone(f.tree);f.calls.length=0;
 assert.deepEqual(await f.service.renameClass(CLASS,'  Grade 3 - Music  '),{ok:true,classId:CLASS,label:'Grade 3 - Music'});
 const writes=f.writes();assert.deepEqual(writes,[{kind:'update',path:'classroomV1',changes:{[`classes/${CLASS}/meta/label`]:'Grade 3 - Music',[`directory/${CLASS}/meta/label`]:'Grade 3 - Music'}}]);
 before.classroomV1.classes[CLASS].meta.label='Grade 3 - Music';before.classroomV1.directory[CLASS].meta.label='Grade 3 - Music';assert.deepEqual(f.tree,before);
 assert.equal((await f.service.listClasses()).classes[0].label,'Grade 3 - Music');f.service.destroy();
});
test('invalid class IDs and labels never write, while both bounds are accepted',async()=>{
 const f=await fixture();await f.signIn();f.calls.length=0;
 for(const value of ['',null,{},' '.repeat(4),'A'.repeat(41),'Music/Class','Blue\nClass','Blue.class','🎵'])assert.equal((await f.service.renameClass(CLASS,value)).code,'invalid-class-label');
 for(const id of ['',null,'../classes','short'])assert.equal((await f.service.renameClass(id,'Valid class')).code,'invalid-class');
 assert.equal(f.writes().length,0);for(const value of ['A','A'.repeat(40)])assert.equal((await f.service.renameClass(CLASS,value)).ok,true);f.service.destroy();
});
test('guests, anonymous students and unapproved Google accounts cannot rename classes',async()=>{
 for(const kind of ['guest','student','unapproved']){
  const f=await fixture({approved:kind!=='unapproved'});await f.service.connect();
  if(kind==='student')f.auths.get('coda-classroom').currentUser={uid:'student_fixture_0001'};
  if(kind==='unapproved')await f.signIn();f.calls.length=0;
  assert.equal((await f.service.renameClass(CLASS,'Blocked class')).ok,false);assert.equal(f.writes().length,0);f.service.destroy();
 }
});
test('missing or incomplete class metadata is never created by renaming',async()=>{
 for(const side of ['classes','directory']){
  const f=await fixture();await f.signIn();f.write(`classroomV1/${side}/${CLASS}/meta`,null);f.calls.length=0;
  assert.equal((await f.service.renameClass(CLASS,'New class')).code,'class-not-found');assert.equal(f.writes().length,0);f.service.destroy();
 }
 const f=await fixture();await f.signIn();assert.equal((await f.service.renameClass('missing_class_0001','New class')).code,'class-not-found');assert.equal(f.writes().length,0);f.service.destroy();
});
test('known offline and rejected updates preserve both previous names',async()=>{
 for(const kind of ['offline','rejected']){
  const f=await fixture();await f.signIn();if(kind==='offline')f.write('.info/connected',false);else f.controls.rejectUpdate=true;
  assert.equal((await f.service.renameClass(CLASS,'New class')).code,'class-rename-failed');
  assert.equal(read(f.tree,`classroomV1/classes/${CLASS}/meta/label`),'Blue class');assert.equal(read(f.tree,`classroomV1/directory/${CLASS}/meta/label`),'Blue class');
  if(kind==='offline')assert.equal(f.writes().length,0);f.service.destroy();
 }
});
test('sign-out, revocation, auth replacement and destruction during metadata reads prevent writes',async()=>{
 for(const kind of ['sign-out','revoked','auth-replaced','destroyed']){
  const f=await fixture();await f.signIn();const held=pausedRead(f),pending=f.service.renameClass(CLASS,'Stale class');await held.ready;
  if(kind==='sign-out')await f.service.adminSignOut();
  if(kind==='revoked')f.write('classroomV1/admins/'+UID,false);
  if(kind==='auth-replaced')f.auths.get('coda-classroom-admin').currentUser={uid:'different_teacher_0001'};
  if(kind==='destroyed')f.service.destroy();held.release();assert.equal((await pending).code,'closed');assert.equal(f.writes().length,0);f.service.destroy();
 }
});
test('only one rename can run at a time, and a completed request releases the guard',async()=>{
 const f=await fixture();await f.signIn();const held=pausedRead(f),pending=f.service.renameClass(CLASS,'First class');await held.ready;
 assert.equal((await f.service.renameClass(CLASS,'Second class')).code,'busy');held.release();assert.equal((await pending).ok,true);
 f.controls.beforeGet=null;assert.equal((await f.service.renameClass(CLASS,'Second class')).ok,true);f.service.destroy();
});
test('destroying the service cancels a pending connectivity subscription without a write',async()=>{
 const f=await fixture();await f.signIn();f.controls.holdConnection=true;const entered=new Promise(resolve=>f.controls.connectionEntered=resolve);
 const pending=f.service.renameClass(CLASS,'Canceled class');await entered;f.service.destroy();
 assert.equal((await pending).code,'closed');assert.equal(f.watchers.filter(watcher=>watcher.path==='.info/connected').length,0);assert.equal(f.writes().length,0);
});
