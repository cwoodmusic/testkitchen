#!/usr/bin/env node
/* Export a complete, offline authoring snapshot; no player records or secrets. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const acorn=require('./vendor/acorn.cjs'),checks=require('./content-workshop-validation.js');
const ROOT=path.resolve(__dirname,'..');
const load=file=>require(path.join(ROOT,file+'.js'));
const clone=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const DATA_FILES=[
 'npc-visitors.js','npc-quotes.js','npc-behavior.js','musician-ui.js','musician-trivia.js','musician-missions.js',
 'music-history-data.js','music-history-quiz-data.js','music-history-progress.js','music-history.js',
 'music-classroom.js','classroom-tutorials.js','classroom-learning-paths.js','classroom-learning-paths-data.js',
 'classroom-curriculum-staff.js','classroom-curriculum-rhythm.js','classroom-curriculum-expression.js',
 'classroom-understanding-basics.js','classroom-understanding-staff.js','classroom-quiz.js','classroom-quiz-pool.js',
 'classroom-accidentals-lesson.js','classroom-exam-study.js','classroom-exam-curriculum.js','time-signature-lesson.js',
 'final-exam-bank.js','final-exam.js','piano-lab.js','piano-melodies.js','rhythm-fishing.js','rhythm-fishing-engine.js',
 'fishing-practice.js','fishing-battle.js','fishing-progress.js','fishing-biomes.js','dance-rhythm-game.js',
 'dance-rhythm-engine.js','dj-library.js','player-progression.js','player-profile.js','notes-shop.js','boutique-ui.js',
 'title-screen.js','world-preview.html','index.html'
];
function dataExports(name){return Object.fromEntries(Object.entries(load(name)).filter(([key,value])=>typeof value!=='function'&&!['KEY','CUSTOM_KEY','ATTEMPT_KEY','PREFIX'].includes(key)));}
function dialogueData(project){
 const context={window:{},console};vm.createContext(context);
 for(const file of ['npc-visitors.js','npc-quotes.js','npc-behavior.js'])vm.runInContext(read(file),context,{filename:file,timeout:5000});
 const defaults=clone(context.window.CodaNPCDialogueDefaults),cast=clone(context.window.CodaMusicianCast);
 return Object.entries(defaults).map(([id,entry])=>({id,name:cast.find(person=>person.id===id)?.name||id,entry:clone(project.dialogue?.[id]||entry)}));
}
function walk(node,parents,visit){
 if(!node||typeof node!=='object')return;visit(node,parents);
 for(const[key,value]of Object.entries(node)){
  if(['start','end','loc','range'].includes(key))continue;
  if(Array.isArray(value)){for(const item of value)if(item?.type)walk(item,[...parents,node],visit);}
  else if(value?.type)walk(value,[...parents,node],visit);
 }
}
function literalCatalogue(files,knownStrings){
 const copy=[],values=[],anchors={};
 for(const file of files){
  const source=read(file),chunks=[];
  if(file.endsWith('.html')){
   for(const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi))if(match[2].trim()&&!/application\/json/i.test(match[1]))chunks.push({text:match[2],offset:match.index+match[0].indexOf('>')+1});
  }else chunks.push({text:source,offset:0});
  for(const chunk of chunks){
   const tree=acorn.parse(chunk.text,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true,locations:true});
   walk(tree,[],(node,parents)=>{
    const parent=parents.at(-1);let value,kind,start=node.start,end=node.end;
    if(node.type==='Literal'&&!node.regex&&['string','number','boolean'].includes(typeof node.value)){
     if(parent?.type==='UnaryExpression'&&['-','+'].includes(parent.operator)&&typeof node.value==='number'){value=parent.operator==='-'?-node.value:node.value;start=parent.start;end=parent.end;}
     else value=node.value;
     kind=typeof value;
    }else if(node.type==='TemplateElement'&&typeof node.value.cooked==='string'){value=node.value.cooked;kind='template';}
    else return;
    if(parent?.type==='Property'&&parent.key===node&&!parent.computed)return;
    const property=parent?.type==='Property'?(parent.key.name||parent.key.value):'';
    if(/apiKey|authDomain|token|secret|password/i.test(String(property)))return;
    if(typeof value==='string'){
     if(knownStrings.has(value)||value==='use strict'||!/[A-Za-z]/.test(value)||value.length>20000)return;
     const visibleProperty=/^(text|label|reply|description|teach|prompt|hint|greeting|music|advice|games|title|name)$/i.test(String(property));
     const visibleCall=parent?.type==='CallExpression'&&/^(button|say|text|t|element|el|message|toast)$/.test(parent.callee?.name||'');
     if(!/\s/.test(value)&&!(/^[A-Z][A-Za-z!?….'’ -]{2,60}$/.test(value))&&!visibleProperty&&!visibleCall)return;
     if(/^(https?:|data:|\.?\.?\/)/.test(value)||/^AIza/.test(value))return;
    }
    start+=chunk.offset;end+=chunk.offset;
    const id=file+':'+start+':'+end;if(anchors[id])return;
    const line=source.slice(0,start).split('\n').length;
    const context=parents.slice().reverse().map(p=>p.id?.name||p.key?.name||p.key?.value).find(Boolean)||'inline content';
    anchors[id]={file,start,end,kind,original:value};
    const item={id,file,line,context,value};(typeof value==='string'?copy:values).push(item);
   });
  }
  if(file.endsWith('.html')){
   const masked=source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,match=>' '.repeat(match.length));
   for(const match of masked.matchAll(/>([^<]+)</g)){
    if(!/[A-Za-z]/.test(match[1])||!match[1].trim())continue;
    const start=match.index+1,end=start+match[1].length,value=source.slice(start,end),id=file+':'+start+':'+end;
    if(knownStrings.has(value.trim())||anchors[id])continue;
    anchors[id]={file,start,end,kind:'html-text',original:value};copy.push({id,file,line:source.slice(0,start).split('\n').length,context:'page text',value});
   }
  }
 }
 return {copy,values,anchors};
}
function collectStrings(value,set=new Set()){
 if(typeof value==='string')set.add(value);
 else if(value&&typeof value==='object')for(const item of Object.values(value))collectStrings(item,set);
 return set;
}
function exportPack(){
 const project=JSON.parse(read('published-world-project.json')),history=load('music-history-content'),hp=load('music-history-progress');
 const education=load('education-content'),educationDocument=JSON.parse(read('education-content.json'));
 if(!education.validate(educationDocument).ok)throw Error('Published classroom content is invalid.');
 const classroomQuiz=load('classroom-quiz'),pool=load('classroom-quiz-pool'),paths=load('classroom-learning-paths-data');
 const classroomStore=education.createStore({storage:{getItem:()=>JSON.stringify(educationDocument)},canEdit:()=>true});
 const collections=history.resolvePeople(project.musicHistoryContent),questions=history.resolveQuestions(project.musicHistoryContent);
 const content={
  conversations:dialogueData(project),
  classroom:{document:educationDocument,quizVariants:Object.fromEntries(Object.entries(classroomQuiz.QUIZZES).map(([id,model])=>[id,pool.poolsFor(id,classroomStore.getQuiz(id)||model)])),assessment:{lessonPassScore:classroomQuiz.PASS_SCORE,finalExam:pick(load('final-exam'),['PASS_PERCENT','SIZES','ORDERS'])},understandingChecks:{...load('classroom-understanding-basics').CHECKS,...load('classroom-understanding-staff').CHECKS},learningPaths:clone(paths.DEFINITIONS)},
  referenceLibrary:pick(load('music-classroom'),['TOPICS','SHELVES','HAYDN']),
  history:{collections,questions,archivedOverrides:clone(project.musicHistoryContent?.archivedQuizzes||{})},
  historyProgression:{...pick(hp,['REWARDS','QUIZ_PRIZE','PASS_SCORE','QUESTION_COUNT','COLLECTION_BONUSES']),activeQuestLimit:1,requiresNewPlayAfterAccept:true,practiceFishingCounts:false,quests:Object.keys(collections).flatMap(person=>collections[person].facts.map((fact,index)=>{const {progress,...quest}=hp.questFor(person,index);return quest;}))},
  missions:clone(load('musician-missions').DEFINITIONS),
  trivia:pick(load('musician-trivia'),['REWARD','PEOPLE','PERSON_TOPICS','QUESTIONS']),
  piano:pick(load('piano-lab'),['LESSONS','SCALES','INTERVALS']),
  fishing:{...pick(load('rhythm-fishing-engine'),['FISH','RARITIES','METERS','PATTERNS','TARGET_BARS','PERFECT_TARGET_BARS']),achievements:clone(load('fishing-progress').ACHIEVEMENTS),biomes:pick(load('fishing-biomes'),['BIOMES','SCREENS','SHARED_FISH_IDS'])},
  playerProgression:pick(load('player-progression'),['THRESHOLDS','COSMETICS','SOUNDS','LEVEL_NOTES','VIBES','ACHIEVEMENT_REWARDS','DANCE_ACHIEVEMENTS']),
  dance:{...pick(load('dance-rhythm-engine'),['BARS','BEATS_PER_BAR','COUNT_IN_BEATS','DIRECTIONS','DIFFICULTIES','PATTERNS']),songs:clone(load('dj-library').songs)}
 };
 const known=collectStrings(content);collectStrings(dataExports('music-history-data'),known);collectStrings(dataExports('music-history-quiz-data'),known);
 const literals=literalCatalogue(DATA_FILES,known);content.additionalCopy=literals.copy;content.advancedValues=literals.values;
 const files=[...DATA_FILES,'education-content.json','published-world-project.json'];
 const pack={format:checks.FORMAT,version:checks.VERSION,title:'Coda Arcade · Content Workshop',scope:'Coda Arcade and its rooms; cabinet-game tutorials excluded',
  instructions:{workflow:'Edit this content outside the game. Export JSON and upload it to the assistant for review and application. This file does not publish or change player saves.',answers:'correct and numeric answer fields are zero-based: 0 is the first answer.',ids:'IDs connect lessons, questions, facts, quests and saved progress. Keep existing IDs unless you deliberately want a new entry; additions and structural changes may need game-code updates.',copy:'Additional copy contains the remaining room conversations, hints, buttons and dynamic message fragments. Template fragments keep their variable expressions in the game.',rules:'Advanced values expose remaining numeric/boolean constants in their source context. Rewards, XP, targets and question counts also have structured sections. Ask the assistant to reconcile related fields when applying.'},
  baseline:{commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),sourceHashes:Object.fromEntries(files.map(file=>[file,hash(read(file))])),literalAnchors:literals.anchors},
  applicationMap:{conversations:'published-world-project.json: dialogue overrides; npc-behavior.js / npc-visitors.js for new characters',classroom:'education-content.json plus classroom-quiz-pool.js / curriculum sources when adding or changing variants and assessment rules',referenceLibrary:'music-classroom.js: TOPICS, SHELVES, HAYDN',history:'published-world-project.json: musicHistoryContent; music-history-data.js and music-history-quiz-data.js for additions, identities and fact links',historyProgression:'music-history-progress.js: rewards, thresholds, questFor and relationship progression',missions:'musician-missions.js: DEFINITIONS and matching evaluators for new kinds',trivia:'musician-trivia.js: QUESTIONS, PEOPLE and PERSON_TOPICS',piano:'piano-melodies.js and piano-lab.js: authored definitions, scales, intervals and room copy',fishing:'rhythm-fishing-engine.js, fishing-biomes.js, fishing-progress.js and room-copy sources',playerProgression:'player-progression.js: XP thresholds, levels, prizes and mastery definitions',dance:'dance-rhythm-engine.js, dance-rhythm-game.js and dj-library.js',additionalCopy:'Exact source literal anchors are in baseline.literalAnchors; preserve template variable bindings.',advancedValues:'Exact source anchors are in baseline.literalAnchors; review related formulas and gameplay tests.'},content};
 const validation=checks.validate(pack);if(!validation.ok)throw Error(validation.errors.slice(0,20).join('\n'));
 return pack;
}
function pick(module,keys){return clone(Object.fromEntries(keys.filter(key=>module[key]!==undefined).map(key=>[key,module[key]])));}
function loadPack(file){const pack=JSON.parse(fs.readFileSync(file,'utf8')),validation=checks.validate(pack);if(!validation.ok)throw Error(validation.errors.join('\n'));return pack;}
function checkCompatibility(pack){
 return Object.entries(pack.baseline.sourceHashes).filter(([file,digest])=>!fs.existsSync(path.join(ROOT,file))||hash(read(file))!==digest).map(([file])=>file);
}
function plan(pack){
 const current=exportPack(),changed=checks.diff(current.content,pack.content);
 return {format:'CodaContentApplicationPlan',version:1,baseCommit:pack.baseline.commit,changedFields:changed.length,sourceConflicts:checkCompatibility(pack),changes:changed,applicationMap:pack.applicationMap};
}
function build(directory){
 fs.mkdirSync(directory,{recursive:true});const pack=exportPack(),json=JSON.stringify(pack,null,2)+'\n';
 fs.writeFileSync(path.join(directory,'coda-content.json'),json);
 let html=fs.readFileSync(path.join(__dirname,'content-workshop-editor.html'),'utf8');
 html=html.replace('/*__VALIDATOR__*/',fs.readFileSync(path.join(__dirname,'content-workshop-validation.js'),'utf8')).replace('__CONTENT_PACK__',JSON.stringify(pack).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'));
 fs.writeFileSync(path.join(directory,'coda-content-editor.html'),html);
 fs.copyFileSync(path.join(__dirname,'content-workshop-README.md'),path.join(directory,'READ-ME.md'));
 return {directory,dialogues:pack.content.conversations.length,historyFacts:Object.values(pack.content.history.collections).reduce((n,p)=>n+p.facts.length,0),historyQuestions:pack.content.history.questions.length,examQuestions:pack.content.classroom.document.exam.questions.length,copyEntries:pack.content.additionalCopy.length,ruleEntries:pack.content.advancedValues.length};
}
if(require.main===module){try{
 const [command,file]=process.argv.slice(2);
 if(command==='export')console.log(JSON.stringify(build(path.resolve(file||path.join(ROOT,'../scratch/coda-content-workshop'))),null,2));
 else if(command==='validate'){const pack=loadPack(file);console.log(JSON.stringify({valid:true,...checks.validate(pack),sourceConflicts:checkCompatibility(pack)},null,2));}
 else if(command==='diff'){const pack=loadPack(file);console.log(JSON.stringify(plan(pack),null,2));}
 else throw Error('Usage: node tools/content-workshop.cjs export OUTPUT_DIRECTORY | validate EDITED.json | diff EDITED.json');
}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={exportPack,build,plan,loadPack,checkCompatibility,literalCatalogue};
