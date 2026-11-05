#!/usr/bin/env node
/* Offline generator. The canonical DTO schema owns its field/value contract.
 * RTDB stores empty objects/arrays as absent nodes. Array index caps, closed
 * fields and scalar constraints are enforced here; uniqueness, dense arrays,
 * journal arithmetic, reward consistency and the 8 MiB ceiling remain client
 * validation. This file never authenticates, downloads or deploys anything. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');

const ID_PATTERN='^[A-Za-z0-9_-]{8,64}$';
const HASH_PATTERN='^[a-f0-9]{64}$';
const literal=value=>JSON.stringify(value);
const join=parts=>parts.filter(Boolean).map(value=>'('+value+')').join(' && ');
const matches=(expression,pattern)=>expression+'.matches(/'+pattern.replaceAll('/','\\/')+'/)';
const objectCondition='newData.hasChildren()';
const closed=children=>({...children,$other:{'.validate':false}});
const integer=(expression,minimum,maximum)=>join([expression+'.isNumber()',expression+'.val() % 1 === 0',expression+'.val() >= '+minimum,expression+'.val() <= '+maximum]);
const string=(expression,minimum,maximum,pattern)=>join([expression+'.isString()',expression+'.val().length >= '+minimum,expression+'.val().length <= '+maximum,pattern&&matches(expression+'.val()',pattern)]);
const at=(snapshot,child)=>snapshot+'.child('+literal(child)+')';
const rootAt=child=>at('root',child);
const classNode=id=>rootAt('classroomV1/classes')+'.child('+id+')';
const profileNode=(classId,profileId)=>classNode(classId)+'.child("profiles").child('+profileId+')';
const google='auth !== null && auth.token.firebase.sign_in_provider === "google.com"';
const anonymous='auth !== null && auth.token.firebase.sign_in_provider === "anonymous"';
const admin=join([google,rootAt('classroomV1/admins')+'.child(auth.uid).val() === true']);
const ownSession=rootAt('classroomV1/sessions')+'.child(auth.uid)';
const currentHash=(classId,profileId)=>profileNode(classId,profileId)+'.child("meta/passHash").val()';
const passMatches=(hash,classId,profileId)=>join([
 rootAt('classroomV1/passes')+'.child('+hash+').child("classId").val() === '+classId,
 rootAt('classroomV1/passes')+'.child('+hash+').child("profileId").val() === '+profileId,
 currentHash(classId,profileId)+' === '+hash
]);
const validStudent=(classId='$classId',profileId='$profileId')=>join([
 anonymous,ownSession+'.child("classId").val() === '+classId,
 ownSession+'.child("profileId").val() === '+profileId,
 passMatches(ownSession+'.child("passHash").val()',classId,profileId)
]);

// Compact exact decimal range: no negative/leading-zero/non-numeric keys, and
// no sparse key beyond maxItems-1. Firebase rules cannot count array children.
function arrayIndexRegex(maxItems){
 if(!Number.isSafeInteger(maxItems)||maxItems<1||maxItems>1000000)throw Error('An array needs a positive bounded maxItems.');
 const maximum=String(maxItems-1),parts=['0'];
 if(maxItems===1)return '^0$';
 const digits=count=>count===0?'':count===1?'[0-9]':'[0-9]{'+count+'}';
 const digitRange=(low,high)=>low===high?String(low):'['+low+'-'+high+']';
 for(let length=1;length<maximum.length;length++)parts.push('[1-9]'+digits(length-1));
 let prefix='';
 for(let index=0;index<maximum.length;index++){
  const high=Number(maximum[index])-1,low=index===0?1:0;
  if(high>=low)parts.push(prefix+digitRange(low,high)+digits(maximum.length-index-1));
  prefix+=maximum[index];
 }
 parts.push(maximum);return '^('+parts.join('|')+')$';
}

function convertSchema(schema,context={nextIndex:0}){
 if(!schema||typeof schema!=='object'||Array.isArray(schema))throw Error('A canonical schema object is required.');
 const type=schema.type;
 if(schema.enum){
  if(!Array.isArray(schema.enum)||!schema.enum.length)throw Error('Enums must contain permitted values.');
  const expected=type==='integer'?'number':type;
  if(schema.enum.some(value=>typeof value!==expected||expected==='number'&&(!Number.isFinite(value)||type==='integer'&&!Number.isSafeInteger(value))))throw Error('Enum values must match their declared scalar type.');
 }
 if(type==='object'){
  if(schema.additionalProperties!==false||!schema.properties||typeof schema.properties!=='object')throw Error('DTO objects must close additionalProperties.');
  const properties=schema.properties,required=schema.required||[];
  if(required.some(key=>!Object.hasOwn(properties,key)))throw Error('A required field is missing its schema.');
  const node={'.validate':required.length?'newData.hasChildren('+literal(required)+')':objectCondition};
  for(const [key,child]of Object.entries(properties)){
   if(!/^[A-Za-z0-9_-]+$/.test(key))throw Error('Unsafe DTO field name: '+key);
   node[key]=convertSchema(child,context);
  }
  return closed(node);
 }
 if(type==='array'){
  const variable='$dtoIndex'+context.nextIndex++,child=convertSchema(schema.items,context);
  child['.validate']=join([matches(variable,arrayIndexRegex(schema.maxItems)),child['.validate']]);
  return {'.validate':objectCondition,[variable]:child};
 }
 let conditions=[];
 if(type==='string'){
  conditions.push('newData.isString()');
  if(schema.enum){
   const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   conditions.push(matches('newData.val()','^('+schema.enum.map(escape).join('|')+')$'));
  }else if(!Number.isSafeInteger(schema.maxLength))throw Error('Free-text DTO fields need a bounded maxLength.');
  if(schema.minLength!==undefined)conditions.push('newData.val().length >= '+schema.minLength);
  if(schema.maxLength!==undefined)conditions.push('newData.val().length <= '+schema.maxLength);
  if(schema.pattern){new RegExp(schema.pattern);conditions.push(matches('newData.val()',schema.pattern));}
 }else if(type==='integer'||type==='number'){
  conditions.push('newData.isNumber()');
  if(type==='integer')conditions.push('newData.val() % 1 === 0');
  if(schema.minimum!==undefined){if(!Number.isFinite(schema.minimum))throw Error('Invalid numeric minimum.');conditions.push('newData.val() >= '+schema.minimum);}
  if(schema.maximum!==undefined){if(!Number.isFinite(schema.maximum))throw Error('Invalid numeric maximum.');conditions.push('newData.val() <= '+schema.maximum);}
  if(!schema.enum&&(!Number.isFinite(schema.minimum)||!Number.isFinite(schema.maximum)))throw Error('DTO numbers need bounded ranges.');
 }else if(type==='boolean')conditions.push('newData.isBoolean()');
 else throw Error('Unsupported canonical schema type: '+type);
 if(schema.enum&&type!=='string')conditions.push(schema.enum.map(value=>'newData.val() === '+literal(value)).join(' || '));
 return {'.validate':join(conditions)};
}

function createdAt(immutable=true){
 return {'.validate':join([integer('newData',0,'now'),immutable&&'!data.exists() || newData.val() === data.val()'])};
}

// Shared boards contain only generated aliases and bounded numeric results.
// Neither public rows nor class rows expose a pass, auth UID, or private save.
const HALL_BOARD_PATTERN='^(pitch-(classic|endless|levels|multi)|triad-(computer|multiplayer)|rhythm-tap)$';
const HALL_ALIAS_PATTERN='^(Amber|Blue|Coral|Gold|Green|Lilac|Mint|Pink|Red|Silver|Teal|Violet) (Cat|Fox|Frog|Owl|Otter|Penguin|Rabbit|Turtle) [1-9][0-9]$';
function hallRow(classId){
 const profile=profileNode(classId,'$profileId'),lease=profile+'.child("lease")';
 const owner=join([validStudent(classId,'$profileId'),lease+'.child("uid").val() === auth.uid',lease+'.child("expiresAt").val() > now']);
 const pitch=matches('$board','^pitch-(classic|endless|levels|multi)$'),triad=matches('$board','^triad-(computer|multiplayer)$');
 const score='newData.child("score")',tie='newData.child("tiebreak")',rank='newData.child("rank")';
 return closed({
  '.write':'('+join([admin,'!newData.exists()'])+') || ('+join([owner,'newData.exists()'])+')',
  '.validate':join([matches('$profileId',ID_PATTERN),matches('$board',HALL_BOARD_PATTERN),
   'newData.hasChildren(["alias","score","tiebreak","rank","at"])',
   'newData.child("alias").val() === '+profile+'.child("meta/alias").val()',
   '('+pitch+' ? '+score+'.val() <= 100000000 && '+tie+'.val() <= 1000000 && '+score+'.val() % 100 === 0 : '+
    '('+triad+' ? '+score+'.val() <= 1600 && '+tie+'.val() <= 1000 && '+score+'.val() % 100 === 0 : '+score+'.val() <= 10000 && '+tie+'.val() <= 128))',
   rank+'.val() === '+score+'.val() * 1000001 + '+tie+'.val()',
   '!data.exists() || '+rank+'.val() >= data.child("rank").val()']),
  alias:{'.validate':string('newData',1,32,HALL_ALIAS_PATTERN)},
  score:{'.validate':integer('newData',0,100000000)},
  tiebreak:{'.validate':integer('newData',0,1000000)},
  rank:{'.validate':integer('newData',0,100000101000000)},
  at:createdAt(false)
 });
}
function hallRules(){
 const board=matches('$board',HALL_BOARD_PATTERN),member=validStudent('$classId',ownSession+'.child("profileId").val()');
 return {'.read':false,'.write':false,
  global:{'.read':false,'.write':false,$board:{
   '.read':join([board,'query.orderByChild === "rank"','query.limitToLast !== null','query.limitToLast > 0','query.limitToLast <= 50']),
   '.indexOn':['rank'],$profileId:hallRow(ownSession+'.child("classId").val()')
  }},
  classes:{'.read':false,'.write':false,$classId:{'.read':false,'.write':join([admin,'!newData.exists()']),$board:{
   '.read':join([board,'('+admin+') || ('+member+')']),'.indexOn':['rank'],$profileId:hallRow('$classId')
  }}}
 };
}

// Ownership is independent of the school-admin allowlist. Delegated editors
// can read only their own grant; only the two verified owners can change it.
const DEVELOPER_OWNERS=['cwood@sanjacinto.k12.ca.us','cwood.musiced@gmail.com'];
const DEVELOPER_EMAIL_PATTERN='^[a-z0-9_%+,-]+@[a-z0-9,-]+,[a-z]{2,63}$';
function developerRules(){
 const verified=join([google,'auth.token.email_verified === true','auth.token.email !== null']);
 const email='auth.token.email.toLowerCase()',key=email+'.replace(".", ",")';
 const owner=join([verified,'('+DEVELOPER_OWNERS.map(value=>email+' === '+literal(value)).join(' || ')+')']);
 return {'.read':owner,'.write':false,$emailKey:{
  '.read':join([verified,key+' === $emailKey']),
  '.write':owner,
  '.validate':join(['$emailKey.length >= 3','$emailKey.length <= 254',matches('$emailKey',DEVELOPER_EMAIL_PATTERN),'!$emailKey.contains(",,")','newData.isBoolean()','newData.val() === true'])
 }};
}

// Google Classroom identifiers stay in an exact-owner private index. Imported
// profiles still use the existing alias/pass/progress contract. The reverse
// index prevents two students from concurrently claiming the same profile.
function classroomDeliveryRules(teacher,key,course){
 const profile=profileNode(course+'.child("classId").val()','newData.child("profileId").val()');
 const state='newData.child("state").val()',oldState='data.child("state").val()';
 const sameAttempt='newData.child("attemptId").val() === data.child("attemptId").val()';
 const newAttempt='newData.child("attemptId").val() !== data.child("attemptId").val()';
 const oldLease='data.child("leaseUntil").val()',lease='newData.child("leaseUntil").val()';
 const postedNoop=join([oldState+' === "posted"',state+' === "posted"',sameAttempt,
  'newData.child("materialId").val() === data.child("materialId").val()',lease+' === '+oldLease,
  'newData.child("updatedAt").val() === data.child("updatedAt").val()']);
 const transitions=[
  join(['!data.exists()',state+' === "claimed"']),
  join(['!data.exists()',state+' === "posted"',lease+' === 0']),
  join([oldState+' === "claimed"',state+' === "claimed"','(('+sameAttempt+' && '+oldLease+' > now) || ('+newAttempt+' && '+oldLease+' <= now))']),
  join([oldState+' === "claimed"',state+' === "sending"',sameAttempt,oldLease+' > now']),
  join([oldState+' === "claimed"',state+' === "posted"',sameAttempt]),
  join([oldState+' === "sending"',sameAttempt,'('+state+' === "posted" || '+state+' === "uncertain" || '+state+' === "failed")']),
  join([oldState+' === "uncertain"',sameAttempt,'('+state+' === "posted" || '+state+' === "uncertain")']),
  join([oldState+' === "failed"','(('+state+' === "claimed" && '+newAttempt+') || ('+state+' === "posted" && '+sameAttempt+'))']),
  postedNoop
 ];
 return {'.validate':objectCondition,$googleStudentId:{'.validate':matches('$googleStudentId',key),$passHash:closed({
  '.write':join([teacher,'newData.exists()']),
  '.validate':join([matches('$passHash',HASH_PATTERN),
   'newData.hasChildren(["profileId","attemptId","state","leaseUntil","createdAt","updatedAt"])',
   'newData.child("profileId").val() === '+course+'.child("students").child($googleStudentId).child("profileId").val()',
   course+'.child("profileLinks").child(newData.child("profileId").val()).val() === $googleStudentId',
   profile+'.child("meta/passHash").val() === $passHash',
   rootAt('classroomV1/passes')+'.child($passHash).child("classId").val() === '+course+'.child("classId").val()',
   rootAt('classroomV1/passes')+'.child($passHash).child("profileId").val() === newData.child("profileId").val()',
   '!data.exists() || newData.child("profileId").val() === data.child("profileId").val()',
   '('+transitions.map(value=>'('+value+')').join(' || ')+')',
   '('+state+' === "claimed" || '+state+' === "sending" ? '+lease+' > now : true)',
   '('+state+' === "posted" ? newData.child("materialId").exists() : !newData.child("materialId").exists())']),
  profileId:{'.validate':string('newData',8,64,ID_PATTERN)},
  attemptId:{'.validate':string('newData',32,32,'^[a-f0-9]{32}$')},
  state:{'.validate':string('newData',6,9,'^(claimed|sending|posted|uncertain|failed)$')},
  leaseUntil:{'.validate':integer('newData',0,'now + 120000')},
  createdAt:createdAt(),
  updatedAt:{'.validate':join([integer('newData',0,'now'),'!data.exists() || newData.val() >= data.val()'])},
  materialId:{'.validate':string('newData',1,128,key)}
 })}};
}

function classroomImportRules(){
 const teacher=join([admin,'auth.uid === $teacherUid']);
 const key='^[A-Za-z0-9_-]{1,128}$';
 const oldCourse=rootAt('classroomV1/classroomImports')+'.child($teacherUid).child($courseId)';
 const oldProfile=profileNode(oldCourse+'.child("classId").val()','data.child("profileId").val()');
 const pendingCourse='newData.parent().parent()';
 const pendingSpace=pendingCourse+'.parent().parent().parent()';
 const pendingClass=pendingSpace+'.child("classes").child('+pendingCourse+'.child("classId").val())';
 const target=pendingClass+'.child("profiles").child(newData.child("profileId").val())';
 const directory=pendingSpace+'.child("directory").child('+pendingCourse+'.child("classId").val()).child("profiles").child(newData.child("profileId").val())';
 const pendingCourseClass='newData.parent().parent().parent().child("classes").child(newData.child("classId").val())';
 const pendingCourseDirectory='newData.parent().parent().parent().child("directory").child(newData.child("classId").val())';
 const oldClaim=pendingCourse+'.child("students").child(data.val()).child("profileId").val()';
 return {'.read':false,'.write':false,$teacherUid:{
  '.read':teacher,'.write':false,
  $courseId:closed({
   // This parent grant covers only initial creation. Existing courses can be
   // extended solely through the individually guarded leaves below.
   '.write':join([teacher,'!data.exists()','newData.exists()']),
   '.validate':join([matches('$teacherUid',key),matches('$courseId',key),'newData.hasChildren(["classId","createdAt","updatedAt"])',
    pendingCourseClass+'.child("meta").exists()',pendingCourseDirectory+'.child("meta").exists()']),
   classId:{'.validate':join([string('newData',8,64,ID_PATTERN),'!data.exists() || newData.val() === data.val()'])},
   createdAt:createdAt(),
   updatedAt:{'.write':join([teacher,'data.parent().exists()','newData.exists()']),
    '.validate':join([integer('newData',0,'now'),'!data.exists() || newData.val() >= data.val()'])},
   students:{'.validate':objectCondition,$googleStudentId:closed({
    '.write':join([teacher,'data.parent().parent().exists()','newData.exists()',
     '(!data.exists() || !'+oldProfile+'.child("meta").exists())']),
    '.validate':join([matches('$googleStudentId',key),'newData.hasChildren(["profileId","createdAt"])',
     target+'.child("meta").exists()',target+'.child("state").exists()',directory+'.exists()',
     pendingCourse+'.child("profileLinks").child(newData.child("profileId").val()).val() === $googleStudentId']),
    profileId:{'.validate':string('newData',8,64,ID_PATTERN)},createdAt:createdAt(false)
   })},
   profileLinks:{'.validate':objectCondition,$profileId:{
    '.write':join([teacher,'data.parent().parent().exists()','newData.exists()',
     '(!data.exists() || '+oldClaim+' !== $profileId)']),
    '.validate':join([matches('$profileId',ID_PATTERN),string('newData',1,128,key),
     pendingCourse+'.child("students").child(newData.val()).child("profileId").val() === $profileId'])
   }},
   deliveries:classroomDeliveryRules(teacher,key,oldCourse)
  })
 }};
}

function buildClassroomRules(schema){
 const student=validStudent(),lease=profileNode('$classId','$profileId')+'.child("lease")';
 const teacher=join([admin,'auth.uid === $uid']);
 const dto=convertSchema(schema);
 const classMeta=()=>closed({'.validate':'newData.hasChildren(["ownerUid","label","createdAt"])',
  ownerUid:{'.validate':join([string('newData',1,128),'data.exists() ? newData.val() === data.val() : newData.val() === auth.uid'])},
  label:{'.validate':string('newData',1,64)},createdAt:createdAt()});
 const alias=()=>({'.validate':string('newData',1,32,'^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$')});
 const picture=()=>convertSchema({type:'string',enum:['cat','fox','frog','owl','otter','penguin','rabbit','turtle']});
 const sessionClass='newData.child("classId").val()',sessionProfile='newData.child("profileId").val()',sessionHash='newData.child("passHash").val()';
 const sessionBinding=passMatches(sessionHash,sessionClass,sessionProfile);
 const namespace={'.read':false,'.write':false,
  admins:{'.read':false,'.write':false,$uid:{'.read':join([google,'auth.uid === $uid']),'.write':false}},
  teacherPlayers:{'.read':false,'.write':false,$uid:closed({
   '.read':teacher,
   // Create the complete private player once; later writes target meta/state.
   // A missing record may be read by its approved owner for create-if-null.
   '.write':join([teacher,'!data.exists()','newData.exists()']),
   '.validate':'newData.hasChildren(["meta","state"])',
   meta:closed({'.write':join([teacher,'data.parent().exists()','newData.exists()']),
    '.validate':'newData.hasChildren(["alias","picture","createdAt"])',
    alias:{'.validate':string('newData',1,40)},picture:picture(),createdAt:createdAt()}),
   state:closed({'.write':join([teacher,'data.parent().exists()','newData.exists()']),
    '.validate':join(['newData.hasChildren(["schemaVersion","revision","updatedAt","data"])',
     'data.exists() ? newData.child("revision").val() === data.child("revision").val() + 1 : newData.child("revision").val() === 1']),
    schemaVersion:{'.validate':'newData.isNumber() && newData.val() === 1'},
    revision:{'.validate':integer('newData',1,1000000000000)},updatedAt:createdAt(false),data:dto})
  })},
  directory:{'.read':admin,'.write':admin,'.validate':objectCondition,$classId:closed({
   '.validate':join([matches('$classId',ID_PATTERN),'newData.hasChildren(["meta"])']),meta:classMeta(),
   profiles:{'.validate':objectCondition,$profileId:closed({
    '.validate':join([matches('$profileId',ID_PATTERN),'newData.hasChildren(["alias","picture"])']),alias:alias(),picture:picture()
   })}
  })},
  classes:{'.read':admin,'.write':admin,'.validate':objectCondition,$classId:closed({
   '.validate':join([matches('$classId',ID_PATTERN),'newData.hasChildren(["meta"])']),
   meta:classMeta(),
   profiles:{'.validate':objectCondition,$profileId:closed({
    '.validate':join([matches('$profileId',ID_PATTERN),'newData.hasChildren(["meta"])']),
    meta:closed({'.read':student,'.validate':'newData.hasChildren(["alias","picture","createdAt","passHash"])',
     alias:alias(),picture:picture(),
     createdAt:createdAt(),passHash:{'.validate':string('newData',64,64,HASH_PATTERN)}}),
    lease:closed({'.read':student,
     '.write':join([student,'newData.exists() ? newData.child("uid").val() === auth.uid : (data.exists() && data.child("uid").val() === auth.uid)']),
     '.validate':'newData.hasChildren(["uid","expiresAt"])',
     uid:{'.validate':string('newData',1,128)},
     expiresAt:{'.validate':join([integer('newData',0,'now + 90000'),'newData.val() > now'])}}),
    state:closed({'.read':student,
     '.write':join([student,'newData.exists()',lease+'.child("uid").val() === auth.uid',lease+'.child("expiresAt").val() > now']),
     '.validate':join(['newData.hasChildren(["schemaVersion","revision","updatedAt","data"])',
      'data.exists() ? newData.child("revision").val() === data.child("revision").val() + 1 : newData.child("revision").val() === 1']),
     schemaVersion:{'.validate':'newData.isNumber() && newData.val() === 1'},
     revision:{'.validate':integer('newData',1,1000000000000)},updatedAt:createdAt(false),data:dto})
   })}
  })},
  passes:{'.read':false,'.write':false,$passHash:closed({
   '.read':'('+admin+') || ('+join([anonymous,'data.exists()',
    currentHash('data.child("classId").val()','data.child("profileId").val()')+' === $passHash'])+')',
   '.write':admin,
   '.validate':join([matches('$passHash',HASH_PATTERN),'newData.hasChildren(["classId","profileId","createdAt"])']),
   classId:{'.validate':string('newData',8,64,ID_PATTERN)},profileId:{'.validate':string('newData',8,64,ID_PATTERN)},createdAt:createdAt()})},
  sessions:{'.read':admin,'.write':false,'.indexOn':['classId'],$sessionUid:closed({
   '.read':'('+admin+') || ('+join([anonymous,'auth.uid === $sessionUid',
    validStudent('data.child("classId").val()','data.child("profileId").val()')])+')',
   '.write':'('+join([admin,'!newData.exists()'])+') || ('+join([anonymous,'auth.uid === $sessionUid',
    '!newData.exists() || ('+sessionBinding+')'])+')',
   '.validate':'newData.hasChildren(["classId","profileId","passHash","createdAt"])',
   classId:{'.validate':string('newData',8,64,ID_PATTERN)},profileId:{'.validate':string('newData',8,64,ID_PATTERN)},
   passHash:{'.validate':string('newData',64,64,HASH_PATTERN)},createdAt:createdAt(false)})},
  hallOfFame:hallRules(),
  developerAccess:developerRules(),
  classroomImports:classroomImportRules(),
  $other:{'.validate':false}
 };
 return {rules:{classroomV1:namespace}};
}

function renderClassroomRules(schema){return JSON.stringify(buildClassroomRules(schema),null,2)+'\n';}
function renderHallRules(){return JSON.stringify({hallOfFame:hallRules()},null,2)+'\n';}
function renderDeveloperRules(){return JSON.stringify({developerAccess:developerRules()},null,2)+'\n';}
function renderClassroomImportRules(){return JSON.stringify({classroomImports:classroomImportRules()},null,2)+'\n';}
function run(argv){
 if(argv.length>1||argv.length===1&&argv[0]!=='--check')throw Error('Usage: node tools/build-classroom-rules.cjs [--check]');
 const {SCHEMA}=require('../classroom-profile-data.js'),target=path.join(__dirname,'../classroom-database.rules.json'),text=renderClassroomRules(SCHEMA);
 const hallTarget=path.join(__dirname,'../docs/HALL-OF-FAME-RULES.json'),hallText=renderHallRules();
 const developerTarget=path.join(__dirname,'../docs/DEVELOPER-ACCESS-RULES.json'),developerText=renderDeveloperRules();
 const importTarget=path.join(__dirname,'../docs/GOOGLE-CLASSROOM-IMPORT-RULES.json'),importText=renderClassroomImportRules();
 if(argv[0]==='--check'){
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)throw Error('classroom-database.rules.json is out of date. Regenerate it from the canonical schema.');
  if(!fs.existsSync(hallTarget)||fs.readFileSync(hallTarget,'utf8')!==hallText)throw Error('docs/HALL-OF-FAME-RULES.json is out of date. Regenerate the rules.');
  if(!fs.existsSync(developerTarget)||fs.readFileSync(developerTarget,'utf8')!==developerText)throw Error('docs/DEVELOPER-ACCESS-RULES.json is out of date. Regenerate the rules.');
  if(!fs.existsSync(importTarget)||fs.readFileSync(importTarget,'utf8')!==importText)throw Error('docs/GOOGLE-CLASSROOM-IMPORT-RULES.json is out of date. Regenerate the rules.');
  process.stdout.write('Classroom rules match the canonical DTO schema.\n');
 }else{fs.writeFileSync(target,text);fs.writeFileSync(hallTarget,hallText);fs.writeFileSync(developerTarget,developerText);fs.writeFileSync(importTarget,importText);process.stdout.write('Generated classroom-database.rules.json ('+Buffer.byteLength(text)+' bytes) and the Hall/developer/import fragments. No deployment performed.\n');}
}
if(require.main===module)try{run(process.argv.slice(2));}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
module.exports={arrayIndexRegex,convertSchema,buildClassroomRules,renderClassroomRules,renderHallRules,renderDeveloperRules,renderClassroomImportRules,run};
