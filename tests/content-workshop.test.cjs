'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const workshop=require('../tools/content-workshop.cjs'),checks=require('../tools/content-workshop-validation.js');
const pack=workshop.exportPack(),clone=value=>JSON.parse(JSON.stringify(value));

test('the external workshop includes the complete current classroom, history and progression content',()=>{
 assert.equal(checks.validate(pack).ok,true);assert.equal(pack.content.classroom.document.exam.questions.length,800);
 assert.equal(Object.keys(pack.content.classroom.document.lessons).length,9);
 assert.equal(Object.keys(pack.content.history.collections).length,18);assert.equal(pack.content.history.questions.length,180);assert.equal(pack.content.historyProgression.quests.length,180);
 assert.equal(pack.content.missions.length,35);assert.equal(pack.content.piano.LESSONS.length,9);assert.equal(pack.content.fishing.FISH.length,30);
 assert.equal(pack.content.conversations.length,15);assert.equal(pack.content.playerProgression.THRESHOLDS.length,50);
 for(const file of ['piano-lab.js','rhythm-fishing.js','musician-ui.js','music-classroom.js','world-preview.html'])assert.ok(pack.content.additionalCopy.some(item=>item.file===file),'Include remaining inline dialogue in '+file);
 assert.ok(pack.content.advancedValues.some(item=>item.file==='music-history-progress.js'));
 assert.equal(Object.keys(pack.baseline.sourceHashes).some(file=>file.includes('account-config')),false);
});

test('the latest fact and quiz overrides are the starting content, not older defaults',()=>{
 const project=JSON.parse(fs.readFileSync(path.join(__dirname,'../published-world-project.json'),'utf8'));
 const facts=Object.values(pack.content.history.collections).flatMap(person=>person.facts),questions=pack.content.history.questions;
 for(const[id,text]of Object.entries(project.musicHistoryContent.facts))assert.equal(facts.find(fact=>fact.id===id).text,text);
 for(const[id,edited]of Object.entries(project.musicHistoryContent.quizzes)){
  const question=questions.find(question=>question.id===id);assert.equal(question.prompt,edited.prompt);assert.deepEqual(question.choices,edited.choices);assert.equal(question.answer,edited.answer);
 }
});

test('dialogue, lessons, questions and progression edits produce an exact application plan without changing the game',()=>{
 const edited=clone(pack),before=fs.readFileSync(path.join(__dirname,'../published-world-project.json'));
 edited.content.conversations[0].entry.description='A revised author description.';
 edited.content.classroom.document.exam.questions[0].prompt='An externally revised question.';
 edited.content.history.questions[0].answer=2;
 edited.content.historyProgression.PASS_SCORE=90;
 assert.equal(checks.validate(edited).ok,true);
 const plan=workshop.plan(edited);assert.equal(plan.changedFields,4);assert.deepEqual(plan.sourceConflicts,[]);
 assert.ok(plan.changes.some(change=>change.path==='/historyProgression/PASS_SCORE'&&change.after===90));
 assert.ok(fs.readFileSync(path.join(__dirname,'../published-world-project.json')).equals(before));
});

test('bad answer indexes, duplicate IDs, broken fact links and unsafe baseline paths fail validation',()=>{
 for(const change of [p=>p.content.history.questions[0].answer=99,p=>p.content.history.questions[0].factId='missing-fact',p=>p.content.missions[1].id=p.content.missions[0].id,p=>p.baseline.sourceHashes['../../private.json']='fake']){
  const bad=clone(pack);change(bad);assert.equal(checks.validate(bad).ok,false);
 }
});

test('inline text and numeric anchors refer to current source ranges and retain their original types',()=>{
 const sources=new Map(Object.keys(pack.baseline.sourceHashes).map(file=>[file,fs.readFileSync(path.join(__dirname,'..',file),'utf8')]));
 for(const list of [pack.content.additionalCopy,pack.content.advancedValues])for(const item of list){
  const anchor=pack.baseline.literalAnchors[item.id];assert.equal(anchor.original,item.value);
  const source=sources.get(anchor.file);assert.ok(anchor.start>=0&&anchor.end<=source.length);
 }
});
