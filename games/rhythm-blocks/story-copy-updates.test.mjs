import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_COPY_UPDATES} from './story-copy-data.mjs';
import {upgradeStoryCopy} from './story-copy-updates.mjs';
import {createDefaultProject} from './developer-project.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const person=(project,roomId,id)=>project.content[roomId].people.find(item=>item.id===id);
const inspection=(project,roomId,id)=>project.content[roomId].inspections.find(item=>item.id===id);
const updateFor=(section,roomId,id,field)=>STORY_COPY_UPDATES.find(update=>update.path[0]==='content'&&update.path[1]===roomId&&update.path[2]===section&&update.path[3]?.id===id&&update.path.at(-1)===field);

// Build the old stock wording on today's project without relying on a private
// work file, or downgrading any layout, inventory, speaker, or timeline data.
function oldStockProject(){
 const project=createDefaultProject();
 for(const update of STORY_COPY_UPDATES){
  let current=project;
  for(const part of update.path.slice(0,-1)){
   if(typeof part==='string')current=current[part];
   else if(part.id!==undefined)current=current.find(item=>item.id===part.id);
   else current=current[part.index];
   assert(current!==undefined,JSON.stringify(update.path));
  }
  current[update.path.at(-1)]=update.previousText;
 }
 return project;
}

test('all shipped stock prose upgrades to the current project without changing other authoring data',()=>{
 assert(STORY_COPY_UPDATES.length>100,'The generated catalog must include the complete campaign.');
 const current=createDefaultProject(),previous=oldStockProject(),before=clone(previous);
 previous.authorNotes={reviewed:false,details:['Retain private notes.']};
 current.authorNotes=clone(previous.authorNotes);before.authorNotes=clone(previous.authorNotes);
 const upgraded=upgradeStoryCopy(freeze(previous));
 assert.deepEqual(upgraded,current);
 assert.deepEqual(previous,before,'The input project remains unchanged, including frozen data.');
 assert.deepEqual(upgradeStoryCopy(upgraded),upgraded,'Repeated loads do not rewrite words again.');
 upgraded.authorNotes.details[0]='Output only';assert.equal(previous.authorNotes.details[0],'Retain private notes.');
});

test('custom wording, deleted fields, null opt-outs and unrelated metadata stay authored',()=>{
 const previous=oldStockProject(),nell=person(previous,'depot','nell');
 nell.story='My completely different letter mystery.';nell.role=null;delete nell.inventory;
 previous.content.depot.arrival=null;
 const evidence=inspection(previous,'depot','returned-letter');evidence.text='My own observation.';evidence.dialogue=null;
 const clip=previous.content.depot.cutscene.find(item=>item.kind==='dialogue');
 clip.text='My alternate opening.';clip.startTile=19;clip.durationTiles=77;clip.author={memo:'Keep this pause.'};clip.reaction=null;
 previous.content.depot.people.push({id:'my-guide',story:updateFor('people','depot','nell','story').previousText});
 const before=clone(previous),upgraded=upgradeStoryCopy(freeze(previous));
 assert.equal(person(upgraded,'depot','nell').story,nell.story);assert.equal(person(upgraded,'depot','nell').role,null);
 assert(!Object.hasOwn(person(upgraded,'depot','nell'),'inventory'));
 assert.equal(upgraded.content.depot.arrival,null);assert.deepEqual(inspection(upgraded,'depot','returned-letter'),evidence);
 assert.deepEqual(upgraded.content.depot.cutscene.find(item=>item.id===clip.id),clip);
 assert.deepEqual(person(upgraded,'depot','my-guide'),person(before,'depot','my-guide'));
 assert.deepEqual(previous,before);
});

test('materialized replies receive only exact legacy story, route and inventory text repairs',()=>{
 const previous=oldStockProject(),nell=person(previous,'depot','nell');
 const changes=['story','route','inventory'].map(field=>updateFor('people','depot','nell',field));
 assert(changes.every(Boolean));
 nell.replies=changes.map((update,index)=>({id:`authored-${index}`,label:`Choice ${index}`,text:update.previousText,demo:['quarter'],author:{position:index}}));
 nell.replies.push({id:'custom',label:'My question',text:'A custom answer.'},{id:'blank',label:'Silent',text:''});
 nell.story='A separate custom biography.';delete nell.route;nell.inventory=null;
 const before=clone(previous),upgraded=upgradeStoryCopy(freeze(previous)),actual=person(upgraded,'depot','nell');
 for(const [index,update]of changes.entries())assert.deepEqual(actual.replies[index],{...nell.replies[index],text:update.text});
 assert.deepEqual(actual.replies.slice(3),nell.replies.slice(3));assert.equal(actual.story,nell.story);assert.equal(actual.inventory,null);
 assert(!Object.hasOwn(actual,'route'));assert.deepEqual(previous,before);
 const empty=oldStockProject();person(empty,'depot','nell').replies=[];
 assert.deepEqual(person(upgradeStoryCopy(empty),'depot','nell').replies,[]);
});

test('renamed cast use their unique character identity without changing speakers or performance',()=>{
 const previous=oldStockProject(),scene=previous.scenes.depot,nell=person(previous,'depot','nell');nell.id='postkeeper';
 scene.actors.find(actor=>actor.id==='nell').id='postkeeper';
 for(const clip of previous.content.depot.cutscene){if(clip.speaker==='nell')clip.speaker='postkeeper';if(clip.actor==='nell')clip.actor='postkeeper';}
 for(const entry of previous.content.depot.inspections)for(const line of entry.dialogue??[])if(line.speaker==='nell')line.speaker='postkeeper';
 const clip=previous.content.depot.cutscene.find(item=>item.kind==='dialogue'&&item.speaker==='postkeeper');
 clip.startTile=22;clip.durationTiles=81;clip.stageCue=null;clip.author={timing:'Deliberate.'};
 const upgraded=upgradeStoryCopy(freeze(previous)),actual=person(upgraded,'depot','postkeeper');
 assert.equal(actual.story,updateFor('people','depot','nell','story').text);
 const updatedClip=upgraded.content.depot.cutscene.find(item=>item.id===clip.id);
 assert.notEqual(updatedClip.text,clip.text);assert.deepEqual({...updatedClip,text:clip.text},clip);
 assert.equal(inspection(upgraded,'depot','returned-letter').dialogue.find(line=>line.speaker==='postkeeper').speaker,'postkeeper');
 const wrongSpeaker=oldStockProject(),speech=wrongSpeaker.content.depot.cutscene.find(item=>item.id===clip.id);speech.speaker='iris';
 assert.deepEqual(upgradeStoryCopy(wrongSpeaker).content.depot.cutscene.find(item=>item.id===clip.id),speech,'Changing the speaker makes this an authored speech clip.');
 const ambiguous=oldStockProject();person(ambiguous,'depot','nell').id='first-postkeeper';
 ambiguous.scenes.depot.actors.find(actor=>actor.id==='nell').id='first-postkeeper';
 ambiguous.scenes.depot.actors.push({id:'second-postkeeper',character:'nell'});
 ambiguous.content.depot.people.push({...clone(person(ambiguous,'depot','first-postkeeper')),id:'second-postkeeper'});
 const untouched=upgradeStoryCopy(ambiguous);
 assert.equal(person(untouched,'depot','first-postkeeper').story,person(ambiguous,'depot','first-postkeeper').story);
 assert.equal(person(untouched,'depot','second-postkeeper').story,person(ambiguous,'depot','second-postkeeper').story);
});

test('renamed inspections are recognized by exact old speech and retain IDs, metadata and scene placement',()=>{
 const previous=oldStockProject(),entry=inspection(previous,'depot','returned-letter');entry.id='letter-on-my-desk';entry.author={note:'Moved by me.'};
 for(const item of [...previous.scenes.depot.objects,...previous.scenes.depot.geometry.targets])if(item.id==='returned-letter')item.id=entry.id;
 const before=clone(previous),upgraded=upgradeStoryCopy(freeze(previous)),actual=inspection(upgraded,'depot',entry.id);
 assert.equal(actual.text,updateFor('inspections','depot','returned-letter','text').text);
 assert.equal(actual.id,entry.id);assert.deepEqual(actual.author,entry.author);assert.notDeepEqual(actual.dialogue,entry.dialogue);
 for(const collection of ['objects','targets']){
  const oldItems=collection==='objects'?before.scenes.depot.objects:before.scenes.depot.geometry.targets;
  const newItems=collection==='objects'?upgraded.scenes.depot.objects:upgraded.scenes.depot.geometry.targets;
  for(const item of oldItems){const updated=newItems.find(other=>other.id===item.id);assert.deepEqual({...updated,label:item.label,actionLabel:item.actionLabel},{...item,label:item.label,actionLabel:item.actionLabel});}
 }
 assert.deepEqual(previous,before);
});

test('partial custom or ambiguous renamed discussions are preserved instead of guessed',()=>{
 for(const mode of ['custom','ambiguous','null','empty']){
  const previous=oldStockProject(),entry=inspection(previous,'depot','returned-letter');entry.id='renamed-letter';
  if(mode==='custom')entry.dialogue[0].text='My own opening observation.';
  if(mode==='ambiguous')previous.content.depot.inspections.push({...clone(entry),id:'another-letter'});
  if(mode==='null')entry.dialogue=null;
  if(mode==='empty')entry.dialogue=[];
  const upgraded=upgradeStoryCopy(freeze(previous));
  assert.deepEqual(inspection(upgraded,'depot',entry.id),entry,mode);
 }
 const previous=oldStockProject(),depot=previous.content.depot;previous.content['my-room']=clone(depot);
 const upgraded=upgradeStoryCopy(previous);assert.deepEqual(upgraded.content['my-room'],depot,'Stock text copied into another room is authored content.');
});

test('the catalog changes existing prose only and the helper tolerates incomplete safe JSON',()=>{
 const categories=new Set();
 for(const update of STORY_COPY_UPDATES){
  assert.equal(typeof update.previousText,'string');assert.equal(typeof update.text,'string');assert.notEqual(update.previousText,update.text);
  assert(Array.isArray(update.path));assert(!update.path.some(part=>['__proto__','prototype','constructor'].includes(part)));
  categories.add(update.path[0]);
 }
 for(const name of ['content','scenes','doors','sources','terminals'])assert(categories.has(name),name);
 for(const value of [null,7,'words',[],{}, {content:null},{content:{depot:{people:[],inspections:null,cutscene:[]}}}]){
  const upgraded=upgradeStoryCopy(freeze(value));assert.deepEqual(upgraded,value);if(value&&typeof value==='object')assert.notEqual(upgraded,value);
 }
});
