import test from 'node:test';
import assert from 'node:assert/strict';
import {STOCK_GAG_DIALOGUE_UPDATES,upgradeStockGagDialogue} from './dialogue-updates.mjs';
import {createDefaultProject} from './developer-project.mjs';

const clone=value=>structuredClone(value);
const clipFor=(project,update)=>project.content[update.roomId].cutscene.find(clip=>clip.id===update.clipId);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};

test('saved stock speech receives the new wording while every authored track and resource stays intact',()=>{
 const project=createDefaultProject();
 for(const [index,update]of STOCK_GAG_DIALOGUE_UPDATES.entries()){
  const clip=clipFor(project,update);
  assert.equal(clip.text,update.text,'Published words and the exact upgrade catalog agree.');
  clip.text=update.previousText;
  clip.startTile+=index+1;clip.durationTiles+=3;
  clip.author={note:'Keep my timing and scene annotations.',index};
 }
 project.authorNotes={edition:'My saved project'};
 const before=clone(project),updated=upgradeStockGagDialogue(freeze(project));
 assert.deepEqual(project,before,'Loading a stored project does not mutate its snapshot.');
 assert.notEqual(updated,project);
 for(const update of STOCK_GAG_DIALOGUE_UPDATES){
  assert.deepEqual(clipFor(updated,update),{...clipFor(before,update),text:update.text},`${update.roomId}/${update.clipId}: only spoken wording changes`);
 }
 for(const key of ['schemaVersion','settings','rooms','doors','sources','scenes','cast','player','noteKinds','authorNotes'])assert.deepEqual(updated[key],before[key],key);
 for(const [roomId,room]of Object.entries(before.content))for(const clip of room.cutscene){
  if(STOCK_GAG_DIALOGUE_UPDATES.some(update=>update.roomId===roomId&&update.clipId===clip.id))continue;
  assert.deepEqual(updated.content[roomId].cutscene.find(candidate=>candidate.id===clip.id),clip,'Unrelated walks, reactions and custom lines remain unchanged.');
 }
 assert.deepEqual(upgradeStockGagDialogue(updated),updated,'A second load makes no further edits.');
});

test('exact stock-line matching protects edited text, renamed speakers and unrelated clip identities',()=>{
 const update=STOCK_GAG_DIALOGUE_UPDATES[0];
 const stock={id:update.clipId,kind:'dialogue',speaker:update.speaker,actor:'iris',text:update.previousText,startTile:9,durationTiles:12,author:{keep:true}};
 const clips=[stock,{...stock,text:stock.text+' My own ending.'},{...stock,speaker:'iris'},{...stock,id:'my-opening'},{...stock,kind:'emote'},{...stock,text:37},null];
 const project={schemaVersion:1,content:{[update.roomId]:{cutscene:clips}}},before=clone(project),updated=upgradeStockGagDialogue(project);
 assert.deepEqual(updated.content[update.roomId].cutscene[0],{...stock,text:update.text},'An edited lane owner and annotations are not overwritten.');
 assert.deepEqual(updated.content[update.roomId].cutscene.slice(1),clips.slice(1));
 assert.deepEqual(project,before);
});

test('legacy combined clips get the same exact text repair without losing their movement or reaction payloads',()=>{
 const update=STOCK_GAG_DIALOGUE_UPDATES.find(row=>row.roomId==='garden-alcove'&&row.speaker==='pip');
 const legacy={id:update.clipId,speaker:update.speaker,text:update.previousText,target:'garden-alcove-flower-stone',action:'look',emote:'question',waypoints:[{x:600,y:800}],startTile:7,durationTiles:28};
 const project={content:{[update.roomId]:{cutscene:[legacy]}}};
 assert.deepEqual(upgradeStockGagDialogue(project).content[update.roomId].cutscene,[{...legacy,text:update.text}]);
 assert.equal(legacy.text,update.previousText);
});

test('missing and malformed authoring records remain available to ordinary project validation',()=>{
 const update=STOCK_GAG_DIALOGUE_UPDATES[0];
 for(const value of [null,7,{},[],{content:null},{content:[]},{content:{custom:{cutscene:[]}}},{content:{[update.roomId]:{cutscene:null}}},{content:{[update.roomId]:{cutscene:{text:update.previousText}}}},{content:{[update.roomId]:{cutscene:[null,3,'unfinished',{},[]]}}}]){
  assert.deepEqual(upgradeStockGagDialogue(value),value);
 }
 assert(Object.isFrozen(STOCK_GAG_DIALOGUE_UPDATES));
 assert(STOCK_GAG_DIALOGUE_UPDATES.every(Object.isFrozen));
 assert.throws(()=>{STOCK_GAG_DIALOGUE_UPDATES[0].text='Changed';},TypeError);
});
