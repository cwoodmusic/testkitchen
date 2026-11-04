'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{webcrypto}=require('node:crypto');
const importer=require('../classroom-roster-import.js');
const clone=value=>JSON.parse(JSON.stringify(value)),has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function read(tree,path){let value=tree;for(const key of path.split('/')){if(!value||!has(value,key))return null;value=value[key];}return value??null;}
function write(tree,path,value){const keys=path.split('/');let current=tree;for(const key of keys.slice(0,-1)){if(!has(current,key)||!current[key])Object.defineProperty(current,key,{value:{},writable:true,enumerable:true,configurable:true});current=current[key];}Object.defineProperty(current,keys.at(-1),{value:clone(value),writable:true,enumerable:true,configurable:true});}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
const roster=[{userId:'google_student_1',name:'FIRST PRIVATE STUDENT'},{userId:'google_student_2',name:'SECOND PRIVATE STUDENT'}];
const choices=students=>students.map(row=>({userId:row.userId,action:'create'}));
function fixture(){
 const f={tree:{},context:{uid:'teacher_fixture_1234',signedIn:true,authorized:true,identity:'teacher-epoch-1'},reads:[],writes:[],commits:[],controls:{},randomSerial:0};
 f.options={crypto:webcrypto,getContext:()=>f.context,online:async()=>f.controls.online!==false,
  read:async path=>{f.reads.push(path);await f.controls.beforeRead?.(path);if(f.controls.denyMappings&&path.startsWith('classroomImports/'))throw Object.assign(Error('do not show backend'),{code:'PERMISSION_DENIED'});return clone(read(f.tree,path));},
  update:async changes=>{f.writes.push(clone(changes));await f.controls.beforeUpdate?.(changes);if(f.controls.rejectWrite)throw Error('private raw backend error');
   const next=clone(f.tree);
   // Model only the atomic create/revision boundary. Actual shipped rules are
   // covered by the separate Firebase emulator suite and real SDK browser test.
   for(const path of Object.keys(changes)){
    if(/^classes\/[^/]+\/profiles\/[^/]+$/.test(path)&&read(f.tree,path))throw Object.assign(Error('existing revision'),{code:'PERMISSION_DENIED'});
    if(/^classroomImports\/[^/]+\/[^/]+$/.test(path)&&read(f.tree,path))throw Object.assign(Error('existing course'),{code:'PERMISSION_DENIED'});
   }
   for(const [path,value]of Object.entries(changes))write(next,path,value);
   f.tree=next;f.commits.push(clone(changes));
  },
  random:size=>{const serial=++f.randomSerial;return Uint8Array.from({length:size},(_,index)=>(serial*17+index*13)%256);},
  hashPass:async raw=>Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))).toString('hex'),
  blank:()=>({wallet:{balance:150},progression:{xp:0}}),serverTimestamp:()=>1000,
  receipt:(profileId,meta,raw)=>({ok:true,profileId,alias:meta.alias,picture:meta.picture,pass:'CODA-'+raw,link:'https://school.example/world-preview.html#classroom-pass=CODA-'+raw})};
 f.client=importer.create(f.options);
 f.addClass=(classId='class_existing',label='Existing class')=>{const meta={ownerUid:f.context.uid,label,createdAt:1};write(f.tree,'classes/'+classId+'/meta',meta);write(f.tree,'directory/'+classId+'/meta',meta);return classId;};
 f.addProfile=(classId='class_existing',profileId='profile_existing',alias='Blue Fox 14')=>{const meta={alias,picture:'fox',createdAt:1,passHash:'a'.repeat(64)},state={schemaVersion:1,revision:12,data:{wallet:{balance:840},progression:{xp:2400}}};write(f.tree,'classes/'+classId+'/profiles/'+profileId,{meta,state});write(f.tree,'directory/'+classId+'/profiles/'+profileId,{alias,picture:'fox'});write(f.tree,'passes/'+meta.passHash,{classId,profileId,createdAt:1});return profileId;};
 return f;
}
function request(students=roster){return {courseId:'course_fixture_1',students,label:'Music Class',choices:choices(students)};}

test('a new class, cards, aliases and private IDs commit once without storing names or raw passes',async()=>{
 const f=fixture(),preview=await f.client.previewRosterImport(request());
 assert.equal(preview.ok,true);assert.equal(preview.newClass,true);assert.deepEqual(preview.students.map(row=>row.status),['unlinked','unlinked']);assert.deepEqual(f.writes,[]);
 const result=await f.client.importRoster(request());assert.equal(result.ok,true);assert.equal(result.created,2);assert.equal(result.cards.length,2);assert.equal(f.commits.length,1);
 assert.match(result.classId,/^gclass_[a-f0-9]{40}$/);assert.notEqual(result.cards[0].profileId,result.cards[1].profileId);assert.notEqual(result.cards[0].alias,result.cards[1].alias);
 const stored=JSON.stringify(f.tree);for(const row of roster)assert.ok(!stored.includes(row.name));for(const card of result.cards)assert.ok(!stored.includes(card.pass));assert.deepEqual(f.client.getState(),{busy:false});
 const mapping=read(f.tree,'classroomImports/'+f.context.uid+'/course_fixture_1');
 for(const card of result.cards){assert.equal(mapping.students[card.userId].profileId,card.profileId);assert.equal(mapping.profileLinks[card.profileId],card.userId);assert.equal(read(f.tree,'classes/'+result.classId+'/profiles/'+card.profileId+'/state').revision,1);}
});
test('re-import reuses stable links and never regenerates cards or replaces progress',async()=>{
 const f=fixture(),first=await f.client.importRoster(request());assert.equal(first.ok,true);
 const profilePath='classes/'+first.classId+'/profiles/'+first.cards[0].profileId;write(f.tree,profilePath+'/state',{schemaVersion:1,revision:9,data:{xp:6000}});
 const before=clone(f.tree),second=await f.client.importRoster(request());
 assert.equal(second.ok,true);assert.equal(second.existing,2);assert.equal(second.created,0);assert.deepEqual(second.cards,[]);assert.deepEqual(f.tree,before);assert.equal(f.commits.length,1);
 const preview=await f.client.previewRosterImport(request());assert.deepEqual(preview.students.map(row=>row.status),['existing','existing']);
});
test('linking an existing profile changes only private mapping and preserves its pass, progress and directory row',async()=>{
 const f=fixture(),classId=f.addClass(),profileId=f.addProfile(),before=clone(f.tree);
 const result=await f.client.importRoster({...request(roster.slice(0,1)),classId,choices:[{userId:roster[0].userId,action:'link',profileId}]});
 assert.equal(result.ok,true);assert.equal(result.linked,1);assert.equal(result.created,0);assert.deepEqual(result.cards,[]);
 for(const section of ['classes','directory','passes'])assert.deepEqual(f.tree[section],before[section]);
 assert.deepEqual(Object.keys(f.commits[0]),['classroomImports/'+f.context.uid+'/course_fixture_1']);
});
test('new roster additions append leaves and leave old links and removed students untouched',async()=>{
 const f=fixture(),first=await f.client.importRoster(request(roster.slice(0,1))),oldMap=clone(read(f.tree,'classroomImports/'+f.context.uid+'/course_fixture_1'));
 const result=await f.client.importRoster(request(roster.slice(1)));assert.equal(result.ok,true);assert.equal(result.created,1);
 const map=read(f.tree,'classroomImports/'+f.context.uid+'/course_fixture_1');assert.deepEqual(map.students[roster[0].userId],oldMap.students[roster[0].userId]);assert.equal(Object.keys(map.students).length,2);
 assert.equal(result.classId,first.classId);assert.ok(Object.keys(f.commits[1]).every(path=>!path.includes('/students/'+roster[0].userId)));
});
test('occupied profiles cannot be linked to another child, including a mapped child absent from the roster',async()=>{
 const f=fixture(),classId=f.addClass(),profileId=f.addProfile();
 await f.client.importRoster({...request(roster.slice(0,1)),classId,choices:[{userId:roster[0].userId,action:'link',profileId}]});
 const preview=await f.client.previewRosterImport({...request(roster.slice(1)),classId});assert.equal(preview.profiles[0].linkedTo,roster[0].userId);
 const before=clone(f.tree),result=await f.client.importRoster({...request(roster.slice(1)),classId,choices:[{userId:roster[1].userId,action:'link',profileId}]});
 assert.equal(result.code,'profile-already-linked');assert.deepEqual(f.tree,before);assert.equal(f.commits.length,1);
});
test('deleted linked profiles need an explicit choice; deleted classes are never resurrected',async()=>{
 const f=fixture(),first=await f.client.importRoster(request(roster.slice(0,1))),card=first.cards[0];
 delete f.tree.classes[first.classId].profiles[card.profileId];delete f.tree.directory[first.classId].profiles[card.profileId];
 const preview=await f.client.previewRosterImport(request(roster.slice(0,1)));assert.equal(preview.students[0].status,'missing');
 const skipped=await f.client.importRoster({...request(roster.slice(0,1)),choices:[]});assert.equal(skipped.created,0);assert.equal(f.commits.length,1);
 const repaired=await f.client.importRoster(request(roster.slice(0,1)));assert.equal(repaired.ok,true);assert.equal(repaired.created,1);assert.equal(repaired.cards[0].profileId,card.profileId);
 delete f.tree.classes[first.classId];delete f.tree.directory[first.classId];const before=clone(f.tree);
 assert.equal((await f.client.importRoster(request())).code,'class-not-found');assert.deepEqual(f.tree,before);
});
test('bound courses cannot silently change target and raw or malformed IDs are rejected before writes',async()=>{
 const f=fixture();await f.client.importRoster(request());const count=f.writes.length;
 assert.equal((await f.client.importRoster({...request(),classId:'class_different'})).code,'import-target-conflict');
 for(const students of [[{userId:123,name:'Student'}],[{userId:'bad/path',name:'Student'}],[roster[0],roster[0]]])assert.equal((await f.client.importRoster({...request(),students})).code,'invalid-roster');
 assert.equal((await f.client.importRoster({...request(),courseId:'course/evil'})).code,'invalid-course');assert.equal((await f.client.importRoster({...request(),classId:12345678})).code,'invalid-class');assert.equal(f.writes.length,count);
});
test('explicit skips create no empty class and the 200-profile boundary is enforced',async()=>{
 const f=fixture();assert.equal((await f.client.importRoster({...request(),choices:[]})).code,'no-students-selected');assert.deepEqual(f.writes,[]);
 const classId=f.addClass();for(let index=0;index<200;index++)f.addProfile(classId,'profile_fixture_'+index,'Blue Fox '+(10+index));
 assert.equal((await f.client.importRoster({...request(roster.slice(0,1)),classId})).code,'class-full');assert.deepEqual(f.writes,[]);
});
test('guest, student, old rules, offline, and transport failures never produce partial cards',async()=>{
 for(const state of [{signedIn:false},{authorized:false}]){const f=fixture();Object.assign(f.context,state);assert.equal((await f.client.importRoster(request())).code,'admin-required');assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);}
 const old=fixture();old.controls.denyMappings=true;assert.equal((await old.client.importRoster(request())).code,'roster-setup-required');assert.deepEqual(old.writes,[]);
 const offline=fixture();offline.controls.online=false;assert.equal((await offline.client.importRoster(request())).code,'offline');assert.deepEqual(offline.writes,[]);
 const rejected=fixture();rejected.controls.rejectWrite=true;const result=await rejected.client.importRoster(request());assert.deepEqual(result,{ok:false,code:'import-failed'});assert.deepEqual(rejected.tree,{});assert.equal(result.cards,undefined);
});
test('session changes and clear invalidate blocked work without leaking old results into a new operation',async()=>{
 for(const change of [f=>f.client.clear(),f=>f.context.identity='teacher-epoch-2',f=>f.context.authorized=false]){
  const f=fixture(),entered=deferred(),gate=deferred();f.controls.beforeRead=async path=>{if(path.startsWith('classroomImports/')){entered.resolve();await gate.promise;}};
  const pending=f.client.importRoster(request());await entered.promise;change(f);gate.resolve();assert.equal((await pending).code,'session-changed');assert.deepEqual(f.writes,[]);
 }
 const f=fixture(),entered=deferred(),gate=deferred();f.controls.beforeRead=async()=>{entered.resolve();await gate.promise;};
 const pending=f.client.importRoster(request());await entered.promise;assert.equal((await f.client.importRoster(request())).code,'busy');gate.resolve();assert.equal((await pending).ok,true);assert.deepEqual(f.client.getState(),{busy:false});
});
test('pass collisions exhaust safely without reusing a known pass hash',async()=>{
 const f=fixture(),classId=f.addClass();f.addProfile(classId);f.options.hashPass=async()=> 'a'.repeat(64);f.client=importer.create(f.options);
 const before=clone(f.tree),result=await f.client.importRoster({...request(roster.slice(0,1)),classId});assert.deepEqual(result,{ok:false,code:'import-failed'});assert.deepEqual(f.writes,[]);assert.deepEqual(f.tree,before);
});
test('clearing an old teacher operation cannot release a newer teacher import busy guard',async()=>{
 const f=fixture(),oldEntered=deferred(),newEntered=deferred(),oldGate=deferred(),newGate=deferred();
 f.controls.beforeRead=async path=>{
  if(path.endsWith('/course_fixture_1')){oldEntered.resolve();await oldGate.promise;}
  if(path.endsWith('/course_fixture_2')){newEntered.resolve();await newGate.promise;}
 };
 const old=f.client.importRoster(request());await oldEntered.promise;f.client.clear();
 f.context={uid:'other_teacher_5678',authorized:true,signedIn:true,identity:'teacher-epoch-2'};
 const newer=f.client.importRoster({...request(),courseId:'course_fixture_2'});await newEntered.promise;
 oldGate.resolve();assert.equal((await old).code,'session-changed');assert.deepEqual(f.client.getState(),{busy:true});
 newGate.resolve();assert.equal((await newer).ok,true);assert.deepEqual(f.client.getState(),{busy:false});
 assert.ok(Object.keys(f.tree.classroomImports).every(uid=>uid==='other_teacher_5678'));
});
test('two parallel new imports use stable profile IDs and a rejected atomic race leaves no orphan card passes',async()=>{
 const f=fixture(),second=importer.create(f.options),firstEntered=deferred(),secondEntered=deferred(),gate=deferred();let count=0;
 f.controls.beforeUpdate=async()=>{(++count===1?firstEntered:secondEntered).resolve();await gate.promise;};
 const a=f.client.importRoster(request()),b=second.importRoster(request());await Promise.all([firstEntered.promise,secondEntered.promise]);gate.resolve();
 const results=await Promise.all([a,b]);assert.equal(results.filter(result=>result.ok).length,1);assert.equal(f.commits.length,1);
 const successful=results.find(result=>result.ok);assert.equal(Object.keys(f.tree.passes).length,2);assert.equal(Object.keys(f.tree.classes[successful.classId].profiles).length,2);
 const rejected=results.find(result=>!result.ok);assert.equal(rejected.cards,undefined);
});
test('reserved dictionary keys cannot shadow Firebase serializer methods or object prototypes',async()=>{
 for(const userId of ['__proto__','constructor','hasOwnProperty','prototype']){
  const f=fixture(),result=await f.client.importRoster(request([{userId,name:'Private student'}]));
  assert.deepEqual(result,{ok:false,code:'invalid-roster'});assert.deepEqual(f.writes,[]);assert.equal({}.profileId,undefined);
 }
 const f=fixture();f.controls.beforeUpdate=changes=>{
  assert.equal(Object.getPrototypeOf(changes),Object.prototype);
  const map=Object.entries(changes).find(([path])=>path.startsWith('classroomImports/'))[1];
  assert.equal(Object.getPrototypeOf(map.students),Object.prototype);
 };
 assert.equal((await f.client.importRoster(request())).ok,true);
});
