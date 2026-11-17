import test from 'node:test';
import assert from 'node:assert/strict';
import {OBJECT_DIALOGUES} from './object-dialogue-content.mjs';
import {compileObjectDialogue,objectDialogueSignature,upgradeObjectDialogues,restoreObjectDialogueSeen,OBJECT_DIALOGUE_MAX_LINES} from './object-dialogue.mjs';
import {createDefaultProject,normalizeProject,validateProject} from './developer-project.mjs';
import {createRoomCutscene} from './cutscene.mjs';
import {PREVIOUS_ROOM_LAYOUT_SCENES,PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS,VARIED_ROOM_IDS} from './room-layouts.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const inspection=(project,id)=>Object.values(project.content).flatMap(room=>room.inspections).find(entry=>entry.id===id);
const scene=()=>({actors:[{id:'nell',feet:{x:80,y:90}},{id:'pip',feet:{x:500,y:350}}],geometry:{gridSize:20,speed:160}});
const entry=()=>({id:'test-object',title:'My object',text:'Read this without collecting anything.',dialogue:[
 {id:'first',speaker:'nell',text:'The parcel came back.',author:{note:'Keep this.'}},
 {speaker:'mira',text:'A persistent parcel. I approve.',reaction:{emote:'idea',durationTiles:8},stageCue:null},
]});
const invalid=(project,fragment)=>{const result=validateProject(project);assert.equal(result.valid,false);assert(result.errors.some(error=>error.includes(fragment)),result.errors.join('\n'));};

test('every shipped place has an object exchange with independent speech clips and no physical performance',()=>{
 const project=createDefaultProject(),before=clone(project);let discussions=0;
 assert.equal(Object.keys(project.scenes).length,23);assert.equal(Object.keys(OBJECT_DIALOGUES).length,24);
 assert.equal(validateProject(project).valid,true);
 for(const [roomId,room]of Object.entries(project.content)){
  const selected=room.inspections.filter(item=>Array.isArray(item.dialogue)&&item.dialogue.length);
  assert(selected.length>=1,roomId);
  for(const item of selected){
   discussions++;
   const clips=compileObjectDialogue({entry:item,scene:project.scenes[roomId]});
   assert.equal(clips.length,item.dialogue.length);assert.equal(new Set(clips.map(clip=>clip.id)).size,clips.length);
   let end=0;
   for(const [index,clip]of clips.entries()){
    assert.equal(clip.kind,'dialogue');assert.equal(clip.actor,clip.speaker);assert.equal(clip.text,item.dialogue[index].text);
    assert.match(clip.id,/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);assert.equal(clip.startTile,end);end+=clip.durationTiles;
    for(const key of ['target','destination','waypoints','action','gait','gesture','emote'])assert(!Object.hasOwn(clip,key));
   }
   const player=createRoomCutscene({scene:project.scenes[roomId],beats:clips,manualDialogue:true});
   const actors=clone(player.state.actors);
   for(let elapsed=0;elapsed<10000;elapsed+=100)player.update(100);
   while(player.state.beat){assert.deepEqual(player.state.actors,actors);player.next();}
  }
 }
 assert.equal(discussions,24);assert.deepEqual(project,before,'Reading a script cannot change art, rooms, locks, sources or notes.');
});

test('compilation preserves custom text, durations, IDs and metadata while isolating speech from movement',()=>{
 const original=entry();original.dialogue[0].durationTiles=9;
 Object.assign(original.dialogue[0],{kind:'walk',actor:'pip',startTile:99,target:'a-chest',action:'search',destination:{x:1,y:2},waypoints:[{x:3,y:4}],gait:'run',gesture:'trip',emote:'happy'});
 const before=clone(original),clips=compileObjectDialogue({entry:freeze(original),scene:scene()});
 assert.equal(clips[0].id,'first');assert.equal(clips[0].startTile,0);assert.equal(clips[0].durationTiles,9);
 assert.equal(clips[0].actor,'nell');assert.equal(clips[0].kind,'dialogue');assert.deepEqual(clips[0].author,before.dialogue[0].author);
 assert.equal(clips[1].startTile,9);assert(clips[1].durationTiles>=24&&clips[1].durationTiles<=48);
 assert.deepEqual(clips[1].reaction,{emote:'idea',durationTiles:8});assert.equal(clips[1].stageCue,null);
 for(const key of ['target','destination','waypoints','action','gait','gesture','emote'])assert(!Object.hasOwn(clips[0],key));
 clips[0].author.note='Output only';clips[1].reaction.durationTiles=1;assert.deepEqual(original,before);
});

test('blank rows stay editable without being spoken and generated IDs remain valid, stable and unique',()=>{
 const item={id:'x'.repeat(80),dialogue:[{speaker:'nell',text:''},{speaker:'mira',text:'A word.'},{speaker:'nell',text:'   '}]};
 const spoken=compileObjectDialogue({entry:item,scene:scene()}),editor=compileObjectDialogue({entry:item,scene:scene(),includeBlank:true});
 assert.equal(spoken.length,1);assert.equal(editor.length,3);assert.equal(spoken[0].id,editor[1].id);assert.equal(spoken[0].startTile,0);
 assert.equal(spoken[0].id.length,80);assert.match(spoken[0].id,/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
 assert.deepEqual(compileObjectDialogue({entry:item,scene:scene()}),spoken);
 const collision={id:'test',dialogue:[{id:'object-test-line-2',speaker:'nell',text:'First.'},{speaker:'mira',text:'Second.'}]};
 const ids=compileObjectDialogue({entry:collision,scene:scene()}).map(clip=>clip.id);assert.equal(new Set(ids).size,2);assert.equal(ids[0],'object-test-line-2');
 for(const dialogue of [undefined,null,[],[{speaker:'mira',text:' '}]])assert.deepEqual(compileObjectDialogue({entry:{dialogue}}),[]);
});

test('compiler rejects oversized or invalid scripts rather than truncating or staging a missing person',()=>{
 assert.equal(OBJECT_DIALOGUE_MAX_LINES,12);
 for(const dialogue of [false,{},Array(13).fill({speaker:'mira',text:'No truncation.'}),[{speaker:'mira',text:'x'.repeat(601)}],[{speaker:'mira',text:null}],[{speaker:'mira',text:'Word',durationTiles:0}],[{speaker:'mira',text:'Word',reaction:{emote:'invalid',durationTiles:8}}],[{speaker:'mira',text:'Word',stageCue:'other'}],[{id:'same',speaker:'mira',text:'One'},{id:'same',speaker:'nell',text:'Two'}]])assert.throws(()=>compileObjectDialogue({entry:{id:'test',dialogue},scene:scene()}));
 assert.throws(()=>compileObjectDialogue({entry:{dialogue:[{speaker:'oren',text:'I am elsewhere.'}]},scene:scene()}),/present in this room/);
 assert.throws(()=>compileObjectDialogue({entry:entry(),scene:{geometry:{gridSize:0,speed:160}}}),/walking geometry/);
});

test('default upgrades fill existing missing object scripts only and preserve author optouts and edits',()=>{
 const project=createDefaultProject();
 for(const room of Object.values(project.content))for(const item of room.inspections)delete item.dialogue;
 const chosen=Object.keys(OBJECT_DIALOGUES),a=inspection(project,chosen[0]),b=inspection(project,chosen[1]),c=inspection(project,chosen[2]);
 a.dialogue=null;b.dialogue=[];c.dialogue=[{id:'mine',speaker:'mira',text:'My own discussion.',durationTiles:17,author:{memo:'Do not replace.'}}];
 a.text='My separate observation text.';project.authorNotes={editing:true};
 const before=clone(project),upgraded=upgradeObjectDialogues(freeze(project));
 assert.equal(inspection(upgraded,a.id).dialogue,null);assert.deepEqual(inspection(upgraded,b.id).dialogue,[]);assert.deepEqual(inspection(upgraded,c.id).dialogue,c.dialogue);
 assert.equal(inspection(upgraded,a.id).text,a.text);assert.deepEqual(upgraded.authorNotes,before.authorNotes);
 for(const key of ['settings','rooms','doors','sources','scenes','cast','player','noteKinds','previews','terminals'])assert.deepEqual(upgraded[key],before[key]);
 for(const [roomId,room]of Object.entries(before.content)){
  assert.equal(upgraded.content[roomId].inspections.length,room.inspections.length);
  for(const item of room.inspections){const actual=inspection(upgraded,item.id);if(!Object.hasOwn(OBJECT_DIALOGUES,item.id))assert.deepEqual(actual,item);}
 }
 assert.deepEqual(project,before);assert.deepEqual(upgradeObjectDialogues(upgraded),upgraded);
 const loaded=normalizeProject(before);assert.deepEqual(inspection(loaded,c.id).dialogue,c.dialogue);assert.equal(validateProject(loaded).valid,true);
 const localOnly=upgradeObjectDialogues({content:{depot:{people:[],inspections:[{id:'returned-letter'}]}}});
 assert(localOnly.content.depot.inspections[0].dialogue.every(line=>line.speaker==='mira'),'Missing stock actors are not reintroduced by a new discussion.');
 for(const value of [null,7,{},[],{content:null},{content:{x:{inspections:null}}}])assert.deepEqual(upgradeObjectDialogues(value),value);
});

test('seen signatures follow playable words, speaker and cues while ignoring private editor notes',()=>{
 const item=entry(),signature=objectDialogueSignature(item);assert.match(signature,/^object-v1-[0-9a-f]{16}$/);
 assert.equal(objectDialogueSignature(clone(item)),signature);
 const metadata=clone(item);metadata.dialogue[0].author.note='A different editor note';metadata.title='New title';assert.equal(objectDialogueSignature(metadata),signature);
 const ordered=clone(item);ordered.dialogue[1].reaction={durationTiles:8,emote:'idea'};assert.equal(objectDialogueSignature(ordered),signature);
 for(const change of [e=>{e.id='different-object';},e=>{e.dialogue[0].text+=' Changed.';},e=>{e.dialogue[0].speaker='mira';},e=>{e.dialogue.reverse();},e=>{e.dialogue[0].durationTiles=90;},e=>{e.dialogue[0].reaction={emote:'question',durationTiles:14};},e=>{e.dialogue[0].stageCue='radar';}]){
  const changed=clone(item);change(changed);assert.notEqual(objectDialogueSignature(changed),signature);
 }
 for(const value of [null,{}, {dialogue:null},{dialogue:[]},{dialogue:[{speaker:'mira',text:' '}]}])assert.equal(objectDialogueSignature(value),null);
});

test('untouched stock discussions follow a renamed local character without replacing custom speech',()=>{
 const project=createDefaultProject(),room='ending-home',stock=project.content[room].inspections.find(item=>item.dialogue),before=clone(stock.dialogue);
 const person=project.content[room].people.find(item=>item.id==='nell');person.id='keeper';person.name='My keeper';
 const actor=project.scenes[room].actors.find(item=>item.id==='nell');actor.id='keeper';
 stock.id='renamed-object';
 const upgraded=upgradeObjectDialogues(project),actual=inspection(upgraded,'renamed-object').dialogue;
 assert.deepEqual(actual,before.map(line=>({...line,speaker:line.speaker==='nell'?'keeper':line.speaker})));
 assert.deepEqual(upgradeObjectDialogues(upgraded),upgraded);
 const custom=clone(project);inspection(custom,'renamed-object').dialogue[0].author={memo:'This is now authored.'};
 assert.deepEqual(inspection(upgradeObjectDialogues(custom),'renamed-object').dialogue,inspection(custom,'renamed-object').dialogue);
 assert.deepEqual(stock.dialogue,before,'Stock adaptation does not mutate the supplied project.');
});

test('saved discussion receipts retain only current recognized signatures',()=>{
 const project=createDefaultProject(),item=inspection(project,'returned-letter'),signature=objectDialogueSignature(item);
 const saved={version:1,seen:{'returned-letter':signature,'clockwork-roost':'object-v1-0000000000000000',unknown:signature}};
 const before=clone(saved);assert.deepEqual([...restoreObjectDialogueSeen({project,saved})],[['returned-letter',signature]]);assert.deepEqual(saved,before);
 const changed=clone(project);inspection(changed,item.id).dialogue[0].text+=' Revised.';assert.equal(restoreObjectDialogueSeen({project:changed,saved}).size,0);
 for(const value of [null,{}, {version:2,seen:saved.seen},{version:1,seen:[]},{version:1,seen:{'returned-letter':false}}])assert.equal(restoreObjectDialogueSeen({project,saved:value}).size,0);
});

test('legacy stock layouts upgrade before default choreography without replacing authored speech or paths',()=>{
 const project=createDefaultProject();
 for(const roomId of VARIED_ROOM_IDS){
  project.scenes[roomId]=clone(PREVIOUS_ROOM_LAYOUT_SCENES[roomId]);
  const speech=project.content[roomId].cutscene.filter(clip=>clip.kind==='dialogue');
  speech[0].text='My preserved room greeting.';speech[0].author={memo:'Keep my dialogue edit.'};
  project.content[roomId].cutscene=[...clone(PREVIOUS_ROOM_LAYOUT_PHYSICAL_CLIPS[roomId]),...speech];
 }
 const before=clone(project),loaded=normalizeProject(project);
 assert.equal(validateProject(loaded).valid,true);
 for(const roomId of VARIED_ROOM_IDS){
  assert.notEqual(loaded.scenes[roomId].image,before.scenes[roomId].image);
  assert.deepEqual(loaded.content[roomId].cutscene.filter(clip=>clip.kind==='dialogue'),before.content[roomId].cutscene.filter(clip=>clip.kind==='dialogue'));
 }
 assert.deepEqual(loaded.doors,before.doors);assert.deepEqual(loaded.sources,before.sources);assert.deepEqual(project,before);
 const roomId=VARIED_ROOM_IDS[0],missing=clone(before);delete missing.content[roomId].cutscene;
 const missingLoaded=normalizeProject(missing);assert.notEqual(missingLoaded.scenes[roomId].image,missing.scenes[roomId].image);assert(missingLoaded.content[roomId].cutscene.length>0);
 const empty=clone(before);empty.content[roomId].cutscene=[];assert.deepEqual(normalizeProject(empty).scenes[roomId],empty.scenes[roomId]);
 const edited=clone(before);edited.content[roomId].cutscene[0].startTile+=1;const editedLoaded=normalizeProject(edited);
 assert.deepEqual(editedLoaded.scenes[roomId],edited.scenes[roomId]);assert.deepEqual(editedLoaded.content[roomId].cutscene,edited.content[roomId].cutscene);
 const invalidNull=clone(before);invalidNull.content[roomId].cutscene=null;assert.throws(()=>normalizeProject(invalidNull),/cutscene/);
});

test('project validation accepts editable speech and explicit off, and rejects unsafe or nonlocal authoring',()=>{
 const project=createDefaultProject(),item=inspection(project,'returned-letter');
 item.dialogue=[{id:'mine',speaker:'mira',text:'',durationTiles:17,reaction:null,stageCue:null,author:{memo:'Preserve me.'}}];
 assert.equal(validateProject(project).valid,true);assert.deepEqual(inspection(normalizeProject(project),item.id).dialogue,item.dialogue);
 for(const dialogue of [null,[]]){const copy=clone(project);inspection(copy,item.id).dialogue=dialogue;assert.equal(validateProject(copy).valid,true);}
 const cases=[
  [false,'.dialogue'],[{},'.dialogue'],[Array(13).fill({speaker:'mira',text:'Too many.'}),'.dialogue'],
  [[{speaker:'oren',text:'Not in the depot.'}],'.speaker'],[[{speaker:'mira',text:'x'.repeat(601)}],'.text'],
  [[{speaker:'mira',text:9}],'.text'],[[{id:'same',speaker:'mira',text:'One'},{id:'same',speaker:'nell',text:'Two'}],'.id'],
  [[{speaker:'mira',text:'Word',durationTiles:0}],'.durationTiles'],[[{speaker:'mira',text:'Word',reaction:{emote:'shock',durationTiles:8}}],'.reaction.emote'],
  [[{speaker:'mira',text:'Word',reaction:{emote:'surprise',durationTiles:513}}],'.reaction.durationTiles'],[[{speaker:'mira',text:'Word',stageCue:'other'}],'.stageCue'],
  [[{speaker:'mira',text:'Word',kind:'walk'}],'.kind'],[[{speaker:'mira',text:'Word',action:'search'}],'.action'],
 ];
 for(const [dialogue,fragment]of cases){const copy=clone(project);inspection(copy,item.id).dialogue=dialogue;invalid(copy,fragment);}
 const poisoned=clone(project);inspection(poisoned,item.id).dialogue[0].constructor='Reserved';invalid(poisoned,'reserved object key');
 let accessed=false;const accessor=clone(project);Object.defineProperty(inspection(accessor,item.id).dialogue[0],'text',{enumerable:true,get(){accessed=true;throw Error('Do not invoke me.');}});
 invalid(accessor,'accessors are not JSON');assert.throws(()=>normalizeProject(accessor),/accessors are not JSON/);assert.equal(accessed,false);
});
