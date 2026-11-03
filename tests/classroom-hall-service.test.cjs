const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto').webcrypto;
const service=require('../classroom-service.js'),data=require('../classroom-profile-data.js');
const BOARDS=['pitch-classic','pitch-endless','pitch-levels','pitch-multi','triad-computer','triad-multiplayer','rhythm-tap'];
const clone=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
function storage(){const values=new Map();return {get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};}
function treeRead(tree,path){return path.split('/').filter(Boolean).reduce((node,key)=>node?.[key],tree)??null;}
function treeWrite(tree,path,value){const keys=path.split('/').filter(Boolean),last=keys.pop();let node=tree;for(const key of keys)node=node[key]??={};if(value===null)delete node[last];else node[last]=clone(value);}
function snapshot(value,key=null){return {key,val:()=>clone(value),child:path=>snapshot(treeRead(value,path),path.split('/').at(-1)),forEach:fn=>{for(const [name,row]of Object.entries(value||{}))fn(snapshot(row,name));}};}
async function fixture({fetch,developer=false}={}){
 const native=storage(),session=storage(),tree={classroomV1:{admins:{'teacher-fixture':true}}},apps=[],auths=new Map(),calls=[];
 const controls={beforeGet:null,denyHall:false,failHallRead:false};
 const sdk={
  getApps:()=>apps,initializeApp:(_config,name)=>{const app={name};apps.push(app);return app;},
  getAuth:app=>{if(!auths.has(app.name))auths.set(app.name,{currentUser:null});return auths.get(app.name);},getDatabase:app=>({app}),
  setPersistence:async()=>{},browserSessionPersistence:'session',ref:(database,path)=>({database,path}),
  signInAnonymously:async instance=>{instance.currentUser={uid:'student-fixture'};return {user:instance.currentUser};},
  signInWithPopup:async instance=>{instance.currentUser={uid:'teacher-fixture',getIdTokenResult:async()=>({signInProvider:'google.com'})};return {user:instance.currentUser};},
  GoogleAuthProvider:class{setCustomParameters(){}},signOut:async instance=>{instance.currentUser=null;},
  serverTimestamp:()=>123456,
  query:(ref,...constraints)=>({...ref,constraints}),orderByChild:key=>({orderBy:key}),equalTo:value=>({equalTo:value}),limitToLast:value=>({limit:value}),
  get:async ref=>{
   calls.push({kind:'get',path:ref.path});if(controls.beforeGet)await controls.beforeGet(ref);
   if(controls.failHallRead&&ref.path.includes('/hallOfFame/'))throw Error('offline');
   if(ref.path==='.info/serverTimeOffset')return snapshot(0);if(ref.path==='.info/connected')return snapshot(true);
   let value=treeRead(tree,ref.path);const equal=ref.constraints?.find(item=>'equalTo'in item),order=ref.constraints?.find(item=>item.orderBy);
   if(equal&&value)value=Object.fromEntries(Object.entries(value).filter(([,row])=>row[order.orderBy]===equal.equalTo));
   return snapshot(value);
  },
  onValue:(ref,callback)=>{callback(snapshot(treeRead(tree,ref.path)));return ()=>{};},
  set:async(ref,value)=>{calls.push({kind:'set',path:ref.path});treeWrite(tree,ref.path,value);},
  update:async(ref,changes)=>{
   calls.push({kind:'update',path:ref.path,changes:clone(changes)});
   const hall=ref.path.includes('/hallOfFame')||Object.keys(changes).some(key=>key.startsWith('hallOfFame/'));
   if(controls.denyHall&&hall)throw Error('PERMISSION_DENIED');
   for(const [path,value]of Object.entries(changes))treeWrite(tree,ref.path+'/'+path,value);
  },
  runTransaction:async(ref,update)=>{const next=update(clone(treeRead(tree,ref.path)));if(next===undefined)return {committed:false,snapshot:snapshot(treeRead(tree,ref.path))};treeWrite(tree,ref.path,next);return {committed:true,snapshot:snapshot(next)};}
 };
 const win={crypto,location:{hostname:'cwoodmusic.github.io',href:'https://cwoodmusic.github.io/coda-arcade/world-preview.html'},localStorage:native,sessionStorage:session,document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},setInterval:()=>1,clearInterval(){},setTimeout,clearTimeout,addEventListener(){},removeEventListener(){},CodaDeveloperTestMode:{isEnabled:()=>developer}};
 let sdkLoads=0;
 const instance=service.create({window:win,crypto,dataApi:data,storage:native,sessionStorage:session,clock:()=>100000,config:{firebase:{projectId:'hall-fixture',databaseURL:'https://hall-fixture-default-rtdb.firebaseio.com'},classroom:{enabled:true,namespace:'classroomV1'}},fetch,sdkLoader:async()=>{sdkLoads++;return sdk;}});
 const pass='A'.repeat(26),digest=await service.hashPass(pass,crypto),classId='class-fixture',profileId='profile-fixture';
 treeWrite(tree,'classroomV1/passes/'+digest,{classId,profileId});
 treeWrite(tree,'classroomV1/classes/'+classId+'/profiles/'+profileId,{meta:{alias:'Blue Owl 27',picture:'owl',createdAt:1,passHash:digest},state:{schemaVersion:1,revision:1,data:data.blank()}});
 treeWrite(tree,'classroomV1/directory/'+classId,{meta:{label:'Class 1'},profiles:{[profileId]:{alias:'Blue Owl 27',picture:'owl'}}});
 return {instance,native,session,tree,sdk,controls,calls,classId,profileId,digest,join:()=>instance.join(pass),sdkLoads:()=>sdkLoads};
}
function row(score,tiebreak=0,alias='Blue Owl 27'){const scaled=Math.round(score*100);return {alias,score:scaled,tiebreak,rank:scaled*1000001+tiebreak,at:1000};}
test('guest Global uses bounded credential-free REST without initializing Firebase Auth',async()=>{
 let requested;const f=await fixture({fetch:async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({'profile-first':row(25,3),'profile-second':row(50,1),'profile-private':{...row(999),alias:'A real name'}})};}});
 const result=await f.instance.loadHallBoard({scope:'global',board:'pitch-classic'});
 assert.equal(result.ok,true);assert.deepEqual(result.rows.map(entry=>entry.score),[50,25]);assert.equal(result.rows[0].alias,'Blue Owl 27');
 const url=new URL(requested.url);assert.equal(url.pathname,'/classroomV1/hallOfFame/global/pitch-classic.json');assert.equal(url.searchParams.get('orderBy'),'"rank"');assert.equal(url.searchParams.get('limitToLast'),'20');assert.equal(requested.options.credentials,'omit');assert.equal(f.sdkLoads(),0);assert.equal(f.instance.getState().role,'guest');
 assert.equal((await f.instance.loadHallBoard({scope:'class',board:'pitch-classic'})).code,'sign-in-needed');f.instance.destroy();
});
test('student class reads stay in the bound class and decode stored scores',async()=>{
 const f=await fixture();assert.equal((await f.join()).ok,true);treeWrite(f.tree,'classroomV1/hallOfFame/classes/'+f.classId+'/rhythm-tap',{'profile-one':row(98.75,79)});
 const result=await f.instance.loadHallBoard({scope:'class',board:'rhythm-tap'});assert.equal(result.ok,true);assert.equal(result.rows[0].score,98.75);assert.equal(result.ownId,f.profileId);
 const before=f.calls.length;assert.equal((await f.instance.loadHallBoard({scope:'class',board:'pitch-classic',classId:'other-class'})).code,'forbidden');assert.equal(f.calls.length,before);assert.equal(f.instance.getHallContext().student,true);f.instance.destroy();
});
test('publishing writes two exact alias-only rows atomically and skips older bests',async()=>{
 const f=await fixture();await f.join();const before=[...f.native.values];
 assert.equal((await f.instance.publishHallRecord({game:'rhythm',mode:'tap',score:98.75,tiebreak:79})).ok,true);
 const writes=f.calls.filter(call=>call.kind==='update'&&call.path.endsWith('/hallOfFame'));assert.equal(writes.length,1);const values=Object.values(writes[0].changes);assert.deepEqual(values[0],values[1]);assert.deepEqual(Object.keys(values[0]).sort(),['alias','at','rank','score','tiebreak']);assert.equal(values[0].score,9875);assert.equal(values[0].alias,'Blue Owl 27');assert.equal(values[0].rank,9875*1000001+79);
 assert.equal((await f.instance.publishHallRecord({game:'rhythm',mode:'tap',score:97,tiebreak:70})).skipped,true);assert.equal(f.calls.filter(call=>call.kind==='update'&&call.path.endsWith('/hallOfFame')).length,1);assert.deepEqual([...f.native.values],before);f.instance.destroy();
});
test('invalid aliases, development play, and stale identity never publish',async()=>{
 const f=await fixture({developer:true});await f.join();assert.equal((await f.instance.publishHallRecord({game:'pitch',mode:'classic',score:50,tiebreak:2})).code,'not-eligible');f.instance.destroy();
 const invalid=await fixture();treeWrite(invalid.tree,'classroomV1/classes/'+invalid.classId+'/profiles/'+invalid.profileId+'/meta/alias','A real name');await invalid.join();assert.equal((await invalid.instance.publishHallRecord({game:'pitch',mode:'classic',score:50,tiebreak:2})).code,'invalid-alias');invalid.instance.destroy();
 const stale=await fixture();await stale.join();let release,entered;const ready=new Promise(resolve=>entered=resolve);stale.controls.beforeGet=ref=>{if(ref.path.includes('/hallOfFame/')){entered();return new Promise(resolve=>release=resolve);}};
 const pending=stale.instance.publishHallRecord({game:'pitch',mode:'classic',score:50,tiebreak:2});await ready;stale.instance.destroy();release();assert.equal((await pending).code,'closed');assert.equal(stale.calls.filter(call=>call.kind==='update'&&call.path.endsWith('/hallOfFame')).length,0);
});
test('offline Hall failure leaves profile readiness, private saves, and guest authentication alone',async()=>{
 const f=await fixture();await f.join();const state=f.instance.getState(),before=[...f.native.values];f.controls.failHallRead=true;
 assert.equal((await f.instance.publishHallRecord({game:'pitch',mode:'classic',score:50,tiebreak:2})).code,'unavailable');assert.equal(f.instance.getState().profile.profileId,state.profile.profileId);assert.equal(f.instance.isWritable(),true);assert.deepEqual([...f.native.values],before);f.instance.destroy();
});
test('approved teachers can read selected classes but a played student card defaults to its own class',async()=>{
 const f=await fixture();assert.equal((await f.instance.adminSignIn()).ok,true);assert.equal(f.instance.getHallContext().teacher,true);
 assert.equal((await f.instance.loadHallBoard({scope:'class',board:'pitch-classic',classId:f.classId})).ok,true);assert.equal((await f.instance.publishHallRecord({game:'pitch',mode:'classic',score:10,tiebreak:0})).code,'sign-in-needed');
 await f.join();assert.equal(f.instance.getHallContext().student,true);assert.equal(f.instance.getHallContext().teacher,false);assert.equal(f.instance.getHallContext().classId,f.classId);f.instance.destroy();
});
test('old live rules denying Hall cleanup never block private profile deletion, and retries clean every board',async()=>{
 const f=await fixture();await f.instance.adminSignIn();for(const board of BOARDS){treeWrite(f.tree,'classroomV1/hallOfFame/global/'+board+'/'+f.profileId,row(1));treeWrite(f.tree,'classroomV1/hallOfFame/classes/'+f.classId+'/'+board+'/'+f.profileId,row(1));}
 f.controls.denyHall=true;const result=await f.instance.deleteProfile(f.classId,f.profileId);assert.equal(result.ok,true);assert.equal(result.hallCleanup.ok,false);assert.equal(treeRead(f.tree,'classroomV1/classes/'+f.classId+'/profiles/'+f.profileId),null);assert.equal(treeRead(f.tree,'classroomV1/passes/'+f.digest),null);
 f.controls.denyHall=false;assert.equal((await f.instance.deleteProfile(f.classId,f.profileId)).hallCleanup.ok,true);for(const board of BOARDS){assert.equal(treeRead(f.tree,'classroomV1/hallOfFame/global/'+board+'/'+f.profileId),null);assert.equal(treeRead(f.tree,'classroomV1/hallOfFame/classes/'+f.classId+'/'+board+'/'+f.profileId),null);}f.instance.destroy();
});
test('class deletion keeps private cleanup independent and remembers failed Hall cleanup for retry',async()=>{
 const f=await fixture();await f.instance.adminSignIn();for(const board of BOARDS)treeWrite(f.tree,'classroomV1/hallOfFame/global/'+board+'/'+f.profileId,row(1));treeWrite(f.tree,'classroomV1/hallOfFame/classes/'+f.classId,{'pitch-classic':{[f.profileId]:row(1)}});
 f.controls.denyHall=true;let result=await f.instance.deleteClass(f.classId);assert.equal(result.ok,true);assert.equal(result.hallCleanup.ok,false);assert.equal(treeRead(f.tree,'classroomV1/classes/'+f.classId),null);
 f.controls.denyHall=false;result=await f.instance.deleteClass(f.classId);assert.equal(result.hallCleanup.ok,true);assert.equal(treeRead(f.tree,'classroomV1/hallOfFame/classes/'+f.classId),null);for(const board of BOARDS)assert.equal(treeRead(f.tree,'classroomV1/hallOfFame/global/'+board+'/'+f.profileId),null);f.instance.destroy();
});
