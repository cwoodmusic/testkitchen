'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {mergeClassroomRules,mergeClassroomImportRules,mergeClassroomDeliveryRules}=require('../tools/classroom-rules-merge.cjs');
const fragment={rules:{classroomV1:{'.read':false,'.write':false,admins:{'.write':false}}}};

test('delivery-only upgrade preserves prior import rules and every other namespace',()=>{
 const node=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/GOOGLE-CLASSROOM-IMPORT-RULES.json'),'utf8'));
 const oldNode=JSON.parse(JSON.stringify(node.classroomImports));delete oldNode.$teacherUid.$courseId.deliveries;
 const base={rules:{'.read':false,'.write':false,rooms:{'.read':'roomPermission'},classroomV1:{'.read':false,'.write':false,classes:{'.write':'staff'},classroomImports:oldNode,$other:{'.validate':false}}}};
 const before=JSON.stringify(base),candidate=mergeClassroomDeliveryRules(base,node);
 assert.equal(JSON.stringify(base),before);
 const delivery=candidate.rules.classroomV1.classroomImports.$teacherUid.$courseId.deliveries;
 delete candidate.rules.classroomV1.classroomImports.$teacherUid.$courseId.deliveries;
 assert.deepEqual(candidate,base);assert.deepEqual(delivery,node.classroomImports.$teacherUid.$courseId.deliveries);
 const final=mergeClassroomDeliveryRules(base,node);assert.deepEqual(mergeClassroomDeliveryRules(final,node),final);
 const absent=JSON.parse(before);delete absent.rules.classroomV1.classroomImports;
 assert.deepEqual(mergeClassroomDeliveryRules(absent,node),mergeClassroomImportRules(absent,node));
 const unknown=JSON.parse(before);unknown.rules.classroomV1.classroomImports.$teacherUid.$courseId.classId['.validate']='changed';
 assert.throws(()=>mergeClassroomDeliveryRules(unknown,node),/outside the delivery ledger/);
 const existing=JSON.parse(JSON.stringify(final));existing.rules.classroomV1.classroomImports.$teacherUid.$courseId.deliveries['.read']=true;
 assert.throws(()=>mergeClassroomDeliveryRules(existing,node),/different permissions/);
 const grant=JSON.parse(before);grant.rules.classroomV1['.read']=true;
 assert.throws(()=>mergeClassroomDeliveryRules(grant,node),/inherited import access/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'coda-delivery-rules-merge-'));
 try{
  const backup=path.join(dir,'backup.json'),out=path.join(dir,'candidate.json');fs.writeFileSync(backup,before);
  const result=spawnSync(process.execPath,[path.join(__dirname,'../tools/classroom-rules-merge.cjs'),'--base',backup,'--out',out,'--add-classroom-deliveries'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const report=JSON.parse(result.stdout);
  assert.equal(report.deployed,false);assert.match(report.changedNamespace,/\/deliveries$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(out,'utf8')),final);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('additive Classroom import merge preserves every existing rule and refuses unsafe ancestors or unreviewed replacement',()=>{
 const node=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/GOOGLE-CLASSROOM-IMPORT-RULES.json'),'utf8'));
 const base={rules:{'.read':false,'.write':false,rooms:{'.read':true},classroomV1:{'.read':false,'.write':false,classes:{'.write':'approved'},developerAccess:{'.read':'owner'},$other:{'.validate':false}}}};
 const before=JSON.stringify(base),candidate=mergeClassroomImportRules(base,node);
 assert.equal(JSON.stringify(base),before);assert.deepEqual(candidate.rules.rooms,base.rules.rooms);
 const imported=candidate.rules.classroomV1.classroomImports;delete candidate.rules.classroomV1.classroomImports;
 assert.deepEqual(candidate,base);assert.deepEqual(imported,node.classroomImports);
 assert.deepEqual(mergeClassroomImportRules(mergeClassroomImportRules(base,node),node),mergeClassroomImportRules(base,node));
 for(const location of ['root','namespace'])for(const permission of ['.read','.write']){
  const invalid=JSON.parse(before);(location==='root'?invalid.rules:invalid.rules.classroomV1)[permission]=true;
  assert.throws(()=>mergeClassroomImportRules(invalid,node),/inherited import access/);
 }
 const wildcard=JSON.parse(before);wildcard.rules.classroomV1.$other['.read']=true;
 assert.throws(()=>mergeClassroomImportRules(wildcard,node),/wildcard/);
 const existing=JSON.parse(before);existing.rules.classroomV1.classroomImports={'.read':false,'.write':false};
 assert.throws(()=>mergeClassroomImportRules(existing,node),/different rules/);
 assert.throws(()=>mergeClassroomImportRules(base,{...node,unrelated:{}}),/only classroomImports/);
});

test('offline merge preserves every existing namespace and does not mutate its inputs',()=>{
 const base={rules:{'.read':false,'.write':'false',leaderboards:{'.read':true},arcadeProfiles:{$uid:{'.read':'auth.uid === $uid'}},'.indexOn':['score']}};
 const before=JSON.stringify(base),source=JSON.stringify(fragment),candidate=mergeClassroomRules(base,fragment);
 assert.equal(JSON.stringify(base),before);assert.equal(JSON.stringify(fragment),source);
 assert.deepEqual(candidate,{rules:{...base.rules,classroomV1:fragment.rules.classroomV1}});
});

test('public or unknown ancestor grants are refused instead of pretending child denials protect students',()=>{
 for(const permission of ['.read','.write'])for(const grant of [true,'true','auth != null','root.child("public").val() === true',null,42]){
  assert.throws(()=>mergeClassroomRules({rules:{[permission]:grant}},fragment),/Child denials cannot override ancestor grants/);
 }
 for(const wildcard of ['$other','$namespace'])assert.throws(()=>mergeClassroomRules({rules:{[wildcard]:{'.read':true}}},fragment),/wildcard/);
});

test('an existing classroom namespace requires explicit replacement and unknown fragments are rejected',()=>{
 const base={rules:{classroomV1:{old:true},preserve:{'.read':true}}};
 assert.throws(()=>mergeClassroomRules(base,fragment),/--replace-classroom/);
 assert.deepEqual(mergeClassroomRules(base,fragment,{replaceClassroom:true}).rules.preserve,base.rules.preserve);
 assert.throws(()=>mergeClassroomRules({},fragment),/complete existing rules/);
 assert.throws(()=>mergeClassroomRules({rules:{}},{rules:{classroomV1:{},other:{}}}),/only rules.classroomV1/);
 assert.throws(()=>mergeClassroomRules({rules:{}},{rules:{classroomV1:{'.read':true}}}),/must not grant namespace-wide/);
});

test('CLI prepares a private new candidate/config only and will not overwrite any reviewed file',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'coda-rules-merge-'));
 try{
  const base=path.join(dir,'backup.json'),part=path.join(dir,'fragment.json'),out=path.join(dir,'candidate.json'),config=path.join(dir,'firebase.json');
  fs.writeFileSync(base,JSON.stringify({rules:{leaderboards:{'.read':true}}}));fs.writeFileSync(part,JSON.stringify(fragment));
  const helper=path.join(__dirname,'../tools/classroom-rules-merge.cjs'),args=[helper,'--base',base,'--fragment',part,'--out',out,'--firebase-config',config,'--instance','demo-classroom-default-rtdb'];
  const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);assert.equal(report.deployed,false);assert.equal(report.requiresReview,true);assert.match(report.candidateSha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')).database,[{instance:'demo-classroom-default-rtdb',rules:out}]);
  assert.equal(fs.statSync(out).mode&0o777,0o600);const existing=fs.readFileSync(out,'utf8');
  const repeated=spawnSync(process.execPath,args,{encoding:'utf8'});assert.notEqual(repeated.status,0);assert.match(repeated.stderr,/Refusing to overwrite/);assert.equal(fs.readFileSync(out,'utf8'),existing);
  assert.equal(spawnSync(process.execPath,[helper,'--base',base,'--fragment',part,'--out',base],{encoding:'utf8'}).status,1);
  const invalid=path.join(dir,'invalid.json');fs.writeFileSync(invalid,'a-private-value-that-must-not-be-logged');
  const failed=spawnSync(process.execPath,[helper,'--base',invalid,'--fragment',part,'--out',path.join(dir,'unused.json')],{encoding:'utf8'});
  assert.equal(failed.status,1);assert.match(failed.stderr,/not valid JSON/);assert.doesNotMatch(failed.stderr,/a-private-value/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
