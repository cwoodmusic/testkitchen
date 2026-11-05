#!/usr/bin/env node
/* Offline only: prepare one namespace change from an operator's rules backup. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const denies=value=>value===undefined||value===false||typeof value==='string'&&value.trim()==='false';
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const parseRules=(text,label)=>{try{return JSON.parse(text);}catch{throw Error(label+' is not valid JSON. Export complete database rules; input contents were not logged.');}};

function mergeClassroomRules(base,fragment,{replaceClassroom=false}={}){
 if(!plain(base)||!plain(base.rules))throw Error('The backup must contain a rules object. Export the complete existing rules first.');
 if(!plain(fragment)||!plain(fragment.rules)||Object.keys(fragment.rules).length!==1||!plain(fragment.rules.classroomV1))throw Error('The fragment must contain only rules.classroomV1.');
 for(const permission of ['.read','.write']){
  if(!denies(base.rules[permission]))throw Error('Existing root '+permission+' may grant access to classroomV1. Child denials cannot override ancestor grants. Review and migrate existing root permissions separately; this tool will not change them.');
  if(!denies(fragment.rules.classroomV1[permission]))throw Error('The classroomV1 fragment must not grant namespace-wide '+permission+'.');
 }
 if(own(base.rules,'$other'))throw Error('Existing root $other wildcard may grant inherited classroom access. Review that wildcard before merging.');
 for(const key of Object.keys(base.rules))if(key.startsWith('$'))throw Error('Existing root wildcard '+key+' may cover classroomV1. Review wildcard permissions before merging.');
 if(own(base.rules,'classroomV1')&&!replaceClassroom)throw Error('classroomV1 already exists. Review its current rules and rerun with --replace-classroom to replace only this namespace.');
 const merged=JSON.parse(JSON.stringify(base));merged.rules.classroomV1=JSON.parse(JSON.stringify(fragment.rules.classroomV1));return merged;
}

function mergeClassroomImportRules(base,fragment){
 if(!plain(base)||!plain(base.rules)||!plain(base.rules.classroomV1))throw Error('The backup must contain the existing complete classroomV1 rules.');
 if(!plain(fragment)||Object.keys(fragment).length!==1||!plain(fragment.classroomImports))throw Error('The import fragment must contain only classroomImports.');
 for(const [label,node]of [['database',base.rules],['classroomV1',base.rules.classroomV1],['classroomImports',fragment.classroomImports]]){
  for(const permission of ['.read','.write'])if(!denies(node[permission]))throw Error('Existing '+label+' '+permission+' may grant inherited import access. Review that grant separately.');
  if(label!=='classroomImports')for(const [key,value]of Object.entries(node))if(key.startsWith('$')&&plain(value)&&(!denies(value['.read'])||!denies(value['.write'])))throw Error('An ancestor wildcard may grant inherited import access.');
 }
 const current=base.rules.classroomV1.classroomImports;
 if(current!==undefined&&JSON.stringify(current)!==JSON.stringify(fragment.classroomImports))throw Error('classroomImports already exists with different rules. Review it before preparing a replacement.');
 const merged=JSON.parse(JSON.stringify(base));merged.rules.classroomV1.classroomImports=JSON.parse(JSON.stringify(fragment.classroomImports));return merged;
}

function mergeClassroomDeliveryRules(base,fragment){
 if(!plain(base)||!plain(base.rules)||!plain(base.rules.classroomV1))throw Error('The backup must contain the existing complete classroomV1 rules.');
 const next=fragment?.classroomImports?.$teacherUid?.$courseId?.deliveries;
 if(!plain(next))throw Error('The import fragment must include its delivery ledger rules.');
 const current=base.rules.classroomV1.classroomImports;
 const without=JSON.parse(JSON.stringify(base));delete without.rules.classroomV1.classroomImports;
 const fresh=mergeClassroomImportRules(without,fragment);
 if(current===undefined)return fresh;
 const oldRest=JSON.parse(JSON.stringify(current)),newRest=JSON.parse(JSON.stringify(fragment.classroomImports));
 const previous=oldRest?.$teacherUid?.$courseId?.deliveries;
 if(!plain(oldRest?.$teacherUid?.$courseId))throw Error('Existing import rules have an unknown schema. Review them separately.');
 delete oldRest.$teacherUid.$courseId.deliveries;delete newRest.$teacherUid.$courseId.deliveries;
 if(JSON.stringify(oldRest)!==JSON.stringify(newRest))throw Error('Existing import rules differ outside the delivery ledger. Review those changes separately.');
 if(previous!==undefined&&JSON.stringify(previous)!==JSON.stringify(next))throw Error('Delivery rules already exist with different permissions. Review them before replacement.');
 const merged=JSON.parse(JSON.stringify(base));merged.rules.classroomV1.classroomImports.$teacherUid.$courseId.deliveries=JSON.parse(JSON.stringify(next));return merged;
}

function run(argv){
 const options={};
 for(let index=0;index<argv.length;index++){
  const flag=argv[index];
  if(flag==='--replace-classroom'){options.replaceClassroom=true;continue;}
  if(flag==='--add-classroom-imports'){options.addClassroomImports=true;continue;}
  if(flag==='--add-classroom-deliveries'){options.addClassroomDeliveries=true;continue;}
  if(!['--base','--fragment','--out','--firebase-config','--instance'].includes(flag)||!argv[index+1]||argv[index+1].startsWith('--'))throw Error('Usage: node tools/classroom-rules-merge.cjs --base BACKUP.json --out CANDIDATE.json [--fragment FRAGMENT.json] [--replace-classroom | --add-classroom-imports | --add-classroom-deliveries] [--firebase-config NEW-CONFIG.json --instance DATABASE-INSTANCE]');
  options[flag.slice(2)]=argv[++index];
 }
 if(!options.base||!options.out)throw Error('--base and --out are required. This tool never downloads, authenticates, or deploys rules.');
 if([options.replaceClassroom,options.addClassroomImports,options.addClassroomDeliveries].filter(Boolean).length>1)throw Error('Choose one complete classroom replacement or additive import/delivery update.');
 if(Boolean(options['firebase-config'])!==Boolean(options.instance))throw Error('--firebase-config and --instance must be supplied together.');
 if(options.instance&&!/^[a-z0-9][a-z0-9-]{2,62}$/.test(options.instance))throw Error('Use the exact Realtime Database instance name, without a URL.');
 const basePath=path.resolve(options.base),fragmentPath=path.resolve(options.fragment||path.join(__dirname,options.addClassroomImports||options.addClassroomDeliveries?'../docs/GOOGLE-CLASSROOM-IMPORT-RULES.json':'../classroom-database.rules.json')),outPath=path.resolve(options.out);
 if([basePath,fragmentPath].includes(outPath))throw Error('The candidate must be a new file; it cannot replace the backup or fragment.');
 const configPath=options['firebase-config']&&path.resolve(options['firebase-config']);
 if(configPath&&[basePath,fragmentPath,outPath].includes(configPath))throw Error('The generated deployment configuration must be a separate new file.');
 for(const target of [outPath,configPath].filter(Boolean))if(fs.existsSync(target))throw Error('Refusing to overwrite '+target+'. Choose a new output path after reviewing the existing file.');
 const baseBytes=fs.readFileSync(basePath),base=parseRules(baseBytes.toString('utf8'),'The backup'),fragment=parseRules(fs.readFileSync(fragmentPath,'utf8'),'The fragment');
 const merger=options.addClassroomDeliveries?mergeClassroomDeliveryRules:options.addClassroomImports?mergeClassroomImportRules:mergeClassroomRules;
 const candidate=JSON.stringify(merger(base,fragment,options),null,2)+'\n';
 fs.writeFileSync(outPath,candidate,{flag:'wx',mode:0o600});
 if(configPath)fs.writeFileSync(configPath,JSON.stringify({database:[{instance:options.instance,rules:outPath}]},null,2)+'\n',{flag:'wx',mode:0o600});
 const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 process.stdout.write(JSON.stringify({status:'prepared-offline',backup:basePath,backupSha256:sha(baseBytes),candidate:outPath,candidateSha256:sha(candidate),changedNamespace:options.addClassroomDeliveries?'classroomV1/classroomImports/$teacherUid/$courseId/deliveries':options.addClassroomImports?'classroomV1/classroomImports':'classroomV1',firebaseConfig:configPath||null,requiresReview:true,deployed:false},null,2)+'\n');
}

if(require.main===module)try{run(process.argv.slice(2));}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
module.exports={mergeClassroomRules,mergeClassroomImportRules,mergeClassroomDeliveryRules,run};
