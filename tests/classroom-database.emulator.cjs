/* Real Firebase rules tests. Run tools/test-classroom-rules.cjs; never live. */
'use strict';
const {test,before,beforeEach,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');
const {mergeClassroomRules}=require('../tools/classroom-rules-merge.cjs');
const DTO=require('../classroom-profile-data.js');

const endpoint=process.env.FIREBASE_DATABASE_EMULATOR_HOST||'';
if(!/^127\.0\.0\.1:[1-9][0-9]{1,4}$/.test(endpoint))throw Error('Refusing to run: FIREBASE_DATABASE_EMULATOR_HOST must explicitly name a loopback emulator.');
const port=Number(endpoint.split(':')[1]);if(port>65535)throw Error('Invalid emulator port.');
const requireTool=createRequire(path.join(process.env.CODA_FIREBASE_TEST_TOOLS||'/tmp/coda-classroom-emulator','package.json'));
const {initializeTestEnvironment,assertSucceeds,assertFails}=requireTool('@firebase/rules-unit-testing');

const ROOT='classroomV1',CLASS='classroom_0001',OTHER_CLASS='classroom_0002',PROFILE='profile_0001',OTHER_PROFILE='profile_0002';
// Test-only fixed credentials, unrelated to any deployed project or real card.
const HASH='a'.repeat(64),OTHER_HASH='b'.repeat(64),NEW_HASH='c'.repeat(64);
const PROFILE_PATH=`${ROOT}/classes/${CLASS}/profiles/${PROFILE}`,OTHER_PATH=`${ROOT}/classes/${OTHER_CLASS}/profiles/${OTHER_PROFILE}`;
const clone=value=>JSON.parse(JSON.stringify(value));
const stamp=()=>Date.now();
const state=(revision=2,data=DTO.blank())=>({schemaVersion:1,revision,updatedAt:stamp(),data});
const binding=(classId=CLASS,profileId=PROFILE,passHash=HASH)=>({classId,profileId,passHash,createdAt:stamp()});
let env;
const anonymous=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'anonymous'}}).database();
const google=uid=>env.authenticatedContext(uid,{firebase:{sign_in_provider:'google.com'}}).database();
const staff=()=>google('school_admin');
const ref=(database,location)=>database.ref(location);
const read=(database,location)=>ref(database,location).get();
const write=(database,location,value)=>ref(database,location).set(value);
const remove=(database,location)=>ref(database,location).remove();

before(async()=>{
 const fragment=JSON.parse(fs.readFileSync(path.join(__dirname,'../classroom-database.rules.json'),'utf8'));
 const rules=mergeClassroomRules({rules:{'.read':false,'.write':false,existingScores:{'.read':true,'.write':false}}},fragment);
 env=await initializeTestEnvironment({projectId:'demo-coda-classroom-rules',database:{host:'127.0.0.1',port,rules:JSON.stringify(rules)}});
});
beforeEach(async()=>{
 const now=stamp(),seed={existingScores:{top:{alias:'COD',score:123}},[ROOT]:{
  admins:{school_admin:true,password_admin:true,other_admin:true},
  directory:{
   [CLASS]:{meta:{ownerUid:'school_admin',label:'Blue group',createdAt:now},profiles:{[PROFILE]:{alias:'Blue Otter 27',picture:'otter'}}},
   [OTHER_CLASS]:{meta:{ownerUid:'school_admin',label:'Green group',createdAt:now},profiles:{[OTHER_PROFILE]:{alias:'Green Fox 8',picture:'fox'}}}
  },
  classes:{
   [CLASS]:{meta:{ownerUid:'school_admin',label:'Blue group',createdAt:now},profiles:{[PROFILE]:{meta:{alias:'Blue Otter 27',picture:'otter',createdAt:now,passHash:HASH},state:state(1),lease:{uid:'student_one',expiresAt:now+60000}}}},
   [OTHER_CLASS]:{meta:{ownerUid:'school_admin',label:'Green group',createdAt:now},profiles:{[OTHER_PROFILE]:{meta:{alias:'Green Fox 8',picture:'fox',createdAt:now,passHash:OTHER_HASH},state:state(1)}}}
  },
  passes:{[HASH]:{classId:CLASS,profileId:PROFILE,createdAt:now},[OTHER_HASH]:{classId:OTHER_CLASS,profileId:OTHER_PROFILE,createdAt:now}},
  sessions:{student_one:binding(),student_two:binding(OTHER_CLASS,OTHER_PROFILE,OTHER_HASH),second_device:binding()}
 }};
 await env.clearDatabase();await env.withSecurityRulesDisabled(context=>write(context.database(),'/',seed));
});
after(async()=>{if(env)await env.cleanup();});

test('logged-out users and parent listings cannot discover classroom data or pass mappings',async()=>{
 const guest=env.unauthenticatedContext().database(),student=anonymous('new_device');
 for(const location of [ROOT,`${ROOT}/classes`,`${ROOT}/passes`,`${ROOT}/sessions`,`${ROOT}/admins`,`${ROOT}/passes/${HASH}`,`${PROFILE_PATH}/state`])await assertFails(read(guest,location));
 for(const location of [ROOT,`${ROOT}/classes`,`${ROOT}/passes`,`${ROOT}/sessions`,`${ROOT}/admins`])await assertFails(read(student,location));
 await assertFails(ref(student,`${ROOT}/passes`).orderByKey().equalTo(HASH).get());
 const lookup=await assertSucceeds(read(student,`${ROOT}/passes/${HASH}`));assert.equal(lookup.val().profileId,PROFILE);
});

test('school administration requires both Google provider and the provisioned allowlist',async()=>{
 await assertSucceeds(read(staff(),`${ROOT}/classes`));
 const sessions=await assertSucceeds(ref(staff(),`${ROOT}/sessions`).orderByChild('classId').equalTo(CLASS).get());
 assert.deepEqual(Object.keys(sessions.val()).sort(),['second_device','student_one']);
 await assertFails(ref(anonymous('student_one'),`${ROOT}/sessions`).orderByChild('classId').equalTo(CLASS).get());
 const notStaff=google('ordinary_google'),anonymousAdmin=anonymous('school_admin');
 const passwordAdmin=env.authenticatedContext('password_admin',{firebase:{sign_in_provider:'password'}}).database();
 for(const database of [notStaff,anonymousAdmin,passwordAdmin]){
  await assertFails(read(database,`${ROOT}/classes`));
  await assertFails(write(database,`${ROOT}/classes/new_class_0001/meta`,{ownerUid:'ordinary_google',label:'Unauthorized',createdAt:stamp()}));
 }
 assert.equal((await assertSucceeds(read(staff(),`${ROOT}/admins/school_admin`))).val(),true);
 await assertFails(read(staff(),`${ROOT}/admins`));await assertFails(read(staff(),`${ROOT}/admins/password_admin`));
 for(const database of [staff(),notStaff,anonymousAdmin,passwordAdmin]){
  await assertFails(write(database,`${ROOT}/admins/ordinary_google`,true));
  await assertFails(remove(database,`${ROOT}/admins/school_admin`));
 }
});

test('the admin-only directory lists metadata without hashes or journals and rejects private or unknown fields',async()=>{
 const admin=staff(),roster=`${ROOT}/directory/${CLASS}/profiles/${PROFILE}`,metadata=`${ROOT}/directory/${CLASS}/meta`;
 const listed=(await assertSucceeds(read(admin,`${ROOT}/directory`))).val();
 assert.deepEqual(listed[CLASS].profiles[PROFILE],{alias:'Blue Otter 27',picture:'otter'});
 assert.equal(JSON.stringify(listed).includes('passHash'),false);assert.equal(JSON.stringify(listed).includes('wallet'),false);
 const password=env.authenticatedContext('password_admin',{firebase:{sign_in_provider:'password'}}).database();
 for(const database of [env.unauthenticatedContext().database(),anonymous('student_one'),google('ordinary_google'),password]){
  await assertFails(read(database,`${ROOT}/directory`));await assertFails(read(database,roster));
  await assertFails(write(database,`${roster}/alias`,'Changed Alias'));
 }
 for(const [target,value]of [[`${roster}/passHash`,HASH],[`${roster}/state`,state(1)],[`${roster}/email`,'child@example.invalid'],[`${metadata}/privateNote`,'No freeform notes'],[roster,{alias:'Blue Otter 27',picture:'dragon'}],[`${ROOT}/directory/${CLASS}/profiles`,'not a roster'],[`${ROOT}/directory`,'not a directory'],[`${ROOT}/classes`,'not a class map'],[`${ROOT}/classes/${CLASS}/profiles`,'not a profile map']])await assertFails(write(admin,target,value));
 await assertFails(write(admin,`${metadata}/ownerUid`,'ordinary_google'));
 const newProfile='profile_index_0003';await assertSucceeds(write(admin,`${ROOT}/directory/${CLASS}/profiles/${newProfile}`,{alias:'Orange Owl 42',picture:'owl'}));
 await assertSucceeds(remove(admin,`${ROOT}/directory/${CLASS}/profiles/${newProfile}`));
});

test('an anonymous session can bind only its own UID to an exact current pass mapping',async()=>{
 const student=anonymous('new_device');
 await assertFails(write(student,`${ROOT}/sessions/victim_uid`,binding()));
 await assertFails(write(student,`${ROOT}/sessions/new_device`,binding(CLASS,OTHER_PROFILE,HASH)));
 await assertFails(write(student,`${ROOT}/sessions/new_device`,binding(CLASS,PROFILE,OTHER_HASH)));
 await assertFails(write(student,`${ROOT}/sessions/new_device`,{...binding(),email:'child@example.invalid'}));
 await assertSucceeds(write(student,`${ROOT}/sessions/new_device`,binding()));
 await assertSucceeds(read(student,`${PROFILE_PATH}/meta`));await assertSucceeds(read(student,`${PROFILE_PATH}/state`));
 await assertFails(read(student,`${OTHER_PATH}/state`));await assertFails(read(student,`${ROOT}/sessions/student_one`));
 await assertSucceeds(write(student,`${ROOT}/sessions/new_device`,binding(OTHER_CLASS,OTHER_PROFILE,OTHER_HASH)));
 await assertSucceeds(read(student,`${OTHER_PATH}/state`));await assertFails(read(student,`${PROFILE_PATH}/state`));
 await assertSucceeds(remove(student,`${ROOT}/sessions/new_device`));
 await assertFails(write(google('ordinary_google'),`${ROOT}/sessions/ordinary_google`,binding()));
});

test('student profile saves require a matching current session, an unexpired lease, and exact revision CAS',async()=>{
 const owner=anonymous('student_one'),other=anonymous('student_two'),device=anonymous('second_device');
 await assertSucceeds(read(owner,`${PROFILE_PATH}/state`));
 await assertFails(write(other,`${PROFILE_PATH}/state`,state()));
 await assertFails(write(device,`${PROFILE_PATH}/state`,state()));
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state(1)));
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state(3)));
 await assertSucceeds(write(owner,`${PROFILE_PATH}/state`,state(2)));
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state(2)));
 await assertSucceeds(write(owner,`${PROFILE_PATH}/state`,state(3)));
 await assertFails(remove(owner,`${PROFILE_PATH}/state`));
 await assertFails(write(owner,`${PROFILE_PATH}/state/data/wallet/balance`,900));
});

test('initial state revision starts at one and a missing session never grants a lease or state',async()=>{
 await assertSucceeds(remove(staff(),`${PROFILE_PATH}/state`));
 const owner=anonymous('student_one');
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state(0)));
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state(2)));
 await assertSucceeds(write(owner,`${PROFILE_PATH}/state`,state(1)));
 const unknown=anonymous('unknown_device');
 await assertFails(read(unknown,`${PROFILE_PATH}/state`));
 await assertFails(write(unknown,`${PROFILE_PATH}/lease`,{uid:'unknown_device',expiresAt:stamp()+60000}));
});

test('lease takeover displaces the old writer, has a bounded expiry, and cannot be assigned to another UID',async()=>{
 const owner=anonymous('student_one'),device=anonymous('second_device');
 await assertFails(write(device,`${PROFILE_PATH}/lease`,{uid:'student_one',expiresAt:stamp()+60000}));
 await assertFails(write(device,`${PROFILE_PATH}/lease`,{uid:'second_device',expiresAt:stamp()+120000}));
 await assertFails(write(device,`${PROFILE_PATH}/lease`,{uid:'second_device',expiresAt:stamp()-1000}));
 await assertFails(write(device,`${PROFILE_PATH}/lease`,{uid:'second_device',expiresAt:stamp()+60000,name:'No identity fields'}));
 await assertSucceeds(write(device,`${PROFILE_PATH}/lease`,{uid:'second_device',expiresAt:stamp()+60000}));
 await assertFails(write(owner,`${PROFILE_PATH}/state`,state()));
 await assertFails(remove(owner,`${PROFILE_PATH}/lease`));
 await assertSucceeds(write(device,`${PROFILE_PATH}/state`,state()));
 await assertSucceeds(remove(device,`${PROFILE_PATH}/lease`));
 await assertFails(write(device,`${PROFILE_PATH}/state`,state(3)));
 await env.withSecurityRulesDisabled(context=>write(context.database(),`${PROFILE_PATH}/lease`,{uid:'second_device',expiresAt:stamp()-1000}));
 await assertFails(write(device,`${PROFILE_PATH}/state`,state(3)));
});

test('student lease release requires an existing own lease and current pass-bound membership',async()=>{
 const owner=anonymous('student_one'),sameProfile=anonymous('second_device'),otherProfile=anonymous('student_two');
 for(const database of [sameProfile,otherProfile,anonymous('unknown_device')])await assertFails(remove(database,`${PROFILE_PATH}/lease`));
 assert.equal((await read(staff(),`${PROFILE_PATH}/lease`)).val().uid,'student_one');
 await assertSucceeds(remove(owner,`${PROFILE_PATH}/lease`));
 assert.equal((await read(staff(),`${PROFILE_PATH}/lease`)).exists(),false);
 await assertFails(remove(owner,`${PROFILE_PATH}/lease`),'A missing lease is not an owned lease');
 await assertSucceeds(write(owner,`${PROFILE_PATH}/lease`,{uid:'student_one',expiresAt:stamp()+60000}));
 await assertSucceeds(ref(staff(),ROOT).update({
  [`classes/${CLASS}/profiles/${PROFILE}/meta/passHash`]:NEW_HASH,
  [`passes/${HASH}`]:null,[`passes/${NEW_HASH}`]:{classId:CLASS,profileId:PROFILE,createdAt:stamp()}
 }));
 await assertFails(remove(owner,`${PROFILE_PATH}/lease`),'The same UID cannot release after its pass membership is revoked');
 assert.equal((await read(staff(),`${PROFILE_PATH}/lease`)).val().uid,'student_one');
 await assertSucceeds(write(owner,`${ROOT}/sessions/student_one`,binding(CLASS,PROFILE,NEW_HASH)));
 await assertSucceeds(remove(owner,`${PROFILE_PATH}/lease`));
});

test('atomic pass reissue keeps progress while immediately revoking every old device and lease',async()=>{
 const owner=anonymous('student_one'),device=anonymous('second_device'),admin=staff();
 await assertSucceeds(ref(admin,ROOT).update({
  [`classes/${CLASS}/profiles/${PROFILE}/meta/passHash`]:NEW_HASH,
  [`passes/${HASH}`]:null,
  [`passes/${NEW_HASH}`]:{classId:CLASS,profileId:PROFILE,createdAt:stamp()}
 }));
 for(const database of [owner,device]){
  await assertFails(read(database,`${PROFILE_PATH}/state`));
  await assertFails(write(database,`${PROFILE_PATH}/state`,state()));
  await assertFails(write(database,`${PROFILE_PATH}/lease`,{uid:database===owner?'student_one':'second_device',expiresAt:stamp()+60000}));
 }
 await assertFails(read(anonymous('fresh_device'),`${ROOT}/passes/${HASH}`));
 await assertFails(write(owner,`${ROOT}/sessions/student_one`,binding()));
 await assertSucceeds(write(owner,`${ROOT}/sessions/student_one`,binding(CLASS,PROFILE,NEW_HASH)));
 const restored=await assertSucceeds(read(owner,`${PROFILE_PATH}/state`));assert.equal(restored.val().revision,1);assert.equal(restored.val().data.wallet.balance,150);
 // Knowing the fresh pass restores the session; that device still needs a
 // deliberate, current lease before saving if another device took over.
 await assertSucceeds(write(owner,`${PROFILE_PATH}/lease`,{uid:'student_one',expiresAt:stamp()+60000}));
 await assertSucceeds(write(owner,`${PROFILE_PATH}/state`,state()));
});

test('students cannot edit identity, passes, class labels, other profiles, or unknown namespace fields',async()=>{
 const student=anonymous('student_one');
 for(const [location,value]of [
  [`${PROFILE_PATH}/meta/alias`,'Changed alias'],[`${PROFILE_PATH}/meta/passHash`,NEW_HASH],
  [`${ROOT}/classes/${CLASS}/meta/label`,'Changed class'],[`${ROOT}/passes/${NEW_HASH}`,{classId:CLASS,profileId:PROFILE,createdAt:stamp()}],
  [`${ROOT}/unexpected`,true],[`${OTHER_PATH}/state`,state()]
 ])await assertFails(write(student,location,value));
 await assertFails(remove(student,`${ROOT}/classes/${CLASS}`));
});

test('the state envelope and DTO reject unknown/private fields, wrong types, and out-of-range values',async()=>{
 const student=anonymous('student_one');
 const invalid=[
  {...state(),email:'child@example.invalid'}, {...state(),schemaVersion:2}, {...state(),revision:2.5},
  {...state(),updatedAt:stamp()+120000},
 ];
 const mutate=action=>{const value=state();action(value.data);invalid.push(value);};
 mutate(data=>{data.name='Child real name';});mutate(data=>{data.avatar.name='Child real name';});
 mutate(data=>{data.avatar.form='unknown-form';});mutate(data=>{data.avatar.skin='not-a-color';});
 mutate(data=>{data.wallet.balance=-1;});mutate(data=>{data.wallet.balance=1000001;});
 mutate(data=>{data.progression.xp='100';});mutate(data=>{data.pitch.bestCompleted=1000;});
 mutate(data=>{data.piano.learned=['unlisted-melody'];});mutate(data=>{data.lessons.lessons['time-signatures'].step=9;});
 mutate(data=>{data.quizzes.quizzes['note-naming'].answers=[3];});mutate(data=>{data.songs={version:1,items:[]};});
 for(const [index,value]of invalid.entries())await assertFails(write(student,`${PROFILE_PATH}/state`,value),`Invalid DTO case ${index}`);
 await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state()));
});

test('bounded numeric array keys prevent oversized collections and arbitrary text maps',async()=>{
 const student=anonymous('student_one');
 for(const [slot,field,index,item]of [
  ['wallet','owned',256,'witch'],['wallet','rewards',4096,'game:triad:test'],
  ['progression','events',20000,{id:'game:triad:test',xp:10}],
  ['avatar','visited',4,0],['piano','learned',9,'twinkle']
 ]){
  const value=state();value.data[slot][field]={'0':item,[String(index)]:item};
  await assertFails(write(student,`${PROFILE_PATH}/state`,value));
 }
 const malicious=state();malicious.data.wallet.rewards={studentEmail:'child@example.invalid'};await assertFails(write(student,`${PROFILE_PATH}/state`,malicious));
});

test('school admins can atomically create/reissue/delete valid profiles but metadata remains closed',async()=>{
 const admin=staff(),newClass='classroom_0003',newProfile='profile_0003',now=stamp(),newHash='d'.repeat(64);
 await assertSucceeds(ref(admin,ROOT).update({
  [`directory/${newClass}/meta`]:{ownerUid:'school_admin',label:'Purple group',createdAt:now},
  [`directory/${newClass}/profiles/${newProfile}`]:{alias:'Purple Owl 4',picture:'owl'},
  [`classes/${newClass}/meta`]:{ownerUid:'school_admin',label:'Purple group',createdAt:now},
  [`classes/${newClass}/profiles/${newProfile}/meta`]:{alias:'Purple Owl 4',picture:'owl',createdAt:now,passHash:newHash},
  [`classes/${newClass}/profiles/${newProfile}/state`]:state(1),
  [`passes/${newHash}`]:{classId:newClass,profileId:newProfile,createdAt:now}
 }));
 await assertSucceeds(read(admin,`${ROOT}/classes/${newClass}`));
 await assertFails(write(admin,`${ROOT}/classes/${CLASS}/meta/ownerUid`,'ordinary_google'));
 await assertFails(write(admin,`${PROFILE_PATH}/meta/email`,'child@example.invalid'));
 await assertFails(write(admin,`${PROFILE_PATH}/meta/alias`,'A'.repeat(33)));
 await assertFails(write(admin,`${PROFILE_PATH}/meta/picture`,'dragon'));
 await assertFails(write(admin,`${ROOT}/passes/${'E'.repeat(64)}`,{classId:CLASS,profileId:PROFILE,createdAt:now}));
 await assertFails(write(admin,`${ROOT}/passes/${newHash}/privateNote`,'No extra fields'));
 await assertSucceeds(ref(admin,ROOT).update({[`directory/${newClass}`]:null,[`classes/${newClass}`]:null,[`passes/${newHash}`]:null}));
 await assertFails(read(anonymous('new_device'),`${ROOT}/passes/${newHash}`));
});

test('removing a class/profile or admin allowlist entry revokes access without changing unrelated rules',async()=>{
 const student=anonymous('student_one');await assertSucceeds(remove(staff(),PROFILE_PATH));
 await assertFails(read(student,`${PROFILE_PATH}/state`));await assertFails(write(student,`${PROFILE_PATH}/state`,state()));
 await env.withSecurityRulesDisabled(context=>remove(context.database(),`${ROOT}/admins/school_admin`));
 await assertFails(read(staff(),`${ROOT}/classes`));
 await assertFails(write(staff(),`${ROOT}/classes/another_class/meta`,{ownerUid:'school_admin',label:'Revoked',createdAt:stamp()}));
 assert.equal((await assertSucceeds(read(env.unauthenticatedContext().database(),'existingScores/top'))).val().score,123);
 await assertFails(write(student,'existingScores/top/score',900));
});

const TEACHER_PATH=`${ROOT}/teacherPlayers/school_admin`;
const teacherRecord=(revision=1,data=DTO.blank())=>({
 meta:{alias:'Your musician',picture:'owl',createdAt:stamp()},state:state(revision,data)
});

test('approved Google teachers create their own private player once and save only with revision CAS',async()=>{
 const owner=staff();
 assert.equal((await assertSucceeds(read(owner,TEACHER_PATH))).exists(),false,'The owner may check whether a personal player already exists');
 const initial=teacherRecord();
 const created=await assertSucceeds(ref(owner,TEACHER_PATH).transaction(current=>current===null?initial:undefined,undefined,false));
 assert.equal(created.committed,true);
 const first=(await assertSucceeds(read(owner,TEACHER_PATH))).val();
 assert.equal(first.meta.alias,'Your musician');assert.equal(first.meta.picture,'owl');assert.equal(first.state.revision,1);
 assert.equal(first.state.data.wallet.balance,150);
 const updated=DTO.blank();updated.wallet.balance=166;updated.wallet.earned=166;updated.wallet.rewards=['game:triad:teacher-fixture'];
 await assertSucceeds(write(owner,`${TEACHER_PATH}/state`,state(2,updated)));
 assert.equal((await read(owner,`${TEACHER_PATH}/state`)).val().data.wallet.balance,166);
 await assertFails(write(owner,`${TEACHER_PATH}/state`,state(2,updated)),'A stale writer cannot overwrite revision two');
 await assertFails(write(owner,`${TEACHER_PATH}/state`,state(4,updated)),'Revisions cannot be skipped');
 await assertSucceeds(write(owner,`${TEACHER_PATH}/state`,state(3,updated)));
 const secondSeed=await assertSucceeds(ref(owner,TEACHER_PATH).transaction(current=>current===null?teacherRecord():undefined,undefined,false));
 assert.equal(secondSeed.committed,false,'First-device seeding aborts when cloud progress already exists');
 assert.equal((await read(owner,`${TEACHER_PATH}/state`)).val().revision,3);
 await assertFails(write(owner,TEACHER_PATH,teacherRecord(4,updated)),'Existing whole records cannot be replaced by another initial seed');
});

test('teacher personal players cannot be listed or accessed by another approved teacher or any student identity',async()=>{
 const owner=staff(),other=google('other_admin');
 await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord()));
 const otherPath=`${ROOT}/teacherPlayers/other_admin`;
 await assertSucceeds(write(other,otherPath,teacherRecord()));
 const password=env.authenticatedContext('password_admin',{firebase:{sign_in_provider:'password'}}).database();
 const noProvider=env.authenticatedContext('school_admin',{}).database();
 for(const database of [env.unauthenticatedContext().database(),other,anonymous('student_one'),anonymous('school_admin'),google('ordinary_google'),password,noProvider]){
  await assertFails(read(database,TEACHER_PATH));
  await assertFails(write(database,`${TEACHER_PATH}/state`,state(2)));
  await assertFails(write(database,`${TEACHER_PATH}/meta/alias`,'Other musician'));
 }
 await assertFails(read(owner,otherPath));await assertFails(write(owner,`${otherPath}/state`,state(2)));
 for(const database of [owner,other,anonymous('student_one')]){
  await assertFails(read(database,`${ROOT}/teacherPlayers`));
  await assertFails(ref(database,`${ROOT}/teacherPlayers`).orderByKey().equalTo('school_admin').get());
 }
 for(const [database,uid]of [[google('ordinary_google'),'ordinary_google'],[anonymous('student_one'),'student_one'],[password,'password_admin'],[anonymous('school_admin'),'school_admin'],[noProvider,'school_admin']])
  await assertFails(write(database,`${ROOT}/teacherPlayers/${uid}`,teacherRecord()),'An exact UID alone cannot create a teacher player');
});

test('teacher player envelopes and metadata are closed, bounded, and exclude names and email fields',async()=>{
 const owner=staff(),invalid=[];
 const mutate=action=>{const value=teacherRecord();action(value);invalid.push(value);};
 mutate(value=>{value.name='Teacher real name';});mutate(value=>{value.email='teacher@example.invalid';});
 mutate(value=>{value.meta.name='Teacher real name';});mutate(value=>{value.meta.email='teacher@example.invalid';});
 mutate(value=>{value.meta.alias='';});mutate(value=>{value.meta.alias='A'.repeat(41);});mutate(value=>{value.meta.alias=123;});
 mutate(value=>{value.meta.picture='dragon';});mutate(value=>{value.meta.picture='https://example.invalid/photo';});
 mutate(value=>{value.meta.createdAt=-1;});mutate(value=>{value.meta.createdAt=stamp()+60000;});
 mutate(value=>{delete value.meta;});mutate(value=>{delete value.state;});
 mutate(value=>{value.state.email='teacher@example.invalid';});mutate(value=>{value.state.schemaVersion=2;});
 mutate(value=>{value.state.revision=0;});mutate(value=>{value.state.revision=2;});
 for(const [index,value]of invalid.entries())await assertFails(write(owner,TEACHER_PATH,value),`Closed teacher record case ${index}`);
 const valid=teacherRecord();valid.meta.alias='A'.repeat(40);
 await assertSucceeds(write(owner,TEACHER_PATH,valid));
 await assertSucceeds(write(owner,`${TEACHER_PATH}/meta/alias`,'Music teacher'));
 await assertSucceeds(write(owner,`${TEACHER_PATH}/meta/picture`,'cat'));
 await assertFails(write(owner,`${TEACHER_PATH}/meta/createdAt`,valid.meta.createdAt-1),'Creation time is immutable');
 await assertFails(write(owner,`${TEACHER_PATH}/unexpected`,true));
});

test('teacher player states use the exact closed student DTO and reject invalid data and partial saves',async()=>{
 const owner=staff();await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord()));
 const invalid=[];
 const mutate=action=>{const value=state(2);action(value);invalid.push(value);};
 mutate(value=>{value.data.name='Real teacher name';});mutate(value=>{value.data.avatar.name='Real teacher name';});
 mutate(value=>{value.data.wallet.balance=-1;});mutate(value=>{value.data.wallet.balance=1000001;});
 mutate(value=>{value.data.pitch.bestCompleted=1000;});mutate(value=>{value.data.progression.xp='500';});
 mutate(value=>{value.data.piano.learned=['unlisted-song'];});mutate(value=>{value.data.avatar.form='unlisted-form';});
 mutate(value=>{value.data.wallet.rewards={email:'teacher@example.invalid'};});
 mutate(value=>{value.updatedAt=stamp()+60000;});mutate(value=>{value.updatedAt=-1;});
 for(const [index,value]of invalid.entries())await assertFails(write(owner,`${TEACHER_PATH}/state`,value),`Canonical teacher DTO case ${index}`);
 await assertFails(write(owner,`${TEACHER_PATH}/state/data/wallet/balance`,900),'A partial update cannot bypass revision CAS');
 await assertSucceeds(write(owner,`${TEACHER_PATH}/state`,state(2)));
});

test('teacher player deletion remains unavailable and allowlist revocation immediately denies the owner',async()=>{
 const owner=staff();await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord()));
 for(const location of [TEACHER_PATH,`${TEACHER_PATH}/meta`,`${TEACHER_PATH}/state`])await assertFails(remove(owner,location));
 await assertFails(ref(owner,TEACHER_PATH).update({meta:null,state:null}));
 await env.withSecurityRulesDisabled(context=>remove(context.database(),`${ROOT}/admins/school_admin`));
 await assertFails(read(owner,TEACHER_PATH));await assertFails(write(owner,`${TEACHER_PATH}/state`,state(2)));
 let stored;await env.withSecurityRulesDisabled(async context=>{stored=await read(context.database(),TEACHER_PATH);});
 assert.equal(stored.val().state.revision,1,'Revocation does not destroy the private player');
 await env.withSecurityRulesDisabled(context=>write(context.database(),`${ROOT}/admins/school_admin`,true));
 await assertSucceeds(read(owner,TEACHER_PATH));
});

test('new quest journals save for both student and teacher owners without broadening access',async()=>{
 const data=DTO.blank(),schema=DTO.SCHEMA.properties.missions.properties.missions.properties;
 for(const [id,entry]of Object.entries(schema))data.missions.missions[id]={acceptedAt:100,progress:entry.properties.progress.maximum,completedAt:200,rewardedAt:0};
 data.missions.seen=['fishing:catch-fixture','piano:melody-fixture'];
 assert.equal(DTO.validate(data).ok,true);
 const student=anonymous('student_one'),owner=staff();
 await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state(2,data)));
 await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord(1,data)));
 for(const [database,location]of [[student,`${PROFILE_PATH}/state`],[owner,`${TEACHER_PATH}/state`]]){
  const restored=DTO.validate((await assertSucceeds(read(database,location))).val().data);
  assert.equal(restored.ok,true,restored.error);assert.deepEqual(restored.data,data);
 }
 await assertFails(read(anonymous('student_two'),`${PROFILE_PATH}/state`));
 await assertFails(write(google('other_admin'),`${TEACHER_PATH}/state`,state(2,data)));
 await assertFails(write(student,`${TEACHER_PATH}/state`,state(2,data)));
});

test('new quest progress remains target-bounded and rejects unknown and private fields for both owners',async()=>{
 const student=anonymous('student_one'),owner=staff();await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord()));
 const invalid=[],entry={acceptedAt:100,progress:1,completedAt:200,rewardedAt:0};
 const mutate=fn=>{const data=DTO.blank();data.missions.missions['miles-fish-legendary']={...entry};fn(data);invalid.push(data);};
 mutate(data=>{data.missions.missions['miles-fish-legendary'].progress=2;});
 mutate(data=>{data.missions.missions['miles-fish-legendary'].childName='Private name';});
 mutate(data=>{data.missions.missions['ella-fish-five']={...entry,progress:6};});
 mutate(data=>{data.missions.missions['joplin-rhythm-hundred']={...entry,progress:101};});
 mutate(data=>{data.missions.missions['unlisted-new-quest']={...entry};});
 for(const data of invalid){
  await assertFails(write(student,`${PROFILE_PATH}/state`,state(2,data)));
  await assertFails(write(owner,`${TEACHER_PATH}/state`,state(2,data)));
 }
 await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state(2)));
 await assertSucceeds(write(owner,`${TEACHER_PATH}/state`,state(2)));
});

test('all 24 guided and memory scales plus the new key lesson save for their owners only',async()=>{
 const data=DTO.blank(),tokens=DTO.SCHEMA.properties.piano.properties.completed.items.enum;
 data.piano.completed=[...tokens];data.wallet.rewards=[...tokens];data.wallet.balance=data.wallet.earned=10000;
 data.progression.events=tokens.map(id=>({id:'quest:'+id,xp:100}));
 data.progression.events.push({id:'achievement:piano-memory-master',xp:250},{id:'achievement:classroom-major-minor-keys',xp:50});
 data.progression.xp=data.progression.events.reduce((sum,event)=>sum+event.xp,0);
 data.lessons.lessons['major-minor-keys']={step:8,completed:true,completedAt:400};
 data.quizzes.quizzes['major-minor-keys']={bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:400};
 assert.equal(DTO.validate(data).ok,true);assert.equal(tokens.length,80);
 await assertSucceeds(write(anonymous('student_one'),`${PROFILE_PATH}/state`,state(2,data)));
 await assertSucceeds(write(staff(),TEACHER_PATH,teacherRecord(1,data)));
 await assertFails(read(anonymous('student_two'),`${PROFILE_PATH}/state`));
 await assertFails(write(google('other_admin'),`${TEACHER_PATH}/state`,state(2,data)));
 const malformed=clone(data);malformed.piano.completed[79]='piano-scale-memory:private-free-text';
 await assertFails(write(anonymous('student_one'),`${PROFILE_PATH}/state`,state(3,malformed)));
 const invalid=clone(data);invalid.lessons.lessons['major-minor-keys'].step=9;
 await assertFails(write(staff(),`${TEACHER_PATH}/state`,state(2,invalid)));
 const legacy=DTO.blank();delete legacy.lessons.lessons['major-minor-keys'];delete legacy.quizzes.quizzes['major-minor-keys'];
 await assertSucceeds(write(staff(),`${TEACHER_PATH}/state`,state(2,legacy)));
});


test('Dynamics and Tempo progress and optional final exam fields save only inside their existing owner boundaries',async()=>{
 const student=anonymous('student_one'),owner=staff(),data=DTO.blank();
 for(const [id,answers]of Object.entries({dynamics:[0,1,2,0,1],tempo:[1,0,2,1,0]})){
  data.lessons.lessons[id]={step:8,completed:true,completedAt:400};data.quizzes.quizzes[id]={bankVersion:1,index:5,answers,bestAnswers:answers,completedAt:400};
  data.progression.events.push({id:'achievement:classroom-'+id,xp:50});data.progression.xp+=50;
 }
 assert.equal(DTO.validate(data).ok,true);await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state(2,data)));
 await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord(1,data)));
 await assertFails(read(anonymous('student_two'),`${PROFILE_PATH}/state`));await assertFails(write(google('other_admin'),`${TEACHER_PATH}/state`,state(2,data)));
 const invalid=clone(data);invalid.lessons.lessons.dynamics.step=9;
 await assertFails(write(student,`${PROFILE_PATH}/state`,state(3,invalid)));
 const extra=clone(data);extra.quizzes.quizzes.tempo.studentName='Private name';await assertFails(write(owner,`${TEACHER_PATH}/state`,state(2,extra)));
 const legacy=DTO.blank();delete legacy.finalExam;for(const id of ['dynamics','tempo']){delete legacy.lessons.lessons[id];delete legacy.quizzes.quizzes[id];}
 await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state(3,legacy)));await assertSucceeds(write(owner,`${TEACHER_PATH}/state`,state(2,legacy)));
 const required=clone(legacy);delete required.wallet;await assertFails(write(student,`${PROFILE_PATH}/state`,state(4,required)));
});

test('final exam rules validate exact bounded private state for both teacher and student records',async()=>{
 const student=anonymous('student_one'),owner=staff(),data=DTO.blank(),exam=data.finalExam;
 exam.size=80;exam.questionIds=Object.keys(exam.bestByCategory).flatMap(category=>Array.from({length:10},(_,index)=>category+'-'+String(index+1).padStart(3,'0')));exam.orders=exam.questionIds.map((_,index)=>index%6);exam.answers=exam.questionIds.map(()=>-1);exam.index=79;
 assert.equal(DTO.validate(data).ok,true);await assertSucceeds(write(student,`${PROFILE_PATH}/state`,state(2,data)));await assertSucceeds(write(owner,TEACHER_PATH,teacherRecord(1,data)));
 const invalid=[];const mutate=change=>{const value=clone(data);change(value.finalExam,value);invalid.push(value);};
 mutate(exam=>{exam.studentName='Private name';});mutate(exam=>{exam.version=2;});mutate(exam=>{exam.bankVersion=2;});mutate(exam=>{exam.size=32;});
 mutate(exam=>{exam.questionIds[0]='note-naming-000';});mutate(exam=>{exam.questionIds[0]='tempo-101';});mutate(exam=>{exam.questionIds[0]='private-name-001';});
 mutate(exam=>{exam.questionIds={'0':'note-naming-001','80':'tempo-100'};});mutate(exam=>{exam.orders[0]=6;});mutate(exam=>{exam.answers[0]=3;});mutate(exam=>{exam.answers[0]=-2;});
 mutate(exam=>{exam.index=81;});mutate(exam=>{exam.attempts=100001;});mutate(exam=>{exam.bestPercent=101;});mutate(exam=>{exam.bestScore=81;});mutate(exam=>{exam.bestTotal=20;});
 mutate(exam=>{exam.bestByCategory.tempo.correct=11;});mutate(exam=>{exam.bestByCategory.dynamics.total=-1;});mutate(exam=>{exam.bestByCategory.dynamics.studentName='Private';});
 mutate(exam=>{exam.completedAt=253402300800000;});mutate((exam,value)=>{value.songMachineDraft={title:'Private local song'};});
 for(const [index,value]of invalid.entries()){
  await assertFails(write(student,`${PROFILE_PATH}/state`,state(3,value)),`Final exam student case ${index}`);
  await assertFails(write(owner,`${TEACHER_PATH}/state`,state(2,value)),`Final exam teacher case ${index}`);
 }
 await assertFails(write(student,`${PROFILE_PATH}/state/data/finalExam/index`,1),'Direct partial state writes remain unavailable');
 await assertFails(write(anonymous('student_two'),`${PROFILE_PATH}/state`,state(3,data)));await assertFails(write(google('other_admin'),`${TEACHER_PATH}/state`,state(2,data)));
});
