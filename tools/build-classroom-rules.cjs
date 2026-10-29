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
  $other:{'.validate':false}
 };
 return {rules:{classroomV1:namespace}};
}

function renderClassroomRules(schema){return JSON.stringify(buildClassroomRules(schema),null,2)+'\n';}
function run(argv){
 if(argv.length>1||argv.length===1&&argv[0]!=='--check')throw Error('Usage: node tools/build-classroom-rules.cjs [--check]');
 const {SCHEMA}=require('../classroom-profile-data.js'),target=path.join(__dirname,'../classroom-database.rules.json'),text=renderClassroomRules(SCHEMA);
 if(argv[0]==='--check'){
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==text)throw Error('classroom-database.rules.json is out of date. Regenerate it from the canonical schema.');
  process.stdout.write('Classroom rules match the canonical DTO schema.\n');
 }else{fs.writeFileSync(target,text);process.stdout.write('Generated classroom-database.rules.json ('+Buffer.byteLength(text)+' bytes). No deployment performed.\n');}
}
if(require.main===module)try{run(process.argv.slice(2));}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
module.exports={arrayIndexRegex,convertSchema,buildClassroomRules,renderClassroomRules,run};
