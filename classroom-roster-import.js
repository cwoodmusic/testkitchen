/* Atomic teacher-only roster imports. Google names and raw passes stay in memory. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CodaClassroomRosterImport=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const GOOGLE_ID=/^[A-Za-z0-9_-]{1,128}$/,PROFILE_ID=/^[A-Za-z0-9_-]{8,64}$/,LABEL=/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
 const COLORS=['Amber','Blue','Coral','Gold','Green','Lilac','Mint','Pink','Red','Silver','Teal','Violet'];
 const ANIMALS=['Cat','Fox','Frog','Owl','Otter','Penguin','Rabbit','Turtle'];
 const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',MAX_PROFILES=200;
 const fail=code=>({ok:false,code}),record=value=>value&&typeof value==='object'&&!Array.isArray(value),own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
 const reservedKeys=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype']);
 const googleId=value=>typeof value==='string'&&GOOGLE_ID.test(value)&&!reservedKeys.has(value),profileId=value=>typeof value==='string'&&PROFILE_ID.test(value)&&!reservedKeys.has(value),dictionary=()=>Object.create(null);
 const CODES=new Set(['admin-required','busy','session-changed','invalid-course','invalid-roster','invalid-class','invalid-class-label','invalid-profile','invalid-import-state','invalid-import-choices','roster-setup-required','offline','class-not-found','class-full','import-target-conflict','import-conflict','profile-already-linked','no-students-selected','import-failed','rebuild-confirmation-required','class-rebuild-unavailable','class-rebuild-failed']);
 const error=code=>Object.assign(Error(code),{code});
 function encode(bytes){let bits=0,value=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){result+=ALPHABET[(value>>>(bits-5))&31];bits-=5;}}if(bits)result+=ALPHABET[(value<<(5-bits))&31];return result;}
 function studentsFrom(value){
  if(!Array.isArray(value)||value.length>MAX_PROFILES)throw error('invalid-roster');
  const ids=new Set();return value.map(student=>{
   if(!record(student)||!googleId(student.userId)||ids.has(student.userId))throw error('invalid-roster');
   ids.add(student.userId);const name=typeof student.name==='string'?student.name.replace(/[\x00-\x1f\x7f-\x9f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160):'';
   return {userId:student.userId,name:name||'Student'};
  });
 }
 function create(options={}){
  const crypto=options.crypto||globalThis.crypto;
  for(const name of ['getContext','read','update','online','random','hashPass','blank','receipt','serverTimestamp'])if(typeof options[name]!=='function')throw Error('Roster import requires '+name);
  if(typeof crypto?.subtle?.digest!=='function')throw Error('Roster import requires secure hashing');
  let generation=0,activeImport=null,destroyed=false;
  const context=()=>{try{return options.getContext();}catch{return null;}};
  const authorized=value=>value?.authorized===true&&value?.signedIn===true&&googleId(value.uid);
  const identity=value=>JSON.stringify([value?.uid,value?.identity]);
  function operation(){
   const initial=context();if(destroyed||!authorized(initial))throw error('admin-required');
   const token=++generation,key=identity(initial);
   const current=()=>!destroyed&&token===generation&&authorized(context())&&identity(context())===key;
   const guard=()=>{if(!current())throw error('session-changed');};
   return {uid:initial.uid,current,guard};
  }
  async function hash(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
  const classIdFor=async(uid,courseId)=>'gclass_'+(await hash('coda-classroom-import-class:v1:'+uid+'\n'+courseId)).slice(0,40);
  const profileIdFor=async(uid,courseId,userId)=>'gprofile_'+(await hash('coda-classroom-import-profile:v1:'+uid+'\n'+courseId+'\n'+userId)).slice(0,40);
  async function read(path,op){const value=await options.read(path);op.guard();return value;}
  async function importMapping(courseId,op){
   let mapping;
   try{mapping=await read('classroomImports/'+op.uid+'/'+courseId,op);}
   catch(cause){if(!op.current())throw error('session-changed');if(/permission[-_ ]denied|PERMISSION_DENIED/i.test(cause?.code||cause?.message||''))throw error('roster-setup-required');throw cause;}
   if(mapping!==null&&mapping!==undefined&&(!record(mapping)||!profileId(mapping.classId)||!Number.isFinite(mapping.createdAt)))throw error('invalid-import-state');
   return mapping;
  }
  function metadata(value){return record(value)&&typeof value.ownerUid==='string'&&typeof value.label==='string'&&Number.isFinite(value.createdAt);}
  async function profileMetadata(classId,ids,op){
   const result=dictionary(),queue=[...ids];
   await Promise.all(Array.from({length:Math.min(12,queue.length)},async()=>{
    for(;;){op.guard();const profileId=queue.shift();if(!profileId)return;
     const value=await read('classes/'+classId+'/profiles/'+profileId+'/meta',op);
     if(record(value)&&typeof value.alias==='string'&&typeof value.picture==='string')result[profileId]=value;
    }
   }));return result;
  }
  async function inspect(request,op,recoveryPreview=false){
   if(!record(request)||!googleId(request.courseId))throw error('invalid-course');
   const students=studentsFrom(request.students),courseId=request.courseId;
   if(request.classId!==undefined&&request.classId!==''&&!profileId(request.classId))throw error('invalid-class');
   op.guard();if(await options.online()!==true)throw error('offline');op.guard();
   const mapping=await importMapping(courseId,op);
   if(mapping&&request.classId&&mapping.classId!==request.classId)throw error('import-target-conflict');
   const classId=mapping?.classId||request.classId||await classIdFor(op.uid,courseId);op.guard();
   const [meta,directory]=await Promise.all([read('classes/'+classId+'/meta',op),read('directory/'+classId,op)]);op.guard();
   const exists=metadata(meta)&&record(directory)&&metadata(directory.meta);
   if(!exists&&(mapping||request.classId)){
    // A missing metadata row alone does not prove a class was deleted. Only
    // offer an explicit rebuild when neither root has any remaining data.
    if(recoveryPreview&&mapping&&meta==null&&directory==null&&await read('classes/'+classId,op)==null)throw Object.assign(error('class-not-found'),{canRebuild:true,classId,courseId});
    throw error('class-not-found');
   }
   if(!exists&&(meta!==null&&meta!==undefined||directory!==null&&directory!==undefined))throw error('class-not-found');
   if(exists&&!mapping&&!request.classId)throw error('import-target-conflict');
   const directoryProfiles=record(directory?.profiles)?directory.profiles:{};
   const ids=new Set(Object.keys(directoryProfiles));if(ids.size>MAX_PROFILES)throw error('class-full');
   if([...ids].some(id=>!profileId(id)))throw error('invalid-import-state');
   const mappedStudents=record(mapping?.students)?mapping.students:{},reverse=record(mapping?.profileLinks)?mapping.profileLinks:{};
   for(const student of students){const mapped=own(mappedStudents,student.userId)?mappedStudents[student.userId]:null;if(mapped){if(!profileId(mapped.profileId))throw error('invalid-import-state');ids.add(mapped.profileId);}}
   const metas=exists?await profileMetadata(classId,ids,op):{};op.guard();
   const occupied=dictionary();for(const [userId,mapped]of Object.entries(mappedStudents)){
    if(!googleId(userId)||!record(mapped)||!profileId(mapped.profileId))throw error('invalid-import-state');
    if(metas[mapped.profileId]){if(occupied[mapped.profileId]&&occupied[mapped.profileId]!==userId)throw error('invalid-import-state');occupied[mapped.profileId]=userId;}
   }
   const profiles=Object.entries(metas).filter(([profileId])=>own(directoryProfiles,profileId)).map(([profileId,value])=>({profileId,alias:value.alias,picture:value.picture,...(occupied[profileId]?{linkedTo:occupied[profileId]}:{})}));
   const rows=students.map(student=>{const mapped=own(mappedStudents,student.userId)?mappedStudents[student.userId]:null,value=mapped&&metas[mapped.profileId];return {...student,status:!mapped?'unlinked':value?'existing':'missing',...(mapped?{profileId:mapped.profileId}:{}),...(value?{alias:value.alias,picture:value.picture}:{})};});
   return {courseId,classId,label:exists?meta.label:'',newClass:!exists,students:rows,profiles,mapping,mappedStudents,reverse,metas,occupied};
  }
  function publicPreview(value){return {ok:true,courseId:value.courseId,classId:value.classId,label:value.label,newClass:value.newClass,profiles:value.profiles,students:value.students};}
  function friendly(cause,fallback){return fail(CODES.has(cause?.code)?cause.code:fallback);}
  async function previewRosterImport(request){
   if(activeImport)return fail('busy');
   try{const op=operation(),value=await inspect(request,op,true);op.guard();return publicPreview(value);}catch(cause){const result=friendly(cause,'roster-unavailable');return result.code==='class-not-found'&&cause?.canRebuild===true?{...result,canRebuild:true,classId:cause.classId,courseId:cause.courseId}:result;}
  }
  async function rebuildDeletedClass(request){
   if(activeImport)return fail('busy');const owner={};activeImport=owner;
   try{
    const op=operation();
    if(!record(request)||!googleId(request.courseId))throw error('invalid-course');
    if(request.confirmed!==true)throw error('rebuild-confirmation-required');
    const label=typeof request.label==='string'?request.label.trim():'';
    if(!LABEL.test(label))throw error('invalid-class-label');
    op.guard();if(await options.online()!==true)throw error('offline');op.guard();
    const mapping=await importMapping(request.courseId,op);if(!mapping)throw error('class-not-found');
    const classId=mapping.classId,[classNode,directory]=await Promise.all([read('classes/'+classId,op),read('directory/'+classId,op)]);op.guard();
    if(classNode!=null||directory!=null)throw error('class-rebuild-unavailable');
    op.guard();if(await options.online()!==true)throw error('offline');op.guard();
    const meta={ownerUid:op.uid,label,createdAt:options.serverTimestamp()};
    // Preserve the immutable private course binding and every other namespace.
    // Leaf writes also leave any concurrent profile creation untouched; existing
    // metadata timestamps and owners remain protected by the database rules.
    await options.update({['classes/'+classId+'/meta']:meta,['directory/'+classId+'/meta']:meta});op.guard();
    return {ok:true,classId,label,rebuilt:true};
   }catch(cause){return friendly(cause,'class-rebuild-failed');}
   finally{if(activeImport===owner)activeImport=null;}
  }
  function chooseAlias(used){
   for(let count=0;count<32;count++){const bytes=options.random(3),picture=ANIMALS[bytes[1]%ANIMALS.length],alias=COLORS[bytes[0]%COLORS.length]+' '+picture+' '+String(10+bytes[2]%90);if(!used.has(alias)){used.add(alias);return {alias,picture:picture.toLowerCase()};}}
   for(const color of COLORS)for(const animal of ANIMALS)for(let number=10;number<=99;number++){const alias=color+' '+animal+' '+number;if(!used.has(alias)){used.add(alias);return {alias,picture:animal.toLowerCase()};}}
   throw error('class-full');
  }
  async function importRoster(request){
   if(activeImport)return fail('busy');const owner={};activeImport=owner;
   try{
    const op=operation(),value=await inspect(request,op);op.guard();
    if(!Array.isArray(request.choices))throw error('invalid-import-choices');
    const rows=new Map(value.students.map(student=>[student.userId,student])),choices=new Map();
    for(const choice of request.choices){if(!record(choice)||!rows.has(choice.userId)||choices.has(choice.userId)||!['create','link','skip'].includes(choice.action))throw error('invalid-import-choices');choices.set(choice.userId,choice);}
    const decisions=[],claimed=Object.assign(dictionary(),value.occupied);let existing=0,skipped=0;
    for(const student of value.students){
     const choice=choices.get(student.userId);
     if(student.status==='existing'){if(choice?.action==='link'&&choice.profileId!==student.profileId)throw error('profile-already-linked');existing++;continue;}
     if(!choice||choice.action==='skip'){skipped++;continue;}
     let profileId;if(choice.action==='link'){
      profileId=choice.profileId;if(!PROFILE_ID.test(profileId||'')||typeof profileId!=='string'||!value.profiles.some(profile=>profile.profileId===profileId))throw error('invalid-profile');
     }else{profileId=await profileIdFor(op.uid,value.courseId,student.userId);op.guard();if(value.metas[profileId])throw error('import-conflict');}
     if(claimed[profileId]&&claimed[profileId]!==student.userId)throw error('profile-already-linked');claimed[profileId]=student.userId;
     decisions.push({student,action:choice.action,profileId});
    }
    const created=decisions.filter(row=>row.action==='create').length,linked=decisions.length-created;
    if(value.profiles.length+created>MAX_PROFILES)throw error('class-full');
    if(!decisions.length){if(value.newClass)throw error('no-students-selected');return {ok:true,classId:value.classId,label:value.label,cards:[],created:0,linked:0,existing,skipped};}
    const label=value.newClass?(typeof request.label==='string'?request.label.trim():''):value.label;
    if(value.newClass&&!LABEL.test(label))throw error('invalid-class-label');
    const changes=dictionary(),stamp=options.serverTimestamp(),cards=[],usedAliases=new Set(Object.values(value.metas).map(meta=>meta.alias)),usedHashes=new Set(Object.values(value.metas).map(meta=>meta.passHash));
    if(value.newClass){const meta={ownerUid:op.uid,label,createdAt:stamp};changes['classes/'+value.classId+'/meta']=meta;changes['directory/'+value.classId+'/meta']=meta;}
    const coursePath='classroomImports/'+op.uid+'/'+value.courseId,newMapping={classId:value.classId,createdAt:stamp,updatedAt:stamp,students:dictionary(),profileLinks:dictionary()};
    for(const decision of decisions){
     op.guard();const {student,profileId}=decision;
     if(decision.action==='create'){
      const alias=chooseAlias(usedAliases);let raw,digest,allocated=false;
      for(let attempt=0;attempt<16;attempt++){
       raw=encode(options.random(16));digest=await options.hashPass(raw);op.guard();
       if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw error('import-failed');
       if(usedHashes.has(digest))continue;
       if(await read('passes/'+digest,op))continue;
       usedHashes.add(digest);allocated=true;break;
      }
      if(!allocated)throw error('import-failed');
      const meta={...alias,passHash:digest,createdAt:stamp};
      changes['classes/'+value.classId+'/profiles/'+profileId]={meta,state:{schemaVersion:1,revision:1,updatedAt:stamp,data:options.blank()}};
      changes['directory/'+value.classId+'/profiles/'+profileId]=alias;
      changes['passes/'+digest]={classId:value.classId,profileId,createdAt:stamp};
      const receipt=options.receipt(profileId,meta,raw);if(!record(receipt)||typeof receipt.pass!=='string'||typeof receipt.link!=='string')throw error('import-failed');
      cards.push({...receipt,userId:student.userId,name:student.name});
     }
     const mapped={profileId,createdAt:stamp};
     if(value.mapping){changes[coursePath+'/students/'+student.userId]=mapped;}
     else newMapping.students[student.userId]=mapped;
     if(value.reverse[profileId]!==student.userId){
      if(value.mapping)changes[coursePath+'/profileLinks/'+profileId]=student.userId;
      else newMapping.profileLinks[profileId]=student.userId;
     }
    }
    if(value.mapping)changes[coursePath+'/updatedAt']=stamp;else changes[coursePath]=newMapping;
    op.guard();if(await options.online()!==true)throw error('offline');op.guard();
    // Firebase's serializer expects ordinary objects with hasOwnProperty.
    // Keep null-prototype dictionaries internally and cross the SDK boundary
    // using JSON data, never by assigning untrusted keys onto plain objects.
    await options.update(JSON.parse(JSON.stringify(changes)));op.guard();
    return {ok:true,classId:value.classId,label,cards,created,linked,existing,skipped};
   }catch(cause){return friendly(cause,'import-failed');}
   finally{if(activeImport===owner)activeImport=null;}
  }
  function clear(){generation++;activeImport=null;}
  function destroy(){clear();destroyed=true;}
  return Object.freeze({previewRosterImport,importRoster,rebuildDeletedClass,clear,destroy,getState:()=>({busy:!!activeImport})});
 }
 return Object.freeze({create});
});
