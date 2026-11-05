'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const publisher=require('../classroom-material-publisher.js');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const hash=raw=>createHash('sha256').update('coda-classroom-pass:v1:'+raw).digest('hex');
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function read(tree,path){let value=tree;for(const key of path.split('/')){if(!value||!own(value,key))return null;value=value[key];}return value??null;}
function write(tree,path,value){const keys=path.split('/');let current=tree;for(const key of keys.slice(0,-1)){if(!own(current,key))current[key]={};current=current[key];}current[keys.at(-1)]=clone(value);}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
function material(id,userId,link,extra={}){return {id,state:'PUBLISHED',assigneeMode:'INDIVIDUAL_STUDENTS',individualStudentsOptions:{studentIds:[userId]},materials:[{link:{url:link}}],...extra};}
function fixture(count=2){
 const f={tree:{},students:[],cards:[],materials:[],posts:[],transactions:[],reads:[],controls:{},time:100000,random:0,context:{uid:'teacher_fixture_1',signedIn:true,authorized:true,identity:'teacher-epoch-1'}};
 const courseId='course_fixture_1',classId='class_fixture_1',base='classroomImports/'+f.context.uid+'/'+courseId;
 write(f.tree,base,{classId,createdAt:100,updatedAt:100,students:{},profileLinks:{}});write(f.tree,'classes/'+classId+'/meta',{label:'Music class',ownerUid:f.context.uid,createdAt:100});
 f.addStudent=index=>{
  const userId='student_fixture_'+index,profileId='profile_fixture_'+index,raw='PRIVATE-PASS-'+index,alias='Blue Fox '+(10+index),link='https://school.example/world-preview.html#classroom-pass='+raw;
  const student={userId,name:'PRIVATE STUDENT '+index},card={userId,profileId,alias,pass:raw,link};f.students.push(student);f.cards.push(card);
  write(f.tree,base+'/students/'+userId,{profileId,createdAt:100});write(f.tree,base+'/profileLinks/'+profileId,userId);
  write(f.tree,'classes/'+classId+'/profiles/'+profileId,{meta:{alias,picture:'fox',passHash:hash(raw),createdAt:100},state:{revision:9,data:{xp:900,balance:540}}});
  write(f.tree,'passes/'+hash(raw),{classId,profileId,createdAt:100});
  return card;
 };
 for(let i=1;i<=count;i++)f.addStudent(i);
 f.path=card=>base+'/deliveries/'+card.userId+'/'+hash(card.pass);
 f.ledger=(card,patch={})=>({profileId:card.profileId,attemptId:'a'.repeat(32),state:'claimed',leaseUntil:f.time+90000,createdAt:500,updatedAt:f.time,...patch});
 f.options={clock:()=>f.time,getContext:()=>f.context,online:async()=>f.controls.online!==false,
  read:async path=>{f.reads.push(path);await f.controls.beforeRead?.(path);return clone(read(f.tree,path));},
  transaction:async(path,updater)=>{await f.controls.beforeTransaction?.(path);const previous=clone(read(f.tree,path)),next=updater(previous);
   if(next===undefined)return {committed:false,snapshot:clone(previous)};
   if(f.controls.denyLedger||f.controls.denyPosted&&next.state==='posted')throw Object.assign(Error('private backend details'),{code:'PERMISSION_DENIED'});
   f.transactions.push({path,next:clone(next)});write(f.tree,path,next);return {committed:true,snapshot:clone(next)};},
  parseProfileLink:link=>{try{const url=new URL(link);if(url.origin!=='https://school.example'||url.pathname!=='/world-preview.html'||url.search)return null;const rawPass=new URLSearchParams(url.hash.slice(1)).get('classroom-pass');return rawPass?{rawPass,link:url.href}:null;}catch{return null;}},
  hashPass:async raw=>hash(raw),random:size=>Uint8Array.from({length:size},(_,index)=>(++f.random+index)%256),serverTimestamp:()=>f.time,
  google:{getState:()=>({canPublish:f.controls.canPublish!==false}),
   listProfileMaterials:async()=>{await f.controls.beforeList?.();return f.controls.listError||{ok:true,materials:clone(f.materials)};},
   createProfileMaterial:async request=>{f.posts.push(clone(request));await f.controls.beforeCreate?.(request);
    if(f.controls.throwCreate)throw Error('network response lost');
    const id='material_'+(f.posts.length+100);
    if(!f.controls.createError||f.controls.commitUncertain)f.materials.push(material(id,request.userId,request.link));
    return f.controls.createError||{ok:true,materialId:id};}}
 };
 f.client=publisher.create(f.options);f.request=cards=>({courseId,students:clone(f.students),cards:clone(cards??f.cards)});f.preview=cards=>f.client.previewPosts(f.request(cards));
 f.publish=async()=>{const plan=await f.preview();assert.equal(plan.ok,true,JSON.stringify(plan));return f.client.publishPosts({planId:plan.planId,confirmed:true});};
 return f;
}

test('preview is read-only, bounded, private, and requires explicit publishing permission',async()=>{
 const f=fixture(),before=clone(f.tree),result=await f.preview();assert.equal(result.ok,true);assert.equal(result.ready,2);assert.equal(result.rows[0].name,'PRIVATE STUDENT 1');
 assert.deepEqual(f.posts,[]);assert.deepEqual(f.transactions,[]);assert.deepEqual(f.tree,before);
 assert.doesNotMatch(JSON.stringify(result),/https:|PRIVATE-PASS/);assert.deepEqual(f.client.getState(),{busy:false,hasPlan:true});
 f.controls.canPublish=false;assert.equal((await f.preview()).code,'publish-permission-required');assert.equal(f.posts.length,0);
});
test('only an explicit matching confirmed plan publishes and only ledger records change',async()=>{
 const f=fixture(),before=clone(f.tree),plan=await f.preview();
 assert.equal((await f.client.publishPosts({planId:plan.planId})).code,'publish-confirmation-required');
 assert.equal((await f.client.publishPosts({planId:'wrong',confirmed:true})).code,'publish-plan-required');assert.equal(f.posts.length,0);
 const result=await f.client.publishPosts({planId:plan.planId,confirmed:true});assert.equal(result.ok,true);assert.equal(result.posted,2);assert.equal(f.posts.length,2);
 assert.deepEqual(f.tree.classes,before.classes);assert.deepEqual(read(f.tree,'classroomImports/teacher_fixture_1/course_fixture_1/students'),read(before,'classroomImports/teacher_fixture_1/course_fixture_1/students'));
 for(const card of f.cards){const ledger=read(f.tree,f.path(card));assert.equal(ledger.state,'posted');assert.match(ledger.attemptId,/^[a-f0-9]{32}$/);assert.equal(ledger.profileId,card.profileId);assert.equal(ledger.leaseUntil,0);}
 assert.deepEqual(f.transactions.map(row=>row.next.state),['claimed','sending','posted','claimed','sending','posted']);
 const stored=JSON.stringify(f.tree);assert.doesNotMatch(stored,/https:|PRIVATE-PASS|PRIVATE STUDENT/);
 assert.deepEqual(f.posts.map(row=>row.userId),f.students.map(row=>row.userId));assert.ok(f.posts.every(row=>row.title.startsWith('Your Coda Arcade profile')));
});
test('a later append posts only the newcomer and leaves prior materials and profile state untouched',async()=>{
 const f=fixture();assert.equal((await f.publish()).posted,2);const oldMaterials=clone(f.materials),oldProfiles=clone(f.tree.classes),oldLedger=clone(read(f.tree,'classroomImports/teacher_fixture_1/course_fixture_1/deliveries'));
 const newcomer=f.addStudent(3),plan=await f.preview([newcomer]);assert.equal(plan.ready,1);assert.equal(plan.alreadyPosted,2);
 const result=await f.client.publishPosts({planId:plan.planId,confirmed:true});assert.equal(result.posted,1);assert.equal(result.alreadyPosted,2);assert.equal(f.posts.length,3);assert.deepEqual(f.materials.slice(0,2),oldMaterials);
 for(const [id,profile]of Object.entries(oldProfiles.class_fixture_1.profiles))assert.deepEqual(f.tree.classes.class_fixture_1.profiles[id],profile);
 for(const [id,ledger]of Object.entries(oldLedger))assert.deepEqual(read(f.tree,'classroomImports/teacher_fixture_1/course_fixture_1/deliveries/'+id),ledger);
 assert.equal((await f.publish()).posted,0);assert.equal(f.posts.length,3);
});
test('existing manually posted private links are recognized without needing saved receipt links',async()=>{
 const f=fixture();f.materials=f.cards.map((card,index)=>material('manual_'+index,card.userId,card.link));
 const plan=await f.preview([]);assert.equal(plan.alreadyPosted,2);assert.equal(plan.ready,0);assert.equal(plan.unavailable,0);
 const result=await f.client.publishPosts({planId:plan.planId,confirmed:true});assert.equal(result.posted,0);assert.equal(result.alreadyPosted,2);assert.equal(f.posts.length,0);
 assert.ok(f.cards.every(card=>read(f.tree,f.path(card)).state==='posted'));
});
test('missing old links are never regenerated, while ready newcomers can still be posted',async()=>{
 const f=fixture(),plan=await f.preview([f.cards[1]]);assert.equal(plan.unavailable,1);assert.equal(plan.ready,1);
 const result=await f.client.publishPosts({planId:plan.planId,confirmed:true});assert.equal(result.posted,1);assert.equal(result.unavailable,1);assert.deepEqual(f.posts.map(row=>row.userId),[f.cards[1].userId]);
});
test('wrong recipients, whole-class materials, drafts, deleted and mixed attachments require review',async()=>{
 const variants=[{individualStudentsOptions:{studentIds:['other_student']}},{assigneeMode:'ALL_STUDENTS',individualStudentsOptions:{}},{state:'DRAFT'},{state:'DELETED'},{materials:[{link:{url:'LINK'}},{driveFile:{}}]}];
 for(const variant of variants){const f=fixture(1),patch=clone(variant);if(patch.materials)patch.materials[0].link.url=f.cards[0].link;f.materials=[material('existing_1',f.cards[0].userId,f.cards[0].link,patch)];const plan=await f.preview();assert.equal(plan.uncertain,1);assert.equal(plan.ready,0);const result=await f.client.publishPosts({planId:plan.planId,confirmed:true});assert.equal(result.posted,0);assert.equal(f.posts.length,0);}
});
test('forged links, wrong mappings and unapproved sessions fail before a delivery claim or Google post',async()=>{
 const f=fixture(1);for(const patch of [{link:'https://evil.example/world-preview.html#classroom-pass=PRIVATE-PASS-1'},{profileId:'profile_wrong'},{link:'https://school.example/world-preview.html#classroom-pass=wrong'}]){
  assert.equal((await f.preview([{...f.cards[0],...patch}])).code,'invalid-profile-link');
 }
 f.context.authorized=false;assert.equal((await f.preview()).code,'admin-required');assert.equal(f.posts.length,0);assert.equal(f.transactions.length,0);
});
test('a receipt cannot be delivered when its pass actually opens another profile',async()=>{
 const f=fixture(1);write(f.tree,'passes/'+hash(f.cards[0].pass),{classId:'class_other',profileId:'profile_other',createdAt:100});
 assert.equal((await f.preview()).code,'invalid-profile-link');assert.equal((await f.preview([])).unavailable,1);assert.equal(f.posts.length,0);
 const valid=fixture(1),preview=await valid.preview();write(valid.tree,'passes/'+hash(valid.cards[0].pass),{classId:'class_fixture_1',profileId:'profile_other',createdAt:100});
 const result=await valid.client.publishPosts({planId:preview.planId,confirmed:true});assert.equal(result.failed,1);assert.equal(result.rows[0].code,'profile-link-changed');assert.equal(valid.posts.length,0);
});
test('a committed post with a lost response is reconciled without posting it twice',async()=>{
 const f=fixture(1);f.controls.createError={ok:false,code:'material-publish-failed',uncertain:true};f.controls.commitUncertain=true;
 const first=await f.publish();assert.equal(first.uncertain,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'uncertain');assert.equal(f.posts.length,1);
 f.controls.createError=null;const preview=await f.preview();assert.equal(preview.alreadyPosted,1);
 const second=await f.client.publishPosts({planId:preview.planId,confirmed:true});assert.equal(second.posted,0);assert.equal(second.alreadyPosted,1);assert.equal(f.posts.length,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'posted');
});
test('unknown delivery outcomes never auto-retry even after the sending lease expires',async()=>{
 const f=fixture(1);f.controls.createError={ok:false,code:'material-publish-failed',uncertain:true};const first=await f.publish();assert.equal(first.uncertain,1);assert.equal(f.materials.length,0);f.time+=180000;
 f.controls.createError=null;const second=await f.publish();assert.equal(second.uncertain,1);assert.equal(second.posted,0);assert.equal(f.posts.length,1);
});
test('the first uncertain outcome pauses the batch, then reconciliation sends only the remaining links',async()=>{
 const f=fixture(3);f.controls.createError={ok:false,code:'classroom-timeout',uncertain:true};f.controls.commitUncertain=true;
 const first=await f.publish();assert.equal(first.uncertain,1);assert.equal(first.failed,2);assert.equal(f.posts.length,1);assert.equal(f.materials.length,1);
 assert.ok(first.rows.slice(1).every(row=>row.status==='failed'&&row.code==='posting-paused'));
 f.controls.createError=null;const second=await f.publish();assert.equal(second.alreadyPosted,1);assert.equal(second.posted,2);assert.equal(f.posts.length,3);assert.equal(f.materials.length,3);
 const tracking=fixture();tracking.controls.denyPosted=true;const paused=await tracking.publish();assert.equal(paused.uncertain,1);assert.equal(paused.failed,1);assert.equal(tracking.posts.length,1);
 tracking.controls.denyPosted=false;const finished=await tracking.publish();assert.equal(finished.alreadyPosted,1);assert.equal(finished.posted,1);assert.equal(tracking.posts.length,2);
});
test('definitive rate-limit failure pauses the batch and can be retried after a fresh preview',async()=>{
 const f=fixture();f.controls.createError={ok:false,code:'classroom-rate-limited',uncertain:false};const first=await f.publish();assert.equal(first.failed,2);assert.equal(f.posts.length,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'failed');
 f.controls.createError=null;const second=await f.publish();assert.equal(second.posted,2);assert.equal(f.posts.length,3);assert.equal(f.materials.length,2);
});
test('only expired un-sent claims can be reclaimed, preserving their original creation timestamp',async()=>{
 const f=fixture(1),card=f.cards[0];write(f.tree,f.path(card),f.ledger(card));assert.equal((await f.preview()).busy,1);
 f.time+=100000;const result=await f.publish();assert.equal(result.posted,1);const final=read(f.tree,f.path(card));assert.equal(final.createdAt,500);assert.notEqual(final.attemptId,'a'.repeat(32));
});
test('two publishers cannot race a second post for the same student and pass',async()=>{
 const f=fixture(1),other=publisher.create(f.options),p1=await f.preview(),p2=await other.previewPosts(f.request()),entered=deferred(),release=deferred();
 f.controls.beforeCreate=async()=>{entered.resolve();await release.promise;};const first=f.client.publishPosts({planId:p1.planId,confirmed:true});await entered.promise;
 const second=await other.publishPosts({planId:p2.planId,confirmed:true});assert.equal(second.posted,0);assert.equal(second.uncertain,1);assert.equal(f.posts.length,1);
 release.resolve();assert.equal((await first).posted,1);assert.equal(f.materials.length,1);
});
test('missing delivery permissions prevent the external write, and a failed post-save is reconciled later',async()=>{
 const denied=fixture(1);denied.controls.denyLedger=true;const rejected=await denied.publish();assert.equal(rejected.ok,false);assert.equal(rejected.code,'posting-setup-required');assert.equal(denied.posts.length,0);
 const f=fixture(1);f.controls.denyPosted=true;const first=await f.publish();assert.equal(first.uncertain,1);assert.equal(f.posts.length,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'sending');
 f.controls.denyPosted=false;const second=await f.publish();assert.equal(second.alreadyPosted,1);assert.equal(second.posted,0);assert.equal(f.posts.length,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'posted');
});
test('a thrown transport failure after dispatch is uncertain and never treated as a safe retry',async()=>{
 const f=fixture(1);f.controls.throwCreate=true;const first=await f.publish();assert.equal(first.uncertain,1);assert.equal(read(f.tree,f.path(f.cards[0])).state,'uncertain');
 f.controls.throwCreate=false;assert.equal((await f.publish()).uncertain,1);assert.equal(f.posts.length,1);
});
test('a batch never adds a recipient who was not ready in the teacher-confirmed preview',async()=>{
 const f=fixture(),card=f.cards[0];f.materials=[material('manual_1',card.userId,card.link)];const preview=await f.preview();assert.equal(preview.ready,1);assert.equal(preview.alreadyPosted,1);
 f.materials=[];const result=await f.client.publishPosts({planId:preview.planId,confirmed:true});assert.equal(result.posted,1);assert.equal(result.uncertain,1);assert.deepEqual(f.posts.map(row=>row.userId),[f.cards[1].userId]);
});
test('profile changes, expired plans, offline status and lost sessions stop further writes',async()=>{
 const f=fixture(1),preview=await f.preview();write(f.tree,'classes/class_fixture_1/profiles/'+f.cards[0].profileId+'/meta/passHash','b'.repeat(64));const changed=await f.client.publishPosts({planId:preview.planId,confirmed:true});assert.equal(changed.failed,1);assert.equal(f.posts.length,0);
 const expired=fixture(1),plan=await expired.preview();expired.time+=600001;assert.equal((await expired.client.publishPosts({planId:plan.planId,confirmed:true})).code,'publish-plan-expired');
 const offline=fixture(1);offline.controls.online=false;assert.equal((await offline.preview()).code,'offline');assert.equal(offline.posts.length,0);
 const stale=fixture(1),entered=deferred(),release=deferred();stale.controls.beforeList=async()=>{entered.resolve();await release.promise;};const pending=stale.preview();await entered.promise;stale.context={...stale.context,identity:'another-epoch'};release.resolve();assert.equal((await pending).code,'session-changed');assert.equal(stale.posts.length,0);
});
test('clearing during an in-flight post leaves a reconciliation guard and discards the old private result',async()=>{
 const f=fixture(1),preview=await f.preview(),entered=deferred(),release=deferred();f.controls.beforeCreate=async()=>{entered.resolve();await release.promise;};
 const pending=f.client.publishPosts({planId:preview.planId,confirmed:true});await entered.promise;f.client.clear();release.resolve();const result=await pending;assert.equal(result.code,'session-changed');assert.deepEqual(f.client.getState(),{busy:false,hasPlan:false});assert.equal(read(f.tree,f.path(f.cards[0])).state,'sending');
 f.controls.beforeCreate=null;assert.equal((await f.publish()).alreadyPosted,1);assert.equal(f.posts.length,1);
});
