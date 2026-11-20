import test from 'node:test';
import assert from 'node:assert/strict';
import {getSceneDialogue,pinCutsceneTiming,updateDialogue,insertDialogue,removeDialogue,moveDialogue} from './cutscene-dialogue.mjs';
import {compileRoomCutscene,separateCutsceneTracks} from './cutscene.mjs';
import {createDefaultProject,validateProject} from './developer-project.mjs';

const clone=value=>structuredClone(value);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const scene=()=>({id:'test',actors:[{id:'nell',feet:{x:80,y:90}},{id:'iris',feet:{x:500,y:350}}],geometry:{width:600,height:420,gridSize:20,radius:18,speed:160,maxDeltaMs:50,bounds:{x:20,y:20,width:560,height:380},start:{x:80,y:360,facing:'up'},obstacles:[{id:'nell',x:52,y:70,width:56,height:25},{id:'iris',x:472,y:330,width:56,height:25}],targets:[]}});
const line=(id,startTile,extra={})=>({id,kind:'dialogue',actor:'nell',speaker:'nell',text:id,startTile,durationTiles:10,...extra});
const fixture=()=>[
 line('later',70,{durationTiles:7,author:{color:'blue',tags:['keep']}}),
 {id:'walk',kind:'walk',actor:'nell',action:'search',destination:{x:160,y:200},startTile:0,durationTiles:40,author:{sound:'footstep'}},
 line('first',10,{speaker:'iris',durationTiles:12}),
 {id:'reaction',kind:'emote',actor:'nell',emote:'idea',startTile:3,durationTiles:7},
 line('blank',40,{actor:'mira',speaker:'mira',text:'',durationTiles:9}),
 {id:'gesture',kind:'gesture',actor:'iris',gesture:'magnify',startTile:12,durationTiles:18,author:{notes:['lens']}}
];
const physical=beats=>beats.filter(beat=>beat.kind!=='dialogue');
const compiledPhysical=(room,beats)=>compileRoomCutscene({scene:room,beats}).clips.filter(clip=>clip.kind!=='dialogue').map(({id,startTile,durationTiles,path})=>({id,startTile,durationTiles,path}));

test('all 26 default performances list every speech clip in the exact player order',()=>{
 const project=createDefaultProject(),before=clone(project);
 assert.equal(Object.keys(project.scenes).length,26);
 for(const [roomId,room]of Object.entries(project.scenes)){
  const beats=project.content[roomId].cutscene;
  const expected=compileRoomCutscene({scene:room,beats}).clips.filter(clip=>clip.kind==='dialogue');
  const actual=getSceneDialogue({scene:room,beats});
  assert.equal(actual.length,6,roomId);
  assert.deepEqual(actual.map(line=>line.id),expected.map(line=>line.id),roomId);
  for(const [position,line]of actual.entries()){
   const clip=expected[position];
   assert.equal(line.index,clip.index);assert.equal(line.text,beats[line.index].text);
   assert.equal(line.startTile,clip.startTile);assert.equal(line.durationTiles,clip.durationTiles);assert.equal(line.endTile,clip.endTile);
  }
  assert.equal(pinCutsceneTiming({scene:room,beats}),beats,'Explicit default timelines need no timing normalization.');
 }
 assert.deepEqual(project,before);
});

test('listing uses effective compiler chronology and includes blank editable speech',()=>{
 const room=scene(),beats=freeze([
  line('deferred',5,{durationTiles:2}),
  line('overlapping',0,{durationTiles:20}),
  line('other-owner',6,{actor:'mira',speaker:'iris',text:''}),
  {id:'not-speech',kind:'walk',actor:'iris',startTile:0,durationTiles:3,action:'look'}
 ]);
 const actual=getSceneDialogue({scene:room,beats});
 assert.deepEqual(actual.map(({id,index,startTile})=>({id,index,startTile})),[
  {id:'overlapping',index:1,startTile:0},{id:'other-owner',index:2,startTile:6},{id:'deferred',index:0,startTile:20}
 ]);
 assert.equal(actual[1].text,'');assert.equal(actual[1].actor,'mira');assert.equal(actual[1].speaker,'iris');
 actual[0].text='detached';assert.equal(beats[1].text,'overlapping');
});

test('text and voice edits preserve lane owner, timing, IDs and extra metadata',()=>{
 const beats=freeze(fixture()),snapshot=clone(beats);
 const changed=updateDialogue(beats,2,{text:'A revised question.',speaker:'mira',actor:'mira',durationTiles:1});
 assert.deepEqual(changed[2],{...snapshot[2],text:'A revised question.',speaker:'mira'});
 for(const index of [0,1,3,4,5])assert.deepEqual(changed[index],snapshot[index]);
 assert.equal(changed[2].actor,'nell','Voice does not transfer ownership to another actor.');
 changed[0].author.tags.push('new');assert.deepEqual(beats,snapshot,'Outputs are detached, including custom nested metadata.');
 const noActor=[{id:'voice-only',kind:'dialogue',speaker:'nell',text:'Hello',startTile:3,durationTiles:8}];
 assert.deepEqual(updateDialogue(noActor,0,{speaker:'iris'})[0],{...noActor[0],actor:'nell',speaker:'iris'});
 assert.equal(updateDialogue(beats,1,{text:'Cannot turn a walk into speech.'}),beats);
 assert.equal(updateDialogue(beats,99,{text:'Missing'}),beats);
 assert.equal(updateDialogue(beats,2,{text:beats[2].text}),beats);
});

test('empty and 600-character lines survive intact while oversized edits fail without truncation',()=>{
 const beats=fixture(),before=clone(beats),long='x'.repeat(600);
 assert.equal(updateDialogue(beats,2,{text:''})[2].text,'');
 assert.equal(updateDialogue(beats,2,{text:long})[2].text,long);
 assert.throws(()=>updateDialogue(beats,2,{text:long+'x'}),RangeError);
 assert.throws(()=>updateDialogue(beats,2,{text:null}),TypeError);
 assert.throws(()=>updateDialogue(beats,2,{speaker:null}),TypeError);
 assert.deepEqual(beats,before);
});

test('insertion creates a unique blank three-second line after the selected actual caption',()=>{
 const room=scene(),beats=freeze(fixture()),before=clone(beats);
 const changed=insertDialogue({scene:room,beats,afterIndex:2,speaker:'iris'}),added=changed[3];
 assert.deepEqual(added,{id:'dialogue-1',kind:'dialogue',actor:'iris',speaker:'iris',text:'',startTile:22,durationTiles:24});
 assert.deepEqual(getSceneDialogue({scene:room,beats:changed}).map(line=>line.id),['first','dialogue-1','blank','later']);
 assert.equal(changed.find(line=>line.id==='blank').startTile,46,'Only a following caption needing room shifts.');
 assert.equal(changed.find(line=>line.id==='later').startTile,70,'An existing longer pause survives.');
 assert.deepEqual(physical(changed),physical(beats));
 assert.deepEqual(compiledPhysical(room,changed),compiledPhysical(room,beats));
 assert.deepEqual(beats,before);
});

test('insertion appends by chronological order, handles empty scenes and never recycles an existing ID',()=>{
 const room=scene(),beats=[line('dialogue-1',40),line('dialogue-2',0),line('a'.repeat(80),20)];
 const changed=insertDialogue({scene:room,beats});
 assert.equal(changed[1].id,'dialogue-3');assert.equal(changed[1].startTile,50);assert.equal(changed[1].speaker,'nell');
 assert.deepEqual(changed.filter(line=>line.id!=='dialogue-3'),beats);
 assert(changed.every(line=>line.id.length<=80));
 const first=insertDialogue({scene:room,beats:[]});
 assert.deepEqual(first,[{id:'dialogue-1',kind:'dialogue',actor:'mira',speaker:'mira',text:'',startTile:0,durationTiles:24}]);
 assert.equal(insertDialogue({scene:room,beats,afterIndex:999}),beats);
});

test('removal deletes one speech record, keeping every other channel and pause intact',()=>{
 const room=scene(),beats=freeze(fixture()),before=clone(beats),changed=removeDialogue(beats,2);
 assert.deepEqual(changed,before.filter((_,index)=>index!==2));
 assert.deepEqual(physical(changed),physical(beats));
 assert.deepEqual(compiledPhysical(room,changed),compiledPhysical(room,beats));
 changed[0].author.tags.push('output-only');assert.deepEqual(beats,before);
 assert.equal(removeDialogue(beats,1),beats);assert.equal(removeDialogue(beats,-1),beats);
});

test('reordering retimes speech alone from the earliest start without changing durations or raw indexes',()=>{
 const room=scene(),beats=freeze(fixture()),before=clone(beats);
 const changed=moveDialogue({scene:room,beats,index:0,direction:'up'});
 assert.deepEqual(getSceneDialogue({scene:room,beats:changed}).map(({id,index,startTile,durationTiles})=>({id,index,startTile,durationTiles})),[
  {id:'first',index:2,startTile:10,durationTiles:12},
  {id:'later',index:0,startTile:22,durationTiles:7},
  {id:'blank',index:4,startTile:29,durationTiles:9}
 ]);
 for(const [index,line]of before.entries()){
  if(line.kind==='dialogue'){const {startTile,...fields}=changed[index];const {startTile:oldStart,...oldFields}=line;assert.deepEqual(fields,oldFields);}
  else assert.deepEqual(changed[index],line);
 }
 assert.deepEqual(compiledPhysical(room,changed),compiledPhysical(room,beats));
 assert.deepEqual(beats,before);
 const reversed=moveDialogue({scene:room,beats:changed,index:0,direction:'down'});
 assert.deepEqual(getSceneDialogue({scene:room,beats:reversed}).map(line=>line.id),['first','blank','later']);
 assert.equal(moveDialogue({scene:room,beats,index:2,direction:'up'}),beats);
 assert.equal(moveDialogue({scene:room,beats,index:0,direction:'down'}),beats);
 assert.equal(moveDialogue({scene:room,beats,index:1,direction:'up'}),beats);
 assert.equal(moveDialogue({scene:room,beats,index:2,direction:'sideways'}),beats);
});

test('pinning mixed untimed clips prevents a removed caption from shifting physical performance',()=>{
 const room=scene(),beats=freeze([
  {id:'caption',kind:'dialogue',actor:'mira',speaker:'mira',text:'Wait for our signal.'},
  {id:'walk',kind:'walk',actor:'nell',action:'search',destination:{x:160,y:200},author:{path:'preserve'}},
  {id:'emote',kind:'emote',actor:'nell',emote:'idea',startTile:100,durationTiles:7},
  {id:'later',kind:'dialogue',actor:'iris',speaker:'iris',text:'There it is.',startTile:120,durationTiles:22}
 ]),before=clone(beats),initialPhysical=compiledPhysical(room,beats);
 const pinned=pinCutsceneTiming({scene:room,beats});
 assert.deepEqual(pinned[2],beats[2]);assert.deepEqual(pinned[3],beats[3]);
 for(const [index,line]of pinned.entries()){
  if(before[index].startTile===undefined)assert(Number.isInteger(line.startTile));
  if(before[index].durationTiles===undefined)assert(Number.isInteger(line.durationTiles));
 }
 for(const changed of [
  removeDialogue(pinned,0),updateDialogue(pinned,0,{text:'x'.repeat(600)}),
  insertDialogue({scene:room,beats:pinned,afterIndex:0}),moveDialogue({scene:room,beats:pinned,index:0,direction:'down'})
 ])assert.deepEqual(compiledPhysical(room,changed),initialPhysical);
 assert.deepEqual(beats,before);
});

test('older combined cues can be separated before speech edits without transferring actor ownership',()=>{
 const room=scene(),legacy=[{id:'combined',actor:'nell',speaker:'iris',text:'Follow the reply.',destination:{x:160,y:200},action:'search',emote:'idea',startTile:4,durationTiles:35,author:{note:'keep'}}];
 const separated=separateCutsceneTracks({scene:room,beats:legacy}),speechIndex=separated.findIndex(clip=>clip.kind==='dialogue');
 const changed=updateDialogue(separated,speechIndex,{speaker:'mira',text:'A new reply.'});
 assert.equal(changed[speechIndex].actor,'nell');assert.equal(changed[speechIndex].speaker,'mira');
 assert.deepEqual(physical(changed),physical(separated));assert.deepEqual(changed[speechIndex].author,legacy[0].author);
});

test('capacity limits fail explicitly without dropping any authored clips',()=>{
 const room=scene(),beats=Array.from({length:384},(_,index)=>line(`clip-${index}`,index*10,{actor:'mira',speaker:'mira'})),before=clone(beats);
 assert.equal(getSceneDialogue({scene:room,beats}).length,384);
 assert.throws(()=>insertDialogue({scene:room,beats,afterIndex:0}),RangeError);
 assert.throws(()=>getSceneDialogue({scene:room,beats:[...beats,line('overflow',4000)]}),RangeError);
 assert.throws(()=>pinCutsceneTiming({scene:room,beats:[...beats,line('overflow',4000)]}),RangeError);
 assert.equal(removeDialogue(beats,383).length,383);assert.deepEqual(beats,before);
});

test('all default rooms remain valid and retain route costs, endings and inventory after speech authoring',()=>{
 const project=createDefaultProject(),before=clone(project);
 for(const [roomId,room]of Object.entries(project.scenes)){
  const beats=project.content[roomId].cutscene,first=getSceneDialogue({scene:room,beats})[0];
  let changed=updateDialogue(beats,first.index,{text:'A custom room introduction.',speaker:'mira'});
  changed=insertDialogue({scene:room,beats:changed,afterIndex:first.index,speaker:'mira'});
  const addedIndex=changed.findIndex(clip=>clip.id==='dialogue-1');
  changed=updateDialogue(changed,addedIndex,{text:'Let us listen.'});
  changed=moveDialogue({scene:room,beats:changed,index:addedIndex,direction:'up'});
  changed=removeDialogue(changed,addedIndex);
  project.content[roomId].cutscene=changed;
  assert.deepEqual(physical(changed),physical(beats),roomId);
  assert.deepEqual(compiledPhysical(room,changed),compiledPhysical(room,beats),roomId);
 }
 const validation=validateProject(project);assert.equal(validation.valid,true,validation.errors.join('\n'));
 assert.equal(project.schemaVersion,1);assert.deepEqual(project.settings,before.settings);
 assert.deepEqual(project.doors,before.doors);assert.deepEqual(project.sources,before.sources);
 assert.deepEqual(project.rooms,before.rooms);assert.deepEqual(project.terminals,before.terminals);assert.deepEqual(project.previews,before.previews);
 for(const id of Object.keys(project.content)){const {cutscene,...rest}=project.content[id];const {cutscene:old,...oldRest}=before.content[id];assert.deepEqual(rest,oldRest);}
});
